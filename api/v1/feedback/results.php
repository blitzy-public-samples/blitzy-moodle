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
 * REST API endpoint for viewing feedback submission results and individual entries.
 *
 * Returns JSON-formatted list of completed responses with user information (for 
 * non-anonymous feedback) or aggregated data for display in the React frontend.
 * Enforces permission checks for accessing results and respects group mode restrictions.
 *
 * Endpoint: GET /api/v1/feedback/{id}/results
 *
 * Query Parameters:
 * - page (optional): Page number for pagination (default: 1)
 * - per_page (optional): Results per page (default: 20, max: 100)
 * - groupid (optional): Filter results by group ID (default: 0 for all groups)
 *
 * Response Format:
 * {
 *   "success": true,
 *   "data": {
 *     "feedback_id": 123,
 *     "is_anonymous": false,
 *     "results": [
 *       {
 *         "completed_id": 456,
 *         "user": {
 *           "id": 789,
 *           "firstname": "John",
 *           "lastname": "Doe",
 *           "email": "john@example.com"
 *         },
 *         "timemodified": 1609459200,
 *         "courseid": 5,
 *         "response_data": [...]
 *       }
 *     ],
 *     "total_responses": 50
 *   },
 *   "meta": {
 *     "pagination": {
 *       "page": 1,
 *       "per_page": 20,
 *       "total_count": 50,
 *       "total_pages": 3
 *     }
 *   }
 * }
 *
 * @package    api
 * @subpackage v1
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Load API base class and dependencies
require_once(__DIR__ . '/../../lib/api_base.php');

// Load Moodle feedback module classes and functions
require_once($CFG->dirroot . '/mod/feedback/lib.php');
require_once($CFG->dirroot . '/mod/feedback/classes/structure.php');

// Load group library for group mode support
require_once($CFG->libdir . '/grouplib.php');

