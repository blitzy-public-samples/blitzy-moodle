/**
 * MSW Request Handlers for Forum API Endpoints
 * 
 * This file provides Mock Service Worker (MSW) handlers for forum-related
 * API endpoints, enabling isolated frontend testing without backend dependencies.
 * 
 * Handlers include:
 * - GET /api/v1/forums/:id - Forum details retrieval
 * - GET /api/v1/forums/:id/discussions - Discussion list with pagination
 * - GET /api/v1/forums/discussions/:id/posts - Discussion posts/replies
 * - POST /api/v1/forums/:id/discussions - Create new discussion
 * - POST /api/v1/forums/discussions/:id/posts - Reply to discussion
 * - PUT /api/v1/forums/posts/:id - Update post
 * - DELETE /api/v1/forums/posts/:id - Delete post
 * - POST /api/v1/forums/:id/subscribe - Subscribe to forum
 * - POST /api/v1/forums/:id/unsubscribe - Unsubscribe from forum
 * - POST /api/v1/forums/discussions/:id/subscribe - Subscribe to discussion
 * - POST /api/v1/forums/discussions/:id/unsubscribe - Unsubscribe from discussion
 * - POST /api/v1/forums/discussions/:id/read - Mark discussion as read
 * - POST /api/v1/forums/discussions/:id/pin - Pin discussion
 * - POST /api/v1/forums/discussions/:id/unpin - Unpin discussion
 * - POST /api/v1/forums/discussions/:id/lock - Lock discussion
 * - POST /api/v1/forums/discussions/:id/unlock - Unlock discussion
 * - POST /api/v1/forums/posts/:id/report - Report post
 * 
 * @package    react-frontend
 * @subpackage tests/mocks/handlers
 * @copyright  2024 Moodle React Frontend
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import { http, HttpResponse } from 'msw';
import type { Forum, PostAttachment } from '../../../src/features/activities/forums/types/forum.types';
import { 
  ForumType, 
  ForumSubscriptionMode, 
  ForumTrackingType 
} from '../../../src/features/activities/forums/types/forum.types';

// ============================================================================
// TypeScript Type Definitions
// ============================================================================

/**
 * Discussion interface for mock data
 * Uses lowercase properties to match Moodle's backend conventions and application types
 */
interface Discussion {
  id: number;
  forumid: number;
  name: string;
  message: string;
  messageformat: number;
  userid: number;
  userFullName: string;
  userPictureUrl: string;
  created: number;
  modified: number;
  timestart: number;
  timeend: number;
  pinned: boolean;
  locked: boolean;
  groupid: number;
  numReplies: number;
  numUnreadPosts: number;
  canReply: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canPin: boolean;
  canLock: boolean;
}

/**
 * Post interface for mock data
 * Uses lowercase properties to match Moodle's backend conventions and application types
 */
interface Post {
  id: number;
  discussionid: number;
  parentid: number;
  authorid: number;
  userFullName: string;
  userPictureUrl: string;
  timecreated: number;
  timemodified: number;
  subject: string;
  message: string;
  messageformat: number;
  hasattachments: boolean;
  attachments: PostAttachment[];
  canEdit: boolean;
  canDelete: boolean;
  canReply: boolean;
  replies?: Post[];
}

// ============================================================================
// Mock Data
// ============================================================================

const MOCK_FORUMS: Record<number, Forum> = {
  1: {
    id: 1,
    courseid: 10,
    name: 'General Discussion Forum',
    intro: 'A forum for general discussions',
    introformat: 1,
    type: ForumType.GENERAL,
    assessed: 0,
    assesstimestart: 0,
    assesstimefinish: 0,
    scale: 0,
    gradeforum: 0,
    gradeforumnotify: false,
    maxbytes: 512000,
    maxattachments: 5,
    forcesubscribe: ForumSubscriptionMode.CHOOSE,
    trackingtype: ForumTrackingType.OPTIONAL,
    rsstype: 0,
    rssarticles: 0,
    timemodified: 1640000000,
    warnafter: 0,
    blockafter: 0,
    blockperiod: 0,
    completiondiscussions: 0,
    completionreplies: 0,
    completionposts: 0,
    displaywordcount: false,
    lockdiscussionafter: 0,
    duedate: 0,
    cutoffdate: 0,
    subscribed: false,
    canSubscribe: true,
    canAddDiscussion: true,
    canModerate: false,
    unreadCount: 5,
    discussionCount: 6,
    postCount: 150,
    participants: 42
  }
};

