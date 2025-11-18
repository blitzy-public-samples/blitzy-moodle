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
 * REST API endpoint for creating new quiz attempts.
 *
 * Implements POST /api/v1/quizzes/{id}/attempt to start a new quiz attempt
 * with proper validation and initialization. Delegates to existing Moodle
 * quiz functions without duplicating business logic.
 *
 * Key responsibilities:
 * - JWT authentication via ApiBase
 * - Extract and validate quiz ID from URL path
 * - Check mod/quiz:attempt capability
 * - Validate attempt limits and access restrictions
 * - Create attempt record and initialize question usage
 * - Return attempt object with 201 Created status
 *
 * Access restrictions validated:
 * - Attempt limits (quiz->attempts setting)
 * - Time windows (quiz open/close times)
 * - Password requirements
 * - IP address restrictions
 * - Unfinished attempt checks
 *
 * @package    api
 * @subpackage v1
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Load Moodle configuration and core libraries
require_once(__DIR__ . '/../../../config.php');
require_once($CFG->dirroot . '/mod/quiz/locallib.php');
require_once($CFG->libdir . '/questionlib.php');

// Load API base class and exceptions
require_once(__DIR__ . '/../../lib/api_base.php');
require_once(__DIR__ . '/../../lib/api_exception.php');

// Use quiz classes
use mod_quiz\quiz_settings;
use mod_quiz\quiz_attempt;
use mod_quiz\access_manager;

/**
 * Quiz Attempt Creation Endpoint
 *
 * Handles POST requests to create new quiz attempts for authenticated users.
 * Extends ApiBase to leverage JWT authentication, capability checking, and
 * standardized error handling. Delegates all business logic to existing
 * Moodle quiz functions.
 */
class QuizAttemptCreateEndpoint extends ApiBase {
    
