/**
 * API Helper Utilities for Playwright E2E Tests
 * 
 * Provides functions to interact with Moodle API endpoints for test data setup,
 * teardown, and verification. Enables faster test execution by using API calls
 * instead of UI interactions for test preparation.
 * 
 * Features:
 * - Generic API request function with authentication
 * - Test course creation and deletion
 * - User enrollment management
 * - Assignment creation and cleanup
 * - Quiz setup and teardown
 * - Test user management
 * - Complete test environment setup and cleanup
 * - Response verification utilities
 * 
 * @module e2e/utils/api-helpers
 */

import { retryOperation } from './wait-helpers';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Options for API request configuration
 */
export interface ApiRequestOptions {
  /** HTTP method (GET, POST, PUT, DELETE) */
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  /** API endpoint path (relative to base URL) */
  endpoint: string;
  /** Request body data (for POST, PUT requests) */
  body?: Record<string, any> | FormData;
  /** Additional request headers */
  headers?: Record<string, string>;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Whether to retry on failure (default: true) */
  retry?: boolean;
  /** Authentication token (if not provided, will be retrieved automatically) */
  token?: string;
}

/**
 * Standard API response envelope structure
 */
export interface ApiResponse<T = any> {
  /** Success status flag */
  success: boolean;
  /** Response data payload */
  data?: T;
  /** Error information if request failed */
  error?: {
    /** Error code identifier */
    code: string;
    /** Human-readable error message */
    message: string;
    /** Additional error details */
    details?: Record<string, any>;
  };
  /** Metadata (pagination, etc.) */
  meta?: {
    pagination?: {
      page: number;
      perPage: number;
      total: number;
      totalPages: number;
    };
  };
}

/**
 * Course data structure for test course creation
 */
export interface CourseData {
  /** Course full name */
  name: string;
  /** Course short name */
  shortname?: string;
  /** Course category ID */
  category?: number;
  /** Course visibility (0=hidden, 1=visible) */
  visible?: number;
  /** Course summary/description */
  summary?: string;
  /** Course start date (Unix timestamp) */
  startdate?: number;
  /** Course end date (Unix timestamp) */
  enddate?: number;
}

/**
 * User data structure for test user creation
 */
export interface UserData {
  /** Username for login */
  username: string;
  /** User email address */
  email: string;
  /** User password */
  password: string;
  /** User first name */
  firstname: string;
  /** User last name */
  lastname: string;
  /** User city */
  city?: string;
  /** User country code */
  country?: string;
  /** User timezone */
  timezone?: string;
}

/**
 * Assignment data structure for test assignment creation
 */
export interface AssignmentData {
  /** Assignment name */
  name: string;
  /** Course ID where assignment belongs */
  courseid: number;
  /** Assignment intro/description */
  intro?: string;
  /** Assignment due date (Unix timestamp) */
  duedate?: number;
  /** Assignment cutoff date (Unix timestamp) */
  cutoffdate?: number;
  /** Allow submissions from date (Unix timestamp) */
  allowsubmissionsfromdate?: number;
  /** Maximum grade points */
  grade?: number;
}

/**
 * Quiz data structure for test quiz creation
 */
export interface QuizData {
  /** Quiz name */
  name: string;
  /** Course ID where quiz belongs */
  courseid: number;
  /** Quiz intro/description */
  intro?: string;
  /** Quiz open date (Unix timestamp) */
  timeopen?: number;
  /** Quiz close date (Unix timestamp) */
  timeclose?: number;
  /** Time limit in seconds */
  timelimit?: number;
  /** Maximum grade */
  grade?: number;
  /** Number of attempts allowed (0=unlimited) */
  attempts?: number;
}

/**
 * Test environment details returned by setupTestEnvironment
 */
export interface TestEnvironment {
  /** Test student user details */
  student: {
    id: number;
    username: string;
    password: string;
    email: string;
  };
  /** Test teacher user details */
  teacher: {
    id: number;
    username: string;
    password: string;
    email: string;
  };
  /** Test course details */
  course: {
    id: number;
    name: string;
    shortname: string;
  };
  /** Test assignment details (if created) */
  assignment?: {
    id: number;
    name: string;
  };
  /** Test quiz details (if created) */
  quiz?: {
    id: number;
    name: string;
  };
}

