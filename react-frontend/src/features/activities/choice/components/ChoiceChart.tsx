/**
 * ChoiceChart Component
 *
 * React component for visualizing choice activity response distribution using bar charts.
 * Displays option names and response counts as horizontal or vertical bars with percentage labels.
 * Supports both anonymous and named result modes with responsive chart sizing and color theming.
 *
 * This component is inspired by the display_publish_anonymous method in Moodle's
 * mod_choice_renderer (public/mod/choice/renderer.php lines 379-409), which creates
 * bar charts for visualizing choice activity results.
 *
 * @module features/activities/choice/components/ChoiceChart
 */

import React from 'react';
import { Box, Paper, Typography, Tooltip, useTheme } from '@mui/material';
import { useIsMobile } from '../../../../hooks/useMediaQuery';

/**
 * Represents a single option in the choice activity with response statistics.
 *
 * @interface ChartOption
 * @property {number} optionid - Unique identifier for the choice option
 * @property {string} text - Display text/label for the option
 * @property {number} count - Number of responses for this option
 * @property {number} percentage - Percentage of total responses (0-100)
 * @property {number} [maxanswers] - Optional maximum number of allowed responses for this option
 */
export interface ChartOption {
  optionid: number;
  text: string;
  count: number;
  percentage: number;
  maxanswers?: number;
}

/**
 * Props for the ChoiceChart component.
 *
 * @interface ChoiceChartProps
 * @property {ChartOption[]} options - Array of choice options with response data
 * @property {'horizontal' | 'vertical'} displayLayout - Layout orientation for the chart
 * @property {boolean} showPercentages - Whether to display percentage values alongside counts
 */
export interface ChoiceChartProps {
  options: ChartOption[];
  displayLayout: 'horizontal' | 'vertical';
  showPercentages: boolean;
}

/**
 * ChoiceChart Component
 *
 * Visualizes choice activity response distribution with bar charts. The component
 * automatically switches to vertical layout on mobile devices for optimal viewing.
 *
 * Features:
 * - Horizontal bars: option text on left, colored bar in middle, stats on right
 * - Vertical bars: option text at bottom, bars stacked upward
 * - Responsive design with automatic mobile breakpoint detection
 * - Color gradients using MUI theme palette
 * - Tooltips with detailed statistics on hover
 * - Accessibility support with ARIA labels
 * - Graceful handling of zero responses
 * - Optional response limit display (X/Y format)
 *
 * @param {ChoiceChartProps} props - Component props
 * @returns {JSX.Element} Rendered bar chart component
 *
 * @example
 * ```tsx
 * <ChoiceChart
 *   options={[
 *     { optionid: 1, text: 'Option A', count: 15, percentage: 50, maxanswers: 30 },
 *     { optionid: 2, text: 'Option B', count: 10, percentage: 33.33 },
 *     { optionid: 3, text: 'Option C', count: 5, percentage: 16.67 }
 *   ]}
 *   displayLayout="horizontal"
 *   showPercentages={true}
 * />
 * ```
 */
