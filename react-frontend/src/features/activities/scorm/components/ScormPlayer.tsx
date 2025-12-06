/**
 * ScormPlayer Component
 *
 * React component providing embedded SCORM content player with iframe for SCO rendering,
 * API communication bridge for SCORM 1.2 and 2004 runtime environments, navigation controls,
 * TOC sidebar integration, window resize handling, and tracking data persistence.
 *
 * Replicates functionality from public/mod/scorm/player.php and public/mod/scorm/loadSCO.php.
 *
 * Features:
 * - Iframe for displaying SCO content loaded from GET /api/v1/scorm/{id}/sco/{scoid} endpoint
 * - JavaScript SCORM API adapter (API_1484_11 for SCORM 2004, API for SCORM 1.2)
 * - SCORM runtime data model methods (Initialize, GetValue, SetValue, Commit, Terminate)
 * - Learner interaction tracking with server persistence via POST /api/v1/scorm/{id}/track
 * - Navigation between SCOs with previous/next/exit buttons
 * - ScormTOC component integration in collapsible sidebar
 * - Support for popup and embedded display modes
 * - Window resize handling for responsive layout
 * - Attempt state and navigation validation based on prerequisites
 * - Normal and review mode support
 *
 * @package    react-frontend
 * @copyright  2024 Moodle React Frontend
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import {
  Box,
  Button,
  Drawer,
  IconButton,
  CircularProgress,
  Toolbar,
  AppBar,
  useTheme,
  useMediaQuery,
  Divider,
  Stack,
  Alert,
  AlertTitle,
} from '@mui/material';
import Typography from '@mui/material/Typography';
import {
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  Menu as MenuIcon,
  SkipPrevious as PreviousIcon,
  SkipNext as NextIcon,
  Fullscreen as FullscreenIcon,
  FullscreenExit as FullscreenExitIcon,
} from '@mui/icons-material';
import ExitToApp from '@mui/icons-material/ExitToApp';
import { useQueryClient } from '@tanstack/react-query';

import ScormTOC from './ScormTOC';
import { useScorm, scormQueryKeys } from '../hooks/useScorm';
import useScormAttempt from '../hooks/useScormAttempt';
import useScormTracking, { formatSessionTime } from '../hooks/useScormTracking';
import type {
  ScormSco,
  ScormTrackingElement,
} from '../types/scorm.types';
import { ScormVersion, ScormNavDisplay, ScormTocDisplay } from '../types/scorm.types';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Default drawer width for TOC sidebar */
const TOC_DRAWER_WIDTH = 300;

/** API Base URL for SCORM endpoints */
const API_BASE_URL = '/api/v1';

/** SCORM 1.2 error codes */
const SCORM_12_ERRORS = {
  NO_ERROR: '0',
  GENERAL_EXCEPTION: '101',
  INVALID_ARGUMENT: '201',
  ELEMENT_CANNOT_HAVE_CHILDREN: '202',
  ELEMENT_NOT_AN_ARRAY: '203',
  NOT_INITIALIZED: '301',
  NOT_IMPLEMENTED: '401',
  INVALID_SET_VALUE: '402',
  ELEMENT_IS_READ_ONLY: '403',
  ELEMENT_IS_WRITE_ONLY: '404',
  INCORRECT_DATA_TYPE: '405',
} as const;

/** SCORM 2004 error codes */
const SCORM_2004_ERRORS = {
  NO_ERROR: '0',
  GENERAL_EXCEPTION: '101',
  GENERAL_INITIALIZATION_FAILURE: '102',
  ALREADY_INITIALIZED: '103',
  CONTENT_INSTANCE_TERMINATED: '104',
  GENERAL_TERMINATION_FAILURE: '111',
  TERMINATION_BEFORE_INITIALIZATION: '112',
  TERMINATION_AFTER_TERMINATION: '113',
  RETRIEVE_DATA_BEFORE_INITIALIZATION: '122',
  RETRIEVE_DATA_AFTER_TERMINATION: '123',
  STORE_DATA_BEFORE_INITIALIZATION: '132',
  STORE_DATA_AFTER_TERMINATION: '133',
  COMMIT_BEFORE_INITIALIZATION: '142',
  COMMIT_AFTER_TERMINATION: '143',
  GENERAL_ARGUMENT_ERROR: '201',
  GENERAL_GET_FAILURE: '301',
  GENERAL_SET_FAILURE: '351',
  GENERAL_COMMIT_FAILURE: '391',
  UNDEFINED_DATA_MODEL: '401',
  UNIMPLEMENTED_DATA_MODEL: '402',
  DATA_MODEL_NOT_INITIALIZED: '403',
  DATA_MODEL_READ_ONLY: '404',
  DATA_MODEL_WRITE_ONLY: '405',
  DATA_MODEL_TYPE_MISMATCH: '406',
  DATA_MODEL_VALUE_OUT_OF_RANGE: '407',
  DATA_MODEL_DEPENDENCY_NOT_ESTABLISHED: '408',
} as const;

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

/**
 * Props for ScormPlayer component
 */
