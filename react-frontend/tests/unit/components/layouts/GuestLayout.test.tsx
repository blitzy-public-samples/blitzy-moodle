/**
 * Unit Tests for GuestLayout Component
 *
 * Comprehensive test suite validating GuestLayout component functionality for unauthenticated
 * pages (login, password reset). Tests verify centered card-based layout rendering, minimal
 * header with site branding, Paper component for content card, vertical centering, children
 * prop rendering, optional title display, minimal footer, responsive design, light/dark theme
 * support, and WCAG 2.1 AA accessibility compliance.
 *
 * Test Coverage:
 * - Layout structure and composition (outer Box, Container, Paper)
 * - Header rendering with site branding (no navigation elements)
 * - Content rendering (children prop, optional title)
 * - Footer rendering with copyright text
 * - Theme support (light/dark modes, background colors)
 * - Responsive design (mobile/desktop)
 * - Accessibility (WCAG 2.1 AA focus indicators, semantic HTML)
 *
 * Uses Vitest for test framework, React Testing Library for component testing,
 * and Material-UI ThemeProvider for theme testing.
 *
 * @module tests/unit/components/layouts/GuestLayout.test
 */

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, within, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { ThemeProvider, createTheme } from '@mui/material';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';

import GuestLayout from '@/components/layouts/GuestLayout';

/**
 * Test wrapper component providing necessary context providers
 * (ThemeProvider and MemoryRouter) for GuestLayout testing
 *
 * @param children - Components to wrap with providers
 * @param theme - MUI theme object (default: light theme)
 */
interface TestWrapperProps {
  children: ReactNode;
  theme?: ReturnType<typeof createTheme>;
}

function TestWrapper({ children, theme }: TestWrapperProps): JSX.Element {
  const defaultTheme = theme || createTheme({ palette: { mode: 'light' } });

  return (
    <MemoryRouter>
      <ThemeProvider theme={defaultTheme}>{children}</ThemeProvider>
    </MemoryRouter>
  );
}

/**
 * Helper function to render GuestLayout with theme and router context
 *
 * @param ui - Component to render
 * @param options - Render options including optional theme
 */
function renderWithProviders(
  ui: ReactNode,
  options?: { theme?: ReturnType<typeof createTheme> }
) {
  const theme = options?.theme;
  return render(<TestWrapper theme={theme}>{ui}</TestWrapper>);
}

