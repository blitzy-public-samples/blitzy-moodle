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
 * REST API endpoint for reviewing completed quiz attempts with detailed feedback.
 *
 * Provides GET /api/v1/quizzes/attempts/{id}/review endpoint that retrieves
 * comprehensive attempt review including questions, user responses, correct answers,
 * marks, and feedback based on quiz review options. This endpoint enables React
 * quiz interface to display detailed post-attempt review where students can see
 * what they answered, understand correct answers, view feedback, and learn from
 * their performance.
 *
 * Delegates to existing Moodle quiz functions without duplicating business logic:
 * - quiz_create_attempt_handling_errors() for attempt object creation
 * - $attemptobj->check_review_capability() for permission validation
 * - $attemptobj->get_display_options(true) for review option enforcement
 * - attempt_summary_information::create_for_attempt() for summary data
 * - question_usage_by_attempt methods for question-level data retrieval
 *
 * Review display is controlled by quiz review options which determine what
 * students can see and when (immediately after attempt, later, never). This
 * endpoint respects all existing review option configurations including timing
 * restrictions and permission-based display rules.
 *
 * @package    api
 * @subpackage quizzes
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Load Moodle configuration and quiz libraries
require_once(__DIR__ . '/../../../config.php');
require_once($CFG->dirroot . '/mod/quiz/locallib.php');

// Load API base classes
require_once(__DIR__ . '/../../lib/api_base.php');
require_once(__DIR__ . '/../../lib/api_exception.php');

// Use attempt summary information output class
use mod_quiz\output\attempt_summary_information;