// ============================================================================
// Constants
// ============================================================================

/** API base URL from environment or default */
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost/api/v1';

/** Default request timeout in milliseconds */
const DEFAULT_TIMEOUT = 30000; // 30 seconds

/** Number of retry attempts for failed requests */
const RETRY_ATTEMPTS = 3;

/** Initial delay for exponential backoff in milliseconds */
const RETRY_INITIAL_DELAY = 100;

/** Maximum delay for exponential backoff in milliseconds */
const RETRY_MAX_DELAY = 5000;

// ============================================================================
// Global State for Test Data Tracking
// ============================================================================

/**
 * Global set to track created test courses for cleanup
 */
const createdCourses = new Set<number>();

/**
 * Global set to track created test users for cleanup
 */
const createdUsers = new Set<number>();

/**
 * Global set to track created test assignments for cleanup
 */
const createdAssignments = new Set<number>();

/**
 * Global set to track created test quizzes for cleanup
 */
const createdQuizzes = new Set<number>();

// ============================================================================
// Core API Request Function
// ============================================================================

/**
 * Generic API request function with authentication and retry logic
 * 
 * Performs HTTP requests to Moodle API endpoints with automatic:
 * - JWT token authentication via Authorization header
 * - Retry on network failures with exponential backoff
 * - Standard response envelope parsing
 * - Error handling and logging
 * 
 * @param options API request configuration options
 * @returns Parsed API response data
 * @throws Error if request fails after all retry attempts
 * 
 * @example
 * const course = await apiRequest({
 *   method: 'GET',
 *   endpoint: '/courses/5'
 * });
 */
export async function apiRequest<T = any>(
  options: ApiRequestOptions
): Promise<T> {
  const {
    method,
    endpoint,
    body,
    headers = {},
    timeout = DEFAULT_TIMEOUT,
    retry = true,
    token,
  } = options;

  // Build full URL
  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

  // Prepare request headers
  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };

  // Add authentication token if available
  let authToken = token;
  if (!authToken) {
    // Token will be retrieved by the Playwright request context
    // In actual usage, getAuthToken would need a Page object
    // For API-only requests, token should be passed explicitly
    if (typeof window !== 'undefined') {
      // Browser context - this won't work in Node.js
      // Must match ACCESS_TOKEN_KEY in authService.ts and client.ts
      authToken = localStorage.getItem('moodle_access_token') || undefined;
    }
  }

  if (authToken) {
    requestHeaders['Authorization'] = `Bearer ${authToken}`;
  }

  // Prepare request body
  let requestBody: string | FormData | undefined;
  if (body) {
    if (body instanceof FormData) {
      requestBody = body;
      // Remove Content-Type header for FormData (browser will set it with boundary)
      delete requestHeaders['Content-Type'];
    } else {
      requestBody = JSON.stringify(body);
    }
  }

  // Define the request operation
  const makeRequest = async (): Promise<T> => {
    // Log request for debugging
    console.log(`[API Request] ${method} ${url}`);
    if (body && !(body instanceof FormData)) {
      console.log(`[API Request Body]`, body);
    }

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      // Make HTTP request using fetch
      const response = await fetch(url, {
        method,
        headers: requestHeaders,
        body: requestBody,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Parse response
      let responseData: ApiResponse<T>;
      const contentType = response.headers.get('content-type');
      
      if (contentType && contentType.includes('application/json')) {
        responseData = await response.json();
      } else {
        // Non-JSON response - treat as error
        throw new Error(`Unexpected response type: ${contentType}`);
      }

      // Log response for debugging
      console.log(`[API Response] ${response.status}`, responseData);

      // Check if response indicates success
      if (!response.ok || !responseData.success) {
        const errorMessage = responseData.error?.message || `API request failed with status ${response.status}`;
        const error = new Error(errorMessage);
        (error as any).code = responseData.error?.code || 'API_ERROR';
        (error as any).details = responseData.error?.details;
        (error as any).status = response.status;
        throw error;
      }

      // Verify API response structure
      verifyApiResponse(responseData);

      // Return data payload
      return responseData.data as T;
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error(`API request timeout after ${timeout}ms: ${url}`);
        }
        throw error;
      }
      throw new Error(`API request failed: ${String(error)}`);
    }
  };

  // Execute request with retry if enabled
  if (retry) {
    return await retryOperation(makeRequest, {
      maxAttempts: RETRY_ATTEMPTS,
      initialDelay: RETRY_INITIAL_DELAY,
      maxDelay: RETRY_MAX_DELAY,
      factor: 2,
      shouldRetry: (error: Error) => {
        // Retry on network errors, timeouts, and 5xx server errors
        const status = (error as any).status;
        return !status || status >= 500;
      },
    });
  } else {
    return await makeRequest();
  }
}

