/**
 * Mock data fixtures and factory functions for Choice activity unit tests.
 * 
 * This module provides comprehensive mock data generation for testing Choice activity
 * components, hooks, and API interactions. All factories support partial overrides
 * via spread operators for flexible test scenarios.
 * 
 * @module choiceMocks
 * @packageDocumentation
 */

// Constants matching Moodle's Choice module defines (from public/mod/choice/lib.php)
export const CHOICE_PUBLISH_ANONYMOUS = 0;
export const CHOICE_PUBLISH_NAMES = 1;

export const CHOICE_SHOWRESULTS_NOT = 0;
export const CHOICE_SHOWRESULTS_AFTER_ANSWER = 1;
export const CHOICE_SHOWRESULTS_AFTER_CLOSE = 2;
export const CHOICE_SHOWRESULTS_ALWAYS = 3;

export const CHOICE_DISPLAY_HORIZONTAL = 0;
export const CHOICE_DISPLAY_VERTICAL = 1;

/**
 * Represents a Choice activity instance.
 * Maps to the 'choice' database table from public/mod/choice/db/install.xml
 */
export interface Choice {
  id: number;
  course: number;
  name: string;
  intro: string;
  introformat: number;
  publish: number;
  showresults: number;
  display: number;
  allowupdate: number;
  allowmultiple: number;
  showunanswered: number;
  includeinactive: number;
  limitanswers: number;
  timeopen: number;
  timeclose: number;
  showpreview: number;
  timemodified: number;
  completionsubmit: number;
  showavailable: number;
}

/**
 * Represents a single option in a Choice activity.
 * Maps to the 'choice_options' database table from public/mod/choice/db/install.xml
 */
export interface ChoiceOption {
  id: number;
  choiceid: number;
  text: string;
  maxanswers: number;
  timemodified: number;
}

/**
 * Represents a user's response to a Choice activity.
 * Maps to the 'choice_answers' database table from public/mod/choice/db/install.xml
 */
export interface ChoiceResponse {
  id: number;
  choiceid: number;
  userid: number;
  optionid: number;
  timemodified: number;
}

/**
 * Represents aggregated result data for a single option.
 * Used in API responses to display voting results.
 */
export interface OptionResult {
  optionid: number;
  text: string;
  count: number;
  percentage: number;
  maxanswers: number;
  userids: number[];
  usernames?: string[];
}

/**
 * Represents complete results data for a Choice activity.
 * Used in API responses for displaying all voting results.
 */
export interface ChoiceResults {
  choiceid: number;
  totalresponses: number;
  options: OptionResult[];
  publish: number;
  showresults: number;
  allowmultiple: boolean;
}

/**
 * User interface matching ChoiceResults component expectations.
 * Represents a user who responded to a choice activity.
 * 
 * Based on User interface from react-frontend/src/features/activities/choice/components/ChoiceResults.tsx
 */
export interface ChoiceUser {
  /** User ID */
  id: number;
  /** User's first name */
  firstname: string;
  /** User's last name */
  lastname: string;
  /** Alt text for user profile picture */
  imagealt: string;
  /** User profile picture URL or identifier */
  picture: string;
  /** Answer/response ID for this user's choice */
  answerid: number;
}

/**
 * Option result data matching ChoiceResults component expectations.
 * Contains the option text, users who selected it, and limit information.
 * 
 * Based on OptionResult interface from react-frontend/src/features/activities/choice/components/ChoiceResults.tsx
 */
export interface ChoiceOptionResult {
  /** Display text for the option */
  text: string;
  /** Array of users who selected this option */
  user: ChoiceUser[];
  /** Maximum number of answers allowed for this option (0 = unlimited) */
  maxanswer: number;
  /** Number of users who selected this option */
  numberofuser?: number;
}

/**
 * Extended results data structure matching ChoiceResults component props.
 * Contains all information needed to render the results component.
 * 
 * Based on ChoiceResultsDataExtended interface from react-frontend/src/features/activities/choice/components/ChoiceResults.tsx
 */