const INITIAL_MOCK_DISCUSSIONS: Record<number, Discussion> = {
  1: {
    id: 1,
    forumid: 1,
    name: 'First Discussion',
    message: 'This is the first discussion post',
    messageformat: 1,
    userid: 5,
    userFullName: 'John Doe',
    userPictureUrl: '/user/pic.jpg',
    created: 1640000000,
    modified: 1640000000,
    timestart: 0,
    timeend: 0,
    pinned: true,
    locked: false,
    groupid: -1,
    numReplies: 10,
    numUnreadPosts: 2,
    canReply: true,
    canEdit: false,
    canDelete: false,
    canPin: false,
    canLock: false
  },
  2: {
    id: 2,
    forumid: 1,
    name: 'Second Discussion',
    message: 'This is the second discussion post',
    messageformat: 1,
    userid: 6,
    userFullName: 'Jane Smith',
    userPictureUrl: '/user/pic2.jpg',
    created: 1640100000,
    modified: 1640100000,
    timestart: 0,
    timeend: 0,
    pinned: false,
    locked: false,
    groupid: -1,
    numReplies: 5,
    numUnreadPosts: 0,
    canReply: true,
    canEdit: false,
    canDelete: false,
    canPin: false,
    canLock: false
  },
  101: {
    id: 101,
    forumid: 1,
    name: 'Test Discussion 101',
    message: 'This is test discussion 101 for unit tests',
    messageformat: 1,
    userid: 5,
    userFullName: 'Test User',
    userPictureUrl: '/user/pic.jpg',
    created: 1640200000,
    modified: 1640200000,
    timestart: 0,
    timeend: 0,
    pinned: false,
    locked: false,
    groupid: -1,
    numReplies: 3,
    numUnreadPosts: 0,
    canReply: true,
    canEdit: true,
    canDelete: true,
    canPin: true,
    canLock: true
  },
  102: {
    id: 102,
    forumid: 1,
    name: 'Test Discussion 102',
    message: 'This is test discussion 102 for unit tests',
    messageformat: 1,
    userid: 6,
    userFullName: 'Test User 2',
    userPictureUrl: '/user/pic2.jpg',
    created: 1640300000,
    modified: 1640300000,
    timestart: 0,
    timeend: 0,
    pinned: true,
    locked: false,
    groupid: -1,
    numReplies: 0,
    numUnreadPosts: 0,
    canReply: true,
    canEdit: true,
    canDelete: true,
    canPin: true,
    canLock: true
  },
  103: {
    id: 103,
    forumid: 1,
    name: 'Test Discussion 103',
    message: 'This is test discussion 103 for unit tests',
    messageformat: 1,
    userid: 5,
    userFullName: 'Test User',
    userPictureUrl: '/user/pic.jpg',
    created: 1640400000,
    modified: 1640400000,
    timestart: 0,
    timeend: 0,
    pinned: false,
    locked: true,
    groupid: -1,
    numReplies: 1,
    numUnreadPosts: 0,
    canReply: false,
    canEdit: true,
    canDelete: true,
    canPin: true,
    canLock: true
  },
  100: {
    id: 100,
    forumid: 1,
    name: 'Test Discussion 100',
    message: 'This is test discussion 100 for forumApi unit tests',
    messageformat: 1,
    userid: 5,
    userFullName: 'Test User',
    userPictureUrl: '/user/pic.jpg',
    created: 1640200000,
    modified: 1640200000,
    timestart: 0,
    timeend: 0,
    pinned: false,
    locked: false,
    groupid: -1,
    numReplies: 0,
    numUnreadPosts: 0,
    canReply: true,
    canEdit: true,
    canDelete: true,
    canPin: true,
    canLock: true
  }
};

// ============================================================================
// SessionStorage Persistence for E2E Tests
// ============================================================================

/**
 * SessionStorage keys for persisting mock forum data across page reloads
 * 
 * During E2E tests, page reloads (e.g., via page.goto()) would normally reset
 * all mock data. By persisting to sessionStorage, we maintain state across
 * navigations within the same test session.
 */
const DISCUSSIONS_STORAGE_KEY = 'msw_mock_forum_discussions';
const POSTS_STORAGE_KEY = 'msw_mock_forum_posts';

/**
 * Load discussions from sessionStorage
 * 
 * Restores discussion data from sessionStorage if available, otherwise returns
 * the initial mock data. This ensures discussions persist across page reloads.
 * 
 * @returns Record of discussion ID to Discussion objects
 */
function loadDiscussions(): Record<number, Discussion> {
  try {
    const stored = sessionStorage.getItem(DISCUSSIONS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Record<number, Discussion>;
      console.log('[MSW Forums] Loaded discussions from sessionStorage:', Object.keys(parsed).length, 'discussions');
      return parsed;
    }
  } catch (error) {
    console.warn('[MSW Forums] Failed to load discussions from sessionStorage:', error);
  }
  console.log('[MSW Forums] No existing discussions in storage, using initial mock data');
  return { ...INITIAL_MOCK_DISCUSSIONS };
}

/**
 * Save discussions to sessionStorage
 * 
 * Persists the current discussion state to sessionStorage so it survives
 * page reloads during E2E tests.
 * 
 * @param discussions - Record of discussion ID to Discussion objects
 */
function saveDiscussions(discussions: Record<number, Discussion>): void {
  try {
    sessionStorage.setItem(DISCUSSIONS_STORAGE_KEY, JSON.stringify(discussions));
    console.log('[MSW Forums] Saved discussions to sessionStorage:', Object.keys(discussions).length, 'discussions');
  } catch (error) {
    console.warn('[MSW Forums] Failed to save discussions to sessionStorage:', error);
  }
}

