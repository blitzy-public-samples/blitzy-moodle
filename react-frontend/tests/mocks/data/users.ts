/**
 * Mock User Data Generators
 * 
 * Factory functions for creating realistic Moodle user entities for testing.
 * Provides mockUser(), mockStudent(), mockTeacher(), mockAdmin() with sensible defaults
 * for all user properties including profile information, authentication details, and
 * customizable overrides.
 * 
 * All generated mock data matches the User interface structure and includes realistic
 * timestamps, authentication settings, and localization preferences based on actual
 * Moodle user data patterns.
 * 
 * @module tests/mocks/data/users
 * @see react-frontend/src/types/entities.ts - User interface definition
 * @see public/user/lib.php - Moodle user management reference
 */

import type { User } from '@/types/entities';
import type { Timezone } from '@/types/common';

// ============================================================================
// Utility Types
// ============================================================================

/**
 * DeepPartial utility type for nested partial objects
 * Allows partial overrides of nested properties in User interface
 */
type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object
    ? T[P] extends Array<infer U>
      ? Array<DeepPartial<U>>
      : DeepPartial<T[P]>
    : T[P];
};

// ============================================================================
// ID and Timestamp Generation
// ============================================================================

/**
 * Counter for generating sequential user IDs
 */
let userIdCounter = 1;

/**
 * Generates a unique sequential user ID
 * 
 * @returns {number} Sequential user ID starting from 1
 * 
 * @example
 * const id1 = generateUserId(); // 1
 * const id2 = generateUserId(); // 2
 */
export function generateUserId(): number {
  return userIdCounter++;
}

/**
 * Generates a realistic Unix timestamp
 * 
 * @param {number} [daysAgo=0] - Number of days in the past (0 = now)
 * @returns {number} Unix timestamp in seconds
 * 
 * @example
 * const now = generateTimestamp();
 * const lastWeek = generateTimestamp(7);
 * const lastMonth = generateTimestamp(30);
 */
export function generateTimestamp(daysAgo: number = 0): number {
  const now = Date.now();
  const daysInMs = daysAgo * 24 * 60 * 60 * 1000;
  return Math.floor((now - daysInMs) / 1000);
}

// ============================================================================
// Base Mock User Factory
// ============================================================================

/**
 * Creates a mock Moodle user with realistic default values
 * 
 * Generates a complete User object with all required and optional fields populated
 * with sensible defaults matching actual Moodle user data. Accepts partial overrides
 * for customization in specific test scenarios.
 * 
 * Default values based on Moodle user table schema and common patterns:
 * - Authentication: 'manual' (local Moodle accounts)
 * - Language: 'en' (English)
 * - Country: 'US' (United States)
 * - Timezone: 'UTC'
 * - Timestamps: Realistic dates (created 90 days ago, last access today)
 * - Status: Active, confirmed, non-suspended accounts
 * 
 * @param {DeepPartial<User>} [overrides={}] - Partial user properties to override defaults
 * @returns {User} Complete user object with all fields populated
 * 
 * @example
 * // Basic user with all defaults
 * const user = mockUser();
 * 
 * @example
 * // Custom user with overrides
 * const customUser = mockUser({
 *   id: 123,
 *   username: 'johndoe',
 *   email: 'john@example.com',
 *   firstname: 'John',
 *   lastname: 'Doe'
 * });
 * 
 * @example
 * // Suspended user
 * const suspendedUser = mockUser({
 *   suspended: true,
 *   confirmed: false
 * });
 */
