# ADR 0004: Thin API Wrapper Pattern

## Status
ACCEPTED

## Context
The refactoring creates 127 RESTful API endpoints to serve the React frontend. These endpoints must provide data and operations currently performed by PHP pages. A critical constraint is the **Minimal Change Clause** requiring:
- Modify fewer than 2% of existing codebase files (max 64 files)
- >95% of changes must be new code additions, not modifications
- Zero business logic duplication
- No modifications to core library files (/lib/, /mod/*/lib.php, /auth/, /backup/)
- Zero database schema changes

Moodle has 17,875 existing PHP files containing mature, battle-tested business logic:
- Grade calculations with complex aggregation methods
- Permission system with fine-grained capabilities
- Enrollment logic supporting multiple plugins
- File storage and handling
- Quiz engine with question types
- Forum moderation and tracking
- Course completion tracking

Duplicating this logic in API endpoints would:
- Violate the Minimal Change Clause
- Create maintenance burden (changes needed in two places)
- Introduce bugs and inconsistencies
- Risk data integrity issues
- Require extensive testing of reimplemented logic

## Decision
ALL API endpoints MUST follow the **Thin Wrapper Pattern**:

1. **Mandatory Principles**:
   - API endpoints are WRAPPERS, not reimplementations
   - EVERY endpoint calls existing Moodle core functions
   - NO business logic duplication whatsoever
   - NO direct database queries (use $DB methods via existing functions)
   - NO grade calculations, permission checks, or enrollment logic in API code

2. **Standard API Endpoint Structure**:
   ```php
   class CourseShowEndpoint extends ApiBase {
       public function handle_get($courseid) {
           // 1. Validate JWT token (inherited from ApiBase)
           $this->validate_token();
           
           // 2. Get user from token
           $userid = $this->get_user_id_from_token();
           
           // 3. Get course context
           $context = context_course::instance($courseid);
           
           // 4. Check permissions using EXISTING function
           require_capability('moodle/course:view', $context);
           
           // 5. Call EXISTING Moodle function
           $course = get_course($courseid);
           
           // 6. Return standardized JSON response
           return $this->json_response($course);
       }
   }
   ```

3. **Permission Enforcement (Mandatory)**:
   - EVERY endpoint calls `require_capability()` before operations
   - Use existing Moodle capability system
   - Context-aware permission checks
   - Backend is authoritative for ALL authorization decisions
   - React UI may hide/show elements based on roles, but backend always validates

4. **Data Operations**:
   - Get data: Call get_course(), get_user(), grade_get_grades(), etc.
   - Create data: Call create_course(), user_create_user(), enrol_try_internal_enrol(), etc.
   - Update data: Call update_course(), user_update_user(), assign_grade_submission(), etc.
   - Delete data: Call delete_course(), user_delete_user(), etc.
   - File operations: Use get_file_storage(), stored_file class

5. **Standard Response Envelope**:
   ```json
   {
     "success": true,
     "data": { /* actual data */ },
     "meta": {
       "pagination": { /* if applicable */ },
       "timestamp": 1234567890
     }
   }
   ```

6. **Error Handling**:
   - Let existing Moodle exceptions bubble up
   - Catch and convert to standardized JSON error format
   - Preserve error messages for debugging
   - Use HTTP status codes appropriately (401, 403, 404, 500)

## Consequences

**Positive**:
- **Zero Business Logic Duplication**: All logic in one place (existing PHP)
- **Consistency Guaranteed**: API produces identical results to PHP pages
- **Maintenance Efficiency**: Bug fixes only needed in one place
- **Rapid Development**: API endpoints are thin, quick to implement
- **Data Integrity**: Existing validation and constraints preserved
- **Permission Parity**: Same permission checks as PHP pages
- **Plugin Compatibility**: Existing plugin hooks continue working
- **Test Reuse**: Existing PHPUnit tests validate API behavior

**Negative**:
- **API Performance**: Each call goes through PHP function layer (acceptable overhead)
- **Limited Optimization**: Cannot optimize API-specific queries (trade-off for consistency)
- **Response Format**: Must transform PHP function output to JSON (minimal effort)

**Risks**:
- **Breaking Abstraction**: Developers might be tempted to "optimize" by bypassing existing functions (PROHIBITED via code review)
- **Missing Functions**: Some operations may lack existing wrapper functions (create wrapper in existing pattern, not in API)

## Alternatives Considered

**Alternative 1: Reimplement Business Logic in API**
- Duplicate grade calculations, permission checks, enrollment logic in API endpoints
- REJECTED: Violates Minimal Change Clause, creates maintenance nightmare
- High risk of inconsistencies between PHP and API behavior
- Would require modifying database access patterns

**Alternative 2: Direct Database Queries in API**
- API endpoints use $DB->get_record() directly, bypass existing functions
- REJECTED: Bypasses validation, permission checks, and business rules
- Breaks when database schema assumptions change
- Misses plugin hooks and event triggers

**Alternative 3: GraphQL Schema with Custom Resolvers**
- Create GraphQL API with resolvers calling functions
- REJECTED: Still requires thin wrapper pattern, adds GraphQL complexity
- Moodle's function-based architecture maps better to REST
- Would require learning GraphQL for team

**Alternative 4: Expose Existing Web Services API**
- Reuse Moodle's existing External API (web services)
- PARTIALLY ADOPTED: Can reference existing external functions where available
- Still requires REST endpoints for better React integration
- Web Services API designed for different use case (third-party integrations)

## Prohibited Practices

**NEVER Allowed in API Endpoints**:
```php
// ❌ WRONG: Reimplementing permission check
if ($user->role == 'teacher') {
    // Grant access
}

// ✅ CORRECT: Use existing permission system
require_capability('mod/assign:grade', $context);

// ❌ WRONG: Reimplementing grade calculation
$final_grade = ($grade1 * 0.3) + ($grade2 * 0.7);

// ✅ CORRECT: Call existing function
$final_grade = grade_calculate_category_total($categoryid);

// ❌ WRONG: Direct database query
$course = $DB->get_record('course', ['id' => $courseid]);

// ✅ CORRECT: Use existing function
$course = get_course($courseid);  // Includes validation, caching, hooks
```

## Implementation Guidelines

**API Utility Base Class**:
- All endpoints extend `ApiBase` class
- Provides JWT validation, error handling, response formatting
- Located in `api/lib/api_base.php`

**Endpoint File Structure**:
```php
<?php
require_once(__DIR__ . '/../../config.php');
require_once($CFG->dirroot . '/course/lib.php');
require_once(__DIR__ . '/../lib/api_base.php');

class CourseEndpoint extends ApiBase {
    public function handle_get($id) {
        $this->validate_token();
        $context = context_course::instance($id);
        require_capability('moodle/course:view', $context);
        
        $course = get_course($id);  // Existing function
        $contents = get_course_contents($id);  // Existing function
        
        return $this->json_response([
            'course' => $course,
            'contents' => $contents
        ]);
    }
}

$endpoint = new CourseEndpoint();
$endpoint->handle();
```

**Code Review Checklist**:
- [ ] No business logic implemented in API endpoint
- [ ] Calls existing Moodle core function(s)
- [ ] Permission check via require_capability()
- [ ] Standard JSON response envelope used
- [ ] No direct database queries
- [ ] Error handling preserves Moodle exceptions

## References
- Agent Action Plan Section 0.1: Zero Business Logic Duplication
- Agent Action Plan Section 0.7: API Endpoint Requirements
- Agent Action Plan Section 0.6: Prohibited Practices
- Implementation: `api/lib/api_base.php`, `api/v1/**/*.php`
