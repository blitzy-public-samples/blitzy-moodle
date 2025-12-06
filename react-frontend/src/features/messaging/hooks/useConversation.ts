/**
 * Custom React Hooks for Conversation Management
 *
 * This module provides React Query-based hooks for managing conversation threads
 * in the Moodle messaging system. It wraps the messagingApi functions with
 * React Query for caching, optimistic updates, and automatic refetching.
 *
 * Features:
 * - Fetch conversation details with automatic caching
 * - Fetch and paginate messages within conversations
 * - Send messages with optimistic updates
 * - Mark messages as read with cache invalidation
 * - Real-time polling support for live updates
 *
 * @module features/messaging/hooks/useConversation
 * @see public/message/lib.php - Moodle message_get_messages(), message_send(), message_mark_read()
 * @see public/message/externallib.php - Moodle external message API
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  useInfiniteQuery,
  type UseQueryOptions,
  type InfiniteData,
  type QueryKey,
} from '@tanstack/react-query';

import {
  getConversationMessages,
  sendMessage,
  markMessageAsRead,
  markConversationAsRead,
  getConversations,
  messagingKeys,
} from '../api/messagingApi';

import type {
  Conversation,
  Message,
  ConversationMember,
  SendMessageParams,
} from '../types/message.types';

// ============================================================================
// Type Definitions
// ============================================================================

// ConversationMessagesOptions moved to UseConversationMessagesOptions interface below

/**
 * Response type for conversation messages query
 */
interface ConversationMessagesResponse {
  /** Array of messages in the conversation */
  messages: Message[];
  /** Array of conversation members with profile info */
  members: ConversationMember[];
}

/**
 * Response type for paginated messages (infinite query)
 */
interface PaginatedMessagesResponse {
  /** Array of messages for this page */
  messages: Message[];
  /** Array of conversation members */
  members: ConversationMember[];
  /** Next page number (undefined if no more pages) */
  nextPage?: number;
  /** Whether there are more messages to load */
  hasMore: boolean;
}

/**
 * Variables for send message mutation
 */
interface SendMessageVariables {
  /** Conversation ID to send the message to */
  conversationId: number;
  /** Message text content (max 4096 characters) */
  text: string;
  /** Optional user ID of sender (uses current user if not provided) */
  useridfrom?: number;
}

/**
 * Variables for mark message read mutation
 */
interface MarkMessageReadVariables {
  /** ID of the message to mark as read */
  messageId: number;
  /** Conversation ID for cache invalidation */
  conversationId?: number;
}

// SendMessageResult type removed - mutation returns Message directly

// ============================================================================
// Query Key Constants
// ============================================================================

/**
 * Default stale time for conversation data (5 minutes)
 * Conversations don't change frequently, so we can cache longer
 */
const CONVERSATION_STALE_TIME = 5 * 60 * 1000;

/**
 * Default stale time for message data (30 seconds)
 * Messages can arrive frequently, so shorter stale time
 */
const MESSAGE_STALE_TIME = 30 * 1000;

/**
 * Default cache time for conversation data (10 minutes)
 */
const CONVERSATION_CACHE_TIME = 10 * 60 * 1000;

/**
 * Default polling interval for real-time updates (30 seconds)
 */
const DEFAULT_POLLING_INTERVAL = 30 * 1000;

// ============================================================================
// useConversation Hook
// ============================================================================

/**
 * Options for useConversation hook
 */
interface UseConversationOptions
  extends Omit<
    UseQueryOptions<Conversation | null, Error, Conversation | null, QueryKey>,
    'queryKey' | 'queryFn'
  > {
  /** Whether to enable the query */
  enabled?: boolean;
  /** Whether to include message details */
  includeMessages?: boolean;
  /** Whether to enable polling for updates */
  enablePolling?: boolean;
  /** Polling interval in milliseconds */
  pollingInterval?: number;
}

