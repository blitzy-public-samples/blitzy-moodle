# ADR 0006: Feature Flag Gradual Rollout Strategy

## Status
ACCEPTED

## Context
The refactoring transforms Moodle's entire user interface from PHP server-side rendering to React SPA. This is a high-risk change affecting:
- All user workflows (students, teachers, administrators)
- 320+ new React components
- 127 new API endpoints
- Complex features (quizzes, gradebook, assignments)
- Multiple user roles with different permission levels

**Risks of Big-Bang Deployment**:
- Undiscovered bugs affect all users simultaneously
- Difficult to isolate issues to specific features
- No graceful degradation if problems arise
- User disruption and training challenges
- High-pressure rollback if critical bugs found

**Requirement for Gradual Rollout**:
- Test new interface with subset of users before full deployment
- Enable feature-by-feature rollout (dashboard first, gradebook last)
- Provide instant rollback mechanism without code deployment
- Support dual interfaces during transition period
- Allow different rollout speeds per institution

The refactoring must support **safe, incremental adoption** while maintaining 100% backward compatibility with the PHP interface.

## Decision
We will implement a **Feature Flag System** for gradual rollout:

1. **Feature Flag Configuration**:
   ```php
   // config.php
   $CFG->react_features = [
       'enabled' => true,  // Master switch
       'dashboard' => true,      // Student/teacher dashboard
       'courses' => true,        // Course catalog and detail
       'assignments' => false,   // Keep PHP for now
       'quizzes' => false,       // Keep PHP for now
       'forums' => false,        // Keep PHP for now
       'gradebook' => false,     // Keep PHP for now
       'messaging' => false,     // Keep PHP for now
       'admin' => false          // Keep PHP for now
   ];
   
   // Per-user override capability
   $CFG->react_user_preference = true;  // Allow users to choose interface
   
   // Per-role default
   $CFG->react_default_roles = [
       'student' => true,   // Students use React by default
       'teacher' => false,  // Teachers use PHP by default
       'admin' => false     // Admins use PHP by default
   ];
   ```

2. **Routing Logic**:
   - PHP pages check feature flags before rendering
   - If React enabled for feature, redirect to React route
   - React app checks flags, falls back to PHP if disabled
   - User preference override stored in cookie or user_preferences table

3. **Phased Rollout Sequence (Recommended)**:

   **Phase 1 - Low Risk, Read-Heavy (Weeks 1-2)**:
   - ✅ Dashboard (student, teacher views)
   - ✅ Course Catalog (browse, search)
   - Risk: Low (read-only, no data modification)
   - Rollback: Immediate via flag

   **Phase 2 - Content Display (Weeks 3-4)**:
   - ✅ Course Detail Pages
   - ✅ Resource Viewing (files, pages, URLs)
   - Risk: Low-Medium (mostly read operations)
   - Rollback: Feature flag toggle

   **Phase 3 - Communication Features (Weeks 5-6)**:
   - ✅ Forums and Discussions
   - ✅ Messaging and Notifications
   - Risk: Medium (write operations, but non-critical)
   - Rollback: Feature flag + data consistency check

   **Phase 4 - Activity Modules (Weeks 7-10)**:
   - ✅ Assignments (submission and grading)
   - ✅ Quizzes (taking and review)
   - Risk: Medium-High (complex logic, timed operations)
   - Rollback: Feature flag, monitor for 48 hours

   **Phase 5 - Critical Features (Weeks 11-14)**:
   - ✅ Gradebook (viewing and editing)
   - ✅ User Management (admin functions)
   - ✅ Course Administration
   - Risk: High (grade data, user accounts)
   - Rollback: Feature flag, full backup before deployment

4. **Rollback Mechanisms**:
   - **Instant Rollback**: Change feature flag in config.php
   - **No Code Deployment**: Flag changes propagate immediately
   - **Per-Feature Rollback**: Disable problematic feature, keep others enabled
   - **Per-User Rollback**: Move users back to PHP interface individually
   - **Blue-Green Deployment**: React build artifacts can be swapped

5. **User Preference Override**:
   ```php
   // Users can manually choose interface
   $user_preference = get_user_preferences('interface_mode', 'auto');
   // 'auto' = follow feature flags
   // 'react' = force React (if feature enabled)
   // 'php' = force PHP (always available)
   ```

6. **Monitoring and Metrics**:
   - Error rate tracking per feature
   - Performance metrics (page load times)
   - User adoption rates
   - Rollback trigger thresholds (e.g., >5% error rate = auto-rollback)

## Consequences

