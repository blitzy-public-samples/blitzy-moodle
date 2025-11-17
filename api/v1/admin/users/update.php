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
 * REST API endpoint for updating existing Moodle user profiles.
 *
 * Handles PUT /api/v1/admin/users/{id} requests to update user profile information
 * including personal details, status (suspended/active), and password. Enforces
 * admin-level permissions and protects administrator accounts from unauthorized
 * modification.
 *
 * Key Features:
 * - Validates moodle/user:update capability at system context
 * - Updates user profiles via existing user_update_user() function
 * - Handles suspend/unsuspend operations
 * - Validates email uniqueness across all users
 * - Enforces password policy compliance
 * - Prevents non-admin users from modifying administrator accounts
 * - Returns comprehensive error messages for validation failures
 *
 * Request Format:
 * PUT /api/v1/admin/users/123
 * Content-Type: application/json
 * Authorization: Bearer <jwt_token>
 *
 * {
 *   "firstname": "John",
 *   "lastname": "Doe",
 *   "email": "john.doe@example.com",
 *   "suspended": 0,
 *   "city": "Melbourne",
 *   "country": "AU",
 *   "password": "NewSecurePass123!"
 * }
 *
 * Response Format:
 * {
 *   "success": true,
 *   "data": {
 *     "id": 123,
 *     "username": "johndoe",
 *     "firstname": "John",
 *     "lastname": "Doe",
 *     "email": "john.doe@example.com",
 *     "suspended": 0,
 *     "timemodified": 1703001234
 *   }
 * }
 *
 * Error Responses:
 * - 400 Bad Request: Validation errors (invalid email, weak password, etc.)
 * - 403 Forbidden: Permission denied or attempting to modify admin user
 * - 404 Not Found: User ID does not exist or user is deleted
 * - 401 Unauthorized: Invalid or missing JWT token
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Load Moodle configuration and libraries
require_once(__DIR__ . '/../../../../config.php');
require_once($CFG->dirroot . '/user/lib.php');
require_once($CFG->libdir . '/moodlelib.php');
require_once($CFG->libdir . '/accesslib.php');

// Load API base class and exceptions
require_once(__DIR__ . '/../../../lib/api_base.php');
require_once(__DIR__ . '/../../../lib/api_exception.php');

/**
 * API endpoint class for user update operations.
 *
 * Extends ApiBase to inherit JWT authentication, HTTP method routing,
 * capability checking, and response formatting. Implements handle_put()
 * to process user update requests with comprehensive validation.
 */
class UserUpdateEndpoint extends ApiBase {
    
    /**
     * Handle GET requests - not supported for this endpoint.
     *
     * @throws MethodNotAllowedException Always, as GET is not supported
     */
    protected function handle_get() {
        throw new MethodNotAllowedException('GET method not supported for user update endpoint', [
            'supportedMethods' => ['PUT'],
            'endpoint' => '/api/v1/admin/users/{id}'
        ]);
    }
    
    /**
     * Handle POST requests - not supported for this endpoint.
     *
     * @throws MethodNotAllowedException Always, as POST is not supported
     */
    protected function handle_post() {
        throw new MethodNotAllowedException('POST method not supported for user update endpoint', [
            'supportedMethods' => ['PUT'],
            'endpoint' => '/api/v1/admin/users/{id}'
        ]);
    }
    
