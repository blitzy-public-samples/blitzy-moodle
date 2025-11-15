/**
 * E2E Test Fixtures - Quiz Data
 * 
 * Provides predefined quiz objects with various question types, time limits, attempt settings, and grading methods.
 * Used across quiz taking, review, and grading E2E tests to simulate realistic quiz scenarios.
 * 
 * @module tests/e2e/fixtures/quizzes
 */

import { testCourse1 } from './courses';
import { testStudent2 } from './users';

/**
 * Quiz state constants matching Moodle quiz attempt states
 */
export const QUIZ_STATES = {
  /** Quiz attempt is currently in progress */
  IN_PROGRESS: 'inprogress',
  /** Quiz attempt time has expired but not yet submitted */
  OVERDUE: 'overdue',
  /** Quiz attempt has been submitted and finished */
  FINISHED: 'finished',
  /** Quiz attempt was abandoned without submission */
  ABANDONED: 'abandoned',
} as const;

/**
 * Question type constants matching Moodle question engine types
 */
export const QUESTION_TYPES = {
  /** Multiple choice question with single or multiple correct answers */
  MULTIPLE_CHOICE: 'multichoice',
  /** True/false question */
  TRUE_FALSE: 'truefalse',
  /** Short answer question requiring typed response */
  SHORT_ANSWER: 'shortanswer',
  /** Essay question requiring extended written response */
  ESSAY: 'essay',
  /** Numerical question requiring numeric answer */
  NUMERICAL: 'numerical',
  /** Matching question pairing items together */
  MATCHING: 'match',
  /** Calculated question with formula-based answers */
  CALCULATED: 'calculated',
} as const;

/**
 * Grade method constants for calculating final quiz grade from multiple attempts
 */
export const GRADE_METHODS = {
  /** Use the highest grade from all attempts */
  HIGHEST_GRADE: 'highest' as const,
  /** Use the average of all attempt grades */
  AVERAGE_GRADE: 'average' as const,
  /** Use the first attempt grade only */
  FIRST_ATTEMPT: 'first' as const,
  /** Use the last attempt grade only */
  LAST_ATTEMPT: 'last' as const,
} as const;

/**
 * Quiz answer option interface for multiple choice and similar questions
 */
export interface QuizAnswer {
  /** Answer identifier */
  id: number;
  /** Answer text content */
  text: string;
  /** Fraction of total grade (1.0 = 100% correct, 0.0 = incorrect, 0.5 = partial credit) */
  fraction: number;
  /** Feedback shown when this answer is selected */
  feedback?: string;
}

/**
 * Quiz question interface matching Moodle question engine structure
 * Represents a single question within a quiz
 */
export interface QuizQuestion {
  /** Unique question identifier */
  id: number;
  /** Quiz ID this question belongs to */
  quizid: number;
  /** Position/order of question in quiz (1-based) */
  slot: number;
  /** Question type (multichoice, truefalse, shortanswer, essay, etc.) */
  type: string;
  /** Question name/title for identification */
  name: string;
  /** Question text/prompt shown to student */
  questiontext: string;
  /** Default mark/points for this question */
  defaultmark: number;
  /** Array of possible answers (for multiple choice, true/false) */
  answers?: QuizAnswer[];
  /** Correct answer value (for short answer, numerical) */
  correctanswer?: string | number;
  /** General feedback shown after question is answered */
  feedback?: string;
  /** Response format for essay questions (editor, plain, monospaced) */
  responseformat?: string;
}

/**
 * Student's answer to a quiz question
 */
export interface QuestionAnswer {
  /** Question slot number this answer belongs to */
  slot: number;
  /** Student's answer (answerid for MCQ, text for short answer/essay) */
  answer: number | string;
  /** Whether this answer has been sequentially checked (for adaptive mode) */
  sequencecheck?: number;
  /** Timestamp when answer was submitted */
  timemodified?: number;
}

/**
 * Quiz attempt interface matching Moodle quiz attempt structure
 * Represents a student's attempt at taking a quiz
 */
