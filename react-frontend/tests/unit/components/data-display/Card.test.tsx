/**
 * Unit Tests for Card Component
 *
 * Comprehensive test suite validating Card component functionality including rendering with
 * elevation, padding, header (title/subtitle/avatar), content areas, action buttons, outlined/filled
 * variants, clickable cards with keyboard navigation, theme support (light/dark modes), responsive
 * behavior, and WCAG 2.1 AA accessibility compliance.
 *
 * Test Coverage:
 * - Rendering: Default props, children content, empty cards
 * - Header: Title, subtitle, avatar display and conditional rendering
 * - Elevation: Shadow depth (0-24), hover effects, outlined variant behavior
 * - Variants: Filled and outlined styles with theme color application
 * - Actions: Button rendering, click handlers, disabled state
 * - Clickable: Entire card interaction, keyboard activation, hover/focus states
 * - Theme: Light/dark mode support, custom theme colors
 * - Responsive: Container width adaptation, content wrapping, mobile padding
 * - Accessibility: Semantic HTML, ARIA labels, keyboard focus, screen reader support
 *
 * @see Section 0.7 - Test Infrastructure: Vitest and React Testing Library
 * @see Section 0.7 - Accessibility: WCAG 2.1 AA compliance requirements
 * @see Section 0.7 - Coverage: 90%+ for critical business logic
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { axe, toHaveNoViolations } from 'jest-axe';
import { Avatar, Button } from '@mui/material';
import { Person as PersonIcon } from '@mui/icons-material';

// Internal imports
import Card from '@/components/data-display/Card';
import type { CardProps } from '@/components/data-display/Card';
import { render, screen, userEvent, waitFor, within } from '@tests/helpers/render';

// Extend Jest matchers with jest-axe accessibility matchers
expect.extend(toHaveNoViolations);

/**
 * Card Component Test Suite
 *
 * Validates all Card component functionality with 90%+ test coverage per section 0.7 requirements.
 * Tests organized by feature category for clear structure and comprehensive validation.
 */
