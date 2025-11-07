# Deployment Troubleshooting Guide

This guide provides comprehensive solutions to common deployment issues, error messages, and diagnostic procedures for the Moodle React Frontend.

## Table of Contents

- [Troubleshooting Approach](#troubleshooting-approach)
- [Build Failures](#build-failures)
- [Runtime Errors](#runtime-errors)
- [API Connectivity Issues](#api-connectivity-issues)
- [Authentication Problems](#authentication-problems)
- [Performance Issues](#performance-issues)
- [Routing Issues](#routing-issues)
- [Environment Variable Problems](#environment-variable-problems)
- [Browser Compatibility](#browser-compatibility)
- [Web Server Configuration](#web-server-configuration)
- [Docker Issues](#docker-issues)
- [Diagnostic Commands](#diagnostic-commands)
- [Getting Help](#getting-help)

---

## Troubleshooting Approach

### Systematic Debugging Methodology

Follow this systematic approach to diagnose and resolve deployment issues:

1. **Identify the symptom**: What is the observable problem?
2. **Reproduce the issue**: Can you consistently trigger the problem?
3. **Check recent changes**: What was deployed or modified recently?
4. **Review logs**: Check browser console, server logs, and application logs
5. **Isolate the cause**: Use diagnostic tools to narrow down the problem
6. **Implement fix**: Apply the appropriate solution
7. **Verify resolution**: Confirm the issue is resolved
8. **Document**: Record the issue and solution for future reference

### Log Analysis Techniques

**Browser Console Logs:**
```javascript
// Check console for errors
console.log('Application version:', import.meta.env.VITE_APP_VERSION);
console.error('Error details:', error);
```

**Server-Side Logs:**
```bash
# Nginx error logs
tail -f /var/log/nginx/error.log

# Apache error logs
tail -f /var/log/apache2/error.log

# Application logs (if configured)
tail -f /var/www/moodle/react-frontend/logs/app.log
```

### Browser DevTools Usage

1. **Console Tab**: Check for JavaScript errors and warnings
2. **Network Tab**: Inspect HTTP requests, response codes, and timing
3. **Application Tab**: Verify localStorage, cookies, and service workers
4. **Performance Tab**: Profile page load and runtime performance
5. **React DevTools**: Inspect component hierarchy and state

### Network Inspection

Use the Network tab to diagnose connectivity issues:

- **Status codes**: 200 (OK), 401 (Unauthorized), 404 (Not Found), 500 (Server Error)
- **Response times**: Identify slow endpoints
- **Request headers**: Verify Authorization header with JWT token
- **Response headers**: Check Content-Type, CORS headers, Cache-Control
- **Payload**: Inspect request/response body for errors

---

## Build Failures

### Issue: TypeScript Compilation Errors

**Symptom:**
```bash
npm run build
# Error: TS2345: Argument of type 'string' is not assignable to parameter of type 'number'
```

**Diagnosis:**
- Check terminal output for specific TypeScript error messages
- Look for file paths and line numbers in error output
- Identify type mismatches or missing type definitions

**Solution:**
```bash
# 1. Fix type errors in the identified files
# Example: Ensure correct types are used
const userId: number = parseInt(userIdString);

# 2. Verify tsconfig.json is correct
cat tsconfig.json

# 3. Ensure all @types packages are installed
npm install --save-dev @types/react @types/react-dom @types/node

# 4. Clear TypeScript cache and rebuild
rm -rf node_modules/.cache
npm run build
```

**Prevention:**
- Enable TypeScript strict mode in development
- Use `npm run type-check` before building
- Set up pre-commit hooks to catch type errors early

---

### Issue: Out of Memory During Build

**Symptom:**
```bash
npm run build
# FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory
```

**Diagnosis:**
- Bundle size is too large
- Too many dependencies loaded simultaneously
- Insufficient memory allocation for Node.js

**Solution:**
```bash
# 1. Increase Node.js memory allocation
export NODE_OPTIONS="--max-old-space-size=4096"
npm run build

# 2. Optimize imports (use tree shaking)
# Bad: import * as _ from 'lodash';
# Good: import { debounce } from 'lodash-es';

# 3. Analyze bundle size
npm run build -- --analyze

# 4. Clear cache and rebuild
rm -rf node_modules dist
npm install
npm run build

# 5. For CI/CD, set memory in package.json scripts
"build": "NODE_OPTIONS=--max-old-space-size=4096 vite build"
```

**Prevention:**
- Keep bundle size under 300KB gzipped
- Use code splitting and lazy loading
- Regularly audit dependencies with `npm audit`

---

### Issue: Missing Dependencies

**Symptom:**
```bash
npm run build
# Error: Cannot find module '@mui/material' or its corresponding type declarations
```

**Diagnosis:**
- Dependencies not installed
- package.json out of sync with package-lock.json
- Node modules corrupted

**Solution:**
```bash
# 1. Install dependencies
npm install

# 2. If issue persists, check package.json for the missing package
cat package.json | grep "@mui/material"

# 3. Install specific package if missing
npm install @mui/material@^5.15.0

# 4. Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# 5. Verify installation
npm list @mui/material
```

**Prevention:**
- Commit package-lock.json to version control
- Use `npm ci` in CI/CD pipelines instead of `npm install`
- Regularly update dependencies with `npm update`

---

### Issue: Vite Plugin Errors

**Symptom:**
```bash
npm run build
# Error: Failed to load plugin 'react' declared in '.eslintrc.cjs'
```

**Diagnosis:**
- Outdated Vite plugins
- Configuration syntax errors in vite.config.ts
- Plugin version incompatibility

**Solution:**
```bash
# 1. Update Vite and plugins
npm update vite @vitejs/plugin-react

# 2. Verify vite.config.ts syntax
cat vite.config.ts

# 3. Check for plugin compatibility
npm list @vitejs/plugin-react

# 4. Correct vite.config.ts example
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // ... other config
});

# 5. Rebuild with clean cache
rm -rf node_modules/.vite
npm run build
```

---

## Runtime Errors

### Issue: White Screen (Blank Page)

**Symptom:**
- Browser displays blank white page
- React application doesn't render
- No visible content after page load

**Diagnosis:**
1. Open browser console (F12 or Ctrl+Shift+I)
2. Look for JavaScript errors in Console tab
3. Check Network tab for failed resource loads
4. Inspect Elements tab for HTML structure

**Common Causes & Solutions:**

**Cause 1: JavaScript errors preventing React mount**
```bash
# Console error: "Uncaught ReferenceError: React is not defined"
# Solution: Verify dist/assets/*.js files are loading correctly
# Check browser Network tab for 404 errors

# If assets not found, verify base path in vite.config.ts
export default defineConfig({
  base: '/react-frontend/', // Adjust to your deployment path
});
```

**Cause 2: index.html not correctly configured**
```bash
# Verify index.html has correct structure
cat dist/index.html

# Should contain:
# - <div id="root"></div>
# - <script type="module" src="/assets/index-*.js"></script>

# If missing, check public/index.html source file
```

**Cause 3: main.tsx initialization errors**
```typescript
// Check main.tsx for errors
// Verify correct React root creation
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

**Solution Steps:**
```bash
# 1. Check browser console for specific error
# 2. Verify all dist/assets files are accessible
curl -I https://yourdomain.com/react-frontend/assets/index-abc123.js

# 3. Clear browser cache (Ctrl+Shift+R or Cmd+Shift+R)
# 4. Verify MIME types are correct
# JavaScript files should be: Content-Type: application/javascript

# 5. Check web server configuration
# Nginx example:
location /react-frontend/assets/ {
    types {
        application/javascript js;
        text/css css;
    }
}
```

---

### Issue: React Component Errors

**Symptom:**
- Error boundaries are triggered
- Components fail to render
- "Something went wrong" error messages

**Diagnosis:**
```javascript
// Check browser console for component stack trace
// React DevTools shows component hierarchy

// Example error:
// Error: Cannot read property 'map' of undefined
// at CourseList.tsx:45
```

**Solution:**
```typescript
// 1. Add defensive checks for undefined data
const CourseList = ({ courses }) => {
  if (!courses || !Array.isArray(courses)) {
    return <div>No courses available</div>;
  }
  
  return (
    <div>
      {courses.map(course => (
        <CourseCard key={course.id} course={course} />
      ))}
    </div>
  );
};

// 2. Add error boundaries around feature components
import { ErrorBoundary } from 'react-error-boundary';

<ErrorBoundary
  FallbackComponent={ErrorFallback}
  onError={(error, errorInfo) => {
    console.error('Component error:', error, errorInfo);
  }}
>
  <CourseList courses={courses} />
</ErrorBoundary>

// 3. Check React version compatibility
npm list react react-dom

// 4. Update React if needed
npm install react@^18.2.0 react-dom@^18.2.0

// 5. Monitor errors with Sentry (if configured)
// Check Sentry dashboard for error details and stack traces
```

---

### Issue: Redux State Issues

**Symptom:**
- State not persisting across page refreshes
- Actions not dispatching correctly
- Components not re-rendering when state changes

**Diagnosis:**
```javascript
// Install Redux DevTools Extension
// Check state tree and dispatched actions

// Common issues:
// 1. Store not properly configured
// 2. Middleware blocking actions
// 3. Reducers not updating state correctly
```

**Solution:**
```typescript
// 1. Verify store configuration
// src/app/store.ts
import { configureStore } from '@reduxjs/toolkit';
import authReducer from '@/features/auth/store/authSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST'],
      },
    }),
});

// 2. Check Redux DevTools
// - Verify actions are dispatching (Actions tab)
// - Check state updates (State tab)
// - Review action diffs (Diff tab)

// 3. Verify reducer immutability
// Bad: state.user = newUser; (mutates state)
// Good: return { ...state, user: newUser };

// 4. Test action dispatching
import { useDispatch } from 'react-redux';
import { login } from '@/features/auth/store/authSlice';

const dispatch = useDispatch();
dispatch(login({ username, password }));

// 5. Check for middleware errors
// Review console for middleware warnings
```

---

## API Connectivity Issues

### Issue: CORS Errors

**Symptom:**
```
Access to fetch at 'https://moodle.example.com/api/v1/courses' from origin 
'https://react.example.com' has been blocked by CORS policy: No 
'Access-Control-Allow-Origin' header is present on the requested resource.
```

**Diagnosis:**
1. Open browser Network tab
2. Look for OPTIONS preflight request
3. Check response headers for Access-Control-Allow-Origin
4. Verify request has Authorization header

**Solution:**

**Backend (config.php):**
```php
// Add CORS headers in config.php
$CFG->api_cors_origins = [
    'https://react.example.com',
    'https://www.example.com',
];

$CFG->api_cors_credentials = true;
$CFG->api_cors_methods = 'GET, POST, PUT, DELETE, OPTIONS';
$CFG->api_cors_headers = 'Authorization, Content-Type, Accept';
```

**API Middleware (api/lib/api_base.php):**
```php
public function handle_cors() {
    global $CFG;
    
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if (in_array($origin, $CFG->api_cors_origins)) {
        header("Access-Control-Allow-Origin: $origin");
        header("Access-Control-Allow-Credentials: true");
        header("Access-Control-Allow-Methods: {$CFG->api_cors_methods}");
        header("Access-Control-Allow-Headers: {$CFG->api_cors_headers}");
    }
    
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}
```

**Nginx Proxy (if applicable):**
```nginx
location /api/ {
    # Add CORS headers
    add_header 'Access-Control-Allow-Origin' '$http_origin' always;
    add_header 'Access-Control-Allow-Credentials' 'true' always;
    add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS' always;
    add_header 'Access-Control-Allow-Headers' 'Authorization,Content-Type,Accept' always;
    
    # Handle OPTIONS preflight
    if ($request_method = 'OPTIONS') {
        return 204;
    }
    
    proxy_pass http://moodle_backend;
}
```

**Verification:**
```bash
# Test CORS with curl
curl -H "Origin: https://react.example.com" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: Authorization, Content-Type" \
     -X OPTIONS \
     https://moodle.example.com/api/v1/courses \
     -v

# Should return:
# Access-Control-Allow-Origin: https://react.example.com
# Access-Control-Allow-Credentials: true
```

---

### Issue: 401 Unauthorized

**Symptom:**
- API requests fail with 401 status code
- User logged out unexpectedly
- "Unauthorized" error messages

**Diagnosis:**
```javascript
// 1. Check browser Network tab
// Look for failed API requests with 401 status

// 2. Inspect request headers
// Verify Authorization header is present
// Example: Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

// 3. Check JWT token in Application tab
localStorage.getItem('accessToken');
document.cookie; // Check for httpOnly cookies

// 4. Decode JWT token to check expiration
import jwt_decode from 'jwt-decode';
const decoded = jwt_decode(token);
console.log('Token expires:', new Date(decoded.exp * 1000));
```

**Solutions:**

**Solution 1: Token Expired**
```typescript
// Implement token refresh logic
// src/services/api/interceptors.ts
import axios from 'axios';
import { refreshAccessToken } from '@/services/auth/authService';

axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        const newToken = await refreshAccessToken();
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return axios(originalRequest);
      } catch (refreshError) {
        // Refresh failed, logout user
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);
```

**Solution 2: Token Not Being Sent**
```typescript
// Verify Axios configuration includes credentials
// src/services/api/client.ts
import axios from 'axios';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  withCredentials: true, // Important for httpOnly cookies
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to every request
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

**Solution 3: Backend Not Validating Token Correctly**
```php
// api/lib/auth_jwt.php
use Firebase\JWT\JWT;
use Firebase\JWT\Key;

public static function validate_token() {
    global $CFG;
    
    $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (!preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
        throw new api_exception('Missing or invalid Authorization header', 401);
    }
    
    $token = $matches[1];
    
    try {
        $decoded = JWT::decode($token, new Key($CFG->jwt_secret, 'HS256'));
        return $decoded;
    } catch (\Exception $e) {
        throw new api_exception('Invalid or expired token: ' . $e->getMessage(), 401);
    }
}
```

**Verification:**
```bash
# Test API with valid token
TOKEN="your-jwt-token-here"
curl -H "Authorization: Bearer $TOKEN" \
     https://moodle.example.com/api/v1/auth/me \
     -v

# Should return 200 with user data
```

---

### Issue: 404 Not Found for API Endpoints

**Symptom:**
- API requests return 404 status
- "Endpoint not found" errors
- Routes not matching expected patterns

**Diagnosis:**
```javascript
// 1. Check actual request URL in Network tab
// Example: https://moodle.example.com/api/v1/courses/123

// 2. Verify base URL configuration
console.log('API Base URL:', import.meta.env.VITE_API_BASE_URL);

// 3. Check if API endpoints exist on server
// SSH into server and verify files
ls -la /var/www/moodle/api/v1/courses/
```

**Solutions:**

**Solution 1: Incorrect API Base URL**
```bash
# Check .env file
cat .env.production

# Should contain:
VITE_API_BASE_URL=https://moodle.example.com/api/v1

# If incorrect, update and rebuild
echo "VITE_API_BASE_URL=https://moodle.example.com/api/v1" > .env.production
npm run build
```

**Solution 2: Web Server Routing Not Configured**

**Nginx Configuration:**
```nginx
# /etc/nginx/sites-available/moodle
server {
    listen 80;
    server_name moodle.example.com;
    
    root /var/www/moodle/public;
    
    # API routing
    location ~ ^/api/v1/(.*)$ {
        try_files /api/v1/$1.php /api/index.php?_route=$1;
        
        fastcgi_pass unix:/var/run/php/php8.2-fpm.sock;
        fastcgi_index index.php;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        include fastcgi_params;
    }
    
    # React frontend
    location /react-frontend {
        alias /var/www/moodle/react-frontend/dist;
        try_files $uri $uri/ /react-frontend/index.html;
    }
}

# Test and reload nginx
sudo nginx -t
sudo systemctl reload nginx
```

**Apache Configuration:**
```apache
# /etc/apache2/sites-available/moodle.conf
<VirtualHost *:80>
    ServerName moodle.example.com
    DocumentRoot /var/www/moodle/public
    
    # API routing
    <Directory /var/www/moodle/api>
        RewriteEngine On
        RewriteCond %{REQUEST_FILENAME} !-f
        RewriteCond %{REQUEST_FILENAME} !-d
        RewriteRule ^v1/(.*)$ /api/v1/$1.php [L,QSA]
    </Directory>
    
    # React frontend
    Alias /react-frontend /var/www/moodle/react-frontend/dist
    <Directory /var/www/moodle/react-frontend/dist>
        RewriteEngine On
        RewriteCond %{REQUEST_FILENAME} !-f
        RewriteCond %{REQUEST_FILENAME} !-d
        RewriteRule . /react-frontend/index.html [L]
    </Directory>
</VirtualHost>

# Test and reload Apache
sudo apachectl configtest
sudo systemctl reload apache2
```

**Solution 3: API Files Missing**
```bash
# Verify API endpoint files exist
ls -la /var/www/moodle/api/v1/courses/show.php

# If missing, deploy API files
# From your deployment script or manually copy files
rsync -avz api/ user@server:/var/www/moodle/api/
```

---

### Issue: Network Timeout

**Symptom:**
- Requests hang indefinitely
- "Network Error" or "Timeout" messages
- Slow API responses

**Diagnosis:**
```javascript
// 1. Check Network tab for request timing
// Look for "Stalled" or "Waiting (TTFB)" times

// 2. Test API directly with curl
curl -w "@curl-format.txt" -o /dev/null -s https://moodle.example.com/api/v1/courses

// curl-format.txt:
// time_namelookup:  %{time_namelookup}\n
// time_connect:  %{time_connect}\n
// time_appconnect:  %{time_appconnect}\n
// time_pretransfer:  %{time_pretransfer}\n
// time_redirect:  %{time_redirect}\n
// time_starttransfer:  %{time_starttransfer}\n
// time_total:  %{time_total}\n
```

**Solutions:**

**Solution 1: Increase Client Timeout**
```typescript
// src/services/api/client.ts
import axios from 'axios';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 30000, // 30 seconds (default is often 5-10s)
});
```

**Solution 2: Check Backend Server Status**
```bash
# Check if PHP-FPM is running
sudo systemctl status php8.2-fpm

# Check PHP-FPM pool status
sudo cat /var/run/php/php8.2-fpm.sock

# Check for resource exhaustion
top -b -n 1 | head -20
free -h

# Restart PHP-FPM if needed
sudo systemctl restart php8.2-fpm
```

**Solution 3: Verify Firewall Rules**
```bash
# Check if port 80/443 is open
sudo iptables -L -n | grep -E '80|443'

# Check if firewall is blocking connections
sudo ufw status

# Allow HTTP/HTTPS if needed
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

**Solution 4: Optimize Slow API Endpoints**
```php
// Add query optimization
// Check slow query log
mysql -u root -p -e "SHOW VARIABLES LIKE 'slow_query%';"

// Enable slow query log
mysql -u root -p -e "SET GLOBAL slow_query_log = 'ON';"
mysql -u root -p -e "SET GLOBAL long_query_time = 2;"

// Review slow queries
tail -f /var/log/mysql/mysql-slow.log
```

---

## Authentication Problems

### Issue: JWT Token Not Stored

**Symptom:**
- User logged out immediately after login
- Token not found in localStorage or cookies
- Login seems successful but user not authenticated

**Diagnosis:**
```javascript
// 1. Check localStorage after login
localStorage.getItem('accessToken');
localStorage.getItem('refreshToken');

// 2. Check cookies
document.cookie.split(';').forEach(c => console.log(c));

// 3. Check Network tab for login response
// Verify response includes tokens
```

**Solutions:**

**Solution 1: CORS Blocking Credentials**
```typescript
// Ensure credentials are included in requests
// src/services/api/client.ts
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  withCredentials: true, // Required for cookies
});

// Backend must also allow credentials
// api/lib/api_base.php
header('Access-Control-Allow-Credentials: true');
```

**Solution 2: httpOnly Cookie Issue**
```php
// If using httpOnly cookies, backend must set them correctly
// api/v1/auth/login.php
$cookieOptions = [
    'expires' => time() + (7 * 24 * 60 * 60), // 7 days
    'path' => '/',
    'domain' => '.example.com', // Must include subdomain prefix
    'secure' => true, // HTTPS only
    'httponly' => true, // Prevent JavaScript access
    'samesite' => 'Lax', // or 'Strict'
];

setcookie('refreshToken', $refreshToken, $cookieOptions);

// Note: Frontend cannot access httpOnly cookies via JavaScript
// This is by design for security
```

**Solution 3: localStorage Not Persisting**
```typescript
// Check if browser allows localStorage
try {
    localStorage.setItem('test', 'test');
    localStorage.removeItem('test');
} catch (e) {
    console.error('localStorage not available:', e);
    // Fall back to in-memory storage or cookies
}

// Implement proper token storage
// src/services/auth/authService.ts
export const storeTokens = (accessToken: string, refreshToken: string) => {
    try {
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', refreshToken);
        return true;
    } catch (error) {
        console.error('Failed to store tokens:', error);
        return false;
    }
};
```

---

### Issue: Token Expired Loop

**Symptom:**
- Constant re-login prompts
- User repeatedly redirected to login page
- "Session expired" messages appearing frequently

**Diagnosis:**
```typescript
// Check token expiration times
import jwt_decode from 'jwt-decode';

const token = localStorage.getItem('accessToken');
if (token) {
    const decoded = jwt_decode(token);
    console.log('Token issued:', new Date(decoded.iat * 1000));
    console.log('Token expires:', new Date(decoded.exp * 1000));
    console.log('Current time:', new Date());
}
```

**Solutions:**

**Solution 1: Implement Token Refresh**
```typescript
// src/services/auth/authService.ts
export const refreshAccessToken = async (): Promise<string> => {
    const refreshToken = localStorage.getItem('refreshToken');
    
    if (!refreshToken) {
        throw new Error('No refresh token available');
    }
    
    try {
        const response = await axios.post(
            `${import.meta.env.VITE_API_BASE_URL}/auth/refresh`,
            { refreshToken }
        );
        
        const { accessToken, refreshToken: newRefreshToken } = response.data.data;
        
        localStorage.setItem('accessToken', accessToken);
        if (newRefreshToken) {
            localStorage.setItem('refreshToken', newRefreshToken);
        }
        
        return accessToken;
    } catch (error) {
        // Refresh failed, clear tokens and redirect to login
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
        throw error;
    }
};

// Implement in axios interceptor
// src/services/api/interceptors.ts
let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
    failedQueue.forEach(prom => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token);
        }
    });
    
    failedQueue = [];
};

