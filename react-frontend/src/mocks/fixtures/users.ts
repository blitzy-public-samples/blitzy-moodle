/**
 * E2E Test Fixtures - User Data
 * 
 * Provides predefined test user objects with complete profile information for different roles.
 * Used across authentication, profile, messaging, enrollment, and admin user management tests.
 * 
 * @module tests/e2e/fixtures/users
 */

/**
 * User role constants matching Moodle role system
 */
export const ROLE_STUDENT = 'student';
export const ROLE_TEACHER = 'teacher';
export const ROLE_EDITINGTEACHER = 'editingteacher';
export const ROLE_COURSECREATOR = 'coursecreator';
export const ROLE_MANAGER = 'manager';
export const ROLE_ADMIN = 'admin';

/**
 * Shared test password for all fixtures
 * In real testing environment, this would be configured via environment variables
 */
export const TEST_PASSWORD = 'TestPassword123!';

/**
 * User interface matching Moodle user API structure
 * Represents a complete user object as returned by Moodle API endpoints
 */
export interface User {
  /** Unique user identifier */
  id: number;
  /** Username for login */
  username: string;
  /** User's first name */
  firstname: string;
  /** User's last name */
  lastname: string;
  /** User's email address */
  email: string;
  /** Authentication method (manual, ldap, oauth2, etc.) */
  auth: string;
  /** Whether user has confirmed their email address */
  confirmed: boolean;
  /** Whether user account is suspended */
  suspended: boolean;
  /** Whether user account is deleted */
  deleted?: boolean;
  /** Array of role assignments */
  roles: Array<{
    /** Role identifier */
    roleid: number;
    /** Role short name */
    shortname: string;
    /** Role display name */
    name: string;
  }>;
  /** User preferences */
  preferences: {
    /** User's preferred language */
    lang?: string;
    /** Email digest type */
    maildigest?: number;
    /** Email format (0=plain text, 1=HTML) */
    mailformat?: number;
    /** Auto-subscribe to forums */
    autosubscribe?: boolean;
    /** Track forum read status */
    trackforums?: boolean;
    /** Theme preference */
    theme?: string;
  };
  /** Unix timestamp of last access */
  lastaccess: number;
  /** URL to user's profile image */
  profileimageurl: string;
  /** Unix timestamp of account creation */
  timecreated?: number;
  /** Unix timestamp of last modification */
  timemodified?: number;
  /** User's full name (computed) */
  fullname?: string;
  /** User's department */
  department?: string;
  /** User's institution */
  institution?: string;
  /** User's city */
  city?: string;
  /** User's country code */
  country?: string;
  /** User's timezone */
  timezone?: string;
  /** User's description/bio */
  description?: string;
}

/**
 * Test student user fixture
 * Standard student account with basic permissions
 */
export const testStudent: User = {
  id: 1001,
  username: 'student1',
  firstname: 'John',
  lastname: 'Student',
  email: 'student1@example.com',
  auth: 'manual',
  confirmed: true,
  suspended: false,
  roles: [
    {
      roleid: 5,
      shortname: ROLE_STUDENT,
      name: 'Student'
    }
  ],
  preferences: {
    lang: 'en',
    maildigest: 0,
    mailformat: 1,
    autosubscribe: true,
    trackforums: true,
    theme: 'boost'
  },
  lastaccess: Date.now() - 3600000, // 1 hour ago
  profileimageurl: 'https://www.gravatar.com/avatar/student1?d=mm&s=100',
  timecreated: Date.now() - 86400000 * 30, // 30 days ago
  timemodified: Date.now() - 3600000,
  fullname: 'John Student',
  department: 'Computer Science',
  institution: 'Test University',
  city: 'San Francisco',
  country: 'US',
  timezone: 'America/Los_Angeles',
  description: 'Test student account for E2E testing'
};

/**
 * Second test student user fixture
 * Used for multi-user scenario testing (enrollment, messaging, collaboration)
 */
export const testStudent2: User = {
  id: 1002,
  username: 'student2',
  firstname: 'Jane',
  lastname: 'Smith',
  email: 'student2@example.com',
  auth: 'manual',
  confirmed: true,
  suspended: false,
  roles: [
    {
      roleid: 5,
      shortname: ROLE_STUDENT,
      name: 'Student'
    }
  ],
  preferences: {
    lang: 'en',
    maildigest: 0,
    mailformat: 1,
    autosubscribe: true,
    trackforums: true,
    theme: 'boost'
  },
  lastaccess: Date.now() - 7200000, // 2 hours ago
  profileimageurl: 'https://www.gravatar.com/avatar/student2?d=mm&s=100',
  timecreated: Date.now() - 86400000 * 45, // 45 days ago
  timemodified: Date.now() - 7200000,
  fullname: 'Jane Smith',
  department: 'Mathematics',
  institution: 'Test University',
  city: 'New York',
  country: 'US',
  timezone: 'America/New_York',
  description: 'Second test student account for multi-user testing'
};

