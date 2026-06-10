# STORY-001-02-04: Compute quiz-score-trend signal

## User Story

**As a** Course Teacher,
**I want** each student's directional trend (up, flat, or down) derived from their last three quiz attempt scores in this course,
**So that** I can see whether a student's quiz performance is improving or declining.

This story documents the third of the four engagement signals in FEATURE-001-02: the directional trend — up, flat, or down — derived from each enrolled student's last three quiz attempt scores in this course. The Quiz module records quiz attempts and their grades, so the trend is computed from the most recent three attempt scores for the student in this course (Source: public/mod/quiz). The signal is computed per roster row produced by STORY-001-02-01, so the enrolled-student roster must exist before the trend is attached to a student. When a student has fewer than three quiz attempts, the signal resolves to the defined neutral insufficient-data state rather than an error, because a direction cannot be derived from fewer than three scores. The signal is read-only — it reads quiz attempt grades and introduces no new database table in v1 — and it is shown only to a viewer gated by the role's existing Moodle capabilities, mirroring the verified `block_accessreview` analog that gates its content at render time with `if (!isloggedin() || isguestuser() || !has_capability('block/accessreview:view', $context))`; Class Pulse applies the same gate with `block/classpulse:view`.

The trend maps the ordered last-three-attempt score sequence to a direction as follows:

| Score sequence (oldest → newest of last three) | Direction |
|-------------------------------------------------|-----------|
| Rising (each later score higher than the prior) | up |
| Equal (all three scores the same) | flat |
| Falling (each later score lower than the prior) | down |
| Fewer than three attempts recorded | defined neutral insufficient-data state |

## Acceptance Criteria

Each scenario is authored in Given/When/Then form, mirrors the repository Gherkin convention (Source: `.gherkin-lintrc`; canonical narrative in `public/blocks/accessreview/tests/behat/accessreview.feature`), and resolves to a binary pass or fail outcome. Scenarios 1, 2, 5, and 6 provide the required coverage (valid output, input validation, error handling, edge/boundary); Scenarios 3 and 4 are the cross-cutting authorization and read-only criteria carried by every signal story.

**Scenario 1 — Declining quiz performance shows a down trend (valid output)**

- **Given** a student whose last three quiz attempt scores in this course are 80, 70, and 60,
- **When** the quiz-score trend is computed,
- **Then** the engagement signal shows a down trend.

**Scenario 2 — Fewer than three quiz attempts (input validation)**

- **Given** a student with fewer than three quiz attempts in this course,
- **When** the quiz-score trend is computed,
- **Then** the signal shows the defined neutral insufficient-data state and not an error.

**Scenario 3 — Viewer without the view capability sees no trend (authorization)**

- **Given** a viewer who lacks `block/classpulse:view` in the block context,
- **When** the course page renders,
- **Then** no quiz-score trend is shown for any student.

**Scenario 4 — Signal is read-only and adds no table (read-only / no new tables)**

- **Given** the quiz-score trend reads quiz attempt grades,
- **When** the trend is computed,
- **Then** the attempt data is read without modification and no new database table is created.

**Scenario 5 — No attempt data returned for a student (error handling)**

- **Given** the quiz subsystem returns no attempt data for a student,
- **When** the block renders,
- **Then** the trend shows the defined neutral insufficient-data state and no error is surfaced to the Course Teacher.

**Scenario 6 — Equal scores resolve to a flat trend (edge/boundary)**

- **Given** a student whose last three quiz attempt scores in this course are equal,
- **When** the quiz-score trend is computed,
- **Then** the engagement signal shows a flat trend.

## Sub-Tasks

- [ ] Read the last three quiz attempt scores per enrolled student in the course @assignee
- [ ] Order the three scores by attempt sequence and derive the up / flat / down direction from them @assignee
- [ ] Map fewer-than-three attempts to the defined neutral insufficient-data state @assignee
- [ ] Surface the trend (or the neutral state) per roster row to the renderer @assignee

## Edge Cases

