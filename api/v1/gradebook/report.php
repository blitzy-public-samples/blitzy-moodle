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
 * REST API endpoint for generating comprehensive grade reports.
 *
 * This endpoint wraps existing Moodle grade report functionality to provide
 * JSON-formatted gradebook data suitable for React frontend consumption. It
 * supports multiple report types (user/student view, grader/teacher view,
 * and overview) with complete grade trees, formatted displays, and metadata.
 *
 * Endpoint: GET /api/v1/gradebook/report
 *
 * Query Parameters:
 * - courseid (required, int): Course ID to generate report for
 * - userid (optional, int): Specific user ID for user report type
 * - reporttype (optional, string): Type of report - 'user', 'grader', or 'overview' (default: 'user')
 *
 * Response Structure:
 * {
 *   "success": true,
 *   "data": {
 *     "metadata": {
 *       "courseid": 5,
 *       "coursename": "Introduction to Programming",
 *       "reporttype": "user",
 *       "userid": 42,
 *       "username": "johndoe",
 *       "generatedAt": "2024-11-18T07:30:00Z"
 *     },
 *     "gradeTree": {
 *       "categories": [...],
 *       "items": [...]
 *     },
 *     "grades": [
 *       {
 *         "userid": 42,
 *         "grades": {
 *           "itemid": {
 *             "grade": 85.5,
 *             "percentage": 85.5,
 *             "letter": "B",
 *             "formattedGrade": "85.50 / 100.00",
 *             "feedback": "Good work!"
 *           }
 *         },
 *         "courseTotal": {
 *           "grade": 82.3,
 *           "percentage": 82.3,
 *           "letter": "B",
 *           "formattedGrade": "82.30 / 100.00"
 *         }
 *       }
 *     ]
 *   }
 * }
 *
 * Capabilities Required:
 * - moodle/grade:view (for viewing own grades)
 * - moodle/grade:viewall (for viewing all student grades in grader report)
 *
 * @package    core_grades
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Load Moodle configuration and initialize environment
require_once(__DIR__ . '/../../../config.php');

// Load required Moodle libraries
require_once($CFG->libdir . '/gradelib.php');
require_once($CFG->dirroot . '/grade/lib.php');
require_once($CFG->dirroot . '/grade/report/lib.php');
require_once($CFG->dirroot . '/grade/querylib.php');

// Load API base class and utilities
require_once(__DIR__ . '/../../lib/api_base.php');
require_once(__DIR__ . '/../../lib/api_exception.php');

/**
 * Grade Report API Endpoint class.
 *
 * Handles GET requests to generate comprehensive gradebook reports. Wraps
 * existing Moodle grade_tree, grade_report, and grade calculation functions
 * to provide JSON responses without duplicating any business logic.
 *
 * Follows the thin wrapper pattern - all grade calculations, aggregations,
 * and formatting use existing Moodle core functions. No grade computation
 * logic is reimplemented here.
 */
class GradeReportEndpoint extends ApiBase {
    
