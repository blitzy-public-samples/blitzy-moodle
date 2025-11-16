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
 * LTI Grade Passback API Endpoint
 *
 * REST API endpoint for LTI grade passback from external tools to Moodle gradebook.
 * Handles grade synchronization via LTI 1.1 Outcomes service (XML format) and modern
 * JSON API calls. Wraps existing Moodle LTI grade functions without reimplementing
 * any business logic.
 *
 * Endpoint: POST /api/v1/lti/{id}/grade
 *
 * Authentication: OAuth 1.0a signature verification (LTI 1.1) or JWT token (API clients)
 *
 * Request Formats:
 * - XML (LTI 1.1 Outcomes): replaceResultRequest with sourcedId and resultScore
 * - JSON (API): {instanceid, userid, grade, launchid}
 *
 * Response Formats:
 * - XML (LTI 1.1): replaceResultResponse with status code
 * - JSON (API): {success, data: {gradeUpdated, userId, instanceId}}
 *
 * Grade Calculation:
 * - Uses existing lti_update_grade() function from servicelib.php
 * - Maintains 100% grade calculation parity with PHP implementation
 * - NO reimplementation of grade logic
 *
 * @package    mod_lti
 * @category   api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Load Moodle configuration
require_once(__DIR__ . '/../../../config.php');

// Load core Moodle libraries
require_once($CFG->dirroot . '/lib/moodlelib.php');
require_once($CFG->dirroot . '/lib/gradelib.php');

// Load LTI module libraries for grade processing functions
require_once($CFG->dirroot . '/mod/lti/lib.php');
require_once($CFG->dirroot . '/mod/lti/locallib.php');
require_once($CFG->dirroot . '/mod/lti/servicelib.php');

// Load API utilities
require_once(__DIR__ . '/../../lib/api_base.php');

/**
 * LTI Grade Passback API Endpoint Class
 *
 * Handles grade synchronization from external LTI tools back to Moodle gradebook.
 * Supports both LTI 1.1 Outcomes service (XML) and modern JSON API format.
 *
 * Authentication Strategy:
 * - LTI 1.1 requests: OAuth 1.0a signature verification (consumer key/secret)
 * - API requests: Standard JWT token validation (inherited from ApiBase)
 * - Disables requireAuth initially, performs custom authentication based on Content-Type
 *
 * Key Operations:
 * 1. Detect request format (XML vs JSON) via Content-Type header
 * 2. Authenticate request (OAuth for LTI, JWT for API)
 * 3. Extract grade data (sourcedid + score for LTI, direct params for API)
 * 4. Validate sourcedid hash to prevent tampering
 * 5. Check if LTI instance accepts grades (instructorchoiceacceptgrades setting)
 * 6. Call lti_update_grade() to update Moodle gradebook
 * 7. Return success response in appropriate format
 *
 * Error Handling:
 * - OAuth signature verification failures
 * - Invalid sourcedid hash (tampering detection)
 * - Grade value out of range (0.0 to 1.0)
 * - LTI instance not configured to accept grades
 * - Database errors during grade update
 *
 */
class LtiGradeEndpoint extends ApiBase {
    
    /**
     * @var bool Disable standard JWT authentication (use custom LTI OAuth)
     */
    protected $requireAuth = false;
    
    /**
     * @var bool Track if request is LTI XML format (vs JSON API)
     */
    private $isLtiXmlRequest = false;
    
    /**
     * @var string Raw request body (needed for OAuth signature verification)
     */
    private $rawRequestBody = '';
    
    /**
     * Constructor
     *
     * Initializes endpoint and detects request format. For LTI XML requests,
     * stores raw body for OAuth verification. Does not perform JWT authentication
     * since LTI requests use OAuth 1.0a signatures instead.
     *
     * @throws Exception If request body cannot be read
     */
    public function __construct() {
        // Read raw request body before parent constructor
        // (needed for OAuth signature verification in LTI requests)
        $this->rawRequestBody = file_get_contents('php://input');
        
        // Detect if this is an LTI XML request (vs JSON API request)
        $contentType = $_SERVER['CONTENT_TYPE'] ?? '';
        $contentType = explode(';', $contentType)[0];
        $contentType = trim($contentType);
        
        // LTI 1.1 Outcomes service uses application/xml
        $this->isLtiXmlRequest = ($contentType === 'application/xml' || $contentType === 'text/xml');
        
        // Call parent constructor (skips JWT auth since requireAuth = false)
        parent::__construct();
    }
    
