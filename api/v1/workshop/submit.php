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
 * REST API endpoint for workshop submission creation and updates.
 *
 * Handles POST /api/v1/workshop/{id}/submit for creating new submissions or
 * updating existing draft submissions during the workshop submission phase.
 * Accepts both application/json and multipart/form-data content types to support
 * text content and file attachment uploads.
 *
 * Authentication: Requires valid JWT token with mod/workshop:submit capability.
 *
 * Request formats:
 * 1. JSON: Content-Type: application/json
 *    Body: {"title": "...", "content": "...", "contentformat": 1}
 *
 * 2. Form data: Content-Type: multipart/form-data
 *    Fields: title, content, contentformat
 *    Files: attachments[]
 *
 * Response format:
 * {
 *   "success": true,
 *   "data": {
 *     "submission_id": 123,
 *     "submission_number": 1,
 *     "title": "My Submission",
 *     "content": "...",
 *     "author": {...},
 *     "timecreated": 1234567890,
 *     "timemodified": 1234567890,
 *     "is_late": false,
 *     "attachment_count": 2,
 *     "file_list": [...],
 *     "status": "submitted",
 *     "can_edit": true,
 *     "assessment_required": true,
 *     "message": "Submission created successfully"
 *   }
 * }
 *
 * @package    mod_workshop
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Load Moodle configuration and workshop libraries
require_once(__DIR__ . '/../../../config.php');

// Load API base classes
require_once(__DIR__ . '/../../lib/api_base.php');
require_once(__DIR__ . '/../../lib/api_exception.php');

/**
 * Workshop submission endpoint class.
 *
 * Extends ApiBase to handle POST requests for workshop submission creation
 * and updates. Validates workshop phase, time windows, example assessments,
 * and submission data before persisting to database.
 */
class WorkshopSubmitEndpoint extends ApiBase {
    
