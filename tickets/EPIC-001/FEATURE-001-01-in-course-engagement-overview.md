# FEATURE-001-01: In-Course Engagement Overview

- **Feature ID:** FEATURE-001-01
- **Parent Epic:** [EPIC-001: Surface Student Engagement Risk on the Course Page](../EPIC-001-student-engagement-risk-visibility.md)
- **Type:** Feature
- **Status:** Draft / Ready for Refinement
- **Requirements covered:** R1, R2a, R2b, R2c, R3

## Summary

This feature delivers a single course-page view that lists each enrolled student alongside three deterministic engagement signals — activity recency, overdue work, and assessment trend — together with an overall risk flag, so a teacher sees engagement risk at a glance without leaving the course page. It is the at-a-glance surface of [EPIC-001: Surface Student Engagement Risk on the Course Page](../EPIC-001-student-engagement-risk-visibility.md): the roster that the epic's other two features configure and govern.

## Description

This feature replaces the manual sweep a teacher performs today — opening the gradebook, the activity and access logs, and the assignment submission lists, then stitching the picture together one student at a time — with one consolidated in-course roster that presents every enrolled student and their engagement signals in one place. It is the heart of the epic and the surface every other feature configures or governs: [FEATURE-001-02: Configurable Risk Thresholds](FEATURE-001-02-configurable-risk-thresholds.md) tunes the thresholds this roster flags against, and [FEATURE-001-03: Opt-In and Permission-Respecting Access](FEATURE-001-03-optin-and-permission-respecting-access.md) governs when the roster renders and who may see it.

1. **One roster, every enrolled student (R1).** The view enumerates each student enrolled in the single course that hosts it and presents one row per student, so the teacher reads the whole class from one place instead of opening a separate screen per student.
2. **Three deterministic signals per student (R2a, R2b, R2c).** Each row carries how recently the student was active in the course (recency), whether the student has work past its due date (overdue), and whether the student's assessment performance is trending up or down over a defined comparison window (trend). Every value is derived from observed course data, not from a predictive model.
3. **Flag and prioritize at a glance (R3).** The three signals roll up into one risk flag per student, and students showing concerning patterns are surfaced first, so the teacher knows whom to check on before a student falls behind.

## User Stories

This feature is delivered through five child stories. Each link is relative to this file's location in `tickets/EPIC-001/`.

1. [STORY-001-01-01: Display Engagement Roster](FEATURE-001-01/STORY-001-01-01-display-engagement-roster.md) — render the enrolled-student roster on the course page (R1).
2. [STORY-001-01-02: Activity-Recency Signal](FEATURE-001-01/STORY-001-01-02-activity-recency-signal.md) — show how recently each student was active (R2a).
3. [STORY-001-01-03: Overdue-Work Signal](FEATURE-001-01/STORY-001-01-03-overdue-work-signal.md) — show whether each student has work past its due date (R2b).
4. [STORY-001-01-04: Assessment-Trend Signal](FEATURE-001-01/STORY-001-01-04-assessment-trend-signal.md) — show whether each student's assessment performance is trending up or down (R2c).
5. [STORY-001-01-05: Flag and Prioritize At-Risk](FEATURE-001-01/STORY-001-01-05-flag-and-prioritize-at-risk.md) — visually flag concerning students and surface them first (R3).

## Dependencies

### Internal (within this feature)

- **STORY-001-01-01 (roster)** is the container the four signal and flag stories render into; without the roster there is no surface on which the signals appear.
- **STORY-001-01-02 (recency), STORY-001-01-03 (overdue), and STORY-001-01-04 (trend)** each contribute one signal to a student's roster row, reading the existing Moodle data sources cited below.
- **STORY-001-01-05 (flag and prioritize)** consumes the outputs of STORY-001-01-02, STORY-001-01-03, and STORY-001-01-04 to compute one overall risk flag per student and to order the roster so concerning students surface first.

### Cross-feature

- The flagging in **STORY-001-01-05** consumes the thresholds owned by [FEATURE-001-02: Configurable Risk Thresholds](FEATURE-001-02-configurable-risk-thresholds.md). This feature stays **independently demonstrable** because FEATURE-001-02 ships sensible default thresholds (I5) that apply out of the box, so the roster flags students for a Product Owner before any threshold is adjusted — which preserves INVEST Independence.
- This feature renders on a course page only once the overview is **enabled per course** through [FEATURE-001-03: Opt-In and Permission-Respecting Access](FEATURE-001-03-optin-and-permission-respecting-access.md): until a teacher adds the block to a course, no roster appears there, and the roster's data is bounded by the course-context permission checks FEATURE-001-03 enforces.

