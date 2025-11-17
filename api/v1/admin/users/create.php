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
 * REST API endpoint for creating new Moodle user accounts.
 *
 * Handles POST /api/v1/admin/users to create new users with comprehensive
 * validation. Enforces moodle/user:create capability at system context level.
 * 
 * Request format:
 * POST /api/v1/admin/users
 * Content-Type: application/json
 * Authorization: Bearer <jwt_token>
 * 
 * {
 *   "username": "jsmith",
 *   "password": "SecurePass123!",
 *   "firstname": "John",
 *   "lastname": "Smith",
 *   "email": "jsmith@example.com",
 *   "auth": "manual",
 *   "city": "Sydney",
 *   "country": "AU",
 *   "lang": "en",
 *   "timezone": "Australia/Sydney",
 *   "idnumber": "12345",
 *   "institution": "Example University",
 *   "department": "IT",
 *   "phone1": "+61 2 1234 5678",
 *   "phone2": "+61 400 123 456",
 *   "address": "123 Example St",
 *   "description": "User bio",
 *   "descriptionformat": 1
 * }
 * 
 * Response format (201 Created):
 * {
 *   "success": true,
 *   "data": {
 *     "id": 123,
 *     "username": "jsmith",
 *     "firstname": "John",
 *     "lastname": "Smith",
 *     "email": "jsmith@example.com",
 *     "auth": "manual",
 *     "suspended": 0,
 *     "confirmed": 1,
 *     "timecreated": 1704067200,
 *     "timemodified": 1704067200,
 *     "city": "Sydney",
 *     "country": "AU",
 *     "lang": "en",
 *     "timezone": "Australia/Sydney",
 *     "idnumber": "12345",
 *     "institution": "Example University",
 *     "department": "IT"
 *   }
 * }
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Load Moodle configuration and core libraries
require_once(__DIR__ . '/../../../../config.php');
require_once($CFG->libdir . '/moodlelib.php');
require_once($CFG->libdir . '/accesslib.php');
require_once($CFG->dirroot . '/user/lib.php');

// Load API base class and exception handlers
require_once(__DIR__ . '/../../../lib/api_base.php');
require_once(__DIR__ . '/../../../lib/api_exception.php');

/**
 * REST API endpoint class for user creation.
 *
 * Extends ApiBase to inherit JWT authentication, capability checking,
 * request validation, and response formatting. Implements handle_post()
 * to process user creation requests following the thin wrapper pattern.
 */
class UserCreateEndpoint extends ApiBase {
    
