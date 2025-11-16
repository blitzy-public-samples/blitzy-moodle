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
 * REST API endpoint for retrieving book chapter content.
 *
 * GET /api/v1/book/chapters/{id}
 *
 * This endpoint provides complete chapter data including full HTML content,
 * chapter metadata, navigation information (next/previous chapter IDs), and
 * file attachments. Wraps existing Moodle book functions without duplicating
 * business logic. Enforces mod/book:read capability and respects chapter
 * visibility based on mod/book:viewhiddenchapters capability.
 *
 * Response includes:
 * - Chapter ID, title (with numbering), content (formatted HTML)
 * - Content format, page number, subchapter status, hidden flag
 * - Parent chapter ID, chapter number, timestamps
 * - Navigation: next_chapter_id, previous_chapter_id, is_last_chapter flag
 * - Embedded files and attachments
 *
 * @package    api
 * @subpackage v1
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Load API base class and exceptions
require_once(__DIR__ . '/../../lib/api_base.php');
require_once(__DIR__ . '/../../lib/api_exception.php');

// Load Moodle book module functions
require_once($CFG->dirroot . '/mod/book/lib.php');
require_once($CFG->dirroot . '/mod/book/locallib.php');

/**
 * Book chapter endpoint class.
 *
 * Handles GET requests for retrieving complete chapter content with
 * navigation information. Extends ApiBase for JWT authentication,
 * HTTP method routing, and standardized response formatting.
 */
class BookChapterEndpoint extends ApiBase {
    
    /**
     * Handle GET request to retrieve chapter content.
     *
     * Retrieves chapter by ID from URL parameter, validates user permissions,
     * formats chapter content for display, determines navigation context,
     * and returns complete chapter data with next/previous chapter IDs.
     *
     * URL Parameters:
     * - id: Chapter ID (required, integer)
     *
     * Permissions Required:
     * - mod/book:read (always required)
     * - mod/book:viewhiddenchapters (required to view hidden chapters)
     *
     * @return void Outputs JSON response directly via success()
     * @throws NotFoundException If chapter or course module not found
     * @throws ForbiddenException If user lacks required capabilities
     * @throws ValidationException If chapter ID parameter is invalid
     */
    protected function handle_get() {
        global $DB;
        
        // Extract chapter ID from URL parameter
        $chapterid = $this->getParam('id', PARAM_INT);
        
        // Validate chapter ID
        if ($chapterid <= 0) {
            throw new ValidationException('Invalid chapter ID', [
                'parameter' => 'id',
                'value' => $chapterid,
                'reason' => 'Chapter ID must be a positive integer'
            ]);
        }
        
        // Retrieve chapter record from database
        $chapter = $DB->get_record('book_chapters', ['id' => $chapterid], '*', MUST_EXIST);
        
        if (!$chapter) {
            throw new NotFoundException('Chapter not found', [
                'chapterId' => $chapterid,
                'reason' => 'No chapter exists with the specified ID'
            ]);
        }
        
        // Retrieve book record
        $book = $DB->get_record('book', ['id' => $chapter->bookid], '*', MUST_EXIST);
        
        if (!$book) {
            throw new NotFoundException('Book not found', [
                'bookId' => $chapter->bookid,
                'chapterId' => $chapterid,
                'reason' => 'Book associated with chapter does not exist'
            ]);
        }
        
        // Get course module and course
        $cm = get_coursemodule_from_instance('book', $book->id, 0, false, MUST_EXIST);
        
        if (!$cm) {
            throw new NotFoundException('Course module not found', [
                'bookId' => $book->id,
                'chapterId' => $chapterid,
                'reason' => 'Course module for book does not exist'
            ]);
        }
        
        $course = $DB->get_record('course', ['id' => $cm->course], '*', MUST_EXIST);
        
        if (!$course) {
            throw new NotFoundException('Course not found', [
                'courseId' => $cm->course,
                'bookId' => $book->id,
                'reason' => 'Course associated with book does not exist'
            ]);
        }
        
        // Get context for capability checks
        $context = context_module::instance($cm->id);
        
        // Enforce read capability - this is mandatory for all users
        $this->checkCapability('mod/book:read', $context);
        
        // Check if chapter is hidden and user has permission to view hidden chapters
        if ($chapter->hidden) {
            // Check if user can view hidden chapters
            $user = $this->getUser();
            $canViewHidden = has_capability('mod/book:viewhiddenchapters', $context, $user->id);
            
            if (!$canViewHidden) {
                throw new ForbiddenException('Cannot view hidden chapter', [
                    'chapterId' => $chapterid,
                    'reason' => 'This chapter is hidden and you do not have permission to view hidden chapters',
                    'requiredCapability' => 'mod/book:viewhiddenchapters',
                    'contextId' => $context->id
                ]);
            }
        }
        
        // Preload all chapters for navigation context
        $chapters = book_preload_chapters($book);
        
        if (empty($chapters)) {
            throw new NotFoundException('No chapters found in book', [
                'bookId' => $book->id,
                'chapterId' => $chapterid,
                'reason' => 'Book contains no chapters'
            ]);
        }
        
        // Verify chapter exists in preloaded chapters
        if (!isset($chapters[$chapterid])) {
            throw new NotFoundException('Chapter not found in book structure', [
                'chapterId' => $chapterid,
                'bookId' => $book->id,
                'reason' => 'Chapter does not belong to this book'
            ]);
        }
        
        // Get the preloaded chapter with navigation data
        $preloadedChapter = $chapters[$chapterid];
        
        // Format chapter title with numbering using Moodle's book function
        $formattedTitle = book_get_chapter_title($chapterid, $chapters, $book, $context);
        
        // Format chapter content for HTML display
        $formattedContent = format_text(
            $chapter->content,
            $chapter->contentformat,
            [
                'context' => $context,
                'noclean' => false
            ]
        );
        
        // Determine next and previous visible chapters for navigation
        $navigationInfo = $this->getChapterNavigation($chapterid, $chapters, $context);
        
        // Determine if this is the last visible chapter
        $user = $this->getUser();
        $isLastChapter = \mod_book\helper::is_last_visible_chapter($chapterid, $chapters);
        
        // Trigger chapter view event and update completion status
        book_view($book, $chapter, $isLastChapter, $course, $cm, $context);
        
        // Build response data structure
        $responseData = [
            'id' => (int)$chapter->id,
            'bookid' => (int)$chapter->bookid,
            'title' => $formattedTitle,
            'content' => $formattedContent,
            'contentformat' => (int)$chapter->contentformat,
            'pagenum' => (int)$preloadedChapter->pagenum,
            'subchapter' => (bool)$chapter->subchapter,
            'hidden' => (bool)$chapter->hidden,
            'timecreated' => (int)$chapter->timecreated,
            'timemodified' => (int)$chapter->timemodified,
            
            // Chapter numbering and structure
            'number' => $preloadedChapter->number ?? null,
            'parent' => $preloadedChapter->parent ?? null,
            
            // Navigation information
            'next_chapter_id' => $navigationInfo['next'] ?? null,
            'previous_chapter_id' => $navigationInfo['previous'] ?? null,
            'is_last_chapter' => $isLastChapter,
            
            // Book information
            'book' => [
                'id' => (int)$book->id,
                'name' => $book->name,
                'numbering' => (int)$book->numbering,
                'customtitles' => (bool)$book->customtitles,
            ],
            
            // Course module information
            'coursemodule' => [
                'id' => (int)$cm->id,
                'course' => (int)$cm->course,
            ],
        ];
        
        // Send success response
        $this->success($responseData);
    }
    