interface ScormPlayerProps {
  /** SCORM activity ID */
  scormId: number;
  /** User ID for tracking attempts */
  userId: number;
  /** Initial SCO ID to load (optional, will use first launchable SCO if not provided) */
  scoId?: number;
  /** Current attempt number */
  attempt?: number;
  /** Player mode: normal for regular interaction, review for reviewing completed attempts */
  mode?: 'normal' | 'review';
  /** Display mode: popup opens in new window, embedded stays in current page */
  displayMode?: 'popup' | 'embedded';
  /** Callback when user exits the player */
  onExit?: () => void;
  /** Callback when SCO changes */
  onScoChange?: (scoId: number) => void;
}

/**
 * SCORM API state for tracking runtime state
 */
interface ScormApiState {
  initialized: boolean;
  terminated: boolean;
  lastError: string;
  diagnosticMessage: string;
}

/**
 * In-memory CMI data store type
 */
type CmiDataStore = Record<string, string>;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get error string for SCORM 1.2 error code
 */
function getScorm12ErrorString(errorCode: string): string {
  const errorMessages: Record<string, string> = {
    '0': 'No Error',
    '101': 'General Exception',
    '201': 'Invalid Argument Error',
    '202': 'Element Cannot Have Children',
    '203': 'Element Not an Array - Cannot Have Count',
    '301': 'Not Initialized',
    '401': 'Not Implemented Error',
    '402': 'Invalid Set Value, Element is a Keyword',
    '403': 'Element is Read Only',
    '404': 'Element is Write Only',
    '405': 'Incorrect Data Type',
  };
  return errorMessages[errorCode] ?? 'Unknown Error';
}

/**
 * Get error string for SCORM 2004 error code
 */
function getScorm2004ErrorString(errorCode: string): string {
  const errorMessages: Record<string, string> = {
    '0': 'No Error',
    '101': 'General Exception',
    '102': 'General Initialization Failure',
    '103': 'Already Initialized',
    '104': 'Content Instance Terminated',
    '111': 'General Termination Failure',
    '112': 'Termination Before Initialization',
    '113': 'Termination After Termination',
    '122': 'Retrieve Data Before Initialization',
    '123': 'Retrieve Data After Termination',
    '132': 'Store Data Before Initialization',
    '133': 'Store Data After Termination',
    '142': 'Commit Before Initialization',
    '143': 'Commit After Termination',
    '201': 'General Argument Error',
    '301': 'General Get Failure',
    '351': 'General Set Failure',
    '391': 'General Commit Failure',
    '401': 'Undefined Data Model Element',
    '402': 'Unimplemented Data Model Element',
    '403': 'Data Model Element Value Not Initialized',
    '404': 'Data Model Element Is Read Only',
    '405': 'Data Model Element Is Write Only',
    '406': 'Data Model Element Type Mismatch',
    '407': 'Data Model Element Value Out Of Range',
    '408': 'Data Model Dependency Not Established',
  };
  return errorMessages[errorCode] ?? 'Unknown Error';
}

/**
 * Find the first launchable SCO from SCO list
 * 
 * SCOs are provided as a flat array sorted by sortorder.
 * A launchable SCO has a non-empty launch URL.
 */
function findFirstLaunchableSco(scoes: ScormSco[]): ScormSco | null {
  // Sort by sortorder and find first with launch URL
  const sorted = [...scoes].sort((a, b) => (a.sortorder ?? 0) - (b.sortorder ?? 0));
  for (const sco of sorted) {
    if (sco.launch) {
      return sco;
    }
  }
  return null;
}

/**
 * Find SCO by ID in a flat SCO list
 */
function findScoById(scoes: ScormSco[], scoId: number): ScormSco | null {
  return scoes.find(sco => sco.id === scoId) ?? null;
}

/**
 * Get sorted array of launchable SCOs for navigation
 * 
 * SCOs are already flat; this sorts by sortorder and filters to launchable items.
 */
function getSortedLaunchableScoes(scoes: ScormSco[]): ScormSco[] {
  return [...scoes]
    .filter(sco => sco.launch)
    .sort((a, b) => (a.sortorder ?? 0) - (b.sortorder ?? 0));
}

/**
 * Build the SCO launch URL
 */
