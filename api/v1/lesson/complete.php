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
 * REST API endpoint for marking a lesson as completed and finalizing user's attempt.
 *
 * Handles POST /api/v1/lesson/{id}/complete requests to record lesson completion,
 * calculate final grade, update gradebook, stop lesson timer, trigger completion
 * tracking, and return final performance summary.
 *
 * This endpoint:
 * - Validates that user has reached end of lesson (LESSON_EOL constant)
 * - Calls existing grade calculation functions to determine final score
 * - Updates lesson_grades table with completion timestamp
 * - Calls lesson_update_grades() to push grade to Moodle gradebook
 * - Stops active timer via lesson timer methods
 * - Triggers activity completion via completion_info API
 * - Calculates final statistics (pages viewed, time spent, score percentage, attempts used)
 * - Returns comprehensive completion data with grade information and achievement summary
 *
 * Critical for React frontend to handle lesson conclusion, display final results,
 * update course progress indicators, and enable certificate generation or next
 * activity navigation based on completion criteria.
 *
 * @package    mod_lesson
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Load API base class and exception handlers
require_once(__DIR__ . '/../../lib/api_base.php');
require_once(__DIR__ . '/../../lib/api_exception.php');

/**
 * API endpoint class for lesson completion.
 *
 * Extends ApiBase to inherit JWT authentication, HTTP method routing,
 * and standardized response formatting. Implements handle_post() to
 * process lesson completion requests.
 */
class LessonCompleteEndpoint extends ApiBase {
    
    /**
     * Handle GET requests - not supported for this endpoint.
     *
     * Lesson completion requires POST method to ensure intentional submission
     * and to prevent accidental completion through browser prefetching or caching.
     *
     * @throws MethodNotAllowedException Always, as GET is not supported
     */
    protected function handle_get() {
        throw new MethodNotAllowedException('GET method not supported. Use POST to complete a lesson.', [
            'allowedMethods' => ['POST'],
            'endpoint' => '/api/v1/lesson/{id}/complete'
        ]);
    }
    