    /**
     * Handle POST request to create or update workshop submission.
     *
     * This method is automatically called by ApiBase::execute() when an HTTP POST
     * request is received. It orchestrates the entire submission process including
     * validation, data extraction, file handling, database operations, event
     * triggering, and notifications.
     *
     * @return void Outputs JSON response via success() method
     * @throws NotFoundException If workshop does not exist
     * @throws ForbiddenException If user lacks permission or phase restriction
     * @throws ValidationException If submission data is invalid
     */
    protected function handle_post() {
        global $DB, $USER, $CFG;
        
        // Load workshop libraries
        require_once($CFG->dirroot . '/mod/workshop/lib.php');
        require_once($CFG->dirroot . '/mod/workshop/locallib.php');
        require_once($CFG->libdir . '/completionlib.php');
        require_once($CFG->libdir . '/filelib.php');
        
        // Step 1: Extract and validate workshop ID from URL parameter
        $workshopid = $this->getParam('id', PARAM_INT);
        if (!$workshopid) {
            throw new ValidationException('Workshop ID is required');
        }
        
        // Step 2: Retrieve course module and validate existence
        $cm = get_coursemodule_from_instance('workshop', $workshopid, 0, false, MUST_EXIST);
        if (!$cm) {
            throw new NotFoundException('Workshop not found');
        }
        
        // Step 3: Load course record
        $course = $DB->get_record('course', ['id' => $cm->course], '*', MUST_EXIST);
        
        // Step 4: Load workshop record and instantiate workshop class
        $workshoprecord = $DB->get_record('workshop', ['id' => $workshopid], '*', MUST_EXIST);
        $workshop = new workshop($workshoprecord, $cm, $course);
        
        // Step 5: Check user capability to submit
        $this->checkCapability('mod/workshop:submit', $workshop->context);
        
        // Step 6: Validate workshop is in submission phase
        if ($workshop->phase != workshop::PHASE_SUBMISSION) {
            throw new ValidationException(
                'Submissions are not currently accepted',
                ['phase' => $workshop->phase, 'required_phase' => workshop::PHASE_SUBMISSION]
            );
        }
        
        // Step 7: Check submission time window
        $now = time();
        $submissionstart = $workshop->submissionstart;
        $submissionend = $workshop->submissionend;
        
        // Check if before submission start time
        if ($submissionstart > 0 && $now < $submissionstart) {
            throw new ValidationException(
                'Submissions are not yet open',
                [
                    'opens_at' => $submissionstart,
                    'current_time' => $now
                ]
            );
        }
        
        // Check if after submission end time and late submissions not allowed
        if ($submissionend > 0 && $now > $submissionend && !$workshop->latesubmissions) {
            throw new ValidationException(
                'Submission deadline has passed',
                [
                    'deadline' => $submissionend,
                    'current_time' => $now,
                    'late_submissions_allowed' => false
                ]
            );
        }
        
        // Step 8: Check if user must assess examples before submission
        if ($workshop->useexamples) {
            // Get user's example assessments
            $sql = "SELECT COUNT(DISTINCT ea.submissionid)
                      FROM {workshop_assessments} ea
                      JOIN {workshop_submissions} es ON es.id = ea.submissionid
                     WHERE es.workshopid = :workshopid
                       AND es.example = 1
                       AND ea.reviewerid = :userid
                       AND ea.grade IS NOT NULL";
            
            $completedexamples = $DB->count_records_sql($sql, [
                'workshopid' => $workshopid,
                'userid' => $USER->id
            ]);
            
            // Get total required examples
            $requiredexamples = $DB->count_records('workshop_submissions', [
                'workshopid' => $workshopid,
                'example' => 1
            ]);
            
            if ($requiredexamples > 0 && $completedexamples < $requiredexamples) {
                throw new ValidationException(
                    'You must assess all example submissions before submitting your own work',
                    [
                        'examples_required' => $requiredexamples,
                        'examples_completed' => $completedexamples,
                        'examples_remaining' => $requiredexamples - $completedexamples
                    ]
                );
            }
        }
        
        // Step 9: Read submission data from request
        $submissiondata = $this->extractSubmissionData();
        
        // Step 10: Validate submission data
        $this->validateSubmissionData($submissiondata, $workshop);
        
        // Step 11: Check for existing submission
        $existingsubmission = $DB->get_record('workshop_submissions', [
            'workshopid' => $workshopid,
            'authorid' => $USER->id,
            'example' => 0
        ]);
        
        // Step 12: Process submission (create or update)
        if ($existingsubmission) {
            $submissionid = $this->updateSubmission($existingsubmission, $submissiondata, $workshop);
            $isnew = false;
        } else {
            $submissionid = $this->createSubmission($submissiondata, $workshop, $now, $submissionend);
            $isnew = true;
        }
        
        // Step 13: Handle file attachments if present
        $fileinfo = $this->handleFileAttachments($submissionid, $workshop);
        
        // Step 14: Trigger submission event
        $this->triggerSubmissionEvent($submissionid, $workshop, $isnew);
        
        // Step 15: Update course completion if applicable
        $this->updateCourseCompletion($cm, $course);
        
        // Step 16: Send notification to teachers if configured
        $this->sendTeacherNotification($workshop, $submissionid);
        
        // Step 17: Prepare and return response
        $response = $this->buildSubmissionResponse($submissionid, $workshop, $fileinfo, $isnew);
        $this->success($response);
    }
    
    /**
     * Extract submission data from request body.
     *
     * Supports both application/json and multipart/form-data content types.
     * For JSON requests, reads from php://input and decodes JSON.
     * For form data, reads from $_POST array.
     *
     * @return array Associative array with keys: title, content, contentformat
     * @throws ValidationException If content type is unsupported or data invalid
     */
    private function extractSubmissionData() {
        $contenttype = $_SERVER['CONTENT_TYPE'] ?? '';
        
        if (strpos($contenttype, 'application/json') !== false) {
            // JSON request body
            $data = $this->getJsonBody();
            
            return [
                'title' => $data['title'] ?? '',
                'content' => $data['content'] ?? '',
                'contentformat' => isset($data['contentformat']) ? (int)$data['contentformat'] : FORMAT_HTML
            ];
        } else {
            // Form data (multipart/form-data or application/x-www-form-urlencoded)
            return [
                'title' => $_POST['title'] ?? '',
                'content' => $_POST['content'] ?? '',
                'contentformat' => isset($_POST['contentformat']) ? (int)$_POST['contentformat'] : FORMAT_HTML
            ];
        }
    }
    
