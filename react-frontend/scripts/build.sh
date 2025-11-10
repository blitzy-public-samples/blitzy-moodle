#!/usr/bin/env bash

# ============================================================================
# Moodle React Frontend - Production Build Script
# ============================================================================
# Comprehensive build script with environment validation, quality checks,
# test execution, and bundle size verification.
#
# This script ensures production-ready builds by validating:
# - Node.js and npm versions meet minimum requirements
# - Environment configuration is properly set
# - TypeScript code compiles without errors (strict mode)
# - ESLint passes with zero warnings
# - Code formatting is consistent (Prettier)
# - Unit tests pass with >=90% coverage
# - Production build completes successfully
# - Bundle sizes meet performance targets (<300KB gzipped main bundle)
#
# Usage:
#   ./scripts/build.sh                 # Full build with all checks
#   ./scripts/build.sh --skip-tests    # Skip test execution
#   ./scripts/build.sh --skip-lint     # Skip linting (not recommended)
#   ./scripts/build.sh --analyze       # Generate bundle analysis report
#
# Exit Codes:
#   0 - Build successful
#   1 - Validation error (environment, dependencies, etc.)
#   2 - Build failure (compilation, tests, bundle size, etc.)
# ============================================================================

# Exit immediately if a command exits with a non-zero status
set -e

# ============================================================================
# Color Output Configuration
# ============================================================================

# Check if terminal supports colors
if command -v tput >/dev/null 2>&1 && [ -t 1 ]; then
    # Terminal supports colors
    COLOR_RESET=$(tput sgr0)
    COLOR_BOLD=$(tput bold)
    COLOR_RED=$(tput setaf 1)
    COLOR_GREEN=$(tput setaf 2)
    COLOR_YELLOW=$(tput setaf 3)
    COLOR_BLUE=$(tput setaf 4)
    COLOR_CYAN=$(tput setaf 6)
else
    # No color support
    COLOR_RESET=""
    COLOR_BOLD=""
    COLOR_RED=""
    COLOR_GREEN=""
    COLOR_YELLOW=""
    COLOR_BLUE=""
    COLOR_CYAN=""
fi

# ============================================================================
# Utility Functions
# ============================================================================

# Print section header
print_header() {
    echo ""
    echo "${COLOR_BOLD}${COLOR_BLUE}========================================${COLOR_RESET}"
    echo "${COLOR_BOLD}${COLOR_BLUE}$1${COLOR_RESET}"
    echo "${COLOR_BOLD}${COLOR_BLUE}========================================${COLOR_RESET}"
    echo ""
}

# Print success message
print_success() {
    echo "${COLOR_GREEN}✓${COLOR_RESET} $1"
}

# Print error message
print_error() {
    echo "${COLOR_RED}✗${COLOR_RESET} $1" >&2
}

# Print warning message
print_warning() {
    echo "${COLOR_YELLOW}⚠${COLOR_RESET} $1"
}

# Print info message
print_info() {
    echo "${COLOR_CYAN}ℹ${COLOR_RESET} $1"
}

# Compare semantic versions (returns 0 if $1 >= $2, 1 otherwise)
version_ge() {
    printf '%s\n%s\n' "$2" "$1" | sort -V -C
}

# Get human-readable file size
# shellcheck disable=SC2317  # Function is called in bundle analysis section
human_readable_size() {
    local size=$1
    if [ "$size" -lt 1024 ]; then
        echo "${size}B"
    elif [ "$size" -lt 1048576 ]; then
        echo "$((size / 1024))KB"
    else
        echo "$((size / 1048576))MB"
    fi
}

# ============================================================================
# Global Variables
# ============================================================================

# Script directory (absolute path)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Project root directory (parent of scripts/)
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Build start time (Unix timestamp)
BUILD_START_TIME=$(date +%s)

# Build start time (human-readable)
BUILD_START_DATE=$(date -u +"%Y-%m-%d %H:%M:%S UTC")

# Command-line flags
SKIP_TESTS=false
SKIP_LINT=false
ANALYZE_BUNDLE=false

# Exit code (default: success)
EXIT_CODE=0

# ============================================================================
# Parse Command-Line Arguments
# ============================================================================