export function mockUser(overrides: DeepPartial<User> = {}): User {
  const id = overrides.id ?? 1;
  const username = overrides.username ?? 'testuser';
  const firstname = overrides.firstname ?? 'Test';
  const lastname = overrides.lastname ?? 'User';
  const fullname = overrides.fullname ?? `${firstname} ${lastname}`;
  
  // Generate realistic timestamps
  const timecreated = overrides.timecreated ?? generateTimestamp(90); // Created 90 days ago
  const timemodified = overrides.timemodified ?? generateTimestamp(1); // Modified yesterday
  const firstaccess = overrides.firstaccess ?? generateTimestamp(85); // First access 85 days ago
  const lastaccess = overrides.lastaccess ?? generateTimestamp(0); // Last access today
  const lastlogin = overrides.lastlogin ?? generateTimestamp(1); // Last login yesterday
  const currentlogin = overrides.currentlogin ?? generateTimestamp(0); // Current login today

  return {
    // Identity fields
    id,
    username,
    firstname,
    lastname,
    fullname,
    email: overrides.email ?? `${username}@example.com`,
    
    // Communication preferences
    emailstop: overrides.emailstop ?? false,
    phone1: overrides.phone1 ?? '',
    phone2: overrides.phone2 ?? '',
    
    // Institutional information
    institution: overrides.institution ?? 'Test University',
    department: overrides.department ?? 'Computer Science',
    address: overrides.address ?? '',
    city: overrides.city ?? '',
    
    // Localization settings
    country: overrides.country ?? 'US',
    lang: overrides.lang ?? 'en',
    timezone: (overrides.timezone ?? 'UTC'),
    
    // Access timestamps
    firstaccess,
    lastaccess,
    lastlogin,
    currentlogin,
    
    // Profile picture
    picture: overrides.picture ?? '0',
    imagealt: overrides.imagealt ?? '',
    profileimageurl: overrides.profileimageurl ?? 'https://www.gravatar.com/avatar/default?s=200&d=mp',
    profileimageurlsmall: overrides.profileimageurlsmall ?? 'https://www.gravatar.com/avatar/default?s=35&d=mp',
    
    // Account status
    suspended: overrides.suspended ?? false,
    confirmed: overrides.confirmed ?? true,
    deleted: overrides.deleted ?? false,
    
    // Authentication
    auth: overrides.auth ?? 'manual',
    
    // Theme and preferences
    theme: overrides.theme ?? '',
    calendartype: overrides.calendartype ?? 'gregorian',
    
    // Profile description
    description: overrides.description ?? '',
    descriptionformat: overrides.descriptionformat ?? 1, // HTML format
    
    // Email preferences
    mailformat: overrides.mailformat ?? 1, // HTML email
    maildigest: overrides.maildigest ?? 0, // No digest
    maildisplay: overrides.maildisplay ?? 2, // Show to all users
    
    // Forum preferences
    autosubscribe: overrides.autosubscribe ?? true,
    trackforums: overrides.trackforums ?? true,
    
    // Timestamps
    timecreated,
    timemodified,
    
    // Trust and security
    trustbitmask: overrides.trustbitmask ?? 0,
    
    // User preferences (optional)
    preferences: overrides.preferences ?? {},
    
    // Custom profile fields (optional)
    customfields: overrides.customfields ?? [],
    
    // User roles (optional)
    roles: overrides.roles ?? [],
  };
}

// ============================================================================
// Role-Specific Mock User Factories
// ============================================================================

/**
 * Creates a mock student user with student-specific defaults
 * 
 * Generates a user with typical student profile settings including
 * institution, department, and naming conventions common for student accounts.
 * 
 * @param {DeepPartial<User>} [overrides={}] - Partial user properties to override defaults
 * @returns {User} Complete student user object
 * 
 * @example
 * // Basic student
 * const student = mockStudent();
 * 
 * @example
 * // Custom student with specific course enrollment
 * const studentInCourse = mockStudent({
 *   id: 200,
 *   username: 'alice.smith',
 *   firstname: 'Alice',
 *   lastname: 'Smith'
 * });
 */
export function mockStudent(overrides: DeepPartial<User> = {}): User {
  return mockUser({
    username: 'student1',
    firstname: 'Student',
    lastname: 'User',
    fullname: 'Student User',
    email: 'student@example.com',
    institution: 'Test School',
    department: 'Undergraduate Studies',
    roles: [
      {
        id: 5,
        name: 'Student',
        shortname: 'student',
        description: 'Students have minimal privileges',
        sortorder: 5,
        archetype: 'student',
      },
    ],
    ...overrides,
  });
}

