<?php
/**
 * Badges Block API Endpoint
 *
 * REST API endpoint for GET /api/v1/blocks/badges
 * Returns user badges widget data for React dashboard display.
 *
 * This endpoint wraps the badges_get_user_badges() function to fetch earned
 * badges for the authenticated user. Supports optional course filtering and
 * limit parameters. Returns badge objects with id, name, description, image URL,
 * issuer details, and dates.
 *
 * @package    api
 * @subpackage blocks
 * @copyright  2024 Moodle React Refactor
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Include required files
require_once(__DIR__ . '/../../../config.php');
require_once(__DIR__ . '/../../lib/api_base.php');
require_once($CFG->libdir . '/badgeslib.php');

/**
 * Badges Block API Endpoint Class
 *
 * Handles GET requests for user badges data. Provides badge information
 * for dashboard widget display in React frontend.
 *
 * Extends ApiBase to inherit JWT authentication, capability checking,
 * parameter validation, and standardized response formatting.
 */
class BadgesBlockApiEndpoint extends ApiBase {
    
    /**
     * Handle GET requests for badges data.
     *
     * Retrieves earned badges for the authenticated user with optional
     * course filtering. Checks moodle/badges:view capability and respects
     * the badges enabled configuration.
     *
     * Query Parameters:
     * - courseid (optional int): Filter badges by course ID (0 or null for site badges)
     * - limit (optional int): Maximum number of badges to return (default: 10)
     *
     * Response Format:
     * {
     *   "success": true,
     *   "data": {
     *     "badges": [
     *       {
     *         "id": 1,
     *         "name": "Badge Name",
     *         "description": "Badge description",
     *         "image_url": "https://...",
     *         "issuer_name": "Issuer",
     *         "date_issued": 1234567890,
     *         "expiry_date": 1234567890 or null,
     *         "external_url": "https://..." or null
     *       }
     *     ],
     *     "total": 5,
     *     "enabled": true
     *   }
     * }
     *
     * @return void Outputs JSON response directly
     * @throws UnauthorizedException If user is not authenticated
     * @throws ForbiddenException If user lacks moodle/badges:view capability
     */
    protected function handle_get() {
        global $CFG, $DB;
        
        // Get authenticated user
        $user = $this->getUser();
        $userid = $user->id;
        
        // Check capability in system context
        $systemcontext = context_system::instance();
        $this->checkCapability('moodle/badges:view', $systemcontext);
        
        // Get optional parameters with validation
        $courseid = $this->getParam('courseid', PARAM_INT, false, 0);
        $limit = $this->getParam('limit', PARAM_INT, false, 10);
        
        // Validate limit is positive
        if ($limit < 1) {
            $limit = 10;
        }
        
        // Check if badges are enabled
        if (!isset($CFG->enablebadges) || empty($CFG->enablebadges)) {
            // Badges are disabled - return empty data with message
            $this->success([
                'badges' => [],
                'total' => 0,
                'enabled' => false,
                'message' => 'Badges are not enabled on this site'
            ], 200);
            return;
        }
        
        try {
            // Call existing Moodle function to get user badges
            // Parameters: userid, courseid, page, perpage, search, onlypublic
            $badges = badges_get_user_badges(
                $userid,
                $courseid,
                0,          // page number (0 for first page)
                $limit,     // perpage (number of badges to return)
                '',         // search string (empty = no search filter)
                false       // onlypublic (false = include all badges user can see)
            );
            
            // Transform badge objects to API-friendly format
            $badgeData = [];
            
            if (!empty($badges)) {
                foreach ($badges as $badge) {
                    // Get badge image URL
                    $imageurl = '';
                    if (isset($badge->id)) {
                        // Use Moodle's badge image system
                        $badgeobject = new badge($badge->id);
                        $context = $badgeobject->get_context();
                        $imageurl = moodle_url::make_pluginfile_url(
                            $context->id,
                            'badges',
                            'badgeimage',
                            $badge->id,
                            '/',
                            'f1',
                            false
                        )->out(false);
                    }
                    
                    // Get issuer name from badge
                    $issuername = '';
                    if (!empty($badge->issuername)) {
                        $issuername = $badge->issuername;
                    } else if (!empty($badge->issuercontact)) {
                        $issuername = $badge->issuercontact;
                    }
                    
                    // Build badge data array
                    $badgeInfo = [
                        'id' => (int)$badge->id,
                        'name' => format_string($badge->name),
                        'description' => format_text($badge->description, FORMAT_HTML),
                        'image_url' => $imageurl,
                        'issuer_name' => $issuername,
                        'date_issued' => isset($badge->dateissued) ? (int)$badge->dateissued : null,
                        'expiry_date' => isset($badge->dateexpire) ? (int)$badge->dateexpire : null,
                        'external_url' => null
                    ];
                    
                    // Add external badge URL if available
                    if (!empty($badge->uniquehash)) {
                        $externalurl = new moodle_url('/badges/badge.php', ['hash' => $badge->uniquehash]);
                        $badgeInfo['external_url'] = $externalurl->out(false);
                    }
                    
                    // Add course ID if badge is course-specific
                    if (isset($badge->courseid) && $badge->courseid > 0) {
                        $badgeInfo['course_id'] = (int)$badge->courseid;
                    }
                    
                    $badgeData[] = $badgeInfo;
                }
            }
            
            // Get total count of user badges (for pagination metadata)
            $totalBadges = count($badgeData);
            
            // If we got the limit, there might be more badges
            // Query the database to get actual total count
            if ($totalBadges >= $limit) {
                $sql = "SELECT COUNT(DISTINCT b.id)
                        FROM {badge} b
                        JOIN {badge_issued} bi ON bi.badgeid = b.id
                        WHERE bi.userid = :userid
                        AND b.status = :status";
                
                $params = [
                    'userid' => $userid,
                    'status' => BADGE_STATUS_ACTIVE
                ];
                
                // Add course filter if specified
                if ($courseid > 0) {
                    $sql .= " AND b.courseid = :courseid";
                    $params['courseid'] = $courseid;
                }
                
                $totalBadges = $DB->count_records_sql($sql, $params);
            }
            
            // Return success response with badge data
            $this->success([
                'badges' => $badgeData,
                'total' => $totalBadges,
                'enabled' => true
            ], 200);
            
        } catch (Exception $e) {
            // Handle any unexpected errors
            $this->error(
                'BADGE_RETRIEVAL_ERROR',
                'Failed to retrieve badges: ' . $e->getMessage(),
                500,
                [
                    'userid' => $userid,
                    'courseid' => $courseid,
                    'errorMessage' => $e->getMessage()
                ]
            );
        }
    }
    
    /**
     * Handle POST requests (not supported).
     *
     * This endpoint only supports GET requests for reading badge data.
     * POST requests are not allowed.
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown
     */
    protected function handle_post() {
        throw new MethodNotAllowedException(
            'POST method is not supported for badges endpoint',
            ['allowedMethods' => ['GET']]
        );
    }
    
    /**
     * Handle PUT requests (not supported).
     *
     * This endpoint only supports GET requests for reading badge data.
     * PUT requests are not allowed.
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown
     */
    protected function handle_put() {
        throw new MethodNotAllowedException(
            'PUT method is not supported for badges endpoint',
            ['allowedMethods' => ['GET']]
        );
    }
    
    /**
     * Handle DELETE requests (not supported).
     *
     * This endpoint only supports GET requests for reading badge data.
     * DELETE requests are not allowed.
     *
     * @return void
     * @throws MethodNotAllowedException Always thrown
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException(
            'DELETE method is not supported for badges endpoint',
            ['allowedMethods' => ['GET']]
        );
    }
}

// Execute the endpoint if not in test mode
if (!defined('API_TEST_MODE')) {
    $endpoint = new BadgesBlockApi();
    $endpoint->execute();
}
