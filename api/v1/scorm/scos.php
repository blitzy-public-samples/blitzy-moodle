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
 * REST API endpoint for retrieving SCORM package SCO (Shareable Content Object) list.
 *
 * Handles GET /api/v1/scorm/{id}/scos to fetch all SCOs within a SCORM package,
 * including their hierarchical structure, metadata, launch parameters, prerequisites,
 * and tracking status. Returns JSON-formatted SCO array with complete navigation
 * structure, sequencing rules, and content organization.
 *
 * Primary endpoint for React frontend SCORM player to build table of contents,
 * navigation tree, and content sequence. Supports SCORM 1.2 and SCORM 2004 standards.
 *
 * Features:
 * - Retrieves complete SCO hierarchy with parent-child relationships
 * - Includes SCO metadata from scorm_scoes_data table
 * - Optionally includes tracking data for specific user attempt
 * - Evaluates prerequisite expressions for SCO availability
 * - Filters by organization ID for multi-organization packages
 * - Returns counts by SCO type (sco, asset, organizational)
 *
 * Query Parameters:
 * - organization (string, optional): Filter SCOs by organization ID
 * - include_data (bool, optional): Include additional SCO data elements (launch params, prerequisites)
 * - attempt (int, optional): Include tracking status for specific attempt number
 *
 * Response Structure:
 * {
 *   "success": true,
 *   "data": {
 *     "scos": [
 *       {
 *         "id": 123,
 *         "scorm": 45,
 *         "manifest": "org1",
 *         "organization": "Course Organization",
 *         "parent": "/",
 *         "identifier": "SCO_001",
 *         "launch": "lesson1/index.html",
 *         "scormtype": "sco",
 *         "title": "Lesson 1: Introduction",
 *         "sortorder": 1,
 *         "depth": 0,
 *         "is_leaf": true,
 *         "children": [],
 *         "is_available": true,
 *         "prerequisite_status": "satisfied",
 *         "tracking": {
 *           "lesson_status": "incomplete",
 *           "entry": "ab-initio",
 *           "score_raw": 0,
 *           "total_time": "00:00:00"
 *         },
 *         "data": {
 *           "adlcp:prerequisites": "",
 *           "adlcp:maxtimeallowed": "",
 *           "cmi.launch_data": ""
 *         }
 *       }
 *     ],
 *     "organization": "org1",
 *     "scorm_version": "SCORM_12",
 *     "counts": {
 *       "total_scos": 15,
 *       "launchable_scos": 10,
 *       "asset_scos": 2,
 *       "organizational_elements": 3
 *     }
 *   }
 * }
 *
 * @package    api
 * @subpackage scorm
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Load Moodle configuration and API base class
require_once(__DIR__ . '/../../lib/api_base.php');
require_once(__DIR__ . '/../../lib/api_exception.php');

/**
 * SCORM SCO List API Endpoint.
 *
 * Extends ApiBase to provide JWT authentication, permission checking,
 * and standardized response formatting for SCORM SCO retrieval operations.
 */
class ScormScosEndpoint extends ApiBase {
    
