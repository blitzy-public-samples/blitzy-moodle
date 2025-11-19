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
 * REST API endpoint for refreshing expired JWT access tokens using valid refresh tokens.
 *
 * This endpoint implements token rotation for stateless JWT authentication, allowing
 * clients to obtain new access and refresh token pairs without requiring full
 * re-authentication. This enables seamless long-lived SPA sessions while maintaining
 * security through short-lived access tokens (1 hour) and renewable refresh tokens (7 days).
 *
 * Security features:
 * - Validates refresh token signature and expiration
 * - Verifies token type to prevent access token misuse
 * - Checks token blacklist to prevent reuse after logout
 * - Validates user account status (not suspended/deleted)
 * - Generates new token pair for rotation
 *
 * Endpoint: POST /api/v1/auth/refresh
 *
 * Request body (JSON):
 * {
 *   "refresh_token": "eyJ0eXAiOiJKV1QiLCJhbGc..."
 * }
 *
 * Success response (200):
 * {
 *   "success": true,
 *   "data": {
 *     "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
 *     "refresh_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
 *     "token_type": "Bearer",
 *     "expires_in": 3600
 *   }
 * }
 *
 * Error responses:
 * - 400 Bad Request: Missing or empty refresh_token field
 * - 401 Unauthorized: Invalid/expired token, wrong token type, blacklisted token
 * - 404 Not Found: User account no longer exists
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Include required API infrastructure
require_once(__DIR__ . '/../../lib/api_base.php');
require_once(__DIR__ . '/../../lib/auth_jwt.php');
require_once(__DIR__ . '/../../lib/api_exception.php');

/**
 * Token refresh endpoint for JWT authentication rotation.
 *
 * Extends ApiBase to handle POST /api/v1/auth/refresh requests. Validates
 * incoming refresh tokens and generates new access/refresh token pairs,
 * enabling seamless authentication renewal without forcing user re-login.
 *
 * This endpoint does NOT require JWT authentication (sets $requireAuth = false)
 * since the refresh token itself serves as the authentication credential.
 *
 * @package    core
 * @subpackage api
 */
class RefreshEndpoint extends ApiBase {
    
    /**
     * Constructor for RefreshEndpoint.
     *
     * Disables automatic JWT authentication since refresh token validation
     * replaces the standard authentication flow for this endpoint.
     */
    public function __construct() {
        parent::__construct(false); // $requireAuth = false
    }
    
    /**
     * Handle POST request for JWT token refresh.
     *
     * Implements secure token rotation flow:
     * 1. Extract and validate refresh_token from request body
     * 2. Verify token signature and expiration using JwtAuth
     * 3. Confirm token type is 'refresh' (not 'access')
     * 4. Check token is not blacklisted (revoked during logout)
     * 5. Extract and validate user from token payload
     * 6. Generate new access token (1-hour expiration)
     * 7. Generate new refresh token (7-day expiration)
     * 8. Return both tokens in standard response envelope
     *
     * Token rotation strategy: Both tokens are renewed on each refresh,
     * providing defense against token replay attacks while maintaining
     * seamless user experience.
     *
     * @return array Response data array for ApiBase::success() method
     * @throws ValidationException If refresh_token field is missing or empty (400)
     * @throws UnauthorizedException If token is invalid, expired, wrong type, or blacklisted (401)
     * @throws NotFoundException If user from token no longer exists (404)
     */
    protected function handle_post() {
        // Step 1: Extract JSON request body
        $body = $this->getJsonBody();
        
        // Step 2: Validate refresh_token field presence
        if (empty($body['refresh_token'])) {
            throw new ValidationException(
                'Refresh token is required',
                [
                    'field' => 'refresh_token',
                    'message' => 'The refresh_token field must be provided in request body',
                    'example' => '{"refresh_token": "eyJ0eXAiOiJKV1QiLCJhbGc..."}'
                ]
            );
        }
        
        $refreshToken = $body['refresh_token'];
        
        // Step 3: Validate token signature and expiration
        try {
            $decoded = $this->jwtAuth->validateToken($refreshToken);
        } catch (Exception $e) {
            throw new UnauthorizedException(
                'Invalid or expired refresh token',
                [
                    'reason' => $e->getMessage(),
                    'action' => 'Please log in again to obtain new authentication tokens'
                ]
            );
        }
        
        // Step 4: Verify token type is 'refresh' (prevent access token misuse)
        if (!isset($decoded->type) || $decoded->type !== 'refresh') {
            throw new UnauthorizedException(
                'Token is not a refresh token',
                [
                    'expected' => 'refresh',
                    'received' => $decoded->type ?? 'unknown',
                    'message' => 'Only refresh tokens can be used for token renewal'
                ]
            );
        }
        
        // Step 5: Check token is not blacklisted (revoked after logout)
        if ($this->jwtAuth->isTokenBlacklisted($refreshToken)) {
            throw new UnauthorizedException(
                'Refresh token has been revoked',
                [
                    'reason' => 'Token was blacklisted after logout',
                    'action' => 'Please log in again to obtain new authentication tokens'
                ]
            );
        }
        
        // Step 6: Extract user from token payload and validate user exists
        try {
            $user = $this->jwtAuth->getUserFromToken($refreshToken);
        } catch (NotFoundException $e) {
            throw new NotFoundException(
                'User account not found',
                [
                    'reason' => 'The user associated with this token no longer exists',
                    'action' => 'Please contact your site administrator'
                ]
            );
        }
        
        // Step 7: Generate new access token with 1-hour expiration
        $newAccessToken = $this->jwtAuth->generateAccessToken($user->id);
        
        // Step 8: Generate new refresh token with 7-day expiration
        $newRefreshToken = $this->jwtAuth->generateRefreshToken($user->id);
        
        // Step 9: Return both tokens in standard response format
        return $this->success([
            'access_token' => $newAccessToken,
            'refresh_token' => $newRefreshToken,
            'token_type' => 'Bearer',
            'expires_in' => 3600  // Access token expires in 1 hour (3600 seconds)
        ]);
    }
}

// Execute endpoint if not in test mode
if (!defined('API_TEST_MODE')) {
    $endpoint = new RefreshEndpoint();
    $endpoint->execute();
}
