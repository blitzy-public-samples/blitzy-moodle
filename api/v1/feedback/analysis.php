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
 * REST API endpoint for feedback analysis - statistical analysis of responses.
 *
 * This endpoint provides comprehensive statistical analysis of feedback responses including
 * response counts, percentages, averages, and distributions for each question. It wraps
 * existing Moodle feedback functions without duplicating any business logic.
 *
 * Endpoint: GET /api/v1/feedback/{id}/analysis
 *
 * Features:
 * - Response count and completion rate statistics
 * - Per-item analysis based on question type (multichoice, numeric, text)
 * - Group filtering support for group-based analysis
 * - Site feedback support with courseid parameter
 * - Anonymous feedback protection (minimum response threshold)
 * - Permission enforcement via mod/feedback:viewanalysepage capability
 *
 * Response format:
 * {
 *   "success": true,
 *   "data": {
 *     "feedback_id": 123,
 *     "feedback_name": "Course Evaluation",
 *     "total_responses": 45,
 *     "completion_rate": 0.75,
 *     "is_anonymous": true,
 *     "groupid": 0,
 *     "courseid": null,
 *     "items_analysis": [
 *       {
 *         "item_id": 456,
 *         "item_name": "Overall satisfaction",
 *         "item_type": "multichoice",
 *         "response_count": 45,
 *         "data": [...]
 *       }
 *     ]
 *   }
 * }
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

require_once(__DIR__ . '/../../../config.php');
require_once($CFG->dirroot . '/mod/feedback/lib.php');
require_once(__DIR__ . '/../../lib/api_base.php');
require_once(__DIR__ . '/../../lib/api_exception.php');

