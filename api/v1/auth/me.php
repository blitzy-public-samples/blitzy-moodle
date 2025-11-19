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
class AuthMeEndpoint extends ApiBase {
    
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
        
        try {
            // Get authenticated user from validated JWT token
            // Authentication is already handled by ApiBase constructor
            $user = $this->getUser();
            
            if (!$user || !$user->id) {
                throw new NotFoundException('User not found', [
                    'reason' => 'User associated with token does not exist',
                    'action' => 'Please log in again'
                ]);
            }
            
            // Reload complete user record from database to ensure fresh data
            // Using recommended Moodle database access pattern
            $userRecord = $DB->get_record('user', ['id' => $user->id], '*', MUST_EXIST);
            
            // Filter out sensitive fields from user record
            unset($userRecord->password);
            unset($userRecord->secret);
            unset($userRecord->mnetkey);
            unset($userRecord->sesskey);
        
            // Get user roles using existing Moodle function
            // This returns roles in system context (site-wide roles)
            $roles = [];
            $userRoles = get_user_roles(context_system::instance(), $userRecord->id, true);
            foreach ($userRoles as $role) {
                $roles[] = [
                    'id' => (int)$role->roleid,
                    'name' => $role->name,
                    'shortname' => $role->shortname,
                    'archetype' => isset($role->archetype) ? $role->archetype : null
                ];
            }
            
            // Get user preferences using existing Moodle functions
            // These are commonly needed preferences for frontend personalization
            $preferences = [
                'timezone' => get_user_timezone($userRecord->timezone),
                'lang' => $userRecord->lang,
                'theme' => get_user_preferences('theme', null, $userRecord->id),
                'mailformat' => (int)$userRecord->mailformat,
                'maildisplay' => (int)$userRecord->maildisplay,
                'maildigest' => (int)$userRecord->maildigest,
                'autosubscribe' => (int)$userRecord->autosubscribe
            ];
            
            // Generate profile image URL using existing Moodle user_picture class
            // This ensures consistent image URLs with proper caching and fallbacks
            $userpicture = new user_picture($userRecord);
            $userpicture->size = 100; // Large size for profile display
            $profileImageUrl = $userpicture->get_url($PAGE)->out(false);
            
            // Prepare comprehensive response data
            // All data comes from existing Moodle user record and helper functions
            $responseData = [
                'id' => (int)$userRecord->id,
                'username' => $userRecord->username,
                'firstname' => $userRecord->firstname,
                'lastname' => $userRecord->lastname,
                'fullname' => fullname($userRecord),
                'email' => $userRecord->email,
                'emailstop' => (int)$userRecord->emailstop,
                'profileImageUrl' => $profileImageUrl,
                'roles' => $roles,
                'preferences' => $preferences,
                'firstaccess' => (int)$userRecord->firstaccess,
                'lastaccess' => (int)$userRecord->lastaccess,
                'lastlogin' => (int)$userRecord->lastlogin,
                'currentlogin' => (int)$userRecord->currentlogin,
                'suspended' => (int)$userRecord->suspended,
                'confirmed' => (int)$userRecord->confirmed
            ];
            
            // Add optional profile fields if present
            if (!empty($userRecord->city)) {
                $responseData['city'] = $userRecord->city;
            }
            if (!empty($userRecord->country)) {
                $responseData['country'] = $userRecord->country;
            }
            if (!empty($userRecord->description)) {
                $responseData['description'] = $userRecord->description;
            }
            if (!empty($userRecord->descriptionformat)) {
                $responseData['descriptionformat'] = (int)$userRecord->descriptionformat;
            }
            if (!empty($userRecord->url)) {
                $responseData['url'] = $userRecord->url;
            }
            if (!empty($userRecord->institution)) {
                $responseData['institution'] = $userRecord->institution;
            }
            if (!empty($userRecord->department)) {
                $responseData['department'] = $userRecord->department;
            }
            if (!empty($userRecord->phone1)) {
                $responseData['phone1'] = $userRecord->phone1;
            }
            if (!empty($userRecord->phone2)) {
                $responseData['phone2'] = $userRecord->phone2;
            }
            
            // Return success response using parent class method
            // This formats the response with standard JSON envelope structure
            return $this->success($responseData);
            
        } catch (dml_missing_record_exception $e) {
            // User record not found in database
            throw new NotFoundException('User not found', [
                'reason' => 'User record does not exist in database',
                'userid' => $user->id ?? null
            ]);
        } catch (Exception $e) {
            // Catch any unexpected errors during user data retrieval
            throw new ServerException('Failed to retrieve user profile', [
                'error' => $e->getMessage(),
                'trace' => $CFG->debugdisplay ? $e->getTraceAsString() : null
            ]);
        }
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
    $endpoint = new AuthMeEndpoint();
    $endpoint->execute();
}
