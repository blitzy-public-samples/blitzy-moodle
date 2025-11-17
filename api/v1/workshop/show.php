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
 * REST API endpoint for retrieving workshop activity details
 *
 * Handles GET /api/v1/workshop/{id} to fetch complete workshop activity information
 * including metadata, phase information, submission settings, assessment strategy,
 * grading configuration, and user-specific permissions and status.
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Load API utilities first
require_once(__DIR__ . '/../../lib/api_base.php');
require_once(__DIR__ . '/../../lib/api_exception.php');

// Load Moodle configuration (skip in test mode if needed)
if (!defined('CLI_SCRIPT')) {
    require_once(__DIR__ . '/../../../config.php');
}

/**
 * Workshop show endpoint class
 *
 * Extends ApiBase to handle GET requests for retrieving workshop activity details.
 * Wraps existing Moodle workshop functions without duplicating business logic.
 */
class WorkshopShowEndpoint extends ApiBase {

    /**
     * Handle GET request for workshop details
     *
     * Retrieves comprehensive workshop information including:
     * - Workshop metadata (name, intro, course info)
     * - Current phase and phase dates
     * - Submission settings and requirements
     * - Assessment strategy and grading configuration
     * - User permissions and capabilities
     * - User-specific status (submissions, assessments, examples)
     *
     * @return void Outputs JSON response
     * @throws NotFoundException If workshop not found
     * @throws ForbiddenException If user lacks permission to view
     */
    protected function handle_get() {
        global $DB, $USER, $CFG;

        // Load workshop libraries
        require_once($CFG->dirroot . '/mod/workshop/lib.php');
        require_once($CFG->dirroot . '/mod/workshop/locallib.php');

        // Get workshop ID from URL parameter
        $workshopid = $this->getParam('id', PARAM_INT);

        if (empty($workshopid)) {
            throw new ValidationException('Workshop ID is required');
        }

        // Retrieve workshop course module
        try {
            $cm = get_coursemodule_from_instance('workshop', $workshopid, 0, false, MUST_EXIST);
        } catch (Exception $e) {
            throw new NotFoundException('Workshop activity not found');
        }

        // Retrieve course record
        $course = $DB->get_record('course', array('id' => $cm->course), '*', MUST_EXIST);

        // Retrieve workshop record
        $workshoprecord = $DB->get_record('workshop', array('id' => $cm->instance), '*', MUST_EXIST);

        // Instantiate workshop object with all methods
        $workshop = new workshop($workshoprecord, $cm, $course);

        // Enforce permission check for viewing workshop
        $this->checkCapability('mod/workshop:view', $workshop->context);

        // Get current authenticated user
        $user = $this->getUser();
        $userid = $user->id;

        // Check additional user capabilities
        $capabilities = array(
            'can_submit' => has_capability('mod/workshop:submit', $workshop->context),
            'can_assess' => has_capability('mod/workshop:peerassess', $workshop->context),
            'can_view_all' => has_capability('mod/workshop:viewallsubmissions', $workshop->context),
            'can_override_grades' => has_capability('mod/workshop:overridegrades', $workshop->context),
            'can_allocate' => has_capability('mod/workshop:allocate', $workshop->context),
            'can_edit_dimensions' => has_capability('mod/workshop:editdimensions', $workshop->context),
            'can_manage_examples' => has_capability('mod/workshop:manageexamples', $workshop->context),
            'can_switch_phase' => has_capability('mod/workshop:switchphase', $workshop->context),
        );

        // Determine current phase name and number
        $phase_mapping = array(
            workshop::PHASE_SETUP => 'setup',
            workshop::PHASE_SUBMISSION => 'submission',
            workshop::PHASE_ASSESSMENT => 'assessment',
            workshop::PHASE_EVALUATION => 'evaluation',
            workshop::PHASE_CLOSED => 'closed',
        );

        $current_phase_name = isset($phase_mapping[$workshop->phase]) 
            ? $phase_mapping[$workshop->phase] 
            : 'unknown';

        $phase_info = array(
            'current' => $current_phase_name,
            'number' => (int)$workshop->phase,
        );

        // Prepare phase dates information
        $phase_dates = array(
            'submission_start' => (int)$workshop->submissionstart,
            'submission_end' => (int)$workshop->submissionend,
            'assessment_start' => (int)$workshop->assessmentstart,
            'assessment_end' => (int)$workshop->assessmentend,
        );

        // Prepare submission settings
        $submission_settings = array(
            'nattachments' => (int)$workshop->nattachments,
            'submissiontypetext' => (int)$workshop->submissiontypetext,
            'submissiontypefile' => (int)$workshop->submissiontypefile,
            'latesubmissions' => (bool)$workshop->latesubmissions,
            'maxbytes' => (int)$workshop->maxbytes,
            'submissionfiletypes' => $workshop->submissionfiletypes,
        );

        // Prepare assessment strategy information
        $assessment_strategy = array(
            'strategy' => $workshop->strategy,
            'grade' => (float)$workshop->grade,
            'gradinggrade' => (float)$workshop->gradinggrade,
            'gradedecimals' => (int)$workshop->gradedecimals,
        );

        // Prepare evaluation settings
        $evaluation_settings = array(
            'method' => $workshop->evaluation,
        );

        // Prepare examples settings
        $examples_mode_mapping = array(
            workshop::EXAMPLES_VOLUNTARY => 'voluntary',
            workshop::EXAMPLES_BEFORE_SUBMISSION => 'before_submission',
            workshop::EXAMPLES_BEFORE_ASSESSMENT => 'before_assessment',
        );

        $examples_mode_name = isset($examples_mode_mapping[$workshop->examplesmode])
            ? $examples_mode_mapping[$workshop->examplesmode]
            : 'voluntary';

        $examples_settings = array(
            'useexamples' => (int)$workshop->useexamples,
            'examplesmode' => $examples_mode_name,
            'examplesmode_number' => (int)$workshop->examplesmode,
        );

        // Get submission and assessment counts
        $total_submissions = 0;
        $total_assessments = 0;

        try {
            // Use count_all_submissions if available, fallback to count_submissions
            if (method_exists($workshop, 'count_all_submissions')) {
                $total_submissions = $workshop->count_all_submissions();
            }

            // Use count_all_assessments if available, fallback to count_assessments
            if (method_exists($workshop, 'count_all_assessments')) {
                $total_assessments = $workshop->count_all_assessments();
            }
        } catch (Exception $e) {
            // If counting fails, leave as 0
        }

        $counts = array(
            'total_submissions' => (int)$total_submissions,
            'total_assessments' => (int)$total_assessments,
        );

        // Get user-specific submission information
        $user_submission = null;
        $has_submission = false;

        try {
            $user_submission = $workshop->get_submission_by_author($userid);
            if ($user_submission && !empty($user_submission->id)) {
                $has_submission = true;
                $counts['user_submission_id'] = (int)$user_submission->id;
                $counts['user_submission_grade'] = $user_submission->grade !== null 
                    ? (float)$user_submission->grade 
                    : null;
            }
        } catch (Exception $e) {
            // User has no submission
        }

        // Get user's peer assessment information
        $user_assessments = array();
        $assessments_assigned = 0;
        $assessments_completed = 0;

        try {
            $user_assessments = $workshop->get_assessments_by_reviewer($userid);
            if (!empty($user_assessments)) {
                $assessments_assigned = count($user_assessments);
                foreach ($user_assessments as $assessment) {
                    if ($assessment->grade !== null) {
                        $assessments_completed++;
                    }
                }
            }
        } catch (Exception $e) {
            // User has no assessments
        }

        $counts['user_assessments_assigned'] = (int)$assessments_assigned;
        $counts['user_assessments_completed'] = (int)$assessments_completed;

        // Check if user must assess examples
        $must_assess_examples = false;
        $examples_assessed_count = 0;

        if ($workshop->useexamples) {
            try {
                // Get examples for this user
                $examples = $workshop->get_examples_for_reviewer($userid);
                if (!empty($examples)) {
                    $examples_assessed_count = 0;
                    foreach ($examples as $example) {
                        if (!is_null($example->grade)) {
                            $examples_assessed_count++;
                        }
                    }

                    // Check if examples are required based on mode
                    if ($workshop->examplesmode == workshop::EXAMPLES_BEFORE_SUBMISSION ||
                        $workshop->examplesmode == workshop::EXAMPLES_BEFORE_ASSESSMENT) {
                        $must_assess_examples = ($examples_assessed_count < count($examples));
                    }
                }
            } catch (Exception $e) {
                // No examples or error loading them
            }
        }

        $user_status = array(
            'has_submission' => $has_submission,
            'must_assess_examples' => $must_assess_examples,
            'examples_assessed_count' => (int)$examples_assessed_count,
        );

        // Determine if user can currently submit based on phase and timing
        $can_submit_now = false;
        if ($capabilities['can_submit'] && $workshop->phase == workshop::PHASE_SUBMISSION) {
            $current_time = time();
            $submission_open = ($workshop->submissionstart == 0 || $workshop->submissionstart <= $current_time);
            $submission_not_closed = ($workshop->submissionend == 0 || $workshop->submissionend > $current_time || $workshop->latesubmissions);

            $can_submit_now = $submission_open && $submission_not_closed;

            // Check if must assess examples first
            if ($must_assess_examples) {
                $can_submit_now = false;
            }
        }

        $user_status['can_submit_now'] = $can_submit_now;

        // Determine if user can currently assess
        $can_assess_now = false;
        if ($capabilities['can_assess'] && $workshop->phase == workshop::PHASE_ASSESSMENT) {
            $current_time = time();
            $assessment_open = ($workshop->assessmentstart == 0 || $workshop->assessmentstart <= $current_time);
            $assessment_not_closed = ($workshop->assessmentend == 0 || $workshop->assessmentend > $current_time);

            $can_assess_now = $assessment_open && $assessment_not_closed && ($assessments_assigned > 0);
        }

        $user_status['can_assess_now'] = $can_assess_now;

        // Prepare complete workshop response object
        $response_data = array(
            'id' => (int)$workshop->id,
            'course' => (int)$workshop->course->id,
            'coursemoduleid' => (int)$cm->id,
            'name' => $workshop->name,
            'intro' => $workshop->intro,
            'introformat' => (int)$workshop->introformat,
            'instructauthors' => $workshop->instructauthors,
            'instructauthorsformat' => (int)$workshop->instructauthorsformat,
            'instructreviewers' => $workshop->instructreviewers,
            'instructreviewersformat' => (int)$workshop->instructreviewersformat,
            'conclusion' => $workshop->conclusion,
            'conclusionformat' => (int)$workshop->conclusionformat,
            'timemodified' => (int)$workshop->timemodified,
            'phase' => $phase_info,
            'phase_dates' => $phase_dates,
            'submission_settings' => $submission_settings,
            'assessment_strategy' => $assessment_strategy,
            'evaluation' => $evaluation_settings,
            'examples_settings' => $examples_settings,
            'counts' => $counts,
            'user_permissions' => $capabilities,
            'user_status' => $user_status,
            'phaseswitchassessment' => (bool)$workshop->phaseswitchassessment,
            'usepeerassessment' => (bool)$workshop->usepeerassessment,
            'useselfassessment' => (bool)$workshop->useselfassessment,
            'overallfeedbackmode' => (int)$workshop->overallfeedbackmode,
            'overallfeedbackfiles' => (int)$workshop->overallfeedbackfiles,
            'overallfeedbackfiletypes' => $workshop->overallfeedbackfiletypes,
            'overallfeedbackmaxbytes' => (int)$workshop->overallfeedbackmaxbytes,
        );

        // Trigger workshop viewed event
        try {
            $event = \mod_workshop\event\course_module_viewed::create(array(
                'objectid' => $workshop->id,
                'context' => $workshop->context,
            ));
            $event->add_record_snapshot('course', $course);
            $event->add_record_snapshot('workshop', $workshoprecord);
            $event->trigger();
        } catch (Exception $e) {
            // Event triggering failed, but don't fail the request
            // Just log it if debugging is enabled
            if (debugging()) {
                debugging('Failed to trigger workshop_viewed event: ' . $e->getMessage(), DEBUG_DEVELOPER);
            }
        }

        // Return standardized success response
        $this->success($response_data);
    }
    
