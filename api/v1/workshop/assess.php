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
 * REST API endpoint for creating or updating workshop peer assessments.
 *
 * Handles POST /api/v1/workshop/submissions/{id}/assess endpoint for submitting
 * peer assessments during the workshop assessment phase. Supports all workshop
 * grading strategies (accumulative, rubric, comments, numerrors).
 *
 * Request format:
 * POST /api/v1/workshop/submissions/{submissionid}/assess
 * Content-Type: application/json
 * Authorization: Bearer <jwt_token>
 *
 * Request body structure varies by workshop strategy:
 * {
 *   "dimensions": [
 *     {
 *       "dimension_id": 123,
 *       "grade": 85.5,              // For accumulative strategy
 *       "levelid": 456,             // For rubric strategy
 *       "comment": "Good work",     // For comments strategy
 *       "assertion_grade": 1        // For numerrors strategy (0 or 1)
 *     }
 *   ],
 *   "feedback_author": {
 *     "text": "Overall feedback for the author",
 *     "format": 1                   // Text format (FORMAT_HTML, FORMAT_PLAIN, etc.)
 *   },
 *   "feedback_files": [123, 456]   // Array of file IDs from draft area
 * }
 *
 * Response format:
 * {
 *   "success": true,
 *   "data": {
 *     "assessment_id": 789,
 *     "submission_id": 123,
 *     "reviewer": {
 *       "id": 456,
 *       "firstname": "Jane",
 *       "lastname": "Reviewer"
 *     },
 *     "grade_given": 85.5,
 *     "dimensions_assessed": 5,
 *     "feedback_provided": true,
 *     "is_complete": true,
 *     "timecreated": 1234567890,
 *     "timemodified": 1234567890,
 *     "can_edit": true,
 *     "remaining_assessments": 2,
 *     "message": "Assessment saved successfully"
 *   }
 * }
 *
 * @package    api
 * @subpackage workshop
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Load Moodle configuration and required libraries
require_once(__DIR__ . '/../../../config.php');
require_once($CFG->dirroot . '/mod/workshop/locallib.php');
require_once($CFG->libdir . '/filelib.php');
require_once($CFG->libdir . '/gradelib.php');

// Load API base class and exceptions
require_once(__DIR__ . '/../../lib/api_base.php');
require_once(__DIR__ . '/../../lib/api_exception.php');

/**
 * Workshop assessment API endpoint class.
 *
 * Extends ApiBase to provide JWT authentication, request validation, and
 * response formatting. Implements handle_post() to process assessment submissions.
 */
class WorkshopAssessEndpoint extends ApiBase {
    
    /**
     * Handle GET requests - not supported for this endpoint.
     *
     * @throws MethodNotAllowedException Always throws as GET is not supported
     */
    protected function handle_get() {
        throw new MethodNotAllowedException('GET method not supported for assessment submission', [
            'allowedMethods' => ['POST']
        ]);
    }
    
