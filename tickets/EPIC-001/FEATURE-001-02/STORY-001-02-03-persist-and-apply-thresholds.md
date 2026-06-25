# STORY-001-02-03: Persist and Apply Thresholds

- **Story ID:** STORY-001-02-03
- **Parent Feature:** [FEATURE-001-02: Configurable Risk Thresholds](../FEATURE-001-02-configurable-risk-thresholds.md)
- **Epic:** [EPIC-001: Surface Student Engagement Risk on the Course Page](../../EPIC-001-student-engagement-risk-visibility.md)
- **Type:** User Story
- **Requirement:** R4 — adjustable thresholds (the persistence and application half)
- **Status:** Draft / Ready for Refinement

## User Story

**As an** Editing Teacher, **I want** the thresholds I save to persist for this course and be applied to roster flagging on every render, **so that** my tuning takes effect and survives page reloads without being re-entered.

The quantifiable benefit: one save applies to every subsequent render of this course's roster — and to no other course. The **Editing Teacher** saves the values; the **Non-editing Teacher** who later opens the same course page reads flags computed from those persisted values, because the saved set is scoped to the one course block instance. This story owns the save and serialize mechanics, the per-instance load, the render-time apply, the default fallback for any unset field, and the last-write resolution when two saves land at the same time. It does **not** define the entry form or its validation — those are owned by [STORY-001-02-02: Adjust Thresholds Per Course](STORY-001-02-02-adjust-thresholds-per-course.md) — and it does **not** define the default values themselves, which are owned by [STORY-001-02-01: Default Risk Thresholds](STORY-001-02-01-default-risk-thresholds.md).

## Persistence and Apply Model

The persisted thresholds live in the block instance configuration store; **no new database table is introduced.** The save, load, and apply flow is defined explicitly below.

1. **Save / serialize.** Accepted threshold values are written through `instance_config_save($data)`, which stores `block_instances.configdata = base64_encode(serialize($data))` and updates the row's `timemodified` to the save time [public/blocks/moodleblock.class.php:L516-L520]. The convenience path `instance_config_commit()` saves the values currently held in `$this->config` through the same method [public/blocks/moodleblock.class.php:L525-L528].
2. **Load / expose.** When the block instance loads, `_load_instance()` populates `$this->config = unserialize_object(base64_decode($instance->configdata))` whenever `configdata` is non-empty [public/blocks/moodleblock.class.php:L460-L463]. An instance with empty or absent `configdata` never populates `$this->config`, so every field is left unset.
3. **Apply at render (fallback rule).** Each of the three thresholds resolves as `$this->config->FIELD ?? <default>`, using the [STORY-001-02-01](STORY-001-02-01-default-risk-thresholds.md) defaults — `recencydays`=14, `overduecount`=1, `trendsensitivity`=2 — for any field that is unset. A saved field overrides its default; an unset, partial, or unreadable field falls back to its default.
4. **Per-course scope.** Because `configdata` is stored on each `block_instances` row, two courses hold two independent threshold sets; a save against one course's block instance leaves every other course's stored values unchanged.
5. **Last-write resolution.** When two saves target the same course block instance, each write updates `timemodified`; the row retains the values from the write with the later `timemodified`, and the next render applies that set.

The resolved recency, overdue, and trend thresholds are handed to the flag computation in [STORY-001-01-05: Flag and Prioritize At-Risk](../FEATURE-001-01/STORY-001-01-05-flag-and-prioritize-at-risk.md), which marks a student **high** when two or more of the three signals breach, **watch** when exactly one breaches, and **none** when zero breach.

## INVEST Justification

- **Independent:** Each threshold resolves as `$this->config->FIELD ?? <default>` against the [STORY-001-02-01](STORY-001-02-01-default-risk-thresholds.md) defaults (14 / 1 / 2), so the persistence-and-apply path is demonstrable with an empty config — before any value has ever been saved — and can be shown to a Product Owner on its own.
- **Negotiable:** The serialization vehicle (block instance configuration versus another core-supported per-instance store) and the wording of any saved-state message are open to refinement during backlog grooming; the save→load→apply contract and the default fallback are the fixed part.
- **Valuable:** One save applies to every later render of this course's roster and to no other course, so a teacher's tuning takes effect and survives page reloads with no re-entry.
- **Estimable:** The scope is one serialize-and-save call, one per-instance load, one render-time resolve-with-fallback, and one last-write rule, sizable from the cited `moodleblock.class.php` grounding.
- **Small:** It owns persistence, apply, fallback, and concurrency resolution only; the entry form and its validation ([STORY-001-02-02](STORY-001-02-02-adjust-thresholds-per-course.md)) and the default definitions ([STORY-001-02-01](STORY-001-02-01-default-risk-thresholds.md)) are separate stories.
- **Testable:** persist→reload→apply, partial→per-field default, corrupt→all defaults, per-course isolation, and concurrent last-write are each deterministic and assertable with exact values (7, 10, 14, 1, 2).

