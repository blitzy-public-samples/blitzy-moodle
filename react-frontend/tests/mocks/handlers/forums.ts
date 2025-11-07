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

// ============================================================================
// TypeScript Type Definitions
// ============================================================================

interface Forum {
  id: number;
  courseId: number;
  name: string;
  intro: string;
  type: string;
  assessed: number;
  assesstimestart: number;
  assesstimefinish: number;
  scale: number;
  maxbytes: number;
  maxattachments: number;
  forcesubscribe: number;
  trackingtype: number;
  rsstype: number;
  rssarticles: number;
  timemodified: number;
  warnafter: number;
  blockafter: number;
  blockperiod: number;
  completiondiscussions: number;
  completionreplies: number;
  completionposts: number;
  displaywordcount: boolean;
  lockdiscussionafter: number;
  canCreateDiscussion: boolean;
  canSubscribe: boolean;
  isSubscribed: boolean;
}

interface Discussion {
  id: number;
  forumId: number;
  name: string;
  message: string;
  messageFormat: number;
  userId: number;
  userFullName: string;
  userPictureUrl: string;
  created: number;
  modified: number;
  timeStart: number;
  timeEnd: number;
  pinned: boolean;
  locked: boolean;
  groupId: number;
  numReplies: number;
  numUnreadPosts: number;
  canReply: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canPin: boolean;
  canLock: boolean;
}

interface Post {
  id: number;
  discussionId: number;
  parentId: number;
  userId: number;
  userFullName: string;
  userPictureUrl: string;
  created: number;
  modified: number;
  subject: string;
  message: string;
  messageFormat: number;
  attachment: boolean;
  attachments: any[];
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
    courseId: 10,
    name: 'General Discussion Forum',
    intro: 'Welcome to the general discussion forum',
    type: 'general',
    assessed: 0,
    assesstimestart: 0,
    assesstimefinish: 0,
    scale: 0,
    maxbytes: 512000,
    maxattachments: 5,
    forcesubscribe: 0,
    trackingtype: 1,
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
    canCreateDiscussion: true,
    canSubscribe: true,
    isSubscribed: false
  }
};

const MOCK_DISCUSSIONS: Record<number, Discussion> = {
  1: {
    id: 1,
    forumId: 1,
    name: 'First Discussion',
    message: 'This is the first discussion post',
    messageFormat: 1,
    userId: 5,
    userFullName: 'John Doe',
    userPictureUrl: '/user/pic.jpg',
    created: 1640000000,
    modified: 1640000000,
    timeStart: 0,
    timeEnd: 0,
    pinned: true,
    locked: false,
    groupId: -1,
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
    forumId: 1,
    name: 'Second Discussion',
    message: 'This is the second discussion post',
    messageFormat: 1,
    userId: 6,
    userFullName: 'Jane Smith',
    userPictureUrl: '/user/pic2.jpg',
    created: 1640100000,
    modified: 1640100000,
    timeStart: 0,
    timeEnd: 0,
    pinned: false,
    locked: false,
    groupId: -1,
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
    forumId: 1,
    name: 'Test Discussion 101',
    message: 'This is test discussion 101 for unit tests',
    messageFormat: 1,
    userId: 5,
    userFullName: 'Test User',
    userPictureUrl: '/user/pic.jpg',
    created: 1640200000,
    modified: 1640200000,
    timeStart: 0,
    timeEnd: 0,
    pinned: false,
    locked: false,
    groupId: -1,
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
    forumId: 1,
    name: 'Test Discussion 102',
    message: 'This is test discussion 102 for unit tests',
    messageFormat: 1,
    userId: 6,
    userFullName: 'Test User 2',
    userPictureUrl: '/user/pic2.jpg',
    created: 1640300000,
    modified: 1640300000,
    timeStart: 0,
    timeEnd: 0,
    pinned: true,
    locked: false,
    groupId: -1,
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
    forumId: 1,
    name: 'Test Discussion 103',
    message: 'This is test discussion 103 for unit tests',
    messageFormat: 1,
    userId: 5,
    userFullName: 'Test User',
    userPictureUrl: '/user/pic.jpg',
    created: 1640400000,
    modified: 1640400000,
    timeStart: 0,
    timeEnd: 0,
    pinned: false,
    locked: true,
    groupId: -1,
    numReplies: 1,
    numUnreadPosts: 0,
    canReply: false,
    canEdit: true,
    canDelete: true,
    canPin: true,
    canLock: true
  }
};