// ============================================================================
// Response Verification Utility
// ============================================================================

/**
 * Verify API response structure and throw error if invalid
 * 
 * Validates that the response follows the standard envelope format:
 * - Contains success field
 * - Contains data field when success is true
 * - Contains error field when success is false
 * 
 * @param response API response to verify
 * @throws Error if response structure is invalid
 * 
 * @example
 * verifyApiResponse(responseData);
 */
export function verifyApiResponse<T = any>(response: ApiResponse<T>): void {
  // Check that response is an object
  if (!response || typeof response !== 'object') {
    throw new Error('Invalid API response: response is not an object');
  }

  // Check that success field exists and is boolean
  if (typeof response.success !== 'boolean') {
    throw new Error('Invalid API response: missing or invalid "success" field');
  }

  // If success is true, data field should exist
  if (response.success && response.data === undefined) {
    throw new Error('Invalid API response: "data" field is missing for successful response');
  }

  // If success is false, error field should exist
  if (!response.success && !response.error) {
    throw new Error('Invalid API response: "error" field is missing for failed response');
  }
}

// ============================================================================
// Course Management Functions
// ============================================================================

/**
 * Create a test course via API
 * 
 * Creates a new course in Moodle and tracks it for cleanup.
 * Returns the created course details including ID.
 * 
 * @param courseData Course configuration data
 * @param token Optional authentication token
 * @returns Created course details
 * @throws Error if course creation fails
 * 
 * @example
 * const course = await createTestCourse({
 *   name: 'E2E Test Course',
 *   category: 1,
 *   visible: 1
 * });
 */
