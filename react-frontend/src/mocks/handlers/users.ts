/**
 * MSW Request Handlers for User Management API Endpoints
 * 
 * Provides mock implementations for user-related API endpoints including:
 * - User profile retrieval and updates
 * - Dashboard data aggregation
 * - Enrolled courses list
 * - User preferences management
 * 
 * Supports various test scenarios including different user roles,
 * permission levels, success and error cases for comprehensive testing.
 */

import { http, HttpResponse } from 'msw';
import { validateAuthToken } from './auth';

// ============================================================================
// TypeScript Type Definitions
// ============================================================================

interface User {
  id: number;
  username: string;
  email: string;
  firstname: string;
  lastname: string;
  fullname: string;
  profileimageurl: string;
  description: string;
  roles: string[];
  preferences: UserPreferences;
  created: number;
  lastaccess: number;
  suspended: boolean;
}

interface UserPreferences {
  theme: string;
  language: string;
  timezone: string;
  emailnotifications: boolean;
  calendardefaults: {
    maxevents: number;
    lookahead: number;
  };
}

interface DashboardData {
  upcomingEvents: Array<{
    id: number;
    name: string;
    coursename: string;
    timestart: number;
    eventtype: string;
  }>;
  recentActivity: Array<{
    id: number;
    coursename: string;
    activityname: string;
    action: string;
    timestamp: number;
  }>;
  courseProgress: Array<{
    courseid: number;
    coursename: string;
    progress: number;
    lastaccessed: number;
  }>;
  assignmentsDue: Array<{
    id: number;
    name: string;
    coursename: string;
    duedate: number;
    submitted: boolean;
  }>;
  messagesCount: {
    unread: number;
    total: number;
  };
  timeline: Array<{
    id: number;
    title: string;
    description: string;
    date: number;
    type: string;
  }>;
  badges: Array<{
    id: number;
    name: string;
    imageurl: string;
    dateissued: number;
  }>;
}

interface EnrolledCourse {
  id: number;
  fullname: string;
  shortname: string;
  summary: string;
  imageurl: string;
  progress: number;
  completed: boolean;
  lastaccessed: number;
  status: 'inprogress' | 'completed' | 'future';
  startdate: number;
  enddate: number;
  role: string;
}

interface UserUpdateRequest {
  username?: string;
  email?: string;
  firstname?: string;
  lastname?: string;
  description?: string;
  profileimageurl?: string;
}

interface PreferencesUpdateRequest {
  theme?: string;
  language?: string;
  timezone?: string;
  emailnotifications?: boolean;
  calendardefaults?: {
    maxevents?: number;
    lookahead?: number;
  };
}

// ============================================================================
// Mock Data
// ============================================================================

