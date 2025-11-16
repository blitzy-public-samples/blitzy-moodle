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
 * REST API endpoint for retrieving database activity field definitions.
 *
 * This endpoint handles GET /api/v1/data/{id}/fields requests to retrieve
 * all field configurations for a database activity instance. Returns an array
 * of field definitions including field type (text, textarea, number, date, menu,
 * checkbox, radio, file, picture, url, latlong), field name, description,
 * required status, and type-specific configuration options.
 *
 * The endpoint:
 * - Validates JWT authentication token via ApiBase
 * - Extracts database activity ID from URI path
 * - Checks mod/data:viewentry capability for the user
 * - Verifies database time availability restrictions
 * - Retrieves all field plugin instances via data_get_field_instances()
 * - Exports field configurations respecting user permissions
 * - Returns JSON formatted field array suitable for React form generation
 *
 * Example request:
 *   GET /api/v1/data/123/fields
 *   Authorization: Bearer <jwt_token>
 *
 * Example response:
 * {
 *   "success": true,
 *   "data": {
 *     "fields": [
 *       {
 *         "id": 45,
 *         "name": "Student Name",
 *         "description": "Enter your full name",
 *         "type": "text",
 *         "required": 1,
 *         "param1": "60",
 *         "param2": "255"
 *       },
 *       {
 *         "id": 46,
 *         "name": "Date of Birth",
 *         "description": "",
 *         "type": "date",
 *         "required": 1
 *       }
 *     ],
 *     "warnings": []
 *   }
 * }
 *
 * @package    api
 * @subpackage data
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Load API base classes and utilities
require_once(__DIR__ . '/../../lib/api_base.php');
require_once(__DIR__ . '/../../lib/api_exception.php');

// Load Moodle configuration and database activity libraries
require_once(__DIR__ . '/../../../config.php');
require_once($CFG->dirroot . '/mod/data/locallib.php');
require_once($CFG->dirroot . '/mod/data/lib.php');

// Load database activity field exporter
require_once($CFG->dirroot . '/mod/data/classes/external/field_exporter.php');

use mod_data\external\field_exporter;

