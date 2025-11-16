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
 * REST API endpoint for retrieving book chapters.
 *
 * Provides GET /api/v1/book/{id}/chapters endpoint that returns the complete
 * list of all chapters in a book activity with their metadata, navigation structure,
 * and visibility status. The endpoint wraps existing Moodle book module functions
 * to maintain zero business logic duplication while providing structured JSON data
 * for React frontend consumption.
 *
 * Features:
 * - Returns all chapters with id, title, pagenum, subchapter flag, hidden status
 * - Includes chapter numbering (1, 1.1, x) based on book numbering style
 * - Provides parent-child relationships for main chapters and subchapters
 * - Filters hidden chapters based on user's mod/book:viewhiddenchapters capability
 * - Includes content preview (first 200 characters without HTML tags)
 * - Supports complete chapter hierarchy for React frontend navigation
 * - Enforces permission checks using mod/book:read capability
 *
 * Request format:
 * GET /api/v1/book/{id}/chapters
 *
 * Response format:
 * {
 *   "success": true,
 *   "data": {
 *     "chapters": [
 *       {
 *         "id": 123,
 *         "bookid": 5,
 *         "pagenum": 1,
 *         "subchapter": 0,
 *         "title": "Introduction",
 *         "hidden": 0,
 *         "number": "1",
 *         "parent": null,
 *         "contentPreview": "This chapter introduces...",
 *         "timecreated": 1234567890,
 *         "timemodified": 1234567890
 *       },
 *       {
 *         "id": 124,
 *         "bookid": 5,
 *         "pagenum": 2,
 *         "subchapter": 1,
 *         "title": "Getting Started",
 *         "hidden": 0,
 *         "number": "1.1",
 *         "parent": 123,
 *         "contentPreview": "To get started...",
 *         "timecreated": 1234567890,
 *         "timemodified": 1234567890
 *       }
 *     ],
 *     "totalCount": 2
 *   }
 * }
 *
 * @package    mod_book
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Load Moodle configuration and core libraries
require_once(__DIR__ . '/../../../config.php');
require_once($CFG->dirroot . '/mod/book/locallib.php');
require_once($CFG->libdir . '/accesslib.php');

// Load API utilities
require_once(__DIR__ . '/../../lib/api_base.php');
require_once(__DIR__ . '/../../lib/api_exception.php');

/**
 * Book chapters API endpoint class.
 *
 * Handles GET requests to retrieve all chapters for a specific book activity.
 * Extends ApiBase to inherit JWT authentication, HTTP method routing, parameter
 * extraction, authorization enforcement, and standardized response formatting.
 */
class BookChaptersEndpoint extends ApiBase {
    