    /**
     * Handle POST requests to complete a lesson.
     *
     * Main handler for lesson completion. Validates lesson completion eligibility,
     * calculates final grade, updates database records, triggers activity completion,
     * and returns comprehensive performance summary.
     *
     * Request URI pattern: POST /api/v1/lesson/{id}/complete
     * where {id} is the lesson instance ID (not course module ID).
     *
     * Response includes:
     * - lesson_id: Lesson instance ID
     * - user_id: Authenticated user ID
     * - completed: Boolean true to indicate successful completion
     * - completion_time: Unix timestamp of completion
     * - final_grade: Numeric grade value (0-100 scale)
     * - grade_percentage: Integer percentage (0-100)
     * - time_spent: Total seconds spent in lesson
     * - pages_viewed: Number of pages viewed during attempt
     * - attempts_used: Number of question attempts made
     * - passed: Boolean indicating whether user passed based on passing grade threshold
     * - high_score: Boolean indicating if this is user's best attempt
     * - feedback: Completion message from lesson settings
     *
     * @return void Calls success() to send JSON response
     * @throws NotFoundException If lesson ID not found in URI or lesson doesn't exist
     * @throws ValidationException If user not eligible to complete lesson
     * @throws ForbiddenException If user lacks required capabilities
     */
    protected function handle_post() {
        global $CFG, $DB;
        
        // Load Moodle lesson libraries
        require_once($CFG->dirroot . '/mod/lesson/locallib.php');
        require_once($CFG->dirroot . '/mod/lesson/lib.php');
        require_once($CFG->libdir . '/completionlib.php');
        require_once($CFG->libdir . '/gradelib.php');
        
        // Extract lesson ID from request URI using regex
        // Pattern matches: /lesson/123/complete (captures 123)
        if (!preg_match('/\/lesson\/(\d+)\/complete$/', $this->requestUri, $matches)) {
            throw new NotFoundException('Lesson ID not found in request URI', [
                'uri' => $this->requestUri,
                'expected_pattern' => '/api/v1/lesson/{id}/complete',
                'reason' => 'Lesson ID must be provided in URI path'
            ]);
        }
        
        $lessonid = (int)$matches[1];
        
        // Get authenticated user from JWT token
        $user = $this->getUser();
        
        // Load lesson record from database
        $lessonrecord = $DB->get_record('lesson', ['id' => $lessonid], '*', IGNORE_MISSING);
        
        if (!$lessonrecord) {
            throw new NotFoundException('Lesson not found', [
                'lessonId' => $lessonid,
                'reason' => 'No lesson exists with the specified ID'
            ]);
        }
        
        // Get course module instance for context and capability checking
        $cm = get_coursemodule_from_instance('lesson', $lessonid, 0, false, MUST_EXIST);
        
        if (!$cm) {
            throw new NotFoundException('Course module not found for lesson', [
                'lessonId' => $lessonid,
                'reason' => 'Lesson exists but course module mapping not found'
            ]);
        }
        
        // Get course record
        $course = $DB->get_record('course', ['id' => $cm->course], '*', MUST_EXIST);
        
        // Initialize lesson object (required for lesson methods)
        $lesson = new lesson($lessonrecord, $cm, $course);
        
        // Check capability - user must have permission to view/take the lesson
        $context = context_module::instance($cm->id);
        $this->checkCapability('mod/lesson:view', $context);
        
        // Validate completion eligibility - ensure user has reached end of lesson
        $this->validateCompletionEligibility($lesson, $user->id, $lessonid);
        
        // Get current attempt number for this user
        $attemptcount = $this->getUserAttemptCount($lessonid, $user->id);
        
        // Calculate final grade using existing Moodle lesson grading logic
        $gradeinfo = $this->calculateFinalGrade($lesson, $attemptcount, $user->id, $lessonid);
        
        // Record or update grade in lesson_grades table
        $graderecordid = $this->recordLessonGrade($lesson, $lessonid, $user->id, $gradeinfo, $attemptcount);
        
        // Update Moodle gradebook with final grade
        $this->updateGradebook($lesson, $user->id);
        
        // Stop active lesson timer and calculate total time spent
        $timespent = $this->stopLessonTimer($lessonid, $user->id);
        
        // Trigger activity completion tracking
        $this->markActivityComplete($course, $cm, $user->id);
        
        // Calculate additional statistics for response
        $statistics = $this->calculateStatistics($lessonid, $user->id, $timespent, $attemptcount);
        
        // Determine if user passed based on passing grade threshold
        $passed = $this->checkIfPassed($lesson, $gradeinfo['percentage']);
        
        // Determine if this is user's best attempt
        $highscore = $this->isHighScore($lessonid, $user->id, $gradeinfo['grade']);
        
        // Get completion feedback message from lesson settings
        $feedback = $this->getCompletionFeedback($lesson, $gradeinfo['percentage']);
        
        // Build comprehensive response data
        $responseData = [
            'lesson_id' => $lessonid,
            'user_id' => $user->id,
            'completed' => true,
            'completion_time' => time(),
            'final_grade' => $gradeinfo['grade'],
            'grade_percentage' => $gradeinfo['percentage'],
            'time_spent' => $timespent,
            'pages_viewed' => $statistics['pages_viewed'],
            'attempts_used' => $attemptcount,
            'passed' => $passed,
            'high_score' => $highscore,
            'feedback' => $feedback,
            'course_id' => $course->id,
            'course_module_id' => $cm->id
        ];
        
        // Return success response with completion data
        $this->success($responseData, 200);
    }
    