/**
 * Database Activity Fields API Endpoint.
 *
 * Extends ApiBase to provide REST API access to database activity field definitions.
 * Implements handle_get() to process GET requests for retrieving field configurations
 * that are used to build dynamic forms in the React frontend.
 *
 * The endpoint extracts field metadata including:
 * - Field ID and name
 * - Field type (text, textarea, number, date, menu, checkbox, radio, file, picture, url, latlong)
 * - Field description and required status
 * - Type-specific parameters (e.g., text field max length, menu options, etc.)
 *
 * Field configurations are filtered based on user permissions to ensure users only
 * see configuration options they are authorized to access.
 *
 * @package    api
 * @subpackage data
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class DataFieldsEndpoint extends ApiBase {
    
    /**
     * Handle GET request to retrieve database activity field definitions.
     *
     * Extracts database ID from the request URI (e.g., /api/v1/data/123/fields),
     * validates the database exists, checks user permissions, verifies time
     * availability, retrieves all field instances, and returns formatted field
     * configurations suitable for React form generation.
     *
     * Process flow:
     * 1. Extract and validate database ID from URI path segments
     * 2. Load database record from database
     * 3. Get course and course module from database instance
     * 4. Create module context and validate user login
     * 5. Check mod/data:viewentry capability
     * 6. Verify database time availability restrictions
     * 7. Retrieve all field plugin instances
     * 8. Extract and format field configurations respecting permissions
     * 9. Export fields using field_exporter for consistent formatting
     * 10. Return JSON response with fields array and warnings
     *
     * @return void Outputs JSON response directly via $this->success()
     * @throws ValidationException If database ID is invalid or missing
     * @throws NotFoundException If database record does not exist
     * @throws ForbiddenException If user lacks required capability or time restrictions apply
     */
    protected function handle_get() {
        global $DB, $PAGE;
        
        // Extract database ID from request URI path
        // Expected URI format: /api/v1/data/{id}/fields
        $uriParts = explode('/', trim($this->requestUri, '/'));
        
        // Find the database ID in the URI path
        // URI structure: api/v1/data/{id}/fields
        $databaseId = null;
        
        // Look for 'data' segment and get the next segment as ID
        foreach ($uriParts as $index => $part) {
            if ($part === 'data' && isset($uriParts[$index + 1])) {
                $databaseId = $uriParts[$index + 1];
                break;
            }
        }
        
        // Validate database ID is present
        if ($databaseId === null) {
            throw new ValidationException('Database ID is required in the URI path', [
                'expectedFormat' => '/api/v1/data/{id}/fields',
                'receivedUri' => $this->requestUri,
                'reason' => 'Database ID must be provided in the URI path'
            ]);
        }
        
        // Validate database ID is numeric
        if (!is_numeric($databaseId)) {
            throw new ValidationException('Invalid database ID format', [
                'field' => 'id',
                'value' => $databaseId,
                'expectedType' => 'integer',
                'reason' => 'Database ID must be a numeric value'
            ]);
        }
        
        // Convert to integer
        $databaseId = (int)$databaseId;
        
        // Validate database ID is positive
        if ($databaseId <= 0) {
            throw new ValidationException('Database ID must be a positive integer', [
                'field' => 'id',
                'value' => $databaseId,
                'reason' => 'Database ID must be greater than zero'
            ]);
        }
        
        // Retrieve database record from database
        // Use MUST_EXIST flag which will throw dml_missing_record_exception if not found
        try {
            $database = $DB->get_record('data', ['id' => $databaseId], '*', MUST_EXIST);
        } catch (dml_missing_record_exception $e) {
            throw new NotFoundException('Database activity not found', [
                'databaseId' => $databaseId,
                'reason' => 'No database activity exists with the specified ID'
            ]);
        } catch (Exception $e) {
            throw new ServerException('Failed to retrieve database activity', [
                'databaseId' => $databaseId,
                'originalError' => $e->getMessage()
            ]);
        }
        
        // Get course and course module from the database instance
        // This function validates the module exists and returns course details
        try {
            list($course, $cm) = get_course_and_cm_from_instance($database, 'data');
        } catch (moodle_exception $e) {
            throw new NotFoundException('Course module not found for database activity', [
                'databaseId' => $databaseId,
                'originalError' => $e->getMessage()
            ]);
        }
        
        // Create module context for permission checking
        $context = context_module::instance($cm->id);
        
        // Validate user is logged in and has access to the course
        // This also sets up the global $PAGE and $USER objects correctly
        try {
            require_login($course, false, $cm);
        } catch (require_login_exception $e) {
            throw new ForbiddenException('Login required to access this database activity', [
                'databaseId' => $databaseId,
                'courseId' => $course->id,
                'originalError' => $e->getMessage()
            ]);
        } catch (moodle_exception $e) {
            throw new ForbiddenException('Access denied to this database activity', [
                'databaseId' => $databaseId,
                'courseId' => $course->id,
                'originalError' => $e->getMessage()
            ]);
        }
        
        // Check user has capability to view entries in this database activity
        // This uses the checkCapability() method from ApiBase which wraps require_capability()
        $this->checkCapability('mod/data:viewentry', $context);
        
        // Check database time availability restrictions
        // Determines if user can manage entries (bypasses time restrictions)
        $canManageEntries = has_capability('mod/data:manageentries', $context);
        
        // Validate database is available based on time restrictions
        // This function throws moodle_exception if database is not available
        try {
            data_require_time_available($database, $canManageEntries);
        } catch (moodle_exception $e) {
            throw new ForbiddenException('Database activity is not currently available', [
                'databaseId' => $databaseId,
                'errorcode' => $e->errorcode,
                'reason' => $e->getMessage(),
                'canManageEntries' => $canManageEntries,
                'details' => 'The database activity may have time restrictions that prevent access at this time'
            ]);
        }
        
        // Retrieve all field plugin instances for this database activity
        // This function returns an array of field objects indexed by field ID
        // Each field object is an instance of the specific field type class
        $fieldInstances = data_get_field_instances($database);
        
        // Initialize arrays for fields and warnings
        $fields = [];
        $warnings = [];
        
        // Process each field instance to extract configuration
        foreach ($fieldInstances as $fieldInstance) {
            try {
                // Get the base field record from the field instance
                // This contains the core field properties (id, name, description, type, etc.)
                $fieldRecord = $fieldInstance->field;
                
                // Get field configuration respecting user permissions
                // This method returns configuration parameters that the current user
                // is allowed to see based on their capabilities. For example, some
                // configuration options may only be visible to teachers or admins.
                $configs = $fieldInstance->get_config_for_external();
                
                // Merge configuration parameters into the field record
                // This adds type-specific parameters (param1, param2, etc.) to the record
                foreach ($configs as $configName => $configValue) {
                    $fieldRecord->{$configName} = $configValue;
                }
                
                // Export field using field_exporter for consistent formatting
                // The exporter standardizes the field structure and applies any
                // necessary transformations or filtering based on context
                $exporter = new field_exporter($fieldRecord, ['context' => $context]);
                
                // Get the renderer for exporting
                // The renderer is needed by the exporter to format certain field types
                $renderer = $PAGE->get_renderer('core');
                
                // Export the field and add to fields array
                // This produces a stdClass object with consistent property structure
                $exportedField = $exporter->export($renderer);
                $fields[] = $exportedField;
                
            } catch (Exception $e) {
                // If a field fails to export, add a warning instead of failing the entire request
                // This allows partial success if one field has issues
                $warnings[] = [
                    'item' => 'field',
                    'itemid' => isset($fieldInstance->field->id) ? $fieldInstance->field->id : 0,
                    'warningcode' => 'fieldexportfailed',
                    'message' => 'Failed to export field: ' . $e->getMessage()
                ];
            }
        }
        
        // Build response data structure
        $responseData = [
            'fields' => $fields,
            'warnings' => $warnings
        ];
        
        // Return success response with fields and warnings
        // The $this->success() method formats the response according to the
        // standard API envelope structure and sets appropriate HTTP headers
        $this->success($responseData);
    }
    
    /**
     * Handle POST requests - not supported for this endpoint.
     *
     * Field definitions are read-only via the API. Fields must be created
     * and configured through the Moodle web interface or other administrative
     * tools. This endpoint only provides read access to existing field configurations.
     *
     * @return void
     * @throws MethodNotAllowedException Always throws as POST is not supported
     */
    protected function handle_post() {
        throw new MethodNotAllowedException('POST method is not supported for field retrieval', [
            'allowedMethods' => ['GET'],
            'reason' => 'Field definitions are read-only via the API'
        ]);
    }
    
    /**
     * Handle PUT requests - not supported for this endpoint.
     *
     * Field definitions cannot be modified via the API. Use the Moodle web
     * interface to update field configurations.
     *
     * @return void
     * @throws MethodNotAllowedException Always throws as PUT is not supported
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method is not supported for field retrieval', [
            'allowedMethods' => ['GET'],
            'reason' => 'Field definitions cannot be modified via the API'
        ]);
    }
    
    /**
     * Handle DELETE requests - not supported for this endpoint.
     *
     * Field definitions cannot be deleted via the API. Use the Moodle web
     * interface to remove fields from database activities.
     *
     * @return void
     * @throws MethodNotAllowedException Always throws as DELETE is not supported
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method is not supported for field retrieval', [
            'allowedMethods' => ['GET'],
            'reason' => 'Field definitions cannot be deleted via the API'
        ]);
    }
}

// Instantiate and execute the endpoint (skip during testing)
if (!defined('API_TESTING') && php_sapi_name() !== 'cli') {
    $endpoint = new DataFieldsEndpoint();
    $endpoint->execute();
}