    /**
     * Validate submission data against workshop requirements.
     *
     * Checks title length, content requirements based on workshop settings,
     * and content format validity.
     *
     * @param array $data Submission data with title, content, contentformat
     * @param workshop $workshop Workshop instance
     * @return void
     * @throws ValidationException If any validation fails
     */
    private function validateSubmissionData($data, $workshop) {
        // Validate title
        if (empty(trim($data['title']))) {
            throw new ValidationException('Title is required', ['field' => 'title']);
        }
        
        if (strlen($data['title']) > 255) {
            throw new ValidationException(
                'Title must not exceed 255 characters',
                ['field' => 'title', 'max_length' => 255, 'actual_length' => strlen($data['title'])]
            );
        }
        
        // Validate content if text submission is required
        if ($workshop->submissiontypetext == WORKSHOP_SUBMISSION_TYPE_REQUIRED) {
            if (empty(trim($data['content']))) {
                throw new ValidationException(
                    'Submission content is required for this workshop',
                    ['field' => 'content']
                );
            }
        }
        
        // Validate content format
        $validformats = [FORMAT_HTML, FORMAT_PLAIN, FORMAT_MARKDOWN, FORMAT_MOODLE];
        if (!in_array($data['contentformat'], $validformats, true)) {
            throw new ValidationException(
                'Invalid content format',
                [
                    'field' => 'contentformat',
                    'valid_formats' => $validformats,
                    'provided' => $data['contentformat']
                ]
            );
        }
    }
    
    /**
     * Create new submission record in database.
     *
     * Creates a new workshop_submissions record with author, timestamps,
     * and submission content. Sets late flag based on submission deadline.
     *
     * @param array $data Submission data
     * @param workshop $workshop Workshop instance
     * @param int $now Current timestamp
     * @param int $submissionend Submission deadline timestamp
     * @return int New submission ID
     */
    private function createSubmission($data, $workshop, $now, $submissionend) {
        global $DB, $USER;
        
        $submission = new stdClass();
        $submission->workshopid = $workshop->id;
        $submission->example = 0;
        $submission->authorid = $USER->id;
        $submission->timecreated = $now;
        $submission->timemodified = $now;
        $submission->title = $data['title'];
        $submission->content = $data['content'];
        $submission->contentformat = $data['contentformat'];
        $submission->contenttrust = 1;
        $submission->attachment = 0; // Updated after file processing
        $submission->grade = null;
        $submission->gradeover = null;
        $submission->gradeoverby = null;
        $submission->published = 0;
        $submission->late = ($submissionend > 0 && $now > $submissionend) ? 1 : 0;
        
        return $DB->insert_record('workshop_submissions', $submission);
    }
    
    /**
     * Update existing submission record.
     *
     * Updates an existing submission if it hasn't been assessed yet.
     * Only allows updates during submission phase before assessments begin.
     *
     * @param stdClass $existing Existing submission record
     * @param array $data New submission data
     * @param workshop $workshop Workshop instance
     * @return int Submission ID
     * @throws ValidationException If submission already assessed
     */
    private function updateSubmission($existing, $data, $workshop) {
        global $DB;
        
        // Check if submission has been assessed
        $assessmentcount = $DB->count_records('workshop_assessments', [
            'submissionid' => $existing->id
        ]);
        
        if ($assessmentcount > 0) {
            throw new ValidationException(
                'Cannot update submission that has already been assessed',
                ['submission_id' => $existing->id, 'assessment_count' => $assessmentcount]
            );
        }
        
        // Update submission
        $existing->title = $data['title'];
        $existing->content = $data['content'];
        $existing->contentformat = $data['contentformat'];
        $existing->timemodified = time();
        
        $DB->update_record('workshop_submissions', $existing);
        
        return $existing->id;
    }
    
