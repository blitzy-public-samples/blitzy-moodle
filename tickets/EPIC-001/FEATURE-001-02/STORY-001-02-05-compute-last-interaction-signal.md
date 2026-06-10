# STORY-001-02-05: Compute last-interaction signal

## User Story

**As a** Course Teacher,
**I want** each student's timestamp of their last interaction with any activity in this course displayed,
**So that** I can see how recently each student engaged with the course.

This story documents the fourth of the four engagement signals in FEATURE-001-02: the timestamp of each enrolled student's last interaction with any activity in this course. Moodle records activity events in the standard log store and tracks per-user, per-course access times in the `user_lastaccess` table, so the timestamp is read from that last-access and log-store data (Source: public/report/log; public/lib/db/install.xml). The signal is computed per roster row produced by STORY-001-02-01, so the enrolled-student roster must exist before the timestamp is attached to a student. When a student has never interacted with any activity in the course, the signal resolves to the defined no-activity state rather than a misleading timestamp or an error, because no last-interaction time exists to display. The signal is read-only — it reads the log store and the `user_lastaccess` data and introduces no new database table in v1 — and it is shown only to a viewer gated by the role's existing Moodle capabilities, mirroring the verified `block_accessreview` analog that gates its content at render time with `if (!isloggedin() || isguestuser() || !has_capability('block/accessreview:view', $context))`; Class Pulse applies the same gate with `block/classpulse:view`.

## Acceptance Criteria

Each scenario is authored in Given/When/Then form, mirrors the repository Gherkin convention (Source: `.gherkin-lintrc`; canonical narrative in `public/blocks/accessreview/tests/behat/accessreview.feature`), and resolves to a binary pass or fail outcome. Scenarios 1, 2, 5, and 6 provide the required coverage (valid output, input validation, error handling, edge/boundary); Scenarios 3 and 4 are the cross-cutting authorization and read-only criteria carried by every signal story.

**Scenario 1 — Recent interaction shows its timestamp (valid output)**

- **Given** a student whose most recent recorded activity interaction in this course was 2 days ago,
- **When** the Class Pulse block renders,
- **Then** the last-interaction engagement signal for that student shows that 2-days-ago timestamp.

**Scenario 2 — Student with no recorded interaction (input validation)**

- **Given** a student with no recorded interaction with any activity in this course,
- **When** the last-interaction signal is computed,
- **Then** the signal shows the defined no-activity state and not a timestamp.

**Scenario 3 — Viewer without the view capability sees no value (authorization)**

- **Given** a viewer who lacks `block/classpulse:view` in the block context,
- **When** the course page renders,
- **Then** no last-interaction value is shown for any student.

**Scenario 4 — Signal is read-only and adds no table (read-only / no new tables)**

- **Given** the last-interaction signal reads the log store and last-access data,
- **When** the value is computed,
- **Then** the data is read without modification and no new database table is created.

**Scenario 5 — Log store disabled or purged (error handling)**

- **Given** the log store is disabled or its records have been purged,
- **When** the block renders,
- **Then** the last-interaction cell shows the defined no-activity state and no error is surfaced to the Course Teacher.

**Scenario 6 — Interaction at the course start time (edge/boundary)**

- **Given** a student whose only recorded interaction occurred at the course start time,
- **When** the last-interaction signal is computed,
- **Then** the signal shows that course-start timestamp.

## Sub-Tasks

- [ ] Read the last-access and log-store records for each enrolled student in the course produced by STORY-001-02-01 @assignee
- [ ] Determine the most recent activity-interaction timestamp per student from those records @assignee
- [ ] Map a student with no recorded interaction to the defined no-activity state @assignee
- [ ] Surface the timestamp (or the no-activity state) per roster row to the renderer @assignee

## Edge Cases

- **Empty/Null Input** — a student with no logged interaction with any activity in the course: the signal shows the defined no-activity state and not a timestamp.
- **Boundary Values** — a student whose only recorded interaction occurred exactly at the course start time: the signal shows that course-start timestamp.
- **Invalid Input / State** — the log store is disabled or its records have been purged: the signal resolves to the defined no-activity state and no error is surfaced to the Course Teacher.
- **Concurrent/Conflicting Operations** — a new interaction is recorded while the block is rendering: the signal reflects a single consistent read of the last-access and log-store data taken during that render and raises no error.

