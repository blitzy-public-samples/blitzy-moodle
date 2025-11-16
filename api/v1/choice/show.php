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
 * REST API endpoint for retrieving choice activity details.
 *
 * This endpoint provides complete choice activity information including options,
 * configuration, availability status, and user response data. It wraps existing
 * Moodle choice functions without duplicating any business logic.
 *
 * Endpoint: GET /api/v1/choice/{id}
 *
 * Request:
 * - URL parameter: id (required) - Course module ID of the choice activity
 * - Headers: Authorization: Bearer <jwt_token>
 *
 * Response format (JSON):
 * {
 *   "success": true,
 *   "data": {
 *     "id": 123,
 *     "coursemodule": 456,
 *     "course": 789,
 *     "name": "Which topic interests you?",
 *     "intro": "Please select your preferred topic for next week",
 *     "introformat": 1,
 *     "options": [
 *       {
 *         "id": 1,
 *         "text": "Option A",
 *         "maxanswers": 0
 *       },
 *       {
 *         "id": 2,
 *         "text": "Option B",
 *         "maxanswers": 10
 *       }
 *     ],
 *     "allowmultiple": false,
 *     "allowupdate": true,
 *     "limitanswers": false,
 *     "showresults": 3,
 *     "publish": 1,
 *     "display": 0,
 *     "showpreview": false,
 *     "timeopen": 1234567890,
 *     "timeclose": 1234999999,
 *     "availability": {
 *       "available": true,
 *       "warnings": []
 *     },
 *     "currentresponse": [
 *       {
 *         "id": 567,
 *         "optionid": 1,
 *         "userid": 42,
 *         "timemodified": 1234888888
 *       }
 *     ]
 *   }
 * }
 *
 * Error responses:
 * - 401 Unauthorized: Missing or invalid JWT token
 * - 403 Forbidden: User lacks 'mod/choice:view' capability
 * - 404 Not Found: Choice activity or course module does not exist
 * - 500 Internal Server Error: Unexpected server error
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Load API base class and exception handlers
require_once(__DIR__ . '/../../lib/api_base.php');
require_once(__DIR__ . '/../../lib/api_exception.php');

// Load Moodle choice module library functions
require_once($CFG->dirroot . '/mod/choice/lib.php');

/**
 * Choice activity detail endpoint handler.
 *
 * Handles GET requests to retrieve complete choice activity information including
 * options, configuration, availability status, and user's current response.
 * All business logic is delegated to existing Moodle choice functions.
 */
class ChoiceShowEndpoint extends ApiBase {
    
