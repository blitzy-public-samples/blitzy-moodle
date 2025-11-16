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
 * REST API endpoint for H5P activity details.
 *
 * GET /api/v1/h5pactivity/{id}
 *
 * Returns comprehensive H5P activity information including title, description,
 * display options, tracking settings, grading configuration, user capabilities,
 * and file details. This endpoint wraps existing Moodle H5P activity functionality
 * without duplicating any business logic.
 *
 * Request Parameters:
 *   - id (int, required): H5P activity instance ID
 *
 * Response Structure:
 * {
 *   "success": true,
 *   "data": {
 *     "id": 123,
 *     "courseId": 45,
 *     "courseModuleId": 678,
 *     "name": "Interactive Video",
 *     "intro": "Watch and interact with this video",
 *     "introformat": 1,
 *     "grade": 100,
 *     "displayoptions": {
 *       "frame": true,
 *       "export": false,
 *       "embed": false,
 *       "copyright": true
 *     },
 *     "enabletracking": 1,
 *     "grademethod": 1,
 *     "reviewmode": 1,
 *     "timemodified": 1625097600,
 *     "file": {
 *       "filename": "interactive-video.h5p",
 *       "filesize": 2048576,
 *       "mimetype": "application/zip.h5p",
 *       "fileurl": "https://example.com/pluginfile.php/..."
 *     },
 *     "capabilities": {
 *       "canview": true,
 *       "cansubmit": true,
 *       "canreviewattempts": false
 *     },
 *     "tracking": {
 *       "enabled": true,
 *       "canSubmit": true,
 *       "attemptsCount": 2
 *     },
 *     "context": {
 *       "id": 789,
 *       "contextlevel": 70,
 *       "instanceid": 678
 *     }
 *   }
 * }
 *
 * Error Responses:
 *   - 401 Unauthorized: JWT token missing or invalid
 *   - 403 Forbidden: User lacks mod/h5pactivity:view capability
 *   - 404 Not Found: H5P activity does not exist or is not accessible
 *   - 500 Internal Server Error: Unexpected server error
 *
 * @package    api
 * @subpackage h5pactivity
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Load Moodle configuration and API base class
require_once(__DIR__ . '/../../lib/api_base.php');
require_once(__DIR__ . '/../../lib/api_exception.php');

// Load H5P activity manager and helper classes
require_once($CFG->dirroot . '/mod/h5pactivity/lib.php');
require_once($CFG->dirroot . '/mod/h5pactivity/classes/local/manager.php');
require_once($CFG->libdir . '/filelib.php');

use mod_h5pactivity\local\manager;
use core_h5p\factory;
use core_h5p\helper as h5p_helper;

/**
 * H5P Activity Detail API Endpoint.
 *
 * Handles GET requests to retrieve comprehensive H5P activity information.
 * Extends ApiBase to inherit JWT authentication, request routing, parameter
 * validation, and response formatting.
 *
 * This endpoint wraps existing Moodle functions:
 * - manager::create_from_coursemodule() - Creates activity manager instance
 * - manager::get_instance() - Retrieves activity database record
 * - manager::can_submit() - Checks if user can submit attempts
 * - manager::is_tracking_enabled() - Checks if tracking is enabled
 * - manager::can_view_all_attempts() - Checks if user can view all attempts
 * - manager::count_attempts() - Gets user's attempt count
 * - has_capability() - Validates user permissions for various actions
 *
 * All business logic remains in existing Moodle core functions. This endpoint
 * only performs JWT validation, parameter extraction, permission checking,
 * and JSON response formatting.
 */
class H5PActivityShowEndpoint extends ApiBase {
    
