/**
 * MSW Request Handlers for Admin API Endpoints
 * 
 * This file provides Mock Service Worker (MSW) handlers for admin-related
 * API endpoints, enabling isolated frontend testing without backend dependencies.
 * 
 * Handlers include:
 * - GET /api/v1/admin/settings - Get system settings
 * - PUT /api/v1/admin/settings - Update system settings
 * - GET /api/v1/admin/users - List all users
 * - POST /api/v1/admin/users - Create user
 * - PUT /api/v1/admin/users/:id - Update user
 * - DELETE /api/v1/admin/users/:id - Delete user
 * - POST /api/v1/admin/users/bulk - Bulk user operations
 * - GET /api/v1/admin/courses - List all courses
 * - GET /api/v1/admin/courses/categories - Course categories
 * - POST /api/v1/admin/courses/bulk - Bulk course operations
 * - GET /api/v1/admin/roles - List all roles
 * - POST /api/v1/admin/roles/assign - Assign role
 * - GET /api/v1/admin/roles/capabilities - Get role capabilities
 * - GET /api/v1/admin/plugins - List installed plugins
 * - PUT /api/v1/admin/plugins/:id - Configure plugin
 * 
 * @package    react-frontend
 * @subpackage tests/mocks/handlers
 * @copyright  2024 Moodle React Frontend
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import { http, HttpResponse } from 'msw';

// ============================================================================
// TypeScript Type Definitions
// ============================================================================

interface SystemSettings {
  siteName: string;
  siteDescription: string;
  frontPageSummary: string;
  defaultLanguage: string;
  defaultTimezone: string;
  forceTimezone: boolean;
  defaultCountry: string;
  enableMessaging: boolean;
  enableBadges: boolean;
  enableCompetencies: boolean;
  enableAnalytics: boolean;
  enableMobileWebService: boolean;
  maxUploadFileSize: number;
  passwordPolicy: boolean;
  minPasswordLength: number;
  requirePasswordDigits: boolean;
  requirePasswordLowercase: boolean;
  requirePasswordUppercase: boolean;
  requirePasswordSpecialChars: boolean;
  maxConsecutiveIdenticalChars: number;
  sessionTimeout: number;
  sessionCookieTimeout: number;
  enableRecaptcha: boolean;
  recaptchaSiteKey: string;
  smtpHosts: string;
  smtpSecurity: string;
  smtpAuthType: string;
  smtpUser: string;
  smtpMaxBulk: number;
  noreplyAddress: string;
  allowEmailChange: boolean;
  debugDisplay: boolean;
  debugLevel: string;
  themeDesktop: string;
  themeMobile: string;
  allowThemeChanges: boolean;
}

interface AdminUser {
  id: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  auth: string;
  confirmed: boolean;
  suspended: boolean;
  deleted: boolean;
  firstAccess: number;
  lastAccess: number;
  lastLogin: number;
  timeCreated: number;
  timeModified: number;
  city: string;
  country: string;
  timezone: string;
  language: string;
  description: string;
  profileImageUrl: string;
  roles: Array<{
    roleid: number;
    shortname: string;
    name: string;
  }>;
}

interface Role {
  id: number;
  name: string;
  shortName: string;
  description: string;
  sortOrder: number;
  archetype: string;
}

interface Plugin {
  component: string;
  name: string;
  displayName: string;
  type: string;
  version: string;
  release: string;
  enabled: boolean;
  settings: Record<string, unknown>;
}

// Request body types
interface CreateUserBody {
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  auth?: string;
  city?: string;
  country?: string;
  timezone?: string;
  language?: string;
  description?: string;
}

interface UpdateUserBody {
  email?: string;
  firstName?: string;
  lastName?: string;
  city?: string;
  country?: string;
  timezone?: string;
  language?: string;
  description?: string;
}

interface AssignRoleBody {
  roleId: number;
  userId: number;
  contextId?: number;
}

interface ConfigurePluginBody {
  enabled?: boolean;
  settings?: Record<string, unknown>;
}


// ============================================================================
// Mock Data
// ============================================================================

const MOCK_SETTINGS: SystemSettings = {
  siteName: 'Moodle Test Site',
  siteDescription: 'A test Moodle installation',
  frontPageSummary: 'Welcome to our learning platform',
  defaultLanguage: 'en',
  defaultTimezone: 'UTC',
  forceTimezone: false,
  defaultCountry: 'US',
  enableMessaging: true,
  enableBadges: true,
  enableCompetencies: true,
  enableAnalytics: true,
  enableMobileWebService: true,
  maxUploadFileSize: 104857600, // 100MB
  passwordPolicy: true,
  minPasswordLength: 8,
  requirePasswordDigits: true,
  requirePasswordLowercase: true,
  requirePasswordUppercase: true,
  requirePasswordSpecialChars: false,
  maxConsecutiveIdenticalChars: 3,
  sessionTimeout: 28800, // 8 hours
  sessionCookieTimeout: 28800,
  enableRecaptcha: false,
  recaptchaSiteKey: '',
  smtpHosts: 'localhost',
  smtpSecurity: 'tls',
  smtpAuthType: 'LOGIN',
  smtpUser: '',
  smtpMaxBulk: 1,
  noreplyAddress: 'noreply@example.com',
  allowEmailChange: true,
  debugDisplay: false,
  debugLevel: 'NORMAL',
  themeDesktop: 'boost',
  themeMobile: 'boost',
  allowThemeChanges: false
};

const MOCK_ADMIN_USERS: Record<number, AdminUser> = {
  1: {
    id: 1,
    username: 'admin',
    email: 'admin@example.com',
    firstName: 'Admin',
    lastName: 'User',
    fullName: 'Admin User',
    auth: 'manual',
    confirmed: true,
    suspended: false,
    deleted: false,
    firstAccess: 1640000000,
    lastAccess: 1672536000,
    lastLogin: 1672536000,
    timeCreated: 1640000000,
    timeModified: 1672536000,
    city: 'San Francisco',
    country: 'US',
    timezone: 'America/Los_Angeles',
    language: 'en',
    description: 'System administrator',
    profileImageUrl: '/user/pic.jpg',
    roles: [
      {
        roleid: 1,
        shortname: 'admin',
        name: 'Administrator'
      }
    ]
  },
  2: {
    id: 2,
    username: 'teacher1',
    email: 'teacher1@example.com',
    firstName: 'Jane',
    lastName: 'Teacher',
    fullName: 'Jane Teacher',
    auth: 'manual',
    confirmed: true,
    suspended: false,
    deleted: false,
    firstAccess: 1640100000,
    lastAccess: 1672536000,
    lastLogin: 1672536000,
    timeCreated: 1640100000,
    timeModified: 1672536000,
    city: 'New York',
    country: 'US',
    timezone: 'America/New_York',
    language: 'en',
    description: 'Course teacher',
    profileImageUrl: '/user/pic2.jpg',
    roles: [
      {
        roleid: 3,
        shortname: 'editingteacher',
        name: 'Teacher'
      }
    ]
  },
  3: {
    id: 3,
    username: 'student1',
    email: 'student1@example.com',
    firstName: 'John',
    lastName: 'Student',
    fullName: 'John Student',
    auth: 'manual',
    confirmed: true,
    suspended: false,
    deleted: false,
    firstAccess: 1640200000,
    lastAccess: 1672536000,
    lastLogin: 1672536000,
    timeCreated: 1640200000,
    timeModified: 1672536000,
    city: 'Boston',
    country: 'US',
    timezone: 'America/New_York',
    language: 'en',
    description: 'Student user',
    profileImageUrl: '/user/pic3.jpg',
    roles: [
      {
        roleid: 5,
        shortname: 'student',
        name: 'Student'
      }
    ]
  },
  4: {
    id: 4,
    username: 'student2',
    email: 'student2@example.com',
    firstName: 'Jane',
    lastName: 'Smith',
    fullName: 'Jane Smith',
    auth: 'manual',
    confirmed: true,
    suspended: false,
    deleted: false,
    firstAccess: 1640300000,
    lastAccess: 1672536000,
    lastLogin: 1672536000,
    timeCreated: 1640300000,
    timeModified: 1672536000,
    city: 'Chicago',
    country: 'US',
    timezone: 'America/Chicago',
    language: 'en',
    description: 'Student user',
    profileImageUrl: '/user/pic4.jpg',
    roles: [
      {
        roleid: 5,
        shortname: 'student',
        name: 'Student'
      }
    ]
  },
  5: {
    id: 5,
    username: 'suspended_user',
    email: 'suspended@example.com',
    firstName: 'Suspended',
    lastName: 'User',
    fullName: 'Suspended User',
    auth: 'manual',
    confirmed: true,
    suspended: true,
    deleted: false,
    firstAccess: 1640400000,
    lastAccess: 1672536000,
    lastLogin: 1672536000,
    timeCreated: 1640400000,
    timeModified: 1672536000,
    city: 'Miami',
    country: 'US',
    timezone: 'America/New_York',
    language: 'en',
    description: 'Suspended student',
    profileImageUrl: '/user/pic5.jpg',
    roles: [
      {
        roleid: 5,
        shortname: 'student',
        name: 'Student'
      }
    ]
  }
};

const MOCK_ROLES: Role[] = [
  {
    id: 1,
    name: 'Manager',
    shortName: 'manager',
    description: 'Managers can access courses and modify them',
    sortOrder: 1,
    archetype: 'manager'
  },
  {
    id: 2,
    name: 'Course creator',
    shortName: 'coursecreator',
    description: 'Course creators can create new courses',
    sortOrder: 2,
    archetype: 'coursecreator'
  },
  {
    id: 3,
    name: 'Teacher',
    shortName: 'editingteacher',
    description: 'Teachers can teach in courses and grade students',
    sortOrder: 3,
    archetype: 'editingteacher'
  },
  {
    id: 4,
    name: 'Non-editing teacher',
    shortName: 'teacher',
    description: 'Non-editing teachers can teach and grade students',
    sortOrder: 4,
    archetype: 'teacher'
  },
  {
    id: 5,
    name: 'Student',
    shortName: 'student',
    description: 'Students can participate in courses',
    sortOrder: 5,
    archetype: 'student'
  }
];

const MOCK_PLUGINS: Plugin[] = [
  {
    component: 'auth_manual',
    name: 'manual',
    displayName: 'Manual accounts',
    type: 'auth',
    version: '2024010100',
    release: '4.4',
    enabled: true,
    settings: {}
  },
  {
    component: 'enrol_manual',
    name: 'manual',
    displayName: 'Manual enrolments',
    type: 'enrol',
    version: '2024010100',
    release: '4.4',
    enabled: true,
    settings: {
      expiredaction: 'Keep user enrolled',
      expirynotify: 0
    }
  }
];

// ============================================================================
// Helper Functions
// ============================================================================

async function simulateNetworkDelay(min = 100, max = 300): Promise<void> {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise((resolve) => setTimeout(resolve, delay));
}

// ============================================================================
// MSW Request Handlers
// ============================================================================

/**
 * GET /api/v1/admin/settings
 * Get system settings
 */
