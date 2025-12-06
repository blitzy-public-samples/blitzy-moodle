/**
 * useNotifications - Custom React hooks for managing user notifications
 *
 * Provides React Query integration for fetching notifications, marking them as read,
 * managing notification preferences, and displaying unread counts with real-time updates
 * and optimistic UI updates.
 *
 * These hooks wrap the Moodle notification APIs exposed through the messaging API layer,
 * ensuring type-safe data fetching and state management with automatic caching,
 * background refetching, and cache invalidation.
 *
 * @module features/messaging/hooks/useNotifications
 * @see public/message/lib.php - Moodle messaging library functions
 * @see public/message/externallib.php - Moodle messaging external API
 * @see public/message/classes/api.php - Moodle message API class
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  useInfiniteQuery,
  type UseQueryOptions,
  type UseMutationOptions,
  type UseInfiniteQueryOptions,
  type InfiniteData,
} from '@tanstack/react-query';

import {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
  getUserNotificationPreferences,
  updateUserNotificationPreferences,
  messagingKeys,
} from '../api/messagingApi';

import type {
  Notification,
  NotificationType,
  NotificationPreferences,
  NotificationFilters,
  NotificationListResponse,
} from '../types/message.types';

// ============================================================================
// Type Definitions for Hook Parameters and Return Values
// ============================================================================

/**
 * Parameters for the useNotifications hook
 */
export interface UseNotificationsParams {
  /** Number of notifications per page (default: 20) */
  pageSize?: number;
  /** Filter notifications by type (optional) */
  type?: NotificationType;
  /** Filter by read status: true=read, false=unread, undefined=all */
  read?: boolean;
  /** Filter from date as Unix timestamp (optional) */
  dateFrom?: number;
  /** Filter to date as Unix timestamp (optional) */
  dateTo?: number;
  /** Filter by component name (optional) */
  component?: string;
  /** Filter by event type (optional) */
  eventType?: string;
  /** Whether the query is enabled (default: true) */
  enabled?: boolean;
}

/**
 * Return type for the useNotifications hook
 */
export interface UseNotificationsReturn {
  /** Array of notification pages for infinite scrolling */
  notifications: Notification[];
  /** Total count of notifications matching filters */
  totalCount: number;
  /** Unread count from the most recent response */
  unreadCount: number;
  /** Whether the initial data is loading */
  isLoading: boolean;
  /** Whether more pages are being fetched */
  isFetchingNextPage: boolean;
  /** Whether there are more pages to fetch */
  hasNextPage: boolean;
  /** Error that occurred during fetching */
  error: Error | null;
  /** Function to fetch the next page */
  fetchNextPage: () => void;
  /** Function to refetch notifications */
  refetch: () => void;
}

/**
 * Parameters for the useUnreadCount hook
 */
export interface UseUnreadCountParams {
  /** Polling interval in milliseconds (default: 30000 = 30 seconds) */
  pollingInterval?: number;
  /** Whether polling is enabled (default: true) */
  enablePolling?: boolean;
  /** Whether the query is enabled (default: true) */
  enabled?: boolean;
}

/**
 * Return type for the useUnreadCount hook
 */
export interface UseUnreadCountReturn {
  /** Current unread notification count */
  count: number;
  /** Whether the count is loading */
  isLoading: boolean;
  /** Error that occurred during fetching */
  error: Error | null;
  /** Function to manually refetch the count */
  refetch: () => void;
}

/**
 * Parameters for the useMarkNotificationRead mutation
 */
export interface UseMarkNotificationReadParams {
  /** Callback on successful mutation */
  onSuccess?: (notificationId: number) => void;
  /** Callback on mutation error */
  onError?: (error: Error, notificationId: number) => void;
}

/**
 * Return type for the useMarkNotificationRead hook
 */
export interface UseMarkNotificationReadReturn {
  /** Function to mark a notification as read */
  markAsRead: (notificationId: number) => void;
  /** Whether the mutation is in progress */
  isLoading: boolean;
  /** Error that occurred during mutation */
  error: Error | null;
  /** Whether the last mutation was successful */
  isSuccess: boolean;
}