    /**
     * Handle file attachment uploads for submission.
     *
     * Processes uploaded files if file submissions are enabled for the workshop.
     * Validates file count, size, and types against workshop settings.
     * Stores files in Moodle file storage system.
     *
     * @param int $submissionid Submission ID
     * @param workshop $workshop Workshop instance
     * @return array File information with count and file list
     * @throws ValidationException If file validation fails
     */
    private function handleFileAttachments($submissionid, $workshop) {
        global $DB, $USER;
        
        $fileinfo = [
            'count' => 0,
            'files' => []
        ];
        
        // Only process files if file submission is enabled
        if ($workshop->submissiontypefile == WORKSHOP_SUBMISSION_TYPE_DISABLED) {
            return $fileinfo;
        }
        
        // Check if files were uploaded
        if (empty($_FILES) || empty($_FILES['attachments'])) {
            // Check if file submission is required
            if ($workshop->submissiontypefile == WORKSHOP_SUBMISSION_TYPE_REQUIRED) {
                throw new ValidationException(
                    'File attachment is required for this workshop',
                    ['field' => 'attachments']
                );
            }
            return $fileinfo;
        }
        
        // Get submission record to access context
        $submission = $DB->get_record('workshop_submissions', ['id' => $submissionid], '*', MUST_EXIST);
        
        // Prepare file storage context
        $context = $workshop->context;
        $fs = get_file_storage();
        
        // Process uploaded files
        $files = $_FILES['attachments'];
        $filecount = is_array($files['name']) ? count($files['name']) : 1;
        
        // Validate file count
        if ($workshop->nattachments > 0 && $filecount > $workshop->nattachments) {
            throw new ValidationException(
                'Too many files uploaded',
                [
                    'max_files' => $workshop->nattachments,
                    'uploaded' => $filecount
                ]
            );
        }
        
        // Process each file
        $totalsize = 0;
        $uploadedfiles = [];
        
        for ($i = 0; $i < $filecount; $i++) {
            $filename = is_array($files['name']) ? $files['name'][$i] : $files['name'];
            $tmppath = is_array($files['tmp_name']) ? $files['tmp_name'][$i] : $files['tmp_name'];
            $filesize = is_array($files['size']) ? $files['size'][$i] : $files['size'];
            $fileerror = is_array($files['error']) ? $files['error'][$i] : $files['error'];
            
            // Check for upload errors
            if ($fileerror !== UPLOAD_ERR_OK) {
                throw new ValidationException(
                    'File upload failed',
                    ['file' => $filename, 'error_code' => $fileerror]
                );
            }
            
            // Validate file size
            $totalsize += $filesize;
            if ($workshop->maxbytes > 0 && $totalsize > $workshop->maxbytes) {
                throw new ValidationException(
                    'Total file size exceeds maximum allowed',
                    [
                        'max_bytes' => $workshop->maxbytes,
                        'total_bytes' => $totalsize
                    ]
                );
            }
            
            // Validate file type if restrictions exist
            if (!empty($workshop->submissionfiletypes)) {
                $allowedtypes = explode(',', $workshop->submissionfiletypes);
                $extension = pathinfo($filename, PATHINFO_EXTENSION);
                
                $allowed = false;
                foreach ($allowedtypes as $type) {
                    $type = trim($type, '. ');
                    if (strcasecmp($extension, $type) === 0) {
                        $allowed = true;
                        break;
                    }
                }
                
                if (!$allowed) {
                    throw new ValidationException(
                        'File type not allowed',
                        [
                            'file' => $filename,
                            'allowed_types' => $allowedtypes,
                            'uploaded_type' => $extension
                        ]
                    );
                }
            }
            
            // Store file in Moodle file storage
            $filerecord = [
                'contextid' => $context->id,
                'component' => 'mod_workshop',
                'filearea' => 'submission_attachment',
                'itemid' => $submissionid,
                'filepath' => '/',
                'filename' => $filename,
                'userid' => $USER->id
            ];
            
            $storedfile = $fs->create_file_from_pathname($filerecord, $tmppath);
            
            if ($storedfile) {
                $uploadedfiles[] = [
                    'filename' => $filename,
                    'filesize' => $filesize,
                    'mimetype' => $storedfile->get_mimetype(),
                    'downloadurl' => moodle_url::make_pluginfile_url(
                        $context->id,
                        'mod_workshop',
                        'submission_attachment',
                        $submissionid,
                        '/',
                        $filename
                    )->out()
                ];
            }
        }
        
        // Update submission record with attachment count
        if (!empty($uploadedfiles)) {
            $DB->set_field('workshop_submissions', 'attachment', count($uploadedfiles), ['id' => $submissionid]);
        }
        
        $fileinfo['count'] = count($uploadedfiles);
        $fileinfo['files'] = $uploadedfiles;
        
        return $fileinfo;
    }
    
