/**
 * GradeChart Component
 * 
 * React component for visualizing grade distribution and trends using Recharts library.
 * Displays grade data as bar charts, line charts, or area charts with configurable chart types.
 * Supports multiple visualization modes including grade distribution histogram, grade trends
 * over time, and comparison charts.
 * 
 * @module features/gradebook/components/GradeChart
 */

import { useState, useMemo } from 'react';
import { Box, Typography, Skeleton, useTheme, Alert } from '@mui/material';
import {
  ResponsiveContainer,
  BarChart,
  LineChart,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Bar,
  Line,
  Area,
} from 'recharts';
import type { GradeSummary } from '../types/grade.types';

// ============================================================================
// TYPE DEFINITIONS AND ENUMS
// ============================================================================

/**
 * Chart type enumeration.
 * Defines the available chart visualization types.
 * Internal to this component - not exported to comply with react-refresh requirements.
 */
enum ChartType {
  /** Bar chart for discrete data comparison */
  BAR = 'bar',
  /** Line chart for trends and continuous data */
  LINE = 'line',
  /** Area chart for cumulative or filled trend visualization */
  AREA = 'area',
}

/**
 * Grade distribution data interface.
 * Used for histogram visualization of grade ranges.
 */
export interface GradeDistributionData {
  /** Grade range label (e.g., "0-59", "60-69") */
  range: string;
  /** Number of grades in this range */
  count: number;
  /** Percentage of total grades in this range */
  percentage: number;
}

/**
 * Props interface for GradeChart component.
 * Provides comprehensive configuration options for chart rendering.
 */
