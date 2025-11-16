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
 * REST API endpoint for retrieving feedback activity details.
 *
 * This endpoint provides comprehensive feedback activity information including
 * configuration settings, availability status, anonymity settings, and item count.
 * The data is formatted for React frontend consumption to display feedback overview
 * pages and enable users to initiate feedback responses.
 *
 * Endpoint: GET /api/v1/feedback/{id}
 *
 * Authentication: Requires valid JWT token in Authorization header
 * Permission: Requires 'mod/feedback:view' capability in the feedback context
 *
 * URL Parameters:
 *   - id (required, integer): Feedback activity ID
 *
 * Response Format:
 * {
 *   "success": true,
 *   "data": {
 *     "id": 123,
 *     "name": "Course Feedback Survey",
 *     "intro": "<p>Please complete this feedback...</p>",
 *     "anonymous": true,
 *     "multiple_submit": false,
 *     "timeopen": 1609459200,
 *     "timeclose": 1612137600,
 *     "is_open": true,
 *     "item_count": 10,
 *     "user_already_submitted": false,
 *     "page_after_submit": "<p>Thank you for your feedback</p>",
 *     "completionsubmit": true
 *   }
 * }
 *
 * Error Responses:
 *   - 401 Unauthorized: Missing or invalid JWT token
 *   - 403 Forbidden: User lacks 'mod/feedback:view' capability
 *   - 404 Not Found: Feedback activity does not exist
 *   - 500 Internal Server Error: Unexpected server error
 *
 * @package    api
 * @subpackage feedback
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Include Moodle configuration and required libraries
// In test environment, these are already loaded by PHPUnit bootstrap or test script
if (!defined('PHPUNIT_TEST') && !defined('API_TEST_MODE')) {
    require_once(__DIR__ . '/../../../config.php');
    require_once($CFG->dirroot . '/mod/feedback/lib.php');
}

// Include API framework classes
require_once(__DIR__ . '/../../lib/api_base.php');
require_once(__DIR__ . '/../../lib/auth_jwt.php');
require_once(__DIR__ . '/../../lib/api_response.php');
require_once(__DIR__ . '/../../lib/api_exception.php');

