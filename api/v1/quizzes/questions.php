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
 * REST API endpoint for retrieving quiz attempt questions.
 *
 * Provides GET /api/v1/quizzes/attempts/{id}/questions endpoint that retrieves
 * all questions for a specific quiz attempt. This endpoint enables React quiz
 * interface to display questions with their current state, answer data, and
 * navigation information during an active attempt or when reviewing a completed
 * attempt.
 *
 * Delegates to existing Moodle quiz functions without duplicating business logic:
 * - quiz_create_attempt_handling_errors() for attempt object creation
 * - quiz_attempt::get_slots() for question slot retrieval
 * - question_display_options for determining what can be shown
 * - require_capability() for permission validation
 *
 * Returns comprehensive question data including:
 * - Question text and format
 * - Question type and behavior
 * - Current answer state and responses
 * - Marks and grading information (if available)
 * - Feedback (if available based on display options)
 * - Navigation state (flagged, answered, current page)
 * - Display options determining what student can see
 *
 * Handles both active attempts (in-progress) and review of finished attempts,
 * adapting what information is shown based on quiz settings and attempt state.
 *
 * @package    api
 * @subpackage quizzes
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Load Moodle configuration and quiz libraries
require_once(__DIR__ . '/../../../config.php');
require_once($CFG->dirroot . '/mod/quiz/locallib.php');
require_once($CFG->dirroot . '/mod/quiz/accessmanager.php');

// Load API base classes
require_once(__DIR__ . '/../../lib/api_base.php');
require_once(__DIR__ . '/../../lib/api_exception.php');

