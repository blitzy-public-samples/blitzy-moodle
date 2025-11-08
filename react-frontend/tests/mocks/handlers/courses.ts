/**
 * MSW Request Handlers for Course Management API Endpoints
 * 
 * Provides comprehensive mock handlers for course-related API operations including:
 * - Course listing with pagination and filtering
 * - Course detail retrieval
 * - Course creation, update, and deletion
 * - Course enrollment
 * - Course content structure retrieval
 * 
 * All handlers return realistic mock data matching Moodle API response envelope format
 * and support various test scenarios including success and error cases.
 */

import { http, HttpResponse } from 'msw';

// ============================================================================
// TypeScript Type Definitions
// ============================================================================

/**
 * Course activity type definitions matching Moodle activity modules
 */
type ActivityType = 
  | 'assign' 
  | 'quiz' 
  | 'forum' 
  | 'resource' 
  | 'page' 
  | 'url' 
  | 'folder' 
  | 'lesson' 
  | 'workshop' 
  | 'wiki' 
  | 'glossary' 
  | 'book' 
  | 'scorm' 
  | 'h5pactivity' 
  | 'lti' 
  | 'choice' 
  | 'feedback' 
  | 'data';

/**
 * Course format types supported by Moodle
 */
type CourseFormat = 'weeks' | 'topics' | 'social' | 'singleactivity';

/**
 * Course activity within a section
 */
interface CourseActivity {
  id: number;
  name: string;
  modname: ActivityType;
  modplural: string;
  indent: number;
  url: string;
  visible: number;
  uservisible: boolean;
  availabilityinfo?: string;
  completion: number; // 0 = none, 1 = manual, 2 = automatic
  completiondata?: {
    state: number; // 0 = incomplete, 1 = complete, 2 = complete pass, 3 = complete fail
    timecompleted: number;
  };
  description?: string;
  dates?: Array<{
    label: string;
    timestamp: number;
  }>;
}

/**
 * Course section (week or topic)
 */
interface CourseSection {
  id: number;
  name: string;
  visible: number;
  summary: string;
  summaryformat: number;
  section: number;
  hiddenbynumsections: number;
  uservisible: boolean;
  availabilityinfo?: string;
  modules: CourseActivity[];
}

/**
 * Basic course information for listing
 */
interface CourseBasic {
  id: number;
  fullname: string;
  shortname: string;
  summary: string;
  summaryformat: number;
  categoryid: number;
  categoryname: string;
  format: CourseFormat;
  startdate: number;
  enddate: number;
  visible: number;
  enrolledusers: number;
  imageurl?: string;
  progress?: number;
  hasprogress?: boolean;
}

/**
 * Complete course details
 */
interface CourseDetail extends CourseBasic {
  idnumber: string;
  lang: string;
  numsections?: number;
  maxbytes: number;
  showreports: number;
  newsitems: number;
  groupmode: number;
  groupmodeforce: number;
  defaultgroupingid: number;
  enablecompletion: number;
  completionnotify: number;
  showgrades: number;
  showactivitydates: number;
  coursedisplay: number;
  sections?: CourseSection[];
  enrolled?: boolean;
  role?: string;
  canupdate?: boolean;
  canviewhiddencontent?: boolean;
}

/**
 * Course creation/update request body
 */
interface CourseRequest {
  fullname: string;
  shortname: string;
  categoryid: number;
  summary?: string;
  format?: CourseFormat;
  startdate?: number;
  enddate?: number;
  visible?: number;
  idnumber?: string;
  lang?: string;
  numsections?: number;
  showgrades?: number;
  enablecompletion?: number;
}

/**
 * Enrollment response
 */
interface EnrollmentResponse {
  success: boolean;
  courseid: number;
  userid: number;
  roleid: number;
  rolename: string;
  timeenrolled: number;
}

// ============================================================================
// Mock Data
// ============================================================================

/**
 * Mock course database
 */
