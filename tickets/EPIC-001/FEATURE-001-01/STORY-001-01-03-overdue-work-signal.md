# STORY-001-01-03: Overdue-Work Signal

- **Story ID:** STORY-001-01-03
- **Parent Feature:** [FEATURE-001-01: In-Course Engagement Overview](../FEATURE-001-01-in-course-engagement-overview.md)
- **Epic:** [EPIC-001: Surface Student Engagement Risk on the Course Page](../../EPIC-001-student-engagement-risk-visibility.md)
- **Type:** User Story
- **Requirement:** R2b — whether each student has assignment work past its due date
- **Status:** Draft / Ready for Refinement

## User Story

**As a** Non-editing Teacher, **I want** each student's row to show a count of overdue assignment items, **so that** I can identify students with past-due work and follow up before grades are affected.

The quantifiable benefit: one per-student overdue count replaces opening each assignment's submission screen one by one to check who has not handed in. This story specifies the **overdue-work signal cell only** — one cell per student that renders into the roster container owned by [STORY-001-01-01: Display Engagement Roster](STORY-001-01-01-display-engagement-roster.md). The cell counts, for one student, the assignment items in the course that are past due with no accepted submission, computed deterministically from `mod_assign` data.

The **overdue rule** is defined as follows. For one student and one `assign` instance in the course:

- The base due date is `assign.duedate` [public/mod/assign/db/install.xml:L19]. A `duedate` of 0 means the assignment has no due date, and that assignment is excluded from overdue evaluation for every student.
- The per-user extension is `assign_user_flags.extensionduedate` [public/mod/assign/db/install.xml:L139] for that student and that assignment.
- The **effective due date** is the student's `extensionduedate` when it is set (greater than 0) and later than `duedate`; otherwise it is `duedate`.
- The assignment is **overdue** for the student when the effective due date is greater than 0, the current time is strictly after the effective due date, and the student's latest `assign_submission` attempt has no `SUBMITTED` status. A `DRAFT` status does not clear an overdue item; only a latest `SUBMITTED` attempt clears it.
- Where a `cutoffdate` is set (greater than 0) [public/mod/assign/db/install.xml:L25], it bounds late acceptance: once the cutoff time has passed, the student can no longer submit without a fresh extension, so an item that is overdue past its cutoff stays overdue until an extension or a `SUBMITTED` attempt changes its state.

A course with zero `assign` instances renders a localized "No assignments" state through `get_string` and flags no student overdue. The overdue **tolerance** — how many or how old overdue items count as concerning — is owned by [FEATURE-001-02: Configurable Risk Thresholds](../FEATURE-001-02-configurable-risk-thresholds.md); this story produces the per-student overdue count and consumes that tolerance (or its shipped default), so the cell stays demonstrable before any threshold is adjusted.

## INVEST Justification

- **Independent:** The overdue count is computed from existing `assign` and `assign_submission` data using the default overdue tolerance from FEATURE-001-02, so the cell is demonstrable on its own — before the recency cell, the trend cell, or the overall flag is wired, and before a teacher adjusts a threshold.
- **Negotiable:** The presentation of the count — a bare number, the text "N overdue", or a count paired with the age of the oldest item — is open to refinement during backlog grooming; the WHO/WHAT/WHY is fixed.
- **Valuable:** One per-student overdue count replaces opening each assignment's submission screen one by one, so the Non-editing Teacher sees past-due work across the whole class from one place.
- **Estimable:** The scope is one bounded query over the course's `assign` instances joined to the per-user `extensionduedate` and the latest `assign_submission.status`, so the work is sizable from the known tables.
- **Small:** It delivers one signal cell — the overdue count — not the roster, the other two signals, or the overall risk flag.
- **Testable:** Overdue is a deterministic function of the effective due date, the current time, and the latest submission status, so each path is assertable through unit tests with fixed timestamps.

## Acceptance Criteria

1. *(Input-validation / due date presence)* **Given** an assignment whose `duedate` is 0 (no due date) [public/mod/assign/db/install.xml:L19], **When** the overdue signal computes for any student, **Then** that assignment is excluded from the overdue count. **Pass:** the no-due-date assignment adds 0 to every student's count. **Fail:** the no-due-date assignment adds to any student's count.
2. *(Expected-output / overdue counted)* **Given** an assignment whose `duedate` passed 2 days ago and a student with no `SUBMITTED` submission and no extension, **When** the signal renders, **Then** that assignment adds 1 to the student's overdue count and the row displays the localized text "1 overdue". **Pass:** the student's count is 1 and the cell reads "1 overdue". **Fail:** the count is not 1 or the cell text is absent.
3. *(Input-validation / extension honored)* **Given** a student whose `extensionduedate` is set 5 days in the future for an assignment whose base `duedate` passed 2 days ago [public/mod/assign/db/install.xml:L139], **When** the signal computes, **Then** that assignment is excluded from the student's overdue count because the effective due date has not passed. **Pass:** the assignment adds 0 to that student's count. **Fail:** the assignment adds 1 to that student's count.
4. *(Expected-output / submission clears)* **Given** an assignment 1 day past its due date, a student A whose latest `assign_submission` status is `SUBMITTED`, and a student B whose latest status is `DRAFT`, **When** the signal computes, **Then** the assignment is excluded from student A's count and included in student B's count. **Pass:** student A's count excludes the item and student B's count includes it. **Fail:** the `SUBMITTED` item is counted for student A or the `DRAFT` item is excluded for student B.
5. *(Edge-case / no assignments)* **Given** a course with zero `assign` instances, **When** the signal renders, **Then** it shows the localized "No assignments" state returned by `get_string` and flags no student overdue. **Pass:** the "No assignments" text renders and every overdue count is 0. **Fail:** an overdue count is greater than 0 or the "No assignments" text is absent.
6. *(Error-handling / orphaned data)* **Given** an `assign_submission` row that references a deleted `assign` instance, **When** the signal computes, **Then** it excludes the orphaned row and renders the remaining overdue count without a fatal error. **Pass:** the orphaned row is ignored and the cell renders a numeric count. **Fail:** the orphaned row is counted or the render raises a fatal error.
7. *(Boundary / effective due date exactly now)* **Given** an assignment whose effective due date equals the current time to the second, **When** the signal computes, **Then** the item is not overdue, because an item becomes overdue strictly after the effective due date passes. **Pass:** the item adds 0 at the exact effective due date and adds 1 one second later. **Fail:** the item is counted at the exact effective due date.

