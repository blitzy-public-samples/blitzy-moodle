# STORY-001-03-02: Configure risk thresholds form

## User Story

**As a** Course Teacher,
**I want** to configure the red and yellow risk thresholds for each Class Pulse block instance through its configuration form,
**So that** the risk highlight reflects the engagement limits I set for my course.

This story documents the per-instance threshold configuration form for the Class Pulse block. Each placed block instance carries its own thresholds through Moodle's block instance-configuration contract: the block declares an `edit_form.php` whose field names are prefixed `config_` (for example `config_redlastlogin` and `config_yellowoverdue`), Moodle persists those submitted values on the individual block instance, and the block reads them back at render time as `$this->config->redlastlogin`. Each threshold is a positive whole number of its engagement signal's unit (days for last login, a count for overdue assignments), so the form validates the input and rejects non-numeric entries, negative entries, and zero; a blank field falls back to the documented default value rather than storing an empty value. The configured thresholds are the input that the risk highlight color-coding (STORY-001-03-03) reads to decide which rows turn red or yellow. The block-configurability contract is grounded in the verified `block_accessreview` analog, whose `has_config()` returns `true` (Source: public/blocks/accessreview/block_accessreview.php); the analog exposes its settings globally, while the per-instance `edit_form.php` / `config_*` field pattern documented here is the general Moodle block instance-configuration contract.

The threshold fields map to the engagement signals and the risk highlight color they drive:

| Threshold field (`config_*`) | Engagement signal | Risk highlight color |
|------------------------------|-------------------|----------------------|
| `config_redlastlogin` | Days since last login | Red |
| `config_yellowlastlogin` | Days since last login | Yellow |
| `config_redoverdue` | Overdue assignments in this course | Red |
| `config_yellowoverdue` | Overdue assignments in this course | Yellow |

The same red and yellow `config_*` pairing extends to the quiz-score-trend and last-interaction engagement signals. The two threshold examples from the Class Pulse objective statement are reproduced verbatim:

- "highlight in red when last login exceeds 3 days"
- "highlight in yellow when overdue assignments exceed 2"

The documented default thresholds align with these examples — a red last-login default of 3 days and a yellow overdue-assignment default of 2 — so a teacher who saves the form without changing a field keeps a working threshold rather than an empty value.

## Acceptance Criteria

Each scenario is authored in Given/When/Then form, mirrors the repository Gherkin convention (Source: `.gherkin-lintrc`; canonical narrative in `public/blocks/accessreview/tests/behat/accessreview.feature`), and resolves to a binary pass or fail outcome. The scenarios provide the required coverage: valid output, input validation, error handling, and edge/boundary.

**Scenario 1 — Per-instance threshold is saved and reloaded (valid output)**

- **Given** a Course Teacher editing a Class Pulse block instance,
- **When** the teacher sets the red last-login threshold to 3 and saves the configuration form,
- **Then** the value is stored on that block instance as `config_redlastlogin` and the form reloads with the value 3.

**Scenario 2 — Non-numeric input is rejected (input validation)**

- **Given** the teacher enters a non-numeric value such as `abc` in a threshold field,
- **When** the configuration form is submitted,
- **Then** the form is rejected with a validation message and no threshold value is saved.

**Scenario 3 — Negative input is rejected (input validation)**

- **Given** the teacher enters a negative value such as `-1` in a threshold field,
- **When** the configuration form is submitted,
- **Then** the form is rejected with a validation message and no threshold value is saved.

**Scenario 4 — Blank field falls back to the default (valid output)**

- **Given** the teacher leaves a threshold field blank,
- **When** the configuration form is saved,
- **Then** that threshold falls back to the documented default value rather than storing an empty value.

**Scenario 5 — Save failure retains the prior thresholds (error handling)**

- **Given** the instance configuration cannot be saved because the save operation fails,
- **When** the teacher submits the configuration form,
- **Then** the prior threshold values are retained and a save-failure message is shown without a stack trace.

**Scenario 6 — Each block instance keeps its own thresholds (edge/boundary)**

- **Given** two Class Pulse block instances placed in different courses,
- **When** the teacher sets a different red last-login threshold in each instance,
- **Then** each instance retains its own `config_redlastlogin` value independently of the other.

## Sub-Tasks

- [ ] Define the block instance `edit_form.php` with `config_*` threshold fields (for example `config_redlastlogin`, `config_yellowoverdue`) @assignee
- [ ] Validate threshold inputs: reject non-numeric, negative, and zero values @assignee
- [ ] Apply the documented default values when a threshold field is left blank @assignee
- [ ] Persist threshold values per block instance and expose them at render time as `$this->config->*` @assignee
- [ ] Add language strings for the threshold form field labels @assignee

## Edge Cases

