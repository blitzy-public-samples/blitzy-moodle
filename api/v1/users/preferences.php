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
 * REST API endpoint for managing user preferences.
 *
 * Supports GET and PUT operations for retrieving and updating user preferences.
 * Users can only modify their own preferences unless they have system-level
 * administrative capabilities (moodle/site:config).
 *
 * Supported HTTP Methods:
 * - GET:  Retrieve all preferences for a user
 * - PUT:  Update one or more preferences for a user
 *
 * URL Pattern: /api/v1/users/{id}/preferences
 *
 * Authentication: Requires valid JWT token
 *
 * Permission Rules:
 * - Users can always view and modify their own preferences
 * - Admins with moodle/site:config can modify any user's preferences
 * - All other attempts result in 403 Forbidden
 *
 * Supported Preferences:
 * - lang: User interface language code
 * - timezone: User timezone (e.g., 'Australia/Perth', 'UTC')
 * - theme: User theme preference
 * - mailformat: Email format (0 = plain text, 1 = HTML)
 * - htmleditor: HTML editor preference
 * - maildisplay: Email display setting (0-2)
 * - autosubscribe: Auto-subscribe to forum posts (0 or 1)
 * - trackforums: Track unread forum posts (0 or 1)
 * - markasread: Mark forum posts as read (0 or 1)
 *
 * GET Response Example:
 * {
 *   "success": true,
 *   "data": {
 *     "preferences": {
 *       "lang": "en",
 *       "timezone": "99",
 *       "mailformat": "1",
 *       "htmleditor": "atto"
 *     }
 *   }
 * }
 *
 * PUT Request Body Example:
 * {
 *   "lang": "es",
 *   "timezone": "Australia/Perth",
 *   "mailformat": "1"
 * }
 *
 * PUT Response Example:
 * {
 *   "success": true,
 *   "data": {
 *     "updated": ["lang", "timezone", "mailformat"],
 *     "preferences": {
 *       "lang": "es",
 *       "timezone": "Australia/Perth",
 *       "mailformat": "1",
 *       "htmleditor": "atto"
 *     }
 *   }
 * }
 *
 * Error Response Example:
 * {
 *   "success": false,
 *   "error": {
 *     "code": "FORBIDDEN",
 *     "message": "You do not have permission to modify this user's preferences"
 *   }
 * }
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Load required libraries
require_once(__DIR__ . '/../../lib/api_base.php');
require_once(__DIR__ . '/../../lib/api_exception.php');

/**
 * User preferences API endpoint class.
 *
 * Handles retrieval and modification of user preferences via REST API.
 * Extends ApiBase to inherit JWT authentication, method routing, and
 * response formatting capabilities.
 */
class UserPreferencesEndpoint extends ApiBase {
    
    /**
     * Whitelist of allowed preference names that users can modify.
     *
     * This list restricts which preferences can be set via the API to prevent
     * users from modifying system-level or sensitive preferences. Only user-facing
     * preferences that are safe to modify are included.
     *
     * @var array List of allowed preference names
     */
    private const ALLOWED_PREFERENCES = [
        'lang',              // User interface language
        'timezone',          // User timezone
        'theme',             // User theme preference
        'mailformat',        // Email format (0=plain, 1=HTML)
        'htmleditor',        // HTML editor choice
        'maildisplay',       // Email display setting
        'autosubscribe',     // Auto-subscribe to forums
        'trackforums',       // Track unread forum posts
        'markasread',        // Mark forum posts as read automatically
        'maildigest',        // Mail digest type for forums
        'usecalendar',       // Use calendar preference
        'calendartype',      // Calendar type (gregorian, etc.)
    ];
    
    /**
     * Handle GET requests - retrieve user preferences.
     *
     * Retrieves all preferences for the specified user. Users can view their own
     * preferences, and admins with moodle/site:config can view any user's preferences.
     *
     * URL Parameters:
     * - id (int, required): User ID from URL path
     *
     * @return void Outputs JSON response via success() method
     * @throws NotFoundException If user does not exist or is deleted
     * @throws ForbiddenException If user lacks permission to view preferences
     */
    protected function handle_get() {
        global $DB;
        
        // Get the authenticated user
        $currentUser = $this->getUser();
        
        // Extract user ID from URL parameter
        $userid = $this->getParam('id', PARAM_INT);
        
        // Validate that the target user exists and is a real user
        $user = $DB->get_record('user', ['id' => $userid], '*', MUST_EXIST);
        
        if (!$user || $user->deleted) {
            throw new NotFoundException('User not found', [
                'userId' => $userid,
                'reason' => 'User does not exist or has been deleted'
            ]);
        }
        
        // Check if the current user is the target user
        $isOwnProfile = ($currentUser->id == $userid);
        
        // Check permissions: users can view their own preferences,
        // or admins with moodle/site:config can view any user's preferences
        if (!$isOwnProfile) {
            $systemContext = context_system::instance();
            if (!has_capability('moodle/site:config', $systemContext, $currentUser->id)) {
                throw new ForbiddenException(
                    'You do not have permission to view this user\'s preferences',
                    [
                        'userId' => $userid,
                        'currentUserId' => $currentUser->id,
                        'requiredCapability' => 'moodle/site:config'
                    ]
                );
            }
        }
        
        // Retrieve all user preferences using existing Moodle function
        // get_user_preferences(null, null, $userid) gets all preferences for the user
        $allPreferences = get_user_preferences(null, null, $userid);
        
        // Filter to only include allowed preferences for security
        // This prevents exposure of internal or system-level preferences
        $filteredPreferences = [];
        foreach ($allPreferences as $name => $value) {
            if (in_array($name, self::ALLOWED_PREFERENCES)) {
                $filteredPreferences[$name] = $value;
            }
        }
        
        // Return success response with preferences data
        $this->success([
            'preferences' => $filteredPreferences
        ]);
    }
    