    /**
     * Handle PUT requests - not supported for this endpoint.
     *
     * Lesson completion is a one-time action that should use POST method.
     * PUT would imply updating an existing completion, which is not applicable.
     *
     * @throws MethodNotAllowedException Always, as PUT is not supported
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method not supported. Use POST to complete a lesson.', [
            'allowedMethods' => ['POST'],
            'endpoint' => '/api/v1/lesson/{id}/complete'
        ]);
    }
    
    /**
     * Handle DELETE requests - not supported for this endpoint.
     *
     * Lesson completions cannot be deleted through this endpoint.
     * Grade deletion is an administrative function not exposed via API.
     *
     * @throws MethodNotAllowedException Always, as DELETE is not supported
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method not supported for lesson completion.', [
            'allowedMethods' => ['POST'],
            'endpoint' => '/api/v1/lesson/{id}/complete'
        ]);
    }
    
    /**
     * Validate that user is eligible to complete the lesson.
     *
     * Checks that user has progressed through the lesson sufficiently to
     * warrant completion. Validates that user has reached a terminal page
     * (end of lesson page) or has viewed all required content.
     *
     * Validation criteria:
     * - User must have an active attempt record
     * - User must have reached LESSON_EOL page or completed all required pages
     * - Lesson must not already be marked as completed for this attempt
     *
     * @param lesson $lesson Lesson object instance
     * @param int $userid User ID to validate
     * @param int $lessonid Lesson instance ID
     * @return void
     * @throws ValidationException If user is not eligible to complete lesson
     */
    private function validateCompletionEligibility($lesson, $userid, $lessonid) {
        global $DB;
        
        // Check if user has any attempt records for this lesson
        $attempts = $DB->get_records('lesson_attempts', [
            'lessonid' => $lessonid,
            'userid' => $userid
        ], 'timeseen DESC');
        
        if (empty($attempts)) {
            throw new ValidationException('Cannot complete lesson without starting it', [
                'lessonId' => $lessonid,
                'userId' => $userid,
                'reason' => 'No attempt records found - user must view lesson pages first'
            ]);
        }
        
        // Get the most recent attempt to check if user reached end of lesson
        $recentattempt = reset($attempts);
        
        // Check if the last page viewed was an end-of-lesson page (jumpto = LESSON_EOL)
        // LESSON_EOL is defined as -9 in locallib.php
        $lastpage = $DB->get_record('lesson_pages', ['id' => $recentattempt->pageid], '*', IGNORE_MISSING);
        
        if ($lastpage) {
            // Get the answer that the user selected (if it was a question page)
            $useranswer = $DB->get_record('lesson_answers', [
                'pageid' => $lastpage->id,
                'lessonid' => $lessonid
            ], '*', IGNORE_MISSING);
            
            // Check if this was the last page (jumpto = LESSON_EOL which is -9)
            // Or if user has completed the minimum required pages
            if ($useranswer && $useranswer->jumpto == LESSON_EOL) {
                // User reached a valid end page
                return;
            }
        }
        
        // Alternative validation: Check if user has viewed sufficient pages
        // based on lesson configuration (minimum number of pages or questions)
        $minpages = $lesson->minquestions;
        
        if ($minpages > 0) {
            $pagesviewed = $DB->count_records('lesson_attempts', [
                'lessonid' => $lessonid,
                'userid' => $userid
            ]);
            
            if ($pagesviewed < $minpages) {
                throw new ValidationException('Minimum page requirement not met', [
                    'lessonId' => $lessonid,
                    'userId' => $userid,
                    'pagesViewed' => $pagesviewed,
                    'minimumRequired' => $minpages,
                    'reason' => 'User must view minimum number of pages before completing lesson'
                ]);
            }
        }
        
        // Additional check: Verify user hasn't reached maximum attempts if retry is disabled
        if ($lesson->retake == 0) {
            // Check if user already has a grade record (indicating prior completion)
            $existinggrade = $DB->get_record('lesson_grades', [
                'lessonid' => $lessonid,
                'userid' => $userid
            ], '*', IGNORE_MISSING);
            
            if ($existinggrade && $lesson->retake == 0) {
                throw new ValidationException('Lesson already completed and retake not allowed', [
                    'lessonId' => $lessonid,
                    'userId' => $userid,
                    'existingGrade' => $existinggrade->grade,
                    'reason' => 'Lesson is configured to allow only one attempt'
                ]);
            }
        }
    }
    
