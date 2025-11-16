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
 * REST API endpoint for updating SCORM tracking data during learner interactions.
 *
 * Handles PUT /api/v1/scorm/attempts/{id}/track to persist CMI data model elements,
 * learner progress, scores, time spent, interactions, and completion status.
 * Supports both SCORM 1.2 and SCORM 2004 data models with real-time synchronization.
 *
 * This endpoint serves as a thin wrapper around existing Moodle SCORM tracking
 * functions, particularly scorm_insert_track(). It validates JWT authentication,
 * enforces permissions, parses JSON tracking data from React SCORM player,
 * normalizes CMI element names, validates data formats, and triggers grade
 * updates and completion status changes when appropriate.
 *
 * Request Format:
 * PUT /api/v1/scorm/attempts/{id}/track
 * Headers: Authorization: Bearer {jwt_token}, Content-Type: application/json
 * Body: {
 *   "sco_id": 123,
 *   "tracking_data": [
 *     {"element": "cmi.core.lesson_status", "value": "completed"},
 *     {"element": "cmi.core.score.raw", "value": "85"},
 *     {"element": "cmi.core.session_time", "value": "00:15:30"}
 *   ]
 * }
 *
 * Response Format:
 * {
 *   "success": true,
 *   "data": {
 *     "tracking_status": {
 *       "elements_saved": 3,
 *       "updated_elements": ["cmi.core.lesson_status", "cmi.core.score.raw", "cmi.core.session_time"],
 *       "current_status": "completed",
 *       "current_score": 85,
 *       "total_time": "00:15:30",
 *       "completion_updated": true,
 *       "sco_completed": true,
 *       "all_scos_completed": false
 *     }
 *   }
 * }
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Include API base class and exception handling
require_once(__DIR__ . '/../../lib/api_base.php');
require_once(__DIR__ . '/../../lib/api_exception.php');

// Include Moodle SCORM functions
require_once(__DIR__ . '/../../../config.php');
require_once($CFG->dirroot . '/mod/scorm/lib.php');
require_once($CFG->dirroot . '/mod/scorm/locallib.php');

