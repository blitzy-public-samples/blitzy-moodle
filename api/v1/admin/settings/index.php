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
 * REST API GET endpoint for retrieving system settings configuration.
 *
 * This endpoint provides access to Moodle administrative settings through a RESTful
 * JSON API. It extends ApiBase to leverage JWT authentication, capability checking,
 * and standardized response formatting.
 *
 * Features:
 * - JWT-based authentication via Authorization header
 * - Enforces moodle/site:config capability at system context level
 * - Retrieves complete admin settings tree via admin_get_root()
 * - Supports optional section parameter for filtered retrieval
 * - Extracts setting values using get_config() for each setting
 * - Returns comprehensive setting metadata (name, value, type, visibility, defaults, options)
 * - Follows thin wrapper pattern - delegates all business logic to existing Moodle functions
 * - Comprehensive error handling for unauthorized access, invalid sections, permission denials
 *
 * HTTP Method: GET
 * Route: /api/v1/admin/settings
 *
 * Query Parameters:
 * - section (optional): Admin section name to filter settings (e.g., 'frontpagesettings', 'optionalsubsystems')
 *
 * Response Format:
 * {
 *   "success": true,
 *   "data": {
 *     "settings": [
 *       {
 *         "name": "settingname",
 *         "value": "current value",
 *         "plugin": "core" or "pluginname",
 *         "type": "text|select|checkbox|...",
 *         "visiblename": "Human-readable name",
 *         "description": "Setting description",
 *         "defaultvalue": "default value",
 *         "options": {...} // For select/multiselect settings
 *       },
 *       ...
 *     ],
 *     "section": "sectionname" // If section parameter provided
 *   }
 * }
 *
 * Error Responses:
 * - 401 Unauthorized: No valid JWT token provided
 * - 403 Forbidden: User lacks moodle/site:config capability
 * - 404 Not Found: Specified section does not exist or is not a settings page
 * - 500 Internal Server Error: Unexpected error during settings retrieval
 *
 * Usage Example:
 * <code>
 * // Get all settings
 * GET /api/v1/admin/settings
 * Authorization: Bearer <jwt-token>
 *
 * // Get settings for specific section
 * GET /api/v1/admin/settings?section=frontpagesettings
 * Authorization: Bearer <jwt-token>
 * </code>
 *
 * @package    core
 * @subpackage api
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Load Moodle configuration and establish environment
require_once(__DIR__ . '/../../../../config.php');

// Load required Moodle libraries for admin settings access
require_once($CFG->libdir . '/adminlib.php');
require_once($CFG->libdir . '/moodlelib.php');

// Load API base class and exception handlers
require_once(__DIR__ . '/../../../lib/api_base.php');
require_once(__DIR__ . '/../../../lib/api_exception.php');

/**
 * Admin Settings Index Endpoint class.
 *
 * Provides REST API access to Moodle administrative settings with proper
 * authentication, authorization, and response formatting. Extends ApiBase
 * to inherit JWT validation, capability checking, and standardized responses.
 */
class AdminSettingsIndexEndpoint extends ApiBase {
    
