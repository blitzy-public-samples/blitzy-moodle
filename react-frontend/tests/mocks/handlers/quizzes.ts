/**
 * MSW Request Handlers for Quiz API Endpoints
 * 
 * Provides comprehensive mock handlers for quiz activity endpoints including:
 * - Quiz details and settings
 * - Attempt management (create, track, submit)
 * - Question navigation and rendering
 * - Answer submission and grading
 * - Results and review functionality
 * 
 * Supports multiple question types (multichoice, truefalse, shortanswer, essay,
 * matching, numerical, calculated) and various grading methods (highest, average,
 * first, last attempt).
 * 
 * @packageDocumentation
 */

import { http, HttpResponse } from 'msw';
import { GradeMethod } from '../../../src/features/activities/quizzes/types/quiz.types';
import {
  testQuiz1,
  testQuiz2,
  testQuiz3,
  type QuizQuestion as FixtureQuizQuestion
} from '../../e2e/fixtures/quizzes';

/**
 * TypeScript type definitions for quiz entities
 */

interface Quiz {
  id: number;
  name: string;
  intro: string;
  timeopen: number | null;
  timeclose: number | null;
  timelimit: number | null; // seconds
  overduehandling: 'autosubmit' | 'graceperiod' | 'autoabandon';
  graceperiod: number | null; // seconds
  preferredbehaviour: 'deferredfeedback' | 'adaptive' | 'immediatefeedback' | 'interactive';
  canredoquestions: boolean;
  attempts: number; // 0 means unlimited
  grademethod: GradeMethod;
  decimalpoints: number;
  questiondecimalpoints: number;
  reviewattempt: boolean;
  reviewcorrectness: boolean;
  reviewmarks: boolean;
  reviewspecificfeedback: boolean;
  reviewgeneralfeedback: boolean;
  reviewrightanswer: boolean;
  reviewoverallfeedback: boolean;
  questionsperpage: number;
  navmethod: 'free' | 'seq';
  shuffleanswers: boolean;
  sumgrades: number;
  grade: number;
  courseid: number;
  // Statistics
  questioncount: number;
  estimatedduration: number; // minutes
  // User attempt info
  userattempts?: {
    attemptsmade: number;
    attemptsallowed: number;
    bestgrade: number | null;
    lastattempt: number | null; // timestamp
  };
  // Access restrictions
  haspassword: boolean;
  hasipaddress: boolean;
  requiressafebrowser: boolean;
}

interface QuizAttempt {
  id: number;
  quiz: number;
  userid: number;
  attempt: number;
  uniqueid: number;
  layout: string; // Question slots layout e.g., "1,2,0,3,4,0,5"
  currentpage: number;
  preview: boolean;
  state: 'inprogress' | 'finished' | 'abandoned' | 'overdue';
  timestart: number;
  timefinish: number | null;
  timemodified: number;
  timecheckstate: number | null;
  sumgrades: number | null;
  gradednotificationsenttime: number | null;
}

interface Question {
  slot: number;
  questionid: number;
  type: 'multichoice' | 'truefalse' | 'shortanswer' | 'essay' | 'matching' | 'numerical' | 'calculated';
  questiontext: string;
  questiontextformat: number;
  generalfeedback: string;
  defaultmark: number;
  maxmark: number;
  page: number;
  // Question-specific data
  options?: MultichoiceOptions | TrueFalseOptions | ShortAnswerOptions | EssayOptions | MatchingOptions | NumericalOptions;
  // State
  answered: boolean;
  flagged: boolean;
  mark: number | null;
  state: 'notanswered' | 'answered' | 'graded' | 'needsgrading';
}

interface MultichoiceOptions {
  single: boolean;
  shuffleanswers: boolean;
  answers: Array<{
    id: number;
    answer: string;
    fraction: number; // 1.0 for correct, 0 for incorrect
    feedback: string;
  }>;
}

interface TrueFalseOptions {
  truefeedback: string;
  falsefeedback: string;
}

interface ShortAnswerOptions {
  usecase: boolean;
  answers: Array<{
    answer: string;
    fraction: number;
    feedback: string;
  }>;
}

interface EssayOptions {
  responseformat: 'editor' | 'plain' | 'monospaced';
  responserequired: boolean;
  responsefieldlines: number;
  attachments: number;
  attachmentsrequired: number;
}

interface MatchingOptions {
  shuffleanswers: boolean;
  subquestions: Array<{
    questiontext: string;
    answertext: string;
  }>;
  choices: string[];
}

interface NumericalOptions {
  answers: Array<{
    answer: number;
    fraction: number;
    tolerance: number;
    feedback: string;
  }>;
  unitgradingtype: 'none' | 'penalty' | 'response';
  unitpenalty: number;
}

/**
 * Frontend representation of a question after transformation
 */
interface TransformedQuestion {
  id: number;
  slot: number;
  type: string;
  questiontext: string;
  defaultmark: number;
  maxmark: number;
  answered: boolean;
  flagged: boolean;
  mark: number | null;
  state: string;
  generalfeedback: string;
  options: Array<{ id: number; text: string; correct: boolean }>;
  correctanswer?: string;
}