/**
 * Load posts from sessionStorage
 * 
 * Restores post data from sessionStorage if available, otherwise returns
 * the initial mock data. This ensures posts persist across page reloads.
 * 
 * @returns Record of post ID to Post objects
 */
function loadPosts(): Record<number, Post> {
  try {
    const stored = sessionStorage.getItem(POSTS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Record<number, Post>;
      console.log('[MSW Forums] Loaded posts from sessionStorage:', Object.keys(parsed).length, 'posts');
      return parsed;
    }
  } catch (error) {
    console.warn('[MSW Forums] Failed to load posts from sessionStorage:', error);
  }
  console.log('[MSW Forums] No existing posts in storage, will initialize with initial data');
  // Return empty for now, will be populated from INITIAL_MOCK_POSTS below
  return {};
}

/**
 * Save posts to sessionStorage
 * 
 * Persists the current post state to sessionStorage so it survives
 * page reloads during E2E tests.
 * 
 * @param posts - Record of post ID to Post objects
 */
function savePosts(posts: Record<number, Post>): void {
  try {
    sessionStorage.setItem(POSTS_STORAGE_KEY, JSON.stringify(posts));
    console.log('[MSW Forums] Saved posts to sessionStorage:', Object.keys(posts).length, 'posts');
  } catch (error) {
    console.warn('[MSW Forums] Failed to save posts to sessionStorage:', error);
  }
}

/**
 * Mock discussions storage - persisted across page reloads via sessionStorage
 * Use let so handlers can reload from sessionStorage on each request
 */
let MOCK_DISCUSSIONS = loadDiscussions();

/**
 * Initial mock posts (used as defaults before any test modifications)
 */
const INITIAL_MOCK_POSTS: Record<number, Post> = {
  1: {
    id: 1,
    discussionid: 1,
    parentid: 0,
    authorid: 5,
    userFullName: 'John Doe',
    userPictureUrl: '/user/pic.jpg',
    timecreated: 1640000000,
    timemodified: 1640000000,
    subject: 'First Discussion',
    message: 'This is the first discussion post',
    messageformat: 1,
    hasattachments: false,
    attachments: [],
    canEdit: false,
    canDelete: false,
    canReply: true,
    replies: []
  },
  2: {
    id: 2,
    discussionid: 1,
    parentid: 1,
    authorid: 6,
    userFullName: 'Jane Smith',
    userPictureUrl: '/user/pic2.jpg',
    timecreated: 1640010000,
    timemodified: 1640010000,
    subject: 'Re: First Discussion',
    message: 'This is a reply to the first discussion',
    messageformat: 1,
    hasattachments: false,
    attachments: [],
    canEdit: false,
    canDelete: false,
    canReply: true,
    replies: []
  }
};

/**
 * Mock posts storage - persisted across page reloads via sessionStorage
 * 
 * Initializes from sessionStorage if available, otherwise from INITIAL_MOCK_POSTS
 * Use let so handlers can reload from sessionStorage on each request
 */
let MOCK_POSTS = (() => {
  const loadedPosts = loadPosts();
  // If sessionStorage is empty, initialize with default posts
  if (Object.keys(loadedPosts).length === 0) {
    console.log('[MSW Forums] Initializing posts with initial mock data');
    return { ...INITIAL_MOCK_POSTS };
  }
  return loadedPosts;
})();

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Reload mock data from sessionStorage before each request
 * This ensures MSW handlers use fresh data after page reloads
 */
function reloadMockData(): void {
  MOCK_DISCUSSIONS = loadDiscussions();
  MOCK_POSTS = loadPosts();
}

async function simulateNetworkDelay(min = 100, max = 300): Promise<void> {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise((resolve) => setTimeout(resolve, delay));
}

// ============================================================================
// MSW Request Handlers
// ============================================================================

/**
 * GET /api/v1/forums/:id
 * Fetch forum details by ID
 */
const getForumHandler = http.get('*/api/v1/forums/:id', async ({ params }) => {
  await simulateNetworkDelay();
  
  const id = Number(params.id as string);
  const forum = MOCK_FORUMS[id];
  
  if (!forum) {
    return HttpResponse.json(
      {
        success: false,
        error: {
          code: 'FORUM_NOT_FOUND',
          message: `Forum with ID ${id} not found`,
          details: { forumId: id }
        }
      },
      { status: 404 }
    );
  }
  
  return HttpResponse.json({
    success: true,
    data: forum
  });
});

/**
 * GET /api/v1/forums/:id/discussions
 * List discussions in a forum with pagination and filtering
 */