    /**
     * Handle GET requests - Not supported for grade passback
     *
     * Grade passback is a POST-only operation. GET requests are not allowed.
     *
     * @throws MethodNotAllowedException Always throws exception
     */
    protected function handle_get() {
        throw new MethodNotAllowedException('GET method not supported for grade passback', [
            'allowedMethods' => ['POST'],
            'reason' => 'Grade passback requires POST with grade data'
        ]);
    }
    
    /**
     * Handle POST requests - Process grade passback
     *
     * Main handler for grade passback requests. Routes to appropriate handler
     * based on request format (XML for LTI 1.1, JSON for API clients).
     *
     * Request Flow:
     * 1. Detect format (XML vs JSON)
     * 2. Authenticate (OAuth for XML, JWT for JSON)
     * 3. Extract grade data
     * 4. Validate and process grade
     * 5. Return response in matching format
     *
     * @return void Outputs response directly
     * @throws ValidationException If request data is invalid
     * @throws UnauthorizedException If authentication fails
     * @throws ForbiddenException If LTI instance doesn't accept grades
     */
    protected function handle_post() {
        global $DB;
        
        try {
            if ($this->isLtiXmlRequest) {
                // Handle LTI 1.1 XML Outcomes service request
                $this->handleLtiXmlRequest();
            } else {
                // Handle JSON API request
                $this->handleJsonApiRequest();
            }
            
        } catch (Exception $e) {
            // For LTI XML requests, return XML error response
            if ($this->isLtiXmlRequest) {
                $this->sendLtiXmlError($e->getMessage());
            } else {
                // For JSON requests, re-throw to let ApiBase handle it
                throw $e;
            }
        }
    }
    
    /**
     * Handle PUT requests - Not supported
     *
     * @throws MethodNotAllowedException Always throws exception
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method not supported', [
            'allowedMethods' => ['POST'],
            'reason' => 'Use POST for grade passback'
        ]);
    }
    
    /**
     * Handle DELETE requests - Not supported
     *
     * Note: Grade deletion is handled via POST with empty resultScore in LTI 1.1
     * or grade=null in JSON API, not via DELETE method.
     *
     * @throws MethodNotAllowedException Always throws exception
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method not supported', [
            'allowedMethods' => ['POST'],
            'reason' => 'Use POST with null/empty grade value to delete grades'
        ]);
    }
    
    /**
     * Handle LTI 1.1 XML Outcomes Service Request
     *
     * Processes grade passback from external LTI tools using IMS LTI 1.1
     * Outcomes service specification. Expects XML format with OAuth 1.0a
     * signature for authentication.
     *
     * XML Request Format (replaceResultRequest):
     * <imsx_POXEnvelopeRequest>
     *   <imsx_POXBody>
     *     <replaceResultRequest>
     *       <resultRecord>
     *         <sourcedGUID>
     *           <sourcedId>BASE64_ENCODED_JSON_WITH_HASH</sourcedId>
     *         </sourcedGUID>
     *         <result>
     *           <resultScore>
     *             <language>en</language>
     *             <textString>0.85</textString>
     *           </resultScore>
     *         </result>
     *       </resultRecord>
     *     </replaceResultRequest>
     *   </imsx_POXBody>
     * </imsx_POXEnvelopeRequest>
     *
     * Processing Steps:
     * 1. Verify OAuth 1.0a signature using consumer key/secret
     * 2. Parse XML to extract sourcedId and resultScore
     * 3. Decode sourcedId to get instanceid, userid, launchid
     * 4. Verify sourcedId hash to prevent tampering
     * 5. Check if LTI instance accepts grades
     * 6. Update grade using lti_update_grade()
     * 7. Return XML success/failure response
     *
     * @return void Outputs XML response directly
     * @throws Exception If OAuth verification fails or grade update fails
     */
    private function handleLtiXmlRequest() {
        global $DB;
        
        // Step 1: Verify OAuth 1.0a signature
        // Extract consumer key from OAuth headers
        $consumerkey = lti\get_oauth_key_from_headers(null, array(\mod_lti\local\ltiservice\service_base::SCOPE_BASIC_OUTCOMES));
        
        if ($consumerkey === false) {
            throw new Exception('Missing or invalid consumer key in OAuth headers');
        }
        
        // Get shared secrets for this consumer key
        $secrets = lti_get_shared_secrets_by_key($consumerkey);
        
        if (empty($secrets)) {
            throw new Exception('No shared secrets found for consumer key');
        }
        
        // Verify OAuth signature using shared secret
        $sharedsecret = lti_verify_message($consumerkey, $secrets, $this->rawRequestBody);
        
        if ($sharedsecret === false) {
            throw new Exception('OAuth signature verification failed');
        }
        
        // Step 2: Parse XML request body
        $xml = simplexml_load_string($this->rawRequestBody);
        
        if (!$xml) {
            throw new Exception('Invalid XML content in request body');
        }
        
        // Extract message type from XML body
        $body = $xml->imsx_POXBody;
        $messagetype = null;
        
        foreach ($body->children() as $child) {
            $messagetype = $child->getName();
            break;
        }
        
        // Only support replaceResultRequest for grade passback
        if ($messagetype !== 'replaceResultRequest') {
            throw new Exception("Unsupported message type: {$messagetype}. Expected replaceResultRequest");
        }
        
        // Step 3: Parse grade replacement message
        // Uses existing Moodle function to extract sourcedId and grade
        $parsed = lti_parse_grade_replace_message($xml);
        
        if (!$parsed) {
            throw new Exception('Failed to parse grade replace message from XML');
        }
        
        // Validate required fields from parsed data
        if (!isset($parsed->instanceid) || !isset($parsed->userid)) {
            throw new Exception('Missing required fields in sourcedId: instanceid or userid');
        }
        
        // Step 4: Get LTI instance from database
        $ltiinstance = $DB->get_record('lti', array('id' => $parsed->instanceid));
        
        if (!$ltiinstance) {
            throw new Exception("LTI instance not found: {$parsed->instanceid}");
        }
        
        // Step 5: Check if LTI instance accepts grades
        if (!lti_accepts_grades($ltiinstance)) {
            throw new Exception('This LTI instance is not configured to accept grades');
        }
        
        // Step 6: Verify sourcedId hash to prevent tampering
        // This rebuilds the sourcedId on server side and compares hash
        try {
            lti_verify_sourcedid($ltiinstance, $parsed);
        } catch (Exception $e) {
            throw new Exception('SourcedId verification failed: ' . $e->getMessage());
        }
        
        // Step 7: Set session user for grade update
        // Required for capability checks in grade_update()
        lti_set_session_user($parsed->userid);
        
        // Step 8: Update grade using existing Moodle function
        // This function handles all grade calculation and database updates
        // Grade value is already normalized to 0.0-1.0 scale by parser
        $launchid = $parsed->launchid ?? 0;
        $gradeval = $parsed->gradeval ?? null;
        
        // Handle grade deletion (empty resultScore)
        if ($gradeval === null || $gradeval === '') {
            // Delete grade from gradebook
            $gradestatus = lti_delete_grade($ltiinstance, $parsed->userid);
        } else {
            // Update grade in gradebook
            $gradestatus = lti_update_grade($ltiinstance, $parsed->userid, $launchid, $gradeval);
        }
        
        if (!$gradestatus) {
            throw new Exception('Failed to update grade in gradebook');
        }
        
        // Step 9: Return XML success response
        // Use existing Moodle function to generate LTI Outcomes response
        $messageid = $parsed->messageid ?? uniqid('msg');
        
        $responsexml = lti_get_response_xml(
            'success',
            'Grade successfully updated',
            $messageid,
            'replaceResultResponse'
        );
        
        // Set XML content type header
        header('Content-Type: application/xml; charset=UTF-8');
        
        // Output XML response
        echo $responsexml->asXML();
    }
    
