/**
 * Test Data Generator Utilities for Playwright E2E Tests
 * 
 * Provides functions to generate realistic test data for users, courses, assignments,
 * quizzes, and other Moodle entities. Ensures test data isolation between test runs
 * using unique identifiers and timestamps.
 * 
 * @package    react-frontend
 * @subpackage tests/e2e/utils
 * @copyright  2024 Moodle Pty Ltd
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import { randomBytes, randomUUID } from 'crypto';
import { faker } from '@faker-js/faker';

/**
 * User data type for test user generation
 */
export type UserData = {
  username: string;
  email: string;
  password: string;
  firstname: string;
  lastname: string;
  id?: number;
};

/**
 * Course data type for test course generation
 */
export type CourseData = {
  fullname: string;
  shortname: string;
  category: number;
  summary: string;
  visible: number;
  id?: number;
};

/**
 * Assignment data type for test assignment generation
 */
export type AssignmentData = {
  name: string;
  description: string;
  duedate: number;
  allowsubmissionsfromdate: number;
  course: number;
  id?: number;
};

/**
 * Question data type for quiz questions
 */
export type QuestionData = {
  questiontext: string;
  questiontype: string;
  defaultmark: number;
  answers: Array<{
    text: string;
    fraction: number;
    feedback: string;
  }>;
};

/**
 * Quiz data type for test quiz generation
 */
export type QuizData = {
  name: string;
  intro: string;
  timeopen: number;
  timeclose: number;
  timelimit: number;
  questions: QuestionData[];
  course: number;
  id?: number;
};

/**
 * Test data configuration options
 */
export type TestDataConfig = {
  prefix?: string;
  uniqueIdentifier?: boolean;
  timestamp?: boolean;
};

/**
 * Forum post data type for test forum generation
 */
export type ForumPostData = {
  discussionname: string;
  subject: string;
  message: string;
  forum: number;
  course: number;
  id?: number;
};

/**
 * Registry to track generated test data for cleanup
 */
const testDataRegistry: {
  users: UserData[];
  courses: CourseData[];
  assignments: AssignmentData[];
  quizzes: QuizData[];
  forumPosts: ForumPostData[];
} = {
  users: [],
  courses: [],
  assignments: [],
  quizzes: [],
  forumPosts: [],
};

/**
 * Generate a cryptographically secure unique identifier
 * 
 * @param prefix - Optional prefix for the identifier (default: 'E2E_TEST_')
 * @returns Unique identifier string with timestamp and random suffix
 */
export function generateUniqueId(prefix: string = 'E2E_TEST_'): string {
  const timestamp = Date.now();
  const randomSuffix = randomBytes(3).toString('hex'); // 6 character hex string
  return `${prefix}${timestamp}_${randomSuffix}`;
}

/**
 * Generate a unique username meeting Moodle constraints
 * Format: 'testuser_' + timestamp + '_' + random(6)
 * 
 * @param config - Configuration options for username generation
 * @returns Valid Moodle username (lowercase, alphanumeric + underscore)
 */
export function generateUsername(config: TestDataConfig = {}): string {
  const prefix = config.prefix || 'testuser';
  const timestamp = config.timestamp !== false ? Date.now() : '';
  const randomSuffix = randomBytes(3).toString('hex'); // 6 character hex string
  
  // Ensure lowercase for Moodle requirement
  const username = `${prefix}_${timestamp}_${randomSuffix}`.toLowerCase();
  
  return username;
}

/**
 * Generate a valid email address for test users
 * Format: testuser_[id]@example.moodle
 * 
 * @param identifier - Optional unique identifier, auto-generated if not provided
 * @returns Valid email address for test user
 */
export function generateEmail(identifier?: string): string {
  const id = identifier || randomUUID().split('-')[0];
  return `testuser_${id}@example.moodle`;
}

/**
 * Generate a secure password meeting Moodle complexity requirements
 * Requirements: Min 8 chars, uppercase, lowercase, digit, special char
 * 
 * @returns Secure password meeting all Moodle requirements
 */
export function generatePassword(): string {
  // Generate password with all required character types
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const digits = '0123456789';
  const special = '!@#$%^&*';
  
  // Ensure at least one of each required type
  const passwordParts = [
    uppercase[Math.floor(Math.random() * uppercase.length)],
    uppercase[Math.floor(Math.random() * uppercase.length)],
    lowercase[Math.floor(Math.random() * lowercase.length)],
    lowercase[Math.floor(Math.random() * lowercase.length)],
    digits[Math.floor(Math.random() * digits.length)],
    digits[Math.floor(Math.random() * digits.length)],
    special[Math.floor(Math.random() * special.length)],
    special[Math.floor(Math.random() * special.length)],
  ];
  
  // Add additional random characters to reach minimum length
  const allChars = uppercase + lowercase + digits + special;
  for (let i = passwordParts.length; i < 12; i++) {
    passwordParts.push(allChars[Math.floor(Math.random() * allChars.length)]);
  }
  
  // Shuffle array to randomize character positions
  for (let i = passwordParts.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [passwordParts[i], passwordParts[j]] = [passwordParts[j], passwordParts[i]];
  }
  
  return passwordParts.join('');
}

