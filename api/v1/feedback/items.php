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
 * REST API endpoint for retrieving feedback items (questions)
 *
 * GET /api/v1/feedback/{id}/items
 * Returns JSON-formatted list of feedback items including question types,
 * labels, options, dependencies, and configuration for React frontend rendering.
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Load Moodle configuration and libraries
// In test environment, these are already loaded by PHPUnit bootstrap or test script
if (!defined('PHPUNIT_TEST') && !defined('API_TEST_MODE')) {
    require_once(__DIR__ . '/../../../config.php');
    require_once($CFG->dirroot . '/mod/feedback/lib.php');
    require_once($CFG->dirroot . '/mod/feedback/classes/structure.php');
}

// Load API utilities
require_once(__DIR__ . '/../../lib/api_base.php');
require_once(__DIR__ . '/../../lib/api_exception.php');

/**
 * Feedback items API endpoint class
 *
 * Handles GET requests to retrieve feedback items (questions) for a specific feedback activity.
 * Returns comprehensive item data including question types, labels, options, dependencies,
 * and configuration needed by React frontend to render feedback forms.
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class FeedbackItemsEndpoint extends ApiBase {

    /**
     * Handle GET request to retrieve feedback items
     *
     * Workflow:
     * 1. Extract and validate feedback ID from URL parameter
     * 2. Verify course module exists using get_coursemodule_from_instance()
     * 3. Check user has 'mod/feedback:view' capability in module context
     * 4. Instantiate mod_feedback_structure to access feedback items
     * 5. Retrieve all feedback items via get_items() method
     * 6. Process each item to extract relevant fields for frontend
     * 7. Filter pagebreak items unless specifically requested
     * 8. Return standardized JSON response with items array
     *
     * @return void Outputs JSON response and exits
     * @throws NotFoundException If feedback or course module not found
     * @throws ForbiddenException If user lacks required capability
     */
    protected function handle_get() {
        global $DB;

        // Extract feedback ID from URL parameter
        $feedbackid = $this->getParam('id', PARAM_INT, true);

        // Optional: Include pagebreaks in response (default: false)
        $includePagebreaks = $this->getParam('include_pagebreaks', PARAM_BOOL, false) ?? false;

        // Optional: Course ID for site feedbacks
        $courseid = $this->getParam('courseid', PARAM_INT, false) ?? 0;

        // Validate feedback exists and get course module
        try {
            $cm = get_coursemodule_from_instance('feedback', $feedbackid, 0, false, MUST_EXIST);
        } catch (Exception $e) {
            throw new NotFoundException(
                'FEEDBACK_NOT_FOUND',
                'Feedback activity with ID ' . $feedbackid . ' not found'
            );
        }

        // Get module context for capability checking
        $context = context_module::instance($cm->id);

        // Check user has permission to view feedback
        $this->checkCapability('mod/feedback:view', $context);

        // Get feedback record from database
        $feedback = $DB->get_record('feedback', ['id' => $feedbackid], '*', MUST_EXIST);

        // Instantiate mod_feedback_structure to access feedback items and methods
        $feedbackstructure = new mod_feedback_structure($feedback, $cm, $courseid);

        // Retrieve all feedback items in position order
        $allitems = $feedbackstructure->get_items();

        // Process items for frontend consumption
        $processedItems = [];
        
        foreach ($allitems as $item) {
            // Skip pagebreak items unless explicitly requested
            if ($item->typ === 'pagebreak' && !$includePagebreaks) {
                continue;
            }

            // Build item data structure for React frontend
            $itemData = [
                'id' => (int)$item->id,
                'typ' => $item->typ,
                'name' => $item->name,
                'label' => format_text($item->label, FORMAT_HTML),
                'presentation' => $item->presentation ?? '',
                'required' => (bool)$item->required,
                'position' => (int)$item->position,
                'hasvalue' => (bool)$item->hasvalue,
                'itemnr' => $item->itemnr,
                'dependitem' => (int)($item->dependitem ?? 0),
                'dependvalue' => $item->dependvalue ?? '',
            ];

            // Check if item has a dependency and if it's met for current user
            if ($item->dependitem > 0) {
                $itemData['dependencyMet'] = $this->checkItemDependency(
                    $feedbackid,
                    $item->dependitem,
                    $item->dependvalue
                );
            } else {
                $itemData['dependencyMet'] = true;
            }

            // Parse presentation data based on item type
            $itemData['options'] = $this->parseItemPresentation($item);

            $processedItems[] = $itemData;
        }

        // Return successful response with items array
        $this->success([
            'items' => $processedItems,
            'total' => count($processedItems),
            'feedbackId' => $feedbackid,
            'feedbackName' => $feedback->name,
            'isAnonymous' => $feedbackstructure->is_anonymous(),
            'isOpen' => $feedbackstructure->is_open(),
        ]);
    }

    /**
     * Check if an item dependency is met for the current user
     *
     * @param int $feedbackid Feedback ID
     * @param int $dependitemid Dependency item ID
     * @param string $dependvalue Expected dependency value
     * @return bool True if dependency is met or no completed response exists
     */
    private function checkItemDependency($feedbackid, $dependitemid, $dependvalue) {
        global $DB;

        $user = $this->getUser();

        // Get user's completed feedback record
        $completed = $DB->get_record('feedback_completed', [
            'feedback' => $feedbackid,
            'userid' => $user->id
        ]);

        // If no completed record exists, dependency cannot be evaluated (treat as met)
        if (!$completed) {
            return true;
        }

        // Get user's response value for the dependency item
        $value = $DB->get_record('feedback_value', [
            'completed' => $completed->id,
            'item' => $dependitemid
        ]);

        // If no value recorded, dependency is not met
        if (!$value) {
            return false;
        }

        // Compare the actual value with the expected dependency value
        // Use feedback_compare_item_value() from feedback/lib.php
        return feedback_compare_item_value(
            $dependitemid,
            $value->value,
            $dependvalue,
            false
        );
    }

    /**
     * Parse item presentation data based on item type
     *
     * Extracts configuration and options from the presentation field based on
     * the specific feedback item type (multichoice, numeric, textfield, etc.)
     *
     * @param stdClass $item Feedback item object
     * @return array Parsed options and configuration
     */
    private function parseItemPresentation($item) {
        $options = [];

        switch ($item->typ) {
            case 'multichoice':
            case 'multichoicerated':
                // Parse multichoice options
                // Format: type####option1####option2####...
                // type can be: r (radio), c (checkbox), d (dropdown)
                $parts = explode(FEEDBACK_MULTICHOICE_LINE_SEP, $item->presentation);
                
                if (count($parts) > 0) {
                    $options['selectionType'] = $parts[0]; // r, c, or d
                    $options['choices'] = array_slice($parts, 1);
                    
                    // For rated multichoice, extract numeric values
                    if ($item->typ === 'multichoicerated') {
                        $options['values'] = [];
                        foreach ($options['choices'] as $choice) {
                            // Format: "value####label"
                            $choiceParts = explode(FEEDBACK_MULTICHOICERATED_VALUE_SEP, $choice);
                            if (count($choiceParts) === 2) {
                                $options['values'][] = [
                                    'value' => (int)$choiceParts[0],
                                    'label' => $choiceParts[1]
                                ];
                            }
                        }
                    }
                }
                break;

            case 'numeric':
                // Parse numeric range
                // Format: min|max
                $parts = explode('|', $item->presentation);
                if (count($parts) === 2) {
                    $options['rangeFrom'] = (int)$parts[0];
                    $options['rangeTo'] = (int)$parts[1];
                }
                break;

            case 'textfield':
                // Parse textfield size and max length
                // Format: size|maxlength
                $parts = explode('|', $item->presentation);
                if (count($parts) === 2) {
                    $options['size'] = (int)$parts[0];
                    $options['maxLength'] = (int)$parts[1];
                } else {
                    $options['size'] = 30;
                    $options['maxLength'] = 255;
                }
                break;

            case 'textarea':
                // Parse textarea dimensions
                // Format: cols|rows
                $parts = explode('|', $item->presentation);
                if (count($parts) === 2) {
                    $options['cols'] = (int)$parts[0];
                    $options['rows'] = (int)$parts[1];
                } else {
                    $options['cols'] = 40;
                    $options['rows'] = 5;
                }
                break;

            case 'info':
            case 'label':
                // For info and label items, presentation is HTML content
                $options['content'] = format_text($item->presentation, FORMAT_HTML);
                break;

            case 'captcha':
                // No additional options needed for captcha
                $options['type'] = 'captcha';
                break;

            case 'pagebreak':
                // No additional options for pagebreak
                $options['type'] = 'pagebreak';
                break;

            default:
                // For unknown types, store raw presentation
                $options['raw'] = $item->presentation;
                break;
        }

        return $options;
    }

    /**
     * Handle POST request (not supported for this endpoint)
     *
     * @throws MethodNotAllowedException Always throws exception
     */
    protected function handle_post() {
        throw new MethodNotAllowedException(
            'METHOD_NOT_ALLOWED',
            'POST method is not supported for feedback items endpoint'
        );
    }

    /**
     * Handle PUT request (not supported for this endpoint)
     *
     * @throws MethodNotAllowedException Always throws exception
     */
    protected function handle_put() {
        throw new MethodNotAllowedException(
            'METHOD_NOT_ALLOWED',
            'PUT method is not supported for feedback items endpoint'
        );
    }

    /**
     * Handle DELETE request (not supported for this endpoint)
     *
     * @throws MethodNotAllowedException Always throws exception
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException(
            'METHOD_NOT_ALLOWED',
            'DELETE method is not supported for feedback items endpoint'
        );
    }
}

// Execute the endpoint (skip during testing)
// ApiBase::execute() handles all exceptions internally
if (!defined('API_TESTING') && php_sapi_name() !== 'cli') {
    if (!defined('API_TEST_MODE') || !API_TEST_MODE) {
        $endpoint = new FeedbackItemsEndpoint();
        $endpoint->execute();
    }
}
