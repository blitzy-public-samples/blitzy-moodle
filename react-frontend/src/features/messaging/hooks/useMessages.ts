/**
 * @fileoverview Custom React hooks for messaging feature integration
 *
 * This module provides React Query-based hooks for managing the messaging interface,
 * including fetching messages, conversations, contacts, sending/deleting messages,
 * and searching with debounced queries.
 *
 * All hooks wrap the messagingApi functions that delegate to existing Moodle
 * message_send(), message_delete(), message_get_messages(), message_get_contacts()
 * functions via the /api/v1/messages endpoints with JWT authentication.
 *
 * @module features/messaging/hooks/useMessages
 */

import { useState, useCallback, useMemo } from 'react';
import {
  useQuery,
  useMutation,
  useQueryClient,
  useInfiniteQuery,
  type QueryKey,
  type InfiniteData,
} from '@tanstack/react-query';

import {
  messagingKeys,
  getConversations,
  getConversationMessages,
  sendMessage,
  deleteMessage,
  getContacts,
  searchMessages,
  markConversationAsRead,
} from '../api/messagingApi';

import type {
  Message,
  Conversation,
  Contact,
  MessageFilters,
  SendMessageParams,
} from '../types/message.types';

import useDebounce from '@/hooks/useDebounce';

// =============================================================================
// CONSTANTS & CONFIGURATION
// =============================================================================

/**
 * Default stale time for messages queries (5 minutes)
 * Messages are considered fresh for this duration before refetching
 */
export const DEFAULT_STALE_TIME = 5 * 60 * 1000;

/**
 * Default cache time for messages queries (10 minutes)
 * Cached data is kept in memory for this duration after becoming inactive
 */
export const DEFAULT_CACHE_TIME = 10 * 60 * 1000;

/**
 * Default refetch interval for real-time feel (30 seconds)
 * Messages are automatically refetched at this interval when the window is focused
 */
export const DEFAULT_REFETCH_INTERVAL = 30 * 1000;

/**
 * Default page size for paginated queries
 */
export const DEFAULT_PAGE_SIZE = 20;

/**
 * Debounce delay for search queries (300ms)
 * Prevents excessive API calls while user is typing
 */
export const SEARCH_DEBOUNCE_DELAY = 300;

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/**
 * Parameters for the useMessages hook
 */
export interface UseMessagesParams {
  /** Optional filters to apply to the message list */
  filters?: MessageFilters;
  /** Number of items per page (default: 20) */
  pageSize?: number;
  /** Whether to enable automatic refetching (default: true) */
  enableRefetch?: boolean;
  /** Custom refetch interval in milliseconds */
  refetchInterval?: number;
  /** Whether the query is enabled (default: true) */
  enabled?: boolean;
}

/**
 * Parameters for the useContacts hook
 */
export interface UseContactsParams {
  /** Search query to filter contacts */
  search?: string;
  /** Number of items per page (default: 20) */
  pageSize?: number;
  /** Whether the query is enabled (default: true) */
  enabled?: boolean;
}

/**
 * Parameters for the useMessageSearch hook
 */
export interface UseMessageSearchParams {
  /** Search query string */
  query: string;
  /** Optional user ID to filter messages from a specific user */
  userId?: number;
  /** Minimum characters required before searching (default: 2) */
  minQueryLength?: number;
  /** Debounce delay in milliseconds (default: 300) */
  debounceDelay?: number;
}

/**
 * Paginated response structure for conversations
 * Matches ConversationListResponse from message.types.ts
 */
export interface PaginatedConversationsResponse {
  conversations: Conversation[];
  total: number;
  page: number;
  perPage: number;
  hasMore: boolean;
}

/**
 * Paginated response structure for messages within a conversation
 * Uses page-based pagination matching API response
 */
export interface PaginatedMessagesResponse {
  messages: Message[];
  total: number;
  page: number;
  perPage: number;
  hasMore: boolean;
}

/**
 * Paginated response structure for contacts
 * Uses page-based pagination matching API response
 */
export interface PaginatedContactsResponse {
  contacts: Contact[];
  total: number;
  page: number;
  perPage: number;
  hasMore: boolean;
}

/**
 * Search results response structure
 */
export interface MessageSearchResponse {
  messages: Message[];
  conversations: Conversation[];
  totalCount: number;
}