    /**
     * Handle JSON API Request
     *
     * Processes grade passback from modern API clients (e.g., React frontend)
     * using JSON format. Requires JWT authentication and expects grade data
     * as JSON payload.
     *
     * JSON Request Format:
     * {
     *   "instanceid": 123,
     *   "userid": 456,
     *   "grade": 0.85,
     *   "launchid": 789  // optional
     * }
     *
     * Grade Value:
     * - Must be between 0.0 and 1.0 (normalized scale)
     * - Will be multiplied by LTI instance max grade
     * - Use null or omit to delete grade
     *
     * Processing Steps:
     * 1. Validate JWT token (standard API authentication)
     * 2. Extract grade data from JSON body
     * 3. Validate required parameters
     * 4. Get LTI instance from database
     * 5. Check if instance accepts grades
     * 6. Verify user has permission to update grades
     * 7. Update grade using lti_update_grade()
     * 8. Return JSON success response
     *
     * @return void Outputs JSON response directly
     * @throws ValidationException If request data is invalid
     * @throws UnauthorizedException If JWT authentication fails
     * @throws ForbiddenException If user lacks permission
     */
    private function handleJsonApiRequest() {
        global $DB;
        
        // Step 1: Authenticate with JWT token
        // For API requests, we need standard authentication
        try {
            $token = $this->jwtAuth->extractTokenFromRequest();
            
            if (!$token) {
                throw new UnauthorizedException('No authentication token provided', [
                    'header' => 'Authorization',
                    'format' => 'Bearer <token>'
                ]);
            }
            
            $this->user = $this->jwtAuth->getUserFromToken($token);
            
        } catch (Exception $e) {
            throw new UnauthorizedException('Authentication failed: ' . $e->getMessage());
        }
        
        // Step 2: Get JSON request body
        $data = $this->getJsonBody();
        
        // Step 3: Validate required parameters
        if (!isset($data['instanceid'])) {
            throw new ValidationException('Missing required parameter: instanceid', [
                'parameter' => 'instanceid',
                'required' => true
            ]);
        }
        
        if (!isset($data['userid'])) {
            throw new ValidationException('Missing required parameter: userid', [
                'parameter' => 'userid',
                'required' => true
            ]);
        }
        
        $instanceid = (int)$data['instanceid'];
        $userid = (int)$data['userid'];
        $grade = isset($data['grade']) ? floatval($data['grade']) : null;
        $launchid = isset($data['launchid']) ? (int)$data['launchid'] : 0;
        
        // Validate grade value (must be 0.0 to 1.0 or null for deletion)
        if ($grade !== null && ($grade < 0.0 || $grade > 1.0)) {
            throw new ValidationException('Grade value must be between 0.0 and 1.0', [
                'parameter' => 'grade',
                'value' => $grade,
                'min' => 0.0,
                'max' => 1.0
            ]);
        }
        
        // Step 4: Get LTI instance from database
        $ltiinstance = $DB->get_record('lti', array('id' => $instanceid));
        
        if (!$ltiinstance) {
            throw new NotFoundException("LTI instance not found", [
                'instanceid' => $instanceid
            ]);
        }
        
        // Step 5: Check if LTI instance accepts grades
        if (!lti_accepts_grades($ltiinstance)) {
            throw new ForbiddenException('This LTI instance is not configured to accept grades', [
                'instanceid' => $instanceid,
                'setting' => 'instructorchoiceacceptgrades'
            ]);
        }
        
        // Step 6: Get course module and context for permission check
        $cm = get_coursemodule_from_instance('lti', $instanceid, 0, false, MUST_EXIST);
        $context = context_module::instance($cm->id);
        
        // Check if user has permission to grade
        // This uses existing Moodle capability checking
        $this->checkCapability('mod/lti:grade', $context);
        
        // Step 7: Set session user for grade update
        lti_set_session_user($userid);
        
        // Step 8: Update or delete grade
        if ($grade === null) {
            // Delete grade from gradebook
            $gradestatus = lti_delete_grade($ltiinstance, $userid);
            $operation = 'deleted';
        } else {
            // Update grade in gradebook
            $gradestatus = lti_update_grade($ltiinstance, $userid, $launchid, $grade);
            $operation = 'updated';
        }
        
        if (!$gradestatus) {
            throw new ServerException('Failed to update grade in gradebook', [
                'instanceid' => $instanceid,
                'userid' => $userid
            ]);
        }
        
        // Step 9: Return JSON success response
        $this->success([
            'gradeUpdated' => true,
            'operation' => $operation,
            'instanceId' => $instanceid,
            'userId' => $userid,
            'grade' => $grade,
            'timestamp' => time()
        ], 200);
    }
    
