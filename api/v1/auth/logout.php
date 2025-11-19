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
 * REST API endpoint for user logout with JWT token invalidation and session cleanup.
 *
 * This endpoint provides comprehensive logout functionality that coordinates both
 * stateless JWT token invalidation and stateful Moodle session cleanup. It follows
 * the thin wrapper pattern by calling existing Moodle logout functions while adding
 * JWT token blacklisting for the React frontend.
 *
 * The logout process executes in this order:
 * 1. Validate JWT token from Authorization header
 * 2. Extract and blacklist the current access token in Redis
 * 3. Optionally blacklist refresh token if provided in request body
 * 4. Call authentication plugin logout hooks (logoutpage_hook)
 * 5. Call require_logout() for full Moodle session cleanup
 * 6. Return success confirmation
 *
 * This ensures both the stateless JWT authentication (for React) and stateful
 * Moodle session (for legacy PHP pages and plugins) are properly terminated.
 *
 * Endpoint: POST /api/v1/auth/logout
 *
 * Request headers:
 * Authorization: Bearer <access_token>
 *
 * Request body (optional):
 * {
 *   "refresh_token": "<refresh_token_string>"
 * }
 *
 * Success response (200):
 * {
 *   "success": true,
 *   "data": {
 *     "message": "Logged out successfully",
 *     "logout_time": 1234567890,
 *     "user_id": 123
 *   }
 * }
 *
 * Error responses:
 * - 401 Unauthorized: Invalid or missing JWT token
 * - 500 Internal Server Error: Logout operation failed
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Include API base class - this loads config.php and all core Moodle libraries
require_once(__DIR__ . '/../../lib/api_base.php');

/**
 * Authentication logout endpoint class.
 *
 * Extends ApiBase to handle user logout by:
 * - Blacklisting JWT tokens to prevent reuse
 * - Calling authentication plugin logout hooks
 * - Invoking require_logout() for Moodle session cleanup
 * - Supporting force logout across distributed systems
 *
 * Maintains 100% backward compatibility with existing Moodle authentication
 * system while adding JWT token invalidation for stateless authentication.
 *
 * @package    core
 * @subpackage api
 */
class AuthLogoutEndpoint extends ApiBase {
    