/**
 * Hook for fetching a single conversation by ID
 *
 * Fetches conversation details including members and unread status.
 * Uses React Query for caching and automatic background refetching.
 *
 * @param conversationId - The ID of the conversation to fetch
 * @param options - Additional React Query options
 * @returns Query result containing conversation data, loading state, and error
 *
 * @example
 * ```typescript
 * function ConversationHeader({ conversationId }: { conversationId: number }) {
 *   const { data: conversation, isLoading, error } = useConversation(conversationId);
 *
 *   if (isLoading) return <CircularProgress />;
 *   if (error) return <Alert severity="error">{error.message}</Alert>;
 *   if (!conversation) return <Alert severity="info">Conversation not found</Alert>;
 *
 *   return (
 *     <Box>
 *       <Typography variant="h6">{conversation.name || 'Direct Message'}</Typography>
 *       <Typography variant="caption">{conversation.membercount} members</Typography>
 *     </Box>
 *   );
 * }
 * ```
 */
export function useConversation(
  conversationId: number | undefined,
  options: UseConversationOptions = {}
): ReturnType<typeof useQuery<Conversation | null, Error, Conversation | null, QueryKey>> {
  const {
    enabled = true,
    includeMessages = false,
    enablePolling = false,
    pollingInterval = DEFAULT_POLLING_INTERVAL,
    ...queryOptions
  } = options;

  return useQuery<Conversation | null, Error, Conversation | null, QueryKey>({
    queryKey: messagingKeys.conversation(conversationId ?? 0),
    queryFn: async (): Promise<Conversation | null> => {
      if (!conversationId || conversationId <= 0) {
        return null;
      }

      // Fetch conversations list and find the matching one
      // This is a workaround since there's no direct single conversation API endpoint
      // The API pattern suggests this might be added in the future
      try {
        const response = await getConversations(
          { pagination: { page: 1, perPage: 100 } },
          { mergeself: true }
        );

        const conversation = response.conversations.find(
          (conv) => conv.id === conversationId
        );

        if (!conversation) {
          // If not found in first page, try fetching conversation messages
          // to confirm the conversation exists
          const messagesResponse = await getConversationMessages(
            conversationId,
            { pagination: { page: 1, perPage: 1 } }
          );

          // Construct a minimal conversation object from the members
          if (messagesResponse.members.length > 0) {
            return {
              id: conversationId,
              type: messagesResponse.members.length > 2 ? 2 : 1, // GROUP or INDIVIDUAL
              name: null,
              subname: null,
              imageurl: null,
              membercount: messagesResponse.members.length,
              isfavourite: false,
              isread: true,
              unreadcount: 0,
              ismuted: false,
              enabled: 1,
              timecreated: Date.now() / 1000,
              timemodified: null,
              members: messagesResponse.members,
              messages: messagesResponse.messages,
              candeletemessagesforallusers: false,
            } as Conversation;
          }

          return null;
        }

        // Optionally fetch messages if requested
        if (includeMessages && conversation) {
          const messagesResponse = await getConversationMessages(
            conversationId,
            { pagination: { page: 1, perPage: 50 } },
            { newest: true }
          );
          return {
            ...conversation,
            messages: messagesResponse.messages,
            members: messagesResponse.members,
          };
        }

        return conversation;
      } catch (error) {
        if (error instanceof Error) {
          throw error;
        }
        throw new Error('Failed to fetch conversation');
      }
    },
    enabled: enabled && conversationId !== undefined && conversationId > 0,
    staleTime: CONVERSATION_STALE_TIME,
    gcTime: CONVERSATION_CACHE_TIME,
    refetchInterval: enablePolling ? pollingInterval : false,
    refetchIntervalInBackground: false,
    retry: (failureCount, error) => {
      // Don't retry on 404 or permission errors
      if (error.message.includes('not found') || error.message.includes('permission')) {
        return false;
      }
      return failureCount < 3;
    },
    ...queryOptions,
  });
}

// ============================================================================
// useConversationMessages Hook
// ============================================================================

/**
 * Options for useConversationMessages hook
 */