    /**
     * Handle PUT requests - update user preferences.
     *
     * Updates one or more preferences for the specified user. Users can modify
     * their own preferences, and admins with moodle/site:config can modify any
     * user's preferences.
     *
     * URL Parameters:
     * - id (int, required): User ID from URL path
     *
     * Request Body (JSON):
     * - Object with preference name-value pairs
     * - Example: {"lang": "es", "timezone": "Australia/Perth"}
     *
     * Validation:
     * - Preference names must be in the ALLOWED_PREFERENCES whitelist
     * - Language codes are validated against available languages
     * - Timezone values are validated against valid timezones
     * - Email format must be 0 (plain) or 1 (HTML)
     *
     * @return void Outputs JSON response via success() method
     * @throws NotFoundException If user does not exist or is deleted
     * @throws ForbiddenException If user lacks permission to modify preferences
     * @throws ValidationException If preference names or values are invalid
     */
    protected function handle_put() {
        global $DB, $USER;
        
        // Get the authenticated user
        $currentUser = $this->getUser();
        
        // Extract user ID from URL parameter
        $userid = $this->getParam('id', PARAM_INT);
        
        // Validate that the target user exists and is a real user
        $user = $DB->get_record('user', ['id' => $userid], '*', MUST_EXIST);
        
        if (!$user || $user->deleted) {
            throw new NotFoundException('User not found', [
                'userId' => $userid,
                'reason' => 'User does not exist or has been deleted'
            ]);
        }
        
        // Check if the current user is the target user
        $isOwnProfile = ($currentUser->id == $userid);
        
        // Check permissions: users can modify their own preferences,
        // or admins with moodle/site:config can modify any user's preferences
        if (!$isOwnProfile) {
            $systemContext = context_system::instance();
            if (!has_capability('moodle/site:config', $systemContext, $currentUser->id)) {
                throw new ForbiddenException(
                    'You do not have permission to modify this user\'s preferences',
                    [
                        'userId' => $userid,
                        'currentUserId' => $currentUser->id,
                        'requiredCapability' => 'moodle/site:config'
                    ]
                );
            }
        }
        
        // Get JSON request body with preference updates
        $data = $this->getJsonBody();
        
        // Validate that data is provided
        if (empty($data) || !is_array($data)) {
            throw new ValidationException('Invalid request body', [
                'reason' => 'Request body must contain preference key-value pairs',
                'expected' => 'JSON object with preference names as keys'
            ]);
        }
        
        // Track which preferences were successfully updated
        $updatedPreferences = [];
        $validationErrors = [];
        
        // Process each preference in the request
        foreach ($data as $preferenceName => $preferenceValue) {
            // Validate preference name is in whitelist
            if (!in_array($preferenceName, self::ALLOWED_PREFERENCES)) {
                $validationErrors[] = [
                    'preference' => $preferenceName,
                    'reason' => 'Preference is not allowed to be modified via API',
                    'allowedPreferences' => self::ALLOWED_PREFERENCES
                ];
                continue;
            }
            
            // Validate and sanitize the preference value
            $validatedValue = $this->validatePreferenceValue($preferenceName, $preferenceValue);
            
            if ($validatedValue === false) {
                $validationErrors[] = [
                    'preference' => $preferenceName,
                    'value' => $preferenceValue,
                    'reason' => 'Invalid value for this preference'
                ];
                continue;
            }
            
            // Set the preference using existing Moodle function
            // set_user_preference($name, $value, $userid) is the core Moodle function
            set_user_preference($preferenceName, $validatedValue, $userid);
            
            $updatedPreferences[] = $preferenceName;
        }
        
        // If there were validation errors, throw exception
        if (!empty($validationErrors)) {
            throw new ValidationException('One or more preferences could not be updated', [
                'errors' => $validationErrors,
                'updated' => $updatedPreferences
            ]);
        }
        
        // Retrieve all current preferences after updates
        $allPreferences = get_user_preferences(null, null, $userid);
        
        // Filter to only include allowed preferences
        $filteredPreferences = [];
        foreach ($allPreferences as $name => $value) {
            if (in_array($name, self::ALLOWED_PREFERENCES)) {
                $filteredPreferences[$name] = $value;
            }
        }
        
        // Return success response with updated preferences
        $this->success([
            'updated' => $updatedPreferences,
            'preferences' => $filteredPreferences
        ]);
    }
    
