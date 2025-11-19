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
 * REST API endpoint for retrieving lesson page details.
 *
 * Handles GET /api/v1/lesson/pages/{id} requests to return a specific lesson page
 * with its content, answers, and navigation information. This endpoint enables the
 * React frontend to render lesson pages with proper question types, answer options,
 * and navigation controls while preserving Moodle's branching and adaptive learning
 * features.
 *
 * Page Types Supported:
 * - Question pages: multiple choice, true/false, short answer, numeric, matching, essay
 * - Content pages: static content with navigation
 * - Branch tables: lesson navigation control pages
 * - Cluster pages: group pages for random question selection
 * - End of branch/cluster pages: control flow pages
 *
 * Response includes:
 * - Page properties: id, lessonid, title, content (HTML), qtype (question type)
 * - Answer choices: id, text, response (feedback), jumpto (navigation), score
 * - Navigation context: previous/next page availability, lesson name
 * - Layout settings: qoption, layout, display parameters
 *
 * The endpoint wraps existing Moodle lesson page functions and enforces
 * mod/lesson:view capability checking. All business logic for page rendering,
 * answer processing, and branching remains in existing Moodle core functions.
 *
 * @package    api
 * @subpackage lesson
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Load Moodle configuration
require_once(__DIR__ . '/../../../config.php');

// Load API base class and exception handling
require_once(__DIR__ . '/../../lib/api_base.php');
require_once(__DIR__ . '/../../lib/api_exception.php');

/**
 * Lesson Page Endpoint - retrieves individual lesson page with content and answers.
 *
 * This endpoint extends ApiBase to provide JWT-authenticated access to lesson page data.
 * It delegates all business logic to existing Moodle lesson page methods, ensuring
 * consistent behavior with the PHP-rendered lesson interface.
 *
 * Example usage:
 * GET /api/v1/lesson/pages/123
 * Authorization: Bearer <jwt_token>
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "id": 123,
 *     "lessonid": 5,
 *     "prevpageid": 122,
 *     "nextpageid": 124,
 *     "qtype": 3,
 *     "title": "What is the capital of France?",
 *     "contents": "<p>Select the correct answer:</p>",
 *     "answers": [
 *       {
 *         "id": 1,
 *         "answerid": 456,
 *         "answer": "Paris",
 *         "response": "Correct!",
 *         "jumpto": 124,
 *         "score": 1
 *       },
 *       {
 *         "id": 2,
 *         "answerid": 457,
 *         "answer": "London",
 *         "response": "Incorrect. Paris is the capital of France.",
 *         "jumpto": 123,
 *         "score": 0
 *       }
 *     ],
 *     "is_question_page": true,
 *     "qoption": 0,
 *     "layout": 1,
 *     "display": 1,
 *     "has_previous": true,
 *     "has_next": true,
 *     "lesson_name": "Introduction to Geography"
 *   }
 * }
 */
class LessonPageEndpoint extends ApiBase {
    