    /**
     * Handle GET request for retrieving system settings.
     *
     * This method implements the complete settings retrieval workflow:
     * 1. Enforce moodle/site:config capability at system context level
     * 2. Extract optional section parameter for filtered retrieval
     * 3. Retrieve admin settings tree using admin_get_root()
     * 4. If section specified: locate and validate specific settings page
     * 5. Extract settings from section or entire tree
     * 6. For each setting: retrieve current value via get_config()
     * 7. Build comprehensive metadata array for each setting
     * 8. Return formatted JSON response with settings data
     *
     * Settings extraction handles all admin_setting types including:
     * - admin_setting_configtext (text input)
     * - admin_setting_configselect (dropdown select)
     * - admin_setting_configcheckbox (checkbox)
     * - admin_setting_configmulticheckbox (multiple checkboxes)
     * - admin_setting_configpasswordunmask (password field)
     * - admin_setting_configtextarea (textarea)
     * - And all other admin_setting subclasses
     *
     * @return void Outputs JSON response directly via $this->success()
     * @throws ForbiddenException If user lacks moodle/site:config capability
     * @throws NotFoundException If specified section does not exist or is invalid
     * @throws ServerException If unexpected error occurs during retrieval
     */
    protected function handle_get() {
        try {
            // Get authenticated user from JWT token
            $user = $this->getUser();
            
            // Enforce moodle/site:config capability at system context level
            // This ensures only users with site configuration permission can access settings
            $systemcontext = context_system::instance();
            $this->checkCapability('moodle/site:config', $systemcontext);
            
            // Extract optional section parameter for filtered retrieval
            // PARAM_SAFEDIR ensures safe directory/section name without path traversal
            $section = $this->getParam('section', PARAM_SAFEDIR, false);
            
            // Retrieve complete admin settings tree structure
            // admin_get_root() returns admin_root object with all settings organized in tree
            $adminroot = admin_get_root();
            
            // Initialize settings array and metadata
            $settings = [];
            $sectiondata = null;
            
            if ($section !== null && $section !== false && $section !== '') {
                // Section parameter provided - retrieve settings for specific section only
                
                // Locate the requested section in the admin tree
                // Second parameter true means include hidden items
                $settingspage = $adminroot->locate($section, true);
                
                // Validate that section exists and is an admin_settingpage instance
                if (empty($settingspage)) {
                    throw new NotFoundException(
                        "Settings section not found: {$section}",
                        [
                            'section' => $section,
                            'reason' => 'No admin settings page exists with this name'
                        ]
                    );
                }
                
                if (!($settingspage instanceof admin_settingpage)) {
                    throw new NotFoundException(
                        "Invalid settings section: {$section}",
                        [
                            'section' => $section,
                            'reason' => 'Located item is not a settings page',
                            'actualType' => get_class($settingspage)
                        ]
                    );
                }
                
                // Check if user has access to this specific settings page
                // Each settings page may have its own access restrictions
                if (!$settingspage->check_access()) {
                    throw new ForbiddenException(
                        "Access denied to settings section: {$section}",
                        [
                            'section' => $section,
                            'reason' => 'You do not have permission to view this settings page'
                        ]
                    );
                }
                
                // Extract settings from this specific page
                $settings = $this->extractSettingsFromPage($settingspage);
                
                // Store section metadata
                $sectiondata = $section;
                
            } else {
                // No section parameter - retrieve all settings from entire tree
                $settings = $this->extractAllSettings($adminroot);
            }
            
            // Build response data structure
            $responsedata = [
                'settings' => $settings
            ];
            
            // Include section information if filtered retrieval
            if ($sectiondata !== null) {
                $responsedata['section'] = $sectiondata;
            }
            
            // Return successful response with settings data
            // Uses ApiBase::success() for standardized JSON envelope
            $this->success($responsedata);
            
        } catch (ForbiddenException $e) {
            // Permission denied - user lacks required capability
            // Re-throw to let ApiBase exception handler format response
            throw $e;
            
        } catch (NotFoundException $e) {
            // Section not found or invalid
            // Re-throw to let ApiBase exception handler format response
            throw $e;
            
        } catch (moodle_exception $e) {
            // Moodle-specific exception (e.g., from require_capability, admin_get_root)
            // Convert to API exception with appropriate status code
            $statuscode = ($e->errorcode === 'nopermissions') ? 403 : 500;
            throw new ApiException(
                $statuscode,
                strtoupper($e->errorcode),
                $e->getMessage(),
                [
                    'errorcode' => $e->errorcode,
                    'module' => $e->module,
                    'link' => $e->link
                ]
            );
            
        } catch (Exception $e) {
            // Unexpected error during settings retrieval
            // Log error and return generic 500 response
            throw new ServerException(
                'Failed to retrieve settings: ' . $e->getMessage(),
                [
                    'exception' => get_class($e),
                    'message' => $e->getMessage(),
                    'file' => $e->getFile(),
                    'line' => $e->getLine()
                ]
            );
        }
    }
    
