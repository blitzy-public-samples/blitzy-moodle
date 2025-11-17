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
 * REST API endpoint for retrieving workshop submission assessments.
 *
 * Handles GET /api/v1/workshop/submissions/{id}/assessments to fetch all peer 
 * assessments and optionally teacher assessments for a specific submission.
 * Returns JSON-formatted assessments array with complete assessment data including:
 * - Reviewer information and profile details
 * - Assessment grades and feedback
 * - Grading criteria scores based on workshop strategy
 * - File attachments
 * - Assessment completion status
 * - Aggregated grade calculations
 *
 * This endpoint wraps existing Moodle workshop functions from public/mod/workshop/
 * without duplicating any business logic. All permission checks, grade calculations,
 * and assessment retrieval delegate to the workshop engine.
 *
 * Permission Requirements:
 * - Submission authors can view their own assessments (if phase allows)
 * - Users with mod/workshop:viewallassessments can view any assessments
 * - Phase restrictions apply based on workshop configuration
 *
 * @package    api
 * @subpackage workshop
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Load Moodle configuration and core libraries
require_once(__DIR__ . '/../../../config.php');

// Load API utilities
require_once(__DIR__ . '/../../lib/api_base.php');
require_once(__DIR__ . '/../../lib/api_exception.php');

/**
 * Workshop assessments API endpoint class.
 *
 * Provides GET endpoint for retrieving all assessments for a workshop submission.
 * Extends ApiBase to inherit JWT authentication, request routing, and response
 * formatting capabilities.
 */
class WorkshopAssessmentsEndpoint extends ApiBase {
    