/**
 * Parameters for the useMarkAllNotificationsRead mutation
 */
export interface UseMarkAllNotificationsReadParams {
  /** Callback on successful mutation */
  onSuccess?: () => void;
  /** Callback on mutation error */
  onError?: (error: Error) => void;
}

/**
 * Return type for the useMarkAllNotificationsRead hook
 */
export interface UseMarkAllNotificationsReadReturn {
  /** Function to mark all notifications as read */
  markAllAsRead: () => void;
  /** Whether the mutation is in progress */
  isLoading: boolean;
  /** Error that occurred during mutation */
  error: Error | null;
  /** Whether the last mutation was successful */
  isSuccess: boolean;
}

/**
 * Parameters for the useNotificationPreferences hook
 */
export interface UseNotificationPreferencesParams {
  /** Whether the query is enabled (default: true) */
  enabled?: boolean;
}

/**
 * Return type for the useNotificationPreferences hook
 */
export interface UseNotificationPreferencesReturn {
  /** User's notification preferences */
  preferences: NotificationPreferences | undefined;
  /** Whether preferences are loading */
  isLoading: boolean;
  /** Error that occurred during fetching */
  error: Error | null;
  /** Function to update preferences */
  updatePreferences: (updates: Partial<NotificationPreferences>) => void;
  /** Whether an update is in progress */
  isUpdating: boolean;
  /** Error from the last update attempt */
  updateError: Error | null;
  /** Function to refetch preferences */
  refetch: () => void;
}

// ============================================================================
// Constants
// ============================================================================

/** Default page size for notification pagination */
const DEFAULT_PAGE_SIZE = 20;

/** Default polling interval for unread count (30 seconds) */
const DEFAULT_POLLING_INTERVAL = 30000;

/** Stale time for notification queries (5 minutes) */
const NOTIFICATIONS_STALE_TIME = 5 * 60 * 1000;

/** Stale time for unread count (1 minute - shorter for real-time feel) */
const UNREAD_COUNT_STALE_TIME = 60 * 1000;

/** Stale time for preferences (10 minutes) */
const PREFERENCES_STALE_TIME = 10 * 60 * 1000;

// ============================================================================
// useNotifications Hook
// ============================================================================