## Acceptance Criteria

1. *(Expected-output / persist + apply)* **Given** the Editing Teacher saves `recencydays`=7 for a course, **When** the roster re-renders, **Then** the recency threshold applied to flagging is 7 and a student inactive for 10 days breaches the recency signal. **Pass:** the applied recency threshold equals 7 and the 10-day-inactive student breaches recency. **Fail:** the applied recency threshold equals any value other than 7, or the 10-day-inactive student does not breach recency.
2. *(Expected-output / persistence across reload)* **Given** thresholds were saved for a course and stored in `block_instances.configdata`, **When** the course page is reloaded in a later session, **Then** the identical saved values are read back through `$this->config` and applied to flagging with no re-entry. **Pass:** the reloaded render reads the same saved values from `block_instances.configdata` and applies them. **Fail:** the reloaded render loses the saved values, prompts for re-entry, or applies the defaults in place of the saved values.
3. *(Input-validation / partial config falls back per field)* **Given** a block instance whose saved config holds `recencydays`=10 but no `overduecount` and no `trendsensitivity`, **When** the roster renders, **Then** recency uses 10 while overdue resolves to the default 1 and trend resolves to the default 2. **Pass:** recency equals 10, overdue equals 1, and trend equals 2. **Fail:** any unset field renders null or empty, or the saved `recencydays`=10 is replaced by its default.
4. *(Error-handling / corrupt configdata)* **Given** a `block_instances.configdata` value that does not unserialize into usable threshold values, **When** the roster renders, **Then** all three thresholds resolve to the defaults 14 / 1 / 2 and the page renders with no fatal error. **Pass:** the three thresholds equal 14 / 1 / 2 and the render completes with no fatal error. **Fail:** the render raises a fatal error, or a threshold resolves to a null, empty, or undefined value.
5. *(Edge-case / per-course isolation)* **Given** course A saved `recencydays`=7 and course B has no saved config, **When** both rosters render, **Then** course A applies 7 and course B applies the default 14, with no cross-contamination. **Pass:** course A applies 7 and course B applies 14 in the same render cycle. **Fail:** course B reads course A's 7, or course A reads course B's default 14.
6. *(Concurrent / last-write resolution)* **Given** two Editing Teachers submit valid threshold sets for the same course block at the same time, **When** both `instance_config_save()` writes complete, **Then** the `block_instances.configdata` row holds the values from the write with the later `timemodified`, and the next render applies that set. **Pass:** the stored row equals the later-`timemodified` write and the next render applies those values. **Fail:** the stored row mixes fields from both writes, or the next render applies the earlier write.

## Edge Cases

- **Empty/Null Input:** A block instance with empty or absent `configdata` never populates `$this->config`, so all three thresholds resolve to their defaults (14 / 1 / 2) through the fallback.
- **Boundary Values:** A saved value at a field boundary — for example `recencydays`=365 or `trendsensitivity`=0 — is serialized into `block_instances.configdata` and applied at render exactly as saved, with no default substituted for the boundary value.
- **Invalid Input:** A `configdata` payload that is present but corrupt or not unserializable into usable values falls back to the defaults (14 / 1 / 2) rather than raising; entry-time validation of submitted values is owned by [STORY-001-02-02](STORY-001-02-02-adjust-thresholds-per-course.md), so this story guards only the apply path.
- **Concurrent/Conflicting Operations:** Two simultaneous saves for the same course block resolve to the write with the later `timemodified` (last write wins); a save against course A never alters course B's stored configuration.

## Sub-tasks

