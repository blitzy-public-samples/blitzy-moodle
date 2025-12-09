/**
 * Unit Tests for useChoiceResponse React Query Mutation Hook
 *
 * Comprehensive test suite validating the useChoiceResponse hook's functionality including:
 * - Optimistic UI updates for instant user feedback
 * - Cache invalidation strategies for data consistency
 * - Submission and deletion operations
 * - Concurrent request handling with proper locking mechanisms
 * - Error rollback behavior on submission failures
 * - Real-time result synchronization
 * - Client-side validation before API calls
 * - Toast notifications for user feedback
 *
 * Testing Strategy:
 * - Uses MSW (Mock Service Worker) for realistic HTTP mocking
 * - Uses React Testing Library's renderHook for hook testing
 * - Follows AAA (Arrange, Act, Assert) pattern
 * - Creates isolated QueryClient instances per test
 * - Seeds cache with choice data for optimistic update testing
 *
 * Based on requirements from Agent Action Plan Section 0.4 and 0.7.
 *
 * @module tests/unit/features/activities/choice/hooks/useChoiceResponse.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse, delay } from 'msw';
import type { ReactNode, FC } from 'react';
import React from 'react';

// Import the global MSW server from test infrastructure
import { server } from '@tests/mocks/server';

// Import the hook under test
import {
  useChoiceResponse,
  type ChoiceResponseResult,
} from '@/features/activities/choice/hooks/useChoiceResponse';

// Import Choice type from useChoice hook
import type { Choice, ChoiceOption } from '@/features/activities/choice/hooks/useChoice';

// Mock the useToast hook
vi.mock('@/hooks/useToast', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  }),
}));

// ============================================================================
// Test Constants
// ============================================================================

/** API base URL for test requests */
const API_BASE_URL = '/api/v1';

/** Default choice ID for tests */
const DEFAULT_CHOICE_ID = 1;

/** Default course ID for tests */
const DEFAULT_COURSE_ID = 100;

// ============================================================================
// Test Fixtures: Choice Options
// ============================================================================

/**
 * Creates a mock choice option with the specified overrides.
 *
 * @param overrides - Partial ChoiceOption to merge with defaults
 * @returns Complete ChoiceOption fixture
 */
function createMockChoiceOption(overrides: Partial<ChoiceOption> = {}): ChoiceOption {
  return {
    id: 1,
    text: 'Option A',
    maxanswers: 0,
    countanswers: 5,
    ...overrides,
  };
}

// ============================================================================
// Test Fixtures: Choice Entity
// ============================================================================

/**
 * Creates a complete mock Choice entity for testing.
 *
 * @param overrides - Partial Choice to merge with defaults
 * @returns Complete Choice fixture
 */
function createMockChoice(overrides: Partial<Choice> = {}): Choice {
  return {
    id: DEFAULT_CHOICE_ID,
    name: 'Test Choice Activity',
    intro: '<p>Please select your preferred option below.</p>',
    timeopen: 0,
    timeclose: 0,
    display: 1, // Vertical
    allowupdate: true,
    allowmultiple: false,
    limitanswers: false,
    showresults: 1, // After answer
    publish: 0, // Anonymous
    showunanswered: false,
    includeinactive: false,
    options: [
      createMockChoiceOption({ id: 1, text: 'Option A', countanswers: 5 }),
      createMockChoiceOption({ id: 2, text: 'Option B', countanswers: 3 }),
      createMockChoiceOption({ id: 3, text: 'Option C', countanswers: 2 }),
    ],
    userAnswer: {
      hasAnswered: false,
      selectedOptionIds: [],
      timemodified: 0,
      answerIds: [],
    },
    availability: {
      available: true,
      isOpen: true,
      isClosed: false,
      isPreview: false,
      warnings: [],
      openTime: 0,
      closeTime: 0,
    },
    permissions: {
      canChoose: true,
      canView: true,
      canManage: false,
      canUpdate: true,
      canViewResults: false,
      canDeleteOwn: true,
    },
    courseId: DEFAULT_COURSE_ID,
    cmid: 100,
    introformat: 1,
    completionsubmit: true,
    showavailable: true,
    showpreview: false,
    timemodified: Date.now() / 1000,
    ...overrides,
  };
}

/**
 * Creates a mock choice with multiple selection enabled.
 *
 * @returns Choice fixture with allowmultiple enabled
 */
function createMockMultipleChoice(): Choice {
  return createMockChoice({
    id: 2,
    name: 'Multiple Selection Choice',
    allowmultiple: true,
    options: [
      createMockChoiceOption({ id: 4, text: 'Option 1', countanswers: 3 }),
      createMockChoiceOption({ id: 5, text: 'Option 2', countanswers: 2 }),
      createMockChoiceOption({ id: 6, text: 'Option 3', countanswers: 1 }),
      createMockChoiceOption({ id: 7, text: 'Option 4', countanswers: 0 }),
    ],
  });
}

/**
 * Creates a mock choice with limited capacity on options.
 *
 * @returns Choice fixture with limitanswers enabled
 */
function createMockLimitedChoice(): Choice {
  return createMockChoice({
    id: 3,
    name: 'Limited Capacity Choice',
    limitanswers: true,
    showavailable: true,
    options: [
      createMockChoiceOption({ id: 8, text: 'Limited A', maxanswers: 10, countanswers: 8 }),
      createMockChoiceOption({ id: 9, text: 'Full Option', maxanswers: 5, countanswers: 5 }),
      createMockChoiceOption({ id: 10, text: 'Unlimited', maxanswers: 0, countanswers: 15 }),
    ],
  });
}

/**
 * Creates a mock choice with existing user answer.
 *
 * @returns Choice fixture with user having already answered
 */
function createMockAnsweredChoice(): Choice {
  return createMockChoice({
    id: 4,
    name: 'Already Answered Choice',
    userAnswer: {
      hasAnswered: true,
      selectedOptionIds: [1],
      timemodified: Date.now() / 1000 - 3600,
      answerIds: [101],
    },
  });
}

/**
 * Creates a mock choice that is closed.
 *
 * @returns Choice fixture with availability.isClosed = true
 */
function createMockClosedChoice(): Choice {
  return createMockChoice({
    id: 5,
    name: 'Closed Choice',
    timeclose: Date.now() / 1000 - 3600, // Closed 1 hour ago
    availability: {
      available: false,
      isOpen: false,
      isClosed: true,
      isPreview: false,
      warnings: ['This choice has closed'],
      openTime: 0,
      closeTime: Date.now() / 1000 - 3600,
    },
  });
}

/**
 * Creates a mock choice that hasn't opened yet.
 *
 * @returns Choice fixture with availability.isOpen = false
 */
function createMockNotYetOpenChoice(): Choice {
  return createMockChoice({
    id: 6,
    name: 'Not Yet Open Choice',
    timeopen: Date.now() / 1000 + 3600, // Opens in 1 hour
    availability: {
      available: false,
      isOpen: false,
      isClosed: false,
      isPreview: false,
      warnings: ['This choice is not yet open'],
      openTime: Date.now() / 1000 + 3600,
      closeTime: 0,
    },
  });
}

/**
 * Creates a mock choice where user cannot update.
 *
 * @returns Choice fixture with allowupdate = false
 */
