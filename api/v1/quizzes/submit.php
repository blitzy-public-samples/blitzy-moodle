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
 * REST API endpoint for submitting quiz attempt answers.
 *
 * POST /api/v1/quizzes/{id}/submit - Submit quiz attempt answers and process completion
 *
 * This endpoint handles both page submissions (saving answers and navigating) and
 * final quiz submissions (finishing the attempt and calculating final grade). It
 * delegates all business logic to existing Moodle quiz functions, particularly
 * the quiz_attempt::process_attempt() method which handles answer persistence,
 * state transitions, grade calculations, and completion tracking.
 *
 * Request Body (JSON):
 * {
 *   "attemptid": 123,           // Required: Quiz attempt ID
 *   "responses": {              // Required: Question responses object
 *     "1": "answer1",           // Key: slot number, Value: answer data
 *     "2": ["opt1", "opt2"]     // Format varies by question type
 *   },
 *   "currentpage": 0,           // Required: Current page number being submitted
 *   "finishattempt": false,     // Required: true for final submission, false for page navigation
 *   "timeup": false             // Required: true if time limit expired, false otherwise
 * }
 *
 * Response (IN_PROGRESS):
 * {
 *   "success": true,
 *   "data": {
 *     "attemptid": 123,
 *     "state": "inprogress",
 *     "currentpage": 1,
 *     "questionsAnswered": 5,
 *     "totalQuestions": 10
 *   }
 * }
 *
 * Response (FINISHED):
 * {
 *   "success": true,
 *   "data": {
 *     "attemptid": 123,
 *     "state": "finished",
 *     "grade": 85.5,
 *     "maxgrade": 100.0,
 *     "feedback": "Well done!"
 *   }
 * }
 *
 * @package    api
 * @subpackage quizzes
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Load Moodle configuration and quiz libraries
require_once(__DIR__ . '/../../../config.php');
require_once($CFG->dirroot . '/mod/quiz/locallib.php');

// Load API base class and exceptions
require_once(__DIR__ . '/../../lib/api_base.php');
require_once(__DIR__ . '/../../lib/api_exception.php');

// Import quiz_attempt class for state constants
use mod_quiz\quiz_attempt;