export async function createTestCourse(
  courseData: CourseData,
  token?: string
): Promise<{ id: number; name: string; shortname: string }> {
  // Generate shortname if not provided
  const shortname = courseData.shortname || 
    `test_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  const course = await apiRequest<{ id: number; name: string; shortname: string }>({
    method: 'POST',
    endpoint: '/courses',
    body: {
      ...courseData,
      shortname,
      category: courseData.category || 1,
      visible: courseData.visible !== undefined ? courseData.visible : 1,
    },
    token,
  });

  // Track course for cleanup
  createdCourses.add(course.id);

  console.log(`[Test Data] Created course: ${course.name} (ID: ${course.id})`);

  return course;
}

/**
 * Delete a test course via API
 * 
 * Deletes a course and removes it from tracking list.
 * Verifies deletion was successful.
 * 
 * @param courseId Course ID to delete
 * @param token Optional authentication token
 * @returns Promise that resolves when deletion is complete
 * @throws Error if deletion fails
 * 
 * @example
 * await deleteTestCourse(5);
 */
export async function deleteTestCourse(
  courseId: number,
  token?: string
): Promise<void> {
  await apiRequest({
    method: 'DELETE',
    endpoint: `/courses/${courseId}`,
    token,
  });

  // Remove from tracking
  createdCourses.delete(courseId);

  console.log(`[Test Data] Deleted course ID: ${courseId}`);
}

// ============================================================================
// Enrollment Management Functions
// ============================================================================

/**
 * Enroll a user in a course via API
 * 
 * Enrolls a user in the specified course using the manual enrollment method.
 * Verifies enrollment was successful.
 * 
 * @param userId User ID to enroll
 * @param courseId Course ID to enroll in
 * @param role Optional role name (default: 'student')
 * @param token Optional authentication token
 * @returns Promise that resolves when enrollment is complete
 * @throws Error if enrollment fails
 * 
 * @example
 * await enrollUserInCourse(15, 5, 'student');
 */
export async function enrollUserInCourse(
  userId: number,
  courseId: number,
  role: string = 'student',
  token?: string
): Promise<void> {
  await apiRequest({
    method: 'POST',
    endpoint: `/courses/${courseId}/enroll`,
    body: {
      userid: userId,
      roleid: role,
    },
    token,
  });

  console.log(`[Test Data] Enrolled user ${userId} in course ${courseId} as ${role}`);
}

/**
 * Unenroll a user from a course via API
 * 
 * Removes a user's enrollment from the specified course.
 * Verifies unenrollment was successful.
 * 
 * @param userId User ID to unenroll
 * @param courseId Course ID to unenroll from
 * @param token Optional authentication token
 * @returns Promise that resolves when unenrollment is complete
 * @throws Error if unenrollment fails
 * 
 * @example
 * await unenrollUserFromCourse(15, 5);
 */
export async function unenrollUserFromCourse(
  userId: number,
  courseId: number,
  token?: string
): Promise<void> {
  await apiRequest({
    method: 'POST',
    endpoint: `/courses/${courseId}/unenroll`,
    body: {
      userid: userId,
    },
    token,
  });

  console.log(`[Test Data] Unenrolled user ${userId} from course ${courseId}`);
}

// ============================================================================
// Assignment Management Functions
// ============================================================================

/**
 * Create a test assignment in a course via API
 * 
 * Creates a new assignment activity and tracks it for cleanup.
 * Returns the created assignment details including ID.
 * 
 * @param assignmentData Assignment configuration data
 * @param token Optional authentication token
 * @returns Created assignment details
 * @throws Error if assignment creation fails
 * 
 * @example
 * const assignment = await createTestAssignment({
 *   name: 'Test Assignment',
 *   courseid: 5,
 *   duedate: Date.now() / 1000 + 86400 * 7 // Due in 7 days
 * });
 */
export async function createTestAssignment(
  assignmentData: AssignmentData,
  token?: string
): Promise<{ id: number; name: string }> {
  const assignment = await apiRequest<{ id: number; name: string }>({
    method: 'POST',
    endpoint: '/assignments',
    body: {
      ...assignmentData,
      intro: assignmentData.intro || 'Test assignment description',
      grade: assignmentData.grade || 100,
    },
    token,
  });

  // Track assignment for cleanup
  createdAssignments.add(assignment.id);

  console.log(`[Test Data] Created assignment: ${assignment.name} (ID: ${assignment.id})`);

  return assignment;
}

/**
 * Delete a test assignment via API
 * 
 * Deletes an assignment and removes it from tracking list.
 * Verifies deletion was successful.
 * 
 * @param assignmentId Assignment ID to delete
 * @param token Optional authentication token
 * @returns Promise that resolves when deletion is complete
 * @throws Error if deletion fails
 * 
 * @example
 * await deleteTestAssignment(12);
 */
export async function deleteTestAssignment(
  assignmentId: number,
  token?: string
): Promise<void> {
  await apiRequest({
    method: 'DELETE',
    endpoint: `/assignments/${assignmentId}`,
    token,
  });

  // Remove from tracking
  createdAssignments.delete(assignmentId);

  console.log(`[Test Data] Deleted assignment ID: ${assignmentId}`);
}

// ============================================================================
// Quiz Management Functions
// ============================================================================

/**
 * Create a test quiz in a course via API
 * 
 * Creates a new quiz activity and tracks it for cleanup.
 * Returns the created quiz details including ID.
 * 
 * @param quizData Quiz configuration data
 * @param token Optional authentication token
 * @returns Created quiz details
 * @throws Error if quiz creation fails
 * 
 * @example
 * const quiz = await createTestQuiz({
 *   name: 'Test Quiz',
 *   courseid: 5,
 *   timelimit: 3600 // 1 hour time limit
 * });
 */
export async function createTestQuiz(
  quizData: QuizData,
  token?: string
): Promise<{ id: number; name: string }> {
  const quiz = await apiRequest<{ id: number; name: string }>({
    method: 'POST',
    endpoint: '/quizzes',
    body: {
      ...quizData,
      intro: quizData.intro || 'Test quiz description',
      grade: quizData.grade || 100,
      attempts: quizData.attempts !== undefined ? quizData.attempts : 0, // Unlimited by default
    },
    token,
  });

  // Track quiz for cleanup
  createdQuizzes.add(quiz.id);

  console.log(`[Test Data] Created quiz: ${quiz.name} (ID: ${quiz.id})`);

  return quiz;
}

/**
 * Delete a test quiz via API
 * 
 * Deletes a quiz and removes it from tracking list.
 * Verifies deletion was successful.
 * 
 * @param quizId Quiz ID to delete
 * @param token Optional authentication token
 * @returns Promise that resolves when deletion is complete
 * @throws Error if deletion fails
 * 
 * @example
 * await deleteTestQuiz(8);
 */
export async function deleteTestQuiz(
  quizId: number,
  token?: string
): Promise<void> {
  await apiRequest({
    method: 'DELETE',
    endpoint: `/quizzes/${quizId}`,
    token,
  });

  // Remove from tracking
  createdQuizzes.delete(quizId);

  console.log(`[Test Data] Deleted quiz ID: ${quizId}`);
}

// ============================================================================
// User Management Functions
// ============================================================================

/**
 * Create a test user via API
 * 
 * Creates a new user account for testing and tracks it for cleanup.
 * Returns the created user details including ID and credentials.
 * 
 * @param userData User configuration data
 * @param token Optional authentication token (admin token required)
 * @returns Created user details
 * @throws Error if user creation fails
 * 
 * @example
 * const user = await createTestUser({
 *   username: 'testuser1',
 *   email: 'testuser1@example.com',
 *   password: 'Test@123',
 *   firstname: 'Test',
 *   lastname: 'User'
 * });
 */
export async function createTestUser(
  userData: UserData,
  token?: string
): Promise<{ id: number; username: string; email: string }> {
  const user = await apiRequest<{ id: number; username: string; email: string }>({
    method: 'POST',
    endpoint: '/admin/users',
    body: {
      ...userData,
      city: userData.city || 'Test City',
      country: userData.country || 'US',
      timezone: userData.timezone || 'UTC',
    },
    token,
  });

  // Track user for cleanup
  createdUsers.add(user.id);

  console.log(`[Test Data] Created user: ${user.username} (ID: ${user.id})`);

  return user;
}

/**
 * Delete a test user via API
 * 
 * Deletes a user account and removes it from tracking list.
 * Verifies deletion was successful.
 * 
 * @param userId User ID to delete
 * @param token Optional authentication token (admin token required)
 * @returns Promise that resolves when deletion is complete
 * @throws Error if deletion fails
 * 
 * @example
 * await deleteTestUser(42);
 */
export async function deleteTestUser(
  userId: number,
  token?: string
): Promise<void> {
  await apiRequest({
    method: 'DELETE',
    endpoint: `/admin/users/${userId}`,
    token,
  });

  // Remove from tracking
  createdUsers.delete(userId);

  console.log(`[Test Data] Deleted user ID: ${userId}`);
}

// ============================================================================
// Test Data Retrieval Functions
// ============================================================================

/**
 * Retrieve test data from API for verification
 * 
 * Generic function to fetch data from various API endpoints for test assertions.
 * Supports retrieving course details, user enrollments, grades, and more.
 * 
 * @param endpoint API endpoint to fetch data from
 * @param token Optional authentication token
 * @returns Retrieved data
 * @throws Error if data retrieval fails
 * 
 * @example
 * // Get course details
 * const course = await getTestData('/courses/5');
 * 
 * // Get user enrollments
 * const enrollments = await getTestData('/users/15/courses');
 * 
 * // Get grades
 * const grades = await getTestData('/gradebook/user/15');
 */
export async function getTestData<T = any>(
  endpoint: string,
  token?: string
): Promise<T> {
  return await apiRequest<T>({
    method: 'GET',
    endpoint,
    token,
  });
}

// ============================================================================
// Complete Test Environment Setup and Cleanup
// ============================================================================

/**
 * Setup complete test environment with users, course, and activities
 * 
 * Creates a full test environment including:
 * - Student user account
 * - Teacher user account
 * - Test course
 * - Enrollments for both users
 * - Optional test assignment
 * - Optional test quiz
 * 
 * Returns all created entity details for use in tests.
 * All entities are tracked for cleanup.
 * 
 * @param options Configuration options for test environment
 * @param token Optional authentication token (admin token required)
 * @returns Complete test environment details
 * @throws Error if environment setup fails
 * 
 * @example
 * const env = await setupTestEnvironment({
 *   includeAssignment: true,
 *   includeQuiz: true
 * });
 * 
 * // Use in tests
 * await page.goto(`/courses/${env.course.id}`);
 */
export async function setupTestEnvironment(
  options: {
    courseName?: string;
    includeAssignment?: boolean;
    includeQuiz?: boolean;
  } = {},
  token?: string
): Promise<TestEnvironment> {
  console.log('[Test Environment] Setting up test environment...');

  // Generate unique identifiers
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);

  // Create student user
  console.log('[Test Environment] Creating student user...');
  const studentUsername = `test_student_${timestamp}_${random}`;
  const studentUser = await createTestUser(
    {
      username: studentUsername,
      email: `${studentUsername}@example.com`,
      password: 'TestStudent@123',
      firstname: 'Test',
      lastname: 'Student',
    },
    token
  );

  // Create teacher user
  console.log('[Test Environment] Creating teacher user...');
  const teacherUsername = `test_teacher_${timestamp}_${random}`;
  const teacherUser = await createTestUser(
    {
      username: teacherUsername,
      email: `${teacherUsername}@example.com`,
      password: 'TestTeacher@123',
      firstname: 'Test',
      lastname: 'Teacher',
    },
    token
  );

  // Create test course
  console.log('[Test Environment] Creating test course...');
  const courseName = options.courseName || `E2E Test Course ${timestamp}`;
  const course = await createTestCourse(
    {
      name: courseName,
      category: 1,
      visible: 1,
      summary: 'Test course for E2E testing',
    },
    token
  );

  // Enroll student in course
  console.log('[Test Environment] Enrolling student in course...');
  await enrollUserInCourse(studentUser.id, course.id, 'student', token);

  // Enroll teacher in course
  console.log('[Test Environment] Enrolling teacher in course...');
  await enrollUserInCourse(teacherUser.id, course.id, 'teacher', token);

  const environment: TestEnvironment = {
    student: {
      id: studentUser.id,
      username: studentUsername,
      password: 'TestStudent@123',
      email: studentUser.email,
    },
    teacher: {
      id: teacherUser.id,
      username: teacherUsername,
      password: 'TestTeacher@123',
      email: teacherUser.email,
    },
    course: {
      id: course.id,
      name: course.name,
      shortname: course.shortname,
    },
  };

  // Create assignment if requested
  if (options.includeAssignment) {
    console.log('[Test Environment] Creating test assignment...');
    const assignment = await createTestAssignment(
      {
        name: `Test Assignment ${timestamp}`,
        courseid: course.id,
        duedate: Math.floor(Date.now() / 1000) + 86400 * 7, // Due in 7 days
        grade: 100,
      },
      token
    );
    environment.assignment = {
      id: assignment.id,
      name: assignment.name,
    };
  }

  // Create quiz if requested
  if (options.includeQuiz) {
    console.log('[Test Environment] Creating test quiz...');
    const quiz = await createTestQuiz(
      {
        name: `Test Quiz ${timestamp}`,
        courseid: course.id,
        timelimit: 3600, // 1 hour
        attempts: 0, // Unlimited attempts
        grade: 100,
      },
      token
    );
    environment.quiz = {
      id: quiz.id,
      name: quiz.name,
    };
  }

  console.log('[Test Environment] Test environment setup complete!');
  console.log('[Test Environment]', JSON.stringify(environment, null, 2));

  return environment;
}

/**
 * Cleanup all test data created during tests
 * 
 * Deletes all tracked test entities in reverse order:
 * 1. Assignments
 * 2. Quizzes
 * 3. Courses (which also removes enrollments)
 * 4. Users
 * 
 * Verifies all deletions were successful and resets tracking sets.
 * Should be called in test teardown or afterAll hooks.
 * 
 * @param token Optional authentication token (admin token required)
 * @returns Promise that resolves when all cleanup is complete
 * @throws Error if cleanup fails
 * 
 * @example
 * // In test teardown
 * test.afterAll(async () => {
 *   await cleanupTestEnvironment(adminToken);
 * });
 */
export async function cleanupTestEnvironment(token?: string): Promise<void> {
  console.log('[Test Cleanup] Starting test environment cleanup...');

  // Track cleanup errors but continue with remaining deletions
  const errors: Error[] = [];

  // Delete assignments
  if (createdAssignments.size > 0) {
    console.log(`[Test Cleanup] Deleting ${createdAssignments.size} assignment(s)...`);
    for (const assignmentId of Array.from(createdAssignments)) {
      try {
        await deleteTestAssignment(assignmentId, token);
      } catch (error) {
        console.error(`[Test Cleanup] Failed to delete assignment ${assignmentId}:`, error);
        errors.push(error instanceof Error ? error : new Error(String(error)));
      }
    }
  }

  // Delete quizzes
  if (createdQuizzes.size > 0) {
    console.log(`[Test Cleanup] Deleting ${createdQuizzes.size} quiz(zes)...`);
    for (const quizId of Array.from(createdQuizzes)) {
      try {
        await deleteTestQuiz(quizId, token);
      } catch (error) {
        console.error(`[Test Cleanup] Failed to delete quiz ${quizId}:`, error);
        errors.push(error instanceof Error ? error : new Error(String(error)));
      }
    }
  }

  // Delete courses (this also removes enrollments)
  if (createdCourses.size > 0) {
    console.log(`[Test Cleanup] Deleting ${createdCourses.size} course(s)...`);
    for (const courseId of Array.from(createdCourses)) {
      try {
        await deleteTestCourse(courseId, token);
      } catch (error) {
        console.error(`[Test Cleanup] Failed to delete course ${courseId}:`, error);
        errors.push(error instanceof Error ? error : new Error(String(error)));
      }
    }
  }

  // Delete users
  if (createdUsers.size > 0) {
    console.log(`[Test Cleanup] Deleting ${createdUsers.size} user(s)...`);
    for (const userId of Array.from(createdUsers)) {
      try {
        await deleteTestUser(userId, token);
      } catch (error) {
        console.error(`[Test Cleanup] Failed to delete user ${userId}:`, error);
        errors.push(error instanceof Error ? error : new Error(String(error)));
      }
    }
  }

  // Clear all tracking sets
  createdCourses.clear();
  createdUsers.clear();
  createdAssignments.clear();
  createdQuizzes.clear();

  if (errors.length > 0) {
    console.error(`[Test Cleanup] Cleanup completed with ${errors.length} error(s)`);
    throw new Error(
      `Test cleanup failed with ${errors.length} error(s). First error: ${errors[0]?.message ?? 'Unknown error'}`
    );
  }

  console.log('[Test Cleanup] Test environment cleanup complete!');
}

