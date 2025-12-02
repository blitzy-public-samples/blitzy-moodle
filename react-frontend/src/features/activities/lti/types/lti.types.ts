/**
 * TypeScript type definitions for the LTI (Learning Tools Interoperability) activity module
 *
 * These types are based on:
 * - Database schema from public/mod/lti/db/install.xml
 * - External API structures from public/mod/lti/classes/external.php
 * - Constants from public/mod/lti/locallib.php
 *
 * @package react-frontend
 * @subpackage features/activities/lti
 */

/**
 * LTI Version enum
 * Represents the different LTI protocol versions supported by Moodle
 * From locallib.php lines 95-97
 */
export enum LtiVersion {
  /** LTI 1.0 version */
  LTI_1P0 = 'LTI-1p0',
  /** LTI 2.0 version */
  LTI_2P0 = 'LTI-2p0',
  /** LTI 1.3 (Advantage) version */
  LTI_1P3 = '1.3.0',
}

/**
 * Launch Container enum
 * Defines how the LTI tool should be launched/displayed
 * From locallib.php lines 70-74
 */
export enum LaunchContainer {
  /** Default launch container (typically in a frame) */
  DEFAULT = 1,
  /** Embed in the course page with blocks visible */
  EMBED = 2,
  /** Embed in the course page without blocks */
  EMBED_NO_BLOCKS = 3,
  /** Launch in a new window */
  WINDOW = 4,
  /** Replace the entire Moodle window */
  REPLACE_MOODLE_WINDOW = 5,
}

/**
 * LTI Tool State enum
 * Represents the configuration state of an LTI tool type
 * From locallib.php lines 76-80
 */
export enum LtiToolState {
  /** Any state (used for filtering) */
  ANY = 0,
  /** Tool is configured and ready to use */
  CONFIGURED = 1,
  /** Tool configuration is pending */
  PENDING = 2,
  /** Tool configuration was rejected */
  REJECTED = 3,
  /** Tool proxy tab (special state for UI) */
  TOOL_PROXY_TAB = 4,
}

/**
 * LTI Tool Proxy State enum
 * Represents the state of an LTI 2.0 tool proxy registration
 * From locallib.php lines 82-85
 */
export enum LtiToolProxyState {
  /** Tool proxy is configured */
  CONFIGURED = 1,
  /** Tool proxy registration is pending */
  PENDING = 2,
  /** Tool proxy registration was accepted */
  ACCEPTED = 3,
  /** Tool proxy registration was rejected */
  REJECTED = 4,
}

/**
 * Main LTI Tool interface
 * Represents an LTI external tool instance in a course
 * Based on the 'lti' table schema from install.xml lines 7-42
 * and external.php return structure lines 346-387
 */
export interface LtiTool {
  /** Tool instance ID */
  id: number;
  /** Course ID this tool belongs to */
  course: number;
  /** Tool instance name (max 1333 characters) */
  name: string;
  /** Introduction/description text (optional) */
  intro?: string;
  /** Introduction format (MOODLE, HTML, MARKDOWN, etc.) */
  introformat?: number;
  /** Timestamp when the tool was created */
  timecreated?: number;
  /** Timestamp when the tool was last modified */
  timemodified?: number;
  /** Tool URL (required) */
  toolurl: string;
  /** Secure tool URL (HTTPS) - optional */
  securetoolurl?: string;
  /** Whether to send user's name to the tool (0 or 1) */
  instructorchoicesendname?: number;
  /** Whether to send user's email address to the tool (0 or 1) */
  instructorchoicesendemailaddr?: number;
  /** Whether to allow roster retrieval (0 or 1) */
  instructorchoiceallowroster?: number;
  /** Whether to allow the tool to store settings (0 or 1) */
  instructorchoiceallowsetting?: number;
  /** Custom parameters provided by the instructor */
  instructorcustomparameters?: string;
  /** Whether to accept grades from the tool (0 or 1) */
  instructorchoiceacceptgrades?: number;
  /** Reference to preconfigured tool type ID (optional) */
  typeid?: number;
  /** Reference to tool proxy ID for LTI 2.0 (optional) */
  toolproxyid?: number;
  /** Grade scale value (default 100) */
  grade: number;
  /** Launch container mode (see LaunchContainer enum) */
  launchcontainer: number;
  /** Resource key/consumer key for OAuth (optional) */
  resourcekey?: string;
  /** Shared secret/password for OAuth (optional) */
  password?: string;
  /** Enable debug launch mode (0 or 1) */
  debuglaunch: number;
  /** Show title on launch (0 or 1) */
  showtitlelaunch: number;
  /** Show description on launch (0 or 1) */
  showdescriptionlaunch: number;
  /** Service salt for tool communication (optional) */
  servicesalt?: string;
  /** Icon URL (optional) */
  icon?: string;
  /** Secure icon URL (HTTPS) - optional */
  secureicon?: string;
}

/**
 * LTI Tool Type interface
 * Represents a preconfigured LTI tool type that can be reused
 * Based on the 'lti_types' table schema from install.xml lines 66-95
 * and external.php tool_type_return_structure lines 58-99
 */