const getDiscussionsHandler = http.get('*/api/v1/forums/:id/discussions', async ({ params, request }) => {
  reloadMockData(); // Reload fresh data from sessionStorage
  await simulateNetworkDelay();
  
  const id = Number(params.id as string);
  const forum = MOCK_FORUMS[id];
  
  if (!forum) {
    return HttpResponse.json(
      {
        success: false,
        error: {
          code: 'FORUM_NOT_FOUND',
          message: `Forum with ID ${id} not found`,
          details: { forumId: id }
        }
      },
      { status: 404 }
    );
  }
  
  const url = new URL(request.url);
  const page = Number(url.searchParams.get('page')) || 1;
  const perPage = Number(url.searchParams.get('perPage')) || 20;
  // sortBy and sortOrder are available but not implemented in mock
  // const sortBy = url.searchParams.get('sortBy') || 'modified';
  // const sortOrder = url.searchParams.get('sortOrder') || 'desc';
  
  const discussions = Object.values(MOCK_DISCUSSIONS).filter(d => d.forumid === id);
  
  return HttpResponse.json({
    success: true,
    data: {
      items: discussions,
      total: discussions.length
    },
    meta: {
      pagination: {
        page,
        perPage,
        total: discussions.length,
        totalPages: Math.ceil(discussions.length / perPage)
      }
    }
  });
});

/**
 * GET /api/v1/forums/discussions/:id/posts
 * Get posts in a discussion thread
 */
const getPostsHandler = http.get('*/api/v1/forums/discussions/:id/posts', async ({ params }) => {
  reloadMockData(); // Reload fresh data from sessionStorage
  await simulateNetworkDelay();
  
  const id = Number(params.id as string);
  console.log('[MSW Forums] Getting posts for discussion:', id);
  console.log('[MSW Forums] Current discussions:', Object.keys(MOCK_DISCUSSIONS));
  console.log('[MSW Forums] Current posts:', Object.keys(MOCK_POSTS));
  console.log('[MSW Forums] All post values:', Object.values(MOCK_POSTS).map(p => ({ id: p.id, discussionid: p.discussionid })));
  
  const discussion = MOCK_DISCUSSIONS[id];
  
  if (!discussion) {
    console.log('[MSW Forums] Discussion not found:', id);
    return HttpResponse.json(
      {
        success: false,
        error: {
          code: 'DISCUSSION_NOT_FOUND',
          message: `Discussion with ID ${id} not found`,
          details: { discussionId: id }
        }
      },
      { status: 404 }
    );
  }
  
  const posts = Object.values(MOCK_POSTS).filter(p => p.discussionid === id);
  console.log('[MSW Forums] Found', posts.length, 'posts for discussion', id);
  
  return HttpResponse.json({
    success: true,
    data: posts
  });
});

/**
 * POST /api/v1/forums/:id/discussions
 * Create a new discussion in a forum
 */