interface UseConversationMessagesOptions
  extends Omit<
    UseQueryOptions<ConversationMessagesResponse, Error, ConversationMessagesResponse, QueryKey>,
    'queryKey' | 'queryFn'
  > {
  /** Whether to fetch newest messages first (default: true) */
  newest?: boolean;
  /** Unix timestamp to fetch messages from */
  timefrom?: number;
  /** Number of messages to fetch (default: 50) */
  limit?: number;
  /** Whether to enable polling for new messages */
  enablePolling?: boolean;
  /** Polling interval in milliseconds (default: 30000) */
  pollingInterval?: number;
}

/**
 * Hook for fetching messages within a conversation
 *
 * Fetches messages with member information, supporting pagination and
 * real-time polling for live message updates.
 *
 * @param conversationId - The ID of the conversation to fetch messages from
 * @param options - Fetch options including pagination and polling settings
 * @returns Query result with messages, members, loading state, and error
 *
 * @example
 * ```typescript
 * function MessageList({ conversationId }: { conversationId: number }) {
 *   const {
 *     data,
 *     isLoading,
 *     error,
 *     refetch
 *   } = useConversationMessages(conversationId, {
 *     newest: true,
 *     limit: 50,
 *     enablePolling: true,
 *     pollingInterval: 30000
 *   });
 *
 *   if (isLoading) return <CircularProgress />;
 *   if (error) return <Alert severity="error">{error.message}</Alert>;
 *
 *   const { messages, members } = data ?? { messages: [], members: [] };
 *
 *   return (
 *     <Box>
 *       {messages.map(message => (
 *         <MessageItem
 *           key={message.id}
 *           message={message}
 *           sender={members.find(m => m.id === message.useridfrom)}
 *         />
 *       ))}
 *     </Box>
 *   );
 * }
 * ```
 */
export function useConversationMessages(
  conversationId: number | undefined,
  options: UseConversationMessagesOptions = {}
): ReturnType<typeof useQuery<ConversationMessagesResponse, Error, ConversationMessagesResponse, QueryKey>> {
  const {
    newest = true,
    timefrom,
    limit = 50,
    enablePolling = false,
    pollingInterval = DEFAULT_POLLING_INTERVAL,
    enabled = true,
    ...queryOptions
  } = options;

  return useQuery<ConversationMessagesResponse, Error, ConversationMessagesResponse, QueryKey>({
    queryKey: [
      ...messagingKeys.conversationMessages(conversationId ?? 0),
      { newest, timefrom, limit },
    ],
    queryFn: async (): Promise<ConversationMessagesResponse> => {
      if (!conversationId || conversationId <= 0) {
        return { messages: [], members: [] };
      }

      try {
        const response = await getConversationMessages(
          conversationId,
          { pagination: { page: 1, perPage: limit } },
          { newest, timefrom }
        );

        return {
          messages: response.messages,
          members: response.members,
        };
      } catch (error) {
        if (error instanceof Error) {
          throw error;
        }
        throw new Error('Failed to fetch conversation messages');
      }
    },
    enabled: enabled && conversationId !== undefined && conversationId > 0,
    staleTime: MESSAGE_STALE_TIME,
    gcTime: CONVERSATION_CACHE_TIME,
    refetchInterval: enablePolling ? pollingInterval : false,
    refetchIntervalInBackground: false,
    ...queryOptions,
  });
}

// ============================================================================
// useInfiniteConversationMessages Hook
// ============================================================================

/**
 * Options for useInfiniteConversationMessages hook
 */
interface UseInfiniteConversationMessagesOptions {
  /** Number of messages per page (default: 50) */
  pageSize?: number;
  /** Whether to fetch newest messages first (default: true) */
  newest?: boolean;
  /** Whether the query is enabled */
  enabled?: boolean;
}

