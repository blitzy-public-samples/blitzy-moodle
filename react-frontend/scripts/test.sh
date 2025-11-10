#!/usr/bin/env bash

# test.sh - Comprehensive test execution script for React frontend
# Runs unit tests (Vitest), integration tests, and E2E tests (Playwright)
# Validates coverage thresholds and generates reports for CI/CD integration

set -e  # Exit on error
set -o pipefail  # Exit on pipe failure

# Color definitions using tput
if command -v tput &> /dev/null && [ -t 1 ]; then
    RED=$(tput setaf 1)
    GREEN=$(tput setaf 2)
    YELLOW=$(tput setaf 3)
    BLUE=$(tput setaf 4)
    BOLD=$(tput bold)
    RESET=$(tput sgr0)
else
    RED=""
    GREEN=""
    YELLOW=""
    BLUE=""
    BOLD=""
    RESET=""
fi

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Configuration
COVERAGE_THRESHOLD=90
NODE_MIN_VERSION="20.0.0"
NPM_MIN_VERSION="9.0.0"

# Test suite flags
RUN_UNIT=false
RUN_INTEGRATION=false
RUN_E2E=false
RUN_ALL=false
WATCH_MODE=false
UI_MODE=false
CI_MODE=false

# Detect CI environment
if [ -n "$CI" ] || [ -n "$CONTINUOUS_INTEGRATION" ]; then
    CI_MODE=true
fi

# Usage function
usage() {
    cat << EOF
${BOLD}Usage:${RESET} $0 [OPTIONS]

${BOLD}Description:${RESET}
  Comprehensive test runner for React frontend application.
  Executes unit tests (Vitest), integration tests, and E2E tests (Playwright).
  Validates coverage thresholds and generates reports for CI/CD integration.

${BOLD}Options:${RESET}
  --unit              Run unit tests only
  --integration       Run integration tests only
  --e2e               Run E2E tests only
  --all               Run all test suites (default)
  --watch             Run tests in watch mode (unit/integration only)
  --ui                Run tests in UI mode
  --help              Show this help message

${BOLD}Examples:${RESET}
  $0 --all                    # Run all test suites
  $0 --unit                   # Run unit tests only
  $0 --unit --watch           # Run unit tests in watch mode
  $0 --e2e                    # Run E2E tests only
  $0 --unit --integration     # Run unit and integration tests

${BOLD}Exit Codes:${RESET}
  0 - All tests passed
  1 - Test failures detected
  2 - Coverage below threshold (${COVERAGE_THRESHOLD}%)

EOF
    exit 0
}

# Logging functions
log_info() {
    echo "${BLUE}[INFO]${RESET} $*"
}

log_success() {
    echo "${GREEN}[SUCCESS]${RESET} $*"
}

log_warning() {
    echo "${YELLOW}[WARNING]${RESET} $*"
}

log_error() {
    echo "${RED}[ERROR]${RESET} $*" >&2
}

log_section() {
    echo ""
    echo "${BOLD}$*${RESET}"
    echo "========================================"
}

# Version comparison function
version_compare() {
    local version1=$1
    local version2=$2
    
    if [ "$(printf '%s\n' "$version1" "$version2" | sort -V | head -n1)" = "$version2" ]; then
        return 0  # version1 >= version2
    else
        return 1  # version1 < version2
    fi
}

# Environment validation
validate_environment() {
    log_section "Validating Environment"
    
    # Check if running from correct directory
    if [ ! -f "$PROJECT_ROOT/package.json" ]; then
        log_error "package.json not found. Please run this script from the react-frontend directory."
        exit 1
    fi
    
    # Validate Node.js version
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed."
        exit 1
    fi
    
    local node_version=$(node --version | sed 's/v//')
    log_info "Node.js version: $node_version"
    
    if ! version_compare "$node_version" "$NODE_MIN_VERSION"; then
        log_error "Node.js version must be >= $NODE_MIN_VERSION (found: $node_version)"
        exit 1
    fi
    log_success "Node.js version check passed"
    
    # Validate npm version
    if ! command -v npm &> /dev/null; then
        log_error "npm is not installed."
        exit 1
    fi
    
    local npm_version=$(npm --version)
    log_info "npm version: $npm_version"
    
    if ! version_compare "$npm_version" "$NPM_MIN_VERSION"; then
        log_error "npm version must be >= $NPM_MIN_VERSION (found: $npm_version)"
        exit 1
    fi
    log_success "npm version check passed"
    
    # Check if node_modules exists
    if [ ! -d "$PROJECT_ROOT/node_modules" ]; then
        log_error "node_modules directory not found. Please run 'npm install' first."
        exit 1
    fi
    log_success "node_modules directory found"
    
    # Validate configuration files
    if [ ! -f "$PROJECT_ROOT/vitest.config.ts" ]; then
        log_error "vitest.config.ts not found."
        exit 1
    fi
    log_success "vitest.config.ts found"
    
    if [ ! -f "$PROJECT_ROOT/playwright.config.ts" ]; then
        log_error "playwright.config.ts not found."
        exit 1
    fi
    log_success "playwright.config.ts found"
    
    log_success "Environment validation complete"
}

