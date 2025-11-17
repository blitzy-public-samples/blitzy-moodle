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
 * REST API endpoint for retrieving current authenticated user information.
 *
 * This endpoint returns detailed information about the user associated with
 * the provided JWT access token. It's used by the React frontend to display
 * user profile information, check permissions, and maintain authentication
 * state across page reloads.
 *
 * Endpoint: GET /api/v1/auth/me
 *
 * Request headers:
 * Authorization: Bearer <access_token>
 *
 * Success response (200):
 * {
 *   "success": true,
 *   "data": {
 *     "id": 5,
 *     "username": "student1",
 *     "firstname": "John",
 *     "lastname": "Doe",
 *     "fullname": "John Doe",
 *     "email": "student1@example.com",
 *     "profileImageUrl": "https://...",
 *     "roles": [
 *       {
 *         "id": 5,
 *         "name": "Student",
 *         "shortname": "student"
 *       }
 *     ],
 *     "preferences": {
 *       "timezone": "Australia/Perth",
 *       "lang": "en"
 *     }
 *   }
 * }
 *
 * Error responses:
 * - 401: Invalid or missing token
 * - 404: User not found
 * - 500: Server error
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
 * Current user information endpoint class.
 *
 * Retrieves comprehensive information about the authenticated user from
 * the database using their JWT token. Uses existing Moodle functions to
 * fetch user details, roles, and preferences without duplicating logic.
 *
 * @package    core
 * @subpackage api
 */
class AuthMe extends ApiBase {
    
    /**
     * Handle GET request for current user information.
     *
     * This method:
     * 1. Authenticates the request using JWT token
     * 2. Fetches user details from database
     * 3. Retrieves user roles and capabilities
     * 4. Gets user preferences
     * 5. Generates profile image URL
     * 6. Returns comprehensive user data
     *
     * Uses existing Moodle functions: user_get_user_details(), get_user_roles(),
     * get_user_preferences(), and profile picture functions.
     *
     * @return void Outputs JSON response
     * @throws UnauthorizedException If token is invalid or missing
     * @throws NotFoundException If user is not found
     */
    protected function handle_get() {
        global $DB, $CFG, $PAGE, $OUTPUT;
        
        // Authenticate request and get user
        $user = $this->authenticate();
        
        if (!$user) {
            throw new NotFoundException('User not found', [
                'reason' => 'User associated with token does not exist',
                'action' => 'Please log in again'
            ]);
        }
        
        // Get comprehensive user details using existing Moodle function
        require_once($CFG->dirroot . '/user/lib.php');
        $userDetails = user_get_user_details($user, null);
        
        // Get user roles
        $roles = [];
        $userRoles = get_user_roles(context_system::instance(), $user->id, true);
        foreach ($userRoles as $role) {
            $roles[] = [
                'id' => (int)$role->roleid,
                'name' => $role->name,
                'shortname' => $role->shortname
            ];
        }
        
        // Get user preferences
        $preferences = [
            'timezone' => get_user_timezone($user->timezone),
            'lang' => $user->lang,
            'theme' => get_user_preferences('theme', null, $user->id),
            'mailformat' => $user->mailformat
        ];
        
        // Generate profile image URL
        $userpicture = new user_picture($user);
        $userpicture->size = 100; // Large size
        $profileImageUrl = $userpicture->get_url($PAGE)->out(false);
        
        // Prepare response data
        $responseData = [
            'id' => (int)$user->id,
            'username' => $user->username,
            'firstname' => $user->firstname,
            'lastname' => $user->lastname,
            'fullname' => fullname($user),
            'email' => $user->email,
            'profileImageUrl' => $profileImageUrl,
            'roles' => $roles,
            'preferences' => $preferences
        ];
        
        // Add additional fields if available from user_get_user_details
        if (isset($userDetails['city'])) {
            $responseData['city'] = $userDetails['city'];
        }
        if (isset($userDetails['country'])) {
            $responseData['country'] = $userDetails['country'];
        }
        if (isset($userDetails['description'])) {
            $responseData['description'] = $userDetails['description'];
        }
        
        // Return success response
        $this->success($responseData);
    }
    
    /**
     * POST method not allowed for me endpoint.
     *
     * @return void
     * @throws MethodNotAllowedException Always throws this exception
     */
    protected function handle_post() {
        throw new MethodNotAllowedException('POST method not allowed for /auth/me. Use GET instead.');
    }
    
    /**
     * PUT method not allowed for me endpoint.
     *
     * @return void
     * @throws MethodNotAllowedException Always throws this exception
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method not allowed for /auth/me. Use GET instead.');
    }
    
    /**
     * DELETE method not allowed for me endpoint.
     *
     * @return void
     * @throws MethodNotAllowedException Always throws this exception
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method not allowed for /auth/me. Use GET instead.');
    }
}

// Execute the endpoint if not in test mode
if (!defined('API_TEST_MODE')) {
    $endpoint = new AuthMe();
    $endpoint->execute();
}
