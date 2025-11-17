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
 * REST API endpoint for submitting user answers to lesson page questions.
 *
 * Handles POST /api/v1/lesson/pages/{id}/answer requests to process student
 * responses, validate answers, record attempts in the database, provide immediate
 * feedback, calculate scores, determine next page based on branching logic, and
 * update lesson progress.
 *
 * This endpoint serves as a thin wrapper around existing Moodle lesson functions,
 * specifically leveraging the lesson::process_page_responses() method to handle
 * all answer processing logic. It enforces capability checks, validates JSON
 * request bodies, creates attempt records, applies lesson branching rules to
 * determine navigation, and returns structured feedback with correctness
 * indicators, scores, and next page information.
 *
 * Request Format:
 * POST /api/v1/lesson/pages/{id}/answer
 * Content-Type: application/json
 * Authorization: Bearer <jwt_token>
 *
 * {
 *   "answerid": 123,              // Required: ID of selected answer
 *   "answer_text": "Essay text"   // Optional: For essay-type questions
 * }
 *
 * Response Format:
 * {
 *   "success": true,
 *   "data": {
 *     "correct": true,
 *     "feedback": "Correct! Well done.",
 *     "score": 10,
 *     "max_score": 10,
 *     "next_page_id": 5,
 *     "requires_grading": false,
 *     "attempts_remaining": null,
 *     "lesson_completed": false
 *   }
 * }
 *
 * @package    api
 * @subpackage v1/lesson
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Load API base class and exception handlers
require_once(__DIR__ . '/../../lib/api_base.php');
require_once(__DIR__ . '/../../lib/api_exception.php');

/**
 * API endpoint class for lesson answer submission.
 *
 * Extends ApiBase to inherit JWT authentication, request routing, and response
 * formatting. Implements handle_post() to process answer submissions through
 * the existing Moodle lesson answer processing pipeline.
 */
class LessonAnswerEndpoint extends ApiBase {
    
    /**
     * Handle GET requests - not supported for this endpoint.
     *
     * Answer submission requires POST method. GET requests are rejected
     * with a 405 Method Not Allowed error.
     *
     * @throws MethodNotAllowedException Always thrown for GET requests
     */
    protected function handle_get() {
        throw new MethodNotAllowedException('GET method not supported for answer submission', [
            'allowedMethods' => ['POST'],
            'reason' => 'Answer submission requires POST method with JSON body'
        ]);
    }
    