interface AttemptSummary {
  id: number;
  quiz: number;
  attempt: number;
  state: 'inprogress' | 'finished' | 'abandoned' | 'overdue';
  timestart: number;
  timefinish: number | null;
  sumgrades: number | null;
  grade: number | null;
  preview: boolean;
}

/**
 * Mock quiz database - realistic quiz data for testing
 */
const mockQuizzes: Map<number, Quiz> = new Map([
  [
    201,
    {
      id: 201,
      name: 'Python Fundamentals Quiz',
      intro: '<p>This quiz tests your understanding of Python basics including variables, data types, and functions.</p><p>You have unlimited attempts and no time limit. Good luck!</p>',
      timeopen: null, // Always open
      timeclose: null,
      timelimit: null, // No time limit
      overduehandling: 'autosubmit',
      graceperiod: 300, // 5 minutes grace period
      preferredbehaviour: 'deferredfeedback',
      canredoquestions: false,
      attempts: 3,
      grademethod: GradeMethod.HIGHEST,
      decimalpoints: 2,
      questiondecimalpoints: 2,
      reviewattempt: true,
      reviewcorrectness: true,
      reviewmarks: true,
      reviewspecificfeedback: true,
      reviewgeneralfeedback: true,
      reviewrightanswer: true,
      reviewoverallfeedback: true,
      questionsperpage: 5,
      navmethod: 'free',
      shuffleanswers: true,
      sumgrades: 100,
      grade: 100,
      courseid: 1,
      questioncount: 10,
      estimatedduration: 25,
      userattempts: {
        attemptsmade: 1,
        attemptsallowed: 3,
        bestgrade: 75.5,
        lastattempt: Math.floor(Date.now() / 1000) - 86400, // 1 day ago (Unix timestamp in seconds)
      },
      haspassword: false,
      hasipaddress: false,
      requiressafebrowser: false,
    },
  ],
  [
    202,
    {
      id: 202,
      name: 'Midterm Exam: Programming Concepts',
      intro: '<p>This is a timed midterm examination covering all topics from weeks 1-6.</p><p><strong>Important:</strong> You have 60 minutes to complete this quiz and only 2 attempts are allowed.</p>',
      timeopen: Math.floor(Date.now() / 1000) - 604800, // Opened 1 week ago (Unix timestamp in seconds)
      timeclose: Math.floor(Date.now() / 1000) + 604800, // Closes in 1 week (Unix timestamp in seconds)
      timelimit: 3600, // 60 minutes
      overduehandling: 'graceperiod',
      graceperiod: 600, // 10 minutes
      preferredbehaviour: 'immediatefeedback',
      canredoquestions: true,
      attempts: 2, // Maximum 2 attempts
      grademethod: GradeMethod.HIGHEST, // Highest grade
      decimalpoints: 1,
      questiondecimalpoints: 1,
      reviewattempt: true,
      reviewcorrectness: false, // Don't show correctness until after close
      reviewmarks: true,
      reviewspecificfeedback: false,
      reviewgeneralfeedback: true,
      reviewrightanswer: false,
      reviewoverallfeedback: true,
      questionsperpage: 1,
      navmethod: 'seq', // Sequential navigation
      shuffleanswers: true,
      sumgrades: 50,
      grade: 100,
      courseid: 1,
      questioncount: 10,
      estimatedduration: 55,
      userattempts: {
        attemptsmade: 0,
        attemptsallowed: 0, // Unlimited
        bestgrade: null,
        lastattempt: null,
      },
      haspassword: false,
      hasipaddress: false,
      requiressafebrowser: false,
    },
  ],
  [
    203,
    {
      id: 203,
      name: 'Practice Quiz: Python Syntax',
      intro: '<p>Practice your Python syntax knowledge with this self-paced quiz.</p><p>You have unlimited attempts and will receive immediate feedback after each question.</p>',
      timeopen: Math.floor(Date.now() / 1000) - 86400 * 14, // Opened 14 days ago (Unix timestamp in seconds)
      timeclose: 0, // Never closes
      timelimit: 0, // No time limit
      overduehandling: 'autoabandon',
      graceperiod: null,
      preferredbehaviour: 'immediatefeedback',
      canredoquestions: true,
      attempts: 0, // Unlimited attempts
      grademethod: GradeMethod.LAST, // Last attempt
      decimalpoints: 2,
      questiondecimalpoints: 2,
      reviewattempt: true,
      reviewcorrectness: true,
      reviewmarks: true,
      reviewspecificfeedback: true,
      reviewgeneralfeedback: true,
      reviewrightanswer: true,
      reviewoverallfeedback: true,
      questionsperpage: 1,
      navmethod: 'free',
      shuffleanswers: true,
      sumgrades: 5,
      grade: 5,
      courseid: 1,
      questioncount: 5,
      estimatedduration: 10,
      userattempts: {
        attemptsmade: 0,
        attemptsallowed: 0, // Unlimited
        bestgrade: null,
        lastattempt: null,
      },
      haspassword: false,
      hasipaddress: false,
      requiressafebrowser: false,
    },
  ],
  [
    204,
    {
      id: 204,
      name: 'Final Project: Programming Concepts',
      intro: '<p>This quiz assesses your understanding of advanced programming concepts through essay questions.</p><p>All questions require detailed written responses and will be manually graded by your instructor.</p>',
      timeopen: Math.floor(Date.now() / 1000) - 86400, // Opened 1 day ago (Unix timestamp in seconds)
      timeclose: Math.floor(Date.now() / 1000) + 1209600, // Closes in 14 days (Unix timestamp in seconds)
      timelimit: 7200, // 2 hours
      overduehandling: 'autosubmit',
      graceperiod: 0,
      preferredbehaviour: 'deferredfeedback',
      canredoquestions: false,
      attempts: 1, // Single attempt only
      grademethod: GradeMethod.FIRST,
      decimalpoints: 2,
      questiondecimalpoints: 2,
      reviewattempt: true,
      reviewcorrectness: true,
      reviewmarks: true,
      reviewspecificfeedback: true,
      reviewgeneralfeedback: true,
      reviewrightanswer: false,
      reviewoverallfeedback: true,
      questionsperpage: 1,
      navmethod: 'free',
      shuffleanswers: false,
      sumgrades: 30,
      grade: 30,
      courseid: 1,
      questioncount: 3,
      estimatedduration: 115,
      userattempts: {
        attemptsmade: 0,
        attemptsallowed: 1,
        bestgrade: null,
        lastattempt: null,
      },
      haspassword: false,
      hasipaddress: false,
      requiressafebrowser: false,
    },
  ],
]);