    /**
     * Handle GET request to retrieve H5P activity details.
     *
     * Validates JWT token (via ApiBase constructor), extracts activity ID,
     * checks user permission, retrieves activity data from Moodle core,
     * and returns formatted JSON response.
     *
     * @return void Outputs JSON response via success() or error()
     * @throws UnauthorizedException If JWT validation fails
     * @throws ForbiddenException If user lacks required capability
     * @throws NotFoundException If activity does not exist
     * @throws ValidationException If activity ID parameter is invalid
     */
    protected function handle_get() {
        global $DB;
        
        try {
            // Extract and validate activity ID parameter
            // Uses Moodle's required_param() for type validation
            $h5pactivityid = $this->getParam('id', PARAM_INT);
            
            // Retrieve H5P activity record from database
            // Uses existing Moodle database API
            $h5pactivity = $DB->get_record('h5pactivity', ['id' => $h5pactivityid], '*', MUST_EXIST);
            
            if (!$h5pactivity) {
                throw new NotFoundException('H5P activity not found', [
                    'h5pactivityId' => $h5pactivityid
                ]);
            }
            
            // Get course and course module using existing Moodle function
            // This validates that the activity belongs to a valid course
            list($course, $cm) = get_course_and_cm_from_instance($h5pactivity, 'h5pactivity');
            
            // Get module context for permission checking
            $context = context_module::instance($cm->id);
            
            // Validate user has permission to view this activity
            // Uses existing Moodle capability system via ApiBase::checkCapability()
            $this->checkCapability('mod/h5pactivity:view', $context);
            
            // Create H5P activity manager instance
            // Uses existing Moodle manager class - no business logic duplication
            $manager = manager::create_from_coursemodule($cm);
            
            // Get activity instance with all properties
            $instance = $manager->get_instance();
            
            // Decode display options from JSON storage format
            // Uses existing H5P helper function to parse configuration
            $factory = new factory();
            $core = $factory->get_core();
            $displayoptions = h5p_helper::decode_display_options($core, $instance->displayoptions);
            
            // Get H5P package file information
            $fileinfo = $this->getFileInfo($context);
            
            // Get user capabilities for this activity
            $capabilities = $this->getCapabilities($context, $manager);
            
            // Get tracking information
            $tracking = $this->getTrackingInfo($manager);
            
            // Build comprehensive response data structure
            $responseData = [
                'id' => (int)$instance->id,
                'courseId' => (int)$instance->course,
                'courseModuleId' => (int)$cm->id,
                'name' => $instance->name,
                'intro' => $instance->intro,
                'introformat' => (int)$instance->introformat,
                'grade' => isset($instance->grade) ? (int)$instance->grade : null,
                'displayoptions' => [
                    'frame' => isset($displayoptions['frame']) ? (bool)$displayoptions['frame'] : false,
                    'export' => isset($displayoptions['export']) ? (bool)$displayoptions['export'] : false,
                    'embed' => isset($displayoptions['embed']) ? (bool)$displayoptions['embed'] : false,
                    'copyright' => isset($displayoptions['copyright']) ? (bool)$displayoptions['copyright'] : false,
                ],
                'enabletracking' => (int)$instance->enabletracking,
                'grademethod' => (int)$instance->grademethod,
                'reviewmode' => isset($instance->reviewmode) ? (int)$instance->reviewmode : 0,
                'timemodified' => (int)$instance->timemodified,
                'timecreated' => isset($instance->timecreated) ? (int)$instance->timecreated : null,
                'file' => $fileinfo,
                'capabilities' => $capabilities,
                'tracking' => $tracking,
                'context' => [
                    'id' => $context->id,
                    'contextlevel' => $context->contextlevel,
                    'instanceid' => $context->instanceid,
                ],
            ];
            
            // Return success response with activity data
            // Uses ApiBase::success() for standard JSON formatting
            $this->success($responseData);
            
        } catch (dml_missing_record_exception $e) {
            // Handle database record not found
            throw new NotFoundException('H5P activity not found', [
                'h5pactivityId' => $h5pactivityid ?? null,
                'originalError' => $e->getMessage()
            ]);
            
        } catch (ApiException $e) {
            // Re-throw API exceptions (they're already properly formatted)
            throw $e;
            
        } catch (moodle_exception $e) {
            // Convert Moodle exceptions to API exceptions
            throw new ServerException('Failed to retrieve H5P activity', [
                'errorcode' => $e->errorcode,
                'originalError' => $e->getMessage()
            ]);
            
        } catch (Exception $e) {
            // Handle unexpected exceptions
            throw new ServerException('Internal server error', [
                'originalError' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine()
            ]);
        }
    }
    