apiClient.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;
        
        if (error.response?.status === 401 && !originalRequest._retry) {
            if (isRefreshing) {
                // Queue requests while refreshing
                return new Promise((resolve, reject) => {
                    failedQueue.push({ resolve, reject });
                }).then(token => {
                    originalRequest.headers.Authorization = `Bearer ${token}`;
                    return apiClient(originalRequest);
                });
            }
            
            originalRequest._retry = true;
            isRefreshing = true;
            
            try {
                const newToken = await refreshAccessToken();
                processQueue(null, newToken);
                originalRequest.headers.Authorization = `Bearer ${newToken}`;
                return apiClient(originalRequest);
            } catch (refreshError) {
                processQueue(refreshError, null);
                return Promise.reject(refreshError);
            } finally {
                isRefreshing = false;
            }
        }
        
        return Promise.reject(error);
    }
);
```

**Solution 2: Adjust Token Expiration Times**
```php
// api/lib/auth_jwt.php
// Increase token expiration if too short
$payload = [
    'iss' => $CFG->wwwroot,
    'iat' => time(),
    'exp' => time() + (60 * 60), // 1 hour for access token
    'sub' => $userid,
    'roles' => $roles,
];

$refreshPayload = [
    'iss' => $CFG->wwwroot,
    'iat' => time(),
    'exp' => time() + (7 * 24 * 60 * 60), // 7 days for refresh token
    'sub' => $userid,
    'type' => 'refresh',
];
```

---

### Issue: Permission Denied Errors

**Symptom:**
- User can't access certain features
- "Permission denied" or "Access forbidden" messages
- 403 Forbidden status codes

**Diagnosis:**
```typescript
// 1. Check user roles in JWT token
import jwt_decode from 'jwt-decode';