/**
 * Hook for fetching messages with infinite scroll pagination
 *
 * Provides infinite scroll support for loading older messages
 * as the user scrolls up in the conversation.
 *
 * @param conversationId - The ID of the conversation
 * @param options - Pagination options
 * @returns Infinite query result with pages of messages
 *
 * @example
 * ```typescript
 * function InfiniteMessageList({ conversationId }: { conversationId: number }) {
 *   const {
 *     data,
 *     fetchNextPage,
 *     hasNextPage,
 *     isFetchingNextPage,
 *     isLoading
 *   } = useInfiniteConversationMessages(conversationId, { pageSize: 30 });
 *
 *   const messages = data?.pages.flatMap(page => page.messages) ?? [];
 *   const members = data?.pages[0]?.members ?? [];
 *
 *   return (
 *     <Box ref={scrollRef} onScroll={handleScroll}>
 *       {hasNextPage && (
 *         <Button onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
 *           Load older messages
 *         </Button>
 *       )}
 *       {messages.map(message => (
 *         <MessageItem key={message.id} message={message} />
 *       ))}
 *     </Box>
 *   );
 * }
 * ```
 */
export function useInfiniteConversationMessages(
  conversationId: number | undefined,
  options: UseInfiniteConversationMessagesOptions = {}
) {
  const { pageSize = 50, newest = true, enabled = true } = options;

  return useInfiniteQuery<
    PaginatedMessagesResponse,
    Error,
    InfiniteData<PaginatedMessagesResponse>,
    QueryKey,
    number
  >({
    queryKey: [...messagingKeys.conversationMessages(conversationId ?? 0), 'infinite'],
    queryFn: async ({ pageParam }): Promise<PaginatedMessagesResponse> => {
      if (!conversationId || conversationId <= 0) {
        return { messages: [], members: [], hasMore: false };
      }

      try {
        const response = await getConversationMessages(
          conversationId,
          { pagination: { page: pageParam, perPage: pageSize } },
          { newest }
        );

        const hasMore = response.messages.length === pageSize;

        return {
          messages: response.messages,
          members: response.members,
          nextPage: hasMore ? pageParam + 1 : undefined,
          hasMore,
        };
      } catch (error) {
        if (error instanceof Error) {
          throw error;
        }
        throw new Error('Failed to fetch conversation messages');
      }
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.nextPage,
    enabled: enabled && conversationId !== undefined && conversationId > 0,
    staleTime: MESSAGE_STALE_TIME,
    gcTime: CONVERSATION_CACHE_TIME,
  });
}

// ============================================================================
// useSendMessage Hook
// ============================================================================

/**
 * Options for useSendMessage hook
 */
interface UseSendMessageOptions {
  /** Whether to use optimistic updates (default: true) */
  optimistic?: boolean;
  /** Current user ID for optimistic update message creation */
  currentUserId?: number;
  /** Called before the mutation function fires */
  onMutate?: (variables: SendMessageVariables) => void | Promise<void>;
  /** Called when the mutation encounters an error */
  onError?: (error: Error, variables: SendMessageVariables, context: { previousMessages?: Message[] } | undefined) => void;
  /** Called when the mutation is successful */
  onSuccess?: (data: Message, variables: SendMessageVariables, context: { previousMessages?: Message[] }) => void;
  /** Called when the mutation is either successful or errors */
  onSettled?: (data: Message | undefined, error: Error | null, variables: SendMessageVariables, context: { previousMessages?: Message[] } | undefined) => void;
}

/**
 * Hook for sending messages to a conversation
 *
 * Provides optimistic updates for instant UI feedback and automatic
 * cache invalidation on success or rollback on error.
 *
 * @param options - Mutation options including optimistic update settings
 * @returns Mutation result with send function, loading state, and error
 *
 * @example
 * ```typescript
 * function MessageComposer({ conversationId }: { conversationId: number }) {
 *   const [text, setText] = useState('');
 *   const { mutate: sendMessage, isPending, error } = useSendMessage({
 *     optimistic: true,
 *     currentUserId: 123,
 *     onSuccess: () => setText(''),
 *     onError: (error) => showToast(`Failed to send: ${error.message}`)
 *   });
 *
 *   const handleSend = () => {
 *     if (!text.trim()) return;
 *     sendMessage({
 *       conversationId,
 *       text: text.trim(),
 *       useridfrom: 123
 *     });
 *   };
 *
 *   return (
 *     <Box display="flex" gap={1}>
 *       <TextField
 *         value={text}
 *         onChange={(e) => setText(e.target.value)}
 *         disabled={isPending}
 *         placeholder="Type a message..."
 *       />
 *       <Button onClick={handleSend} disabled={isPending || !text.trim()}>
 *         Send
 *       </Button>
 *       {error && <Alert severity="error">{error.message}</Alert>}
 *     </Box>
 *   );
 * }
 * ```
 */
export function useSendMessage(options: UseSendMessageOptions = {}) {
  const queryClient = useQueryClient();
  const { optimistic = true, currentUserId, onMutate, onError, onSuccess, onSettled } = options;

  return useMutation<Message, Error, SendMessageVariables, { previousMessages?: Message[] }>({
    mutationFn: async (variables: SendMessageVariables): Promise<Message> => {
      // Validate input
      if (!variables.conversationId || variables.conversationId <= 0) {
        throw new Error('Invalid conversation ID');
      }

      if (!variables.text || variables.text.trim().length === 0) {
        throw new Error('Message text cannot be empty');
      }

      if (variables.text.length > 4096) {
        throw new Error('Message text exceeds maximum length of 4096 characters');
      }

      // Prepare send message params
      const params: SendMessageParams = {
        conversationid: variables.conversationId,
        text: variables.text.trim(),
        useridfrom: variables.useridfrom ?? currentUserId ?? 0,
      };

      try {
        const message = await sendMessage(params);
        return message;
      } catch (error) {
        if (error instanceof Error) {
          throw error;
        }
        throw new Error('Failed to send message');
      }
    },

    onMutate: async (variables) => {
      // Call user's onMutate handler first
      await onMutate?.(variables);

      if (!optimistic) {
        return {};
      }

      // Cancel any outgoing refetches
      await queryClient.cancelQueries({
        queryKey: messagingKeys.conversationMessages(variables.conversationId),
      });

      // Snapshot the previous value
      const previousMessages = queryClient.getQueryData<ConversationMessagesResponse>(
        messagingKeys.conversationMessages(variables.conversationId)
      )?.messages;

      // Create optimistic message
      const optimisticMessage: Message = {
        id: -Date.now(), // Temporary negative ID
        useridfrom: variables.useridfrom ?? currentUserId ?? 0,
        conversationid: variables.conversationId,
        subject: null,
        fullmessage: variables.text,
        fullmessageformat: 1, // FORMAT_HTML
        fullmessagehtml: variables.text,
        smallmessage: variables.text.substring(0, 300),
        timecreated: Math.floor(Date.now() / 1000),
        fullmessagetrust: 0,
        customdata: null,
      };

      // Optimistically update the cache
      queryClient.setQueryData<ConversationMessagesResponse>(
        messagingKeys.conversationMessages(variables.conversationId),
        (old) => {
          if (!old) {
            return { messages: [optimisticMessage], members: [] };
          }
          return {
            ...old,
            messages: [optimisticMessage, ...old.messages],
          };
        }
      );

      // Return context for rollback
      return { previousMessages };
    },

    onError: (error, variables, context) => {
      // Call user's onError handler
      onError?.(error, variables, context);

      // Rollback optimistic update on error
      if (optimistic && context?.previousMessages) {
        queryClient.setQueryData<ConversationMessagesResponse>(
          messagingKeys.conversationMessages(variables.conversationId),
          (old) => {
            if (!old) return old;
            return {
              ...old,
              messages: context.previousMessages ?? [],
            };
          }
        );
      }
    },

    onSettled: (data, error, variables, context) => {
      // Call user's onSettled handler
      onSettled?.(data, error, variables, context);

      // Always refetch to ensure consistency
      queryClient.invalidateQueries({
        queryKey: messagingKeys.conversationMessages(variables.conversationId),
      });

      // Also invalidate conversation list to update last message
      queryClient.invalidateQueries({
        queryKey: messagingKeys.conversations(),
      });

      // Invalidate the specific conversation
      queryClient.invalidateQueries({
        queryKey: messagingKeys.conversation(variables.conversationId),
      });
    },

    onSuccess: (data, variables, context) => {
      // Call user's onSuccess handler
      onSuccess?.(data, variables, context);
    },
  });
}

// ============================================================================
// useMarkMessageRead Hook
// ============================================================================

/**
 * Options for useMarkMessageRead hook
 */
interface UseMarkMessageReadOptions {
  /** Whether to use optimistic updates (default: true) */
  optimistic?: boolean;
  /** Called before the mutation function fires */
  onMutate?: (variables: MarkMessageReadVariables) => void | Promise<void>;
  /** Called when the mutation encounters an error */
  onError?: (error: Error, variables: MarkMessageReadVariables, context: { previousConversation?: Conversation } | undefined) => void;
  /** Called when the mutation is successful */
  onSuccess?: (data: void, variables: MarkMessageReadVariables, context: { previousConversation?: Conversation }) => void;
  /** Called when the mutation is either successful or errors */
  onSettled?: (data: void | undefined, error: Error | null, variables: MarkMessageReadVariables, context: { previousConversation?: Conversation } | undefined) => void;
}

/**
 * Hook for marking a single message as read
 *
 * Updates the read status of a message with optimistic UI updates
 * and automatic cache invalidation for unread counts.
 *
 * @param options - Mutation options
 * @returns Mutation result with mark read function
 *
 * @example
 * ```typescript
 * function MessageItem({ message, conversationId }: MessageItemProps) {
 *   const { mutate: markRead, isPending } = useMarkMessageRead();
 *
 *   useEffect(() => {
 *     // Mark message as read when viewed
 *     if (!message.isRead) {
 *       markRead({ messageId: message.id, conversationId });
 *     }
 *   }, [message.id, message.isRead, conversationId, markRead]);
 *
 *   return (
 *     <Box className={message.isRead ? 'read' : 'unread'}>
 *       <Typography>{message.fullmessage}</Typography>
 *     </Box>
 *   );
 * }
 * ```
 */
export function useMarkMessageRead(options: UseMarkMessageReadOptions = {}) {
  const queryClient = useQueryClient();
  const { optimistic = true, onMutate, onError, onSuccess, onSettled } = options;

  return useMutation<void, Error, MarkMessageReadVariables, { previousConversation?: Conversation }>({
    mutationFn: async (variables: MarkMessageReadVariables): Promise<void> => {
      if (!variables.messageId || variables.messageId <= 0) {
        throw new Error('Invalid message ID');
      }

      try {
        await markMessageAsRead(variables.messageId);
      } catch (error) {
        if (error instanceof Error) {
          throw error;
        }
        throw new Error('Failed to mark message as read');
      }
    },

    onMutate: async (variables) => {
      // Call user's onMutate handler
      await onMutate?.(variables);

      if (!optimistic || !variables.conversationId) {
        return {};
      }

      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: messagingKeys.conversation(variables.conversationId),
      });

      // Snapshot the previous conversation for rollback
      const previousConversation = queryClient.getQueryData<Conversation>(
        messagingKeys.conversation(variables.conversationId)
      );

      // Optimistically update unread count
      if (previousConversation && previousConversation.unreadcount > 0) {
        queryClient.setQueryData<Conversation>(
          messagingKeys.conversation(variables.conversationId),
          {
            ...previousConversation,
            unreadcount: previousConversation.unreadcount - 1,
            isread: previousConversation.unreadcount - 1 === 0,
          }
        );
      }

      return { previousConversation };
    },

    onError: (error, variables, context) => {
      // Call user's onError handler
      onError?.(error, variables, context);

      // Rollback on error
      if (optimistic && context?.previousConversation && variables.conversationId) {
        queryClient.setQueryData<Conversation>(
          messagingKeys.conversation(variables.conversationId),
          context.previousConversation
        );
      }
    },

    onSettled: (data, error, variables, context) => {
      // Call user's onSettled handler
      onSettled?.(data, error, variables, context);

      // Invalidate relevant queries
      if (variables.conversationId) {
        queryClient.invalidateQueries({
          queryKey: messagingKeys.conversation(variables.conversationId),
        });
        queryClient.invalidateQueries({
          queryKey: messagingKeys.conversationMessages(variables.conversationId),
        });
      }

      // Invalidate conversations list for updated unread counts
      queryClient.invalidateQueries({
        queryKey: messagingKeys.conversations(),
      });

      // Invalidate unread conversation counts
      queryClient.invalidateQueries({
        queryKey: messagingKeys.unreadConversationCounts(),
      });
    },

    onSuccess: (data, variables, context) => {
      // Call user's onSuccess handler
      onSuccess?.(data, variables, context);
    },
  });
}