const mockUsers: Record<number, User> = {
  1: {
    id: 1,
    username: 'student1',
    email: 'student1@example.com',
    firstname: 'John',
    lastname: 'Student',
    fullname: 'John Student',
    profileimageurl: 'https://via.placeholder.com/150/0000FF/808080?text=JS',
    description: 'First-year computer science student',
    roles: ['student'],
    preferences: {
      theme: 'light',
      language: 'en',
      timezone: 'America/New_York',
      emailnotifications: true,
      calendardefaults: {
        maxevents: 10,
        lookahead: 30,
      },
    },
    created: Date.now() - 365 * 24 * 60 * 60 * 1000,
    lastaccess: Date.now() - 2 * 60 * 60 * 1000,
    suspended: false,
  },
  2: {
    id: 2,
    username: 'teacher1',
    email: 'teacher1@example.com',
    firstname: 'Jane',
    lastname: 'Teacher',
    fullname: 'Jane Teacher',
    profileimageurl: 'https://via.placeholder.com/150/FF0000/FFFFFF?text=JT',
    description: 'Mathematics instructor with 10 years of experience',
    roles: ['teacher', 'editingteacher'],
    preferences: {
      theme: 'dark',
      language: 'en',
      timezone: 'America/Los_Angeles',
      emailnotifications: true,
      calendardefaults: {
        maxevents: 20,
        lookahead: 60,
      },
    },
    created: Date.now() - 3 * 365 * 24 * 60 * 60 * 1000,
    lastaccess: Date.now() - 30 * 60 * 1000,
    suspended: false,
  },
  3: {
    id: 3,
    username: 'admin1',
    email: 'admin1@example.com',
    firstname: 'Admin',
    lastname: 'User',
    fullname: 'Admin User',
    profileimageurl: 'https://via.placeholder.com/150/00FF00/000000?text=AU',
    description: 'System administrator',
    roles: ['admin', 'manager'],
    preferences: {
      theme: 'light',
      language: 'en',
      timezone: 'UTC',
      emailnotifications: false,
      calendardefaults: {
        maxevents: 50,
        lookahead: 90,
      },
    },
    created: Date.now() - 5 * 365 * 24 * 60 * 60 * 1000,
    lastaccess: Date.now() - 5 * 60 * 1000,
    suspended: false,
  },
  4: {
    id: 4,
    username: 'guest',
    email: 'guest@example.com',
    firstname: 'Guest',
    lastname: 'User',
    fullname: 'Guest User',
    profileimageurl: 'https://via.placeholder.com/150/CCCCCC/000000?text=GU',
    description: 'Guest account with limited access',
    roles: ['guest'],
    preferences: {
      theme: 'light',
      language: 'en',
      timezone: 'UTC',
      emailnotifications: false,
      calendardefaults: {
        maxevents: 5,
        lookahead: 7,
      },
    },
    created: Date.now() - 30 * 24 * 60 * 60 * 1000,
    lastaccess: Date.now() - 60 * 60 * 1000,
    suspended: false,
  },
  5: {
    id: 5,
    username: 'student2',
    email: 'student2@example.com',
    firstname: 'Sarah',
    lastname: 'Johnson',
    fullname: 'Sarah Johnson',
    profileimageurl: 'https://via.placeholder.com/150/FF00FF/FFFFFF?text=SJ',
    description: 'Second-year biology student',
    roles: ['student'],
    preferences: {
      theme: 'dark',
      language: 'en',
      timezone: 'Europe/London',
      emailnotifications: true,
      calendardefaults: {
        maxevents: 15,
        lookahead: 45,
      },
    },
    created: Date.now() - 2 * 365 * 24 * 60 * 60 * 1000,
    lastaccess: Date.now() - 24 * 60 * 60 * 1000,
    suspended: false,
  },
  999: {
    id: 999,
    username: 'suspended',
    email: 'suspended@example.com',
    firstname: 'Suspended',
    lastname: 'Account',
    fullname: 'Suspended Account',
    profileimageurl: 'https://via.placeholder.com/150/999999/FFFFFF?text=SA',
    description: 'Suspended user account',
    roles: ['student'],
    preferences: {
      theme: 'light',
      language: 'en',
      timezone: 'UTC',
      emailnotifications: false,
      calendardefaults: {
        maxevents: 10,
        lookahead: 30,
      },
    },
    created: Date.now() - 180 * 24 * 60 * 60 * 1000,
    lastaccess: Date.now() - 90 * 24 * 60 * 60 * 1000,
    suspended: true,
  },
};

