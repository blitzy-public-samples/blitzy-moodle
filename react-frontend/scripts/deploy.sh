#!/usr/bin/env bash

# ============================================================================
# Moodle React Frontend - Deployment Script
# ============================================================================
# Automated deployment script for React frontend to staging and production
# environments. Orchestrates the complete deployment workflow including build
# execution, artifact preparation, environment-specific configuration, file
# transfer to target servers, health checks, and rollback capabilities.
#
# Features:
# - Blue-green deployment for zero-downtime production releases
# - Environment-specific configuration management (.env.staging, .env.production)
# - Comprehensive pre-deployment validation (branch, clean working dir, credentials)
# - Automated health checks with automatic rollback on failure
# - Deployment manifest generation with version tracking
# - Safety checks to prevent accidental production deployments
# - Support for dry-run mode to test deployment without changes
#
# Usage:
#   ./scripts/deploy.sh staging                    # Deploy to staging
#   ./scripts/deploy.sh production                 # Deploy to production (with prompt)
#   ./scripts/deploy.sh production --force         # Deploy to production (skip prompt)
#   ./scripts/deploy.sh staging --dry-run          # Test staging deployment
#   ./scripts/deploy.sh production --skip-tests    # Skip build tests (not recommended)
#   ./scripts/deploy.sh staging --rollback         # Rollback staging to previous version
#
# Prerequisites:
#   - Environment-specific .env files (.env.staging, .env.production)
#   - SSH keys configured for target servers
#   - Deployment server configuration in config files
#   - Required commands: git, rsync, ssh, tar, gzip, curl, jq
#
# Exit Codes:
#   0 - Deployment successful
#   1 - Validation error (environment, credentials, dependencies, etc.)
#   2 - Build failure
#   3 - Deployment failure (transfer, extraction, permissions, etc.)
#   4 - Health check failure (automatic rollback triggered)
# ============================================================================

# Exit immediately if a command exits with a non-zero status
set -e

# ============================================================================
# Script Directory and Configuration
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${PROJECT_ROOT}"

# ============================================================================
# Color Output Configuration
# ============================================================================

if command -v tput >/dev/null 2>&1 && [ -t 1 ]; then
    COLOR_RESET=$(tput sgr0)
    COLOR_BOLD=$(tput bold)
    COLOR_RED=$(tput setaf 1)
    COLOR_GREEN=$(tput setaf 2)
    COLOR_YELLOW=$(tput setaf 3)
    COLOR_BLUE=$(tput setaf 4)
    COLOR_CYAN=$(tput setaf 6)
else
    COLOR_RESET=""
    COLOR_BOLD=""
    COLOR_RED=""
    COLOR_GREEN=""
    COLOR_YELLOW=""
    COLOR_BLUE=""
    COLOR_CYAN=""
fi

# ============================================================================
# Logging Functions
# ============================================================================

log_info() {
    echo "${COLOR_BLUE}[INFO]${COLOR_RESET} $*"
}

log_success() {
    echo "${COLOR_GREEN}[SUCCESS]${COLOR_RESET} $*"
}

log_warning() {
    echo "${COLOR_YELLOW}[WARNING]${COLOR_RESET} $*"
}

log_error() {
    echo "${COLOR_RED}[ERROR]${COLOR_RESET} $*" >&2
}

log_step() {
    echo ""
    echo "${COLOR_CYAN}${COLOR_BOLD}==>${COLOR_RESET} ${COLOR_BOLD}$*${COLOR_RESET}"
    echo ""
}

# ============================================================================
# Deployment Configuration
# ============================================================================

ENVIRONMENT=""
DRY_RUN=false
SKIP_TESTS=false
SKIP_CONFIRMATION=false
DO_ROLLBACK=false

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DEPLOY_DIR="/tmp/moodle-react-deploy-${TIMESTAMP}"
ARTIFACT_NAME="moodle-react-${TIMESTAMP}.tar.gz"
LOG_FILE="${PROJECT_ROOT}/deployment-${TIMESTAMP}.log"

