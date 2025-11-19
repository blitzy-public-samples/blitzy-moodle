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
 * REST API endpoint for deleting Moodle user accounts.
 *
 * Handles DELETE requests to /api/v1/admin/users/{id} for soft-deleting user accounts.
 * Implements comprehensive validation including admin account protection, already-deleted
 * checks, and self-deletion prevention. Delegates all business logic to existing Moodle
 * delete_user() function following thin wrapper pattern.
 *
 * Soft-delete process (via delete_user()):
 * - Sets deleted=1 flag in user record
 * - Moves email to suspendedmail field
 * - Renames username with timestamp suffix
 * - Removes user from all cohorts and groups
 * - Unenrols user from all courses
 * - Clears user sessions
 * - Triggers user_deleted event for observers
 *
 * Protected accounts (cannot be deleted):
 * - Site administrator accounts (is_siteadmin() check)
 * - Currently logged-in user (self-deletion prevention)
 * - Guest user account (system requirement)
 *
 * Authorization:
 * - Requires moodle/user:delete capability in system context
 * - Enforced via checkCapability() before any operations
 * - JWT token authentication required (via ApiBase)
 *
 * Error handling:
 * - 404 Not Found: User ID does not exist or invalid
 * - 400 Bad Request: User is already deleted
 * - 403 Forbidden: Attempting to delete admin account or self-deletion
 * - 403 Forbidden: Missing moodle/user:delete capability
 * - 500 Internal Server Error: Unexpected errors during deletion
 *
 * Response format (success):
 * {
 *   "success": true,
 *   "data": {
 *     "id": 123,
 *     "username": "jsmith_1638547200",
 *     "fullname": "John Smith",
 *     "deleted": 1,
 *     "timemodified": 1638547200,
 *     "message": "User John Smith has been successfully deleted"
 *   }
 * }
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Load Moodle configuration
require_once(__DIR__ . '/../../../../config.php');

// Load API base class and dependencies
require_once(__DIR__ . '/../../../lib/api_base.php');
require_once(__DIR__ . '/../../../lib/api_exception.php');

/**
 * User deletion API endpoint class.
 *
 * Extends ApiBase to provide DELETE operation for user accounts with
 * comprehensive validation and protection against accidental deletion
 * of critical accounts. All business logic delegated to existing
 * delete_user() function from moodlelib.php.
 */
class UserDeleteEndpoint extends ApiBase {
    
