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
 * API endpoint for retrieving authenticated user's response to a choice activity.
 *
 * This endpoint returns the current user's selected option(s) for a choice activity
 * in JSON format for display in the React frontend. Supports both single and multiple
 * selection choice types.
 *
 * GET /api/v1/choice/{id}/myresponse
 *
 * Request Parameters:
 * - id (int): Choice course module ID (from URL path)
 *
 * Response Format (Success):
 * {
 *   "success": true,
 *   "data": {
 *     "responses": [
 *       {
 *         "id": 123,
 *         "optionid": 5,
 *         "optiontext": "Option A",
 *         "timemodified": 1609459200
 *       }
 *     ],
 *     "hasresponded": true,
 *     "allowmultiple": false
 *   }
 * }
 *
 * Response Format (No Response):
 * {
 *   "success": true,
 *   "data": {
 *     "responses": [],
 *     "hasresponded": false,
 *     "allowmultiple": false
 *   }
 * }
 *
 * Error Responses:
 * - 400: Invalid or missing choice ID
 * - 401: Authentication required (no JWT token)
 * - 403: Permission denied (lacks mod/choice:view capability)
 * - 404: Choice activity not found
 * - 500: Internal server error
 *
 * @package    api
 * @subpackage choice
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Load API base class and utilities
require_once(__DIR__ . '/../../lib/api_base.php');

// Load Moodle choice module library functions
require_once($CFG->dirroot . '/mod/choice/lib.php');

/**
 * Choice My Response API endpoint class.
 *
 * Handles GET requests to retrieve the authenticated user's own response
 * to a choice activity. Returns empty array if user has not yet responded.
 */
class ChoiceMyResponseEndpoint extends ApiBase {
    
    /**
     * Handle GET request to retrieve user's choice response.
     *
     * Workflow:
     * 1. Validate JWT token (handled by ApiBase constructor)
     * 2. Extract choice ID from URL parameter
     * 3. Validate course module exists using get_coursemodule_from_id()
     * 4. Enforce permission check using require_capability('mod/choice:view')
     * 5. Retrieve choice object with options using choice_get_choice()
     * 6. Retrieve user's response(s) using choice_get_my_response()
     * 7. Map response IDs to option text for display
     * 8. Return standardized JSON response with response data
     *
     * @return void Outputs JSON response directly
     * @throws ValidationException If choice ID is invalid or missing
     * @throws NotFoundException If choice or course module not found
     * @throws ForbiddenException If user lacks required capability
     */
    protected function handle_get() {
        global $DB;
        
        // Get authenticated user from JWT token
        $user = $this->getUser();
        
        // Extract choice ID from URL parameter (course module ID)
        $cmid = $this->getParam('id', PARAM_INT, true);
        
        // Validate and retrieve course module
        $cm = get_coursemodule_from_id('choice', $cmid, 0, false, MUST_EXIST);
        
        if (!$cm) {
            throw new NotFoundException('Choice activity not found', [
                'cmid' => $cmid,
                'reason' => 'Course module does not exist or is not a choice activity'
            ]);
        }
        
        // Get course for context validation
        $course = $DB->get_record('course', ['id' => $cm->course], '*', MUST_EXIST);
        
        if (!$course) {
            throw new NotFoundException('Course not found', [
                'courseid' => $cm->course,
                'reason' => 'Course associated with choice activity does not exist'
            ]);
        }
        
        // Get module context for capability checking
        $context = context_module::instance($cm->id);
        
        // Enforce permission check - user must have view capability
        $this->checkCapability('mod/choice:view', $context);
        
        // Retrieve choice object with options using existing Moodle function
        $choice = choice_get_choice($cm->instance);
        
        if (!$choice) {
            throw new NotFoundException('Choice activity data not found', [
                'choiceid' => $cm->instance,
                'cmid' => $cmid,
                'reason' => 'Choice record does not exist in database'
            ]);
        }
        
        // Retrieve user's current response(s) using existing Moodle function
        // This returns an array of choice_answers records for this user
        $userResponses = choice_get_my_response($choice);
        
        // Build response data with option details
        $responses = [];
        $hasResponded = false;
        
        if (!empty($userResponses)) {
            $hasResponded = true;
            
            foreach ($userResponses as $response) {
                // Get option text for this response
                $optionText = '';
                
                // Check if option exists in choice options
                if (isset($choice->option[$response->optionid])) {
                    $optionText = $choice->option[$response->optionid];
                } else {
                    // Fallback: retrieve directly from database if not in choice object
                    $option = $DB->get_record('choice_options', ['id' => $response->optionid]);
                    $optionText = $option ? $option->text : get_string('notanswered', 'choice');
                }
                
                // Add response details to array
                $responses[] = [
                    'id' => (int) $response->id,
                    'optionid' => (int) $response->optionid,
                    'optiontext' => $optionText,
                    'timemodified' => (int) $response->timemodified
                ];
            }
        }
        
        // Prepare response data
        $data = [
            'responses' => $responses,
            'hasresponded' => $hasResponded,
            'allowmultiple' => (bool) $choice->allowmultiple,
            'choiceid' => (int) $choice->id,
            'choicename' => $choice->name
        ];
        
        // Return success response with user's choice data
        $this->success($data, 200);
    }
    
    /**
     * Handle POST requests - not supported for this endpoint.
     *
     * @throws MethodNotAllowedException Always - POST not supported
     */
    protected function handle_post() {
        throw new MethodNotAllowedException('POST method not supported for myresponse endpoint', [
            'endpoint' => '/api/v1/choice/{id}/myresponse',
            'allowedMethods' => ['GET'],
            'hint' => 'Use POST /api/v1/choice/{id}/submit to submit a new response'
        ]);
    }
    
    /**
     * Handle PUT requests - not supported for this endpoint.
     *
     * @throws MethodNotAllowedException Always - PUT not supported
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method not supported for myresponse endpoint', [
            'endpoint' => '/api/v1/choice/{id}/myresponse',
            'allowedMethods' => ['GET'],
            'hint' => 'Use POST /api/v1/choice/{id}/submit to submit a new response'
        ]);
    }
    
    /**
     * Handle DELETE requests - not supported for this endpoint.
     *
     * @throws MethodNotAllowedException Always - DELETE not supported
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method not supported for myresponse endpoint', [
            'endpoint' => '/api/v1/choice/{id}/myresponse',
            'allowedMethods' => ['GET'],
            'hint' => 'Use DELETE /api/v1/choice/{id}/response to delete a response if allowed'
        ]);
    }
}

// Instantiate and execute the endpoint (skip during testing)
if (!defined('API_TESTING') && php_sapi_name() !== 'cli') {
    try {
        $endpoint = new ChoiceMyResponseEndpoint();
        $endpoint->execute();
    } catch (Exception $e) {
    // Handle any uncaught exceptions during instantiation
    // This should rarely happen as ApiBase and execute() handle most exceptions
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode([
        'success' => false,
        'error' => [
            'code' => 'ENDPOINT_INITIALIZATION_ERROR',
            'message' => 'Failed to initialize API endpoint',
            'details' => [
                'error' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine()
            ]
        ]
    ]);
    exit;
    }
}
