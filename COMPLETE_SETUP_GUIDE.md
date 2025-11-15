# Complete Setup Guide - Moodle React Refactoring Project

## Table of Contents
1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Initial Setup](#initial-setup)
4. [Service Configuration](#service-configuration)
5. [Development Workflow](#development-workflow)
6. [Testing](#testing)
7. [Troubleshooting](#troubleshooting)
8. [Production Deployment](#production-deployment)

## Overview

This project is a PHP to React refactoring of Moodle LMS, maintaining 100% backward compatibility with all existing Moodle functionality while introducing a modern React 18 + TypeScript single-page application frontend.

**Architecture**:
- **Frontend**: React 18.2 + TypeScript 5.3 + Material-UI v5 + Redux Toolkit + React Query
- **Backend**: PHP 8.3 + Moodle core functions + RESTful JSON API layer
- **Database**: MariaDB 10.11 with existing Moodle schema (489 tables)
- **Build Tools**: Vite 5.4 (frontend), Composer (backend)
- **Testing**: Vitest (unit), Playwright (E2E)

**Current Status**: ✅ Infrastructure 100% operational, application implementation in progress

## Prerequisites

### System Requirements
- **Operating System**: Ubuntu 22.04+ (or compatible Linux distribution)
- **RAM**: 4GB minimum, 8GB recommended
- **Storage**: 10GB available space
- **Network**: Internet connection for dependency installation

### Required Software
```bash
# PHP 8.3 with extensions
php 8.3.6 (cli)
# Required extensions: mysqli, mbstring, curl, openssl, gd, zip, xml, intl, sodium

# Node.js and npm
node v20.19.5 (LTS)
npm 10.8.2

# Database
mariadb 10.11.13

# Web Server
apache2 2.4.58
```

## Initial Setup

### 1. Clone Repository
```bash
git clone <repository-url>
cd blitzy-moodle
git checkout blitzy-d6458eda-ba63-4141-ae9f-e60c7710f352
```

### 2. Install PHP Dependencies
```bash
# Install Composer (if not already installed)
curl -sS https://getcomposer.org/installer | php
sudo mv composer.phar /usr/local/bin/composer

# Install project dependencies
composer install

# Verify installation
composer show | grep firebase/php-jwt
# Should show: firebase/php-jwt 6.10.x
```

### 3. Install Node.js Dependencies
```bash
cd react-frontend

# Install dependencies
npm install

# Verify installation
npm list --depth=0 | grep -E "react|typescript|vite"
# Should show:
# react@18.2.0
# typescript@5.3.3
# vite@5.4.21
```

### 4. Configure Database
```bash
# Install MariaDB
sudo apt-get update
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y mariadb-server mariadb-client

# Start MariaDB
sudo service mariadb start

# Create database and user
sudo mysql -u root <<EOF
CREATE DATABASE moodle DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'moodle'@'localhost' IDENTIFIED BY 'moodle';
GRANT ALL PRIVILEGES ON moodle.* TO 'moodle'@'localhost';
FLUSH PRIVILEGES;
EOF

# Verify connection
mysql -h localhost -u moodle -pmoodle -D moodle -e "SELECT 'Database OK' as status;"
```

### 5. Create Moodle Configuration
```bash
# Copy template
cp config-dist.php config.php

# Edit config.php with your settings:
# - Database credentials (moodle/moodle)
# - Web root URL (http://localhost)
# - Data directory (/tmp/moodledata)
# - JWT secret (generate 64-character random string)

# Create data directory
sudo mkdir -p /tmp/moodledata
sudo chmod 777 /tmp/moodledata
```

### 6. Install Moodle Database Schema
```bash
# Ensure max_input_vars is set
echo "max_input_vars = 5000" | sudo tee /etc/php/8.3/cli/conf.d/99-moodle.ini

# Run Moodle installer
php admin/cli/install_database.php \
  --agree-license \
  --adminuser=admin \
  --adminpass=Admin123! \
  --adminemail=admin@example.com \
  --fullname="Moodle React Refactor" \
  --shortname="MoodleReact" \
  --lang=en

# Verify installation (should show 489 tables)
mysql -h localhost -u moodle -pmoodle -D moodle \
  -e "SELECT COUNT(*) as tables FROM information_schema.tables WHERE table_schema = 'moodle';"
```

## Service Configuration

### Apache Web Server Setup

#### 1. Create Virtual Host Configuration
```bash
sudo tee /etc/apache2/sites-available/moodle.conf > /dev/null <<'EOF'
<VirtualHost *:80>
    ServerAdmin admin@localhost
    DocumentRoot /tmp/blitzy/blitzy-moodle/blitzyd6458edab

    <Directory /tmp/blitzy/blitzy-moodle/blitzyd6458edab>
        Options Indexes FollowSymLinks
        AllowOverride All
        Require all granted
        
        # API rewrite rules
        RewriteEngine On
        RewriteBase /
        
        # Route API requests to api/index.php
        RewriteCond %{REQUEST_URI} ^/api/v1/
        RewriteRule ^api/v1/(.*)$ api/index.php?endpoint=$1 [QSA,L]
    </Directory>

    # Logging
    ErrorLog ${APACHE_LOG_DIR}/moodle-error.log
    CustomLog ${APACHE_LOG_DIR}/moodle-access.log combined
</VirtualHost>
EOF
```

#### 2. Enable Apache Modules and Site
```bash
# Enable required modules
sudo a2enmod rewrite
sudo a2enmod php8.3
sudo a2enmod headers

# Enable the site
sudo a2ensite moodle.conf

# Disable default site (optional)
sudo a2dissite 000-default.conf

# Test configuration
sudo apache2ctl configtest
# Should output: Syntax OK

# Restart Apache
sudo service apache2 restart

# Verify Apache is running
sudo service apache2 status | grep Active
# Should show: Active: active (running)
```

#### 3. Verify Apache Configuration
```bash
# Test PHP processing
curl -s http://localhost/index.php | head -20
# Should show HTML content or Moodle error (not "file not found")

# Check Apache logs for errors
sudo tail -20 /var/log/apache2/moodle-error.log
```

### React Development Server Setup

#### 1. Start Development Server
```bash
cd /tmp/blitzy/blitzy-moodle/blitzyd6458edab/react-frontend

# Start in background with logging
npm run dev > /tmp/react-dev-server.log 2>&1 &

# Save PID for later
echo $! > /tmp/react-dev-server.pid

# Wait for startup
sleep 3

# Verify server is running
curl -s -o /dev/null -w "HTTP %{http_code}\n" http://localhost:5173
# Should output: HTTP 200
```

#### 2. Check Development Server Status
```bash
# View logs
tail -20 /tmp/react-dev-server.log

# Check if process is running
ps aux | grep vite | grep -v grep

# Test frontend accessibility
curl -s http://localhost:5173 | grep -o "<title>.*</title>"
# Should output: <title>Moodle React Frontend</title> (or similar)
```

#### 3. Stop Development Server
```bash
# Kill by PID
kill $(cat /tmp/react-dev-server.pid)

# Or kill all Vite processes
pkill -f "vite"

# Verify stopped
ps aux | grep vite | grep -v grep
# Should output nothing
```

### Service Management Script

Create a helper script for managing all services:

```bash
sudo tee /usr/local/bin/moodle-services > /dev/null <<'EOF'
#!/bin/bash

REACT_DIR="/tmp/blitzy/blitzy-moodle/blitzyd6458edab/react-frontend"
REACT_LOG="/tmp/react-dev-server.log"
REACT_PID="/tmp/react-dev-server.pid"

case "$1" in
  start)
    echo "Starting Moodle services..."
    service mariadb start
    service apache2 start
    cd $REACT_DIR && npm run dev > $REACT_LOG 2>&1 &
    echo $! > $REACT_PID
    echo "✅ All services started"
    ;;
  stop)
    echo "Stopping Moodle services..."
    pkill -f "vite"
    service apache2 stop
    service mariadb stop
    echo "✅ All services stopped"
    ;;
  restart)
    $0 stop
    sleep 2
    $0 start
    ;;
  status)
    echo "=== Moodle Service Status ==="
    echo ""
    echo "MariaDB:"
    mysql -h localhost -u moodle -pmoodle -D moodle -e "SELECT 'OK' as status;" 2>&1
    echo ""
    echo "Apache:"
    curl -s -o /dev/null -w "  HTTP %{http_code}\n" http://localhost/index.php
    echo ""
    echo "React Dev Server:"
    curl -s -o /dev/null -w "  HTTP %{http_code}\n" http://localhost:5173
    ;;
  *)
    echo "Usage: $0 {start|stop|restart|status}"
    exit 1
    ;;
esac
EOF

# Make executable
sudo chmod +x /usr/local/bin/moodle-services

# Usage examples:
# moodle-services start
# moodle-services stop
# moodle-services restart
# moodle-services status
```

## Development Workflow

### Daily Development Routine

#### 1. Start Services
```bash
moodle-services start
# Or manually:
service mariadb start
service apache2 start
cd react-frontend && npm run dev > /tmp/react-dev-server.log 2>&1 &
```

#### 2. Verify Everything is Running
```bash
moodle-services status
# Should show:
# MariaDB: OK
# Apache: HTTP 200 or 404 (both mean it's working)
# React: HTTP 200
```

#### 3. Development Access URLs
- **React Frontend**: http://localhost:5173
- **PHP Backend**: http://localhost
- **API Endpoints**: http://localhost/api/v1/*
- **Database**: localhost:3306 (moodle/moodle)

#### 4. Make Code Changes
```bash
# Frontend changes (auto-reload via HMR)
cd react-frontend/src
# Edit any .tsx or .ts file
# Browser automatically refreshes

# Backend changes (requires manual reload)
cd api/v1
# Edit any .php file
# No restart needed, PHP reloads on each request
```

#### 5. Run Tests During Development
```bash
# Unit tests (watch mode)
cd react-frontend
npm run test -- --watch

# Specific test file
npm run test -- auth.spec.ts

# E2E tests (specific browser)
npm run test:e2e -- --project=chromium

# Type checking
npm run type-check
```

### Git Workflow

#### Commit Changes
```bash
# Check status
git status

# Stage changes (only non-temporary files)
git add <file>

# Commit
git commit -m "feat: description of changes"

# Push
git push origin blitzy-d6458eda-ba63-4141-ae9f-e60c7710f352
```

#### Files to NEVER Commit
- `config.php` (contains credentials)
- `node_modules/` (managed by npm)
- `vendor/` (managed by Composer)
- `.env.local`, `.env.development.local` (local env files)
- `/tmp/react-dev-server.log` (runtime logs)

### Code Quality Checks

#### Before Committing
```bash
cd react-frontend

# Run linter
npm run lint
# Fix auto-fixable issues
npm run lint:fix

# Format code
npm run format

# Type check
npm run type-check

# Run tests
npm run test
```

## Testing

### Unit Tests (Vitest)

#### Run All Unit Tests
```bash
cd react-frontend
npm run test

# With coverage
npm run coverage

# Watch mode
npm run test -- --watch

# Specific file
npm run test -- src/features/auth/components/LoginForm.test.tsx
```

#### Expected Results
- **Total Tests**: 2075
- **Pass Rate**: 99.5%+ (2063+ passing)
- **Failed**: <12 tests (known source code bugs)

#### Common Unit Test Issues
1. **Component Behavior Mismatches**: Test expects old behavior after component refactor
   - **Solution**: Update test to match new component behavior
   
2. **Missing Mocks**: Test fails because API call is not mocked
   - **Solution**: Add MSW handler for API endpoint

### E2E Tests (Playwright)

#### Run E2E Tests
```bash
cd react-frontend

# All tests, all browsers
npm run test:e2e

# Specific browser
npm run test:e2e -- --project=chromium
npm run test:e2e -- --project=firefox
npm run test:e2e -- --project=webkit

# Specific test file
npm run test:e2e -- auth.spec.ts

# Headed mode (see browser)
npm run test:e2e -- --headed

# Debug mode (step through)
npm run test:e2e -- --debug

# UI mode (interactive)
npm run test:e2e:ui
```

#### Expected Results
- **Infrastructure Tests**: Should all pass (proves services are running)
- **Feature Tests**: May fail if features not yet implemented
- **Current Status**: 9/24 passing in auth.spec.ts (37.5%)

#### E2E Test Troubleshooting

**Issue**: Tests fail with "connect ECONNREFUSED"
```bash
# Solution: Ensure all services are running
moodle-services status
# If any service shows error, restart:
moodle-services restart
```

**Issue**: Tests fail with "Timeout waiting for element"
```bash
# Possible causes:
# 1. React dev server not started
# 2. Component not rendering
# 3. API endpoint returning error

# Debug steps:
# 1. Check React dev server logs
tail -50 /tmp/react-dev-server.log

# 2. Check Apache error logs
sudo tail -50 /var/log/apache2/moodle-error.log

# 3. Run test in headed mode to see what's happening
npm run test:e2e -- auth.spec.ts --headed --project=chromium
```

**Issue**: API returns 404
```bash
# This is expected if endpoint not yet implemented
# Check which endpoints are implemented:
find api/v1 -name "*.php" -type f

# Implement missing endpoint or update test to skip
```

### Test Coverage Goals
- **Unit Tests**: 90%+ coverage for critical business logic
- **E2E Tests**: All critical user journeys covered (login, enrollment, submission, grading, etc.)
- **Accessibility Tests**: WCAG 2.1 AA compliance verified

## Troubleshooting

### Database Connection Issues

**Symptom**: "Can't connect to MySQL server"
```bash
# Check if MariaDB is running
service mariadb status

# If not running, start it
service mariadb start

# Test connection
mysql -h localhost -u moodle -pmoodle -D moodle -e "SELECT 1;"

# If connection fails, verify credentials in config.php
grep -A 5 "dbtype" config.php
```

**Symptom**: "Access denied for user"
```bash
# Reset database user permissions
sudo mysql -u root <<EOF
DROP USER IF EXISTS 'moodle'@'localhost';
CREATE USER 'moodle'@'localhost' IDENTIFIED BY 'moodle';
GRANT ALL PRIVILEGES ON moodle.* TO 'moodle'@'localhost';
FLUSH PRIVILEGES;
EOF
```

### Apache Issues

**Symptom**: "Connection refused" on port 80
```bash
# Check if Apache is running
service apache2 status

# If not running, start it
service apache2 start

# Check for port conflicts
netstat -tlnp | grep :80

# If another process is using port 80, stop it or change Apache port
```

**Symptom**: "403 Forbidden"
```bash
# Check directory permissions
ls -ld /tmp/blitzy/blitzy-moodle/blitzyd6458edab

# Should be readable by www-data user
# Fix permissions if needed:
sudo chmod 755 /tmp/blitzy/blitzy-moodle/blitzyd6458edab
```

**Symptom**: PHP files download instead of executing
```bash
# Check if PHP module is enabled
apache2ctl -M | grep php

# If not shown, enable it:
sudo a2enmod php8.3
sudo service apache2 restart
```

### React Dev Server Issues

**Symptom**: "Port 5173 already in use"
```bash
# Find and kill existing process
lsof -ti:5173 | xargs kill -9

# Or kill all Vite processes
pkill -f "vite"

# Start server again
cd react-frontend && npm run dev
```

**Symptom**: "Cannot find module" errors
```bash
# Reinstall dependencies
cd react-frontend
rm -rf node_modules package-lock.json
npm install
```

**Symptom**: HMR not working (changes don't auto-reload)
```bash
# This is usually a filesystem watcher issue
# Solution: Restart dev server
pkill -f "vite"
cd react-frontend && npm run dev
```

### Build Issues

**Symptom**: TypeScript compilation errors
```bash
# Check for type errors
cd react-frontend
npm run type-check

# Common fixes:
# 1. Missing type definitions
npm install --save-dev @types/<package-name>

# 2. Outdated dependencies
npm update

# 3. Cache issues
rm -rf node_modules/.vite
npm run type-check
```

**Symptom**: Production build fails
```bash
# Clear cache and rebuild
cd react-frontend
rm -rf dist node_modules/.vite
npm run build

# Check for errors in output
# Common issues:
# - Missing environment variables
# - Import path errors
# - Type errors not caught in dev mode
```

### Performance Issues

**Symptom**: Slow page loads
```bash
# Check database query performance
# Enable MySQL slow query log
sudo mysql -u root <<EOF
SET GLOBAL slow_query_log = 'ON';
SET GLOBAL long_query_time = 1;
SET GLOBAL slow_query_log_file = '/var/log/mysql/slow-query.log';
EOF

# Monitor slow queries
sudo tail -f /var/log/mysql/slow-query.log
```

**Symptom**: High memory usage
```bash
# Check memory usage
free -h

# Check process memory
ps aux --sort=-%mem | head -10

# Common causes:
# - Too many zombie processes (kill them)
# - Memory leak in Node.js (restart dev server)
# - Too many open database connections (restart services)
```

## Production Deployment

### Pre-Deployment Checklist

- [ ] All unit tests passing (>90% pass rate)
- [ ] All E2E tests passing for implemented features
- [ ] TypeScript compilation with zero errors
- [ ] Production build succeeds
- [ ] No console errors in browser
- [ ] Lighthouse performance score >90
- [ ] WCAG 2.1 AA accessibility verified
- [ ] Security audit completed
- [ ] Database backups configured
- [ ] SSL/TLS certificates installed
- [ ] Environment variables configured
- [ ] Monitoring and alerting setup

### Production Environment Setup

#### 1. Database Configuration
```bash
# Use production database credentials
# DO NOT use moodle/moodle in production!

# Create production database
mysql -u root -p <<EOF
CREATE DATABASE moodle_prod DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'moodle_prod'@'localhost' IDENTIFIED BY 'STRONG_PASSWORD_HERE';
GRANT ALL PRIVILEGES ON moodle_prod.* TO 'moodle_prod'@'localhost';
FLUSH PRIVILEGES;
EOF

# Update config.php with production credentials
```

#### 2. Build React Frontend for Production
```bash
cd react-frontend

# Set production environment variables
export NODE_ENV=production
export VITE_API_BASE_URL=https://your-domain.com

# Build
npm run build

# Output will be in react-frontend/dist/
# Deploy these static files to CDN or web server
```

#### 3. Configure Apache for Production
```bash
# Create production virtual host
sudo tee /etc/apache2/sites-available/moodle-prod.conf > /dev/null <<'EOF'
<VirtualHost *:443>
    ServerName your-domain.com
    DocumentRoot /var/www/moodle

    # SSL Configuration
    SSLEngine on
    SSLCertificateFile /etc/ssl/certs/your-domain.crt
    SSLCertificateKeyFile /etc/ssl/private/your-domain.key

    # Security Headers
    Header always set X-Content-Type-Options "nosniff"
    Header always set X-Frame-Options "DENY"
    Header always set X-XSS-Protection "1; mode=block"
    
    <Directory /var/www/moodle>
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted
        
        # API rewrite rules
        RewriteEngine On
        RewriteBase /
        RewriteCond %{REQUEST_URI} ^/api/v1/
        RewriteRule ^api/v1/(.*)$ api/index.php?endpoint=$1 [QSA,L]
    </Directory>

    # Serve React frontend static files
    Alias /react /var/www/moodle/react-frontend/dist
    <Directory /var/www/moodle/react-frontend/dist>
        Options -Indexes
        AllowOverride None
        Require all granted
        
        # SPA routing - serve index.html for all routes
        RewriteEngine On
        RewriteBase /react
        RewriteRule ^index\.html$ - [L]
        RewriteCond %{REQUEST_FILENAME} !-f
        RewriteCond %{REQUEST_FILENAME} !-d
        RewriteRule . /react/index.html [L]
    </Directory>

    ErrorLog ${APACHE_LOG_DIR}/moodle-prod-error.log
    CustomLog ${APACHE_LOG_DIR}/moodle-prod-access.log combined
</VirtualHost>
EOF

# Enable site and SSL module
sudo a2enmod ssl
sudo a2ensite moodle-prod.conf
sudo service apache2 restart
```

#### 4. Redis for JWT Token Blacklist
```bash
# Install Redis
sudo apt-get install redis-server

# Start Redis
sudo service redis-server start

# Update config.php to use Redis for sessions
# Add to config.php:
$CFG->session_handler_class = '\core\session\redis';
$CFG->session_redis_host = '127.0.0.1';
$CFG->session_redis_port = 6379;
$CFG->session_redis_database = 0;
```

#### 5. Performance Optimization

**PHP-FPM Configuration**:
```bash
# Edit /etc/php/8.3/fpm/pool.d/www.conf
# Adjust based on server resources:
pm = dynamic
pm.max_children = 50
pm.start_servers = 10
pm.min_spare_servers = 5
pm.max_spare_servers = 35

# Restart PHP-FPM
sudo service php8.3-fpm restart
```

**Apache MPM Configuration**:
```bash
# Edit /etc/apache2/mods-available/mpm_prefork.conf
<IfModule mpm_prefork_module>
    StartServers 5
    MinSpareServers 5
    MaxSpareServers 10
    MaxRequestWorkers 150
    MaxConnectionsPerChild 0
</IfModule>

# Restart Apache
sudo service apache2 restart
```

**MySQL Optimization**:
```bash
# Edit /etc/mysql/mariadb.conf.d/50-server.cnf
# Add under [mysqld]:
max_connections = 200
innodb_buffer_pool_size = 2G
innodb_log_file_size = 512M
query_cache_size = 128M
query_cache_type = 1

# Restart MariaDB
sudo service mariadb restart
```

### Monitoring and Logging

#### Application Monitoring
```bash
# Install monitoring tools
# Example: New Relic, Datadog, or Prometheus + Grafana

# Configure log aggregation
# Example: ELK Stack (Elasticsearch, Logstash, Kibana)
```

#### Health Check Endpoints
```bash
# Create health check script
sudo tee /var/www/moodle/health.php > /dev/null <<'EOF'
<?php
header('Content-Type: application/json');

$health = [
    'status' => 'ok',
    'timestamp' => time(),
    'checks' => []
];

// Database check
try {
    require_once('config.php');
    $DB->get_record_sql('SELECT 1');
    $health['checks']['database'] = 'ok';
} catch (Exception $e) {
    $health['status'] = 'error';
    $health['checks']['database'] = 'error: ' . $e->getMessage();
}

// File system check
if (is_writable($CFG->dataroot)) {
    $health['checks']['filesystem'] = 'ok';
} else {
    $health['status'] = 'error';
    $health['checks']['filesystem'] = 'error: data directory not writable';
}

echo json_encode($health, JSON_PRETTY_PRINT);
EOF

# Test health check
curl http://localhost/health.php
```

### Backup and Recovery

#### Database Backups
```bash
# Daily backup script
sudo tee /usr/local/bin/moodle-backup > /dev/null <<'EOF'
#!/bin/bash
BACKUP_DIR="/var/backups/moodle"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Database backup
mysqldump -u moodle_prod -p'PASSWORD' moodle_prod | gzip > $BACKUP_DIR/moodle_db_$DATE.sql.gz

# Moodle data directory backup
tar -czf $BACKUP_DIR/moodledata_$DATE.tar.gz /var/moodledata

# Keep only last 7 days of backups
find $BACKUP_DIR -name "*.gz" -mtime +7 -delete

echo "Backup completed: $DATE"
EOF

sudo chmod +x /usr/local/bin/moodle-backup

# Schedule daily backups with cron
sudo crontab -e
# Add line:
# 0 2 * * * /usr/local/bin/moodle-backup
```

### Security Hardening

#### 1. File Permissions
```bash
# Set correct ownership
sudo chown -R www-data:www-data /var/www/moodle
sudo chown -R www-data:www-data /var/moodledata

# Set correct permissions
sudo find /var/www/moodle -type f -exec chmod 644 {} \;
sudo find /var/www/moodle -type d -exec chmod 755 {} \;
sudo chmod 400 /var/www/moodle/config.php
```

#### 2. Firewall Configuration
```bash
# Install and configure UFW
sudo apt-get install ufw

# Allow SSH, HTTP, HTTPS
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw enable
```

#### 3. Rate Limiting (via config.php)
```php
// Add to config.php
$CFG->api_rate_limit = [
    'requests_per_hour' => 1000,
    'requests_per_minute' => 60,
    'burst_size' => 20
];
```

#### 4. JWT Security
```php
// Ensure strong JWT secret (64+ characters)
$CFG->jwt_secret = 'GENERATE_SECURE_64_CHARACTER_STRING_HERE';

// Short access token lifetime
$CFG->jwt_access_token_ttl = 3600; // 1 hour

// Longer refresh token lifetime
$CFG->jwt_refresh_token_ttl = 604800; // 7 days
```

## Appendix

### Useful Commands Reference

#### Service Management
```bash
# Start all services
moodle-services start

# Stop all services
moodle-services stop

# Check status
moodle-services status

# Restart individual services
service mariadb restart
service apache2 restart
pkill -f vite && cd react-frontend && npm run dev &
```

#### Database Operations
```bash
# Connect to database
mysql -h localhost -u moodle -pmoodle -D moodle

# Backup database
mysqldump -u moodle -pmoodle moodle | gzip > moodle_backup_$(date +%Y%m%d).sql.gz

# Restore database
gunzip < moodle_backup_YYYYMMDD.sql.gz | mysql -u moodle -pmoodle moodle

# Count tables
mysql -h localhost -u moodle -pmoodle -D moodle -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'moodle';"
```

#### Development Server
```bash
# Start React dev server
cd react-frontend && npm run dev

# Start in background
cd react-frontend && npm run dev > /tmp/react-dev-server.log 2>&1 &

# View logs
tail -f /tmp/react-dev-server.log

# Kill dev server
pkill -f vite
```

#### Testing
```bash
# Unit tests
cd react-frontend && npm run test

# E2E tests (specific browser)
cd react-frontend && npm run test:e2e -- --project=chromium

# Type check
cd react-frontend && npm run type-check

# Lint
cd react-frontend && npm run lint
```

#### Build
```bash
# Production build
cd react-frontend && npm run build

# Preview production build
cd react-frontend && npm run preview

# Check bundle size
cd react-frontend && npm run build && du -sh dist/
```

### Port Reference

| Port | Service | Protocol |
|------|---------|----------|
| 80 | Apache (HTTP) | TCP |
| 443 | Apache (HTTPS) | TCP |
| 3306 | MariaDB | TCP |
| 5173 | Vite Dev Server | TCP |
| 6379 | Redis (optional) | TCP |

### Log File Locations

| Component | Log File |
|-----------|----------|
| Apache Error | /var/log/apache2/moodle-error.log |
| Apache Access | /var/log/apache2/moodle-access.log |
| MariaDB Error | /var/log/mysql/error.log |
| MariaDB Slow Query | /var/log/mysql/slow-query.log |
| React Dev Server | /tmp/react-dev-server.log |
| PHP Errors | /var/log/apache2/moodle-error.log |

### Important File Paths

| Component | Path |
|-----------|------|
| Project Root | /tmp/blitzy/blitzy-moodle/blitzyd6458edab |
| Config File | /tmp/blitzy/blitzy-moodle/blitzyd6458edab/config.php |
| Data Directory | /tmp/moodledata |
| React Frontend | /tmp/blitzy/blitzy-moodle/blitzyd6458edab/react-frontend |
| API Layer | /tmp/blitzy/blitzy-moodle/blitzyd6458edab/api |
| Apache VHost | /etc/apache2/sites-available/moodle.conf |

### Environment Variables

#### Development (.env.development)
```bash
VITE_API_BASE_URL=http://localhost
VITE_API_VERSION=v1
VITE_ENABLE_MOCK_API=false
VITE_ENABLE_DEBUG_LOGS=true
```

#### Production (.env.production)
```bash
VITE_API_BASE_URL=https://your-domain.com
VITE_API_VERSION=v1
VITE_ENABLE_MOCK_API=false
VITE_ENABLE_DEBUG_LOGS=false
```

### Additional Resources

- **Moodle Documentation**: https://docs.moodle.org
- **React Documentation**: https://react.dev
- **TypeScript Documentation**: https://www.typescriptlang.org/docs
- **Material-UI Documentation**: https://mui.com
- **Vite Documentation**: https://vitejs.dev
- **Playwright Documentation**: https://playwright.dev

---

**Document Version**: 1.0  
**Last Updated**: November 15, 2025  
**Maintained By**: Infrastructure and Build Engineering Team  