/**
 * Mock attempts database - tracks all quiz attempts
 */
const mockAttempts: Map<number, QuizAttempt> = new Map([
  [
    1,
    {
      id: 1,
      quiz: 201,
      userid: 1,
      attempt: 1,
      uniqueid: 1001,
      layout: '1,2,3,4,5,0,6,7,8,9,10', // 0 indicates page break
      currentpage: 0,
      preview: false,
      state: 'inprogress',
      timestart: Math.floor(Date.now() / 1000) - 600, // Started 10 minutes ago (Unix timestamp in seconds)
      timefinish: null,
      timemodified: Math.floor(Date.now() / 1000) - 600, // Unix timestamp in seconds
      timecheckstate: null,
      sumgrades: null,
      gradednotificationsenttime: null,
    },
  ],
]);

/**
 * Helper function to convert fixture QuizQuestion to MSW Question format
 */
function convertFixtureQuestionToMSW(fixtureQuestion: FixtureQuizQuestion): Question {
  const baseQuestion: Question = {
    slot: fixtureQuestion.slot,
    questionid: fixtureQuestion.id,
    type: fixtureQuestion.type as Question['type'],
    questiontext: fixtureQuestion.questiontext,
    questiontextformat: 1,
    generalfeedback: fixtureQuestion.feedback ?? '',
    defaultmark: fixtureQuestion.defaultmark,
    maxmark: fixtureQuestion.defaultmark,
    page: 0,
    answered: false,
    flagged: false,
    mark: null,
    state: 'notanswered',
  };

  // Convert answers based on question type
  if (fixtureQuestion.type === 'multichoice' && fixtureQuestion.answers) {
    baseQuestion.options = {
      single: true,
      shuffleanswers: true,
      answers: fixtureQuestion.answers.map(ans => ({
        id: ans.id,
        answer: ans.text,
        fraction: ans.fraction,
        feedback: ans.feedback ?? '',
      })),
    } as MultichoiceOptions;
  } else if (fixtureQuestion.type === 'truefalse' && fixtureQuestion.answers) {
    const trueAnswer = fixtureQuestion.answers.find(a => a.text.toLowerCase() === 'true');
    const falseAnswer = fixtureQuestion.answers.find(a => a.text.toLowerCase() === 'false');
    baseQuestion.options = {
      truefeedback: trueAnswer?.feedback ?? '',
      falsefeedback: falseAnswer?.feedback ?? '',
    } as TrueFalseOptions;
  } else if (fixtureQuestion.type === 'shortanswer' && fixtureQuestion.correctanswer) {
    baseQuestion.options = {
      usecase: false,
      answers: [
        {
          answer: String(fixtureQuestion.correctanswer),
          fraction: 1.0,
          feedback: 'Correct!',
        },
      ],
    } as ShortAnswerOptions;
  } else if (fixtureQuestion.type === 'essay') {
    baseQuestion.options = {
      responseformat: fixtureQuestion.responseformat ?? 'editor',
      responserequired: true,
      responsefieldlines: 15,
      attachments: 0,
      attachmentsrequired: 0,
    } as EssayOptions;
  }

  return baseQuestion;
}

/**
 * Transform MSW Question format to frontend QuizQuestion format
 * Converts complex options object to simple options array expected by frontend
 */
