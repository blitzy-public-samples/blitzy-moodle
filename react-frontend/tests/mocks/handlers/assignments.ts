/**
 * MSW Request Handlers for Assignment API Endpoints
 * 
 * Provides comprehensive mock responses for assignment-related API operations including:
 * - Assignment details and configuration
 * - Student submission workflows (draft, final, resubmission)
 * - Teacher grading and feedback
 * - Submission file management
 * - Multiple assignment types and grading methods
 * 
 * Supports various test scenarios:
 * - Different submission types (file upload, online text, comments)
 * - Grading workflows (simple direct grading, marking workflow with states)
 * - Permission checking (student vs teacher access)
 * - Error conditions (not found, access denied, validation errors)
 * - File upload simulation with multipart/form-data
 * - Network latency simulation for realistic testing
 * 
 * @package react-frontend/tests/mocks
 */

import { http, HttpResponse } from 'msw';

// ============================================================================
// TypeScript Type Definitions
// ============================================================================

/**
 * Assignment submission status values
 */
type SubmissionStatus = 'new' | 'reopened' | 'draft' | 'submitted';

/**
 * Assignment grading status values
 */
type GradingStatus = 'notgraded' | 'graded';

/**
 * Marking workflow state values
 */
type MarkingWorkflowState = 
  | 'notmarked' 
  | 'inmarking' 
  | 'readyforreview' 
  | 'inreview' 
  | 'readyforrelease' 
  | 'released';

/**
 * Assignment attempt reopen methods
 */
type AttemptReopenMethod = 'none' | 'manual' | 'automatic' | 'untilpass';

/**
 * Assignment grading methods
 */
type GradingMethod = 'point' | 'rubric' | 'guide' | 'none';

/**
 * Submission type configuration
 */
interface SubmissionType {
  type: 'file' | 'onlinetext' | 'comments';
  enabled: boolean;
  maxfiles?: number;
  maxbytes?: number;
  acceptedfiletypes?: string;
}

/**
 * File attachment metadata
 */
interface FileAttachment {
  id: number;
  filename: string;
  filepath: string;
  filesize: number;
  mimetype: string;
  timemodified: number;
  url: string;
  previewurl?: string;
}

/**
 * Student submission data
 */
interface Submission {
  id: number;
  assignment: number;
  userid: number;
  timecreated: number;
  timemodified: number;
  status: SubmissionStatus;
  attemptnumber: number;
  onlinetext?: string;
  files: FileAttachment[];
}

/**
 * Grading data for a submission
 */
interface Grade {
  id: number;
  assignment: number;
  userid: number;
  grade: number | null;
  grader: number;
  timemodified: number;
  feedback: string;
  feedbackformat: number;
  feedbackfiles: FileAttachment[];
}

/**
 * User submission with grading information
 */
interface UserSubmission {
  user: {
    id: number;
    firstname: string;
    lastname: string;
    email: string;
    profileimageurl: string;
  };
  submission: Submission | null;
  grade: Grade | null;
  status: SubmissionStatus;
  gradingstatus: GradingStatus;
  workflowstate?: MarkingWorkflowState;
}

/**
 * Complete assignment configuration
 */
interface Assignment {
  id: number;
  course: number;
  name: string;
  intro: string;
  introformat: number;
  alwaysshowdescription: boolean;
  nosubmissions: boolean;
  submissiondrafts: boolean;
  sendnotifications: boolean;
  sendlatenotifications: boolean;
  sendstudentnotifications: boolean;
  duedate: number;
  cutoffdate: number;
  allowsubmissionsfromdate: number;
  grade: number;
  timemodified: number;
  completionsubmit: boolean;
  requiresubmissionstatement: boolean;
  teamsubmission: boolean;
  requireallteammemberssubmit: boolean;
  teamsubmissiongroupingid: number;
  blindmarking: boolean;
  hidegrader: boolean;
  revealidentities: boolean;
  attemptreopenmethod: AttemptReopenMethod;
  maxattempts: number;
  markingworkflow: boolean;
  markingallocation: boolean;
  preventsubmissionnotingroup: boolean;
  submissiontypes: SubmissionType[];
  gradingmethod: GradingMethod;
  usersubmission?: Submission;
  usergrades?: Grade;
  statistics?: {
    submitted: number;
    draft: number;
    new: number;
    graded: number;
    total: number;
  };
}

