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
 * REST API endpoint for retrieving book table of contents.
 *
 * Provides complete navigation structure with chapter hierarchy, numbering,
 * and visibility information for React frontend sidebar and navigation components.
 *
 * Endpoint: GET /api/v1/book/{id}/toc
 *
 * Query Parameters:
 * - current_chapter (optional): Chapter ID to highlight as current in the TOC
 *
 * Response Structure:
 * {
 *   "success": true,
 *   "data": {
 *     "toc": {
 *       "numbering_style": "numbers|none|bullets|indented",
 *       "chapters": [
 *         {
 *           "id": 123,
 *           "title": "Introduction",
 *           "pagenum": 1,
 *           "number": "1",
 *           "hidden": false,
 *           "is_subchapter": false,
 *           "parent_id": null,
 *           "url": "/book/chapters/123",
 *           "is_current": false,
 *           "subchapters": [
 *             {
 *               "id": 124,
 *               "title": "Getting Started",
 *               "pagenum": 2,
 *               "number": "1.1",
 *               "hidden": false,
 *               "is_subchapter": true,
 *               "parent_id": 123,
 *               "url": "/book/chapters/124",
 *               "is_current": true
 *             }
 *           ]
 *         }
 *       ],
 *       "total_count": 10,
 *       "visible_count": 8,
 *       "current_chapter_id": 124
 *     }
 *   }
 * }
 *
 * @package    mod_book
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Load API base class and exceptions
require_once(__DIR__ . '/../../lib/api_base.php');
require_once(__DIR__ . '/../../lib/api_exception.php');

// Load Moodle configuration
require_once(__DIR__ . '/../../../config.php');

// Load book module libraries
require_once($CFG->dirroot . '/mod/book/lib.php');
require_once($CFG->dirroot . '/mod/book/locallib.php');

/**
 * Book Table of Contents API Endpoint.
 *
 * Extends ApiBase to provide JWT authentication, HTTP method routing,
 * and standardized response formatting. Wraps existing Moodle book
 * functions to retrieve hierarchical TOC structure with proper numbering.
 */
class BookTocEndpoint extends ApiBase {
    