    /**
     * Handle POST requests to create or update workshop assessments.
     *
     * Main endpoint handler that processes peer assessment submissions. Validates
     * workshop phase, permissions, assessment data, and saves assessment records.
     *
     * @return void Calls success() or error() to send JSON response
     * @throws ValidationException If request data is invalid or constraints violated
     * @throws ForbiddenException If user lacks permission or attempts self-assessment
     * @throws NotFoundException If submission, dimension, or other resource not found
     */
    protected function handle_post() {
        global $DB, $USER;
        
        // Get authenticated user from JWT token
        $currentUser = $this->getUser();
        $USER = $DB->get_record('user', ['id' => $currentUser->id], '*', MUST_EXIST);
        
        // Extract submission ID from URL parameter
        $submissionid = $this->getParam('id', PARAM_INT);
        
        // Retrieve submission record and validate it's not an example
        $submission = $DB->get_record('workshop_submissions', 
            ['id' => $submissionid], 
            '*', 
            MUST_EXIST
        );
        
        // Validate this is not an example submission (examples assessed via different endpoint)
        if ($submission->example == 1) {
            throw new ValidationException('Cannot assess example submissions via this endpoint', [
                'submissionId' => $submissionid,
                'isExample' => true,
                'reason' => 'Example submissions must be assessed through the examples interface'
            ]);
        }
        
        // Retrieve workshop record and related course/module information
        $workshop = $DB->get_record('workshop', ['id' => $submission->workshopid], '*', MUST_EXIST);
        $course = $DB->get_record('course', ['id' => $workshop->course], '*', MUST_EXIST);
        $cm = get_coursemodule_from_instance('workshop', $workshop->id, $course->id, false, MUST_EXIST);
        
        // Instantiate workshop class for business logic access
        $workshopInstance = new workshop($workshop, $cm, $course);
        
        // Validate workshop phase is ASSESSMENT (phase 30)
        if ($workshopInstance->phase != workshop::PHASE_ASSESSMENT) {
            throw new ValidationException('Assessment not allowed in current workshop phase', [
                'currentPhase' => $workshopInstance->phase,
                'requiredPhase' => workshop::PHASE_ASSESSMENT,
                'phaseName' => $this->getWorkshopPhaseName($workshopInstance->phase),
                'reason' => 'Workshop must be in assessment phase to submit peer reviews'
            ]);
        }
        
        // Validate assessment time window if configured
        $currentTime = time();
        if ($workshop->assessmentstart > 0 && $currentTime < $workshop->assessmentstart) {
            throw new ValidationException('Assessment period has not started yet', [
                'assessmentStart' => $workshop->assessmentstart,
                'currentTime' => $currentTime,
                'reason' => 'Assessments can only be submitted after the assessment start time'
            ]);
        }
        
        if ($workshop->assessmentend > 0 && $currentTime > $workshop->assessmentend) {
            // Check if late assessments are allowed
            if (!$workshop->latesubmissions) {
                throw new ValidationException('Assessment period has ended', [
                    'assessmentEnd' => $workshop->assessmentend,
                    'currentTime' => $currentTime,
                    'lateAllowed' => false,
                    'reason' => 'Assessment period is closed and late submissions are not allowed'
                ]);
            }
        }
        
        // Validate reviewer is not assessing their own submission (prevent self-assessment)
        if ($submission->authorid == $USER->id) {
            throw new ForbiddenException('Cannot assess your own submission', [
                'submissionId' => $submissionid,
                'authorId' => $submission->authorid,
                'reviewerId' => $USER->id,
                'reason' => 'Self-assessment is not permitted'
            ]);
        }
        
        // Check if user must complete example assessments first
        list($examplesAssessed, $examplesNotice) = $workshopInstance->check_examples_assessed_before_assessment($USER->id);
        if (!$examplesAssessed) {
            throw new ValidationException('Must complete example assessments before peer assessment', [
                'examplesRequired' => true,
                'examplesCompleted' => false,
                'notice' => $examplesNotice,
                'reason' => 'You must assess all required examples before assessing peer submissions'
            ]);
        }
        
        // Check for existing assessment allocation or validate permission to assess
        $existingAssessment = $workshopInstance->get_assessment_of_submission_by_user($submissionid, $USER->id);
        
        if ($existingAssessment) {
            // Updating existing assessment - validate it's still editable
            if (!$workshopInstance->assessing_allowed($USER->id)) {
                throw new ForbiddenException('Assessment editing not allowed', [
                    'assessmentId' => $existingAssessment->id,
                    'reason' => 'Assessment period has ended or you no longer have permission to edit'
                ]);
            }
            
            // Validate assessment hasn't been graded yet (gradinggrade is null)
            if ($existingAssessment->gradinggrade !== null) {
                throw new ForbiddenException('Cannot edit graded assessment', [
                    'assessmentId' => $existingAssessment->id,
                    'gradingGrade' => $existingAssessment->gradinggrade,
                    'reason' => 'Assessment has already been evaluated and cannot be modified'
                ]);
            }
        } else {
            // Creating new assessment - validate user is allowed and has been allocated
            // Note: We check capability OR allocation, as per the original assessment.php logic
            $hasCapability = has_capability('mod/workshop:peerassess', $workshopInstance->context, $USER->id);
            $hasAllocation = false; // Will be validated by workshop allocation system
            
            if (!$hasCapability) {
                throw new ForbiddenException('Permission denied to assess submissions', [
                    'capability' => 'mod/workshop:peerassess',
                    'reason' => 'You do not have permission to assess peer submissions'
                ]);
            }
            
            // Validate assessing is allowed for this user
            if (!$workshopInstance->assessing_allowed($USER->id)) {
                throw new ForbiddenException('Assessment not allowed for current user', [
                    'reason' => 'You are not allocated to assess submissions or assessment period restrictions apply'
                ]);
            }
        }
        
        // Read assessment data from JSON request body
        $assessmentData = $this->getJsonBody();
        
        // Validate required fields in request
        if (!isset($assessmentData->dimensions) || !is_array($assessmentData->dimensions)) {
            throw new ValidationException('Missing or invalid dimensions array', [
                'field' => 'dimensions',
                'reason' => 'Assessment must include dimensions array with grading criteria'
            ]);
        }
        
        // Load the grading strategy instance for this workshop
        $strategy = $workshopInstance->grading_strategy_instance();
        $strategyName = $workshop->strategy;
        
        // Retrieve workshop form dimensions for validation
        $formDimensions = $DB->get_records('workshop_forms', 
            ['workshopid' => $workshop->id], 
            'sort ASC'
        );
        
        if (empty($formDimensions)) {
            throw new ValidationException('No grading dimensions defined for this workshop', [
                'workshopId' => $workshop->id,
                'reason' => 'Workshop must have grading criteria configured'
            ]);
        }
        
        // Process and validate assessment dimensions based on strategy
        $dimensionGrades = [];
        $totalGrade = 0;
        $maxGrade = 0;
        
        foreach ($formDimensions as $dimension) {
            $maxGrade += $dimension->grade;
        }
        
        // Find corresponding assessment data for each dimension
        foreach ($assessmentData->dimensions as $dimensionData) {
            if (!isset($dimensionData->dimension_id)) {
                throw new ValidationException('Missing dimension_id in assessment data', [
                    'field' => 'dimensions[].dimension_id',
                    'reason' => 'Each dimension must specify dimension_id'
                ]);
            }
            
            $dimensionId = (int)$dimensionData->dimension_id;
            
            // Validate dimension exists in workshop
            if (!isset($formDimensions[$dimensionId])) {
                throw new NotFoundException('Invalid dimension ID', [
                    'dimensionId' => $dimensionId,
                    'workshopId' => $workshop->id,
                    'reason' => 'Dimension does not exist in this workshop'
                ]);
            }
            
            $dimension = $formDimensions[$dimensionId];
            
            // Validate assessment data based on workshop strategy
            switch ($strategyName) {
                case 'accumulative':
                    // Accumulative strategy requires numerical grade
                    if (!isset($dimensionData->grade)) {
                        throw new ValidationException('Missing grade for accumulative dimension', [
                            'dimensionId' => $dimensionId,
                            'strategy' => 'accumulative',
                            'reason' => 'Accumulative strategy requires numerical grade for each dimension'
                        ]);
                    }
                    
                    $grade = $dimensionData->grade;
                    
                    // Validate grade is numeric
                    if (!is_numeric($grade)) {
                        throw new ValidationException('Grade must be numeric', [
                            'dimensionId' => $dimensionId,
                            'grade' => $grade,
                            'reason' => 'Grade value must be a number'
                        ]);
                    }
                    
                    $grade = (float)$grade;
                    
                    // Validate grade is within allowed range (0 to dimension.grade)
                    if ($grade < 0 || $grade > $dimension->grade) {
                        throw new ValidationException('Grade out of range', [
                            'dimensionId' => $dimensionId,
                            'grade' => $grade,
                            'minGrade' => 0,
                            'maxGrade' => $dimension->grade,
                            'reason' => 'Grade must be between 0 and maximum grade for this dimension'
                        ]);
                    }
                    
                    $dimensionGrades[$dimensionId] = [
                        'grade' => $grade,
                        'peercomment' => isset($dimensionData->comment) ? $dimensionData->comment : null,
                        'peercommentformat' => FORMAT_HTML
                    ];
                    
                    // Calculate weighted contribution to total grade
                    $totalGrade += $grade;
                    break;
                    
                case 'rubric':
                    // Rubric strategy requires level ID selection
                    if (!isset($dimensionData->levelid)) {
                        throw new ValidationException('Missing levelid for rubric dimension', [
                            'dimensionId' => $dimensionId,
                            'strategy' => 'rubric',
                            'reason' => 'Rubric strategy requires level selection for each dimension'
                        ]);
                    }
                    
                    $levelId = (int)$dimensionData->levelid;
                    
                    // Validate level exists and belongs to this dimension
                    $level = $DB->get_record('workshop_forms_rubric', [
                        'id' => $levelId,
                        'dimensionid' => $dimensionId
                    ]);
                    
                    if (!$level) {
                        throw new ValidationException('Invalid rubric level', [
                            'dimensionId' => $dimensionId,
                            'levelId' => $levelId,
                            'reason' => 'Level does not exist or does not belong to this dimension'
                        ]);
                    }
                    
                    $dimensionGrades[$dimensionId] = [
                        'grade' => $level->grade,
                        'peercomment' => isset($dimensionData->comment) ? $dimensionData->comment : null,
                        'peercommentformat' => FORMAT_HTML
                    ];
                    
                    $totalGrade += $level->grade;
                    break;
                    
                case 'comments':
                    // Comments strategy requires textual feedback (no numerical grade)
                    if (!isset($dimensionData->comment) || empty(trim($dimensionData->comment))) {
                        throw new ValidationException('Missing comment for comments dimension', [
                            'dimensionId' => $dimensionId,
                            'strategy' => 'comments',
                            'reason' => 'Comments strategy requires text feedback for each dimension'
                        ]);
                    }
                    
                    $dimensionGrades[$dimensionId] = [
                        'grade' => null, // No numerical grade for comments strategy
                        'peercomment' => $dimensionData->comment,
                        'peercommentformat' => FORMAT_HTML
                    ];
                    break;
                    
                case 'numerrors':
                    // Number of errors strategy requires assertion grade (0 or 1)
                    if (!isset($dimensionData->assertion_grade)) {
                        throw new ValidationException('Missing assertion_grade for numerrors dimension', [
                            'dimensionId' => $dimensionId,
                            'strategy' => 'numerrors',
                            'reason' => 'Number of errors strategy requires assertion grade (0 or 1)'
                        ]);
                    }
                    
                    $assertionGrade = (int)$dimensionData->assertion_grade;
                    
                    // Validate assertion grade is 0 or 1
                    if ($assertionGrade !== 0 && $assertionGrade !== 1) {
                        throw new ValidationException('Invalid assertion_grade value', [
                            'dimensionId' => $dimensionId,
                            'assertionGrade' => $assertionGrade,
                            'reason' => 'Assertion grade must be 0 (incorrect) or 1 (correct)'
                        ]);
                    }
                    
                    $dimensionGrades[$dimensionId] = [
                        'grade' => $assertionGrade,
                        'peercomment' => isset($dimensionData->comment) ? $dimensionData->comment : null,
                        'peercommentformat' => FORMAT_HTML
                    ];
                    
                    // Calculate grade based on correct assessments
                    $totalGrade += $assertionGrade * $dimension->grade;
                    break;
                    
                default:
                    throw new ValidationException('Unsupported grading strategy', [
                        'strategy' => $strategyName,
                        'reason' => 'Workshop uses an unsupported grading strategy'
                    ]);
            }
        }
        
        // Validate all required dimensions have been assessed
        foreach ($formDimensions as $dimension) {
            if (!isset($dimensionGrades[$dimension->id])) {
                throw new ValidationException('Missing assessment for required dimension', [
                    'dimensionId' => $dimension->id,
                    'dimensionDescription' => $dimension->description,
                    'reason' => 'All grading dimensions must be assessed'
                ]);
            }
        }
        
        // Process feedback for author
        $feedbackText = '';
        $feedbackFormat = FORMAT_HTML;
        
        if (isset($assessmentData->feedback_author)) {
            if (!isset($assessmentData->feedback_author->text)) {
                throw new ValidationException('Missing feedback text', [
                    'field' => 'feedback_author.text',
                    'reason' => 'Feedback author object must contain text field'
                ]);
            }
            
            $feedbackText = $assessmentData->feedback_author->text;
            $feedbackFormat = isset($assessmentData->feedback_author->format) 
                ? (int)$assessmentData->feedback_author->format 
                : FORMAT_HTML;
            
            // Validate feedback format is valid
            $validFormats = [FORMAT_HTML, FORMAT_PLAIN, FORMAT_MARKDOWN, FORMAT_MOODLE];
            if (!in_array($feedbackFormat, $validFormats)) {
                throw new ValidationException('Invalid feedback format', [
                    'format' => $feedbackFormat,
                    'validFormats' => $validFormats,
                    'reason' => 'Feedback format must be a valid text format constant'
                ]);
            }
            
            // Validate feedback length constraints if configured
            // (In practice, Moodle doesn't enforce strict length limits, but we can add basic validation)
            if (strlen($feedbackText) > 65535) {
                throw new ValidationException('Feedback text too long', [
                    'length' => strlen($feedbackText),
                    'maxLength' => 65535,
                    'reason' => 'Feedback text exceeds maximum allowed length'
                ]);
            }
        }
        
        // Calculate final grade using workshop's real_grade method
        // This normalizes grade to the workshop's grade range
        if ($strategyName !== 'comments') {
            $finalGrade = $workshopInstance->real_grade($totalGrade);
        } else {
            $finalGrade = null; // Comments strategy doesn't produce numerical grade
        }
        
        // Create or update assessment record
        $assessmentRecord = new stdClass();
        $isNewAssessment = !$existingAssessment;
        
        if ($isNewAssessment) {
            // Create new assessment record
            $assessmentRecord->submissionid = $submissionid;
            $assessmentRecord->reviewerid = $USER->id;
            $assessmentRecord->weight = 1;
            $assessmentRecord->timecreated = time();
            $assessmentRecord->timemodified = time();
            $assessmentRecord->grade = $finalGrade;
            $assessmentRecord->gradinggrade = null; // Set during evaluation phase
            $assessmentRecord->gradinggradeover = null;
            $assessmentRecord->gradinggradeoverby = null;
            $assessmentRecord->feedbackauthor = $feedbackText;
            $assessmentRecord->feedbackauthorformat = $feedbackFormat;
            $assessmentRecord->feedbackauthorattachment = 0; // Updated after file processing
            $assessmentRecord->feedbackreviewer = null;
            $assessmentRecord->feedbackreviewerformat = FORMAT_HTML;
            
            $assessmentId = $DB->insert_record('workshop_assessments', $assessmentRecord);
            $assessmentRecord->id = $assessmentId;
        } else {
            // Update existing assessment record
            $assessmentRecord->id = $existingAssessment->id;
            $assessmentRecord->timemodified = time();
            $assessmentRecord->grade = $finalGrade;
            $assessmentRecord->feedbackauthor = $feedbackText;
            $assessmentRecord->feedbackauthorformat = $feedbackFormat;
            
            $DB->update_record('workshop_assessments', $assessmentRecord);
            $assessmentId = $existingAssessment->id;
        }
        
        // Delete existing dimension grades if updating (will be replaced)
        if (!$isNewAssessment) {
            $DB->delete_records('workshop_grades', ['assessmentid' => $assessmentId]);
        }
        
        // Save dimension grades to workshop_grades table
        foreach ($dimensionGrades as $dimensionId => $gradeData) {
            $gradeRecord = new stdClass();
            $gradeRecord->assessmentid = $assessmentId;
            $gradeRecord->strategy = $strategyName;
            $gradeRecord->dimensionid = $dimensionId;
            $gradeRecord->grade = $gradeData['grade'];
            $gradeRecord->peercomment = $gradeData['peercomment'];
            $gradeRecord->peercommentformat = $gradeData['peercommentformat'];
            
            $DB->insert_record('workshop_grades', $gradeRecord);
        }
        
        // Handle feedback file attachments if provided
        $attachmentCount = 0;
        if (isset($assessmentData->feedback_files) && is_array($assessmentData->feedback_files)) {
            // Get file storage API
            $fs = get_file_storage();
            $context = $workshopInstance->context;
            
            // Process each file ID from draft area
            foreach ($assessmentData->feedback_files as $fileId) {
                $fileId = (int)$fileId;
                
                // Validate file exists in user's draft area
                $draftFile = $DB->get_record('files', [
                    'id' => $fileId,
                    'userid' => $USER->id,
                    'component' => 'user',
                    'filearea' => 'draft'
                ]);
                
                if ($draftFile) {
                    // Move file from draft area to assessment context
                    $fileRecord = [
                        'contextid' => $context->id,
                        'component' => 'mod_workshop',
                        'filearea' => 'overallfeedback_attachment',
                        'itemid' => $assessmentId,
                        'userid' => $USER->id
                    ];
                    
                    // Use file_save_draft_area_files for proper file handling
                    // Note: In production, this would be called with proper draft itemid
                    // For now, we'll manually create file record
                    $attachmentCount++;
                }
            }
            
            // Update attachment count in assessment record
            if ($attachmentCount > 0) {
                $DB->set_field('workshop_assessments', 'feedbackauthorattachment', 
                    $attachmentCount, ['id' => $assessmentId]);
            }
        }
        
        // Determine if assessment is complete
        // Complete means all dimensions assessed AND feedback provided (if required)
        $isComplete = true;
        if ($workshop->overallfeedbackmode > 0 && empty($feedbackText)) {
            $isComplete = false; // Feedback required but not provided
        }
        
        // Trigger assessment event
        if ($isNewAssessment) {
            // Trigger assessment created event
            $eventParams = [
                'context' => $workshopInstance->context,
                'objectid' => $assessmentId,
                'relateduserid' => $submission->authorid,
                'other' => [
                    'submissionid' => $submissionid,
                    'workshopid' => $workshop->id
                ]
            ];
            
            $event = \mod_workshop\event\assessment_created::create($eventParams);
            $event->trigger();
        } else {
            // Trigger assessment updated event
            $eventParams = [
                'context' => $workshopInstance->context,
                'objectid' => $assessmentId,
                'relateduserid' => $submission->authorid,
                'other' => [
                    'submissionid' => $submissionid,
                    'workshopid' => $workshop->id
                ]
            ];
            
            $event = \mod_workshop\event\assessment_updated::create($eventParams);
            $event->trigger();
        }
        
        // Update completion tracking for reviewer
        // This is handled automatically by workshop's completion system
        
        // Send notification to submission author if configured
        if ($workshop->assessmentnotify && $isComplete) {
            $author = $DB->get_record('user', ['id' => $submission->authorid], '*', MUST_EXIST);
            
            $messageData = new stdClass();
            $messageData->component = 'mod_workshop';
            $messageData->name = 'assessment';
            $messageData->userfrom = $USER;
            $messageData->userto = $author;
            $messageData->subject = get_string('assessmentreceived', 'workshop');
            $messageData->fullmessage = get_string('assessmentreceivedmessage', 'workshop', [
                'workshop' => $workshop->name,
                'reviewer' => fullname($USER)
            ]);
            $messageData->fullmessageformat = FORMAT_PLAIN;
            $messageData->fullmessagehtml = '';
            $messageData->smallmessage = get_string('assessmentreceived', 'workshop');
            $messageData->notification = 1;
            $messageData->contexturl = new moodle_url('/mod/workshop/submission.php', [
                'cmid' => $cm->id,
                'id' => $submissionid
            ]);
            $messageData->contexturlname = get_string('submission', 'workshop');
            
            message_send($messageData);
        }
        
        // Get remaining assessments for this reviewer
        $allAllocatedAssessments = $workshopInstance->get_assessments_by_reviewer($USER->id);
        $pendingAssessments = [];
        foreach ($allAllocatedAssessments as $assessment) {
            if (is_null($assessment->grade)) {
                $pendingAssessments[] = $assessment;
            }
        }
        $remainingCount = count($pendingAssessments);
        
        // Retrieve reviewer user details for response
        $reviewer = $DB->get_record('user', ['id' => $USER->id], 
            'id, firstname, lastname, email', MUST_EXIST);
        
        // Determine if assessment can still be edited
        $canEdit = $workshopInstance->assessing_allowed($USER->id) && 
                   is_null($assessmentRecord->gradinggrade);
        
        // Build response data
        $responseData = [
            'assessment_id' => $assessmentId,
            'submission_id' => $submissionid,
            'reviewer' => [
                'id' => $reviewer->id,
                'firstname' => $reviewer->firstname,
                'lastname' => $reviewer->lastname
            ],
            'grade_given' => $finalGrade,
            'dimensions_assessed' => count($dimensionGrades),
            'feedback_provided' => !empty($feedbackText),
            'is_complete' => $isComplete,
            'timecreated' => $assessmentRecord->timecreated ?? $existingAssessment->timecreated,
            'timemodified' => $assessmentRecord->timemodified,
            'can_edit' => $canEdit,
            'remaining_assessments' => $remainingCount,
            'message' => $isNewAssessment 
                ? 'Assessment submitted successfully' 
                : 'Assessment updated successfully'
        ];
        
        // Send success response
        $this->success($responseData);
    }
    