/**
 * Standard API success response envelope
 */
interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: {
    pagination?: {
      page: number;
      perPage: number;
      total: number;
      totalPages: number;
    };
  };
}

// ============================================================================
// Mock Data
// ============================================================================

/**
 * Mock assignments database with various configurations
 */
const mockAssignments: Record<number, Assignment> = {
  1: {
    id: 1,
    course: 101,
    name: 'Essay Assignment - Literature Review',
    intro: '<p>Write a comprehensive literature review on modern web development practices.</p>',
    introformat: 1,
    alwaysshowdescription: true,
    nosubmissions: false,
    submissiondrafts: true,
    sendnotifications: true,
    sendlatenotifications: true,
    sendstudentnotifications: true,
    duedate: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days from now
    cutoffdate: Date.now() + 14 * 24 * 60 * 60 * 1000, // 14 days from now
    allowsubmissionsfromdate: Date.now() - 7 * 24 * 60 * 60 * 1000, // Started 7 days ago
    grade: 100,
    timemodified: Date.now() - 2 * 24 * 60 * 60 * 1000,
    completionsubmit: true,
    requiresubmissionstatement: true,
    teamsubmission: false,
    requireallteammemberssubmit: false,
    teamsubmissiongroupingid: 0,
    blindmarking: false,
    hidegrader: false,
    revealidentities: false,
    attemptreopenmethod: 'manual',
    maxattempts: 3,
    markingworkflow: true,
    markingallocation: true,
    preventsubmissionnotingroup: false,
    submissiontypes: [
      { type: 'file', enabled: true, maxfiles: 3, maxbytes: 10485760, acceptedfiletypes: '.pdf,.doc,.docx' },
      { type: 'onlinetext', enabled: true },
      { type: 'comments', enabled: true }
    ],
    gradingmethod: 'point',
    statistics: {
      submitted: 15,
      draft: 5,
      new: 8,
      graded: 12,
      total: 28
    }
  },
  2: {
    id: 2,
    course: 101,
    name: 'Programming Assignment - Web Application',
    intro: '<p>Develop a full-stack web application using React and Node.js.</p>',
    introformat: 1,
    alwaysshowdescription: true,
    nosubmissions: false,
    submissiondrafts: true,
    sendnotifications: true,
    sendlatenotifications: false,
    sendstudentnotifications: true,
    duedate: Date.now() + 14 * 24 * 60 * 60 * 1000, // 14 days from now
    cutoffdate: Date.now() + 21 * 24 * 60 * 60 * 1000, // 21 days from now
    allowsubmissionsfromdate: Date.now() - 1 * 24 * 60 * 60 * 1000, // Started 1 day ago
    grade: 100,
    timemodified: Date.now() - 1 * 24 * 60 * 60 * 1000,
    completionsubmit: true,
    requiresubmissionstatement: false,
    teamsubmission: true,
    requireallteammemberssubmit: true,
    teamsubmissiongroupingid: 1,
    blindmarking: true,
    hidegrader: true,
    revealidentities: false,
    attemptreopenmethod: 'automatic',
    maxattempts: -1, // Unlimited
    markingworkflow: false,
    markingallocation: false,
    preventsubmissionnotingroup: true,
    submissiontypes: [
      { type: 'file', enabled: true, maxfiles: 10, maxbytes: 52428800, acceptedfiletypes: '.zip' }
    ],
    gradingmethod: 'rubric',
    statistics: {
      submitted: 8,
      draft: 3,
      new: 12,
      graded: 5,
      total: 23
    }
  },
  3: {
    id: 3,
    course: 102,
    name: 'Research Proposal Submission',
    intro: '<p>Submit your research proposal for approval.</p>',
    introformat: 1,
    alwaysshowdescription: true,
    nosubmissions: false,
    submissiondrafts: false,
    sendnotifications: false,
    sendlatenotifications: false,
    sendstudentnotifications: false,
    duedate: Date.now() - 2 * 24 * 60 * 60 * 1000, // Past due (2 days ago)
    cutoffdate: Date.now() + 3 * 24 * 60 * 60 * 1000, // Cutoff in 3 days
    allowsubmissionsfromdate: Date.now() - 30 * 24 * 60 * 60 * 1000, // Started 30 days ago
    grade: 50,
    timemodified: Date.now() - 30 * 24 * 60 * 60 * 1000,
    completionsubmit: false,
    requiresubmissionstatement: false,
    teamsubmission: false,
    requireallteammemberssubmit: false,
    teamsubmissiongroupingid: 0,
    blindmarking: false,
    hidegrader: false,
    revealidentities: false,
    attemptreopenmethod: 'none',
    maxattempts: 1,
    markingworkflow: false,
    markingallocation: false,
    preventsubmissionnotingroup: false,
    submissiontypes: [
      { type: 'file', enabled: true, maxfiles: 1, maxbytes: 5242880, acceptedfiletypes: '.pdf' },
      { type: 'onlinetext', enabled: false }
    ],
    gradingmethod: 'guide',
    statistics: {
      submitted: 20,
      draft: 0,
      new: 2,
      graded: 18,
      total: 22
    }
  }
};

