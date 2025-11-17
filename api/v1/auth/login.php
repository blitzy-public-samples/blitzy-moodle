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
 *   "password": "securepassword"
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
 *       "email": "student1@example.com"
 *     },
 *     "accessToken": "eyJ0eXAiOiJKV1...",
 *     "refreshToken": "eyJ0eXAiOiJKV1...",
 *     "expiresIn": 3600
 *   }
 * }
 *
 * Error responses:
 * - 400: Missing username or password
 * - 401: Invalid credentials
 * - 500: Authentication system error
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Include API base class and utilities
require_once(__DIR__ . '/../../lib/api_base.php');
require_once(__DIR__ . '/../../lib/auth_jwt.php');

/**
 * Authentication login endpoint class.
 *
 * Handles user authentication by wrapping Moodle's existing authentication
 * system and generating JWT tokens for stateless API access. Supports all
 * Moodle authentication methods (LDAP, OAuth, SAML, local, etc.) through
 * the authenticate_user_login() function.
 *
 * @package    core
 * @subpackage api
 */
class AuthLogin extends ApiBase {
    
    /**
     * Handle POST request for user login.
     *
     * This method:
     * 1. Extracts username and password from request body
     * 2. Validates required fields are present
     * 3. Calls Moodle's authenticate_user_login() function
     * 4. Generates access and refresh JWT tokens
     * 5. Returns user details and tokens
     *
     * The method uses existing Moodle authentication without duplicating
     * any business logic. All authentication plugins (LDAP, SSO, etc.)
     * continue to work as configured.
     *
     * @return void Outputs JSON response
     * @throws BadRequestException If username or password is missing
     * @throws UnauthorizedException If authentication fails
     */
    protected function handle_post() {
        global $DB, $CFG;
        
        // Get JSON request body
        $data = $this->getJsonBody();
        
        // Validate required fields
        if (empty($data['username'])) {
            throw new BadRequestException('Missing required field: username', [
                'field' => 'username',
                'message' => 'Username is required for authentication'
            ]);
        }
        
        if (empty($data['password'])) {
            throw new BadRequestException('Missing required field: password', [
                'field' => 'password',
                'message' => 'Password is required for authentication'
            ]);
        }
        
        // Extract credentials
        $username = $data['username'];
        $password = $data['password'];
        
        // Authenticate user using existing Moodle function
        // This function handles all authentication methods (LDAP, OAuth, local, etc.)
        $user = authenticate_user_login($username, $password);
        
        // Check authentication result
        if ($user === false) {
            throw new UnauthorizedException('Invalid username or password', [
                'reason' => 'Authentication failed',
                'action' => 'Please check your credentials and try again'
            ]);
        }
        
        // Check if user account is active
        if (!empty($user->suspended)) {
            throw new UnauthorizedException('User account is suspended', [
                'reason' => 'Account has been suspended by administrator',
                'action' => 'Please contact your site administrator'
            ]);
        }
        
        if (!empty($user->deleted)) {
            throw new UnauthorizedException('User account has been deleted', [
                'reason' => 'Account no longer exists',
                'action' => 'Please contact your site administrator'
            ]);
        }
        
        // Generate JWT tokens
        $jwtAuth = new JwtAuth();
        $accessToken = $jwtAuth->generateAccessToken($user->id);
        $refreshToken = $jwtAuth->generateRefreshToken($user->id);
        
        // Get user roles for response
        $roles = [];
        $userRoles = get_user_roles(context_system::instance(), $user->id, true);
        foreach ($userRoles as $role) {
            $roles[] = [
                'id' => $role->roleid,
                'name' => $role->name,
                'shortname' => $role->shortname
            ];
        }
        
        // Prepare user data for response
        $userData = [
            'id' => (int)$user->id,
            'username' => $user->username,
            'firstname' => $user->firstname,
            'lastname' => $user->lastname,
            'email' => $user->email,
            'roles' => $roles
        ];
        
        // Return success response with tokens and user data
        $this->success([
            'user' => $userData,
            'accessToken' => $accessToken,
            'refreshToken' => $refreshToken,
            'expiresIn' => JwtAuth::ACCESS_TOKEN_EXPIRY,
            'tokenType' => 'Bearer'
        ]);
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
    $endpoint = new AuthLogin();
    $endpoint->execute();
}