const mockCourses: CourseDetail[] = [
  {
    id: 1,
    fullname: 'Introduction to Computer Science',
    shortname: 'CS101',
    summary: '<p>Comprehensive introduction to computer science fundamentals including programming, algorithms, and data structures.</p>',
    summaryformat: 1,
    categoryid: 1,
    categoryname: 'Computer Science',
    format: 'topics',
    startdate: Math.floor(Date.now() / 1000) - 86400 * 30, // 30 days ago
    enddate: Math.floor(Date.now() / 1000) + 86400 * 60, // 60 days from now
    visible: 1,
    enrolledusers: 45,
    imageurl: 'https://images.unsplash.com/photo-1516116216624-53e697fedbea',
    progress: 65,
    hasprogress: true,
    idnumber: 'CS101-2024',
    lang: 'en',
    numsections: 12,
    maxbytes: 52428800, // 50MB
    showreports: 1,
    newsitems: 5,
    groupmode: 1,
    groupmodeforce: 0,
    defaultgroupingid: 0,
    enablecompletion: 1,
    completionnotify: 1,
    showgrades: 1,
    showactivitydates: 1,
    coursedisplay: 0,
    enrolled: true,
    role: 'student',
    canupdate: false,
    canviewhiddencontent: false,
  },
  {
    id: 2,
    fullname: 'Advanced Database Systems',
    shortname: 'DB301',
    summary: '<p>Advanced topics in database design, SQL optimization, transaction management, and distributed databases.</p>',
    summaryformat: 1,
    categoryid: 1,
    categoryname: 'Computer Science',
    format: 'weeks',
    startdate: Math.floor(Date.now() / 1000) - 86400 * 45,
    enddate: Math.floor(Date.now() / 1000) + 86400 * 45,
    visible: 1,
    enrolledusers: 28,
    imageurl: 'https://images.unsplash.com/photo-1544383835-bda2bc66a55d',
    progress: 42,
    hasprogress: true,
    idnumber: 'DB301-2024',
    lang: 'en',
    numsections: 15,
    maxbytes: 104857600, // 100MB
    showreports: 1,
    newsitems: 5,
    groupmode: 2,
    groupmodeforce: 1,
    defaultgroupingid: 0,
    enablecompletion: 1,
    completionnotify: 1,
    showgrades: 1,
    showactivitydates: 1,
    coursedisplay: 0,
    enrolled: true,
    role: 'student',
    canupdate: false,
    canviewhiddencontent: false,
  },
  {
    id: 3,
    fullname: 'Web Development Fundamentals',
    shortname: 'WEB201',
    summary: '<p>Learn HTML5, CSS3, JavaScript, and modern web development practices. Build responsive, accessible web applications.</p>',
    summaryformat: 1,
    categoryid: 2,
    categoryname: 'Web Development',
    format: 'topics',
    startdate: Math.floor(Date.now() / 1000) - 86400 * 15,
    enddate: Math.floor(Date.now() / 1000) + 86400 * 75,
    visible: 1,
    enrolledusers: 67,
    imageurl: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085',
    progress: 23,
    hasprogress: true,
    idnumber: 'WEB201-2024',
    lang: 'en',
    numsections: 10,
    maxbytes: 52428800,
    showreports: 1,
    newsitems: 5,
    groupmode: 0,
    groupmodeforce: 0,
    defaultgroupingid: 0,
    enablecompletion: 1,
    completionnotify: 1,
    showgrades: 1,
    showactivitydates: 1,
    coursedisplay: 0,
    enrolled: false,
    role: undefined,
    canupdate: false,
    canviewhiddencontent: false,
  },
  {
    id: 4,
    fullname: 'Machine Learning and AI',
    shortname: 'ML401',
    summary: '<p>Explore machine learning algorithms, neural networks, and artificial intelligence applications.</p>',
    summaryformat: 1,
    categoryid: 1,
    categoryname: 'Computer Science',
    format: 'topics',
    startdate: Math.floor(Date.now() / 1000) + 86400 * 7, // Starts in 7 days
    enddate: Math.floor(Date.now() / 1000) + 86400 * 97,
    visible: 1,
    enrolledusers: 0,
    imageurl: 'https://images.unsplash.com/photo-1555255707-c07966088b7b',
    idnumber: 'ML401-2024',
    lang: 'en',
    numsections: 14,
    maxbytes: 104857600,
    showreports: 1,
    newsitems: 5,
    groupmode: 1,
    groupmodeforce: 0,
    defaultgroupingid: 0,
    enablecompletion: 1,
    completionnotify: 1,
    showgrades: 1,
    showactivitydates: 1,
    coursedisplay: 0,
    enrolled: false,
    role: 'editingteacher',
    canupdate: true,
    canviewhiddencontent: true,
  },
  {
    id: 5,
    fullname: 'Teacher Training Course',
    shortname: 'TEACH101',
    summary: '<p>Course for teacher role testing with edit capabilities.</p>',
    summaryformat: 1,
    categoryid: 3,
    categoryname: 'Training',
    format: 'topics',
    startdate: Math.floor(Date.now() / 1000) - 86400 * 60,
    enddate: Math.floor(Date.now() / 1000) + 86400 * 30,
    visible: 1,
    enrolledusers: 5,
    idnumber: 'TEACH101-2024',
    lang: 'en',
    numsections: 8,
    maxbytes: 52428800,
    showreports: 1,
    newsitems: 5,
    groupmode: 0,
    groupmodeforce: 0,
    defaultgroupingid: 0,
    enablecompletion: 1,
    completionnotify: 1,
    showgrades: 1,
    showactivitydates: 1,
    coursedisplay: 0,
    enrolled: true,
    role: 'editingteacher',
    canupdate: true,
    canviewhiddencontent: true,
  },
  {
    id: 6,
    fullname: 'Hidden Course for Testing',
    shortname: 'HIDDEN',
    summary: '<p>This course is hidden and should only be visible to teachers and admins.</p>',
    summaryformat: 1,
    categoryid: 3,
    categoryname: 'Training',
    format: 'topics',
    startdate: Math.floor(Date.now() / 1000) - 86400 * 90,
    enddate: Math.floor(Date.now() / 1000) + 86400 * 10,
    visible: 0,
    enrolledusers: 2,
    idnumber: 'HIDDEN-2024',
    lang: 'en',
    numsections: 5,
    maxbytes: 52428800,
    showreports: 1,
    newsitems: 5,
    groupmode: 0,
    groupmodeforce: 0,
    defaultgroupingid: 0,
    enablecompletion: 0,
    completionnotify: 0,
    showgrades: 1,
    showactivitydates: 1,
    coursedisplay: 0,
    enrolled: false,
    role: undefined,
    canupdate: false,
    canviewhiddencontent: false,
  },
];