/**
 * Third test student user fixture
 * Additional student for complex multi-user scenarios
 */
export const testStudent3: User = {
  id: 1003,
  username: 'student3',
  firstname: 'Michael',
  lastname: 'Johnson',
  email: 'student3@example.com',
  auth: 'manual',
  confirmed: true,
  suspended: false,
  roles: [
    {
      roleid: 5,
      shortname: ROLE_STUDENT,
      name: 'Student'
    }
  ],
  preferences: {
    lang: 'en',
    maildigest: 0,
    mailformat: 1,
    autosubscribe: false,
    trackforums: false,
    theme: 'classic'
  },
  lastaccess: Date.now() - 10800000, // 3 hours ago
  profileimageurl: 'https://www.gravatar.com/avatar/student3?d=mm&s=100',
  timecreated: Date.now() - 86400000 * 60, // 60 days ago
  timemodified: Date.now() - 10800000,
  fullname: 'Michael Johnson',
  department: 'Physics',
  institution: 'Test University',
  city: 'Boston',
  country: 'US',
  timezone: 'America/New_York',
  description: 'Third test student account for group scenarios'
};

/**
 * Test teacher user fixture (non-editing)
 * Teacher role with viewing and grading permissions but not editing content
 */
export const testTeacher: User = {
  id: 2001,
  username: 'teacher1',
  firstname: 'Sarah',
  lastname: 'Teacher',
  email: 'teacher1@example.com',
  auth: 'manual',
  confirmed: true,
  suspended: false,
  roles: [
    {
      roleid: 4,
      shortname: ROLE_TEACHER,
      name: 'Non-editing teacher'
    }
  ],
  preferences: {
    lang: 'en',
    maildigest: 1,
    mailformat: 1,
    autosubscribe: true,
    trackforums: true,
    theme: 'boost'
  },
  lastaccess: Date.now() - 1800000, // 30 minutes ago
  profileimageurl: 'https://www.gravatar.com/avatar/teacher1?d=mm&s=100',
  timecreated: Date.now() - 86400000 * 180, // 180 days ago
  timemodified: Date.now() - 1800000,
  fullname: 'Sarah Teacher',
  department: 'Education',
  institution: 'Test University',
  city: 'Chicago',
  country: 'US',
  timezone: 'America/Chicago',
  description: 'Non-editing teacher account for E2E testing'
};

/**
 * Test editing teacher user fixture
 * Teacher role with full content creation and editing permissions
 */
export const testEditingTeacher: User = {
  id: 2002,
  username: 'editingteacher1',
  firstname: 'David',
  lastname: 'Professor',
  email: 'editingteacher1@example.com',
  auth: 'manual',
  confirmed: true,
  suspended: false,
  roles: [
    {
      roleid: 3,
      shortname: ROLE_EDITINGTEACHER,
      name: 'Teacher'
    }
  ],
  preferences: {
    lang: 'en',
    maildigest: 2,
    mailformat: 1,
    autosubscribe: true,
    trackforums: true,
    theme: 'boost'
  },
  lastaccess: Date.now() - 900000, // 15 minutes ago
  profileimageurl: 'https://www.gravatar.com/avatar/editingteacher1?d=mm&s=100',
  timecreated: Date.now() - 86400000 * 365, // 365 days ago
  timemodified: Date.now() - 900000,
  fullname: 'David Professor',
  department: 'Engineering',
  institution: 'Test University',
  city: 'Seattle',
  country: 'US',
  timezone: 'America/Los_Angeles',
  description: 'Editing teacher account with full course management permissions'
};

/**
 * Test course creator user fixture
 * Role with permissions to create new courses
 */
export const testCourseCreator: User = {
  id: 3001,
  username: 'coursecreator1',
  firstname: 'Emily',
  lastname: 'Creator',
  email: 'coursecreator1@example.com',
  auth: 'manual',
  confirmed: true,
  suspended: false,
  roles: [
    {
      roleid: 2,
      shortname: ROLE_COURSECREATOR,
      name: 'Course creator'
    }
  ],
  preferences: {
    lang: 'en',
    maildigest: 0,
    mailformat: 1,
    autosubscribe: true,
    trackforums: true,
    theme: 'boost'
  },
  lastaccess: Date.now() - 600000, // 10 minutes ago
  profileimageurl: 'https://www.gravatar.com/avatar/coursecreator1?d=mm&s=100',
  timecreated: Date.now() - 86400000 * 200, // 200 days ago
  timemodified: Date.now() - 600000,
  fullname: 'Emily Creator',
  department: 'Academic Affairs',
  institution: 'Test University',
  city: 'Austin',
  country: 'US',
  timezone: 'America/Chicago',
  description: 'Course creator account for testing course creation workflows'
};