function buildScoUrl(scormId: number, scoId: number, attempt: number): string {
  return `${API_BASE_URL}/scorm/${scormId}/sco/${scoId}?attempt=${attempt}`;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * ScormPlayer Component
 *
 * Provides embedded SCORM content player with complete SCORM 1.2 and 2004 runtime support.
 */
function ScormPlayer({
  scormId,
  userId,
  scoId: initialScoId,
  attempt: initialAttempt,
  mode = 'normal',
  displayMode = 'embedded',
  onExit,
  onScoChange,
}: ScormPlayerProps): JSX.Element {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const queryClient = useQueryClient();

  // ========================================================================
  // STATE
  // ========================================================================

  // Current SCO being displayed
  const [currentScoId, setCurrentScoId] = useState<number | null>(initialScoId ?? null);

  // TOC drawer state
  const [isTocOpen, setIsTocOpen] = useState<boolean>(!isMobile);

  // Loading state for iframe content
  const [isIframeLoading, setIsIframeLoading] = useState<boolean>(true);

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Session start time for tracking session_time
  const [sessionStartTime] = useState<number>(() => Date.now());

  // SCORM API state
  const [apiState, setApiState] = useState<ScormApiState>({
    initialized: false,
    terminated: false,
    lastError: '0',
    diagnosticMessage: '',
  });

  // In-memory CMI data store (persisted to server on commit/terminate)
  const [cmiDataStore, setCmiDataStore] = useState<CmiDataStore>({});

  // Error state
  const [playerError, setPlayerError] = useState<string | null>(null);

  // ========================================================================
  // REFS
  // ========================================================================

  // Reference to the iframe element
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Reference to the player container for fullscreen
  const playerContainerRef = useRef<HTMLDivElement>(null);

  // Reference to prevent multiple initializations
  const apiInitializedRef = useRef<boolean>(false);

  // ========================================================================
  // HOOKS - Data fetching
  // ========================================================================

  // Fetch SCORM package data
  const {
    scorm,
    scoes,
    userData: _userData,
    isLoading: isScormLoading,
    error: scormError,
  } = useScorm(scormId);

  // Manage SCORM attempts
  const {
    attempt,
    isLoading: isAttemptLoading,
    error: attemptError,
    // createAttempt and canStartNewAttempt available for future "New Attempt" UI
    createAttempt: _createAttempt,
    canStartNewAttempt: _canStartNewAttempt,
  } = useScormAttempt(scormId, userId);

  // Tracking data submission
  // saveTracking (non-async) and savingTracking (loading state) available but not used
  const { saveTrackingAsync } = useScormTracking();

  // Current attempt number (from hook or prop)
  const currentAttempt = attempt?.attemptNumber ?? initialAttempt ?? 1;

  // ========================================================================
  // DERIVED STATE
  // ========================================================================

  // Get sorted launchable SCOs for navigation
  const flatScoes = useMemo(() => {
    if (!scoes) {return [];}
    return getSortedLaunchableScoes(scoes);
  }, [scoes]);

  // Current SCO object
  const currentSco = useMemo(() => {
    if (!scoes || currentScoId === null) {return null;}
    return findScoById(scoes, currentScoId);
  }, [scoes, currentScoId]);

  // Navigation state
  const navigationState = useMemo(() => {
    if (!flatScoes.length || currentScoId === null) {
      return { hasPrevious: false, hasNext: false, currentIndex: -1 };
    }

    const currentIndex = flatScoes.findIndex((sco) => sco.id === currentScoId);
    return {
      hasPrevious: currentIndex > 0,
      hasNext: currentIndex < flatScoes.length - 1,
      currentIndex,
    };
  }, [flatScoes, currentScoId]);

  // Determine SCORM version for display and API selection
  // scorm.version is a string like "SCORM_1.2", "SCORM_2004", "scorm_13", etc.
  // Both SCORM 1.2 and 2004 APIs are registered on window; SCO content determines which to use
  const scormVersionEnum = useMemo(() => {
    if (!scorm) {return ScormVersion.SCORM_12;}
    const versionStr = scorm.version.toLowerCase();
    // SCORM 2004 (also known as SCORM 1.3 internally in Moodle)
    if (versionStr.includes('2004') || versionStr === 'scorm_13' || versionStr.includes('1.3')) {
      return ScormVersion.SCORM_2004;
    }
    // AICC
    if (versionStr.includes('aicc')) {
      return ScormVersion.SCORM_AICC;
    }
    // Default to SCORM 1.2
    return ScormVersion.SCORM_12;
  }, [scorm]);

  // Human-readable SCORM version string for display
  const scormVersionDisplay = useMemo(() => {
    switch (scormVersionEnum) {
      case ScormVersion.SCORM_2004:
        return 'SCORM 2004';
      case ScormVersion.SCORM_AICC:
        return 'AICC';
      default:
        return 'SCORM 1.2';
    }
  }, [scormVersionEnum]);

  // Whether navigation controls should be shown
  const showNavigation = useMemo(() => {
    if (!scorm) {return true;}
    return scorm.nav !== ScormNavDisplay.DISABLED;
  }, [scorm]);

  // Whether TOC should be available
  const showToc = useMemo(() => {
    if (!scorm) {return true;}
    return scorm.hidetoc !== ScormTocDisplay.DISABLED;
  }, [scorm]);

  // Build iframe source URL
  const iframeSrc = useMemo(() => {
    if (currentScoId === null) {return '';}
    return buildScoUrl(scormId, currentScoId, currentAttempt);
  }, [scormId, currentScoId, currentAttempt]);

  // ========================================================================
  // SCORM API IMPLEMENTATION
  // ========================================================================

  /**
   * Save tracking data to server
   */
  const commitTrackingData = useCallback(async () => {
    if (currentScoId === null || Object.keys(cmiDataStore).length === 0) {
      return true;
    }

    try {
      const tracks: ScormTrackingElement[] = Object.entries(cmiDataStore).map(
        ([element, value]) => ({ element, value })
      );

      await saveTrackingAsync({
        scormId,
        scoid: currentScoId,
        attempt: currentAttempt,
        tracks,
      });

      return true;
    } catch (error) {
      console.error('Failed to commit tracking data:', error);
      return false;
    }
  }, [cmiDataStore, currentScoId, currentAttempt, scormId, saveTrackingAsync]);

  /**
   * SCORM 1.2 API Implementation
   */
  const createScorm12Api = useCallback(() => {
    return {
      LMSInitialize: (_param: string): string => {
        if (apiState.initialized) {
          setApiState((prev) => ({
            ...prev,
            lastError: SCORM_12_ERRORS.GENERAL_EXCEPTION,
            diagnosticMessage: 'Already initialized',
          }));
          return 'false';
        }

        setApiState((prev) => ({
          ...prev,
          initialized: true,
          terminated: false,
          lastError: SCORM_12_ERRORS.NO_ERROR,
          diagnosticMessage: '',
        }));

        // Initialize default CMI values for SCORM 1.2
        // Note: userData contains attempt metadata, not CMI tracking data.
        // CMI data would need to be fetched separately from the tracking API.
        // For now, initialize with defaults; saved values will be retrieved via LMSGetValue.
        setCmiDataStore((prev) => ({
          ...prev,
          'cmi.core.lesson_status': prev['cmi.core.lesson_status'] ?? 'not attempted',
          'cmi.core.entry': prev['cmi.core.entry'] ?? 'ab-initio',
          'cmi.core.lesson_location': prev['cmi.core.lesson_location'] ?? '',
          'cmi.suspend_data': prev['cmi.suspend_data'] ?? '',
          'cmi.core.student_id': String(userId ?? ''),
          'cmi.core.student_name': prev['cmi.core.student_name'] ?? '',
        }));

        return 'true';
      },

      LMSFinish: (_param: string): string => {
        if (!apiState.initialized) {
          setApiState((prev) => ({
            ...prev,
            lastError: SCORM_12_ERRORS.NOT_INITIALIZED,
            diagnosticMessage: 'Not initialized',
          }));
          return 'false';
        }

        if (apiState.terminated) {
          setApiState((prev) => ({
            ...prev,
            lastError: SCORM_12_ERRORS.GENERAL_EXCEPTION,
            diagnosticMessage: 'Already terminated',
          }));
          return 'false';
        }

        // Calculate and save session time
        const sessionTime = Date.now() - sessionStartTime;
        const formattedTime = formatSessionTime(sessionTime, '1.2');
        setCmiDataStore((prev) => ({
          ...prev,
          'cmi.core.session_time': formattedTime,
        }));

        // Commit data before termination
        void commitTrackingData();

        setApiState((prev) => ({
          ...prev,
          initialized: false,
          terminated: true,
          lastError: SCORM_12_ERRORS.NO_ERROR,
          diagnosticMessage: '',
        }));

        return 'true';
      },

      LMSGetValue: (element: string): string => {
        if (!apiState.initialized) {
          setApiState((prev) => ({
            ...prev,
            lastError: SCORM_12_ERRORS.NOT_INITIALIZED,
            diagnosticMessage: 'Not initialized',
          }));
          return '';
        }

        setApiState((prev) => ({
          ...prev,
          lastError: SCORM_12_ERRORS.NO_ERROR,
          diagnosticMessage: '',
        }));

        // Get value from local CMI data store
        // Note: Server tracking data would need separate API call and integration
        const value = cmiDataStore[element] ?? '';
        return String(value);
      },

      LMSSetValue: (element: string, value: string): string => {
        if (!apiState.initialized) {
          setApiState((prev) => ({
            ...prev,
            lastError: SCORM_12_ERRORS.NOT_INITIALIZED,
            diagnosticMessage: 'Not initialized',
          }));
          return 'false';
        }

        // Check for read-only elements
        const readOnlyElements = [
          'cmi.core.student_id',
          'cmi.core.student_name',
          'cmi.core.credit',
          'cmi.core.entry',
          'cmi.core.total_time',
          'cmi.launch_data',
          'cmi.comments_from_lms',
          'cmi.core._children',
          'cmi.core.score._children',
          'cmi.objectives._children',
          'cmi.objectives._count',
          'cmi.student_data._children',
          'cmi.student_preference._children',
          'cmi.interactions._children',
          'cmi.interactions._count',
        ];

        if (readOnlyElements.includes(element)) {
          setApiState((prev) => ({
            ...prev,
            lastError: SCORM_12_ERRORS.ELEMENT_IS_READ_ONLY,
            diagnosticMessage: `${element} is read-only`,
          }));
          return 'false';
        }

        // Store the value
        setCmiDataStore((prev) => ({
          ...prev,
          [element]: value,
        }));

        setApiState((prev) => ({
          ...prev,
          lastError: SCORM_12_ERRORS.NO_ERROR,
          diagnosticMessage: '',
        }));

        return 'true';
      },

      LMSCommit: (_param: string): string => {
        if (!apiState.initialized) {
          setApiState((prev) => ({
            ...prev,
            lastError: SCORM_12_ERRORS.NOT_INITIALIZED,
            diagnosticMessage: 'Not initialized',
          }));
          return 'false';
        }

        void commitTrackingData();

        setApiState((prev) => ({
          ...prev,
          lastError: SCORM_12_ERRORS.NO_ERROR,
          diagnosticMessage: '',
        }));

        return 'true';
      },

      LMSGetLastError: (): string => {
        return apiState.lastError;
      },

      LMSGetErrorString: (errorCode: string): string => {
        return getScorm12ErrorString(errorCode);
      },

      LMSGetDiagnostic: (_errorCode: string): string => {
        return apiState.diagnosticMessage;
      },
    };
  }, [apiState, sessionStartTime, commitTrackingData, cmiDataStore, userId]);

  /**
   * SCORM 2004 API Implementation
   */
  const createScorm2004Api = useCallback(() => {
    return {
      Initialize: (_param: string): string => {
        if (apiState.initialized) {
          setApiState((prev) => ({
            ...prev,
            lastError: SCORM_2004_ERRORS.ALREADY_INITIALIZED,
            diagnosticMessage: 'Already initialized',
          }));
          return 'false';
        }

        if (apiState.terminated) {
          setApiState((prev) => ({
            ...prev,
            lastError: SCORM_2004_ERRORS.CONTENT_INSTANCE_TERMINATED,
            diagnosticMessage: 'Content instance terminated',
          }));
          return 'false';
        }

        setApiState((prev) => ({
          ...prev,
          initialized: true,
          terminated: false,
          lastError: SCORM_2004_ERRORS.NO_ERROR,
          diagnosticMessage: '',
        }));

        // Initialize default CMI values for SCORM 2004
        // Note: userData contains attempt metadata, not CMI tracking data.
        // CMI data would need to be fetched separately from the tracking API.
        setCmiDataStore((prev) => ({
          ...prev,
          'cmi.completion_status': prev['cmi.completion_status'] ?? 'unknown',
          'cmi.success_status': prev['cmi.success_status'] ?? 'unknown',
          'cmi.entry': prev['cmi.entry'] ?? 'ab-initio',
          'cmi.location': prev['cmi.location'] ?? '',
          'cmi.suspend_data': prev['cmi.suspend_data'] ?? '',
          'cmi.learner_id': String(userId ?? ''),
          'cmi.learner_name': prev['cmi.learner_name'] ?? '',
        }));

        return 'true';
      },

      Terminate: (_param: string): string => {
        if (!apiState.initialized) {
          setApiState((prev) => ({
            ...prev,
            lastError: SCORM_2004_ERRORS.TERMINATION_BEFORE_INITIALIZATION,
            diagnosticMessage: 'Termination before initialization',
          }));
          return 'false';
        }

        if (apiState.terminated) {
          setApiState((prev) => ({
            ...prev,
            lastError: SCORM_2004_ERRORS.TERMINATION_AFTER_TERMINATION,
            diagnosticMessage: 'Termination after termination',
          }));
          return 'false';
        }

        // Calculate and save session time
        const sessionTime = Date.now() - sessionStartTime;
        const formattedTime = formatSessionTime(sessionTime, '2004');
        setCmiDataStore((prev) => ({
          ...prev,
          'cmi.session_time': formattedTime,
        }));

        // Commit data before termination
        void commitTrackingData();

        setApiState((prev) => ({
          ...prev,
          initialized: false,
          terminated: true,
          lastError: SCORM_2004_ERRORS.NO_ERROR,
          diagnosticMessage: '',
        }));

        return 'true';
      },

      GetValue: (element: string): string => {
        if (!apiState.initialized) {
          setApiState((prev) => ({
            ...prev,
            lastError: SCORM_2004_ERRORS.RETRIEVE_DATA_BEFORE_INITIALIZATION,
            diagnosticMessage: 'Retrieve data before initialization',
          }));
          return '';
        }

        if (apiState.terminated) {
          setApiState((prev) => ({
            ...prev,
            lastError: SCORM_2004_ERRORS.RETRIEVE_DATA_AFTER_TERMINATION,
            diagnosticMessage: 'Retrieve data after termination',
          }));
          return '';
        }

        setApiState((prev) => ({
          ...prev,
          lastError: SCORM_2004_ERRORS.NO_ERROR,
          diagnosticMessage: '',
        }));

        // Get value from local CMI data store
        // Note: Server tracking data would need separate API call and integration
        const value = cmiDataStore[element] ?? '';
        return String(value);
      },

      SetValue: (element: string, value: string): string => {
        if (!apiState.initialized) {
          setApiState((prev) => ({
            ...prev,
            lastError: SCORM_2004_ERRORS.STORE_DATA_BEFORE_INITIALIZATION,
            diagnosticMessage: 'Store data before initialization',
          }));
          return 'false';
        }

        if (apiState.terminated) {
          setApiState((prev) => ({
            ...prev,
            lastError: SCORM_2004_ERRORS.STORE_DATA_AFTER_TERMINATION,
            diagnosticMessage: 'Store data after termination',
          }));
          return 'false';
        }

        // Check for read-only elements
        const readOnlyElements = [
          'cmi.learner_id',
          'cmi.learner_name',
          'cmi.credit',
          'cmi.entry',
          'cmi.total_time',
          'cmi.mode',
          'cmi.launch_data',
          'cmi.comments_from_lms._count',
          'cmi.objectives._count',
          'cmi.interactions._count',
          'cmi._version',
        ];

        if (readOnlyElements.includes(element)) {
          setApiState((prev) => ({
            ...prev,
            lastError: SCORM_2004_ERRORS.DATA_MODEL_READ_ONLY,
            diagnosticMessage: `${element} is read-only`,
          }));
          return 'false';
        }

        // Store the value
        setCmiDataStore((prev) => ({
          ...prev,
          [element]: value,
        }));

        setApiState((prev) => ({
          ...prev,
          lastError: SCORM_2004_ERRORS.NO_ERROR,
          diagnosticMessage: '',
        }));

        return 'true';
      },

      Commit: (_param: string): string => {
        if (!apiState.initialized) {
          setApiState((prev) => ({
            ...prev,
            lastError: SCORM_2004_ERRORS.COMMIT_BEFORE_INITIALIZATION,
            diagnosticMessage: 'Commit before initialization',
          }));
          return 'false';
        }

        if (apiState.terminated) {
          setApiState((prev) => ({
            ...prev,
            lastError: SCORM_2004_ERRORS.COMMIT_AFTER_TERMINATION,
            diagnosticMessage: 'Commit after termination',
          }));
          return 'false';
        }

        void commitTrackingData();

        setApiState((prev) => ({
          ...prev,
          lastError: SCORM_2004_ERRORS.NO_ERROR,
          diagnosticMessage: '',
        }));

        return 'true';
      },

      GetLastError: (): string => {
        return apiState.lastError;
      },

      GetErrorString: (errorCode: string): string => {
        return getScorm2004ErrorString(errorCode);
      },

      GetDiagnostic: (_errorCode: string): string => {
        return apiState.diagnosticMessage;
      },
    };
  }, [apiState, sessionStartTime, commitTrackingData, cmiDataStore, userId]);

  // ========================================================================
  // EVENT HANDLERS
  // ========================================================================

  /**
   * Handle navigation to a specific SCO
   */
  const navigateToSco = useCallback(
    (scoId: number) => {
      // Reset API state for new SCO
      setApiState({
        initialized: false,
        terminated: false,
        lastError: '0',
        diagnosticMessage: '',
      });

      // Clear CMI data store for new SCO
      setCmiDataStore({});

      // Set loading state
      setIsIframeLoading(true);

      // Update current SCO
      setCurrentScoId(scoId);

      // Notify parent component
      if (onScoChange) {
        onScoChange(scoId);
      }
    },
    [onScoChange]
  );

  /**
   * Handle previous SCO navigation
   */
  const handlePrevious = useCallback(() => {
    if (navigationState.hasPrevious && navigationState.currentIndex > 0) {
      const previousSco = flatScoes[navigationState.currentIndex - 1];
      if (previousSco) {
        navigateToSco(previousSco.id);
      }
    }
  }, [navigationState, flatScoes, navigateToSco]);

  /**
   * Handle next SCO navigation
   */
  const handleNext = useCallback(() => {
    if (navigationState.hasNext && navigationState.currentIndex < flatScoes.length - 1) {
      const nextSco = flatScoes[navigationState.currentIndex + 1];
      if (nextSco) {
        navigateToSco(nextSco.id);
      }
    }
  }, [navigationState, flatScoes, navigateToSco]);

  /**
   * Handle exit from player
   */
  const handleExit = useCallback(() => {
    // Commit any pending data before exit
    void commitTrackingData().then(() => {
      // Invalidate queries to refresh data
      void queryClient.invalidateQueries({
        queryKey: scormQueryKeys.all,
      });

      // Call exit callback
      if (onExit) {
        onExit();
      }
    });
  }, [commitTrackingData, queryClient, onExit]);

  /**
   * Handle TOC drawer toggle
   */
  const handleTocToggle = useCallback(() => {
    setIsTocOpen((prev) => !prev);
  }, []);

  /**
   * Handle SCO selection from TOC
   */
  const handleScoSelect = useCallback(
    (scoId: number) => {
      navigateToSco(scoId);
      // Close drawer on mobile after selection
      if (isMobile) {
        setIsTocOpen(false);
      }
    },
    [navigateToSco, isMobile]
  );

  /**
   * Handle fullscreen toggle
   */
  const handleFullscreenToggle = useCallback(() => {
    if (!playerContainerRef.current) {return;}

    if (!isFullscreen) {
      if (playerContainerRef.current.requestFullscreen) {
        void playerContainerRef.current.requestFullscreen();
      }
    } else if (document.exitFullscreen) {
        void document.exitFullscreen();
      }
  }, [isFullscreen]);

  /**
   * Handle iframe load event
   */
  const handleIframeLoad = useCallback(() => {
    setIsIframeLoading(false);
  }, []);

  /**
   * Handle iframe error
   */
  const handleIframeError = useCallback(() => {
    setIsIframeLoading(false);
    setPlayerError('Failed to load SCORM content. Please try again.');
  }, []);

  // ========================================================================
  // EFFECTS
  // ========================================================================

  /**
   * Initialize SCORM API on window when component mounts
   */
  useEffect(() => {
    if (apiInitializedRef.current) {return;}
    apiInitializedRef.current = true;

    // Create API objects based on SCORM version
    const scorm12Api = createScorm12Api();
    const scorm2004Api = createScorm2004Api();

    // Expose APIs on window for iframe content to access
    // SCORM 1.2 uses window.API
    (window as unknown as Record<string, unknown>)['API'] = scorm12Api;

    // SCORM 2004 uses window.API_1484_11
    (window as unknown as Record<string, unknown>)['API_1484_11'] = scorm2004Api;

    // Cleanup on unmount
    return () => {
      delete (window as unknown as Record<string, unknown>)['API'];
      delete (window as unknown as Record<string, unknown>)['API_1484_11'];
      apiInitializedRef.current = false;
    };
  }, [createScorm12Api, createScorm2004Api]);

  /**
   * Update SCORM APIs when callbacks change
   */
  useEffect(() => {
    if (!apiInitializedRef.current) {return;}

    // Update API objects with new callbacks
    const scorm12Api = createScorm12Api();
    const scorm2004Api = createScorm2004Api();

    (window as unknown as Record<string, unknown>)['API'] = scorm12Api;
    (window as unknown as Record<string, unknown>)['API_1484_11'] = scorm2004Api;
  }, [createScorm12Api, createScorm2004Api]);

  /**
   * Set initial SCO when SCO list loads
   */
  useEffect(() => {
    if (currentScoId === null && scoes && scoes.length > 0) {
      const firstSco = findFirstLaunchableSco(scoes);
      if (firstSco) {
        setCurrentScoId(firstSco.id);
      }
    }
  }, [scoes, currentScoId]);

  /**
   * Handle fullscreen change events
   */
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement !== null);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  /**
   * Handle window beforeunload to save tracking data
   */
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (Object.keys(cmiDataStore).length > 0 && apiState.initialized) {
        // Attempt to save tracking data synchronously
        // Note: Most browsers block async operations in beforeunload
        event.preventDefault();
        event.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [cmiDataStore, apiState.initialized]);

  // ========================================================================
  // RENDER HELPERS
  // ========================================================================

  /**
   * Render loading state
   */
  const renderLoading = () => (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        minHeight: 400,
        gap: 2,
      }}
    >
      <CircularProgress size={48} />
      <Typography variant="body1" color="text.secondary">
        Loading SCORM content...
      </Typography>
    </Box>
  );

  /**
   * Render error state
   */
  const renderError = (errorMessage: string) => (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        minHeight: 400,
        p: 3,
      }}
    >
      <Alert severity="error" sx={{ maxWidth: 600 }}>
        <AlertTitle>Error Loading SCORM Content</AlertTitle>
        {errorMessage}
      </Alert>
      <Button variant="contained" sx={{ mt: 2 }} onClick={handleExit}>
        Return to Activity
      </Button>
    </Box>
  );

  /**
   * Render TOC drawer content
   */
  const renderTocDrawer = () => (
    <Drawer
      variant={isMobile ? 'temporary' : 'persistent'}
      anchor="left"
      open={isTocOpen}
      onClose={handleTocToggle}
      sx={{
        width: TOC_DRAWER_WIDTH,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: TOC_DRAWER_WIDTH,
          boxSizing: 'border-box',
          position: displayMode === 'embedded' ? 'relative' : 'fixed',
        },
      }}
    >
      <Toolbar>
        <Typography variant="h6" noWrap sx={{ flex: 1 }}>
          Contents
        </Typography>
        <IconButton onClick={handleTocToggle} edge="end">
          {theme.direction === 'ltr' ? <ChevronLeftIcon /> : <ChevronRightIcon />}
        </IconButton>
      </Toolbar>
      <Divider />
      <Box sx={{ overflow: 'auto', flex: 1 }}>
        <ScormTOC
          scormId={scormId}
          attempt={currentAttempt}
          currentScoId={currentScoId ?? undefined}
          scorm={scorm}
          onScoSelect={handleScoSelect}
        />
      </Box>
    </Drawer>
  );

  /**
   * Render navigation controls
   */
  const renderNavigationControls = () => (
    <Stack
      direction="row"
      spacing={1}
      alignItems="center"
      sx={{ flex: 1, justifyContent: 'center' }}
    >
      <Button
        variant="outlined"
        size="small"
        startIcon={<PreviousIcon />}
        onClick={handlePrevious}
        disabled={!navigationState.hasPrevious}
      >
        Previous
      </Button>
      <Typography variant="body2" color="text.secondary" sx={{ mx: 2 }}>
        {navigationState.currentIndex + 1} / {flatScoes.length}
      </Typography>
      <Button
        variant="outlined"
        size="small"
        endIcon={<NextIcon />}
        onClick={handleNext}
        disabled={!navigationState.hasNext}
      >
        Next
      </Button>
    </Stack>
  );

  /**
   * Render toolbar
   */
  const renderToolbar = () => (
    <AppBar
      position="static"
      color="default"
      elevation={0}
      sx={{ borderBottom: `1px solid ${theme.palette.divider}` }}
    >
      <Toolbar variant="dense">
        {/* TOC Toggle */}
        {showToc && (
          <IconButton
            edge="start"
            color="inherit"
            aria-label={isTocOpen ? 'Close table of contents' : 'Open table of contents'}
            onClick={handleTocToggle}
            sx={{ mr: 1 }}
          >
            {isTocOpen ? <ChevronLeftIcon /> : <MenuIcon />}
          </IconButton>
        )}

        {/* Current SCO Title */}
        <Typography
          variant="subtitle1"
          component="div"
          noWrap
          sx={{
            flexGrow: 0,
            maxWidth: isMobile ? 150 : 300,
            mr: 2,
          }}
        >
          {currentSco?.title ?? 'SCORM Player'}
        </Typography>

        {/* Navigation Controls (if enabled and not mobile) */}
        {showNavigation && !isMobile && renderNavigationControls()}

        {/* Spacer */}
        <Box sx={{ flex: 1 }} />

        {/* SCORM Version Badge */}
        {!isMobile && (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{
              mr: 2,
              px: 1,
              py: 0.5,
              borderRadius: 1,
              bgcolor: 'action.hover',
            }}
          >
            {scormVersionDisplay}
          </Typography>
        )}

        {/* Fullscreen Toggle */}
        <IconButton
          color="inherit"
          aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          onClick={handleFullscreenToggle}
        >
          {isFullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
        </IconButton>

        {/* Exit Button */}
        <Button
          variant="text"
          color="inherit"
          startIcon={<ExitToApp />}
          onClick={handleExit}
          sx={{ ml: 1 }}
        >
          Exit
        </Button>
      </Toolbar>

      {/* Mobile Navigation */}
      {showNavigation && isMobile && (
        <Toolbar variant="dense" sx={{ justifyContent: 'center' }}>
          {renderNavigationControls()}
        </Toolbar>
      )}
    </AppBar>
  );

  /**
   * Render iframe content area
   */
  const renderIframeContent = () => (
    <Box
      sx={{
        position: 'relative',
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Loading overlay */}
      {isIframeLoading && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
            zIndex: 1,
          }}
        >
          <CircularProgress />
        </Box>
      )}

      {/* Iframe */}
      {iframeSrc && (
        <iframe
          ref={iframeRef}
          src={iframeSrc}
          title={currentSco?.title ?? 'SCORM Content'}
          onLoad={handleIframeLoad}
          onError={handleIframeError}
          style={{
            border: 'none',
            width: '100%',
            height: '100%',
            flex: 1,
            backgroundColor: '#fff',
          }}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
        />
      )}
    </Box>
  );

  // ========================================================================
  // MAIN RENDER
  // ========================================================================

  // Show loading state while fetching SCORM data
  if (isScormLoading || isAttemptLoading) {
    return renderLoading();
  }

  // Show error state
  if ([scormError, attemptError, playerError].some(Boolean)) {
    return renderError(
      scormError?.message ??
        attemptError?.message ??
        playerError ??
        'An unexpected error occurred'
    );
  }

  // Show error if no SCORM data
  if (!scorm || !scoes || scoes.length === 0) {
    return renderError('SCORM package data is not available');
  }

  return (
    <Box
      ref={playerContainerRef}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: displayMode === 'embedded' ? '100vh' : 'auto',
        minHeight: 600,
        backgroundColor: theme.palette.background.default,
      }}
    >
      {/* Toolbar */}
      {renderToolbar()}

      {/* Main Content Area */}
      <Box
        sx={{
          display: 'flex',
          flex: 1,
          overflow: 'hidden',
        }}
      >
        {/* TOC Drawer */}
        {showToc && renderTocDrawer()}

        {/* SCORM Content Iframe */}
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            transition: theme.transitions.create(['margin'], {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.leavingScreen,
            }),
            marginLeft: isTocOpen && !isMobile ? `${TOC_DRAWER_WIDTH}px` : 0,
          }}
        >
          {renderIframeContent()}
        </Box>
      </Box>

      {/* Review Mode Badge */}
      {mode === 'review' && (
        <Box
          sx={{
            position: 'fixed',
            top: 100,
            right: 20,
            zIndex: 1000,
          }}
        >
          <Alert severity="info" variant="filled">
            Review Mode - Progress will not be saved
          </Alert>
        </Box>
      )}
    </Box>
  );
}

export default ScormPlayer;