- [ ] Persist accepted threshold values through `instance_config_save()` into `block_instances.configdata` as `base64_encode(serialize($data))`, updating `timemodified` — introducing NO new database table [public/blocks/moodleblock.class.php:L516-L520] — @assignee
- [ ] Load `$this->config` per instance in `_load_instance()` (`unserialize_object(base64_decode($instance->configdata))` when `configdata` is non-empty) and resolve each threshold as `$this->config->FIELD ?? <default>` at render time [public/blocks/moodleblock.class.php:L460-L463] — @assignee
- [ ] Pass the resolved recency, overdue, and trend thresholds into the [STORY-001-01-05](../FEATURE-001-01/STORY-001-01-05-flag-and-prioritize-at-risk.md) flag computation — @assignee
- [ ] Guard the apply path against absent, partial, or corrupt config by falling back to the [STORY-001-02-01](STORY-001-02-01-default-risk-thresholds.md) defaults (14 / 1 / 2) — @assignee
- [ ] Externalize any saved-state or status text through `get_string` and the plugin language pack (`lang/en/block_engagement.php`) — @assignee
- [ ] Add unit and Behat tests: persist→reload→apply; partial→per-field default; corrupt→all defaults; per-course isolation; concurrent last-write — @assignee

## Estimation

- **Effort:** Low-Medium
- **Complexity:** Medium (serialize and load through block instance configuration, render-time apply, default fallback, and last-write concurrency resolution)
- **Uncertainty:** Low
- **Story Points (Fibonacci):** 3

## Definition of Done

- [ ] Accepted threshold values persist via `instance_config_save()` into `block_instances.configdata` (`base64_encode(serialize($data))` with `timemodified` updated), introducing NO new database table.
- [ ] `$this->config` is read per instance in `_load_instance()` whenever `configdata` is non-empty.
- [ ] Each threshold is resolved at render as `$this->config->FIELD ?? <default>`.
- [ ] Absent, partial, or corrupt config falls back to the STORY-001-02-01 defaults 14 / 1 / 2.
- [ ] The resolved recency, overdue, and trend thresholds feed the [STORY-001-01-05](../FEATURE-001-01/STORY-001-01-05-flag-and-prioritize-at-risk.md) flag computation (high for two or more breaching signals, watch for one, none for zero).
- [ ] Per-course isolation holds — each `block_instances` row carries its own values, and one course's save never changes another course's stored configuration.
- [ ] Concurrent saves resolve to the write with the later `timemodified` (last write wins).
- [ ] Any saved-state or status text flows through `get_string`.
- [ ] All acceptance criteria pass and the unit and Behat tests pass.
- [ ] The relative up-links to the parent feature and the epic resolve, and the sibling-story and cross-feature links resolve.
- [ ] Persistence and application drive deterministic signal comparisons and do not couple to the machine-learning Predictive Analytics Engine.

## Notes

- **Internationalization (I9):** Any saved-state or status text related to persistence flows through `get_string` and the plugin language pack (`lang/en/block_engagement.php`); no such string is hardcoded in the markup. The numeric values themselves (7, 10, 14, 1, 2, 365, 0) are language-independent.
- **Deterministic boundary (I11):** Persistence and application drive deterministic signal comparisons — a day count against the resolved recency threshold, an overdue-item count against the resolved overdue threshold, and a normalized percentage-point change against the resolved trend threshold. This story does not use or depend on Moodle's machine-learning Predictive Analytics Engine; the stored thresholds are whole numbers, not model outputs.
- **Dependencies:** This story consumes the defaults from [STORY-001-02-01: Default Risk Thresholds](STORY-001-02-01-default-risk-thresholds.md) as the fallback for any unset field, receives validated values from [STORY-001-02-02: Adjust Thresholds Per Course](STORY-001-02-02-adjust-thresholds-per-course.md), and supplies the resolved thresholds to the flagging in [STORY-001-01-05: Flag and Prioritize At-Risk](../FEATURE-001-01/STORY-001-01-05-flag-and-prioritize-at-risk.md). Because the STORY-001-02-01 defaults exist, [FEATURE-001-01: In-Course Engagement Overview](../FEATURE-001-01-in-course-engagement-overview.md) flagging is demonstrable before any save.
- **Scope reinforcement — verbatim v1 exclusion:** The first version excludes the following, reproduced verbatim from the objective statement:

> Automated notifications or alerts to teachers, visibility for parents or guardians, aggregated views across multiple courses, predictive modeling, and customization of which engagement signals are displayed.

  The clause "customization of which engagement signals are displayed" bounds this story directly: only the numeric thresholds (recency, overdue, trend) are persisted and applied, never which of the three signals appear. This story adds no fourth threshold and introduces no signal-selection control.