/**
 * Test manager user fixture
 * Manager role with site-wide course management permissions
 */
export const testManager: User = {
  id: 4001,
  username: 'manager1',
  firstname: 'Robert',
  lastname: 'Manager',
  email: 'manager1@example.com',
  auth: 'manual',
  confirmed: true,
  suspended: false,
  roles: [
    {
      roleid: 1,
      shortname: ROLE_MANAGER,
      name: 'Manager'
    }
  ],
  preferences: {
    lang: 'en',
    maildigest: 0,
    mailformat: 1,
    autosubscribe: false,
    trackforums: true,
    theme: 'boost'
  },
  lastaccess: Date.now() - 300000, // 5 minutes ago
  profileimageurl: 'https://www.gravatar.com/avatar/manager1?d=mm&s=100',
  timecreated: Date.now() - 86400000 * 400, // 400 days ago
  timemodified: Date.now() - 300000,
  fullname: 'Robert Manager',
  department: 'Administration',
  institution: 'Test University',
  city: 'Denver',
  country: 'US',
  timezone: 'America/Denver',
  description: 'Manager account with site-wide course management permissions'
};

/**
 * Test admin user fixture
 * Site administrator with full system permissions
 */
export const testAdmin: User = {
  id: 5001,
  username: 'admin',
  firstname: 'System',
  lastname: 'Administrator',
  email: 'admin@example.com',
  auth: 'manual',
  confirmed: true,
  suspended: false,
  roles: [
    {
      roleid: 0,
      shortname: ROLE_ADMIN,
      name: 'Administrator'
    }
  ],
  preferences: {
    lang: 'en',
    maildigest: 0,
    mailformat: 1,
    autosubscribe: false,
    trackforums: false,
    theme: 'boost'
  },
  lastaccess: Date.now() - 60000, // 1 minute ago
  profileimageurl: 'https://www.gravatar.com/avatar/admin?d=mm&s=100',
  timecreated: Date.now() - 86400000 * 730, // 730 days ago (2 years)
  timemodified: Date.now() - 60000,
  fullname: 'System Administrator',
  department: 'IT',
  institution: 'Test University',
  city: 'San Francisco',
  country: 'US',
  timezone: 'America/Los_Angeles',
  description: 'Site administrator account with full system access'
};

/**
 * Suspended user fixture for negative testing
 * Account that has been suspended and should not be able to log in
 */
export const suspendedUser: User = {
  id: 6001,
  username: 'suspended1',
  firstname: 'Suspended',
  lastname: 'User',
  email: 'suspended1@example.com',
  auth: 'manual',
  confirmed: true,
  suspended: true, // Account is suspended
  roles: [
    {
      roleid: 5,
      shortname: ROLE_STUDENT,
      name: 'Student'
    }
  ],
  preferences: {
    lang: 'en',
    maildigest: 0,
    mailformat: 1,
    autosubscribe: true,
    trackforums: true,
    theme: 'boost'
  },
  lastaccess: Date.now() - 86400000 * 7, // 7 days ago (before suspension)
  profileimageurl: 'https://www.gravatar.com/avatar/suspended1?d=mm&s=100',
  timecreated: Date.now() - 86400000 * 90, // 90 days ago
  timemodified: Date.now() - 86400000 * 7, // Suspended 7 days ago
  fullname: 'Suspended User',
  department: 'N/A',
  institution: 'Test University',
  city: 'Portland',
  country: 'US',
  timezone: 'America/Los_Angeles',
  description: 'Suspended user account for testing negative scenarios'
};

/**
 * Helper function to create a custom user object with default values
 * Useful for generating dynamic test users in tests that need unique data
 * 
 * @param overrides - Partial user object to override default values
 * @returns Complete user object with merged values
 */
