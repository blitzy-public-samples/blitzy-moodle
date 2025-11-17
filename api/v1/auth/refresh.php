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
 * REST API endpoint for refreshing expired JWT access tokens.
 *
 * This endpoint allows clients to obtain a new access token using a valid
 * refresh token without requiring the user to re-authenticate. This enables
 * seamless user experience when access tokens expire (after 1 hour) while
 * maintaining security through short-lived access tokens.
 *
 * Endpoint: POST /api/v1/auth/refresh
 *
 * Request body (JSON):
 * {
 *   "refreshToken": "eyJ0eXAiOiJKV1..."
 * }
 *
 * Success response (200):
 * {
 *   "success": true,
 *   "data": {
 *     "accessToken": "eyJ0eXAiOiJKV1...",
 *     "expiresIn": 3600,
 *     "tokenType": "Bearer"
 *   }
 * }
 *
 * Error responses:
 * - 400: Missing refresh token
 * - 401: Invalid or expired refresh token
 * - 500: Token generation failed
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
 * Authentication token refresh endpoint class.
 *
 * Handles refresh token validation and generation of new access tokens.
 * This allows the React frontend to maintain authentication without
 * requiring users to re-login every time their access token expires.
 *
 * @package    core
 * @subpackage api
 */
class AuthRefresh extends ApiBase {
    
    /**
     * Handle POST request for token refresh.
     *
     * This method:
     * 1. Extracts refresh token from request body
     * 2. Validates the refresh token
     * 3. Verifies token type is 'refresh' not 'access'
     * 4. Generates a new access token
     * 5. Returns the new access token
     *
     * The refresh token itself is not renewed and continues to be valid
     * until its expiration (7 days). This follows OAuth 2.0 patterns.
     *
     * @return void Outputs JSON response
     * @throws BadRequestException If refresh token is missing
     * @throws UnauthorizedException If refresh token is invalid or expired
     */
    protected function handle_post() {
        global $DB;
        
        // Get JSON request body
        $data = $this->getJsonBody();
        
        // Validate refresh token is provided
        if (empty($data['refreshToken'])) {
            throw new BadRequestException('Missing required field: refreshToken', [
                'field' => 'refreshToken',
                'message' => 'Refresh token is required to obtain a new access token'
            ]);
        }
        
        $refreshToken = $data['refreshToken'];
        
        // Get JWT auth instance
        $jwtAuth = new JwtAuth();
        
        // Validate the refresh token
        try {
            $payload = $jwtAuth->validateToken($refreshToken);
        } catch (Exception $e) {
            throw new UnauthorizedException('Invalid or expired refresh token', [
                'originalError' => $e->getMessage(),
                'action' => 'Please log in again to obtain new tokens'
            ]);
        }
        
        // Verify token type is 'refresh'
        if (!isset($payload->type) || $payload->type !== 'refresh') {
            throw new UnauthorizedException('Invalid token type', [
                'reason' => 'Expected refresh token, received ' . ($payload->type ?? 'unknown'),
                'action' => 'Please provide a valid refresh token'
            ]);
        }
        
        // Extract user ID from token payload
        $userid = $payload->sub;
        
        // Verify user still exists and is not suspended/deleted
        $user = $DB->get_record('user', ['id' => $userid], '*', MUST_EXIST);
        
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
        
        // Generate new access token
        $newAccessToken = $jwtAuth->generateAccessToken($userid);
        
        // Return success response with new access token
        $this->success([
            'accessToken' => $newAccessToken,
            'expiresIn' => JwtAuth::ACCESS_TOKEN_EXPIRY,
            'tokenType' => 'Bearer'
        ]);
    }
    
    /**
     * GET method not allowed for refresh endpoint.
     *
     * @return void
     * @throws MethodNotAllowedException Always throws this exception
     */
    protected function handle_get() {
        throw new MethodNotAllowedException('GET method not allowed for refresh. Use POST instead.');
    }
    
    /**
     * PUT method not allowed for refresh endpoint.
     *
     * @return void
     * @throws MethodNotAllowedException Always throws this exception
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method not allowed for refresh. Use POST instead.');
    }
    
    /**
     * DELETE method not allowed for refresh endpoint.
     *
     * @return void
     * @throws MethodNotAllowedException Always throws this exception
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method not allowed for refresh. Use POST instead.');
    }
}

// Execute the endpoint if not in test mode
if (!defined('API_TEST_MODE')) {
    $endpoint = new AuthRefresh();
    $endpoint->execute();
}