/**
 * Generate a course name with test prefix
 * 
 * @param config - Configuration options for course name generation
 * @returns Course name with E2E_TEST_ prefix for identification
 */
export function generateCourseName(config: TestDataConfig = {}): string {
  const prefix = config.prefix || 'E2E_TEST_Course';
  const uniqueId = config.uniqueIdentifier !== false ? `_${Date.now()}` : '';
  const courseName = faker.lorem.words(3);
  
  return `${prefix}${uniqueId}_${courseName}`;
}

/**
 * Generate a unique filename for file upload tests
 * 
 * @param extension - File extension (default: 'txt')
 * @param prefix - Optional prefix for filename
 * @returns Unique filename with timestamp and random identifier
 */
export function generateFileName(extension: string = 'txt', prefix: string = 'testfile'): string {
  const timestamp = Date.now();
  const randomSuffix = randomBytes(4).toString('hex'); // 8 character hex string
  return `${prefix}_${timestamp}_${randomSuffix}.${extension}`;
}

/**
 * Generate random text content with specified length
 * 
 * @param length - Desired length: 'short' (1-2 sentences), 'medium' (1 paragraph), 'long' (3-5 paragraphs)
 * @returns Generated text content
 */
export function generateText(length: 'short' | 'medium' | 'long' = 'medium'): string {
  switch (length) {
    case 'short':
      return faker.lorem.sentence(faker.number.int({ min: 5, max: 15 }));
    case 'medium':
      return faker.lorem.paragraph(faker.number.int({ min: 3, max: 6 }));
    case 'long':
      return faker.lorem.paragraphs(faker.number.int({ min: 3, max: 5 }), '\n\n');
    default:
      return faker.lorem.paragraph();
  }
}

/**
 * Generate date within valid range
 * 
 * @param type - Date type: 'past' (within last 30 days), 'future' (next 30 days), 'recent' (last 7 days)
 * @param offsetDays - Optional offset in days from current date
 * @returns Unix timestamp in seconds
 */
export function generateDate(type: 'past' | 'future' | 'recent' = 'future', offsetDays?: number): number {
  let date: Date;
  
  if (offsetDays !== undefined) {
    date = new Date();
    date.setDate(date.getDate() + offsetDays);
  } else {
    switch (type) {
      case 'past':
        date = faker.date.past({ years: 0.08 }); // ~30 days
        break;
      case 'future':
        date = faker.date.future({ years: 0.08 }); // ~30 days
        break;
      case 'recent':
        date = faker.date.recent({ days: 7 });
        break;
      default:
        date = faker.date.future({ years: 0.08 });
    }
  }
  
  // Return Unix timestamp in seconds (Moodle uses seconds, not milliseconds)
  return Math.floor(date.getTime() / 1000);
}

/**
 * Generate valid grade value within range
 * 
 * @param minGrade - Minimum grade (default: 0)
 * @param maxGrade - Maximum grade (default: 100)
 * @param decimalPlaces - Number of decimal places (default: 2)
 * @returns Grade value within specified range
 */
export function generateGrade(minGrade: number = 0, maxGrade: number = 100, decimalPlaces: number = 2): number {
  const grade = faker.number.int({ min: minGrade * 100, max: maxGrade * 100 }) / 100;
  return Number(grade.toFixed(decimalPlaces));
}

/**
 * Generate complete user data for test user creation
 * All fields meet Moodle validation requirements
 * 
 * @param overrides - Optional field overrides
 * @returns Complete user data object
 */
export function generateUser(overrides: Partial<UserData> = {}): UserData {
  const firstname = faker.person.firstName();
  const lastname = faker.person.lastName();
  const username = generateUsername();
  const email = generateEmail(username);
  const password = generatePassword();
  
  const user: UserData = {
    username,
    email,
    password,
    firstname,
    lastname,
    ...overrides,
  };
  
  // Register user for cleanup tracking
  testDataRegistry.users.push(user);
  
  return user;
}

/**
 * Generate complete course data for test course creation
 * 
 * @param overrides - Optional field overrides
 * @returns Complete course data object
 */