    /**
     * Handle GET request to retrieve book table of contents.
     *
     * This method:
     * 1. Validates JWT token and extracts authenticated user (via ApiBase)
     * 2. Retrieves book ID from URL parameter
     * 3. Accepts optional current_chapter query parameter
     * 4. Validates course module exists
     * 5. Retrieves book record from database
     * 6. Enforces permission checks (mod/book:read and mod/book:viewhiddenchapters)
     * 7. Calls book_preload_chapters() to load chapter structure
     * 8. Builds hierarchical TOC with proper numbering
     * 9. Filters hidden chapters based on user permissions
     * 10. Returns standardized JSON response
     *
     * @return void Outputs JSON response directly via success() method
     * @throws NotFoundException If book or course module not found
     * @throws ForbiddenException If user lacks required permissions
     * @throws ValidationException If parameters are invalid
     */
    protected function handle_get() {
        global $DB;
        
        // Extract book ID from URL parameter
        $bookid = $this->getParam('id', PARAM_INT, true);
        
        // Extract optional current_chapter query parameter
        $currentchapterid = $this->getParam('current_chapter', PARAM_INT, false, 0);
        
        // Validate that book ID is positive
        if ($bookid <= 0) {
            throw new ValidationException('Invalid book ID', [
                'parameter' => 'id',
                'value' => $bookid,
                'requirement' => 'Book ID must be a positive integer'
            ]);
        }
        
        // Retrieve book record from database
        $book = $DB->get_record('book', ['id' => $bookid], '*', IGNORE_MISSING);
        
        if (!$book) {
            throw new NotFoundException('Book not found', [
                'bookId' => $bookid,
                'reason' => 'No book exists with the specified ID'
            ]);
        }
        
        // Get course module instance for this book
        $cm = get_coursemodule_from_instance('book', $bookid, 0, false, IGNORE_MISSING);
        
        if (!$cm) {
            throw new NotFoundException('Course module not found for book', [
                'bookId' => $bookid,
                'reason' => 'Book exists but course module association not found'
            ]);
        }
        
        // Get context for permission checking
        $context = context_module::instance($cm->id);
        
        // Check if user has permission to read this book
        $this->checkCapability('mod/book:read', $context);
        
        // Check if user can view hidden chapters
        $user = $this->getUser();
        $viewhidden = has_capability('mod/book:viewhiddenchapters', $context, $user->id);
        
        // Load all chapters with preload function (existing Moodle function)
        // This function automatically fixes TOC structure and applies proper numbering
        $chapters = book_preload_chapters($book);
        
        if (!$chapters || count($chapters) === 0) {
            // Book exists but has no chapters - return empty TOC
            $tocdata = [
                'numbering_style' => $this->getNumberingStyleName($book->numbering),
                'chapters' => [],
                'total_count' => 0,
                'visible_count' => 0,
                'current_chapter_id' => null
            ];
            
            $this->success(['toc' => $tocdata]);
            return;
        }
        
        // Build hierarchical TOC structure
        $tocchapters = [];
        $totalcount = 0;
        $visiblecount = 0;
        $chapternumbers = []; // Track chapter numbers for constructing subchapter numbers
        $currentmainnumber = 0; // Current main chapter number for BOOK_NUM_NUMBERS
        $currentsubnumber = 0; // Current subchapter number for BOOK_NUM_NUMBERS
        
        foreach ($chapters as $chapter) {
            $totalcount++;
            
            // Filter hidden chapters if user cannot view them
            if ($chapter->hidden && !$viewhidden) {
                continue;
            }
            
            // Count visible chapters
            if (!$chapter->hidden) {
                $visiblecount++;
            }
            
            // Track numbering for BOOK_NUM_NUMBERS style
            if ($book->numbering == BOOK_NUM_NUMBERS) {
                if (!$chapter->subchapter) {
                    // Main chapter
                    if (!$chapter->hidden) {
                        $currentmainnumber++;
                    }
                    $currentsubnumber = 0; // Reset subchapter counter
                    $chapternumbers[$chapter->id] = $chapter->hidden ? 'x' : $currentmainnumber;
                } else {
                    // Subchapter
                    if (!$chapter->hidden) {
                        $currentsubnumber++;
                    }
                    // Store combined number (e.g., "1.2" or "x.1")
                    $parentnum = isset($chapternumbers[$chapter->parent]) ? $chapternumbers[$chapter->parent] : 'x';
                    $subnum = $chapter->hidden ? 'x' : $currentsubnumber;
                    $chapternumbers[$chapter->id] = $parentnum . '.' . $subnum;
                }
            }
            
            // Build chapter data structure
            $chapterdata = $this->buildChapterData($chapter, $book, $currentchapterid, $chapternumbers);
            
            // Add to appropriate location in hierarchy
            if (!$chapter->subchapter) {
                // Main chapter - add to root level
                $tocchapters[] = $chapterdata;
            } else {
                // Subchapter - add to parent's subchapters array
                // Find parent chapter in the already-built array
                $parentfound = false;
                
                for ($i = count($tocchapters) - 1; $i >= 0; $i--) {
                    if ($tocchapters[$i]['id'] === $chapter->parent) {
                        $tocchapters[$i]['subchapters'][] = $chapterdata;
                        $parentfound = true;
                        break;
                    }
                }
                
                // If parent not found (shouldn't happen with book_preload_chapters),
                // add as main chapter to prevent data loss
                if (!$parentfound) {
                    $tocchapters[] = $chapterdata;
                }
            }
        }
        
        // Build final TOC response structure
        $tocdata = [
            'numbering_style' => $this->getNumberingStyleName($book->numbering),
            'chapters' => $tocchapters,
            'total_count' => $totalcount,
            'visible_count' => $visiblecount,
            'current_chapter_id' => $currentchapterid > 0 ? $currentchapterid : null
        ];
        
        // Return success response with TOC data
        $this->success(['toc' => $tocdata]);
    }
    