## Edge Cases

- **Empty/Null Input:** A course with zero `assign` instances renders the localized "No assignments" state (via `get_string`) and flags no student overdue. A student with no `assign_submission` rows at all is evaluated against the effective due date alone, so each past-due assignment with no submission counts as overdue for that student.
- **Boundary Values:** An effective due date that equals the current time to the second is not overdue (overdue begins strictly after it passes). A `cutoffdate` that equals the current time to the second bounds late acceptance from the next second onward. An `extensionduedate` equal to the base `duedate` leaves the effective due date unchanged, because the extension is honored only when it is later than `duedate`.
- **Invalid Input:** An orphaned `assign_submission` row that references a deleted `assign` instance is excluded from the count without a fatal error. A negative `duedate` is treated as a Unix timestamp before the epoch (a past time) and evaluated against the strictly-after rule like any other past due date.
- **Concurrent/Conflicting Operations:** A student who submits an assignment while the roster is rendering is resolved against one consistent snapshot taken at query time; the current render reflects that single snapshot, and the next render shows the item cleared once the `SUBMITTED` status is committed.

## Sub-tasks

- [ ] Load the course's `assign` instances and their `duedate` and `cutoffdate` in one bounded query [public/mod/assign/db/install.xml:L19,L25] — @assignee
- [ ] Join the per-user `assign_user_flags.extensionduedate` [public/mod/assign/db/install.xml:L139] and the latest `assign_submission.status` for the roster's student set without an N+1 access pattern — @assignee
- [ ] Compute the effective due date and the overdue count per student per the defined rule (extension honored when later than `duedate`; only a latest `SUBMITTED` attempt clears the item) — @assignee
- [ ] Render the localized overdue count and the "No assignments" state through `get_string` and the plugin language pack — @assignee
- [ ] Add unit tests for the extension-honored, submission-clears, no-assignments, and orphaned-row paths using fixed timestamps — @assignee

## Estimation

- **Effort:** Medium
- **Complexity:** Medium-High (per-user extension join plus latest-submission resolution across every assignment in the course)
- **Uncertainty:** Medium
- **Story Points (Fibonacci):** 5

## Definition of Done

- [ ] The effective-due-date rule is defined across `duedate`, `extensionduedate`, and `cutoffdate`, and a `duedate` of 0 excludes the assignment from overdue evaluation.
- [ ] Only a latest `SUBMITTED` submission clears an overdue item; a `DRAFT` does not.
- [ ] The "No assignments" state and the orphaned-submission path are handled without a fatal error.
- [ ] The overdue count is built with bounded queries and no N+1 access pattern.
- [ ] The overdue tolerance is consumed from [FEATURE-001-02: Configurable Risk Thresholds](../FEATURE-001-02-configurable-risk-thresholds.md) with its shipped default, so the cell is demonstrable before any threshold is adjusted.
- [ ] Every user-facing string flows through `get_string`.
- [ ] All acceptance criteria pass.
- [ ] Unit tests for the extension-honored, submission-clears, no-assignments, and orphaned-row paths pass.
- [ ] The relative up-links to the parent feature and the epic resolve, and the sibling links to STORY-001-01-01 and FEATURE-001-02 resolve.
- [ ] The overdue count is computed from observed `mod_assign` data and does not couple to the machine-learning Predictive Analytics Engine.

## Notes

- **Internationalization (I9):** Every user-facing string — the overdue count text and the "No assignments" state — flows through `get_string` and the plugin language pack (`lang/en/block_engagement.php`). No string is hardcoded in the markup.
- **Accessibility (I7):** The overdue count is conveyed as text (for example "2 overdue"), never by color alone, is keyboard reachable, and meets WCAG 2.1 AA with a minimum 4.5:1 text contrast ratio.
- **Deterministic boundary (I11):** The overdue count is computed from observed `mod_assign` data — `duedate`, `cutoffdate`, `extensionduedate`, and submission status — and does not couple to Moodle's machine-learning Predictive Analytics Engine.
- **Dependency note:** This cell consumes the overdue tolerance owned by [FEATURE-001-02: Configurable Risk Thresholds](../FEATURE-001-02-configurable-risk-thresholds.md) — with the FEATURE-001-02 default preserving INVEST Independence — and renders into the roster container specified by [STORY-001-01-01: Display Engagement Roster](STORY-001-01-01-display-engagement-roster.md). The overall risk flag that aggregates this signal is specified by STORY-001-01-05, and the query that builds this count is bounded by the performance budget owned by STORY-001-03-03.
- **Out-of-scope reminder (verbatim v1 exclusion):**

> Automated notifications or alerts to teachers

  The overdue count surfaces past-due work on the roster; sending the teacher an automated alert about it is out of scope for v1.
