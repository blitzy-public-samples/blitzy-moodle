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
 * H5P Activity Results Submission API Endpoint
 *
 * REST API endpoint for processing H5P xAPI result submissions from H5P player.
 * Accepts xAPI statement JSON payload, validates format, persists learning data,
 * and triggers grade calculation.
 *
 * Endpoint: POST /api/v1/h5pactivity/{id}/results
 * 
 * Request Headers:
 *   - Authorization: Bearer <JWT token>
 *   - Content-Type: application/json
 * 
 * Request Body (JSON):
 * {
 *   "actor": {
 *     "objectType": "Agent",
 *     "account": {
 *       "homePage": "https://moodle.example.com",
 *       "name": "user123"
 *     }
 *   },
 *   "verb": {
 *     "id": "http://adlnet.gov/expapi/verbs/answered",
 *     "display": { "en-US": "answered" }
 *   },
 *   "object": {
 *     "id": "https://moodle.example.com/xapi/activity/12345",
 *     "objectType": "Activity"
 *   },
 *   "result": {
 *     "score": { "raw": 8, "min": 0, "max": 10, "scaled": 0.8 },
 *     "completion": true,
 *     "success": true,
 *     "duration": "PT5M30S"
 *   },
 *   "context": {
 *     "contextActivities": {
 *       "parent": [{ "id": "https://moodle.example.com/mod/h5pactivity/view.php?id=123" }]
 *     }
 *   }
 * }
 *
 * Success Response (200 OK):
 * {
 *   "success": true,
 *   "data": {
 *     "attemptId": 456,
 *     "score": 8.0,
 *     "maxScore": 10.0,
 *     "scaled": 0.8,
 *     "completion": true,
 *     "success": true,
 *     "duration": "PT5M30S",
 *     "timemodified": 1640000000
 *   }
 * }
 *
 * Error Responses:
 * - 401 Unauthorized: Invalid or missing JWT token
 * - 403 Forbidden: User lacks mod/h5pactivity:submit capability or tracking disabled
 * - 404 Not Found: H5P activity not found
 * - 400 Bad Request: Invalid xAPI statement format
 *
 * @package    api
 * @subpackage h5pactivity
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Load Moodle configuration and core libraries
// In test environment, these are already loaded by PHPUnit bootstrap or test script
if (!defined('PHPUNIT_TEST') && !defined('API_TEST_MODE')) {
    require_once(__DIR__ . '/../../../config.php');
    require_once($CFG->dirroot . '/mod/h5pactivity/lib.php');
    require_once($CFG->dirroot . '/mod/h5pactivity/classes/local/manager.php');
    require_once($CFG->dirroot . '/mod/h5pactivity/classes/local/attempt.php');
    require_once($CFG->dirroot . '/mod/h5pactivity/classes/local/grader.php');
    require_once($CFG->dirroot . '/lib/xapi/classes/local/statement.php');
    require_once($CFG->dirroot . '/lib/xapi/classes/local/statement/item.php');
}

// Load API base class and dependencies
require_once(__DIR__ . '/../../lib/api_base.php');

use mod_h5pactivity\local\manager;
use mod_h5pactivity\local\attempt;
use mod_h5pactivity\local\grader;
use core_xapi\local\statement;

/**
 * H5P Activity Results Submission Endpoint
 *
 * Handles POST requests to submit xAPI statements containing H5P activity results.
 * Validates JWT authentication, checks submission permissions, validates xAPI format,
 * persists learning data to database, and triggers grade calculation.
 */
class H5PActivityResultsEndpoint extends ApiBase {
    
