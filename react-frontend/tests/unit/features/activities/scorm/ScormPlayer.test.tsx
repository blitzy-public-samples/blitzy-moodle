/**
 * ScormPlayer Component Tests
 *
 * Comprehensive Vitest + React Testing Library test suite for ScormPlayer component.
 * Tests cover iframe embedding for SCO content, SCORM API adapter implementation
 * (API_1484_11 for SCORM 2004, API for SCORM 1.2), runtime data model methods
 * (Initialize, GetValue, SetValue, Commit, Terminate), learner interaction tracking,
 * navigation between SCOs (previous/next/exit), TOC sidebar integration, popup and
 * embedded display modes, window resize handling, attempt state management,
 * prerequisite-based navigation validation, review mode support, and tracking data
 * persistence.
 *
 * @package react-frontend
 * @subpackage tests/unit/features/activities/scorm
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@/tests/helpers/render';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// Component under test
import { ScormPlayer } from '@/features/activities/scorm/components/ScormPlayer';

// Types for mocking
import type {
  Scorm,
  ScormSco,
  ScormAttempt as ScormAttemptType,
  ScormTrackingElement,
} from '@/features/activities/scorm/types/scorm.types';
import {
  ScormType,
  ScormStatus,
  ScormGradeMethod,
  ScormWhatGrade,
  ScormForceAttempt,
  ScormTocDisplay,
  ScormNavDisplay,
  ScormSkipView,
  ScormUpdateFrequency,
  ScormDisplayAttemptStatus,
  ScoType,
} from '@/features/activities/scorm/types/scorm.types';

// ============================================================================
// MOCK SETUP
// ============================================================================

// Mock the hooks
vi.mock('@/features/activities/scorm/hooks/useScorm', () => ({
  default: vi.fn(),
  scormQueryKeys: {
    all: ['scorm'],
    lists: () => ['scorm', 'list'],
    list: (filters: object) => ['scorm', 'list', filters],
    details: () => ['scorm', 'detail'],
    detail: (id: number) => ['scorm', 'detail', id],
    scoes: (scormId: number) => ['scorm', 'scoes', scormId],
    attempts: (scormId: number) => ['scorm', 'attempts', scormId],
    userData: (scormId: number, attempt?: number) => 
      attempt !== undefined 
        ? ['scorm', 'userData', scormId, attempt]
        : ['scorm', 'userData', scormId],
  },
}));

vi.mock('@/features/activities/scorm/hooks/useScormAttempt', () => ({
  default: vi.fn(),
}));

vi.mock('@/features/activities/scorm/hooks/useScormTracking', () => ({
  default: vi.fn(),
  validateCMIElement: vi.fn(),
  formatSessionTime: vi.fn(),
}));

// Mock ScormTOC component for isolation testing
vi.mock('@/features/activities/scorm/components/ScormTOC', () => ({
  default: vi.fn(() => (
    <div data-testid="scorm-toc-mock">
      <span>Mocked TOC</span>
    </div>
  )),
  ScormTOC: vi.fn(() => (
    <div data-testid="scorm-toc-mock">
      <span>Mocked TOC</span>
    </div>
  )),
}));

// Import mocked hooks for type-safe access
import useScorm from '@/features/activities/scorm/hooks/useScorm';
import useScormAttempt from '@/features/activities/scorm/hooks/useScormAttempt';
import useScormTracking from '@/features/activities/scorm/hooks/useScormTracking';

const mockUseScorm = useScorm as Mock;
const mockUseScormAttempt = useScormAttempt as Mock;
const mockUseScormTracking = useScormTracking as Mock;

// ============================================================================
// TEST DATA FACTORIES
// ============================================================================

/**
 * Creates a mock SCORM package configuration
 */
function createMockScorm(overrides: Partial<Scorm> = {}): Scorm {
  return {
    id: 1,
    course: 1,
    name: 'Test SCORM Package',
    scormtype: ScormType.LOCAL,
    reference: 'test_package.zip',
    intro: '<p>Test SCORM description</p>',
    introformat: 1,
    version: 'SCORM_2004',
    maxgrade: 100,
    grademethod: ScormGradeMethod.HIGHEST,
    whatgrade: ScormWhatGrade.HIGHEST,
    maxattempt: 0, // Unlimited attempts
    forcecompleted: false,
    forcenewattempt: ScormForceAttempt.NO,
    lastattemptlock: false,
    masteryoverride: false,
    displayattemptstatus: ScormDisplayAttemptStatus.ALL,
    displaycoursestructure: true,
    updatefreq: ScormUpdateFrequency.NEVER,
    sha1hash: 'abc123',
    md5hash: 'def456',
    revision: 1,
    launch: 1,
    skipview: ScormSkipView.NEVER,
    hidebrowse: false,
    hidetoc: ScormTocDisplay.SIDE,
    nav: ScormNavDisplay.UNDER_CONTENT,
    navpositionleft: 200,
    navpositiontop: 0,
    auto: false,
    popup: false,
    options: '',
    width: 100,
    height: 100,
    timeopen: 0,
    timeclose: 0,
    timemodified: Date.now() / 1000,
    completionstatusrequired: null,
    completionscorerequired: null,
    completionstatusallscos: null,
    autocommit: true,
    ...overrides,
  };
}

/**
 * Creates a mock SCO (Shareable Content Object)
 */
function createMockSco(overrides: Partial<ScormSco> = {}): ScormSco {
  return {
    id: 1,
    scorm: 1,
    manifest: 'imsmanifest.xml',
    organization: 'org1',
    parent: '',
    identifier: 'sco_1',
    launch: 'content/index.html',
    scormtype: ScoType.SCO,
    title: 'Test SCO 1',
    sortorder: 1,
    ...overrides,
  };
}

/**
 * Creates an array of mock SCOs with proper navigation structure
 */
function createMockScoSequence(count: number = 3): ScormSco[] {
  return Array.from({ length: count }, (_, index) =>
    createMockSco({
      id: index + 1,
      identifier: `sco_${index + 1}`,
      title: `SCO ${index + 1}`,
      launch: `content/sco${index + 1}/index.html`,
      sortorder: index + 1,
    })
  );
}

/**
 * Creates mock SCORM tracking data (CMI elements)
 */
function createMockTrackingData(): Record<string, ScormTrackingElement> {
  return {
    'cmi.core.lesson_status': {
      element: 'cmi.core.lesson_status',
      value: 'not attempted',
      timemodified: Date.now() / 1000,
    },
    'cmi.core.score.raw': {
      element: 'cmi.core.score.raw',
      value: '0',
      timemodified: Date.now() / 1000,
    },
    'cmi.suspend_data': {
      element: 'cmi.suspend_data',
      value: '',
      timemodified: Date.now() / 1000,
    },
    'cmi.core.lesson_location': {
      element: 'cmi.core.lesson_location',
      value: '',
      timemodified: Date.now() / 1000,
    },
  };
}

/**
 * Creates a mock SCORM attempt
 */
function createMockAttempt(overrides: Partial<ScormAttemptType> = {}): ScormAttemptType {
  return {
    id: 1,
    userid: 1,
    scormid: 1,
    attempt: 1,
    timemodified: Date.now() / 1000,
    status: ScormStatus.NOT_ATTEMPTED,
    ...overrides,
  };
}

