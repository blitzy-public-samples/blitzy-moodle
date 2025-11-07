# Environment Setup Guide

## Overview

This document provides comprehensive guidance for setting up the deployment environment for the Moodle React frontend. The React application is a Single Page Application (SPA) that runs entirely in the browser and communicates with the existing Moodle PHP backend via RESTful API endpoints.

**Target Audience:** System administrators, DevOps engineers, and deployment personnel

**Prerequisites:** 
- Familiarity with Linux/Unix system administration
- Understanding of web server configuration (Nginx or Apache)
- Basic knowledge of SSL/TLS certificates
- Access to server with root or sudo privileges

---

## Table of Contents

1. [System Requirements](#system-requirements)
2. [Node.js and npm Setup](#nodejs-and-npm-setup)
3. [Environment Variables](#environment-variables)
4. [SSL/TLS Configuration](#ssltls-configuration)
5. [CORS Configuration](#cors-configuration)
6. [Web Server Requirements](#web-server-requirements)
7. [Environment-Specific Configurations](#environment-specific-configurations)
8. [Security Hardening](#security-hardening)
9. [Verification and Testing](#verification-and-testing)
10. [Troubleshooting](#troubleshooting)

---

## System Requirements

### Hardware Requirements

**Minimum Requirements:**
- **CPU:** 2 cores
- **RAM:** 2 GB minimum, 4 GB recommended
- **Disk Space:** 5 GB for application and dependencies
- **Network:** Stable internet connection for npm package downloads

**Recommended for Production:**
- **CPU:** 4+ cores
- **RAM:** 8+ GB
- **Disk Space:** 20+ GB (includes logs, backups, and future updates)
- **Network:** High-bandwidth connection, low latency to backend API

### Software Requirements

| Component | Minimum Version | Recommended Version | Purpose |
|-----------|----------------|---------------------|---------|
| **Node.js** | 20.0.0 LTS | 20.11.0 LTS | JavaScript runtime for build tools |
| **npm** | 9.0.0 | 10.2.0 | Package manager |
| **Web Server** | Nginx 1.18+ or Apache 2.4+ | Nginx 1.24+ or Apache 2.4.57+ | Serve static files and proxy API |
| **Operating System** | Ubuntu 20.04, CentOS 8, RHEL 8 | Ubuntu 22.04 LTS | Server OS |
| **SSL/TLS** | OpenSSL 1.1.1+ | OpenSSL 3.0+ | HTTPS encryption |

### Optional Components

| Component | Version | Purpose |
|-----------|---------|---------|
| **pnpm** | 8.0+ | Alternative package manager (faster than npm) |
| **Docker** | 20.10+ | Containerized deployment |
| **Docker Compose** | 2.0+ | Multi-container orchestration |
| **Git** | 2.30+ | Version control and deployment |

---

## Node.js and npm Setup

### Installing Node.js 20.x LTS

The React frontend **requires** Node.js 20.x LTS. Do not use older versions (Node 18, 16, 14) as they lack required features. Do not use newer odd-numbered versions (Node 21, 23) as they are not LTS and may have compatibility issues.

#### Option 1: Using NodeSource Repository (Recommended)

**For Ubuntu/Debian:**

```bash
# Download and execute NodeSource setup script for Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# Install Node.js
sudo apt-get install -y nodejs

# Verify installation
node --version  # Should show v20.x.x
npm --version   # Should show 9.x.x or 10.x.x
```

**For CentOS/RHEL:**

```bash
# Download and execute NodeSource setup script
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -

# Install Node.js
sudo yum install -y nodejs

# Verify installation
node --version
npm --version
```

#### Option 2: Using nvm (Node Version Manager)

**Recommended for development environments and multi-version management:**

```bash
# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.5/install.sh | bash

# Load nvm (or restart terminal)
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Install Node.js 20 LTS
nvm install 20
nvm use 20
nvm alias default 20

# Verify installation
node --version
npm --version
```

#### Option 3: Using Official Binary

```bash
# Download Node.js 20.x LTS binary
wget https://nodejs.org/dist/v20.11.0/node-v20.11.0-linux-x64.tar.xz

# Extract
tar -xJvf node-v20.11.0-linux-x64.tar.xz

# Move to /opt
sudo mv node-v20.11.0-linux-x64 /opt/nodejs

# Create symlinks
sudo ln -s /opt/nodejs/bin/node /usr/local/bin/node
sudo ln -s /opt/nodejs/bin/npm /usr/local/bin/npm

# Verify
node --version
npm --version
```

### Configuring npm

**Set npm registry (if using private registry):**

```bash
npm config set registry https://registry.npmjs.org/
```

**Configure npm cache directory (optional, for shared servers):**

```bash
npm config set cache /var/cache/npm --global
```

**Increase npm timeout for slow connections:**

```bash
npm config set fetch-timeout 60000
```

### Installing pnpm (Optional Alternative)

pnpm is faster and more disk-efficient than npm:

```bash
npm install -g pnpm@8

# Verify
pnpm --version
```

---

## Environment Variables

The React frontend uses **Vite** as the build tool. Vite exposes environment variables to the application code using a special `import.meta.env` object. **All environment variables must be prefixed with `VITE_`** to be accessible in the application.

### Required Environment Variables

| Variable Name | Description | Default | Required |
|---------------|-------------|---------|----------|
| `VITE_API_BASE_URL` | Base URL for Moodle API endpoints (e.g., `https://moodle.example.com`) | - | **Yes** |
| `VITE_APP_NAME` | Application name displayed in browser | `Moodle` | No |
| `VITE_APP_VERSION` | Application version | `4.4.0-react` | No |

### Security and Authentication Variables

| Variable Name | Description | Default | Example |
|---------------|-------------|---------|---------|
| `VITE_JWT_ACCESS_TOKEN_EXPIRY` | Access token expiration in seconds | `3600` | `3600` (1 hour) |
| `VITE_JWT_REFRESH_TOKEN_EXPIRY` | Refresh token expiration in seconds | `604800` | `604800` (7 days) |

### File Upload Variables

| Variable Name | Description | Default | Example |
|---------------|-------------|---------|---------|
| `VITE_MAX_FILE_SIZE` | Maximum file upload size in bytes | `104857600` | `104857600` (100MB) |

### Optional Feature Flags

| Variable Name | Description | Default | Example |
|---------------|-------------|---------|---------|
| `VITE_ENABLE_ANALYTICS` | Enable Google Analytics or tracking | `false` | `true` |
| `VITE_ENABLE_ERROR_REPORTING` | Enable Sentry error reporting | `false` | `true` |
| `VITE_SENTRY_DSN` | Sentry Data Source Name | - | `https://xxx@sentry.io/yyy` |

### Environment Variable Files

Environment variables are stored in `.env` files at the root of the `react-frontend/` directory. **Never commit `.env` files with sensitive values to version control.**

**File Structure:**

```
react-frontend/
├── .env.example           # Template with all variables (committed to Git)
├── .env.development       # Development environment (gitignored)
├── .env.staging           # Staging environment (gitignored)
├── .env.production        # Production environment (gitignored)
└── .env.local             # Local overrides (gitignored)
```

### .env.example Template

Copy this template to create environment-specific files:

```bash
# API Configuration
VITE_API_BASE_URL=https://moodle.example.com

# Application Metadata
VITE_APP_NAME=Moodle
VITE_APP_VERSION=4.4.0-react

# JWT Token Configuration (in seconds)
VITE_JWT_ACCESS_TOKEN_EXPIRY=3600        # 1 hour
VITE_JWT_REFRESH_TOKEN_EXPIRY=604800     # 7 days

# File Upload Limits (in bytes)
VITE_MAX_FILE_SIZE=104857600             # 100 MB

# Feature Flags (optional)
VITE_ENABLE_ANALYTICS=false
VITE_ENABLE_ERROR_REPORTING=false
VITE_SENTRY_DSN=
```

### Creating Environment-Specific Files

**Development Environment (.env.development):**

```bash
cd react-frontend
cp .env.example .env.development

# Edit .env.development
nano .env.development
```

```ini
VITE_API_BASE_URL=http://localhost:8080
VITE_APP_NAME=Moodle (Dev)
VITE_APP_VERSION=4.4.0-react-dev
VITE_JWT_ACCESS_TOKEN_EXPIRY=3600
VITE_JWT_REFRESH_TOKEN_EXPIRY=604800
VITE_MAX_FILE_SIZE=104857600
VITE_ENABLE_ANALYTICS=false
VITE_ENABLE_ERROR_REPORTING=false
```

**Staging Environment (.env.staging):**

```ini
VITE_API_BASE_URL=https://staging.moodle.example.com
VITE_APP_NAME=Moodle (Staging)
VITE_APP_VERSION=4.4.0-react-staging
VITE_JWT_ACCESS_TOKEN_EXPIRY=3600
VITE_JWT_REFRESH_TOKEN_EXPIRY=604800
VITE_MAX_FILE_SIZE=104857600
VITE_ENABLE_ANALYTICS=true
VITE_ENABLE_ERROR_REPORTING=true
VITE_SENTRY_DSN=https://staging-key@sentry.io/project
```

**Production Environment (.env.production):**

```ini
VITE_API_BASE_URL=https://moodle.example.com
VITE_APP_NAME=Moodle
VITE_APP_VERSION=4.4.0-react
VITE_JWT_ACCESS_TOKEN_EXPIRY=3600
VITE_JWT_REFRESH_TOKEN_EXPIRY=604800
VITE_MAX_FILE_SIZE=104857600
VITE_ENABLE_ANALYTICS=true
VITE_ENABLE_ERROR_REPORTING=true
VITE_SENTRY_DSN=https://production-key@sentry.io/project
```

### Using Environment Variables in Build

Environment variables are injected at **build time**, not runtime. The build process reads the appropriate `.env` file based on the `--mode` flag:

```bash
# Development build (uses .env.development)
npm run dev

# Staging build (uses .env.staging)
npm run build -- --mode staging

# Production build (uses .env.production)
npm run build
```

### Accessing Environment Variables in Code

In React components and TypeScript files:

```typescript
// Access environment variables
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
const appName = import.meta.env.VITE_APP_NAME;

// Check if running in development mode
if (import.meta.env.DEV) {
  console.log('Development mode');
}

// Check if running in production mode
if (import.meta.env.PROD) {
  console.log('Production mode');
}
```

**Important Notes:**
- Only variables prefixed with `VITE_` are exposed to the application code
- Environment variables are **static** at build time and cannot be changed at runtime
- Sensitive secrets (API keys, passwords) should NEVER be in VITE_ variables as they are embedded in client-side JavaScript
- To change environment variables, you must rebuild the application

---

## SSL/TLS Configuration

**HTTPS is mandatory for all production deployments.** The React frontend communicates with the backend API, and JWT tokens must be transmitted securely.

### Certificate Requirements

- **Certificate Type:** X.509 certificate issued by a trusted Certificate Authority (CA)
- **Key Algorithm:** RSA 2048-bit minimum, RSA 4096-bit or ECDSA P-256 recommended
- **Protocol:** TLS 1.2 minimum, TLS 1.3 recommended
- **Cipher Suites:** Modern, secure cipher suites only (no RC4, 3DES, or export ciphers)

### Certificate Acquisition Options

#### Option 1: Let's Encrypt (Free, Recommended)

Let's Encrypt provides free, automated SSL/TLS certificates with 90-day validity (auto-renewed).

**Install Certbot:**

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y certbot

# CentOS/RHEL
sudo yum install -y certbot
```

**Obtain Certificate (Standalone Mode):**

```bash
# Stop web server temporarily
sudo systemctl stop nginx  # or apache2

# Obtain certificate
sudo certbot certonly --standalone \
  -d moodle.example.com \
  -d www.moodle.example.com \
  --email admin@example.com \
  --agree-tos \
  --non-interactive

# Certificate files created at:
# /etc/letsencrypt/live/moodle.example.com/fullchain.pem
# /etc/letsencrypt/live/moodle.example.com/privkey.pem

# Restart web server
sudo systemctl start nginx
```

**Obtain Certificate (Webroot Mode, without stopping server):**

```bash
sudo certbot certonly --webroot \
  -w /var/www/html \
  -d moodle.example.com \
  -d www.moodle.example.com \
  --email admin@example.com \
  --agree-tos \
  --non-interactive
```

**Configure Auto-Renewal:**

```bash
# Test renewal
sudo certbot renew --dry-run

# Add cron job for automatic renewal
echo "0 3 * * * root certbot renew --quiet --post-hook 'systemctl reload nginx'" | sudo tee -a /etc/crontab
```

#### Option 2: Commercial Certificate

Purchase from a commercial CA (DigiCert, GlobalSign, Sectigo, etc.) and follow their issuance process.

**Typical steps:**
1. Generate Certificate Signing Request (CSR)
2. Submit CSR to CA
3. Validate domain ownership
4. Download signed certificate
5. Install certificate on server

#### Option 3: Internal CA (for internal/staging environments)

For non-public staging or internal environments, use your organization's internal CA.

### Certificate File Locations

**Standard Locations:**

```
/etc/ssl/certs/moodle.example.com.crt      # Certificate file
/etc/ssl/private/moodle.example.com.key    # Private key file
/etc/ssl/certs/ca-bundle.crt               # CA bundle (if applicable)
```

**Let's Encrypt Locations:**

```
/etc/letsencrypt/live/moodle.example.com/fullchain.pem   # Certificate + chain
/etc/letsencrypt/live/moodle.example.com/privkey.pem     # Private key
```

### File Permissions

**Critical: Protect private key file**

```bash
sudo chmod 600 /etc/ssl/private/moodle.example.com.key
sudo chown root:root /etc/ssl/private/moodle.example.com.key

# Certificate can be world-readable
sudo chmod 644 /etc/ssl/certs/moodle.example.com.crt
```

### Testing SSL/TLS Configuration

**Using OpenSSL:**

```bash
# Test connection
openssl s_client -connect moodle.example.com:443 -servername moodle.example.com

# Check certificate expiration
echo | openssl s_client -connect moodle.example.com:443 -servername moodle.example.com 2>/dev/null | openssl x509 -noout -dates
```

**Using Online Tools:**
- SSL Labs Server Test: https://www.ssllabs.com/ssltest/
- Target: A or A+ rating

---

## CORS Configuration

Cross-Origin Resource Sharing (CORS) must be configured on the **backend API** to allow the React frontend (running on a browser) to make requests to the API endpoints.

### Why CORS is Needed

The React frontend is served as static files from a web server (e.g., `https://moodle.example.com`), and it makes API requests to backend endpoints (e.g., `https://moodle.example.com/api/v1/`). Even though they share the same domain, if the frontend is served from a different subdomain or port, browsers enforce CORS policies.

### CORS Configuration in Moodle Backend

CORS settings are configured in the Moodle `config.php` file on the PHP backend.

**Location:** `moodle-root/config.php`

**Add the following lines (append only, do NOT modify existing lines):**

```php
// CORS Configuration for React Frontend
$CFG->cors_enabled = true;

// Allowed origins (whitelist)
// IMPORTANT: Use specific domains in production, NEVER use '*' wildcard
$CFG->cors_allowed_origins = [
    'https://moodle.example.com',           // Production frontend
    'https://staging.moodle.example.com',   // Staging frontend
    'http://localhost:5173',                // Local development (Vite dev server)
    'http://localhost:4173',                // Local preview (Vite preview)
];

// Allowed HTTP methods
$CFG->cors_allowed_methods = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'];

// Allowed headers
$CFG->cors_allowed_headers = [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
];

// Allow credentials (cookies, authorization headers)
$CFG->cors_allow_credentials = true;

// Preflight cache duration (in seconds)
$CFG->cors_max_age = 3600;  // 1 hour
```

### CORS Implementation in API Endpoints

Each API endpoint should include CORS headers in responses. This is typically handled by a middleware or in the API base class.

**Example (api/lib/api_response.php):**

```php
<?php
function send_cors_headers() {
    global $CFG;
    
    if (empty($CFG->cors_enabled)) {
        return;
    }
    
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    
    // Check if origin is in whitelist
    if (in_array($origin, $CFG->cors_allowed_origins)) {
        header("Access-Control-Allow-Origin: $origin");
        header("Access-Control-Allow-Credentials: true");
        header("Access-Control-Allow-Methods: " . implode(', ', $CFG->cors_allowed_methods));
        header("Access-Control-Allow-Headers: " . implode(', ', $CFG->cors_allowed_headers));
        header("Access-Control-Max-Age: " . $CFG->cors_max_age);
    }
    
    // Handle preflight OPTIONS request
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}
```

### Security Considerations

**DO:**
- ✅ Whitelist specific origins (exact domain matches)
- ✅ Use HTTPS for all production origins
- ✅ Include `http://localhost` origins for development only
- ✅ Validate origin against whitelist before sending headers
- ✅ Set `Access-Control-Allow-Credentials: true` for authenticated requests

**DON'T:**
- ❌ NEVER use `Access-Control-Allow-Origin: *` in production
- ❌ NEVER allow all methods or headers
- ❌ NEVER include untrusted origins in whitelist
- ❌ NEVER disable CORS validation for convenience

### Testing CORS Configuration

**Using curl:**

```bash
# Test preflight request
curl -X OPTIONS \
  -H "Origin: https://moodle.example.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type, Authorization" \
  -i \
  https://moodle.example.com/api/v1/courses

# Expected response should include:
# Access-Control-Allow-Origin: https://moodle.example.com
# Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
# Access-Control-Allow-Headers: Content-Type, Authorization, ...
```

**Using browser DevTools:**

1. Open browser DevTools (F12)
2. Go to Network tab
3. Make a request from React app
4. Inspect response headers
5. Verify `Access-Control-Allow-Origin` header is present

**Common CORS Errors:**

| Error | Cause | Solution |
|-------|-------|----------|
| `No 'Access-Control-Allow-Origin' header is present` | Backend not sending CORS headers | Enable CORS in config.php |
| `The 'Access-Control-Allow-Origin' header contains the invalid value '*'` | Wildcard with credentials | Use specific origin |
| `CORS policy: Credentials flag is true, but the 'Access-Control-Allow-Credentials' header is ''` | Missing credentials header | Set `cors_allow_credentials = true` |

---

## Web Server Requirements

The React frontend is a static Single Page Application (SPA) that must be served by a web server. The web server also acts as a reverse proxy for API requests to the PHP backend.

### Nginx Configuration (Recommended)

**Version:** Nginx 1.18 or later (1.24+ recommended)

**Install Nginx:**

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y nginx

# CentOS/RHEL
sudo yum install -y nginx

# Verify installation
nginx -v
```

**Configuration File Location:**

```
/etc/nginx/sites-available/moodle-react
/etc/nginx/sites-enabled/moodle-react  # Symlink to above
```

**Complete Nginx Configuration Example:**

```nginx
# Redirect HTTP to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name moodle.example.com www.moodle.example.com;
    
    return 301 https://$host$request_uri;
}

# Main HTTPS Server Block
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name moodle.example.com www.moodle.example.com;
    
    # SSL Certificate Configuration
    ssl_certificate /etc/letsencrypt/live/moodle.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/moodle.example.com/privkey.pem;
    
    # SSL Security Settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    
    # Content Security Policy
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://moodle.example.com;" always;
    
    # React Frontend - Static Files
    root /var/www/moodle-react/dist;
    index index.html;
    
    # Enable Gzip Compression
    gzip on;
    gzip_vary on;
    gzip_min_length 256;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/json
        application/javascript
        application/x-javascript
        application/xml+rss
        application/rss+xml
        application/atom+xml
        image/svg+xml;
    
    # Brotli Compression (if module installed)
    # brotli on;
    # brotli_comp_level 6;
    # brotli_types text/plain text/css application/json application/javascript application/x-javascript text/xml application/xml application/xml+rss text/javascript image/svg+xml;
    
    # Cache Static Assets (1 year for hashed files)
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }
    
    # Don't cache index.html
    location = /index.html {
        expires -1;
        add_header Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0";
    }
    
    # API Proxy to PHP Backend
    location /api/v1/ {
        proxy_pass http://127.0.0.1:8080;  # PHP backend address
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # Buffer settings
        proxy_buffering on;
        proxy_buffer_size 4k;
        proxy_buffers 8 4k;
        proxy_busy_buffers_size 8k;
    }
    
    # Proxy file downloads from Moodle
    location /pluginfile.php {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # SPA Routing - Fallback to index.html for all other routes
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # Deny access to hidden files
    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
    }
    
    # Logging
    access_log /var/log/nginx/moodle-react-access.log;
    error_log /var/log/nginx/moodle-react-error.log warn;
}
```

**Enable Site and Reload Nginx:**

```bash
# Create symlink
sudo ln -s /etc/nginx/sites-available/moodle-react /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

### Apache Configuration (Alternative)

**Version:** Apache 2.4 or later (2.4.57+ recommended)

**Install Apache:**

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y apache2

# Enable required modules
sudo a2enmod rewrite ssl headers proxy proxy_http deflate expires

# CentOS/RHEL
sudo yum install -y httpd mod_ssl

# Verify installation
apache2 -v  # or httpd -v
```

**Configuration File Location:**

```
/etc/apache2/sites-available/moodle-react.conf   # Ubuntu/Debian
/etc/httpd/conf.d/moodle-react.conf              # CentOS/RHEL
```

**Complete Apache Configuration Example:**

```apache
# Redirect HTTP to HTTPS
<VirtualHost *:80>
    ServerName moodle.example.com
    ServerAlias www.moodle.example.com
    
    Redirect permanent / https://moodle.example.com/
</VirtualHost>

# Main HTTPS Virtual Host
<VirtualHost *:443>
    ServerName moodle.example.com
    ServerAlias www.moodle.example.com
    
    # SSL Configuration
    SSLEngine on
    SSLCertificateFile /etc/letsencrypt/live/moodle.example.com/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/moodle.example.com/privkey.pem
    
    # SSL Security Settings
    SSLProtocol all -SSLv3 -TLSv1 -TLSv1.1
    SSLCipherSuite ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384
    SSLHonorCipherOrder off
    
    # React Frontend Document Root
    DocumentRoot /var/www/moodle-react/dist
    
    <Directory /var/www/moodle-react/dist>
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted
        
        # SPA Routing - Fallback to index.html
        RewriteEngine On
        RewriteBase /
        RewriteRule ^index\.html$ - [L]
        RewriteCond %{REQUEST_FILENAME} !-f
        RewriteCond %{REQUEST_FILENAME} !-d
        RewriteRule . /index.html [L]
    </Directory>
    
    # Cache Static Assets
    <LocationMatch "^/assets/.*\.(js|css|woff|woff2|ttf|eot|svg|png|jpg|jpeg|gif|ico)$">
        ExpiresActive On
        ExpiresDefault "access plus 1 year"
        Header set Cache-Control "public, immutable"
    </LocationMatch>
    
    # Don't cache index.html
    <Files "index.html">
        FileETag None
        Header set Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0"
        Header set Expires "0"
    </Files>
    
    # API Proxy to PHP Backend
    ProxyPreserveHost On
    ProxyPass /api/v1/ http://127.0.0.1:8080/api/v1/
    ProxyPassReverse /api/v1/ http://127.0.0.1:8080/api/v1/
    
    # Proxy file downloads
    ProxyPass /pluginfile.php http://127.0.0.1:8080/pluginfile.php
    ProxyPassReverse /pluginfile.php http://127.0.0.1:8080/pluginfile.php
    
    # Enable Compression
    <IfModule mod_deflate.c>
        AddOutputFilterByType DEFLATE text/html text/plain text/xml text/css text/javascript application/javascript application/json application/xml image/svg+xml
    </IfModule>
    
    # Security Headers
    Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains"
    Header always set X-Frame-Options "SAMEORIGIN"
    Header always set X-Content-Type-Options "nosniff"
    Header always set X-XSS-Protection "1; mode=block"
    Header always set Referrer-Policy "strict-origin-when-cross-origin"
    Header always set Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://moodle.example.com;"
    
    # Logging
    ErrorLog /var/log/apache2/moodle-react-error.log
    CustomLog /var/log/apache2/moodle-react-access.log combined
</VirtualHost>
```

**Enable Site and Reload Apache:**

```bash
# Ubuntu/Debian
sudo a2ensite moodle-react
sudo apache2ctl configtest
sudo systemctl reload apache2

# CentOS/RHEL
sudo httpd -t
sudo systemctl reload httpd
```

---

## Environment-Specific Configurations

Different deployment environments (development, staging, production) require different configurations. This section details the specific settings for each environment.

### Development Environment

**Purpose:** Local development by developers

**Characteristics:**
- Hot module replacement (HMR) enabled
- Source maps enabled
- Verbose logging
- CORS allows localhost
- No minification for easier debugging
- Development API endpoint (local or shared dev server)

**Setup:**

1. **Install dependencies:**
   ```bash
   cd react-frontend
   npm install
   ```

2. **Create `.env.development`:**
   ```ini
   VITE_API_BASE_URL=http://localhost:8080
   VITE_APP_NAME=Moodle (Dev)
   VITE_APP_VERSION=4.4.0-react-dev
   VITE_JWT_ACCESS_TOKEN_EXPIRY=3600
   VITE_JWT_REFRESH_TOKEN_EXPIRY=604800
   VITE_MAX_FILE_SIZE=104857600
   VITE_ENABLE_ANALYTICS=false
   VITE_ENABLE_ERROR_REPORTING=false
   ```

3. **Start development server:**
   ```bash
   npm run dev
   ```

4. **Access application:**
   ```
   http://localhost:5173
   ```

**Development Server Configuration (vite.config.ts):**

The Vite dev server runs on port 5173 by default with hot module replacement enabled. API requests are typically proxied to a local or remote backend.

### Staging Environment

**Purpose:** Pre-production testing and quality assurance

**Characteristics:**
- Production-like environment
- Realistic data (anonymized/synthetic)
- Error tracking enabled
- Performance monitoring enabled
- Staging API endpoint
- Minified build (matches production)

**Setup:**

1. **Create `.env.staging`:**
   ```ini
   VITE_API_BASE_URL=https://staging.moodle.example.com
   VITE_APP_NAME=Moodle (Staging)
   VITE_APP_VERSION=4.4.0-react-staging
   VITE_JWT_ACCESS_TOKEN_EXPIRY=3600
   VITE_JWT_REFRESH_TOKEN_EXPIRY=604800
   VITE_MAX_FILE_SIZE=104857600
   VITE_ENABLE_ANALYTICS=true
   VITE_ENABLE_ERROR_REPORTING=true
   VITE_SENTRY_DSN=https://staging-key@sentry.io/project
   ```

2. **Build for staging:**
   ```bash
   npm run build -- --mode staging
   ```

3. **Deploy build artifacts:**
   ```bash
   # Copy dist/ to staging server
   rsync -avz --delete dist/ user@staging.example.com:/var/www/moodle-react/dist/
   ```

4. **Configure web server:**
   Use Nginx or Apache configuration from previous section, adjusting paths and domains for staging environment.

### Production Environment

**Purpose:** Live application serving real users

**Characteristics:**
- Maximum performance optimization
- Minified and compressed assets
- Error tracking and monitoring enabled
- Production API endpoint
- Strict security headers
- CDN integration (optional)
- High availability and redundancy

**Setup:**

1. **Create `.env.production`:**
   ```ini
   VITE_API_BASE_URL=https://moodle.example.com
   VITE_APP_NAME=Moodle
   VITE_APP_VERSION=4.4.0-react
   VITE_JWT_ACCESS_TOKEN_EXPIRY=3600
   VITE_JWT_REFRESH_TOKEN_EXPIRY=604800
   VITE_MAX_FILE_SIZE=104857600
   VITE_ENABLE_ANALYTICS=true
   VITE_ENABLE_ERROR_REPORTING=true
   VITE_SENTRY_DSN=https://production-key@sentry.io/project
   ```

2. **Build for production:**
   ```bash
   npm run build
   ```

3. **Verify build output:**
   ```bash
   # Check bundle sizes
   ls -lh dist/assets/
   
   # Test production build locally
   npm run preview
   ```

4. **Deploy to production:**
   ```bash
   # Option 1: Direct copy
   rsync -avz --delete dist/ user@prod.example.com:/var/www/moodle-react/dist/
   
   # Option 2: Blue-green deployment
   rsync -avz --delete dist/ user@prod.example.com:/var/www/moodle-react/releases/$(date +%Y%m%d%H%M%S)/
   
   # Option 3: Docker image (see deployment guide)
   ```

5. **Configure web server** as described in previous section.

6. **Verify deployment:**
   - Check HTTPS certificate
   - Test critical user flows
   - Verify API connectivity
   - Check browser console for errors
   - Run Lighthouse audit (target score >90)

### Environment Comparison Table

| Aspect | Development | Staging | Production |
|--------|-------------|---------|------------|
| **Build Command** | `npm run dev` | `npm run build -- --mode staging` | `npm run build` |
| **Minification** | No | Yes | Yes |
| **Source Maps** | Full inline | Full separate | Minimal (errors only) |
| **API Endpoint** | localhost:8080 | staging.example.com | moodle.example.com |
| **HTTPS Required** | No | Yes | Yes |
| **Error Tracking** | No | Yes | Yes |
| **Analytics** | No | Yes | Yes |
| **Caching** | Disabled | Enabled | Enabled (aggressive) |
| **Performance Target** | N/A | >80 Lighthouse | >90 Lighthouse |

---

## Security Hardening

Beyond SSL/TLS and CORS configuration, additional security measures should be implemented for production deployments.

### File Permissions

**React build artifacts:**

```bash
# Set ownership
sudo chown -R www-data:www-data /var/www/moodle-react/dist

# Set directory permissions
sudo find /var/www/moodle-react/dist -type d -exec chmod 755 {} \;

# Set file permissions
sudo find /var/www/moodle-react/dist -type f -exec chmod 644 {} \;
```

### Security Headers

Security headers are configured in the web server configuration (see Nginx/Apache sections above). Key headers:

| Header | Value | Purpose |
|--------|-------|---------|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | Enforce HTTPS for 1 year |
| `X-Frame-Options` | `SAMEORIGIN` | Prevent clickjacking |
| `X-Content-Type-Options` | `nosniff` | Prevent MIME sniffing |
| `X-XSS-Protection` | `1; mode=block` | Enable XSS filter |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Control referrer information |
| `Content-Security-Policy` | (see below) | Prevent XSS and data injection |

### Content Security Policy (CSP)

**Basic CSP for React Frontend:**

```nginx
add_header Content-Security-Policy "
    default-src 'self';
    script-src 'self' 'unsafe-inline' 'unsafe-eval';
    style-src 'self' 'unsafe-inline';
    img-src 'self' data: https:;
    font-src 'self' data:;
    connect-src 'self' https://moodle.example.com;
    frame-ancestors 'self';
    base-uri 'self';
    form-action 'self';
" always;
```

**Note:** `'unsafe-inline'` and `'unsafe-eval'` are required for React and Material-UI. For maximum security, consider implementing nonces or hashes (requires build configuration changes).

### Rate Limiting

**Nginx Rate Limiting:**

```nginx
# Define rate limit zone (in http block)
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;

# Apply rate limit to API endpoints
location /api/v1/ {
    limit_req zone=api_limit burst=20 nodelay;
    proxy_pass http://127.0.0.1:8080;
    # ... other proxy settings
}
```

**Apache Rate Limiting (mod_evasive):**

```bash
sudo apt-get install libapache2-mod-evasive
sudo a2enmod evasive
```

```apache
<IfModule mod_evasive20.c>
    DOSHashTableSize 3097
    DOSPageCount 10
    DOSSiteCount 100
    DOSPageInterval 1
    DOSSiteInterval 1
    DOSBlockingPeriod 10
</IfModule>
```

### Firewall Configuration

**Configure UFW (Ubuntu/Debian):**

```bash
# Allow SSH
sudo ufw allow 22/tcp

# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw enable
sudo ufw status
```

**Configure firewalld (CentOS/RHEL):**

```bash
# Allow HTTP and HTTPS
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https

# Reload firewall
sudo firewall-cmd --reload
```

### Intrusion Detection

**Install and configure fail2ban:**

```bash
# Install fail2ban
sudo apt-get install fail2ban

# Create custom jail for Nginx
sudo nano /etc/fail2ban/jail.local
```

```ini
[nginx-http-auth]
enabled = true
port = http,https
logpath = /var/log/nginx/moodle-react-error.log

[nginx-limit-req]
enabled = true
port = http,https
logpath = /var/log/nginx/moodle-react-error.log
```

```bash
# Restart fail2ban
sudo systemctl restart fail2ban
```

### Regular Security Updates

**Keep system and packages updated:**

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get upgrade

# CentOS/RHEL
sudo yum update
```

**Update Node.js and npm:**

```bash
# Update npm globally
sudo npm install -g npm@latest

# Update Node.js (via nvm)
nvm install 20 --reinstall-packages-from=20
```

**Update npm dependencies:**

```bash
cd react-frontend

# Check for outdated packages
npm outdated

# Update to latest compatible versions
npm update

# Audit for security vulnerabilities
npm audit
npm audit fix
```

---

## Verification and Testing

After completing environment setup, verify that everything is configured correctly.

### 1. Node.js and npm Verification

```bash
node --version   # Should show v20.x.x
npm --version    # Should show 9.x.x or 10.x.x
```

### 2. Environment Variables Verification

```bash
cd react-frontend

# Check that .env.production exists
ls -la .env*

# Build application
npm run build

# Verify environment variables are injected
grep -r "VITE_API_BASE_URL" dist/assets/*.js
```

### 3. SSL/TLS Certificate Verification

```bash
# Check certificate validity
openssl s_client -connect moodle.example.com:443 -servername moodle.example.com

# Check certificate expiration
echo | openssl s_client -connect moodle.example.com:443 2>/dev/null | openssl x509 -noout -dates

# Test with curl
curl -I https://moodle.example.com
```

### 4. Web Server Configuration Test

**Nginx:**

```bash
# Test configuration syntax
sudo nginx -t

# Check if service is running
sudo systemctl status nginx

# Test routing
curl -I https://moodle.example.com
curl -I https://moodle.example.com/api/v1/auth/me
```

**Apache:**

```bash
# Test configuration syntax
sudo apache2ctl configtest  # or httpd -t

# Check if service is running
sudo systemctl status apache2  # or httpd

# Test routing
curl -I https://moodle.example.com
```

### 5. CORS Verification

```bash
# Test CORS preflight
curl -X OPTIONS \
  -H "Origin: https://moodle.example.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type, Authorization" \
  -i \
  https://moodle.example.com/api/v1/courses

# Verify response includes:
# Access-Control-Allow-Origin: https://moodle.example.com
# Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
# Access-Control-Allow-Credentials: true
```

### 6. Application Functionality Test

**Manual Testing:**

1. Open browser and navigate to https://moodle.example.com
2. Open Browser DevTools (F12)
3. Check Console tab for JavaScript errors (should be none)
4. Check Network tab:
   - Verify static assets load (200 status)
   - Verify API requests work (200 or appropriate status)
   - Check CORS headers in responses
5. Test login functionality
6. Test navigation between pages
7. Test a complete user workflow (e.g., view course, submit assignment)

**Automated Testing:**

```bash
cd react-frontend

# Run unit tests
npm test

# Run E2E tests (requires application to be running)
npm run test:e2e
```

### 7. Performance Testing

**Run Lighthouse Audit:**

1. Open Chrome DevTools (F12)
2. Go to Lighthouse tab
3. Select "Performance" category
4. Click "Analyze page load"
5. **Target Score:** >90

**Command-line Lighthouse:**

```bash
npm install -g lighthouse

lighthouse https://moodle.example.com \
  --output html \
  --output-path ./lighthouse-report.html \
  --chrome-flags="--headless"
```

### 8. Security Testing

**Run security scan:**

- SSL Labs: https://www.ssllabs.com/ssltest/analyze.html?d=moodle.example.com
- Security Headers: https://securityheaders.com/?q=moodle.example.com
- Target: A or A+ rating

**Check for vulnerabilities:**

```bash
cd react-frontend
npm audit
```

### Verification Checklist

Use this checklist to confirm complete setup:

- [ ] Node.js 20.x LTS installed and verified
- [ ] npm 9+ installed and verified
- [ ] Environment variables configured in .env files
- [ ] SSL/TLS certificate installed and valid (3 months+ remaining)
- [ ] CORS configured in backend config.php
- [ ] Web server (Nginx or Apache) installed and configured
- [ ] Web server configuration tested (nginx -t or apache2ctl configtest)
- [ ] Static files served correctly from /dist/
- [ ] API proxy working (/api/v1/ routes to backend)
- [ ] SPA routing working (direct URL access doesn't 404)
- [ ] Security headers configured and verified
- [ ] HTTPS redirect working (HTTP → HTTPS)
- [ ] Gzip/Brotli compression enabled
- [ ] Asset caching headers configured
- [ ] Firewall configured (ports 80, 443 open)
- [ ] Application loads without errors in browser console
- [ ] Login functionality works
- [ ] API requests succeed (verified in Network tab)
- [ ] Lighthouse performance score >90
- [ ] SSL Labs rating A or A+
- [ ] No npm audit vulnerabilities (or acceptable risk accepted)

---

## Troubleshooting

### Issue: Node.js wrong version

**Symptom:** Build fails with "requires Node.js version 20.x" error

**Solution:**

```bash
# Check current version
node --version

# If using nvm, switch to Node 20
nvm install 20
nvm use 20
nvm alias default 20

# If not using nvm, reinstall Node.js 20 (see Node.js setup section)
```

### Issue: Environment variables not working

**Symptom:** `import.meta.env.VITE_API_BASE_URL` is undefined in application

**Solution:**

1. Verify VITE_ prefix:
   ```bash
   # Variables MUST start with VITE_
   # WRONG: API_BASE_URL=...
   # CORRECT: VITE_API_BASE_URL=...
   ```

2. Rebuild application (environment variables are injected at build time):
   ```bash
   npm run build
   ```

3. Check .env file location (must be in react-frontend/ root)

4. Verify correct mode used:
   ```bash
   npm run build -- --mode production  # Uses .env.production
   ```

### Issue: CORS errors in browser

**Symptom:** "Access-Control-Allow-Origin header is missing" error

**Solution:**

1. Verify CORS configuration in backend config.php
2. Check that origin is in whitelist:
   ```php
   $CFG->cors_allowed_origins = [
       'https://moodle.example.com',  // Must match exactly
   ];
   ```
3. Verify backend sends CORS headers:
   ```bash
   curl -H "Origin: https://moodle.example.com" -I https://moodle.example.com/api/v1/courses
   ```
4. Clear browser cache and retry

### Issue: SSL certificate errors

**Symptom:** "Your connection is not private" or certificate warnings

**Solution:**

1. Verify certificate files exist and are readable:
   ```bash
   ls -la /etc/letsencrypt/live/moodle.example.com/
   ```

2. Check certificate expiration:
   ```bash
   openssl x509 -in /etc/letsencrypt/live/moodle.example.com/fullchain.pem -noout -dates
   ```

3. Verify web server configuration points to correct certificate files

4. Renew certificate if expired:
   ```bash
   sudo certbot renew
   ```

### Issue: 404 errors on page refresh

**Symptom:** Direct URL access (https://moodle.example.com/courses) returns 404

**Solution:**

This is a common SPA routing issue. The web server must be configured to fallback to index.html.

**Nginx:**
```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

**Apache:**
```apache
RewriteEngine On
RewriteBase /
RewriteRule ^index\.html$ - [L]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.html [L]
```

### Issue: API proxy not working

**Symptom:** API requests return 502 Bad Gateway or Connection Refused

**Solution:**

1. Verify PHP backend is running:
   ```bash
   curl http://localhost:8080/api/v1/auth/me
   ```

2. Check proxy configuration in web server:
   ```nginx
   # Nginx
   location /api/v1/ {
       proxy_pass http://127.0.0.1:8080;  # Verify correct port
   }
   ```

3. Check firewall rules (localhost connections should be allowed)

4. Verify PHP-FPM or PHP backend is listening on correct port

### Issue: Build succeeds but application shows blank page

**Symptom:** White screen, no React application renders

**Solution:**

1. Check browser console for errors (F12)
2. Verify dist/index.html exists and assets/ directory is present
3. Check asset paths in index.html (should be relative)
4. Verify web server root points to dist/ directory
5. Check file permissions (files must be readable by web server)

### Issue: High memory usage during build

**Symptom:** "JavaScript heap out of memory" error during npm run build

**Solution:**

```bash
# Increase Node.js memory limit
NODE_OPTIONS="--max-old-space-size=4096" npm run build
```

---

## Additional Resources

### Official Documentation

- **Node.js:** https://nodejs.org/docs/
- **npm:** https://docs.npmjs.com/
- **Vite:** https://vitejs.dev/guide/
- **React:** https://react.dev/
- **Nginx:** https://nginx.org/en/docs/
- **Apache:** https://httpd.apache.org/docs/
- **Let's Encrypt:** https://letsencrypt.org/docs/

### Internal Documentation

- [Deployment Guide](./deployment-guide.md) - Complete deployment procedures
- [Build Process](./build-process.md) - Build optimization and configuration
- [Monitoring and Alerting](./monitoring-alerting.md) - Production monitoring setup
- [Troubleshooting Guide](./troubleshooting.md) - Common issues and solutions
- [Rollback Procedures](./rollback-procedures.md) - Emergency rollback steps

### Support

For additional support:
- Check main project README: `react-frontend/README.md`
- Contact DevOps team: devops@example.com
- Open issue in project repository
- Consult architecture documentation: `react-frontend/docs/architecture/`

---

**Document Version:** 1.0.0  
**Last Updated:** 2024-01-15  
**Maintainer:** DevOps Team
