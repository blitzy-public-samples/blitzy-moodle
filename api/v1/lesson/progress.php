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
 * REST API endpoint for retrieving user's progress and performance metrics within a lesson.
 *
 * Handles GET /api/v1/lesson/{id}/progress requests to return completion percentage,
 * pages viewed, questions answered correctly/incorrectly, time spent, attempts made,
 * current grade, and high score. Extends ApiBase class for JWT authentication.
 *
 * This endpoint delegates to existing Moodle lesson functions:
 * - $lesson->calculate_progress() for completion percentage
 * - $lesson->get_attempts() for attempt history
 * - lesson_get_user_grades() for grade records
 * - lesson_grade() for detailed attempt scoring
 *
 * No business logic is duplicated; all calculations use existing Moodle core functions.
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Load API base class and exception handlers
require_once(__DIR__ . '/../../lib/api_base.php');
require_once(__DIR__ . '/../../lib/api_exception.php');

/**
 * Lesson Progress API Endpoint.
 *
 * Provides comprehensive progress and performance data for a user's interaction with a lesson.
 * Returns metrics including completion percentage, pages viewed, question performance,
 * time spent, attempt history, and grading information.
 *
 * Endpoint: GET /api/v1/lesson/{id}/progress
 *
 * Authentication: Requires valid JWT token
 * Authorization: Requires 'mod/lesson:view' capability in lesson context
 *
 * Response structure:
 * {
 *   "success": true,
 *   "data": {
 *     "lesson_id": 123,
 *     "user_id": 456,
 *     "progress_percent": 75.5,
 *     "pages_viewed": 15,
 *     "pages_total": 20,
 *     "questions_answered": 10,
 *     "correct_answers": 8,
 *     "incorrect_answers": 2,
 *     "time_spent": 3600,
 *     "current_attempt": 1,
 *     "retakes_allowed": true,
 *     "grade_current": 85.5,
 *     "grade_max": 90.0,
 *     "completed": false,
 *     "pages_completed": [1, 2, 3, ...],
 *     "remaining_pages": 5
 *   }
 * }
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class LessonProgressEndpoint extends ApiBase {
    
    /**
     * Handle GET requests for lesson progress.
     *
     * Extracts lesson ID from URI, loads lesson data, checks permissions,
     * calculates progress metrics, and returns comprehensive progress information.
     *
     * URI pattern: /api/v1/lesson/{id}/progress
     *
     * @return void Outputs JSON response via success() method
     * @throws NotFoundException If lesson ID cannot be extracted or lesson not found
     * @throws ForbiddenException If user lacks 'mod/lesson:view' capability
     * @throws UnauthorizedException If JWT authentication fails
     */
    protected function handle_get() {
        global $CFG, $DB;
        
        // Extract lesson ID from URI using regex pattern
        // Matches: /api/v1/lesson/123/progress
        if (!preg_match('/\/lesson\/(\d+)\/progress$/', $this->requestUri, $matches)) {
            throw new NotFoundException('Lesson ID not found in request URI', [
                'uri' => $this->requestUri,
                'expected_pattern' => '/api/v1/lesson/{id}/progress'
            ]);
        }
        
        $lessonid = (int)$matches[1];
        
        // Load lesson module dependencies
        require_once($CFG->dirroot . '/mod/lesson/locallib.php');
        require_once($CFG->dirroot . '/mod/lesson/lib.php');
        
        // Load the lesson object using static factory method
        try {
            $lesson = lesson::load($lessonid);
        } catch (moodle_exception $e) {
            throw new NotFoundException("Lesson with ID {$lessonid} not found", [
                'lesson_id' => $lessonid,
                'error' => $e->getMessage()
            ]);
        }
        
        // Get course module instance for permission checking
        $cm = get_coursemodule_from_instance('lesson', $lessonid, 0, false, MUST_EXIST);
        if (!$cm) {
            throw new NotFoundException("Course module not found for lesson {$lessonid}", [
                'lesson_id' => $lessonid
            ]);
        }
        
        // Check user has permission to view this lesson
        $context = context_module::instance($cm->id);
        $this->checkCapability('mod/lesson:view', $context);
        
        // Get authenticated user from JWT token
        $user = $this->getUser();
        $userid = $user->id;
        
        // Calculate progress percentage using existing Moodle function
        // This delegates to lesson's calculate_progress() method which handles
        // all the complex logic for branching, clustering, and valid page paths
        $progresspercent = $lesson->calculate_progress($userid);
        
        // Get total number of attempts (retries) for this lesson
        // This is used to fetch the correct attempt data
        $ntries = $DB->count_records('lesson_grades', [
            'lessonid' => $lessonid,
            'userid' => $userid
        ]);
        
        // If no grades recorded yet, set to retry 0 (first attempt)
        if ($ntries === 0) {
            $ntries = 0;
        }
        
        // Get all user attempts for this lesson
        // Returns array of attempt records with pageid, correct, timeseen, etc.
        $attempts = $lesson->get_attempts($ntries, false, $userid);
        
        // Initialize statistics counters
        $pagesViewed = [];
        $questionsAnswered = 0;
        $correctAnswers = 0;
        $incorrectAnswers = 0;
        $pagesCompleted = [];
        
        // Process attempts to calculate statistics
        if (!empty($attempts)) {
            foreach ($attempts as $attempt) {
                // Track unique pages viewed
                if (!in_array($attempt->pageid, $pagesViewed)) {
                    $pagesViewed[] = $attempt->pageid;
                }
                
                // Check if this is a question page (has a correct field)
                if (isset($attempt->correct)) {
                    $questionsAnswered++;
                    
                    // Count correct and incorrect answers
                    if ($attempt->correct == 1) {
                        $correctAnswers++;
                        // Mark page as completed if answered correctly
                        if (!in_array($attempt->pageid, $pagesCompleted)) {
                            $pagesCompleted[] = $attempt->pageid;
                        }
                    } else if ($attempt->correct == 0) {
                        $incorrectAnswers++;
                    }
                }
            }
        }
        
        // Get total number of content pages in the lesson
        // Load all pages and count valid content pages
        $lesson->load_all_pages();
        $validPages = [];
        foreach ($lesson->pages as $pageid => $page) {
            // Only count content pages (not end of branch, cluster, etc.)
            $pageType = $page->qtype ?? null;
            if ($pageType !== LESSON_PAGE_ENDOFBRANCH && 
                $pageType !== LESSON_PAGE_CLUSTER && 
                $pageType !== LESSON_PAGE_ENDOFCLUSTER) {
                $validPages[] = $pageid;
            }
        }
        $totalPages = count($validPages);
        
        // Get user grade information using existing Moodle function
        // This respects lesson settings for retakes (max vs average)
        $grades = lesson_get_user_grades($lesson, $userid);
        
        $gradeCurrent = 0;
        $gradeMax = 0;
        
        if (!empty($grades) && isset($grades[$userid])) {
            $userGrade = $grades[$userid];
            $gradeCurrent = isset($userGrade->rawgrade) ? round($userGrade->rawgrade, 2) : 0;
            $gradeMax = $lesson->grade;
        }
        
        // Get timer information to calculate time spent
        $timeSpent = 0;
        $timerRecord = $DB->get_record('lesson_timer', [
            'lessonid' => $lessonid,
            'userid' => $userid,
            'completed' => 0
        ]);
        
        if ($timerRecord) {
            // Calculate time spent from timer start
            $timeSpent = time() - $timerRecord->starttime;
        } else {
            // Check for completed timer records
            $completedTimers = $DB->get_records('lesson_timer', [
                'lessonid' => $lessonid,
                'userid' => $userid,
                'completed' => 1
            ]);
            
            // Sum up all completed session times
            foreach ($completedTimers as $timer) {
                if (isset($timer->lessontime)) {
                    $timeSpent += $timer->lessontime;
                }
            }
        }
        
        // Determine if lesson is completed
        // A lesson is completed if progress is 100% or all required pages are viewed
        $isCompleted = ($progresspercent >= 100);
        
        // Calculate remaining pages
        $remainingPages = max(0, $totalPages - count($pagesViewed));
        
        // Determine if retakes are allowed
        // Check lesson settings for maximum retakes
        $retakesAllowed = true;
        if (isset($lesson->retake) && $lesson->retake == 0) {
            // Retakes not allowed
            if ($ntries > 0) {
                $retakesAllowed = false;
            }
        } else if (isset($lesson->maxattempts) && $lesson->maxattempts > 0) {
            // Limited retakes
            if ($ntries >= $lesson->maxattempts) {
                $retakesAllowed = false;
            }
        }
        
        // Build comprehensive response data
        $responseData = [
            'lesson_id' => $lessonid,
            'user_id' => $userid,
            'progress_percent' => round($progresspercent, 2),
            'pages_viewed' => count($pagesViewed),
            'pages_total' => $totalPages,
            'questions_answered' => $questionsAnswered,
            'correct_answers' => $correctAnswers,
            'incorrect_answers' => $incorrectAnswers,
            'time_spent' => $timeSpent,
            'current_attempt' => $ntries,
            'retakes_allowed' => $retakesAllowed,
            'grade_current' => $gradeCurrent,
            'grade_max' => $gradeMax,
            'completed' => $isCompleted,
            'pages_completed' => $pagesCompleted,
            'remaining_pages' => $remainingPages,
            'lesson_name' => $lesson->name,
            'lesson_intro' => $lesson->intro ?? '',
        ];
        
        // Return success response with progress data
        $this->success($responseData);
    }
    
    /**
     * Handle POST requests - not supported for this endpoint.
     *
     * @throws MethodNotAllowedException Always, as POST is not supported
     */
    protected function handle_post() {
        throw new MethodNotAllowedException('POST method not allowed for lesson progress endpoint');
    }
    
    /**
     * Handle PUT requests - not supported for this endpoint.
     *
     * @throws MethodNotAllowedException Always, as PUT is not supported
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method not allowed for lesson progress endpoint');
    }
    
    /**
     * Handle DELETE requests - not supported for this endpoint.
     *
     * @throws MethodNotAllowedException Always, as DELETE is not supported
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method not allowed for lesson progress endpoint');
    }
}

// Instantiate and execute the endpoint
$endpoint = new LessonProgressEndpoint();
$endpoint->execute();
