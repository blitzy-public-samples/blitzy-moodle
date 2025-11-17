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
 * REST API endpoint for retrieving glossary activity details.
 *
 * This endpoint provides comprehensive glossary information including configuration,
 * description, display format, entry permissions, and associated course module details.
 * It validates user permissions via require_capability('mod/glossary:view') and delegates
 * to existing Moodle functions for all data retrieval operations.
 *
 * Endpoint: GET /api/v1/glossary/{id}
 *
 * Request:
 * - URL parameter: id (glossary instance ID)
 * - Headers: Authorization: Bearer <jwt_token>
 *
 * Response (200 OK):
 * {
 *   "success": true,
 *   "data": {
 *     "id": 123,
 *     "course": 5,
 *     "name": "Course Glossary",
 *     "intro": "This is a glossary for key terms...",
 *     "introformat": 1,
 *     "allowduplicatedentries": 0,
 *     "displayformat": "dictionary",
 *     "mainglossary": 1,
 *     "showspecial": 1,
 *     "showalphabet": 1,
 *     "showall": 1,
 *     "allowcomments": 1,
 *     "allowprintview": 1,
 *     "usedynalink": 1,
 *     "defaultapproval": 1,
 *     "globalglossary": 0,
 *     "entbypage": 10,
 *     "editalways": 0,
 *     "ratingtime": 0,
 *     "assessed": 0,
 *     "scale": 0,
 *     "timecreated": 1634567890,
 *     "timemodified": 1634567890,
 *     "completionentries": 0,
 *     "canaddentry": true,
 *     "canadd": true,
 *     "canmanage": false,
 *     "canapprove": false
 *   }
 * }
 *
 * Error Responses:
 * - 401 Unauthorized: Missing or invalid JWT token
 * - 403 Forbidden: User lacks mod/glossary:view capability
 * - 404 Not Found: Glossary with specified ID does not exist
 * - 500 Internal Server Error: Unexpected server error
 *
 * @package    mod_glossary
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Load Moodle configuration and core libraries
require_once(__DIR__ . '/../../../config.php');

// Load API infrastructure
require_once(__DIR__ . '/../../lib/api_base.php');
require_once(__DIR__ . '/../../lib/api_exception.php');