    /**
     * Handle POST request - Not supported for workshop show endpoint
     *
     * Workshops are read-only via this endpoint. Creating or modifying workshops
     * is handled through Moodle's standard course editing interface.
     *
     * @throws MethodNotAllowedException Always throws as POST is not supported
     */
    protected function handle_post() {
        throw new MethodNotAllowedException('POST method not supported for workshop show endpoint', [
            'allowed_methods' => ['GET'],
            'endpoint' => '/api/v1/workshop/{id}'
        ]);
    }
    
    /**
     * Handle PUT request - Not supported for workshop show endpoint
     *
     * Workshops are read-only via this endpoint. Creating or modifying workshops
     * is handled through Moodle's standard course editing interface.
     *
     * @throws MethodNotAllowedException Always throws as PUT is not supported
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method not supported for workshop show endpoint', [
            'allowed_methods' => ['GET'],
            'endpoint' => '/api/v1/workshop/{id}'
        ]);
    }
    
    /**
     * Handle DELETE request - Not supported for workshop show endpoint
     *
     * Workshops are read-only via this endpoint. Deleting workshops is handled
     * through Moodle's standard course editing interface.
     *
     * @throws MethodNotAllowedException Always throws as DELETE is not supported
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method not supported for workshop show endpoint', [
            'allowed_methods' => ['GET'],
            'endpoint' => '/api/v1/workshop/{id}'
        ]);
    }
}

// Execute the endpoint (skip in test mode)
if (!defined('API_TEST_MODE') || !API_TEST_MODE) {
    $endpoint = new WorkshopShowEndpoint();
    $endpoint->execute();
}