    /**
     * Handle GET request for book chapters.
     *
     * Retrieves all chapters for a specified book activity with complete metadata,
     * navigation structure, and visibility filtering based on user permissions.
     *
     * Process:
     * 1. Extract and validate book ID from URL parameter
     * 2. Validate course module exists for the book
     * 3. Retrieve book record from database
     * 4. Enforce mod/book:read capability in module context
     * 5. Check mod/book:viewhiddenchapters capability for visibility filtering
     * 6. Load all chapters using book_preload_chapters() with proper numbering
     * 7. Filter hidden chapters if user lacks viewhiddenchapters capability
     * 8. Format each chapter with required fields and content preview
     * 9. Return JSON response with chapters array and total count
     *
     * @return void Outputs JSON response directly
     * @throws NotFoundException If book ID is invalid or book does not exist
     * @throws ForbiddenException If user lacks mod/book:read capability
     * @throws ValidationException If book ID parameter is invalid
     */
    protected function handle_get() {
        global $DB;
        
        // Extract book ID from URL parameter with integer validation
        $bookid = $this->getParam('id', PARAM_INT);
        
        // Validate that book ID is positive
        if ($bookid <= 0) {
            throw new ValidationException('Invalid book ID', [
                'bookId' => $bookid,
                'reason' => 'Book ID must be a positive integer'
            ]);
        }
        
        // Validate course module exists using Moodle core function
        // This ensures the book activity is properly configured and accessible
        try {
            $cm = get_coursemodule_from_instance('book', $bookid, 0, false, MUST_EXIST);
        } catch (moodle_exception $e) {
            throw new NotFoundException('Book activity not found', [
                'bookId' => $bookid,
                'reason' => 'No course module found for this book ID'
            ]);
        }
        
        // Retrieve book record from database with all fields
        $book = $DB->get_record('book', ['id' => $bookid], '*', MUST_EXIST);
        
        if (!$book) {
            throw new NotFoundException('Book not found', [
                'bookId' => $bookid,
                'reason' => 'Book record does not exist in database'
            ]);
        }
        
        // Get module context for permission checking
        $context = context_module::instance($cm->id);
        
        // Enforce mod/book:read capability - user must have permission to view book
        // This uses checkCapability() which wraps require_capability() and throws
        // ForbiddenException if the authenticated user lacks the required capability
        $this->checkCapability('mod/book:read', $context);
        
        // Check if user can view hidden chapters
        // This determines whether to filter out hidden chapters from the response
        $canViewHidden = has_capability('mod/book:viewhiddenchapters', $context, $this->getUser()->id);
        
        // Load all chapters using book_preload_chapters() from mod/book/locallib.php
        // This function returns an array of chapter objects indexed by chapter ID,
        // with proper sorting, numbering (1, 1.1, x), parent-child relationships,
        // and visibility metadata already calculated
        $chapters = book_preload_chapters($book);
        
        // Initialize response array
        $formattedChapters = [];
        
        // Process each chapter and format for JSON response
        foreach ($chapters as $chapter) {
            // Filter hidden chapters if user cannot view them
            if ($chapter->hidden && !$canViewHidden) {
                continue; // Skip this chapter - user doesn't have permission to see it
            }
            
            // Generate content preview (first 200 characters without HTML tags)
            // This provides a brief snippet for displaying in chapter lists without
            // loading full chapter content which could be very large
            $contentPreview = '';
            if (!empty($chapter->content)) {
                // Remove HTML tags first to get clean text
                $cleanContent = strip_tags($chapter->content);
                // Extract first 200 characters
                $contentPreview = substr($cleanContent, 0, 200);
                // Add ellipsis if content was truncated
                if (strlen($cleanContent) > 200) {
                    $contentPreview .= '...';
                }
                // Trim any trailing whitespace
                $contentPreview = trim($contentPreview);
            }
            
            // Build formatted chapter object with all required fields
            $formattedChapter = [
                'id' => (int)$chapter->id,
                'bookid' => (int)$chapter->bookid,
                'pagenum' => (int)$chapter->pagenum,
                'subchapter' => (int)$chapter->subchapter, // 0 = main chapter, 1 = subchapter
                'title' => $chapter->title,
                'hidden' => (int)$chapter->hidden,
                'number' => $chapter->number, // Chapter numbering like '1', '1.1', 'x' for hidden
                'parent' => $chapter->parent, // Parent chapter ID for subchapters, null for main
                'contentPreview' => $contentPreview,
                'timecreated' => isset($chapter->timecreated) ? (int)$chapter->timecreated : 0,
                'timemodified' => isset($chapter->timemodified) ? (int)$chapter->timemodified : 0,
            ];
            
            $formattedChapters[] = $formattedChapter;
        }
        
        // Build response data with chapters array and total count
        $responseData = [
            'chapters' => $formattedChapters,
            'totalCount' => count($formattedChapters),
            'bookId' => (int)$bookid,
            'bookName' => $book->name,
            'numbering' => (int)$book->numbering, // Numbering style: 0=none, 1=numbers, 2=bullets, 3=indented
        ];
        
        // Return success response with formatted data
        // The success() method automatically sets CORS headers and sends JSON response
        $this->success($responseData);
    }
    
    /**
     * Handle POST request - not supported for this endpoint.
     *
     * @throws MethodNotAllowedException Always, as POST is not supported
     */
    protected function handle_post() {
        throw new MethodNotAllowedException('POST method is not supported for book chapters endpoint', [
            'allowedMethods' => ['GET']
        ]);
    }
    
    /**
     * Handle PUT request - not supported for this endpoint.
     *
     * @throws MethodNotAllowedException Always, as PUT is not supported
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method is not supported for book chapters endpoint', [
            'allowedMethods' => ['GET']
        ]);
    }
    
    /**
     * Handle DELETE request - not supported for this endpoint.
     *
     * @throws MethodNotAllowedException Always, as DELETE is not supported
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method is not supported for book chapters endpoint', [
            'allowedMethods' => ['GET']
        ]);
    }
}

// Instantiate and execute the endpoint
$endpoint = new BookChaptersEndpoint();
$endpoint->execute();
