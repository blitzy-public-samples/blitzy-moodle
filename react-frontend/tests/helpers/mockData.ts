/**
 * Mock Data Generators for Testing
 * 
 * Provides comprehensive factory functions for generating realistic test fixtures across all
 * major Moodle entities. These utilities reduce test boilerplate, ensure consistent test patterns,
 * and support flexible customization through partial overrides.
 * 
 * Each factory function returns a complete entity with sensible defaults that match actual Moodle
 * data structures. Tests can override specific properties as needed while maintaining type safety.
 * 
 * @example
 * ```typescript
 * // Create a default user
 * const user = createMockUser();
 * 
 * // Create a user with custom properties
 * const admin = createMockAdmin({ email: 'admin@example.com' });
 * 
 * // Create an array of mock courses
 * const courses = generateMockArray(createMockCourse, 5);
 * ```
 * 
 * @see Section 0.3 Target Design - Test Infrastructure
 * @see react-frontend/src/types/entities.ts - Entity type definitions
 */

import type {
  User,
  Course,
  Assignment,
  AssignmentSubmission,
  Quiz,
  QuizAttempt,
  Forum,
  ForumDiscussion,
  ForumPost,
  Grade,
  GradeItem,
  Message,
} from '@/types/entities';
import type { Conversation } from '@/features/messaging/types/message.types';
import type { Question } from '@/features/activities/quizzes/types/quiz.types';
import type { Resource } from '@/features/activities/resources/types/resource.types';

/**
 * Generates a random mock ID for test entities.
 * Uses a large random number to avoid collisions in test data.
 * 
 * @returns {number} Random integer between 1 and 1,000,000
 * 
 * @example
 * ```typescript
 * const userId = generateMockId(); // e.g., 742891
 * ```
 */
export function generateMockId(): number {
  return Math.floor(Math.random() * 1000000) + 1;
}

/**
 * Generates a mock timestamp relative to the current time.
 * Useful for creating realistic dates in the past or future.
 * 
 * @param {number} daysOffset - Number of days offset from now (negative for past, positive for future)
 * @returns {number} Unix timestamp in seconds
 * 
 * @example
 * ```typescript
 * const yesterday = generateMockDate(-1);
 * const nextWeek = generateMockDate(7);
 * const now = generateMockDate(0);
 * ```
 */
export function generateMockDate(daysOffset: number = 0): number {
  const now = Date.now();
  const offsetMs = daysOffset * 24 * 60 * 60 * 1000;
  return Math.floor((now + offsetMs) / 1000);
}

/**
 * Generates an array of mock entities using a factory function.
 * Reduces boilerplate when creating multiple test fixtures.
 * 
 * @template T - The type of entity to generate
 * @param {() => T} factory - Factory function that creates a single entity
 * @param {number} count - Number of entities to generate
 * @returns {T[]} Array of generated entities
 * 
 * @example
 * ```typescript
 * const users = generateMockArray(createMockUser, 10);
 * const courses = generateMockArray(() => createMockCourse({ visible: true }), 5);
 * ```
 */
export function generateMockArray<T>(factory: () => T, count: number): T[] {
  return Array.from({ length: count }, factory);
}

/**
 * Creates a mock user with realistic default values.
 * Supports partial overrides for customizing specific properties.
 * 
 * @param {Partial<User>} overrides - Properties to override in the default user
 * @returns {User} Complete user entity with all required fields
 * 
 * @example
 * ```typescript
 * const user = createMockUser();
 * const customUser = createMockUser({ email: 'test@example.com', firstname: 'Jane' });
 * ```
 */