    /**
     * Trigger submission created or updated event.
     *
     * Logs the submission event in Moodle's event system for tracking
     * and triggering subscribed observers.
     *
     * @param int $submissionid Submission ID
     * @param workshop $workshop Workshop instance
     * @param bool $isnew True if new submission, false if update
     * @return void
     */
    private function triggerSubmissionEvent($submissionid, $workshop, $isnew) {
        global $DB, $USER;
        
        $submission = $DB->get_record('workshop_submissions', ['id' => $submissionid], '*', MUST_EXIST);
        
        $eventclass = $isnew ? 
            '\mod_workshop\event\submission_created' : 
            '\mod_workshop\event\submission_updated';
        
        $event = $eventclass::create([
            'objectid' => $submissionid,
            'context' => $workshop->context,
            'courseid' => $workshop->course->id,
            'relateduserid' => $USER->id,
            'other' => [
                'submissiontitle' => $submission->title
            ]
        ]);
        
        $event->add_record_snapshot('workshop', $workshop->dbrecord);
        $event->add_record_snapshot('workshop_submissions', $submission);
        $event->trigger();
    }
    
    /**
     * Update course completion status if applicable.
     *
     * Checks if workshop completion is tracked and updates the user's
     * completion status for the activity based on submission.
     *
     * @param stdClass $cm Course module record
     * @param stdClass $course Course record
     * @return void
     */
    private function updateCourseCompletion($cm, $course) {
        global $USER;
        
        $completion = new completion_info($course);
        
        if ($completion->is_enabled($cm)) {
            $completion->update_state($cm, COMPLETION_COMPLETE, $USER->id);
        }
    }
    
    /**
     * Send notification to teachers if configured.
     *
     * Sends a message to all users with mod/workshop:viewallsubmissions
     * capability if the workshop has submission notifications enabled.
     *
     * @param workshop $workshop Workshop instance
     * @param int $submissionid Submission ID
     * @return void
     */
    private function sendTeacherNotification($workshop, $submissionid) {
        global $DB, $USER;
        
        // Check if notifications are enabled
        if (empty($workshop->submissionnotify)) {
            return;
        }
        
        // Get submission details
        $submission = $DB->get_record('workshop_submissions', ['id' => $submissionid], '*', MUST_EXIST);
        
        // Get all users who should be notified (teachers/managers)
        $recipients = get_users_by_capability(
            $workshop->context,
            'mod/workshop:viewallsubmissions',
            'u.id, u.firstname, u.lastname, u.email',
            'u.lastname, u.firstname'
        );
        
        if (empty($recipients)) {
            return;
        }
        
        // Prepare message
        $submissionurl = new moodle_url('/mod/workshop/submission.php', [
            'cmid' => $workshop->cm->id,
            'id' => $submissionid
        ]);
        
        $messagedata = new stdClass();
        $messagedata->component = 'mod_workshop';
        $messagedata->name = 'submission';
        $messagedata->userfrom = $USER;
        $messagedata->subject = get_string('messagesubmitted', 'workshop', $workshop->name);
        $messagedata->fullmessage = get_string('submissionavailable', 'workshop', [
            'workshopname' => $workshop->name,
            'submissiontitle' => $submission->title,
            'author' => fullname($USER),
            'url' => $submissionurl->out()
        ]);
        $messagedata->fullmessageformat = FORMAT_PLAIN;
        $messagedata->fullmessagehtml = '';
        $messagedata->smallmessage = get_string('messagesubmitted', 'workshop', $workshop->name);
        $messagedata->notification = 1;
        $messagedata->contexturl = $submissionurl->out();
        $messagedata->contexturlname = $submission->title;
        
        // Send to each recipient
        foreach ($recipients as $recipient) {
            // Don't send to the author
            if ($recipient->id == $USER->id) {
                continue;
            }
            
            $messagedata->userto = $recipient;
            message_send($messagedata);
        }
    }
    