export interface GradeChartProps {
  /** Array of grade summary data to visualize */
  grades: GradeSummary[];
  /** Type of chart to render (bar, line, or area) */
  chartType: 'bar' | 'line' | 'area';
  /** Chart title displayed above the visualization */
  title: string;
  /** Chart height in pixels (default: 300) */
  height?: number;
  /** Chart width as percentage or pixels (default: 100%) */
  width?: string | number;
  /** Whether to show legend (default: true) */
  showLegend?: boolean;
  /** Whether to show grid lines (default: true) */
  showGrid?: boolean;
  /** Data key for X-axis (default: 'itemname' for grades, 'range' for distribution) */
  dataKey?: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Transforms grade data into distribution histogram data.
 * Bins grades into standard ranges and calculates counts and percentages.
 * 
 * @param grades - Array of grade summary data
 * @returns Array of grade distribution data for histogram rendering
 */
const calculateGradeDistribution = (grades: GradeSummary[]): GradeDistributionData[] => {
  // Filter out grades that have null percentage values
  const validGrades = grades.filter(
    (grade) => grade.percentage !== null && grade.percentage !== undefined
  );

  if (validGrades.length === 0) {
    return [];
  }

  // Define grade ranges based on standard grading scales
  const ranges = [
    { label: '0-59', min: 0, max: 59 },
    { label: '60-69', min: 60, max: 69 },
    { label: '70-79', min: 70, max: 79 },
    { label: '80-89', min: 80, max: 89 },
    { label: '90-100', min: 90, max: 100 },
  ];

  // Count grades in each range
  const distribution = ranges.map((rangeConfig) => {
    const count = validGrades.filter((grade) => {
      // Type narrowing: we know percentage is not null/undefined due to validGrades filter
      const percentage = grade.percentage as number;
      return percentage >= rangeConfig.min && percentage <= rangeConfig.max;
    }).length;

    const percentage = validGrades.length > 0
      ? parseFloat(((count / validGrades.length) * 100).toFixed(2))
      : 0;

    return {
      range: rangeConfig.label,
      count,
      percentage,
    };
  });

  return distribution;
};

/**
 * Formats tooltip content for grade chart.
 * 
 * @param value - Tooltip value to format
 * @param name - Name of the data series
 * @returns Formatted tooltip string
 */
const formatTooltipValue = (value: number, name: string): string => {
  if (name === 'percentage' || name.toLowerCase().includes('percent')) {
    return `${value.toFixed(2)}%`;
  }
  if (name === 'count') {
    return `${value} grade${value !== 1 ? 's' : ''}`;
  }
  return value.toFixed(2);
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * GradeChart Component
 * 
 * Renders an interactive chart visualization for grade data using Recharts.
 * Supports multiple chart types (bar, line, area) and includes comprehensive
 * features for accessibility, responsiveness, and customization.
 * 
 * @param props - Component props
 * @returns Rendered chart component
 */
function GradeChart({
  grades,
  chartType,
  title,
  height = 300,
  width = '100%',
  showLegend = true,
  showGrid = true,
  dataKey = 'itemname',
}: GradeChartProps): JSX.Element {
  const theme = useTheme();
  const [isLoading] = useState<boolean>(false);
  const [hasError] = useState<boolean>(false);

  // Memoized calculation of chart data based on chart type
  const chartData = useMemo(() => {
    if (!grades || grades.length === 0) {
      return [];
    }

    // For distribution chart, calculate binned data
    if (dataKey === 'range') {
      return calculateGradeDistribution(grades);
    }

    // For regular grade chart, use grade summary data directly
    // Filter out grades with null percentages (no valid grade data to display)
    return grades
      .filter((grade) => grade.percentage !== null && grade.percentage !== undefined)
      .map((grade) => ({
        itemname: grade.itemname,
        grade: grade.grade,
        percentage: grade.percentage,
        average: grade.average,
        lettergrade: grade.lettergrade,
      }));
  }, [grades, dataKey]);

  // Determine appropriate data keys based on chart data structure
  const xAxisKey = useMemo(() => {
    if (dataKey === 'range') {
      return 'range';
    }
    return 'itemname';
  }, [dataKey]);

  const yAxisKey = useMemo(() => {
    if (dataKey === 'range') {
      return 'count';
    }
    return 'percentage';
  }, [dataKey]);

  // Render loading skeleton while data is being fetched
  if (isLoading) {
    return (
      <Box sx={{ padding: 2 }}>
        <Skeleton variant="text" width="40%" height={40} sx={{ mb: 2 }} />
        <Skeleton variant="rectangular" width="100%" height={height} />
      </Box>
    );
  }

  // Render error alert if chart data is invalid
  if (hasError || !chartData || chartData.length === 0) {
    return (
      <Box sx={{ padding: 2 }}>
        <Alert severity="error" role="alert">
          {hasError
            ? 'Unable to render chart due to invalid data.'
            : 'No grade data available for visualization.'}
        </Alert>
      </Box>
    );
  }

  // Common chart configuration props
  const commonChartProps = {
    data: chartData,
    margin: { top: 5, right: 30, left: 20, bottom: 5 },
  };

  const commonAxisProps = {
    stroke: theme.palette.text.secondary,
    style: {
      fontSize: '0.875rem',
      fontFamily: theme.typography.fontFamily,
    },
  };

  // Render the appropriate chart type based on chartType prop
  const renderChart = () => {
    switch (chartType) {
      case ChartType.BAR:
        return (
          <BarChart {...commonChartProps}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />}
            <XAxis
              dataKey={xAxisKey}
              {...commonAxisProps}
              label={{ value: xAxisKey === 'range' ? 'Grade Range' : 'Assignment', position: 'insideBottom', offset: -5 }}
            />
            <YAxis
              {...commonAxisProps}
              label={{ value: yAxisKey === 'count' ? 'Number of Grades' : 'Percentage (%)', angle: -90, position: 'insideLeft' }}
            />
            <Tooltip
              formatter={formatTooltipValue}
              contentStyle={{
                backgroundColor: theme.palette.background.paper,
                border: `1px solid ${theme.palette.divider}`,
                borderRadius: theme.shape.borderRadius,
              }}
            />
            {showLegend && <Legend iconType="circle" align="right" />}
            <Bar
              dataKey={yAxisKey}
              fill={theme.palette.primary.main}
              radius={[8, 8, 0, 0]}
              name={yAxisKey === 'count' ? 'Count' : 'Grade (%)'}
            />
            {yAxisKey === 'percentage' && chartData[0] && 'average' in chartData[0] && typeof chartData[0].average === 'number' && (
              <Bar
                dataKey="average"
                fill={theme.palette.secondary.main}
                radius={[8, 8, 0, 0]}
                name="Average (%)"
              />
            )}
          </BarChart>
        );

      case ChartType.LINE:
        return (
          <LineChart {...commonChartProps}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />}
            <XAxis
              dataKey={xAxisKey}
              {...commonAxisProps}
              label={{ value: xAxisKey === 'range' ? 'Grade Range' : 'Assignment', position: 'insideBottom', offset: -5 }}
            />
            <YAxis
              {...commonAxisProps}
              label={{ value: yAxisKey === 'count' ? 'Number of Grades' : 'Percentage (%)', angle: -90, position: 'insideLeft' }}
            />
            <Tooltip
              formatter={formatTooltipValue}
              contentStyle={{
                backgroundColor: theme.palette.background.paper,
                border: `1px solid ${theme.palette.divider}`,
                borderRadius: theme.shape.borderRadius,
              }}
            />
            {showLegend && <Legend iconType="circle" align="right" />}
            <Line
              type="monotone"
              dataKey={yAxisKey}
              stroke={theme.palette.primary.main}
              strokeWidth={2}
              dot={{ fill: theme.palette.primary.main, r: 4 }}
              activeDot={{ r: 6 }}
              name={yAxisKey === 'count' ? 'Count' : 'Grade (%)'}
            />
            {yAxisKey === 'percentage' && chartData[0] && 'average' in chartData[0] && typeof chartData[0].average === 'number' && (
              <Line
                type="monotone"
                dataKey="average"
                stroke={theme.palette.secondary.main}
                strokeWidth={2}
                dot={{ fill: theme.palette.secondary.main, r: 4 }}
                activeDot={{ r: 6 }}
                name="Average (%)"
              />
            )}
          </LineChart>
        );

      case ChartType.AREA:
        return (
          <AreaChart {...commonChartProps}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />}
            <XAxis
              dataKey={xAxisKey}
              {...commonAxisProps}
              label={{ value: xAxisKey === 'range' ? 'Grade Range' : 'Assignment', position: 'insideBottom', offset: -5 }}
            />
            <YAxis
              {...commonAxisProps}
              label={{ value: yAxisKey === 'count' ? 'Number of Grades' : 'Percentage (%)', angle: -90, position: 'insideLeft' }}
            />
            <Tooltip
              formatter={formatTooltipValue}
              contentStyle={{
                backgroundColor: theme.palette.background.paper,
                border: `1px solid ${theme.palette.divider}`,
                borderRadius: theme.shape.borderRadius,
              }}
            />
            {showLegend && <Legend iconType="circle" align="right" />}
            <Area
              type="monotone"
              dataKey={yAxisKey}
              stroke={theme.palette.primary.main}
              fill={theme.palette.primary.main}
              fillOpacity={0.6}
              name={yAxisKey === 'count' ? 'Count' : 'Grade (%)'}
            />
            {yAxisKey === 'percentage' && chartData[0] && 'average' in chartData[0] && typeof chartData[0].average === 'number' && (
              <Area
                type="monotone"
                dataKey="average"
                stroke={theme.palette.secondary.main}
                fill={theme.palette.secondary.main}
                fillOpacity={0.4}
                name="Average (%)"
              />
            )}
          </AreaChart>
        );

      default:
        // Fallback to BAR chart for any unexpected chart type
        return (
          <BarChart {...commonChartProps}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />}
            <XAxis
              dataKey={xAxisKey}
              {...commonAxisProps}
              label={{ value: xAxisKey === 'range' ? 'Grade Range' : 'Assignment', position: 'insideBottom', offset: -5 }}
            />
            <YAxis
              {...commonAxisProps}
              label={{ value: yAxisKey === 'count' ? 'Count' : 'Grade (%)', angle: -90, position: 'insideLeft' }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: theme.palette.background.paper,
                border: `1px solid ${theme.palette.divider}`,
                borderRadius: theme.shape.borderRadius,
              }}
            />
            {showLegend && <Legend iconType="circle" align="right" />}
            <Bar
              dataKey={yAxisKey}
              fill={theme.palette.primary.main}
              radius={[8, 8, 0, 0]}
              name={yAxisKey === 'count' ? 'Count' : 'Grade (%)'}
            />
            {yAxisKey === 'percentage' && chartData[0] && 'average' in chartData[0] && typeof chartData[0].average === 'number' && (
              <Bar
                dataKey="average"
                fill={theme.palette.secondary.main}
                radius={[8, 8, 0, 0]}
                name="Average (%)"
              />
            )}
          </BarChart>
        );
    }
  };

  return (
    <Box
      sx={{
        padding: 2,
        borderRadius: 2,
        backgroundColor: theme.palette.background.paper,
        boxShadow: theme.shadows[1],
      }}
      role="img"
      aria-label={`${title} chart`}
      data-testid="grade-chart"
    >
      <Typography
        variant="h6"
        color="primary"
        gutterBottom
        sx={{ mb: 2, fontWeight: 600 }}
        data-testid="chart-title"
      >
        {title}
      </Typography>
      <ResponsiveContainer width={width} height={height}>
        {renderChart()}
      </ResponsiveContainer>
    </Box>
  );
}

// Export component as default and named export for flexibility
export default GradeChart;
export { GradeChart };
