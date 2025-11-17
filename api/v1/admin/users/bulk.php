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
 * REST API endpoint for bulk user operations.
 *
 * Handles POST /api/v1/admin/users/bulk for performing operations on multiple
 * user accounts simultaneously. Supports delete, suspend, unsuspend, confirm,
 * and force_password_change operations. Enforces appropriate capabilities,
 * processes users in batches for performance, and returns detailed results
 * including success/failure counts and error messages per user.
 *
 * Request payload:
 * {
 *   "operation": "delete|suspend|unsuspend|confirm|force_password_change",
 *   "userids": [123, 456, 789]
 * }
 *
 * Response format:
 * {
 *   "success": true,
 *   "data": {
 *     "total": 3,
 *     "successful": 2,
 *     "failed": 1,
 *     "results": [
 *       {"userid": 123, "success": true, "message": "User deleted successfully"},
 *       {"userid": 456, "success": true, "message": "User deleted successfully"},
 *       {"userid": 789, "success": false, "message": "Cannot delete admin user"}
 *     ]
 *   }
 * }
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Load API base class and utilities
require_once(__DIR__ . '/../../../lib/api_base.php');
require_once(__DIR__ . '/../../../lib/api_exception.php');

// Load Moodle core libraries for user management
if (!defined('API_TEST_MODE') || !API_TEST_MODE) {
    require_once(__DIR__ . '/../../../../config.php');
    require_once($CFG->dirroot . '/lib/moodlelib.php');
    require_once($CFG->dirroot . '/user/lib.php');
}

/**
 * Bulk user operations API endpoint.
 *
 * Extends ApiBase to handle bulk operations on multiple user accounts.
 * Processes operations in batches for efficiency and provides detailed
 * results for each user in the batch.
 */
class BulkUserEndpoint extends ApiBase {
    
    /**
     * Allowed bulk operation types with their descriptions.
     *
     * @var array Operation name => description mapping
     */
    private const ALLOWED_OPERATIONS = [
        'delete' => 'Delete user accounts',
        'suspend' => 'Suspend user accounts',
        'unsuspend' => 'Unsuspend user accounts',
        'confirm' => 'Confirm user accounts',
        'force_password_change' => 'Force password change on next login'
    ];
    
    /**
     * Batch size for processing large numbers of users.
     * Prevents memory exhaustion and improves performance.
     *
     * @var int Number of users to process per batch
     */
    private const BATCH_SIZE = 300;
    
    /**
     * Handle GET requests - not supported for this endpoint.
     *
     * @throws MethodNotAllowedException Always throws as GET is not supported
     */
    protected function handle_get() {
        throw new MethodNotAllowedException('GET method not supported for bulk operations', [
            'supportedMethods' => ['POST']
        ]);
    }
    
    /**
     * Handle POST requests for bulk user operations.
     *
     * Validates request payload, checks capabilities based on operation type,
     * processes users in batches, and returns detailed results for each user.
     *
     * @return void Outputs JSON response via success() method
     * @throws ValidationException If operation or userids are invalid
     * @throws ForbiddenException If user lacks required capability
     */
    protected function handle_post() {
        global $DB, $USER;
        
        // Extract and validate JSON payload
        $data = $this->getJsonBody();
        
        // Validate operation parameter
        if (!isset($data['operation']) || !is_string($data['operation'])) {
            throw new ValidationException('Missing or invalid operation parameter', [
                'field' => 'operation',
                'allowedValues' => array_keys(self::ALLOWED_OPERATIONS)
            ]);
        }
        
        $operation = $data['operation'];
        
        if (!array_key_exists($operation, self::ALLOWED_OPERATIONS)) {
            throw new ValidationException('Invalid operation type', [
                'field' => 'operation',
                'value' => $operation,
                'allowedValues' => array_keys(self::ALLOWED_OPERATIONS)
            ]);
        }
        
        // Validate userids parameter
        if (!isset($data['userids']) || !is_array($data['userids']) || empty($data['userids'])) {
            throw new ValidationException('Missing or invalid userids parameter', [
                'field' => 'userids',
                'expected' => 'Non-empty array of integers',
                'received' => gettype($data['userids'] ?? null)
            ]);
        }
        
        $userids = $data['userids'];
        
        // Validate all userids are integers
        foreach ($userids as $userid) {
            if (!is_int($userid) || $userid <= 0) {
                throw new ValidationException('Invalid user ID format', [
                    'field' => 'userids',
                    'invalidValue' => $userid,
                    'expected' => 'Positive integer'
                ]);
            }
        }
        
        // Check capability based on operation type
        $context = context_system::instance();
        
        if ($operation === 'delete') {
            // Delete operation requires delete capability
            $this->checkCapability('moodle/user:delete', $context);
        } else {
            // All other operations require update capability
            $this->checkCapability('moodle/user:update', $context);
        }
        
        // Route to appropriate operation handler
        try {
            switch ($operation) {
                case 'delete':
                    $results = $this->processDeleteOperation($userids);
                    break;
                    
                case 'suspend':
                    $results = $this->processSuspendOperation($userids, true);
                    break;
                    
                case 'unsuspend':
                    $results = $this->processSuspendOperation($userids, false);
                    break;
                    
                case 'confirm':
                    $results = $this->processConfirmOperation($userids);
                    break;
                    
                case 'force_password_change':
                    $results = $this->processForcePasswordChangeOperation($userids);
                    break;
                    
                default:
                    // This should never happen due to earlier validation
                    throw new ValidationException('Unsupported operation', [
                        'operation' => $operation
                    ]);
            }
            
            // Determine HTTP status code based on results
            $statusCode = 200; // OK
            if ($results['failed'] > 0 && $results['successful'] > 0) {
                $statusCode = 207; // Multi-Status (partial success)
            } elseif ($results['failed'] > 0 && $results['successful'] === 0) {
                $statusCode = 400; // Bad Request (all failed)
            }
            
            // Return success response with operation results
            $this->success($results, $statusCode);
            
        } catch (moodle_exception $e) {
            // Convert Moodle exceptions to API exceptions
            throw new ServerException('Operation failed: ' . $e->getMessage(), [
                'operation' => $operation,
                'errorCode' => $e->errorcode,
                'module' => $e->module ?? 'moodle'
            ]);
        }
    }
    