/**
 * Mock course sections and activities
 */
const mockCourseSections: Record<number, CourseSection[]> = {
  1: [
    {
      id: 1,
      name: 'General',
      visible: 1,
      summary: '<p>Course introduction and general information</p>',
      summaryformat: 1,
      section: 0,
      hiddenbynumsections: 0,
      uservisible: true,
      modules: [
        {
          id: 1,
          name: 'Course Syllabus',
          modname: 'resource',
          modplural: 'Files',
          indent: 0,
          url: '/mod/resource/view.php?id=1',
          visible: 1,
          uservisible: true,
          completion: 1,
          completiondata: { state: 1, timecompleted: Math.floor(Date.now() / 1000) - 86400 * 25 },
          description: 'Download the complete course syllabus',
        },
        {
          id: 2,
          name: 'Introduction Forum',
          modname: 'forum',
          modplural: 'Forums',
          indent: 0,
          url: '/mod/forum/view.php?id=2',
          visible: 1,
          uservisible: true,
          completion: 0,
          description: 'Introduce yourself to your classmates',
        },
      ],
    },
    {
      id: 2,
      name: 'Week 1: Introduction to Programming',
      visible: 1,
      summary: '<p>Learn the basics of programming and write your first program</p>',
      summaryformat: 1,
      section: 1,
      hiddenbynumsections: 0,
      uservisible: true,
      modules: [
        {
          id: 3,
          name: 'Programming Basics Lecture',
          modname: 'page',
          modplural: 'Pages',
          indent: 0,
          url: '/mod/page/view.php?id=3',
          visible: 1,
          uservisible: true,
          completion: 2,
          completiondata: { state: 1, timecompleted: Math.floor(Date.now() / 1000) - 86400 * 20 },
          description: 'Read about programming fundamentals',
        },
        {
          id: 4,
          name: 'Hello World Assignment',
          modname: 'assign',
          modplural: 'Assignments',
          indent: 0,
          url: '/mod/assign/view.php?id=4',
          visible: 1,
          uservisible: true,
          completion: 2,
          completiondata: { state: 1, timecompleted: Math.floor(Date.now() / 1000) - 86400 * 18 },
          description: 'Write and submit your first program',
          dates: [
            { label: 'Due date', timestamp: Math.floor(Date.now() / 1000) - 86400 * 19 },
          ],
        },
        {
          id: 5,
          name: 'Week 1 Quiz',
          modname: 'quiz',
          modplural: 'Quizzes',
          indent: 0,
          url: '/mod/quiz/view.php?id=5',
          visible: 1,
          uservisible: true,
          completion: 2,
          completiondata: { state: 2, timecompleted: Math.floor(Date.now() / 1000) - 86400 * 17 },
          description: 'Test your knowledge of programming basics',
          dates: [
            { label: 'Opens', timestamp: Math.floor(Date.now() / 1000) - 86400 * 20 },
            { label: 'Closes', timestamp: Math.floor(Date.now() / 1000) - 86400 * 17 },
          ],
        },
      ],
    },
    {
      id: 3,
      name: 'Week 2: Control Structures',
      visible: 1,
      summary: '<p>Explore conditional statements and loops</p>',
      summaryformat: 1,
      section: 2,
      hiddenbynumsections: 0,
      uservisible: true,
      modules: [
        {
          id: 6,
          name: 'Control Flow Video',
          modname: 'url',
          modplural: 'URLs',
          indent: 0,
          url: '/mod/url/view.php?id=6',
          visible: 1,
          uservisible: true,
          completion: 1,
          description: 'Watch the control flow tutorial video',
        },
        {
          id: 7,
          name: 'Loop Exercises',
          modname: 'assign',
          modplural: 'Assignments',
          indent: 0,
          url: '/mod/assign/view.php?id=7',
          visible: 1,
          uservisible: true,
          completion: 2,
          description: 'Practice writing loops',
          dates: [
            { label: 'Due date', timestamp: Math.floor(Date.now() / 1000) + 86400 * 5 },
          ],
        },
      ],
    },
  ],
  2: [
    {
      id: 10,
      name: 'General',
      visible: 1,
      summary: '<p>Database course overview and resources</p>',
      summaryformat: 1,
      section: 0,
      hiddenbynumsections: 0,
      uservisible: true,
      modules: [
        {
          id: 20,
          name: 'Course Information',
          modname: 'page',
          modplural: 'Pages',
          indent: 0,
          url: '/mod/page/view.php?id=20',
          visible: 1,
          uservisible: true,
          completion: 0,
        },
      ],
    },
    {
      id: 11,
      name: 'Week 1: Database Design Principles',
      visible: 1,
      summary: '<p>Learn normalization and ER modeling</p>',
      summaryformat: 1,
      section: 1,
      hiddenbynumsections: 0,
      uservisible: true,
      modules: [
        {
          id: 21,
          name: 'ER Diagram Assignment',
          modname: 'assign',
          modplural: 'Assignments',
          indent: 0,
          url: '/mod/assign/view.php?id=21',
          visible: 1,
          uservisible: true,
          completion: 2,
          completiondata: { state: 1, timecompleted: Math.floor(Date.now() / 1000) - 86400 * 10 },
          dates: [
            { label: 'Due date', timestamp: Math.floor(Date.now() / 1000) - 86400 * 11 },
          ],
        },
        {
          id: 22,
          name: 'Normalization Quiz',
          modname: 'quiz',
          modplural: 'Quizzes',
          indent: 0,
          url: '/mod/quiz/view.php?id=22',
          visible: 1,
          uservisible: true,
          completion: 2,
          dates: [
            { label: 'Opens', timestamp: Math.floor(Date.now() / 1000) - 86400 * 12 },
            { label: 'Closes', timestamp: Math.floor(Date.now() / 1000) + 86400 * 2 },
          ],
        },
      ],
    },
  ],
};

