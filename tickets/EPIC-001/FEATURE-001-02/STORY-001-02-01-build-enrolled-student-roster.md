# STORY-001-02-01: Build enrolled-student roster

## User Story

**As a** Course Teacher,
**I want** the Class Pulse block to list every enrolled student in this course as one row each,
**So that** I have the complete class roster on which the engagement signals are displayed.

This is the foundational story of FEATURE-001-02. It documents only the enrolled-student roster — the set of students enrolled in the one course that hosts the block instance, listed one row each, respecting enrolment status (active versus suspended or unenrolled) and gated by the viewing role's capabilities so that the Course Teacher sees only data the role is authorized to see. It computes no engagement signal and renders no risk highlight; the four engagement signals (STORY-001-02-02 through STORY-001-02-05) each attach a per-student value to a roster row, and the risk highlight rendering is documented in FEATURE-001-03. The roster mirrors the verified `block_accessreview` analog, which gates its content at render time with `if (!isloggedin() || isguestuser() || !has_capability('block/accessreview:view', $context))`; the Class Pulse roster applies the same gate with `block/classpulse:view`.

## Acceptance Criteria

Each scenario is authored in Given/When/Then form, mirrors the repository Gherkin convention (Source: `.gherkin-lintrc`; canonical narrative in `public/blocks/accessreview/tests/behat/accessreview.feature`), and resolves to a binary pass or fail outcome.

**Scenario 1 — One row per actively enrolled student (valid output)**

- **Given** a course with 30 actively enrolled students,
- **When** the Class Pulse block renders,
- **Then** the roster displays exactly 30 rows, one per enrolled student.

**Scenario 2 — Suspended enrolments are excluded (input validation)**

- **Given** a course with 30 active enrolments and 3 suspended enrolments,
- **When** the roster is built,
- **Then** only the 30 active students appear and the 3 suspended students are excluded.

**Scenario 3 — Viewer without the view capability sees no rows (authorization)**

- **Given** a viewer who lacks `block/classpulse:view` in the block context,
- **When** the course page renders,
- **Then** the roster shows no student rows.

**Scenario 4 — Roster renders within the performance budget (performance)**

- **Given** a course with 50 enrolled students,
- **When** the Class Pulse block renders,
- **Then** the complete roster is displayed within 2 seconds.

**Scenario 5 — Empty enrolment result shows the defined empty-state (error handling)**

- **Given** the enrolment subsystem returns no users for the course,
- **When** the block renders,
- **Then** the roster shows the defined empty-state message and no error is surfaced to the Course Teacher.

**Scenario 6 — Course with zero enrolments shows the defined empty-state (edge/boundary)**

- **Given** a course with zero enrolled students,
- **When** the block renders,
- **Then** the roster shows the defined empty-state message and zero rows.

## Sub-Tasks

- [ ] Query the actively enrolled users of the current course and exclude suspended or unenrolled users @assignee
- [ ] Gate the roster on `block/classpulse:view` in the block context, mirroring the analog block's render-time capability check @assignee
- [ ] Resolve each enrolled student's identity fields (id and name) from the `user` table for the roster row @assignee
- [ ] Produce one roster row per enrolled student for the renderer, in a stable display order @assignee
- [ ] Define the empty-state message shown when the course has zero enrolled students @assignee

## Edge Cases

- **Empty/Null Input** — a course with no enrolments at all: the roster shows the defined empty-state message and zero rows, and no error is surfaced to the Course Teacher.
- **Invalid Input / State** — a suspended or unenrolled user associated with the course: the user is excluded from the roster and produces no row.
- **Boundary Values** — a course with exactly 50 enrolled students versus 51 enrolled students: the 50-student course is the documented performance threshold (the roster renders within 2 seconds), and the 51-student course sits one past that threshold.
- **Concurrent/Conflicting Operations** — an enrolment changes (a student is added or removed) while the block is rendering: the roster reflects a single consistent enrolment snapshot and renders one row per student in that snapshot without raising an error.

## Dependencies

- **Prerequisite story — STORY-001-01-01 (scaffold).** The `block_classpulse` scaffold must exist before the roster is built, so this story depends on [STORY-001-01-01](../FEATURE-001-01/STORY-001-01-01-scaffold-block-plugin-skeleton.md).
- **Downstream dependents — the four signal stories depend on this roster.** STORY-001-02-02 (last-login), STORY-001-02-03 (overdue assignments), STORY-001-02-04 (quiz-score trend), and STORY-001-02-05 (last interaction) each compute a per-student engagement signal attached to a roster row, so the enrolled-student roster must be built first.
- **Feature dependency — FEATURE-001-02 depends on FEATURE-001-01.** This story belongs to FEATURE-001-02 (Engagement Signal Computation & Roster), which depends on the block scaffold, capability model, and placement delivered by FEATURE-001-01.
- **External platform dependency (documentation context only — no code is changed).** The roster reads Moodle enrolment and the `user` table to determine the set of enrolled students of the current course.

## Estimation

| Dimension | Assessment | Rationale |
|-----------|------------|-----------|
| Effort | Medium | An enrolment query, capability gating, identity-field resolution, and one row per student for the renderer. |
| Complexity | Medium | Must respect active-versus-suspended enrolment status and the viewer's capabilities, mirroring the analog block's render-time gate, and carry the 2-second / 50-student performance budget. |
| Uncertainty | Low | The enrolment APIs and the capability gate are verified against an existing analog block in this repository. |

**Story point estimate: 3 (Fibonacci).**

## Definition of Done

- [ ] The roster lists every actively enrolled student in the course as one row each.
- [ ] Suspended and unenrolled users are excluded from the roster.
- [ ] The roster is gated on `block/classpulse:view` in the block context, so a viewer who lacks the capability sees no student rows.
- [ ] The render-within-2-seconds criterion for a course with up to 50 enrolled students is documented as an acceptance criterion.
- [ ] A defined empty-state message is documented for a course with zero enrolled students, and no error is surfaced to the Course Teacher.
- [ ] The story satisfies the six INVEST principles (Independent, Negotiable, Valuable, Estimable, Small, Testable) and is demonstrable for Product Owner acceptance.
- [ ] The story carries 4–8 acceptance criteria in Given/When/Then form covering one valid-output, one input-validation, one error-handling, and one edge/boundary scenario, plus the authorization and performance criteria, each with a binary pass/fail outcome.
- [ ] The story enumerates 3–5 edge cases spanning Empty/Null Input, Invalid Input, Boundary Values, and Concurrent/Conflicting Operations.
- [ ] Zero forbidden terms appear in any acceptance criterion.
- [ ] Key Citations reference the grounding Moodle source paths.

## Key Citations

- Source: public/lib/db/install.xml — the `user` table (one record per person) and the `user_enrolments` table (the enrolled users of a course, both teachers and students) that together define the enrolled-student set the roster lists.
- Source: public/blocks/accessreview/block_accessreview.php — the render-time gate `if (!isloggedin() || isguestuser() || !has_capability('block/accessreview:view', $context))` that the Class Pulse roster mirrors with `block/classpulse:view`.

[⬅ Back to FEATURE-001-02](../FEATURE-001-02-engagement-signal-computation.md)
