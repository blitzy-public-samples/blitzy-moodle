# Moodle React Refactoring - Environment Setup Guide

## Prerequisites

This guide documents the exact steps to set up the development environment for the Moodle PHP to React refactoring project.

## System Requirements

- **Operating System**: Ubuntu 20.04+ or Debian-based Linux
- **Memory**: 4GB RAM minimum (8GB recommended)
- **Disk Space**: 5GB free space
- **Internet Connection**: Required for downloading dependencies

---

## Step 1: Install PHP and Extensions

### PHP 8.3+ Installation

```bash
# Update package list
sudo apt-get update

# Install PHP and required extensions
sudo apt-get install -y \
  php \
  php-cli \
  php-mbstring \
  php-xml \
  php-curl \
  php-gd \
  php-intl \
  php-mysqli \
  php-zip \
  php-json \
  php-tokenizer \
  php-soap \
  php-exif \
  php-xmlreader \
  php-xmlwriter

# Verify PHP installation
php --version
# Expected: PHP 8.3.6 or later
```

### Required PHP Extensions

The following extensions are required and installed with the above command:
- **mysqli**: MySQL database driver
- **curl**: HTTP client
- **gd**: Image processing
- **intl**: Internationalization
- **mbstring**: Multibyte string handling
- **xml, xmlreader, xmlwriter**: XML parsing
- **zip**: Archive handling
- **json**: JSON encoding/decoding
- **tokenizer**: PHP tokenizer
- **soap**: SOAP web services
- **exif**: Image metadata

---

## Step 2: Install Composer

```bash
# Download and install Composer
cd /tmp
curl -sS https://getcomposer.org/installer | php -- \
  --install-dir=/usr/local/bin \
  --filename=composer

# Verify Composer installation
composer --version
# Expected: Composer version 2.8.x or later
```

---

## Step 3: Install Node.js and npm

### Using Node Version Manager (nvm) - Recommended

```bash
# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Reload shell configuration
source ~/.bashrc

# Install Node.js 20.x LTS
nvm install 20
nvm use 20

# Verify Node.js and npm installation
node --version
# Expected: v20.19.5 or later

npm --version
# Expected: 10.8.2 or later
```

### Alternative: Direct Installation

```bash
# Add NodeSource repository for Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# Install Node.js
sudo apt-get install -y nodejs

# Verify installation
node --version
npm --version
```

---

## Step 4: Clone Repository

```bash
# Clone the repository
git clone <repository-url> moodle-refactor
cd moodle-refactor

# Checkout the working branch
git checkout blitzy-d6458eda-ba63-4141-ae9f-e60c7710f352
```

---

## Step 5: Install PHP Dependencies

```bash
# Navigate to project root
cd /path/to/moodle-refactor

# Install PHP dependencies using Composer
composer install --no-interaction --prefer-dist

# This will install:
# - 69 packages including firebase/php-jwt
# - Development tools (PHPUnit, Behat, etc.)
# - Symfony components
```

### Expected Output
```
Loading composer repositories with package information
Installing dependencies from lock file
...
69 packages installed successfully
```

---

## Step 6: Install React Frontend Dependencies

```bash
# Navigate to React frontend directory
cd react-frontend

# Install npm dependencies
# Note: Use --ignore-scripts to bypass husky git hooks if .git is not accessible
npm install --no-audit --no-fund --ignore-scripts

# This will install:
# - 898 packages
# - React 18.2.0
# - TypeScript 5.3.3
# - Vite 5.4.21
# - Material-UI 5.15.x
# - Redux Toolkit, React Query, and other dependencies
```

### Expected Output
```
added 898 packages in 30s
```

---

## Step 7: Verify Installation

### Verify TypeScript Compilation

```bash
cd react-frontend
npm run type-check
```

**Expected Output**: `✓ Compiled successfully` with 0 errors

### Verify Production Build

```bash
npm run build
```

**Expected Output**:
```
✓ built in 2.08s
dist/index.html
dist/assets/index-[hash].js      4.84 kB │ gzip: 2.03 kB
dist/assets/vendor-mui-[hash].js 51.34 kB │ gzip: 16.75 kB
dist/assets/vendor-react-[hash].js 236.89 kB │ gzip: 78.69 kB
```

**Total bundle size**: ~293 KB (~97.5 KB gzipped) ✅ Under 300 KB target

### Verify Unit Tests

```bash
npm test -- --run
```

**Expected Output**:
```
Test Files  X passed (X)
Tests  2074 passed | 1 skipped (2075)
Duration  56.07s
```

---

## Step 8: Verify Git Status

```bash
cd ..  # Return to project root
git status
```

**Expected Output**: `nothing to commit, working tree clean`