/**
 * Simulates network latency
 */
const simulateLatency = () => new Promise(resolve => setTimeout(resolve, Math.random() * 300 + 100));

// ============================================================================
// Request Handlers
// ============================================================================

/**
 * GET /api/v1/courses
 * List courses with pagination and filtering
 */
const listCoursesHandler = http.get('http://*/api/v1/courses', async ({ request }) => {
  await simulateLatency();

  const url = new URL(request.url);
  
  // Extract query parameters
  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const perPage = parseInt(url.searchParams.get('perPage') || url.searchParams.get('limit') || '20', 10);
  const offset = parseInt(url.searchParams.get('offset') || '0', 10);
  const category = url.searchParams.get('category');
  const enrolled = url.searchParams.get('enrolled');
  const search = url.searchParams.get('search');
  const visible = url.searchParams.get('visible');
  const sortby = url.searchParams.get('sortby') || 'fullname';

  // Filter courses
  let filteredCourses = [...mockCourses];

  if (category) {
    const categoryId = parseInt(category, 10);
    filteredCourses = filteredCourses.filter(c => c.categoryid === categoryId);
  }

  if (enrolled === 'true') {
    filteredCourses = filteredCourses.filter(c => c.enrolled === true);
  } else if (enrolled === 'false') {
    filteredCourses = filteredCourses.filter(c => c.enrolled !== true);
  }

  if (search) {
    const searchLower = search.toLowerCase();
    filteredCourses = filteredCourses.filter(c => 
      c.fullname.toLowerCase().includes(searchLower) ||
      c.shortname.toLowerCase().includes(searchLower) ||
      c.summary.toLowerCase().includes(searchLower)
    );
  }

  if (visible !== null && visible !== undefined && visible !== '') {
    const visibleNum = parseInt(visible, 10);
    filteredCourses = filteredCourses.filter(c => c.visible === visibleNum);
  }

  // Sort courses
  filteredCourses.sort((a, b) => {
    switch (sortby) {
      case 'shortname':
        return a.shortname.localeCompare(b.shortname);
      case 'startdate':
        return b.startdate - a.startdate;
      case 'enrolledusers':
        return b.enrolledusers - a.enrolledusers;
      case 'fullname':
      default:
        return a.fullname.localeCompare(b.fullname);
    }
  });

  // Calculate pagination
  const total = filteredCourses.length;
  const startIndex = offset || (page - 1) * perPage;
  const endIndex = startIndex + perPage;
  const paginatedCourses = filteredCourses.slice(startIndex, endIndex);

  // Map to basic course info (remove sensitive fields for listing)
  const courseList: CourseBasic[] = paginatedCourses.map(c => ({
    id: c.id,
    fullname: c.fullname,
    shortname: c.shortname,
    summary: c.summary,
    summaryformat: c.summaryformat,
    categoryid: c.categoryid,
    categoryname: c.categoryname,
    format: c.format,
    startdate: c.startdate,
    enddate: c.enddate,
    visible: c.visible,
    enrolledusers: c.enrolledusers,
    imageurl: c.imageurl,
    progress: c.progress,
    hasprogress: c.hasprogress,
  }));

  return HttpResponse.json({
    success: true,
    data: courseList,
    meta: {
      pagination: {
        page: offset ? Math.floor(startIndex / perPage) + 1 : page,
        perPage,
        total,
        totalPages: Math.ceil(total / perPage),
      },
    },
  });
});

