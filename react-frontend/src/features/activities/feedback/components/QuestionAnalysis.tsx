/**
 * QuestionAnalysis Component
 *
 * Displays aggregated analysis results for a single feedback item/question.
 * Supports multiple item types with appropriate visualizations:
 * - Multichoice: Bar/Pie charts with response counts and percentages
 * - Numeric: Statistics including mean, individual values
 * - Text: List of all text responses
 *
 * Based on Moodle's feedback item analysis patterns.
 */

import type React from 'react';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  useTheme,
  alpha,
} from '@mui/material';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

/**
 * Type of feedback item/question
 */
type FeedbackItemType =
  | 'multichoice'
  | 'multichoicerated'
  | 'numeric'
  | 'textarea'
  | 'textfield'
  | 'info'
  | 'label';

/**
 * Analysis data for multichoice items
 */
interface MultichoiceAnalysisData {
  answertext: string;
  answercount: number;
  quotient: number; // Percentage as decimal (0-1)
}

/**
 * Analysis data for numeric items
 */
interface NumericAnalysisData {
  data: number[];
  avg: number | null;
  min?: number;
  max?: number;
  count: number;
}

/**
 * Analysis data for text-based items (textarea, textfield)
 */
interface TextAnalysisData {
  values: string[];
  count: number;
}

/**
 * Generic analysis result structure
 */
interface AnalysisResult {
  itemType: FeedbackItemType;
  multichoiceData?: MultichoiceAnalysisData[];
  numericData?: NumericAnalysisData;
  textData?: TextAnalysisData;
}

/**
 * Props for QuestionAnalysis component
 */
interface QuestionAnalysisProps {
  /** Item/question number (e.g., "1", "2.3") */
  itemNumber?: string;
  /** Optional label for the item */
  label?: string;
  /** Question/item name/text */
  questionName: string;
  /** Type of feedback item */
  itemType: FeedbackItemType;
  /** Analysis results data */
  analysisData: AnalysisResult;
  /** Whether to display as horizontal bar chart (default: true) */
  horizontalChart?: boolean;
  /** Whether to show pie chart alongside bar chart for multichoice */
  showPieChart?: boolean;
  /** Chart height in pixels */
  chartHeight?: number;
  /** Whether responses are anonymous */
  isAnonymous?: boolean;
}

/**
 * Chart data structure for visualizations
 */
interface ChartDataItem {
  name: string;
  value: number;
  percentage: string;
  fullLabel: string;
}

/**
 * Tooltip payload structure from recharts
 */
interface TooltipPayload {
  payload: ChartDataItem;
  name?: string;
  value?: number;
}

/**
 * Custom Tooltip Component for Bar Charts
 */
interface BarChartTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
}

function BarChartTooltip({ active, payload }: BarChartTooltipProps): React.ReactElement | null {
  if (active && payload && payload.length > 0 && payload[0]) {
    const data = payload[0].payload;
    return (
      <Paper sx={{ p: 1.5 }}>
        <Typography variant="body2" fontWeight="bold">
          <span dangerouslySetInnerHTML={{ __html: data.fullLabel }} />
        </Typography>
        <Typography variant="body2">Responses: {data.value}</Typography>
        <Typography variant="body2">Percentage: {data.percentage}</Typography>
      </Paper>
    );
  }
  return null;
}

/**
 * Pie chart data structure
 */
interface PieChartDataItem {
  name: string;
  value: number;
  percentage: string;
}

/**
 * Pie tooltip payload structure
 */
interface PieTooltipPayload {
  name?: string;
  value?: number;
  payload: PieChartDataItem;
}

/**
 * Custom Tooltip Component for Pie Charts
 */
interface PieChartTooltipProps {
  active?: boolean;
  payload?: PieTooltipPayload[];
}

function PieChartTooltip({ active, payload }: PieChartTooltipProps): React.ReactElement | null {
  if (active && payload && payload.length > 0 && payload[0]) {
    const data = payload[0];
    return (
      <Paper sx={{ p: 1.5 }}>
        <Typography variant="body2" fontWeight="bold">
          {data.name}
        </Typography>
        <Typography variant="body2">Responses: {data.value}</Typography>
        <Typography variant="body2">Percentage: {data.payload.percentage}</Typography>
      </Paper>
    );
  }
  return null;
}

/**
 * QuestionAnalysis Component
 *
 * Renders individual question analysis with appropriate visualizations
 * based on item type.
 */
