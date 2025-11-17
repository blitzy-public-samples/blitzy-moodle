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
 * REST API endpoint for creating new glossary entries.
 *
 * This endpoint provides a thin wrapper around Moodle's existing glossary_edit_entry()
 * function, enabling React frontend to create glossary entries via REST API.
 * Supports definitions, file attachments, inline images, categories, aliases, and
 * dynamic linking options. Validates user write permissions and checks for duplicate
 * concepts if the glossary configuration disallows them.
 *
 * Endpoint: POST /api/v1/glossary/{id}/entries
 *
 * Request body (JSON):
 * {
 *   "concept": "Term to define (required)",
 *   "definition": "Definition text (required)",
 *   "definitionformat": 1,
 *   "options": {
 *     "inlineattachmentsid": 123456789,
 *     "attachmentsid": 987654321,
 *     "categories": "1,2,3",
 *     "aliases": "alias1,alias2,alias3",
 *     "usedynalink": true,
 *     "casesensitive": false,
 *     "fullmatch": false
 *   }
 * }
 *
 * Response (201 Created):
 * {
 *   "success": true,
 *   "data": {
 *     "entryid": 42,
 *     "approved": true
 *   }
 * }
 *
 * Error responses:
 * - 400 Bad Request: Validation errors (empty concept, duplicate concept, malformed JSON)
 * - 403 Forbidden: User lacks mod/glossary:write capability
 * - 404 Not Found: Glossary with specified ID does not exist
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Include required Moodle core files
require_once(__DIR__ . '/../../../config.php');

// Include API infrastructure
require_once(__DIR__ . '/../../lib/api_base.php');
require_once(__DIR__ . '/../../lib/api_response.php');
require_once(__DIR__ . '/../../lib/api_exception.php');

