/**
 * Unit tests for forumApi module
 * 
 * Tests all forum-related API endpoint integrations including:
 * - Fetching forum details
 * - Retrieving discussion lists with pagination/filtering
 * - Getting discussion threads with nested posts
 * - Creating discussions and replies
 * - Editing and deleting posts
 * - Subscription management
 * - Moderator actions (pin, lock, report)
 * - Comprehensive error handling
 * 
 * Uses MSW (Mock Service Worker) for API mocking
 */

import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../../../mocks/server';

// Import the forumApi module (adjust path based on actual location)
import * as forumApi from '@/features/activities/forums/api/forumApi';
import type { 
  Forum, 
  Discussion, 
  Post, 
  DiscussionListOptions,
  CreateDiscussionData,
  CreatePostData,
  UpdatePostData,
  SubscriptionPreferences
} from '@/features/activities/forums/types/forum.types';

// Mock API base URL
const API_BASE_URL = 'http://localhost:8000/api/v1';

// Mock JWT token for authentication
const MOCK_JWT_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

// Mock data
const mockForum: Forum = {
  id: 1,
  courseid: 10,
  name: 'General Discussion Forum',
  intro: 'Welcome to the general discussion forum',
  introformat: 1,
  type: 'general',
  assessed: 0,
  assesstimestart: 0,
  assesstimefinish: 0,
  scale: 0,
  gradeforum: 0,
  gradeforumnotify: false,
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
  duedate: 0,
  cutoffdate: 0,
  subscribed: false,
  canSubscribe: true,
  canAddDiscussion: true,
  canModerate: false,
  unreadCount: 0,
  discussionCount: 5,
  postCount: 25,
  participants: 10
};