const createDiscussionHandler = http.post('*/api/v1/forums/:id/discussions', async ({ params, request }) => {
  reloadMockData(); // Reload fresh data from sessionStorage
  await simulateNetworkDelay();
  
  const id = Number(params.id as string);
  const forum = MOCK_FORUMS[id];
  
  if (!forum) {
    return HttpResponse.json(
      {
        success: false,
        error: {
          code: 'FORUM_NOT_FOUND',
          message: `Forum with ID ${id} not found`,
          details: { forumId: id }
        }
      },
      { status: 404 }
    );
  }
  
  // Handle both JSON and FormData
  let bodyData: Record<string, unknown> = {};
  const contentType = request.headers.get('content-type') || '';
  
  try {
    if (contentType.includes('application/json')) {
      bodyData = await request.json() as Record<string, unknown>;
    } else if (contentType.includes('multipart/form-data') || contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await request.formData();
      bodyData = {
        // The API sends 'subject' but the backend stores it as 'name'
        name: formData.get('subject') as string | null as string || formData.get('name') as string | null as string,
        message: formData.get('message') as string | null as string,
        messageFormat: formData.get('messageFormat') as string | null ? Number(formData.get('messageFormat') as string | null) : undefined,
        timeStart: formData.get('timeStart') as string | null ? Number(formData.get('timeStart') as string | null) : undefined,
        timeEnd: formData.get('timeEnd') as string | null ? Number(formData.get('timeEnd') as string | null) : undefined,
        groupId: formData.get('groupId') as string | null ? Number(formData.get('groupId') as string | null) : undefined,
        subscribe: formData.get('subscribe') === 'true',
        pinned: formData.get('pinned') as string | null === 'true'
      };
    } else {
      // Default to JSON for backward compatibility
      bodyData = await request.json() as Record<string, unknown>;
      // Map subject to name for JSON requests too
       
      if (bodyData.subject && !bodyData.name) {
         
        bodyData.name = bodyData.subject;
      }
    }
  } catch (error) {
    return HttpResponse.json(
      {
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Unable to parse request body',
          details: { error: String(error) }
        }
      },
      { status: 400 }
    );
  }
  
   
  if (!bodyData.name || !bodyData.message) {
    return HttpResponse.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Discussion subject and message are required',
          details: {
            missing_fields: [
               
              !bodyData.name ? 'subject' : null,
               
              !bodyData.message ? 'message' : null
            ].filter(Boolean)
          }
        }
      },
      { status: 400 }
    );
  }
  
  // Calculate next available post ID for firstpost
  const firstPostId = Object.keys(MOCK_POSTS).length + 1;
  
  const newDiscussion: Discussion = {
    id: Object.keys(MOCK_DISCUSSIONS).length + 1,
    forumid: id,
    name: bodyData.name as string,
    message: bodyData.message as string,
    messageformat: (bodyData.messageFormat as number) || 1,
    userid: 5,
    userFullName: 'Test User',
    userPictureUrl: '/user/pic.jpg',
    created: Date.now() / 1000,
    modified: Date.now() / 1000,
    timestart: (bodyData.timeStart as number) || 0,
    timeend: (bodyData.timeEnd as number) || 0,
    pinned: (bodyData.pinned as boolean) || false,
    locked: false,
    groupid: (bodyData.groupId as number) || 0,
    numReplies: 0,
    numUnreadPosts: 0,
    canReply: true,
    canEdit: true,
    canDelete: true,
    canPin: true,
    canLock: true
  };
  
  // Add the new discussion to MOCK_DISCUSSIONS so it can be found by subsequent requests
  MOCK_DISCUSSIONS[newDiscussion.id] = newDiscussion;
  saveDiscussions(MOCK_DISCUSSIONS);
  console.log('[MSW Forums] Created discussion:', newDiscussion.id, 'Current discussions:', Object.keys(MOCK_DISCUSSIONS));
  
  // Create the first post (the discussion content itself)
  const firstPost: Post = {
    id: firstPostId,
    discussionid: newDiscussion.id,
    parentid: 0,
    authorid: newDiscussion.userid,
    userFullName: newDiscussion.userFullName,
    userPictureUrl: newDiscussion.userPictureUrl,
    timecreated: newDiscussion.created,
    timemodified: newDiscussion.modified,
    subject: newDiscussion.name,
    message: bodyData.message as string,
    messageformat: (bodyData.messageFormat as number) || 1,
    hasattachments: false,
    attachments: [],
    canEdit: true,
    canDelete: true,
    canReply: true
  };
  
  MOCK_POSTS[firstPost.id] = firstPost;
  savePosts(MOCK_POSTS);
  console.log('[MSW Forums] Created first post:', firstPost.id, 'for discussion:', newDiscussion.id, 'Current posts:', Object.keys(MOCK_POSTS));
  
  // Return in DiscussionResponse format: { discussion: Discussion, message: string }
  return HttpResponse.json({
    success: true,
    data: {
      discussion: newDiscussion,
      message: 'Discussion created successfully'
    }
  }, { status: 201 });
});

/**
 * POST /api/v1/forums/discussions/:id/posts
 * Create a new post (reply) in a discussion
 */
const createPostHandler = http.post('*/api/v1/forums/discussions/:id/posts', async ({ params, request }) => {
  reloadMockData(); // Reload fresh data from sessionStorage
  await simulateNetworkDelay();
  
  const id = Number(params.id as string);
  const discussion = MOCK_DISCUSSIONS[id];
  
  if (!discussion) {
    return HttpResponse.json(
      {
        success: false,
        error: {
          code: 'DISCUSSION_NOT_FOUND',
          message: `Discussion with ID ${id} not found`,
          details: { discussionId: id }
        }
      },
      { status: 404 }
    );
  }
  
  // Handle both JSON and FormData
  let bodyData: Record<string, unknown> = {};
  const contentType = request.headers.get('content-type') || '';
  
  try {
    if (contentType.includes('application/json')) {
      bodyData = await request.json() as Record<string, unknown>;
    } else if (contentType.includes('multipart/form-data') || contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await request.formData();
      bodyData = {
        message: formData.get('message') as string | null as string,
        subject: formData.get('subject') as string | null as string,
        parentId: formData.get('parentId') ? Number(formData.get('parentId')) : undefined,
        messageFormat: formData.get('messageFormat') as string | null ? Number(formData.get('messageFormat') as string | null) : undefined,
        attachments: formData.get('attachments') ? JSON.parse(formData.get('attachments') as string) as PostAttachment[] : undefined
      };
    } else {
      // Default to JSON for backward compatibility
      bodyData = await request.json() as Record<string, unknown>;
    }
  } catch (error) {
    return HttpResponse.json(
      {
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Unable to parse request body',
          details: { error: String(error) }
        }
      },
      { status: 400 }
    );
  }
  
   
  if (!bodyData.message) {
    return HttpResponse.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Post message is required',
          details: { missing_fields: ['message'] }
        }
      },
      { status: 400 }
    );
  }
  
  const newPost: Post = {
    id: Object.keys(MOCK_POSTS).length + 1,
    discussionid: id,
    parentid: (bodyData.parentId as number) || 0,
    authorid: 5,
    userFullName: 'Test User',
    userPictureUrl: '/user/pic.jpg',
    timecreated: Date.now() / 1000,
    timemodified: Date.now() / 1000,
    subject: (bodyData.subject as string) || `Re: ${discussion.name}`,
    message: bodyData.message as string,
    messageformat: (bodyData.messageFormat as number) || 1,
    hasattachments: false,
    attachments: (bodyData.attachments as PostAttachment[]) || [],
    canEdit: true,
    canDelete: true,
    canReply: true
  };
  
  // Add the new post to MOCK_POSTS so it can be found by subsequent requests
  MOCK_POSTS[newPost.id] = newPost;
  savePosts(MOCK_POSTS);
  
  // Update the discussion's reply count if the discussion exists
  if (discussion) {
    discussion.numReplies += 1;
    saveDiscussions(MOCK_DISCUSSIONS);
  }
  
  return HttpResponse.json({
    success: true,
    data: newPost
  }, { status: 201 });
});

