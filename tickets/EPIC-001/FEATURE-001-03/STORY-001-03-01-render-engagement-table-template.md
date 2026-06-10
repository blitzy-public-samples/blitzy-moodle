# STORY-001-03-01: Render engagement table template

## User Story

**As a** Course Teacher,
**I want** the Class Pulse block to render one row per enrolled student with the four engagement-signal columns through a Mustache template,
**So that** I can see every student's engagement signals together in one table on the course page.

This is the foundational story of FEATURE-001-03 (Risk Visualization, Threshold Configuration & Interaction): it documents the presentation surface on which the threshold color-coding (STORY-001-03-03), client-side sort and filter (STORY-001-03-04), and student course-profile click-through (STORY-001-03-05) are built. The Class Pulse block assembles a server-side context object — the enrolled-student roster (STORY-001-02-01) joined with the four engagement signals (STORY-001-02-02 through STORY-001-02-05) — and renders that context through one Class Pulse Mustache template on the server using Moodle output (`render_from_template`). This server-side render follows a core Moodle block that renders its Mustache template from PHP: `block_recentlyaccesseditems` builds a renderable in `get_content()`, obtains the plugin renderer, and calls `render_from_template('block_recentlyaccesseditems/main', $main->export_for_template($this))` (Source: public/blocks/recentlyaccesseditems/classes/output/renderer.php). The Class Pulse template follows the real `block_accessreview/status` Mustache template — a documented `@template` with an example-context JSON block (Source: public/blocks/accessreview/templates) — with the note that the analog renders that template client-side from its AMD module through `Templates.renderForPromise('block_accessreview/status', context)` (Source: public/blocks/accessreview/amd/src/module.js), whereas Class Pulse composes the context in PHP and renders it server-side. The analog's `get_content()` assembles its table as an `html_table` output through `html_writer::table()` and guards the no-data case before rendering (Source: public/blocks/accessreview/block_accessreview.php); the Class Pulse render keeps that same no-data guard but emits the table through its Mustache template rather than through `html_writer`. The render is read-only — it reads the roster and the four precomputed signals and introduces no new database table in v1 — and the table is shown only to a viewer gated by the role's existing Moodle capabilities, mirroring the analog's render-time check `has_capability('block/accessreview:view', $context)` applied here as `block/classpulse:view`. This story carries the cross-cutting performance non-functional requirement: the complete table is displayed within 2 seconds for a course with up to 50 enrolled students.

The table renders four engagement-signal columns, one per signal computed in FEATURE-001-02:

| Column | Engagement signal | Source story |
|--------|-------------------|--------------|
| Last login | Days since the student's last site login | STORY-001-02-02 |
| Overdue assignments | Count of currently overdue assignments in this course | STORY-001-02-03 |
| Quiz trend | Up, flat, or down trend from the last three quiz attempt scores | STORY-001-02-04 |
| Last interaction | Timestamp of the last interaction with any activity in this course | STORY-001-02-05 |

## Acceptance Criteria

Each scenario is authored in Given/When/Then form, mirrors the repository Gherkin convention (Source: `.gherkin-lintrc`; canonical narrative in `public/blocks/accessreview/tests/behat/accessreview.feature`), and resolves to a binary pass or fail outcome. The scenarios provide the required coverage — valid output, input validation, error handling, and edge/boundary — and include the cross-cutting performance criterion carried by this render story.

**Scenario 1 — One row per enrolled student with the four signal columns (valid output)**

- **Given** a course with 30 enrolled students, each with computed engagement signals,
- **When** the Class Pulse block renders,
- **Then** the table shows 30 rows, one per enrolled student, each row presenting the four signal columns: days since last login, overdue-assignment count, quiz-score trend, and last-interaction timestamp.

**Scenario 2 — Table is produced through the Mustache template (valid output)**

- **Given** the server has built the render context object from the roster and the four engagement signals,
- **When** the block renders the table,
- **Then** the table is produced through the one Class Pulse Mustache template fed that context object, and not by inline HTML string concatenation in the block.

**Scenario 3 — A missing signal value renders the defined blank cell (input validation)**

- **Given** a student for whom one of the four signal values is missing from the render context,
- **When** that student's row renders,
- **Then** the cell for the missing signal shows the defined blank placeholder state and the other three signal columns still render for that student.

**Scenario 4 — Render completes within the performance budget (performance)**