const token = localStorage.getItem('accessToken');
const decoded = jwt_decode(token);
console.log('User roles:', decoded.roles);
console.log('User capabilities:', decoded.capabilities);

// 2. Check API response for permission details
// Should include required capability in error message
```

**Solutions:**

**Solution 1: Verify User Roles on Backend**
```php
// api/v1/courses/update.php
require_once(__DIR__ . '/../../config.php');
require_capability('moodle/course:update', $coursecontext);

// Check if user has required capability
$context = context_course::instance($courseid);
if (!has_capability('moodle/course:update', $context)) {
    throw new api_exception('Permission denied: moodle/course:update required', 403);
}
```

**Solution 2: Update User Permissions in Moodle**
```bash
# Via Moodle admin interface:
# Navigate to: Site administration > Users > Permissions > Define roles
# Assign appropriate capabilities to the user's role

# Or via CLI:
php admin/cli/reset_roles.php
```

**Solution 3: Include Capabilities in JWT Token**
```php
// api/lib/auth_jwt.php
public static function generate_token($userid) {
    global $CFG;
    
    $user = core_user::get_user($userid);
    $roles = get_user_roles_in_course($userid);
    
    // Include capabilities for frontend authorization checks
    $capabilities = [];
    foreach ($roles as $role) {
        $roleCapabilities = get_role_capabilities($role->id);
        $capabilities = array_merge($capabilities, $roleCapabilities);
    }
    
    $payload = [
        'iss' => $CFG->wwwroot,
        'iat' => time(),
        'exp' => time() + 3600,
        'sub' => $userid,
        'username' => $user->username,
        'email' => $user->email,
        'roles' => array_values($roles),
        'capabilities' => array_unique($capabilities),
    ];
    
    return JWT::encode($payload, $CFG->jwt_secret, 'HS256');
}
```

---

## Performance Issues

### Issue: Slow Initial Load

**Symptom:**
- First Contentful Paint (FCP) >3 seconds
- Slow page load times
- Large bundle sizes

**Diagnosis:**
```bash
# 1. Run Lighthouse audit
npx lighthouse https://yourdomain.com/react-frontend --view