    /**
     * Build chapter data structure for TOC response.
     *
     * Creates a standardized chapter object with all necessary fields for
     * React frontend navigation components. Includes formatted numbering
     * based on book settings and parent-child relationships.
     *
     * @param stdClass $chapter Chapter record from database with preloaded data
     * @param stdClass $book    Book record for numbering style reference
     * @param int      $currentchapterid Current chapter ID for highlighting
     * @param array    $chapternumbers   Pre-calculated chapter numbers for BOOK_NUM_NUMBERS
     * @return array Chapter data structure for JSON response
     */
    private function buildChapterData($chapter, $book, $currentchapterid, $chapternumbers = []) {
        // Format chapter number based on book numbering style
        $formattednumber = $this->formatChapterNumber($chapter, $book, $chapternumbers);
        
        // Build chapter data structure
        $chapterdata = [
            'id' => (int)$chapter->id,
            'title' => format_string($chapter->title),
            'pagenum' => (int)$chapter->pagenum,
            'number' => $formattednumber,
            'hidden' => (bool)$chapter->hidden,
            'is_subchapter' => (bool)$chapter->subchapter,
            'parent_id' => $chapter->parent ? (int)$chapter->parent : null,
            'url' => '/book/chapters/' . $chapter->id,
            'is_current' => ((int)$chapter->id === $currentchapterid),
            'subchapters' => [] // Will be populated for main chapters
        ];
        
        return $chapterdata;
    }
    
    /**
     * Format chapter number based on book numbering style.
     *
     * Applies the book's numbering style (BOOK_NUM_NONE, BOOK_NUM_NUMBERS,
     * BOOK_NUM_BULLETS, BOOK_NUM_INDENTED) to generate appropriate chapter
     * number display format. Handles hidden chapters with 'x' notation.
     *
     * @param stdClass $chapter Chapter record with number and parent properties
     * @param stdClass $book    Book record with numbering setting
     * @param array    $chapternumbers Pre-calculated chapter numbers for BOOK_NUM_NUMBERS
     * @return string|null Formatted chapter number or null if no numbering
     */
    private function formatChapterNumber($chapter, $book, $chapternumbers = []) {
        // BOOK_NUM_NONE (0) - no numbering
        if ($book->numbering == BOOK_NUM_NONE) {
            return null;
        }
        
        // BOOK_NUM_BULLETS (2) and BOOK_NUM_INDENTED (3) - no numeric labels
        if ($book->numbering == BOOK_NUM_BULLETS || $book->numbering == BOOK_NUM_INDENTED) {
            return null;
        }
        
        // BOOK_NUM_NUMBERS (1) - numeric numbering
        if ($book->numbering == BOOK_NUM_NUMBERS) {
            // Use pre-calculated number from $chapternumbers array
            if (isset($chapternumbers[$chapter->id])) {
                return (string)$chapternumbers[$chapter->id];
            }
            
            // Fallback: return the number property from book_preload_chapters
            return (string)$chapter->number;
        }
        
        return null;
    }
    
    /**
     * Get human-readable name for numbering style constant.
     *
     * Converts Moodle book numbering constants (BOOK_NUM_*) to lowercase
     * string identifiers suitable for React frontend styling decisions.
     *
     * @param string $numbering Book numbering constant value ('0', '1', '2', '3')
     * @return string Numbering style name ('none', 'numbers', 'bullets', 'indented')
     */
    private function getNumberingStyleName($numbering) {
        switch ($numbering) {
            case BOOK_NUM_NONE:
                return 'none';
            case BOOK_NUM_NUMBERS:
                return 'numbers';
            case BOOK_NUM_BULLETS:
                return 'bullets';
            case BOOK_NUM_INDENTED:
                return 'indented';
            default:
                return 'none';
        }
    }
    
    /**
     * Handle POST request - not supported for this endpoint.
     *
     * @throws MethodNotAllowedException Always thrown as POST is not supported
     */
    protected function handle_post() {
        throw new MethodNotAllowedException('POST method is not supported for book TOC endpoint', [
            'allowedMethods' => ['GET'],
            'endpoint' => '/api/v1/book/{id}/toc'
        ]);
    }
    
    /**
     * Handle PUT request - not supported for this endpoint.
     *
     * @throws MethodNotAllowedException Always thrown as PUT is not supported
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method is not supported for book TOC endpoint', [
            'allowedMethods' => ['GET'],
            'endpoint' => '/api/v1/book/{id}/toc'
        ]);
    }
    
    /**
     * Handle DELETE request - not supported for this endpoint.
     *
     * @throws MethodNotAllowedException Always thrown as DELETE is not supported
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method is not supported for book TOC endpoint', [
            'allowedMethods' => ['GET'],
            'endpoint' => '/api/v1/book/{id}/toc'
        ]);
    }
}

// Instantiate endpoint and execute request
$endpoint = new BookTocEndpoint();
$endpoint->execute();