- **Given** a course with 50 enrolled students, each with computed engagement signals,
- **When** the Class Pulse block renders,
- **Then** the complete engagement table is displayed within 2 seconds.

**Scenario 5 — Render context that cannot be assembled shows the defined empty-state (error handling)**

- **Given** the render context cannot be assembled for the course,
- **When** the block renders,
- **Then** the table shows the defined empty-state message and no PHP error or stack trace is surfaced to the Course Teacher.

**Scenario 6 — Course with zero enrolled students shows the defined empty-state (edge/boundary)**

- **Given** a course with zero enrolled students,
- **When** the block renders,
- **Then** the table shows the column header row and the defined empty-state message with zero student rows.

## Sub-Tasks

- [ ] Assemble the render context object: one entry per enrolled student with the four signal values drawn from the roster and the four engagement signals @assignee
- [ ] Author one Class Pulse Mustache template that renders a table with the four signal columns @assignee
- [ ] Render the context through Moodle output (`render_from_template`) from the block @assignee
- [ ] Define the empty-state output for a course with zero enrolled students @assignee
- [ ] Handle a missing signal value with the defined blank/placeholder cell @assignee
- [ ] Gate the render on `block/classpulse:view` so only an authorized viewer sees the table @assignee

## Edge Cases

- **Empty/Null Input** — a course with an empty roster (zero enrolled students): the table renders the column header row plus the defined empty-state message and zero student rows.
- **Boundary Values** — a course with exactly one enrolled student: the table renders exactly one student row with the four signal columns.
- **Boundary Values** — a course with exactly 50 enrolled students: the documented performance threshold edge, at which the complete table is displayed within 2 seconds.
- **Invalid Input / Missing Value** — a student row with one missing signal value: that one cell renders the defined blank/placeholder state and the row stays intact rather than breaking the table.

## Dependencies

- **Prerequisite story — STORY-001-01-01 (scaffold).** The `block_classpulse` scaffold must exist before any table is rendered, so this story depends on [STORY-001-01-01](../FEATURE-001-01/STORY-001-01-01-scaffold-block-plugin-skeleton.md).
- **Consumes the roster — STORY-001-02-01.** The render places one row per enrolled student, so it consumes the enrolled-student roster delivered by [STORY-001-02-01](../FEATURE-001-02/STORY-001-02-01-build-enrolled-student-roster.md).
- **Consumes the four engagement signals — STORY-001-02-02 through STORY-001-02-05.** Each row presents the four signal columns, so the render consumes [STORY-001-02-02](../FEATURE-001-02/STORY-001-02-02-compute-last-login-signal.md) (last login), [STORY-001-02-03](../FEATURE-001-02/STORY-001-02-03-compute-overdue-assignments-signal.md) (overdue assignments), [STORY-001-02-04](../FEATURE-001-02/STORY-001-02-04-compute-quiz-score-trend-signal.md) (quiz-score trend), and [STORY-001-02-05](../FEATURE-001-02/STORY-001-02-05-compute-last-interaction-signal.md) (last interaction).
- **Feature dependency — FEATURE-001-03 depends on FEATURE-001-01 and consumes FEATURE-001-02.** This story belongs to [FEATURE-001-03](../FEATURE-001-03-risk-visualization-and-configuration.md), which depends on the block scaffold, capability model, and placement delivered by [FEATURE-001-01](../FEATURE-001-01-block-scaffold-and-placement.md) and consumes the roster and four signals delivered by [FEATURE-001-02](../FEATURE-001-02-engagement-signal-computation.md).
- **Downstream dependents — STORY-001-03-03, STORY-001-03-04, and STORY-001-03-05 depend on this story.** The threshold color-coding (STORY-001-03-03), client-side sort and filter (STORY-001-03-04), and student course-profile click-through (STORY-001-03-05) all operate on the table rendered here, so this render must exist before them.
- **External platform dependency (documentation context only — no code is changed).** The render uses the Moodle output / Mustache renderer (`render_from_template`) to produce the engagement table from the server-built context object.

## Estimation

