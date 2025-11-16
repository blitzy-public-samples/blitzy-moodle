<?php
/**
 * Choice Activity Submission API Endpoint
 *
 * REST API endpoint for submitting or updating a user's choice response.
 * Handles both single and multiple selection choices with limit validation
 * and completion tracking.
 *
 * Endpoint: POST /api/v1/choice/{id}/submit
 * 
 * Request Body (JSON):
 * {
 *   "answer": 123          // For single choice (integer)
 *   // OR
 *   "answer": [123, 124]   // For multiple choice (array of integers)
 * }
 *
 * Success Response:
 * {
 *   "success": true,
 *   "data": {
 *     "message": "Choice response submitted successfully",
 *     "choiceid": 5,
 *     "userid": 42,
 *     "answers": [123, 124]
 *   }
 * }
 *
 * Error Responses:
 * - 400: Validation error (no answer, invalid options, choice full, not open, closed, update not allowed)
 * - 401: Unauthorized (invalid JWT token)
 * - 403: Forbidden (no permission or not enrolled)
 * - 404: Choice activity not found
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Include Moodle configuration and required libraries
require_once(__DIR__ . '/../../../config.php');
require_once($CFG->dirroot . '/mod/choice/lib.php');
require_once($CFG->libdir . '/completionlib.php');

// Include API framework classes
require_once(__DIR__ . '/../../lib/api_base.php');
require_once(__DIR__ . '/../../lib/auth_jwt.php');
require_once(__DIR__ . '/../../lib/api_response.php');
require_once(__DIR__ . '/../../lib/api_exception.php');

/**
 * Choice Submission API Endpoint Class
 *
 * Extends ApiBase to inherit JWT authentication, HTTP method routing,
 * parameter extraction, capability checking, and standardized response formatting.
 *
 * This endpoint validates JWT tokens, checks user permissions and enrollment,
 * verifies choice availability, and delegates to existing Moodle choice functions
 * to submit user responses.
 */
class ChoiceSubmitEndpoint extends ApiBase {
    