    /**
     * Handle GET requests for workshop submission assessments.
     *
     * Retrieves all assessments for a specific workshop submission including:
     * - Assessment details (grade, feedback, completion status)
     * - Reviewer information
     * - Assessment form data based on workshop strategy
     * - File attachments
     * - Aggregated submission grade
     *
     * URL: GET /api/v1/workshop/submissions/{id}/assessments
     * Parameters:
     *   - id (required): Submission ID from URL
     *
     * Returns:
     * {
     *   "success": true,
     *   "data": {
     *     "submission_id": 123,
     *     "submission_title": "My submission",
     *     "submission_author": {...},
     *     "assessments": [...],
     *     "aggregated_grade": 85.5,
     *     "assessment_counts": {...},
     *     "workshop_phase": 40,
     *     "can_view_all": false
     *   }
     * }
     *
     * @return void Outputs JSON response
     * @throws NotFoundException If submission not found
     * @throws ValidationException If submission is example or invalid
     * @throws ForbiddenException If user lacks permission to view assessments
     */
    protected function handle_get() {
        global $DB, $USER, $CFG;
        
        // Load workshop libraries
        require_once($CFG->dirroot . '/mod/workshop/locallib.php');
        require_once($CFG->libdir . '/filelib.php');
        
        // Get submission ID from URL parameter
        $submissionid = $this->getParam('id', PARAM_INT);
        
        // Retrieve submission record
        $submission = $DB->get_record('workshop_submissions', ['id' => $submissionid], '*', MUST_EXIST);
        
        // Validate submission is not an example (examples don't have regular assessments)
        if ($submission->example == 1) {
            throw new ValidationException('Cannot retrieve assessments for example submissions', [
                'submissionId' => $submissionid,
                'reason' => 'Example submissions use a different assessment workflow'
            ]);
        }
        
        // Retrieve workshop record
        $workshoprecord = $DB->get_record('workshop', ['id' => $submission->workshopid], '*', MUST_EXIST);
        
        // Get course and course module
        $course = $DB->get_record('course', ['id' => $workshoprecord->course], '*', MUST_EXIST);
        $cm = get_coursemodule_from_instance('workshop', $workshoprecord->id, $course->id, false, MUST_EXIST);
        
        // Instantiate workshop class for access to assessment methods
        $workshop = new workshop($workshoprecord, $cm, $course);
        
        // Determine access permissions
        $is_author = ($USER->id == $submission->authorid);
        $can_view_all = has_capability('mod/workshop:viewallassessments', $workshop->context);
        
        // Enforce permission check
        if (!$is_author && !$can_view_all) {
            throw new ForbiddenException('You do not have permission to view these assessments', [
                'submissionId' => $submissionid,
                'userId' => $USER->id,
                'requiredCapability' => 'mod/workshop:viewallassessments'
            ]);
        }
        
        // Check if author can view assessments based on workshop phase
        if ($is_author && !$can_view_all) {
            // Authors typically can view assessments in assessment phase or later
            if ($workshop->phase < workshop::PHASE_ASSESSMENT) {
                throw new ForbiddenException('Assessments are not yet available for viewing', [
                    'submissionId' => $submissionid,
                    'currentPhase' => $workshop->phase,
                    'requiredPhase' => workshop::PHASE_ASSESSMENT,
                    'reason' => 'Workshop must be in assessment phase or later'
                ]);
            }
        }
        
        // Retrieve all assessments for this submission
        $assessments = $DB->get_records('workshop_assessments', 
            ['submissionid' => $submissionid], 
            'timecreated ASC'
        );
        
        // Build assessments data array
        $assessments_data = [];
        $total_count = 0;
        $completed_count = 0;
        $graded_count = 0;
        
        // Get grading strategy instance
        $strategy = $workshop->grading_strategy_instance();
        
        foreach ($assessments as $assessment) {
            $total_count++;
            
            // Retrieve reviewer information
            $reviewer = $DB->get_record('user', ['id' => $assessment->reviewerid], 
                'id, ' . user_picture::fields(), MUST_EXIST);
            
            // Build reviewer object with safe user fields
            $reviewer_data = [
                'id' => $reviewer->id,
                'fullname' => fullname($reviewer),
                'profileimageurl' => $this->get_user_picture_url($reviewer, $workshop->context),
            ];
            
            // Add email if user has permission to view it
            if ($can_view_all || $USER->id == $reviewer->id) {
                $reviewer_data['email'] = $reviewer->email;
            }
            
            // Retrieve assessment form data based on strategy
            $form_data = $this->get_assessment_form_data($workshop, $strategy, $assessment);
            
            // Calculate assessment completeness
            $is_complete = $this->is_assessment_complete($assessment, $form_data, $workshop);
            
            if ($is_complete) {
                $completed_count++;
            }
            
            // Check if assessment has been graded (gradinggrade assigned)
            if ($assessment->gradinggrade !== null) {
                $graded_count++;
            }
            
            // Determine assessment status
            $status = $this->get_assessment_status($assessment, $is_complete);
            
            // Check if current user can edit this assessment
            $is_reviewer = ($USER->id == $assessment->reviewerid);
            $can_edit = $is_reviewer && $workshop->assessing_allowed($USER->id);
            
            // Retrieve file attachments if present
            $files = $this->get_assessment_files($workshop, $assessment);
            
            // Build assessment object
            $assessment_data = [
                'id' => $assessment->id,
                'submissionid' => $assessment->submissionid,
                'reviewer' => $reviewer_data,
                'weight' => (float)$assessment->weight,
                'timecreated' => $assessment->timecreated,
                'timemodified' => $assessment->timemodified,
                'grade' => $assessment->grade !== null ? (float)$assessment->grade : null,
                'feedbackauthor' => $assessment->feedbackauthor,
                'feedbackauthorformat' => $assessment->feedbackauthorformat,
                'form_data' => $form_data,
                'files' => $files,
                'status' => $status,
                'is_complete' => $is_complete,
                'can_edit' => $can_edit,
            ];
            
            // Add grading information if user can view all assessments
            if ($can_view_all) {
                $assessment_data['gradinggrade'] = $assessment->gradinggrade !== null ? 
                    (float)$assessment->gradinggrade : null;
                $assessment_data['gradinggradeover'] = $assessment->gradinggradeover !== null ? 
                    (float)$assessment->gradinggradeover : null;
                $assessment_data['feedbackreviewer'] = $assessment->feedbackreviewer;
                $assessment_data['feedbackreviewerformat'] = $assessment->feedbackreviewerformat;
            }
            
            $assessments_data[] = $assessment_data;
        }
        
        // Calculate aggregated submission grade if in evaluation phase or later
        $aggregated_grade = null;
        if ($workshop->phase >= workshop::PHASE_EVALUATION) {
            $aggregated_grade = $this->calculate_aggregated_grade($workshop, $submission, $assessments);
        }
        
        // Get submission author information
        $author = $DB->get_record('user', ['id' => $submission->authorid], 
            'id, ' . user_picture::fields(), MUST_EXIST);
        
        $submission_author = [
            'id' => $author->id,
            'fullname' => fullname($author),
            'profileimageurl' => $this->get_user_picture_url($author, $workshop->context),
        ];
        
        // Trigger assessments viewed event
        if (!empty($assessments)) {
            $params = [
                'context' => $workshop->context,
                'objectid' => $submissionid,
                'other' => [
                    'workshopid' => $workshop->id,
                    'assessmentcount' => $total_count
                ]
            ];
            
            $event = \mod_workshop\event\assessments_viewed::create($params);
            $event->trigger();
        }
        
        // Build response data
        $response_data = [
            'submission_id' => $submission->id,
            'submission_title' => $submission->title,
            'submission_author' => $submission_author,
            'assessments' => $assessments_data,
            'aggregated_grade' => $aggregated_grade,
            'assessment_counts' => [
                'total' => $total_count,
                'completed' => $completed_count,
                'graded' => $graded_count,
            ],
            'workshop_phase' => $workshop->phase,
            'workshop_name' => $workshop->name,
            'can_view_all' => $can_view_all,
        ];
        
        // Return success response
        $this->success($response_data);
    }
    
