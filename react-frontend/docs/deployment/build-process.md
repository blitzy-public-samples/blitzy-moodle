# Build Process Documentation

## Overview

This document provides comprehensive guidance for building the Moodle React frontend for production deployment. The build process transforms TypeScript source code into optimized, production-ready JavaScript bundles using Vite, with a focus on performance, bundle size optimization, and code splitting.

## Performance Targets

All production builds must meet these mandatory performance targets:

- **Main Bundle Size**: <300KB gzipped
- **Lighthouse Performance Score**: >90
- **First Contentful Paint (FCP)**: <1.5 seconds on 3G
- **Time to Interactive (TTI)**: <5 seconds
- **Largest Contentful Paint (LCP)**: <2.5 seconds
- **First Input Delay (FID)**: <100ms
- **Cumulative Layout Shift (CLS)**: <0.1

---

## 1. Build Commands

### Install Dependencies

Before building, ensure all npm dependencies are installed:

```bash
# Install dependencies from package-lock.json
npm install

# Or use clean install for CI/CD
npm ci
```

**Recommended for CI/CD**: Use `npm ci` for faster, reproducible builds that rely on `package-lock.json`.

### Production Build

Execute the production build process:

```bash
# Full production build (type checking + bundling)
npm run build
```

This command executes: `tsc && vite build`

**Build Steps**:
1. **TypeScript Type Checking**: `tsc --noEmit` validates all types without generating output
2. **Vite Bundling**: Creates optimized production bundles in `dist/` directory

### Preview Production Build

Test the production build locally before deployment:

```bash
# Serve the production build on http://localhost:4173
npm run preview
```

This starts a local static file server serving the `dist/` directory, allowing you to test the production build with production-like performance characteristics.

### Other Useful Build Commands

```bash
# Type checking only (no build)
npm run type-check

# Development build with hot module replacement
npm run dev

# Run linter on all source files
npm run lint

# Auto-fix linting issues
npm run lint:fix

# Format code with Prettier
npm run format

# Check code formatting
npm run format:check
```

---

## 2. Build Process Steps

The production build follows these sequential steps:

### Step 1: TypeScript Type Checking

```bash
tsc --noEmit
```

**Purpose**: Validate TypeScript types across the entire codebase without generating output files.

**Validation**:
- All imports resolve correctly
- No type errors (strict mode enabled)
- Props interfaces match component usage
- API response types align with backend contracts

**Common Issues**:
- Missing type definitions for third-party libraries
- Incorrect prop types passed to components
- API response type mismatches

### Step 2: Vite Bundling and Optimization

```bash
vite build
```

**Vite Build Process**:
1. **Entry Point Resolution**: Loads `src/main.tsx` as the application entry point
2. **Dependency Resolution**: Analyzes import graph to determine all required modules
3. **Code Transformation**: Transpiles TypeScript to JavaScript, processes JSX
4. **Tree Shaking**: Removes unused code from bundles
5. **Minification**: Minifies JavaScript using esbuild (fast) and Terser (production)
6. **Asset Processing**: Optimizes images, fonts, and other static assets
7. **Chunk Generation**: Creates separate chunks based on splitting configuration

### Step 3: Code Splitting

**Automatic Code Splitting**:
- **Route-Based Splitting**: Each route loaded with `React.lazy()` creates a separate chunk
- **Vendor Splitting**: Third-party libraries (React, MUI) bundled in separate vendor chunks
- **Dynamic Imports**: Components imported with `import()` create separate chunks

**Example Route Splitting**:
```typescript
// Automatic chunk created for dashboard route
const DashboardPage = React.lazy(() => import('@/features/dashboard/pages/DashboardPage'));

// Automatic chunk created for courses route
const CoursesPage = React.lazy(() => import('@/features/courses/pages/CourseCatalogPage'));
```

**Manual Chunk Configuration** (in `vite.config.ts`):
```typescript
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        'vendor-react': ['react', 'react-dom', 'react-router-dom'],
        'vendor-mui': ['@mui/material', '@mui/icons-material'],
        'vendor-state': ['@reduxjs/toolkit', 'react-redux', '@tanstack/react-query'],
      }
    }
  }
}
```

### Step 4: Tree Shaking

**Purpose**: Remove unused code from bundles to reduce size.

