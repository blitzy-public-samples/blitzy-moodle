# FEATURE-001-02: Configurable Risk Thresholds

- **Feature ID:** FEATURE-001-02
- **Parent Epic:** [EPIC-001: Surface Student Engagement Risk on the Course Page](../EPIC-001-student-engagement-risk-visibility.md)
- **Type:** Feature
- **Status:** Draft / Ready for Refinement
- **Requirements covered:** I5, R4

## Summary

This feature ships out-of-the-box default risk thresholds and lets a teacher adjust them per course — the activity-recency cutoff, the overdue-work tolerance, and the assessment-trend sensitivity — persisting the chosen values so the [FEATURE-001-01](FEATURE-001-01-in-course-engagement-overview.md) roster flags each student against that course's own norms. The defaults make the overview useful from the moment the block is added, before a teacher changes a single value.

## Description

What counts as "concerning" is not the same in every course. A weekly instructor-led seminar and a self-paced online course have different rhythms of activity, different assignment cadences, and different grade distributions, so a single fixed definition of risk would misfire — flagging engaged students in one course while missing disengaging students in another. This feature resolves that tension by separating the *definition* of risk (the thresholds) from the *detection* of risk (the flagging owned by FEATURE-001-01), and by giving each course its own threshold values.

1. **Sensible defaults make the view useful on day one (I5).** Each of the three signals ships with a default threshold, so the roster flags students the moment the block is placed on a course — with no configuration step required. These defaults are what let [FEATURE-001-01: In-Course Engagement Overview](FEATURE-001-01-in-course-engagement-overview.md) be demonstrated to a Product Owner on its own, which preserves its INVEST Independence.
2. **Per-course adjustment tailors sensitivity (R4).** A teacher can raise or lower each threshold for the course they teach, so the definition of "concerning" matches the norms of that course rather than a site-wide assumption. The three adjustable thresholds map one-to-one to the three signals owned by FEATURE-001-01 and introduce no fourth signal.
3. **Persisted values drive the flagging.** Adjusted thresholds are stored against the course's block instance and read back at render time, so every later page load evaluates the roster against the course's own thresholds rather than the defaults.

## User Stories

This feature is delivered through three child stories. Each link is relative to this file's location in `tickets/EPIC-001/`.

1. [STORY-001-02-01: Default Risk Thresholds](FEATURE-001-02/STORY-001-02-01-default-risk-thresholds.md) — apply sensible default thresholds out of the box so the overview flags students before any customization (I5).
2. [STORY-001-02-02: Adjust Thresholds Per Course](FEATURE-001-02/STORY-001-02-02-adjust-thresholds-per-course.md) — let the teacher adjust thresholds via the block configuration form (R4).
3. [STORY-001-02-03: Persist and Apply Thresholds](FEATURE-001-02/STORY-001-02-03-persist-and-apply-thresholds.md) — persist adjusted thresholds and apply them to roster flagging (R4).

## Dependencies

### Internal (within this feature)

- **STORY-001-02-01 (defaults)** is the baseline: it defines the threshold values the feature uses when a teacher has changed nothing.
- **STORY-001-02-02 (adjust)** overrides that baseline: it presents the per-course form through which a teacher raises or lowers each threshold.
- **STORY-001-02-03 (persist & apply)** depends on both: it stores the adjusted values against the course and feeds them — falling back to the STORY-001-02-01 defaults wherever a value is unset — into the flagging evaluation.

### Cross-feature

- The thresholds defined here are **consumed by** the flagging behavior in [FEATURE-001-01: In-Course Engagement Overview](FEATURE-001-01-in-course-engagement-overview.md), specifically its flag-and-prioritize story **STORY-001-01-05**. Because this feature ships defaults (STORY-001-02-01), FEATURE-001-01 is demonstrable to a Product Owner before any threshold is adjusted — which is what preserves each feature's INVEST Independence.
- Threshold configuration is **reachable only when the block is enabled per course** via [FEATURE-001-03: Opt-In and Permission-Respecting Access](FEATURE-001-03-optin-and-permission-respecting-access.md): a teacher reaches the threshold form through the same block instance that FEATURE-001-03 places on the course.

### External platform grounding (read-only Moodle — high-level; no file below is modified)

- **Per-course persistence through block instance configuration.** Adjusted thresholds are serialized into `block_instances.configdata` by `instance_config_save()` and exposed at render time through `$this->config` [public/blocks/moodleblock.class.php:L516,L462]. **No new database table is introduced** — the per-course thresholds live in the block instance's existing configuration store.
- **The adjustment UI is the block's configuration form.** Per-course thresholds are edited through the standard block `edit_form.php` pattern built on the Moodle Form API — the same mechanism every configurable block uses.
- **Defaults follow the plugin settings pattern.** Out-of-the-box default values are declared the way a block declares its settings (for example an `admin_setting_configselect` carrying a default value in `settings.php`), so a freshly placed block starts from defined thresholds rather than empty ones.
- **Thresholds map to the three FEATURE-001-01 signals** and add none beyond them: the activity-recency cutoff (days since `user_lastaccess.timeaccess`), the overdue-work tolerance (the count or age of items past their `mod_assign` `duedate`), and the assessment-trend sensitivity (the magnitude of `grade_grades` change across the comparison window).

### Third-party dependencies

This feature introduces **zero** new third-party dependencies; the downstream block reads and writes its thresholds through Moodle core APIs only (block instance configuration and the Moodle Form API).

## Scope Notes

The following items are excluded from the first version, reproduced verbatim from the objective statement:

> Automated notifications or alerts to teachers, visibility for parents or guardians, aggregated views across multiple courses, predictive modeling, and customization of which engagement signals are displayed.

The last exclusion bounds this feature directly. **What is configurable is the numeric threshold for each signal** — the recency cutoff, the overdue tolerance, and the trend sensitivity. **What is not configurable is which signals appear:** all three signals are always shown, and a teacher cannot add, remove, or hide a signal. This feature adjusts *how strict* each signal is, never *which* signals are displayed.

## Definition of Done

- [ ] All three child stories (STORY-001-02-01, STORY-001-02-02, STORY-001-02-03) are authored to the INVEST and BDD quality gate: 4-8 Given/When/Then acceptance criteria each, zero forbidden terms, 3-5 edge cases covering Empty/Null Input, Boundary Values, and Invalid Input (and Concurrent/Conflicting Operations where applicable), sub-tasks with `@assignee` placeholders, a Fibonacci story-point estimate, and a story-level Definition of Done.
- [ ] I5 (default thresholds out of the box) and R4 (per-course adjust, persist, and apply) are each covered by at least one child story.
- [ ] Defaults are specified so the FEATURE-001-01 overview flags students with zero configuration, guaranteeing FEATURE-001-01 can be demonstrated independently.
- [ ] Per-course persistence is specified through block instance configuration (`instance_config_save()` / `$this->config`), with **no new database table**.
- [ ] The three adjustable thresholds map one-to-one to the three FEATURE-001-01 signals; no fourth threshold or signal is introduced.
- [ ] All feature-to-story relative links resolve, and the parent-epic up-link resolves.
- [ ] The Scope Notes state that signal-selection customization is out of scope — only the thresholds are configurable.