## Dependencies

- **Prerequisite story — STORY-001-01-01 (scaffold).** The `block_classpulse` scaffold must exist before any engagement signal is computed, so this story depends on [STORY-001-01-01](../FEATURE-001-01/STORY-001-01-01-scaffold-block-plugin-skeleton.md).
- **Prerequisite story — STORY-001-02-01 (roster).** The last-interaction timestamp is computed per roster row, so the enrolled-student roster must be built first; this story depends on [STORY-001-02-01](./STORY-001-02-01-build-enrolled-student-roster.md).
- **Feature dependency — FEATURE-001-02 depends on FEATURE-001-01.** This story belongs to FEATURE-001-02 (Engagement Signal Computation & Roster), which depends on the block scaffold, capability model, and placement delivered by FEATURE-001-01.
- **External platform dependency (documentation context only — no code is changed).** The signal reads the Moodle standard log store exposed through `report/log` and the `user_lastaccess` per-course access times; no logstore or report code is modified.

## Estimation

| Dimension | Assessment | Rationale |
|-----------|------------|-----------|
| Effort | Medium | Reading the last-access and log-store records per roster row and reducing them to the single most-recent activity-interaction timestamp per student. |
| Complexity | Medium | The timestamp aggregates the most recent interaction across the log store and per-course last-access data, plus the no-recorded-interaction mapping to the defined no-activity state; it goes beyond a single-field read but uses no cross-subsystem aggregation. |
| Uncertainty | Low | The `user_lastaccess` table (per-user, per-course `timeaccess`) and the standard log store are verified in this repository, and the capability gate mirrors an existing analog block. |

**Effort Medium, Complexity Medium, Uncertainty Low → 3 points.**

Story point estimate: 3 (Fibonacci).

## Definition of Done

- [ ] The last-interaction timestamp reflects the most recent activity interaction in this course for each enrolled student.
- [ ] The no-activity case (a student who has never interacted with any activity in the course) is documented as the defined no-activity state rather than a timestamp.
- [ ] A disabled or purged log store resolves to the defined no-activity state and surfaces no error to the Course Teacher.
- [ ] The boundary case where the only recorded interaction occurred at the course start time resolves to that course-start timestamp.
- [ ] An authorization acceptance criterion is present: a viewer who lacks `block/classpulse:view` sees no last-interaction value for any student.
- [ ] A read-only / no-new-tables acceptance criterion is present: the log store and last-access data are read without modification and no new database table is created.
- [ ] The signal is computed per enrolled student in the roster delivered by STORY-001-02-01.
- [ ] The story satisfies the six INVEST principles (Independent, Negotiable, Valuable, Estimable, Small, Testable) and is demonstrable for Product Owner acceptance.
- [ ] The story carries 4–8 acceptance criteria in Given/When/Then form covering one valid-output, one input-validation, one error-handling, and one edge/boundary scenario, plus the authorization and read-only criteria, each with a binary pass/fail outcome.
- [ ] The story enumerates 3–5 edge cases spanning Empty/Null Input, Boundary Values, Invalid Input, and Concurrent/Conflicting Operations where applicable.
- [ ] Zero forbidden terms appear in any acceptance criterion.
- [ ] Key Citations reference the grounding Moodle source paths.

## Key Citations

- Source: public/report/log — the standard log store that records activity events behind the last-interaction signal; the timestamp of a student's last interaction with any activity in this course is read from this log-store data.
- Source: public/lib/db/install.xml — the `user_lastaccess` table (per-user, per-course `timeaccess`), commented "To keep track of course page access times, used in online participants block, and participants list", that records the per-course last-access time behind the last-interaction signal.
- Source: public/blocks/accessreview/block_accessreview.php — the render-time gate `if (!isloggedin() || isguestuser() || !has_capability('block/accessreview:view', $context))` that the last-interaction signal mirrors with `block/classpulse:view`.

[⬅ Back to FEATURE-001-02](../FEATURE-001-02-engagement-signal-computation.md)
