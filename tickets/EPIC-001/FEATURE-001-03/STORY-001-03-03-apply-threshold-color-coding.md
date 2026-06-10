# STORY-001-03-03: Apply threshold color-coding

## User Story

**As a** Course Teacher,
**I want** each student's row or cells color-coded red or yellow when an engagement signal exceeds its configured threshold,
**So that** I can spot at-risk students through the risk highlight at a glance.

This story documents the risk highlight color-coding applied to the Class Pulse engagement table rendered in STORY-001-03-01. For each student row, the block compares every engagement signal value against the red and yellow thresholds configured for that signal in STORY-001-03-02 and derives one risk-highlight state per cell — red, yellow, or none — which is injected into the render context as a CSS class. This mirrors the verified `block_accessreview` analog, whose `status.mustache` renders `<div class="block_accessreview block_accessreview_view {{classList}}">` where the dynamic `{{classList}}` conveys the visual state (Source: public/blocks/accessreview/templates). The Class Pulse risk highlight honors the **"exceeds" semantics** exactly: a signal value **strictly greater than** its threshold triggers the risk highlight, and a value **equal to** the threshold does not. When a value exceeds both its yellow and red thresholds, the red risk highlight takes precedence over the yellow one. A missing (null) signal value carries no risk highlight.

When a block instance has no thresholds configured, the documented default thresholds drive the risk highlight — a red last-login default of 3 days and a yellow overdue-assignment default of 2 — aligned with the two threshold examples from the Class Pulse objective statement, reproduced verbatim:

- "highlight in red when last login exceeds 3 days"
- "highlight in yellow when overdue assignments exceed 2"

The risk-highlight state for each cell is derived by comparing the engagement signal value against its configured thresholds:

| Comparison of the engagement signal value against its configured thresholds | Risk highlight |
|------------------------------------------------------------------------------|----------------|
| Value strictly greater than the red threshold | Red |
| Value strictly greater than the yellow threshold and not strictly greater than the red threshold | Yellow |
| Value equal to a threshold (not strictly greater) | None |
| Value at or below the yellow threshold | None |
| Value missing (null) | None |

## Acceptance Criteria

Each scenario is authored in Given/When/Then form, mirrors the repository Gherkin convention (Source: `.gherkin-lintrc`; canonical narrative in `public/blocks/accessreview/tests/behat/accessreview.feature`), and resolves to a binary pass or fail outcome. The scenarios provide the required coverage — valid output, input validation, error handling, and edge/boundary — and make the strictly-greater "exceeds" semantics explicit.

**Scenario 1 — Last-login value above the red threshold carries the red highlight (valid output)**

- **Given** a red last-login threshold of 3 days and a student whose last login was 4 days ago,
- **When** the engagement table renders,
- **Then** that student's last-login cell carries the red risk highlight.

**Scenario 2 — Value equal to the threshold carries no highlight (edge/boundary)**

- **Given** a red last-login threshold of 3 days and a student whose last login was exactly 3 days ago,
- **When** the engagement table renders,
- **Then** that student's last-login cell carries no risk highlight, because the value must strictly exceed the threshold.

**Scenario 3 — Overdue-assignments value above the yellow threshold carries the yellow highlight (valid output)**

- **Given** a yellow overdue-assignments threshold of 2 and a student with 3 overdue assignments,
- **When** the engagement table renders,
- **Then** that student's overdue-assignments cell carries the yellow risk highlight.

**Scenario 4 — A value exceeding both thresholds carries the red highlight (valid output)**

- **Given** a yellow last-login threshold of 2 days and a red last-login threshold of 3 days, and a student whose last login was 5 days ago,
- **When** the engagement table renders,
- **Then** that student's last-login cell carries the red risk highlight, because the red highlight takes precedence when a value exceeds both thresholds.

**Scenario 5 — Default thresholds drive the highlight when none are configured (input validation)**

- **Given** a Class Pulse block instance with no thresholds configured,
- **When** the engagement table renders,
- **Then** the documented default thresholds are applied to determine each risk highlight.

**Scenario 6 — A missing signal value carries no highlight and surfaces no error (error handling)**

- **Given** a student whose engagement signal value is missing,
- **When** the engagement table renders,
- **Then** that cell carries no risk highlight and no error is surfaced to the Course Teacher.

**Scenario 7 — A value below its threshold carries no highlight (edge/boundary)**

- **Given** a signal value below its configured threshold,
- **When** the engagement table renders,
- **Then** that cell carries no risk highlight.

## Sub-Tasks

- [ ] Compare each engagement signal value against its configured threshold using strictly-greater-than (exceeds) semantics @assignee
- [ ] Assign the red, yellow, or none risk-highlight class per cell or row, with red taking precedence over yellow @assignee
- [ ] Apply the documented default thresholds when no instance configuration is set @assignee
- [ ] Leave a missing (null) signal value without a risk highlight @assignee
- [ ] Inject the risk-highlight class into the rendered table context @assignee

## Edge Cases

