# FEATURE-001-03: Risk Visualization, Threshold Configuration & Interaction

## Feature Summary

Risk Visualization, Threshold Configuration & Interaction is the presentation and interaction layer of Class Pulse: it renders one row per enrolled student with the four engagement signal columns through a Mustache template, lets the Course Teacher configure per-instance red and yellow thresholds, color-codes each row against those thresholds as the risk highlight, provides client-side column sorting and row filtering through an AMD module, and makes selecting a student row open that student's existing course profile page. This feature consumes the enrolled-student roster and the four engagement signals delivered by FEATURE-001-02 and builds on the block scaffold, capability model, and opt-in per-course placement delivered by FEATURE-001-01. The Mustache render reuses the Moodle output/templates API: the analog `block_accessreview` plugin ships a real Mustache template (`block_accessreview/status`) that is rendered client-side through the core templates API (`Templates.renderForPromise`) from a context object built in its AMD module, while its PHP `get_content()` assembles an `html_table` and wires the AMD module from PHP through `js_call_amd`. The Class Pulse client-side sort and filter mirror that plugin's AMD `init` module wired from PHP through `js_call_amd`. The block renders within 2 seconds for a course with up to 50 enrolled students, and every engagement signal it presents stays gated by the viewing role's existing Moodle capabilities so the Course Teacher sees only data the role is authorized to see.

### Scope Boundaries

This feature is the presentation and interaction layer only. It renders the engagement table, exposes the per-instance threshold configuration form, applies threshold-driven color-coding, provides client-side sort and filter, and links each student row to the course profile — it does **not** compute any engagement signal (that is FEATURE-001-02) and does **not** define the block scaffold, capabilities, or placement (that is FEATURE-001-01).

The v1 scope boundaries that govern this feature are reaffirmed here:

- **No notifications or emails** — the risk highlight is presented on the course-level screen only; this feature sends no notification and no email to the Course Teacher when a student crosses a threshold.
- **No parent/guardian visibility** — the rendered engagement table and every risk highlight are visible only to roles authorized in the course; parent or guardian visibility is excluded from v1.
- **Fixed signal set** — the four engagement signal columns are fixed in v1. The threshold configuration form tunes the red and yellow thresholds for those signals; it does not let the Course Teacher choose which signals appear, add a signal, remove a signal, or reorder the columns.

## User Stories Index

This feature decomposes into five User Stories, each authored under the sibling `./FEATURE-001-03/` directory. Every index link below MUST resolve to an authored Story file; a broken or missing link is a completeness defect.

| Story | Description |
|-------|-------------|
| [STORY-001-03-01 — Render engagement table template](./FEATURE-001-03/STORY-001-03-01-render-engagement-table-template.md) | Render one row per enrolled student with the four engagement signal columns through a Mustache template, carrying the render-within-2-seconds budget for a course with up to 50 enrolled students. |
| [STORY-001-03-02 — Configure risk thresholds form](./FEATURE-001-03/STORY-001-03-02-configure-risk-thresholds-form.md) | Expose a per-instance block configuration form with `config_*` fields and numeric input validation so the Course Teacher sets the red and yellow thresholds for each engagement signal. |
| [STORY-001-03-03 — Apply threshold color-coding](./FEATURE-001-03/STORY-001-03-03-apply-threshold-color-coding.md) | Color-code each row or cell red, yellow, or none against the configured thresholds as the risk highlight, including the "exceeds" boundary and the default-threshold case. |
| [STORY-001-03-04 — Client-side sort and filter](./FEATURE-001-03/STORY-001-03-04-client-side-sort-and-filter.md) | Provide an AMD module that sorts the engagement table by column and filters rows on the client, mirroring the analog block's `init` module wired through `js_call_amd`. |
| [STORY-001-03-05 — Link to student course profile](./FEATURE-001-03/STORY-001-03-05-link-to-student-course-profile.md) | Make selecting a student row open that student's existing course profile page, addressed by user id and course id. |

> **Threshold examples** — authored in full within [STORY-001-03-02](./FEATURE-001-03/STORY-001-03-02-configure-risk-thresholds-form.md) and referenced by [STORY-001-03-03](./FEATURE-001-03/STORY-001-03-03-apply-threshold-color-coding.md), reproduced verbatim from the Class Pulse objective statement: "highlight in red when last login exceeds 3 days" and "highlight in yellow when overdue assignments exceed 2". The "exceeds" semantics mean a value strictly greater than the configured number triggers the risk highlight.

## Dependencies