- **Empty/Null Input** — a student with zero quiz attempts in this course: the signal shows the defined neutral insufficient-data state and not an error.
- **Boundary Values** — a student with exactly three quiz attempts: the three scores are ordered and compared to yield an up, flat, or down direction.
- **Boundary Values** — three equal scores: the trend resolves to a flat direction.
- **Concurrent/Conflicting Operations** — a new quiz attempt is submitted while the block is rendering: the trend reflects a single consistent read of the attempt data taken during that render and raises no error.

## Dependencies

- **Prerequisite story — STORY-001-01-01 (scaffold).** The `block_classpulse` scaffold must exist before any engagement signal is computed, so this story depends on [STORY-001-01-01](../FEATURE-001-01/STORY-001-01-01-scaffold-block-plugin-skeleton.md).
- **Prerequisite story — STORY-001-02-01 (roster).** The quiz-score trend is computed per roster row, so the enrolled-student roster must be built first; this story depends on [STORY-001-02-01](./STORY-001-02-01-build-enrolled-student-roster.md).
- **Feature dependency — FEATURE-001-02 depends on FEATURE-001-01.** This story belongs to FEATURE-001-02 (Engagement Signal Computation & Roster), which depends on the block scaffold, capability model, and placement delivered by FEATURE-001-01.
- **External platform dependency (documentation context only — no code is changed).** The signal reads the Moodle Quiz module's attempt grades; no `mod_quiz` code is modified.

## Estimation

| Dimension | Assessment | Rationale |
|-----------|------------|-----------|
| Effort | Medium | Reading the last three quiz attempt scores per roster row, ordering them by attempt sequence, and deriving a single direction from the three values. |
| Complexity | Medium | The trend orders each student's most recent attempts and compares three scores to yield up, flat, or down, plus the fewer-than-three-attempts neutral mapping; it goes beyond a single-field read but uses no cross-subsystem aggregation. |
| Uncertainty | Low | Quiz attempts and their grades are recorded by the Quiz module (verified in this repository, `public/mod/quiz/lib.php`), and the capability gate mirrors an existing analog block. |

**Effort Medium, Complexity Medium, Uncertainty Low → 3 points.**

Story point estimate: 3 (Fibonacci).

## Definition of Done

- [ ] The trend reflects the student's last three quiz attempt scores in this course.
- [ ] The up, flat, and down directions are each defined: a rising sequence shows up, equal scores show flat, and a falling sequence shows down.
- [ ] The fewer-than-three-attempts case resolves to the defined neutral insufficient-data state rather than an error.
- [ ] An authorization acceptance criterion is present: a viewer who lacks `block/classpulse:view` sees no quiz-score trend for any student.
- [ ] A read-only / no-new-tables acceptance criterion is present: quiz attempt data is read without modification and no new database table is created.
- [ ] The signal is computed per enrolled student in the roster delivered by STORY-001-02-01.
- [ ] The story satisfies the six INVEST principles (Independent, Negotiable, Valuable, Estimable, Small, Testable) and is demonstrable for Product Owner acceptance.
- [ ] The story carries 4–8 acceptance criteria in Given/When/Then form covering one valid-output, one input-validation, one error-handling, and one edge/boundary scenario, plus the authorization and read-only criteria, each with a binary pass/fail outcome.
- [ ] The story enumerates 3–5 edge cases spanning Empty/Null Input, Boundary Values, Invalid Input, and Concurrent/Conflicting Operations where applicable.
- [ ] Zero forbidden terms appear in any acceptance criterion.
- [ ] Key Citations reference the grounding Moodle source paths.

## Key Citations

- Source: public/mod/quiz — quiz attempt grades behind the quiz-score-trend signal; the directional trend (up, flat, or down) is derived from the student's last three quiz attempt scores in this course.
- Source: public/blocks/accessreview/block_accessreview.php — the render-time gate `if (!isloggedin() || isguestuser() || !has_capability('block/accessreview:view', $context))` that the quiz-score-trend signal mirrors with `block/classpulse:view`.

[⬅ Back to FEATURE-001-02](../FEATURE-001-02-engagement-signal-computation.md)
