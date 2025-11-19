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
 * REST API endpoint for listing assignment submissions.
 *
 * GET /api/v1/assignments/{id}/submissions
 *
 * Returns paginated list of submissions for an assignment including student
 * submissions, group submissions, submission status, grades, and feedback.
 * Calls existing assign class methods from mod/assign/locallib.php following
 * the thin wrapper principle.
 *
 * Authentication: JWT token required
 * Authorization: 
 *   - mod/assign:grade capability: View all submissions
 *   - mod/assign:submit capability: View own submission only
 *
 * Request parameters:
 *   - id (path): Assignment ID (required, integer)
 *   - page (query): Page number, default 1 (optional, integer)
 *   - perpage (query): Items per page, default 20 (optional, integer)
 *   - status (query): Filter by submission status (optional, string)
 *     Valid values: new, draft, reopened, submitted
 *
 * Response format:
 * {
 *   "success": true,
 *   "data": {
 *     "submissions": [
 *       {
 *         "id": 123,
 *         "assignment": 45,
 *         "userid": 67,
 *         "username": "student@example.com",
 *         "firstname": "John",
 *         "lastname": "Doe",
 *         "status": "submitted",
 *         "timecreated": 1234567890,
 *         "timemodified": 1234567890,
 *         "timestarted": 1234567890,
 *         "attemptnumber": 0,
 *         "grade": {
 *           "grade": 85.5,
 *           "grader": 2,
 *           "timegraded": 1234567890
 *         },
 *         "plugins": {
 *           "onlinetext": {
 *             "text": "Submission text content",
 *             "format": 1
 *           },
 *           "file": {
 *             "files": [...]
 *           }
 *         }
 *       }
 *     ]
 *   },
 *   "meta": {
 *     "pagination": {
 *       "page": 1,
 *       "perPage": 20,
 *       "total": 150,
 *       "totalPages": 8
 *     }
 *   }
 * }
 *
 * @package    api
 * @subpackage assignments
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Load Moodle configuration and core libraries
require_once(__DIR__ . '/../../../config.php');
require_once($CFG->libdir . '/moodlelib.php');
require_once($CFG->libdir . '/accesslib.php');
require_once($CFG->dirroot . '/mod/assign/locallib.php');

// Load API base class and exception handling
require_once(__DIR__ . '/../../lib/api_base.php');
require_once(__DIR__ . '/../../lib/api_exception.php');

/**
 * Assignment submissions listing endpoint.
 *
 * Extends ApiBase to inherit JWT authentication, request routing,
 * and response formatting. Implements handle_get() to retrieve
 * submission records by calling existing assign class methods.
 */
class AssignmentSubmissionsEndpoint extends ApiBase {
    
