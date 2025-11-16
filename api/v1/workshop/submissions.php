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
 * REST API endpoint for retrieving workshop submissions list.
 *
 * Handles GET /api/v1/workshop/{id}/submissions to fetch submissions for a workshop
 * including author information, submission content, grades, and assessment status.
 * Returns JSON-formatted submissions array with complete submission metadata,
 * file attachments, assessment counts, and grading information.
 *
 * Supports:
 * - Pagination (page, perpage parameters)
 * - Filtering (authorid, groupid, published)
 * - Sorting (sortby, sortorder)
 * - Permission-based visibility (all submissions for teachers, own for students)
 *
 * This is a thin wrapper around existing Moodle workshop functions that:
 * - Validates JWT authentication via ApiBase
 * - Enforces capability checks using require_capability()
 * - Calls workshop class methods for submission retrieval
 * - Formats responses in standardized JSON envelope
 *
 * @package    mod_workshop
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Load Moodle configuration and workshop libraries
require_once(__DIR__ . '/../../../config.php');
require_once($CFG->dirroot . '/mod/workshop/locallib.php');
require_once($CFG->dirroot . '/mod/workshop/lib.php');
require_once($CFG->libdir . '/filelib.php');
require_once($CFG->dirroot . '/user/lib.php');

// Load API base class and exception handlers
require_once(__DIR__ . '/../../lib/api_base.php');
require_once(__DIR__ . '/../../lib/api_exception.php');

/**
 * Workshop submissions list API endpoint.
 *
 * Extends ApiBase to provide REST API access to workshop submissions with
 * pagination, filtering, and sorting capabilities. Wraps existing Moodle
 * workshop functions without duplicating business logic.
 */
class WorkshopSubmissionsEndpoint extends ApiBase {
    
