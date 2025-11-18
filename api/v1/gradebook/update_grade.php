<?php
/**
 * REST API endpoint for updating individual grade values and grade item properties.
 *
 * This endpoint provides a RESTful interface for modifying grades and grade item
 * settings in the Moodle gradebook. It acts as a thin wrapper around the existing
 * grade_update() function from gradelib.php, preserving all business logic and
 * validation rules from the core Moodle gradebook system.
 *
 * Endpoint: PUT /api/v1/gradebook/items/{id}
 *
 * Request Body (JSON):
 * {
 *   "userid": 123,                    // Required for grade updates
 *   "finalgrade": 85.5,              // Optional: new grade value
 *   "feedback": "Good work",          // Optional: feedback text
 *   "feedbackformat": 1,              // Optional: feedback format (FORMAT_HTML, FORMAT_PLAIN, etc.)
 *   "itemdetails": {                  // Optional: grade item properties to update
 *     "itemname": "Assignment 1",
 *     "grademax": 100,
 *     "grademin": 0,
 *     "scaleid": null
 *   }
 * }
 *
 * Success Response (200 OK):
 * {
 *   "success": true,
 *   "data": {
 *     "itemid": 456,
 *     "userid": 123,
 *     "finalgrade": 85.5,
 *     "feedback": "Good work",
 *     "updated": true
 *   }
 * }
 *
 * Error Responses:
 * - 400 Bad Request: Invalid input data or validation errors
 * - 403 Forbidden: Grade item is locked or user lacks permission
 * - 404 Not Found: Grade item not found
 * - 405 Method Not Allowed: HTTP method other than PUT used
 *
 * Authentication: Requires valid JWT token
 * Authorization: Requires moodle/grade:edit capability in course context
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Include Moodle configuration and core libraries
require_once(__DIR__ . '/../../../config.php');
require_once($CFG->dirroot . '/lib/gradelib.php');
require_once($CFG->libdir . '/grade/constants.php');
require_once($CFG->libdir . '/grade/grade_item.php');

// Include API framework classes
require_once(__DIR__ . '/../../lib/api_base.php');
require_once(__DIR__ . '/../../lib/api_exception.php');

/**
 * API endpoint class for updating grades and grade item properties.
 *
 * This class extends ApiBase to provide RESTful grade update functionality.
 * It delegates all business logic to the existing grade_update() function,
 * ensuring consistency with the PHP gradebook implementation.
 *
 * @package    core
 * @subpackage api
 */
class UpdateGradeEndpoint extends ApiBase {
    
    /**
     * Handle GET requests - not supported for this endpoint.
     *
     * Grade updates must use PUT method. This method is implemented
     * to satisfy the abstract base class but throws an exception if called.
     *
     * @throws MethodNotAllowedException Always thrown as GET is not supported
     * @return void
     */
    protected function handle_get() {
        throw new MethodNotAllowedException(
            'GET method not allowed for grade updates. Use PUT instead.',
            ['allowedMethods' => ['PUT']]
        );
    }
    
    /**
     * Handle POST requests - not supported for this endpoint.
     *
     * Grade updates must use PUT method. This method is implemented
     * to satisfy the abstract base class but throws an exception if called.
     *
     * @throws MethodNotAllowedException Always thrown as POST is not supported
     * @return void
     */
    protected function handle_post() {
        throw new MethodNotAllowedException(
            'POST method not allowed for grade updates. Use PUT instead.',
            ['allowedMethods' => ['PUT']]
        );
    }
    
    /**
     * Handle PUT requests to update grades and grade item properties.
     *
     * This method:
     * 1. Extracts the grade item ID from the URI path
     * 2. Validates the user has moodle/grade:edit capability
     * 3. Parses the JSON request body
     * 4. Fetches the existing grade item
     * 5. Calls grade_update() with appropriate parameters
     * 6. Returns formatted JSON response with update results
     *
     * All business logic, validation, and grade calculations are delegated
     * to the existing grade_update() function. No grade logic is duplicated.
     *
     * @throws NotFoundException      If grade item does not exist
     * @throws ValidationException    If request data is invalid
     * @throws ForbiddenException     If grade item is locked or user lacks permission
     * @throws InternalErrorException If grade_update() fails unexpectedly
     * @return void Sends JSON response directly
     */
    protected function handle_put() {
        global $DB;
        
        // Extract grade item ID from URI path
        // Expected URI format: /api/v1/gradebook/items/{id}
        $itemid = $this->extractItemIdFromUri();
        
        // Fetch the grade item to get course context and validate existence
        $gradeitem = $this->fetchGradeItem($itemid);
        
        // Check if user has permission to edit grades in this course
        $coursecontext = context_course::instance($gradeitem->courseid);
        $this->checkCapability('moodle/grade:edit', $coursecontext);
        
        // Parse JSON request body
        $requestdata = $this->getJsonBody();
        
        // Validate required fields for grade updates
        if (!isset($requestdata['userid']) && isset($requestdata['finalgrade'])) {
            throw new ValidationException(
                'userid is required when updating grade values',
                ['missingField' => 'userid']
            );
        }
        
        // Prepare grades array for grade_update()
        $grades = $this->prepareGradesArray($requestdata);
        
        // Prepare item details for updating grade item properties
        $itemdetails = $this->prepareItemDetails($requestdata);
        
        // Call existing grade_update() function - all business logic delegated here
        $result = $this->callGradeUpdate($gradeitem, $grades, $itemdetails);
        
        // Handle the result from grade_update()
        $this->handleGradeUpdateResult($result, $gradeitem, $requestdata);
    }
    
