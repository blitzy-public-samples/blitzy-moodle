# Development Environment Setup Guide

This guide provides comprehensive instructions for setting up the development environment for the Moodle React frontend application.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Repository Setup](#repository-setup)
- [Dependency Installation](#dependency-installation)
- [Environment Configuration](#environment-configuration)
- [Development Server](#development-server)
- [Build Commands](#build-commands)
- [Additional Commands](#additional-commands)
- [IDE Setup](#ide-setup)
- [Troubleshooting](#troubleshooting)
- [Next Steps](#next-steps)

## Prerequisites

Before setting up the development environment, ensure you have the following tools installed:

### Node.js 20.x LTS

This project requires Node.js version 20.x LTS as specified in the `.nvmrc` file.

**Installation Options:**

**Using nvm (Recommended):**
```bash
# Install nvm (if not already installed)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Install and use Node.js 20.x
nvm install 20
nvm use 20

# Verify installation
node --version  # Should output v20.x.x
```

**Direct Installation:**
- Download from [nodejs.org](https://nodejs.org/) (choose the 20.x LTS version)
- Follow the installer instructions for your operating system

### Package Manager

Choose one of the following package managers:

**npm 9+ (Included with Node.js 20.x):**
```bash
# Verify npm version
npm --version  # Should be 9.x or higher
```

**pnpm 8+ (Alternative, faster package manager):**
```bash
# Install pnpm globally
npm install -g pnpm@8

# Verify installation
pnpm --version  # Should be 8.x or higher
```

### Git

Ensure Git is installed for version control:
```bash
# Verify Git installation
git --version  # Should be 2.x or higher
```

### Recommended Development Tools

- **Visual Studio Code** (v1.75+) - Recommended IDE with excellent React and TypeScript support
- **Chrome/Firefox DevTools** - For debugging and performance profiling
- **React Developer Tools** - Browser extension for React debugging
- **Redux DevTools** - Browser extension for Redux state inspection

## Repository Setup

### Clone the Repository

```bash
# Clone the Moodle repository
git clone <repository-url> moodle
cd moodle

# Navigate to the React frontend directory
cd react-frontend
```

### Verify Repository Structure

Ensure you're in the correct directory:
```bash
# You should see these key files:
ls -la
# Expected output should include:
# - package.json
# - tsconfig.json
# - vite.config.ts
# - src/
# - public/
```

## Dependency Installation

### Install Project Dependencies

Using **npm**:
```bash
npm install
```

Using **pnpm**:
```bash
pnpm install
```

This command installs all dependencies listed in `package.json`, including:

### Key Dependencies

**Core Framework:**
- **react** (^18.2.0) - Core React library with concurrent rendering features
- **react-dom** (^18.2.0) - React DOM rendering library
- **typescript** (^5.3.3) - TypeScript compiler with strict mode support

**Routing and State Management:**
- **react-router-dom** (^6.20.1) - Client-side routing
- **@reduxjs/toolkit** (^2.0.1) - Redux state management
- **react-redux** (^9.0.4) - React bindings for Redux
- **@tanstack/react-query** (^5.14.2) - Server state management and caching

**UI Framework:**
- **@mui/material** (^5.15.0) - Material-UI component library
- **@mui/icons-material** (^5.15.0) - Material Design icons
- **@emotion/react** (^11.11.3) - CSS-in-JS for MUI styling
- **@emotion/styled** (^11.11.0) - Styled components for MUI

**Data Fetching and Forms:**
- **axios** (^1.6.2) - HTTP client for API requests
- **react-hook-form** (^7.49.2) - Form state management
- **zod** (^3.22.4) - Schema validation

**Utilities:**
- **date-fns** (^3.0.6) - Date manipulation library
- **lodash-es** (^4.17.21) - Utility functions (ES modules)
- **jwt-decode** (^4.0.0) - JWT token decoding

**Development Tools:**
- **vite** (^5.0.8) - Build tool and development server
- **vitest** (^1.0.4) - Unit test framework
- **@playwright/test** (^1.40.1) - End-to-end testing
- **eslint** (^8.56.0) - Code linting
- **prettier** (^3.1.1) - Code formatting

### Installation Troubleshooting

**Issue: Peer dependency warnings**
```bash
# These warnings are usually safe to ignore if versions are close
# If you encounter errors, try:
npm install --legacy-peer-deps
```

**Issue: Lock file conflicts**
```bash
# If package-lock.json has conflicts, regenerate it:
rm package-lock.json
rm -rf node_modules
npm install
```

**Issue: Network timeouts**
```bash
# Increase timeout and retry:
npm install --fetch-timeout=60000
```

## Environment Configuration

### Environment Variables

The application uses environment variables for configuration. Create environment-specific files based on the provided template:

**1. Copy the example file:**
```bash
cp .env.example .env.development
```

**2. Configure variables for development:**

Edit `.env.development` with your local configuration:

```bash
# API Configuration
VITE_API_BASE_URL=http://localhost/moodle/api/v1
VITE_MOODLE_BASE_URL=http://localhost/moodle

# JWT Configuration (must match backend config.php)
VITE_JWT_EXPIRATION=3600
VITE_REFRESH_TOKEN_EXPIRATION=604800

# Feature Flags
VITE_ENABLE_REACT_DASHBOARD=true
VITE_ENABLE_REACT_COURSES=true
VITE_ENABLE_REACT_ASSIGNMENTS=false
VITE_ENABLE_REACT_QUIZZES=false
VITE_ENABLE_REACT_GRADEBOOK=false

# Development Settings
VITE_ENABLE_DEVTOOLS=true
VITE_LOG_LEVEL=debug
VITE_ENABLE_MOCK_API=false

# CORS Configuration (for development)
VITE_CORS_CREDENTIALS=true
```

### Environment Variable Reference

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `VITE_API_BASE_URL` | Base URL for API endpoints | Yes | - |
| `VITE_MOODLE_BASE_URL` | Base URL for Moodle installation | Yes | - |
| `VITE_JWT_EXPIRATION` | Access token expiration (seconds) | No | 3600 |
| `VITE_REFRESH_TOKEN_EXPIRATION` | Refresh token expiration (seconds) | No | 604800 |
| `VITE_ENABLE_REACT_DASHBOARD` | Enable React dashboard | No | true |
| `VITE_ENABLE_REACT_COURSES` | Enable React course pages | No | true |
| `VITE_ENABLE_DEVTOOLS` | Enable Redux/React Query DevTools | No | true |
| `VITE_LOG_LEVEL` | Logging level (debug/info/warn/error) | No | info |

**Note:** All environment variables must be prefixed with `VITE_` to be accessible in the application (Vite requirement).

### Environment-Specific Configurations

**Development (.env.development):**
- Used automatically when running `npm run dev`
- Enables all debugging tools
- Points to local API server
- Verbose logging

**Staging (.env.staging):**
```bash
VITE_API_BASE_URL=https://staging.moodle.example.com/api/v1
VITE_MOODLE_BASE_URL=https://staging.moodle.example.com
VITE_ENABLE_DEVTOOLS=false
VITE_LOG_LEVEL=info
```

**Production (.env.production):**
```bash
VITE_API_BASE_URL=https://moodle.example.com/api/v1
VITE_MOODLE_BASE_URL=https://moodle.example.com
VITE_ENABLE_DEVTOOLS=false
VITE_LOG_LEVEL=error
VITE_ENABLE_MOCK_API=false
```

### Backend Configuration

Ensure your Moodle backend (`config.php`) has the corresponding API and JWT configuration:

```php
// API Configuration
$CFG->api_enabled = true;
$CFG->api_base_path = '/api/v1';

// JWT Configuration
$CFG->jwt_secret = 'your-256-bit-secret-here'; // Must be secure in production
$CFG->jwt_expiration = 3600; // 1 hour
$CFG->jwt_refresh_expiration = 604800; // 7 days

// CORS Configuration
$CFG->cors_origins = ['http://localhost:5173']; // Add dev server URL
$CFG->cors_credentials = true;

// Feature Flags
$CFG->react_features = [
    'dashboard' => true,
    'courses' => true,
    'assignments' => false,
    'quizzes' => false,
    'gradebook' => false,
];
```

## Development Server

### Start the Development Server

Using **npm**:
```bash
npm run dev
```

Using **pnpm**:
```bash
pnpm dev
```

**Expected Output:**
```
  VITE v5.0.8  ready in 450 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
  ➜  press h to show help
```

### Access the Application

Open your browser and navigate to:
```
http://localhost:5173
```

### Development Server Features

**Hot Module Replacement (HMR):**
- Changes to React components are reflected instantly without full page reload
- Preserves component state during updates
- Fast feedback loop for development

**Fast Refresh:**
- Automatic component reloading on file changes
- Error overlay for compile-time and runtime errors
- Syntax error recovery

**Development Tools:**
- Redux DevTools integration (if browser extension installed)
- React Query DevTools (automatically enabled in development)
- React DevTools compatibility
- Source maps for debugging

### Change the Development Port

If port 5173 is already in use, you can specify a different port:

```bash
# Using npm
npm run dev -- --port 3000

# Using pnpm
pnpm dev --port 3000
```

Or configure it in `vite.config.ts`:
```typescript
export default defineConfig({
  server: {
    port: 3000,
    host: true, // Expose on network
  },
});
```

## Build Commands

### Production Build

Create an optimized production build:

Using **npm**:
```bash
npm run build
```

Using **pnpm**:
```bash
pnpm build
```

**Build Process:**
1. TypeScript compilation (`tsc`)
2. Vite optimization and bundling
3. Code splitting by route
4. Minification and tree shaking
5. Asset optimization

**Output Directory:**
```
dist/
├── assets/
│   ├── index-[hash].js      # Main application bundle
│   ├── vendor-[hash].js     # Third-party dependencies
│   ├── [route]-[hash].js    # Route-specific chunks
│   └── [name]-[hash].css    # Compiled styles
├── index.html               # Entry HTML file
└── manifest.json            # PWA manifest
```

**Build Output Analysis:**
```bash
# The build command outputs bundle sizes and warnings
✓ 1234 modules transformed.
dist/index.html                   0.45 kB
dist/assets/index-a1b2c3.js     287.23 kB │ gzip: 92.15 kB
dist/assets/vendor-d4e5f6.js   512.48 kB │ gzip: 178.92 kB
```

**Target Bundle Sizes:**
- Main bundle: <300KB gzipped
- Total initial load: <500KB gzipped
- Individual route chunks: <100KB gzipped

### Preview Production Build

Test the production build locally:

```bash
npm run preview
```

This starts a local server serving the `dist/` directory:
```
  ➜  Local:   http://localhost:4173/
  ➜  Network: use --host to expose
```

**Note:** This is for testing only. Use a proper web server (NGINX, Apache) in production.

### Build Optimization Tips

**Analyze Bundle Size:**
```bash
# Install bundle analyzer
npm install -D rollup-plugin-visualizer

# Add to vite.config.ts and rebuild
# This generates stats.html showing bundle composition
```

**Check for Large Dependencies:**
```bash
# Use source-map-explorer or similar tools
npm install -D source-map-explorer
npm run build
source-map-explorer dist/assets/*.js
```

## Additional Commands

### Linting

**Run ESLint:**
```bash
# Check for linting errors
npm run lint

# Auto-fix linting errors
npm run lint:fix
```

**ESLint Rules:**
- TypeScript strict type checking
- React hooks rules
- React accessibility (jsx-a11y)
- No unused variables or imports
- Consistent code style

### Code Formatting

**Run Prettier:**
```bash
# Check formatting
npm run format:check

# Auto-format code
npm run format
```

**Formatted Files:**
- All `.ts` and `.tsx` files
- All `.css` files
- Configuration files (JSON, etc.)

### Type Checking

**Run TypeScript Compiler:**
```bash
npm run type-check
```

This runs `tsc --noEmit` to check types without generating files.

**Common Type Errors:**
- Missing type definitions
- Incorrect prop types
- API response type mismatches
- Implicit `any` types (not allowed in strict mode)

### Testing

**Unit and Integration Tests:**
```bash
# Run tests once
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with UI
npm run test:ui

# Generate coverage report
npm run coverage
```

**End-to-End Tests:**
```bash
# Run E2E tests (headless)
npm run test:e2e

# Run E2E tests with UI
npm run test:e2e:ui

# Run specific test file
npm run test:e2e -- tests/login.spec.ts
```

**Coverage Targets:**
- Unit tests: 90%+ for critical business logic
- Integration tests: All API integration points
- E2E tests: 15 critical user journeys

### Storybook (Component Documentation)

**Run Storybook:**
```bash
npm run storybook
```

Access at: `http://localhost:6006`

**Build Storybook:**
```bash
npm run build-storybook
```

### Pre-commit Hooks

The project uses Husky and lint-staged for pre-commit validation:

**Automatic Checks:**
- ESLint on staged `.ts` and `.tsx` files
- Prettier formatting on staged files
- TypeScript type checking

**Setup (if not initialized):**
```bash
npm run prepare
```

## IDE Setup

### Visual Studio Code (Recommended)

**Recommended Extensions:**

Install these extensions for the best development experience:

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "ms-vscode.vscode-typescript-next",
    "dsznajder.es7-react-js-snippets",
    "styled-components.vscode-styled-components",
    "bradlc.vscode-tailwindcss",
    "mikestead.dotenv",
    "prisma.prisma",
    "steoates.autoimport"
  ]
}
```

**Workspace Settings:**

Create `.vscode/settings.json`:
```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true,
    "source.organizeImports": true
  },
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "eslint.validate": [
    "javascript",
    "javascriptreact",
    "typescript",
    "typescriptreact"
  ],
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[typescriptreact]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  }
}
```

**Debugging Configuration:**

Create `.vscode/launch.json`:
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "chrome",
      "request": "launch",
      "name": "Launch Chrome against localhost",
      "url": "http://localhost:5173",
      "webRoot": "${workspaceFolder}/src",
      "sourceMaps": true
    },
    {
      "type": "node",
      "request": "launch",
      "name": "Vitest: Debug Current Test",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "test", "--", "--run"],
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen"
    }
  ]
}
```

**Snippets:**

The ES7 React snippets extension provides useful shortcuts:
- `rafce` - React Arrow Function Component Export
- `useState` - useState Hook
- `useEffect` - useEffect Hook
- `useMemo` - useMemo Hook
- `useCallback` - useCallback Hook

### Other IDEs

**WebStorm:**
- ESLint and Prettier are supported out of the box
- Configure TypeScript service to use project version
- Enable code quality tools in Preferences > Languages & Frameworks

**Sublime Text:**
- Install Package Control
- Install packages: TypeScript, ESLint, Prettier, React

## Troubleshooting

### Common Issues and Solutions

#### Issue: Node Version Mismatch

**Error:**
```
Error: The engine "node" is incompatible with this module.
Expected version ">=20.0.0". Got "18.12.0"
```

**Solution:**
```bash
# Using nvm
nvm install 20
nvm use 20

# Verify version
node --version  # Should be v20.x.x

# Set as default
nvm alias default 20
```

#### Issue: Dependency Conflicts

**Error:**
```
npm ERR! Could not resolve dependency:
npm ERR! peer react@"^18.0.0" from @mui/material@5.15.0
```

**Solution:**
```bash
# Clear npm cache
npm cache clean --force

# Remove node_modules and lock file
rm -rf node_modules package-lock.json

# Reinstall with legacy peer deps flag if needed
npm install --legacy-peer-deps

# Or use pnpm which handles peer dependencies better
pnpm install
```

#### Issue: Port Already in Use

**Error:**
```
Error: Port 5173 is already in use
```

**Solution:**
```bash
# Option 1: Kill the process using the port (macOS/Linux)
lsof -ti:5173 | xargs kill -9

# Option 2: Use a different port
npm run dev -- --port 3000

# Option 3: Find and stop the process manually
# macOS/Linux:
lsof -i :5173
# Windows:
netstat -ano | findstr :5173
```

#### Issue: Environment Variables Not Loading

**Error:**
```
API_BASE_URL is undefined
```

**Solution:**
```bash
# 1. Ensure .env.development exists
ls -la .env.development

# 2. Verify variable names start with VITE_
# Incorrect: API_BASE_URL=...
# Correct: VITE_API_BASE_URL=...

# 3. Restart the development server
# Environment variables are loaded at server start

# 4. Check for syntax errors in .env file
# No spaces around =
# No quotes needed for values
```

#### Issue: TypeScript Errors

**Error:**
```
Type 'string | undefined' is not assignable to type 'string'
```

**Solution:**
```typescript
// Use type guards or default values
const apiUrl = process.env.VITE_API_BASE_URL || 'http://localhost/api/v1';

// Or use non-null assertion (if you're certain)
const apiUrl = process.env.VITE_API_BASE_URL!;

// Or define types in vite-env.d.ts
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_MOODLE_BASE_URL: string;
  // ... other env variables
}
```

#### Issue: Module Not Found

**Error:**
```
Cannot find module '@/components/Layout'
```

**Solution:**
```bash
# 1. Verify path alias configuration in tsconfig.json
# Should include:
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}

# 2. Verify vite.config.ts has resolve alias
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});

# 3. Restart TypeScript server in IDE
# VS Code: Cmd+Shift+P > "TypeScript: Restart TS Server"
```

#### Issue: Build Fails with Out of Memory

**Error:**
```
FATAL ERROR: Ineffective mark-compacts near heap limit
```

**Solution:**
```bash
# Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=4096"

# Then run build
npm run build

# Or add to package.json scripts:
"build": "NODE_OPTIONS='--max-old-space-size=4096' tsc && vite build"
```

#### Issue: CORS Errors in Development

**Error:**
```
Access to XMLHttpRequest at 'http://localhost/moodle/api/v1/auth/login'
from origin 'http://localhost:5173' has been blocked by CORS policy
```

**Solution:**
```php
// 1. Add development URL to CORS origins in backend config.php
$CFG->cors_origins = [
    'http://localhost:5173',
    'http://127.0.0.1:5173'
];
$CFG->cors_credentials = true;

// 2. Ensure API endpoints send proper CORS headers
header('Access-Control-Allow-Origin: http://localhost:5173');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// 3. Or use Vite proxy in development (vite.config.ts)
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '/moodle/api'),
      },
    },
  },
});
```

#### Issue: Hot Reload Not Working

**Solution:**
```bash
# 1. Check file system watchers limit (Linux)
cat /proc/sys/fs/inotify/max_user_watches
# If low, increase it:
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
sudo sysctl -p

# 2. Restart development server
npm run dev

# 3. Clear browser cache
# Hard refresh: Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (macOS)
```

#### Issue: Tests Failing with "Cannot find module"

**Solution:**
```typescript
// 1. Ensure vitest.config.ts has proper path resolution
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './tests/setup.ts',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});

// 2. Clear test cache
npx vitest --clearCache

// 3. Reinstall dependencies
rm -rf node_modules
npm install
```

### Getting Help

If you encounter issues not covered here:

1. **Check the logs:** Look for detailed error messages in the terminal
2. **Search existing issues:** Check the project's issue tracker on GitHub
3. **Ask the team:** Reach out in the development Slack channel
4. **Documentation:** Review the architecture docs in `docs/architecture/`
5. **Stack Overflow:** Search for similar Vite, React, or TypeScript issues

## Next Steps

Now that your development environment is set up, you can proceed to:

1. **Review Architecture Documentation**
   - Read `docs/architecture/README.md` for system overview
   - Understand the API integration patterns
   - Review the state management strategy

2. **Explore Testing Guidelines**
   - Read `docs/development/testing.md` for testing best practices
   - Learn how to write unit tests with Vitest
   - Understand E2E testing with Playwright

3. **Start Development**
   - Review component development guidelines
   - Check the Storybook for existing components
   - Follow coding standards in `.eslintrc.cjs`

4. **API Integration**
   - Review API endpoint documentation
   - Understand authentication flow with JWT
   - Learn about error handling patterns

5. **Component Development**
   - Study Material-UI theme customization
   - Review existing components in `src/components/`
   - Follow React best practices and hooks guidelines

### Useful Resources

- [React 18 Documentation](https://react.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Vite Documentation](https://vitejs.dev/)
- [Material-UI Documentation](https://mui.com/)
- [React Router Documentation](https://reactrouter.com/)
- [Redux Toolkit Documentation](https://redux-toolkit.js.org/)
- [React Query Documentation](https://tanstack.com/query/latest)

---

**Happy Coding!** 🚀

If you have any questions or need assistance, please reach out to the development team.