const mockDashboardData: Record<number, DashboardData> = {
  1: {
    upcomingEvents: [
      {
        id: 1,
        name: 'Introduction to Programming - Assignment 3 Due',
        coursename: 'CS101',
        timestart: Date.now() + 2 * 24 * 60 * 60 * 1000,
        eventtype: 'assignment',
      },
      {
        id: 2,
        name: 'Data Structures Quiz',
        coursename: 'CS201',
        timestart: Date.now() + 5 * 24 * 60 * 60 * 1000,
        eventtype: 'quiz',
      },
      {
        id: 3,
        name: 'Office Hours',
        coursename: 'CS101',
        timestart: Date.now() + 24 * 60 * 60 * 1000,
        eventtype: 'meeting',
      },
    ],
    recentActivity: [
      {
        id: 1,
        coursename: 'CS101',
        activityname: 'Assignment 2',
        action: 'submitted',
        timestamp: Date.now() - 3 * 60 * 60 * 1000,
      },
      {
        id: 2,
        coursename: 'CS201',
        activityname: 'Lecture 5 Notes',
        action: 'viewed',
        timestamp: Date.now() - 5 * 60 * 60 * 1000,
      },
      {
        id: 3,
        coursename: 'CS101',
        activityname: 'Forum Discussion',
        action: 'posted',
        timestamp: Date.now() - 24 * 60 * 60 * 1000,
      },
    ],
    courseProgress: [
      {
        courseid: 1,
        coursename: 'Introduction to Programming',
        progress: 75,
        lastaccessed: Date.now() - 2 * 60 * 60 * 1000,
      },
      {
        courseid: 2,
        coursename: 'Data Structures',
        progress: 60,
        lastaccessed: Date.now() - 24 * 60 * 60 * 1000,
      },
      {
        courseid: 3,
        coursename: 'Web Development',
        progress: 45,
        lastaccessed: Date.now() - 48 * 60 * 60 * 1000,
      },
    ],
    assignmentsDue: [
      {
        id: 1,
        name: 'Assignment 3: Loops and Functions',
        coursename: 'Introduction to Programming',
        duedate: Date.now() + 2 * 24 * 60 * 60 * 1000,
        submitted: false,
      },
      {
        id: 2,
        name: 'Lab Report 2',
        coursename: 'Data Structures',
        duedate: Date.now() + 7 * 24 * 60 * 60 * 1000,
        submitted: false,
      },
    ],
    messagesCount: {
      unread: 3,
      total: 15,
    },
    timeline: [
      {
        id: 1,
        title: 'New course available',
        description: 'Advanced Algorithms course is now open for enrollment',
        date: Date.now() - 12 * 60 * 60 * 1000,
        type: 'course',
      },
      {
        id: 2,
        title: 'Grade posted',
        description: 'Your grade for Assignment 2 has been posted',
        date: Date.now() - 24 * 60 * 60 * 1000,
        type: 'grade',
      },
    ],
    badges: [
      {
        id: 1,
        name: 'First Assignment',
        imageurl: 'https://via.placeholder.com/100/FFD700/000000?text=Badge',
        dateissued: Date.now() - 30 * 24 * 60 * 60 * 1000,
      },
      {
        id: 2,
        name: 'Active Participant',
        imageurl: 'https://via.placeholder.com/100/C0C0C0/000000?text=Badge',
        dateissued: Date.now() - 15 * 24 * 60 * 60 * 1000,
      },
    ],
  },
  2: {
    upcomingEvents: [
      {
        id: 4,
        name: 'Faculty Meeting',
        coursename: 'Staff',
        timestart: Date.now() + 24 * 60 * 60 * 1000,
        eventtype: 'meeting',
      },
      {
        id: 5,
        name: 'Grade Submission Deadline',
        coursename: 'CS101',
        timestart: Date.now() + 3 * 24 * 60 * 60 * 1000,
        eventtype: 'deadline',
      },
    ],
    recentActivity: [
      {
        id: 4,
        coursename: 'CS101',
        activityname: 'Assignment 2 Grading',
        action: 'graded',
        timestamp: Date.now() - 60 * 60 * 1000,
      },
      {
        id: 5,
        coursename: 'CS101',
        activityname: 'Announcement',
        action: 'posted',
        timestamp: Date.now() - 3 * 60 * 60 * 1000,
      },
    ],
    courseProgress: [
      {
        courseid: 1,
        coursename: 'Introduction to Programming',
        progress: 100,
        lastaccessed: Date.now() - 30 * 60 * 1000,
      },
    ],
    assignmentsDue: [],
    messagesCount: {
      unread: 8,
      total: 42,
    },
    timeline: [
      {
        id: 3,
        title: 'New student enrolled',
        description: '5 new students enrolled in your course',
        date: Date.now() - 6 * 60 * 60 * 1000,
        type: 'enrollment',
      },
    ],
    badges: [
      {
        id: 3,
        name: 'Outstanding Educator',
        imageurl: 'https://via.placeholder.com/100/FFD700/000000?text=Badge',
        dateissued: Date.now() - 90 * 24 * 60 * 60 * 1000,
      },
    ],
  },
  3: {
    upcomingEvents: [
      {
        id: 6,
        name: 'System Maintenance',
        coursename: 'System',
        timestart: Date.now() + 7 * 24 * 60 * 60 * 1000,
        eventtype: 'system',
      },
    ],
    recentActivity: [
      {
        id: 6,
        coursename: 'System',
        activityname: 'User Management',
        action: 'updated',
        timestamp: Date.now() - 15 * 60 * 1000,
      },
    ],
    courseProgress: [],
    assignmentsDue: [],
    messagesCount: {
      unread: 12,
      total: 150,
    },
    timeline: [
      {
        id: 4,
        title: 'System update',
        description: 'Platform updated to version 4.4.0',
        date: Date.now() - 48 * 60 * 60 * 1000,
        type: 'system',
      },
    ],
    badges: [],
  },
};

