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
 * REST API endpoint for quiz attempt summary before final submission.
 *
 * Provides GET /api/v1/quizzes/attempts/{id}/summary endpoint that retrieves
 * comprehensive attempt summary including question status, unanswered questions,
 * flagged questions, time remaining, and submission readiness indicators.
 *
 * This endpoint enables React quiz interface to display final review page where
 * students can verify completion status before submitting their attempt. Returns
 * all questions with answered/unanswered/flagged status, warnings about incomplete
 * questions, time remaining if applicable, and submission readiness flags.
 *
 * Delegates to existing Moodle quiz functions without duplicating business logic:
 * - quiz_create_attempt_handling_errors() for attempt object creation
 * - $attemptobj methods for all data retrieval and validation
 * - Existing capability checking via require_capability()
 * - Time expiration handling via handle_if_time_expired()
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

/**
 * Quiz Attempt Summary API Endpoint.
 *
 * Handles GET requests to /api/v1/quizzes/attempts/{id}/summary for retrieving
 * comprehensive attempt summary data before final submission. Returns question
 * status, unanswered questions, flagged questions for review, time remaining,
 * and submission warnings.
 *
 * Authentication: Required via JWT token
 * Authorization: User must own the attempt or have mod/quiz:viewreports capability
 * HTTP Method: GET only
 *
 * Response includes:
 * - attemptId: Attempt identifier
 * - quizId: Quiz identifier
 * - userId: User ID who owns attempt
 * - attemptNumber: Which attempt this is (1, 2, 3, etc.)
 * - state: Current attempt state (inprogress, overdue)
 * - timeStarted: Timestamp when attempt started
 * - timeModified: Timestamp of last modification
 * - timeRemaining: Seconds remaining (null if no time limit)
 * - questions: Array of all questions with status and details
 * - summary: Statistics about answered, unanswered, flagged questions
 * - warnings: Array of warning messages about incomplete work
 * - canSubmit: Boolean indicating if attempt is ready for submission
 * - accessMessages: Any access restriction messages
 *
 * @package    api
 * @subpackage quizzes
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class QuizAttemptSummaryEndpoint extends ApiBase {
    
    /**
     * Handle GET request for quiz attempt summary.
     *
     * Extracts attempt ID from URL path, validates user ownership and capabilities,
     * retrieves attempt data including question status and submission readiness,
     * handles time expiration, and returns formatted summary response.
     *
     * URL Pattern: /api/v1/quizzes/attempts/{id}/summary
     * Example: /api/v1/quizzes/attempts/123/summary
     *
     * @return void Outputs JSON response with attempt summary data
     * @throws ValidationException If attempt ID is invalid or malformed
     * @throws NotFoundException If attempt does not exist
     * @throws ForbiddenException If user does not own attempt or lacks capability
     * @throws ApiException If attempt is already finished (should use review endpoint)
     */
    protected function handle_get() {
        global $USER;
        
        // Validate user is authenticated
        $authenticatedUser = $this->getUser();
        
        // Extract attempt ID from URL path using regex
        // Pattern matches: /attempts/{attemptid}/summary
        if (!preg_match('/\/attempts\/(\d+)\/summary/', $this->requestUri, $matches)) {
            throw new ValidationException('Invalid URL format', [
                'expected' => '/api/v1/quizzes/attempts/{id}/summary',
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
            // This function handles attempt validation and loading
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
        
        // Get context for capability checking
        $context = $attemptobj->get_context();
        
        // Check that this attempt belongs to authenticated user
        // Users with viewreports capability can view any attempt
        $isOwnAttempt = ($attemptobj->get_userid() == $authenticatedUser->id);
        $canViewReports = has_capability('mod/quiz:viewreports', $context, $authenticatedUser->id);
        
        if (!$isOwnAttempt && !$canViewReports) {
            throw new ForbiddenException('You do not have permission to view this attempt', [
                'attemptId' => $attemptid,
                'attemptUserId' => $attemptobj->get_userid(),
                'authenticatedUserId' => $authenticatedUser->id,
                'reason' => 'This attempt belongs to another user'
            ]);
        }
        
        // Check user has capability to attempt quizzes (if not a preview user)
        if (!$attemptobj->is_preview_user()) {
            try {
                $attemptobj->require_capability('mod/quiz:attempt');
            } catch (moodle_exception $e) {
                throw new ForbiddenException('You do not have permission to attempt this quiz', [
                    'capability' => 'mod/quiz:attempt',
                    'contextId' => $context->id,
                    'errorcode' => $e->errorcode
                ]);
            }
        }
        
        // Get display options for summary page
        $displayoptions = $attemptobj->get_display_options(false);
        
        // Handle time expiration - this may change attempt state to overdue
        // The second parameter (true) allows auto-submission if time expired
        $attemptobj->handle_if_time_expired(time(), true);
        
        // Check if attempt is already finished - if so, user should use review endpoint
        if ($attemptobj->is_finished()) {
            throw new ApiException(400, 'ATTEMPT_FINISHED', 'This attempt has already been submitted', [
                'attemptId' => $attemptid,
                'state' => $attemptobj->get_state(),
                'reason' => 'Use the review endpoint to view submitted attempts',
                'reviewUrl' => '/api/v1/quizzes/attempts/' . $attemptid . '/review'
            ]);
        }
        
        // Get access manager to check for any access restrictions
        $accessmanager = $attemptobj->get_access_manager(time());
        
        // Check for access violations that would prevent submission
        $accessmessages = $accessmanager->prevent_access();
        $canSubmit = empty($accessmessages) || $attemptobj->is_preview_user();
        
        // Build questions summary array
        $questions = [];
        $answeredCount = 0;
        $unansweredCount = 0;
        $flaggedCount = 0;
        
        // Iterate through all question slots in the quiz
        $slots = $attemptobj->get_slots();
        
        foreach ($slots as $slot) {
            // Get question attempt for this slot
            $qa = $attemptobj->get_question_attempt($slot);
            
            // Get question state
            $state = $qa->get_state();
            
            // Determine if question is answered
            $isAnswered = !$state->is_unprocessed() && !$state->is_todo();
            $isComplete = $state->is_complete();
            $requiresGrading = $state->is_finished() && !$state->is_graded();
            
            // Check if question is flagged for review
            $isFlagged = $attemptobj->is_question_flagged($slot);
            
            // Get question page number
            $page = $attemptobj->get_question_page($slot);
            
            // Get question number for display
            $questionnumber = $attemptobj->get_question_number($slot);
            
            // Build question summary object
            $questionSummary = [
                'slot' => $slot,
                'page' => $page,
                'questionNumber' => $questionnumber,
                'name' => $qa->get_question()->name,
                'status' => $this->getQuestionStatus($state, $isAnswered, $isComplete, $requiresGrading),
                'answered' => $isAnswered,
                'complete' => $isComplete,
                'requiresGrading' => $requiresGrading,
                'flagged' => $isFlagged,
                'stateName' => (string)$state,
            ];
            
            $questions[] = $questionSummary;
            
            // Update counters
            if ($isAnswered) {
                $answeredCount++;
            } else {
                $unansweredCount++;
            }
            
            if ($isFlagged) {
                $flaggedCount++;
            }
        }
        
        // Calculate time remaining if quiz has time limit
        $timeRemaining = null;
        $timeRemainingDisplay = null;
        
        if ($attemptobj->get_quiz()->timelimit > 0) {
            $timeLeft = $attemptobj->get_time_left_display();
            
            if ($timeLeft !== false) {
                // Time left is in seconds
                $timeRemaining = $timeLeft;
                
                // Format time remaining for display (minutes and seconds)
                if ($timeRemaining > 0) {
                    $minutes = floor($timeRemaining / 60);
                    $seconds = $timeRemaining % 60;
                    $timeRemainingDisplay = sprintf('%d:%02d', $minutes, $seconds);
                } else {
                    $timeRemainingDisplay = '0:00';
                }
            }
        }
        
        // Build warnings array
        $warnings = [];
        
        if ($unansweredCount > 0) {
            $warnings[] = [
                'type' => 'UNANSWERED_QUESTIONS',
                'message' => 'You have ' . $unansweredCount . ' unanswered question' . ($unansweredCount > 1 ? 's' : ''),
                'count' => $unansweredCount,
                'severity' => 'warning'
            ];
        }
        
        if ($flaggedCount > 0) {
            $warnings[] = [
                'type' => 'FLAGGED_QUESTIONS',
                'message' => 'You have flagged ' . $flaggedCount . ' question' . ($flaggedCount > 1 ? 's' : '') . ' for review',
                'count' => $flaggedCount,
                'severity' => 'info'
            ];
        }
        
        if ($timeRemaining !== null && $timeRemaining < 300) {
            // Warn if less than 5 minutes remaining
            $warnings[] = [
                'type' => 'TIME_EXPIRING',
                'message' => 'Less than 5 minutes remaining',
                'timeRemaining' => $timeRemaining,
                'severity' => 'warning'
            ];
        }
        
        if (!$canSubmit && !empty($accessmessages)) {
            foreach ($accessmessages as $message) {
                $warnings[] = [
                    'type' => 'ACCESS_RESTRICTION',
                    'message' => $message,
                    'severity' => 'error'
                ];
            }
        }
        
        // Get summary information from attempt object
        $summaryInfo = $attemptobj->get_summary_information();
        
        // Build complete summary response
        $summaryData = [
            'attemptId' => $attemptobj->get_attemptid(),
            'quizId' => $attemptobj->get_quizid(),
            'courseId' => $attemptobj->get_courseid(),
            'userId' => $attemptobj->get_userid(),
            'attemptNumber' => $attemptobj->get_attempt_number(),
            'state' => $attemptobj->get_state(),
            'timeStarted' => $attemptobj->get_attempt()->timestart,
            'timeModified' => $attemptobj->get_attempt()->timemodified,
            'timeRemaining' => $timeRemaining,
            'timeRemainingDisplay' => $timeRemainingDisplay,
            'hasTimeLimit' => $attemptobj->get_quiz()->timelimit > 0,
            'questions' => $questions,
            'summary' => [
                'totalQuestions' => count($questions),
                'answered' => $answeredCount,
                'unanswered' => $unansweredCount,
                'flagged' => $flaggedCount,
                'percentComplete' => count($questions) > 0 ? round(($answeredCount / count($questions)) * 100) : 0
            ],
            'warnings' => $warnings,
            'canSubmit' => $canSubmit,
            'isPreview' => $attemptobj->is_preview_user(),
            'quiz' => [
                'name' => $attemptobj->get_quiz_name(),
                'intro' => $attemptobj->get_quiz()->intro ?? '',
                'timeLimit' => $attemptobj->get_quiz()->timelimit,
                'gradeMethod' => $attemptobj->get_quiz()->grademethod,
            ],
            'summaryInformation' => $this->formatSummaryInformation($summaryInfo),
        ];
        
        // Return success response with summary data
        $this->success($summaryData, 200);
    }
    
    /**
     * Get human-readable status string for a question.
     *
     * Converts question state and flags into a simple status string
     * suitable for display in the React interface.
     *
     * @param question_state $state Question state object
     * @param bool $isAnswered Whether question has been answered
     * @param bool $isComplete Whether question is complete
     * @param bool $requiresGrading Whether question requires manual grading
     * @return string Status string (e.g., 'answered', 'not_answered', 'complete', 'requires_grading')
     */
    private function getQuestionStatus($state, $isAnswered, $isComplete, $requiresGrading) {
        if ($requiresGrading) {
            return 'requires_grading';
        }
        
        if ($isComplete) {
            return 'complete';
        }
        
        if ($isAnswered) {
            return 'answered';
        }
        
        if ($state->is_todo()) {
            return 'not_answered';
        }
        
        return 'unknown';
    }
    
    /**
     * Format summary information array for API response.
     *
     * Converts Moodle's summary information array (which may contain HTML)
     * into a clean array suitable for JSON serialization. Strips HTML tags
     * and formats data for React consumption.
     *
     * @param array $summaryInfo Summary information from $attemptobj->get_summary_information()
     * @return array Formatted summary information
     */
    private function formatSummaryInformation($summaryInfo) {
        $formatted = [];
        
        foreach ($summaryInfo as $key => $value) {
            // Extract title and content if value is array
            if (is_array($value)) {
                $title = $value['title'] ?? $key;
                $content = $value['content'] ?? '';
            } else {
                $title = $key;
                $content = $value;
            }
            
            // Strip HTML tags from content for API consumption
            $content = strip_tags($content);
            
            $formatted[] = [
                'key' => $key,
                'title' => $title,
                'content' => $content,
            ];
        }
        
        return $formatted;
    }
    
    /**
     * Handle POST requests - not supported for this endpoint.
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown
     */
    protected function handle_post() {
        throw new MethodNotAllowedException('POST method is not supported for summary endpoint', [
            'supportedMethods' => ['GET']
        ]);
    }
    
    /**
     * Handle PUT requests - not supported for this endpoint.
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method is not supported for summary endpoint', [
            'supportedMethods' => ['GET']
        ]);
    }
    
    /**
     * Handle DELETE requests - not supported for this endpoint.
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method is not supported for summary endpoint', [
            'supportedMethods' => ['GET']
        ]);
    }
}

// Instantiate and execute the endpoint
$endpoint = new QuizAttemptSummaryEndpoint();
$endpoint->execute();
