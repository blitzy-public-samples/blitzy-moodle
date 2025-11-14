/**
 * ESLint Configuration for Moodle React Frontend
 * 
 * This configuration enforces:
 * - TypeScript strict mode linting with zero 'any' types
 * - React 18 best practices and hooks rules
 * - Accessibility standards (WCAG 2.1 AA)
 * - Integration with Prettier for code formatting
 * - Zero warnings in production builds
 * 
 * @see https://eslint.org/docs/latest/user-guide/configuring/
 * @see https://typescript-eslint.io/
 * @see https://github.com/jsx-eslint/eslint-plugin-react
 * @see https://github.com/jsx-eslint/eslint-plugin-jsx-a11y
 */

module.exports = {
  root: true,
  
  // Environment configuration
  env: {
    browser: true,
    es2020: true,
    node: true,
  },

  // Parser for TypeScript
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
    // Required for @typescript-eslint/recommended-requiring-type-checking
    project: ['./tsconfig.json', './tsconfig.node.json', './tsconfig.storybook.json', './tests/tsconfig.json'],
    tsconfigRootDir: __dirname,
  },

  // Plugins
  plugins: [
    '@typescript-eslint',
    'react',
    'react-hooks',
    'react-refresh',
    'jsx-a11y',
  ],

  // Extended configurations
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
    'plugin:jsx-a11y/recommended',
  ],

  // Settings
  settings: {
    react: {
      version: 'detect',
    },
  },

  // Ignore patterns
  ignorePatterns: [
    'dist',
    'build',
    'node_modules',
    '.eslintrc.cjs',
    'vite.config.ts',
    'vitest.config.ts',
    'playwright.config.ts',
    'tests/setup.ts',
    '**/blitzy_adhoc_test_*',
    '.storybook/main.js', // CommonJS workaround for Storybook 7.6 ESM compatibility - main.ts is the canonical config
  ],

  // Custom rules
  rules: {
    // TypeScript specific rules - enforce strict typing
    '@typescript-eslint/no-explicit-any': 'error', // Zero 'any' types allowed
    '@typescript-eslint/explicit-function-return-type': 'off', // Allow type inference
    '@typescript-eslint/explicit-module-boundary-types': 'off', // Allow type inference for exports
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      },
    ],
    '@typescript-eslint/no-non-null-assertion': 'warn', // Discourage ! operator
    '@typescript-eslint/prefer-nullish-coalescing': 'warn',
    '@typescript-eslint/prefer-optional-chain': 'warn',
    '@typescript-eslint/consistent-type-imports': [
      'warn',
      {
        prefer: 'type-imports',
        fixStyle: 'separate-type-imports',
      },
    ],
    '@typescript-eslint/no-misused-promises': [
      'error',
      {
        checksVoidReturn: false, // Allow async functions in event handlers
      },
    ],

    // React specific rules - React 18 best practices
    'react/react-in-jsx-scope': 'off', // Not needed with React 18 JSX transform
    'react/prop-types': 'off', // Using TypeScript instead
    'react/jsx-uses-react': 'off', // Not needed with React 18
    'react/jsx-no-target-blank': 'error', // Security: prevent reverse tabnabbing
    'react/jsx-key': [
      'error',
      {
        checkFragmentShorthand: true,
        checkKeyMustBeforeSpread: true,
      },
    ],
    'react/self-closing-comp': 'warn', // Enforce self-closing for components without children
    'react/jsx-curly-brace-presence': ['warn', { props: 'never', children: 'never' }],
    'react/jsx-boolean-value': ['warn', 'never'],
    'react/no-array-index-key': 'warn', // Discourage using array index as key
    'react/no-unstable-nested-components': 'error', // Prevent performance issues
    'react/jsx-no-useless-fragment': 'warn',
    'react/function-component-definition': [
      'warn',
      {
        namedComponents: 'function-declaration',
        unnamedComponents: 'arrow-function',
      },
    ],

    // React Hooks rules - enforce rules of hooks
    'react-hooks/rules-of-hooks': 'error', // Checks hooks rules
    'react-hooks/exhaustive-deps': 'warn', // Checks effect dependencies

    // React Refresh rules - for HMR
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],

    // Accessibility rules - WCAG 2.1 AA compliance
    'jsx-a11y/anchor-is-valid': 'error',
    'jsx-a11y/alt-text': 'error',
    'jsx-a11y/aria-props': 'error',
    'jsx-a11y/aria-proptypes': 'error',
    'jsx-a11y/aria-unsupported-elements': 'error',
    'jsx-a11y/role-has-required-aria-props': 'error',
    'jsx-a11y/role-supports-aria-props': 'error',
    'jsx-a11y/click-events-have-key-events': 'warn',
    'jsx-a11y/no-static-element-interactions': 'warn',
    'jsx-a11y/interactive-supports-focus': 'warn',
    'jsx-a11y/label-has-associated-control': 'warn',
    'jsx-a11y/no-autofocus': 'warn',
    'jsx-a11y/heading-has-content': 'error',
    'jsx-a11y/iframe-has-title': 'error',
    'jsx-a11y/img-redundant-alt': 'warn',
    'jsx-a11y/no-redundant-roles': 'warn',

    // General best practices
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'no-debugger': 'error',
    'prefer-const': 'error',
    'no-var': 'error',
    'eqeqeq': ['error', 'always', { null: 'ignore' }],
    'curly': ['error', 'all'],
    'no-else-return': 'warn',
    'no-lonely-if': 'warn',
    'prefer-template': 'warn',
    'object-shorthand': 'warn',
    'no-useless-rename': 'warn',
    'prefer-destructuring': [
      'warn',
      {
        array: false,
        object: true,
      },
    ],
  },

  // Overrides for specific file patterns
  overrides: [
    {
      // Configuration files
      files: ['*.config.ts', '*.config.js'],
      rules: {
        '@typescript-eslint/no-var-requires': 'off',
        'import/no-default-export': 'off',
      },
    },
    {
      // Test files
      files: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/*.spec.tsx'],
      env: {
        jest: true,
      },
      rules: {
        '@typescript-eslint/no-explicit-any': 'off', // Allow 'any' in tests for mocking
        '@typescript-eslint/no-non-null-assertion': 'off', // Allow ! in tests
        'no-console': 'off', // Allow console in tests
      },
    },
    {
      // Storybook stories
      files: ['**/*.stories.tsx', '**/*.stories.ts'],
      rules: {
        'react-refresh/only-export-components': 'off',
        'import/no-default-export': 'off',
      },
    },
  ],
};