const mockEnrolledCourses: Record<number, EnrolledCourse[]> = {
  1: [
    {
      id: 1,
      fullname: 'Introduction to Programming',
      shortname: 'CS101',
      summary: 'Learn the fundamentals of programming using Python',
      imageurl: 'https://via.placeholder.com/400x200/4285F4/FFFFFF?text=CS101',
      progress: 75,
      completed: false,
      lastaccessed: Date.now() - 2 * 60 * 60 * 1000,
      status: 'inprogress',
      startdate: Date.now() - 60 * 24 * 60 * 60 * 1000,
      enddate: Date.now() + 30 * 24 * 60 * 60 * 1000,
      role: 'student',
    },
    {
      id: 2,
      fullname: 'Data Structures',
      shortname: 'CS201',
      summary: 'Advanced data structures and algorithms',
      imageurl: 'https://via.placeholder.com/400x200/34A853/FFFFFF?text=CS201',
      progress: 60,
      completed: false,
      lastaccessed: Date.now() - 24 * 60 * 60 * 1000,
      status: 'inprogress',
      startdate: Date.now() - 45 * 24 * 60 * 60 * 1000,
      enddate: Date.now() + 45 * 24 * 60 * 60 * 1000,
      role: 'student',
    },
    {
      id: 3,
      fullname: 'Web Development',
      shortname: 'CS301',
      summary: 'Modern web development with React and Node.js',
      imageurl: 'https://via.placeholder.com/400x200/FBBC04/FFFFFF?text=CS301',
      progress: 45,
      completed: false,
      lastaccessed: Date.now() - 48 * 60 * 60 * 1000,
      status: 'inprogress',
      startdate: Date.now() - 30 * 24 * 60 * 60 * 1000,
      enddate: Date.now() + 60 * 24 * 60 * 60 * 1000,
      role: 'student',
    },
    {
      id: 4,
      fullname: 'Introduction to Databases',
      shortname: 'CS150',
      summary: 'Relational databases and SQL',
      imageurl: 'https://via.placeholder.com/400x200/EA4335/FFFFFF?text=CS150',
      progress: 100,
      completed: true,
      lastaccessed: Date.now() - 90 * 24 * 60 * 60 * 1000,
      status: 'completed',
      startdate: Date.now() - 180 * 24 * 60 * 60 * 1000,
      enddate: Date.now() - 90 * 24 * 60 * 60 * 1000,
      role: 'student',
    },
  ],
  2: [
    {
      id: 1,
      fullname: 'Introduction to Programming',
      shortname: 'CS101',
      summary: 'Learn the fundamentals of programming using Python',
      imageurl: 'https://via.placeholder.com/400x200/4285F4/FFFFFF?text=CS101',
      progress: 100,
      completed: false,
      lastaccessed: Date.now() - 30 * 60 * 1000,
      status: 'inprogress',
      startdate: Date.now() - 60 * 24 * 60 * 60 * 1000,
      enddate: Date.now() + 30 * 24 * 60 * 60 * 1000,
      role: 'editingteacher',
    },
  ],
  3: [],
};

// ============================================================================
// MSW Request Handlers
// ============================================================================

/**
 * Handler: GET /api/v1/users
 * List users with pagination and filtering
 */