    /**
     * Handle GET request to retrieve workshop submissions list.
     *
     * Retrieves paginated list of submissions for a workshop with optional
     * filtering and sorting. Enforces permission checks to ensure users can
     * only view submissions they have access to.
     *
     * Query Parameters:
     * - page: Page number (0-based, default: 0)
     * - perpage: Items per page (1-100, default: 20)
     * - sortby: Sort field (author, title, grade, timemodified, default: timemodified)
     * - sortorder: Sort direction (ASC, DESC, default: DESC)
     * - authorid: Filter by specific author user ID
     * - groupid: Filter by group ID
     * - published: Filter by published status (0 or 1)
     *
     * @return void Outputs JSON response directly
     * @throws NotFoundException If workshop not found
     * @throws ForbiddenException If user lacks required permissions
     * @throws ValidationException If parameters are invalid
     */
    protected function handle_get() {
        global $DB, $USER;
        
        // Extract and validate workshop ID from URL parameter
        $workshopid = $this->getParam('id', PARAM_INT);
        
        if ($workshopid <= 0) {
            throw new ValidationException('Invalid workshop ID', [
                'parameter' => 'id',
                'value' => $workshopid,
                'reason' => 'Workshop ID must be a positive integer'
            ]);
        }
        
        // Extract and validate pagination parameters
        $page = $this->getParam('page', PARAM_INT, false, 0);
        $perpage = $this->getParam('perpage', PARAM_INT, false, 20);
        
        // Validate page number
        if ($page < 0) {
            throw new ValidationException('Invalid page number', [
                'parameter' => 'page',
                'value' => $page,
                'reason' => 'Page number must be non-negative'
            ]);
        }
        
        // Validate perpage with maximum limit of 100
        if ($perpage < 1 || $perpage > 100) {
            throw new ValidationException('Invalid perpage value', [
                'parameter' => 'perpage',
                'value' => $perpage,
                'reason' => 'Items per page must be between 1 and 100',
                'allowed_range' => '1-100'
            ]);
        }
        
        // Extract and validate sorting parameters
        $sortby = $this->getParam('sortby', PARAM_ALPHA, false, 'timemodified');
        $sortorder = $this->getParam('sortorder', PARAM_ALPHA, false, 'DESC');
        
        // Validate sortby field
        $allowedSortFields = ['author', 'title', 'grade', 'timemodified'];
        if (!in_array($sortby, $allowedSortFields)) {
            throw new ValidationException('Invalid sort field', [
                'parameter' => 'sortby',
                'value' => $sortby,
                'allowed_values' => $allowedSortFields,
                'reason' => 'Sort field must be one of: ' . implode(', ', $allowedSortFields)
            ]);
        }
        
        // Validate sortorder direction
        $sortorder = strtoupper($sortorder);
        if (!in_array($sortorder, ['ASC', 'DESC'])) {
            throw new ValidationException('Invalid sort order', [
                'parameter' => 'sortorder',
                'value' => $sortorder,
                'allowed_values' => ['ASC', 'DESC'],
                'reason' => 'Sort order must be ASC or DESC'
            ]);
        }
        
        // Extract optional filter parameters
        $authorid = $this->getParam('authorid', PARAM_INT, false, null);
        $groupid = $this->getParam('groupid', PARAM_INT, false, null);
        $published = $this->getParam('published', PARAM_INT, false, null);
        
        // Validate authorid if provided
        if ($authorid !== null && $authorid <= 0) {
            throw new ValidationException('Invalid author ID', [
                'parameter' => 'authorid',
                'value' => $authorid,
                'reason' => 'Author ID must be a positive integer'
            ]);
        }
        
        // Validate groupid if provided
        if ($groupid !== null && $groupid < 0) {
            throw new ValidationException('Invalid group ID', [
                'parameter' => 'groupid',
                'value' => $groupid,
                'reason' => 'Group ID must be non-negative'
            ]);
        }
        
        // Validate published filter if provided
        if ($published !== null && !in_array($published, [0, 1])) {
            throw new ValidationException('Invalid published status', [
                'parameter' => 'published',
                'value' => $published,
                'allowed_values' => [0, 1],
                'reason' => 'Published must be 0 or 1'
            ]);
        }
        
        // Retrieve course module and validate workshop exists
        try {
            $cm = get_coursemodule_from_instance('workshop', $workshopid, 0, false, MUST_EXIST);
        } catch (dml_missing_record_exception $e) {
            throw new NotFoundException('Workshop not found', [
                'workshop_id' => $workshopid,
                'reason' => 'No workshop exists with the specified ID'
            ]);
        }
        
        // Retrieve course and workshop records
        $course = $DB->get_record('course', ['id' => $cm->course], '*', MUST_EXIST);
        $workshoprecord = $DB->get_record('workshop', ['id' => $cm->instance], '*', MUST_EXIST);
        
        // Instantiate workshop object with all context
        $workshop = new workshop($workshoprecord, $cm, $course);
        
        // Get authenticated user from JWT token
        $user = $this->getUser();
        
        // Determine view scope based on permissions
        $canViewAll = false;
        try {
            // Check if user has capability to view all submissions
            $this->checkCapability('mod/workshop:viewallsubmissions', $workshop->context);
            $canViewAll = true;
        } catch (ForbiddenException $e) {
            // User can only view their own submissions
            $canViewAll = false;
        }
        
        // If user cannot view all submissions, restrict to their own
        if (!$canViewAll) {
            // Override authorid filter to current user
            $authorid = $user->id;
        }
        
        // Calculate pagination offsets
        $limitfrom = $page * $perpage;
        $limitnum = $perpage;
        
        // Build SQL conditions for filtering
        $conditions = [];
        $params = ['workshopid' => $workshopid];
        
        $conditions[] = 'ws.workshopid = :workshopid';
        
        if ($authorid !== null) {
            $conditions[] = 'ws.authorid = :authorid';
            $params['authorid'] = $authorid;
        }
        
        if ($groupid !== null) {
            // Join with groups_members to filter by group
            $conditions[] = 'EXISTS (SELECT 1 FROM {groups_members} gm WHERE gm.userid = ws.authorid AND gm.groupid = :groupid)';
            $params['groupid'] = $groupid;
        }
        
        if ($published !== null) {
            $conditions[] = 'ws.published = :published';
            $params['published'] = $published;
        }
        
        // Filter out example submissions (example = 0 means regular submission)
        $conditions[] = 'ws.example = 0';
        
        $whereclause = implode(' AND ', $conditions);
        
        // Map sortby parameter to database column
        $sortcolumn = 'ws.timemodified'; // default
        switch ($sortby) {
            case 'author':
                $sortcolumn = 'u.lastname, u.firstname';
                break;
            case 'title':
                $sortcolumn = 'ws.title';
                break;
            case 'grade':
                $sortcolumn = 'ws.grade';
                break;
            case 'timemodified':
                $sortcolumn = 'ws.timemodified';
                break;
        }
        
        // Build SQL query to retrieve submissions with author info
        $sql = "SELECT ws.id, ws.workshopid, ws.example, ws.authorid, ws.timecreated, ws.timemodified,
                       ws.title, ws.content, ws.contentformat, ws.contenttrust, ws.attachment,
                       ws.grade, ws.gradeover, ws.gradeoverby, ws.feedbackauthor,
                       ws.feedbackauthorformat, ws.feedbackauthorattachment, ws.published, ws.late,
                       " . user_picture::fields('u', null, 'authoridx', 'author') . "
                  FROM {workshop_submissions} ws
                  JOIN {user} u ON u.id = ws.authorid
                 WHERE $whereclause
              ORDER BY $sortcolumn $sortorder";
        
        // Retrieve submissions with pagination
        $submissions = $DB->get_records_sql($sql, $params, $limitfrom, $limitnum);
        
        // Count total submissions for pagination metadata
        $countsql = "SELECT COUNT(ws.id)
                       FROM {workshop_submissions} ws
                       JOIN {user} u ON u.id = ws.authorid
                      WHERE $whereclause";
        
        $total = $DB->count_records_sql($countsql, $params);
        
        // Process each submission to build complete submission objects
        $submissionsArray = [];
        
        foreach ($submissions as $submission) {
            // Build author information object
            $authorpicture = new user_picture($submission);
            $authorpicture->size = 1; // Size f1 (64x64)
            
            $author = [
                'id' => $submission->authorid,
                'firstname' => $submission->authorfirstname,
                'lastname' => $submission->authorlastname,
                'fullname' => fullname($submission, true),
                'profileimageurl' => $authorpicture->get_url($PAGE)->out(false),
                'email' => $submission->authoremail ?? null
            ];
            
            // Retrieve file attachments if any
            $files = [];
            if ($submission->attachment > 0) {
                $fs = get_file_storage();
                $storedfiles = $fs->get_area_files(
                    $workshop->context->id,
                    'mod_workshop',
                    'submission_attachment',
                    $submission->id,
                    'itemid, filepath, filename',
                    false // Exclude directories
                );
                
                foreach ($storedfiles as $file) {
                    $fileurl = moodle_url::make_pluginfile_url(
                        $file->get_contextid(),
                        $file->get_component(),
                        $file->get_filearea(),
                        $file->get_itemid(),
                        $file->get_filepath(),
                        $file->get_filename()
                    );
                    
                    $files[] = [
                        'filename' => $file->get_filename(),
                        'filesize' => $file->get_filesize(),
                        'mimetype' => $file->get_mimetype(),
                        'downloadurl' => $fileurl->out(false),
                        'timemodified' => $file->get_timemodified()
                    ];
                }
            }
            
            // Retrieve assessment counts for this submission
            $assessmentcounts = $this->getAssessmentCounts($workshop, $submission->id);
            
            // Determine submission status based on assessments and grading
            $status = $this->determineSubmissionStatus(
                $assessmentcounts,
                $submission->grade,
                $submission->gradeover
            );
            
            // Check if current user can assess this submission
            $canAssess = $this->canUserAssessSubmission(
                $workshop,
                $submission->authorid,
                $user->id
            );
            
            // Check if current user can edit this submission
            $canEdit = $this->canUserEditSubmission(
                $workshop,
                $submission->authorid,
                $user->id,
                $assessmentcounts['total_assessments']
            );
            
            // Format grade values (null if not graded)
            $grade = $submission->grade !== null ? (float)$submission->grade : null;
            $gradeover = $submission->gradeover !== null ? (float)$submission->gradeover : null;
            
            // Build complete submission object
            $submissionsArray[] = [
                'id' => (int)$submission->id,
                'workshopid' => (int)$submission->workshopid,
                'title' => $submission->title,
                'content' => $submission->content,
                'contentformat' => (int)$submission->contentformat,
                'timecreated' => (int)$submission->timecreated,
                'timemodified' => (int)$submission->timemodified,
                'published' => (bool)$submission->published,
                'late' => (bool)$submission->late,
                'grade' => $grade,
                'gradeover' => $gradeover,
                'gradeoverby' => $submission->gradeoverby ? (int)$submission->gradeoverby : null,
                'feedbackauthor' => $submission->feedbackauthor,
                'feedbackauthorformat' => (int)$submission->feedbackauthorformat,
                'author' => $author,
                'files' => $files,
                'assessment_counts' => $assessmentcounts,
                'status' => $status,
                'can_assess' => $canAssess,
                'can_edit' => $canEdit
            ];
        }
        
        // Calculate pagination metadata
        $totalPages = (int)ceil($total / $perpage);
        $hasNext = $page < ($totalPages - 1);
        $hasPrev = $page > 0;
        
        // Build pagination object
        $pagination = [
            'page' => $page,
            'perpage' => $perpage,
            'total' => (int)$total,
            'total_pages' => $totalPages,
            'has_next' => $hasNext,
            'has_prev' => $hasPrev
        ];
        
        // Build filters object showing applied filters
        $filters = [];
        if ($authorid !== null) {
            $filters['authorid'] = (int)$authorid;
        }
        if ($groupid !== null) {
            $filters['groupid'] = (int)$groupid;
        }
        if ($published !== null) {
            $filters['published'] = (bool)$published;
        }
        
        // Build sort object
        $sort = [
            'sortby' => $sortby,
            'sortorder' => $sortorder
        ];
        
        // Get current workshop phase for context
        $workshopPhase = $this->getWorkshopPhaseName($workshop->phase);
        
        // Trigger submissions viewed event for analytics
        $eventparams = [
            'context' => $workshop->context,
            'objectid' => $workshopid,
            'other' => [
                'workshopid' => $workshopid,
                'submissioncount' => count($submissionsArray)
            ]
        ];
        
        $event = \mod_workshop\event\submissions_viewed::create($eventparams);
        $event->trigger();
        
        // Build and return success response with submissions_list
        $responseData = [
            'submissions' => $submissionsArray,
            'pagination' => $pagination,
            'filters' => $filters,
            'sort' => $sort,
            'workshop_phase' => $workshopPhase
        ];
        
        $this->success($responseData);
    }
    