/**
 * API endpoint class for creating glossary entries.
 *
 * Extends ApiBase to inherit REST API infrastructure including JWT authentication,
 * HTTP method routing, permission checking, and standardized response formatting.
 * Implements handle_post() to process POST requests for creating new glossary entries.
 *
 * This is a thin wrapper that delegates all business logic to existing Moodle functions:
 * - mod_glossary_external::validate_glossary() for glossary validation
 * - glossary_concept_exists() for duplicate checking
 * - glossary_edit_entry() for entry creation, file processing, and event triggering
 *
 * No business logic is duplicated - this endpoint only handles REST API concerns
 * (authentication, authorization, request parsing, response formatting).
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class GlossaryCreateEntryEndpoint extends ApiBase {
    
    /**
     * Handle POST requests to create a new glossary entry.
     *
     * Process flow:
     * 1. Extract glossary ID from request URI
     * 2. Parse JSON request body to extract concept, definition, and options
     * 3. Validate glossary exists and retrieve context objects
     * 4. Check user has mod/glossary:write capability
     * 5. Validate concept is not empty
     * 6. Check for duplicate concepts if glossary disallows duplicates
     * 7. Prepare entry object with all properties
     * 8. Process options (attachments, categories, aliases, linking settings)
     * 9. Call glossary_edit_entry() to create entry in database
     * 10. Return success response with entry ID and approval status
     *
     * @return void Sends JSON response and terminates execution
     * @throws ValidationException If concept is empty, duplicate, or JSON is malformed
     * @throws ForbiddenException If user lacks write capability
     * @throws NotFoundException If glossary does not exist
     */
    protected function handle_post() {
        global $CFG, $DB;
        
        // Load Moodle glossary libraries
        require_once($CFG->dirroot . '/mod/glossary/lib.php');
        require_once($CFG->dirroot . '/mod/glossary/classes/external.php');
        
        // Extract glossary ID from request URI
        // URI pattern: /api/v1/glossary/{id}/entries
        $glossaryid = $this->getParam('id', PARAM_INT);
        
        // Parse JSON request body
        $requestdata = $this->getJsonBody();
        
        // Extract required fields from request
        $concept = isset($requestdata['concept']) ? $requestdata['concept'] : '';
        $definition = isset($requestdata['definition']) ? $requestdata['definition'] : '';
        $definitionformat = isset($requestdata['definitionformat']) ? 
            (int)$requestdata['definitionformat'] : FORMAT_HTML;
        
        // Extract optional options object
        $options = isset($requestdata['options']) ? $requestdata['options'] : [];
        
        // Validate glossary exists and get required objects
        // This function returns [$glossary, $context, $course, $cm]
        try {
            list($glossary, $context, $course, $cm) = 
                mod_glossary_external::validate_glossary($glossaryid);
        } catch (Exception $e) {
            throw new NotFoundException(
                'Glossary not found', 
                ['glossaryid' => $glossaryid, 'error' => $e->getMessage()]
            );
        }
        
        // Check user has write permission
        // This calls require_capability() internally and throws ForbiddenException on failure
        $this->checkCapability('mod/glossary:write', $context);
        
        // Validate concept is not empty
        $concept = clean_param($concept, PARAM_TEXT);
        if (empty(trim($concept))) {
            throw new ValidationException(
                'Concept cannot be empty',
                ['field' => 'concept', 'value' => $concept]
            );
        }
        
        // Check for duplicate concepts if glossary disallows duplicates
        if (!$glossary->allowduplicatedentries) {
            if (glossary_concept_exists($glossary, $concept)) {
                throw new ValidationException(
                    get_string('errconceptalreadyexists', 'glossary'),
                    ['concept' => $concept, 'glossaryid' => $glossaryid]
                );
            }
        }
        
        // Get authenticated user
        $user = $this->getUser();
        
        // Prepare new entry object
        $entry = new stdClass();
        $entry->id = null; // null indicates new entry
        $entry->glossaryid = $glossaryid;
        $entry->concept = $concept;
        
        // Prepare definition editor array
        $entry->definition_editor = [
            'text' => $definition,
            'format' => $definitionformat,
        ];
        
        // Initialize default values for linking options
        // Use glossary defaults from config if not specified
        $entry->aliases = '';
        $entry->usedynalink = isset($CFG->glossary_linkentries) ? $CFG->glossary_linkentries : 1;
        $entry->casesensitive = isset($CFG->glossary_casesensitive) ? $CFG->glossary_casesensitive : 0;
        $entry->fullmatch = isset($CFG->glossary_fullmatch) ? $CFG->glossary_fullmatch : 0;
        
        // Set user and timestamps
        $entry->userid = $user->id;
        $entry->timecreated = time();
        
        // Set approval status based on glossary settings
        // If defaultapproval is 0, entries need teacher approval (approved = 0)
        // If defaultapproval is 1, entries are auto-approved (approved = 1)
        $entry->approved = !$glossary->defaultapproval ? 0 : 1;
        
        // Process options if provided
        if (!empty($options)) {
            
            // Handle inline attachments (images embedded in definition)
            if (isset($options['inlineattachmentsid'])) {
                $entry->definition_editor['itemid'] = (int)$options['inlineattachmentsid'];
            }
            
            // Handle file attachments
            if (isset($options['attachmentsid'])) {
                $entry->attachment_filemanager = (int)$options['attachmentsid'];
            }
            
            // Handle category associations
            if (isset($options['categories'])) {
                // Convert comma-separated string to array
                if (is_string($options['categories'])) {
                    $entry->categories = array_filter(
                        array_map('intval', explode(',', $options['categories']))
                    );
                } else if (is_array($options['categories'])) {
                    $entry->categories = array_map('intval', $options['categories']);
                }
            }
            
            // Handle aliases
            if (isset($options['aliases'])) {
                // Convert comma-separated string to newline-separated format
                // glossary_edit_entry expects aliases separated by newlines
                if (is_string($options['aliases'])) {
                    $aliasesArray = array_filter(
                        array_map('trim', explode(',', $options['aliases']))
                    );
                    $entry->aliases = implode("\n", $aliasesArray);
                }
            }
            
            // Handle dynamic linking options (only if linking is enabled in glossary)
            if ($glossary->usedynalink) {
                if (isset($options['usedynalink'])) {
                    $entry->usedynalink = (bool)$options['usedynalink'] ? 1 : 0;
                }
                
                if (isset($options['casesensitive'])) {
                    $entry->casesensitive = (bool)$options['casesensitive'] ? 1 : 0;
                }
                
                if (isset($options['fullmatch'])) {
                    $entry->fullmatch = (bool)$options['fullmatch'] ? 1 : 0;
                }
            }
        }
        
        // Call existing Moodle function to create entry
        // This function handles:
        // - Database insertion
        // - File processing (attachments and inline images)
        // - Event triggering (glossary_entry_created)
        // - Completion tracking
        // - RSS feed updates
        // - Search index updates
        $entry = glossary_edit_entry($entry, $course, $cm, $glossary, $context);
        
        // Return success response with entry ID and approval status
        // Use 201 Created status code for successful resource creation
        $this->success(
            [
                'entryid' => $entry->id,
                'approved' => (bool)$entry->approved,
            ],
            201
        );
    }
    
    /**
     * Handle GET requests (not supported).
     *
     * This endpoint only supports POST for creating entries.
     * List and retrieve operations are handled by separate endpoints.
     *
     * @return void
     * @throws BadRequestException Always throws - GET not supported
     */
    protected function handle_get() {
        throw new BadRequestException('GET method not supported on this endpoint. Use POST to create entries.');
    }
    
    /**
     * Handle PUT requests (not supported).
     *
     * This endpoint only supports POST for creating entries.
     * Update operations are handled by a separate endpoint.
     *
     * @return void
     * @throws BadRequestException Always throws - PUT not supported
     */
    protected function handle_put() {
        throw new BadRequestException('PUT method not supported on this endpoint. Use POST to create entries.');
    }
    
    /**
     * Handle DELETE requests (not supported).
     *
     * This endpoint only supports POST for creating entries.
     * Delete operations are handled by a separate endpoint.
     *
     * @return void
     * @throws BadRequestException Always throws - DELETE not supported
     */
    protected function handle_delete() {
        throw new BadRequestException('DELETE method not supported on this endpoint. Use POST to create entries.');
    }
}

// Instantiate and execute the endpoint
// Skip auto-execution in test mode to allow manual instantiation
if (!defined('API_TEST_MODE') || !API_TEST_MODE) {
    $endpoint = new GlossaryCreateEntryEndpoint();
    $endpoint->execute();
}