/**
 * Quiz Questions API Endpoint.
 *
 * Handles GET requests to /api/v1/quizzes/attempts/{id}/questions for retrieving
 * all questions for a quiz attempt. Returns question data with current state,
 * answers, and feedback appropriate for the attempt state and quiz settings.
 *
 * Authentication: Required via JWT token
 * Authorization: User must own the attempt or have mod/quiz:viewreports capability
 * HTTP Method: GET only
 *
 * Query Parameters:
 * - page: Optional page number to retrieve (0-based)
 * - slot: Optional specific question slot to retrieve
 *
 * Response includes:
 * - attempt: Basic attempt information
 * - questions: Array of question data with slots, text, state, answers
 * - navigation: Page navigation information
 * - displayOptions: What can be shown based on quiz settings
 * - timing: Time remaining if time limit exists
 *
 * @package    api
 * @subpackage quizzes
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class QuizQuestionsEndpoint extends ApiBase {
    
    /**
     * Handle GET request for quiz attempt questions.
     *
     * Extracts attempt ID from URL path, validates user has permission to view
     * the attempt's questions, retrieves question data using existing Moodle
     * quiz functions, determines what can be displayed based on quiz settings
     * and attempt state, and returns formatted question information for React
     * quiz interface.
     *
     * URL Pattern: /api/v1/quizzes/attempts/{id}/questions
     * Example: /api/v1/quizzes/attempts/123/questions?page=0
     *
     * @return void Outputs JSON response with questions data
     * @throws ValidationException If attempt ID is invalid
     * @throws NotFoundException If attempt does not exist
     * @throws ForbiddenException If user lacks permission to view questions
     * @throws ApiException If questions cannot be retrieved
     */
    protected function handle_get() {
        global $DB, $USER, $PAGE;
        
        // Validate user is authenticated via JWT token
        $authenticatedUser = $this->getUser();
        
        // Extract attempt ID from URL path using regex
        // Pattern matches: /attempts/{attemptid}/questions
        if (!preg_match('/\/attempts\/(\d+)\/questions$/', $this->requestUri, $matches)) {
            throw new ValidationException('Invalid URL format', [
                'expected' => '/api/v1/quizzes/attempts/{id}/questions',
                'received' => $this->requestUri,
                'reason' => 'Attempt ID must be specified in URL path'
            ]);
        }
        
        $attemptid = (int)$matches[1];
        
        // Validate attempt ID is positive integer
        if ($attemptid <= 0) {
            throw new ValidationException('Invalid attempt ID', [
                'attemptId' => $attemptid,
                'reason' => 'Attempt ID must be a positive integer'
            ]);
        }
        
        // Parse query parameters
        $requestedPage = isset($_GET['page']) ? (int)$_GET['page'] : null;
        $requestedSlot = isset($_GET['slot']) ? (int)$_GET['slot'] : null;
        
        // Load attempt object using existing Moodle function
        try {
            $attemptobj = quiz_create_attempt_handling_errors($attemptid);
        } catch (moodle_exception $e) {
            throw new NotFoundException('Quiz attempt not found', [
                'attemptId' => $attemptid,
                'reason' => $e->getMessage()
            ]);
        }
        
        // Get context for capability checking
        $context = $attemptobj->get_context();
        
        // Check if user has permission to view this attempt's questions
        $isOwnAttempt = $attemptobj->get_userid() == $USER->id;
        $canViewReports = has_capability('mod/quiz:viewreports', $context);
        
        if (!$isOwnAttempt && !$canViewReports) {
            throw new ForbiddenException('You do not have permission to view this attempt', [
                'attemptId' => $attemptid,
                'reason' => 'You can only view your own attempts unless you have viewreports capability'
            ]);
        }
        
        // For own attempts, check if attempt is in progress or can be reviewed
        if ($isOwnAttempt) {
            if ($attemptobj->is_finished()) {
                // Attempt is finished - check if review is allowed
                if (!$attemptobj->is_review_allowed()) {
                    throw new ForbiddenException('Review is not currently allowed for this attempt', [
                        'attemptId' => $attemptid,
                        'reason' => 'Quiz settings do not allow review at this time'
                    ]);
                }
            } else {
                // Attempt is in progress - check if user can attempt
                try {
                    require_capability('mod/quiz:attempt', $context);
                } catch (moodle_exception $e) {
                    throw new ForbiddenException('You do not have permission to attempt this quiz', [
                        'attemptId' => $attemptid,
                        'capability' => 'mod/quiz:attempt',
                        'reason' => $e->getMessage()
                    ]);
                }
            }
        }
        
        // Set up page context for Moodle functions
        $PAGE->set_context($context);
        
        // Get display options based on attempt state
        $displayoptions = $attemptobj->get_display_options(true);
        
        // Determine which page to display
        $page = $requestedPage !== null ? $requestedPage : $attemptobj->get_currentpage();
        
        // Validate page number
        if ($page < 0 || $page >= $attemptobj->get_num_pages()) {
            throw new ValidationException('Invalid page number', [
                'page' => $page,
                'totalPages' => $attemptobj->get_num_pages(),
                'reason' => 'Page number is out of range'
            ]);
        }
        
        // Get question usage
        $quba = $attemptobj->get_question_usage();
        
        // Get all slots or specific slot
        if ($requestedSlot !== null) {
            // Validate slot exists
            if (!in_array($requestedSlot, $attemptobj->get_slots())) {
                throw new ValidationException('Invalid question slot', [
                    'slot' => $requestedSlot,
                    'reason' => 'Question slot does not exist in this attempt'
                ]);
            }
            $slots = [$requestedSlot];
        } else {
            // Get all slots for the requested page
            $slots = $attemptobj->get_slots($page);
        }
        
        // Build questions array
        $questionsData = [];
        
        foreach ($slots as $slot) {
            $qa = $quba->get_question_attempt($slot);
            $question = $qa->get_question();
            
            // Build question data
            $questionData = [
                'slot' => $slot,
                'page' => $attemptobj->get_question_page($slot),
                'number' => $attemptobj->get_question_number($slot),
                'type' => $question->qtype->name(),
                'name' => $question->name,
                'questionText' => $attemptobj->render_question($slot, false, $displayoptions),
                'state' => $qa->get_state()->__toString(),
                'stateName' => (string)$qa->get_state(),
                'isFlagged' => $attemptobj->is_question_flagged($slot),
                'maxMark' => $qa->get_max_mark(),
            ];
            
            // Add current mark if visible
            if ($displayoptions->marks >= question_display_options::MARK_AND_MAX) {
                $questionData['mark'] = $qa->get_mark();
                $questionData['fraction'] = $qa->get_fraction();
            }
            
            // Add answer state information
            $questionData['answered'] = $qa->get_state()->is_answered();
            $questionData['needsGrading'] = $qa->get_state()->is_finished() && !$qa->get_state()->is_graded();
            $questionData['complete'] = $qa->get_state()->is_finished();
            
            // Add behaviour name
            $questionData['behaviour'] = $qa->get_behaviour_name();
            
            // Add response summary if available
            if ($displayoptions->responses) {
                $questionData['responseSummary'] = $qa->get_response_summary();
            }
            
            // Add right answer if available
            if ($displayoptions->rightanswer) {
                $questionData['rightAnswer'] = $qa->get_right_answer_summary();
            }
            
            // Add feedback if available
            if ($displayoptions->feedback) {
                $questionData['feedback'] = [
                    'general' => $qa->get_behaviour()->get_general_feedback($qa),
                    'specific' => $qa->get_behaviour()->get_specific_feedback($qa),
                ];
            }
            
            // Add correctness information if available
            if ($displayoptions->correctness) {
                $state = $qa->get_state();
                $questionData['correctness'] = [
                    'correct' => $state->is_correct(),
                    'partiallyCorrect' => $state->is_partially_correct(),
                    'incorrect' => $state->is_incorrect(),
                ];
            }
            
            $questionsData[] = $questionData;
        }
        
        // Build navigation data
        $navigationData = [
            'currentPage' => $page,
            'totalPages' => $attemptobj->get_num_pages(),
            'totalQuestions' => count($attemptobj->get_slots()),
            'questionsPerPage' => $attemptobj->get_quiz()->questionsperpage,
            'canNavigateFreely' => $attemptobj->get_navigation_method() === QUIZ_NAVMETHOD_FREE,
            'hasNextPage' => $page < ($attemptobj->get_num_pages() - 1),
            'hasPreviousPage' => $page > 0,
        ];
        
        // Build display options data
        $displayOptionsData = [
            'attempt' => $displayoptions->attempt == question_display_options::VISIBLE,
            'correctness' => $displayoptions->correctness == question_display_options::VISIBLE,
            'marks' => $displayoptions->marks == question_display_options::VISIBLE,
            'feedback' => $displayoptions->feedback == question_display_options::VISIBLE,
            'rightAnswer' => $displayoptions->rightanswer == question_display_options::VISIBLE,
            'responses' => $displayoptions->responses == question_display_options::VISIBLE,
            'generalFeedback' => $displayoptions->generalfeedback == question_display_options::VISIBLE,
            'overallFeedback' => $displayoptions->overallfeedback == question_display_options::VISIBLE,
        ];
        
        // Build timing data
        $timingData = [
            'timeStart' => $attemptobj->get_attempt()->timestart,
            'timeFinish' => $attemptobj->get_attempt()->timefinish,
            'hasTimeLimit' => (bool)$attemptobj->get_quiz()->timelimit,
        ];
        
        if ($attemptobj->get_quiz()->timelimit) {
            $timingData['timeLimit'] = $attemptobj->get_quiz()->timelimit;
            
            if (!$attemptobj->is_finished()) {
                $now = time();
                $deadline = $attemptobj->get_attempt()->timestart + $attemptobj->get_quiz()->timelimit;
                
                // Consider quiz close time if set
                if ($attemptobj->get_quiz()->timeclose) {
                    $deadline = min($deadline, $attemptobj->get_quiz()->timeclose);
                }
                
                $timingData['deadline'] = $deadline;
                $timingData['timeRemaining'] = max(0, $deadline - $now);
                $timingData['isOvertime'] = $deadline < $now;
            }
        }
        
        // Build attempt data
        $attemptData = [
            'id' => $attemptobj->get_attemptid(),
            'quizId' => $attemptobj->get_quizid(),
            'userId' => $attemptobj->get_userid(),
            'attemptNumber' => $attemptobj->get_attempt_number(),
            'state' => $attemptobj->get_state(),
            'stateName' => quiz_attempt_state_name($attemptobj->get_state()),
            'isFinished' => $attemptobj->is_finished(),
            'isPreview' => $attemptobj->is_preview(),
            'currentPage' => $attemptobj->get_currentpage(),
        ];
        
        // Build complete response
        $responseData = [
            'attempt' => $attemptData,
            'questions' => $questionsData,
            'navigation' => $navigationData,
            'displayOptions' => $displayOptionsData,
            'timing' => $timingData,
        ];
        
        // Return success response with questions data
        $this->success($responseData, 200);
    }
    
    /**
     * Handle POST requests.
     *
     * This endpoint does not support POST method as it is read-only.
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown as POST is not supported
     */
    protected function handle_post() {
        throw new MethodNotAllowedException(
            'POST method is not allowed for quiz questions endpoint',
            [
                'allowedMethods' => ['GET'],
                'requestedMethod' => 'POST'
            ]
        );
    }
    
    /**
     * Handle PUT requests.
     *
     * This endpoint does not support PUT method as it is read-only.
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown as PUT is not supported
     */
    protected function handle_put() {
        throw new MethodNotAllowedException(
            'PUT method is not allowed for quiz questions endpoint',
            [
                'allowedMethods' => ['GET'],
                'requestedMethod' => 'PUT'
            ]
        );
    }
    
    /**
     * Handle DELETE requests.
     *
     * This endpoint does not support DELETE method as it is read-only.
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown as DELETE is not supported
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException(
            'DELETE method is not allowed for quiz questions endpoint',
            [
                'allowedMethods' => ['GET'],
                'requestedMethod' => 'DELETE'
            ]
        );
    }
}

// Instantiate and execute the endpoint
$endpoint = new QuizQuestionsEndpoint();
$endpoint->execute();