### External platform grounding (read-only Moodle — high-level; no file below is modified)

The downstream block reuses existing Moodle core APIs and reads existing data. The references below are cited for grounding only; no file listed here is created, edited, or deleted by this feature or by authoring its tickets:

- **Enrolled-student roster** via the enrolment API: `get_enrolled_users()` and `get_enrolled_sql()` with a capability/role filter [public/lib/enrollib.php:L1536,L1664], scoped to the student role through `get_role_users()` [public/lib/accesslib.php:L4063], evaluated in the course context.
- **Activity recency (R2a)** from `user_lastaccess.timeaccess`, keyed per `userid` and `courseid` [public/lib/db/install.xml:L956].
- **Overdue work (R2b)** from the `mod_assign` `duedate` and `cutoffdate` fields, the per-user `extensionduedate`, and submission state [public/mod/assign/db/install.xml:L19,L25,L139].
- **Assessment trend (R2c)** from `grade_grades.finalgrade` compared against `grade_grades_history` over a defined comparison window [public/lib/db/install.xml:L2041,L2191].
- **Course-page delivery** via the block contract `applicable_formats()` returning `['course' => true]` [public/blocks/completionstatus/block_completionstatus.php:L36], so the overview renders in context without a separate tool.
- **Presentation** through the Boost theme with Mustache templates and the `$OUTPUT` renderer; risk flags use the status tokens `$danger`, `$warning`, `$success`, and `$info` together with a Font Awesome icon and a text label, so meaning is carried by color, icon, and text together and never by color alone (WCAG 2.1 AA).

### Third-party dependencies

This feature introduces **zero** new third-party dependencies; the downstream block reads its roster and signals through Moodle core APIs only (the enrolment library, the grade tables, the assignment tables, the access and capability framework, and the output and Mustache rendering layer).

## Scope Notes

The following items are excluded from the first version, reproduced verbatim from the objective statement:

> Automated notifications or alerts to teachers, visibility for parents or guardians, aggregated views across multiple courses, predictive modeling, and customization of which engagement signals are displayed.

- **Deterministic, not predictive.** The three signals are computed deterministically from observed course data — last access, assignment due dates and submission state, and recorded grades. This feature does not couple to Moodle's machine-learning Predictive Analytics Engine; "predictive modeling" is itself one of the out-of-scope items above.
- **Signal selection is fixed.** "Customization of which engagement signals are displayed" is out of scope: all three signals (activity recency, overdue work, assessment trend) are always shown. A teacher cannot add, remove, or hide a signal — only the numeric thresholds are configurable, and that configuration lives in [FEATURE-001-02: Configurable Risk Thresholds](FEATURE-001-02-configurable-risk-thresholds.md).

## Definition of Done

- [ ] All five child stories (STORY-001-01-01 through STORY-001-01-05) are authored to the INVEST and BDD quality gate: 4-8 Given/When/Then acceptance criteria each, zero forbidden terms, 3-5 edge cases covering Empty/Null Input, Boundary Values, and Invalid Input (and Concurrent/Conflicting Operations where applicable), sub-tasks with `@assignee` placeholders, a Fibonacci story-point estimate, and a story-level Definition of Done.
- [ ] Each of R1, R2a, R2b, R2c, and R3 is covered by at least one child story (roster → R1, recency → R2a, overdue → R2b, trend → R2c, flag → R3).
- [ ] All feature-to-story relative links resolve under the exact `tickets/` naming convention, and the parent-epic up-link resolves.
- [ ] The roster is specified to be built from the enrolment API in the course context (student role only), and all three signals read existing Moodle data read-only.
- [ ] Flag and prioritize is specified to convey risk by color, icon, and text together (WCAG 2.1 AA), consuming thresholds from FEATURE-001-02 with the FEATURE-001-02 defaults guaranteeing independent demonstrability.
- [ ] The verbatim v1 exclusions and the deterministic-versus-machine-learning boundary are stated in this feature's Scope Notes.
