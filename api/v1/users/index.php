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
 * API endpoint for listing users with pagination and search capabilities.
 *
 * This endpoint provides a RESTful interface for retrieving a paginated list
 * of users accessible to the authenticated user based on their permissions.
 * It wraps the existing Moodle get_users() function and enforces capability
 * checks before returning user data.
 *
 * HTTP Method: GET
 * Route: /api/v1/users
 *
 * Query Parameters:
 * - page (int, optional): Page number for pagination (default: 0, min: 0)
 * - perpage (int, optional): Records per page (default: 20, min: 1, max: 100)
 * - search (string, optional): Search term for filtering by name or email
 * - courseid (int, optional): Filter users enrolled in a specific course
 *
 * Response Format:
 * {
 *   "success": true,
 *   "data": {
 *     "users": [
 *       {
 *         "id": 123,
 *         "username": "john.doe",
 *         "firstname": "John",
 *         "lastname": "Doe",
 *         "email": "john@example.com",
 *         "firstaccess": 1234567890,
 *         "lastaccess": 1234567890
 *       }
 *     ],
 *     "total": 150
 *   },
 *   "meta": {
 *     "pagination": {
 *       "page": 0,
 *       "perpage": 20,
 *       "total": 150,
 *       "totalPages": 8
 *     }
 *   }
 * }
 *
 * Error Responses:
 * - 400 Bad Request: Invalid query parameters (negative page, invalid perpage)
 * - 401 Unauthorized: Invalid or missing JWT token
 * - 403 Forbidden: User lacks required permissions
 * - 404 Not Found: Course not found (when courseid is provided)
 * - 500 Internal Server Error: Unexpected server-side error
 *
 * Permission Requirements:
 * - System context: moodle/user:viewalldetails capability
 * - Course context: moodle/user:viewdetails capability (when courseid provided)
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
 * Users Index API Endpoint.
 *
 * Handles GET requests to retrieve a paginated list of users with optional
 * search and course filtering. Extends ApiBase to inherit JWT authentication,
 * CORS handling, and standardized response formatting.
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class UsersIndexEndpoint extends ApiBase {
    
    /**
     * Handle GET request to retrieve user list.
     *
     * This method:
     * 1. Extracts and validates query parameters (page, perpage, search, courseid)
     * 2. Verifies user has appropriate permissions based on context
     * 3. Calls existing Moodle get_users() function for data retrieval
     * 4. Calculates pagination metadata (total count, total pages)
     * 5. Returns standardized JSON response with user list and pagination info
     *
     * All business logic is delegated to existing Moodle core functions.
     * No grade calculations, permission checks, or enrollment logic is duplicated.
     *
     * @return void Outputs JSON response and exits
     * @throws ValidationException If query parameters are invalid
     * @throws ForbiddenException If user lacks required permissions
     * @throws NotFoundException If courseid references non-existent course
     * @throws ServerException If unexpected error occurs
     */
    protected function handle_get() {
        global $DB, $CFG;
        
        try {
            // ============================================================
            // PHASE 1: PARAMETER EXTRACTION AND VALIDATION
            // ============================================================
            
            // Extract page parameter with validation
            $page = $this->getParam('page', PARAM_INT, 0);
            if ($page < 0) {
                throw new ValidationException(
                    'Invalid page parameter: must be non-negative',
                    ['field' => 'page', 'value' => $page, 'min' => 0]
                );
            }
            
            // Extract perpage parameter with validation
            $perpage = $this->getParam('perpage', PARAM_INT, 20);
            if ($perpage < 1) {
                throw new ValidationException(
                    'Invalid perpage parameter: must be at least 1',
                    ['field' => 'perpage', 'value' => $perpage, 'min' => 1]
                );
            }
            if ($perpage > 100) {
                throw new ValidationException(
                    'Invalid perpage parameter: maximum is 100',
                    ['field' => 'perpage', 'value' => $perpage, 'max' => 100]
                );
            }
            
            // Extract optional search parameter
            $search = $this->getParam('search', PARAM_TEXT, '');
            $search = trim($search);
            
            // Extract optional courseid parameter
            $courseid = $this->getParam('courseid', PARAM_INT, null);
            
            // ============================================================
            // PHASE 2: COURSE VALIDATION (if courseid provided)
            // ============================================================
            
            $context = null;
            $extraselect = '';
            $extraparams = [];
            
            if ($courseid !== null && $courseid > 0) {
                // Validate course exists using existing Moodle function
                $course = $DB->get_record('course', ['id' => $courseid], '*', IGNORE_MISSING);
                
                if (!$course) {
                    throw new NotFoundException(
                        'Course not found',
                        ['courseid' => $courseid]
                    );
                }
                
                // Get course context for permission check
                $context = context_course::instance($courseid);
                
                // Build SQL to filter users enrolled in this course
                // Using existing Moodle enrollment tables
                $extraselect = "id IN (
                    SELECT DISTINCT ue.userid 
                    FROM {user_enrolments} ue
                    JOIN {enrol} e ON e.id = ue.enrolid
                    WHERE e.courseid = :filtercourseid
                    AND ue.status = :uestatus
                )";
                $extraparams = [
                    'filtercourseid' => $courseid,
                    'uestatus' => ENROL_USER_ACTIVE
                ];
            } else {
                // System context for viewing all users
                $context = context_system::instance();
            }
            
            // ============================================================
            // PHASE 3: PERMISSION CHECKS
            // ============================================================
            
            // Determine required capability based on context
            if ($courseid !== null && $courseid > 0) {
                // Course context: check if user can view user details in course
                $this->checkCapability('moodle/user:viewdetails', $context);
            } else {
                // System context: check if user can view all user details
                $this->checkCapability('moodle/user:viewalldetails', $context);
            }
            
            // ============================================================
            // PHASE 4: DATA RETRIEVAL USING EXISTING MOODLE FUNCTION
            // ============================================================
            
            // Define fields to return (exclude sensitive data like password, secret)
            $fields = 'id, username, firstname, lastname, email, firstaccess, lastaccess, ' .
                      'auth, confirmed, lang, timezone, mailformat, maildisplay, ' .
                      'city, country, picture, imagealt, lastnamephonetic, ' .
                      'firstnamephonetic, middlename, alternatename';
            
            // Call existing Moodle core function get_users()
            // This function is in lib/datalib.php and handles all user retrieval logic
            $users = get_users(
                true,                           // $get - return records
                $search,                        // $search - search term
                true,                           // $confirmed - only confirmed users
                null,                           // $exceptions - no user exceptions
                'firstname ASC, lastname ASC',  // $sort - sort by name
                '',                             // $firstinitial - not used
                '',                             // $lastinitial - not used
                $page * $perpage,               // $page - convert to offset
                $perpage,                       // $recordsperpage
                $fields,                        // $fields - specific fields
                $extraselect,                   // $extraselect - course filter
                $extraparams                    // $extraparams - course params
            );
            
            // Convert object to array for consistent response format
            $usersArray = array_values($users);
            
            // ============================================================
            // PHASE 5: COUNT TOTAL USERS FOR PAGINATION
            // ============================================================
            
            // Build count query using same filters
            // Call get_users() with $get=false to get count
            $totalusers = get_users(
                false,                          // $get - return count instead
                $search,                        // $search - same search term
                true,                           // $confirmed - only confirmed users
                null,                           // $exceptions - no user exceptions
                'firstname ASC, lastname ASC',  // $sort - not used for count
                '',                             // $firstinitial - not used
                '',                             // $lastinitial - not used
                0,                              // $page - not used for count
                0,                              // $recordsperpage - not used for count
                'id',                           // $fields - minimal for count
                $extraselect,                   // $extraselect - course filter
                $extraparams                    // $extraparams - course params
            );
            
            // ============================================================
            // PHASE 6: CALCULATE PAGINATION METADATA
            // ============================================================
            
            $totalPages = ($perpage > 0) ? ceil($totalusers / $perpage) : 0;
            
            $paginationMeta = [
                'page' => $page,
                'perpage' => $perpage,
                'total' => $totalusers,
                'totalPages' => $totalPages
            ];
            
            // ============================================================
            // PHASE 7: FORMAT AND RETURN RESPONSE
            // ============================================================
            
            // Build response data structure
            $responseData = [
                'users' => $usersArray,
                'total' => $totalusers
            ];
            
            // Return standardized success response using ApiBase::success()
            // This method outputs JSON and exits
            $this->success($responseData, ['pagination' => $paginationMeta]);
            
        } catch (ValidationException $e) {
            // Handle validation errors (400 Bad Request)
            throw $e;
        } catch (ForbiddenException $e) {
            // Handle permission errors (403 Forbidden)
            throw $e;
        } catch (NotFoundException $e) {
            // Handle not found errors (404 Not Found)
            throw $e;
        } catch (Exception $e) {
            // Handle unexpected errors as server errors (500 Internal Server Error)
            throw new ServerException(
                'Failed to retrieve user list: ' . $e->getMessage(),
                [
                    'originalError' => $e->getMessage(),
                    'trace' => $e->getTraceAsString()
                ]
            );
        }
    }

    /**
     * Handle POST requests (not supported for this endpoint).
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown
     */
    protected function handle_post() {
        throw new MethodNotAllowedException('POST method not supported for users listing');
    }

    /**
     * Handle PUT requests (not supported for this endpoint).
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method not supported for users listing');
    }

    /**
     * Handle DELETE requests (not supported for this endpoint).
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method not supported for users listing');
    }
}

// ============================================================
// ENDPOINT INSTANTIATION AND EXECUTION
// ============================================================

// Instantiate and execute the endpoint (only if not in test mode)
if (!defined('API_TEST_MODE')) {
    // Create endpoint instance (ApiBase constructor handles JWT validation)
    $endpoint = new UsersIndexEndpoint();

    // Execute the request (routes to handle_get() for GET requests)
    $endpoint->execute();
}
