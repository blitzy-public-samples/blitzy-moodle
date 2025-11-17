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
 * REST API endpoint for workshop grade calculation and aggregation.
 *
 * Handles POST /api/v1/workshop/{id}/calculate to aggregate submission grades from peer assessments,
 * evaluate assessment quality grades, and push final grades to gradebook. This endpoint wraps
 * existing Moodle workshop grading functions without duplicating any business logic.
 *
 * Endpoint flow:
 * 1. Validates JWT token and user authentication
 * 2. Retrieves workshop ID from URL parameter
 * 3. Validates course module and workshop record exist
 * 4. Enforces teacher/manager permission (mod/workshop:overridegrades)
 * 5. Validates workshop is in evaluation phase
 * 6. Reads optional calculation settings from JSON body
 * 7. Calculates submission grades by aggregating reviewer assessments
 * 8. Evaluates assessment quality grades (grading grades)
 * 9. Aggregates grading grades for each reviewer
 * 10. Pushes calculated grades to gradebook
 * 11. Returns comprehensive calculation results with statistics
 *
 * Required permissions:
 * - mod/workshop:overridegrades (teacher or manager role)
 *
 * Phase requirements:
 * - Workshop must be in PHASE_EVALUATION to trigger calculations
 *
 * @package    api
 * @subpackage workshop
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Load API base class and dependencies
require_once(__DIR__ . '/../../lib/api_base.php');
require_once(__DIR__ . '/../../lib/api_exception.php');

/**
 * Workshop calculate endpoint class.
 *
 * Implements POST /api/v1/workshop/{id}/calculate endpoint for grade calculation.
 * Extends ApiBase to leverage JWT authentication, request handling, and response formatting.
 */
class WorkshopCalculateEndpoint extends ApiBase {
    
