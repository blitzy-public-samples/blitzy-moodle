# STORY-001-02-01: Default Risk Thresholds

- **Story ID:** STORY-001-02-01
- **Parent Feature:** [FEATURE-001-02: Configurable Risk Thresholds](../FEATURE-001-02-configurable-risk-thresholds.md)
- **Epic:** [EPIC-001: Surface Student Engagement Risk on the Course Page](../../EPIC-001-student-engagement-risk-visibility.md)
- **Type:** User Story
- **Requirement:** I5 — out-of-the-box default thresholds (enables R3 independence)
- **Status:** Draft / Ready for Refinement

## User Story

**As an** Editing Teacher, **I want** the engagement overview to apply pre-set default thresholds the moment I add the block to my course, **so that** the roster flags at-risk students with zero configuration. The **Non-editing Teacher** who later opens the same course page is a direct beneficiary: students are flagged from the first render, before any threshold is touched.

The quantifiable benefit: the view is useful on render 1 with 0 configuration steps — flagging does not wait on any teacher input, any saved form, or any per-course value. This story specifies the three out-of-the-box default thresholds and the render-time fallback rule that applies them when a block instance holds no saved value for a field. Threshold *adjustment* is owned by [STORY-001-02-02: Adjust Thresholds Per Course](STORY-001-02-02-adjust-thresholds-per-course.md), and threshold *persistence* is owned by [STORY-001-02-03: Persist and Apply Thresholds](STORY-001-02-03-persist-and-apply-thresholds.md); this story defines the defaults and the fallback only.

## Default Threshold Values

The three default thresholds map one-to-one to the three engagement signals owned by [FEATURE-001-01: In-Course Engagement Overview](../FEATURE-001-01-in-course-engagement-overview.md). These are the values that apply with zero configuration — the values used whenever a block instance has no saved value for the field.

| Field | Default | Unit | Signal it governs |
|-------|---------|------|-------------------|
| `recencydays` | 14 | days | Activity-recency signal — [STORY-001-01-02](../FEATURE-001-01/STORY-001-01-02-activity-recency-signal.md); a student inactive for more than 14 days breaches the recency signal. |
| `overduecount` | 1 | item | Overdue-work signal — [STORY-001-01-03](../FEATURE-001-01/STORY-001-01-03-overdue-work-signal.md); a student with 1 or more past-due unsubmitted items breaches the overdue signal. |
| `trendsensitivity` | 2 | percentage points | Assessment-trend signal — [STORY-001-01-04](../FEATURE-001-01/STORY-001-01-04-assessment-trend-signal.md); a normalized decline strictly greater than 2 percentage points over the window breaches the trend signal. |

Each value is declared once as a block default setting — following Moodle's `admin_setting_config*` default pattern, the same way `block_accessreview/whattoshow` carries `'showboth'` as its fourth-argument default [public/blocks/accessreview/settings.php:L37-L42] — and is read back at render time through `get_config('block_engagement')`. Where a per-course block instance has saved a value for a field, that value overrides the default through `$this->config` [public/blocks/moodleblock.class.php:L462]; where it has not, the default applies via the fallback `$this->config->FIELD ?? <default>`. Because `$this->config` is populated only when `block_instances.configdata` is non-empty [public/blocks/moodleblock.class.php:L460-L463], an instance with no saved configuration resolves every field to its default. **No new database table is introduced — these defaults and any saved overrides live in the block instance configuration store only.**

## INVEST Justification