# Server configurations (should be moved to separate config file in production)
declare -A STAGING_CONFIG=(
    [host]="staging.example.com"
    [user]="deploy"
    [deploy_path]="/var/www/moodle-react"
    [health_check_url]="https://staging.example.com/health"
)

declare -A PRODUCTION_CONFIG=(
    [host]="production.example.com"
    [user]="deploy"
    [deploy_path]="/var/www/moodle-react"
    [blue_path]="/var/www/moodle-react-blue"
    [green_path]="/var/www/moodle-react-green"
    [current_link]="/var/www/moodle-react-current"
    [health_check_url]="https://production.example.com/health"
)

# ============================================================================
# Parse Command Line Arguments
# ============================================================================

parse_arguments() {
    if [ $# -eq 0 ]; then
        log_error "Environment parameter required (staging or production)"
        show_usage
        exit 1
    fi

    ENVIRONMENT="$1"
    shift

    while [ $# -gt 0 ]; do
        case "$1" in
            --dry-run)
                DRY_RUN=true
                log_info "Dry-run mode enabled - no actual changes will be made"
                ;;
            --skip-tests)
                SKIP_TESTS=true
                log_warning "Test execution will be skipped (not recommended)"
                ;;
            --force)
                SKIP_CONFIRMATION=true
                log_info "Confirmation prompts will be skipped (CI mode)"
                ;;
            --rollback)
                DO_ROLLBACK=true
                log_info "Rollback mode enabled"
                ;;
            -h|--help)
                show_usage
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                show_usage
                exit 1
                ;;
        esac
        shift
    done

    # Validate environment
    if [ "${ENVIRONMENT}" != "staging" ] && [ "${ENVIRONMENT}" != "production" ]; then
        log_error "Invalid environment: ${ENVIRONMENT}"
        log_error "Must be 'staging' or 'production'"
        exit 1
    fi
}

show_usage() {
    cat << EOF
${COLOR_BOLD}Usage:${COLOR_RESET}
  $0 <environment> [options]

${COLOR_BOLD}Environments:${COLOR_RESET}
  staging          Deploy to staging environment
  production       Deploy to production environment (requires confirmation)

${COLOR_BOLD}Options:${COLOR_RESET}
  --dry-run        Simulate deployment without making actual changes
  --skip-tests     Skip test execution during build (not recommended)
  --force          Skip confirmation prompts (CI mode)
  --rollback       Rollback to previous deployment
  -h, --help       Show this help message

${COLOR_BOLD}Examples:${COLOR_RESET}
  $0 staging                    # Deploy to staging
  $0 production                 # Deploy to production (with confirmation)
  $0 production --force         # Deploy to production (skip confirmation)
  $0 staging --dry-run          # Test staging deployment
  $0 staging --rollback         # Rollback staging deployment

${COLOR_BOLD}Exit Codes:${COLOR_RESET}
  0  Deployment successful
  1  Validation error
  2  Build failure
  3  Deployment failure
  4  Health check failure

EOF
}

# ============================================================================
# Pre-Deployment Validation
# ============================================================================

validate_environment() {
    log_step "Validating deployment environment"

    # Check if environment file exists
    local env_file=".env.${ENVIRONMENT}"
    if [ ! -f "${env_file}" ]; then
        log_error "Environment file not found: ${env_file}"
        log_error "Please create ${env_file} with required configuration"
        exit 1
    fi
    log_success "Environment file found: ${env_file}"

    # Check required commands
    local required_commands=("git" "rsync" "ssh" "tar" "gzip" "curl" "jq")
    for cmd in "${required_commands[@]}"; do
        if ! command -v "${cmd}" >/dev/null 2>&1; then
            log_error "Required command not found: ${cmd}"
            log_error "Please install ${cmd} and try again"
            exit 1
        fi
    done
    log_success "All required commands are available"

    # Check package.json exists
    if [ ! -f "package.json" ]; then
        log_error "package.json not found in ${PROJECT_ROOT}"
        exit 1
    fi
    log_success "package.json found"

    # Extract version information
    local version=$(jq -r '.version' package.json)
    local app_name=$(jq -r '.name' package.json)
    log_info "Application: ${app_name} v${version}"
}