/**
 * Feedback analysis API endpoint class.
 *
 * Provides statistical analysis of feedback responses with support for different
 * question types, group filtering, and anonymous feedback protection.
 *
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class FeedbackAnalysisEndpoint extends ApiBase {

    /**
     * Handle GET request for feedback analysis.
     *
     * Retrieves comprehensive statistical analysis of feedback responses including:
     * - Total response count and completion rate
     * - Per-item analysis with statistics based on question type
     * - Support for group-filtered analysis
     * - Anonymous feedback protection
     *
     * Query parameters:
     * - id (required): Feedback activity ID
     * - groupid (optional): Filter analysis by group ID
     * - courseid (optional): Course ID for site-wide feedbacks
     *
     * @return void Outputs JSON response
     * @throws NotFoundException If feedback activity not found
     * @throws ForbiddenException If user lacks viewanalysepage capability
     */
    protected function handle_get() {
        global $DB;

        // Get and validate feedback ID from URL parameter
        $feedbackid = $this->getParam('id', PARAM_INT);
        if (!$feedbackid) {
            throw new ValidationException('Feedback ID is required');
        }

        // Get optional query parameters for filtering
        $groupid = optional_param('groupid', 0, PARAM_INT);
        $courseid = optional_param('courseid', 0, PARAM_INT);

        // Validate feedback exists and get course module
        $cm = get_coursemodule_from_instance('feedback', $feedbackid, 0, false, MUST_EXIST);
        if (!$cm) {
            throw new NotFoundException('Feedback activity not found', [
                'feedbackId' => $feedbackid
            ]);
        }

        // Get course and context
        $course = $DB->get_record('course', ['id' => $cm->course], '*', MUST_EXIST);
        $context = context_module::instance($cm->id);

        // Ensure user is enrolled or has appropriate access to the course
        require_course_login($course, true, $cm);

        // Check user has permission to view analysis page
        $this->checkCapability('mod/feedback:viewanalysepage', $context);

        // Get feedback record
        $feedback = $DB->get_record('feedback', ['id' => $feedbackid], '*', MUST_EXIST);

        // Initialize feedback structure for analysis
        $feedbackstructure = new mod_feedback_structure($feedback, $cm, $course->id);

        // Verify user can view analysis (additional permission check)
        if (!$feedbackstructure->can_view_analysis()) {
            throw new ForbiddenException('You do not have permission to view feedback analysis', [
                'required_capability' => 'mod/feedback:viewanalysepage or mod/feedback:viewreports',
                'context' => 'module',
                'cmid' => $cm->id
            ]);
        }

        // Handle group filtering
        $currentgroupid = $groupid;
        if ($currentgroupid === 0) {
            // Get default group from activity group mode
            $currentgroupid = groups_get_activity_group($cm, true);
        }

        // Verify user has access to the specified group
        if ($currentgroupid > 0) {
            $groupmode = groups_get_activity_groupmode($cm);
            if ($groupmode == SEPARATEGROUPS) {
                // In separate groups mode, verify user can access this group
                $allowedgroups = groups_get_activity_allowed_groups($cm);
                $hasaccess = false;
                foreach ($allowedgroups as $allowedgroup) {
                    if ($allowedgroup->id == $currentgroupid) {
                        $hasaccess = true;
                        break;
                    }
                }
                if (!$hasaccess && !has_capability('moodle/site:accessallgroups', $context)) {
                    throw new ForbiddenException('You do not have access to this group', [
                        'groupid' => $currentgroupid
                    ]);
                }
            }
        }

        // Count completed responses
        $totalresponses = $feedbackstructure->count_completed_responses($currentgroupid);

        // Check for anonymous feedback minimum response threshold in group mode
        $checkanonymously = true;
        if ($currentgroupid > 0 && $feedback->anonymous == FEEDBACK_ANONYMOUS_YES) {
            if ($totalresponses < FEEDBACK_MIN_ANONYMOUS_COUNT_IN_GROUP) {
                $checkanonymously = false;
            }
        }

        // Get all feedback items (only those with values)
        $items = $feedbackstructure->get_items(true);

        // Initialize analysis data
        $itemsanalysis = [];

        // Process each item for analysis if we can show data
        if ($checkanonymously && $items) {
            foreach ($items as $item) {
                // Get item class for type-specific analysis
                $itemobj = feedback_get_item_class($item->typ);

                // Get analyzed data for this item
                $itemanalysis = [
                    'item_id' => (int)$item->id,
                    'item_name' => format_string($item->name),
                    'item_type' => $item->typ,
                    'item_label' => format_string($item->label ?? ''),
                    'item_number' => $item->itemnr ?? null,
                    'position' => (int)$item->position,
                    'response_count' => 0,
                    'data' => null
                ];

                // Get raw values for this item
                $values = feedback_get_group_values($item, $currentgroupid, $courseid);

                if ($values) {
                    $itemanalysis['response_count'] = count($values);

                    // Get analyzed data using item class method
                    try {
                        // Use get_analysed_for_external if available (returns API-friendly format)
                        if (method_exists($itemobj, 'get_analysed_for_external')) {
                            $analyseddata = $itemobj->get_analysed_for_external($item, $currentgroupid, $courseid);
                            $itemanalysis['data'] = $this->formatAnalysisData($item->typ, $analyseddata, $values);
                        } else {
                            // Fallback to manual analysis based on type
                            $itemanalysis['data'] = $this->analyzeItemManually($item, $values);
                        }
                    } catch (Exception $e) {
                        // If analysis fails, log error but continue with other items
                        debugging('Failed to analyze item ' . $item->id . ': ' . $e->getMessage(), DEBUG_DEVELOPER);
                        $itemanalysis['data'] = null;
                        $itemanalysis['error'] = 'Analysis failed for this item';
                    }
                }

                $itemsanalysis[] = $itemanalysis;
            }
        }

        // Calculate completion rate (if we know expected participants)
        $completionrate = null;
        if ($totalresponses > 0) {
            // For group mode, get group member count
            if ($currentgroupid > 0) {
                $groupmembers = groups_get_members($currentgroupid, 'u.id');
                if ($groupmembers) {
                    $expectedcount = count($groupmembers);
                    $completionrate = $expectedcount > 0 ? round($totalresponses / $expectedcount, 4) : null;
                }
            }
        }

        // Build response data
        $responsedata = [
            'feedback_id' => (int)$feedbackid,
            'feedback_name' => format_string($feedback->name),
            'total_responses' => (int)$totalresponses,
            'completion_rate' => $completionrate,
            'is_anonymous' => ($feedback->anonymous == FEEDBACK_ANONYMOUS_YES),
            'anonymous_threshold_met' => $checkanonymously,
            'groupid' => (int)$currentgroupid,
            'courseid' => $courseid ? (int)$courseid : null,
            'items_analysis' => $itemsanalysis
        ];

        // If anonymous threshold not met, provide explanation
        if (!$checkanonymously) {
            $responsedata['message'] = get_string('insufficient_responses_for_this_group', 'feedback');
            $responsedata['min_responses_required'] = FEEDBACK_MIN_ANONYMOUS_COUNT_IN_GROUP;
        }

        // Return success response
        $this->success($responsedata);
    }

    /**
     * Format analysis data based on item type.
     *
     * Converts the raw analyzed data from item classes into a consistent
     * API-friendly format suitable for JSON serialization and React frontend consumption.
     *
     * @param string $itemtype The type of feedback item (multichoice, numeric, textarea, etc.)
     * @param mixed  $analyseddata The analyzed data from item class
     * @param array  $values Raw value records from database
     * @return mixed Formatted analysis data structure
     */
    private function formatAnalysisData($itemtype, $analyseddata, $values) {
        switch ($itemtype) {
            case 'multichoice':
            case 'multichoicerated':
                // Multichoice data comes as JSON-encoded strings
                $formatted = [];
                if (is_array($analyseddata)) {
                    foreach ($analyseddata as $dataitem) {
                        $decoded = json_decode($dataitem);
                        if ($decoded) {
                            $formatted[] = [
                                'answer_text' => $decoded->answertext ?? '',
                                'answer_count' => (int)($decoded->answercount ?? 0),
                                'percentage' => round(($decoded->quotient ?? 0) * 100, 2)
                            ];
                        }
                    }
                }
                return $formatted;

            case 'numeric':
                // Numeric data is array of values
                if (is_array($analyseddata) && !empty($analyseddata)) {
                    $numericvalues = array_map('floatval', $analyseddata);
                    sort($numericvalues);

                    return [
                        'values' => $numericvalues,
                        'count' => count($numericvalues),
                        'min' => min($numericvalues),
                        'max' => max($numericvalues),
                        'average' => round(array_sum($numericvalues) / count($numericvalues), 2),
                        'median' => $this->calculateMedian($numericvalues),
                        'std_deviation' => $this->calculateStdDev($numericvalues)
                    ];
                }
                return null;

            case 'textarea':
            case 'textfield':
                // Text data - return count only (actual responses in separate results endpoint)
                return [
                    'response_count' => is_array($analyseddata) ? count($analyseddata) : 0,
                    'note' => 'Text responses available via results endpoint'
                ];

            case 'info':
            case 'label':
                // Info and label items don't have analyzable data
                return [
                    'type' => 'display_only',
                    'note' => 'This item is for display purposes and does not collect responses'
                ];

            default:
                // Generic handling for other types
                return $analyseddata;
        }
    }

    /**
     * Manually analyze item when get_analysed_for_external is not available.
     *
     * Fallback method to analyze items that don't implement the external analysis method.
     * This provides basic statistics based on the raw values.
     *
     * @param stdClass $item The feedback item object
     * @param array    $values Raw value records from database
     * @return mixed Basic analysis data
     */
    private function analyzeItemManually($item, $values) {
        if (empty($values)) {
            return null;
        }

        // Extract value data
        $valuedata = [];
        foreach ($values as $value) {
            if (isset($value->value) && $value->value !== '') {
                $valuedata[] = $value->value;
            }
        }

        // Return basic count for manual analysis
        return [
            'response_count' => count($valuedata),
            'note' => 'Detailed analysis not available for this item type'
        ];
    }

    /**
     * Calculate median value from array of numbers.
     *
     * @param array $values Sorted array of numeric values
     * @return float Median value
     */
    private function calculateMedian($values) {
        if (empty($values)) {
            return 0.0;
        }

        $count = count($values);
        $middle = floor($count / 2);

        if ($count % 2 == 0) {
            // Even number of values - average of two middle values
            return round(($values[$middle - 1] + $values[$middle]) / 2, 2);
        } else {
            // Odd number of values - middle value
            return round($values[$middle], 2);
        }
    }

    /**
     * Calculate standard deviation from array of numbers.
     *
     * @param array $values Array of numeric values
     * @return float Standard deviation rounded to 2 decimal places
     */
    private function calculateStdDev($values) {
        if (empty($values) || count($values) < 2) {
            return 0.0;
        }

        $count = count($values);
        $mean = array_sum($values) / $count;

        $sumSquaredDiff = 0.0;
        foreach ($values as $value) {
            $diff = $value - $mean;
            $sumSquaredDiff += $diff * $diff;
        }

        $variance = $sumSquaredDiff / $count;
        return round(sqrt($variance), 2);
    }
}

// Execute the endpoint
$endpoint = new FeedbackAnalysisEndpoint();
$endpoint->execute();
