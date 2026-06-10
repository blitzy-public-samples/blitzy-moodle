# STORY-001-03-04: Client-side sort and filter

## User Story

**As a** Course Teacher,
**I want** to sort the engagement table by any signal column and filter its rows from the browser,
**So that** I can focus on the students most relevant to me without reloading the page.

This story documents the client-side sort and filter behavior layered onto the Class Pulse engagement table rendered in STORY-001-03-01. The behavior is delivered through an AMD module (RequireJS) that mirrors the analog `block_accessreview` module: that module is documented as `@module block_accessreview/module`, exports an `init` entry point, registers its DOM behavior through a delegated `document` click listener (`document.addEventListener('click', e => { if (e.target.closest('#toggle-accessmap')) {...} })`), and imports the core JavaScript services `core/ajax`, `core/templates`, and `core/notification` (Source: public/blocks/accessreview/amd/src/module.js). The analog block wires the module from PHP through `$this->page->requires->js_call_amd('block_accessreview/module', 'init', $arguments)` (Source: public/blocks/accessreview/block_accessreview.php) and ships a production bundle under `amd/build` (`module.min.js` and `module.min.js.map`). The Class Pulse module follows the same shape — an `amd/src` source exporting `init`, a built bundle under `amd/build`, and the `js_call_amd('block_classpulse/...', 'init', $args)` wiring from the block.

The module operates on the table already rendered by STORY-001-03-01: it reorders the existing rows when the Course Teacher sorts a column, and hides or shows the existing rows when the teacher filters by student name, with no server round-trip and no page reload. Because the sort and filter act on the server-rendered rows, the table degrades to its server-rendered order with every row visible when the module does not load, and no JavaScript error is surfaced to the Course Teacher. The sort and filter are presentation-only: they change which rows are shown and in what order, and they do not recompute any engagement signal and do not change any risk highlight derived in STORY-001-03-03.

The module sorts by any of the table's columns and filters on the student name. The columns are the student name plus the four engagement-signal columns delivered by FEATURE-001-02 and rendered by STORY-001-03-01:

| Column | Sortable | Filterable | Engagement signal |
|--------|----------|------------|-------------------|
| Student name | Yes | Yes | The enrolled student (roster, STORY-001-02-01) |
| Last login | Yes | No | Days since the student's last site login (STORY-001-02-02) |
| Overdue assignments | Yes | No | Count of currently overdue assignments in this course (STORY-001-02-03) |
| Quiz trend | Yes | No | Up, flat, or down trend from the last three quiz attempt scores (STORY-001-02-04) |
| Last interaction | Yes | No | Timestamp of the last interaction with any activity in this course (STORY-001-02-05) |

## Acceptance Criteria

Each scenario is authored in Given/When/Then form, mirrors the repository Gherkin convention (Source: `.gherkin-lintrc`; canonical narrative in `public/blocks/accessreview/tests/behat/accessreview.feature`), and resolves to a binary pass or fail outcome. The scenarios provide the required coverage — valid output, input validation, error handling, and edge/boundary — for the client-side sort and filter behavior.

**Scenario 1 — Sort the overdue-assignments column descending (valid output)**

- **Given** a rendered engagement table with multiple students,
- **When** the Course Teacher selects the overdue-assignments column header to sort descending,
- **Then** the rows reorder so the student with the highest overdue-assignment count is the first row and the remaining rows follow in descending count order.

**Scenario 2 — Filter rows by a student name fragment (valid output)**

- **Given** a rendered engagement table,
- **When** the Course Teacher types a student name fragment into the filter control,
- **Then** only the rows whose student name contains that fragment remain visible and the non-matching rows are hidden.

**Scenario 3 — Clearing the filter restores every row (input validation)**

- **Given** an active filter that hides one or more rows,
- **When** the Course Teacher clears the filter control,
- **Then** every roster row becomes visible again.

**Scenario 4 — A module that fails to load degrades to the server-rendered table (error handling)**

- **Given** the AMD module fails to load,
- **When** the course page renders,
- **Then** the table displays all rows in their server-rendered order and no JavaScript error is surfaced to the Course Teacher.

**Scenario 5 — A filter term that matches no student shows the no-matches state (edge/boundary)**

- **Given** a filter term that matches no student name,
- **When** the filter is applied,
- **Then** zero rows are shown and the defined no-matches state is displayed.

**Scenario 6 — Sorting a single-row table leaves the row in place (edge/boundary)**

- **Given** a table with exactly one student row,
- **When** the Course Teacher sorts any column,
- **Then** the single row remains displayed and its cell content is unchanged.

## Sub-Tasks

- [ ] Author an AMD module under amd/src exporting init that attaches to the rendered table @assignee
- [ ] Implement client-side column sorting in ascending and descending order per signal column @assignee
- [ ] Implement client-side row filtering on the student name with a defined no-matches state @assignee
- [ ] Wire the module from the block through js_call_amd('block_classpulse/...', 'init', args) @assignee
- [ ] Provide the production build under amd/build (minified bundle and source map) @assignee

## Edge Cases

- **Empty/Null Input** — an empty table with no student rows: the sort and filter controls perform no operation and surface no error to the Course Teacher.
- **Boundary Values** — a single-row table: sorting any column leaves the one row in place with unchanged cell content.
- **Empty result** — a filter term that matches no student name: zero rows are shown and the defined no-matches state is displayed.
- **Concurrent/Conflicting Operations** — a sort or filter is triggered while the table data is being refreshed: the operation applies to one consistent row set captured at the start of the operation, and the refreshed data takes effect on the next render.