const listUsersHandler = http.get('/api/v1/users', async ({ request }) => {
  // Simulate network latency
  await new Promise((resolve) => setTimeout(resolve, 150));

  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const perPage = parseInt(url.searchParams.get('perPage') || '20', 10);
  const search = url.searchParams.get('search') || '';
  const role = url.searchParams.get('role') || '';
  const courseId = url.searchParams.get('course') || '';

  // Check for authorization header (simulate authentication check)
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return HttpResponse.json(
      {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          details: {},
        },
      },
      { status: 401 }
    );
  }

  // Filter users based on search and role
  let filteredUsers = Object.values(mockUsers).filter((user) => {
    if (search) {
      const searchLower = search.toLowerCase();
      const matchesSearch =
        user.username.toLowerCase().includes(searchLower) ||
        user.email.toLowerCase().includes(searchLower) ||
        user.fullname.toLowerCase().includes(searchLower);
      if (!matchesSearch) {return false;}
    }

    if (role) {
      if (!user.roles.includes(role)) {return false;}
    }

    // Filter by suspended status (exclude suspended users by default)
    if (user.suspended) {return false;}

    return true;
  });

  // Simulate course enrollment filter
  if (courseId) {
    // For simplicity, return only users 1 and 2 for course filtering
    filteredUsers = filteredUsers.filter((user) => [1, 2].includes(user.id));
  }

  const total = filteredUsers.length;
  const totalPages = Math.ceil(total / perPage);
  const startIndex = (page - 1) * perPage;
  const endIndex = startIndex + perPage;
  const paginatedUsers = filteredUsers.slice(startIndex, endIndex);

  // Return basic user info for list view
  const userList = paginatedUsers.map((user) => ({
    id: user.id,
    username: user.username,
    email: user.email,
    fullname: user.fullname,
    profileimageurl: user.profileimageurl,
    roles: user.roles,
    lastaccess: user.lastaccess,
  }));

  return HttpResponse.json({
    success: true,
    data: userList,
    meta: {
      pagination: {
        page,
        perPage,
        total,
        totalPages,
      },
    },
  });
});

/**
 * Handler: GET /api/v1/users/:id
 * Get user profile by ID
 */
const showUserHandler = http.get('/api/v1/users/:id', async ({ request, params }) => {
  // Simulate network latency
  await new Promise((resolve) => setTimeout(resolve, 200));

  const userId = parseInt(params.id as string, 10);

  // Check for authorization header
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return HttpResponse.json(
      {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          details: {},
        },
      },
      { status: 401 }
    );
  }

  // Check if user exists
  const user = mockUsers[userId];
  if (!user) {
    return HttpResponse.json(
      {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'User not found',
          details: {
            userId,
          },
        },
      },
      { status: 404 }
    );
  }

  // Simulate permission check for suspended users
  if (user.suspended) {
    return HttpResponse.json(
      {
        success: false,
        error: {
          code: 'PERMISSION_DENIED',
          message: 'Access denied: User account is suspended',
          details: {
            userId,
          },
        },
      },
      { status: 403 }
    );
  }

  // Return complete user profile
  return HttpResponse.json({
    success: true,
    data: user,
  });
});

/**
 * Handler: PUT /api/v1/users/:id
 * Update user profile
 */
const updateUserHandler = http.put('/api/v1/users/:id', async ({ request, params }) => {
  // Simulate network latency
  await new Promise((resolve) => setTimeout(resolve, 250));

  const userId = parseInt(params.id as string, 10);

  // Check for authorization header
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return HttpResponse.json(
      {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          details: {},
        },
      },
      { status: 401 }
    );
  }

  // Check if user exists
  const user = mockUsers[userId];
  if (!user) {
    return HttpResponse.json(
      {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'User not found',
          details: {
            userId,
          },
        },
      },
      { status: 404 }
    );
  }

  // Parse request body
  const updates = await request.json() as UserUpdateRequest;

  // Validation: Check email format
  if (updates.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(updates.email)) {
    return HttpResponse.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid email format',
          details: {
            field: 'email',
            value: updates.email,
          },
        },
      },
      { status: 422 }
    );
  }

  // Validation: Check username uniqueness (if changed)
  if (updates.username && updates.username !== user.username) {
    const existingUser = Object.values(mockUsers).find(
      (u) => u.username === updates.username && u.id !== userId
    );
    if (existingUser) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Username already exists',
            details: {
              field: 'username',
              value: updates.username,
            },
          },
        },
        { status: 422 }
      );
    }
  }

  // Simulate permission check: only allow self-edit or admin
  // For testing, we'll allow any authenticated user to edit user 1 or 2
  if (![1, 2, 3].includes(userId)) {
    return HttpResponse.json(
      {
        success: false,
        error: {
          code: 'PERMISSION_DENIED',
          message: 'You do not have permission to edit this user',
          details: {
            userId,
          },
        },
      },
      { status: 403 }
    );
  }

  // Update user data (shallow merge)
  const updatedUser = {
    ...user,
    ...updates,
    id: user.id, // Prevent ID change
    fullname: updates.firstname && updates.lastname 
      ? `${updates.firstname} ${updates.lastname}`
      : user.fullname,
  };

  // In a real implementation, this would persist to backend
  // For mocking, we just return the updated data
  return HttpResponse.json({
    success: true,
    data: updatedUser,
  });
});