/**
 * Glossary show endpoint - retrieves glossary activity details by ID.
 *
 * Extends ApiBase to inherit JWT authentication, request routing, capability checking,
 * and response formatting. Implements the thin wrapper pattern by delegating all
 * business logic to existing Moodle core functions.
 *
 * @package    mod_glossary
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class GlossaryShowEndpoint extends ApiBase {
    
    /**
     * Handle GET request to retrieve glossary details.
     *
     * This method processes GET requests to /api/v1/glossary/{id} and returns
     * comprehensive glossary information including all configuration fields,
     * computed permission fields, and metadata for React frontend display.
     *
     * Request Flow:
     * 1. Extract glossary ID from URI path
     * 2. Validate glossary exists in database
     * 3. Get course and course module context
     * 4. Check mod/glossary:view capability
     * 5. Format glossary data with computed fields
     * 6. Return success response with glossary object
     *
     * @return void Outputs JSON response via success() method
     * @throws NotFoundException If glossary does not exist
     * @throws ForbiddenException If user lacks view permission
     */
    protected function handle_get() {
        global $DB, $CFG;
        
        // Load Moodle glossary library and access library
        require_once($CFG->dirroot . '/mod/glossary/lib.php');
        require_once($CFG->libdir . '/accesslib.php');
        
        // Extract glossary ID from request URI
        // Expected URI format: /api/v1/glossary/123 or /api/v1/glossary/show.php?id=123
        $glossaryid = $this->parseIdFromUri();
        
        // Validate glossary exists in database
        // Uses $DB->get_record with MUST_EXIST flag to throw exception if not found
        try {
            $glossary = $DB->get_record('glossary', ['id' => $glossaryid], '*', MUST_EXIST);
        } catch (dml_exception $e) {
            throw new NotFoundException("Glossary not found", [
                'glossaryId' => $glossaryid,
                'reason' => 'No glossary exists with the specified ID'
            ]);
        }
        
        // Get course and course module from glossary instance
        // This function retrieves both objects and validates relationships
        list($course, $cm) = get_course_and_cm_from_instance($glossary, 'glossary');
        
        // Get module context for capability checking
        $context = context_module::instance($cm->id);
        
        // Check that user has permission to view this glossary
        // This will throw ForbiddenException if user lacks capability
        $this->checkCapability('mod/glossary:view', $context);
        
        // Get authenticated user for permission checks
        $user = $this->getUser();
        
        // Build glossary data object with all fields from database
        $data = [
            // Core glossary identification
            'id' => (int)$glossary->id,
            'course' => (int)$glossary->course,
            'name' => $glossary->name,
            
            // Introduction and description
            'intro' => $glossary->intro,
            'introformat' => (int)$glossary->introformat,
            
            // Entry configuration
            'allowduplicatedentries' => (int)$glossary->allowduplicatedentries,
            'displayformat' => $glossary->displayformat,
            'mainglossary' => (int)$glossary->mainglossary,
            'showspecial' => (int)$glossary->showspecial,
            'showalphabet' => (int)$glossary->showalphabet,
            'showall' => (int)$glossary->showall,
            'entbypage' => (int)$glossary->entbypage,
            'editalways' => (int)$glossary->editalways,
            
            // Feature flags
            'allowcomments' => (int)$glossary->allowcomments,
            'allowprintview' => (int)$glossary->allowprintview,
            'usedynalink' => (int)$glossary->usedynalink,
            'defaultapproval' => (int)$glossary->defaultapproval,
            'globalglossary' => (int)$glossary->globalglossary,
            
            // Rating configuration
            'ratingtime' => (int)$glossary->ratingtime,
            'assessed' => (int)$glossary->assessed,
            'scale' => (int)$glossary->scale,
            
            // Timestamps
            'timecreated' => (int)$glossary->timecreated,
            'timemodified' => (int)$glossary->timemodified,
            
            // Completion settings
            'completionentries' => (int)$glossary->completionentries,
        ];
        
        // Add computed permission fields for React frontend
        // These indicate what actions the current user can perform
        
        // Check if user can add entries (write capability)
        $data['canaddentry'] = has_capability('mod/glossary:write', $context, $user->id);
        
        // Check if user can add entries (broader add capability check)
        // This considers both the write capability and module availability
        $data['canadd'] = $data['canaddentry'] && $cm->uservisible;
        
        // Check if user can manage entries (approve, edit, delete any entry)
        $data['canmanage'] = has_capability('mod/glossary:manageentries', $context, $user->id);
        
        // Check if user can approve entries
        $data['canapprove'] = has_capability('mod/glossary:approve', $context, $user->id);
        
        // Return success response with formatted glossary data
        $this->success($data);
    }
    
    /**
     * Handle POST requests - not supported for glossary show endpoint.
     *
     * @throws MethodNotAllowedException Always thrown as POST is not supported
     */
    protected function handle_post() {
        throw new MethodNotAllowedException('POST method is not supported for glossary show endpoint', [
            'allowedMethods' => ['GET'],
            'endpoint' => '/api/v1/glossary/{id}'
        ]);
    }
    
    /**
     * Handle PUT requests - not supported for glossary show endpoint.
     *
     * @throws MethodNotAllowedException Always thrown as PUT is not supported
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method is not supported for glossary show endpoint', [
            'allowedMethods' => ['GET'],
            'endpoint' => '/api/v1/glossary/{id}'
        ]);
    }
    
    /**
     * Handle DELETE requests - not supported for glossary show endpoint.
     *
     * @throws MethodNotAllowedException Always thrown as DELETE is not supported
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method is not supported for glossary show endpoint', [
            'allowedMethods' => ['GET'],
            'endpoint' => '/api/v1/glossary/{id}'
        ]);
    }
    
    /**
     * Extract glossary ID from request URI.
     *
     * Parses the URI to extract the glossary ID from either:
     * 1. Path segment: /api/v1/glossary/123
     * 2. Query parameter: /api/v1/glossary/show.php?id=123
     *
     * @return int Glossary ID
     * @throws ValidationException If ID cannot be extracted or is invalid
     */
    private function parseIdFromUri() {
        // First try to get ID from query parameter
        if (isset($_GET['id'])) {
            $id = filter_var($_GET['id'], FILTER_VALIDATE_INT);
            if ($id === false || $id <= 0) {
                throw new ValidationException('Invalid glossary ID in query parameter', [
                    'parameter' => 'id',
                    'value' => $_GET['id'],
                    'reason' => 'ID must be a positive integer'
                ]);
            }
            return $id;
        }
        
        // Try to extract ID from URI path
        // Expected format: /api/v1/glossary/123 or /api/v1/glossary/show.php
        $uri = $this->requestUri;
        
        // Remove query string if present
        $uri = explode('?', $uri)[0];
        
        // Split URI into segments
        $segments = explode('/', trim($uri, '/'));
        
        // Find the glossary segment and get the next segment as ID
        $glossaryIndex = array_search('glossary', $segments);
        
        if ($glossaryIndex !== false && isset($segments[$glossaryIndex + 1])) {
            $idSegment = $segments[$glossaryIndex + 1];
            
            // Remove .php extension if present (e.g., "show.php" -> "show")
            $idSegment = preg_replace('/\.php$/', '', $idSegment);
            
            // Skip if segment is a known endpoint name
            if (in_array($idSegment, ['show', 'index', 'create', 'update', 'delete'])) {
                throw new ValidationException('Glossary ID is required', [
                    'uri' => $uri,
                    'format' => '/api/v1/glossary/{id} or /api/v1/glossary/show.php?id={id}',
                    'reason' => 'No glossary ID found in URI or query parameters'
                ]);
            }
            
            // Validate ID is a positive integer
            $id = filter_var($idSegment, FILTER_VALIDATE_INT);
            
            if ($id === false || $id <= 0) {
                throw new ValidationException('Invalid glossary ID in URI path', [
                    'segment' => $idSegment,
                    'reason' => 'ID must be a positive integer'
                ]);
            }
            
            return $id;
        }
        
        // ID not found in URI or query parameters
        throw new ValidationException('Glossary ID is required', [
            'uri' => $uri,
            'format' => '/api/v1/glossary/{id} or /api/v1/glossary/show.php?id={id}',
            'reason' => 'No glossary ID found in URI or query parameters'
        ]);
    }
}

// Initialize and execute the endpoint
// Skip auto-execution in test mode to allow manual instantiation
if (!defined('API_TEST_MODE') || !API_TEST_MODE) {
    $endpoint = new GlossaryShowEndpoint();
    $endpoint->execute();
}
