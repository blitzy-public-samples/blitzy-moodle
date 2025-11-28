/**
 * Test Mocks - Central Export Module
 *
 * This barrel export module provides a centralized import point for all test mocks,
 * MSW handlers, and test utilities across the testing suite. It aggregates exports
 * from three subdirectories into logical groups for convenient importing.
 *
 * Exported Groups:
 * - mockData: Mock data generators for creating test fixtures
 * - mockHandlers: MSW request handlers for API mocking
 * - testUtils: Custom render functions and React Testing Library utilities
 *
 * Benefits:
 * - Single import statement for all test utilities
 * - Logical grouping for better IDE autocomplete
 * - Consistent import pattern across all test files
 * - Tree-shaking support for unused utilities
 *
 * @module tests/mocks
 *
 * @example
 * ```typescript
 * // Import grouped exports for organized access
 * import { mockData, mockHandlers, testUtils } from '@/tests/mocks';
 *
 * // Use mock data generators
 * const user = mockData.mockUser({ username: 'testuser' });
 * const course = mockData.mockCourse({ fullname: 'Test Course' });
 *
 * // Use MSW handlers
 * const server = setupServer(...mockHandlers.handlers);
 *
 * // Use test utilities
 * const { getByText } = testUtils.renderWithProviders(<Component />);
 * testUtils.waitFor(() => expect(getByText('Hello')).toBeInTheDocument());
 * ```
 *
 * @example
 * ```typescript
 * // Import individual items directly (also supported)
 * import {
 *   mockUser,
 *   mockCourse,
 *   authHandlers,
 *   renderWithProviders,
 *   screen,
 *   waitFor
 * } from '@/tests/mocks';
 *
 * test('renders component', async () => {
 *   renderWithProviders(<Component user={mockUser()} />);
 *   await waitFor(() => {
 *     expect(screen.getByText('Hello')).toBeInTheDocument();
 *   });
 * });
 * ```
 */

// ============================================================================
// Import Namespaces
// ============================================================================

/**
 * Import all mock data generators as a namespace for grouped exports.
 */
import * as dataModule from './data';

/**
 * Import all MSW handlers as a namespace for grouped exports.
 */
import * as handlersModule from './handlers';

/**
 * Import all test utilities as a namespace for grouped exports.
 */
import * as utilsModule from './utils';

// ============================================================================
// Mock Data Exports
// ============================================================================

/**
 * Re-export all mock data generators for direct importing.
 *
 * This allows imports like:
 * ```typescript
 * import { mockUser, mockCourse, mockAssignment } from '@/tests/mocks';
 * ```
 */
export {
  // Authentication mock data
  mockJwtTokens,
  mockDecodedJwt,
  mockLoginResponse,
  // User mock data
  mockUser,
  mockStudent,
  mockTeacher,
  mockAdmin,
  mockUserArray,
  // Course mock data
  mockCourse,
  mockCourseModule,
  mockCourseCategory,
  mockCourseArray,
  mockCourseModuleArray,
  // Assignment mock data
  mockAssignment,
  mockAssignmentSubmission,
  mockDraftSubmission,
  mockSubmittedSubmission,
  mockAssignmentArray,
  mockSubmissionArray,
  // Quiz mock data
  mockQuiz,
  mockQuizAttempt,
  mockInProgressAttempt,
  mockFinishedAttempt,
  mockOverdueAttempt,
  mockQuizArray,
  mockAttemptArray,
  // Grade mock data
  mockGrade,
  mockGradeItem,
  mockPassingGrade,
  mockFailingGrade,
  mockOverriddenGrade,
  mockGradeArray,
  mockGradeItemArray,
  mockCourseGradebook,
  // Message mock data
  mockMessage,
  mockReadMessage,
  mockUnreadMessage,
  mockNotification,
  mockConversation,
  mockGroupConversation,
  mockMessageArray,
  mockConversationWithMessages,
  mockNotificationArray,
} from './data';

// ============================================================================
// MSW Handler Exports
// ============================================================================

/**
 * Re-export all MSW handlers for direct importing.
 *
 * This allows imports like:
 * ```typescript
 * import { authHandlers, coursesHandlers, handlers } from '@/tests/mocks';
 * import { setupServer } from 'msw/node';
 *
 * const server = setupServer(...handlers);
 * ```
 */
export {
  // Individual handler arrays
  authHandlers,
  usersHandlers,
  coursesHandlers,
  assignmentsHandlers,
  quizzesHandlers,
  gradesHandlers,
  messagesHandlers,
  // Additional handlers from handlers/index.ts
  forumsHandlers,
  choicesHandlers,
  feedbackHandlers,
  h5pHandlers,
  resourcesHandlers,
  filesHandlers,
  adminHandlers,
  // Unified handler collection
  handlers,
} from './handlers';

// ============================================================================
// Test Utility Exports
// ============================================================================

