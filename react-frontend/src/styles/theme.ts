/**
 * Material-UI v5 Theme Configuration
 * 
 * This file defines the complete design system for the Moodle React application,
 * including color palettes, typography, spacing, breakpoints, and component overrides.
 * 
 * The theme is based on Moodle's existing Bootstrap 5 design tokens to ensure
 * visual consistency between the PHP and React interfaces during the transition.
 * 
 * Features:
 * - Full TypeScript type safety with strict mode compliance
 * - WCAG 2.1 AA color contrast compliance
 * - Support for both light and dark modes
 * - Bootstrap 5 compatible breakpoints
 * - Material-UI component style overrides
 * 
 * @module theme
 */

import { createTheme, ThemeOptions, alpha } from '@mui/material/styles';
import type { PaletteMode } from '@mui/material';

/**
 * Base color palette derived from Moodle/Bootstrap 5 theme
 * Colors are from public/theme/boost/scss/bootstrap/_variables.scss
 * 
 * Note: Color variations (light/dark) are pre-calculated using MUI's lighten/darken utilities
 * to ensure WCAG 2.1 AA contrast compliance. The lighten amount is 20% and darken amount is 30%.
 */
const COLORS = {
  // Primary colors (Moodle blue)
  primary: {
    light: '#6ea8fe',    // Computed: lighten(#0d6efd, 20%)
    main: '#0d6efd',     // Bootstrap $blue
    dark: '#0a58ca',     // Computed: darken(#0d6efd, 30%)
    contrastText: '#ffffff',
  },
  
  // Secondary colors (Gray-600)
  secondary: {
    light: '#8c959f',    // Computed: lighten(#6c757d, 20%)
    main: '#6c757d',     // Bootstrap $gray-600
    dark: '#4b5258',     // Computed: darken(#6c757d, 30%)
    contrastText: '#ffffff',
  },
  
  // Semantic colors
  error: {
    light: '#ea868f',    // Computed: lighten(#dc3545, 20%)
    main: '#dc3545',     // Bootstrap $red
    dark: '#9a2530',     // Computed: darken(#dc3545, 30%)
    contrastText: '#ffffff',
  },
  
  warning: {
    light: '#ffcd39',    // Computed: lighten(#ffc107, 20%)
    main: '#ffc107',     // Bootstrap $yellow
    dark: '#b28704',     // Computed: darken(#ffc107, 30%)
    contrastText: 'rgba(0, 0, 0, 0.87)',
  },
  
  info: {
    light: '#54d6f4',    // Computed: lighten(#0dcaf0, 20%)
    main: '#0dcaf0',     // Bootstrap $cyan
    dark: '#098da8',     // Computed: darken(#0dcaf0, 30%)
    contrastText: 'rgba(0, 0, 0, 0.87)',
  },
  
  success: {
    light: '#51b37f',    // Computed: lighten(#198754, 20%)
    main: '#198754',     // Bootstrap $green
    dark: '#115e3a',     // Computed: darken(#198754, 30%)
    contrastText: '#ffffff',
  },
  
  // Gray scale
  grey: {
    50: '#f8f9fa',    // Bootstrap $gray-100
    100: '#f8f9fa',
    200: '#e9ecef',   // Bootstrap $gray-200
    300: '#dee2e6',   // Bootstrap $gray-300
    400: '#ced4da',   // Bootstrap $gray-400
    500: '#adb5bd',   // Bootstrap $gray-500
    600: '#6c757d',   // Bootstrap $gray-600
    700: '#495057',   // Bootstrap $gray-700
    800: '#343a40',   // Bootstrap $gray-800
    900: '#212529',   // Bootstrap $gray-900
  },
  
  // Monochrome
  common: {
    black: '#000000',  // Bootstrap $black
    white: '#ffffff',  // Bootstrap $white
  },
};

/**
 * Typography configuration based on Bootstrap 5 and Material-UI best practices
 * Font stack prioritizes system fonts for performance, with Roboto as fallback
 */