/**
 * PUT /api/v1/forums/posts/:id
 * Update an existing post
 */
const updatePostHandler = http.put('*/api/v1/forums/posts/:id', async ({ params, request }) => {
  reloadMockData(); // Reload fresh data from sessionStorage
  await simulateNetworkDelay();
  
  const id = Number(params.id as string);
  const post = MOCK_POSTS[id];
  
  if (!post) {
    return HttpResponse.json(
      {
        success: false,
        error: {
          code: 'POST_NOT_FOUND',
          message: `Post with ID ${id} not found`,
          details: { postId: id }
        }
      },
      { status: 404 }
    );
  }
  
  // Handle both JSON and FormData
  let bodyData: Record<string, unknown> = {};
  const contentType = request.headers.get('content-type') || '';
  
  try {
    if (contentType.includes('application/json')) {
      bodyData = await request.json() as Record<string, unknown>;
    } else if (contentType.includes('multipart/form-data') || contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await request.formData();
      bodyData = {
        subject: formData.get('subject') as string | null as string,
        message: formData.get('message') as string | null as string
      };
    } else {
      // Default to JSON for backward compatibility
      bodyData = await request.json() as Record<string, unknown>;
    }
  } catch (error) {
    return HttpResponse.json(
      {
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Unable to parse request body',
          details: { error: String(error) }
        }
      },
      { status: 400 }
    );
  }
  
  const updatedPost = {
    ...post,
     
    subject: bodyData.subject || post.subject,
     
    message: bodyData.message || post.message,
    timemodified: Date.now() / 1000
  };
  
  return HttpResponse.json({
    success: true,
    data: updatedPost
  });
});

/**
 * DELETE /api/v1/forums/posts/:id
 * Delete a post
 */
const deletePostHandler = http.delete('*/api/v1/forums/posts/:id', async ({ params }) => {
  reloadMockData(); // Reload fresh data from sessionStorage
  await simulateNetworkDelay();
  
  const id = Number(params.id as string);
  const post = MOCK_POSTS[id];
  
  if (!post) {
    return HttpResponse.json(
      {
        success: false,
        error: {
          code: 'POST_NOT_FOUND',
          message: `Post with ID ${id} not found`,
          details: { postId: id }
        }
      },
      { status: 404 }
    );
  }
  
  return HttpResponse.json({
    success: true,
    data: { message: 'Post deleted successfully' }
  });
});

/**
 * POST /api/v1/forums/:id/subscribe
 * Subscribe to forum notifications
 */
const subscribeForumHandler = http.post('*/api/v1/forums/:id/subscribe', async ({ params, request: _request }) => {
  await simulateNetworkDelay();
  
  const id = Number(params.id as string);
  const forum = MOCK_FORUMS[id];
  
  if (!forum) {
    return HttpResponse.json(
      {
        success: false,
        error: {
          code: 'FORUM_NOT_FOUND',
          message: `Forum with ID ${id} not found`,
          details: { forumId: id }
        }
      },
      { status: 404 }
    );
  }
  
  return HttpResponse.json({
    success: true,
    data: {
      forumId: id,
      isSubscribed: true,
      message: 'Successfully subscribed to forum'
    }
  });
});

/**
 * POST /api/v1/forums/:id/unsubscribe
 * Unsubscribe from forum notifications
 */
const unsubscribeForumHandler = http.post('*/api/v1/forums/:id/unsubscribe', async ({ params }) => {
  await simulateNetworkDelay();
  
  const id = Number(params.id as string);
  const forum = MOCK_FORUMS[id];
  
  if (!forum) {
    return HttpResponse.json(
      {
        success: false,
        error: {
          code: 'FORUM_NOT_FOUND',
          message: `Forum with ID ${id} not found`,
          details: { forumId: id }
        }
      },
      { status: 404 }
    );
  }
  
  return HttpResponse.json({
    success: true,
    data: {
      forumId: id,
      isSubscribed: false,
      message: 'Successfully unsubscribed from forum'
    }
  });
});

/**
 * POST /api/v1/forums/discussions/:id/subscribe
 * Subscribe to discussion notifications
 */
