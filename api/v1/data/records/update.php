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
 * REST API endpoint for updating existing database activity records.
 *
 * Handles PUT /api/v1/data/records/{id} requests with JSON body containing
 * updated field data. Validates changes using data_process_submission(),
 * updates field contents via data_update_record_fields_contents(), and
 * returns success status with validation notifications.
 *
 * Features:
 * - Partial updates allowing modification of specific fields while preserving others
 * - Ownership and capability checks via data_user_can_manage_entry()
 * - Support for all custom field types including file uploads and complex structures
 * - Time availability restriction validation
 * - Field-level validation errors for React form integration
 * - Users can only update their own entries or must have management permissions
 *
 * Request format:
 * PUT /api/v1/data/records/456
 * Content-Type: application/json
 * {
 *   "data": [
 *     {"fieldid": 1, "subfield": "", "value": "\"Updated title\""},
 *     {"fieldid": 2, "subfield": "_editor", "value": "\"<p>Updated content</p>\""},
 *     {"fieldid": 3, "subfield": "", "value": "[\"option1\",\"option2\"]"}
 *   ]
 * }
 *
 * Response format (success):
 * {
 *   "success": true,
 *   "data": {
 *     "updated": true,
 *     "generalnotifications": [],
 *     "fieldnotifications": []
 *   }
 * }
 *
 * Response format (validation failure):
 * {
 *   "success": true,
 *   "data": {
 *     "updated": false,
 *     "generalnotifications": ["Please fill in all required fields"],
 *     "fieldnotifications": [
 *       {
 *         "fieldname": "field_1",
 *         "notification": "This field is required"
 *       }
 *     ]
 *   }
 * }
 *
 * @package    api
 * @subpackage data
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Load API base class and exception classes
require_once(__DIR__ . '/../../lib/api_base.php');
require_once(__DIR__ . '/../../lib/api_exception.php');

// Load Moodle data module functions
require_once($CFG->dirroot . '/mod/data/lib.php');
require_once($CFG->dirroot . '/mod/data/locallib.php');

/**
 * Database activity record update endpoint.
 *
 * Extends ApiBase to inherit JWT authentication, HTTP method routing,
 * request handling, and response formatting. Implements handle_put()
 * to process record update requests.
 */
class DataUpdateRecordEndpoint extends ApiBase {
    
