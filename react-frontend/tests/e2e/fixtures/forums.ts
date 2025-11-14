/**
 * E2E Test Fixtures - Forum Data
 * 
 * Provides predefined forum objects with discussions, posts, and various forum types.
 * Used across forum navigation tests, discussion creation tests, and post reply tests.
 * 
 * @module tests/e2e/fixtures/forums
 */

import { testCourse1 } from './courses';
import { testStudent, testStudent2, testTeacher } from './users';
import { samplePDFFile } from './files';

/**
 * Forum type constants matching Moodle forum types
 * These correspond to the 'type' field in the mdl_forum table
 */
export const FORUM_TYPES = {
  /** General forum - standard forum for general use */
  GENERAL: 'general',
  /** Single simple discussion - forum with only one discussion thread */
  SINGLE: 'single',
  /** Each person posts one discussion - each user can start one discussion */
  EACHUSER: 'eachuser',
  /** Q&A forum - question and answer format */
  QANDA: 'qanda',
  /** Blog-like forum - displayed in blog format */
  BLOG: 'blog',
} as const;

/**
 * Subscription mode constants matching Moodle forum subscription options
 * These correspond to FORUM_CHOOSESUBSCRIBE, FORUM_FORCESUBSCRIBE, etc.
 */
export const SUBSCRIPTION_MODES = {
  /** Users can choose to subscribe (0) */
  CHOOSE_SUBSCRIBE: 0,
  /** All users are forced to subscribe (1) */
  FORCE_SUBSCRIBE: 1,
  /** Users are initially subscribed but can unsubscribe (2) */
  INITIAL_SUBSCRIBE: 2,
  /** Subscription is disabled for this forum (3) */
  DISALLOW_SUBSCRIBE: 3,
} as const;

/**
 * Forum tracking type constants matching Moodle forum tracking options
 * These determine how read/unread posts are tracked
 */
export const TRACKING_TYPES = {
  /** Tracking is disabled (0) */
  OFF: 0,
  /** Tracking is optional based on user preference (1) */
  OPTIONAL: 1,
  /** Tracking is forced for all users (2) */
  FORCED: 2,
} as const;

/**
 * Forum interface matching Moodle forum API structure
 * Represents a forum activity instance within a course
 */
export interface Forum {
  /** Unique forum identifier */
  id: number;
  /** Course ID this forum belongs to */
  courseid: number;
  /** Forum name/title */
  name: string;
  /** Forum introduction/description */
  intro: string;
  /** Forum type (general, single, qanda, blog, eachuser) */
  type: string;
  /** Maximum number of attachments allowed per post */
  maxattachments: number;
  /** Subscription mode (0-3) */
  subscriptionmode: number;
  /** Read tracking type (0-2) */
  trackingtype: number;
  /** Unix timestamp of last modification */
  timemodified: number;
  /** Maximum file size allowed for attachments (bytes) */
  maxbytes?: number;
  /** Whether forum has been completed by user */
  completiondiscussions?: number;
  /** Whether forum has been completed with replies */
  completionreplies?: number;
  /** Whether forum has been completed with posts */
  completionposts?: number;
}

/**
 * Forum discussion interface matching Moodle discussion structure
 * Represents a discussion thread within a forum
 */
export interface ForumDiscussion {
  /** Unique discussion identifier */
  id: number;
  /** Forum ID this discussion belongs to */
  forumid: number;
  /** Discussion name/subject */
  name: string;
  /** User ID who started the discussion */
  userid: number;
  /** Unix timestamp of last modification */
  timemodified: number;
  /** Number of replies in this discussion */
  numreplies: number;
  /** Whether discussion is pinned (1=pinned, 0=not pinned) */
  pinned: number;
  /** ID of the first post in the discussion */
  firstpost?: number;
  /** Array of posts in this discussion */
  posts?: ForumPost[];
  /** User information for discussion author */
  author?: {
    id: number;
    firstname: string;
    lastname: string;
    fullname: string;
  };
}

/**
 * Forum post interface matching Moodle post structure
 * Represents a single post/reply within a discussion
 */
