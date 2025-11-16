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
 * REST API endpoint for retrieving book activity details.
 *
 * This endpoint provides comprehensive book metadata including configuration settings,
 * chapter information, and user permissions. It serves as the primary data source for
 * initializing book displays in the React frontend.
 *
 * Endpoint: GET /api/v1/book/{id}
 *
 * Response includes:
 * - Basic book information (id, name, intro text)
 * - Configuration settings (numbering style, navigation style, custom titles flag)
 * - Chapter statistics (total count, visible count)
 * - User permissions (can edit, can view hidden chapters)
 * - Metadata (timestamps, revision number)
 *
 * The endpoint delegates all business logic to existing Moodle book module functions,
 * ensuring consistency with the PHP-rendered interface and zero duplication of
 * business logic.
 *
 * @package    api
 * @subpackage v1
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Load Moodle configuration
require_once(__DIR__ . '/../../../config.php');

// Load core Moodle libraries
require_once($CFG->libdir . '/moodlelib.php');
require_once($CFG->dirroot . '/mod/book/lib.php');
require_once($CFG->dirroot . '/mod/book/locallib.php');

// Load API base class and exception handlers
require_once(__DIR__ . '/../../lib/api_base.php');
require_once(__DIR__ . '/../../lib/api_exception.php');

/**
 * Book detail endpoint implementation.
 *
 * Extends ApiBase to provide REST API access to book activity details. Handles
 * JWT authentication, permission checking, and response formatting automatically
 * through the parent class infrastructure.
 *
 * This endpoint wraps the existing Moodle book module functions without reimplementing
 * any business logic, following the thin wrapper pattern mandated by the refactoring
 * requirements.
 */
class BookShowEndpoint extends ApiBase {
    