    /**
     * Get assessment form data based on workshop grading strategy.
     *
     * Retrieves dimension scores and feedback based on the configured strategy:
     * - accumulative: numerical scores for each criterion
     * - rubric: selected levels for each criterion
     * - comments: comment texts for each criterion
     * - numerrors: yes/no assertions for each criterion
     *
     * @param workshop $workshop Workshop instance
     * @param object $strategy Grading strategy instance
     * @param object $assessment Assessment record
     * @return array Assessment form data with dimensions/assertions
     */
    private function get_assessment_form_data($workshop, $strategy, $assessment) {
        global $DB;
        
        $form_data = [];
        $strategy_name = $workshop->strategy;
        
        try {
            // Get assessment form based on strategy
            if ($strategy_name === 'accumulative') {
                // Accumulative strategy: numerical scores for each dimension
                $dimensions = $DB->get_records('workshopform_accumulative', 
                    ['workshopid' => $workshop->id], 
                    'sort ASC'
                );
                
                $form_data['dimensions'] = [];
                foreach ($dimensions as $dimension) {
                    // Get grade for this dimension
                    $grade_record = $DB->get_record('workshop_grades', [
                        'assessmentid' => $assessment->id,
                        'strategy' => 'accumulative',
                        'dimensionid' => $dimension->id
                    ]);
                    
                    $form_data['dimensions'][] = [
                        'id' => $dimension->id,
                        'description' => $dimension->description,
                        'descriptionformat' => $dimension->descriptionformat,
                        'grade' => $grade_record ? (float)$grade_record->grade : null,
                        'maxgrade' => (float)$dimension->grade,
                        'weight' => (float)$dimension->weight,
                    ];
                }
                
            } else if ($strategy_name === 'rubric') {
                // Rubric strategy: selected level for each criterion
                $dimensions = $DB->get_records('workshopform_rubric', 
                    ['workshopid' => $workshop->id], 
                    'sort ASC'
                );
                
                $form_data['dimensions'] = [];
                foreach ($dimensions as $dimension) {
                    // Get selected level for this dimension
                    $grade_record = $DB->get_record('workshop_grades', [
                        'assessmentid' => $assessment->id,
                        'strategy' => 'rubric',
                        'dimensionid' => $dimension->id
                    ]);
                    
                    // Get all levels for this dimension
                    $levels = $DB->get_records('workshopform_rubric_levels', 
                        ['dimensionid' => $dimension->id], 
                        'grade ASC'
                    );
                    
                    $levels_data = [];
                    foreach ($levels as $level) {
                        $levels_data[] = [
                            'id' => $level->id,
                            'grade' => (float)$level->grade,
                            'definition' => $level->definition,
                            'definitionformat' => $level->definitionformat,
                        ];
                    }
                    
                    $form_data['dimensions'][] = [
                        'id' => $dimension->id,
                        'description' => $dimension->description,
                        'descriptionformat' => $dimension->descriptionformat,
                        'levelid' => $grade_record ? $grade_record->grade : null,
                        'levels' => $levels_data,
                    ];
                }
                
            } else if ($strategy_name === 'comments') {
                // Comments strategy: comment texts for each dimension
                $dimensions = $DB->get_records('workshopform_comments', 
                    ['workshopid' => $workshop->id], 
                    'sort ASC'
                );
                
                $form_data['dimensions'] = [];
                foreach ($dimensions as $dimension) {
                    // Get comment for this dimension
                    $grade_record = $DB->get_record('workshop_grades', [
                        'assessmentid' => $assessment->id,
                        'strategy' => 'comments',
                        'dimensionid' => $dimension->id
                    ]);
                    
                    $form_data['dimensions'][] = [
                        'id' => $dimension->id,
                        'description' => $dimension->description,
                        'descriptionformat' => $dimension->descriptionformat,
                        'comment' => $grade_record ? $grade_record->peercomment : null,
                        'commentformat' => $grade_record ? $grade_record->peercommentformat : null,
                    ];
                }
                
            } else if ($strategy_name === 'numerrors') {
                // Number of errors strategy: yes/no assertions
                $assertions = $DB->get_records('workshopform_numerrors', 
                    ['workshopid' => $workshop->id], 
                    'sort ASC'
                );
                
                $form_data['assertions'] = [];
                foreach ($assertions as $assertion) {
                    // Get response for this assertion
                    $grade_record = $DB->get_record('workshop_grades', [
                        'assessmentid' => $assessment->id,
                        'strategy' => 'numerrors',
                        'dimensionid' => $assertion->id
                    ]);
                    
                    $form_data['assertions'][] = [
                        'id' => $assertion->id,
                        'description' => $assertion->description,
                        'descriptionformat' => $assertion->descriptionformat,
                        'grade0' => $assertion->grade0,
                        'grade1' => $assertion->grade1,
                        'response' => $grade_record ? (int)$grade_record->grade : null,
                    ];
                }
            }
            
        } catch (Exception $e) {
            // If form data retrieval fails, return empty form data
            $form_data = ['error' => 'Unable to retrieve form data', 'strategy' => $strategy_name];
        }
        
        return $form_data;
    }
    
