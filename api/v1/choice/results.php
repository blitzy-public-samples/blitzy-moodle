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
 * REST API endpoint for retrieving choice activity results.
 *
 * Provides GET endpoint for viewing choice activity results including vote counts
 * per option and optionally user-level response data. This endpoint wraps existing
 * Moodle choice functions and respects choice display settings and user permissions
 * for results visibility.
 *
 * Endpoint: GET /api/v1/choice/{id}/results
 *
 * Authentication: Required (JWT token)
 * 
 * Permissions:
 * - 'mod/choice:readresponses' capability for full access to detailed results
 * - OR standard view permission with results visibility check based on choice settings
 *
 * Response includes:
 * - Total response count across all options
 * - Per-option vote counts and percentages
 * - Optional user-level details (if user has readresponses capability)
 * - Respects choice showresults settings (always, after answer, after close, never)
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Include Moodle configuration and required libraries
require_once(__DIR__ . '/../../../config.php');
require_once($CFG->dirroot . '/mod/choice/lib.php');

// Include API framework classes
require_once(__DIR__ . '/../../lib/api_base.php');
require_once(__DIR__ . '/../../lib/auth_jwt.php');
require_once(__DIR__ . '/../../lib/api_response.php');
require_once(__DIR__ . '/../../lib/api_exception.php');

/**
 * Choice results API endpoint.
 *
 * Handles GET requests to retrieve aggregated results data for a choice activity,
 * including vote counts, percentages, and optionally detailed user response data.
 */
class ChoiceResultsEndpoint extends ApiBase {
    