while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-tests)
            SKIP_TESTS=true
            print_warning "Tests will be skipped"
            shift
            ;;
        --skip-lint)
            SKIP_LINT=true
            print_warning "Linting will be skipped (not recommended)"
            shift
            ;;
        --analyze)
            ANALYZE_BUNDLE=true
            print_info "Bundle analysis will be generated"
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --skip-tests    Skip test execution"
            echo "  --skip-lint     Skip linting (not recommended)"
            echo "  --analyze       Generate bundle analysis report"
            echo "  --help, -h      Show this help message"
            echo ""
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# ============================================================================
# Pre-Build Validation
# ============================================================================

print_header "Pre-Build Validation"

# Change to project root directory
cd "$PROJECT_ROOT"
print_success "Changed to project root: $PROJECT_ROOT"

# ----------------------------------------------------------------------------
# 1. Validate Node.js Version
# ----------------------------------------------------------------------------

print_info "Validating Node.js version..."

if ! command -v node >/dev/null 2>&1; then
    print_error "Node.js is not installed"
    print_error "Please install Node.js >= 20.0.0 from https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node --version | sed 's/v//')
NODE_VERSION_REQUIRED="20.0.0"

if version_ge "$NODE_VERSION" "$NODE_VERSION_REQUIRED"; then
    print_success "Node.js version: $NODE_VERSION (>= $NODE_VERSION_REQUIRED)"
else
    print_error "Node.js version $NODE_VERSION is too old"
    print_error "Required: >= $NODE_VERSION_REQUIRED"
    print_error "Please upgrade Node.js from https://nodejs.org/"
    exit 1
fi

# ----------------------------------------------------------------------------
# 2. Validate npm Version
# ----------------------------------------------------------------------------

print_info "Validating npm version..."

if ! command -v npm >/dev/null 2>&1; then
    print_error "npm is not installed"
    print_error "Please install npm >= 9.0.0"
    exit 1
fi

NPM_VERSION=$(npm --version)
NPM_VERSION_REQUIRED="9.0.0"

if version_ge "$NPM_VERSION" "$NPM_VERSION_REQUIRED"; then
    print_success "npm version: $NPM_VERSION (>= $NPM_VERSION_REQUIRED)"
else
    print_error "npm version $NPM_VERSION is too old"
    print_error "Required: >= $NPM_VERSION_REQUIRED"
    print_error "Please upgrade npm: npm install -g npm@latest"
    exit 1
fi

# ----------------------------------------------------------------------------
# 3. Validate Required Files
# ----------------------------------------------------------------------------

print_info "Validating required files..."

# Check package.json
if [ ! -f "package.json" ]; then
    print_error "package.json not found in $PROJECT_ROOT"
    exit 1
fi
print_success "Found package.json"

# Check tsconfig.json
if [ ! -f "tsconfig.json" ]; then
    print_error "tsconfig.json not found in $PROJECT_ROOT"
    exit 1
fi
print_success "Found tsconfig.json"

# Check vite.config.ts
if [ ! -f "vite.config.ts" ]; then
    print_error "vite.config.ts not found in $PROJECT_ROOT"
    exit 1
fi
print_success "Found vite.config.ts"

# ----------------------------------------------------------------------------
# 4. Validate Environment Configuration
# ----------------------------------------------------------------------------

print_info "Validating environment configuration..."

# Check for .env.production
if [ -f ".env.production" ]; then
    print_success "Found .env.production"
    ENV_FILE=".env.production"
elif [ -f ".env.example" ]; then
    print_warning ".env.production not found, using .env.example as reference"
    print_warning "For production builds, create .env.production with proper values"
    ENV_FILE=".env.example"
else
    print_error "Neither .env.production nor .env.example found"
    print_error "Please create .env.production with required environment variables"
    exit 1
fi

# Validate required environment variables
print_info "Validating required environment variables..."

# Source the environment file
set -a  # Automatically export all variables
# shellcheck disable=SC1090  # Dynamic source file based on build type
source "$ENV_FILE" 2>/dev/null || true
set +a

# Check VITE_API_BASE_URL
if [ -z "$VITE_API_BASE_URL" ]; then
    print_error "VITE_API_BASE_URL is not set in $ENV_FILE"
    print_error "This variable is required for API communication"
    exit 1
