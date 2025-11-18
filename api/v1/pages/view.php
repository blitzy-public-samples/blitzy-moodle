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
 * REST API endpoint for page activity view tracking.
 *
 * Implements POST /api/v1/pages/{id}/view endpoint that records a page view
 * event for completion tracking and activity analytics. This endpoint enables
 * React frontend to properly track user engagement with page activities.
 *
 * Key features:
 * - JWT token authentication via ApiBase parent class
 * - Validates page existence in database
 * - Enforces mod/page:view capability before tracking
 * - Triggers course_module_viewed event for completion
 * - Updates course module completion status if configured
 * - Returns success confirmation
 *
 * Endpoint: POST /api/v1/pages/{id}/view
 * Parameters:
 *   - id (int, required): Page instance ID from URL path
 *
 * Response structure:
 * {
 *   "success": true,
 *   "data": {
 *     "viewed": true,
 *     "completion_updated": true
 *   }
 * }
 *
 * Error responses:
 * - 404: Page not found
 * - 403: Permission denied (missing mod/page:view capability)
 * - 401: Unauthorized (invalid JWT token)
 *
 * @package    core_api
 * @subpackage api_v1_pages
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

require_once(__DIR__ . '/../../../config.php');
require_once($CFG->dirroot . '/lib/completionlib.php');
require_once($CFG->dirroot . '/mod/page/lib.php');
require_once(__DIR__ . '/../../lib/api_base.php');

/**
 * API endpoint class for page activity view tracking.
 *
 * Handles POST requests to record page views, triggering completion
 * tracking and analytics events.
 *
 * @package    core_api
 * @subpackage api_v1_pages
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class api_v1_pages_view extends api_base {
    
    /**
     * Handle POST request to track page view.
     *
     * Records page view event and updates completion status if applicable.
     *
     * @return void Outputs JSON response directly
     * @throws moodle_exception If page not found or permission denied
     */
    protected function handle_post() {
        global $DB, $USER;
        
        // Get page ID from URL path
        $pageid = required_param('id', PARAM_INT);
        
        // Get page record from database
        $page = $DB->get_record('page', array('id' => $pageid), '*', MUST_EXIST);
        
        // Get course and course module
        $course = $DB->get_record('course', array('id' => $page->course), '*', MUST_EXIST);
        $cm = get_coursemodule_from_instance('page', $page->id, $page->course, false, MUST_EXIST);
        $context = context_module::instance($cm->id);
        
        // Enforce permission check
        require_capability('mod/page:view', $context);
        
        // Trigger course module viewed event using existing Moodle function
        page_view($page, $course, $cm, $context);
        
        // Update completion state
        $completion = new completion_info($course);
        $completion_updated = false;
        
        if ($completion->is_enabled($cm) && $page->completionview) {
            $completion->update_state($cm, COMPLETION_COMPLETE);
            $completion_updated = true;
        }
        
        // Return success response
        $this->json_response([
            'viewed' => true,
            'completion_updated' => $completion_updated
        ]);
    }
}

// Instantiate and execute the endpoint
$endpoint = new api_v1_pages_view();
$endpoint->execute();