    /**
     * Handle POST requests for workshop grade calculation.
     *
     * Triggers comprehensive grade calculation including:
     * - Submission grade aggregation from peer assessments
     * - Assessment quality grade evaluation
     * - Grading grade aggregation for reviewers
     * - Gradebook synchronization
     *
     * Request body (JSON, all optional):
     * {
     *   "evaluation_method": "best|manual",  // Override workshop default
     *   "restrict_to_group": 123,            // Calculate for specific group only
     *   "force_recalculate": true,           // Recalculate even if already done
     *   "include_examples": false            // Include example submissions
     * }
     *
     * Response format:
     * {
     *   "success": true,
     *   "data": {
     *     "calculation_results": {
     *       "submissions_graded": {...},
     *       "grades_calculated": [...],
     *       "assessments_evaluated": {...},
     *       "grading_grades": [...],
     *       "aggregations": [...],
     *       "gradebook_sync": {...},
     *       "statistics": {...},
     *       "outliers": {...},
     *       "calculation_time": 1234,
     *       "phase_updated": false
     *     }
     *   }
     * }
     *
     * @return void Outputs JSON response directly
     * @throws NotFoundException If workshop not found
     * @throws ForbiddenException If insufficient permissions or wrong phase
     * @throws ValidationException If invalid settings provided
     * @throws ServerException If calculation fails
     */
    protected function handle_post() {
        global $DB, $CFG;
        
        // Load workshop libraries
        require_once($CFG->dirroot . '/mod/workshop/lib.php');
        require_once($CFG->dirroot . '/mod/workshop/locallib.php');
        
        // Record start time for performance tracking
        $startTime = microtime(true);
        
        try {
            // Step 1: Extract and validate workshop ID from URL parameter
            $workshopid = $this->getParam('id', PARAM_INT);
            
            // Step 2: Validate workshop course module exists
            $cm = get_coursemodule_from_instance('workshop', $workshopid, 0, false, MUST_EXIST);
            if (!$cm) {
                throw new NotFoundException('Workshop not found', [
                    'workshopId' => $workshopid,
                    'reason' => 'No course module found for this workshop instance'
                ]);
            }
            
            // Step 3: Retrieve course and workshop records
            $course = $DB->get_record('course', ['id' => $cm->course], '*', MUST_EXIST);
            if (!$course) {
                throw new NotFoundException('Course not found', [
                    'courseId' => $cm->course,
                    'workshopId' => $workshopid
                ]);
            }
            
            $workshoprecord = $DB->get_record('workshop', ['id' => $workshopid], '*', MUST_EXIST);
            if (!$workshoprecord) {
                throw new NotFoundException('Workshop record not found', [
                    'workshopId' => $workshopid
                ]);
            }
            
            // Step 4: Instantiate workshop class with all required objects
            $workshop = new workshop($workshoprecord, $cm, $course);
            
            // Step 5: Enforce permission check - only teachers/managers can calculate grades
            $this->checkCapability('mod/workshop:overridegrades', $workshop->context);
            
            // Step 6: Validate workshop is in evaluation phase
            if ($workshop->phase != workshop::PHASE_EVALUATION) {
                throw new ForbiddenException('Workshop must be in evaluation phase for grade calculation', [
                    'currentPhase' => $workshop->phase,
                    'requiredPhase' => workshop::PHASE_EVALUATION,
                    'phaseName' => $this->getPhaseNameForCode($workshop->phase),
                    'reason' => 'Grade calculation is only available during the evaluation phase'
                ]);
            }
            
            // Step 7: Parse optional calculation settings from JSON body
            $settings = $this->parseCalculationSettings();
            
            // Step 8: Validate evaluation method if provided
            $evaluationMethod = $settings['evaluation_method'] ?? $workshop->evaluation;
            if (!in_array($evaluationMethod, ['best', 'manual'])) {
                throw new ValidationException('Invalid evaluation method', [
                    'provided' => $evaluationMethod,
                    'allowed' => ['best', 'manual'],
                    'reason' => 'Evaluation method must be "best" or "manual"'
                ]);
            }
            
            // Step 9: Retrieve grading evaluator instance for the workshop
            $evaluator = $workshop->grading_evaluation_instance();
            if (!$evaluator) {
                throw new ServerException('Failed to load grading evaluator', [
                    'evaluationMethod' => $evaluationMethod,
                    'workshopId' => $workshopid
                ]);
            }
            
            // Step 10: Prepare evaluator settings if provided in request
            $settingsdata = $this->prepareEvaluatorSettings($evaluator, $settings);
            
            // Step 11: Calculate submission grades by aggregating reviewer assessments
            $restrictToGroup = $settings['restrict_to_group'] ?? null;
            try {
                $workshop->aggregate_submission_grades($restrictToGroup);
            } catch (Exception $e) {
                throw new ServerException('Failed to aggregate submission grades', [
                    'error' => $e->getMessage(),
                    'workshopId' => $workshopid,
                    'groupId' => $restrictToGroup
                ]);
            }
            
            // Step 12: Evaluate assessment quality grades (grading grades)
            try {
                $evaluator->update_grading_grades($settingsdata);
            } catch (Exception $e) {
                throw new ServerException('Failed to evaluate assessment quality grades', [
                    'error' => $e->getMessage(),
                    'workshopId' => $workshopid,
                    'evaluator' => get_class($evaluator)
                ]);
            }
            
            // Step 13: Aggregate grading grades for each reviewer
            try {
                $workshop->aggregate_grading_grades($restrictToGroup);
            } catch (Exception $e) {
                throw new ServerException('Failed to aggregate grading grades', [
                    'error' => $e->getMessage(),
                    'workshopId' => $workshopid,
                    'groupId' => $restrictToGroup
                ]);
            }
            
            // Step 14: Push calculated grades to gradebook
            $gradebookResult = $this->syncGradebook($workshop);
            
            // Step 15: Retrieve calculated grades and build response data
            $calculationResults = $this->buildCalculationResults(
                $workshop,
                $restrictToGroup,
                $gradebookResult,
                $startTime
            );
            
            // Step 16: Trigger grade calculation events for audit trail
            $this->triggerCalculationEvents($workshop, $calculationResults);
            
            // Step 17: Check if workshop should auto-advance to closed phase
            $phaseUpdated = $this->checkAutoAdvancePhase($workshop, $calculationResults);
            $calculationResults['phase_updated'] = $phaseUpdated;
            
            // Step 18: Return success response with comprehensive calculation data
            $this->success([
                'calculation_results' => $calculationResults
            ], 200);
            
        } catch (ApiException $e) {
            // Re-throw API exceptions for proper error handling
            throw $e;
            
        } catch (Exception $e) {
            // Wrap unexpected exceptions as ServerException
            throw new ServerException('Unexpected error during grade calculation', [
                'error' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'workshopId' => $workshopid ?? null
            ]);
        }
    }
    
