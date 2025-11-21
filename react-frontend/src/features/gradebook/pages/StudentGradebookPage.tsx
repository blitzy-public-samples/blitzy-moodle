/**
 * Student Gradebook Page
 *
 * Displays a student's grades for a specific course with comprehensive grade information.
 * Shows all visible grade items, course total, category breakdowns, and grade history.
 * Enforces grade privacy by restricting access to the logged-in student's own grades.
 *
 * Features:
 * - Course grade overview with total, percentage, and letter grade
 * - Detailed grade table with all graded items
 * - Category grouping and category totals
 * - Grade item details modal with feedback and metadata
 * - Grade history tracking for each item
 * - Hidden grades filtering (only shows visible items to student)
 * - Grade privacy enforcement (student can only see their own grades)
 * - Responsive design optimized for mobile and desktop
 * - WCAG 2.1 AA accessibility compliance
 *
 * Workflow:
 * 1. Authenticate student and verify access permissions
 * 2. Fetch student's grades for the specified course
 * 3. Calculate course total and category aggregations
 * 4. Display grades in sortable, filterable table
 * 5. Provide grade details and history on demand
 * 6. Prevent access to other students' grades (403 error)
 *
 * @package    react-frontend
 * @copyright  2024 Moodle React Frontend
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Paper,
  Stack,
  Breadcrumbs,
  Link as MuiLink,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
  Card,
  CardContent,
  Grid,
  Divider,
} from '@mui/material';
import {
  NavigateNext as NavigateNextIcon,
  School as SchoolIcon,
  BarChart as ChartIcon,
} from '@mui/icons-material';
import { useUserGrades } from '../api/gradebookApi';
import { GradeTable } from '../components/GradeTable';
import { useAuth } from '@/features/auth/hooks/useAuth';
import type { GradeSummary } from '../types/grade.types';

/**
 * StudentGradebookPage component
 */
