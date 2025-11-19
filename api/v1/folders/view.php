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
 * REST API endpoint for folder view tracking.
 *
 * Implements POST /api/v1/folders/{id}/view endpoint that records a folder
 * view event for tracking and completion purposes. This endpoint enables React
 * frontend components to properly log user activity and trigger activity
 * completion when configured.
 *
 * Key features:
 * - JWT token authentication via ApiBase parent class
 * - Validates folder activity existence in database
 * - Enforces mod/folder:view capability before tracking view
 * - Calls folder_view() to trigger event logging
 * - Updates activity completion status if configured
 * - Records view in course logs for analytics
 * - Returns success confirmation for React confirmation UI
 *
 * Endpoint: POST /api/v1/folders/{id}/view
 * Parameters:
 *   - id (int, required): Folder instance ID from URL path
 *
 * Response structure:
 * {
 *   "success": true,
 *   "data": {
 *     "viewed": true,
 *     "completion_updated": true,
 *     "timestamp": 1637772000
 *   }
 * }
 *
 * Error responses:
 * - 404: Folder activity not found
 * - 403: Permission denied (missing mod/folder:view capability)
 * - 401: Unauthorized (invalid JWT token)
 *
 * @package    core_api
 * @subpackage api_v1_folders
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Only require config if not already loaded (for test compatibility)
if (!defined('MOODLE_INTERNAL')) {
    require_once(__DIR__ . '/../../../config.php');
}
require_once($CFG->dirroot . '/lib/filelib.php');
require_once($CFG->dirroot . '/lib/completionlib.php');
require_once($CFG->dirroot . '/mod/folder/lib.php');
require_once(__DIR__ . '/../../lib/api_base.php');

/**
 * API endpoint class for folder view tracking.
 *
 * Handles POST requests for folder view logging, enforcing permission checks
 * and triggering completion updates when appropriate.
 *
 * @package    core_api
 * @subpackage api_v1_folders
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class FoldersViewEndpoint extends ApiBase {
    
    /**
     * Handle POST request for folder view tracking.
     *
     * Records that the user has viewed the folder, triggering
     * event logging and completion updates.
     *
     * @return void Outputs JSON response directly
     * @throws moodle_exception If folder activity not found or permission denied
     */
    protected function handle_post() {
        global $DB, $USER;
        
        // Get folder ID from URL path
        $folderid = required_param('id', PARAM_INT);
        
        // Get folder record from database
        $folder = $DB->get_record('folder', array('id' => $folderid), '*', MUST_EXIST);
        
        // Get course and course module
        $course = $DB->get_record('course', array('id' => $folder->course), '*', MUST_EXIST);
        $cm = get_coursemodule_from_instance('folder', $folder->id, $folder->course, false, MUST_EXIST);
        $context = context_module::instance($cm->id);
        
        // Enforce permission check
        require_capability('mod/folder:view', $context);
        
        // Trigger folder_view event (logs view and handles completion)
        folder_view($folder, $course, $cm, $context);
        
        // Check if completion was updated
        $completion = new completion_info($course);
        $completion_updated = false;
        
        if ($completion->is_enabled($cm)) {
            $completion->update_state($cm, COMPLETION_COMPLETE);
            $completion_updated = true;
        }
        
        // Return success response
        $this->json_response([
            'viewed' => true,
            'completion_updated' => $completion_updated,
            'timestamp' => time()
        ]);
    }
    /**
     * Handle GET requests (not supported for this endpoint).
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown
     */
    protected function handle_get() {
        throw new MethodNotAllowedException('GET method not supported for folder view tracking');
    }

    /**
     * Handle PUT requests (not supported for this endpoint).
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method not supported for folder view tracking');
    }

    /**
     * Handle DELETE requests (not supported for this endpoint).
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method not supported for folder view tracking');
    }
}

// Instantiate and execute the endpoint

// Execute the endpoint if not in test mode
if (!defined('API_TEST_MODE')) {
    $endpoint = new api_v1_folders_view();
    $endpoint->execute();
}