- **Independent:** The defaults are demonstrable on their own — they exist as the block's default settings even before the adjustment form ([STORY-001-02-02](STORY-001-02-02-adjust-thresholds-per-course.md)) or the persistence path ([STORY-001-02-03](STORY-001-02-03-persist-and-apply-thresholds.md)) is built, and they are what make [FEATURE-001-01](../FEATURE-001-01-in-course-engagement-overview.md) independently demonstrable to a Product Owner.
- **Negotiable:** The exact default numbers (14 / 1 / 2) are open to refinement by the Product Owner during backlog grooming; the existence of defaults is fixed, the specific values are not.
- **Valuable:** It delivers a zero-configuration useful view — the roster flags at-risk students on the first render, so the teacher gains value before learning or touching any setting.
- **Estimable:** The scope is three named default values plus one deterministic fallback rule, so the work is sizable from the cited settings and configuration grounding.
- **Small:** It defines the defaults and the fallback only; the adjustment form and the persistence/serialization mechanics are separate stories.
- **Testable:** "the default applies when no config is present" is a deterministic, assertable rule with exact expected values (14 / 1 / 2), verifiable through unit tests over no-config, partial-config, and corrupt-config inputs.

## Acceptance Criteria

1. *(Expected-output / defaults applied)* **Given** a newly added block instance with no saved configuration, **When** the roster renders, **Then** the recency threshold resolves to 14 days, the overdue threshold resolves to 1 item, and the trend threshold resolves to 2 percentage points. **Pass:** all three thresholds equal 14 / 1 / 2 with no saved configuration present. **Fail:** any threshold resolves to a value other than its stated default, or the render depends on a saved value that does not exist.
2. *(Input-validation / absent field falls back)* **Given** a block instance whose saved configuration contains a value for `recencydays` but no value for `overduecount`, **When** the roster renders, **Then** `overduecount` resolves to the default of 1 while `recencydays` uses its saved value. **Pass:** the absent `overduecount` field falls back to 1 and the present `recencydays` field keeps its saved value. **Fail:** the absent field renders empty or null, or the saved `recencydays` value is overwritten by its default.
3. *(Expected-output / flagging works with defaults)* **Given** the default thresholds and a student inactive for 20 days in the course, **When** the flag computation runs, **Then** that student breaches the recency signal because 20 is greater than the 14-day default, with no teacher having opened the configuration form. **Pass:** the student is marked as breaching recency under the default threshold. **Fail:** the student is not flagged, or flagging requires a saved configuration value to exist first.
4. *(Error-handling / corrupt config)* **Given** a block instance whose `configdata` cannot be unserialized into usable threshold values, **When** the roster renders, **Then** all three thresholds resolve to their defaults (14 / 1 / 2) and the render completes with no fatal error. **Pass:** the three defaults apply and the roster renders without a fatal error. **Fail:** the render raises a fatal error, or a threshold resolves to a null, empty, or undefined value.
5. *(Edge-case / empty config object)* **Given** a block instance whose `$this->config` is empty for every threshold field, **When** the roster renders, **Then** all three thresholds resolve to their defaults (14 / 1 / 2) and the roster flags students against those defaults. **Pass:** every field falls back to its default and flagging runs against 14 / 1 / 2. **Fail:** any field resolves to a non-default value, or flagging is skipped because the configuration object is empty.
6. *(Input-validation / defaults are a single read-only baseline)* **Given** the default values are declared once as the block's default settings, **When** two separate course block instances each render with no saved configuration, **Then** both apply the identical defaults (14 / 1 / 2). **Pass:** the two instances resolve to the same three default values. **Fail:** the two instances resolve to different defaults, or either instance reads a default from another instance's saved configuration.

## Edge Cases

- **Empty/Null Input:** A block instance with no `configdata` at all (a freshly added block) resolves all three thresholds to their defaults (14 / 1 / 2); `$this->config` is never populated for an empty `configdata`, so the fallback supplies every value.
- **Boundary Values:** A saved value equal to a field default — for example `recencydays` saved as 14 — renders identically to the unset default, because the resolved threshold is 14 either way. The default trend value of 2 percentage points is the lower edge of the ±2-percentage-point flat band defined by [STORY-001-01-04](../FEATURE-001-01/STORY-001-01-04-assessment-trend-signal.md), so the default sits exactly at that signal's flat-band boundary.
- **Invalid Input:** A `configdata` payload that is present but corrupt or not unserializable falls back to the defaults rather than rendering an error; validation of *entered* values is owned by [STORY-001-02-02](STORY-001-02-02-adjust-thresholds-per-course.md), not by this story.
- **Concurrent/Conflicting Operations:** Two roster renders that occur before any configuration is ever saved both resolve to the identical defaults (14 / 1 / 2); because the defaults are a read-only baseline, neither render can change what the other reads.

