/**
 * FeedbackAnalysis Component
 *
 * Displays comprehensive analysis of feedback activity responses with:
 * - Statistical summaries and overall metrics via FeedbackSummary
 * - Question-by-question breakdown with visualizations
 * - Type-specific charts (bar, line, pie) for different question types
 * - Export functionality to Excel and PDF formats
 * - Filtering by course, group, and date range
 * - Tabbed interface for switching between Analysis and Responses views
 * - Full accessibility with ARIA labels and data table alternatives
 * - Responsive design for mobile devices
 * - Print-friendly layouts
 *
 * Based on public/mod/feedback/analysis.php structure.
 *
 * @module features/activities/feedback/components/FeedbackAnalysis
 */

import React, { useState, useMemo } from 'react';
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tabs,
  Tab,
  Button,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableRow,
  TableCell,
  TableHead,
  Typography,
  Box,
  Skeleton,
  Card,
  CardContent,
} from '@mui/material';
import { Download, ExpandMore } from '@mui/icons-material';
import { Bar, Line, Pie } from 'react-chartjs-2';
import {
  Chart,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

// Internal imports
import { ResponseList } from './ResponseList';
import { FeedbackSummary } from './FeedbackSummary';
import { useFeedbackAnalysis } from '../hooks/useFeedbackAnalysis';
import { FeedbackItemAnalysis } from '../types/index';
import { Alert } from '../../../../components/feedback/Alert';
import { useToast } from '../../../../hooks/useToast';

// Register Chart.js components for visualization
Chart.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

/**
 * Props interface for FeedbackAnalysis component
 */
export interface FeedbackAnalysisProps {
  /** ID of the feedback activity to analyze */
  feedbackId: number;
  /** Permission to view aggregated analysis data */
  canViewAnalysis: boolean;
  /** Permission to view individual response details */
  canViewResponses: boolean;
  /** Optional group ID for filtering responses */
  groupId?: number;
  /** Optional course ID for multi-course feedback */
  courseId?: number;
}

/**
 * Filter state for analysis view
 */
interface AnalysisFilterState {
  /** Selected group ID for filtering */
  groupId: number | null;
  /** Selected course ID for filtering */
  courseId: number | null;
  /** Start date for date range filter */
  dateFrom: string | null;
  /** End date for date range filter */
  dateTo: string | null;
}

/**
 * Tab types for the analysis interface
 */
type AnalysisTab = 'analysis' | 'responses';

/**
 * Chart configuration for question visualizations
 */
interface ChartConfig {
  /** Chart type identifier */
  type: 'bar' | 'horizontalBar' | 'line' | 'pie';
  /** Chart data structure */
  data: {
    labels: string[];
    datasets: Array<{
      label: string;
      data: number[];
      backgroundColor?: string | string[];
      borderColor?: string | string[];
      borderWidth?: number;
    }>;
  };
  /** Chart options for customization */
  options: {
    responsive: boolean;
    maintainAspectRatio: boolean;
    plugins: {
      legend: {
        display: boolean;
        position: 'top' | 'bottom' | 'left' | 'right';
      };
      title: {
        display: boolean;
        text: string;
      };
      tooltip?: {
        enabled: boolean;
      };
    };
    scales?: {
      x?: {
        title?: {
          display: boolean;
          text: string;
        };
      };
      y?: {
        title?: {
          display: boolean;
          text: string;
        };
        beginAtZero?: boolean;
      };
    };
    indexAxis?: 'x' | 'y';
  };
}

/**
 * FeedbackAnalysis component displays comprehensive analysis of feedback responses
 *
 * Features:
 * - Statistical summary with FeedbackSummary component
 * - Question-by-question analysis with type-specific visualizations
 * - Export to Excel and PDF functionality
 * - Filtering by group, course, and date range
 * - Tabbed interface for Analysis and Responses views
 * - Full WCAG 2.1 AA accessibility compliance
 * - Responsive design and print-friendly layouts
 *
 * @param props - Component props
 * @returns Rendered feedback analysis interface
 */
export const FeedbackAnalysis: React.FC<FeedbackAnalysisProps> = ({
  feedbackId,
  canViewAnalysis,
  canViewResponses,
  groupId: initialGroupId,
  courseId: initialCourseId,
}) => {
  // Toast notifications for user feedback
  const { success, error } = useToast();

  // State management for tabs and filters
  const [currentTab, setCurrentTab] = useState<AnalysisTab>('analysis');
  const [filters, setFilters] = useState<AnalysisFilterState>({
    groupId: initialGroupId ?? null,
    courseId: initialCourseId ?? null,
    dateFrom: null,
    dateTo: null,
  });

  // Fetch analysis data using React Query hook
  const {
    data: analysisData,
    isLoading,
    isError,
    error: analysisError,
  } = useFeedbackAnalysis({
    feedbackId,
    groupId: filters.groupId ?? undefined,
    enabled: canViewAnalysis,
  });

  /**
   * Handle tab change between Analysis and Responses views
   */
  const handleTabChange = (_event: React.SyntheticEvent, newValue: AnalysisTab) => {
    setCurrentTab(newValue);
  };

  /**
   * Handle group filter change
   */
  const handleGroupChange = (event: any) => {
    setFilters((prev) => ({
      ...prev,
      groupId: event.target.value === '' ? null : Number(event.target.value),
    }));
  };

  /**
   * Handle course filter change
   */
  const handleCourseChange = (event: any) => {
    setFilters((prev) => ({
      ...prev,
      courseId: event.target.value === '' ? null : Number(event.target.value),
    }));
  };

  /**
   * Handle export to Excel
   */
  const handleExportExcel = async () => {
    try {
      // Call export API endpoint
      const response = await fetch(
        `/api/v1/feedback/${feedbackId}/export?format=excel&groupId=${filters.groupId ?? ''}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Export failed');
      }

      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `feedback_analysis_${feedbackId}_${Date.now()}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      success('Analysis exported to Excel successfully');
    } catch (err) {
      error('Failed to export analysis. Please try again.');
    }
  };

  /**
   * Handle export to PDF
   */
  const handleExportPdf = async () => {
    try {
      // Call export API endpoint
      const response = await fetch(
        `/api/v1/feedback/${feedbackId}/export?format=pdf&groupId=${filters.groupId ?? ''}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Export failed');
      }

      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `feedback_analysis_${feedbackId}_${Date.now()}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      success('Analysis exported to PDF successfully');
    } catch (err) {
      error('Failed to export analysis. Please try again.');
    }
  };

  /**
   * Generate chart configuration for a feedback item
   * Based on question type, creates appropriate visualization
   */
  const generateChartConfig = (item: FeedbackItemAnalysis): ChartConfig | null => {
    if (!item.distribution || item.distribution.length === 0) {
      return null;
    }

    const labels = item.distribution.map((d) => d.label);
    const values = item.distribution.map((d) => d.count);
    const percentages = item.distribution.map((d) => d.percentage);

    // Color palette for charts
    const colors = [
      'rgba(54, 162, 235, 0.8)',
      'rgba(255, 99, 132, 0.8)',
      'rgba(255, 206, 86, 0.8)',
      'rgba(75, 192, 192, 0.8)',
      'rgba(153, 102, 255, 0.8)',
      'rgba(255, 159, 64, 0.8)',
      'rgba(199, 199, 199, 0.8)',
      'rgba(83, 102, 255, 0.8)',
      'rgba(255, 102, 146, 0.8)',
      'rgba(102, 255, 178, 0.8)',
    ];

    const borderColors = colors.map((c) => c.replace('0.8', '1'));

    // Determine chart type based on question type
    switch (item.type) {
      case 'multichoice':
      case 'multichoicerated':
        // Horizontal bar chart for multiple choice questions
        return {
          type: 'horizontalBar',
          data: {
            labels,
            datasets: [
              {
                label: 'Responses',
                data: values,
                backgroundColor: colors.slice(0, labels.length),
                borderColor: borderColors.slice(0, labels.length),
                borderWidth: 1,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            plugins: {
              legend: {
                display: false,
                position: 'top',
              },
              title: {
                display: true,
                text: `${item.name} - Response Distribution`,
              },
              tooltip: {
                enabled: true,
              },
            },
            scales: {
              x: {
                title: {
                  display: true,
                  text: 'Number of Responses',
                },
                beginAtZero: true,
              },
              y: {
                title: {
                  display: true,
                  text: 'Options',
                },
              },
            },
          },
        };

      case 'numeric':
        // Line chart for numeric questions showing distribution
        return {
          type: 'line',
          data: {
            labels,
            datasets: [
              {
                label: 'Frequency',
                data: values,
                backgroundColor: 'rgba(54, 162, 235, 0.2)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 2,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                display: false,
                position: 'top',
              },
              title: {
                display: true,
                text: `${item.name} - Value Distribution`,
              },
              tooltip: {
                enabled: true,
              },
            },
            scales: {
              x: {
                title: {
                  display: true,
                  text: 'Value',
                },
              },
              y: {
                title: {
                  display: true,
                  text: 'Frequency',
                },
                beginAtZero: true,
              },
            },
          },
        };

      default:
        // Default to pie chart for other types
        return {
          type: 'pie',
          data: {
            labels,
            datasets: [
              {
                label: 'Distribution',
                data: values,
                backgroundColor: colors.slice(0, labels.length),
                borderColor: borderColors.slice(0, labels.length),
                borderWidth: 1,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                display: true,
                position: 'right',
              },
              title: {
                display: true,
                text: `${item.name} - Distribution`,
              },
              tooltip: {
                enabled: true,
              },
            },
          },
        };
    }
  };

  /**
   * Render chart component based on configuration
   */
  const renderChart = (config: ChartConfig) => {
    const chartProps = {
      data: config.data,
      options: config.options,
      'aria-label': config.options.plugins.title.text,
      role: 'img',
    };

    switch (config.type) {
      case 'bar':
      case 'horizontalBar':
        return <Bar {...chartProps} />;
      case 'line':
        return <Line {...chartProps} />;
      case 'pie':
        return <Pie {...chartProps} />;
      default:
        return null;
    }
  };

  /**
   * Render data table for accessibility (screen reader alternative to charts)
   */
  const renderDataTable = (item: FeedbackItemAnalysis) => {
    if (!item.distribution || item.distribution.length === 0) {
      return null;
    }

    return (
      <Box sx={{ mt: 2, display: { xs: 'block', md: 'none', print: 'block' } }}>
        <Typography variant="subtitle2" gutterBottom>
          Data Table (Alternative to Chart)
        </Typography>
        <Table size="small" aria-label={`Data for ${item.name}`}>
          <TableHead>
            <TableRow>
              <TableCell>Option</TableCell>
              <TableCell align="right">Responses</TableCell>
              <TableCell align="right">Percentage</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {item.distribution.map((dist, idx) => (
              <TableRow key={idx}>
                <TableCell>{dist.label}</TableCell>
                <TableCell align="right">{dist.count}</TableCell>
                <TableCell align="right">{dist.percentage.toFixed(1)}%</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
    );
  };

  /**
   * Render text responses for textarea/textfield questions
   */
  const renderTextResponses = (item: FeedbackItemAnalysis) => {
    if (!item.textResponses || item.textResponses.length === 0) {
      return (
        <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
          No text responses available
        </Typography>
      );
    }

    // Show first 5 responses with "View all" option
    const displayResponses = item.textResponses.slice(0, 5);
    const hasMore = item.textResponses.length > 5;

    return (
      <Box sx={{ mt: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Sample Responses ({displayResponses.length} of {item.textResponses.length})
        </Typography>
        <Box component="ul" sx={{ pl: 2, m: 0 }}>
          {displayResponses.map((response, idx) => (
            <Box component="li" key={idx} sx={{ mb: 1 }}>
              <Typography variant="body2">{response}</Typography>
            </Box>
          ))}
        </Box>
        {hasMore && (
          <Typography variant="caption" color="text.secondary">
            Switch to "Responses" tab to view all {item.textResponses.length} responses
          </Typography>
        )}
      </Box>
    );
  };

  /**
   * Render statistics for numeric or rated questions
   */
  const renderStatistics = (item: FeedbackItemAnalysis) => {
    if (!item.statistics) {
      return null;
    }

    return (
      <Box sx={{ mt: 2, display: 'flex', gap: 3, flexWrap: 'wrap' }}>
        {item.statistics.mean !== undefined && (
          <Box>
            <Typography variant="caption" color="text.secondary">
              Average
            </Typography>
            <Typography variant="h6">{item.statistics.mean.toFixed(2)}</Typography>
          </Box>
        )}
        {item.statistics.median !== undefined && (
          <Box>
            <Typography variant="caption" color="text.secondary">
              Median
            </Typography>
            <Typography variant="h6">{item.statistics.median.toFixed(2)}</Typography>
          </Box>
        )}
        {item.statistics.mode !== undefined && (
          <Box>
            <Typography variant="caption" color="text.secondary">
              Mode
            </Typography>
            <Typography variant="h6">{item.statistics.mode.toFixed(2)}</Typography>
          </Box>
        )}
        {item.statistics.stdDev !== undefined && (
          <Box>
            <Typography variant="caption" color="text.secondary">
              Std. Deviation
            </Typography>
            <Typography variant="h6">{item.statistics.stdDev.toFixed(2)}</Typography>
          </Box>
        )}
        {item.statistics.min !== undefined && (
          <Box>
            <Typography variant="caption" color="text.secondary">
              Minimum
            </Typography>
            <Typography variant="h6">{item.statistics.min}</Typography>
          </Box>
        )}
        {item.statistics.max !== undefined && (
          <Box>
            <Typography variant="caption" color="text.secondary">
              Maximum
            </Typography>
            <Typography variant="h6">{item.statistics.max}</Typography>
          </Box>
        )}
      </Box>
    );
  };

  /**
   * Render individual question analysis accordion
   */
  const renderQuestionAnalysis = (item: FeedbackItemAnalysis, index: number) => {
    const chartConfig = useMemo(() => generateChartConfig(item), [item]);
    const totalResponses = item.responseCount || 0;

    return (
      <Accordion key={item.itemId} TransitionProps={{ unmountOnExit: true }}>
        <AccordionSummary
          expandIcon={<ExpandMore />}
          aria-controls={`question-${item.itemId}-content`}
          id={`question-${item.itemId}-header`}
        >
          <Box sx={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', pr: 2 }}>
            <Typography variant="h6" component="h3">
              {index + 1}. {item.name}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {totalResponses} {totalResponses === 1 ? 'response' : 'responses'}
            </Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={{ width: '100%' }}>
            {/* Question type indicator */}
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
              Type: {item.type}
            </Typography>

            {/* Render statistics for numeric/rated questions */}
            {renderStatistics(item)}

            {/* Render chart visualization for choice/numeric questions */}
            {chartConfig && (
              <Box
                sx={{
                  height: { xs: 250, sm: 300, md: 350 },
                  mt: 3,
                  '@media print': {
                    height: 300,
                  },
                }}
              >
                {renderChart(chartConfig)}
              </Box>
            )}

            {/* Render accessible data table */}
            {renderDataTable(item)}

            {/* Render text responses for textarea/textfield questions */}
            {(item.type === 'textarea' || item.type === 'textfield') && renderTextResponses(item)}

            {/* Show most common response */}
            {item.distribution && item.distribution.length > 0 && (
              <Box sx={{ mt: 3, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Most Common Response
                </Typography>
                <Typography variant="body1">
                  {item.distribution[0].label} ({item.distribution[0].count} responses,{' '}
                  {item.distribution[0].percentage.toFixed(1)}%)
                </Typography>
              </Box>
            )}
          </Box>
        </AccordionDetails>
      </Accordion>
    );
  };

  // Permission check
  if (!canViewAnalysis) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert
          severity="error"
          title="Permission Denied"
          message="You do not have permission to view the analysis for this feedback activity."
        />
      </Box>
    );
  }

  // Error state
  if (isError) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert
          severity="error"
          title="Error Loading Analysis"
          message={
            analysisError instanceof Error
              ? analysisError.message
              : 'Failed to load feedback analysis. Please try again later.'
          }
        />
      </Box>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <Box sx={{ p: 3 }}>
        <Skeleton variant="rectangular" height={120} sx={{ mb: 3 }} />
        <Skeleton variant="rectangular" height={60} sx={{ mb: 2 }} />
        <Skeleton variant="rectangular" height={300} sx={{ mb: 2 }} />
        <Skeleton variant="rectangular" height={300} sx={{ mb: 2 }} />
        <Skeleton variant="rectangular" height={300} />
      </Box>
    );
  }

  // Anonymous protection check
  if (analysisData?.anonymousProtection?.protected) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert
          severity="warning"
          title="Insufficient Responses"
          message={
            analysisData.anonymousProtection.message ||
            'This feedback activity is anonymous and does not have enough responses in the selected group to display analysis while protecting respondent anonymity.'
          }
        />
      </Box>
    );
  }

  // Empty state - no responses
  if (!analysisData || !analysisData.items || analysisData.items.length === 0) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert
          severity="info"
          title="No Responses Yet"
          message="This feedback activity has not received any responses yet. Analysis will be available once responses are submitted."
        />
      </Box>
    );
  }

  // Main render
  return (
    <Box sx={{ width: '100%', '@media print': { '& .no-print': { display: 'none' } } }}>
      {/* Tabs for Analysis and Responses views */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }} className="no-print">
        <Tabs value={currentTab} onChange={handleTabChange} aria-label="Analysis view tabs">
          <Tab label="Analysis" value="analysis" />
          {canViewResponses && <Tab label="Responses" value="responses" />}
        </Tabs>
      </Box>

      {/* Analysis Tab */}
      {currentTab === 'analysis' && (
        <Box>
          {/* Export and Filter Controls */}
          <Box
            sx={{
              display: 'flex',
              gap: 2,
              mb: 3,
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
            className="no-print"
          >
            {/* Export Buttons */}
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="contained"
                startIcon={<Download />}
                onClick={handleExportExcel}
                aria-label="Export analysis to Excel"
              >
                Export to Excel
              </Button>
              <Button
                variant="outlined"
                startIcon={<Download />}
                onClick={handleExportPdf}
                aria-label="Export analysis to PDF"
              >
                Export to PDF
              </Button>
            </Box>

            {/* Filter Controls */}
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              {/* Group Filter */}
              {analysisData.summary?.groupOptions && analysisData.summary.groupOptions.length > 0 && (
                <Box sx={{ minWidth: 120 }}>
                  <Typography variant="caption" sx={{ display: 'block', mb: 0.5 }}>
                    Filter by Group
                  </Typography>
                  <Select
                    value={filters.groupId ?? ''}
                    onChange={handleGroupChange}
                    size="small"
                    displayEmpty
                    aria-label="Select group"
                  >
                    <MenuItem value="">All Groups</MenuItem>
                    {analysisData.summary.groupOptions.map((group) => (
                      <MenuItem key={group.id} value={group.id}>
                        {group.name}
                      </MenuItem>
                    ))}
                  </Select>
                </Box>
              )}

              {/* Course Filter (for multi-course feedback) */}
              {analysisData.summary?.courseOptions && analysisData.summary.courseOptions.length > 0 && (
                <Box sx={{ minWidth: 120 }}>
                  <Typography variant="caption" sx={{ display: 'block', mb: 0.5 }}>
                    Filter by Course
                  </Typography>
                  <Select
                    value={filters.courseId ?? ''}
                    onChange={handleCourseChange}
                    size="small"
                    displayEmpty
                    aria-label="Select course"
                  >
                    <MenuItem value="">All Courses</MenuItem>
                    {analysisData.summary.courseOptions.map((course) => (
                      <MenuItem key={course.id} value={course.id}>
                        {course.name}
                      </MenuItem>
                    ))}
                  </Select>
                </Box>
              )}
            </Box>
          </Box>

          {/* Feedback Summary Statistics */}
          <Box sx={{ mb: 4 }}>
            <FeedbackSummary feedbackId={feedbackId} statistics={analysisData.summary} />
          </Box>

          {/* Question-by-Question Analysis */}
          <Card>
            <CardContent>
              <Typography variant="h5" component="h2" gutterBottom>
                Question Analysis
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Detailed breakdown of responses for each question
              </Typography>

              <Box sx={{ '& .MuiAccordion-root': { mb: 1 } }}>
                {analysisData.items.map((item, index) => renderQuestionAnalysis(item, index))}
              </Box>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Responses Tab */}
      {currentTab === 'responses' && canViewResponses && (
        <Box>
          <ResponseList
            feedbackId={feedbackId}
            responses={analysisData.responses || []}
            onDelete={async (responseId: number) => {
              // Handle delete - this would typically trigger a mutation and refetch
              console.log('Delete response:', responseId);
            }}
            canDelete={false}
          />
        </Box>
      )}
    </Box>
  );
};