export function createUser(overrides: Partial<User> = {}): User {
  const defaultUser: User = {
    id: Math.floor(Math.random() * 10000) + 7000,
    username: `testuser${Date.now()}`,
    firstname: 'Test',
    lastname: 'User',
    email: `testuser${Date.now()}@example.com`,
    auth: 'manual',
    confirmed: true,
    suspended: false,
    roles: [
      {
        roleid: 5,
        shortname: ROLE_STUDENT,
        name: 'Student'
      }
    ],
    preferences: {
      lang: 'en',
      maildigest: 0,
      mailformat: 1,
      autosubscribe: true,
      trackforums: true,
      theme: 'boost'
    },
    lastaccess: Date.now() - 3600000,
    profileimageurl: `https://www.gravatar.com/avatar/default?d=mm&s=100`,
    timecreated: Date.now() - 86400000 * 30,
    timemodified: Date.now() - 3600000,
    fullname: 'Test User',
    department: 'Test Department',
    institution: 'Test University',
    city: 'Test City',
    country: 'US',
    timezone: 'UTC',
    description: 'Dynamically created test user'
  };

  return {
    ...defaultUser,
    ...overrides,
    roles: overrides.roles || defaultUser.roles,
    preferences: {
      ...defaultUser.preferences,
      ...(overrides.preferences || {})
    }
  };
}

/**
 * Helper function to retrieve a user fixture by role
 * Useful for selecting test users dynamically based on permission requirements
 * 
 * @param role - Role shortname to retrieve user for
 * @returns User fixture for the specified role, or testStudent as fallback
 * @throws Error if role is not recognized
 */
export function getUserByRole(role: string): User {
  const roleMap: Record<string, User> = {
    [ROLE_STUDENT]: testStudent,
    [ROLE_TEACHER]: testTeacher,
    [ROLE_EDITINGTEACHER]: testEditingTeacher,
    [ROLE_COURSECREATOR]: testCourseCreator,
    [ROLE_MANAGER]: testManager,
    [ROLE_ADMIN]: testAdmin
  };

  const user = roleMap[role];
  
  if (!user) {
    throw new Error(
      `Invalid role: ${role}. Valid roles are: ${Object.keys(roleMap).join(', ')}`
    );
  }

  return user;
}

/**
 * Helper function to get all student fixtures
 * Returns array of all student user objects for batch testing
 * 
 * @returns Array of student user fixtures
 */
export function getAllStudents(): User[] {
  return [testStudent, testStudent2, testStudent3];
}

/**
 * Helper function to get all teacher fixtures
 * Returns array of all teacher user objects (editing and non-editing)
 * 
 * @returns Array of teacher user fixtures
 */
export function getAllTeachers(): User[] {
  return [testTeacher, testEditingTeacher];
}

/**
 * Helper function to get all administrative role fixtures
 * Returns array of users with administrative permissions
 * 
 * @returns Array of admin user fixtures
 */
export function getAllAdmins(): User[] {
  return [testCourseCreator, testManager, testAdmin];
}

/**
 * Helper function to get all user fixtures
 * Returns complete array of all predefined user fixtures
 * 
 * @param includeSuspended - Whether to include suspended user (default: false)
 * @returns Array of all user fixtures
 */
export function getAllUsers(includeSuspended = false): User[] {
  const users = [
    testStudent,
    testStudent2,
    testStudent3,
    testTeacher,
    testEditingTeacher,
    testCourseCreator,
    testManager,
    testAdmin
  ];

  if (includeSuspended) {
    users.push(suspendedUser);
  }

  return users;
}

/**
 * Type guard to check if a user has a specific role
 * 
 * @param user - User object to check
 * @param role - Role shortname to check for
 * @returns True if user has the specified role
 */
export function userHasRole(user: User, role: string): boolean {
  return user.roles.some(r => r.shortname === role);
}

/**
 * Helper function to check if a user is an admin (any administrative role)
 * 
 * @param user - User object to check
 * @returns True if user has admin, manager, or course creator role
 */
export function isAdmin(user: User): boolean {
  return userHasRole(user, ROLE_ADMIN) || 
         userHasRole(user, ROLE_MANAGER) || 
         userHasRole(user, ROLE_COURSECREATOR);
}

/**
 * Helper function to check if a user is a teacher (any teaching role)
 * 
 * @param user - User object to check
 * @returns True if user has teacher or editing teacher role
 */
export function isTeacher(user: User): boolean {
  return userHasRole(user, ROLE_TEACHER) || 
         userHasRole(user, ROLE_EDITINGTEACHER);
}

/**
 * Helper function to check if a user can edit course content
 * 
 * @param user - User object to check
 * @returns True if user has editing permissions
 */
export function canEditContent(user: User): boolean {
  return userHasRole(user, ROLE_EDITINGTEACHER) || isAdmin(user);
}

/**
 * Helper function to check if a user can grade assignments
 * 
 * @param user - User object to check
 * @returns True if user has grading permissions
 */
export function canGrade(user: User): boolean {
  return isTeacher(user) || isAdmin(user);
}