**How It Works**:
- Vite uses Rollup for production builds, which performs tree shaking automatically
- ES6 module syntax enables static analysis of imports/exports
- Only imported and used code is included in final bundles

**Best Practices**:
- Use named imports: `import { Button } from '@mui/material'` (not `import * as MUI`)
- Avoid side effects in modules
- Use ES6 modules (not CommonJS)
- Mark pure functions with `/*#__PURE__*/` comment if needed

### Step 5: Asset Optimization

**Images**:
- Automatic optimization by Vite
- Inlined as base64 if <4KB
- Hashed filenames for cache busting (`image.abc123.png`)
- WebP format recommended for smaller size

**Fonts**:
- Subsetting: Include only required character sets
- Preloading: Critical fonts loaded via `<link rel="preload">`
- Formats: WOFF2 (primary), WOFF (fallback)

**Other Assets**:
- SVG icons optimized and inlined when small
- CSS extracted to separate files with source maps
- JSON config files bundled or fetched dynamically

### Step 6: CSS Minification and Extraction

**CSS Processing**:
- Emotion CSS-in-JS converted to optimized CSS
- Unused CSS removed (if detected)
- CSS minified and extracted to separate `.css` files
- Source maps generated for debugging

**Output**:
- `assets/index.css`: Main application styles
- Hashed filenames for cache busting

---

## 3. Bundle Optimization

### Bundle Size Target

**Critical Requirement**: Main bundle must be <300KB gzipped

**Measuring Bundle Size**:
```bash
npm run build

# Output shows chunk sizes:
# dist/assets/index-abc123.js        285.32 kB │ gzip: 95.41 kB
# dist/assets/vendor-react-def456.js  145.67 kB │ gzip: 48.23 kB
```

### Vendor Splitting Strategy

**Purpose**: Separate third-party libraries into dedicated chunks for better caching.

**Configuration** (in `vite.config.ts`):
```typescript
manualChunks: {
  // React ecosystem (stable, rarely changes)
  'vendor-react': ['react', 'react-dom', 'react-router-dom'],
  
  // Material-UI (large library, separate chunk)
  'vendor-mui': ['@mui/material', '@mui/icons-material', '@emotion/react', '@emotion/styled'],
  
  // State management (moderate size)
  'vendor-state': ['@reduxjs/toolkit', 'react-redux', '@tanstack/react-query'],
  
  // Utilities (small, frequently updated)
  'vendor-utils': ['axios', 'date-fns', 'lodash-es', 'zod'],
}
```

**Benefits**:
- Users cache vendor bundles separately (less re-downloading on app updates)
- Parallel loading of chunks improves performance
- Easier to identify large dependencies

### Dynamic Imports for Large Components

**Lazy Load Heavy Components**:
```typescript
// Large rich text editor - load only when needed
const RichTextEditor = React.lazy(() => import('@/components/editor/RichTextEditor'));

// Use with Suspense
<Suspense fallback={<LoadingSpinner />}>
  <RichTextEditor value={content} onChange={handleChange} />
</Suspense>
```

**Components to Consider for Lazy Loading**:
- Rich text editors
- Chart libraries
- PDF viewers
- Large data tables
- Admin panels (not needed by students)

### Route-Based Code Splitting

**Automatic Splitting with React.lazy()**:
```typescript
// router.tsx
const routes = [
  {
    path: '/dashboard',
    element: <React.lazy(() => import('@/features/dashboard/pages/DashboardPage')) />
  },
  {
    path: '/courses',
    element: <React.lazy(() => import('@/features/courses/pages/CourseCatalogPage')) />
  },
  {
    path: '/assignments/:id',
    element: <React.lazy(() => import('@/features/activities/assignments/pages/AssignmentPage')) />
  },
];
```

**Benefits**:
- Users only download code for routes they visit
- Initial bundle size reduced significantly
- Improved initial page load time

### Optimization Checklist

- [ ] Main bundle <300KB gzipped
- [ ] Vendor chunks separated (React, MUI, state management)
- [ ] Route-based code splitting implemented
- [ ] Large components lazy loaded
- [ ] Tree shaking effective (check bundle analyzer)
- [ ] Images optimized (WebP format, lazy loading)
- [ ] Fonts subset and preloaded
- [ ] Unused dependencies removed