/**
 * Return type for useMessages hook
 */
export interface UseMessagesReturn {
  /** List of conversations */
  conversations: Conversation[];
  /** Whether initial data is being loaded */
  isLoading: boolean;
  /** Whether more data is being fetched */
  isFetchingNextPage: boolean;
  /** Whether there are more pages to fetch */
  hasNextPage: boolean;
  /** Error object if the query failed */
  error: Error | null;
  /** Whether data is being refetched in background */
  isRefetching: boolean;
  /** Function to fetch the next page */
  fetchNextPage: () => void;
  /** Function to manually refetch data */
  refetch: () => void;
  /** Total count of conversations if available */
  totalCount: number | undefined;
}

/**
 * Return type for useSendMessage hook
 */
export interface UseSendMessageReturn {
  /** Function to send a message */
  sendMessage: (params: SendMessageParams) => void;
  /** Function to send a message and await result */
  sendMessageAsync: (params: SendMessageParams) => Promise<Message>;
  /** Whether the mutation is in progress */
  isLoading: boolean;
  /** Whether the mutation was successful */
  isSuccess: boolean;
  /** Whether the mutation failed */
  isError: boolean;
  /** Error object if the mutation failed */
  error: Error | null;
  /** The sent message if successful */
  data: Message | undefined;
  /** Function to reset the mutation state */
  reset: () => void;
}

/**
 * Return type for useDeleteMessage hook
 */
export interface UseDeleteMessageReturn {
  /** Function to delete a message */
  deleteMessage: (messageId: number) => void;
  /** Function to delete a message and await result */
  deleteMessageAsync: (messageId: number) => Promise<void>;
  /** Whether the mutation is in progress */
  isLoading: boolean;
  /** Whether the mutation was successful */
  isSuccess: boolean;
  /** Whether the mutation failed */
  isError: boolean;
  /** Error object if the mutation failed */
  error: Error | null;
  /** Function to reset the mutation state */
  reset: () => void;
}

/**
 * Return type for useContacts hook
 */
export interface UseContactsReturn {
  /** List of contacts */
  contacts: Contact[];
  /** Whether initial data is being loaded */
  isLoading: boolean;
  /** Whether more data is being fetched */
  isFetchingNextPage: boolean;
  /** Whether there are more pages to fetch */
  hasNextPage: boolean;
  /** Error object if the query failed */
  error: Error | null;
  /** Function to fetch the next page */
  fetchNextPage: () => void;
  /** Function to manually refetch data */
  refetch: () => void;
  /** Total count of contacts if available */
  totalCount: number | undefined;
}

/**
 * Return type for useMessageSearch hook
 */
export interface UseMessageSearchReturn {
  /** Search results - messages matching the query */
  messages: Message[];
  /** Search results - conversations matching the query */
  conversations: Conversation[];
  /** Whether the search is in progress */
  isSearching: boolean;
  /** Error object if the search failed */
  error: Error | null;
  /** Total count of results */
  totalCount: number;
  /** The debounced search query */
  debouncedQuery: string;
  /** Whether the search is enabled (meets minimum length) */
  isEnabled: boolean;
}

// =============================================================================
// HOOK: useMessages
// =============================================================================

/**
 * Custom hook for fetching and managing the user's conversations/message list.
 *
 * Provides infinite scroll pagination for the main messaging interface with support for
 * filtering, automatic refetching for real-time updates, and optimistic cache management.
 *
 * Uses React Query's useInfiniteQuery for cursor-based pagination and automatic
 * data fetching when scrolling to load more conversations.
 *
 * @param {UseMessagesParams} params - Configuration parameters for the hook
 * @returns {UseMessagesReturn} Object containing conversations data and control functions
 *
 * @example
 * ```tsx
 * function MessagingInbox() {
 *   const {
 *     conversations,
 *     isLoading,
 *     hasNextPage,
 *     fetchNextPage,
 *     isFetchingNextPage
 *   } = useMessages({
 *     filters: { type: ConversationType.INDIVIDUAL },
 *     pageSize: 25,
 *     enableRefetch: true
 *   });
 *
 *   if (isLoading) return <LoadingSpinner />;
 *
 *   return (
 *     <ConversationList
 *       conversations={conversations}
 *       onLoadMore={() => hasNextPage && fetchNextPage()}
 *       isLoadingMore={isFetchingNextPage}
 *     />
 *   );
 * }
 * ```
 */