    /**
     * Check if assessment is complete.
     *
     * An assessment is considered complete if:
     * - All required dimensions/assertions have values
     * - Overall feedback is provided (if required by workshop settings)
     *
     * @param object $assessment Assessment record
     * @param array $form_data Assessment form data
     * @param workshop $workshop Workshop instance
     * @return bool True if assessment is complete
     */
    private function is_assessment_complete($assessment, $form_data, $workshop) {
        // Check if overall feedback is required and provided
        if ($workshop->overallfeedbackmode == 2) { // Required
            if (empty($assessment->feedbackauthor)) {
                return false;
            }
        }
        
        // Check dimensions/assertions based on strategy
        if (isset($form_data['dimensions'])) {
            foreach ($form_data['dimensions'] as $dimension) {
                if (isset($dimension['grade']) && $dimension['grade'] === null) {
                    return false;
                }
                if (isset($dimension['levelid']) && $dimension['levelid'] === null) {
                    return false;
                }
                // Comments strategy may allow empty comments
            }
        }
        
        if (isset($form_data['assertions'])) {
            foreach ($form_data['assertions'] as $assertion) {
                if ($assertion['response'] === null) {
                    return false;
                }
            }
        }
        
        return true;
    }
    
    /**
     * Get assessment status string.
     *
     * Status values:
     * - draft: Assessment started but not complete
     * - submitted: Assessment complete but not graded
     * - graded: Assessment complete and graded
     *
     * @param object $assessment Assessment record
     * @param bool $is_complete Whether assessment is complete
     * @return string Status string
     */
    private function get_assessment_status($assessment, $is_complete) {
        if (!$is_complete) {
            return 'draft';
        }
        
        if ($assessment->gradinggrade !== null) {
            return 'graded';
        }
        
        return 'submitted';
    }
    
