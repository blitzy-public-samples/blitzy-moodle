<?php
/**
 * Lesson Show API Endpoint
 *
 * REST API endpoint for retrieving detailed information about a specific lesson activity.
 * Handles GET /api/v1/lesson/{id} requests to return lesson properties, configuration,
 * availability restrictions, user progress, and metadata.
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Load Moodle configuration and dependencies
require_once(__DIR__ . '/../../config.php');
require_once($CFG->dirroot . '/mod/lesson/locallib.php');
require_once($CFG->dirroot . '/lib/accesslib.php');

// Load API utilities
require_once(__DIR__ . '/../../lib/api_base.php');
require_once(__DIR__ . '/../../lib/api_exception.php');

/**
 * Lesson Show Endpoint
 *
 * Extends ApiBase class for JWT authentication and standard response formatting.
 * Calls existing lesson::load() factory method to get lesson object, enforces capability
 * checks via require_capability('mod/lesson:view'), retrieves lesson record with course
 * module and context information, checks access restrictions (time limits, password
 * protection, dependencies), calculates user progress if authenticated, and returns
 * comprehensive lesson data including pages count, timing information, grade settings,
 * and completion status.
 *
 * Critical for React frontend to display lesson overview, validate access before
 * starting, and show user progress.
 */
class LessonShowEndpoint extends ApiBase {
    