export interface QuizAttempt {
  /** Unique attempt identifier */
  id: number;
  /** User ID of student taking the quiz */
  userid: number;
  /** Quiz ID this attempt belongs to */
  quizid: number;
  /** Attempt number for this user (1, 2, 3, etc.) */
  attempt: number;
  /** Unix timestamp when attempt was started */
  timestart: number;
  /** Unix timestamp when attempt was finished (0 if in progress) */
  timefinish: number;
  /** Current state of attempt (inprogress, finished, overdue, abandoned) */
  state: string;
  /** Total grade achieved (null if not yet graded) */
  sumgrades: number | null;
  /** Feedback text shown to student after completion */
  feedback?: string;
  /** Current page/question number student is on (0-based) */
  currentpage?: number;
  /** Array of student's answers to questions */
  answers?: QuestionAnswer[];
}

/**
 * Quiz interface matching Moodle quiz API structure
 * Represents a complete quiz object with configuration and questions
 */
export interface Quiz {
  /** Unique quiz identifier */
  id: number;
  /** Course ID this quiz belongs to */
  courseid: number;
  /** Quiz name/title */
  name: string;
  /** Quiz introduction/description HTML */
  intro: string;
  /** Unix timestamp when quiz opens (0 = always open) */
  timeopen: number;
  /** Unix timestamp when quiz closes (0 = never closes) */
  timeclose: number;
  /** Time limit in seconds (0 = no time limit) */
  timelimit: number;
  /** Maximum number of attempts allowed (0 = unlimited) */
  attempts: number;
  /** Grade calculation method for multiple attempts */
  grademethod: 'highest' | 'average' | 'first' | 'last';
  /** Total number of questions in quiz */
  questioncount: number;
  /** Maximum grade possible for quiz */
  sumgrades: number;
  /** Array of questions in this quiz */
  questions: QuizQuestion[];
}

/**
 * Multiple choice question fixture
 * Standard question with 4 options and single correct answer
 */
export const multipleChoiceQuestion: QuizQuestion = {
  id: 5001,
  quizid: 201,
  slot: 1,
  type: QUESTION_TYPES.MULTIPLE_CHOICE,
  name: 'Python Variables',
  questiontext: '<p>Which of the following is the correct way to declare a variable in Python?</p>',
  defaultmark: 1.0,
  answers: [
    {
      id: 50011,
      text: 'var x = 10',
      fraction: 0.0,
      feedback: 'This is JavaScript syntax, not Python.'
    },
    {
      id: 50012,
      text: 'x = 10',
      fraction: 1.0,
      feedback: 'Correct! Python uses simple assignment without type declarations.'
    },
    {
      id: 50013,
      text: 'int x = 10;',
      fraction: 0.0,
      feedback: 'This is Java/C++ syntax with type declaration.'
    },
    {
      id: 50014,
      text: 'let x = 10',
      fraction: 0.0,
      feedback: 'This is JavaScript ES6 syntax.'
    }
  ],
  correctanswer: 50012,
  feedback: 'Python uses dynamic typing and simple assignment syntax.'
};

/**
 * True/false question fixture
 * Binary choice question about programming concepts
 */
export const truefalseQuestion: QuizQuestion = {
  id: 5002,
  quizid: 201,
  slot: 2,
  type: QUESTION_TYPES.TRUE_FALSE,
  name: 'Python Lists',
  questiontext: '<p>Python lists are immutable, meaning they cannot be changed after creation.</p>',
  defaultmark: 1.0,
  answers: [
    {
      id: 50021,
      text: 'True',
      fraction: 0.0,
      feedback: 'Incorrect. Lists are mutable in Python.'
    },
    {
      id: 50022,
      text: 'False',
      fraction: 1.0,
      feedback: 'Correct! Lists are mutable. Tuples are immutable.'
    }
  ],
  correctanswer: 50022,
  feedback: 'Lists can be modified after creation. Tuples are the immutable sequence type in Python.'
};

/**
 * Short answer question fixture
 * Question requiring typed text response with exact match
 */
export const shortAnswerQuestion: QuizQuestion = {
  id: 5003,
  quizid: 201,
  slot: 3,
  type: QUESTION_TYPES.SHORT_ANSWER,
  name: 'Python Keyword',
  questiontext: '<p>What Python keyword is used to define a function?</p>',
  defaultmark: 1.0,
  correctanswer: 'def',
  feedback: 'The "def" keyword is used to define functions in Python.'
};

/**
 * Essay question fixture
 * Question requiring extended written response
 */
