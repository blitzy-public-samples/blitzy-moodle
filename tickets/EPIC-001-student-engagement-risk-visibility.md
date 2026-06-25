# EPIC-001: Surface Student Engagement Risk on the Course Page

- **Epic ID:** EPIC-001
- **Type:** Epic
- **Status:** Draft — Ready for Refinement
- **Target platform:** Moodle course-page block (downstream working name `block_engagement`)
- **Platform baseline:** Moodle 5.2dev (Build: 20251024), branch 502 [public/version.php:L32-L37]

## Summary

This epic delivers a single, in-course view that lists every enrolled student alongside three deterministic engagement signals — activity recency, overdue work, and assessment trend — together with an overall risk flag, rendered on the course page so a teacher can prioritize and intervene before a student falls behind. The view is delivered as an opt-in, permission-respecting course-page block that reuses existing Moodle data rather than introducing a new tool or a parallel data store. Its signals are computed deterministically from observed course data, which keeps the feature distinct from Moodle's machine-learning prediction subsystem.

## Business Value

Today a teacher who wants to know who is disengaging must manually sweep across separate screens — the gradebook, the activity and access logs, and assignment submission lists — and mentally stitch the picture together one student at a time. This epic replaces that manual, multi-screen checking with one at-a-glance view on the course page, so a teacher can spot at-risk students and intervene before the student falls behind. Because the view is scoped to a single course and reads bounded, cached data, it loads fast enough to belong in a daily teaching routine rather than being a periodic batch reporting exercise.

## Scope Boundaries

### In Scope (v1)

- **In-course per-student overview (R1):** one course-scoped view listing each enrolled student with their engagement signals.
- **Activity-recency signal (R2a):** how recently each student has been active in the course.
- **Overdue-work signal (R2b):** whether each student has work past its due date.
- **Assessment-trend signal (R2c):** whether each student's assessment performance is trending up or down over a defined comparison window.
- **Visual flag and prioritization (R3):** students showing concerning patterns are flagged and surfaced first so the teacher knows whom to check on first.
- **Per-course adjustable thresholds with sensible defaults (R4, I5):** the values that define "concerning" ship with out-of-the-box defaults and can be adjusted per course.
- **Opt-in per course (R5):** the view is enabled per course and is never forced site-wide.
- **Permission-respecting access (R6):** visibility is bounded by existing student-data-access capabilities and never widens them.
- **In-context delivery, no new tool (R7):** the experience lives on the course page; the teacher does not navigate away or learn a separate application.
- **Daily-use performance (R8):** the view loads within a course-page performance budget so it fits a daily routine.

### Out of Scope (v1)

The following items are excluded from the first version, reproduced verbatim from the objective statement:

> Automated notifications or alerts to teachers, visibility for parents or guardians, aggregated views across multiple courses, predictive modeling, and customization of which engagement signals are displayed.

**Predictive Analytics Engine boundary.** This feature computes its signals **deterministically** from observed course data (last access, assignment due dates and submission state, and recorded grades). It is intentionally **distinct from, and does not couple to,** Moodle's existing machine-learning Predictive Analytics Engine; "predictive modeling" is itself one of the out-of-scope items listed above. This boundary is stated here to prevent accidental coupling to the analytics subsystem during downstream implementation.

## Features

This epic is delivered through three child features. Each link is relative to this file's location under `tickets/`.

1. [FEATURE-001-01: In-Course Engagement Overview](EPIC-001/FEATURE-001-01-in-course-engagement-overview.md) — the at-a-glance enrolled-student roster and its three engagement signals plus the flag-and-prioritize behavior (covers R1, R2a, R2b, R2c, R3). Contains 5 stories.
2. [FEATURE-001-02: Configurable Risk Thresholds](EPIC-001/FEATURE-001-02-configurable-risk-thresholds.md) — sensible default thresholds plus per-course adjustment and persistence (covers I5, R4). Contains 3 stories.
3. [FEATURE-001-03: Opt-In and Permission-Respecting Access](EPIC-001/FEATURE-001-03-optin-and-permission-respecting-access.md) — per-course opt-in enablement, enforcement of existing data-access permissions, and the daily-use performance budget (covers R5, R6, R8). Contains 3 stories.

## Dependencies

### Internal (cross-feature)

- The flag-and-prioritize behavior in **FEATURE-001-01** consumes the thresholds owned by **FEATURE-001-02**. It remains **independently demonstrable** through the FEATURE-001-02 default thresholds, so FEATURE-001-01 can be shown to a Product Owner without any threshold customization (preserving INVEST Independence).
- The opt-in enablement in **FEATURE-001-03** is the precondition for the overview appearing on a course page; until a teacher adds the block to a course, no view renders there.

