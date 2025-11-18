<?php
/**
 * Quiz Attempt Results API Endpoint
 *
 * REST API endpoint for retrieving quiz attempt results and grade information.
 * Implements GET /api/v1/quizzes/attempts/{id} to fetch complete attempt results
 * including grades, feedback, and completion status.
 *
 * This endpoint extends ApiBase for JWT authentication and delegates to existing
 * Moodle quiz functions without duplicating business logic. Returns attempt object
 * with attempt ID, quiz details, user information, grades, feedback, and completion
 * status. Validates user ownership or review permissions.
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Include Moodle configuration and core libraries
require_once(__DIR__ . '/../../../config.php');
require_once($CFG->dirroot . '/mod/quiz/locallib.php');

// Include API base class and exception handling
require_once($CFG->dirroot . '/api/lib/api_base.php');
require_once($CFG->dirroot . '/api/lib/api_exception.php');

/**
 * Quiz Attempt Results Endpoint
 *
 * Handles retrieval of quiz attempt results for authenticated users.
 * Enforces attempt ownership or review permissions. Returns grades,
 * feedback, question summary, and completion information based on
 * quiz display settings.
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class QuizAttemptResultsEndpoint extends ApiBase {
    
    /**
     * Handle GET request for quiz attempt results.
     *
     * Retrieves complete results for a specific quiz attempt including:
     * - Attempt details (state, times, attempt number)
     * - Grade information (raw and scaled grades)
     * - Feedback text based on grade achieved
     * - Question-level results (if display options permit)
     * - Completion status and review availability
     *
     * URL Pattern: GET /api/v1/quizzes/attempts/{attemptid}
     *
     * Permissions Required:
     * - User must own the attempt (is_own_attempt), OR
     * - User must have mod/quiz:viewreports capability, OR
     * - User must have mod/quiz:reviewmyattempts capability
     *
     * @return void Outputs JSON response via success() or error()
     * @throws ValidationException If attempt ID is invalid or missing
     * @throws NotFoundException If attempt does not exist
     * @throws ForbiddenException If user lacks permission to view results
     * @throws ApiException For other server-side errors
     */
    protected function handle_get() {
        global $DB;
        
        // Step 1: Extract attempt ID from URL path
        // Expected pattern: /api/v1/quizzes/attempts/123
        $requestUri = $_SERVER['REQUEST_URI'];
        $matches = [];
        
        if (!preg_match('#/attempts/(\d+)(?:\?.*)?$#', $requestUri, $matches)) {
            throw new ValidationException(
                'Invalid request URL. Expected format: /api/v1/quizzes/attempts/{id}',
                ['url' => $requestUri]
            );
        }
        
        $attemptid = intval($matches[1]);
        
        // Validate attempt ID is a positive integer
        if (!$attemptid || $attemptid <= 0) {
            throw new ValidationException(
                'Invalid or missing attempt ID',
                ['attemptId' => $attemptid]
            );
        }
        
        // Step 2: Load attempt object using existing Moodle function
        // This function creates quiz_attempt object and validates attempt exists
        try {
            $attemptobj = quiz_create_attempt_handling_errors($attemptid);
        } catch (moodle_exception $e) {
            // Convert Moodle exception to API exception
            if ($e->errorcode === 'invalidattemptid' || strpos($e->getMessage(), 'not found') !== false) {
                throw new NotFoundException(
                    'Quiz attempt not found',
                    ['attemptId' => $attemptid, 'error' => $e->getMessage()]
                );
            }
            // Re-throw as generic API exception for other errors
            throw new ApiException(
                500,
                'QUIZ_ERROR',
                'Failed to load quiz attempt: ' . $e->getMessage(),
                ['attemptId' => $attemptid]
            );
        }
        
        // Step 3: Validate permissions to view results
        // Get the authenticated user from JWT token
        $user = $this->getUser();
        $context = $attemptobj->get_context();
        
        // Check if user owns the attempt
        $isOwnAttempt = $attemptobj->is_own_attempt();
        
        // Check if user has capability to view all attempts
        $canViewReports = has_capability('mod/quiz:viewreports', $context);
        
        // Check if user has capability to review their own attempts
        $canReviewOwn = has_capability('mod/quiz:reviewmyattempts', $context);
        
        // Permission denied if user doesn't own attempt and lacks review capabilities
        if (!$isOwnAttempt && !$canViewReports) {
            throw new ForbiddenException(
                'You do not have permission to view this quiz attempt',
                [
                    'attemptId' => $attemptid,
                    'userId' => $user->id,
                    'attemptUserId' => $attemptobj->get_userid(),
                    'requiredCapability' => 'mod/quiz:viewreports'
                ]
            );
        }
        
        // For own attempts, verify review permission if not a teacher/admin
        if ($isOwnAttempt && !$canViewReports && !$canReviewOwn) {
            throw new ForbiddenException(
                'You do not have permission to review your own quiz attempts',
                [
                    'attemptId' => $attemptid,
                    'userId' => $user->id,
                    'requiredCapability' => 'mod/quiz:reviewmyattempts'
                ]
            );
        }
        
        // Step 4: Verify attempt is finished
        // Cannot view results of unfinished attempts
        if (!$attemptobj->is_finished()) {
            throw new BadRequestException(
                'Cannot view results for an unfinished quiz attempt',
                [
                    'attemptId' => $attemptid,
                    'state' => $attemptobj->get_state(),
                    'message' => 'Complete the quiz before viewing results'
                ]
            );
        }
        
        // Step 5: Check if review is allowed based on quiz settings and time
        // This respects quiz review options (e.g., "After quiz is closed")
        $reviewAllowed = $attemptobj->is_review_allowed();
        
        if (!$reviewAllowed && !$canViewReports) {
            // Get display options to determine when review becomes available
            $displayOptions = $attemptobj->get_display_options(false);
            
            throw new ForbiddenException(
                'Review of this quiz attempt is not currently available',
                [
                    'attemptId' => $attemptid,
                    'message' => 'Quiz review is restricted by quiz settings',
                    'reviewAvailability' => $this->getReviewAvailabilityMessage($attemptobj)
                ]
            );
        }
        
        // Step 6: Get display options to determine what information can be shown
        // Parameter true = review mode (shows completed attempt)
        $displayOptions = $attemptobj->get_display_options(true);
        
        // Step 7: Collect attempt results data
        $attempt = $attemptobj->get_attempt();
        $quiz = $attemptobj->get_quiz();
        $course = $attemptobj->get_course();
        $cm = $attemptobj->get_cm();
        
        // Build base attempt data
        $resultsData = [
            'attemptId' => $attempt->id,
            'quizId' => $quiz->id,
            'quizName' => $quiz->name,
            'courseId' => $course->id,
            'courseName' => $course->fullname,
            'userId' => $attempt->userid,
            'attemptNumber' => $attempt->attempt,
            'state' => $attempt->state,
            'stateName' => quiz_attempt_state_name($attempt->state),
            'timeStart' => $attempt->timestart,
            'timeFinish' => $attempt->timefinish,
            'timeTaken' => $attempt->timefinish ? ($attempt->timefinish - $attempt->timestart) : null,
        ];
        
        // Step 8: Add grade information if allowed by display options
        if ($displayOptions->marks >= question_display_options::MARK_AND_MAX) {
            $resultsData['sumGrades'] = $attempt->sumgrades;
            
            // Calculate scaled grade
            if ($quiz->grade && $quiz->sumgrades) {
                $scaledGrade = quiz_rescale_grade($attempt->sumgrades, $quiz, false);
                $resultsData['grade'] = round($scaledGrade, 2);
                $resultsData['maxGrade'] = round($quiz->grade, 2);
                $resultsData['percentage'] = round(($scaledGrade / $quiz->grade) * 100, 2);
            } else {
                $resultsData['grade'] = null;
                $resultsData['maxGrade'] = null;
                $resultsData['percentage'] = null;
            }
        }
        
        // Step 9: Add feedback text if allowed by display options
        if ($displayOptions->overallfeedback && $quiz->grade) {
            // Get final grade for feedback calculation
            $finalGrade = $attemptobj->get_grade();
            
            if ($finalGrade !== null && $finalGrade !== false) {
                $feedback = quiz_feedback_for_grade($finalGrade, $quiz, $context);
                $resultsData['feedback'] = $feedback ? format_text($feedback, FORMAT_HTML) : null;
            } else {
                $resultsData['feedback'] = null;
            }
        }
        
        // Step 10: Add question summary if allowed by display options
        if ($displayOptions->attempt) {
            $resultsData['questions'] = $this->getQuestionSummary($attemptobj, $displayOptions);
        }
        
        // Step 11: Add review availability information
        $resultsData['reviewOptions'] = [
            'canReview' => $reviewAllowed || $canViewReports,
            'showMarks' => $displayOptions->marks >= question_display_options::MARK_AND_MAX,
            'showFeedback' => (bool)$displayOptions->overallfeedback,
            'showQuestions' => (bool)$displayOptions->attempt,
            'showCorrectAnswers' => (bool)$displayOptions->rightanswer,
        ];
        
        // Step 12: Add timing information
        $resultsData['timing'] = [
            'timeLimit' => $quiz->timelimit,
            'timeLimitExceeded' => false,
        ];
        
        if ($quiz->timelimit && $resultsData['timeTaken']) {
            $resultsData['timing']['timeLimitExceeded'] = $resultsData['timeTaken'] > $quiz->timelimit;
        }
        
        // Step 13: Return successful response with attempt results
        $this->success($resultsData, 200);
    }
    
    /**
     * Get summary of questions in the attempt.
     *
     * Extracts question-level information including marks, state,
     * and feedback for each question in the attempt based on
     * display options.
     *
     * @param quiz_attempt $attemptobj Quiz attempt object
     * @param question_display_options $displayOptions Display options for review
     * @return array Array of question summaries
     */
    private function getQuestionSummary($attemptobj, $displayOptions) {
        $questions = [];
        $slots = $attemptobj->get_slots();
        
        foreach ($slots as $slot) {
            $questionData = [
                'slot' => $slot,
                'number' => $attemptobj->get_question_number($slot),
            ];
            
            // Add marks if allowed
            if ($displayOptions->marks >= question_display_options::MARK_AND_MAX) {
                $questionData['mark'] = $attemptobj->get_question_mark($slot);
                $questionData['maxMark'] = $attemptobj->get_question_max_mark($slot);
            }
            
            // Add question state
            $qa = $attemptobj->get_question_attempt($slot);
            if ($qa) {
                $questionData['state'] = $qa->get_state_string(true);
                $questionData['isCorrect'] = $qa->get_state()->is_correct();
                $questionData['isPartiallyCorrect'] = $qa->get_state()->is_partially_correct();
                $questionData['isIncorrect'] = $qa->get_state()->is_incorrect();
            }
            
            $questions[] = $questionData;
        }
        
        return $questions;
    }
    
    /**
     * Get human-readable message about when review becomes available.
     *
     * Provides user-friendly explanation of review restrictions
     * based on quiz settings.
     *
     * @param quiz_attempt $attemptobj Quiz attempt object
     * @return string Review availability message
     */
    private function getReviewAvailabilityMessage($attemptobj) {
        $quiz = $attemptobj->get_quiz();
        $now = time();
        
        // Check various review conditions
        if ($quiz->timeclose && $now < $quiz->timeclose) {
            return 'Review will be available after the quiz closes on ' . 
                   userdate($quiz->timeclose, get_string('strftimedatetime', 'langconfig'));
        }
        
        if ($quiz->timeclose && $now >= $quiz->timeclose) {
            return 'Review is available after quiz closing time';
        }
        
        return 'Review is restricted by quiz settings. Contact your teacher for details.';
    }
}

// Execute the endpoint
$endpoint = new QuizAttemptResultsEndpoint();
$endpoint->execute();