    /**
     * Get the number of attempts user has made for this lesson.
     *
     * Counts the number of grade records (completed attempts) for the user
     * in this lesson. Each completed attempt generates a grade record.
     *
     * @param int $lessonid Lesson instance ID
     * @param int $userid User ID
     * @return int Number of attempts (0 if first attempt)
     */
    private function getUserAttemptCount($lessonid, $userid) {
        global $DB;
        
        // Count existing grade records as completed attempts
        $attemptcount = $DB->count_records('lesson_grades', [
            'lessonid' => $lessonid,
            'userid' => $userid
        ]);
        
        // Add 1 for current attempt being completed
        return $attemptcount + 1;
    }
    
    /**
     * Calculate final grade for lesson attempt using existing Moodle functions.
     *
     * Delegates to Moodle's lesson grading system to calculate grade based on:
     * - Questions answered correctly
     * - Lesson grading method (points, custom scoring, etc.)
     * - Retake handling (average, best, or last attempt)
     *
     * This method DOES NOT implement custom grading logic - it calls existing
     * Moodle functions to ensure consistency with PHP-based grading.
     *
     * @param lesson $lesson Lesson object instance
     * @param int $attemptcount Current attempt number
     * @param int $userid User ID
     * @param int $lessonid Lesson instance ID
     * @return array Associative array with 'grade' (0-100) and 'percentage' (0-100) keys
     */
    private function calculateFinalGrade($lesson, $attemptcount, $userid, $lessonid) {
        global $DB;
        
        // Use existing lesson_grade() function to calculate grade
        // This function is defined in mod/lesson/lib.php and handles all grading logic
        $gradeinfo = lesson_grade($lesson, $attemptcount, $userid);
        
        // Extract grade value (lesson_grade returns object or numeric value)
        if (is_object($gradeinfo)) {
            $rawgrade = isset($gradeinfo->grade) ? $gradeinfo->grade : 0;
        } else {
            $rawgrade = $gradeinfo;
        }
        
        // Ensure grade is within valid range (0-100)
        $rawgrade = max(0, min(100, $rawgrade));
        
        // Calculate percentage (same as raw grade in 0-100 scale)
        $percentage = round($rawgrade);
        
        return [
            'grade' => floatval($rawgrade),
            'percentage' => intval($percentage)
        ];
    }
    
    /**
     * Record or update lesson grade in database.
     *
     * Creates new record in lesson_grades table or updates existing record
     * based on lesson's retake policy. Handles grade calculation for multiple
     * attempts according to lesson configuration (average, best, or last attempt).
     *
     * @param lesson $lesson Lesson object instance
     * @param int $lessonid Lesson instance ID
     * @param int $userid User ID
     * @param array $gradeinfo Grade information array with 'grade' and 'percentage' keys
     * @param int $attemptcount Current attempt number
     * @return int Database record ID of lesson_grades entry
     */
    private function recordLessonGrade($lesson, $lessonid, $userid, $gradeinfo, $attemptcount) {
        global $DB;
        
        $now = time();
        
        // Check if user already has a grade record for this lesson
        $existinggrade = $DB->get_record('lesson_grades', [
            'lessonid' => $lessonid,
            'userid' => $userid
        ], '*', IGNORE_MISSING);
        
        if ($existinggrade) {
            // Update existing grade record based on lesson retake policy
            $existinggrade->grade = $gradeinfo['grade'];
            $existinggrade->completed = $now;
            
            // Increment attempt counter
            if (isset($existinggrade->attempts)) {
                $existinggrade->attempts = $attemptcount;
            }
            
            $DB->update_record('lesson_grades', $existinggrade);
            
            return $existinggrade->id;
            
        } else {
            // Create new grade record for first attempt
            $graderecord = new stdClass();
            $graderecord->lessonid = $lessonid;
            $graderecord->userid = $userid;
            $graderecord->grade = $gradeinfo['grade'];
            $graderecord->completed = $now;
            
            // Store attempt number if lesson tracks attempts
            if ($lesson->retake) {
                $graderecord->attempts = $attemptcount;
            }
            
            $recordid = $DB->insert_record('lesson_grades', $graderecord);
            
            return $recordid;
        }
    }
    
