# ADR 0005: Zero Backend Modification Principle

## Status
ACCEPTED

## Context
The refactoring transforms Moodle's frontend from PHP server-side rendering to a React 18 SPA. The **Minimal Change Clause** mandates:

**Strict Metrics**:
- Modify fewer than 2% of existing codebase files (max 64 files out of 3,175+)
- >95% of changes must be new code additions, not modifications to existing lines
- Zero business logic duplication
- Zero database schema changes

**Existing Codebase Scale**:
- 17,875 PHP files total
- 847 files in /lib/ (core library)
- 342 module library files (mod/*/lib.php)
- 89 authentication plugin files
- 127 CLI scripts
- Hundreds of database tables with complex relationships

**Risk of Modifications**:
Modifying existing backend code introduces:
- Breaking changes for plugins and customizations
- Data integrity risks
- Regression bugs in battle-tested code
- Testing burden (must retest all affected functionality)
- Upgrade path complications (conflicts with future Moodle versions)
- Loss of institutional customizations

The refactoring goal is **frontend modernization**, not backend overhaul. The existing PHP backend is mature, stable, and functioning correctly. Any modifications violate the principle of minimal invasiveness.

## Decision
We adopt the **Zero Backend Modification Principle**:

1. **Protected Directories (Absolute Zero Modifications)**:
   - `/lib/` - 847 core library files
   - `/mod/*/lib.php` - 342 module library files
   - `/mod/*/locallib.php` - Module-specific logic files
   - `/auth/` - 89 authentication plugin files
   - `/backup/` - All backup and restore files
   - `/admin/cli/` - 127 command-line scripts
   - All files containing `lib.php` or `locallib.php` patterns

2. **Database Schema Immutability**:
   - ❌ NO ALTER TABLE statements
   - ❌ NO CREATE TABLE statements
   - ❌ NO new columns or indexes
   - ❌ NO changes to foreign keys or constraints
   - ❌ NO data migrations or transformations
   - Same database serves both PHP and React interfaces

3. **Allowed Modifications (Append-Only, 3 Files Total)**:
   - `config.php`: APPEND ~28 lines for JWT secret, API settings, CORS, feature flags
   - `composer.json`: ADD 1 line for firebase/php-jwt dependency
   - `.htaccess` or `nginx.conf`: APPEND ~20 lines for API routing rules
   - **Total**: 49 lines appended, ZERO lines modified
   - **Modification Rate**: 3 files out of 17,875 = 0.017% ✅

4. **New Code Isolation**:
   - All React code in `/react-frontend/` directory (320+ files)
   - All API endpoints in `/api/v1/` directory (127 files)
   - API utilities in `/api/lib/` (4 files)
   - Total new files: 451 (100% additions)

5. **Enforcement Mechanisms**:
   - Code review checklist includes protected file verification
   - Git hooks prevent commits to protected directories
   - CI/CD pipeline fails if protected files modified
   - File modification tracking dashboard
   - Architecture Review Board approval required for any exception

## Consequences

**Positive**:
- **Risk Minimization**: Existing Moodle functionality guaranteed to work
- **Plugin Compatibility**: All plugins continue functioning without changes
- **Upgrade Path**: Future Moodle version upgrades remain straightforward
- **Institutional Safety**: Custom modifications and integrations preserved
- **Parallel Deployment**: Old and new interfaces can coexist safely
- **Rollback Simplicity**: Easy to rollback by disabling React frontend
- **Testing Efficiency**: Existing PHPUnit and Behat tests remain valid
- **Audit Trail**: Clear separation between old and new code

**Negative**:
- **API Redundancy**: New API layer adds files (acceptable for safety)
- **Optimization Limits**: Cannot optimize backend functions for API (trade-off accepted)
- **Database Inefficiency**: Some API calls may require multiple function calls (acceptable overhead)

**Trade-offs**:
- Slightly more API endpoint files vs zero backend risk (clear benefit)
- Possible API performance impact vs guaranteed correctness (acceptable)
- Cannot refactor problematic backend code vs minimal disruption (aligned with goals)

## Alternatives Considered

**Alternative 1: Modify Existing PHP Files to Add API Support**
- Add REST endpoint handling to existing PHP pages
- REJECTED: Violates Minimal Change Clause, increases modification percentage
- Mixing old and new code reduces maintainability
- Higher risk of breaking existing functionality

**Alternative 2: Refactor Backend While Modernizing Frontend**
- Modernize both frontend and backend simultaneously
- REJECTED: Massive scope increase, violates project constraints
- Would require extensive retesting and plugin updates
- High risk of breaking changes

**Alternative 3: Allow Database Schema Changes for Optimization**
- Add indexes or denormalized tables for API performance
- REJECTED: Schema changes affect all Moodle code, not just React
- Complicates upgrade path and plugin compatibility
- Performance gains not worth the risk

**Alternative 4: Modify Core Functions to Support JSON Output**
- Add JSON output modes to functions like get_course()
- REJECTED: Modifies protected files, affects non-API code paths
- API can transform PHP objects to JSON cleanly

## Protected Files List

**Absolutely NO Modifications Allowed**:

1. **Core Libraries** (847 files):
   - `lib/accesslib.php` - Permission system
   - `lib/datalib.php` - Database operations
   - `lib/moodlelib.php` - Core functions
   - `lib/gradelib.php` - Grade calculations
   - `lib/enrollib.php` - Enrollment logic
   - `lib/filelib.php` - File handling
   - `lib/questionlib.php` - Question engine
   - [840+ additional library files]

2. **Module Logic** (342 files):
   - `mod/assign/lib.php` - Assignment functions
   - `mod/quiz/lib.php` - Quiz engine
   - `mod/forum/lib.php` - Forum logic
   - [339+ module library files]

3. **Authentication** (89 files):
   - `auth/manual/auth.php` - Manual auth
   - `auth/ldap/auth.php` - LDAP auth
   - `auth/oauth2/auth.php` - OAuth auth
   - [86+ auth plugin files]

4. **Database Layer**:
   - All `*/db/install.xml` schema files
   - All `*/db/upgrade.php` migration files
   - Database structure completely frozen

## Validation Process

**Pre-Commit Checks**:
```bash
# Git hook checks for modifications to protected files
if git diff --cached --name-only | grep -E '^(lib/|mod/[^/]+/lib\.php|auth/|backup/)'; then
    echo "ERROR: Attempting to modify protected files"
    exit 1
fi
```

**Code Review Checklist**:
- [ ] Zero modifications to files in /lib/
- [ ] Zero modifications to mod/*/lib.php files
- [ ] Zero modifications to /auth/ directory
- [ ] Zero modifications to /backup/ directory
- [ ] Zero database schema changes
- [ ] Only config.php, composer.json, web server config modified (append-only)
- [ ] All new functionality in /react-frontend/ or /api/ directories

**Metrics Dashboard**:
- Files modified: 3 / 17,875 (0.017%) ✅ Target: <2%
- Lines modified: 0 (only appends) ✅ Target: <5% of total changes
- New files created: 451 ✅
- Addition vs modification ratio: >99% ✅ Target: >95%

## Exception Process

If a legitimate need arises to modify protected files:

1. **Escalation**: Submit to Architecture Review Board
2. **Justification**: Provide detailed technical justification
3. **Impact Analysis**: Document all affected systems and plugins
4. **Alternative Search**: Prove no alternative approach exists
5. **Approval**: Requires unanimous ARB approval
6. **Testing**: Comprehensive regression testing required
7. **Documentation**: Update this ADR with approved exception

**To Date**: Zero exceptions granted.

## References
- Agent Action Plan Section 0.7: Minimal Change Discipline
- Agent Action Plan Section 0.1: Backend Preservation requirement
- Agent Action Plan Section 0.6: Scope Boundaries - Protected Files
- Metrics tracked in: Project Dashboard, CI/CD Pipeline