## Sub-tasks

- [ ] Define the three default values (`recencydays`=14, `overduecount`=1, `trendsensitivity`=2) as block default settings, following the `admin_setting_config*` default pattern [public/blocks/accessreview/settings.php:L37-L42] and exposed via `get_config('block_engagement')` — @assignee
- [ ] Implement the render-time fallback `$this->config->FIELD ?? <default>` for each of the three fields, reading `$this->config` only when `block_instances.configdata` is non-empty [public/blocks/moodleblock.class.php:L460-L463] — @assignee
- [ ] Externalize the default-related setting labels and help text through `get_string` and the plugin language pack (`lang/en/block_engagement.php`) — @assignee
- [ ] Add unit tests: no-config → defaults (14 / 1 / 2); partial-config → mixed saved-plus-default; corrupt-config → defaults — @assignee

## Estimation

- **Effort:** Low
- **Complexity:** Low (three named constants plus one deterministic fallback rule)
- **Uncertainty:** Low
- **Story Points (Fibonacci):** 2

## Definition of Done

- [ ] The three defaults are defined — `recencydays`=14 (days), `overduecount`=1 (item), `trendsensitivity`=2 (percentage points) — each with its unit and the signal it governs.
- [ ] The render-time fallback rule (`$this->config->FIELD ?? <default>`) is defined for absent, partial, and corrupt configuration.
- [ ] The defaults introduce NO new database table — they live in the block instance configuration store only.
- [ ] Default-related setting labels and help text flow through `get_string`.
- [ ] All acceptance criteria pass.
- [ ] Unit tests (no-config, partial-config, corrupt-config) pass.
- [ ] The relative up-links to the parent feature and the epic resolve, and the sibling-story and cross-feature links resolve.
- [ ] [FEATURE-001-01](../FEATURE-001-01-in-course-engagement-overview.md) flagging is demonstrable using these defaults, which preserves its INVEST Independence.
- [ ] The defaults govern deterministic signal comparisons and do not couple to the machine-learning Predictive Analytics Engine.

## Notes

- **Internationalization (I9):** The default-related setting labels and help text flow through `get_string` and the plugin language pack (`lang/en/block_engagement.php`); no default-related string is hardcoded in the markup. The numeric default values themselves (14 / 1 / 2) are language-independent.
- **Deterministic boundary (I11):** These defaults govern deterministic signal comparisons — a day count against 14, an overdue-item count against 1, and a normalized percentage-point change against 2. This story does not use or depend on Moodle's machine-learning Predictive Analytics Engine; the thresholds are fixed numbers, not model outputs.
- **Dependencies:** These defaults are **overridden** by per-course adjustment in [STORY-001-02-02: Adjust Thresholds Per Course](STORY-001-02-02-adjust-thresholds-per-course.md), are **persisted and applied** (with default fallback for any unset field) by [STORY-001-02-03: Persist and Apply Thresholds](STORY-001-02-03-persist-and-apply-thresholds.md), and are **consumed** by the flagging in [STORY-001-01-05: Flag and Prioritize At-Risk](../FEATURE-001-01/STORY-001-01-05-flag-and-prioritize-at-risk.md). Because these defaults exist, [FEATURE-001-01: In-Course Engagement Overview](../FEATURE-001-01-in-course-engagement-overview.md) is independently demonstrable before any threshold is adjusted.
- **Scope reinforcement — verbatim v1 exclusion:** The first version excludes the following, reproduced verbatim from the objective statement:

> Automated notifications or alerts to teachers, visibility for parents or guardians, aggregated views across multiple courses, predictive modeling, and customization of which engagement signals are displayed.

  The clause "customization of which engagement signals are displayed" bounds this story directly: only the numeric thresholds (recency, overdue, trend) have defaults and are later configurable. All three signals are always shown; this story does not add a fourth threshold and does not let a teacher choose which signals appear.