    /**
     * Extract settings from a specific admin settings page.
     *
     * Iterates through all settings on the provided admin_settingpage and
     * extracts comprehensive metadata for each setting including current
     * value, type, visibility, defaults, and available options.
     *
     * @param admin_settingpage $settingspage Admin settings page object
     * @return array Array of setting metadata objects
     */
    protected function extractSettingsFromPage($settingspage) {
        $settings = [];
        
        // Get all settings from the page
        // admin_settingpage->settings is array of admin_setting objects
        if (isset($settingspage->settings) && is_array($settingspage->settings)) {
            foreach ($settingspage->settings as $setting) {
                // Extract metadata for this setting
                $settingdata = $this->extractSettingData($setting);
                
                // Only include if extraction was successful
                if ($settingdata !== null) {
                    $settings[] = $settingdata;
                }
            }
        }
        
        return $settings;
    }
    
    /**
     * Extract all settings from entire admin settings tree.
     *
     * Recursively traverses the complete admin tree structure to extract
     * settings from all admin_settingpage instances. This provides a
     * comprehensive view of all system configuration settings.
     *
     * @param admin_root $adminroot Root of admin settings tree
     * @return array Array of setting metadata objects from all pages
     */
    protected function extractAllSettings($adminroot) {
        $allsettings = [];
        
        // Recursively traverse admin tree to find all settings pages
        $this->traverseAdminTree($adminroot, $allsettings);
        
        return $allsettings;
    }
    
    /**
     * Recursively traverse admin tree to extract settings.
     *
     * Walks through the admin tree structure, identifying admin_settingpage
     * and admin_category nodes. For each settings page, extracts all settings.
     * For categories, recursively processes children.
     *
     * @param part_of_admin_tree $node Current node in admin tree
     * @param array &$settings Reference to settings array to populate
     * @return void Modifies $settings array by reference
     */
    protected function traverseAdminTree($node, &$settings) {
        // Check if node is a settings page with settings to extract
        if ($node instanceof admin_settingpage) {
            // Check access permissions for this page
            if ($node->check_access()) {
                // Extract settings from this page
                $pagesettings = $this->extractSettingsFromPage($node);
                $settings = array_merge($settings, $pagesettings);
            }
        }
        
        // Check if node is a category with children to traverse
        if ($node instanceof admin_category) {
            // Recursively process child nodes
            if (isset($node->children) && is_array($node->children)) {
                foreach ($node->children as $child) {
                    $this->traverseAdminTree($child, $settings);
                }
            }
        }
    }
    