    /**
     * Handle GET request to list assignment submissions.
     *
     * Retrieves paginated list of submissions for an assignment. If user has
     * mod/assign:grade capability, returns all submissions. If user only has
     * mod/assign:submit capability, returns only their own submission.
     *
     * @return void Outputs JSON response directly
     * @throws NotFoundException If assignment not found
     * @throws ForbiddenException If user lacks required capabilities
     * @throws ValidationException If parameters are invalid
     */
    protected function handle_get() {
        global $DB, $USER;
        
        // Extract assignment ID from URL path
        // URL pattern: /api/v1/assignments/{id}/submissions
        $urlparts = explode('/', trim($this->requestUri, '/'));
        $assignmentid = null;
        
        // Find 'assignments' in URL and get the next segment as ID
        foreach ($urlparts as $index => $part) {
            if ($part === 'assignments' && isset($urlparts[$index + 1])) {
                $assignmentid = clean_param($urlparts[$index + 1], PARAM_INT);
                break;
            }
        }
        
        // Validate assignment ID
        if (!$assignmentid || $assignmentid <= 0) {
            throw new ValidationException('Invalid assignment ID', [
                'parameter' => 'id',
                'value' => $assignmentid,
                'reason' => 'Assignment ID must be a positive integer'
            ]);
        }
        
        // Get pagination parameters
        $page = $this->getParam('page', PARAM_INT, false, 1);
        $perpage = $this->getParam('perpage', PARAM_INT, false, 20);
        $statusfilter = $this->getParam('status', PARAM_ALPHANUMEXT, false, null);
        
        // Validate pagination parameters
        if ($page < 1) {
            throw new ValidationException('Invalid page number', [
                'parameter' => 'page',
                'value' => $page,
                'reason' => 'Page number must be at least 1'
            ]);
        }
        
        if ($perpage < 1 || $perpage > 100) {
            throw new ValidationException('Invalid items per page', [
                'parameter' => 'perpage',
                'value' => $perpage,
                'reason' => 'Items per page must be between 1 and 100'
            ]);
        }
        
        // Validate status filter if provided
        $validStatuses = [
            ASSIGN_SUBMISSION_STATUS_NEW,
            ASSIGN_SUBMISSION_STATUS_DRAFT,
            ASSIGN_SUBMISSION_STATUS_REOPENED,
            ASSIGN_SUBMISSION_STATUS_SUBMITTED
        ];
        
        if ($statusfilter !== null && !in_array($statusfilter, $validStatuses)) {
            throw new ValidationException('Invalid submission status filter', [
                'parameter' => 'status',
                'value' => $statusfilter,
                'reason' => 'Status must be one of: ' . implode(', ', $validStatuses)
            ]);
        }
        
        // Load course module and verify it's an assignment
        $cm = get_coursemodule_from_instance('assign', $assignmentid, 0, false, MUST_EXIST);
        if (!$cm) {
            throw new NotFoundException('Assignment not found', [
                'assignmentId' => $assignmentid
            ]);
        }
        
        // Get context for capability checking
        $context = context_module::instance($cm->id);
        
        // Get authenticated user
        $user = $this->getUser();
        
        // Check if user has grading capability (can view all submissions)
        $canGrade = has_capability('mod/assign:grade', $context, $user->id);
        
        // Check if user has submit capability (can view own submission)
        $canSubmit = has_capability('mod/assign:submit', $context, $user->id);
        
        // User must have at least one of these capabilities
        if (!$canGrade && !$canSubmit) {
            throw new ForbiddenException('You do not have permission to view submissions', [
                'requiredCapabilities' => ['mod/assign:grade', 'mod/assign:submit'],
                'context' => 'module',
                'contextId' => $context->id
            ]);
        }
        
        // Instantiate assign class
        $assign = new assign($context, $cm, $cm->get_course());
        
        // Prepare submissions array
        $submissions = [];
        $total = 0;
        
        if ($canGrade) {
            // User can grade - retrieve all submissions
            // Build database query following externallib.php pattern (lines 771-795)
            
            $placeholders = [
                'assignid1' => $assignmentid,
                'assignid2' => $assignmentid
            ];
            
            // Subquery to get maximum attempt number for each user/group
            $submissionmaxattempt = 'SELECT mxs.userid, mxs.groupid, MAX(mxs.attemptnumber) AS maxattempt
                                     FROM {assign_submission} mxs
                                     WHERE mxs.assignment = :assignid1 GROUP BY mxs.userid, mxs.groupid';
            
            // Main query to get submissions with max attempt
            $sql = "SELECT mas.id, mas.assignment, mas.userid, 
                           mas.timecreated, mas.timemodified, mas.timestarted, 
                           mas.status, mas.groupid, mas.attemptnumber
                    FROM {assign_submission} mas
                    JOIN ( " . $submissionmaxattempt . " ) smx ON mas.userid = smx.userid 
                         AND mas.groupid = smx.groupid
                    WHERE mas.assignment = :assignid2 AND mas.attemptnumber = smx.maxattempt";
            
            // Add status filter if provided
            if ($statusfilter !== null) {
                $placeholders['status'] = $statusfilter;
                $sql .= " AND mas.status = :status";
            }
            
            // Add ordering
            $sql .= " ORDER BY mas.timemodified DESC";
            
            // Get total count for pagination
            $countsql = "SELECT COUNT(DISTINCT mas.id)
                         FROM {assign_submission} mas
                         JOIN ( " . $submissionmaxattempt . " ) smx ON mas.userid = smx.userid 
                              AND mas.groupid = smx.groupid
                         WHERE mas.assignment = :assignid2 AND mas.attemptnumber = smx.maxattempt";
            
            if ($statusfilter !== null) {
                $countsql .= " AND mas.status = :status";
            }
            
            $total = $DB->count_records_sql($countsql, $placeholders);
            
            // Calculate offset for pagination
            $offset = ($page - 1) * $perpage;
            
            // Get submissions with pagination
            $submissionrecords = $DB->get_records_sql($sql, $placeholders, $offset, $perpage);
            
            // Get submission plugins
            $submissionplugins = $assign->get_submission_plugins();
            
            // Process each submission record
            foreach ($submissionrecords as $submissionrecord) {
                // Get user information
                $submissionuser = $DB->get_record('user', ['id' => $submissionrecord->userid], 
                    'id, username, firstname, lastname, email');
                
                // Get grade information
                $grade = $assign->get_user_grade($submissionrecord->userid, false);
                
                // Build grade data
                $gradedata = null;
                if ($grade && $grade->grade !== null && $grade->grade >= 0) {
                    $gradedata = [
                        'grade' => (float)$grade->grade,
                        'grader' => (int)$grade->grader,
                        'timegraded' => $grade->timemodified ? (int)$grade->timemodified : null
                    ];
                }
                
                // Build plugins data
                $pluginsdata = [];
                foreach ($submissionplugins as $plugin) {
                    if (!$plugin->is_enabled() || !$plugin->is_visible()) {
                        continue;
                    }
                    
                    $pluginname = $plugin->get_type();
                    $plugindata = [];
                    
                    // Get plugin-specific data
                    // For onlinetext plugin, get text content
                    if ($pluginname === 'onlinetext') {
                        $pluginsubmission = $DB->get_record(
                            'assignsubmission_onlinetext',
                            ['assignment' => $assignmentid, 'submission' => $submissionrecord->id]
                        );
                        if ($pluginsubmission) {
                            $plugindata = [
                                'text' => $pluginsubmission->onlinetext,
                                'format' => (int)$pluginsubmission->onlineformat
                            ];
                        }
                    }
                    
                    // For file plugin, get file information
                    if ($pluginname === 'file') {
                        $fs = get_file_storage();
                        $files = $fs->get_area_files($context->id, 'assignsubmission_file', 
                            'submission_files', $submissionrecord->id, 'timemodified', false);
                        
                        $filedata = [];
                        foreach ($files as $file) {
                            $filedata[] = [
                                'filename' => $file->get_filename(),
                                'filesize' => (int)$file->get_filesize(),
                                'mimetype' => $file->get_mimetype(),
                                'timecreated' => (int)$file->get_timecreated(),
                                'timemodified' => (int)$file->get_timemodified()
                            ];
                        }
                        
                        $plugindata = [
                            'files' => $filedata,
                            'numfiles' => count($filedata)
                        ];
                    }
                    
                    // For comments plugin, get comment count
                    if ($pluginname === 'comments') {
                        $plugindata = [
                            'enabled' => true
                        ];
                    }
                    
                    $pluginsdata[$pluginname] = $plugindata;
                }
                
                // Build submission response object
                $submissions[] = [
                    'id' => (int)$submissionrecord->id,
                    'assignment' => (int)$submissionrecord->assignment,
                    'userid' => (int)$submissionrecord->userid,
                    'username' => $submissionuser ? $submissionuser->username : null,
                    'firstname' => $submissionuser ? $submissionuser->firstname : null,
                    'lastname' => $submissionuser ? $submissionuser->lastname : null,
                    'email' => $submissionuser ? $submissionuser->email : null,
                    'status' => $submissionrecord->status,
                    'timecreated' => (int)$submissionrecord->timecreated,
                    'timemodified' => (int)$submissionrecord->timemodified,
                    'timestarted' => $submissionrecord->timestarted ? (int)$submissionrecord->timestarted : null,
                    'attemptnumber' => (int)$submissionrecord->attemptnumber,
                    'grade' => $gradedata,
                    'plugins' => $pluginsdata
                ];
            }
            
        } else {
            // User can only submit - retrieve own submission only
            $submission = $assign->get_user_submission($user->id, false);
            
            // Check for group submission if individual submission not found
            if (!$submission) {
                $submission = $assign->get_group_submission($user->id, 0, false);
            }
            
            if ($submission) {
                // Get user information
                $submissionuser = $DB->get_record('user', ['id' => $user->id], 
                    'id, username, firstname, lastname, email');
                
                // Get grade information
                $grade = $assign->get_user_grade($user->id, false);
                
                // Build grade data
                $gradedata = null;
                if ($grade && $grade->grade !== null && $grade->grade >= 0) {
                    $gradedata = [
                        'grade' => (float)$grade->grade,
                        'grader' => (int)$grade->grader,
                        'timegraded' => $grade->timemodified ? (int)$grade->timemodified : null
                    ];
                }
                
                // Get submission plugins
                $submissionplugins = $assign->get_submission_plugins();
                
                // Build plugins data
                $pluginsdata = [];
                foreach ($submissionplugins as $plugin) {
                    if (!$plugin->is_enabled() || !$plugin->is_visible()) {
                        continue;
                    }
                    
                    $pluginname = $plugin->get_type();
                    $plugindata = [];
                    
                    // Get plugin-specific data
                    if ($pluginname === 'onlinetext') {
                        $pluginsubmission = $DB->get_record(
                            'assignsubmission_onlinetext',
                            ['assignment' => $assignmentid, 'submission' => $submission->id]
                        );
                        if ($pluginsubmission) {
                            $plugindata = [
                                'text' => $pluginsubmission->onlinetext,
                                'format' => (int)$pluginsubmission->onlineformat
                            ];
                        }
                    }
                    
                    if ($pluginname === 'file') {
                        $fs = get_file_storage();
                        $files = $fs->get_area_files($context->id, 'assignsubmission_file', 
                            'submission_files', $submission->id, 'timemodified', false);
                        
                        $filedata = [];
                        foreach ($files as $file) {
                            $filedata[] = [
                                'filename' => $file->get_filename(),
                                'filesize' => (int)$file->get_filesize(),
                                'mimetype' => $file->get_mimetype(),
                                'timecreated' => (int)$file->get_timecreated(),
                                'timemodified' => (int)$file->get_timemodified()
                            ];
                        }
                        
                        $plugindata = [
                            'files' => $filedata,
                            'numfiles' => count($filedata)
                        ];
                    }
                    
                    if ($pluginname === 'comments') {
                        $plugindata = [
                            'enabled' => true
                        ];
                    }
                    
                    $pluginsdata[$pluginname] = $plugindata;
                }
                
                // Build submission response object
                $submissions[] = [
                    'id' => (int)$submission->id,
                    'assignment' => (int)$submission->assignment,
                    'userid' => (int)$submission->userid,
                    'username' => $submissionuser->username,
                    'firstname' => $submissionuser->firstname,
                    'lastname' => $submissionuser->lastname,
                    'email' => $submissionuser->email,
                    'status' => $submission->status,
                    'timecreated' => (int)$submission->timecreated,
                    'timemodified' => (int)$submission->timemodified,
                    'timestarted' => $submission->timestarted ? (int)$submission->timestarted : null,
                    'attemptnumber' => (int)$submission->attemptnumber,
                    'grade' => $gradedata,
                    'plugins' => $pluginsdata
                ];
                
                $total = 1;
            } else {
                // No submission found - return empty array
                $total = 0;
            }
        }
        
        // Calculate pagination metadata
        $totalPages = $total > 0 ? (int)ceil($total / $perpage) : 0;
        
        // Build response data
        $responseData = [
            'submissions' => $submissions
        ];
        
        // Build pagination metadata
        $paginationMeta = [
            'pagination' => [
                'page' => (int)$page,
                'perPage' => (int)$perpage,
                'total' => (int)$total,
                'totalPages' => $totalPages
            ]
        ];
        
        // Return success response with pagination metadata
        $this->success($responseData, 200, $paginationMeta);
    }
    
    /**
     * POST method not supported for submissions listing.
     *
     * @throws MethodNotAllowedException Always throws exception
     */
    protected function handle_post() {
        throw new MethodNotAllowedException('POST method not supported for submissions listing');
    }
    
    /**
     * PUT method not supported for submissions listing.
     *
     * @throws MethodNotAllowedException Always throws exception
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method not supported for submissions listing');
    }
    
    /**
     * DELETE method not supported for submissions listing.
     *
     * @throws MethodNotAllowedException Always throws exception
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method not supported for submissions listing');
    }
}

// Execute the endpoint if not in test mode
if (!defined('API_TEST_MODE')) {
    $endpoint = new AssignmentSubmissionsEndpoint();
    $endpoint->execute();
}
