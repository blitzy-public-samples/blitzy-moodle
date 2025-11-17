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
 * REST API endpoint for configuring Moodle plugins.
 *
 * Provides functionality to enable/disable plugins and update their configuration
 * settings through the REST API. This endpoint is critical for plugin lifecycle
 * management in the React admin interface.
 *
 * Supported operations:
 * - Enable/disable plugins via plugin manager
 * - Update plugin-specific configuration settings
 * - Validate plugin existence and capabilities
 * - Return updated plugin status and metadata
 *
 * All operations require moodle/site:config capability (site administrator).
 *
 * Example PUT request to enable a plugin:
 * <code>
 * PUT /api/v1/admin/plugins/configure
 * Content-Type: application/json
 * Authorization: Bearer <jwt_token>
 * 
 * {
 *   "component": "mod_forum",
 *   "action": "enable"
 * }
 * </code>
 *
 * Example PUT request to configure plugin settings:
 * <code>
 * PUT /api/v1/admin/plugins/configure
 * Content-Type: application/json
 * Authorization: Bearer <jwt_token>
 * 
 * {
 *   "component": "mod_forum",
 *   "action": "configure",
 *   "settings": {
 *     "maxbytes": "2097152",
 *     "maxattachments": "9"
 *   }
 * }
 * </code>
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Load Moodle configuration and required libraries
require_once(__DIR__ . '/../../../../config.php');
require_once($CFG->libdir . '/adminlib.php');
require_once($CFG->libdir . '/accesslib.php');

// Load API utilities
require_once(__DIR__ . '/../../../lib/api_base.php');
require_once(__DIR__ . '/../../../lib/api_exception.php');

/**
 * Plugin configuration API endpoint class.
 *
 * Handles PUT requests for plugin enable/disable operations and
 * configuration updates. Enforces system-level permissions and
 * validates all plugin operations before execution.
 */
class PluginConfigureEndpoint extends ApiBase {
    
    /**
     * Handle GET requests - not supported.
     *
     * This endpoint only supports PUT operations for plugin configuration.
     *
     * @throws MethodNotAllowedException Always, as GET is not supported
     */
    protected function handle_get() {
        throw new MethodNotAllowedException('GET method is not supported for plugin configuration', [
            'allowedMethods' => ['PUT']
        ]);
    }
    
    /**
     * Handle POST requests - not supported.
     *
     * This endpoint only supports PUT operations for plugin configuration.
     *
     * @throws MethodNotAllowedException Always, as POST is not supported
     */
    protected function handle_post() {
        throw new MethodNotAllowedException('POST method is not supported for plugin configuration', [
            'allowedMethods' => ['PUT']
        ]);
    }
    
