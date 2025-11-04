/**
 * Card Component
 * 
 * Reusable content container component extending MUI Card with elevation, actions, and theming support.
 * Provides consistent styling for displaying courses, users, assignments, and other data entities
 * across the application. Supports interactive and non-interactive variants with customizable
 * headers and action areas.
 * 
 * Features:
 * - Extends Material-UI Card with consistent elevation and padding
 * - Optional header with title, subtitle, and avatar
 * - Optional action buttons positioned at bottom
 * - Interactive clickable variant with hover/focus effects
 * - Full keyboard navigation support
 * - WCAG 2.1 AA compliant with proper ARIA labels
 * - Light and dark mode support through MUI theming
 * - TypeScript strict mode with explicit prop interfaces
 * 
 * @example
 * // Basic card
 * <Card title="Course Title" subtitle="Instructor Name">
 *   <Typography>Course description content</Typography>
 * </Card>
 * 
 * @example
 * // Interactive clickable card
 * <Card
 *   title="Assignment"
 *   clickable
 *   onClick={() => navigate('/assignment/1')}
 *   ariaLabel="View assignment details"
 * >
 *   <Typography>Due: Tomorrow</Typography>
 * </Card>
 * 
 * @example
 * // Card with avatar and actions
 * <Card
 *   title="John Doe"
 *   subtitle="Student"
 *   avatar={<Avatar src="/path/to/avatar.jpg" />}
 *   actions={[
 *     <Button key="view">View Profile</Button>,
 *     <Button key="message">Message</Button>
 *   ]}
 * >
 *   <Typography>Last active: 2 hours ago</Typography>
 * </Card>
 */

import { forwardRef, Children } from 'react';
import type { ReactNode, MouseEvent } from 'react';
import {
  Card as MuiCard,
  CardHeader,
  CardContent,
  CardActions,
  CardActionArea,
  useTheme,
} from '@mui/material';
import type { CardProps as MuiCardProps } from '@mui/material';

/**
 * Props interface for the Card component
 * Extends Material-UI CardProps for full compatibility with MUI theming system
 */
export interface CardProps extends Omit<MuiCardProps, 'onClick' | 'title'> {
  /**
   * Optional title text displayed in the card header
   * If provided, CardHeader will be rendered with consistent typography
   */
  title?: ReactNode;

  /**
   * Optional subtitle text displayed below the title in the card header
   * Supports string or ReactNode for custom formatting
   */
  subtitle?: ReactNode;

  /**
   * Optional avatar element displayed at the start of the card header
   * Typically an Avatar component or icon
   */
  avatar?: ReactNode;

  /**
   * Optional array of action elements (buttons, icons) displayed at the bottom of the card
   * Each action should be a React element with a unique key
   */
  actions?: ReactNode[];

  /**
   * Main content to be displayed in the card body
   * Wrapped in CardContent with consistent padding
   */
  children?: ReactNode;

  /**
   * Card elevation (shadow depth) from 0-24
   * Higher values create deeper shadows
   * @default 1
   */
  elevation?: number;

  /**
   * Card style variant
   * - 'elevation': Card with shadow (default)
   * - 'outlined': Card with border and no shadow
   * @default 'elevation'
   */
  variant?: 'elevation' | 'outlined';

  /**
   * Makes the entire card clickable with hover and focus effects
   * When true, wraps content in CardActionArea for proper interaction feedback
   * @default false
   */
  clickable?: boolean;

  /**
   * Click handler function called when the card is clicked
   * Only applies when clickable is true
   * Receives the mouse event as parameter
   */
  onClick?: (event: MouseEvent<HTMLElement>) => void;

  /**
   * Disables interaction with the card
   * When true, removes click handlers and applies disabled styling
   * @default false
   */
  disabled?: boolean;

  /**
   * Additional CSS class name for custom styling
   * Applied to the root Card element
   */
  className?: string;

  /**
   * Material-UI sx prop for advanced styling
   * Supports responsive values and theme-aware styling
   */
  sx?: MuiCardProps['sx'];

  /**
   * ARIA label for accessibility
   * Required when clickable is true for screen reader users
   * Describes the purpose of the clickable card
   */
  ariaLabel?: string;
}