    /**
     * Handle GET request for lesson page details.
     *
     * Extracts page ID from URI, loads the lesson page using existing Moodle functions,
     * checks user permissions, and returns formatted page data including content,
     * answers, and navigation context.
     *
     * URI Pattern: /api/v1/lesson/pages/{id}
     * HTTP Method: GET
     * Authentication: Required (JWT)
     * Required Capability: mod/lesson:view
     *
     * @return void Outputs JSON response via success() method
     * @throws NotFoundException If page ID cannot be extracted or page does not exist
     * @throws ForbiddenException If user lacks mod/lesson:view capability
     */
    protected function handle_get() {
        global $DB, $CFG;
        
        // Extract page ID from URI using regex pattern
        // Pattern matches: /api/v1/lesson/pages/123 or /lesson/pages/123
        $pattern = '/\/lesson\/pages\/(\d+)$/';
        $matches = [];
        
        if (!preg_match($pattern, $this->requestUri, $matches)) {
            throw new NotFoundException('Invalid lesson page URL format', [
                'uri' => $this->requestUri,
                'expectedPattern' => '/api/v1/lesson/pages/{id}',
                'reason' => 'Page ID could not be extracted from URI'
            ]);
        }
        
        $pageid = (int)$matches[1];
        
        // Load Moodle lesson library for lesson class and page classes
        require_once($CFG->dirroot . '/mod/lesson/locallib.php');
        
        // Get page record from database
        $page = $DB->get_record('lesson_pages', ['id' => $pageid], '*');
        
        if (!$page) {
            throw new NotFoundException('Lesson page not found', [
                'pageId' => $pageid,
                'reason' => 'No lesson page exists with this ID'
            ]);
        }
        
        // Load lesson instance using existing lesson class
        try {
            $lessonrecord = $DB->get_record('lesson', ['id' => $page->lessonid], '*', MUST_EXIST);
            
            // Get course module for capability checking
            $cm = get_coursemodule_from_instance('lesson', $page->lessonid, 0, false, MUST_EXIST);
            
            // Create lesson object with all dependencies
            $course = $DB->get_record('course', ['id' => $cm->course], '*', MUST_EXIST);
            $lesson = new lesson($lessonrecord, $cm, $course);
            
        } catch (Exception $e) {
            throw new NotFoundException('Lesson not found for this page', [
                'lessonId' => $page->lessonid,
                'pageId' => $pageid,
                'originalError' => $e->getMessage()
            ]);
        }
        
        // Check capability: user must have permission to view the lesson
        $context = context_module::instance($cm->id);
        $this->checkCapability('mod/lesson:view', $context);
        
        // Load the page object using lesson's load_page method
        // This returns the appropriate page type object (lesson_page_question, lesson_page_content, etc.)
        $pageobj = $lesson->load_page($pageid);
        
        if (!$pageobj) {
            throw new NotFoundException('Failed to load lesson page object', [
                'pageId' => $pageid,
                'lessonId' => $page->lessonid,
                'reason' => 'Page object could not be instantiated'
            ]);
        }
        
        // Build response data array with page properties
        $responseData = [
            'id' => (int)$page->id,
            'lessonid' => (int)$page->lessonid,
            'prevpageid' => (int)$page->prevpageid,
            'nextpageid' => (int)$page->nextpageid,
            'qtype' => (int)$page->qtype,
            'title' => $page->title,
            'contents' => $page->contents,
        ];
        
        // Get page answers using page object's get_answers method
        // This returns an array of answer objects for this page
        $answers = $pageobj->get_answers();
        $formattedAnswers = [];
        
        if ($answers) {
            foreach ($answers as $answer) {
                $formattedAnswers[] = [
                    'id' => (int)$answer->id,
                    'answerid' => (int)$answer->answerid,
                    'answer' => $answer->answer ?? '',
                    'response' => $answer->response ?? '',
                    'jumpto' => (int)$answer->jumpto,
                    'score' => isset($answer->score) ? (float)$answer->score : 0.0,
                ];
            }
        }
        
        $responseData['answers'] = $formattedAnswers;
        
        // Determine if this is a question page
        // Question pages have qtype > 0 and not a branch table
        $isQuestionPage = false;
        if (defined('LESSON_PAGE_BRANCHTABLE')) {
            $isQuestionPage = ($page->qtype > 0 && $page->qtype != LESSON_PAGE_BRANCHTABLE);
        } else {
            // Fallback if constant not defined: assume qtype > 0 means question page
            $isQuestionPage = ($page->qtype > 0);
        }
        
        $responseData['is_question_page'] = $isQuestionPage;
        
        // Add layout information from page record
        $responseData['qoption'] = isset($page->qoption) ? (int)$page->qoption : 0;
        $responseData['layout'] = isset($page->layout) ? (int)$page->layout : 0;
        $responseData['display'] = isset($page->display) ? (int)$page->display : 0;
        
        // Add navigation context
        $responseData['has_previous'] = ($page->prevpageid > 0);
        $responseData['has_next'] = ($page->nextpageid > 0);
        $responseData['lesson_name'] = $lesson->name;
        
        // Return success response with formatted page data
        $this->success($responseData);
    }
    
    /**
     * Handle POST request - not supported for this endpoint.
     *
     * @throws MethodNotAllowedException Always, as POST is not supported
     */
    protected function handle_post() {
        throw new MethodNotAllowedException('POST method is not supported for lesson page retrieval', [
            'allowedMethods' => ['GET']
        ]);
    }
    
    /**
     * Handle PUT request - not supported for this endpoint.
     *
     * @throws MethodNotAllowedException Always, as PUT is not supported
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method is not supported for lesson page retrieval', [
            'allowedMethods' => ['GET']
        ]);
    }
    
    /**
     * Handle DELETE request - not supported for this endpoint.
     *
     * @throws MethodNotAllowedException Always, as DELETE is not supported
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method is not supported for lesson page retrieval', [
            'allowedMethods' => ['GET']
        ]);
    }
}

// Instantiate and execute the endpoint
// Skip auto-execution in test mode to allow manual instantiation
if (!defined('API_TEST_MODE') || !API_TEST_MODE) {
    $endpoint = new LessonPageEndpoint();
    $endpoint->execute();
}