---

## 4. Environment Variables

### Build-Time Injection

Environment variables are injected at build time (not runtime) and must be prefixed with `VITE_`.

**Configuration Files**:
- `.env.development`: Development environment
- `.env.staging`: Staging environment
- `.env.production`: Production environment
- `.env.example`: Template with all variables (committed to Git)

**Example .env.production**:
```bash
# API Configuration
VITE_API_BASE_URL=https://api.moodle.example.com
VITE_API_TIMEOUT=30000

# Authentication
VITE_JWT_ACCESS_TOKEN_EXPIRY=3600
VITE_JWT_REFRESH_TOKEN_EXPIRY=604800

# Feature Flags
VITE_ENABLE_ANALYTICS=true
VITE_ENABLE_DEBUG_MODE=false

# External Services
VITE_SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
VITE_GOOGLE_ANALYTICS_ID=UA-XXXXXXXXX-X
```

### Accessing Environment Variables

**In TypeScript Code**:
```typescript
// Access via import.meta.env
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
const isProduction = import.meta.env.PROD; // Built-in Vite variable

// Type-safe access (define in vite-env.d.ts)
/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_API_TIMEOUT: number;
  readonly VITE_ENABLE_ANALYTICS: boolean;
}
```

### Environment-Specific Builds

**Build for Different Environments**:
```bash
# Development build
npm run build -- --mode development

# Staging build
npm run build -- --mode staging

# Production build (default)
npm run build
```

**Important Notes**:
- Environment variables are embedded in the bundle at build time
- Different builds required for different environments
- Never expose secrets in client-side environment variables
- Use server-side environment variables for sensitive data

---

## 5. Build Output

### Output Directory Structure

After running `npm run build`, the `dist/` directory contains:

```
dist/
├── index.html                          # Entry point (optimized, minified)
├── assets/
│   ├── index-abc123.js                 # Main application bundle
│   ├── index-abc123.js.map             # Source map for debugging
│   ├── vendor-react-def456.js          # React vendor chunk
│   ├── vendor-mui-ghi789.js            # Material-UI vendor chunk
│   ├── dashboard-jkl012.js             # Dashboard route chunk
│   ├── courses-mno345.js               # Courses route chunk
│   ├── index-pqr678.css                # Extracted CSS
│   ├── logo-stu901.svg                 # Optimized images
│   └── roboto-vwx234.woff2             # Optimized fonts
├── favicon.ico                         # Site favicon
├── robots.txt                          # SEO robots file
└── manifest.json                       # PWA manifest
```

### index.html

**Optimized Entry Point**:
- Minified HTML
- Preload critical resources
- Inline critical CSS (optional)
- Script tags with module type and hashed filenames

**Example**:
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <link rel="icon" type="image/x-icon" href="/favicon.ico">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Moodle LMS</title>
  <!-- Preload critical resources -->
  <link rel="preload" href="/assets/vendor-react-def456.js" as="script">
  <link rel="stylesheet" href="/assets/index-pqr678.css">
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/assets/index-abc123.js"></script>
</body>
</html>
```

### Asset Hashing

**Cache Busting**:
- All assets have content-based hashes in filenames
- Enables aggressive browser caching with long max-age
- Changing content results in new hash, forcing cache invalidation

**Example**:
- `index-abc123.js` → Updated to `index-xyz789.js` when content changes
- Browser cache remains valid for unchanged files

### Source Maps

**Purpose**: Enable debugging of production code by mapping minified code back to source.

**Configuration** (in `vite.config.ts`):
```typescript
build: {
  sourcemap: true,  // Generate source maps
}
```

**Usage**:
- Upload source maps to error tracking services (Sentry)
- Browser DevTools can show original source code
- Stack traces reference original line numbers

**Security Note**: Consider serving source maps only to authenticated developers, not public users.

---

## 6. Build Verification

### Automated Verification Steps

After building, verify the build meets quality standards:

#### Step 1: Check Bundle Sizes

```bash
npm run build

# Verify output shows sizes within targets:
# ✓ Main bundle <300KB gzipped ✓
# ✓ Total bundle size reasonable ✓
```

**Red Flags**:
- Main bundle >300KB gzipped
- Unexpected large chunks (investigate with bundle analyzer)
- Duplicate dependencies in multiple chunks

#### Step 2: Lighthouse Audit

**Run Lighthouse** (Chrome DevTools or CLI):
```bash
# Install Lighthouse CLI
npm install -g lighthouse