    /**
     * Handle GET request to retrieve choice activity details.
     *
     * This method:
     * 1. Validates JWT token and authenticates user (via parent constructor)
     * 2. Retrieves choice ID from URL parameter
     * 3. Validates course module exists using get_coursemodule_from_id()
     * 4. Enforces permission check using require_capability('mod/choice:view')
     * 5. Calls choice_get_choice() to retrieve choice object with options
     * 6. Calls choice_get_availability_status() to check availability
     * 7. Retrieves user's current response using choice_get_my_response()
     * 8. Returns standardized JSON response with all choice data
     *
     * @return void Outputs JSON response directly via success() or error()
     * @throws NotFoundException If choice activity or course module not found
     * @throws ForbiddenException If user lacks required capability
     * @throws ValidationException If ID parameter is invalid
     */
    protected function handle_get() {
        global $DB;
        
        // Get authenticated user from JWT token (inherited from ApiBase)
        $user = $this->getUser();
        
        // Extract choice ID from URL parameter
        // This is the course module ID, not the choice instance ID
        $cmid = $this->getParam('id', PARAM_INT);
        
        // Validate course module exists and is a choice activity
        $cm = get_coursemodule_from_id('choice', $cmid, 0, false, MUST_EXIST);
        
        if (!$cm) {
            throw new NotFoundException('Choice activity not found', [
                'coursemodule' => $cmid,
                'reason' => 'The specified course module does not exist or is not a choice activity'
            ]);
        }
        
        // Get course module info for additional details
        $cm = cm_info::create($cm);
        
        // Get module context for permission checking
        $context = context_module::instance($cm->id);
        
        // Enforce permission check - user must have mod/choice:view capability
        // This uses Moodle's existing capability system (no business logic duplication)
        $this->checkCapability('mod/choice:view', $context);
        
        // Retrieve choice activity instance with options
        // This calls existing Moodle function - no business logic duplication
        $choice = choice_get_choice($cm->instance);
        
        if (!$choice) {
            throw new NotFoundException('Choice activity data not found', [
                'choiceid' => $cm->instance,
                'coursemodule' => $cmid,
                'reason' => 'The choice activity record does not exist in the database'
            ]);
        }
        
        // Check availability status (open/closed, time restrictions)
        // This calls existing Moodle function - no business logic duplication
        list($available, $warnings) = choice_get_availability_status($choice);
        
        // Get user's current response(s) if any
        // This calls existing Moodle function - no business logic duplication
        $currentresponse = choice_get_my_response($choice);
        
        // Get group mode for this activity
        $groupmode = groups_get_activity_groupmode($cm);
        
        // Determine if we should only include active users
        $onlyactive = $choice->includeinactive ? false : true;
        
        // Get all responses data (needed for choice_prepare_options)
        // This calls existing Moodle function - no business logic duplication
        $allresponses = choice_get_response_data($choice, $cm, $groupmode, $onlyactive);
        
        // Prepare options array with proper structure using Moodle function
        // This calls existing Moodle function - no business logic duplication
        $preparedoptions = choice_prepare_options($choice, $user, $cm, $allresponses);
        
        // Extract options from prepared data for API response
        $options = [];
        if (isset($preparedoptions['options']) && is_array($preparedoptions['options'])) {
            foreach ($preparedoptions['options'] as $option) {
                $options[] = [
                    'id' => $option->attributes->value,
                    'text' => $option->text,
                    'maxanswers' => $option->maxanswers ?? 0,
                    'countanswers' => $option->countanswers ?? 0,
                    'checked' => isset($option->attributes->checked) ? (bool)$option->attributes->checked : false,
                    'disabled' => isset($option->attributes->disabled) ? (bool)$option->attributes->disabled : false
                ];
            }
        }
        
        // Build comprehensive response data structure
        $responseData = [
            'id' => $choice->id,
            'coursemodule' => $cm->id,
            'course' => $choice->course,
            'name' => $choice->name,
            'intro' => $choice->intro,
            'introformat' => $choice->introformat,
            
            // Choice configuration
            'allowmultiple' => (bool)$choice->allowmultiple,
            'allowupdate' => (bool)$choice->allowupdate,
            'limitanswers' => (bool)$choice->limitanswers,
            'showresults' => (int)$choice->showresults,
            'publish' => (int)$choice->publish,
            'display' => (int)$choice->display,
            'showpreview' => (bool)$choice->showpreview,
            'includeinactive' => (bool)($choice->includeinactive ?? false),
            
            // Time restrictions
            'timeopen' => (int)$choice->timeopen,
            'timeclose' => (int)$choice->timeclose,
            'timemodified' => (int)$choice->timemodified,
            
            // Options array
            'options' => $options,
            
            // Availability status
            'availability' => [
                'available' => $available,
                'warnings' => $warnings
            ],
            
            // User's current response(s)
            'currentresponse' => $currentresponse ? array_values($currentresponse) : []
        ];
        
        // Return standardized success response
        $this->success($responseData);
    }
    
    /**
     * Handle POST requests (not supported).
     *
     * @throws MethodNotAllowedException Always - POST not supported for this endpoint
     */
    protected function handle_post() {
        throw new MethodNotAllowedException('POST method is not supported for choice details', [
            'endpoint' => '/api/v1/choice/{id}',
            'allowedMethods' => ['GET']
        ]);
    }
    
    /**
     * Handle PUT requests (not supported).
     *
     * @throws MethodNotAllowedException Always - PUT not supported for this endpoint
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method is not supported for choice details', [
            'endpoint' => '/api/v1/choice/{id}',
            'allowedMethods' => ['GET']
        ]);
    }
    
    /**
     * Handle DELETE requests (not supported).
     *
     * @throws MethodNotAllowedException Always - DELETE not supported for this endpoint
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method is not supported for choice details', [
            'endpoint' => '/api/v1/choice/{id}',
            'allowedMethods' => ['GET']
        ]);
    }
}

// Instantiate and execute the endpoint
$endpoint = new ChoiceShowEndpoint();
$endpoint->execute();