    /**
     * Handle DELETE request to soft-delete a user account.
     *
     * Extracts user ID from request URI, validates user exists and is eligible
     * for deletion, enforces capability checks, prevents deletion of protected
     * accounts, and delegates to delete_user() for soft-delete operation.
     *
     * Request URI pattern: /api/v1/admin/users/{id}
     * 
     * Validation checks performed (in order):
     * 1. Extract valid user ID from URI path
     * 2. Enforce moodle/user:delete capability in system context
     * 3. Verify user record exists with mnethostid check
     * 4. Verify user is not already deleted (deleted=0)
     * 5. Prevent deletion of site administrator accounts
     * 6. Prevent self-deletion by current user
     * 7. Store user details before deletion for response message
     * 8. Execute soft-delete via delete_user()
     * 9. Trigger session garbage collection
     * 10. Return success response with deleted user details
     *
     * @return void Outputs JSON response directly via success() method
     * @throws NotFoundException If user ID is invalid or user does not exist
     * @throws ValidationException If user is already deleted
     * @throws ForbiddenException If attempting to delete admin account or own account
     * @throws ForbiddenException If user lacks moodle/user:delete capability
     * @throws ServerException If unexpected error occurs during deletion
     */
    protected function handle_delete() {
        global $DB, $CFG;
        
        try {
            // Extract user ID from request URI using regex pattern matching
            // Expected URI format: /api/v1/admin/users/{id}
            // Captures numeric ID from final path segment
            $userid = null;
            if (preg_match('#/admin/users/(\d+)#', $this->requestUri, $matches)) {
                $userid = (int)$matches[1];
            }
            
            // Validate that user ID was successfully extracted from URI
            if (!$userid) {
                throw new NotFoundException('Invalid user ID in request path', [
                    'requestUri' => $this->requestUri,
                    'expectedPattern' => '/api/v1/admin/users/{id}',
                    'reason' => 'User ID must be a positive integer'
                ]);
            }
            
            // Enforce moodle/user:delete capability in system context
            // This is the primary authorization check - user must have permission
            // to delete users at the system level (typically admins and user managers)
            $this->checkCapability('moodle/user:delete', context_system::instance());
            
            // Retrieve user record from database with mnethostid check
            // MUST_EXIST flag causes exception if user not found
            // mnethostid check ensures we only delete local users, not MNet remote users
            try {
                $user = $DB->get_record('user', [
                    'id' => $userid,
                    'mnethostid' => $CFG->mnet_localhost_id
                ], '*', MUST_EXIST);
                
            } catch (moodle_exception $e) {
                // Convert Moodle's dml_missing_record_exception to NotFoundException
                throw new NotFoundException("User with ID {$userid} not found", [
                    'userId' => $userid,
                    'reason' => 'User does not exist or is from a remote MNet host',
                    'originalError' => $e->getMessage()
                ]);
            }
            
            // Check if user is already deleted (deleted flag = 1)
            // Attempting to delete an already-deleted user is a validation error
            // This prevents redundant operations and provides clear feedback
            if ($user->deleted == 1) {
                throw new ValidationException('User is already deleted', [
                    'userId' => $userid,
                    'username' => $user->username,
                    'deletedAt' => $user->timemodified,
                    'reason' => 'This user account has already been marked as deleted'
                ]);
            }
            
            // Prevent deletion of site administrator accounts
            // Site admins have elevated privileges and should not be deleted via API
            // This is a critical safety check to prevent accidental system lockout
            if (is_siteadmin($user->id)) {
                throw new ForbiddenException('Cannot delete site administrator accounts', [
                    'userId' => $userid,
                    'username' => $user->username,
                    'reason' => 'Site administrators cannot be deleted for security reasons',
                    'suggestion' => 'Remove administrator role before attempting deletion'
                ]);
            }
            
            // Prevent self-deletion by currently authenticated user
            // Users should not be able to delete their own accounts via API
            // This prevents accidental account loss and maintains audit trail
            $currentUser = $this->getUser();
            if ($user->id === $currentUser->id) {
                throw new ForbiddenException('Cannot delete your own account', [
                    'userId' => $userid,
                    'currentUserId' => $currentUser->id,
                    'reason' => 'Self-deletion is not permitted for security and audit reasons',
                    'suggestion' => 'Ask another administrator to delete your account'
                ]);
            }
            
            // Store user details before deletion for response message
            // fullname($user, true) returns formatted full name with all name fields
            // These values will be included in success response for confirmation
            $fullname = fullname($user, true);
            $username = $user->username;
            $userid_stored = $user->id;
            
            // Execute soft-delete operation by calling existing Moodle function
            // delete_user() performs comprehensive cleanup:
            // - Sets deleted=1 in user record
            // - Moves email to suspendedmail
            // - Renames username with timestamp suffix (username_timestamp)
            // - Removes user from all cohorts via cohort_remove_member()
            // - Removes user from all groups via groups_delete_group_members()
            // - Unenrols user from all courses via enrol_get_instances()
            // - Clears all user sessions via \core\session\manager::kill_user_sessions()
            // - Triggers \core\event\user_deleted event for event observers
            // - Maintains referential integrity (does not cascade delete related records)
            //
            // CRITICAL: This is a thin wrapper - ALL business logic resides in delete_user()
            // No grade calculations, enrollment logic, or permission checks are duplicated here
            $deleteResult = delete_user($user);
            
            // Verify deletion was successful
            // delete_user() returns true on success, false on failure
            if (!$deleteResult) {
                throw new ServerException('Failed to delete user account', [
                    'userId' => $userid,
                    'username' => $username,
                    'reason' => 'delete_user() returned false - check Moodle logs for details'
                ]);
            }
            
            // Trigger session garbage collection to remove stale sessions immediately
            // This ensures deleted user's sessions are cleaned up right away
            // rather than waiting for scheduled cron task
            \core\session\manager::gc();
            
            // Retrieve updated user record to get modified fields
            // After deletion: deleted=1, username has timestamp suffix, email moved
            $deletedUser = $DB->get_record('user', ['id' => $userid_stored]);
            
            // Return success response with deleted user details
            // Include confirmation message with user's full name for clarity
            // Response data includes: id, modified username, original fullname, deleted flag, timestamp
            $this->success([
                'id' => $userid_stored,
                'username' => $deletedUser->username,  // Modified username with timestamp
                'fullname' => $fullname,  // Original full name before deletion
                'deleted' => (int)$deletedUser->deleted,  // Should be 1
                'timemodified' => (int)$deletedUser->timemodified,  // Deletion timestamp
                'message' => "User {$fullname} has been successfully deleted"
            ], 200);
            
        } catch (NotFoundException $e) {
            // Re-throw NotFoundException for proper error response (404)
            throw $e;
            
        } catch (ValidationException $e) {
            // Re-throw ValidationException for proper error response (400)
            throw $e;
            
        } catch (ForbiddenException $e) {
            // Re-throw ForbiddenException for proper error response (403)
            throw $e;
            
        } catch (moodle_exception $e) {
            // Catch any other Moodle exceptions (capability checks, DB errors, etc.)
            // Convert to appropriate API exception based on error type
            if (strpos($e->getMessage(), 'nopermission') !== false || 
                strpos($e->getMessage(), 'accessdenied') !== false) {
                // Permission-related Moodle exceptions become ForbiddenException
                throw new ForbiddenException($e->getMessage(), [
                    'errorcode' => $e->errorcode,
                    'module' => $e->module ?? 'moodle',
                    'originalError' => get_class($e)
                ]);
            } else {
                // All other Moodle exceptions become ServerException
                throw new ServerException($e->getMessage(), [
                    'errorcode' => $e->errorcode,
                    'module' => $e->module ?? 'moodle',
                    'originalError' => get_class($e)
                ]);
            }
            
        } catch (Exception $e) {
            // Catch any unexpected PHP exceptions and convert to ServerException
            // This ensures consistent error response format even for unanticipated errors
            throw new ServerException('An unexpected error occurred during user deletion', [
                'originalError' => $e->getMessage(),
                'errorType' => get_class($e),
                'file' => $e->getFile(),
                'line' => $e->getLine()
            ]);
        }
    }
    