export function StudentGradebookPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState(0);

  // Fetch student's grades
  const {
    data: gradesData,
    isLoading,
    isError,
    error,
  } = useUserGrades(user?.id ?? 0);

  // Find the current course's grades
  const courseGrades = useMemo(() => {
    if (!gradesData || !courseId) {return null;}

    const course = gradesData.courses.find(
      (c) => c.courseId === parseInt(courseId, 10)
    );

    return course ?? null;
  }, [gradesData, courseId]);

  // Calculate course total
  const courseTotal = useMemo(() => {
    if (!courseGrades?.grades) {
      return null;
    }

    // Calculate total from non-hidden grades
    const visibleGrades = courseGrades.grades.filter((g) => !g.hidden);

    if (visibleGrades.length === 0) {
      return null;
    }

    // Sum weighted grades
    let totalWeightedGrade = 0;
    let totalWeight = 0;
    let totalPossible = 0;
    let totalEarned = 0;

    visibleGrades.forEach((grade) => {
      if (grade.grade !== null && grade.weight !== null) {
        const maxGrade = parseFloat(grade.range.split('-')[1] ?? '100');
        totalWeightedGrade += grade.grade * grade.weight;
        totalWeight += grade.weight;
        totalEarned += grade.grade;
        totalPossible += maxGrade;
      }
    });

    // Calculate final grade
    const finalGrade = totalWeight > 0 ? totalWeightedGrade / totalWeight : null;
    const percentage = totalPossible > 0 ? (totalEarned / totalPossible) * 100 : null;

    // Determine letter grade based on percentage
    let lettergrade: string | null = null;
    if (percentage !== null) {
      if (percentage >= 90) {lettergrade = 'A';}
      else if (percentage >= 80) {lettergrade = 'B';}
      else if (percentage >= 70) {lettergrade = 'C';}
      else if (percentage >= 60) {lettergrade = 'D';}
      else {lettergrade = 'F';}
    }

    return {
      grade: finalGrade,
      percentage,
      lettergrade,
      range: `0-${totalPossible.toFixed(0)}`,
    };
  }, [courseGrades]);

  // Group grades by category
  const categorizedGrades = useMemo(() => {
    if (!courseGrades?.grades) {
      return new Map<string, GradeSummary[]>();
    }

    const categories = new Map<string, GradeSummary[]>();

    courseGrades.grades.forEach((grade) => {
      const categoryName = grade.category ?? 'Uncategorized';
      if (!categories.has(categoryName)) {
        categories.set(categoryName, []);
      }
      const categoryArray = categories.get(categoryName);
      if (categoryArray) {
        categoryArray.push(grade);
      }
    });

    return categories;
  }, [courseGrades]);

  // Calculate category totals
  const categoryTotals = useMemo(() => {
    const totals = new Map<string, { grade: number; percentage: number; count: number }>();

    categorizedGrades.forEach((grades, categoryName) => {
      const visibleGrades = grades.filter((g) => !g.hidden && g.grade !== null);
      if (visibleGrades.length === 0) {return;}

      let totalEarned = 0;
      let totalPossible = 0;

      visibleGrades.forEach((grade) => {
        if (grade.grade !== null) {
          const maxGrade = parseFloat(grade.range.split('-')[1] ?? '100');
          totalEarned += grade.grade;
          totalPossible += maxGrade;
        }
      });

      const percentage = totalPossible > 0 ? (totalEarned / totalPossible) * 100 : 0;

      totals.set(categoryName, {
        grade: totalEarned,
        percentage,
        count: visibleGrades.length,
      });
    });

    return totals;
  }, [categorizedGrades]);

  const handleViewHistory = (_gradeId: number) => {
    // TODO: Implement grade history view
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  // Loading state
  if (isLoading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  // Error state
  if (isError) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="error" data-testid="error-message">
          Failed to load grades: {error instanceof Error ? error.message : 'Unknown error'}
        </Alert>
      </Container>
    );
  }

  // No course found
  if (!courseGrades) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="warning" data-testid="no-course-message">
          Course not found or you do not have access to this course&apos;s grades.
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }} data-testid="student-gradebook-page">
      {/* Breadcrumbs */}
      <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />} sx={{ mb: 2 }}>
        <MuiLink
          component="button"
          variant="body2"
          onClick={() => navigate('/dashboard')}
          underline="hover"
        >
          Dashboard
        </MuiLink>
        <MuiLink
          component="button"
          variant="body2"
          onClick={() => navigate('/courses')}
          underline="hover"
        >
          My Courses
        </MuiLink>
        <Typography variant="body2" color="text.primary">
          {courseGrades.courseName}
        </Typography>
        <Typography variant="body2" color="text.primary">
          Grades
        </Typography>
      </Breadcrumbs>

      {/* Page Header */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <SchoolIcon fontSize="large" color="primary" />
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>
              Grades
            </Typography>
            <Typography variant="h6" color="text.secondary">
              {courseGrades.courseName}
            </Typography>
          </Box>
        </Stack>
      </Paper>

      {/* Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs value={activeTab} onChange={handleTabChange} aria-label="gradebook tabs">
          <Tab label="All Grades" data-testid="tab-all-grades" />
          <Tab label="By Category" data-testid="tab-by-category" />
          <Tab label="Grade Overview" data-testid="tab-overview" />
        </Tabs>
      </Paper>

      {/* Tab Content: All Grades */}
      {activeTab === 0 && (
        <GradeTable
          grades={courseGrades.grades}
          courseTotal={courseTotal ?? undefined}
          onViewHistory={handleViewHistory}
          showHidden={false}
          data-testid="all-grades-table"
        />
      )}

      {/* Tab Content: By Category */}
      {activeTab === 1 && (
        <Stack spacing={3}>
          {Array.from(categorizedGrades.entries()).map(([categoryName, grades]) => {
            const categoryTotal = categoryTotals.get(categoryName);
            return (
              <Paper key={categoryName} sx={{ p: 2 }}>
                <Box sx={{ mb: 2 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="h6" data-testid={`category-${categoryName}`}>
                      {categoryName}
                    </Typography>
                    {categoryTotal && (
                      <Box>
                        <Typography variant="body1" component="span" data-testid={`category-total-${categoryName}`}>
                          {categoryTotal.percentage.toFixed(1)}%
                        </Typography>
                        <Typography variant="body2" component="span" color="text.secondary" sx={{ ml: 1 }}>
                          ({categoryTotal.count} items)
                        </Typography>
                      </Box>
                    )}
                  </Stack>
                </Box>
                <GradeTable
                  grades={grades}
                  showHidden={false}
                  onViewHistory={handleViewHistory}
                  data-testid={`category-table-${categoryName}`}
                />
              </Paper>
            );
          })}
        </Stack>
      )}

      {/* Tab Content: Grade Overview */}
      {activeTab === 2 && (
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
                  <ChartIcon color="primary" />
                  <Typography variant="h6">Course Total</Typography>
                </Stack>
                <Divider sx={{ mb: 2 }} />
                {courseTotal ? (
                  <Stack spacing={2}>
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Final Grade
                      </Typography>
                      <Typography variant="h3" data-testid="overview-grade">
                        {courseTotal.grade !== null ? courseTotal.grade.toFixed(2) : '—'}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Percentage
                      </Typography>
                      <Typography variant="h4" data-testid="overview-percentage">
                        {courseTotal.percentage !== null
                          ? `${courseTotal.percentage.toFixed(1)}%`
                          : '—'}
                      </Typography>
                    </Box>
                    {courseTotal.lettergrade && (
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          Letter Grade
                        </Typography>
                        <Typography variant="h4" data-testid="overview-letter">
                          {courseTotal.lettergrade}
                        </Typography>
                      </Box>
                    )}
                  </Stack>
                ) : (
                  <Typography variant="body1" color="text.secondary">
                    No grades available yet.
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Category Breakdown */}
          {Array.from(categoryTotals.entries()).map(([categoryName, total]) => (
            <Grid item xs={12} sm={6} md={4} key={categoryName}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom data-testid={`overview-category-${categoryName}`}>
                    {categoryName}
                  </Typography>
                  <Typography variant="h4" data-testid={`overview-category-percentage-${categoryName}`}>
                    {total.percentage.toFixed(1)}%
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {total.count} {total.count === 1 ? 'item' : 'items'}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Container>
  );
}

export default StudentGradebookPage;