function createMockNoUpdateChoice(): Choice {
  return createMockChoice({
    id: 7,
    name: 'No Update Choice',
    allowupdate: false,
    permissions: {
      canChoose: true,
      canView: true,
      canManage: false,
      canUpdate: false,
      canViewResults: false,
      canDeleteOwn: false,
    },
    userAnswer: {
      hasAnswered: true,
      selectedOptionIds: [1],
      timemodified: Date.now() / 1000 - 3600,
      answerIds: [102],
    },
  });
}

// ============================================================================
// API Response Helpers
// ============================================================================

/**
 * Creates a standard API success response envelope.
 *
 * @param data - The data payload to wrap
 * @returns API response envelope
 */
function createApiResponse<T>(data: T): { success: true; data: T } {
  return {
    success: true,
    data,
  };
}

/**
 * Creates a standard API error response.
 *
 * @param code - Error code
 * @param message - Error message
 * @returns API error response
 */
function createApiErrorResponse(
  code: string,
  message: string
): { success: false; error: { code: string; message: string } } {
  return {
    success: false,
    error: {
      code,
      message,
    },
  };
}

/**
 * Creates a successful choice response result.
 *
 * @param choice - The updated choice data
 * @param message - Success message
 * @returns ChoiceResponseResult
 */
function createSuccessResult(
  choice: Choice,
  message = 'Your response has been saved'
): ChoiceResponseResult {
  return {
    success: true,
    message,
    updatedChoice: choice,
  };
}

// ============================================================================
// MSW Server Setup
// ============================================================================

/**
 * Creates default MSW handlers for choice response API endpoints.
 *
 * @returns Array of MSW request handlers
 */
function createDefaultHandlers() {
  return [
    // Success handler for choice response submission
    http.post(`*${API_BASE_URL}/choices/:id/respond`, async ({ params, request }) => {
      const id = Number(params.id);
      const body = (await request.json()) as { answer: number[]; action?: string };

      // Create updated choice based on submission
      const choice = createMockChoice({ id });
      const updatedChoice: Choice = {
        ...choice,
        userAnswer: {
          hasAnswered: body.action !== 'delete' && body.answer.length > 0,
          selectedOptionIds: body.action === 'delete' ? [] : body.answer,
          timemodified: Date.now() / 1000,
          answerIds: body.action === 'delete' ? [] : [1001],
        },
        options: choice.options.map((opt) => {
          const isSelected = body.answer.includes(opt.id);
          return {
            ...opt,
            countanswers: isSelected ? opt.countanswers + 1 : opt.countanswers,
          };
        }),
      };

      const message =
        body.action === 'delete'
          ? 'Your response has been deleted'
          : 'Your response has been saved';

      return HttpResponse.json(
        createApiResponse(createSuccessResult(updatedChoice, message))
      );
    }),
  ];
}

// ============================================================================
// Test Wrapper Component
// ============================================================================

/**
 * Creates a test wrapper component with QueryClientProvider.
 *
 * @param queryClient - The QueryClient instance to use
 * @returns Wrapper component for renderHook
 */
