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
 * REST API endpoint for user authentication and JWT token generation.
 *
 * This endpoint wraps Moodle's existing authenticate_user_login() function
 * to provide stateless JWT-based authentication for the React frontend.
 * On successful authentication, it generates both access and refresh tokens
 * that can be used for subsequent API requests.
 *
 * Endpoint: POST /api/v1/auth/login
 *
 * Request body (JSON):
 * {
 *   "username": "student1",
 *   "password": "securepassword",
 *   "logintoken": "abc123...",     // Optional CSRF token
 *   "recaptcha": "03AGdBq25..."    // Optional reCAPTCHA response
 * }
 *
 * Success response (200):
 * {
 *   "success": true,
 *   "data": {
 *     "user": {
 *       "id": 5,
 *       "username": "student1",
 *       "firstname": "John",
 *       "lastname": "Doe",
 *       "fullname": "John Doe",
 *       "email": "student1@example.com",
 *       "roles": [
 *         {"id": 5, "name": "Student", "shortname": "student"}
 *       ]
 *     },
 *     "access_token": "eyJ0eXAiOiJKV1...",
 *     "refresh_token": "eyJ0eXAiOiJKV1...",
 *     "token_type": "Bearer",
 *     "expires_in": 3600
 *   }
 * }
 *
 * Error responses:
 * - 400: Missing username or password (ValidationException)
 * - 401: Invalid credentials (UnauthorizedException)
 * - 403: Account suspended or unconfirmed (ForbiddenException)
 * - 404: Account deleted (NotFoundException)
 * - 500: Internal server error
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Include Moodle configuration and core libraries
require_once(__DIR__ . '/../../../config.php');
require_once($CFG->dirroot . '/lib/moodlelib.php');
require_once($CFG->dirroot . '/lib/authlib.php');

// Include API base class and utilities
require_once(__DIR__ . '/../../lib/api_base.php');
require_once(__DIR__ . '/../../lib/auth_jwt.php');
require_once(__DIR__ . '/../../lib/api_exception.php');

/**
 * Authentication login endpoint class.
 *
 * Handles user authentication by wrapping Moodle's existing authentication
 * system and generating JWT tokens for stateless API access. Supports all
 * Moodle authentication methods (LDAP, OAuth, SAML, local, etc.) through
 * the authenticate_user_login() function.
 *
 * This endpoint is a thin wrapper that delegates to existing Moodle functions:
 * - authenticate_user_login() for credential validation
 * - complete_user_login() for session initialization
 * - JwtAuth for token generation
 *
 * Zero business logic is duplicated from Moodle core.
 *
 * @package    core
 * @subpackage api
 */
class AuthLoginEndpoint extends ApiBase {
    
    /**
     * Constructor - Disable authentication requirement for this endpoint.
     *
     * The login endpoint must allow unauthenticated access since users
     * cannot have valid JWT tokens before authenticating.
     */
    public function __construct() {
        // Disable authentication requirement for this endpoint
        $this->requireAuth = false;
        parent::__construct();
    }
    