export function useMessages(params: UseMessagesParams = {}): UseMessagesReturn {
  const {
    filters,
    pageSize = DEFAULT_PAGE_SIZE,
    enableRefetch = true,
    refetchInterval = DEFAULT_REFETCH_INTERVAL,
    enabled = true,
  } = params;

  // Build query key with filters for proper cache separation
  // Note: messagingKeys.conversations() takes no arguments, filters are included in array
  const queryKey = useMemo(
    () => [...messagingKeys.conversations(), filters] as const,
    [filters]
  );

  // Use infinite query for paginated conversation fetching
  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    error,
    isRefetching,
    fetchNextPage,
    refetch,
  } = useInfiniteQuery<
    PaginatedConversationsResponse,
    Error,
    InfiniteData<PaginatedConversationsResponse>,
    QueryKey,
    number
  >({
    queryKey,
    queryFn: async ({ pageParam }) => {
      // Build proper ListParams structure for API call
      // Convert MessageFilters to Record<string, unknown> for filter param
      const filterRecord: Record<string, unknown> | undefined = filters
        ? {
            userId: filters.userId,
            conversationId: filters.conversationId,
            readStatus: filters.readStatus,
            dateRange: filters.dateRange,
            searchTerm: filters.searchTerm,
          }
        : undefined;

      const response = await getConversations(
        {
          pagination: { page: pageParam, perPage: pageSize },
          filter: filterRecord,
          search: filters?.searchTerm,
        }
        // Note: getConversations second parameter options (type, favourites)
        // are not part of MessageFilters - omitted unless explicitly needed
      );

      // Transform API response to match our interface
      return {
        conversations: response.conversations || [],
        total: response.total,
        page: response.page,
        perPage: response.perPage,
        hasMore: response.hasMore ?? false,
      };
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.page + 1 : undefined,
    staleTime: DEFAULT_STALE_TIME,
    gcTime: DEFAULT_CACHE_TIME,
    refetchInterval: enableRefetch ? refetchInterval : false,
    refetchIntervalInBackground: false, // Only refetch when window is focused
    enabled,
  });

  // Flatten paginated data into single array of conversations
  const conversations = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap((page) => page.conversations);
  }, [data?.pages]);

  // Get total count from first page (if available)
  const totalCount = data?.pages[0]?.total;

  return {
    conversations,
    isLoading,
    isFetchingNextPage,
    hasNextPage: hasNextPage ?? false,
    error: error ?? null,
    isRefetching,
    fetchNextPage: () => {
      if (hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    },
    refetch: () => {
      refetch();
    },
    totalCount,
  };
}

// =============================================================================
// HOOK: useSendMessage
// =============================================================================

/**
 * Custom hook for sending messages with optimistic updates.
 *
 * Provides a mutation function to send messages via the API, with automatic
 * cache invalidation and optimistic UI updates for a responsive user experience.
 *
 * Wraps the messagingApi.sendMessage function which delegates to the Moodle
 * message_send() function via the /api/v1/messages endpoint.
 *
 * @returns {UseSendMessageReturn} Object containing mutation function and state
 *
 * @example
 * ```tsx
 * function MessageComposer({ conversationId }: { conversationId: number }) {
 *   const [text, setText] = useState('');
 *   const { sendMessage, isLoading, isError, error, reset } = useSendMessage();
 *
 *   const handleSubmit = () => {
 *     if (!text.trim()) return;
 *     
 *     sendMessage({
 *       conversationId,
 *       text: text.trim()
 *     });
 *     setText('');
 *   };
 *
 *   return (
 *     <form onSubmit={handleSubmit}>
 *       <input value={text} onChange={(e) => setText(e.target.value)} />
 *       <button type="submit" disabled={isLoading}>
 *         {isLoading ? 'Sending...' : 'Send'}
 *       </button>
 *       {isError && (
 *         <ErrorMessage error={error} onDismiss={reset} />
 *       )}
 *     </form>
 *   );
 * }
 * ```
 */