export interface LtiToolType {
  /** Tool type ID */
  id: number;
  /** Tool type name */
  name: string;
  /** Base URL for the tool */
  baseurl: string;
  /** Tool domain extracted from baseurl */
  tooldomain?: string;
  /** Tool globally unique identifier */
  toolguid?: string;
  /** Tool state (see LtiToolState enum) */
  state: number;
  /** Course ID (0 for site-wide tool types) */
  course: number;
  /** Course visibility setting (0=hidden, 1=preconfigured, 2=activity chooser) */
  coursevisible: number;
  /** LTI version (LTI-1p0, LTI-2p0, or 1.3.0) */
  ltiversion?: string;
  /** Client ID for LTI 1.3 */
  clientid?: string;
  /** Tool proxy ID for LTI 2.0 tools */
  toolproxyid?: number;
  /** Enabled capabilities (one per line) */
  enabledcapability?: string;
  /** Launch parameters (one per line) */
  parameter?: string;
  /** Icon URL */
  icon?: string;
  /** Secure icon URL */
  secureicon?: string;
  /** Description of the tool */
  description?: string;
  /** User ID who created this tool type */
  createdby?: number;
  /** Timestamp when created */
  timecreated?: number;
  /** Timestamp when last modified */
  timemodified?: number;
}

/**
 * LTI Tool Proxy interface
 * Represents an LTI 2.0 tool proxy registration
 * Based on the 'lti_tool_proxies' table schema from install.xml lines 43-65
 * and external.php tool_proxy_return_structure lines 107-124
 */
export interface LtiToolProxy {
  /** Tool proxy ID */
  id: number;
  /** Tool provider name */
  name: string;
  /** Registration URL */
  regurl?: string;
  /** State (see LtiToolProxyState enum) */
  state: number;
  /** Globally unique identifier */
  guid?: string;
  /** Shared secret */
  secret?: string;
  /** Vendor code */
  vendorcode?: string;
  /** List of capabilities offered (one per line) */
  capabilityoffered: string;
  /** List of services offered (one per line) */
  serviceoffered: string;
  /** JSON string representing tool proxy returned by tool provider */
  toolproxy?: string;
  /** User ID who created this tool proxy */
  createdby: number;
  /** Timestamp when created */
  timecreated: number;
  /** Timestamp when last modified */
  timemodified: number;
}

/**
 * LTI Launch Data interface
 * Contains the endpoint and parameters needed to launch an LTI tool
 * Based on external.php get_tool_launch_data_returns lines 240-254
 */
export interface LtiLaunchData {
  /** Launch endpoint URL */
  endpoint: string;
  /** Array of launch parameters as key-value pairs */
  parameters: Array<{
    /** Parameter name */
    name: string;
    /** Parameter value */
    value: string;
  }>;
  /** OAuth signature (if applicable) */
  oauth_signature?: string;
  /** Launch container type - determines how the tool is displayed */
  launchContainer?: LaunchContainer;
  /** Debug information (only present when debug mode is enabled) */
  debug?: {
    /** The signature base string used for OAuth signing */
    signatureBaseString?: string;
    /** The normalized parameters string */
    normalizedParams?: string;
    /** Timestamp used in signature */
    timestamp?: string;
    /** Nonce used in signature */
    nonce?: string;
  };
}

/**
 * LTI Grade Result interface
 * Represents a grade passback result from an LTI tool
 * Based on the 'lti_submission' table schema from install.xml lines 129-147
 */
export interface LtiGradeResult {
  /** Submission ID */
  id: number;
  /** LTI tool instance ID */
  ltiid: number;
  /** User ID */
  userid: number;
  /** Grade as percentage (0-100) */
  gradepercent: number;
  /** Timestamp when graded */
  dategraded?: number;
  /** Timestamp when submitted */
  datesubmitted: number;
  /** Timestamp when last updated */
  dateupdated?: number;
  /** Original grade value from the tool */
  originalgrade: number;
  /** Launch ID associated with this submission */
  launchid?: number;
  /** Submission state */
  state?: number;
}

/**
 * LTI Tool Settings interface
 * Represents custom settings stored by an LTI tool
 * Based on the 'lti_tool_settings' table from install.xml lines 110-128
 */
export interface LtiToolSettings {
  /** Settings ID */
  id: number;
  /** Tool proxy ID */
  toolproxyid: number;
  /** Tool type ID (optional) */
  typeid?: number;
  /** Course ID (null for system-wide settings) */
  course?: number;
  /** Course module ID (null for system-wide and course-wide settings) */
  coursemoduleid?: number;
  /** Settings as JSON string */
  settings: string;
  /** Timestamp when created */
  timecreated: number;
  /** Timestamp when last modified */
  timemodified: number;
}

/**
 * LTI Types Config interface
 * Represents configuration parameters for LTI tool types
 * Based on the 'lti_types_config' table from install.xml lines 96-109
 */
export interface LtiTypesConfig {
  /** Config ID */
  id: number;
  /** Tool type ID */
  typeid: number;
  /** Parameter name */
  name: string;
  /** Parameter value */
  value: string;
}