export const essayQuestion: QuizQuestion = {
  id: 5004,
  quizid: 201,
  slot: 4,
  type: QUESTION_TYPES.ESSAY,
  name: 'OOP Principles',
  questiontext: '<p>Explain the concept of inheritance in object-oriented programming. Provide an example of when you would use inheritance in a Python program.</p>',
  defaultmark: 5.0,
  responseformat: 'editor',
  feedback: 'Essay questions require manual grading by the instructor.'
};

/**
 * Test quiz 1: Basic Python Quiz
 * Standard quiz with multiple question types, no time limit, multiple attempts allowed
 */
export const testQuiz1: Quiz = {
  id: 201,
  courseid: testCourse1.id,
  name: 'Python Fundamentals Quiz',
  intro: '<p>This quiz tests your understanding of Python basics including variables, data types, and functions.</p><p>You have unlimited attempts and no time limit. Good luck!</p>',
  timeopen: Math.floor(Date.now() / 1000) - 86400 * 7, // Opened 7 days ago
  timeclose: Math.floor(Date.now() / 1000) + 86400 * 30, // Closes in 30 days
  timelimit: 0, // No time limit
  attempts: 0, // Unlimited attempts
  grademethod: GRADE_METHODS.HIGHEST_GRADE,
  questioncount: 4,
  sumgrades: 8.0, // Total marks: 1+1+1+5 = 8
  questions: [
    multipleChoiceQuestion,
    truefalseQuestion,
    shortAnswerQuestion,
    essayQuestion
  ]
};

/**
 * Test quiz 2: Timed Programming Quiz
 * Quiz with 60-minute time limit and limited attempts
 */
