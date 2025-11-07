# React Frontend Deployment Guide

## Table of Contents

1. [Deployment Overview](#deployment-overview)
2. [Nginx Configuration](#nginx-configuration)
3. [Apache Configuration](#apache-configuration)
4. [Docker Deployment](#docker-deployment)
5. [Deployment Procedures](#deployment-procedures)
6. [CI/CD Integration](#cicd-integration)
7. [Blue-Green Deployment Strategy](#blue-green-deployment-strategy)
8. [Feature Flags and Gradual Rollout](#feature-flags-and-gradual-rollout)
9. [Post-Deployment Validation](#post-deployment-validation)
10. [Troubleshooting](#troubleshooting)

---

## Deployment Overview

### Architecture Model

The React frontend is deployed as a **static Single Page Application (SPA)** with the following characteristics:

- **Static Asset Hosting**: All React build artifacts (HTML, JS, CSS, images) are served as static files
- **API Integration**: Backend API calls are proxied to the existing Moodle PHP backend at `/api/v1/*`
- **Client-Side Routing**: React Router handles navigation without server round-trips
- **Coexistence Model**: React and PHP frontends can coexist during the transition period using feature flags

### Deployment Models

**Option 1: Same Server Deployment**
- React frontend served from `/react/` path
- Existing Moodle served from root `/`
- Single domain with path-based routing
- Simplest for initial rollout

**Option 2: Subdomain Deployment**
- React frontend: `app.yourmoodle.com`
- API backend: `api.yourmoodle.com` or `yourmoodle.com/api/v1/`
- Requires CORS configuration
- Better separation of concerns

**Option 3: CDN Deployment**
- Static assets served from CDN (CloudFront, Cloudflare, etc.)
- API requests proxy to origin server
- Optimal performance and scalability
- Recommended for production at scale

### Infrastructure Requirements

**Web Server**: Nginx 1.18+ or Apache 2.4+
**Node.js**: Version 20.x LTS (for build process only, not runtime)
**Storage**: 50MB for production build artifacts
**Memory**: No additional requirements (static files)
**SSL/TLS**: Required for production (HTTPS only)

---

## Nginx Configuration

### Complete Nginx Configuration

Create or update `/etc/nginx/sites-available/moodle-react`:

```nginx
# Upstream for PHP backend API
upstream moodle_backend {
    server 127.0.0.1:8080;  # Adjust to your PHP-FPM setup
    keepalive 32;
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name yourmoodle.com www.yourmoodle.com;
    
    # Redirect all HTTP traffic to HTTPS
    return 301 https://$server_name$request_uri;
}

# Main React Frontend Server Block
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name yourmoodle.com www.yourmoodle.com;
    
    # SSL/TLS Configuration
    ssl_certificate /etc/ssl/certs/yourmoodle.com.crt;
    ssl_certificate_key /etc/ssl/private/yourmoodle.com.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;
    
    # Content Security Policy (adjust based on your requirements)
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://yourmoodle.com; frame-ancestors 'self';" always;
    
    # Root directory for React build
    root /var/www/moodle-react/dist;
    index index.html;
    
    # Character encoding
    charset utf-8;
    
    # Logging
    access_log /var/log/nginx/moodle-react-access.log;
    error_log /var/log/nginx/moodle-react-error.log warn;
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript application/json application/javascript application/xml+rss application/rss+xml font/truetype font/opentype application/vnd.ms-fontobject image/svg+xml;
    
    # Brotli compression (if brotli module is available)
    brotli on;
    brotli_comp_level 6;
    brotli_types text/plain text/css text/xml text/javascript application/json application/javascript application/xml+rss application/rss+xml font/truetype font/opentype application/vnd.ms-fontobject image/svg+xml;
    
    # API proxy to PHP backend
    location /api/v1/ {
        # Proxy headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Port $server_port;
        
        # Proxy timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # Buffer settings
        proxy_buffering on;
        proxy_buffer_size 4k;
        proxy_buffers 8 4k;
        proxy_busy_buffers_size 8k;
        
        # HTTP version and keepalive
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        
        # Pass to backend
        proxy_pass http://moodle_backend;
        
        # Don't cache API responses by default
        add_header Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate" always;
    }
    
    # Legacy PHP Moodle (during coexistence period)
    location /legacy/ {
        alias /var/www/moodle/public/;
        try_files $uri $uri/ /legacy/index.php?$query_string;
        
        location ~ \.php$ {
            include snippets/fastcgi-php.conf;
            fastcgi_pass unix:/var/run/php/php8.2-fpm.sock;
            fastcgi_param SCRIPT_FILENAME $request_filename;
        }
    }
    
    # Static assets with versioned filenames (cache aggressively)
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
        
        # CORS headers for fonts (if serving from different domain)
        if ($request_filename ~* \.(woff|woff2|ttf|eot)$) {
            add_header Access-Control-Allow-Origin "*";
        }
    }
    
    # Service worker (must not be cached)
    location = /service-worker.js {
        expires off;
        add_header Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate";
    }
    
    # Main SPA routing - all routes fall back to index.html
    location / {
        try_files $uri $uri/ /index.html;
        
        # Cache control for HTML (always revalidate)
        add_header Cache-Control "no-cache, must-revalidate";
        expires 0;
    }
    
    # Health check endpoint for load balancers
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
    
    # Deny access to hidden files
    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
    }
    
    # File upload size limit
    client_max_body_size 100M;
}
```

### Enable Configuration

```bash
# Create symbolic link to enable site
sudo ln -s /etc/nginx/sites-available/moodle-react /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

---

## Apache Configuration

### Complete Apache Configuration

Create or update `/etc/apache2/sites-available/moodle-react.conf`:

```apache
# Redirect HTTP to HTTPS
<VirtualHost *:80>
    ServerName yourmoodle.com
    ServerAlias www.yourmoodle.com
    
    # Redirect all HTTP to HTTPS
    Redirect permanent / https://yourmoodle.com/
</VirtualHost>

# Main React Frontend Virtual Host
<VirtualHost *:443>
    ServerName yourmoodle.com
    ServerAlias www.yourmoodle.com
    
    # SSL/TLS Configuration
    SSLEngine on
    SSLCertificateFile /etc/ssl/certs/yourmoodle.com.crt
    SSLCertificateKeyFile /etc/ssl/private/yourmoodle.com.key
    SSLCertificateChainFile /etc/ssl/certs/chain.crt
    
    # Modern SSL configuration
    SSLProtocol all -SSLv3 -TLSv1 -TLSv1.1
    SSLCipherSuite ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384
    SSLHonorCipherOrder off
    
    # Document root for React build
    DocumentRoot /var/www/moodle-react/dist
    
    <Directory /var/www/moodle-react/dist>
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted
        
        # Enable .htaccess for SPA routing
        <IfModule mod_rewrite.c>
            RewriteEngine On
            RewriteBase /
            
            # Don't rewrite files or directories that exist
            RewriteCond %{REQUEST_FILENAME} !-f
            RewriteCond %{REQUEST_FILENAME} !-d
            
            # Rewrite everything else to index.html
            RewriteRule ^ index.html [L]
        </IfModule>
    </Directory>
    
    # Security Headers
    <IfModule mod_headers.c>
        Header always set X-Frame-Options "SAMEORIGIN"
        Header always set X-Content-Type-Options "nosniff"
        Header always set X-XSS-Protection "1; mode=block"
        Header always set Referrer-Policy "strict-origin-when-cross-origin"
        Header always set Permissions-Policy "geolocation=(), microphone=(), camera=()"
        
        # Content Security Policy
        Header always set Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://yourmoodle.com; frame-ancestors 'self';"
    </IfModule>
    
    # API Proxy to PHP Backend
    <IfModule mod_proxy.c>
        ProxyPreserveHost On
        ProxyPass /api/v1/ http://localhost:8080/api/v1/
        ProxyPassReverse /api/v1/ http://localhost:8080/api/v1/
        
        # Proxy timeout settings
        ProxyTimeout 60
        
        # Don't cache API responses
        <Location /api/v1/>
            Header set Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate"
        </Location>
    </IfModule>
    
    # Legacy PHP Moodle (during coexistence period)
    Alias /legacy /var/www/moodle/public
    <Directory /var/www/moodle/public>
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted
        
        <IfModule mod_php.c>
            php_flag display_errors Off
            php_value upload_max_filesize 100M
            php_value post_max_size 100M
        </IfModule>
    </Directory>
    
    # Compression
    <IfModule mod_deflate.c>
        AddOutputFilterByType DEFLATE text/html text/plain text/xml text/css text/javascript
        AddOutputFilterByType DEFLATE application/json application/javascript application/xml application/rss+xml
        AddOutputFilterByType DEFLATE font/truetype font/opentype application/vnd.ms-fontobject image/svg+xml
    </IfModule>
    
    # Cache Control for Static Assets
    <IfModule mod_expires.c>
        ExpiresActive On
        
        # Versioned static assets (cache for 1 year)
        ExpiresByType text/css "access plus 1 year"
        ExpiresByType application/javascript "access plus 1 year"
        ExpiresByType image/png "access plus 1 year"
        ExpiresByType image/jpg "access plus 1 year"
        ExpiresByType image/jpeg "access plus 1 year"
        ExpiresByType image/gif "access plus 1 year"
        ExpiresByType image/svg+xml "access plus 1 year"
        ExpiresByType font/woff "access plus 1 year"
        ExpiresByType font/woff2 "access plus 1 year"
        ExpiresByType font/ttf "access plus 1 year"
        ExpiresByType font/eot "access plus 1 year"
        
        # HTML (always revalidate)
        ExpiresByType text/html "access plus 0 seconds"
    </IfModule>
    
    # Service Worker (must not be cached)
    <FilesMatch "service-worker\.js$">
        <IfModule mod_headers.c>
            Header set Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate"
        </IfModule>
    </FilesMatch>
    
    # File upload size limit
    LimitRequestBody 104857600
    
    # Logging
    ErrorLog ${APACHE_LOG_DIR}/moodle-react-error.log
    CustomLog ${APACHE_LOG_DIR}/moodle-react-access.log combined
</VirtualHost>
```

### .htaccess File

Create `/var/www/moodle-react/dist/.htaccess`:

```apache
<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteBase /
    
    # Don't rewrite files or directories that exist
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteCond %{REQUEST_FILENAME} !-d
    
    # Rewrite everything else to index.html for client-side routing
    RewriteRule ^ index.html [L]
</IfModule>

# Disable directory browsing
Options -Indexes

# Security headers (backup if not set in VirtualHost)
<IfModule mod_headers.c>
    Header set X-Frame-Options "SAMEORIGIN"
    Header set X-Content-Type-Options "nosniff"
    Header set X-XSS-Protection "1; mode=block"
</IfModule>
```

### Enable Configuration

```bash
# Enable required modules
sudo a2enmod rewrite
sudo a2enmod headers
sudo a2enmod expires
sudo a2enmod ssl
sudo a2enmod proxy
sudo a2enmod proxy_http
sudo a2enmod deflate

# Enable site configuration
sudo a2ensite moodle-react.conf

# Test configuration
sudo apachectl configtest

# Reload Apache
sudo systemctl reload apache2
```

---

## Docker Deployment

### Multi-Stage Dockerfile

Create `react-frontend/docker/Dockerfile`:

```dockerfile
# Build Stage
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies with clean install for reproducible builds
RUN npm ci --only=production=false

# Copy source code
COPY . .

# Build application
RUN npm run build

# Verify build output
RUN ls -la /app/dist

# Production Stage
FROM nginx:1.25-alpine

# Install additional tools for health checks
RUN apk add --no-cache curl

# Copy custom nginx configuration
COPY docker/nginx.conf /etc/nginx/nginx.conf
COPY docker/default.conf /etc/nginx/conf.d/default.conf

# Copy built application from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Create nginx user if not exists
RUN addgroup -g 101 -S nginx || true && \
    adduser -S -D -H -u 101 -h /var/cache/nginx -s /sbin/nologin -G nginx -g nginx nginx || true

# Set ownership
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chmod -R 755 /usr/share/nginx/html

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost/health || exit 1

# Run nginx
CMD ["nginx", "-g", "daemon off;"]
```

### Nginx Configuration for Docker

Create `react-frontend/docker/nginx.conf`:

```nginx
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
    use epoll;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';
    
    access_log /var/log/nginx/access.log main;
    
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    
    # Gzip Settings
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript application/json application/javascript application/xml+rss;
    
    # Include server configurations
    include /etc/nginx/conf.d/*.conf;
}
```

### Server Configuration for Docker

Create `react-frontend/docker/default.conf`:

```nginx
server {
    listen 80;
    server_name _;
    
    root /usr/share/nginx/html;
    index index.html;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # Static assets with caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # Service worker (no caching)
    location = /service-worker.js {
        expires off;
        add_header Cache-Control "no-store, no-cache, must-revalidate";
    }
    
    # SPA routing
    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache, must-revalidate";
    }
    
    # Health check
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
```

### Docker Compose for Local Testing

Create `react-frontend/docker-compose.yml`:

```yaml
version: '3.8'

services:
  react-frontend:
    build:
      context: .
      dockerfile: docker/Dockerfile
    container_name: moodle-react-frontend
    ports:
      - "3000:80"
    environment:
      - NODE_ENV=production
    networks:
      - moodle-network
    restart: unless-stopped
    labels:
      - "com.moodle.service=frontend"
      - "com.moodle.version=4.4.0-react"

  # Nginx reverse proxy (optional)
  nginx-proxy:
    image: nginx:1.25-alpine
    container_name: moodle-nginx-proxy
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./docker/proxy-nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - react-frontend
    networks:
      - moodle-network
    restart: unless-stopped

networks:
  moodle-network:
    driver: bridge
```

### Docker Build and Run Commands

```bash
# Build image
docker build -f docker/Dockerfile -t moodle-react-frontend:latest .

# Tag with version and git commit
VERSION=$(node -p "require('./package.json').version")
GIT_SHA=$(git rev-parse --short HEAD)
docker tag moodle-react-frontend:latest moodle-react-frontend:${VERSION}
docker tag moodle-react-frontend:latest moodle-react-frontend:${GIT_SHA}

# Run container
docker run -d \
  --name moodle-react-frontend \
  -p 3000:80 \
  --restart unless-stopped \
  moodle-react-frontend:latest

# Using docker-compose
docker-compose up -d

# View logs
docker logs -f moodle-react-frontend

# Stop container
docker stop moodle-react-frontend

# Remove container
docker rm moodle-react-frontend
```

---

## Deployment Procedures

### Pre-Deployment Checklist

- [ ] All tests passing (unit, integration, E2E)
- [ ] Code reviewed and approved
- [ ] Environment variables configured
- [ ] API endpoint verified in target environment
- [ ] SSL certificates valid and installed
- [ ] Backup of current deployment created
- [ ] Database migrations completed (if any)
- [ ] Rollback plan documented
- [ ] Stakeholders notified of deployment window

### Procedure 1: Manual Nginx Deployment

```bash
# Step 1: Build React application
cd react-frontend
npm ci
npm run build

# Step 2: Verify build output
ls -la dist/
# Should see: index.html, assets/, favicon.ico, etc.

# Step 3: Backup current deployment (if exists)
sudo mkdir -p /var/www/moodle-react/backups
sudo tar -czf /var/www/moodle-react/backups/backup-$(date +%Y%m%d-%H%M%S).tar.gz \
  /var/www/moodle-react/dist 2>/dev/null || true

# Step 4: Copy build to web server
sudo mkdir -p /var/www/moodle-react
sudo rm -rf /var/www/moodle-react/dist
sudo cp -r dist /var/www/moodle-react/

# Step 5: Set correct permissions
sudo chown -R www-data:www-data /var/www/moodle-react/dist
sudo find /var/www/moodle-react/dist -type d -exec chmod 755 {} \;
sudo find /var/www/moodle-react/dist -type f -exec chmod 644 {} \;

# Step 6: Test Nginx configuration
sudo nginx -t

# Step 7: Reload Nginx (zero downtime)
sudo systemctl reload nginx

# Step 8: Verify deployment
curl -I https://yourmoodle.com
# Should return 200 OK

# Step 9: Check application loads
curl https://yourmoodle.com | grep "<title>"
# Should see React app title
```

### Procedure 2: Manual Apache Deployment

```bash
# Step 1: Build React application
cd react-frontend
npm ci
npm run build

# Step 2: Backup current deployment
sudo mkdir -p /var/www/moodle-react/backups
sudo tar -czf /var/www/moodle-react/backups/backup-$(date +%Y%m%d-%H%M%S).tar.gz \
  /var/www/moodle-react/dist 2>/dev/null || true

# Step 3: Copy build to web server
sudo mkdir -p /var/www/moodle-react
sudo rm -rf /var/www/moodle-react/dist
sudo cp -r dist /var/www/moodle-react/
sudo cp .htaccess /var/www/moodle-react/dist/

# Step 4: Set correct permissions
sudo chown -R www-data:www-data /var/www/moodle-react/dist
sudo find /var/www/moodle-react/dist -type d -exec chmod 755 {} \;
sudo find /var/www/moodle-react/dist -type f -exec chmod 644 {} \;

# Step 5: Test Apache configuration
sudo apachectl configtest

# Step 6: Reload Apache (graceful restart)
sudo systemctl reload apache2

# Step 7: Verify deployment
curl -I https://yourmoodle.com
curl https://yourmoodle.com | grep "<title>"
```

### Procedure 3: Docker Deployment

```bash
# Step 1: Build Docker image
docker build -f docker/Dockerfile -t moodle-react-frontend:latest .

# Step 2: Tag image with version
VERSION=$(node -p "require('./package.json').version")
GIT_SHA=$(git rev-parse --short HEAD)
docker tag moodle-react-frontend:latest moodle-react-frontend:${VERSION}
docker tag moodle-react-frontend:latest moodle-react-frontend:${GIT_SHA}

# Step 3: Push to registry (if using private registry)
docker tag moodle-react-frontend:latest registry.yourmoodle.com/react-frontend:${VERSION}
docker push registry.yourmoodle.com/react-frontend:${VERSION}

# Step 4: Pull image on production server
ssh production-server
docker pull registry.yourmoodle.com/react-frontend:${VERSION}

# Step 5: Stop existing container
docker stop moodle-react-frontend || true
docker rm moodle-react-frontend || true

# Step 6: Run new container
docker run -d \
  --name moodle-react-frontend \
  -p 3000:80 \
  --restart unless-stopped \
  --env-file /opt/moodle/.env.production \
  registry.yourmoodle.com/react-frontend:${VERSION}

# Step 7: Verify container is running
docker ps | grep moodle-react-frontend
docker logs moodle-react-frontend

# Step 8: Health check
curl http://localhost:3000/health
```

### Post-Deployment Verification

After deploying, verify the following:

```bash
# 1. Check HTTP status codes
curl -I https://yourmoodle.com
# Expected: 200 OK

# 2. Verify index.html loads
curl -s https://yourmoodle.com | grep "<div id=\"root\">"
# Expected: Should find root div

# 3. Test static assets load
curl -I https://yourmoodle.com/assets/index-abc123.js
# Expected: 200 OK with Cache-Control header

# 4. Test API proxy
curl -I https://yourmoodle.com/api/v1/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN"
# Expected: 200 or 401 (confirms proxy works)

# 5. Test SPA routing (non-existent route should return index.html)
curl -I https://yourmoodle.com/courses/12345
# Expected: 200 OK (served from index.html)

# 6. Check logs for errors
# Nginx
sudo tail -f /var/log/nginx/moodle-react-error.log

# Apache
sudo tail -f /var/log/apache2/moodle-react-error.log

# Docker
docker logs -f moodle-react-frontend
```

---

## CI/CD Integration

### GitHub Actions Workflow

Create `.github/workflows/react-deploy.yml`:

```yaml
name: React Frontend Deploy

on:
  push:
    branches:
      - main
      - staging
      - develop
    paths:
      - 'react-frontend/**'
      - '.github/workflows/react-deploy.yml'
  pull_request:
    branches:
      - main
      - staging
    paths:
      - 'react-frontend/**'

env:
  NODE_VERSION: '20.x'
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}/react-frontend

jobs:
  # Build and Test Job
  build-and-test:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: react-frontend
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
          cache-dependency-path: react-frontend/package-lock.json
      
      - name: Install dependencies
        run: npm ci
      
      - name: Lint code
        run: npm run lint
      
      - name: Type check
        run: npm run type-check
      
      - name: Run unit tests
        run: npm run test -- --coverage --run
      
      - name: Upload coverage reports
        uses: codecov/codecov-action@v3
        with:
          files: ./react-frontend/coverage/coverage-final.json
          flags: unittests
      
      - name: Build application
        run: npm run build
        env:
          VITE_API_BASE_URL: ${{ secrets.API_BASE_URL }}
          VITE_APP_VERSION: ${{ github.sha }}
      
      - name: Upload build artifacts
        uses: actions/upload-artifact@v3
        with:
          name: react-build-${{ github.sha }}
          path: react-frontend/dist
          retention-days: 7
  
  # E2E Tests Job
  e2e-tests:
    runs-on: ubuntu-latest
    needs: build-and-test
    defaults:
      run:
        working-directory: react-frontend
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
          cache-dependency-path: react-frontend/package-lock.json
      
      - name: Install dependencies
        run: npm ci
      
      - name: Install Playwright browsers
        run: npx playwright install --with-deps
      
      - name: Download build artifacts
        uses: actions/download-artifact@v3
        with:
          name: react-build-${{ github.sha }}
          path: react-frontend/dist
      
      - name: Run E2E tests
        run: npm run test:e2e
        env:
          CI: true
      
      - name: Upload Playwright report
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: react-frontend/playwright-report
          retention-days: 7
  
  # Build Docker Image Job
  build-docker:
    runs-on: ubuntu-latest
    needs: [build-and-test, e2e-tests]
    if: github.event_name == 'push'
    permissions:
      contents: read
      packages: write
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3
      
      - name: Log in to Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      
      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=ref,event=branch
            type=sha,prefix={{branch}}-
            type=semver,pattern={{version}}
            type=raw,value=latest,enable={{is_default_branch}}
      
      - name: Build and push Docker image
        uses: docker/build-push-action@v5
        with:
          context: ./react-frontend
          file: ./react-frontend/docker/Dockerfile
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
  
  # Deploy to Staging
  deploy-staging:
    runs-on: ubuntu-latest
    needs: build-docker
    if: github.ref == 'refs/heads/staging' && github.event_name == 'push'
    environment:
      name: staging
      url: https://staging.yourmoodle.com
    
    steps:
      - name: Deploy to staging server
        uses: appleboy/ssh-action@v1.0.0
        with:
          host: ${{ secrets.STAGING_HOST }}
          username: ${{ secrets.STAGING_USER }}
          key: ${{ secrets.STAGING_SSH_KEY }}
          script: |
            cd /opt/moodle-react
            docker pull ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:staging-${{ github.sha }}
            docker stop moodle-react-frontend || true
            docker rm moodle-react-frontend || true
            docker run -d \
              --name moodle-react-frontend \
              -p 3000:80 \
              --restart unless-stopped \
              --env-file /opt/moodle/.env.staging \
              ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:staging-${{ github.sha }}
            
            # Health check
            sleep 5
            curl -f http://localhost:3000/health || exit 1
      
      - name: Run smoke tests
        run: |
          curl -f https://staging.yourmoodle.com/ || exit 1
          curl -f https://staging.yourmoodle.com/health || exit 1
  
  # Deploy to Production
  deploy-production:
    runs-on: ubuntu-latest
    needs: build-docker
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    environment:
      name: production
      url: https://yourmoodle.com
    
    steps:
      - name: Deploy to production server
        uses: appleboy/ssh-action@v1.0.0
        with:
          host: ${{ secrets.PRODUCTION_HOST }}
          username: ${{ secrets.PRODUCTION_USER }}
          key: ${{ secrets.PRODUCTION_SSH_KEY }}
          script: |
            cd /opt/moodle-react
            
            # Pull new image
            docker pull ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:main-${{ github.sha }}
            
            # Blue-green deployment
            CURRENT_COLOR=$(cat /opt/moodle-react/current-color.txt 2>/dev/null || echo "blue")
            if [ "$CURRENT_COLOR" = "blue" ]; then
              NEW_COLOR="green"
              NEW_PORT=3001
            else
              NEW_COLOR="blue"
              NEW_PORT=3000
            fi
            
            # Start new container
            docker run -d \
              --name moodle-react-frontend-$NEW_COLOR \
              -p $NEW_PORT:80 \
              --restart unless-stopped \
              --env-file /opt/moodle/.env.production \
              ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:main-${{ github.sha }}
            
            # Health check
            sleep 5
            curl -f http://localhost:$NEW_PORT/health || exit 1
            
            # Update load balancer to point to new color
            # (Implementation depends on your load balancer)
            
            # Wait for traffic to drain from old container
            sleep 30
            
            # Stop old container
            docker stop moodle-react-frontend-$CURRENT_COLOR || true
            docker rm moodle-react-frontend-$CURRENT_COLOR || true
            
            # Update current color
            echo $NEW_COLOR > /opt/moodle-react/current-color.txt
      
      - name: Run production smoke tests
        run: |
          curl -f https://yourmoodle.com/ || exit 1
          curl -f https://yourmoodle.com/health || exit 1
      
      - name: Notify deployment
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          text: 'React frontend deployed to production'
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}
        if: always()
```

### GitLab CI/CD Pipeline

Create `.gitlab-ci.yml`:

```yaml
stages:
  - build
  - test
  - package
  - deploy

variables:
  NODE_VERSION: "20"
  DOCKER_DRIVER: overlay2
  DOCKER_TLS_CERTDIR: "/certs"

# Build Job
build:
  stage: build
  image: node:20-alpine
  before_script:
    - cd react-frontend
    - npm ci
  script:
    - npm run lint
    - npm run type-check
    - npm run build
  artifacts:
    paths:
      - react-frontend/dist
    expire_in: 1 week
  cache:
    key: ${CI_COMMIT_REF_SLUG}
    paths:
      - react-frontend/node_modules
  only:
    changes:
      - react-frontend/**/*

# Unit Tests Job
test:unit:
  stage: test
  image: node:20-alpine
  before_script:
    - cd react-frontend
    - npm ci
  script:
    - npm run test -- --coverage --run
  coverage: '/All files[^|]*\|[^|]*\s+([\d\.]+)/'
  artifacts:
    reports:
      coverage_report:
        coverage_format: cobertura
        path: react-frontend/coverage/cobertura-coverage.xml
  cache:
    key: ${CI_COMMIT_REF_SLUG}
    paths:
      - react-frontend/node_modules
    policy: pull

# E2E Tests Job
test:e2e:
  stage: test
  image: mcr.microsoft.com/playwright:v1.40.0-focal
  before_script:
    - cd react-frontend
    - npm ci
  script:
    - npx playwright test
  artifacts:
    when: always
    paths:
      - react-frontend/playwright-report
    expire_in: 1 week
  dependencies:
    - build

# Docker Build Job
package:docker:
  stage: package
  image: docker:24
  services:
    - docker:24-dind
  before_script:
    - docker login -u $CI_REGISTRY_USER -p $CI_REGISTRY_PASSWORD $CI_REGISTRY
  script:
    - cd react-frontend
    - docker build -f docker/Dockerfile -t $CI_REGISTRY_IMAGE/react-frontend:$CI_COMMIT_SHORT_SHA .
    - docker tag $CI_REGISTRY_IMAGE/react-frontend:$CI_COMMIT_SHORT_SHA $CI_REGISTRY_IMAGE/react-frontend:latest
    - docker push $CI_REGISTRY_IMAGE/react-frontend:$CI_COMMIT_SHORT_SHA
    - docker push $CI_REGISTRY_IMAGE/react-frontend:latest
  only:
    - main
    - staging

# Deploy to Staging
deploy:staging:
  stage: deploy
  image: alpine:latest
  before_script:
    - apk add --no-cache openssh-client
    - eval $(ssh-agent -s)
    - echo "$STAGING_SSH_PRIVATE_KEY" | tr -d '\r' | ssh-add -
    - mkdir -p ~/.ssh
    - chmod 700 ~/.ssh
  script:
    - ssh -o StrictHostKeyChecking=no $STAGING_USER@$STAGING_HOST "
        docker pull $CI_REGISTRY_IMAGE/react-frontend:$CI_COMMIT_SHORT_SHA &&
        docker stop moodle-react-frontend || true &&
        docker rm moodle-react-frontend || true &&
        docker run -d
          --name moodle-react-frontend
          -p 3000:80
          --restart unless-stopped
          --env-file /opt/moodle/.env.staging
          $CI_REGISTRY_IMAGE/react-frontend:$CI_COMMIT_SHORT_SHA &&
        sleep 5 &&
        curl -f http://localhost:3000/health
      "
  environment:
    name: staging
    url: https://staging.yourmoodle.com
  only:
    - staging

# Deploy to Production
deploy:production:
  stage: deploy
  image: alpine:latest
  before_script:
    - apk add --no-cache openssh-client
    - eval $(ssh-agent -s)
    - echo "$PRODUCTION_SSH_PRIVATE_KEY" | tr -d '\r' | ssh-add -
    - mkdir -p ~/.ssh
    - chmod 700 ~/.ssh
  script:
    - ssh -o StrictHostKeyChecking=no $PRODUCTION_USER@$PRODUCTION_HOST "
        docker pull $CI_REGISTRY_IMAGE/react-frontend:$CI_COMMIT_SHORT_SHA &&
        /opt/moodle-react/blue-green-deploy.sh $CI_REGISTRY_IMAGE/react-frontend:$CI_COMMIT_SHORT_SHA
      "
  environment:
    name: production
    url: https://yourmoodle.com
  when: manual
  only:
    - main
```

---

## Blue-Green Deployment Strategy

### Overview

Blue-green deployment maintains two identical production environments:

- **Blue Environment**: Currently serving production traffic
- **Green Environment**: New version being deployed
- **Traffic Switch**: Instantaneous cutover from blue to green
- **Rollback**: Switch back to blue if issues detected

### Implementation Script

Create `/opt/moodle-react/blue-green-deploy.sh`:

```bash
#!/bin/bash
set -e

# Configuration
IMAGE=$1
HEALTH_CHECK_URL="http://localhost/health"
SMOKE_TEST_TIMEOUT=30
TRAFFIC_DRAIN_TIME=30

# Color management
CURRENT_COLOR=$(cat /opt/moodle-react/current-color.txt 2>/dev/null || echo "blue")

if [ "$CURRENT_COLOR" = "blue" ]; then
    NEW_COLOR="green"
    NEW_PORT=3001
    OLD_COLOR="blue"
    OLD_PORT=3000
else
    NEW_COLOR="blue"
    NEW_PORT=3000
    OLD_COLOR="green"
    OLD_PORT=3001
fi

echo "Current environment: $OLD_COLOR (port $OLD_PORT)"
echo "Deploying to: $NEW_COLOR (port $NEW_PORT)"

# Step 1: Pull new image
echo "Pulling Docker image: $IMAGE"
docker pull $IMAGE

# Step 2: Start new container
echo "Starting new container: moodle-react-frontend-$NEW_COLOR"
docker run -d \
    --name moodle-react-frontend-$NEW_COLOR \
    -p $NEW_PORT:80 \
    --restart unless-stopped \
    --env-file /opt/moodle/.env.production \
    --label deployment.color=$NEW_COLOR \
    --label deployment.timestamp=$(date +%s) \
    $IMAGE

# Step 3: Wait for container to be ready
echo "Waiting for container to be ready..."
sleep 5

# Step 4: Health check
echo "Running health check..."
RETRY_COUNT=0
MAX_RETRIES=10

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -f http://localhost:$NEW_PORT/health > /dev/null 2>&1; then
        echo "Health check passed"
        break
    fi
    
    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo "Health check attempt $RETRY_COUNT/$MAX_RETRIES failed, retrying..."
    sleep 3
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo "Health check failed after $MAX_RETRIES attempts"
    echo "Rolling back..."
    docker stop moodle-react-frontend-$NEW_COLOR
    docker rm moodle-react-frontend-$NEW_COLOR
    exit 1
fi

# Step 5: Smoke tests
echo "Running smoke tests..."
SMOKE_TEST_PASSED=true

# Test 1: Index page loads
if ! curl -f -s http://localhost:$NEW_PORT/ | grep -q "root"; then
    echo "Smoke test failed: index page not loading correctly"
    SMOKE_TEST_PASSED=false
fi

# Test 2: Static assets load
if ! curl -f -I http://localhost:$NEW_PORT/assets/ > /dev/null 2>&1; then
    echo "Warning: Static assets check inconclusive"
fi

# Test 3: API proxy responds (may return 401, but should not be 502/503)
API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$NEW_PORT/api/v1/auth/me)
if [ "$API_STATUS" = "502" ] || [ "$API_STATUS" = "503" ]; then
    echo "Smoke test failed: API proxy not working (status: $API_STATUS)"
    SMOKE_TEST_PASSED=false
fi

if [ "$SMOKE_TEST_PASSED" = false ]; then
    echo "Smoke tests failed, rolling back..."
    docker stop moodle-react-frontend-$NEW_COLOR
    docker rm moodle-react-frontend-$NEW_COLOR
    exit 1
fi

echo "Smoke tests passed"

# Step 6: Update load balancer / reverse proxy
echo "Updating load balancer to point to $NEW_COLOR environment..."

# For Nginx upstream
cat > /etc/nginx/conf.d/moodle-react-upstream.conf <<EOF
upstream moodle_react_frontend {
    server 127.0.0.1:$NEW_PORT;
}
EOF

# Test and reload Nginx
nginx -t && systemctl reload nginx

# Verify Nginx reload succeeded
if [ $? -ne 0 ]; then
    echo "Nginx reload failed, rolling back..."
    cat > /etc/nginx/conf.d/moodle-react-upstream.conf <<EOF
upstream moodle_react_frontend {
    server 127.0.0.1:$OLD_PORT;
}
EOF
    nginx -t && systemctl reload nginx
    docker stop moodle-react-frontend-$NEW_COLOR
    docker rm moodle-react-frontend-$NEW_COLOR
    exit 1
fi

echo "Traffic switched to $NEW_COLOR environment"

# Step 7: Monitor new deployment
echo "Monitoring new deployment for $SMOKE_TEST_TIMEOUT seconds..."
sleep $SMOKE_TEST_TIMEOUT

# Check if new container is still running
if ! docker ps | grep -q moodle-react-frontend-$NEW_COLOR; then
    echo "New container crashed, rolling back..."
    cat > /etc/nginx/conf.d/moodle-react-upstream.conf <<EOF
upstream moodle_react_frontend {
    server 127.0.0.1:$OLD_PORT;
}
EOF
    nginx -t && systemctl reload nginx
    exit 1
fi

# Step 8: Drain traffic from old environment
echo "Waiting $TRAFFIC_DRAIN_TIME seconds for traffic to drain from old environment..."
sleep $TRAFFIC_DRAIN_TIME

# Step 9: Stop old container
echo "Stopping old container: moodle-react-frontend-$OLD_COLOR"
docker stop moodle-react-frontend-$OLD_COLOR || true
docker rm moodle-react-frontend-$OLD_COLOR || true

# Step 10: Update current color
echo $NEW_COLOR > /opt/moodle-react/current-color.txt

# Step 11: Cleanup old images (keep last 3)
echo "Cleaning up old Docker images..."
docker images | grep moodle-react-frontend | tail -n +4 | awk '{print $3}' | xargs -r docker rmi || true

echo "Deployment completed successfully!"
echo "Active environment: $NEW_COLOR (port $NEW_PORT)"

# Step 12: Send notification (optional)
if [ -n "$SLACK_WEBHOOK_URL" ]; then
    curl -X POST -H 'Content-type: application/json' \
        --data "{\"text\":\"React frontend deployed to $NEW_COLOR environment\"}" \
        $SLACK_WEBHOOK_URL
fi

exit 0
```

### Make Script Executable

```bash
chmod +x /opt/moodle-react/blue-green-deploy.sh
```

### Rollback Procedure

If issues are detected after deployment:

```bash
#!/bin/bash
# rollback.sh

CURRENT_COLOR=$(cat /opt/moodle-react/current-color.txt)

if [ "$CURRENT_COLOR" = "blue" ]; then
    ROLLBACK_COLOR="green"
    ROLLBACK_PORT=3001
else
    ROLLBACK_COLOR="blue"
    ROLLBACK_PORT=3000
fi

echo "Rolling back to $ROLLBACK_COLOR environment (port $ROLLBACK_PORT)"

# Check if rollback container exists
if ! docker ps -a | grep -q moodle-react-frontend-$ROLLBACK_COLOR; then
    echo "Error: Rollback container not found"
    exit 1
fi

# Start rollback container if stopped
docker start moodle-react-frontend-$ROLLBACK_COLOR || true

# Wait for health check
sleep 5
if ! curl -f http://localhost:$ROLLBACK_PORT/health > /dev/null 2>&1; then
    echo "Error: Rollback container health check failed"
    exit 1
fi

# Update load balancer
cat > /etc/nginx/conf.d/moodle-react-upstream.conf <<EOF
upstream moodle_react_frontend {
    server 127.0.0.1:$ROLLBACK_PORT;
}
EOF

nginx -t && systemctl reload nginx

# Update current color
echo $ROLLBACK_COLOR > /opt/moodle-react/current-color.txt

echo "Rollback completed successfully"
echo "Active environment: $ROLLBACK_COLOR (port $ROLLBACK_PORT)"
```

---

## Feature Flags and Gradual Rollout

### Configuration in config.php

Add to `/path/to/moodle/config.php`:

```php
// React Frontend Feature Flags
$CFG->react_enabled = true;  // Master switch for React frontend

// Per-module feature flags
$CFG->react_features = [
    'auth' => true,           // Authentication (login/logout)
    'dashboard' => true,      // User dashboard
    'courses' => false,       // Course catalog and detail pages
    'assignments' => false,   // Assignment submission and grading
    'quizzes' => false,       // Quiz taking and review
    'forums' => false,        // Forum discussions
    'gradebook' => false,     // Gradebook viewing and editing
    'messaging' => false,     // Internal messaging system
    'admin' => false,         // Administration interfaces
    'profile' => false,       // User profiles
];

// Rollout strategy
$CFG->react_rollout_strategy = 'percentage';  // 'all', 'whitelist', 'percentage', 'role'

// Percentage-based rollout (0-100)
$CFG->react_rollout_percentage = 10;  // 10% of users see React interface

// User ID whitelist for testing
$CFG->react_rollout_whitelist = [
    2,    // Admin user
    15,   // Test user 1
    27,   // Test user 2
];

// Role-based rollout
$CFG->react_rollout_roles = [
    // 'student',  // Uncomment to enable for students
    // 'teacher',  // Uncomment to enable for teachers
    'manager',     // Enable for managers
];

// Force React for specific users (override all other settings)
$CFG->react_force_enabled_users = [2];  // Admin always sees React

// Force PHP for specific users (override all other settings)
$CFG->react_force_disabled_users = [];

// Allow users to switch between interfaces
$CFG->react_allow_user_toggle = true;

// Session cookie name for user preference
$CFG->react_preference_cookie = 'moodle_prefer_react';
```

### Rollout Helper Functions

Create `api/lib/feature_flags.php`:

```php
<?php
defined('MOODLE_INTERNAL') || die();

/**
 * Determine if React frontend should be shown to current user
 *
 * @return bool True if React should be shown
 */
function should_show_react_frontend() {
    global $CFG, $USER;
    
    // Master switch must be enabled
    if (empty($CFG->react_enabled)) {
        return false;
    }
    
    // Not logged in users always see PHP (login page is React already)
    if (!isloggedin() || isguestuser()) {
        return false;
    }
    
    $userid = $USER->id;
    
    // Check force enabled list
    if (isset($CFG->react_force_enabled_users) && 
        in_array($userid, $CFG->react_force_enabled_users)) {
        return true;
    }
    
    // Check force disabled list
    if (isset($CFG->react_force_disabled_users) && 
        in_array($userid, $CFG->react_force_disabled_users)) {
        return false;
    }
    
    // Check user preference cookie
    if (!empty($CFG->react_allow_user_toggle)) {
        if (isset($_COOKIE[$CFG->react_preference_cookie])) {
            return $_COOKIE[$CFG->react_preference_cookie] === 'true';
        }
    }
    
    // Apply rollout strategy
    $strategy = $CFG->react_rollout_strategy ?? 'all';
    
    switch ($strategy) {
        case 'all':
            return true;
        
        case 'whitelist':
            return in_array($userid, $CFG->react_rollout_whitelist ?? []);
        
        case 'percentage':
            $percentage = $CFG->react_rollout_percentage ?? 0;
            // Consistent hash-based selection
            $hash = crc32($userid . $CFG->wwwroot);
            return ($hash % 100) < $percentage;
        
        case 'role':
            $roles = $CFG->react_rollout_roles ?? [];
            $useroles = get_user_roles_in_course($USER->id);
            foreach ($userroles as $role) {
                if (in_array($role->shortname, $roles)) {
                    return true;
                }
            }
            return false;
        
        default:
            return false;
    }
}

/**
 * Check if specific feature is enabled in React frontend
 *
 * @param string $feature Feature name (e.g., 'courses', 'assignments')
 * @return bool True if feature is enabled
 */
function is_react_feature_enabled($feature) {
    global $CFG;
    
    if (!should_show_react_frontend()) {
        return false;
    }
    
    return !empty($CFG->react_features[$feature]);
}

/**
 * Get URL for React frontend or PHP fallback
 *
 * @param string $feature Feature name
 * @param string $reactpath React route path
 * @param string $phppath PHP page path
 * @return string Full URL
 */
function get_frontend_url($feature, $reactpath, $phppath) {
    global $CFG;
    
    if (is_react_feature_enabled($feature)) {
        return $CFG->wwwroot . '/#' . $reactpath;
    } else {
        return $CFG->wwwroot . '/' . $phppath;
    }
}
```

### Gradual Rollout Phases

**Phase 1: Authentication & Dashboard (Week 1-2)**
```php
$CFG->react_features = [
    'auth' => true,        // Login/logout
    'dashboard' => true,   // User dashboard
];
$CFG->react_rollout_percentage = 10;  // 10% of users
```

**Phase 2: Course Viewing (Week 3-4)**
```php
$CFG->react_features = [
    'auth' => true,
    'dashboard' => true,
    'courses' => true,     // Course catalog and detail
];
$CFG->react_rollout_percentage = 25;  // 25% of users
```

**Phase 3: Forums & Messaging (Week 5-6)**
```php
$CFG->react_features = [
    'auth' => true,
    'dashboard' => true,
    'courses' => true,
    'forums' => true,      // Forum discussions
    'messaging' => true,   // Internal messaging
];
$CFG->react_rollout_percentage = 50;  // 50% of users
```

**Phase 4: Assignments & Quizzes (Week 7-9)**
```php
$CFG->react_features = [
    'auth' => true,
    'dashboard' => true,
    'courses' => true,
    'forums' => true,
    'messaging' => true,
    'assignments' => true,  // Assignment submission
    'quizzes' => true,      // Quiz taking
];
$CFG->react_rollout_percentage = 75;  // 75% of users
```

**Phase 5: Gradebook & Admin (Week 10-12)**
```php
$CFG->react_features = [
    'auth' => true,
    'dashboard' => true,
    'courses' => true,
    'forums' => true,
    'messaging' => true,
    'assignments' => true,
    'quizzes' => true,
    'gradebook' => true,   // Gradebook viewing and editing
    'admin' => true,       // Administration interfaces
    'profile' => true,     // User profiles
];
$CFG->react_rollout_percentage = 100;  // All users
```

### User Toggle Interface

JavaScript snippet for user preference toggle:

```javascript
// Add to React app
function InterfaceToggle() {
  const [useReact, setUseReact] = useState(
    document.cookie.includes('moodle_prefer_react=true')
  );
  
  const handleToggle = () => {
    const newValue = !useReact;
    document.cookie = `moodle_prefer_react=${newValue}; path=/; max-age=31536000`;
    setUseReact(newValue);
    window.location.reload();
  };
  
  return (
    <Button onClick={handleToggle}>
      Switch to {useReact ? 'Classic' : 'New'} Interface
    </Button>
  );
}
```

---

## Post-Deployment Validation

### Health Check Endpoints

The React build includes a health check endpoint at `/health` that returns:

```
HTTP/1.1 200 OK
Content-Type: text/plain

healthy
```

### Automated Smoke Tests

Create `scripts/smoke-tests.sh`:

```bash
#!/bin/bash

BASE_URL=${1:-https://yourmoodle.com}
EXIT_CODE=0

echo "Running smoke tests against $BASE_URL"

# Test 1: Index page loads
echo -n "Test 1: Index page loads... "
if curl -f -s "$BASE_URL/" | grep -q "root"; then
    echo "PASS"
else
    echo "FAIL"
    EXIT_CODE=1
fi

# Test 2: Health check responds
echo -n "Test 2: Health check responds... "
if curl -f -s "$BASE_URL/health" | grep -q "healthy"; then
    echo "PASS"
else
    echo "FAIL"
    EXIT_CODE=1
fi

# Test 3: Static assets return 200
echo -n "Test 3: Static assets accessible... "
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/assets/")
if [ "$STATUS" = "200" ] || [ "$STATUS" = "403" ]; then
    echo "PASS"
else
    echo "FAIL (Status: $STATUS)"
    EXIT_CODE=1
fi

# Test 4: API proxy responds (may be 401, but not 502/503)
echo -n "Test 4: API proxy functional... "
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/v1/auth/me")
if [ "$STATUS" != "502" ] && [ "$STATUS" != "503" ] && [ "$STATUS" != "000" ]; then
    echo "PASS (Status: $STATUS)"
else
    echo "FAIL (Status: $STATUS)"
    EXIT_CODE=1
fi

# Test 5: SPA routing works (non-existent route should still return 200)
echo -n "Test 5: SPA routing works... "
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/nonexistent-route")
if [ "$STATUS" = "200" ]; then
    echo "PASS"
else
    echo "FAIL (Status: $STATUS)"
    EXIT_CODE=1
fi

# Test 6: Security headers present
echo -n "Test 6: Security headers present... "
HEADERS=$(curl -s -I "$BASE_URL/")
if echo "$HEADERS" | grep -q "X-Frame-Options" && \
   echo "$HEADERS" | grep -q "X-Content-Type-Options"; then
    echo "PASS"
else
    echo "FAIL"
    EXIT_CODE=1
fi

# Test 7: HTTPS redirect works
if [ "${BASE_URL:0:5}" = "https" ]; then
    echo -n "Test 7: HTTP redirects to HTTPS... "
    HTTP_URL="${BASE_URL/https/http}"
    REDIRECT=$(curl -s -I -L "$HTTP_URL" | grep -i location | head -1)
    if echo "$REDIRECT" | grep -q "https"; then
        echo "PASS"
    else
        echo "FAIL"
        EXIT_CODE=1
    fi
fi

if [ $EXIT_CODE -eq 0 ]; then
    echo ""
    echo "All smoke tests passed ✓"
else
    echo ""
    echo "Some smoke tests failed ✗"
fi

exit $EXIT_CODE
```

### Performance Monitoring

Monitor these metrics for 30 minutes after deployment:

**Application Metrics:**
- Response time (P50, P95, P99)
- Error rate (4xx, 5xx responses)
- Request throughput
- Memory usage
- CPU usage

**User Experience Metrics:**
- Page load time
- Time to Interactive (TTI)
- First Contentful Paint (FCP)
- Largest Contentful Paint (LCP)
- Cumulative Layout Shift (CLS)

**Monitoring Tools:**
- **Google Analytics**: Page views, user flows
- **Sentry**: Error tracking and crash reports
- **Datadog/New Relic**: APM and infrastructure monitoring
- **Grafana**: Custom dashboards for metrics
- **Prometheus**: Time-series metrics

### Validation Checklist

After deployment, verify:

- [ ] Index page loads without errors
- [ ] All static assets load correctly (check browser console)
- [ ] API calls are proxied correctly to backend
- [ ] User can log in successfully
- [ ] User dashboard displays data correctly
- [ ] Course pages load and display content
- [ ] Forms submit successfully (test enrollment, messaging)
- [ ] File uploads work (test assignment submission)
- [ ] Client-side routing works (navigate between pages)
- [ ] Browser back/forward buttons work correctly
- [ ] Deep links work (test bookmarked URLs)
- [ ] Mobile responsive design works on phone/tablet
- [ ] Accessibility: keyboard navigation works
- [ ] Accessibility: screen reader compatibility verified
- [ ] Performance: Lighthouse score >90
- [ ] Security headers present (check with security headers checker)
- [ ] HTTPS enforced (HTTP redirects to HTTPS)
- [ ] No console errors or warnings in production
- [ ] Error tracking (Sentry) receiving events
- [ ] Analytics (Google Analytics) tracking page views

### Rollback Decision Criteria

Rollback immediately if:

- Error rate increases >5% compared to baseline
- Response time P95 increases >50% compared to baseline
- Health check fails for >2 minutes
- Critical user flows broken (login, course access, submission)
- Database connection issues
- API proxy returning 502/503 errors consistently
- Memory leak detected (memory usage growing continuously)

### User Feedback Channels

Set up feedback mechanisms:

1. **In-App Feedback Button**: "Report Issue" button in React app
2. **User Survey**: Post-deployment survey for early adopters
3. **Support Tickets**: Monitor helpdesk for deployment-related issues
4. **Community Forums**: Watch for user complaints or issues
5. **Analytics**: Track user behavior and drop-off points

---

## Troubleshooting

### Common Issues and Solutions

**Issue 1: 404 Errors for Static Assets**

**Symptoms:**
- Console shows 404 errors for JS/CSS files
- Page shows blank white screen

**Solution:**
```bash
# Check file permissions
ls -la /var/www/moodle-react/dist/assets/
# Should be readable by web server user

# Fix permissions
sudo chown -R www-data:www-data /var/www/moodle-react/dist
sudo find /var/www/moodle-react/dist -type f -exec chmod 644 {} \;
sudo find /var/www/moodle-react/dist -type d -exec chmod 755 {} \;

# Check nginx/apache config points to correct directory
# Nginx: root /var/www/moodle-react/dist;
# Apache: DocumentRoot /var/www/moodle-react/dist
```

**Issue 2: API Calls Returning 502 Bad Gateway**

**Symptoms:**
- API calls fail with 502 error
- Backend API is not reachable

**Solution:**
```bash
# Check backend is running
sudo systemctl status php8.2-fpm
curl http://localhost:8080/api/v1/auth/me

# Check proxy configuration
# Nginx: proxy_pass should point to correct backend
# Apache: ProxyPass should point to correct backend

# Check firewall
sudo ufw status
sudo ufw allow 8080  # If backend is on 8080

# Check backend logs
sudo tail -f /var/log/php8.2-fpm.log
sudo tail -f /var/www/moodle/storage/logs/moodle.log
```

**Issue 3: CORS Errors in Browser Console**

**Symptoms:**
- Console shows "CORS policy blocked" errors
- API calls fail from React app

**Solution:**
```bash
# Add CORS headers in Nginx
location /api/v1/ {
    add_header Access-Control-Allow-Origin https://yourmoodle.com always;
    add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
    add_header Access-Control-Allow-Headers "Authorization, Content-Type" always;
    
    if ($request_method = OPTIONS) {
        return 204;
    }
    
    proxy_pass http://moodle_backend;
}

# Or add CORS headers in Apache
<Location /api/v1/>
    Header always set Access-Control-Allow-Origin "https://yourmoodle.com"
    Header always set Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS"
    Header always set Access-Control-Allow-Headers "Authorization, Content-Type"
</Location>

# Reload web server
sudo systemctl reload nginx  # or apache2
```

**Issue 4: Client-Side Routing Not Working (404 on Refresh)**

**Symptoms:**
- Direct URLs return 404 error
- Refreshing page shows 404
- Works when navigating from home page

**Solution:**
```bash
# Nginx: Verify try_files directive
location / {
    try_files $uri $uri/ /index.html;
}

# Apache: Verify .htaccess has rewrite rules
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^ index.html [L]

# Ensure mod_rewrite is enabled (Apache)
sudo a2enmod rewrite
sudo systemctl reload apache2
```

**Issue 5: Docker Container Keeps Restarting**

**Symptoms:**
- Container status shows restarting
- Health checks failing

**Solution:**
```bash
# Check container logs
docker logs moodle-react-frontend

# Check if port is already in use
sudo netstat -tlnp | grep :3000

# Verify image built correctly
docker run -it moodle-react-frontend:latest /bin/sh
ls -la /usr/share/nginx/html  # Should see dist files

# Check nginx config inside container
docker exec moodle-react-frontend nginx -t

# Rebuild image if necessary
docker build --no-cache -f docker/Dockerfile -t moodle-react-frontend:latest .
```

**Issue 6: Environment Variables Not Loading**

**Symptoms:**
- React app can't connect to API
- API_BASE_URL is undefined

**Solution:**
```bash
# Environment variables must be prefixed with VITE_ and set at build time
# .env.production file:
VITE_API_BASE_URL=https://yourmoodle.com/api/v1
VITE_APP_NAME=Moodle

# Rebuild with environment variables
npm run build

# For Docker, pass build args:
docker build \
  --build-arg VITE_API_BASE_URL=https://yourmoodle.com/api/v1 \
  -f docker/Dockerfile \
  -t moodle-react-frontend:latest .
```

**Issue 7: Performance Issues (Slow Loading)**

**Symptoms:**
- Page takes >5 seconds to load
- Large bundle size
- Poor Lighthouse score

**Solution:**
```bash
# Analyze bundle size
npm run build
npx vite-bundle-visualizer

# Enable compression (Nginx)
gzip on;
gzip_types text/plain text/css application/json application/javascript;

# Enable compression (Apache)
sudo a2enmod deflate
<IfModule mod_deflate.c>
    AddOutputFilterByType DEFLATE text/html text/plain text/css application/javascript
</IfModule>

# Enable caching for static assets
# Nginx:
location ~* \.(js|css|png|jpg|jpeg|gif|ico)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}

# Consider using CDN for static assets
```

### Getting Help

If issues persist:

1. Check application logs: `sudo tail -f /var/log/nginx/moodle-react-error.log`
2. Check browser console for JavaScript errors
3. Check network tab for failed requests
4. Review deployment checklist above
5. Consult Moodle community forums
6. File issue in project repository with:
   - Environment details (OS, web server, Node version)
   - Error messages and stack traces
   - Steps to reproduce
   - Expected vs actual behavior

---

## Conclusion

This deployment guide provides comprehensive procedures for deploying the Moodle React frontend to production environments. Key takeaways:

- **Static SPA Deployment**: React build artifacts served as static files with API proxy to backend
- **Multiple Deployment Options**: Nginx, Apache, or Docker containerization
- **Zero-Downtime Deployments**: Blue-green strategy ensures no service interruption
- **Gradual Rollout**: Feature flags enable phased adoption and easy rollback
- **Comprehensive Monitoring**: Post-deployment validation ensures quality and performance

For questions or issues, refer to the troubleshooting section or consult the development team.

---

**Document Version**: 1.0  
**Last Updated**: 2024-01-15  
**Maintained By**: Moodle React Frontend Team
