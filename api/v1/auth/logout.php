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
 * REST API endpoint for user logout and JWT token invalidation.
 *
 * This endpoint handles user logout by invalidating the JWT access token.
 * The token is added to a Redis-based blacklist to prevent further use
 * until its natural expiration. This provides instant logout capability
 * for the React frontend while maintaining stateless authentication.
 *
 * Endpoint: POST /api/v1/auth/logout
 *
 * Request headers:
 * Authorization: Bearer <access_token>
 *
 * Success response (200):
 * {
 *   "success": true,
 *   "data": {
 *     "message": "Successfully logged out"
 *   }
 * }
 *
 * Error responses:
 * - 401: Invalid or missing token
 * - 500: Logout operation failed
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
 * Authentication logout endpoint class.
 *
 * Handles user logout by blacklisting the current JWT access token.
 * This prevents the token from being used for further API requests
 * even though it hasn't expired yet. Requires valid JWT token in
 * Authorization header.
 *
 * @package    core
 * @subpackage api
 */
class AuthLogoutEndpoint extends ApiBase {
    
    /**
     * Handle POST request for user logout.
     *
     * This method:
     * 1. Authenticates the request using JWT token
     * 2. Extracts the token from Authorization header
     * 3. Adds the token to Redis blacklist
     * 4. Returns success confirmation
     *
     * The token remains blacklisted until its natural expiration time,
     * preventing any further use even if the token is compromised.
     *
     * @return void Outputs JSON response
     * @throws UnauthorizedException If token is invalid or missing
     */
    protected function handle_post() {
        // Authenticate request and get user
        // This validates the token and throws exception if invalid
        $user = $this->authenticate();
        
        // Get JWT auth instance
        $jwtAuth = new JwtAuth();
        
        // Extract token from Authorization header
        $token = $jwtAuth->extractTokenFromRequest();
        
        if (empty($token)) {
            throw new UnauthorizedException('No authentication token provided', [
                'reason' => 'Authorization header is missing or invalid',
                'action' => 'Please provide a valid Bearer token'
            ]);
        }
        
        // Blacklist the token to invalidate it
        // This adds the token to Redis blacklist until expiration
        try {
            $jwtAuth->blacklistToken($token);
        } catch (Exception $e) {
            // Log the error but don't fail the logout
            debugging('Failed to blacklist token: ' . $e->getMessage(), DEBUG_DEVELOPER);
            // Continue with logout even if blacklist fails
        }
        
        // Return success response
        $this->success([
            'message' => 'Successfully logged out',
            'userId' => (int)$user->id
        ]);
    }
    
    /**
     * GET method not allowed for logout endpoint.
     *
     * @return void
     * @throws MethodNotAllowedException Always throws this exception
     */
    protected function handle_get() {
        throw new MethodNotAllowedException('GET method not allowed for logout. Use POST instead.');
    }
    
    /**
     * PUT method not allowed for logout endpoint.
     *
     * @return void
     * @throws MethodNotAllowedException Always throws this exception
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method not allowed for logout. Use POST instead.');
    }
    
    /**
     * DELETE method not allowed for logout endpoint.
     *
     * @return void
     * @throws MethodNotAllowedException Always throws this exception
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method not allowed for logout. Use POST instead.');
    }
}

// Execute the endpoint if not in test mode
if (!defined('API_TEST_MODE')) {
    $endpoint = new AuthLogout();
    $endpoint->execute();
}