    /**
     * Parse calculation settings from JSON request body.
     *
     * Reads optional settings including evaluation method, group restriction,
     * force recalculate flag, and example inclusion setting.
     *
     * @return array Associative array of settings with defaults
     */
    private function parseCalculationSettings() {
        // Attempt to parse JSON body - may be empty for default settings
        try {
            $body = $this->getJsonBody();
        } catch (ValidationException $e) {
            // Empty body is acceptable - use all defaults
            $body = [];
        }
        
        // Extract and validate individual settings
        $settings = [];
        
        // Evaluation method: 'best' or 'manual'
        if (isset($body['evaluation_method'])) {
            $settings['evaluation_method'] = clean_param($body['evaluation_method'], PARAM_ALPHA);
        }
        
        // Group restriction: group ID or null for all groups
        if (isset($body['restrict_to_group'])) {
            $settings['restrict_to_group'] = clean_param($body['restrict_to_group'], PARAM_INT);
        }
        
        // Force recalculate: boolean flag
        if (isset($body['force_recalculate'])) {
            $settings['force_recalculate'] = (bool)$body['force_recalculate'];
        }
        
        // Include examples: boolean flag
        if (isset($body['include_examples'])) {
            $settings['include_examples'] = (bool)$body['include_examples'];
        }
        
        return $settings;
    }
    
    /**
     * Prepare evaluator-specific settings for grade calculation.
     *
     * Converts API request settings into format expected by grading evaluator.
     * For 'best' evaluation, may include comparison_weight setting.
     *
     * @param object $evaluator Grading evaluator instance
     * @param array  $settings  Parsed settings from request
     * @return object Settings data object for evaluator
     */
    private function prepareEvaluatorSettings($evaluator, $settings) {
        // Create settings data object
        $settingsdata = new stdClass();
        
        // Add comparison weight for 'best' evaluation if provided
        if (isset($settings['comparison_weight'])) {
            $settingsdata->comparisonweight = $settings['comparison_weight'];
        }
        
        // Add any additional evaluator-specific settings
        if (isset($settings['include_examples'])) {
            $settingsdata->includeexamples = $settings['include_examples'];
        }
        
        return $settingsdata;
    }
    
    /**
     * Synchronize calculated grades with Moodle gradebook.
     *
     * Calls workshop_update_grades() and workshop_grade_item_update() to ensure
     * gradebook has current submission and assessment grades.
     *
     * @param object $workshop Workshop instance
     * @return array Sync result with success status and details
     */
    private function syncGradebook($workshop) {
        global $CFG;
        
        $result = [
            'success' => false,
            'items_updated' => 0,
            'errors' => []
        ];
        
        try {
            // Update grades in gradebook using existing Moodle function
            require_once($CFG->libdir . '/gradelib.php');
            
            // Push all workshop grades to gradebook
            workshop_update_grades($workshop->dbrecord);
            
            // Update grade items with correct max grade and settings
            workshop_grade_item_update($workshop->dbrecord);
            
            $result['success'] = true;
            $result['items_updated'] = 2; // Submission grade item + assessment grade item
            
        } catch (Exception $e) {
            $result['success'] = false;
            $result['errors'][] = [
                'message' => $e->getMessage(),
                'code' => $e->getCode()
            ];
        }
        
        return $result;
    }
    