/**
 * GET /api/v1/courses/:id
 * Get course details by ID
 */
const showCourseHandler = http.get('http://*/api/v1/courses/:id', async ({ params }) => {
  await simulateLatency();

  const courseId = parseInt(params.id as string, 10);
  const course = mockCourses.find(c => c.id === courseId);

  if (!course) {
    return HttpResponse.json({
      success: false,
      error: {
        code: 'COURSE_NOT_FOUND',
        message: `Course with ID ${courseId} not found`,
        details: { courseId },
      },
    }, { status: 404 });
  }

  // Check visibility for non-enrolled users
  if (!course.enrolled && course.visible === 0) {
    return HttpResponse.json({
      success: false,
      error: {
        code: 'ACCESS_DENIED',
        message: 'You do not have permission to view this course',
        details: { required_capability: 'moodle/course:viewhiddencourses' },
      },
    }, { status: 403 });
  }

  // Include sections if enrolled
  const courseWithSections: CourseDetail = {
    ...course,
    sections: course.enrolled ? mockCourseSections[courseId] : undefined,
  };

  return HttpResponse.json({
    success: true,
    data: courseWithSections,
  });
});

/**
 * POST /api/v1/courses
 * Create a new course
 */
const createCourseHandler = http.post('http://*/api/v1/courses', async ({ request }) => {
  await simulateLatency();

  const body = await request.json() as CourseRequest;

  // Validate required fields
  if (!body.fullname || !body.shortname || !body.categoryid) {
    return HttpResponse.json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Missing required fields',
        details: {
          fields: {
            fullname: !body.fullname ? 'Full name is required' : undefined,
            shortname: !body.shortname ? 'Short name is required' : undefined,
            categoryid: !body.categoryid ? 'Category is required' : undefined,
          },
        },
      },
    }, { status: 422 });
  }

  // Check for duplicate shortname
  const existingCourse = mockCourses.find(c => c.shortname === body.shortname);
  if (existingCourse) {
    return HttpResponse.json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Course with this short name already exists',
        details: {
          fields: {
            shortname: 'Short name must be unique',
          },
        },
      },
    }, { status: 422 });
  }

  // Check permission (simplified - in real app would check JWT token)
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.includes('teacher') && !authHeader.includes('admin')) {
    return HttpResponse.json({
      success: false,
      error: {
        code: 'PERMISSION_DENIED',
        message: 'You do not have permission to create courses',
        details: { required_capability: 'moodle/course:create' },
      },
    }, { status: 403 });
  }

  // Create new course
  const newCourse: CourseDetail = {
    id: mockCourses.length + 1,
    fullname: body.fullname,
    shortname: body.shortname,
    summary: body.summary || '',
    summaryformat: 1,
    categoryid: body.categoryid,
    categoryname: 'New Category',
    format: body.format || 'topics',
    startdate: body.startdate || Math.floor(Date.now() / 1000),
    enddate: body.enddate || Math.floor(Date.now() / 1000) + 86400 * 90,
    visible: body.visible ?? 1,
    enrolledusers: 0,
    idnumber: body.idnumber || '',
    lang: body.lang || 'en',
    numsections: body.numsections || 10,
    maxbytes: 52428800,
    showreports: 1,
    newsitems: 5,
    groupmode: 0,
    groupmodeforce: 0,
    defaultgroupingid: 0,
    enablecompletion: body.enablecompletion ?? 1,
    completionnotify: 1,
    showgrades: body.showgrades ?? 1,
    showactivitydates: 1,
    coursedisplay: 0,
    enrolled: true,
    role: 'editingteacher',
    canupdate: true,
    canviewhiddencontent: true,
  };

  mockCourses.push(newCourse);

  return HttpResponse.json({
    success: true,
    data: newCourse,
  }, { status: 201 });
});

