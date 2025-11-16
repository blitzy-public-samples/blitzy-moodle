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
 * REST API endpoint for creating database activity records.
 *
 * Handles POST /api/v1/data/{id}/records requests to create new records in database
 * activities. Supports all custom field types including text, textarea, number, date,
 * menu, checkbox, radio, file, picture, url, and latlong fields. Validates field data,
 * enforces permission checks, time restrictions, group mode, and entry limits.
 *
 * Request body format:
 * {
 *   "groupid": 123,  // Optional, auto-determined if not provided
 *   "data": [
 *     {
 *       "fieldid": 1,
 *       "subfield": "",     // Empty for most fields, "_0", "_1" for checkboxes/multi-select
 *       "value": "..."      // JSON-encoded value (string, number, array, etc.)
 *     }
 *   ]
 * }
 *
 * Response format:
 * {
 *   "success": true,
 *   "data": {
 *     "newentryid": 456,  // Record ID if created, 0 if validation failed
 *     "generalnotifications": ["message1", "message2"],
 *     "fieldnotifications": [
 *       {"fieldname": "field_1", "notification": "Required field"}
 *     ]
 *   }
 * }
 *
 * @package    api
 * @subpackage v1
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Include Moodle configuration and required libraries
// In test environment, these are already loaded by PHPUnit bootstrap or test script
if (!defined('PHPUNIT_TEST') && !defined('API_TEST_MODE')) {
    require_once(__DIR__ . '/../../../config.php');
    require_once($CFG->dirroot . '/mod/data/lib.php');
    require_once($CFG->dirroot . '/mod/data/locallib.php');
    require_once($CFG->libdir . '/grouplib.php');
}

// Include API framework classes
require_once(__DIR__ . '/../../lib/api_base.php');
require_once(__DIR__ . '/../../lib/auth_jwt.php');
require_once(__DIR__ . '/../../lib/api_response.php');
require_once(__DIR__ . '/../../lib/api_exception.php');

/**
 * Database activity record creation endpoint.
 *
 * Extends ApiBase to provide POST handler for creating new database activity records
 * with comprehensive field validation, permission checking, and error handling.
 */
class DataCreateRecordEndpoint extends ApiBase {
    
