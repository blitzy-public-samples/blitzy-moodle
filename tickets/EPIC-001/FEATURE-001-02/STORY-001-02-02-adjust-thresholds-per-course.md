# STORY-001-02-02: Adjust Thresholds Per Course

- **Story ID:** STORY-001-02-02
- **Parent Feature:** [FEATURE-001-02: Configurable Risk Thresholds](../FEATURE-001-02-configurable-risk-thresholds.md)
- **Epic:** [EPIC-001: Surface Student Engagement Risk on the Course Page](../../EPIC-001-student-engagement-risk-visibility.md)
- **Type:** User Story
- **Requirement:** R4 — the thresholds that define "concerning" are adjustable per course
- **Status:** Draft / Ready for Refinement

## User Story

**As an** Editing Teacher, **I want** to set the recency, overdue, and trend thresholds for this course through the block configuration form, **so that** flagging matches this course's norms instead of one fixed definition.

The quantifiable benefit: three per-course inputs let the teacher tune each of the three signals — activity recency, overdue work, and assessment trend — without a developer and without a site administrator, and without leaving the course page. Only the **Editing Teacher** adjusts thresholds, because editing a block requires the block's configure/edit capability in the course context; the **Non-editing Teacher** reads the resulting roster but does not configure thresholds. Per-course scope means each block instance carries its own three values, so adjusting a threshold on one course never changes another course's flagging. This story owns threshold input validation for the whole feature — the flag story [STORY-001-01-05: Flag and Prioritize At-Risk](../FEATURE-001-01/STORY-001-01-05-flag-and-prioritize-at-risk.md) defers value validation to here — and it stops at "valid values submitted"; saving and applying the accepted values is owned by [STORY-001-02-03: Persist and Apply Thresholds](STORY-001-02-03-persist-and-apply-thresholds.md).

## Threshold Fields

The configuration form exposes one text input per signal. Each field name carries the `config_` prefix used by the block configuration form, becomes `$this->config->NAME` at render, and is typed `PARAM_INT`. The form pre-populates each field from the [STORY-001-02-01: Default Risk Thresholds](STORY-001-02-01-default-risk-thresholds.md) defaults, so the form is demonstrable before any value is saved.

| Field | Type | Default | Valid range | Unit |
|-------|------|---------|-------------|------|
| `config_recencydays` | `PARAM_INT` | 14 | 1–365 | days |
| `config_overduecount` | `PARAM_INT` | 1 | 1–50 | items |
| `config_trendsensitivity` | `PARAM_INT` | 2 | 0–100 | percentage points |

The form follows the standard block configuration pattern — a subclass of `block_edit_form` implementing `specific_definition($mform)` that adds each `config_` text element, sets its `PARAM_INT` type, and sets its default from the STORY-001-02-01 baseline [public/blocks/activity_results/edit_form.php:L42-L83]. Per-course scope follows from the block instance configuration store: `$this->config` is loaded per instance from `block_instances.configdata` [public/blocks/moodleblock.class.php:L462], so each course's block instance holds its own three values. **No new database table is introduced** — the adjusted values live in the block instance configuration only, and the save step itself is owned by [STORY-001-02-03: Persist and Apply Thresholds](STORY-001-02-03-persist-and-apply-thresholds.md).

## Validation Contract

This story owns the validation rules for all three threshold fields. The form's `validation($data, $files)` method returns an array of errors keyed by field name, each message sourced from `get_string`, following the one core block that overrides validation [public/blocks/rss_client/edit_form.php:L159-L204]. The rules are stated concretely below:

- **Blank means use the default.** A field left empty is treated as unset, not as 0; it raises no error and stores no value, and the render falls back to the field's STORY-001-02-01 default.
- **Non-numeric is rejected.** An entry that is not a whole number (for example `abc`) sets a localized error on that field via `get_string` (for example "Enter a whole number.") and stores no value.
- **Out-of-range is rejected.** A value below the field minimum or above the field maximum sets a localized error naming the bounds via `get_string` (for example "Enter a whole number between 1 and 365.") and stores no value. The bounds are 1–365 for `config_recencydays`, 1–50 for `config_overduecount`, and 0–100 for `config_trendsensitivity`.
- **Negative is rejected.** A value below 0 is below every field's minimum and is rejected with a localized message.
- **On any rejection** the form re-displays, the offending field shows its localized error, and no value is saved for that submission; a previously saved value for that field is left unchanged.

## INVEST Justification