/**
 * PUT /api/v1/courses/:id
 * Update an existing course
 */
const updateCourseHandler = http.put('http://*/api/v1/courses/:id', async ({ params, request }) => {
  await simulateLatency();

  const courseId = parseInt(params.id as string, 10);
  const courseIndex = mockCourses.findIndex(c => c.id === courseId);

  if (courseIndex === -1) {
    return HttpResponse.json({
      success: false,
      error: {
        code: 'COURSE_NOT_FOUND',
        message: `Course with ID ${courseId} not found`,
        details: { courseId },
      },
    }, { status: 404 });
  }

  const course = mockCourses[courseIndex]!;

  // Check permission
  if (!course.canupdate) {
    return HttpResponse.json({
      success: false,
      error: {
        code: 'PERMISSION_DENIED',
        message: 'You do not have permission to update this course',
        details: { required_capability: 'moodle/course:update' },
      },
    }, { status: 403 });
  }

  const body = await request.json() as Partial<CourseRequest>;

  // Check for duplicate shortname if changing
  if (body.shortname && body.shortname !== course.shortname) {
    const existingCourse = mockCourses.find(c => c.shortname === body.shortname);
    if (existingCourse) {
      return HttpResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Course with this short name already exists',
          details: {
            fields: {
              shortname: 'Short name must be unique',
            },
          },
        },
      }, { status: 422 });
    }
  }

  // Update course (partial update)
  const updatedCourse: CourseDetail = {
    ...course,
    fullname: body.fullname ?? course.fullname,
    shortname: body.shortname ?? course.shortname,
    summary: body.summary ?? course.summary,
    categoryid: body.categoryid ?? course.categoryid,
    format: body.format ?? course.format,
    startdate: body.startdate ?? course.startdate,
    enddate: body.enddate ?? course.enddate,
    visible: body.visible ?? course.visible,
    idnumber: body.idnumber ?? course.idnumber,
    lang: body.lang ?? course.lang,
    numsections: body.numsections ?? course.numsections,
    showgrades: body.showgrades ?? course.showgrades,
    enablecompletion: body.enablecompletion ?? course.enablecompletion,
    maxbytes: course.maxbytes ?? 0,
    showreports: course.showreports ?? 0,
  };

  mockCourses[courseIndex] = updatedCourse;

  return HttpResponse.json({
    success: true,
    data: updatedCourse,
  });
});