    /**
     * Handle DELETE requests - not supported for this endpoint.
     *
     * Grade deletion is not supported via this endpoint. This method is
     * implemented to satisfy the abstract base class but throws an exception.
     *
     * @throws MethodNotAllowedException Always thrown as DELETE is not supported
     * @return void
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException(
            'DELETE method not allowed for grade updates. Grade deletion should use dedicated endpoints.',
            ['allowedMethods' => ['PUT']]
        );
    }
    
    /**
     * Extract grade item ID from URI path.
     *
     * Uses regular expression to extract the numeric ID from paths like:
     * /api/v1/gradebook/items/123
     *
     * @throws ValidationException If URI format is invalid or ID is missing
     * @return int The grade item ID
     */
    private function extractItemIdFromUri() {
        $requesturi = $_SERVER['REQUEST_URI'];
        
        // Pattern matches: /api/v1/gradebook/items/{digits}
        if (preg_match('#/api/v1/gradebook/items/(\d+)#', $requesturi, $matches)) {
            return (int)$matches[1];
        }
        
        throw new ValidationException(
            'Invalid URI format. Expected: /api/v1/gradebook/items/{id}',
            ['uri' => $requesturi]
        );
    }
    
    /**
     * Fetch grade item from database and validate it exists.
     *
     * @param int $itemid The grade item ID
     * @throws NotFoundException If grade item does not exist
     * @return grade_item The grade item object
     */
    private function fetchGradeItem($itemid) {
        // Use grade_item::fetch() to retrieve the item
        $gradeitem = grade_item::fetch(['id' => $itemid]);
        
        if (!$gradeitem) {
            throw new NotFoundException(
                'Grade item not found',
                ['itemid' => $itemid]
            );
        }
        
        return $gradeitem;
    }
    
    /**
     * Prepare grades array for grade_update() function.
     *
     * Converts the JSON request data into the format expected by grade_update().
     * The grades array maps user IDs to grade objects with properties:
     * - userid: User ID
     * - rawgrade: The actual grade value (stored as finalgrade in request)
     * - feedback: Feedback text
     * - feedbackformat: Feedback format constant
     *
     * @param array $requestdata The parsed JSON request body
     * @return array|null Grades array or null if no grade data provided
     */
    private function prepareGradesArray($requestdata) {
        // If no userid specified, no grades to update
        if (!isset($requestdata['userid'])) {
            return null;
        }
        
        $userid = (int)$requestdata['userid'];
        $gradedata = new stdClass();
        $gradedata->userid = $userid;
        
        // Set grade value if provided
        if (isset($requestdata['finalgrade'])) {
            $gradedata->rawgrade = $requestdata['finalgrade'];
        }
        
        // Set feedback if provided
        if (isset($requestdata['feedback'])) {
            $gradedata->feedback = $requestdata['feedback'];
        }
        
        // Set feedback format if provided
        if (isset($requestdata['feedbackformat'])) {
            $gradedata->feedbackformat = (int)$requestdata['feedbackformat'];
        }
        
        // Return array with single grade keyed by userid
        return [$userid => $gradedata];
    }
    
    /**
     * Prepare item details array for grade_update() function.
     *
     * Extracts grade item properties from the request that should be updated.
     * These properties affect the grade item itself, not individual user grades.
     *
     * Supported properties:
     * - itemname: Display name for the grade item
     * - grademax: Maximum possible grade
     * - grademin: Minimum possible grade
     * - scaleid: ID of scale (null for numeric grades)
     * - gradepass: Grade required to pass
     * - hidden: Whether the item is hidden
     * - locked: Whether the item is locked
     *
     * @param array $requestdata The parsed JSON request body
     * @return array|null Item details array or null if no item updates
     */
    private function prepareItemDetails($requestdata) {
        if (!isset($requestdata['itemdetails']) || !is_array($requestdata['itemdetails'])) {
            return null;
        }
        
        $itemdetails = [];
        $allowed_properties = [
            'itemname',
            'grademax',
            'grademin',
            'scaleid',
            'gradepass',
            'hidden',
            'locked',
            'aggregationcoef',
            'aggregationcoef2',
            'weightoverride'
        ];
        
        // Copy only allowed properties
        foreach ($allowed_properties as $property) {
            if (array_key_exists($property, $requestdata['itemdetails'])) {
                $itemdetails[$property] = $requestdata['itemdetails'][$property];
            }
        }
        
        return empty($itemdetails) ? null : $itemdetails;
    }
    