    /**
     * Handle GET request to generate grade report.
     *
     * Extracts query parameters, validates permissions, builds grade tree
     * using existing Moodle functions, formats grades, and returns comprehensive
     * JSON response with report metadata, grade tree structure, and user grades.
     *
     * @return void Outputs JSON response via success() method
     * @throws ValidationException If required parameters are missing or invalid
     * @throws NotFoundException If course or user not found
     * @throws ForbiddenException If user lacks required capabilities
     */
    protected function handle_get() {
        global $DB, $CFG;
        
        // Extract and validate required courseid parameter
        $courseid = $this->getParam('courseid', PARAM_INT, true);
        
        // Extract optional userid parameter (null = authenticated user for user report, 0 = all users for grader report)
        $userid = $this->getParam('userid', PARAM_INT, false, null);
        
        // Extract optional report type (user/grader/overview, default: user)
        $reporttype = $this->getParam('reporttype', PARAM_ALPHA, false, 'user');
        
        // Validate report type
        $validReportTypes = ['user', 'grader', 'overview'];
        if (!in_array($reporttype, $validReportTypes)) {
            throw new ValidationException(
                'Invalid report type. Must be one of: user, grader, overview',
                [
                    'parameter' => 'reporttype',
                    'provided' => $reporttype,
                    'allowed' => $validReportTypes
                ]
            );
        }
        
        // Get authenticated user
        $currentuser = $this->getUser();
        
        // Verify course exists
        $course = $DB->get_record('course', ['id' => $courseid], '*', MUST_EXIST);
        if (!$course) {
            throw new NotFoundException(
                'Course not found',
                ['courseid' => $courseid]
            );
        }
        
        // Get course context for capability checking
        $context = context_course::instance($courseid);
        
        // Determine target userid and check appropriate capability based on report type
        if ($reporttype === 'grader') {
            // Grader report - teacher viewing all students
            // Requires viewall capability
            $this->checkCapability('moodle/grade:viewall', $context);
            
            // For grader report, userid parameter is ignored - we'll get all enrolled users
            $targetuserid = null;
            
        } else if ($reporttype === 'user') {
            // User report - student viewing own grades or teacher viewing specific student
            
            // If no userid specified, default to authenticated user (view own grades)
            if ($userid === null) {
                $targetuserid = $currentuser->id;
                // Check if user can view their own grades
                $this->checkCapability('moodle/grade:view', $context);
                
            } else {
                $targetuserid = $userid;
                
                // Verify target user exists
                $targetuser = $DB->get_record('user', ['id' => $targetuserid, 'deleted' => 0]);
                if (!$targetuser) {
                    throw new NotFoundException(
                        'User not found',
                        ['userid' => $targetuserid]
                    );
                }
                
                // Check if current user can view other user's grades
                if ($targetuserid !== $currentuser->id) {
                    // Viewing another user's grades requires viewall capability
                    $this->checkCapability('moodle/grade:viewall', $context);
                }
            }
            
        } else {
            // Overview report - requires view capability
            $this->checkCapability('moodle/grade:view', $context);
            $targetuserid = $userid ?: $currentuser->id;
        }
        
        // Ensure final grades are up to date before generating report
        // This calls existing Moodle function to regrade if needed
        grade_regrade_final_grades_if_required($course);
        
        // Build comprehensive report data using existing Moodle grade functions
        $reportData = $this->buildReportData($course, $context, $reporttype, $targetuserid);
        
        // Return success response with report data
        $this->success($reportData);
    }
    
    /**
     * Build comprehensive grade report data structure.
     *
     * Uses existing Moodle grade_tree class, grade calculation functions, and
     * formatting functions to assemble complete report data. All grade computations
     * use existing core functions - no business logic duplication.
     *
     * @param object $course Course object
     * @param context $context Course context
     * @param string $reporttype Type of report (user/grader/overview)
     * @param int|null $targetuserid Target user ID for user reports, null for grader report
     * @return array Comprehensive report data structure
     */
    protected function buildReportData($course, $context, $reporttype, $targetuserid) {
        global $DB, $CFG;
        
        // Initialize report data structure
        $reportData = [
            'metadata' => [
                'courseid' => $course->id,
                'coursename' => $course->fullname,
                'reporttype' => $reporttype,
                'generatedAt' => date('c'), // ISO 8601 format
            ],
            'gradeTree' => null,
            'grades' => [],
        ];
        
        // Build grade tree using existing Moodle grade_tree class
        // This handles all grade item hierarchies, categories, and aggregations
        $gtree = new grade_tree($course->id, false, false);
        
        // Extract grade tree structure for JSON response
        $reportData['gradeTree'] = $this->formatGradeTree($gtree);
        
        // Get grades based on report type
        if ($reporttype === 'user' && $targetuserid !== null) {
            // Single user report - get grades for specific user
            $reportData['metadata']['userid'] = $targetuserid;
            
            $targetuser = $DB->get_record('user', ['id' => $targetuserid], 'id, username, firstname, lastname');
            $reportData['metadata']['username'] = $targetuser->username;
            $reportData['metadata']['userfullname'] = fullname($targetuser);
            
            // Get user's grades using existing Moodle function
            $userGrades = $this->getUserGrades($course->id, $targetuserid, $gtree);
            $reportData['grades'] = [$userGrades];
            
        } else if ($reporttype === 'grader') {
            // Grader report - get grades for all enrolled users
            
            // Get all enrolled users with gradeable role using existing Moodle function
            $enrolledUsers = get_enrolled_users(
                $context,
                'moodle/grade:view',
                0, // No group filtering
                'u.id, u.username, u.firstname, u.lastname',
                'u.lastname ASC, u.firstname ASC'
            );
            
            // Get grades for each enrolled user
            foreach ($enrolledUsers as $user) {
                $userGrades = $this->getUserGrades($course->id, $user->id, $gtree);
                $reportData['grades'][] = $userGrades;
            }
            
        } else if ($reporttype === 'overview') {
            // Overview report - summary data for target user
            if ($targetuserid !== null) {
                $reportData['metadata']['userid'] = $targetuserid;
                
                $targetuser = $DB->get_record('user', ['id' => $targetuserid], 'id, username, firstname, lastname');
                $reportData['metadata']['username'] = $targetuser->username;
                $reportData['metadata']['userfullname'] = fullname($targetuser);
                
                // Get overview data - just course total and key metrics
                $userGrades = $this->getUserGrades($course->id, $targetuserid, $gtree);
                $reportData['grades'] = [$userGrades];
            }
        }
        
        return $reportData;
    }
    