export function useSendMessage(): UseSendMessageReturn {
  const queryClient = useQueryClient();

  const mutation = useMutation<Message, Error, SendMessageParams, { previousData: unknown }>({
    mutationFn: async (params: SendMessageParams) => {
      // sendMessage returns Message directly, not wrapped in an object
      const message = await sendMessage(params);
      return message;
    },

    // Optimistic update: add the message immediately before server confirmation
    onMutate: async (newMessage) => {
      // Cancel any outgoing refetches to prevent overwriting optimistic update
      await queryClient.cancelQueries({
        queryKey: messagingKeys.conversations(),
      });

      if (newMessage.conversationid) {
        await queryClient.cancelQueries({
          queryKey: messagingKeys.conversationMessages(newMessage.conversationid),
        });
      }

      // Snapshot the previous value for rollback
      const previousData = queryClient.getQueriesData({
        queryKey: messagingKeys.conversations(),
      });

      // Optimistically update conversation to show activity
      // The actual message is added when the mutation succeeds
      queryClient.setQueriesData<InfiniteData<PaginatedConversationsResponse>>(
        { queryKey: messagingKeys.conversations() },
        (oldData) => {
          if (!oldData) return oldData;

          return {
            ...oldData,
            pages: oldData.pages.map((page, index) => {
              if (index !== 0) return page;

              // Move the conversation to top of list (most recent)
              const updatedConversations = page.conversations.map((conv) => {
                if (conv.id === newMessage.conversationid) {
                  return {
                    ...conv,
                    lastMessageText: newMessage.text,
                    lastMessageDate: Date.now() / 1000,
                  };
                }
                return conv;
              });

              // Reorder to put active conversation first
              const activeConv = updatedConversations.find(
                (c) => c.id === newMessage.conversationid
              );
              if (activeConv) {
                const others = updatedConversations.filter(
                  (c) => c.id !== newMessage.conversationid
                );
                return {
                  ...page,
                  conversations: [activeConv, ...others],
                };
              }

              return { ...page, conversations: updatedConversations };
            }),
          };
        }
      );

      return { previousData };
    },

    // Rollback on error
    onError: (_error, _newMessage, context) => {
      if (context?.previousData) {
        // Restore previous queries data
        const previousQueries = context.previousData as [QueryKey, unknown][];
        previousQueries.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },

    // Refetch after successful mutation to ensure consistency
    onSuccess: (_message, variables) => {
      // Invalidate and refetch conversations list
      queryClient.invalidateQueries({
        queryKey: messagingKeys.conversations(),
      });

      // Invalidate the specific conversation messages if we know the ID
      if (variables.conversationid) {
        queryClient.invalidateQueries({
          queryKey: messagingKeys.conversationMessages(variables.conversationid),
        });
      }
    },

    // Always refetch after mutation settles
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: messagingKeys.conversations(),
      });
    },
  });

  return {
    sendMessage: mutation.mutate,
    sendMessageAsync: mutation.mutateAsync,
    isLoading: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    error: mutation.error ?? null,
    data: mutation.data,
    reset: mutation.reset,
  };
}

// =============================================================================
// HOOK: useDeleteMessage
// =============================================================================

