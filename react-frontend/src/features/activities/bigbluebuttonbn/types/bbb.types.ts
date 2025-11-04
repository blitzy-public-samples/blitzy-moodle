/**
 * TypeScript type definitions for BigBlueButton (BBB) activity module.
 * 
 * This file contains comprehensive interfaces for BigBlueButton conference rooms,
 * meetings, recordings, and related entities based on Moodle's BigBlueButton plugin.
 * 
 * @packageDocumentation
 * @module features/activities/bigbluebuttonbn/types
 */

/**
 * Instance type constants for BigBlueButton activities.
 * Determines what functionality is available in the instance.
 */
export enum BBBInstanceType {
  /** Instance includes both room and recordings */
  ALL = 0,
  /** Instance includes only the conference room */
  ROOM_ONLY = 1,
  /** Instance includes only recordings */
  RECORDING_ONLY = 2,
}

/**
 * Recording status enumeration.
 * Tracks the lifecycle state of a BigBlueButton recording.
 */
export enum BBBRecordingStatus {
  /** Meeting set to be recorded awaits recording update from BBB server */
  AWAITING = 0,
  /** Meeting set to be recorded was not recorded and dismissed by BBB */
  DISMISSED = 1,
  /** Meeting recording has been processed and is available */
  PROCESSED = 2,
  /** Meeting received notification callback from BBB server */
  NOTIFIED = 3,
  /** Recording was processed and set back to awaiting state */
  RESET = 4,
  /** Recording was deleted from BigBlueButton server */
  DELETED = 5,
}

/**
 * Participant role within a BigBlueButton meeting.
 */
export enum BBBParticipantRole {
  /** Moderator with full meeting control */
  MODERATOR = 'moderator',
  /** Viewer with limited permissions */
  VIEWER = 'viewer',
}

/**
 * Playback format for a recording.
 * Represents different available formats for viewing recordings.
 */
export interface BBBPlayback {
  /** Playback format type (e.g., 'presentation', 'video') */
  type: string;
  /** URL to access the playback */
  url: string;
  /** Length of the recording in milliseconds */
  length: number;
}

/**
 * Presentation file information for a BigBlueButton meeting.
 * Represents files that can be displayed during the conference.
 */
export interface BBBPresentation {
  /** URL to access the presentation file */
  url: string;
  /** Name of the presentation file */
  name: string;
  /** Icon name for the presentation file type */
  iconName: string;
  /** Icon description text for accessibility */
  iconDesc: string;
}

/**
 * Feature flag configuration for a BigBlueButton instance.
 * Indicates which features are enabled or disabled.
 */
export interface BBBFeature {
  /** Feature name identifier (e.g., 'chat', 'polls', 'recordings') */
  name: string;
  /** Whether the feature is enabled for this instance */
  isEnabled: boolean;
}

/**
 * BigBlueButton instance configuration.
 * Represents the configuration and settings for a BBB activity in a course.
 * 
 * This interface maps to the bigbluebuttonbn table and instance class properties.
 */
export interface BBBInstance {
  /** Unique identifier for this BBB instance */
  id: number;
  
  /** Course ID this instance belongs to */
  courseId: number;
  
  /** Display name of the conference room/instance */
  name: string;
  
  /** Introduction/description text (supports HTML) */
  intro: string;
  
  /** Meeting identifier used by BBB server */
  meetingId: string;
  
  /** Instance type determining available functionality */
  type: BBBInstanceType;
  
  /** Unix timestamp when the room opens (null if always open) */
  openingTime: number | null;
  
  /** Unix timestamp when the room closes (null if no closing time) */
  closingTime: number | null;
  
  /** Maximum number of users allowed in the meeting (0 for unlimited) */
  userLimit: number;
  
  /** Welcome message displayed when users join the meeting */
  welcome: string;
  
  /** Group ID for group-specific instances (null for all groups) */
  groupId: number | null;
  
  /** Whether recordings are enabled for this instance */
  recordings: boolean;
  
  /** Whether chat is enabled for this instance */
  chat: boolean;
  
  /** Whether polls/surveys are enabled for this instance */
  polls: boolean;
  
  /** Array of presentation files available for the meeting */
  presentations: BBBPresentation[];
}

/**
 * Active BigBlueButton meeting information.
 * Represents a live or scheduled meeting session with real-time status.
 * 
 * This interface maps to the meeting class and meeting_info external service.
 */
export interface BBBMeeting {
  /** Meeting identifier on BBB server */
  meetingId: string;
  
  /** BBB instance ID this meeting belongs to */
  instanceId: number;
  
  /** Course module ID */
  cmId: number;
  
  /** Whether the meeting is currently running */
  statusRunning: boolean;
  
  /** Whether the meeting is closed */
  statusClosed: boolean;
  
  /** Whether the meeting is open for joining */
  statusOpen: boolean;
  
  /** Unix timestamp when the meeting started (null if not started) */
  startedAt: number | null;
  
  /** Number of moderators currently in the meeting */
  moderatorCount: number;
  
  /** Number of participants currently in the meeting */
  participantCount: number;
  
  /** URL to join the meeting */
  joinUrl: string;
  
  /** Whether the current user has moderator privileges */
  isModerator: boolean;
  
  /** Whether the current user can join the meeting */
  canJoin: boolean;
  
  /** Array of presentation files available in the meeting */
  presentations: BBBPresentation[];
  
  /** Whether guest access is enabled for this meeting */
  guestAccessEnabled: boolean;
  
  /** URL for guests to join the meeting (if guest access enabled) */
  guestJoinUrl: string | null;
  
  /** Guest password for joining (if guest access requires password) */
  guestPassword: string | null;
  
  /** Array of enabled features for this meeting */
  features: BBBFeature[];
  
