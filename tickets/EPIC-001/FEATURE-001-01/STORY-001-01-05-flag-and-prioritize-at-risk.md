# STORY-001-01-05: Flag and Prioritize At-Risk

- **Story ID:** STORY-001-01-05
- **Parent Feature:** [FEATURE-001-01: In-Course Engagement Overview](../FEATURE-001-01-in-course-engagement-overview.md)
- **Epic:** [EPIC-001: Surface Student Engagement Risk on the Course Page](../../EPIC-001-student-engagement-risk-visibility.md)
- **Type:** User Story
- **Requirement:** R3 — students showing concerning patterns are visually flagged and surfaced first
- **Status:** Draft / Ready for Refinement

## User Story

**As a** Non-editing Teacher, **I want** each concerning student visually flagged by color, icon, and text together and listed ahead of engaged students, **so that** I know whom to check on first without scanning every row.

This story specifies the **overall risk flag** that rolls each student's three signals — activity recency [STORY-001-01-02: Activity-Recency Signal](STORY-001-01-02-activity-recency-signal.md), overdue work [STORY-001-01-03: Overdue-Work Signal](STORY-001-01-03-overdue-work-signal.md), and assessment trend [STORY-001-01-04: Assessment-Trend Signal](STORY-001-01-04-assessment-trend-signal.md) — into one risk level (high, watch, or none) for each row of the roster container owned by [STORY-001-01-01: Display Engagement Roster](STORY-001-01-01-display-engagement-roster.md). Each level is rendered by a Boost status token, a Font Awesome icon, and a localized text label together, and the roster orders high-risk rows ahead of watch rows ahead of engaged rows so the teacher reads the class in priority order.

The flag is computed against the per-course thresholds owned by [FEATURE-001-02: Configurable Risk Thresholds](../FEATURE-001-02-configurable-risk-thresholds.md). Because FEATURE-001-02 ships defaults (STORY-001-02-01), this story is demonstrable with zero configuration.

The quantifiable benefit: the highest-risk students appear at the top of one view, instead of being inferred by cross-checking three separate screens — the gradebook, the activity logs, and the assignment submission lists — one student at a time.

## INVEST Justification

- **Independent:** The flag aggregates the three signals using the default thresholds shipped by [FEATURE-001-02: Configurable Risk Thresholds](../FEATURE-001-02-configurable-risk-thresholds.md) (STORY-001-02-01), so it is demonstrable to a Product Owner on its own — before any teacher adjusts a threshold and with zero manual configuration.
- **Negotiable:** The aggregation cut-offs (how many breaching signals map to high versus watch), the level labels, and the icon choices are open to refinement during backlog grooming; the WHO/WHAT/WHY is fixed but the presentation detail is not.
- **Valuable:** It gives the teacher one risk level per student and orders the roster so concerning students surface first, removing the cross-screen comparison the teacher performs today.
- **Estimable:** The scope is one deterministic function over three already-computed signals plus one sort, rendered with existing Boost status tokens and Font Awesome icons, so the work is sizable from the cited inputs.
- **Small:** It delivers one aggregate flag and the roster ordering into the existing roster container; the three signal cells and the threshold-configuration UI are separate stories.
- **Testable:** The signal-to-level mapping and the high-to-watch-to-none sort order are deterministic functions of the signal values and the thresholds, so each level and the row order are assertable through unit tests with fixed signal inputs.

## Aggregation Rule

The overall risk level for one student is computed deterministically from that student's three signals and the per-course thresholds. The rule is defined explicitly below.

