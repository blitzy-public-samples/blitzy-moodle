# Monitoring and Alerting

## Table of Contents

- [Overview](#overview)
- [Performance Monitoring](#performance-monitoring)
- [Error Tracking](#error-tracking)
- [Logging Strategy](#logging-strategy)
- [API Monitoring](#api-monitoring)
- [Uptime Monitoring](#uptime-monitoring)
- [User Analytics](#user-analytics)
- [Alerting Configuration](#alerting-configuration)
- [Dashboard Setup](#dashboard-setup)
- [Integration Examples](#integration-examples)

## Overview

### Why Monitoring is Critical for SPAs

Single-Page Applications (SPAs) introduce unique monitoring challenges compared to traditional server-rendered applications:

- **Client-Side Performance**: JavaScript execution, bundle size, and rendering performance directly impact user experience
- **API Dependencies**: The SPA relies entirely on API availability and response times
- **State Management**: Complex client-side state can lead to subtle bugs that only manifest in production
- **Network Conditions**: Users on slow or unreliable networks experience different performance characteristics
- **Browser Diversity**: Different browsers and versions can exhibit different behaviors

Comprehensive monitoring ensures we detect and resolve issues before they significantly impact users.

### Key Metrics to Track

| Category | Metric | Target | Priority |
|----------|--------|--------|----------|
| **Performance** | First Contentful Paint (FCP) | <1.5s on 3G | Critical |
| **Performance** | Time to Interactive (TTI) | <5s | Critical |
| **Performance** | Largest Contentful Paint (LCP) | <2.5s | Critical |
| **Performance** | First Input Delay (FID) | <100ms | Critical |
| **Performance** | Cumulative Layout Shift (CLS) | <0.1 | High |
| **Performance** | Lighthouse Score | >90 | High |
| **Performance** | Bundle Size | <300KB gzipped | High |
| **Reliability** | Error Rate | <1% | Critical |
| **Reliability** | Uptime | >99.9% | Critical |
| **API** | Response Time (P50) | <300ms | Critical |
| **API** | Response Time (P95) | <1s | Critical |
| **API** | Response Time (P99) | <3s | High |
| **API** | Failed Request Rate | <0.5% | Critical |

### Recommended Monitoring Tools

| Tool | Purpose | Use Case |
|------|---------|----------|
| **Sentry** | Error tracking | JavaScript errors, source maps, release tracking |
| **Google Analytics 4** | User analytics | User behavior, feature adoption, conversion funnels |
| **DataDog RUM** | Real User Monitoring | Performance metrics, session replay, user flows |
| **Prometheus** | Metrics collection | Custom metrics, API performance, system health |
| **Grafana** | Visualization | Dashboards, historical trends, multi-source data |
| **Lighthouse CI** | Performance audits | Automated performance testing in CI/CD |
| **Pingdom/UptimeRobot** | Uptime monitoring | Availability checks, status page |
| **CloudWatch/ELK** | Log aggregation | Centralized logging, search, analysis |

## Performance Monitoring

### Core Web Vitals

Core Web Vitals are standardized metrics that Google uses to measure user experience. These directly impact SEO and user satisfaction.

#### Largest Contentful Paint (LCP)

**Target: <2.5 seconds**

LCP measures the time it takes for the largest content element to become visible in the viewport.

**Optimization Strategies:**
- Optimize images (WebP format, responsive sizes, lazy loading)
- Minimize render-blocking resources (CSS, JavaScript)
- Use CDN for static assets
- Implement server-side rendering (SSR) for critical content
- Preload critical resources

**Monitoring Implementation:**

```javascript
// src/utils/performance.ts
import { getCLS, getFID, getLCP } from 'web-vitals';

export function initWebVitals() {
  getLCP((metric) => {
    sendToAnalytics({
      name: 'LCP',
      value: metric.value,
      delta: metric.delta,
      id: metric.id,
      rating: metric.rating,
    });
  });
}

function sendToAnalytics(metric: any) {
  // Send to your analytics endpoint
  if (window.gtag) {
    window.gtag('event', metric.name, {
      value: Math.round(metric.value),
      metric_rating: metric.rating,
      metric_delta: Math.round(metric.delta),
      metric_id: metric.id,
    });
  }
}
```

#### First Input Delay (FID)

**Target: <100 milliseconds**

FID measures the time from when a user first interacts with your site to when the browser can respond to that interaction.

**Optimization Strategies:**
- Break up long-running JavaScript tasks
- Use web workers for heavy computations
- Implement code splitting and lazy loading
- Minimize main thread work
- Use React.memo and useMemo for expensive renders

**Monitoring Implementation:**

```javascript
// src/utils/performance.ts
import { getFID } from 'web-vitals';

export function initFID() {
  getFID((metric) => {
    sendToAnalytics({
      name: 'FID',
      value: metric.value,
      delta: metric.delta,
      id: metric.id,
      rating: metric.rating,
    });
  });
}
```

#### Cumulative Layout Shift (CLS)

**Target: <0.1**

CLS measures visual stability by quantifying unexpected layout shifts during page load.

**Optimization Strategies:**
- Specify image and video dimensions
- Reserve space for dynamic content
- Avoid inserting content above existing content
- Use CSS transforms for animations
- Preload fonts to avoid FOIT/FOUT

**Monitoring Implementation:**

```javascript
// src/utils/performance.ts
import { getCLS } from 'web-vitals';

export function initCLS() {
  getCLS((metric) => {
    sendToAnalytics({
      name: 'CLS',
      value: metric.value,
      delta: metric.delta,
      id: metric.id,
      rating: metric.rating,
    });
  });
}
```

### Custom Performance Metrics

#### First Contentful Paint (FCP)

**Target: <1.5 seconds on 3G connection**

FCP measures when the browser first renders any text, image, or canvas.

```javascript
// src/utils/performance.ts
export function measureFCP() {
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.name === 'first-contentful-paint') {
        sendToAnalytics({
          name: 'FCP',
          value: entry.startTime,
          rating: entry.startTime < 1500 ? 'good' : entry.startTime < 2500 ? 'needs-improvement' : 'poor',
        });
      }
    }
  });
  
  observer.observe({ entryTypes: ['paint'] });
}
```

#### Time to Interactive (TTI)

**Target: <5 seconds**

TTI measures when the page becomes fully interactive and can reliably respond to user input.

```javascript
// src/utils/performance.ts
export function measureTTI() {
  if ('PerformanceObserver' in window) {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        // Check if this is a long task
        if (entry.duration > 50) {
          sendToAnalytics({
            name: 'long-task',
            value: entry.duration,
            startTime: entry.startTime,
          });
        }
      }
    });
    
    observer.observe({ entryTypes: ['longtask'] });
  }
}
```

#### Bundle Size Monitoring

**Target: Main bundle <300KB gzipped**

```javascript
// scripts/check-bundle-size.js
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const MAX_BUNDLE_SIZE = 300 * 1024; // 300KB

function checkBundleSize() {
  const distPath = path.join(__dirname, '../dist/assets');
  const jsFiles = fs.readdirSync(distPath).filter(file => file.endsWith('.js'));
  
  const mainBundle = jsFiles.find(file => file.startsWith('index-'));
  if (!mainBundle) {
    console.error('Main bundle not found');
    process.exit(1);
  }
  
  const bundlePath = path.join(distPath, mainBundle);
  const bundleContent = fs.readFileSync(bundlePath);
  const gzipSize = zlib.gzipSync(bundleContent).length;
  
  console.log(`Main bundle size: ${(gzipSize / 1024).toFixed(2)} KB (gzipped)`);
  
  if (gzipSize > MAX_BUNDLE_SIZE) {
    console.error(`Bundle size ${(gzipSize / 1024).toFixed(2)} KB exceeds limit of ${MAX_BUNDLE_SIZE / 1024} KB`);
    process.exit(1);
  }
  
  console.log('Bundle size check passed ✓');
}

checkBundleSize();
```

Add to `package.json`:

```json
{
  "scripts": {
    "check-bundle-size": "node scripts/check-bundle-size.js"
  }
}
```

### Lighthouse CI Integration

Automated Lighthouse audits in CI/CD pipeline ensure performance regressions are caught before production.

#### Installation

```bash
npm install -D @lhci/cli
```

#### Configuration

Create `.lighthouserc.json`:

```json
{
  "ci": {
    "collect": {
      "startServerCommand": "npm run preview",
      "url": ["http://localhost:4173/"],
      "numberOfRuns": 3,
      "settings": {
        "preset": "desktop",
        "throttling": {
          "rttMs": 40,
          "throughputKbps": 10240,
          "cpuSlowdownMultiplier": 1
        }
      }
    },
    "assert": {
      "preset": "lighthouse:recommended",
      "assertions": {
        "categories:performance": ["error", {"minScore": 0.9}],
        "categories:accessibility": ["error", {"minScore": 0.9}],
        "categories:best-practices": ["error", {"minScore": 0.9}],
        "categories:seo": ["warn", {"minScore": 0.9}],
        "first-contentful-paint": ["error", {"maxNumericValue": 1500}],
        "interactive": ["error", {"maxNumericValue": 5000}],
        "largest-contentful-paint": ["error", {"maxNumericValue": 2500}],
        "cumulative-layout-shift": ["error", {"maxNumericValue": 0.1}],
        "total-blocking-time": ["error", {"maxNumericValue": 300}]
      }
    },
    "upload": {
      "target": "temporary-public-storage"
    }
  }
}
```

#### GitHub Actions Integration

Add to `.github/workflows/lighthouse.yml`:

```yaml
name: Lighthouse CI

on:
  pull_request:
    branches: [main, develop]

jobs:
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build project
        run: npm run build
      
      - name: Run Lighthouse CI
        run: |
          npm install -g @lhci/cli
          lhci autorun
        env:
          LHCI_GITHUB_APP_TOKEN: ${{ secrets.LHCI_GITHUB_APP_TOKEN }}
```

### Real User Monitoring (RUM)

RUM tracks actual user experiences in production, capturing real-world performance data.

#### DataDog RUM Integration

```typescript
// src/services/monitoring/datadog.ts
import { datadogRum } from '@datadog/browser-rum';

export function initDatadogRUM() {
  datadogRum.init({
    applicationId: import.meta.env.VITE_DATADOG_APPLICATION_ID,
    clientToken: import.meta.env.VITE_DATADOG_CLIENT_TOKEN,
    site: 'datadoghq.com',
    service: 'moodle-react-frontend',
    env: import.meta.env.MODE,
    version: import.meta.env.VITE_APP_VERSION,
    sessionSampleRate: 100,
    sessionReplaySampleRate: 20,
    trackUserInteractions: true,
    trackResources: true,
    trackLongTasks: true,
    defaultPrivacyLevel: 'mask-user-input',
  });

  datadogRum.startSessionReplayRecording();
}
```

Initialize in `src/main.tsx`:

```typescript
import { initDatadogRUM } from './services/monitoring/datadog';

if (import.meta.env.PROD) {
  initDatadogRUM();
}
```

### Synthetic Monitoring

Scheduled performance checks simulate user interactions and measure performance from different locations.

#### Example: Pingdom Synthetic Test

```javascript
// Pingdom Transaction Check Script
var driver = new webdriver.Builder()
  .forBrowser('chrome')
  .build();

// Navigate to login page
driver.get('https://moodle.example.com/');

// Measure time to interactive
var startTime = Date.now();

// Wait for main content to load
driver.wait(until.elementLocated(By.id('main-content')), 10000);

// Click on course catalog
driver.findElement(By.linkText('Course Catalog')).click();

// Wait for courses to load
driver.wait(until.elementLocated(By.className('course-card')), 10000);

var endTime = Date.now();
var duration = endTime - startTime;

// Report metric
console.log('Course catalog load time: ' + duration + 'ms');

driver.quit();
```

## Error Tracking

### Sentry Integration

Sentry provides comprehensive error tracking with source maps, release tracking, and user context.

#### Installation

```bash
npm install --save @sentry/react
```

#### Configuration

Create `src/services/monitoring/sentry.ts`:

```typescript
import * as Sentry from '@sentry/react';
import { BrowserTracing } from '@sentry/tracing';
import { createRoutesFromChildren, matchRoutes, useLocation, useNavigationType } from 'react-router-dom';

export function initSentry() {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    release: import.meta.env.VITE_APP_VERSION,
    
    // Performance monitoring
    integrations: [
      new BrowserTracing({
        routingInstrumentation: Sentry.reactRouterV6Instrumentation(
          React.useEffect,
          useLocation,
          useNavigationType,
          createRoutesFromChildren,
          matchRoutes
        ),
      }),
    ],
    
    // Sample rates
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
    
    // Error filtering
    beforeSend(event, hint) {
      // Don't send errors from browser extensions
      if (event.exception?.values?.[0]?.stacktrace?.frames?.some(
        frame => frame.filename?.includes('chrome-extension://')
      )) {
        return null;
      }
      
      // Scrub sensitive data
      if (event.request?.headers) {
        delete event.request.headers['Authorization'];
      }
      
      return event;
    },
    
    // Ignore specific errors
    ignoreErrors: [
      // Browser extensions
      'top.GLOBALS',
      'originalCreateNotification',
      'canvas.contentDocument',
      'MyApp_RemoveAllHighlights',
      'atomicFindClose',
      // Network errors (already tracked via API monitoring)
      'Network request failed',
      'NetworkError',
      // User cancelled actions
      'AbortError',
    ],
    
    // Deny URLs
    denyUrls: [
      /extensions\//i,
      /^chrome:\/\//i,
      /^chrome-extension:\/\//i,
    ],
  });
}

// Set user context after login
export function setSentryUser(user: { id: string; email: string; role: string }) {
  Sentry.setUser({
    id: user.id,
    email: user.email,
    role: user.role,
  });
}

// Clear user context on logout
export function clearSentryUser() {
  Sentry.setUser(null);
}

// Add custom context
export function addSentryContext(key: string, value: any) {
  Sentry.setContext(key, value);
}

// Capture custom errors
export function captureError(error: Error, context?: Record<string, any>) {
  Sentry.captureException(error, {
    contexts: context ? { custom: context } : undefined,
  });
}
```

#### Wrap App with Sentry ErrorBoundary

Update `src/App.tsx`:

```typescript
import * as Sentry from '@sentry/react';
import { ErrorFallback } from './components/ErrorFallback';

function App() {
  return (
    <Sentry.ErrorBoundary fallback={ErrorFallback} showDialog>
      {/* Your app components */}
    </Sentry.ErrorBoundary>
  );
}

export default Sentry.withProfiler(App);
```

#### Source Map Upload

Add to `vite.config.ts`:

```typescript
import { sentryVitePlugin } from '@sentry/vite-plugin';

export default defineConfig({
  build: {
    sourcemap: true,
  },
  plugins: [
    react(),
    sentryVitePlugin({
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      telemetry: false,
    }),
  ],
});
```

Add to `.env.production`:

```env
SENTRY_ORG=your-org
SENTRY_PROJECT=moodle-react-frontend
SENTRY_AUTH_TOKEN=your-auth-token
```

### Error Rate Thresholds

| Threshold | Error Rate | Action |
|-----------|------------|--------|
| **Green** | <0.1% | Normal operations |
| **Warning** | 0.1% - 1% | Monitor closely, investigate patterns |
| **Critical** | 1% - 5% | Alert on-call engineer, immediate investigation |
| **Incident** | >5% | Page on-call, potential rollback, incident response |

### Error Categorization

Categorize errors to prioritize investigation and resolution:

```typescript
// src/utils/errorCategories.ts
export enum ErrorCategory {
  NETWORK = 'network',
  RUNTIME = 'runtime',
  BUILD = 'build',
  API = 'api',
  AUTHENTICATION = 'authentication',
  PERMISSION = 'permission',
  VALIDATION = 'validation',
  UNKNOWN = 'unknown',
}

export function categorizeError(error: Error): ErrorCategory {
  const message = error.message.toLowerCase();
  
  if (message.includes('network') || message.includes('fetch')) {
    return ErrorCategory.NETWORK;
  }
  
  if (message.includes('401') || message.includes('unauthorized')) {
    return ErrorCategory.AUTHENTICATION;
  }
  
  if (message.includes('403') || message.includes('forbidden')) {
    return ErrorCategory.PERMISSION;
  }
  
  if (message.includes('400') || message.includes('validation')) {
    return ErrorCategory.VALIDATION;
  }
  
  if (message.includes('chunk') || message.includes('module')) {
    return ErrorCategory.BUILD;
  }
  
  if (error.name === 'TypeError' || error.name === 'ReferenceError') {
    return ErrorCategory.RUNTIME;
  }
  
  return ErrorCategory.UNKNOWN;
}
```

## Logging Strategy

### Client-Side Logging

Structured logging enables effective debugging and troubleshooting in production.

#### Log Levels

| Level | Use Case | Examples |
|-------|----------|----------|
| **ERROR** | Application errors, failed operations | API errors, unhandled exceptions, critical failures |
| **WARN** | Potential issues, deprecated features | Slow API responses, deprecated API usage |
| **INFO** | Important state changes | User login, navigation, feature usage |
| **DEBUG** | Detailed debugging information | Component lifecycle, state changes, API calls |

#### Logger Implementation

Create `src/utils/logger.ts`:

```typescript
enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, any>;
  userId?: string;
  sessionId?: string;
}

class Logger {
  private sessionId: string;
  private userId?: string;
  private endpoint: string;
  private buffer: LogEntry[] = [];
  private flushInterval = 10000; // 10 seconds
  private maxBufferSize = 50;

  constructor() {
    this.sessionId = this.generateSessionId();
    this.endpoint = import.meta.env.VITE_LOG_ENDPOINT || '/api/v1/logs';
    this.startFlushTimer();
  }

  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  setUserId(userId: string) {
    this.userId = userId;
  }

  clearUserId() {
    this.userId = undefined;
  }

  error(message: string, context?: Record<string, any>) {
    this.log(LogLevel.ERROR, message, context);
    
    // Also send to Sentry for errors
    if (typeof Sentry !== 'undefined') {
      Sentry.captureMessage(message, {
        level: 'error',
        contexts: context ? { custom: context } : undefined,
      });
    }
  }

  warn(message: string, context?: Record<string, any>) {
    this.log(LogLevel.WARN, message, context);
  }

  info(message: string, context?: Record<string, any>) {
    this.log(LogLevel.INFO, message, context);
  }

  debug(message: string, context?: Record<string, any>) {
    // Only log debug in development
    if (import.meta.env.DEV) {
      this.log(LogLevel.DEBUG, message, context);
    }
  }

  private log(level: LogLevel, message: string, context?: Record<string, any>) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: this.sanitizeContext(context),
      userId: this.userId,
      sessionId: this.sessionId,
    };

    // Console output in development
    if (import.meta.env.DEV) {
      const consoleFn = console[level] || console.log;
      consoleFn(`[${level.toUpperCase()}]`, message, context || '');
    }

    // Add to buffer
    this.buffer.push(entry);

    // Flush if buffer is full or error level
    if (this.buffer.length >= this.maxBufferSize || level === LogLevel.ERROR) {
      this.flush();
    }
  }

  private sanitizeContext(context?: Record<string, any>): Record<string, any> | undefined {
    if (!context) return undefined;

    const sanitized = { ...context };
    const sensitiveKeys = ['password', 'token', 'secret', 'apiKey', 'authorization'];

    Object.keys(sanitized).forEach(key => {
      if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
        sanitized[key] = '[REDACTED]';
      }
    });

    return sanitized;
  }

  private async flush() {
    if (this.buffer.length === 0) return;

    const logsToSend = [...this.buffer];
    this.buffer = [];

    try {
      await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ logs: logsToSend }),
      });
    } catch (error) {
      // Silently fail - don't want logging to break the app
      console.error('Failed to send logs:', error);
    }
  }

  private startFlushTimer() {
    setInterval(() => {
      this.flush();
    }, this.flushInterval);
  }
}

export const logger = new Logger();
```

#### Usage Examples

```typescript
import { logger } from '@/utils/logger';

// Info logging
logger.info('User logged in successfully', { userId: user.id, role: user.role });

// Warning logging
logger.warn('API response slow', { endpoint: '/api/v1/courses', duration: 2500 });

// Error logging
logger.error('Failed to submit assignment', {
  assignmentId: 123,
  error: error.message,
  userId: user.id,
});

// Debug logging (only in development)
logger.debug('Component rendered', { component: 'CourseList', props });
```

### Log Aggregation

#### CloudWatch Logs Integration

For AWS deployments, send logs to CloudWatch:

```typescript
// src/services/monitoring/cloudwatch.ts
import { CloudWatchLogsClient, PutLogEventsCommand } from '@aws-sdk/client-cloudwatch-logs';

const client = new CloudWatchLogsClient({
  region: import.meta.env.VITE_AWS_REGION,
  credentials: {
    accessKeyId: import.meta.env.VITE_AWS_ACCESS_KEY_ID,
    secretAccessKey: import.meta.env.VITE_AWS_SECRET_ACCESS_KEY,
  },
});

export async function sendLogsToCloudWatch(logs: LogEntry[]) {
  const command = new PutLogEventsCommand({
    logGroupName: '/moodle/react-frontend',
    logStreamName: `${import.meta.env.MODE}-${Date.now()}`,
    logEvents: logs.map(log => ({
      message: JSON.stringify(log),
      timestamp: new Date(log.timestamp).getTime(),
    })),
  });

  await client.send(command);
}
```

#### ELK Stack Integration

For self-hosted deployments, send logs to Elasticsearch:

```typescript
// src/services/monitoring/elasticsearch.ts
export async function sendLogsToElasticsearch(logs: LogEntry[]) {
  const response = await fetch(`${import.meta.env.VITE_ELASTICSEARCH_URL}/_bulk`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Authorization': `Basic ${btoa(import.meta.env.VITE_ELASTICSEARCH_AUTH)}`,
    },
    body: logs.map(log => 
      `{"index":{"_index":"moodle-frontend-logs-${new Date().toISOString().split('T')[0]}"}}\n${JSON.stringify(log)}\n`
    ).join(''),
  });

  return response.ok;
}
```

## API Monitoring

### Response Time Tracking

Monitor API performance to ensure SLA compliance.

#### Axios Interceptor for Metrics

Create `src/services/api/metricsInterceptor.ts`:

```typescript
import { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import { logger } from '@/utils/logger';

interface RequestTiming {
  startTime: number;
  url: string;
  method: string;
}

const requestTimings = new Map<string, RequestTiming>();

export function setupMetricsInterceptor(axiosInstance: AxiosInstance) {
  // Request interceptor - record start time
  axiosInstance.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      const requestId = `${config.method}-${config.url}-${Date.now()}`;
      requestTimings.set(requestId, {
        startTime: performance.now(),
        url: config.url || '',
        method: config.method || 'GET',
      });
      
      config.headers['X-Request-ID'] = requestId;
      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );

  // Response interceptor - calculate duration
  axiosInstance.interceptors.response.use(
    (response: AxiosResponse) => {
      const requestId = response.config.headers['X-Request-ID'] as string;
      const timing = requestTimings.get(requestId);
      
      if (timing) {
        const duration = performance.now() - timing.startTime;
        
        // Log metrics
        trackApiMetric({
          endpoint: timing.url,
          method: timing.method,
          status: response.status,
          duration,
          success: true,
        });
        
        // Warn if response is slow
        if (duration > 1000) {
          logger.warn('Slow API response', {
            endpoint: timing.url,
            duration,
            status: response.status,
          });
        }
        
        requestTimings.delete(requestId);
      }
      
      return response;
    },
    (error) => {
      const requestId = error.config?.headers['X-Request-ID'] as string;
      const timing = requestTimings.get(requestId);
      
      if (timing) {
        const duration = performance.now() - timing.startTime;
        
        // Log error metrics
        trackApiMetric({
          endpoint: timing.url,
          method: timing.method,
          status: error.response?.status || 0,
          duration,
          success: false,
          errorMessage: error.message,
        });
        
        logger.error('API request failed', {
          endpoint: timing.url,
          status: error.response?.status,
          duration,
          error: error.message,
        });
        
        requestTimings.delete(requestId);
      }
      
      return Promise.reject(error);
    }
  );
}

interface ApiMetric {
  endpoint: string;
  method: string;
  status: number;
  duration: number;
  success: boolean;
  errorMessage?: string;
}

function trackApiMetric(metric: ApiMetric) {
  // Send to analytics
  if (window.gtag) {
    window.gtag('event', 'api_request', {
      event_category: 'API',
      event_label: `${metric.method} ${metric.endpoint}`,
      value: Math.round(metric.duration),
      custom_status: metric.status,
      custom_success: metric.success,
    });
  }
  
  // Send to custom metrics endpoint
  fetch('/api/v1/metrics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'api_request',
      timestamp: new Date().toISOString(),
      ...metric,
    }),
  }).catch(() => {
    // Silently fail
  });
}
```

Apply to axios client:

```typescript
// src/services/api/client.ts
import axios from 'axios';
import { setupMetricsInterceptor } from './metricsInterceptor';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 30000,
});

setupMetricsInterceptor(apiClient);

export default apiClient;
```

### Performance Targets

| Metric | Target | Monitoring |
|--------|--------|------------|
| **P50 Response Time** | <300ms | Alert if consistently above 300ms |
| **P95 Response Time** | <1s | Alert if above 1s for 5 minutes |
| **P99 Response Time** | <3s | Alert if above 3s |
| **Failed Request Rate** | <0.5% | Alert if above 0.5% for 5 minutes |
| **Timeout Rate** | <0.1% | Alert if above 0.1% |

### Status Code Distribution

Monitor the distribution of HTTP status codes to identify issues:

```typescript
// src/services/monitoring/statusCodeTracker.ts
class StatusCodeTracker {
  private counts: Map<number, number> = new Map();
  private reportInterval = 60000; // 1 minute

  constructor() {
    this.startReporting();
  }

  track(statusCode: number) {
    const count = this.counts.get(statusCode) || 0;
    this.counts.set(statusCode, count + 1);
  }

  private startReporting() {
    setInterval(() => {
      this.report();
      this.counts.clear();
    }, this.reportInterval);
  }

  private report() {
    if (this.counts.size === 0) return;

    const total = Array.from(this.counts.values()).reduce((sum, count) => sum + count, 0);
    const distribution: Record<string, number> = {};

    this.counts.forEach((count, statusCode) => {
      distribution[statusCode] = (count / total) * 100;
    });

    logger.info('API status code distribution', {
      total,
      distribution,
    });
  }
}

export const statusCodeTracker = new StatusCodeTracker();
```

## Uptime Monitoring

### Health Check Endpoint

The API should expose a health check endpoint that the React app can verify.

Backend implementation (`api/v1/health.php`):

```php
<?php
header('Content-Type: application/json');

$health = [
    'status' => 'healthy',
    'timestamp' => time(),
    'checks' => [
        'database' => check_database(),
        'cache' => check_cache(),
        'filesystem' => check_filesystem(),
    ]
];

echo json_encode($health);

function check_database() {
    global $DB;
    try {
        $DB->get_record_sql('SELECT 1');
        return ['status' => 'ok'];
    } catch (Exception $e) {
        return ['status' => 'error', 'message' => $e->getMessage()];
    }
}

function check_cache() {
    // Check Redis/Memcached if configured
    return ['status' => 'ok'];
}

function check_filesystem() {
    // Check moodledata directory is writable
    global $CFG;
    if (is_writable($CFG->dataroot)) {
        return ['status' => 'ok'];
    }
    return ['status' => 'error', 'message' => 'Data directory not writable'];
}
```

### Uptime Monitoring Services

#### Pingdom Configuration

1. Create new Uptime Check
2. URL: `https://moodle.example.com/api/v1/health`
3. Check interval: 1 minute
4. Alert after: 2 failed checks
5. Alert contacts: On-call rotation

#### UptimeRobot Configuration

```bash
# API to create monitor
curl -X POST https://api.uptimerobot.com/v2/newMonitor \
  -H "Content-Type: application/json" \
  -d '{
    "api_key": "YOUR_API_KEY",
    "friendly_name": "Moodle React Frontend",
    "url": "https://moodle.example.com/api/v1/health",
    "type": 1,
    "interval": 300,
    "timeout": 30,
    "alert_contacts": "0544483_0_0-2628365_0_0"
  }'
```

### SLA Target

**99.9% uptime** - Maximum allowed downtime:

- **Daily**: 1 minute 26 seconds
- **Weekly**: 10 minutes 4 seconds
- **Monthly**: 43 minutes 49 seconds
- **Yearly**: 8 hours 45 minutes 57 seconds

### Status Page

Provide a public status page for users to check system health.

Options:
- **Statuspage.io** (Atlassian)
- **Status.io**
- **Self-hosted**: Cachet (open-source)

Example Cachet configuration:

```yaml
# docker-compose.yml for Cachet
version: '3'
services:
  cachet:
    image: cachethq/docker:latest
    environment:
      - DB_DRIVER=mysql
      - DB_HOST=db
      - DB_DATABASE=cachet
      - DB_USERNAME=cachet
      - DB_PASSWORD=cachet_password
      - APP_KEY=base64:YOUR_APP_KEY
      - APP_URL=https://status.moodle.example.com
    ports:
      - "8000:8000"
    depends_on:
      - db
  
  db:
    image: mysql:5.7
    environment:
      - MYSQL_DATABASE=cachet
      - MYSQL_USER=cachet
      - MYSQL_PASSWORD=cachet_password
      - MYSQL_ROOT_PASSWORD=root_password
```

## User Analytics

### Google Analytics 4 Integration

#### Installation

```bash
npm install react-ga4
```

#### Configuration

Create `src/services/analytics/googleAnalytics.ts`:

```typescript
import ReactGA from 'react-ga4';

export function initGA() {
  const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID;
  
  if (!measurementId) {
    console.warn('Google Analytics measurement ID not configured');
    return;
  }

  ReactGA.initialize(measurementId, {
    gaOptions: {
      anonymizeIp: true,
      cookieFlags: 'SameSite=None;Secure',
    },
    gtagOptions: {
      send_page_view: false, // We'll send manually
    },
  });
}

export function trackPageView(path: string, title?: string) {
  ReactGA.send({
    hitType: 'pageview',
    page: path,
    title: title || document.title,
  });
}

export function trackEvent(category: string, action: string, label?: string, value?: number) {
  ReactGA.event({
    category,
    action,
    label,
    value,
  });
}

export function trackUserLogin(userId: string, method: string) {
  ReactGA.event({
    category: 'User',
    action: 'Login',
    label: method,
  });
  
  ReactGA.set({ userId });
}

export function trackCourseEnrollment(courseId: number, courseName: string) {
  ReactGA.event({
    category: 'Course',
    action: 'Enroll',
    label: courseName,
    value: courseId,
  });
}

export function trackAssignmentSubmission(assignmentId: number, duration: number) {
  ReactGA.event({
    category: 'Assignment',
    action: 'Submit',
    label: `Assignment ${assignmentId}`,
    value: duration,
  });
}

export function trackQuizCompletion(quizId: number, score: number) {
  ReactGA.event({
    category: 'Quiz',
    action: 'Complete',
    label: `Quiz ${quizId}`,
    value: score,
  });
}
```

#### Router Integration

Track page views automatically:

```typescript
// src/app/router.tsx
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { trackPageView } from '@/services/analytics/googleAnalytics';

function RouteTracker() {
  const location = useLocation();

  useEffect(() => {
    trackPageView(location.pathname + location.search);
  }, [location]);

  return null;
}

export function AppRouter() {
  return (
    <Router>
      <RouteTracker />
      {/* Your routes */}
    </Router>
  );
}
```

### User Flow Tracking

Track multi-step user journeys:

```typescript
// src/services/analytics/flowTracking.ts
export enum UserFlow {
  COURSE_ENROLLMENT = 'course_enrollment',
  ASSIGNMENT_SUBMISSION = 'assignment_submission',
  QUIZ_ATTEMPT = 'quiz_attempt',
  MESSAGE_SEND = 'message_send',
}

interface FlowStep {
  flow: UserFlow;
  step: number;
  stepName: string;
  timestamp: number;
}

class FlowTracker {
  private currentFlows = new Map<UserFlow, FlowStep[]>();

  startFlow(flow: UserFlow) {
    this.currentFlows.set(flow, []);
    this.trackStep(flow, 1, 'started');
  }

  trackStep(flow: UserFlow, step: number, stepName: string) {
    const steps = this.currentFlows.get(flow) || [];
    steps.push({
      flow,
      step,
      stepName,
      timestamp: Date.now(),
    });
    this.currentFlows.set(flow, steps);

    ReactGA.event({
      category: 'Flow',
      action: flow,
      label: `Step ${step}: ${stepName}`,
    });
  }

  completeFlow(flow: UserFlow, success: boolean) {
    const steps = this.currentFlows.get(flow) || [];
    const duration = steps.length > 0 
      ? Date.now() - steps[0].timestamp 
      : 0;

    ReactGA.event({
      category: 'Flow',
      action: `${flow}_${success ? 'completed' : 'abandoned'}`,
      value: duration,
    });

    this.currentFlows.delete(flow);
  }
}

export const flowTracker = new FlowTracker();
```

Usage example:

```typescript
// In EnrollButton component
import { flowTracker, UserFlow } from '@/services/analytics/flowTracking';

function handleEnroll() {
  flowTracker.startFlow(UserFlow.COURSE_ENROLLMENT);
  
  // Step 1: Click enroll button
  flowTracker.trackStep(UserFlow.COURSE_ENROLLMENT, 1, 'clicked_enroll');
  
  // Step 2: Confirm enrollment
  flowTracker.trackStep(UserFlow.COURSE_ENROLLMENT, 2, 'confirmed');
  
  // Step 3: API call
  enrollInCourse(courseId)
    .then(() => {
      flowTracker.trackStep(UserFlow.COURSE_ENROLLMENT, 3, 'api_success');
      flowTracker.completeFlow(UserFlow.COURSE_ENROLLMENT, true);
    })
    .catch(() => {
      flowTracker.completeFlow(UserFlow.COURSE_ENROLLMENT, false);
    });
}
```

### Privacy Considerations

#### GDPR Compliance

```typescript
// src/services/analytics/consent.ts
export class ConsentManager {
  private static CONSENT_KEY = 'analytics_consent';

  static hasConsent(): boolean {
    return localStorage.getItem(this.CONSENT_KEY) === 'true';
  }

  static grantConsent() {
    localStorage.setItem(this.CONSENT_KEY, 'true');
    initGA();
  }

  static revokeConsent() {
    localStorage.setItem(this.CONSENT_KEY, 'false');
    
    // Disable Google Analytics
    window[`ga-disable-${import.meta.env.VITE_GA_MEASUREMENT_ID}`] = true;
    
    // Clear analytics cookies
    document.cookie.split(";").forEach((c) => {
      document.cookie = c
        .replace(/^ +/, "")
        .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
    });
  }
}
```

Consent banner component:

```typescript
// src/components/ConsentBanner.tsx
import { useState, useEffect } from 'react';
import { ConsentManager } from '@/services/analytics/consent';

export function ConsentBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const hasConsent = ConsentManager.hasConsent();
    if (hasConsent === null) {
      setShow(true);
    } else if (hasConsent) {
      initGA();
    }
  }, []);

  const handleAccept = () => {
    ConsentManager.grantConsent();
    setShow(false);
  };

  const handleDecline = () => {
    ConsentManager.revokeConsent();
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="consent-banner">
      <p>
        We use cookies and analytics to improve your experience. 
        By clicking "Accept", you consent to our use of cookies.
      </p>
      <button onClick={handleAccept}>Accept</button>
      <button onClick={handleDecline}>Decline</button>
    </div>
  );
}
```

## Alerting Configuration

### Alert Channels

Configure multiple channels for alert delivery:

| Channel | Use Case | Response Time |
|---------|----------|---------------|
| **Email** | Non-critical alerts, daily summaries | Hours |
| **Slack** | Team notifications, warnings | Minutes |
| **PagerDuty** | Critical incidents, on-call | Immediate |
| **SMS** | Emergency escalation | Immediate |

### Alert Severity Levels

| Severity | Description | Response | Example |
|----------|-------------|----------|---------|
| **Info** | Informational, no action needed | None | Deployment completed |
| **Warning** | Potential issue, monitor | Review within hours | Error rate 1-5% |
| **Critical** | Immediate attention required | Respond within minutes | Error rate >5%, API P95 >3s |
| **Emergency** | System down, user impact | Immediate response | Site unavailable, database down |

### Alert Thresholds

#### Performance Alerts

```yaml
# alerts/performance.yml
performance_alerts:
  - name: Slow API Response Time
    condition: api_response_time_p95 > 1000ms for 5 minutes
    severity: warning
    channels: [slack]
    
  - name: Very Slow API Response Time
    condition: api_response_time_p95 > 3000ms for 2 minutes
    severity: critical
    channels: [pagerduty, slack]
    
  - name: High FCP
    condition: fcp_p75 > 2500ms for 10 minutes
    severity: warning
    channels: [slack]
    
  - name: Bundle Size Exceeded
    condition: main_bundle_size > 300KB
    severity: warning
    channels: [slack]
    on_deploy: true
```

#### Error Rate Alerts

```yaml
# alerts/errors.yml
error_alerts:
  - name: Elevated Error Rate
    condition: error_rate > 1% for 5 minutes
    severity: warning
    channels: [slack]
    
  - name: High Error Rate
    condition: error_rate > 5% for 2 minutes
    severity: critical
    channels: [pagerduty, slack, email]
    
  - name: JavaScript Error Spike
    condition: js_error_count > 100 per minute
    severity: critical
    channels: [pagerduty, slack]
    
  - name: API Error Rate High
    condition: api_error_rate > 5% for 3 minutes
    severity: critical
    channels: [pagerduty, slack]
```

#### Availability Alerts

```yaml
# alerts/availability.yml
availability_alerts:
  - name: Site Down
    condition: health_check_failed for 2 minutes
    severity: emergency
    channels: [pagerduty, sms, slack, email]
    
  - name: Database Connection Issues
    condition: database_connection_errors > 10 per minute
    severity: critical
    channels: [pagerduty, slack]
    
  - name: Uptime Below SLA
    condition: uptime < 99.9% over 30 days
    severity: warning
    channels: [email, slack]
```

### Slack Integration

Create `src/services/alerting/slack.ts`:

```typescript
interface SlackAlert {
  severity: 'info' | 'warning' | 'critical' | 'emergency';
  title: string;
  message: string;
  context?: Record<string, any>;
}

const SEVERITY_COLORS = {
  info: '#36a64f',
  warning: '#ff9800',
  critical: '#f44336',
  emergency: '#9c27b0',
};

const SEVERITY_EMOJIS = {
  info: ':information_source:',
  warning: ':warning:',
  critical: ':rotating_light:',
  emergency: ':fire:',
};

export async function sendSlackAlert(alert: SlackAlert) {
  const webhookUrl = import.meta.env.VITE_SLACK_WEBHOOK_URL;
  
  if (!webhookUrl) {
    console.warn('Slack webhook URL not configured');
    return;
  }

  const payload = {
    attachments: [
      {
        color: SEVERITY_COLORS[alert.severity],
        title: `${SEVERITY_EMOJIS[alert.severity]} ${alert.title}`,
        text: alert.message,
        fields: alert.context
          ? Object.entries(alert.context).map(([key, value]) => ({
              title: key,
              value: String(value),
              short: true,
            }))
          : [],
        footer: 'Moodle React Frontend',
        footer_icon: 'https://moodle.org/logo/moodle-logo.png',
        ts: Math.floor(Date.now() / 1000),
      },
    ],
  };

  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}
```

### PagerDuty Integration

Create `src/services/alerting/pagerduty.ts`:

```typescript
export async function triggerPagerDutyIncident(
  title: string,
  description: string,
  severity: 'info' | 'warning' | 'error' | 'critical'
) {
  const routingKey = import.meta.env.VITE_PAGERDUTY_ROUTING_KEY;
  
  if (!routingKey) {
    console.warn('PagerDuty routing key not configured');
    return;
  }

  const payload = {
    routing_key: routingKey,
    event_action: 'trigger',
    payload: {
      summary: title,
      severity,
      source: 'moodle-react-frontend',
      custom_details: {
        description,
        environment: import.meta.env.MODE,
        timestamp: new Date().toISOString(),
      },
    },
  };

  const response = await fetch('https://events.pagerduty.com/v2/enqueue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  return response.json();
}
```

### On-Call Rotation

Define on-call rotation in your alerting system:

```yaml
# oncall-rotation.yml
teams:
  - name: frontend-team
    schedule:
      timezone: UTC
      rotation_days: 7
      members:
        - name: Engineer 1
          email: engineer1@example.com
          phone: +1234567890
        - name: Engineer 2
          email: engineer2@example.com
          phone: +1234567891
        - name: Engineer 3
          email: engineer3@example.com
          phone: +1234567892

escalation_policy:
  - level: 1
    wait_minutes: 5
    notify: [on-call-primary]
  - level: 2
    wait_minutes: 10
    notify: [on-call-primary, on-call-secondary]
  - level: 3
    wait_minutes: 15
    notify: [on-call-primary, on-call-secondary, team-lead]
```

## Dashboard Setup

### Grafana Dashboard Configuration

Create a comprehensive monitoring dashboard:

```json
{
  "dashboard": {
    "title": "Moodle React Frontend Monitoring",
    "tags": ["moodle", "react", "frontend"],
    "timezone": "browser",
    "panels": [
      {
        "title": "Error Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(frontend_errors_total[5m])",
            "legendFormat": "Error Rate"
          }
        ],
        "alert": {
          "conditions": [
            {
              "evaluator": {
                "params": [0.01],
                "type": "gt"
              },
              "operator": {
                "type": "and"
              },
              "query": {
                "params": ["A", "5m", "now"]
              },
              "reducer": {
                "params": [],
                "type": "avg"
              },
              "type": "query"
            }
          ],
          "name": "High Error Rate"
        }
      },
      {
        "title": "API Response Time (P95)",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(api_request_duration_seconds_bucket[5m]))",
            "legendFormat": "P95"
          }
        ]
      },
      {
        "title": "Core Web Vitals",
        "type": "graph",
        "targets": [
          {
            "expr": "avg(lcp_seconds)",
            "legendFormat": "LCP"
          },
          {
            "expr": "avg(fid_milliseconds)",
            "legendFormat": "FID"
          },
          {
            "expr": "avg(cls_score)",
            "legendFormat": "CLS"
          }
        ]
      },
      {
        "title": "Active Users",
        "type": "stat",
        "targets": [
          {
            "expr": "count(active_sessions)"
          }
        ]
      }
    ]
  }
}
```

### Key Metrics Dashboard

Essential metrics to display on your dashboard:

1. **Performance**
   - Core Web Vitals (LCP, FID, CLS)
   - FCP and TTI
   - Bundle size
   - Page load time distribution

2. **Reliability**
   - Error rate (overall and by category)
   - Error count by type
   - Top 10 errors
   - Success rate

3. **API**
   - Request rate
   - Response time (P50, P95, P99)
   - Status code distribution
   - Failed request rate

4. **Users**
   - Active users
   - New sessions
   - Session duration
   - Bounce rate

5. **Business**
   - Course enrollments
   - Assignment submissions
   - Quiz completions
   - Messages sent

### Historical Trends

Track trends over time to identify patterns and regressions:

- Week-over-week comparisons
- Month-over-month trends
- Release impact analysis
- Seasonal patterns

## Integration Examples

### Complete Monitoring Setup

Integrate all monitoring services in `src/main.tsx`:

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Monitoring imports
import { initSentry } from './services/monitoring/sentry';
import { initDatadogRUM } from './services/monitoring/datadog';
import { initGA } from './services/analytics/googleAnalytics';
import { initWebVitals, measureFCP, measureTTI } from './utils/performance';
import { logger } from './utils/logger';

// Initialize monitoring in production
if (import.meta.env.PROD) {
  // Error tracking
  initSentry();
  
  // Real User Monitoring
  initDatadogRUM();
  
  // Analytics (with consent)
  if (ConsentManager.hasConsent()) {
    initGA();
  }
  
  // Performance monitoring
  initWebVitals();
  measureFCP();
  measureTTI();
  
  // Log startup
  logger.info('Application started', {
    version: import.meta.env.VITE_APP_VERSION,
    environment: import.meta.env.MODE,
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

### Environment Variables

Add to `.env.production`:

```env
# Sentry
VITE_SENTRY_DSN=https://abc123@o123456.ingest.sentry.io/123456
SENTRY_ORG=your-org
SENTRY_PROJECT=moodle-react-frontend
SENTRY_AUTH_TOKEN=your-auth-token

# DataDog
VITE_DATADOG_APPLICATION_ID=abc123
VITE_DATADOG_CLIENT_TOKEN=pub123

# Google Analytics
VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX

# Logging
VITE_LOG_ENDPOINT=/api/v1/logs

# Alerting
VITE_SLACK_WEBHOOK_URL=https://hooks.slack.com/services/XXX/YYY/ZZZ
VITE_PAGERDUTY_ROUTING_KEY=R123456789

# CloudWatch (if using AWS)
VITE_AWS_REGION=us-east-1
VITE_AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
VITE_AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY

# Elasticsearch (if self-hosted)
VITE_ELASTICSEARCH_URL=https://elasticsearch.example.com
VITE_ELASTICSEARCH_AUTH=username:password

# Application
VITE_APP_VERSION=1.0.0
VITE_API_BASE_URL=https://moodle.example.com/api/v1
```

### Prometheus Metrics Export

If using Prometheus, export custom metrics:

```typescript
// src/services/monitoring/prometheus.ts
class PrometheusMetrics {
  private metrics: Map<string, number> = new Map();

  increment(metric: string, value: number = 1) {
    const current = this.metrics.get(metric) || 0;
    this.metrics.set(metric, current + value);
  }

  set(metric: string, value: number) {
    this.metrics.set(metric, value);
  }

  getMetrics(): string {
    let output = '';
    
    this.metrics.forEach((value, key) => {
      output += `${key} ${value}\n`;
    });
    
    return output;
  }

  expose() {
    // Send metrics to backend endpoint
    fetch('/api/v1/metrics/prometheus', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: this.getMetrics(),
    });
  }
}

export const prometheus = new PrometheusMetrics();

// Export metrics every 10 seconds
setInterval(() => {
  prometheus.expose();
}, 10000);
```

### Backend Metrics Endpoint

Backend endpoint to collect and expose metrics for Prometheus:

```php
<?php
// api/v1/metrics/prometheus.php

header('Content-Type: text/plain');

// Collect metrics from request
$metrics = file_get_contents('php://input');

// Store in Redis for aggregation
$redis = new Redis();
$redis->connect('127.0.0.1', 6379);
$redis->lPush('frontend_metrics', $metrics);
$redis->expire('frontend_metrics', 60);

// Return current aggregated metrics
$allMetrics = $redis->lRange('frontend_metrics', 0, -1);
echo implode("\n", $allMetrics);
```

## Summary

This monitoring and alerting setup provides comprehensive visibility into:

- **Performance**: Core Web Vitals, custom metrics, Lighthouse scores
- **Reliability**: Error tracking, uptime monitoring, availability
- **API Health**: Response times, error rates, status codes
- **User Experience**: Analytics, user flows, session tracking
- **Operations**: Alerting, on-call rotation, incident response

### Quick Start Checklist

- [ ] Install monitoring dependencies (Sentry, DataDog, etc.)
- [ ] Configure environment variables
- [ ] Initialize monitoring services in `main.tsx`
- [ ] Set up Lighthouse CI in GitHub Actions
- [ ] Configure uptime monitoring (Pingdom/UptimeRobot)
- [ ] Create Grafana dashboards
- [ ] Set up alert channels (Slack, PagerDuty)
- [ ] Define on-call rotation
- [ ] Test alerting workflows
- [ ] Document incident response procedures

### Next Steps

1. Review and adjust alert thresholds based on baseline metrics
2. Set up automated incident response runbooks
3. Schedule regular monitoring review meetings
4. Implement synthetic monitoring for critical user journeys
5. Create custom dashboards for different stakeholder groups (engineering, product, executive)

For more information, see:
- [Performance Optimization Guide](../development/performance.md)
- [Error Handling Guide](../development/error-handling.md)
- [Deployment Guide](./deployment.md)
