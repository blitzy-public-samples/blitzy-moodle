# STORY-001-01-04: Assessment-Trend Signal

- **Story ID:** STORY-001-01-04
- **Parent Feature:** [FEATURE-001-01: In-Course Engagement Overview](../FEATURE-001-01-in-course-engagement-overview.md)
- **Epic:** [EPIC-001: Surface Student Engagement Risk on the Course Page](../../EPIC-001-student-engagement-risk-visibility.md)
- **Type:** User Story
- **Requirement:** R2c — whether each student's assessment performance is trending up, down, or flat
- **Status:** Draft / Ready for Refinement

## User Story

**As a** Non-editing Teacher, **I want** each student's roster row to show whether that student's assessment performance is trending up, down, or flat over the trailing 30 days, **so that** I can identify students whose grades are declining and intervene before they fall behind.

This story specifies the **assessment-trend signal cell** that renders inside each row of the roster container owned by [STORY-001-01-01: Display Engagement Roster](STORY-001-01-01-display-engagement-roster.md). It reads each student's recorded grades, normalizes them to a percentage of each grade item's maximum, and compares the earliest in-window value with the latest in-window value to classify the trend as up, down, flat/steady, or "Not enough data". The student set is the roster's bounded enrolled-student set; this story reuses that set rather than re-querying the enrolment API.

The quantifiable benefit: one per-student trend indicator, shown in the student's roster row, replaces opening the gradebook grade history for each student one at a time to work out whose marks are sliding.

## INVEST Justification

- **Independent:** The cell classifies the trend from existing `grade_grades` and `grade_grades_history` data using the default trend sensitivity from [FEATURE-001-02](../FEATURE-001-02-configurable-risk-thresholds.md), so it is demonstrable to a Product Owner on its own — before the recency cell, the overdue cell, or the overall flag is wired, and before a teacher adjusts a threshold.
- **Negotiable:** The wording of the trend label and the choice of directional icon are open to refinement during backlog grooming; the WHO/WHAT/WHY is fixed but the presentation detail is not.
- **Valuable:** It gives the teacher one trend direction per student, removing the per-student trip into the gradebook grade history that the teacher performs today.
- **Estimable:** The scope is one bounded read of `grade_grades` joined to `grade_grades_history` over the known roster set within a fixed window, plus normalization and one comparison, so the work is sizable from the cited data sources.
- **Small:** It delivers one signal cell (trend) into the existing roster container; the recency and overdue signals and the overall flag are separate stories.
- **Testable:** The up / down / flat / not-enough-data classification is a deterministic function of the normalized points inside the window, so each outcome is assertable through unit tests with fixed grade values and timestamps.

## Trend Definition

The trend for one student is computed deterministically from that student's normalized grade points. All four required rules are defined explicitly below:

1. **Comparison window length.** The window is the trailing 30 days ending at the current server time: every grade point whose `timemodified` falls at or after (current server time − 30 days) and at or before the current server time is in window, and every point dated before the window start is ignored. Current values are read from `grade_grades` [public/lib/db/install.xml:L2041] and prior values from `grade_grades_history` [public/lib/db/install.xml:L2191].
2. **Normalization.** Each grade point is normalized to a percentage of its own grade item maximum — `finalgrade` divided by the row's recorded `rawgrademax`, multiplied by 100 — so points from items with different maxima are comparable. History rows carry their own `rawgrademax`, so each point is normalized against the maximum recorded at the time that grade was stored.
3. **Up / down / flat rule.** Let the change equal the latest in-window normalized value minus the earliest in-window normalized value, measured in percentage points. A change above the flat band is **up**; a change below the negative of the flat band is **down**.
4. **Tie rule (flat band).** A change whose absolute value is at or within 2 percentage points is **flat/steady** — neither up nor down. The 2-percentage-point flat band is the assessment-trend sensitivity owned by [FEATURE-001-02: Configurable Risk Thresholds](../FEATURE-001-02-configurable-risk-thresholds.md); this story consumes that value and applies the 2-percentage-point default when no per-course value is set.
5. **Not-enough-data rule.** A student with fewer than two normalized grade points inside the window yields the localized "Not enough data" state; this state is never rendered as a "down" trend.