    /**
     * Retrieve assessment counts for a submission.
     *
     * Counts the total number of assessments, completed assessments, and
     * pending assessments for a given submission.
     *
     * @param workshop $workshop Workshop object instance
     * @param int $submissionid Submission ID to count assessments for
     * @return array Assessment counts with keys: total_assessments, completed_assessments, pending_assessments
     */
    private function getAssessmentCounts($workshop, $submissionid) {
        global $DB;
        
        // Query to count assessments by grade status
        $sql = "SELECT COUNT(*) as total,
                       SUM(CASE WHEN grade IS NOT NULL THEN 1 ELSE 0 END) as completed,
                       SUM(CASE WHEN grade IS NULL THEN 1 ELSE 0 END) as pending
                  FROM {workshop_assessments}
                 WHERE submissionid = :submissionid";
        
        $result = $DB->get_record_sql($sql, ['submissionid' => $submissionid]);
        
        return [
            'total_assessments' => (int)$result->total,
            'completed_assessments' => (int)$result->completed,
            'pending_assessments' => (int)$result->pending
        ];
    }
    
    /**
     * Determine submission status based on assessment and grading state.
     *
     * Returns a status string indicating the current state of the submission
     * in the assessment workflow.
     *
     * @param array $assessmentcounts Assessment count data
     * @param float|null $grade Submission grade
     * @param float|null $gradeover Teacher override grade
     * @return string Status: not_assessed, partially_assessed, fully_assessed, or graded
     */
    private function determineSubmissionStatus($assessmentcounts, $grade, $gradeover) {
        // If grade override exists, submission is graded
        if ($gradeover !== null) {
            return 'graded';
        }
        
        // If calculated grade exists, submission is graded
        if ($grade !== null) {
            return 'graded';
        }
        
        // If no assessments at all
        if ($assessmentcounts['total_assessments'] === 0) {
            return 'not_assessed';
        }
        
        // If all assessments are completed
        if ($assessmentcounts['pending_assessments'] === 0) {
            return 'fully_assessed';
        }
        
        // Some assessments complete, some pending
        return 'partially_assessed';
    }
    