    /**
     * Handle DELETE requests - not supported for this endpoint.
     *
     * @throws MethodNotAllowedException Always, as DELETE is not supported
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method not supported for user update endpoint', [
            'supportedMethods' => ['PUT'],
            'endpoint' => '/api/v1/admin/users/{id}',
            'note' => 'Use DELETE /api/v1/admin/users/delete.php endpoint for user deletion'
        ]);
    }
    
    /**
     * Handle PUT requests to update user profile information.
     *
     * Main handler for user update operations. Performs comprehensive validation,
     * authorization checks, and delegates actual update logic to existing Moodle
     * user_update_user() function. Follows thin wrapper pattern with zero business
     * logic duplication.
     *
     * Process Flow:
     * 1. Extract user ID from request URI (/admin/users/{id})
     * 2. Enforce moodle/user:update capability at system context
     * 3. Validate user exists and is not deleted
     * 4. Protect admin users from modification by non-admin users
     * 5. Parse and validate JSON request body
     * 6. Validate updatable fields with appropriate PARAM_* types
     * 7. Check email uniqueness if email is being changed
     * 8. Validate password against password policy if provided
     * 9. Call user_update_user() to perform actual update
     * 10. Retrieve and return updated user data
     *
     * @return void Sends JSON response via success() method
     * @throws NotFoundException If user ID is invalid or user is deleted
     * @throws ForbiddenException If permission check fails or attempting to modify admin
     * @throws ValidationException If request data fails validation
     */
    protected function handle_put() {
        global $DB, $CFG;
        
        // Step 1: Extract user ID from request URI using regex pattern
        // Expected pattern: /api/v1/admin/users/{id} where {id} is numeric
        $matches = [];
        if (!preg_match('/\/admin\/users\/(\d+)/', $this->requestUri, $matches)) {
            throw new ValidationException('Invalid request URI format', [
                'expected' => '/api/v1/admin/users/{id}',
                'received' => $this->requestUri,
                'reason' => 'User ID must be numeric and present in URI path'
            ]);
        }
        
        $userid = (int)$matches[1];
        
        // Step 2: Enforce moodle/user:update capability at system context
        // This ensures only users with appropriate permissions can update user accounts
        $systemcontext = context_system::instance();
        $this->checkCapability('moodle/user:update', $systemcontext);
        
        // Step 3: Validate user exists and is not deleted
        // Only retrieve users from local Moodle host (not remote MNet users)
        $existinguser = $DB->get_record('user', [
            'id' => $userid,
            'deleted' => 0,
            'mnethostid' => $CFG->mnet_localhost_id
        ]);
        
        if (!$existinguser) {
            throw new NotFoundException('User not found', [
                'userId' => $userid,
                'reason' => 'User does not exist, has been deleted, or is a remote MNet user'
            ]);
        }
        
        // Step 4: Protect admin users from modification by non-admin users
        // Site administrators can only be modified by other site administrators
        $currentuser = $this->getUser();
        if (is_siteadmin($userid) && !is_siteadmin($currentuser->id)) {
            throw new ForbiddenException('Cannot modify administrator user', [
                'userId' => $userid,
                'reason' => 'Administrator accounts can only be modified by other administrators',
                'requiredRole' => 'Site Administrator'
            ]);
        }
        
        // Step 5: Parse JSON request body to get fields to update
        $data = $this->getJsonBody();
        
        // Step 6: Build update object with validated fields
        // Only include fields that are present in the request and validate each field
        $updateuser = new stdClass();
        $updateuser->id = $userid;
        
        // Validate and set firstname (PARAM_TEXT)
        if (isset($data['firstname'])) {
            $firstname = clean_param($data['firstname'], PARAM_TEXT);
            if (empty(trim($firstname))) {
                throw new ValidationException('First name cannot be empty', [
                    'field' => 'firstname',
                    'value' => $data['firstname']
                ]);
            }
            $updateuser->firstname = $firstname;
        }
        
        // Validate and set lastname (PARAM_TEXT)
        if (isset($data['lastname'])) {
            $lastname = clean_param($data['lastname'], PARAM_TEXT);
            if (empty(trim($lastname))) {
                throw new ValidationException('Last name cannot be empty', [
                    'field' => 'lastname',
                    'value' => $data['lastname']
                ]);
            }
            $updateuser->lastname = $lastname;
        }
        
        // Validate and set email (PARAM_EMAIL with uniqueness check)
        if (isset($data['email'])) {
            $email = clean_param($data['email'], PARAM_EMAIL);
            
            // Validate email format
            if (empty($email) || !validate_email($email)) {
                throw new ValidationException('Invalid email address format', [
                    'field' => 'email',
                    'value' => $data['email'],
                    'reason' => 'Email must be a valid email address'
                ]);
            }
            
            // Check if email is being changed (different from current email)
            if (core_text::strtolower($email) !== core_text::strtolower($existinguser->email)) {
                // Step 7: Check email uniqueness (excluding current user)
                // Email addresses must be unique across all active users
                $emailexists = $DB->record_exists_sql(
                    'SELECT id FROM {user} WHERE email = ? AND id != ? AND deleted = 0 AND mnethostid = ?',
                    [core_text::strtolower($email), $userid, $CFG->mnet_localhost_id]
                );
                
                if ($emailexists) {
                    throw new ValidationException('Email address already in use by another user', [
                        'field' => 'email',
                        'value' => $email,
                        'reason' => 'Each user must have a unique email address'
                    ]);
                }
            }
            
            $updateuser->email = $email;
        }
        
        // Validate and set password (with password policy validation)
        if (isset($data['password']) && !empty($data['password'])) {
            $password = $data['password']; // Don't clean password - keep as-is for validation
            
            // Step 8: Validate password against Moodle password policy
            // Password must meet minimum length, complexity requirements, etc.
            $errmsg = '';
            if (!check_password_policy($password, $errmsg, $updateuser)) {
                throw new ValidationException('Password does not meet policy requirements', [
                    'field' => 'password',
                    'policyError' => $errmsg,
                    'reason' => 'Password must meet the site password policy'
                ]);
            }
            
            // Store password in update object (will be hashed by user_update_user)
            $updateuser->password = $password;
        }
        
        // Validate and set suspended status (0 or 1)
        if (isset($data['suspended'])) {
            $suspended = clean_param($data['suspended'], PARAM_INT);
            
            // Validate suspended is either 0 (active) or 1 (suspended)
            if ($suspended !== 0 && $suspended !== 1) {
                throw new ValidationException('Invalid suspended value', [
                    'field' => 'suspended',
                    'value' => $data['suspended'],
                    'allowed' => [0, 1],
                    'reason' => 'Suspended must be 0 (active) or 1 (suspended)'
                ]);
            }
            
            $updateuser->suspended = $suspended;
        }
        
        // Validate and set city (PARAM_TEXT)
        if (isset($data['city'])) {
            $updateuser->city = clean_param($data['city'], PARAM_TEXT);
        }
        
        // Validate and set country (PARAM_ALPHA - 2 letter country code)
        if (isset($data['country'])) {
            $country = clean_param($data['country'], PARAM_ALPHA);
            
            // Validate country code is 2 characters (ISO 3166-1 alpha-2)
            if (strlen($country) !== 2) {
                throw new ValidationException('Invalid country code', [
                    'field' => 'country',
                    'value' => $data['country'],
                    'reason' => 'Country must be a 2-letter ISO 3166-1 alpha-2 code (e.g., AU, US, GB)'
                ]);
            }
            
            $updateuser->country = strtoupper($country);
        }
        
        // Validate and set language (PARAM_SAFEDIR)
        if (isset($data['lang'])) {
            $lang = clean_param($data['lang'], PARAM_SAFEDIR);
            
            // Validate language code is installed
            $languages = get_string_manager()->get_list_of_translations();
            if (!empty($lang) && !array_key_exists($lang, $languages)) {
                throw new ValidationException('Invalid language code', [
                    'field' => 'lang',
                    'value' => $data['lang'],
                    'availableLanguages' => array_keys($languages),
                    'reason' => 'Language code must be one of the installed languages'
                ]);
            }
            
            $updateuser->lang = $lang;
        }
        
        // Validate and set timezone (PARAM_TIMEZONE)
        if (isset($data['timezone'])) {
            $timezone = clean_param($data['timezone'], PARAM_TIMEZONE);
            
            // Validate timezone is valid
            $timezones = core_date::get_list_of_timezones();
            if (!empty($timezone) && $timezone !== '99' && !array_key_exists($timezone, $timezones)) {
                throw new ValidationException('Invalid timezone', [
                    'field' => 'timezone',
                    'value' => $data['timezone'],
                    'reason' => 'Timezone must be a valid timezone identifier or "99" for server default'
                ]);
            }
            
            $updateuser->timezone = $timezone;
        }
        
        // Validate and set idnumber (PARAM_RAW)
        if (isset($data['idnumber'])) {
            $updateuser->idnumber = clean_param($data['idnumber'], PARAM_RAW);
        }
        
        // Validate and set institution (PARAM_TEXT)
        if (isset($data['institution'])) {
            $updateuser->institution = clean_param($data['institution'], PARAM_TEXT);
        }
        
        // Validate and set department (PARAM_TEXT)
        if (isset($data['department'])) {
            $updateuser->department = clean_param($data['department'], PARAM_TEXT);
        }
        
        // Validate and set phone1 (PARAM_RAW)
        if (isset($data['phone1'])) {
            $updateuser->phone1 = clean_param($data['phone1'], PARAM_RAW);
        }
        
        // Validate and set phone2 (PARAM_RAW)
        if (isset($data['phone2'])) {
            $updateuser->phone2 = clean_param($data['phone2'], PARAM_RAW);
        }
        
        // Validate and set address (PARAM_TEXT)
        if (isset($data['address'])) {
            $updateuser->address = clean_param($data['address'], PARAM_TEXT);
        }
        
        // Validate and set description (PARAM_RAW for HTML content)
        if (isset($data['description'])) {
            $updateuser->description = $data['description']; // Keep HTML as-is
        }
        
        // Step 9: Call existing Moodle user_update_user() function
        // This delegates all business logic to Moodle core:
        // - Password hashing via authentication plugin
        // - User data validation and cleaning
        // - Theme cache clearing if theme changed
        // - Event triggering (user_updated event)
        // - Hook dispatching for plugins
        // - Database update with timemodified timestamp
        try {
            user_update_user($updateuser, true, true);
            
        } catch (moodle_exception $e) {
            // Convert Moodle exceptions to API validation exceptions
            throw new ValidationException($e->getMessage(), [
                'errorcode' => $e->errorcode,
                'field' => $e->a ?? null,
                'reason' => 'User data validation failed in Moodle core'
            ]);
        }
        
        // Step 10: Retrieve updated user record to return to client
        $updateduser = $DB->get_record('user', ['id' => $userid], 
            'id, username, firstname, lastname, email, suspended, timemodified, city, country, lang, timezone, institution, department'
        );
        
        if (!$updateduser) {
            // This should never happen, but handle gracefully
            throw new ServerException('Failed to retrieve updated user data', [
                'userId' => $userid,
                'reason' => 'User was updated but could not be retrieved from database'
            ]);
        }
        
        // Format response data - exclude sensitive fields
        $responsedata = [
            'id' => (int)$updateduser->id,
            'username' => $updateduser->username,
            'firstname' => $updateduser->firstname,
            'lastname' => $updateduser->lastname,
            'email' => $updateduser->email,
            'suspended' => (int)$updateduser->suspended,
            'timemodified' => (int)$updateduser->timemodified,
            'city' => $updateduser->city ?? '',
            'country' => $updateduser->country ?? '',
            'lang' => $updateduser->lang ?? '',
            'timezone' => $updateduser->timezone ?? '',
            'institution' => $updateduser->institution ?? '',
            'department' => $updateduser->department ?? '',
        ];
        
        // Return success response with updated user data
        $this->success($responsedata, 200);
    }
}

// Instantiate and execute the endpoint
$endpoint = new UserUpdateEndpoint();
$endpoint->execute();
