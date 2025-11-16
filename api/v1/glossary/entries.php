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
 * REST API endpoint for retrieving paginated list of glossary entries.
 *
 * Supports multiple filtering and sorting options including browsing by letter,
 * date, author, category, and search query. Returns entry list with concepts,
 * definitions, attachments, approval status, and pagination metadata.
 *
 * Endpoint: GET /api/v1/glossary/{id}/entries
 *
 * Query Parameters:
 * - mode: Browse mode (letter, date, author, cat, search, term) - defaults to 'letter'
 * - letter: Letter to filter by when mode=letter (A-Z, ALL, SPECIAL) - defaults to 'ALL'
 * - from: Starting record for pagination (0-based offset) - defaults to 0
 * - limit: Number of records to return (1-100) - defaults to 20
 * - order: Sort order field for date/author modes (CREATION, UPDATE, FIRSTNAME, LASTNAME)
 * - sort: Sort direction (ASC, DESC) - defaults to 'ASC' for letter, 'DESC' for date
 * - search: Search query string when mode=search
 * - fullsearch: Whether to search definitions in addition to concepts (0 or 1)
 * - category: Category ID when mode=cat
 * - author: Author letter or ID when mode=author (letter for browse, ID for specific author)
 *
 * Response Format:
 * {
 *   "success": true,
 *   "data": {
 *     "entries": [
 *       {
 *         "id": 123,
 *         "glossaryid": 5,
 *         "userid": 42,
 *         "userfullname": "John Doe",
 *         "userpictureurl": "https://...",
 *         "concept": "API",
 *         "definition": "<p>Application Programming Interface</p>",
 *         "definitionformat": 1,
 *         "definitiontrust": true,
 *         "attachment": true,
 *         "attachments": [...],
 *         "timecreated": 1234567890,
 *         "timemodified": 1234567890,
 *         "teacherentry": false,
 *         "approved": 1
 *       }
 *     ],
 *     "pagination": {
 *       "page": 1,
 *       "perPage": 20,
 *       "total": 150,
 *       "totalPages": 8
 *     }
 *   }
 * }
 *
 * Error Responses:
 * - 404 NOT_FOUND: Glossary with specified ID does not exist
 * - 403 FORBIDDEN: User lacks mod/glossary:view permission
 * - 400 VALIDATION_ERROR: Invalid mode, parameters, or mode not available for glossary format
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

require_once(__DIR__ . '/../../../config.php');
require_once($CFG->dirroot . '/api/lib/api_base.php');
require_once($CFG->dirroot . '/api/lib/api_response.php');
require_once($CFG->dirroot . '/api/lib/api_exception.php');
require_once($CFG->dirroot . '/mod/glossary/lib.php');
require_once($CFG->dirroot . '/mod/glossary/classes/external.php');