    /**
     * Stub for handle_get() - not implemented for this endpoint.
     *
     * This endpoint only supports DELETE operations. GET requests should be
     * directed to the show.php endpoint for retrieving user details.
     *
     * @throws MethodNotAllowedException Always thrown when GET is attempted
     */
    protected function handle_get() {
        throw new MethodNotAllowedException('GET method not supported on delete endpoint', [
            'method' => 'GET',
            'endpoint' => '/api/v1/admin/users/{id}',
            'suggestion' => 'Use DELETE method to delete user, or GET /api/v1/admin/users/{id} to retrieve user details'
        ]);
    }
    
    /**
     * Stub for handle_post() - not implemented for this endpoint.
     *
     * This endpoint only supports DELETE operations. POST requests should be
     * directed to the create.php endpoint for creating new users.
     *
     * @throws MethodNotAllowedException Always thrown when POST is attempted
     */
    protected function handle_post() {
        throw new MethodNotAllowedException('POST method not supported on delete endpoint', [
            'method' => 'POST',
            'endpoint' => '/api/v1/admin/users/{id}',
            'suggestion' => 'Use DELETE method to delete user, or POST /api/v1/admin/users to create new user'
        ]);
    }
    
    /**
     * Stub for handle_put() - not implemented for this endpoint.
     *
     * This endpoint only supports DELETE operations. PUT requests should be
     * directed to the update.php endpoint for updating user details.
     *
     * @throws MethodNotAllowedException Always thrown when PUT is attempted
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method not supported on delete endpoint', [
            'method' => 'PUT',
            'endpoint' => '/api/v1/admin/users/{id}',
            'suggestion' => 'Use DELETE method to delete user, or PUT /api/v1/admin/users/{id} to update user'
        ]);
    }
}

// Instantiate endpoint and execute request
// ApiBase constructor handles JWT validation and authentication
// execute() method routes to appropriate handler and formats response
// Execute the endpoint if not in test mode
if (!defined('API_TEST_MODE')) {
    $endpoint = new UserDeleteEndpoint();
    $endpoint->execute();
}