# Parse command-line arguments
parse_arguments() {
    if [ $# -eq 0 ]; then
        RUN_ALL=true
        return
    fi
    
    while [ $# -gt 0 ]; do
        case "$1" in
            --unit)
                RUN_UNIT=true
                ;;
            --integration)
                RUN_INTEGRATION=true
                ;;
            --e2e)
                RUN_E2E=true
                ;;
            --all)
                RUN_ALL=true
                ;;
            --watch)
                WATCH_MODE=true
                ;;
            --ui)
                UI_MODE=true
                ;;
            --help|-h)
                usage
                ;;
            *)
                log_error "Unknown option: $1"
                echo "Use --help to see available options"
                exit 1
                ;;
        esac
        shift
    done
    
    # If no specific suite selected, run all
    if [ "$RUN_UNIT" = false ] && [ "$RUN_INTEGRATION" = false ] && [ "$RUN_E2E" = false ] && [ "$RUN_ALL" = false ]; then
        RUN_ALL=true
    fi
    
    # If --all is set, enable all suites
    if [ "$RUN_ALL" = true ]; then
        RUN_UNIT=true
        RUN_INTEGRATION=true
        RUN_E2E=true
    fi
    
    # Watch mode and UI mode are incompatible with CI mode
    if [ "$CI_MODE" = true ]; then
        if [ "$WATCH_MODE" = true ] || [ "$UI_MODE" = true ]; then
            log_warning "Watch mode and UI mode are disabled in CI environment"
            WATCH_MODE=false
            UI_MODE=false
        fi
    fi
    
    # Watch mode not supported for E2E tests
    if [ "$WATCH_MODE" = true ] && [ "$RUN_E2E" = true ]; then
        log_warning "Watch mode is not supported for E2E tests"
    fi
}

# Run unit tests
run_unit_tests() {
    log_section "Running Unit Tests"
    
    local test_cmd="npm run test"
    
    if [ "$WATCH_MODE" = true ]; then
        test_cmd="npm run test -- --watch"
        log_info "Running unit tests in watch mode"
    elif [ "$UI_MODE" = true ]; then
        test_cmd="npm run test:ui"
        log_info "Running unit tests in UI mode"
    else
        test_cmd="npm run test -- --run"
        log_info "Running unit tests"
    fi
    
    cd "$PROJECT_ROOT"
    
    if $test_cmd; then
        log_success "Unit tests passed"
        return 0
    else
        log_error "Unit tests failed"
        return 1
    fi
}

# Run integration tests
run_integration_tests() {
    log_section "Running Integration Tests"
    
    local test_cmd="npm run test -- --run src/**/*.integration.test.tsx"
    
    if [ "$WATCH_MODE" = true ]; then
        test_cmd="npm run test -- --watch src/**/*.integration.test.tsx"
        log_info "Running integration tests in watch mode"
    else
        log_info "Running integration tests"
    fi
    
    cd "$PROJECT_ROOT"
    
    if $test_cmd; then
        log_success "Integration tests passed"
        return 0
    else
        log_error "Integration tests failed"
        return 1
    fi
}

# Run E2E tests
run_e2e_tests() {
    log_section "Running E2E Tests"
    
    local test_cmd="npm run test:e2e"
    
    if [ "$UI_MODE" = true ]; then
        test_cmd="npm run test:e2e:ui"
        log_info "Running E2E tests in UI mode"
    else
        log_info "Running E2E tests (15 critical user journeys)"
    fi
    
    cd "$PROJECT_ROOT"
    
    if $test_cmd; then
        log_success "E2E tests passed"
        return 0
    else
        log_error "E2E tests failed"
        return 1
    fi
}