/**
 * API endpoint class for retrieving feedback submission results.
 *
 * Handles GET requests to fetch completed feedback responses with support for:
 * - Anonymous and non-anonymous feedback modes
 * - Pagination of results
 * - Group-based filtering
 * - User information retrieval for non-anonymous responses
 * - Permission enforcement via Moodle capability system
 *
 * @package    api
 * @subpackage v1
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class FeedbackResultsEndpoint extends ApiBase {
    
    /**
     * Handle GET requests to retrieve feedback results.
     *
     * Retrieves completed feedback responses with pagination support, respecting
     * anonymous feedback settings and group mode restrictions. For non-anonymous
     * feedback, includes user information for each response. For anonymous feedback,
     * returns only aggregated count without individual response details.
     *
     * @return void Outputs JSON response directly via success() or error()
     * @throws NotFoundException If feedback with specified ID does not exist
     * @throws ForbiddenException If user lacks permission to view results
     * @throws ValidationException If invalid parameters are provided
     */
    protected function handle_get() {
        global $DB, $CFG;
        
        // Extract and validate feedback ID from URL parameter
        $feedbackid = $this->getParam('id', PARAM_INT, true);
        
        // Extract optional pagination parameters
        $page = $this->getParam('page', PARAM_INT, false, 1);
        $perpage = $this->getParam('per_page', PARAM_INT, false, 20);
        $groupid = $this->getParam('groupid', PARAM_INT, false, 0);
        
        // Validate pagination parameters
        if ($page < 1) {
            throw new ValidationException('Invalid page number', [
                'parameter' => 'page',
                'value' => $page,
                'minimum' => 1
            ]);
        }
        
        if ($perpage < 1 || $perpage > 100) {
            throw new ValidationException('Invalid per_page value', [
                'parameter' => 'per_page',
                'value' => $perpage,
                'minimum' => 1,
                'maximum' => 100
            ]);
        }
        
        // Validate feedback exists and get course module
        $cm = get_coursemodule_from_instance('feedback', $feedbackid, 0, false, MUST_EXIST);
        
        if (!$cm) {
            throw new NotFoundException('Feedback activity not found', [
                'feedbackId' => $feedbackid,
                'reason' => 'No course module found for this feedback ID'
            ]);
        }
        
        // Get context for permission checking
        $context = context_module::instance($cm->id);
        
        // Get authenticated user
        $user = $this->getUser();
        
        // Check if user has permission to view feedback reports
        // Try both viewreports and viewanalysepage capabilities
        $canviewreports = has_capability('mod/feedback:viewreports', $context, $user->id);
        $canviewanalysis = has_capability('mod/feedback:viewanalysepage', $context, $user->id);
        
        if (!$canviewreports && !$canviewanalysis) {
            throw new ForbiddenException('You do not have permission to view feedback results', [
                'requiredCapability' => 'mod/feedback:viewreports OR mod/feedback:viewanalysepage',
                'contextId' => $context->id,
                'userId' => $user->id
            ]);
        }
        
        // Get feedback record
        $feedback = $DB->get_record('feedback', ['id' => $feedbackid], '*', MUST_EXIST);
        
        if (!$feedback) {
            throw new NotFoundException('Feedback record not found', [
                'feedbackId' => $feedbackid
            ]);
        }
        
        // Get course record for group mode checking
        $course = $DB->get_record('course', ['id' => $cm->course], '*', MUST_EXIST);
        
        // Create feedback structure instance to access feedback methods
        $feedbackstructure = new mod_feedback_structure($feedback, $cm, $course->id);
        
        // Check if feedback is anonymous
        $isanonymous = $feedback->anonymous == FEEDBACK_ANONYMOUS_YES;
        
        // Get group mode for this activity
        $groupmode = groups_get_activity_groupmode($cm);
        
        // Determine which groups the user can access
        $accessiblegroups = [];
        if ($groupmode != NOGROUPS) {
            if ($groupid > 0) {
                // Verify user has access to specified group
                $accessiblegroups = groups_get_activity_allowed_groups($cm, $user->id);
                $groupids = array_keys($accessiblegroups);
                
                if (!in_array($groupid, $groupids)) {
                    throw new ForbiddenException('You do not have access to this group', [
                        'groupId' => $groupid,
                        'accessibleGroups' => $groupids
                    ]);
                }
                
                $filtergroupids = [$groupid];
            } else {
                // Get all groups user can access
                $accessiblegroups = groups_get_activity_allowed_groups($cm, $user->id);
                $filtergroupids = array_keys($accessiblegroups);
            }
        } else {
            // No group mode - all responses visible
            $filtergroupids = null;
        }
        
        // Build SQL query to get completed feedback responses
        $sql = "SELECT fc.id, fc.userid, fc.timemodified, fc.courseid, fc.anonymous_response
                  FROM {feedback_completed} fc
                 WHERE fc.feedback = :feedbackid";
        
        $params = ['feedbackid' => $feedbackid];
        
        // Apply group filtering if necessary
        if ($filtergroupids !== null && !empty($filtergroupids)) {
            list($groupsql, $groupparams) = $DB->get_in_or_equal($filtergroupids, SQL_PARAMS_NAMED, 'grp');
            $sql .= " AND fc.userid IN (
                        SELECT gm.userid 
                          FROM {groups_members} gm 
                         WHERE gm.groupid $groupsql
                      )";
            $params = array_merge($params, $groupparams);
        }
        
        // Add ordering
        $sql .= " ORDER BY fc.timemodified DESC";
        
        // Get total count for pagination
        $countsql = "SELECT COUNT(fc.id)
                       FROM {feedback_completed} fc
                      WHERE fc.feedback = :feedbackid";
        
        $countparams = ['feedbackid' => $feedbackid];
        
        // Apply same group filtering to count query
        if ($filtergroupids !== null && !empty($filtergroupids)) {
            list($groupsql, $groupparams) = $DB->get_in_or_equal($filtergroupids, SQL_PARAMS_NAMED, 'grp');
            $countsql .= " AND fc.userid IN (
                             SELECT gm.userid 
                               FROM {groups_members} gm 
                              WHERE gm.groupid $groupsql
                           )";
            $countparams = array_merge($countparams, $groupparams);
        }
        
        $totalcount = $DB->count_records_sql($countsql, $countparams);
        
        // Calculate pagination
        $offset = ($page - 1) * $perpage;
        $totalpages = ceil($totalcount / $perpage);
        
        // For anonymous feedback, return only aggregated data
        if ($isanonymous) {
            $responsedata = [
                'feedback_id' => $feedbackid,
                'is_anonymous' => true,
                'total_responses' => $totalcount,
                'results' => null,
                'message' => 'This feedback is anonymous. Individual responses are not available.'
            ];
            
            $meta = [
                'pagination' => [
                    'page' => $page,
                    'per_page' => $perpage,
                    'total_count' => $totalcount,
                    'total_pages' => $totalpages
                ]
            ];
            
            $this->success($responsedata, 200, $meta);
            return;
        }
        
        // For non-anonymous feedback, retrieve completed responses with pagination
        $completedresponses = $DB->get_records_sql($sql, $params, $offset, $perpage);
        
        $results = [];
        
        foreach ($completedresponses as $completed) {
            $resultentry = [
                'completed_id' => $completed->id,
                'timemodified' => $completed->timemodified,
                'courseid' => $completed->courseid,
                'anonymous_response' => $completed->anonymous_response
            ];
            
            // Add user information for non-anonymous responses
            if (!$completed->anonymous_response && $completed->userid > 0) {
                $responseuser = $DB->get_record('user', ['id' => $completed->userid], 
                    'id, firstname, lastname, email, picture, imagealt', IGNORE_MISSING);
                
                if ($responseuser) {
                    $resultentry['user'] = [
                        'id' => $responseuser->id,
                        'firstname' => $responseuser->firstname,
                        'lastname' => $responseuser->lastname,
                        'email' => $responseuser->email,
                        'fullname' => fullname($responseuser)
                    ];
                } else {
                    $resultentry['user'] = null;
                }
            } else {
                $resultentry['user'] = null;
            }
            
            // Get feedback item responses for this completion
            $itemresponses = $DB->get_records('feedback_value', 
                ['completed' => $completed->id], 
                'item ASC'
            );
            
            $responsevalues = [];
            
            foreach ($itemresponses as $itemresponse) {
                // Get item details
                $item = $DB->get_record('feedback_item', ['id' => $itemresponse->item]);
                
                if ($item) {
                    $responsevalues[] = [
                        'item_id' => $item->id,
                        'item_name' => $item->name,
                        'item_label' => $item->label,
                        'item_type' => $item->typ,
                        'value' => $itemresponse->value,
                        'position' => $item->position
                    ];
                }
            }
            
            $resultentry['response_data'] = $responsevalues;
            
            $results[] = $resultentry;
        }
        
        // Build response data
        $responsedata = [
            'feedback_id' => $feedbackid,
            'is_anonymous' => false,
            'results' => $results,
            'total_responses' => $totalcount
        ];
        
        // Build pagination metadata
        $meta = [
            'pagination' => [
                'page' => $page,
                'per_page' => $perpage,
                'total_count' => $totalcount,
                'total_pages' => $totalpages
            ]
        ];
        
        // Return success response with results and pagination
        $this->success($responsedata, 200, $meta);
    }
    
    /**
     * Handle POST requests (not supported for this endpoint).
     *
     * @throws MethodNotAllowedException Always - POST not supported
     */
    protected function handle_post() {
        throw new MethodNotAllowedException('POST method is not supported for this endpoint', [
            'allowedMethods' => ['GET']
        ]);
    }
    
    /**
     * Handle PUT requests (not supported for this endpoint).
     *
     * @throws MethodNotAllowedException Always - PUT not supported
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method is not supported for this endpoint', [
            'allowedMethods' => ['GET']
        ]);
    }
    
    /**
     * Handle DELETE requests (not supported for this endpoint).
     *
     * @throws MethodNotAllowedException Always - DELETE not supported
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method is not supported for this endpoint', [
            'allowedMethods' => ['GET']
        ]);
    }
}

// Instantiate and execute the endpoint
$endpoint = new FeedbackResultsEndpoint();
$endpoint->execute();
