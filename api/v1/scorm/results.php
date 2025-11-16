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
 * REST API endpoint for retrieving SCORM attempt results with tracking data.
 *
 * This endpoint provides comprehensive SCORM attempt information including:
 * - Complete CMI data model elements (cmi.core.*, cmi.interactions.*, cmi.objectives.*)
 * - Calculated grades using configured grading method (highest, average, first, last)
 * - Completion status and progress tracking
 * - SCO-level results with scores, times, and interactions
 * - Learner performance analytics and detailed tracking data
 *
 * Handles GET /api/v1/scorm/attempts/{id} to fetch comprehensive attempt information.
 * Returns JSON-formatted attempt results for React frontend to display learner progress,
 * review completed attempts, and show detailed performance analytics.
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Include required files
require_once(__DIR__ . '/../../../config.php');
require_once($CFG->dirroot . '/mod/scorm/lib.php');
require_once($CFG->dirroot . '/mod/scorm/locallib.php');
require_once(__DIR__ . '/../../lib/api_base.php');
require_once(__DIR__ . '/../../lib/api_exception.php');

/**
 * SCORM Attempt Results API endpoint class.
 *
 * Extends ApiBase to provide JWT authentication, HTTP method routing,
 * and standardized response formatting for SCORM attempt results retrieval.
 *
 * This endpoint:
 * - Validates JWT token and authenticates user
 * - Retrieves complete attempt data with all tracking information
 * - Enforces permission checks (attempt owner or viewreport capability)
 * - Calculates grades using existing Moodle SCORM grading functions
 * - Formats CMI tracking data hierarchically grouped by SCO
 * - Returns comprehensive attempt results with scores, completion, and interactions
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class ScormResultsEndpoint extends ApiBase {
    
    /**
     * Handle GET request for SCORM attempt results.
     *
     * Retrieves comprehensive attempt information including:
     * - Attempt metadata (ID, number, user, timestamps)
     * - Overall status (incomplete, completed, passed, failed)
     * - Calculated grade using configured grading method
     * - Complete tracking data from scorm_attempt and scorm_scoes_value tables
     * - SCO-level results with scores, times, and interactions
     * - Overall metrics (total time, completion percentage)
     *
     * Authorization:
     * - User must own the attempt OR
     * - User must have mod/scorm:viewreport capability in the context
     *
     * @return void Sends JSON response via success() method
     * @throws NotFoundException If attempt ID is invalid or not found
     * @throws ForbiddenException If user lacks permission to view this attempt
     */
    protected function handle_get() {
        global $DB;
        
        // Get authenticated user from JWT token (provided by ApiBase constructor)
        $user = $this->getUser();
        
        // Retrieve attempt ID from URL parameter with validation
        $attemptid = $this->getParam('id', PARAM_INT);
        
        if (!$attemptid) {
            throw new NotFoundException(
                'Attempt ID is required',
                ['parameter' => 'id', 'expected' => 'integer']
            );
        }
        
        // Retrieve attempt record from scorm_attempt table
        $attempt = $DB->get_record(
            'scorm_attempt',
            ['id' => $attemptid],
            '*',
            MUST_EXIST
        );
        
        if (!$attempt) {
            throw new NotFoundException(
                'SCORM attempt not found',
                ['attemptId' => $attemptid]
            );
        }
        
        // Extract attempt details
        $scormid = $attempt->scormid;
        $attemptuserid = $attempt->userid;
        $attemptnumber = $attempt->attempt;
        
        // Retrieve SCORM record
        $scorm = $DB->get_record('scorm', ['id' => $scormid], '*', MUST_EXIST);
        
        // Retrieve course module for context
        $cm = get_coursemodule_from_instance('scorm', $scorm->id, $scorm->course, false, MUST_EXIST);
        $context = context_module::instance($cm->id);
        
        // Authorization check: user must own attempt OR have viewreport capability
        $canview = false;
        
        if ($attemptuserid == $user->id) {
            // User owns this attempt
            $canview = true;
        } else if (has_capability('mod/scorm:viewreport', $context, $user->id)) {
            // User has capability to view others' reports
            $canview = true;
        }
        
        if (!$canview) {
            throw new ForbiddenException(
                'You do not have permission to view this SCORM attempt',
                [
                    'attemptUserId' => $attemptuserid,
                    'currentUserId' => $user->id,
                    'requiredCapability' => 'mod/scorm:viewreport'
                ]
            );
        }
        
        // Enforce base permission check for viewing scores
        $this->checkCapability('mod/scorm:viewscores', $context);
        
        // Calculate grade for this specific attempt using existing Moodle function
        // scorm_grade_user_attempt calculates grade for a specific attempt number
        $gradedata = scorm_grade_user_attempt($scorm, $attemptuserid, $attemptnumber);
        
        // Get all SCOs for this SCORM package
        $scoes = $DB->get_records('scorm_scoes', ['scorm' => $scormid], 'sortorder');
        
        // Format tracking data by SCO
        $scosdata = [];
        $totaltime = 0;
        $scoscompleted = 0;
        $scostotal = 0;
        $totalinteractions = 0;
        
        foreach ($scoes as $sco) {
            // Only process actual content SCOs (not organizational)
            if ($sco->scormtype !== 'sco') {
                continue;
            }
            
            $scostotal++;
            $scodata = [
                'sco_id' => (int)$sco->id,
                'sco_identifier' => $sco->identifier,
                'sco_title' => $sco->title,
                'status' => 'not attempted',
                'score_raw' => null,
                'score_min' => null,
                'score_max' => null,
                'score_scaled' => null,
                'total_time' => '00:00:00',
                'suspend_data' => null,
                'lesson_location' => null,
                'entry' => '',
                'interactions' => []
            ];
            
            // Get tracking data for this SCO using existing Moodle function
            // scorm_get_tracks($scoid, $userid, $attempt) returns tracking data for one SCO
            $scotrack = scorm_get_tracks($sco->id, $attemptuserid, $attemptnumber);
            
            if ($scotrack) {
                
                // Extract CMI core elements
                if (isset($scotrack->status)) {
                    $scodata['status'] = $scotrack->status;
                    if (in_array($scotrack->status, ['completed', 'passed'])) {
                        $scoscompleted++;
                    }
                }
                
                if (isset($scotrack->score_raw)) {
                    $scodata['score_raw'] = (float)$scotrack->score_raw;
                }
                
                if (isset($scotrack->score_min)) {
                    $scodata['score_min'] = (float)$scotrack->score_min;
                }
                
                if (isset($scotrack->score_max)) {
                    $scodata['score_max'] = (float)$scotrack->score_max;
                }
                
                if (isset($scotrack->score_scaled)) {
                    $scodata['score_scaled'] = (float)$scotrack->score_scaled;
                }
                
                if (isset($scotrack->total_time)) {
                    $scodata['total_time'] = $scotrack->total_time;
                    // Convert SCORM time to seconds for aggregation
                    $seconds = scorm_time_to_seconds($scotrack->total_time);
                    $totaltime += $seconds;
                }
                
                if (isset($scotrack->suspend_data)) {
                    $scodata['suspend_data'] = $scotrack->suspend_data;
                }
                
                if (isset($scotrack->lesson_location)) {
                    $scodata['lesson_location'] = $scotrack->lesson_location;
                }
                
                if (isset($scotrack->entry)) {
                    $scodata['entry'] = $scotrack->entry;
                }
                
                // Extract interaction data
                // SCORM interactions are stored with element names like:
                // cmi.interactions.0.id, cmi.interactions.0.type, etc.
                $interactions = [];
                $interactioncount = 0;
                
                // Look for interaction count
                if (isset($scotrack->interactions_count)) {
                    $interactioncount = (int)$scotrack->interactions_count;
                } else if (isset($scotrack->{'cmi.interactions._count'})) {
                    $interactioncount = (int)$scotrack->{'cmi.interactions._count'};
                }
                
                for ($i = 0; $i < $interactioncount; $i++) {
                    $interaction = [
                        'id' => isset($scotrack->{"cmi.interactions.$i.id"}) ? 
                            $scotrack->{"cmi.interactions.$i.id"} : null,
                        'type' => isset($scotrack->{"cmi.interactions.$i.type"}) ? 
                            $scotrack->{"cmi.interactions.$i.type"} : null,
                        'learner_response' => isset($scotrack->{"cmi.interactions.$i.learner_response"}) ? 
                            $scotrack->{"cmi.interactions.$i.learner_response"} : null,
                        'result' => isset($scotrack->{"cmi.interactions.$i.result"}) ? 
                            $scotrack->{"cmi.interactions.$i.result"} : null,
                        'latency' => isset($scotrack->{"cmi.interactions.$i.latency"}) ? 
                            $scotrack->{"cmi.interactions.$i.latency"} : null,
                        'weighting' => isset($scotrack->{"cmi.interactions.$i.weighting"}) ? 
                            (float)$scotrack->{"cmi.interactions.$i.weighting"} : null,
                        'timestamp' => isset($scotrack->{"cmi.interactions.$i.time"}) ? 
                            $scotrack->{"cmi.interactions.$i.time"} : null,
                        'correct_responses' => []
                    ];
                    
                    // Get correct responses (can be multiple)
                    $correctcount = 0;
                    if (isset($scotrack->{"cmi.interactions.$i.correct_responses._count"})) {
                        $correctcount = (int)$scotrack->{"cmi.interactions.$i.correct_responses._count"};
                    }
                    
                    for ($j = 0; $j < $correctcount; $j++) {
                        if (isset($scotrack->{"cmi.interactions.$i.correct_responses.$j.pattern"})) {
                            $interaction['correct_responses'][] = 
                                $scotrack->{"cmi.interactions.$i.correct_responses.$j.pattern"};
                        }
                    }
                    
                    $interactions[] = $interaction;
                    $totalinteractions++;
                }
                
                $scodata['interactions'] = $interactions;
            }
            
            $scosdata[] = $scodata;
        }
        
        // Calculate completion percentage
        $completionpercentage = $scostotal > 0 ? 
            round(($scoscompleted / $scostotal) * 100, 2) : 0;
        
        // Determine overall attempt status
        $overallstatus = 'incomplete';
        if ($scoscompleted == $scostotal && $scostotal > 0) {
            $overallstatus = 'completed';
        }
        
        // Check if attempt is passed based on grade
        $passed = false;
        if (isset($gradedata->rawgrade) && isset($scorm->gradepass)) {
            $passed = $gradedata->rawgrade >= $scorm->gradepass;
            if ($passed && $overallstatus == 'completed') {
                $overallstatus = 'passed';
            }
        }
        
        // Get attempt start and finish times
        $timestarted = null;
        $timefinished = null;
        
        // Get times from scorm_scoes_value table (correct table for tracking data)
        // Use attemptid (which is the id from scorm_attempt table)
        $attempttracks = $DB->get_records(
            'scorm_scoes_value',
            ['attemptid' => $attemptid],
            'timemodified ASC'
        );
        
        if ($attempttracks) {
            $firsttrack = reset($attempttracks);
            $lasttrack = end($attempttracks);
            $timestarted = $firsttrack->timemodified;
            
            // Consider finished if status is completed or passed
            if (in_array($overallstatus, ['completed', 'passed'])) {
                $timefinished = $lasttrack->timemodified;
            }
        }
        
        // Determine grading method used
        $grademethods = [
            GRADESCOES => 'learning',
            GRADEHIGHEST => 'highest',
            GRADEAVERAGE => 'average',
            GRADESUM => 'sum'
        ];
        $grademethod = isset($grademethods[$scorm->whatgrade]) ? 
            $grademethods[$scorm->whatgrade] : 'highest';
        
        // Check for include_raw query parameter for debugging
        $includeraw = optional_param('include_raw', false, PARAM_BOOL);
        
        // Build response data
        $responsedata = [
            'attempt_results' => [
                'attempt_id' => (int)$attemptid,
                'attempt_number' => (int)$attemptnumber,
                'userid' => (int)$attemptuserid,
                'scormid' => (int)$scormid,
                'scorm_name' => $scorm->name,
                'timestarted' => $timestarted,
                'timefinished' => $timefinished,
                'status' => $overallstatus,
                'grade' => [
                    'raw_grade' => isset($gradedata->rawgrade) ? 
                        (float)$gradedata->rawgrade : null,
                    'scaled_grade' => isset($gradedata->rawgrade) && isset($scorm->grade) ? 
                        round(($gradedata->rawgrade / $scorm->grade) * 100, 2) : null,
                    'max_grade' => isset($scorm->grade) ? (float)$scorm->grade : null,
                    'grade_method' => $grademethod,
                    'passed' => $passed,
                    'pass_threshold' => isset($scorm->gradepass) ? 
                        (float)$scorm->gradepass : null
                ],
                'tracking_data' => [
                    'scos' => $scosdata,
                    'total_scos' => $scostotal,
                    'completed_scos' => $scoscompleted
                ],
                'overall_metrics' => [
                    'total_time_spent' => scorm_format_duration($totaltime),
                    'total_time_seconds' => $totaltime,
                    'completion_percentage' => $completionpercentage,
                    'scos_completed_count' => $scoscompleted,
                    'scos_total_count' => $scostotal,
                    'total_interactions' => $totalinteractions
                ]
            ]
        ];
        
        // Include raw tracking data if requested for debugging
        if ($includeraw) {
            $responsedata['attempt_results']['raw_tracks'] = $attempttracks;
        }
        
        // Return success response with attempt results
        $this->success($responsedata);
    }
}

// Execute the endpoint
$endpoint = new ScormResultsEndpoint();
$endpoint->execute();