export function createMockUser(overrides: Partial<User> = {}): User {
  const id = overrides.id ?? generateMockId();
  const firstname = overrides.firstname ?? 'John';
  const lastname = overrides.lastname ?? 'Doe';
  const username = overrides.username ?? `user${id}`;

  return {
    id,
    username,
    firstname,
    lastname,
    fullname: overrides.fullname ?? `${firstname} ${lastname}`,
    email: overrides.email ?? `${username}@example.com`,
    emailstop: overrides.emailstop ?? false,
    phone1: overrides.phone1,
    phone2: overrides.phone2,
    institution: overrides.institution,
    department: overrides.department,
    address: overrides.address,
    city: overrides.city ?? 'Test City',
    country: overrides.country ?? 'US',
    lang: overrides.lang ?? 'en',
    timezone: overrides.timezone ?? 'UTC',
    firstaccess: overrides.firstaccess ?? generateMockDate(-30),
    lastaccess: overrides.lastaccess ?? generateMockDate(-1),
    lastlogin: overrides.lastlogin ?? generateMockDate(-1),
    currentlogin: overrides.currentlogin ?? generateMockDate(0),
    picture: overrides.picture,
    imagealt: overrides.imagealt,
    profileimageurl: overrides.profileimageurl,
    profileimageurlsmall: overrides.profileimageurlsmall,
    suspended: overrides.suspended ?? false,
    confirmed: overrides.confirmed ?? true,
    auth: overrides.auth ?? 'manual',
    theme: overrides.theme,
    description: overrides.description,
    descriptionformat: overrides.descriptionformat ?? 1,
    mailformat: overrides.mailformat ?? 1,
    maildigest: overrides.maildigest ?? 0,
    maildisplay: overrides.maildisplay ?? 2,
    autosubscribe: overrides.autosubscribe ?? true,
    trackforums: overrides.trackforums ?? false,
    timecreated: overrides.timecreated ?? generateMockDate(-90),
    timemodified: overrides.timemodified ?? generateMockDate(-1),
    trustbitmask: overrides.trustbitmask ?? 0,
    deleted: overrides.deleted ?? false,
    calendartype: overrides.calendartype ?? 'gregorian',
    preferences: overrides.preferences ?? {},
    customfields: overrides.customfields ?? [],
    roles: overrides.roles ?? [],
  };
}

/**
 * Creates a mock student user with student role.
 * Convenience function for common test scenario.
 * 
 * @param {Partial<User>} overrides - Additional properties to override
 * @returns {User} User entity configured as a student
 * 
 * @example
 * ```typescript
 * const student = createMockStudent();
 * const namedStudent = createMockStudent({ firstname: 'Alice', lastname: 'Smith' });
 * ```
 */
export function createMockStudent(overrides: Partial<User> = {}): User {
  const id = overrides.id ?? generateMockId();
  return createMockUser({
    id,
    username: `student${id}`,
    firstname: 'Student',
    lastname: 'User',
    roles: [
      {
        id: 5,
        name: 'student',
        shortname: 'student',
        description: '',
        sortorder: 5,
        archetype: 'student',
      },
    ],
    ...overrides,
  });
}

/**
 * Creates a mock teacher user with editing teacher role.
 * Convenience function for common test scenario.
 * 
 * @param {Partial<User>} overrides - Additional properties to override
 * @returns {User} User entity configured as a teacher
 * 
 * @example
 * ```typescript
 * const teacher = createMockTeacher();
 * const namedTeacher = createMockTeacher({ firstname: 'Bob', lastname: 'Johnson' });
 * ```
 */
export function createMockTeacher(overrides: Partial<User> = {}): User {
  const id = overrides.id ?? generateMockId();
  return createMockUser({
    id,
    username: `teacher${id}`,
    firstname: 'Teacher',
    lastname: 'User',
    roles: [
      {
        id: 3,
        name: 'editingteacher',
        shortname: 'editingteacher',
        description: '',
        sortorder: 3,
        archetype: 'editingteacher',
      },
    ],
    ...overrides,
  });
}

/**
 * Creates a mock admin user with site administrator role.
 * Convenience function for common test scenario.
 * 
 * @param {Partial<User>} overrides - Additional properties to override
 * @returns {User} User entity configured as an administrator
 * 
 * @example
 * ```typescript
 * const admin = createMockAdmin();
 * const namedAdmin = createMockAdmin({ email: 'admin@school.edu' });
 * ```
 */
export function createMockAdmin(overrides: Partial<User> = {}): User {
  const id = overrides.id ?? generateMockId();
  return createMockUser({
    id,
    username: `admin${id}`,
    firstname: 'Admin',
    lastname: 'User',
    roles: [
      {
        id: 1,
        name: 'manager',
        shortname: 'manager',
        description: '',
        sortorder: 1,
        archetype: 'manager',
      },
    ],
    ...overrides,
  });
}

/**
 * Creates a mock course with realistic default values.
 * Includes all standard course properties with sensible defaults.
 * 
 * @param {Partial<Course>} overrides - Properties to override in the default course
 * @returns {Course} Complete course entity with all required fields
 * 
 * @example
 * ```typescript
 * const course = createMockCourse();
 * const customCourse = createMockCourse({ fullname: 'Advanced Mathematics', visible: false });
 * ```
 */