# Generate and validate coverage
generate_coverage() {
    log_section "Generating Coverage Report"
    
    cd "$PROJECT_ROOT"
    
    log_info "Running tests with coverage..."
    # Run coverage and capture exit code, but don't exit immediately
    npm run coverage
    local npm_exit_code=$?
    
    # Check if coverage directory exists
    if [ ! -d "$PROJECT_ROOT/coverage" ]; then
        log_error "Coverage directory not found"
        return 1
    fi
    
    # Parse coverage summary (if available)
    local coverage_file="$PROJECT_ROOT/coverage/coverage-summary.json"
    if [ ! -f "$coverage_file" ]; then
        log_error "Coverage summary file not found: $coverage_file"
        return 1
    fi
    
    log_info "Validating coverage thresholds (${COVERAGE_THRESHOLD}% required)..."
    
    # Extract coverage percentages using node to parse JSON
    # Temporarily disable set -e to capture exit code without terminating script
    set +e
    node -e "
        const fs = require('fs');
        const coverage = JSON.parse(fs.readFileSync('$coverage_file', 'utf8'));
        const total = coverage.total;
        const lines = total.lines.pct;
        const functions = total.functions.pct;
        const branches = total.branches.pct;
        const statements = total.statements.pct;
        
        console.log('Lines: ' + lines + '%');
        console.log('Functions: ' + functions + '%');
        console.log('Branches: ' + branches + '%');
        console.log('Statements: ' + statements + '%');
        
        const threshold = $COVERAGE_THRESHOLD;
        if (lines < threshold || functions < threshold || branches < threshold || statements < threshold) {
            process.exit(1);
        }
    " 2>/dev/null
    
    local node_exit_code=$?
    set -e  # Re-enable set -e
    
    if [ $node_exit_code -eq 0 ]; then
        log_success "Coverage thresholds met (>= ${COVERAGE_THRESHOLD}%)"
        
        local html_report="$PROJECT_ROOT/coverage/index.html"
        if [ -f "$html_report" ]; then
            log_info "HTML coverage report: coverage/index.html"
        fi
        
        local lcov_report="$PROJECT_ROOT/coverage/lcov.info"
        if [ -f "$lcov_report" ]; then
            log_info "LCOV coverage report: coverage/lcov.info"
        fi
        
        log_success "Coverage reports generated (text, HTML, LCOV, JSON)"
        return 0
    else
        log_error "Coverage below ${COVERAGE_THRESHOLD}% threshold"
        return 2
    fi
}

# Main execution
main() {
    local start_time=$(date +%s)
    local exit_code=0
    local test_failures=0
    local coverage_exit_code=0
    
    log_section "React Frontend Test Suite"
    log_info "Starting test execution..."
    
    # Parse arguments
    parse_arguments "$@"
    
    # Validate environment
    validate_environment
    
    # Display test plan
    log_section "Test Execution Plan"
    [ "$RUN_UNIT" = true ] && log_info "✓ Unit tests"
    [ "$RUN_INTEGRATION" = true ] && log_info "✓ Integration tests"
    [ "$RUN_E2E" = true ] && log_info "✓ E2E tests"
    [ "$WATCH_MODE" = true ] && log_info "Mode: Watch"
    [ "$UI_MODE" = true ] && log_info "Mode: UI"
    [ "$CI_MODE" = true ] && log_info "Environment: CI"
    
    # Run test suites
    if [ "$RUN_UNIT" = true ]; then
        if ! run_unit_tests; then
            test_failures=$((test_failures + 1))
            exit_code=1
        fi
    fi
    
    if [ "$RUN_INTEGRATION" = true ]; then
        if ! run_integration_tests; then
            test_failures=$((test_failures + 1))
            exit_code=1
        fi
    fi
    
    if [ "$RUN_E2E" = true ]; then
        if ! run_e2e_tests; then
            test_failures=$((test_failures + 1))
            exit_code=1
        fi
    fi
    
    # Generate coverage report (only if unit or integration tests ran)
    if [ "$RUN_UNIT" = true ] || [ "$RUN_INTEGRATION" = true ]; then
        if [ "$WATCH_MODE" = false ] && [ "$UI_MODE" = false ]; then
            # Temporarily disable set -e since generate_coverage may return non-zero
            set +e
            generate_coverage
            coverage_exit_code=$?
            set -e
            if [ $coverage_exit_code -ne 0 ]; then
                if [ $coverage_exit_code -eq 2 ]; then
                    log_warning "Coverage below threshold"
                    # Only set exit code to 2 if tests passed
                    if [ $exit_code -eq 0 ]; then
                        exit_code=2
                    fi
                else
                    log_warning "Coverage validation failed"
                fi
            fi
        fi
    fi
    
    # Calculate execution time
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    # Print summary
    log_section "Test Execution Summary"
    log_info "Duration: ${duration}s"
    
    if [ $exit_code -eq 0 ]; then
        log_success "${BOLD}All tests passed with sufficient coverage!${RESET}"
        log_info "Exit code: 0"
    elif [ $exit_code -eq 2 ]; then
        log_warning "${BOLD}Tests passed but coverage below ${COVERAGE_THRESHOLD}% threshold${RESET}"
        log_info "Exit code: 2"
    else
        log_error "${BOLD}${test_failures} test suite(s) failed${RESET}"
        log_info "Exit code: 1"
    fi
    
    exit $exit_code
}

# Execute main function
main "$@"
