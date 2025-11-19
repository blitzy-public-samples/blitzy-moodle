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
 * REST API endpoint for retrieving quiz questions structure.
 *
 * Provides GET /api/v1/quizzes/{id}/questions endpoint that retrieves
 * all questions in a quiz to display quiz structure and question metadata
 * before students attempt the quiz. This endpoint enables React quiz
 * interface to show quiz overview, question distribution, question types,
 * and help students understand what to expect in the quiz.
 *
 * Delegates to existing Moodle quiz functions without duplicating business logic:
 * - mod_quiz\quiz_settings::create() for quiz object instantiation
 * - quiz_settings::preload_questions() for loading question data
 * - quiz_settings::get_questions() for question slot retrieval
 * - require_capability() for permission validation (mod/quiz:view, mod/quiz:preview)
 *
 * Returns comprehensive question metadata including:
 * - Question slot number and ID
 * - Question type (multichoice, truefalse, shortanswer, essay, etc.)
 * - Question text (formatted HTML or plain text based on permissions)
 * - Maximum marks for each question
 * - Page number within the quiz
 * - Question options/choices (if applicable and permitted)
 * - Question bank category information
 *
 * Respects quiz settings for question visibility before attempts start.
 * Some quizzes may restrict viewing questions until attempt is active.
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

// Import quiz namespace classes
use mod_quiz\quiz_settings;