/**
 * Re-export all test utilities for direct importing.
 *
 * This allows imports like:
 * ```typescript
 * import {
 *   renderWithProviders,
 *   screen,
 *   waitFor,
 *   setupStore,
 *   testQueryClient
 * } from '@/tests/mocks';
 * ```
 */
export {
  // Custom test utilities
  renderWithProviders,
  setupStore,
  testQueryClient,
  // React Testing Library utilities
  screen,
  fireEvent,
  waitFor,
  within,
  render,
  cleanup,
  act,
  // Types
  type AppStore,
  type RootState,
  type ExtendedRenderOptions,
} from './utils';

// ============================================================================
// Grouped Namespace Exports
// ============================================================================

/**
 * Grouped mock data generators.
 *
 * Provides organized access to all mock data factory functions through
 * a single namespace object. Useful when you want clear categorization
 * of where functions come from.
 *
 * @example
 * ```typescript
 * import { mockData } from '@/tests/mocks';
 *
 * // Authentication
 * const tokens = mockData.mockJwtTokens();
 * const decoded = mockData.mockDecodedJwt();
 * const loginResponse = mockData.mockLoginResponse();
 *
 * // Users
 * const user = mockData.mockUser({ id: 1 });
 * const student = mockData.mockStudent();
 * const teacher = mockData.mockTeacher();
 * const admin = mockData.mockAdmin();
 * const users = mockData.mockUserArray(5);
 *
 * // Courses
 * const course = mockData.mockCourse({ fullname: 'Test Course' });
 * const module = mockData.mockCourseModule({ name: 'Module 1' });
 * const category = mockData.mockCourseCategory();
 * const courses = mockData.mockCourseArray(10);
 *
 * // Assignments
 * const assignment = mockData.mockAssignment({ name: 'Test Assignment' });
 * const submission = mockData.mockAssignmentSubmission();
 * const draft = mockData.mockDraftSubmission();
 * const submitted = mockData.mockSubmittedSubmission();
 *
 * // Quizzes
 * const quiz = mockData.mockQuiz({ name: 'Test Quiz' });
 * const attempt = mockData.mockQuizAttempt();
 * const inProgress = mockData.mockInProgressAttempt();
 * const finished = mockData.mockFinishedAttempt();
 * const overdue = mockData.mockOverdueAttempt();
 *
 * // Grades
 * const grade = mockData.mockGrade();
 * const gradeItem = mockData.mockGradeItem();
 * const passing = mockData.mockPassingGrade();
 * const failing = mockData.mockFailingGrade();
 * const overridden = mockData.mockOverriddenGrade();
 * const gradebook = mockData.mockCourseGradebook();
 *
 * // Messages
 * const message = mockData.mockMessage();
 * const readMsg = mockData.mockReadMessage();
 * const unreadMsg = mockData.mockUnreadMessage();
 * const notification = mockData.mockNotification();
 * const conversation = mockData.mockConversation();
 * const groupConv = mockData.mockGroupConversation();
 * const convWithMsgs = mockData.mockConversationWithMessages();
 * ```
 */
export const mockData = {
  // Authentication mock data generators
  mockJwtTokens: dataModule.mockJwtTokens,
  mockDecodedJwt: dataModule.mockDecodedJwt,
  mockLoginResponse: dataModule.mockLoginResponse,

  // User mock data generators
  mockUser: dataModule.mockUser,
  mockStudent: dataModule.mockStudent,
  mockTeacher: dataModule.mockTeacher,
  mockAdmin: dataModule.mockAdmin,
  mockUserArray: dataModule.mockUserArray,

  // Course mock data generators
  mockCourse: dataModule.mockCourse,
  mockCourseModule: dataModule.mockCourseModule,
  mockCourseCategory: dataModule.mockCourseCategory,
  mockCourseArray: dataModule.mockCourseArray,
  mockCourseModuleArray: dataModule.mockCourseModuleArray,

  // Assignment mock data generators
  mockAssignment: dataModule.mockAssignment,
  mockAssignmentSubmission: dataModule.mockAssignmentSubmission,
  mockDraftSubmission: dataModule.mockDraftSubmission,
  mockSubmittedSubmission: dataModule.mockSubmittedSubmission,
  mockAssignmentArray: dataModule.mockAssignmentArray,
  mockSubmissionArray: dataModule.mockSubmissionArray,

  // Quiz mock data generators
  mockQuiz: dataModule.mockQuiz,
  mockQuizAttempt: dataModule.mockQuizAttempt,
  mockInProgressAttempt: dataModule.mockInProgressAttempt,
  mockFinishedAttempt: dataModule.mockFinishedAttempt,
  mockOverdueAttempt: dataModule.mockOverdueAttempt,
  mockQuizArray: dataModule.mockQuizArray,
  mockAttemptArray: dataModule.mockAttemptArray,

  // Grade mock data generators
  mockGrade: dataModule.mockGrade,
  mockGradeItem: dataModule.mockGradeItem,
  mockPassingGrade: dataModule.mockPassingGrade,
  mockFailingGrade: dataModule.mockFailingGrade,
  mockOverriddenGrade: dataModule.mockOverriddenGrade,
  mockGradeArray: dataModule.mockGradeArray,
  mockGradeItemArray: dataModule.mockGradeItemArray,
  mockCourseGradebook: dataModule.mockCourseGradebook,

  // Message mock data generators
  mockMessage: dataModule.mockMessage,
  mockReadMessage: dataModule.mockReadMessage,
  mockUnreadMessage: dataModule.mockUnreadMessage,
  mockNotification: dataModule.mockNotification,
  mockConversation: dataModule.mockConversation,
  mockGroupConversation: dataModule.mockGroupConversation,
  mockMessageArray: dataModule.mockMessageArray,
  mockConversationWithMessages: dataModule.mockConversationWithMessages,
  mockNotificationArray: dataModule.mockNotificationArray,
} as const;