/**
 * Custom hook for deleting messages with optimistic removal from cache.
 *
 * Provides a mutation function to delete messages via the API, with automatic
 * optimistic removal from the cache for immediate UI feedback.
 *
 * Wraps the messagingApi.deleteMessage function which delegates to the Moodle
 * message_delete() function via the DELETE /api/v1/messages/{id} endpoint.
 *
 * @returns {UseDeleteMessageReturn} Object containing mutation function and state
 *
 * @example
 * ```tsx
 * function MessageItem({ message }: { message: Message }) {
 *   const { deleteMessage, isLoading } = useDeleteMessage();
 *   const [showConfirm, setShowConfirm] = useState(false);
 *
 *   const handleDelete = () => {
 *     deleteMessage(message.id);
 *     setShowConfirm(false);
 *   };
 *
 *   return (
 *     <div className="message">
 *       <p>{message.text}</p>
 *       <button 
 *         onClick={() => setShowConfirm(true)}
 *         disabled={isLoading}
 *       >
 *         Delete
 *       </button>
 *       {showConfirm && (
 *         <ConfirmDialog
 *           onConfirm={handleDelete}
 *           onCancel={() => setShowConfirm(false)}
 *         />
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export function useDeleteMessage(): UseDeleteMessageReturn {
  const queryClient = useQueryClient();

  // Track the conversation ID for cache invalidation
  const [deletedFromConversationId, setDeletedFromConversationId] = useState<number | null>(null);

  const mutation = useMutation<void, Error, number, { previousMessages: unknown; messageId: number }>({
    mutationFn: async (messageId: number) => {
      await deleteMessage(messageId);
    },

    // Optimistic removal: remove message from cache immediately
    onMutate: async (messageId) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({
        queryKey: messagingKeys.all,
      });

      // Find and store the conversation this message belongs to
      // by searching through all conversation message caches
      let conversationId: number | null = null;
      
      // Snapshot all message queries for potential rollback
      const previousMessages = queryClient.getQueriesData({
        queryKey: messagingKeys.all,
      });

      // Search through cached conversation messages to find and remove the message
      queryClient.setQueriesData<InfiniteData<PaginatedMessagesResponse>>(
        { queryKey: messagingKeys.all },
        (oldData) => {
          if (!oldData?.pages) return oldData;

          let foundMessage = false;
          const newPages = oldData.pages.map((page) => {
            const messageIndex = page.messages.findIndex((m) => m.id === messageId);
            if (messageIndex >= 0) {
              foundMessage = true;
              // Get conversation ID from the message if available
              const msg = page.messages[messageIndex];
              if (msg && msg.conversationid) {
                conversationId = msg.conversationid;
              }
              // Remove the message
              return {
                ...page,
                messages: page.messages.filter((m) => m.id !== messageId),
              };
            }
            return page;
          });

          return foundMessage ? { ...oldData, pages: newPages } : oldData;
        }
      );

      if (conversationId) {
        setDeletedFromConversationId(conversationId);
      }

      return { previousMessages, messageId };
    },

    // Rollback on error
    onError: (_error, _messageId, context) => {
      if (context?.previousMessages) {
        const previousQueries = context.previousMessages as [QueryKey, unknown][];
        previousQueries.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },

    // Invalidate caches after successful deletion
    onSuccess: () => {
      // Invalidate the specific conversation if known
      if (deletedFromConversationId) {
        queryClient.invalidateQueries({
          queryKey: messagingKeys.conversationMessages(deletedFromConversationId),
        });
      }

      // Invalidate conversations list to update last message text
      queryClient.invalidateQueries({
        queryKey: messagingKeys.conversations(),
      });
    },

    // Always clean up after mutation settles
    onSettled: () => {
      setDeletedFromConversationId(null);
    },
  });

  return {
    deleteMessage: mutation.mutate,
    deleteMessageAsync: mutation.mutateAsync,
    isLoading: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    error: mutation.error ?? null,
    reset: mutation.reset,
  };
}

// =============================================================================
// HOOK: useContacts
// =============================================================================

/**
 * Custom hook for fetching user contacts with pagination support.
 *
 * Provides infinite scroll pagination for the contacts list with optional
 * search filtering. Uses React Query's useInfiniteQuery for automatic
 * pagination management.
 *
 * Wraps the messagingApi.getContacts function which delegates to the Moodle
 * message_get_contacts() function via the /api/v1/messages/contacts endpoint.
 *
 * @param {UseContactsParams} params - Configuration parameters for the hook
 * @returns {UseContactsReturn} Object containing contacts data and control functions
 *
 * @example
 * ```tsx
 * function ContactsList() {
 *   const [searchQuery, setSearchQuery] = useState('');
 *   const {
 *     contacts,
 *     isLoading,
 *     hasNextPage,
 *     fetchNextPage,
 *     isFetchingNextPage
 *   } = useContacts({
 *     search: searchQuery,
 *     pageSize: 30
 *   });
 *
 *   if (isLoading) return <LoadingSpinner />;
 *
 *   return (
 *     <>
 *       <SearchInput
 *         value={searchQuery}
 *         onChange={setSearchQuery}
 *         placeholder="Search contacts..."
 *       />
 *       <VirtualizedList
 *         items={contacts}
 *         renderItem={(contact) => <ContactItem contact={contact} />}
 *         onEndReached={() => hasNextPage && fetchNextPage()}
 *         isLoadingMore={isFetchingNextPage}
 *       />
 *     </>
 *   );
 * }
 * ```
 */