    /**
     * Build submission response object.
     *
     * Constructs a comprehensive response object with submission details,
     * author information, file attachments, and status flags for the
     * React frontend.
     *
     * @param int $submissionid Submission ID
     * @param workshop $workshop Workshop instance
     * @param array $fileinfo File attachment information
     * @param bool $isnew True if new submission
     * @return array Response data array
     */
    private function buildSubmissionResponse($submissionid, $workshop, $fileinfo, $isnew) {
        global $DB, $USER;
        
        // Get submission record
        $submission = $DB->get_record('workshop_submissions', ['id' => $submissionid], '*', MUST_EXIST);
        
        // Get author details
        $author = $DB->get_record('user', ['id' => $submission->authorid], 
            'id, firstname, lastname, email, picture, imagealt, firstnamephonetic, lastnamephonetic, middlename, alternatename');
        
        $authorinfo = [
            'id' => $author->id,
            'fullname' => fullname($author),
            'email' => $author->email,
            'profileimageurl' => (new moodle_url('/user/pix.php', [
                'file' => '/' . $author->id . '/f1.jpg'
            ]))->out()
        ];
        
        // Count total submissions by this author in this workshop
        $submissioncount = $DB->count_records('workshop_submissions', [
            'workshopid' => $workshop->id,
            'authorid' => $USER->id,
            'example' => 0
        ]);
        
        // Determine if user can still edit
        $canedit = ($workshop->phase == workshop::PHASE_SUBMISSION) && 
                   ($DB->count_records('workshop_assessments', ['submissionid' => $submissionid]) == 0);
        
        // Check if peer assessment is required
        $assessmentrequired = ($workshop->usepeerassessment == 1);
        
        // Determine submission status
        $status = 'submitted';
        if ($submission->grade === null && $canedit) {
            $status = 'draft';
        }
        
        // Prepare response
        return [
            'submission_id' => (int)$submission->id,
            'submission_number' => $submissioncount,
            'title' => $submission->title,
            'content' => $submission->content,
            'contentformat' => (int)$submission->contentformat,
            'author' => $authorinfo,
            'timecreated' => (int)$submission->timecreated,
            'timemodified' => (int)$submission->timemodified,
            'is_late' => (bool)$submission->late,
            'attachment_count' => (int)$submission->attachment,
            'file_list' => $fileinfo['files'],
            'status' => $status,
            'can_edit' => $canedit,
            'assessment_required' => $assessmentrequired,
            'message' => $isnew ? 
                'Submission created successfully' : 
                'Submission updated successfully'
        ];
    }
    
    /**
     * Handle GET requests - not supported for submission endpoint.
     *
     * @throws MethodNotAllowedException
     */
    protected function handle_get() {
        throw new MethodNotAllowedException(
            'GET method not supported for workshop submission. Use POST to submit work.'
        );
    }
    
    /**
     * Handle PUT requests - not supported for submission endpoint.
     *
     * @throws MethodNotAllowedException
     */
    protected function handle_put() {
        throw new MethodNotAllowedException(
            'PUT method not supported for workshop submission. Use POST to submit work.'
        );
    }
    
    /**
     * Handle DELETE requests - not supported for submission endpoint.
     *
     * @throws MethodNotAllowedException
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException(
            'DELETE method not supported for workshop submission.'
        );
    }
}

// Execute the endpoint if not in test mode
if (!defined('API_TEST_MODE')) {
    $endpoint = new WorkshopSubmitEndpoint();
    $endpoint->execute();
}