/**
 * Quiz Attempt Review API Endpoint.
 *
 * Handles GET requests to /api/v1/quizzes/attempts/{id}/review for retrieving
 * comprehensive review data for completed quiz attempts. Returns detailed
 * question-by-question feedback including user responses, correct answers,
 * marks awarded, and all configured feedback text based on quiz review options.
 *
 * Authentication: Required via JWT token
 * Authorization: User must own the attempt and have mod/quiz:reviewmyattempts capability
 *                OR have mod/quiz:viewreports capability to review any attempt
 * HTTP Method: GET only
 *
 * Query Parameters:
 * - page: Optional page number for paginated question display (default: 0)
 * - showall: Optional boolean to show all questions on one page (default: false)
 *
 * Response includes:
 * - attemptInfo: Basic attempt identification and timing information
 * - quizInfo: Quiz settings and configuration relevant to review
 * - summaryData: High-level attempt summary including grade and feedback
 * - questions: Array of questions with detailed review information per question
 * - displayOptions: What information is allowed to be displayed based on review settings
 * - navigation: Page navigation information for multi-page quizzes
 *
 * Each question includes (based on display options):
 * - slot: Question slot number
 * - questionNumber: Display number for the question
 * - questionText: The question text and any associated media
 * - questionType: Type of question (multichoice, truefalse, essay, etc.)
 * - userAnswer: The student's submitted answer
 * - correctAnswer: The correct answer (if display options allow)
 * - marks: Marks awarded for this question
 * - maxMarks: Maximum possible marks
 * - fraction: Fraction of max marks earned (0.0 to 1.0)
 * - isCorrect: Boolean indicating if answer was correct
 * - isPartiallyCorrect: Boolean indicating if answer was partially correct
 * - generalFeedback: General feedback shown for all answers
 * - combinedFeedback: State-dependent feedback (correct/partially correct/incorrect)
 * - feedbackClass: The feedback class from state (correct, partiallycorrect, incorrect)
 * - manualComment: Teacher's manual comment/feedback if graded
 * - flagged: Whether student flagged this question during attempt
 *
 * @package    api
 * @subpackage quizzes
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class QuizAttemptReviewEndpoint extends ApiBase {
    
    /**
     * Handle GET request for quiz attempt review.
     *
     * Extracts attempt ID from URL path, validates user ownership and review
     * capabilities, retrieves comprehensive attempt review data including all
     * questions with detailed feedback, and returns formatted review response
     * respecting all quiz review option settings and timing restrictions.
     *
     * URL Pattern: /api/v1/quizzes/attempts/{id}/review
     * Example: /api/v1/quizzes/attempts/123/review?page=0&showall=false
     *
     * The endpoint enforces all review timing restrictions configured in the quiz:
     * - Immediately after: Review available right after attempt submission
     * - Later while open: Review available after quiz close time
     * - After quiz close: Review available only after quiz closes
     * - Never: Review never available
     *
     * @return void Outputs JSON response with comprehensive review data
     * @throws ValidationException If attempt ID is invalid or malformed
     * @throws NotFoundException If attempt does not exist
     * @throws ForbiddenException If user lacks review capability or timing not met
     * @throws ApiException If attempt is not finished (use summary endpoint instead)
     */
    protected function handle_get() {
        global $DB, $USER;
        
        // Validate user is authenticated via JWT token
        $authenticatedUser = $this->getUser();
        
        // Extract attempt ID from URL path using regex
        // Pattern matches: /attempts/{attemptid}/review
        if (!preg_match('/\/attempts\/(\d+)\/review/', $this->requestUri, $matches)) {
            throw new ValidationException('Invalid URL format', [
                'expected' => '/api/v1/quizzes/attempts/{id}/review',
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
        
        try {
            // Create attempt object using existing Moodle function
            // This function validates attempt exists and loads all necessary data
            $attemptobj = quiz_create_attempt_handling_errors($attemptid);
            
        } catch (moodle_exception $e) {
            // Convert Moodle exception to API exception
            if ($e->errorcode === 'invalidattemptid' || $e->errorcode === 'noattemptfound') {
                throw new NotFoundException("Quiz attempt not found", [
                    'attemptId' => $attemptid,
                    'errorcode' => $e->errorcode
                ]);
            }
            
            // Re-throw other Moodle exceptions as API exceptions
            throw new ApiException(500, 'QUIZ_ERROR', $e->getMessage(), [
                'attemptId' => $attemptid,
                'errorcode' => $e->errorcode
            ]);
        }
        
        // Preload all user data for efficiency
        // This loads all user information for step authors in one query
        $attemptobj->preload_all_attempt_step_users();
        
        // Get context for capability checking
        $context = $attemptobj->get_context();
        
        // Check review capability
        // This validates user owns attempt and has mod/quiz:reviewmyattempts
        // OR has mod/quiz:viewreports capability to review any attempt
        try {
            $attemptobj->check_review_capability();
        } catch (moodle_exception $e) {
            throw new ForbiddenException('You do not have permission to review this attempt', [
                'attemptId' => $attemptid,
                'capability' => 'mod/quiz:reviewmyattempts',
                'errorcode' => $e->errorcode,
                'reason' => $e->getMessage()
            ]);
        }
        
        // Validate attempt is finished - review is only for completed attempts
        if (!$attemptobj->is_finished()) {
            throw new ApiException(400, 'ATTEMPT_NOT_FINISHED', 'Cannot review attempt that is not finished', [
                'attemptId' => $attemptid,
                'state' => $attemptobj->get_state(),
                'reason' => 'Use the summary endpoint for in-progress attempts',
                'summaryUrl' => '/api/v1/quizzes/attempts/' . $attemptid . '/summary'
            ]);
        }
        
        // Get display options for review
        // Pass true to indicate we're reviewing (not during attempt)
        // This determines what can be shown based on quiz review settings and timing
        $options = $attemptobj->get_display_options(true);
        
        // Check if review is currently allowed based on timing settings
        if (!$options->attempt) {
            throw new ForbiddenException('Review is not currently available for this attempt', [
                'attemptId' => $attemptid,
                'reason' => 'Quiz review settings do not allow review at this time',
                'reviewTiming' => 'Check quiz review options configuration'
            ]);
        }
        
        // Extract optional query parameters
        $page = $this->getParam('page', 0);
        $showall = $this->getParam('showall', false);
        
        // Validate page parameter
        $page = max(0, (int)$page);
        $showall = filter_var($showall, FILTER_VALIDATE_BOOLEAN);
        
        // Get quiz and attempt data
        $quiz = $attemptobj->get_quiz();
        $attempt = $attemptobj->get_attempt();
        
        // Get attempt summary information using Moodle output class
        // This provides high-level summary including grade and feedback
        $summarydata = attempt_summary_information::create_for_attempt($attemptobj, $options, $page, $showall);
        
        // Build attempt information object
        $attemptInfo = [
            'id' => $attempt->id,
            'quizId' => $quiz->id,
            'userId' => $attempt->userid,
            'attemptNumber' => $attempt->attempt,
            'state' => $attemptobj->get_state(),
            'timeStart' => $attempt->timestart,
            'timeFinish' => $attempt->timefinish,
            'timeModified' => $attempt->timemodified,
            'sumGrades' => $attempt->sumgrades,
        ];
        
        // Build quiz information object
        $quizInfo = [
            'id' => $quiz->id,
            'name' => format_string($quiz->name),
            'intro' => format_text($quiz->intro, $quiz->introformat),
            'grade' => $quiz->grade,
            'gradeMethod' => $quiz->grademethod,
            'timeLimit' => $quiz->timelimit,
            'attempts' => $quiz->attempts,
        ];
        
        // Convert summary data export to array format
        $summaryArray = [];
        if ($summarydata && method_exists($summarydata, 'export_for_template')) {
            $summaryExport = $summarydata->export_for_template(new \renderer_base());
            
            // Extract key summary fields
            if (isset($summaryExport->summarydata)) {
                foreach ($summaryExport->summarydata as $key => $value) {
                    $summaryArray[$key] = $value;
                }
            }
        }
        
        // Determine which slots to display
        if ($showall) {
            $slots = $attemptobj->get_slots();
            $lastpage = true;
            $currentPage = null;
        } else {
            $slots = $attemptobj->get_slots($page);
            $lastpage = $attemptobj->is_last_page($page);
            $currentPage = $page;
        }
        
        // Build questions array with detailed review information
        $questions = [];
        
        foreach ($slots as $slot) {
            // Get question attempt object for this slot
            $qa = $attemptobj->get_question_attempt($slot);
            
            // Get question object
            $question = $qa->get_question();
            
            // Get question state
            $state = $qa->get_state();
            
            // Get question number for display
            $questionnumber = $attemptobj->get_question_number($slot);
            
            // Get marks information
            $maxmark = $qa->get_max_mark();
            $mark = $qa->get_mark();
            $fraction = $qa->get_fraction();
            
            // Determine correctness
            $isCorrect = false;
            $isPartiallyCorrect = false;
            
            if ($fraction !== null) {
                if ($fraction >= 0.999) {
                    $isCorrect = true;
                } else if ($fraction > 0) {
                    $isPartiallyCorrect = true;
                }
            }
            
            // Build question review object
            // Each field is only included if display options allow it
            $questionReview = [
                'slot' => $slot,
                'questionNumber' => $questionnumber,
                'questionType' => $question->get_type_name(),
                'name' => $question->name,
                'page' => $attemptobj->get_question_page($slot),
                'flagged' => $attemptobj->is_question_flagged($slot),
                'state' => (string)$state,
            ];
            
            // Add question text if display options allow
            if ($options->question) {
                $questionReview['questionText'] = $question->questiontext;
                $questionReview['questionTextFormat'] = $question->questiontextformat;
            }
            
            // Add marks information if display options allow
            if ($options->marks >= question_display_options::MARK_AND_MAX) {
                $questionReview['marks'] = $mark;
                $questionReview['maxMarks'] = $maxmark;
                $questionReview['fraction'] = $fraction;
                $questionReview['isCorrect'] = $isCorrect;
                $questionReview['isPartiallyCorrect'] = $isPartiallyCorrect;
            } else if ($options->marks == question_display_options::MAX_ONLY) {
                $questionReview['maxMarks'] = $maxmark;
            }
            
            // Add user's response if display options allow
            if ($options->response) {
                // Get response summary (formatted text representation of answer)
                $responseSummary = $qa->get_response_summary();
                $questionReview['userAnswer'] = $responseSummary;
            }
            
            // Add correct answer if display options allow
            if ($options->rightanswer) {
                $rightAnswer = $qa->get_right_answer_summary();
                $questionReview['correctAnswer'] = $rightAnswer;
            }
            
            // Add general feedback if display options allow
            if ($options->generalfeedback) {
                $generalFeedback = $question->generalfeedback;
                if ($generalFeedback) {
                    $questionReview['generalFeedback'] = format_text(
                        $generalFeedback,
                        $question->generalfeedbackformat
                    );
                }
            }
            
            // Add combined feedback if display options allow
            // Combined feedback is state-dependent (correct/partially correct/incorrect)
            if ($options->feedback) {
                // Get feedback class from state (e.g., 'correct', 'partiallycorrect', 'incorrect')
                $feedbackClass = $state->get_feedback_class();
                
                // Access the appropriate feedback property on question based on state
                // E.g., for 'correct' state, access $question->correctfeedback
                $feedbackProperty = $feedbackClass . 'feedback';
                $formatProperty = $feedbackClass . 'feedbackformat';
                
                if (property_exists($question, $feedbackProperty)) {
                    $combinedFeedback = $question->$feedbackProperty;
                    $combinedFeedbackFormat = property_exists($question, $formatProperty) 
                        ? $question->$formatProperty 
                        : FORMAT_HTML;
                    
                    if ($combinedFeedback) {
                        $questionReview['combinedFeedback'] = format_text(
                            $combinedFeedback,
                            $combinedFeedbackFormat
                        );
                        $questionReview['feedbackClass'] = $feedbackClass;
                    }
                }
                
                // Also include manual comment if present
                $manualComment = $qa->get_manual_comment();
                if ($manualComment) {
                    list($commentText, $commentFormat) = $manualComment;
                    $questionReview['manualComment'] = format_text($commentText, $commentFormat);
                }
            }
            
            // Add correctness indicator if display options allow
            if ($options->correctness) {
                $questionReview['correctness'] = [
                    'isCorrect' => $isCorrect,
                    'isPartiallyCorrect' => $isPartiallyCorrect,
                    'fraction' => $fraction,
                ];
            }
            
            $questions[] = $questionReview;
        }
        
        // Build display options object for client to understand what's visible
        $displayOptionsArray = [
            'attempt' => (bool)$options->attempt,
            'correctness' => (bool)$options->correctness,
            'marks' => $options->marks,
            'specificfeedback' => (bool)$options->feedback,
            'generalfeedback' => (bool)$options->generalfeedback,
            'rightanswer' => (bool)$options->rightanswer,
            'overallfeedback' => (bool)$options->overallfeedback,
            'response' => (bool)$options->response,
            'manualcomment' => (bool)$options->manualcomment,
        ];
        
        // Build navigation information
        $navigation = [
            'currentPage' => $currentPage,
            'showAll' => $showall,
            'totalQuestions' => count($attemptobj->get_slots()),
            'questionsOnPage' => count($slots),
            'isLastPage' => $lastpage,
        ];
        
        // Build complete review response
        $reviewData = [
            'attemptInfo' => $attemptInfo,
            'quizInfo' => $quizInfo,
            'summaryData' => $summaryArray,
            'questions' => $questions,
            'displayOptions' => $displayOptionsArray,
            'navigation' => $navigation,
        ];
        
        // Return success response with review data
        $this->success($reviewData, 200);
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
            'POST method is not allowed for quiz attempt review endpoint',
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
            'PUT method is not allowed for quiz attempt review endpoint',
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
            'DELETE method is not allowed for quiz attempt review endpoint',
            [
                'allowedMethods' => ['GET'],
                'requestedMethod' => 'DELETE'
            ]
        );
    }
}

// Instantiate and execute the endpoint
$endpoint = new QuizAttemptReviewEndpoint();
$endpoint->execute();