export function createMockCourse(overrides: Partial<Course> = {}): Course {
  const id = overrides.id ?? generateMockId();
  const shortname = overrides.shortname ?? `COURSE${id}`;

  return {
    id,
    shortname,
    fullname: overrides.fullname ?? `Test Course ${id}`,
    displayname: overrides.displayname ?? overrides.fullname ?? `Test Course ${id}`,
    idnumber: overrides.idnumber ?? ``,
    summary: overrides.summary ?? 'This is a test course for automated testing purposes.',
    summaryformat: overrides.summaryformat ?? 1,
    format: overrides.format ?? 'topics',
    showgrades: overrides.showgrades ?? true,
    newsitems: overrides.newsitems ?? 5,
    startdate: overrides.startdate ?? generateMockDate(-30),
    enddate: overrides.enddate ?? generateMockDate(90),
    marker: overrides.marker ?? 0,
    maxbytes: overrides.maxbytes ?? 0,
    legacyfiles: overrides.legacyfiles ?? 0,
    showreports: overrides.showreports ?? false,
    visible: overrides.visible ?? true,
    groupmode: overrides.groupmode ?? 0,
    groupmodeforce: overrides.groupmodeforce ?? false,
    defaultgroupingid: overrides.defaultgroupingid ?? 0,
    lang: overrides.lang ?? '',
    theme: overrides.theme ?? '',
    timecreated: overrides.timecreated ?? generateMockDate(-60),
    timemodified: overrides.timemodified ?? generateMockDate(-1),
    requested: overrides.requested ?? false,
    enablecompletion: overrides.enablecompletion ?? true,
    completionnotify: overrides.completionnotify ?? false,
    category: overrides.category ?? 1,
    sortorder: overrides.sortorder ?? 0,
    showactivitydates: overrides.showactivitydates ?? true,
    enrollmentmethods: overrides.enrollmentmethods ?? [],
    modules: overrides.modules ?? [],
    sections: overrides.sections ?? [],
    progress: overrides.progress,
    isenrolled: overrides.isenrolled ?? false,
    canaccess: overrides.canaccess ?? true,
  };
}

/**
 * Creates a mock assignment with realistic default values.
 * Includes submission settings and grading configuration.
 * 
 * @param {Partial<Assignment>} overrides - Properties to override
 * @returns {Assignment} Complete assignment entity
 * 
 * @example
 * ```typescript
 * const assignment = createMockAssignment();
 * const urgentAssignment = createMockAssignment({ duedate: generateMockDate(1) });
 * ```
 */
export function createMockAssignment(overrides: Partial<Assignment> = {}): Assignment {
  const id = overrides.id ?? generateMockId();

  return {
    id,
    course: overrides.course ?? generateMockId(),
    name: overrides.name ?? `Assignment ${id}`,
    intro: overrides.intro ?? 'This is a test assignment description.',
    introformat: overrides.introformat ?? 1,
    alwaysshowdescription: overrides.alwaysshowdescription ?? true,
    nosubmissions: overrides.nosubmissions ?? false,
    submissiondrafts: overrides.submissiondrafts ?? false,
    sendnotifications: overrides.sendnotifications ?? false,
    sendlatenotifications: overrides.sendlatenotifications ?? false,
    sendstudentnotifications: overrides.sendstudentnotifications ?? true,
    duedate: overrides.duedate ?? generateMockDate(7),
    cutoffdate: overrides.cutoffdate ?? generateMockDate(14),
    gradingduedate: overrides.gradingduedate ?? generateMockDate(21),
    allowsubmissionsfromdate: overrides.allowsubmissionsfromdate ?? generateMockDate(-7),
    grade: overrides.grade ?? 100,
    timemodified: overrides.timemodified ?? generateMockDate(-1),
    timecreated: overrides.timecreated ?? generateMockDate(-30),
    requiresubmissionstatement: overrides.requiresubmissionstatement ?? false,
    completionsubmit: overrides.completionsubmit ?? false,
    teamsubmission: overrides.teamsubmission ?? false,
    requireallteammemberssubmit: overrides.requireallteammemberssubmit ?? false,
    teamsubmissiongroupingid: overrides.teamsubmissiongroupingid ?? 0,
    blindmarking: overrides.blindmarking ?? false,
    hidegrader: overrides.hidegrader ?? false,
    revealidentities: overrides.revealidentities ?? false,
    attemptreopenmethod: overrides.attemptreopenmethod ?? 'none',
    maxattempts: overrides.maxattempts ?? -1,
    markingworkflow: overrides.markingworkflow ?? false,
    markingallocation: overrides.markingallocation ?? false,
    preventsubmissionnotingroup: overrides.preventsubmissionnotingroup ?? false,
  };
}

