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
 * REST API endpoint for retrieving BigBlueButton recording list.
 *
 * This endpoint implements GET /api/v1/bigbluebuttonbn/{id}/recordings
 * to fetch all recordings associated with a BigBlueButton meeting instance.
 *
 * Authentication: Requires valid JWT token in Authorization header
 * Permission: Requires 'mod/bigbluebuttonbn:view' capability in the activity context
 *
 * URL Parameters:
 *   - {id}: BigBlueButton instance ID from the bigbluebuttonbn table
 *
 * Response Format:
 * {
 *   "success": true,
 *   "data": {
 *     "recordings": [
 *       {
 *         "id": 123,
 *         "recordingid": "bbb-recording-id-string",
 *         "name": "Recording Name",
 *         "description": "Recording description text",
 *         "starttime": 1234567890000,
 *         "endtime": 1234567990000,
 *         "duration": 100,
 *         "published": true,
 *         "protected": false,
 *         "playback_urls": [
 *           {
 *             "type": "presentation",
 *             "url": "https://moodle.example.com/mod/bigbluebuttonbn/bbb_view.php?action=play&..."
 *           }
 *         ]
 *       }
 *     ]
 *   }
 * }
 *
 * Error Responses:
 *   - 401: Unauthorized - Invalid or missing JWT token
 *   - 403: Forbidden - User lacks 'mod/bigbluebuttonbn:view' permission
 *   - 404: Not Found - BigBlueButton instance does not exist
 *   - 405: Method Not Allowed - Non-GET request attempted
 *
 * Implementation Details:
 * - Uses thin wrapper pattern: delegates to existing Moodle core functions
 * - Calls instance::get_from_instanceid() to load BigBlueButton instance
 * - Calls recording::get_recordings_for_instance() to fetch recordings
 * - Respects group mode filtering when retrieving recordings
 * - Includes imported recordings in the response
 * - Returns empty array if no recordings exist (not an error)
 *
 * @package    api
 * @subpackage bigbluebuttonbn
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Load Moodle configuration
require_once(__DIR__ . '/../../../config.php');

// Load required Moodle libraries
require_once($CFG->libdir . '/moodlelib.php');

// Load API base class and exceptions
require_once(__DIR__ . '/../../lib/api_base.php');
require_once(__DIR__ . '/../../lib/api_exception.php');

// Import BigBlueButton classes
use mod_bigbluebuttonbn\instance;
use mod_bigbluebuttonbn\recording;
use mod_bigbluebuttonbn\local\exceptions\server_not_available_exception;

/**
 * API endpoint class for BigBlueButton recordings retrieval.
 *
 * Extends ApiBase to inherit JWT authentication, request routing,
 * capability checking, and response formatting functionality.
 */
class BigBlueButtonRecordingsEndpoint extends ApiBase {
    
