/**
 * Grades Hooks
 *
 * Custom React Query hooks providing access to gradebook data and operations.
 * Wraps the gradebook API functions with convenient hooks for use in components.
 *
 * @module features/gradebook/hooks/useGrades
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryResult,
  type UseMutationResult,
} from '@tanstack/react-query';
import {
  getCourseGrades,
  getUserGrades,
  getGradeItems,
  updateGradeItem,
  getGradeCategories,
  updateGrade,
  exportGrades,
  getGradeReport,
  isSuccessResponse,
} from '../api/gradebookApi';
import {
  AggregationStatus,
} from '../types/grade.types';
import type {
  Grade,
  GradeItem,
  GradeCategory,
  GradeSummary,
} from '../types/grade.types';
import type {
  CourseGrades,
  UserGrades,
  UpdateGradeItemInput,
  ExportOptions,
  GradeReport,
  GetGradeItemsOptions,
} from '../api/gradebookApi';

/**
 * Query key factory for gradebook-related queries
 * Ensures consistent cache keys across the application
 */
export const gradebookKeys = {
  all: ['gradebook'] as const,
  courseGrades: () => [...gradebookKeys.all, 'courseGrades'] as const,
  courseGrade: (courseId: number, userIds?: number[]) =>
    [...gradebookKeys.courseGrades(), courseId, userIds] as const,
  userGrades: () => [...gradebookKeys.all, 'userGrades'] as const,
  userGrade: (userId: number, courseIds?: number[]) =>
    [...gradebookKeys.userGrades(), userId, courseIds] as const,
  gradeItems: () => [...gradebookKeys.all, 'gradeItems'] as const,
  gradeItem: (options: GetGradeItemsOptions) =>
    [...gradebookKeys.gradeItems(), options] as const,
  categories: () => [...gradebookKeys.all, 'categories'] as const,
  category: (courseId: number) => [...gradebookKeys.categories(), courseId] as const,
  reports: () => [...gradebookKeys.all, 'reports'] as const,
  report: (courseId: number, userId?: number, reportType?: string) =>
    [...gradebookKeys.reports(), courseId, userId, reportType] as const,
};

/**
 * Options for gradebook query hooks
 */
export interface UseGradebookOptions {
  /**
   * Whether to fetch data on mount
   * @default true
   */
  enabled?: boolean;

  /**
   * Stale time in milliseconds
   * @default 5 minutes
   */
  staleTime?: number;

  /**
   * Cache time in milliseconds (gcTime in React Query v5)
   * @default 10 minutes
   */
  cacheTime?: number;

  /**
   * Whether to refetch on window focus
   * @default false
   */
  refetchOnWindowFocus?: boolean;
}

/**
 * Hook for fetching course grades
 *
 * Uses React Query to manage server state with automatic caching and updates.
 * Wraps existing Moodle grade_get_course_grades() function via API.
 *
 * @param courseId - ID of course to fetch grades for
 * @param userIds - Optional array of user IDs to filter by
 * @param options - Query options
 * @returns Query result with course grades data
 *
 * @example
 * ```tsx
 * function CourseGradesView({ courseId }: { courseId: number }) {
 *   const { data, isLoading, error } = useCourseGrades(courseId);
 *
 *   if (isLoading) return <LoadingSpinner />;
 *   if (error) return <ErrorMessage error={error} />;
 *
 *   return <GradeTable grades={data} />;
 * }
 * ```
 */
export function useCourseGrades(
  courseId: number,
  userIds?: number[],
  options: UseGradebookOptions = {}
): UseQueryResult<CourseGrades, Error> {
  const { enabled = true, staleTime, cacheTime, refetchOnWindowFocus } = options;

  return useQuery<CourseGrades, Error>({
    queryKey: gradebookKeys.courseGrade(courseId, userIds),
    queryFn: async () => {
      const response = await getCourseGrades(courseId, userIds);
      if (isSuccessResponse(response)) {
        return response.data;
      }
      throw new Error(response.error.message);
    },
    enabled: enabled && courseId > 0,
    staleTime: staleTime ?? 5 * 60 * 1000, // 5 minutes
    gcTime: cacheTime ?? 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: refetchOnWindowFocus ?? false,
  });
}

