# STORY-001-03-02: Enforce Data-Access Permissions

- **Story ID:** STORY-001-03-02
- **Parent Feature:** [FEATURE-001-03: Opt-In and Permission-Respecting Access](../FEATURE-001-03-optin-and-permission-respecting-access.md)
- **Epic:** [EPIC-001: Surface Student Engagement Risk on the Course Page](../../EPIC-001-student-engagement-risk-visibility.md)
- **Type:** User Story
- **Requirement:** R6 (privacy: I8)
- **Status:** Draft / Ready for Refinement

## User Story

**As a** Non-editing Teacher,
**I want** the engagement overview to show student data only when I already hold the course-context capability to view that data,
**so that** the view exposes zero data I could not already see in the gradebook.

The quantifiable benefit is twofold: the overview reuses the one existing course-context permission set — there is no second access model to administer — and it widens access to zero additional students and zero additional fields. A viewer who can already open the grader report sees the same student population through this block; a viewer who cannot open it sees nothing through this block.

## INVEST Justification

- **Independent:** The permission gate is demonstrable on its own — a permitted viewer and a denied viewer can be compared regardless of how the three engagement signals (recency, overdue work, assessment trend) are computed. The story relies on the block existing (STORY-001-03-01) but not on the signal internals.
- **Negotiable:** The exact capability chosen as the gate (`moodle/grade:viewall` versus `gradereport/grader:view`) and the wording of the denial message are open for refinement; the fixed invariant is that the view never widens access.
- **Valuable:** It guarantees the feature ships without creating a new data-exposure path, which is what lets a privacy-conscious institution enable it on a live course.
- **Estimable:** The work is bounded — one capability check in the course context, reuse of existing access scoping, and one privacy provider declaration — so it carries a Fibonacci estimate of 5.
- **Small:** It governs one decision (show or hide student data) and declares one block capability plus one privacy provider; it does not build the roster or compute the signals.
- **Testable:** Permitted-versus-denied rendering is deterministic and assertable per capability — a viewer who holds the capability sees the roster, and a viewer who lacks it sees zero student rows plus the denial message.

## Acceptance Criteria

1. **Given** a user viewing a course page that contains the engagement block, **When** the block builds its content, **Then** it resolves the course context with `context_course::instance($courseid)` and calls `has_capability` for `moodle/grade:viewall` (or `gradereport/grader:view`) before issuing any student-data query, and it proceeds to query only when that capability check returns true. *(Input-validation — the gate precedes data access.)*

2. **Given** a Non-editing Teacher who holds `moodle/grade:viewall` in the course context, **When** the block renders, **Then** it displays the engagement roster listing that course's enrolled students. *(Expected-output — permitted viewer.)*

3. **Given** a user who holds none of `moodle/grade:viewall`, `gradereport/grader:view`, or `block/engagement:view` in the course, **When** the block renders, **Then** it issues zero student-data queries, displays zero student rows, and shows the localized message "You do not have permission to view student engagement data". *(Error-handling — permission denied.)*

4. **Given** a viewer whose existing course rules restrict them to one separate group, **When** the block renders, **Then** it lists only the students in that group and never a student the viewer could not already see in the gradebook. *(Expected-output — no widening of access.)*

5. **Given** a viewer whose data-access capability is revoked while their session is open, **When** they reload the course page, **Then** the block re-runs the capability check and shows zero student data after the revocation. *(Edge-case — capability revoked mid-session.)*

6. **Given** the engagement plugin is installed, **When** the Moodle privacy registry is inspected, **Then** the plugin declares a privacy provider that describes the personal data the view surfaces (or a null provider when it stores none), following the `core_privacy` metadata-provider pattern. *(Privacy declaration.)*

## Edge Cases

- **Empty/Null Input:** A viewer who holds none of the data-access capabilities resolves the course context but sees zero student data and the localized denial message; a permitted viewer in a course with zero enrolled students sees zero student rows with the localized empty-state message rather than a denial.
- **Boundary Values:** A viewer granted the data-access capability at exactly the course context (not inheriting it from a higher category-level role) is permitted and sees the roster; a viewer who holds a data-access capability but lacks `block/engagement:view` does not see the block, because block visibility is gated as a distinct check.
- **Invalid Input:** When the block is rendered where no valid course context resolves (a non-course context such as the site front page), it resolves no course context and shows zero student data rather than failing open.
- **Concurrent/Conflicting Operations:** When a role or capability grant or revoke happens mid-session, the next render reflects the current capability state and never a stale "allowed" decision carried over from a prior request.