export interface ForumPost {
  /** Unique post identifier */
  id: number;
  /** Discussion ID this post belongs to */
  discussionid: number;
  /** Parent post ID (0 for top-level posts) */
  parentid: number;
  /** User ID who created the post */
  userid: number;
  /** Post subject/title */
  subject: string;
  /** Post message/content */
  message: string;
  /** Message format (1=HTML, 0=MOODLE, 2=PLAIN, 4=MARKDOWN) */
  messageformat: number;
  /** Whether post has attachments */
  attachment?: boolean;
  /** Unix timestamp of post creation */
  created: number;
  /** Unix timestamp of last modification */
  modified: number;
  /** Author information */
  author?: {
    id: number;
    firstname: string;
    lastname: string;
    fullname: string;
    profileimageurl: string;
  };
  /** Array of attached files */
  attachments?: Array<{
    id: number;
    filename: string;
    filesize: number;
    mimetype: string;
    url: string;
  }>;
  /** Array of child posts (replies) */
  children?: ForumPost[];
}

/**
 * Test forum 1: General Programming Discussion
 * Standard general forum with optional subscription and tracking
 */
export const testForum1: Forum = {
  id: 201,
  courseid: testCourse1.id,
  name: 'General Programming Discussion',
  intro: '<p>This is a general forum for discussing programming concepts, sharing resources, and asking questions about the course material.</p>',
  type: FORUM_TYPES.GENERAL,
  maxattachments: 5,
  subscriptionmode: SUBSCRIPTION_MODES.CHOOSE_SUBSCRIBE,
  trackingtype: TRACKING_TYPES.OPTIONAL,
  timemodified: Math.floor(Date.now() / 1000) - 86400 * 7, // 7 days ago
  maxbytes: 10485760, // 10 MB
  completiondiscussions: 0,
  completionreplies: 0,
  completionposts: 0,
};

/**
 * Test forum 2: Q&A Forum for Questions
 * Question and answer forum where students must post before seeing others' posts
 */
export const testForum2: Forum = {
  id: 202,
  courseid: testCourse1.id,
  name: 'Q&A: Programming Help',
  intro: '<p>Ask your programming questions here. You must post your own answer attempt before you can see other students\' responses.</p>',
  type: FORUM_TYPES.QANDA,
  maxattachments: 3,
  subscriptionmode: SUBSCRIPTION_MODES.INITIAL_SUBSCRIBE,
  trackingtype: TRACKING_TYPES.FORCED,
  timemodified: Math.floor(Date.now() / 1000) - 86400 * 5, // 5 days ago
  maxbytes: 5242880, // 5 MB
  completiondiscussions: 1,
  completionreplies: 2,
  completionposts: 1,
};

/**
 * Test forum 3: Course Announcements
 * Single simple discussion forum for course announcements (teacher-only posting)
 */
export const testForum3: Forum = {
  id: 203,
  courseid: testCourse1.id,
  name: 'Course Announcements',
  intro: '<p>Important course announcements and updates will be posted here by your instructor.</p>',
  type: FORUM_TYPES.SINGLE,
  maxattachments: 10,
  subscriptionmode: SUBSCRIPTION_MODES.FORCE_SUBSCRIBE,
  trackingtype: TRACKING_TYPES.OFF,
  timemodified: Math.floor(Date.now() / 1000) - 86400 * 10, // 10 days ago
  maxbytes: 20971520, // 20 MB
};

/**
 * Sample post 1: Initial discussion post
 * Top-level post starting a discussion thread
 */
export const testPost1: ForumPost = {
  id: 301,
  discussionid: 251,
  parentid: 0, // Top-level post
  userid: testStudent.id,
  subject: 'How to debug Python code effectively?',
  message: '<p>I\'m having trouble debugging my Python assignments. What are some effective strategies and tools you recommend for finding and fixing bugs?</p><p>I\'ve tried using print statements but it gets messy with complex code.</p>',
  messageformat: 1, // HTML
  created: Math.floor(Date.now() / 1000) - 86400 * 3, // 3 days ago
  modified: Math.floor(Date.now() / 1000) - 86400 * 3,
  author: {
    id: testStudent.id,
    firstname: testStudent.firstname,
    lastname: testStudent.lastname,
    fullname: `${testStudent.firstname} ${testStudent.lastname}`,
    profileimageurl: testStudent.profileimageurl,
  },
};

/**
 * Sample post 2: Reply to discussion
 * Second-level post replying to testPost1
 */