    /**
     * Format grade tree structure for JSON response.
     *
     * Extracts grade tree structure from grade_tree object into clean JSON-friendly
     * array format. Includes categories, items, weights, aggregation methods.
     *
     * @param grade_tree $gtree Grade tree object from Moodle
     * @return array Formatted grade tree structure
     */
    protected function formatGradeTree($gtree) {
        $treeData = [
            'categories' => [],
            'items' => [],
        ];
        
        // Get top level items from grade tree
        if (!empty($gtree->top_element)) {
            $topElement = $gtree->top_element;
            
            // Process categories
            if (!empty($topElement['children'])) {
                foreach ($topElement['children'] as $element) {
                    if ($element['type'] === 'category') {
                        $treeData['categories'][] = $this->formatGradeCategory($element);
                    } else if ($element['type'] === 'item') {
                        $treeData['items'][] = $this->formatGradeItem($element);
                    }
                }
            }
        }
        
        return $treeData;
    }
    
    /**
     * Format grade category for JSON response.
     *
     * @param array $category Category element from grade tree
     * @return array Formatted category data
     */
    protected function formatGradeCategory($category) {
        $object = $category['object'];
        
        $categoryData = [
            'id' => $object->id,
            'fullname' => $object->fullname,
            'aggregation' => $object->aggregation,
            'aggregationName' => grade_helper::get_aggregation_string($object->aggregation),
            'keephigh' => $object->keephigh ?? 0,
            'droplow' => $object->droplow ?? 0,
            'items' => [],
        ];
        
        // Add child items
        if (!empty($category['children'])) {
            foreach ($category['children'] as $child) {
                if ($child['type'] === 'item') {
                    $categoryData['items'][] = $this->formatGradeItem($child);
                } else if ($child['type'] === 'category') {
                    $categoryData['items'][] = $this->formatGradeCategory($child);
                }
            }
        }
        
        return $categoryData;
    }
    
    /**
     * Format grade item for JSON response.
     *
     * @param array $item Item element from grade tree
     * @return array Formatted item data
     */
    protected function formatGradeItem($item) {
        $object = $item['object'];
        
        $itemData = [
            'id' => $object->id,
            'itemname' => $object->itemname ?? $object->get_name(),
            'itemtype' => $object->itemtype,
            'itemmodule' => $object->itemmodule ?? null,
            'iteminstance' => $object->iteminstance ?? null,
            'grademax' => $object->grademax,
            'grademin' => $object->grademin,
            'gradepass' => $object->gradepass ?? null,
            'multfactor' => $object->multfactor ?? 1.0,
            'plusfactor' => $object->plusfactor ?? 0.0,
            'aggregationcoef' => $object->aggregationcoef ?? 0.0,
            'aggregationcoef2' => $object->aggregationcoef2 ?? 0.0,
            'weightoverride' => $object->weightoverride ?? 0,
            'hidden' => $object->is_hidden() ?? false,
        ];
        
        return $itemData;
    }
    