    /**
     * Handle POST request for choice submission
     *
     * This method:
     * 1. Validates JWT token and extracts authenticated user
     * 2. Retrieves choice ID from URL parameter
     * 3. Retrieves answer option ID(s) from POST body
     * 4. Validates course module exists
     * 5. Enforces permission check and enrollment
     * 6. Retrieves choice object with options
     * 7. Checks choice availability (open/close times, allowupdate)
     * 8. Validates submitted option IDs exist in choice options
     * 9. Calls choice_user_submit_response() to save response
     * 10. Returns standardized JSON success response
     *
     * @return void Outputs JSON response directly
     * @throws NotFoundException If choice activity or course module not found
     * @throws ForbiddenException If user lacks permission or is not enrolled
     * @throws ValidationException If answer is empty, invalid, or choice not available
     */
    protected function handle_post() {
        global $DB, $CFG;
        
        // Get authenticated user from JWT token (handled by ApiBase constructor)
        $user = $this->getUser();
        $userid = $user->id;
        
        // Extract choice ID from URL parameter
        // Example: POST /api/v1/choice/5/submit -> id=5
        $choiceid = $this->getParam('id', PARAM_INT);
        if (empty($choiceid)) {
            throw new ValidationException('Choice ID is required');
        }
        
        // Parse JSON request body to get answer option ID(s)
        $body = $this->getJsonBody();
        $answer = $body['answer'] ?? null;
        
        // Validate that answer is provided
        if (empty($answer)) {
            throw new ValidationException('At least one option must be selected');
        }
        
        // Validate course module exists using Moodle's get_coursemodule_from_id()
        // This returns false if the module doesn't exist or isn't a choice activity
        $cm = get_coursemodule_from_id('choice', $choiceid, 0, false, MUST_EXIST);
        if (!$cm) {
            throw new NotFoundException('Choice activity not found');
        }
        
        // Create cm_info object for additional context information
        $cm = cm_info::create($cm);
        
        // Retrieve course record for the choice activity
        $course = $DB->get_record('course', ['id' => $cm->course], '*', MUST_EXIST);
        if (!$course) {
            throw new NotFoundException('Course not found');
        }
        
        // Get module context for permission checking
        $context = context_module::instance($cm->id);
        
        // Check if user is enrolled in the course
        // is_enrolled() checks if user has an active enrollment in the course
        if (!is_enrolled($context, $userid, 'mod/choice:choose')) {
            throw new ForbiddenException('You must be enrolled in this course to submit a choice');
        }
        
        // Check capability using existing Moodle permission system
        // This enforces the same permission rules as the PHP interface
        $this->checkCapability('mod/choice:choose', $context);
        
        // Retrieve choice object with options using existing Moodle function
        // choice_get_choice() returns choice record with option and maxanswers arrays
        $choice = choice_get_choice($cm->instance);
        if (!$choice) {
            throw new NotFoundException('Choice not found');
        }
        
        // Check choice availability (open/close times, allowupdate setting)
        // Returns [$available, $warnings] where warnings contains reason codes
        list($choiceavailable, $warnings) = choice_get_availability_status($choice);
        
        // If choice is not available, throw validation exception with specific reason
        if (!$choiceavailable) {
            // Extract the first warning reason
            $reason = current(array_keys($warnings));
            $reasontext = current($warnings);
            
            // Map Moodle reason codes to user-friendly messages
            $errormessages = [
                'notopenyet' => 'This choice is not yet open. It opens on ' . $reasontext,
                'expired' => 'This choice has closed. It closed on ' . $reasontext,
                'choicesaved' => 'You have already made a choice and updates are not allowed'
            ];
            
            $message = $errormessages[$reason] ?? 'This choice is not currently available';
            throw new ValidationException($message, ['reason' => $reason, 'detail' => $reasontext]);
        }
        
        // Normalize answer to array format for consistent processing
        // Single choice: $answer = 123 -> [123]
        // Multiple choice: $answer = [123, 124] -> [123, 124]
        if (!is_array($answer)) {
            $answer = [$answer];
        }
        
        // Validate that all submitted option IDs exist in the choice options
        // $choice->option is an array of [optionid => optiontext] populated by choice_get_choice()
        $validoptions = array_keys($choice->option);
        foreach ($answer as $optionid) {
            if (!in_array($optionid, $validoptions)) {
                throw new ValidationException('Invalid option ID: ' . $optionid, [
                    'submitted' => $optionid,
                    'valid_options' => $validoptions
                ]);
            }
        }
        
        // Convert back to single integer if original was single choice
        // choice_user_submit_response() expects single int for single choice, array for multiple
        if (count($answer) === 1 && !$choice->allowmultiple) {
            $answer = $answer[0];
        }
        
        // Submit the response using existing Moodle function
        // This function handles:
        // - Deleting old responses
        // - Validating against maxanswers limits
        // - Using database locking for limited choices
        // - Inserting new response records
        // - Triggering answer_created/answer_updated events
        // - Updating activity completion status
        try {
            choice_user_submit_response($answer, $choice, $userid, $course, $cm);
        } catch (moodle_exception $e) {
            // Catch Moodle exceptions and convert to API exceptions
            // Common exceptions: choicefull, invalidoptionid
            throw new ValidationException($e->getMessage(), ['moodle_error' => $e->errorcode]);
        }
        
        // Prepare success response data
        $responsedata = [
            'message' => 'Choice response submitted successfully',
            'choiceid' => (int)$choice->id,
            'userid' => (int)$userid,
            'answers' => is_array($answer) ? array_map('intval', $answer) : [(int)$answer]
        ];
        
        // Return standardized success response using ApiBase::success()
        // This formats response as {"success": true, "data": {...}}
        $this->success($responsedata, 'Choice submitted');
    }
    
    /**
     * Handle GET request (not supported for this endpoint)
     *
     * Choice submission is a write operation that requires POST method.
     * GET requests will return 405 Method Not Allowed.
     *
     * @return void
     * @throws MethodNotAllowedException Always throws this exception
     */
    protected function handle_get() {
        throw new MethodNotAllowedException('GET method not supported for choice submission. Use POST.');
    }
    
    /**
     * Handle PUT request (not supported for this endpoint)
     *
     * Choice responses are submitted via POST. Updates are handled
     * by submitting a new response with the same POST endpoint.
     *
     * @return void
     * @throws MethodNotAllowedException Always throws this exception
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method not supported for choice submission. Use POST.');
    }
    
    /**
     * Handle DELETE request (not supported for this endpoint)
     *
     * Choice responses cannot be deleted via API. If the choice
     * allows updates, users can change their response via POST.
     *
     * @return void
     * @throws MethodNotAllowedException Always throws this exception
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method not supported. To remove a choice, submit an empty response if allowed by choice settings.');
    }
}

// Instantiate and execute the endpoint (skip during testing)
// ApiBase constructor handles JWT validation and authentication
// ApiBase::execute() routes to appropriate handle_* method based on HTTP method
if (!defined('API_TESTING') && php_sapi_name() !== 'cli') {
    $endpoint = new ChoiceSubmitEndpoint();
    $endpoint->execute();
}