# 2. Check bundle size
npm run build
ls -lh dist/assets/*.js

# 3. Analyze bundle composition
npm run build -- --analyze
# or
npx vite-bundle-analyzer dist/stats.json

# 4. Check Network waterfall in DevTools
# Look for large files or slow downloads
```

**Solutions:**

**Solution 1: Reduce Bundle Size**
```typescript
// vite.config.ts - Enable tree shaking and minification
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2015',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // Remove console.log in production
        drop_debugger: true,
      },
    },
    rollupOptions: {
      output: {
        manualChunks: {
          // Split vendor chunks
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'mui-vendor': ['@mui/material', '@mui/icons-material'],
          'state-vendor': ['@reduxjs/toolkit', 'react-redux', '@tanstack/react-query'],
        },
      },
    },
  },
});
```

**Solution 2: Implement Code Splitting**
```typescript
// src/app/router.tsx - Lazy load route components
import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LoadingSpinner from '@/components/feedback/LoadingSpinner';

// Lazy load pages
const Dashboard = lazy(() => import('@/features/dashboard/pages/DashboardPage'));
const CourseCatalog = lazy(() => import('@/features/courses/pages/CourseCatalogPage'));
const CourseDetail = lazy(() => import('@/features/courses/pages/CourseDetailPage'));

export const Router = () => (
  <BrowserRouter>
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/courses" element={<CourseCatalog />} />
        <Route path="/courses/:id" element={<CourseDetail />} />
      </Routes>
    </Suspense>
  </BrowserRouter>
);
```

**Solution 3: Optimize Images**
```bash
# Convert images to WebP format
for img in src/assets/images/*.png; do
    cwebp -q 80 "$img" -o "${img%.png}.webp"
done

# Use responsive images in components
<picture>
  <source srcSet="/assets/course-banner.webp" type="image/webp" />
  <img src="/assets/course-banner.jpg" alt="Course banner" loading="lazy" />
</picture>
```

**Solution 4: Enable Caching**
```nginx
# nginx.conf - Cache static assets
location /react-frontend/assets/ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}

location /react-frontend/index.html {
    expires -1;
    add_header Cache-Control "no-cache, no-store, must-revalidate";
}
```

---

### Issue: Slow Navigation

**Symptom:**
- Route changes take >1 second
- UI feels sluggish during navigation
- Components re-render unnecessarily

**Diagnosis:**
```javascript
// 1. Use React DevTools Profiler
// Record interaction and analyze render times

// 2. Check for unnecessary re-renders
import { useEffect } from 'react';

useEffect(() => {
    console.log('Component rendered');
});

// 3. Measure navigation timing
performance.mark('navigation-start');
// ... navigation happens
performance.mark('navigation-end');
performance.measure('navigation', 'navigation-start', 'navigation-end');
const measure = performance.getEntriesByName('navigation')[0];
console.log('Navigation took:', measure.duration, 'ms');
```

**Solutions:**

**Solution 1: Implement React.memo**
```typescript
// Memoize expensive components
import { memo } from 'react';

const CourseCard = memo(({ course }) => {
    return (
        <Card>
            <CardContent>
                <Typography>{course.name}</Typography>
            </CardContent>
        </Card>
    );
}, (prevProps, nextProps) => {
    // Custom comparison function
    return prevProps.course.id === nextProps.course.id;
});

export default CourseCard;
```

**Solution 2: Optimize Redux Selectors**
```typescript
// Use reselect for memoized selectors
import { createSelector } from '@reduxjs/toolkit';

export const selectCourses = (state) => state.courses.items;

export const selectEnrolledCourses = createSelector(
    [selectCourses],
    (courses) => courses.filter(course => course.enrolled)
);
```

**Solution 3: Reduce API Response Times**
```php
// Add database indexes for common queries
// migrations/add_course_indexes.php
$DB->execute("
    ALTER TABLE {course} 
    ADD INDEX idx_visible_category (visible, category);
");

// Optimize N+1 queries
// api/v1/courses/index.php
$courses = $DB->get_records_sql("
    SELECT c.*, 
           COUNT(e.id) as enrollment_count
    FROM {course} c
    LEFT JOIN {enrol} e ON e.courseid = c.id AND e.status = 0
    WHERE c.visible = 1
    GROUP BY c.id
    ORDER BY c.fullname
    LIMIT ? OFFSET ?
", [$limit, $offset]);
```

---

### Issue: High Memory Usage

**Symptom:**
- Browser becomes slow or unresponsive
- "Out of memory" errors in console
- Memory usage increases over time (memory leak)

**Diagnosis:**
```javascript
// 1. Use Chrome DevTools Memory Profiler
// Take heap snapshots and compare
// Look for detached DOM nodes and growing objects

// 2. Check for memory leaks
// Record allocation timeline
// Identify objects that aren't being garbage collected

// 3. Monitor memory usage
console.log('Memory usage:', performance.memory.usedJSHeapSize / 1048576, 'MB');
```

**Solutions:**

**Solution 1: Cleanup useEffect Hooks**
```typescript
// Always cleanup event listeners and subscriptions
import { useEffect } from 'react';

const MyComponent = () => {
    useEffect(() => {
        const handleScroll = () => {
            console.log('Scrolled');
        };
        
        window.addEventListener('scroll', handleScroll);
        
        // Cleanup function
        return () => {
            window.removeEventListener('scroll', handleScroll);
        };
    }, []);
    
    return <div>Content</div>;
};
```

**Solution 2: Cancel Pending Requests on Unmount**
```typescript
// Cancel axios requests when component unmounts
import { useEffect } from 'react';
import axios from 'axios';

const MyComponent = () => {
    useEffect(() => {
        const source = axios.CancelToken.source();
        
        const fetchData = async () => {
            try {
                const response = await axios.get('/api/data', {
                    cancelToken: source.token,
                });
                // Handle response
            } catch (error) {
                if (axios.isCancel(error)) {
                    console.log('Request canceled');
                }
            }
        };
        
        fetchData();
        
        return () => {
            source.cancel('Component unmounted');
        };
    }, []);
    
    return <div>Content</div>;
};
```

**Solution 3: Use Virtual Scrolling for Long Lists**
```typescript
// Install react-window
// npm install react-window

import { FixedSizeList } from 'react-window';

const CourseList = ({ courses }) => {
    const Row = ({ index, style }) => (
        <div style={style}>
            <CourseCard course={courses[index]} />
        </div>
    );
    
    return (
        <FixedSizeList
            height={600}
            itemCount={courses.length}
            itemSize={100}
            width="100%"
        >
            {Row}
        </FixedSizeList>
    );
};
```

---

## Routing Issues

### Issue: 404 on Page Refresh

**Symptom:**
- Direct URL access returns 404
- Refreshing any route except home shows "Not Found"
- Works fine when navigating via app

**Diagnosis:**
```bash
# This is a server-side routing issue
# SPA expects all routes to serve index.html

# Test direct access
curl -I https://yourdomain.com/react-frontend/courses/123

# If 404, server is not configured for SPA routing
```

**Solutions:**

**Nginx Configuration:**
```nginx
# /etc/nginx/sites-available/moodle
server {
    listen 80;
    server_name yourdomain.com;
    
    root /var/www/moodle;
    index index.html;
    
    # React Frontend - SPA routing
    location /react-frontend {
        alias /var/www/moodle/react-frontend/dist;
        try_files $uri $uri/ /react-frontend/index.html;
        
        # Cache static assets
        location ~ \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
    
    # Don't cache index.html
    location = /react-frontend/index.html {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }
}

# Test and reload
sudo nginx -t
sudo systemctl reload nginx
```

**Apache Configuration:**
```apache
# /etc/apache2/sites-available/moodle.conf
<VirtualHost *:80>
    ServerName yourdomain.com
    DocumentRoot /var/www/moodle
    
    # React Frontend - SPA routing
    Alias /react-frontend /var/www/moodle/react-frontend/dist
    <Directory /var/www/moodle/react-frontend/dist>
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted
        
        # Enable rewrite
        RewriteEngine On
        RewriteBase /react-frontend/
        
        # Don't rewrite files or directories
        RewriteCond %{REQUEST_FILENAME} !-f
        RewriteCond %{REQUEST_FILENAME} !-d
        
        # Rewrite everything else to index.html
        RewriteRule . /react-frontend/index.html [L]
    </Directory>
    
    # Cache static assets
    <FilesMatch "\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$">
        Header set Cache-Control "max-age=31536000, public, immutable"
    </FilesMatch>
    
    # Don't cache index.html
    <Files "index.html">
        Header set Cache-Control "no-cache, no-store, must-revalidate"
    </Files>
</VirtualHost>

# Enable required modules
sudo a2enmod rewrite headers
sudo apachectl configtest
sudo systemctl reload apache2
```

**Alternative: .htaccess in dist directory:**
```apache
# react-frontend/dist/.htaccess
<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteBase /react-frontend/
    RewriteRule ^index\.html$ - [L]
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteRule . /react-frontend/index.html [L]
</IfModule>
```

---

### Issue: Base Path Incorrect

**Symptom:**
- Assets return 404 errors
- Wrong URLs for CSS/JS files
- Images and fonts not loading

**Diagnosis:**
```bash
# Check actual asset URLs in browser Network tab
# Example issue: Looking for /assets/index.js instead of /react-frontend/assets/index.js

# View built HTML
cat dist/index.html | grep "src="
```

**Solution:**
```typescript
// vite.config.ts - Set correct base path
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/react-frontend/', // Must match deployment path
  plugins: [react()],
  // ... other config
});

// Rebuild after changing base
npm run build

// Verify assets have correct path in dist/index.html
cat dist/index.html
// Should show: <script type="module" src="/react-frontend/assets/index-abc123.js">
```

**For Different Environments:**
```typescript
// vite.config.ts - Dynamic base path
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? '/react-frontend/' : '/',
  // ... other config
}));
```

---

## Environment Variable Problems

### Issue: Environment Variables Undefined

**Symptom:**
```javascript
console.log(import.meta.env.VITE_API_BASE_URL); // undefined
```

**Diagnosis:**
```bash
# 1. Check if .env file exists
ls -la .env*

# 2. Verify variable has VITE_ prefix
cat .env.production

# 3. Check if file was loaded during build
npm run build -- --mode production
```

**Solutions:**

**Solution 1: Add VITE_ Prefix**
```bash
# Incorrect (won't be exposed to client)
API_BASE_URL=https://api.example.com

# Correct (will be exposed to client)
VITE_API_BASE_URL=https://api.example.com
```

**Solution 2: Verify File Location**
```bash
# .env files should be in project root
/react-frontend/.env.production
/react-frontend/.env.development

# NOT in subdirectories
/react-frontend/src/.env.production  # Wrong location
```

**Solution 3: Rebuild Application**
```bash
# Environment variables are embedded at build time
# Must rebuild after changing .env files
npm run build

# For development, restart dev server
npm run dev
```

**Solution 4: Check TypeScript Types**
```typescript
// src/vite-env.d.ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_APP_NAME: string;
  // Add other env variables here
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

---

### Issue: Wrong Environment Loaded

**Symptom:**
- Production build uses development API
- Environment variables don't match expected environment
- Wrong configuration loaded

**Diagnosis:**
```bash
# Check which .env file is being used
npm run build -- --mode production

# Verify .env.production exists
ls -la .env.production

# Check built files contain correct values
cat dist/assets/index-*.js | grep -o "https://[^\"]*"
```

**Solutions:**

**Solution 1: Specify Mode in Build Script**
```json
// package.json
{
  "scripts": {
    "dev": "vite --mode development",
    "build": "vite build --mode production",
    "build:staging": "vite build --mode staging"
  }
}
```

**Solution 2: Create Environment-Specific Files**
```bash
# Development
.env.development
VITE_API_BASE_URL=http://localhost:3000/api/v1

# Staging
.env.staging
VITE_API_BASE_URL=https://staging.example.com/api/v1

# Production
.env.production
VITE_API_BASE_URL=https://moodle.example.com/api/v1
```

**Solution 3: Verify Environment in Code**
```typescript
// src/config/env.ts
export const config = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL,
  environment: import.meta.env.MODE,
  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD,
};

// Log environment on app start
console.log('Environment:', config.environment);
console.log('API Base URL:', config.apiBaseUrl);
```

---

## Browser Compatibility

### Issue: App Doesn't Work in Older Browsers

**Symptom:**
- Blank page in IE11, older Safari, or older Chrome
- "Syntax error" in console
- Missing JavaScript features

**Diagnosis:**
```bash
# Check browser version
# In browser console:
navigator.userAgent

# Check build target
cat vite.config.ts | grep target
```

**Solutions:**

**Solution 1: Configure Build Target**
```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2015', // Support older browsers
    // or for even older browsers:
    // target: ['es2015', 'safari11'],
  },
});
```

**Solution 2: Add Polyfills**
```bash
# Install polyfills
npm install core-js regenerator-runtime

# Import in main.tsx
// src/main.tsx
import 'core-js/stable';
import 'regenerator-runtime/runtime';

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// ... rest of code
```

**Solution 3: Update Browserslist**
```json
// package.json
{
  "browserslist": {
    "production": [
      ">0.2%",
      "not dead",
      "not op_mini all"
    ],
    "development": [
      "last 1 chrome version",
      "last 1 firefox version",
      "last 1 safari version"
    ]
  }
}
```

---

### Issue: Safari-Specific Issues

**Symptom:**
- Works in Chrome/Firefox but not Safari
- Date parsing errors
- CSS rendering issues

**Common Safari Issues & Solutions:**

**Issue 1: Date Parsing**
```typescript
// Safari doesn't support some date formats
// Bad: new Date('2024-01-15 10:30:00')
// Good:
const parseDate = (dateString: string) => {
    // Replace space with 'T' for ISO 8601 format
    const isoString = dateString.replace(' ', 'T');
    return new Date(isoString);
};
```

**Issue 2: Flexbox Issues**
```css
/* Add Safari-specific prefixes */
.flex-container {
    display: -webkit-flex; /* Safari */
    display: flex;
    -webkit-flex-direction: row;
    flex-direction: row;
}
```

**Issue 3: Smooth Scrolling**
```css
/* Safari needs -webkit prefix */
html {
    scroll-behavior: smooth;
    -webkit-scroll-behavior: smooth;
}
```

**Testing in Safari:**
```bash
# Use Safari Technology Preview for testing
# Download from: https://developer.apple.com/safari/technology-preview/