const getSettingsHandler = http.get('*/api/v1/admin/settings', async () => {
  await simulateNetworkDelay();
  
  return HttpResponse.json({
    success: true,
    data: MOCK_SETTINGS
  });
});

/**
 * PUT /api/v1/admin/settings
 * Update system settings
 */
const updateSettingsHandler = http.put('*/api/v1/admin/settings', async ({ request }) => {
  await simulateNetworkDelay();
  
  const body = await request.json() as Partial<SystemSettings>;
  
  // Validate required fields
  if (body.siteName !== undefined && body.siteName.trim() === '') {
    return HttpResponse.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Site name cannot be empty',
          details: { field: 'siteName' }
        }
      },
      { status: 400 }
    );
  }
  
  const updatedSettings = {
    ...MOCK_SETTINGS,
    ...body
  };
  
  return HttpResponse.json({
    success: true,
    data: updatedSettings,
    message: 'Settings updated successfully'
  });
});

/**
 * GET /api/v1/admin/users
 * List all users with filtering and pagination
 */
const getUsersHandler = http.get('*/api/v1/admin/users', async ({ request }) => {
  await simulateNetworkDelay();
  
  const url = new URL(request.url);
  const page = Number(url.searchParams.get('page')) || 1;
  const perPage = Number(url.searchParams.get('perPage')) || 20;
  const search = url.searchParams.get('search') || '';
  
  let users = Object.values(MOCK_ADMIN_USERS);
  
  // Apply search filter
  if (search) {
    users = users.filter(u => 
      u.username.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.fullName.toLowerCase().includes(search.toLowerCase())
    );
  }
  
  return HttpResponse.json({
    success: true,
    data: users,
    meta: {
      pagination: {
        page,
        perPage,
        total: users.length,
        totalPages: Math.ceil(users.length / perPage)
      }
    }
  });
});

