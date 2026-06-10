# EPIC-001: Deliver the Class Pulse course block that surfaces four per-student engagement signals so Course Teachers can identify and act on student disengagement early

## Epic Summary

Class Pulse is a course-level Moodle block that lists every enrolled student in a single course alongside four fixed engagement signals: days since the student's last site login, the count of currently overdue assignments in this course, the directional trend (up, flat, or down) derived from the student's last three quiz attempt scores in this course, and the timestamp of the student's last interaction with any activity in this course. Each student row is rendered as a risk highlight that is color-coded against teacher-configurable per-instance thresholds, and selecting a student row opens that student's existing course profile page. The block reads only data that already lives in Moodle and presents it on one course-level screen so a Course Teacher sees engagement at a glance without running separate reports.

**Business Value:** Class Pulse lets a Course Teacher identify disengaging students early by consolidating engagement signals that already exist in Moodle into one course-level view, with no new data collection and no new database tables. Surfacing early indicators of disengagement supports timely teacher outreach and student retention while keeping every engagement signal grounded in data the Course Teacher is already authorized to see.

### Scope Boundaries

**Non-functional constraints (these govern the whole epic and constrain every Feature and User Story):**

- **Authorization** — the block displays only data the viewing role is authorized to see; every engagement signal respects existing Moodle role capabilities and course enrolment.
- **Read-only, no new tables in v1** — Class Pulse computes all four engagement signals from existing Moodle tables and introduces no new database tables in v1.
- **Performance budget** — the block renders within 2 seconds for a course with up to 50 enrolled students.
- **Opt-in per course** — Class Pulse is added on a per-course basis through standard Moodle block placement; it is not switched on globally by default.

**v1 exclusions (intentionally deferred — out of scope for this epic):**

- Notifications or emails to teachers.
- Parent/guardian visibility.
- Cross-course aggregation.
- Predictive at-risk modeling.
- Configurable selection of which signals appear (the four engagement signals are fixed in v1).

## Features Index

The Class Pulse objective decomposes into three Features that together hold fourteen User Stories (4 + 5 + 5).

| Feature | Description | Stories |
|---------|-------------|---------|
| [FEATURE-001-01: Block Scaffold & Placement](./EPIC-001/FEATURE-001-01-block-scaffold-and-placement.md) | Foundational Moodle block contract: the `block_base` subclass, `version.php`, access capabilities, opt-in per-course placement, and the privacy provider. | 4 |
| [FEATURE-001-02: Engagement Signal Computation & Roster](./EPIC-001/FEATURE-001-02-engagement-signal-computation.md) | Read-only data layer: the enrolled-student roster plus the four engagement signals, each computed from existing Moodle tables with no new schema. | 5 |
| [FEATURE-001-03: Risk Visualization, Threshold Configuration & Interaction](./EPIC-001/FEATURE-001-03-risk-visualization-and-configuration.md) | Presentation and interaction layer: the Mustache engagement table, per-instance threshold configuration, threshold-driven risk highlighting, client-side sort and filter, and click-through to the student course profile. | 5 |

**Total: 3 Features, 14 User Stories.**

## Dependencies

Class Pulse relies on the following Moodle 5.2 core subsystems. These are external platform dependencies that the block consumes — they are documentation context only and are not new packages introduced by this epic. No code in these subsystems is changed by this epic.

- **Core block API** — block lifecycle, instance configuration, and `applicable_formats` placement (block class extending `block_base`).
- **Enrolment / `user`** — the enrolled-student roster and the `user.lastlogin` field behind the last-login engagement signal.
- **mod_assign** — assignment due dates and submission status behind the overdue-assignments engagement signal.
- **mod_quiz** — quiz attempt grades behind the quiz score-trend engagement signal.
- **Logstore (`report/log`)** — activity-log data behind the last-interaction engagement signal.
- **Privacy subsystem** — the privacy provider that declares the external Moodle sources the block reads and confirms no new personal data is stored.
- **Output / Mustache renderer** — rendering the per-student engagement table.
- **AMD / RequireJS** — client-side column sorting and row filtering on the rendered table.

## Definition of Done

- [ ] All 3 Features are authored and linked from this Epic's Features Index, and every Features Index link resolves to an authored file.
- [ ] All 14 User Stories are authored across the three Features (4 + 5 + 5).
- [ ] Every User Story satisfies the six INVEST principles (Independent, Negotiable, Valuable, Estimable, Small, Testable) and is demonstrable for Product Owner acceptance.
- [ ] Every User Story carries 4–8 acceptance criteria in Given/When/Then form, with required coverage of one input-validation scenario, one valid-output scenario, one error-handling scenario, and one edge/boundary scenario.
- [ ] Every User Story enumerates 3–5 edge cases spanning Empty/Null Input, Boundary Values, Invalid Input, and Concurrent/Conflicting Operations where applicable.
- [ ] Zero forbidden terms (approximately, several, various, adequate, appropriate, properly, correctly, efficiently, quickly, easily, user-friendly, reasonable, sufficient) appear in any acceptance criterion across the tree.
- [ ] Every User Story names a concrete actor (for example Course Teacher, Site Administrator, Moodle Plugin Developer, Data Protection Officer) rather than a generic "user."
- [ ] Every Epic → Feature → Story relative link resolves to an authored file, and the `EPIC-001` / `FEATURE-001-NN` / `STORY-001-NN-SS` naming convention with kebab-case slugs is honored throughout.
- [ ] The four non-functional constraints — authorization, read-only with no new tables, the 2-second render budget for up to 50 enrolled students, and opt-in per-course placement — are captured as acceptance criteria on the relevant User Stories.
- [ ] The five v1 exclusions (notifications/emails; parent/guardian visibility; cross-course aggregation; predictive at-risk modeling; configurable signal selection) are recorded as explicit scope-boundary notes in this Epic and the relevant Features.
- [ ] Every User Story includes an Effort / Complexity / Uncertainty assessment with a Fibonacci point estimate (1, 2, 3, 5, 8, 13) and a story-level Definition of Done.

## Key Citations

- Source: public/version.php — Moodle 5.2dev (Build: 20251024), branch 502, MATURITY_ALPHA; webroot consolidated under `public/`, validating the `public/blocks/classpulse/` plugin path the tickets describe.
- Source: public/blocks/accessreview — standard Moodle block contract analog (block class extending `block_base`, `version.php`, `db/access.php`, `lang/en/*`, `classes/privacy/provider.php`, `templates/*.mustache`, `amd/src` plus `amd/build`, and a `pix/` icon) that Class Pulse mirrors.
- Source: public/blocks/accessreview/db/access.php — capability model analog (`addinstance` write capability plus `view` read capability at `CONTEXT_BLOCK`) for the Class Pulse access capabilities.