1. **Per-signal breach.** A signal breaches when it falls in its concerning band: the activity-recency signal [STORY-001-01-02: Activity-Recency Signal](STORY-001-01-02-activity-recency-signal.md) is staler than its recency threshold, the overdue-work signal [STORY-001-01-03: Overdue-Work Signal](STORY-001-01-03-overdue-work-signal.md) reports work past its due date beyond its overdue threshold, or the assessment-trend signal [STORY-001-01-04: Assessment-Trend Signal](STORY-001-01-04-assessment-trend-signal.md) is down beyond its flat band. Each breach test reads the per-course threshold owned by [FEATURE-001-02: Configurable Risk Thresholds](../FEATURE-001-02-configurable-risk-thresholds.md), applying the FEATURE-001-02 default when no per-course value is set.
2. **Level from breach count.** The level is **high** when two or more of the three signals breach, **watch** when exactly one signal breaches, and **none (engaged)** when zero signals breach.
3. **Missing-signal handling.** A signal in its labeled unavailable state ("Last access unknown" from STORY-001-01-02 or "Not enough data" from STORY-001-01-04) counts as not breaching and never on its own raises the level to high; the unavailable signal is labeled in the row.
4. **All-missing handling.** A student whose three signals are all in an unavailable state yields a neutral overall state rendered with the `$info` token and the localized "Not enough data" label — never high.

Each level resolves to a Boost status token (the documented color is the value the named token compiles to in the Boost theme, defined in `public/theme/boost/scss/preset/default.scss`; the implementation resolves the named token rather than a hardcoded hex), a Font Awesome 6.7.2 icon, and a localized text label, rendered together through Mustache and `$OUTPUT`:

| Level | Boost token | Boost-compiled color (`preset/default.scss`) | Font Awesome icon | Text label |
|-------|-------------|------------------------------|-------------------|------------|
| High risk | `$danger` | `#ca3120` | warning triangle (`fa-triangle-exclamation`) | "High risk" |
| Watch | `$warning` | `#f0ad4e` | attention eye (`fa-eye`) | "Watch" |
| Engaged | `$success` | `#357a32` | check circle (`fa-circle-check`) | "Engaged" |
| Not enough data | `$info` | `#008196` | information circle (`fa-circle-info`) | "Not enough data" |

Color is never the only carrier of meaning: the Font Awesome icon and the text label accompany the color at every level.

## Acceptance Criteria

1. *(Input-validation / aggregation)* **Given** a student's three computed signals and the course thresholds (the per-course configured values, or the [FEATURE-001-02: Configurable Risk Thresholds](../FEATURE-001-02-configurable-risk-thresholds.md) defaults when unset), **When** the overall flag computes, **Then** it derives one risk level from the breach count — high for two or more breaching signals, watch for exactly one breaching signal, and none for zero breaching signals. **Pass:** the level equals high, watch, or none according to the count of signals in their concerning band. **Fail:** the level does not match the breach count, or a raw signal value is read without comparison to its threshold.
2. *(Expected-output / color + icon + text)* **Given** a student at the high-risk level, **When** the row renders, **Then** it shows the `$danger` token (which resolves to `#ca3120` in the Boost theme, defined in `public/theme/boost/scss/preset/default.scss`), a Font Awesome warning-triangle icon, and the text label "High risk" together. **Pass:** color, icon, and text are all present and color is not the only indicator. **Fail:** the level is conveyed by color alone, or the icon or the text label is absent.
3. *(Expected-output / prioritization)* **Given** a roster mixing high, watch, and engaged students, **When** the roster renders, **Then** rows are ordered high before watch before engaged, and a "needs attention" summary lists the high and watch students at the top. **Pass:** every high row precedes every watch row, every watch row precedes every engaged row, and the summary names each high and watch student. **Fail:** an engaged row precedes a high or watch row, or the summary omits a high or watch student.
4. *(Error-handling / missing signal)* **Given** a student with one signal in an unavailable state ("Last access unknown" or "Not enough data") and the other two within their engaged bands, **When** the flag computes, **Then** it derives the level from the two available signals, labels the unavailable signal in the row, and holds the level at none rather than raising it to high because a signal is missing. **Pass:** the unavailable signal is labeled, it counts as non-breaching, and the level reflects only the available signals. **Fail:** the missing signal raises the level to high or watch, or the render raises a fatal error.
5. *(Edge-case / all engaged)* **Given** every enrolled student sits within the engaged band on all three signals, **When** the roster renders, **Then** no high or watch flag is shown and a localized "All students are engaged" summary resolved through `get_string` is displayed. **Pass:** zero high or watch flags appear and the localized all-engaged summary is shown. **Fail:** a high or watch flag is shown, or the summary is missing or hardcoded.
6. *(Accessibility)* **Given** an icon-only flag affordance, **When** assistive technology inspects the roster, **Then** the affordance exposes an `aria-label` sourced from `get_string`, the flag text meets a contrast ratio of at least 4.5:1 against its background, and the flag is reachable and operable by keyboard. **Pass:** the `aria-label` is present, the measured contrast ratio is 4.5:1 or greater, and keyboard focus reaches the flag. **Fail:** the icon-only affordance has no text alternative, the contrast ratio is below 4.5:1, or the flag cannot be reached by keyboard.