    /**
     * Validate preference value based on preference type.
     *
     * Performs specific validation for each preference type to ensure values
     * are safe and valid before storing. Returns validated/sanitized value on
     * success, or false if validation fails.
     *
     * @param string $preferenceName  Name of the preference
     * @param mixed  $preferenceValue Value to validate
     * @return string|false Validated value, or false if invalid
     */
    private function validatePreferenceValue($preferenceName, $preferenceValue) {
        global $CFG;
        
        // Convert value to string for processing
        $value = (string)$preferenceValue;
        
        switch ($preferenceName) {
            case 'lang':
                // Validate language code exists
                $stringManager = get_string_manager();
                if (!$stringManager->translation_exists($value, false)) {
                    return false;
                }
                return clean_param($value, PARAM_LANG);
                
            case 'timezone':
                // Validate timezone value
                // '99' is valid (means use server timezone)
                if ($value === '99') {
                    return '99';
                }
                
                // Validate against PHP timezone list
                $timezones = core_date::get_list_of_timezones();
                if (!isset($timezones[$value])) {
                    return false;
                }
                return clean_param($value, PARAM_TIMEZONE);
                
            case 'theme':
                // Validate theme exists and is enabled
                $availableThemes = core_component::get_plugin_list('theme');
                if (!isset($availableThemes[$value])) {
                    return false;
                }
                return clean_param($value, PARAM_THEME);
                
            case 'mailformat':
                // Must be 0 (plain text) or 1 (HTML)
                $intValue = (int)$value;
                if ($intValue !== 0 && $intValue !== 1) {
                    return false;
                }
                return (string)$intValue;
                
            case 'htmleditor':
                // Validate editor preference
                // Common values: 'atto', 'textarea', 'tinymce'
                $editors = editors_get_enabled();
                $validEditors = array_keys($editors);
                if (!in_array($value, $validEditors) && $value !== '') {
                    return false;
                }
                return clean_param($value, PARAM_PLUGIN);
                
            case 'maildisplay':
                // Must be 0, 1, or 2
                $intValue = (int)$value;
                if ($intValue < 0 || $intValue > 2) {
                    return false;
                }
                return (string)$intValue;
                
            case 'autosubscribe':
            case 'trackforums':
            case 'markasread':
            case 'usecalendar':
                // Boolean preferences: must be 0 or 1
                $intValue = (int)$value;
                if ($intValue !== 0 && $intValue !== 1) {
                    return false;
                }
                return (string)$intValue;
                
            case 'maildigest':
                // Mail digest type: 0 (no digest), 1 (complete), 2 (subjects)
                $intValue = (int)$value;
                if ($intValue < 0 || $intValue > 2) {
                    return false;
                }
                return (string)$intValue;
                
            case 'calendartype':
                // Validate calendar type
                $calendartypes = \core_calendar\type_factory::get_list_of_calendar_types();
                if (!isset($calendartypes[$value])) {
                    return false;
                }
                return clean_param($value, PARAM_PLUGIN);
                
            default:
                // For any other preferences, use basic text sanitization
                return clean_param($value, PARAM_TEXT);
        }
    }
    
    /**
     * Handle POST requests - not supported.
     *
     * This endpoint does not support POST method. Use PUT to update preferences.
     *
     * @return void
     * @throws MethodNotAllowedException Always throws exception
     */
    protected function handle_post() {
        throw new MethodNotAllowedException('POST method is not supported for user preferences', [
            'supportedMethods' => ['GET', 'PUT'],
            'message' => 'Use PUT to update user preferences'
        ]);
    }
    
    /**
     * Handle DELETE requests - not supported.
     *
     * This endpoint does not support DELETE method. Preferences cannot be deleted,
     * only reset to default values via PUT.
     *
     * @return void
     * @throws MethodNotAllowedException Always throws exception
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method is not supported for user preferences', [
            'supportedMethods' => ['GET', 'PUT'],
            'message' => 'Preferences cannot be deleted, only updated to default values'
        ]);
    }
}

// Instantiate and execute the endpoint
$endpoint = new UserPreferencesEndpoint();
$endpoint->execute();