/**
 * Hook for fetching user grades across courses
 *
 * Uses React Query to manage server state with automatic caching and updates.
 * Wraps existing Moodle grade_get_course_grade() function via API.
 *
 * @param userId - ID of user to fetch grades for
 * @param courseIds - Optional array of course IDs to filter by
 * @param options - Query options
 * @returns Query result with user grades data
 *
 * @example
 * ```tsx
 * function StudentGrades({ userId }: { userId: number }) {
 *   const { data, isLoading, error } = useUserGrades(userId);
 *
 *   if (isLoading) return <LoadingSpinner />;
 *   if (error) return <ErrorMessage error={error} />;
 *
 *   return <GradeList grades={data.grades} />;
 * }
 * ```
 */
export function useUserGrades(
  userId: number,
  courseIds?: number[],
  options: UseGradebookOptions = {}
): UseQueryResult<UserGrades, Error> {
  const { enabled = true, staleTime, cacheTime, refetchOnWindowFocus } = options;

  return useQuery<UserGrades, Error>({
    queryKey: gradebookKeys.userGrade(userId, courseIds),
    queryFn: async () => {
      const response = await getUserGrades(userId, courseIds);
      if (isSuccessResponse(response)) {
        return response.data;
      }
      throw new Error(response.error.message);
    },
    enabled: enabled && userId > 0,
    staleTime: staleTime ?? 5 * 60 * 1000,
    gcTime: cacheTime ?? 10 * 60 * 1000,
    refetchOnWindowFocus: refetchOnWindowFocus ?? false,
  });
}

/**
 * Hook for fetching grade items
 *
 * Uses React Query to manage server state with automatic caching and updates.
 * Wraps existing Moodle grade_get_grade_items_for_activity() function via API.
 *
 * @param options - Grade items query options (courseId, cmId, onlyMain)
 * @param queryOptions - React Query options
 * @returns Query result with grade items array
 *
 * @example
 * ```tsx
 * function GradeItemsList({ courseId }: { courseId: number }) {
 *   const { data, isLoading } = useGradeItems({ courseId });
 *
 *   if (isLoading) return <LoadingSpinner />;
 *
 *   return (
 *     <ul>
 *       {data?.map(item => <li key={item.id}>{item.itemname}</li>)}
 *     </ul>
 *   );
 * }
 * ```
 */
export function useGradeItems(
  itemOptions: GetGradeItemsOptions,
  queryOptions: UseGradebookOptions = {}
): UseQueryResult<GradeItem[], Error> {
  const { enabled = true, staleTime, cacheTime, refetchOnWindowFocus } = queryOptions;

  return useQuery<GradeItem[], Error>({
    queryKey: gradebookKeys.gradeItem(itemOptions),
    queryFn: async () => {
      const response = await getGradeItems(itemOptions);
      if (isSuccessResponse(response)) {
        return response.data;
      }
      throw new Error(response.error.message);
    },
    enabled: enabled && (itemOptions.courseId !== undefined || itemOptions.cmId !== undefined),
    staleTime: staleTime ?? 5 * 60 * 1000,
    gcTime: cacheTime ?? 10 * 60 * 1000,
    refetchOnWindowFocus: refetchOnWindowFocus ?? false,
  });
}

/**
 * Hook for fetching grade categories
 *
 * Uses React Query to manage server state with automatic caching and updates.
 * Wraps existing Moodle get_grade_tree() function via API.
 *
 * @param courseId - ID of course to fetch categories for
 * @param options - Query options
 * @returns Query result with grade categories array
 *
 * @example
 * ```tsx
 * function GradeCategoryTree({ courseId }: { courseId: number }) {
 *   const { data, isLoading } = useGradeCategories(courseId);
 *
 *   if (isLoading) return <LoadingSpinner />;
 *
 *   return <CategoryTree categories={data} />;
 * }
 * ```
 */