    /**
     * Handle GET requests to retrieve recordings for a BigBlueButton instance.
     *
     * Extracts the instance ID from the URL path, loads the BigBlueButton instance,
     * validates user permissions, fetches all recordings including imported ones,
     * and returns formatted recording data with complete metadata.
     *
     * URL format: /api/v1/bigbluebuttonbn/{id}/recordings
     * where {id} is the BigBlueButton instance ID
     *
     * @return void Outputs JSON response directly via success() method
     * @throws NotFoundException If the BigBlueButton instance does not exist
     * @throws ForbiddenException If user lacks required permissions
     * @throws ValidationException If instance ID is invalid
     */
    protected function handle_get() {
        // Extract instance ID from URL path
        // Expected URL format: /api/v1/bigbluebuttonbn/{id}/recordings
        $urlparts = parse_url($this->requestUri);
        $path = $urlparts['path'];
        
        // Parse path to extract instance ID
        // Remove query string and split by '/'
        $pathSegments = explode('/', trim($path, '/'));
        
        // Find 'bigbluebuttonbn' segment and get the ID that follows it
        $instanceId = null;
        foreach ($pathSegments as $index => $segment) {
            if ($segment === 'bigbluebuttonbn' && isset($pathSegments[$index + 1])) {
                $instanceId = $pathSegments[$index + 1];
                break;
            }
        }
        
        // Validate instance ID was found and is numeric
        if ($instanceId === null || !is_numeric($instanceId)) {
            throw new ValidationException(
                'Invalid BigBlueButton instance ID in URL',
                [
                    'url' => $path,
                    'expectedFormat' => '/api/v1/bigbluebuttonbn/{id}/recordings',
                    'reason' => 'Instance ID must be a numeric value'
                ]
            );
        }
        
        // Convert to integer
        $instanceId = (int)$instanceId;
        
        // Load BigBlueButton instance using existing Moodle function
        // This delegates to Moodle's core functionality without duplicating logic
        $instance = instance::get_from_instanceid($instanceId);
        
        // Check if instance exists
        if ($instance === null) {
            throw new NotFoundException(
                'BigBlueButton instance not found',
                [
                    'instanceId' => $instanceId,
                    'reason' => 'No BigBlueButton activity exists with this ID'
                ]
            );
        }
        
        // Check user has permission to view this BigBlueButton instance
        // Uses Moodle's capability system to enforce authorization
        $this->checkCapability('mod/bigbluebuttonbn:view', $instance->get_context());
        
        try {
            // Fetch recordings for this instance using existing Moodle function
            // Parameters:
            // - $instance: The BigBlueButton instance object
            // - true: Include imported recordings (recordings from other instances)
            // - false: Not only imported (include all recordings)
            // - true: Filter by groups according to instance group settings
            $recordings = recording::get_recordings_for_instance(
                $instance,
                true,  // Include imported recordings
                false, // Not only imported
                true   // Filter by groups
            );
            
            // Format recordings data for API response
            // Extract relevant metadata from each recording object
            $recordingsData = [];
            
            foreach ($recordings as $recording) {
                // Build recording data structure with all essential metadata
                $recordingData = [
                    'id' => $recording->get('id'),
                    'recordingid' => $recording->get('recordingid'),
                    'name' => $recording->get('name'),
                    'description' => $recording->get('description'),
                    'starttime' => $recording->get('starttime'),
                    'endtime' => $recording->get('endtime'),
                    'published' => $recording->get('published'),
                    'protected' => $recording->get('protected'),
                ];
                
                // Calculate duration if both start and end times are available
                if ($recordingData['starttime'] && $recordingData['endtime']) {
                    $recordingData['duration'] = $recordingData['endtime'] - $recordingData['starttime'];
                } else {
                    $recordingData['duration'] = null;
                }
                
                // Get playback URLs
                // The get_playbacks() method returns an array of playback objects
                // Each playback contains type, url, and length information
                $playbacks = $recording->get('playbacks');
                $playbackUrls = [];
                
                if (is_array($playbacks) && !empty($playbacks)) {
                    foreach ($playbacks as $playback) {
                        // Each playback is already formatted with Moodle URL
                        // Extract the URL and type for the API response
                        $playbackUrls[] = [
                            'type' => $playback['type'] ?? 'presentation',
                            'url' => isset($playback['url']) ? $playback['url']->out(false) : null,
                            'length' => $playback['length'] ?? null,
                        ];
                    }
                }
                
                $recordingData['playback_urls'] = $playbackUrls;
                
                // Add additional metadata fields
                $recordingData['imported'] = $recording->get('imported');
                $recordingData['groupid'] = $recording->get('groupid');
                $recordingData['status'] = $recording->get('status');
                $recordingData['timecreated'] = $recording->get('timecreated');
                $recordingData['timemodified'] = $recording->get('timemodified');
                
                // Add to response array
                $recordingsData[] = $recordingData;
            }
            
            // Return success response with recordings array
            // If no recordings exist, returns empty array (not an error condition)
            $this->success([
                'recordings' => $recordingsData,
                'count' => count($recordingsData),
            ]);
            
        } catch (server_not_available_exception $e) {
            // Handle BBB server unavailability
            // This exception is thrown by the BigBlueButton proxy when it cannot
            // communicate with the BBB server
            throw new ServerException(
                'BigBlueButton server is not available',
                [
                    'instanceId' => $instanceId,
                    'error' => $e->getMessage(),
                    'suggestion' => 'Please check BBB server status and try again later'
                ]
            );
        } catch (moodle_exception $e) {
            // Handle other Moodle exceptions
            // These might include database errors, configuration issues, etc.
            throw new ServerException(
                'Error retrieving recordings: ' . $e->getMessage(),
                [
                    'instanceId' => $instanceId,
                    'errorCode' => $e->errorcode ?? 'unknown',
                    'module' => $e->module ?? 'unknown'
                ]
            );
        } catch (Exception $e) {
            // Handle any other unexpected exceptions
            throw new ServerException(
                'Unexpected error occurred while retrieving recordings',
                [
                    'instanceId' => $instanceId,
                    'error' => $e->getMessage(),
                    'type' => get_class($e)
                ]
            );
        }
    }
    
    /**
     * Handle POST requests - not supported for this endpoint.
     *
     * Recording creation is not implemented in this endpoint.
     * Recordings are created automatically by BigBlueButton server
     * when meetings are recorded.
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown
     */
    protected function handle_post() {
        throw new MethodNotAllowedException(
            'POST method is not supported for recordings endpoint',
            [
                'allowedMethods' => ['GET'],
                'reason' => 'Recordings are created automatically by BigBlueButton server'
            ]
        );
    }
    
    /**
     * Handle PUT requests - not supported for this endpoint.
     *
     * Recording updates should be done through dedicated management endpoints
     * or through the BigBlueButton management interface.
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown
     */
    protected function handle_put() {
        throw new MethodNotAllowedException(
            'PUT method is not supported for recordings endpoint',
            [
                'allowedMethods' => ['GET'],
                'reason' => 'Recording updates require dedicated management endpoints'
            ]
        );
    }
    
    /**
     * Handle DELETE requests - not supported for this endpoint.
     *
     * Recording deletion should be done through dedicated management endpoints
     * with appropriate additional permissions and confirmation.
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException(
            'DELETE method is not supported for recordings endpoint',
            [
                'allowedMethods' => ['GET'],
                'reason' => 'Recording deletion requires dedicated management endpoints'
            ]
        );
    }
}

// Instantiate and execute the endpoint (skip during testing)
if (!defined('API_TESTING') && php_sapi_name() !== 'cli') {
    $endpoint = new BigBlueButtonRecordingsEndpoint();
    $endpoint->execute();
}