/**
 * POST /api/v1/admin/users
 * Create a new user
 */
const createUserHandler = http.post('*/api/v1/admin/users', async ({ request }) => {
  await simulateNetworkDelay();
  
  const body = await request.json() as CreateUserBody;
  
  // Validate required fields
  const requiredFields = ['username', 'email', 'firstName', 'lastName', 'password'];
  const missingFields = requiredFields.filter(field => !body[field]);
  
  if (missingFields.length > 0) {
    return HttpResponse.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Required fields are missing',
          details: { missing_fields: missingFields }
        }
      },
      { status: 400 }
    );
  }
  
  // Check for duplicate username
  const existingUser = Object.values(MOCK_ADMIN_USERS).find(
    u => u.username === body.username
  );
  
  if (existingUser) {
    return HttpResponse.json(
      {
        success: false,
        error: {
          code: 'DUPLICATE_USERNAME',
          message: 'Username already exists',
          details: { username: body.username }
        }
      },
      { status: 409 }
    );
  }
  
  const newUser: AdminUser = {
    id: Object.keys(MOCK_ADMIN_USERS).length + 1,
    username: body.username,
    email: body.email,
    firstName: body.firstName,
    lastName: body.lastName,
    fullName: `${body.firstName} ${body.lastName}`,
    auth: body.auth || 'manual',
    confirmed: true,
    suspended: false,
    deleted: false,
    firstAccess: 0,
    lastAccess: 0,
    lastLogin: 0,
    timeCreated: Date.now() / 1000,
    timeModified: Date.now() / 1000,
    city: body.city || '',
    country: body.country || '',
    timezone: body.timezone || 'UTC',
    language: body.language || 'en',
    description: body.description || '',
    profileImageUrl: '/user/default.jpg',
    roles: [
      {
        roleid: 5,
        shortname: 'student',
        name: 'Student'
      }
    ]
  };
  
  return HttpResponse.json({
    success: true,
    data: newUser,
    message: 'User created successfully'
  }, { status: 201 });
});

