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
 * REST API endpoint for retrieving database activity instance details.
 *
 * Returns complete database activity configuration including name, description,
 * intro text, availability times (timeavailablefrom, timeavailableto, timeviewfrom,
 * timeviewto), entry requirements (requiredentries, requiredentriestoview, maxentries),
 * approval settings, default sort configuration, RSS settings, templates (listtemplate,
 * singletemplate, addtemplate, etc.), and access information (canaddentry,
 * canmanageentries, canapprove).
 *
 * HTTP Method: GET
 * Endpoint: /api/v1/data/{id}
 *
 * Authentication: JWT token required in Authorization header
 * Required capability: mod/data:viewentry
 *
 * Response format:
 * {
 *   "success": true,
 *   "data": {
 *     "id": 123,
 *     "course": 5,
 *     "name": "Student Database",
 *     "intro": "<p>Introduction text</p>",
 *     "introformat": 1,
 *     "comments": 0,
 *     "timeavailablefrom": 0,
 *     "timeavailableto": 0,
 *     "timeviewfrom": 0,
 *     "timeviewto": 0,
 *     "requiredentries": 0,
 *     "requiredentriestoview": 0,
 *     "maxentries": 0,
 *     "rssarticles": 0,
 *     "singletemplate": "",
 *     "listtemplate": "",
 *     "listtemplateheader": "",
 *     "listtemplatefooter": "",
 *     "addtemplate": "",
 *     "rsstemplate": "",
 *     "rsstitletemplate": "",
 *     "csstemplate": "",
 *     "jstemplate": "",
 *     "asearchtemplate": "",
 *     "approval": 0,
 *     "manageapproved": 1,
 *     "scale": 0,
 *     "assessed": 0,
 *     "assesstimestart": 0,
 *     "assesstimefinish": 0,
 *     "defaultsort": 0,
 *     "defaultsortdir": 0,
 *     "editany": 0,
 *     "notification": 0,
 *     "timemodified": 1234567890,
 *     "access": {
 *       "canaddentry": true,
 *       "canmanageentries": false,
 *       "canapprove": false,
 *       "timeavailable": true,
 *       "inreadonlyperiod": false,
 *       "numentries": 5,
 *       "entrieslefttoadd": 0,
 *       "entrieslefttoview": 0
 *     }
 *   }
 * }
 *
 * Error responses:
 * - 400: Invalid database ID parameter
 * - 401: Unauthorized (no JWT token or invalid token)
 * - 403: Forbidden (user lacks mod/data:viewentry capability)
 * - 404: Database activity not found
 * - 500: Internal server error
 *
 * @package    api
 * @subpackage data
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Load API base class and exceptions
require_once(__DIR__ . '/../../lib/api_base.php');
require_once(__DIR__ . '/../../lib/api_exception.php');

// Load Moodle configuration and required libraries
require_once(__DIR__ . '/../../../config.php');
require_once($CFG->dirroot . '/mod/data/lib.php');
require_once($CFG->dirroot . '/mod/data/locallib.php');

// Import database activity manager class
use mod_data\manager;