/**
 * Creates a mock assignment submission with realistic default values.
 * Includes submission status, grade, and feedback.
 * 
 * @param {Partial<AssignmentSubmission>} overrides - Properties to override
 * @returns {AssignmentSubmission} Complete submission entity
 * 
 * @example
 * ```typescript
 * const submission = createMockSubmission();
 * const gradedSubmission = createMockSubmission({ status: 'submitted', grade: 85 });
 * ```
 */
export function createMockSubmission(overrides: Partial<AssignmentSubmission> = {}): AssignmentSubmission {
  const id = overrides.id ?? generateMockId();

  return {
    id,
    assignment: overrides.assignment ?? generateMockId(),
    userid: overrides.userid ?? generateMockId(),
    timecreated: overrides.timecreated ?? generateMockDate(-5),
    timemodified: overrides.timemodified ?? generateMockDate(-2),
    status: overrides.status ?? 'submitted',
    groupid: overrides.groupid ?? 0,
    attemptnumber: overrides.attemptnumber ?? 0,
    latest: overrides.latest ?? true,
    grade: overrides.grade,
    grader: overrides.grader,
    timeremaining: overrides.timeremaining,
    gradingstatus: overrides.gradingstatus ?? 'notgraded',
    feedback: overrides.feedback,
    files: overrides.files ?? [],
    plugins: overrides.plugins ?? [],
  };
}

/**
 * Creates a mock quiz with realistic default values.
 * Includes timing, attempts, and grading configuration.
 * 
 * @param {Partial<Quiz>} overrides - Properties to override
 * @returns {Quiz} Complete quiz entity
 * 
 * @example
 * ```typescript
 * const quiz = createMockQuiz();
 * const timedQuiz = createMockQuiz({ timelimit: 3600, attempts: 1 });
 * ```
 */
export function createMockQuiz(overrides: Partial<Quiz> = {}): Quiz {
  const id = overrides.id ?? generateMockId();

  return {
    id,
    course: overrides.course ?? generateMockId(),
    name: overrides.name ?? `Quiz ${id}`,
    intro: overrides.intro ?? 'This is a test quiz description.',
    introformat: overrides.introformat ?? 1,
    timeopen: overrides.timeopen ?? generateMockDate(-7),
    timeclose: overrides.timeclose ?? generateMockDate(7),
    timelimit: overrides.timelimit ?? 0,
    overduehandling: overrides.overduehandling ?? 'autosubmit',
    graceperiod: overrides.graceperiod ?? 0,
    preferredbehaviour: overrides.preferredbehaviour ?? 'deferredfeedback',
    canredoquestions: overrides.canredoquestions ?? false,
    attempts: overrides.attempts ?? 0,
    attemptonlast: overrides.attemptonlast ?? false,
    grademethod: overrides.grademethod ?? 1,
    decimalpoints: overrides.decimalpoints ?? 2,
    questiondecimalpoints: overrides.questiondecimalpoints ?? -1,
    reviewattempt: overrides.reviewattempt ?? 1,
    reviewcorrectness: overrides.reviewcorrectness ?? 1,
    reviewmarks: overrides.reviewmarks ?? 1,
    reviewspecificfeedback: overrides.reviewspecificfeedback ?? 1,
    reviewgeneralfeedback: overrides.reviewgeneralfeedback ?? 1,
    reviewrightanswer: overrides.reviewrightanswer ?? 1,
    reviewoverallfeedback: overrides.reviewoverallfeedback ?? 1,
    questionsperpage: overrides.questionsperpage ?? 1,
    navmethod: overrides.navmethod ?? 'free',
    shuffleanswers: overrides.shuffleanswers ?? true,
    sumgrades: overrides.sumgrades ?? 100,
    grade: overrides.grade ?? 100,
    timecreated: overrides.timecreated ?? generateMockDate(-30),
    timemodified: overrides.timemodified ?? generateMockDate(-1),
    password: overrides.password ?? '',
    subnet: overrides.subnet ?? '',
    browsersecurity: overrides.browsersecurity ?? '-',
    delay1: overrides.delay1 ?? 0,
    delay2: overrides.delay2 ?? 0,
    showuserpicture: overrides.showuserpicture ?? false,
    showblocks: overrides.showblocks ?? false,
    completionattemptsexhausted: overrides.completionattemptsexhausted ?? false,
    completionpass: overrides.completionpass ?? false,
    allowofflineattempts: overrides.allowofflineattempts ?? false,
    questions: overrides.questions ?? [],
    hasfeedback: overrides.hasfeedback ?? true,
  };
}

