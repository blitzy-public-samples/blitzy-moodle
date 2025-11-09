const path = require('path');

/**
 * Storybook Main Configuration (CommonJS)
 * 
 * NOTE: This file uses CommonJS instead of ESM due to a compatibility issue
 * with Storybook 7.6 when package.json has "type": "module". 
 * 
 * The TypeScript version (main.ts) is the canonical configuration, but
 * Storybook currently requires this CommonJS version to function correctly.
 * 
 * Issue: esbuild-register transpiles .ts/.mjs files incorrectly when
 * "type": "module" is set, causing "require is not defined" errors.
 * 
 * This file will be deprecated in future Storybook versions that properly
 * support ESM configurations.
 * 
 * @see main.ts for the TypeScript version
 * @type {import('@storybook/react-vite').StorybookConfig}
 */
const config = {
  /**
   * Story File Discovery Pattern
   * 
   * Storybook will search for story files matching this pattern.
   * Stories should be co-located with components in the src directory.
   */
  stories: ['../src/**/*.stories.@(ts|tsx)'],

  /**
   * Storybook Addons Configuration
   * 
   * Addons extend Storybook's functionality with additional features
   * for component development, testing, and documentation.
   */
  addons: [
    '@storybook/addon-links',
    '@storybook/addon-essentials',
    '@storybook/addon-interactions',
    '@storybook/addon-a11y',
  ],

  /**
   * Framework Configuration
   * 
   * Specifies the frontend framework and build tool integration.
   * Using React with Vite for fast development and optimized builds.
   */
  framework: {
    name: '@storybook/react-vite',
    options: {
      builder: {
        viteConfigPath: path.join(__dirname, '..', 'vite.config.ts'),
      },
    },
  },

  /**
   * Documentation Configuration
   * 
   * Controls automatic documentation generation from component code.
   */
  docs: {
    autodocs: 'tag',
  },

  /**
   * Core Storybook Settings
   */
  core: {
    disableTelemetry: true,
  },

  /**
   * TypeScript Configuration
   * 
   * Controls TypeScript behavior and documentation generation.
   */
  typescript: {
    check: false,
    reactDocgen: 'react-docgen-typescript',
    reactDocgenTypescriptOptions: {
      shouldExtractLiteralValuesFromEnum: true,
      propFilter: (prop) => {
        if (prop.parent) {
          if (prop.parent.fileName.includes('node_modules')) {
            return prop.parent.fileName.includes('@mui');
          }
          return true;
        }
        return true;
      },
    },
  },

  /**
   * Static Directories
   * 
   * Serves static assets from these directories in Storybook.
   */
  staticDirs: [path.join(__dirname, '..', 'public')],
};

module.exports = config;