# Or use BrowserStack for remote testing
```

---

## Web Server Configuration

### Issue: Static Files Not Served

**Symptom:**
- 404 errors for CSS/JS files
- Assets not loading
- Console errors for missing files

**Diagnosis:**
```bash
# 1. Check if files exist
ls -la /var/www/moodle/react-frontend/dist/assets/

# 2. Test direct file access
curl -I https://yourdomain.com/react-frontend/assets/index-abc123.js

# 3. Check permissions
ls -la /var/www/moodle/react-frontend/dist/
```

**Solutions:**

**Solution 1: Fix File Permissions**
```bash
# Set correct ownership
sudo chown -R www-data:www-data /var/www/moodle/react-frontend/dist/

# Set correct permissions
sudo find /var/www/moodle/react-frontend/dist/ -type d -exec chmod 755 {} \;
sudo find /var/www/moodle/react-frontend/dist/ -type f -exec chmod 644 {} \;
```

**Solution 2: Configure Nginx Root Path**
```nginx
# /etc/nginx/sites-available/moodle
server {
    listen 80;
    server_name yourdomain.com;
    
    # Verify root path is correct
    root /var/www/moodle;
    
    location /react-frontend {
        alias /var/www/moodle/react-frontend/dist;  # Correct path
        try_files $uri $uri/ /react-frontend/index.html;
    }
}

