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
 * REST API endpoint for retrieving detailed user information by ID.
 *
 * GET /api/v1/users/{id}
 *
 * This endpoint provides comprehensive user profile data including:
 * - Basic user information (id, username, firstname, lastname, email)
 * - Full name and display preferences
 * - Profile picture URL
 * - Custom user profile fields
 * - User preferences and settings
 * - Last access time
 * - Additional role and context information
 *
 * The endpoint respects Moodle's privacy settings and field visibility
 * configurations, ensuring that only authorized users can view profile
 * information according to capability checks and privacy rules.
 *
 * Permission Requirements:
 * - User can always view their own profile
 * - To view other users: requires 'moodle/user:viewdetails' capability
 *   in the target user's context
 *
 * Request Parameters:
 * - id (required, integer): User ID to retrieve
 *
 * Response Format:
 * {
 *   "success": true,
 *   "data": {
 *     "user": {
 *       "id": 123,
 *       "username": "student1",
 *       "firstname": "John",
 *       "lastname": "Doe",
 *       "fullname": "John Doe",
 *       "email": "john.doe@example.com",
 *       "profileimageurl": "https://moodle.example.com/pluginfile.php/...",
 *       "profileimageurlsmall": "https://moodle.example.com/pluginfile.php/...",
 *       ... (additional fields based on permissions and privacy settings)
 *     }
 *   }
 * }
 *
 * Error Responses:
 * - 400 Bad Request: Invalid user ID parameter (non-integer, negative, or zero)
 * - 401 Unauthorized: Missing or invalid JWT authentication token
 * - 403 Forbidden: Insufficient permissions to view the requested user profile
 * - 404 Not Found: User does not exist or has been deleted
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Always load API base classes (needed for class definition)
require_once(__DIR__ . '/../../lib/api_base.php');
require_once(__DIR__ . '/../../lib/api_exception.php');

// Prevent direct execution during testing
if (!defined('API_TEST_MODE')) {
    // Load Moodle configuration
    require_once(__DIR__ . '/../../../public/config.php');
    require_login();
}

/**
 * User show endpoint - retrieve detailed user information by ID.
 *
 * Extends ApiBase to provide automatic JWT authentication, method routing,
 * parameter extraction, and standardized response formatting. Implements
 * the handle_get() method to process GET requests for user profile data.
 *
 * This endpoint is a thin wrapper around Moodle's existing user_get_user_details()
 * function, ensuring all business logic, permission checks, and privacy rules
 * remain in Moodle core without duplication.
 */
class UserShowEndpoint extends ApiBase {
    