const subscribeDiscussionHandler = http.post('*/api/v1/forums/discussions/:id/subscribe', async ({ params }) => {
  reloadMockData(); // Reload fresh data from sessionStorage
  await simulateNetworkDelay();
  
  const id = Number(params.id as string);
  const discussion = MOCK_DISCUSSIONS[id];
  
  if (!discussion) {
    return HttpResponse.json(
      {
        success: false,
        error: {
          code: 'DISCUSSION_NOT_FOUND',
          message: `Discussion with ID ${id} not found`,
          details: { discussionId: id }
        }
      },
      { status: 404 }
    );
  }
  
  return HttpResponse.json({
    success: true,
    data: {
      discussionId: id,
      isSubscribed: true,
      message: 'Successfully subscribed to discussion'
    }
  });
});

/**
 * POST /api/v1/forums/discussions/:id/unsubscribe
 * Unsubscribe from discussion notifications
 */
const unsubscribeDiscussionHandler = http.post('*/api/v1/forums/discussions/:id/unsubscribe', async ({ params }) => {
  reloadMockData(); // Reload fresh data from sessionStorage
  await simulateNetworkDelay();
  
  const id = Number(params.id as string);
  const discussion = MOCK_DISCUSSIONS[id];
  
  if (!discussion) {
    return HttpResponse.json(
      {
        success: false,
        error: {
          code: 'DISCUSSION_NOT_FOUND',
          message: `Discussion with ID ${id} not found`,
          details: { discussionId: id }
        }
      },
      { status: 404 }
    );
  }
  
  return HttpResponse.json({
    success: true,
    data: {
      discussionId: id,
      isSubscribed: false,
      message: 'Successfully unsubscribed from discussion'
    }
  });
});

/**
 * POST /api/v1/forums/discussions/:id/read
 * Mark discussion as read
 */
const markReadHandler = http.post('*/api/v1/forums/discussions/:id/read', async ({ params }) => {
  reloadMockData(); // Reload fresh data from sessionStorage
  await simulateNetworkDelay();
  
  const id = Number(params.id as string);
  const discussion = MOCK_DISCUSSIONS[id];
  
  if (!discussion) {
    return HttpResponse.json(
      {
        success: false,
        error: {
          code: 'DISCUSSION_NOT_FOUND',
          message: `Discussion with ID ${id} not found`,
          details: { discussionId: id }
        }
      },
      { status: 404 }
    );
  }
  
  // Count posts in this discussion for postsRead
  const postsInDiscussion = Object.values(MOCK_POSTS).filter(p => p.discussionid === id);
  
  return HttpResponse.json({
    success: true,
    data: {
      postsRead: postsInDiscussion.length,
      unreadCount: 0
    }
  });
});

/**
 * POST /api/v1/forums/discussions/:id/pin
 * Pin a discussion to the top
 */
const pinDiscussionHandler = http.post('*/api/v1/forums/discussions/:id/pin', async ({ params }) => {
  reloadMockData(); // Reload fresh data from sessionStorage
  await simulateNetworkDelay();
  
  const id = Number(params.id as string);
  const discussion = MOCK_DISCUSSIONS[id];
  
  if (!discussion) {
    return HttpResponse.json(
      {
        success: false,
        error: {
          code: 'DISCUSSION_NOT_FOUND',
          message: `Discussion with ID ${id} not found`,
          details: { discussionId: id }
        }
      },
      { status: 404 }
    );
  }
  
  // Update the mock data to persist the pinned state
  MOCK_DISCUSSIONS[id] = {
    ...discussion,
    pinned: true
  };
  saveDiscussions(MOCK_DISCUSSIONS);
  
  // Return ModerationResponse format
  return HttpResponse.json({
    success: true,
    data: {
      success: true,
      message: 'Discussion pinned successfully',
      discussionId: id,
      discussion: MOCK_DISCUSSIONS[id],
      state: { pinned: true }
    }
  });
});

/**
 * POST /api/v1/forums/discussions/:id/unpin
 * Unpin a discussion
 */
const unpinDiscussionHandler = http.post('*/api/v1/forums/discussions/:id/unpin', async ({ params }) => {
  reloadMockData(); // Reload fresh data from sessionStorage
  await simulateNetworkDelay();
  
  const id = Number(params.id as string);
  const discussion = MOCK_DISCUSSIONS[id];
  
  if (!discussion) {
    return HttpResponse.json(
      {
        success: false,
        error: {
          code: 'DISCUSSION_NOT_FOUND',
          message: `Discussion with ID ${id} not found`,
          details: { discussionId: id }
        }
      },
      { status: 404 }
    );
  }
  
  // Update the mock data to persist the unpinned state
  MOCK_DISCUSSIONS[id] = {
    ...discussion,
    pinned: false
  };
  saveDiscussions(MOCK_DISCUSSIONS);
  
  // Return ModerationResponse format
  return HttpResponse.json({
    success: true,
    data: {
      success: true,
      message: 'Discussion unpinned successfully',
      discussionId: id,
      discussion: MOCK_DISCUSSIONS[id],
      state: { pinned: false }
    }
  });
});

/**
 * POST /api/v1/forums/discussions/:id/lock
 * Lock a discussion (prevent new replies)
 */