- **Independent:** The form pre-populates from the [STORY-001-02-01](STORY-001-02-01-default-risk-thresholds.md) defaults (14 / 1 / 2), so it renders and is demonstrable to a Product Owner on its own — before persistence ([STORY-001-02-03](STORY-001-02-03-persist-and-apply-thresholds.md)) or flagging ([STORY-001-01-05](../FEATURE-001-01/STORY-001-01-05-flag-and-prioritize-at-risk.md)) is built.
- **Negotiable:** The field labels, help text, and exact wording of each localized message are open to refinement during backlog grooming; the three field names, types, and numeric ranges are the fixed contract.
- **Valuable:** It lets a teacher tune each of the three signals to the course's own norms, so flagging matches a weekly seminar or a self-paced course rather than one fixed definition.
- **Estimable:** The scope is one three-field form plus per-field validation and localized messaging, sizable from the cited `edit_form.php` and `validation()` grounding.
- **Small:** It defines the form and its validation only; the default values ([STORY-001-02-01](STORY-001-02-01-default-risk-thresholds.md)) and the save/apply path ([STORY-001-02-03](STORY-001-02-03-persist-and-apply-thresholds.md)) are separate stories.
- **Testable:** Each validation rule has a deterministic accept/reject outcome at exact boundary values (1, 14, 365, 50, 0, 100, 366, 51, 101, -1), assertable through unit and Behat tests.

## Acceptance Criteria

1. *(Expected-output / form pre-populated)* **Given** an Editing Teacher opens the block configuration form on a course with no saved thresholds, **When** the form renders, **Then** the three fields show the default values 14, 1, and 2 respectively. **Pass:** `config_recencydays` shows 14, `config_overduecount` shows 1, and `config_trendsensitivity` shows 2. **Fail:** any field renders empty or shows a value other than its stated default.
2. *(Expected-output / valid save accepted)* **Given** the Editing Teacher enters `recencydays`=7, `overduecount`=2, and `trendsensitivity`=5, **When** they submit, **Then** the form accepts all three values and shows no validation error. **Pass:** the submission is accepted with zero errors on the three fields. **Fail:** any of the three in-range values raises an error, or the form re-displays an error.
3. *(Input-validation / non-numeric rejected)* **Given** the Editing Teacher enters `recencydays`="abc", **When** they submit, **Then** the form re-displays with a localized error on `recencydays` sourced from `get_string` and saves no value. **Pass:** `recencydays` shows a localized whole-number error and no value is stored for it. **Fail:** the non-numeric entry is accepted, stored, or coerced to 0.
4. *(Input-validation / out-of-range rejected)* **Given** the Editing Teacher enters `recencydays`=400, which is above the maximum of 365, **When** they submit, **Then** the form re-displays with a localized error naming the 1–365 bounds and saves no value. **Pass:** `recencydays` shows a localized error stating the 1 to 365 range and no value is stored. **Fail:** 400 is accepted or stored, or the error message omits the bounds.
5. *(Error-handling / negative rejected)* **Given** the Editing Teacher enters `overduecount`=-1 on a course whose `overduecount` was previously saved as 3, **When** they submit, **Then** the form rejects -1 with a localized message and the previously saved value of 3 is unchanged. **Pass:** -1 raises a localized error and the stored `overduecount` remains 3. **Fail:** -1 is accepted, or the stored value is overwritten or cleared.
6. *(Edge-case / blank falls back to default)* **Given** the Editing Teacher clears the `trendsensitivity` field and submits, **When** the form processes the blank field, **Then** it raises no error, stores no value for `trendsensitivity`, and the render falls back to the default of 2. **Pass:** the blank field stores nothing, raises no error, and the roster uses 2. **Fail:** the blank field raises an error, stores 0, or blocks the submission of the other two fields.
7. *(Boundary / minima and maxima accepted)* **Given** the Editing Teacher enters each field at its minimum (`recencydays`=1, `overduecount`=1, `trendsensitivity`=0) or at its maximum (`recencydays`=365, `overduecount`=50, `trendsensitivity`=100), **When** they submit, **Then** the form accepts every value with no error. **Pass:** all six boundary values (1, 1, 0 and 365, 50, 100) are accepted. **Fail:** any in-range boundary value raises an error.

## Edge Cases

- **Empty/Null Input:** A field left blank is treated as unset — the form stores no value and raises no error, and the render falls back to that field's STORY-001-02-01 default (14 / 1 / 2). A blank `config_recencydays` is never stored as 0.
- **Boundary Values:** Each field at its minimum (`config_recencydays`=1, `config_overduecount`=1, `config_trendsensitivity`=0) and at its maximum (`config_recencydays`=365, `config_overduecount`=50, `config_trendsensitivity`=100) is accepted. One step beyond each maximum (366, 51, 101) is rejected with a localized out-of-range message; one step below each minimum (0 for recency and overdue, -1 for trend) is rejected the same way.
- **Invalid Input:** A non-numeric entry (`abc`), a negative value (-1), and an out-of-range large value (99999) are each rejected with a localized `get_string` message keyed to the offending field, and no value is saved for that submission.
- **Concurrent/Conflicting Operations:** Two Editing Teachers open and submit the same course block configuration at the same time; both submissions pass the same validation rules, and the last submitted valid save is the one in effect. The last-write resolution detail belongs to [STORY-001-02-03: Persist and Apply Thresholds](STORY-001-02-03-persist-and-apply-thresholds.md); this story validates each submission independently and does not re-specify the save mechanics.