export function QuestionAnalysis({
  itemNumber,
  label,
  questionName,
  itemType,
  analysisData,
  horizontalChart = true,
  showPieChart = false,
  chartHeight = 400,
  isAnonymous: _isAnonymous = false,
}: QuestionAnalysisProps): React.ReactElement {
  const theme = useTheme();

  /**
   * Generates colors for chart visualization
   */
  const getChartColors = (count: number): string[] => {
    const baseColors = [
      theme.palette.primary.main,
      theme.palette.secondary.main,
      theme.palette.success.main,
      theme.palette.warning.main,
      theme.palette.error.main,
      theme.palette.info.main,
    ];

    const colors: string[] = [];
    for (let i = 0; i < count; i++) {
      const color = baseColors[i % baseColors.length];
      if (color) {
        colors.push(color);
      }
    }
    return colors;
  };

  /**
   * Formats a number to a fixed decimal place
   */
  const formatFloat = (value: number, decimals: number = 2): string => {
    return value.toFixed(decimals);
  };

  /**
   * Formats percentage for display
   */
  const formatPercentage = (quotient: number): string => {
    return `${formatFloat(quotient * 100, 2)} %`;
  };

  /**
   * Renders the question header
   */
  const renderQuestionHeader = (): React.ReactElement => {
    return (
      <TableRow>
        <TableCell
          component="th"
          sx={{
            fontWeight: 'bold',
            fontSize: '1.1rem',
            backgroundColor: alpha(theme.palette.primary.main, 0.08),
            borderBottom: `2px solid ${theme.palette.primary.main}`,
          }}
        >
          {itemNumber && <span>{itemNumber} </span>}
          {label && <span>({label}) </span>}
          <span dangerouslySetInnerHTML={{ __html: questionName }} />
        </TableCell>
      </TableRow>
    );
  };

  /**
   * Renders bar chart for multichoice items
   */
  const renderBarChart = (data: MultichoiceAnalysisData[]): React.ReactElement => {
    const chartData = data.map((item) => ({
      name: item.answertext.replace(/<[^>]*>/g, ''), // Strip HTML for chart labels
      value: item.answercount,
      percentage: formatPercentage(item.quotient),
      fullLabel: item.answertext,
    }));

    const colors = getChartColors(chartData.length);

    if (horizontalChart) {
      return (
        <ResponsiveContainer width="100%" height={chartHeight}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" />
            <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 12 }} />
            <Tooltip content={<BarChartTooltip />} />
            <Legend />
            <Bar dataKey="value" name="Responses" label={{ position: 'right' }}>
              {chartData.map((entry, index) => (
                // eslint-disable-next-line react/no-array-index-key
                <Cell key={`cell-${entry.name}-${index}`} fill={colors[index]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      );
    }
    return (
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} tick={{ fontSize: 12 }} />
          <YAxis />
          <Tooltip content={<BarChartTooltip />} />
          <Legend />
          <Bar dataKey="value" name="Responses">
            {chartData.map((entry, index) => (
              // eslint-disable-next-line react/no-array-index-key
              <Cell key={`cell-${entry.name}-${index}`} fill={colors[index]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  };

  /**
   * Renders pie chart for multichoice items
   */
  const renderPieChart = (data: MultichoiceAnalysisData[]): React.ReactElement => {
    const chartData = data.map((item) => ({
      name: item.answertext.replace(/<[^>]*>/g, ''),
      value: item.answercount,
      percentage: formatPercentage(item.quotient),
    }));

    const colors = getChartColors(chartData.length);

    return (
      <ResponsiveContainer width="100%" height={chartHeight}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine
            label={(entry: PieChartDataItem) =>
              `${entry.name}: ${entry.value} (${entry.percentage})`
            }
            outerRadius={120}
            fill={theme.palette.primary.main}
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              // eslint-disable-next-line react/no-array-index-key
              <Cell key={`cell-${entry.name}-${index}`} fill={colors[index]} />
            ))}
          </Pie>
          <Tooltip content={<PieChartTooltip />} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    );
  };

  /**
   * Renders multichoice analysis with charts
   */
  const renderMultichoiceAnalysis = (): React.ReactElement | null => {
    if (!analysisData.multichoiceData || analysisData.multichoiceData.length === 0) {
      return null;
    }

    return (
      <TableRow>
        <TableCell>
          {showPieChart ? (
            <Box sx={{ display: 'flex', flexDirection: 'row', gap: 2 }}>
              <Box sx={{ flex: 1 }}>{renderBarChart(analysisData.multichoiceData)}</Box>
              <Box sx={{ flex: 1 }}>{renderPieChart(analysisData.multichoiceData)}</Box>
            </Box>
          ) : (
            renderBarChart(analysisData.multichoiceData)
          )}
        </TableCell>
      </TableRow>
    );
  };

  /**
   * Renders numeric analysis with statistics
   */
  const renderNumericAnalysis = (): React.ReactElement | null => {
    if (!analysisData.numericData) {
      return null;
    }

    const { data, avg, min, max, count } = analysisData.numericData;

    return (
      <>
        {data && data.length > 0 && (
          <>
            {data.map((value, index) => (
              // eslint-disable-next-line react/no-array-index-key
              <TableRow key={`value-${value}-${index}`}>
                <TableCell
                  sx={{
                    fontFamily: 'monospace',
                    pl: 4,
                  }}
                >
                  {formatFloat(value, value % 1 === 0 ? 0 : 2)}
                </TableCell>
              </TableRow>
            ))}
          </>
        )}
        <TableRow>
          <TableCell
            sx={{
              fontWeight: 'bold',
              backgroundColor: alpha(theme.palette.info.main, 0.08),
              pl: 4,
            }}
          >
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Typography variant="body1">
                <strong>Average:</strong> {avg !== null ? formatFloat(avg, 2) : '-'}
              </Typography>
              {min !== undefined && (
                <Typography variant="body2" color="text.secondary">
                  Minimum: {formatFloat(min, 2)}
                </Typography>
              )}
              {max !== undefined && (
                <Typography variant="body2" color="text.secondary">
                  Maximum: {formatFloat(max, 2)}
                </Typography>
              )}
              <Typography variant="body2" color="text.secondary">
                Response count: {count}
              </Typography>
            </Box>
          </TableCell>
        </TableRow>
      </>
    );
  };

  /**
   * Renders text analysis with response list
   */
  const renderTextAnalysis = (): React.ReactElement | null => {
    if (!analysisData.textData || analysisData.textData.values.length === 0) {
      return null;
    }

    const { values, count } = analysisData.textData;

    return (
      <>
        {values.map((value, index) => {
          const isEmpty = !value || value.trim().length === 0;
          const keyValue = value ? value.substring(0, 20) : 'empty';
          return (
            <TableRow
              // eslint-disable-next-line react/no-array-index-key
              key={`text-${keyValue}-${index}`}
              sx={{
                '&:hover': {
                  backgroundColor: alpha(theme.palette.primary.main, 0.04),
                },
              }}
            >
              <TableCell
                sx={{
                  pl: 4,
                  color: isEmpty ? theme.palette.text.disabled : theme.palette.text.primary,
                  fontStyle: isEmpty ? 'italic' : 'normal',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {isEmpty ? (
                  <em>(Empty response)</em>
                ) : (
                  <span dangerouslySetInnerHTML={{ __html: value.replace(/\n/g, '<br />') }} />
                )}
              </TableCell>
            </TableRow>
          );
        })}
        <TableRow>
          <TableCell
            sx={{
              fontWeight: 'bold',
              backgroundColor: alpha(theme.palette.info.main, 0.08),
              pl: 4,
            }}
          >
            <Typography variant="body2">Total responses: {count}</Typography>
          </TableCell>
        </TableRow>
      </>
    );
  };

  /**
   * Renders analysis content based on item type
   */
  const renderAnalysisContent = (): React.ReactElement | null => {
    switch (itemType) {
      case 'multichoice':
      case 'multichoicerated':
        return renderMultichoiceAnalysis();

      case 'numeric':
        return renderNumericAnalysis();

      case 'textarea':
      case 'textfield':
        return renderTextAnalysis();

      case 'info':
      case 'label':
        // Info and label items don't have analyzable data
        return (
          <TableRow>
            <TableCell sx={{ pl: 4, fontStyle: 'italic', color: theme.palette.text.secondary }}>
              <Typography variant="body2">This item type does not collect responses.</Typography>
            </TableCell>
          </TableRow>
        );

      default:
        return (
          <TableRow>
            <TableCell sx={{ pl: 4 }}>
              <Typography variant="body2" color="warning.main">
                Analysis not available for this item type.
              </Typography>
            </TableCell>
          </TableRow>
        );
    }
  };

  return (
    <TableContainer
      component={Paper}
      sx={{
        mb: 3,
        boxShadow: 2,
        '&:hover': {
          boxShadow: 4,
        },
      }}
    >
      <Table
        className={`analysis itemtype_${itemType}`}
        sx={{
          '& .MuiTableCell-root': {
            borderBottom: `1px solid ${theme.palette.divider}`,
          },
        }}
      >
        <TableHead>{renderQuestionHeader()}</TableHead>
        <TableBody>{renderAnalysisContent()}</TableBody>
      </Table>
    </TableContainer>
  );
}