export function useContacts(params: UseContactsParams = {}): UseContactsReturn {
  const { search, pageSize = DEFAULT_PAGE_SIZE, enabled = true } = params;

  // Debounce search query to reduce API calls
  const debouncedSearch = useDebounce(search || '', SEARCH_DEBOUNCE_DELAY);

  // Build query key with search parameter
  // Note: messagingKeys.contacts() takes no arguments, include search in key array
  const queryKey = useMemo(
    () => [...messagingKeys.contacts(), debouncedSearch || 'all'] as const,
    [debouncedSearch]
  );

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    error,
    fetchNextPage,
    refetch,
  } = useInfiniteQuery<
    PaginatedContactsResponse,
    Error,
    InfiniteData<PaginatedContactsResponse>,
    QueryKey,
    number
  >({
    queryKey,
    queryFn: async ({ pageParam }) => {
      // getContacts returns Contact[] - wrap result in paginated response structure
      const contactsList = await getContacts({
        pagination: { page: pageParam, perPage: pageSize },
        search: debouncedSearch || undefined,
      });

      // Since API returns Contact[], we estimate pagination based on result count
      const hasMore = contactsList.length >= pageSize;
      return {
        contacts: contactsList,
        total: contactsList.length,
        page: pageParam,
        perPage: pageSize,
        hasMore,
      };
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.page + 1 : undefined,
    staleTime: DEFAULT_STALE_TIME,
    gcTime: DEFAULT_CACHE_TIME,
    enabled,
  });

  // Flatten paginated data into single array of contacts
  const contacts = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap((page) => page.contacts);
  }, [data?.pages]);

  // Get total count from accumulated contacts
  const totalCount = contacts.length;

  return {
    contacts,
    isLoading,
    isFetchingNextPage,
    hasNextPage: hasNextPage ?? false,
    error: error ?? null,
    fetchNextPage: () => {
      if (hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    },
    refetch: () => {
      refetch();
    },
    totalCount,
  };
}

// =============================================================================
// HOOK: useMessageSearch
// =============================================================================

/**
 * Custom hook for searching messages with debounced queries.
 *
 * Provides a search interface with automatic debouncing to prevent excessive
 * API calls while the user is typing. The search is only executed when the
 * query meets the minimum length requirement.
 *
 * Wraps the messagingApi.searchMessages function which delegates to the Moodle
 * data_for_messagearea_search_messages() function via the search endpoint.
 *
 * @param {UseMessageSearchParams} params - Configuration parameters for the search
 * @returns {UseMessageSearchReturn} Object containing search results and state
 *
 * @example
 * ```tsx
 * function MessageSearch() {
 *   const [query, setQuery] = useState('');
 *   const {
 *     messages,
 *     conversations,
 *     isSearching,
 *     totalCount,
 *     debouncedQuery,
 *     isEnabled
 *   } = useMessageSearch({
 *     query,
 *     minQueryLength: 3,
 *     debounceDelay: 400
 *   });
 *
 *   return (
 *     <div>
 *       <SearchInput
 *         value={query}
 *         onChange={(e) => setQuery(e.target.value)}
 *         placeholder="Search messages..."
 *       />
 *       {!isEnabled && query.length > 0 && (
 *         <HintText>Type at least 3 characters to search</HintText>
 *       )}
 *       {isSearching && <LoadingSpinner />}
 *       {isEnabled && !isSearching && (
 *         <>
 *           <ResultsCount>
 *             {totalCount} results for "{debouncedQuery}"
 *           </ResultsCount>
 *           <MessageResults messages={messages} />
 *           <ConversationResults conversations={conversations} />
 *         </>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export function useMessageSearch(
  params: UseMessageSearchParams
): UseMessageSearchReturn {
  const {
    query,
    userId,
    minQueryLength = 2,
    debounceDelay = SEARCH_DEBOUNCE_DELAY,
  } = params;

  // Debounce the search query to reduce API calls
  const debouncedQuery = useDebounce(query, debounceDelay);

  // Determine if search should be enabled based on minimum query length
  const isEnabled = debouncedQuery.trim().length >= minQueryLength;

  // Build query key for caching
  // Note: messagingKeys.messageSearch only takes the query string
  // userId is included in the key array for cache separation
  const queryKey = useMemo(
    () => [...messagingKeys.messageSearch(debouncedQuery), userId] as const,
    [debouncedQuery, userId]
  );

  const { data, isLoading, isFetching, error } = useQuery<
    MessageSearchResponse,
    Error
  >({
    queryKey,
    queryFn: async () => {
      // searchMessages expects (query, ListParams<Message>)
      // userId filtering is not supported by the API directly
      const response = await searchMessages(debouncedQuery, {
        pagination: { page: 1, perPage: 50 }, // Higher limit for search results
      });

      return {
        messages: response.messages || [],
        conversations: response.conversations || [],
        totalCount: response.total ?? 0,
      };
    },
    enabled: isEnabled,
    staleTime: DEFAULT_STALE_TIME,
    gcTime: DEFAULT_CACHE_TIME,
    // Don't retry on user-initiated searches
    retry: 1,
  });

  return {
    messages: data?.messages ?? [],
    conversations: data?.conversations ?? [],
    isSearching: isLoading || isFetching,
    error: error ?? null,
    totalCount: data?.totalCount ?? 0,
    debouncedQuery,
    isEnabled,
  };
}

// =============================================================================
// ADDITIONAL UTILITY HOOKS
// =============================================================================

/**
 * Hook for marking a conversation as read
 *
 * @param conversationId - The ID of the conversation to mark as read
 * @returns Mutation function and state
 */