    /**
     * Call the existing grade_update() function with proper parameters.
     *
     * This method delegates all grade update logic to the core Moodle function.
     * No business logic, calculations, or validation is duplicated here.
     *
     * @param grade_item $gradeitem The grade item being updated
     * @param array|null $grades    Array of grade data keyed by userid
     * @param array|null $itemdetails Grade item properties to update
     * @return int Result code from grade_update() (GRADE_UPDATE_OK, etc.)
     */
    private function callGradeUpdate($gradeitem, $grades, $itemdetails) {
        // Extract required parameters from grade item
        $source = 'api/v1/gradebook/items'; // Source identifier for audit trail
        $courseid = $gradeitem->courseid;
        $itemtype = $gradeitem->itemtype;
        $itemmodule = $gradeitem->itemmodule;
        $iteminstance = $gradeitem->iteminstance;
        $itemnumber = $gradeitem->itemnumber;
        
        // Call existing grade_update() function - all logic delegated here
        $result = grade_update(
            $source,
            $courseid,
            $itemtype,
            $itemmodule,
            $iteminstance,
            $itemnumber,
            $grades,
            $itemdetails
        );
        
        return $result;
    }
    
    /**
     * Handle the result code from grade_update() and send appropriate response.
     *
     * Interprets the integer return code from grade_update() and either sends
     * a success response or throws an appropriate exception.
     *
     * Result codes from grade/constants.php:
     * - GRADE_UPDATE_OK (0): Success
     * - GRADE_UPDATE_FAILED (1): General failure
     * - GRADE_UPDATE_MULTIPLE (2): Multiple items found (should never happen)
     * - GRADE_UPDATE_ITEM_LOCKED (3): Grade item is locked
     *
     * @param int $result Result code from grade_update()
     * @param grade_item $gradeitem The grade item that was updated
     * @param array $requestdata Original request data
     * @throws ValidationException    If update failed due to invalid data
     * @throws ForbiddenException     If grade item is locked
     * @throws InternalErrorException If update failed unexpectedly
     * @return void Sends JSON response
     */
    private function handleGradeUpdateResult($result, $gradeitem, $requestdata) {
        switch ($result) {
            case GRADE_UPDATE_OK:
                // Success - prepare response data
                $responsedata = [
                    'itemid' => $gradeitem->id,
                    'courseid' => $gradeitem->courseid,
                    'itemname' => $gradeitem->itemname,
                    'updated' => true
                ];
                
                // Include grade data if a grade was updated
                if (isset($requestdata['userid'])) {
                    $responsedata['userid'] = (int)$requestdata['userid'];
                    
                    if (isset($requestdata['finalgrade'])) {
                        $responsedata['finalgrade'] = $requestdata['finalgrade'];
                    }
                    
                    if (isset($requestdata['feedback'])) {
                        $responsedata['feedback'] = $requestdata['feedback'];
                    }
                }
                
                // Include updated item details if provided
                if (isset($requestdata['itemdetails'])) {
                    $responsedata['itemdetails'] = $requestdata['itemdetails'];
                }
                
                $this->success($responsedata, 'Grade updated successfully');
                break;
                
            case GRADE_UPDATE_FAILED:
                // General failure - typically validation error
                throw new ValidationException(
                    'Grade update failed. Check that grade values are valid and within allowed range.',
                    [
                        'itemid' => $gradeitem->id,
                        'grademax' => $gradeitem->grademax,
                        'grademin' => $gradeitem->grademin
                    ]
                );
                
            case GRADE_UPDATE_MULTIPLE:
                // Multiple items found - data integrity issue
                throw new ValidationException(
                    'Multiple grade items found with the same parameters. This indicates a data integrity issue.',
                    ['itemid' => $gradeitem->id]
                );
                
            case GRADE_UPDATE_ITEM_LOCKED:
                // Grade item is locked - cannot be modified
                throw new ForbiddenException(
                    'Grade item is locked and cannot be modified',
                    [
                        'itemid' => $gradeitem->id,
                        'locked' => true
                    ]
                );
                
            default:
                // Unexpected return code
                throw new InternalErrorException(
                    'Unexpected result from grade_update()',
                    [
                        'result' => $result,
                        'itemid' => $gradeitem->id
                    ]
                );
        }
    }
}

// Instantiate and execute the endpoint
$endpoint = new UpdateGradeEndpoint();
$endpoint->execute();