// ============================================================================
// useMarkConversationRead Hook (Bonus Export)
// ============================================================================

/**
 * Options for useMarkConversationRead hook
 */
interface UseMarkConversationReadOptions {
  /** Whether to use optimistic updates (default: true) */
  optimistic?: boolean;
  /** Called before the mutation function fires */
  onMutate?: (conversationId: number) => void | Promise<void>;
  /** Called when the mutation encounters an error */
  onError?: (error: Error, conversationId: number, context: { previousConversation?: Conversation } | undefined) => void;
  /** Called when the mutation is successful */
  onSuccess?: (data: void, conversationId: number, context: { previousConversation?: Conversation }) => void;
  /** Called when the mutation is either successful or errors */
  onSettled?: (data: void | undefined, error: Error | null, conversationId: number, context: { previousConversation?: Conversation } | undefined) => void;
}

/**
 * Hook for marking all messages in a conversation as read
 *
 * Marks the entire conversation as read with optimistic updates
 * and automatic cache invalidation.
 *
 * @param options - Mutation options
 * @returns Mutation result with mark all read function
 *
 * @example
 * ```typescript
 * function ConversationView({ conversationId }: { conversationId: number }) {
 *   const { data: conversation } = useConversation(conversationId);
 *   const { mutate: markAllRead } = useMarkConversationRead();
 *
 *   useEffect(() => {
 *     // Mark all messages as read when opening conversation
 *     if (conversation && !conversation.isread) {
 *       markAllRead(conversationId);
 *     }
 *   }, [conversationId, conversation?.isread, markAllRead]);
 *
 *   return <MessageList conversationId={conversationId} />;
 * }
 * ```
 */