- **Boundary Values** — a signal value exactly equal to the threshold: the cell carries no risk highlight, because "exceeds" means strictly greater.
- **Empty/Null Input (defaults)** — no thresholds configured on the block instance: the documented default thresholds drive the risk highlight.
- **Empty/Null Input (signal)** — a null or missing signal value: the cell carries no risk highlight.
- **Concurrent/Conflicting Operations** — a threshold value is changed while the table is rendering: the in-flight render uses one consistent threshold set captured at the start of the render, and the changed threshold takes effect on the next render.

## Dependencies

- **Prerequisite story — STORY-001-03-02 (configured thresholds).** The risk highlight reads the per-instance red and yellow thresholds, so this story depends on [STORY-001-03-02](./STORY-001-03-02-configure-risk-thresholds-form.md).
- **Prerequisite story — STORY-001-03-01 (rendered table).** The risk highlight is applied to the engagement table, so this story depends on [STORY-001-03-01](./STORY-001-03-01-render-engagement-table-template.md).
- **Feature dependency — FEATURE-001-03 depends on FEATURE-001-01 and consumes FEATURE-001-02.** This story belongs to [FEATURE-001-03](../FEATURE-001-03-risk-visualization-and-configuration.md), which depends on the block scaffold, capability model, and opt-in per-course placement delivered by [FEATURE-001-01](../FEATURE-001-01-block-scaffold-and-placement.md) and consumes the roster and four engagement signals delivered by [FEATURE-001-02](../FEATURE-001-02-engagement-signal-computation.md).
- **External platform dependency (documentation context only — no code is changed).** The risk highlight is conveyed through a dynamic CSS class injected into the rendered table context, mirroring the analog template's `{{classList}}` pattern.

## Estimation

| Dimension | Assessment | Rationale |
|-----------|------------|-----------|
| Effort | Medium | A per-cell threshold comparison with strictly-greater semantics, red-over-yellow precedence, default-threshold fallback, and null handling, injected into the existing render context. |
| Complexity | Medium | Derives the red, yellow, or none risk-highlight state from the configured thresholds against each engagement signal value, resolves precedence, and falls back to the documented defaults. |
| Uncertainty | Low | The dynamic-class color-coding pattern is grounded in the verified `block_accessreview` analog (`{{classList}}`), and the threshold inputs are defined in STORY-001-03-02. |

**Effort Medium, Complexity Medium, Uncertainty Low → 3 points.**

Story point estimate: 3 (Fibonacci).

## Definition of Done

- [ ] The red, yellow, or none risk highlight is derived by comparing each engagement signal value against its configured threshold.
- [ ] The strictly-greater ("exceeds") semantics is documented: a value strictly greater than the threshold triggers the risk highlight, and a value equal to the threshold does not.
- [ ] The red risk highlight takes precedence over the yellow one when a value exceeds both thresholds.
- [ ] The documented default thresholds apply when no thresholds are configured on the block instance.
- [ ] A missing (null) signal value carries no risk highlight and surfaces no error to the Course Teacher.
- [ ] The story satisfies the six INVEST principles (Independent, Negotiable, Valuable, Estimable, Small, Testable) and is demonstrable for Product Owner acceptance.
- [ ] The story carries 4–8 acceptance criteria in Given/When/Then form covering one valid-output, one input-validation, one error-handling, and one edge/boundary scenario, each with a binary pass/fail outcome.
- [ ] The story enumerates 3–5 edge cases spanning Boundary Values, Empty/Null Input, and Concurrent/Conflicting Operations.
- [ ] Zero forbidden terms appear in any acceptance criterion.
- [ ] Key Citations reference the grounding Moodle source paths.

## INVEST Self-Check

- **Independent** — the color-coding operates on the rendered table given the configured thresholds; it does not require the sort/filter or profile-link stories to be demonstrable.
- **Negotiable** — the story describes the risk-highlight outcome (red, yellow, or none against the thresholds), not a fixed CSS class name or color palette.
- **Valuable** — the Course Teacher spots at-risk students through the risk highlight at a glance.
- **Estimable** — see Estimation; the work is bounded at 3 points against a verified analog.
- **Small** — one color-coding behavior: derive and apply the per-cell risk highlight.
- **Testable** — every acceptance criterion is binary (the risk highlight is present or absent at, above, and below the threshold).

## Key Citations

- Source: public/blocks/accessreview/templates — the color-coding pattern (`status.mustache` renders `<div class="block_accessreview block_accessreview_view {{classList}}">`, where the dynamic `{{classList}}` conveys the visual state) that the Class Pulse risk highlight mirrors, here derived from comparing each engagement signal against its configured threshold.
- Source: .gherkin-lintrc — the Given/When/Then convention (and the `new-line-at-eof` rule) that the acceptance criteria follow.
- Source: public/blocks/accessreview/tests/behat/accessreview.feature — the canonical BDD narrative (`Feature: / In order to / As a / I can` + Given/When/Then) the acceptance criteria mirror.

[⬅ Back to FEATURE-001-03](../FEATURE-001-03-risk-visualization-and-configuration.md)