function createWrapper(queryClient: QueryClient): FC<{ children: ReactNode }> {
  return function Wrapper({ children }: { children: ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

// ============================================================================
// Cache Helper Functions
// ============================================================================

/**
 * Seeds the query client cache with choice data.
 *
 * @param queryClient - The QueryClient instance
 * @param choice - The choice data to seed
 */
function seedChoiceCache(queryClient: QueryClient, choice: Choice): void {
  queryClient.setQueryData(['choices', choice.id], choice);
}

/**
 * Gets the cached choice data.
 *
 * @param queryClient - The QueryClient instance
 * @param choiceId - The choice ID
 * @returns The cached choice data or undefined
 */
function getCachedChoice(queryClient: QueryClient, choiceId: number): Choice | undefined {
  return queryClient.getQueryData<Choice>(['choices', choiceId]);
}

// ============================================================================
// Test Suite
// ============================================================================

describe('useChoiceResponse Hook', () => {
  let queryClient: QueryClient;

  // Register default handlers and create fresh QueryClient before each test
  beforeEach(() => {
    // Register test-specific handlers with the global server
    server.use(...createDefaultHandlers());

    // Create fresh QueryClient for test isolation
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 10 * 60 * 1000, // 10 minutes
          staleTime: 0,
        },
        mutations: {
          retry: false,
        },
      },
    });
  });

  // Reset handlers and clear QueryClient after each test
  afterEach(() => {
    server.resetHandlers();
    queryClient.clear();
    vi.clearAllMocks();
  });

  // ==========================================================================
  // Test Setup and Configuration
  // ==========================================================================

  describe('Test Setup and Configuration', () => {
    it('should create QueryClient with correct configuration', () => {
      // Arrange & Act
      const client = new QueryClient({
        defaultOptions: {
          mutations: {
            retry: false,
          },
        },
      });

      // Assert
      expect(client).toBeDefined();
      expect(client.getDefaultOptions().mutations?.retry).toBe(false);
    });

    it('should have mock fixtures with valid data', () => {
      // Arrange & Act
      const choice = createMockChoice();

      // Assert
      expect(choice.id).toBe(DEFAULT_CHOICE_ID);
      expect(choice.name).toBe('Test Choice Activity');
      expect(choice.options).toHaveLength(3);
      expect(choice.userAnswer.hasAnswered).toBe(false);
      expect(choice.availability.available).toBe(true);
      expect(choice.permissions.canChoose).toBe(true);
    });

    it('should render hook without errors', () => {
      // Arrange
      const wrapper = createWrapper(queryClient);

      // Act
      const { result } = renderHook(() => useChoiceResponse(), { wrapper });

      // Assert
      expect(result.current).toBeDefined();
      expect(result.current.mutate).toBeDefined();
      expect(result.current.mutateAsync).toBeDefined();
      expect(result.current.isPending).toBe(false);
      expect(result.current.isError).toBe(false);
      expect(result.current.isSuccess).toBe(false);
    });
  });

  // ==========================================================================
  // Optimistic Update Tests
  // ==========================================================================

  describe('Optimistic Updates', () => {
    it('should update cache immediately before API call completes', async () => {
      // Arrange
      const wrapper = createWrapper(queryClient);
      const choice = createMockChoice();
      seedChoiceCache(queryClient, choice);

      // Add delay to API response to verify optimistic update happens first
      server.use(
        http.post(`*${API_BASE_URL}/choices/:id/respond`, async () => {
          await delay(500);
          const updatedChoice = {
            ...choice,
            userAnswer: {
              hasAnswered: true,
              selectedOptionIds: [2],
              timemodified: Date.now() / 1000,
              answerIds: [1001],
            },
          };
          return HttpResponse.json(
            createApiResponse(createSuccessResult(updatedChoice))
          );
        })
      );

      const { result } = renderHook(() => useChoiceResponse(), { wrapper });

      // Act
      act(() => {
        result.current.mutate({
          choiceId: choice.id,
          answer: 2,
          courseId: DEFAULT_COURSE_ID,
        });
      });

      // Assert - Check optimistic update immediately (before API completes)
      const cachedChoice = getCachedChoice(queryClient, choice.id);
      expect(cachedChoice?.userAnswer.hasAnswered).toBe(true);
      expect(cachedChoice?.userAnswer.selectedOptionIds).toContain(2);

      // Wait for mutation to complete
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
    });

    it('should optimistically increment countanswers for selected option', async () => {
      // Arrange
      const wrapper = createWrapper(queryClient);
      const choice = createMockChoice();
      seedChoiceCache(queryClient, choice);

      const originalCount = choice.options[1]!.countanswers; // Option B

      server.use(
        http.post(`*${API_BASE_URL}/choices/:id/respond`, async () => {
          await delay(200);
          const updatedChoice = createMockChoice();
          updatedChoice.options[1]!.countanswers = originalCount + 1;
          return HttpResponse.json(
            createApiResponse(createSuccessResult(updatedChoice))
          );
        })
      );

      const { result } = renderHook(() => useChoiceResponse(), { wrapper });

      // Act
      act(() => {
        result.current.mutate({
          choiceId: choice.id,
          answer: 2, // Option B (index 1)
          courseId: DEFAULT_COURSE_ID,
        });
      });

      // Assert optimistic update
      const cachedChoice = getCachedChoice(queryClient, choice.id);
      const option = cachedChoice?.options.find((o) => o.id === 2);
      expect(option?.countanswers).toBe(originalCount + 1);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });

    it('should preserve previous state for rollback capability', async () => {
      // Arrange
      const wrapper = createWrapper(queryClient);
      const choice = createMockChoice();
      seedChoiceCache(queryClient, choice);

      // Simulate API error
      server.use(
        http.post(`*${API_BASE_URL}/choices/:id/respond`, () => {
          return HttpResponse.json(
            createApiErrorResponse('SUBMISSION_FAILED', 'Server error'),
            { status: 500 }
          );
        })
      );

      const { result } = renderHook(() => useChoiceResponse(), { wrapper });

      // Act
      act(() => {
        result.current.mutate({
          choiceId: choice.id,
          answer: 2,
          courseId: DEFAULT_COURSE_ID,
        });
      });

      // Wait for error
      await waitFor(() => expect(result.current.isError).toBe(true));

      // Assert - Cache should be rolled back to original state
      const cachedChoice = getCachedChoice(queryClient, choice.id);
      expect(cachedChoice?.userAnswer.hasAnswered).toBe(false);
      expect(cachedChoice?.userAnswer.selectedOptionIds).toEqual([]);
    });

    it('should handle multiple rapid submissions maintaining correct optimistic state', async () => {
      // Arrange
      const wrapper = createWrapper(queryClient);
      const choice = createMockMultipleChoice();
      seedChoiceCache(queryClient, choice);

      server.use(
        http.post(`*${API_BASE_URL}/choices/:id/respond`, async ({ request }) => {
          await delay(100);
          const body = (await request.json()) as { answer: number[] };
          const updatedChoice = {
            ...choice,
            userAnswer: {
              hasAnswered: true,
              selectedOptionIds: body.answer,
              timemodified: Date.now() / 1000,
              answerIds: [1001, 1002],
            },
          };
          return HttpResponse.json(
            createApiResponse(createSuccessResult(updatedChoice))
          );
        })
      );

      const { result } = renderHook(() => useChoiceResponse(), { wrapper });

      // Act - Submit with multiple options
      act(() => {
        result.current.mutate({
          choiceId: choice.id,
          answer: [4, 5],
          courseId: DEFAULT_COURSE_ID,
        });
      });

      // Assert optimistic state contains both selections
      const cachedChoice = getCachedChoice(queryClient, choice.id);
      expect(cachedChoice?.userAnswer.selectedOptionIds).toContain(4);
      expect(cachedChoice?.userAnswer.selectedOptionIds).toContain(5);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });

    it('should decrement countanswers when changing selection', async () => {
      // Arrange
      const wrapper = createWrapper(queryClient);
      const choice = createMockAnsweredChoice();
      seedChoiceCache(queryClient, choice);

      const originalOption1Count = choice.options[0]!.countanswers;
      const originalOption2Count = choice.options[1]!.countanswers;

      server.use(
        http.post(`*${API_BASE_URL}/choices/:id/respond`, async () => {
          await delay(100);
          const updatedChoice = {
            ...choice,
            userAnswer: {
              hasAnswered: true,
              selectedOptionIds: [2],
              timemodified: Date.now() / 1000,
              answerIds: [1001],
            },
          };
          return HttpResponse.json(
            createApiResponse(createSuccessResult(updatedChoice))
          );
        })
      );

      const { result } = renderHook(() => useChoiceResponse(), { wrapper });

      // Act - Change from option 1 to option 2
      act(() => {
        result.current.mutate({
          choiceId: choice.id,
          answer: 2,
          courseId: DEFAULT_COURSE_ID,
        });
      });

      // Assert optimistic update decrements old and increments new
      const cachedChoice = getCachedChoice(queryClient, choice.id);
      const option1 = cachedChoice?.options.find((o) => o.id === 1);
      const option2 = cachedChoice?.options.find((o) => o.id === 2);

      expect(option1?.countanswers).toBe(originalOption1Count - 1);
      expect(option2?.countanswers).toBe(originalOption2Count + 1);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });
  });

  // ==========================================================================
  // Submission Success Tests
  // ==========================================================================

  describe('Submission Success', () => {
    it('should successfully submit single choice selection', async () => {
      // Arrange
      const wrapper = createWrapper(queryClient);
      const choice = createMockChoice();
      seedChoiceCache(queryClient, choice);

      const { result } = renderHook(() => useChoiceResponse(), { wrapper });

      // Act
      act(() => {
        result.current.mutate({
          choiceId: choice.id,
          answer: 2,
          courseId: DEFAULT_COURSE_ID,
        });
      });

      // Assert
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.success).toBe(true);
      expect(result.current.data?.message).toBe('Your response has been saved');
    });

    it('should successfully submit multiple choice selections', async () => {
      // Arrange
      const wrapper = createWrapper(queryClient);
      const choice = createMockMultipleChoice();
      seedChoiceCache(queryClient, choice);

      server.use(
        http.post(`*${API_BASE_URL}/choices/:id/respond`, async ({ request }) => {
          const body = (await request.json()) as { answer: number[] };
          const updatedChoice = {
            ...choice,
            userAnswer: {
              hasAnswered: true,
              selectedOptionIds: body.answer,
              timemodified: Date.now() / 1000,
              answerIds: [1001, 1002],
            },
          };
          return HttpResponse.json(
            createApiResponse(createSuccessResult(updatedChoice))
          );
        })
      );

      const { result } = renderHook(() => useChoiceResponse(), { wrapper });

      // Act
      act(() => {
        result.current.mutate({
          choiceId: choice.id,
          answer: [4, 5, 6],
          courseId: DEFAULT_COURSE_ID,
        });
      });

      // Assert
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.success).toBe(true);
      expect(result.current.data?.updatedChoice.userAnswer.selectedOptionIds).toEqual([4, 5, 6]);
    });

    it('should update cache with server-confirmed data on success', async () => {
      // Arrange
      const wrapper = createWrapper(queryClient);
      const choice = createMockChoice();
      seedChoiceCache(queryClient, choice);

      const serverAnswerId = 9999;
      server.use(
        http.post(`*${API_BASE_URL}/choices/:id/respond`, async () => {
          const updatedChoice = {
            ...choice,
            userAnswer: {
              hasAnswered: true,
              selectedOptionIds: [2],
              timemodified: Date.now() / 1000,
              answerIds: [serverAnswerId],
            },
          };
          return HttpResponse.json(
            createApiResponse(createSuccessResult(updatedChoice))
          );
        })
      );

      const { result } = renderHook(() => useChoiceResponse(), { wrapper });

      // Act
      act(() => {
        result.current.mutate({
          choiceId: choice.id,
          answer: 2,
          courseId: DEFAULT_COURSE_ID,
        });
      });

      // Wait for success
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Assert - Cache should have server-confirmed answerIds
      const cachedChoice = getCachedChoice(queryClient, choice.id);
      expect(cachedChoice?.userAnswer.answerIds).toContain(serverAnswerId);
    });

    it('should set isSuccess to true after successful submission', async () => {
      // Arrange
      const wrapper = createWrapper(queryClient);
      const choice = createMockChoice();
      seedChoiceCache(queryClient, choice);

      const { result } = renderHook(() => useChoiceResponse(), { wrapper });

      // Assert initial state
      expect(result.current.isSuccess).toBe(false);

      // Act
      act(() => {
        result.current.mutate({
          choiceId: choice.id,
          answer: 1,
          courseId: DEFAULT_COURSE_ID,
        });
      });

      // Assert
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
        expect(result.current.isError).toBe(false);
        expect(result.current.isPending).toBe(false);
      });
    });

    it('should call correct API endpoint with proper payload', async () => {
      // Arrange
      const wrapper = createWrapper(queryClient);
      const choice = createMockChoice();
      seedChoiceCache(queryClient, choice);

      let capturedRequest: { answer: number[]; action?: string } | null = null;

      server.use(
        http.post(`*${API_BASE_URL}/choices/:id/respond`, async ({ request }) => {
          capturedRequest = (await request.json()) as { answer: number[]; action?: string };
          const updatedChoice = {
            ...choice,
            userAnswer: {
              hasAnswered: true,
              selectedOptionIds: capturedRequest.answer,
              timemodified: Date.now() / 1000,
              answerIds: [1001],
            },
          };
          return HttpResponse.json(
            createApiResponse(createSuccessResult(updatedChoice))
          );
        })
      );

      const { result } = renderHook(() => useChoiceResponse(), { wrapper });

      // Act
      act(() => {
        result.current.mutate({
          choiceId: choice.id,
          answer: 3,
          courseId: DEFAULT_COURSE_ID,
        });
      });

      // Assert
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(capturedRequest).not.toBeNull();
      expect(capturedRequest!.answer).toEqual([3]);
      expect(capturedRequest!.action).toBe('submit');
    });
  });

  // ==========================================================================
  // Submission Error Tests
  // ==========================================================================

  describe('Submission Errors', () => {
    it('should rollback optimistic update on API error', async () => {
      // Arrange
      const wrapper = createWrapper(queryClient);
      const choice = createMockChoice();
      seedChoiceCache(queryClient, choice);

      server.use(
        http.post(`*${API_BASE_URL}/choices/:id/respond`, () => {
          return HttpResponse.json(
            createApiErrorResponse('SERVER_ERROR', 'Internal server error'),
            { status: 500 }
          );
        })
      );

      const { result } = renderHook(() => useChoiceResponse(), { wrapper });

      // Act
      act(() => {
        result.current.mutate({
          choiceId: choice.id,
          answer: 2,
          courseId: DEFAULT_COURSE_ID,
        });
      });

      // Wait for error
      await waitFor(() => expect(result.current.isError).toBe(true));

      // Assert - Cache should be restored
      const cachedChoice = getCachedChoice(queryClient, choice.id);
      expect(cachedChoice?.userAnswer.hasAnswered).toBe(false);
      expect(cachedChoice?.userAnswer.selectedOptionIds).toEqual([]);
    });

    it('should set isError state correctly on failure', async () => {
      // Arrange
      const wrapper = createWrapper(queryClient);
      const choice = createMockChoice();
      seedChoiceCache(queryClient, choice);

      server.use(
        http.post(`*${API_BASE_URL}/choices/:id/respond`, () => {
          return HttpResponse.json(
            createApiErrorResponse('SUBMISSION_FAILED', 'Submission failed'),
            { status: 400 }
          );
        })
      );

      const { result } = renderHook(() => useChoiceResponse(), { wrapper });

      // Act
      act(() => {
        result.current.mutate({
          choiceId: choice.id,
          answer: 2,
          courseId: DEFAULT_COURSE_ID,
        });
      });

      // Assert
      await waitFor(() => {
        expect(result.current.isError).toBe(true);
        expect(result.current.isSuccess).toBe(false);
      });

      expect(result.current.error).toBeDefined();
    });

    it('should handle permission denied errors gracefully', async () => {
      // Arrange
      const wrapper = createWrapper(queryClient);
      const choice = createMockChoice({
        permissions: {
          canChoose: false,
          canView: true,
          canManage: false,
          canUpdate: false,
          canViewResults: false,
          canDeleteOwn: false,
        },
      });
      seedChoiceCache(queryClient, choice);

      const { result } = renderHook(() => useChoiceResponse(), { wrapper });

      // Act
      act(() => {
        result.current.mutate({
          choiceId: choice.id,
          answer: 2,
          courseId: DEFAULT_COURSE_ID,
        });
      });

      // Assert - Should fail validation before API call
      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error?.message).toContain('permission');
    });

    it('should handle choice closed errors', async () => {
      // Arrange
      const wrapper = createWrapper(queryClient);
      const choice = createMockClosedChoice();
      seedChoiceCache(queryClient, choice);

      const { result } = renderHook(() => useChoiceResponse(), { wrapper });

      // Act
      act(() => {
        result.current.mutate({
          choiceId: choice.id,
          answer: 2,
          courseId: DEFAULT_COURSE_ID,
        });
      });

      // Assert
      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error?.message.toLowerCase()).toContain('closed');
    });

    it('should handle capacity exceeded errors', async () => {
      // Arrange
      const wrapper = createWrapper(queryClient);
      const choice = createMockLimitedChoice();
      seedChoiceCache(queryClient, choice);

      const { result } = renderHook(() => useChoiceResponse(), { wrapper });

      // Act - Try to select the full option (id: 9)
      act(() => {
        result.current.mutate({
          choiceId: choice.id,
          answer: 9,
          courseId: DEFAULT_COURSE_ID,
        });
      });

      // Assert
      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error?.message.toLowerCase()).toContain('capacity');
    });

    it('should handle network errors without corrupting cache state', async () => {
      // Arrange
      const wrapper = createWrapper(queryClient);
      const choice = createMockChoice();
      const originalChoiceData = { ...choice };
      seedChoiceCache(queryClient, choice);

      server.use(
        http.post(`*${API_BASE_URL}/choices/:id/respond`, () => {
          return HttpResponse.error();
        })
      );

      const { result } = renderHook(() => useChoiceResponse(), { wrapper });

      // Act
      act(() => {
        result.current.mutate({
          choiceId: choice.id,
          answer: 2,
          courseId: DEFAULT_COURSE_ID,
        });
      });

      // Wait for error
      await waitFor(() => expect(result.current.isError).toBe(true));

      // Assert - Cache should be restored to original state
      const cachedChoice = getCachedChoice(queryClient, choice.id);
      expect(cachedChoice?.userAnswer.hasAnswered).toBe(originalChoiceData.userAnswer.hasAnswered);
      expect(cachedChoice?.userAnswer.selectedOptionIds).toEqual(
        originalChoiceData.userAnswer.selectedOptionIds
      );
    });
  });

  // ==========================================================================
  // Cache Invalidation Tests
  // ==========================================================================

  describe('Cache Invalidation', () => {
    it('should invalidate choice query after successful submission', async () => {
      // Arrange
      const wrapper = createWrapper(queryClient);
      const choice = createMockChoice();
      seedChoiceCache(queryClient, choice);

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useChoiceResponse(), { wrapper });

      // Act
      act(() => {
        result.current.mutate({
          choiceId: choice.id,
          answer: 2,
          courseId: DEFAULT_COURSE_ID,
        });
      });

      // Wait for success
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Assert - Should invalidate choice query
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          queryKey: ['choices', choice.id],
        })
      );
    });

    it('should invalidate course activities query after submission', async () => {
      // Arrange
      const wrapper = createWrapper(queryClient);
      const choice = createMockChoice();
      seedChoiceCache(queryClient, choice);

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useChoiceResponse(), { wrapper });

      // Act
      act(() => {
        result.current.mutate({
          choiceId: choice.id,
          answer: 2,
          courseId: DEFAULT_COURSE_ID,
        });
      });

      // Wait for success
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Assert
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          queryKey: ['courses', DEFAULT_COURSE_ID, 'activities'],
        })
      );
    });

    it('should invalidate dashboard query after submission', async () => {
      // Arrange
      const wrapper = createWrapper(queryClient);
      const choice = createMockChoice();
      seedChoiceCache(queryClient, choice);

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useChoiceResponse(), { wrapper });

      // Act
      act(() => {
        result.current.mutate({
          choiceId: choice.id,
          answer: 2,
          courseId: DEFAULT_COURSE_ID,
        });
      });

      // Wait for success
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Assert
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          queryKey: ['dashboard'],
        })
      );
    });

    it('should run onSettled after both success and error', async () => {
      // Arrange
      const wrapper = createWrapper(queryClient);
      const choice = createMockChoice();
      seedChoiceCache(queryClient, choice);

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      // Test with error
      server.use(
        http.post(`*${API_BASE_URL}/choices/:id/respond`, () => {
          return HttpResponse.json(
            createApiErrorResponse('ERROR', 'Test error'),
            { status: 500 }
          );
        })
      );

      const { result } = renderHook(() => useChoiceResponse(), { wrapper });

      // Act
      act(() => {
        result.current.mutate({
          choiceId: choice.id,
          answer: 2,
          courseId: DEFAULT_COURSE_ID,
        });
      });

      // Wait for error
      await waitFor(() => expect(result.current.isError).toBe(true));

      // Assert - onSettled should still run and invalidate queries
      expect(invalidateSpy).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Delete Response Tests
  // ==========================================================================

  describe('Delete Response', () => {
    it('should successfully delete user response', async () => {
      // Arrange
      const wrapper = createWrapper(queryClient);
      const choice = createMockAnsweredChoice();
      seedChoiceCache(queryClient, choice);

      server.use(
        http.post(`*${API_BASE_URL}/choices/:id/respond`, async ({ request }) => {
          const body = (await request.json()) as { action?: string };
          if (body.action === 'delete') {
            const updatedChoice = {
              ...choice,
              userAnswer: {
                hasAnswered: false,
                selectedOptionIds: [],
                timemodified: Date.now() / 1000,
                answerIds: [],
              },
            };
            return HttpResponse.json(
              createApiResponse(
                createSuccessResult(updatedChoice, 'Your response has been deleted')
              )
            );
          }
          return HttpResponse.json(
            createApiErrorResponse('INVALID_ACTION', 'Invalid action')
          );
        })
      );

      const { result } = renderHook(() => useChoiceResponse(), { wrapper });

      // Act
      act(() => {
        result.current.mutate({
          choiceId: choice.id,
          answer: [],
          action: 'delete',
          courseId: DEFAULT_COURSE_ID,
        });
      });

      // Assert
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.message).toBe('Your response has been deleted');
    });

    it('should optimistically remove user answer on delete', async () => {
      // Arrange
      const wrapper = createWrapper(queryClient);
      const choice = createMockAnsweredChoice();
      seedChoiceCache(queryClient, choice);

      server.use(
        http.post(`*${API_BASE_URL}/choices/:id/respond`, async () => {
          await delay(200);
          const updatedChoice = {
            ...choice,
            userAnswer: {
              hasAnswered: false,
              selectedOptionIds: [],
              timemodified: Date.now() / 1000,
              answerIds: [],
            },
          };
          return HttpResponse.json(
            createApiResponse(createSuccessResult(updatedChoice, 'Deleted'))
          );
        })
      );

      const { result } = renderHook(() => useChoiceResponse(), { wrapper });

      // Act
      act(() => {
        result.current.mutate({
          choiceId: choice.id,
          answer: [],
          action: 'delete',
          courseId: DEFAULT_COURSE_ID,
        });
      });

      // Assert optimistic update
      const cachedChoice = getCachedChoice(queryClient, choice.id);
      expect(cachedChoice?.userAnswer.hasAnswered).toBe(false);
      expect(cachedChoice?.userAnswer.selectedOptionIds).toEqual([]);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });

    it('should decrement countanswers on delete', async () => {
      // Arrange
      const wrapper = createWrapper(queryClient);
      const choice = createMockAnsweredChoice();
      seedChoiceCache(queryClient, choice);

      const originalCount = choice.options[0]!.countanswers;

      server.use(
        http.post(`*${API_BASE_URL}/choices/:id/respond`, async () => {
          await delay(100);
          const updatedChoice = {
            ...choice,
            options: choice.options.map((opt) =>
              opt.id === 1 ? { ...opt, countanswers: opt.countanswers - 1 } : opt
            ),
            userAnswer: {
              hasAnswered: false,
              selectedOptionIds: [],
              timemodified: Date.now() / 1000,
              answerIds: [],
            },
          };
          return HttpResponse.json(
            createApiResponse(createSuccessResult(updatedChoice))
          );
        })
      );

      const { result } = renderHook(() => useChoiceResponse(), { wrapper });

      // Act
      act(() => {
        result.current.mutate({
          choiceId: choice.id,
          answer: [],
          action: 'delete',
          courseId: DEFAULT_COURSE_ID,
        });
      });

      // Assert optimistic decrement
      const cachedChoice = getCachedChoice(queryClient, choice.id);
      const option = cachedChoice?.options.find((o) => o.id === 1);
      expect(option?.countanswers).toBe(originalCount - 1);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });

    it('should fail delete when allowupdate is false', async () => {
      // Arrange
      const wrapper = createWrapper(queryClient);
      const choice = createMockNoUpdateChoice();
      seedChoiceCache(queryClient, choice);

      const { result } = renderHook(() => useChoiceResponse(), { wrapper });

      // Act
      act(() => {
        result.current.mutate({
          choiceId: choice.id,
          answer: [],
          action: 'delete',
          courseId: DEFAULT_COURSE_ID,
        });
      });

      // Assert
      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error?.message).toContain('not allow');
    });

    it('should fail delete when no response exists', async () => {
      // Arrange
      const wrapper = createWrapper(queryClient);
      const choice = createMockChoice(); // No existing answer
      seedChoiceCache(queryClient, choice);

      const { result } = renderHook(() => useChoiceResponse(), { wrapper });

      // Act
      act(() => {
        result.current.mutate({
          choiceId: choice.id,
          answer: [],
          action: 'delete',
          courseId: DEFAULT_COURSE_ID,
        });
      });

      // Assert
      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error?.message.toLowerCase()).toContain('no response');
    });
  });

  // ==========================================================================
  // Validation Tests
  // ==========================================================================

  describe('Client-Side Validation', () => {
    it('should prevent empty submission when no options selected', async () => {
      // Arrange
      const wrapper = createWrapper(queryClient);
      const choice = createMockChoice();
      seedChoiceCache(queryClient, choice);

      const { result } = renderHook(() => useChoiceResponse(), { wrapper });

      // Act - Submit with empty array (not delete action)
      act(() => {
        result.current.mutate({
          choiceId: choice.id,
          answer: [],
          courseId: DEFAULT_COURSE_ID,
        });
      });

      // Assert
      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error?.message).toContain('select at least one');
    });

    it('should prevent multiple selections when allowmultiple is false', async () => {
      // Arrange
      const wrapper = createWrapper(queryClient);
      const choice = createMockChoice(); // allowmultiple: false
      seedChoiceCache(queryClient, choice);

      const { result } = renderHook(() => useChoiceResponse(), { wrapper });

      // Act - Try to submit multiple selections
      act(() => {
        result.current.mutate({
          choiceId: choice.id,
          answer: [1, 2],
          courseId: DEFAULT_COURSE_ID,
        });
      });

      // Assert
      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error?.message.toLowerCase()).toContain('one option');
    });

    it('should allow multiple selections when allowmultiple is true', async () => {
      // Arrange
      const wrapper = createWrapper(queryClient);
      const choice = createMockMultipleChoice();
      seedChoiceCache(queryClient, choice);

      const { result } = renderHook(() => useChoiceResponse(), { wrapper });

      // Act
      act(() => {
        result.current.mutate({
          choiceId: choice.id,
          answer: [4, 5, 6],
          courseId: DEFAULT_COURSE_ID,
        });
      });

      // Assert
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });

    it('should validate all optionIds exist in choice options', async () => {
      // Arrange
      const wrapper = createWrapper(queryClient);
      const choice = createMockChoice();
      seedChoiceCache(queryClient, choice);

      const { result } = renderHook(() => useChoiceResponse(), { wrapper });

      // Act - Submit with invalid option ID
      act(() => {
        result.current.mutate({
          choiceId: choice.id,
          answer: 999, // Non-existent option
          courseId: DEFAULT_COURSE_ID,
        });
      });

      // Assert
      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error?.message).toContain('Invalid option');
    });

    it('should prevent submission for not-yet-open choices', async () => {
      // Arrange
      const wrapper = createWrapper(queryClient);
      const choice = createMockNotYetOpenChoice();
      seedChoiceCache(queryClient, choice);

      const { result } = renderHook(() => useChoiceResponse(), { wrapper });

      // Act
      act(() => {
        result.current.mutate({
          choiceId: choice.id,
          answer: 1,
          courseId: DEFAULT_COURSE_ID,
        });
      });

      // Assert
      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error?.message.toLowerCase()).toContain('not yet open');
    });

    it('should prevent submission when user already answered and cannot update', async () => {
      // Arrange
      const wrapper = createWrapper(queryClient);
      const choice = createMockNoUpdateChoice();
      seedChoiceCache(queryClient, choice);

      const { result } = renderHook(() => useChoiceResponse(), { wrapper });

      // Act
      act(() => {
        result.current.mutate({
          choiceId: choice.id,
          answer: 2,
          courseId: DEFAULT_COURSE_ID,
        });
      });

      // Assert
      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error?.message.toLowerCase()).toContain('cannot change');
    });

    it('should validate invalid choiceId', async () => {
      // Arrange
      const wrapper = createWrapper(queryClient);

      const { result } = renderHook(() => useChoiceResponse(), { wrapper });

      // Act
      act(() => {
        result.current.mutate({
          choiceId: -1, // Invalid ID
          answer: 1,
          courseId: DEFAULT_COURSE_ID,
        });
      });

      // Assert
      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error?.message).toContain('Invalid choice ID');
    });
  });

  // ==========================================================================
  // Concurrent Request Handling Tests
  // ==========================================================================

  describe('Concurrent Request Handling', () => {
    it('should serialize concurrent submissions correctly', async () => {
      // Arrange
      const wrapper = createWrapper(queryClient);
      const choice = createMockChoice();
      seedChoiceCache(queryClient, choice);

      let requestCount = 0;
      server.use(
        http.post(`*${API_BASE_URL}/choices/:id/respond`, async ({ request }) => {
          requestCount++;
          await delay(100);
          const body = (await request.json()) as { answer: number[] };
          const updatedChoice = {
            ...choice,
            userAnswer: {
              hasAnswered: true,
              selectedOptionIds: body.answer,
              timemodified: Date.now() / 1000,
              answerIds: [requestCount],
            },
          };
          return HttpResponse.json(
            createApiResponse(createSuccessResult(updatedChoice))
          );
        })
      );

      const { result: result1 } = renderHook(() => useChoiceResponse(), { wrapper });
      const { result: result2 } = renderHook(() => useChoiceResponse(), { wrapper });

      // Act - Submit two requests simultaneously
      act(() => {
        result1.current.mutate({
          choiceId: choice.id,
          answer: 1,
          courseId: DEFAULT_COURSE_ID,
        });
        result2.current.mutate({
          choiceId: choice.id,
          answer: 2,
          courseId: DEFAULT_COURSE_ID,
        });
      });

      // Wait for both to complete
      await waitFor(() => {
        return result1.current.isSuccess || result1.current.isError;
      });
      await waitFor(() => {
        return result2.current.isSuccess || result2.current.isError;
      });

      // Assert - Both requests were made
      expect(requestCount).toBe(2);
    });

    it('should handle cancellation of concurrent queries correctly', async () => {
      // Arrange
      const wrapper = createWrapper(queryClient);
      const choice = createMockChoice();
      seedChoiceCache(queryClient, choice);

      const cancelSpy = vi.spyOn(queryClient, 'cancelQueries');

      server.use(
        http.post(`*${API_BASE_URL}/choices/:id/respond`, async () => {
          await delay(100);
          const updatedChoice = {
            ...choice,
            userAnswer: {
              hasAnswered: true,
              selectedOptionIds: [2],
              timemodified: Date.now() / 1000,
              answerIds: [1001],
            },
          };
          return HttpResponse.json(
            createApiResponse(createSuccessResult(updatedChoice))
          );
        })
      );

      const { result } = renderHook(() => useChoiceResponse(), { wrapper });

      // Act
      act(() => {
        result.current.mutate({
          choiceId: choice.id,
          answer: 2,
          courseId: DEFAULT_COURSE_ID,
        });
      });

      // Wait for completion
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Assert - cancelQueries should have been called for the choice query
      expect(cancelSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          queryKey: ['choices', choice.id],
        })
      );
    });
  });

  // ==========================================================================
  // Mutation State Tests
  // ==========================================================================

  describe('Mutation State', () => {
    it('should have isPending true during API call', async () => {
      // Arrange
      const wrapper = createWrapper(queryClient);
      const choice = createMockChoice();
      seedChoiceCache(queryClient, choice);

      server.use(
        http.post(`*${API_BASE_URL}/choices/:id/respond`, async () => {
          await delay(200);
          const updatedChoice = {
            ...choice,
            userAnswer: {
              hasAnswered: true,
              selectedOptionIds: [2],
              timemodified: Date.now() / 1000,
              answerIds: [1001],
            },
          };
          return HttpResponse.json(
            createApiResponse(createSuccessResult(updatedChoice))
          );
        })
      );

      const { result } = renderHook(() => useChoiceResponse(), { wrapper });

      // Act
      act(() => {
        result.current.mutate({
          choiceId: choice.id,
          answer: 2,
          courseId: DEFAULT_COURSE_ID,
        });
      });

      // Assert - Should be pending immediately
      expect(result.current.isPending).toBe(true);

      // Wait for completion
      await waitFor(() => expect(result.current.isPending).toBe(false));
    });

    it('should have isPending false after completion', async () => {
      // Arrange
      const wrapper = createWrapper(queryClient);
      const choice = createMockChoice();
      seedChoiceCache(queryClient, choice);

      const { result } = renderHook(() => useChoiceResponse(), { wrapper });

      // Act
      act(() => {
        result.current.mutate({
          choiceId: choice.id,
          answer: 2,
          courseId: DEFAULT_COURSE_ID,
        });
      });

      // Assert
      await waitFor(() => {
        expect(result.current.isPending).toBe(false);
        expect(result.current.isSuccess).toBe(true);
      });
    });

    it('should have stable mutate function across renders', () => {
      // Arrange
      const wrapper = createWrapper(queryClient);

      // Act
      const { result, rerender } = renderHook(() => useChoiceResponse(), { wrapper });
      const firstMutate = result.current.mutate;

      rerender();
      const secondMutate = result.current.mutate;

      // Assert
      expect(firstMutate).toBe(secondMutate);
    });

    it('should have mutateAsync function that returns promise', async () => {
      // Arrange
      const wrapper = createWrapper(queryClient);
      const choice = createMockChoice();
      seedChoiceCache(queryClient, choice);

      const { result } = renderHook(() => useChoiceResponse(), { wrapper });

      // Act & Assert
      const promise = result.current.mutateAsync({
        choiceId: choice.id,
        answer: 2,
        courseId: DEFAULT_COURSE_ID,
      });

      expect(promise).toBeInstanceOf(Promise);

      const data = await promise;
      expect(data.success).toBe(true);
    });

    it('should reset mutation state with reset function', async () => {
      // Arrange
      const wrapper = createWrapper(queryClient);
      const choice = createMockChoice();
      seedChoiceCache(queryClient, choice);

      const { result } = renderHook(() => useChoiceResponse(), { wrapper });

      // First, make a successful mutation
      act(() => {
        result.current.mutate({
          choiceId: choice.id,
          answer: 2,
          courseId: DEFAULT_COURSE_ID,
        });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Act - Reset the mutation
      act(() => {
        result.current.reset();
      });

      // Assert
      expect(result.current.isSuccess).toBe(false);
      expect(result.current.isError).toBe(false);
      expect(result.current.data).toBeUndefined();
    });
  });

  // ==========================================================================
  // React Query Integration Tests
  // ==========================================================================

  describe('React Query Integration', () => {
    it('should work within QueryClientProvider', async () => {
      // Arrange
      const wrapper = createWrapper(queryClient);
      const choice = createMockChoice();
      seedChoiceCache(queryClient, choice);

      // Act
      const { result } = renderHook(() => useChoiceResponse(), { wrapper });

      act(() => {
        result.current.mutate({
          choiceId: choice.id,
          answer: 2,
          courseId: DEFAULT_COURSE_ID,
        });
      });

      // Assert
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });

    it('should have mutation lifecycle hooks execute in correct order', async () => {
      // Arrange
      const wrapper = createWrapper(queryClient);
      const choice = createMockChoice();
      seedChoiceCache(queryClient, choice);

      const executionOrder: string[] = [];

      // Track cache updates to infer lifecycle
      const originalSetQueryData = queryClient.setQueryData.bind(queryClient);
      queryClient.setQueryData = (...args) => {
        executionOrder.push('setQueryData');
        return originalSetQueryData(...args);
      };

      const { result } = renderHook(() => useChoiceResponse(), { wrapper });

      // Act
      act(() => {
        result.current.mutate({
          choiceId: choice.id,
          answer: 2,
          courseId: DEFAULT_COURSE_ID,
        });
      });

      // Initial optimistic update should happen first
      expect(executionOrder).toContain('setQueryData');

      // Wait for completion
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Assert - Multiple setQueryData calls (onMutate and onSuccess)
      expect(executionOrder.filter((e) => e === 'setQueryData').length).toBeGreaterThanOrEqual(2);
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle submission with choice data not in cache', async () => {
      // Arrange
      const wrapper = createWrapper(queryClient);
      // Do NOT seed cache

      const { result } = renderHook(() => useChoiceResponse(), { wrapper });

      // Act
      act(() => {
        result.current.mutate({
          choiceId: 999,
          answer: 1,
          courseId: DEFAULT_COURSE_ID,
        });
      });

      // Assert - Should still work (server will validate)
      await waitFor(() => {
        return result.current.isSuccess || result.current.isError;
      });
    });

    it('should handle rapid submit/delete/submit sequence', async () => {
      // Arrange
      const wrapper = createWrapper(queryClient);
      const choice = createMockChoice({
        allowupdate: true,
        userAnswer: {
          hasAnswered: false,
          selectedOptionIds: [],
          timemodified: 0,
          answerIds: [],
        },
      });
      seedChoiceCache(queryClient, choice);

      let requestCount = 0;
      server.use(
        http.post(`*${API_BASE_URL}/choices/:id/respond`, async ({ request }) => {
          requestCount++;
          const body = (await request.json()) as { answer: number[]; action?: string };
          await delay(50);
          const updatedChoice = {
            ...choice,
            userAnswer: {
              hasAnswered: body.action !== 'delete' && body.answer.length > 0,
              selectedOptionIds: body.action === 'delete' ? [] : body.answer,
              timemodified: Date.now() / 1000,
              answerIds: body.action === 'delete' ? [] : [requestCount],
            },
          };
          return HttpResponse.json(
            createApiResponse(createSuccessResult(updatedChoice))
          );
        })
      );

      const { result } = renderHook(() => useChoiceResponse(), { wrapper });

      // Act - Rapid sequence
      act(() => {
        result.current.mutate({
          choiceId: choice.id,
          answer: 1,
          courseId: DEFAULT_COURSE_ID,
        });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Update cache to reflect answered state for delete validation
      queryClient.setQueryData(['choices', choice.id], {
        ...choice,
        userAnswer: {
          hasAnswered: true,
          selectedOptionIds: [1],
          timemodified: Date.now() / 1000,
          answerIds: [1],
        },
      });

      result.current.reset();

      act(() => {
        result.current.mutate({
          choiceId: choice.id,
          answer: [],
          action: 'delete',
          courseId: DEFAULT_COURSE_ID,
        });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Update cache for second submit
      queryClient.setQueryData(['choices', choice.id], {
        ...choice,
        userAnswer: {
          hasAnswered: false,
          selectedOptionIds: [],
          timemodified: Date.now() / 1000,
          answerIds: [],
        },
      });

      result.current.reset();

      act(() => {
        result.current.mutate({
          choiceId: choice.id,
          answer: 2,
          courseId: DEFAULT_COURSE_ID,
        });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Assert - All three requests were processed
      expect(requestCount).toBe(3);
    });

    it('should handle memory cleanup on component unmount during pending mutation', async () => {
      // Arrange
      const wrapper = createWrapper(queryClient);
      const choice = createMockChoice();
      seedChoiceCache(queryClient, choice);

      server.use(
        http.post(`*${API_BASE_URL}/choices/:id/respond`, async () => {
          await delay(500);
          const updatedChoice = {
            ...choice,
            userAnswer: {
              hasAnswered: true,
              selectedOptionIds: [2],
              timemodified: Date.now() / 1000,
              answerIds: [1001],
            },
          };
          return HttpResponse.json(
            createApiResponse(createSuccessResult(updatedChoice))
          );
        })
      );

      const { result, unmount } = renderHook(() => useChoiceResponse(), { wrapper });

      // Act - Start mutation
      act(() => {
        result.current.mutate({
          choiceId: choice.id,
          answer: 2,
          courseId: DEFAULT_COURSE_ID,
        });
      });

      // Unmount before completion
      unmount();

      // Assert - No errors thrown (React Query handles cleanup)
      // Just ensure no unhandled promise rejections
      await new Promise((resolve) => setTimeout(resolve, 600));
    });

    it('should handle submission for large multiple choice with many options', async () => {
      // Arrange
      const wrapper = createWrapper(queryClient);
      const manyOptions = Array.from({ length: 20 }, (_, i) =>
        createMockChoiceOption({
          id: i + 1,
          text: `Option ${i + 1}`,
          countanswers: Math.floor(Math.random() * 10),
        })
      );
      const choice = createMockChoice({
        allowmultiple: true,
        options: manyOptions,
      });
      seedChoiceCache(queryClient, choice);

      const selectedIds = [1, 5, 10, 15, 20];

      server.use(
        http.post(`*${API_BASE_URL}/choices/:id/respond`, async ({ request }) => {
          const body = (await request.json()) as { answer: number[] };
          const updatedChoice = {
            ...choice,
            userAnswer: {
              hasAnswered: true,
              selectedOptionIds: body.answer,
              timemodified: Date.now() / 1000,
              answerIds: body.answer.map((id) => id + 1000),
            },
          };
          return HttpResponse.json(
            createApiResponse(createSuccessResult(updatedChoice))
          );
        })
      );

      const { result } = renderHook(() => useChoiceResponse(), { wrapper });

      // Act
      act(() => {
        result.current.mutate({
          choiceId: choice.id,
          answer: selectedIds,
          courseId: DEFAULT_COURSE_ID,
        });
      });

      // Assert
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.updatedChoice.userAnswer.selectedOptionIds).toEqual(
        selectedIds
      );
    });
  });

  // ==========================================================================
  // Performance Tests
  // ==========================================================================

  describe('Performance', () => {
    it('should not cause unnecessary re-renders during optimistic updates', async () => {
      // Arrange
      const wrapper = createWrapper(queryClient);
      const choice = createMockChoice();
      seedChoiceCache(queryClient, choice);

      let renderCount = 0;

      const { result } = renderHook(() => {
        renderCount++;
        return useChoiceResponse();
      }, { wrapper });

      const initialRenderCount = renderCount;

      // Act
      act(() => {
        result.current.mutate({
          choiceId: choice.id,
          answer: 2,
          courseId: DEFAULT_COURSE_ID,
        });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Assert - Render count should be reasonable (not excessive)
      // Initial render + isPending + isSuccess = ~3 renders expected
      expect(renderCount - initialRenderCount).toBeLessThanOrEqual(5);
    });

    it('should batch cache updates efficiently', async () => {
      // Arrange
      const wrapper = createWrapper(queryClient);
      const choice = createMockChoice();
      seedChoiceCache(queryClient, choice);

      const setQueryDataSpy = vi.spyOn(queryClient, 'setQueryData');

      const { result } = renderHook(() => useChoiceResponse(), { wrapper });

      // Act
      act(() => {
        result.current.mutate({
          choiceId: choice.id,
          answer: 2,
          courseId: DEFAULT_COURSE_ID,
        });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Assert - Should have reasonable number of cache updates
      // onMutate (optimistic) + onSuccess (server confirm) = 2 updates
      const choiceCacheUpdates = setQueryDataSpy.mock.calls.filter(
        (call) => Array.isArray(call[0]) && call[0][0] === 'choices' && call[0][1] === choice.id
      );
      expect(choiceCacheUpdates.length).toBeLessThanOrEqual(3);
    });
  });

  // ==========================================================================
  // Real-Time Result Updates Tests
  // ==========================================================================

  describe('Real-Time Result Updates', () => {
    it('should update countanswers in cache after submission', async () => {
      // Arrange
      const wrapper = createWrapper(queryClient);
      const choice = createMockChoice();
      seedChoiceCache(queryClient, choice);

      const originalCount = choice.options[1]!.countanswers;

      const { result } = renderHook(() => useChoiceResponse(), { wrapper });

      // Act
      act(() => {
        result.current.mutate({
          choiceId: choice.id,
          answer: 2,
          courseId: DEFAULT_COURSE_ID,
        });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Assert - Cached data should reflect updated count
      const cachedChoice = getCachedChoice(queryClient, choice.id);
      const option = cachedChoice?.options.find((o) => o.id === 2);
      expect(option?.countanswers).toBe(originalCount + 1);
    });

    it('should reflect user submission in results immediately', async () => {
      // Arrange
      const wrapper = createWrapper(queryClient);
      const choice = createMockChoice();
      seedChoiceCache(queryClient, choice);

      const { result } = renderHook(() => useChoiceResponse(), { wrapper });

      // Act
      act(() => {
        result.current.mutate({
          choiceId: choice.id,
          answer: 3,
          courseId: DEFAULT_COURSE_ID,
        });
      });

      // Check optimistic update immediately
      const immediateCache = getCachedChoice(queryClient, choice.id);
      expect(immediateCache?.userAnswer.selectedOptionIds).toContain(3);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Assert - Final state should also show selection
      const finalCache = getCachedChoice(queryClient, choice.id);
      expect(finalCache?.userAnswer.hasAnswered).toBe(true);
    });
  });
});