- **Feature prerequisite — FEATURE-001-01 (Block Scaffold & Placement).** The block class, capability model, and opt-in per-course placement must exist before any risk highlight is rendered, so this feature depends on [FEATURE-001-01](./FEATURE-001-01-block-scaffold-and-placement.md).
- **Feature consumption — FEATURE-001-02 (Engagement Signal Computation & Roster).** The render, color-coding, sort, and filter all operate on the enrolled-student roster and the four engagement signals, so this feature consumes [FEATURE-001-02](./FEATURE-001-02-engagement-signal-computation.md).
- **Render consumes the roster and four signals — STORY-001-03-01 depends on STORY-001-02-01 through STORY-001-02-05.** The engagement table render reads the roster (STORY-001-02-01) and the four engagement signals — last login (STORY-001-02-02), overdue assignments (STORY-001-02-03), quiz score trend (STORY-001-02-04), and last interaction (STORY-001-02-05) — before it can render one row per student.
- **Color-coding depends on thresholds and a rendered table — STORY-001-03-03 depends on STORY-001-03-02 and STORY-001-03-01.** The risk highlight color-codes each row against the thresholds configured in STORY-001-03-02 applied to the table rendered in STORY-001-03-01.
- **Sort, filter, and profile link operate on the rendered table — STORY-001-03-04 and STORY-001-03-05 depend on STORY-001-03-01.** Client-side sort and filter (STORY-001-03-04) and the course-profile click-through (STORY-001-03-05) act on the table rendered in STORY-001-03-01.
- **External platform dependencies (documentation context only — no code in these subsystems is changed).** This feature uses the Moodle output / Mustache renderer (the engagement table), AMD / RequireJS (client-side column sort and row filter), the block `edit_form.php` / `config_*` per-instance configuration contract (the threshold form), and the user course profile page addressed by user id and course id (the row click-through).

## Definition of Done

- [ ] All 5 User Stories in this feature are authored and linked from the User Stories Index, and every index link resolves to an authored file.
- [ ] The Mustache engagement table render documents one row per enrolled student with the four engagement signal columns and carries the render-within-2-seconds criterion for a course with up to 50 enrolled students (STORY-001-03-01).
- [ ] The per-instance threshold configuration form documents `config_*` fields with numeric input validation and reproduces the two verbatim threshold examples — "highlight in red when last login exceeds 3 days" and "highlight in yellow when overdue assignments exceed 2" (STORY-001-03-02).
- [ ] The threshold color-coding documents the red, yellow, and none risk highlight against the configured thresholds, including the "exceeds" boundary where a value strictly greater than the configured number triggers the highlight and the default-threshold case where no threshold has been configured (STORY-001-03-03).
- [ ] The AMD module documents client-side column sorting and row filtering on the rendered engagement table (STORY-001-03-04).
- [ ] The course-profile click-through documents that selecting a student row opens that student's existing course profile page (STORY-001-03-05).
- [ ] Every User Story satisfies the six INVEST principles (Independent, Negotiable, Valuable, Estimable, Small, Testable) and is demonstrable for Product Owner acceptance.
- [ ] Every User Story carries 4–8 acceptance criteria in Given/When/Then form, with required coverage of one input-validation scenario, one valid-output scenario, one error-handling scenario, and one edge/boundary scenario.
- [ ] Every User Story enumerates 3–5 edge cases spanning Empty/Null Input, Boundary Values, Invalid Input, and Concurrent/Conflicting Operations where applicable.
- [ ] Zero forbidden terms (approximately, several, various, adequate, appropriate, properly, correctly, efficiently, quickly, easily, user-friendly, reasonable, sufficient) appear in any acceptance criterion.
- [ ] Every User Story names a concrete actor (for example Course Teacher, Site Administrator, Moodle Plugin Developer, Data Protection Officer) rather than a generic "user."
- [ ] Every User Story includes an Effort / Complexity / Uncertainty assessment with a Fibonacci point estimate (1, 2, 3, 5, 8, 13) and a story-level Definition of Done.

## Key Citations

- Source: public/blocks/accessreview/templates — the Mustache template (`status.mustache`, documented as `@template block_accessreview/status` with an example-context JSON block) that the analog renders client-side through the AMD module's core `Templates.renderForPromise('block_accessreview/status', context)` call, the template pattern the Class Pulse engagement table render mirrors.
- Source: public/blocks/accessreview/amd/src — the AMD `init` module pattern (`module.js`, documented as `@module block_accessreview/module` exporting `init`) with its production bundle under `amd/build`, mirrored by the Class Pulse client-side sort and filter.
- Source: public/blocks/accessreview/block_accessreview.php — `has_config()` controlling block configurability, the `js_call_amd('block_accessreview/module', 'init', ...)` wiring that loads the AMD module, and the `html_table` assembled and rendered through `html_writer::table()` in `get_content()`.

[⬅ Back to EPIC-001](../EPIC-001-classpulse-engagement-risk-block.md)
