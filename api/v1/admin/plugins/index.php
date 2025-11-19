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
 * REST API endpoint for listing all Moodle plugins.
 *
 * Provides functionality to retrieve a comprehensive list of all installed
 * Moodle plugins with their metadata, status, and configuration information.
 * This endpoint is essential for the React admin interface to display and
 * manage the plugin ecosystem.
 *
 * Functionality:
 * - List all installed plugins across all plugin types
 * - Retrieve plugin metadata (name, version, release, dependencies)
 * - Check plugin status (enabled/disabled, missing, needs upgrade)
 * - Group plugins by type (mod, auth, block, etc.)
 * - Return plugin capabilities and available settings
 *
 * All operations require moodle/site:config capability (site administrator).
 *
 * Example GET request:
 * <code>
 * GET /api/v1/admin/plugins
 * Authorization: Bearer <jwt_token>
 * </code>
 *
 * Example response:
 * <code>
 * {
 *   "success": true,
 *   "data": {
 *     "mod": [
 *       {
 *         "component": "mod_forum",
 *         "type": "mod",
 *         "name": "Forum",
 *         "version": "2024042200",
 *         "release": "4.4",
 *         "enabled": true,
 *         "status": "ok"
 *       },
 *       ...
 *     ],
 *     "auth": [ ... ],
 *     "block": [ ... ]
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
// Only require config if not already loaded (for test compatibility)
if (!defined('MOODLE_INTERNAL')) {
    require_once(__DIR__ . '/../../../../config.php');
}
require_once($CFG->libdir . '/adminlib.php');
require_once($CFG->libdir . '/accesslib.php');

// Load API utilities
require_once(__DIR__ . '/../../../lib/api_base.php');
require_once(__DIR__ . '/../../../lib/api_exception.php');

/**
 * Plugin listing API endpoint class.
 *
 * Handles GET requests for retrieving the full list of installed plugins
 * with their metadata and status information. Enforces system-level 
 * permissions before providing plugin information.
 */
class PluginIndexEndpoint extends ApiBase {
    
    /**
     * Handle GET requests for plugin listing.
     *
     * Retrieves all installed plugins from the plugin manager and formats
     * them into a structured response grouped by plugin type. Each plugin
     * entry includes comprehensive metadata for display in admin interfaces.
     *
     * Response structure:
     * {
     *   "success": true,
     *   "data": {
     *     "plugintype1": [plugin1, plugin2, ...],
     *     "plugintype2": [plugin1, plugin2, ...],
     *     ...
     *   }
     * }
     *
     * @return void Outputs JSON response directly
     * @throws ForbiddenException If user lacks moodle/site:config capability
     */
    protected function handle_get() {
        global $CFG;
        
        // Check system-level configuration capability
        $systemcontext = context_system::instance();
        $this->checkCapability('moodle/site:config', $systemcontext);
        
        // Get plugin manager instance
        $pluginman = core_plugin_manager::instance();
        
        // Retrieve all plugins grouped by type
        $allplugins = $pluginman->get_plugins();
        
        // Format plugin data for API response
        $plugindata = array();
        
        foreach ($allplugins as $plugintype => $plugins) {
            $plugindata[$plugintype] = array();
            
            foreach ($plugins as $pluginname => $plugininfo) {
                // Build plugin metadata with all required fields
                $pluginentry = array(
                    // Core identification
                    'component' => $plugininfo->component,
                    'type' => $plugininfo->type,
                    'name' => $pluginname,
                    'displayname' => $plugininfo->displayname,
                    
                    // Version information
                    'versiondisk' => $plugininfo->versiondisk,
                    'versiondb' => $plugininfo->versiondb,
                    
                    // Plugin source (standard vs extension)
                    'source' => $this->format_plugin_source($plugininfo->source),
                    
                    // Release information
                    'release' => $plugininfo->release,
                    
                    // Required Moodle version
                    'requires' => $plugininfo->versionrequires,
                    
                    // Plugin status
                    'status' => $this->get_plugin_status_string($plugininfo),
                    
                    // Settings availability
                    'hasSettings' => $this->check_has_settings($plugininfo),
                    
                    // Update availability
                    'availableUpdate' => $this->get_available_update($plugininfo),
                );
                
                // Add optional root directory (useful for debugging)
                if (isset($plugininfo->rootdir)) {
                    $pluginentry['rootdir'] = $plugininfo->rootdir;
                }
                
                // Add dependency information if present
                if (!empty($plugininfo->dependencies)) {
                    $pluginentry['dependencies'] = $plugininfo->dependencies;
                }
                
                // Add enabled status for plugins that support enabling/disabling
                if (method_exists($plugininfo, 'is_enabled')) {
                    $pluginentry['enabled'] = $plugininfo->is_enabled();
                } else {
                    // Plugins without is_enabled() are considered always enabled
                    $pluginentry['enabled'] = true;
                }
                
                $plugindata[$plugintype][] = $pluginentry;
            }
        }
        
        // Return formatted plugin list
        $this->success($plugindata);
    }
    
    /**
     * Handle POST requests - not supported.
     *
     * This endpoint only supports GET operations for listing plugins.
     *
     * @throws MethodNotAllowedException Always, as POST is not supported
     */
    protected function handle_post() {
        throw new MethodNotAllowedException('POST method is not supported for plugin listing', [
            'allowedMethods' => ['GET']
        ]);
    }
    
    /**
     * Handle PUT requests - not supported.
     *
     * This endpoint only supports GET operations for listing plugins.
     * Use /configure endpoint for plugin configuration changes.
     *
     * @throws MethodNotAllowedException Always, as PUT is not supported
     */
    protected function handle_put() {
        throw new MethodNotAllowedException('PUT method is not supported for plugin listing', [
            'allowedMethods' => ['GET'],
            'hint' => 'Use /api/v1/admin/plugins/configure for plugin configuration changes'
        ]);
    }
    
    /**
     * Handle DELETE requests - not supported.
     *
     * This endpoint only supports GET operations for listing plugins.
     *
     * @throws MethodNotAllowedException Always, as DELETE is not supported
     */
    protected function handle_delete() {
        throw new MethodNotAllowedException('DELETE method is not supported for plugin listing', [
            'allowedMethods' => ['GET']
        ]);
    }
    
    /**
     * Convert plugin status to human-readable string.
     *
     * Maps the plugin status code to a descriptive string suitable for
     * frontend display. This wraps existing Moodle plugin status checking.
     *
     * @param \core\plugininfo\base $plugininfo Plugin information object
     * @return string Status string ('ok', 'missing', 'upgrade', 'new', 'downgrade')
     */
    private function get_plugin_status_string($plugininfo) {
        // Use existing Moodle status constants
        $status = $plugininfo->get_status();
        
        switch ($status) {
            case core_plugin_manager::PLUGIN_STATUS_UPTODATE:
                return 'ok';
            case core_plugin_manager::PLUGIN_STATUS_UPGRADE:
                return 'upgrade';
            case core_plugin_manager::PLUGIN_STATUS_NEW:
                return 'new';
            case core_plugin_manager::PLUGIN_STATUS_MISSING:
                return 'missing';
            case core_plugin_manager::PLUGIN_STATUS_DOWNGRADE:
                return 'downgrade';
            case core_plugin_manager::PLUGIN_STATUS_NODB:
                return 'nodb';
            default:
                return 'unknown';
        }
    }
    
    /**
     * Format plugin source type to human-readable string.
     *
     * Converts Moodle core plugin source constants to string format.
     * Standard plugins are core Moodle plugins, extensions are third-party.
     *
     * @param int $source Plugin source constant from plugin manager
     * @return string 'standard' or 'extension'
     */
    private function format_plugin_source($source) {
        if ($source === core_plugin_manager::PLUGIN_SOURCE_STANDARD) {
            return 'standard';
        } else if ($source === core_plugin_manager::PLUGIN_SOURCE_EXTENSION) {
            return 'extension';
        } else {
            // Fallback for any unexpected values
            return 'unknown';
        }
    }
    
    /**
     * Check if plugin has a settings page.
     *
     * Determines whether the plugin provides a settings/configuration interface
     * by checking if it is enabled and has a settings URL. Uses existing Moodle
     * plugin info methods without duplicating business logic.
     *
     * @param \core\plugininfo\base $plugininfo Plugin information object
     * @return bool True if plugin has accessible settings, false otherwise
     */
    private function check_has_settings($plugininfo) {
        // Plugin must be enabled to have accessible settings
        if (method_exists($plugininfo, 'is_enabled') && !$plugininfo->is_enabled()) {
            return false;
        }
        
        // Check if plugin provides a settings URL using existing method
        if (method_exists($plugininfo, 'get_settings_url')) {
            $settingsurl = $plugininfo->get_settings_url();
            return ($settingsurl !== null);
        }
        
        // Plugins without get_settings_url() method have no settings
        return false;
    }
    
    /**
     * Get available update information for plugin.
     *
     * Checks if there is an available update for the plugin from the Moodle
     * plugins directory. Returns false if no update available, or an array
     * with update details if an update is available. Uses existing Moodle
     * update detection without reimplementing logic.
     *
     * @param \core\plugininfo\base $plugininfo Plugin information object
     * @return bool|array False if no update, array with update info if available
     */
    private function get_available_update($plugininfo) {
        // Check if plugin manager has update information method
        if (!method_exists($plugininfo, 'available_updates')) {
            return false;
        }
        
        // Get available updates from existing Moodle method
        $updates = $plugininfo->available_updates();
        
        // No updates available
        if (empty($updates)) {
            return false;
        }
        
        // Get the latest available update (first in array)
        $latestupdate = reset($updates);
        
        // Format update information for API response
        if ($latestupdate && is_object($latestupdate)) {
            $updateinfo = array();
            
            // Only include properties that exist on the update object
            if (isset($latestupdate->version)) {
                $updateinfo['version'] = $latestupdate->version;
            }
            
            if (isset($latestupdate->release)) {
                $updateinfo['release'] = $latestupdate->release;
            }
            
            if (isset($latestupdate->maturity)) {
                $updateinfo['maturity'] = $latestupdate->maturity;
            }
            
            if (isset($latestupdate->downloadurl)) {
                $updateinfo['url'] = $latestupdate->downloadurl;
            }
            
            // Return update info if we have at least one property
            return !empty($updateinfo) ? $updateinfo : false;
        }
        
        return false;
    }
}

// Execute the endpoint if not in test mode
if (!defined('API_TEST_MODE')) {
    $endpoint = new PluginIndexEndpoint();
    $endpoint->execute();
}
