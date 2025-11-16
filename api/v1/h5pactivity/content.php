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
 * H5P Activity Content Retrieval API Endpoint.
 *
 * REST API endpoint for retrieving H5P package content and player configuration.
 * This endpoint provides the necessary data for the React H5P player component to
 * initialize and display interactive H5P content.
 *
 * Endpoint: GET /api/v1/h5pactivity/{id}/content
 *
 * Functionality:
 * - Validates JWT authentication token
 * - Enforces mod/h5pactivity:view capability
 * - Retrieves H5P activity details via manager class
 * - Fetches H5P package file from file storage
 * - Generates pluginfile URL for content delivery
 * - Decodes display options for player configuration
 * - Returns JSON response with file URL, player config, and embed parameters
 *
 * Request Parameters:
 * - id (required): H5P activity course module ID (PARAM_INT)
 *
 * Response Format:
 * {
 *   "success": true,
 *   "data": {
 *     "activityId": 123,
 *     "name": "Interactive Video",
 *     "contentUrl": "https://moodle.example.com/pluginfile.php/...",
 *     "fileId": 456,
 *     "fileName": "interactive-video.h5p",
 *     "fileSize": 2048000,
 *     "displayOptions": {
 *       "frame": true,
 *       "export": false,
 *       "embed": true,
 *       "copyright": true
 *     },
 *     "playerConfig": {
 *       "contextId": 789,
 *       "component": "mod_h5pactivity",
 *       "filearea": "package",
 *       "itemId": 0
 *     },
 *     "canSubmit": true,
 *     "trackingEnabled": true
 *   }
 * }
 *
 * Error Responses:
 * - 401 Unauthorized: Invalid or missing JWT token
 * - 403 Forbidden: User lacks mod/h5pactivity:view capability
 * - 404 Not Found: Activity or H5P package file not found
 * - 500 Internal Server Error: Unexpected server error
 *
 * @package    api
 * @subpackage h5pactivity
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Load API base classes and utilities
require_once(__DIR__ . '/../../lib/api_base.php');
require_once(__DIR__ . '/../../lib/api_exception.php');

// Load Moodle core libraries
require_once($CFG->dirroot . '/mod/h5pactivity/lib.php');

// Import H5P activity management classes
use mod_h5pactivity\local\manager;

/**
 * H5P Activity Content API Endpoint Class.
 *
 * Handles GET requests to retrieve H5P package content and player configuration
 * for interactive content display in the React frontend. Extends ApiBase to
 * inherit JWT authentication, capability checking, and response formatting.
 */
class H5PActivityContentEndpoint extends ApiBase {
    
