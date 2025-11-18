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
 * REST API endpoint for retrieving quiz attempt history.
 *
 * Provides GET /api/v1/quizzes/{id}/attempts endpoint that retrieves all quiz
 * attempts for the authenticated user. This endpoint enables React quiz interface
 * to display attempt history including grades, completion status, and review
 * availability for each attempt.
 *
 * Delegates to existing Moodle quiz functions without duplicating business logic:
 * - quiz_get_user_attempts() for attempt retrieval
 * - quiz_calculate_best_grade() for grade calculation
 * - quiz_get_grade() for final grade retrieval
 * - require_capability() for permission validation
 *
 * Returns comprehensive attempt history including:
 * - All user attempts with state, timing, and grade information
 * - Overall best grade and final grade for the quiz
 * - Review availability for each attempt based on quiz settings
 * - Indication of which attempt counts toward final grade
 * - Status of current incomplete attempts
 *
 * Teachers and admins can optionally view attempts for specific users by passing
 * userid parameter if they have mod/quiz:viewreports capability.
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
 * Quiz Attempts List API Endpoint.
 *
 * Handles GET requests to /api/v1/quizzes/{id}/attempts for retrieving all
 * attempts for a quiz. Returns attempt history with grades, completion status,
 * and review availability for display in React interface.
 *
 * Authentication: Required via JWT token
 * Authorization: User must have mod/quiz:view or mod/quiz:viewreports capability
 * HTTP Method: GET only
 *
 * Query Parameters:
 * - userid: Optional user ID (requires mod/quiz:viewreports capability)
 * - state: Optional filter by state (finished, inprogress, abandoned, all)
 *
 * Response includes:
 * - attempts: Array of attempt records with details
 * - quiz: Basic quiz information
 * - grading: Overall grade information and grade method
 * - summary: Aggregate statistics (total attempts, best grade, etc.)
 *
 * @package    api
 * @subpackage quizzes
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class QuizAttemptsEndpoint extends ApiBase {
    
    /**
     * Handle GET request for quiz attempts list.
     *
     * Extracts quiz ID from URL path, validates user has permission to view
     * attempts, retrieves all attempts for the user (or specified user if
     * permission allows), calculates grades and review availability, and
     * returns formatted attempt history for display in React interface.
     *
     * URL Pattern: /api/v1/quizzes/{id}/attempts
     * Example: /api/v1/quizzes/42/attempts?userid=123&state=finished
     *
     * @return void Outputs JSON response with attempts list
     * @throws ValidationException If quiz ID is invalid or state filter invalid
     * @throws NotFoundException If quiz does not exist
     * @throws ForbiddenException If user lacks view capability
     * @throws ApiException If attempts cannot be retrieved
     */
    protected function handle_get() {
        global $DB, $USER, $PAGE;
        
        // Validate user is authenticated via JWT token
        $authenticatedUser = $this->getUser();
        
        // Extract quiz ID from URL path using regex
        // Pattern matches: /quizzes/{quizid}/attempts
        if (!preg_match('/\/quizzes\/(\d+)\/attempts$/', $this->requestUri, $matches)) {
            throw new ValidationException('Invalid URL format', [
                'expected' => '/api/v1/quizzes/{id}/attempts',
                'received' => $this->requestUri,
                'reason' => 'Quiz ID must be specified in URL path'
            ]);
        }
        
        $quizid = (int)$matches[1];
        
        // Validate quiz ID is positive integer
        if ($quizid <= 0) {
            throw new ValidationException('Invalid quiz ID', [
                'quizId' => $quizid,
                'reason' => 'Quiz ID must be a positive integer'
            ]);
        }
        
        // Parse query parameters
        $requestedUserId = isset($_GET['userid']) ? (int)$_GET['userid'] : null;
        $stateFilter = isset($_GET['state']) ? $_GET['state'] : 'all';
        
        // Validate state filter
        $validStates = ['all', 'finished', 'inprogress', 'abandoned', 'unfinished'];
        if (!in_array($stateFilter, $validStates)) {
            throw new ValidationException('Invalid state filter', [
                'state' => $stateFilter,
                'validStates' => $validStates,
                'reason' => 'State must be one of: ' . implode(', ', $validStates)
            ]);
        }
        
        // Retrieve quiz record from database
        $quiz = $DB->get_record('quiz', ['id' => $quizid]);
        
        if (!$quiz) {
            throw new NotFoundException('Quiz not found', [
                'quizId' => $quizid,
                'reason' => 'No quiz exists with this ID'
            ]);
        }
        
        // Get course module for context
        $cm = get_coursemodule_from_instance('quiz', $quiz->id, $quiz->course);
        
        if (!$cm) {
            throw new NotFoundException('Course module not found', [
                'quizId' => $quizid,
                'reason' => 'Quiz course module could not be loaded'
            ]);
        }
        
        // Get course record
        $course = $DB->get_record('course', ['id' => $quiz->course], '*', MUST_EXIST);
        
        // Get context for capability checking
        $context = context_module::instance($cm->id);
        
        // Determine which user's attempts to retrieve
        $targetUserId = $USER->id;
        
        if ($requestedUserId && $requestedUserId != $USER->id) {
            // User is requesting another user's attempts - check permission
            if (!has_capability('mod/quiz:viewreports', $context)) {
                throw new ForbiddenException('You do not have permission to view other users\' attempts', [
                    'quizId' => $quizid,
                    'capability' => 'mod/quiz:viewreports',
                    'reason' => 'Only users with viewreports capability can view other users\' attempts'
                ]);
            }
            $targetUserId = $requestedUserId;
        } else {
            // Viewing own attempts - check basic view capability
            try {
                require_capability('mod/quiz:view', $context);
            } catch (moodle_exception $e) {
                throw new ForbiddenException('You do not have permission to view this quiz', [
                    'quizId' => $quizid,
                    'capability' => 'mod/quiz:view',
                    'reason' => $e->getMessage()
                ]);
            }
        }
        
        // Set up page context for Moodle functions
        $PAGE->set_context($context);
        
        // Retrieve user attempts using existing Moodle function
        try {
            $attempts = quiz_get_user_attempts($quiz->id, $targetUserId, $stateFilter, true);
        } catch (moodle_exception $e) {
            throw new ApiException('Failed to retrieve quiz attempts', [
                'quizId' => $quizid,
                'userId' => $targetUserId,
                'reason' => $e->getMessage()
            ], 500);
        }
        
        // Get user's final grade for this quiz
        $finalGrade = quiz_get_best_grade($quiz, $targetUserId);
        
        // Build attempts array with detailed information
        $attemptsData = [];
        
        foreach ($attempts as $attempt) {
            // Create attempt object for accessing display options
            try {
                $attemptobj = quiz_create_attempt_handling_errors($attempt->id, $cm->id);
                $displayoptions = $attemptobj->get_display_options(true);
            } catch (moodle_exception $e) {
                // If we can't load attempt object, skip this attempt
                continue;
            }
            
            // Calculate grade for this attempt
            $attemptGrade = null;
            if ($attempt->state == quiz_attempt::FINISHED) {
                $attemptGrade = quiz_rescale_grade($attempt->sumgrades, $quiz, false);
            }
            
            // Determine if this attempt can be reviewed
            $canReview = $attemptobj->is_review_allowed();
            
            // Determine if this attempt counts toward final grade
            $countsTowardGrade = false;
            if ($finalGrade !== null && $attemptGrade !== null) {
                switch ($quiz->grademethod) {
                    case QUIZ_ATTEMPTFIRST:
                        $countsTowardGrade = ($attempt->attempt == 1);
                        break;
                    case QUIZ_ATTEMPTLAST:
                        $countsTowardGrade = ($attempt->id == end($attempts)->id);
                        break;
                    case QUIZ_GRADEHIGHEST:
                        $countsTowardGrade = abs($attemptGrade - $finalGrade) < 0.001;
                        break;
                    case QUIZ_GRADEAVERAGE:
                        // All attempts count toward average
                        $countsTowardGrade = true;
                        break;
                }
            }
            
            // Build attempt data
            $attemptData = [
                'id' => $attempt->id,
                'attemptNumber' => $attempt->attempt,
                'state' => $attempt->state,
                'stateName' => quiz_attempt_state_name($attempt->state),
                'timeStart' => $attempt->timestart,
                'timeFinish' => $attempt->timefinish,
                'timeTaken' => $attempt->timefinish ? ($attempt->timefinish - $attempt->timestart) : null,
                'sumGrades' => $attempt->sumgrades !== null ? (float)$attempt->sumgrades : null,
                'grade' => $attemptGrade,
                'gradedScore' => $attemptGrade !== null ? round($attemptGrade, 2) : null,
                'canReview' => $canReview,
                'countsTowardGrade' => $countsTowardGrade,
                'isFinished' => $attempt->state == quiz_attempt::FINISHED,
                'isInProgress' => $attempt->state == quiz_attempt::IN_PROGRESS,
                'isOverdue' => $attempt->state == quiz_attempt::OVERDUE,
                'isAbandoned' => $attempt->state == quiz_attempt::ABANDONED,
            ];
            
            // Add review options if available
            if ($canReview) {
                $attemptData['reviewOptions'] = [
                    'marks' => $displayoptions->marks == question_display_options::VISIBLE,
                    'correctness' => $displayoptions->correctness == question_display_options::VISIBLE,
                    'feedback' => $displayoptions->feedback == question_display_options::VISIBLE,
                    'rightAnswer' => $displayoptions->rightanswer == question_display_options::VISIBLE,
                    'overallFeedback' => $displayoptions->overallfeedback == question_display_options::VISIBLE,
                ];
            }
            
            // Add feedback if available
            if ($attempt->state == quiz_attempt::FINISHED && $displayoptions->overallfeedback) {
                $feedback = quiz_feedback_for_grade($attemptGrade, $quiz, $context);
                if ($feedback) {
                    $attemptData['feedback'] = [
                        'text' => format_text($feedback->feedbacktext, $feedback->feedbacktextformat, ['context' => $context]),
                        'format' => $feedback->feedbacktextformat,
                    ];
                }
            }
            
            $attemptsData[] = $attemptData;
        }
        
        // Calculate summary statistics
        $finishedAttempts = array_filter($attemptsData, function($a) {
            return $a['isFinished'];
        });
        
        $grades = array_filter(array_column($finishedAttempts, 'grade'), function($g) {
            return $g !== null;
        });
        
        $summary = [
            'totalAttempts' => count($attemptsData),
            'finishedAttempts' => count($finishedAttempts),
            'inProgressAttempts' => count(array_filter($attemptsData, function($a) {
                return $a['isInProgress'];
            })),
            'bestGrade' => !empty($grades) ? max($grades) : null,
            'averageGrade' => !empty($grades) ? array_sum($grades) / count($grades) : null,
            'finalGrade' => $finalGrade !== null ? round($finalGrade, 2) : null,
        ];
        
        // Build response data
        $responseData = [
            'quiz' => [
                'id' => $quiz->id,
                'name' => format_string($quiz->name),
                'courseId' => $quiz->course,
                'attemptsAllowed' => $quiz->attempts ? (int)$quiz->attempts : null,
                'unlimited' => $quiz->attempts == 0,
                'gradeMethod' => (int)$quiz->grademethod,
                'gradeMethodName' => $this->getGradeMethodName($quiz->grademethod),
            ],
            'user' => [
                'id' => $targetUserId,
                'isCurrentUser' => $targetUserId == $USER->id,
            ],
            'attempts' => $attemptsData,
            'summary' => $summary,
        ];
        
        // Return success response with attempts data
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
            'POST method is not allowed for quiz attempts list endpoint',
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
            'PUT method is not allowed for quiz attempts list endpoint',
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
            'DELETE method is not allowed for quiz attempts list endpoint',
            [
                'allowedMethods' => ['GET'],
                'requestedMethod' => 'DELETE'
            ]
        );
    }
    
    /**
     * Get human-readable name for grade method.
     *
     * Converts numeric grade method code to descriptive name.
     *
     * @param int $method Grade method code
     * @return string Grade method name
     */
    private function getGradeMethodName($method) {
        switch ($method) {
            case QUIZ_ATTEMPTFIRST:
                return 'First attempt';
            case QUIZ_ATTEMPTLAST:
                return 'Last attempt';
            case QUIZ_GRADEAVERAGE:
                return 'Average of attempts';
            case QUIZ_GRADEHIGHEST:
                return 'Highest attempt';
            default:
                return 'Unknown';
        }
    }
}

// Instantiate and execute the endpoint
$endpoint = new QuizAttemptsEndpoint();
$endpoint->execute();
