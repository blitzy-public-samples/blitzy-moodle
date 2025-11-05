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
  grademethod: 'highest' | 'average' | 'first' | 'last';
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
    1,
    {
      id: 1,
      name: 'Introduction to React Quiz',
      intro: '<p>Test your knowledge of React fundamentals including components, hooks, and state management.</p>',
      timeopen: null, // Always open
      timeclose: null,
      timelimit: 1800, // 30 minutes
      overduehandling: 'autosubmit',
      graceperiod: 300, // 5 minutes grace period
      preferredbehaviour: 'deferredfeedback',
      canredoquestions: false,
      attempts: 3,
      grademethod: 'highest',
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
        lastattempt: Date.now() - 86400000, // 1 day ago
      },
      haspassword: false,
      hasipaddress: false,
      requiressafebrowser: false,
    },
  ],
  [
    2,
    {
      id: 2,
      name: 'Advanced TypeScript Assessment',
      intro: '<p>Comprehensive assessment covering advanced TypeScript features including generics, type guards, and decorators.</p>',
      timeopen: Date.now() - 604800000, // Opened 1 week ago
      timeclose: Date.now() + 604800000, // Closes in 1 week
      timelimit: 3600, // 60 minutes
      overduehandling: 'graceperiod',
      graceperiod: 600, // 10 minutes
      preferredbehaviour: 'immediatefeedback',
      canredoquestions: true,
      attempts: 0, // Unlimited
      grademethod: 'average',
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
      questioncount: 15,
      estimatedduration: 55,
      userattempts: {
        attemptsmade: 0,
        attemptsallowed: 0, // Unlimited
        bestgrade: null,
        lastattempt: null,
      },
      haspassword: true,
      hasipaddress: false,
      requiressafebrowser: false,
    },
  ],
  [
    3,
    {
      id: 3,
      name: 'Final Exam - Web Development',
      intro: '<p>Comprehensive final exam covering all topics from the course. This exam is timed and can only be attempted once.</p>',
      timeopen: Date.now() - 86400000, // Opened yesterday
      timeclose: Date.now() + 172800000, // Closes in 2 days
      timelimit: 7200, // 2 hours
      overduehandling: 'autoabandon',
      graceperiod: null,
      preferredbehaviour: 'deferredfeedback',
      canredoquestions: false,
      attempts: 1, // Only one attempt allowed
      grademethod: 'first',
      decimalpoints: 2,
      questiondecimalpoints: 2,
      reviewattempt: false, // No review until after close
      reviewcorrectness: false,
      reviewmarks: false,
      reviewspecificfeedback: false,
      reviewgeneralfeedback: false,
      reviewrightanswer: false,
      reviewoverallfeedback: false,
      questionsperpage: 10,
      navmethod: 'free',
      shuffleanswers: true,
      sumgrades: 200,
      grade: 200,
      courseid: 1,
      questioncount: 50,
      estimatedduration: 110,
      userattempts: {
        attemptsmade: 0,
        attemptsallowed: 1,
        bestgrade: null,
        lastattempt: null,
      },
      haspassword: true,
      hasipaddress: true,
      requiressafebrowser: true,
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
      quiz: 1,
      userid: 1,
      attempt: 1,
      uniqueid: 1001,
      layout: '1,2,3,4,5,0,6,7,8,9,10', // 0 indicates page break
      currentpage: 0,
      preview: false,
      state: 'inprogress',
      timestart: Date.now() - 600000, // Started 10 minutes ago (600 seconds * 1000ms)
      timefinish: null,
      timemodified: Date.now() - 600000,
      timecheckstate: null,
      sumgrades: null,
      gradednotificationsenttime: null,
    },
  ],
]);

/**
 * Mock questions database - various question types for testing
 */
