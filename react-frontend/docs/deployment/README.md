# Deployment Documentation

## Overview

This documentation provides comprehensive guidance for deploying the Moodle React frontend to production, staging, and development environments. The React single-page application (SPA) modernizes Moodle's user interface while maintaining 100% backward compatibility with the existing PHP backend.

### Architecture Context

The Moodle React frontend operates as a stateless client-side application that:

- **Static File Hosting**: Compiled JavaScript, CSS, and assets served as static files from a web server or CDN
- **API Communication**: Communicates with the Moodle PHP backend via RESTful JSON API endpoints at `/api/v1/*`
- **JWT Authentication**: Uses JSON Web Tokens for stateless authentication, issued after successful authentication via existing Moodle auth plugins
- **Backward Compatibility**: Coexists with PHP-rendered pages during gradual rollout using feature flags

### Deployment Philosophy

The deployment strategy follows these core principles:

1. **Zero Downtime**: Rolling deployments with health checks ensure continuous availability
2. **Gradual Rollout**: Feature flags enable phased migration from PHP to React interfaces
3. **Instant Rollback**: Static file hosting enables immediate rollback to previous versions
4. **Environment Parity**: Identical build artifacts deployed across all environments with environment-specific configuration
5. **Security First**: HTTPS enforcement, CORS configuration, and CSP headers protect user data

## Quick Start

For rapid production deployment, follow these minimal steps:

```bash
# 1. Install Node.js 20.x LTS
nvm install 20
nvm use 20

# 2. Install dependencies
cd react-frontend
npm ci --production

# 3. Configure environment
cp .env.example .env.production
# Edit .env.production with your API_BASE_URL and other settings

# 4. Build for production
npm run build

# 5. Deploy static files
# Copy dist/ contents to your web server document root
rsync -avz dist/ user@server:/var/www/moodle-react/

# 6. Configure web server (Nginx example)
# Use provided nginx.conf template and restart
sudo systemctl restart nginx
```

**Full details**: See [Deployment Guide](./deployment-guide.md)

## Documentation Structure

### 📋 [Environment Setup](./environment-setup.md)
**Prerequisites and environment configuration for all deployment targets**

