# STORY-001-03-05: Link to student course profile

## User Story

**As a** Course Teacher,
**I want** to select a student row and open that student's existing course profile page,
**So that** I can move from an engagement signal straight to the student's full course profile.

This story documents the click-through behavior layered onto the Class Pulse engagement table rendered in STORY-001-03-01: selecting a student row opens that student's existing Moodle course profile page for the current course. The destination is the standard Moodle user course-profile route, keyed by user id and course id — the `id` query parameter carries the student's user id and the `course` query parameter carries the current course id. The Class Pulse block builds that destination per row as a `moodle_url`, following the analog `block_accessreview` plugin, which constructs its navigable links with `moodle_url` from a base route plus a parameter array (for example `new moodle_url(accessibility::get_plugin_url(), ['action' => 'requestanalysis', 'courseid' => $COURSE->id])`, Source: public/blocks/accessreview/block_accessreview.php).

The link is read-only navigation: it reuses the course profile page Moodle already provides and recomputes no engagement signal, changes no threshold, and alters no risk highlight. Each row is selectable by pointer and by keyboard (Enter), so the click-through is reachable without a mouse. Profile-view authorization is not re-implemented here: Class Pulse defers to Moodle's existing profile-access control, so a viewer who is not permitted to see a student's course profile receives Moodle's standard outcome, and Class Pulse does not bypass that control.

The destination is composed from two values already present on each rendered row:

| Parameter | Source | Meaning |
|-----------|--------|---------|
| `id` | The enrolled student's user id (roster, STORY-001-02-01) | Identifies the student whose course profile opens |
| `course` | The current course id | Scopes the profile page to the course in which Class Pulse is placed |

## Acceptance Criteria

Each scenario is authored in Given/When/Then form, mirrors the repository Gherkin convention (Source: `.gherkin-lintrc`; canonical narrative in `public/blocks/accessreview/tests/behat/accessreview.feature`), and resolves to a binary pass or fail outcome. The scenarios provide the required coverage — valid output, input validation, error handling, and edge/boundary — for the student course-profile click-through behavior.

**Scenario 1 — Selecting a student row opens that student's course profile (valid output)**

- **Given** a rendered engagement table,
- **When** the Course Teacher selects a student's row,
- **Then** the browser opens that student's course profile page for the current course.

**Scenario 2 — The link targets the user course-profile URL composed from user id and course id (valid output)**

- **Given** a student row for user id U in course id C,
- **When** the row link is built,
- **Then** the target is the Moodle course-profile URL composed from user id U as the `id` parameter and course id C as the `course` parameter.

**Scenario 3 — Keyboard Enter opens the same profile as a pointer click (edge/boundary — accessible selection)**

- **Given** keyboard focus on a student row,
- **When** the Course Teacher presses Enter,
- **Then** that student's course profile page opens, matching the outcome of a pointer click on the same row.

**Scenario 4 — A restricted profile defers to Moodle's existing access control (input validation / authorization)**

- **Given** a student whose course profile the viewer is not permitted to see,
- **When** the Course Teacher selects that row,
- **Then** Moodle's existing profile-access control governs the outcome and Class Pulse does not bypass it.

**Scenario 5 — A stale row for an unenrolled student yields Moodle's standard not-available response (error handling)**

- **Given** a student who was unenrolled between the table render and the click,
- **When** the Course Teacher selects that row,
- **Then** Moodle's standard not-available response is shown and no Class Pulse error is surfaced to the Course Teacher.

**Scenario 6 — A row selected while the table refreshes navigates to the selected student (edge/boundary — concurrent)**

- **Given** the engagement table is being refreshed,
- **When** the Course Teacher selects a student row,
- **Then** the navigation targets the student whose row was selected.

## Sub-Tasks

- [ ] Build a moodle_url to each student's course profile from the student user id (`id`) and the current course id (`course`) @assignee
- [ ] Make each student row selectable by pointer and by keyboard (Enter) @assignee
- [ ] Defer profile-view authorization to Moodle's existing profile access control rather than re-implementing it @assignee
- [ ] Handle a stale or unenrolled student through Moodle's standard not-available response @assignee
- [ ] Confirm the click-through is read-only navigation that recomputes no engagement signal and changes no risk highlight @assignee

## Edge Cases

- **Authorization** — a student whose course profile the viewer is not permitted to see: Moodle's existing profile-access control governs the result and Class Pulse does not bypass it.
- **Invalid / Stale** — a student unenrolled between the table render and the click: Moodle's standard not-available response is shown and no Class Pulse error is surfaced.
- **Accessible selection** — keyboard Enter activation on a focused row opens the same course profile page as a pointer click on that row.
- **Concurrent/Conflicting Operations** — a row is selected while the table is being refreshed: the navigation targets the student whose row was selected.

## Dependencies