export interface ChoiceResultsDataExtended {
  /** Name of the choice activity */
  name: string;
  /** Whether to publish names (true) or show anonymous results (false) */
  publish: boolean;
  /** Map of option ID to option result data */
  options: { [optionid: number]: ChoiceOptionResult };
  /** Whether to show "Not answered" column */
  showunanswered: boolean;
  /** Whether answer limits are enabled */
  limitanswers: boolean;
  /** Whether to show available spaces */
  showavailable: boolean;
  /** Whether current user can view responses */
  viewresponsecapability: boolean;
  /** Whether current user can delete responses */
  deleterepsonsecapability: boolean;
  /** Course module ID for the choice activity */
  coursemoduleid: number;
  /** Total number of users who participated */
  numberofuser?: number;
  /** Course ID for user profile links */
  courseid?: number;
}

/**
 * Factory function to create a mock Choice activity instance.
 * 
 * Generates a realistic Choice entity with all database fields populated
 * with sensible defaults. Supports partial overrides for customization.
 * 
 * @param overrides - Partial Choice object to override default values
 * @returns Complete Choice object with all required fields
 * 
 * @example
 * // Create a basic single-choice activity
 * const choice = createMockChoice();
 * 
 * @example
 * // Create a multiple-choice activity with time restrictions
 * const choice = createMockChoice({
 *   name: 'Favorite Programming Language',
 *   allowmultiple: 1,
 *   timeopen: Date.now() / 1000,
 *   timeclose: (Date.now() / 1000) + 86400
 * });
 */
export function createMockChoice(overrides: Partial<Choice> = {}): Choice {
  const now = Math.floor(Date.now() / 1000);
  
  return {
    id: 1,
    course: 101,
    name: 'Sample Choice Activity',
    intro: '<p>Please select your preferred option from the choices below.</p>',
    introformat: 1, // FORMAT_HTML
    publish: CHOICE_PUBLISH_ANONYMOUS,
    showresults: CHOICE_SHOWRESULTS_AFTER_ANSWER,
    display: CHOICE_DISPLAY_VERTICAL,
    allowupdate: 0,
    allowmultiple: 0,
    showunanswered: 0,
    includeinactive: 1,
    limitanswers: 0,
    timeopen: 0,
    timeclose: 0,
    showpreview: 0,
    timemodified: now,
    completionsubmit: 0,
    showavailable: 0,
    ...overrides,
  };
}

/**
 * Factory function to create a mock Choice option.
 * 
 * Generates a realistic choice option with database fields populated.
 * Useful for testing option display, selection, and result aggregation.
 * 
 * @param overrides - Partial ChoiceOption object to override default values
 * @returns Complete ChoiceOption object with all required fields
 * 
 * @example
 * // Create a basic option
 * const option = createMockChoiceOption({ text: 'Option A' });
 * 
 * @example
 * // Create a limited option (max 10 responses)
 * const option = createMockChoiceOption({
 *   text: 'Limited seats workshop',
 *   maxanswers: 10
 * });
 */
export function createMockChoiceOption(overrides: Partial<ChoiceOption> = {}): ChoiceOption {
  const now = Math.floor(Date.now() / 1000);
  
  return {
    id: 1,
    choiceid: 1,
    text: 'Option 1',
    maxanswers: 0,
    timemodified: now,
    ...overrides,
  };
}

/**
 * Factory function to create a mock user response to a Choice activity.
 * 
 * Generates a realistic choice answer record representing a user's selection.
 * Used for testing submission, update, and result calculation scenarios.
 * 
 * @param overrides - Partial ChoiceResponse object to override default values
 * @returns Complete ChoiceResponse object with all required fields
 * 
 * @example
 * // Create a user's response
 * const response = createMockChoiceResponse({
 *   userid: 42,
 *   optionid: 3
 * });
 */
export function createMockChoiceResponse(overrides: Partial<ChoiceResponse> = {}): ChoiceResponse {
  const now = Math.floor(Date.now() / 1000);
  
  return {
    id: 1,
    choiceid: 1,
    userid: 1,
    optionid: 1,
    timemodified: now,
    ...overrides,
  };
}

/**
 * Factory function to create a mock result for a single option.
 * 
 * Generates aggregated result data showing response counts, percentages,
 * and user information for a specific choice option. Used in result displays.
 * 
 * @param overrides - Partial OptionResult object to override default values
 * @returns Complete OptionResult object with all required fields
 * 
 * @example
 * // Create results for an option with 5 votes
 * const result = createMockOptionResult({
 *   text: 'Red',
 *   count: 5,
 *   percentage: 50.0,
 *   userids: [1, 2, 3, 4, 5]
 * });
 * 
 * @example
 * // Create results with named users
 * const result = createMockOptionResult({
 *   text: 'Blue',
 *   count: 3,
 *   percentage: 30.0,
 *   userids: [6, 7, 8],
 *   usernames: ['Alice', 'Bob', 'Charlie']
 * });
 */