    /**
     * Handle GET request to retrieve SCO list for a SCORM package.
     *
     * Retrieves all SCOs with hierarchical structure, metadata, tracking data,
     * and prerequisite evaluation. Wraps existing Moodle SCORM functions:
     * - scorm_get_scoes() for SCO retrieval
     * - scorm_get_tracks() for tracking data
     * - scorm_eval_prerequisites() for availability checking
     *
     * @return void Outputs JSON response via success() method
     * @throws NotFoundException If SCORM ID is invalid or not found
     * @throws ForbiddenException If user lacks mod/scorm:viewscores capability
     * @throws ValidationException If parameters are invalid
     */
    protected function handle_get() {
        global $DB, $CFG;
        
        // Load SCORM module libraries
        require_once($CFG->dirroot . '/mod/scorm/lib.php');
        require_once($CFG->dirroot . '/mod/scorm/locallib.php');
        
        // Extract and validate SCORM ID from URL parameter
        $scormid = $this->getParam('id', PARAM_INT);
        
        if ($scormid <= 0) {
            throw new ValidationException(400, 'INVALID_SCORM_ID', 
                'SCORM ID must be a positive integer', 
                ['scormid' => $scormid]
            );
        }
        
        // Get optional query parameters
        $organization = $this->getParam('organization', PARAM_TEXT, false, '');
        $includeData = $this->getParam('include_data', PARAM_BOOL, false, false);
        $attemptNumber = $this->getParam('attempt', PARAM_INT, false, 0);
        
        // Validate organization parameter if provided
        if (!empty($organization) && !preg_match('/^[a-zA-Z0-9_-]+$/', $organization)) {
            throw new ValidationException(400, 'INVALID_ORGANIZATION', 
                'Organization ID contains invalid characters', 
                ['organization' => $organization]
            );
        }
        
        // Validate attempt parameter if provided
        if ($attemptNumber < 0) {
            throw new ValidationException(400, 'INVALID_ATTEMPT', 
                'Attempt number must be a non-negative integer', 
                ['attempt' => $attemptNumber]
            );
        }
        
        // Retrieve SCORM record from database
        $scorm = $DB->get_record('scorm', ['id' => $scormid], '*', IGNORE_MISSING);
        
        if (!$scorm) {
            throw new NotFoundException(404, 'SCORM_NOT_FOUND', 
                'SCORM package not found with the specified ID', 
                ['scormid' => $scormid]
            );
        }
        
        // Get course module instance
        $cm = get_coursemodule_from_instance('scorm', $scormid, $scorm->course, false, MUST_EXIST);
        
        if (!$cm) {
            throw new NotFoundException(404, 'MODULE_NOT_FOUND', 
                'Course module not found for SCORM package', 
                ['scormid' => $scormid, 'course' => $scorm->course]
            );
        }
        
        // Get course record
        $course = $DB->get_record('course', ['id' => $scorm->course], '*', MUST_EXIST);
        
        // Get context for permission checking
        $context = context_module::instance($cm->id);
        
        // Check user has permission to view SCO structure
        // mod/scorm:viewscores allows viewing the SCORM structure and tracking
        $this->checkCapability('mod/scorm:viewscores', $context);
        
        // Get authenticated user for tracking data
        $user = $this->getUser();
        
        // Retrieve SCOs for this SCORM package using existing Moodle function
        // This function retrieves all SCOs and joins with scorm_scoes_data for metadata
        $scoes = scorm_get_scoes($scormid, $organization);
        
        if (!$scoes || !is_array($scoes)) {
            // Return empty SCO list if none found
            $scoes = [];
        }
        
        // Build hierarchical structure and enrich SCO data
        $enrichedScos = [];
        $scoMap = []; // Map of SCO ID to array index for building hierarchy
        
        // First pass: format basic SCO data and create index map
        foreach ($scoes as $index => $sco) {
            $enrichedSco = [
                'id' => (int)$sco->id,
                'scorm' => (int)$sco->scorm,
                'manifest' => $sco->manifest ?? '',
                'organization' => $sco->organization ?? '',
                'parent' => $sco->parent ?? '/',
                'identifier' => $sco->identifier ?? '',
                'launch' => $sco->launch ?? '',
                'scormtype' => $sco->scormtype ?? '',
                'title' => $sco->title ?? 'Untitled',
                'sortorder' => (int)($sco->sortorder ?? 0),
                'depth' => 0, // Will be calculated
                'is_leaf' => false, // Will be determined
                'children' => []
            ];
            
            // Add additional SCO data elements if requested
            if ($includeData) {
                $dataElements = [];
                
                // SCORM 1.2 and 2004 standard data elements
                $standardElements = [
                    'adlcp:prerequisites',
                    'adlcp:maxtimeallowed',
                    'adlcp:timelimitaction',
                    'adlcp:datafromlms',
                    'adlcp:masteryscore',
                    'cmi.core.lesson_location',
                    'cmi.launch_data',
                    'cmi.student_data.mastery_score',
                    'cmi.student_data.max_time_allowed',
                    'cmi.student_data.time_limit_action'
                ];
                
                foreach ($standardElements as $element) {
                    if (isset($sco->{$element})) {
                        $dataElements[$element] = $sco->{$element};
                    }
                }
                
                $enrichedSco['data'] = $dataElements;
            }
            
            // Add tracking data if attempt number provided
            if ($attemptNumber > 0) {
                $tracks = scorm_get_tracks($sco->id, $user->id, $attemptNumber);
                
                if ($tracks && is_object($tracks)) {
                    $enrichedSco['tracking'] = [
                        'lesson_status' => $tracks->status ?? 'not attempted',
                        'entry' => $tracks->{'cmi.core.entry'} ?? $tracks->{'cmi.entry'} ?? '',
                        'score_raw' => $tracks->score_raw ?? null,
                        'total_time' => $tracks->total_time ?? '00:00:00',
                        'session_time' => $tracks->session_time ?? '00:00:00'
                    ];
                } else {
                    // No tracking data for this attempt
                    $enrichedSco['tracking'] = [
                        'lesson_status' => 'not attempted',
                        'entry' => 'ab-initio',
                        'score_raw' => null,
                        'total_time' => '00:00:00',
                        'session_time' => '00:00:00'
                    ];
                }
            }
            
            // Evaluate prerequisites if attempt data available
            if ($attemptNumber > 0 && isset($sco->{'adlcp:prerequisites'}) && !empty($sco->{'adlcp:prerequisites'})) {
                // Get all tracking data for this user's attempt to evaluate prerequisites
                $allTracks = [];
                foreach ($scoes as $trackSco) {
                    $scoTracks = scorm_get_tracks($trackSco->id, $user->id, $attemptNumber);
                    if ($scoTracks) {
                        $allTracks[$trackSco->identifier] = $scoTracks;
                    }
                }
                
                // Evaluate prerequisite expression
                try {
                    $prerequisiteResult = scorm_eval_prerequisites($sco->{'adlcp:prerequisites'}, $allTracks);
                    $enrichedSco['is_available'] = (bool)$prerequisiteResult;
                    $enrichedSco['prerequisite_status'] = $prerequisiteResult ? 'satisfied' : 'not_satisfied';
                } catch (Exception $e) {
                    // If evaluation fails, assume prerequisites are not satisfied
                    $enrichedSco['is_available'] = false;
                    $enrichedSco['prerequisite_status'] = 'unknown';
                }
            } else {
                // No prerequisites or no attempt data - SCO is available
                $enrichedSco['is_available'] = true;
                $enrichedSco['prerequisite_status'] = empty($sco->{'adlcp:prerequisites'}) ? 'none' : 'satisfied';
            }
            
            $enrichedScos[] = $enrichedSco;
            $scoMap[$sco->id] = $index;
        }
        
        // Second pass: build hierarchical structure
        $rootScos = [];
        
        foreach ($enrichedScos as $index => &$sco) {
            $parentId = $sco['parent'];
            
            // Determine if this is a root SCO
            if ($parentId === '/' || $parentId === '' || $parentId === '0' || $parentId === 0) {
                // Root level SCO
                $sco['depth'] = 0;
                $rootScos[] = $index;
            } else {
                // Find parent SCO in the array
                $parentFound = false;
                foreach ($enrichedScos as $parentIndex => &$potentialParent) {
                    if ($potentialParent['identifier'] === $parentId || 
                        (string)$potentialParent['id'] === (string)$parentId) {
                        // Add this SCO as a child of parent
                        $potentialParent['children'][] = $index;
                        $sco['depth'] = $potentialParent['depth'] + 1;
                        $parentFound = true;
                        break;
                    }
                }
                
                // If parent not found, treat as root
                if (!$parentFound) {
                    $sco['depth'] = 0;
                    $rootScos[] = $index;
                }
            }
        }
        unset($sco); // Break reference
        
        // Third pass: determine leaf nodes and convert child indices to actual child objects
        foreach ($enrichedScos as &$sco) {
            // A SCO is a leaf if it has no children and is launchable (scormtype = 'sco' or has launch URL)
            $hasChildren = !empty($sco['children']);
            $isLaunchable = $sco['scormtype'] === 'sco' || !empty($sco['launch']);
            $sco['is_leaf'] = !$hasChildren && $isLaunchable;
            
            // Convert child indices to nested child objects for hierarchical response
            if ($hasChildren) {
                $childObjects = [];
                foreach ($sco['children'] as $childIndex) {
                    $childObjects[] = &$enrichedScos[$childIndex];
                }
                $sco['children'] = $childObjects;
            }
        }
        unset($sco); // Break reference
        
        // Extract only root SCOs for response (children are nested within)
        $hierarchicalScos = [];
        foreach ($rootScos as $rootIndex) {
            $hierarchicalScos[] = $enrichedScos[$rootIndex];
        }
        
        // Calculate SCO counts by type
        $totalScos = count($enrichedScos);
        $launchableScos = 0;
        $assetScos = 0;
        $organizationalElements = 0;
        
        foreach ($enrichedScos as $sco) {
            switch ($sco['scormtype']) {
                case 'sco':
                    $launchableScos++;
                    break;
                case 'asset':
                    $assetScos++;
                    break;
                default:
                    // Empty scormtype indicates organizational element
                    $organizationalElements++;
                    break;
            }
        }
        
        // Determine SCORM version
        $scormVersion = 'SCORM_12'; // Default
        if (isset($scorm->version)) {
            if (strpos($scorm->version, '2004') !== false || strpos($scorm->version, 'SCORM_2004') !== false) {
                $scormVersion = 'SCORM_2004';
            } else if (strpos($scorm->version, 'AICC') !== false) {
                $scormVersion = 'SCORM_AICC';
            }
        }
        
        // Build response data
        $responseData = [
            'scos' => $hierarchicalScos,
            'organization' => $organization,
            'scorm_version' => $scormVersion,
            'counts' => [
                'total_scos' => $totalScos,
                'launchable_scos' => $launchableScos,
                'asset_scos' => $assetScos,
                'organizational_elements' => $organizationalElements
            ]
        ];
        
        // Add metadata about the SCORM package
        $meta = [
            'scorm_id' => (int)$scormid,
            'scorm_name' => $scorm->name ?? 'Untitled SCORM',
            'course_id' => (int)$scorm->course,
            'course_name' => $course->fullname ?? ''
        ];
        
        // Return success response with SCO list and metadata
        $this->success($responseData, 200, $meta);
    }
    
    /**
     * Handle POST request - not supported for SCO listing.
     *
     * @throws MethodNotAllowedException
     */
    protected function handle_post() {
        throw new MethodNotAllowedException(405, 'METHOD_NOT_ALLOWED', 
            'POST method is not supported for SCO listing. Use GET to retrieve SCOs.'
        );
    }
    
    /**
     * Handle PUT request - not supported for SCO listing.
     *
     * @throws MethodNotAllowedException
     */
    protected function handle_put() {
        throw new MethodNotAllowedException(405, 'METHOD_NOT_ALLOWED', 
            'PUT method is not supported for SCO listing. Use GET to retrieve SCOs.'
        );
    }
    
    /**
     * Handle DELETE request - not supported for SCO listing.
     *
     * @throws MethodNotAllowedException
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException(405, 'METHOD_NOT_ALLOWED', 
            'DELETE method is not supported for SCO listing. Use GET to retrieve SCOs.'
        );
    }
}

// Instantiate and execute the endpoint
$endpoint = new ScormScosEndpoint();
$endpoint->execute();