/**
 * Custom hook for fetching and managing user notifications with infinite scrolling
 *
 * Provides paginated notification fetching with support for filtering by type,
 * read status, date range, component, and event type. Uses React Query's
 * useInfiniteQuery for efficient pagination and caching.
 *
 * @param params - Configuration parameters for the hook
 * @returns Object containing notifications data, loading states, and pagination controls
 *
 * @example
 * ```tsx
 * function NotificationList() {
 *   const {
 *     notifications,
 *     isLoading,
 *     hasNextPage,
 *     fetchNextPage,
 *     totalCount,
 *     unreadCount
 *   } = useNotifications({
 *     pageSize: 20,
 *     type: NotificationType.ASSIGNMENT,
 *     read: false
 *   });
 *
 *   if (isLoading) return <LoadingSpinner />;
 *
 *   return (
 *     <div>
 *       <h2>Notifications ({unreadCount} unread of {totalCount})</h2>
 *       {notifications.map(n => (
 *         <NotificationItem key={n.id} notification={n} />
 *       ))}
 *       {hasNextPage && (
 *         <Button onClick={() => fetchNextPage()}>Load More</Button>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export function useNotifications(
  params: UseNotificationsParams = {}
): UseNotificationsReturn {
  const {
    pageSize = DEFAULT_PAGE_SIZE,
    type,
    read,
    dateFrom,
    dateTo,
    component,
    eventType,
    enabled = true,
  } = params;

  // Build filters object from params
  const filters: NotificationFilters = {};
  if (type !== undefined) filters.type = type;
  if (read !== undefined) filters.read = read;
  if (dateFrom !== undefined) filters.dateFrom = dateFrom;
  if (dateTo !== undefined) filters.dateTo = dateTo;
  if (component !== undefined) filters.component = component;
  if (eventType !== undefined) filters.eventType = eventType;

  // Create unique query key including filters
  const queryKey = [
    ...messagingKeys.notifications(),
    { pageSize, ...filters },
  ] as const;

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    error,
    fetchNextPage,
    refetch,
  } = useInfiniteQuery<
    NotificationListResponse,
    Error,
    InfiniteData<NotificationListResponse>,
    typeof queryKey,
    number
  >({
    queryKey,
    queryFn: async ({ pageParam }) => {
      const response = await getNotifications(
        {
          pagination: {
            page: pageParam,
            perPage: pageSize,
          },
        },
        Object.keys(filters).length > 0 ? filters : undefined
      );
      return response;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      // Calculate if there are more pages
      const totalFetched = allPages.reduce(
        (sum, page) => sum + page.notifications.length,
        0
      );
      return totalFetched < lastPage.total ? allPages.length + 1 : undefined;
    },
    enabled,
    staleTime: NOTIFICATIONS_STALE_TIME,
    refetchOnWindowFocus: false,
  });

  // Flatten notifications from all pages
  const notifications = data?.pages.flatMap((page) => page.notifications) ?? [];

  // Get totals from the most recent page
  const lastPage = data?.pages[data.pages.length - 1];
  const totalCount = lastPage?.total ?? 0;
  const unreadCount = lastPage?.unreadCount ?? 0;

  return {
    notifications,
    totalCount,
    unreadCount,
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
  };
}

// ============================================================================
// useUnreadCount Hook
// ============================================================================

/**
 * Custom hook for fetching unread notification count with automatic polling
 *
 * Provides real-time unread notification count updates through automatic polling.
 * The polling interval is configurable and can be disabled when the component
 * is not visible or the user is inactive.
 *
 * @param params - Configuration parameters for the hook
 * @returns Object containing the unread count, loading state, and refetch function
 *
 * @example
 * ```tsx
 * function NotificationBadge() {
 *   const { count, isLoading } = useUnreadCount({
 *     pollingInterval: 30000, // 30 seconds
 *     enablePolling: true
 *   });
 *
 *   if (isLoading) return null;
 *
 *   return count > 0 ? (
 *     <Badge badgeContent={count} color="error">
 *       <NotificationsIcon />
 *     </Badge>
 *   ) : (
 *     <NotificationsIcon />
 *   );
 * }
 * ```
 */
export function useUnreadCount(
  params: UseUnreadCountParams = {}
): UseUnreadCountReturn {
  const {
    pollingInterval = DEFAULT_POLLING_INTERVAL,
    enablePolling = true,
    enabled = true,
  } = params;

  const { data, isLoading, error, refetch } = useQuery<number, Error>({
    queryKey: messagingKeys.unreadNotificationCount(),
    queryFn: getUnreadNotificationCount,
    enabled,
    staleTime: UNREAD_COUNT_STALE_TIME,
    refetchInterval: enablePolling ? pollingInterval : false,
    refetchOnWindowFocus: true,
    refetchIntervalInBackground: false,
  });

  return {
    count: data ?? 0,
    isLoading,
    error: error ?? null,
    refetch: () => {
      refetch();
    },
  };
}

// ============================================================================
// useMarkNotificationRead Hook
// ============================================================================

/**
 * Custom hook for marking a single notification as read with optimistic updates
 *
 * Provides a mutation function to mark notifications as read with immediate
 * UI feedback through optimistic cache updates. The cache is automatically
 * invalidated on success to ensure data consistency.
 *
 * @param params - Configuration parameters for the hook
 * @returns Object containing the mutation function and status states
 *
 * @example
 * ```tsx
 * function NotificationItem({ notification }: { notification: Notification }) {
 *   const { markAsRead, isLoading } = useMarkNotificationRead({
 *     onSuccess: (id) => console.log(`Notification ${id} marked as read`),
 *     onError: (error) => console.error('Failed to mark as read:', error)
 *   });
 *
 *   const handleClick = () => {
 *     if (!notification.timeread) {
 *       markAsRead(notification.id);
 *     }
 *   };
 *
 *   return (
 *     <div
 *       onClick={handleClick}
 *       className={notification.timeread ? 'read' : 'unread'}
 *     >
 *       {notification.subject}
 *     </div>
 *   );
 * }
 * ```
 */