function transformQuestionForFrontend(question: Question): TransformedQuestion {
  const baseTransformed: TransformedQuestion = {
    id: question.questionid,
    slot: question.slot,
    type: question.type,
    questiontext: question.questiontext,
    defaultmark: question.defaultmark,
    maxmark: question.maxmark,
    answered: question.answered,
    flagged: question.flagged,
    mark: question.mark,
    state: question.state,
    generalfeedback: question.generalfeedback,
    options: [], // Will be populated based on question type
  };

  // Transform options based on question type
  if (question.type === 'multichoice' && question.options) {
    const mcOptions = question.options as MultichoiceOptions;
    // Convert MultichoiceOptions.answers to simple options array
    baseTransformed.options = mcOptions.answers.map(ans => ({
      id: ans.id,
      text: ans.answer,
      correct: ans.fraction === 1.0,
    }));
  } else if (question.type === 'truefalse' && question.options) {
    // Convert TrueFalseOptions to two simple options
    baseTransformed.options = [
      { id: 1, text: 'True', correct: false },
      { id: 2, text: 'False', correct: false },
    ];
  } else if (question.type === 'shortanswer' && question.options) {
    const saOptions = question.options as ShortAnswerOptions;
    // For shortanswer, we don't show options in the UI
    baseTransformed.options = [];
    baseTransformed.correctanswer = saOptions.answers[0]?.answer;
  } else if (question.type === 'essay') {
    // Essay questions don't have options
    baseTransformed.options = [];
  } else {
    // Default: empty options array
    baseTransformed.options = [];
  }

  return baseTransformed;
}

/**
 * Mock questions database - various question types for testing
 * Quiz ID 201 uses questions from E2E test fixtures for consistency
 */
const mockQuestions: Map<number, Question[]> = new Map([
  [
    201, // Quiz ID 201 - Python Fundamentals with all 4 questions from testQuiz1 fixture
    testQuiz1.questions.map(q => convertFixtureQuestionToMSW(q)),
  ],
  [
    202, // Quiz ID 202 - Midterm Exam with all 10 questions from testQuiz2 fixture
    testQuiz2.questions.map(q => convertFixtureQuestionToMSW(q)),
  ],
  [
    203, // Quiz ID 203 - Practice Quiz with all 5 questions from testQuiz3 fixture
    testQuiz3.questions.map(q => convertFixtureQuestionToMSW(q)),
  ],
]);

/**
 * Helper function to add network latency to responses
 */
const addLatency = () => new Promise(resolve => setTimeout(resolve, Math.random() * 300 + 100));

/**
 * Helper function to calculate grade based on grade method
 */
const calculateFinalGrade = (attempts: number[], method: GradeMethod): number => {
  if (attempts.length === 0) {return 0;}
  
  switch (method) {
    case GradeMethod.HIGHEST:
      return Math.max(...attempts);
    case GradeMethod.AVERAGE:
      return attempts.reduce((a, b) => a + b, 0) / attempts.length;
    case GradeMethod.FIRST:
      return attempts[0] ?? 0;
    case GradeMethod.LAST:
      return attempts[attempts.length - 1] ?? 0;
    default:
      return Math.max(...attempts);
  }
};

/**
 * Helper function to get feedback based on grade percentage
 */
const getOverallFeedback = (percentage: number): string => {
  if (percentage >= 90) {
    return '<p>Excellent work! You have demonstrated a strong understanding of the material.</p>';
  } else if (percentage >= 80) {
    return '<p>Very good! You have a solid grasp of the concepts.</p>';
  } else if (percentage >= 70) {
    return '<p>Good effort. You understand most of the material but could benefit from further review.</p>';
  } else if (percentage >= 60) {
    return '<p>Satisfactory. Consider reviewing the material to strengthen your understanding.</p>';
  } else if (percentage >= 50) {
    return '<p>You have a basic understanding but need more practice. Please review the course material.</p>';
  } 
    return '<p>Additional study is needed. Please review the course material and consider seeking help from your instructor.</p>';
  
};

/**
 * MSW Request Handlers for Quiz API Endpoints
 */