export function createMockOptionResult(overrides: Partial<OptionResult> = {}): OptionResult {
  return {
    optionid: 1,
    text: 'Option 1',
    count: 0,
    percentage: 0,
    maxanswers: 0,
    userids: [],
    ...overrides,
  };
}

/**
 * Factory function to create complete mock results for a Choice activity.
 * 
 * Generates aggregated results data including all options, response counts,
 * and calculated percentages. Used for testing result display components.
 * 
 * @param overrides - Partial ChoiceResults object to override default values
 * @returns Complete ChoiceResults object with all required fields
 * 
 * @example
 * // Create basic results with two options
 * const results = createMockChoiceResults({
 *   totalresponses: 10,
 *   options: [
 *     createMockOptionResult({ optionid: 1, text: 'Yes', count: 7, percentage: 70 }),
 *     createMockOptionResult({ optionid: 2, text: 'No', count: 3, percentage: 30 })
 *   ]
 * });
 */
export function createMockChoiceResults(overrides: Partial<ChoiceResults> = {}): ChoiceResults {
  return {
    choiceid: 1,
    totalresponses: 0,
    options: [],
    publish: CHOICE_PUBLISH_ANONYMOUS,
    showresults: CHOICE_SHOWRESULTS_AFTER_ANSWER,
    allowmultiple: false,
    ...overrides,
  };
}

/**
 * Factory function to create a mock user for choice results.
 * 
 * Generates a realistic user object with all fields needed for displaying
 * user responses in the ChoiceResults component.
 * 
 * @param overrides - Partial ChoiceUser object to override default values
 * @returns Complete ChoiceUser object with all required fields
 * 
 * @example
 * const user = createMockChoiceUser({ firstname: 'John', lastname: 'Doe' });
 */
export function createMockChoiceUser(overrides: Partial<ChoiceUser> = {}): ChoiceUser {
  const id = overrides.id ?? 1;
  return {
    id,
    firstname: 'Test',
    lastname: 'User',
    imagealt: 'Test User',
    picture: 'https://example.com/avatar.jpg',
    answerid: 1,
    ...overrides,
  };
}

/**
 * Factory function to create a mock option result for ChoiceResults component.
 * 
 * Generates an option result with users and response data matching the
 * structure expected by the ChoiceResults component.
 * 
 * @param overrides - Partial ChoiceOptionResult object to override default values
 * @returns Complete ChoiceOptionResult object with all required fields
 * 
 * @example
 * const option = createMockChoiceOptionResult({
 *   text: 'Option A',
 *   user: [createMockChoiceUser({ firstname: 'Alice' })],
 *   numberofuser: 1
 * });
 */
export function createMockChoiceOptionResult(
  overrides: Partial<ChoiceOptionResult> = {}
): ChoiceOptionResult {
  return {
    text: 'Option',
    user: [],
    maxanswer: 0,
    numberofuser: 0,
    ...overrides,
  };
}

/**
 * Factory function to create complete mock results data for ChoiceResults component.
 * 
 * Generates the complete data structure expected by the ChoiceResults component,
 * including all required fields and sensible defaults for testing.
 * 
 * @param overrides - Partial ChoiceResultsDataExtended object to override default values
 * @returns Complete ChoiceResultsDataExtended object with all required fields
 * 
 * @example
 * // Create basic results with two options
 * const results = createMockChoiceResultsDataExtended({
 *   name: 'Test Choice',
 *   publish: true,
 *   options: {
 *     1: createMockChoiceOptionResult({ text: 'Yes', numberofuser: 5 }),
 *     2: createMockChoiceOptionResult({ text: 'No', numberofuser: 3 })
 *   }
 * });
 * 
 * @example
 * // Create results with users
 * const results = createMockChoiceResultsDataExtended({
 *   name: 'Survey',
 *   publish: true,
 *   options: {
 *     1: createMockChoiceOptionResult({
 *       text: 'Option A',
 *       user: [
 *         createMockChoiceUser({ id: 1, firstname: 'Alice' }),
 *         createMockChoiceUser({ id: 2, firstname: 'Bob' })
 *       ],
 *       numberofuser: 2
 *     })
 *   }
 * });
 */