## Sub-tasks

- [ ] Resolve the course context (`context_course::instance`) and call `require_capability` / `has_capability` for `moodle/grade:viewall` (with `gradereport/grader:view` as the alternate gate) before any student-data query — @assignee
- [ ] Declare `block/engagement:view` in `db/access.php` (captype read, CONTEXT_BLOCK, archetypes editingteacher and manager) following the `block/accessreview:view` pattern, and gate block rendering on it — @assignee
- [ ] Build the roster query so it reuses existing access scoping (separate-group restriction and hidden-grade rules) so visibility never exceeds the gradebook — @assignee
- [ ] Implement the privacy provider at `classes/privacy/provider.php` following the `block_myoverview` pattern; declare the surfaced personal data through `get_metadata` (or implement `null_provider` when no data is stored) and add the matching `privacy:metadata` language strings — @assignee
- [ ] Localize the permission-denied message and all labels through `get_string` — @assignee
- [ ] Add PHPUnit and Behat tests covering the permitted, denied, group-restricted, and revoked-mid-session paths — @assignee

## Estimation

- **Effort:** Medium
- **Complexity:** Medium — capability resolution in the course context, reuse of existing access scoping (separate groups and hidden grades), and a privacy provider declaration.
- **Uncertainty:** Low-Medium
- **Story Points (Fibonacci):** **5**

## Definition of Done

- [ ] The capability check in the course context (`has_capability` / `require_capability` for `moodle/grade:viewall`, with `gradereport/grader:view` as the alternate) precedes any student-data query.
- [ ] A viewer lacking the capability sees zero student data plus the localized permission-denied message.
- [ ] Visibility never exceeds existing gradebook access — no widening — with separate-group restriction and hidden-grade rules respected.
- [ ] `block/engagement:view` (read, CONTEXT_BLOCK, editingteacher/manager) is declared and gates block rendering.
- [ ] A privacy provider is declared following the `core_privacy` metadata-provider pattern (or a null provider when the block stores no personal data).
- [ ] All user-facing strings flow through `get_string`.
- [ ] All acceptance criteria pass.
- [ ] PHPUnit and Behat tests for the permitted, denied, group-restricted, and revoked-mid-session paths pass.
- [ ] The relative up-links to the parent feature and the epic resolve.
- [ ] The deterministic boundary is stated: access is gated by Moodle capabilities only, with no dependency on the machine-learning Predictive Analytics Engine.

## Notes

- **Internationalization (I9):** The permission-denied message, the empty-state message, and every label flow through `get_string`, so no user-facing text is hardcoded.
- **Accessibility (I7):** The denial and empty-state messages are conveyed as text (never by color alone) and are keyboard reachable; the full WCAG 2.1 AA conformance of the roster itself is owned by STORY-001-01-01 (display engagement roster) and STORY-001-01-05 (flag and prioritize at-risk).
- **Privacy (I8):** Because the block surfaces personal data about identifiable students, the plugin declares a privacy provider at `classes/privacy/provider.php` following the `block_myoverview` pattern (`\core_privacy\local\metadata\provider`), or a `\core_privacy\local\metadata\null_provider` when it stores no personal data of its own. The obligation is declared, never omitted.
- **Deterministic boundary:** Access is gated by Moodle capabilities only. This story does not use or depend on the machine-learning Predictive Analytics Engine; the engagement signals it protects are computed deterministically from observed course data.
- **Dependencies:** This story gates [FEATURE-001-01: In-Course Engagement Overview](../FEATURE-001-01-in-course-engagement-overview.md) — the roster renders only after this permission check passes — and it operates on the block placed by [STORY-001-03-01: Opt-In Enable Per Course](STORY-001-03-01-optin-enable-per-course.md). It stays independently demonstrable: the permitted-versus-denied behavior is verifiable on its own.

## Scope (Verbatim v1 Exclusions)

The following items are excluded from the first version, reproduced verbatim from the objective statement:

> Automated notifications or alerts to teachers, visibility for parents or guardians, aggregated views across multiple courses, predictive modeling, and customization of which engagement signals are displayed.

Two of these bear directly on this story's access boundary. **"Visibility for parents or guardians"** is out of scope: access is granted only to course-context roles that already hold the cited capabilities (teacher, editingteacher, manager) and is never extended to a parent or guardian role. **"Aggregated views across multiple courses"** is out of scope: every capability check and every query is scoped to the single course that hosts the block, so there is no cross-course aggregation.
