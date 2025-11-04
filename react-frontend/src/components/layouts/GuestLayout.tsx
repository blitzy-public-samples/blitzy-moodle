/**
 * GuestLayout Component
 * 
 * Layout component for unauthenticated/public pages (login, password reset, registration)
 * providing a centered, minimal interface without navigation elements.
 * 
 * References Moodle's login.mustache template structure from public/theme/boost/templates/login.mustache
 * Implements a simple centered layout without navigation, using Material-UI components.
 * 
 * Features:
 * - Full-height flex container with vertical centering
 * - Responsive design with Container maxWidth='sm' (600px)
 * - Paper component for elevated content card with padding
 * - Minimal header with site branding
 * - Optional page title
 * - Minimal footer with copyright text
 * - Support for both light and dark mode via MUI theme
 * - WCAG 2.1 AA compliant focus indicators
 * 
 * @module components/layouts/GuestLayout
 */

import { type ReactNode } from 'react';
import { Box, Container, Paper, Typography, useTheme } from '@mui/material';

/**
 * Props interface for GuestLayout component
 * 
 * @interface GuestLayoutProps
 * @property {ReactNode} children - Child components to render in the content area (LoginForm, PasswordResetForm, etc.)
 * @property {string} [title] - Optional page title displayed above the content (e.g., 'Login to Moodle')
 */
export interface GuestLayoutProps {
  /** Child components to render in the content area (forms, messages, etc.) */
  children: ReactNode;
  /** Optional page title displayed above the content card */
  title?: string;
}

/**
 * GuestLayout Component
 * 
 * Provides a centered, minimal layout for unauthenticated pages with no navigation elements.
 * Uses Material-UI components to create a full-height flex container with vertically centered
 * content card. Includes minimal header with site branding and footer with copyright text.
 * 
 * Layout Structure:
 * - Outer Box: Full-height (100vh) flex container with theme background color
 * - Header Box: Minimal AppBar-like header with site name, no navigation
 * - Container: Centered content area with maxWidth='sm' (600px)
 * - Paper: Elevated content card with padding and border radius
 * - Optional Typography: Page title (h4 variant)
 * - Children: Rendered form or content components
 * - Footer Typography: Copyright text (caption variant)
 * 
 * Accessibility:
 * - Semantic HTML structure with proper heading hierarchy
 * - Focus indicators meeting WCAG 2.1 AA standards (provided by MUI)
 * - Keyboard navigation support (provided by MUI Paper component)
 * - Screen reader compatible with proper ARIA labels
 * 
 * Theme Support:
 * - Automatically adapts to light and dark mode via MUI theme
 * - Uses theme.palette.background.default for page background
 * - Paper component inherits theme elevation and background
 * 
 * @param {GuestLayoutProps} props - Component props
 * @returns {JSX.Element} Rendered GuestLayout component
 * 
 * @example
 * ```tsx
 * <GuestLayout title="Login to Moodle">
 *   <LoginForm />
 * </GuestLayout>
 * ```
 * 
 * @example
 * ```tsx
 * <GuestLayout title="Reset Password">
 *   <PasswordResetForm />
 * </GuestLayout>
 * ```
 */
function GuestLayout({ children, title }: GuestLayoutProps): JSX.Element {
  // Access MUI theme for background color and responsive design
  const theme = useTheme();

  // Get current year for copyright footer
  const currentYear = new Date().getFullYear();

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: theme.palette.background.default,
      }}
    >
      {/* Minimal Header - Site branding without navigation */}
      <Box
        component="header"
        sx={{
          py: 2,
          px: 3,
          backgroundColor: theme.palette.primary.main,
          color: theme.palette.primary.contrastText,
          boxShadow: theme.shadows[2],
        }}
      >
        <Typography
          variant="h6"
          component="h1"
          sx={{
            fontWeight: 600,
            textAlign: 'center',
          }}
        >
          Moodle
        </Typography>
      </Box>

      {/* Main Content Area - Vertically centered */}
      <Box
        component="main"
        sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          py: 4,
          px: 2,
        }}
      >
        <Container
          maxWidth="sm"
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          {/* Content Card - Elevated Paper with padding */}
          <Paper
            elevation={3}
            sx={{
              width: '100%',
              p: 4,
              borderRadius: 2,
              display: 'flex',
              flexDirection: 'column',
              gap: 3,
              // WCAG 2.1 AA compliant focus indicators
              '&:focus-within': {
                outline: `3px solid ${theme.palette.primary.main}`,
                outlineOffset: '2px',
              },
            }}
          >
            {/* Optional Page Title */}
            {title && (
              <Typography
                variant="h4"
                component="h2"
                align="center"
                gutterBottom
                sx={{
                  fontWeight: 500,
                  color: theme.palette.text.primary,
                  mb: 2,
                }}
              >
                {title}
              </Typography>
            )}

            {/* Render child components (LoginForm, PasswordResetForm, etc.) */}
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
              }}
            >
              {children}
            </Box>
          </Paper>
        </Container>
      </Box>

      {/* Minimal Footer - Copyright text */}
      <Box
        component="footer"
        sx={{
          py: 2,
          px: 3,
          textAlign: 'center',
          backgroundColor: theme.palette.background.paper,
          borderTop: `1px solid ${theme.palette.divider}`,
        }}
      >
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{
            display: 'block',
          }}
        >
          © {currentYear} Moodle. All rights reserved.
        </Typography>
      </Box>
    </Box>
  );
}

export default GuestLayout;
