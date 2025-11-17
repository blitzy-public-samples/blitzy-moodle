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
 * REST API endpoint for updating existing glossary entries.
 *
 * This endpoint provides a RESTful interface for updating glossary entries including
 * concept, definition, attachments, categories, and link settings. It validates user
 * update permissions, checks for duplicate concepts when concept changes, prepares
 * entry for editing with existing data preservation, handles file upload updates,
 * and delegates to glossary_edit_entry function for database updates and event triggering.
 * Supports partial updates preserving unchanged fields.
 *
 * Endpoint: PUT /api/v1/glossary/entries/{id}
 *
 * Request format (JSON body):
 * {
 *   "concept": "Updated Term",
 *   "definition": "Updated definition text",
 *   "definitionformat": 1,
 *   "options": {
 *     "inlineattachmentsid": 123456789,
 *     "attachmentsid": 987654321,
 *     "categories": [1, 3, 5],
 *     "aliases": "synonym1,synonym2",
 *     "usedynalink": true,
 *     "casesensitive": false,
 *     "fullmatch": true
 *   }
 * }
 *
 * Response format:
 * {
 *   "success": true,
 *   "data": {
 *     "result": true,
 *     "entryid": 42,
 *     "timemodified": 1640000000
 *   }
 * }
 *
 * Error responses:
 * - 404 NOT_FOUND: Entry does not exist
 * - 403 FORBIDDEN: User lacks permission to update entry (not owner, time expired, or no capability)
 * - 400 VALIDATION_ERROR: Duplicate concept detected when concept changes
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
 * API endpoint class for updating glossary entries.
 *
 * This class extends ApiBase to inherit JWT authentication, request routing,
 * parameter validation, and response formatting. It implements the handle_put()
 * method to process PUT requests for updating glossary entries via the
 * /api/v1/glossary/entries/{id} route.
 *
 * The endpoint wraps existing Moodle glossary functions without duplicating
 * business logic, following the thin wrapper pattern mandated for all API endpoints.
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class GlossaryUpdateEntryEndpoint extends ApiBase {

    /**
     * Handle PUT requests to update existing glossary entries.
     *
     * This method processes PUT requests to /api/v1/glossary/entries/{id} by:
     * 1. Extracting entry ID from request URI
     * 2. Parsing JSON request body to get updated field values
     * 3. Retrieving existing entry from database
     * 4. Validating glossary, context, course, and course module
     * 5. Checking update permission via mod_glossary_can_update_entry()
     * 6. Checking for duplicate concepts if concept changes
     * 7. Preparing entry for editing with existing data loaded
     * 8. Updating entry fields and processing options
     * 9. Delegating to glossary_edit_entry() for database update
     * 10. Returning success response with entry ID and timestamp
     *
     * All business logic is delegated to existing Moodle functions:
     * - mod_glossary_external::validate_glossary() for context validation
     * - mod_glossary_can_update_entry() for permission checking
     * - glossary_concept_exists() for duplicate detection
     * - mod_glossary_prepare_entry_for_edition() for data preparation
     * - glossary_edit_entry() for database updates and event triggering
     *
     * @return void Outputs JSON response via $this->success() or throws ApiException
     * @throws NotFoundException If glossary entry with specified ID does not exist
     * @throws ForbiddenException If user lacks permission to update entry
     * @throws ValidationException If duplicate concept detected and not allowed
     */
    protected function handle_put() {
        global $DB, $CFG;

        // Load Moodle glossary libraries
        require_once($CFG->dirroot . '/mod/glossary/lib.php');
        require_once($CFG->dirroot . '/lib/filelib.php');

        // Extract entry ID from request URI
        // Expected URI format: /api/v1/glossary/entries/{id}
        $entryid = $this->parseIdFromUri();
        
        if (!$entryid || $entryid <= 0) {
            throw new ValidationException('Invalid entry ID', ['entryid' => $entryid]);
        }

        // Parse JSON request body to extract update parameters
        $body = $this->getJsonBody();
        
        // Extract required fields from request body
        $concept = isset($body['concept']) ? trim($body['concept']) : null;
        $definition = isset($body['definition']) ? $body['definition'] : null;
        $definitionformat = isset($body['definitionformat']) ? (int)$body['definitionformat'] : FORMAT_HTML;
        $options = isset($body['options']) ? $body['options'] : [];

        // Validate required fields
        if ($concept === null || $concept === '') {
            throw new ValidationException('Concept is required', ['field' => 'concept']);
        }
        
        if ($definition === null) {
            throw new ValidationException('Definition is required', ['field' => 'definition']);
        }

        // Retrieve existing entry from database
        // Use MUST_EXIST equivalent by checking result explicitly
        $entry = $DB->get_record('glossary_entries', ['id' => $entryid], '*');
        
        if (!$entry) {
            throw new NotFoundException('Glossary entry not found', ['entryid' => $entryid]);
        }

        // Validate glossary and get context, course, and course module
        // This function throws exception if glossary doesn't exist or user lacks view access
        list($glossary, $context, $course, $cm) = mod_glossary_external::validate_glossary($entry->glossaryid);

        // Check if user has permission to update this entry
        // Checks: user is owner AND within edit time window, OR has mod/glossary:manageentries
        // Setting return=false makes it throw exception on failure
        try {
            mod_glossary_can_update_entry($entry, $glossary, $context, $cm, false);
        } catch (moodle_exception $e) {
            // Convert Moodle exception to API exception
            throw new ForbiddenException(
                'You do not have permission to update this entry',
                [
                    'reason' => $e->getMessage(),
                    'entryid' => $entryid,
                    'userid' => $this->getUser()->id,
                    'ownerid' => $entry->userid
                ]
            );
        }

        // Check for duplicate concepts if the concept is being changed
        // Only check if glossary doesn't allow duplicates
        if (!$glossary->allowduplicatedentries) {
            // Compare concepts case-insensitively
            $existingConceptLower = core_text::strtolower($entry->concept);
            $newConceptLower = core_text::strtolower($concept);
            
            // Only check for duplicates if concept actually changed
            if ($existingConceptLower !== $newConceptLower) {
                if (glossary_concept_exists($glossary, $concept)) {
                    throw new ValidationException(
                        get_string('errconceptalreadyexists', 'glossary'),
                        [
                            'concept' => $concept,
                            'glossaryid' => $glossary->id
                        ]
                    );
                }
            }
        }

        // Prepare entry for editing by loading existing aliases and categories
        // This populates $entry->aliases and $entry->categories from database
        $entry->aliases = '';  // Initialize to empty before loading
        $entry = mod_glossary_prepare_entry_for_edition($entry);

        // Update entry fields with new values
        $entry->concept = $concept;
        
        // Set up definition editor array format expected by glossary_edit_entry()
        $entry->definition_editor = [
            'text' => $definition,
            'format' => $definitionformat,
        ];
        
        // Update modification timestamp
        $entry->timemodified = time();

        // Process optional parameters
        // Handle inlineattachmentsid for definition inline attachments
        if (isset($options['inlineattachmentsid'])) {
            $entry->definition_editor['itemid'] = clean_param($options['inlineattachmentsid'], PARAM_INT);
        }

        // Handle attachmentsid for separate file attachments
        if (isset($options['attachmentsid'])) {
            $entry->attachment_filemanager = clean_param($options['attachmentsid'], PARAM_INT);
        }

        // Handle categories - convert to array format
        if (isset($options['categories'])) {
            if (is_array($options['categories'])) {
                // Already an array, clean each value
                $entry->categories = array_map(function($cat) {
                    return clean_param($cat, PARAM_INT);
                }, $options['categories']);
            } else {
                // Comma-separated string, convert to array
                $categoriesStr = clean_param($options['categories'], PARAM_SEQUENCE);
                $entry->categories = array_filter(explode(',', $categoriesStr));
            }
        }

        // Handle aliases - convert from comma-separated to newline-separated format
        // glossary_edit_entry expects aliases separated by newlines
        if (isset($options['aliases'])) {
            $aliases = clean_param($options['aliases'], PARAM_NOTAGS);
            // Convert comma-separated to newline-separated
            $entry->aliases = str_replace(',', "\n", $aliases);
        }

        // Handle dynamic linking options (usedynalink, casesensitive, fullmatch)
        // These are only allowed if the glossary has dynamic linking enabled
        if ($glossary->usedynalink) {
            if (isset($options['usedynalink'])) {
                $entry->usedynalink = clean_param($options['usedynalink'], PARAM_BOOL);
            }
            
            if (isset($options['casesensitive'])) {
                $entry->casesensitive = clean_param($options['casesensitive'], PARAM_BOOL);
            }
            
            if (isset($options['fullmatch'])) {
                $entry->fullmatch = clean_param($options['fullmatch'], PARAM_BOOL);
            }
        }

        // Delegate to existing glossary_edit_entry function for:
        // - Database update of glossary_entries record
        // - File processing (definition inline attachments and separate attachments)
        // - Category association updates in glossary_entries_categories
        // - Alias updates in glossary_alias table
        // - Event triggering (entry_updated event)
        // - Completion tracking updates
        // - Concept cache invalidation
        // This function returns the updated entry object with refreshed data
        $entry = glossary_edit_entry($entry, $course, $cm, $glossary, $context);

        // Return success response with entry ID and modification timestamp
        $this->success([
            'result' => true,
            'entryid' => $entry->id,
            'timemodified' => $entry->timemodified
        ]);
    }

    /**
     * Extract entry ID from request URI.
     *
     * Parses the REQUEST_URI to extract the numeric entry ID from the path.
     * Expected URI format: /api/v1/glossary/entries/{id}
     *
     * This method handles various URI formats:
     * - /api/v1/glossary/entries/42
     * - /api/v1/glossary/entries/42/
     * - /api/v1/glossary/entries/42?param=value
     *
     * @return int|null Entry ID extracted from URI, or null if not found
     */
    private function parseIdFromUri() {
        // Get the request URI
        $requestUri = $_SERVER['REQUEST_URI'];
        
        // Remove query string if present
        $path = strtok($requestUri, '?');
        
        // Remove trailing slash if present
        $path = rtrim($path, '/');
        
        // Extract ID from path: /api/v1/glossary/entries/{id}
        // Split by / and get the last segment
        $segments = explode('/', $path);
        
        // The ID should be the last segment
        $id = end($segments);
        
        // Validate that it's a numeric ID
        if (is_numeric($id) && $id > 0) {
            return (int)$id;
        }
        
        return null;
    }
    
    /**
     * Handle GET request - Not supported for glossary update endpoint
     *
     * Glossary entry retrieval is handled through other endpoints.
     * This endpoint is specifically for updating entries via PUT.
     *
     * @throws MethodNotAllowedException Always throws as GET is not supported
     */
    protected function handle_get() {
        throw new MethodNotAllowedException('GET method not supported for glossary update endpoint', [
            'allowed_methods' => ['PUT'],
            'endpoint' => '/api/v1/glossary/entries/{id}'
        ]);
    }
    
    /**
     * Handle POST request - Not supported for glossary update endpoint
     *
     * Creating new glossary entries is handled through a separate endpoint.
     * This endpoint is specifically for updating existing entries via PUT.
     *
     * @throws MethodNotAllowedException Always throws as POST is not supported
     */
    protected function handle_post() {
        throw new MethodNotAllowedException('POST method not supported for glossary update endpoint', [
            'allowed_methods' => ['PUT'],
            'endpoint' => '/api/v1/glossary/entries/{id}'
        ]);
    }
    
    /**
     * Handle DELETE request - Not supported for glossary update endpoint
     *
     * Deleting glossary entries is handled through a separate endpoint.
     * This endpoint is specifically for updating existing entries via PUT.
     *
     * @throws MethodNotAllowedException Always throws as DELETE is not supported
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method not supported for glossary update endpoint', [
            'allowed_methods' => ['PUT'],
            'endpoint' => '/api/v1/glossary/entries/{id}'
        ]);
    }
}

// Instantiate and execute the endpoint
if (!defined('API_TEST_MODE')) {
    $endpoint = new GlossaryUpdateEntryEndpoint();
    $endpoint->execute();
}
