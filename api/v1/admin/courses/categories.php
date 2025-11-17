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
 * REST API endpoint for course category management (CRUD operations).
 *
 * Provides complete category management functionality for admin users including:
 * - GET: List all categories or filter by parent with pagination
 * - POST: Create new categories with validation
 * - PUT: Update existing categories
 * - DELETE: Delete categories with options to delete contents or move to parent
 *
 * All operations enforce moodle/category:manage capability and delegate to
 * core_course_category class methods. Returns standard JSON responses with
 * comprehensive error handling.
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Include required files
require_once(__DIR__ . '/../../../../config.php');
require_once(__DIR__ . '/../../../lib/api_base.php');
require_once(__DIR__ . '/../../../lib/api_exception.php');
require_once($CFG->dirroot . '/course/lib.php');
// Note: core_course_category is autoloaded from /course/classes/category.php in Moodle 4.x

/**
 * Course Categories API Endpoint.
 *
 * Handles all CRUD operations for course categories. Extends ApiBase to inherit
 * JWT authentication, HTTP method routing, and standard response formatting.
 *
 * Endpoint patterns:
 * - GET    /api/v1/admin/courses/categories - List categories with optional parent filter
 * - POST   /api/v1/admin/courses/categories - Create new category
 * - PUT    /api/v1/admin/courses/categories/{id} - Update category
 * - DELETE /api/v1/admin/courses/categories/{id} - Delete category
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class CourseCategoriesEndpoint extends ApiBase {
    
    /**
     * Handle GET requests - List course categories.
     *
     * Returns paginated list of all categories or filters by parent category.
     * Each category includes: id, name, idnumber, description, parent, sortorder,
     * coursecount, visible, depth, and path.
     *
     * Query parameters:
     * - parent (int, optional): Filter categories by parent ID
     * - page (int, default 1): Page number for pagination
     * - perPage (int, default 20): Number of items per page
     *
     * Response format:
     * {
     *   "success": true,
     *   "data": [
     *     {
     *       "id": 1,
     *       "name": "Category Name",
     *       "idnumber": "CAT001",
     *       "description": "Category description",
     *       "parent": 0,
     *       "sortorder": 10000,
     *       "coursecount": 5,
     *       "visible": 1,
     *       "depth": 1,
     *       "path": "/1"
     *     }
     *   ],
     *   "meta": {
     *     "pagination": {
     *       "page": 1,
     *       "perPage": 20,
     *       "total": 50,
     *       "totalPages": 3
     *     }
     *   }
     * }
     *
     * @return void Outputs JSON response
     * @throws ForbiddenException If user lacks moodle/category:manage capability
     * @throws NotFoundException If parent category does not exist
     */
    protected function handle_get() {
        global $DB;
        
        // Check capability in system context
        $systemcontext = context_system::instance();
        $this->checkCapability('moodle/category:manage', $systemcontext);
        
        // Extract query parameters
        $parent = $this->getParam('parent', PARAM_INT, false, null);
        $page = $this->getParam('page', PARAM_INT, false, 1);
        $perPage = $this->getParam('perPage', PARAM_INT, false, 20);
        
        // Validate page and perPage
        if ($page < 1) {
            $page = 1;
        }
        if ($perPage < 1 || $perPage > 100) {
            $perPage = 20;
        }
        
        // Retrieve categories based on parent filter
        $categories = [];
        
        if ($parent !== null) {
            // Filter by parent category
            try {
                $parentcategory = core_course_category::get($parent, MUST_EXIST, true);
                $childcategories = $parentcategory->get_children();
                
                // Convert to array format
                foreach ($childcategories as $category) {
                    $categories[] = $this->formatCategoryData($category);
                }
                
            } catch (moodle_exception $e) {
                throw new NotFoundException("Parent category not found", [
                    'parentId' => $parent,
                    'error' => $e->getMessage()
                ]);
            }
            
        } else {
            // Get all categories
            $allcategories = core_course_category::get_all_children(0);
            
            foreach ($allcategories as $category) {
                $categories[] = $this->formatCategoryData($category);
            }
        }
        
        // Implement pagination
        $total = count($categories);
        $totalPages = ceil($total / $perPage);
        $offset = ($page - 1) * $perPage;
        
        // Slice array for current page
        $paginatedCategories = array_slice($categories, $offset, $perPage);
        
        // Build pagination metadata
        $meta = [
            'pagination' => [
                'page' => $page,
                'perPage' => $perPage,
                'total' => $total,
                'totalPages' => $totalPages
            ]
        ];
        
        // Return success response with pagination
        $this->success($paginatedCategories, 200, $meta);
    }
    
    /**
     * Handle POST requests - Create new course category.
     *
     * Creates a new course category with the provided data. Validates required
     * fields and enforces capability checks in the appropriate context.
     *
     * Request body (JSON):
     * {
     *   "name": "New Category",          // Required
     *   "parent": 0,                     // Optional, default 0 (top level)
     *   "description": "Description",    // Optional
     *   "idnumber": "CAT001",           // Optional
     *   "visible": 1                     // Optional, default 1
     * }
     *
     * Response format:
     * {
     *   "success": true,
     *   "data": {
     *     "id": 10,
     *     "name": "New Category",
     *     ...
     *   }
     * }
     *
     * @return void Outputs JSON response with 201 Created status
     * @throws ValidationException If required fields missing or invalid
     * @throws ForbiddenException If user lacks required capability
     */
    protected function handle_post() {
        global $DB;
        
        // Extract and validate JSON body
        $requestData = $this->getJsonBody();
        
        // Validate required 'name' field
        if (empty($requestData['name'])) {
            throw new ValidationException("Missing required field: 'name'", [
                'field' => 'name',
                'reason' => 'Category name is required and cannot be empty'
            ]);
        }
        
        // Extract and validate optional fields
        $parent = isset($requestData['parent']) ? (int)$requestData['parent'] : 0;
        $description = isset($requestData['description']) ? trim($requestData['description']) : '';
        $idnumber = isset($requestData['idnumber']) ? trim($requestData['idnumber']) : '';
        $visible = isset($requestData['visible']) ? (int)$requestData['visible'] : 1;
        
        // Check capability in appropriate context
        if ($parent > 0) {
            // Check capability in parent category context
            try {
                $parentcontext = context_coursecat::instance($parent);
                $this->checkCapability('moodle/category:manage', $parentcontext);
            } catch (moodle_exception $e) {
                throw new NotFoundException("Parent category not found", [
                    'parentId' => $parent,
                    'error' => $e->getMessage()
                ]);
            }
        } else {
            // Check capability in system context for top-level category
            $systemcontext = context_system::instance();
            $this->checkCapability('moodle/category:manage', $systemcontext);
        }
        
        // Build data object for category creation
        $data = new stdClass();
        $data->name = trim($requestData['name']);
        $data->parent = $parent;
        $data->description = $description;
        $data->idnumber = $idnumber;
        $data->visible = $visible;
        
        // Create category using core function
        try {
            $category = core_course_category::create($data);
            
            // Format and return created category
            $categoryData = $this->formatCategoryData($category);
            $this->success($categoryData, 201);
            
        } catch (moodle_exception $e) {
            // Convert Moodle exception to API exception
            throw new ServerException("Failed to create category: " . $e->getMessage(), [
                'errorcode' => $e->errorcode,
                'data' => $data
            ]);
        }
    }
    
    /**
     * Handle PUT requests - Update existing course category.
     *
     * Updates an existing course category with the provided data. Category ID
     * is extracted from the request URI. Only provided fields are updated.
     *
     * URI pattern: /api/v1/admin/courses/categories/{id}
     *
     * Request body (JSON):
     * {
     *   "name": "Updated Name",          // Optional
     *   "parent": 5,                     // Optional
     *   "description": "New description", // Optional
     *   "idnumber": "CAT001",           // Optional
     *   "visible": 0,                    // Optional
     *   "sortorder": 10000               // Optional
     * }
     *
     * Response format:
     * {
     *   "success": true,
     *   "data": {
     *     "id": 10,
     *     "name": "Updated Name",
     *     ...
     *   }
     * }
     *
     * @return void Outputs JSON response
     * @throws ValidationException If category ID is invalid
     * @throws NotFoundException If category does not exist
     * @throws ForbiddenException If user lacks required capability
     */
    protected function handle_put() {
        global $DB;
        
        // Extract category ID from request URI
        $categoryId = $this->extractIdFromUri();
        
        // Load category
        try {
            $category = core_course_category::get($categoryId, MUST_EXIST, true);
        } catch (moodle_exception $e) {
            throw new NotFoundException("Category not found", [
                'categoryId' => $categoryId,
                'error' => $e->getMessage()
            ]);
        }
        
        // Check capability in category context
        $categorycontext = context_coursecat::instance($categoryId);
        $this->checkCapability('moodle/category:manage', $categorycontext);
        
        // Extract and validate JSON body
        $requestData = $this->getJsonBody();
        
        // Build data object with only provided fields
        $data = new stdClass();
        
        if (isset($requestData['name'])) {
            if (empty(trim($requestData['name']))) {
                throw new ValidationException("Category name cannot be empty", [
                    'field' => 'name'
                ]);
            }
            $data->name = trim($requestData['name']);
        }
        
        if (isset($requestData['parent'])) {
            $data->parent = (int)$requestData['parent'];
        }
        
        if (isset($requestData['description'])) {
            $data->description = trim($requestData['description']);
        }
        
        if (isset($requestData['idnumber'])) {
            $data->idnumber = trim($requestData['idnumber']);
        }
        
        if (isset($requestData['visible'])) {
            $data->visible = (int)$requestData['visible'];
        }
        
        if (isset($requestData['sortorder'])) {
            $data->sortorder = (int)$requestData['sortorder'];
        }
        
        // Update category using core function
        try {
            $category->update($data);
            
            // Reload category to get updated data
            $updatedCategory = core_course_category::get($categoryId, MUST_EXIST, true);
            
            // Format and return updated category
            $categoryData = $this->formatCategoryData($updatedCategory);
            $this->success($categoryData, 200);
            
        } catch (moodle_exception $e) {
            // Convert Moodle exception to API exception
            throw new ServerException("Failed to update category: " . $e->getMessage(), [
                'errorcode' => $e->errorcode,
                'categoryId' => $categoryId,
                'data' => $data
            ]);
        }
    }
    
    /**
     * Handle DELETE requests - Delete course category.
     *
     * Deletes an existing course category. Category ID is extracted from the
     * request URI. Supports two deletion modes:
     * - recursive=true: Delete category and all courses/subcategories within it
     * - recursive=false: Move courses and subcategories to parent before deleting
     *
     * URI pattern: /api/v1/admin/courses/categories/{id}?recursive=true
     *
     * Query parameters:
     * - recursive (bool, default false): Whether to delete contents recursively
     *
     * Response: 204 No Content on success
     *
     * @return void Outputs 204 No Content response
     * @throws ValidationException If category cannot be deleted or ID is invalid
     * @throws NotFoundException If category does not exist
     * @throws ForbiddenException If user lacks required capability
     * @throws ConflictException If deletion violates database constraints
     */
    protected function handle_delete() {
        global $DB;
        
        // Extract category ID from request URI
        $categoryId = $this->extractIdFromUri();
        
        // Load category
        try {
            $category = core_course_category::get($categoryId, MUST_EXIST, true);
        } catch (moodle_exception $e) {
            throw new NotFoundException("Category not found", [
                'categoryId' => $categoryId,
                'error' => $e->getMessage()
            ]);
        }
        
        // Check capability in category context
        $categorycontext = context_coursecat::instance($categoryId);
        $this->checkCapability('moodle/category:manage', $categorycontext);
        
        // Check if category can be deleted
        if (!$category->can_delete()) {
            throw new ValidationException("Category cannot be deleted", [
                'categoryId' => $categoryId,
                'reason' => 'Category may contain courses or subcategories that must be moved first'
            ]);
        }
        
        // Extract 'recursive' parameter
        $recursive = $this->getParam('recursive', PARAM_BOOL, false, false);
        
        // Delete category
        try {
            if ($recursive) {
                // Delete category and all contents recursively
                $category->delete_full();
            } else {
                // Move contents to parent before deleting
                $newparent = $category->parent;
                $category->delete_move($newparent);
            }
            
            // Return 204 No Content
            $this->success(null, 204);
            
        } catch (moodle_exception $e) {
            // Convert to ConflictException for constraint violations
            throw new ConflictException("Cannot delete category: " . $e->getMessage(), [
                'errorcode' => $e->errorcode,
                'categoryId' => $categoryId,
                'recursive' => $recursive
            ]);
        }
    }
    
    /**
     * Format category object to array for API response.
     *
     * Extracts all required fields from a core_course_category object and
     * formats them as an associative array suitable for JSON serialization.
     *
     * @param core_course_category $category Category object to format
     * @return array Formatted category data with all required fields
     */
    private function formatCategoryData($category) {
        return [
            'id' => $category->id,
            'name' => $category->name,
            'idnumber' => $category->idnumber,
            'description' => $category->description,
            'parent' => $category->parent,
            'sortorder' => $category->sortorder,
            'coursecount' => $category->get_courses_count(),
            'visible' => $category->visible,
            'depth' => $category->depth,
            'path' => $category->path
        ];
    }
    
    /**
     * Extract numeric ID from request URI.
     *
     * Parses the request URI to extract the category ID from the path.
     * Expects URI pattern: /api/v1/admin/courses/categories/{id}
     *
     * @return int Category ID
     * @throws ValidationException If ID cannot be extracted or is not numeric
     */
    private function extractIdFromUri() {
        // Get request URI
        $requestUri = $_SERVER['REQUEST_URI'] ?? '';
        
        // Remove query string if present
        $path = parse_url($requestUri, PHP_URL_PATH);
        
        // Split path by '/' and get segments
        $segments = array_filter(explode('/', $path));
        $segments = array_values($segments); // Re-index array
        
        // Get last segment as ID
        $id = end($segments);
        
        // Validate ID is numeric
        if (!is_numeric($id) || $id <= 0) {
            throw new ValidationException("Invalid category ID in request URI", [
                'uri' => $requestUri,
                'extractedId' => $id,
                'reason' => 'Category ID must be a positive integer'
            ]);
        }
        
        return (int)$id;
    }
}

// Instantiate and execute endpoint only if this file is accessed directly (not included for testing)
if (!defined('PHPUNIT_TEST') && (php_sapi_name() !== 'cli' || (isset($_SERVER['SCRIPT_FILENAME']) && realpath($_SERVER['SCRIPT_FILENAME']) === realpath(__FILE__)))) {
    $endpoint = new CourseCategoriesEndpoint();
    $endpoint->execute();
}
