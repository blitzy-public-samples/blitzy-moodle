# STORY-001-02-02: Compute last-login signal

## User Story

**As a** Course Teacher,
**I want** each student's number of days since their last site login displayed,
**So that** I can spot students who have stopped logging in to the site.

This story documents the first of the four engagement signals in FEATURE-001-02: the number of whole days since each enrolled student's last site login, read from the `user.lastlogin` field. The signal is computed per roster row produced by STORY-001-02-01, so the enrolled-student roster must exist before the value is attached to a student. A `lastlogin` value of 0 means the student has never logged in to the site; that case is shown as the defined never-logged-in state rather than a misleading day count (a raw conversion of 0 would report the days elapsed since the Unix epoch). The signal is read-only — it reads the `user.lastlogin` integer field and introduces no new database table in v1 — and it is shown only to a viewer gated by the role's existing Moodle capabilities, mirroring the verified `block_accessreview` analog that gates its content at render time with `if (!isloggedin() || isguestuser() || !has_capability('block/accessreview:view', $context))`; Class Pulse applies the same gate with `block/classpulse:view`.

## Acceptance Criteria

Each scenario is authored in Given/When/Then form, mirrors the repository Gherkin convention (Source: `.gherkin-lintrc`; canonical narrative in `public/blocks/accessreview/tests/behat/accessreview.feature`), and resolves to a binary pass or fail outcome.

**Scenario 1 — Day count for a student who has logged in (valid output)**

- **Given** a student whose `user.lastlogin` timestamp was 5 days before the current server time,
- **When** the Class Pulse block renders,
- **Then** the last-login engagement signal for that student shows 5 days.

**Scenario 2 — Never-logged-in student (input validation)**

- **Given** a student whose `user.lastlogin` equals 0,
- **When** the last-login signal is computed,
- **Then** the signal shows the defined never-logged-in state and not a numeric day count.

**Scenario 3 — Viewer without the view capability sees no value (authorization)**

- **Given** a viewer who lacks `block/classpulse:view` in the block context,
- **When** the course page renders,
- **Then** no last-login value is shown for any student.

**Scenario 4 — Signal is read-only and adds no table (read-only / no new tables)**

- **Given** the last-login signal reads the `user.lastlogin` field,
- **When** the value is computed,
- **Then** the field is read without modification and no new database table is created.

**Scenario 5 — User record cannot be read (error handling)**

- **Given** the `user` record cannot be read for a student in the roster,
- **When** the block renders,
- **Then** the last-login cell shows the defined unknown state and no error is surfaced to the Course Teacher.

**Scenario 6 — Student logged in today (edge/boundary)**

- **Given** a student who logged in earlier today,
- **When** the days-since-last-login value is computed,
- **Then** the last-login engagement signal shows 0 days.

## Sub-Tasks

- [ ] Read `user.lastlogin` for each enrolled student in the roster produced by STORY-001-02-01 @assignee
- [ ] Convert the `lastlogin` timestamp to whole days since last login against the current server time @assignee
- [ ] Map `lastlogin` = 0 to the defined never-logged-in state @assignee
- [ ] Clamp a `lastlogin` timestamp ahead of the current server time to 0 days so no negative count is shown @assignee
- [ ] Surface the day count (or the never-logged-in state) per roster row to the renderer @assignee

## Edge Cases

- **Empty/Null Input** — a student who has never logged in (`user.lastlogin` equals 0): the signal shows the defined never-logged-in state and not a numeric day count.
- **Boundary Values** — a student who logged in earlier today: the days-since-last-login value is 0 days.
- **Invalid Input** — a `user.lastlogin` timestamp ahead of the current server time (a future or clock-skewed value): the value is clamped to 0 days and no negative day count is shown.
- **Concurrent/Conflicting Operations** — a student logs in while the block is rendering: the signal reflects a single consistent read of `user.lastlogin` taken during that render and raises no error.

## Dependencies

- **Prerequisite story — STORY-001-01-01 (scaffold).** The `block_classpulse` scaffold must exist before any engagement signal is computed, so this story depends on [STORY-001-01-01](../FEATURE-001-01/STORY-001-01-01-scaffold-block-plugin-skeleton.md).
- **Prerequisite story — STORY-001-02-01 (roster).** The last-login signal is computed per roster row, so the enrolled-student roster must be built first; this story depends on [STORY-001-02-01](./STORY-001-02-01-build-enrolled-student-roster.md).
- **Feature dependency — FEATURE-001-02 depends on FEATURE-001-01.** This story belongs to FEATURE-001-02 (Engagement Signal Computation & Roster), which depends on the block scaffold, capability model, and placement delivered by FEATURE-001-01.
- **External platform dependency (documentation context only — no code is changed).** The signal reads the Moodle `user` table `lastlogin` integer field; the related `lastaccess` and `currentlogin` fields live in the same table.

## Estimation

| Dimension | Assessment | Rationale |
|-----------|------------|-----------|
| Effort | Low | A single integer field read per roster row plus a timestamp-to-days conversion. |
| Complexity | Low | One `user.lastlogin` field, one day conversion, and the `lastlogin` = 0 never-logged-in mapping; no join or aggregation across subsystems. |
| Uncertainty | Low | The `user.lastlogin` field is verified in this repository (`int(10) NOTNULL DEFAULT 0`) and the capability gate mirrors an existing analog block. |

**Story point estimate: 2 (Fibonacci).**

## Definition of Done

- [ ] The days-since-last-login value is derived from the `user.lastlogin` field for each enrolled student in the roster.
- [ ] The never-logged-in case (`user.lastlogin` equals 0) is documented as the defined never-logged-in state rather than a numeric day count.
- [ ] The boundary case where a student logged in today resolves to 0 days.
- [ ] An authorization acceptance criterion is present: a viewer who lacks `block/classpulse:view` sees no last-login value.
- [ ] A read-only / no-new-tables acceptance criterion is present: the `user.lastlogin` field is read without modification and no new database table is created.
- [ ] The signal is computed per enrolled student in the roster delivered by STORY-001-02-01.
- [ ] The story satisfies the six INVEST principles (Independent, Negotiable, Valuable, Estimable, Small, Testable) and is demonstrable for Product Owner acceptance.
- [ ] The story carries 4–8 acceptance criteria in Given/When/Then form covering one valid-output, one input-validation, one error-handling, and one edge/boundary scenario, plus the authorization and read-only criteria, each with a binary pass/fail outcome.
- [ ] The story enumerates 3–5 edge cases spanning Empty/Null Input, Boundary Values, Invalid Input, and Concurrent/Conflicting Operations.
- [ ] Zero forbidden terms appear in any acceptance criterion.
- [ ] Key Citations reference the grounding Moodle source paths.

## Key Citations

- Source: public/lib/db/install.xml — the `user` table `lastlogin` field (`int(10) NOTNULL DEFAULT 0`) behind the days-since-last-login signal, where a value of 0 means the student has never logged in; the related `lastaccess` and `currentlogin` fields are defined in the same table.
- Source: public/blocks/accessreview/block_accessreview.php — the render-time gate `if (!isloggedin() || isguestuser() || !has_capability('block/accessreview:view', $context))` that the last-login signal mirrors with `block/classpulse:view`.

[⬅ Back to FEATURE-001-02](../FEATURE-001-02-engagement-signal-computation.md)