/**
 * Mock submissions database
 */
const mockSubmissions: Record<number, Record<number, Submission>> = {
  1: { // Assignment 1 submissions
    101: {
      id: 1001,
      assignment: 1,
      userid: 101,
      timecreated: Date.now() - 5 * 24 * 60 * 60 * 1000,
      timemodified: Date.now() - 3 * 24 * 60 * 60 * 1000,
      status: 'submitted',
      attemptnumber: 1,
      onlinetext: '<p>This is my literature review on modern web development practices...</p>',
      files: [
        {
          id: 5001,
          filename: 'literature_review.pdf',
          filepath: '/submissions/1/101/',
          filesize: 245678,
          mimetype: 'application/pdf',
          timemodified: Date.now() - 3 * 24 * 60 * 60 * 1000,
          url: '/api/v1/files/download/5001',
          previewurl: '/api/v1/files/preview/5001'
        }
      ]
    },
    102: {
      id: 1002,
      assignment: 1,
      userid: 102,
      timecreated: Date.now() - 4 * 24 * 60 * 60 * 1000,
      timemodified: Date.now() - 1 * 24 * 60 * 60 * 1000,
      status: 'draft',
      attemptnumber: 1,
      onlinetext: '<p>Draft of my literature review...</p>',
      files: []
    }
  },
  2: { // Assignment 2 submissions
    101: {
      id: 2001,
      assignment: 2,
      userid: 101,
      timecreated: Date.now() - 2 * 24 * 60 * 60 * 1000,
      timemodified: Date.now() - 1 * 24 * 60 * 60 * 1000,
      status: 'submitted',
      attemptnumber: 1,
      files: [
        {
          id: 6001,
          filename: 'web_app_project.zip',
          filepath: '/submissions/2/101/',
          filesize: 1234567,
          mimetype: 'application/zip',
          timemodified: Date.now() - 1 * 24 * 60 * 60 * 1000,
          url: '/api/v1/files/download/6001'
        }
      ]
    }
  }
};

/**
 * Mock grades database
 */
const mockGrades: Record<number, Record<number, Grade>> = {
  1: { // Assignment 1 grades
    101: {
      id: 3001,
      assignment: 1,
      userid: 101,
      grade: 85,
      grader: 1,
      timemodified: Date.now() - 1 * 24 * 60 * 60 * 1000,
      feedback: '<p>Excellent work! Your literature review is comprehensive and well-structured.</p>',
      feedbackformat: 1,
      feedbackfiles: []
    }
  }
};

/**
 * Mock users for submission lists
 */