    /**
     * Handle PUT requests for plugin configuration.
     *
     * Processes plugin enable/disable operations and configuration updates.
     * Validates user permissions, plugin existence, and setting values before
     * applying changes.
     *
     * Expected request body format:
     * {
     *   "component": "mod_forum",           // Plugin component name (required)
     *   "action": "enable|disable|configure", // Action to perform (required)
     *   "settings": {                       // Settings object (required for 'configure' action)
     *     "key1": "value1",
     *     "key2": "value2"
     *   }
     * }
     *
     * @return void Outputs JSON response directly
     * @throws ValidationException If required fields are missing or invalid
     * @throws ForbiddenException If user lacks moodle/site:config capability
     * @throws NotFoundException If plugin component does not exist
     * @throws BadRequestException If action is not supported for plugin type
     */
    protected function handle_put() {
        global $CFG;
        
        // Check system-level configuration capability
        $systemcontext = context_system::instance();
        $this->checkCapability('moodle/site:config', $systemcontext);
        
        // Parse JSON request body
        $data = $this->getJsonBody();
        
        // Validate required fields
        if (!isset($data['component']) || empty($data['component'])) {
            throw new ValidationException('Missing required field: component', [
                'field' => 'component',
                'reason' => 'Plugin component name is required (e.g., "mod_forum", "auth_ldap")'
            ]);
        }
        
        if (!isset($data['action']) || empty($data['action'])) {
            throw new ValidationException('Missing required field: action', [
                'field' => 'action',
                'reason' => 'Action must be one of: enable, disable, configure'
            ]);
        }
        
        $component = clean_param($data['component'], PARAM_COMPONENT);
        $action = clean_param($data['action'], PARAM_ALPHA);
        
        // Validate action type
        $validActions = ['enable', 'disable', 'configure'];
        if (!in_array($action, $validActions)) {
            throw new ValidationException('Invalid action specified', [
                'action' => $action,
                'validActions' => $validActions,
                'reason' => 'Action must be one of: enable, disable, configure'
            ]);
        }
        
        // Get plugin manager instance
        $pluginman = core_plugin_manager::instance();
        
        // Get plugin information
        $plugininfo = $pluginman->get_plugin_info($component);
        
        // Validate plugin exists
        if (is_null($plugininfo)) {
            throw new NotFoundException('Plugin not found', [
                'component' => $component,
                'reason' => 'The specified plugin component does not exist in this Moodle installation'
            ]);
        }
        
        // Process action based on type
        switch ($action) {
            case 'enable':
                $this->handleEnableAction($plugininfo, $component, true);
                break;
                
            case 'disable':
                $this->handleEnableAction($plugininfo, $component, false);
                break;
                
            case 'configure':
                $this->handleConfigureAction($plugininfo, $component, $data);
                break;
        }
        
        // Reload plugin info after changes to get updated status
        $pluginman = core_plugin_manager::instance();
        $plugininfo = $pluginman->get_plugin_info($component);
        
        // Prepare response data with updated plugin metadata
        $responseData = [
            'component' => $component,
            'displayname' => $plugininfo->displayname,
            'type' => $plugininfo->type,
            'name' => $plugininfo->name,
            'source' => $plugininfo->source,
            'versiondisk' => $plugininfo->versiondisk,
            'versiondb' => $plugininfo->versiondb,
            'release' => $plugininfo->release,
            'action' => $action,
            'success' => true
        ];
        
        // Add enabled status for enable/disable actions
        if ($action === 'enable' || $action === 'disable') {
            $responseData['enabled'] = $this->isPluginEnabled($plugininfo, $component);
        }
        
        // Add settings confirmation for configure action
        if ($action === 'configure' && isset($data['settings'])) {
            $responseData['appliedSettings'] = array_keys($data['settings']);
        }
        
        // Return success response
        $this->success($responseData, 200, [
            'message' => "Plugin {$action} operation completed successfully"
        ]);
    }
    
    /**
     * Handle DELETE requests - not supported.
     *
     * This endpoint only supports PUT operations for plugin configuration.
     * Plugin deletion should be handled through separate uninstall endpoints.
     *
     * @throws MethodNotAllowedException Always, as DELETE is not supported
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method is not supported for plugin configuration', [
            'allowedMethods' => ['PUT'],
            'reason' => 'Use the plugin uninstall endpoint for plugin removal'
        ]);
    }
    
    /**
     * Handle enable/disable plugin action.
     *
     * Validates that the plugin type supports enabling/disabling, then
     * calls the appropriate enable_plugin method to toggle plugin state.
     * Uses existing Moodle plugin manager functions.
     *
     * @param object $plugininfo Plugin information object from plugin manager
     * @param string $component  Plugin component name
     * @param bool   $enable     True to enable, false to disable
     * @return void
     * @throws BadRequestException If plugin type does not support enabling/disabling
     */
    private function handleEnableAction($plugininfo, $component, $enable) {
        // Get plugin type class name
        $plugintype = $plugininfo->type;
        $pluginname = $plugininfo->name;
        
        // Build the plugininfo class name
        $classname = '\\core\\plugininfo\\' . $plugintype;
        
        // Check if class exists
        if (!class_exists($classname)) {
            throw new BadRequestException('Plugin type does not support enable/disable operations', [
                'component' => $component,
                'type' => $plugintype,
                'reason' => 'This plugin type cannot be enabled or disabled'
            ]);
        }
        
        // Check if plugin type supports disabling using static method
        if (!$classname::plugintype_supports_disabling()) {
            throw new BadRequestException('Plugin type does not support enable/disable operations', [
                'component' => $component,
                'type' => $plugintype,
                'reason' => 'This plugin type cannot be enabled or disabled'
            ]);
        }
        
        // Call the enable_plugin method on the plugin type class
        // This is the existing Moodle function for toggling plugin state
        $enabledvalue = $enable ? 1 : 0;
        
        try {
            // Use the plugin manager's method to enable/disable
            if (method_exists($classname, 'enable_plugin')) {
                $classname::enable_plugin($pluginname, $enabledvalue);
            } else {
                throw new BadRequestException('Plugin type does not implement enable_plugin method', [
                    'component' => $component,
                    'type' => $plugintype,
                    'reason' => 'Cannot enable or disable this plugin type'
                ]);
            }
            
        } catch (Exception $e) {
            throw new ServerException('Failed to change plugin state', [
                'component' => $component,
                'action' => $enable ? 'enable' : 'disable',
                'error' => $e->getMessage()
            ]);
        }
    }
    
