/**
 * E2E Test Fixtures - Barrel Export
 * 
 * Centralized export point for all E2E test fixtures. This barrel file re-exports
 * all fixture data from individual modules, providing a single import source for
 * test files.
 * 
 * @example
 * ```typescript
 * // Import multiple fixtures from single source
 * import { 
 *   testStudent, 
 *   testTeacher, 
 *   validAccessToken, 
 *   testCourse1 
 * } from '@/tests/e2e/fixtures';
 * ```
 * 
 * @module tests/e2e/fixtures
 */

/**
 * User Fixtures
 * 
 * Exports predefined test users for different roles (student, teacher, admin),
 * role constants, TEST_PASSWORD, and helper functions for user management.
 * Used across authentication, profile, enrollment, and user management tests.
 * 
 * Exported items include:
 * - testStudent, testTeacher, testAdmin, testCourseCreator, testManager
 * - ROLE_STUDENT, ROLE_TEACHER, ROLE_ADMIN constants
 * - TEST_PASSWORD constant
 * - Helper functions for user creation and management
 */
export * from './users';

/**
 * Authentication Token Fixtures
 * 
 * Exports JWT token fixtures for authenticated API requests including valid tokens,
 * expired tokens, and token helper functions (generateTokenForUser, decodeToken, isTokenExpired).
 * Used across all authenticated E2E tests.
 * 
 * Exported items include:
 * - validAccessToken, validRefreshToken, expiredAccessToken, expiredRefreshToken
 * - invalidToken, malformedToken
 * - ACCESS_TOKEN_EXPIRY, REFRESH_TOKEN_EXPIRY constants
 * - TokenPayload, AuthTokens interfaces
 * - generateTokenForUser(), decodeToken(), isTokenExpired() helper functions
 */
export * from './auth-tokens';

/**
 * Course Fixtures
 * 
 * Exports predefined course objects with various enrollment methods, categories,
 * course formats, and helper functions for course creation and management.
 * Used across course catalog, enrollment, dashboard, and activity module tests.
 * 
 * Exported items include:
 * - testCourse1, testCourse2, testCourse3, testCourse4 (different configurations)
 * - testCategory1, testCategory2 (course categories)
 * - ENROLLMENT_METHODS, COURSE_FORMATS constants
 * - Course, CourseCategory, CourseSection interfaces
 * - createCourse(), getCourseWithActivities() helper functions
 */
export * from './courses';

/**
 * Assignment Fixtures
 * 
 * Exports predefined assignment objects with various configurations, submission fixtures
 * for different submission types, and helper functions for assignment and submission management.
 * Used across assignment submission and grading E2E tests.
 * 
 * Exported items include:
 * - testAssignment1, testAssignment2, testAssignment3, testAssignment4
 * - testSubmission1, testSubmission2 (different states)
 * - ASSIGNMENT_TYPES, SUBMISSION_STATUS constants
 * - Assignment, AssignmentSubmission, AssignmentFeedback interfaces
 * - createAssignment(), createSubmission(), submitAssignment() helper functions
 */
export * from './assignments';

/**
 * Quiz Fixtures
 * 
 * Exports predefined quiz objects with various question types, quiz attempt fixtures,
 * and helper functions for quiz and question management.
 * Used across quiz taking, review, and grading E2E tests.
 * 
 * Exported items include:
 * - testQuiz1, testQuiz2, testQuiz3 (different configurations)
 * - testQuestion1, testQuestion2 (multiple choice, true/false, essay, etc.)
 * - testAttempt1, testAttempt2 (different attempt states)
 * - QUIZ_QUESTION_TYPES, ATTEMPT_STATUS constants
 * - Quiz, QuizQuestion, QuizAttempt, QuizAnswer interfaces
 * - createQuiz(), createQuestion(), createAttempt(), submitAnswer() helper functions
 */
export * from './quizzes';

/**
 * Forum Fixtures
 * 
 * Exports predefined forum objects with discussions, posts, and nested reply threads.
 * Includes helper functions for forum, discussion, and post management.
 * Used across forum discussion and messaging E2E tests.
 * 
 * Exported items include:
 * - testForum1, testForum2, testForum3 (different forum types)
 * - testDiscussion1, testDiscussion2 (discussion threads)
 * - testPost1, testPost2 (posts with replies)
 * - FORUM_TYPES constants
 * - Forum, ForumDiscussion, ForumPost interfaces
 * - createForum(), createDiscussion(), createPost() helper functions
 */
export * from './forums';

/**
 * Gradebook Fixtures
 * 
 * Exports predefined grade items, grade categories, user grades, and grade history
 * for testing gradebook calculations and aggregations.
 * Used across gradebook viewing and grading E2E tests.
 * 
 * Exported items include:
 * - testGradeItem1, testGradeItem2, testGradeItem3, testGradeItem4
 * - testGradeCategory1, testGradeCategory2
 * - testUserGrade1, testUserGrade2
 * - AGGREGATION_METHODS, GRADE_TYPES constants
 * - GradeItem, GradeCategory, UserGrade, GradeHistory interfaces
 * - createGradeItem(), createGradeCategory(), calculateCourseGrade() helper functions
 */
export * from './grades';

/**
 * File Upload Fixtures
 * 
 * Exports predefined file fixtures for different MIME types (PDF, images, documents),
 * file size limits, and helper functions for file upload testing.
 * Used across file upload, assignment submission, and resource management tests.
 * 
 * Exported items include:
 * - samplePDFFile, sampleImageFile, sampleDocumentFile, sampleVideoFile
 * - MAX_FILE_SIZE, MIME_TYPES constants
 * - FileFixture, FileUploadResponse interfaces
 * - createTestFile(), createFileUploadResponse(), generateTestBlob() helper functions
 */
export * from './files';