sudo nginx -t
sudo systemctl reload nginx
```

**Solution 3: Configure Apache DocumentRoot**
```apache
<VirtualHost *:80>
    ServerName yourdomain.com
    DocumentRoot /var/www/moodle
    
    Alias /react-frontend /var/www/moodle/react-frontend/dist
    <Directory /var/www/moodle/react-frontend/dist>
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>
</VirtualHost>

sudo apachectl configtest
sudo systemctl reload apache2
```

---

### Issue: Gzip Not Working

**Symptom:**
- Large file sizes in Network tab
- No Content-Encoding: gzip header
- Slow page loads due to uncompressed files

**Diagnosis:**
```bash
# Check if gzip is enabled
curl -H "Accept-Encoding: gzip" -I https://yourdomain.com/react-frontend/assets/index.js

# Should return:
# Content-Encoding: gzip
```

**Solutions:**

**Nginx Gzip Configuration:**
```nginx
# /etc/nginx/nginx.conf
http {
    # Enable gzip
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types 
        text/plain 
        text/css 
        text/xml 
        text/javascript 
        application/json 
        application/javascript 
        application/xml+rss 
        application/rss+xml 
        font/truetype 
        font/opentype 
        application/vnd.ms-fontobject 
        image/svg+xml;
    
    # Enable gzip_static for pre-compressed files
    gzip_static on;
}