    /**
     * Handle POST request to create a new user.
     *
     * Validates all required fields, checks for duplicate username/email,
     * enforces password policy, and delegates user creation to the existing
     * user_create_user() function. Returns JSON response with created user
     * data including generated ID.
     *
     * Validation rules:
     * - username: Required, PARAM_USERNAME format, lowercase, unique
     * - password: Required, minimum length, passes password policy
     * - firstname: Required, PARAM_TEXT format, not empty
     * - lastname: Required, PARAM_TEXT format, not empty
     * - email: Required, PARAM_EMAIL format, valid email, unique
     * - auth: Optional, defaults to 'manual', PARAM_AUTH format
     * - All other fields: Optional, validated according to their PARAM_* type
     *
     * @return void Outputs JSON response directly via success() method
     * @throws ForbiddenException If user lacks moodle/user:create capability
     * @throws ValidationException If validation fails or duplicates exist
     * @throws ServerException If user creation fails unexpectedly
     */
    protected function handle_post() {
        global $DB, $CFG;
        
        // Enforce moodle/user:create capability at system context
        // This will throw ForbiddenException if user lacks permission
        $systemcontext = context_system::instance();
        $this->checkCapability('moodle/user:create', $systemcontext);
        
        // Extract and validate JSON request body
        // This will throw ValidationException if JSON is malformed or Content-Type is wrong
        $data = $this->getJsonBody();
        
        // Validate required field: username
        if (!isset($data['username']) || trim($data['username']) === '') {
            throw new ValidationException('Username is required', [
                'field' => 'username',
                'rule' => 'Username must be provided and cannot be empty'
            ]);
        }
        
        $username = trim($data['username']);
        
        // Validate username format - must be lowercase alphanumeric with allowed special chars
        $cleanedusername = clean_param($username, PARAM_USERNAME);
        if ($username !== $cleanedusername) {
            throw new ValidationException('Invalid username format', [
                'field' => 'username',
                'value' => $username,
                'rule' => 'Username must contain only lowercase letters, numbers, hyphens, underscores, periods, or @ symbol'
            ]);
        }
        
        // Ensure username is lowercase
        if ($username !== core_text::strtolower($username)) {
            throw new ValidationException('Username must be lowercase', [
                'field' => 'username',
                'value' => $username,
                'rule' => 'Username must be in lowercase letters only'
            ]);
        }
        
        // Check for duplicate username
        // Use mnethostid to ensure uniqueness within this Moodle instance
        if ($DB->record_exists('user', ['username' => $username, 'mnethostid' => $CFG->mnet_localhost_id])) {
            throw new ValidationException('Username already exists', [
                'field' => 'username',
                'value' => $username,
                'rule' => 'Username must be unique'
            ]);
        }
        
        // Validate required field: password
        if (!isset($data['password']) || trim($data['password']) === '') {
            throw new ValidationException('Password is required', [
                'field' => 'password',
                'rule' => 'Password must be provided and cannot be empty'
            ]);
        }
        
        $password = $data['password'];
        
        // Check password against password policy
        // This includes minimum length, complexity requirements, etc.
        $errmsg = '';
        if (!check_password_policy($password, $errmsg)) {
            throw new ValidationException('Password does not meet policy requirements', [
                'field' => 'password',
                'rule' => $errmsg,
                'reason' => 'Password must meet the configured password policy'
            ]);
        }
        
        // Validate required field: firstname
        if (!isset($data['firstname']) || trim($data['firstname']) === '') {
            throw new ValidationException('First name is required', [
                'field' => 'firstname',
                'rule' => 'First name must be provided and cannot be empty'
            ]);
        }
        
        $firstname = clean_param(trim($data['firstname']), PARAM_TEXT);
        if (empty($firstname)) {
            throw new ValidationException('First name cannot be empty after cleaning', [
                'field' => 'firstname',
                'rule' => 'First name must contain valid text characters'
            ]);
        }
        
        // Validate required field: lastname
        if (!isset($data['lastname']) || trim($data['lastname']) === '') {
            throw new ValidationException('Last name is required', [
                'field' => 'lastname',
                'rule' => 'Last name must be provided and cannot be empty'
            ]);
        }
        
        $lastname = clean_param(trim($data['lastname']), PARAM_TEXT);
        if (empty($lastname)) {
            throw new ValidationException('Last name cannot be empty after cleaning', [
                'field' => 'lastname',
                'rule' => 'Last name must contain valid text characters'
            ]);
        }
        
        // Validate required field: email
        if (!isset($data['email']) || trim($data['email']) === '') {
            throw new ValidationException('Email is required', [
                'field' => 'email',
                'rule' => 'Email address must be provided and cannot be empty'
            ]);
        }
        
        $email = trim($data['email']);
        
        // Validate email format
        $cleanedemail = clean_param($email, PARAM_EMAIL);
        if ($email !== $cleanedemail || !validate_email($email)) {
            throw new ValidationException('Invalid email address format', [
                'field' => 'email',
                'value' => $email,
                'rule' => 'Email must be a valid email address'
            ]);
        }
        
        // Check for duplicate email
        if ($DB->record_exists('user', ['email' => $email])) {
            throw new ValidationException('Email address already exists', [
                'field' => 'email',
                'value' => $email,
                'rule' => 'Email address must be unique'
            ]);
        }
        
        // Build user object with required fields
        $user = new stdClass();
        $user->username = $username;
        $user->password = $password;
        $user->firstname = $firstname;
        $user->lastname = $lastname;
        $user->email = $email;
        
        // Set authentication method (default to 'manual' if not provided)
        $user->auth = isset($data['auth']) ? clean_param($data['auth'], PARAM_AUTH) : 'manual';
        
        // Validate auth method exists
        $authmethods = core_component::get_plugin_list('auth');
        if (!array_key_exists($user->auth, $authmethods)) {
            throw new ValidationException('Invalid authentication method', [
                'field' => 'auth',
                'value' => $user->auth,
                'rule' => 'Authentication method must be one of: ' . implode(', ', array_keys($authmethods))
            ]);
        }
        
        // Add optional fields with validation
        if (isset($data['city'])) {
            $user->city = clean_param($data['city'], PARAM_TEXT);
        }
        
        if (isset($data['country'])) {
            // Validate country code (must be 2-letter ISO 3166-1 alpha-2 code)
            $country = clean_param($data['country'], PARAM_ALPHA);
            if (strlen($country) === 2) {
                $user->country = strtoupper($country);
            } else {
                throw new ValidationException('Invalid country code', [
                    'field' => 'country',
                    'value' => $data['country'],
                    'rule' => 'Country must be a 2-letter ISO 3166-1 alpha-2 code (e.g., AU, US, GB)'
                ]);
            }
        }
        
        if (isset($data['lang'])) {
            // Validate language code exists
            $lang = clean_param($data['lang'], PARAM_LANG);
            $languages = get_string_manager()->get_list_of_translations();
            if (array_key_exists($lang, $languages)) {
                $user->lang = $lang;
            } else {
                throw new ValidationException('Invalid language code', [
                    'field' => 'lang',
                    'value' => $data['lang'],
                    'rule' => 'Language must be one of the installed languages'
                ]);
            }
        }
        
        if (isset($data['timezone'])) {
            // Validate timezone
            $timezone = clean_param($data['timezone'], PARAM_TIMEZONE);
            $user->timezone = $timezone;
        }
        
        if (isset($data['idnumber'])) {
            $user->idnumber = clean_param($data['idnumber'], PARAM_RAW);
        }
        
        if (isset($data['institution'])) {
            $user->institution = clean_param($data['institution'], PARAM_TEXT);
        }
        
        if (isset($data['department'])) {
            $user->department = clean_param($data['department'], PARAM_TEXT);
        }
        
        if (isset($data['phone1'])) {
            $user->phone1 = clean_param($data['phone1'], PARAM_NOTAGS);
        }
        
        if (isset($data['phone2'])) {
            $user->phone2 = clean_param($data['phone2'], PARAM_NOTAGS);
        }
        
        if (isset($data['address'])) {
            $user->address = clean_param($data['address'], PARAM_TEXT);
        }
        
        if (isset($data['description'])) {
            $user->description = clean_param($data['description'], PARAM_CLEANHTML);
        }
        
        if (isset($data['descriptionformat'])) {
            $user->descriptionformat = clean_param($data['descriptionformat'], PARAM_INT);
        }
        
        // Set confirmed status (default to 1 for manual creation)
        $user->confirmed = isset($data['confirmed']) ? clean_param($data['confirmed'], PARAM_INT) : 1;
        
        // Set MNet host ID to local host
        $user->mnethostid = $CFG->mnet_localhost_id;
        
        // Create user via existing Moodle function
        // This handles password hashing, context creation, event triggering, and cache purging
        try {
            $userid = user_create_user($user, true, true);
            
        } catch (moodle_exception $e) {
            // Convert Moodle exceptions to API exceptions
            throw new ValidationException('User creation failed: ' . $e->getMessage(), [
                'errorcode' => $e->errorcode,
                'reason' => $e->getMessage(),
                'originalException' => get_class($e)
            ]);
            
        } catch (Exception $e) {
            // Handle unexpected exceptions
            throw new ServerException('Failed to create user', [
                'reason' => $e->getMessage(),
                'originalException' => get_class($e)
            ]);
        }
        
        // Retrieve created user record to return complete data
        $createduser = $DB->get_record('user', ['id' => $userid], '*', MUST_EXIST);
        
        // Format response data - remove sensitive fields
        $responsedata = [
            'id' => (int) $createduser->id,
            'username' => $createduser->username,
            'firstname' => $createduser->firstname,
            'lastname' => $createduser->lastname,
            'email' => $createduser->email,
            'auth' => $createduser->auth,
            'suspended' => (int) $createduser->suspended,
            'confirmed' => (int) $createduser->confirmed,
            'timecreated' => (int) $createduser->timecreated,
            'timemodified' => (int) $createduser->timemodified,
        ];
        
        // Include optional fields if they exist
        $optionalfields = [
            'city', 'country', 'lang', 'timezone', 'idnumber',
            'institution', 'department', 'phone1', 'phone2',
            'address', 'description', 'descriptionformat'
        ];
        
        foreach ($optionalfields as $field) {
            if (!empty($createduser->$field)) {
                $responsedata[$field] = $createduser->$field;
            }
        }
        
        // Set Location header for created resource
        $locationurl = $CFG->wwwroot . '/api/v1/admin/users/' . $userid;
        if (!headers_sent()) {
            header("Location: $locationurl");
        }
        
        // Return success response with 201 Created status
        $this->success($responsedata, 201);
    }
    
    /**
     * Handle GET request - not supported for user creation endpoint.
     *
     * @throws MethodNotAllowedException Always throws as GET is not supported
     */
    protected function handle_get() {
        throw new MethodNotAllowedException('GET method is not supported for user creation', [
            'allowedMethods' => ['POST']
        ]);
    }
    
    /**
     * Handle PUT request - not supported for user creation endpoint.
     *
     * @throws MethodNotAllowedException Always throws as PUT is not supported
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method is not supported for user creation', [
            'allowedMethods' => ['POST']
        ]);
    }
    
    /**
     * Handle DELETE request - not supported for user creation endpoint.
     *
     * @throws MethodNotAllowedException Always throws as DELETE is not supported
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method is not supported for user creation', [
            'allowedMethods' => ['POST']
        ]);
    }
}

// Instantiate and execute the endpoint
$endpoint = new UserCreateEndpoint();
$endpoint->execute();