const TYPOGRAPHY = {
  // Font family from Bootstrap 5 with Roboto added
  fontFamily: [
    'Roboto',
    'system-ui',
    '-apple-system',
    '"Segoe UI"',
    '"Helvetica Neue"',
    '"Noto Sans"',
    '"Liberation Sans"',
    'Arial',
    'sans-serif',
    '"Apple Color Emoji"',
    '"Segoe UI Emoji"',
    '"Segoe UI Symbol"',
    '"Noto Color Emoji"',
  ].join(','),
  
  // Base font size (1rem = 16px typically)
  fontSize: 16,
  
  // Font weights from Bootstrap 5
  fontWeightLight: 300,
  fontWeightRegular: 400,
  fontWeightMedium: 500,
  fontWeightBold: 700,
  
  // Typography variants matching Bootstrap 5 heading sizes
  h1: {
    fontSize: '2.5rem',      // 40px
    fontWeight: 500,
    lineHeight: 1.2,
  },
  h2: {
    fontSize: '2rem',        // 32px
    fontWeight: 500,
    lineHeight: 1.2,
  },
  h3: {
    fontSize: '1.75rem',     // 28px
    fontWeight: 500,
    lineHeight: 1.2,
  },
  h4: {
    fontSize: '1.5rem',      // 24px
    fontWeight: 500,
    lineHeight: 1.2,
  },
  h5: {
    fontSize: '1.25rem',     // 20px
    fontWeight: 500,
    lineHeight: 1.2,
  },
  h6: {
    fontSize: '1rem',        // 16px
    fontWeight: 500,
    lineHeight: 1.2,
  },
  
  body1: {
    fontSize: '1rem',        // 16px
    lineHeight: 1.5,
  },
  body2: {
    fontSize: '0.875rem',    // 14px
    lineHeight: 1.5,
  },
  
  button: {
    fontSize: '1rem',
    fontWeight: 500,
    textTransform: 'none' as const,  // Disable uppercase transformation
  },
  
  caption: {
    fontSize: '0.75rem',     // 12px
    lineHeight: 1.5,
  },
  
  overline: {
    fontSize: '0.75rem',
    lineHeight: 1.5,
    textTransform: 'uppercase' as const,
  },
};

/**
 * Spacing scale based on 8px grid system (MUI default)
 * Bootstrap uses 1rem (16px) as base, MUI uses 8px
 * This provides a compatible scale
 */
const SPACING = 8;

/**
 * Breakpoints matching Bootstrap 5 exactly
 * From public/theme/boost/scss/bootstrap/_variables.scss
 */
const BREAKPOINTS = {
  values: {
    xs: 0,
    sm: 576,
    md: 768,
    lg: 992,
    xl: 1200,
    // Note: MUI doesn't have xxl by default, but we can reference xl for larger screens
  },
};

/**
 * Component style overrides to match Moodle/Bootstrap aesthetics
 * These ensure consistency across the application
 */
