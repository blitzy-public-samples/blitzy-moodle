# Rollback Procedures

## Overview

This document provides comprehensive procedures for rolling back the Moodle React frontend deployment in case of critical issues. These procedures are designed to minimize downtime and ensure rapid recovery to a stable state.

**Document Version**: 1.0  
**Last Updated**: 2024  
**Applies To**: Moodle React Frontend v4.4.0-react

---

## Table of Contents

- [When to Execute Rollback](#when-to-execute-rollback)
- [Rollback Decision Criteria](#rollback-decision-criteria)
- [Rollback Strategies Overview](#rollback-strategies-overview)
- [1. Feature Flag Rollback (FASTEST - Recommended First)](#1-feature-flag-rollback-fastest---recommended-first)
- [2. Blue-Green Deployment Rollback](#2-blue-green-deployment-rollback)
- [3. Docker Image Rollback](#3-docker-image-rollback)
- [4. Nginx/Apache Configuration Rollback](#4-nginxapache-configuration-rollback)
- [5. Static File Rollback](#5-static-file-rollback)
- [6. Database Considerations](#6-database-considerations)
- [Rollback Decision Tree](#rollback-decision-tree)
- [Post-Rollback Validation](#post-rollback-validation)
- [Communication Protocol](#communication-protocol)
- [Prevention Strategies](#prevention-strategies)
- [Rollback Checklist](#rollback-checklist)

---

## When to Execute Rollback

Execute immediate rollback when any of the following conditions are met:

### Critical Triggers (Immediate Rollback Required)

1. **High Error Rate**: Error rate exceeds 5% of total requests for more than 5 minutes
2. **Authentication Failure**: Users unable to log in (>10% failure rate)
3. **Data Corruption**: Any evidence of data loss or corruption
4. **Critical Functionality Broken**: Core features completely non-functional:
   - Course enrollment fails
   - Assignment submission fails
   - Quiz attempts cannot be saved
   - Gradebook inaccessible
5. **Security Incident**: Evidence of security breach or vulnerability exploitation
6. **Performance Degradation**: P95 response time >10 seconds (10x normal)
7. **Database Connection Issues**: API cannot connect to database

### Warning Triggers (Monitor Closely, Prepare for Rollback)

1. **Elevated Error Rate**: Error rate 2-5% for more than 10 minutes
2. **Performance Issues**: P95 response time 3-10 seconds (3-10x normal)
3. **Increased Support Tickets**: 3x normal volume of user complaints
4. **Memory Leaks**: Server memory usage growing unbounded
5. **Partial Feature Failure**: Non-critical features malfunctioning

---

## Rollback Decision Criteria

### Severity Levels

| Severity | Description | Response Time | Rollback Strategy |
|----------|-------------|---------------|-------------------|
| **P0 - Critical** | Complete system outage, data loss risk | Immediate (< 5 min) | Feature flag or full rollback |
| **P1 - High** | Major feature broken, >5% users affected | < 15 minutes | Feature flag or blue-green |
| **P2 - Medium** | Minor feature broken, <5% users affected | < 1 hour | Feature flag for affected feature |
| **P3 - Low** | Cosmetic issues, no functional impact | Next deployment | Fix forward, no rollback |

### Decision Authority

| Severity | Decision Maker | Approval Required |
|----------|----------------|-------------------|
| P0 - Critical | On-call engineer | None (execute immediately) |
| P1 - High | Engineering lead | Notify management |
| P2 - Medium | Product owner + Engineering lead | Team consensus |
| P3 - Low | Individual engineer | Standard review process |

---

## Rollback Strategies Overview

| Strategy | Speed | Downtime | Complexity | When to Use |
|----------|-------|----------|------------|-------------|
| **Feature Flag** | Instant | Zero | Very Low | Feature-specific issues |
| **Blue-Green** | 5-15 min | Minimal | Medium | Full deployment issues |
| **Docker Image** | 2-5 min | 1-2 min | Low | Container-related issues |
| **Config Rollback** | 1-2 min | 10-30 sec | Low | Config-related issues |
| **Static Files** | 2-5 min | Zero | Low | Build artifact issues |

---

## 1. Feature Flag Rollback (FASTEST - Recommended First)

**Estimated Time**: <1 minute  
**Downtime**: Zero  
**Difficulty**: Very Low  
**Recommended For**: Feature-specific issues, gradual rollout problems

### Overview

Feature flag rollback disables the problematic React feature and falls back to the existing PHP interface. This is the fastest and safest rollback method with zero downtime.

### Prerequisites

- SSH access to production server
- Permission to edit `config.php`
- Knowledge of which feature is problematic

### Procedure

#### Step 1: Identify Problematic Feature

Determine which React feature is causing issues:

- `dashboard` - User dashboard
- `courses` - Course catalog and detail pages
- `assignments` - Assignment submission and grading
- `quizzes` - Quiz attempts and review
- `forums` - Forum discussions
- `gradebook` - Gradebook views
- `messaging` - Messaging and notifications
- `admin` - Administration interfaces

#### Step 2: SSH to Production Server

```bash
ssh user@production-server.example.com
cd /var/www/moodle
```

#### Step 3: Edit config.php

```bash
# Create backup
sudo cp config.php config.php.backup.$(date +%Y%m%d_%H%M%S)

# Edit config file
sudo nano config.php
```

#### Step 4: Disable Feature Flag

Locate the `$CFG->react_features` array and set the problematic feature to `false`:

```php
// Before (feature enabled)
$CFG->react_features = [
    'dashboard' => true,
    'courses' => true,
    'assignments' => true,  // ← This feature is broken
    'quizzes' => false,
    'gradebook' => false,
];

// After (feature disabled)
$CFG->react_features = [
    'dashboard' => true,
    'courses' => true,
    'assignments' => false,  // ← Disabled, falls back to PHP
    'quizzes' => false,
    'gradebook' => false,
];
```

#### Step 5: Save and Verify

```bash
# Save the file (Ctrl+X, Y, Enter in nano)

# Verify syntax (optional but recommended)
php -l config.php

# No PHP-FPM restart needed - change is immediate
```

#### Step 6: Test PHP Interface

1. Open browser in incognito mode
2. Navigate to the affected feature (e.g., `/mod/assign/view.php?id=123`)
3. Verify PHP interface loads correctly
4. Test critical functionality (view, submit, etc.)

### Verification Checklist

- [ ] Users can access the feature via PHP interface
- [ ] No error messages displayed
- [ ] Functionality works as expected
- [ ] Error rate drops below 1%
- [ ] Support ticket volume decreases

### Rollback of Rollback (Re-enable Feature)

If the issue is resolved and you want to re-enable the React feature:

```bash
# Edit config.php
sudo nano config.php

# Set feature back to true
$CFG->react_features = [
    'assignments' => true,  // ← Re-enabled
];

# Save and monitor
```

### Communication Template

```
INCIDENT UPDATE - Feature Rollback Executed

Status: RESOLVED
Affected Feature: [Feature Name]
Action Taken: Feature flag rollback to PHP interface
Downtime: Zero
Impact: Users temporarily see PHP interface for [feature]

Timeline:
- [TIME]: Issue detected
- [TIME]: Feature flag rollback executed
- [TIME]: Verification complete

Next Steps: Engineering team investigating root cause
```

---

## 2. Blue-Green Deployment Rollback

**Estimated Time**: 5-15 minutes  
**Downtime**: Minimal (10-30 seconds during switch)  
**Difficulty**: Medium  
**Recommended For**: Full deployment issues, widespread problems

### Overview

Blue-green deployment rollback switches traffic from the new deployment (green) back to the previous stable deployment (blue).

### Prerequisites

- Access to load balancer configuration
- Previous deployment still running (blue environment)
- DNS management access (if using DNS-based routing)

### Architecture

```
                   ┌─────────────────┐
                   │  Load Balancer  │
                   │   or Nginx      │
                   └────────┬────────┘
                            │
                ┌───────────┴───────────┐
                │                       │
        ┌───────▼────────┐     ┌───────▼────────┐
        │  Blue (Old)    │     │ Green (New)    │
        │  v1.0.0        │     │  v1.1.0        │
        │  ✓ STABLE      │     │  ✗ BROKEN      │
        └────────────────┘     └────────────────┘
```

### Procedure - Nginx Configuration

#### Step 1: SSH to Load Balancer/Web Server

```bash
ssh user@nginx-server.example.com
```

#### Step 2: Check Current Upstream

```bash
# View current configuration
cat /etc/nginx/sites-enabled/moodle-react.conf | grep "upstream\|proxy_pass"

# Current state (green deployment active)
upstream moodle_react_backend {
    server react-green:3000;  # New deployment (BROKEN)
}
```

#### Step 3: Backup Current Configuration

```bash
sudo cp /etc/nginx/sites-enabled/moodle-react.conf \
    /etc/nginx/sites-enabled/moodle-react.conf.backup.$(date +%Y%m%d_%H%M%S)
```

#### Step 4: Edit Nginx Configuration

```bash
sudo nano /etc/nginx/sites-enabled/moodle-react.conf
```

Change upstream to point to blue (old) deployment:

```nginx
# Before (green deployment)
upstream moodle_react_backend {
    server react-green:3000;
}

# After (blue deployment - rollback)
upstream moodle_react_backend {
    server react-blue:3000;
}
```

#### Step 5: Test and Reload Nginx

```bash
# Test configuration syntax
sudo nginx -t

# Expected output:
# nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
# nginx: configuration file /etc/nginx/nginx.conf test is successful

# Reload Nginx (zero downtime)
sudo nginx -s reload

# Or restart if reload fails
# sudo systemctl restart nginx
```

#### Step 6: Verify Rollback

```bash
# Check Nginx error log
sudo tail -f /var/log/nginx/error.log

# Check access log for traffic routing
sudo tail -f /var/log/nginx/access.log

# Verify upstream health
curl -I http://localhost/react-frontend/
```

### Procedure - AWS Elastic Load Balancer

#### Step 1: Access AWS Console

1. Log in to AWS Console
2. Navigate to **EC2** → **Load Balancers**
3. Select your load balancer (e.g., `moodle-react-alb`)

#### Step 2: Modify Target Group

1. Click **Listeners** tab
2. View rules for **HTTP:80** and **HTTPS:443**
3. Identify current target group (e.g., `react-green-tg`)

#### Step 3: Update Listener Rules

1. Click **Edit** on the listener
2. Change **Forward to** target group:
   - **Before**: `react-green-tg` (new deployment)
   - **After**: `react-blue-tg` (previous deployment)
3. Click **Save**

#### Step 4: Verify Target Health

1. Navigate to **Target Groups**
2. Select `react-blue-tg`
3. Verify all targets are **healthy**
4. Monitor traffic distribution

### Procedure - DNS-Based Routing (Cloudflare/Route53)

#### Step 1: Access DNS Management

**Cloudflare**:
- Log in to Cloudflare dashboard
- Select your domain

**AWS Route53**:
- Log in to AWS Console
- Navigate to **Route 53** → **Hosted Zones**

#### Step 2: Update DNS Record

Change the A record or CNAME to point to blue deployment:

```
Before (green):
react.moodle.example.com → A → 203.0.113.50 (green server)

After (blue - rollback):
react.moodle.example.com → A → 203.0.113.49 (blue server)
```

#### Step 3: Consider DNS TTL

- **Short TTL (60s)**: Changes propagate in 1-2 minutes
- **Long TTL (3600s)**: May take up to 1 hour
- **Solution**: During rollback, reduce TTL immediately for faster future changes

### Verification Checklist

- [ ] Load balancer routes traffic to blue deployment
- [ ] Blue deployment target health is 100%
- [ ] Error rate drops below 1%
- [ ] Application responds correctly
- [ ] No 502/503/504 errors
- [ ] SSL certificate valid
- [ ] Monitoring shows traffic on blue deployment

---

## 3. Docker Image Rollback

**Estimated Time**: 2-5 minutes  
**Downtime**: 1-2 minutes  
**Difficulty**: Low  
**Recommended For**: Container-related issues, image corruption

### Overview

Rollback to the previous Docker image version by stopping the current container and starting the previous version.

### Prerequisites

- Docker access to production server
- Previous image tagged and available (e.g., `moodle-react:v1.0.0`)
- Knowledge of current and previous image tags

### Procedure - Standalone Docker

#### Step 1: Identify Current and Previous Images

```bash
# SSH to Docker host
ssh user@docker-host.example.com

# List available images
docker images | grep moodle-react

# Example output:
# moodle-react   v1.1.0   abc123def456   2 hours ago    500MB  ← Current (broken)
# moodle-react   v1.0.0   789ghi012jkl   1 day ago      498MB  ← Previous (stable)
# moodle-react   latest   abc123def456   2 hours ago    500MB
```

#### Step 2: Stop Current Container

```bash
# Find running container
docker ps | grep moodle-react

# Stop the container gracefully
docker stop moodle-react-frontend

# If container doesn't stop, force kill
# docker kill moodle-react-frontend

# Remove the container
docker rm moodle-react-frontend
```

#### Step 3: Start Previous Image

```bash
# Run previous stable image
docker run -d \
  --name moodle-react-frontend \
  --restart unless-stopped \
  -p 3000:80 \
  -e VITE_API_BASE_URL=https://moodle.example.com/api/v1 \
  -e VITE_PUBLIC_URL=https://moodle.example.com \
  moodle-react:v1.0.0

# Verify container is running
docker ps | grep moodle-react

# Check logs
docker logs -f moodle-react-frontend
```

#### Step 4: Health Check

```bash
# Wait 30 seconds for startup
sleep 30

# Check container health
docker inspect moodle-react-frontend | grep -A 10 Health

# Test HTTP endpoint
curl -I http://localhost:3000/

# Expected: HTTP/1.1 200 OK
```

### Procedure - Docker Compose

#### Step 1: Edit docker-compose.yml

```bash
cd /opt/moodle-react
sudo nano docker-compose.yml
```

#### Step 2: Change Image Tag

```yaml
# Before (broken version)
services:
  react-frontend:
    image: moodle-react:v1.1.0  # Broken version
    ports:
      - "3000:80"
    environment:
      - VITE_API_BASE_URL=https://moodle.example.com/api/v1

# After (rollback to previous)
services:
  react-frontend:
    image: moodle-react:v1.0.0  # Previous stable version
    ports:
      - "3000:80"
    environment:
      - VITE_API_BASE_URL=https://moodle.example.com/api/v1
```

#### Step 3: Recreate Container

```bash
# Pull previous image (if not available locally)
docker-compose pull react-frontend

# Recreate container with previous image
docker-compose up -d react-frontend

# Check status
docker-compose ps

# View logs
docker-compose logs -f react-frontend
```

### Procedure - Kubernetes

#### Step 1: Identify Deployment

```bash
kubectl get deployments -n moodle

# Find the React frontend deployment
# Example: moodle-react-frontend
```

#### Step 2: Rollback to Previous Revision

```bash
# View deployment history
kubectl rollout history deployment/moodle-react-frontend -n moodle

# Example output:
# REVISION  CHANGE-CAUSE
# 1         Image: moodle-react:v1.0.0
# 2         Image: moodle-react:v1.1.0  ← Current (broken)

# Rollback to previous revision
kubectl rollout undo deployment/moodle-react-frontend -n moodle

# Or rollback to specific revision
# kubectl rollout undo deployment/moodle-react-frontend --to-revision=1 -n moodle
```

#### Step 3: Monitor Rollout

```bash
# Watch rollout status
kubectl rollout status deployment/moodle-react-frontend -n moodle

# Check pod status
kubectl get pods -n moodle | grep moodle-react

# View logs of new pods
kubectl logs -f deployment/moodle-react-frontend -n moodle
```

#### Step 4: Verify Image Version

```bash
# Confirm image version rolled back
kubectl describe deployment moodle-react-frontend -n moodle | grep Image:

# Expected: Image: moodle-react:v1.0.0
```

### Verification Checklist

- [ ] Previous Docker image is running
- [ ] Container health check passes
- [ ] Application responds to HTTP requests
- [ ] Environment variables correctly configured
- [ ] Logs show no errors
- [ ] Monitoring dashboards show normal metrics

---

## 4. Nginx/Apache Configuration Rollback

**Estimated Time**: 1-2 minutes  
**Downtime**: 10-30 seconds  
**Difficulty**: Low  
**Recommended For**: Configuration-related issues, routing problems

### Overview

Restore previous web server configuration from backup.

### Procedure - Nginx

#### Step 1: Identify Backup

```bash
# List configuration backups
ls -lah /etc/nginx/sites-enabled/*.backup*

# Example output:
# moodle-react.conf.backup.20240115_140000  ← 2 hours ago (before issue)
# moodle-react.conf.backup.20240115_100000  ← 6 hours ago
```

#### Step 2: Test Backup Configuration

```bash
# Create temporary test config
sudo cp /etc/nginx/sites-enabled/moodle-react.conf.backup.20240115_140000 \
    /tmp/moodle-react.conf.test

# Test configuration
sudo nginx -t -c /tmp/moodle-react.conf.test

# If test passes, proceed with restoration
```

#### Step 3: Restore Configuration

```bash
# Backup current (broken) configuration
sudo cp /etc/nginx/sites-enabled/moodle-react.conf \
    /etc/nginx/sites-enabled/moodle-react.conf.broken.$(date +%Y%m%d_%H%M%S)

# Restore previous configuration
sudo cp /etc/nginx/sites-enabled/moodle-react.conf.backup.20240115_140000 \
    /etc/nginx/sites-enabled/moodle-react.conf

# Test restored configuration
sudo nginx -t
```

#### Step 4: Reload Nginx

```bash
# Graceful reload (zero downtime)
sudo nginx -s reload

# Verify reload successful
sudo nginx -t && echo "Nginx OK" || echo "Nginx FAILED"

# Check error log
sudo tail -f /var/log/nginx/error.log
```

### Procedure - Apache

#### Step 1: Identify Backup

```bash
# List configuration backups
ls -lah /etc/apache2/sites-enabled/*.backup*

# Or for httpd
ls -lah /etc/httpd/conf.d/*.backup*
```

#### Step 2: Restore Configuration

```bash
# Backup current (broken) configuration
sudo cp /etc/apache2/sites-enabled/moodle-react.conf \
    /etc/apache2/sites-enabled/moodle-react.conf.broken.$(date +%Y%m%d_%H%M%S)

# Restore previous configuration
sudo cp /etc/apache2/sites-enabled/moodle-react.conf.backup.20240115_140000 \
    /etc/apache2/sites-enabled/moodle-react.conf

# Test configuration
sudo apachectl configtest
```

#### Step 3: Restart Apache

```bash
# Graceful restart (minimal downtime)
sudo systemctl reload apache2

# Or full restart if reload fails
# sudo systemctl restart apache2

# Check status
sudo systemctl status apache2

# View error log
sudo tail -f /var/log/apache2/error.log
```

### Verification Checklist

- [ ] Configuration syntax test passes
- [ ] Web server reloaded/restarted successfully
- [ ] No errors in error log
- [ ] Application accessible via browser
- [ ] Routing works correctly
- [ ] SSL certificate valid

---

## 5. Static File Rollback

**Estimated Time**: 2-5 minutes  
**Downtime**: Zero (with atomic swap)  
**Difficulty**: Low  
**Recommended For**: Build artifact issues, corrupted dist files

### Overview

Restore the previous build artifacts (static files) from backup.

### Prerequisites

- Backup of previous `dist/` directory
- SSH access to web server
- Permission to modify static file directory

### Procedure

#### Step 1: Identify Static File Location

```bash
# SSH to web server
ssh user@webserver.example.com

# Locate current dist directory
cd /var/www/moodle/react-frontend
ls -lah dist/

# Check backup location
ls -lah /var/www/moodle/react-frontend/dist.backup*/
```

#### Step 2: Verify Backup Integrity

```bash
# Check backup directory exists and has files
du -sh dist.backup.20240115_140000

# Expected: ~10-50MB depending on build

# Verify index.html exists
test -f dist.backup.20240115_140000/index.html && echo "OK" || echo "MISSING"
```

#### Step 3: Atomic Swap (Zero Downtime)

```bash
# Rename current dist to broken
mv dist dist.broken.$(date +%Y%m%d_%H%M%S)

# Create symlink or copy backup
# Option A: Symlink (instant, but backup must remain)
ln -s dist.backup.20240115_140000 dist

# Option B: Copy (takes 2-5 min, but independent)
cp -r dist.backup.20240115_140000 dist

# Set correct permissions
chmod -R 755 dist
chown -R www-data:www-data dist  # Adjust user/group as needed
```

#### Step 4: Clear CDN Cache (if applicable)

```bash
# Cloudflare
curl -X POST "https://api.cloudflare.com/client/v4/zones/{zone_id}/purge_cache" \
  -H "Authorization: Bearer {api_token}" \
  -H "Content-Type: application/json" \
  --data '{"purge_everything":true}'

# Or use Cloudflare dashboard:
# 1. Log in to Cloudflare
# 2. Select domain
# 3. Caching → Purge Everything
```

#### Step 5: Verify Files Served

```bash
# Check file timestamps
ls -lah dist/ | head -10

# Test HTTP serving
curl -I https://moodle.example.com/react-frontend/

# Verify specific asset
curl -I https://moodle.example.com/react-frontend/assets/index-abc123.js
```

### Rsync Restoration Method

```bash
# Restore from remote backup server
rsync -avz --delete \
  backup-server:/backups/moodle-react/dist.backup.20240115_140000/ \
  /var/www/moodle/react-frontend/dist/

# Verify sync
rsync -avz --dry-run --delete \
  backup-server:/backups/moodle-react/dist.backup.20240115_140000/ \
  /var/www/moodle/react-frontend/dist/
```

### Verification Checklist

- [ ] Dist directory contains correct files
- [ ] index.html file present and valid
- [ ] Asset files (JS, CSS) present
- [ ] File timestamps match backup
- [ ] HTTP requests return 200 OK
- [ ] Application loads in browser
- [ ] No 404 errors for assets
- [ ] CDN cache cleared (if applicable)

---

## 6. Database Considerations

### ⚠️ CRITICAL: No Database Rollback Needed

**This React frontend refactoring involves ZERO database schema changes.**

### Why No Database Rollback?

1. **No Schema Changes**: The React frontend refactor does not modify any database tables, columns, indexes, or relationships
2. **Data Layer Unchanged**: All data operations still go through the existing PHP backend
3. **API as Thin Wrapper**: API endpoints only call existing PHP functions which use existing database schema
4. **Read-Only Frontend**: React frontend only reads data via API, never writes directly to database
5. **Data Integrity Maintained**: All business logic (including data validation) remains in PHP backend

### Database Safety Guarantees

✅ **No ALTER TABLE statements** in this refactor  
✅ **No new tables created** for React functionality  
✅ **No columns added or removed** from any table  
✅ **No data migrations required** for this refactor  
✅ **No database connection changes** needed  
✅ **All database operations** still via existing PHP backend  

### What About User Preferences?

User preferences for React interface are stored in existing Moodle user preferences:

```php
// Stored in existing mdl_user_preferences table
set_user_preference('react_interface_enabled', true, $userid);
```

**Rollback Impact**: If you rollback the React frontend, users will automatically fall back to PHP interface. No data loss occurs.

### Future Database Changes (Out of Scope)

If future enhancements require database changes, they will be:

1. Planned as separate migration project
2. Include separate rollback procedures
3. Follow Moodle database upgrade patterns
4. Include data migration and validation

---

## Rollback Decision Tree

```
┌─────────────────────────────────────────┐
│    Is there a production issue?         │
└───────────────┬─────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────┐
│  Is error rate > 5% or critical         │
│  functionality broken?                  │
└───────┬───────────────────┬─────────────┘
        │ NO                │ YES
        │                   │
        ▼                   ▼
┌───────────────┐    ┌──────────────────────┐
│  Monitor and  │    │ Identify issue scope │
│  investigate  │    └──────────┬───────────┘
└───────────────┘               │
                                ▼
                    ┌───────────────────────────┐
                    │ Is it feature-specific?   │
                    └────┬──────────────────┬───┘
                         │ YES              │ NO
                         │                  │
                         ▼                  ▼
              ┌─────────────────┐   ┌──────────────────┐
              │ Use Feature     │   │ Is it deployment │
              │ Flag Rollback   │   │ related?         │
              │ (1 min)         │   └────┬────────┬────┘
              └─────────────────┘        │ YES    │ NO
                                         │        │
                                         ▼        ▼
                              ┌──────────────┐  ┌────────────────┐
                              │ Blue-Green   │  │ Is it container│
                              │ Rollback     │  │ related?       │
                              │ (5-15 min)   │  └───┬────────┬───┘
                              └──────────────┘      │ YES    │ NO
                                                    │        │
                                                    ▼        ▼
                                         ┌──────────────┐  ┌────────────┐
                                         │ Docker Image │  │ Is it web  │
                                         │ Rollback     │  │ server     │
                                         │ (2-5 min)    │  │ config?    │
                                         └──────────────┘  └──┬─────┬───┘
                                                              │ YES │ NO
                                                              │     │
                                                              ▼     ▼
                                                    ┌──────────┐ ┌──────────┐
                                                    │ Config   │ │ Static   │
                                                    │ Rollback │ │ Files    │
                                                    │ (1-2 min)│ │ Rollback │
                                                    └──────────┘ └──────────┘
```

---

## Post-Rollback Validation

After executing any rollback, perform comprehensive validation before declaring the incident resolved.

### Immediate Validation (Within 5 Minutes)

#### 1. Health Check Endpoints

```bash
# Check application health
curl -f https://moodle.example.com/health || echo "FAILED"

# Check API health
curl -f https://moodle.example.com/api/v1/health || echo "FAILED"

# Check specific features
curl -f https://moodle.example.com/course/index.php || echo "FAILED"
```

#### 2. Error Rate Monitoring

```bash
# Check last 5 minutes of logs
sudo tail -n 1000 /var/log/nginx/error.log | grep -i error | wc -l

# Should be < 10 errors in last 5 minutes

# Check application error log
sudo tail -n 1000 /var/www/moodle/error.log | grep -i error | wc -l
```

#### 3. Smoke Test Critical Paths

**Test Checklist**:

- [ ] Homepage loads (https://moodle.example.com/)
- [ ] Login works (test with known credentials)
- [ ] Dashboard displays correctly
- [ ] Course catalog loads
- [ ] Course page loads (select any course)
- [ ] Assignment page loads (if assignments rolled back)
- [ ] Gradebook accessible (if gradebook rolled back)
- [ ] Forum page loads (if forums rolled back)
- [ ] User can log out successfully

### Short-Term Monitoring (30 Minutes)

#### 1. Error Rate Tracking

Monitor error rates closely for 30 minutes after rollback:

**Target**: Error rate < 1% (normal baseline)

```bash
# Monitor error rate every 5 minutes
watch -n 300 "tail -n 1000 /var/log/nginx/error.log | grep -i error | wc -l"
```

#### 2. Response Time Monitoring

Check performance metrics:

**Targets**:
- P50: < 300ms
- P95: < 1000ms
- P99: < 3000ms

```bash
# If using New Relic, Datadog, or similar
# Check dashboard: https://newrelic.com/app/{app_id}

# Or analyze access logs
awk '{print $NF}' /var/log/nginx/access.log | \
  tail -n 1000 | \
  awk '{sum+=$1; sumsq+=$1*$1} END {print "avg:", sum/NR, "stddev:", sqrt(sumsq/NR - (sum/NR)^2)}'
```

#### 3. Traffic Distribution

Verify traffic routing correctly:

```bash
# Check which deployment is receiving traffic
tail -f /var/log/nginx/access.log | grep -o 'upstream: [^,]*'

# Should show traffic going to expected deployment (blue for rollback)
```

### Medium-Term Validation (2 Hours)

#### 1. User Experience Testing

Perform comprehensive user journey testing:

**Student Journey**:
1. Log in as student
2. View dashboard
3. Browse course catalog
4. Enroll in a course
5. View course content
6. Submit assignment
7. Take quiz (if applicable)
8. Check grades
9. Send message
10. Log out

**Teacher Journey**:
1. Log in as teacher
2. View teacher dashboard
3. Access course management
4. View submissions
5. Grade assignment
6. Provide feedback
7. View gradebook
8. Post forum announcement
9. Log out

**Admin Journey**:
1. Log in as admin
2. View admin dashboard
3. Manage users
4. View reports
5. Configure settings
6. Log out

#### 2. Support Ticket Volume

Monitor support channels:

**Expected**: Support ticket volume returns to normal baseline within 2 hours

- Check helpdesk queue
- Monitor Slack support channels
- Review email support inbox
- Check phone support call volume

#### 3. Performance Baselines Restored

Verify all performance metrics return to normal:

- Database query performance
- API response times
- Frontend load times
- Memory usage
- CPU utilization
- Disk I/O

### Long-Term Monitoring (24 Hours)

#### 1. Error Pattern Analysis

Analyze error logs for any recurring patterns:

```bash
# Most common errors
cat /var/log/nginx/error.log | \
  grep -o 'error: [^,]*' | \
  sort | uniq -c | sort -rn | head -20
```

#### 2. User Feedback Collection

- Review user feedback surveys
- Monitor social media mentions
- Check community forum posts
- Analyze feature usage metrics

#### 3. Metrics Comparison

Compare pre-issue vs post-rollback metrics:

| Metric | Pre-Issue | During Issue | Post-Rollback | Status |
|--------|-----------|--------------|---------------|--------|
| Error Rate | 0.5% | 8% | 0.4% | ✅ Restored |
| P95 Response | 800ms | 5000ms | 750ms | ✅ Restored |
| Active Users | 5000 | 3200 | 5100 | ✅ Restored |
| Page Views | 50k/hr | 30k/hr | 52k/hr | ✅ Restored |

---

## Communication Protocol

### Incident Communication Phases

#### Phase 1: Issue Detection

**When**: Issue first detected  
**Audience**: Internal engineering team  
**Channel**: Slack #incidents  
**Template**:

```
🚨 INCIDENT DETECTED

Priority: [P0/P1/P2/P3]
Component: Moodle React Frontend
Issue: [Brief description]
Detected: [Timestamp]
Impact: [% of users or features affected]
Status: Investigating

Incident Commander: @[name]
```

#### Phase 2: Rollback Decision

**When**: Decision made to rollback  
**Audience**: Engineering team + Management  
**Channel**: Slack #incidents + Email to management  
**Template**:

```
⚠️ ROLLBACK DECISION

Incident: [Incident ID]
Decision: Proceeding with [rollback method]
Reason: [Brief justification]
Expected Duration: [X minutes]
Expected Downtime: [X minutes or "zero"]
Risk: [Low/Medium/High]

Approver: @[name]
Executor: @[name]
Started: [Timestamp]
```

#### Phase 3: Rollback In Progress

**When**: Rollback actively being executed  
**Audience**: Engineering team + Management + Support team  
**Channel**: Slack #incidents + Status page update  
**Template**:

```
🔄 ROLLBACK IN PROGRESS

Incident: [Incident ID]
Method: [Feature flag / Blue-green / Docker / etc.]
Progress: [Step X of Y]
Current Status: [Brief update]
ETA: [X minutes remaining]

Next Update: [Timestamp]
```

#### Phase 4: Rollback Complete

**When**: Rollback executed, validation in progress  
**Audience**: All stakeholders  
**Channel**: Slack #incidents + Status page + Email  
**Template**:

```
✅ ROLLBACK COMPLETE

Incident: [Incident ID]
Rollback Method: [Method used]
Execution Time: [X minutes]
Downtime: [X minutes or "zero"]
Current Status: Validation in progress

Validation Checklist:
- [ ] Error rate < 1%
- [ ] Response times normal
- [ ] Critical paths tested
- [ ] Monitoring stable

Next Steps: 
- Continued monitoring for 30 minutes
- Root cause analysis to follow
```

#### Phase 5: Incident Resolved

**When**: All validation complete, system stable  
**Audience**: All stakeholders + Users (if applicable)  
**Channel**: All channels + Public announcement  
**Template**:

```
🎉 INCIDENT RESOLVED

Incident: [Incident ID]
Duration: [Total time from detection to resolution]
Impact: [% of users affected]
Resolution: [Brief description]

Timeline:
- [TIME]: Issue detected
- [TIME]: Rollback decision made
- [TIME]: Rollback executed
- [TIME]: Validation complete
- [TIME]: Declared resolved

User Impact: [Description of what users experienced]

Next Steps:
- Post-mortem scheduled for [Date/Time]
- Root cause investigation ongoing
- Prevention measures to be implemented

Thank you for your patience during this incident.
```

### Status Page Updates

#### Status Page States

| State | Display | When to Use |
|-------|---------|-------------|
| **Operational** | 🟢 All Systems Operational | Normal operations |
| **Degraded Performance** | 🟡 Degraded Performance | Minor issues, < 5% error rate |
| **Partial Outage** | 🟠 Partial Outage | Feature-specific issues |
| **Major Outage** | 🔴 Major Outage | Widespread issues, > 5% error rate |
| **Under Maintenance** | 🔵 Under Maintenance | Planned maintenance |

#### Update Frequency During Incident

- **P0 (Critical)**: Every 10 minutes
- **P1 (High)**: Every 20 minutes
- **P2 (Medium)**: Every 30 minutes
- **P3 (Low)**: As needed

### Stakeholder Communication Matrix

| Stakeholder | Phase 1 | Phase 2 | Phase 3 | Phase 4 | Phase 5 |
|-------------|---------|---------|---------|---------|---------|
| **Engineering Team** | Slack | Slack | Slack | Slack | Slack + Email |
| **Management** | - | Email | Email | Email | Email + Report |
| **Support Team** | - | Slack | Slack | Slack | Slack + Email |
| **Users** | - | - | Status Page | Status Page | Status Page + Email |
| **External Stakeholders** | - | - | - | Email | Email |

---

## Prevention Strategies

### Pre-Deployment Validation

#### 1. Comprehensive Testing

**Required Tests Before Production**:

- [ ] Unit tests: 90%+ coverage
- [ ] Integration tests: All critical APIs
- [ ] E2E tests: 15 critical user journeys
- [ ] Performance tests: Load testing with 2x expected traffic
- [ ] Security tests: OWASP Top 10 scan
- [ ] Accessibility tests: WCAG 2.1 AA compliance
- [ ] Browser compatibility: Chrome, Firefox, Safari, Edge

#### 2. Staging Environment Validation

**Staging must replicate production**:

- Same PHP version (8.2+)
- Same database version (MySQL 8.0+ or PostgreSQL 13+)
- Same web server configuration (Nginx/Apache)
- Same scale (or 50% of production load)
- Representative data set

**Staging Validation Checklist**:

- [ ] Deploy to staging first
- [ ] Run all automated tests
- [ ] Perform manual smoke testing
- [ ] Load testing with realistic traffic
- [ ] Security scanning
- [ ] Monitor for 24 hours
- [ ] Get sign-off from QA team

#### 3. Gradual Rollout Strategy

**Phased Deployment Plan**:

| Phase | Audience | Duration | Rollback Threshold |
|-------|----------|----------|-------------------|
| 1 | Internal employees | 1 week | Any issue |
| 2 | Beta users (opt-in) | 2 weeks | > 2% error rate |
| 3 | 10% of users | 1 week | > 3% error rate |
| 4 | 50% of users | 1 week | > 5% error rate |
| 5 | 100% of users | - | > 5% error rate |

**Implementation via Feature Flags**:

```php
// config.php
$CFG->react_rollout_percentage = 10;  // Start with 10% of users

// Gradual increase each week
// Week 1: 10%
// Week 2: 25%
// Week 3: 50%
// Week 4: 100%
```

### Monitoring and Alerting

#### 1. Key Metrics to Monitor

**Application Metrics**:
- Error rate (target: < 1%)
- Response time P50, P95, P99
- Request throughput
- Active users
- Page load time
- API endpoint latency

**Infrastructure Metrics**:
- CPU utilization (target: < 70%)
- Memory usage (target: < 80%)
- Disk I/O
- Network throughput
- Database connection pool
- Cache hit rate

#### 2. Alert Thresholds

| Metric | Warning | Critical | Action |
|--------|---------|----------|--------|
| Error Rate | > 2% | > 5% | Prepare rollback |
| P95 Response | > 2s | > 5s | Investigate |
| CPU Usage | > 70% | > 85% | Scale up |
| Memory Usage | > 80% | > 90% | Investigate |
| Disk Space | > 80% | > 90% | Clean up |

#### 3. Monitoring Tools

**Recommended Stack**:

- **Application Performance Monitoring**: New Relic, Datadog, or Grafana
- **Log Aggregation**: ELK Stack (Elasticsearch, Logstash, Kibana) or Splunk
- **Error Tracking**: Sentry or Rollbar
- **Uptime Monitoring**: Pingdom or UptimeRobot
- **Synthetic Monitoring**: Checkly or Datadog Synthetics

### Automated Rollback Triggers

#### 1. Automatic Rollback Conditions

Consider implementing automatic rollback for:

- Error rate > 10% for 5 consecutive minutes
- P99 response time > 30 seconds for 5 minutes
- Health check fails for 3 consecutive checks
- Memory usage > 95% (potential memory leak)

#### 2. Circuit Breaker Pattern

Implement circuit breakers for API calls:

```typescript
// React Query configuration with circuit breaker
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      onError: (error) => {
        if (errorRate > 0.1) {
          // Switch to PHP interface automatically
          window.location.href = '/course/index.php';
        }
      },
    },
  },
});
```

### Documentation and Training

#### 1. Rollback Playbooks

**Maintain Updated Playbooks For**:

- Feature flag rollback
- Blue-green deployment rollback
- Docker image rollback
- Configuration rollback
- Full system rollback

**Update Schedule**: Review quarterly or after any major incident

#### 2. Team Training

**Required Training**:

- All engineers: Feature flag rollback procedure (30 min)
- On-call engineers: All rollback procedures (2 hours)
- Operations team: Infrastructure rollback procedures (1 hour)
- Support team: User communication during incidents (30 min)

**Practice Drills**: Conduct rollback drill quarterly

#### 3. Runbook Maintenance

**Runbook Review Checklist**:

- [ ] Contact information up to date
- [ ] Server addresses and credentials current
- [ ] Backup locations verified
- [ ] Commands tested in staging
- [ ] Rollback times validated
- [ ] Communication templates updated

---

## Rollback Checklist

Use this checklist during any rollback incident.

### Pre-Rollback

- [ ] Issue confirmed and severity assessed
- [ ] Rollback method selected based on decision tree
- [ ] Rollback decision approved by appropriate authority
- [ ] Team notified in #incidents Slack channel
- [ ] Incident ticket created with incident ID
- [ ] Status page updated to "Investigating"

### During Rollback

- [ ] Backup of current state created (if applicable)
- [ ] Rollback procedure steps documented in real-time
- [ ] Progress updates posted every 10-20 minutes
- [ ] Rollback executed according to selected procedure
- [ ] Verification steps completed
- [ ] Status page updated to "Monitoring"

### Post-Rollback

- [ ] Immediate validation completed (5 min)
- [ ] Short-term monitoring in place (30 min)
- [ ] Error rate below 1%
- [ ] Response times normal
- [ ] Critical paths smoke tested
- [ ] User impact assessed
- [ ] Status page updated to "Resolved"
- [ ] All stakeholders notified
- [ ] Incident ticket updated with resolution
- [ ] Medium-term validation scheduled (2 hours)
- [ ] Long-term monitoring scheduled (24 hours)
- [ ] Post-mortem meeting scheduled
- [ ] Root cause investigation initiated

### Post-Incident

- [ ] Post-mortem document created
- [ ] Root cause identified
- [ ] Prevention measures defined
- [ ] Action items assigned with owners
- [ ] Rollback procedures updated based on learnings
- [ ] Team training scheduled (if needed)
- [ ] Monitoring alerts tuned (if needed)
- [ ] Incident retrospective completed

---

## Appendix

### Contact Information

**On-Call Rotation**:
- Primary On-Call: [Pager link]
- Secondary On-Call: [Pager link]
- Escalation: Engineering Manager

**Key Stakeholders**:
- Engineering Lead: [Contact]
- DevOps Lead: [Contact]
- Product Owner: [Contact]
- Support Manager: [Contact]

### Related Documentation

- [Deployment Guide](./README.md)
- [Monitoring and Alerting Guide](./monitoring.md)
- [Incident Response Procedures](./incident-response.md)
- [Architecture Documentation](../architecture/README.md)
- [API Documentation](../../api/README.md)

### Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2024-01-15 | DevOps Team | Initial rollback procedures document |

---

**Document Ownership**: DevOps Team  
**Review Frequency**: Quarterly or after major incident  
**Last Reviewed**: 2024-01-15  

**For urgent assistance during an incident, contact the on-call engineer immediately.**
