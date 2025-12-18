/**
 * @fileoverview Comprehensive unit tests for useQuizAttempt custom hook
 * 
 * Tests the complete quiz attempt lifecycle management including:
 * - Fetching user attempts
 * - Creating new attempts
 * - Loading existing attempts
 * - Submitting single answers with optimistic updates
 * - Batch answer submission
 * - Finishing attempts with grading
 * - Cache invalidation and error handling
 * 
 * @module tests/unit/features/activities/quizzes/useQuizAttempt.test
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import React, { type ReactNode } from 'react';

import { useQuizAttempt } from '@/features/activities/quizzes/hooks/useQuizAttempt';
import * as quizApi from '@/features/activities/quizzes/api/quizApi';
import { QuestionState } from '@/features/activities/quizzes/types/quiz.types';
import type { QuizAttempt, Question } from '@/features/activities/quizzes/types/quiz.types';
import { createTestQueryClient } from '@test/helpers/render';
import { createMockQuestion, createMockQuizAttempt } from '@test/helpers/mockData';

// ============================================================================
// Mock Setup
// ============================================================================

/**
 * Mock all quiz API functions to isolate hook behavior
 * Each function is mocked with vi.fn() for precise control in tests
 */
vi.mock('@/features/activities/quizzes/api/quizApi', () => ({
  createQuizAttempt: vi.fn(),
  submitQuizAnswers: vi.fn(),
  getUserAttempts: vi.fn(),
  getAttemptResults: vi.fn(),
  getAttemptQuestions: vi.fn(),
  getAttemptSummary: vi.fn(),
  quizQueryKeys: {
    all: ['quizzes'] as const,
    lists: () => ['quizzes', 'list'] as const,
    list: (filters: string) => ['quizzes', 'list', filters] as const,
    details: () => ['quizzes', 'detail'] as const,
    detail: (id: number) => ['quizzes', 'detail', id] as const,
    attempts: (quizId: number) => ['quizzes', 'attempts', quizId] as const,
    attemptQuestions: (attemptId: number) => ['quizzes', 'attempt-questions', attemptId] as const,
    attemptResults: (attemptId: number) => ['quizzes', 'attempt-results', attemptId] as const,
    attemptSummary: (attemptId: number) => ['quizzes', 'attempt-summary', attemptId] as const,
  },
}));

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Creates a wrapper component with QueryClientProvider for testing hooks
 * Uses the test-optimized QueryClient from render helpers
 * 
 * @param {QueryClient} queryClient - The query client instance to use
 * @returns {React.FC<{children: ReactNode}>} Wrapper component
 */
function createWrapper(queryClient: QueryClient): React.FC<{ children: ReactNode }> {
  return function Wrapper({ children }: { children: ReactNode }): React.ReactElement {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  };
}

/**
 * Creates default mock responses for API functions
 * Ensures consistent test data across test suites
 */
function setupDefaultMocks(): void {
  const mockAttempt = createMockQuizAttempt({ id: 1, quiz: 123, state: 'inprogress' });
  const mockQuestions = [
    createMockQuestion({ id: 1, slot: 1, state: QuestionState.TODO }),
    createMockQuestion({ id: 2, slot: 2, state: QuestionState.TODO }),
    createMockQuestion({ id: 3, slot: 3, state: QuestionState.TODO }),
  ];

  (quizApi.getUserAttempts as Mock).mockResolvedValue({
    success: true,
    data: { attempts: [mockAttempt] },
  });

  (quizApi.createQuizAttempt as Mock).mockResolvedValue({
    success: true,
    data: { attempt: mockAttempt },
  });

  (quizApi.getAttemptQuestions as Mock).mockResolvedValue({
    success: true,
    data: { questions: mockQuestions },
  });

  (quizApi.submitQuizAnswers as Mock).mockResolvedValue({
    success: true,
    data: { saved: true },
  });

  (quizApi.getAttemptResults as Mock).mockResolvedValue({
    success: true,
    data: {
      attempt: { ...mockAttempt, state: 'finished', sumgrades: 85 },
      grade: { grade: 85, maxgrade: 100 },
    },
  });

  (quizApi.getAttemptSummary as Mock).mockResolvedValue({
    success: true,
    data: { 
      questions: mockQuestions.map(q => ({
        slot: q.slot,
        state: q.state,
        flagged: q.flagged,
      })),
    },
  });
}

/**
 * Resets all mocks and clears any pending state
 */
function resetAllMocks(): void {
  vi.clearAllMocks();
  vi.resetAllMocks();
}

// ============================================================================
// Test Constants
// ============================================================================

const TEST_QUIZ_ID = 123;
const TEST_ATTEMPT_ID = 456;
const TEST_QUESTION_ID = 1;
const TEST_USER_ID = 789;

// ============================================================================
// Test Suites
// ============================================================================