    /**
     * Handle GET request to retrieve lesson details
     *
     * Implements the following workflow:
     * 1. Extract lesson ID from URI using regex pattern matching
     * 2. Load lesson object using lesson::load() factory method
     * 3. Get course module and course information
     * 4. Verify user has capability to view the lesson
     * 5. Apply user-specific overrides (deadlines, availability)
     * 6. Check access restrictions (time, password, dependencies)
     * 7. Calculate user progress if authenticated
     * 8. Build comprehensive response with lesson properties
     * 9. Return formatted JSON response
     *
     * @return void Outputs JSON response and exits
     * @throws NotFoundException If lesson ID cannot be extracted or lesson not found
     * @throws ForbiddenException If user lacks permission to view lesson
     */
    protected function handle_get() {
        global $DB, $USER;
        
        // Step 1: Extract lesson ID from request URI using regex pattern
        // Pattern matches /lesson/{id} at end of URI path
        if (!preg_match('/\/lesson\/(\d+)$/', $this->requestUri, $matches)) {
            throw new NotFoundException('Lesson ID not found in request URI');
        }
        
        $lessonid = (int) $matches[1];
        
        // Step 2: Load lesson using lesson::load() factory method
        // This method throws moodle_exception if lesson doesn't exist
        try {
            $lesson = lesson::load($lessonid);
        } catch (moodle_exception $e) {
            throw new NotFoundException('Lesson not found: ' . $e->getMessage());
        }
        
        // Step 3: Get course module information for context and capability checks
        $cm = get_coursemodule_from_instance('lesson', $lessonid, 0, false, MUST_EXIST);
        if (!$cm) {
            throw new NotFoundException('Course module not found for lesson');
        }
        
        // Get course record for lesson context
        $course = $DB->get_record('course', array('id' => $cm->course), '*', MUST_EXIST);
        if (!$course) {
            throw new NotFoundException('Course not found for lesson');
        }
        
        // Reconstruct lesson object with full course module and course context
        // This ensures all lesson methods have proper context information
        $lessonrecord = $DB->get_record('lesson', array('id' => $lessonid), '*', MUST_EXIST);
        $lesson = new lesson($lessonrecord, $cm, $course);
        
        // Step 4: Check capability - user must have mod/lesson:view permission
        // Uses context_module for proper capability checking in lesson context
        $context = context_module::instance($cm->id);
        $this->checkCapability('mod/lesson:view', $context);
        
        // Step 5: Apply user-specific overrides for deadlines and availability
        // This updates lesson properties based on user/group overrides
        $user = $this->getUser();
        if ($user && $user->id) {
            $lesson->update_effective_access($user->id);
        }
        
        // Step 6: Check access restrictions
        
        // Check time restrictions (available and deadline dates)
        $timerestriction = $lesson->get_time_restriction_status();
        $isavailable = true;
        $availabilitymessage = null;
        
        if ($timerestriction) {
            $isavailable = false;
            // Time restriction status contains user-friendly message
            $availabilitymessage = $timerestriction;
        }
        
        // Check password protection status
        $passwordrequired = false;
        if ($lesson->usepassword) {
            $passwordrequired = true;
            // Note: Actual password validation happens when user attempts to start lesson
            // This endpoint only reports if password is required
        }
        
        // Check dependency restrictions (completion of prerequisite lessons)
        $dependencystatus = $lesson->get_dependencies_restriction_status();
        $dependenciesmet = true;
        $dependencymessage = null;
        
        if ($dependencystatus) {
            $dependenciesmet = false;
            // Dependency status contains description of unmet requirements
            $dependencymessage = $dependencystatus;
        }
        
        // Step 7: Calculate user progress if user is authenticated
        $progress = null;
        $completed = false;
        
        if ($user && $user->id) {
            // calculate_progress() returns percentage (0-100) of pages viewed
            $progress = $lesson->calculate_progress();
            
            // Check if user has completed the lesson
            // Completion is tracked in lesson_timer table
            $timer = $DB->get_record('lesson_timer', array(
                'lessonid' => $lessonid,
                'userid' => $user->id,
                'completed' => 1
            ));
            $completed = ($timer !== false);
        }
        
        // Step 8: Get lesson pages information
        $firstpageid = $lesson->firstpageid;
        
        // Load all pages to get count
        $pages = $lesson->load_all_pages();
        $pagescount = count($pages);
        
        // Step 9: Build comprehensive response with lesson properties
        $responseData = array(
            // Core identification
            'id' => (int) $lesson->id,
            'course' => (int) $lesson->course,
            'coursemoduleid' => (int) $cm->id,
            
            // Basic information
            'name' => $lesson->name,
            'intro' => $lesson->intro,
            'introformat' => (int) $lesson->introformat,
            
            // Timing and availability
            'timecreated' => (int) $lessonrecord->timemodified, // Use timemodified as timecreated
            'timemodified' => (int) $lesson->timemodified,
            'available' => (int) $lesson->available,
            'deadline' => (int) $lesson->deadline,
            'isavailable' => $isavailable,
            'availabilitymessage' => $availabilitymessage,
            
            // Access restrictions
            'usepassword' => (bool) $lesson->usepassword,
            'passwordrequired' => $passwordrequired,
            'dependenciesmet' => $dependenciesmet,
            'dependencymessage' => $dependencymessage,
            
            // Lesson configuration
            'practice' => (bool) $lesson->practice,
            'modattempts' => (bool) $lesson->modattempts,
            'retake' => (bool) $lesson->retake,
            'feedback' => (bool) $lesson->feedback,
            'review' => (bool) $lesson->review,
            'nextpagedefault' => (int) $lesson->nextpagedefault,
            
            // Grading settings
            'grade' => (int) $lesson->grade,
            'custom' => (bool) $lesson->custom,
            'ongoing' => (bool) $lesson->ongoing,
            'usemaxgrade' => (bool) $lesson->usemaxgrade,
            
            // Attempt settings
            'maxanswers' => (int) $lesson->maxanswers,
            'maxattempts' => (int) $lesson->maxattempts,
            'maxpages' => (int) $lesson->maxpages,
            'minquestions' => (int) $lesson->minquestions,
            'timelimit' => (int) $lesson->timelimit,
            
            // Display settings
            'slideshow' => (bool) $lesson->slideshow,
            'width' => (int) $lesson->width,
            'height' => (int) $lesson->height,
            'bgcolor' => $lesson->bgcolor,
            'displayleft' => (bool) $lesson->displayleft,
            'displayleftif' => (int) $lesson->displayleftif,
            'progressbar' => (bool) $lesson->progressbar,
            
            // Media settings
            'mediafile' => $lesson->mediafile,
            'mediaheight' => (int) $lesson->mediaheight,
            'mediawidth' => (int) $lesson->mediawidth,
            'mediaclose' => (bool) $lesson->mediaclose,
            
            // Dependency and linking
            'dependency' => (int) $lesson->dependency,
            'conditions' => $lesson->conditions,
            'activitylink' => (int) $lesson->activitylink,
            
            // Completion settings
            'completionendreached' => (bool) $lessonrecord->completionendreached,
            'completiontimespent' => (int) $lessonrecord->completiontimespent,
            'allowofflineattempts' => (bool) $lessonrecord->allowofflineattempts,
            
            // Pages and progress
            'firstpageid' => (int) $firstpageid,
            'pagescount' => $pagescount,
            'progress' => $progress,
            'completed' => $completed
        );
        
        // Step 10: Return formatted success response using ApiBase helper
        $this->success($responseData);
    }
}

// Execute the endpoint
$endpoint = new LessonShowEndpoint();
$endpoint->execute();