    /**
     * Handle PUT requests - not supported for this endpoint.
     *
     * @throws MethodNotAllowedException Always throws as PUT is not supported
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method not supported for bulk operations', [
            'supportedMethods' => ['POST']
        ]);
    }
    
    /**
     * Handle DELETE requests - not supported for this endpoint.
     *
     * @throws MethodNotAllowedException Always throws as DELETE is not supported
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method not supported for bulk operations', [
            'supportedMethods' => ['POST']
        ]);
    }
    
    /**
     * Process delete operation for multiple users.
     *
     * Deletes user accounts using Moodle's delete_user() function.
     * Validates that users are not admins, not already deleted, and not the current user.
     * Performs session garbage collection after processing.
     *
     * @param array $userids Array of user IDs to delete
     * @return array Results with total, successful, failed counts and detailed results
     */
    private function processDeleteOperation(array $userids) {
        global $DB, $USER;
        
        $results = [
            'total' => count($userids),
            'successful' => 0,
            'failed' => 0,
            'results' => []
        ];
        
        // Get all users in a single query for efficiency
        list($insql, $params) = $DB->get_in_or_equal($userids);
        $users = $DB->get_records_select('user', "id $insql AND deleted = 0", $params);
        
        foreach ($userids as $userid) {
            $result = [
                'userid' => $userid,
                'success' => false,
                'message' => ''
            ];
            
            // Check if user exists and is not already deleted
            if (!isset($users[$userid])) {
                $result['message'] = 'User not found or already deleted';
                $results['failed']++;
                $results['results'][] = $result;
                continue;
            }
            
            $user = $users[$userid];
            
            // Prevent deletion of admin users
            if (is_siteadmin($user)) {
                $result['message'] = 'Cannot delete admin user';
                $results['failed']++;
                $results['results'][] = $result;
                continue;
            }
            
            // Prevent users from deleting themselves
            if ($USER->id == $user->id) {
                $result['message'] = 'Cannot delete your own account';
                $results['failed']++;
                $results['results'][] = $result;
                continue;
            }
            
            // Delete user using existing Moodle function
            if (delete_user($user)) {
                $result['success'] = true;
                $result['message'] = 'User deleted successfully';
                $results['successful']++;
            } else {
                $result['message'] = 'Failed to delete user';
                $results['failed']++;
            }
            
            $results['results'][] = $result;
        }
        
        // Perform session garbage collection to remove stale sessions
        \core\session\manager::gc();
        
        return $results;
    }
    
    /**
     * Process suspend/unsuspend operation for multiple users.
     *
     * Sets the suspended field for user accounts. Validates that users exist
     * and are not already deleted.
     *
     * @param array $userids Array of user IDs to suspend/unsuspend
     * @param bool $suspend True to suspend, false to unsuspend
     * @return array Results with total, successful, failed counts and detailed results
     */
    private function processSuspendOperation(array $userids, $suspend) {
        global $DB;
        
        $results = [
            'total' => count($userids),
            'successful' => 0,
            'failed' => 0,
            'results' => []
        ];
        
        $suspendValue = $suspend ? 1 : 0;
        $operation = $suspend ? 'suspended' : 'unsuspended';
        
        // Get all users in a single query
        list($insql, $params) = $DB->get_in_or_equal($userids);
        $users = $DB->get_records_select('user', "id $insql AND deleted = 0", $params, '', 'id,suspended');
        
        foreach ($userids as $userid) {
            $result = [
                'userid' => $userid,
                'success' => false,
                'message' => ''
            ];
            
            // Check if user exists
            if (!isset($users[$userid])) {
                $result['message'] = 'User not found or already deleted';
                $results['failed']++;
                $results['results'][] = $result;
                continue;
            }
            
            // Update suspended field using Moodle's database API
            try {
                $DB->set_field('user', 'suspended', $suspendValue, ['id' => $userid]);
                $result['success'] = true;
                $result['message'] = "User {$operation} successfully";
                $results['successful']++;
            } catch (Exception $e) {
                $result['message'] = "Failed to {$operation} user: " . $e->getMessage();
                $results['failed']++;
            }
            
            $results['results'][] = $result;
        }
        
        return $results;
    }
    