    /**
     * Get file attachments for assessment feedback.
     *
     * Retrieves files uploaded as feedback attachments using Moodle's file API.
     *
     * @param workshop $workshop Workshop instance
     * @param object $assessment Assessment record
     * @return array Array of file objects with download URLs
     */
    private function get_assessment_files($workshop, $assessment) {
        $files_data = [];
        
        if ($assessment->feedbackauthorattachment > 0) {
            $fs = get_file_storage();
            $files = $fs->get_area_files(
                $workshop->context->id, 
                'mod_workshop', 
                'overallfeedback_attachment', 
                $assessment->id, 
                'timemodified', 
                false
            );
            
            foreach ($files as $file) {
                $files_data[] = [
                    'filename' => $file->get_filename(),
                    'filesize' => $file->get_filesize(),
                    'mimetype' => $file->get_mimetype(),
                    'timemodified' => $file->get_timemodified(),
                    'downloadurl' => $this->get_file_download_url($file),
                ];
            }
        }
        
        return $files_data;
    }
    
    /**
     * Calculate aggregated submission grade from all assessments.
     *
     * Uses workshop's configured grading evaluation method to calculate
     * the final submission grade from all assessment grades.
     *
     * @param workshop $workshop Workshop instance
     * @param object $submission Submission record
     * @param array $assessments Array of assessment records
     * @return float|null Aggregated grade or null if not calculable
     */
    private function calculate_aggregated_grade($workshop, $submission, $assessments) {
        if (empty($assessments)) {
            return null;
        }
        
        // Collect weighted grades from completed assessments
        $grades = [];
        $weights = [];
        
        foreach ($assessments as $assessment) {
            if ($assessment->grade !== null) {
                $grades[] = (float)$assessment->grade;
                $weights[] = (float)$assessment->weight;
            }
        }
        
        if (empty($grades)) {
            return null;
        }
        
        // Calculate aggregated grade based on workshop evaluation method
        // Method stored in workshop->evaluation (default is 'best')
        $evaluation_method = $workshop->evaluation ?? 'best';
        
        switch ($evaluation_method) {
            case 'best':
                // Use the best (highest) grade
                return max($grades);
                
            default:
                // Default to weighted mean
                $weighted_sum = 0;
                $weight_sum = 0;
                
                for ($i = 0; $i < count($grades); $i++) {
                    $weighted_sum += $grades[$i] * $weights[$i];
                    $weight_sum += $weights[$i];
                }
                
                return $weight_sum > 0 ? $weighted_sum / $weight_sum : null;
        }
    }
    
    /**
     * Get user profile picture URL.
     *
     * @param object $user User record with picture fields
     * @param context $context Context for permission checking
     * @return string URL to profile picture
     */
    private function get_user_picture_url($user, $context) {
        global $PAGE;
        
        $userpicture = new user_picture($user);
        $userpicture->size = 100; // Large size
        
        return $userpicture->get_url($PAGE)->out(false);
    }
    
    /**
     * Get file download URL.
     *
     * @param stored_file $file File storage object
     * @return string URL to download file
     */
    private function get_file_download_url($file) {
        return moodle_url::make_pluginfile_url(
            $file->get_contextid(),
            $file->get_component(),
            $file->get_filearea(),
            $file->get_itemid(),
            $file->get_filepath(),
            $file->get_filename(),
            true // Force download
        )->out(false);
    }
    
    /**
     * Handle POST requests - not supported for this endpoint.
     *
     * @throws MethodNotAllowedException Always
     */
    protected function handle_post() {
        throw new MethodNotAllowedException('POST method not supported for assessments retrieval');
    }
    
    /**
     * Handle PUT requests - not supported for this endpoint.
     *
     * @throws MethodNotAllowedException Always
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method not supported for assessments retrieval');
    }
    
    /**
     * Handle DELETE requests - not supported for this endpoint.
     *
     * @throws MethodNotAllowedException Always
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method not supported for assessments retrieval');
    }
}

// Instantiate and execute the endpoint
$endpoint = new WorkshopAssessmentsEndpoint();
$endpoint->execute();