export const testQuiz2: Quiz = {
  id: 202,
  courseid: testCourse1.id,
  name: 'Midterm Exam: Programming Concepts',
  intro: '<p>This is a timed midterm examination covering all topics from weeks 1-6.</p><p><strong>Important:</strong> You have 60 minutes to complete this quiz and only 2 attempts are allowed.</p>',
  timeopen: Math.floor(Date.now() / 1000) - 86400 * 3, // Opened 3 days ago
  timeclose: Math.floor(Date.now() / 1000) + 86400 * 4, // Closes in 4 days
  timelimit: 3600, // 60 minutes (3600 seconds)
  attempts: 2, // Maximum 2 attempts
  grademethod: GRADE_METHODS.HIGHEST_GRADE,
  questioncount: 10,
  sumgrades: 50.0,
  questions: [
    {
      id: 5011,
      quizid: 202,
      slot: 1,
      type: QUESTION_TYPES.MULTIPLE_CHOICE,
      name: 'Question 1',
      questiontext: '<p>What is the output of print(type([]))?</p>',
      defaultmark: 5.0,
      answers: [
        { id: 50111, text: "&lt;class 'array'&gt;", fraction: 0.0 },
        { id: 50112, text: "&lt;class 'list'&gt;", fraction: 1.0 },
        { id: 50113, text: "&lt;class 'tuple'&gt;", fraction: 0.0 },
        { id: 50114, text: "&lt;class 'dict'&gt;", fraction: 0.0 }
      ],
      correctanswer: 50112
    },
    {
      id: 5012,
      quizid: 202,
      slot: 2,
      type: QUESTION_TYPES.TRUE_FALSE,
      name: 'Question 2',
      questiontext: '<p>Python is a statically-typed programming language.</p>',
      defaultmark: 5.0,
      answers: [
        { id: 50121, text: 'True', fraction: 0.0 },
        { id: 50122, text: 'False', fraction: 1.0 }
      ],
      correctanswer: 50122
    },
    {
      id: 5013,
      quizid: 202,
      slot: 3,
      type: QUESTION_TYPES.SHORT_ANSWER,
      name: 'Question 3',
      questiontext: '<p>What built-in Python function returns the number of items in a list?</p>',
      defaultmark: 5.0,
      correctanswer: 'len'
    },
    {
      id: 5014,
      quizid: 202,
      slot: 4,
      type: QUESTION_TYPES.MULTIPLE_CHOICE,
      name: 'Question 4',
      questiontext: '<p>Which operator is used for exponentiation in Python?</p>',
      defaultmark: 5.0,
      answers: [
        { id: 50141, text: '^', fraction: 0.0 },
        { id: 50142, text: '**', fraction: 1.0 },
        { id: 50143, text: 'pow', fraction: 0.0 },
        { id: 50144, text: 'exp', fraction: 0.0 }
      ],
      correctanswer: 50142
    },
    {
      id: 5015,
      quizid: 202,
      slot: 5,
      type: QUESTION_TYPES.MULTIPLE_CHOICE,
      name: 'Question 5',
      questiontext: '<p>What is the correct syntax for a for loop in Python?</p>',
      defaultmark: 5.0,
      answers: [
        { id: 50151, text: 'for i in range(10):', fraction: 1.0 },
        { id: 50152, text: 'for (i=0; i<10; i++)', fraction: 0.0 },
        { id: 50153, text: 'foreach i in range(10):', fraction: 0.0 },
        { id: 50154, text: 'for i = 0 to 10:', fraction: 0.0 }
      ],
      correctanswer: 50151
    },
    {
      id: 5016,
      quizid: 202,
      slot: 6,
      type: QUESTION_TYPES.SHORT_ANSWER,
      name: 'Question 6',
      questiontext: '<p>What keyword is used to import modules in Python?</p>',
      defaultmark: 5.0,
      correctanswer: 'import'
    },
    {
      id: 5017,
      quizid: 202,
      slot: 7,
      type: QUESTION_TYPES.TRUE_FALSE,
      name: 'Question 7',
      questiontext: '<p>Dictionary keys in Python must be immutable types.</p>',
      defaultmark: 5.0,
      answers: [
        { id: 50171, text: 'True', fraction: 1.0 },
        { id: 50172, text: 'False', fraction: 0.0 }
      ],
      correctanswer: 50171
    },
    {
      id: 5018,
      quizid: 202,
      slot: 8,
      type: QUESTION_TYPES.MULTIPLE_CHOICE,
      name: 'Question 8',
      questiontext: '<p>Which of these is NOT a valid Python data type?</p>',
      defaultmark: 5.0,
      answers: [
        { id: 50181, text: 'int', fraction: 0.0 },
        { id: 50182, text: 'float', fraction: 0.0 },
        { id: 50183, text: 'decimal', fraction: 1.0 },
        { id: 50184, text: 'str', fraction: 0.0 }
      ],
      correctanswer: 50183
    },
    {
      id: 5019,
      quizid: 202,
      slot: 9,
      type: QUESTION_TYPES.SHORT_ANSWER,
      name: 'Question 9',
      questiontext: '<p>What keyword is used to create a class in Python?</p>',
      defaultmark: 5.0,
      correctanswer: 'class'
    },
    {
      id: 5020,
      quizid: 202,
      slot: 10,
      type: QUESTION_TYPES.TRUE_FALSE,
      name: 'Question 10',
      questiontext: '<p>Python uses indentation to define code blocks.</p>',
      defaultmark: 5.0,
      answers: [
        { id: 50201, text: 'True', fraction: 1.0 },
        { id: 50202, text: 'False', fraction: 0.0 }
      ],
      correctanswer: 50201
    }
  ]
};

/**
 * Test quiz 3: Practice Quiz with Unlimited Attempts
 * Low-stakes quiz for practice with unlimited attempts and immediate feedback
 */