# Run audit on production build
npm run preview &
lighthouse http://localhost:4173 --view --preset=desktop
```

**Target Scores**:
- **Performance**: >90 (mandatory)
- **Accessibility**: >90 (mandatory)
- **Best Practices**: >90
- **SEO**: >80

**Common Issues**:
- Large bundle size (optimize code splitting)
- Render-blocking resources (preload critical assets)
- Unoptimized images (use WebP, lazy loading)
- Missing accessibility attributes

#### Step 3: Test Critical User Flows

**Manual Testing Checklist**:
- [ ] Login flow works correctly
- [ ] Dashboard loads and displays data
- [ ] Course catalog displays and filters work
- [ ] Course detail page loads content
- [ ] Assignment submission works
- [ ] Quiz attempt functions properly
- [ ] Gradebook displays correctly
- [ ] Messaging sends and receives messages
- [ ] Admin pages accessible with proper permissions
- [ ] Logout clears authentication

**Automated E2E Tests**:
```bash
# Run Playwright E2E tests against production build
npm run preview &
npm run test:e2e
```

#### Step 4: Verify Environment Variables

**Check Injected Variables**:
```javascript
// In browser console after loading production build
console.log(import.meta.env.VITE_API_BASE_URL);
// Should output: "https://api.moodle.example.com"
```

**Verification Points**:
- [ ] API_BASE_URL points to correct backend
- [ ] Feature flags match intended environment
- [ ] No development-only variables present in production
- [ ] No sensitive data exposed in client bundle

#### Step 5: Network Performance Check

**Browser DevTools Network Tab**:
- [ ] Initial page load <3 seconds on 3G throttling
- [ ] Subsequent navigation <500ms
- [ ] API requests have proper caching headers
- [ ] Static assets served with long cache times (1 year)
- [ ] Gzip/Brotli compression enabled

### Continuous Integration Verification

**GitHub Actions Build Verification** (example):
```yaml
- name: Build
  run: npm run build

- name: Check Bundle Size
  run: |
    SIZE=$(gzip -c dist/assets/index-*.js | wc -c)
    if [ $SIZE -gt 307200 ]; then
      echo "Bundle size exceeds 300KB gzipped"
      exit 1
    fi

- name: Lighthouse CI
  run: |
    npm run preview &
    npm install -g @lhci/cli
    lhci autorun --upload.target=temporary-public-storage
```

---

## 7. Optimization Techniques

### Code Splitting Strategies

#### 1. Route-Based Splitting

**Implementation**:
```typescript
// All routes automatically split with React.lazy()
import { lazy } from 'react';

const routes = [
  { path: '/', element: lazy(() => import('@/features/dashboard/pages/DashboardPage')) },
  { path: '/courses', element: lazy(() => import('@/features/courses/pages/CourseCatalogPage')) },
];
```

**Benefits**: Users download only code for visited routes.

#### 2. Feature-Based Splitting

**Implementation**:
```typescript
// Split large feature modules
const AdminPanel = lazy(() => import('@/features/admin'));

// Only admins will download admin code
{hasRole('admin') && <AdminPanel />}
```

**Benefits**: Role-specific code not downloaded by all users.

#### 3. Component-Based Splitting

**Implementation**:
```typescript
// Split heavy components used conditionally
const ChartComponent = lazy(() => import('@/components/charts/AdvancedChart'));

// Only load when user clicks "Show Chart"
{showChart && <ChartComponent data={data} />}
```

**Benefits**: Defer loading until actually needed.

### Virtual Scrolling for Long Lists

**Problem**: Rendering 1000+ items in DOM causes performance issues.

**Solution**: Use `react-window` or `react-virtualized`:
```typescript
import { FixedSizeList } from 'react-window';

function CourseList({ courses }) {
  return (
    <FixedSizeList
      height={600}
      itemCount={courses.length}
      itemSize={80}
      width="100%"
    >
      {({ index, style }) => (
        <div style={style}>
          <CourseCard course={courses[index]} />
        </div>
      )}
    </FixedSizeList>
  );
}
```

**Benefits**: Only visible items rendered, constant performance regardless of list size.

### React.memo for Expensive Components

**Problem**: Components re-render unnecessarily when parent updates.

**Solution**: Memoize components that are expensive to render:
```typescript
import { memo } from 'react';