const mockUsers: Record<number, { id: number; firstname: string; lastname: string; email: string; profileimageurl: string }> = {
  101: {
    id: 101,
    firstname: 'Alice',
    lastname: 'Student',
    email: 'alice@example.com',
    profileimageurl: 'https://i.pravatar.cc/150?u=alice'
  },
  102: {
    id: 102,
    firstname: 'Bob',
    lastname: 'Learner',
    email: 'bob@example.com',
    profileimageurl: 'https://i.pravatar.cc/150?u=bob'
  },
  103: {
    id: 103,
    firstname: 'Carol',
    lastname: 'Scholar',
    email: 'carol@example.com',
    profileimageurl: 'https://i.pravatar.cc/150?u=carol'
  }
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Simulate network latency for realistic testing
 */
const simulateLatency = (min: number, max: number): Promise<void> => {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, delay));
};

/**
 * Check if user is authorized (simple mock check)
 * In real implementation, this would validate JWT token
 */
const isAuthorized = (request: Request): boolean => {
  const authHeader = request.headers.get('Authorization');
  return authHeader !== null && authHeader.startsWith('Bearer ');
};

/**
 * Check if user has teacher/grading permissions
 */
const hasGradingPermission = (request: Request): boolean => {
  // Mock: Check if Authorization header contains 'teacher' or 'admin'
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {return false;}
  return authHeader.includes('teacher') || authHeader.includes('admin');
};

/**
 * Get current user ID from request (mock)
 */
const getCurrentUserId = (request: Request): number => {
  // Mock: Extract from Authorization header or default to 101
  const authHeader = request.headers.get('Authorization');
  if (authHeader && authHeader.includes('user:')) {
    const match = authHeader.match(/user:(\d+)/);
    if (match?.[1]) {return parseInt(match[1], 10);}
  }
  return 101; // Default student user
};

// ============================================================================
// MSW Request Handlers
// ============================================================================

/**
 * Handler: GET /api/v1/assignments/:id
 * Returns complete assignment details including configuration, submission types,
 * grading settings, and current user's submission status
 */
const getAssignmentHandler = http.get(
  '*/api/v1/assignments/:id',
  async ({ params, request }) => {
    await simulateLatency(100, 300);

    const assignmentId = parseInt(params.id as string, 10);

    // Check authorization
    if (!isAuthorized(request)) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
            details: { required: 'mod/assign:view' }
          }
        },
        { status: 401 }
      );
    }

    // Check if assignment exists
    const assignment = mockAssignments[assignmentId];
    if (!assignment) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Assignment not found',
            details: { assignmentId }
          }
        },
        { status: 404 }
      );
    }

    // Get current user's submission if student
    const currentUserId = getCurrentUserId(request);
    const isTeacher = hasGradingPermission(request);

    const responseData: Assignment = { ...assignment };

    if (!isTeacher) {
      // Student view: Include their submission and grade
      const userSubmission = mockSubmissions[assignmentId]?.[currentUserId];
      const userGrade = mockGrades[assignmentId]?.[currentUserId];

      if (userSubmission) {
        responseData.usersubmission = userSubmission;
      }
      if (userGrade) {
        responseData.usergrades = userGrade;
      }
    }

    return HttpResponse.json(
      {
        success: true,
        data: responseData
      },
      { status: 200 }
    );
  }
);

/**
 * Handler: POST /api/v1/assignments/:id/submit
 * Handles student submission of assignment work including file uploads and online text
 */