export function useMarkConversationRead(options: UseMarkConversationReadOptions = {}) {
  const queryClient = useQueryClient();
  const { optimistic = true, onMutate, onError, onSuccess, onSettled } = options;

  return useMutation<void, Error, number, { previousConversation?: Conversation }>({
    mutationFn: async (conversationId: number): Promise<void> => {
      if (!conversationId || conversationId <= 0) {
        throw new Error('Invalid conversation ID');
      }

      try {
        await markConversationAsRead(conversationId);
      } catch (error) {
        if (error instanceof Error) {
          throw error;
        }
        throw new Error('Failed to mark conversation as read');
      }
    },

    onMutate: async (conversationId) => {
      // Call user's onMutate handler
      await onMutate?.(conversationId);

      if (!optimistic) {
        return {};
      }

      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: messagingKeys.conversation(conversationId),
      });

      // Snapshot for rollback
      const previousConversation = queryClient.getQueryData<Conversation>(
        messagingKeys.conversation(conversationId)
      );

      // Optimistically mark as read
      if (previousConversation) {
        queryClient.setQueryData<Conversation>(
          messagingKeys.conversation(conversationId),
          {
            ...previousConversation,
            unreadcount: 0,
            isread: true,
          }
        );
      }

      return { previousConversation };
    },

    onError: (error, conversationId, context) => {
      // Call user's onError handler
      onError?.(error, conversationId, context);

      // Rollback on error
      if (optimistic && context?.previousConversation) {
        queryClient.setQueryData<Conversation>(
          messagingKeys.conversation(conversationId),
          context.previousConversation
        );
      }
    },

    onSettled: (data, error, conversationId, context) => {
      // Call user's onSettled handler
      onSettled?.(data, error, conversationId, context);

      // Invalidate queries
      queryClient.invalidateQueries({
        queryKey: messagingKeys.conversation(conversationId),
      });
      queryClient.invalidateQueries({
        queryKey: messagingKeys.conversationMessages(conversationId),
      });
      queryClient.invalidateQueries({
        queryKey: messagingKeys.conversations(),
      });
      queryClient.invalidateQueries({
        queryKey: messagingKeys.unreadConversationCounts(),
      });
    },

    onSuccess: (data, conversationId, context) => {
      // Call user's onSuccess handler
      onSuccess?.(data, conversationId, context);
    },
  });
}