/**
 * Grouped MSW request handlers.
 *
 * Provides organized access to all MSW handler arrays through a single
 * namespace object. Useful for selecting specific handler sets for
 * focused testing scenarios.
 *
 * @example
 * ```typescript
 * import { mockHandlers } from '@/tests/mocks';
 * import { setupServer } from 'msw/node';
 *
 * // Use all handlers for comprehensive API mocking
 * const server = setupServer(...mockHandlers.handlers);
 *
 * // Or use specific handler sets
 * const authServer = setupServer(...mockHandlers.authHandlers);
 * const coursesServer = setupServer(
 *   ...mockHandlers.authHandlers,
 *   ...mockHandlers.coursesHandlers
 * );
 *
 * // In tests, you can add handlers dynamically
 * server.use(...mockHandlers.assignmentsHandlers);
 * ```
 */
export const mockHandlers = {
  // Individual handler arrays by feature
  authHandlers: handlersModule.authHandlers,
  usersHandlers: handlersModule.usersHandlers,
  coursesHandlers: handlersModule.coursesHandlers,
  assignmentsHandlers: handlersModule.assignmentsHandlers,
  quizzesHandlers: handlersModule.quizzesHandlers,
  gradesHandlers: handlersModule.gradesHandlers,
  messagesHandlers: handlersModule.messagesHandlers,

  // Unified handler collection (all handlers combined)
  handlers: handlersModule.handlers,
} as const;

/**
 * Grouped test utilities.
 *
 * Provides organized access to all test utilities, including custom render
 * functions, store setup, query client, and React Testing Library exports.
 *
 * @example
 * ```typescript
 * import { testUtils, mockData } from '@/tests/mocks';
 *
 * describe('UserProfile', () => {
 *   beforeEach(() => {
 *     testUtils.testQueryClient.clear();
 *   });
 *
 *   test('displays user information', async () => {
 *     const user = mockData.mockUser({ username: 'testuser' });
 *
 *     const { store } = testUtils.renderWithProviders(
 *       <UserProfile userId={user.id} />,
 *       {
 *         preloadedState: {
 *           auth: {
 *             user,
 *             isAuthenticated: true,
 *           }
 *         }
 *       }
 *     );
 *
 *     await testUtils.waitFor(() => {
 *       expect(testUtils.screen.getByText('testuser')).toBeInTheDocument();
 *     });
 *
 *     expect(store.getState().auth.isAuthenticated).toBe(true);
 *   });
 * });
 * ```
 */
export const testUtils = {
  // Custom test utilities
  renderWithProviders: utilsModule.renderWithProviders,
  setupStore: utilsModule.setupStore,
  testQueryClient: utilsModule.testQueryClient,

  // React Testing Library utilities
  screen: utilsModule.screen,
  fireEvent: utilsModule.fireEvent,
  waitFor: utilsModule.waitFor,
  within: utilsModule.within,
  render: utilsModule.render,
} as const;

// ============================================================================
// Type Exports
// ============================================================================

/**
 * Re-export type definitions for TypeScript support.
 *
 * These types are useful when you need to type function parameters
 * or component props that interact with the test utilities.
 *
 * @example
 * ```typescript
 * import type { RootState, AppStore, ExtendedRenderOptions } from '@/tests/mocks';
 *
 * function customRender(
 *   ui: React.ReactElement,
 *   options: ExtendedRenderOptions
 * ): { store: AppStore } {
 *   // Custom rendering logic
 * }
 *
 * const preloadedState: Partial<RootState> = {
 *   auth: {
 *     user: null,
 *     isAuthenticated: false,
 *     tokens: null,
 *     isLoading: false,
 *     error: null,
 *     status: 'idle',
 *   }
 * };
 * ```
 */
export type { AppStore, RootState, ExtendedRenderOptions } from './utils';
