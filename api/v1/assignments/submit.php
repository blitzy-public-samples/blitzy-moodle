<?php
/**
 * Assignment Submission API Endpoint
 *
 * REST API endpoint for submitting assignment work including file uploads, online text submissions,
 * and submission statements. Processes student submissions by calling existing assign class methods.
 *
 * Endpoint: POST /api/v1/assignments/{id}/submit
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle React Refactoring
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Load Moodle configuration and libraries
require_once(__DIR__ . '/../../../config.php');
require_once($CFG->dirroot . '/lib/filelib.php');
require_once($CFG->dirroot . '/mod/assign/locallib.php');

// Load API utilities
require_once(__DIR__ . '/../../lib/api_base.php');
require_once(__DIR__ . '/../../lib/api_exception.php');

/**
 * Assignment Submission Endpoint
 *
 * Handles POST requests to submit assignment work with plugin data (files, online text).
 * Wraps existing Moodle assign class methods: save_submission() and submit_for_grading().
 *
 * Request Body (JSON):
 * {
 *   "submissionstatement": 1,  // Required if assignment requires submission statement
 *   "plugindata": {
 *     "files_filemanager": 123456,  // Draft itemid for file uploads (optional)
 *     "onlinetext_editor": {        // Online text content (optional)
 *       "text": "<p>Submission text</p>",
 *       "format": 1,                 // FORMAT_HTML = 1
 *       "itemid": 0
 *     }
 *   }
 * }
 *
 * Response (201 Created):
 * {
 *   "success": true,
 *   "data": {
 *     "submission": {
 *       "id": 123,
 *       "status": "submitted",
 *       "timecreated": 1234567890,
 *       "timemodified": 1234567890,
 *       "attemptnumber": 0
 *     }
 *   }
 * }
 */
class AssignmentSubmitEndpoint extends ApiBase {

    /**
     * Handle POST request to submit assignment
     *
     * @return void
     * @throws NotFoundException If assignment not found
     * @throws ForbiddenException If user lacks submit capability
     * @throws ValidationException If submission is closed or invalid
     */
    protected function handle_post() {
        global $DB, $USER;

        // Step 1: Extract and validate assignment ID from URL path
        // URL format: /api/v1/assignments/{id}/submit
        $pathparts = explode('/', trim($_SERVER['PATH_INFO'] ?? $_SERVER['REQUEST_URI'], '/'));
        $assignmentid = null;
        
        // Find 'assignments' in path and get next element as ID
        foreach ($pathparts as $index => $part) {
            if ($part === 'assignments' && isset($pathparts[$index + 1])) {
                $assignmentid = clean_param($pathparts[$index + 1], PARAM_INT);
                break;
            }
        }

        if (empty($assignmentid)) {
            throw new ValidationException('Missing or invalid assignment ID in URL');
        }

        // Step 2: Load course module and verify module type
        $cm = get_coursemodule_from_instance('assign', $assignmentid, 0, false, MUST_EXIST);
        if (!$cm) {
            throw new NotFoundException('Assignment not found');
        }

        // Step 3: Get context
        $context = context_module::instance($cm->id);

        // Step 4: Validate JWT authentication (handled by parent constructor)
        $user = $this->getUser();

        // Step 5: Check mod/assign:submit capability
        $this->checkCapability('mod/assign:submit', $context);

        // Step 6: Instantiate assign class
        $assign = new assign($context, $cm, null);
        $instance = $assign->get_instance();

        // Step 7: Check if submissions are open for this user
        $assign->update_effective_access($user->id);
        if (!$assign->submissions_open($user->id)) {
            throw new ValidationException('Submissions are closed for this assignment');
        }

        // Step 8: Check if submission statement is required
        if ($instance->requiresubmissionstatement) {
            $adminconfig = $assign->get_admin_config();
            $submissionstatement = $assign->get_submissionstatement($adminconfig, $instance, $context);
            
            if (!empty($submissionstatement)) {
                $body = $this->getJsonBody();
                $acceptedStatement = $body['submissionstatement'] ?? 0;
                
                if (empty($acceptedStatement) || $acceptedStatement != 1) {
                    throw new ValidationException('You must accept the submission statement before submitting');
                }
            }
        }

        // Step 9: Get JSON body with plugin data
        $body = $this->getJsonBody();
        $plugindata = $body['plugindata'] ?? [];

        // Step 10: Create data object with userid, submissionstatement, and plugin data
        $data = new stdClass();
        $data->userid = $user->id;
        $data->submissionstatement = $body['submissionstatement'] ?? 0;

        // Add plugin data to the data object
        // For file submissions: files_filemanager with draft itemid
        if (isset($plugindata['files_filemanager'])) {
            $data->files_filemanager = clean_param($plugindata['files_filemanager'], PARAM_INT);
        }

        // For online text submissions: onlinetext_editor with text and format
        if (isset($plugindata['onlinetext_editor'])) {
            $data->onlinetext_editor = [
                'text' => $plugindata['onlinetext_editor']['text'] ?? '',
                'format' => clean_param($plugindata['onlinetext_editor']['format'] ?? FORMAT_HTML, PARAM_INT),
                'itemid' => clean_param($plugindata['onlinetext_editor']['itemid'] ?? 0, PARAM_INT)
            ];
        }

        // Handle other submission plugins if present
        foreach ($plugindata as $key => $value) {
            if ($key !== 'files_filemanager' && $key !== 'onlinetext_editor') {
                $data->$key = $value;
            }
        }

        // Step 11: Save the submission with plugin data
        // This processes files, online text, and other plugin data
        $notices = [];
        $saveResult = $assign->save_submission($data, $notices);

        if ($saveResult === false || !empty($notices)) {
            $errorMessage = !empty($notices) ? implode(', ', $notices) : 'Failed to save submission';
            throw new ValidationException($errorMessage);
        }

        // Step 12: Submit for grading
        // This finalizes the submission and changes status to SUBMITTED if needed
        $submitNotices = [];
        $submitResult = $assign->submit_for_grading($data, $submitNotices);

        if ($submitResult === false || !empty($submitNotices)) {
            $errorMessage = !empty($submitNotices) ? implode(', ', $submitNotices) : 'Failed to submit for grading';
            throw new ValidationException($errorMessage);
        }

        // Step 13: Get updated submission record
        if ($instance->teamsubmission) {
            $submission = $assign->get_group_submission($user->id, 0, false);
        } else {
            $submission = $assign->get_user_submission($user->id, false);
        }

        if (!$submission) {
            throw new ValidationException('Submission was processed but could not be retrieved');
        }

        // Step 14: Format response with submission details
        $responseData = [
            'submission' => [
                'id' => (int)$submission->id,
                'status' => $submission->status,
                'timecreated' => (int)$submission->timecreated,
                'timemodified' => (int)$submission->timemodified,
                'attemptnumber' => (int)$submission->attemptnumber
            ]
        ];

        // Step 15: Return success response with 201 status
        $this->success($responseData, 201);
    }
}

// Instantiate and execute the endpoint
$endpoint = new AssignmentSubmitEndpoint();
$endpoint->execute();