export function createMockChoiceResultsDataExtended(
  overrides: Partial<ChoiceResultsDataExtended> = {}
): ChoiceResultsDataExtended {
  return {
    name: 'Test Choice Activity',
    publish: false,
    options: {},
    showunanswered: false,
    limitanswers: false,
    showavailable: false,
    viewresponsecapability: true,
    deleterepsonsecapability: true,
    coursemoduleid: 1,
    numberofuser: 0,
    courseid: 1,
    ...overrides,
  };
}

/**
 * Preset fixture: Single-choice activity with anonymous results.
 * 
 * Represents a standard single-selection choice where results are anonymous
 * and shown after the user answers.
 */
export const singleChoiceFixture: Choice = createMockChoice({
  id: 100,
  name: 'Choose Your Favorite Color',
  intro: '<p>Select one color that you prefer.</p>',
  allowmultiple: 0,
  publish: CHOICE_PUBLISH_ANONYMOUS,
  showresults: CHOICE_SHOWRESULTS_AFTER_ANSWER,
  allowupdate: 1,
});

/**
 * Preset fixture: Multiple-choice activity allowing multiple selections.
 * 
 * Represents a choice where users can select multiple options simultaneously.
 */
export const multipleChoiceFixture: Choice = createMockChoice({
  id: 101,
  name: 'Select Your Interests',
  intro: '<p>You may select multiple options.</p>',
  allowmultiple: 1,
  publish: CHOICE_PUBLISH_ANONYMOUS,
  showresults: CHOICE_SHOWRESULTS_AFTER_ANSWER,
  allowupdate: 1,
});

/**
 * Preset fixture: Choice with limited seats per option.
 * 
 * Represents a choice where each option has a maximum number of responses,
 * useful for workshop enrollment or resource booking scenarios.
 */
export const limitedOptionsFixture: Choice = createMockChoice({
  id: 102,
  name: 'Workshop Registration',
  intro: '<p>Select your preferred workshop. Limited seats available.</p>',
  allowmultiple: 0,
  limitanswers: 1,
  showavailable: 1,
  publish: CHOICE_PUBLISH_NAMES,
  showresults: CHOICE_SHOWRESULTS_ALWAYS,
});

/**
 * Preset fixture: Time-restricted choice with open and close dates.
 * 
 * Represents a choice that is only available during a specific time window.
 */
export const timeRestrictedFixture: Choice = createMockChoice({
  id: 103,
  name: 'Weekly Poll',
  intro: '<p>This poll is only available this week.</p>',
  timeopen: Math.floor(Date.now() / 1000) - 86400, // Opened 1 day ago
  timeclose: Math.floor(Date.now() / 1000) + 518400, // Closes in 6 days
  showpreview: 1,
  publish: CHOICE_PUBLISH_ANONYMOUS,
  showresults: CHOICE_SHOWRESULTS_AFTER_CLOSE,
});

/**
 * Preset fixture: Choice with anonymous results shown always.
 * 
 * Represents a choice where results are always visible but usernames are hidden.
 */
export const anonymousResultsFixture: Choice = createMockChoice({
  id: 104,
  name: 'Anonymous Feedback',
  intro: '<p>Your vote is anonymous. Results are visible to all.</p>',
  publish: CHOICE_PUBLISH_ANONYMOUS,
  showresults: CHOICE_SHOWRESULTS_ALWAYS,
  allowupdate: 0,
});

/**
 * Preset fixture: Choice with named results shown after answering.
 * 
 * Represents a choice where participant names are visible in results
 * after they submit their response.
 */
export const namedResultsFixture: Choice = createMockChoice({
  id: 105,
  name: 'Team Preference Survey',
  intro: '<p>Your name will be visible with your choice.</p>',
  publish: CHOICE_PUBLISH_NAMES,
  showresults: CHOICE_SHOWRESULTS_AFTER_ANSWER,
  allowupdate: 1,
  showunanswered: 1,
});

/**
 * Preset fixture: Common set of choice options.
 * 
 * Standard options that can be used across multiple test scenarios.
 */