    /**
     * Handle POST request to submit H5P activity results.
     *
     * Processes xAPI statement from H5P player, validates format and permissions,
     * creates or updates attempt record, saves statement data, and triggers grading.
     *
     * @return void Outputs JSON response directly
     * @throws ForbiddenException If user lacks required capabilities
     * @throws ValidationException If xAPI statement format is invalid
     * @throws NotFoundException If H5P activity not found
     */
    protected function handle_post() {
        global $DB;
        
        // Get authenticated user from JWT token
        $user = $this->getUser();
        
        // Extract H5P activity ID from URL parameters
        // Expected URL: /api/v1/h5pactivity/{id}/results
        $h5pactivityid = $this->getParam('id', PARAM_INT);
        
        if (empty($h5pactivityid)) {
            $this->error(
                'INVALID_PARAMETER',
                'H5P activity ID is required',
                400,
                ['parameter' => 'id', 'type' => 'integer']
            );
            return;
        }
        
        // Get H5P activity instance from database
        $h5pactivity = $DB->get_record('h5pactivity', ['id' => $h5pactivityid], '*', IGNORE_MISSING);
        
        if (!$h5pactivity) {
            $this->error(
                'NOT_FOUND',
                'H5P activity not found',
                404,
                ['h5pactivityId' => $h5pactivityid]
            );
            return;
        }
        
        // Get course module record
        $cm = get_coursemodule_from_instance('h5pactivity', $h5pactivityid, $h5pactivity->course, false, MUST_EXIST);
        
        if (!$cm) {
            $this->error(
                'NOT_FOUND',
                'Course module not found for H5P activity',
                404,
                ['h5pactivityId' => $h5pactivityid]
            );
            return;
        }
        
        // Get context for capability checking
        $context = context_module::instance($cm->id);
        
        // Check if user has permission to submit results
        $this->checkCapability('mod/h5pactivity:submit', $context);
        
        // Create manager instance for H5P activity
        $manager = manager::create_from_coursemodule($cm);
        
        // Check if tracking is enabled for this activity
        if (!$manager->is_tracking_enabled()) {
            $this->error(
                'TRACKING_DISABLED',
                'Result tracking is not enabled for this H5P activity',
                403,
                [
                    'h5pactivityId' => $h5pactivityid,
                    'reason' => 'Activity must have tracking enabled to accept results'
                ]
            );
            return;
        }
        
        // Check if user can submit to this activity
        if (!$manager->can_submit($user)) {
            $this->error(
                'SUBMISSION_NOT_ALLOWED',
                'You are not allowed to submit results for this H5P activity',
                403,
                [
                    'h5pactivityId' => $h5pactivityid,
                    'userId' => $user->id,
                    'reason' => 'User does not have submission privileges for this activity'
                ]
            );
            return;
        }
        
        // Get JSON request body containing xAPI statement
        $statementData = $this->getJsonBody();
        
        // Validate required xAPI statement fields
        $validationErrors = $this->validateXapiStatement($statementData);
        
        if (!empty($validationErrors)) {
            $this->error(
                'INVALID_XAPI_STATEMENT',
                'xAPI statement validation failed',
                400,
                [
                    'errors' => $validationErrors,
                    'receivedFields' => array_keys($statementData)
                ]
            );
            return;
        }
        
        try {
            // Create statement object from JSON data
            // The statement class expects the data in a specific format
            $statementJson = json_encode($statementData);
            $statementObject = statement::create_from_json($statementJson);
            
        } catch (Exception $e) {
            $this->error(
                'XAPI_PROCESSING_ERROR',
                'Failed to create xAPI statement object',
                400,
                [
                    'message' => $e->getMessage(),
                    'reason' => 'Invalid xAPI statement structure'
                ]
            );
            return;
        }
        
        // Extract subcontent ID from object ID if present
        // H5P adds subcontent parameter like: contextid?subContentId=123
        $xapiObjectId = $statementData['object']['id'] ?? '';
        $subcontent = '';
        
        if (strpos($xapiObjectId, '?') !== false) {
            $parts = explode('?', $xapiObjectId, 2);
            $queryString = $parts[1] ?? '';
            $subcontent = str_replace('subContentId=', '', $queryString);
        }
        
        // Determine if this is a new attempt or continuation
        // Empty subcontent means this is a main statement indicating new attempt
        // Non-empty subcontent means this is a sub-statement for existing attempt
        if (empty($subcontent)) {
            // Create new attempt for this user
            $attemptRecord = attempt::new_attempt($user, $cm);
        } else {
            // Get the last attempt for this user
            $attemptRecord = attempt::last_attempt($user, $cm);
        }
        
        if (!$attemptRecord) {
            $this->error(
                'ATTEMPT_CREATION_FAILED',
                'Failed to create or retrieve attempt record',
                500,
                [
                    'userId' => $user->id,
                    'h5pactivityId' => $h5pactivityid,
                    'subcontent' => $subcontent
                ]
            );
            return;
        }
        
        // Save the xAPI statement to the attempt
        $statementSaved = $attemptRecord->save_statement($statementObject, $subcontent);
        
        if (!$statementSaved) {
            $this->error(
                'STATEMENT_SAVE_FAILED',
                'Failed to save xAPI statement to attempt',
                500,
                [
                    'attemptId' => $attemptRecord->get_id(),
                    'reason' => 'Statement could not be persisted to database'
                ]
            );
            return;
        }
        
        // Check if score was updated and trigger grading if necessary
        $gradeUpdated = false;
        $newGrade = null;
        
        if ($attemptRecord->get_scoreupdated()) {
            // Get grader instance from manager
            $grader = $manager->get_grader();
            
            // Update grades for this user in the gradebook
            $grader->update_grades($user->id);
            
            $gradeUpdated = true;
        }
        
        // Extract result data for response
        $resultData = $statementData['result'] ?? [];
        $scoreData = $resultData['score'] ?? [];
        
        // Build response data with attempt information
        $responseData = [
            'attemptId' => $attemptRecord->get_id(),
            'score' => $scoreData['raw'] ?? null,
            'maxScore' => $scoreData['max'] ?? null,
            'minScore' => $scoreData['min'] ?? null,
            'scaled' => $scoreData['scaled'] ?? null,
            'completion' => $resultData['completion'] ?? false,
            'success' => $resultData['success'] ?? null,
            'duration' => $resultData['duration'] ?? null,
            'timemodified' => $attemptRecord->get_timemodified(),
            'gradeUpdated' => $gradeUpdated,
        ];
        
        // Add current grade if available
        if ($gradeUpdated) {
            $scaledScore = $manager->get_users_scaled_score($user->id);
            if ($scaledScore && isset($scaledScore[$user->id])) {
                $userScore = $scaledScore[$user->id];
                $responseData['currentGrade'] = [
                    'scaled' => $userScore->scaled,
                    'timemodified' => $userScore->timemodified
                ];
            }
        }
        
        // Return success response with attempt and result data
        $this->success($responseData, 200);
    }
    