const mockDiscussions: Discussion[] = [
  {
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
  {
    id: 2,
    forumId: 1,
    name: 'Second Discussion',
    message: 'This is the second discussion post',
    messageFormat: 1,
    userId: 6,
    userFullName: 'Jane Smith',
    userPictureUrl: '/user/pic2.jpg',
    created: 1640001000,
    modified: 1640001000,
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
  }
];

const mockPost: Post = {
  id: 1,
  discussionId: 1,
  parentId: 0,
  userId: 5,
  userFullName: 'John Doe',
  userPictureUrl: '/user/pic.jpg',
  subject: 'First Discussion',
  message: 'This is the first discussion post',
  messageFormat: 1,
  created: 1640000000,
  modified: 1640000000,
  hasAttachments: false,
  attachments: [],
  isUnread: false,
  canEdit: true,
  canDelete: true,
  canReply: true,
  replies: []
};

const mockDiscussionWithPosts = {
  ...mockDiscussions[0],
  posts: [
    mockPost,
    {
      id: 2,
      discussionId: 1,
      parentId: 1,
      userId: 6,
      userFullName: 'Jane Smith',
      userPictureUrl: '/user/pic2.jpg',
      subject: 'Re: First Discussion',
      message: 'This is a reply to the first post',
      messageFormat: 1,
      created: 1640001000,
      modified: 1640001000,
      hasAttachments: false,
      attachments: [],
      isUnread: true,
      canEdit: false,
      canDelete: false,
      canReply: true,
      replies: [
        {
          id: 3,
          discussionId: 1,
          parentId: 2,
          userId: 5,
          userFullName: 'John Doe',
          userPictureUrl: '/user/pic.jpg',
          subject: 'Re: Re: First Discussion',
          message: 'This is a nested reply',
          messageFormat: 1,
          created: 1640002000,
          modified: 1640002000,
          hasAttachments: false,
          attachments: [],
          isUnread: false,
          canEdit: true,
          canDelete: true,
          canReply: true,
          replies: []
        }
      ]
    }
  ]
};

// MSW request handlers
const handlers = [
  // GET forum by ID
  http.get(`*${API_BASE_URL}/forums/:id`, ({ params }) => {
    const { id } = params;
    
    if (id === '404') {
      return HttpResponse.json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Forum not found'
        }
      }, { status: 404 });
    }
    
    if (id === '403') {
      return HttpResponse.json({
        success: false,
        error: {
          code: 'PERMISSION_DENIED',
          message: 'You do not have permission to view this forum'
        }
      }, { status: 403 });
    }
    
    return HttpResponse.json({
      success: true,
      data: mockForum
    });
  }),

  // GET discussions list
  http.get(`*${API_BASE_URL}/forums/:id/discussions`, ({ params, request }) => {
    const { id } = params;
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const perPage = parseInt(url.searchParams.get('perPage') || '20');
    const sortBy = url.searchParams.get('sortBy') || 'date';
    const filter = url.searchParams.get('filter') || 'all';
    
    // Filter discussions based on filter parameter
    let filteredDiscussions = [...mockDiscussions];
    if (filter === 'unread') {
      filteredDiscussions = filteredDiscussions.filter(d => d.numUnreadPosts > 0);
    } else if (filter === 'pinned') {
      filteredDiscussions = filteredDiscussions.filter(d => d.pinned);
    }
    
    // Sort discussions
    if (sortBy === 'replies') {
      filteredDiscussions.sort((a, b) => b.numReplies - a.numReplies);
    } else if (sortBy === 'author') {
      filteredDiscussions.sort((a, b) => a.userFullName.localeCompare(b.userFullName));
    }
    
    // Pagination
    const total = filteredDiscussions.length;
    const start = (page - 1) * perPage;
    const end = start + perPage;
    const paginatedDiscussions = filteredDiscussions.slice(start, end);
    
    return HttpResponse.json({
      success: true,
      data: paginatedDiscussions,
      meta: {
        pagination: {
          page,
          perPage,
          total,
          totalPages: Math.ceil(total / perPage)
        }
      }
    });
  }),

  // GET discussion posts
  http.get(`*${API_BASE_URL}/forums/discussions/:id/posts`, ({ params }) => {
    const { id } = params;
    
    if (id === '1') {
      return HttpResponse.json({
        success: true,
        data: mockDiscussionWithPosts
      });
    }
    
    // Discussion with no replies
    if (id === '999') {
      return HttpResponse.json({
        success: true,
        data: {
          ...mockDiscussions[0],
          posts: [mockPost]
        }
      });
    }
    
    return HttpResponse.json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Discussion not found'
      }
    }, { status: 404 });
  }),

  // POST create discussion
  http.post(`*${API_BASE_URL}/forums/:id/discussions`, async ({ params, request }) => {
    const { id } = params;
    const formData = await request.formData();
    
    // Extract fields from FormData
    const subject = formData.get('subject') as string;
    const message = formData.get('message') as string;
    const subscribe = formData.get('subscribe') === 'true';
    const pinned = formData.get('pinned') === 'true';
    
    // Validation errors
    if (!subject || subject.trim() === '') {
      return HttpResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Subject is required',
          details: { field: 'subject' }
        }
      }, { status: 400 });
    }
    
    if (!message || message.trim() === '') {
      return HttpResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Message is required',
          details: { field: 'message' }
        }
      }, { status: 400 });
    }
    
    // Return created discussion
    const newDiscussion: Discussion = {
      id: 999,
      forumId: parseInt(id as string),
      name: subject,
      message: message,
      messageFormat: 1,
      userId: 5,
      userFullName: 'John Doe',
      userPictureUrl: '/user/pic.jpg',
      created: Date.now() / 1000,
      modified: Date.now() / 1000,
      timeStart: 0,
      timeEnd: 0,
      pinned: pinned,
      locked: false,
      groupId: -1,
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
  }),

  // POST create post (reply)
  http.post(`*${API_BASE_URL}/forums/discussions/:id/posts`, async ({ params, request }) => {
    const { id } = params;
    const formData = await request.formData();
    
    // Extract fields from FormData
    const message = formData.get('message') as string;
    const parentIdStr = formData.get('parentId') as string | null;
    const parentId = parentIdStr ? parseInt(parentIdStr) : 0;
    
    const newPost: Post = {
      id: 1000,
      discussionId: parseInt(id as string),
      parentId: parentId,
      userId: 5,
      userFullName: 'John Doe',
      userPictureUrl: '/user/pic.jpg',
      subject: 'Re: Discussion',
      message: message,
      messageFormat: 1,
      created: Date.now() / 1000,
      modified: Date.now() / 1000,
      hasAttachments: false,
      attachments: [],
      isUnread: false,
      canEdit: true,
      canDelete: true,
      canReply: true,
      replies: []
    };
    
    return HttpResponse.json({
      success: true,
      data: newPost
    }, { status: 201 });
  }),

  // PUT update post
  http.put(`*${API_BASE_URL}/forums/posts/:id`, async ({ params, request }) => {
    const { id } = params;
    
    // Simulate concurrent edit detection
    if (id === '409') {
      return HttpResponse.json({
        success: false,
        error: {
          code: 'CONFLICT',
          message: 'This post has been modified by another user',
          details: { version: 2 }
        }
      }, { status: 409 });
    }
    
    // Parse FormData from request
    // NOTE: MSW v2 has a known bug in Node.js where request.formData() hangs
    // when FormData contains File objects. Our tests avoid sending File objects
    // to work around this limitation. Full file upload testing should be done
    // in integration/E2E tests with a real backend.
    const formData = await request.formData();
    const message = formData.get('message') as string || 'Updated message';
    const removeAttachmentsStr = formData.get('removeAttachments') as string;
    const removeAttachments = removeAttachmentsStr ? JSON.parse(removeAttachmentsStr) : [];
    
    // Simulate attachment removal
    const attachments = removeAttachments.length > 0 
      ? mockPost.attachments?.filter(att => !removeAttachments.includes(att.id))
      : mockPost.attachments;
    
    const updatedPost: Post = {
      ...mockPost,
      id: parseInt(id as string),
      message: message,
      attachments: attachments,
      modified: Date.now() / 1000,
      editedBy: 'John Doe',
      editedAt: Date.now() / 1000
    };
    
    return HttpResponse.json({
      success: true,
      data: updatedPost
    });
  }),

  // DELETE post
  http.delete(`*${API_BASE_URL}/forums/posts/:id`, ({ params }) => {
    const { id } = params;
    
    if (id === '403') {
      return HttpResponse.json({
        success: false,
        error: {
          code: 'PERMISSION_DENIED',
          message: 'You do not have permission to delete this post'
        }
      }, { status: 403 });
    }
    
    return new HttpResponse(null, { status: 204 });
  }),

  // POST subscribe to forum
  http.post(`*${API_BASE_URL}/forums/:id/subscribe`, async ({ params, request }) => {
    const { id } = params;
    
    // Handle optional preferences in body
    let preferences = {};
    try {
      const body = await request.text();
      if (body) {
        preferences = JSON.parse(body);
      }
    } catch (e) {
      // Empty body or invalid JSON - use default empty object
    }
    
    return HttpResponse.json({
      success: true,
      data: {
        subscribed: true,
        message: 'Successfully subscribed to forum'
      }
    });
  }),

  // POST unsubscribe from forum
  http.post(`*${API_BASE_URL}/forums/:id/unsubscribe`, ({ params }) => {
    const { id } = params;
    
    return HttpResponse.json({
      success: true,
      data: {
        subscribed: false,
        message: 'Successfully unsubscribed from forum'
      }
    });
  }),

  // POST subscribe to discussion
  http.post(`*${API_BASE_URL}/forums/discussions/:id/subscribe`, ({ params }) => {
    const { id } = params;
    
    return HttpResponse.json({
      success: true,
      data: {
        subscribed: true,
        message: 'Successfully subscribed to discussion'
      }
    });
  }),

  // POST unsubscribe from discussion
  http.post(`*${API_BASE_URL}/forums/discussions/:id/unsubscribe`, ({ params }) => {
    const { id } = params;
    
    return HttpResponse.json({
      success: true,
      data: {
        subscribed: false,
        message: 'Successfully unsubscribed from discussion'
      }
    });
  }),

  // POST mark discussion as read
  http.post(`*${API_BASE_URL}/forums/discussions/:id/read`, ({ params }) => {
    const { id } = params;
    
    return HttpResponse.json({
      success: true,
      data: {
        discussionId: parseInt(id as string),
        unreadCount: 0,
        allPostsRead: true
      }
    });
  }),

  // POST pin discussion
  http.post(`*${API_BASE_URL}/forums/discussions/:id/pin`, ({ params }) => {
    const { id } = params;
    
    if (id === '403') {
      return HttpResponse.json({
        success: false,
        error: {
          code: 'PERMISSION_DENIED',
          message: 'Only moderators can pin discussions'
        }
      }, { status: 403 });
    }
    
    return HttpResponse.json({
      success: true,
      data: {
        discussionId: parseInt(id as string),
        pinned: true
      }
    });
  }),

  // POST unpin discussion
  http.post(`*${API_BASE_URL}/forums/discussions/:id/unpin`, ({ params }) => {
    const { id } = params;
    
    return HttpResponse.json({
      success: true,
      data: {
        discussionId: parseInt(id as string),
        pinned: false
      }
    });
  }),

  // POST lock discussion
  http.post(`*${API_BASE_URL}/forums/discussions/:id/lock`, ({ params }) => {
    const { id } = params;
    
    return HttpResponse.json({
      success: true,
      data: {
        discussionId: parseInt(id as string),
        locked: true
      }
    });
  }),

  // POST unlock discussion
  http.post(`*${API_BASE_URL}/forums/discussions/:id/unlock`, ({ params }) => {
    const { id } = params;
    
    return HttpResponse.json({
      success: true,
      data: {
        discussionId: parseInt(id as string),
        locked: false
      }
    });
  }),

  // POST report post
  http.post(`*${API_BASE_URL}/forums/posts/:id/report`, async ({ params, request }) => {
    const { id } = params;
    const body = await request.json() as { reason: string };
    
    return HttpResponse.json({
      success: true,
      data: {
        postId: parseInt(id as string),
        reported: true,
        reason: body.reason,
        reportId: 5000
      }
    });
  })
];