## Edge Cases

- **Empty/Null Input:** A roster with zero enrolled students renders no flags and shows the localized empty state owned by [STORY-001-01-01: Display Engagement Roster](STORY-001-01-01-display-engagement-roster.md); a student whose three signals are all in an unavailable state is labeled "Not enough data" with the `$info` token and is never flagged high.
- **Boundary Values:** A signal whose value sits exactly at its threshold counts as a breach or a non-breach consistent with the boundary rule defined by that signal's owning story ([STORY-001-01-02: Activity-Recency Signal](STORY-001-01-02-activity-recency-signal.md), [STORY-001-01-03: Overdue-Work Signal](STORY-001-01-03-overdue-work-signal.md), [STORY-001-01-04: Assessment-Trend Signal](STORY-001-01-04-assessment-trend-signal.md)); the aggregation does not redefine the boundary — it reuses each signal's own at-threshold decision before counting breaches.
- **Invalid Input:** A per-course threshold value outside its allowed range falls back to the [FEATURE-001-02: Configurable Risk Thresholds](../FEATURE-001-02-configurable-risk-thresholds.md) default rather than raising an error or producing a mis-counted level; range validation itself is owned by FEATURE-001-02.
- **Concurrent/Conflicting Operations:** A threshold change, a new grade, or a new submission landing while the roster renders is resolved against one consistent snapshot taken at query time; the current render reflects that single snapshot, and the next render applies the changed thresholds and data.

## Sub-tasks

- [ ] Define and implement the signal-to-risk-level aggregation rule (breach count maps to high / watch / none), consuming each threshold from [FEATURE-001-02: Configurable Risk Thresholds](../FEATURE-001-02-configurable-risk-thresholds.md) with the default applied when no per-course value is set — @assignee
- [ ] Map each level to a Boost status token (`$danger` / `$warning` / `$success` / `$info`), a Font Awesome icon, and a localized text label rendered together, so color is never the only carrier of meaning — @assignee
- [ ] Implement prioritization: order rows high to watch to engaged and render the "needs attention" summary that lists high and watch students at the top — @assignee
- [ ] Implement the `aria-label` text alternatives via `get_string`, keyboard reachability, and a flag-text contrast ratio of at least 4.5:1; add a Behat accessibility check — @assignee
- [ ] Add unit tests for the aggregation, missing-signal, all-engaged, all-missing, and at-threshold paths — @assignee

## Estimation

- **Effort:** Medium-High
- **Complexity:** High (multi-signal aggregation, accessible color-icon-text rendering, prioritization ordering, and per-course threshold consumption)
- **Uncertainty:** Medium
- **Story Points (Fibonacci):** 8

## Definition of Done