/**
 * Creates a mock quiz attempt with realistic default values.
 * Represents a student's attempt at a quiz.
 * 
 * @param {Partial<QuizAttempt>} overrides - Properties to override
 * @returns {QuizAttempt} Complete quiz attempt entity
 * 
 * @example
 * ```typescript
 * const attempt = createMockQuizAttempt();
 * const completedAttempt = createMockQuizAttempt({ state: 'finished', sumgrades: 85 });
 * ```
 */
export function createMockQuizAttempt(overrides: Partial<QuizAttempt> = {}): QuizAttempt {
  const id = overrides.id ?? generateMockId();

  return {
    id,
    quiz: overrides.quiz ?? generateMockId(),
    userid: overrides.userid ?? generateMockId(),
    attempt: overrides.attempt ?? 1,
    uniqueid: overrides.uniqueid ?? generateMockId(),
    layout: overrides.layout ?? '1,2,3,4,5,0',
    currentpage: overrides.currentpage ?? 0,
    preview: overrides.preview ?? false,
    state: overrides.state ?? 'inprogress',
    timestart: overrides.timestart ?? generateMockDate(0),
    timefinish: overrides.timefinish ?? (overrides.state === 'finished' ? generateMockDate(0) : 0),
    timemodified: overrides.timemodified ?? generateMockDate(0),
    timemodifiedoffline: overrides.timemodifiedoffline ?? 0,
    timecheckstate: overrides.timecheckstate ?? null,
    sumgrades: overrides.sumgrades ?? null,
    gradednotificationsenttime: overrides.gradednotificationsenttime ?? null,
  };
}

/**
 * Creates a mock quiz question with realistic default values.
 * Supports different question types (multichoice, truefalse, shortanswer, etc.).
 * 
 * @param {Partial<Question>} overrides - Properties to override
 * @returns {Question} Complete question entity
 * 
 * @example
 * ```typescript
 * const question = createMockQuestion();
 * const mcQuestion = createMockQuestion({ qtype: 'multichoice', answers: [...] });
 * ```
 */
export function createMockQuestion(overrides: Partial<Question> = {}): Question {
  const id = overrides.id ?? generateMockId();

  return {
    id,
    type: overrides.type ?? 'multichoice',
    name: overrides.name ?? 'Question 1',
    questiontext: overrides.questiontext ?? '<div class="qtext">What is 2 + 2?</div>',
    questiontextformat: overrides.questiontextformat ?? 1,
    defaultmark: overrides.defaultmark ?? 1.0,
    options: overrides.options ?? {
      answers: [
        { id: 1, answer: '3', answerformat: 1, fraction: 0, feedback: 'Incorrect', feedbackformat: 1 },
        { id: 2, answer: '4', answerformat: 1, fraction: 1, feedback: 'Correct!', feedbackformat: 1 },
        { id: 3, answer: '5', answerformat: 1, fraction: 0, feedback: 'Incorrect', feedbackformat: 1 },
      ],
      shuffleanswers: true,
      single: true,
    },
    state: overrides.state ?? 'todo',
    mark: overrides.mark ?? null,
    maxmark: overrides.maxmark ?? 1.0,
    fraction: overrides.fraction ?? null,
    flagged: overrides.flagged ?? false,
    slot: overrides.slot ?? 1,
    page: overrides.page ?? 1,
    displaynumber: overrides.displaynumber ?? '1',
    feedback: overrides.feedback,
    generalfeedback: overrides.generalfeedback,
    rightanswer: overrides.rightanswer,
    response: overrides.response,
    responsesummary: overrides.responsesummary,
  };
}

/**
 * Creates a mock forum with realistic default values.
 * Includes forum type, subscription settings, and discussions.
 * 
 * @param {Partial<Forum>} overrides - Properties to override
 * @returns {Forum} Complete forum entity
 * 
 * @example
 * ```typescript
 * const forum = createMockForum();
 * const newsChannel = createMockForum({ type: 'news', name: 'Course Announcements' });
 * ```
 */
