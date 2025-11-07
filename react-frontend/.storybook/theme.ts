/**
 * Storybook Theme Configuration
 * 
 * This file customizes the Storybook UI interface to match the Material-UI v5 design
 * system and Moodle brand colors. It controls the appearance of Storybook's navigation
 * panel, toolbar, and documentation pages to provide a consistent branded experience
 * for component documentation.
 * 
 * Brand Colors:
 * - Primary: #FF6E42 (Moodle Orange)
 * - Secondary: #0F6CBF (Moodle Blue)
 * 
 * Typography:
 * - Font Family: Roboto (Material-UI default)
 * 
 * @see https://storybook.js.org/docs/react/configure/theming
 */

import { create } from '@storybook/theming/create';

/**
 * Custom Storybook theme configuration matching Material-UI design tokens
 * and Moodle branding.
 */
const customTheme = create({
  /**
   * Base theme variant
   * Using 'light' as the default theme
   */
  base: 'light',

  /**
   * Brand Configuration
   */
  brandTitle: 'Moodle React Components',
  brandUrl: '/',
  brandImage: undefined, // Optional: Add logo URL if available
  brandTarget: '_self',

  /**
   * Primary Colors
   * Matching Moodle brand identity
   */
  colorPrimary: '#FF6E42', // Moodle brand orange
  colorSecondary: '#0F6CBF', // Moodle brand blue

  /**
   * Application Background Colors
   * Matching Material-UI grey palette
   */
  appBg: '#F5F5F5', // Material-UI grey[100] - background
  appContentBg: '#FFFFFF', // White content area
  appBorderColor: '#E0E0E0', // Material-UI grey[300] - divider color
  appBorderRadius: 4, // Material-UI default border radius

  /**
   * Typography
   * Using Material-UI default font stack
   */
  fontBase: '"Roboto", "Helvetica", "Arial", sans-serif',
  fontCode: 'monospace',

  /**
   * Text Colors
   * Matching Material-UI text color tokens
   */
  textColor: '#212121', // Material-UI text.primary (grey[900])
  textInverseColor: '#FFFFFF', // White text for dark backgrounds
  textMutedColor: '#757575', // Material-UI text.secondary (grey[600])

  /**
   * Toolbar Colors
   */
  barTextColor: '#757575', // Material-UI text.secondary
  barSelectedColor: '#0F6CBF', // Moodle blue for selected items
  barBg: '#FFFFFF', // White toolbar background

  /**
   * Form Input Styling
   */
  inputBg: '#FFFFFF',
  inputBorder: '#E0E0E0', // Material-UI grey[300]
  inputTextColor: '#212121', // Material-UI text.primary
  inputBorderRadius: 4, // Material-UI default border radius
});

export default customTheme;
