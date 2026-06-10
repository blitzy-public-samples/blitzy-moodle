# FEATURE-001-02: Engagement Signal Computation & Roster

## Feature Summary

Engagement Signal Computation & Roster is the read-only data layer of Class Pulse: it builds the roster of every student enrolled in one course and computes four fixed engagement signals per student, each read from existing Moodle tables with no new database tables in v1. The four engagement signals are (1) the number of days since the student's last site login, read from the `user.lastlogin` field; (2) the count of currently overdue assignments in this course, derived from assignment due dates and submission status in the Assignment module; (3) the directional trend — up, flat, or down — computed from the student's last three quiz attempt scores in this course, read from the Quiz module; and (4) the timestamp of the student's last interaction with any activity in this course, read from the standard log store and per-course last-access tracking. This feature consumes the block scaffold delivered by FEATURE-001-01 and feeds the risk highlight rendering and threshold configuration delivered by FEATURE-001-03, presenting every engagement signal to the Course Teacher gated by the viewing role's existing Moodle capabilities so that the teacher sees only data the role is authorized to see.

### Scope Boundaries

This feature is the data layer only. It builds the roster and computes the four engagement signals — it does **not** render the engagement table, does **not** color-code any row against a threshold, and does **not** expose a threshold configuration form (those behaviors are delivered by FEATURE-001-03).

The v1 scope boundaries that govern this feature are reaffirmed here:

- **Read-only, no new database tables** — all four engagement signals are computed from data that already exists in Moodle. This feature introduces no new database tables and writes nothing back to any subsystem it reads.
- **Fixed signal set** — the four engagement signals are fixed in v1. There is no configurable selection of which signals appear, and no signal can be added, removed, or reordered through configuration.
- **Single-course scope** — every engagement signal is scoped to the one course that hosts the block instance; cross-course aggregation is excluded from v1.
- **No predictive modeling** — the feature surfaces measured engagement signals only; predictive at-risk modeling is excluded from v1.

## User Stories Index

This feature decomposes into five User Stories, each authored under the sibling `./FEATURE-001-02/` directory. Every index link below MUST resolve to an authored Story file; a broken or missing link is a completeness defect.

| Story | Description |
|-------|-------------|
| [STORY-001-02-01: Build enrolled-student roster](./FEATURE-001-02/STORY-001-02-01-build-enrolled-student-roster.md) | List every student enrolled in the course, gated by the viewing role's capabilities, and carry the render-within-2-seconds budget for a course with up to 50 enrolled students. |
| [STORY-001-02-02: Compute last-login signal](./FEATURE-001-02/STORY-001-02-02-compute-last-login-signal.md) | Compute the number of days since each student's last site login from the `user.lastlogin` field, including the never-logged-in case where `lastlogin` is 0. |
| [STORY-001-02-03: Compute overdue-assignments signal](./FEATURE-001-02/STORY-001-02-03-compute-overdue-assignments-signal.md) | Count each student's currently overdue assignments in this course from assignment due dates and submission status, excluding assignments that have no due date. |
| [STORY-001-02-04: Compute quiz-score-trend signal](./FEATURE-001-02/STORY-001-02-04-compute-quiz-score-trend-signal.md) | Derive the up, flat, or down trend from each student's last three quiz attempt scores in this course, including the fewer-than-three-attempts case. |
| [STORY-001-02-05: Compute last-interaction signal](./FEATURE-001-02/STORY-001-02-05-compute-last-interaction-signal.md) | Read the timestamp of each student's last interaction with any activity in this course from the log store, including the no-interaction case. |

## Dependencies