validate_git_repository() {
    log_step "Validating Git repository status"

    # Check if git working directory is clean
    if ! git diff-index --quiet HEAD --; then
        log_error "Git working directory has uncommitted changes"
        log_error "Please commit or stash changes before deploying"
        git status --short
        exit 1
    fi
    log_success "Git working directory is clean"

    # Get current branch
    local current_branch=$(git rev-parse --abbrev-ref HEAD)
    log_info "Current branch: ${current_branch}"

    # Validate branch for production deployments
    if [ "${ENVIRONMENT}" = "production" ]; then
        if [ "${current_branch}" != "main" ] && [ "${current_branch}" != "master" ]; then
            log_error "Production deployments must be from main or master branch"
            log_error "Current branch is: ${current_branch}"
            exit 1
        fi
        log_success "Branch validation passed for production deployment"
    elif [ "${ENVIRONMENT}" = "staging" ]; then
        if [ "${current_branch}" != "develop" ] && [ "${current_branch}" != "main" ] && [ "${current_branch}" != "master" ]; then
            log_warning "Staging deployment recommended from develop branch"
            log_warning "Current branch is: ${current_branch}"
        fi
    fi

    # Get commit information
    local commit_hash=$(git rev-parse HEAD)
    local commit_short=$(git rev-parse --short HEAD)
    local commit_message=$(git log -1 --pretty=format:"%s")
    
    log_info "Commit: ${commit_short} - ${commit_message}"
    
    # Export for later use
    export GIT_COMMIT_HASH="${commit_hash}"
    export GIT_COMMIT_SHORT="${commit_short}"
    export GIT_BRANCH="${current_branch}"
}

validate_ssh_access() {
    log_step "Validating SSH access to target server"

    local host user
    if [ "${ENVIRONMENT}" = "staging" ]; then
        host="${STAGING_CONFIG[host]}"
        user="${STAGING_CONFIG[user]}"
    else
        host="${PRODUCTION_CONFIG[host]}"
        user="${PRODUCTION_CONFIG[user]}"
    fi

    # Test SSH connection
    if ! ssh -o BatchMode=yes -o ConnectTimeout=5 "${user}@${host}" "echo 'SSH connection successful'" >/dev/null 2>&1; then
        log_error "Cannot establish SSH connection to ${user}@${host}"
        log_error "Please check:"
        log_error "  - SSH keys are configured correctly"
        log_error "  - Target server is accessible"
        log_error "  - User has proper permissions"
        exit 1
    fi
    log_success "SSH connection to ${user}@${host} successful"
}

confirm_production_deployment() {
    if [ "${ENVIRONMENT}" != "production" ]; then
        return 0
    fi

    if [ "${SKIP_CONFIRMATION}" = true ]; then
        log_warning "Skipping production deployment confirmation (--force flag)"
        return 0
    fi

    log_step "Production Deployment Confirmation"
    echo "${COLOR_YELLOW}${COLOR_BOLD}WARNING: You are about to deploy to PRODUCTION${COLOR_RESET}"
    echo ""
    echo "Environment: ${COLOR_RED}${COLOR_BOLD}PRODUCTION${COLOR_RESET}"
    echo "Branch: ${GIT_BRANCH}"
    echo "Commit: ${GIT_COMMIT_SHORT}"
    echo "Target: ${PRODUCTION_CONFIG[host]}"
    echo ""
    echo -n "Are you sure you want to proceed? [y/N] "
    read -r response
    
    if [ "${response}" != "y" ] && [ "${response}" != "Y" ]; then
        log_info "Deployment cancelled by user"
        exit 0
    fi
    
    log_success "Production deployment confirmed"
}