All dependencies are in gitignored directories (vendor/, node_modules/, dist/).

---

## Directory Structure After Setup

```
moodle-refactor/
├── api/                         # API endpoints (131 files)
├── public/                      # Existing Moodle PHP (17,875+ files)
├── react-frontend/              # React SPA
│   ├── dist/                    # Build output (gitignored)
│   ├── node_modules/            # npm packages (gitignored, 898 packages)
│   ├── src/                     # Source code (320+ files)
│   ├── tests/                   # Test files
│   ├── package.json             # Dependencies manifest
│   └── package-lock.json        # Dependency lock file
├── vendor/                      # Composer packages (gitignored, 69 packages)
├── composer.json                # PHP dependencies
├── composer.lock                # PHP dependency lock file
└── config.php                   # Moodle configuration
```

---

## Development Commands

### Start Development Server

```bash
cd react-frontend
npm run dev
```

Access at `http://localhost:5173`

### Run Tests in Watch Mode

```bash
cd react-frontend
npm test
```

### Run E2E Tests

```bash
cd react-frontend
npm run test:e2e
```

### Lint and Format Code

```bash
cd react-frontend

# Check for linting errors
npm run lint

# Auto-fix linting errors
npm run lint:fix

# Format code
npm run format

# Check formatting
npm run format:check
```

### Type Checking

```bash
cd react-frontend
npm run type-check
```

---

## Troubleshooting

### Issue: PHP not found

**Symptom**: `bash: php: command not found`

**Solution**: Install PHP following Step 1 above

### Issue: Composer not found

**Symptom**: `bash: composer: command not found`

**Solution**: Install Composer following Step 2 above

### Issue: npm install fails with husky error

**Symptom**: `husky - .git can't be found`

**Solution**: Use `--ignore-scripts` flag:
```bash
npm install --no-audit --no-fund --ignore-scripts
```

### Issue: Permission denied during installation

**Symptom**: `EACCES: permission denied`

**Solution**: Don't use `sudo` with npm. If you installed Node.js with sudo, consider using nvm instead for better permission management.

### Issue: Out of memory during build

**Symptom**: `JavaScript heap out of memory`

**Solution**: Increase Node.js memory limit:
```bash
export NODE_OPTIONS="--max-old-space-size=4096"
npm run build
```

---

## Environment Variables

### Development (.env.development)

The React frontend uses environment variables for configuration. Create `.env.development` in `react-frontend/`:

```bash
VITE_API_BASE_URL=http://localhost:8080/api/v1
VITE_APP_ENV=development
```

### Production (.env.production)

For production builds, create `.env.production`:

```bash
VITE_API_BASE_URL=https://your-domain.com/api/v1
VITE_APP_ENV=production
```

**Note**: `.env.example` is provided as a template. Copy and customize for your environment.

---

## Next Steps After Setup

1. **Read Architecture Documentation**: Review `/react-frontend/docs/architecture/` for design decisions
2. **Explore Component Library**: Run Storybook to see all components: `npm run storybook`
3. **Run Development Server**: Start the Vite dev server: `npm run dev`
4. **Make Changes**: Begin implementing features according to the Agent Action Plan
5. **Run Tests**: Ensure all tests pass before committing: `npm test -- --run`

---

## CI/CD Integration

### GitHub Actions

The project includes CI/CD pipelines in `.github/workflows/`:

- **react-ci.yml**: Runs on every push to verify:
  - TypeScript compilation
  - Linting (ESLint)
  - Unit tests (Vitest)
  - Production build
  - E2E tests (Playwright)

### Local Pre-commit Hooks

If you want to enable git hooks (optional):

```bash
cd react-frontend
npx husky install
```

This will:
- Run linting on staged files before commit
- Ensure code quality standards are met

---

## Performance Benchmarks

After successful setup, the environment should meet these benchmarks:

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| TypeScript compilation | 0 errors | 0 errors | ✅ |
| Production build time | <5s | 2.08s | ✅ |
| Bundle size (gzipped) | <300 KB | 97.5 KB | ✅ |
| Unit test pass rate | >95% | 99.95% | ✅ |
| Test execution time | <2 min | 56s | ✅ |

---

## Support and Resources

- **Technical Specification**: See Agent Action Plan in project root
- **API Documentation**: `/api/README.md`
- **Component Documentation**: Run `npm run storybook` in react-frontend/
- **Architecture Decisions**: `/react-frontend/docs/architecture/decisions/`

---

**Last Updated**: November 11, 2025  
**Setup Agent**: Blitzy DevOps Agent  
**Environment**: Ubuntu with PHP 8.3.6, Node.js 20.19.5  
**Status**: ✅ Fully Operational