export function useGradeCategories(
  courseId: number,
  options: UseGradebookOptions = {}
): UseQueryResult<GradeCategory[], Error> {
  const { enabled = true, staleTime, cacheTime, refetchOnWindowFocus } = options;

  return useQuery<GradeCategory[], Error>({
    queryKey: gradebookKeys.category(courseId),
    queryFn: async () => {
      const response = await getGradeCategories(courseId);
      if (isSuccessResponse(response)) {
        return response.data;
      }
      throw new Error(response.error.message);
    },
    enabled: enabled && courseId > 0,
    staleTime: staleTime ?? 5 * 60 * 1000,
    gcTime: cacheTime ?? 10 * 60 * 1000,
    refetchOnWindowFocus: refetchOnWindowFocus ?? false,
  });
}

/**
 * Hook for fetching grade reports
 *
 * Uses React Query to manage server state with automatic caching and updates.
 * Wraps grade report generation from the API.
 *
 * @param courseId - ID of course to fetch report for
 * @param userId - Optional user ID for user-specific reports
 * @param reportType - Type of report ('user', 'grader', 'overview')
 * @param options - Query options
 * @returns Query result with grade report data
 *
 * @example
 * ```tsx
 * function GradeReportView({ courseId, userId }: Props) {
 *   const { data, isLoading } = useGradeReport(courseId, userId, 'user');
 *
 *   if (isLoading) return <LoadingSpinner />;
 *
 *   return <ReportTable data={data} />;
 * }
 * ```
 */
export function useGradeReport(
  courseId: number,
  userId?: number,
  reportType?: 'user' | 'grader' | 'overview',
  options: UseGradebookOptions = {}
): UseQueryResult<GradeReport, Error> {
  const { enabled = true, staleTime, cacheTime, refetchOnWindowFocus } = options;

  return useQuery<GradeReport, Error>({
    queryKey: gradebookKeys.report(courseId, userId, reportType),
    queryFn: async () => {
      const response = await getGradeReport(courseId, userId, reportType);
      if (isSuccessResponse(response)) {
        return response.data;
      }
      throw new Error(response.error.message);
    },
    enabled: enabled && courseId > 0,
    staleTime: staleTime ?? 5 * 60 * 1000,
    gcTime: cacheTime ?? 10 * 60 * 1000,
    refetchOnWindowFocus: refetchOnWindowFocus ?? false,
  });
}

/**
 * Hook for updating a grade item
 *
 * Uses React Query mutation with cache invalidation.
 * Wraps existing Moodle grade_update() function via API.
 *
 * @returns Mutation result with update function
 *
 * @example
 * ```tsx
 * function EditGradeItem({ item }: { item: GradeItem }) {
 *   const { mutate: updateItem, isPending } = useUpdateGradeItem();
 *
 *   const handleSave = (data: UpdateGradeItemInput) => {
 *     updateItem({ itemId: item.id, data });
 *   };
 *
 *   return <GradeItemForm onSubmit={handleSave} isLoading={isPending} />;
 * }
 * ```
 */
export function useUpdateGradeItem(): UseMutationResult<
  GradeItem,
  Error,
  { itemId: number; data: UpdateGradeItemInput }
> {
  const queryClient = useQueryClient();

  return useMutation<GradeItem, Error, { itemId: number; data: UpdateGradeItemInput }>({
    mutationFn: async ({ itemId, data }) => {
      const response = await updateGradeItem(itemId, data);
      if (isSuccessResponse(response)) {
        return response.data;
      }
      throw new Error(response.error.message);
    },
    onSuccess: () => {
      // Invalidate all grade-related queries to refresh data
      void queryClient.invalidateQueries({ queryKey: gradebookKeys.all });
    },
  });
}

/**
 * Hook for updating an individual grade
 *
 * Uses React Query mutation with cache invalidation.
 * Updates student grade for a grade item.
 *
 * @returns Mutation result with update function
 *
 * @example
 * ```tsx
 * function GradeEditor({ gradeId }: { gradeId: number }) {
 *   const { mutate: updateGradeValue, isPending } = useUpdateGrade();
 *
 *   const handleGradeChange = (value: number, feedback?: string) => {
 *     updateGradeValue({ gradeId, grade: value, feedback });
 *   };
 *
 *   return <GradeInput onChange={handleGradeChange} isLoading={isPending} />;
 * }
 * ```
 */