    /**
     * Check if current user can assess a submission.
     *
     * User can assess a submission if they have the peerassess capability,
     * the submission is not their own, and the workshop is in assessment phase.
     *
     * @param workshop $workshop Workshop object instance
     * @param int $authorid Submission author's user ID
     * @param int $userid Current user's ID
     * @return bool True if user can assess this submission
     */
    private function canUserAssessSubmission($workshop, $authorid, $userid) {
        // Cannot assess own submission
        if ($authorid === $userid) {
            return false;
        }
        
        // Check if user has peer assess capability
        if (!has_capability('mod/workshop:peerassess', $workshop->context)) {
            return false;
        }
        
        // Check if workshop is in assessment phase
        if ($workshop->phase != workshop::PHASE_ASSESSMENT && 
            $workshop->phase != workshop::PHASE_EVALUATION &&
            $workshop->phase != workshop::PHASE_CLOSED) {
            return false;
        }
        
        return true;
    }
    
    /**
     * Check if current user can edit a submission.
     *
     * User can edit a submission if they are the author, the workshop is in
     * submission phase, and the submission has not yet been assessed.
     *
     * @param workshop $workshop Workshop object instance
     * @param int $authorid Submission author's user ID
     * @param int $userid Current user's ID
     * @param int $assessmentcount Number of assessments on this submission
     * @return bool True if user can edit this submission
     */
    private function canUserEditSubmission($workshop, $authorid, $userid, $assessmentcount) {
        // Must be the author
        if ($authorid !== $userid) {
            return false;
        }
        
        // Workshop must be in submission phase
        if ($workshop->phase != workshop::PHASE_SUBMISSION) {
            return false;
        }
        
        // Cannot edit if already assessed
        if ($assessmentcount > 0) {
            return false;
        }
        
        return true;
    }
    
    /**
     * Get human-readable workshop phase name.
     *
     * Converts workshop phase constant to a readable string name.
     *
     * @param int $phase Workshop phase constant
     * @return string Phase name
     */
    private function getWorkshopPhaseName($phase) {
        switch ($phase) {
            case workshop::PHASE_SETUP:
                return 'setup';
            case workshop::PHASE_SUBMISSION:
                return 'submission';
            case workshop::PHASE_ASSESSMENT:
                return 'assessment';
            case workshop::PHASE_EVALUATION:
                return 'evaluation';
            case workshop::PHASE_CLOSED:
                return 'closed';
            default:
                return 'unknown';
        }
    }
}

// Instantiate and execute the endpoint
$endpoint = new WorkshopSubmissionsEndpoint();
$endpoint->execute();