export const commonOptionsFixture: ChoiceOption[] = [
  createMockChoiceOption({
    id: 1,
    choiceid: 1,
    text: 'Red',
    maxanswers: 0,
  }),
  createMockChoiceOption({
    id: 2,
    choiceid: 1,
    text: 'Blue',
    maxanswers: 0,
  }),
  createMockChoiceOption({
    id: 3,
    choiceid: 1,
    text: 'Green',
    maxanswers: 0,
  }),
  createMockChoiceOption({
    id: 4,
    choiceid: 1,
    text: 'Yellow',
    maxanswers: 0,
  }),
];

/**
 * Preset fixture: Limited capacity options for workshop scenarios.
 * 
 * Options with maxanswers set to simulate limited availability.
 */
export const limitedCapacityOptionsFixture: ChoiceOption[] = [
  createMockChoiceOption({
    id: 10,
    choiceid: 102,
    text: 'Morning Workshop (9:00 AM)',
    maxanswers: 15,
  }),
  createMockChoiceOption({
    id: 11,
    choiceid: 102,
    text: 'Afternoon Workshop (2:00 PM)',
    maxanswers: 20,
  }),
  createMockChoiceOption({
    id: 12,
    choiceid: 102,
    text: 'Evening Workshop (6:00 PM)',
    maxanswers: 10,
  }),
];

/**
 * Preset fixture: Sample user responses for testing result calculations.
 * 
 * Includes multiple responses from different users to various options.
 */
export const sampleResponsesFixture: ChoiceResponse[] = [
  createMockChoiceResponse({
    id: 1,
    choiceid: 1,
    userid: 10,
    optionid: 1,
  }),
  createMockChoiceResponse({
    id: 2,
    choiceid: 1,
    userid: 11,
    optionid: 1,
  }),
  createMockChoiceResponse({
    id: 3,
    choiceid: 1,
    userid: 12,
    optionid: 2,
  }),
  createMockChoiceResponse({
    id: 4,
    choiceid: 1,
    userid: 13,
    optionid: 3,
  }),
  createMockChoiceResponse({
    id: 5,
    choiceid: 1,
    userid: 14,
    optionid: 1,
  }),
];

/**
 * Preset fixture: Sample results data with calculated percentages.
 * 
 * Represents aggregated results from multiple user responses.
 */
export const sampleResultsFixture: ChoiceResults = createMockChoiceResults({
  choiceid: 1,
  totalresponses: 10,
  publish: CHOICE_PUBLISH_ANONYMOUS,
  showresults: CHOICE_SHOWRESULTS_AFTER_ANSWER,
  allowmultiple: false,
  options: [
    createMockOptionResult({
      optionid: 1,
      text: 'Red',
      count: 5,
      percentage: 50.0,
      maxanswers: 0,
      userids: [10, 11, 14, 15, 16],
    }),
    createMockOptionResult({
      optionid: 2,
      text: 'Blue',
      count: 3,
      percentage: 30.0,
      maxanswers: 0,
      userids: [12, 17, 18],
    }),
    createMockOptionResult({
      optionid: 3,
      text: 'Green',
      count: 2,
      percentage: 20.0,
      maxanswers: 0,
      userids: [13, 19],
    }),
  ],
});

/**
 * Preset fixture: Named results showing user information.
 * 
 * Results data that includes usernames for testing named result displays.
 */
export const namedResultsDataFixture: ChoiceResults = createMockChoiceResults({
  choiceid: 105,
  totalresponses: 8,
  publish: CHOICE_PUBLISH_NAMES,
  showresults: CHOICE_SHOWRESULTS_AFTER_ANSWER,
  allowmultiple: false,
  options: [
    createMockOptionResult({
      optionid: 1,
      text: 'Team A',
      count: 4,
      percentage: 50.0,
      maxanswers: 0,
      userids: [20, 21, 22, 23],
      usernames: ['Alice Johnson', 'Bob Smith', 'Carol Davis', 'David Wilson'],
    }),
    createMockOptionResult({
      optionid: 2,
      text: 'Team B',
      count: 3,
      percentage: 37.5,
      maxanswers: 0,
      userids: [24, 25, 26],
      usernames: ['Emma Brown', 'Frank Miller', 'Grace Lee'],
    }),
    createMockOptionResult({
      optionid: 3,
      text: 'Team C',
      count: 1,
      percentage: 12.5,
      maxanswers: 0,
      userids: [27],
      usernames: ['Henry Garcia'],
    }),
  ],
});