/**
 * Quiz Submit Endpoint - handles POST requests for quiz answer submission.
 *
 * This endpoint processes quiz attempt submissions including:
 * - Page submissions: Save answers and navigate to next/previous page
 * - Final submissions: Complete attempt and calculate final grade
 * - Time-up submissions: Handle forced submission when time expires
 *
 * All business logic is delegated to existing Moodle functions:
 * - quiz_create_attempt_handling_errors() - Load and validate attempt
 * - $attemptobj->process_attempt() - Process responses and update state
 * - $attemptobj->get_grade() - Calculate final grade
 *
 * Security:
 * - Requires JWT authentication (inherited from ApiBase)
 * - Validates user owns the attempt
 * - Checks mod/quiz:attempt capability
 * - Validates attempt is not already finished
 *
 * @package    api
 * @subpackage quizzes
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class QuizSubmitEndpoint extends ApiBase {
    
    /**
     * Handle POST request for quiz submission.
     *
     * Processes quiz attempt submissions by:
     * 1. Validating request body contains required fields
     * 2. Loading quiz attempt object and validating ownership
     * 3. Checking user capabilities
     * 4. Processing attempt via existing Moodle functions
     * 5. Returning appropriate response based on new attempt state
     *
     * @return void Outputs JSON response directly
     * @throws ValidationException If request parameters are invalid
     * @throws ForbiddenException If user doesn't own attempt or lacks capability
     * @throws NotFoundException If attempt doesn't exist
     * @throws ServerException If processing fails
     */
    protected function handle_post() {
        global $USER, $DB;
        
        // Get authenticated user from JWT token
        $user = $this->getUser();
        
        // Get JSON request body
        $requestBody = $this->getJsonBody();
        
        // Validate required field: attemptid
        if (!isset($requestBody['attemptid']) || empty($requestBody['attemptid'])) {
            throw new ValidationException('Missing required field: attemptid', [
                'field' => 'attemptid',
                'required' => true,
                'received' => $requestBody['attemptid'] ?? null
            ]);
        }
        
        // Convert attemptid to integer and validate
        $attemptid = intval($requestBody['attemptid']);
        if ($attemptid <= 0) {
            throw new ValidationException('Invalid attempt ID: must be a positive integer', [
                'field' => 'attemptid',
                'value' => $requestBody['attemptid'],
                'expected' => 'positive integer'
            ]);
        }
        
        // Validate required field: responses (must be object/array)
        if (!isset($requestBody['responses'])) {
            throw new ValidationException('Missing required field: responses', [
                'field' => 'responses',
                'required' => true,
                'expected' => 'object with slot numbers as keys'
            ]);
        }
        
        // Validate responses is an array/object
        if (!is_array($requestBody['responses'])) {
            throw new ValidationException('Invalid responses format: must be an object', [
                'field' => 'responses',
                'received' => gettype($requestBody['responses']),
                'expected' => 'object/array'
            ]);
        }
        
        // Validate required field: currentpage
        if (!isset($requestBody['currentpage']) && $requestBody['currentpage'] !== 0) {
            throw new ValidationException('Missing required field: currentpage', [
                'field' => 'currentpage',
                'required' => true,
                'expected' => 'integer (0-based page number)'
            ]);
        }
        
        $currentpage = intval($requestBody['currentpage']);
        if ($currentpage < 0) {
            throw new ValidationException('Invalid currentpage: must be non-negative integer', [
                'field' => 'currentpage',
                'value' => $requestBody['currentpage'],
                'expected' => 'non-negative integer'
            ]);
        }
        
        // Validate required field: finishattempt (must be boolean)
        if (!isset($requestBody['finishattempt'])) {
            throw new ValidationException('Missing required field: finishattempt', [
                'field' => 'finishattempt',
                'required' => true,
                'expected' => 'boolean (true for final submission, false for page navigation)'
            ]);
        }
        
        $finishattempt = (bool) $requestBody['finishattempt'];
        
        // Validate required field: timeup (must be boolean)
        if (!isset($requestBody['timeup'])) {
            throw new ValidationException('Missing required field: timeup', [
                'field' => 'timeup',
                'required' => true,
                'expected' => 'boolean (true if time expired, false otherwise)'
            ]);
        }
        
        $timeup = (bool) $requestBody['timeup'];
        
        // Load quiz attempt object using existing Moodle function
        // This function validates attempt exists and handles errors
        try {
            $attemptobj = quiz_create_attempt_handling_errors($attemptid);
        } catch (moodle_exception $e) {
            // Convert to NotFoundException if attempt doesn't exist
            if ($e->errorcode === 'invalidattemptid' || $e->errorcode === 'attempterror') {
                throw new NotFoundException("Quiz attempt not found", [
                    'attemptid' => $attemptid,
                    'originalError' => $e->getMessage()
                ]);
            }
            // Re-throw other Moodle exceptions as ServerException
            throw new ServerException("Failed to load quiz attempt: {$e->getMessage()}", [
                'attemptid' => $attemptid,
                'errorcode' => $e->errorcode,
                'originalError' => $e->getMessage()
            ]);
        }
        
        // Validate user owns this attempt
        if ($attemptobj->get_userid() != $user->id) {
            throw new ForbiddenException('You do not own this quiz attempt', [
                'attemptid' => $attemptid,
                'attemptUserId' => $attemptobj->get_userid(),
                'currentUserId' => $user->id,
                'reason' => 'Can only submit your own quiz attempts'
            ]);
        }
        
        // Get context for capability checking
        $context = $attemptobj->get_context();
        
        // Check user has attempt capability (unless preview user)
        // Preview users are teachers/admins previewing the quiz
        if (!$attemptobj->is_preview_user()) {
            try {
                $this->checkCapability('mod/quiz:attempt', $context);
            } catch (ForbiddenException $e) {
                // Re-throw with more specific message
                throw new ForbiddenException('You do not have permission to attempt this quiz', [
                    'capability' => 'mod/quiz:attempt',
                    'contextId' => $context->id,
                    'userId' => $user->id,
                    'originalError' => $e->getMessage()
                ]);
            }
        }
        
        // Validate attempt is not already finished
        if ($attemptobj->is_finished()) {
            throw new ValidationException('Cannot submit: attempt is already finished', [
                'attemptid' => $attemptid,
                'state' => $attemptobj->get_state(),
                'reason' => 'Attempt has already been submitted and graded'
            ]);
        }
        
        // Set responses in $_POST for Moodle's question engine to process
        // The process_attempt() method expects responses in $_POST
        // This is how the existing processattempt.php works
        foreach ($requestBody['responses'] as $slot => $response) {
            // Question engine expects slot keys in format like "q123:1_answer"
            // For simplicity, we'll set the raw slot numbers and let process_submitted_actions handle it
            $_POST["q{$slot}:sequencecheck"] = $response;
        }
        
        // Get current time for timestamp
        $timenow = time();
        
        // Process the attempt using existing Moodle function
        // This handles:
        // - Saving responses to database via question engine
        // - Updating attempt state (inprogress, finished, overdue)
        // - Calculating grades if finishing
        // - Applying grade method (highest, average, first, last)
        // - Triggering completion tracking
        // - Emitting attempt events
        try {
            $newstate = $attemptobj->process_attempt($timenow, $finishattempt, $timeup, $currentpage);
            
        } catch (question_out_of_sequence_exception $e) {
            // Question was submitted out of sequence
            throw new ValidationException('Question submission out of sequence', [
                'attemptid' => $attemptid,
                'currentpage' => $currentpage,
                'originalError' => $e->getMessage(),
                'reason' => 'Question responses must be submitted in order'
            ]);
            
        } catch (moodle_exception $e) {
            // Other Moodle exceptions during processing
            throw new ServerException("Failed to process quiz attempt: {$e->getMessage()}", [
                'attemptid' => $attemptid,
                'errorcode' => $e->errorcode ?? 'unknown',
                'originalError' => $e->getMessage()
            ]);
            
        } catch (Exception $e) {
            // Unexpected exceptions
            throw new ServerException('Unexpected error processing quiz attempt', [
                'attemptid' => $attemptid,
                'error' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine()
            ]);
        }
        
        // Build response based on new attempt state
        switch ($newstate) {
            case quiz_attempt::IN_PROGRESS:
                // Attempt is still in progress (page submission or not finished yet)
                // Return current attempt status
                $responseData = [
                    'attemptid' => $attemptid,
                    'state' => 'inprogress',
                    'currentpage' => $attemptobj->get_currentpage(),
                    'questionsAnswered' => $this->getQuestionsAnswered($attemptobj),
                    'totalQuestions' => count($attemptobj->get_slots()),
                    'timeRemaining' => $this->getTimeRemaining($attemptobj, $timenow)
                ];
                
                $this->success($responseData, 200);
                break;
                
            case quiz_attempt::FINISHED:
                // Attempt is finished successfully
                // Return final grade and feedback
                $grade = $attemptobj->get_attempt()->sumgrades;
                $maxgrade = $attemptobj->get_quiz()->sumgrades;
                
                // Get overall feedback based on grade
                $feedback = $attemptobj->get_overall_feedback($grade);
                
                $responseData = [
                    'attemptid' => $attemptid,
                    'state' => 'finished',
                    'grade' => round($grade, 2),
                    'maxgrade' => round($maxgrade, 2),
                    'percentage' => $maxgrade > 0 ? round(($grade / $maxgrade) * 100, 2) : 0,
                    'feedback' => $feedback ? format_text($feedback, FORMAT_HTML) : '',
                    'timefinished' => $attemptobj->get_attempt()->timefinish
                ];
                
                $this->success($responseData, 200);
                break;
                
            case quiz_attempt::OVERDUE:
                // Attempt is overdue (time limit exceeded with grace period)
                // Client should redirect to summary page
                $responseData = [
                    'attemptid' => $attemptid,
                    'state' => 'overdue',
                    'message' => 'Quiz time limit has expired. Please review your answers and submit.',
                    'currentpage' => $attemptobj->get_currentpage(),
                    'timeExpired' => true
                ];
                
                $this->success($responseData, 200, [
                    'redirectTo' => 'summary',
                    'reason' => 'Time limit exceeded'
                ]);
                break;
                
            case quiz_attempt::ABANDONED:
                // Attempt was abandoned (grace period also exceeded)
                $responseData = [
                    'attemptid' => $attemptid,
                    'state' => 'abandoned',
                    'message' => 'Quiz attempt has been abandoned due to time limit expiration.',
                    'grade' => 0,
                    'maxgrade' => $attemptobj->get_quiz()->sumgrades
                ];
                
                $this->success($responseData, 200);
                break;
                
            default:
                // Unknown state (shouldn't happen)
                throw new ServerException('Quiz attempt returned unexpected state', [
                    'attemptid' => $attemptid,
                    'state' => $newstate,
                    'expectedStates' => ['inprogress', 'finished', 'overdue', 'abandoned']
                ]);
        }
    }
    
    /**
     * Get count of questions answered so far.
     *
     * @param quiz_attempt $attemptobj Quiz attempt object
     * @return int Number of questions with responses saved
     */
    private function getQuestionsAnswered($attemptobj) {
        $answered = 0;
        $quba = $attemptobj->get_question_usage();
        
        foreach ($attemptobj->get_slots() as $slot) {
            $qa = $quba->get_question_attempt($slot);
            if ($qa->get_num_steps() > 1) {
                // Question has been answered if it has more than 1 step
                // (first step is always the initial state)
                $answered++;
            }
        }
        
        return $answered;
    }
    
    /**
     * Get time remaining in seconds for timed quizzes.
     *
     * @param quiz_attempt $attemptobj Quiz attempt object
     * @param int $timenow Current timestamp
     * @return int|null Seconds remaining, or null if no time limit
     */
    private function getTimeRemaining($attemptobj, $timenow) {
        $accessmanager = $attemptobj->get_access_manager($timenow);
        $timeclose = $accessmanager->get_end_time($attemptobj->get_attempt());
        
        if ($timeclose === false || $timeclose === null) {
            // No time limit
            return null;
        }
        
        $remaining = $timeclose - $timenow;
        return max(0, $remaining);
    }
    
    /**
     * Handle GET method (not supported for this endpoint).
     *
     * @throws MethodNotAllowedException Always, as GET is not supported
     */
    protected function handle_get() {
        throw new MethodNotAllowedException('GET method is not supported for quiz submission', [
            'method' => 'GET',
            'allowedMethods' => ['POST'],
            'reason' => 'Quiz submission requires POST request with answer data'
        ]);
    }
    
    /**
     * Handle PUT method (not supported for this endpoint).
     *
     * @throws MethodNotAllowedException Always, as PUT is not supported
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method is not supported for quiz submission', [
            'method' => 'PUT',
            'allowedMethods' => ['POST'],
            'reason' => 'Quiz submission requires POST request with answer data'
        ]);
    }
    
    /**
     * Handle DELETE method (not supported for this endpoint).
     *
     * @throws MethodNotAllowedException Always, as DELETE is not supported
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method is not supported for quiz submission', [
            'method' => 'DELETE',
            'allowedMethods' => ['POST'],
            'reason' => 'Quiz submission requires POST request with answer data'
        ]);
    }
}

// Execute the endpoint
$endpoint = new QuizSubmitEndpoint();
$endpoint->execute();
