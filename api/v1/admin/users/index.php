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
 * REST API endpoint for retrieving paginated list of all users.
 *
 * Handles GET /api/v1/admin/users with query parameters for pagination (page, perpage),
 * filtering by name/email/status/role, and sorting options. Enforces moodle/user:update
 * capability, uses $DB->get_records_sql() with joins for efficient data retrieval,
 * returns JSON array of user objects with comprehensive fields.
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Require Moodle configuration
// Only require config if not already loaded (for test compatibility)
if (!defined('MOODLE_INTERNAL')) {
    require_once(__DIR__ . '/../../../../config.php');
}

// Require API base classes
require_once(__DIR__ . '/../../../lib/api_base.php');
require_once(__DIR__ . '/../../../lib/api_response.php');
require_once(__DIR__ . '/../../../lib/api_exception.php');

// Require Moodle core libraries
require_once($CFG->dirroot . '/user/lib.php');

/**
 * API endpoint class for user list administration.
 *
 * Provides comprehensive user management capabilities for React admin interface
 * including pagination, filtering, sorting, and detailed user information retrieval.
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class AdminUsersIndexEndpoint extends ApiBase {
    
    /**
     * Handle GET requests to retrieve list of users.
     *
     * Enforces moodle/user:update capability, extracts and validates query parameters,
     * builds SQL query with filters and sorting, executes paginated query, and returns
     * formatted JSON response with user data and pagination metadata.
     *
     * Query Parameters:
     * - page (int): Page number (default: 1, min: 1)
     * - perpage (int): Results per page (default: 20, min: 1, max: 100)
     * - search (string): Text filter for name/username/email fields
     * - status (string): Filter by user status ('active', 'suspended', 'deleted')
     * - sortby (string): Field to sort by (default: 'lastname')
     * - sortorder (string): Sort direction ('ASC' or 'DESC', default: 'ASC')
     *
     * @return void Outputs JSON response directly
     * @throws ForbiddenException If user lacks moodle/user:update capability
     * @throws ValidationException If query parameters are invalid
     * @throws ServerException If database query fails unexpectedly
     */
    protected function handle_get() {
        global $DB, $CFG;
        
        // Enforce capability check - user must have permission to update users
        try {
            $this->checkCapability('moodle/user:update', context_system::instance());
        } catch (moodle_exception $e) {
            throw new ForbiddenException(
                'You do not have permission to view user list',
                [
                    'requiredCapability' => 'moodle/user:update',
                    'context' => 'system'
                ]
            );
        }
        
        // Extract and validate pagination parameters
        $page = $this->getParam('page', PARAM_INT, false, 1);
        $perpage = $this->getParam('perpage', PARAM_INT, false, 20);
        
        // Validate page number
        if ($page < 1) {
            throw new ValidationException(
                'Invalid page number',
                [
                    'field' => 'page',
                    'value' => $page,
                    'rule' => 'Must be a positive integer (minimum 1)'
                ]
            );
        }
        
        // Validate perpage with maximum limit
        if ($perpage < 1 || $perpage > 100) {
            throw new ValidationException(
                'Invalid perpage value',
                [
                    'field' => 'perpage',
                    'value' => $perpage,
                    'rule' => 'Must be between 1 and 100'
                ]
            );
        }
        
        // Extract optional filter parameters
        $search = $this->getParam('search', PARAM_TEXT, false, '');
        $status = $this->getParam('status', PARAM_ALPHA, false, '');
        $sortby = $this->getParam('sortby', PARAM_ALPHA, false, 'lastname');
        $sortorder = $this->getParam('sortorder', PARAM_ALPHA, false, 'ASC');
        
        // Validate status filter
        $validStatuses = ['active', 'suspended', 'deleted', ''];
        if (!in_array($status, $validStatuses)) {
            throw new ValidationException(
                'Invalid status filter',
                [
                    'field' => 'status',
                    'value' => $status,
                    'rule' => 'Must be one of: active, suspended, deleted'
                ]
            );
        }
        
        // Validate sort order
        $sortorder = strtoupper($sortorder);
        if ($sortorder !== 'ASC' && $sortorder !== 'DESC') {
            throw new ValidationException(
                'Invalid sort order',
                [
                    'field' => 'sortorder',
                    'value' => $sortorder,
                    'rule' => 'Must be ASC or DESC'
                ]
            );
        }
        
        // Validate sortby field to prevent SQL injection
        $validSortFields = [
            'id', 'username', 'firstname', 'lastname', 'email',
            'timecreated', 'timemodified', 'lastaccess', 'suspended'
        ];
        if (!in_array($sortby, $validSortFields)) {
            throw new ValidationException(
                'Invalid sort field',
                [
                    'field' => 'sortby',
                    'value' => $sortby,
                    'rule' => 'Must be one of: ' . implode(', ', $validSortFields)
                ]
            );
        }
        
        // Build SQL query with proper user fields
        // Use core_user\fields helper to get identity and name fields
        $userfieldsapi = \core_user\fields::for_identity(context_system::instance(), false)
            ->with_name()
            ->including('email', 'suspended', 'deleted', 'lastaccess', 'timecreated', 'timemodified');
        
        $userfields = $userfieldsapi->get_sql('u', false, '', '', false)->selects;
        
        // Build WHERE conditions
        $where = ['1=1']; // Always true starting condition
        $params = [];
        
        // Exclude guest user
        $where[] = 'u.id != :guestid';
        $params['guestid'] = $CFG->siteguest;
        
        // Apply search filter if provided
        if (!empty($search)) {
            $search = trim($search);
            $searchparam = '%' . $DB->sql_like_escape($search) . '%';
            
            // Search in firstname, lastname, username, and email using LIKE with OR
            $searchconditions = [
                $DB->sql_like('u.firstname', ':searchfirst', false),
                $DB->sql_like('u.lastname', ':searchlast', false),
                $DB->sql_like('u.username', ':searchuser', false),
                $DB->sql_like('u.email', ':searchemail', false)
            ];
            
            $where[] = '(' . implode(' OR ', $searchconditions) . ')';
            $params['searchfirst'] = $searchparam;
            $params['searchlast'] = $searchparam;
            $params['searchuser'] = $searchparam;
            $params['searchemail'] = $searchparam;
        }
        
        // Apply status filter if provided
        if ($status === 'active') {
            $where[] = 'u.suspended = 0';
            $where[] = 'u.deleted = 0';
        } else if ($status === 'suspended') {
            $where[] = 'u.suspended = 1';
            $where[] = 'u.deleted = 0';
        } else if ($status === 'deleted') {
            $where[] = 'u.deleted = 1';
        }
        
        // Combine WHERE conditions
        $wheresql = implode(' AND ', $where);
        
        // Build ORDER BY clause
        $orderbysql = "u.{$sortby} {$sortorder}";
        
        // Add secondary sort by ID for consistency when primary sort values are equal
        if ($sortby !== 'id') {
            $orderbysql .= ", u.id {$sortorder}";
        }
        
        // Calculate offset for pagination
        $offset = ($page - 1) * $perpage;
        
        // Execute query to get users
        $sql = "SELECT {$userfields}
                  FROM {user} u
                 WHERE {$wheresql}
              ORDER BY {$orderbysql}";
        
        try {
            // Get paginated user records
            $users = $DB->get_records_sql($sql, $params, $offset, $perpage);
            
            // Count total matching records for pagination metadata
            $countsql = "SELECT COUNT(u.id)
                          FROM {user} u
                         WHERE {$wheresql}";
            $totalcount = $DB->count_records_sql($countsql, $params);
            
        } catch (dml_exception $e) {
            throw new ServerException(
                'Database query failed',
                [
                    'error' => $e->getMessage(),
                    'operation' => 'get_users_list'
                ]
            );
        }
        
        // Format user data for response
        $userdata = [];
        foreach ($users as $user) {
            // Format lastaccess as human-readable date if it exists
            $lastaccess = null;
            if (!empty($user->lastaccess)) {
                $lastaccess = userdate($user->lastaccess, get_string('strftimedatetime', 'langconfig'));
            }
            
            // Build user object with all required fields
            $userdata[] = [
                'id' => (int) $user->id,
                'username' => $user->username,
                'firstname' => $user->firstname,
                'lastname' => $user->lastname,
                'email' => $user->email,
                'suspended' => (bool) $user->suspended,
                'deleted' => (bool) $user->deleted,
                'lastaccess' => (int) $user->lastaccess,
                'lastAccessFormatted' => $lastaccess,
                'timecreated' => (int) $user->timecreated,
                'timemodified' => (int) $user->timemodified,
            ];
        }
        
        // Build pagination metadata using ApiResponse helper
        $meta = ApiResponse::formatPagination($page, $perpage, $totalcount);
        
        // Return success response with user data and pagination metadata
        $this->success($userdata, 200, $meta);
    }
    
    /**
     * Handle POST request - not allowed for admin users listing endpoint.
     *
     * @return void
     * @throws MethodNotAllowedException Always throws exception
     */
    protected function handle_post() {
        throw new MethodNotAllowedException('POST method not allowed for admin users listing endpoint');
    }
    
    /**
     * Handle PUT request - not allowed for admin users listing endpoint.
     *
     * @return void
     * @throws MethodNotAllowedException Always throws exception
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method not allowed for admin users listing endpoint');
    }
    
    /**
     * Handle DELETE request - not allowed for admin users listing endpoint.
     *
     * @return void
     * @throws MethodNotAllowedException Always throws exception
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method not allowed for admin users listing endpoint');
    }
}

// Instantiate and execute the endpoint

// Execute the endpoint if not in test mode
if (!defined('API_TEST_MODE')) {
$endpoint = new AdminUsersIndexEndpoint();
$endpoint->execute();
}
