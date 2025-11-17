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
 * REST API endpoint for retrieving and searching database activity records
 *
 * Handles GET /api/v1/data/{id}/records requests with pagination, sorting, and filtering.
 * Returns array of data_records with field contents, user information, timestamps,
 * approval status, and group assignments. Supports both simple search and advanced
 * field-specific search capabilities.
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Include Moodle configuration and required libraries
// In test environment, these are already loaded by PHPUnit bootstrap or test script
if (!defined('PHPUNIT_TEST') && !defined('API_TEST_MODE')) {
    require_once(__DIR__ . '/../../../config.php');
    require_once($CFG->dirroot . '/mod/data/lib.php');
    require_once($CFG->dirroot . '/mod/data/locallib.php');
}

// Include API framework classes
require_once(__DIR__ . '/../../lib/api_base.php');
require_once(__DIR__ . '/../../lib/auth_jwt.php');
require_once(__DIR__ . '/../../lib/api_response.php');
require_once(__DIR__ . '/../../lib/api_exception.php');

use mod_data\external\record_exporter;
use mod_data\manager;

/**
 * Database activity records REST API endpoint
 *
 * Provides GET endpoint for retrieving and searching database activity records.
 * Wraps data_search_entries() function with proper authentication, authorization,
 * and JSON response formatting.
 */
class DataRecordsEndpoint extends ApiBase {