- **Empty/Null Input** — a blank threshold field: the threshold falls back to the documented default value rather than storing an empty value.
- **Invalid Input** — a zero or negative threshold value: a threshold is a positive whole number, so the value is rejected as invalid with a validation message and no value is saved.
- **Invalid Input** — a non-numeric threshold value such as `abc`: the value is rejected as invalid with a validation message and no value is saved.
- **Concurrent/Conflicting Operations** — two Course Teachers edit the same block instance configuration at the same time: the last submitted form that saves successfully wins and its values are the thresholds persisted on the instance.

## Dependencies

- **Prerequisite story — STORY-001-01-01 (scaffold).** The `block_classpulse` scaffold must exist before the instance configuration form can attach to it, so this story depends on [STORY-001-01-01](../FEATURE-001-01/STORY-001-01-01-scaffold-block-plugin-skeleton.md).
- **Feature dependency — FEATURE-001-03 depends on FEATURE-001-01.** This story belongs to [FEATURE-001-03](../FEATURE-001-03-risk-visualization-and-configuration.md), which depends on the block scaffold, capability model, and opt-in per-course placement delivered by [FEATURE-001-01](../FEATURE-001-01-block-scaffold-and-placement.md).
- **Downstream consumer — STORY-001-03-03 (color-coding).** The threshold color-coding consumes the per-instance thresholds defined here, so STORY-001-03-03 depends on this story.
- **External platform dependency (documentation context only — no code is changed).** The form uses the Moodle block per-instance configuration contract: an `edit_form.php` with `config_*` fields whose values Moodle persists on the block instance and exposes at render time as `$this->config->*`.

## Estimation

| Dimension | Assessment | Rationale |
|-----------|------------|-----------|
| Effort | Medium | A single per-instance configuration form: the `config_*` threshold fields, numeric validation, default fallbacks, and the form field labels. |
| Complexity | Medium | Follows the Moodle block per-instance configuration contract with per-instance persistence, input validation that rejects non-numeric, negative, and zero values, and documented default fallbacks. |
| Uncertainty | Low | The block-configurability contract is grounded in the verified `block_accessreview` analog (`has_config()`) and the standard `config_*` field convention. |

**Effort Medium, Complexity Medium, Uncertainty Low → 3 points.**

Story point estimate: 3 (Fibonacci).

## Definition of Done

- [ ] A per-instance `edit_form.php` with `config_*` threshold fields (for example `config_redlastlogin`, `config_yellowoverdue`) is documented.
- [ ] Numeric validation rejects non-numeric, negative, and zero input, because a threshold is a positive whole number.
- [ ] A blank threshold field falls back to the documented default value rather than storing an empty value.
- [ ] Threshold values persist per block instance and are exposed at render time as `$this->config->*`, independently for each placed instance.
- [ ] The two threshold examples are reproduced verbatim: "highlight in red when last login exceeds 3 days" and "highlight in yellow when overdue assignments exceed 2".
- [ ] The story satisfies the six INVEST principles (Independent, Negotiable, Valuable, Estimable, Small, Testable) and is demonstrable for Product Owner acceptance.
- [ ] The story carries 4–8 acceptance criteria in Given/When/Then form covering one valid-output, one input-validation, one error-handling, and one edge/boundary scenario, each with a binary pass/fail outcome.
- [ ] The story enumerates 3–5 edge cases spanning Empty/Null Input, Invalid Input, and Concurrent/Conflicting Operations.
- [ ] Zero forbidden terms appear in any acceptance criterion.
- [ ] Key Citations reference the grounding Moodle source paths.

## INVEST Self-Check

- **Independent** — the configuration form stands alone once the `block_classpulse` scaffold exists; it does not require the render, color-coding, sort/filter, or profile-link stories to be demonstrable.
- **Negotiable** — the story describes the configuration outcome (per-instance red and yellow thresholds with validation and defaults), not a fixed form markup or field layout.
- **Valuable** — the Course Teacher controls the engagement limits that drive the risk highlight for the course.
- **Estimable** — see Estimation; the work is bounded at 3 points against a verified analog.
- **Small** — one configuration behavior: capture, validate, default, and persist the per-instance thresholds.
- **Testable** — every acceptance criterion is binary (value saved and reloaded, input rejected, default applied, per-instance isolation preserved).

## Key Citations

- Source: public/blocks/accessreview/block_accessreview.php — `has_config()` returns `true`, the block-configurability grounding; the per-instance `edit_form.php` / `config_*` field pattern (for example `config_redlastlogin`) documented here is the general Moodle block instance-configuration contract, distinct from the analog's global settings.
- Source: .gherkin-lintrc — the Given/When/Then convention (and the `new-line-at-eof` rule) that the acceptance criteria follow.
- Source: public/blocks/accessreview/tests/behat/accessreview.feature — the canonical BDD narrative (`Feature: / In order to / As a / I can` + Given/When/Then) the acceptance criteria mirror.

[⬅ Back to FEATURE-001-03](../FEATURE-001-03-risk-visualization-and-configuration.md)