export function useUpdateGrade(): UseMutationResult<
  Grade,
  Error,
  { gradeId: number; grade: number | null; feedback?: string }
> {
  const queryClient = useQueryClient();

  return useMutation<Grade, Error, { gradeId: number; grade: number | null; feedback?: string }>({
    mutationFn: async ({ gradeId, grade, feedback }) => {
      const response = await updateGrade(gradeId, grade, feedback);
      if (isSuccessResponse(response)) {
        return response.data;
      }
      throw new Error(response.error.message);
    },
    onSuccess: () => {
      // Invalidate grade queries to refresh data
      void queryClient.invalidateQueries({ queryKey: gradebookKeys.all });
    },
  });
}

/**
 * Hook for exporting grades
 *
 * Uses React Query mutation for export operations.
 * Wraps grade export functionality from the API.
 *
 * @returns Mutation result with export function
 *
 * @example
 * ```tsx
 * function ExportGradesButton({ courseId }: { courseId: number }) {
 *   const { mutate: exportGrades, isPending } = useExportGrades();
 *
 *   const handleExport = () => {
 *     exportGrades({ courseId, format: 'csv' }, {
 *       onSuccess: (result) => {
 *         if (result.url) {
 *           window.open(result.url);
 *         }
 *       }
 *     });
 *   };
 *
 *   return <Button onClick={handleExport} loading={isPending}>Export</Button>;
 * }
 * ```
 */
export function useExportGrades(): UseMutationResult<
  { url?: string; data?: string; filename: string },
  Error,
  { courseId: number; format: 'csv' | 'xlsx' | 'ods' | 'txt'; options?: ExportOptions }
> {
  return useMutation<
    { url?: string; data?: string; filename: string },
    Error,
    { courseId: number; format: 'csv' | 'xlsx' | 'ods' | 'txt'; options?: ExportOptions }
  >({
    mutationFn: async ({ courseId, format, options }) => {
      const response = await exportGrades(courseId, format, options);
      if (isSuccessResponse(response)) {
        return response.data;
      }
      throw new Error(response.error.message);
    },
  });
}

/**
 * Hook to fetch grades for the current authenticated user
 *
 * This is a convenience hook that should be used with user ID from auth context.
 * Components should use useUserGrades directly with the user ID.
 *
 * @param userId - User ID from authentication context
 * @param courseIds - Optional array of course IDs to filter by
 * @param options - Query options
 * @returns Query result with current user's grades
 *
 * @example
 * ```tsx
 * function MyGrades() {
 *   const { user } = useAuth();
 *   const { data, isLoading } = useMyGrades(user?.id);
 *
 *   if (isLoading) return <LoadingSpinner />;
 *   return <GradeList grades={data?.grades} />;
 * }
 * ```
 */
export function useMyGrades(
  userId?: number,
  courseIds?: number[],
  options: UseGradebookOptions = {}
): UseQueryResult<UserGrades, Error> {
  return useUserGrades(userId ?? 0, courseIds, {
    ...options,
    enabled: options.enabled !== false && userId !== undefined && userId > 0,
  });
}

/**
 * Interface for student course grades view
 * Provides data in the format expected by StudentGradebookPage
 */
export interface StudentCourseGradesData {
  /** Course name */
  courseName: string;
  /** Course ID */
  courseId: number;
  /** Array of grade summaries for the student (using GradeSummary from grade.types) */
  userGrades: GradeSummary[];
  /** Course total information */
  courseTotal?: {
    finalgrade: number | null;
    percentage: number | null;
    lettergrade: string | null;
  };
}

/**
 * Hook for fetching student's grades in a course
 *
 * Transforms API response to the format expected by StudentGradebookPage.
 * Uses grade report API with 'user' report type.
 *
 * @param courseId - ID of course to fetch grades for
 * @param userId - Optional user ID (defaults to current user via API)
 * @param options - Query options
 * @returns Query result with student course grades data
 *
 * @example
 * ```tsx
 * function StudentGrades({ courseId }: { courseId: number }) {
 *   const { data, isLoading, error } = useStudentCourseGrades(courseId);
 *
 *   if (isLoading) return <LoadingSpinner />;
 *   if (error) return <ErrorMessage error={error} />;
 *
 *   return (
 *     <div>
 *       <h1>{data?.courseName}</h1>
 *       <GradeList grades={data?.userGrades} />
 *     </div>
 *   );
 * }
 * ```
 */