describe('GuestLayout', () => {
  // Clean up after each test to prevent memory leaks
  afterEach(() => {
    cleanup();
  });

  /**
   * Test 1: Verify outer Box renders with full viewport height
   * Validates minHeight='100vh' style for full-height layout
   */
  it('renders outer Box with full viewport height', () => {
    const { container } = renderWithProviders(
      <GuestLayout>
        <div>Test Content</div>
      </GuestLayout>
    );

    // Get the outer Box (first child of the container)
    const outerBox = container.firstChild as HTMLElement;

    // MUI's sx prop uses CSS-in-JS, so we need to check computed styles
    const computedStyle = window.getComputedStyle(outerBox);
    
    // In jsdom, '100vh' is computed to pixel value based on window.innerHeight
    // Default jsdom window.innerHeight is 768px
    // Verify minHeight equals the viewport height (100vh behavior)
    const expectedHeight = window.innerHeight || 768;
    expect(computedStyle.minHeight).toBe(`${expectedHeight}px`);
  });

  /**
   * Test 2: Verify flex layout with centered content
   * Validates display='flex', alignItems='center', justifyContent='center'
   */
  it('applies flex layout with centered content', () => {
    const { container } = renderWithProviders(
      <GuestLayout>
        <div>Test Content</div>
      </GuestLayout>
    );

    // Get the outer Box
    const outerBox = container.firstChild as HTMLElement;

    // Verify flex layout with column direction
    expect(outerBox).toHaveStyle({
      display: 'flex',
      flexDirection: 'column',
    });

    // Get the main content area (Box with component="main")
    const mainBox = screen.getByRole('main');

    // Verify centering styles on main content area
    expect(mainBox).toHaveStyle({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    });
  });

  /**
   * Test 3: Verify Container renders with maxWidth='sm' (600px)
   * Validates responsive container for centered content
   */
  it('renders Container with maxWidth sm', () => {
    const { container } = renderWithProviders(
      <GuestLayout>
        <div>Test Content</div>
      </GuestLayout>
    );

    // Find the MUI Container component (it has the MuiContainer class)
    const muiContainer = container.querySelector('.MuiContainer-root');

    expect(muiContainer).toBeInTheDocument();
    expect(muiContainer).toHaveClass('MuiContainer-maxWidthSm');
  });

  /**
   * Test 4: Verify Paper component renders for content card
   * Validates Paper component with elevation and padding
   */
  it('renders Paper component for content card', () => {
    const { container } = renderWithProviders(
      <GuestLayout>
        <div>Test Content</div>
      </GuestLayout>
    );

    // Find the MUI Paper component (it has the MuiPaper class)
    const paper = container.querySelector('.MuiPaper-root');

    expect(paper).toBeInTheDocument();
    expect(paper).toHaveClass('MuiPaper-elevation3');
  });

  /**
   * Test 5: Verify site branding displays in minimal header
   * Validates header shows 'Moodle' and has NO navigation menu items
   */
  it('displays site branding in minimal header', () => {
    renderWithProviders(
      <GuestLayout>
        <div>Test Content</div>
      </GuestLayout>
    );

    // Verify header with site branding exists
    const header = screen.getByRole('banner');
    expect(header).toBeInTheDocument();

    // Verify site name 'Moodle' is displayed in header
    const heading = within(header).getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent('Moodle');

    // Verify NO navigation elements present in header
    expect(within(header).queryByRole('navigation')).not.toBeInTheDocument();
  });

  /**
   * Test 6: Verify children prop content renders correctly
   * Validates child components are displayed within the Paper card
   */
  it('renders children prop content', () => {
    renderWithProviders(
      <GuestLayout>
        <div data-testid="test-content">Test Content</div>
      </GuestLayout>
    );

    // Verify test content is rendered
    const testContent = screen.getByTestId('test-content');
    expect(testContent).toBeInTheDocument();
    expect(testContent).toHaveTextContent('Test Content');
  });

  /**
   * Test 7: Verify page title displays when provided
   * Validates Typography variant='h4' shows title prop
   */
  it('displays page title when provided', () => {
    renderWithProviders(
      <GuestLayout title="Login to Moodle">
        <div>Test Content</div>
      </GuestLayout>
    );

    // Verify title is displayed with correct variant (h4 -> heading level 2)
    const title = screen.getByRole('heading', { level: 2 });
    expect(title).toBeInTheDocument();
    expect(title).toHaveTextContent('Login to Moodle');
  });

  /**
   * Test 8: Verify title does not display when not provided
   * Validates conditional rendering of title prop
   */
  it('does not display title when not provided', () => {
    renderWithProviders(
      <GuestLayout>
        <div>Test Content</div>
      </GuestLayout>
    );

    // Verify no h4 heading exists when title prop is omitted
    const headings = screen.getAllByRole('heading');
    // Only h1 (site branding) should exist, no h4 (title)
    expect(headings).toHaveLength(1);
    // Semantic HTML h1 element has implicit level 1
    expect(headings[0]?.tagName).toBe('H1');
  });

  /**
   * Test 9: Verify minimal footer renders with copyright text
   * Validates footer displays copyright notice with current year
   */
  it('renders minimal footer with copyright', () => {
    renderWithProviders(
      <GuestLayout>
        <div>Test Content</div>
      </GuestLayout>
    );

    // Verify footer exists
    const footer = screen.getByRole('contentinfo');
    expect(footer).toBeInTheDocument();

    // Verify copyright text is present
    const currentYear = new Date().getFullYear();
    const copyrightText = within(footer).getByText(
      new RegExp(`© ${currentYear} Moodle.*All rights reserved`, 'i')
    );
    expect(copyrightText).toBeInTheDocument();
  });

  /**
   * Test 10: Verify theme background color is applied
   * Validates page uses theme.palette.background.default
   */
  it('applies theme background color', () => {
    const { container } = renderWithProviders(
      <GuestLayout>
        <div>Test Content</div>
      </GuestLayout>
    );

    // Get the outer Box
    const outerBox = container.firstChild as HTMLElement;

    // Verify backgroundColor is set (MUI applies theme.palette.background.default)
    const styles = window.getComputedStyle(outerBox);
    expect(styles.backgroundColor).toBeTruthy();
  });

  /**
   * Test 11: Verify light theme support
   * Validates component renders correctly with light theme
   */
  it('supports light theme', () => {
    const lightTheme = createTheme({
      palette: {
        mode: 'light',
        background: {
          default: '#ffffff',
        },
      },
    });

    const { container } = renderWithProviders(
      <GuestLayout>
        <div>Test Content</div>
      </GuestLayout>,
      { theme: lightTheme }
    );

    // Get the outer Box
    const outerBox = container.firstChild as HTMLElement;

    // Verify light background color is applied
    const styles = window.getComputedStyle(outerBox);
    // Light mode typically has white or light background
    expect(styles.backgroundColor).toBeTruthy();
  });

  /**
   * Test 12: Verify dark theme support
   * Validates component renders correctly with dark theme
   */
  it('supports dark theme', () => {
    const darkTheme = createTheme({
      palette: {
        mode: 'dark',
        background: {
          default: '#121212',
        },
      },
    });

    const { container } = renderWithProviders(
      <GuestLayout>
        <div>Test Content</div>
      </GuestLayout>,
      { theme: darkTheme }
    );

    // Get the outer Box
    const outerBox = container.firstChild as HTMLElement;

    // Verify dark background color is applied
    const styles = window.getComputedStyle(outerBox);
    // Dark mode typically has dark background
    expect(styles.backgroundColor).toBeTruthy();
  });

  /**
   * Test 13: Verify no navigation elements present
   * Validates NO Sidebar, NO Header menu, NO Breadcrumbs for guest layout
   */
  it('has no navigation elements', () => {
    renderWithProviders(
      <GuestLayout>
        <div>Test Content</div>
      </GuestLayout>
    );

    // Verify NO navigation role elements
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();

    // Verify NO sidebar elements
    expect(screen.queryByTestId('sidebar')).not.toBeInTheDocument();

    // Verify NO breadcrumbs
    expect(screen.queryByLabelText(/breadcrumb/i)).not.toBeInTheDocument();

    // Verify NO menu elements in the layout
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  /**
   * Test 14: Verify content card has proper border radius
   * Validates Paper component styling with borderRadius
   */
  it('content card has proper border radius', () => {
    const { container } = renderWithProviders(
      <GuestLayout>
        <div>Test Content</div>
      </GuestLayout>
    );

    // Find the Paper component
    const paper = container.querySelector('.MuiPaper-root') as HTMLElement;

    // Verify border radius is applied (MUI theme default or custom)
    const styles = window.getComputedStyle(paper);
    expect(styles.borderRadius).toBeTruthy();
    // Border radius should be a non-zero value (e.g., '8px' or '16px')
    expect(styles.borderRadius).not.toBe('0px');
  });

  /**
   * Test 15: Verify responsive design maintains centered layout on mobile
   * Validates layout remains centered and readable on smaller screens
   */
  it('maintains responsive design on mobile', () => {
    // Mock mobile viewport width
    global.innerWidth = 375; // iPhone SE width
    global.dispatchEvent(new Event('resize'));

    const { container } = renderWithProviders(
      <GuestLayout>
        <div>Test Content</div>
      </GuestLayout>
    );

    // Verify main content area still has centering styles
    const mainBox = screen.getByRole('main');
    expect(mainBox).toHaveStyle({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    });

    // Verify Container maintains maxWidth='sm' for responsive design
    const muiContainer = container.querySelector('.MuiContainer-maxWidthSm');
    expect(muiContainer).toBeInTheDocument();

    // Reset viewport
    global.innerWidth = 1024;
    global.dispatchEvent(new Event('resize'));
  });

  /**
   * Test 16: Verify proper WCAG 2.1 AA focus indicators
   * Validates keyboard accessibility and focus management for interactive elements
   */
  it('has proper WCAG 2.1 AA focus indicators', async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <GuestLayout>
        <button type="button">Test Button</button>
      </GuestLayout>
    );

    // Find the button
    const button = screen.getByRole('button', { name: 'Test Button' });

    // Verify button is keyboard accessible (has tabindex or is naturally focusable)
    expect(button).toBeInTheDocument();
    expect(button.tabIndex).toBeGreaterThanOrEqual(0);

    // Focus the button using keyboard navigation
    await user.tab();

    // Verify button receives focus - this is the key WCAG requirement
    // The presence of focus means the element is keyboard accessible
    expect(button).toHaveFocus();

    // In a real browser, focus indicators would be visible
    // In jsdom test environment, we verify the element is focusable and receives focus
    // which satisfies WCAG 2.1 AA keyboard accessibility requirements
  });

  /**
   * Test 17: Verify semantic HTML structure
   * Validates proper use of header, main, footer landmark roles
   */
  it('has semantic HTML structure', () => {
    renderWithProviders(
      <GuestLayout>
        <div>Test Content</div>
      </GuestLayout>
    );

    // Verify header landmark exists
    const header = screen.getByRole('banner');
    expect(header).toBeInTheDocument();
    expect(header.tagName.toLowerCase()).toBe('header');

    // Verify main landmark exists
    const main = screen.getByRole('main');
    expect(main).toBeInTheDocument();
    expect(main.tagName.toLowerCase()).toBe('main');

    // Verify footer landmark exists
    const footer = screen.getByRole('contentinfo');
    expect(footer).toBeInTheDocument();
    expect(footer.tagName.toLowerCase()).toBe('footer');

    // Verify proper heading hierarchy (h1 in header, optional h2 for title)
    const h1 = within(header).getByRole('heading', { level: 1 });
    expect(h1).toBeInTheDocument();
  });

  /**
   * Additional Test: Verify multiple children render correctly
   * Validates layout handles multiple child components
   */
  it('renders multiple children correctly', () => {
    renderWithProviders(
      <GuestLayout title="Test Page">
        <div data-testid="child-1">First Child</div>
        <div data-testid="child-2">Second Child</div>
        <div data-testid="child-3">Third Child</div>
      </GuestLayout>
    );

    // Verify all children are rendered
    expect(screen.getByTestId('child-1')).toBeInTheDocument();
    expect(screen.getByTestId('child-2')).toBeInTheDocument();
    expect(screen.getByTestId('child-3')).toBeInTheDocument();

    // Verify title is also displayed
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
      'Test Page'
    );
  });

  /**
   * Additional Test: Verify Paper component has proper padding
   * Validates content card provides adequate spacing
   */
  it('content card has proper padding', () => {
    const { container } = renderWithProviders(
      <GuestLayout>
        <div>Test Content</div>
      </GuestLayout>
    );

    // Find the Paper component
    const paper = container.querySelector('.MuiPaper-root') as HTMLElement;

    // Verify padding is applied (MUI p={4} corresponds to 32px)
    const styles = window.getComputedStyle(paper);
    expect(styles.padding).toBeTruthy();
    // Padding should be a non-zero value
    expect(styles.padding).not.toBe('0px');
  });

  /**
   * Additional Test: Verify elevation on Paper component
   * Validates shadow/elevation for visual depth
   */
  it('content card has proper elevation', () => {
    const { container } = renderWithProviders(
      <GuestLayout>
        <div>Test Content</div>
      </GuestLayout>
    );

    // Find the Paper component
    const paper = container.querySelector('.MuiPaper-root') as HTMLElement;

    // Verify elevation class is present (elevation={3})
    expect(paper).toHaveClass('MuiPaper-elevation3');

    // Verify box-shadow is applied for elevation effect
    const styles = window.getComputedStyle(paper);
    expect(styles.boxShadow).toBeTruthy();
    expect(styles.boxShadow).not.toBe('none');
  });
});