- **Feature prerequisite — FEATURE-001-01 (Block Scaffold & Placement).** The block scaffold, capability model, and opt-in per-course placement must exist before any engagement signal is computed, so this feature depends on [FEATURE-001-01](./FEATURE-001-01-block-scaffold-and-placement.md).
- **Intra-feature dependency — all five child stories depend on STORY-001-01-01 (scaffold).** Every story computes data inside the block instance, so the scaffold must exist first.
- **Roster prerequisite — the four signal stories depend on STORY-001-02-01 (roster).** STORY-001-02-02, STORY-001-02-03, STORY-001-02-04, and STORY-001-02-05 each compute a per-student engagement signal, so the enrolled-student roster must be built before any signal is computed.
- **External platform dependencies (documentation context only — no code in these subsystems is changed).** This feature reads enrolment / `user` (the roster and the `user.lastlogin` field), `mod_assign` (assignment due dates and submission status), `mod_quiz` (quiz attempt grades), and the logstore exposed through `report/log` (activity-log data and per-course last access).
- **Downstream dependent — FEATURE-001-03 consumes this feature.** The risk highlight rendering, threshold configuration, and threshold-driven color-coding in FEATURE-001-03 consume the roster and four engagement signals computed here.

## Definition of Done

- [ ] All 5 User Stories in this feature are authored and linked from the User Stories Index, and every index link resolves to an authored file.
- [ ] The enrolled-student roster lists every student enrolled in the course and carries the render-within-2-seconds criterion for a course with up to 50 enrolled students (STORY-001-02-01).
- [ ] Each of the four engagement signals is documented as an independently estimable story that reads its named Moodle subsystem read-only and introduces no new database tables: the last-login signal from `user.lastlogin` (STORY-001-02-02), the overdue-assignments signal from `mod_assign` (STORY-001-02-03), the quiz score-trend signal from `mod_quiz` (STORY-001-02-04), and the last-interaction signal from the logstore (STORY-001-02-05).
- [ ] Each signal story documents its required edge case: never-logged-in where `lastlogin` is 0 (STORY-001-02-02); an assignment with no due date excluded from the overdue count (STORY-001-02-03); fewer than three quiz attempts (STORY-001-02-04); and no recorded activity interaction (STORY-001-02-05).
- [ ] An authorization acceptance criterion stating the block exposes only data the viewing role is authorized to see appears on each signal story, and a read-only / no-new-tables acceptance criterion appears across the signal stories.
- [ ] Every User Story satisfies the six INVEST principles (Independent, Negotiable, Valuable, Estimable, Small, Testable) and is demonstrable for Product Owner acceptance.
- [ ] Every User Story carries 4–8 acceptance criteria in Given/When/Then form, with required coverage of one input-validation scenario, one valid-output scenario, one error-handling scenario, and one edge/boundary scenario.
- [ ] Every User Story enumerates 3–5 edge cases spanning Empty/Null Input, Boundary Values, Invalid Input, and Concurrent/Conflicting Operations where applicable.
- [ ] Zero forbidden terms (approximately, several, various, adequate, appropriate, properly, correctly, efficiently, quickly, easily, user-friendly, reasonable, sufficient) appear in any acceptance criterion.
- [ ] Every User Story names a concrete actor (for example Course Teacher, Site Administrator, Moodle Plugin Developer, Data Protection Officer) rather than a generic "user."
- [ ] Every User Story includes an Effort / Complexity / Uncertainty assessment with a Fibonacci point estimate (1, 2, 3, 5, 8, 13) and a story-level Definition of Done.

## Key Citations

- Source: public/lib/db/install.xml — the `user` table `lastlogin`, `lastaccess`, and `currentlogin` integer fields (a `lastlogin` value of 0 means never logged in) behind the last-login signal, and the `user_lastaccess` table that tracks per-course access times behind the last-interaction signal.
- Source: public/mod/assign — assignment due dates and submission status behind the overdue-assignments signal.
- Source: public/mod/quiz — quiz attempt grades behind the quiz score-trend signal.
- Source: public/report/log — the standard log store behind the last-interaction signal.

[⬅ Back to EPIC-001](../EPIC-001-classpulse-engagement-risk-block.md)