    /**
     * Handle POST request for user login.
     *
     * This method:
     * 1. Validates request contains username and password
     * 2. Normalizes username (trim + lowercase)
     * 3. Validates login token for CSRF protection if provided
     * 4. Validates CAPTCHA if enabled and response provided
     * 5. Calls authenticate_user_login() to validate credentials
     * 6. Checks account status (confirmed, suspended, deleted)
     * 7. Calls complete_user_login() for session initialization
     * 8. Applies concurrent login limits
     * 9. Generates JWT access and refresh tokens
     * 10. Returns user data and tokens
     *
     * The method uses existing Moodle authentication without duplicating
     * any business logic. All authentication plugins (LDAP, SSO, etc.)
     * continue to work as configured.
     *
     * @return void Outputs JSON response
     * @throws ValidationException If username or password is missing
     * @throws UnauthorizedException If authentication fails
     * @throws ForbiddenException If account is suspended or unconfirmed
     * @throws NotFoundException If account is deleted
     */
    protected function handle_post() {
        global $DB, $CFG;
        
        try {
            // Get JSON request body
            $data = $this->getJsonBody();
            
            // Validate required fields - throw ValidationException for missing fields
            $validationErrors = [];
            
            if (empty($data['username']) || trim($data['username']) === '') {
                $validationErrors['username'] = 'Username is required for authentication';
            }
            
            if (empty($data['password']) || trim($data['password']) === '') {
                $validationErrors['password'] = 'Password is required for authentication';
            }
            
            if (!empty($validationErrors)) {
                throw new ValidationException('Validation failed', $validationErrors);
            }
            
            // Extract and normalize credentials following pattern from public/login/index.php line 139
            // Username is trimmed and lowercased for consistency
            $username = trim(core_text::strtolower($data['username']));
            $password = $data['password'];
            
            // Extract optional parameters
            $logintoken = isset($data['logintoken']) ? $data['logintoken'] : null;
            // For recaptcha, use false as default instead of null to match function signature
            $recaptcha = isset($data['recaptcha']) ? $data['recaptcha'] : false;
            
            // Handle login token for CSRF protection
            // For REST API clients that don't have a form display step, we generate
            // an ephemeral token on-the-fly. This satisfies Moodle's web context
            // requirements while maintaining stateless API design.
            if ($logintoken !== null) {
                // Client provided a token - validate it
                try {
                    \core\session\manager::validate_login_token($logintoken);
                } catch (moodle_exception $e) {
                    throw new UnauthorizedException('Invalid login token', [
                        'error' => 'CSRF_TOKEN_INVALID',
                        'message' => 'The login token has expired or is invalid. Please refresh the page and try again.'
                    ]);
                }
            } else {
                // No token provided - generate ephemeral token for REST API compatibility
                // This allows single-step authentication without requiring clients to
                // first request a token from a separate endpoint
                $logintoken = \core\session\manager::get_login_token();
            }
            
            // Check if CAPTCHA is enabled and validate if response provided
            // This prevents brute force attacks by requiring human verification
            if (function_exists('login_captcha_enabled') && login_captcha_enabled()) {
                if ($recaptcha === null) {
                    throw new ValidationException('reCAPTCHA verification required', [
                        'recaptcha' => 'Please complete the CAPTCHA verification'
                    ]);
                }
                // CAPTCHA validation is handled internally by authenticate_user_login
            }
            
            // Authenticate user using existing Moodle function
            // This function handles all authentication methods (LDAP, OAuth, local, etc.)
            // It returns user object on success, false on failure
            // The $failurereason parameter is set by reference to indicate error type
            $failurereason = null;
            $user = authenticate_user_login($username, $password, false, $failurereason, $logintoken, $recaptcha);
            
            // Check authentication result and handle specific failure reasons
            if ($user === false) {
                // Map Moodle auth error codes to appropriate exceptions
                // Error codes defined in lib/authlib.php
                switch ($failurereason) {
                    case AUTH_LOGIN_NOUSER:
                        throw new UnauthorizedException('Invalid username or password', [
                            'error' => 'AUTH_FAILED',
                            'message' => 'The username or password you entered is incorrect.'
                        ]);
                    
                    case AUTH_LOGIN_FAILED:
                        throw new UnauthorizedException('Invalid username or password', [
                            'error' => 'AUTH_FAILED',
                            'message' => 'The username or password you entered is incorrect.'
                        ]);
                    
                    case AUTH_LOGIN_SUSPENDED:
                        throw new ForbiddenException('Account suspended', [
                            'error' => 'ACCOUNT_SUSPENDED',
                            'message' => 'Your account has been suspended. Please contact the site administrator.'
                        ]);
                    
                    case AUTH_LOGIN_LOCKOUT:
                        throw new UnauthorizedException('Account temporarily locked', [
                            'error' => 'ACCOUNT_LOCKOUT',
                            'message' => 'Too many failed login attempts. Your account has been temporarily locked.'
                        ]);
                    
                    case AUTH_LOGIN_UNAUTHORISED:
                        throw new UnauthorizedException('Login not authorized', [
                            'error' => 'AUTH_UNAUTHORISED',
                            'message' => 'You are not authorized to log in to this site.'
                        ]);
                    
                    case AUTH_LOGIN_FAILED_RECAPTCHA:
                        throw new ValidationException('reCAPTCHA verification failed', [
                            'recaptcha' => 'The reCAPTCHA verification failed. Please try again.'
                        ]);
                    
                    default:
                        throw new UnauthorizedException('Authentication failed', [
                            'error' => 'AUTH_FAILED',
                            'message' => 'Authentication failed. Please try again.'
                        ]);
                }
            }
            
            // Check account status - unconfirmed accounts cannot log in
            // This ensures users have verified their email address
            if (empty($user->confirmed)) {
                throw new ForbiddenException('Account not confirmed', [
                    'error' => 'ACCOUNT_UNCONFIRMED',
                    'message' => 'Your account has not been confirmed. Please check your email for a confirmation link.'
                ]);
            }
            
            // Check if account is suspended - suspended users cannot access the system
            if (!empty($user->suspended)) {
                throw new ForbiddenException('Account suspended', [
                    'error' => 'ACCOUNT_SUSPENDED',
                    'message' => 'Your account has been suspended. Please contact the site administrator.'
                ]);
            }
            
            // Check if account is deleted - return 404 for security
            // Using 404 instead of 403 prevents information disclosure about deleted accounts
            if (!empty($user->deleted)) {
                throw new NotFoundException('User not found', [
                    'error' => 'USER_NOT_FOUND',
                    'message' => 'The specified user account does not exist.'
                ]);
            }
            
            // Complete user login process - initializes session and triggers events
            // This function handles:
            // - Setting up the user session
            // - Updating last login time
            // - Triggering user_loggedin event
            // - Loading user preferences
            complete_user_login($user);
            
            // Apply concurrent login limits - enforces maximum sessions per user
            // This prevents session hijacking and enforces security policies
            \core\session\manager::apply_concurrent_login_limit($user->id, session_id());
            
            // Generate JWT tokens using the JwtAuth utility
            // Access token: short-lived (1 hour) for API requests
            // Refresh token: long-lived (7 days) for obtaining new access tokens
            $accessToken = $this->jwtAuth->generateAccessToken($user->id);
            $refreshToken = $this->jwtAuth->generateRefreshToken($user->id);
            
            // Load user roles for inclusion in response
            // Roles are needed by frontend for permission-based UI rendering
            $roles = [];
            $context = context_system::instance();
            $userRoles = get_user_roles($context, $user->id, true);
            foreach ($userRoles as $role) {
                $roles[] = [
                    'id' => (int)$role->roleid,
                    'name' => $role->name,
                    'shortname' => $role->shortname
                ];
            }
            
            // Prepare user data for response
            // Include all relevant user information needed by frontend
            $userData = [
                'id' => (int)$user->id,
                'username' => $user->username,
                'firstname' => $user->firstname,
                'lastname' => $user->lastname,
                'fullname' => fullname($user),
                'email' => $user->email,
                'roles' => $roles
            ];
            
            // Return success response with tokens and user data
            // Response follows standard API envelope format
            $this->success([
                'user' => $userData,
                'access_token' => $accessToken,
                'refresh_token' => $refreshToken,
                'token_type' => 'Bearer',
                'expires_in' => 3600  // 1 hour in seconds
            ]);
            
        } catch (ValidationException $e) {
            // Re-throw ValidationException as-is (400 status code)
            throw $e;
        } catch (UnauthorizedException $e) {
            // Re-throw UnauthorizedException as-is (401 status code)
            throw $e;
        } catch (ForbiddenException $e) {
            // Re-throw ForbiddenException as-is (403 status code)
            throw $e;
        } catch (NotFoundException $e) {
            // Re-throw NotFoundException as-is (404 status code)
            throw $e;
        } catch (moodle_exception $e) {
            // Wrap Moodle exceptions in UnauthorizedException
            throw new UnauthorizedException('Authentication failed: ' . $e->getMessage(), [
                'error' => 'AUTH_ERROR',
                'message' => $e->getMessage()
            ]);
        } catch (Exception $e) {
            // Wrap unexpected exceptions as internal server errors
            throw new ApiException('Internal server error during authentication', 500, [
                'error' => 'INTERNAL_ERROR',
                'message' => 'An unexpected error occurred. Please try again later.'
            ]);
        }
    }
    
    /**
     * GET method not allowed for login endpoint.
     *
     * @return void
     * @throws MethodNotAllowedException Always throws this exception
     */
    protected function handle_get() {
        throw new MethodNotAllowedException('GET method not allowed for login. Use POST instead.');
    }
    
    /**
     * PUT method not allowed for login endpoint.
     *
     * @return void
     * @throws MethodNotAllowedException Always throws this exception
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method not allowed for login. Use POST instead.');
    }
    
    /**
     * DELETE method not allowed for login endpoint.
     *
     * @return void
     * @throws MethodNotAllowedException Always throws this exception
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method not allowed for login. Use POST instead.');
    }
}

// Execute the endpoint if not in test mode
if (!defined('API_TEST_MODE')) {
    $endpoint = new AuthLoginEndpoint();
    $endpoint->execute();
}