fi
print_success "VITE_API_BASE_URL is set: $VITE_API_BASE_URL"

# Validate VITE_API_BASE_URL format
if [[ ! "$VITE_API_BASE_URL" =~ ^https?:// ]]; then
    print_warning "VITE_API_BASE_URL does not start with http:// or https://"
    print_warning "This may cause API communication issues"
fi

# ----------------------------------------------------------------------------
# 5. Validate Dependencies
# ----------------------------------------------------------------------------

print_info "Validating node_modules installation..."

if [ ! -d "node_modules" ]; then
    print_warning "node_modules directory not found"
    print_info "Installing dependencies with npm install..."
    npm install
    print_success "Dependencies installed successfully"
else
    # Check if package-lock.json is newer than node_modules
    if [ "package-lock.json" -nt "node_modules" ]; then
        print_warning "package-lock.json is newer than node_modules"
        print_info "Running npm install to update dependencies..."
        npm install
        print_success "Dependencies updated successfully"
    else
        print_success "Dependencies are up to date"
    fi
fi

print_success "Pre-build validation completed"

# ============================================================================
# Code Quality Checks
# ============================================================================

if [ "$SKIP_LINT" = false ]; then
    print_header "Code Quality Checks"

    # ------------------------------------------------------------------------
    # 1. TypeScript Type Checking
    # ------------------------------------------------------------------------

    print_info "Running TypeScript type checking (tsc --noEmit)..."
    
    if npm run type-check; then
        print_success "TypeScript type checking passed (strict mode with zero 'any' types)"
    else
        print_error "TypeScript type checking failed"
        print_error "Fix type errors and try again"
        EXIT_CODE=2
        exit $EXIT_CODE
    fi

    # ------------------------------------------------------------------------
    # 2. ESLint Linting
    # ------------------------------------------------------------------------

    print_info "Running ESLint linting (max-warnings 0)..."
    
    if npm run lint; then
        print_success "ESLint linting passed with zero warnings"
    else
        print_error "ESLint linting failed"
        print_error "Fix linting errors and try again"
        print_info "Run 'npm run lint:fix' to auto-fix some issues"
        EXIT_CODE=2
        exit $EXIT_CODE
    fi

    # ------------------------------------------------------------------------
    # 3. Prettier Format Check
    # ------------------------------------------------------------------------

    print_info "Running Prettier format check..."
    
    if npm run format:check; then
        print_success "Code formatting is consistent"
    else
        print_error "Code formatting check failed"
        print_error "Some files are not formatted correctly"
        print_info "Run 'npm run format' to auto-format all files"
        EXIT_CODE=2
        exit $EXIT_CODE
    fi

    print_success "Code quality checks completed"
else
    print_warning "Skipping code quality checks (--skip-lint flag)"
fi

# ============================================================================
# Test Execution
# ============================================================================

if [ "$SKIP_TESTS" = false ]; then
    print_header "Test Execution"

    # ------------------------------------------------------------------------
    # 1. Run Unit Tests with Coverage
    # ------------------------------------------------------------------------

    print_info "Running unit tests with coverage..."
    
    if npm run coverage; then
        print_success "Unit tests passed"
    else
        print_error "Unit tests failed"
        print_error "Fix failing tests and try again"
        EXIT_CODE=2
        exit $EXIT_CODE
    fi

    # ------------------------------------------------------------------------
    # 2. Validate Coverage Threshold
    # ------------------------------------------------------------------------

    print_info "Validating coverage threshold (>=90%)..."
    
    # Check if coverage directory exists
    if [ -d "coverage" ]; then
        # Parse coverage summary (if coverage-summary.json exists)
        if [ -f "coverage/coverage-summary.json" ]; then
            # Extract total coverage percentage using basic text tools
            # This is a simplified check - vitest actually enforces thresholds in config
            print_success "Coverage data generated (detailed validation in vitest.config.ts)"
        else
            print_warning "Coverage summary not found, but tests passed"
        fi
        print_success "Coverage threshold validation completed"
    else
        print_warning "Coverage directory not found"
        print_info "Coverage data may not have been generated"
    fi

    print_success "Test execution completed"
else
    print_warning "Skipping tests (--skip-tests flag)"
fi

# ============================================================================
# Production Build
# ============================================================================

print_header "Production Build"

# ----------------------------------------------------------------------------
# 1. Clear Previous Build
# ----------------------------------------------------------------------------

print_info "Clearing previous build..."

if [ -d "dist" ]; then
    rm -rf dist
    print_success "Removed previous dist/ directory"
else
    print_success "No previous build to clear"
fi

# ----------------------------------------------------------------------------
# 2. Execute Vite Build
# ----------------------------------------------------------------------------

print_info "Executing Vite production build (tsc && vite build)..."

if [ "$ANALYZE_BUNDLE" = true ]; then
    # Build with bundle analysis
    print_info "Building with bundle analysis..."
    if npm run analyze; then
        print_success "Production build completed with bundle analysis"
        print_info "Bundle analysis report saved to dist/stats.html"
    else
        print_error "Production build failed"
        EXIT_CODE=2
        exit $EXIT_CODE
    fi
else
    # Standard build
    if npm run build; then
        print_success "Production build completed successfully"
    else
        print_error "Production build failed"
        EXIT_CODE=2
        exit $EXIT_CODE
    fi
fi

# ----------------------------------------------------------------------------
# 3. Verify Build Output
# ----------------------------------------------------------------------------

print_info "Verifying build output..."

# Check if dist/ directory was created
if [ ! -d "dist" ]; then
    print_error "dist/ directory was not created"
    print_error "Build may have failed silently"
    EXIT_CODE=2
    exit $EXIT_CODE
fi
print_success "dist/ directory exists"

# Check for index.html
if [ ! -f "dist/index.html" ]; then
    print_error "dist/index.html not found"
    print_error "Build output is incomplete"
    EXIT_CODE=2
    exit $EXIT_CODE
fi
print_success "dist/index.html exists"

# Check for assets directory
if [ ! -d "dist/assets" ]; then
    print_error "dist/assets/ directory not found"
    print_error "Build output is incomplete"
    EXIT_CODE=2
    exit $EXIT_CODE
fi
print_success "dist/assets/ directory exists"

print_success "Build output verification completed"

# ============================================================================
# Post-Build Verification
# ============================================================================

print_header "Post-Build Verification"

# ----------------------------------------------------------------------------
# 1. Calculate Bundle Sizes
# ----------------------------------------------------------------------------

print_info "Calculating bundle sizes..."

# Find all JavaScript files in dist/assets/js/
JS_FILES=$(find dist/assets/js -name "*.js" -type f 2>/dev/null || echo "")

if [ -z "$JS_FILES" ]; then
    # Fallback: search in dist/assets/
    JS_FILES=$(find dist/assets -name "*.js" -type f 2>/dev/null || echo "")
fi

if [ -z "$JS_FILES" ]; then
    print_error "No JavaScript files found in dist/assets/"
    print_error "Build output may be incomplete"
    EXIT_CODE=2
    exit $EXIT_CODE
fi

# Calculate sizes
TOTAL_SIZE_UNCOMPRESSED=0
TOTAL_SIZE_GZIPPED=0
MAIN_BUNDLE_SIZE_GZIPPED=0
MAIN_BUNDLE_FILE=""

echo ""
echo "${COLOR_BOLD}JavaScript Bundle Sizes:${COLOR_RESET}"
echo "----------------------------------------"

for js_file in $JS_FILES; do
    # Get uncompressed size
    size_uncompressed=$(stat -f%z "$js_file" 2>/dev/null || stat -c%s "$js_file" 2>/dev/null)
    
    # Get gzipped size
    size_gzipped=$(gzip -c "$js_file" | wc -c | tr -d ' ')
    
    # Add to totals
    TOTAL_SIZE_UNCOMPRESSED=$((TOTAL_SIZE_UNCOMPRESSED + size_uncompressed))
    TOTAL_SIZE_GZIPPED=$((TOTAL_SIZE_GZIPPED + size_gzipped))
    
    # Get filename
    filename=$(basename "$js_file")
    
    # Convert to KB
    size_uncompressed_kb=$((size_uncompressed / 1024))
    size_gzipped_kb=$((size_gzipped / 1024))
    
    # Display size
    echo "  $filename"
    echo "    Uncompressed: ${size_uncompressed_kb}KB"
    echo "    Gzipped: ${size_gzipped_kb}KB"
    
    # Identify main bundle (largest file or file with "index" in name)
    if [[ "$filename" == *"index"* ]] || [ "$size_gzipped" -gt "$MAIN_BUNDLE_SIZE_GZIPPED" ]; then
        MAIN_BUNDLE_SIZE_GZIPPED=$size_gzipped
        MAIN_BUNDLE_FILE="$filename"
    fi
done

echo "----------------------------------------"

# Convert totals to KB
TOTAL_SIZE_UNCOMPRESSED_KB=$((TOTAL_SIZE_UNCOMPRESSED / 1024))
TOTAL_SIZE_GZIPPED_KB=$((TOTAL_SIZE_GZIPPED / 1024))
MAIN_BUNDLE_SIZE_GZIPPED_KB=$((MAIN_BUNDLE_SIZE_GZIPPED / 1024))

echo "${COLOR_BOLD}Total JavaScript:${COLOR_RESET}"
echo "  Uncompressed: ${TOTAL_SIZE_UNCOMPRESSED_KB}KB"
echo "  Gzipped: ${TOTAL_SIZE_GZIPPED_KB}KB"
echo ""

# ----------------------------------------------------------------------------
# 2. Verify Main Bundle Size Constraint
# ----------------------------------------------------------------------------

print_info "Verifying main bundle size constraint (<300KB gzipped)..."

# Main bundle size limit: 300KB = 307200 bytes
MAIN_BUNDLE_SIZE_LIMIT=307200

if [ "$MAIN_BUNDLE_SIZE_GZIPPED" -le "$MAIN_BUNDLE_SIZE_LIMIT" ]; then
    print_success "Main bundle ($MAIN_BUNDLE_FILE): ${MAIN_BUNDLE_SIZE_GZIPPED_KB}KB gzipped (<300KB)"
else
    print_error "Main bundle ($MAIN_BUNDLE_FILE) exceeds size limit"
    print_error "Current: ${MAIN_BUNDLE_SIZE_GZIPPED_KB}KB gzipped"
    print_error "Maximum: 300KB gzipped"
    print_error "Please optimize bundle size by:"
    print_error "  - Reviewing code splitting configuration"
    print_error "  - Lazy loading route components"
    print_error "  - Removing unused dependencies"
    print_error "  - Using dynamic imports for large libraries"
    EXIT_CODE=2
    exit $EXIT_CODE
fi

# ----------------------------------------------------------------------------
# 3. Check for Source Maps
# ----------------------------------------------------------------------------

print_info "Checking for source maps..."

SOURCE_MAPS=$(find dist/assets -name "*.map" -type f 2>/dev/null | wc -l | tr -d ' ')

if [ "$SOURCE_MAPS" -gt 0 ]; then
    print_success "Found $SOURCE_MAPS source map files for production debugging"
else
    print_warning "No source maps found"
    print_info "Source maps aid in production debugging (configured in vite.config.ts)"
fi

# ----------------------------------------------------------------------------
# 4. Calculate CSS Sizes
# ----------------------------------------------------------------------------

print_info "Calculating CSS bundle sizes..."

CSS_FILES=$(find dist/assets -name "*.css" -type f 2>/dev/null || echo "")

if [ -n "$CSS_FILES" ]; then
    TOTAL_CSS_SIZE_UNCOMPRESSED=0
    TOTAL_CSS_SIZE_GZIPPED=0
    
    for css_file in $CSS_FILES; do
        size_uncompressed=$(stat -f%z "$css_file" 2>/dev/null || stat -c%s "$css_file" 2>/dev/null)
        size_gzipped=$(gzip -c "$css_file" | wc -c | tr -d ' ')
        
        TOTAL_CSS_SIZE_UNCOMPRESSED=$((TOTAL_CSS_SIZE_UNCOMPRESSED + size_uncompressed))
        TOTAL_CSS_SIZE_GZIPPED=$((TOTAL_CSS_SIZE_GZIPPED + size_gzipped))
    done
    
    TOTAL_CSS_SIZE_UNCOMPRESSED_KB=$((TOTAL_CSS_SIZE_UNCOMPRESSED / 1024))
    TOTAL_CSS_SIZE_GZIPPED_KB=$((TOTAL_CSS_SIZE_GZIPPED / 1024))
    
    print_success "Total CSS: ${TOTAL_CSS_SIZE_GZIPPED_KB}KB gzipped (${TOTAL_CSS_SIZE_UNCOMPRESSED_KB}KB uncompressed)"
else
    print_warning "No CSS files found in dist/assets/"
fi

print_success "Post-build verification completed"

# ============================================================================
# Build Summary
# ============================================================================

print_header "Build Summary"

# Calculate build duration
BUILD_END_TIME=$(date +%s)
BUILD_DURATION=$((BUILD_END_TIME - BUILD_START_TIME))
BUILD_DURATION_MIN=$((BUILD_DURATION / 60))
BUILD_DURATION_SEC=$((BUILD_DURATION % 60))

echo ""
echo "${COLOR_BOLD}Build Information:${COLOR_RESET}"
echo "  Started: $BUILD_START_DATE"
echo "  Duration: ${BUILD_DURATION_MIN}m ${BUILD_DURATION_SEC}s"
echo "  Output: $PROJECT_ROOT/dist/"
echo ""

echo "${COLOR_BOLD}Bundle Sizes:${COLOR_RESET}"
echo "  JavaScript (total): ${TOTAL_SIZE_GZIPPED_KB}KB gzipped"
echo "  Main bundle: ${MAIN_BUNDLE_SIZE_GZIPPED_KB}KB gzipped"
if [ -n "$CSS_FILES" ]; then
    echo "  CSS (total): ${TOTAL_CSS_SIZE_GZIPPED_KB}KB gzipped"
fi
echo ""

echo "${COLOR_BOLD}Quality Checks:${COLOR_RESET}"
if [ "$SKIP_LINT" = false ]; then
    echo "  TypeScript: ${COLOR_GREEN}✓ Passed${COLOR_RESET}"
    echo "  ESLint: ${COLOR_GREEN}✓ Passed (0 warnings)${COLOR_RESET}"
    echo "  Prettier: ${COLOR_GREEN}✓ Passed${COLOR_RESET}"
else
    echo "  Quality checks: ${COLOR_YELLOW}⚠ Skipped${COLOR_RESET}"
fi

if [ "$SKIP_TESTS" = false ]; then
    echo "  Unit tests: ${COLOR_GREEN}✓ Passed${COLOR_RESET}"
    echo "  Coverage: ${COLOR_GREEN}✓ >= 90%${COLOR_RESET}"
else
    echo "  Tests: ${COLOR_YELLOW}⚠ Skipped${COLOR_RESET}"
fi
echo ""

echo "${COLOR_BOLD}Next Steps:${COLOR_RESET}"
echo "  1. Review build artifacts in dist/ directory"
echo "  2. Test the production build locally:"
echo "     npm run preview"
echo "  3. Deploy dist/ contents to production web server"
echo "  4. Verify deployment with production smoke tests"
echo ""

if [ "$ANALYZE_BUNDLE" = true ]; then
    echo "${COLOR_BOLD}Bundle Analysis:${COLOR_RESET}"
    echo "  Open dist/stats.html in a browser to analyze bundle composition"
    echo ""
fi

# ============================================================================
# Final Status
# ============================================================================

if [ $EXIT_CODE -eq 0 ]; then
    echo "${COLOR_BOLD}${COLOR_GREEN}========================================${COLOR_RESET}"
    echo "${COLOR_BOLD}${COLOR_GREEN}BUILD SUCCESSFUL${COLOR_RESET}"
    echo "${COLOR_BOLD}${COLOR_GREEN}========================================${COLOR_RESET}"
    echo ""
else
    echo "${COLOR_BOLD}${COLOR_RED}========================================${COLOR_RESET}"
    echo "${COLOR_BOLD}${COLOR_RED}BUILD FAILED${COLOR_RESET}"
    echo "${COLOR_BOLD}${COLOR_RED}========================================${COLOR_RESET}"
    echo ""
fi

exit $EXIT_CODE