/**
 * DELETE /api/v1/courses/:id
 * Delete a course
 */
const deleteCourseHandler = http.delete('http://*/api/v1/courses/:id', async ({ params }) => {
  await simulateLatency();

  const courseId = parseInt(params.id as string, 10);
  const courseIndex = mockCourses.findIndex(c => c.id === courseId);

  if (courseIndex === -1) {
    return HttpResponse.json({
      success: false,
      error: {
        code: 'COURSE_NOT_FOUND',
        message: `Course with ID ${courseId} not found`,
        details: { courseId },
      },
    }, { status: 404 });
  }

  const course = mockCourses[courseIndex]!;

  // Check permission
  if (!course.canupdate) {
    return HttpResponse.json({
      success: false,
      error: {
        code: 'PERMISSION_DENIED',
        message: 'You do not have permission to delete this course',
        details: { required_capability: 'moodle/course:delete' },
      },
    }, { status: 403 });
  }

  // Check if course has enrollments
  if (course.enrolledusers > 0) {
    return HttpResponse.json({
      success: false,
      error: {
        code: 'COURSE_HAS_ENROLLMENTS',
        message: 'Cannot delete course with active enrollments',
        details: { enrolledusers: course.enrolledusers },
      },
    }, { status: 409 });
  }

  // Delete course
  mockCourses.splice(courseIndex, 1);

  return HttpResponse.json({
    success: true,
    data: {
      message: 'Course deleted successfully',
      courseId,
    },
  });
});

/**
 * POST /api/v1/courses/:id/enroll
 * Enroll current user in a course
 */
const enrollCourseHandler = http.post('http://*/api/v1/courses/:id/enroll', async ({ params, request: _request }) => {
  await simulateLatency();

  const courseId = parseInt(params.id as string, 10);
  const course = mockCourses.find(c => c.id === courseId);

  if (!course) {
    return HttpResponse.json({
      success: false,
      error: {
        code: 'COURSE_NOT_FOUND',
        message: `Course with ID ${courseId} not found`,
        details: { courseId },
      },
    }, { status: 404 });
  }

  // Check if already enrolled
  if (course.enrolled) {
    return HttpResponse.json({
      success: false,
      error: {
        code: 'ALREADY_ENROLLED',
        message: 'You are already enrolled in this course',
        details: { courseId },
      },
    }, { status: 409 });
  }

  // Check if course is visible
  if (course.visible === 0) {
    return HttpResponse.json({
      success: false,
      error: {
        code: 'ENROLLMENT_CLOSED',
        message: 'This course is not available for enrollment',
        details: { courseId },
      },
    }, { status: 403 });
  }

  // Check if course is full (simulate capacity check)
  if (course.enrolledusers >= 100) {
    return HttpResponse.json({
      success: false,
      error: {
        code: 'COURSE_FULL',
        message: 'This course has reached maximum enrollment capacity',
        details: { courseId, maxEnrollments: 100 },
      },
    }, { status: 409 });
  }

  // Enroll user
  course.enrolled = true;
  course.role = 'student';
  course.enrolledusers += 1;
  course.progress = 0;
  course.hasprogress = true;

  const enrollmentResponse: EnrollmentResponse = {
    success: true,
    courseid: courseId,
    userid: 123, // Mock user ID
    roleid: 5, // Student role ID
    rolename: 'student',
    timeenrolled: Math.floor(Date.now() / 1000),
  };

  return HttpResponse.json({
    success: true,
    data: enrollmentResponse,
  });
});