const submitAssignmentHandler = http.post(
  '*/api/v1/assignments/:id/submit',
  async ({ params, request }) => {
    await simulateLatency(200, 500); // File operations take longer

    const assignmentId = parseInt(params.id as string, 10);

    // Check authorization
    if (!isAuthorized(request)) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
            details: { required: 'mod/assign:submit' }
          }
        },
        { status: 401 }
      );
    }

    // Check if assignment exists
    const assignment = mockAssignments[assignmentId];
    if (!assignment) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Assignment not found',
            details: { assignmentId }
          }
        },
        { status: 404 }
      );
    }

    // Parse request body
    const body = await request.json() as {
      status: SubmissionStatus;
      onlinetext?: string;
      files?: { filename: string; size: number; mimetype: string }[];
    };

    const currentUserId = getCurrentUserId(request);
    const now = Date.now();

    // Check if past due date (allow with warning)
    const isPastDue = now > assignment.duedate;
    const isPastCutoff = now > assignment.cutoffdate;

    if (isPastCutoff) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'SUBMISSION_CUTOFF_PASSED',
            message: 'The cutoff date for this assignment has passed',
            details: { cutoffdate: assignment.cutoffdate }
          }
        },
        { status: 403 }
      );
    }

    // Check attempt number and max attempts
    const existingSubmission = mockSubmissions[assignmentId]?.[currentUserId];
    const attemptNumber = existingSubmission ? existingSubmission.attemptnumber + 1 : 1;

    if (assignment.maxattempts !== -1 && attemptNumber > assignment.maxattempts) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'MAX_ATTEMPTS_REACHED',
            message: 'You have reached the maximum number of attempts for this assignment',
            details: { maxAttempts: assignment.maxattempts, currentAttempt: attemptNumber }
          }
        },
        { status: 403 }
      );
    }

    // Validate file types if files provided
    if (body.files && body.files.length > 0) {
      const fileType = assignment.submissiontypes.find(t => t.type === 'file');
      if (!fileType || !fileType.enabled) {
        return HttpResponse.json(
          {
            success: false,
            error: {
              code: 'FILE_SUBMISSION_DISABLED',
              message: 'File submissions are not allowed for this assignment'
            }
          },
          { status: 422 }
        );
      }

      // Check max files
      if (fileType.maxfiles && body.files.length > fileType.maxfiles) {
        return HttpResponse.json(
          {
            success: false,
            error: {
              code: 'TOO_MANY_FILES',
              message: `Maximum ${fileType.maxfiles} file(s) allowed`,
              details: { maxFiles: fileType.maxfiles, provided: body.files.length }
            }
          },
          { status: 422 }
        );
      }

      // Check file types
      if (fileType.acceptedfiletypes) {
        const acceptedTypes = fileType.acceptedfiletypes.split(',');
        for (const file of body.files) {
          const extension = `.${  file.filename.split('.').pop()}`;
          if (!acceptedTypes.includes(extension)) {
            return HttpResponse.json(
              {
                success: false,
                error: {
                  code: 'INVALID_FILE_TYPE',
                  message: `File type ${extension} is not allowed`,
                  details: { acceptedTypes: acceptedTypes.join(', ') }
                }
              },
              { status: 422 }
            );
          }
        }
      }
    }

    // Create or update submission
    const submissionId = existingSubmission?.id || 1000 + assignmentId * 100 + currentUserId;
    const files: FileAttachment[] = (body.files || []).map((f, index) => ({
      id: 5000 + submissionId * 10 + index,
      filename: f.filename,
      filepath: `/submissions/${assignmentId}/${currentUserId}/`,
      filesize: f.size,
      mimetype: f.mimetype,
      timemodified: now,
      url: `/api/v1/files/download/${5000 + submissionId * 10 + index}`,
      previewurl: f.mimetype.startsWith('image/') 
        ? `/api/v1/files/preview/${5000 + submissionId * 10 + index}` 
        : undefined
    }));

    const newSubmission: Submission = {
      id: submissionId,
      assignment: assignmentId,
      userid: currentUserId,
      timecreated: existingSubmission?.timecreated || now,
      timemodified: now,
      status: body.status,
      attemptnumber: attemptNumber,
      onlinetext: body.onlinetext,
      files
    };

    // Store in mock database
    if (!mockSubmissions[assignmentId]) {
      mockSubmissions[assignmentId] = {};
    }
    mockSubmissions[assignmentId][currentUserId] = newSubmission;

    const response: ApiSuccessResponse<{
      submission: Submission;
      warning?: string;
    }> = {
      success: true,
      data: {
        submission: newSubmission,
        ...(isPastDue && body.status === 'submitted' ? {
          warning: 'Your submission was submitted after the due date'
        } : {})
      }
    };

    return HttpResponse.json(response, { status: 200 });
  }
);

/**
 * Handler: POST /api/v1/assignments/:id/grade
 * Handles teacher grading of student submissions
 */