export function useMarkNotificationRead(
  params: UseMarkNotificationReadParams = {}
): UseMarkNotificationReadReturn {
  const { onSuccess, onError } = params;
  const queryClient = useQueryClient();

  const mutation = useMutation<void, Error, number, { previousData: unknown }>({
    mutationFn: markNotificationRead,
    onMutate: async (notificationId) => {
      // Cancel any outgoing refetches to prevent overwriting optimistic update
      await queryClient.cancelQueries({
        queryKey: messagingKeys.notifications(),
      });
      await queryClient.cancelQueries({
        queryKey: messagingKeys.unreadNotificationCount(),
      });

      // Snapshot the previous values for rollback
      const previousNotifications = queryClient.getQueriesData({
        queryKey: messagingKeys.notifications(),
      });
      const previousCount = queryClient.getQueryData(
        messagingKeys.unreadNotificationCount()
      );

      // Optimistically update notifications cache
      queryClient.setQueriesData<InfiniteData<NotificationListResponse>>(
        { queryKey: messagingKeys.notifications() },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              notifications: page.notifications.map((notification) =>
                notification.id === notificationId
                  ? { ...notification, timeread: Math.floor(Date.now() / 1000) }
                  : notification
              ),
              unreadCount: Math.max(0, page.unreadCount - 1),
            })),
          };
        }
      );

      // Optimistically decrement unread count
      queryClient.setQueryData<number>(
        messagingKeys.unreadNotificationCount(),
        (old) => Math.max(0, (old ?? 1) - 1)
      );

      return { previousData: { previousNotifications, previousCount } };
    },
    onError: (error, notificationId, context) => {
      // Rollback on error
      if (context?.previousData) {
        const { previousNotifications, previousCount } = context.previousData as {
          previousNotifications: Array<[unknown, unknown]>;
          previousCount: number;
        };

        // Restore notifications
        previousNotifications.forEach(([key, value]) => {
          queryClient.setQueryData(key as readonly unknown[], value);
        });

        // Restore count
        queryClient.setQueryData(
          messagingKeys.unreadNotificationCount(),
          previousCount
        );
      }

      onError?.(error, notificationId);
    },
    onSuccess: (_, notificationId) => {
      onSuccess?.(notificationId);
    },
    onSettled: () => {
      // Invalidate to ensure server state is synced
      queryClient.invalidateQueries({
        queryKey: messagingKeys.notifications(),
      });
      queryClient.invalidateQueries({
        queryKey: messagingKeys.unreadNotificationCount(),
      });
    },
  });

  return {
    markAsRead: (notificationId: number) => {
      mutation.mutate(notificationId);
    },
    isLoading: mutation.isPending,
    error: mutation.error ?? null,
    isSuccess: mutation.isSuccess,
  };
}

// ============================================================================
// useMarkAllNotificationsRead Hook
// ============================================================================