export const testQuiz3: Quiz = {
  id: 203,
  courseid: testCourse1.id,
  name: 'Practice Quiz: Python Syntax',
  intro: '<p>Practice your Python syntax knowledge with this self-paced quiz.</p><p>You have unlimited attempts and will receive immediate feedback after each question.</p>',
  timeopen: Math.floor(Date.now() / 1000) - 86400 * 14, // Opened 14 days ago
  timeclose: 0, // Never closes
  timelimit: 0, // No time limit
  attempts: 0, // Unlimited attempts
  grademethod: GRADE_METHODS.LAST_ATTEMPT,
  questioncount: 5,
  sumgrades: 5.0,
  questions: [
    {
      id: 5031,
      quizid: 203,
      slot: 1,
      type: QUESTION_TYPES.MULTIPLE_CHOICE,
      name: 'Print Statement',
      questiontext: '<p>How do you output text in Python 3?</p>',
      defaultmark: 1.0,
      answers: [
        { id: 50311, text: 'echo "Hello"', fraction: 0.0, feedback: 'This is shell/PHP syntax.' },
        { id: 50312, text: 'print("Hello")', fraction: 1.0, feedback: 'Correct!' },
        { id: 50313, text: 'console.log("Hello")', fraction: 0.0, feedback: 'This is JavaScript syntax.' },
        { id: 50314, text: 'System.out.println("Hello")', fraction: 0.0, feedback: 'This is Java syntax.' }
      ],
      correctanswer: 50312
    },
    {
      id: 5032,
      quizid: 203,
      slot: 2,
      type: QUESTION_TYPES.TRUE_FALSE,
      name: 'Indentation',
      questiontext: '<p>Python uses curly braces {} to define code blocks.</p>',
      defaultmark: 1.0,
      answers: [
        { id: 50321, text: 'True', fraction: 0.0, feedback: 'Python uses indentation, not braces.' },
        { id: 50322, text: 'False', fraction: 1.0, feedback: 'Correct! Python uses indentation.' }
      ],
      correctanswer: 50322
    },
    {
      id: 5033,
      quizid: 203,
      slot: 3,
      type: QUESTION_TYPES.SHORT_ANSWER,
      name: 'Comment Syntax',
      questiontext: '<p>What character is used to write single-line comments in Python?</p>',
      defaultmark: 1.0,
      correctanswer: '#'
    },
    {
      id: 5034,
      quizid: 203,
      slot: 4,
      type: QUESTION_TYPES.MULTIPLE_CHOICE,
      name: 'String Concatenation',
      questiontext: '<p>How do you concatenate strings in Python?</p>',
      defaultmark: 1.0,
      answers: [
        { id: 50341, text: '"Hello" + "World"', fraction: 1.0, feedback: 'Correct! Use the + operator.' },
        { id: 50342, text: '"Hello" . "World"', fraction: 0.0, feedback: 'This is PHP syntax.' },
        { id: 50343, text: '"Hello" & "World"', fraction: 0.0, feedback: 'This is VBA/Excel syntax.' },
        { id: 50344, text: 'concat("Hello", "World")', fraction: 0.0, feedback: 'Python uses the + operator.' }
      ],
      correctanswer: 50341
    },
    {
      id: 5035,
      quizid: 203,
      slot: 5,
      type: QUESTION_TYPES.TRUE_FALSE,
      name: 'Case Sensitivity',
      questiontext: '<p>Python is case-sensitive (e.g., "Variable" and "variable" are different).</p>',
      defaultmark: 1.0,
      answers: [
        { id: 50351, text: 'True', fraction: 1.0, feedback: 'Correct! Python is case-sensitive.' },
        { id: 50352, text: 'False', fraction: 0.0, feedback: 'Python IS case-sensitive.' }
      ],
      correctanswer: 50351
    }
  ]
};

/**
 * Test quiz 4: Advanced Quiz with Essay Questions
 * Quiz containing essay questions requiring manual grading
 */
export const testQuiz4: Quiz = {
  id: 204,
  courseid: testCourse1.id,
  name: 'Final Project: Programming Concepts',
  intro: '<p>This quiz assesses your understanding of advanced programming concepts through essay questions.</p><p>All questions require detailed written responses and will be manually graded by your instructor.</p>',
  timeopen: Math.floor(Date.now() / 1000) - 86400 * 1, // Opened 1 day ago
  timeclose: Math.floor(Date.now() / 1000) + 86400 * 14, // Closes in 14 days
  timelimit: 7200, // 2 hours (7200 seconds)
  attempts: 1, // Single attempt only
  grademethod: GRADE_METHODS.FIRST_ATTEMPT,
  questioncount: 3,
  sumgrades: 30.0,
  questions: [
    {
      id: 5041,
      quizid: 204,
      slot: 1,
      type: QUESTION_TYPES.ESSAY,
      name: 'Design Patterns',
      questiontext: '<p>Explain the Singleton design pattern. Why would you use it? Provide a Python implementation and describe at least two real-world use cases.</p>',
      defaultmark: 10.0,
      responseformat: 'editor',
      feedback: 'Your instructor will provide detailed feedback on your response.'
    },
    {
      id: 5042,
      quizid: 204,
      slot: 2,
      type: QUESTION_TYPES.ESSAY,
      name: 'Data Structures',
      questiontext: '<p>Compare and contrast lists, tuples, sets, and dictionaries in Python. Discuss the time complexity of common operations and provide examples of when each data structure is most appropriate.</p>',
      defaultmark: 10.0,
      responseformat: 'editor',
      feedback: 'Focus on understanding trade-offs between different data structures.'
    },
    {
      id: 5043,
      quizid: 204,
      slot: 3,
      type: QUESTION_TYPES.ESSAY,
      name: 'Exception Handling',
      questiontext: '<p>Explain exception handling in Python. Describe the difference between try-except-else-finally blocks. When should you create custom exception classes? Provide code examples.</p>',
      defaultmark: 10.0,
      responseformat: 'editor',
      feedback: 'Exception handling is critical for writing robust, production-ready code.'
    }
  ]
};