const mockQuestions: Map<number, Question[]> = new Map([
  [
    1, // Quiz ID 1
    [
      {
        slot: 1,
        questionid: 101,
        type: 'multichoice',
        questiontext: '<p>What is the purpose of the useState hook in React?</p>',
        questiontextformat: 1,
        generalfeedback: '<p>useState is a React Hook that lets you add state to function components.</p>',
        defaultmark: 10,
        maxmark: 10,
        page: 0,
        options: {
          single: true,
          shuffleanswers: true,
          answers: [
            {
              id: 1,
              answer: 'To manage component state in functional components',
              fraction: 1.0,
              feedback: 'Correct! useState allows functional components to have state.',
            },
            {
              id: 2,
              answer: 'To create class components',
              fraction: 0,
              feedback: 'Incorrect. useState is used in functional components, not class components.',
            },
            {
              id: 3,
              answer: 'To make API calls',
              fraction: 0,
              feedback: 'Incorrect. Use useEffect for side effects like API calls.',
            },
            {
              id: 4,
              answer: 'To define component props',
              fraction: 0,
              feedback: 'Incorrect. Props are passed from parent components, not defined with useState.',
            },
          ],
        } as MultichoiceOptions,
        answered: false,
        flagged: false,
        mark: null,
        state: 'notanswered',
      },
      {
        slot: 2,
        questionid: 102,
        type: 'truefalse',
        questiontext: '<p>React components must always have a render method.</p>',
        questiontextformat: 1,
        generalfeedback: '<p>Functional components do not need a render method, only class components do.</p>',
        defaultmark: 10,
        maxmark: 10,
        page: 0,
        options: {
          truefeedback: 'Incorrect. Functional components do not have a render method.',
          falsefeedback: 'Correct! Only class components require a render method.',
        } as TrueFalseOptions,
        answered: false,
        flagged: false,
        mark: null,
        state: 'notanswered',
      },
      {
        slot: 3,
        questionid: 103,
        type: 'shortanswer',
        questiontext: '<p>What method is used to update state in a class component? (one word)</p>',
        questiontextformat: 1,
        generalfeedback: '<p>The setState method is used to update component state in class components.</p>',
        defaultmark: 10,
        maxmark: 10,
        page: 0,
        options: {
          usecase: false,
          answers: [
            {
              answer: 'setState',
              fraction: 1.0,
              feedback: 'Correct!',
            },
            {
              answer: 'setstate',
              fraction: 1.0,
              feedback: 'Correct! (case insensitive)',
            },
          ],
        } as ShortAnswerOptions,
        answered: false,
        flagged: false,
        mark: null,
        state: 'notanswered',
      },
      {
        slot: 4,
        questionid: 104,
        type: 'essay',
        questiontext: '<p>Explain the concept of "lifting state up" in React and when you should use it. Provide an example.</p>',
        questiontextformat: 1,
        generalfeedback: '<p>Lifting state up involves moving state to the nearest common ancestor component when multiple components need to share that state.</p>',
        defaultmark: 20,
        maxmark: 20,
        page: 0,
        options: {
          responseformat: 'editor',
          responserequired: true,
          responsefieldlines: 15,
          attachments: 0,
          attachmentsrequired: 0,
        } as EssayOptions,
        answered: false,
        flagged: false,
        mark: null,
        state: 'notanswered',
      },
      {
        slot: 5,
        questionid: 105,
        type: 'matching',
        questiontext: '<p>Match each React Hook with its primary purpose:</p>',
        questiontextformat: 1,
        generalfeedback: '<p>Each hook has a specific purpose in React functional components.</p>',
        defaultmark: 10,
        maxmark: 10,
        page: 0,
        options: {
          shuffleanswers: true,
          subquestions: [
            {
              questiontext: 'useState',
              answertext: 'Manage component state',
            },
            {
              questiontext: 'useEffect',
              answertext: 'Handle side effects',
            },
            {
              questiontext: 'useContext',
              answertext: 'Access context values',
            },
            {
              questiontext: 'useReducer',
              answertext: 'Complex state logic',
            },
          ],
          choices: ['Manage component state', 'Handle side effects', 'Access context values', 'Complex state logic', 'Create refs'],
        } as MatchingOptions,
        answered: false,
        flagged: false,
        mark: null,
        state: 'notanswered',
      },
      {
        slot: 6,
        questionid: 106,
        type: 'numerical',
        questiontext: '<p>How many times will the effect run if you have useEffect with an empty dependency array []? (enter a number)</p>',
        questiontextformat: 1,
        generalfeedback: '<p>With an empty dependency array, useEffect runs exactly once after the initial render.</p>',
        defaultmark: 10,
        maxmark: 10,
        page: 1,
        options: {
          answers: [
            {
              answer: 1,
              fraction: 1.0,
              tolerance: 0,
              feedback: 'Correct! Once on mount.',
            },
          ],
          unitgradingtype: 'none',
          unitpenalty: 0,
        } as NumericalOptions,
        answered: false,
        flagged: false,
        mark: null,
        state: 'notanswered',
      },
      {
        slot: 7,
        questionid: 107,
        type: 'multichoice',
        questiontext: '<p>Which of the following are valid ways to pass data to a component? (Select all that apply)</p>',
        questiontextformat: 1,
        generalfeedback: '<p>Props, context, and state are all valid ways to provide data to React components.</p>',
        defaultmark: 10,
        maxmark: 10,
        page: 1,
        options: {
          single: false, // Multiple answers allowed
          shuffleanswers: true,
          answers: [
            {
              id: 1,
              answer: 'Props',
              fraction: 0.333,
              feedback: 'Correct!',
            },
            {
              id: 2,
              answer: 'Context',
              fraction: 0.333,
              feedback: 'Correct!',
            },
            {
              id: 3,
              answer: 'State',
              fraction: 0.334,
              feedback: 'Correct!',
            },
            {
              id: 4,
              answer: 'Global variables',
              fraction: -0.25,
              feedback: 'Incorrect. Avoid using global variables in React.',
            },
          ],
        } as MultichoiceOptions,
        answered: false,
        flagged: false,
        mark: null,
        state: 'notanswered',
      },
      {
        slot: 8,
        questionid: 108,
        type: 'truefalse',
        questiontext: '<p>The key prop is required when rendering lists in React.</p>',
        questiontextformat: 1,
        generalfeedback: '<p>Keys help React identify which items have changed, been added, or been removed.</p>',
        defaultmark: 10,
        maxmark: 10,
        page: 1,
        options: {
          truefeedback: 'Correct! Keys help React optimize re-renders.',
          falsefeedback: 'Incorrect. Keys are required for efficient list rendering.',
        } as TrueFalseOptions,
        answered: false,
        flagged: false,
        mark: null,
        state: 'notanswered',
      },
      {
        slot: 9,
        questionid: 109,
        type: 'shortanswer',
        questiontext: '<p>What JSX syntax is used to embed JavaScript expressions in markup?</p>',
        questiontextformat: 1,
        generalfeedback: '<p>Curly braces {} are used to embed JavaScript in JSX.</p>',
        defaultmark: 5,
        maxmark: 5,
        page: 1,
        options: {
          usecase: false,
          answers: [
            {
              answer: '{}',
              fraction: 1.0,
              feedback: 'Correct!',
            },
            {
              answer: 'curly braces',
              fraction: 1.0,
              feedback: 'Correct!',
            },
            {
              answer: 'braces',
              fraction: 1.0,
              feedback: 'Correct!',
            },
          ],
        } as ShortAnswerOptions,
        answered: false,
        flagged: false,
        mark: null,
        state: 'notanswered',
      },
      {
        slot: 10,
        questionid: 110,
        type: 'multichoice',
        questiontext: '<p>What will happen if you call setState multiple times in the same function?</p>',
        questiontextformat: 1,
        generalfeedback: '<p>React batches multiple setState calls for performance optimization.</p>',
        defaultmark: 5,
        maxmark: 5,
        page: 1,
        options: {
          single: true,
          shuffleanswers: true,
          answers: [
            {
              id: 1,
              answer: 'React will batch the updates and re-render once',
              fraction: 1.0,
              feedback: 'Correct! React automatically batches state updates.',
            },
            {
              id: 2,
              answer: 'The component will re-render for each setState call',
              fraction: 0,
              feedback: 'Incorrect. React batches updates in event handlers.',
            },
            {
              id: 3,
              answer: 'An error will be thrown',
              fraction: 0,
              feedback: 'Incorrect. Multiple setState calls are allowed.',
            },
            {
              id: 4,
              answer: 'Only the last setState will take effect',
              fraction: 0,
              feedback: 'Incorrect. All updates are applied, but batched together.',
            },
          ],
        } as MultichoiceOptions,
        answered: false,
        flagged: false,
        mark: null,
        state: 'notanswered',
      },
    ],
  ],
]);