    /**
     * Get H5P package file information.
     *
     * Retrieves file details for the H5P package file stored in the activity's
     * file area. Uses existing Moodle file storage API to access file metadata
     * and generate pluginfile URL for content delivery.
     *
     * @param context_module $context Module context for file access
     * @return array|null File information array or null if no file found
     */
    private function getFileInfo($context) {
        // Get file storage instance
        $fs = get_file_storage();
        
        // Get files from h5pactivity package file area
        // Uses existing Moodle file API - no custom file handling
        $files = $fs->get_area_files($context->id, 'mod_h5pactivity', 'package', 0, 'id', false);
        
        if (empty($files)) {
            return null;
        }
        
        // Get first (and should be only) file
        $file = reset($files);
        
        // Generate pluginfile URL for file access
        // Uses existing Moodle URL generation function
        $fileurl = moodle_url::make_pluginfile_url(
            $file->get_contextid(),
            $file->get_component(),
            $file->get_filearea(),
            $file->get_itemid(),
            $file->get_filepath(),
            $file->get_filename(),
            false
        );
        
        return [
            'filename' => $file->get_filename(),
            'filesize' => $file->get_filesize(),
            'mimetype' => $file->get_mimetype(),
            'fileurl' => $fileurl->out(false),
            'timemodified' => $file->get_timemodified(),
        ];
    }
    
    /**
     * Get user capabilities for H5P activity.
     *
     * Checks all defined capabilities for mod_h5pactivity and returns a map
     * of capability names to boolean values indicating whether the current
     * user has each capability. Uses existing Moodle capability system.
     *
     * Special handling for 'cansubmit' capability which depends on both
     * the capability itself and whether tracking is enabled.
     *
     * @param context_module $context Module context for capability checks
     * @param manager $manager Activity manager for tracking checks
     * @return array Associative array of capability name => boolean
     */
    private function getCapabilities($context, $manager) {
        $capabilities = [];
        
        // Load all defined capabilities for h5pactivity module
        // Uses existing Moodle capability definition system
        $capabilitydefs = load_capability_def('mod_h5pactivity');
        
        foreach ($capabilitydefs as $capname => $capdata) {
            // Convert capability name to field name (remove mod/h5pactivity: prefix)
            // Example: 'mod/h5pactivity:view' becomes 'canview'
            $field = 'can' . str_replace('mod/h5pactivity:', '', $capname);
            
            // Special handling for submit capability
            // User can only submit if tracking is enabled AND they have the capability
            if ($field === 'cansubmit') {
                $capabilities[$field] = $manager->is_tracking_enabled() && $manager->can_submit();
            } else {
                // Check capability using Moodle's capability system
                $capabilities[$field] = has_capability($capname, $context);
            }
        }
        
        return $capabilities;
    }
    
    /**
     * Get tracking information for H5P activity.
     *
     * Retrieves tracking status, submission permissions, and attempt count
     * for the current user. Uses existing manager methods to check tracking
     * configuration and user permissions.
     *
     * @param manager $manager Activity manager instance
     * @return array Tracking information array
     */
    private function getTrackingInfo($manager) {
        return [
            'enabled' => $manager->is_tracking_enabled(),
            'canSubmit' => $manager->can_submit(),
            'canViewAllAttempts' => $manager->can_view_all_attempts(),
            'attemptsCount' => $manager->count_attempts(),
        ];
    }
    
    /**
     * Handle POST requests (not supported).
     *
     * This endpoint only supports GET requests to retrieve activity details.
     * POST requests for creating activities are handled by a separate endpoint.
     *
     * @return void
     * @throws MethodNotAllowedException Always throws - POST not supported
     */
    protected function handle_post() {
        throw new MethodNotAllowedException('POST method is not supported for this endpoint', [
            'allowedMethods' => ['GET'],
            'endpoint' => '/api/v1/h5pactivity/{id}'
        ]);
    }
    
    /**
     * Handle PUT requests (not supported).
     *
     * This endpoint only supports GET requests to retrieve activity details.
     * PUT requests for updating activities are handled by a separate endpoint.
     *
     * @return void
     * @throws MethodNotAllowedException Always throws - PUT not supported
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method is not supported for this endpoint', [
            'allowedMethods' => ['GET'],
            'endpoint' => '/api/v1/h5pactivity/{id}'
        ]);
    }
    
    /**
     * Handle DELETE requests (not supported).
     *
     * This endpoint only supports GET requests to retrieve activity details.
     * DELETE requests for removing activities are handled by a separate endpoint.
     *
     * @return void
     * @throws MethodNotAllowedException Always throws - DELETE not supported
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method is not supported for this endpoint', [
            'allowedMethods' => ['GET'],
            'endpoint' => '/api/v1/h5pactivity/{id}'
        ]);
    }
}

// Instantiate and execute the endpoint
$endpoint = new H5PActivityShowEndpoint();
$endpoint->execute();