| Dimension | Assessment | Rationale |
|-----------|------------|-----------|
| Effort | Medium | Assemble a context object that joins the roster with the four engagement signals, author one Mustache template with four signal columns, render it through Moodle output, and define the empty-state and missing-value cell. |
| Complexity | Medium | This is the integration hub of the feature: it composes the roster and four separately computed signals into one rendered table, defines the empty and missing-value states, and carries the 2-second / 50-student performance budget. |
| Uncertainty | Low | The server-side Mustache render pattern (`render_from_template` invoked from a plugin renderer) is verified against core Moodle blocks such as `block_recentlyaccesseditems`, and the Mustache template authoring pattern and the no-data guard are verified against the `block_accessreview` analog in this repository. |

**Effort Medium, Complexity Medium, Uncertainty Low → 5 points.**

Story point estimate: 5 (Fibonacci). This story is estimated one Fibonacci step above a single-signal story (3 points) because it integrates the roster and all four signals into one rendered table, defines the empty and missing-value states, carries the performance budget, and is the foundation for three downstream stories.

## Definition of Done

- [ ] The table renders one row per enrolled student, each row presenting the four engagement signal columns (last login, overdue assignments, quiz trend, last interaction).
- [ ] Rendering goes through one Class Pulse Mustache template fed a server-built context object, and not through inline HTML string concatenation.
- [ ] The empty-state for a course with zero enrolled students is defined: the table shows the column header row and the defined empty-state message with zero student rows.
- [ ] A missing signal value renders the defined blank/placeholder cell while the other three columns still render for that student.
- [ ] The render-within-2-seconds criterion for a course with up to 50 enrolled students is documented as an acceptance criterion.
- [ ] The render is gated on `block/classpulse:view`, so only an authorized viewer sees the table.
- [ ] The story satisfies the six INVEST principles (Independent, Negotiable, Valuable, Estimable, Small, Testable) and is demonstrable for Product Owner acceptance.
- [ ] The story carries 4–8 acceptance criteria in Given/When/Then form covering one valid-output, one input-validation, one error-handling, and one edge/boundary scenario, plus the performance criterion, each with a binary pass/fail outcome.
- [ ] The story enumerates 3–5 edge cases spanning Empty/Null Input, Boundary Values, and Invalid Input.
- [ ] Zero forbidden terms appear in any acceptance criterion.
- [ ] Key Citations reference the grounding Moodle source paths.

## INVEST Self-Check

- **Independent** — the render stands alone once the roster and the four signals exist; it does not require the color-coding, sort/filter, or profile-link stories to be demonstrable.
- **Negotiable** — the story describes the rendered outcome (one row per student, four signal columns, through a Mustache template), not a fixed template markup or column order.
- **Valuable** — the Course Teacher sees every student's four engagement signals together in one table on the course page.
- **Estimable** — see Estimation; the work is bounded at 5 points against a verified analog.
- **Small** — one rendering behavior: assemble the context and render the table.
- **Testable** — every acceptance criterion is binary (row count, the four columns present, render time within 2 seconds, the defined empty-state, the defined blank cell).

## Key Citations

- Source: public/blocks/recentlyaccesseditems/classes/output/renderer.php — the server-side Mustache render pattern `render_from_template('block_recentlyaccesseditems/main', $main->export_for_template($this))`, invoked from the block's `get_content()` (Source: public/blocks/recentlyaccesseditems/block_recentlyaccesseditems.php) through the plugin renderer; this is the server-side render pattern the Class Pulse engagement-table render follows.
- Source: public/blocks/accessreview/templates — the real `block_accessreview/status` Mustache template (a documented `@template` with an example-context JSON block) that the Class Pulse engagement-table template mirrors as a template-authoring example; the analog renders this template client-side from its AMD module (Source: public/blocks/accessreview/amd/src/module.js) through `Templates.renderForPromise('block_accessreview/status', context)`, whereas Class Pulse renders its template server-side.
- Source: public/blocks/accessreview/block_accessreview.php — `get_content()` assembles its table as an `html_table` output through `html_writer::table()` and guards the no-data case before rendering; the Class Pulse render follows the same no-data guard but emits its table through a Mustache template rather than through `html_writer`.
- Source: .gherkin-lintrc — the Given/When/Then convention (and the `new-line-at-eof` rule) that the acceptance criteria follow.
- Source: public/blocks/accessreview/tests/behat/accessreview.feature — the canonical BDD narrative (`Feature: / In order to / As a / I can` + Given/When/Then) the acceptance criteria mirror.

[⬅ Back to FEATURE-001-03](../FEATURE-001-03-risk-visualization-and-configuration.md)
