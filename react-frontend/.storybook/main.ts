import type { StorybookConfig } from '@storybook/react-vite';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Get directory name in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Storybook Main Configuration
 * 
 * This configuration file defines the core setup for Storybook, including:
 * - Story file discovery patterns
 * - Essential addons for component development and documentation
 * - Framework integration with React 18 and Vite
 * - TypeScript configuration with automatic prop documentation
 * - Static asset serving
 * 
 * @see https://storybook.js.org/docs/react/configure/overview
 */
const config: StorybookConfig = {
  /**
   * Story File Discovery Pattern
   * 
   * Storybook will search for story files matching this pattern.
   * Stories should be co-located with components in the src directory.
   * 
   * Pattern: src/**\/*.stories.@(ts|tsx)
   * - Searches recursively in src directory
   * - Matches .stories.ts and .stories.tsx files
   * 
   * Example story file locations:
   * - src/components/Button/Button.stories.tsx
   * - src/features/auth/components/LoginForm.stories.tsx
   * - src/features/courses/components/CourseCard.stories.tsx
   */
  stories: ['../src/**/*.stories.@(ts|tsx)'],

  /**
   * Storybook Addons Configuration
   * 
   * Addons extend Storybook's functionality with additional features
   * for component development, testing, and documentation.
   */
  addons: [
    /**
     * @storybook/addon-links
     * 
     * Enables linking between stories for creating narrative flows
     * and demonstrating component interactions across different stories.
     */
    '@storybook/addon-links',

    /**
     * @storybook/addon-essentials
     * 
     * Essential addons bundle including:
     * - Controls: Interactive component prop editing
     * - Actions: Log and inspect component events
     * - Viewport: Test components at different screen sizes
     * - Backgrounds: Change background colors for contrast testing
     * - Toolbars: Custom toolbar buttons for configuration
     * - Measure: Measure spacing and alignment
     * - Outline: Visualize component boundaries
     * - Docs: Auto-generated documentation pages
     */
    '@storybook/addon-essentials',

    /**
     * @storybook/addon-interactions
     * 
     * Enables interaction testing within Storybook using Testing Library.
     * Allows you to write and debug user interaction tests directly in stories.
     * 
     * Use with play functions to simulate user interactions:
     * - Click events
     * - Form input
     * - Keyboard navigation
     * - Focus management
     */
    '@storybook/addon-interactions',

    /**
     * @storybook/addon-a11y
     * 
     * Accessibility testing addon powered by axe-core.
     * 
     * Features:
     * - Real-time accessibility violation detection
     * - WCAG 2.1 AA compliance checking
     * - Color contrast analysis
     * - ARIA attribute validation
     * - Keyboard navigation testing
     * 
     * Critical for ensuring Moodle's WCAG 2.1 AA compliance requirements.
     */
    '@storybook/addon-a11y',
  ],

  /**
   * Framework Configuration
   * 
   * Specifies the frontend framework and build tool integration.
   * Using React with Vite for fast development and optimized builds.
   */
  framework: {
    /**
     * Framework name: @storybook/react-vite
     * 
     * Integrates Storybook with React 18 and Vite build tool.
     * Provides:
     * - Fast HMR (Hot Module Replacement)
     * - React 18 concurrent features support
     * - Automatic JSX runtime
     * - TypeScript support
     */
    name: '@storybook/react-vite',

    /**
     * Framework Options
     * 
     * Configuration specific to React-Vite integration.
     */
    options: {
      /**
       * Vite Builder Configuration
       * 
       * References the main Vite configuration file to ensure
       * consistent build settings between the main application
       * and Storybook.
       * 
       * This provides:
       * - Path aliases (@/ for src/)
       * - React plugin configuration
       * - Module resolution rules
       * - Build optimization settings
       */
      builder: {
        viteConfigPath: join(__dirname, '..', 'vite.config.ts'),
      },
    },
  },

  /**
   * Documentation Configuration
   * 
   * Controls automatic documentation generation from component code.
   */
  docs: {
    /**
     * Auto-generate documentation pages from stories
     * 
     * Setting: 'tag'
     * - Generates docs page for stories with 'autodocs' tag
     * - Extracts component props from TypeScript types
     * - Creates interactive documentation with live examples
     * 
     * Example usage in story file:
     * export default {
     *   title: 'Components/Button',
     *   component: Button,
     *   tags: ['autodocs'],
     * };
     */
    autodocs: 'tag',
  },

  /**
   * Core Storybook Settings
   */
  core: {
    /**
     * Disable telemetry data collection
     * 
     * Prevents Storybook from sending anonymous usage data.
     * Respects user privacy and reduces network requests.
     */
    disableTelemetry: true,
  },

  /**
   * TypeScript Configuration
   * 
   * Controls TypeScript behavior and documentation generation.
   */
  typescript: {
    /**
     * Type Checking
     * 
     * Disabled within Storybook to improve build performance.
     * Type checking is handled separately by the main TypeScript
     * compiler via `npm run type-check` command.
     */
    check: false,

    /**
     * React Documentation Generator
     * 
     * Uses react-docgen-typescript to extract component prop types
     * and generate interactive documentation in the Docs addon.
     * 
     * This provides:
     * - Automatic prop table generation
     * - Type information display
     * - Default value extraction
     * - JSDoc comment parsing
     */
    reactDocgen: 'react-docgen-typescript',

    /**
     * React DocGen TypeScript Options
     * 
     * Fine-tune documentation generation behavior.
     */
    reactDocgenTypescriptOptions: {
      /**
       * Extract Literal Values from Enums
       * 
       * When true, shows the actual enum values in documentation
       * instead of just the enum type name.
       * 
       * Example:
       * enum Size { Small = 'sm', Large = 'lg' }
       * Shows: 'sm' | 'lg' instead of Size
       */
      shouldExtractLiteralValuesFromEnum: true,

      /**
       * Prop Filter
       * 
       * Filters which props are included in documentation.
       * Excludes internal React props and node_modules props
       * except for Material-UI components.
       * 
       * @param prop - Component prop metadata
       * @returns true if prop should be documented, false otherwise
       */
      propFilter: (prop) => {
        // Always include props defined in the source code
        if (prop.parent) {
          // Exclude props from node_modules except @mui packages
          if (prop.parent.fileName.includes('node_modules')) {
            // Include Material-UI component props for documentation
            return prop.parent.fileName.includes('@mui');
          }
          // Include all other props from source files
          return true;
        }
        // Include props without parent information
        return true;
      },
    },
  },

  /**
   * Static Directories
   * 
   * Serves static assets from these directories in Storybook.
   * Files in these directories are accessible at the root path.
   * 
   * Example:
   * - public/logo.png is accessible as /logo.png in stories
   * - public/fonts/roboto.woff2 is accessible as /fonts/roboto.woff2
   */
  staticDirs: [join(__dirname, '..', 'public')],
};

// Export as default to match Storybook's expected configuration format
export default config;