sudo nginx -t
sudo systemctl reload nginx
```

**Apache Gzip Configuration:**
```apache
# /etc/apache2/mods-available/deflate.conf
<IfModule mod_deflate.c>
    # Compress HTML, CSS, JavaScript, Text, XML and fonts
    AddOutputFilterByType DEFLATE application/javascript
    AddOutputFilterByType DEFLATE application/rss+xml
    AddOutputFilterByType DEFLATE application/vnd.ms-fontobject
    AddOutputFilterByType DEFLATE application/x-font
    AddOutputFilterByType DEFLATE application/x-font-opentype
    AddOutputFilterByType DEFLATE application/x-font-otf
    AddOutputFilterByType DEFLATE application/x-font-truetype
    AddOutputFilterByType DEFLATE application/x-font-ttf
    AddOutputFilterByType DEFLATE application/x-javascript
    AddOutputFilterByType DEFLATE application/xhtml+xml
    AddOutputFilterByType DEFLATE application/xml
    AddOutputFilterByType DEFLATE font/opentype
    AddOutputFilterByType DEFLATE font/otf
    AddOutputFilterByType DEFLATE font/ttf
    AddOutputFilterByType DEFLATE image/svg+xml
    AddOutputFilterByType DEFLATE image/x-icon
    AddOutputFilterByType DEFLATE text/css
    AddOutputFilterByType DEFLATE text/html
    AddOutputFilterByType DEFLATE text/javascript
    AddOutputFilterByType DEFLATE text/plain
    AddOutputFilterByType DEFLATE text/xml
</IfModule>

sudo a2enmod deflate
sudo systemctl reload apache2
```

**Pre-compress Files During Build:**
```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import viteCompression from 'vite-plugin-compression';

export default defineConfig({
  plugins: [
    react(),
    viteCompression({
      algorithm: 'gzip',
      ext: '.gz',
    }),
  ],
});

// Install plugin
npm install vite-plugin-compression --save-dev
```

---

### Issue: Caching Too Aggressive

**Symptom:**
- Users see old version after deployment
- Changes not reflecting for users
- Hard refresh (Ctrl+F5) required to see updates

**Diagnosis:**
```bash
# Check cache headers
curl -I https://yourdomain.com/react-frontend/index.html

# Check if users have cached version
# Browser DevTools > Network > Disable cache
```

**Solutions:**

**Solution 1: Correct Cache Headers**
```nginx
# /etc/nginx/sites-available/moodle
server {
    # Cache static assets with hash (immutable)
    location ~ /react-frontend/assets/.*\.[a-f0-9]{8}\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # Don't cache HTML files
    location ~ /react-frontend.*\.html$ {
        expires -1;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
    }
}
```

**Solution 2: Use Hashed Filenames**
```typescript
// vite.config.ts - Ensure hash in filenames
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
  },
});
```

**Solution 3: Clear CDN Cache After Deployment**
```bash
# If using CloudFlare
curl -X POST "https://api.cloudflare.com/client/v4/zones/ZONE_ID/purge_cache" \
     -H "Authorization: Bearer YOUR_API_TOKEN" \
     -H "Content-Type: application/json" \
     --data '{"purge_everything":true}'

# If using AWS CloudFront
aws cloudfront create-invalidation \
    --distribution-id DISTRIBUTION_ID \
    --paths "/react-frontend/*"
```

---

## Docker Issues

### Issue: Container Won't Start

**Symptom:**
- Docker container exits immediately
- Container status is "Exited (1)"
- Application not accessible

**Diagnosis:**
```bash
# 1. Check container logs
docker logs container-name

# 2. Check container status
docker ps -a

# 3. Inspect container
docker inspect container-name

# 4. Try running interactively
docker run -it container-name /bin/sh
```

**Solutions:**

**Solution 1: Fix Dockerfile**
```dockerfile
# react-frontend/docker/Dockerfile
FROM node:20-alpine AS build

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci

# Copy source
COPY . .

# Build
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy nginx config
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built files
COPY --from=build /app/dist /usr/share/nginx/html

# Expose port
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
```

**Solution 2: Check Port Binding**
```bash
# Verify port is not already in use
sudo lsof -i :80

# If port is busy, use different port
docker run -p 8080:80 container-name
```

**Solution 3: Verify Image Built Correctly**
```bash
# Rebuild image
docker build -t moodle-react-frontend:latest -f docker/Dockerfile .

# Check build logs for errors
docker build --no-cache -t moodle-react-frontend:latest .
```

---

### Issue: Volume Mount Issues

**Symptom:**
- Files not accessible in container
- Permission denied errors
- Changes not reflecting

**Diagnosis:**
```bash
# 1. Check mount points
docker inspect container-name | grep Mounts -A 20

# 2. Verify files exist
docker exec container-name ls -la /app

# 3. Check permissions
docker exec container-name ls -l /path/to/mounted/volume
```

**Solutions:**

**Solution 1: Fix Volume Paths**
```yaml
# docker-compose.yml
version: '3.8'

services:
  react-frontend:
    build:
      context: .
      dockerfile: docker/Dockerfile
    ports:
      - "80:80"
    volumes:
      # Use named volume for node_modules
      - node_modules:/app/node_modules
      # Mount source code
      - ./src:/app/src:ro  # Read-only

volumes:
  node_modules:
```

**Solution 2: Fix Permissions**
```dockerfile
# Set correct user in Dockerfile
FROM node:20-alpine

# Create app user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Set ownership
WORKDIR /app
COPY --chown=nodejs:nodejs package*.json ./
RUN npm ci

COPY --chown=nodejs:nodejs . .

# Run as non-root user
USER nodejs
```

**Solution 3: Use Named Volumes**
```bash
# Create named volume
docker volume create moodle-react-node-modules