/**
 * Database activity detail endpoint handler.
 *
 * Handles GET requests to retrieve full details of a database activity instance
 * including configuration, templates, and user access information.
 *
 * @package    api
 * @subpackage data
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class DataShowEndpoint extends ApiBase {
    
    /**
     * Handle GET request to retrieve database activity details.
     *
     * Workflow:
     * 1. Extract and validate database ID from request URI
     * 2. Retrieve database record from database
     * 3. Get associated course and course module
     * 4. Create context and validate user login
     * 5. Check mod/data:viewentry capability
     * 6. Create manager instance for database activity
     * 7. Get access information (permissions, entry counts, availability)
     * 8. Return formatted response with database details and access info
     *
     * @return void Outputs JSON response directly via parent::success()
     * @throws ValidationException If database ID is invalid
     * @throws NotFoundException If database activity is not found
     * @throws ForbiddenException If user lacks required capability or time restrictions apply
     */
    protected function handle_get() {
        global $DB, $USER;
        
        // Extract database ID from request URI
        // Expected pattern: /api/v1/data/{id}
        $dataid = $this->extractIdFromUri();
        
        // Validate that ID is numeric
        if (!is_numeric($dataid) || $dataid <= 0) {
            throw new ValidationException('Invalid database ID', [
                'parameter' => 'id',
                'value' => $dataid,
                'expected' => 'Positive integer'
            ]);
        }
        
        // Cast to integer for safety
        $dataid = (int)$dataid;
        
        // Get database activity record from database
        // MUST_EXIST will throw exception if not found
        try {
            $database = $DB->get_record('data', ['id' => $dataid], '*', MUST_EXIST);
        } catch (dml_exception $e) {
            throw new NotFoundException('Database activity not found', [
                'databaseId' => $dataid,
                'reason' => 'No database activity exists with this ID'
            ]);
        }
        
        // Get course and course module from database instance
        // This function validates that the module exists
        try {
            list($course, $cm) = get_course_and_cm_from_instance($dataid, 'data');
        } catch (moodle_exception $e) {
            throw new NotFoundException('Course module not found for database activity', [
                'databaseId' => $dataid,
                'error' => $e->getMessage()
            ]);
        }
        
        // Create module context for permission checking
        $context = context_module::instance($cm->id);
        
        // Validate user login and course access
        // This ensures user is properly authenticated and enrolled/has access to course
        try {
            require_login($course, false, $cm);
        } catch (moodle_exception $e) {
            throw new ForbiddenException('Access denied to database activity', [
                'reason' => 'User must be logged in and have access to the course',
                'error' => $e->getMessage()
            ]);
        }
        
        // Check that user has permission to view entries in this database
        $this->checkCapability('mod/data:viewentry', $context);
        
        // Create manager instance from database instance
        // Manager provides convenient access to database configuration and methods
        $manager = manager::create_from_instance($database);
        
        // Get the database instance from manager (includes all fields)
        $data = $manager->get_instance();
        
        // Calculate access information for current user
        $access = $this->calculateAccessInfo($data, $context, $USER->id);
        
        // Prepare response data structure
        $responseData = new stdClass();
        
        // Core database fields
        $responseData->id = (int)$data->id;
        $responseData->course = (int)$data->course;
        $responseData->name = $data->name;
        $responseData->intro = $data->intro;
        $responseData->introformat = (int)$data->introformat;
        
        // Time availability settings
        $responseData->timeavailablefrom = (int)$data->timeavailablefrom;
        $responseData->timeavailableto = (int)$data->timeavailableto;
        $responseData->timeviewfrom = (int)$data->timeviewfrom;
        $responseData->timeviewto = (int)$data->timeviewto;
        
        // Entry requirements and limits
        $responseData->requiredentries = (int)$data->requiredentries;
        $responseData->requiredentriestoview = (int)$data->requiredentriestoview;
        $responseData->maxentries = (int)$data->maxentries;
        
        // Comments and social features
        $responseData->comments = (int)$data->comments;
        
        // RSS settings
        $responseData->rssarticles = (int)$data->rssarticles;
        
        // Template configurations
        $responseData->singletemplate = $data->singletemplate ?? '';
        $responseData->listtemplate = $data->listtemplate ?? '';
        $responseData->listtemplateheader = $data->listtemplateheader ?? '';
        $responseData->listtemplatefooter = $data->listtemplatefooter ?? '';
        $responseData->addtemplate = $data->addtemplate ?? '';
        $responseData->rsstemplate = $data->rsstemplate ?? '';
        $responseData->rsstitletemplate = $data->rsstitletemplate ?? '';
        $responseData->csstemplate = $data->csstemplate ?? '';
        $responseData->jstemplate = $data->jstemplate ?? '';
        $responseData->asearchtemplate = $data->asearchtemplate ?? '';
        
        // Approval settings
        $responseData->approval = (int)$data->approval;
        $responseData->manageapproved = isset($data->manageapproved) ? (int)$data->manageapproved : 1;
        
        // Grading settings
        $responseData->scale = (int)$data->scale;
        $responseData->assessed = (int)$data->assessed;
        $responseData->assesstimestart = isset($data->assesstimestart) ? (int)$data->assesstimestart : 0;
        $responseData->assesstimefinish = isset($data->assesstimefinish) ? (int)$data->assesstimefinish : 0;
        
        // Sorting settings
        $responseData->defaultsort = (int)$data->defaultsort;
        $responseData->defaultsortdir = (int)$data->defaultsortdir;
        
        // Other settings
        $responseData->editany = isset($data->editany) ? (int)$data->editany : 0;
        $responseData->notification = isset($data->notification) ? (int)$data->notification : 0;
        
        // Timestamps
        $responseData->timemodified = (int)$data->timemodified;
        
        // Add access information
        $responseData->access = $access;
        
        // Return successful response with database details
        $this->success($responseData);
    }
    
    /**
     * Extract database ID from request URI path.
     *
     * Parses the request URI to extract the database ID from the path.
     * Expected URI format: /api/v1/data/{id} or /api/v1/data/{id}/
     *
     * @return mixed Database ID extracted from URI (may be string or int)
     * @throws ValidationException If ID cannot be extracted from URI
     */
    private function extractIdFromUri() {
        // Parse the request URI
        $path = parse_url($this->requestUri, PHP_URL_PATH);
        
        // Remove trailing slash if present
        $path = rtrim($path, '/');
        
        // Split path into segments
        $segments = explode('/', $path);
        
        // Expected path format: ['', 'api', 'v1', 'data', '{id}']
        // The ID should be the last segment
        if (count($segments) < 5) {
            throw new ValidationException('Invalid URI format', [
                'uri' => $this->requestUri,
                'expected' => '/api/v1/data/{id}'
            ]);
        }
        
        // Get the last segment as the ID
        $dataid = end($segments);
        
        if (empty($dataid)) {
            throw new ValidationException('Database ID is required in URI', [
                'uri' => $this->requestUri,
                'expected' => '/api/v1/data/{id}'
            ]);
        }
        
        return $dataid;
    }
    
    /**
     * Calculate access information for current user.
     *
     * Determines what actions the user can perform on this database activity,
     * including adding entries, managing entries, approving entries, and viewing
     * existing entries. Also calculates entry counts and availability status.
     *
     * @param stdClass $data    Database activity instance record
     * @param context  $context Module context for capability checking
     * @param int      $userid  User ID to check permissions for
     * @return stdClass Object containing access information
     */
    private function calculateAccessInfo($data, $context, $userid) {
        global $DB;
        
        $access = new stdClass();
        
        // Check if user can add new entries
        // Requires mod/data:writeentry capability and respects maxentries limit
        $access->canaddentry = data_user_can_add_entry($data, 0, 0, $context);
        
        // Check if user can manage all entries (edit/delete any entry)
        $access->canmanageentries = has_capability('mod/data:manageentries', $context);
        
        // Check if user can approve entries
        $access->canapprove = has_capability('mod/data:approve', $context);
        
        // Check time availability status
        // Returns array with 'available' boolean and 'warnings' array
        $timeavailability = data_get_time_availability_status($data, 0);
        $access->timeavailable = $timeavailability['available'];
        
        // Check if database is in read-only period
        // Returns true if current time is between timeviewfrom and timeavailablefrom
        $access->inreadonlyperiod = data_in_readonly_period($data);
        
        // Get total number of entries in this database
        $access->numentries = data_numentries($data);
        
        // Calculate entries left to add for this user (if maxentries is set)
        $entrieslefttoadd = data_get_entries_left_to_add($data, $access->numentries, $access->canmanageentries);
        $access->entrieslefttoadd = $entrieslefttoadd === null ? 0 : (int)$entrieslefttoadd;
        
        // Calculate entries left to view before user can add (if requiredentriestoview is set)
        $entrieslefttoview = data_get_entries_left_to_view($data, $access->numentries, $access->canmanageentries);
        $access->entrieslefttoview = $entrieslefttoview === null ? 0 : (int)$entrieslefttoview;
        
        return $access;
    }
    
    /**
     * Unsupported: POST method not allowed for this endpoint.
     *
     * @throws MethodNotAllowedException Always thrown as POST is not supported
     */
    protected function handle_post() {
        throw new MethodNotAllowedException('POST method is not supported for this endpoint', [
            'endpoint' => '/api/v1/data/{id}',
            'allowedMethods' => ['GET']
        ]);
    }
    
    /**
     * Unsupported: PUT method not allowed for this endpoint.
     *
     * @throws MethodNotAllowedException Always thrown as PUT is not supported
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method is not supported for this endpoint', [
            'endpoint' => '/api/v1/data/{id}',
            'allowedMethods' => ['GET']
        ]);
    }
    
    /**
     * Unsupported: DELETE method not allowed for this endpoint.
     *
     * @throws MethodNotAllowedException Always thrown as DELETE is not supported
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method is not supported for this endpoint', [
            'endpoint' => '/api/v1/data/{id}',
            'allowedMethods' => ['GET']
        ]);
    }
}

// Instantiate and execute the endpoint
$endpoint = new DataShowEndpoint();
$endpoint->execute();