    /**
     * Get all grades for a specific user.
     *
     * Uses existing Moodle grade_get_grades() and grade calculation functions.
     * Formats each grade with display strings, percentages, letter grades.
     *
     * @param int $courseid Course ID
     * @param int $userid User ID
     * @param grade_tree $gtree Grade tree object
     * @return array User grades data structure
     */
    protected function getUserGrades($courseid, $userid, $gtree) {
        global $DB, $CFG;
        
        $userGradesData = [
            'userid' => $userid,
            'grades' => [],
            'courseTotal' => null,
        ];
        
        // Get user object for fullname
        $user = $DB->get_record('user', ['id' => $userid], 'id, username, firstname, lastname');
        $userGradesData['username'] = $user->username;
        $userGradesData['userfullname'] = fullname($user);
        
        // Get course grade item (course total)
        $courseItem = grade_item::fetch(['courseid' => $courseid, 'itemtype' => 'course']);
        
        if ($courseItem) {
            // Get course total grade using existing Moodle function
            $courseGrade = new grade_grade(['itemid' => $courseItem->id, 'userid' => $userid]);
            $courseGrade->grade_item =& $courseItem;
            $courseGrade->load_grade_item();
            
            // Format course total
            $userGradesData['courseTotal'] = $this->formatGrade($courseGrade, $courseItem);
        }
        
        // Get all grade items for this course
        $gradeItems = grade_item::fetch_all(['courseid' => $courseid]);
        
        if ($gradeItems) {
            foreach ($gradeItems as $gradeItem) {
                // Skip course item (already included as courseTotal)
                if ($gradeItem->itemtype === 'course') {
                    continue;
                }
                
                // Get user's grade for this item using existing Moodle function
                $grade = new grade_grade(['itemid' => $gradeItem->id, 'userid' => $userid]);
                $grade->grade_item =& $gradeItem;
                $grade->load_grade_item();
                
                // Format grade data
                $formattedGrade = $this->formatGrade($grade, $gradeItem);
                
                // Add to grades array keyed by item id
                $userGradesData['grades'][$gradeItem->id] = $formattedGrade;
            }
        }
        
        return $userGradesData;
    }
    
    /**
     * Format a grade for JSON response.
     *
     * Uses existing Moodle grade formatting functions. Includes raw grade value,
     * percentage, letter grade (if configured), formatted display string, and feedback.
     *
     * @param grade_grade $grade Grade object
     * @param grade_item $gradeItem Grade item object
     * @return array Formatted grade data
     */
    protected function formatGrade($grade, $gradeItem) {
        global $CFG;
        
        $gradeData = [
            'grade' => null,
            'percentage' => null,
            'letter' => null,
            'formattedGrade' => null,
            'feedback' => null,
            'dategraded' => null,
            'hidden' => false,
        ];
        
        // Check if grade exists and is not null
        if ($grade->finalgrade !== null) {
            $gradeData['grade'] = (float) $grade->finalgrade;
            $gradeData['dategraded'] = $grade->timemodified ? date('c', $grade->timemodified) : null;
            
            // Calculate percentage using existing Moodle function
            $percentage = grade_format_gradevalue(
                $grade->finalgrade,
                $gradeItem,
                true,
                GRADE_DISPLAY_TYPE_PERCENTAGE,
                0
            );
            
            // Extract numeric percentage value
            if (preg_match('/([0-9.]+)/', $percentage, $matches)) {
                $gradeData['percentage'] = (float) $matches[1];
            }
            
            // Get letter grade if configured using existing Moodle function
            if ($gradeItem->display == GRADE_DISPLAY_TYPE_LETTER || 
                $gradeItem->display == GRADE_DISPLAY_TYPE_LETTER_PERCENTAGE ||
                $gradeItem->display == GRADE_DISPLAY_TYPE_LETTER_REAL) {
                
                $letterGrade = grade_format_gradevalue(
                    $grade->finalgrade,
                    $gradeItem,
                    true,
                    GRADE_DISPLAY_TYPE_LETTER,
                    0
                );
                
                $gradeData['letter'] = trim($letterGrade);
            }
            
            // Get formatted grade string using existing Moodle function
            $gradeData['formattedGrade'] = grade_format_gradevalue(
                $grade->finalgrade,
                $gradeItem,
                true,
                $gradeItem->display ?? GRADE_DISPLAY_TYPE_REAL,
                2
            );
            
            // Get feedback if available
            if (!empty($grade->feedback)) {
                $gradeData['feedback'] = format_text(
                    $grade->feedback,
                    $grade->feedbackformat ?? FORMAT_PLAIN
                );
            }
            
            // Check if grade is hidden
            $gradeData['hidden'] = $grade->is_hidden() ?? false;
            
        } else {
            // No grade recorded yet
            $gradeData['formattedGrade'] = '-';
        }
        
        return $gradeData;
    }
    
    /**
     * Handle POST requests - not supported for this endpoint.
     *
     * @throws MethodNotAllowedException Always
     */
    protected function handle_post() {
        throw new MethodNotAllowedException('POST method not supported for grade reports');
    }
    
    /**
     * Handle PUT requests - not supported for this endpoint.
     *
     * @throws MethodNotAllowedException Always
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method not supported for grade reports');
    }
    
    /**
     * Handle DELETE requests - not supported for this endpoint.
     *
     * @throws MethodNotAllowedException Always
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method not supported for grade reports');
    }
}

// Instantiate and execute the endpoint
if (!defined('API_TEST_MODE')) {
    $endpoint = new GradeReportEndpoint();
    $endpoint->execute();
}
