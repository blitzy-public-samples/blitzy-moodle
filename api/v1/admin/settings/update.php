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
 * REST API PUT endpoint for updating system settings configuration.
 *
 * Provides a secure interface for modifying Moodle system settings through the
 * REST API. Enforces moodle/site:config capability, validates settings against
 * the admin settings tree, and delegates all persistence to existing Moodle
 * set_config() infrastructure. Follows the thin wrapper pattern by wrapping
 * existing functionality without duplicating business logic.
 *
 * Endpoint: PUT /api/v1/admin/settings
 *
 * Request body (JSON):
 * {
 *   "name": "settingname",           // Required: Setting name (e.g., "sitename")
 *   "value": "New Value",            // Required: New setting value
 *   "plugin": "pluginname"           // Optional: Plugin context (null for core)
 * }
 *
 * Response (Success):
 * {
 *   "success": true,
 *   "data": {
 *     "updated": true,
 *     "count": 1,
 *     "setting": {
 *       "name": "sitename",
 *       "value": "New Value",
 *       "plugin": null
 *     }
 *   }
 * }
 *
 * Response (Error):
 * {
 *   "success": false,
 *   "error": {
 *     "code": "VALIDATION_ERROR",
 *     "message": "Invalid setting name: nonexistent",
 *     "details": { ... }
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
require_once($CFG->libdir . '/adminlib.php');
require_once($CFG->libdir . '/moodlelib.php');

// Load API infrastructure
require_once(__DIR__ . '/../../../lib/api_base.php');
require_once(__DIR__ . '/../../../lib/api_exception.php');

/**
 * Admin settings update endpoint class.
 *
 * Handles PUT requests to update system configuration settings. Enforces
 * moodle/site:config capability, validates settings using admin_get_root(),
 * and persists changes via set_config(). Automatically purges caches after
 * successful updates to ensure immediate effect across the system.
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class AdminSettingsUpdateEndpoint extends ApiBase {
    
    /**
     * Handle GET requests (not supported for this endpoint).
     *
     * This endpoint only supports PUT method for updating settings.
     * GET requests should be handled by a separate read-only settings endpoint.
     *
     * @return void
     * @throws MethodNotAllowedException Always, as GET is not supported
     */
    protected function handle_get() {
        throw new MethodNotAllowedException('GET method not supported for settings update', [
            'allowedMethods' => ['PUT'],
            'endpoint' => '/api/v1/admin/settings'
        ]);
    }
    
    /**
     * Handle POST requests (not supported for this endpoint).
     *
     * This endpoint only supports PUT method for updating settings.
     * POST is not used to maintain REST semantic correctness (PUT for updates).
     *
     * @return void
     * @throws MethodNotAllowedException Always, as POST is not supported
     */
    protected function handle_post() {
        throw new MethodNotAllowedException('POST method not supported for settings update', [
            'allowedMethods' => ['PUT'],
            'endpoint' => '/api/v1/admin/settings'
        ]);
    }
    
    /**
     * Handle PUT requests to update system settings.
     *
     * Main endpoint handler that:
     * 1. Enforces moodle/site:config capability in system context
     * 2. Extracts and validates JSON request body
     * 3. Validates setting exists and is writable using admin settings tree
     * 4. Persists changes via set_config() with logging
     * 5. Purges all caches to ensure immediate effect
     * 6. Returns success response with updated setting metadata
     *
     * Validation failures, permission denials, and errors are caught and
     * converted to appropriate ApiException subclasses for JSON error responses.
     *
     * @return void Outputs JSON response via success() method
     * @throws ForbiddenException If user lacks moodle/site:config capability
     * @throws ValidationException If request body is invalid or setting doesn't exist
     * @throws ServerException If database or cache operations fail
     */
    protected function handle_put() {
        global $CFG, $DB;
        
        // Enforce moodle/site:config capability in system context
        // This ensures only administrators can modify system configuration
        $this->checkCapability('moodle/site:config', context_system::instance());
        
        // Extract and validate JSON request body
        try {
            $data = $this->getJsonBody();
        } catch (ValidationException $e) {
            // Re-throw with more specific context
            throw new ValidationException('Invalid request body: ' . $e->getMessage(), [
                'expectedFormat' => [
                    'name' => 'string (required)',
                    'value' => 'mixed (required)',
                    'plugin' => 'string|null (optional)'
                ],
                'originalError' => $e->getDebugInfo()
            ]);
        }
        
        // Validate required 'name' field
        if (!isset($data['name']) || empty($data['name'])) {
            throw new ValidationException('Missing required field: name', [
                'field' => 'name',
                'reason' => 'Setting name must be provided',
                'received' => $data
            ]);
        }
        
        // Validate required 'value' field (can be empty string, but must be present)
        if (!array_key_exists('value', $data)) {
            throw new ValidationException('Missing required field: value', [
                'field' => 'value',
                'reason' => 'Setting value must be provided (can be empty)',
                'received' => $data
            ]);
        }
        
        $settingname = $data['name'];
        $settingvalue = $data['value'];
        $plugin = $data['plugin'] ?? null;
        
        // Validate setting name format (basic sanitization)
        if (!preg_match('/^[a-zA-Z0-9_]+$/', $settingname)) {
            throw new ValidationException('Invalid setting name format', [
                'field' => 'name',
                'value' => $settingname,
                'rule' => 'Must contain only alphanumeric characters and underscores',
                'pattern' => '/^[a-zA-Z0-9_]+$/'
            ]);
        }
        
        // Retrieve admin settings tree to validate setting exists
        try {
            $adminroot = admin_get_root();
        } catch (Exception $e) {
            throw new ServerException('Failed to load admin settings tree', [
                'originalError' => $e->getMessage(),
                'operation' => 'admin_get_root()'
            ]);
        }
        
        // Locate the setting in the admin tree
        // Settings are stored with 's_' prefix in form data, but we need raw name for lookup
        $settingfullname = 's_' . ($plugin ? $plugin . '_' : '') . $settingname;
        
        // Find all settings that match - use admin_find_write_settings pattern
        // This validates the setting exists and is writable
        $formdata = [$settingfullname => $settingvalue];
        
        try {
            $settings = admin_find_write_settings($adminroot, $formdata);
        } catch (Exception $e) {
            throw new ServerException('Failed to validate setting', [
                'originalError' => $e->getMessage(),
                'settingName' => $settingname,
                'plugin' => $plugin
            ]);
        }
        
        // Check if setting was found
        if (empty($settings) || !isset($settings[$settingfullname])) {
            throw new NotFoundException('Setting not found', [
                'settingName' => $settingname,
                'plugin' => $plugin,
                'fullName' => $settingfullname,
                'reason' => 'Setting does not exist in admin settings tree or is not writable'
            ]);
        }
        
        $setting = $settings[$settingfullname];
        
        // Verify setting access permissions
        // Some settings may be locked or restricted even if user has site:config
        if (!$setting->check_access()) {
            throw new ForbiddenException('Access denied to this setting', [
                'settingName' => $settingname,
                'plugin' => $plugin,
                'reason' => 'Setting is locked or restricted by administrator'
            ]);
        }
        
        // Validate setting value against type constraints
        $validationError = $this->validateSettingValue($setting, $settingvalue);
        if (!empty($validationError)) {
            throw new ValidationException($validationError, [
                'field' => 'value',
                'settingName' => $settingname,
                'value' => $settingvalue,
                'settingType' => get_class($setting)
            ]);
        }
        
        // Persist setting change using existing Moodle function
        // Use write_setting() method from admin_setting which handles validation and persistence
        try {
            // write_setting() returns empty string on success, error message on failure
            $writeresult = $setting->write_setting($settingvalue);
            
            if ($writeresult !== '') {
                // write_setting returned error message
                throw new ValidationException('Failed to save setting: ' . $writeresult, [
                    'settingName' => $settingname,
                    'value' => $settingvalue,
                    'errorMessage' => $writeresult
                ]);
            }
            
        } catch (Exception $e) {
            // Handle exceptions from write_setting()
            if ($e instanceof ValidationException) {
                throw $e; // Re-throw validation exceptions
            }
            
            throw new ServerException('Failed to persist setting change', [
                'settingName' => $settingname,
                'plugin' => $plugin,
                'value' => $settingvalue,
                'originalError' => $e->getMessage()
            ]);
        }
        
        // Purge all caches to ensure configuration changes take immediate effect
        // This is critical for consistency - cached values must be invalidated
        try {
            purge_all_caches();
        } catch (Exception $e) {
            // Log cache purge failure but don't fail the request
            // The setting was already saved successfully
            error_log('Warning: Failed to purge caches after settings update: ' . $e->getMessage());
        }
        
        // Return success response with updated setting metadata
        $this->success([
            'updated' => true,
            'count' => 1,
            'setting' => [
                'name' => $settingname,
                'value' => $settingvalue,
                'plugin' => $plugin
            ]
        ]);
    }
    
    /**
     * Handle DELETE requests (not supported for this endpoint).
     *
     * This endpoint only supports PUT method for updating settings.
     * Settings should not be deleted via API - use unset_config() through admin UI.
     *
     * @return void
     * @throws MethodNotAllowedException Always, as DELETE is not supported
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method not supported for settings update', [
            'allowedMethods' => ['PUT'],
            'endpoint' => '/api/v1/admin/settings'
        ]);
    }
    
    /**
     * Validate setting value against type constraints.
     *
     * Checks the setting value against the admin_setting object's validation rules
     * including parameter type (PARAM_*), min/max ranges for numbers, regex patterns
     * for text, and valid options for select settings. Delegates validation to the
     * setting object's validate() method when available.
     *
     * This is a helper method that provides pre-validation before calling write_setting()
     * to give more detailed error messages to API clients.
     *
     * @param admin_setting $setting Admin setting object from settings tree
     * @param mixed $value Value to validate
     * @return string Empty string if valid, error message if validation fails
     */
    protected function validateSettingValue($setting, $value) {
        // Check if setting has a validate() method and use it
        if (method_exists($setting, 'validate')) {
            $validationresult = $setting->validate($value);
            
            // validate() returns true on success, error string on failure
            if ($validationresult !== true) {
                return is_string($validationresult) ? $validationresult : 'Validation failed';
            }
        }
        
        // Additional type-specific validation based on setting class
        $settingclass = get_class($setting);
        
        // Validate boolean settings
        if (strpos($settingclass, 'admin_setting_configcheckbox') !== false) {
            if (!in_array($value, [0, 1, '0', '1', true, false, 'true', 'false'], true)) {
                return 'Value must be boolean (0, 1, true, or false)';
            }
        }
        
        // Validate integer settings
        if (strpos($settingclass, 'admin_setting_configtext') !== false && 
            property_exists($setting, 'paramtype') && 
            $setting->paramtype === PARAM_INT) {
            if (!is_numeric($value) || (string)(int)$value !== (string)$value) {
                return 'Value must be an integer';
            }
        }
        
        // Validate select/dropdown settings
        if (method_exists($setting, 'get_choices')) {
            $choices = $setting->get_choices();
            if (is_array($choices) && !array_key_exists($value, $choices)) {
                return 'Value must be one of: ' . implode(', ', array_keys($choices));
            }
        }
        
        // Validate text length constraints
        if (property_exists($setting, 'maxlength') && $setting->maxlength > 0) {
            if (strlen($value) > $setting->maxlength) {
                return "Value exceeds maximum length of {$setting->maxlength} characters";
            }
        }
        
        // All validation passed
        return '';
    }
}

// Instantiate and execute the endpoint
$endpoint = new AdminSettingsUpdateEndpoint();
$endpoint->execute();