const lockDiscussionHandler = http.post('*/api/v1/forums/discussions/:id/lock', async ({ params }) => {
  reloadMockData(); // Reload fresh data from sessionStorage
  await simulateNetworkDelay();
  
  const id = Number(params.id as string);
  const discussion = MOCK_DISCUSSIONS[id];
  
  if (!discussion) {
    return HttpResponse.json(
      {
        success: false,
        error: {
          code: 'DISCUSSION_NOT_FOUND',
          message: `Discussion with ID ${id} not found`,
          details: { discussionId: id }
        }
      },
      { status: 404 }
    );
  }
  
  // Update the mock data to persist the locked state
  MOCK_DISCUSSIONS[id] = {
    ...discussion,
    locked: true
  };
  saveDiscussions(MOCK_DISCUSSIONS);
  
  // Return ModerationResponse format
  return HttpResponse.json({
    success: true,
    data: {
      success: true,
      message: 'Discussion locked successfully',
      discussionId: id,
      discussion: MOCK_DISCUSSIONS[id],
      state: { locked: true }
    }
  });
});

/**
 * POST /api/v1/forums/discussions/:id/unlock
 * Unlock a discussion
 */
const unlockDiscussionHandler = http.post('*/api/v1/forums/discussions/:id/unlock', async ({ params }) => {
  reloadMockData(); // Reload fresh data from sessionStorage
  await simulateNetworkDelay();
  
  const id = Number(params.id as string);
  const discussion = MOCK_DISCUSSIONS[id];
  
  if (!discussion) {
    return HttpResponse.json(
      {
        success: false,
        error: {
          code: 'DISCUSSION_NOT_FOUND',
          message: `Discussion with ID ${id} not found`,
          details: { discussionId: id }
        }
      },
      { status: 404 }
    );
  }
  
  // Update the mock data to persist the unlocked state
  MOCK_DISCUSSIONS[id] = {
    ...discussion,
    locked: false
  };
  saveDiscussions(MOCK_DISCUSSIONS);
  
  // Return ModerationResponse format
  return HttpResponse.json({
    success: true,
    data: {
      success: true,
      message: 'Discussion unlocked successfully',
      discussionId: id,
      discussion: MOCK_DISCUSSIONS[id],
      state: { locked: false }
    }
  });
});

/**
 * POST /api/v1/forums/posts/:id/report
 * Report a post for moderation
 */
const reportPostHandler = http.post('*/api/v1/forums/posts/:id/report', async ({ params, request }) => {
  reloadMockData(); // Reload fresh data from sessionStorage
  await simulateNetworkDelay();
  
  const id = Number(params.id as string);
  const post = MOCK_POSTS[id];
  
  if (!post) {
    return HttpResponse.json(
      {
        success: false,
        error: {
          code: 'POST_NOT_FOUND',
          message: `Post with ID ${id} not found`,
          details: { postId: id }
        }
      },
      { status: 404 }
    );
  }
  
  // Handle both JSON and FormData
  let bodyData: Record<string, unknown> = {};
  const contentType = request.headers.get('content-type') || '';
  
  try {
    if (contentType.includes('application/json')) {
      bodyData = await request.json() as Record<string, unknown>;
    } else if (contentType.includes('multipart/form-data') || contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await request.formData();
      bodyData = {
        reason: formData.get('reason') as string
      };
    } else {
      // Default to JSON for backward compatibility
      bodyData = await request.json() as Record<string, unknown>;
    }
  } catch (error) {
    return HttpResponse.json(
      {
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Unable to parse request body',
          details: { error: String(error) }
        }
      },
      { status: 400 }
    );
  }
  
   
  if (!bodyData.reason) {
    return HttpResponse.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Report reason is required',
          details: { missing_fields: ['reason'] }
        }
      },
      { status: 400 }
    );
  }
  
  return HttpResponse.json({
    success: true,
    data: {
      postId: id,
      reportId: Math.floor(Math.random() * 1000),
      message: 'Post reported successfully',
      status: 'pending'
    }
  });
});

// ============================================================================
// Export Handlers
// ============================================================================

/**
 * Array of all forum-related MSW request handlers
 * 
 * Usage in test setup:
 * ```typescript
 * import { forumsHandlers } from './mocks/handlers/forums';
 * 
 * const server = setupServer(...forumsHandlers);
 * 
 * beforeAll(() => server.listen());
 * afterEach(() => server.resetHandlers());
 * afterAll(() => server.close());
 * ```
 */
export const forumsHandlers = [
  getForumHandler,
  getDiscussionsHandler,
  getPostsHandler,
  createDiscussionHandler,
  createPostHandler,
  updatePostHandler,
  deletePostHandler,
  subscribeForumHandler,
  unsubscribeForumHandler,
  subscribeDiscussionHandler,
  unsubscribeDiscussionHandler,
  markReadHandler,
  pinDiscussionHandler,
  unpinDiscussionHandler,
  lockDiscussionHandler,
  unlockDiscussionHandler,
  reportPostHandler,
];