    /**
     * Send LTI XML Error Response
     *
     * Generates and outputs an error response in LTI 1.1 XML format.
     * Used when LTI XML requests fail during processing.
     *
     * XML Error Format:
     * <imsx_POXEnvelopeResponse>
     *   <imsx_POXHeader>
     *     <imsx_POXResponseHeaderInfo>
     *       <imsx_version>V1.0</imsx_version>
     *       <imsx_messageIdentifier>...</imsx_messageIdentifier>
     *       <imsx_statusInfo>
     *         <imsx_codeMajor>failure</imsx_codeMajor>
     *         <imsx_severity>error</imsx_severity>
     *         <imsx_description>Error message</imsx_description>
     *       </imsx_statusInfo>
     *     </imsx_POXResponseHeaderInfo>
     *   </imsx_POXHeader>
     * </imsx_POXEnvelopeResponse>
     *
     * @param string $message Error message to include in response
     * @return void Outputs XML response and exits
     */
    private function sendLtiXmlError($message) {
        // Generate error response XML using existing Moodle function
        $responsexml = lti_get_response_xml(
            'failure',
            $message,
            uniqid('msg'),
            'replaceResultResponse'
        );
        
        // Set XML content type header
        header('Content-Type: application/xml; charset=UTF-8');
        http_response_code(400);
        
        // Output XML response
        echo $responsexml->asXML();
        exit;
    }
}

// Instantiate and execute endpoint
$endpoint = new LtiGradeEndpoint();
$endpoint->execute();