export const quizzesHandlers = [
  /**
   * GET /api/v1/quizzes/:id - Get quiz details
   * Returns comprehensive quiz information including settings, restrictions, and user attempts
   */
  http.get('/api/v1/quizzes/:id', async ({ params }) => {
    await addLatency();

    const quizId = Number(params.id);
    const quiz = mockQuizzes.get(quizId);

    // Simulate not found error
    if (!quiz) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'QUIZ_NOT_FOUND',
            message: 'Quiz not found',
            details: { quizId },
          },
        },
        { status: 404 }
      );
    }

    // Simulate access denied for password-protected quiz (quiz 2 and 3)
    // In real implementation, this would check if password has been provided
    const isPasswordProvided = false; // Simulate password not provided
    if (quiz.haspassword && !isPasswordProvided && quizId !== 1) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'PASSWORD_REQUIRED',
            message: 'This quiz requires a password',
            details: { quizId },
          },
        },
        { status: 403 }
      );
    }

    // Simulate quiz not yet open
    if (quiz.timeopen && Math.floor(Date.now() / 1000) < quiz.timeopen) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'QUIZ_NOT_OPEN',
            message: 'This quiz is not yet open',
            details: {
              quizId,
              timeopen: quiz.timeopen,
            },
          },
        },
        { status: 403 }
      );
    }

    // Get user's attempts for this quiz
    const userAttempts = Array.from(mockAttempts.values()).filter(
      (attempt) => attempt.quiz === quizId && attempt.userid === 1
    );

    // Calculate attempts used and remaining
    const attemptsUsed = userAttempts.length;
    const attemptsRemaining = quiz.attempts === 0 ? null : quiz.attempts - attemptsUsed;

    // Determine if user can attempt quiz
    const canAttempt = quiz.attempts === 0 || (attemptsRemaining ?? 0) > 0;

    return HttpResponse.json({
      success: true,
      data: {
        quiz,
        attempts: userAttempts,
        canAttempt,
        canPreview: true, // Always allow preview for testing
        attemptsUsed,
        attemptsRemaining,
      },
      meta: {},
    });
  }),

  /**
   * POST /api/v1/quizzes/:id/attempt - Create new quiz attempt
   * Validates eligibility and creates a new attempt for the student
   */
  http.post('/api/v1/quizzes/:id/attempt', async ({ params, request }) => {
    await addLatency();

    const quizId = Number(params.id);
    const quiz = mockQuizzes.get(quizId);
    
    // Safely parse request body (may be empty for simple attempt start)
    let body: { password?: string; preview?: boolean } = {};
    try {
      const text = await request.text();
      if (text?.trim()) {
        body = JSON.parse(text) as { password?: string; preview?: boolean };
      }
    } catch (error) {
      // Ignore JSON parse errors, use empty body
      console.warn('[MSW] Failed to parse request body for quiz attempt, using empty body:', error);
    }

    if (!quiz) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'QUIZ_NOT_FOUND',
            message: 'Quiz not found',
            details: { quizId },
          },
        },
        { status: 404 }
      );
    }

    // Check if quiz requires password
    if (quiz.haspassword && !body.password && !body.preview) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'PASSWORD_REQUIRED',
            message: 'Password required to start this quiz',
            details: { quizId },
          },
        },
        { status: 422 }
      );
    }

    // Check if quiz is closed
    if (quiz.timeclose && Math.floor(Date.now() / 1000) > quiz.timeclose) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'QUIZ_CLOSED',
            message: 'This quiz is no longer available',
            details: {
              quizId,
              timeclose: quiz.timeclose,
            },
          },
        },
        { status: 403 }
      );
    }

    // Check attempts exhausted
    if (quiz.attempts > 0 && quiz.userattempts && quiz.userattempts.attemptsmade >= quiz.attempts) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'ATTEMPTS_EXHAUSTED',
            message: 'You have used all your allowed attempts',
            details: {
              quizId,
              attemptsmade: quiz.userattempts.attemptsmade,
              attemptsallowed: quiz.attempts,
            },
          },
        },
        { status: 403 }
      );
    }

    // Create new attempt
    const attemptNumber = (quiz.userattempts?.attemptsmade ?? 0) + 1;
    const newAttemptId = mockAttempts.size + 1;
    const newAttempt: QuizAttempt = {
      id: newAttemptId,
      quiz: quizId,
      userid: 1, // Mock user ID
      attempt: attemptNumber,
      uniqueid: 1000 + newAttemptId,
      layout: Array.from({ length: quiz.questioncount }, (_, i) => i + 1).join(','),
      currentpage: 0,
      preview: body.preview ?? false,
      state: 'inprogress',
      timestart: Math.floor(Date.now() / 1000), // Unix timestamp in seconds
      timefinish: null,
      timemodified: Math.floor(Date.now() / 1000), // Unix timestamp in seconds
      timecheckstate: null,
      sumgrades: null,
      gradednotificationsenttime: null,
    };

    mockAttempts.set(newAttemptId, newAttempt);

    // Get questions for this quiz
    const questions = mockQuestions.get(quizId) ?? [];
    
    // Debug logging to verify questions are being returned
    // eslint-disable-next-line no-console
    console.log(`[MSW] Creating quiz attempt for quiz ${quizId}`);
    // eslint-disable-next-line no-console
    console.log(`[MSW] Found ${questions.length} questions for quiz ${quizId}`);
    if (questions.length > 0) {
      // eslint-disable-next-line no-console
      console.log('[MSW] First question (before transform):', JSON.stringify(questions[0], null, 2));
    }
    
    // Transform questions to frontend format
    const transformedQuestions = questions.map(transformQuestionForFrontend);
    
    if (transformedQuestions.length > 0) {
      // eslint-disable-next-line no-console
      console.log('[MSW] First question (after transform):', JSON.stringify(transformedQuestions[0], null, 2));
    }
    
    // Calculate time remaining
    const timeRemaining = quiz.timelimit 
      ? quiz.timelimit 
      : 0;

    return HttpResponse.json({
      success: true,
      data: {
        attempt: newAttempt,
        questions: transformedQuestions,
        timeRemaining,
      },
      meta: {},
    });
  }),

  /**
   * GET /api/v1/quizzes/:id/questions - Get questions for current page
   * Returns paginated questions for the quiz attempt
   */
  http.get('/api/v1/quizzes/:id/questions', async ({ params, request }) => {
    await addLatency();

    const quizId = Number(params.id);
    const url = new URL(request.url);
    const attemptId = Number(url.searchParams.get('attemptid') ?? url.searchParams.get('attemptId'));
    const page = Number(url.searchParams.get('page') ?? '0');

    const quiz = mockQuizzes.get(quizId);
    const attempt = mockAttempts.get(attemptId);
    const questions = mockQuestions.get(quizId);

    if (!quiz || !attempt || !questions) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Quiz, attempt, or questions not found',
            details: { quizId, attemptId },
          },
        },
        { status: 404 }
      );
    }

    // Calculate questions for the current page
    const questionsPerPage = quiz.questionsperpage || 1;
    const startIndex = page * questionsPerPage;
    const endIndex = startIndex + questionsPerPage;
    const pageQuestions = questions.slice(startIndex, endIndex);
    const totalPages = Math.ceil(questions.length / questionsPerPage);

    // Transform questions to frontend format
    const transformedPageQuestions = pageQuestions.map(transformQuestionForFrontend);

    return HttpResponse.json({
      success: true,
      data: transformedPageQuestions,
      meta: {
        currentpage: page,
        totalpages: totalPages,
        navmethod: quiz.navmethod,
        timeremaining: quiz.timelimit ? quiz.timelimit - (Math.floor(Date.now() / 1000) - attempt.timestart) : null,
        pagination: {
          page: page + 1,
          perPage: questionsPerPage,
          total: questions.length,
          totalPages,
        },
      },
    });
  }),

  /**
   * POST /api/v1/quizzes/:id/submit - Submit answers
   * Handles both auto-save and final submission of quiz answers
   */
  http.post('/api/v1/quizzes/:id/submit', async ({ params, request }) => {
    await addLatency();

    const quizId = Number(params.id);
    const body = await request.json() as {
      attemptId?: number;
      attemptid?: number;
      answers: Record<number, unknown>;
      finalize: boolean;
    };

    const attemptId = body.attemptId ?? body.attemptid;
    const quiz = mockQuizzes.get(quizId);
    const attempt = mockAttempts.get(attemptId ?? 0);

    if (!quiz || !attempt) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Quiz or attempt not found',
            details: { quizId, attemptId },
          },
        },
        { status: 404 }
      );
    }

    // Check if time has expired
    if (quiz.timelimit) {
      const timeElapsed = Math.floor(Date.now() / 1000) - attempt.timestart;
      if (timeElapsed > quiz.timelimit) {
        return HttpResponse.json(
          {
            success: false,
            error: {
              code: 'TIME_EXPIRED',
              message: 'Time limit exceeded',
              details: {
                timelimit: quiz.timelimit,
                timeelapsed: timeElapsed,
              },
            },
          },
          { status: 422 }
        );
      }
    }

    // For finalize, calculate grades
    if (body.finalize) {
      // Mock grade calculation
      const sumGrades = 75.5; // Simplified for mock
      attempt.state = 'finished';
      attempt.timefinish = Math.floor(Date.now() / 1000); // Unix timestamp in seconds
      attempt.sumgrades = sumGrades;
      attempt.timemodified = Math.floor(Date.now() / 1000); // Unix timestamp in seconds

      return HttpResponse.json({
        success: true,
        data: {
          attemptid: attempt.id,
          state: attempt.state,
          timefinish: attempt.timefinish,
          sumgrades: attempt.sumgrades,
          message: 'Quiz submitted successfully',
        },
        meta: {},
      });
    } 
      // Auto-save
      attempt.timemodified = Math.floor(Date.now() / 1000); // Unix timestamp in seconds
      return HttpResponse.json({
        success: true,
        data: {
          attemptid: attempt.id,
          state: attempt.state,
          message: 'Answers saved',
        },
        meta: {},
      });
    
  }),

  /**
   * GET /api/v1/quizzes/attempts/:id/results - Get attempt results
   * Returns graded results for a completed attempt
   */
  http.get('/api/v1/quizzes/attempts/:id/results', async ({ params }) => {
    await addLatency();

    const attemptId = Number(params.id);
    const attempt = mockAttempts.get(attemptId);

    if (!attempt) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'ATTEMPT_NOT_FOUND',
            message: 'Attempt not found',
            details: { attemptId },
          },
        },
        { status: 404 }
      );
    }

    if (attempt.state !== 'finished') {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'ATTEMPT_NOT_FINISHED',
            message: 'This attempt is not yet finished',
            details: { attemptId, state: attempt.state },
          },
        },
        { status: 400 }
      );
    }

    const quiz = mockQuizzes.get(attempt.quiz);
    if (!quiz) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'QUIZ_NOT_FOUND',
            message: 'Associated quiz not found',
            details: { quizId: attempt.quiz },
          },
        },
        { status: 404 }
      );
    }

    // Check review permissions
    if (!quiz.reviewattempt) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'REVIEW_NOT_ALLOWED',
            message: 'Review is not allowed for this quiz',
            details: { attemptId },
          },
        },
        { status: 403 }
      );
    }

    const sumgrades = attempt.sumgrades ?? 0;
    const percentage = (sumgrades / quiz.sumgrades) * 100;
    const grade = (percentage / 100) * quiz.grade;

    return HttpResponse.json({
      success: true,
      data: {
        attemptid: attempt.id,
        quiz: attempt.quiz,
        state: attempt.state,
        timestart: attempt.timestart,
        timefinish: attempt.timefinish,
        sumgrades,
        maxgrade: quiz.sumgrades,
        grade: Number(grade.toFixed(quiz.decimalpoints)),
        percentage: Number(percentage.toFixed(2)),
        feedback: getOverallFeedback(percentage),
        reviewoptions: {
          attempt: quiz.reviewattempt,
          correctness: quiz.reviewcorrectness,
          marks: quiz.reviewmarks,
          specificfeedback: quiz.reviewspecificfeedback,
          generalfeedback: quiz.reviewgeneralfeedback,
          rightanswer: quiz.reviewrightanswer,
          overallfeedback: quiz.reviewoverallfeedback,
        },
      },
      meta: {},
    });
  }),

  /**
   * GET /api/v1/quizzes/:id/attempts - List user's attempts
   * Returns all attempts for the specified quiz
   */
  http.get('/api/v1/quizzes/:id/attempts', async ({ params }) => {
    await addLatency();

    const quizId = Number(params.id);
    const quiz = mockQuizzes.get(quizId);

    if (!quiz) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'QUIZ_NOT_FOUND',
            message: 'Quiz not found',
            details: { quizId },
          },
        },
        { status: 404 }
      );
    }

    // Filter attempts for this quiz and user
    const userAttempts: AttemptSummary[] = [];
    mockAttempts.forEach((attempt) => {
      if (attempt.quiz === quizId && attempt.userid === 1) {
        const grade = attempt.sumgrades ? (attempt.sumgrades / quiz.sumgrades) * quiz.grade : null;
        userAttempts.push({
          id: attempt.id,
          quiz: attempt.quiz,
          attempt: attempt.attempt,
          state: attempt.state,
          timestart: attempt.timestart,
          timefinish: attempt.timefinish,
          sumgrades: attempt.sumgrades,
          grade: grade ? Number(grade.toFixed(quiz.decimalpoints)) : null,
          preview: attempt.preview,
        });
      }
    });

    // Sort by attempt number descending
    userAttempts.sort((a, b) => b.attempt - a.attempt);

    // Calculate best grade based on grade method
    const grades = userAttempts.filter(a => a.grade !== null).map(a => a.grade as number);
    const bestGrade = grades.length > 0 ? calculateFinalGrade(grades, quiz.grademethod) : null;

    return HttpResponse.json({
      success: true,
      data: userAttempts,
      meta: {
        summary: {
          attemptsmade: userAttempts.length,
          attemptsallowed: quiz.attempts === 0 ? 'unlimited' : quiz.attempts,
          bestgrade: bestGrade,
          grademethod: quiz.grademethod,
        },
      },
    });
  }),

  /**
   * GET /api/v1/quizzes/attempts/:id/review - Review completed attempt
   * Returns detailed review including questions, answers, and feedback
   */
  http.get('/api/v1/quizzes/attempts/:id/review', async ({ params }) => {
    await addLatency();

    const attemptId = Number(params.id);
    const attempt = mockAttempts.get(attemptId);

    if (!attempt) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'ATTEMPT_NOT_FOUND',
            message: 'Attempt not found',
            details: { attemptId },
          },
        },
        { status: 404 }
      );
    }

    if (attempt.state !== 'finished') {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'REVIEW_NOT_AVAILABLE',
            message: 'Review is only available for finished attempts',
            details: { attemptId, state: attempt.state },
          },
        },
        { status: 403 }
      );
    }

    const quiz = mockQuizzes.get(attempt.quiz);
    const questions = mockQuestions.get(attempt.quiz);

    if (!quiz || !questions) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'DATA_NOT_FOUND',
            message: 'Quiz or questions not found',
            details: { quizId: attempt.quiz },
          },
        },
        { status: 404 }
      );
    }

    // Build detailed review with questions and answers
    const reviewQuestions = questions.map((q) => {
      // Mock user answer and correct answer
      let userAnswer: number | string | boolean | null = null;
      let correctAnswer: number | string | boolean | null = null;
      let mark = 0;

      if (q.type === 'multichoice') {
        const opts = q.options as MultichoiceOptions;
        // Simulate user selecting first answer
        userAnswer = opts.answers[0]?.id ?? null;
        correctAnswer = opts.answers.find(a => a.fraction === 1.0)?.id ?? null;
        mark = (opts.answers[0]?.fraction ?? 0) * q.maxmark;
      } else if (q.type === 'truefalse') {
        userAnswer = false;
        correctAnswer = true;
        mark = 0;
      } else if (q.type === 'shortanswer') {
        userAnswer = 'setState';
        correctAnswer = 'setState';
        mark = q.maxmark;
      }

      const isCorrect = mark === q.maxmark;

      // Transform to frontend format and add review-specific properties
      const transformed = transformQuestionForFrontend(q);
      return {
        ...transformed,
        userAnswer,
        correctAnswer: quiz.reviewrightanswer ? correctAnswer : null,
        feedback: quiz.reviewspecificfeedback ? 'Good attempt.' : '',
        mark: quiz.reviewmarks ? mark : 0,
        maxMark: q.maxmark,
        isCorrect,
      };
    });

    const sumgrades = attempt.sumgrades ?? 0;
    const percentage = (sumgrades / quiz.sumgrades) * 100;
    const grade = (percentage / 100) * quiz.grade;

    // Transform quiz to frontend format
    const transformedQuiz = {
      id: quiz.id,
      course: quiz.courseid,
      name: quiz.name,
      intro: quiz.intro,
      timeOpen: quiz.timeopen,
      timeClose: quiz.timeclose,
      timeLimit: quiz.timelimit,
      overdueHandling: quiz.overduehandling,
      gracePeriod: quiz.graceperiod,
      preferredBehaviour: quiz.preferredbehaviour,
      canRedoQuestions: quiz.canredoquestions,
      attemptsAllowed: quiz.attempts,
      gradeMethod: quiz.grademethod,
      decimalPoints: quiz.decimalpoints,
      questionDecimalPoints: quiz.questiondecimalpoints,
      reviewAttempt: quiz.reviewattempt,
      reviewCorrectness: quiz.reviewcorrectness,
      reviewMarks: quiz.reviewmarks,
      reviewSpecificFeedback: quiz.reviewspecificfeedback,
      reviewGeneralFeedback: quiz.reviewgeneralfeedback,
      reviewRightAnswer: quiz.reviewrightanswer,
      reviewOverallFeedback: quiz.reviewoverallfeedback,
      questionsPerPage: quiz.questionsperpage,
      navMethod: quiz.navmethod,
      shuffleAnswers: quiz.shuffleanswers,
      sumGrades: quiz.sumgrades,
      grade: quiz.grade,
      hasQuestions: true,
    };

    return HttpResponse.json({
      success: true,
      data: {
        attempt: {
          id: attempt.id,
          quiz: attempt.quiz,
          attempt: attempt.attempt,
          state: attempt.state,
          timestart: attempt.timestart,
          timefinish: attempt.timefinish,
          sumgrades,
          grade,
        },
        quiz: transformedQuiz,
        questions: reviewQuestions,
        grade,
        maxGrade: quiz.grade,
        percentage,
        feedback: quiz.reviewoverallfeedback ? getOverallFeedback(percentage) : '',
      },
      meta: {},
    });
  }),

  /**
   * GET /api/v1/quizzes/attempts/:id/summary - Get attempt summary
   * Returns overview of all questions before final submission
   */
  http.get('/api/v1/quizzes/attempts/:id/summary', async ({ params }) => {
    await addLatency();

    const attemptId = Number(params.id);
    const attempt = mockAttempts.get(attemptId);

    if (!attempt) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'ATTEMPT_NOT_FOUND',
            message: 'Attempt not found',
            details: { attemptId },
          },
        },
        { status: 404 }
      );
    }

    const quiz = mockQuizzes.get(attempt.quiz);
    const questions = mockQuestions.get(attempt.quiz);

    if (!quiz || !questions) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'DATA_NOT_FOUND',
            message: 'Quiz or questions not found',
            details: { quizId: attempt.quiz },
          },
        },
        { status: 404 }
      );
    }

    // Build summary of questions with answered/flagged status
    const questionsSummary = questions.map((q) => ({
      slot: q.slot,
      questionid: q.questionid,
      page: q.page,
      answered: q.answered,
      flagged: q.flagged,
      type: q.type,
      maxmark: q.maxmark,
    }));

    const answeredCount = questionsSummary.filter(q => q.answered).length;
    const flaggedCount = questionsSummary.filter(q => q.flagged).length;
    const unansweredCount = questionsSummary.length - answeredCount;

    // Calculate time remaining
    const timeElapsed = Math.floor(Date.now() / 1000) - attempt.timestart;
    const timeRemaining = quiz.timelimit ? quiz.timelimit - timeElapsed : null;

    return HttpResponse.json({
      success: true,
      data: {
        attemptid: attempt.id,
        questions: questionsSummary,
        summary: {
          totalquestions: questionsSummary.length,
          answered: answeredCount,
          unanswered: unansweredCount,
          flagged: flaggedCount,
        },
        timing: {
          timestart: attempt.timestart,
          timeelapsed: timeElapsed,
          timeremaining: timeRemaining,
          timelimit: quiz.timelimit,
        },
      },
      meta: {},
    });
  }),
];