- **Prerequisite story — STORY-001-03-01 (rendered table).** Each profile link is carried by a row of the engagement table rendered in [STORY-001-03-01](./STORY-001-03-01-render-engagement-table-template.md), so this story depends on it.
- **Consumes the roster — STORY-001-02-01.** The user id that addresses each student's course profile comes from the enrolled-student roster delivered by [STORY-001-02-01](../FEATURE-001-02/STORY-001-02-01-build-enrolled-student-roster.md).
- **Feature dependency — FEATURE-001-03 depends on FEATURE-001-01 and consumes FEATURE-001-02.** This story belongs to [FEATURE-001-03](../FEATURE-001-03-risk-visualization-and-configuration.md), which depends on the block scaffold, capability model, and opt-in per-course placement delivered by [FEATURE-001-01](../FEATURE-001-01-block-scaffold-and-placement.md) and consumes the roster and four engagement signals delivered by [FEATURE-001-02](../FEATURE-001-02-engagement-signal-computation.md).
- **External platform dependency (documentation context only — no code is changed).** The link is a `moodle_url` to the Moodle user course-profile page addressed by user id (`id`) and course id (`course`), and profile-view authorization is governed by Moodle's existing profile-access control.

## Estimation

| Dimension | Assessment | Rationale |
|-----------|------------|-----------|
| Effort | Low | Build one `moodle_url` per row from the student user id and the current course id, and make each row selectable by pointer and by keyboard. |
| Complexity | Low | The destination is an existing Moodle course profile page; this story adds per-row navigation to it rather than building any new page or access check. |
| Uncertainty | Low | The `moodle_url` link-building pattern is verified against the `block_accessreview` analog in this repository, and the user course-profile route is a standard Moodle page keyed by user id and course id. |

**Effort Low, Complexity Low, Uncertainty Low → 2 points.**

Story point estimate: 2 (Fibonacci). This story is sized one Fibonacci step below the client-side sort and filter story (3 points) because it adds one navigation behavior — a per-row `moodle_url` to an existing profile page with keyboard activation — and reuses Moodle's existing profile page and access control rather than building new presentation or authorization.

## Definition of Done

- [ ] Selecting a student row opens that student's existing course profile page for the current course.
- [ ] The link target is the Moodle user course-profile URL composed from the student user id (`id`) and the current course id (`course`).
- [ ] Row selection works by pointer and by keyboard (Enter), and keyboard Enter activation opens the same profile as a pointer click.
- [ ] Profile-view authorization is deferred to Moodle's existing profile-access control, and Class Pulse does not bypass it.
- [ ] A stale or unenrolled student yields Moodle's standard not-available response, and no Class Pulse error is surfaced to the Course Teacher.
- [ ] The click-through is read-only navigation: it recomputes no engagement signal and changes no risk highlight.
- [ ] The story satisfies the six INVEST principles (Independent, Negotiable, Valuable, Estimable, Small, Testable) and is demonstrable for Product Owner acceptance.
- [ ] The story carries 4–8 acceptance criteria in Given/When/Then form covering one valid-output, one input-validation, one error-handling, and one edge/boundary scenario, each with a binary pass/fail outcome.
- [ ] The story enumerates 3–5 edge cases spanning Authorization, Invalid/Stale, Accessible selection, and Concurrent/Conflicting Operations.
- [ ] Zero forbidden terms appear in any acceptance criterion.
- [ ] Key Citations reference the grounding Moodle source paths.

## INVEST Self-Check

- **Independent** — the click-through operates on the table rendered in STORY-001-03-01; it does not require the threshold color-coding (STORY-001-03-03) or the client-side sort and filter (STORY-001-03-04) to be demonstrable.
- **Negotiable** — the story describes the navigation outcome (the student's course profile opens, addressed by user id and course id), not a fixed link markup or event-binding implementation.
- **Valuable** — the Course Teacher moves from an engagement signal straight to the student's full course profile in one selection.
- **Estimable** — see Estimation; the work is bounded at 2 points against a verified analog.
- **Small** — one navigation behavior: select a row, open that student's course profile.
- **Testable** — every acceptance criterion is binary (the profile opens, the URL is composed from user id and course id, keyboard Enter matches the pointer click, authorization defers to Moodle, the stale-row response is Moodle's standard not-available response).

## Key Citations

- Source: public/blocks/accessreview/block_accessreview.php — the Moodle `moodle_url` link-building pattern (a base route plus a parameter array, for example `new moodle_url(accessibility::get_plugin_url(), ['action' => 'requestanalysis', 'courseid' => $COURSE->id])`); the Class Pulse block builds each student row's course-profile link the same way, composing the user course-profile route from the student user id (`id`) and the current course id (`course`).
- Source: .gherkin-lintrc — the Given/When/Then convention (and the `new-line-at-eof` rule) that the acceptance criteria follow.
- Source: public/blocks/accessreview/tests/behat/accessreview.feature — the canonical BDD narrative (`Feature: / In order to / As a / I can` + Given/When/Then) the acceptance criteria mirror.

[⬅ Back to FEATURE-001-03](../FEATURE-001-03-risk-visualization-and-configuration.md)