    /**
     * Validate xAPI statement structure and required fields.
     *
     * Checks that the xAPI statement contains all required fields according to
     * xAPI specification: actor, verb, object, and optionally result.
     * Returns array of validation error messages, or empty array if valid.
     *
     * @param array $statement xAPI statement data as associative array
     * @return array Array of validation error messages (empty if valid)
     */
    private function validateXapiStatement($statement) {
        $errors = [];
        
        // Validate actor (required)
        if (!isset($statement['actor'])) {
            $errors[] = 'Missing required field: actor';
        } else {
            if (!isset($statement['actor']['objectType'])) {
                $errors[] = 'Actor must have objectType field';
            }
            
            // Actor must have either mbox, mbox_sha1sum, openid, or account
            $hasIdentifier = isset($statement['actor']['mbox']) ||
                            isset($statement['actor']['mbox_sha1sum']) ||
                            isset($statement['actor']['openid']) ||
                            isset($statement['actor']['account']);
            
            if (!$hasIdentifier) {
                $errors[] = 'Actor must have one of: mbox, mbox_sha1sum, openid, or account';
            }
        }
        
        // Validate verb (required)
        if (!isset($statement['verb'])) {
            $errors[] = 'Missing required field: verb';
        } else {
            if (!isset($statement['verb']['id'])) {
                $errors[] = 'Verb must have id field';
            }
            
            // Validate verb ID format (should be IRI/URL)
            $verbId = $statement['verb']['id'] ?? '';
            if (!empty($verbId) && !filter_var($verbId, FILTER_VALIDATE_URL)) {
                $errors[] = 'Verb id must be a valid IRI/URL';
            }
            
            // Check for H5P-specific valid verbs (answered or completed)
            $validVerbs = [
                'http://adlnet.gov/expapi/verbs/answered',
                'http://adlnet.gov/expapi/verbs/completed',
            ];
            
            if (!empty($verbId) && !in_array($verbId, $validVerbs)) {
                $errors[] = 'H5P activity only accepts "answered" or "completed" verbs. Received: ' . $verbId;
            }
        }
        
        // Validate object (required)
        if (!isset($statement['object'])) {
            $errors[] = 'Missing required field: object';
        } else {
            if (!isset($statement['object']['id'])) {
                $errors[] = 'Object must have id field';
            }
            
            if (!isset($statement['object']['objectType'])) {
                $errors[] = 'Object must have objectType field';
            }
        }
        
        // Validate result (optional but recommended for grading)
        if (isset($statement['result'])) {
            $result = $statement['result'];
            
            // If score is present, validate its structure
            if (isset($result['score'])) {
                $score = $result['score'];
                
                // Score must have scaled or raw value
                if (!isset($score['scaled']) && !isset($score['raw'])) {
                    $errors[] = 'Score must have either scaled or raw value';
                }
                
                // Validate scaled is between -1 and 1
                if (isset($score['scaled'])) {
                    $scaled = $score['scaled'];
                    if (!is_numeric($scaled) || $scaled < -1 || $scaled > 1) {
                        $errors[] = 'Score scaled must be a number between -1 and 1';
                    }
                }
                
                // Validate max/min if raw is present
                if (isset($score['raw'])) {
                    if (!is_numeric($score['raw'])) {
                        $errors[] = 'Score raw must be a numeric value';
                    }
                    
                    // If max and min are present, validate raw is within range
                    if (isset($score['max']) && isset($score['min'])) {
                        $raw = $score['raw'];
                        $max = $score['max'];
                        $min = $score['min'];
                        
                        if ($raw < $min || $raw > $max) {
                            $errors[] = "Score raw ($raw) must be between min ($min) and max ($max)";
                        }
                    }
                }
            }
            
            // Validate completion is boolean if present
            if (isset($result['completion']) && !is_bool($result['completion'])) {
                $errors[] = 'Result completion must be a boolean value';
            }
            
            // Validate success is boolean if present
            if (isset($result['success']) && !is_bool($result['success'])) {
                $errors[] = 'Result success must be a boolean value';
            }
            
            // Validate duration format if present (ISO 8601 duration)
            if (isset($result['duration'])) {
                $duration = $result['duration'];
                if (!preg_match('/^P(?:\d+Y)?(?:\d+M)?(?:\d+D)?(?:T(?:\d+H)?(?:\d+M)?(?:\d+(?:\.\d+)?S)?)?$/', $duration)) {
                    $errors[] = 'Result duration must be in ISO 8601 duration format (e.g., PT5M30S)';
                }
            }
        } else {
            // Warn if result is missing (not an error, but recommended for grading)
            // We don't add this as an error since result is technically optional in xAPI
            // but H5P activities typically include it for grading purposes
        }
        
        return $errors;
    }
    