/**
 * In-progress attempt fixture
 * Represents a student currently taking a quiz
 */
export const inProgressAttempt: QuizAttempt = {
  id: 3001,
  userid: testStudent2.id,
  quizid: testQuiz1.id,
  attempt: 1,
  timestart: Math.floor(Date.now() / 1000) - 900, // Started 15 minutes ago
  timefinish: 0, // Not finished yet
  state: QUIZ_STATES.IN_PROGRESS,
  sumgrades: null, // Not graded yet
  currentpage: 2, // Currently on question 3 (0-indexed page 2)
  answers: [
    {
      slot: 1,
      answer: 50012, // Selected correct answer for multiple choice
      timemodified: Math.floor(Date.now() / 1000) - 840 // Answered 14 minutes ago
    },
    {
      slot: 2,
      answer: 50022, // Selected correct answer for true/false
      timemodified: Math.floor(Date.now() / 1000) - 720 // Answered 12 minutes ago
    }
    // Questions 3 and 4 not yet answered
  ]
};

/**
 * Submitted attempt fixture
 * Represents a completed quiz that has been submitted but not yet reviewed
 */
export const submittedAttempt: QuizAttempt = {
  id: 3002,
  userid: testStudent2.id,
  quizid: testQuiz2.id,
  attempt: 1,
  timestart: Math.floor(Date.now() / 1000) - 7200, // Started 2 hours ago
  timefinish: Math.floor(Date.now() / 1000) - 3600, // Finished 1 hour ago
  state: QUIZ_STATES.FINISHED,
  sumgrades: 42.5, // Scored 42.5 out of 50
  answers: [
    { slot: 1, answer: 50112, timemodified: Math.floor(Date.now() / 1000) - 7000 },
    { slot: 2, answer: 50122, timemodified: Math.floor(Date.now() / 1000) - 6800 },
    { slot: 3, answer: 'len', timemodified: Math.floor(Date.now() / 1000) - 6600 },
    { slot: 4, answer: 50142, timemodified: Math.floor(Date.now() / 1000) - 6400 },
    { slot: 5, answer: 50151, timemodified: Math.floor(Date.now() / 1000) - 6200 },
    { slot: 6, answer: 'import', timemodified: Math.floor(Date.now() / 1000) - 6000 },
    { slot: 7, answer: 50171, timemodified: Math.floor(Date.now() / 1000) - 5800 },
    { slot: 8, answer: 50182, timemodified: Math.floor(Date.now() / 1000) - 5600 }, // Wrong answer
    { slot: 9, answer: 'class', timemodified: Math.floor(Date.now() / 1000) - 5400 },
    { slot: 10, answer: 50201, timemodified: Math.floor(Date.now() / 1000) - 5200 }
  ]
};

/**
 * Reviewed attempt fixture
 * Represents a completed quiz that has been reviewed with feedback provided
 */
