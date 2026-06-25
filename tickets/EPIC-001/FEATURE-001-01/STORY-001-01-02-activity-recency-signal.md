# STORY-001-01-02: Activity-Recency Signal

- **Story ID:** STORY-001-01-02
- **Parent Feature:** [FEATURE-001-01: In-Course Engagement Overview](../FEATURE-001-01-in-course-engagement-overview.md)
- **Epic:** [EPIC-001: Surface Student Engagement Risk on the Course Page](../../EPIC-001-student-engagement-risk-visibility.md)
- **Type:** User Story
- **Requirement:** R2a — how recently each student was last active in the course
- **Status:** Draft / Ready for Refinement

## User Story

**As a** Non-editing Teacher, **I want** each student's roster row to show how many days have passed since that student was last active in this course, **so that** I can identify students inactive beyond the course's recency threshold and reach out before they fall behind.

This story specifies the **activity-recency signal cell** that renders inside each row of the roster container owned by [STORY-001-01-01: Display Engagement Roster](STORY-001-01-01-display-engagement-roster.md). It reads the course-scoped last-access time recorded for each enrolled student and converts it into a single days-since-last-active value, plus the two defined non-numeric states ("Never accessed" and "Last access unknown"). The student set is the roster's bounded enrolled-student set; this story reuses that set rather than re-querying the enrolment API.

The quantifiable benefit: one per-student last-active value, shown in the student's roster row, replaces manually scanning the participants list and the course access logs one student at a time to work out who has gone quiet.

## INVEST Justification

- **Independent:** The cell renders a per-student last-active value from the roster's student set and the default recency threshold even before any [FEATURE-001-02](../FEATURE-001-02-configurable-risk-thresholds.md) configuration is changed, so it is demonstrable to a Product Owner on its own.
- **Negotiable:** The relative-time wording and the stale-bucket labelling are open to refinement during backlog grooming; the WHO/WHAT/WHY is fixed but the presentation detail is not.
- **Valuable:** It gives the teacher one last-active value per student, removing the manual scan of the participants list and the access logs that the teacher performs today.
- **Estimable:** The scope is one bounded read of `user_lastaccess` over the known roster set plus subtraction arithmetic, so the work is sizable from the cited data source.
- **Small:** It delivers one signal cell (recency) into the existing roster container; the overdue and trend signals and the overall flag are separate stories.
- **Testable:** Recency is a deterministic function of `now − timeaccess`, so the day count, the never-accessed state, the unknown state, and the threshold boundary are assertable through unit tests.

## Acceptance Criteria

1. *(Input-validation / course scoping)* **Given** a student in the roster and the id of the course hosting the block, **When** the recency signal computes that student's last-active value, **Then** it reads `timeaccess` from the single `user_lastaccess` row whose `userid` and `courseid` match that student and that course [public/lib/db/install.xml:L956] and ignores every `user_lastaccess` row belonging to any other course. **Pass:** the value is read from the row matching the exact `(userid, courseid)` pair. **Fail:** the value is read from another course's row or from a site-wide last-access value.
2. *(Expected-output / engaged)* **Given** a student whose `timeaccess` is 3 days before the current server time and a recency threshold of 14 days, **When** the signal renders, **Then** the row shows the text "Last active 3 days ago" in the within-threshold (engaged) state. **Pass:** the row reads "Last active 3 days ago" and is not marked past the threshold. **Fail:** the day count is not 3, or the row is marked past the threshold.
3. *(Expected-output / stale)* **Given** a student whose `timeaccess` is 20 days before the current server time and a recency threshold of 14 days, **When** the signal renders, **Then** the row shows the text "Last active 20 days ago" marked as past the recency threshold. **Pass:** the row reads "Last active 20 days ago" and is marked past the threshold. **Fail:** the day count is not 20, or the row is not marked past the threshold.
4. *(Edge-case / never accessed)* **Given** a student who has no `user_lastaccess` row for the course, **When** the signal renders, **Then** the row shows the localized "Never accessed" state resolved through `get_string` and ranks the student in the most-stale recency bucket — not a blank cell and not a 0-day count. **Pass:** the row reads the localized "Never accessed" text and sorts into the most-stale bucket. **Fail:** the cell is blank, shows 0 days, or sorts ahead of any student who has a recorded last-access time.
5. *(Error-handling / invalid timestamp)* **Given** a `timeaccess` value that is negative or set after the current server time (a future timestamp), **When** the signal computes the day count, **Then** the row shows the localized "Last access unknown" state resolved through `get_string` and renders no negative day count. **Pass:** the row reads the localized "Last access unknown" text and no negative number is shown. **Fail:** a negative day count, a future-dated day count, or a raw timestamp is shown.
6. *(Boundary)* **Given** a student whose `timeaccess` is exactly 14 days before the current server time and a recency threshold of 14 days, **When** the signal classifies the value, **Then** the value at exactly 14 days is treated as within the threshold (engaged) and the past-threshold state begins strictly after 14 days. **Pass:** the 14-day value is within the threshold and a value greater than 14 days is past the threshold. **Fail:** the 14-day value is marked past the threshold, or a value greater than 14 days is marked within the threshold.

