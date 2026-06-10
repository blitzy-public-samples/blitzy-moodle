# STORY-001-03-02: Configure risk thresholds form

## User Story

**As a** Course Teacher,
**I want** to configure the red and yellow risk thresholds for each Class Pulse block instance through its configuration form,
**So that** the risk highlight reflects the engagement limits I set for my course.

This story documents the per-instance threshold configuration form for the Class Pulse block. Each placed block instance carries its own thresholds through Moodle's block instance-configuration contract: the block declares an `edit_form.php` whose field names are prefixed `config_` (for example `config_redlastlogin` and `config_yellowoverdue`), Moodle persists those submitted values on the individual block instance, and the block reads them back at render time as `$this->config->redlastlogin`. Each threshold is a non-negative whole number (zero or greater) of its engagement signal's unit (days for last login, a count for overdue assignments), so the form validates the input and rejects non-numeric entries and negative entries; zero is accepted as a valid threshold (for example, an overdue-assignment threshold of 0 highlights any student with one or more overdue assignments). A blank field falls back to the documented default value for that field rather than storing an empty value. The configured thresholds are the input that the risk highlight color-coding (STORY-001-03-03) reads to decide which rows turn red or yellow. The block-configurability contract is grounded in the verified `block_accessreview` analog, whose `has_config()` returns `true` (Source: public/blocks/accessreview/block_accessreview.php); the analog exposes its settings globally, while the per-instance `edit_form.php` / `config_*` field pattern documented here is the general Moodle block instance-configuration contract.

In v1 the risk thresholds are configured for the two numeric engagement signals the Class Pulse objective statement thresholds — days since last login and the count of overdue assignments in this course — each with a red and a yellow `config_*` field. Every field carries a documented default, so a teacher who saves the form without changing a field keeps a defined threshold rather than an empty value:

| Threshold field (`config_*`) | Engagement signal | Risk highlight color | Documented v1 default |
|------------------------------|-------------------|----------------------|-----------------------|
| `config_redlastlogin` | Days since last login | Red | 3 days |
| `config_yellowlastlogin` | Days since last login | Yellow | Unset — the yellow last-login tier stays inactive and adds no risk highlight until the teacher sets a value |
| `config_redoverdue` | Overdue assignments in this course | Red | Unset — the red overdue tier stays inactive and adds no risk highlight until the teacher sets a value |
| `config_yellowoverdue` | Overdue assignments in this course | Yellow | 2 |

The two numeric defaults come from the two threshold examples in the Class Pulse objective statement, reproduced verbatim:

- "highlight in red when last login exceeds 3 days"
- "highlight in yellow when overdue assignments exceed 2"

The remaining two engagement signals are out of the v1 threshold model: the quiz-score-trend signal is a directional value (up, flat, or down) rather than a numeric count, and the last-interaction signal is a timestamp, so neither is threshold-configurable in v1 — both are displayed in the engagement table but drive no red or yellow risk highlight. This matches the fixed-signal scope of FEATURE-001-03, where the four signal columns are fixed and the threshold form tunes only the red and yellow risk thresholds for the two numeric signals.

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

**Scenario 4 — Blank field falls back to its documented default (valid output)**

- **Given** the teacher leaves a threshold field blank,
- **When** the configuration form is saved,
- **Then** a field with a numeric documented default takes that value (the red last-login field becomes 3 days and the yellow overdue field becomes 2), and a field whose documented default is unset (the yellow last-login field or the red overdue field) stays inactive and adds no risk highlight.

**Scenario 5 — Save failure retains the prior thresholds (error handling)**

- **Given** the instance configuration cannot be saved because the save operation fails,
- **When** the teacher submits the configuration form,
- **Then** the prior threshold values are retained and a save-failure message is shown without a stack trace.

**Scenario 6 — Each block instance keeps its own thresholds (edge/boundary)**

- **Given** two Class Pulse block instances placed in different courses,
- **When** the teacher sets a different red last-login threshold in each instance,
- **Then** each instance retains its own `config_redlastlogin` value independently of the other.

**Scenario 7 — Zero is accepted as a valid non-negative threshold (edge/boundary)**

- **Given** the teacher sets the yellow overdue-assignments threshold to 0,
- **When** the configuration form is submitted,
- **Then** the value 0 is stored on that block instance as `config_yellowoverdue` and the form reloads with the value 0, so any student with one or more overdue assignments crosses the threshold.

## Sub-Tasks

- [ ] Define the block instance `edit_form.php` with `config_*` threshold fields (for example `config_redlastlogin`, `config_yellowoverdue`) @assignee
- [ ] Validate threshold inputs: reject non-numeric and negative values; accept zero as a valid non-negative threshold @assignee
- [ ] Apply the documented default values when a threshold field is left blank @assignee
- [ ] Persist threshold values per block instance and expose them at render time as `$this->config->*` @assignee
- [ ] Add language strings for the threshold form field labels @assignee

## Edge Cases

- **Empty/Null Input** — a blank threshold field: the field falls back to its documented default — a numeric default for the red last-login (3 days) and yellow overdue (2) fields, or an unset, inactive tier for the yellow last-login and red overdue fields — rather than storing an empty value.
- **Boundary Values** — a zero threshold value: zero is accepted as a valid non-negative threshold and stored, so (for example) an overdue threshold of 0 highlights any student with one or more overdue assignments.
- **Invalid Input** — a negative threshold value such as `-1`: the value is rejected as invalid with a validation message and no value is saved.
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
| Complexity | Medium | Follows the Moodle block per-instance configuration contract with per-instance persistence, input validation that rejects non-numeric and negative values while accepting zero, and a documented default for every threshold field. |
| Uncertainty | Low | The block-configurability contract is grounded in the verified `block_accessreview` analog (`has_config()`) and the standard `config_*` field convention. |

**Effort Medium, Complexity Medium, Uncertainty Low → 3 points.**

Story point estimate: 3 (Fibonacci).

## Definition of Done

- [ ] A per-instance `edit_form.php` with `config_*` threshold fields (for example `config_redlastlogin`, `config_yellowoverdue`) is documented, with a documented default for every field (red last-login 3 days, yellow overdue 2, and the yellow last-login and red overdue tiers unset and inactive by default).
- [ ] Numeric validation rejects non-numeric and negative input and accepts zero as a valid non-negative threshold.
- [ ] A blank threshold field falls back to its documented default value rather than storing an empty value.
- [ ] Threshold values persist per block instance and are exposed at render time as `$this->config->*`, independently for each placed instance.
- [ ] The two threshold examples are reproduced verbatim: "highlight in red when last login exceeds 3 days" and "highlight in yellow when overdue assignments exceed 2".
- [ ] The story satisfies the six INVEST principles (Independent, Negotiable, Valuable, Estimable, Small, Testable) and is demonstrable for Product Owner acceptance.
- [ ] The story carries 4–8 acceptance criteria in Given/When/Then form covering one valid-output, one input-validation, one error-handling, and one edge/boundary scenario, each with a binary pass/fail outcome.
- [ ] The story enumerates 3–5 edge cases spanning Empty/Null Input, Boundary Values, Invalid Input, and Concurrent/Conflicting Operations.
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