const ExpensiveComponent = memo(({ data }) => {
  // Complex rendering logic
  return <div>{/* expensive output */}</div>;
});

// Only re-renders when `data` prop changes
```

**Use Cases**:
- Large lists with complex items
- Data visualizations (charts, graphs)
- Rich text editors

### Image Optimization

#### 1. WebP Format

**Conversion**:
```bash
# Convert PNG/JPG to WebP
cwebp input.png -o output.webp -q 80
```

**Benefits**: 25-35% smaller file size than PNG/JPG.

#### 2. Lazy Loading

**Implementation**:
```typescript
<img 
  src="/images/course-thumbnail.webp"
  alt="Course thumbnail"
  loading="lazy"  // Browser native lazy loading
/>
```

**Benefits**: Images below the fold not loaded until scrolled into view.

#### 3. Responsive Images

**Implementation**:
```typescript
<img
  srcSet="
    /images/course-sm.webp 400w,
    /images/course-md.webp 800w,
    /images/course-lg.webp 1200w
  "
  sizes="(max-width: 600px) 400px, (max-width: 1200px) 800px, 1200px"
  src="/images/course-md.webp"
  alt="Course"
/>
```

**Benefits**: Appropriate image size loaded based on device screen size.

### Font Optimization

#### 1. Font Subsetting

**Purpose**: Include only characters actually used in your application.

**Tools**:
```bash
# Subset font to Latin characters only
pyftsubset font.ttf \
  --unicodes="U+0020-007E" \
  --output-file="font-subset.woff2" \
  --flavor=woff2
```

**Benefits**: Reduce font file size by 50-80%.

#### 2. Font Preloading

**Implementation** (in `index.html`):
```html
<link 
  rel="preload" 
  href="/fonts/roboto-v30-latin-regular.woff2" 
  as="font" 
  type="font/woff2" 
  crossorigin
>
```

**Benefits**: Critical fonts loaded earlier, reducing text layout shift.

#### 3. Font Display Strategy

**CSS**:
```css
@font-face {
  font-family: 'Roboto';
  src: url('/fonts/roboto.woff2') format('woff2');
  font-display: swap;  /* Show fallback immediately, swap when loaded */
}
```

**Options**:
- `swap`: Show fallback immediately (recommended for body text)
- `optional`: Use font only if already cached (optimal for performance)

### Bundle Analysis

**Visualize Bundle Composition**:
```bash
# Install bundle analyzer
npm install -D rollup-plugin-visualizer

# Add to vite.config.ts
import { visualizer } from 'rollup-plugin-visualizer';

plugins: [
  visualizer({ open: true, gzipSize: true })
]

# Build and open visualization
npm run build
```

**Identify Issues**:
- Unexpectedly large dependencies
- Duplicate dependencies
- Unused code not tree-shaken

---

## 8. Troubleshooting Build Issues

### TypeScript Errors

#### Issue: Type errors during `tsc` check

**Symptoms**:
```
error TS2307: Cannot find module '@/features/auth/hooks/useAuth' or its corresponding type declarations.
```

**Solutions**:
1. **Check Path Aliases**: Verify `tsconfig.json` paths configuration
   ```json
   {
     "compilerOptions": {
       "paths": {
         "@/*": ["./src/*"]
       }
     }
   }
   ```

2. **Install Missing Type Definitions**:
   ```bash
   npm install -D @types/react @types/node
   ```

3. **Check Import Paths**: Ensure imports match actual file locations

#### Issue: Strict mode type errors

**Symptoms**:
```
error TS2345: Argument of type 'string | undefined' is not assignable to parameter of type 'string'.
```

**Solutions**:
1. **Add Type Guards**:
   ```typescript
   if (userId !== undefined) {
     fetchUser(userId);  // Now TypeScript knows it's defined
   }
   ```

2. **Use Non-Null Assertion** (if you're certain):
   ```typescript
   fetchUser(userId!);  // Tells TypeScript: "I guarantee this is defined"
   ```

3. **Provide Default Values**:
   ```typescript
   const name = user?.name ?? 'Anonymous';
   ```

### Module Resolution Issues

#### Issue: Module not found during build

**Symptoms**:
```
error: Could not resolve '@/components/Button'
```

**Solutions**:
1. **Check vite.config.ts aliases**:
   ```typescript
   resolve: {
     alias: {
       '@': path.resolve(__dirname, './src'),
     },
   }
   ```

2. **Verify file extension**: Ensure `.tsx` or `.ts` extension present
3. **Check case sensitivity**: File names are case-sensitive on Linux servers

#### Issue: Dependency not found

**Symptoms**:
```
error: Could not resolve 'axios'
```

**Solutions**:
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Or install missing dependency
npm install axios
```