/**
 * Creates a mock teacher user with teacher-specific defaults
 * 
 * Generates a user with typical teacher/instructor profile settings including
 * teaching department and naming conventions common for teacher accounts.
 * 
 * @param {DeepPartial<User>} [overrides={}] - Partial user properties to override defaults
 * @returns {User} Complete teacher user object
 * 
 * @example
 * // Basic teacher
 * const teacher = mockTeacher();
 * 
 * @example
 * // Custom teacher with specific details
 * const customTeacher = mockTeacher({
 *   id: 300,
 *   username: 'prof.jones',
 *   firstname: 'Robert',
 *   lastname: 'Jones',
 *   department: 'Mathematics'
 * });
 */
export function mockTeacher(overrides: DeepPartial<User> = {}): User {
  return mockUser({
    username: 'teacher1',
    firstname: 'Teacher',
    lastname: 'User',
    fullname: 'Teacher User',
    email: 'teacher@example.com',
    institution: 'Test School',
    department: 'Education',
    roles: [
      {
        id: 3,
        name: 'Teacher',
        shortname: 'editingteacher',
        description: 'Teachers can do anything within a course',
        sortorder: 3,
        archetype: 'editingteacher',
      },
    ],
    ...overrides,
  });
}

/**
 * Creates a mock admin user with administrator-specific defaults
 * 
 * Generates a user with typical administrator profile settings including
 * administrative department and naming conventions common for admin accounts.
 * 
 * @param {DeepPartial<User>} [overrides={}] - Partial user properties to override defaults
 * @returns {User} Complete admin user object
 * 
 * @example
 * // Basic admin
 * const admin = mockAdmin();
 * 
 * @example
 * // Custom admin with specific details
 * const siteAdmin = mockAdmin({
 *   id: 2,
 *   username: 'sysadmin',
 *   firstname: 'System',
 *   lastname: 'Administrator'
 * });
 */
export function mockAdmin(overrides: DeepPartial<User> = {}): User {
  return mockUser({
    username: 'admin',
    firstname: 'Admin',
    lastname: 'User',
    fullname: 'Admin User',
    email: 'admin@example.com',
    institution: 'Test School',
    department: 'Administration',
    roles: [
      {
        id: 1,
        name: 'Administrator',
        shortname: 'admin',
        description: 'Administrators can do anything on the site',
        sortorder: 1,
        archetype: 'manager',
      },
    ],
    ...overrides,
  });
}

// ============================================================================
// Bulk User Generation
// ============================================================================

/**
 * Creates an array of mock users with unique IDs and usernames
 * 
 * Generates multiple user objects for testing list views, pagination,
 * and bulk operations. Each user has a unique ID, username, and email
 * based on the index in the array.
 * 
 * @param {number} count - Number of users to generate
 * @param {DeepPartial<User>} [baseOverrides={}] - Base properties to apply to all users
 * @returns {User[]} Array of complete user objects
 * 
 * @example
 * // Generate 10 users
 * const users = mockUserArray(10);
 * 
 * @example
 * // Generate 5 students from same institution
 * const students = mockUserArray(5, {
 *   institution: 'Harvard University',
 *   department: 'Engineering',
 *   roles: [{
 *     id: 5,
 *     name: 'Student',
 *     shortname: 'student',
 *     archetype: 'student'
 *   }]
 * });
 * 
 * @example
 * // Generate users for pagination testing
 * const page1 = mockUserArray(20); // First page
 * const page2 = mockUserArray(20, { id: 21 }); // Second page starting at ID 21
 */
export function mockUserArray(
  count: number,
  baseOverrides: DeepPartial<User> = {}
): User[] {
  const users: User[] = [];
  
  for (let i = 0; i < count; i++) {
    const userId = generateUserId();
    const username = `user${userId}`;
    
    users.push(
      mockUser({
        ...baseOverrides,
        id: userId,
        username,
        email: `${username}@example.com`,
        firstname: `User`,
        lastname: `${userId}`,
        fullname: `User ${userId}`,
      })
    );
  }
  
  return users;
}