    /**
     * Handle GET request to retrieve book details.
     *
     * Validates the book ID parameter, retrieves book and course module records,
     * enforces permission checks, loads chapter information, and returns formatted
     * JSON response with comprehensive book metadata.
     *
     * Process flow:
     * 1. Extract and validate book ID from URL parameter
     * 2. Retrieve course module record for the book
     * 3. Retrieve book record from database
     * 4. Enforce mod/book:read capability
     * 5. Check additional capabilities (edit, viewhiddenchapters)
     * 6. Load all chapters using book_preload_chapters()
     * 7. Count total and visible chapters based on user permissions
     * 8. Return standardized JSON response with book data
     *
     * @return void Outputs JSON response via success() method
     * @throws ValidationException If book ID parameter is invalid or missing
     * @throws NotFoundException If book or course module does not exist
     * @throws ForbiddenException If user lacks mod/book:read capability
     */
    protected function handle_get() {
        global $DB;
        
        // Extract book ID from URL parameter with integer validation
        // This uses PARAM_INT to ensure the ID is a valid integer
        $bookid = $this->getParam('id', PARAM_INT);
        
        try {
            // Step 1: Retrieve course module record for validation
            // Use MUST_EXIST flag to automatically throw exception if not found
            // Parameters: modulename, instanceid, courseid (0=any), strictness, failuremode
            $cm = get_coursemodule_from_instance('book', $bookid, 0, false, MUST_EXIST);
            
            // Step 2: Retrieve book record from database
            // Use MUST_EXIST flag to ensure book exists
            $book = $DB->get_record('book', ['id' => $bookid], '*', MUST_EXIST);
            
            // Step 3: Retrieve course record for context
            $course = $DB->get_record('course', ['id' => $cm->course], '*', MUST_EXIST);
            
        } catch (dml_missing_record_exception $e) {
            // Convert database exceptions to API NotFoundException
            throw new NotFoundException("Book with id {$bookid} not found", [
                'bookId' => $bookid,
                'originalError' => $e->getMessage()
            ]);
        } catch (moodle_exception $e) {
            // Handle other Moodle exceptions (e.g., invalid course module)
            throw new NotFoundException("Book or course module not found", [
                'bookId' => $bookid,
                'originalError' => $e->getMessage()
            ]);
        }
        
        // Step 4: Get context for permission checking
        $context = context_module::instance($cm->id);
        
        // Step 5: Enforce primary permission - user must have read capability
        // This uses the inherited checkCapability() method which automatically
        // throws ForbiddenException if permission check fails
        $this->checkCapability('mod/book:read', $context);
        
        // Step 6: Check additional capabilities for permission flags
        // These capabilities determine what the user can do with the book
        $user = $this->getUser();
        
        // Check if user can edit the book (create/modify chapters)
        $canEdit = has_capability('mod/book:edit', $context, $user->id);
        
        // Check if user can view hidden chapters (typically teachers/admins)
        $canViewHidden = has_capability('mod/book:viewhiddenchapters', $context, $user->id);
        
        // Step 7: Load all chapters for the book
        // This function preloads chapters with proper sorting, numbering, and relationships
        // It returns an array of chapter objects indexed by chapter ID
        // Delegates to existing Moodle function - zero business logic duplication
        $chapters = book_preload_chapters($book);
        
        // Step 8: Count chapters based on visibility and user permissions
        $totalChapters = 0;
        $visibleChapters = 0;
        
        if ($chapters) {
            foreach ($chapters as $chapter) {
                $totalChapters++;
                
                // A chapter is visible to the user if:
                // - It is not hidden (hidden flag = 0), OR
                // - User has permission to view hidden chapters
                if (!$chapter->hidden || $canViewHidden) {
                    $visibleChapters++;
                }
            }
        }
        
        // Step 9: Build response data structure
        // This matches the structure expected by the React frontend
        $responseData = [
            // Core identifiers
            'id' => (int)$book->id,
            'course' => (int)$book->course,
            'courseModuleId' => (int)$cm->id,
            
            // Book content and settings
            'name' => $book->name,
            'intro' => $book->intro,
            'introformat' => (int)$book->introformat,
            
            // Display configuration
            // numbering: 0=none, 1=numbers, 2=bullets, 3=indented
            'numbering' => (int)$book->numbering,
            'navstyle' => (int)$book->navstyle,
            'customtitles' => (bool)$book->customtitles,
            
            // Chapter statistics
            'chapterCount' => $totalChapters,
            'visibleChapterCount' => $visibleChapters,
            
            // User permissions for UI rendering
            'canEdit' => $canEdit,
            'canViewHidden' => $canViewHidden,
            
            // Metadata
            'revision' => (int)$book->revision,
            'timecreated' => (int)$book->timecreated,
            'timemodified' => (int)$book->timemodified,
        ];
        
        // Step 10: Return success response with book data
        // The success() method automatically sets CORS headers and formats
        // the response in the standard envelope structure
        $this->success($responseData);
    }
    
    /**
     * Handle POST request - not supported for this endpoint.
     *
     * Book detail retrieval is a read-only operation and does not support POST.
     * Creating or updating books is handled by separate endpoints.
     *
     * @return void
     * @throws MethodNotAllowedException Always, as POST is not supported
     */
    protected function handle_post() {
        throw new MethodNotAllowedException('POST method is not allowed for book detail retrieval', [
            'allowedMethods' => ['GET'],
            'endpoint' => '/api/v1/book/{id}'
        ]);
    }
    
    /**
     * Handle PUT request - not supported for this endpoint.
     *
     * Book detail retrieval is a read-only operation and does not support PUT.
     * Updating books is handled by separate endpoints.
     *
     * @return void
     * @throws MethodNotAllowedException Always, as PUT is not supported
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method is not allowed for book detail retrieval', [
            'allowedMethods' => ['GET'],
            'endpoint' => '/api/v1/book/{id}'
        ]);
    }
    
    /**
     * Handle DELETE request - not supported for this endpoint.
     *
     * Book detail retrieval is a read-only operation and does not support DELETE.
     * Deleting books is handled by separate endpoints or through the course
     * module deletion workflow.
     *
     * @return void
     * @throws MethodNotAllowedException Always, as DELETE is not supported
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method is not allowed for book detail retrieval', [
            'allowedMethods' => ['GET'],
            'endpoint' => '/api/v1/book/{id}'
        ]);
    }
}

// Instantiate and execute the endpoint
// The ApiBase constructor handles JWT authentication automatically
// The execute() method routes to handle_get() and handles exceptions
$endpoint = new BookShowEndpoint();
$endpoint->execute();
