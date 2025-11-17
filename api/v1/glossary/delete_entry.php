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
 * REST API endpoint for deleting glossary entries.
 *
 * This endpoint provides DELETE /api/v1/glossary/entries/{id} functionality
 * for removing glossary entries from the system. It validates deletion
 * permissions via mod_glossary_can_delete_entry() and delegates the actual
 * deletion to mod_glossary_delete_entry() which handles cascade deletion
 * of all associated data including attachments, ratings, comments, tags,
 * and aliases.
 *
 * Permission Requirements:
 * - User must have mod/glossary:manageentries capability OR
 * - User must be the entry author within the allowed editing time window
 *
 * Cascade Deletion Handles:
 * - Entry record from glossary_entries table
 * - All file attachments via file storage API
 * - Associated ratings via rating manager
 * - Associated comments via comment API
 * - Entry category associations from glossary_entries_categories
 * - Associated tags via tag API
 * - Entry aliases from glossary_alias table
 * - Completion status updates
 * - Grade updates (if applicable)
 * - Concept cache reset
 *
 * Request Format:
 *   DELETE /api/v1/glossary/entries/{id}
 *   Headers:
 *     Authorization: Bearer {jwt_token}
 *
 * Success Response (200 OK):
 *   {
 *     "success": true,
 *     "data": {
 *       "result": true,
 *       "message": "Entry deleted successfully"
 *     }
 *   }
 *
 * Error Responses:
 *   403 Forbidden: User lacks permission to delete the entry
 *   404 Not Found: Entry does not exist
 *   500 Internal Server Error: Unexpected deletion failure
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
 * API endpoint class for glossary entry deletion.
 *
 * This class extends ApiBase to provide DELETE operation for glossary entries.
 * It validates user permissions, delegates to existing Moodle business logic,
 * and returns standardized JSON responses.
 *
 * The endpoint follows the thin wrapper pattern, calling existing Moodle
 * functions without duplicating business logic. All permission checks and
 * deletion operations are performed by core glossary functions to ensure
 * consistency with the PHP interface.
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class GlossaryDeleteEntryEndpoint extends ApiBase {
    
    /**
     * Handle DELETE requests for glossary entry deletion.
     *
     * This method processes DELETE requests to /api/v1/glossary/entries/{id}.
     * It extracts the entry ID from the URI, validates permissions, and
     * delegates the deletion to mod_glossary_delete_entry() which handles
     * all cascade operations.
     *
     * Process Flow:
     * 1. Extract entry ID from request URI
     * 2. Retrieve entry record from database
     * 3. Validate glossary exists and get context
     * 4. Check deletion permission (capability or ownership)
     * 5. Perform deletion with cascade operations
     * 6. Return success response
     *
     * Permission Validation:
     * - Checks mod/glossary:manageentries capability OR
     * - Verifies user is entry author within allowed editing time
     *
     * Cascade Deletion Operations:
     * - Removes entry record from glossary_entries table
     * - Deletes all file attachments
     * - Removes associated ratings
     * - Deletes associated comments
     * - Clears entry category associations
     * - Removes associated tags
     * - Deletes entry aliases
     * - Triggers entry_deleted event
     * - Updates completion status
     * - Updates grades (if applicable)
     * - Resets concept cache
     *
     * @return void Outputs JSON response and exits
     * @throws NotFoundException If entry does not exist
     * @throws ForbiddenException If user lacks deletion permission
     * @throws ServerException If deletion operation fails unexpectedly
     */
    protected function handle_delete() {
        global $DB, $CFG;
        
        // Load Moodle glossary libraries
        require_once($CFG->dirroot . '/mod/glossary/lib.php');
        require_once($CFG->dirroot . '/mod/glossary/classes/external.php');
        
        try {
            // Extract entry ID from request URI
            // Expected URI format: /api/v1/glossary/entries/{id}
            $entryid = $this->parseIdFromUri();
            
            if (!$entryid || !is_numeric($entryid)) {
                throw new BadRequestException('Invalid entry ID format');
            }
            
            // Retrieve entry record from database
            // Using MUST_EXIST flag will throw exception if not found
            $entry = $DB->get_record('glossary_entries', ['id' => $entryid], '*', IGNORE_MISSING);
            
            if (!$entry) {
                throw new NotFoundException('Entry not found', [
                    'entryId' => $entryid
                ]);
            }
            
            // Validate glossary and get context, course, and course module
            // This uses the external API validation method to ensure consistency
            try {
                list($glossary, $context, $course, $cm) = mod_glossary_external::validate_glossary($entry->glossaryid);
            } catch (Exception $e) {
                // If glossary validation fails, the glossary might have been deleted
                throw new NotFoundException('Associated glossary not found', [
                    'glossaryId' => $entry->glossaryid,
                    'originalError' => $e->getMessage()
                ]);
            }
            
            // Verify the entry belongs to the glossary from the course module
            // This prevents deletion attempts via incorrect course module IDs
            if ($cm->instance != $entry->glossaryid) {
                throw new BadRequestException('Entry does not belong to the specified glossary', [
                    'entryGlossaryId' => $entry->glossaryid,
                    'cmGlossaryId' => $cm->instance
                ]);
            }
            
            // Check deletion permission using Moodle's built-in permission checker
            // This function verifies either:
            // 1. User has mod/glossary:manageentries capability, OR
            // 2. User is the entry author and within allowed editing time window
            // The function throws moodle_exception if permission is denied
            try {
                mod_glossary_can_delete_entry($entry, $glossary, $context, false);
            } catch (moodle_exception $e) {
                // Permission check failed - user cannot delete this entry
                throw new ForbiddenException('You do not have permission to delete this entry', [
                    'entryId' => $entryid,
                    'userId' => $this->getUser()->id,
                    'requiredCapability' => 'mod/glossary:manageentries',
                    'originalError' => $e->getMessage()
                ]);
            }
            
            // Perform the actual deletion using Moodle's core function
            // This function handles all cascade operations:
            // - Deletes entry record from glossary_entries table
            // - Removes all file attachments via get_file_storage()->delete_area_files()
            // - Deletes associated ratings via rating_manager
            // - Removes comments via comment API
            // - Clears entry categories from glossary_entries_categories
            // - Removes tags via core_tag_tag::remove_all_item_tags()
            // - Deletes entry aliases from glossary_alias table
            // - Triggers \mod_glossary\event\entry_deleted event
            // - Updates completion status via $completion->update_state()
            // - Updates grade if applicable via glossary_update_grades()
            // - Resets concept cache for the glossary
            try {
                // The hook and prevmode parameters are used for PHP UI redirects
                // For API calls, we pass empty values as they are not needed
                $hook = '';
                $prevmode = '';
                
                // Call the core deletion function
                mod_glossary_delete_entry($entry, $glossary, $cm, $context, $course, $hook, $prevmode);
                
            } catch (Exception $e) {
                // Deletion operation failed unexpectedly
                // This could be due to database errors, file system issues, etc.
                throw new ServerException('Failed to delete entry', [
                    'entryId' => $entryid,
                    'glossaryId' => $entry->glossaryid,
                    'originalError' => $e->getMessage(),
                    'errorFile' => $e->getFile(),
                    'errorLine' => $e->getLine()
                ]);
            }
            
            // Log the successful deletion for audit trail
            // This helps with troubleshooting and security auditing
            if (debugging('', DEBUG_NORMAL)) {
                debugging("API: Glossary entry {$entryid} deleted successfully by user {$this->getUser()->id}", DEBUG_DEVELOPER);
            }
            
            // Return success response with confirmation message
            // The response follows the standard API envelope format
            $this->success([
                'result' => true,
                'message' => 'Entry deleted successfully',
                'entryId' => $entryid
            ]);
            
        } catch (ApiException $e) {
            // Re-throw API exceptions to be handled by ApiBase
            throw $e;
            
        } catch (moodle_exception $e) {
            // Convert Moodle exceptions to appropriate API exceptions
            // This ensures consistent error response format
            
            // Check if it's a permission-related exception
            if (strpos($e->getMessage(), 'nopermission') !== false || 
                strpos($e->getMessage(), 'capability') !== false) {
                throw new ForbiddenException($e->getMessage(), [
                    'originalError' => $e->getMessage(),
                    'errorCode' => $e->errorcode
                ]);
            }
            
            // Check if it's a not-found exception
            if (strpos($e->getMessage(), 'notfound') !== false || 
                strpos($e->getMessage(), 'invalid') !== false) {
                throw new NotFoundException($e->getMessage(), [
                    'originalError' => $e->getMessage(),
                    'errorCode' => $e->errorcode
                ]);
            }
            
            // Default to server error for other Moodle exceptions
            throw new ServerException('An error occurred while processing your request', [
                'originalError' => $e->getMessage(),
                'errorCode' => $e->errorcode,
                'debugInfo' => $e->debuginfo ?? null
            ]);
            
        } catch (Exception $e) {
            // Catch any other unexpected exceptions
            // This is a safety net for truly unexpected errors
            throw new ServerException('Unexpected error occurred', [
                'originalError' => $e->getMessage(),
                'errorType' => get_class($e),
                'errorFile' => $e->getFile(),
                'errorLine' => $e->getLine()
            ]);
        }
    }
    
    /**
     * Extract entry ID from request URI.
     *
     * This helper method parses the request URI to extract the glossary entry ID.
     * Expected URI format: /api/v1/glossary/entries/{id}
     *
     * The method handles various URI formats including:
     * - /api/v1/glossary/entries/123
     * - /api/v1/glossary/entries/123/
     * - With query parameters: /api/v1/glossary/entries/123?param=value
     *
     * @return int|null The extracted entry ID or null if not found
     */
    private function parseIdFromUri() {
        // Get the request URI from server variables
        $requestUri = $_SERVER['REQUEST_URI'] ?? '';
        
        // Remove query string if present
        $uriPath = parse_url($requestUri, PHP_URL_PATH);
        
        // Expected pattern: /api/v1/glossary/entries/{id}
        // Use regex to extract the ID from the URI
        if (preg_match('#/api/v1/glossary/entries/(\d+)#', $uriPath, $matches)) {
            return (int) $matches[1];
        }
        
        // Alternative: check if ID is in the last segment
        $segments = explode('/', trim($uriPath, '/'));
        $lastSegment = end($segments);
        
        if (is_numeric($lastSegment)) {
            return (int) $lastSegment;
        }
        
        return null;
    }
    
    /**
     * Handle GET request - Not supported for glossary delete endpoint
     *
     * Glossary entry retrieval is handled through other endpoints.
     * This endpoint is specifically for deleting entries via DELETE.
     *
     * @throws MethodNotAllowedException Always throws as GET is not supported
     */
    protected function handle_get() {
        throw new MethodNotAllowedException('GET method not supported for glossary delete endpoint', [
            'allowed_methods' => ['DELETE'],
            'endpoint' => '/api/v1/glossary/entries/{id}'
        ]);
    }
    
    /**
     * Handle POST request - Not supported for glossary delete endpoint
     *
     * Creating new glossary entries is handled through a separate endpoint.
     * This endpoint is specifically for deleting existing entries via DELETE.
     *
     * @throws MethodNotAllowedException Always throws as POST is not supported
     */
    protected function handle_post() {
        throw new MethodNotAllowedException('POST method not supported for glossary delete endpoint', [
            'allowed_methods' => ['DELETE'],
            'endpoint' => '/api/v1/glossary/entries/{id}'
        ]);
    }
    
    /**
     * Handle PUT request - Not supported for glossary delete endpoint
     *
     * Updating glossary entries is handled through a separate endpoint.
     * This endpoint is specifically for deleting existing entries via DELETE.
     *
     * @throws MethodNotAllowedException Always throws as PUT is not supported
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method not supported for glossary delete endpoint', [
            'allowed_methods' => ['DELETE'],
            'endpoint' => '/api/v1/glossary/entries/{id}'
        ]);
    }
}

// Instantiate and execute the endpoint
if (!defined('API_TEST_MODE')) {
    $endpoint = new GlossaryDeleteEntryEndpoint();
    $endpoint->execute();
}