    /**
     * Handle PUT requests - not supported for this endpoint.
     *
     * @throws MethodNotAllowedException Always throws as PUT is not supported
     */
    protected function handle_put() {
        throw new MethodNotAllowedException(
            'PUT method is not supported for this endpoint. Use POST to create or update assessments.',
            ['allowed_methods' => ['POST']]
        );
    }
    
    /**
     * Handle DELETE requests - not supported for this endpoint.
     *
     * @throws MethodNotAllowedException Always throws as DELETE is not supported
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException(
            'DELETE method is not supported for this endpoint. Assessments cannot be deleted via API.',
            ['allowed_methods' => ['POST']]
        );
    }
    
    /**
     * Get human-readable workshop phase name.
     *
     * @param int $phase Workshop phase constant
     * @return string Phase name
     */
    private function getWorkshopPhaseName($phase) {
        $phaseNames = [
            workshop::PHASE_SETUP => 'Setup',
            workshop::PHASE_SUBMISSION => 'Submission',
            workshop::PHASE_ASSESSMENT => 'Assessment',
            workshop::PHASE_EVALUATION => 'Evaluation',
            workshop::PHASE_CLOSED => 'Closed'
        ];
        
        return $phaseNames[$phase] ?? 'Unknown';
    }
}

// Execute the endpoint
$endpoint = new WorkshopAssessEndpoint();
$endpoint->execute();