/**
 * PUT /api/v1/admin/users/:id
 * Update user details
 */
const updateUserHandler = http.put('*/api/v1/admin/users/:id', async ({ params, request }) => {
  await simulateNetworkDelay();
  
  const id = Number(params.id);
  const user = MOCK_ADMIN_USERS[id];
  
  if (!user) {
    return HttpResponse.json(
      {
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: `User with ID ${id} not found`,
          details: { userId: id }
        }
      },
      { status: 404 }
    );
  }
  
  const body = await request.json() as UpdateUserBody;
  
  const updatedUser = {
    ...user,
    ...body,
    id: user.id, // Prevent ID change
    username: user.username, // Prevent username change
    timeModified: Date.now() / 1000
  };
  
  return HttpResponse.json({
    success: true,
    data: updatedUser,
    message: 'User updated successfully'
  });
});

/**
 * DELETE /api/v1/admin/users/:id
 * Delete a user
 */
const deleteUserHandler = http.delete('*/api/v1/admin/users/:id', async ({ params }) => {
  await simulateNetworkDelay();
  
  const id = Number(params.id);
  const user = MOCK_ADMIN_USERS[id];
  
  if (!user) {
    return HttpResponse.json(
      {
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: `User with ID ${id} not found`,
          details: { userId: id }
        }
      },
      { status: 404 }
    );
  }
  
  // Prevent deletion of admin user
  if (id === 1) {
    return HttpResponse.json(
      {
        success: false,
        error: {
          code: 'CANNOT_DELETE_ADMIN',
          message: 'Cannot delete the admin user',
          details: { userId: id }
        }
      },
      { status: 403 }
    );
  }
  
  return HttpResponse.json({
    success: true,
    data: { message: 'User deleted successfully' }
  });
});