## Sub-tasks

- [ ] Add a `block_edit_form` subclass with `specific_definition($mform)` defining the three `config_` text fields (`config_recencydays`, `config_overduecount`, `config_trendsensitivity`), each with `setType(..., PARAM_INT)` and `setDefault` sourced from the [STORY-001-02-01](STORY-001-02-01-default-risk-thresholds.md) defaults [public/blocks/activity_results/edit_form.php:L42-L83] — @assignee
- [ ] Implement `validation($data, $files)` enforcing the numeric, in-range (1–365 / 1–50 / 0–100), and non-negative rules, returning localized `get_string` errors keyed by field name and treating a blank field as unset [public/blocks/rss_client/edit_form.php:L159-L204] — @assignee
- [ ] Externalize every field label, help text, and validation message through `get_string` and the plugin language pack (`lang/en/block_engagement.php`) — @assignee
- [ ] Restrict the configuration form to the Editing Teacher through the course-context block configure/edit capability — @assignee
- [ ] Add unit and Behat tests covering valid save, non-numeric reject, out-of-range reject, negative reject, blank-to-default, and the minimum/maximum boundaries — @assignee

## Estimation

- **Effort:** Medium
- **Complexity:** Medium (three-field form plus per-field validation plus localized messaging)
- **Uncertainty:** Low
- **Story Points (Fibonacci):** 5

## Definition of Done

- [ ] The block configuration form exposes the three `config_` fields (`config_recencydays`, `config_overduecount`, `config_trendsensitivity`), each typed `PARAM_INT`, with defaults 14 / 1 / 2 sourced from STORY-001-02-01.
- [ ] Validation rejects non-numeric, out-of-range, and negative values with localized `get_string` messages keyed by field name.
- [ ] A blank field is treated as unset — no value stored, no error raised, and the STORY-001-02-01 default applies at render.
- [ ] Only the Editing Teacher can open and submit the configuration form (course-context configure/edit capability); the Non-editing Teacher does not configure thresholds.
- [ ] Per-course scope is preserved — each block instance carries its own three values — and NO new database table is introduced.
- [ ] All field labels, help text, and validation messages flow through `get_string`.
- [ ] All acceptance criteria pass and the unit and Behat tests pass.
- [ ] The relative up-links to the parent feature and the epic resolve, and the sibling-story and cross-feature links resolve.
- [ ] The thresholds tune deterministic signal comparisons and do not couple to the machine-learning Predictive Analytics Engine.

## Notes

- **Internationalization (I9):** Every field label, help string, and validation message flows through `get_string` and the plugin language pack (`lang/en/block_engagement.php`); no displayed string is hardcoded in the form. The numeric bounds themselves (1, 14, 365, 50, 0, 100, 2) are language-independent.
- **Deterministic boundary (I11):** These thresholds tune deterministic signal comparisons — a day count against the recency bound, an overdue-item count against the overdue bound, and a normalized percentage-point change against the trend bound. This story does not use or depend on Moodle's machine-learning Predictive Analytics Engine; the thresholds are whole numbers entered by a teacher, not model outputs.
- **Dependencies:** The form pre-populates from the [STORY-001-02-01: Default Risk Thresholds](STORY-001-02-01-default-risk-thresholds.md) defaults; accepted values are saved and applied by [STORY-001-02-03: Persist and Apply Thresholds](STORY-001-02-03-persist-and-apply-thresholds.md); the resulting thresholds feed the flagging in [STORY-001-01-05: Flag and Prioritize At-Risk](../FEATURE-001-01/STORY-001-01-05-flag-and-prioritize-at-risk.md). The form is reachable only when the block is enabled per course per [FEATURE-001-03: Opt-In and Permission-Respecting Access](../FEATURE-001-03-optin-and-permission-respecting-access.md).
- **Scope reinforcement — verbatim v1 exclusion:** The first version excludes the following, reproduced verbatim from the objective statement:

> Automated notifications or alerts to teachers, visibility for parents or guardians, aggregated views across multiple courses, predictive modeling, and customization of which engagement signals are displayed.

  The clause "customization of which engagement signals are displayed" bounds this story directly: the teacher adjusts only the numeric thresholds for the three signals, never which of the three signals appear. This story adds no fourth threshold and no signal-selection control.