/**
 * Feedback Show Endpoint class.
 *
 * Handles GET requests to retrieve detailed information about a specific
 * feedback activity. Wraps existing Moodle feedback module functions to
 * provide JSON API responses for the React frontend.
 *
 * This endpoint:
 * 1. Validates JWT authentication via ApiBase constructor
 * 2. Extracts feedback ID from URL parameters
 * 3. Validates the feedback activity exists using get_coursemodule_from_instance()
 * 4. Enforces 'mod/feedback:view' capability via require_capability()
 * 5. Instantiates mod_feedback_structure to access feedback methods
 * 6. Retrieves feedback configuration, availability, and completion status
 * 7. Returns standardized JSON response with all feedback details
 *
 * Business Logic Delegation:
 * - All feedback data retrieval delegates to existing Moodle functions
 * - No business logic duplication - API acts as thin wrapper
 * - Permission checking uses Moodle's require_capability() system
 * - Data validation handled by existing Moodle parameter cleaning
 *
 * @package    api
 * @subpackage feedback
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class FeedbackShowEndpoint extends ApiBase {
    
    /**
     * Handle GET request to retrieve feedback activity details.
     *
     * This method implements the complete flow for retrieving feedback information:
     * 1. Parameter extraction and validation
     * 2. Course module and context validation
     * 3. Permission enforcement
     * 4. Feedback data retrieval via mod_feedback_structure
     * 5. Completion status checking via mod_feedback_completion
     * 6. Response formatting and transmission
     *
     * The method delegates all business logic to existing Moodle functions:
     * - get_coursemodule_from_instance(): Validates and retrieves course module
     * - context_module::instance(): Gets context for permission checking
     * - require_capability(): Enforces viewing permissions
     * - mod_feedback_structure: Provides feedback structure and configuration
     * - mod_feedback_completion: Handles completion and submission tracking
     *
     * @return void Outputs JSON response directly via success() method
     * @throws ValidationException If feedback ID parameter is invalid or missing (extends ApiException)
     * @throws NotFoundException If feedback activity does not exist (extends ApiException)
     * @throws ForbiddenException If user lacks 'mod/feedback:view' capability (extends ApiException)
     * @throws ServerException If unexpected error occurs during processing (extends ApiException)
     */
    protected function handle_get() {
        global $DB;
        
        // Extract and validate feedback ID parameter from URL
        // Uses PARAM_INT to ensure parameter is a positive integer
        $feedbackid = $this->getParam('id', PARAM_INT);
        
        // Validate feedback activity exists and get course module
        // get_coursemodule_from_instance() is existing Moodle function that:
        // - Validates the feedback record exists in database
        // - Retrieves associated course module information
        // - Throws exception if feedback not found (MUST_EXIST flag)
        $cm = get_coursemodule_from_instance('feedback', $feedbackid, 0, false, MUST_EXIST);
        
        if (!$cm) {
            throw new NotFoundException('Feedback activity not found', [
                'feedbackId' => $feedbackid,
                'reason' => 'No feedback activity exists with the specified ID'
            ]);
        }
        
        // Get module context for permission checking
        // context_module::instance() is existing Moodle function for context retrieval
        $context = context_module::instance($cm->id);
        
        // Enforce permission check using Moodle's capability system
        // checkCapability() wraps require_capability() with API exception handling
        // Throws ForbiddenException if user lacks 'mod/feedback:view' capability
        $this->checkCapability('mod/feedback:view', $context);
        
        // Get authenticated user from JWT token
        $user = $this->getUser();
        
        // Retrieve full feedback record from database
        // $DB->get_record() is existing Moodle database function
        $feedback = $DB->get_record('feedback', ['id' => $feedbackid], '*', MUST_EXIST);
        
        // Instantiate feedback structure helper class
        // mod_feedback_structure provides methods to access feedback configuration,
        // items, availability status, and anonymity settings
        // This is the existing Moodle class from mod/feedback/classes/structure.php
        $feedbackstructure = new mod_feedback_structure($feedback, $cm, 0);
        
        // Get complete feedback object with all properties
        // Existing method from mod_feedback_structure class
        $feedbackobj = $feedbackstructure->get_feedback();
        
        // Check if feedback is currently open for responses
        // is_open() checks timeopen and timeclose timestamps against current time
        // Returns boolean indicating availability
        $isopen = $feedbackstructure->is_open();
        
        // Get feedback items (questions) array
        // get_items() retrieves all feedback items/questions for this activity
        // Returns array of item objects from database
        $items = $feedbackstructure->get_items();
        
        // Count total number of items
        $itemcount = is_array($items) ? count($items) : 0;
        
        // Check if feedback is anonymous
        // is_anonymous() checks feedback configuration for anonymity setting
        // Returns true if responses are anonymous, false otherwise
        $isanonymous = $feedbackstructure->is_anonymous();
        
        // Instantiate completion helper to check submission status
        // mod_feedback_completion tracks user completions and submissions
        // Courseid parameter is 0 for non-site feedbacks
        $feedbackcompletion = new mod_feedback_completion($feedback, $cm, 0);
        
        // Check if current user has already submitted a response
        // is_already_submitted() checks completion records for this user
        // Returns true if user has submitted, false if not yet submitted
        $alreadysubmitted = $feedbackcompletion->is_already_submitted();
        
        // Build response data array with all feedback details
        // Format follows standardized API response structure for React frontend
        $responsedata = [
            'id' => (int)$feedbackobj->id,
            'name' => format_string($feedbackobj->name),
            'intro' => format_text($feedbackobj->intro, $feedbackobj->introformat, [
                'context' => $context,
                'noclean' => true
            ]),
            'anonymous' => $isanonymous,
            'multiple_submit' => (bool)$feedbackobj->multiple_submit,
            'timeopen' => (int)$feedbackobj->timeopen,
            'timeclose' => (int)$feedbackobj->timeclose,
            'is_open' => $isopen,
            'item_count' => $itemcount,
            'user_already_submitted' => $alreadysubmitted,
            'page_after_submit' => format_text($feedbackobj->page_after_submit, 
                $feedbackobj->page_after_submitformat, [
                    'context' => $context,
                    'noclean' => true
                ]
            ),
            'completionsubmit' => (bool)$feedbackobj->completionsubmit,
            'publish_stats' => (bool)$feedbackobj->publish_stats,
            'autonumbering' => (bool)$feedbackobj->autonumbering,
        ];
        
        // Send success response with feedback data
        // success() method from ApiBase sets CORS headers and formats JSON response
        $this->success($responsedata);
    }
    
    /**
     * Handle POST requests - not supported for this endpoint.
     *
     * This endpoint only supports GET requests for retrieving feedback details.
     * Feedback submission is handled by separate endpoints.
     *
     * @return void
     * @throws MethodNotAllowedException Always throws exception
     */
    protected function handle_post() {
        throw new MethodNotAllowedException('POST method not supported for feedback show endpoint', [
            'allowedMethods' => ['GET'],
            'suggestion' => 'Use GET method to retrieve feedback details'
        ]);
    }
    
    /**
     * Handle PUT requests - not supported for this endpoint.
     *
     * This endpoint only supports GET requests for retrieving feedback details.
     * Feedback updates are handled by separate admin endpoints.
     *
     * @return void
     * @throws MethodNotAllowedException Always throws exception
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method not supported for feedback show endpoint', [
            'allowedMethods' => ['GET'],
            'suggestion' => 'Use GET method to retrieve feedback details'
        ]);
    }
    
    /**
     * Handle DELETE requests - not supported for this endpoint.
     *
     * This endpoint only supports GET requests for retrieving feedback details.
     * Feedback deletion is handled by separate admin endpoints.
     *
     * @return void
     * @throws MethodNotAllowedException Always throws exception
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method not supported for feedback show endpoint', [
            'allowedMethods' => ['GET'],
            'suggestion' => 'Use GET method to retrieve feedback details'
        ]);
    }
}

// Instantiate and execute the endpoint (skip during testing)
// This pattern allows the endpoint to be included directly or via routing
if (!defined('API_TESTING') && php_sapi_name() !== 'cli') {
    $endpoint = new FeedbackShowEndpoint();
    $endpoint->execute();
}