    /**
     * Handle POST request to create a new quiz attempt.
     *
     * Workflow:
     * 1. Extract and validate quiz ID from URL
     * 2. Load quiz settings and context
     * 3. Check mod/quiz:attempt capability
     * 4. Create access manager and check restrictions
     * 5. Validate attempt limits
     * 6. Check for unfinished attempts
     * 7. Create new attempt via quiz_prepare_and_start_new_attempt()
     * 8. Return attempt object with 201 Created
     *
     * @return void Outputs JSON response directly
     * @throws ValidationException If quiz ID is invalid
     * @throws NotFoundException If quiz doesn't exist
     * @throws ForbiddenException If user lacks permission or access is denied
     * @throws ServerException If attempt creation fails
     */
    protected function handle_post() {
        global $DB, $USER;
        
        // Get authenticated user from JWT token
        $user = $this->getUser();
        
        // Set global USER for Moodle functions
        $USER = $user;
        
        // Extract quiz ID from URL path (/api/v1/quizzes/{id}/attempt)
        $quizid = $this->extractQuizIdFromUrl();
        
        // Validate quiz ID is positive integer
        if (!$quizid || $quizid <= 0) {
            throw new ValidationException('Invalid or missing quiz ID', [
                'quizId' => $quizid,
                'reason' => 'Quiz ID must be a positive integer'
            ]);
        }
        
        try {
            // Create quiz settings object (validates quiz exists)
            $quizobj = quiz_settings::create($quizid, $user->id);
            
        } catch (moodle_exception $e) {
            // Quiz not found or user doesn't have basic access
            throw new NotFoundException("Quiz not found: {$e->getMessage()}", [
                'quizId' => $quizid,
                'errorcode' => $e->errorcode ?? 'quiznotfound'
            ]);
        }
        
        // Get quiz and context
        $quiz = $quizobj->get_quiz();
        $context = $quizobj->get_context();
        
        // Check if user has permission to attempt this quiz
        try {
            $this->checkCapability('mod/quiz:attempt', $context);
            
        } catch (ForbiddenException $e) {
            // Re-throw with quiz-specific context
            throw new ForbiddenException('You do not have permission to attempt this quiz', [
                'quizId' => $quizid,
                'capability' => 'mod/quiz:attempt',
                'userId' => $user->id,
                'contextId' => $context->id
            ]);
        }
        
        // Check if quiz has questions
        if (!$quizobj->has_questions()) {
            throw new ValidationException('Cannot start quiz with no questions', [
                'quizId' => $quizid,
                'reason' => 'Quiz must have at least one question before attempts can be started'
            ]);
        }
        
        // Create access manager to check restrictions
        $timenow = time();
        
        // Check if user can ignore time limits (for teachers/admins)
        $canignorelimits = has_capability('mod/quiz:ignoretimelimits', $context, $user->id);
        
        // Get access manager
        $accessmanager = $quizobj->get_access_manager($timenow);
        
        // Get all existing attempts for this user
        $attempts = quiz_get_user_attempts($quizid, $user->id, 'all', true);
        $lastattempt = end($attempts);
        
        // Reset array pointer
        if ($lastattempt !== false) {
            reset($attempts);
        } else {
            $lastattempt = false;
        }
        
        // Check if user has an unfinished attempt
        if ($lastattempt && in_array($lastattempt->state, [
            quiz_attempt::NOT_STARTED,
            quiz_attempt::IN_PROGRESS,
            quiz_attempt::OVERDUE
        ])) {
            // User has an unfinished attempt - must complete or abandon it first
            throw new ValidationException('You have an unfinished attempt that must be completed first', [
                'quizId' => $quizid,
                'attemptId' => $lastattempt->id,
                'attemptState' => $lastattempt->state,
                'reason' => 'Complete or abandon the current attempt before starting a new one'
            ]);
        }
        
        // Filter out preview attempts to get real attempt count
        $realattempts = [];
        foreach ($attempts as $attempt) {
            if (!$attempt->preview) {
                $realattempts[] = $attempt;
            }
        }
        
        // Determine next attempt number
        if ($lastattempt && !$lastattempt->preview) {
            $attemptnumber = $lastattempt->attempt + 1;
        } else {
            // Find the last non-preview attempt
            $lastreal = false;
            foreach ($realattempts as $attempt) {
                if (!$attempt->preview) {
                    $lastreal = $attempt;
                }
            }
            
            if ($lastreal) {
                $attemptnumber = $lastreal->attempt + 1;
                $lastattempt = $lastreal;
            } else {
                $attemptnumber = 1;
                $lastattempt = false;
            }
        }
        
        // Check access restrictions using access manager
        $messages = $accessmanager->prevent_access();
        
        if ($messages) {
            // Access is denied - collect all restriction messages
            $reasons = [];
            foreach ($messages as $message) {
                $reasons[] = $message;
            }
            
            throw new ForbiddenException('Access to this quiz is restricted', [
                'quizId' => $quizid,
                'reasons' => $reasons,
                'timeNow' => $timenow,
                'quizOpen' => $quiz->timeopen ?? null,
                'quizClose' => $quiz->timeclose ?? null
            ]);
        }
        
        // Check if user can start a new attempt
        $messages = $accessmanager->prevent_new_attempt(count($realattempts), $lastattempt);
        
        if ($messages) {
            // Cannot start new attempt - collect all restriction messages
            $reasons = [];
            foreach ($messages as $message) {
                $reasons[] = $message;
            }
            
            // Determine if this is an attempt limit issue
            $isAttemptLimit = false;
            if ($quiz->attempts > 0 && count($realattempts) >= $quiz->attempts) {
                $isAttemptLimit = true;
            }
            
            throw new ForbiddenException(
                $isAttemptLimit 
                    ? 'You have reached the maximum number of attempts for this quiz'
                    : 'Cannot start a new quiz attempt',
                [
                    'quizId' => $quizid,
                    'reasons' => $reasons,
                    'attemptCount' => count($realattempts),
                    'attemptLimit' => $quiz->attempts > 0 ? $quiz->attempts : 'unlimited',
                    'isAttemptLimitReached' => $isAttemptLimit
                ]
            );
        }
        
        // All validations passed - create the new attempt
        try {
            // Use quiz_prepare_and_start_new_attempt to handle all the complexity
            // This function will:
            // - Delete any previous preview attempts
            // - Create question usage object
            // - Create attempt record
            // - Initialize questions and question sequence
            // - Apply quiz settings (shuffle, etc.)
            // - Save attempt and question states to database
            $attempt = quiz_prepare_and_start_new_attempt(
                $quizobj,
                $attemptnumber,
                $lastattempt,
                false,  // Not an offline attempt
                [],     // No forced random questions (for API, use default random selection)
                [],     // No forced variants (for API, use default variant selection)
                $user->id
            );
            
        } catch (moodle_exception $e) {
            // Attempt creation failed - wrap in ServerException
            throw new ServerException("Failed to create quiz attempt: {$e->getMessage()}", [
                'quizId' => $quizid,
                'userId' => $user->id,
                'attemptNumber' => $attemptnumber,
                'errorcode' => $e->errorcode ?? 'attemptcreatefailed',
                'originalError' => $e->getMessage()
            ]);
            
        } catch (Exception $e) {
            // Unexpected error during attempt creation
            throw new ServerException("Unexpected error creating quiz attempt: {$e->getMessage()}", [
                'quizId' => $quizid,
                'userId' => $user->id,
                'attemptNumber' => $attemptnumber,
                'originalError' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine()
            ]);
        }
        
        // Prepare response data
        $responseData = [
            'attemptId' => $attempt->id,
            'quizId' => $attempt->quiz,
            'userId' => $attempt->userid,
            'attemptNumber' => $attempt->attempt,
            'timeStart' => $attempt->timestart,
            'timeModified' => $attempt->timemodified,
            'currentPage' => $attempt->currentpage,
            'state' => $attempt->state,
            'preview' => (bool)$attempt->preview,
            'layout' => $attempt->layout,
            'uniqueId' => $attempt->uniqueid
        ];
        
        // Add time limit information if applicable
        if ($quiz->timelimit > 0) {
            $responseData['timeLimit'] = $quiz->timelimit;
            $responseData['timeEnd'] = $attempt->timestart + $quiz->timelimit;
        }
        
        // Add metadata about the quiz
        $responseData['quizInfo'] = [
            'name' => $quiz->name,
            'intro' => format_string($quiz->intro),
            'timeopen' => $quiz->timeopen ?? null,
            'timeclose' => $quiz->timeclose ?? null,
            'gradeMethod' => $quiz->grademethod,
            'questionsPerPage' => $quiz->questionsperpage,
            'navMethod' => $quiz->navmethod,
            'preferredBehaviour' => $quiz->preferredbehaviour
        ];
        
        // Return 201 Created with attempt data
        $this->success($responseData, 201);
    }
    