const MOCK_POSTS: Record<number, Post> = {
  1: {
    id: 1,
    discussionId: 1,
    parentId: 0,
    userId: 5,
    userFullName: 'John Doe',
    userPictureUrl: '/user/pic.jpg',
    created: 1640000000,
    modified: 1640000000,
    subject: 'First Discussion',
    message: 'This is the first discussion post',
    messageFormat: 1,
    attachment: false,
    attachments: [],
    canEdit: false,
    canDelete: false,
    canReply: true,
    replies: []
  },
  2: {
    id: 2,
    discussionId: 1,
    parentId: 1,
    userId: 6,
    userFullName: 'Jane Smith',
    userPictureUrl: '/user/pic2.jpg',
    created: 1640010000,
    modified: 1640010000,
    subject: 'Re: First Discussion',
    message: 'This is a reply to the first discussion',
    messageFormat: 1,
    attachment: false,
    attachments: [],
    canEdit: false,
    canDelete: false,
    canReply: true,
    replies: []
  }
};

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
 * GET /api/v1/forums/:id
 * Fetch forum details by ID
 */
const getForumHandler = http.get('*/api/v1/forums/:id', async ({ params }) => {
  await simulateNetworkDelay();
  
  const id = Number(params.id);
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
  await simulateNetworkDelay();
  
  const id = Number(params.id);
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
  const sortBy = url.searchParams.get('sortBy') || 'modified';
  const sortOrder = url.searchParams.get('sortOrder') || 'desc';
  
  const discussions = Object.values(MOCK_DISCUSSIONS).filter(d => d.forumId === id);
  
  return HttpResponse.json({
    success: true,
    data: discussions,
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
  await simulateNetworkDelay();
  
  const id = Number(params.id);
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
  
  const posts = Object.values(MOCK_POSTS).filter(p => p.discussionId === id);
  
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
  await simulateNetworkDelay();
  
  const id = Number(params.id);
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
  let bodyData: any = {};
  const contentType = request.headers.get('content-type') || '';
  
  try {
    if (contentType.includes('application/json')) {
      bodyData = await request.json();
    } else if (contentType.includes('multipart/form-data') || contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await request.formData();
      bodyData = {
        name: formData.get('name') as string,
        message: formData.get('message') as string,
        messageFormat: formData.get('messageFormat') ? Number(formData.get('messageFormat')) : undefined,
        timeStart: formData.get('timeStart') ? Number(formData.get('timeStart')) : undefined,
        timeEnd: formData.get('timeEnd') ? Number(formData.get('timeEnd')) : undefined,
        groupId: formData.get('groupId') ? Number(formData.get('groupId')) : undefined
      };
    } else {
      // Default to JSON for backward compatibility
      bodyData = await request.json();
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
          message: 'Discussion name and message are required',
          details: {
            missing_fields: [
              !bodyData.name ? 'name' : null,
              !bodyData.message ? 'message' : null
            ].filter(Boolean)
          }
        }
      },
      { status: 400 }
    );
  }
  
  const newDiscussion: Discussion = {
    id: Object.keys(MOCK_DISCUSSIONS).length + 1,
    forumId: id,
    name: bodyData.name,
    message: bodyData.message,
    messageFormat: bodyData.messageFormat || 1,
    userId: 5,
    userFullName: 'Test User',
    userPictureUrl: '/user/pic.jpg',
    created: Date.now() / 1000,
    modified: Date.now() / 1000,
    timeStart: bodyData.timeStart || 0,
    timeEnd: bodyData.timeEnd || 0,
    pinned: false,
    locked: false,
    groupId: bodyData.groupId || -1,
    numReplies: 0,
    numUnreadPosts: 0,
    canReply: true,
    canEdit: true,
    canDelete: true,
    canPin: false,
    canLock: false
  };
  
  return HttpResponse.json({
    success: true,
    data: newDiscussion
  }, { status: 201 });
});

/**
 * POST /api/v1/forums/discussions/:id/posts
 * Create a new post (reply) in a discussion
 */