/**
 * GET /api/v1/courses/:id/contents
 * Get course structure with sections and activities
 */
const getCourseContentsHandler = http.get('http://*/api/v1/courses/:id/contents', async ({ params }) => {
  await simulateLatency();

  const courseId = parseInt(params.id as string, 10);
  const course = mockCourses.find(c => c.id === courseId);

  if (!course) {
    return HttpResponse.json({
      success: false,
      error: {
        code: 'COURSE_NOT_FOUND',
        message: `Course with ID ${courseId} not found`,
        details: { courseId },
      },
    }, { status: 404 });
  }

  // Check enrollment for content access
  if (!course.enrolled) {
    return HttpResponse.json({
      success: false,
      error: {
        code: 'ACCESS_DENIED',
        message: 'You must be enrolled to view course contents',
        details: { required_capability: 'moodle/course:view' },
      },
    }, { status: 403 });
  }

  const sections = mockCourseSections[courseId] || [];

  return HttpResponse.json({
    success: true,
    data: {
      courseid: courseId,
      coursename: course.fullname,
      format: course.format,
      sections,
    },
  });
});

/**
 * GET /api/v1/courses/:courseId/groups
 * 
 * Returns the list of groups for a specific course. Used by the GroupFilter
 * component in the choice activity module.
 * 
 * Query Parameters:
 * - None
 * 
 * Success Response (200):
 * {
 *   success: true,
 *   data: [
 *     { id: 1, name: "Group A" },
 *     { id: 2, name: "Group B" }
 *   ]
 * }
 * 
 * Error Response (404):
 * {
 *   success: false,
 *   error: {
 *     code: "COURSE_NOT_FOUND",
 *     message: "Course not found",
 *     details: { courseId: 999 }
 *   }
 * }
 */
const getCourseGroupsHandler = http.get('*/api/v1/courses/:courseId/groups', ({ params }) => {
  const courseId = Number(params.courseId);
  
  // Validate courseId
  if (isNaN(courseId) || courseId <= 0) {
    return HttpResponse.json(
      {
        success: false,
        error: {
          code: 'INVALID_COURSE_ID',
          message: 'Invalid course ID',
          details: { courseId: params.courseId },
        },
      },
      { status: 400 }
    );
  }
  
  // Check if course exists
  const course = mockCourses.find((c) => c.id === courseId);
  if (!course) {
    return HttpResponse.json(
      {
        success: false,
        error: {
          code: 'COURSE_NOT_FOUND',
          message: 'Course not found',
          details: { courseId },
        },
      },
      { status: 404 }
    );
  }
  
  // Generate mock groups for the course
  // In a real scenario, these would come from the database
  const mockGroups = [
    { id: 1, name: 'Group A', courseid: courseId },
    { id: 2, name: 'Group B', courseid: courseId },
    { id: 3, name: 'Section 101', courseid: courseId },
    { id: 4, name: 'Section 102', courseid: courseId },
  ];
  
  return HttpResponse.json({
    success: true,
    data: mockGroups,
  });
});

// ============================================================================
// Export Handlers Array
// ============================================================================

/**
 * All course-related MSW request handlers
 */
export const coursesHandlers = [
  listCoursesHandler,
  showCourseHandler,
  createCourseHandler,
  updateCourseHandler,
  deleteCourseHandler,
  enrollCourseHandler,
  getCourseContentsHandler,
  getCourseGroupsHandler,
];