    /**
     * Handle POST request to create a new database record.
     *
     * Validates input, checks permissions and time restrictions, processes field
     * data through Moodle's validation system, creates record if valid, and returns
     * comprehensive validation notifications for React form error display.
     *
     * @return void Outputs JSON response via parent::success() or parent::error()
     * @throws NotFoundException If database ID is not found
     * @throws ForbiddenException If user lacks permission or time restrictions apply
     * @throws ValidationException If input data is invalid
     */
    protected function handle_post() {
        global $DB, $USER;
        
        // Extract database ID from URI path (e.g., /api/v1/data/123/records -> 123)
        $pathParts = explode('/', trim($this->requestUri, '/'));
        
        // Find 'data' in path and get next segment as ID
        $databaseId = null;
        foreach ($pathParts as $index => $part) {
            if ($part === 'data' && isset($pathParts[$index + 1]) && is_numeric($pathParts[$index + 1])) {
                $databaseId = (int)$pathParts[$index + 1];
                break;
            }
        }
        
        // Validate database ID was found and is numeric
        if ($databaseId === null || $databaseId <= 0) {
            throw new ValidationException(
                400,
                'INVALID_DATABASE_ID',
                'Invalid database ID in request path',
                ['uri' => $this->requestUri, 'expected' => '/api/v1/data/{id}/records']
            );
        }
        
        // Get JSON request body
        $requestData = $this->getJsonBody();
        
        // Validate request structure
        if (!isset($requestData['data']) || !is_array($requestData['data'])) {
            throw new ValidationException(
                400,
                'INVALID_REQUEST_BODY',
                'Request body must contain "data" array with field values',
                ['received' => array_keys($requestData)]
            );
        }
        
        // Get database record from database
        $database = $DB->get_record('data', ['id' => $databaseId], '*', IGNORE_MISSING);
        
        if (!$database) {
            throw new NotFoundException(
                404,
                'DATABASE_NOT_FOUND',
                'Database activity with specified ID not found',
                ['databaseId' => $databaseId]
            );
        }
        
        // Get all fields for this database activity
        $fields = $DB->get_records('data_fields', ['dataid' => $database->id]);
        
        if (empty($fields)) {
            throw new moodle_exception('nofieldindatabase', 'data');
        }
        
        // Get course, course module, and context for this database
        list($course, $cm) = get_course_and_cm_from_instance($database, 'data');
        $context = context_module::instance($cm->id);
        
        // Check user has base capability to view database entries
        // This uses the checkCapability() method from ApiBase which wraps require_capability()
        $this->checkCapability('mod/data:viewentry', $context);
        
        // Check database time availability restrictions
        try {
            data_require_time_available($database, null, $context);
        } catch (moodle_exception $e) {
            throw new ForbiddenException(
                403,
                'TIME_RESTRICTION',
                'Database activity is not available at this time',
                [
                    'errorcode' => $e->errorcode,
                    'availablefrom' => $database->timeavailablefrom ?? null,
                    'availableuntil' => $database->timeavailableuntil ?? null
                ]
            );
        }
        
        // Get group mode for this activity
        $groupmode = groups_get_activity_groupmode($cm);
        
        // Determine groupid - use provided value or auto-determine
        $groupid = 0;
        if (isset($requestData['groupid']) && is_numeric($requestData['groupid'])) {
            $groupid = (int)$requestData['groupid'];
        } else {
            // Auto-determine group if groups are being used
            if ($groupmode) {
                $groupid = groups_get_activity_group($cm);
            }
        }
        
        // Validate user has permission to add entry in this database/group
        if (!data_user_can_add_entry($database, $groupid, $groupmode, $context)) {
            throw new ForbiddenException(
                403,
                'PERMISSION_DENIED',
                'You do not have permission to add entries to this database activity',
                [
                    'capability' => 'mod/data:writeentry',
                    'databaseId' => $database->id,
                    'groupId' => $groupid,
                    'userId' => $USER->id
                ]
            );
        }
        
        // Transform input data array into datarecord object with field_{fieldid}_{subfield} naming
        $datarecord = new stdClass();
        
        foreach ($requestData['data'] as $fieldData) {
            // Validate field data structure
            if (!isset($fieldData['fieldid']) || !isset($fieldData['value'])) {
                throw new ValidationException(
                    400,
                    'INVALID_FIELD_DATA',
                    'Each field must have "fieldid" and "value" properties',
                    ['received' => $fieldData]
                );
            }
            
            $fieldid = $fieldData['fieldid'];
            $subfield = isset($fieldData['subfield']) && $fieldData['subfield'] !== '' 
                ? '_' . $fieldData['subfield'] 
                : '';
            $value = $fieldData['value'];
            
            // Validate fieldid is numeric
            if (!is_numeric($fieldid)) {
                throw new ValidationException(
                    400,
                    'INVALID_FIELD_ID',
                    'Field ID must be numeric',
                    ['fieldid' => $fieldid]
                );
            }
            
            // JSON decode the value to support arrays (checkboxes, multi-select), objects, and primitives
            // Values are JSON-encoded in request to handle complex data types
            $decodedValue = json_decode($value);
            
            // If json_decode returns null and value wasn't "null", it's a decode error
            if ($decodedValue === null && json_last_error() !== JSON_ERROR_NONE) {
                // Value might be a plain string, use it directly
                $decodedValue = $value;
            }
            
            // Build field name using Moodle's internal naming convention
            $fieldName = 'field_' . $fieldid . $subfield;
            $datarecord->$fieldName = $decodedValue;
        }
        
        // Process submission through Moodle's validation system
        // This validates all fields, checks required fields, validates data types,
        // and returns structured validation results with notifications
        $processeddata = data_process_submission($database, $fields, $datarecord);
        
        // Initialize response data
        $newentryid = 0;
        $fieldnotifications = [];
        
        // Format field notifications for React form error display
        if (!empty($processeddata->fieldnotifications)) {
            foreach ($processeddata->fieldnotifications as $fieldname => $notifications) {
                foreach ($notifications as $notification) {
                    $fieldnotifications[] = [
                        'fieldname' => $fieldname,
                        'notification' => $notification
                    ];
                }
            }
        }
        
        // If validation passed, create the record
        if ($processeddata->validated) {
            // Create empty record with basic metadata (user, time, group)
            $recordid = data_add_record($database, $groupid);
            
            if ($recordid) {
                $newentryid = $recordid;
                
                // Populate field contents for the new record
                // This calls each field plugin's update_content() method to store
                // field-specific data, handle file uploads, and create proper
                // relationships in the data_content table
                data_add_fields_contents_to_new_record(
                    $database,
                    $context,
                    $recordid,
                    $fields,
                    $datarecord,
                    $processeddata
                );
            }
        }
        
        // Build response with entry ID and all validation notifications
        $responseData = [
            'newentryid' => $newentryid,
            'generalnotifications' => $processeddata->generalnotifications ?? [],
            'fieldnotifications' => $fieldnotifications
        ];
        
        // Determine HTTP status code
        // 201 Created if entry was successfully created
        // 400 Bad Request if validation failed
        $httpStatus = $newentryid > 0 ? 201 : 400;
        
        // Send response
        if ($newentryid > 0) {
            // Success - record created
            $this->success($responseData, $httpStatus);
        } else {
            // Validation failed - return 400 with validation notifications
            $this->error(
                'VALIDATION_FAILED',
                'Record validation failed. See notifications for details.',
                $httpStatus,
                $responseData
            );
        }
    }
    
    /**
     * Handle GET requests - not supported for this endpoint.
     *
     * @throws MethodNotAllowedException Always throws exception as GET is not supported
     */
    protected function handle_get() {
        throw new MethodNotAllowedException(
            405,
            'METHOD_NOT_ALLOWED',
            'GET method is not supported for record creation',
            ['allowedMethods' => ['POST']]
        );
    }
    
    /**
     * Handle PUT requests - not supported for this endpoint.
     *
     * @throws MethodNotAllowedException Always throws exception as PUT is not supported
     */
    protected function handle_put() {
        throw new MethodNotAllowedException(
            405,
            'METHOD_NOT_ALLOWED',
            'PUT method is not supported for record creation. Use POST to create new records.',
            ['allowedMethods' => ['POST']]
        );
    }
    
    /**
     * Handle DELETE requests - not supported for this endpoint.
     *
     * @throws MethodNotAllowedException Always throws exception as DELETE is not supported
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException(
            405,
            'METHOD_NOT_ALLOWED',
            'DELETE method is not supported for this endpoint',
            ['allowedMethods' => ['POST']]
        );
    }
}

// Instantiate and execute the endpoint (skip during testing)
if (!defined('API_TESTING') && php_sapi_name() !== 'cli') {
    $endpoint = new DataCreateRecordEndpoint();
    $endpoint->execute();
}
