# FEATURE-001-03: Opt-In and Permission-Respecting Access

- **Feature ID:** FEATURE-001-03
- **Parent Epic:** [EPIC-001: Surface Student Engagement Risk on the Course Page](../EPIC-001-student-engagement-risk-visibility.md)
- **Type:** Feature
- **Status:** Draft / Ready for Refinement
- **Requirements covered:** R5, R6, R8

## Summary

This feature makes the engagement overview opt-in per course — a teacher turns it on by adding the block to one course — enforces existing student-data-access permissions in the course context so the view exposes no data beyond what the teacher can already see, and holds the rendered roster to a course-page performance budget through Moodle Universal Cache and single-course-bounded queries.

## Description

This feature supplies the three guarantees that let the engagement overview ship on a live course page without forcing it on every course, widening data access, or slowing the page down. It is the governance layer around the roster and signals authored in FEATURE-001-01.

1. **Opt-in per course (R5, R7).** Not every course wants the view, so it is never forced site-wide. Enablement is the act of a teacher adding the block to one course, and the block binds to the course page through the block contract. Keeping enablement a per-course placement decision is what keeps the experience in context and removes the need for a separate tool.
2. **Permission-respecting access (R6).** The view reuses Moodle's capability framework in the course context rather than a parallel access model, so it inherits the platform's existing data-protection rules and never widens them. A teacher sees only the student data that existing course-context capabilities already grant; a role without those capabilities sees nothing the role could not already reach.
3. **Daily-use performance (R8).** A bounded, cached query path keeps the view part of a daily teaching routine instead of a periodic batch report. The roster and its signals are read with single-course-scoped queries and served through Moodle Universal Cache, which avoids per-student repeat lookups (no N+1 access) on each page load.

## User Stories

This feature is delivered through three child stories. Each link is relative to this file's location in `tickets/EPIC-001/`.

1. [STORY-001-03-01: Opt-In Enable Per Course](FEATURE-001-03/STORY-001-03-01-optin-enable-per-course.md) — enable the overview per course by placing the block; it never appears site-wide automatically (R5).
2. [STORY-001-03-02: Enforce Data-Access Permissions](FEATURE-001-03/STORY-001-03-02-enforce-data-access-permissions.md) — gate the view and its data behind existing course-context capabilities (R6).
3. [STORY-001-03-03: Performance-Budget Load](FEATURE-001-03/STORY-001-03-03-performance-budget-load.md) — load the overview within a defined course-page performance budget using caching and bounded queries (R8).

## Dependencies

### Internal (within this feature)

- **STORY-001-03-01 (opt-in placement)** is the precondition for the view existing on a course page; until the block is added to a course, no overview renders there.
- **STORY-001-03-02 (permission enforcement)** gates what STORY-001-03-01 renders; the roster and its signals appear only after course-context capability checks pass.
- **STORY-001-03-03 (performance budget)** bounds the queries that build the roster and signals, so the view placed by STORY-001-03-01 stays within the course-page budget as enrolment grows.

### Cross-feature

This feature is the **gate and envelope** around [FEATURE-001-01: In-Course Engagement Overview](FEATURE-001-01-in-course-engagement-overview.md): the roster renders only once opt-in placement (STORY-001-03-01) and permission checks (STORY-001-03-02) pass, and the performance budget (STORY-001-03-03) bounds the roster and signal queries that FEATURE-001-01 issues. Threshold configuration owned by [FEATURE-001-02: Configurable Risk Thresholds](FEATURE-001-02-configurable-risk-thresholds.md) is likewise reachable only after opt-in placement — a teacher reaches the threshold form through the same block instance this feature enables.

### External platform grounding (read-only Moodle — high-level; no file below is modified)

- **Opt-in / course-page binding** uses the block contract `applicable_formats()` returning `['course' => true]` [public/blocks/completionstatus/block_completionstatus.php:L36]; a teacher-added block is inherently opt-in and is never forced site-wide.
- **Who may add and view the block** follows the block capability pattern `block/<name>:addinstance` and `block/<name>:view` [public/blocks/accessreview/db/access.php:L30,L41] (CONTEXT_BLOCK; archetypes editingteacher and manager).
- **Data-access enforcement** reuses Moodle's capability framework via `has_capability()` and `require_capability()` in the course context, keyed on existing capabilities such as `moodle/grade:viewall` [public/lib/db/access.php:L1658] and `gradereport/grader:view` [public/grade/report/grader/db/access.php:L29] (both CONTEXT_COURSE, riskbitmask RISK_PERSONAL, archetypes teacher/editingteacher/manager). The feature must never widen access beyond what these capabilities grant.
- **Per-instance state** (opt-in placement and the thresholds reached through it) persists through block instance configuration — `instance_config_save()` and `$this->config` [public/blocks/moodleblock.class.php:L462,L516] — rather than a new database table.
- **Performance** rests on Moodle Universal Cache (MUC) plus single-course-bounded queries with no N+1 access, building on the enrolment, grade, and assignment reads owned by FEATURE-001-01.

### Third-party dependencies

This feature introduces **zero** new third-party dependencies; the downstream block relies on Moodle core APIs only (the block contract, the capability and access framework, Moodle Universal Cache, and the privacy API).

## Scope Notes

The following items are excluded from the first version, reproduced verbatim from the objective statement:

> Automated notifications or alerts to teachers, visibility for parents or guardians, aggregated views across multiple courses, predictive modeling, and customization of which engagement signals are displayed.

Two of these exclusions bear directly on this feature's access boundary:

- **"Visibility for parents or guardians"** is out of scope. Access is granted only to course-context roles that already hold the cited capabilities (teacher, editingteacher, manager); it is never extended to guardian or parent roles. This reinforces that the view never widens access (R6).
- **"Aggregated views across multiple courses"** is out of scope. Every query is scoped to the single course that hosts the block, which reinforces that access is single-course and permission-bounded and that the performance budget covers one course's roster, not a cross-course aggregation (R8).

Because the view surfaces personal data about identifiable students, the downstream block must declare a **privacy provider** that documents the personal data the view processes, following the established Moodle pattern (for example, `public/blocks/myoverview/classes/privacy/provider.php`).

## Definition of Done

- [ ] All three child stories (STORY-001-03-01, STORY-001-03-02, STORY-001-03-03) are authored to the INVEST and BDD quality gate: 4-8 Given/When/Then acceptance criteria each, zero forbidden terms, 3-5 edge cases covering Empty/Null Input, Boundary Values, Invalid Input, and Concurrent/Conflicting Operations where applicable, sub-tasks with `@assignee` placeholders, a Fibonacci story-point estimate, and a story-level Definition of Done.
- [ ] R5 (opt-in), R6 (permission enforcement), and R8 (performance) are each covered by at least one child story.
- [ ] Opt-in is specified through block placement and the `applicable_formats()` course binding; the view never appears site-wide automatically.
- [ ] Permission enforcement is specified to reuse course-context capability checks (`has_capability()` / `require_capability()`, `moodle/grade:viewall`, `gradereport/grader:view`) and to never widen access beyond what those capabilities grant.
- [ ] The performance budget is specified with single-course-bounded queries (no N+1 access) and Moodle Universal Cache.
- [ ] All feature-to-story relative links resolve, and the parent-epic up-link resolves.
- [ ] The verbatim v1 exclusions and the privacy-provider obligation are stated in the Scope Notes.