/**
 * Card Component
 * 
 * Reusable content container extending Material-UI Card with consistent styling,
 * accessibility features, and theme support. Replaces PHP-rendered content containers
 * throughout Moodle's interface with a modern React implementation.
 * 
 * This component provides:
 * - Consistent elevation and spacing across all card instances
 * - Optional header section with title, subtitle, and avatar
 * - Optional action buttons positioned at the bottom
 * - Interactive clickable variant with proper focus management
 * - Full keyboard navigation (Enter and Space keys)
 * - WCAG 2.1 AA compliance with proper semantic HTML and ARIA labels
 * - Automatic theme adaptation for light and dark modes
 */
const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      title,
      subtitle,
      avatar,
      actions,
      children,
      elevation = 1,
      variant = 'elevation',
      clickable = false,
      onClick,
      disabled = false,
      className,
      sx,
      ariaLabel,
      ...otherProps
    },
    ref
  ) => {
    const theme = useTheme();

    /**
     * Handles click events on the card when clickable is true
     * Prevents click handling when card is disabled
     * 
     * @param event - Mouse event from click interaction
     */
    const handleClick = (event: MouseEvent<HTMLElement>) => {
      if (!disabled && onClick) {
        onClick(event);
      }
    };

    /**
     * Determines if the card should render a header section
     * Header is shown when any of title, subtitle, or avatar props are provided
     */
    const hasHeader = Boolean(title ?? subtitle ?? avatar);

    /**
     * Determines if the card should render an actions section
     * Actions section is shown when actions array is provided and not empty
     */
    const hasActions = Boolean(actions && actions.length > 0);

    /**
     * Renders the card content section
     * Wraps children in CardContent with consistent padding
     * Returns null if no children are provided
     */
    const renderContent = () => {
      if (!children) {
        return null;
      }

      return (
        <CardContent
          sx={{
            '&:last-child': {
              paddingBottom: hasActions ? 2 : 3,
            },
          }}
        >
          {children}
        </CardContent>
      );
    };

    /**
     * Renders the main card body
     * If clickable, wraps content in CardActionArea for interaction feedback
     * Otherwise, renders content directly
     */
    const renderBody = () => {
      const content = (
        <>
          {hasHeader && (
            <CardHeader
              avatar={avatar}
              title={title}
              subheader={subtitle}
              sx={{
                '& .MuiCardHeader-content': {
                  overflow: 'hidden',
                },
                '& .MuiCardHeader-title': {
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                },
                '& .MuiCardHeader-subheader': {
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                },
              }}
            />
          )}
          {renderContent()}
        </>
      );

      if (clickable && onClick) {
        return (
          <CardActionArea
            onClick={handleClick}
            disabled={disabled}
            aria-label={ariaLabel ?? (typeof title === 'string' ? `View ${title}` : 'View card details')}
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'stretch',
              height: '100%',
              '&:focus-visible': {
                outline: `2px solid ${theme.palette.primary.main}`,
                outlineOffset: '2px',
              },
            }}
          >
            {content}
          </CardActionArea>
        );
      }

      return content;
    };

    return (
      <MuiCard
        ref={ref}
        elevation={variant === 'outlined' ? 0 : elevation}
        variant={variant}
        className={className}
        sx={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          opacity: disabled ? 0.6 : 1,
          pointerEvents: disabled ? 'none' : 'auto',
          transition: theme.transitions.create(
            ['box-shadow', 'transform', 'opacity'],
            {
              duration: theme.transitions.duration.shorter,
            }
          ),
          ...(clickable && !disabled && {
            cursor: 'pointer',
            '&:hover': {
              transform: 'translateY(-2px)',
              boxShadow: theme.shadows[Math.min((elevation || 1) + 2, 24) as keyof typeof theme.shadows],
            },
          }),
          ...sx,
        }}
        {...otherProps}
      >
        {renderBody()}
        {hasActions && actions && (
          <CardActions
            sx={{
              marginTop: 'auto',
              padding: 2,
              paddingTop: 1,
              gap: 1,
              flexWrap: 'wrap',
            }}
          >
            {Children.toArray(actions)}
          </CardActions>
        )}
      </MuiCard>
    );
  }
);

// Display name for debugging and React DevTools
Card.displayName = 'Card';

export default Card;
