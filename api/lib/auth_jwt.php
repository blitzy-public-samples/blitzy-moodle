<?php
// This file is part of Moodle - http://moodle.org/
//
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// Moodle is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with Moodle.  If not, see <http://www.gnu.org/licenses/>.

/**
 * JWT authentication utility for REST API.
 *
 * Provides comprehensive JWT token management for stateless authentication in the
 * React frontend integration. Handles token generation, validation, refresh, and
 * blacklisting using the firebase/php-jwt library with HS256 algorithm.
 *
 * Token Types:
 * - Access Token: Short-lived token (1 hour) for API authentication
 * - Refresh Token: Long-lived token (7 days) for obtaining new access tokens
 *
 * Security Features:
 * - HS256 algorithm with 256-bit secret key
 * - Token expiration validation
 * - Signature verification
 * - Redis-based token blacklist for instant logout
 * - Integration with Moodle's existing role and capability system
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Include Moodle configuration (skip in test mode)
if (!defined('API_TEST_MODE')) {
    require_once(__DIR__ . '/../../config.php');
}

// Import firebase/php-jwt library classes
use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Firebase\JWT\ExpiredException;
use Firebase\JWT\SignatureInvalidException;
use Firebase\JWT\BeforeValidException;

// Import API exception classes
require_once(__DIR__ . '/api_exception.php');

/**
 * JWT Authentication class for REST API token management.
 *
 * This class provides all functionality needed for JWT-based stateless authentication:
 * - Token generation (access and refresh tokens)
 * - Token validation and verification
 * - User extraction from tokens
 * - Token refresh mechanism
 * - Token blacklisting for logout
 * - Request header parsing
 *
 * Example usage:
 * <code>
 * $jwtAuth = new JwtAuth();
 * 
 * // Generate tokens after successful login
 * $accessToken = $jwtAuth->generateAccessToken($userid);
 * $refreshToken = $jwtAuth->generateRefreshToken($userid);
 * 
 * // Validate token from request
 * $token = $jwtAuth->extractTokenFromRequest();
 * $payload = $jwtAuth->validateToken($token);
 * 
 * // Get user from token
 * $user = $jwtAuth->getUserFromToken($token);
 * 
 * // Refresh expired access token
 * $newAccessToken = $jwtAuth->refreshAccessToken($refreshToken);
 * 
 * // Logout - blacklist token
 * $jwtAuth->blacklistToken($accessToken);
 * </code>
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class JwtAuth {
    
    /**
     * @var int Access token expiration time in seconds (1 hour)
     */
    const ACCESS_TOKEN_EXPIRY = 3600;
    
    /**
     * @var int Refresh token expiration time in seconds (7 days)
     */
    const REFRESH_TOKEN_EXPIRY = 604800;
    
    /**
     * @var Redis Redis connection instance for token blacklist management
     */
    private $redis;
    
    /**
     * Constructor - initializes Redis connection if available.
     *
     * Attempts to establish Redis connection for token blacklist functionality.
     * If Redis is not available, blacklist operations will be skipped gracefully.
     */
    public function __construct() {
        $this->redis = null;
        
        // Skip Redis connection in test mode
        if (defined('API_TEST_MODE') && API_TEST_MODE) {
            return;
        }
        
        // Attempt to connect to Redis if extension is loaded
        if (extension_loaded('redis')) {
            try {
                global $CFG;
                $this->redis = new Redis();
                
                // Use Moodle's Redis configuration if available
                $redisHost = isset($CFG->redis_host) ? $CFG->redis_host : '127.0.0.1';
                $redisPort = isset($CFG->redis_port) ? $CFG->redis_port : 6379;
                
                $this->redis->connect($redisHost, $redisPort);
                
                // Authenticate if password is configured
                if (isset($CFG->redis_password) && !empty($CFG->redis_password)) {
                    $this->redis->auth($CFG->redis_password);
                }
            } catch (Exception $e) {
                // Redis connection failed - blacklist operations will be disabled
                $this->redis = null;
                debugging('Redis connection failed for JWT blacklist: ' . $e->getMessage(), DEBUG_DEVELOPER);
            }
        }
    }
    
    /**
     * Generate an access token for the specified user.
     *
     * Creates a JWT access token with 1-hour expiration containing user ID,
     * roles, issuer, and timestamps. The token is signed using HS256 algorithm
     * with the configured secret key.
     *
     * Token payload structure:
     * - iss: Token issuer (Moodle site URL)
     * - iat: Issued at timestamp
     * - exp: Expiration timestamp
     * - sub: Subject (user ID)
     * - type: Token type ('access')
     * - roles: Array of user role IDs and shortnames
     *
     * @param int   $userid User ID for whom to generate the token
     * @param array $roles  Optional array of roles (auto-fetched if not provided)
     * @return string JWT access token
     * @throws ServerException If JWT secret is not configured
     */
    public function generateAccessToken($userid, $roles = null) {
        global $CFG, $DB;
        
        // Get JWT secret from configuration
        $secret = $this->getJwtSecret();
        
        // Fetch user roles if not provided (skip in test mode)
        if ($roles === null) {
            if (defined('API_TEST_MODE') && API_TEST_MODE) {
                $roles = []; // Default empty roles in test mode
            } else {
                $roles = $this->getUserRoles($userid);
            }
        }
        
        // Current timestamp
        $now = time();
        
        // Determine issuer (use test value in test mode)
        $issuer = (defined('API_TEST_MODE') && API_TEST_MODE) 
            ? 'http://test.moodle.local' 
            : $CFG->wwwroot;
        
        // Build JWT payload
        $payload = [
            'iss' => $issuer,                           // Issuer
            'iat' => $now,                              // Issued at
            'exp' => $now + self::ACCESS_TOKEN_EXPIRY, // Expiration
            'sub' => $userid,                           // Subject (user ID)
            'type' => 'access',                         // Token type
            'roles' => $roles                           // User roles
        ];
        
        // Encode and return JWT token
        return JWT::encode($payload, $secret, 'HS256');
    }
    
    /**
     * Generate a refresh token for the specified user.
     *
     * Creates a JWT refresh token with 7-day expiration. Refresh tokens are
     * long-lived and used to obtain new access tokens without re-authentication.
     * They have the same structure as access tokens but different type and expiry.
     *
     * @param int $userid User ID for whom to generate the token
     * @return string JWT refresh token
     * @throws ServerException If JWT secret is not configured
     */
    public function generateRefreshToken($userid) {
        global $CFG, $DB;
        
        // Get JWT secret from configuration
        $secret = $this->getJwtSecret();
        
        // Fetch user roles (skip in test mode)
        if (defined('API_TEST_MODE') && API_TEST_MODE) {
            $roles = []; // Default empty roles in test mode
        } else {
            $roles = $this->getUserRoles($userid);
        }
        
        // Current timestamp
        $now = time();
        
        // Determine issuer (use test value in test mode)
        $issuer = (defined('API_TEST_MODE') && API_TEST_MODE) 
            ? 'http://test.moodle.local' 
            : $CFG->wwwroot;
        
        // Build JWT payload for refresh token
        $payload = [
            'iss' => $issuer,                             // Issuer
            'iat' => $now,                                // Issued at
            'exp' => $now + self::REFRESH_TOKEN_EXPIRY,  // Expiration (7 days)
            'sub' => $userid,                             // Subject (user ID)
            'type' => 'refresh',                          // Token type
            'roles' => $roles                             // User roles
        ];
        
        // Encode and return JWT token
        return JWT::encode($payload, $secret, 'HS256');
    }
    
    /**
     * Validate a JWT token and return its decoded payload.
     *
     * Verifies the token's signature, checks expiration, validates temporal
     * constraints (nbf), and ensures the token is not blacklisted. Throws
     * appropriate exceptions for various failure scenarios.
     *
     * @param string $token JWT token to validate
     * @return object Decoded token payload
     * @throws UnauthorizedException If token is invalid, expired, or blacklisted
     */
    public function validateToken($token) {
        // Get JWT secret from configuration
        $secret = $this->getJwtSecret();
        
        try {
            // Check if token is blacklisted before validation
            if ($this->isTokenBlacklisted($token)) {
                throw new UnauthorizedException('Token has been revoked', [
                    'reason' => 'Token is blacklisted (user logged out)'
                ]);
            }
            
            // Decode and verify JWT token
            $decoded = JWT::decode($token, new Key($secret, 'HS256'));
            
            return $decoded;
            
        } catch (ExpiredException $e) {
            // Token has expired
            throw new UnauthorizedException('Token has expired', [
                'originalError' => $e->getMessage(),
                'action' => 'Please refresh your token or re-authenticate'
            ]);
            
        } catch (SignatureInvalidException $e) {
            // Token signature is invalid
            throw new UnauthorizedException('Invalid token signature', [
                'originalError' => $e->getMessage(),
                'reason' => 'Token may have been tampered with'
            ]);
            
        } catch (BeforeValidException $e) {
            // Token not yet valid (nbf claim)
            throw new UnauthorizedException('Token not yet valid', [
                'originalError' => $e->getMessage(),
                'reason' => 'Token has a future activation time'
            ]);
            
        } catch (UnauthorizedException $e) {
            // Re-throw our custom exceptions
            throw $e;
            
        } catch (Exception $e) {
            // Catch any other JWT-related exceptions
            throw new UnauthorizedException('Token validation failed', [
                'originalError' => $e->getMessage()
            ]);
        }
    }
    
    /**
     * Extract user object from a JWT token.
     *
     * Validates the token, extracts the user ID from the 'sub' claim, and
     * loads the complete user record from the database. Throws exceptions
     * if the token is invalid or the user is not found.
     *
     * @param string $token JWT token containing user ID
     * @return object User object from database
     * @throws UnauthorizedException If token is invalid
     * @throws NotFoundException If user does not exist
     */
    public function getUserFromToken($token) {
        global $DB;
        
        // Validate token and get payload
        $payload = $this->validateToken($token);
        
        // Extract user ID from 'sub' claim
        if (!isset($payload->sub)) {
            throw new UnauthorizedException('Token does not contain user ID', [
                'claim' => 'sub',
                'reason' => 'Malformed token payload'
            ]);
        }
        
        $userid = $payload->sub;
        
        // Load user from database
        $user = $DB->get_record('user', ['id' => $userid]);
        
        if (!$user) {
            throw new NotFoundException('User not found', [
                'userId' => $userid,
                'reason' => 'User may have been deleted'
            ]);
        }
        
        // Check if user account is deleted or suspended
        if ($user->deleted) {
            throw new UnauthorizedException('User account has been deleted', [
                'userId' => $userid
            ]);
        }
        
        if ($user->suspended) {
            throw new UnauthorizedException('User account is suspended', [
                'userId' => $userid
            ]);
        }
        
        return $user;
    }
    
    /**
     * Refresh an access token using a valid refresh token.
     *
     * Validates the refresh token, ensures it's of type 'refresh', and generates
     * a new access token for the user. This enables seamless token renewal without
     * requiring the user to re-authenticate.
     *
     * @param string $refreshToken Valid refresh token
     * @return string New access token
     * @throws UnauthorizedException If refresh token is invalid
     * @throws ValidationException If token type is not 'refresh'
     */
    public function refreshAccessToken($refreshToken) {
        // Validate refresh token
        $payload = $this->validateToken($refreshToken);
        
        // Ensure token type is 'refresh'
        if (!isset($payload->type) || $payload->type !== 'refresh') {
            throw new ValidationException('Invalid token type for refresh operation', [
                'expectedType' => 'refresh',
                'actualType' => isset($payload->type) ? $payload->type : 'missing',
                'reason' => 'Only refresh tokens can be used to obtain new access tokens'
            ]);
        }
        
        // Extract user ID
        if (!isset($payload->sub)) {
            throw new UnauthorizedException('Token does not contain user ID', [
                'claim' => 'sub'
            ]);
        }
        
        $userid = $payload->sub;
        
        // Extract roles from payload (to maintain consistency)
        $roles = isset($payload->roles) ? (array)$payload->roles : null;
        
        // Generate and return new access token
        return $this->generateAccessToken($userid, $roles);
    }
    
    /**
     * Add a token to the blacklist (for logout functionality).
     *
     * Stores the token in Redis with an expiration time matching the token's
     * remaining lifetime. This enables instant logout by invalidating tokens
     * server-side before their natural expiration.
     *
     * If Redis is not available, this operation is skipped gracefully and
     * tokens will remain valid until expiration (degraded security but no errors).
     *
     * @param string $token   JWT token to blacklist
     * @param int    $expiry  Optional expiration time in seconds (auto-calculated if not provided)
     * @return bool True if blacklisted successfully, false if Redis unavailable
     */
    public function blacklistToken($token, $expiry = null) {
        // Skip if Redis is not available
        if ($this->redis === null) {
            debugging('Redis not available - token blacklist disabled', DEBUG_DEVELOPER);
            return false;
        }
        
        try {
            // Decode token to get expiration time (don't validate signature, just decode)
            $secret = $this->getJwtSecret();
            JWT::$leeway = 60; // Allow 60 seconds leeway for clock skew
            $decoded = JWT::decode($token, new Key($secret, 'HS256'));
            
            // Calculate time until token expires
            if ($expiry === null && isset($decoded->exp)) {
                $expiry = $decoded->exp - time();
                
                // Ensure expiry is positive
                if ($expiry <= 0) {
                    // Token already expired, no need to blacklist
                    return true;
                }
            }
            
            // Use token itself as key (or hash it for shorter keys)
            $key = 'jwt:blacklist:' . hash('sha256', $token);
            
            // Store in Redis with expiration
            if ($expiry !== null && $expiry > 0) {
                $this->redis->setex($key, $expiry, '1');
            } else {
                // Default to maximum token lifetime if expiry not provided
                $this->redis->setex($key, self::REFRESH_TOKEN_EXPIRY, '1');
            }
            
            return true;
            
        } catch (Exception $e) {
            debugging('Failed to blacklist token: ' . $e->getMessage(), DEBUG_DEVELOPER);
            return false;
        }
    }
    
    /**
     * Check if a token is blacklisted.
     *
     * Queries Redis to determine if the token has been revoked (user logged out).
     * If Redis is not available, returns false (assumes token is valid).
     *
     * @param string $token JWT token to check
     * @return bool True if token is blacklisted, false otherwise
     */
    public function isTokenBlacklisted($token) {
        // Skip if Redis is not available
        if ($this->redis === null) {
            return false;
        }
        
        try {
            // Use same key format as blacklistToken()
            $key = 'jwt:blacklist:' . hash('sha256', $token);
            
            // Check if key exists in Redis
            $result = $this->redis->get($key);
            
            return $result !== false;
            
        } catch (Exception $e) {
            debugging('Failed to check token blacklist: ' . $e->getMessage(), DEBUG_DEVELOPER);
            return false;
        }
    }
    
    /**
     * Extract JWT token from HTTP request headers.
     *
     * Looks for the Authorization header with 'Bearer <token>' format.
     * This is the standard method for passing JWT tokens in HTTP requests.
     *
     * Supported header formats:
     * - Authorization: Bearer <token>
     * - authorization: Bearer <token>
     * - HTTP_AUTHORIZATION: Bearer <token>
     *
     * @return string|null JWT token if found, null otherwise
     */
    public function extractTokenFromRequest() {
        // Check standard Authorization header
        $headers = $this->getAuthorizationHeader();
        
        if ($headers && preg_match('/Bearer\s+(.+)/i', $headers, $matches)) {
            return $matches[1];
        }
        
        return null;
    }
    
    /**
     * Get the JWT secret key from configuration.
     *
     * Retrieves the secret key used for signing and verifying JWT tokens.
     * The secret must be configured in $CFG->jwt_secret.
     *
     * @return string JWT secret key
     * @throws ServerException If JWT secret is not configured
     */
    public function getJwtSecret() {
        // Return test secret in test mode
        if (defined('API_TEST_MODE') && API_TEST_MODE) {
            return 'test_jwt_secret_minimum_32_characters_required_for_security';
        }
        
        global $CFG;
        
        if (!isset($CFG->jwt_secret) || empty($CFG->jwt_secret)) {
            throw new ServerException('JWT secret is not configured', [
                'configuration' => 'jwt_secret',
                'location' => 'config.php',
                'action' => 'Please add $CFG->jwt_secret with a secure random string (minimum 32 characters)'
            ]);
        }
        
        // Warn if secret is too short (security best practice)
        if (strlen($CFG->jwt_secret) < 32) {
            debugging('JWT secret should be at least 32 characters for security', DEBUG_DEVELOPER);
        }
        
        return $CFG->jwt_secret;
    }
    
    /**
     * Get user roles for JWT token payload.
     *
     * Fetches all role assignments for the user across all contexts and
     * returns an array of role information for inclusion in JWT tokens.
     *
     * @param int $userid User ID
     * @return array Array of role information (id, shortname)
     */
    private function getUserRoles($userid) {
        global $DB;
        
        $roles = [];
        
        // Get all role assignments for user
        $roleassignments = $DB->get_records('role_assignments', ['userid' => $userid]);
        
        foreach ($roleassignments as $ra) {
            // Get role details
            $role = $DB->get_record('role', ['id' => $ra->roleid], 'id, shortname, name');
            
            if ($role && !isset($roles[$role->id])) {
                $roles[$role->id] = [
                    'id' => $role->id,
                    'shortname' => $role->shortname
                ];
            }
        }
        
        // Return as indexed array
        return array_values($roles);
    }
    
    /**
     * Get Authorization header from request.
     *
     * Checks multiple possible locations for the Authorization header
     * due to different server configurations.
     *
     * @return string|null Authorization header value
     */
    private function getAuthorizationHeader() {
        $headers = null;
        
        // Check apache_request_headers() if available
        if (function_exists('apache_request_headers')) {
            $requestHeaders = apache_request_headers();
            
            // Header names are case-insensitive
            if (isset($requestHeaders['Authorization'])) {
                $headers = $requestHeaders['Authorization'];
            } else if (isset($requestHeaders['authorization'])) {
                $headers = $requestHeaders['authorization'];
            }
        }
        
        // Check $_SERVER for Authorization header (various formats)
        if (!$headers) {
            if (isset($_SERVER['HTTP_AUTHORIZATION'])) {
                $headers = $_SERVER['HTTP_AUTHORIZATION'];
            } else if (isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
                $headers = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
            }
        }
        
        return $headers;
    }
}