export const reviewedAttempt: QuizAttempt = {
  id: 3003,
  userid: testStudent2.id,
  quizid: testQuiz1.id,
  attempt: 2,
  timestart: Math.floor(Date.now() / 1000) - 172800, // Started 2 days ago
  timefinish: Math.floor(Date.now() / 1000) - 172200, // Finished 2 days ago (10 min duration)
  state: QUIZ_STATES.FINISHED,
  sumgrades: 7.0, // Scored 7 out of 8
  feedback: '<p>Excellent work! You demonstrated a strong understanding of Python fundamentals. Your essay response showed good analysis of inheritance concepts with a clear, relevant example.</p>',
  answers: [
    {
      slot: 1,
      answer: 50012, // Correct
      timemodified: Math.floor(Date.now() / 1000) - 172600
    },
    {
      slot: 2,
      answer: 50022, // Correct
      timemodified: Math.floor(Date.now() / 1000) - 172500
    },
    {
      slot: 3,
      answer: 'def', // Correct
      timemodified: Math.floor(Date.now() / 1000) - 172400
    },
    {
      slot: 4,
      answer: '<p>Inheritance is a fundamental OOP principle that allows a class to inherit attributes and methods from a parent class. For example, you might create a base Vehicle class with common properties like speed and fuel, then create Car and Motorcycle subclasses that inherit these properties but add their own specific features.</p>', // Essay answer (graded 4/5)
      timemodified: Math.floor(Date.now() / 1000) - 172200
    }
  ]
};

/**
 * Helper function to create a quiz object with customizable properties
 * Useful for generating test data with specific configurations
 * 
 * @param overrides - Partial quiz properties to override defaults
 * @returns Complete quiz object with merged properties
 */
export function createQuiz(overrides: Partial<Quiz> = {}): Quiz {
  const defaultQuiz: Quiz = {
    id: Math.floor(Math.random() * 10000) + 1000,
    courseid: testCourse1.id,
    name: 'Test Quiz',
    intro: '<p>This is a test quiz.</p>',
    timeopen: Math.floor(Date.now() / 1000) - 86400,
    timeclose: Math.floor(Date.now() / 1000) + 86400 * 7,
    timelimit: 0,
    attempts: 0,
    grademethod: GRADE_METHODS.HIGHEST_GRADE,
    questioncount: 0,
    sumgrades: 0,
    questions: []
  };

  return {
    ...defaultQuiz,
    ...overrides,
    // Ensure questions array is properly merged, not replaced with undefined
    questions: overrides.questions !== undefined ? overrides.questions : defaultQuiz.questions,
    // Recalculate derived fields based on questions
    questioncount: overrides.questioncount !== undefined 
      ? overrides.questioncount 
      : (overrides.questions?.length || defaultQuiz.questioncount),
    sumgrades: overrides.sumgrades !== undefined
      ? overrides.sumgrades
      : (overrides.questions?.reduce((sum, q) => sum + q.defaultmark, 0) || defaultQuiz.sumgrades)
  };
}

/**
 * Helper function to create a quiz question with customizable properties
 * Simplifies test data generation for different question types
 * 
 * @param overrides - Partial question properties to override defaults
 * @returns Complete question object with merged properties
 */
export function createQuestion(overrides: Partial<QuizQuestion> = {}): QuizQuestion {
  const defaultQuestion: QuizQuestion = {
    id: Math.floor(Math.random() * 10000) + 5000,
    quizid: 201,
    slot: 1,
    type: QUESTION_TYPES.MULTIPLE_CHOICE,
    name: 'Test Question',
    questiontext: '<p>This is a test question.</p>',
    defaultmark: 1.0,
    answers: []
  };

  return {
    ...defaultQuestion,
    ...overrides,
    // Ensure nested objects/arrays are properly handled
    answers: overrides.answers !== undefined ? overrides.answers : defaultQuestion.answers
  };
}

/**
 * Helper function to create a quiz attempt with customizable properties
 * Facilitates testing of different attempt states and scenarios
 * 
 * @param overrides - Partial attempt properties to override defaults
 * @returns Complete attempt object with merged properties
 */
export function createAttempt(overrides: Partial<QuizAttempt> = {}): QuizAttempt {
  const now = Math.floor(Date.now() / 1000);
  const defaultAttempt: QuizAttempt = {
    id: Math.floor(Math.random() * 10000) + 3000,
    userid: testStudent2.id,
    quizid: testQuiz1.id,
    attempt: 1,
    timestart: now - 3600,
    timefinish: 0,
    state: QUIZ_STATES.IN_PROGRESS,
    sumgrades: null,
    currentpage: 0,
    answers: []
  };

  return {
    ...defaultAttempt,
    ...overrides,
    // Ensure nested arrays are properly handled
    answers: overrides.answers !== undefined ? overrides.answers : defaultAttempt.answers
  };
}