export function generateCourse(overrides: Partial<CourseData> = {}): CourseData {
  const fullname = generateCourseName();
  const shortname = `E2E_${randomBytes(4).toString('hex').toUpperCase()}`;
  const summary = generateText('medium');
  
  const course: CourseData = {
    fullname,
    shortname,
    category: 1, // Default category ID
    summary,
    visible: 1, // Visible by default
    ...overrides,
  };
  
  // Register course for cleanup tracking
  testDataRegistry.courses.push(course);
  
  return course;
}

/**
 * Generate complete assignment data for test assignment creation
 * 
 * @param courseId - Course ID for the assignment
 * @param overrides - Optional field overrides
 * @returns Complete assignment data object
 */
export function generateAssignment(courseId: number, overrides: Partial<AssignmentData> = {}): AssignmentData {
  const name = `E2E_TEST_Assignment_${faker.lorem.words(2)}`;
  const description = generateText('long');
  const allowsubmissionsfromdate = generateDate('recent');
  const duedate = generateDate('future', 14); // 14 days from now
  
  const assignment: AssignmentData = {
    name,
    description,
    duedate,
    allowsubmissionsfromdate,
    course: courseId,
    ...overrides,
  };
  
  // Register assignment for cleanup tracking
  testDataRegistry.assignments.push(assignment);
  
  return assignment;
}

/**
 * Generate complete quiz data for test quiz creation
 * 
 * @param courseId - Course ID for the quiz
 * @param questionCount - Number of questions to generate (default: 5)
 * @param overrides - Optional field overrides
 * @returns Complete quiz data object
 */
export function generateQuiz(
  courseId: number,
  questionCount: number = 5,
  overrides: Partial<QuizData> = {}
): QuizData {
  const name = `E2E_TEST_Quiz_${faker.lorem.words(2)}`;
  const intro = generateText('medium');
  const timeopen = generateDate('recent');
  const timeclose = generateDate('future', 30); // 30 days from now
  const timelimit = faker.number.int({ min: 300, max: 3600 }); // 5-60 minutes in seconds
  
  // Generate questions with multiple choice answers
  const questions: QuestionData[] = [];
  for (let i = 0; i < questionCount; i++) {
    const questiontext = `${faker.lorem.sentence()  }?`;
    const answerCount = faker.number.int({ min: 3, max: 5 });
    const correctAnswerIndex = faker.number.int({ min: 0, max: answerCount - 1 });
    
    const answers = [];
    for (let j = 0; j < answerCount; j++) {
      answers.push({
        text: faker.lorem.words(faker.number.int({ min: 2, max: 5 })),
        fraction: j === correctAnswerIndex ? 1.0 : 0.0, // Only correct answer gets 1.0
        feedback: faker.lorem.sentence(),
      });
    }
    
    questions.push({
      questiontext,
      questiontype: 'multichoice',
      defaultmark: 1.0,
      answers,
    });
  }
  
  const quiz: QuizData = {
    name,
    intro,
    timeopen,
    timeclose,
    timelimit,
    questions,
    course: courseId,
    ...overrides,
  };
  
  // Register quiz for cleanup tracking
  testDataRegistry.quizzes.push(quiz);
  
  return quiz;
}

/**
 * Generate forum discussion and post data
 * 
 * @param forumId - Forum ID for the post
 * @param courseId - Course ID for the forum
 * @param overrides - Optional field overrides
 * @returns Complete forum post data object
 */
export function generateForumPost(
  forumId: number,
  courseId: number,
  overrides: Partial<ForumPostData> = {}
): ForumPostData {
  const discussionname = `E2E_TEST_Discussion_${faker.lorem.words(3)}`;
  const subject = faker.lorem.sentence();
  const message = generateText('long');
  
  const forumPost: ForumPostData = {
    discussionname,
    subject,
    message,
    forum: forumId,
    course: courseId,
    ...overrides,
  };
  
  // Register forum post for cleanup tracking
  testDataRegistry.forumPosts.push(forumPost);
  
  return forumPost;
}

/**
 * Utility to track and cleanup generated test data
 * Returns registry of all generated test data for cleanup operations
 * 
 * @returns Test data registry containing all generated entities
 */
export function cleanupTestData(): typeof testDataRegistry {
  // Return a copy of the registry for cleanup operations
  const registryCopy = {
    users: [...testDataRegistry.users],
    courses: [...testDataRegistry.courses],
    assignments: [...testDataRegistry.assignments],
    quizzes: [...testDataRegistry.quizzes],
    forumPosts: [...testDataRegistry.forumPosts],
  };
  
  // Clear the registry after returning the data
  testDataRegistry.users = [];
  testDataRegistry.courses = [];
  testDataRegistry.assignments = [];
  testDataRegistry.quizzes = [];
  testDataRegistry.forumPosts = [];
  
  return registryCopy;
}