### External platform (read-only Moodle grounding — reused, never modified)

The downstream block reuses existing Moodle core APIs and data. The references below are cited at a high level for grounding only; no file listed here is created, edited, or deleted by this epic or by authoring its tickets:

- **Block plugin contract (delivery vehicle):** the course-page block model, bound to the course view via `applicable_formats()` (see `public/blocks/completionstatus/block_completionstatus.php:L36`), with per-course threshold and opt-in state persisted through per-instance configuration — `instance_config_save()` and `$this->config` (see `public/blocks/moodleblock.class.php:L462,L516`).
- **Enrolment API (student roster):** course-context enrolled-user retrieval (`public/lib/enrollib.php`), with role-scoped helpers in `public/lib/accesslib.php`.
- **Gradebook and access data (signals):** `grade_grades` and `grade_grades_history` for the assessment trend, and `user_lastaccess` for activity recency (`public/lib/db/install.xml`); assignment due and cut-off dates from `mod_assign` (`public/mod/assign/db/install.xml`).
- **Capability framework (permission enforcement):** course-context capability checks that reuse existing student-data-access capabilities (`public/lib/db/access.php`).
- **Presentation layer:** the Boost theme with Mustache templates and the `$OUTPUT` renderer, using status tokens so risk flags convey meaning through color, icon, and text together for WCAG 2.1 AA conformance.

### Third-party dependencies

This epic introduces **zero** new third-party dependencies. The downstream block relies solely on Moodle core APIs (enrolment, gradebook, assignment, capability and access, Moodle Universal Cache, the output and Mustache rendering layer, and the privacy API).

## Definition of Done

- [ ] All three child features are authored, each with its own summary, story index, dependencies, and feature-level Definition of Done.
- [ ] Every requirement R1-R8 and the I5 defaults prerequisite maps to at least one child story, with no orphaned requirement.
- [ ] All eleven user stories are authored to the INVEST and BDD quality gate: 4-8 Given/When/Then acceptance criteria each, zero forbidden terms, 3-5 edge cases covering the Empty/Null, Boundary, and Invalid-Input categories, sub-tasks with `@assignee` placeholders, a Fibonacci story-point estimate, and a story-level Definition of Done.
- [ ] The verbatim v1 exclusions and the Predictive Analytics Engine boundary are stated in this epic's scope boundaries.
- [ ] All epic-to-feature relative links resolve under the exact `tickets/` naming convention.
- [ ] The feature is specified as an opt-in, permission-respecting, in-context course-page block that reuses core Moodle APIs — no new tool, no widened data access, and no new third-party dependency.

## Requirement Traceability

| Requirement | Description | Owning feature |
|-------------|-------------|----------------|
| R1 | In-course per-student overview | [FEATURE-001-01](EPIC-001/FEATURE-001-01-in-course-engagement-overview.md) |
| R2a | Activity-recency signal | [FEATURE-001-01](EPIC-001/FEATURE-001-01-in-course-engagement-overview.md) |
| R2b | Overdue-work signal | [FEATURE-001-01](EPIC-001/FEATURE-001-01-in-course-engagement-overview.md) |
| R2c | Assessment-trend signal | [FEATURE-001-01](EPIC-001/FEATURE-001-01-in-course-engagement-overview.md) |
| R3 | Visual flag and prioritization | [FEATURE-001-01](EPIC-001/FEATURE-001-01-in-course-engagement-overview.md) |
| R4 | Adjustable per-course thresholds | [FEATURE-001-02](EPIC-001/FEATURE-001-02-configurable-risk-thresholds.md) |
| I5 | Sensible default thresholds | [FEATURE-001-02](EPIC-001/FEATURE-001-02-configurable-risk-thresholds.md) |
| R5 | Opt-in per course | [FEATURE-001-03](EPIC-001/FEATURE-001-03-optin-and-permission-respecting-access.md) |
| R6 | Permission-respecting access | [FEATURE-001-03](EPIC-001/FEATURE-001-03-optin-and-permission-respecting-access.md) |
| R7 | In-context, no new tool | [FEATURE-001-01](EPIC-001/FEATURE-001-01-in-course-engagement-overview.md), [FEATURE-001-03](EPIC-001/FEATURE-001-03-optin-and-permission-respecting-access.md) |
| R8 | Daily-use performance | [FEATURE-001-03](EPIC-001/FEATURE-001-03-optin-and-permission-respecting-access.md) |