    /**
     * Process confirm operation for multiple users.
     *
     * Confirms user accounts using the authentication plugin's user_confirm() method.
     * Only processes users that are not already confirmed. Uses the auth plugin
     * to handle the confirmation process according to the authentication method.
     *
     * @param array $userids Array of user IDs to confirm
     * @return array Results with total, successful, failed counts and detailed results
     */
    private function processConfirmOperation(array $userids) {
        global $DB;
        
        $results = [
            'total' => count($userids),
            'successful' => 0,
            'failed' => 0,
            'results' => []
        ];
        
        // Get all users with required fields for confirmation
        list($insql, $params) = $DB->get_in_or_equal($userids);
        $users = $DB->get_records_select('user', "id $insql", $params, '', 
                                        'id,username,secret,confirmed,auth,firstname,lastname');
        
        foreach ($userids as $userid) {
            $result = [
                'userid' => $userid,
                'success' => false,
                'message' => ''
            ];
            
            // Check if user exists
            if (!isset($users[$userid])) {
                $result['message'] = 'User not found';
                $results['failed']++;
                $results['results'][] = $result;
                continue;
            }
            
            $user = $users[$userid];
            
            // Skip if already confirmed
            if ($user->confirmed) {
                $result['success'] = true;
                $result['message'] = 'User already confirmed';
                $results['successful']++;
                $results['results'][] = $result;
                continue;
            }
            
            // Get authentication plugin for this user
            $auth = get_auth_plugin($user->auth);
            
            if (!$auth) {
                $result['message'] = 'Authentication plugin not available';
                $results['failed']++;
                $results['results'][] = $result;
                continue;
            }
            
            // Attempt to confirm user via authentication plugin
            $confirmResult = $auth->user_confirm($user->username, $user->secret);
            
            if ($confirmResult == AUTH_CONFIRM_OK || $confirmResult == AUTH_CONFIRM_ALREADY) {
                $result['success'] = true;
                $result['message'] = 'User confirmed successfully';
                $results['successful']++;
            } else {
                $result['message'] = 'User confirmation failed';
                $results['failed']++;
            }
            
            $results['results'][] = $result;
        }
        
        return $results;
    }
    
    /**
     * Process force password change operation for multiple users.
     *
     * Sets the auth_forcepasswordchange preference for users whose authentication
     * plugin supports password changes. Processes users in batches to prevent
     * memory exhaustion with large user sets. Only affects users with authentication
     * methods that support internal password changes.
     *
     * @param array $userids Array of user IDs to force password change
     * @return array Results with total, successful, failed counts and detailed results
     */
    private function processForcePasswordChangeOperation(array $userids) {
        global $DB;
        
        $results = [
            'total' => count($userids),
            'successful' => 0,
            'failed' => 0,
            'results' => []
        ];
        
        // Get list of authentication plugins that support password changes
        $authsavailable = get_enabled_auth_plugins();
        $changeable = [];
        
        foreach ($authsavailable as $authplugin) {
            $auth = get_auth_plugin($authplugin);
            if (!$auth) {
                continue;
            }
            
            // Check if auth plugin supports internal password changes
            if ($auth->is_internal() && $auth->can_change_password()) {
                $changeable[$authplugin] = true;
            }
        }
        
        // Process users in batches to prevent memory issues
        $batches = array_chunk($userids, self::BATCH_SIZE);
        
        foreach ($batches as $batch) {
            // Get users in this batch
            list($insql, $params) = $DB->get_in_or_equal($batch);
            $users = $DB->get_records_select('user', "id $insql", $params, '', 'id,auth,firstname,lastname');
            
            foreach ($batch as $userid) {
                $result = [
                    'userid' => $userid,
                    'success' => false,
                    'message' => ''
                ];
                
                // Check if user exists
                if (!isset($users[$userid])) {
                    $result['message'] = 'User not found';
                    $results['failed']++;
                    $results['results'][] = $result;
                    continue;
                }
                
                $user = $users[$userid];
                
                // Check if user's auth plugin supports password changes
                if (!isset($changeable[$user->auth])) {
                    $result['message'] = 'User authentication method does not support password changes';
                    $results['failed']++;
                    $results['results'][] = $result;
                    continue;
                }
                
                // Set user preference to force password change on next login
                try {
                    set_user_preference('auth_forcepasswordchange', 1, $userid);
                    $result['success'] = true;
                    $result['message'] = 'Password change will be required on next login';
                    $results['successful']++;
                } catch (Exception $e) {
                    $result['message'] = 'Failed to set password change preference: ' . $e->getMessage();
                    $results['failed']++;
                }
                
                $results['results'][] = $result;
            }
        }
        
        return $results;
    }
}

// Execute the endpoint
// Skip auto-execution in test mode to allow manual instantiation
if (!defined('API_TEST_MODE') || !API_TEST_MODE) {
    $endpoint = new BulkUserEndpoint();
    $endpoint->execute();
}