    /**
     * Handle POST request for user logout.
     *
     * This method implements the complete logout flow:
     *
     * 1. JWT Token Validation:
     *    - Validates JWT token via parent class authenticate() method
     *    - Throws UnauthorizedException if token is invalid/expired
     *
     * 2. Token Extraction and Blacklisting:
     *    - Extracts access token from Authorization header
     *    - Adds access token to Redis blacklist with TTL matching token expiration
     *    - Optionally reads and blacklists refresh token from request body
     *    - This prevents token reuse even before natural expiration
     *
     * 3. Authentication Plugin Hooks:
     *    - Retrieves all enabled auth plugins via get_enabled_auth_plugins()
     *    - Calls logoutpage_hook() on each plugin before session termination
     *    - Follows same pattern as public/login/logout.php for compatibility
     *
     * 4. Moodle Session Cleanup:
     *    - Calls require_logout() which handles:
     *      * prelogout_hook() on all auth plugins
     *      * Session termination via \core\session\manager::terminate_current()
     *      * Logout event triggering
     *      * postlogout_hook() on all auth plugins
     *
     * 5. Success Response:
     *    - Returns JSON confirmation with logout timestamp and user ID
     *
     * Error Handling:
     * - Token blacklist failures are logged but don't block logout (graceful degradation)
     * - Auth plugin hook failures are caught and logged
     * - require_logout() errors are propagated as ServerException
     *
     * @return void Outputs JSON response directly via ApiBase::success()
     * @throws UnauthorizedException If JWT token is invalid, expired, or missing
     * @throws ServerException If logout operation encounters critical errors
     */
    protected function handle_post() {
        global $USER;
        
        // Step 1: Authenticate request and validate JWT token
        // This calls ApiBase::authenticate() which validates the token and sets $this->user
        // Throws UnauthorizedException if token is invalid, expired, or blacklisted
        $user = $this->getUser();
        
        if (empty($user) || empty($user->id)) {
            throw new UnauthorizedException('Authentication required for logout', [
                'reason' => 'No authenticated user found',
                'action' => 'Please provide a valid JWT token in Authorization header'
            ]);
        }
        
        // Step 2: Extract and blacklist access token
        try {
            // Extract the raw token string from Authorization: Bearer <token> header
            $accessToken = $this->jwtAuth->extractTokenFromRequest();
            
            if (empty($accessToken)) {
                throw new UnauthorizedException('No authentication token provided', [
                    'reason' => 'Authorization header is missing or malformed',
                    'expected_format' => 'Authorization: Bearer <token>'
                ]);
            }
            
            // Add access token to Redis blacklist with TTL matching token expiration
            // This prevents the token from being used for any future API requests
            $this->jwtAuth->blacklistToken($accessToken);
            
            // Log successful token blacklisting for security audit
            debugging('Access token blacklisted for user ' . $user->id, DEBUG_DEVELOPER);
            
        } catch (Exception $e) {
            // Token blacklisting failure shouldn't block logout (graceful degradation)
            // User session will still be terminated, but token might remain valid until expiration
            debugging('Failed to blacklist access token: ' . $e->getMessage(), DEBUG_DEVELOPER);
            // Continue with logout process
        }
        
        // Step 3: Optionally blacklist refresh token if provided
        try {
            // Read JSON request body to check for optional refresh_token field
            $requestBody = $this->getJsonBody();
            
            if (!empty($requestBody['refresh_token'])) {
                $refreshToken = clean_param($requestBody['refresh_token'], PARAM_RAW);
                
                // Validate refresh token is not empty after cleaning
                if (!empty($refreshToken)) {
                    // Blacklist refresh token to invalidate the token pair
                    $this->jwtAuth->blacklistToken($refreshToken);
                    debugging('Refresh token blacklisted for user ' . $user->id, DEBUG_DEVELOPER);
                }
            }
        } catch (Exception $e) {
            // Refresh token blacklisting is optional, log but don't fail
            debugging('Failed to blacklist refresh token: ' . $e->getMessage(), DEBUG_DEVELOPER);
            // Continue with logout process
        }
        
        // Step 4: Call authentication plugin logout hooks
        // This follows the pattern from public/login/logout.php lines 56-60
        // Each auth plugin can perform cleanup before session termination
        try {
            // Get the list of enabled authentication plugins in configured sequence
            $authsequence = get_enabled_auth_plugins();
            
            // Iterate through each plugin and call its logoutpage_hook() method
            foreach ($authsequence as $authname) {
                // Get the auth plugin instance
                $authplugin = get_auth_plugin($authname);
                
                // Call the plugin's logout page hook for any pre-logout cleanup
                // This might include redirecting to SSO logout, clearing external sessions, etc.
                if (method_exists($authplugin, 'logoutpage_hook')) {
                    $authplugin->logoutpage_hook();
                }
            }
            
            debugging('Authentication plugin logout hooks executed for user ' . $user->id, DEBUG_DEVELOPER);
            
        } catch (Exception $e) {
            // Auth plugin hook failures are logged but don't block logout
            debugging('Error executing auth plugin logout hooks: ' . $e->getMessage(), DEBUG_DEVELOPER);
            // Continue with logout process
        }
        
        // Step 5: Call require_logout() for complete Moodle session cleanup
        // This is the existing Moodle core function that handles:
        // - Calling prelogout_hook() on all auth plugins
        // - Terminating the current session via \core\session\manager::terminate_current()
        // - Triggering the user_loggedout event
        // - Calling postlogout_hook() on all auth plugins for post-logout redirects
        try {
            // Store user ID before session termination for response
            $userId = (int)$user->id;
            
            // Call the existing Moodle logout function (thin wrapper pattern)
            // This function is defined in public/lib/moodlelib.php
            require_logout();
            
            debugging('Session cleanup completed for user ' . $userId, DEBUG_DEVELOPER);
            
            // Step 6: Return success response
            // Note: After require_logout(), $USER global is reset but we saved the ID
            $this->success([
                'message' => 'Logged out successfully',
                'logout_time' => time(),
                'user_id' => $userId
            ]);
            
        } catch (Exception $e) {
            // require_logout() errors are critical and should be reported
            debugging('Critical error during session cleanup: ' . $e->getMessage(), DEBUG_DEVELOPER);
            throw new ServerException('Logout operation failed', [
                'error' => $e->getMessage(),
                'action' => 'Please try again or contact support'
            ]);
        }
    }
    
    /**
     * GET method not allowed for logout endpoint.
     *
     * Logout is a state-changing operation and must use POST for security.
     * This prevents CSRF attacks and accidental logouts from simple link clicks.
     *
     * @return void
     * @throws MethodNotAllowedException Always throws this exception
     */
    protected function handle_get() {
        throw new MethodNotAllowedException('GET method not allowed for logout. Use POST instead.', [
            'allowed_methods' => ['POST'],
            'reason' => 'Logout is a state-changing operation requiring POST'
        ]);
    }
    
    /**
     * PUT method not allowed for logout endpoint.
     *
     * Logout is not an update operation, POST is the appropriate method.
     *
     * @return void
     * @throws MethodNotAllowedException Always throws this exception
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method not allowed for logout. Use POST instead.', [
            'allowed_methods' => ['POST']
        ]);
    }
    
    /**
     * DELETE method not allowed for logout endpoint.
     *
     * While logout conceptually deletes a session, POST is the standard HTTP
     * method for logout operations to maintain consistency with web standards.
     *
     * @return void
     * @throws MethodNotAllowedException Always throws this exception
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method not allowed for logout. Use POST instead.', [
            'allowed_methods' => ['POST']
        ]);
    }
}

// Execute the endpoint if not in test mode
// This allows unit tests to import and test the class without executing
if (!defined('API_TEST_MODE')) {
    $endpoint = new AuthLogoutEndpoint();
    $endpoint->execute();
}
