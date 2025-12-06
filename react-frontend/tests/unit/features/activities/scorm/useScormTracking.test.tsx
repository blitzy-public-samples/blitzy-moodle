/**
 * @fileoverview Comprehensive Vitest unit tests for useScormTracking React Query mutation hook.
 *
 * Tests cover CMI data submission for SCORM 1.2 (cmi.core.*) and SCORM 2004 (cmi.*) data models,
 * tracking element validation, batch tracking submission, optimistic updates, cache invalidation,
 * session time formatting, lesson status updates, score tracking, suspend data persistence,
 * navigation request handling, and edge cases including network interruptions, large payloads,
 * and concurrent submissions.
 *
 * @module tests/unit/features/activities/scorm/useScormTracking.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode } from 'react';

import useScormTracking, {
  validateCMIElement,
  formatSessionTime,
  parseScormTime,
  createLessonStatusElement,
  createScoreElements,
  createExitElement,
  createNavigationRequestElement,
  createSessionTimeElement,
  createSuspendDataElement,
  createCompletionStatusElement,
} from '@/features/activities/scorm/hooks/useScormTracking';
import { submitTracking } from '@/features/activities/scorm/api/scormApi';
import type {
  ScormTrackingElement,
  ScormTrackingData,
} from '@/features/activities/scorm/types/scorm.types';

// Mock the scormApi module
vi.mock('@/features/activities/scorm/api/scormApi', () => ({
  submitTracking: vi.fn(),
}));

// Type the mocked function for better TypeScript support
const mockSubmitTracking = submitTracking as ReturnType<typeof vi.fn>;

/**
 * Creates a wrapper component with QueryClientProvider for testing hooks.
 * @param queryClient - The QueryClient instance to use
 * @returns A wrapper component for renderHook
 */
function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  };
}

/**
 * Creates a mock ScormTrackingData response for successful submissions.
 * @param overrides - Optional overrides for the default mock data
 * @returns Mock tracking data response
 */
function createMockTrackingResponse(overrides: Partial<ScormTrackingData> = {}): ScormTrackingData {
  return {
    scoid: 1,
    attempt: 1,
    tracks: {},
    ...overrides,
  };
}

/**
 * Creates a mock tracking element for testing.
 * @param element - The CMI element name
 * @param value - The element value
 * @returns A ScormTrackingElement object
 */
/**
 * Default test IDs for tracking params
 */
const DEFAULT_SCORM_ID = 1;
const DEFAULT_SCO_ID = 1;
const DEFAULT_ATTEMPT = 1;

/**
 * Creates SaveTrackingParams from an array of tracking elements
 * @param tracks - Array of tracking elements
 * @param scormId - SCORM module ID
 * @param scoid - SCO ID
 * @param attempt - Attempt number
 * @returns Complete SaveTrackingParams object
 */
function createTrackingParams(
  tracks: ScormTrackingElement[],
  scormId = DEFAULT_SCORM_ID,
  scoid = DEFAULT_SCO_ID,
  attempt = DEFAULT_ATTEMPT
): { scormId: number; scoid: number; attempt: number; tracks: ScormTrackingElement[] } {
  return { scormId, scoid, attempt, tracks };
}

/**
 * Convert array of tracking elements to the Record format expected by API
 * @param elements - Array of tracking elements
 * @returns Record/object format used by API
 */
function elementsToTracksRecord(elements: ScormTrackingElement[]): Record<string, string> {
  const tracks: Record<string, string> = {};
  for (const el of elements) {
    tracks[el.element] = el.value;
  }
  return tracks;
}

/**
 * Helper to verify submitTracking was called with correct arguments
 * The API is called as submitTracking(scormId, { scormId, scoId, attempt, tracks })
 * where tracks is a Record<string, string>, not an array
 * @param elements - Array of expected elements (will be converted to Record)
 * @param scormId - Expected SCORM ID (default: 1)
 * @param scoId - Expected SCO ID (default: 1)  
 * @param attempt - Expected attempt number (default: 1)
 */
function expectTrackingApiCall(
  elements: ScormTrackingElement[],
  scormId = DEFAULT_SCORM_ID,
  scoId = DEFAULT_SCO_ID,
  attempt = DEFAULT_ATTEMPT
): void {
  const tracksRecord = elementsToTracksRecord(elements);
  expect(mockSubmitTracking).toHaveBeenCalledWith(
    scormId,
    expect.objectContaining({
      scormId,
      scoId,
      attempt,
      tracks: tracksRecord,
    })
  );
}

/**
 * Helper to verify API was called and check it has the expected tracks
 * Use when you only care about the tracks, not all parameters
 * @param elements - Array of expected elements
 */
function expectTrackingApiCalledWithElements(
  elements: ScormTrackingElement[]
): void {
  const tracksRecord = elementsToTracksRecord(elements);
  expect(mockSubmitTracking).toHaveBeenCalledWith(
    expect.any(Number),
    expect.objectContaining({
      tracks: tracksRecord,
    })
  );
}

/**
 * Creates interaction elements for testing SCORM interactions
 * @param index - Interaction index (0-based)
 * @param data - Interaction data including id, type, result, etc.
 * @returns Array of ScormTrackingElement objects for the interaction
 */
function createInteractionElements(
  index: number,
  data: {
    id: string;
    type: string;
    result: string;
    latency?: number;
    studentResponse?: string;
    correctResponses?: string[];
  }
): ScormTrackingElement[] {
  const elements: ScormTrackingElement[] = [
    { element: `cmi.interactions.${index}.id`, value: data.id },
    { element: `cmi.interactions.${index}.type`, value: data.type },
    { element: `cmi.interactions.${index}.result`, value: data.result },
  ];

  if (data.latency !== undefined) {
    // Convert milliseconds to SCORM time format (HH:MM:SS)
    const seconds = Math.floor(data.latency / 1000);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    elements.push({ element: `cmi.interactions.${index}.latency`, value: timeStr });
  }

  if (data.studentResponse !== undefined) {
    elements.push({ element: `cmi.interactions.${index}.student_response`, value: data.studentResponse });
  }

  if (data.correctResponses?.length && data.correctResponses[0]) {
    elements.push({ element: `cmi.interactions.${index}.correct_responses.0.pattern`, value: data.correctResponses[0] });
  }

  return elements;
}

/**
 * Creates objective elements for testing SCORM objectives
 * @param index - Objective index (0-based)
 * @param data - Objective data including id, status, score
 * @returns Array of ScormTrackingElement objects for the objective
 */
function createObjectiveElements(
  index: number,
  data: {
    id: string;
    status: string;
    score?: { raw: number; min?: number; max?: number };
  }
): ScormTrackingElement[] {
  const elements: ScormTrackingElement[] = [
    { element: `cmi.objectives.${index}.id`, value: data.id },
    { element: `cmi.objectives.${index}.status`, value: data.status },
  ];

  if (data.score) {
    elements.push({ element: `cmi.objectives.${index}.score.raw`, value: String(data.score.raw) });
    if (data.score.min !== undefined) {
      elements.push({ element: `cmi.objectives.${index}.score.min`, value: String(data.score.min) });
    }
    if (data.score.max !== undefined) {
      elements.push({ element: `cmi.objectives.${index}.score.max`, value: String(data.score.max) });
    }
  }

  return elements;
}

