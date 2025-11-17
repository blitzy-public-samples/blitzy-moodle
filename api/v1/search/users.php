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
 * REST API endpoint for user search.
 *
 * Provides functionality to search for users by full name, email, username, or other
 * identity fields. Wraps Moodle's core_user::search() function to return JSON-formatted
 * results suitable for React frontend search features. Supports filtering by course
 * context to search within specific course participants.
 *
 * Endpoint: GET /api/v1/search/users
 *
 * Query parameters:
 * - q or query (string, required): Search query string (minimum 2 characters)
 * - courseid (int, optional): Course context filter (default: 0 for global search)
 * - page (int, optional): Page number for pagination (default: 0)
 * - perpage (int, optional): Results per page (default: 20, max: 100)
 *
 * Returns JSON response with:
 * - users: Array of user objects with id, fullname, profileimageurlsmall, email, username
 * - total: Total number of matching users
 * - page: Current page number
 * - perpage: Results per page
 * - totalpages: Total number of pages
 * - query: Echoed search string
 * - courseid: Course context filter if applied
 *
 * Security:
 * - Requires JWT authentication (no public access)
 * - Respects $CFG->forceloginforprofiles setting
 * - Enforces moodle/course:viewparticipants capability for course-specific search
 * - Respects user profile visibility settings and privacy controls
 * - Email and username only visible if user has moodle/user:viewdetails capability
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Load API base class and utilities
require_once(__DIR__ . '/../../lib/api_base.php');
require_once(__DIR__ . '/../../lib/api_exception.php');

/**
 * User search endpoint implementation.
 *
 * Extends ApiBase to provide JWT-authenticated user search functionality with
 * pagination, course context filtering, and privacy-aware result formatting.
 */
class UserSearchEndpoint extends ApiBase {
    
    /**
     * Handle GET request for user search.
     *
     * Processes search query with optional course context filter, enforces
     * permission checks, and returns paginated results with user profile data.
     *
     * @return void Outputs JSON response via success() method
     * @throws UnauthorizedException If user is not authenticated
     * @throws ForbiddenException If user lacks required capability
     * @throws ValidationException If query parameters are invalid
     */
    protected function handle_get() {
        global $CFG, $PAGE, $DB;
        
        // Ensure user is authenticated - required for user search
        $user = $this->getUser();
        
        // Extract and validate search query parameter
        // Accept both 'q' and 'query' for flexibility
        $query = $this->getParam('q', PARAM_RAW, false, null);
        if ($query === null) {
            $query = $this->getParam('query', PARAM_RAW, false, null);
        }
        
        // Validate query is provided
        if ($query === null) {
            throw new ValidationException('Search query is required', [
                'parameter' => 'q or query',
                'reason' => 'At least one of these parameters must be provided'
            ]);
        }
        
        // Sanitize query string to prevent XSS and SQL injection
        // Remove HTML tags and trim whitespace
        $cleanQuery = trim(strip_tags($query));
        
        // Validate minimum query length to prevent performance issues
        if (strlen($cleanQuery) < 2) {
            throw new ValidationException('Query must be at least 2 characters', [
                'parameter' => 'query',
                'value' => $query,
                'sanitizedValue' => $cleanQuery,
                'minLength' => 2,
                'reason' => 'Short queries return too many results and impact performance'
            ]);
        }
        
        // Extract pagination parameters
        $courseid = $this->getParam('courseid', PARAM_INT, false, 0);
        $page = $this->getParam('page', PARAM_INT, false, 0);
        $perpage = $this->getParam('perpage', PARAM_INT, false, 20);
        
        // Validate pagination parameters
        if ($page < 0) {
            throw new ValidationException('Page number must be non-negative', [
                'parameter' => 'page',
                'value' => $page,
                'minValue' => 0
            ]);
        }
        
        if ($perpage < 1) {
            throw new ValidationException('Results per page must be at least 1', [
                'parameter' => 'perpage',
                'value' => $perpage,
                'minValue' => 1
            ]);
        }
        
        // Enforce maximum perpage to prevent excessive results
        if ($perpage > 100) {
            throw new ValidationException('Results per page cannot exceed 100', [
                'parameter' => 'perpage',
                'value' => $perpage,
                'maxValue' => 100,
                'reason' => 'Large result sets impact performance and user experience'
            ]);
        }
        
        // Determine search context based on courseid parameter
        $coursecontext = null;
        
        if ($courseid > 0) {
            // Validate course exists
            $course = $DB->get_record('course', ['id' => $courseid], '*', IGNORE_MISSING);
            
            if (!$course) {
                throw new ValidationException('Invalid course ID', [
                    'parameter' => 'courseid',
                    'value' => $courseid,
                    'reason' => 'Course does not exist'
                ]);
            }
            
            // Get course context for permission checking
            $coursecontext = context_course::instance($courseid);
            
            // Check user has permission to view participants in this course
            // This enforces the same security as the web interface
            $this->checkCapability('moodle/course:viewparticipants', $coursecontext);
        } else {
            // Global search uses system context
            $systemcontext = context_system::instance();
        }
        
        // Check forceloginforprofiles configuration setting
        // If enabled, guest users and non-logged-in users cannot search
        if (!empty($CFG->forceloginforprofiles)) {
            if (isguestuser($user->id)) {
                // Guest users cannot search when forceloginforprofiles is enabled
                // Return empty results following Moodle core pattern
                $this->success([
                    'users' => [],
                    'total' => 0,
                    'page' => $page,
                    'perpage' => $perpage,
                    'totalpages' => 0,
                    'query' => $cleanQuery,
                    'courseid' => $courseid
                ]);
                return;
            }
        }
        
        // Call Moodle core user search function
        // This function handles all privacy settings and visibility rules automatically
        $users = \core_user::search($cleanQuery, $coursecontext);
        
        // Get total count before pagination
        $totalUsers = count($users);
        
        // Calculate total pages
        $totalpages = ($totalUsers > 0) ? (int)ceil($totalUsers / $perpage) : 0;
        
        // Apply pagination using array_slice
        $startIndex = $page * $perpage;
        $paginatedUsers = array_slice($users, $startIndex, $perpage);
        
        // Format user data for response
        $result = [];
        
        // Check if current user can view detailed user information
        // This capability controls visibility of email and username fields
        $systemcontext = context_system::instance();
        $canViewDetails = has_capability('moodle/user:viewdetails', $systemcontext, $user->id);
        
        foreach ($paginatedUsers as $searchUser) {
            // Use core_user\external\user_summary_exporter for standardized output
            // This exporter respects privacy settings and provides consistent data structure
            $exporter = new \core_user\external\user_summary_exporter($searchUser);
            $fulldetails = $exporter->export($PAGE->get_renderer('core'));
            
            // Build result object with basic user information
            $userResult = [
                'id' => $fulldetails->id,
                'fullname' => $fulldetails->fullname,
                'profileimageurlsmall' => $fulldetails->profileimageurlsmall
            ];
            
            // Include email and username only if user has permission
            // This prevents leaking private data to unauthorized users
            if ($canViewDetails) {
                // Email may not always be available depending on privacy settings
                if (isset($fulldetails->email)) {
                    $userResult['email'] = $fulldetails->email;
                }
                
                // Username should always be available for detailed view
                if (isset($fulldetails->username)) {
                    $userResult['username'] = $fulldetails->username;
                }
            }
            
            $result[] = $userResult;
        }
        
        // Return successful response with results and pagination metadata
        $this->success([
            'users' => $result,
            'total' => $totalUsers,
            'page' => $page,
            'perpage' => $perpage,
            'totalpages' => $totalpages,
            'query' => $cleanQuery,
            'courseid' => $courseid
        ]);
    }
    
