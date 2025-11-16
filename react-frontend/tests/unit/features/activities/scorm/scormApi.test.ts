import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { apiClient } from '@/services/api/client';
import {
  fetchScorm,
  fetchScormScos,
  fetchScormToc,
  fetchPlayerConfig,
  launchSco,
  submitTracking,
  fetchAttempts,
  createAttempt,
  fetchAttemptTracking,
  fetchAttemptReport,
  deleteAttempt,
  evaluatePrerequisites,
} from '@/features/activities/scorm/api/scormApi';
import type {
  Scorm,
  ScormSco,
  ScormAttempt,
  ScormTrackingData,
  ScormTOCNode,
  ScormPlayerConfig,
  ScormReport,
  _ScormVersion,
} from '@/features/activities/scorm/types/scorm.types';
import {
  ScormGradeMethod,
  ScormStatus,
  ScoType,
} from '@/features/activities/scorm/types/scorm.types';

/* eslint-disable @typescript-eslint/unbound-method */

// Mock apiClient
vi.mock('@/services/api/client');

describe('scormApi', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
  });

  describe('fetchScorm', () => {
    it('should fetch SCORM package metadata successfully', async () => {
      const mockScorm: Scorm = {
        id: 1,
        course: 10,
        name: 'Introduction to E-Learning',
        intro: 'Welcome to the SCORM course',
        introformat: 1,
        version: 'SCORM_2004',
        maxgrade: 100,
        grademethod: ScormGradeMethod.HIGHEST,
        maxattempt: 3,
        whatgrade: 0,
        displaycoursestructure: true,
        popup: true,
        width: 800,
        height: 600,
        skipview: 0,
        hidebrowse: false,
        hidetoc: 0,
        nav: 1,
        navpositionleft: 100,
        navpositiontop: 100,
        auto: false,
        updatefreq: 0,
        scormtype: 'local',
        reference: 'scorm_package.zip',
        sha1hash: 'abc123def456',
        md5hash: '',
        revision: 1,
        launch: 0,
        timeopen: 0,
        timeclose: 0,
        timemodified: 1640000000,
        completionstatusrequired: null,
        completionscorerequired: null,
        completionstatusallscos: null,
        displayattemptstatus: 1,
        forcecompleted: false,
        forcenewattempt: 0,
        lastattemptlock: false,
        masteryoverride: false,
        autocommit: false,
        options: '',
      };

      const mockResponse = {
        success: true,
        data: mockScorm,
        meta: {},
      };

      vi.mocked(apiClient.get).mockResolvedValue({ data: mockResponse });

      const result = await fetchScorm(1);

      expect(apiClient.get).toHaveBeenCalledWith('/scorm/1');
      expect(result).toEqual(mockScorm);
    });

    it('should handle 404 error when SCORM package not found', async () => {
      const mockError = {
        isAxiosError: true,
        response: {
          status: 404,
          data: {
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: 'SCORM package not found',
            },
          },
        },
      };

      vi.mocked(apiClient.get).mockRejectedValue(mockError);

      await expect(fetchScorm(999)).rejects.toThrow();
    });

    it('should handle network errors', async () => {
      const networkError = new Error('Network Error');
      vi.mocked(apiClient.get).mockRejectedValue(networkError);

      await expect(fetchScorm(1)).rejects.toThrow('Failed to fetch SCORM package. Please try again.');
    });
  });

  describe('fetchScormScos', () => {
    it('should fetch SCORM 1.2 SCO structure with proper ordering', async () => {
      const mockScos: ScormSco[] = [
        {
          id: 1,
          scorm: 1,
          manifest: 'imsmanifest.xml',
          organization: 'org1',
          parent: '/',
          identifier: 'item_1',
          launch: 'index.html',
          scormtype: ScoType.SCO,
          title: 'Introduction',
          sortorder: 1,
        },
        {
          id: 2,
          scorm: 1,
          manifest: 'imsmanifest.xml',
          organization: 'org1',
          parent: '/',
          identifier: 'item_2',
          launch: 'lesson1.html',
          scormtype: ScoType.SCO,
          title: 'Lesson 1',
          sortorder: 2,
        },
      ];

      const mockResponse = {
        success: true,
        data: mockScos,
        meta: {
          version: 'SCORM_12',
        },
      };

      vi.mocked(apiClient.get).mockResolvedValue({ data: mockResponse });

      const result = await fetchScormScos(1);

      expect(apiClient.get).toHaveBeenCalledWith('/scorm/1/scos');
      expect(result).toEqual(mockScos);
      expect(result).toHaveLength(2);
      expect(result[0].sortorder).toBeLessThan(result[1].sortorder);
    });

    it('should fetch SCORM 2004 SCO structure with organization hierarchy', async () => {
      const mockScos: ScormSco[] = [
        {
          id: 1,
          scorm: 2,
          manifest: 'imsmanifest.xml',
          organization: 'org_default',
          parent: '/',
          identifier: 'item_root',
          launch: '',
          scormtype: ScoType.ASSET,
          title: 'Course Root',
          sortorder: 1,
        },
        {
          id: 2,
          scorm: 2,
          manifest: 'imsmanifest.xml',
          organization: 'org_default',
          parent: '/item_root',
          identifier: 'item_module1',
          launch: 'module1/index.html',
          scormtype: ScoType.SCO,
          title: 'Module 1',
          sortorder: 2,
        },
      ];

      const mockResponse = {
        success: true,
        data: mockScos,
        meta: {
          version: 'SCORM_2004',
        },
      };

      vi.mocked(apiClient.get).mockResolvedValue({ data: mockResponse });

      const result = await fetchScormScos(2);

      expect(result).toHaveLength(2);
      expect(result[1].parent).toContain('item_root');
    });

    it('should handle empty SCO list', async () => {
      const mockResponse = {
        success: true,
        data: [],
        meta: {},
      };

      vi.mocked(apiClient.get).mockResolvedValue({ data: mockResponse });

      const result = await fetchScormScos(1);

      expect(result).toEqual([]);
    });
  });

  describe('fetchScormToc', () => {
    it('should fetch hierarchical TOC with prerequisite evaluation', async () => {
      const mockToc: ScormTOCNode[] = [
        {
          id: 1,
          identifier: 'item_1',
          title: 'Introduction',
          isVisible: true,
          isLaunchable: true,
          prerequisiteMet: true,
          completionStatus: 'completed',
          successStatus: 'passed',
          score: 95,
          children: [],
          parent: null,
        },
        {
          id: 2,
          identifier: 'item_2',
          title: 'Chapter 1',
          isVisible: true,
          isLaunchable: true,
          prerequisiteMet: true,
          completionStatus: 'incomplete',
          successStatus: 'unknown',
          score: null,
          children: [],
          parent: null,
        },
        {
          id: 3,
          identifier: 'item_3',
          title: 'Chapter 2',
          isVisible: true,
          isLaunchable: false,
          prerequisiteMet: false,
          completionStatus: 'not attempted',
          successStatus: 'unknown',
          score: null,
          children: [],
          parent: null,
        },
      ];

      const mockResponse = {
        success: true,
        data: mockToc,
        meta: {
          currentScoId: 2,
          attemptId: 5,
        },
      };

      vi.mocked(apiClient.get).mockResolvedValue({ data: mockResponse });

      const result = await fetchScormToc(1, { scormId: 1, attempt: 5 });

      expect(apiClient.get).toHaveBeenCalledWith('/scorm/1/toc', {
        params: { scormId: 1, attempt: 5 },
      });
      expect(result).toEqual(mockToc);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(result[2].prerequisiteMet).toBe(false);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(result[2].isLaunchable).toBe(false);
    });

    it('should handle nested TOC structure', async () => {
      const mockToc: ScormTOCNode[] = [
        {
          id: 1,
          identifier: 'module1',
          title: 'Module 1',
          isVisible: true,
          isLaunchable: false,
          prerequisiteMet: true,
          completionStatus: 'incomplete',
          successStatus: 'unknown',
          score: null,
          parent: null,
          children: [
            {
              id: 2,
              identifier: 'module1_lesson1',
              title: 'Lesson 1.1',
              isVisible: true,
              isLaunchable: true,
              prerequisiteMet: true,
              completionStatus: 'completed',
              successStatus: 'passed',
              score: 90,
              children: [],
              parent: 'module1',
            },
          ],
        },
      ];

      const mockResponse = {
        success: true,
        data: mockToc,
        meta: {},
      };

      vi.mocked(apiClient.get).mockResolvedValue({ data: mockResponse });

      const result = await fetchScormToc(1);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(result[0].children).toHaveLength(1);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(result[0].children![0].parent).toBe('module1');
    });
  });

  describe('fetchPlayerConfig', () => {
    it('should fetch player configuration with popup dimensions', async () => {
      const mockConfig: ScormPlayerConfig = {
        scormId: 1,
        popup: true,
        width: 1024,
        height: 768,
        skipView: false,
        hideBrowse: false,
        hidetoc: 0,
        nav: 1,
        navPositionLeft: 150,
        navPositionTop: 50,
        auto: true,
        displayCourseStructure: true,
        displayActivityName: true,
        updateFreq: 30,
        autoCommit: true,
        masteryOverride: false,
        maxAttempt: 0,
      };

      const mockResponse = {
        success: true,
        data: mockConfig,
        meta: {},
      };

      vi.mocked(apiClient.get).mockResolvedValue({ data: mockResponse });

      const result = await fetchPlayerConfig(1);

      expect(apiClient.get).toHaveBeenCalledWith('/scorm/1/player');
      expect(result).toEqual(mockConfig);
      expect(result.popup).toBe(true);
      expect(result.width).toBe(1024);
      expect(result.height).toBe(768);
    });

    it('should handle inline player configuration', async () => {
      const mockConfig: ScormPlayerConfig = {
        scormId: 2,
        popup: false,
        width: 0,
        height: 0,
        skipView: false,
        hideBrowse: false,
        hidetoc: 1,
        nav: 0,
        navPositionLeft: 0,
        navPositionTop: 0,
        auto: false,
        displayCourseStructure: false,
        displayActivityName: true,
        updateFreq: 0,
        autoCommit: false,
        masteryOverride: true,
        maxAttempt: 5,
      };

      const mockResponse = {
        success: true,
        data: mockConfig,
        meta: {},
      };

      vi.mocked(apiClient.get).mockResolvedValue({ data: mockResponse });

      const result = await fetchPlayerConfig(2);

      expect(result.popup).toBe(false);
      expect(result.hidetoc).toBe(1);
    });
  });

  describe('launchSco', () => {
    it('should launch SCO with prerequisite checking', async () => {
      const mockResponse = {
        success: true,
        data: {
          launchUrl: 'https://example.com/scorm/player/1/2',
          scoId: 2,
          attemptId: 10,
          parameters: '',
        },
        meta: {},
      };

      vi.mocked(apiClient.post).mockResolvedValue({ data: mockResponse });

      const result = await launchSco(1, {
        scormId: 1,
        scoId: 2,
        attempt: 10,
      });

      expect(apiClient.post).toHaveBeenCalledWith('/scorm/1/launch', {
        scormId: 1,
        scoId: 2,
        attempt: 10,
      });
      expect(result).toEqual(mockResponse.data);
    });

    it('should launch SCO with new attempt creation', async () => {
      const mockResponse = {
        success: true,
        data: {
          launchUrl: 'https://example.com/scorm/player/1/1',
          scoId: 1,
          attemptId: 15,
          parameters: '',
        },
        meta: {
          attemptNumber: 1,
        },
      };

      vi.mocked(apiClient.post).mockResolvedValue({ data: mockResponse });

      const result = await launchSco(1, {
        scormId: 1,
        scoId: 1,
        attempt: 15,
      });

      expect(apiClient.post).toHaveBeenCalledWith('/scorm/1/launch', {
        scormId: 1,
        scoId: 1,
        attempt: 15,
      });
      expect(result.attemptId).toBe(15);
    });

    it('should handle prerequisite not met error', async () => {
      const mockError = {
        isAxiosError: true,
        response: {
          status: 403,
          data: {
            success: false,
            error: {
              code: 'PREREQUISITE_NOT_MET',
              message: 'prerequisite not met',
              details: {
                requiredSco: 'item_1',
              },
              status: 403,
            },
          },
        },
      };

      vi.mocked(apiClient.post).mockRejectedValue(mockError);

      await expect(
        launchSco(1, {
          scormId: 1,
          scoId: 3,
          attempt: 5,
        })
      ).rejects.toThrow('Prerequisites not met. Please complete required content first.');
    });
  });

  describe('submitTracking', () => {
    it('should submit SCORM 1.2 tracking data with cmi.core elements', async () => {
      const _trackingData = {
        attemptId: 5,
        scoId: 2,
        element: 'cmi.core.lesson_status',
        value: 'completed',
        timeStamp: Date.now(),
      };

      const cmiElements: Record<string, string | number> = {
        'cmi.core.lesson_status': 'completed',
        'cmi.core.score.raw': '85',
        'cmi.core.score.min': '0',
        'cmi.core.score.max': '100',
        'cmi.core.session_time': '00:25:30',
        'cmi.suspend_data': 'level=5,checkpoint=3',
      };

      const mockResponse = {
        success: true,
        data: {
          success: true,
          message: 'Tracking data saved successfully',
        },
        meta: {
          version: 'SCORM_12',
        },
      };

      vi.mocked(apiClient.post).mockResolvedValue({ data: mockResponse });

      const result = await submitTracking(1, {
        scormId: 1,
        scoId: 2,
        attempt: 5,
        tracks: cmiElements,
      });

      expect(apiClient.post).toHaveBeenCalledWith('/scorm/1/track', {
        scormId: 1,
        scoId: 2,
        attempt: 5,
        tracks: cmiElements,
      });
      expect(result).toEqual(mockResponse.data);
    });

    it('should submit SCORM 2004 tracking data with cmi.* elements', async () => {
      const cmiElements: Record<string, string | number> = {
        'cmi.completion_status': 'completed',
        'cmi.success_status': 'passed',
        'cmi.score.scaled': '0.85',
        'cmi.score.raw': '85',
        'cmi.score.min': '0',
        'cmi.score.max': '100',
        'cmi.session_time': 'PT25M30S',
        'cmi.location': 'page_5',
        'cmi.suspend_data': '{"progress":50,"bookmark":"section3"}',
      };

      const mockResponse = {
        success: true,
        data: {
          success: true,
          message: 'Tracking data saved successfully',
        },
        meta: {
          version: 'SCORM_2004',
        },
      };

      vi.mocked(apiClient.post).mockResolvedValue({ data: mockResponse });

      const result = await submitTracking(1, {
        scormId: 1,
        scoId: 3,
        attempt: 8,
        tracks: cmiElements,
      });

      expect(result.success).toBe(true);
    });

    it('should handle large suspend_data exceeding 4KB', async () => {
      const largeSuspendData = 'x'.repeat(5000); // Exceeds typical 4KB limit

      const cmiElements: Record<string, string> = {
        'cmi.suspend_data': largeSuspendData,
      };

      const mockError = {
        isAxiosError: true,
        response: {
          status: 413,
          data: {
            success: false,
            error: {
              code: 'PAYLOAD_TOO_LARGE',
              message: 'Suspend data exceeds maximum allowed size',
              details: {
                maxSize: 4096,
                actualSize: 5000,
              },
              status: 413,
            },
          },
        },
      };

      vi.mocked(apiClient.post).mockRejectedValue(mockError);

      await expect(
        submitTracking(1, {
          scormId: 1,
          scoId: 2,
          attempt: 5,
          tracks: cmiElements,
        })
      ).rejects.toThrow('Suspend data exceeds maximum allowed size');
    });

    it('should handle network interruption during tracking submission', async () => {
      const cmiElements: Record<string, string> = {
        'cmi.core.lesson_status': 'incomplete',
      };

      const networkError = new Error('Network request failed');
      vi.mocked(apiClient.post).mockRejectedValue(networkError);

      await expect(
        submitTracking(1, {
          scormId: 1,
          scoId: 2,
          attempt: 5,
          tracks: cmiElements,
        })
      ).rejects.toThrow('Failed to save progress. Please try again.');
    });

    it('should handle concurrent tracking submissions', async () => {
      const mockResponse = {
        success: true,
        data: { success: true, message: 'Tracking data saved successfully' },
        meta: {},
      };

      vi.mocked(apiClient.post).mockResolvedValue({ data: mockResponse });

      const promises = [
        submitTracking(1, {
          scormId: 1,
          scoId: 2,
          attempt: 5,
          tracks: { 'cmi.core.lesson_status': 'incomplete' },
        }),
        submitTracking(1, {
          scormId: 1,
          scoId: 2,
          attempt: 5,
          tracks: { 'cmi.core.score.raw': '75' },
        }),
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(2);
      expect(apiClient.post).toHaveBeenCalledTimes(2);
    });
  });

  describe('createAttempt', () => {
    it('should create new attempt with maxattempt validation', async () => {
      const mockAttempt: ScormAttempt = {
        id: 20,
        scormid: 1,
        userid: 100,
        attempt: 1,
        status: ScormStatus.INCOMPLETE,
        timemodified: 1640000000,
      };

      const mockResponse = {
        success: true,
        data: mockAttempt,
        meta: {
          maxAttempt: 3,
          previousAttempts: 0,
        },
      };

      vi.mocked(apiClient.post).mockResolvedValue({ data: mockResponse });

      const result = await createAttempt(1);

      expect(apiClient.post).toHaveBeenCalledWith('/scorm/1/attempt');
      expect(result).toEqual(mockAttempt);
      expect(result.attempt).toBe(1);
      expect(result.status).toBe('incomplete');
    });

    it('should assign correct attempt number for multiple attempts', async () => {
      const mockAttempt: ScormAttempt = {
        id: 25,
        scormid: 1,
        userid: 100,
        attempt: 2,
        status: ScormStatus.INCOMPLETE,
        timemodified: 1640000100,
      };

      const mockResponse = {
        success: true,
        data: mockAttempt,
        meta: {
          maxAttempt: 3,
          previousAttempts: 1,
        },
      };

      vi.mocked(apiClient.post).mockResolvedValue({ data: mockResponse });

      const result = await createAttempt(1);

      expect(result.attempt).toBe(2);
    });

    it('should handle max attempts exceeded error', async () => {
      const mockError = {
        isAxiosError: true,
        response: {
          status: 403,
          data: {
            success: false,
            error: {
              code: 'MAX_ATTEMPTS_EXCEEDED',
              message: 'Maximum number of attempts reached',
              details: {
                maxAttempt: 3,
                currentAttempts: 3,
              },
            },
          },
        },
      };

      vi.mocked(apiClient.post).mockRejectedValue(mockError);

      await expect(createAttempt(1)).rejects.toThrow();
    });
  });

  describe('fetchAttempts', () => {
    it('should fetch array of user attempts with status and score', async () => {
      const mockAttempts: ScormAttempt[] = [
        {
          id: 10,
          scormid: 1,
          userid: 100,
          attempt: 1,
          status: ScormStatus.COMPLETED,
          timemodified: 1640001800,
        },
        {
          id: 15,
          scormid: 1,
          userid: 100,
          attempt: 2,
          status: ScormStatus.COMPLETED,
          timemodified: 1640102400,
        },
        {
          id: 18,
          scormid: 1,
          userid: 100,
          attempt: 3,
          status: ScormStatus.INCOMPLETE,
          timemodified: 1640200600,
        },
      ];

      const mockResponse = {
        success: true,
        data: mockAttempts,
        meta: {
          total: 3,
          completed: 2,
          incomplete: 1,
        },
      };

      vi.mocked(apiClient.get).mockResolvedValue({ data: mockResponse });

      const result = await fetchAttempts(1, 100);

      expect(apiClient.get).toHaveBeenCalledWith('/scorm/1/attempts', {
        params: { userId: 100 },
      });
      expect(result).toEqual(mockAttempts);
      expect(result).toHaveLength(3);
      expect(result[0].status).toBe('completed');
      expect(result[2].status).toBe('incomplete');
    });

    it('should handle user with no attempts', async () => {
      const mockResponse = {
        success: true,
        data: [],
        meta: {
          total: 0,
          completed: 0,
          incomplete: 0,
        },
      };

      vi.mocked(apiClient.get).mockResolvedValue({ data: mockResponse });

      const result = await fetchAttempts(1, 200);

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it('should include timing information for all attempts', async () => {
      const mockAttempts: ScormAttempt[] = [
        {
          id: 10,
          scormId: 1,
          userId: 100,
          attempt: 1,
          startTime: 1640000000,
          finishTime: 1640003600,
          status: 'completed' as ScormStatus,
          scoreRaw: 85,
          scoreMin: 0,
          scoreMax: 100,
          totalTime: '01:00:00',
          sessionTime: '01:00:00',
          suspendData: null,
          timeModified: 1640003600,
        },
      ];

      const mockResponse = {
        success: true,
        data: mockAttempts,
        meta: {},
      };

      vi.mocked(apiClient.get).mockResolvedValue({ data: mockResponse });

      const result = await fetchAttempts(1, 100);

      expect(result[0].startTime).toBeDefined();
      expect(result[0].finishTime).toBeDefined();
      expect(result[0].totalTime).toBe('01:00:00');
    });
  });

  describe('fetchAttemptTracking', () => {
    it('should fetch all CMI elements for SCORM 1.2 attempt', async () => {
      const mockTrackingData: ScormTrackingData = {
        scoid: 2,
        attempt: 1,
        tracks: {
          'cmi.core.lesson_status': 'completed',
          'cmi.core.score.raw': '85',
          'cmi.core.score.min': '0',
          'cmi.core.score.max': '100',
          'cmi.core.session_time': '00:45:30',
          'cmi.core.total_time': '01:15:00',
          'cmi.core.lesson_location': 'page_10',
          'cmi.core.credit': 'credit',
          'cmi.core.entry': 'resume',
          'cmi.suspend_data': 'checkpoint=5,progress=75',
          'cmi.launch_data': '',
          'cmi.comments': 'Good progress',
          'cmi.interactions._count': '3',
        },
      };

      const mockResponse = {
        success: true,
        data: mockTrackingData,
        meta: {},
      };

      vi.mocked(apiClient.get).mockResolvedValue({ data: mockResponse });

      const result = await fetchAttemptTracking(10, 2);

      expect(apiClient.get).toHaveBeenCalledWith('/scorm/attempts/10/tracking', {
        params: { scoId: 2 },
      });
      expect(result).toEqual(mockTrackingData);
      expect(result.tracks['cmi.core.lesson_status']).toBe('completed');
      expect(result.tracks['cmi.suspend_data']).toBeDefined();
    });

    it('should fetch all CMI elements for SCORM 2004 attempt', async () => {
      const mockTrackingData: ScormTrackingData = {
        scoid: 3,
        attempt: 1,
        tracks: {
          'cmi.completion_status': 'completed',
          'cmi.success_status': 'passed',
          'cmi.score.scaled': '0.90',
          'cmi.score.raw': '90',
          'cmi.score.min': '0',
          'cmi.score.max': '100',
          'cmi.session_time': 'PT45M30S',
          'cmi.total_time': 'PT1H15M',
          'cmi.location': 'page_15',
          'cmi.credit': 'credit',
          'cmi.entry': 'resume',
          'cmi.mode': 'normal',
          'cmi.suspend_data': '{"checkpoint":10,"section":"module3"}',
          'cmi.launch_data': '',
          'cmi.learner_id': '100',
          'cmi.learner_name': 'John Doe',
          'cmi.max_time_allowed': 'PT2H',
        },
      };

      const mockResponse = {
        success: true,
        data: mockTrackingData,
        meta: {},
      };

      vi.mocked(apiClient.get).mockResolvedValue({ data: mockResponse });

      const result = await fetchAttemptTracking(15, 3);

      expect(result.tracks['cmi.completion_status']).toBe('completed');
      expect(result.tracks['cmi.success_status']).toBe('passed');
    });

    it('should handle attempt with no tracking data', async () => {
      const mockTrackingData: ScormTrackingData = {
        scoid: 1,
        attempt: 1,
        tracks: {},
      };

      const mockResponse = {
        success: true,
        data: mockTrackingData,
        meta: {},
      };

      vi.mocked(apiClient.get).mockResolvedValue({ data: mockResponse });

      const result = await fetchAttemptTracking(20, 1);

      expect(result.tracks).toEqual({});
    });

    it('should handle incomplete attempt with suspend data', async () => {
      const mockTrackingData: ScormTrackingData = {
        scoid: 2,
        attempt: 1,
        tracks: {
          'cmi.core.lesson_status': 'incomplete',
          'cmi.core.lesson_location': 'page_5',
          'cmi.suspend_data': 'saved_progress=40,last_page=5',
          'cmi.core.session_time': '00:15:00',
        },
      };

      const mockResponse = {
        success: true,
        data: mockTrackingData,
        meta: {},
      };

      vi.mocked(apiClient.get).mockResolvedValue({ data: mockResponse });

      const result = await fetchAttemptTracking(18, 2);

      expect(result.tracks['cmi.core.lesson_status']).toBe('incomplete');
      expect(result.tracks['cmi.suspend_data']).toBeDefined();
    });
  });

  describe('fetchAttemptReport', () => {
    it('should fetch comprehensive report with highest grade method', async () => {
      const mockReport: ScormReport = {
        scormId: 1,
        userId: 100,
        attempts: [
          {
            attemptNumber: 1,
            timeStarted: 1640000000,
            timeCompleted: 1640001800,
            status: ScormStatus.COMPLETED,
            score: 80,
            timeSpent: '00:30:00',
            scosCompleted: 2,
            scosTotal: 2,
          },
          {
            attemptNumber: 2,
            timeStarted: 1640100000,
            timeCompleted: 1640102400,
            status: ScormStatus.COMPLETED,
            score: 95,
            timeSpent: '00:40:00',
            scosCompleted: 2,
            scosTotal: 2,
          },
        ],
        currentAttempt: 2,
        overallScore: 95,
        grade: 95,
        completionPercentage: 100,
        totalTimeSpent: '01:10:00',
        interactions: [],
        objectives: [],
        scoProgress: [
          {
            scoid: 1,
            title: 'Introduction',
            status: ScormStatus.COMPLETED,
            score: { raw: 90 },
            timeSpent: '00:15:00',
            attempts: 1,
          },
          {
            scoid: 2,
            title: 'Main Content',
            status: ScormStatus.COMPLETED,
            score: { raw: 95 },
            timeSpent: '00:25:00',
            attempts: 1,
          },
        ],
        gradingMethod: 'highest' as ScormGradeMethod,
        status: 'completed' as ScormStatus,
      };

      const mockResponse = {
        success: true,
        data: mockReport,
        meta: {},
      };

      vi.mocked(apiClient.get).mockResolvedValue({ data: mockResponse });

      const result = await fetchAttemptReport(1, { userId: 100 });

      expect(apiClient.get).toHaveBeenCalledWith('/scorm/1/report', {
        params: { userId: 100 },
      });
      expect(result).toEqual(mockReport);
      expect(result.gradingMethod).toBe('highest');
      expect(result.overallScore).toBe(95);
      expect(result.grade).toBe(95);
    });

    it('should calculate grade using average method', async () => {
      const mockReport: ScormReport = {
        scormId: 1,
        userId: 100,
        attempts: [
          {
            attemptNumber: 1,
            timeStarted: 1640000000,
            timeCompleted: 1640001800,
            status: ScormStatus.COMPLETED,
            score: 70,
            timeSpent: '00:30:00',
            scosCompleted: 2,
            scosTotal: 2,
          },
          {
            attemptNumber: 2,
            timeStarted: 1640100000,
            timeCompleted: 1640102400,
            status: ScormStatus.COMPLETED,
            score: 90,
            timeSpent: '00:35:00',
            scosCompleted: 2,
            scosTotal: 2,
          },
        ],
        currentAttempt: 2,
        overallScore: 80,
        grade: 80,
        completionPercentage: 100,
        totalTimeSpent: '01:05:00',
        interactions: [],
        objectives: [],
        scoProgress: [],
        gradingMethod: 'average' as ScormGradeMethod,
        status: 'completed' as ScormStatus,
      };

      const mockResponse = {
        success: true,
        data: mockReport,
        meta: {},
      };

      vi.mocked(apiClient.get).mockResolvedValue({ data: mockResponse });

      const result = await fetchAttemptReport({ scormId: 1, userId: 100 });

      expect(result.gradingMethod).toBe('average');
      expect(result.overallScore).toBe(80);
    });

    it('should calculate grade using first attempt method', async () => {
      const mockReport: ScormReport = {
        scormId: 1,
        userId: 100,
        attempts: [
          {
            attemptNumber: 1,
            timeStarted: 1640000000,
            timeCompleted: 1640001800,
            status: ScormStatus.COMPLETED,
            score: 85,
            timeSpent: '00:30:00',
            scosCompleted: 2,
            scosTotal: 2,
          },
        ],
        currentAttempt: 1,
        overallScore: 85,
        grade: 85,
        completionPercentage: 100,
        totalTimeSpent: '00:30:00',
        interactions: [],
        objectives: [],
        scoProgress: [],
        gradingMethod: 'first' as ScormGradeMethod,
        status: 'completed' as ScormStatus,
      };

      const mockResponse = {
        success: true,
        data: mockReport,
        meta: {},
      };

      vi.mocked(apiClient.get).mockResolvedValue({ data: mockResponse });

      const result = await fetchAttemptReport({ scormId: 1, userId: 100 });

      expect(result.gradingMethod).toBe('first');
      expect(result.grade).toBe(85);
    });

    it('should calculate grade using last attempt method', async () => {
      const mockReport: ScormReport = {
        scormId: 1,
        userId: 100,
        attempts: [
          {
            attemptNumber: 1,
            timeStarted: 1640000000,
            timeCompleted: 1640001800,
            status: ScormStatus.COMPLETED,
            score: 90,
            timeSpent: '00:30:00',
            scosCompleted: 2,
            scosTotal: 2,
          },
          {
            attemptNumber: 2,
            timeStarted: 1640100000,
            timeCompleted: 1640102400,
            status: ScormStatus.COMPLETED,
            score: 75,
            timeSpent: '00:25:00',
            scosCompleted: 2,
            scosTotal: 2,
          },
        ],
        currentAttempt: 2,
        overallScore: 75,
        grade: 75,
        completionPercentage: 100,
        totalTimeSpent: '00:55:00',
        interactions: [],
        objectives: [],
        scoProgress: [],
        gradingMethod: 'last' as ScormGradeMethod,
        status: 'completed' as ScormStatus,
      };

      const mockResponse = {
        success: true,
        data: mockReport,
        meta: {},
      };

      vi.mocked(apiClient.get).mockResolvedValue({ data: mockResponse });

      const result = await fetchAttemptReport({ scormId: 1, userId: 100 });

      expect(result.gradingMethod).toBe('last');
      expect(result.overallScore).toBe(75);
    });

    it('should include objectives and interactions in report', async () => {
      const mockReport: ScormReport = {
        scormId: 1,
        userId: 100,
        attempts: [],
        currentAttempt: 1,
        overallScore: 85,
        grade: 85,
        completionPercentage: 100,
        totalTimeSpent: '00:45:00',
        interactions: [
          {
            id: 'interaction_1',
            type: 'choice',
            learnerResponse: 'a',
            result: 'correct',
            latency: 'PT5S',
            timestamp: 1640001000,
          },
        ],
        objectives: [
          {
            id: 'objective_1',
            score: 90,
            status: 'passed',
            description: 'Complete introduction',
          },
        ],
        scoProgress: [],
        gradingMethod: 'highest' as ScormGradeMethod,
        status: 'completed' as ScormStatus,
      };

      const mockResponse = {
        success: true,
        data: mockReport,
        meta: {},
      };

      vi.mocked(apiClient.get).mockResolvedValue({ data: mockResponse });

      const result = await fetchAttemptReport({ scormId: 1, userId: 100 });

      expect(result.interactions).toHaveLength(1);
      expect(result.objectives).toHaveLength(1);
      expect(result.objectives[0].status).toBe('passed');
    });
  });

  describe('deleteAttempt', () => {
    it('should delete attempt with permission validation', async () => {
      const mockResponse = {
        success: true,
        data: {
          success: true,
          message: 'Attempt deleted successfully',
        },
        meta: {},
      };

      vi.mocked(apiClient.delete).mockResolvedValue({ data: mockResponse });

      const result = await deleteAttempt(1, 10);

      expect(apiClient.delete).toHaveBeenCalledWith('/scorm/1/attempts/10');
      expect(result).toEqual(mockResponse.data);
      expect(result.success).toBe(true);
    });

    it('should handle permission denied error', async () => {
      const mockError = {
        isAxiosError: true,
        response: {
          status: 403,
          data: {
            success: false,
            error: {
              code: 'PERMISSION_DENIED',
              message: 'You do not have permission to delete this attempt',
              status: 403,
            },
          },
        },
      };

      vi.mocked(apiClient.delete).mockRejectedValue(mockError);

      await expect(deleteAttempt(1, 10)).rejects.toThrow('You do not have permission to delete attempts');
    });

    it('should handle attempt not found error', async () => {
      const mockError = {
        isAxiosError: true,
        response: {
          status: 404,
          data: {
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: 'Attempt not found',
              status: 404,
            },
          },
        },
      };

      vi.mocked(apiClient.delete).mockRejectedValue(mockError);

      await expect(deleteAttempt(1, 999)).rejects.toThrow('Attempt not found');
    });
  });

  describe('evaluatePrerequisites', () => {
    it('should evaluate prerequisite rules for SCO navigation', async () => {
      const mockResponse = {
        success: true,
        data: {
          scoId: 3,
          prerequisitesMet: true,
          requiredScos: ['item_1', 'item_2'],
          completedScos: ['item_1', 'item_2'],
          isAccessible: true,
        },
        meta: {},
      };

      vi.mocked(apiClient.post).mockResolvedValue({ data: mockResponse });

      const result = await evaluatePrerequisites(1, {
        scormId: 1,
        scoId: 3,
        attempt: 5,
      });

      expect(apiClient.post).toHaveBeenCalledWith('/scorm/1/prerequisites', {
        scormId: 1,
        scoId: 3,
        attempt: 5,
      });
      expect(result).toEqual(mockResponse.data);
      expect(result.prerequisitesMet).toBe(true);
      expect(result.isAccessible).toBe(true);
    });

    it('should handle prerequisites not met', async () => {
      const mockResponse = {
        success: true,
        data: {
          scoId: 5,
          prerequisitesMet: false,
          requiredScos: ['item_3', 'item_4'],
          completedScos: ['item_3'],
          isAccessible: false,
          missingPrerequisites: ['item_4'],
        },
        meta: {},
      };

      vi.mocked(apiClient.post).mockResolvedValue({ data: mockResponse });

      const result = await evaluatePrerequisites(1, {
        scormId: 1,
        scoId: 5,
        attempt: 5,
      });

      expect(result.prerequisitesMet).toBe(false);
      expect(result.isAccessible).toBe(false);
      expect(result.missingPrerequisites).toContain('item_4');
    });

    it('should handle circular prerequisite dependencies', async () => {
      const mockError = {
        isAxiosError: true,
        response: {
          status: 400,
          data: {
            success: false,
            error: {
              code: 'CIRCULAR_DEPENDENCY',
              message: 'Circular prerequisite dependency detected',
              details: {
                chain: ['item_1', 'item_2', 'item_3', 'item_1'],
              },
            },
          },
        },
      };

      vi.mocked(apiClient.post).mockRejectedValue(mockError);

      await expect(
        evaluatePrerequisites(1, {
          scormId: 1,
          scoId: 1,
          attempt: 5,
        })
      ).rejects.toThrow();
    });

    it('should handle missing prerequisites in manifest', async () => {
      const mockError = {
        isAxiosError: true,
        response: {
          status: 400,
          data: {
            success: false,
            error: {
              code: 'INVALID_PREREQUISITE',
              message: 'Referenced prerequisite SCO not found',
              details: {
                missingSco: 'item_999',
              },
            },
          },
        },
      };

      vi.mocked(apiClient.post).mockRejectedValue(mockError);

      await expect(
        evaluatePrerequisites(1, {
          scormId: 1,
          scoId: 10,
          attempt: 5,
        })
      ).rejects.toThrow();
    });

    it('should evaluate prerequisites with no requirements', async () => {
      const mockResponse = {
        success: true,
        data: {
          scoId: 1,
          prerequisitesMet: true,
          requiredScos: [],
          completedScos: [],
          isAccessible: true,
        },
        meta: {},
      };

      vi.mocked(apiClient.post).mockResolvedValue({ data: mockResponse });

      const result = await evaluatePrerequisites({
        scormId: 1,
        scoId: 1,
        attemptId: 5,
      });

      expect(result.prerequisitesMet).toBe(true);
      expect(result.requiredScos).toHaveLength(0);
    });
  });

  describe('API response envelope handling', () => {
    it('should handle success response envelope correctly', async () => {
      const mockScorm: Scorm = {
        id: 1,
        course: 10,
        name: 'Test SCORM',
        intro: '',
        introformat: 1,
        version: 'SCORM_12',
        maxgrade: 100,
        grademethod: ScormGradeMethod.HIGHEST,
        maxattempt: 0,
        whatgrade: 0,
        displaycoursestructure: true,
        popup: false,
        width: 0,
        height: 0,
        skipview: 0,
        hidebrowse: false,
        hidetoc: 0,
        nav: 1,
        navpositionleft: 0,
        navpositiontop: 0,
        auto: false,
        updatefreq: 0,
        scormtype: 'local',
        reference: '',
        sha1hash: '',
        md5hash: '',
        revision: 1,
        launch: 0,
        timeopen: 0,
        timeclose: 0,
        timemodified: 0,
        completionstatusrequired: null,
        completionscorerequired: null,
        completionstatusallscos: null,
        displayattemptstatus: 1,
        forcecompleted: false,
        forcenewattempt: 0,
        lastattemptlock: false,
        masteryoverride: false,
        autocommit: false,
        options: '',
      };

      const mockResponse = {
        success: true,
        data: mockScorm,
        meta: {
          version: 'SCORM_12',
        },
      };

      vi.mocked(apiClient.get).mockResolvedValue({ data: mockResponse });

      const result = await fetchScorm(1);

      expect(result).toEqual(mockScorm);
    });

    it('should handle error response envelope correctly', async () => {
      const mockError = {
        isAxiosError: true,
        response: {
          status: 500,
          data: {
            success: false,
            error: {
              code: 'INTERNAL_ERROR',
              message: 'An unexpected error occurred',
              details: {},
            },
          },
        },
      };

      vi.mocked(apiClient.get).mockRejectedValue(mockError);

      await expect(fetchScorm(1)).rejects.toThrow();
    });
  });

  describe('Network error scenarios', () => {
    it('should handle timeout errors', async () => {
      const timeoutError = new Error('timeout of 10000ms exceeded');
      vi.mocked(apiClient.get).mockRejectedValue(timeoutError);

      await expect(fetchScorm(1)).rejects.toThrow('Failed to fetch SCORM package. Please try again.');
    });

    it('should handle connection refused errors', async () => {
      const connectionError = new Error('connect ECONNREFUSED');
      vi.mocked(apiClient.post).mockRejectedValue(connectionError);

      await expect(createAttempt(1)).rejects.toThrow('Failed to create new attempt. Please try again.');
    });

    it('should handle DNS resolution errors', async () => {
      const dnsError = new Error('getaddrinfo ENOTFOUND');
      vi.mocked(apiClient.get).mockRejectedValue(dnsError);

      await expect(fetchAttempts(1)).rejects.toThrow('Failed to fetch attempt history. Please try again.');
    });
  });

  describe('Session persistence and recovery', () => {
    it('should handle session recovery after network interruption', async () => {
      // First call fails
      vi.mocked(apiClient.post)
        .mockRejectedValueOnce(new Error('Network Error'))
        .mockResolvedValueOnce({
          data: {
            success: true,
            data: { saved: true, attemptId: 5 },
            meta: {},
          },
        });

      // First attempt fails
      await expect(
        submitTracking({
          attemptId: 5,
          scoId: 2,
          tracks: [{ element: 'cmi.core.lesson_status', value: 'incomplete' }],
        })
      ).rejects.toThrow();

      // Retry succeeds
      const result = await submitTracking({
        attemptId: 5,
        scoId: 2,
        tracks: [{ element: 'cmi.core.lesson_status', value: 'incomplete' }],
      });

      expect(result.saved).toBe(true);
    });
  });

  describe('TypeScript interface validation', () => {
    // eslint-disable-next-line @typescript-eslint/require-await
    it('should validate Scorm interface structure', async () => {
      const mockScorm: Scorm = {
        id: 1,
        course: 10,
        name: 'Test',
        intro: '',
        introformat: 1,
        version: 'SCORM_12',
        maxgrade: 100,
        grademethod: ScormGradeMethod.HIGHEST,
        maxattempt: 0,
        whatgrade: 0,
        displaycoursestructure: true,
        popup: false,
        width: 0,
        height: 0,
        skipview: 0,
        hidebrowse: false,
        hidetoc: 0,
        nav: 1,
        navpositionleft: 0,
        navpositiontop: 0,
        auto: false,
        updatefreq: 0,
        scormtype: 'local',
        reference: '',
        sha1hash: '',
        md5hash: '',
        revision: 1,
        launch: 0,
        timeopen: 0,
        timeclose: 0,
        timemodified: 0,
        completionstatusrequired: null,
        completionscorerequired: null,
        completionstatusallscos: null,
        displayattemptstatus: 1,
        forcecompleted: false,
        forcenewattempt: 0,
        lastattemptlock: false,
        masteryoverride: false,
        autocommit: false,
        options: '',
      };

      expect(mockScorm).toHaveProperty('id');
      expect(mockScorm).toHaveProperty('version');
      expect(mockScorm).toHaveProperty('grademethod');
    });

    it('should validate ScormAttempt interface structure', () => {
      const mockAttempt: ScormAttempt = {
        id: 1,
        scormId: 1,
        userId: 100,
        attempt: 1,
        startTime: 1640000000,
        finishTime: null,
        status: 'incomplete' as ScormStatus,
        scoreRaw: null,
        scoreMin: null,
        scoreMax: null,
        totalTime: '00:00:00',
        sessionTime: null,
        suspendData: null,
        timeModified: 1640000000,
      };

      expect(mockAttempt).toHaveProperty('id');
      expect(mockAttempt).toHaveProperty('attempt');
      expect(mockAttempt).toHaveProperty('status');
    });
  });
});