# ============================================================================
# Build Execution
# ============================================================================

execute_build() {
    log_step "Executing production build"

    # Prepare build options
    local build_options=""
    if [ "${SKIP_TESTS}" = true ]; then
        build_options="${build_options} --skip-tests"
    fi

    # Execute build script
    if [ "${DRY_RUN}" = false ]; then
        if ! bash "${SCRIPT_DIR}/build.sh" ${build_options}; then
            log_error "Build failed"
            exit 2
        fi
        log_success "Build completed successfully"
    else
        log_info "[DRY-RUN] Would execute: bash ${SCRIPT_DIR}/build.sh ${build_options}"
    fi

    # Verify dist directory exists and contains files
    if [ "${DRY_RUN}" = false ]; then
        if [ ! -d "dist" ]; then
            log_error "dist/ directory not found after build"
            exit 2
        fi

        if [ ! -f "dist/index.html" ]; then
            log_error "dist/index.html not found after build"
            exit 2
        fi

        local file_count=$(find dist -type f | wc -l)
        log_success "dist/ directory contains ${file_count} files"
    fi
}

# ============================================================================
# Artifact Preparation
# ============================================================================

prepare_deployment_artifact() {
    log_step "Preparing deployment artifact"

    # Create temporary deployment directory
    if [ "${DRY_RUN}" = false ]; then
        mkdir -p "${DEPLOY_DIR}"
        log_info "Created deployment directory: ${DEPLOY_DIR}"
    else
        log_info "[DRY-RUN] Would create: ${DEPLOY_DIR}"
    fi

    # Copy dist directory
    if [ "${DRY_RUN}" = false ]; then
        cp -r dist/* "${DEPLOY_DIR}/"
        log_success "Copied dist/ contents to deployment directory"
    else
        log_info "[DRY-RUN] Would copy dist/ to ${DEPLOY_DIR}/"
    fi

    # Copy environment-specific .env file
    local env_file=".env.${ENVIRONMENT}"
    if [ "${DRY_RUN}" = false ]; then
        cp "${env_file}" "${DEPLOY_DIR}/.env"
        log_success "Copied ${env_file} to deployment directory"
    else
        log_info "[DRY-RUN] Would copy ${env_file} to ${DEPLOY_DIR}/.env"
    fi

    # Generate deployment manifest
    generate_deployment_manifest

    # Create deployment package
    if [ "${DRY_RUN}" = false ]; then
        local artifact_path="${PROJECT_ROOT}/${ARTIFACT_NAME}"
        tar -czf "${artifact_path}" -C "$(dirname "${DEPLOY_DIR}")" "$(basename "${DEPLOY_DIR}")"
        
        local artifact_size=$(du -h "${artifact_path}" | cut -f1)
        log_success "Created deployment artifact: ${ARTIFACT_NAME} (${artifact_size})"
        
        # Calculate checksum
        local checksum=$(sha256sum "${artifact_path}" | cut -d' ' -f1)
        log_info "Artifact checksum (SHA-256): ${checksum}"
        
        # Export for later use
        export ARTIFACT_PATH="${artifact_path}"
        export ARTIFACT_CHECKSUM="${checksum}"
    else
        log_info "[DRY-RUN] Would create: ${ARTIFACT_NAME}"
    fi
}

generate_deployment_manifest() {
    local manifest_file="${DEPLOY_DIR}/deployment-manifest.json"
    
    if [ "${DRY_RUN}" = false ]; then
        local version=$(jq -r '.version' package.json)
        local app_name=$(jq -r '.name' package.json)
        
        cat > "${manifest_file}" << EOF
{
  "application": "${app_name}",
  "version": "${version}",
  "environment": "${ENVIRONMENT}",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "git": {
    "branch": "${GIT_BRANCH}",
    "commit": "${GIT_COMMIT_HASH}",
    "commit_short": "${GIT_COMMIT_SHORT}"
  },
  "build": {
    "node_version": "$(node --version)",
    "npm_version": "$(npm --version)"
  },
  "deployed_by": "${USER}",
  "deployment_id": "${TIMESTAMP}"
}
EOF
        log_success "Generated deployment manifest"
    else
        log_info "[DRY-RUN] Would generate deployment manifest"
    fi
}

# ============================================================================
# Deployment Strategies
# ============================================================================

deploy_to_staging() {
    log_step "Deploying to staging environment"

    local host="${STAGING_CONFIG[host]}"
    local user="${STAGING_CONFIG[user]}"
    local deploy_path="${STAGING_CONFIG[deploy_path]}"
    local remote="${user}@${host}"

    # Backup previous deployment
    backup_deployment "${remote}" "${deploy_path}"

    # Transfer artifact to server
    transfer_artifact "${remote}" "${deploy_path}"

    # Extract and deploy
    extract_and_deploy "${remote}" "${deploy_path}"

    # Set permissions
    set_permissions "${remote}" "${deploy_path}"

    # Restart web server
    restart_web_server "${remote}"

    log_success "Staging deployment completed"
}

deploy_to_production() {
    log_step "Deploying to production environment (Blue-Green)"

    local host="${PRODUCTION_CONFIG[host]}"
    local user="${PRODUCTION_CONFIG[user]}"
    local blue_path="${PRODUCTION_CONFIG[blue_path]}"
    local green_path="${PRODUCTION_CONFIG[green_path]}"
    local current_link="${PRODUCTION_CONFIG[current_link]}"
    local remote="${user}@${host}"

    # Determine current and target deployment slots
    determine_deployment_slots "${remote}" "${current_link}" "${blue_path}" "${green_path}"

    # Deploy to inactive slot
    log_info "Deploying to ${TARGET_SLOT} slot"
    
    # Backup previous deployment in target slot
    backup_deployment "${remote}" "${TARGET_PATH}"

    # Transfer artifact to server
    transfer_artifact "${remote}" "${TARGET_PATH}"

    # Extract and deploy
    extract_and_deploy "${remote}" "${TARGET_PATH}"

    # Set permissions
    set_permissions "${remote}" "${TARGET_PATH}"

    # Perform health check on new deployment
    if ! health_check_deployment "${remote}" "${TARGET_PATH}"; then
        log_error "Health check failed on new deployment"
        rollback_failed_deployment "${remote}"
        exit 4
    fi

    # Switch symlink to new deployment
    switch_deployment "${remote}" "${current_link}" "${TARGET_PATH}"

    # Restart web server
    restart_web_server "${remote}"

    # Final health check
    if ! health_check_public_endpoint; then
        log_error "Public health check failed after deployment"
        log_warning "Initiating automatic rollback"
        rollback_failed_deployment "${remote}"
        exit 4
    fi

    log_success "Production deployment completed (Blue-Green)"
}

determine_deployment_slots() {
    local remote="$1"
    local current_link="$2"
    local blue_path="$3"
    local green_path="$4"

    if [ "${DRY_RUN}" = false ]; then
        # Check which slot is currently active
        local current_target=$(ssh "${remote}" "readlink -f '${current_link}' 2>/dev/null || echo 'none'")
        
        if [ "${current_target}" = "${blue_path}" ]; then
            export CURRENT_SLOT="blue"
            export TARGET_SLOT="green"
            export TARGET_PATH="${green_path}"
        else
            export CURRENT_SLOT="green"
            export TARGET_SLOT="blue"
            export TARGET_PATH="${blue_path}"
        fi
        
        log_info "Current active slot: ${CURRENT_SLOT}"
        log_info "Target deployment slot: ${TARGET_SLOT}"
    else
        log_info "[DRY-RUN] Would determine current/target deployment slots"
        export CURRENT_SLOT="blue"
        export TARGET_SLOT="green"
        export TARGET_PATH="${green_path}"
    fi
}

# ============================================================================
# Deployment Operations
# ============================================================================

backup_deployment() {
    local remote="$1"
    local deploy_path="$2"

    if [ "${DRY_RUN}" = false ]; then
        log_info "Backing up previous deployment"
        
        # Check if deployment directory exists
        if ssh "${remote}" "[ -d '${deploy_path}' ]"; then
            local backup_name="backup-$(date +%Y%m%d_%H%M%S)"
            ssh "${remote}" "cp -r '${deploy_path}' '${deploy_path}.${backup_name}'"
            log_success "Created backup: ${deploy_path}.${backup_name}"
        else
            log_info "No previous deployment found (first deployment)"
        fi
    else
        log_info "[DRY-RUN] Would backup: ${deploy_path}"
    fi
}

transfer_artifact() {
    local remote="$1"
    local deploy_path="$2"

    if [ "${DRY_RUN}" = false ]; then
        log_info "Transferring artifact to server"
        
        # Create deployment directory on remote server
        ssh "${remote}" "mkdir -p '${deploy_path}'"
        
        # Transfer artifact using rsync
        rsync -avz --progress "${ARTIFACT_PATH}" "${remote}:/tmp/"
        
        log_success "Artifact transferred successfully"
    else
        log_info "[DRY-RUN] Would transfer: ${ARTIFACT_NAME} to ${remote}:/tmp/"
    fi
}

extract_and_deploy() {
    local remote="$1"
    local deploy_path="$2"

    if [ "${DRY_RUN}" = false ]; then
        log_info "Extracting and deploying artifact"
        
        # Extract artifact on remote server
        ssh "${remote}" << EOF
            cd /tmp
            tar -xzf '${ARTIFACT_NAME}'
            
            # Remove old files in deployment directory
            rm -rf '${deploy_path}'/*
            
            # Move extracted files to deployment directory
            mv 'moodle-react-deploy-${TIMESTAMP}'/* '${deploy_path}/'
            
            # Cleanup
            rm -rf 'moodle-react-deploy-${TIMESTAMP}'
            rm -f '${ARTIFACT_NAME}'
EOF
        
        log_success "Artifact extracted and deployed"
    else
        log_info "[DRY-RUN] Would extract artifact to ${deploy_path}"
    fi
}

set_permissions() {
    local remote="$1"
    local deploy_path="$2"

    if [ "${DRY_RUN}" = false ]; then
        log_info "Setting file permissions"
        
        ssh "${remote}" << EOF
            # Set proper ownership (www-data is common for nginx/apache)
            sudo chown -R www-data:www-data '${deploy_path}'
            
            # Set directory permissions (755 = rwxr-xr-x)
            find '${deploy_path}' -type d -exec chmod 755 {} \;
            
            # Set file permissions (644 = rw-r--r--)
            find '${deploy_path}' -type f -exec chmod 644 {} \;
EOF
        
        log_success "File permissions set"
    else
        log_info "[DRY-RUN] Would set permissions on ${deploy_path}"
    fi
}

switch_deployment() {
    local remote="$1"
    local current_link="$2"
    local target_path="$3"

    if [ "${DRY_RUN}" = false ]; then
        log_info "Switching deployment symlink"
        
        ssh "${remote}" << EOF
            # Remove old symlink
            rm -f '${current_link}'
            
            # Create new symlink
            ln -s '${target_path}' '${current_link}'
EOF
        
        log_success "Deployment symlink switched to ${TARGET_SLOT} slot"
    else
        log_info "[DRY-RUN] Would switch symlink to ${target_path}"
    fi
}

restart_web_server() {
    local remote="$1"

    if [ "${DRY_RUN}" = false ]; then
        log_info "Restarting web server"
        
        # Reload nginx (graceful reload without dropping connections)
        if ssh "${remote}" "sudo nginx -t" 2>/dev/null; then
            ssh "${remote}" "sudo nginx -s reload"
            log_success "Nginx reloaded successfully"
        else
            log_warning "Nginx configuration test failed, skipping reload"
        fi
    else
        log_info "[DRY-RUN] Would reload nginx"
    fi
}

# ============================================================================
# Health Checks
# ============================================================================

health_check_deployment() {
    local remote="$1"
    local deploy_path="$2"

    log_info "Performing health check on deployment"

    if [ "${DRY_RUN}" = false ]; then
        # Check if critical files exist
        local required_files=("index.html" "deployment-manifest.json" ".env")
        
        for file in "${required_files[@]}"; do
            if ! ssh "${remote}" "[ -f '${deploy_path}/${file}' ]"; then
                log_error "Required file not found: ${file}"
                return 1
            fi
        done
        
        log_success "All required files present"
        return 0
    else
        log_info "[DRY-RUN] Would check health of deployment"
        return 0
    fi
}

health_check_public_endpoint() {
    log_info "Performing public health check"

    local health_check_url
    if [ "${ENVIRONMENT}" = "staging" ]; then
        health_check_url="${STAGING_CONFIG[health_check_url]}"
    else
        health_check_url="${PRODUCTION_CONFIG[health_check_url]}"
    fi

    if [ "${DRY_RUN}" = false ]; then
        # Give server a moment to start
        sleep 5
        
        # Perform health check with retries
        local max_retries=3
        local retry_count=0
        
        while [ ${retry_count} -lt ${max_retries} ]; do
            if curl -f -s -o /dev/null -w "%{http_code}" "${health_check_url}" | grep -q "200"; then
                log_success "Health check passed (HTTP 200)"
                return 0
            fi
            
            retry_count=$((retry_count + 1))
            if [ ${retry_count} -lt ${max_retries} ]; then
                log_warning "Health check failed, retrying (${retry_count}/${max_retries})..."
                sleep 5
            fi
        done
        
        log_error "Health check failed after ${max_retries} attempts"
        return 1
    else
        log_info "[DRY-RUN] Would check: ${health_check_url}"
        return 0
    fi
}

# ============================================================================
# Rollback Operations
# ============================================================================

rollback_failed_deployment() {
    local remote="$1"

    log_step "Rolling back failed deployment"

    if [ "${ENVIRONMENT}" = "production" ]; then
        local current_link="${PRODUCTION_CONFIG[current_link]}"
        local rollback_slot
        local rollback_path
        
        if [ "${CURRENT_SLOT}" = "blue" ]; then
            rollback_slot="blue"
            rollback_path="${PRODUCTION_CONFIG[blue_path]}"
        else
            rollback_slot="green"
            rollback_path="${PRODUCTION_CONFIG[green_path]}"
        fi
        
        log_info "Rolling back to ${rollback_slot} slot"
        
        if [ "${DRY_RUN}" = false ]; then
            ssh "${remote}" << EOF
                rm -f '${current_link}'
                ln -s '${rollback_path}' '${current_link}'
                sudo nginx -s reload
EOF
            log_success "Rollback completed"
        else
            log_info "[DRY-RUN] Would rollback to ${rollback_path}"
        fi
    else
        # Staging rollback
        local deploy_path="${STAGING_CONFIG[deploy_path]}"
        local backup_path=$(ssh "${remote}" "ls -td '${deploy_path}'.backup-* 2>/dev/null | head -1" || echo "")
        
        if [ -n "${backup_path}" ]; then
            log_info "Rolling back to: ${backup_path}"
            
            if [ "${DRY_RUN}" = false ]; then
                ssh "${remote}" << EOF
                    rm -rf '${deploy_path}'
                    cp -r '${backup_path}' '${deploy_path}'
                    sudo nginx -s reload
EOF
                log_success "Rollback completed"
            else
                log_info "[DRY-RUN] Would rollback to ${backup_path}"
            fi
        else
            log_error "No backup found for rollback"
            return 1
        fi
    fi
}

perform_manual_rollback() {
    log_step "Performing manual rollback"

    validate_environment
    validate_ssh_access

    local host user remote
    if [ "${ENVIRONMENT}" = "staging" ]; then
        host="${STAGING_CONFIG[host]}"
        user="${STAGING_CONFIG[user]}"
        remote="${user}@${host}"
        
        rollback_failed_deployment "${remote}"
    else
        host="${PRODUCTION_CONFIG[host]}"
        user="${PRODUCTION_CONFIG[user]}"
        remote="${user}@${host}"
        
        # For production, switch back to the other slot
        local current_link="${PRODUCTION_CONFIG[current_link]}"
        local blue_path="${PRODUCTION_CONFIG[blue_path]}"
        local green_path="${PRODUCTION_CONFIG[green_path]}"
        
        determine_deployment_slots "${remote}" "${current_link}" "${blue_path}" "${green_path}"
        
        # Current slot becomes the rollback target
        rollback_failed_deployment "${remote}"
    fi
    
    # Verify health after rollback
    if health_check_public_endpoint; then
        log_success "Rollback successful and health check passed"
    else
        log_warning "Rollback completed but health check failed"
    fi
}

# ============================================================================
# Cleanup
# ============================================================================

cleanup() {
    if [ "${DRY_RUN}" = false ]; then
        log_info "Cleaning up temporary files"
        
        if [ -d "${DEPLOY_DIR}" ]; then
            rm -rf "${DEPLOY_DIR}"
        fi
        
        if [ -f "${ARTIFACT_PATH}" ]; then
            rm -f "${ARTIFACT_PATH}"
        fi
        
        log_success "Cleanup completed"
    fi
}

# ============================================================================
# Main Execution Flow
# ============================================================================

main() {
    local start_time=$(date +%s)
    
    # Log deployment start
    log_step "Moodle React Frontend Deployment"
    log_info "Environment: ${COLOR_BOLD}${ENVIRONMENT}${COLOR_RESET}"
    log_info "Timestamp: $(date)"
    log_info "Log file: ${LOG_FILE}"
    
    # Execute deployment workflow
    if [ "${DO_ROLLBACK}" = true ]; then
        perform_manual_rollback
    else
        validate_environment
        validate_git_repository
        validate_ssh_access
        confirm_production_deployment
        execute_build
        prepare_deployment_artifact
        
        if [ "${ENVIRONMENT}" = "staging" ]; then
            deploy_to_staging
        else
            deploy_to_production
        fi
        
        # Verify final health check
        if ! health_check_public_endpoint; then
            log_error "Final health check failed"
            exit 4
        fi
    fi
    
    # Cleanup temporary files
    cleanup
    
    # Calculate deployment duration
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    # Log deployment completion
    log_step "Deployment Summary"
    log_success "Deployment completed successfully"
    log_info "Environment: ${ENVIRONMENT}"
    log_info "Duration: ${duration} seconds"
    log_info "Commit: ${GIT_COMMIT_SHORT}"
    
    if [ "${DRY_RUN}" = true ]; then
        echo ""
        log_warning "This was a DRY-RUN - no actual changes were made"
    fi
    
    exit 0
}

# ============================================================================
# Script Entry Point
# ============================================================================

# Handle Ctrl+C gracefully
trap 'log_error "Deployment interrupted by user"; cleanup; exit 130' INT

# Parse arguments and execute main function
parse_arguments "$@"

# Execute main deployment workflow (redirect output to log file)
if [ "${DRY_RUN}" = false ]; then
    main 2>&1 | tee "${LOG_FILE}"
else
    main
fi
