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
 * Provides POST /api/v1/quizzes/{id}/attempt endpoint that creates a new quiz
 * attempt for the authenticated user. This endpoint validates all quiz access
 * restrictions (timing, password, number of attempts, etc.) before creating the
 * attempt, ensuring students can only start attempts when permitted.
 *
 * Delegates to existing Moodle quiz functions without duplicating business logic:
 * - quiz_create_attempt_object() for attempt creation
 * - quiz_prepare_and_start_new_attempt() to initialize the attempt
 * - quiz_access_manager for access rule validation
 * - require_capability() for permission validation
 *
 * Validates multiple conditions before allowing attempt creation:
 * - User has mod/quiz:attempt capability
 * - Quiz is currently open (within timeopen/timeclose window)
 * - User has not exceeded attempt limits
 * - No active unfinished attempts exist
 * - Password and network restrictions are satisfied
 * - Delay between attempts is satisfied
 * - All other quiz access rules are satisfied
 *
 * Returns newly created attempt with initial state including questions, time
 * started, and navigation data for React quiz interface.
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
 * Quiz Attempt Creation API Endpoint.
 *
 * Handles POST requests to /api/v1/quizzes/{id}/attempt for creating new quiz
 * attempts. Validates all access restrictions, creates the attempt record,
 * initializes questions, and returns attempt data for React interface to begin
 * displaying questions.
 *
 * Authentication: Required via JWT token
 * Authorization: User must have mod/quiz:attempt capability
 * HTTP Method: POST only
 *
 * Request Body (optional):
 * - password: Quiz password if required
 * - forcenew: Boolean to force new attempt even if unfinished exists
 *
 * Response includes:
 * - attempt: Created attempt record with ID, state, time started
 * - quiz: Basic quiz information
 * - questions: Question layout and count for navigation
 * - navigation: Available navigation actions
 * - timing: Time limit and deadline information
 *
 * @package    api
 * @subpackage quizzes
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class QuizAttemptEndpoint extends ApiBase {
    
    /**
     * Handle GET requests.
     *
     * This endpoint does not support GET method as attempt creation requires POST.
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown as GET is not supported
     */
    protected function handle_get() {
        throw new MethodNotAllowedException(
            'GET method is not allowed for quiz attempt creation endpoint',
            [
                'allowedMethods' => ['POST'],
                'requestedMethod' => 'GET'
            ]
        );
    }
    
    /**
     * Handle POST request to create new quiz attempt.
     *
     * Extracts quiz ID from URL path, validates user has permission to attempt
     * the quiz, checks all access restrictions (timing, password, attempt limits),
     * creates new attempt record via existing Moodle functions, initializes
     * questions, and returns attempt data for React interface.
     *
     * URL Pattern: /api/v1/quizzes/{id}/attempt
     * Example: /api/v1/quizzes/42/attempt
     *
     * @return void Outputs JSON response with created attempt information
     * @throws ValidationException If quiz ID is invalid or access rules violated
     * @throws NotFoundException If quiz does not exist
     * @throws ForbiddenException If user lacks attempt capability or access denied
     * @throws ApiException If attempt creation fails
     */
    protected function handle_post() {
        global $DB, $USER, $PAGE;
        
        // Validate user is authenticated via JWT token
        $authenticatedUser = $this->getUser();
        
        // Extract quiz ID from URL path using regex
        // Pattern matches: /quizzes/{quizid}/attempt
        if (!preg_match('/\/quizzes\/(\d+)\/attempt$/', $this->requestUri, $matches)) {
            throw new ValidationException('Invalid URL format', [
                'expected' => '/api/v1/quizzes/{id}/attempt',
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
        
        // Parse request body for optional parameters
        $requestData = $this->parseRequestBody();
        $password = isset($requestData['password']) ? $requestData['password'] : null;
        $forcenew = isset($requestData['forcenew']) ? (bool)$requestData['forcenew'] : false;
        
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
        
        // Check if user has permission to attempt this quiz
        try {
            require_capability('mod/quiz:attempt', $context);
        } catch (moodle_exception $e) {
            throw new ForbiddenException('You do not have permission to attempt this quiz', [
                'quizId' => $quizid,
                'capability' => 'mod/quiz:attempt',
                'reason' => $e->getMessage()
            ]);
        }
        
        // Set up page context for Moodle functions
        $PAGE->set_context($context);
        
        // Create quiz object for access manager
        try {
            $quizobj = quiz::create($quiz->id, $USER->id);
        } catch (moodle_exception $e) {
            throw new ApiException('Failed to load quiz', [
                'quizId' => $quizid,
                'reason' => $e->getMessage()
            ], 500);
        }
        
        // Create access manager to check quiz access rules
        $accessmanager = $quizobj->get_access_manager(time());
        
        // Check if password is required and validate it
        if ($quiz->password && $password !== $quiz->password) {
            $reasons = $accessmanager->prevent_access();
            throw new ForbiddenException('Quiz password required or incorrect', [
                'quizId' => $quizid,
                'requiresPassword' => true,
                'reasons' => $reasons
            ]);
        }
        
        // Check all access rules
        $accesserrors = $accessmanager->prevent_access();
        
        if ($accesserrors) {
            throw new ForbiddenException('Cannot start quiz attempt', [
                'quizId' => $quizid,
                'reasons' => $accesserrors,
                'details' => 'Quiz access restrictions prevent you from starting an attempt'
            ]);
        }
        
        // Check for unfinished attempts
        $attempts = quiz_get_user_attempts($quiz->id, $USER->id, 'unfinished', true);
        
        if (!empty($attempts) && !$forcenew) {
            $unfinished = reset($attempts);
            throw new ValidationException('Unfinished attempt exists', [
                'quizId' => $quizid,
                'attemptId' => $unfinished->id,
                'reason' => 'You have an unfinished attempt. Please continue or abandon it before starting a new one.',
                'unfinishedAttemptId' => $unfinished->id
            ]);
        }
        
        // Check attempt number
        $attempts = quiz_get_user_attempts($quiz->id, $USER->id, 'all', true);
        $numattempts = count($attempts);
        
        // Validate attempt limit
        if ($quiz->attempts > 0 && $numattempts >= $quiz->attempts) {
            throw new ForbiddenException('Attempt limit reached', [
                'quizId' => $quizid,
                'attemptsAllowed' => $quiz->attempts,
                'attemptsMade' => $numattempts,
                'reason' => 'You have used all your allowed attempts for this quiz'
            ]);
        }
        
        // Check timing restrictions
        $now = time();
        if ($quiz->timeopen && $now < $quiz->timeopen) {
            throw new ForbiddenException('Quiz not yet open', [
                'quizId' => $quizid,
                'opensAt' => $quiz->timeopen,
                'currentTime' => $now,
                'reason' => 'This quiz is not yet open'
            ]);
        }
        
        if ($quiz->timeclose && $now >= $quiz->timeclose) {
            throw new ForbiddenException('Quiz is closed', [
                'quizId' => $quizid,
                'closedAt' => $quiz->timeclose,
                'currentTime' => $now,
                'reason' => 'This quiz is closed'
            ]);
        }
        
        // Check delay between attempts
        if ($numattempts > 0 && ($quiz->delay1 || $quiz->delay2)) {
            $lastattempt = end($attempts);
            $nextstarttime = $lastattempt->timefinish;
            
            if ($numattempts == 1 && $quiz->delay1) {
                $nextstarttime += $quiz->delay1;
            } else if ($numattempts > 1 && $quiz->delay2) {
                $nextstarttime += $quiz->delay2;
            }
            
            if ($now < $nextstarttime) {
                throw new ForbiddenException('Must wait before next attempt', [
                    'quizId' => $quizid,
                    'canAttemptAt' => $nextstarttime,
                    'currentTime' => $now,
                    'waitSeconds' => $nextstarttime - $now,
                    'reason' => 'You must wait before starting another attempt'
                ]);
            }
        }
        
        // All validations passed - create the attempt
        try {
            // Determine attempt number
            $attemptnumber = $numattempts + 1;
            
            // Create attempt using existing Moodle function
            $attempt = quiz_prepare_and_start_new_attempt($quizobj, $attemptnumber, null);
            
            // Get the created attempt record
            $attemptobj = quiz_create_attempt_handling_errors($attempt->id, $cm->id);
            
        } catch (moodle_exception $e) {
            throw new ApiException('Failed to create quiz attempt', [
                'quizId' => $quizid,
                'reason' => $e->getMessage(),
                'details' => 'An error occurred while creating the quiz attempt'
            ], 500);
        }
        
        // Build response data
        $attemptData = [
            'attempt' => [
                'id' => $attempt->id,
                'quizId' => $quiz->id,
                'userId' => $USER->id,
                'attemptNumber' => $attemptnumber,
                'state' => $attempt->state,
                'timeStart' => $attempt->timestart,
                'timeFinish' => $attempt->timefinish,
                'currentPage' => $attemptobj->get_currentpage(),
                'preview' => $attemptobj->is_preview(),
            ],
            'quiz' => [
                'id' => $quiz->id,
                'name' => format_string($quiz->name),
                'timeLimit' => $quiz->timelimit ? (int)$quiz->timelimit : null,
                'graceperiod' => $quiz->graceperiod ? (int)$quiz->graceperiod : null,
            ],
            'timing' => [
                'hasTimeLimit' => (bool)$quiz->timelimit,
                'timeLimit' => $quiz->timelimit ? (int)$quiz->timelimit : null,
                'deadline' => null,
            ],
            'questions' => [
                'count' => $attemptobj->get_num_questions_per_page(),
                'totalCount' => $attemptobj->get_num_questions_per_attempt(),
            ],
            'navigation' => [
                'canNavigateFreely' => $quiz->navmethod === QUIZ_NAVMETHOD_FREE,
                'questionsPerPage' => (int)$quiz->questionsperpage,
            ],
        ];
        
        // Calculate deadline if time limit exists
        if ($quiz->timelimit) {
            $deadline = $attempt->timestart + $quiz->timelimit;
            if ($quiz->timeclose) {
                $deadline = min($deadline, $quiz->timeclose);
            }
            $attemptData['timing']['deadline'] = $deadline;
        } else if ($quiz->timeclose) {
            $attemptData['timing']['deadline'] = $quiz->timeclose;
        }
        
        // Return success response with attempt data
        $this->success($attemptData, 201);
    }
    
    /**
     * Handle PUT requests.
     *
     * This endpoint does not support PUT method.
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown as PUT is not supported
     */
    protected function handle_put() {
        throw new MethodNotAllowedException(
            'PUT method is not allowed for quiz attempt creation endpoint',
            [
                'allowedMethods' => ['POST'],
                'requestedMethod' => 'PUT'
            ]
        );
    }
    
    /**
     * Handle DELETE requests.
     *
     * This endpoint does not support DELETE method.
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown as DELETE is not supported
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException(
            'DELETE method is not allowed for quiz attempt creation endpoint',
            [
                'allowedMethods' => ['POST'],
                'requestedMethod' => 'DELETE'
            ]
        );
    }
}

// Instantiate and execute the endpoint
$endpoint = new QuizAttemptEndpoint();
$endpoint->execute();