    /**
     * Extract quiz ID from URL path.
     *
     * Parses the request URI to extract the quiz ID from the path pattern
     * /api/v1/quizzes/{id}/attempt. Uses regex to match the numeric ID.
     *
     * @return int|null Quiz ID if found, null otherwise
     */
    private function extractQuizIdFromUrl() {
        // Match pattern: /api/v1/quizzes/{id}/attempt
        if (preg_match('#/quizzes/(\d+)/attempt#', $this->requestUri, $matches)) {
            return intval($matches[1]);
        }
        
        return null;
    }
    
    /**
     * GET method not supported for attempt creation.
     *
     * @throws MethodNotAllowedException Always
     */
    protected function handle_get() {
        throw new MethodNotAllowedException('GET method not supported. Use POST to create an attempt.', [
            'allowedMethods' => ['POST']
        ]);
    }
    
    /**
     * PUT method not supported for attempt creation.
     *
     * @throws MethodNotAllowedException Always
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method not supported. Use POST to create an attempt.', [
            'allowedMethods' => ['POST']
        ]);
    }
    
    /**
     * DELETE method not supported for attempt creation.
     *
     * @throws MethodNotAllowedException Always
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method not supported for attempt creation.', [
            'allowedMethods' => ['POST']
        ]);
    }
}

// Execute the endpoint if called directly
if (!defined('API_TEST_MODE') || !API_TEST_MODE) {
    $endpoint = new QuizAttemptCreateEndpoint();
    $endpoint->execute();
}