/**
 * Custom hook for marking all notifications as read with optimistic updates
 *
 * Provides a mutation function to mark all notifications as read at once.
 * Uses optimistic updates for immediate UI feedback and invalidates the
 * cache on completion.
 *
 * @param params - Configuration parameters for the hook
 * @returns Object containing the mutation function and status states
 *
 * @example
 * ```tsx
 * function NotificationHeader({ unreadCount }: { unreadCount: number }) {
 *   const { markAllAsRead, isLoading } = useMarkAllNotificationsRead({
 *     onSuccess: () => console.log('All notifications marked as read'),
 *     onError: (error) => console.error('Failed:', error)
 *   });
 *
 *   return (
 *     <div>
 *       <h2>Notifications ({unreadCount} unread)</h2>
 *       {unreadCount > 0 && (
 *         <Button
 *           onClick={() => markAllAsRead()}
 *           disabled={isLoading}
 *         >
 *           Mark All as Read
 *         </Button>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export function useMarkAllNotificationsRead(
  params: UseMarkAllNotificationsReadParams = {}
): UseMarkAllNotificationsReadReturn {
  const { onSuccess, onError } = params;
  const queryClient = useQueryClient();

  const mutation = useMutation<void, Error, void, { previousData: unknown }>({
    mutationFn: markAllNotificationsRead,
    onMutate: async () => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({
        queryKey: messagingKeys.notifications(),
      });
      await queryClient.cancelQueries({
        queryKey: messagingKeys.unreadNotificationCount(),
      });

      // Snapshot previous values
      const previousNotifications = queryClient.getQueriesData({
        queryKey: messagingKeys.notifications(),
      });
      const previousCount = queryClient.getQueryData(
        messagingKeys.unreadNotificationCount()
      );

      const currentTime = Math.floor(Date.now() / 1000);

      // Optimistically mark all notifications as read
      queryClient.setQueriesData<InfiniteData<NotificationListResponse>>(
        { queryKey: messagingKeys.notifications() },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              notifications: page.notifications.map((notification) => ({
                ...notification,
                timeread: notification.timeread ?? currentTime,
              })),
              unreadCount: 0,
            })),
          };
        }
      );

      // Set unread count to 0
      queryClient.setQueryData(messagingKeys.unreadNotificationCount(), 0);

      return { previousData: { previousNotifications, previousCount } };
    },
    onError: (error, _, context) => {
      // Rollback on error
      if (context?.previousData) {
        const { previousNotifications, previousCount } = context.previousData as {
          previousNotifications: Array<[unknown, unknown]>;
          previousCount: number;
        };

        previousNotifications.forEach(([key, value]) => {
          queryClient.setQueryData(key as readonly unknown[], value);
        });

        queryClient.setQueryData(
          messagingKeys.unreadNotificationCount(),
          previousCount
        );
      }

      onError?.(error);
    },
    onSuccess: () => {
      onSuccess?.();
    },
    onSettled: () => {
      // Invalidate to ensure server state is synced
      queryClient.invalidateQueries({
        queryKey: messagingKeys.notifications(),
      });
      queryClient.invalidateQueries({
        queryKey: messagingKeys.unreadNotificationCount(),
      });
    },
  });

  return {
    markAllAsRead: () => {
      mutation.mutate();
    },
    isLoading: mutation.isPending,
    error: mutation.error ?? null,
    isSuccess: mutation.isSuccess,
  };
}

// ============================================================================
// useNotificationPreferences Hook
// ============================================================================

/**
 * Custom hook for fetching and updating user notification preferences
 *
 * Provides both read and write access to user notification preferences,
 * including email, push, and in-app notification settings, notification
 * type filters, quiet hours configuration, and muted conversations.
 *
 * @param params - Configuration parameters for the hook
 * @returns Object containing preferences data and update function
 *
 * @example
 * ```tsx
 * function NotificationSettings() {
 *   const {
 *     preferences,
 *     isLoading,
 *     updatePreferences,
 *     isUpdating
 *   } = useNotificationPreferences();
 *
 *   if (isLoading) return <LoadingSpinner />;
 *
 *   return (
 *     <form>
 *       <Switch
 *         checked={preferences?.enableEmail ?? false}
 *         onChange={(e) => updatePreferences({ enableEmail: e.target.checked })}
 *         disabled={isUpdating}
 *       />
 *       Email Notifications
 *
 *       <Switch
 *         checked={preferences?.enablePush ?? false}
 *         onChange={(e) => updatePreferences({ enablePush: e.target.checked })}
 *         disabled={isUpdating}
 *       />
 *       Push Notifications
 *
 *       <TimePicker
 *         label="Quiet Hours Start"
 *         value={preferences?.quietHoursStart}
 *         onChange={(time) => updatePreferences({ quietHoursStart: time })}
 *       />
 *     </form>
 *   );
 * }
 * ```
 */
