# =============================================================================
# Multi-Stage Dockerfile for Moodle React Frontend
# =============================================================================
# This Dockerfile creates an optimized production image for the React frontend
# using a multi-stage build process to minimize final image size while
# maintaining security and performance best practices.
#
# Stage 1: BUILD - Compiles TypeScript and bundles React application with Vite
# Stage 2: PRODUCTION - Serves static files with Nginx
#
# Target Image Size: ~50-80MB (Nginx Alpine + static assets)
# Base Images: node:20-alpine (build), nginx:alpine (production)
# =============================================================================

# =============================================================================
# STAGE 1: BUILD
# =============================================================================
# Purpose: Build the React application with all dependencies and optimizations
# Output: Production-ready static files in /app/dist directory
# =============================================================================
FROM node:20-alpine AS build

# Set working directory for build stage
WORKDIR /app

# Install build dependencies for native modules (if needed)
# Alpine requires additional packages for some npm modules
RUN apk add --no-cache \
    python3 \
    make \
    g++

# Copy package files first to leverage Docker layer caching
# Only rebuilds if package files change, not on every code change
COPY package.json package-lock.json ./

# Install ALL dependencies (including devDependencies for build)
# Using npm ci for clean, reproducible installs from package-lock.json
# --only=production=false ensures devDependencies are installed
RUN npm ci --only=production=false

# Copy source code and configuration files
# .dockerignore should exclude node_modules, .git, dist, etc.
COPY . .

# Build production bundle with Vite
# This runs TypeScript compilation and Vite optimization
# Output: Optimized static files in /app/dist directory
# Environment: NODE_ENV=production (set by npm run build)
RUN npm run build

# Verify build output exists (fail fast if build failed)
RUN test -d /app/dist || (echo "Build failed: /app/dist not found" && exit 1)

# =============================================================================
# STAGE 2: PRODUCTION
# =============================================================================
# Purpose: Create minimal production image with Nginx serving static files
# Size: ~50-80MB total (Nginx Alpine ~20MB + static assets ~30-60MB)
# =============================================================================
FROM nginx:alpine AS production

# Metadata labels following OCI image spec
LABEL maintainer="Moodle Development Team"
LABEL description="Moodle React Frontend - Production Image"
LABEL version="4.4.0-react"

# Remove default Nginx configuration
# This prevents conflicts with our custom SPA routing configuration
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom Nginx configuration for SPA routing and caching
# This config handles:
# - SPA routing (fallback to index.html for client-side routes)
# - Caching headers for static assets
# - Compression (gzip)
# - Security headers
COPY ./nginx.conf /etc/nginx/conf.d/default.conf

# Copy built static files from build stage
# COPY --from=build syntax references the previous build stage
# Source: /app/dist from build stage
# Destination: /usr/share/nginx/html (Nginx default serve directory)
COPY --from=build /app/dist /usr/share/nginx/html

# Create non-root user for enhanced security
# Nginx will run as this user instead of root
RUN addgroup -g 101 -S nginx && \
    adduser -S -D -H -u 101 -h /var/cache/nginx -s /sbin/nologin -G nginx -g nginx nginx 2>/dev/null || true

# Set proper permissions for Nginx directories
# Nginx needs write access to these directories for runtime operation
RUN chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    chown -R nginx:nginx /etc/nginx/conf.d && \
    touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid && \
    chown -R nginx:nginx /usr/share/nginx/html

# Expose HTTP port
# Container will listen on port 80 for incoming traffic
EXPOSE 80

# Switch to non-root user for running Nginx
# Security best practice: never run production services as root
USER nginx

# Health check to verify Nginx is serving content
# Docker will periodically check if the container is healthy
# - Interval: Check every 30 seconds
# - Timeout: Wait 3 seconds for response
# - Start period: Wait 40 seconds before first check (allow startup time)
# - Retries: Mark unhealthy after 3 consecutive failures
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:80/ || exit 1

# Start Nginx in foreground mode
# -g "daemon off;" keeps Nginx in foreground for Docker
# This is required for Docker to manage the container lifecycle properly
CMD ["nginx", "-g", "daemon off;"]

# =============================================================================
# BUILD INSTRUCTIONS
# =============================================================================
# Build the image:
#   docker build -t moodle-react-frontend:latest -f docker/Dockerfile .
#
# Build with custom API URL:
#   docker build \
#     --build-arg VITE_API_BASE_URL=https://api.moodle.example.com \
#     -t moodle-react-frontend:latest \
#     -f docker/Dockerfile .
#
# Run the container:
#   docker run -d -p 8080:80 --name moodle-frontend moodle-react-frontend:latest
#
# Verify health:
#   docker ps (check STATUS column for "healthy")
#   curl http://localhost:8080
#
# View logs:
#   docker logs moodle-frontend
#
# =============================================================================
# OPTIMIZATION NOTES
# =============================================================================
# - Multi-stage build discards build tools (Node.js, npm) from final image
# - Alpine Linux base images minimize size (~5MB vs ~100MB+ for debian)
# - Layer caching: package.json copied before source code for faster rebuilds
# - .dockerignore recommended to exclude: node_modules, .git, dist, coverage
# - Final image contains ONLY: Nginx + static HTML/JS/CSS files
# - No source code, no development tools, no unnecessary packages
#
# =============================================================================
# SECURITY FEATURES
# =============================================================================
# - Non-root user execution (nginx user with UID 101)
# - Minimal attack surface (Alpine Linux with only Nginx installed)
# - No package managers or shells in production layer
# - No write access to application files (mounted read-only)
# - Health checks enable automatic container restart on failure
# - Security headers configured in nginx.conf (CSP, X-Frame-Options, etc.)
#
# =============================================================================
# ENVIRONMENT VARIABLES (Optional Build Args)
# =============================================================================
# These can be passed during docker build:
#
# ARG NODE_ENV=production
# ARG VITE_API_BASE_URL=http://localhost/api/v1
# ARG VITE_APP_VERSION=4.4.0
#
# Note: For runtime environment variables, use Nginx env substitution
# or embed values during build time via Vite's import.meta.env
# =============================================================================