export const testPost2: ForumPost = {
  id: 302,
  discussionid: 251,
  parentid: 301, // Reply to testPost1
  userid: testStudent2.id,
  subject: 'Re: How to debug Python code effectively?',
  message: '<p>Great question! I recommend using the built-in <code>pdb</code> debugger. You can add <code>import pdb; pdb.set_trace()</code> at any point in your code to set a breakpoint.</p><p>Also check out VS Code\'s debugging features - they\'re really helpful for stepping through code line by line.</p>',
  messageformat: 1, // HTML
  created: Math.floor(Date.now() / 1000) - 86400 * 2, // 2 days ago
  modified: Math.floor(Date.now() / 1000) - 86400 * 2,
  author: {
    id: testStudent2.id,
    firstname: testStudent2.firstname,
    lastname: testStudent2.lastname,
    fullname: `${testStudent2.firstname} ${testStudent2.lastname}`,
    profileimageurl: testStudent2.profileimageurl || 'https://www.gravatar.com/avatar/student2?d=mm&s=100',
  },
};

/**
 * Sample post with attachment
 * Post that includes a file attachment (PDF)
 */
export const testPostWithAttachment: ForumPost = {
  id: 303,
  discussionid: 252,
  parentid: 0, // Top-level post
  userid: testTeacher.id,
  subject: 'Week 5 Lecture Notes - Functions and Modules',
  message: '<p>Hello everyone,</p><p>Attached are the lecture notes from this week covering Python functions, modules, and package management.</p><p>Please review these before the next class session.</p>',
  messageformat: 1, // HTML
  attachment: true,
  created: Math.floor(Date.now() / 1000) - 86400 * 1, // 1 day ago
  modified: Math.floor(Date.now() / 1000) - 86400 * 1,
  author: {
    id: testTeacher.id,
    firstname: testTeacher.firstname,
    lastname: testTeacher.lastname,
    fullname: `${testTeacher.firstname} ${testTeacher.lastname}`,
    profileimageurl: testTeacher.profileimageurl,
  },
  attachments: [
    {
      id: samplePDFFile.id,
      filename: samplePDFFile.filename,
      filesize: samplePDFFile.filesize,
      mimetype: samplePDFFile.mimetype,
      url: samplePDFFile.url,
    },
  ],
};

/**
 * Test discussion 1: Python Debugging Discussion
 * Complete discussion with multiple posts and replies
 */
export const testDiscussion1: ForumDiscussion = {
  id: 251,
  forumid: testForum1.id,
  name: 'How to debug Python code effectively?',
  userid: testStudent.id,
  timemodified: Math.floor(Date.now() / 1000) - 86400 * 2, // 2 days ago (updated with last reply)
  numreplies: 3,
  pinned: 0,
  firstpost: testPost1.id,
  author: {
    id: testStudent.id,
    firstname: testStudent.firstname,
    lastname: testStudent.lastname,
    fullname: `${testStudent.firstname} ${testStudent.lastname}`,
  },
  posts: [
    testPost1,
    testPost2,
    {
      id: 304,
      discussionid: 251,
      parentid: 302, // Reply to testPost2
      userid: testTeacher.id,
      subject: 'Re: How to debug Python code effectively?',
      message: '<p>Excellent suggestions! I\'d also add that understanding error messages and stack traces is crucial. The Python documentation has a great guide on reading tracebacks.</p><p>For larger projects, consider using logging instead of print statements - the <code>logging</code> module is very powerful.</p>',
      messageformat: 1,
      created: Math.floor(Date.now() / 1000) - 86400 * 1.5, // 1.5 days ago
      modified: Math.floor(Date.now() / 1000) - 86400 * 1.5,
      author: {
        id: testTeacher.id,
        firstname: testTeacher.firstname,
        lastname: testTeacher.lastname,
        fullname: `${testTeacher.firstname} ${testTeacher.lastname}`,
        profileimageurl: testTeacher.profileimageurl,
      },
    },
  ],
};

/**
 * Test discussion 2: Lecture Notes Discussion
 * Discussion with attachment and fewer replies
 */
