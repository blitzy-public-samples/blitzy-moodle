# STORY-001-02-03: Compute overdue-assignments signal

## User Story

**As a** Course Teacher,
**I want** each student's count of currently overdue assignments in this course displayed,
**So that** I can identify students falling behind on coursework.

This story documents the overdue-assignments engagement signal in FEATURE-001-02: the count of currently overdue assignments in this course for each enrolled student. An assignment is overdue when its due date has passed and the student has not submitted, so the count is derived from the Assignment module's `duedate` and per-student submission status (Source: public/mod/assign). The signal is computed per roster row produced by STORY-001-02-01, so the enrolled-student roster must exist before the count is attached to a student. An assignment with no due date set is excluded from the count, because an assignment without a due date cannot be overdue. The signal is read-only — it reads assignment due dates and submission status and introduces no new database table in v1 — and it is shown only to a viewer gated by the role's existing Moodle capabilities, mirroring the verified `block_accessreview` analog that gates its content at render time with `if (!isloggedin() || isguestuser() || !has_capability('block/accessreview:view', $context))`; Class Pulse applies the same gate with `block/classpulse:view`.

## Acceptance Criteria

Each criterion is authored in Given/When/Then form, mirrors the repository Gherkin convention (Source: `.gherkin-lintrc`; canonical narrative in `public/blocks/accessreview/tests/behat/accessreview.feature`), and resolves to a binary pass or fail outcome. The first four criteria provide the required coverage (valid output, input validation, error handling, edge/boundary); the final two are the cross-cutting authorization and read-only criteria carried by every signal story.

- **Valid output:** Given a student with 2 assignments past due date and not submitted, When the block renders, Then the overdue count shows 2.
- **Input validation:** Given an assignment with no due date set, When the count is computed, Then that assignment is excluded from the count.
- **Error handling:** Given the assignment subsystem returns no data for a student, When the block renders, Then the overdue count shows 0 and no error is surfaced to the teacher.
- **Edge/boundary:** Given a course with zero assignment activities, When the block renders, Then every student's overdue count shows 0.
- **Authorization:** Given a viewer who lacks `block/classpulse:view` in the block context, When the course page renders, Then no overdue-assignment count is shown for any student.
- **Read-only / no new tables:** Given the signal reads assignment due dates and submission status, When the count is computed, Then the assignment data is read without modification and no new database table is created.

## Sub-Tasks

- [ ] Query overdue assignments for enrolled users @assignee
- [ ] Exclude no-due-date and already-submitted items @assignee
- [ ] Surface count to the renderer @assignee

## Edge Cases

- **Empty:** no assignments
- **Boundary:** due exactly now
- **Invalid:** deleted assignment
- **Concurrent:** submission during render

## Dependencies

- **Prerequisite story — STORY-001-01-01 (scaffold).** The `block_classpulse` scaffold must exist before any engagement signal is computed, so this story depends on [STORY-001-01-01](../FEATURE-001-01/STORY-001-01-01-scaffold-block-plugin-skeleton.md).
- **Prerequisite story — STORY-001-02-01 (roster).** The overdue-assignments count is computed per roster row, so the enrolled-student roster must be built first; this story depends on [STORY-001-02-01](./STORY-001-02-01-build-enrolled-student-roster.md).
- **Feature dependency — FEATURE-001-02 depends on FEATURE-001-01.** This story belongs to FEATURE-001-02 (Engagement Signal Computation & Roster), which depends on the block scaffold, capability model, and placement delivered by FEATURE-001-01.
- **External platform dependency (documentation context only — no code is changed).** The signal reads the Moodle Assignment module's due dates and per-student submission status; no `mod_assign` code is modified.

## Estimation

| Dimension | Assessment | Rationale |
|-----------|------------|-----------|
| Effort | Medium | A per-student query of assignment due dates and submission status across the course, plus exclusion of no-due-date and already-submitted items. |
| Complexity | Medium | The count joins each enrolled student against the course's assignments and their submission status; it goes beyond a single-field read but uses no cross-subsystem aggregation. |
| Uncertainty | Low | The `duedate` field and the submitted status are verified in this repository (`public/mod/assign/lib.php`), and the capability gate mirrors an existing analog block. |

Effort Medium, Complexity Medium, Uncertainty Low -> 3 points

Story point estimate: 3 (Fibonacci).

## Definition of Done

- [ ] The overdue count reflects assignments whose due date has passed and that the student has not submitted.
- [ ] An assignment with no due date set is excluded from the count.
- [ ] An already-submitted assignment is excluded from the count.
- [ ] A course with zero assignment activities yields an overdue count of 0 for every student.
- [ ] An authorization acceptance criterion is present: a viewer who lacks `block/classpulse:view` sees no overdue-assignment count for any student.
- [ ] A read-only / no-new-tables acceptance criterion is present: assignment data is read without modification and no new database table is created.
- [ ] The signal is computed per enrolled student in the roster delivered by STORY-001-02-01.
- [ ] The story satisfies the six INVEST principles (Independent, Negotiable, Valuable, Estimable, Small, Testable) and is demonstrable for Product Owner acceptance.
- [ ] The story carries 4–8 acceptance criteria in Given/When/Then form covering one valid-output, one input-validation, one error-handling, and one edge/boundary scenario, plus the authorization and read-only criteria, each with a binary pass/fail outcome.
- [ ] The story enumerates 3–5 edge cases spanning Empty/Null Input, Boundary Values, Invalid Input, and Concurrent/Conflicting Operations.
- [ ] Zero forbidden terms appear in any acceptance criterion.
- [ ] Key Citations reference the grounding Moodle source paths.

## Key Citations

- Source: public/mod/assign — assignment due dates (`duedate`) and per-student submission status behind the overdue-assignments signal; an assignment is overdue when its due date has passed and the student has not submitted.
- Source: public/blocks/accessreview/block_accessreview.php — the render-time gate `if (!isloggedin() || isguestuser() || !has_capability('block/accessreview:view', $context))` that the overdue-assignments signal mirrors with `block/classpulse:view`.

[⬅ Back to FEATURE-001-02](../FEATURE-001-02-engagement-signal-computation.md)