    /**
     * Extract comprehensive metadata from a single admin setting.
     *
     * Retrieves current value, type, visibility, description, default value,
     * and available options for a setting. Handles all admin_setting subclasses
     * and safely extracts properties with null checks and type conversions.
     *
     * This is the core data extraction method that interfaces with Moodle's
     * settings infrastructure to retrieve actual configuration values via
     * get_config() while preserving all metadata from the setting object.
     *
     * @param admin_setting $setting Admin setting object to extract data from
     * @return array|null Setting metadata array or null if extraction fails
     */
    protected function extractSettingData($setting) {
        // Ensure setting object is valid
        if (!is_object($setting) || !($setting instanceof admin_setting)) {
            return null;
        }
        
        try {
            // Extract setting name (unique identifier)
            $name = isset($setting->name) ? $setting->name : null;
            if ($name === null) {
                return null; // Setting without name is invalid
            }
            
            // Determine plugin context for get_config()
            // Settings can be core settings or plugin-specific
            $plugin = isset($setting->plugin) && $setting->plugin !== '' ? $setting->plugin : 'core';
            
            // Retrieve current value from Moodle configuration
            // get_config() is the authoritative source for actual setting values
            $value = get_config($plugin, $name);
            
            // Handle boolean false return (setting not found in config)
            if ($value === false) {
                $value = null;
            }
            
            // Extract visible name (human-readable label)
            $visiblename = isset($setting->visiblename) ? $setting->visiblename : $name;
            
            // Extract description (help text for setting)
            $description = isset($setting->description) ? $setting->description : '';
            
            // Extract default value (factory default before any customization)
            $defaultvalue = isset($setting->defaultsetting) ? $setting->defaultsetting : null;
            
            // Determine setting type from class name
            $type = $this->getSettingType($setting);
            
            // Extract options for select/multiselect settings
            $options = $this->getSettingOptions($setting);
            
            // Check if setting is currently visible (not hidden by dependencies)
            $visible = true;
            if (method_exists($setting, 'is_hidden')) {
                $visible = !$setting->is_hidden();
            } else if (isset($setting->hidden)) {
                $visible = !$setting->hidden;
            }
            
            // Build comprehensive metadata structure
            $metadata = [
                'name' => $name,
                'value' => $value,
                'plugin' => $plugin,
                'type' => $type,
                'visiblename' => $visiblename,
                'description' => $description,
                'defaultvalue' => $defaultvalue,
                'visible' => $visible
            ];
            
            // Include options for select/multiselect settings
            if ($options !== null) {
                $metadata['options'] = $options;
            }
            
            return $metadata;
            
        } catch (Exception $e) {
            // If extraction fails for this setting, skip it rather than failing entire request
            // This provides robustness against malformed settings
            return null;
        }
    }
    
    /**
     * Determine setting type from admin_setting class.
     *
     * Analyzes the admin_setting object's class to determine the setting type
     * (text, select, checkbox, etc.). This helps clients render appropriate
     * UI controls for editing settings.
     *
     * @param admin_setting $setting Admin setting object
     * @return string Setting type identifier (text|select|checkbox|textarea|password|multiselect|unknown)
     */
    protected function getSettingType($setting) {
        $classname = get_class($setting);
        
        // Map class names to simplified type identifiers
        if (strpos($classname, 'configtext') !== false) {
            return 'text';
        } else if (strpos($classname, 'configselect') !== false) {
            return 'select';
        } else if (strpos($classname, 'configcheckbox') !== false) {
            return 'checkbox';
        } else if (strpos($classname, 'configtextarea') !== false) {
            return 'textarea';
        } else if (strpos($classname, 'configpassword') !== false) {
            return 'password';
        } else if (strpos($classname, 'configmulti') !== false) {
            return 'multiselect';
        } else if (strpos($classname, 'configfile') !== false) {
            return 'file';
        } else if (strpos($classname, 'configcolourpicker') !== false) {
            return 'color';
        } else if (strpos($classname, 'configduration') !== false) {
            return 'duration';
        } else if (strpos($classname, 'configtime') !== false) {
            return 'time';
        }
        
        // Return generic type if specific type cannot be determined
        return 'unknown';
    }
    
    /**
     * Extract available options for select/multiselect settings.
     *
     * For settings that present a list of choices (select, multiselect),
     * this method extracts the available options. Returns null for settings
     * that don't have options.
     *
     * @param admin_setting $setting Admin setting object
     * @return array|null Array of options (value => label) or null if not applicable
     */
    protected function getSettingOptions($setting) {
        // Check if setting has choices/options property
        if (isset($setting->choices) && is_array($setting->choices)) {
            // Return choices array (typically key => label pairs)
            return $setting->choices;
        }
        
        // No options available for this setting type
        return null;
    }
}

// Instantiate endpoint and execute request
// ApiBase::execute() handles HTTP method routing and exception handling
$endpoint = new AdminSettingsIndexEndpoint();
$endpoint->execute();