export function useNotificationPreferences(
  params: UseNotificationPreferencesParams = {}
): UseNotificationPreferencesReturn {
  const { enabled = true } = params;
  const queryClient = useQueryClient();

  // Fetch preferences query
  const {
    data: preferences,
    isLoading,
    error,
    refetch,
  } = useQuery<NotificationPreferences, Error>({
    queryKey: messagingKeys.notificationPreferences(),
    queryFn: getUserNotificationPreferences,
    enabled,
    staleTime: PREFERENCES_STALE_TIME,
  });

  // Update preferences mutation
  const updateMutation = useMutation<
    NotificationPreferences,
    Error,
    Partial<NotificationPreferences>,
    { previousPreferences: NotificationPreferences | undefined }
  >({
    mutationFn: updateUserNotificationPreferences,
    onMutate: async (updates) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: messagingKeys.notificationPreferences(),
      });

      // Snapshot previous value
      const previousPreferences = queryClient.getQueryData<NotificationPreferences>(
        messagingKeys.notificationPreferences()
      );

      // Optimistically update preferences
      if (previousPreferences) {
        queryClient.setQueryData<NotificationPreferences>(
          messagingKeys.notificationPreferences(),
          {
            ...previousPreferences,
            ...updates,
          }
        );
      }

      return { previousPreferences };
    },
    onError: (_, __, context) => {
      // Rollback on error
      if (context?.previousPreferences) {
        queryClient.setQueryData(
          messagingKeys.notificationPreferences(),
          context.previousPreferences
        );
      }
    },
    onSuccess: (updatedPreferences) => {
      // Update cache with server response
      queryClient.setQueryData(
        messagingKeys.notificationPreferences(),
        updatedPreferences
      );
    },
    onSettled: () => {
      // Invalidate to ensure data consistency
      queryClient.invalidateQueries({
        queryKey: messagingKeys.notificationPreferences(),
      });
    },
  });

  return {
    preferences,
    isLoading,
    error: error ?? null,
    updatePreferences: (updates: Partial<NotificationPreferences>) => {
      updateMutation.mutate(updates);
    },
    isUpdating: updateMutation.isPending,
    updateError: updateMutation.error ?? null,
    refetch: () => {
      refetch();
    },
  };
}

// ============================================================================
// Utility Hooks
// ============================================================================

/**
 * Custom hook to invalidate all notification-related queries
 *
 * Useful for triggering a full refresh of notification data after
 * external events (e.g., WebSocket message, push notification).
 *
 * @returns Function to invalidate all notification queries
 *
 * @example
 * ```tsx
 * function NotificationListener() {
 *   const invalidateNotifications = useInvalidateNotifications();
 *
 *   useEffect(() => {
 *     const handlePushNotification = () => {
 *       invalidateNotifications();
 *     };
 *
 *     pushService.on('notification', handlePushNotification);
 *     return () => pushService.off('notification', handlePushNotification);
 *   }, [invalidateNotifications]);
 *
 *   return null;
 * }
 * ```
 */
export function useInvalidateNotifications(): () => void {
  const queryClient = useQueryClient();

  return () => {
    queryClient.invalidateQueries({
      queryKey: messagingKeys.notifications(),
    });
    queryClient.invalidateQueries({
      queryKey: messagingKeys.unreadNotificationCount(),
    });
  };
}

/**
 * Custom hook to prefetch notifications
 *
 * Useful for prefetching notification data before navigation to
 * improve perceived performance.
 *
 * @returns Function to prefetch notifications
 *
 * @example
 * ```tsx
 * function NotificationMenuTrigger() {
 *   const prefetchNotifications = usePrefetchNotifications();
 *
 *   return (
 *     <IconButton
 *       onMouseEnter={() => prefetchNotifications()}
 *       onClick={() => navigate('/notifications')}
 *     >
 *       <NotificationsIcon />
 *     </IconButton>
 *   );
 * }
 * ```
 */
export function usePrefetchNotifications(): () => void {
  const queryClient = useQueryClient();

  return () => {
    queryClient.prefetchInfiniteQuery({
      queryKey: [...messagingKeys.notifications(), { pageSize: DEFAULT_PAGE_SIZE }],
      queryFn: async ({ pageParam }) => {
        return await getNotifications({
          pagination: {
            page: pageParam as number,
            perPage: DEFAULT_PAGE_SIZE,
          },
        });
      },
      initialPageParam: 1,
    });
  };
}

// ============================================================================
// Type Exports for External Usage
// ============================================================================

export type {
  Notification,
  NotificationType,
  NotificationPreferences,
  NotificationFilters,
  NotificationListResponse,
};
