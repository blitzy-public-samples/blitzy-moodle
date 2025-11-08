/**
 * TypeScript type definitions for H5P Activity module
 * 
 * This file defines interfaces and enums for the H5P Activity feature,
 * corresponding to the Moodle mod_h5pactivity module structure.
 * 
 * @module h5p.types
 */

/**
 * Grade method options for H5P activities
 * Determines which attempt score is used for final grading
 */
export enum H5PGradeMethod {
  /** Use the highest grade from all attempts */
  HIGHEST = 0,
  /** Use the average grade from all attempts */
  AVERAGE = 1,
  /** Use the grade from the first attempt */
  FIRST = 2,
  /** Use the grade from the last completed attempt */
  LAST = 3,
}

/**
 * Review mode options for H5P activities
 * Controls when students can review their attempts
 */
export enum H5PReviewMode {
  /** Students cannot review attempts */
  NONE = 0,
  /** Students can review after completing an attempt */
  AFTER_ATTEMPT = 1,
  /** Students can review after activity closes */
  AFTER_CLOSE = 2,
  /** Students can review at any time */
  ANYTIME = 3,
}

/**
 * Display options bit flags for H5P player
 * These are stored as a bitmask integer in the database
 */
export enum H5PDisplayOptionFlags {
  /** Show frame around H5P content */
  FRAME = 1,
  /** Allow exporting content */
  EXPORT = 2,
  /** Allow embedding content */
  EMBED = 4,
  /** Show copyright information */
  COPYRIGHT = 8,
  /** Show about H5P information */
  ABOUT = 16,
}

/**
 * Parsed display options for H5P player
 * Boolean flags indicating which player features are enabled
 */
export interface H5PDisplayOptions {
  /** Whether to show frame around H5P content */
  frame: boolean;
  /** Whether to allow exporting content */
  export: boolean;
  /** Whether to allow embedding content */
  embed: boolean;
  /** Whether to show copyright information */
  copyright: boolean;
  /** Whether to show about H5P information */
  about: boolean;
}

/**
 * Main H5P Activity interface
 * Represents a single H5P activity instance in a course
 * 
 * Maps to the h5pactivity database table structure
 */
export interface H5PActivity {
  /** Unique identifier for the activity */
  id: number;
  /** Course ID this activity belongs to */
  course: number;
  /** Display name of the activity */
  name: string;
  /** Activity description/introduction text */
  intro: string | null;
  /** Format of the intro field (e.g., HTML, plain text) */
  introformat: number;
  /** Maximum grade for this activity (null if not graded) */
  grade: number | null;
  /** Unix timestamp when activity was created */
  timecreated: number;
  /** Unix timestamp when activity was last modified */
  timemodified: number;
  /** Bit flags for display options (use parseDisplayOptions to decode) */
  displayoptions: number;
  /** Whether xAPI tracking is enabled (1 = enabled, 0 = disabled) */
  enabletracking: number;
  /** Method used to calculate final grade from multiple attempts */
  grademethod: number;
  /** When students can review their attempts */
  reviewmode: number | null;
}

/**
 * Access information for H5P activity
 * Contains capability checks for the current user
 * 
 * Maps to the response from get_h5pactivity_access_information external API
 */
export interface H5PAccessInfo {
  /** Whether user can view the activity */
  canview: boolean;
  /** Whether user can submit attempts */
  cansubmit: boolean;
  /** Whether user can review all attempts (typically for teachers) */
  canreviewattempts: boolean;
  /** Whether user can review their own attempts */
  canreviewmyattempts: boolean;
}

/**
 * H5P Activity attempt data
 * Represents a single user attempt at an H5P activity
 * 
 * Maps to the h5pactivity_attempts database table
 */
export interface H5PAttempt {
  /** Unique identifier for the attempt */
  id: number;
  /** H5P activity ID this attempt belongs to */
  h5pactivityid: number;
  /** User ID who made this attempt */
  userid: number;
  /** Unix timestamp when attempt was created */
  timecreated: number;
  /** Unix timestamp when attempt was last modified */
  timemodified: number;
  /** Attempt number for this user (1, 2, 3, etc.) */
  attempt: number;
  /** Raw score achieved */
  rawscore: number | null;
  /** Maximum possible score */
  maxscore: number | null;
  /** Scaled score (0-1) representing performance */
  scaled: number;
  /** Duration in seconds spent on this attempt */
  duration: number | null;
  /** xAPI completion status (1 = complete, 0 = incomplete, null = unknown) */
  completion: number | null;
  /** xAPI success status (1 = success, 0 = failure, null = unknown) */
  success: number | null;
}

/**
 * Request payload for updating H5P activity settings
 * Contains fields that can be modified via the update API
 */
export interface H5PActivityUpdatePayload {
  /** New name for the activity (optional) */
  name?: string;
  /** New intro text (optional) */
  intro?: string;
  /** New intro format (optional) */
  introformat?: number;
  /** New grade value (optional) */
  grade?: number | null;
  /** New display options bit flags (optional) */
  displayoptions?: number;
  /** New tracking enabled status (optional) */
  enabletracking?: number;
  /** New grade method (optional) */
  grademethod?: number;
  /** New review mode (optional) */
  reviewmode?: number | null;
}

/**
 * Response from H5P activity API endpoints
 * Standard API response wrapper
 */
export interface H5PActivityResponse {
  /** Whether the request was successful */
  success: boolean;
  /** Activity data (if success is true) */
  data?: H5PActivity;
  /** Error message (if success is false) */
  error?: {
    /** Error code */
    code: string;
    /** Human-readable error message */
    message: string;
    /** Additional error details */
    details?: Record<string, unknown>;
  };
}

/**
 * Response from H5P access information API endpoint
 * Standard API response wrapper for access info
 */
export interface H5PAccessInfoResponse {
  /** Whether the request was successful */
  success: boolean;
  /** Access information data (if success is true) */
  data?: H5PAccessInfo;
  /** Error message (if success is false) */
  error?: {
    /** Error code */
    code: string;
    /** Human-readable error message */
    message: string;
    /** Additional error details */
    details?: Record<string, unknown>;
  };
}

/**
 * Result returned by useH5PActivity hook
 * Combines activity data, access info, and action functions
 */
export interface UseH5PActivityResult {
  /** The H5P activity data */
  activity: H5PActivity | undefined;
  /** Access information for the current user */
  access: H5PAccessInfo | undefined;
  /** Parsed display options from activity.displayoptions */
  displayOptions: H5PDisplayOptions | undefined;
  /** Whether data is currently loading */
  isLoading: boolean;
  /** Whether an error occurred */
  isError: boolean;
  /** Error object if isError is true */
  error: Error | null;
  /** Function to manually refetch activity data */
  refetch: () => void;
  /** Function to update activity settings */
  updateActivity: (updates: H5PActivityUpdatePayload) => Promise<void>;
  /** Helper function to parse display options from bit flags */
  parseDisplayOptions: (displayoptions: number) => H5PDisplayOptions;
  /** Helper function to check if tracking is enabled */
  isTrackingEnabled: () => boolean;
  /** Helper function to check if user can view reports */
  canViewReports: () => boolean;
}