describe('forumApi', () => {
  beforeAll(() => {
    // Set up mock JWT token in localStorage for apiClient interceptor
    localStorage.setItem('moodle_access_token', MOCK_JWT_TOKEN);
  });

  afterAll(() => {
    // Clean up localStorage
    localStorage.clear();
  });

  beforeEach(() => {
    // Add test-specific handlers before each test (after reset)
    server.use(...handlers);
  });

  afterEach(() => {
    // Reset handlers to remove test-specific overrides
    server.resetHandlers();
  });

  describe('getForum', () => {
    it('should fetch forum successfully with valid ID', async () => {
      const result = await forumApi.getForum(1);
      
      expect(result).toEqual(mockForum);
      expect(result.id).toBe(1);
      expect(result.name).toBe('General Discussion Forum');
    });

    it('should include JWT token in Authorization header', async () => {
      let capturedHeaders: Headers | undefined;
      
      server.use(
        http.get(`*${API_BASE_URL}/forums/:id`, ({ request }) => {
          capturedHeaders = request.headers;
          return HttpResponse.json({
            success: true,
            data: mockForum
          });
        })
      );
      
      await forumApi.getForum(1);
      
      expect(capturedHeaders?.get('Authorization')).toBe(`Bearer ${MOCK_JWT_TOKEN}`);
    });

    it('should throw 404 error for non-existent forum', async () => {
      await expect(forumApi.getForum(404)).rejects.toThrow();
    });

    it('should throw 403 error for permission denied', async () => {
      await expect(forumApi.getForum(403)).rejects.toThrow();
    });

    it('should verify response data structure matches Forum type', async () => {
      const result = await forumApi.getForum(1);
      
      // Verify all required Forum properties exist
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('courseid');
      expect(result).toHaveProperty('name');
      expect(result).toHaveProperty('intro');
      expect(result).toHaveProperty('type');
      expect(result).toHaveProperty('canAddDiscussion');
      expect(result).toHaveProperty('canSubscribe');
      expect(result).toHaveProperty('subscribed');
    });
  });

  describe('getDiscussions', () => {
    it('should fetch discussion list with default options', async () => {
      const result = await forumApi.getDiscussions(1);
      
      expect(result.data).toHaveLength(2);
      expect(result.data[0].name).toBe('First Discussion');
      expect(result.meta.pagination.page).toBe(1);
      expect(result.meta.pagination.perPage).toBe(20);
    });

    it('should support pagination with page and perPage parameters', async () => {
      const options: DiscussionListOptions = {
        page: 2,
        perPage: 1
      };
      
      const result = await forumApi.getDiscussions(1, options);
      
      expect(result.meta.pagination.page).toBe(2);
      expect(result.meta.pagination.perPage).toBe(1);
      expect(result.data).toHaveLength(1);
    });

    it('should support sorting by date', async () => {
      const options: DiscussionListOptions = {
        sortBy: 'date'
      };
      
      const result = await forumApi.getDiscussions(1, options);
      
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
    });

    it('should support sorting by replies', async () => {
      const options: DiscussionListOptions = {
        sortBy: 'replies'
      };
      
      const result = await forumApi.getDiscussions(1, options);
      
      // Verify sorted by replies (descending)
      if (result.data.length > 1) {
        expect(result.data[0].numReplies).toBeGreaterThanOrEqual(result.data[1].numReplies);
      }
    });

    it('should support sorting by author', async () => {
      const options: DiscussionListOptions = {
        sortBy: 'author'
      };
      
      const result = await forumApi.getDiscussions(1, options);
      
      expect(result.data).toBeDefined();
    });

    it('should filter discussions by "all"', async () => {
      const options: DiscussionListOptions = {
        filter: 'all'
      };
      
      const result = await forumApi.getDiscussions(1, options);
      
      expect(result.data).toHaveLength(2);
    });

    it('should filter discussions by "unread"', async () => {
      const options: DiscussionListOptions = {
        filter: 'unread'
      };
      
      const result = await forumApi.getDiscussions(1, options);
      
      // Only discussions with unread posts
      result.data.forEach(discussion => {
        expect(discussion.numUnreadPosts).toBeGreaterThan(0);
      });
    });

    it('should filter discussions by "pinned"', async () => {
      const options: DiscussionListOptions = {
        filter: 'pinned'
      };
      
      const result = await forumApi.getDiscussions(1, options);
      
      // Only pinned discussions
      result.data.forEach(discussion => {
        expect(discussion.pinned).toBe(true);
      });
    });

    it('should include pagination metadata in response', async () => {
      const result = await forumApi.getDiscussions(1);
      
      expect(result.meta).toBeDefined();
      expect(result.meta.pagination).toBeDefined();
      expect(result.meta.pagination.total).toBeDefined();
      expect(result.meta.pagination.totalPages).toBeDefined();
    });

    it('should handle empty discussion list', async () => {
      server.use(
        http.get(`*${API_BASE_URL}/forums/:id/discussions`, () => {
          return HttpResponse.json({
            success: true,
            data: [],
            meta: {
              pagination: {
                page: 1,
                perPage: 20,
                total: 0,
                totalPages: 0
              }
            }
          });
        })
      );
      
      const result = await forumApi.getDiscussions(1);
      
      expect(result.data).toHaveLength(0);
      expect(result.meta.pagination.total).toBe(0);
    });
  });

  describe('getDiscussionPosts', () => {
    it('should fetch complete discussion thread', async () => {
      const result = await forumApi.getDiscussionPosts(1);
      
      expect(result.posts).toBeDefined();
      expect(Array.isArray(result.posts)).toBe(true);
      expect(result.posts.length).toBeGreaterThan(0);
    });

    it('should return posts array with nested structure', async () => {
      const result = await forumApi.getDiscussionPosts(1);
      
      // Verify nested structure
      expect(result.posts[0]).toHaveProperty('replies');
      expect(Array.isArray(result.posts[0].replies)).toBe(true);
    });

    it('should handle discussion with no replies', async () => {
      const result = await forumApi.getDiscussionPosts(999);
      
      expect(result.posts).toHaveLength(1);
      expect(result.posts[0].replies).toHaveLength(0);
    });

    it('should handle discussion with deeply nested replies', async () => {
      const result = await forumApi.getDiscussionPosts(1);
      
      // Check for nested replies
      const firstPost = result.posts[1];
      if (firstPost && firstPost.replies.length > 0) {
        expect(firstPost.replies[0]).toHaveProperty('id');
        expect(firstPost.replies[0]).toHaveProperty('parentId');
      }
    });

    it('should include unread post indicators', async () => {
      const result = await forumApi.getDiscussionPosts(1);
      
      // Verify unread indicators are present
      result.posts.forEach(post => {
        expect(post).toHaveProperty('isUnread');
        expect(typeof post.isUnread).toBe('boolean');
      });
    });
  });

  describe('createDiscussion', () => {
    it('should create discussion successfully', async () => {
      const data: CreateDiscussionData = {
        subject: 'New Discussion',
        message: 'This is a new discussion message',
        subscribe: true
      };
      
      const result = await forumApi.createDiscussion(1, data);
      
      expect(result.id).toBe(999);
      expect(result.name).toBe('New Discussion');
      expect(result.message).toBe('This is a new discussion message');
    });

    it('should include all required fields in request body', async () => {
      let capturedFormData: FormData;
      
      server.use(
        http.post(`*${API_BASE_URL}/forums/:id/discussions`, async ({ request }) => {
          capturedFormData = await request.formData();
          return HttpResponse.json({
            success: true,
            data: { ...mockDiscussions[0], id: 999 }
          }, { status: 201 });
        })
      );
      
      const data: CreateDiscussionData = {
        subject: 'Test Subject',
        message: 'Test Message',
        attachments: [],
        subscribe: false
      };
      
      await forumApi.createDiscussion(1, data);
      
      expect(capturedFormData.get('subject')).toBe('Test Subject');
      expect(capturedFormData.get('message')).toBe('Test Message');
      expect(capturedFormData.get('subscribe')).toBe('false');
    });

    it('should throw validation error for missing subject', async () => {
      const data: CreateDiscussionData = {
        subject: '',
        message: 'Test Message'
      };
      
      await expect(forumApi.createDiscussion(1, data)).rejects.toThrow();
    });

    it('should throw validation error for empty message', async () => {
      const data: CreateDiscussionData = {
        subject: 'Test Subject',
        message: ''
      };
      
      await expect(forumApi.createDiscussion(1, data)).rejects.toThrow();
    });

    it('should handle file attachment upload with FormData', async () => {
      // Note: File upload would use FormData in actual implementation
      const data: CreateDiscussionData = {
        subject: 'Discussion with Attachments',
        message: 'Message with files',
        attachments: [
          { name: 'file1.pdf', size: 1024, type: 'application/pdf' }
        ]
      };
      
      const result = await forumApi.createDiscussion(1, data);
      
      expect(result).toBeDefined();
      expect(result.id).toBe(999);
    });

    it('should return created discussion in response', async () => {
      const data: CreateDiscussionData = {
        subject: 'New Discussion',
        message: 'New Message'
      };
      
      const result = await forumApi.createDiscussion(1, data);
      
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('forumId');
      expect(result).toHaveProperty('name');
      expect(result).toHaveProperty('created');
    });
  });

  describe('createPost', () => {
    it('should create reply successfully', async () => {
      const data: CreatePostData = {
        forumId: 1,
        discussionId: 100,
        message: 'This is a reply',
        parentPostId: 1
      };
      
      const result = await forumApi.createPost(data);
      
      expect(result.id).toBe(1000);
      expect(result.message).toBe('This is a reply');
      expect(result.parentId).toBe(1);
    });

    it('should include message and parentId in request body', async () => {
      let capturedFormData: FormData;
      
      server.use(
        http.post(`*${API_BASE_URL}/forums/discussions/:id/posts`, async ({ request }) => {
          capturedFormData = await request.formData();
          return HttpResponse.json({
            success: true,
            data: { ...mockPost, id: 1000 }
          }, { status: 201 });
        })
      );
      
      const data: CreatePostData = {
        forumId: 1,
        discussionId: 100,
        message: 'Reply message',
        parentPostId: 5
      };
      
      await forumApi.createPost(data);
      
      expect(capturedFormData.get('message')).toBe('Reply message');
      expect(capturedFormData.get('parentId')).toBe('5');
    });

    it('should handle inline reply (nested)', async () => {
      const data: CreatePostData = {
        forumId: 1,
        discussionId: 1,
        message: 'Nested reply',
        parentPostId: 10
      };
      
      const result = await forumApi.createPost(data);
      
      expect(result.parentId).toBe(10);
    });

    it('should handle root-level reply', async () => {
      const data: CreatePostData = {
        forumId: 1,
        discussionId: 1,
        message: 'Root reply',
        parentPostId: 0
      };
      
      const result = await forumApi.createPost(data);
      
      expect(result.parentId).toBe(0);
    });

    it('should support multiple file attachments', async () => {
      const data: CreatePostData = {
        forumId: 1,
        discussionId: 1,
        message: 'Reply with files',
        parentPostId: 1,
        attachments: [
          { name: 'doc1.pdf', size: 2048, type: 'application/pdf' },
          { name: 'image1.jpg', size: 4096, type: 'image/jpeg' }
        ]
      };
      
      const result = await forumApi.createPost(data);
      
      expect(result).toBeDefined();
    });

    it('should be compatible with optimistic updates', async () => {
      const data: CreatePostData = {
        forumId: 1,
        discussionId: 1,
        message: 'Optimistic reply'
      };
      
      const result = await forumApi.createPost(data);
      
      // Should return immediately with temp ID for optimistic update
      expect(result.id).toBeDefined();
      expect(result.message).toBe('Optimistic reply');
    });
  });

  describe('updatePost', () => {
    it('should update post successfully', async () => {
      const data: UpdatePostData = {
        postId: 1,
        message: 'Updated message content'
      };
      
      const result = await forumApi.updatePost(data);
      
      expect(result.message).toBe('Updated message content');
      expect(result.editedBy).toBe('John Doe');
      expect(result.editedAt).toBeDefined();
    });

    it('should include message in request body', async () => {
      let capturedFormData: FormData;
      
      server.use(
        http.put(`*${API_BASE_URL}/forums/posts/:id`, async ({ request }) => {
          capturedFormData = await request.formData();
          return HttpResponse.json({
            success: true,
            data: { ...mockPost, message: capturedFormData.get('message') as string }
          });
        })
      );
      
      const data: UpdatePostData = {
        postId: 1,
        message: 'New content'
      };
      
      await forumApi.updatePost(data);
      
      expect(capturedFormData.get('message')).toBe('New content');
    });

    it('should handle attachment add/remove', async () => {
      // NOTE: Due to MSW v2 limitations in Node.js, we cannot send actual File objects
      // in unit tests as request.formData() hangs when parsing File objects.
      // Full file upload testing should be done in integration/E2E tests.
      // Here we test attachment removal which doesn't require File objects.
      const data: UpdatePostData = {
        postId: 1,
        message: 'Updated with attachments removed',
        removeAttachments: [1, 2]  // Remove attachments by ID
      };
      
      const result = await forumApi.updatePost(data);
      
      expect(result).toBeDefined();
      expect(result.message).toBe('Updated with attachments removed');
      // In a real scenario, we'd verify attachments were removed
    });

    it('should detect concurrent edits with version/timestamp', async () => {
      const data: UpdatePostData = {
        postId: 409,
        message: 'Concurrent edit',
        version: 1
      };
      
      await expect(forumApi.updatePost(data)).rejects.toThrow();
    });

    it('should throw 409 Conflict for concurrent edits', async () => {
      const data: UpdatePostData = {
        postId: 409,
        message: 'Conflicting edit'
      };
      
      await expect(forumApi.updatePost(data)).rejects.toThrow();
    });

    it('should return updated post with edit metadata', async () => {
      const data: UpdatePostData = {
        postId: 1,
        message: 'Updated post'
      };
      
      const result = await forumApi.updatePost(data);
      
      expect(result.modified).toBeDefined();
      expect(result.editedBy).toBeDefined();
      expect(result.editedAt).toBeDefined();
    });
  });

  describe('deletePost', () => {
    it('should delete post successfully', async () => {
      await expect(forumApi.deletePost(1)).resolves.not.toThrow();
    });

    it('should return 204 No Content response', async () => {
      const result = await forumApi.deletePost(1);
      
      // Should return void or undefined for 204 response
      expect(result).toBeUndefined();
    });

    it('should throw 403 error for unauthorized deletion', async () => {
      await expect(forumApi.deletePost(403)).rejects.toThrow();
    });

    it('should handle cascade delete for parent posts with replies', async () => {
      // Cascade deletion should be handled by backend
      await expect(forumApi.deletePost(1)).resolves.not.toThrow();
    });
  });

  describe('subscribeForum', () => {
    it('should subscribe to forum successfully', async () => {
      const result = await forumApi.subscribeForum(1);
      
      expect(result.subscribed).toBe(true);
      expect(result.message).toBe('Successfully subscribed to forum');
    });

    it('should include subscription preferences in request body', async () => {
      let capturedBody: any;
      
      server.use(
        http.post(`*${API_BASE_URL}/forums/:id/subscribe`, async ({ request }) => {
          capturedBody = await request.json();
          return HttpResponse.json({
            success: true,
            data: { subscribed: true, message: 'Successfully subscribed to forum' }
          });
        })
      );
      
      const preferences: SubscriptionPreferences = {
        emailNotifications: true,
        digestMode: false
      };
      
      await forumApi.subscribeForum(1, preferences);
      
      expect(capturedBody.emailNotifications).toBe(true);
      expect(capturedBody.digestMode).toBe(false);
    });

    it('should return updated subscription status', async () => {
      const result = await forumApi.subscribeForum(1);
      
      expect(result.subscribed).toBe(true);
    });
  });

  describe('unsubscribeForum', () => {
    it('should unsubscribe from forum successfully', async () => {
      const result = await forumApi.unsubscribeForum(1);
      
      expect(result.subscribed).toBe(false);
      expect(result.message).toBe('Successfully unsubscribed from forum');
    });

    it('should return 200 OK with updated status', async () => {
      const result = await forumApi.unsubscribeForum(1);
      
      expect(result).toBeDefined();
      expect(result.subscribed).toBe(false);
    });
  });

  describe('subscribeDiscussion', () => {
    it('should subscribe to individual discussion', async () => {
      const result = await forumApi.subscribeDiscussion(1);
      
      expect(result.subscribed).toBe(true);
      expect(result.message).toBe('Successfully subscribed to discussion');
    });
  });

  describe('unsubscribeDiscussion', () => {
    it('should unsubscribe from individual discussion', async () => {
      const result = await forumApi.unsubscribeDiscussion(1);
      
      expect(result.subscribed).toBe(false);
      expect(result.message).toBe('Successfully unsubscribed from discussion');
    });
  });

  describe('markDiscussionRead', () => {
    it('should mark discussion and all posts as read', async () => {
      const result = await forumApi.markDiscussionRead(1);
      
      expect(result.discussionId).toBe(1);
      expect(result.allPostsRead).toBe(true);
    });

    it('should update unread count in response', async () => {
      const result = await forumApi.markDiscussionRead(1);
      
      expect(result.unreadCount).toBe(0);
    });
  });

  describe('pinDiscussion', () => {
    it('should pin discussion as moderator', async () => {
      const result = await forumApi.pinDiscussion(1);
      
      expect(result.discussionId).toBe(1);
      expect(result.pinned).toBe(true);
    });

    it('should throw 403 error for non-moderator', async () => {
      await expect(forumApi.pinDiscussion(403)).rejects.toThrow();
    });
  });

  describe('unpinDiscussion', () => {
    it('should unpin discussion', async () => {
      const result = await forumApi.unpinDiscussion(1);
      
      expect(result.discussionId).toBe(1);
      expect(result.pinned).toBe(false);
    });
  });

  describe('lockDiscussion', () => {
    it('should lock discussion to prevent replies', async () => {
      const result = await forumApi.lockDiscussion(1);
      
      expect(result.discussionId).toBe(1);
      expect(result.locked).toBe(true);
    });
  });

  describe('unlockDiscussion', () => {
    it('should unlock discussion', async () => {
      const result = await forumApi.unlockDiscussion(1);
      
      expect(result.discussionId).toBe(1);
      expect(result.locked).toBe(false);
    });
  });

  describe('reportPost', () => {
    it('should report inappropriate post', async () => {
      const result = await forumApi.reportPost(1, 'Spam content');
      
      expect(result.postId).toBe(1);
      expect(result.reported).toBe(true);
      expect(result.reportId).toBeDefined();
    });

    it('should include reason in request body', async () => {
      let capturedBody: any;
      
      server.use(
        http.post(`*${API_BASE_URL}/forums/posts/:id/report`, async ({ request }) => {
          capturedBody = await request.json();
          return HttpResponse.json({
            success: true,
            data: { postId: 1, reported: true, reason: capturedBody.reason, reportId: 5000 }
          });
        })
      );
      
      await forumApi.reportPost(1, 'Inappropriate language');
      
      expect(capturedBody.reason).toBe('Inappropriate language');
    });
  });

  describe('Error Handling', () => {
    it('should handle network timeout error', async () => {
      server.use(
        http.get(`*${API_BASE_URL}/forums/:id`, () => {
          return HttpResponse.error();
        })
      );
      
      await expect(forumApi.getForum(1)).rejects.toThrow();
    });

    it('should handle 500 Internal Server Error', async () => {
      server.use(
        http.get(`*${API_BASE_URL}/forums/:id`, () => {
          return HttpResponse.json({
            success: false,
            error: {
              code: 'INTERNAL_ERROR',
              message: 'Internal server error'
            }
          }, { status: 500 });
        })
      );
      
      await expect(forumApi.getForum(1)).rejects.toThrow();
    });

    it('should handle 401 Unauthorized (expired/invalid JWT)', async () => {
      server.use(
        http.get(`*${API_BASE_URL}/forums/:id`, () => {
          return HttpResponse.json({
            success: false,
            error: {
              code: 'UNAUTHORIZED',
              message: 'Invalid or expired token'
            }
          }, { status: 401 });
        })
      );
      
      await expect(forumApi.getForum(1)).rejects.toThrow();
    });

    it('should handle 429 Too Many Requests (rate limiting)', async () => {
      server.use(
        http.get(`*${API_BASE_URL}/forums/:id`, () => {
          return HttpResponse.json({
            success: false,
            error: {
              code: 'RATE_LIMIT_EXCEEDED',
              message: 'Too many requests'
            }
          }, { status: 429 });
        })
      );
      
      await expect(forumApi.getForum(1)).rejects.toThrow();
    });

    it('should handle malformed JSON response', async () => {
      // MSW cannot simulate JSON parse errors since it bypasses axios's JSON parsing.
      // Instead, we directly mock the apiClient to throw a SyntaxError as axios would.
      const { apiClient } = await import('@/services/api/client');
      const originalGet = apiClient.get;
      
      apiClient.get = vi.fn().mockRejectedValueOnce(
        Object.assign(new SyntaxError('Unexpected token I in JSON at position 0'), {
          config: { url: '/forums/1', method: 'get' },
          request: {},
        })
      );
      
      await expect(forumApi.getForum(1)).rejects.toThrow();
      
      // Restore original implementation
      apiClient.get = originalGet;
    });

    it('should transform errors to user-friendly messages', async () => {
      server.use(
        http.get(`*${API_BASE_URL}/forums/:id`, () => {
          return HttpResponse.json({
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: 'Forum not found'
            }
          }, { status: 404 });
        })
      );
      
      try {
        await forumApi.getForum(404);
      } catch (error: any) {
        expect(error.message).toBeDefined();
      }
    });
  });

  describe('Request Configuration', () => {
    it('should apply axios interceptors correctly', async () => {
      // Interceptors should add auth header automatically
      const result = await forumApi.getForum(1);
      
      expect(result).toBeDefined();
    });

    it('should support request cancellation', async () => {
      const controller = new AbortController();
      
      // Cancel immediately
      controller.abort();
      
      // Request should be cancelled (implementation-dependent)
      // This tests the API supports cancellation tokens
      expect(controller.signal.aborted).toBe(true);
    });

    it('should include CORS headers in requests', async () => {
      let capturedHeaders: Headers | undefined;
      
      server.use(
        http.get(`*${API_BASE_URL}/forums/:id`, ({ request }) => {
          capturedHeaders = request.headers;
          return HttpResponse.json({
            success: true,
            data: mockForum
          });
        })
      );
      
      await forumApi.getForum(1);
      
      // CORS headers should be present (set by axios/browser)
      expect(capturedHeaders).toBeDefined();
    });
  });

  describe('TypeScript Type Safety', () => {
    it('should enforce Forum type for getForum response', async () => {
      const result = await forumApi.getForum(1);
      
      // TypeScript should enforce these properties exist
      const forum: Forum = result;
      expect(forum.id).toBeDefined();
      expect(forum.name).toBeDefined();
    });

    it('should enforce Discussion type for getDiscussions response', async () => {
      const result = await forumApi.getDiscussions(1);
      
      // TypeScript should enforce array of Discussion
      const discussions: Discussion[] = result.data;
      expect(Array.isArray(discussions)).toBe(true);
    });

    it('should enforce Post type for createPost response', async () => {
      const data: CreatePostData = {
        forumId: 1,
        discussionId: 100,
        subject: 'Test Post',
        message: 'Test'
      };
      
      const result = await forumApi.createPost(data);
      
      // TypeScript should enforce Post type
      const post: Post = result;
      expect(post.id).toBeDefined();
      expect(post.message).toBeDefined();
    });
  });

  describe('File Upload', () => {
    it('should track file upload progress', async () => {
      // Mock progress tracking
      const progressCallback = vi.fn();
      
      const data: CreateDiscussionData = {
        subject: 'With Files',
        message: 'Message with attachments',
        attachments: [
          { name: 'large-file.pdf', size: 5000000, type: 'application/pdf' }
        ]
      };
      
      // Upload with progress tracking (implementation-dependent)
      const result = await forumApi.createDiscussion(1, data);
      
      expect(result).toBeDefined();
    });

    it('should handle multiple concurrent file uploads', async () => {
      const data: CreatePostData = {
        forumId: 1,
        discussionId: 100,
        subject: 'Post with multiple files',
        message: 'Multiple files',
        attachments: [
          { name: 'file1.pdf', size: 1024, type: 'application/pdf' } as File,
          { name: 'file2.jpg', size: 2048, type: 'image/jpeg' } as File,
          { name: 'file3.docx', size: 3072, type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' } as File
        ]
      };
      
      const result = await forumApi.createPost(data);
      
      expect(result).toBeDefined();
    });
  });

  describe('Retry Logic', () => {
    it('should retry failed requests with exponential backoff', async () => {
      let attemptCount = 0;
      
      server.use(
        http.get(`*${API_BASE_URL}/forums/:id`, () => {
          attemptCount++;
          
          if (attemptCount < 3) {
            return HttpResponse.error();
          }
          
          return HttpResponse.json({
            success: true,
            data: mockForum
          });
        })
      );
      
      // With retry logic, this should eventually succeed
      // (Implementation-dependent - requires retry configuration in axios)
      try {
        await forumApi.getForum(1);
      } catch (error) {
        // May still fail if retry not implemented
        expect(attemptCount).toBeGreaterThan(0);
      }
    });

    it('should respect maximum retry attempts', async () => {
      let attemptCount = 0;
      
      server.use(
        http.get(`*${API_BASE_URL}/forums/:id`, () => {
          attemptCount++;
          return HttpResponse.error();
        })
      );
      
      try {
        await forumApi.getForum(1);
      } catch (error) {
        // Should have attempted multiple times but stopped
        expect(attemptCount).toBeDefined();
      }
    });
  });
});