export function useMarkAsRead() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, number>({
    mutationFn: async (conversationId: number) => {
      await markConversationAsRead(conversationId);
    },
    onSuccess: (_, conversationId) => {
      // Update the conversation in cache to show as read
      queryClient.setQueriesData<InfiniteData<PaginatedConversationsResponse>>(
        { queryKey: messagingKeys.conversations() },
        (oldData) => {
          if (!oldData) return oldData;

          return {
            ...oldData,
            pages: oldData.pages.map((page) => ({
              ...page,
              conversations: page.conversations.map((conv) =>
                conv.id === conversationId
                  ? { ...conv, unreadCount: 0 }
                  : conv
              ),
            })),
          };
        }
      );

      // Also invalidate the specific conversation
      queryClient.invalidateQueries({
        queryKey: messagingKeys.conversation(conversationId),
      });
    },
  });
}

/**
 * Hook for fetching messages within a specific conversation
 *
 * @param conversationId - The ID of the conversation
 * @param enabled - Whether the query should be enabled
 * @returns Messages data and control functions
 */
export function useConversationMessages(
  conversationId: number | null,
  enabled: boolean = true
) {
  const queryKey = useMemo(
    () => conversationId ? messagingKeys.conversationMessages(conversationId) : ['disabled'],
    [conversationId]
  );

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    error,
    fetchNextPage,
    refetch,
  } = useInfiniteQuery<
    PaginatedMessagesResponse,
    Error,
    InfiniteData<PaginatedMessagesResponse>,
    QueryKey,
    number
  >({
    queryKey,
    queryFn: async ({ pageParam }) => {
      if (!conversationId) {
        return { messages: [], total: 0, page: 1, perPage: DEFAULT_PAGE_SIZE, hasMore: false };
      }

      // getConversationMessages returns { messages: Message[]; members: ConversationMember[] }
      // We need to wrap this in our pagination structure
      const response = await getConversationMessages(conversationId, {
        pagination: { page: pageParam, perPage: DEFAULT_PAGE_SIZE },
      });

      // Estimate hasMore based on result count since API doesn't provide pagination info
      const hasMore = response.messages.length >= DEFAULT_PAGE_SIZE;

      return {
        messages: response.messages || [],
        total: response.messages.length,
        page: pageParam,
        perPage: DEFAULT_PAGE_SIZE,
        hasMore,
      };
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.page + 1 : undefined,
    staleTime: DEFAULT_STALE_TIME,
    gcTime: DEFAULT_CACHE_TIME,
    refetchInterval: DEFAULT_REFETCH_INTERVAL,
    refetchIntervalInBackground: false,
    enabled: enabled && conversationId !== null,
  });

  // Flatten paginated data into single array of messages
  const messages = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap((page) => page.messages);
  }, [data?.pages]);

  return {
    messages,
    isLoading,
    isFetchingNextPage,
    hasNextPage: hasNextPage ?? false,
    error: error ?? null,
    fetchNextPage: useCallback(() => {
      if (hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    }, [hasNextPage, isFetchingNextPage, fetchNextPage]),
    refetch,
  };
}