const ChoiceChart: React.FC<ChoiceChartProps> = ({
  options,
  displayLayout,
  showPercentages,
}) => {
  const theme = useTheme();
  const isMobile = useIsMobile();

  // Determine effective layout: mobile overrides to vertical
  const effectiveLayout = isMobile ? 'vertical' : displayLayout;
  const isVertical = effectiveLayout === 'vertical';

  /**
   * Formats the response count display, optionally including limit information.
   *
   * @param {ChartOption} option - The option to format
   * @returns {string} Formatted response string (e.g., "15" or "15/30 responses")
   */
  const formatResponseCount = (option: ChartOption): string => {
    if (option.maxanswers !== undefined && option.maxanswers > 0) {
      return `${option.count}/${option.maxanswers}`;
    }
    return `${option.count}`;
  };

  /**
   * Formats the percentage display with one decimal place.
   *
   * @param {number} percentage - The percentage value to format
   * @returns {string} Formatted percentage string (e.g., "33.3%")
   */
  const formatPercentage = (percentage: number): string => {
    return `${percentage.toFixed(1)}%`;
  };

  /**
   * Generates tooltip content with detailed statistics for an option.
   *
   * @param {ChartOption} option - The option to generate tooltip for
   * @returns {string} Tooltip content text
   */
  const getTooltipContent = (option: ChartOption): string => {
    const parts = [
      option.text,
      `Responses: ${option.count}`,
      `Percentage: ${formatPercentage(option.percentage)}`,
    ];

    if (option.maxanswers !== undefined && option.maxanswers > 0) {
      parts.push(`Limit: ${option.maxanswers}`);
      const remaining = option.maxanswers - option.count;
      parts.push(`Remaining: ${remaining}`);
    }

    return parts.join('\n');
  };

  /**
   * Calculates the visual size (width or height) for a bar based on percentage.
   * Ensures minimum visibility for zero responses.
   *
   * @param {number} percentage - The percentage value (0-100)
   * @returns {string} CSS dimension value (e.g., "50%" or "2px")
   */
  const calculateBarSize = (percentage: number): string => {
    if (percentage === 0) {
      return '2px'; // Minimal bar for zero responses
    }
    return `${percentage}%`;
  };

  /**
   * Generates a linear gradient color for bars based on theme primary color.
   * Creates visual depth with lighter to darker gradient.
   *
   * @returns {string} CSS linear-gradient value
   */
  const getBarGradient = (): string => {
    const primaryColor = theme.palette.primary.main;
    const primaryLight = theme.palette.primary.light;
    const primaryDark = theme.palette.primary.dark;

    if (isVertical) {
      // Vertical gradient: light at top, dark at bottom
      return `linear-gradient(to bottom, ${primaryLight}, ${primaryColor}, ${primaryDark})`;
    } else {
      // Horizontal gradient: light at left, dark at right
      return `linear-gradient(to right, ${primaryLight}, ${primaryColor}, ${primaryDark})`;
    }
  };

  // Container accessibility label
  const chartAriaLabel = `Choice activity results chart showing ${options.length} options with response distribution`;

  return (
    <Paper
      elevation={2}
      sx={{
        padding: theme.spacing(3),
        borderRadius: theme.spacing(1),
      }}
      role="img"
      aria-label={chartAriaLabel}
    >
      {/* Chart Title */}
      <Typography
        variant="h6"
        component="h3"
        gutterBottom
        sx={{
          marginBottom: theme.spacing(3),
          color: theme.palette.text.primary,
          fontWeight: 600,
        }}
      >
        Response Distribution
      </Typography>

      {/* Chart Content */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: isVertical ? 'row' : 'column',
          gap: theme.spacing(isVertical ? 3 : 2),
          alignItems: isVertical ? 'flex-end' : 'stretch',
          justifyContent: isVertical ? 'space-around' : 'flex-start',
          minHeight: isVertical ? '300px' : 'auto',
        }}
      >
        {options.map((option) => (
          <Tooltip
            key={option.optionid}
            title={
              <Box
                component="pre"
                sx={{
                  margin: 0,
                  fontFamily: theme.typography.fontFamily,
                  fontSize: theme.typography.body2.fontSize,
                  whiteSpace: 'pre-line',
                }}
              >
                {getTooltipContent(option)}
              </Box>
            }
            arrow
            placement={isVertical ? 'top' : 'right'}
          >
            <Box
              sx={{
                display: 'flex',
                flexDirection: isVertical ? 'column' : 'row',
                alignItems: isVertical ? 'center' : 'center',
                gap: theme.spacing(isVertical ? 1 : 2),
                flex: isVertical ? '1 1 auto' : 'none',
                minWidth: isVertical ? '60px' : 'auto',
                width: isVertical ? 'auto' : '100%',
              }}
            >
              {/* Vertical Layout: Bar first, then text */}
              {isVertical && (
                <>
                  {/* Vertical Bar Container */}
                  <Box
                    sx={{
                      width: '40px',
                      height: '250px',
                      position: 'relative',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'flex-end',
                      backgroundColor: theme.palette.grey[200],
                      borderRadius: theme.spacing(0.5),
                      overflow: 'hidden',
                    }}
                  >
                    {/* Vertical Bar */}
                    <Box
                      sx={{
                        width: '100%',
                        height: calculateBarSize(option.percentage),
                        background: getBarGradient(),
                        transition: 'height 0.3s ease-in-out',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minHeight: option.percentage === 0 ? '2px' : '20px',
                      }}
                    >
                      {/* Percentage label inside bar (if space allows) */}
                      {option.percentage > 10 && showPercentages && (
                        <Typography
                          variant="caption"
                          sx={{
                            color: theme.palette.common.white,
                            fontWeight: 700,
                            textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                            transform: 'rotate(-90deg)',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {formatPercentage(option.percentage)}
                        </Typography>
                      )}
                    </Box>
                  </Box>

                  {/* Statistics below bar */}
                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: theme.spacing(0.5),
                    }}
                  >
                    {/* Response count */}
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 600,
                        color: theme.palette.text.primary,
                      }}
                    >
                      {formatResponseCount(option)}
                    </Typography>

                    {/* Percentage (if not shown in bar and enabled) */}
                    {showPercentages && option.percentage <= 10 && (
                      <Typography
                        variant="caption"
                        sx={{
                          color: theme.palette.text.secondary,
                        }}
                      >
                        {formatPercentage(option.percentage)}
                      </Typography>
                    )}

                    {/* Option text */}
                    <Typography
                      variant="body2"
                      align="center"
                      sx={{
                        color: theme.palette.text.secondary,
                        maxWidth: '100px',
                        wordBreak: 'break-word',
                        fontSize: '0.75rem',
                      }}
                    >
                      {option.text}
                    </Typography>
                  </Box>
                </>
              )}

              {/* Horizontal Layout: Text, Bar, Stats */}
              {!isVertical && (
                <>
                  {/* Option text on left */}
                  <Typography
                    variant="body2"
                    sx={{
                      minWidth: '150px',
                      maxWidth: '200px',
                      color: theme.palette.text.primary,
                      fontWeight: 500,
                      wordBreak: 'break-word',
                    }}
                  >
                    {option.text}
                  </Typography>

                  {/* Horizontal bar container */}
                  <Box
                    sx={{
                      flex: 1,
                      height: '32px',
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center',
                      backgroundColor: theme.palette.grey[200],
                      borderRadius: theme.spacing(0.5),
                      overflow: 'hidden',
                      minWidth: '100px',
                    }}
                  >
                    {/* Horizontal bar */}
                    <Box
                      sx={{
                        width: calculateBarSize(option.percentage),
                        height: '100%',
                        background: getBarGradient(),
                        transition: 'width 0.3s ease-in-out',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        paddingRight: theme.spacing(1),
                        minWidth: option.percentage === 0 ? '2px' : '40px',
                      }}
                    >
                      {/* Percentage inside bar (if space allows) */}
                      {option.percentage > 15 && showPercentages && (
                        <Typography
                          variant="caption"
                          sx={{
                            color: theme.palette.common.white,
                            fontWeight: 700,
                            textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                          }}
                        >
                          {formatPercentage(option.percentage)}
                        </Typography>
                      )}
                    </Box>
                  </Box>

                  {/* Statistics on right */}
                  <Box
                    sx={{
                      minWidth: '100px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-end',
                      gap: theme.spacing(0.25),
                    }}
                  >
                    {/* Response count with optional limit */}
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 600,
                        color: theme.palette.text.primary,
                      }}
                    >
                      {formatResponseCount(option)}
                      {option.maxanswers !== undefined && option.maxanswers > 0
                        ? ' responses'
                        : ''}
                    </Typography>

                    {/* Percentage outside bar (if not enough space inside or disabled) */}
                    {showPercentages && (option.percentage <= 15 || !showPercentages) && (
                      <Typography
                        variant="caption"
                        sx={{
                          color: theme.palette.text.secondary,
                        }}
                      >
                        {formatPercentage(option.percentage)}
                      </Typography>
                    )}

                    {/* Zero response indicator */}
                    {option.count === 0 && (
                      <Typography
                        variant="caption"
                        sx={{
                          color: theme.palette.text.disabled,
                          fontStyle: 'italic',
                        }}
                      >
                        No responses
                      </Typography>
                    )}
                  </Box>
                </>
              )}
            </Box>
          </Tooltip>
        ))}
      </Box>

      {/* Empty state message if no options */}
      {options.length === 0 && (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '200px',
          }}
        >
          <Typography
            variant="body1"
            color="text.secondary"
            sx={{ fontStyle: 'italic' }}
          >
            No response data available
          </Typography>
        </Box>
      )}
    </Paper>
  );
};

export default ChoiceChart;