export function createMockForum(overrides: Partial<Forum> = {}): Forum {
  const id = overrides.id ?? generateMockId();

  return {
    id,
    course: overrides.course ?? generateMockId(),
    type: overrides.type ?? 'general',
    name: overrides.name ?? `Forum ${id}`,
    intro: overrides.intro ?? 'This is a test forum for discussions.',
    introformat: overrides.introformat ?? 1,
    duedate: overrides.duedate ?? 0,
    cutoffdate: overrides.cutoffdate ?? 0,
    assessed: overrides.assessed ?? 0,
    assesstimestart: overrides.assesstimestart ?? 0,
    assesstimefinish: overrides.assesstimefinish ?? 0,
    scale: overrides.scale ?? 0,
    grade_forum: overrides.grade_forum ?? 0,
    maxbytes: overrides.maxbytes ?? 0,
    maxattachments: overrides.maxattachments ?? 1,
    forcesubscribe: overrides.forcesubscribe ?? 0,
    trackingtype: overrides.trackingtype ?? 1,
    rsstype: overrides.rsstype ?? 0,
    rssarticles: overrides.rssarticles ?? 0,
    timemodified: overrides.timemodified ?? generateMockDate(-1),
    warnafter: overrides.warnafter ?? 0,
    blockafter: overrides.blockafter ?? 0,
    blockperiod: overrides.blockperiod ?? 0,
    completiondiscussions: overrides.completiondiscussions ?? 0,
    completionreplies: overrides.completionreplies ?? 0,
    completionposts: overrides.completionposts ?? 0,
    displaywordcount: overrides.displaywordcount ?? false,
    lockdiscussionafter: overrides.lockdiscussionafter ?? 0,
    discussions: overrides.discussions ?? [],
    canaddinstance: overrides.canaddinstance ?? true,
  };
}

/**
 * Creates a mock forum discussion with realistic default values.
 * Represents a discussion thread within a forum.
 * 
 * @param {Partial<ForumDiscussion>} overrides - Properties to override
 * @returns {ForumDiscussion} Complete discussion entity
 * 
 * @example
 * ```typescript
 * const discussion = createMockDiscussion();
 * const pinnedDiscussion = createMockDiscussion({ pinned: true, name: 'Important Topic' });
 * ```
 */
export function createMockDiscussion(overrides: Partial<ForumDiscussion> = {}): ForumDiscussion {
  const id = overrides.id ?? generateMockId();

  return {
    id,
    course: overrides.course ?? generateMockId(),
    forum: overrides.forum ?? generateMockId(),
    name: overrides.name ?? `Discussion ${id}`,
    firstpost: overrides.firstpost ?? generateMockId(),
    userid: overrides.userid ?? generateMockId(),
    groupid: overrides.groupid ?? -1,
    assessed: overrides.assessed ?? false,
    timemodified: overrides.timemodified ?? generateMockDate(-1),
    usermodified: overrides.usermodified ?? 0,
    timestart: overrides.timestart ?? 0,
    timeend: overrides.timeend ?? 0,
    pinned: overrides.pinned ?? false,
    timelocked: overrides.timelocked ?? 0,
    posts: overrides.posts ?? [],
    userfullname: overrides.userfullname ?? 'Test User',
    userpictureurl: overrides.userpictureurl ?? '',
    numreplies: overrides.numreplies ?? 0,
    numunread: overrides.numunread ?? 0,
    timecreated: overrides.timecreated ?? generateMockDate(-7),
  };
}

/**
 * Creates a mock forum post with realistic default values.
 * Represents an individual post within a forum discussion.
 * 
 * @param {Partial<ForumPost>} overrides - Properties to override
 * @returns {ForumPost} Complete post entity
 * 
 * @example
 * ```typescript
 * const post = createMockPost();
 * const replyPost = createMockPost({ parent: parentPostId, subject: 'Re: Original Post' });
 * ```
 */
export function createMockPost(overrides: Partial<ForumPost> = {}): ForumPost {
  const id = overrides.id ?? generateMockId();

  return {
    id,
    discussion: overrides.discussion ?? generateMockId(),
    parent: overrides.parent ?? 0,
    userid: overrides.userid ?? generateMockId(),
    created: overrides.created ?? generateMockDate(-2),
    modified: overrides.modified ?? generateMockDate(-2),
    mailed: overrides.mailed ?? 1,
    subject: overrides.subject ?? `Post ${id}`,
    message: overrides.message ?? 'This is a test forum post message.',
    messageformat: overrides.messageformat ?? 1,
    messagetrust: overrides.messagetrust ?? false,
    attachment: overrides.attachment ?? false,
    totalscore: overrides.totalscore ?? 0,
    mailnow: overrides.mailnow ?? false,
    deleted: overrides.deleted ?? false,
    privatereplyto: overrides.privatereplyto ?? 0,
    userfullname: overrides.userfullname ?? 'Test User',
    userpictureurl: overrides.userpictureurl ?? '',
    hasparent: overrides.hasparent ?? false,
    isprivatereply: overrides.isprivatereply ?? false,
    tags: overrides.tags ?? [],
    attachments: overrides.attachments ?? [],
    capabilities: overrides.capabilities ?? {
      view: true,
      edit: false,
      delete: false,
      split: false,
      reply: true,
      export: true,
      controlreadstatus: true,
      canreplyprivately: false,
      selfenrol: false,
    },
  };
}