/**
 * Glossary Entries API Endpoint
 *
 * Handles GET requests for retrieving glossary entries with various filtering
 * and sorting options. Wraps existing Moodle glossary functions without
 * duplicating business logic.
 *
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class GlossaryEntriesEndpoint extends ApiBase {

    /**
     * Handle GET request for glossary entries.
     *
     * Processes request to retrieve paginated glossary entries with multiple
     * browse modes and filtering options. Validates permissions, delegates to
     * existing Moodle functions, and returns formatted response.
     *
     * @return void Outputs JSON response and exits
     * @throws NotFoundException If glossary does not exist
     * @throws ForbiddenException If user lacks view permission
     * @throws ValidationException If parameters are invalid
     */
    protected function handle_get() {
        global $USER;

        // Extract glossary ID from URI path
        // Expected format: /api/v1/glossary/{id}/entries
        $pathparts = explode('/', trim($_SERVER['REQUEST_URI'], '/'));
        $glossaryidindex = array_search('glossary', $pathparts);
        
        if ($glossaryidindex === false || !isset($pathparts[$glossaryidindex + 1])) {
            throw new ValidationException('Glossary ID is required in URL path');
        }
        
        $glossaryid = clean_param($pathparts[$glossaryidindex + 1], PARAM_INT);
        
        if ($glossaryid <= 0) {
            throw new ValidationException('Invalid glossary ID');
        }

        // Extract and validate query parameters
        $mode = $this->getParam('mode', PARAM_ALPHA, false, 'letter');
        $letter = $this->getParam('letter', PARAM_CLEAN, false, 'ALL');
        $from = $this->getParam('from', PARAM_INT, false, 0);
        $limit = $this->getParam('limit', PARAM_INT, false, 20);
        $order = $this->getParam('order', PARAM_ALPHA, false, 'CREATION');
        $sort = $this->getParam('sort', PARAM_ALPHA, false, 'ASC');
        $search = $this->getParam('search', PARAM_CLEAN, false, '');
        $fullsearch = $this->getParam('fullsearch', PARAM_INT, false, 0);
        $categoryid = $this->getParam('category', PARAM_INT, false, 0);
        $author = $this->getParam('author', PARAM_CLEAN, false, '');

        // Validate pagination parameters
        if ($from < 0) {
            throw new ValidationException('Parameter "from" must be non-negative');
        }
        
        if ($limit < 1 || $limit > 100) {
            throw new ValidationException('Parameter "limit" must be between 1 and 100');
        }

        // Validate sort direction
        $sort = strtoupper($sort);
        if ($sort !== 'ASC' && $sort !== 'DESC') {
            throw new ValidationException('Parameter "sort" must be either ASC or DESC');
        }

        // Validate order field
        $order = strtoupper($order);
        $validorders = ['CREATION', 'UPDATE', 'FIRSTNAME', 'LASTNAME'];
        if (!in_array($order, $validorders)) {
            throw new ValidationException('Parameter "order" must be one of: ' . implode(', ', $validorders));
        }

        // Validate and get glossary with context
        try {
            list($glossary, $context, $course, $cm) = mod_glossary_external::validate_glossary($glossaryid);
        } catch (Exception $e) {
            throw new NotFoundException('Glossary not found with ID: ' . $glossaryid);
        }

        // Check view permission
        try {
            $this->checkCapability('mod/glossary:view', $context);
        } catch (Exception $e) {
            throw new ForbiddenException('You do not have permission to view this glossary');
        }

        // Get available browse modes for this glossary's display format
        $availablemodes = $this->getBrowseModesFromDisplayFormat($glossary->displayformat);
        
        // Validate mode is available
        if (!in_array($mode, $availablemodes)) {
            throw new ValidationException(
                'Browse mode "' . $mode . '" is not available for this glossary. Available modes: ' . 
                implode(', ', $availablemodes)
            );
        }

        // Determine if user can view unapproved entries
        $canapprove = has_capability('mod/glossary:approve', $context);
        
        // Build options array for glossary functions
        $options = array(
            'includenotapproved' => $canapprove
        );

        // Route to appropriate retrieval function based on mode
        $entries = array();
        $totalcount = 0;

        switch ($mode) {
            case 'letter':
                // Browse by letter (A-Z, ALL, SPECIAL)
                $letter = strtoupper($letter);
                if ($letter !== 'ALL' && $letter !== 'SPECIAL' && !preg_match('/^[A-Z]$/', $letter)) {
                    throw new ValidationException('Parameter "letter" must be A-Z, ALL, or SPECIAL');
                }
                
                list($records, $totalcount) = glossary_get_entries_by_letter(
                    $glossary,
                    $context,
                    $letter,
                    $from,
                    $limit,
                    $options
                );
                $entries = $records;
                break;

            case 'date':
                // Browse by date (creation or modification time)
                list($records, $totalcount) = glossary_get_entries_by_date(
                    $glossary,
                    $context,
                    $order,
                    $sort,
                    $from,
                    $limit,
                    $options
                );
                $entries = $records;
                break;

            case 'cat':
                // Browse by category
                if ($categoryid <= 0) {
                    throw new ValidationException('Parameter "category" is required for category mode and must be positive');
                }
                
                list($records, $totalcount) = glossary_get_entries_by_category(
                    $glossary,
                    $context,
                    $categoryid,
                    $from,
                    $limit,
                    $options
                );
                $entries = $records;
                break;

            case 'author':
                // Browse by author
                if (empty($author)) {
                    throw new ValidationException('Parameter "author" is required for author mode');
                }
                
                // Check if author is numeric (specific author ID) or alphabetic (browse by letter)
                if (is_numeric($author)) {
                    // Get entries by specific author ID
                    $authorid = (int)$author;
                    list($records, $totalcount) = glossary_get_entries_by_author_id(
                        $glossary,
                        $context,
                        $authorid,
                        $order,
                        $sort,
                        $from,
                        $limit,
                        $options
                    );
                    $entries = $records;
                } else {
                    // Browse authors by letter
                    $authorletter = strtoupper($author);
                    if ($authorletter !== 'ALL' && $authorletter !== 'SPECIAL' && !preg_match('/^[A-Z]$/', $authorletter)) {
                        throw new ValidationException('Parameter "author" must be a user ID, or A-Z, ALL, or SPECIAL');
                    }
                    
                    // Determine field to sort by (FIRSTNAME or LASTNAME)
                    $field = ($order === 'LASTNAME') ? 'LASTNAME' : 'FIRSTNAME';
                    
                    list($records, $totalcount) = glossary_get_entries_by_author(
                        $glossary,
                        $context,
                        $authorletter,
                        $field,
                        $sort,
                        $from,
                        $limit,
                        $options
                    );
                    $entries = $records;
                }
                break;

            case 'search':
                // Search entries
                if (empty($search)) {
                    throw new ValidationException('Parameter "search" is required for search mode');
                }
                
                // Clean and validate search query
                $search = trim(strip_tags($search));
                if (strlen($search) < 2) {
                    throw new ValidationException('Search query must be at least 2 characters');
                }
                
                list($records, $totalcount) = glossary_get_entries_by_search(
                    $glossary,
                    $context,
                    $search,
                    $fullsearch,
                    $order,
                    $sort,
                    $from,
                    $limit,
                    $options
                );
                $entries = $records;
                break;

            case 'term':
                // Look up specific term (by concept or alias)
                if (empty($search)) {
                    throw new ValidationException('Parameter "search" is required for term mode');
                }
                
                $search = trim(strip_tags($search));
                
                list($records, $totalcount) = glossary_get_entries_by_term(
                    $glossary,
                    $context,
                    $search,
                    $from,
                    $limit,
                    $options
                );
                $entries = $records;
                break;

            default:
                throw new ValidationException('Invalid mode: ' . $mode);
        }

        // Filter unapproved entries if user cannot approve
        // Entries are kept if approved OR if user created them
        if (!$canapprove) {
            $filteredentries = array();
            foreach ($entries as $entry) {
                if ($entry->approved || $entry->userid == $USER->id) {
                    $filteredentries[] = $entry;
                }
            }
            $entries = $filteredentries;
        }

        // Process each entry to add formatted fields, user info, and attachments
        $formattedentries = array();
        foreach ($entries as $entry) {
            // fill_entry_details modifies the entry object in place
            mod_glossary_external::fill_entry_details($entry, $context);
            
            // Convert entry object to array format for JSON response
            $formattedentry = array(
                'id' => (int)$entry->id,
                'glossaryid' => (int)$entry->glossaryid,
                'userid' => (int)$entry->userid,
                'userfullname' => $entry->userfullname,
                'userpictureurl' => $entry->userpictureurl,
                'concept' => $entry->concept,
                'definition' => $entry->definition,
                'definitionformat' => (int)$entry->definitionformat,
                'definitiontrust' => (bool)$entry->definitiontrust,
                'attachment' => (bool)$entry->attachment,
                'timecreated' => (int)$entry->timecreated,
                'timemodified' => (int)$entry->timemodified,
                'teacherentry' => (bool)$entry->teacherentry,
                'sourceglossaryid' => (int)$entry->sourceglossaryid,
                'usedynalink' => (bool)$entry->usedynalink,
                'casesensitive' => (bool)$entry->casesensitive,
                'fullmatch' => (bool)$entry->fullmatch,
                'approved' => (bool)$entry->approved
            );

            // Add optional fields if present
            if (isset($entry->definitioninlinefiles)) {
                $formattedentry['definitioninlinefiles'] = $entry->definitioninlinefiles;
            }
            
            if (isset($entry->attachments)) {
                $formattedentry['attachments'] = $entry->attachments;
            }
            
            if (isset($entry->aliases)) {
                $formattedentry['aliases'] = $entry->aliases;
            }
            
            if (isset($entry->categoryid)) {
                $formattedentry['categoryid'] = (int)$entry->categoryid;
            }
            
            if (isset($entry->categoryname)) {
                $formattedentry['categoryname'] = $entry->categoryname;
            }

            $formattedentries[] = $formattedentry;
        }

        // Calculate pagination metadata
        $page = ($from > 0 && $limit > 0) ? (int)floor($from / $limit) + 1 : 1;
        $pagination = ApiResponse::formatPagination($page, $limit, $totalcount);

        // Return success response with entries and pagination
        $this->success(array(
            'entries' => $formattedentries,
            'pagination' => $pagination
        ));
    }

    /**
     * Get available browse modes for a glossary display format.
     *
     * Wraps the logic from mod_glossary_external to determine which browse
     * modes are available based on the glossary's display format settings.
     *
     * @param string $format Display format name (e.g., 'dictionary', 'continuous')
     * @return array Array of available mode strings
     */
    private function getBrowseModesFromDisplayFormat($format) {
        global $DB;

        $formats = array();
        $dp = $DB->get_record('glossary_formats', array('name' => $format), '*', IGNORE_MISSING);
        
        if ($dp) {
            $formats = glossary_get_visible_tabs($dp);
        }

        // 'letter' mode is always available
        $modes = array('letter');

        // Add additional modes based on format settings
        if (in_array('category', $formats)) {
            $modes[] = 'cat';
        }
        
        if (in_array('date', $formats)) {
            $modes[] = 'date';
        }
        
        if (in_array('author', $formats)) {
            $modes[] = 'author';
        }

        // 'search' and 'term' modes are generally available
        $modes[] = 'search';
        $modes[] = 'term';

        return $modes;
    }
}

// Execute the endpoint
$endpoint = new GlossaryEntriesEndpoint();
$endpoint->execute();