const gradeSubmissionHandler = http.post(
  '*/api/v1/assignments/:id/grade',
  async ({ params, request }) => {
    await simulateLatency(150, 300);

    const assignmentId = parseInt(params.id as string, 10);

    // Check authorization
    if (!isAuthorized(request)) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required'
          }
        },
        { status: 401 }
      );
    }

    // Check grading permission
    if (!hasGradingPermission(request)) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'You do not have permission to grade submissions',
            details: { required: 'mod/assign:grade' }
          }
        },
        { status: 403 }
      );
    }

    // Check if assignment exists
    const assignment = mockAssignments[assignmentId];
    if (!assignment) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Assignment not found',
            details: { assignmentId }
          }
        },
        { status: 404 }
      );
    }

    // Parse request body
    const body = await request.json() as {
      userid: number;
      grade: number;
      feedback: string;
      feedbackformat?: number;
      workflowstate?: MarkingWorkflowState;
    };

    // Validate grade is within range
    if (body.grade < 0 || body.grade > assignment.grade) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_GRADE',
            message: `Grade must be between 0 and ${assignment.grade}`,
            details: { minGrade: 0, maxGrade: assignment.grade, provided: body.grade }
          }
        },
        { status: 422 }
      );
    }

    // Check if submission exists
    const submission = mockSubmissions[assignmentId]?.[body.userid];
    if (!submission) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'SUBMISSION_NOT_FOUND',
            message: 'No submission found for this user',
            details: { userid: body.userid }
          }
        },
        { status: 404 }
      );
    }

    const currentUserId = getCurrentUserId(request);
    const now = Date.now();

    // Create or update grade
    const gradeId = mockGrades[assignmentId]?.[body.userid]?.id || 3000 + assignmentId * 100 + body.userid;
    const newGrade: Grade = {
      id: gradeId,
      assignment: assignmentId,
      userid: body.userid,
      grade: body.grade,
      grader: currentUserId,
      timemodified: now,
      feedback: body.feedback,
      feedbackformat: body.feedbackformat || 1,
      feedbackfiles: []
    };

    // Store in mock database
    if (!mockGrades[assignmentId]) {
      mockGrades[assignmentId] = {};
    }
    mockGrades[assignmentId][body.userid] = newGrade;

    return HttpResponse.json(
      {
        success: true,
        data: {
          grade: newGrade,
          submission
        }
      },
      { status: 200 }
    );
  }
);

/**
 * Handler: GET /api/v1/assignments/:id/submissions
 * Returns list of all student submissions for an assignment (teacher view)
 */
const getSubmissionsHandler = http.get(
  '*/api/v1/assignments/:id/submissions',
  async ({ params, request }) => {
    await simulateLatency(150, 300);

    const assignmentId = parseInt(params.id as string, 10);
    const url = new URL(request.url);
    const status = url.searchParams.get('status') as SubmissionStatus | null;
    const search = url.searchParams.get('search') || '';
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const perPage = parseInt(url.searchParams.get('perPage') || '20', 10);

    // Check authorization
    if (!isAuthorized(request)) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required'
          }
        },
        { status: 401 }
      );
    }

    // Check grading permission
    if (!hasGradingPermission(request)) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'You do not have permission to view submissions',
            details: { required: 'mod/assign:grade' }
          }
        },
        { status: 403 }
      );
    }

    // Check if assignment exists
    const assignment = mockAssignments[assignmentId];
    if (!assignment) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Assignment not found',
            details: { assignmentId }
          }
        },
        { status: 404 }
      );
    }

    // Build submissions list
    const assignmentSubmissions = mockSubmissions[assignmentId] || {};
    const assignmentGrades = mockGrades[assignmentId] || {};

    let userSubmissions: UserSubmission[] = Object.entries(mockUsers).map(([userId, user]) => {
      const userIdNum = parseInt(userId, 10);
      const submission = assignmentSubmissions[userIdNum] || null;
      const grade = assignmentGrades[userIdNum] || null;

      return {
        user,
        submission,
        grade,
        status: submission?.status || 'new',
        gradingstatus: grade ? 'graded' : 'notgraded'
      };
    });

    // Apply filters
    if (status) {
      userSubmissions = userSubmissions.filter(us => us.status === status);
    }

    if (search) {
      const searchLower = search.toLowerCase();
      userSubmissions = userSubmissions.filter(
        us => 
          us.user.firstname.toLowerCase().includes(searchLower) ||
          us.user.lastname.toLowerCase().includes(searchLower) ||
          us.user.email.toLowerCase().includes(searchLower)
      );
    }

    // Calculate pagination
    const total = userSubmissions.length;
    const totalPages = Math.ceil(total / perPage);
    const startIndex = (page - 1) * perPage;
    const endIndex = startIndex + perPage;
    const paginatedSubmissions = userSubmissions.slice(startIndex, endIndex);

    return HttpResponse.json(
      {
        success: true,
        data: paginatedSubmissions,
        meta: {
          pagination: {
            page,
            perPage,
            total,
            totalPages
          }
        }
      },
      { status: 200 }
    );
  }
);