/**
 * Creates a mock grade with realistic default values.
 * Represents a grade for a specific grade item and user.
 * 
 * @param {Partial<Grade>} overrides - Properties to override
 * @returns {Grade} Complete grade entity
 * 
 * @example
 * ```typescript
 * const grade = createMockGrade();
 * const perfectGrade = createMockGrade({ finalgrade: 100, feedback: 'Excellent work!' });
 * ```
 */
export function createMockGrade(overrides: Partial<Grade> = {}): Grade {
  const id = overrides.id ?? generateMockId();

  return {
    id,
    itemid: overrides.itemid ?? generateMockId(),
    userid: overrides.userid ?? generateMockId(),
    rawgrade: overrides.rawgrade ?? null,
    rawgrademax: overrides.rawgrademax ?? 100,
    rawgrademin: overrides.rawgrademin ?? 0,
    rawscaleid: overrides.rawscaleid ?? null,
    usermodified: overrides.usermodified ?? null,
    finalgrade: overrides.finalgrade ?? null,
    hidden: overrides.hidden ?? 0,
    locked: overrides.locked ?? 0,
    locktime: overrides.locktime ?? 0,
    exported: overrides.exported ?? 0,
    overridden: overrides.overridden ?? 0,
    excluded: overrides.excluded ?? 0,
    feedback: overrides.feedback ?? null,
    feedbackformat: overrides.feedbackformat ?? 1,
    information: overrides.information ?? null,
    informationformat: overrides.informationformat ?? 0,
    timecreated: overrides.timecreated ?? generateMockDate(-5),
    timemodified: overrides.timemodified ?? generateMockDate(-1),
    aggregationstatus: overrides.aggregationstatus ?? 'unknown',
    aggregationweight: overrides.aggregationweight ?? null,
  };
}

/**
 * Creates a mock grade item with realistic default values.
 * Represents a gradeable item in the gradebook (assignment, quiz, manual grade, etc.).
 * 
 * @param {Partial<GradeItem>} overrides - Properties to override
 * @returns {GradeItem} Complete grade item entity
 * 
 * @example
 * ```typescript
 * const gradeItem = createMockGradeItem();
 * const assignmentGrade = createMockGradeItem({ itemtype: 'mod', itemmodule: 'assign' });
 * ```
 */
export function createMockGradeItem(overrides: Partial<GradeItem> = {}): GradeItem {
  const id = overrides.id ?? generateMockId();

  return {
    id,
    courseid: overrides.courseid ?? generateMockId(),
    categoryid: overrides.categoryid ?? null,
    itemname: overrides.itemname ?? `Grade Item ${id}`,
    itemtype: overrides.itemtype ?? 'manual',
    itemmodule: overrides.itemmodule ?? null,
    iteminstance: overrides.iteminstance ?? null,
    itemnumber: overrides.itemnumber ?? 0,
    iteminfo: overrides.iteminfo ?? null,
    idnumber: overrides.idnumber ?? null,
    calculation: overrides.calculation ?? null,
    gradetype: overrides.gradetype ?? 1,
    grademax: overrides.grademax ?? 100,
    grademin: overrides.grademin ?? 0,
    scaleid: overrides.scaleid ?? null,
    outcomeid: overrides.outcomeid ?? null,
    gradepass: overrides.gradepass ?? 0,
    multfactor: overrides.multfactor ?? 1.0,
    plusfactor: overrides.plusfactor ?? 0.0,
    aggregationcoef: overrides.aggregationcoef ?? 0.0,
    aggregationcoef2: overrides.aggregationcoef2 ?? 0.0,
    sortorder: overrides.sortorder ?? 0,
    display: overrides.display ?? 0,
    decimals: overrides.decimals ?? null,
    hidden: overrides.hidden ?? 0,
    locked: overrides.locked ?? 0,
    locktime: overrides.locktime ?? 0,
    needsupdate: overrides.needsupdate ?? 0,
    weightoverride: overrides.weightoverride ?? 0,
    timecreated: overrides.timecreated ?? generateMockDate(-30),
    timemodified: overrides.timemodified ?? generateMockDate(-1),
  };
}