### Build Memory Errors

#### Issue: JavaScript heap out of memory

**Symptoms**:
```
FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory
```

**Solutions**:
1. **Increase Node.js Memory**:
   ```bash
   NODE_OPTIONS="--max-old-space-size=4096" npm run build
   ```

2. **Optimize Build Configuration**:
   ```typescript
   // vite.config.ts
   build: {
     minify: 'esbuild',  // Faster than terser, uses less memory
     sourcemap: false,   // Disable if not needed
   }
   ```

3. **Check for Memory Leaks**: Large imports, circular dependencies

### Missing Dependencies

#### Issue: Dependency not installed

**Symptoms**:
```
Error: Cannot find module 'react'
```

**Solutions**:
```bash
# Install from package.json
npm install

# Or specific dependency
npm install react react-dom
```

#### Issue: Peer dependency warnings

**Symptoms**:
```
npm WARN react-redux@9.0.4 requires a peer of react@^18.0.0 but none is installed.
```

**Solutions**:
```bash
# Install peer dependency
npm install react@^18.0.0

# Or use --legacy-peer-deps flag
npm install --legacy-peer-deps
```

### Build Output Issues

#### Issue: Build succeeds but app doesn't work

**Debugging Steps**:
1. **Check browser console** for runtime errors
2. **Verify environment variables** are correctly injected
3. **Test production build locally**: `npm run preview`
4. **Check API connectivity** from production build
5. **Verify base URL** in `vite.config.ts` matches deployment path

#### Issue: Assets not loading (404 errors)

**Symptoms**: CSS, images, or JS files return 404 in production

**Solutions**:
1. **Check base URL configuration**:
   ```typescript
   // vite.config.ts
   export default defineConfig({
     base: '/moodle-react/',  // If deployed to subdirectory
   });
   ```

2. **Verify server configuration**: Ensure server serves files from `dist/` correctly

3. **Check asset paths**: Use relative paths or import assets correctly

### Performance Issues

#### Issue: Build time too slow

**Symptoms**: Build takes >5 minutes

**Solutions**:
1. **Use esbuild for minification**:
   ```typescript
   build: {
     minify: 'esbuild',  // Much faster than terser
   }
   ```

2. **Disable source maps** (if not needed):
   ```typescript
   build: {
     sourcemap: false,
   }
   ```

3. **Check for large dependencies**: Use bundle analyzer to identify bloat

#### Issue: Bundle size too large

**Symptoms**: Main bundle >300KB gzipped

**Solutions**:
1. **Analyze bundle**: `npm install -D rollup-plugin-visualizer`
2. **Lazy load heavy components**: Use `React.lazy()`
3. **Check for duplicate dependencies**: Run `npm dedupe`
4. **Remove unused dependencies**: Audit `package.json`
5. **Use tree-shakeable libraries**: Import only what's needed

---

## Summary

This build process documentation provides comprehensive guidance for creating production-ready builds of the Moodle React frontend. Key takeaways:

- **Always run `npm run build`** to create optimized production bundles
- **Verify bundle sizes** stay under 300KB gzipped for main bundle
- **Run Lighthouse audits** to ensure performance score >90
- **Test production builds locally** with `npm run preview` before deployment
- **Use code splitting** extensively for optimal load times
- **Optimize assets** (images, fonts) for best performance
- **Monitor build metrics** in CI/CD pipeline

For deployment procedures, see [Deployment Guide](./README.md).

For environment configuration, see [Environment Setup](./environment-setup.md).

For troubleshooting deployment issues, see [Troubleshooting Guide](./troubleshooting.md).