export const testDiscussion2: ForumDiscussion = {
  id: 252,
  forumid: testForum1.id,
  name: 'Week 5 Lecture Notes - Functions and Modules',
  userid: testTeacher.id,
  timemodified: Math.floor(Date.now() / 1000) - 86400 * 1, // 1 day ago
  numreplies: 1,
  pinned: 1, // Pinned by teacher
  firstpost: testPostWithAttachment.id,
  author: {
    id: testTeacher.id,
    firstname: testTeacher.firstname,
    lastname: testTeacher.lastname,
    fullname: `${testTeacher.firstname} ${testTeacher.lastname}`,
  },
  posts: [
    testPostWithAttachment,
    {
      id: 305,
      discussionid: 252,
      parentid: 303, // Reply to testPostWithAttachment
      userid: testStudent.id,
      subject: 'Re: Week 5 Lecture Notes - Functions and Modules',
      message: '<p>Thank you for sharing these notes! They\'re very helpful.</p><p>Quick question: on slide 12, could you explain the difference between <code>import module</code> and <code>from module import function</code>?</p>',
      messageformat: 1,
      created: Math.floor(Date.now() / 1000) - 86400 * 0.5, // 12 hours ago
      modified: Math.floor(Date.now() / 1000) - 86400 * 0.5,
      author: {
        id: testStudent.id,
        firstname: testStudent.firstname,
        lastname: testStudent.lastname,
        fullname: `${testStudent.firstname} ${testStudent.lastname}`,
        profileimageurl: testStudent.profileimageurl,
      },
    },
  ],
};

/**
 * Helper function to create a forum fixture with custom properties
 * Useful for generating multiple forum variations in tests
 * 
 * @param overrides - Partial forum object to override defaults
 * @returns Complete forum object with defaults merged with overrides
 */
export function createForum(overrides: Partial<Forum> = {}): Forum {
  const defaultForum: Forum = {
    id: Math.floor(Math.random() * 10000) + 1000,
    courseid: testCourse1.id,
    name: 'Test Forum',
    intro: '<p>Test forum description</p>',
    type: FORUM_TYPES.GENERAL,
    maxattachments: 5,
    subscriptionmode: SUBSCRIPTION_MODES.CHOOSE_SUBSCRIBE,
    trackingtype: TRACKING_TYPES.OPTIONAL,
    timemodified: Math.floor(Date.now() / 1000),
    maxbytes: 10485760, // 10 MB
  };

  return { ...defaultForum, ...overrides };
}

/**
 * Helper function to create a discussion fixture with custom properties
 * Useful for generating multiple discussion variations in tests
 * 
 * @param overrides - Partial discussion object to override defaults
 * @returns Complete discussion object with defaults merged with overrides
 */
export function createDiscussion(overrides: Partial<ForumDiscussion> = {}): ForumDiscussion {
  const defaultDiscussion: ForumDiscussion = {
    id: Math.floor(Math.random() * 10000) + 1000,
    forumid: testForum1.id,
    name: 'Test Discussion',
    userid: testStudent.id,
    timemodified: Math.floor(Date.now() / 1000),
    numreplies: 0,
    pinned: 0,
    author: {
      id: testStudent.id,
      firstname: testStudent.firstname,
      lastname: testStudent.lastname,
      fullname: `${testStudent.firstname} ${testStudent.lastname}`,
    },
  };

  return { ...defaultDiscussion, ...overrides };
}

/**
 * Helper function to create a post fixture with custom properties
 * Supports creating both top-level posts and replies
 * 
 * @param overrides - Partial post object to override defaults
 * @returns Complete post object with defaults merged with overrides
 */
export function createPost(overrides: Partial<ForumPost> = {}): ForumPost {
  const isReply = overrides.parentid && overrides.parentid > 0;
  const defaultPost: ForumPost = {
    id: Math.floor(Math.random() * 10000) + 1000,
    discussionid: testDiscussion1.id,
    parentid: 0,
    userid: testStudent.id,
    subject: isReply ? 'Re: Test Post' : 'Test Post',
    message: '<p>This is a test post message.</p>',
    messageformat: 1, // HTML
    created: Math.floor(Date.now() / 1000),
    modified: Math.floor(Date.now() / 1000),
    author: {
      id: testStudent.id,
      firstname: testStudent.firstname,
      lastname: testStudent.lastname,
      fullname: `${testStudent.firstname} ${testStudent.lastname}`,
      profileimageurl: testStudent.profileimageurl,
    },
  };

  return { ...defaultPost, ...overrides };
}
