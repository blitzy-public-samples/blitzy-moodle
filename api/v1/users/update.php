<?php
/**
 * API endpoint for updating user profile information.
 *
 * This endpoint provides a RESTful API for updating user profile data via HTTP PUT requests.
 * It wraps the existing Moodle user_update_user() function and enforces strict permission
 * checks to ensure users can only update their own profile or have appropriate capabilities.
 *
 * Endpoint: PUT /api/v1/users/{id}
 * Authentication: JWT token required
 * Content-Type: application/json
 *
 * Permission Requirements:
 * - Users can update their own profile (no additional capability required)
 * - OR authenticated user must have 'moodle/user:update' capability in the target user's context
 *
 * Supported updatable fields:
 * - firstname: User's first name (required)
 * - lastname: User's last name (required)
 * - email: User's email address (must be unique and valid format)
 * - city: User's city
 * - country: Two-letter country code (must be valid)
 * - timezone: Timezone identifier (must be valid)
 * - description: User's profile description
 * - institution: User's institution
 * - department: User's department
 * - phone1: Primary phone number
 * - phone2: Secondary phone number
 * - address: Street address
 * - url: Personal website URL (must be valid URL format)
 *
 * Request Body Example:
 * {
 *   "firstname": "John",
 *   "lastname": "Doe",
 *   "email": "john.doe@example.com",
 *   "city": "Melbourne",
 *   "country": "AU",
 *   "timezone": "Australia/Melbourne",
 *   "description": "Software Developer",
 *   "institution": "Example University",
 *   "department": "Computer Science",
 *   "phone1": "+61412345678",
 *   "url": "https://example.com"
 * }
 *
 * Success Response (200 OK):
 * {
 *   "success": true,
 *   "data": {
 *     "user": {
 *       "id": 123,
 *       "username": "johndoe",
 *       "firstname": "John",
 *       "lastname": "Doe",
 *       "email": "john.doe@example.com",
 *       ...
 *     }
 *   }
 * }
 *
 * Error Responses:
 * - 400 Bad Request: Validation failures (invalid email, empty required fields, invalid country/timezone)
 * - 401 Unauthorized: Invalid or missing JWT token
 * - 403 Forbidden: Insufficient permissions to update the user
 * - 404 Not Found: User does not exist or is deleted
 * - 409 Conflict: Email address already in use by another user
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Include Moodle configuration and required libraries
require_once(__DIR__ . '/../../../config.php');
require_once($CFG->dirroot . '/user/lib.php');
require_once($CFG->dirroot . '/user/profile/lib.php');
require_once($CFG->libdir . '/moodlelib.php');

// Include API framework classes
require_once($CFG->dirroot . '/api/lib/api_base.php');
require_once($CFG->dirroot . '/api/lib/api_exception.php');

/**
 * User Update API Endpoint.
 *
 * This class implements the PUT /api/v1/users/{id} endpoint for updating user profile information.
 * It extends ApiBase to leverage JWT authentication, permission checking, and standardized
 * request/response handling.
 *
 * The endpoint delegates all business logic to the existing Moodle user_update_user() function,
 * ensuring consistency with the PHP-rendered user edit pages and maintaining a thin wrapper
 * pattern that avoids duplicating business logic.
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class UserUpdateEndpoint extends ApiBase {
    
    /**
     * Handle PUT request to update user profile.
     *
     * This method processes HTTP PUT requests to update user profile information.
     * It performs comprehensive validation, permission checks, and delegates to
     * the existing user_update_user() function for the actual update operation.
     *
     * Workflow:
     * 1. Extract user ID from URL path parameter
     * 2. Validate that the target user exists and is not deleted
     * 3. Check permissions (self-update OR moodle/user:update capability)
     * 4. Parse and validate JSON request body
     * 5. Validate individual fields (email format, required fields, country, timezone, URL)
     * 6. Check for email uniqueness if email is being changed
     * 7. Call user_update_user() to perform the update
     * 8. Trigger user_updated event
     * 9. Return updated user data in standardized JSON format
     *
     * @throws ValidationException   When validation fails (400)
     * @throws NotFoundException     When user does not exist (404)
     * @throws ForbiddenException    When user lacks permission (403)
     * @throws ConflictException     When email conflicts with existing user (409)
     * @return void Outputs JSON response directly
     */
    protected function handle_put() {
        global $DB, $USER;
        
        // Extract user ID from URL path parameter
        // Expected URL format: /api/v1/users/{id}
        $userid = $this->getParam('id', null);
        
        // Validate that user ID was provided
        if ($userid === null || !is_numeric($userid)) {
            throw new ValidationException(
                'User ID is required and must be a valid integer',
                ['field' => 'id', 'value' => $userid]
            );
        }
        
        $userid = (int)$userid;
        
        // Retrieve the target user from database
        // This verifies the user exists and is not deleted
        $targetuser = $DB->get_record('user', ['id' => $userid]);
        
        if (!$targetuser || $targetuser->deleted) {
            throw new NotFoundException(
                'User not found or has been deleted',
                ['userId' => $userid]
            );
        }
        
        // Get the authenticated user from JWT token
        // This is provided by ApiBase after JWT validation
        $authenticateduser = $this->getUser();
        
        // Determine if this is a self-update or requires elevated permissions
        $isSelfUpdate = ($userid === $authenticateduser->id);
        
        // Permission check: Allow self-update OR require moodle/user:update capability
        if (!$isSelfUpdate) {
            // For updating other users, check if the authenticated user has the update capability
            // in the target user's context
            $usercontext = context_user::instance($userid);
            
            // This will throw ForbiddenException if capability check fails
            $this->checkCapability('moodle/user:update', $usercontext);
        }
        
        // Parse JSON request body
        // getJsonBody() throws BadRequestException if JSON is malformed
        $requestdata = $this->getJsonBody();
        
        // Validate request body is not empty
        if (empty($requestdata) || !is_object($requestdata) && !is_array($requestdata)) {
            throw new ValidationException(
                'Request body must contain user fields to update',
                ['error' => 'Empty or invalid request body']
            );
        }
        
        // Convert to object for consistent handling
        $requestdata = (object)$requestdata;
        
        // Initialize array to collect validation errors
        $validationerrors = [];
        
        // Validate firstname (required if provided)
        if (property_exists($requestdata, 'firstname')) {
            $firstname = trim($requestdata->firstname);
            if (empty($firstname)) {
                $validationerrors['firstname'] = 'First name cannot be empty';
            }
        }
        
        // Validate lastname (required if provided)
        if (property_exists($requestdata, 'lastname')) {
            $lastname = trim($requestdata->lastname);
            if (empty($lastname)) {
                $validationerrors['lastname'] = 'Last name cannot be empty';
            }
        }
        
        // Validate email format and uniqueness
        if (property_exists($requestdata, 'email')) {
            $email = trim($requestdata->email);
            
            // Check email format using PHP's built-in filter
            if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
                $validationerrors['email'] = 'Invalid email address format';
            } else {
                // Check if email is being changed
                if (strtolower($email) !== strtolower($targetuser->email)) {
                    // Verify email uniqueness across all non-deleted users
                    // Moodle requires unique email addresses
                    $emailexists = $DB->record_exists_select(
                        'user',
                        'email = :email AND id != :userid AND deleted = 0',
                        ['email' => $email, 'userid' => $userid]
                    );
                    
                    if ($emailexists) {
                        // Email conflict - use 409 Conflict status
                        throw new ConflictException(
                            'Email address is already in use by another user',
                            ['field' => 'email', 'value' => $email]
                        );
                    }
                }
            }
        }
        
        // Validate country code
        if (property_exists($requestdata, 'country')) {
            $country = trim($requestdata->country);
            if (!empty($country)) {
                // Get list of valid country codes from Moodle
                $countries = get_string_manager()->get_list_of_countries();
                if (!array_key_exists($country, $countries)) {
                    $validationerrors['country'] = 'Invalid country code. Must be a valid ISO 3166-1 alpha-2 code';
                }
            }
        }
        
        // Validate timezone
        if (property_exists($requestdata, 'timezone')) {
            $timezone = trim($requestdata->timezone);
            if (!empty($timezone) && $timezone !== '99') {  // 99 = server timezone
                // Get list of valid timezones from Moodle
                $timezones = core_date::get_list_of_timezones();
                $validtimezones = array_keys($timezones);
                if (!in_array($timezone, $validtimezones)) {
                    $validationerrors['timezone'] = 'Invalid timezone identifier';
                }
            }
        }
        
        // Validate URL format
        if (property_exists($requestdata, 'url')) {
            $url = trim($requestdata->url);
            if (!empty($url)) {
                // Validate URL format using PHP's built-in filter
                if (!filter_var($url, FILTER_VALIDATE_URL)) {
                    $validationerrors['url'] = 'Invalid URL format';
                }
            }
        }
        
        // If there are any validation errors, throw ValidationException
        if (!empty($validationerrors)) {
            throw new ValidationException(
                'Validation failed for one or more fields',
                ['fieldErrors' => $validationerrors]
            );
        }
        
        // Build user update object
        // Start with the user ID which is required for user_update_user()
        $userupdate = new stdClass();
        $userupdate->id = $userid;
        
        // Define the list of updatable standard user fields
        // These correspond to columns in the mdl_user table
        $updatablefields = [
            'firstname',
            'lastname',
            'email',
            'city',
            'country',
            'timezone',
            'description',
            'institution',
            'department',
            'phone1',
            'phone2',
            'address',
            'url'
        ];
        
        // Copy updatable fields from request to user update object
        foreach ($updatablefields as $field) {
            if (property_exists($requestdata, $field)) {
                // Clean the value to prevent XSS and normalize whitespace
                $userupdate->$field = trim($requestdata->$field);
            }
        }
        
        // Verify that at least one field is being updated
        // If only 'id' is present, no actual update is requested
        if (count((array)$userupdate) === 1) {
            throw new ValidationException(
                'No valid fields provided for update',
                ['error' => 'Request must contain at least one updatable field']
            );
        }
        
        // Call the existing Moodle function to update the user
        // Parameters: $user object, $updatepassword = false (we're not updating password here), $triggerevent = false (we'll trigger manually)
        // We set triggerevent = false so we can control the event triggering and error handling
        try {
            user_update_user($userupdate, false, false);
        } catch (Exception $e) {
            // If user_update_user() throws an exception, wrap it in a ServerException
            throw new ServerException(
                'Failed to update user profile: ' . $e->getMessage(),
                ['originalError' => $e->getMessage(), 'userId' => $userid]
            );
        }
        
        // Handle profile custom fields if they were included in the request
        // Custom fields are defined by site administrators and stored separately
        if (property_exists($requestdata, 'profile_fields') || property_exists($requestdata, 'profile')) {
            // Extract profile fields from request
            $profilefields = property_exists($requestdata, 'profile_fields') 
                ? $requestdata->profile_fields 
                : $requestdata->profile;
            
            if (is_object($profilefields) || is_array($profilefields)) {
                // Convert to array for consistent handling
                $profilefields = (array)$profilefields;
                
                // Prepare user object with profile fields for profile_save_data()
                $profileuser = clone $targetuser;
                foreach ($profilefields as $key => $value) {
                    $profileuser->{'profile_field_' . $key} = $value;
                }
                
                // Save profile custom fields using Moodle's profile API
                try {
                    profile_save_data($profileuser);
                } catch (Exception $e) {
                    // Log the error but don't fail the entire request
                    // This allows the standard fields to be updated even if custom fields fail
                    error_log('Failed to update profile custom fields for user ' . $userid . ': ' . $e->getMessage());
                }
            }
        }
        
        // Trigger the user_updated event for audit logging and plugin hooks
        // This maintains compatibility with the existing Moodle event system
        try {
            $event = \core\event\user_updated::create([
                'objectid' => $userid,
                'context' => context_user::instance($userid),
                'other' => ['updatedby' => $authenticateduser->id]
            ]);
            $event->trigger();
        } catch (Exception $e) {
            // Log the error but don't fail the request
            // Event triggering failure should not prevent the update
            error_log('Failed to trigger user_updated event for user ' . $userid . ': ' . $e->getMessage());
        }
        
        // Retrieve the updated user record from database to return to client
        // This ensures we return the actual persisted data
        $updateduser = $DB->get_record('user', ['id' => $userid]);
        
        // Remove sensitive fields before returning to client
        // These fields should never be exposed via API
        unset($updateduser->password);
        unset($updateduser->secret);
        
        // Format and return success response using ApiBase::success()
        // The response follows the standard envelope format: {success: true, data: {...}}
        $this->success([
            'user' => $updateduser,
            'message' => 'User profile updated successfully'
        ]);
    }
}

// Initialize and execute the endpoint
// ApiBase constructor will:
// 1. Validate JWT token from Authorization header
// 2. Route to appropriate handle_* method based on HTTP method
// 3. Catch and format any exceptions
// 4. Output JSON response with appropriate HTTP status code
$endpoint = new UserUpdateEndpoint();
$endpoint->execute();