const createPostHandler = http.post('*/api/v1/forums/discussions/:id/posts', async ({ params, request }) => {
  await simulateNetworkDelay();
  
  const id = Number(params.id);
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
  let bodyData: any = {};
  const contentType = request.headers.get('content-type') || '';
  
  try {
    if (contentType.includes('application/json')) {
      bodyData = await request.json();
    } else if (contentType.includes('multipart/form-data') || contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await request.formData();
      bodyData = {
        message: formData.get('message') as string,
        subject: formData.get('subject') as string,
        parentId: formData.get('parentId') ? Number(formData.get('parentId')) : undefined,
        messageFormat: formData.get('messageFormat') ? Number(formData.get('messageFormat')) : undefined,
        attachments: formData.get('attachments') ? JSON.parse(formData.get('attachments') as string) : undefined
      };
    } else {
      // Default to JSON for backward compatibility
      bodyData = await request.json();
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
    discussionId: id,
    parentId: bodyData.parentId || 0,
    userId: 5,
    userFullName: 'Test User',
    userPictureUrl: '/user/pic.jpg',
    created: Date.now() / 1000,
    modified: Date.now() / 1000,
    subject: bodyData.subject || 'Re: ' + discussion.name,
    message: bodyData.message,
    messageFormat: bodyData.messageFormat || 1,
    attachment: false,
    attachments: bodyData.attachments || [],
    canEdit: true,
    canDelete: true,
    canReply: true,
    replies: []
  };
  
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
  await simulateNetworkDelay();
  
  const id = Number(params.id);
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
  let bodyData: any = {};
  const contentType = request.headers.get('content-type') || '';
  
  try {
    if (contentType.includes('application/json')) {
      bodyData = await request.json();
    } else if (contentType.includes('multipart/form-data') || contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await request.formData();
      bodyData = {
        subject: formData.get('subject') as string,
        message: formData.get('message') as string
      };
    } else {
      // Default to JSON for backward compatibility
      bodyData = await request.json();
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
    modified: Date.now() / 1000
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
  await simulateNetworkDelay();
  
  const id = Number(params.id);
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
const subscribeForumHandler = http.post('*/api/v1/forums/:id/subscribe', async ({ params, request }) => {
  await simulateNetworkDelay();
  
  const id = Number(params.id);
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
  
  const id = Number(params.id);
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
  await simulateNetworkDelay();
  
  const id = Number(params.id);
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
  await simulateNetworkDelay();
  
  const id = Number(params.id);
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
  await simulateNetworkDelay();
  
  const id = Number(params.id);
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
      message: 'Discussion marked as read'
    }
  });
});

/**
 * POST /api/v1/forums/discussions/:id/pin
 * Pin a discussion to the top
 */
const pinDiscussionHandler = http.post('*/api/v1/forums/discussions/:id/pin', async ({ params }) => {
  await simulateNetworkDelay();
  
  const id = Number(params.id);
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
      discussion: {
        ...discussion,
        pinned: true
      },
      message: 'Discussion pinned successfully'
    }
  });
});

/**
 * POST /api/v1/forums/discussions/:id/unpin
 * Unpin a discussion
 */
const unpinDiscussionHandler = http.post('*/api/v1/forums/discussions/:id/unpin', async ({ params }) => {
  await simulateNetworkDelay();
  
  const id = Number(params.id);
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
      discussion: {
        ...discussion,
        pinned: false
      },
      message: 'Discussion unpinned successfully'
    }
  });
});

/**
 * POST /api/v1/forums/discussions/:id/lock
 * Lock a discussion (prevent new replies)
 */
const lockDiscussionHandler = http.post('*/api/v1/forums/discussions/:id/lock', async ({ params }) => {
  await simulateNetworkDelay();
  
  const id = Number(params.id);
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
      discussion: {
        ...discussion,
        locked: true
      },
      message: 'Discussion locked successfully'
    }
  });
});

/**
 * POST /api/v1/forums/discussions/:id/unlock
 * Unlock a discussion
 */
const unlockDiscussionHandler = http.post('*/api/v1/forums/discussions/:id/unlock', async ({ params }) => {
  await simulateNetworkDelay();
  
  const id = Number(params.id);
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
      discussion: {
        ...discussion,
        locked: false
      },
      message: 'Discussion unlocked successfully'
    }
  });
});

/**
 * POST /api/v1/forums/posts/:id/report
 * Report a post for moderation
 */
const reportPostHandler = http.post('*/api/v1/forums/posts/:id/report', async ({ params, request }) => {
  await simulateNetworkDelay();
  
  const id = Number(params.id);
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
  let bodyData: any = {};
  const contentType = request.headers.get('content-type') || '';
  
  try {
    if (contentType.includes('application/json')) {
      bodyData = await request.json();
    } else if (contentType.includes('multipart/form-data') || contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await request.formData();
      bodyData = {
        reason: formData.get('reason') as string
      };
    } else {
      // Default to JSON for backward compatibility
      bodyData = await request.json();
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
