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
 * REST API endpoint for retrieving LTI tool instance details
 *
 * GET /api/v1/lti/{id}
 *
 * Returns comprehensive information about an LTI tool instance including:
 * - Basic instance information (name, intro, timecreated, timemodified)
 * - Tool configuration (launch container, icons, secure icon)
 * - Launch capabilities (can view, can launch, launch URL)
 * - Course context information
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Moodle configuration and libraries
require_once(__DIR__ . '/../../../config.php');
require_once($CFG->dirroot . '/mod/lti/lib.php');
require_once($CFG->dirroot . '/mod/lti/locallib.php');

// API utilities
require_once(__DIR__ . '/../../lib/api_base.php');
require_once(__DIR__ . '/../../lib/auth_jwt.php');
require_once(__DIR__ . '/../../lib/api_response.php');

/**
 * LTI show endpoint - Retrieves LTI tool instance details
 */
class lti_show_endpoint extends api_base_endpoint {
    
    /**
     * Handle GET request - Retrieve LTI tool instance details
     *
     * @return array Response data
     * @throws moodle_exception
     */
    protected function handle_get() {
        global $DB, $CFG, $USER;
        
        // Get LTI instance ID from URL path
        $ltid = $this->get_path_parameter('id');
        
        if (!$ltid) {
            throw new moodle_exception('missingrequiredparam', 'error', '', 'id');
        }
        
        // Get LTI instance
        $lti = $DB->get_record('lti', ['id' => $ltid], '*', MUST_EXIST);
        
        // Get course module
        $cm = get_coursemodule_from_instance('lti', $lti->id, $lti->course, false, MUST_EXIST);
        
        // Get course
        $course = $DB->get_record('course', ['id' => $cm->course], '*', MUST_EXIST);
        
        // Get context
        $context = context_module::instance($cm->id);
        
        // Check capability - user must have mod/lti:view permission
        require_capability('mod/lti:view', $context);
        
        // Get tool type ID
        $typeid = $lti->typeid;
        if (empty($typeid) && ($tool = lti_get_tool_by_url_match($lti->toolurl))) {
            $typeid = $tool->id;
        }
        
        // Get tool configuration
        $toolconfig = [];
        $toolurl = $lti->toolurl;
        $missingtooltype = false;
        
        if ($typeid) {
            $toolconfig = lti_get_type_config($typeid);
            $missingtooltype = empty($toolconfig);
            if (!$missingtooltype && !empty($toolconfig['toolurl'])) {
                $toolurl = $toolconfig['toolurl'];
            }
        }
        
        // Check if tool type exists
        if ($missingtooltype) {
            throw new moodle_exception('tooltypenotfounderror', 'mod_lti');
        }
        
        // Get launch container
        $launchcontainer = lti_get_launch_container($lti, $toolconfig);
        
        // Get LTI version
        $ltiversion = LTI_VERSION_1;
        if ($typeid) {
            $typeconfig = lti_get_type_type_config($typeid);
            if ($typeconfig && isset($typeconfig->lti_ltiversion)) {
                $ltiversion = $typeconfig->lti_ltiversion;
            }
        }
        
        // Build launch URL
        $launchurl = new moodle_url('/mod/lti/launch.php', ['id' => $cm->id]);
        
        // Get user capabilities
        $capabilities = [
            'can_view' => has_capability('mod/lti:view', $context),
            'can_launch' => has_capability('mod/lti:view', $context),
            'can_grade' => has_capability('mod/lti:grade', $context),
            'can_manage' => has_capability('mod/lti:manage', $context),
        ];
        
        // Build response data
        $data = [
            'id' => (int)$lti->id,
            'course' => (int)$lti->course,
            'name' => format_string($lti->name),
            'intro' => format_text($lti->intro, $lti->introformat, ['context' => $context]),
            'introformat' => (int)$lti->introformat,
            'timecreated' => (int)$lti->timecreated,
            'timemodified' => (int)$lti->timemodified,
            'typeid' => $typeid ? (int)$typeid : null,
            'toolurl' => $toolurl,
            'securetoolurl' => $lti->securetoolurl ?? null,
            'instructorchoicesendname' => !empty($lti->instructorchoicesendname),
            'instructorchoicesendemailaddr' => !empty($lti->instructorchoicesendemailaddr),
            'instructorchoiceallowroster' => !empty($lti->instructorchoiceallowroster),
            'instructorchoiceallowsetting' => !empty($lti->instructorchoiceallowsetting),
            'instructorcustomparameters' => $lti->instructorcustomparameters ?? null,
            'instructorchoiceacceptgrades' => !empty($lti->instructorchoiceacceptgrades),
            'grade' => (int)$lti->grade,
            'launchcontainer' => (int)$launchcontainer,
            'resourcekey' => $lti->resourcekey ?? null,
            'password' => null, // Never expose password in API
            'debuglaunch' => !empty($lti->debuglaunch),
            'showtitlelaunch' => !empty($lti->showtitlelaunch),
            'showdescriptionlaunch' => !empty($lti->showdescriptionlaunch),
            'icon' => $lti->icon ?? null,
            'secureicon' => $lti->secureicon ?? null,
            'ltiversion' => $ltiversion,
            'launchurl' => $launchurl->out(false),
            'capabilities' => $capabilities,
            'coursemodule' => [
                'id' => (int)$cm->id,
                'course' => (int)$cm->course,
                'module' => (int)$cm->module,
                'instance' => (int)$cm->instance,
                'section' => (int)$cm->section,
                'visible' => (bool)$cm->visible,
                'groupmode' => (int)$cm->groupmode,
                'groupingid' => (int)$cm->groupingid,
            ],
            'course_info' => [
                'id' => (int)$course->id,
                'fullname' => format_string($course->fullname),
                'shortname' => format_string($course->shortname),
                'idnumber' => $course->idnumber ?? '',
            ],
        ];
        
        return $data;
    }
}

// Instantiate and execute endpoint
$endpoint = new lti_show_endpoint();
$endpoint->execute();