# Use in docker run
docker run -v moodle-react-node-modules:/app/node_modules \
           -v $(pwd)/src:/app/src \
           moodle-react-frontend
```

---

## Diagnostic Commands

Essential commands for troubleshooting deployment issues:

### Build Diagnostics

```bash
# Detailed build output
npm run build --verbose

# Type checking only
npm run type-check

# Build with analysis
npm run build -- --analyze

# Check bundle size
du -sh dist/
ls -lh dist/assets/

# Verify environment variables
npm run build && cat dist/assets/index-*.js | grep "VITE_"
```

### Server Diagnostics

```bash
# Check HTTP headers
curl -I https://yourdomain.com/react-frontend

# Check specific header
curl -I https://yourdomain.com/react-frontend | grep Cache-Control

# Check CORS headers
curl -H "Origin: https://example.com" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: Authorization, Content-Type" \
     -X OPTIONS \
     https://yourdomain.com/api/v1/courses \
     -v

# Check SSL certificate
openssl s_client -connect yourdomain.com:443 -servername yourdomain.com

# Test endpoint response time
time curl https://yourdomain.com/api/v1/courses
```

### Docker Diagnostics

```bash
# Container logs
docker logs container-name
docker logs -f container-name  # Follow logs

# Container details
docker inspect container-name

# Execute command in container
docker exec -it container-name /bin/sh

# Check container resource usage
docker stats container-name

# List all containers
docker ps -a

# Remove stopped containers
docker container prune
```

### Web Server Diagnostics

**Nginx:**
```bash
# Test configuration
sudo nginx -t

# Reload configuration
sudo systemctl reload nginx

# View error logs
sudo tail -f /var/log/nginx/error.log

# View access logs
sudo tail -f /var/log/nginx/access.log

# Check nginx status
sudo systemctl status nginx

# View nginx system logs
sudo journalctl -u nginx -f
```

**Apache:**
```bash
# Test configuration
sudo apachectl configtest

# Reload configuration
sudo systemctl reload apache2

# View error logs
sudo tail -f /var/log/apache2/error.log

# View access logs
sudo tail -f /var/log/apache2/access.log

# Check Apache status
sudo systemctl status apache2

# View Apache system logs
sudo journalctl -u apache2 -f

# List loaded modules
apache2ctl -M
```

### Browser DevTools

**Console Tab:**
```javascript
// Check environment
console.log('Environment:', import.meta.env.MODE);
console.log('API URL:', import.meta.env.VITE_API_BASE_URL);

// Check Redux state
window.__REDUX_DEVTOOLS_EXTENSION__ && window.__REDUX_DEVTOOLS_EXTENSION__.open();

// Check memory usage
console.log('Memory:', performance.memory);

// Measure performance
performance.mark('start');
// ... operation
performance.mark('end');
performance.measure('operation', 'start', 'end');
console.log(performance.getEntriesByName('operation'));
```

**Network Tab:**
- Filter by type: XHR, JS, CSS, Img
- Check request headers (Authorization, Content-Type)
- Check response headers (Cache-Control, CORS)
- View timing (Stalled, DNS Lookup, Initial connection, SSL, Request sent, Waiting, Content Download)
- Check response status and body

**React DevTools:**
- Components tab: Inspect component hierarchy and props
- Profiler tab: Record and analyze render performance
- Check for unnecessary re-renders
- Identify components with high render times

---

## Getting Help

### Before Contacting Support

Always gather this information before seeking help:

1. **Error Message**: Complete error text from console or logs
2. **Steps to Reproduce**: Exact sequence of actions that trigger the issue
3. **Environment Details**:
   - Browser and version
   - Operating system
   - Node.js version (`node -v`)
   - npm version (`npm -v`)
   - Application version
4. **Logs**:
   - Browser console output
   - Server error logs
   - Build output
5. **Recent Changes**:
   - What was deployed recently?
   - What configuration was changed?
6. **Screenshot or Video**: Visual representation of the issue

### Diagnostic Checklist

Before reporting an issue, verify:

- [ ] Checked browser console for errors
- [ ] Reviewed server logs (nginx/Apache, PHP)
- [ ] Verified environment variables are correct
- [ ] Confirmed API endpoints are accessible
- [ ] Tested in different browser (rule out browser-specific issue)
- [ ] Cleared browser cache and tried again
- [ ] Checked recent deployments or changes
- [ ] Reviewed monitoring dashboards for anomalies
- [ ] Tested with clean cache/incognito mode
- [ ] Verified no network/firewall issues

### Where to Get Help

1. **Documentation**:
   - Check `/docs` directory for relevant guides
   - Review API documentation
   - Consult architecture decision records (ADRs)

2. **Monitoring Dashboards**:
   - Check application performance monitoring (APM)
   - Review error tracking (Sentry, if configured)
   - Check server metrics (CPU, memory, disk)

3. **Team Communication**:
   - Slack/Teams channel for quick questions
   - Create detailed issue in project tracker
   - Schedule call for complex issues

4. **Development Team**:
   - Include all diagnostic information
   - Provide steps to reproduce
   - Attach relevant logs and screenshots
   - Specify urgency level (Critical, High, Medium, Low)

### Issue Report Template

```markdown
## Issue Summary
Brief description of the problem

## Environment
- **Browser**: Chrome 120.0.6099.109
- **OS**: Ubuntu 22.04
- **Node Version**: 20.10.0
- **Application Version**: 4.4.0-react

## Steps to Reproduce
1. Navigate to /courses
2. Click on "Course Details" for course ID 5
3. Observe error in console

## Expected Behavior
Course details page should load with course information

## Actual Behavior
Blank page with JavaScript error in console

## Error Message
```
TypeError: Cannot read property 'fullname' of undefined
at CourseDetail.tsx:45
```

## Logs
```
[nginx error.log]
2024/01/15 10:30:45 [error] 12345#12345: *1 FastCGI sent in stderr: "PHP message: PHP Fatal error..."

[browser console]
TypeError: Cannot read property 'fullname' of undefined
    at CourseDetail (CourseDetail.tsx:45)
    at renderWithHooks (react-dom.production.min.js:12)
```

## Screenshots
[Attach screenshot]

## Recent Changes
- Deployed version 4.4.1 at 2024-01-15 09:00 UTC
- Updated API endpoint for course details

## Attempted Solutions
- Cleared browser cache
- Tested in incognito mode
- Verified API returns data correctly
- Issue persists across all browsers

## Additional Context
Issue affects all users, not specific to one account
```

---

## Conclusion

This troubleshooting guide covers the most common deployment issues and their solutions. Remember to:

1. **Stay Systematic**: Follow the debugging methodology
2. **Check Logs First**: Most issues reveal themselves in logs
3. **Isolate the Problem**: Narrow down to specific component or service
4. **Document Solutions**: Help future troubleshooting efforts
5. **Ask for Help**: Don't hesitate when stuck

For issues not covered in this guide, consult the development team or create a detailed issue report.

---

**Last Updated**: 2024-01-15  
**Version**: 1.0.0  
**Maintainer**: Development Team