export function useStudentCourseGrades(
  courseId: number,
  userId?: number,
  options: UseGradebookOptions = {}
): UseQueryResult<StudentCourseGradesData, Error> {
  const { enabled = true, staleTime, cacheTime, refetchOnWindowFocus } = options;

  return useQuery<StudentCourseGradesData, Error>({
    queryKey: [...gradebookKeys.reports(), 'studentCourse', courseId, userId],
    queryFn: async () => {
      const response = await getGradeReport(courseId, userId, 'user');
      if (isSuccessResponse(response)) {
        const report = response.data;
        
        // Transform GradeReport to StudentCourseGradesData with proper GradeSummary type
        const userGrades: GradeSummary[] = report.rows.map((row, index) => {
          // Build parent categories array from category string
          const categoryStr = row.category ? String(row.category) : null;
          const parentcategories: string[] = categoryStr ? [categoryStr] : [];
          
          // Parse aggregation status from row data
          let aggregationstatus: AggregationStatus = AggregationStatus.UNKNOWN;
          if (row.aggregationstatus) {
            const statusStr = String(row.aggregationstatus).toLowerCase();
            if (statusStr === 'dropped') {aggregationstatus = AggregationStatus.DROPPED;}
            else if (statusStr === 'novalue') {aggregationstatus = AggregationStatus.NOVALUE;}
            else if (statusStr === 'used') {aggregationstatus = AggregationStatus.USED;}
            else if (statusStr === 'extra') {aggregationstatus = AggregationStatus.EXTRA;}
            else if (statusStr === 'excluded') {aggregationstatus = AggregationStatus.EXCLUDED;}
          }
          
          return {
            id: typeof row.id === 'number' ? row.id : index,
            itemname: String(row.itemname ?? row.name ?? `Item ${index + 1}`),
            category: categoryStr,
            grade: typeof row.grade === 'number' ? row.grade : null,
            lettergrade: row.lettergrade ? String(row.lettergrade) : null,
            percentage: typeof row.percentage === 'number' ? row.percentage : null,
            range: row.range ? String(row.range) : '0-100',
            grademax: typeof row.grademax === 'number' ? row.grademax : 100,
            grademin: typeof row.grademin === 'number' ? row.grademin : 0,
            feedback: row.feedback ? String(row.feedback) : null,
            weight: typeof row.weight === 'number' ? row.weight : null,
            contributiontocoursetotal: typeof row.contributiontocoursetotal === 'number' 
              ? row.contributiontocoursetotal 
              : null,
            hidden: Boolean(row.hidden),
            locked: Boolean(row.locked),
            timemodified: typeof row.timemodified === 'number' ? row.timemodified : undefined,
            rank: typeof row.rank === 'number' ? row.rank : null,
            average: typeof row.average === 'number' ? row.average : null,
            // Additional required GradeSummary properties
            parentcategories,
            overridden: Boolean(row.overridden),
            excluded: Boolean(row.excluded),
            aggregationstatus,
          };
        });

        return {
          courseName: report.summary?.courseName ? String(report.summary.courseName) : `Course ${courseId}`,
          courseId,
          userGrades,
          courseTotal: report.summary ? {
            finalgrade: report.summary.courseTotal ?? null,
            percentage: typeof report.summary.averageGrade === 'number' 
              ? report.summary.averageGrade 
              : null,
            lettergrade: null, // Could be added if available in summary
          } : undefined,
        };
      }
      throw new Error(response.error.message);
    },
    enabled: enabled && courseId > 0,
    staleTime: staleTime ?? 5 * 60 * 1000,
    gcTime: cacheTime ?? 10 * 60 * 1000,
    refetchOnWindowFocus: refetchOnWindowFocus ?? false,
  });
}