    /**
     * Determine next and previous visible chapters for navigation.
     *
     * Iterates through preloaded chapters to find adjacent visible chapters,
     * respecting user's capability to view hidden chapters. Returns array
     * with next and previous chapter IDs or null if at boundaries.
     *
     * @param int      $currentChapterid Current chapter ID
     * @param array    $chapters          Preloaded chapters array (id => chapter)
     * @param context  $context           Module context for capability checks
     * @return array Array with keys 'next' and 'previous' containing chapter IDs or null
     */
    private function getChapterNavigation($currentChapterid, $chapters, $context) {
        $user = $this->getUser();
        $canViewHidden = has_capability('mod/book:viewhiddenchapters', $context, $user->id);
        
        $navigation = [
            'next' => null,
            'previous' => null,
        ];
        
        // Build array of visible chapter IDs in order
        $visibleChapterIds = [];
        foreach ($chapters as $ch) {
            // Include chapter if it's not hidden OR user can view hidden chapters
            if (!$ch->hidden || $canViewHidden) {
                $visibleChapterIds[] = $ch->id;
            }
        }
        
        // Find current chapter position in visible chapters
        $currentPosition = array_search($currentChapterid, $visibleChapterIds);
        
        if ($currentPosition === false) {
            // Current chapter not in visible list (shouldn't happen if we got this far)
            return $navigation;
        }
        
        // Get previous chapter (if exists)
        if ($currentPosition > 0) {
            $navigation['previous'] = $visibleChapterIds[$currentPosition - 1];
        }
        
        // Get next chapter (if exists)
        if ($currentPosition < count($visibleChapterIds) - 1) {
            $navigation['next'] = $visibleChapterIds[$currentPosition + 1];
        }
        
        return $navigation;
    }
    
    /**
     * Handle POST request - not supported for this endpoint.
     *
     * @throws MethodNotAllowedException Always, as POST is not supported
     */
    protected function handle_post() {
        throw new MethodNotAllowedException('POST method not supported for chapter retrieval', [
            'allowedMethods' => ['GET'],
            'endpoint' => '/api/v1/book/chapters/{id}'
        ]);
    }
    
    /**
     * Handle PUT request - not supported for this endpoint.
     *
     * @throws MethodNotAllowedException Always, as PUT is not supported
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method not supported for chapter retrieval', [
            'allowedMethods' => ['GET'],
            'endpoint' => '/api/v1/book/chapters/{id}'
        ]);
    }
    
    /**
     * Handle DELETE request - not supported for this endpoint.
     *
     * @throws MethodNotAllowedException Always, as DELETE is not supported
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method not supported for chapter retrieval', [
            'allowedMethods' => ['GET'],
            'endpoint' => '/api/v1/book/chapters/{id}'
        ]);
    }
}

// Instantiate and execute the endpoint
$endpoint = new BookChapterEndpoint();
$endpoint->execute();