    /**
     * Handle PUT requests to update existing database activity records.
     *
     * Workflow:
     * 1. Extract record ID from URI path segments
     * 2. Get JSON request body with data array
     * 3. Validate record ID is numeric
     * 4. Retrieve record from database
     * 5. Get database instance and check time availability
     * 6. Validate user permissions (ownership or management capability)
     * 7. Transform input data array into datarecord object
     * 8. Process submission for validation
     * 9. Update record if validation passes
     * 10. Return success response with validation results
     *
     * @return void Outputs JSON response directly
     * @throws ValidationException If record ID is invalid or JSON body is malformed
     * @throws NotFoundException If record ID not found in database
     * @throws ForbiddenException If user lacks permission to update entry
     */
    protected function handle_put() {
        global $DB;
        
        // Get authenticated user
        $user = $this->getUser();
        
        // Extract record ID from URI path
        // Expected format: /api/v1/data/records/456
        $uriParts = explode('/', trim($this->requestUri, '/'));
        $entryid = end($uriParts);
        
        // Validate record ID is numeric
        if (!is_numeric($entryid) || $entryid <= 0) {
            throw new ValidationException('Invalid record ID', [
                'recordId' => $entryid,
                'reason' => 'Record ID must be a positive integer'
            ]);
        }
        
        // Convert to integer
        $entryid = (int)$entryid;
        
        // Get JSON request body
        $requestData = $this->getJsonBody();
        
        // Validate data array exists in request body
        if (!isset($requestData['data']) || !is_array($requestData['data'])) {
            throw new ValidationException('Invalid request body', [
                'reason' => 'Request body must contain "data" array with field updates',
                'expectedFormat' => [
                    'data' => [
                        ['fieldid' => 'integer', 'subfield' => 'string', 'value' => 'json-encoded']
                    ]
                ]
            ]);
        }
        
        $data = $requestData['data'];
        
        // Retrieve record from database
        try {
            $record = $DB->get_record('data_records', ['id' => $entryid], '*', MUST_EXIST);
        } catch (Exception $e) {
            throw new NotFoundException('Database record not found', [
                'recordId' => $entryid,
                'reason' => 'The specified record does not exist'
            ]);
        }
        
        // Get database activity instance from record
        try {
            $database = $DB->get_record('data', ['id' => $record->dataid], '*', MUST_EXIST);
        } catch (Exception $e) {
            throw new NotFoundException('Database activity not found', [
                'databaseId' => $record->dataid,
                'reason' => 'The database activity for this record does not exist'
            ]);
        }
        
        // Get course and course module information
        list($course, $cm) = get_course_and_cm_from_instance($database, 'data');
        
        // Create context for permission checking
        $context = context_module::instance($cm->id);
        
        // Check time availability restrictions
        // Throws moodle_exception if database is not available
        try {
            data_require_time_available($database, null, $context);
        } catch (moodle_exception $e) {
            throw new ForbiddenException('Database activity not available', [
                'reason' => $e->getMessage(),
                'errorcode' => $e->errorcode
            ]);
        }
        
        // Validate user permissions: must be record owner or have management capability
        // data_user_can_manage_entry checks:
        // 1. User is the record owner (record->userid == user->id), OR
        // 2. User has mod/data:manageentries capability
        if (!data_user_can_manage_entry($record, $database, $context)) {
            throw new ForbiddenException('Permission denied', [
                'reason' => 'You do not have permission to update this entry',
                'recordId' => $entryid,
                'recordOwner' => $record->userid,
                'currentUser' => $user->id,
                'requiredCondition' => 'Must be record owner or have mod/data:manageentries capability'
            ]);
        }
        
        // Transform input data array into datarecord object
        // Expected input format: [{fieldid: 1, subfield: "", value: "\"text\""}, ...]
        // Output format: stdClass with properties like field_1, field_2_editor, etc.
        $datarecord = new stdClass();
        
        foreach ($data as $fielddata) {
            // Validate field data structure
            if (!isset($fielddata['fieldid']) || !isset($fielddata['value'])) {
                throw new ValidationException('Invalid field data structure', [
                    'reason' => 'Each data entry must contain "fieldid" and "value"',
                    'receivedData' => $fielddata
                ]);
            }
            
            // Get subfield suffix (e.g., "_editor" for text fields, "" for simple fields)
            // If subfield already starts with underscore, don't add another one
            $subfield = '';
            if (isset($fielddata['subfield']) && $fielddata['subfield'] !== '') {
                // Check if subfield already starts with underscore
                if (substr($fielddata['subfield'], 0, 1) !== '_') {
                    $subfield = '_';
                }
                $subfield .= $fielddata['subfield'];
            }
            
            // Build field property name: field_{fieldid}{subfield}
            // Examples: field_1, field_2_editor, field_3_format
            $fieldPropertyName = 'field_' . $fielddata['fieldid'] . $subfield;
            
            // Decode JSON value to PHP type
            // Values are JSON-encoded to support arrays (checkboxes, multi-select),
            // objects, and special characters
            $decodedValue = json_decode($fielddata['value']);
            
            // Check for JSON decode errors
            if (json_last_error() !== JSON_ERROR_NONE) {
                throw new ValidationException('Invalid JSON value for field', [
                    'fieldid' => $fielddata['fieldid'],
                    'subfield' => $fielddata['subfield'],
                    'jsonError' => json_last_error_msg(),
                    'value' => $fielddata['value']
                ]);
            }
            
            // Assign decoded value to datarecord object
            $datarecord->{$fieldPropertyName} = $decodedValue;
        }
        
        // Get all field definitions for this database activity
        $fields = $DB->get_records('data_fields', ['dataid' => $database->id]);
        
        if (empty($fields)) {
            throw new ValidationException('No fields defined for this database', [
                'databaseId' => $database->id,
                'reason' => 'Cannot update record - database has no field definitions'
            ]);
        }
        
        // Process submission to validate field data
        // data_process_submission() returns object with:
        // - validated: boolean indicating if all validation passed
        // - generalnotifications: array of general error messages
        // - fieldnotifications: array with fieldname => [notifications]
        $processeddata = data_process_submission($database, $fields, $datarecord);
        
        // Initialize response variables
        $updated = false;
        $generalnotifications = $processeddata->generalnotifications ?? [];
        $fieldnotifications = [];
        
        // Format field notifications for API response
        // Transform from fieldname => [notifications] to array of {fieldname, notification} objects
        if (!empty($processeddata->fieldnotifications)) {
            foreach ($processeddata->fieldnotifications as $fieldname => $notifications) {
                foreach ($notifications as $notification) {
                    $fieldnotifications[] = [
                        'fieldname' => $fieldname,
                        'notification' => $notification,
                    ];
                }
            }
        }
        
        // If validation passed, update the record in database
        if ($processeddata->validated) {
            try {
                // Update record fields contents
                // This function handles:
                // - Updating field values in data_content table
                // - File handling for file fields
                // - Updating record timestamps
                // - Triggering appropriate events
                data_update_record_fields_contents($database, $record, $context, $datarecord, $processeddata);
                
                $updated = true;
                
            } catch (Exception $e) {
                // If update fails, treat as server error
                throw new ServerException('Failed to update record', [
                    'recordId' => $entryid,
                    'reason' => $e->getMessage(),
                    'file' => $e->getFile(),
                    'line' => $e->getLine()
                ]);
            }
        }
        
        // Build success response
        // Even if validation failed (updated=false), this is a successful API call
        // with validation errors to display to user
        $responseData = [
            'updated' => $updated,
            'generalnotifications' => $generalnotifications,
            'fieldnotifications' => $fieldnotifications,
        ];
        
        // Return success response with 200 OK status
        return $this->success($responseData, 200);
    }
    
    /**
     * Handle GET requests - not supported for this endpoint.
     *
     * @throws MethodNotAllowedException Always thrown as GET is not supported
     */
    protected function handle_get() {
        throw new MethodNotAllowedException('GET method not allowed for record updates', [
            'allowedMethods' => ['PUT'],
            'endpoint' => '/api/v1/data/records/{id}'
        ]);
    }
    
    /**
     * Handle POST requests - not supported for this endpoint.
     *
     * @throws MethodNotAllowedException Always thrown as POST is not supported
     */
    protected function handle_post() {
        throw new MethodNotAllowedException('POST method not allowed for record updates', [
            'allowedMethods' => ['PUT'],
            'endpoint' => '/api/v1/data/records/{id}',
            'suggestion' => 'Use PUT method to update existing records'
        ]);
    }
    
    /**
     * Handle DELETE requests - not supported for this endpoint.
     *
     * @throws MethodNotAllowedException Always thrown as DELETE is not supported
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method not allowed on this endpoint', [
            'allowedMethods' => ['PUT'],
            'endpoint' => '/api/v1/data/records/{id}',
            'suggestion' => 'Use separate delete endpoint for record deletion'
        ]);
    }
}

// Instantiate and execute the endpoint
$endpoint = new DataUpdateRecordEndpoint();
$endpoint->execute();
