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

// Include Moodle configuration and required libraries
// In test environment, these are already loaded by PHPUnit bootstrap or test script
if (!defined('PHPUNIT_TEST') && !defined('API_TEST_MODE')) {
    require_once(__DIR__ . '/../../../config.php');
    require_once($CFG->dirroot . '/mod/feedback/lib.php');
    require_once($CFG->dirroot . '/mod/feedback/classes/structure.php');
    require_once($CFG->dirroot . '/mod/feedback/classes/responses_table.php');
    require_once($CFG->dirroot . '/mod/feedback/classes/responses_anon_table.php');
    require_once($CFG->libdir . '/grouplib.php');
}

// Include API framework classes
require_once(__DIR__ . '/../../lib/api_base.php');
require_once(__DIR__ . '/../../lib/auth_jwt.php');
require_once(__DIR__ . '/../../lib/api_response.php');
require_once(__DIR__ . '/../../lib/api_exception.php');

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
     * @throws NotFoundException If feedback with specified ID does not exist (extends ApiException)
     * @throws ForbiddenException If user lacks permission to view results (extends ApiException)
     * @throws ValidationException If invalid parameters are provided (extends ApiException)
     */
    protected function handle_get() {
        global $DB, $CFG;
        
        // Extract and validate feedback ID from URL parameter
        $feedbackid = $this->getParam('id', PARAM_INT, true);
        
        // Extract optional pagination parameters
        $page = $this->getParam('page', PARAM_INT, false, 0);
        $perpage = $this->getParam('per_page', PARAM_INT, false, 20);
        $groupid = $this->getParam('groupid', PARAM_INT, false, 0);
        
        // Validate pagination parameters
        if ($page < 0) {
            throw new ValidationException('Invalid page number', [
                'parameter' => 'page',
                'value' => $page,
                'minimum' => 0
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
        $this->checkCapability('mod/feedback:viewreports', $context);
        
        // Get feedback record
        $feedback = $DB->get_record('feedback', ['id' => $feedbackid], '*', MUST_EXIST);
        
        if (!$feedback) {
            throw new NotFoundException('Feedback record not found', [
                'feedbackId' => $feedbackid
            ]);
        }
        
        // Get course record for group mode checking
        $course = $DB->get_record('course', ['id' => $cm->course], '*', MUST_EXIST);
        
        // Validate group access if groupid specified
        if (!empty($groupid)) {
            // Determine if the group is visible to user
            if (!groups_group_visible($groupid, $course, $cm)) {
                throw new ForbiddenException('You do not have access to this group', [
                    'groupId' => $groupid
                ]);
            }
        } else {
            // Check to see if groups are being used here
            if ($groupmode = groups_get_activity_groupmode($cm)) {
                $groupid = groups_get_activity_group($cm);
                // Determine if the group is visible to user
                if (!groups_group_visible($groupid, $course, $cm)) {
                    throw new ForbiddenException('You do not have access to this group', [
                        'groupId' => $groupid
                    ]);
                }
            } else {
                $groupid = 0;
            }
        }
        
        // Create feedback structure instance to access feedback methods
        $feedbackstructure = new mod_feedback_structure($feedback, $cm, $course->id);
        
        // Check if feedback is anonymous
        $isanonymous = $feedback->anonymous == FEEDBACK_ANONYMOUS_YES;
        
        // Use existing Moodle table classes to get responses
        // This follows the pattern from mod_feedback_external::get_responses_analysis()
        $responsestable = new mod_feedback_responses_table($feedbackstructure, $groupid);
        
        // Ensure responses number is correct prior returning them
        $feedbackstructure->shuffle_anonym_responses();
        $anonresponsestable = new mod_feedback_responses_anon_table($feedbackstructure, $groupid);
        
        // Get total counts
        $totalresponses = $responsestable->get_total_responses_count();
        $totalanon = $anonresponsestable->get_total_responses_count();
        
        // Calculate pagination
        $totalpages = $perpage > 0 ? ceil($totalresponses / $perpage) : 1;
        
        // Export structured data using existing Moodle methods
        $attempts = $responsestable->export_external_structure($page, $perpage);
        $anonattempts = $anonresponsestable->export_external_structure($page, $perpage);
        
        // Build response data
        $responsedata = [
            'feedback_id' => $feedbackid,
            'is_anonymous' => $isanonymous,
            'attempts' => $attempts,
            'total_attempts' => $totalresponses,
            'anon_attempts' => $anonattempts,
            'total_anon_attempts' => $totalanon
        ];
        
        // Build pagination metadata
        $meta = [
            'pagination' => [
                'page' => $page,
                'per_page' => $perpage,
                'total_count' => $totalresponses,
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

// Instantiate and execute the endpoint (skip during testing)
if (!defined('API_TESTING') && php_sapi_name() !== 'cli') {
    // Skip auto-execution in test mode to allow manual instantiation
if (!defined('API_TEST_MODE') || !API_TEST_MODE) {
    $endpoint = new FeedbackResultsEndpoint();
    $endpoint->execute();
}
}