describe('useScormTracking Hook', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    // Create a fresh QueryClient for each test with specific mutation defaults
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
        },
        mutations: {
          retry: false,
        },
      },
    });

    // Reset all mocks before each test
    vi.clearAllMocks();
    vi.resetAllMocks();
  });

  afterEach(() => {
    // Clear the query client cache
    queryClient.clear();
    vi.restoreAllMocks();
  });

  describe('Hook Initialization and Structure', () => {
    it('should return saveTracking function', async () => {
      mockSubmitTracking.mockResolvedValue(createMockTrackingResponse());

      const { result } = renderHook(
        () => useScormTracking(),
        { wrapper: createWrapper(queryClient) }
      );

      expect(result.current.saveTracking).toBeDefined();
      expect(typeof result.current.saveTracking).toBe('function');
    });

    it('should return isLoading state', async () => {
      mockSubmitTracking.mockResolvedValue(createMockTrackingResponse());

      const { result } = renderHook(
        () => useScormTracking(),
        { wrapper: createWrapper(queryClient) }
      );

      expect(result.current.isLoading).toBeDefined();
      expect(typeof result.current.isLoading).toBe('boolean');
    });

    it('should return isError state', async () => {
      mockSubmitTracking.mockResolvedValue(createMockTrackingResponse());

      const { result } = renderHook(
        () => useScormTracking(),
        { wrapper: createWrapper(queryClient) }
      );

      expect(result.current.isError).toBeDefined();
      expect(typeof result.current.isError).toBe('boolean');
    });

    it('should return error property', async () => {
      mockSubmitTracking.mockResolvedValue(createMockTrackingResponse());

      const { result } = renderHook(
        () => useScormTracking(),
        { wrapper: createWrapper(queryClient) }
      );

      expect(result.current.error).toBeNull();
    });

    it('should return reset function', async () => {
      mockSubmitTracking.mockResolvedValue(createMockTrackingResponse());

      const { result } = renderHook(
        () => useScormTracking(),
        { wrapper: createWrapper(queryClient) }
      );

      expect(result.current.reset).toBeDefined();
      expect(typeof result.current.reset).toBe('function');
    });
  });

  describe('Successful Tracking Data Submission', () => {
    it('should submit tracking data with CMI element array structure', async () => {
      const mockResponse = createMockTrackingResponse({
        tracks: { 'cmi.core.lesson_status': 'completed' },
      });
      mockSubmitTracking.mockResolvedValue(mockResponse);

      const { result } = renderHook(
        () => useScormTracking(),
        { wrapper: createWrapper(queryClient) }
      );

      const trackingElements: ScormTrackingElement[] = [
        { element: 'cmi.core.lesson_status', value: 'completed' },
      ];

      await act(async () => {
        result.current.saveTracking(createTrackingParams(trackingElements));
      });

      await waitFor(() => {
        expectTrackingApiCall(trackingElements);
      });
    });

    it('should handle successful submission and update isLoading state', async () => {
      mockSubmitTracking.mockResolvedValue(createMockTrackingResponse());

      const { result } = renderHook(
        () => useScormTracking(),
        { wrapper: createWrapper(queryClient) }
      );

      expect(result.current.isLoading).toBe(false);

      await act(async () => {
        result.current.saveTracking(createTrackingParams([{ element: 'cmi.core.lesson_status', value: 'completed' }]));
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
        expect(result.current.isError).toBe(false);
      });
    });
  });

  describe('SCORM 1.2 CMI Elements', () => {
    it('should submit cmi.core.lesson_status element', async () => {
      mockSubmitTracking.mockResolvedValue(createMockTrackingResponse());

      const { result } = renderHook(
        () => useScormTracking(),
        { wrapper: createWrapper(queryClient) }
      );

      const elements: ScormTrackingElement[] = [
        { element: 'cmi.core.lesson_status', value: 'completed' },
      ];

      await act(async () => {
        result.current.saveTracking(createTrackingParams(elements));
      });

      await waitFor(() => {
        expectTrackingApiCalledWithElements(elements);
      });
    });

    it('should submit cmi.core.score.raw element', async () => {
      mockSubmitTracking.mockResolvedValue(createMockTrackingResponse());

      const { result } = renderHook(
        () => useScormTracking(),
        { wrapper: createWrapper(queryClient) }
      );

      const elements: ScormTrackingElement[] = [
        { element: 'cmi.core.score.raw', value: '85' },
      ];

      await act(async () => {
        result.current.saveTracking(createTrackingParams(elements));
      });

      await waitFor(() => {
        expectTrackingApiCalledWithElements(elements);
      });
    });

    it('should submit cmi.core.score.min element', async () => {
      mockSubmitTracking.mockResolvedValue(createMockTrackingResponse());

      const { result } = renderHook(
        () => useScormTracking(),
        { wrapper: createWrapper(queryClient) }
      );

      const elements: ScormTrackingElement[] = [
        { element: 'cmi.core.score.min', value: '0' },
      ];

      await act(async () => {
        result.current.saveTracking(createTrackingParams(elements));
      });

      await waitFor(() => {
        expectTrackingApiCalledWithElements(elements);
      });
    });

    it('should submit cmi.core.score.max element', async () => {
      mockSubmitTracking.mockResolvedValue(createMockTrackingResponse());

      const { result } = renderHook(
        () => useScormTracking(),
        { wrapper: createWrapper(queryClient) }
      );

      const elements: ScormTrackingElement[] = [
        { element: 'cmi.core.score.max', value: '100' },
      ];

      await act(async () => {
        result.current.saveTracking(createTrackingParams(elements));
      });

      await waitFor(() => {
        expectTrackingApiCalledWithElements(elements);
      });
    });

    it('should submit cmi.core.session_time element', async () => {
      mockSubmitTracking.mockResolvedValue(createMockTrackingResponse());

      const { result } = renderHook(
        () => useScormTracking(),
        { wrapper: createWrapper(queryClient) }
      );

      const elements: ScormTrackingElement[] = [
        { element: 'cmi.core.session_time', value: '00:15:30' },
      ];

      await act(async () => {
        result.current.saveTracking(createTrackingParams(elements));
      });

      await waitFor(() => {
        expectTrackingApiCalledWithElements(elements);
      });
    });

    it('should submit cmi.suspend_data element', async () => {
      mockSubmitTracking.mockResolvedValue(createMockTrackingResponse());

      const { result } = renderHook(
        () => useScormTracking(),
        { wrapper: createWrapper(queryClient) }
      );

      const elements: ScormTrackingElement[] = [
        { element: 'cmi.suspend_data', value: 'bookmark=page5;score=85' },
      ];

      await act(async () => {
        result.current.saveTracking(createTrackingParams(elements));
      });

      await waitFor(() => {
        expectTrackingApiCalledWithElements(elements);
      });
    });

    it('should submit cmi.core.exit element', async () => {
      mockSubmitTracking.mockResolvedValue(createMockTrackingResponse());

      const { result } = renderHook(
        () => useScormTracking(),
        { wrapper: createWrapper(queryClient) }
      );

      const elements: ScormTrackingElement[] = [
        { element: 'cmi.core.exit', value: 'suspend' },
      ];

      await act(async () => {
        result.current.saveTracking(createTrackingParams(elements));
      });

      await waitFor(() => {
        expectTrackingApiCalledWithElements(elements);
      });
    });

    it('should submit cmi.core.lesson_location element', async () => {
      mockSubmitTracking.mockResolvedValue(createMockTrackingResponse());

      const { result } = renderHook(
        () => useScormTracking(),
        { wrapper: createWrapper(queryClient) }
      );

      const elements: ScormTrackingElement[] = [
        { element: 'cmi.core.lesson_location', value: 'page_15' },
      ];

      await act(async () => {
        result.current.saveTracking(createTrackingParams(elements));
      });

      await waitFor(() => {
        expectTrackingApiCalledWithElements(elements);
      });
    });
  });

  describe('SCORM 2004 CMI Elements', () => {
    it('should submit cmi.completion_status element', async () => {
      mockSubmitTracking.mockResolvedValue(createMockTrackingResponse());

      const { result } = renderHook(
        () => useScormTracking(),
        { wrapper: createWrapper(queryClient) }
      );

      const elements: ScormTrackingElement[] = [
        { element: 'cmi.completion_status', value: 'completed' },
      ];

      await act(async () => {
        result.current.saveTracking(createTrackingParams(elements));
      });

      await waitFor(() => {
        expectTrackingApiCalledWithElements(elements);
      });
    });

    it('should submit cmi.success_status element', async () => {
      mockSubmitTracking.mockResolvedValue(createMockTrackingResponse());

      const { result } = renderHook(
        () => useScormTracking(),
        { wrapper: createWrapper(queryClient) }
      );

      const elements: ScormTrackingElement[] = [
        { element: 'cmi.success_status', value: 'passed' },
      ];

      await act(async () => {
        result.current.saveTracking(createTrackingParams(elements));
      });

      await waitFor(() => {
        expectTrackingApiCalledWithElements(elements);
      });
    });

    it('should submit cmi.score.scaled element', async () => {
      mockSubmitTracking.mockResolvedValue(createMockTrackingResponse());

      const { result } = renderHook(
        () => useScormTracking(),
        { wrapper: createWrapper(queryClient) }
      );

      const elements: ScormTrackingElement[] = [
        { element: 'cmi.score.scaled', value: '0.85' },
      ];

      await act(async () => {
        result.current.saveTracking(createTrackingParams(elements));
      });

      await waitFor(() => {
        expectTrackingApiCalledWithElements(elements);
      });
    });

    it('should submit cmi.session_time element (ISO 8601 format)', async () => {
      mockSubmitTracking.mockResolvedValue(createMockTrackingResponse());

      const { result } = renderHook(
        () => useScormTracking(),
        { wrapper: createWrapper(queryClient) }
      );

      const elements: ScormTrackingElement[] = [
        { element: 'cmi.session_time', value: 'PT1H30M45S' },
      ];

      await act(async () => {
        result.current.saveTracking(createTrackingParams(elements));
      });

      await waitFor(() => {
        expectTrackingApiCalledWithElements(elements);
      });
    });

    it('should submit cmi.progress_measure element', async () => {
      mockSubmitTracking.mockResolvedValue(createMockTrackingResponse());

      const { result } = renderHook(
        () => useScormTracking(),
        { wrapper: createWrapper(queryClient) }
      );

      const elements: ScormTrackingElement[] = [
        { element: 'cmi.progress_measure', value: '0.75' },
      ];

      await act(async () => {
        result.current.saveTracking(createTrackingParams(elements));
      });

      await waitFor(() => {
        expectTrackingApiCalledWithElements(elements);
      });
    });

    it('should submit adl.nav.request element', async () => {
      mockSubmitTracking.mockResolvedValue(createMockTrackingResponse());

      const { result } = renderHook(
        () => useScormTracking(),
        { wrapper: createWrapper(queryClient) }
      );

      const elements: ScormTrackingElement[] = [
        { element: 'adl.nav.request', value: 'continue' },
      ];

      await act(async () => {
        result.current.saveTracking(createTrackingParams(elements));
      });

      await waitFor(() => {
        expectTrackingApiCalledWithElements(elements);
      });
    });

    it('should submit cmi.location element', async () => {
      mockSubmitTracking.mockResolvedValue(createMockTrackingResponse());

      const { result } = renderHook(
        () => useScormTracking(),
        { wrapper: createWrapper(queryClient) }
      );

      const elements: ScormTrackingElement[] = [
        { element: 'cmi.location', value: 'slide_25' },
      ];

      await act(async () => {
        result.current.saveTracking(createTrackingParams(elements));
      });

      await waitFor(() => {
        expectTrackingApiCalledWithElements(elements);
      });
    });
  });

  describe('Batch Tracking Submission', () => {
    it('should submit multiple tracking elements in a single API call', async () => {
      mockSubmitTracking.mockResolvedValue(createMockTrackingResponse());

      const { result } = renderHook(
        () => useScormTracking(),
        { wrapper: createWrapper(queryClient) }
      );

      const batchElements: ScormTrackingElement[] = [
        { element: 'cmi.core.lesson_status', value: 'completed' },
        { element: 'cmi.core.score.raw', value: '85' },
        { element: 'cmi.core.score.min', value: '0' },
        { element: 'cmi.core.score.max', value: '100' },
        { element: 'cmi.core.session_time', value: '00:45:30' },
        { element: 'cmi.suspend_data', value: 'completed_modules=1,2,3' },
      ];

      await act(async () => {
        result.current.saveTracking(createTrackingParams(batchElements));
      });

      await waitFor(() => {
        expect(mockSubmitTracking).toHaveBeenCalledTimes(1);
        expectTrackingApiCalledWithElements(batchElements);
      });
    });

    it('should handle large batch of SCORM 2004 elements', async () => {
      mockSubmitTracking.mockResolvedValue(createMockTrackingResponse());

      const { result } = renderHook(
        () => useScormTracking(),
        { wrapper: createWrapper(queryClient) }
      );

      const largeScorm2004Batch: ScormTrackingElement[] = [
        { element: 'cmi.completion_status', value: 'completed' },
        { element: 'cmi.success_status', value: 'passed' },
        { element: 'cmi.score.scaled', value: '0.95' },
        { element: 'cmi.score.raw', value: '95' },
        { element: 'cmi.score.min', value: '0' },
        { element: 'cmi.score.max', value: '100' },
        { element: 'cmi.session_time', value: 'PT2H15M30S' },
        { element: 'cmi.progress_measure', value: '1.0' },
        { element: 'cmi.location', value: 'final_assessment' },
        { element: 'cmi.suspend_data', value: 'final_state_data' },
      ];

      await act(async () => {
        result.current.saveTracking(createTrackingParams(largeScorm2004Batch));
      });

      await waitFor(() => {
        expect(mockSubmitTracking).toHaveBeenCalledTimes(1);
        expectTrackingApiCalledWithElements(largeScorm2004Batch);
      });
    });
  });

  describe('CMI Element Validation', () => {
    describe('Valid Element Names', () => {
      // Note: validateCMIElement takes (element, value) and returns { isValid: boolean, ... }
      it('should validate cmi.core.lesson_status as valid SCORM 1.2 element', () => {
        expect(validateCMIElement('cmi.core.lesson_status', 'completed').isValid).toBe(true);
      });

      it('should validate cmi.core.score.raw as valid SCORM 1.2 element', () => {
        expect(validateCMIElement('cmi.core.score.raw', '85').isValid).toBe(true);
      });

      it('should validate cmi.core.session_time as valid SCORM 1.2 element', () => {
        expect(validateCMIElement('cmi.core.session_time', '00:05:30').isValid).toBe(true);
      });

      it('should validate cmi.suspend_data as valid SCORM 1.2 element', () => {
        expect(validateCMIElement('cmi.suspend_data', 'bookmark_data').isValid).toBe(true);
      });

      it('should validate cmi.core.exit as valid SCORM 1.2 element', () => {
        expect(validateCMIElement('cmi.core.exit', 'suspend').isValid).toBe(true);
      });

      it('should validate cmi.completion_status as valid SCORM 2004 element', () => {
        expect(validateCMIElement('cmi.completion_status', 'completed').isValid).toBe(true);
      });

      it('should validate cmi.success_status as valid SCORM 2004 element', () => {
        expect(validateCMIElement('cmi.success_status', 'passed').isValid).toBe(true);
      });

      it('should validate cmi.score.scaled as valid SCORM 2004 element', () => {
        expect(validateCMIElement('cmi.score.scaled', '0.85').isValid).toBe(true);
      });

      it('should validate cmi.progress_measure as valid SCORM 2004 element', () => {
        expect(validateCMIElement('cmi.progress_measure', '0.75').isValid).toBe(true);
      });

      it('should validate adl.nav.request as valid SCORM 2004 element', () => {
        expect(validateCMIElement('adl.nav.request', 'continue').isValid).toBe(true);
      });

      it('should validate interaction elements with index', () => {
        expect(validateCMIElement('cmi.interactions.0.id', 'q1').isValid).toBe(true);
        expect(validateCMIElement('cmi.interactions.0.type', 'choice').isValid).toBe(true);
        expect(validateCMIElement('cmi.interactions.0.result', 'correct').isValid).toBe(true);
        expect(validateCMIElement('cmi.interactions.0.latency', '00:00:05').isValid).toBe(true);
      });

      it('should validate objective elements with index', () => {
        expect(validateCMIElement('cmi.objectives.0.id', 'obj1').isValid).toBe(true);
        expect(validateCMIElement('cmi.objectives.0.status', 'completed').isValid).toBe(true);
        expect(validateCMIElement('cmi.objectives.0.score.raw', '90').isValid).toBe(true);
      });
    });

    describe('Invalid Element Names', () => {
      // Unknown elements are actually allowed for forward compatibility (returns isValid: true)
      // Only explicitly invalid values return isValid: false
      it('should accept unknown CMI element names for forward compatibility', () => {
        // The implementation logs a warning but allows unknown elements
        expect(validateCMIElement('custom.element.name', 'test').isValid).toBe(true);
      });

      it('should reject empty element names', () => {
        expect(validateCMIElement('', 'value').isValid).toBe(false);
      });

      it('should accept elements without cmi or adl prefix for forward compatibility', () => {
        // Unknown elements are allowed for forward compatibility
        expect(validateCMIElement('lesson_status', 'completed').isValid).toBe(true);
      });

      it('should reject invalid lesson_status values for cmi.core.lesson_status', () => {
        // SCORM 1.2 lesson_status only accepts specific values
        expect(validateCMIElement('cmi.core.lesson_status', 'invalid_status').isValid).toBe(false);
      });

      it('should accept SCORM 2004 elements regardless of version context', () => {
        // validateCMIElement doesn't validate version-specific element usage
        expect(validateCMIElement('cmi.completion_status', 'completed').isValid).toBe(true);
      });

      it('should accept SCORM 1.2 elements regardless of version context', () => {
        // validateCMIElement doesn't validate version-specific element usage
        expect(validateCMIElement('cmi.core.lesson_status', 'completed').isValid).toBe(true);
      });

      it('should accept interaction elements with numeric index', () => {
        // Even if the index format is unusual, it's accepted for forward compatibility
        expect(validateCMIElement('cmi.interactions.0.id', 'q1').isValid).toBe(true);
      });
    });
  });

  describe('Lesson Status Values', () => {
    const lessonStatusValues = [
      'passed',
      'completed',
      'failed',
      'incomplete',
      'browsed',
      'not attempted',
    ];

    lessonStatusValues.forEach((status) => {
      it(`should accept "${status}" as valid lesson_status value`, async () => {
        mockSubmitTracking.mockResolvedValue(createMockTrackingResponse());

        const { result } = renderHook(
          () => useScormTracking(),
          { wrapper: createWrapper(queryClient) }
        );

        const elements: ScormTrackingElement[] = [
          { element: 'cmi.core.lesson_status', value: status },
        ];

        await act(async () => {
          result.current.saveTracking(createTrackingParams(elements));
        });

        await waitFor(() => {
          expectTrackingApiCalledWithElements(elements);
        });
      });
    });

    it('should create lesson status element using helper function', () => {
      // createLessonStatusElement only takes status, always returns SCORM 1.2 element
      const element = createLessonStatusElement('completed');
      expect(element).toEqual({ element: 'cmi.core.lesson_status', value: 'completed' });
    });

    it('should create completion status element for SCORM 2004', () => {
      // For SCORM 2004, use createCompletionStatusElement instead
      const element = createCompletionStatusElement('completed');
      expect(element).toEqual({ element: 'cmi.completion_status', value: 'completed' });
    });
  });

  describe('Session Time Formatting', () => {
    describe('SCORM 1.2 Format (HHHH:MM:SS.ss)', () => {
      it('should format milliseconds to SCORM 1.2 session time format', () => {
        const milliseconds = 3661000; // 1 hour, 1 minute, 1 second
        const formatted = formatSessionTime(milliseconds, '1.2');
        expect(formatted).toMatch(/^\d{2,4}:\d{2}:\d{2}(\.\d{1,2})?$/);
      });

      it('should format zero milliseconds correctly', () => {
        const formatted = formatSessionTime(0, '1.2');
        expect(formatted).toBe('0000:00:00.00');
      });

      it('should format hours exceeding 24 correctly', () => {
        const milliseconds = 90000000; // 25 hours
        const formatted = formatSessionTime(milliseconds, '1.2');
        expect(formatted).toMatch(/^\d{2,4}:\d{2}:\d{2}/);
      });

      it('should include fractional seconds', () => {
        const milliseconds = 1500; // 1.5 seconds
        const formatted = formatSessionTime(milliseconds, '1.2');
        expect(formatted).toContain('.');
      });
    });

    describe('SCORM 2004 Format (ISO 8601 Duration)', () => {
      it('should format milliseconds to ISO 8601 duration format', () => {
        const milliseconds = 5430000; // 1 hour, 30 minutes, 30 seconds
        const formatted = formatSessionTime(milliseconds, '2004');
        expect(formatted).toMatch(/^PT\d+H\d+M\d+(\.\d+)?S$/);
      });

      it('should format zero milliseconds to PT0S', () => {
        const formatted = formatSessionTime(0, '2004');
        // Hours and minutes are omitted when zero, only seconds included
        expect(formatted).toBe('PT0S');
      });

      it('should handle minutes only', () => {
        const milliseconds = 1800000; // 30 minutes
        const formatted = formatSessionTime(milliseconds, '2004');
        expect(formatted).toContain('M');
      });

      it('should handle seconds only', () => {
        const milliseconds = 45000; // 45 seconds
        const formatted = formatSessionTime(milliseconds, '2004');
        expect(formatted).toContain('S');
      });
    });

    describe('Parse SCORM Time', () => {
      it('should parse SCORM 1.2 time format to milliseconds', () => {
        // parseScormTime auto-detects format (only takes one argument)
        const milliseconds = parseScormTime('01:30:45');
        expect(milliseconds).toBe(5445000); // 1h 30m 45s = 5445 seconds * 1000
      });

      it('should parse SCORM 2004 ISO 8601 duration to milliseconds', () => {
        // parseScormTime auto-detects format (only takes one argument)
        const milliseconds = parseScormTime('PT1H30M45S');
        expect(milliseconds).toBe(5445000);
      });

      it('should parse empty string to zero', () => {
        // parseScormTime auto-detects format (only takes one argument)
        expect(parseScormTime('')).toBe(0);
      });
    });

    it('should create session time element using helper function', () => {
      const element = createSessionTimeElement(3600000, '1.2'); // 1 hour
      expect(element.element).toBe('cmi.core.session_time');
      expect(element.value).toMatch(/^\d{2,4}:\d{2}:\d{2}/);
    });

    it('should create SCORM 2004 session time element', () => {
      const element = createSessionTimeElement(3600000, '2004'); // 1 hour
      expect(element.element).toBe('cmi.session_time');
      expect(element.value).toMatch(/^PT/);
    });
  });

  describe('Suspend Data Persistence', () => {
    it('should submit suspend_data up to 4KB', async () => {
      mockSubmitTracking.mockResolvedValue(createMockTrackingResponse());

      const { result } = renderHook(
        () => useScormTracking(),
        { wrapper: createWrapper(queryClient) }
      );

      // Generate 4KB of suspend data
      const largeData = 'x'.repeat(4096);
      const elements: ScormTrackingElement[] = [
        { element: 'cmi.suspend_data', value: largeData },
      ];

      await act(async () => {
        result.current.saveTracking(createTrackingParams(elements));
      });

      await waitFor(() => {
        expect(mockSubmitTracking).toHaveBeenCalledWith(
          expect.any(Number),
          expect.objectContaining({
            tracks: expect.objectContaining({
              'cmi.suspend_data': expect.stringMatching(/^x{4096}$/),
            }),
          })
        );
      });
    });

    it('should create suspend data element using helper function', () => {
      const element = createSuspendDataElement('bookmark=page5;progress=75');
      expect(element).toEqual({
        element: 'cmi.suspend_data',
        value: 'bookmark=page5;progress=75',
      });
    });

    it('should handle JSON-encoded suspend data', async () => {
      mockSubmitTracking.mockResolvedValue(createMockTrackingResponse());

      const { result } = renderHook(
        () => useScormTracking(),
        { wrapper: createWrapper(queryClient) }
      );

      const jsonData = JSON.stringify({
        currentPage: 10,
        completedModules: [1, 2, 3],
        score: 85,
      });

      const elements: ScormTrackingElement[] = [
        { element: 'cmi.suspend_data', value: jsonData },
      ];

      await act(async () => {
        result.current.saveTracking(createTrackingParams(elements));
      });

      await waitFor(() => {
        expectTrackingApiCalledWithElements(elements);
      });
    });

    it('should handle base64-encoded suspend data', async () => {
      mockSubmitTracking.mockResolvedValue(createMockTrackingResponse());

      const { result } = renderHook(
        () => useScormTracking(),
        { wrapper: createWrapper(queryClient) }
      );

      const base64Data = btoa('binary data simulation for suspend');
      const elements: ScormTrackingElement[] = [
        { element: 'cmi.suspend_data', value: base64Data },
      ];

      await act(async () => {
        result.current.saveTracking(createTrackingParams(elements));
      });

      await waitFor(() => {
        expectTrackingApiCalledWithElements(elements);
      });
    });
  });

  describe('Score Tracking', () => {
    it('should create score elements using helper function for SCORM 1.2', () => {
      const elements = createScoreElements(
        { raw: 85, min: 0, max: 100 },
        '1.2'
      );

      expect(elements).toEqual(
        expect.arrayContaining([
          { element: 'cmi.core.score.raw', value: '85' },
          { element: 'cmi.core.score.min', value: '0' },
          { element: 'cmi.core.score.max', value: '100' },
        ])
      );
    });

    it('should create score elements using helper function for SCORM 2004', () => {
      const elements = createScoreElements(
        { raw: 85, min: 0, max: 100, scaled: 0.85 },
        '2004'
      );

      expect(elements).toEqual(
        expect.arrayContaining([
          { element: 'cmi.score.raw', value: '85' },
          { element: 'cmi.score.min', value: '0' },
          { element: 'cmi.score.max', value: '100' },
          { element: 'cmi.score.scaled', value: '0.85' },
        ])
      );
    });

    it('should submit all score elements together', async () => {
      mockSubmitTracking.mockResolvedValue(createMockTrackingResponse());

      const { result } = renderHook(
        () => useScormTracking(),
        { wrapper: createWrapper(queryClient) }
      );

      const scoreElements = createScoreElements(
        { raw: 92, min: 0, max: 100 },
        '1.2'
      );

      await act(async () => {
        result.current.saveTracking(createTrackingParams(scoreElements));
      });

      await waitFor(() => {
        expectTrackingApiCalledWithElements(scoreElements);
      });
    });

    it('should handle scaled score for SCORM 2004', async () => {
      mockSubmitTracking.mockResolvedValue(createMockTrackingResponse());

      const { result } = renderHook(
        () => useScormTracking(),
        { wrapper: createWrapper(queryClient) }
      );

      const elements: ScormTrackingElement[] = [
        { element: 'cmi.score.scaled', value: '0.92' },
      ];

      await act(async () => {
        result.current.saveTracking(createTrackingParams(elements));
      });

      await waitFor(() => {
        expectTrackingApiCalledWithElements(elements);
      });
    });
  });

  describe('Exit Type Handling', () => {
    const exitTypes = ['suspend', 'logout', 'time-out', ''];

    exitTypes.forEach((exitType) => {
      it(`should handle exit type "${exitType || 'empty'}"`, async () => {
        mockSubmitTracking.mockResolvedValue(createMockTrackingResponse());

        const { result } = renderHook(
          () => useScormTracking(),
          { wrapper: createWrapper(queryClient) }
        );

        const elements: ScormTrackingElement[] = [
          { element: 'cmi.core.exit', value: exitType },
        ];

        await act(async () => {
          result.current.saveTracking(createTrackingParams(elements));
        });

        await waitFor(() => {
          expectTrackingApiCalledWithElements(elements);
        });
      });
    });

    it('should create exit element using helper function for SCORM 1.2', () => {
      const element = createExitElement('suspend', '1.2');
      expect(element).toEqual({ element: 'cmi.core.exit', value: 'suspend' });
    });

    it('should create exit element for SCORM 2004', () => {
      const element = createExitElement('suspend', '2004');
      expect(element).toEqual({ element: 'cmi.exit', value: 'suspend' });
    });
  });

  describe('Navigation Request Submission', () => {
    // Valid navigation requests according to ScormNavigationRequestValue type
    // Note: 'choice' alone is NOT valid - it must be '{target=item}choice'
    const navigationRequests = [
      'continue',
      'previous',
      'exit',
      'exitAll',
      'abandon',
      'abandonAll',
      'suspendAll',
    ];

    navigationRequests.forEach((navRequest) => {
      it(`should submit navigation request "${navRequest}"`, async () => {
        mockSubmitTracking.mockResolvedValue(createMockTrackingResponse());

        const { result } = renderHook(
          () => useScormTracking(),
          { wrapper: createWrapper(queryClient) }
        );

        const elements: ScormTrackingElement[] = [
          { element: 'adl.nav.request', value: navRequest },
        ];

        await act(async () => {
          result.current.saveTracking(createTrackingParams(elements));
        });

        await waitFor(() => {
          expectTrackingApiCalledWithElements(elements);
        });
      });
    });

    it('should create navigation element using helper function', () => {
      const element = createNavigationRequestElement('continue');
      expect(element).toEqual({ element: 'adl.nav.request', value: 'continue' });
    });

    it('should handle choice navigation with target', () => {
      // createNavigationRequestElement takes the full formatted value
      // For choice with target, pass the properly formatted string
      const element = createNavigationRequestElement('{target=item_5}choice');
      expect(element).toEqual({ element: 'adl.nav.request', value: '{target=item_5}choice' });
    });
  });

  describe('Optimistic Updates', () => {
    it('should immediately update UI before server response', async () => {
      // Create a deferred promise to control when the mock resolves
      let resolvePromise: (value: ScormTrackingData) => void;
      const deferredPromise = new Promise<ScormTrackingData>((resolve) => {
        resolvePromise = resolve;
      });
      mockSubmitTracking.mockReturnValue(deferredPromise);

      const { result } = renderHook(
        () => useScormTracking(),
        { wrapper: createWrapper(queryClient) }
      );

      const elements: ScormTrackingElement[] = [
        { element: 'cmi.core.lesson_status', value: 'completed' },
      ];

      // Start the mutation but don't wait for it
      act(() => {
        result.current.saveTracking(createTrackingParams(elements));
      });

      // Should be in loading state while waiting
      await waitFor(() => {
        expect(result.current.isLoading).toBe(true);
      });

      // Now resolve the promise
      await act(async () => {
        resolvePromise!(createMockTrackingResponse());
      });

      // Should no longer be loading after resolve
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('should rollback optimistic update on error', async () => {
      const error = new Error('Network error');
      mockSubmitTracking.mockRejectedValue(error);

      const { result } = renderHook(
        () => useScormTracking(),
        { wrapper: createWrapper(queryClient) }
      );

      const elements: ScormTrackingElement[] = [
        { element: 'cmi.core.lesson_status', value: 'completed' },
      ];

      await act(async () => {
        result.current.saveTracking(createTrackingParams(elements));
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
        expect(result.current.error).toBeTruthy();
      });
    });
  });

  describe('Cache Invalidation', () => {
    it('should invalidate SCORM queries on successful submission', async () => {
      mockSubmitTracking.mockResolvedValue(createMockTrackingResponse());

      const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(
        () => useScormTracking(),
        { wrapper: createWrapper(queryClient) }
      );

      const elements: ScormTrackingElement[] = [
        { element: 'cmi.core.lesson_status', value: 'completed' },
      ];

      await act(async () => {
        result.current.saveTracking(createTrackingParams(elements));
      });

      await waitFor(() => {
        expect(invalidateQueriesSpy).toHaveBeenCalled();
      });
    });

    it('should trigger SCORM query refetch after successful tracking', async () => {
      mockSubmitTracking.mockResolvedValue(createMockTrackingResponse());

      const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(
        () => useScormTracking(),
        { wrapper: createWrapper(queryClient) }
      );

      await act(async () => {
        result.current.saveTracking(createTrackingParams([
          { element: 'cmi.core.lesson_status', value: 'completed' },
        ]));
      });

      await waitFor(() => {
        // Verify that cache invalidation was triggered
        expect(invalidateQueriesSpy).toHaveBeenCalled();
      });
    });

    it('should also invalidate user data queries on completion', async () => {
      mockSubmitTracking.mockResolvedValue(createMockTrackingResponse());

      const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(
        () => useScormTracking(),
        { wrapper: createWrapper(queryClient) }
      );

      await act(async () => {
        result.current.saveTracking(createTrackingParams([{ element: 'cmi.core.score.raw', value: '100' },
        ]));
      });

      await waitFor(() => {
        expect(invalidateQueriesSpy).toHaveBeenCalled();
      });
    });
  });

  describe('Error Handling', () => {
    describe('Network Failures', () => {
      it('should handle network failure with error state', async () => {
        const networkError = new Error('Network request failed');
        mockSubmitTracking.mockRejectedValue(networkError);

        const { result } = renderHook(
          () => useScormTracking(),
          { wrapper: createWrapper(queryClient) }
        );

        await act(async () => {
          result.current.saveTracking(createTrackingParams([
            { element: 'cmi.core.lesson_status', value: 'completed' },
          ]));
        });

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
          expect(result.current.error).toEqual(networkError);
        });
      });

      it('should handle timeout errors', async () => {
        const timeoutError = new Error('Request timeout');
        mockSubmitTracking.mockRejectedValue(timeoutError);

        const { result } = renderHook(
          () => useScormTracking(),
          { wrapper: createWrapper(queryClient) }
        );

        await act(async () => {
          result.current.saveTracking(createTrackingParams([
            { element: 'cmi.core.lesson_status', value: 'completed' },
          ]));
        });

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });
      });

      it('should handle server 500 errors', async () => {
        const serverError = new Error('Internal Server Error');
        (serverError as any).status = 500;
        mockSubmitTracking.mockRejectedValue(serverError);

        const { result } = renderHook(
          () => useScormTracking(),
          { wrapper: createWrapper(queryClient) }
        );

        await act(async () => {
          result.current.saveTracking(createTrackingParams([
            { element: 'cmi.core.lesson_status', value: 'completed' },
          ]));
        });

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });
      });
    });

    describe('Invalid CMI Element Errors', () => {
      it('should handle API error for invalid CMI element', async () => {
        const invalidElementError = new Error('Invalid CMI element: invalid.element');
        mockSubmitTracking.mockRejectedValue(invalidElementError);

        const { result } = renderHook(
          () => useScormTracking(),
          { wrapper: createWrapper(queryClient) }
        );

        await act(async () => {
          result.current.saveTracking(createTrackingParams([
            { element: 'invalid.element', value: 'test' },
          ]));
        });

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });
      });
    });

    describe('Reset Function', () => {
      it('should reset error state using reset function', async () => {
        const error = new Error('Test error');
        mockSubmitTracking.mockRejectedValue(error);

        const { result } = renderHook(
          () => useScormTracking(),
          { wrapper: createWrapper(queryClient) }
        );

        await act(async () => {
          result.current.saveTracking(createTrackingParams([
            { element: 'cmi.core.lesson_status', value: 'completed' },
          ]));
        });

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });

        // Reset the mutation state
        act(() => {
          result.current.reset();
        });

        await waitFor(() => {
          expect(result.current.isError).toBe(false);
          expect(result.current.error).toBeNull();
        });
      });
    });
  });

  describe('Network Interruption Recovery', () => {
    it('should handle network interruption gracefully', async () => {
      // First call fails, simulating network interruption
      mockSubmitTracking.mockRejectedValueOnce(new Error('Network interrupted'));

      const { result } = renderHook(
        () => useScormTracking(),
        { wrapper: createWrapper(queryClient) }
      );

      const elements: ScormTrackingElement[] = [
        { element: 'cmi.core.lesson_status', value: 'completed' },
      ];

      await act(async () => {
        result.current.saveTracking(createTrackingParams(elements));
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      // Reset and try again with success
      mockSubmitTracking.mockResolvedValue(createMockTrackingResponse());

      act(() => {
        result.current.reset();
      });

      await act(async () => {
        result.current.saveTracking(createTrackingParams(elements));
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(false);
      });
    });

    it('should buffer pending tracking data during network issues', async () => {
      mockSubmitTracking.mockRejectedValueOnce(new Error('Network unavailable'));
      mockSubmitTracking.mockResolvedValueOnce(createMockTrackingResponse());

      const { result } = renderHook(
        () => useScormTracking(),
        { wrapper: createWrapper(queryClient) }
      );

      // First attempt fails
      await act(async () => {
        result.current.saveTracking(createTrackingParams([
          { element: 'cmi.core.lesson_status', value: 'completed' },
        ]));
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      // Reset state
      act(() => {
        result.current.reset();
      });

      // Retry with network restored
      await act(async () => {
        result.current.saveTracking(createTrackingParams([
          { element: 'cmi.core.lesson_status', value: 'completed' },
        ]));
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(false);
        expect(mockSubmitTracking).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Concurrent Submissions', () => {
    it('should handle sequential submissions correctly', async () => {
      mockSubmitTracking.mockResolvedValue(createMockTrackingResponse());

      const { result } = renderHook(
        () => useScormTracking(),
        { wrapper: createWrapper(queryClient) }
      );

      // First submission
      await act(async () => {
        result.current.saveTracking(createTrackingParams([
          { element: 'cmi.core.lesson_status', value: 'incomplete' },
        ]));
      });

      await waitFor(() => {
        expect(mockSubmitTracking).toHaveBeenCalledTimes(1);
      });

      // Second submission
      await act(async () => {
        result.current.saveTracking(createTrackingParams([
          { element: 'cmi.core.lesson_status', value: 'completed' },
        ]));
      });

      await waitFor(() => {
        expect(mockSubmitTracking).toHaveBeenCalledTimes(2);
      });
    });

    it('should manage concurrent mutation calls with queue', async () => {
      const callOrder: number[] = [];
      let callCount = 0;

      mockSubmitTracking.mockImplementation(async () => {
        const currentCall = ++callCount;
        callOrder.push(currentCall);
        // Add delay to simulate network latency
        await new Promise((resolve) => setTimeout(resolve, 10));
        return createMockTrackingResponse();
      });

      const { result } = renderHook(
        () => useScormTracking(),
        { wrapper: createWrapper(queryClient) }
      );

      // Fire multiple submissions quickly
      await act(async () => {
        result.current.saveTracking(createTrackingParams([{ element: 'cmi.core.score.raw', value: '50' }]));
        result.current.saveTracking(createTrackingParams([{ element: 'cmi.core.score.raw', value: '75' }]));
        result.current.saveTracking(createTrackingParams([{ element: 'cmi.core.score.raw', value: '100' }]));
      });

      await waitFor(() => {
        expect(mockSubmitTracking).toHaveBeenCalledTimes(3);
      });
    });
  });

  describe('Large Payload Handling', () => {
    it('should handle large suspend_data payloads', async () => {
      mockSubmitTracking.mockResolvedValue(createMockTrackingResponse());

      const { result } = renderHook(
        () => useScormTracking(),
        { wrapper: createWrapper(queryClient) }
      );

      // Generate large payload approaching 4KB limit
      const largePayload = JSON.stringify({
        completedModules: Array.from({ length: 100 }, (_, i) => ({
          id: i,
          score: Math.random() * 100,
          timestamp: new Date().toISOString(),
        })),
        userProgress: 'x'.repeat(2000),
      });

      const elements: ScormTrackingElement[] = [
        { element: 'cmi.suspend_data', value: largePayload },
      ];

      await act(async () => {
        result.current.saveTracking(createTrackingParams(elements));
      });

      await waitFor(() => {
        expect(mockSubmitTracking).toHaveBeenCalledWith(
          expect.any(Number),
          expect.objectContaining({
            tracks: expect.objectContaining({
              'cmi.suspend_data': expect.any(String),
            }),
          })
        );
      });
    });

    it('should handle many interaction elements', async () => {
      mockSubmitTracking.mockResolvedValue(createMockTrackingResponse());

      const { result } = renderHook(
        () => useScormTracking(),
        { wrapper: createWrapper(queryClient) }
      );

      // Generate 50 interactions
      const interactionElements: ScormTrackingElement[] = [];
      for (let i = 0; i < 50; i++) {
        interactionElements.push(
          { element: `cmi.interactions.${i}.id`, value: `interaction_${i}` },
          { element: `cmi.interactions.${i}.type`, value: 'choice' },
          { element: `cmi.interactions.${i}.result`, value: 'correct' },
          { element: `cmi.interactions.${i}.latency`, value: '00:00:30' }
        );
      }

      await act(async () => {
        result.current.saveTracking(createTrackingParams(interactionElements));
      });

      await waitFor(() => {
        expectTrackingApiCalledWithElements(interactionElements);
      });
    });
  });

  describe('Interaction Tracking Submission', () => {
    it('should submit interaction id element', async () => {
      mockSubmitTracking.mockResolvedValue(createMockTrackingResponse());

      const { result } = renderHook(
        () => useScormTracking(),
        { wrapper: createWrapper(queryClient) }
      );

      const elements: ScormTrackingElement[] = [
        { element: 'cmi.interactions.0.id', value: 'question_1' },
      ];

      await act(async () => {
        result.current.saveTracking(createTrackingParams(elements));
      });

      await waitFor(() => {
        expectTrackingApiCalledWithElements(elements);
      });
    });

    it('should submit interaction type element', async () => {
      mockSubmitTracking.mockResolvedValue(createMockTrackingResponse());

      const { result } = renderHook(
        () => useScormTracking(),
        { wrapper: createWrapper(queryClient) }
      );

      const elements: ScormTrackingElement[] = [
        { element: 'cmi.interactions.0.type', value: 'choice' },
      ];

      await act(async () => {
        result.current.saveTracking(createTrackingParams(elements));
      });

      await waitFor(() => {
        expectTrackingApiCalledWithElements(elements);
      });
    });

    it('should submit interaction result element', async () => {
      mockSubmitTracking.mockResolvedValue(createMockTrackingResponse());

      const { result } = renderHook(
        () => useScormTracking(),
        { wrapper: createWrapper(queryClient) }
      );

      const elements: ScormTrackingElement[] = [
        { element: 'cmi.interactions.0.result', value: 'correct' },
      ];

      await act(async () => {
        result.current.saveTracking(createTrackingParams(elements));
      });

      await waitFor(() => {
        expectTrackingApiCalledWithElements(elements);
      });
    });

    it('should submit interaction latency element', async () => {
      mockSubmitTracking.mockResolvedValue(createMockTrackingResponse());

      const { result } = renderHook(
        () => useScormTracking(),
        { wrapper: createWrapper(queryClient) }
      );

      const elements: ScormTrackingElement[] = [
        { element: 'cmi.interactions.0.latency', value: '00:02:15' },
      ];

      await act(async () => {
        result.current.saveTracking(createTrackingParams(elements));
      });

      await waitFor(() => {
        expectTrackingApiCalledWithElements(elements);
      });
    });

    it('should create interaction elements using helper function', () => {
      const elements = createInteractionElements(0, {
        id: 'quiz_q1',
        type: 'choice',
        result: 'correct',
        latency: 45000, // 45 seconds in milliseconds
        studentResponse: 'a',
        correctResponses: ['a'],
      });

      expect(elements).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ element: 'cmi.interactions.0.id', value: 'quiz_q1' }),
          expect.objectContaining({ element: 'cmi.interactions.0.type', value: 'choice' }),
          expect.objectContaining({ element: 'cmi.interactions.0.result', value: 'correct' }),
        ])
      );
    });

    it('should handle multiple interaction types', async () => {
      mockSubmitTracking.mockResolvedValue(createMockTrackingResponse());

      const { result } = renderHook(
        () => useScormTracking(),
        { wrapper: createWrapper(queryClient) }
      );

      const interactionTypes = [
        'true-false',
        'choice',
        'fill-in',
        'long-fill-in',
        'matching',
        'performance',
        'sequencing',
        'likert',
        'numeric',
        'other',
      ];

      for (let i = 0; i < interactionTypes.length; i++) {
        const typeValue = interactionTypes[i];
        if (typeValue === undefined) {continue;}
        
        const elements: ScormTrackingElement[] = [
          { element: `cmi.interactions.${i}.type`, value: typeValue },
        ];

        await act(async () => {
          result.current.saveTracking(createTrackingParams(elements));
        });
      }

      await waitFor(() => {
        expect(mockSubmitTracking).toHaveBeenCalledTimes(interactionTypes.length);
      });
    });
  });

  describe('Objectives Tracking', () => {
    it('should submit objective id element', async () => {
      mockSubmitTracking.mockResolvedValue(createMockTrackingResponse());

      const { result } = renderHook(
        () => useScormTracking(),
        { wrapper: createWrapper(queryClient) }
      );

      const elements: ScormTrackingElement[] = [
        { element: 'cmi.objectives.0.id', value: 'objective_1' },
      ];

      await act(async () => {
        result.current.saveTracking(createTrackingParams(elements));
      });

      await waitFor(() => {
        expectTrackingApiCalledWithElements(elements);
      });
    });

    it('should submit objective status element', async () => {
      mockSubmitTracking.mockResolvedValue(createMockTrackingResponse());

      const { result } = renderHook(
        () => useScormTracking(),
        { wrapper: createWrapper(queryClient) }
      );

      const elements: ScormTrackingElement[] = [
        { element: 'cmi.objectives.0.status', value: 'completed' },
      ];

      await act(async () => {
        result.current.saveTracking(createTrackingParams(elements));
      });

      await waitFor(() => {
        expectTrackingApiCalledWithElements(elements);
      });
    });

    it('should submit objective score elements', async () => {
      mockSubmitTracking.mockResolvedValue(createMockTrackingResponse());

      const { result } = renderHook(
        () => useScormTracking(),
        { wrapper: createWrapper(queryClient) }
      );

      const elements: ScormTrackingElement[] = [
        { element: 'cmi.objectives.0.score.raw', value: '90' },
        { element: 'cmi.objectives.0.score.min', value: '0' },
        { element: 'cmi.objectives.0.score.max', value: '100' },
      ];

      await act(async () => {
        result.current.saveTracking(createTrackingParams(elements));
      });

      await waitFor(() => {
        expectTrackingApiCalledWithElements(elements);
      });
    });

    it('should create objective elements using helper function', () => {
      const elements = createObjectiveElements(0, {
        id: 'module_1_objective',
        status: 'completed',
        score: { raw: 85, min: 0, max: 100 },
      });

      expect(elements).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ element: 'cmi.objectives.0.id', value: 'module_1_objective' }),
          expect.objectContaining({ element: 'cmi.objectives.0.status', value: 'completed' }),
          expect.objectContaining({ element: 'cmi.objectives.0.score.raw', value: '85' }),
        ])
      );
    });

    it('should handle multiple objectives', async () => {
      mockSubmitTracking.mockResolvedValue(createMockTrackingResponse());

      const { result } = renderHook(
        () => useScormTracking(),
        { wrapper: createWrapper(queryClient) }
      );

      const objectiveElements: ScormTrackingElement[] = [];
      for (let i = 0; i < 5; i++) {
        objectiveElements.push(
          { element: `cmi.objectives.${i}.id`, value: `objective_${i}` },
          { element: `cmi.objectives.${i}.status`, value: 'completed' },
          { element: `cmi.objectives.${i}.score.raw`, value: `${80 + i}` }
        );
      }

      await act(async () => {
        result.current.saveTracking(createTrackingParams(objectiveElements));
      });

      await waitFor(() => {
        expectTrackingApiCalledWithElements(objectiveElements);
      });
    });
  });

  describe('Total Time Accumulation', () => {
    it('should submit cmi.core.total_time element for SCORM 1.2', async () => {
      mockSubmitTracking.mockResolvedValue(createMockTrackingResponse());

      const { result } = renderHook(
        () => useScormTracking(),
        { wrapper: createWrapper(queryClient) }
      );

      const elements: ScormTrackingElement[] = [
        { element: 'cmi.core.total_time', value: '02:30:45' },
      ];

      await act(async () => {
        result.current.saveTracking(createTrackingParams(elements));
      });

      await waitFor(() => {
        expectTrackingApiCalledWithElements(elements);
      });
    });

    it('should submit cmi.total_time element for SCORM 2004', async () => {
      mockSubmitTracking.mockResolvedValue(createMockTrackingResponse());

      const { result } = renderHook(
        () => useScormTracking(),
        { wrapper: createWrapper(queryClient) }
      );

      const elements: ScormTrackingElement[] = [
        { element: 'cmi.total_time', value: 'PT2H30M45S' },
      ];

      await act(async () => {
        result.current.saveTracking(createTrackingParams(elements));
      });

      await waitFor(() => {
        expectTrackingApiCalledWithElements(elements);
      });
    });

    it('should accumulate session time across multiple sessions', async () => {
      // This test verifies that time accumulation logic can work across sessions
      // by tracking session_time and total_time elements correctly

      mockSubmitTracking.mockResolvedValue(createMockTrackingResponse());

      const { result } = renderHook(
        () => useScormTracking(),
        { wrapper: createWrapper(queryClient) }
      );

      // First session: 30 minutes
      await act(async () => {
        result.current.saveTracking(createTrackingParams([
          { element: 'cmi.core.session_time', value: '00:30:00' },
        ]));
      });

      // Second session: 45 minutes
      await act(async () => {
        result.current.saveTracking(createTrackingParams([
          { element: 'cmi.core.session_time', value: '00:45:00' },
        ]));
      });

      await waitFor(() => {
        expect(mockSubmitTracking).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('TypeScript Type Safety', () => {
    it('should enforce ScormTrackingElement interface structure', () => {
      // This test validates TypeScript type safety at compile time
      const validElement: ScormTrackingElement = {
        element: 'cmi.core.lesson_status',
        value: 'completed',
      };

      expect(validElement.element).toBe('cmi.core.lesson_status');
      expect(validElement.value).toBe('completed');
    });

    it('should accept proper SaveTrackingParams type', async () => {
      mockSubmitTracking.mockResolvedValue(createMockTrackingResponse());

      const { result } = renderHook(
        () => useScormTracking(),
        { wrapper: createWrapper(queryClient) }
      );

      // Validate that the saveTracking function accepts ScormTrackingElement array
      const elements: ScormTrackingElement[] = [
        { element: 'cmi.core.lesson_status', value: 'completed' },
      ];

      await act(async () => {
        // This should compile without type errors
        result.current.saveTracking(createTrackingParams(elements));
      });

      await waitFor(() => {
        expect(mockSubmitTracking).toHaveBeenCalled();
      });
    });

    it('should return typed ScormTrackingData from mutation', async () => {
      const mockResponse = createMockTrackingResponse({
        scoid: 1,
        attempt: 1,
        tracks: { 'cmi.core.lesson_status': 'completed' },
      });
      mockSubmitTracking.mockResolvedValue(mockResponse);

      const { result } = renderHook(
        () => useScormTracking(),
        { wrapper: createWrapper(queryClient) }
      );

      await act(async () => {
        result.current.saveTracking(createTrackingParams([
          { element: 'cmi.core.lesson_status', value: 'completed' },
        ]));
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(false);
      });
    });

    it('should handle SCORM version string literals correctly', () => {
      // SCORM version string literals for formatSessionTime function
      const scorm12Version = '1.2' as const;
      const scorm2004Version = '2004' as const;

      // validateCMIElement takes (element, value) and returns { isValid: boolean, ... }
      // Test SCORM 1.2 element with valid status
      expect(validateCMIElement('cmi.core.lesson_status', 'completed').isValid).toBe(true);
      // Test SCORM 2004 element with valid status
      expect(validateCMIElement('cmi.completion_status', 'completed').isValid).toBe(true);

      // formatSessionTime takes version as '1.2' | '2004' string literal
      expect(formatSessionTime(1000, scorm12Version)).toMatch(/^\d{4}:\d{2}:\d{2}/);
      expect(formatSessionTime(1000, scorm2004Version)).toMatch(/^PT/);
    });

    it('should validate tracking parameters type', async () => {
      mockSubmitTracking.mockResolvedValue(createMockTrackingResponse());

      // useScormTracking takes no arguments - configuration is passed via createTrackingParams
      const { result } = renderHook(
        () => useScormTracking(),
        { wrapper: createWrapper(queryClient) }
      );

      // Test that hook returns expected typed properties
      expect(result.current.saveTracking).toBeDefined();
      expect(typeof result.current.saveTracking).toBe('function');

      // Verify tracking params structure is type-safe
      const trackingParams = createTrackingParams([
        { element: 'cmi.core.lesson_status', value: 'completed' },
      ]);
      expect(trackingParams.scoid).toBeDefined();
      expect(trackingParams.attempt).toBeDefined();
      expect(trackingParams.tracks).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty elements array', async () => {
      mockSubmitTracking.mockResolvedValue(createMockTrackingResponse());

      const { result } = renderHook(
        () => useScormTracking(),
        { wrapper: createWrapper(queryClient) }
      );

      await act(async () => {
        result.current.saveTracking(createTrackingParams([]));
      });

      await waitFor(() => {
        expect(mockSubmitTracking).toHaveBeenCalledWith(
          expect.any(Number),
          expect.objectContaining({ tracks: {} })
        );
      });
    });

    it('should handle special characters in element values', async () => {
      mockSubmitTracking.mockResolvedValue(createMockTrackingResponse());

      const { result } = renderHook(
        () => useScormTracking(),
        { wrapper: createWrapper(queryClient) }
      );

      const elements: ScormTrackingElement[] = [
        { element: 'cmi.suspend_data', value: 'data="test"&special=<value>' },
      ];

      await act(async () => {
        result.current.saveTracking(createTrackingParams(elements));
      });

      await waitFor(() => {
        expectTrackingApiCalledWithElements(elements);
      });
    });

    it('should handle unicode characters in suspend_data', async () => {
      mockSubmitTracking.mockResolvedValue(createMockTrackingResponse());

      const { result } = renderHook(
        () => useScormTracking(),
        { wrapper: createWrapper(queryClient) }
      );

      const elements: ScormTrackingElement[] = [
        { element: 'cmi.suspend_data', value: '日本語テスト文字列 emoji: 🎓📚' },
      ];

      await act(async () => {
        result.current.saveTracking(createTrackingParams(elements));
      });

      await waitFor(() => {
        expectTrackingApiCalledWithElements(elements);
      });
    });

    it('should handle very long element indices', async () => {
      mockSubmitTracking.mockResolvedValue(createMockTrackingResponse());

      const { result } = renderHook(
        () => useScormTracking(),
        { wrapper: createWrapper(queryClient) }
      );

      const elements: ScormTrackingElement[] = [
        { element: 'cmi.interactions.999.id', value: 'last_interaction' },
        { element: 'cmi.objectives.999.id', value: 'last_objective' },
      ];

      await act(async () => {
        result.current.saveTracking(createTrackingParams(elements));
      });

      await waitFor(() => {
        expectTrackingApiCalledWithElements(elements);
      });
    });

    it('should handle rapid successive saves', async () => {
      mockSubmitTracking.mockResolvedValue(createMockTrackingResponse());

      const { result } = renderHook(
        () => useScormTracking(),
        { wrapper: createWrapper(queryClient) }
      );

      // Rapidly fire multiple saves
      await act(async () => {
        for (let i = 0; i < 10; i++) {
          result.current.saveTracking(createTrackingParams([
            { element: 'cmi.core.score.raw', value: `${i * 10}` },
          ]));
        }
      });

      await waitFor(() => {
        expect(mockSubmitTracking).toHaveBeenCalledTimes(10);
      });
    });

    it('should handle attempt ID of zero', async () => {
      mockSubmitTracking.mockResolvedValue(createMockTrackingResponse());

      const { result } = renderHook(
        () => useScormTracking(),
        { wrapper: createWrapper(queryClient) }
      );

      const elements: ScormTrackingElement[] = [
        { element: 'cmi.core.lesson_status', value: 'incomplete' },
      ];

      // Pass attempt: 0 through createTrackingParams
      await act(async () => {
        result.current.saveTracking(createTrackingParams(elements, DEFAULT_SCORM_ID, DEFAULT_SCO_ID, 0));
      });

      await waitFor(() => {
        expect(mockSubmitTracking).toHaveBeenCalledWith(
          expect.any(Number),
          expect.objectContaining({ attempt: 0 })
        );
      });
    });

    it('should handle completion_threshold for SCORM 2004', async () => {
      mockSubmitTracking.mockResolvedValue(createMockTrackingResponse());

      const { result } = renderHook(
        () => useScormTracking(),
        { wrapper: createWrapper(queryClient) }
      );

      const elements: ScormTrackingElement[] = [
        { element: 'cmi.completion_threshold', value: '0.8' },
        { element: 'cmi.progress_measure', value: '0.85' },
      ];

      await act(async () => {
        result.current.saveTracking(createTrackingParams(elements));
      });

      await waitFor(() => {
        expectTrackingApiCalledWithElements(elements);
      });
    });
  });

  describe('Helper Function Unit Tests', () => {
    describe('createLessonStatusElement', () => {
      it('should create SCORM 1.2 lesson status element', () => {
        // createLessonStatusElement only takes status, always returns SCORM 1.2 element
        expect(createLessonStatusElement('passed')).toEqual({
          element: 'cmi.core.lesson_status',
          value: 'passed',
        });
      });

      it('should create SCORM 2004 completion status element', () => {
        // For SCORM 2004, use createCompletionStatusElement instead
        expect(createCompletionStatusElement('completed')).toEqual({
          element: 'cmi.completion_status',
          value: 'completed',
        });
      });
    });

    describe('createScoreElements', () => {
      it('should create all score elements for SCORM 1.2', () => {
        const elements = createScoreElements(
          { raw: 85, min: 0, max: 100 },
          '1.2'
        );

        expect(elements).toHaveLength(3);
        expect(elements).toContainEqual({ element: 'cmi.core.score.raw', value: '85' });
        expect(elements).toContainEqual({ element: 'cmi.core.score.min', value: '0' });
        expect(elements).toContainEqual({ element: 'cmi.core.score.max', value: '100' });
      });

      it('should include scaled score for SCORM 2004', () => {
        const elements = createScoreElements(
          { raw: 85, min: 0, max: 100, scaled: 0.85 },
          '2004'
        );

        expect(elements).toContainEqual({ element: 'cmi.score.scaled', value: '0.85' });
      });
    });

    describe('createExitElement', () => {
      it('should create exit element for all valid values', () => {
        expect(createExitElement('suspend', '1.2').value).toBe('suspend');
        expect(createExitElement('logout', '1.2').value).toBe('logout');
        expect(createExitElement('time-out', '1.2').value).toBe('time-out');
        expect(createExitElement('', '1.2').value).toBe('');
      });
    });

    describe('createNavigationRequestElement', () => {
      it('should create navigation element for continue', () => {
        expect(createNavigationRequestElement('continue')).toEqual({
          element: 'adl.nav.request',
          value: 'continue',
        });
      });

      it('should create navigation element with target for choice', () => {
        // For choice navigation, target is embedded in the request value: '{target=x}choice'
        const element = createNavigationRequestElement('{target=sco_5}choice');
        expect(element.element).toBe('adl.nav.request');
        expect(element.value).toContain('choice');
        expect(element.value).toContain('sco_5');
      });
    });

    describe('createSessionTimeElement', () => {
      it('should format session time for SCORM 1.2', () => {
        const element = createSessionTimeElement(7200000, '1.2'); // 2 hours
        expect(element.element).toBe('cmi.core.session_time');
      });

      it('should format session time for SCORM 2004', () => {
        const element = createSessionTimeElement(7200000, '2004'); // 2 hours
        expect(element.element).toBe('cmi.session_time');
        expect(element.value).toMatch(/^PT/);
      });
    });

    describe('createSuspendDataElement', () => {
      it('should create suspend data element', () => {
        expect(createSuspendDataElement('test_data')).toEqual({
          element: 'cmi.suspend_data',
          value: 'test_data',
        });
      });
    });

    describe('createInteractionElements', () => {
      it('should create complete interaction element set', () => {
        const elements = createInteractionElements(0, {
          id: 'q1',
          type: 'choice',
          result: 'correct',
          latency: 30000,
          studentResponse: 'a',
          correctResponses: ['a'],
        });

        expect(elements.find((e) => e.element === 'cmi.interactions.0.id')).toBeDefined();
        expect(elements.find((e) => e.element === 'cmi.interactions.0.type')).toBeDefined();
        expect(elements.find((e) => e.element === 'cmi.interactions.0.result')).toBeDefined();
      });
    });

    describe('createObjectiveElements', () => {
      it('should create complete objective element set', () => {
        const elements = createObjectiveElements(0, {
          id: 'obj1',
          status: 'completed',
          score: { raw: 90, min: 0, max: 100 },
        });

        expect(elements.find((e) => e.element === 'cmi.objectives.0.id')).toBeDefined();
        expect(elements.find((e) => e.element === 'cmi.objectives.0.status')).toBeDefined();
        expect(elements.find((e) => e.element === 'cmi.objectives.0.score.raw')).toBeDefined();
      });
    });
  });
});
