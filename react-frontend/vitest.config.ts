import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

/**
 * Vitest Configuration for Moodle React Frontend
 * 
 * Configures the testing environment for unit and integration tests with:
 * - happy-dom environment for DOM testing (better FormData/File support than jsdom)
 * - React Testing Library integration
 * - 90%+ coverage thresholds
 * - TypeScript support
 * - Module path aliases
 */
export default defineConfig({
  plugins: [
    // Enable React Fast Refresh and JSX transformation in tests
    react()
  ],
  
  // SSR configuration to handle ESM modules properly
  ssr: {
    noExternal: [
      // Force bundling of date-fns and MUI date pickers
      // This fixes ESM compatibility issues with date-fns v3 internal paths
      'date-fns',
      /@mui\/x-date-pickers/,
      // Force bundling of msw to handle MSW v2 exports properly in Vitest
      'msw'
    ]
  },
  
  test: {
    // Enable global test APIs (describe, it, expect, etc.) without imports
    globals: true,
    
    // Use happy-dom environment for DOM testing (simulates browser environment)
    // happy-dom is used instead of jsdom due to better compatibility with FormData and File objects
    environment: 'happy-dom',
    
    // Environment variables for tests
    // Set absolute API base URL so MSW can intercept requests properly
    env: {
      VITE_API_BASE_URL: 'http://localhost:8000/api/v1'
    },
    
    // Setup file to run before each test file
    // Contains React Testing Library configuration and custom matchers
    setupFiles: './tests/setup.ts',
    
    // Server configuration for handling dependencies
    server: {
      deps: {
        // Inline dependencies that need to be transformed by Vite
        // This fixes ESM module issues with date-fns and MUI date pickers
        inline: [
          'date-fns',
          /@mui\/x-date-pickers/
        ]
      }
    },
    
    // Resolve configuration for test environment
    resolveOptions: {
      conditions: ['node', 'import', 'module', 'browser', 'default']
    },
    
    // Test file patterns to include
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'tests/**/*.{test,spec}.{ts,tsx}'],
    
    // Patterns to exclude from test discovery
    exclude: [
      'node_modules',
      'dist',
      '.idea',
      '.git',
      '.cache',
      'tests/e2e/**',              // E2E tests run with Playwright
      'tests/blitzy_adhoc_test_*'  // Ad-hoc test files
    ],
    
    // Coverage configuration
    coverage: {
      // Use V8 coverage provider (faster than Istanbul)
      provider: 'v8',
      
      // Coverage reporters
      reporter: [
        'text',      // Console output
        'html',      // HTML report in coverage/index.html
        'lcov'       // LCOV format for CI/CD integration
      ],
      
      // Files to exclude from coverage
      exclude: [
        '**/*.config.*',           // Configuration files
        '**/tests/**',             // Test files themselves
        '**/dist/**',              // Build output
        '**/*.d.ts',               // TypeScript declaration files
        '**/node_modules/**',      // Dependencies
        '**/src/main.tsx',         // Application entry point
        '**/src/vite-env.d.ts',    // Vite environment types
        '**/*.stories.tsx',        // Storybook stories
        '**/src/types/**',         // Type definition files
        '**/__mocks__/**'          // Mock files
      ],
      
      // Coverage thresholds (90%+ as per requirements)
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 90,
        statements: 90
      },
      
      // Include all source files in coverage report, even if untested
      all: true,
      
      // Source files to include in coverage
      include: ['src/**/*.{ts,tsx}'],
      
      // Report coverage on each test run
      enabled: false, // Set to true in CI or use --coverage flag
      
      // Clean coverage directory before each run
      clean: true
    },
    
    // Enable concurrent test execution for faster runs
    pool: 'threads',
    
    // Test timeout (milliseconds)
    testTimeout: 10000,
    
    // Hook timeouts
    hookTimeout: 10000,
    
    // Tear down test environment after each test
    teardownTimeout: 10000,
    
    // Reporter configuration
    reporters: [
      'default',  // Standard console output
      'verbose'   // Detailed test results
    ],
    
    // CSS handling in tests
    css: {
      modules: {
        classNameStrategy: 'non-scoped'
      }
    },
    
    // Mock configuration
    mockReset: true,  // Reset mocks between tests
    restoreMocks: true,  // Restore original implementations after tests
    
    // Clear mocks between tests
    clearMocks: true
  },
  
  // Module resolution configuration
  resolve: {
    alias: {
      // Enable @/ import alias to reference src/ directory
      '@': path.resolve(__dirname, './src'),
      
      // Additional aliases for common paths
      '@components': path.resolve(__dirname, './src/components'),
      '@features': path.resolve(__dirname, './src/features'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@services': path.resolve(__dirname, './src/services'),
      '@types': path.resolve(__dirname, './src/types'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@styles': path.resolve(__dirname, './src/styles'),
      '@config': path.resolve(__dirname, './src/config'),
      
      // Alias msw/node to directly resolve to the file, bypassing export map issues
      'msw/node': path.resolve(__dirname, './node_modules/msw/lib/node/index.mjs')
    },
    // Module resolution conditions for handling ESM/CJS compatibility
    // 'node' condition is required for msw/node in MSW v2
    conditions: ['node', 'import', 'module', 'browser', 'default']
  }
});