    /**
     * Handle GET request to retrieve user details.
     *
     * Workflow:
     * 1. Extract and validate user ID from request parameters
     * 2. Verify user exists in database and is not deleted
     * 3. Get authenticated user from JWT token
     * 4. Check permissions (viewing own profile OR has viewdetails capability)
     * 5. Retrieve user details using existing Moodle function
     * 6. Enhance response with profile picture URLs
     * 7. Return standardized JSON response
     *
     * @return void Outputs JSON response directly via success() or throws exception
     * @throws ValidationException If user ID is invalid (non-integer, zero, negative)
     * @throws NotFoundException If user does not exist or has been deleted
     * @throws ForbiddenException If user lacks permission to view profile
     * @throws UnauthorizedException If JWT authentication fails (handled by ApiBase)
     */
    protected function handle_get() {
        global $DB, $PAGE;
        
        // Extract user ID from URL path parameter
        // Using PARAM_INT ensures type validation and sanitization
        $userid = $this->getParam('id', PARAM_INT);
        
        // Validate user ID: must be a positive integer
        if (empty($userid) || $userid < 1) {
            throw new ValidationException('Invalid user ID parameter', [
                'parameter' => 'id',
                'value' => $userid,
                'expected' => 'Positive integer greater than 0',
                'reason' => 'User ID must be a valid positive integer'
            ]);
        }
        
        // Retrieve the authenticated user from JWT token
        // This will throw UnauthorizedException if token is invalid (handled by ApiBase)
        $currentuser = $this->getUser();
        
        // Check if user exists in database
        // Use get_record instead of get_record_sql for better abstraction
        $user = $DB->get_record('user', ['id' => $userid], '*', IGNORE_MISSING);
        
        // Handle case where user doesn't exist
        if (!$user) {
            throw new NotFoundException('User not found', [
                'userId' => $userid,
                'reason' => 'No user exists with the specified ID'
            ]);
        }
        
        // Check if user is marked as deleted
        // Deleted users should be treated as not found for security
        if (!empty($user->deleted)) {
            throw new NotFoundException('User not found or has been deleted', [
                'userId' => $userid,
                'reason' => 'User account has been deleted and is no longer accessible'
            ]);
        }
        
        // Determine if current user is viewing their own profile
        // Users can always view their own profile without additional capability checks
        $viewingownprofile = ($currentuser->id == $userid);
        
        // Permission check: viewing own profile OR have viewdetails capability
        if (!$viewingownprofile) {
            // Create context for the target user
            $context = context_user::instance($userid);
            
            // Check if current user has capability to view other user details
            // This will throw ForbiddenException if the capability check fails
            $this->checkCapability('moodle/user:viewdetails', $context);
        }
        
        // Call existing Moodle function to retrieve comprehensive user details
        // This function handles:
        // - Privacy settings and field visibility rules
        // - Custom profile fields based on permissions
        // - Proper field filtering based on capabilities
        // - Callback checks for plugins to allow/prevent access
        // - All business logic for determining what fields to include
        //
        // We pass null for $course parameter (profile context, not course context)
        // and empty array for $userfields to get all default fields
        $userdetails = user_get_user_details($user, null, []);
        
        // Check if user_get_user_details returned null (access denied by callbacks)
        // This can happen even after capability checks if plugins deny access
        if ($userdetails === null) {
            throw new ForbiddenException('Access to user profile denied', [
                'userId' => $userid,
                'reason' => 'Access denied by profile visibility rules or plugin callbacks'
            ]);
        }
        
        // Generate profile picture URLs using Moodle's user_picture class
        // This ensures URLs are properly formatted and respect image settings
        $userpicture = new user_picture($user);
        $userpicture->size = 1; // Size f1 (100x100px)
        $profileimageurl = $userpicture->get_url($PAGE)->out(false);
        
        // Generate small profile picture URL
        $userpicturesmall = new user_picture($user);
        $userpicturesmall->size = 0; // Size f2 (35x35px) 
        $profileimageurlsmall = $userpicturesmall->get_url($PAGE)->out(false);
        
        // Add profile picture URLs to the response
        // These are not included by default in user_get_user_details
        $userdetails['profileimageurl'] = $profileimageurl;
        $userdetails['profileimageurlsmall'] = $profileimageurlsmall;
        
        // Return standardized success response with user data
        // The success() method automatically sets CORS headers and formats
        // the response in the standard envelope: {success: true, data: {...}}
        return $this->success([
            'user' => $userdetails
        ]);
    }
    /**
     * Handle POST requests (not supported for this endpoint).
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown
     */
    protected function handle_post() {
        throw new MethodNotAllowedException('POST method not supported for user details');
    }

    /**
     * Handle PUT requests (not supported for this endpoint).
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method not supported for user details');
    }

    /**
     * Handle DELETE requests (not supported for this endpoint).
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method not supported for user details');
    }
}

// Instantiate and execute the endpoint (only if not in test mode)
if (!defined('API_TEST_MODE')) {
    // The execute() method in ApiBase handles:
    // - JWT token validation (already done in constructor)
    // - HTTP method routing to handle_get()
    // - Exception catching and error response formatting
    // - CORS header management
    $endpoint = new UserShowEndpoint();
    $endpoint->execute();
}