    /**
     * Handle POST requests - not supported for user search.
     *
     * @throws MethodNotAllowedException Always throws exception
     */
    protected function handle_post() {
        throw new MethodNotAllowedException('POST method not supported for user search', [
            'allowedMethods' => ['GET', 'OPTIONS']
        ]);
    }
    
    /**
     * Handle PUT requests - not supported for user search.
     *
     * @throws MethodNotAllowedException Always throws exception
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method not supported for user search', [
            'allowedMethods' => ['GET', 'OPTIONS']
        ]);
    }
    
    /**
     * Handle DELETE requests - not supported for user search.
     *
     * @throws MethodNotAllowedException Always throws exception
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method not supported for user search', [
            'allowedMethods' => ['GET', 'OPTIONS']
        ]);
    }
}

// Instantiate and execute the endpoint with error handling
// Skip automatic execution in test mode to allow manual instantiation
if (!defined('API_TEST_MODE') || !API_TEST_MODE) {
    // Wrap in try-catch to handle exceptions thrown during instantiation (e.g., auth failures)
    try {
        $endpoint = new UserSearchEndpoint();
        $endpoint->execute();
    } catch (ApiException $e) {
        // Handle API exceptions with formatted error response
        ApiResponse::fromException($e);
    } catch (moodle_exception $e) {
        // Handle Moodle exceptions
        $apiException = new ForbiddenException($e->getMessage(), [
            'errorcode' => $e->errorcode,
            'module' => $e->module ?? 'moodle'
        ]);
        ApiResponse::fromException($apiException);
    } catch (Exception $e) {
        // Handle unexpected exceptions
        $apiException = new ServerException('Internal server error', [
            'message' => $e->getMessage(),
            'file' => $e->getFile(),
            'line' => $e->getLine()
        ]);
        ApiResponse::fromException($apiException);
    }
}