- Node.js 20.x LTS installation and configuration
- npm 9+ or pnpm 8+ package manager setup
- Web server installation (Nginx/Apache) with HTTPS
- SSL certificate provisioning (Let's Encrypt or commercial CA)
- Environment variable configuration (.env files)
- Database connectivity validation (for API backend)
- Redis setup for JWT token blacklist (recommended)

### 🔨 [Build Process](./build-process.md)
**Comprehensive guide to building the React application for production**

- Development build vs production build differences
- Vite build configuration and optimization
- TypeScript compilation and type checking
- Code splitting and lazy loading strategy
- Bundle size optimization and analysis
- Asset optimization (images, fonts, CSS)
- Source map generation for debugging
- Build verification and validation steps

### 🚀 [Deployment Guide](./deployment-guide.md)
**Step-by-step deployment procedures for all environments**

- Production deployment workflow
- Staging environment deployment
- Development environment setup
- Blue-green deployment strategy
- Rolling deployment procedures
- Docker containerization (optional)
- CI/CD pipeline integration (GitHub Actions, GitLab CI)
- Post-deployment validation checklist

### 📊 [Monitoring & Alerting](./monitoring-alerting.md)
**Production monitoring, logging, and alerting configuration**

- Application performance monitoring (APM) setup
- Error tracking and logging (Sentry, LogRocket)
- Core Web Vitals monitoring
- API response time tracking
- User session monitoring
- Real User Monitoring (RUM) implementation
- Alert rules and notification channels
- Dashboard creation and key metrics

### 🔧 [Troubleshooting](./troubleshooting.md)
**Common deployment issues and resolution procedures**

- Build failures and dependency conflicts
- API connectivity issues and CORS errors
- Authentication and JWT token problems
- Performance degradation diagnosis
- Browser compatibility issues
- Static file caching problems
- Memory leaks and resource exhaustion
- Production debugging techniques

### ⏮️ [Rollback Procedures](./rollback-procedures.md)
**Emergency rollback and disaster recovery procedures**

- Instant rollback via feature flags
- Static file rollback procedures
- Database state consistency validation
- User session handling during rollback
- Communication protocols for incidents
- Post-rollback analysis and reporting
- Preventive measures and safeguards

## Prerequisites

### System Requirements

| Component | Requirement | Purpose |
|-----------|-------------|---------|
| **Node.js** | 20.x LTS | JavaScript runtime for build tools |
| **npm** | 9.0.0+ | Package manager (or pnpm 8+) |
| **Web Server** | Nginx 1.18+ or Apache 2.4+ | Static file hosting and API proxy |
| **SSL Certificate** | Valid TLS 1.2+ certificate | HTTPS enforcement |
| **Operating System** | Linux (Ubuntu 22.04+ / RHEL 8+) | Production server OS |
| **Memory** | 2GB RAM minimum (4GB recommended) | Build process requirements |
| **Disk Space** | 1GB for node_modules, 100MB for build | Storage requirements |

### Moodle Backend Requirements

The React frontend requires a properly configured Moodle backend:

- **Moodle Version**: 4.4.0+ with PHP 8.2+
- **API Layer**: REST API endpoints installed at `/api/v1/*`
- **JWT Authentication**: JWT auth library (firebase/php-jwt) configured
- **CORS Configuration**: Proper CORS headers for cross-origin requests
- **Database**: MySQL 8.0+ or PostgreSQL 13+ (existing Moodle database)
- **Redis** (Recommended): For JWT token blacklist and session storage

### Network and Security

- **HTTPS Required**: Production deployment MUST use HTTPS (TLS 1.2+)
- **Domain Name**: Valid domain with DNS records configured
- **Firewall Rules**: Ports 80 (redirect) and 443 (HTTPS) open
- **CORS Whitelist**: API backend configured with frontend domain
- **CSP Headers**: Content Security Policy configured on web server
- **Rate Limiting**: API rate limiting configured (1000 req/hour/user)

### Access and Credentials

- **Server Access**: SSH access to production servers with sudo privileges
- **Repository Access**: Git repository access for pulling code
- **Deployment Keys**: SSH keys or credentials for automated deployment
- **Monitoring Access**: Access to monitoring and logging platforms
- **SSL Certificates**: Certificate management credentials (Let's Encrypt, etc.)

## Deployment Targets

### Production Environment

**Purpose**: Live system serving end users

**Characteristics**:
- High availability with load balancing (optional)
- HTTPS enforcement with HSTS headers
- CDN integration for global performance (optional)
- Full monitoring and alerting enabled
- Automated backups of configuration
- Strict error handling (no stack traces to users)
- Performance optimization enabled (minification, compression, caching)

**Configuration**:
```bash
NODE_ENV=production
API_BASE_URL=https://moodle.example.com/api/v1
ENABLE_SOURCE_MAPS=false
ENABLE_ANALYTICS=true
LOG_LEVEL=error
```

**Deployment Frequency**: Weekly or bi-weekly releases, emergency hotfixes as needed

### Staging Environment

**Purpose**: Pre-production validation and quality assurance

**Characteristics**:
- Mirror of production configuration
- Isolated database (copy of production data, anonymized)
- HTTPS enabled with staging domain
- Full monitoring enabled for testing
- Allows testing of deployment procedures
- Performance testing and load testing conducted here

**Configuration**:
```bash
NODE_ENV=staging
API_BASE_URL=https://staging.moodle.example.com/api/v1
ENABLE_SOURCE_MAPS=true
ENABLE_ANALYTICS=false
LOG_LEVEL=info
```

**Deployment Frequency**: Continuous deployment on merge to staging branch

### Development Environment

**Purpose**: Local development and feature testing

**Characteristics**:
- Hot module replacement (HMR) enabled
- Detailed error messages and stack traces
- Development proxy to API backend
- No minification or optimization (fast builds)
- Local HTTPS optional (for testing auth flows)

**Configuration**:
```bash
NODE_ENV=development
API_BASE_URL=http://localhost:8000/api/v1
ENABLE_SOURCE_MAPS=true
ENABLE_ANALYTICS=false
LOG_LEVEL=debug
```

**Deployment**: Local development server (no deployment, runs with `npm run dev`)

## Key Concepts

### Static File Hosting

The React frontend compiles to static files that can be served from any web server:

**Build Output Structure**:
```
dist/
├── index.html              # Entry point HTML
├── assets/
│   ├── index-[hash].js     # Main application bundle
│   ├── index-[hash].css    # Compiled CSS styles
│   ├── vendor-[hash].js    # Third-party dependencies
│   └── [feature]-[hash].js # Lazy-loaded feature bundles
├── favicon.ico
├── robots.txt
└── manifest.json           # PWA manifest
```

**Web Server Responsibilities**:
1. Serve static files with appropriate caching headers
2. Redirect all routes to index.html for client-side routing
3. Proxy API requests to Moodle PHP backend
4. Compress responses (gzip/brotli)
5. Enforce HTTPS and security headers

### API Proxy Configuration

The web server proxies API requests to the Moodle PHP backend:

**Nginx Example**:
```nginx
location /api/ {
    proxy_pass http://localhost:8080;  # Moodle PHP backend
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

**Benefits**:
- Avoids CORS issues (same origin for frontend and API)
- Simplifies authentication (cookies work across same origin)
- Enables request logging and rate limiting at proxy level
- Allows backend versioning without frontend changes

### Environment Variables

Environment-specific configuration managed via `.env` files:

**Critical Variables**:
```bash
# API Configuration
API_BASE_URL=https://moodle.example.com/api/v1  # Backend API URL
API_TIMEOUT=30000                                # Request timeout (ms)

# Application Configuration
NODE_ENV=production                              # Environment mode
ENABLE_SOURCE_MAPS=false                         # Source map generation
ENABLE_ANALYTICS=true                            # Analytics tracking

# Feature Flags (optional, can be managed in backend)
FEATURE_DASHBOARD=true
FEATURE_COURSES=true
FEATURE_ASSIGNMENTS=false

# Monitoring and Logging
SENTRY_DSN=https://...                           # Error tracking
LOG_LEVEL=error                                  # Logging verbosity
```

**Security Best Practices**:
- Never commit `.env.production` to version control
- Use secret management systems in production (AWS Secrets Manager, Vault)
- Rotate API keys and tokens regularly
- Limit environment variable exposure to build process only

### Feature Flags

Feature flags enable gradual rollout and instant rollback:

**Backend Configuration** (config.php):
```php
$CFG->react_features = [
    'dashboard' => true,      // React dashboard enabled
    'courses' => true,        // React course pages enabled
    'assignments' => false,   // Keep PHP assignments
    'quizzes' => false,       // Keep PHP quizzes
    'gradebook' => false,     // Keep PHP gradebook
];
```

**Rollout Strategy**:
1. Deploy new React feature to production (disabled by flag)
2. Enable for internal users (QA testing in production)
3. Enable for 5% of users (canary release)
4. Monitor metrics for 24 hours
5. Gradually increase to 25%, 50%, 100%
6. Remove PHP fallback code after full rollout

**Instant Rollback**:
- Set feature flag to `false` in config.php
- No code deployment required
- Takes effect immediately (next page load)

## Deployment Checklist

### Pre-Deployment

- [ ] Code review completed and approved
- [ ] All tests passing (unit, integration, E2E)
- [ ] Lighthouse performance score >90
- [ ] Accessibility audit passed (WCAG 2.1 AA)
- [ ] Security audit completed (no critical vulnerabilities)
- [ ] Staging environment testing successful
- [ ] Database migrations applied (if any, should be rare)
- [ ] Feature flags configured correctly
- [ ] Monitoring and alerting verified
- [ ] Rollback plan documented and tested

### Deployment

- [ ] Notify stakeholders of deployment window
- [ ] Take snapshot/backup of current deployment
- [ ] Build production bundle with correct environment
- [ ] Verify build artifact integrity (checksums)
- [ ] Deploy to production servers (blue-green or rolling)
- [ ] Verify static files served correctly
- [ ] Verify API proxy configuration
- [ ] Test critical user journeys (smoke tests)
- [ ] Monitor error rates and performance metrics
- [ ] Enable feature flags (if new features)

### Post-Deployment

- [ ] Verify all critical functionality operational
- [ ] Check Core Web Vitals metrics
- [ ] Monitor error tracking dashboard (15 minutes)
- [ ] Review server logs for anomalies
- [ ] Test across different browsers and devices
- [ ] Validate authentication flows (login, logout, refresh)
- [ ] Check API response times (P50, P95, P99)
- [ ] Update deployment documentation with any issues
- [ ] Notify stakeholders of successful deployment
- [ ] Schedule post-deployment review meeting

## Performance Targets

### Frontend Performance

| Metric | Target | Measurement |
|--------|--------|-------------|
| **First Contentful Paint (FCP)** | <1.5s on 3G | Lighthouse |
| **Largest Contentful Paint (LCP)** | <2.5s | Core Web Vitals |
| **First Input Delay (FID)** | <100ms | Core Web Vitals |
| **Cumulative Layout Shift (CLS)** | <0.1 | Core Web Vitals |
| **Time to Interactive (TTI)** | <5s | Lighthouse |
| **Main Bundle Size** | <300KB gzipped | Bundle analyzer |
| **Lighthouse Performance Score** | >90 | Lighthouse CI |

### Backend API Performance

| Metric | Target | Measurement |
|--------|--------|-------------|
| **P50 Response Time** | <300ms | APM |
| **P95 Response Time** | <1s | APM |
| **P99 Response Time** | <3s | APM |
| **Error Rate** | <0.1% | APM |
| **API Availability** | >99.9% | Uptime monitoring |

### Optimization Strategies

1. **Code Splitting**: Lazy load routes and feature modules
2. **Tree Shaking**: Eliminate unused code from bundles
3. **Image Optimization**: WebP format, responsive sizes, lazy loading
4. **CDN Distribution**: Serve static assets from edge locations
5. **Caching Strategy**: Aggressive caching with cache-busting hashes
6. **Compression**: Brotli/gzip compression on web server
7. **Critical CSS**: Inline critical CSS for above-the-fold content
8. **Preloading**: Preload critical resources (fonts, API data)

## Security Considerations

### HTTPS Enforcement

All production deployments MUST use HTTPS:

```nginx
# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name moodle.example.com;
    return 301 https://$host$request_uri;
}

# HTTPS server
server {
    listen 443 ssl http2;
    server_name moodle.example.com;
    
    ssl_certificate /etc/letsencrypt/live/moodle.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/moodle.example.com/privkey.pem;
    
    # Modern SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
}
```

### Security Headers

Configure security headers on web server:

```nginx
# Security headers
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://moodle.example.com;" always;
```

### CORS Configuration

Backend API must configure CORS headers correctly:

```php
// api/lib/api_base.php
header('Access-Control-Allow-Origin: https://moodle.example.com');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Max-Age: 86400');
```

**Security Rules**:
- NEVER use wildcard (`*`) for `Access-Control-Allow-Origin` in production
- Whitelist specific domains only
- Use `Access-Control-Allow-Credentials: true` for cookie-based auth
- Implement rate limiting to prevent abuse

## Support and Resources

### Documentation Links

- **Main README**: [../README.md](../../README.md) - Frontend overview and quick start
- **Architecture Docs**: [../architecture/README.md](../architecture/README.md) - System architecture and design decisions
- **Development Guide**: [../development/setup.md](../development/setup.md) - Development environment setup
- **Testing Guide**: [../development/testing.md](../development/testing.md) - Testing strategies and tools

### Additional Resources

- **Vite Documentation**: [https://vitejs.dev/guide/](https://vitejs.dev/guide/)
- **React 18 Docs**: [https://react.dev/](https://react.dev/)
- **Material-UI**: [https://mui.com/material-ui/getting-started/](https://mui.com/material-ui/getting-started/)
- **Nginx Documentation**: [https://nginx.org/en/docs/](https://nginx.org/en/docs/)

### Getting Help

**Technical Issues**:
- **GitHub Issues**: [https://github.com/your-org/moodle/issues](https://github.com/your-org/moodle/issues)
- **Developer Forum**: [https://moodle.org/mod/forum/](https://moodle.org/mod/forum/)
- **Stack Overflow**: Tag questions with `moodle` and `react`

**Deployment Support**:
- **DevOps Team**: devops@example.com
- **Slack Channel**: #moodle-react-deployment
- **On-Call**: Check PagerDuty rotation

**Emergency Contacts**:
- **Production Incidents**: Escalate via PagerDuty
- **Security Issues**: security@example.com (PGP key available)
- **Architecture Questions**: Tech Lead or Architecture Review Board

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2024-01-01 | Initial deployment documentation |

---

**Last Updated**: 2024-01-01  
**Maintained By**: DevOps Team & Frontend Team  
**Review Cycle**: Quarterly or after major releases