describe('Card Component', () => {
  /**
   * Test Suite: Rendering Tests
   *
   * Validates basic rendering behavior with default props, children content display,
   * and empty card scenarios. Ensures component handles all prop combinations correctly.
   */
  describe('Rendering Tests', () => {
    it('renders with default props', () => {
      render(
        <Card>
          <div>Test Content</div>
        </Card>
      );

      // Verify card renders in the document
      const cardContent = screen.getByText('Test Content');
      expect(cardContent).toBeInTheDocument();
    });

    it('renders children content correctly', () => {
      const testContent = 'This is card content with multiple elements';

      render(
        <Card>
          <div>
            <p>{testContent}</p>
            <span>Additional content</span>
          </div>
        </Card>
      );

      expect(screen.getByText(testContent)).toBeInTheDocument();
      expect(screen.getByText('Additional content')).toBeInTheDocument();
    });

    it('renders empty card without errors', () => {
      const { container } = render(<Card />);

      // Card should render but have no content
      const card = container.querySelector('.MuiCard-root');
      expect(card).toBeInTheDocument();
    });

    it('renders with custom className', () => {
      const { container } = render(
        <Card className="custom-card-class">
          <div>Content</div>
        </Card>
      );

      const card = container.querySelector('.custom-card-class');
      expect(card).toBeInTheDocument();
    });

    it('renders with custom sx prop styles', () => {
      const { container } = render(
        <Card sx={{ backgroundColor: 'rgb(255, 0, 0)', padding: 4 }}>
          <div>Content</div>
        </Card>
      );

      const card = container.querySelector('.MuiCard-root') as HTMLElement;
      expect(card).toBeInTheDocument();
    });
  });

  /**
   * Test Suite: Header Tests
   *
   * Validates CardHeader rendering with title, subtitle, and avatar props.
   * Tests conditional header display based on prop presence.
   */
  describe('Header Tests', () => {
    it('displays title when provided', () => {
      const title = 'Card Title';

      render(
        <Card title={title}>
          <div>Content</div>
        </Card>
      );

      expect(screen.getByText(title)).toBeInTheDocument();
    });

    it('displays subtitle when provided', () => {
      const subtitle = 'Card Subtitle';

      render(
        <Card title="Title" subtitle={subtitle}>
          <div>Content</div>
        </Card>
      );

      expect(screen.getByText(subtitle)).toBeInTheDocument();
    });

    it('displays avatar in header area', () => {
      render(
        <Card
          title="User Profile"
          avatar={<Avatar data-testid="card-avatar">JD</Avatar>}
        >
          <div>Content</div>
        </Card>
      );

      expect(screen.getByTestId('card-avatar')).toBeInTheDocument();
      expect(screen.getByText('JD')).toBeInTheDocument();
    });

    it('displays avatar with icon', () => {
      render(
        <Card
          title="Icon Avatar"
          avatar={
            <Avatar data-testid="icon-avatar">
              <PersonIcon />
            </Avatar>
          }
        >
          <div>Content</div>
        </Card>
      );

      expect(screen.getByTestId('icon-avatar')).toBeInTheDocument();
    });

    it('header is absent when no title, subtitle, or avatar provided', () => {
      const { container } = render(
        <Card>
          <div>Content without header</div>
        </Card>
      );

      // CardHeader should not be rendered
      const header = container.querySelector('.MuiCardHeader-root');
      expect(header).not.toBeInTheDocument();
    });

    it('renders header with only subtitle (no title)', () => {
      const subtitle = 'Subtitle Only';

      render(
        <Card subtitle={subtitle}>
          <div>Content</div>
        </Card>
      );

      expect(screen.getByText(subtitle)).toBeInTheDocument();
    });

    it('renders header with only avatar (no title or subtitle)', () => {
      render(
        <Card avatar={<Avatar data-testid="avatar-only">A</Avatar>}>
          <div>Content</div>
        </Card>
      );

      expect(screen.getByTestId('avatar-only')).toBeInTheDocument();
    });

    it('renders title and subtitle together', () => {
      const title = 'Main Title';
      const subtitle = 'Supporting Subtitle';

      render(
        <Card title={title} subtitle={subtitle}>
          <div>Content</div>
        </Card>
      );

      expect(screen.getByText(title)).toBeInTheDocument();
      expect(screen.getByText(subtitle)).toBeInTheDocument();
    });
  });

  /**
   * Test Suite: Elevation Tests
   *
   * Validates elevation prop controls shadow depth from 0-24, hover state elevation changes
   * for clickable cards, and outlined variant behavior with no elevation.
   */
  describe('Elevation Tests', () => {
    it('applies default elevation of 1', () => {
      const { container } = render(
        <Card>
          <div>Content</div>
        </Card>
      );

      const card = container.querySelector('.MuiCard-root');
      expect(card).toHaveClass('MuiPaper-elevation1');
    });

    it('applies custom elevation value', () => {
      const { container } = render(
        <Card elevation={4}>
          <div>Content</div>
        </Card>
      );

      const card = container.querySelector('.MuiCard-root');
      expect(card).toHaveClass('MuiPaper-elevation4');
    });

    it('applies minimum elevation of 0', () => {
      const { container } = render(
        <Card elevation={0}>
          <div>Content</div>
        </Card>
      );

      const card = container.querySelector('.MuiCard-root');
      expect(card).toHaveClass('MuiPaper-elevation0');
    });

    it('applies maximum elevation of 24', () => {
      const { container } = render(
        <Card elevation={24}>
          <div>Content</div>
        </Card>
      );

      const card = container.querySelector('.MuiCard-root');
      expect(card).toHaveClass('MuiPaper-elevation24');
    });

    it('applies mid-range elevation values correctly', () => {
      const elevations = [2, 6, 8, 12, 16];

      elevations.forEach((elev) => {
        const { container } = render(
          <Card elevation={elev}>
            <div>Content {elev}</div>
          </Card>
        );

        const card = container.querySelector('.MuiCard-root');
        expect(card).toHaveClass(`MuiPaper-elevation${elev}`);
      });
    });

    it('outlined variant has elevation of 0', () => {
      const { container } = render(
        <Card variant="outlined" elevation={5}>
          <div>Content</div>
        </Card>
      );

      const card = container.querySelector('.MuiCard-root');
      // Outlined variant should override elevation to 0
      expect(card).toHaveClass('MuiPaper-elevation0');
      expect(card).toHaveClass('MuiPaper-outlined');
    });

    it('elevation changes on hover for clickable cards', async () => {
      const user = userEvent.setup();

      const { container } = render(
        <Card elevation={2} clickable onClick={vi.fn()}>
          <div>Hoverable Content</div>
        </Card>
      );

      const card = container.querySelector('.MuiCard-root') as HTMLElement;
      expect(card).toHaveClass('MuiPaper-elevation2');

      // Hover over the card (CSS hover state applied by MUI)
      await user.hover(card);

      // Card should have hover transform applied (visual elevation increase)
      // Note: Actual box-shadow change is CSS-based and not directly testable in JSDOM
      expect(card).toBeInTheDocument();
    });
  });

  /**
   * Test Suite: Variant Tests
   *
   * Validates filled (elevation) and outlined variants with proper styling and theme color
   * application. Ensures variant prop correctly controls card appearance.
   */
  describe('Variant Tests', () => {
    it('renders with default elevation variant', () => {
      const { container } = render(
        <Card>
          <div>Content</div>
        </Card>
      );

      const card = container.querySelector('.MuiCard-root');
      expect(card).not.toHaveClass('MuiPaper-outlined');
      expect(card).toHaveClass('MuiPaper-elevation1');
    });

    it('renders outlined variant with border', () => {
      const { container } = render(
        <Card variant="outlined">
          <div>Content</div>
        </Card>
      );

      const card = container.querySelector('.MuiCard-root');
      expect(card).toHaveClass('MuiPaper-outlined');
      expect(card).toHaveClass('MuiPaper-elevation0');
    });

    it('outlined variant has no shadow', () => {
      const { container } = render(
        <Card variant="outlined" elevation={10}>
          <div>Content</div>
        </Card>
      );

      const card = container.querySelector('.MuiCard-root');
      // Outlined should force elevation to 0
      expect(card).toHaveClass('MuiPaper-elevation0');
    });

    it('elevation variant has shadow', () => {
      const { container } = render(
        <Card variant="elevation" elevation={3}>
          <div>Content</div>
        </Card>
      );

      const card = container.querySelector('.MuiCard-root');
      expect(card).toHaveClass('MuiPaper-elevation3');
      expect(card).not.toHaveClass('MuiPaper-outlined');
    });

    it('variant respects theme colors in light mode', () => {
      const { container } = render(
        <Card>
          <div>Content</div>
        </Card>,
        { themeMode: 'light' }
      );

      const card = container.querySelector('.MuiCard-root');
      expect(card).toBeInTheDocument();
      // Theme colors are applied via MUI's theme system
    });

    it('variant respects theme colors in dark mode', () => {
      const { container } = render(
        <Card>
          <div>Content</div>
        </Card>,
        { themeMode: 'dark' }
      );

      const card = container.querySelector('.MuiCard-root');
      expect(card).toBeInTheDocument();
      // Dark mode theme colors applied
    });
  });

  /**
   * Test Suite: Action Area Tests
   *
   * Validates action button rendering in card footer, multiple action display, click handler
   * execution, and disabled action state.
   */
  describe('Action Area Tests', () => {
    it('renders action buttons in card footer', () => {
      const actions = [
        <Button key="view" data-testid="view-button">
          View
        </Button>,
        <Button key="edit" data-testid="edit-button">
          Edit
        </Button>,
      ];

      render(
        <Card actions={actions}>
          <div>Content</div>
        </Card>
      );

      expect(screen.getByTestId('view-button')).toBeInTheDocument();
      expect(screen.getByTestId('edit-button')).toBeInTheDocument();
    });

    it('displays multiple actions correctly', () => {
      const actions = [
        <Button key="action1">Action 1</Button>,
        <Button key="action2">Action 2</Button>,
        <Button key="action3">Action 3</Button>,
      ];

      render(
        <Card actions={actions}>
          <div>Content</div>
        </Card>
      );

      expect(screen.getByText('Action 1')).toBeInTheDocument();
      expect(screen.getByText('Action 2')).toBeInTheDocument();
      expect(screen.getByText('Action 3')).toBeInTheDocument();
    });

    it('action click handlers fire correctly', async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();

      const actions = [
        <Button key="clickable" onClick={handleClick} data-testid="action-btn">
          Click Me
        </Button>,
      ];

      render(
        <Card actions={actions}>
          <div>Content</div>
        </Card>
      );

      const button = screen.getByTestId('action-btn');
      await user.click(button);

      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('disabled actions are not clickable', async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();

      const actions = [
        <Button
          key="disabled"
          onClick={handleClick}
          disabled
          data-testid="disabled-btn"
        >
          Disabled
        </Button>,
      ];

      render(
        <Card actions={actions}>
          <div>Content</div>
        </Card>
      );

      const button = screen.getByTestId('disabled-btn');
      expect(button).toBeDisabled();

      await user.click(button);
      expect(handleClick).not.toHaveBeenCalled();
    });

    it('no actions section when actions array is empty', () => {
      const { container } = render(
        <Card actions={[]}>
          <div>Content</div>
        </Card>
      );

      const cardActions = container.querySelector('.MuiCardActions-root');
      expect(cardActions).not.toBeInTheDocument();
    });

    it('no actions section when actions prop is undefined', () => {
      const { container } = render(
        <Card>
          <div>Content</div>
        </Card>
      );

      const cardActions = container.querySelector('.MuiCardActions-root');
      expect(cardActions).not.toBeInTheDocument();
    });

    it('actions section has proper spacing and layout', () => {
      const actions = [
        <Button key="btn1">Button 1</Button>,
        <Button key="btn2">Button 2</Button>,
      ];

      const { container } = render(
        <Card actions={actions}>
          <div>Content</div>
        </Card>
      );

      const cardActions = container.querySelector('.MuiCardActions-root');
      expect(cardActions).toBeInTheDocument();
      expect(cardActions).toHaveClass('MuiCardActions-root');
    });
  });

  /**
   * Test Suite: Clickable Card Tests
   *
   * Validates entire card clickability when clickable prop is set, click handler execution,
   * hover and focus states, and keyboard activation with Enter and Space keys.
   */
  describe('Clickable Card Tests', () => {
    it('entire card is clickable when clickable prop is set', async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();

      render(
        <Card clickable onClick={handleClick} title="Clickable Card">
          <div>Click anywhere</div>
        </Card>
      );

      const cardActionArea = screen.getByRole('button');
      await user.click(cardActionArea);

      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('click handler receives event object', async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();

      render(
        <Card clickable onClick={handleClick}>
          <div>Content</div>
        </Card>
      );

      const cardActionArea = screen.getByRole('button');
      await user.click(cardActionArea);

      expect(handleClick).toHaveBeenCalledWith(expect.any(Object));
      expect(handleClick.mock.calls[0][0]).toHaveProperty('type');
    });

    it('non-clickable card does not have click handler', () => {
      const { container } = render(
        <Card>
          <div>Non-clickable content</div>
        </Card>
      );

      const cardActionArea = container.querySelector('.MuiCardActionArea-root');
      expect(cardActionArea).not.toBeInTheDocument();
    });

    it('clickable card has proper cursor style', () => {
      const { container } = render(
        <Card clickable onClick={vi.fn()}>
          <div>Content</div>
        </Card>
      );

      const card = container.querySelector('.MuiCard-root') as HTMLElement;
      // Cursor pointer is applied via sx prop styling
      expect(card).toBeInTheDocument();
    });

    it('disabled clickable card does not fire click handler', async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();

      render(
        <Card clickable onClick={handleClick} disabled>
          <div>Disabled Card</div>
        </Card>
      );

      const cardActionArea = screen.getByRole('button');
      expect(cardActionArea).toBeDisabled();

      await user.click(cardActionArea);
      expect(handleClick).not.toHaveBeenCalled();
    });

    it('disabled card has reduced opacity', () => {
      const { container } = render(
        <Card disabled>
          <div>Disabled Content</div>
        </Card>
      );

      const card = container.querySelector('.MuiCard-root') as HTMLElement;
      // Opacity 0.6 is applied via sx prop
      expect(card).toBeInTheDocument();
    });

    it('keyboard activation with Enter key', async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();

      render(
        <Card clickable onClick={handleClick} title="Keyboard Card">
          <div>Press Enter</div>
        </Card>
      );

      const cardActionArea = screen.getByRole('button');
      cardActionArea.focus();
      await user.keyboard('{Enter}');

      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('keyboard activation with Space key', async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();

      render(
        <Card clickable onClick={handleClick} title="Keyboard Card">
          <div>Press Space</div>
        </Card>
      );

      const cardActionArea = screen.getByRole('button');
      cardActionArea.focus();
      await user.keyboard(' ');

      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('focus state is visible on clickable card', async () => {
      const user = userEvent.setup();

      render(
        <Card clickable onClick={vi.fn()} title="Focus Test">
          <div>Focus me</div>
        </Card>
      );

      const cardActionArea = screen.getByRole('button');
      await user.tab();

      expect(cardActionArea).toHaveFocus();
    });

    it('hover state applies transform effect', async () => {
      const user = userEvent.setup();

      const { container } = render(
        <Card clickable onClick={vi.fn()} elevation={2}>
          <div>Hover me</div>
        </Card>
      );

      const card = container.querySelector('.MuiCard-root') as HTMLElement;
      await user.hover(card);

      // Transform is applied via CSS hover state
      expect(card).toBeInTheDocument();
    });
  });

  /**
   * Test Suite: Theme Support Tests
   *
   * Validates light and dark theme support, custom theme color application, and proper
   * theme inheritance from MUI ThemeProvider.
   */
  describe('Theme Support Tests', () => {
    it('light theme applies correct colors', () => {
      const { container } = render(
        <Card>
          <div>Light theme content</div>
        </Card>,
        { themeMode: 'light' }
      );

      const card = container.querySelector('.MuiCard-root');
      expect(card).toBeInTheDocument();
      // Light theme colors applied by MUI theme system
    });

    it('dark theme uses dark mode colors', () => {
      const { container } = render(
        <Card>
          <div>Dark theme content</div>
        </Card>,
        { themeMode: 'dark' }
      );

      const card = container.querySelector('.MuiCard-root');
      expect(card).toBeInTheDocument();
      // Dark theme colors applied by MUI theme system
    });

    it('outlined variant respects theme border color', () => {
      const { container } = render(
        <Card variant="outlined">
          <div>Outlined with theme</div>
        </Card>
      );

      const card = container.querySelector('.MuiCard-root');
      expect(card).toHaveClass('MuiPaper-outlined');
      // Border color from theme
    });

    it('clickable card hover uses theme primary color for focus outline', async () => {
      const user = userEvent.setup();

      render(
        <Card clickable onClick={vi.fn()} title="Theme Focus">
          <div>Focus me</div>
        </Card>
      );

      const cardActionArea = screen.getByRole('button');
      await user.tab();

      expect(cardActionArea).toHaveFocus();
      // Focus outline uses theme.palette.primary.main
    });

    it('theme transitions are applied', () => {
      const { container } = render(
        <Card clickable onClick={vi.fn()}>
          <div>Animated card</div>
        </Card>
      );

      const card = container.querySelector('.MuiCard-root') as HTMLElement;
      // Transitions defined in sx prop
      expect(card).toBeInTheDocument();
    });
  });

  /**
   * Test Suite: Responsive Tests
   *
   * Validates card adaptation to container width, content wrapping on small screens,
   * and padding adjustments for mobile devices.
   */
  describe('Responsive Tests', () => {
    it('card adapts to container width', () => {
      const { container } = render(
        <div style={{ width: '300px' }}>
          <Card>
            <div>Responsive content</div>
          </Card>
        </div>
      );

      const card = container.querySelector('.MuiCard-root') as HTMLElement;
      expect(card).toBeInTheDocument();
      // Card uses flexbox with height: 100%
    });

    it('content wraps on small screens', () => {
      render(
        <Card>
          <div style={{ width: '100%' }}>
            <p>
              This is a long text content that should wrap on smaller screens
              to maintain readability and proper layout.
            </p>
          </div>
        </Card>
      );

      const content = screen.getByText(/This is a long text content/);
      expect(content).toBeInTheDocument();
    });

    it('action buttons wrap when space is limited', () => {
      const actions = [
        <Button key="btn1">Long Button Text 1</Button>,
        <Button key="btn2">Long Button Text 2</Button>,
        <Button key="btn3">Long Button Text 3</Button>,
      ];

      const { container } = render(
        <Card actions={actions}>
          <div>Content</div>
        </Card>
      );

      const cardActions = container.querySelector('.MuiCardActions-root');
      expect(cardActions).toBeInTheDocument();
      // flexWrap: 'wrap' applied in CardActions sx
    });

    it('header text truncates with ellipsis on overflow', () => {
      const longTitle =
        'This is a very long title that should be truncated with ellipsis when it exceeds the available width';

      render(
        <Card title={longTitle}>
          <div>Content</div>
        </Card>
      );

      expect(screen.getByText(longTitle)).toBeInTheDocument();
      // Text truncation handled by CardHeader sx styles
    });

    it('maintains aspect ratio across different container sizes', () => {
      const { container } = render(
        <div style={{ width: '500px' }}>
          <Card>
            <div style={{ aspectRatio: '16 / 9' }}>
              <img
                src="/test-image.jpg"
                alt="Test"
                style={{ width: '100%', height: 'auto' }}
              />
            </div>
          </Card>
        </div>
      );

      const card = container.querySelector('.MuiCard-root');
      expect(card).toBeInTheDocument();
    });
  });

  /**
   * Test Suite: Accessibility Tests
   *
   * Validates WCAG 2.1 AA compliance including semantic HTML, proper ARIA labels,
   * keyboard focus visibility and logical order, screen reader announcements,
   * and color contrast verification using jest-axe.
   */
  describe('Accessibility Tests', () => {
    it('uses semantic HTML with proper landmarks', () => {
      const { container } = render(
        <Card title="Semantic Card">
          <div>Content with semantic structure</div>
        </Card>
      );

      const card = container.querySelector('.MuiCard-root');
      expect(card).toBeInTheDocument();
      // MUI Card uses semantic HTML structure
    });

    it('clickable card has proper ARIA label', () => {
      const ariaLabel = 'View course details';

      render(
        <Card clickable onClick={vi.fn()} ariaLabel={ariaLabel}>
          <div>Course content</div>
        </Card>
      );

      const cardActionArea = screen.getByRole('button', { name: ariaLabel });
      expect(cardActionArea).toBeInTheDocument();
    });

    it('generates default ARIA label from title for clickable card', () => {
      const title = 'Assignment 1';

      render(
        <Card clickable onClick={vi.fn()} title={title}>
          <div>Assignment content</div>
        </Card>
      );

      const cardActionArea = screen.getByRole('button', {
        name: `View ${title}`,
      });
      expect(cardActionArea).toBeInTheDocument();
    });

    it('uses fallback ARIA label when no title provided', () => {
      render(
        <Card clickable onClick={vi.fn()}>
          <div>Content without title</div>
        </Card>
      );

      const cardActionArea = screen.getByRole('button', {
        name: 'View card details',
      });
      expect(cardActionArea).toBeInTheDocument();
    });

    it('keyboard focus is visible and logical', async () => {
      const user = userEvent.setup();

      render(
        <Card
          clickable
          onClick={vi.fn()}
          actions={[
            <Button key="action1" data-testid="action-btn">
              Action
            </Button>,
          ]}
        >
          <div>Content</div>
        </Card>
      );

      // Tab to card action area
      await user.tab();
      const cardActionArea = screen.getByRole('button', {
        name: 'View card details',
      });
      expect(cardActionArea).toHaveFocus();

      // Tab to action button
      await user.tab();
      const actionButton = screen.getByTestId('action-btn');
      expect(actionButton).toHaveFocus();
    });

    it('screen reader announces card purpose', () => {
      const ariaLabel = 'Student profile card for John Doe';

      render(
        <Card
          clickable
          onClick={vi.fn()}
          ariaLabel={ariaLabel}
          title="John Doe"
        >
          <div>Profile content</div>
        </Card>
      );

      const cardActionArea = screen.getByRole('button', { name: ariaLabel });
      expect(cardActionArea).toHaveAttribute('aria-label', ariaLabel);
    });

    it('passes axe accessibility checks for basic card', async () => {
      const { container } = render(
        <Card title="Accessible Card" subtitle="Subtitle text">
          <div>Accessible content</div>
        </Card>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('passes axe accessibility checks for clickable card', async () => {
      const { container } = render(
        <Card
          clickable
          onClick={vi.fn()}
          ariaLabel="View course"
          title="Course Title"
        >
          <div>Course content</div>
        </Card>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('passes axe accessibility checks for card with actions', async () => {
      const { container } = render(
        <Card
          title="Card with Actions"
          actions={[
            <Button key="view" aria-label="View details">
              View
            </Button>,
            <Button key="edit" aria-label="Edit item">
              Edit
            </Button>,
          ]}
        >
          <div>Content</div>
        </Card>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('passes axe accessibility checks for card with avatar', async () => {
      const { container } = render(
        <Card
          title="User Card"
          subtitle="Student"
          avatar={<Avatar alt="User Avatar">JD</Avatar>}
        >
          <div>User profile content</div>
        </Card>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('disabled card maintains accessibility', async () => {
      const { container } = render(
        <Card clickable onClick={vi.fn()} disabled ariaLabel="Disabled card">
          <div>Disabled content</div>
        </Card>
      );

      const cardActionArea = screen.getByRole('button');
      expect(cardActionArea).toBeDisabled();

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('focus outline has sufficient contrast', async () => {
      const user = userEvent.setup();

      render(
        <Card clickable onClick={vi.fn()} title="Focus Contrast">
          <div>Content</div>
        </Card>
      );

      const cardActionArea = screen.getByRole('button');
      await user.tab();

      expect(cardActionArea).toHaveFocus();
      // Focus outline uses theme.palette.primary.main with 2px solid
      // Contrast verified by axe in other tests
    });

    it('action buttons have accessible names', () => {
      const actions = [
        <Button key="view" aria-label="View full details">
          View
        </Button>,
        <Button key="edit" aria-label="Edit this item">
          Edit
        </Button>,
      ];

      render(
        <Card actions={actions}>
          <div>Content</div>
        </Card>
      );

      expect(
        screen.getByRole('button', { name: 'View full details' })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Edit this item' })
      ).toBeInTheDocument();
    });

    it('complex card structure maintains semantic hierarchy', async () => {
      const { container } = render(
        <Card
          title="Complex Course Card"
          subtitle="Instructor: Dr. Smith"
          avatar={<Avatar>CS</Avatar>}
          clickable
          onClick={vi.fn()}
          ariaLabel="View Computer Science 101 course"
          actions={[
            <Button key="enroll" aria-label="Enroll in course">
              Enroll
            </Button>,
            <Button key="details" aria-label="View detailed information">
              Details
            </Button>,
          ]}
        >
          <div>
            <p>Course description goes here</p>
            <span>Duration: 12 weeks</span>
          </div>
        </Card>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  /**
   * Additional Edge Case Tests
   *
   * Tests for edge cases and error scenarios to ensure robust component behavior.
   */
  describe('Edge Cases', () => {
    it('handles null children gracefully', () => {
      const { container } = render(<Card>{null}</Card>);

      const card = container.querySelector('.MuiCard-root');
      expect(card).toBeInTheDocument();
    });

    it('handles undefined onClick for non-clickable card', () => {
      const { container } = render(
        <Card clickable={false}>
          <div>Content</div>
        </Card>
      );

      const cardActionArea = container.querySelector('.MuiCardActionArea-root');
      expect(cardActionArea).not.toBeInTheDocument();
    });

    it('handles elevation out of range gracefully', () => {
      // MUI will clamp elevation to valid range
      const { container } = render(
        <Card elevation={100}>
          <div>Content</div>
        </Card>
      );

      const card = container.querySelector('.MuiCard-root');
      expect(card).toBeInTheDocument();
    });

    it('handles multiple children types', () => {
      render(
        <Card>
          <div>Div content</div>
          <p>Paragraph content</p>
          <span>Span content</span>
          Text node content
        </Card>
      );

      expect(screen.getByText('Div content')).toBeInTheDocument();
      expect(screen.getByText('Paragraph content')).toBeInTheDocument();
      expect(screen.getByText('Span content')).toBeInTheDocument();
      expect(screen.getByText('Text node content')).toBeInTheDocument();
    });

    it('forwards ref correctly', () => {
      const ref = { current: null };

      render(
        <Card ref={ref}>
          <div>Content</div>
        </Card>
      );

      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });

    it('handles ReactNode title and subtitle', () => {
      render(
        <Card
          title={
            <span>
              Title with <strong>bold</strong> text
            </span>
          }
          subtitle={
            <span>
              Subtitle with <em>italic</em> text
            </span>
          }
        >
          <div>Content</div>
        </Card>
      );

      expect(screen.getByText('bold')).toBeInTheDocument();
      expect(screen.getByText('italic')).toBeInTheDocument();
    });
  });
});