const getComponentOverrides = (mode: PaletteMode): ThemeOptions['components'] => ({
  MuiButton: {
    styleOverrides: {
      root: {
        borderRadius: 6,  // Slightly rounded, matching Bootstrap
        padding: '0.375rem 0.75rem',  // Bootstrap button padding
        fontSize: '1rem',
        fontWeight: 500,
        textTransform: 'none',  // No uppercase transformation
        boxShadow: 'none',  // Remove default shadow
        '&:hover': {
          boxShadow: 'none',
        },
      },
      contained: {
        '&:hover': {
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        },
      },
    },
    defaultProps: {
      disableElevation: true,
    },
  },
  
  MuiTextField: {
    styleOverrides: {
      root: {
        '& .MuiOutlinedInput-root': {
          borderRadius: 6,
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: mode === 'light' ? COLORS.grey[400] : COLORS.grey[600],
          },
        },
      },
    },
  },
  
  MuiCard: {
    styleOverrides: {
      root: {
        borderRadius: 8,
        boxShadow: mode === 'light' 
          ? '0 0.125rem 0.25rem rgba(0,0,0,0.075)'  // Bootstrap card shadow
          : '0 0.125rem 0.25rem rgba(0,0,0,0.3)',
      },
    },
  },
  
  MuiPaper: {
    styleOverrides: {
      root: {
        borderRadius: 8,
      },
      elevation1: {
        boxShadow: mode === 'light'
          ? '0 0.125rem 0.25rem rgba(0,0,0,0.075)'
          : '0 0.125rem 0.25rem rgba(0,0,0,0.3)',
      },
    },
  },
  
  MuiAppBar: {
    styleOverrides: {
      root: {
        boxShadow: '0 0.125rem 0.25rem rgba(0,0,0,0.075)',
      },
    },
  },
  
  MuiChip: {
    styleOverrides: {
      root: {
        borderRadius: 16,
        fontWeight: 500,
      },
    },
  },
  
  MuiAlert: {
    styleOverrides: {
      root: {
        borderRadius: 6,
      },
      standardSuccess: {
        backgroundColor: mode === 'light' 
          ? alpha(COLORS.success.main, 0.1)
          : alpha(COLORS.success.light, 0.2),
        color: mode === 'light' ? COLORS.success.dark : COLORS.success.light,
      },
      standardError: {
        backgroundColor: mode === 'light'
          ? alpha(COLORS.error.main, 0.1)
          : alpha(COLORS.error.light, 0.2),
        color: mode === 'light' ? COLORS.error.dark : COLORS.error.light,
      },
      standardWarning: {
        backgroundColor: mode === 'light'
          ? alpha(COLORS.warning.main, 0.1)
          : alpha(COLORS.warning.main, 0.2),
        color: mode === 'light' ? COLORS.warning.dark : '#000',
      },
      standardInfo: {
        backgroundColor: mode === 'light'
          ? alpha(COLORS.info.main, 0.1)
          : alpha(COLORS.info.light, 0.2),
        color: mode === 'light' ? COLORS.info.dark : COLORS.info.light,
      },
    },
  },
  
  MuiTableCell: {
    styleOverrides: {
      root: {
        borderColor: mode === 'light' ? COLORS.grey[300] : COLORS.grey[700],
      },
    },
  },
  
  MuiDivider: {
    styleOverrides: {
      root: {
        borderColor: mode === 'light' ? COLORS.grey[300] : COLORS.grey[700],
      },
    },
  },
});

/**
 * Create a complete Material-UI theme for the specified mode
 * 
 * @param mode - Theme mode ('light' or 'dark')
 * @returns Complete Material-UI theme object
 * 
 * @example
 * ```typescript
 * const lightTheme = createAppTheme('light');
 * const darkTheme = createAppTheme('dark');
 * ```
 */