    /**
     * Handle POST requests for answer submission.
     *
     * Processes the complete answer submission workflow:
     * 1. Extract page ID from URI using regex pattern matching
     * 2. Parse and validate JSON request body
     * 3. Load lesson page and verify access permissions
     * 4. Check lesson is not in review mode (read-only)
     * 5. Process answer through existing Moodle lesson logic
     * 6. Update lesson timer for timed lessons
     * 7. Build and return structured response with feedback and navigation
     *
     * @return void Outputs JSON response via success() method
     * @throws NotFoundException If page ID cannot be extracted from URI
     * @throws ValidationException If request body is invalid or lesson in review mode
     * @throws ForbiddenException If user lacks mod/lesson:view capability
     */
    protected function handle_post() {
        global $DB, $USER, $PAGE, $CFG;
        
        // Load Moodle lesson library for lesson class and constants
        require_once($CFG->dirroot . '/mod/lesson/locallib.php');
        
        // Step 1: Extract page ID from request URI
        // Pattern matches: /api/v1/lesson/pages/123/answer
        if (!preg_match('/\/lesson\/pages\/(\d+)\/answer$/', $this->requestUri, $matches)) {
            throw new NotFoundException('Invalid lesson page URL format', [
                'requestUri' => $this->requestUri,
                'expectedPattern' => '/api/v1/lesson/pages/{id}/answer',
                'reason' => 'Page ID could not be extracted from URI'
            ]);
        }
        
        $pageid = (int)$matches[1];
        
        // Step 2: Get and validate JSON request body
        $data = $this->getJsonBody();
        
        // Validate required field: answerid
        if (!isset($data['answerid']) || empty($data['answerid'])) {
            throw new ValidationException('Missing required field: answerid', [
                'field' => 'answerid',
                'required' => true,
                'received' => isset($data['answerid']) ? $data['answerid'] : null,
                'reason' => 'Answer ID must be provided to identify the selected answer'
            ]);
        }
        
        $answerid = (int)$data['answerid'];
        
        // Extract optional answer_text for essay questions
        $answerText = isset($data['answer_text']) ? $data['answer_text'] : null;
        
        // Step 3: Load lesson page and associated lesson
        $page = $DB->get_record('lesson_pages', ['id' => $pageid], '*', MUST_EXIST);
        
        if (!$page) {
            throw new NotFoundException('Lesson page not found', [
                'pageId' => $pageid,
                'reason' => 'The specified lesson page does not exist'
            ]);
        }
        
        // Load the lesson record
        $lessonRecord = $DB->get_record('lesson', ['id' => $page->lessonid], '*', MUST_EXIST);
        
        if (!$lessonRecord) {
            throw new NotFoundException('Lesson not found', [
                'lessonId' => $page->lessonid,
                'reason' => 'The lesson associated with this page does not exist'
            ]);
        }
        
        // Get course module
        $cm = get_coursemodule_from_instance('lesson', $lessonRecord->id, 0, false, MUST_EXIST);
        
        if (!$cm) {
            throw new NotFoundException('Course module not found', [
                'lessonId' => $lessonRecord->id,
                'reason' => 'The course module for this lesson does not exist'
            ]);
        }
        
        // Get course
        $course = $DB->get_record('course', ['id' => $cm->course], '*', MUST_EXIST);
        
        // Step 4: Check user permissions
        // Verify user has mod/lesson:view capability
        $context = context_module::instance($cm->id);
        $this->checkCapability('mod/lesson:view', $context);
        
        // Step 5: Initialize lesson object with all dependencies
        $lesson = new lesson($lessonRecord, $cm, $course);
        
        // Apply overrides for this user (time limits, password, etc.)
        $lesson->update_effective_access($USER->id);
        
        // Step 6: Check if lesson is in review mode
        $reviewmode = $lesson->is_in_review_mode();
        
        if ($reviewmode) {
            throw new ValidationException('Cannot submit answers in review mode', [
                'reason' => 'Lesson is in review mode and does not accept new submissions',
                'reviewMode' => true,
                'action' => 'Review mode is read-only. Answers cannot be submitted.'
            ]);
        }
        
        // Step 7: Check time limits for timed lessons
        $canmanage = $lesson->can_manage();
        
        if (!$canmanage) {
            // Update timer and check if time has expired
            $timer = $lesson->update_timer();
            
            if (!$lesson->check_time($timer)) {
                throw new ValidationException('Time limit exceeded', [
                    'reason' => 'The time limit for this lesson has expired',
                    'timeExpired' => true,
                    'action' => 'You have run out of time for this lesson'
                ]);
            }
        }
        
        // Step 8: Load the page object with question type
        $pageobj = $lesson->load_page($pageid);
        
        if (!$pageobj) {
            throw new NotFoundException('Lesson page object could not be loaded', [
                'pageId' => $pageid,
                'reason' => 'Failed to initialize page object from lesson class'
            ]);
        }
        
        // Step 9: Set $_POST superglobal for compatibility with existing Moodle functions
        // The lesson::process_page_responses() method expects answer data in $_POST
        $_POST['answerid'] = $answerid;
        
        if ($answerText !== null) {
            $_POST['answer_text'] = $answerText;
        }
        
        // Also set pageid in POST for internal processing
        $_POST['pageid'] = $pageid;
        
        // Step 10: Process the answer through existing Moodle lesson logic
        // This delegates all business logic to the lesson class
        $result = $lesson->process_page_responses($pageobj);
        
        // Step 11: Extract result properties from stdClass object
        // The result object contains:
        // - correctanswer (bool): Whether answer was correct
        // - feedback (string): HTML feedback message
        // - newpageid (int): ID of next page to navigate to
        // - score (int): Points earned for this answer
        // - maxscore (int): Maximum points possible
        // - noanswer (bool): Whether user provided no answer
        // - isessayquestion (bool): Whether this is an essay question
        // - maxattemptsreached (bool): Whether max attempts limit reached
        
        $correct = isset($result->correctanswer) ? (bool)$result->correctanswer : false;
        $feedback = isset($result->feedback) ? $result->feedback : '';
        $newpageid = isset($result->newpageid) ? (int)$result->newpageid : null;
        $score = isset($result->score) ? (int)$result->score : 0;
        $maxscore = isset($result->maxscore) ? (int)$result->maxscore : 0;
        $noanswer = isset($result->noanswer) ? (bool)$result->noanswer : false;
        $isessayquestion = isset($result->isessayquestion) ? (bool)$result->isessayquestion : false;
        $maxattemptsreached = isset($result->maxattemptsreached) ? (bool)$result->maxattemptsreached : false;
        
        // Step 12: Determine if this is an essay question requiring grading
        $requiresGrading = false;
        
        if ($isessayquestion) {
            // Essay questions always require manual grading by instructor
            $requiresGrading = true;
        }
        
        // Step 13: Calculate remaining attempts (if review is enabled and max not reached)
        $attemptsRemaining = null;
        
        if ($lesson->review && !$maxattemptsreached && !$correct && !$isessayquestion) {
            // User can retry this question
            // Moodle doesn't track exact number of remaining attempts in result object,
            // but the presence of review option and max not reached indicates retries available
            $attemptsRemaining = 'available';
        } else if ($maxattemptsreached) {
            $attemptsRemaining = 0;
        }
        
        // Step 14: Determine if lesson is completed
        // LESSON_EOL constant (-9) indicates End of Lesson
        $lessonCompleted = false;
        
        if ($newpageid === LESSON_EOL || $newpageid === -9) {
            $lessonCompleted = true;
        }
        
        // Step 15: Update lesson timer for timed lessons
        // This must be called after processing to accurately track time spent
        if (!$canmanage && isset($timer)) {
            $lesson->update_timer();
        }
        
        // Step 16: Build response data structure
        $responseData = [
            'correct' => $correct,
            'feedback' => strip_tags($feedback), // Remove HTML tags for API response
            'score' => $score,
            'max_score' => $maxscore,
            'next_page_id' => $newpageid,
            'requires_grading' => $requiresGrading,
            'attempts_remaining' => $attemptsRemaining,
            'lesson_completed' => $lessonCompleted,
            'no_answer' => $noanswer,
            'is_essay_question' => $isessayquestion,
            'max_attempts_reached' => $maxattemptsreached
        ];
        
        // Step 17: Return success response
        $this->success($responseData);
    }
    
    /**
     * Handle PUT requests - not supported for this endpoint.
     *
     * Answer submission uses POST method. PUT requests are rejected.
     *
     * @throws MethodNotAllowedException Always thrown for PUT requests
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method not supported for answer submission', [
            'allowedMethods' => ['POST'],
            'reason' => 'Use POST method to submit answers'
        ]);
    }
    
    /**
     * Handle DELETE requests - not supported for this endpoint.
     *
     * Answers cannot be deleted after submission. DELETE requests are rejected.
     *
     * @throws MethodNotAllowedException Always thrown for DELETE requests
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method not supported for answer submission', [
            'allowedMethods' => ['POST'],
            'reason' => 'Answers cannot be deleted after submission'
        ]);
    }
}

// Instantiate and execute the endpoint
// Skip auto-execution in test mode to allow manual instantiation
if (!defined('API_TEST_MODE') || !API_TEST_MODE) {
    $endpoint = new LessonAnswerEndpoint();
    $endpoint->execute();
}