## Edge Cases

- **Empty/Null Input:** A student with no `user_lastaccess` row for the course has never opened it; the cell renders the localized "Never accessed" state (via `get_string`) and the student is placed in the most-stale recency bucket — never a blank cell and never a 0-day count.
- **Boundary Values:** A `timeaccess` exactly 14 days before the current server time with a 14-day threshold is within the threshold (engaged); the past-threshold state begins strictly after 14 days. A `timeaccess` equal to the current server time renders "Last active 0 days ago" (today) in the within-threshold state.
- **Invalid Input:** A `timeaccess` that is negative, or set after the current server time (future), or epoch-zero (`0`) while a `user_lastaccess` row exists, renders the localized "Last access unknown" state (via `get_string`) and never renders a negative day count.
- **Concurrent/Conflicting Operations:** A student who opens the course while the roster is rendering is resolved against one consistent snapshot taken at query time; the rendered value reflects that single snapshot, and the next roster render shows the updated last-active time.

## Sub-tasks

- [ ] Query `user_lastaccess` for the roster's student set in one bounded query keyed by `courseid` plus the userid list (no per-student query, no N+1) — @assignee
- [ ] Compute days-since-last-active as a whole-day count from (current server time − `timeaccess`) and compare it against the recency threshold consumed from [FEATURE-001-02](../FEATURE-001-02-configurable-risk-thresholds.md) (the default value when unset) — @assignee
- [ ] Render the localized relative-time label, the "Never accessed" state, and the "Last access unknown" state through `get_string` and the `lang/en/block_engagement.php` language file — @assignee
- [ ] Add unit tests for the recency arithmetic, the never-accessed path, the invalid-timestamp path, and the 14-day boundary rule — @assignee

## Estimation

- **Effort:** Low-Medium
- **Complexity:** Low (single table read plus subtraction arithmetic)
- **Uncertainty:** Low
- **Story Points (Fibonacci):** 3

## Definition of Done

- [ ] The signal reads the course-scoped `user_lastaccess` row matching the exact `(userid, courseid)` pair [public/lib/db/install.xml:L956] and ignores other courses' rows.
- [ ] The day count is computed as (current server time − `timeaccess`) in whole days.
- [ ] The "Never accessed" state is defined (no row for the course → most-stale bucket) and localized through `get_string`.
- [ ] The "Last access unknown" state is defined (negative, future, or epoch-zero-with-row `timeaccess`) and localized through `get_string`; no negative day count is ever rendered.
- [ ] The 14-day boundary rule is defined: a value at exactly the threshold is within range; past the threshold begins strictly after the threshold.
- [ ] The recency value for the whole roster is read in one bounded query (no N+1) over the roster's student set.
- [ ] The recency threshold is consumed from [FEATURE-001-02](../FEATURE-001-02-configurable-risk-thresholds.md) with a fallback to the default when no per-course value is set.
- [ ] Every user-facing string flows through `get_string`.
- [ ] The recency value is conveyed as text and is keyboard reachable within the roster table (WCAG 2.1 AA — meaning is not carried by color alone).
- [ ] All acceptance criteria pass.
- [ ] Unit tests for the recency arithmetic, the never-accessed path, the invalid-timestamp path, and the boundary rule pass.
- [ ] The relative up-links to the parent feature and the epic resolve, and the sibling-story and sibling-feature links resolve.
- [ ] The signal is computed from observed `user_lastaccess` data and does not couple to the machine-learning Predictive Analytics Engine.

## Notes

- **Internationalization (I9):** Every user-facing string — the relative-time label ("Last active N days ago"), the "Never accessed" state, and the "Last access unknown" state — flows through `get_string` and the plugin language pack (`lang/en/block_engagement.php`). No string is hardcoded in the markup, and the relative-time phrasing is rendered through a language-pack placeholder so it can be translated and pluralized per language.
- **Accessibility (I7):** The recency value is conveyed as text within the roster table cell, never by color alone, and is keyboard reachable as part of the semantic table specified by [STORY-001-01-01: Display Engagement Roster](STORY-001-01-01-display-engagement-roster.md). Text contrast meets the WCAG 2.1 AA minimum ratio of 4.5:1.
- **Deterministic boundary (I11):** The last-active value is computed from the observed `user_lastaccess.timeaccess` field [public/lib/db/install.xml:L956] as a subtraction from the current server time. This story does not couple to Moodle's machine-learning Predictive Analytics Engine; recency is a deterministic arithmetic result, not a model prediction.
- **Dependencies:** This story consumes the recency threshold owned by [FEATURE-001-02: Configurable Risk Thresholds](../FEATURE-001-02-configurable-risk-thresholds.md) (the activity-recency cutoff in days, with the FEATURE-001-02 default applied when no per-course value is set), and it renders its cell into the roster container specified by [STORY-001-01-01: Display Engagement Roster](STORY-001-01-01-display-engagement-roster.md). The student set is the roster's bounded enrolled-student set; this story does not re-query the enrolment API [public/lib/enrollib.php:L1536,L1664]. Restating the threshold-configuration UI and the roster container here is out of scope, which preserves INVEST Independence.