## Dependencies

- **Prerequisite story — STORY-001-03-01 (rendered table).** The client-side sort and filter operate on the engagement table rendered in [STORY-001-03-01](./STORY-001-03-01-render-engagement-table-template.md), so this story depends on it.
- **Feature dependency — FEATURE-001-03 depends on FEATURE-001-01 and consumes FEATURE-001-02.** This story belongs to [FEATURE-001-03](../FEATURE-001-03-risk-visualization-and-configuration.md), which depends on the block scaffold, capability model, and opt-in per-course placement delivered by [FEATURE-001-01](../FEATURE-001-01-block-scaffold-and-placement.md) and consumes the roster and four engagement signals delivered by [FEATURE-001-02](../FEATURE-001-02-engagement-signal-computation.md).
- **External platform dependency (documentation context only — no code is changed).** The sort and filter are delivered through an AMD module (RequireJS) wired from PHP through `js_call_amd`, mirroring the analog `block_accessreview/module` `init` entry point and its production bundle under `amd/build`.

## Estimation

| Dimension | Assessment | Rationale |
|-----------|------------|-----------|
| Effort | Medium | Author an AMD module that attaches to the rendered table, implement per-column sorting and student-name filtering on the client, wire it from PHP through `js_call_amd`, and ship the production build under `amd/build`. |
| Complexity | Medium | Client-side DOM sorting across the signal columns and row filtering on the student name, with a defined no-matches state and a degraded fallback to the server-rendered table when the module does not load. |
| Uncertainty | Low | The AMD `init` module pattern, the delegated `document` click listener, and the `js_call_amd` wiring are verified against the `block_accessreview` analog in this repository. |

**Effort Medium, Complexity Medium, Uncertainty Low → 3 points.**

Story point estimate: 3 (Fibonacci). This story is an AMD module that adds client-side sorting and filtering plus a built bundle, sized one Fibonacci step below the render story (5 points) because it operates on the already-rendered table rather than assembling it.

## Definition of Done

- [ ] An AMD module under `amd/src` exporting `init` is documented, wired from the block through `js_call_amd`, with a built bundle under `amd/build` (minified bundle and source map).
- [ ] Client-side column sorting in ascending and descending order works on each signal column.
- [ ] Client-side row filtering on the student name works with a defined no-matches state when the filter term matches no student.
- [ ] Clearing the filter restores every roster row to visible.
- [ ] A module that does not load degrades to the server-rendered table with every row in server-rendered order, and no JavaScript error is surfaced to the Course Teacher.
- [ ] The story satisfies the six INVEST principles (Independent, Negotiable, Valuable, Estimable, Small, Testable) and is demonstrable for Product Owner acceptance.
- [ ] The story carries 4–8 acceptance criteria in Given/When/Then form covering one valid-output, one input-validation, one error-handling, and one edge/boundary scenario, each with a binary pass/fail outcome.
- [ ] The story enumerates 3–5 edge cases spanning Empty/Null Input, Boundary Values, Empty result, and Concurrent/Conflicting Operations.
- [ ] Zero forbidden terms appear in any acceptance criterion.
- [ ] Key Citations reference the grounding Moodle source paths.

## INVEST Self-Check

- **Independent** — the module operates on the table rendered in STORY-001-03-01; it does not require the threshold color-coding (STORY-001-03-03) or the profile-link story (STORY-001-03-05) to be demonstrable.
- **Negotiable** — the story describes the sort and filter outcomes (row order, rows visible or hidden, the no-matches state, the degraded fallback), not a fixed JavaScript implementation.
- **Valuable** — the Course Teacher focuses the view on the students most relevant to the moment without reloading the page.
- **Estimable** — see Estimation; the work is bounded at 3 points against a verified analog.
- **Small** — one client-side interaction behavior: sort and filter the rendered table.
- **Testable** — every acceptance criterion is binary (row order, rows visible or hidden, the defined no-matches state, the degraded server-rendered fallback).

## Key Citations

- Source: public/blocks/accessreview/amd/src — the AMD `init` module pattern (`module.js`, documented as `@module block_accessreview/module` exporting `init`, registering DOM behavior through a delegated `document` click listener and importing the core JavaScript services `core/ajax`, `core/templates`, and `core/notification`) with its production bundle under `amd/build` (`module.min.js` and `module.min.js.map`); this is the module pattern the Class Pulse client-side sort and filter mirrors.
- Source: public/blocks/accessreview/block_accessreview.php — the `$this->page->requires->js_call_amd('block_accessreview/module', 'init', $arguments)` wiring that loads the AMD module from PHP, mirrored by the Class Pulse block as `js_call_amd('block_classpulse/...', 'init', $args)`.
- Source: .gherkin-lintrc — the Given/When/Then convention (and the `new-line-at-eof` rule) that the acceptance criteria follow.
- Source: public/blocks/accessreview/tests/behat/accessreview.feature — the canonical BDD narrative (`Feature: / In order to / As a / I can` + Given/When/Then) the acceptance criteria mirror.

[⬅ Back to FEATURE-001-03](../FEATURE-001-03-risk-visualization-and-configuration.md)