**Positive**:
- **Risk Mitigation**: Issues isolated to specific features/users
- **Incremental Testing**: Real-world testing with subset of users
- **User Choice**: Users can opt-out if they prefer PHP interface
- **Instant Rollback**: No waiting for code deployment to revert
- **Confidence Building**: Success in early phases builds confidence for later phases
- **Parallel Operation**: Both interfaces work simultaneously
- **Graceful Migration**: Users transition at comfortable pace
- **A/B Testing**: Can compare React vs PHP performance metrics

**Negative**:
- **Dual Maintenance**: Must maintain both interfaces during transition
- **Code Complexity**: Routing logic checks feature flags
- **Testing Burden**: Must test both interfaces for each feature
- **User Confusion**: Some users may see React, others PHP for same feature
- **Configuration Management**: Feature flags must be tracked per environment

**Trade-offs**:
- Short-term complexity vs long-term safety (acceptable trade-off)
- Dual maintenance burden vs risk mitigation (necessary for safe migration)
- User confusion vs incremental adoption (mitigated by clear communication)

## Alternatives Considered

**Alternative 1: Big-Bang Deployment**
- Deploy all React features at once for all users
- REJECTED: Too high risk, no rollback granularity
- Single bug could break entire system for all users
- Difficult to isolate issues

**Alternative 2: Separate React Installation**
- Deploy React as completely separate Moodle instance
- REJECTED: Data synchronization nightmare, doubled infrastructure
- Users would need separate logins
- Not a true migration path

**Alternative 3: Per-Course Rollout**
- Enable React per course instead of per feature
- REJECTED: Too granular, difficult to manage at scale
- Some features span multiple courses (gradebook, messaging)
- Inconsistent user experience

**Alternative 4: Per-Institution Rollout**
- Each institution chooses when to adopt React
- PARTIALLY ADOPTED: Combined with feature flags
- Institutions can control rollout speed via feature flags
- Still benefits from feature-level granularity

## Implementation Guidelines

**PHP Page Check**:
```php
<?php
// At top of course/view.php
if (is_react_enabled('courses')) {
    $course_url = $CFG->wwwroot . '/react-frontend/#/courses/' . $courseid;
    redirect($course_url);
}
// Continue with PHP rendering
```

**React Route Guard**:
```typescript
function CourseDetailPage() {
  const { isFeatureEnabled } = useFeatureFlags();
  
  if (!isFeatureEnabled('courses')) {
    // Redirect to PHP version
    window.location.href = `/course/view.php?id=${courseId}`;
    return null;
  }
  
  return <CourseDetail />;
}
```

**User Preference UI**:
```typescript
function InterfaceToggle() {
  const [preference, setPreference] = useUserPreference('interface_mode');
  
  return (
    <ToggleButton value={preference} onChange={setPreference}>
      <option value="auto">Auto</option>
      <option value="react">New Interface (React)</option>
      <option value="php">Classic Interface (PHP)</option>
    </ToggleButton>
  );
}
```

## Rollout Checklist

**Before Each Phase**:
- [ ] Feature flag disabled in production
- [ ] Testing completed in staging environment
- [ ] Error monitoring configured
- [ ] Rollback procedure documented
- [ ] Support team trained on new features
- [ ] User communication sent

**During Phase Rollout**:
- [ ] Enable feature flag for 10% of users
- [ ] Monitor error rates for 24 hours
- [ ] Gradually increase to 25%, 50%, 75%, 100%
- [ ] Track user feedback and support tickets
- [ ] Address issues before proceeding

**After Phase Completion**:
- [ ] All users successfully migrated
- [ ] Error rates within acceptable thresholds (<0.5%)
- [ ] Performance metrics meet targets
- [ ] User feedback generally positive
- [ ] Support ticket volume normal

## Rollback Triggers

**Automatic Rollback if**:
- Error rate >5% for feature
- P95 response time >5 seconds
- Critical data integrity issue detected
- Security vulnerability discovered

**Manual Rollback if**:
- User satisfaction <70%
- Support ticket volume >3x normal
- Accessibility compliance failure
- Critical bug without quick fix

## Timeline

**Total Migration**: 14 weeks
- Phase 1 (Dashboard): 2 weeks
- Phase 2 (Content): 2 weeks
- Phase 3 (Communication): 2 weeks
- Phase 4 (Activities): 4 weeks
- Phase 5 (Critical): 4 weeks

**Post-Migration**: PHP interface remains available for 6 months for emergency fallback.

## References
- Agent Action Plan Section 0.7: Gradual Rollout Strategy
- Agent Action Plan Section 0.1: Dual Interface Support
- Implementation: `config.php`, routing logic in PHP pages and React router