    /**
     * Handle GET request for H5P content retrieval.
     *
     * Retrieves H5P package file and player configuration for the specified activity.
     * This method wraps existing Moodle H5P functions and returns data in a format
     * suitable for the React H5P player component.
     *
     * Flow:
     * 1. Extract and validate activity ID parameter
     * 2. Get course module and course using get_course_and_cm_from_cmid()
     * 3. Authenticate user and check mod/h5pactivity:view capability
     * 4. Create manager instance for the activity
     * 5. Retrieve H5P package file from file storage
     * 6. Generate pluginfile URL for content delivery
     * 7. Decode display options using core_h5p\helper
     * 8. Return JSON response with all player initialization data
     *
     * @return void Outputs JSON response directly
     * @throws ValidationException If activity ID is missing or invalid
     * @throws NotFoundException If activity or H5P package not found
     * @throws ForbiddenException If user lacks required capability
     */
    protected function handle_get() {
        global $DB;
        
        // Extract activity ID from URL parameter
        // The ID refers to the course module ID (cm.id), not the h5pactivity.id
        $cmid = $this->getParam('id', PARAM_INT);
        
        // Validate that ID is a positive integer
        if ($cmid <= 0) {
            throw new ValidationException('Invalid activity ID', [
                'parameter' => 'id',
                'value' => $cmid,
                'requirement' => 'Must be a positive integer'
            ]);
        }
        
        // Get course module and course information
        // This function throws an exception if the course module doesn't exist
        // or is not an h5pactivity module
        try {
            list($course, $cm) = get_course_and_cm_from_cmid($cmid, 'h5pactivity');
        } catch (Exception $e) {
            throw new NotFoundException('H5P activity not found', [
                'activityId' => $cmid,
                'error' => $e->getMessage()
            ]);
        }
        
        // Get the context for capability checking
        $context = context_module::instance($cm->id);
        
        // Check if user has permission to view this H5P activity
        // This enforces Moodle's capability system through the existing
        // require_capability() function, ensuring security parity with PHP pages
        $this->checkCapability('mod/h5pactivity:view', $context);
        
        // Create manager instance for the activity
        // The manager class provides access to activity instance, context,
        // and various helper methods for H5P activity operations
        try {
            $manager = manager::create_from_coursemodule($cm);
        } catch (Exception $e) {
            throw new NotFoundException('Failed to initialize H5P activity manager', [
                'activityId' => $cmid,
                'error' => $e->getMessage()
            ]);
        }
        
        // Get the H5P activity instance
        $moduleinstance = $manager->get_instance();
        
        // Retrieve H5P package file from file storage
        // H5P content is stored in the 'package' filearea with itemid 0
        $fs = get_file_storage();
        $files = $fs->get_area_files($context->id, 'mod_h5pactivity', 'package', 0, 'id', false);
        
        // Verify that a package file exists
        if (empty($files)) {
            throw new NotFoundException('H5P package file not found', [
                'activityId' => $cmid,
                'contextId' => $context->id,
                'component' => 'mod_h5pactivity',
                'filearea' => 'package'
            ]);
        }
        
        // Get the first (and should be only) file from the package filearea
        $file = reset($files);
        
        // Generate pluginfile URL for content delivery
        // This URL will be used by the React H5P player to fetch the actual H5P package
        $fileurl = moodle_url::make_pluginfile_url(
            $file->get_contextid(),
            $file->get_component(),
            $file->get_filearea(),
            $file->get_itemid(),
            $file->get_filepath(),
            $file->get_filename(),
            false  // Do not force download
        );
        
        // Decode display options for the H5P player
        // Display options control frame, export, embed, copyright display, etc.
        $displayoptions = [];
        if (!empty($moduleinstance->displayoptions)) {
            try {
                // Use H5P core factory and helper to decode options
                $factory = new core_h5p\factory();
                $core = $factory->get_core();
                $displayoptions = core_h5p\helper::decode_display_options($core, $moduleinstance->displayoptions);
            } catch (Exception $e) {
                // If decoding fails, use empty array (default options)
                // This ensures the endpoint still returns data even if display options are corrupted
                $displayoptions = [];
            }
        }
        
        // Check if the current user can submit attempts
        // This determines whether the H5P player should enable interactive features
        $cansubmit = $manager->can_submit();
        
        // Check if tracking is enabled for this activity
        // When tracking is disabled, attempts are not recorded
        $trackingenabled = $manager->is_tracking_enabled();
        
        // Build response data structure for React H5P player component
        $responsedata = [
            // Activity identification
            'activityId' => $cm->id,
            'name' => $moduleinstance->name,
            'intro' => format_text($moduleinstance->intro, $moduleinstance->introformat, [
                'context' => $context,
                'noclean' => true
            ]),
            
            // H5P package file information
            'contentUrl' => $fileurl->out(false),
            'fileId' => $file->get_id(),
            'fileName' => $file->get_filename(),
            'fileSize' => $file->get_filesize(),
            'fileMimetype' => $file->get_mimetype(),
            'fileTimeCreated' => $file->get_timecreated(),
            'fileTimeModified' => $file->get_timemodified(),
            
            // Player configuration
            'displayOptions' => $displayoptions,
            'playerConfig' => [
                'contextId' => $context->id,
                'component' => 'mod_h5pactivity',
                'filearea' => 'package',
                'itemId' => 0
            ],
            
            // Activity settings and capabilities
            'canSubmit' => $cansubmit,
            'trackingEnabled' => $trackingenabled,
            'enableTracking' => $moduleinstance->enabletracking ?? 1,
            'gradeMethod' => $moduleinstance->grademethod ?? 1,
            'maxAttempts' => $moduleinstance->maxattempts ?? 0,
            
            // Grading information
            'grade' => $moduleinstance->grade ?? 0,
            'graded' => ($moduleinstance->grade ?? 0) > 0,
            
            // Course information
            'courseId' => $course->id,
            'courseName' => $course->fullname,
            
            // Context information
            'contextId' => $context->id,
            'contextLevel' => $context->contextlevel
        ];
        
        // Get user's existing attempts if tracking is enabled and user can submit
        if ($trackingenabled && $cansubmit) {
            try {
                // Count total attempts by this user
                $attemptcount = $manager->count_user_attempts($this->getUser()->id);
                $responsedata['userAttempts'] = $attemptcount;
                
                // Check if user can make another attempt
                $maxattempts = $moduleinstance->maxattempts ?? 0;
                $responsedata['canAttempt'] = ($maxattempts == 0 || $attemptcount < $maxattempts);
                
            } catch (Exception $e) {
                // If attempt retrieval fails, set safe defaults
                $responsedata['userAttempts'] = 0;
                $responsedata['canAttempt'] = true;
            }
        } else {
            // If tracking disabled or user cannot submit, indicate no attempts
            $responsedata['userAttempts'] = 0;
            $responsedata['canAttempt'] = false;
        }
        
        // Check if user can view all attempts (typically teacher/manager role)
        $canviewallattempts = $manager->can_view_all_attempts();
        $responsedata['canViewAllAttempts'] = $canviewallattempts;
        
        // If user can view all attempts, include total attempt count
        if ($canviewallattempts && $trackingenabled) {
            try {
                $totalattempts = $manager->count_attempts();
                $responsedata['totalAttempts'] = $totalattempts;
            } catch (Exception $e) {
                $responsedata['totalAttempts'] = 0;
            }
        }
        
        // Return successful response with H5P content data
        $this->success($responsedata);
    }
    
    /**
     * Handle POST request - not supported for content retrieval.
     *
     * @throws MethodNotAllowedException Always throws, POST not supported
     */
    protected function handle_post() {
        throw new MethodNotAllowedException('POST method is not supported for H5P content retrieval', [
            'endpoint' => '/api/v1/h5pactivity/{id}/content',
            'supportedMethods' => ['GET']
        ]);
    }
    
    /**
     * Handle PUT request - not supported for content retrieval.
     *
     * @throws MethodNotAllowedException Always throws, PUT not supported
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method is not supported for H5P content retrieval', [
            'endpoint' => '/api/v1/h5pactivity/{id}/content',
            'supportedMethods' => ['GET']
        ]);
    }
    
    /**
     * Handle DELETE request - not supported for content retrieval.
     *
     * @throws MethodNotAllowedException Always throws, DELETE not supported
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method is not supported for H5P content retrieval', [
            'endpoint' => '/api/v1/h5pactivity/{id}/content',
            'supportedMethods' => ['GET']
        ]);
    }
}

// Instantiate and execute the endpoint
// This is the entry point when the PHP file is accessed directly
$endpoint = new H5PActivityContentEndpoint();
$endpoint->execute();