/**
 * GET /api/v1/admin/roles
 * List all roles
 */
const getRolesHandler = http.get('*/api/v1/admin/roles', async () => {
  await simulateNetworkDelay();
  
  return HttpResponse.json({
    success: true,
    data: MOCK_ROLES
  });
});

/**
 * POST /api/v1/admin/roles/assign
 * Assign role to user
 */
const assignRoleHandler = http.post('*/api/v1/admin/roles/assign', async ({ request }) => {
  await simulateNetworkDelay();
  
  const body = await request.json() as AssignRoleBody;
  
  if (!body.roleId || !body.userId) {
    return HttpResponse.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Role ID and User ID are required',
          details: {
            missing_fields: [
              !body.roleId ? 'roleId' : null,
              !body.userId ? 'userId' : null
            ].filter(Boolean)
          }
        }
      },
      { status: 400 }
    );
  }
  
  return HttpResponse.json({
    success: true,
    data: {
      roleId: body.roleId,
      userId: body.userId,
      contextId: body.contextId || 1,
      message: 'Role assigned successfully'
    }
  });
});

/**
 * GET /api/v1/admin/plugins
 * List installed plugins
 */
const getPluginsHandler = http.get('*/api/v1/admin/plugins', async ({ request }) => {
  await simulateNetworkDelay();
  
  const url = new URL(request.url);
  const type = url.searchParams.get('type');
  
  let plugins = MOCK_PLUGINS;
  
  if (type) {
    plugins = plugins.filter(p => p.type === type);
  }
  
  return HttpResponse.json({
    success: true,
    data: plugins
  });
});

/**
 * PUT /api/v1/admin/plugins/:component
 * Configure plugin settings
 */
const configurePluginHandler = http.put('*/api/v1/admin/plugins/:component', async ({ params, request }) => {
  await simulateNetworkDelay();
  
  const component = params.component as string;
  const plugin = MOCK_PLUGINS.find(p => p.component === component);
  
  if (!plugin) {
    return HttpResponse.json(
      {
        success: false,
        error: {
          code: 'PLUGIN_NOT_FOUND',
          message: `Plugin ${component} not found`,
          details: { component }
        }
      },
      { status: 404 }
    );
  }
  
  const body = await request.json() as ConfigurePluginBody;
  
  const updatedPlugin = {
    ...plugin,
    enabled: body.enabled !== undefined ? body.enabled : plugin.enabled,
    settings: {
      ...plugin.settings,
      ...body.settings
    }
  };
  
  return HttpResponse.json({
    success: true,
    data: updatedPlugin,
    message: 'Plugin configured successfully'
  });
});

// ============================================================================
// Export Handlers
// ============================================================================

/**
 * Array of all admin-related MSW request handlers
 * 
 * Usage in test setup:
 * ```typescript
 * import { adminHandlers } from './mocks/handlers/admin';
 * 
 * const server = setupServer(...adminHandlers);
 * 
 * beforeAll(() => server.listen());
 * afterEach(() => server.resetHandlers());
 * afterAll(() => server.close());
 * ```
 */
export const adminHandlers = [
  getSettingsHandler,
  updateSettingsHandler,
  getUsersHandler,
  createUserHandler,
  updateUserHandler,
  deleteUserHandler,
  getRolesHandler,
  assignRoleHandler,
  getPluginsHandler,
  configurePluginHandler,
];