    /**
     * Handle GET request for database activity records
     *
     * Endpoint: GET /api/v1/data/{id}/records
     *
     * Query Parameters:
     * - groupid (int, default 0): Filter by group ID
     * - returncontents (bool, default false): Include full field contents and template rendering
     * - search (string, default ''): Simple search text across all fields
     * - sort (int|null): Field ID to sort by
     * - order (string|null): Sort direction (ASC or DESC)
     * - page (int, default 0): Page number for pagination (0-indexed)
     * - perpage (int, default 0): Records per page (0 = all)
     *
     * Response:
     * - entries: Array of formatted records with exporter structure
     * - totalcount: Total number of records matching search
     * - maxcount: Maximum records that can be displayed
     * - listviewcontents: Optional rendered list template (if returncontents=true)
     *
     * @return void Outputs JSON response
     * @throws NotFoundException If database activity not found
     * @throws ForbiddenException If user lacks mod/data:viewentry capability or group access
     * @throws ValidationException If parameters are invalid
     */
    protected function handle_get() {
        global $DB, $PAGE;

        // Extract database ID from URI path segments
        // URI format: /api/v1/data/{id}/records
        $pathparts = explode('/', trim($this->requestUri, '/'));
        
        // Find the index of 'data' and get the next element
        $dataidx = array_search('data', $pathparts);
        if ($dataidx === false || !isset($pathparts[$dataidx + 1])) {
            throw new ValidationException('Database ID not found in request path', [
                'uri' => $this->requestUri,
                'expected_format' => '/api/v1/data/{id}/records'
            ]);
        }
        
        $databaseid = $pathparts[$dataidx + 1];
        
        // Validate database ID is numeric
        if (!is_numeric($databaseid) || $databaseid <= 0) {
            throw new ValidationException('Invalid database ID', [
                'provided_id' => $databaseid,
                'expected' => 'positive integer'
            ]);
        }
        
        $databaseid = (int)$databaseid;

        // Parse query parameters with defaults matching external.php patterns
        $groupid = $this->getParam('groupid', PARAM_INT, false) ?: 0;
        $returncontents = $this->getParam('returncontents', PARAM_BOOL, false) ?: false;
        $search = $this->getParam('search', PARAM_TEXT, false) ?: '';
        $sort = $this->getParam('sort', PARAM_INT, false) ?: null;
        $order = $this->getParam('order', PARAM_ALPHA, false) ?: null;
        $page = $this->getParam('page', PARAM_INT, false) ?: 0;
        $perpage = $this->getParam('perpage', PARAM_INT, false) ?: 0;

        // Validate order parameter if provided
        if (!empty($order)) {
            $order = strtoupper($order);
            if ($order !== 'ASC' && $order !== 'DESC') {
                throw new ValidationException('Invalid sort direction', [
                    'provided' => $order,
                    'allowed' => ['ASC', 'DESC']
                ]);
            }
        }

        // Get database record with MUST_EXIST flag
        $database = $DB->get_record('data', ['id' => $databaseid], '*', MUST_EXIST);
        if (!$database) {
            throw new NotFoundException("Database activity with ID {$databaseid} not found");
        }

        // Get course and course module from database instance
        list($course, $cm) = get_course_and_cm_from_instance($database, 'data');

        // Create module context for permission checking
        $context = context_module::instance($cm->id);

        // Check user has capability to view entries
        $this->checkCapability('mod/data:viewentry', $context);

        // Check database time availability (respects timeopen/timeclose settings)
        try {
            data_require_time_available($database, null, $context);
        } catch (moodle_exception $e) {
            throw new ForbiddenException('Database activity not available at this time', [
                'reason' => $e->getMessage(),
                'error_code' => $e->errorcode
            ]);
        }

        // Determine effective group ID based on activity group mode
        if (!empty($groupid)) {
            // Specific group requested - validate visibility
            if (!groups_group_visible($groupid, $course, $cm)) {
                throw new ForbiddenException('You do not have access to this group', [
                    'groupid' => $groupid
                ]);
            }
        } else {
            // No specific group - check if groups are being used
            $groupmode = groups_get_activity_groupmode($cm);
            if ($groupmode) {
                // Get user's current group for this activity
                // groups_get_activity_group handles group mode logic
                $groupid = groups_get_activity_group($cm);
            } else {
                $groupid = 0; // No groups or separate groups disabled
            }
        }

        // Create manager instance for template parsing
        $manager = manager::create_from_instance($database);

        // Call data_search_entries to retrieve records with pagination and search
        // Returns: list($records, $maxcount, $totalcount, $page, $nowperpage, $sort, $mode)
        list($records, $maxcount, $totalcount, $page, $nowperpage, $sort, $mode) =
            data_search_entries(
                $database,
                $cm,
                $context,
                'list',        // View mode
                $groupid,      // Effective group ID
                $search,       // Search text
                $sort,         // Sort field ID
                $order,        // Sort direction
                $page,         // Page number
                $perpage       // Records per page
            );

        // Format records using record_exporter for consistent API output
        $entries = [];
        $contentsids = []; // Track content IDs for file size calculation
        
        foreach ($records as $record) {
            // Extract user information from record
            $user = user_picture::unalias($record, null, 'userid');
            
            // Prepare related data for exporter
            $related = [
                'context' => $context,
                'database' => $database,
                'user' => $user
            ];

            // Include field contents if requested
            if ($returncontents) {
                $contents = $DB->get_records('data_content', ['recordid' => $record->id]);
                $contentsids = array_merge($contentsids, array_keys($contents));
                $related['contents'] = $contents;
            } else {
                $related['contents'] = null;
            }

            // Use record_exporter to format record data
            $exporter = new record_exporter($record, $related);
            $entries[] = $exporter->export($PAGE->get_renderer('core'));
        }

        // Build response data structure
        $responsedata = [
            'entries' => $entries,
            'totalcount' => $totalcount,
            'maxcount' => $maxcount
        ];

        // Add pagination metadata
        if ($perpage > 0) {
            $responsedata['pagination'] = [
                'page' => $page,
                'perpage' => $nowperpage,
                'total' => $totalcount,
                'totalpages' => ($nowperpage > 0) ? ceil($totalcount / $nowperpage) : 1
            ];
        }

        // Optionally render list template for backward compatibility
        if ($returncontents) {
            try {
                $parser = $manager->get_template('listtemplate', ['page' => $page]);
                $responsedata['listviewcontents'] = $parser->parse_entries($records);
            } catch (Exception $e) {
                // Template parsing is optional - log but don't fail
                debugging('Failed to parse list template: ' . $e->getMessage(), DEBUG_DEVELOPER);
            }
        }

        // Return successful response with formatted data
        $this->success($responsedata);
    }

    /**
     * Handle POST request - not supported for this endpoint
     *
     * @throws MethodNotAllowedException Always, as POST is not supported
     */
    protected function handle_post() {
        throw new MethodNotAllowedException('POST method not supported for records listing');
    }

    /**
     * Handle PUT request - not supported for this endpoint
     *
     * @throws MethodNotAllowedException Always, as PUT is not supported
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method not supported for records listing');
    }

    /**
     * Handle DELETE request - not supported for this endpoint
     *
     * @throws MethodNotAllowedException Always, as DELETE is not supported
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method not supported for records listing');
    }
}

// Instantiate and execute the endpoint
// Skip auto-execution in test mode to allow manual instantiation
if (!defined('API_TEST_MODE') || !API_TEST_MODE) {
    $endpoint = new DataRecordsEndpoint();
    $endpoint->execute();
}