    /**
     * Handle GET request to retrieve choice results.
     *
     * Workflow:
     * 1. Extract choice ID from URL parameter
     * 2. Validate course module exists
     * 3. Check user permissions (readresponses OR view with visibility rules)
     * 4. Retrieve choice object with options
     * 5. Get group mode for activity
     * 6. Retrieve response data organized by option
     * 7. Calculate aggregated statistics (counts, percentages)
     * 8. Include user details if user has readresponses capability
     * 9. Return formatted JSON response
     *
     * @return void Outputs JSON response directly
     * @throws NotFoundException If choice module not found
     * @throws ForbiddenException If user cannot view results based on settings
     */
    protected function handle_get() {
        global $DB;
        
        // Extract choice ID from URL parameter
        // The ID here is the course module ID (cm->id), not the choice instance ID
        $cmid = $this->getParam('id', PARAM_INT);
        
        // Get authenticated user
        $user = $this->getUser();
        
        // Validate course module exists and is a choice activity
        if (!$cm = get_coursemodule_from_id('choice', $cmid)) {
            throw new NotFoundException('Choice activity not found', [
                'courseModuleId' => $cmid,
                'reason' => 'Invalid course module ID or module is not a choice activity'
            ]);
        }
        
        // Get course record for context
        if (!$course = $DB->get_record('course', ['id' => $cm->course])) {
            throw new NotFoundException('Course not found', [
                'courseId' => $cm->course,
                'reason' => 'Course associated with choice activity does not exist'
            ]);
        }
        
        // Get module context for permission checking
        $context = context_module::instance($cm->id);
        
        // Retrieve the choice activity instance with all options
        if (!$choice = choice_get_choice($cm->instance)) {
            throw new NotFoundException('Choice instance not found', [
                'choiceId' => $cm->instance,
                'reason' => 'Choice activity instance or options not found'
            ]);
        }
        
        // Check if user has 'mod/choice:readresponses' capability for full access
        $hasReadResponsesCapability = has_capability('mod/choice:readresponses', $context, $user->id);
        
        // If user doesn't have readresponses capability, check visibility rules
        if (!$hasReadResponsesCapability) {
            // Check basic view capability first
            try {
                $this->checkCapability('mod/choice:view', $context);
            } catch (ForbiddenException $e) {
                throw new ForbiddenException('You do not have permission to view this choice activity', [
                    'capability' => 'mod/choice:view',
                    'contextId' => $context->id,
                    'userId' => $user->id
                ]);
            }
            
            // Get user's current response to determine visibility
            $currentResponse = choice_get_user_response($choice, $user->id);
            
            // Determine if choice is currently open
            $timenow = time();
            $choiceOpen = true;
            
            if ($choice->timeopen != 0 && $timenow < $choice->timeopen) {
                // Choice hasn't opened yet
                throw new ForbiddenException('This choice activity is not yet available', [
                    'reason' => 'Choice has not opened yet',
                    'timeopen' => $choice->timeopen,
                    'timenow' => $timenow
                ]);
            }
            
            if ($choice->timeclose != 0 && $timenow > $choice->timeclose) {
                $choiceOpen = false;
            }
            
            // Check if user can view results based on showresults setting
            if (!choice_can_view_results($choice, $currentResponse, $choiceOpen)) {
                // Determine the specific reason based on showresults setting
                $reason = '';
                switch ($choice->showresults) {
                    case CHOICE_SHOWRESULTS_NOT:
                        $reason = 'Results are not available for viewing';
                        break;
                    case CHOICE_SHOWRESULTS_AFTER_ANSWER:
                        $reason = 'Results will be available after you answer the choice';
                        break;
                    case CHOICE_SHOWRESULTS_AFTER_CLOSE:
                        $reason = 'Results will be available after the choice closes';
                        break;
                    default:
                        $reason = 'You cannot view results at this time';
                }
                
                throw new ForbiddenException('You cannot view results yet', [
                    'showresults' => $choice->showresults,
                    'hasAnswered' => !empty($currentResponse),
                    'choiceOpen' => $choiceOpen,
                    'reason' => $reason
                ]);
            }
        }
        
        // Get group mode for this activity
        $groupmode = groups_get_activity_groupmode($cm);
        
        // Get current group ID if in group mode
        $groupid = 0;
        if ($groupmode > 0) {
            $groupid = groups_get_activity_group($cm, true);
        }
        
        // Determine if we should include only active users
        $onlyactive = $choice->includeinactive ? false : true;
        
        // Get response data organized by option ID
        // Returns array structure: $responses[optionid][userid] = user object with response data
        $responses = choice_get_response_data($choice, $cm, $groupmode, $onlyactive, $groupid);
        
        // Calculate total response count (excluding unanswered users at key 0)
        $totalResponses = 0;
        foreach ($responses as $optionid => $users) {
            if ($optionid != 0) {
                $totalResponses += count($users);
            }
        }
        
        // Build options array with counts, percentages, and optional user details
        $optionsData = [];
        
        foreach ($choice->option as $optionid => $optiontext) {
            // Get count for this option
            $optionCount = isset($responses[$optionid]) ? count($responses[$optionid]) : 0;
            
            // Calculate percentage (avoid division by zero)
            $percentage = $totalResponses > 0 ? round(($optionCount / $totalResponses) * 100, 2) : 0;
            
            // Build option data
            $optionData = [
                'optionId' => $optionid,
                'optionText' => format_string($optiontext, true, ['context' => $context]),
                'count' => $optionCount,
                'percentage' => $percentage
            ];
            
            // If user has readresponses capability, include detailed user list
            if ($hasReadResponsesCapability && isset($responses[$optionid])) {
                $users = [];
                foreach ($responses[$optionid] as $userid => $userobj) {
                    $users[] = [
                        'userId' => $userid,
                        'firstName' => $userobj->firstname,
                        'lastName' => $userobj->lastname,
                        'fullName' => fullname($userobj),
                        'timeModified' => $userobj->timemodified ?? null,
                        'answerId' => $userobj->answerid ?? null
                    ];
                }
                $optionData['users'] = $users;
            }
            
            $optionsData[] = $optionData;
        }
        
        // Check if choice shows unanswered users
        if ($choice->showunanswered && isset($responses[0])) {
            $unansweredCount = count($responses[0]);
            
            $unansweredData = [
                'optionId' => 0,
                'optionText' => get_string('notanswered', 'choice'),
                'count' => $unansweredCount,
                'percentage' => 0 // Unanswered doesn't count toward total percentage
            ];
            
            // Include unanswered users if user has readresponses capability
            if ($hasReadResponsesCapability) {
                $users = [];
                foreach ($responses[0] as $userid => $userobj) {
                    $users[] = [
                        'userId' => $userid,
                        'firstName' => $userobj->firstname,
                        'lastName' => $userobj->lastname,
                        'fullName' => fullname($userobj),
                        'timeModified' => null,
                        'answerId' => null
                    ];
                }
                $unansweredData['users'] = $users;
            }
            
            $optionsData[] = $unansweredData;
        }
        
        // Build complete response data
        $data = [
            'choiceId' => $choice->id,
            'courseid' => $course->id,
            'courseModuleId' => $cm->id,
            'choiceName' => format_string($choice->name, true, ['context' => $context]),
            'totalResponses' => $totalResponses,
            'showresults' => $choice->showresults,
            'publish' => $choice->publish,
            'showunanswered' => (bool)$choice->showunanswered,
            'includeUserDetails' => $hasReadResponsesCapability,
            'options' => $optionsData,
            'groupMode' => $groupmode,
            'groupId' => $groupid
        ];
        
        // Return success response with results data
        $this->success($data, 200);
    }
    
    /**
     * Handle POST requests - not supported for this endpoint.
     *
     * @throws MethodNotAllowedException Always thrown as POST is not supported
     */
    protected function handle_post() {
        throw new MethodNotAllowedException('POST method is not supported for choice results', [
            'allowedMethods' => ['GET']
        ]);
    }
    
    /**
     * Handle PUT requests - not supported for this endpoint.
     *
     * @throws MethodNotAllowedException Always thrown as PUT is not supported
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method is not supported for choice results', [
            'allowedMethods' => ['GET']
        ]);
    }
    
    /**
     * Handle DELETE requests - not supported for this endpoint.
     *
     * @throws MethodNotAllowedException Always thrown as DELETE is not supported
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method is not supported for choice results', [
            'allowedMethods' => ['GET']
        ]);
    }
}

// Instantiate and execute the endpoint (skip during testing)
if (!defined('API_TESTING') && php_sapi_name() !== 'cli') {
    $endpoint = new ChoiceResultsEndpoint();
    $endpoint->execute();
}