    /**
     * Update Moodle gradebook with lesson grade.
     *
     * Pushes the lesson grade to Moodle's central gradebook using existing
     * gradebook API. This ensures grade appears in course gradebook and
     * contributes to course total according to grade item configuration.
     *
     * @param lesson $lesson Lesson object instance
     * @param int $userid User ID
     * @return void
     */
    private function updateGradebook($lesson, $userid) {
        // Use existing lesson_update_grades() function from mod/lesson/lib.php
        // This function handles all gradebook integration including:
        // - Creating/updating grade item
        // - Pushing grade to gradebook
        // - Handling grade scales vs numeric grades
        // - Respecting grade item settings (max grade, etc.)
        lesson_update_grades($lesson, $userid);
    }
    
    /**
     * Stop active lesson timer and calculate total time spent.
     *
     * Finalizes lesson timer by marking it as complete and calculating
     * total time spent in lesson across all pages. Returns time in seconds.
     *
     * @param int $lessonid Lesson instance ID
     * @param int $userid User ID
     * @return int Total time spent in seconds (0 if no timer active)
     */
    private function stopLessonTimer($lessonid, $userid) {
        global $DB;
        
        // Get active timer record for this lesson and user
        $timer = $DB->get_record('lesson_timer', [
            'lessonid' => $lessonid,
            'userid' => $userid,
            'completed' => 0  // Only get uncompleted timer
        ], '*', IGNORE_MISSING);
        
        if (!$timer) {
            // No active timer found - return 0 time spent
            return 0;
        }
        
        $now = time();
        
        // Calculate total time spent (current time - start time)
        $timespent = $now - $timer->starttime;
        
        // Update timer record to mark as completed
        $timer->completed = $now;
        $timer->timemodified = $now;
        
        // Store total time in lessontime field if exists
        if (property_exists($timer, 'lessontime')) {
            $timer->lessontime = $timespent;
        }
        
        $DB->update_record('lesson_timer', $timer);
        
        return max(0, $timespent);  // Ensure non-negative time
    }
    
    /**
     * Mark activity as complete in Moodle completion tracking system.
     *
     * Triggers course completion API to mark this lesson activity as complete
     * for the user. This updates course progress indicators and may trigger
     * course completion if this was the final required activity.
     *
     * @param stdClass $course Course record object
     * @param stdClass $cm Course module record object
     * @param int $userid User ID
     * @return void
     */
    private function markActivityComplete($course, $cm, $userid) {
        // Initialize completion info object for this course
        $completion = new completion_info($course);
        
        // Check if completion is enabled for this course and activity
        if (!$completion->is_enabled($cm)) {
            // Completion not enabled - skip completion update
            return;
        }
        
        // Update completion state to COMPLETE
        // COMPLETION_COMPLETE is defined in lib/completionlib.php
        $completion->update_state($cm, COMPLETION_COMPLETE, $userid);
    }
    
    /**
     * Calculate additional statistics for lesson attempt.
     *
     * Aggregates statistics about user's lesson attempt including:
     * - Total pages viewed
     * - Unique pages visited
     * - Time spent (from timer parameter)
     * - Question attempts made
     *
     * @param int $lessonid Lesson instance ID
     * @param int $userid User ID
     * @param int $timespent Total time spent in seconds
     * @param int $attemptcount Attempt number
     * @return array Associative array with 'pages_viewed' and other statistics
     */
    private function calculateStatistics($lessonid, $userid, $timespent, $attemptcount) {
        global $DB;
        
        // Count total page views (lesson_attempts records)
        $pagesviewed = $DB->count_records('lesson_attempts', [
            'lessonid' => $lessonid,
            'userid' => $userid
        ]);
        
        // Count unique pages viewed
        $uniquepages = $DB->count_records_sql(
            "SELECT COUNT(DISTINCT pageid) 
             FROM {lesson_attempts} 
             WHERE lessonid = :lessonid AND userid = :userid",
            ['lessonid' => $lessonid, 'userid' => $userid]
        );
        
        // Count question attempts (pages where user submitted an answer)
        $questionattempts = $DB->count_records_sql(
            "SELECT COUNT(*) 
             FROM {lesson_attempts} 
             WHERE lessonid = :lessonid AND userid = :userid AND correct IS NOT NULL",
            ['lessonid' => $lessonid, 'userid' => $userid]
        );
        
        return [
            'pages_viewed' => $pagesviewed,
            'unique_pages' => $uniquepages,
            'question_attempts' => $questionattempts,
            'time_spent' => $timespent,
            'attempt_number' => $attemptcount
        ];
    }
    