  /** Group ID for group-specific meetings */
  groupId: number;
  
  /** BigBlueButton instance ID (raw identifier) */
  bigbluebuttonbnId: string;
  
  /** User limit for the meeting */
  userLimit: number;
}

/**
 * BigBlueButton recording metadata.
 * Represents a recorded session with playback information.
 * 
 * This interface maps to the recording persistent class properties.
 */
export interface BBBRecording {
  /** Local database ID for this recording */
  id: number;
  
  /** Recording ID from BBB server */
  recordingId: string;
  
  /** BBB instance ID this recording belongs to */
  bigbluebuttonbnId: number;
  
  /** Course ID this recording belongs to */
  courseId: number;
  
  /** Display name of the recording */
  name: string | null;
  
  /** Description text for the recording */
  description: string | null;
  
  /** Unix timestamp when the recording started */
  startTime: number | null;
  
  /** Unix timestamp when the recording ended */
  endTime: number | null;
  
  /** Whether the recording is published and visible to users */
  published: boolean | null;
  
  /** Whether the recording is protected from deletion */
  protected: boolean | null;
  
  /** Array of playback formats available for this recording */
  playbacks: BBBPlayback[] | null;
  
  /** Whether the original activity no longer exists (orphaned recording) */
  headless: boolean;
  
  /** Whether this is an imported recording from another instance */
  imported: boolean;
  
  /** Current processing/availability status of the recording */
  status: BBBRecordingStatus;
  
  /** Group ID for group-specific recordings (null for all groups) */
  groupId: number | null;
}

/**
 * Real-time room status information for UI display.
 * Provides user-friendly status information about a meeting room.
 * 
 * This interface is used for displaying meeting availability and participant counts.
 */
export interface BBBRoomStatus {
  /** Whether the meeting is currently running */
  statusRunning: boolean;
  
  /** Whether the meeting is closed */
  statusClosed: boolean;
  
  /** Whether the meeting is open for joining */
  statusOpen: boolean;
  
  /** Human-readable status message for display */
  statusMessage: string;
  
  /** Number of moderators currently in the meeting */
  moderatorCount: number;
  
  /** Number of participants currently in the meeting */
  participantCount: number;
  
  /** Whether to use plural form for moderator count display */
  moderatorPlural: boolean;
  
  /** Whether to use plural form for participant count display */
  participantPlural: boolean;
  
  /** Whether the current user can join the meeting */
  canJoin: boolean;
  
  /** Unix timestamp when the room opens (null if always open) */
  openingTime: number | null;
  
  /** Unix timestamp when the room closes (null if no closing time) */
  closingTime: number | null;
}

/**
 * Active participant/attendee information within a meeting.
 * Represents a user currently in or recently connected to a meeting.
 */
export interface BBBParticipant {
  /** User ID in Moodle */
  userId: number;
  
  /** Full name of the participant */
  fullName: string;
  
  /** Role/permissions of the participant in the meeting */
  role: BBBParticipantRole;
  
  /** Whether the participant has joined the voice conference */
  hasJoinedVoice: boolean;
  
  /** Whether the participant has video enabled */
  hasVideo: boolean;
  
  /** Custom metadata associated with the participant */
  customData: Record<string, string>;
  
  /** Client type/device information (e.g., 'html5', 'flash') */
  clientType: string;
}

/**
 * Options for joining a BigBlueButton meeting.
 * Configures how a user joins and what features are available.
 */
export interface BBBJoinOptions {
  /** Whether to redirect immediately after join (vs. opening in new window) */
  redirect: boolean;
  
  /** Whether to force HTML5 client (vs. allowing Flash fallback) */
  joinViaHtml5: boolean;
  
  /** Guest name for non-authenticated users (null if authenticated) */
  guestName: string | null;
  
  /** Guest password for protected meetings (null if not required) */
  guestPassword: string | null;
  
  /** Array of presentation URLs to load on join */
  presentationUrls: string[];
  
  /** Custom parameters to pass to BBB server */
  customParameters: Record<string, string>;
}

/**
 * Server response for meeting creation or updates.
 * Contains the result of API operations on meetings.
 */
export interface BBBMeetingResponse {
  /** Whether the operation was successful */
  success: boolean;
  
  /** Meeting information if operation succeeded */
  meeting: BBBMeeting | null;
  
  /** Error message if operation failed */
  error: string | null;
}

/**
 * Server response for recording operations.
 * Contains the result of API operations on recordings.
 */
export interface BBBRecordingResponse {
  /** Whether the operation was successful */
  success: boolean;
  
  /** Array of recordings if operation succeeded */
  recordings: BBBRecording[];
  
  /** Error message if operation failed */
  error: string | null;
}

/**
 * Table data structure for recordings list.
 * Used by the recordings table component for display and interaction.
 */
export interface BBBRecordingTableData {
  /** Activity identifier */
  activity: string;
  
  /** Polling interval for status updates (milliseconds) */
  pingInterval: number;
  
  /** Locale/language code for internationalization */
  locale: string;
  
  /** Array of enabled profile features */
  profileFeatures: string[];
  
  /** Column definitions for the data table */
  columns: BBBTableColumn[];
  
  /** Recording data (JSON-encoded for flexibility) */
  data: string;
}

/**
 * Column definition for recordings table.
 * Defines structure and behavior of table columns.
 */
export interface BBBTableColumn {
  /** Column key/identifier */
  key: string;
  
  /** Display label for the column header */
  label: string;
  
  /** Column width specification */
  width: string;
  
  /** Column data type (for sorting/filtering) */
  type?: string;
  
  /** Whether the column is sortable */
  sortable?: boolean;
  
  /** Whether the column contains HTML content */
  allowHTML?: boolean;
  
  /** Formatter function name for custom display */
  formatter?: string;
}