/**
 * Helper function to add network latency to responses
 */
const addLatency = () => new Promise(resolve => setTimeout(resolve, Math.random() * 300 + 100));

/**
 * Helper function to calculate grade based on grade method
 */
const calculateFinalGrade = (attempts: number[], method: string): number => {
  if (attempts.length === 0) return 0;
  
  switch (method) {
    case 'highest':
      return Math.max(...attempts);
    case 'average':
      return attempts.reduce((a, b) => a + b, 0) / attempts.length;
    case 'first':
      return attempts[0]!;
    case 'last':
      return attempts[attempts.length - 1]!;
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
  } else {
    return '<p>Additional study is needed. Please review the course material and consider seeking help from your instructor.</p>';
  }
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
    if (quiz.timeopen && Date.now() < quiz.timeopen) {
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

    return HttpResponse.json({
      success: true,
      data: quiz,
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
    const body = await request.json() as { password?: string; preview?: boolean };

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
    if (quiz.timeclose && Date.now() > quiz.timeclose) {
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
    const attemptNumber = (quiz.userattempts?.attemptsmade || 0) + 1;
    const newAttemptId = mockAttempts.size + 1;
    const newAttempt: QuizAttempt = {
      id: newAttemptId,
      quiz: quizId,
      userid: 1, // Mock user ID
      attempt: attemptNumber,
      uniqueid: 1000 + newAttemptId,
      layout: Array.from({ length: quiz.questioncount }, (_, i) => i + 1).join(','),
      currentpage: 0,
      preview: body.preview || false,
      state: 'inprogress',
      timestart: Date.now(),
      timefinish: null,
      timemodified: Date.now(),
      timecheckstate: null,
      sumgrades: null,
      gradednotificationsenttime: null,
    };

    mockAttempts.set(newAttemptId, newAttempt);

    return HttpResponse.json({
      success: true,
      data: {
        id: newAttempt.id,
        attemptid: newAttempt.id,
        timestart: newAttempt.timestart,
        state: newAttempt.state,
        layout: newAttempt.layout,
        currentpage: newAttempt.currentpage,
        timelimit: quiz.timelimit,
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
    const attemptId = Number(url.searchParams.get('attemptid') || url.searchParams.get('attemptId'));
    const page = Number(url.searchParams.get('page') || '0');

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

    return HttpResponse.json({
      success: true,
      data: pageQuestions,
      meta: {
        currentpage: page,
        totalpages: totalPages,
        navmethod: quiz.navmethod,
        timeremaining: quiz.timelimit ? quiz.timelimit - Math.floor((Date.now() - attempt.timestart) / 1000) : null,
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
      answers: Record<number, any>;
      finalize: boolean;
    };

    const attemptId = body.attemptId || body.attemptid;
    const quiz = mockQuizzes.get(quizId);
    const attempt = mockAttempts.get(attemptId!);

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
      const timeElapsed = Math.floor((Date.now() - attempt.timestart) / 1000);
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
      attempt.timefinish = Date.now();
      attempt.sumgrades = sumGrades;
      attempt.timemodified = Date.now();

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
    } else {
      // Auto-save
      attempt.timemodified = Date.now();
      return HttpResponse.json({
        success: true,
        data: {
          attemptid: attempt.id,
          state: attempt.state,
          message: 'Answers saved',
        },
        meta: {},
      });
    }
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

    const sumgrades = attempt.sumgrades || 0;
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
        sumgrades: sumgrades,
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
    const grades = userAttempts.filter(a => a.grade !== null).map(a => a.grade!);
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
      let useranswer: any = null;
      let correctanswer: any = null;
      let markobtained = 0;

      if (q.type === 'multichoice') {
        const opts = q.options as MultichoiceOptions;
        // Simulate user selecting first answer
        useranswer = opts.answers[0]?.id;
        correctanswer = opts.answers.find(a => a.fraction === 1.0)?.id || null;
        markobtained = (opts.answers[0]?.fraction ?? 0) * q.maxmark;
      } else if (q.type === 'truefalse') {
        useranswer = false;
        correctanswer = true;
        markobtained = 0;
      } else if (q.type === 'shortanswer') {
        useranswer = 'setState';
        correctanswer = 'setState';
        markobtained = q.maxmark;
      }

      return {
        ...q,
        useranswer,
        correctanswer: quiz.reviewrightanswer ? correctanswer : null,
        feedback: quiz.reviewspecificfeedback ? 'Good attempt.' : '',
        markobtained: quiz.reviewmarks ? markobtained : null,
        maxmark: q.maxmark,
      };
    });

    const sumgrades = attempt.sumgrades || 0;
    const percentage = (sumgrades / quiz.sumgrades) * 100;

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
          sumgrades: sumgrades,
          grade: (percentage / 100) * quiz.grade,
        },
        questions: reviewQuestions,
        overallfeedback: quiz.reviewoverallfeedback ? getOverallFeedback(percentage) : '',
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
    const timeElapsed = Math.floor((Date.now() - attempt.timestart) / 1000);
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
