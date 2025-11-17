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
 * REST API endpoint for submitting feedback responses.
 *
 * This endpoint provides a JSON API for submitting feedback activity responses.
 * It wraps existing Moodle feedback functions without duplicating business logic,
 * enabling React frontend to submit feedback responses with JWT authentication.
 *
 * Endpoint: POST /api/v1/feedback/{id}/complete
 *
 * Request body (JSON):
 * {
 *   "responses": {
 *     "multichoice_123": "Option 1",
 *     "textarea_124": "User's response text",
 *     "numeric_125": 42
 *   },
 *   "courseid": 5  // Optional: for site-wide feedbacks
 * }
 *
 * Success response:
 * {
 *   "success": true,
 *   "data": {
 *     "completionId": 456,
 *     "message": "Feedback completed successfully",
 *     "anonymous": false,
 *     "pageAfterSubmit": "<html>Thank you page content</html>"  // If configured
 *   }
 * }
 *
 * Error responses:
 * - 403 Forbidden: User lacks mod/feedback:complete capability or cannot complete
 * - 404 Not Found: Feedback activity not found
 * - 400 Bad Request: Feedback not open, already completed, or invalid response data
 * - 500 Internal Server Error: Unexpected error during processing
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Load Moodle configuration and required libraries
// In test environment, these are already loaded by PHPUnit bootstrap or test script
if (!defined('PHPUNIT_TEST') && !defined('API_TEST_MODE')) {
    require_once(__DIR__ . '/../../../config.php');
    require_once($CFG->dirroot . '/mod/feedback/lib.php');
    require_once($CFG->dirroot . '/mod/feedback/classes/completion.php');
    require_once($CFG->libdir . '/completionlib.php');
}

// Load API infrastructure
require_once(__DIR__ . '/../../lib/api_base.php');
require_once(__DIR__ . '/../../lib/api_exception.php');