// ============================================================================
// Utility Hooks
// ============================================================================

/**
 * Hook for prefetching conversation data
 *
 * Useful for preloading conversation details when hovering over
 * a conversation in the list for faster navigation.
 *
 * @returns Prefetch function
 *
 * @example
 * ```typescript
 * function ConversationListItem({ conversation }: { conversation: Conversation }) {
 *   const prefetchConversation = usePrefetchConversation();
 *
 *   return (
 *     <ListItem
 *       onMouseEnter={() => prefetchConversation(conversation.id)}
 *       onClick={() => navigate(`/messages/${conversation.id}`)}
 *     >
 *       <ListItemText primary={conversation.name} />
 *     </ListItem>
 *   );
 * }
 * ```
 */
export function usePrefetchConversation() {
  const queryClient = useQueryClient();

  return async (conversationId: number) => {
    if (!conversationId || conversationId <= 0) return;

    await queryClient.prefetchQuery({
      queryKey: messagingKeys.conversation(conversationId),
      queryFn: async () => {
        const response = await getConversations(
          { pagination: { page: 1, perPage: 100 } }
        );
        return response.conversations.find((c) => c.id === conversationId) ?? null;
      },
      staleTime: CONVERSATION_STALE_TIME,
    });

    await queryClient.prefetchQuery({
      queryKey: messagingKeys.conversationMessages(conversationId),
      queryFn: () => getConversationMessages(
        conversationId,
        { pagination: { page: 1, perPage: 50 } },
        { newest: true }
      ),
      staleTime: MESSAGE_STALE_TIME,
    });
  };
}

/**
 * Hook for invalidating conversation-related caches
 *
 * Useful for forcing a refetch after external changes.
 *
 * @returns Object with invalidation functions
 *
 * @example
 * ```typescript
 * function RefreshButton({ conversationId }: { conversationId: number }) {
 *   const { invalidateConversation, invalidateAll } = useInvalidateConversation();
 *
 *   return (
 *     <Box>
 *       <Button onClick={() => invalidateConversation(conversationId)}>
 *         Refresh Conversation
 *       </Button>
 *       <Button onClick={invalidateAll}>
 *         Refresh All
 *       </Button>
 *     </Box>
 *   );
 * }
 * ```
 */
export function useInvalidateConversation() {
  const queryClient = useQueryClient();

  return {
    invalidateConversation: async (conversationId: number) => {
      await queryClient.invalidateQueries({
        queryKey: messagingKeys.conversation(conversationId),
      });
      await queryClient.invalidateQueries({
        queryKey: messagingKeys.conversationMessages(conversationId),
      });
    },
    invalidateAll: async () => {
      await queryClient.invalidateQueries({
        queryKey: messagingKeys.all,
      });
    },
  };
}