    /**
     * Build comprehensive calculation results object.
     *
     * Aggregates all calculation data including graded submissions, assessment evaluations,
     * gradebook sync status, statistics, outliers, and performance metrics.
     *
     * @param object $workshop      Workshop instance
     * @param int    $groupId       Group ID restriction or null
     * @param array  $gradebookSync Gradebook synchronization result
     * @param float  $startTime     Calculation start timestamp
     * @return array Comprehensive calculation results
     */
    private function buildCalculationResults($workshop, $groupId, $gradebookSync, $startTime) {
        global $DB;
        
        // Calculate execution time in milliseconds
        $endTime = microtime(true);
        $calculationTime = round(($endTime - $startTime) * 1000);
        
        // Retrieve all submissions for this workshop
        $submissions = $this->getSubmissionsWithGrades($workshop, $groupId);
        
        // Retrieve all assessments with grading grades
        $assessments = $this->getAssessmentsWithGradingGrades($workshop, $groupId);
        
        // Retrieve aggregated grading grades
        $aggregations = $this->getAggregatedGradingGrades($workshop, $groupId);
        
        // Calculate statistics
        $statistics = $this->calculateStatistics($submissions, $assessments, $aggregations);
        
        // Identify outliers
        $outliers = $this->identifyOutliers($submissions, $assessments);
        
        // Build final results structure
        return [
            'submissions_graded' => [
                'count' => count($submissions),
                'ids' => array_column($submissions, 'id')
            ],
            'grades_calculated' => $submissions,
            'assessments_evaluated' => [
                'count' => count($assessments)
            ],
            'grading_grades' => $assessments,
            'aggregations' => $aggregations,
            'gradebook_sync' => $gradebookSync,
            'statistics' => $statistics,
            'outliers' => $outliers,
            'calculation_time' => $calculationTime
        ];
    }
    
    /**
     * Retrieve submissions with calculated grades.
     *
     * Fetches all submissions for the workshop with their calculated grades,
     * including reviewer grades and final aggregated grade.
     *
     * @param object $workshop Workshop instance
     * @param int    $groupId  Group ID restriction or null
     * @return array Array of submission objects with grade data
     */
    private function getSubmissionsWithGrades($workshop, $groupId) {
        global $DB;
        
        $sql = "SELECT s.id, s.authorid, s.grade, s.gradeover, s.gradeoverby,
                       s.timegraded
                  FROM {workshop_submissions} s
                 WHERE s.workshopid = :workshopid
                   AND s.example = 0";
        
        $params = ['workshopid' => $workshop->id];
        
        // Add group restriction if specified
        if ($groupId !== null) {
            $sql .= " AND s.authorid IN (
                        SELECT userid FROM {groups_members} WHERE groupid = :groupid
                      )";
            $params['groupid'] = $groupId;
        }
        
        $sql .= " ORDER BY s.id";
        
        $submissions = $DB->get_records_sql($sql, $params);
        
        // Enrich each submission with reviewer grades
        $result = [];
        foreach ($submissions as $submission) {
            $reviewerGrades = $this->getReviewerGradesForSubmission($submission->id);
            
            $result[] = [
                'submissionid' => $submission->id,
                'authorid' => $submission->authorid,
                'final_grade' => $submission->grade,
                'grade_override' => $submission->gradeover,
                'override_by' => $submission->gradeoverby,
                'time_graded' => $submission->timegraded,
                'reviewer_grades' => $reviewerGrades,
                'grade_method' => $workshop->evaluation
            ];
        }
        