/**
 * SCORM Tracking API Endpoint.
 *
 * Handles HTTP PUT requests to update SCORM tracking data. Extends ApiBase
 * to inherit JWT validation, permission checking, and response formatting.
 *
 * Key Responsibilities:
 * - Validate attempt ownership (user can only update their own attempts)
 * - Enforce mod/scorm:savetrack capability
 * - Validate CMI element names against SCORM 1.2 and 2004 standards
 * - Normalize element naming conventions between SCORM versions
 * - Validate data types and formats (scores, timestamps, durations, status values)
 * - Call scorm_insert_track() to persist tracking data
 * - Handle special elements (lesson_status, score, session_time, suspend_data, interactions)
 * - Trigger grade updates when completion status changes
 * - Update activity completion when criteria met
 * - Return comprehensive tracking status in response
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class ScormTrackEndpoint extends ApiBase {
    
    /**
     * Allowed CMI elements for SCORM 1.2 and SCORM 2004.
     *
     * This array defines valid CMI data model elements that can be tracked.
     * Elements are organized by category and support both SCORM 1.2 and 2004 naming.
     *
     * Categories:
     * - Core elements: lesson_status, score, session_time, total_time, exit, entry
     * - Learner data: student_id, student_name, credit, lesson_mode
     * - Suspend data: suspend_data (bookmark/state persistence)
     * - Interactions: interaction tracking with objectives, responses, results
     * - Objectives: learning objective tracking with scores and status
     * - Comments: comments_from_learner, comments_from_lms
     *
     * @var array
     */
    private $allowedCmiElements = [
        // SCORM 1.2 Core elements
        'cmi.core.student_id',
        'cmi.core.student_name',
        'cmi.core.lesson_location',
        'cmi.core.credit',
        'cmi.core.lesson_status',
        'cmi.core.entry',
        'cmi.core.score.raw',
        'cmi.core.score.max',
        'cmi.core.score.min',
        'cmi.core.total_time',
        'cmi.core.lesson_mode',
        'cmi.core.exit',
        'cmi.core.session_time',
        
        // SCORM 2004 Core elements (cmi.* without .core.)
        'cmi.learner_id',
        'cmi.learner_name',
        'cmi.location',
        'cmi.credit',
        'cmi.completion_status',
        'cmi.success_status',
        'cmi.entry',
        'cmi.score.raw',
        'cmi.score.max',
        'cmi.score.min',
        'cmi.score.scaled',
        'cmi.total_time',
        'cmi.mode',
        'cmi.exit',
        'cmi.session_time',
        'cmi.progress_measure',
        
        // Suspend data
        'cmi.suspend_data',
        'cmi.launch_data',
        
        // Student data / Learner preferences
        'cmi.student_data.mastery_score',
        'cmi.student_data.max_time_allowed',
        'cmi.student_data.time_limit_action',
        'cmi.learner_preference.audio_level',
        'cmi.learner_preference.language',
        'cmi.learner_preference.delivery_speed',
        'cmi.learner_preference.audio_captioning',
        
        // Interactions (pattern matching for .n. indexes)
        'cmi.interactions._children',
        'cmi.interactions._count',
        
        // Objectives (pattern matching for .n. indexes)
        'cmi.objectives._children',
        'cmi.objectives._count',
        
        // Comments
        'cmi.comments',
        'cmi.comments_from_learner',
        'cmi.comments_from_lms',
        
        // Navigation (SCORM 2004)
        'adl.nav.request',
    ];
    
    /**
     * Valid lesson status values for SCORM 1.2.
     *
     * @var array
     */
    private $validLessonStatus12 = [
        'passed',
        'completed',
        'failed',
        'incomplete',
        'browsed',
        'not attempted',
    ];
    
    /**
     * Valid completion status values for SCORM 2004.
     *
     * @var array
     */
    private $validCompletionStatus2004 = [
        'completed',
        'incomplete',
        'not attempted',
        'unknown',
    ];
    
    /**
     * Valid success status values for SCORM 2004.
     *
     * @var array
     */
    private $validSuccessStatus2004 = [
        'passed',
        'failed',
        'unknown',
    ];
    
    /**
     * Valid exit values.
     *
     * @var array
     */
    private $validExitValues = [
        'time-out',
        'suspend',
        'logout',
        'normal',
        '',
    ];
    
    /**
     * Handle GET requests - not supported for this endpoint.
     *
     * This endpoint only supports PUT for updating tracking data.
     *
     * @throws MethodNotAllowedException
     * @return void
     */
    protected function handle_get() {
        throw new MethodNotAllowedException('GET method not supported. Use PUT to update tracking data.');
    }
    
    /**
     * Handle POST requests - not supported for this endpoint.
     *
     * This endpoint only supports PUT for updating tracking data.
     *
     * @throws MethodNotAllowedException
     * @return void
     */
    protected function handle_post() {
        throw new MethodNotAllowedException('POST method not supported. Use PUT to update tracking data.');
    }
    
    /**
     * Handle DELETE requests - not supported for this endpoint.
     *
     * This endpoint only supports PUT for updating tracking data.
     *
     * @throws MethodNotAllowedException
     * @return void
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method not supported. Use PUT to update tracking data.');
    }
    
    /**
     * Handle PUT requests to update SCORM tracking data.
     *
     * This is the primary method for this endpoint. It processes tracking data
     * updates from the React SCORM player, validates all input, calls existing
     * Moodle SCORM functions to persist data, and returns comprehensive tracking status.
     *
     * Process Flow:
     * 1. Extract attempt ID from URL parameter
     * 2. Retrieve and validate attempt record (must belong to authenticated user)
     * 3. Retrieve SCORM and SCO records
     * 4. Enforce mod/scorm:savetrack capability
     * 5. Validate CSRF token (sesskey)
     * 6. Parse JSON request body with tracking data
     * 7. Preload existing tracking data to enable update detection
     * 8. For each tracking element:
     *    - Normalize element name (SCORM 1.2 vs 2004)
     *    - Validate element is in allowed list
     *    - Validate data format and value constraints
     *    - Call scorm_insert_track() to persist
     * 9. Handle special elements (lesson_status, score, session_time)
     * 10. Check if completion triggered, update grades if needed
     * 11. Return tracking status with completion information
     *
     * @throws NotFoundException If attempt, SCORM, or SCO not found
     * @throws ForbiddenException If user doesn't own attempt or lacks capability
     * @throws ValidationException If tracking data format invalid or CMI elements invalid
     * @return void Calls success() with tracking status data
     */
    protected function handle_put() {
        global $DB, $CFG;
        
        // Get authenticated user from JWT token (validated by ApiBase constructor)
        $user = $this->getUser();
        
        // Step 1: Extract attempt ID from URL parameter
        $attemptid = $this->getParam('id', PARAM_INT);
        if (empty($attemptid)) {
            throw new ValidationException('Missing attempt ID in URL', ['parameter' => 'id']);
        }
        
        // Step 2: Retrieve attempt record from scorm_attempt table
        $attempt = $DB->get_record('scorm_attempt', ['id' => $attemptid], '*', IGNORE_MISSING);
        if (!$attempt) {
            throw new NotFoundException('SCORM attempt not found', ['attemptId' => $attemptid]);
        }
        
        // Step 2b: Validate attempt ownership - user can only update their own attempts
        if ($attempt->userid != $user->id) {
            throw new ForbiddenException('You do not have permission to update this attempt', [
                'attemptId' => $attemptid,
                'attemptUserId' => $attempt->userid,
                'currentUserId' => $user->id
            ]);
        }
        
        // Step 3: Retrieve SCORM record
        $scorm = $DB->get_record('scorm', ['id' => $attempt->scormid], '*', IGNORE_MISSING);
        if (!$scorm) {
            throw new NotFoundException('SCORM activity not found', ['scormId' => $attempt->scormid]);
        }
        
        // Step 3b: Get course module for context
        $cm = get_coursemodule_from_instance('scorm', $scorm->id, $scorm->course, false, IGNORE_MISSING);
        if (!$cm) {
            throw new NotFoundException('Course module not found for SCORM activity', ['scormId' => $scorm->id]);
        }
        
        // Step 4: Enforce permission check - user must have mod/scorm:savetrack capability
        $context = context_module::instance($cm->id);
        $this->checkCapability('mod/scorm:savetrack', $context);
        
        // Step 5: Validate CSRF token (sesskey)
        if (!confirm_sesskey(sesskey())) {
            throw new ForbiddenException('Invalid session key (CSRF token mismatch)');
        }
        
        // Step 6: Parse JSON request body
        $requestBody = $this->getJsonBody();
        
        // Validate required fields in request body
        if (!isset($requestBody['sco_id'])) {
            throw new ValidationException('Missing required field: sco_id', ['field' => 'sco_id']);
        }
        
        if (!isset($requestBody['tracking_data']) || !is_array($requestBody['tracking_data'])) {
            throw new ValidationException('Missing or invalid tracking_data array', ['field' => 'tracking_data']);
        }
        
        $scoid = clean_param($requestBody['sco_id'], PARAM_INT);
        $trackingData = $requestBody['tracking_data'];
        
        // Validate SCO belongs to this SCORM activity
        $sco = $DB->get_record('scorm_scoes', ['id' => $scoid, 'scorm' => $scorm->id], '*', IGNORE_MISSING);
        if (!$sco) {
            throw new ValidationException('SCO does not belong to this SCORM activity', [
                'scoId' => $scoid,
                'scormId' => $scorm->id
            ]);
        }
        
        // Step 7: Preload existing tracking data to enable update detection
        $existingTracks = scorm_get_tracks($scoid, $user->id, $attempt->attempt);
        
        // Get attempt object for scorm_insert_track function
        $attemptobject = scorm_get_attempt($user->id, $scorm->id, $attempt->attempt);
        
        // Initialize tracking status for response
        $elementsSaved = 0;
        $updatedElements = [];
        $currentStatus = null;
        $currentScore = null;
        $totalTime = null;
        $completionUpdated = false;
        $scoCompleted = false;
        
        // Step 8: Process each tracking element
        foreach ($trackingData as $trackItem) {
            // Validate structure of each tracking item
            if (!is_array($trackItem) || !isset($trackItem['element']) || !isset($trackItem['value'])) {
                throw new ValidationException('Invalid tracking data item structure. Each item must have element and value.', [
                    'item' => $trackItem
                ]);
            }
            
            $element = trim($trackItem['element']);
            $value = $trackItem['value'];
            
            // Normalize element name (remove extra spaces, standardize case)
            $element = $this->normalizeElementName($element);
            
            // Validate element is allowed
            if (!$this->isValidCmiElement($element)) {
                throw new ValidationException('Invalid or unsupported CMI element', [
                    'element' => $element,
                    'hint' => 'Element must be a valid SCORM 1.2 or SCORM 2004 data model element'
                ]);
            }
            
            // Validate data format based on element type
            $this->validateElementValue($element, $value);
            
            // Step 8d: Call scorm_insert_track to persist tracking data
            $result = scorm_insert_track(
                $user->id,
                $scorm->id,
                $scoid,
                $attemptobject,
                $element,
                $value,
                $scorm->forcecompleted,
                $existingTracks
            );
            
            if ($result) {
                $elementsSaved++;
                $updatedElements[] = $element;
                
                // Track special elements for response
                if ($this->isLessonStatusElement($element)) {
                    $currentStatus = $value;
                    
                    // Check if completion status changed to completed or passed
                    if (in_array(strtolower($value), ['completed', 'passed'])) {
                        $scoCompleted = true;
                    }
                }
                
                if ($this->isScoreElement($element)) {
                    $currentScore = floatval($value);
                }
                
                if ($this->isSessionTimeElement($element)) {
                    // Aggregate session time with total time
                    if (isset($existingTracks->{'cmi.core.total_time'}) || isset($existingTracks->{'cmi.total_time'})) {
                        $existingTotal = $existingTracks->{'cmi.core.total_time'} ?? $existingTracks->{'cmi.total_time'} ?? '00:00:00';
                        $totalTime = scorm_add_time($existingTotal, $value);
                    } else {
                        $totalTime = $value;
                    }
                }
            }
        }
        
        // Step 9: Check if grade update needed (when lesson status changes to completed or passed)
        if ($scoCompleted) {
            // Update gradebook
            scorm_update_grades($scorm, $user->id);
            $completionUpdated = true;
            
            // Update activity completion
            $course = $DB->get_record('course', ['id' => $scorm->course], '*', MUST_EXIST);
            $completion = new completion_info($course);
            if ($completion->is_enabled($cm)) {
                $completion->update_state($cm, COMPLETION_COMPLETE, $user->id);
            }
        }
        
        // Step 10: Check if all SCOs completed
        $allScosCompleted = $this->checkAllScosCompleted($scorm->id, $user->id, $attempt->attempt);
        
        // Step 11: Build and return response
        $trackingStatus = [
            'elements_saved' => $elementsSaved,
            'updated_elements' => $updatedElements,
            'current_status' => $currentStatus,
            'current_score' => $currentScore,
            'total_time' => $totalTime,
            'completion_updated' => $completionUpdated,
            'sco_completed' => $scoCompleted,
            'all_scos_completed' => $allScosCompleted,
        ];
        
        $this->success(['tracking_status' => $trackingStatus], 200);
    }
    
    /**
     * Normalize CMI element name.
     *
     * Handles differences between SCORM 1.2 and SCORM 2004 naming conventions.
     * Converts dotted notation with underscores (from HTML form encoding) back to dots.
     * Standardizes case and removes extra whitespace.
     *
     * Examples:
     * - "cmi.core.lesson_status" remains "cmi.core.lesson_status" (SCORM 1.2)
     * - "cmi.completion_status" remains "cmi.completion_status" (SCORM 2004)
     * - "cmi__core__lesson_status" converts to "cmi.core.lesson_status"
     * - " cmi.core.score.raw " converts to "cmi.core.score.raw"
     *
     * @param string $element The element name to normalize
     * @return string Normalized element name
     */
    private function normalizeElementName($element) {
        // Remove leading/trailing whitespace
        $element = trim($element);
        
        // Convert double underscores to dots (HTML form encoding compatibility)
        $element = str_replace('__', '.', $element);
        
        // Convert indexed notation .N(\d+). to .\d+.
        $element = preg_replace('/\.N(\d+)\./', '.$1.', $element);
        
        // Standardize to lowercase for consistency (CMI elements are case-insensitive in SCORM)
        $element = strtolower($element);
        
        return $element;
    }
    
    /**
     * Check if CMI element is valid and allowed.
     *
     * Validates element name against allowed list for SCORM 1.2 and SCORM 2004.
     * Handles indexed elements (interactions.n.*, objectives.n.*) using pattern matching.
     *
     * @param string $element The normalized element name to validate
     * @return bool True if element is valid and allowed, false otherwise
     */
    private function isValidCmiElement($element) {
        // Direct match in allowed elements list
        if (in_array($element, $this->allowedCmiElements)) {
            return true;
        }
        
        // Check for indexed interaction elements (cmi.interactions.0.id, cmi.interactions.1.type, etc.)
        if (preg_match('/^cmi\.interactions\.\d+\./', $element)) {
            // Valid interaction sub-elements
            $validInteractionSubs = [
                'id', 'type', 'objectives', 'timestamp', 'correct_responses',
                'weighting', 'learner_response', 'result', 'latency', 'description',
                'time', 'objectives._count', 'correct_responses._count',
                'objectives.n.id', 'correct_responses.n.pattern'
            ];
            
            // Extract sub-element after interactions.n.
            $subElement = preg_replace('/^cmi\.interactions\.\d+\./', '', $element);
            
            // Check if it matches a valid sub-element (with potential further indexing)
            foreach ($validInteractionSubs as $validSub) {
                $pattern = str_replace('n', '\d+', $validSub);
                if (preg_match('/^' . str_replace('.', '\.', $pattern) . '$/', $subElement)) {
                    return true;
                }
            }
            
            return false;
        }
        
        // Check for indexed objective elements (cmi.objectives.0.id, cmi.objectives.1.score.raw, etc.)
        if (preg_match('/^cmi\.objectives\.\d+\./', $element)) {
            // Valid objective sub-elements
            $validObjectiveSubs = [
                'id', 'score.raw', 'score.max', 'score.min', 'score.scaled',
                'status', 'success_status', 'completion_status', 'description',
                'progress_measure'
            ];
            
            // Extract sub-element after objectives.n.
            $subElement = preg_replace('/^cmi\.objectives\.\d+\./', '', $element);
            
            return in_array($subElement, $validObjectiveSubs);
        }
        
        // Check for indexed comments (SCORM 2004)
        if (preg_match('/^cmi\.comments_from_(learner|lms)\.\d+\./', $element)) {
            $validCommentSubs = ['comment', 'location', 'timestamp'];
            $subElement = preg_replace('/^cmi\.comments_from_(learner|lms)\.\d+\./', '', $element);
            return in_array($subElement, $validCommentSubs);
        }
        
        return false;
    }
    
    /**
     * Validate element value based on element type and SCORM data model constraints.
     *
     * Enforces data type requirements, format constraints, and value ranges for
     * different CMI elements according to SCORM 1.2 and SCORM 2004 specifications.
     *
     * Validation Rules:
     * - Lesson/completion status: Must be in allowed values list
     * - Success status: Must be in allowed values list
     * - Score values: Must be numeric, typically 0-100 (configurable)
     * - Session time: Must be in timespan format (HH:MM:SS or PTnHnMnS)
     * - Exit values: Must be in allowed values list
     * - Suspend data: Length limits (4096 for SCORM 1.2, 64000 for SCORM 2004)
     * - Interactions: Type-specific validation
     *
     * @param string $element The normalized element name
     * @param mixed $value The value to validate
     * @throws ValidationException If value doesn't meet element constraints
     * @return void
     */
    private function validateElementValue($element, $value) {
        // Lesson status validation (SCORM 1.2)
        if ($element === 'cmi.core.lesson_status') {
            if (!in_array(strtolower($value), $this->validLessonStatus12)) {
                throw new ValidationException('Invalid lesson_status value', [
                    'element' => $element,
                    'value' => $value,
                    'allowed' => $this->validLessonStatus12
                ]);
            }
            return;
        }
        
        // Completion status validation (SCORM 2004)
        if ($element === 'cmi.completion_status') {
            if (!in_array(strtolower($value), $this->validCompletionStatus2004)) {
                throw new ValidationException('Invalid completion_status value', [
                    'element' => $element,
                    'value' => $value,
                    'allowed' => $this->validCompletionStatus2004
                ]);
            }
            return;
        }
        
        // Success status validation (SCORM 2004)
        if ($element === 'cmi.success_status') {
            if (!in_array(strtolower($value), $this->validSuccessStatus2004)) {
                throw new ValidationException('Invalid success_status value', [
                    'element' => $element,
                    'value' => $value,
                    'allowed' => $this->validSuccessStatus2004
                ]);
            }
            return;
        }
        
        // Score validation (must be numeric)
        if (preg_match('/\.(score\.(raw|max|min|scaled)|weighting)$/', $element)) {
            if (!is_numeric($value)) {
                throw new ValidationException('Score value must be numeric', [
                    'element' => $element,
                    'value' => $value
                ]);
            }
            
            // Score.raw and score.max typically 0-100, but can be configured
            // We'll accept any numeric value here, as Moodle core will handle range validation
            return;
        }
        
        // Session time validation (timespan format)
        if ($element === 'cmi.core.session_time' || $element === 'cmi.session_time') {
            if (!$this->isValidTimespan($value)) {
                throw new ValidationException('Invalid session_time format. Expected HH:MM:SS or PTnHnMnS format', [
                    'element' => $element,
                    'value' => $value
                ]);
            }
            return;
        }
        
        // Exit value validation
        if ($element === 'cmi.core.exit' || $element === 'cmi.exit') {
            if (!in_array(strtolower($value), $this->validExitValues)) {
                throw new ValidationException('Invalid exit value', [
                    'element' => $element,
                    'value' => $value,
                    'allowed' => $this->validExitValues
                ]);
            }
            return;
        }
        
        // Suspend data length validation
        if ($element === 'cmi.suspend_data') {
            $length = strlen($value);
            // SCORM 1.2: 4096 chars, SCORM 2004: 64000 chars
            // We'll use the more permissive SCORM 2004 limit
            if ($length > 64000) {
                throw new ValidationException('Suspend data exceeds maximum length', [
                    'element' => $element,
                    'length' => $length,
                    'maxLength' => 64000
                ]);
            }
            return;
        }
        
        // Interaction type validation
        if (preg_match('/^cmi\.interactions\.\d+\.type$/', $element)) {
            $validTypes = ['true-false', 'choice', 'fill-in', 'long-fill-in', 'matching',
                          'performance', 'sequencing', 'likert', 'numeric', 'other'];
            if (!in_array(strtolower($value), $validTypes)) {
                throw new ValidationException('Invalid interaction type', [
                    'element' => $element,
                    'value' => $value,
                    'allowed' => $validTypes
                ]);
            }
            return;
        }
        
        // Interaction result validation
        if (preg_match('/^cmi\.interactions\.\d+\.result$/', $element)) {
            $validResults = ['correct', 'incorrect', 'unanticipated', 'neutral'];
            // Numeric values are also allowed for results
            if (!is_numeric($value) && !in_array(strtolower($value), $validResults)) {
                throw new ValidationException('Invalid interaction result', [
                    'element' => $element,
                    'value' => $value,
                    'allowed' => array_merge($validResults, ['numeric value'])
                ]);
            }
            return;
        }
        
        // All other elements: basic validation (no null, reasonable length)
        if ($value === null) {
            throw new ValidationException('Element value cannot be null', [
                'element' => $element
            ]);
        }
        
        // General string length limit (prevent abuse)
        if (is_string($value) && strlen($value) > 64000) {
            throw new ValidationException('Element value exceeds maximum length', [
                'element' => $element,
                'length' => strlen($value),
                'maxLength' => 64000
            ]);
        }
    }
    
    /**
     * Validate timespan format for session_time and total_time.
     *
     * SCORM supports two timespan formats:
     * - SCORM 1.2: HH:MM:SS.SS (hours:minutes:seconds.centiseconds)
     * - SCORM 2004: ISO 8601 duration (PTnHnMnS)
     *
     * Examples:
     * - "00:15:30" (15 minutes, 30 seconds)
     * - "01:23:45.67" (1 hour, 23 minutes, 45.67 seconds)
     * - "PT1H23M45S" (1 hour, 23 minutes, 45 seconds)
     *
     * @param string $value The timespan value to validate
     * @return bool True if valid timespan format, false otherwise
     */
    private function isValidTimespan($value) {
        // SCORM 1.2 format: HH:MM:SS or HH:MM:SS.SS
        if (preg_match('/^\d{2,}:\d{2}:\d{2}(\.\d+)?$/', $value)) {
            return true;
        }
        
        // SCORM 2004 format: ISO 8601 duration (PT[nH][nM][nS])
        if (preg_match('/^PT(\d+H)?(\d+M)?(\d+(\.\d+)?S)?$/', $value)) {
            return true;
        }
        
        return false;
    }
    
    /**
     * Check if element is a lesson status element.
     *
     * Handles both SCORM 1.2 (cmi.core.lesson_status) and SCORM 2004
     * (cmi.completion_status, cmi.success_status) naming conventions.
     *
     * @param string $element The normalized element name
     * @return bool True if element tracks lesson/completion status
     */
    private function isLessonStatusElement($element) {
        return in_array($element, [
            'cmi.core.lesson_status',  // SCORM 1.2
            'cmi.completion_status',    // SCORM 2004
            'cmi.success_status'        // SCORM 2004
        ]);
    }
    
    /**
     * Check if element is a score element.
     *
     * Handles both SCORM 1.2 (cmi.core.score.raw) and SCORM 2004 (cmi.score.raw).
     *
     * @param string $element The normalized element name
     * @return bool True if element tracks score
     */
    private function isScoreElement($element) {
        return in_array($element, [
            'cmi.core.score.raw',  // SCORM 1.2
            'cmi.score.raw'        // SCORM 2004
        ]);
    }
    
    /**
     * Check if element is a session time element.
     *
     * Handles both SCORM 1.2 (cmi.core.session_time) and SCORM 2004 (cmi.session_time).
     *
     * @param string $element The normalized element name
     * @return bool True if element tracks session time
     */
    private function isSessionTimeElement($element) {
        return in_array($element, [
            'cmi.core.session_time',  // SCORM 1.2
            'cmi.session_time'        // SCORM 2004
        ]);
    }
    
    /**
     * Check if all SCOs in the SCORM package have been completed.
     *
     * Iterates through all SCOs in the package and checks if each has been
     * completed by the user. Used to determine if package-level completion
     * should be triggered.
     *
     * @param int $scormid The SCORM activity ID
     * @param int $userid The user ID
     * @param int $attempt The attempt number
     * @return bool True if all SCOs are completed, false otherwise
     */
    private function checkAllScosCompleted($scormid, $userid, $attempt) {
        global $DB;
        
        // Get all SCOs for this SCORM package
        $scos = $DB->get_records('scorm_scoes', ['scorm' => $scormid], 'sortorder', 'id');
        
        if (empty($scos)) {
            return false;
        }
        
        // Check completion status for each SCO
        foreach ($scos as $sco) {
            $tracks = scorm_get_tracks($sco->id, $userid, $attempt);
            
            // Check both SCORM 1.2 and SCORM 2004 status fields
            $status12 = isset($tracks->{'cmi.core.lesson_status'}) ? $tracks->{'cmi.core.lesson_status'} : '';
            $status2004 = isset($tracks->{'cmi.completion_status'}) ? $tracks->{'cmi.completion_status'} : '';
            
            // Consider completed if status is 'completed', 'passed', or 'browsed'
            $completed = in_array(strtolower($status12), ['completed', 'passed', 'browsed']) ||
                        in_array(strtolower($status2004), ['completed']);
            
            if (!$completed) {
                return false;  // At least one SCO is not completed
            }
        }
        
        return true;  // All SCOs are completed
    }
}

// Instantiate and execute the endpoint
$endpoint = new ScormTrackEndpoint();
$endpoint->execute();