## Acceptance Criteria

1. *(Input-validation / window and normalization)* **Given** a student with graded items, some with `timemodified` inside the trailing-30-day window and some dated before it, **When** the trend computes, **Then** it compares only the normalized values (`finalgrade` divided by the row's `rawgrademax`, times 100) whose `timemodified` falls inside the window and ignores every point dated before the window start. **Pass:** only in-window normalized points feed the classification. **Fail:** a point dated before the window start changes the result, or a raw grade is compared without normalization.
2. *(Expected-output / up)* **Given** a student whose earliest in-window normalized grade is 60% and whose latest in-window normalized grade is 72%, **When** the trend renders, **Then** the row shows an "up" trend with a text label and a directional icon. **Pass:** the row reads the localized "up" label paired with its rising icon. **Fail:** the row shows a flat, down, or "Not enough data" state.
3. *(Expected-output / down)* **Given** a student whose earliest in-window normalized grade is 80% and whose latest in-window normalized grade is 65%, **When** the trend renders, **Then** the row shows a "down" trend with a text label and a directional icon. **Pass:** the row reads the localized "down" label paired with its falling icon. **Fail:** the row shows a flat, up, or "Not enough data" state.
4. *(Boundary / flat tie)* **Given** a student whose latest in-window normalized grade is 70% and whose earliest is 68% — a change of 2 percentage points — against a 2-percentage-point flat band, **When** the trend computes, **Then** the row shows the "flat/steady" state, because a change at the flat-band edge is flat and the up state begins strictly beyond 2 percentage points. **Pass:** the 2-percentage-point change is flat and a change beyond 2 percentage points is up. **Fail:** the 2-percentage-point change is marked up, or a change beyond 2 percentage points is marked flat.
5. *(Edge-case / not enough data)* **Given** a student with fewer than two graded points inside the window, **When** the trend renders, **Then** the row shows the localized "Not enough data" state resolved through `get_string` and does not show a "down" trend. **Pass:** the row reads the localized "Not enough data" text and no down state is shown. **Fail:** the row shows "down", "up", "flat", or a blank cell.
6. *(Error-handling / orphaned grade)* **Given** a grade row whose grade item no longer exists, **When** the trend computes, **Then** it excludes that orphaned row, classifies the trend from the remaining in-window normalized points, and falls back to the localized "Not enough data" state when fewer than two valid points remain — without a fatal error. **Pass:** the orphaned row is excluded and the cell renders a trend state or the "Not enough data" state. **Fail:** the orphaned row is counted, or the render raises a fatal error.

## Edge Cases

- **Empty/Null Input:** A student with zero graded points in the window, a student with exactly one graded point, and a student whose only in-window grade has a NULL `finalgrade` (ungraded) each render the localized "Not enough data" state (via `get_string`); the NULL `finalgrade` point is excluded as ungraded and is never normalized.
- **Boundary Values:** A change whose absolute value equals the flat band exactly (2 percentage points) is flat; a point with `timemodified` exactly at the window start (current server time − 30 days) is in window; a student with exactly two in-window normalized points is classified (two points is the smallest set that yields up, down, or flat).
- **Invalid Input:** A point referencing an orphaned grade item is excluded; a point whose `rawgrademax` is 0 (a division-by-zero on normalization) is excluded; a normalized value below 0% or above 100% is clamped to the 0%-to-100% range before the change is measured.
- **Concurrent/Conflicting Operations:** A grade updated while the roster renders is resolved against one consistent snapshot taken at query time; the rendered trend reflects that single snapshot, and the next roster render incorporates the new grade value.

## Sub-tasks

- [ ] Query `grade_grades` for current values [public/lib/db/install.xml:L2041] and `grade_grades_history` for prior values [public/lib/db/install.xml:L2191] for the course's grade items and the roster's student set within the trailing-30-day window in one bounded query per source (no per-student query, no N+1) — @assignee
- [ ] Normalize each point to `finalgrade` divided by the row's `rawgrademax` times 100, exclude NULL `finalgrade` and zero-`rawgrademax` rows, and order the surviving points by `timemodified` — @assignee
- [ ] Classify up / down / flat / not-enough-data per the defined window, flat band, and fewer-than-two-points rule, consuming the assessment-trend sensitivity from [FEATURE-001-02](../FEATURE-001-02-configurable-risk-thresholds.md) (the default value when unset) — @assignee
- [ ] Render the localized trend label, the directional icon with its text alternative, and the "Not enough data" state through `get_string` and the `lang/en/block_engagement.php` language file — @assignee
- [ ] Add unit tests for the up, down, flat-tie, fewer-than-two-points, and orphaned-grade paths using fixed grade values and timestamps — @assignee

## Estimation

- **Effort:** Medium-High
- **Complexity:** High (history-window join, normalization across differing maxima, and the flat-band and fewer-than-two-points rules)
- **Uncertainty:** Medium-High
- **Story Points (Fibonacci):** 8

## Definition of Done

- [ ] The comparison window (trailing 30 days), the up / down / flat rule, the flat band (2 percentage points), and the not-enough-data rule (fewer than two in-window points) are all explicitly defined.
- [ ] Each grade point is normalized to a percentage of its grade item maximum before any comparison, so items with different maxima are comparable.
- [ ] The "Not enough data" state is never rendered as a "down" trend.
- [ ] Orphaned grade-item rows and NULL `finalgrade` rows are excluded from the classification.
- [ ] The trend for the whole roster is read in bounded queries over the roster's student set with no N+1 access pattern.
- [ ] The assessment-trend sensitivity is consumed from [FEATURE-001-02: Configurable Risk Thresholds](../FEATURE-001-02-configurable-risk-thresholds.md) with a fallback to the default when no per-course value is set.
- [ ] Every user-facing string flows through `get_string`.
- [ ] The trend is conveyed by a text label together with a directional icon (not by color alone and not by icon alone) and is keyboard reachable within the roster table (WCAG 2.1 AA).
- [ ] All acceptance criteria pass.
- [ ] Unit tests for the up, down, flat-tie, fewer-than-two-points, and orphaned-grade paths pass.
- [ ] The relative up-links to the parent feature and the epic resolve, and the sibling-story and sibling-feature links resolve.
- [ ] The trend is computed from observed `grade_grades` and `grade_grades_history` data and does not couple to the machine-learning Predictive Analytics Engine.

## Notes

- **Internationalization (I9):** Every user-facing string — the "up", "down", and "flat/steady" trend labels and the "Not enough data" state — flows through `get_string` and the plugin language pack (`lang/en/block_engagement.php`). No string is hardcoded in the markup.
- **Accessibility (I7):** The trend is conveyed by a text label paired with a directional icon, never by color alone and never by icon alone; the icon carries an accessible text alternative, the cell is keyboard reachable within the semantic roster table specified by [STORY-001-01-01: Display Engagement Roster](STORY-001-01-01-display-engagement-roster.md), and text contrast meets the WCAG 2.1 AA minimum ratio of 4.5:1.
- **Deterministic boundary (I11):** The trend is a plain comparison of normalized values drawn from the observed `grade_grades` [public/lib/db/install.xml:L2041] and `grade_grades_history` [public/lib/db/install.xml:L2191] tables. This story does not couple to Moodle's machine-learning Predictive Analytics Engine; the up / down / flat / not-enough-data result is a deterministic classification, not a model prediction.
- **Dependencies:** This story consumes the assessment-trend sensitivity owned by [FEATURE-001-02: Configurable Risk Thresholds](../FEATURE-001-02-configurable-risk-thresholds.md) (the flat-band magnitude, with the FEATURE-001-02 default applied when no per-course value is set), and it renders its cell into the roster container specified by [STORY-001-01-01: Display Engagement Roster](STORY-001-01-01-display-engagement-roster.md). The student set is the roster's bounded enrolled-student set; this story does not re-query the enrolment API. The overall risk flag that aggregates this signal is specified by STORY-001-01-05, and the query that builds this trend is bounded by the performance budget owned by STORY-001-03-03. Restating the threshold-configuration UI and the roster container here is out of scope, which preserves INVEST Independence.
- **Out-of-scope reminder (verbatim v1 exclusion):**

> predictive modeling

  The trend is a deterministic comparison of recorded grade values; training or applying a predictive model is out of scope for v1.
