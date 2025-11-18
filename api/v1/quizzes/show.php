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
 * REST API endpoint for retrieving quiz information.
 *
 * Provides GET /api/v1/quizzes/{id} endpoint that retrieves comprehensive
 * quiz information including settings, questions, timing rules, grading method,
 * and availability restrictions. This endpoint enables React quiz interface to
 * display quiz overview page with all relevant details before students start
 * an attempt.
 *
 * Delegates to existing Moodle quiz functions without duplicating business logic:
 * - quiz_get_quiz_by_instance() for quiz data retrieval
 * - get_coursemodule_from_instance() for course module context
 * - require_capability() for permission validation
 * - get_fast_modinfo() for availability information
 *
 * Returns quiz configuration including attempts allowed, time limits, grading
 * methods, question behavior, navigation settings, and all review options. Also
 * includes user-specific information such as previous attempts and current
 * availability status.
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
require_once($CFG->dirroot . '/lib/completionlib.php');

// Load API base classes
require_once(__DIR__ . '/../../lib/api_base.php');
require_once(__DIR__ . '/../../lib/api_exception.php');

/**
 * Quiz Show API Endpoint.
 *
 * Handles GET requests to /api/v1/quizzes/{id} for retrieving comprehensive
 * quiz information including all settings, configuration, and availability data.
 * Returns structured quiz data for display in React interface.
 *
 * Authentication: Required via JWT token
 * Authorization: User must have mod/quiz:view capability in the quiz context
 * HTTP Method: GET only
 *
 * Response includes:
 * - quiz: Core quiz settings and configuration
 * - course: Parent course information
 * - availability: Current availability status and restrictions
 * - timing: Time limits and open/close dates
 * - attempts: Attempt limits and user's previous attempts
 * - grading: Grade settings and methods
 * - questionBehavior: How questions behave during attempts
 * - reviewOptions: What students can see after attempts
 * - navigation: Navigation and layout settings
 * - userAttempts: User's previous attempts if any
 *
 * @package    api
 * @subpackage quizzes
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class QuizShowEndpoint extends ApiBase {
    
    /**
     * Handle GET request for quiz information.
     *
     * Extracts quiz ID from URL path, validates user has permission to view
     * the quiz, retrieves comprehensive quiz data including all settings and
     * configuration, checks availability restrictions, and returns formatted
     * quiz information for display in React interface.
     *
     * URL Pattern: /api/v1/quizzes/{id}
     * Example: /api/v1/quizzes/42
     *
     * @return void Outputs JSON response with quiz information
     * @throws ValidationException If quiz ID is invalid or malformed
     * @throws NotFoundException If quiz does not exist
     * @throws ForbiddenException If user lacks view capability
     * @throws ApiException If quiz data cannot be retrieved
     */
    protected function handle_get() {
        global $DB, $USER, $PAGE;
        
        // Validate user is authenticated via JWT token
        $authenticatedUser = $this->getUser();
        
        // Extract quiz ID from URL path using regex
        // Pattern matches: /quizzes/{quizid}
        if (!preg_match('/\/quizzes\/(\d+)$/', $this->requestUri, $matches)) {
            throw new ValidationException('Invalid URL format', [
                'expected' => '/api/v1/quizzes/{id}',
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
        
        // Check if user has permission to view this quiz
        try {
            require_capability('mod/quiz:view', $context);
        } catch (moodle_exception $e) {
            throw new ForbiddenException('You do not have permission to view this quiz', [
                'quizId' => $quizid,
                'capability' => 'mod/quiz:view',
                'reason' => $e->getMessage()
            ]);
        }
        
        // Set up page context for Moodle functions that require it
        $PAGE->set_context($context);
        
        // Get modinfo for availability checking
        $modinfo = get_fast_modinfo($course);
        $cminfo = $modinfo->get_cm($cm->id);
        
        // Build base quiz information
        $quizData = [
            'id' => $quiz->id,
            'courseId' => $quiz->course,
            'courseName' => format_string($course->fullname),
            'courseShortName' => format_string($course->shortname),
            'name' => format_string($quiz->name),
            'intro' => format_text($quiz->intro, $quiz->introformat, ['context' => $context]),
            'introFormat' => $quiz->introformat,
        ];
        
        // Add timing information
        $now = time();
        $quizData['timing'] = [
            'timeOpen' => $quiz->timeopen ? (int)$quiz->timeopen : null,
            'timeClose' => $quiz->timeclose ? (int)$quiz->timeclose : null,
            'timeLimit' => $quiz->timelimit ? (int)$quiz->timelimit : null,
            'overdueHandling' => $quiz->overduehandling,
            'graceperiod' => $quiz->graceperiod ? (int)$quiz->graceperiod : null,
            'isOpen' => (!$quiz->timeopen || $now >= $quiz->timeopen) && (!$quiz->timeclose || $now < $quiz->timeclose),
            'isClosed' => $quiz->timeclose && $now >= $quiz->timeclose,
            'opensIn' => $quiz->timeopen && $now < $quiz->timeopen ? ($quiz->timeopen - $now) : null,
            'closesIn' => $quiz->timeclose && $now < $quiz->timeclose ? ($quiz->timeclose - $now) : null,
        ];
        
        // Add attempt information
        $quizData['attempts'] = [
            'attemptsAllowed' => $quiz->attempts ? (int)$quiz->attempts : null,
            'unlimited' => $quiz->attempts == 0,
        ];
        
        // Get user's previous attempts
        $userAttempts = quiz_get_user_attempts($quiz->id, $USER->id, 'all', true);
        $quizData['attempts']['userAttemptCount'] = count($userAttempts);
        $quizData['attempts']['hasAttempts'] = count($userAttempts) > 0;
        
        // Check if user can start a new attempt
        $canAttempt = has_capability('mod/quiz:attempt', $context);
        $attemptsRemaining = $quiz->attempts == 0 ? true : (($quiz->attempts - count($userAttempts)) > 0);
        
        $quizData['attempts']['canAttempt'] = $canAttempt;
        $quizData['attempts']['attemptsRemaining'] = $quiz->attempts == 0 ? null : max(0, $quiz->attempts - count($userAttempts));
        $quizData['attempts']['canStartNewAttempt'] = $canAttempt && $attemptsRemaining && $quizData['timing']['isOpen'];
        
        // Add grading information
        $quizData['grading'] = [
            'grade' => $quiz->grade ? (float)$quiz->grade : 0,
            'sumGrades' => $quiz->sumgrades ? (float)$quiz->sumgrades : 0,
            'gradeMethod' => (int)$quiz->grademethod,
            'gradeMethodName' => $this->getGradeMethodName($quiz->grademethod),
            'decimalPoints' => (int)$quiz->decimalpoints,
            'questionDecimalPoints' => (int)$quiz->questiondecimalpoints,
        ];
        
        // Add question behavior settings
        $quizData['questionBehavior'] = [
            'preferredBehaviour' => $quiz->preferredbehaviour,
            'canRedoQuestions' => (bool)$quiz->canredoquestions,
            'attemptonlast' => (bool)$quiz->attemptonlast,
            'shuffleAnswers' => (bool)$quiz->shuffleanswers,
        ];
        
        // Add navigation settings
        $quizData['navigation'] = [
            'navMethod' => $quiz->navmethod,
            'navMethodName' => $this->getNavMethodName($quiz->navmethod),
            'questionsPerPage' => (int)$quiz->questionsperpage,
            'showBlocks' => (bool)$quiz->showblocks,
            'showUserpicture' => (int)$quiz->showuserpicture,
        ];
        
        // Add review options
        // Review options are bitmasks that determine what students can see after attempts
        $quizData['reviewOptions'] = [
            'attemptReview' => (int)$quiz->reviewattempt,
            'correctness' => (int)$quiz->reviewcorrectness,
            'marks' => (int)$quiz->reviewmarks,
            'specificFeedback' => (int)$quiz->reviewspecificfeedback,
            'generalFeedback' => (int)$quiz->reviewgeneralfeedback,
            'rightAnswer' => (int)$quiz->reviewrightanswer,
            'overallFeedback' => (int)$quiz->reviewoverallfeedback,
        ];
        
        // Add password and network restrictions
        $quizData['security'] = [
            'hasPassword' => !empty($quiz->password),
            'requiresPassword' => !empty($quiz->password),
            'subnet' => $quiz->subnet ? $quiz->subnet : null,
            'delay1' => $quiz->delay1 ? (int)$quiz->delay1 : null,
            'delay2' => $quiz->delay2 ? (int)$quiz->delay2 : null,
        ];
        
        // Add browser security settings
        $quizData['security']['browserSecurity'] = $quiz->browsersecurity;
        $quizData['security']['requiresSecureBrowser'] = $quiz->browsersecurity === 'securewindow' || $quiz->browsersecurity === 'safebrowser';
        
        // Add completion settings
        $completion = new completion_info($course);
        if ($completion->is_enabled($cm)) {
            $quizData['completion'] = [
                'completionEnabled' => true,
                'completionExpected' => $cm->completionexpected ? (int)$cm->completionexpected : null,
            ];
        } else {
            $quizData['completion'] = [
                'completionEnabled' => false,
            ];
        }
        
        // Add availability information from modinfo
        $quizData['availability'] = [
            'available' => $cminfo->available,
            'userVisible' => $cminfo->uservisible,
            'availableInfo' => $cminfo->availableinfo ? format_string($cminfo->availableinfo) : null,
        ];
        
        // Add question count
        $quizobj = quiz::create($quiz->id, $USER->id);
        $quizData['questions'] = [
            'count' => $quizobj->get_num_questions_per_attempt(),
            'shuffled' => (bool)$quiz->shuffleanswers,
        ];
        
        // Build user attempts summary
        $userAttemptsData = [];
        foreach ($userAttempts as $attempt) {
            $userAttemptsData[] = [
                'id' => $attempt->id,
                'attemptNumber' => $attempt->attempt,
                'state' => $attempt->state,
                'timeStart' => $attempt->timestart,
                'timeFinish' => $attempt->timefinish,
                'sumGrades' => $attempt->sumgrades,
            ];
        }
        $quizData['userAttempts'] = $userAttemptsData;
        
        // Return success response with quiz data
        $this->success($quizData, 200);
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
            'POST method is not allowed for quiz show endpoint',
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
            'PUT method is not allowed for quiz show endpoint',
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
            'DELETE method is not allowed for quiz show endpoint',
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
    
    /**
     * Get human-readable name for navigation method.
     *
     * Converts navigation method code to descriptive name.
     *
     * @param string $method Navigation method code
     * @return string Navigation method name
     */
    private function getNavMethodName($method) {
        switch ($method) {
            case QUIZ_NAVMETHOD_FREE:
                return 'Free navigation';
            case QUIZ_NAVMETHOD_SEQ:
                return 'Sequential navigation';
            default:
                return 'Unknown';
        }
    }
}

// Instantiate and execute the endpoint
$endpoint = new QuizShowEndpoint();
$endpoint->execute();