- [ ] The signal-to-risk-level aggregation rule (high for two or more breaching signals, watch for one, none for zero) is defined and is driven by the per-course thresholds with a FEATURE-001-02 default fallback.
- [ ] Each level renders a color, a Font Awesome icon, and a text label together; color is never the only carrier of meaning.
- [ ] Flag colors resolve to the Boost status tokens `$danger` (`#ca3120`), `$warning` (`#f0ad4e`), `$success` (`#357a32`), and `$info` (`#008196`) rather than hardcoded hex values.
- [ ] Concerning students are surfaced first: rows are ordered high to watch to engaged and a "needs attention" summary lists high and watch students at the top.
- [ ] A missing signal counts as non-breaching and never raises the level to high; an all-missing student renders the neutral "Not enough data" state.
- [ ] WCAG 2.1 AA is met: icon-only affordances carry an `aria-label` via `get_string`, the flag is keyboard reachable, and flag text meets a contrast ratio of at least 4.5:1.
- [ ] The flag and ordering are demonstrable with the FEATURE-001-02 default thresholds, with zero per-course configuration.
- [ ] Every user-facing label and `aria-label` flows through `get_string`.
- [ ] All acceptance criteria pass.
- [ ] Unit tests (aggregation, missing-signal, all-engaged, all-missing, at-threshold) and a Behat accessibility check pass.
- [ ] The relative up-links to the parent feature and the epic resolve, and the sibling-story and sibling-feature links resolve.
- [ ] The risk level is aggregated from the three deterministic signals and does not couple to the machine-learning Predictive Analytics Engine.

## Notes

- **Internationalization (I9):** Every user-facing string — the "High risk", "Watch", "Engaged", and "Not enough data" labels, the "needs attention" and "All students are engaged" summaries, and every `aria-label` — flows through `get_string` and the plugin language pack (`lang/en/block_engagement.php`). No string is hardcoded in the markup.
- **Accessibility (I7):** WCAG 2.1 AA — each flag is carried by color, a Font Awesome icon, and a text label together (never by color alone); icon-only affordances expose an `aria-label`, the flag is keyboard reachable within the semantic roster table specified by [STORY-001-01-01: Display Engagement Roster](STORY-001-01-01-display-engagement-roster.md), and flag text meets a contrast ratio of at least 4.5:1 [Technical Specification §7.5.4].
- **Deterministic boundary (I11):** The risk level is a plain count of breaching signals compared against fixed thresholds. This story does not use or depend on Moodle's machine-learning Predictive Analytics Engine; the high / watch / none result is a deterministic aggregation, not a model prediction.
- **Dependencies:** This story consumes the three signals — [STORY-001-01-02: Activity-Recency Signal](STORY-001-01-02-activity-recency-signal.md), [STORY-001-01-03: Overdue-Work Signal](STORY-001-01-03-overdue-work-signal.md), and [STORY-001-01-04: Assessment-Trend Signal](STORY-001-01-04-assessment-trend-signal.md) — and the per-course thresholds owned by [FEATURE-001-02: Configurable Risk Thresholds](../FEATURE-001-02-configurable-risk-thresholds.md) (with the FEATURE-001-02 default applied when no per-course value is set, which preserves INVEST Independence). It renders the flag and the row ordering into the roster container specified by [STORY-001-01-01: Display Engagement Roster](STORY-001-01-01-display-engagement-roster.md), and the flag is visible only when the overview is enabled per course and the course-context permission checks pass per [FEATURE-001-03: Opt-In and Permission-Respecting Access](../FEATURE-001-03-optin-and-permission-respecting-access.md). The queries that feed the signals are bounded by the performance budget owned by STORY-001-03-03.
- **Out-of-scope reminder (verbatim v1 exclusion):**

> Automated notifications or alerts to teachers, visibility for parents or guardians, aggregated views across multiple courses, predictive modeling, and customization of which engagement signals are displayed.

  This story flags concerning students in context on the course page only: no notification or alert is sent to the teacher, and all three engagement signals are always shown — a teacher cannot choose which signals feed the flag.