/**
 * Creates a mock message with realistic default values.
 * Represents a message between two users.
 * 
 * @param {Partial<Message>} overrides - Properties to override
 * @returns {Message} Complete message entity
 * 
 * @example
 * ```typescript
 * const message = createMockMessage();
 * const unreadMessage = createMockMessage({ timeread: null, text: 'Urgent question!' });
 * ```
 */
export function createMockMessage(overrides: Partial<Message> = {}): Message {
  const id = overrides.id ?? generateMockId();

  return {
    id,
    useridfrom: overrides.useridfrom ?? generateMockId(),
    useridto: overrides.useridto ?? generateMockId(),
    subject: overrides.subject ?? `Message ${id}`,
    fullmessage: overrides.fullmessage ?? 'This is a test message.',
    fullmessageformat: overrides.fullmessageformat ?? 1,
    fullmessagehtml: overrides.fullmessagehtml ?? '<p>This is a test message.</p>',
    smallmessage: overrides.smallmessage ?? 'This is a test message.',
    notification: overrides.notification ?? false,
    contexturl: overrides.contexturl ?? null,
    contexturlname: overrides.contexturlname ?? null,
    timecreated: overrides.timecreated ?? generateMockDate(-1),
    timeread: overrides.timeread ?? null,
    timeuserfromdeleted: overrides.timeuserfromdeleted ?? 0,
    timeusertodeleted: overrides.timeusertodeleted ?? 0,
    component: overrides.component ?? null,
    eventtype: overrides.eventtype ?? null,
    customdata: overrides.customdata ?? null,
    userfromfullname: overrides.userfromfullname ?? 'Test User',
    usertofullname: overrides.usertofullname ?? 'Another User',
    conversationid: overrides.conversationid ?? generateMockId(),
  };
}

/**
 * Creates a mock conversation with realistic default values.
 * Represents a messaging conversation thread between users.
 * 
 * @param {Partial<Conversation>} overrides - Properties to override
 * @returns {Conversation} Complete conversation entity
 * 
 * @example
 * ```typescript
 * const conversation = createMockConversation();
 * const groupChat = createMockConversation({ type: 2, name: 'Study Group' });
 * ```
 */
export function createMockConversation(overrides: Partial<Conversation> = {}): Conversation {
  const id = overrides.id ?? generateMockId();

  return {
    id,
    type: overrides.type ?? 1,
    name: overrides.name ?? null,
    subname: overrides.subname ?? null,
    imageurl: overrides.imageurl ?? null,
    membercount: overrides.membercount ?? 2,
    isfavourite: overrides.isfavourite ?? false,
    isread: overrides.isread ?? true,
    unreadcount: overrides.unreadcount ?? 0,
    ismuted: overrides.ismuted ?? false,
    enabled: overrides.enabled ?? 1,
    timecreated: overrides.timecreated ?? generateMockDate(-14),
    timemodified: overrides.timemodified ?? generateMockDate(-1),
    members: overrides.members ?? [],
    messages: overrides.messages ?? [],
    candeletemessagesforallusers: overrides.candeletemessagesforallusers ?? false,
  };
}

/**
 * Creates a mock resource with realistic default values.
 * Represents a file or content resource in a course.
 * 
 * @param {Partial<Resource>} overrides - Properties to override
 * @returns {Resource} Complete resource entity
 * 
 * @example
 * ```typescript
 * const resource = createMockResource();
 * const pdfResource = createMockResource({ mimetype: 'application/pdf', name: 'Lecture Notes.pdf' });
 * ```
 */
export function createMockResource(overrides: Partial<Resource> = {}): Resource {
  const id = overrides.id ?? generateMockId();

  return {
    id,
    course: overrides.course ?? generateMockId(),
    name: overrides.name ?? `Resource ${id}`,
    intro: overrides.intro ?? 'This is a test resource.',
    introformat: overrides.introformat ?? 1,
    tobemigrated: overrides.tobemigrated ?? 0,
    legacyfiles: overrides.legacyfiles ?? 0,
    legacyfileslast: overrides.legacyfileslast ?? null,
    display: overrides.display ?? 0,
    displayoptions: overrides.displayoptions ?? '',
    filterfiles: overrides.filterfiles ?? 0,
    revision: overrides.revision ?? 1,
    timemodified: overrides.timemodified ?? generateMockDate(-1),
    timecreated: overrides.timecreated ?? generateMockDate(-30),
  };
}