/**
 * Handler: GET /api/v1/users/:id/dashboard
 * Get personalized dashboard data for user
 */
const getUserDashboardHandler = http.get(
  '/api/v1/users/:id/dashboard',
  async ({ request, params }) => {
    // Simulate network latency
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Validate authentication token
    const validation = validateAuthToken(request);
    if (!validation.valid) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: validation.error!.code,
            message: validation.error!.message,
            details: {},
          },
        },
        { status: validation.error!.status }
      );
    }

    const userId = parseInt(params.id as string, 10);

    // Check if user exists
    const user = mockUsers[userId];
    if (!user) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'User not found',
            details: {
              userId,
            },
          },
        },
        { status: 404 }
      );
    }

    // Get dashboard data for user
    const dashboardData = mockDashboardData[userId] || {
      upcomingEvents: [],
      recentActivity: [],
      courseProgress: [],
      assignmentsDue: [],
      messagesCount: {
        unread: 0,
        total: 0,
      },
      timeline: [],
      badges: [],
    };

    return HttpResponse.json({
      success: true,
      data: dashboardData,
    });
  }
);

/**
 * Handler: GET /api/v1/users/:id/courses
 * Get enrolled courses for user
 */
const getUserCoursesHandler = http.get(
  '/api/v1/users/:id/courses',
  async ({ request, params }) => {
    // Simulate network latency
    await new Promise((resolve) => setTimeout(resolve, 200));

    const userId = parseInt(params.id as string, 10);
    const url = new URL(request.url);
    const statusFilter = url.searchParams.get('status') || '';

    // Check for authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
            details: {},
          },
        },
        { status: 401 }
      );
    }

    // Check if user exists
    const user = mockUsers[userId];
    if (!user) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'User not found',
            details: {
              userId,
            },
          },
        },
        { status: 404 }
      );
    }

    // Get courses for user
    let courses = mockEnrolledCourses[userId] || [];

    // Filter by status if provided
    if (statusFilter) {
      courses = courses.filter((course) => course.status === statusFilter);
    }

    return HttpResponse.json({
      success: true,
      data: courses,
      meta: {
        total: courses.length,
      },
    });
  }
);

/**
 * Handler: PUT /api/v1/users/:id/preferences
 * Update user preferences
 */
const updateUserPreferencesHandler = http.put(
  '/api/v1/users/:id/preferences',
  async ({ request, params }) => {
    // Simulate network latency
    await new Promise((resolve) => setTimeout(resolve, 200));

    const userId = parseInt(params.id as string, 10);

    // Check for authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
            details: {},
          },
        },
        { status: 401 }
      );
    }

    // Check if user exists
    const user = mockUsers[userId];
    if (!user) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'User not found',
            details: {
              userId,
            },
          },
        },
        { status: 404 }
      );
    }

    // Parse request body
    const preferencesUpdate = await request.json() as PreferencesUpdateRequest;

    // Validation: Check theme value
    if (
      preferencesUpdate.theme &&
      !['light', 'dark', 'auto'].includes(preferencesUpdate.theme)
    ) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid theme value',
            details: {
              field: 'theme',
              value: preferencesUpdate.theme,
              allowedValues: ['light', 'dark', 'auto'],
            },
          },
        },
        { status: 422 }
      );
    }

    // Validation: Check language format (simplified)
    if (preferencesUpdate.language && !/^[a-z]{2}(_[A-Z]{2})?$/.test(preferencesUpdate.language)) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid language code',
            details: {
              field: 'language',
              value: preferencesUpdate.language,
            },
          },
        },
        { status: 422 }
      );
    }

    // Update preferences (deep merge for nested objects)
    const updatedPreferences: UserPreferences = {
      ...user.preferences,
      ...preferencesUpdate,
      calendardefaults: {
        ...user.preferences.calendardefaults,
        ...(preferencesUpdate.calendardefaults || {}),
      },
    };

    return HttpResponse.json({
      success: true,
      data: updatedPreferences,
    });
  }
);

// ============================================================================
// Export Handlers
// ============================================================================

/**
 * Array of all user management MSW request handlers
 */
export const usersHandlers = [
  listUsersHandler,
  showUserHandler,
  updateUserHandler,
  getUserDashboardHandler,
  getUserCoursesHandler,
  updateUserPreferencesHandler,
];