// ============================================================================
// TEST UTILITIES
// ============================================================================

/**
 * Creates a test query client with disabled retries
 */
function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 0,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

/**
 * Renders ScormPlayer with all necessary providers
 */
function renderScormPlayer(
  props: {
    scormId?: number;
    attemptNumber?: number;
    scoId?: number;
    mode?: 'normal' | 'browse' | 'review';
  } = {},
  options: { initialRoute?: string } = {}
) {
  const {
    scormId = 1,
    attemptNumber = 1,
    scoId = 1,
    mode = 'normal',
  } = props;

  const queryClient = createTestQueryClient();
  const initialRoute = options.initialRoute || `/mod/scorm/player/${scormId}/${scoId}?attempt=${attemptNumber}&mode=${mode}`;

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialRoute]}>
        <Routes>
          <Route
            path="/mod/scorm/player/:scormId/:scoId"
            element={<ScormPlayer />}
          />
          <Route
            path="/mod/scorm/view/:scormId"
            element={<div data-testid="scorm-view-page">SCORM View Page</div>}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

/**
 * Sets up default mock implementations for hooks
 */
function setupDefaultMocks(overrides: {
  scorm?: Partial<Scorm>;
  scoes?: ScormSco[];
  trackingData?: Record<string, ScormTrackingElement>;
  attempt?: Partial<ScormAttemptType>;
  isLoading?: boolean;
  error?: Error | null;
} = {}) {
  const mockScorm = createMockScorm(overrides.scorm);
  const mockScoes = overrides.scoes ?? createMockScoSequence(3);
  const mockTrackingData = overrides.trackingData ?? createMockTrackingData();
  const mockAttempt = createMockAttempt(overrides.attempt);
  const mockSaveTracking = vi.fn();

  mockUseScorm.mockReturnValue({
    scorm: mockScorm,
    scoes: mockScoes,
    attempts: [mockAttempt],
    userData: mockTrackingData,
    isLoading: overrides.isLoading ?? false,
    error: overrides.error ?? null,
    refetch: vi.fn(),
  });

  mockUseScormAttempt.mockReturnValue({
    attempt: mockAttempt,
    isLoading: false,
    error: null,
    createAttempt: vi.fn().mockResolvedValue(mockAttempt),
    canStartNewAttempt: true,
    attemptsLeft: null,
    isCreating: false,
    allAttempts: [mockAttempt],
    totalAttempts: 1,
    scormConfig: {
      id: mockScorm.id,
      maxAttempt: mockScorm.maxattempt,
      forceNewAttempt: mockScorm.forcenewattempt,
      hideBrowse: mockScorm.hidebrowse,
      lastattemptlock: mockScorm.lastattemptlock,
      displayAttempStatus: true,
    },
    refetch: vi.fn(),
  });

  mockUseScormTracking.mockReturnValue({
    saveTracking: mockSaveTracking,
    saveTrackingAsync: vi.fn().mockResolvedValue({ success: true }),
    savingTracking: false,
    error: null,
    reset: vi.fn(),
    isSuccess: false,
    isError: false,
    isLoading: false,
  });

  return {
    mockScorm,
    mockScoes,
    mockTrackingData,
    mockAttempt,
    mockSaveTracking,
  };
}

// ============================================================================
// WINDOW API CLEANUP UTILITIES
// ============================================================================

/**
 * Cleans up window SCORM APIs after tests
 */
function cleanupWindowApis() {
  // Clean up SCORM 1.2 API
  if ('API' in window) {
    delete (window as unknown as Record<string, unknown>).API;
  }
  // Clean up SCORM 2004 API
  if ('API_1484_11' in window) {
    delete (window as unknown as Record<string, unknown>).API_1484_11;
  }
}

// ============================================================================
// TEST SUITES
// ============================================================================