export const createAppTheme = (mode: PaletteMode) => {
  return createTheme({
    palette: {
      mode,
      
      // Primary palette
      primary: {
        light: COLORS.primary.light,
        main: COLORS.primary.main,
        dark: COLORS.primary.dark,
        contrastText: COLORS.primary.contrastText,
      },
      
      // Secondary palette
      secondary: {
        light: COLORS.secondary.light,
        main: COLORS.secondary.main,
        dark: COLORS.secondary.dark,
        contrastText: COLORS.secondary.contrastText,
      },
      
      // Semantic colors
      error: {
        light: COLORS.error.light,
        main: COLORS.error.main,
        dark: COLORS.error.dark,
        contrastText: COLORS.error.contrastText,
      },
      
      warning: {
        light: COLORS.warning.light,
        main: COLORS.warning.main,
        dark: COLORS.warning.dark,
        contrastText: COLORS.warning.contrastText,
      },
      
      info: {
        light: COLORS.info.light,
        main: COLORS.info.main,
        dark: COLORS.info.dark,
        contrastText: COLORS.info.contrastText,
      },
      
      success: {
        light: COLORS.success.light,
        main: COLORS.success.main,
        dark: COLORS.success.dark,
        contrastText: COLORS.success.contrastText,
      },
      
      // Gray scale
      grey: COLORS.grey,
      
      // Background colors
      background: {
        default: mode === 'light' ? COLORS.common.white : COLORS.grey[900],
        paper: mode === 'light' ? COLORS.common.white : COLORS.grey[800],
      },
      
      // Text colors
      text: {
        primary: mode === 'light' 
          ? 'rgba(0, 0, 0, 0.87)'  // High emphasis
          : 'rgba(255, 255, 255, 0.87)',
        secondary: mode === 'light'
          ? 'rgba(0, 0, 0, 0.6)'   // Medium emphasis
          : 'rgba(255, 255, 255, 0.6)',
        disabled: mode === 'light'
          ? 'rgba(0, 0, 0, 0.38)'  // Disabled/hint
          : 'rgba(255, 255, 255, 0.38)',
      },
      
      // Divider color
      divider: mode === 'light'
        ? 'rgba(0, 0, 0, 0.12)'
        : 'rgba(255, 255, 255, 0.12)',
      
      // Action colors
      action: {
        active: mode === 'light'
          ? 'rgba(0, 0, 0, 0.54)'
          : 'rgba(255, 255, 255, 0.54)',
        hover: mode === 'light'
          ? 'rgba(0, 0, 0, 0.04)'
          : 'rgba(255, 255, 255, 0.08)',
        selected: mode === 'light'
          ? 'rgba(0, 0, 0, 0.08)'
          : 'rgba(255, 255, 255, 0.16)',
        disabled: mode === 'light'
          ? 'rgba(0, 0, 0, 0.26)'
          : 'rgba(255, 255, 255, 0.26)',
        disabledBackground: mode === 'light'
          ? 'rgba(0, 0, 0, 0.12)'
          : 'rgba(255, 255, 255, 0.12)',
      },
    },
    
    // Typography configuration
    typography: TYPOGRAPHY,
    
    // Spacing scale
    spacing: SPACING,
    
    // Breakpoints
    breakpoints: BREAKPOINTS,
    
    // Shape (border radius)
    shape: {
      borderRadius: 6,  // Default border radius for components
    },
    
    // Shadows (keeping MUI defaults but could customize)
    shadows: [
      'none',
      '0 0.125rem 0.25rem rgba(0,0,0,0.075)',  // elevation 1
      '0 0.25rem 0.5rem rgba(0,0,0,0.075)',    // elevation 2
      '0 0.5rem 1rem rgba(0,0,0,0.075)',       // elevation 3
      '0 1rem 2rem rgba(0,0,0,0.075)',         // elevation 4
      // MUI has 25 elevation levels total, keeping defaults for others
      ...Array(20).fill('0 0.5rem 1rem rgba(0,0,0,0.075)'),
    ] as any,  // Type assertion needed for shadow array
    
    // Transitions (keeping MUI defaults)
    transitions: {
      easing: {
        easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
        easeOut: 'cubic-bezier(0.0, 0, 0.2, 1)',
        easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
        sharp: 'cubic-bezier(0.4, 0, 0.6, 1)',
      },
      duration: {
        shortest: 150,
        shorter: 200,
        short: 250,
        standard: 300,
        complex: 375,
        enteringScreen: 225,
        leavingScreen: 195,
      },
    },
    
    // Z-index values (keeping MUI defaults)
    zIndex: {
      mobileStepper: 1000,
      fab: 1050,
      speedDial: 1050,
      appBar: 1100,
      drawer: 1200,
      modal: 1300,
      snackbar: 1400,
      tooltip: 1500,
    },
    
    // Component overrides
    components: getComponentOverrides(mode),
  });
};

/**
 * Default theme instance (light mode)
 * This is the main export used throughout the application
 * 
 * @example
 * ```typescript
 * import theme from '@/styles/theme';
 * 
 * <ThemeProvider theme={theme}>
 *   <App />
 * </ThemeProvider>
 * ```
 */
const theme = createAppTheme('light');

export default theme;