    /**
     * Handle GET requests - not supported for this endpoint.
     *
     * Results submission requires POST method. This method throws
     * MethodNotAllowedException to indicate GET is not supported.
     *
     * @throws MethodNotAllowedException Always, as GET is not supported
     */
    protected function handle_get() {
        throw new MethodNotAllowedException('GET method is not supported for results submission', [
            'supportedMethods' => ['POST'],
            'endpoint' => '/api/v1/h5pactivity/{id}/results'
        ]);
    }
    
    /**
     * Handle PUT requests - not supported for this endpoint.
     *
     * Results are submitted via POST. This method throws
     * MethodNotAllowedException to indicate PUT is not supported.
     *
     * @throws MethodNotAllowedException Always, as PUT is not supported
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method is not supported for results submission', [
            'supportedMethods' => ['POST'],
            'endpoint' => '/api/v1/h5pactivity/{id}/results'
        ]);
    }
    
    /**
     * Handle DELETE requests - not supported for this endpoint.
     *
     * Results cannot be deleted via API. This method throws
     * MethodNotAllowedException to indicate DELETE is not supported.
     *
     * @throws MethodNotAllowedException Always, as DELETE is not supported
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method is not supported for results submission', [
            'supportedMethods' => ['POST'],
            'endpoint' => '/api/v1/h5pactivity/{id}/results'
        ]);
    }
}

// Instantiate and execute the endpoint
// Skip auto-execution in test mode to allow manual instantiation
if (!defined('API_TEST_MODE') || !API_TEST_MODE) {
    $endpoint = new H5PActivityResultsEndpoint();
    $endpoint->execute();
}