/**
 * Quiz Questions API Endpoint.
 *
 * Handles GET requests to /api/v1/quizzes/{id}/questions for retrieving
 * all questions in a quiz to display quiz structure and question metadata.
 * Returns question data with type, text, marks, and page information to help
 * students understand the quiz before attempting it.
 *
 * Authentication: Required via JWT token
 * Authorization: User must have mod/quiz:view capability (and optionally mod/quiz:preview)
 * HTTP Method: GET only
 *
 * Response includes:
 * - questions: Array of question metadata with slot, type, text, marks, page
 * - totalQuestions: Total number of questions in the quiz
 * - totalPages: Number of pages in the quiz
 * - questionTypes: Summary of question types used
 * - totalMarks: Sum of all question marks
 *
 * @package    api
 * @subpackage quizzes
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class QuizQuestionsEndpoint extends ApiBase {
    
    /**
     * Handle GET request for quiz questions structure.
     *
     * Extracts quiz ID from URL path, validates user has permission to view
     * the quiz, retrieves question data using existing Moodle quiz functions,
     * enriches questions with metadata like type, marks, and page number,
     * and returns formatted question information for React quiz interface.
     *
     * URL Pattern: /api/v1/quizzes/{id}/questions
     * Example: /api/v1/quizzes/123/questions
     *
     * @return void Outputs JSON response with questions metadata
     * @throws ValidationException If quiz ID is invalid
     * @throws NotFoundException If quiz does not exist
     * @throws ForbiddenException If user lacks permission to view quiz
     * @throws ApiException If questions cannot be retrieved
     */
    protected function handle_get() {
        global $DB, $USER;
        
        // Validate user is authenticated via JWT token
        $authenticatedUser = $this->getUser();
        
        // Extract quiz ID from URL path using regex
        // Pattern matches: /quizzes/{quizid}/questions
        if (!preg_match('/\/quizzes\/(\d+)\/questions$/', $this->requestUri, $matches)) {
            throw new ValidationException('Invalid URL format', [
                'expected' => '/api/v1/quizzes/{id}/questions',
                'received' => $this->requestUri,
                'reason' => 'Quiz ID must be specified in URL path'
            ]);
        }
        
        $quizid = intval($matches[1]);
        
        // Validate quiz ID is positive integer
        if (!$quizid || $quizid <= 0) {
            throw new ValidationException('Invalid quiz ID', [
                'quizId' => $quizid,
                'reason' => 'Quiz ID must be a positive integer'
            ]);
        }
        
        // Create quiz settings object using existing Moodle function
        // This delegates to Moodle core without duplicating business logic
        try {
            $quizobj = quiz_settings::create($quizid, $USER->id);
        } catch (moodle_exception $e) {
            throw new NotFoundException('Quiz not found', [
                'quizId' => $quizid,
                'reason' => $e->getMessage()
            ]);
        }
        
        // Get context for capability checking
        $context = $quizobj->get_context();
        
        // Check if user has permission to view quiz
        // This enforces the same permission checks as PHP pages
        try {
            require_capability('mod/quiz:view', $context);
        } catch (moodle_exception $e) {
            throw new ForbiddenException('You do not have permission to view this quiz', [
                'quizId' => $quizid,
                'capability' => 'mod/quiz:view',
                'reason' => $e->getMessage()
            ]);
        }
        
        // Check if user has preview capability to view question details
        // Some quizzes may restrict viewing questions before attempt starts
        $canPreview = has_capability('mod/quiz:preview', $context);
        
        // Load question data using existing Moodle functions
        // preload_questions() loads the question bank data for all questions
        $quizobj->preload_questions();
        
        // Get questions array from quiz object
        // Second parameter false means we don't want only visible questions
        $questions = $quizobj->get_questions(null, false);
        
        // Track statistics for summary
        $totalMarks = 0;
        $questionTypes = [];
        $pageNumbers = [];
        
        // Build enriched questions array with metadata
        $questionsData = [];
        
        foreach ($questions as $question) {
            // Extract question type name
            $questionType = $question->qtype;
            
            // Track question types for summary
            if (!isset($questionTypes[$questionType])) {
                $questionTypes[$questionType] = 0;
            }
            $questionTypes[$questionType]++;
            
            // Get maximum marks for this question
            $maxmark = $question->maxmark;
            $totalMarks += $maxmark;
            
            // Get page number
            $page = $question->page;
            if (!in_array($page, $pageNumbers)) {
                $pageNumbers[] = $page;
            }
            
            // Build base question data
            $questionData = [
                'id' => $question->id,
                'slot' => $question->slot,
                'page' => $page,
                'questionNumber' => $question->number,
                'type' => $questionType,
                'name' => $question->name,
                'maxMark' => (float)$maxmark,
            ];
            
            // Add question text if user has preview capability or quiz allows viewing
            // Some quizzes may hide question text until attempt starts
            if ($canPreview || !empty($question->questiontext)) {
                // Format question text for display
                // Use format_text to handle HTML and plugins
                $questionData['questionText'] = format_text(
                    $question->questiontext,
                    $question->questiontextformat,
                    ['context' => $context]
                );
                $questionData['questionTextFormat'] = $question->questiontextformat;
            }
            
            // Add question category information if available
            if (!empty($question->category)) {
                $questionData['categoryId'] = $question->category;
            }
            
            // Add length (estimated time) if set
            if (!empty($question->length)) {
                $questionData['length'] = $question->length;
            }
            
            // Add question options for certain question types if user can preview
            if ($canPreview && in_array($questionType, ['multichoice', 'truefalse', 'shortanswer'])) {
                // Get question type plugin to access options
                try {
                    $qtypeclass = 'qtype_' . $questionType;
                    if (class_exists($qtypeclass)) {
                        // Load question options from database
                        $optionsTable = 'qtype_' . $questionType . '_options';
                        
                        // Check if options table exists and load options
                        if ($DB->get_manager()->table_exists($optionsTable)) {
                            $options = $DB->get_record($optionsTable, ['questionid' => $question->id]);
                            
                            if ($options) {
                                $questionData['questionOptions'] = [
                                    'shuffleAnswers' => isset($options->shuffleanswers) ? (bool)$options->shuffleanswers : false,
                                ];
                                
                                // For multichoice, include answer count
                                if ($questionType === 'multichoice') {
                                    $answerCount = $DB->count_records('question_answers', ['question' => $question->id]);
                                    $questionData['questionOptions']['answerCount'] = $answerCount;
                                    $questionData['questionOptions']['single'] = isset($options->single) ? (bool)$options->single : false;
                                }
                            }
                        }
                    }
                } catch (Exception $e) {
                    // If we can't load options, just skip them
                    // Don't fail the entire request due to optional data
                }
            }
            
            $questionsData[] = $questionData;
        }
        
        // Sort page numbers to get total pages count
        sort($pageNumbers);
        $totalPages = !empty($pageNumbers) ? max($pageNumbers) + 1 : 1;
        
        // Build question types summary array
        $questionTypesSummary = [];
        foreach ($questionTypes as $type => $count) {
            $questionTypesSummary[] = [
                'type' => $type,
                'count' => $count,
            ];
        }
        
        // Build complete response with questions and summary data
        $responseData = [
            'questions' => $questionsData,
            'totalQuestions' => count($questionsData),
            'totalPages' => $totalPages,
            'totalMarks' => (float)$totalMarks,
            'questionTypes' => $questionTypesSummary,
        ];
        
        // Return success response with questions metadata
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
            'POST method is not allowed for quiz questions endpoint',
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
            'PUT method is not allowed for quiz questions endpoint',
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
            'DELETE method is not allowed for quiz questions endpoint',
            [
                'allowedMethods' => ['GET'],
                'requestedMethod' => 'DELETE'
            ]
        );
    }
}

// Instantiate and execute the endpoint

// Execute the endpoint if not in test mode
if (!defined('API_TEST_MODE')) {
    $endpoint = new QuizQuestionsEndpoint();
    $endpoint->execute();
}