/**
 * Feedback completion endpoint class.
 *
 * Handles POST requests for submitting feedback responses. This endpoint:
 * - Validates JWT authentication (inherited from ApiBase)
 * - Checks mod/feedback:complete capability
 * - Validates feedback is open and user can complete it
 * - Saves response data using existing Moodle feedback functions
 * - Triggers completion events
 * - Supports both anonymous and identified responses
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class FeedbackCompleteEndpoint extends ApiBase {
    
    /**
     * Handle POST request to submit feedback response.
     *
     * This method processes feedback completion by:
     * 1. Extracting feedback ID from URL and response data from JSON body
     * 2. Validating course module exists and user has permission
     * 3. Checking feedback is open and user can complete it
     * 4. Saving temporary response data
     * 5. Finalizing the response (moving from temp to completion table)
     * 6. Triggering module viewed event and completion tracking
     * 7. Returning success response with completion details
     *
     * @return void Outputs JSON response via success() or error() methods
     * @throws ForbiddenException If user lacks permission or cannot complete
     * @throws NotFoundException If feedback activity not found
     * @throws ValidationException If feedback not open or invalid data
     * @throws ServerException If unexpected error occurs
     */
    protected function handle_post() {
        global $DB, $CFG;
        
        // Extract feedback ID from URL parameter
        $feedbackid = $this->getParam('id', PARAM_INT);
        
        if (!$feedbackid) {
            throw new ValidationException('Missing feedback ID', [
                'parameter' => 'id',
                'message' => 'Feedback ID must be provided in the URL'
            ]);
        }
        
        // Get JSON request body containing response data
        $requestData = $this->getJsonBody();
        
        if (!$requestData) {
            throw new ValidationException('Invalid request body', [
                'message' => 'Request body must contain valid JSON with response data'
            ]);
        }
        
        // Extract optional course ID for site-wide feedbacks
        $courseid = isset($requestData->courseid) ? intval($requestData->courseid) : null;
        
        // Extract response data
        if (!isset($requestData->responses) || !is_object($requestData->responses)) {
            throw new ValidationException('Missing response data', [
                'message' => 'Request body must contain "responses" object with feedback item answers'
            ]);
        }
        
        $responses = $requestData->responses;
        
        // Validate course module exists using get_coursemodule_from_instance
        try {
            $cm = get_coursemodule_from_instance('feedback', $feedbackid, 0, false, MUST_EXIST);
        } catch (Exception $e) {
            throw new NotFoundException('Feedback activity not found', [
                'feedbackId' => $feedbackid,
                'error' => $e->getMessage()
            ]);
        }
        
        // Get course record
        $course = $DB->get_record('course', ['id' => $cm->course], '*', MUST_EXIST);
        
        // Get feedback record
        $feedback = $DB->get_record('feedback', ['id' => $cm->instance], '*', MUST_EXIST);
        
        // Get module context for permission checking
        $context = context_module::instance($cm->id);
        
        // Check mod/feedback:complete capability using inherited checkCapability method
        $this->checkCapability('mod/feedback:complete', $context);
        
        // Get authenticated user from JWT token
        $user = $this->getUser();
        
        // Instantiate mod_feedback_completion class to handle submission logic
        $feedbackcompletion = new mod_feedback_completion($feedback, $cm, $courseid);
        
        // Verify user is allowed to complete this feedback
        if (!$feedbackcompletion->can_complete()) {
            throw new ForbiddenException('You are not allowed to complete this feedback', [
                'feedbackId' => $feedbackid,
                'userId' => $user->id,
                'reason' => 'User does not have permission to complete this feedback activity'
            ]);
        }
        
        // Check if feedback is currently open (timeopen, timeclose)
        if (!$feedbackcompletion->is_open()) {
            throw new ValidationException('Feedback is not open', [
                'feedbackId' => $feedbackid,
                'timeopen' => $feedback->timeopen,
                'timeclose' => $feedback->timeclose,
                'currentTime' => time(),
                'message' => 'This feedback is not currently accepting responses'
            ]);
        }
        
        // Check if user can submit (multiple_submit setting and prior submissions)
        if (!$feedbackcompletion->can_submit()) {
            throw new ValidationException('Cannot submit feedback response', [
                'feedbackId' => $feedbackid,
                'userId' => $user->id,
                'multipleSubmit' => $feedback->multiple_submit,
                'message' => 'Multiple submissions are not allowed and you have already completed this feedback'
            ]);
        }
        
        // Validate that all required items have responses
        $allitems = $feedbackcompletion->get_items();
        $missingRequired = [];
        
        foreach ($allitems as $item) {
            // Skip items that don't have values or aren't required
            if (!$item->hasvalue) {
                continue;
            }
            
            // Check if item is required
            if ($item->required) {
                $keyname = $item->typ . '_' . $item->id;
                
                // Check if response exists for this required item
                if (!isset($responses->$keyname) || $responses->$keyname === '' || $responses->$keyname === null) {
                    $missingRequired[] = [
                        'itemId' => $item->id,
                        'itemName' => $item->name,
                        'itemType' => $item->typ,
                        'keyName' => $keyname
                    ];
                }
            }
        }
        
        // If there are missing required items, return validation error
        if (!empty($missingRequired)) {
            throw new ValidationException('Missing required feedback items', [
                'feedbackId' => $feedbackid,
                'missingItems' => $missingRequired,
                'message' => 'All required feedback items must be answered'
            ]);
        }
        
        // Save temporary response data using existing Moodle function
        // This creates or updates the temporary response record
        try {
            $feedbackcompletion->save_response_tmp($responses);
        } catch (Exception $e) {
            throw new ServerException('Failed to save temporary response', [
                'feedbackId' => $feedbackid,
                'userId' => $user->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
        }
        
        // Finalize the response by moving from temporary to completion table
        // This also sends email notifications if configured
        try {
            $feedbackcompletion->save_response();
        } catch (Exception $e) {
            throw new ServerException('Failed to finalize feedback response', [
                'feedbackId' => $feedbackid,
                'userId' => $user->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
        }
        
        // Get the completed record to return completion ID
        $completed = $feedbackcompletion->get_completed();
        
        if (!$completed) {
            throw new ServerException('Feedback saved but completion record not found', [
                'feedbackId' => $feedbackid,
                'userId' => $user->id
            ]);
        }
        
        // Trigger module viewed event for completion tracking
        // This marks the activity as viewed for activity completion
        if (isloggedin() && !isguestuser()) {
            try {
                $feedbackcompletion->set_module_viewed();
            } catch (Exception $e) {
                // Log the error but don't fail the request
                // The response has been saved successfully
                error_log('Failed to set module viewed for feedback ' . $feedbackid . ': ' . $e->getMessage());
            }
        }
        
        // Prepare response data
        $responseData = [
            'completionId' => $completed->id,
            'message' => 'Feedback completed successfully',
            'anonymous' => ($feedback->anonymous == FEEDBACK_ANONYMOUS_YES),
            'timeCompleted' => $completed->timemodified
        ];
        
        // Include page_after_submit content if configured
        if (!empty($feedback->page_after_submit)) {
            // Format the page_after_submit text
            $pageAfterSubmit = file_rewrite_pluginfile_urls(
                $feedback->page_after_submit,
                'pluginfile.php',
                $context->id,
                'mod_feedback',
                'page_after_submit',
                0
            );
            
            // Convert to HTML format
            $pageAfterSubmit = format_text(
                $pageAfterSubmit,
                $feedback->page_after_submitformat,
                ['context' => $context]
            );
            
            $responseData['pageAfterSubmit'] = $pageAfterSubmit;
        }
        
        // Return standardized success response with completion details
        $this->success($responseData, 200);
    }
    
    /**
     * Handle GET request - not supported for this endpoint.
     *
     * Feedback completion requires POST method with response data.
     * GET requests are not allowed.
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown
     */
    protected function handle_get() {
        throw new MethodNotAllowedException('GET method not supported for feedback completion', [
            'allowedMethods' => ['POST'],
            'message' => 'Use POST method to submit feedback responses'
        ]);
    }
    
    /**
     * Handle PUT request - not supported for this endpoint.
     *
     * Feedback completion is a create operation (POST), not an update (PUT).
     * Use POST to submit a new response.
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method not supported for feedback completion', [
            'allowedMethods' => ['POST'],
            'message' => 'Use POST method to submit feedback responses'
        ]);
    }
    
    /**
     * Handle DELETE request - not supported for this endpoint.
     *
     * Feedback responses cannot be deleted via API. Use Moodle's admin
     * interface to manage feedback responses.
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method not supported for feedback completion', [
            'allowedMethods' => ['POST'],
            'message' => 'Feedback responses cannot be deleted via API'
        ]);
    }
}

// Instantiate and execute the endpoint (skip during testing)
if (!defined('API_TESTING') && php_sapi_name() !== 'cli') {
    // Skip auto-execution in test mode to allow manual instantiation
if (!defined('API_TEST_MODE') || !API_TEST_MODE) {
    $endpoint = new FeedbackCompleteEndpoint();
    $endpoint->execute();
}
}