        return $result;
    }
    
    /**
     * Retrieve reviewer grades for a specific submission.
     *
     * Fetches all assessment grades given by reviewers for a submission.
     *
     * @param int $submissionid Submission ID
     * @return array Array of reviewer grade objects
     */
    private function getReviewerGradesForSubmission($submissionid) {
        global $DB;
        
        $sql = "SELECT a.id, a.reviewerid, a.grade, a.weight
                  FROM {workshop_assessments} a
                 WHERE a.submissionid = :submissionid
                 ORDER BY a.id";
        
        $assessments = $DB->get_records_sql($sql, ['submissionid' => $submissionid]);
        
        $result = [];
        foreach ($assessments as $assessment) {
            $result[] = [
                'assessmentid' => $assessment->id,
                'reviewerid' => $assessment->reviewerid,
                'grade' => $assessment->grade,
                'weight' => $assessment->weight
            ];
        }
        
        return $result;
    }
    
    /**
     * Retrieve assessments with grading grades (assessment quality grades).
     *
     * Fetches all assessments with their calculated grading grades that indicate
     * how well each reviewer assessed submissions.
     *
     * @param object $workshop Workshop instance
     * @param int    $groupId  Group ID restriction or null
     * @return array Array of assessment objects with grading grade data
     */
    private function getAssessmentsWithGradingGrades($workshop, $groupId) {
        global $DB;
        
        $sql = "SELECT a.id, a.reviewerid, a.submissionid, a.gradinggrade,
                       a.weight, COUNT(*) OVER (PARTITION BY a.reviewerid) as assessment_count
                  FROM {workshop_assessments} a
                  JOIN {workshop_submissions} s ON s.id = a.submissionid
                 WHERE s.workshopid = :workshopid
                   AND s.example = 0";
        
        $params = ['workshopid' => $workshop->id];
        
        // Add group restriction if specified
        if ($groupId !== null) {
            $sql .= " AND a.reviewerid IN (
                        SELECT userid FROM {groups_members} WHERE groupid = :groupid
                      )";
            $params['groupid'] = $groupId;
        }
        
        $sql .= " ORDER BY a.reviewerid, a.id";
        
        $assessments = $DB->get_records_sql($sql, $params);
        
        $result = [];
        foreach ($assessments as $assessment) {
            $result[] = [
                'assessmentid' => $assessment->id,
                'reviewerid' => $assessment->reviewerid,
                'submissionid' => $assessment->submissionid,
                'gradinggrade' => $assessment->gradinggrade,
                'weight' => $assessment->weight,
                'assessment_count' => $assessment->assessment_count
            ];
        }
        
        return $result;
    }
    
    /**
     * Retrieve aggregated grading grades for reviewers.
     *
     * Fetches final aggregated grading grades for each reviewer from the
     * workshop_aggregations table.
     *
     * @param object $workshop Workshop instance
     * @param int    $groupId  Group ID restriction or null
     * @return array Array of aggregation objects
     */
    private function getAggregatedGradingGrades($workshop, $groupId) {
        global $DB;
        
        $sql = "SELECT ag.id, ag.userid, ag.gradinggrade,
                       COUNT(a.id) as assessment_count
                  FROM {workshop_aggregations} ag
                  LEFT JOIN {workshop_assessments} a ON a.reviewerid = ag.userid
                  LEFT JOIN {workshop_submissions} s ON s.id = a.submissionid AND s.workshopid = :workshopid
                 WHERE ag.workshopid = :workshopid2";
        
        $params = [
            'workshopid' => $workshop->id,
            'workshopid2' => $workshop->id
        ];
        
        // Add group restriction if specified
        if ($groupId !== null) {
            $sql .= " AND ag.userid IN (
                        SELECT userid FROM {groups_members} WHERE groupid = :groupid
                      )";
            $params['groupid'] = $groupId;
        }
        
        $sql .= " GROUP BY ag.id, ag.userid, ag.gradinggrade
                  ORDER BY ag.userid";
        
        $aggregations = $DB->get_records_sql($sql, $params);
        
        $result = [];
        foreach ($aggregations as $agg) {
            $result[] = [
                'userid' => $agg->userid,
                'aggregated_gradinggrade' => $agg->gradinggrade,
                'assessment_count' => $agg->assessment_count
            ];
        }
        
        return $result;
    }
    
    /**
     * Calculate grading statistics.
     *
     * Computes average grades, grade distribution, and other statistical metrics
     * for submissions and assessments.
     *
     * @param array $submissions Submission grade data
     * @param array $assessments Assessment grading grade data
     * @param array $aggregations Aggregated grading grades
     * @return array Statistical metrics
     */
    private function calculateStatistics($submissions, $assessments, $aggregations) {
        // Calculate submission grade statistics
        $submissionGrades = array_column($submissions, 'final_grade');
        $submissionGrades = array_filter($submissionGrades, function($grade) {
            return $grade !== null;
        });
        
        $avgSubmissionGrade = count($submissionGrades) > 0 
            ? round(array_sum($submissionGrades) / count($submissionGrades), 2)
            : 0;
        
        // Calculate grading grade statistics
        $gradingGrades = array_column($aggregations, 'aggregated_gradinggrade');
        $gradingGrades = array_filter($gradingGrades, function($grade) {
            return $grade !== null;
        });
        
        $avgGradingGrade = count($gradingGrades) > 0
            ? round(array_sum($gradingGrades) / count($gradingGrades), 2)
            : 0;
        
        // Calculate grade distribution
        $gradeDistribution = $this->calculateGradeDistribution($submissionGrades);
        
        // Count graded and pending
        $totalGraded = count($submissionGrades);
        $totalPending = count($submissions) - $totalGraded;
        
        return [
            'avg_submission_grade' => $avgSubmissionGrade,
            'avg_grading_grade' => $avgGradingGrade,
            'grade_distribution' => $gradeDistribution,
            'total_graded' => $totalGraded,
            'total_pending' => $totalPending
        ];
    }
    
    /**
     * Calculate grade distribution across ranges.
     *
     * Counts how many grades fall into different percentage ranges.
     *
     * @param array $grades Array of grade values
     * @return array Distribution counts by range
     */
    private function calculateGradeDistribution($grades) {
        $distribution = [
            '0-50' => 0,
            '51-60' => 0,
            '61-70' => 0,
            '71-80' => 0,
            '81-90' => 0,
            '91-100' => 0
        ];
        
        foreach ($grades as $grade) {
            if ($grade === null) continue;
            
            $percentage = $grade; // Assuming grade is already a percentage
            
            if ($percentage <= 50) {
                $distribution['0-50']++;
            } else if ($percentage <= 60) {
                $distribution['51-60']++;
            } else if ($percentage <= 70) {
                $distribution['61-70']++;
            } else if ($percentage <= 80) {
                $distribution['71-80']++;
            } else if ($percentage <= 90) {
                $distribution['81-90']++;
            } else {
                $distribution['91-100']++;
            }
        }
        
        return $distribution;
    }
    
    /**
     * Identify outliers in grading.
     *
     * Finds submissions with high grade variance between reviewers and
     * reviewers with consistently low grading quality.
     *
     * @param array $submissions Submission grade data
     * @param array $assessments Assessment grading grade data
     * @return array Outlier information
     */
    private function identifyOutliers($submissions, $assessments) {
        $highVarianceSubmissions = [];
        $lowQualityReviewers = [];
        
        // Identify submissions with high variance between reviewer grades
        foreach ($submissions as $submission) {
            $reviewerGrades = array_column($submission['reviewer_grades'], 'grade');
            
            if (count($reviewerGrades) >= 2) {
                $variance = $this->calculateVariance($reviewerGrades);
                
                // High variance threshold: standard deviation > 15% of max grade
                if (sqrt($variance) > 15) {
                    $highVarianceSubmissions[] = [
                        'submissionid' => $submission['submissionid'],
                        'variance' => round($variance, 2),
                        'std_dev' => round(sqrt($variance), 2),
                        'reviewer_count' => count($reviewerGrades)
                    ];
                }
            }
        }
        
        // Identify reviewers with consistently low grading grades
        $reviewerGradingGrades = [];
        foreach ($assessments as $assessment) {
            $reviewerId = $assessment['reviewerid'];
            if (!isset($reviewerGradingGrades[$reviewerId])) {
                $reviewerGradingGrades[$reviewerId] = [];
            }
            if ($assessment['gradinggrade'] !== null) {
                $reviewerGradingGrades[$reviewerId][] = $assessment['gradinggrade'];
            }
        }
        
        foreach ($reviewerGradingGrades as $reviewerId => $grades) {
            if (count($grades) > 0) {
                $avgGrade = array_sum($grades) / count($grades);
                
                // Low quality threshold: average grading grade < 50%
                if ($avgGrade < 50) {
                    $lowQualityReviewers[] = [
                        'reviewerid' => $reviewerId,
                        'avg_gradinggrade' => round($avgGrade, 2),
                        'assessment_count' => count($grades)
                    ];
                }
            }
        }
        
        return [
            'high_variance_submissions' => $highVarianceSubmissions,
            'low_quality_reviewers' => $lowQualityReviewers
        ];
    }
    
    /**
     * Calculate variance of an array of numbers.
     *
     * @param array $numbers Array of numeric values
     * @return float Variance value
     */
    private function calculateVariance($numbers) {
        if (count($numbers) < 2) {
            return 0;
        }
        
        $mean = array_sum($numbers) / count($numbers);
        
        $squaredDiffs = array_map(function($x) use ($mean) {
            return pow($x - $mean, 2);
        }, $numbers);
        
        return array_sum($squaredDiffs) / count($numbers);
    }
    
    /**
     * Trigger grade calculation events for audit trail.
     *
     * Fires Moodle events to log grade calculation activities for tracking
     * and notification purposes.
     *
     * @param object $workshop          Workshop instance
     * @param array  $calculationResults Calculation results data
     * @return void
     */
    private function triggerCalculationEvents($workshop, $calculationResults) {
        // Trigger submission grades aggregated event
        $event = \mod_workshop\event\submission_grades_aggregated::create([
            'objectid' => $workshop->id,
            'context' => $workshop->context,
            'other' => [
                'submissionsGraded' => $calculationResults['submissions_graded']['count']
            ]
        ]);
        $event->trigger();
        
        // Trigger assessment grades evaluated event
        $event = \mod_workshop\event\assessment_grades_evaluated::create([
            'objectid' => $workshop->id,
            'context' => $workshop->context,
            'other' => [
                'assessmentsEvaluated' => $calculationResults['assessments_evaluated']['count']
            ]
        ]);
        $event->trigger();
    }
    
    /**
     * Check if workshop should auto-advance to closed phase.
     *
     * If all submissions are graded and all assessments are evaluated,
     * and configuration permits, automatically advance workshop to closed phase.
     *
     * @param object $workshop          Workshop instance
     * @param array  $calculationResults Calculation results data
     * @return bool True if phase was updated
     */
    private function checkAutoAdvancePhase($workshop, $calculationResults) {
        // Check if auto-advance is enabled in workshop settings
        if (!$workshop->phaseswitchassessment) {
            return false;
        }
        
        // Check if all work is complete
        $allGraded = $calculationResults['statistics']['total_pending'] == 0;
        $allEvaluated = $calculationResults['assessments_evaluated']['count'] > 0;
        
        if ($allGraded && $allEvaluated) {
            // Advance to closed phase
            $workshop->switch_phase(workshop::PHASE_CLOSED);
            return true;
        }
        
        return false;
    }
    
    /**
     * Get human-readable phase name for phase code.
     *
     * @param int $phaseCode Phase constant value
     * @return string Phase name
     */
    private function getPhaseNameForCode($phaseCode) {
        $phases = [
            workshop::PHASE_SETUP => 'Setup',
            workshop::PHASE_SUBMISSION => 'Submission',
            workshop::PHASE_ASSESSMENT => 'Assessment',
            workshop::PHASE_EVALUATION => 'Evaluation',
            workshop::PHASE_CLOSED => 'Closed'
        ];
        
        return $phases[$phaseCode] ?? 'Unknown';
    }
    
    /**
     * Handle GET requests - not supported for this endpoint.
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown
     */
    protected function handle_get() {
        throw new MethodNotAllowedException('GET method not supported for grade calculation', [
            'allowedMethods' => ['POST'],
            'endpoint' => '/api/v1/workshop/{id}/calculate'
        ]);
    }
    
    /**
     * Handle PUT requests - not supported for this endpoint.
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method not supported for grade calculation', [
            'allowedMethods' => ['POST'],
            'endpoint' => '/api/v1/workshop/{id}/calculate'
        ]);
    }
    
    /**
     * Handle DELETE requests - not supported for this endpoint.
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method not supported for grade calculation', [
            'allowedMethods' => ['POST'],
            'endpoint' => '/api/v1/workshop/{id}/calculate'
        ]);
    }
}

// Instantiate and execute the endpoint
$endpoint = new WorkshopCalculateEndpoint();
$endpoint->execute();