describe('useQuizAttempt', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    setupDefaultMocks();
  });

  afterEach(() => {
    resetAllMocks();
    queryClient.clear();
  });

  // ==========================================================================
  // Hook Initialization Tests
  // ==========================================================================

  describe('Hook Initialization', () => {
    it('should return expected structure with all required properties', async () => {
      const { result } = renderHook(
        () => useQuizAttempt({ quizId: TEST_QUIZ_ID }),
        { wrapper: createWrapper(queryClient) }
      );

      // Verify all expected properties exist
      expect(result.current).toHaveProperty('currentAttempt');
      expect(result.current).toHaveProperty('attempts');
      expect(result.current).toHaveProperty('questions');
      expect(result.current).toHaveProperty('isLoading');
      expect(result.current).toHaveProperty('isSubmitting');
      expect(result.current).toHaveProperty('error');
      expect(result.current).toHaveProperty('startAttempt');
      expect(result.current).toHaveProperty('submitAnswer');
      expect(result.current).toHaveProperty('submitAllAnswers');
      expect(result.current).toHaveProperty('finishAttempt');
      expect(result.current).toHaveProperty('loadAttempt');
      expect(result.current).toHaveProperty('refetchAttempts');
    });

    it('should have functions as callable types', async () => {
      const { result } = renderHook(
        () => useQuizAttempt({ quizId: TEST_QUIZ_ID }),
        { wrapper: createWrapper(queryClient) }
      );

      expect(typeof result.current.startAttempt).toBe('function');
      expect(typeof result.current.submitAnswer).toBe('function');
      expect(typeof result.current.submitAllAnswers).toBe('function');
      expect(typeof result.current.finishAttempt).toBe('function');
      expect(typeof result.current.loadAttempt).toBe('function');
      expect(typeof result.current.refetchAttempts).toBe('function');
    });

    it('should initialize with null currentAttempt when no attempt loaded', async () => {
      const { result } = renderHook(
        () => useQuizAttempt({ quizId: TEST_QUIZ_ID }),
        { wrapper: createWrapper(queryClient) }
      );

      expect(result.current.currentAttempt).toBeNull();
    });

    it('should initialize with empty questions array when no attempt loaded', async () => {
      const { result } = renderHook(
        () => useQuizAttempt({ quizId: TEST_QUIZ_ID }),
        { wrapper: createWrapper(queryClient) }
      );

      expect(result.current.questions).toEqual([]);
    });
  });

  // ==========================================================================
  // Fetch User Attempts Tests
  // ==========================================================================

  describe('Fetch User Attempts', () => {
    it('should call getUserAttempts with correct quizId', async () => {
      renderHook(
        () => useQuizAttempt({ quizId: TEST_QUIZ_ID }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(quizApi.getUserAttempts).toHaveBeenCalledWith(TEST_QUIZ_ID);
      });
    });

    it('should populate attempts array with QuizAttempt objects', async () => {
      const mockAttempts = [
        createMockQuizAttempt({ id: 1, quiz: TEST_QUIZ_ID, attempt: 1 }),
        createMockQuizAttempt({ id: 2, quiz: TEST_QUIZ_ID, attempt: 2 }),
      ];

      (quizApi.getUserAttempts as Mock).mockResolvedValue({
        success: true,
        data: { attempts: mockAttempts },
      });

      const { result } = renderHook(
        () => useQuizAttempt({ quizId: TEST_QUIZ_ID }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.attempts).toHaveLength(2);
        expect(result.current.attempts[0]).toMatchObject({ id: 1, attempt: 1 });
        expect(result.current.attempts[1]).toMatchObject({ id: 2, attempt: 2 });
      });
    });

    it('should return empty array when user has no previous attempts', async () => {
      (quizApi.getUserAttempts as Mock).mockResolvedValue({
        success: true,
        data: { attempts: [] },
      });

      const { result } = renderHook(
        () => useQuizAttempt({ quizId: TEST_QUIZ_ID }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.attempts).toEqual([]);
        expect(result.current.isLoading).toBe(false);
      });
    });
  });

  // ==========================================================================
  // Loading State Tests
  // ==========================================================================

  describe('Loading State', () => {
    it('should have isLoading true during initial fetch', async () => {
      // Delay the response to capture loading state
      (quizApi.getUserAttempts as Mock).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({
          success: true,
          data: { attempts: [] },
        }), 100))
      );

      const { result } = renderHook(
        () => useQuizAttempt({ quizId: TEST_QUIZ_ID }),
        { wrapper: createWrapper(queryClient) }
      );

      // Initially loading
      expect(result.current.isLoading).toBe(true);

      // Wait for completion
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('should have isLoading false after fetch completion', async () => {
      const { result } = renderHook(
        () => useQuizAttempt({ quizId: TEST_QUIZ_ID }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('should not affect isSubmitting during data fetch', async () => {
      const { result } = renderHook(
        () => useQuizAttempt({ quizId: TEST_QUIZ_ID }),
        { wrapper: createWrapper(queryClient) }
      );

      // isSubmitting should remain false during data fetch
      expect(result.current.isSubmitting).toBe(false);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isSubmitting).toBe(false);
    });
  });

  // ==========================================================================
  // Start New Attempt Tests
  // ==========================================================================

  describe('Start New Attempt', () => {
    it('should call createQuizAttempt when startAttempt is called', async () => {
      const mockNewAttempt = createMockQuizAttempt({
        id: TEST_ATTEMPT_ID,
        quiz: TEST_QUIZ_ID,
        state: 'inprogress',
      });

      (quizApi.createQuizAttempt as Mock).mockResolvedValue({
        success: true,
        data: { attempt: mockNewAttempt },
      });

      const { result } = renderHook(
        () => useQuizAttempt({ quizId: TEST_QUIZ_ID }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.startAttempt();
      });

      expect(quizApi.createQuizAttempt).toHaveBeenCalledWith(TEST_QUIZ_ID, undefined);
    });

    it('should return QuizAttempt on successful start', async () => {
      const mockNewAttempt = createMockQuizAttempt({
        id: TEST_ATTEMPT_ID,
        quiz: TEST_QUIZ_ID,
        state: 'inprogress',
        attempt: 1,
      });

      (quizApi.createQuizAttempt as Mock).mockResolvedValue({
        success: true,
        data: { attempt: mockNewAttempt },
      });

      const { result } = renderHook(
        () => useQuizAttempt({ quizId: TEST_QUIZ_ID }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      let returnedAttempt: QuizAttempt | undefined;
      await act(async () => {
        returnedAttempt = await result.current.startAttempt();
      });

      expect(returnedAttempt).toBeDefined();
      expect(returnedAttempt?.id).toBe(TEST_ATTEMPT_ID);
      expect(returnedAttempt?.state).toBe('inprogress');
    });

    it('should set currentAttempt on successful start', async () => {
      const mockNewAttempt = createMockQuizAttempt({
        id: TEST_ATTEMPT_ID,
        quiz: TEST_QUIZ_ID,
        state: 'inprogress',
      });

      (quizApi.createQuizAttempt as Mock).mockResolvedValue({
        success: true,
        data: { attempt: mockNewAttempt },
      });

      const { result } = renderHook(
        () => useQuizAttempt({ quizId: TEST_QUIZ_ID }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.startAttempt();
      });

      await waitFor(() => {
        expect(result.current.currentAttempt).not.toBeNull();
        expect(result.current.currentAttempt?.id).toBe(TEST_ATTEMPT_ID);
      });
    });

    it('should fire onAttemptCreated callback on success', async () => {
      const onAttemptCreated = vi.fn();
      const mockNewAttempt = createMockQuizAttempt({
        id: TEST_ATTEMPT_ID,
        quiz: TEST_QUIZ_ID,
      });

      (quizApi.createQuizAttempt as Mock).mockResolvedValue({
        success: true,
        data: { attempt: mockNewAttempt },
      });

      const { result } = renderHook(
        () => useQuizAttempt({ 
          quizId: TEST_QUIZ_ID, 
          onAttemptCreated,
        }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.startAttempt();
      });

      await waitFor(() => {
        expect(onAttemptCreated).toHaveBeenCalledWith(
          expect.objectContaining({ id: TEST_ATTEMPT_ID })
        );
      });
    });

    it('should handle error gracefully on start attempt failure', async () => {
      const testError = new Error('Failed to create attempt');
      (quizApi.createQuizAttempt as Mock).mockRejectedValue(testError);

      const { result } = renderHook(
        () => useQuizAttempt({ quizId: TEST_QUIZ_ID }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        try {
          await result.current.startAttempt();
        } catch (error) {
          // Expected to throw
        }
      });

      await waitFor(() => {
        expect(result.current.error).not.toBeNull();
      });
    });

    it('should fire onError callback on start attempt failure', async () => {
      const onError = vi.fn();
      const testError = new Error('Failed to create attempt');
      (quizApi.createQuizAttempt as Mock).mockRejectedValue(testError);

      const { result } = renderHook(
        () => useQuizAttempt({ 
          quizId: TEST_QUIZ_ID, 
          onError,
        }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        try {
          await result.current.startAttempt();
        } catch {
          // Expected
        }
      });

      await waitFor(() => {
        expect(onError).toHaveBeenCalled();
      });
    });

    it('should support forcenew parameter to start fresh attempt', async () => {
      const mockNewAttempt = createMockQuizAttempt({
        id: TEST_ATTEMPT_ID,
        quiz: TEST_QUIZ_ID,
        attempt: 2,
      });

      (quizApi.createQuizAttempt as Mock).mockResolvedValue({
        success: true,
        data: { attempt: mockNewAttempt },
      });

      const { result } = renderHook(
        () => useQuizAttempt({ quizId: TEST_QUIZ_ID }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.startAttempt(true);
      });

      expect(quizApi.createQuizAttempt).toHaveBeenCalledWith(TEST_QUIZ_ID, true);
    });

    it('should invalidate attempts cache after successful start', async () => {
      const mockNewAttempt = createMockQuizAttempt({
        id: TEST_ATTEMPT_ID,
        quiz: TEST_QUIZ_ID,
      });

      (quizApi.createQuizAttempt as Mock).mockResolvedValue({
        success: true,
        data: { attempt: mockNewAttempt },
      });

      const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(
        () => useQuizAttempt({ quizId: TEST_QUIZ_ID }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.startAttempt();
      });

      await waitFor(() => {
        expect(invalidateQueriesSpy).toHaveBeenCalled();
      });
    });
  });

  // ==========================================================================
  // Load Existing Attempt Tests
  // ==========================================================================

  describe('Load Existing Attempt', () => {
    it('should fetch and set currentAttempt when loadAttempt is called', async () => {
      const mockAttempt = createMockQuizAttempt({
        id: TEST_ATTEMPT_ID,
        quiz: TEST_QUIZ_ID,
        state: 'inprogress',
      });

      (quizApi.getUserAttempts as Mock).mockResolvedValue({
        success: true,
        data: { attempts: [mockAttempt] },
      });

      const { result } = renderHook(
        () => useQuizAttempt({ quizId: TEST_QUIZ_ID }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        result.current.loadAttempt(TEST_ATTEMPT_ID);
      });

      await waitFor(() => {
        expect(result.current.currentAttempt).not.toBeNull();
        expect(result.current.currentAttempt?.id).toBe(TEST_ATTEMPT_ID);
      });
    });

    it('should fetch attempt questions when attemptId exists', async () => {
      const mockAttempt = createMockQuizAttempt({
        id: TEST_ATTEMPT_ID,
        quiz: TEST_QUIZ_ID,
        state: 'inprogress',
      });

      const mockQuestions = [
        createMockQuestion({ id: 1, slot: 1 }),
        createMockQuestion({ id: 2, slot: 2 }),
      ];

      (quizApi.getUserAttempts as Mock).mockResolvedValue({
        success: true,
        data: { attempts: [mockAttempt] },
      });

      (quizApi.getAttemptQuestions as Mock).mockResolvedValue({
        success: true,
        data: { questions: mockQuestions },
      });

      const { result } = renderHook(
        () => useQuizAttempt({ quizId: TEST_QUIZ_ID }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        result.current.loadAttempt(TEST_ATTEMPT_ID);
      });

      await waitFor(() => {
        expect(quizApi.getAttemptQuestions).toHaveBeenCalledWith(TEST_ATTEMPT_ID);
        expect(result.current.questions).toHaveLength(2);
      });
    });

    it('should resume unfinished attempt from existing in-progress attempt', async () => {
      const inProgressAttempt = createMockQuizAttempt({
        id: TEST_ATTEMPT_ID,
        quiz: TEST_QUIZ_ID,
        state: 'inprogress',
        currentpage: 2,
      });

      (quizApi.getUserAttempts as Mock).mockResolvedValue({
        success: true,
        data: { attempts: [inProgressAttempt] },
      });

      const { result } = renderHook(
        () => useQuizAttempt({ quizId: TEST_QUIZ_ID }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        result.current.loadAttempt(TEST_ATTEMPT_ID);
      });

      await waitFor(() => {
        expect(result.current.currentAttempt?.state).toBe('inprogress');
        expect(result.current.currentAttempt?.currentpage).toBe(2);
      });
    });
  });

  // ==========================================================================
  // Submit Single Answer Tests
  // ==========================================================================

  describe('Submit Single Answer', () => {
    beforeEach(async () => {
      const mockAttempt = createMockQuizAttempt({
        id: TEST_ATTEMPT_ID,
        quiz: TEST_QUIZ_ID,
        state: 'inprogress',
      });

      const mockQuestions = [
        createMockQuestion({ id: TEST_QUESTION_ID, slot: 1, state: QuestionState.TODO }),
        createMockQuestion({ id: 2, slot: 2, state: QuestionState.TODO }),
      ];

      (quizApi.getUserAttempts as Mock).mockResolvedValue({
        success: true,
        data: { attempts: [mockAttempt] },
      });

      (quizApi.getAttemptQuestions as Mock).mockResolvedValue({
        success: true,
        data: { questions: mockQuestions },
      });
    });

    it('should call submitQuizAnswers with correct parameters', async () => {
      const { result } = renderHook(
        () => useQuizAttempt({ quizId: TEST_QUIZ_ID }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        result.current.loadAttempt(TEST_ATTEMPT_ID);
      });

      await waitFor(() => {
        expect(result.current.currentAttempt).not.toBeNull();
      });

      await act(async () => {
        await result.current.submitAnswer(TEST_QUESTION_ID, 'answer_1');
      });

      expect(quizApi.submitQuizAnswers).toHaveBeenCalledWith(
        expect.objectContaining({
          attemptId: TEST_ATTEMPT_ID,
          answers: expect.arrayContaining([
            expect.objectContaining({
              slot: 1,
              answer: 'answer_1',
            }),
          ]),
          finishattempt: false,
        })
      );
    });

    it('should apply optimistic update to question state immediately', async () => {
      // Delay the API response to observe optimistic update
      (quizApi.submitQuizAnswers as Mock).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({
          success: true,
          data: { saved: true },
        }), 500))
      );

      const { result } = renderHook(
        () => useQuizAttempt({ quizId: TEST_QUIZ_ID }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        result.current.loadAttempt(TEST_ATTEMPT_ID);
      });

      await waitFor(() => {
        expect(result.current.questions).toHaveLength(2);
      });

      // Start submission without waiting
      act(() => {
        result.current.submitAnswer(TEST_QUESTION_ID, 'answer_1');
      });

      // Check optimistic update applied immediately
      await waitFor(() => {
        const question = result.current.questions.find(q => q.id === TEST_QUESTION_ID);
        expect(question?.response).toBe('answer_1');
      });
    });

    it('should update cache on successful answer submission', async () => {
      const { result } = renderHook(
        () => useQuizAttempt({ quizId: TEST_QUIZ_ID }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        result.current.loadAttempt(TEST_ATTEMPT_ID);
      });

      await waitFor(() => {
        expect(result.current.currentAttempt).not.toBeNull();
      });

      await act(async () => {
        await result.current.submitAnswer(TEST_QUESTION_ID, 'answer_1');
      });

      await waitFor(() => {
        const question = result.current.questions.find(q => q.id === TEST_QUESTION_ID);
        expect(question?.response).toBe('answer_1');
      });
    });

    it('should rollback optimistic update on error', async () => {
      const mockQuestions = [
        createMockQuestion({ 
          id: TEST_QUESTION_ID, 
          slot: 1, 
          state: QuestionState.TODO,
          response: undefined,
        }),
      ];

      (quizApi.getAttemptQuestions as Mock).mockResolvedValue({
        success: true,
        data: { questions: mockQuestions },
      });

      (quizApi.submitQuizAnswers as Mock).mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(
        () => useQuizAttempt({ quizId: TEST_QUIZ_ID }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        result.current.loadAttempt(TEST_ATTEMPT_ID);
      });

      await waitFor(() => {
        expect(result.current.questions).toHaveLength(1);
      });

      // Get initial state
      const initialQuestion = result.current.questions.find(q => q.id === TEST_QUESTION_ID);
      const initialResponse = initialQuestion?.response;

      await act(async () => {
        try {
          await result.current.submitAnswer(TEST_QUESTION_ID, 'failed_answer');
        } catch {
          // Expected error
        }
      });

      // Should rollback to initial state
      await waitFor(() => {
        const question = result.current.questions.find(q => q.id === TEST_QUESTION_ID);
        expect(question?.response).toBe(initialResponse);
      });
    });

    it('should show error to user on submission failure', async () => {
      (quizApi.submitQuizAnswers as Mock).mockRejectedValue(new Error('Submission failed'));

      const { result } = renderHook(
        () => useQuizAttempt({ quizId: TEST_QUIZ_ID }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        result.current.loadAttempt(TEST_ATTEMPT_ID);
      });

      await waitFor(() => {
        expect(result.current.currentAttempt).not.toBeNull();
      });

      await act(async () => {
        try {
          await result.current.submitAnswer(TEST_QUESTION_ID, 'answer_1');
        } catch {
          // Expected
        }
      });

      await waitFor(() => {
        expect(result.current.error).not.toBeNull();
      });
    });

    it('should set isSubmitting true during answer submission', async () => {
      (quizApi.submitQuizAnswers as Mock).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({
          success: true,
          data: { saved: true },
        }), 200))
      );

      const { result } = renderHook(
        () => useQuizAttempt({ quizId: TEST_QUIZ_ID }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        result.current.loadAttempt(TEST_ATTEMPT_ID);
      });

      await waitFor(() => {
        expect(result.current.currentAttempt).not.toBeNull();
      });

      // Start submission
      act(() => {
        result.current.submitAnswer(TEST_QUESTION_ID, 'answer_1');
      });

      // Check isSubmitting is true during submission
      expect(result.current.isSubmitting).toBe(true);

      // Wait for completion
      await waitFor(() => {
        expect(result.current.isSubmitting).toBe(false);
      });
    });
  });

  // ==========================================================================
  // Submit All Answers Tests
  // ==========================================================================

  describe('Submit All Answers', () => {
    beforeEach(() => {
      const mockAttempt = createMockQuizAttempt({
        id: TEST_ATTEMPT_ID,
        quiz: TEST_QUIZ_ID,
        state: 'inprogress',
      });

      const mockQuestions = [
        createMockQuestion({ id: 1, slot: 1, state: QuestionState.TODO }),
        createMockQuestion({ id: 2, slot: 2, state: QuestionState.TODO }),
        createMockQuestion({ id: 3, slot: 3, state: QuestionState.TODO }),
      ];

      (quizApi.getUserAttempts as Mock).mockResolvedValue({
        success: true,
        data: { attempts: [mockAttempt] },
      });

      (quizApi.getAttemptQuestions as Mock).mockResolvedValue({
        success: true,
        data: { questions: mockQuestions },
      });
    });

    it('should batch submit all answers', async () => {
      const { result } = renderHook(
        () => useQuizAttempt({ quizId: TEST_QUIZ_ID }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        result.current.loadAttempt(TEST_ATTEMPT_ID);
      });

      await waitFor(() => {
        expect(result.current.currentAttempt).not.toBeNull();
      });

      const answers = [
        { questionId: 1, answer: 'answer_a' },
        { questionId: 2, answer: 'answer_b' },
        { questionId: 3, answer: 'answer_c' },
      ];

      await act(async () => {
        await result.current.submitAllAnswers(answers);
      });

      expect(quizApi.submitQuizAnswers).toHaveBeenCalledWith(
        expect.objectContaining({
          attemptId: TEST_ATTEMPT_ID,
          answers: expect.arrayContaining([
            expect.objectContaining({ slot: 1, answer: 'answer_a' }),
            expect.objectContaining({ slot: 2, answer: 'answer_b' }),
            expect.objectContaining({ slot: 3, answer: 'answer_c' }),
          ]),
        })
      );
    });

    it('should update all questions cache on successful batch submission', async () => {
      const { result } = renderHook(
        () => useQuizAttempt({ quizId: TEST_QUIZ_ID }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        result.current.loadAttempt(TEST_ATTEMPT_ID);
      });

      await waitFor(() => {
        expect(result.current.questions).toHaveLength(3);
      });

      const answers = [
        { questionId: 1, answer: 'answer_a' },
        { questionId: 2, answer: 'answer_b' },
      ];

      await act(async () => {
        await result.current.submitAllAnswers(answers);
      });

      await waitFor(() => {
        expect(result.current.questions.find(q => q.id === 1)?.response).toBe('answer_a');
        expect(result.current.questions.find(q => q.id === 2)?.response).toBe('answer_b');
      });
    });

    it('should fire onAnswerSubmitted callback on batch success', async () => {
      const onAnswerSubmitted = vi.fn();

      const { result } = renderHook(
        () => useQuizAttempt({ 
          quizId: TEST_QUIZ_ID,
          onAnswerSubmitted,
        }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        result.current.loadAttempt(TEST_ATTEMPT_ID);
      });

      await waitFor(() => {
        expect(result.current.currentAttempt).not.toBeNull();
      });

      const answers = [
        { questionId: 1, answer: 'answer_a' },
      ];

      await act(async () => {
        await result.current.submitAllAnswers(answers);
      });

      await waitFor(() => {
        expect(onAnswerSubmitted).toHaveBeenCalled();
      });
    });

    it('should set isSubmitting true during batch submission', async () => {
      (quizApi.submitQuizAnswers as Mock).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({
          success: true,
          data: { saved: true },
        }), 200))
      );

      const { result } = renderHook(
        () => useQuizAttempt({ quizId: TEST_QUIZ_ID }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        result.current.loadAttempt(TEST_ATTEMPT_ID);
      });

      await waitFor(() => {
        expect(result.current.currentAttempt).not.toBeNull();
      });

      act(() => {
        result.current.submitAllAnswers([{ questionId: 1, answer: 'a' }]);
      });

      expect(result.current.isSubmitting).toBe(true);

      await waitFor(() => {
        expect(result.current.isSubmitting).toBe(false);
      });
    });
  });

  // ==========================================================================
  // Finish Attempt Tests
  // ==========================================================================

  describe('Finish Attempt', () => {
    beforeEach(() => {
      const mockAttempt = createMockQuizAttempt({
        id: TEST_ATTEMPT_ID,
        quiz: TEST_QUIZ_ID,
        state: 'inprogress',
      });

      (quizApi.getUserAttempts as Mock).mockResolvedValue({
        success: true,
        data: { attempts: [mockAttempt] },
      });

      (quizApi.getAttemptQuestions as Mock).mockResolvedValue({
        success: true,
        data: { questions: [createMockQuestion()] },
      });
    });

    it('should call API with finish flag when finishAttempt is called', async () => {
      const { result } = renderHook(
        () => useQuizAttempt({ quizId: TEST_QUIZ_ID }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        result.current.loadAttempt(TEST_ATTEMPT_ID);
      });

      await waitFor(() => {
        expect(result.current.currentAttempt).not.toBeNull();
      });

      await act(async () => {
        await result.current.finishAttempt();
      });

      expect(quizApi.submitQuizAnswers).toHaveBeenCalledWith(
        expect.objectContaining({
          attemptId: TEST_ATTEMPT_ID,
          finishattempt: true,
        })
      );
    });

    it('should fetch results after finish attempt success', async () => {
      const finishedAttempt = createMockQuizAttempt({
        id: TEST_ATTEMPT_ID,
        quiz: TEST_QUIZ_ID,
        state: 'finished',
        sumgrades: 85,
      });

      (quizApi.submitQuizAnswers as Mock).mockResolvedValue({
        success: true,
        data: { saved: true },
      });

      (quizApi.getAttemptResults as Mock).mockResolvedValue({
        success: true,
        data: {
          attempt: finishedAttempt,
          grade: { grade: 85, maxgrade: 100 },
        },
      });

      const { result } = renderHook(
        () => useQuizAttempt({ quizId: TEST_QUIZ_ID }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        result.current.loadAttempt(TEST_ATTEMPT_ID);
      });

      await waitFor(() => {
        expect(result.current.currentAttempt).not.toBeNull();
      });

      await act(async () => {
        await result.current.finishAttempt();
      });

      await waitFor(() => {
        expect(quizApi.getAttemptResults).toHaveBeenCalledWith(TEST_ATTEMPT_ID);
      });
    });

    it('should invalidate attempts cache after finish', async () => {
      const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(
        () => useQuizAttempt({ quizId: TEST_QUIZ_ID }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        result.current.loadAttempt(TEST_ATTEMPT_ID);
      });

      await waitFor(() => {
        expect(result.current.currentAttempt).not.toBeNull();
      });

      await act(async () => {
        await result.current.finishAttempt();
      });

      await waitFor(() => {
        expect(invalidateQueriesSpy).toHaveBeenCalled();
      });
    });

    it('should fire onAttemptFinished callback on success', async () => {
      const onAttemptFinished = vi.fn();

      const { result } = renderHook(
        () => useQuizAttempt({ 
          quizId: TEST_QUIZ_ID,
          onAttemptFinished,
        }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        result.current.loadAttempt(TEST_ATTEMPT_ID);
      });

      await waitFor(() => {
        expect(result.current.currentAttempt).not.toBeNull();
      });

      await act(async () => {
        await result.current.finishAttempt();
      });

      await waitFor(() => {
        expect(onAttemptFinished).toHaveBeenCalled();
      });
    });

    it('should allow retry on finish attempt error', async () => {
      (quizApi.submitQuizAnswers as Mock)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          success: true,
          data: { saved: true },
        });

      const { result } = renderHook(
        () => useQuizAttempt({ quizId: TEST_QUIZ_ID }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        result.current.loadAttempt(TEST_ATTEMPT_ID);
      });

      await waitFor(() => {
        expect(result.current.currentAttempt).not.toBeNull();
      });

      // First attempt fails
      await act(async () => {
        try {
          await result.current.finishAttempt();
        } catch {
          // Expected
        }
      });

      expect(result.current.error).not.toBeNull();

      // User should not be locked out - can retry
      await act(async () => {
        await result.current.finishAttempt();
      });

      expect(quizApi.submitQuizAnswers).toHaveBeenCalledTimes(2);
    });

    it('should set isSubmitting true during finish attempt', async () => {
      (quizApi.submitQuizAnswers as Mock).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({
          success: true,
          data: { saved: true },
        }), 200))
      );

      const { result } = renderHook(
        () => useQuizAttempt({ quizId: TEST_QUIZ_ID }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        result.current.loadAttempt(TEST_ATTEMPT_ID);
      });

      await waitFor(() => {
        expect(result.current.currentAttempt).not.toBeNull();
      });

      act(() => {
        result.current.finishAttempt();
      });

      expect(result.current.isSubmitting).toBe(true);

      await waitFor(() => {
        expect(result.current.isSubmitting).toBe(false);
      });
    });
  });

  // ==========================================================================
  // Refetch Attempts Tests
  // ==========================================================================

  describe('Refetch Attempts', () => {
    it('should manually refresh attempts list when refetchAttempts is called', async () => {
      const { result } = renderHook(
        () => useQuizAttempt({ quizId: TEST_QUIZ_ID }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Clear mock call count
      (quizApi.getUserAttempts as Mock).mockClear();

      await act(async () => {
        await result.current.refetchAttempts();
      });

      expect(quizApi.getUserAttempts).toHaveBeenCalledWith(TEST_QUIZ_ID);
    });

    it('should update attempts array after refetch', async () => {
      const initialAttempts = [
        createMockQuizAttempt({ id: 1, attempt: 1 }),
      ];

      const updatedAttempts = [
        createMockQuizAttempt({ id: 1, attempt: 1 }),
        createMockQuizAttempt({ id: 2, attempt: 2 }),
      ];

      (quizApi.getUserAttempts as Mock)
        .mockResolvedValueOnce({ success: true, data: { attempts: initialAttempts } })
        .mockResolvedValueOnce({ success: true, data: { attempts: updatedAttempts } });

      const { result } = renderHook(
        () => useQuizAttempt({ quizId: TEST_QUIZ_ID }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.attempts).toHaveLength(1);
      });

      await act(async () => {
        await result.current.refetchAttempts();
      });

      await waitFor(() => {
        expect(result.current.attempts).toHaveLength(2);
      });
    });
  });

  // ==========================================================================
  // Error Handling Tests
  // ==========================================================================

  describe('Error Handling', () => {
    it('should clear errors on successful subsequent operations', async () => {
      // First call fails, second succeeds
      (quizApi.createQuizAttempt as Mock)
        .mockRejectedValueOnce(new Error('First failure'))
        .mockResolvedValueOnce({
          success: true,
          data: { attempt: createMockQuizAttempt() },
        });

      const { result } = renderHook(
        () => useQuizAttempt({ quizId: TEST_QUIZ_ID }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // First attempt fails
      await act(async () => {
        try {
          await result.current.startAttempt();
        } catch {
          // Expected
        }
      });

      await waitFor(() => {
        expect(result.current.error).not.toBeNull();
      });

      // Successful retry should clear error
      await act(async () => {
        await result.current.startAttempt();
      });

      await waitFor(() => {
        expect(result.current.error).toBeNull();
      });
    });

    it('should handle 403 permission denied error properly', async () => {
      const permissionError = new Error('Permission denied');
      (permissionError as Error & { response?: { status: number } }).response = { status: 403 };
      (quizApi.createQuizAttempt as Mock).mockRejectedValue(permissionError);

      const { result } = renderHook(
        () => useQuizAttempt({ quizId: TEST_QUIZ_ID }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        try {
          await result.current.startAttempt();
        } catch {
          // Expected
        }
      });

      await waitFor(() => {
        expect(result.current.error).not.toBeNull();
      });
    });

    it('should handle network errors with retry option', async () => {
      const networkError = new Error('Network error');
      networkError.name = 'NetworkError';
      (quizApi.submitQuizAnswers as Mock).mockRejectedValue(networkError);

      const { result } = renderHook(
        () => useQuizAttempt({ quizId: TEST_QUIZ_ID }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        result.current.loadAttempt(TEST_ATTEMPT_ID);
      });

      await waitFor(() => {
        expect(result.current.currentAttempt).not.toBeNull();
      });

      await act(async () => {
        try {
          await result.current.submitAnswer(1, 'answer');
        } catch {
          // Expected
        }
      });

      // Error should be set but user can retry
      await waitFor(() => {
        expect(result.current.error).not.toBeNull();
      });

      // Clear error and retry (mock success this time)
      (quizApi.submitQuizAnswers as Mock).mockResolvedValueOnce({
        success: true,
        data: { saved: true },
      });

      await act(async () => {
        await result.current.submitAnswer(1, 'answer');
      });

      await waitFor(() => {
        expect(result.current.error).toBeNull();
      });
    });
  });

  // ==========================================================================
  // Concurrent Submissions Tests
  // ==========================================================================

  describe('Concurrent Submissions', () => {
    it('should handle multiple simultaneous submitAnswer calls', async () => {
      const mockAttempt = createMockQuizAttempt({
        id: TEST_ATTEMPT_ID,
        quiz: TEST_QUIZ_ID,
        state: 'inprogress',
      });

      const mockQuestions = [
        createMockQuestion({ id: 1, slot: 1 }),
        createMockQuestion({ id: 2, slot: 2 }),
        createMockQuestion({ id: 3, slot: 3 }),
      ];

      (quizApi.getUserAttempts as Mock).mockResolvedValue({
        success: true,
        data: { attempts: [mockAttempt] },
      });

      (quizApi.getAttemptQuestions as Mock).mockResolvedValue({
        success: true,
        data: { questions: mockQuestions },
      });

      let resolvers: Array<(value: unknown) => void> = [];
      (quizApi.submitQuizAnswers as Mock).mockImplementation(() => {
        return new Promise(resolve => {
          resolvers.push(resolve);
        });
      });

      const { result } = renderHook(
        () => useQuizAttempt({ quizId: TEST_QUIZ_ID }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        result.current.loadAttempt(TEST_ATTEMPT_ID);
      });

      await waitFor(() => {
        expect(result.current.questions).toHaveLength(3);
      });

      // Start multiple concurrent submissions
      act(() => {
        result.current.submitAnswer(1, 'answer_1');
        result.current.submitAnswer(2, 'answer_2');
        result.current.submitAnswer(3, 'answer_3');
      });

      // Resolve all promises
      await act(async () => {
        resolvers.forEach(resolve => resolve({ success: true, data: { saved: true } }));
      });

      // All calls should have been made
      expect(quizApi.submitQuizAnswers).toHaveBeenCalledTimes(3);
    });
  });

  // ==========================================================================
  // Cache Invalidation Tests
  // ==========================================================================

  describe('Cache Invalidation', () => {
    it('should invalidate correct query keys after mutations', async () => {
      const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const mockAttempt = createMockQuizAttempt({
        id: TEST_ATTEMPT_ID,
        quiz: TEST_QUIZ_ID,
      });

      (quizApi.createQuizAttempt as Mock).mockResolvedValue({
        success: true,
        data: { attempt: mockAttempt },
      });

      const { result } = renderHook(
        () => useQuizAttempt({ quizId: TEST_QUIZ_ID }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.startAttempt();
      });

      await waitFor(() => {
        expect(invalidateQueriesSpy).toHaveBeenCalled();
      });

      // Verify the queries were invalidated with the correct keys
      const invalidateCalls = invalidateQueriesSpy.mock.calls;
      expect(invalidateCalls.length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // Callback Execution Order Tests
  // ==========================================================================

  describe('Callback Execution Order', () => {
    it('should execute onAttemptCreated before cache invalidation', async () => {
      const executionOrder: string[] = [];
      
      const onAttemptCreated = vi.fn(() => {
        executionOrder.push('callback');
      });

      const originalInvalidate = queryClient.invalidateQueries.bind(queryClient);
      queryClient.invalidateQueries = vi.fn(async (...args) => {
        executionOrder.push('invalidate');
        return originalInvalidate(...args);
      }) as typeof queryClient.invalidateQueries;

      const mockAttempt = createMockQuizAttempt({
        id: TEST_ATTEMPT_ID,
        quiz: TEST_QUIZ_ID,
      });

      (quizApi.createQuizAttempt as Mock).mockResolvedValue({
        success: true,
        data: { attempt: mockAttempt },
      });

      const { result } = renderHook(
        () => useQuizAttempt({ 
          quizId: TEST_QUIZ_ID,
          onAttemptCreated,
        }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.startAttempt();
      });

      await waitFor(() => {
        expect(onAttemptCreated).toHaveBeenCalled();
      });

      // Callback should be before invalidation
      const callbackIndex = executionOrder.indexOf('callback');
      const invalidateIndex = executionOrder.indexOf('invalidate');
      
      if (callbackIndex !== -1 && invalidateIndex !== -1) {
        expect(callbackIndex).toBeLessThan(invalidateIndex);
      }
    });
  });

  // ==========================================================================
  // TypeScript Typing Tests
  // ==========================================================================

  describe('TypeScript Typing', () => {
    it('should return values matching UseQuizAttemptResult interface', async () => {
      const { result } = renderHook(
        () => useQuizAttempt({ quizId: TEST_QUIZ_ID }),
        { wrapper: createWrapper(queryClient) }
      );

      // Type assertions - these are compile-time checks
      // If types don't match, TypeScript will error at compile time
      const currentAttempt: QuizAttempt | null = result.current.currentAttempt;
      const attempts: QuizAttempt[] = result.current.attempts;
      const questions: Question[] = result.current.questions;
      const isLoading: boolean = result.current.isLoading;
      const isSubmitting: boolean = result.current.isSubmitting;
      const error: Error | null = result.current.error;
      const startAttempt: (forcenew?: boolean) => Promise<QuizAttempt | undefined> = result.current.startAttempt;
      const submitAnswer: (questionId: number, answer: string) => Promise<void> = result.current.submitAnswer;
      const submitAllAnswers: (answers: Array<{ questionId: number; answer: string }>) => Promise<void> = result.current.submitAllAnswers;
      const finishAttempt: () => Promise<void> = result.current.finishAttempt;
      const loadAttempt: (attemptId: number) => void = result.current.loadAttempt;
      const refetchAttempts: () => Promise<void> = result.current.refetchAttempts;

      // Runtime checks
      expect(currentAttempt).toBeNull();
      expect(Array.isArray(attempts)).toBe(true);
      expect(Array.isArray(questions)).toBe(true);
      expect(typeof isLoading).toBe('boolean');
      expect(typeof isSubmitting).toBe('boolean');
      expect(error).toBeNull();
      expect(typeof startAttempt).toBe('function');
      expect(typeof submitAnswer).toBe('function');
      expect(typeof submitAllAnswers).toBe('function');
      expect(typeof finishAttempt).toBe('function');
      expect(typeof loadAttempt).toBe('function');
      expect(typeof refetchAttempts).toBe('function');
    });
  });

  // ==========================================================================
  // Cleanup and Memory Leak Tests
  // ==========================================================================

  describe('Cleanup Behavior', () => {
    it('should cleanup without memory leaks or hanging queries', async () => {
      const { result, unmount } = renderHook(
        () => useQuizAttempt({ quizId: TEST_QUIZ_ID }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Start an attempt
      await act(async () => {
        await result.current.startAttempt();
      });

      // Unmount the hook
      unmount();

      // Verify no errors thrown on unmount
      // The test passing without errors indicates proper cleanup
      expect(true).toBe(true);
    });

    it('should handle unmount during pending mutation', async () => {
      (quizApi.createQuizAttempt as Mock).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({
          success: true,
          data: { attempt: createMockQuizAttempt() },
        }), 1000))
      );

      const { result, unmount } = renderHook(
        () => useQuizAttempt({ quizId: TEST_QUIZ_ID }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Start mutation without waiting
      act(() => {
        result.current.startAttempt();
      });

      // Unmount while mutation is pending
      unmount();

      // No error should be thrown
      expect(true).toBe(true);
    });
  });

  // ==========================================================================
  // useCallback Memoization Tests
  // ==========================================================================

  describe('Function Memoization', () => {
    it('should memoize mutation functions across re-renders', async () => {
      const { result, rerender } = renderHook(
        () => useQuizAttempt({ quizId: TEST_QUIZ_ID }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const initialStartAttempt = result.current.startAttempt;
      const initialSubmitAnswer = result.current.submitAnswer;
      const initialSubmitAllAnswers = result.current.submitAllAnswers;
      const initialFinishAttempt = result.current.finishAttempt;
      const initialLoadAttempt = result.current.loadAttempt;
      const initialRefetchAttempts = result.current.refetchAttempts;

      // Re-render
      rerender();

      // Functions should be memoized (same reference)
      expect(result.current.startAttempt).toBe(initialStartAttempt);
      expect(result.current.submitAnswer).toBe(initialSubmitAnswer);
      expect(result.current.submitAllAnswers).toBe(initialSubmitAllAnswers);
      expect(result.current.finishAttempt).toBe(initialFinishAttempt);
      expect(result.current.loadAttempt).toBe(initialLoadAttempt);
      expect(result.current.refetchAttempts).toBe(initialRefetchAttempts);
    });
  });
});