/**
 * Handler: POST /api/v1/assignments/:id/feedback
 * Adds feedback comments and files to a graded submission
 */
const addFeedbackHandler = http.post(
  '*/api/v1/assignments/:id/feedback',
  async ({ params, request }) => {
    await simulateLatency(200, 400);

    const assignmentId = parseInt(params.id as string, 10);

    // Check authorization
    if (!isAuthorized(request)) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required'
          }
        },
        { status: 401 }
      );
    }

    // Check grading permission
    if (!hasGradingPermission(request)) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'You do not have permission to add feedback',
            details: { required: 'mod/assign:grade' }
          }
        },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json() as {
      userid: number;
      comment: string;
      files?: { filename: string; size: number; mimetype: string }[];
    };

    // Check if grade exists
    const grade = mockGrades[assignmentId]?.[body.userid];
    if (!grade) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'GRADE_NOT_FOUND',
            message: 'Grade not found. Please grade the submission first.'
          }
        },
        { status: 404 }
      );
    }

    const now = Date.now();

    // Add feedback files
    const feedbackFiles: FileAttachment[] = (body.files || []).map((f, index) => ({
      id: 7000 + grade.id * 10 + index,
      filename: f.filename,
      filepath: `/feedback/${assignmentId}/${body.userid}/`,
      filesize: f.size,
      mimetype: f.mimetype,
      timemodified: now,
      url: `/api/v1/files/download/${7000 + grade.id * 10 + index}`
    }));

    // Update grade with feedback
    grade.feedback = body.comment;
    grade.feedbackfiles = feedbackFiles;
    grade.timemodified = now;

    return HttpResponse.json(
      {
        success: true,
        data: grade
      },
      { status: 200 }
    );
  }
);

/**
 * Handler: GET /api/v1/assignments/:id/files
 * Returns list of files for a submission
 */
const getSubmissionFilesHandler = http.get(
  '*/api/v1/assignments/:id/files',
  async ({ params, request }) => {
    await simulateLatency(100, 200);

    const assignmentId = parseInt(params.id as string, 10);
    const url = new URL(request.url);
    const userid = url.searchParams.get('userid');

    // Check authorization
    if (!isAuthorized(request)) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required'
          }
        },
        { status: 401 }
      );
    }

    const currentUserId = getCurrentUserId(request);
    const isTeacher = hasGradingPermission(request);
    const targetUserId = userid ? parseInt(userid, 10) : currentUserId;

    // Check permission: students can only view their own files
    if (!isTeacher && targetUserId !== currentUserId) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'You can only view your own submission files'
          }
        },
        { status: 403 }
      );
    }

    // Get submission
    const submission = mockSubmissions[assignmentId]?.[targetUserId];
    if (!submission) {
      return HttpResponse.json(
        {
          success: true,
          data: []
        },
        { status: 200 }
      );
    }

    return HttpResponse.json(
      {
        success: true,
        data: submission.files
      },
      { status: 200 }
    );
  }
);

// ============================================================================
// Exported Handlers Array
// ============================================================================

/**
 * Array of all assignment-related MSW request handlers
 * Import this array in your MSW server setup to enable assignment API mocking
 */
export const assignmentsHandlers = [
  getAssignmentHandler,
  submitAssignmentHandler,
  gradeSubmissionHandler,
  getSubmissionsHandler,
  addFeedbackHandler,
  getSubmissionFilesHandler
];