    /**
     * Handle configure plugin action.
     *
     * Updates plugin-specific configuration settings using Moodle's
     * set_config function. Validates that settings are provided and
     * iterates through each setting to apply changes.
     *
     * @param object $plugininfo Plugin information object from plugin manager
     * @param string $component  Plugin component name
     * @param array  $data       Request data containing settings array
     * @return void
     * @throws ValidationException If settings array is missing or invalid
     */
    private function handleConfigureAction($plugininfo, $component, $data) {
        // Validate settings array exists
        if (!isset($data['settings']) || !is_array($data['settings'])) {
            throw new ValidationException('Missing or invalid settings for configure action', [
                'field' => 'settings',
                'reason' => 'Settings must be provided as an object/array for configure action'
            ]);
        }
        
        $settings = $data['settings'];
        
        // Validate settings array is not empty
        if (empty($settings)) {
            throw new ValidationException('Settings array cannot be empty', [
                'field' => 'settings',
                'reason' => 'At least one setting must be provided for configure action'
            ]);
        }
        
        // Iterate through settings and apply each one
        $appliedSettings = [];
        $failedSettings = [];
        
        foreach ($settings as $key => $value) {
            // Clean the setting key
            $cleanKey = clean_param($key, PARAM_ALPHANUMEXT);
            
            if (empty($cleanKey)) {
                $failedSettings[$key] = 'Invalid setting name';
                continue;
            }
            
            try {
                // Use Moodle's set_config function to store the setting
                // This is the existing Moodle function for configuration management
                set_config($cleanKey, $value, $component);
                $appliedSettings[$cleanKey] = $value;
                
            } catch (Exception $e) {
                $failedSettings[$cleanKey] = $e->getMessage();
            }
        }
        
        // If any settings failed to apply, throw validation exception
        if (!empty($failedSettings)) {
            throw new ValidationException('Some settings failed to apply', [
                'failedSettings' => $failedSettings,
                'appliedSettings' => array_keys($appliedSettings),
                'reason' => 'Check individual setting errors for details'
            ]);
        }
    }
    
    /**
     * Check if plugin is currently enabled.
     *
     * Determines plugin enabled state by checking plugin-specific configuration
     * using get_config. Different plugin types may have different ways of storing
     * enabled state.
     *
     * @param object $plugininfo Plugin information object from plugin manager
     * @param string $component  Plugin component name
     * @return bool True if plugin is enabled, false otherwise
     */
    private function isPluginEnabled($plugininfo, $component) {
        // Get plugin type
        $plugintype = $plugininfo->type;
        $pluginname = $plugininfo->name;
        
        // Build the plugininfo class name
        $classname = '\\core\\plugininfo\\' . $plugintype;
        
        // Check if plugin type supports disabling
        if (!class_exists($classname) || !$classname::plugintype_supports_disabling()) {
            // If plugin type doesn't support disabling, it's always enabled
            return true;
        }
        
        // Check if there's a method to check enabled state
        if (method_exists($classname, 'is_enabled')) {
            return $classname::is_enabled($pluginname);
        }
        
        // Fallback: check disabled config value
        // Most plugins store disabled state as disabled_<pluginname> = 1
        $disabledconfig = get_config($plugintype, 'disabled_' . $pluginname);
        
        // Plugin is enabled if disabled config is not set or is 0
        return empty($disabledconfig);
    }
}

// Instantiate and execute the endpoint
$endpoint = new PluginConfigureEndpoint();
$endpoint->execute();