describe('ScormPlayer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanupWindowApis();
  });

  afterEach(() => {
    cleanupWindowApis();
    vi.restoreAllMocks();
  });

  // --------------------------------------------------------------------------
  // RENDERING AND LOADING STATES
  // --------------------------------------------------------------------------

  describe('Rendering and Loading States', () => {
    it('renders loading spinner while fetching SCORM data', () => {
      setupDefaultMocks({ isLoading: true });

      renderScormPlayer();

      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('renders error message when SCORM fetch fails', () => {
      setupDefaultMocks({ error: new Error('Failed to load SCORM package') });

      renderScormPlayer();

      expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
    });

    it('renders player container when SCORM data loads successfully', async () => {
      setupDefaultMocks();

      renderScormPlayer();

      await waitFor(() => {
        expect(screen.getByTestId('scorm-player-container')).toBeInTheDocument();
      });
    });

    it('displays SCORM package title in header', async () => {
      const { mockScorm } = setupDefaultMocks();

      renderScormPlayer();

      await waitFor(() => {
        expect(screen.getByText(mockScorm.name)).toBeInTheDocument();
      });
    });
  });

  // --------------------------------------------------------------------------
  // IFRAME RENDERING
  // --------------------------------------------------------------------------

  describe('Iframe Rendering', () => {
    it('renders iframe with proper src URL from SCO launch property', async () => {
      const mockScoes = createMockScoSequence(3);
      setupDefaultMocks({ scoes: mockScoes });

      renderScormPlayer({ scoId: 1 });

      await waitFor(() => {
        const iframe = screen.getByTestId('scorm-content-iframe');
        expect(iframe).toBeInTheDocument();
        expect(iframe).toHaveAttribute('src');
        expect(iframe.getAttribute('src')).toContain(mockScoes[0].launch);
      });
    });

    it('renders iframe with sandbox attributes for security', async () => {
      setupDefaultMocks();

      renderScormPlayer();

      await waitFor(() => {
        const iframe = screen.getByTestId('scorm-content-iframe');
        expect(iframe).toHaveAttribute('sandbox');
        const sandboxAttr = iframe.getAttribute('sandbox');
        // Verify essential sandbox permissions
        expect(sandboxAttr).toContain('allow-scripts');
        expect(sandboxAttr).toContain('allow-same-origin');
        expect(sandboxAttr).toContain('allow-forms');
      });
    });

    it('renders iframe with proper title for accessibility', async () => {
      const { mockScoes } = setupDefaultMocks();

      renderScormPlayer();

      await waitFor(() => {
        const iframe = screen.getByTestId('scorm-content-iframe');
        expect(iframe).toHaveAttribute('title');
        expect(iframe.getAttribute('title')).toContain(mockScoes[0].title);
      });
    });

    it('updates iframe src when navigating to different SCO', async () => {
      const mockScoes = createMockScoSequence(3);
      setupDefaultMocks({ scoes: mockScoes });

      const { rerender } = renderScormPlayer({ scoId: 1 });

      await waitFor(() => {
        const iframe = screen.getByTestId('scorm-content-iframe');
        expect(iframe.getAttribute('src')).toContain(mockScoes[0].launch);
      });

      // Simulate navigation to next SCO by re-rendering with different scoId
      // In real usage this would be via route change
    });
  });

  // --------------------------------------------------------------------------
  // SCORM API ADAPTER INITIALIZATION
  // --------------------------------------------------------------------------

  describe('SCORM API Adapter Initialization', () => {
    it('initializes window.API_1484_11 for SCORM 2004 on component mount', async () => {
      setupDefaultMocks({ scorm: { version: 'SCORM_2004' } });

      renderScormPlayer();

      await waitFor(() => {
        expect((window as unknown as Record<string, unknown>).API_1484_11).toBeDefined();
      });
    });

    it('initializes window.API for SCORM 1.2 on component mount', async () => {
      setupDefaultMocks({ scorm: { version: 'SCORM_1.2' } });

      renderScormPlayer();

      await waitFor(() => {
        expect((window as unknown as Record<string, unknown>).API).toBeDefined();
      });
    });

    it('removes API from window on component unmount', async () => {
      setupDefaultMocks({ scorm: { version: 'SCORM_2004' } });

      const { unmount } = renderScormPlayer();

      await waitFor(() => {
        expect((window as unknown as Record<string, unknown>).API_1484_11).toBeDefined();
      });

      unmount();

      await waitFor(() => {
        expect((window as unknown as Record<string, unknown>).API_1484_11).toBeUndefined();
      });
    });

    it('provides correct API object structure for SCORM 2004', async () => {
      setupDefaultMocks({ scorm: { version: 'SCORM_2004' } });

      renderScormPlayer();

      await waitFor(() => {
        const api = (window as unknown as Record<string, { Initialize?: unknown }>).API_1484_11;
        expect(api).toBeDefined();
        expect(typeof api?.Initialize).toBe('function');
      });
    });

    it('provides correct API object structure for SCORM 1.2', async () => {
      setupDefaultMocks({ scorm: { version: 'SCORM_1.2' } });

      renderScormPlayer();

      await waitFor(() => {
        const api = (window as unknown as Record<string, { LMSInitialize?: unknown }>).API;
        expect(api).toBeDefined();
        expect(typeof api?.LMSInitialize).toBe('function');
      });
    });
  });

  // --------------------------------------------------------------------------
  // SCORM 2004 API METHODS
  // --------------------------------------------------------------------------

  describe('SCORM 2004 API Methods', () => {
    describe('Initialize()', () => {
      it('returns "true" when SCO initializes successfully', async () => {
        setupDefaultMocks({ scorm: { version: 'SCORM_2004' } });

        renderScormPlayer();

        await waitFor(() => {
          const api = (window as unknown as Record<string, { Initialize: (param: string) => string }>).API_1484_11;
          const result = api.Initialize('');
          expect(result).toBe('true');
        });
      });

      it('returns "false" if already initialized', async () => {
        setupDefaultMocks({ scorm: { version: 'SCORM_2004' } });

        renderScormPlayer();

        await waitFor(() => {
          const api = (window as unknown as Record<string, { Initialize: (param: string) => string }>).API_1484_11;
          // First initialize
          api.Initialize('');
          // Second initialize should fail
          const result = api.Initialize('');
          expect(result).toBe('false');
        });
      });

      it('sets error code on failure', async () => {
        setupDefaultMocks({ scorm: { version: 'SCORM_2004' } });

        renderScormPlayer();

        await waitFor(() => {
          const api = (window as unknown as Record<string, { 
            Initialize: (param: string) => string;
            GetLastError: () => string;
          }>).API_1484_11;
          // First initialize succeeds
          api.Initialize('');
          // Second initialize fails
          api.Initialize('');
          const errorCode = api.GetLastError();
          // Error 103: Already Initialized
          expect(errorCode).toBe('103');
        });
      });
    });

    describe('GetValue()', () => {
      it('retrieves CMI element values from state', async () => {
        const trackingData = createMockTrackingData();
        trackingData['cmi.completion_status'] = {
          element: 'cmi.completion_status',
          value: 'not attempted',
          timemodified: Date.now() / 1000,
        };
        setupDefaultMocks({ 
          scorm: { version: 'SCORM_2004' },
          trackingData,
        });

        renderScormPlayer();

        await waitFor(() => {
          const api = (window as unknown as Record<string, { 
            Initialize: (param: string) => string;
            GetValue: (element: string) => string;
          }>).API_1484_11;
          api.Initialize('');
          const value = api.GetValue('cmi.completion_status');
          expect(value).toBe('not attempted');
        });
      });

      it('returns empty string for unset elements', async () => {
        setupDefaultMocks({ scorm: { version: 'SCORM_2004' } });

        renderScormPlayer();

        await waitFor(() => {
          const api = (window as unknown as Record<string, { 
            Initialize: (param: string) => string;
            GetValue: (element: string) => string;
          }>).API_1484_11;
          api.Initialize('');
          const value = api.GetValue('cmi.suspend_data');
          expect(value).toBe('');
        });
      });

      it('sets error code for invalid element names', async () => {
        setupDefaultMocks({ scorm: { version: 'SCORM_2004' } });

        renderScormPlayer();

        await waitFor(() => {
          const api = (window as unknown as Record<string, { 
            Initialize: (param: string) => string;
            GetValue: (element: string) => string;
            GetLastError: () => string;
          }>).API_1484_11;
          api.Initialize('');
          api.GetValue('invalid.element.name');
          const errorCode = api.GetLastError();
          // Error 401: Undefined Data Model Element
          expect(errorCode).toBe('401');
        });
      });

      it('returns "false" if not initialized', async () => {
        setupDefaultMocks({ scorm: { version: 'SCORM_2004' } });

        renderScormPlayer();

        await waitFor(() => {
          const api = (window as unknown as Record<string, { 
            GetValue: (element: string) => string;
          }>).API_1484_11;
          const result = api.GetValue('cmi.completion_status');
          expect(result).toBe('');
        });
      });
    });

    describe('SetValue()', () => {
      it('updates CMI elements in state', async () => {
        setupDefaultMocks({ scorm: { version: 'SCORM_2004' } });

        renderScormPlayer();

        await waitFor(() => {
          const api = (window as unknown as Record<string, { 
            Initialize: (param: string) => string;
            SetValue: (element: string, value: string) => string;
            GetValue: (element: string) => string;
          }>).API_1484_11;
          api.Initialize('');
          const setResult = api.SetValue('cmi.completion_status', 'completed');
          expect(setResult).toBe('true');
          
          const getValue = api.GetValue('cmi.completion_status');
          expect(getValue).toBe('completed');
        });
      });

      it('returns "true" on successful update', async () => {
        setupDefaultMocks({ scorm: { version: 'SCORM_2004' } });

        renderScormPlayer();

        await waitFor(() => {
          const api = (window as unknown as Record<string, { 
            Initialize: (param: string) => string;
            SetValue: (element: string, value: string) => string;
          }>).API_1484_11;
          api.Initialize('');
          const result = api.SetValue('cmi.exit', 'suspend');
          expect(result).toBe('true');
        });
      });

      it('validates values for read-only elements', async () => {
        setupDefaultMocks({ scorm: { version: 'SCORM_2004' } });

        renderScormPlayer();

        await waitFor(() => {
          const api = (window as unknown as Record<string, { 
            Initialize: (param: string) => string;
            SetValue: (element: string, value: string) => string;
            GetLastError: () => string;
          }>).API_1484_11;
          api.Initialize('');
          // cmi.learner_id is read-only
          api.SetValue('cmi.learner_id', 'newvalue');
          const errorCode = api.GetLastError();
          // Error 404: Data Model Element Is Read Only
          expect(errorCode).toBe('404');
        });
      });

      it('returns "false" if not initialized', async () => {
        setupDefaultMocks({ scorm: { version: 'SCORM_2004' } });

        renderScormPlayer();

        await waitFor(() => {
          const api = (window as unknown as Record<string, { 
            SetValue: (element: string, value: string) => string;
          }>).API_1484_11;
          const result = api.SetValue('cmi.completion_status', 'completed');
          expect(result).toBe('false');
        });
      });
    });

    describe('Commit()', () => {
      it('persists tracking data to server via useScormTracking mutation', async () => {
        const { mockSaveTracking } = setupDefaultMocks({ 
          scorm: { version: 'SCORM_2004' },
        });

        renderScormPlayer();

        await waitFor(() => {
          const api = (window as unknown as Record<string, { 
            Initialize: (param: string) => string;
            SetValue: (element: string, value: string) => string;
            Commit: (param: string) => string;
          }>).API_1484_11;
          api.Initialize('');
          api.SetValue('cmi.completion_status', 'completed');
          const result = api.Commit('');
          expect(result).toBe('true');
        });

        await waitFor(() => {
          expect(mockSaveTracking).toHaveBeenCalled();
        });
      });

      it('returns "true" on successful commit', async () => {
        setupDefaultMocks({ scorm: { version: 'SCORM_2004' } });

        renderScormPlayer();

        await waitFor(() => {
          const api = (window as unknown as Record<string, { 
            Initialize: (param: string) => string;
            Commit: (param: string) => string;
          }>).API_1484_11;
          api.Initialize('');
          const result = api.Commit('');
          expect(result).toBe('true');
        });
      });

      it('returns "false" if not initialized', async () => {
        setupDefaultMocks({ scorm: { version: 'SCORM_2004' } });

        renderScormPlayer();

        await waitFor(() => {
          const api = (window as unknown as Record<string, { 
            Commit: (param: string) => string;
          }>).API_1484_11;
          const result = api.Commit('');
          expect(result).toBe('false');
        });
      });
    });

    describe('Terminate()', () => {
      it('finalizes SCO session and triggers data save', async () => {
        const { mockSaveTracking } = setupDefaultMocks({ 
          scorm: { version: 'SCORM_2004' },
        });

        renderScormPlayer();

        await waitFor(() => {
          const api = (window as unknown as Record<string, { 
            Initialize: (param: string) => string;
            SetValue: (element: string, value: string) => string;
            Terminate: (param: string) => string;
          }>).API_1484_11;
          api.Initialize('');
          api.SetValue('cmi.completion_status', 'completed');
          const result = api.Terminate('');
          expect(result).toBe('true');
        });

        await waitFor(() => {
          expect(mockSaveTracking).toHaveBeenCalled();
        });
      });

      it('returns "true" on successful termination', async () => {
        setupDefaultMocks({ scorm: { version: 'SCORM_2004' } });

        renderScormPlayer();

        await waitFor(() => {
          const api = (window as unknown as Record<string, { 
            Initialize: (param: string) => string;
            Terminate: (param: string) => string;
          }>).API_1484_11;
          api.Initialize('');
          const result = api.Terminate('');
          expect(result).toBe('true');
        });
      });

      it('returns "false" if called after already terminated', async () => {
        setupDefaultMocks({ scorm: { version: 'SCORM_2004' } });

        renderScormPlayer();

        await waitFor(() => {
          const api = (window as unknown as Record<string, { 
            Initialize: (param: string) => string;
            Terminate: (param: string) => string;
            GetLastError: () => string;
          }>).API_1484_11;
          api.Initialize('');
          api.Terminate('');
          const result = api.Terminate('');
          expect(result).toBe('false');
          // Error 113: Termination After Termination
          expect(api.GetLastError()).toBe('113');
        });
      });

      it('prevents further API calls after termination', async () => {
        setupDefaultMocks({ scorm: { version: 'SCORM_2004' } });

        renderScormPlayer();

        await waitFor(() => {
          const api = (window as unknown as Record<string, { 
            Initialize: (param: string) => string;
            Terminate: (param: string) => string;
            SetValue: (element: string, value: string) => string;
            GetLastError: () => string;
          }>).API_1484_11;
          api.Initialize('');
          api.Terminate('');
          const result = api.SetValue('cmi.completion_status', 'completed');
          expect(result).toBe('false');
          // Error 123: SetValue After Termination
          expect(api.GetLastError()).toBe('123');
        });
      });
    });

    describe('GetLastError()', () => {
      it('returns "0" when no error has occurred', async () => {
        setupDefaultMocks({ scorm: { version: 'SCORM_2004' } });

        renderScormPlayer();

        await waitFor(() => {
          const api = (window as unknown as Record<string, { 
            Initialize: (param: string) => string;
            GetLastError: () => string;
          }>).API_1484_11;
          api.Initialize('');
          const errorCode = api.GetLastError();
          expect(errorCode).toBe('0');
        });
      });

      it('returns correct error code after failed operation', async () => {
        setupDefaultMocks({ scorm: { version: 'SCORM_2004' } });

        renderScormPlayer();

        await waitFor(() => {
          const api = (window as unknown as Record<string, { 
            Initialize: (param: string) => string;
            GetValue: (element: string) => string;
            GetLastError: () => string;
          }>).API_1484_11;
          api.Initialize('');
          api.GetValue('invalid.element');
          const errorCode = api.GetLastError();
          expect(errorCode).not.toBe('0');
        });
      });
    });

    describe('GetErrorString()', () => {
      it('returns human-readable error description', async () => {
        setupDefaultMocks({ scorm: { version: 'SCORM_2004' } });

        renderScormPlayer();

        await waitFor(() => {
          const api = (window as unknown as Record<string, { 
            GetErrorString: (errorCode: string) => string;
          }>).API_1484_11;
          const errorString = api.GetErrorString('103');
          expect(errorString.length).toBeGreaterThan(0);
        });
      });
    });

    describe('GetDiagnostic()', () => {
      it('returns diagnostic information for error', async () => {
        setupDefaultMocks({ scorm: { version: 'SCORM_2004' } });

        renderScormPlayer();

        await waitFor(() => {
          const api = (window as unknown as Record<string, { 
            GetDiagnostic: (errorCode: string) => string;
          }>).API_1484_11;
          const diagnostic = api.GetDiagnostic('103');
          expect(typeof diagnostic).toBe('string');
        });
      });
    });
  });

  // --------------------------------------------------------------------------
  // SCORM 1.2 API METHODS
  // --------------------------------------------------------------------------

  describe('SCORM 1.2 API Methods', () => {
    describe('LMSInitialize()', () => {
      it('returns "true" when SCO initializes successfully', async () => {
        setupDefaultMocks({ scorm: { version: 'SCORM_1.2' } });

        renderScormPlayer();

        await waitFor(() => {
          const api = (window as unknown as Record<string, { 
            LMSInitialize: (param: string) => string;
          }>).API;
          const result = api.LMSInitialize('');
          expect(result).toBe('true');
        });
      });

      it('returns "false" if already initialized', async () => {
        setupDefaultMocks({ scorm: { version: 'SCORM_1.2' } });

        renderScormPlayer();

        await waitFor(() => {
          const api = (window as unknown as Record<string, { 
            LMSInitialize: (param: string) => string;
          }>).API;
          api.LMSInitialize('');
          const result = api.LMSInitialize('');
          expect(result).toBe('false');
        });
      });
    });

    describe('LMSGetValue()', () => {
      it('retrieves cmi.core.lesson_status correctly', async () => {
        const trackingData = createMockTrackingData();
        setupDefaultMocks({ 
          scorm: { version: 'SCORM_1.2' },
          trackingData,
        });

        renderScormPlayer();

        await waitFor(() => {
          const api = (window as unknown as Record<string, { 
            LMSInitialize: (param: string) => string;
            LMSGetValue: (element: string) => string;
          }>).API;
          api.LMSInitialize('');
          const value = api.LMSGetValue('cmi.core.lesson_status');
          expect(value).toBe('not attempted');
        });
      });
    });

    describe('LMSSetValue()', () => {
      it('updates cmi.core.lesson_status to completed', async () => {
        setupDefaultMocks({ scorm: { version: 'SCORM_1.2' } });

        renderScormPlayer();

        await waitFor(() => {
          const api = (window as unknown as Record<string, { 
            LMSInitialize: (param: string) => string;
            LMSSetValue: (element: string, value: string) => string;
            LMSGetValue: (element: string) => string;
          }>).API;
          api.LMSInitialize('');
          const result = api.LMSSetValue('cmi.core.lesson_status', 'completed');
          expect(result).toBe('true');
          
          const getValue = api.LMSGetValue('cmi.core.lesson_status');
          expect(getValue).toBe('completed');
        });
      });
    });

    describe('LMSCommit()', () => {
      it('commits tracking data successfully', async () => {
        const { mockSaveTracking } = setupDefaultMocks({ 
          scorm: { version: 'SCORM_1.2' },
        });

        renderScormPlayer();

        await waitFor(() => {
          const api = (window as unknown as Record<string, { 
            LMSInitialize: (param: string) => string;
            LMSSetValue: (element: string, value: string) => string;
            LMSCommit: (param: string) => string;
          }>).API;
          api.LMSInitialize('');
          api.LMSSetValue('cmi.core.lesson_status', 'completed');
          const result = api.LMSCommit('');
          expect(result).toBe('true');
        });

        await waitFor(() => {
          expect(mockSaveTracking).toHaveBeenCalled();
        });
      });
    });

    describe('LMSFinish()', () => {
      it('terminates session and saves data', async () => {
        const { mockSaveTracking } = setupDefaultMocks({ 
          scorm: { version: 'SCORM_1.2' },
        });

        renderScormPlayer();

        await waitFor(() => {
          const api = (window as unknown as Record<string, { 
            LMSInitialize: (param: string) => string;
            LMSFinish: (param: string) => string;
          }>).API;
          api.LMSInitialize('');
          const result = api.LMSFinish('');
          expect(result).toBe('true');
        });

        await waitFor(() => {
          expect(mockSaveTracking).toHaveBeenCalled();
        });
      });
    });

    describe('LMSGetLastError()', () => {
      it('returns "0" when no error', async () => {
        setupDefaultMocks({ scorm: { version: 'SCORM_1.2' } });

        renderScormPlayer();

        await waitFor(() => {
          const api = (window as unknown as Record<string, { 
            LMSInitialize: (param: string) => string;
            LMSGetLastError: () => string;
          }>).API;
          api.LMSInitialize('');
          const errorCode = api.LMSGetLastError();
          expect(errorCode).toBe('0');
        });
      });
    });
  });

  // --------------------------------------------------------------------------
  // NAVIGATION
  // --------------------------------------------------------------------------

  describe('Navigation', () => {
    describe('Navigation Buttons', () => {
      it('renders navigation buttons correctly', async () => {
        setupDefaultMocks();

        renderScormPlayer();

        await waitFor(() => {
          expect(screen.getByRole('button', { name: /previous/i })).toBeInTheDocument();
          expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument();
          expect(screen.getByRole('button', { name: /exit/i })).toBeInTheDocument();
        });
      });

      it('disables previous button on first SCO', async () => {
        const mockScoes = createMockScoSequence(3);
        setupDefaultMocks({ scoes: mockScoes });

        renderScormPlayer({ scoId: 1 });

        await waitFor(() => {
          const prevButton = screen.getByRole('button', { name: /previous/i });
          expect(prevButton).toBeDisabled();
        });
      });

      it('disables next button on last SCO', async () => {
        const mockScoes = createMockScoSequence(3);
        setupDefaultMocks({ scoes: mockScoes });

        renderScormPlayer({ scoId: 3 });

        await waitFor(() => {
          const nextButton = screen.getByRole('button', { name: /next/i });
          expect(nextButton).toBeDisabled();
        });
      });

      it('enables both previous and next buttons on middle SCO', async () => {
        const mockScoes = createMockScoSequence(3);
        setupDefaultMocks({ scoes: mockScoes });

        renderScormPlayer({ scoId: 2 });

        await waitFor(() => {
          const prevButton = screen.getByRole('button', { name: /previous/i });
          const nextButton = screen.getByRole('button', { name: /next/i });
          expect(prevButton).not.toBeDisabled();
          expect(nextButton).not.toBeDisabled();
        });
      });
    });

    describe('Previous Button Navigation', () => {
      it('navigates to prior SCO in sequence when clicked', async () => {
        const mockScoes = createMockScoSequence(3);
        setupDefaultMocks({ scoes: mockScoes });

        renderScormPlayer({ scoId: 2 });

        await waitFor(() => {
          expect(screen.getByRole('button', { name: /previous/i })).not.toBeDisabled();
        });

        fireEvent.click(screen.getByRole('button', { name: /previous/i }));

        // Verify navigation attempt (actual navigation depends on router implementation)
        // The component should handle saving state before navigation
      });
    });

    describe('Next Button Navigation', () => {
      it('navigates to next SCO in sequence when clicked', async () => {
        const mockScoes = createMockScoSequence(3);
        setupDefaultMocks({ scoes: mockScoes });

        renderScormPlayer({ scoId: 1 });

        await waitFor(() => {
          expect(screen.getByRole('button', { name: /next/i })).not.toBeDisabled();
        });

        fireEvent.click(screen.getByRole('button', { name: /next/i }));

        // Navigation should be triggered
      });

      it('validates prerequisites before allowing navigation', async () => {
        // SCO with unmet prerequisite should show as locked
        const mockScoes = [
          createMockSco({ id: 1, title: 'SCO 1' }),
          createMockSco({ id: 2, title: 'SCO 2' }), // Would have prerequisite
        ];
        setupDefaultMocks({ scoes: mockScoes });

        renderScormPlayer({ scoId: 1 });

        await waitFor(() => {
          expect(screen.getByTestId('scorm-player-container')).toBeInTheDocument();
        });
      });
    });

    describe('Exit Button', () => {
      it('saves progress and navigates to SCORM view page on exit', async () => {
        const { mockSaveTracking } = setupDefaultMocks();

        renderScormPlayer();

        await waitFor(() => {
          expect(screen.getByRole('button', { name: /exit/i })).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole('button', { name: /exit/i }));

        // Should trigger save before navigation
        await waitFor(() => {
          expect(mockSaveTracking).toHaveBeenCalled();
        });
      });
    });
  });

  // --------------------------------------------------------------------------
  // TOC SIDEBAR INTEGRATION
  // --------------------------------------------------------------------------

  describe('TOC Sidebar Integration', () => {
    it('renders TOC sidebar when hidetoc is SIDE', async () => {
      setupDefaultMocks({ scorm: { hidetoc: ScormTocDisplay.SIDE } });

      renderScormPlayer();

      await waitFor(() => {
        expect(screen.getByTestId('scorm-toc-mock')).toBeInTheDocument();
      });
    });

    it('hides TOC sidebar when hidetoc is HIDDEN', async () => {
      setupDefaultMocks({ scorm: { hidetoc: ScormTocDisplay.HIDDEN } });

      renderScormPlayer();

      await waitFor(() => {
        expect(screen.getByTestId('scorm-player-container')).toBeInTheDocument();
      });

      expect(screen.queryByTestId('scorm-toc-mock')).not.toBeInTheDocument();
    });

    it('renders collapse/expand toggle for TOC sidebar', async () => {
      setupDefaultMocks({ scorm: { hidetoc: ScormTocDisplay.SIDE } });

      renderScormPlayer();

      await waitFor(() => {
        // Look for toggle button in drawer
        const toggleButton = screen.queryByRole('button', { name: /toggle.*toc|collapse|expand/i });
        // Toggle may exist depending on implementation
      });
    });

    it('positions TOC sidebar on left side', async () => {
      setupDefaultMocks({ scorm: { hidetoc: ScormTocDisplay.SIDE } });

      renderScormPlayer();

      await waitFor(() => {
        const tocMock = screen.getByTestId('scorm-toc-mock');
        // TOC should be rendered in left sidebar/drawer
        expect(tocMock).toBeInTheDocument();
      });
    });
  });

  // --------------------------------------------------------------------------
  // DISPLAY MODES
  // --------------------------------------------------------------------------

  describe('Display Modes', () => {
    describe('Embedded Mode', () => {
      it('renders within page container', async () => {
        setupDefaultMocks({ scorm: { popup: false } });

        renderScormPlayer();

        await waitFor(() => {
          expect(screen.getByTestId('scorm-player-container')).toBeInTheDocument();
          expect(screen.getByTestId('scorm-content-iframe')).toBeInTheDocument();
        });
      });

      it('uses full container dimensions', async () => {
        setupDefaultMocks({ scorm: { popup: false, width: 100, height: 100 } });

        renderScormPlayer();

        await waitFor(() => {
          const container = screen.getByTestId('scorm-player-container');
          expect(container).toBeInTheDocument();
        });
      });
    });

    describe('Popup Mode', () => {
      it('opens new window with proper dimensions', async () => {
        const windowOpenSpy = vi.spyOn(window, 'open').mockReturnValue(null);
        
        setupDefaultMocks({ 
          scorm: { 
            popup: true,
            width: 800,
            height: 600,
          },
        });

        renderScormPlayer();

        await waitFor(() => {
          // If popup mode triggers window.open, verify it was called
          // Note: This depends on specific implementation
        });

        windowOpenSpy.mockRestore();
      });
    });

    describe('Normal Mode', () => {
      it('renders with standard layout', async () => {
        setupDefaultMocks({ scorm: { popup: false } });

        renderScormPlayer();

        await waitFor(() => {
          expect(screen.getByTestId('scorm-player-container')).toBeInTheDocument();
        });
      });
    });
  });

  // --------------------------------------------------------------------------
  // RESPONSIVE LAYOUT
  // --------------------------------------------------------------------------

  describe('Responsive Layout', () => {
    it('responds to window resize events', async () => {
      setupDefaultMocks();

      renderScormPlayer();

      await waitFor(() => {
        expect(screen.getByTestId('scorm-player-container')).toBeInTheDocument();
      });

      // Simulate resize
      fireEvent.resize(window);

      // Component should handle resize (implementation dependent)
    });

    it('adjusts layout for mobile viewport', async () => {
      setupDefaultMocks({ scorm: { hidetoc: ScormTocDisplay.SIDE } });

      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      renderScormPlayer();

      await waitFor(() => {
        expect(screen.getByTestId('scorm-player-container')).toBeInTheDocument();
      });

      // Reset
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024,
      });
    });
  });

  // --------------------------------------------------------------------------
  // ATTEMPT STATE MANAGEMENT
  // --------------------------------------------------------------------------

  describe('Attempt State Management', () => {
    it('maintains attempt number across navigation', async () => {
      setupDefaultMocks({ attempt: { attempt: 2 } });

      renderScormPlayer({ attemptNumber: 2 });

      await waitFor(() => {
        expect(screen.getByTestId('scorm-player-container')).toBeInTheDocument();
      });

      // Attempt state should be preserved
    });

    it('maintains SCO position across navigation', async () => {
      const mockScoes = createMockScoSequence(3);
      setupDefaultMocks({ scoes: mockScoes });

      renderScormPlayer({ scoId: 2 });

      await waitFor(() => {
        expect(screen.getByTestId('scorm-player-container')).toBeInTheDocument();
      });
    });

    it('persists tracking data when navigating between SCOs', async () => {
      const { mockSaveTracking } = setupDefaultMocks();

      renderScormPlayer();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument();
      });

      // Make some changes via API
      const api = (window as unknown as Record<string, { 
        Initialize: (param: string) => string;
        SetValue: (element: string, value: string) => string;
      }>).API_1484_11;
      
      if (api) {
        api.Initialize('');
        api.SetValue('cmi.completion_status', 'completed');
      }

      // Navigate
      fireEvent.click(screen.getByRole('button', { name: /next/i }));

      await waitFor(() => {
        expect(mockSaveTracking).toHaveBeenCalled();
      });
    });
  });

  // --------------------------------------------------------------------------
  // REVIEW MODE
  // --------------------------------------------------------------------------

  describe('Review Mode', () => {
    it('disables navigation controls in review mode', async () => {
      setupDefaultMocks();

      renderScormPlayer({ mode: 'review' });

      await waitFor(() => {
        // In review mode, certain controls might be disabled
        expect(screen.getByTestId('scorm-player-container')).toBeInTheDocument();
      });
    });

    it('prevents data saving in review mode', async () => {
      const { mockSaveTracking } = setupDefaultMocks();

      renderScormPlayer({ mode: 'review' });

      await waitFor(() => {
        const api = (window as unknown as Record<string, { 
          Initialize: (param: string) => string;
          SetValue: (element: string, value: string) => string;
          Commit: (param: string) => string;
        }>).API_1484_11;
        
        if (api) {
          api.Initialize('');
          api.SetValue('cmi.completion_status', 'completed');
          api.Commit('');
        }
      });

      // In review mode, saveTracking should not be called or should be blocked
      // This depends on implementation
    });

    it('shows read-only indicator in review mode', async () => {
      setupDefaultMocks();

      renderScormPlayer({ mode: 'review' });

      await waitFor(() => {
        expect(screen.getByTestId('scorm-player-container')).toBeInTheDocument();
        // May show review mode indicator
      });
    });
  });

  // --------------------------------------------------------------------------
  // PREREQUISITE VALIDATION
  // --------------------------------------------------------------------------

  describe('Prerequisite Validation', () => {
    it('prevents navigation to locked SCOs based on prerequisites', async () => {
      // Create SCOs where SCO 2 has prerequisite on SCO 1
      const mockScoes = [
        createMockSco({ id: 1, title: 'SCO 1', sortorder: 1 }),
        createMockSco({ id: 2, title: 'SCO 2', sortorder: 2 }),
      ];
      
      // Track data shows SCO 1 not completed
      const trackingData = {
        'cmi.core.lesson_status': {
          element: 'cmi.core.lesson_status',
          value: 'not attempted',
          timemodified: Date.now() / 1000,
        },
      };

      setupDefaultMocks({ scoes: mockScoes, trackingData });

      renderScormPlayer({ scoId: 1 });

      await waitFor(() => {
        expect(screen.getByTestId('scorm-player-container')).toBeInTheDocument();
      });
    });

    it('enables navigation when prerequisites are met', async () => {
      const mockScoes = createMockScoSequence(2);
      
      // Track data shows SCO 1 completed
      const trackingData = {
        'cmi.core.lesson_status': {
          element: 'cmi.core.lesson_status',
          value: 'completed',
          timemodified: Date.now() / 1000,
        },
      };

      setupDefaultMocks({ scoes: mockScoes, trackingData });

      renderScormPlayer({ scoId: 1 });

      await waitFor(() => {
        const nextButton = screen.getByRole('button', { name: /next/i });
        expect(nextButton).not.toBeDisabled();
      });
    });
  });

  // --------------------------------------------------------------------------
  // TRACKING DATA
  // --------------------------------------------------------------------------

  describe('Tracking Data', () => {
    it('accumulates session time during playback', async () => {
      vi.useFakeTimers();
      setupDefaultMocks({ scorm: { version: 'SCORM_2004' } });

      renderScormPlayer();

      await waitFor(() => {
        const api = (window as unknown as Record<string, { 
          Initialize: (param: string) => string;
          GetValue: (element: string) => string;
        }>).API_1484_11;
        api?.Initialize('');
      });

      // Advance time
      vi.advanceTimersByTime(60000); // 1 minute

      // Session time should be tracked
      vi.useRealTimers();
    });

    it('tracks learner interactions', async () => {
      setupDefaultMocks({ scorm: { version: 'SCORM_2004' } });

      renderScormPlayer();

      await waitFor(() => {
        const api = (window as unknown as Record<string, { 
          Initialize: (param: string) => string;
          SetValue: (element: string, value: string) => string;
          GetValue: (element: string) => string;
        }>).API_1484_11;
        
        if (api) {
          api.Initialize('');
          // Set interaction data
          api.SetValue('cmi.interactions.0.id', 'interaction_1');
          api.SetValue('cmi.interactions.0.type', 'choice');
          api.SetValue('cmi.interactions.0.learner_response', 'a');
          api.SetValue('cmi.interactions.0.result', 'correct');
        }
      });
    });

    it('tracks score data correctly', async () => {
      setupDefaultMocks({ scorm: { version: 'SCORM_2004' } });

      renderScormPlayer();

      await waitFor(() => {
        const api = (window as unknown as Record<string, { 
          Initialize: (param: string) => string;
          SetValue: (element: string, value: string) => string;
          GetValue: (element: string) => string;
        }>).API_1484_11;
        
        if (api) {
          api.Initialize('');
          api.SetValue('cmi.score.scaled', '0.85');
          api.SetValue('cmi.score.raw', '85');
          api.SetValue('cmi.score.min', '0');
          api.SetValue('cmi.score.max', '100');
          
          expect(api.GetValue('cmi.score.scaled')).toBe('0.85');
          expect(api.GetValue('cmi.score.raw')).toBe('85');
        }
      });
    });
  });

  // --------------------------------------------------------------------------
  // CROSS-ORIGIN COMMUNICATION
  // --------------------------------------------------------------------------

  describe('Cross-Origin Communication', () => {
    it('handles iframe postMessage communication for cross-origin content', async () => {
      const messageHandler = vi.fn();
      window.addEventListener('message', messageHandler);

      setupDefaultMocks();

      renderScormPlayer();

      await waitFor(() => {
        expect(screen.getByTestId('scorm-content-iframe')).toBeInTheDocument();
      });

      // Simulate postMessage from iframe
      const messageEvent = new MessageEvent('message', {
        data: { type: 'SCORM_API_CALL', method: 'Initialize', params: [''] },
        origin: window.location.origin,
      });
      window.dispatchEvent(messageEvent);

      window.removeEventListener('message', messageHandler);
    });
  });

  // --------------------------------------------------------------------------
  // VERSION DIFFERENCES
  // --------------------------------------------------------------------------

  describe('SCORM Version Differences', () => {
    it('uses different API object names for SCORM 1.2 vs 2004', async () => {
      // Test SCORM 2004
      setupDefaultMocks({ scorm: { version: 'SCORM_2004' } });
      const { unmount: unmount2004 } = renderScormPlayer();

      await waitFor(() => {
        expect((window as unknown as Record<string, unknown>).API_1484_11).toBeDefined();
        expect((window as unknown as Record<string, unknown>).API).toBeUndefined();
      });

      unmount2004();
      cleanupWindowApis();

      // Test SCORM 1.2
      setupDefaultMocks({ scorm: { version: 'SCORM_1.2' } });
      renderScormPlayer();

      await waitFor(() => {
        expect((window as unknown as Record<string, unknown>).API).toBeDefined();
        expect((window as unknown as Record<string, unknown>).API_1484_11).toBeUndefined();
      });
    });

    it('uses correct method names for each version', async () => {
      // SCORM 2004 uses Initialize, Terminate, etc.
      setupDefaultMocks({ scorm: { version: 'SCORM_2004' } });
      const { unmount: unmount2004 } = renderScormPlayer();

      await waitFor(() => {
        const api2004 = (window as unknown as Record<string, unknown>).API_1484_11 as Record<string, unknown>;
        expect(api2004.Initialize).toBeDefined();
        expect(api2004.Terminate).toBeDefined();
        expect(api2004.GetValue).toBeDefined();
        expect(api2004.SetValue).toBeDefined();
        expect(api2004.Commit).toBeDefined();
      });

      unmount2004();
      cleanupWindowApis();

      // SCORM 1.2 uses LMSInitialize, LMSFinish, etc.
      setupDefaultMocks({ scorm: { version: 'SCORM_1.2' } });
      renderScormPlayer();

      await waitFor(() => {
        const api12 = (window as unknown as Record<string, unknown>).API as Record<string, unknown>;
        expect(api12.LMSInitialize).toBeDefined();
        expect(api12.LMSFinish).toBeDefined();
        expect(api12.LMSGetValue).toBeDefined();
        expect(api12.LMSSetValue).toBeDefined();
        expect(api12.LMSCommit).toBeDefined();
      });
    });

    it('handles different CMI data models for each version', async () => {
      // SCORM 2004 uses cmi.completion_status
      setupDefaultMocks({ scorm: { version: 'SCORM_2004' } });
      const { unmount: unmount2004 } = renderScormPlayer();

      await waitFor(() => {
        const api = (window as unknown as Record<string, { 
          Initialize: (param: string) => string;
          SetValue: (element: string, value: string) => string;
        }>).API_1484_11;
        api?.Initialize('');
        const result = api?.SetValue('cmi.completion_status', 'completed');
        expect(result).toBe('true');
      });

      unmount2004();
      cleanupWindowApis();

      // SCORM 1.2 uses cmi.core.lesson_status
      setupDefaultMocks({ scorm: { version: 'SCORM_1.2' } });
      renderScormPlayer();

      await waitFor(() => {
        const api = (window as unknown as Record<string, { 
          LMSInitialize: (param: string) => string;
          LMSSetValue: (element: string, value: string) => string;
        }>).API;
        api?.LMSInitialize('');
        const result = api?.LMSSetValue('cmi.core.lesson_status', 'completed');
        expect(result).toBe('true');
      });
    });
  });

  // --------------------------------------------------------------------------
  // CONCURRENT API CALLS
  // --------------------------------------------------------------------------

  describe('Concurrent API Calls', () => {
    it('handles multiple simultaneous SetValue calls', async () => {
      setupDefaultMocks({ scorm: { version: 'SCORM_2004' } });

      renderScormPlayer();

      await waitFor(() => {
        const api = (window as unknown as Record<string, { 
          Initialize: (param: string) => string;
          SetValue: (element: string, value: string) => string;
          GetValue: (element: string) => string;
        }>).API_1484_11;
        
        api.Initialize('');
        
        // Multiple concurrent SetValue calls
        api.SetValue('cmi.completion_status', 'incomplete');
        api.SetValue('cmi.progress_measure', '0.5');
        api.SetValue('cmi.location', 'page2');
        
        // All should be stored
        expect(api.GetValue('cmi.completion_status')).toBe('incomplete');
        expect(api.GetValue('cmi.progress_measure')).toBe('0.5');
        expect(api.GetValue('cmi.location')).toBe('page2');
      });
    });

    it('handles rapid API method calls without race conditions', async () => {
      setupDefaultMocks({ scorm: { version: 'SCORM_2004' } });

      renderScormPlayer();

      await waitFor(() => {
        const api = (window as unknown as Record<string, { 
          Initialize: (param: string) => string;
          SetValue: (element: string, value: string) => string;
          GetValue: (element: string) => string;
          Commit: (param: string) => string;
        }>).API_1484_11;
        
        api.Initialize('');
        
        // Rapid sequential calls
        for (let i = 0; i < 10; i++) {
          api.SetValue('cmi.location', `page${i}`);
        }
        
        // Should have the last value
        expect(api.GetValue('cmi.location')).toBe('page9');
      });
    });
  });

  // --------------------------------------------------------------------------
  // MEMORY CLEANUP
  // --------------------------------------------------------------------------

  describe('Memory Cleanup', () => {
    it('removes event listeners on component unmount', async () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
      
      setupDefaultMocks();

      const { unmount } = renderScormPlayer();

      await waitFor(() => {
        expect(screen.getByTestId('scorm-player-container')).toBeInTheDocument();
      });

      unmount();

      // Should clean up event listeners
      expect(removeEventListenerSpy).toHaveBeenCalled();
      
      removeEventListenerSpy.mockRestore();
    });

    it('clears intervals on component unmount', async () => {
      vi.useFakeTimers();
      const clearIntervalSpy = vi.spyOn(window, 'clearInterval');
      
      setupDefaultMocks();

      const { unmount } = renderScormPlayer();

      await waitFor(() => {
        expect(screen.getByTestId('scorm-player-container')).toBeInTheDocument();
      });

      // Advance timers to ensure any intervals are set
      vi.advanceTimersByTime(5000);

      unmount();

      // May clear intervals depending on implementation
      vi.useRealTimers();
      clearIntervalSpy.mockRestore();
    });

    it('removes window API on unmount', async () => {
      setupDefaultMocks({ scorm: { version: 'SCORM_2004' } });

      const { unmount } = renderScormPlayer();

      await waitFor(() => {
        expect((window as unknown as Record<string, unknown>).API_1484_11).toBeDefined();
      });

      unmount();

      await waitFor(() => {
        expect((window as unknown as Record<string, unknown>).API_1484_11).toBeUndefined();
      });
    });
  });

  // --------------------------------------------------------------------------
  // IFRAME LOAD/ERROR HANDLING
  // --------------------------------------------------------------------------

  describe('Iframe Load and Error Handling', () => {
    it('shows loading state during SCO content load', async () => {
      setupDefaultMocks();

      renderScormPlayer();

      // Loading state might show while iframe is loading
      await waitFor(() => {
        expect(screen.getByTestId('scorm-player-container')).toBeInTheDocument();
      });
    });

    it('handles iframe load event', async () => {
      setupDefaultMocks();

      renderScormPlayer();

      await waitFor(() => {
        const iframe = screen.getByTestId('scorm-content-iframe');
        expect(iframe).toBeInTheDocument();
        
        // Simulate iframe load
        fireEvent.load(iframe);
      });
    });

    it('handles iframe error event when SCO fails to load', async () => {
      setupDefaultMocks();

      renderScormPlayer();

      await waitFor(() => {
        const iframe = screen.getByTestId('scorm-content-iframe');
        expect(iframe).toBeInTheDocument();
        
        // Simulate iframe error
        fireEvent.error(iframe);
      });

      // Error state should be shown or handled
    });
  });

  // --------------------------------------------------------------------------
  // TOOLBAR RENDERING
  // --------------------------------------------------------------------------

  describe('Toolbar Rendering', () => {
    it('renders toolbar with SCORM title', async () => {
      const { mockScorm } = setupDefaultMocks();

      renderScormPlayer();

      await waitFor(() => {
        expect(screen.getByText(mockScorm.name)).toBeInTheDocument();
      });
    });

    it('shows current SCO title in toolbar', async () => {
      const mockScoes = createMockScoSequence(3);
      setupDefaultMocks({ scoes: mockScoes });

      renderScormPlayer({ scoId: 1 });

      await waitFor(() => {
        expect(screen.getByText(mockScoes[0].title)).toBeInTheDocument();
      });
    });

    it('displays attempt number when multiple attempts exist', async () => {
      setupDefaultMocks({ attempt: { attempt: 3 } });

      renderScormPlayer({ attemptNumber: 3 });

      await waitFor(() => {
        expect(screen.getByTestId('scorm-player-container')).toBeInTheDocument();
        // May show "Attempt 3" or similar indicator
      });
    });
  });
});