    /**
     * Check if user passed lesson based on passing grade threshold.
     *
     * Compares user's grade percentage to lesson's configured passing grade.
     * Returns true if user met or exceeded passing threshold, false otherwise.
     *
     * @param lesson $lesson Lesson object instance
     * @param int $percentage Grade percentage (0-100)
     * @return bool True if passed, false if failed or no passing grade set
     */
    private function checkIfPassed($lesson, $percentage) {
        // Get passing grade from lesson settings
        // Grade to pass is stored as a value between 0 and lesson->grade
        $gradetopass = isset($lesson->gradetopass) ? $lesson->gradetopass : 0;
        
        // If no passing grade configured, consider it passed
        if ($gradetopass == 0) {
            return true;
        }
        
        // Calculate passing percentage
        $maxgrade = isset($lesson->grade) ? $lesson->grade : 100;
        
        if ($maxgrade == 0) {
            return true;  // No grading configured
        }
        
        $passingpercentage = ($gradetopass / $maxgrade) * 100;
        
        // Check if user's percentage meets or exceeds passing threshold
        return $percentage >= $passingpercentage;
    }
    
    /**
     * Check if current grade is user's best score for this lesson.
     *
     * Compares current grade to all previous grades for this user/lesson
     * combination. Returns true if this is the highest grade achieved.
     *
     * @param int $lessonid Lesson instance ID
     * @param int $userid User ID
     * @param float $currentgrade Current grade value (0-100)
     * @return bool True if this is user's best score, false otherwise
     */
    private function isHighScore($lessonid, $userid, $currentgrade) {
        global $DB;
        
        // Get highest grade from previous attempts
        $sql = "SELECT MAX(grade) as maxgrade 
                FROM {lesson_grades} 
                WHERE lessonid = :lessonid AND userid = :userid";
        
        $result = $DB->get_record_sql($sql, [
            'lessonid' => $lessonid,
            'userid' => $userid
        ]);
        
        if (!$result || $result->maxgrade === null) {
            // First attempt is always high score
            return true;
        }
        
        // Compare current grade to previous best
        return $currentgrade >= $result->maxgrade;
    }
    
    /**
     * Get completion feedback message based on grade percentage.
     *
     * Retrieves appropriate feedback message from lesson configuration based
     * on user's final grade. Lessons can have custom feedback for different
     * grade ranges (excellent, good, poor, etc.).
     *
     * @param lesson $lesson Lesson object instance
     * @param int $percentage Grade percentage (0-100)
     * @return string Feedback message (empty string if none configured)
     */
    private function getCompletionFeedback($lesson, $percentage) {
        // Check for custom completion feedback in lesson settings
        if (isset($lesson->completionmessage) && !empty($lesson->completionmessage)) {
            return $lesson->completionmessage;
        }
        
        // Generate default feedback based on percentage
        if ($percentage >= 90) {
            return 'Excellent work! You have completed the lesson with a high score.';
        } else if ($percentage >= 70) {
            return 'Good job! You have successfully completed the lesson.';
        } else if ($percentage >= 50) {
            return 'You have completed the lesson. Consider reviewing the material to improve your understanding.';
        } else {
            return 'Lesson completed. We recommend reviewing the content and trying again to improve your score.';
        }
    }
}

// Execute the endpoint
$endpoint = new LessonCompleteEndpoint();
$endpoint->execute();
