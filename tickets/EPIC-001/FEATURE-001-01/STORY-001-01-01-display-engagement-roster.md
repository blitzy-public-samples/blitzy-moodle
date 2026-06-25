# STORY-001-01-01: Display Engagement Roster

- **Story ID:** STORY-001-01-01
- **Parent Feature:** [FEATURE-001-01: In-Course Engagement Overview](../FEATURE-001-01-in-course-engagement-overview.md)
- **Epic:** [EPIC-001: Surface Student Engagement Risk on the Course Page](../../EPIC-001-student-engagement-risk-visibility.md)
- **Type:** User Story
- **Requirement:** R1 — a single in-course overview that lists each enrolled student
- **Status:** Draft / Ready for Refinement

## User Story

**As a** Non-editing Teacher, **I want** a single course-page roster that lists each enrolled student holding the student role, **so that** I can review all students in one place instead of opening the gradebook, the activity logs, and the assignment submission screens separately.

An **Editing Teacher** adds and places the engagement block on the course page, which makes the roster opt-in per course; once the block is present, a **Non-editing Teacher** who holds the required course-context permissions views the roster to decide whom to contact first. The quantifiable benefit: one consolidated course-page view replaces three separate screens — the gradebook, the activity logs, and the assignment submission screens.

This story specifies the **roster container only**. It is the table into which the three per-student signal cells (recency, overdue, trend) and the overall risk flag render; those cells are owned by sibling stories and are out of scope here.

## INVEST Justification

- **Independent:** The story is demonstrable on its own — it renders the enrolled-student list before the signal cells and the flag are wired, because each signal cell shows its own empty state owned by STORY-001-01-02, STORY-001-01-03, and STORY-001-01-04.
- **Negotiable:** The column set and the row ordering are open to refinement during backlog grooming; the WHO/WHAT/WHY is fixed but the presentation detail is not.
- **Valuable:** It gives the teacher one in-course list of every student to act on, removing the manual sweep across three screens.
- **Estimable:** The scope is one bounded enrolment query plus one table render within a single course context, so the work is sizable from the known APIs.
- **Small:** It delivers one roster container; the three signals and the overall flag are separate stories (STORY-001-01-02 through STORY-001-01-05).
- **Testable:** Row count and student-role scoping are deterministic and assertable through unit tests and a Behat test.

## Acceptance Criteria

1. *(Input-validation / role scoping)* **Given** a valid course context, **When** the block builds the roster, **Then** it includes only users whom the enrolment API reports as enrolled (`get_enrolled_users()` / `get_enrolled_sql()` [public/lib/enrollib.php:L1536,L1664]) and who are assigned the student role in that course context (the enrolled set intersected with `get_role_users()`, or equivalent role-assignment SQL keyed by the student role id [public/lib/accesslib.php:L4063]), and excludes every Editing Teacher, every Non-editing Teacher, and every non-student role. **Pass:** zero non-student rows appear. **Fail:** any teacher or non-student role appears as a row.
2. *(Expected-output)* **Given** a course with N students holding the student role, **When** the block renders, **Then** the roster displays exactly N data rows — one row per student — and each row shows the student's full name, one cell for each of the three signals (recency, overdue, trend), and one overall-flag cell. **Pass:** the data-row count equals N. **Fail:** the data-row count differs from N.
3. *(Expected-output / structure & accessibility)* **Given** the roster renders, **When** the rendered markup is inspected, **Then** it is one semantic `<table>` carrying a `<caption>` and a `scope="col"` attribute on every column header, wrapped in a Bootstrap Card, so a screen reader announces the caption and the column structure. **Pass:** one `<table>` with a `<caption>` and `scope="col"` headers exists inside the Card. **Fail:** the markup omits the caption, the header scope, or the single-table structure.
4. *(Edge-case / empty)* **Given** a course with zero students holding the student role, **When** the block renders, **Then** it shows the localized empty-state message returned by `get_string` and renders zero data rows while still rendering the Card and the table caption. **Pass:** zero data rows and the localized empty-state text are present. **Fail:** a data row renders or the empty-state text is absent.
5. *(Error-handling)* **Given** the enrolment query raises an exception, **When** the block renders, **Then** it shows one localized error message returned by `get_string`, renders zero partial rows, and exposes no other user's data. **Pass:** one localized error message and zero data rows. **Fail:** a partial row renders or raw exception text is shown.
6. *(Boundary / scale)* **Given** a course with 201 or more students holding the student role, **When** the block renders, **Then** it limits the first page to exactly 200 data rows and exposes a next-page control, and the response stays within the course-page performance budget owned by STORY-001-03-03 under [FEATURE-001-03](../FEATURE-001-03-optin-and-permission-respecting-access.md). **Pass:** page one holds exactly 200 rows and a next-page control is present. **Fail:** page one holds more than 200 rows or no next-page control is offered.
7. *(Expected-output / responsive layout)* **Given** the block renders in a course-page block region at a viewport narrower than the Bootstrap `md` breakpoint (768px), **When** the roster table exceeds the available column width, **Then** the table is wrapped in a Bootstrap `.table-responsive` container that exposes horizontal scrolling while preserving the `<caption>` and every `scope="col"` header association, and the next-page and previous-page controls stay reachable and operable within the block column. **Pass:** the full table is reachable by horizontal scroll with the caption and the `scope="col"` headers intact and the paging controls operable below 768px. **Fail:** any column is clipped or unreachable, the caption or header-scope association is lost, or a paging control is obscured or inoperable below 768px.

## Edge Cases

- **Empty/Null Input:** A course with zero enrolled students holding the student role renders the localized empty-state message (via `get_string`) and zero data rows; the Card and the table caption still render so the structure is announced to a screen reader.
- **Boundary Values:** A course with exactly 1 student renders exactly 1 data row. A course with exactly 200 students renders 200 rows on a single page with no next-page control (200 is inclusive on page one). A course with 201 students renders 200 rows on page one plus a next-page control (paging is exclusive beyond 200).
- **Invalid Input:** A course id that does not resolve to a valid course context renders the localized error message (via `get_string`) and zero data rows; no student data is rendered.
- **Concurrent/Conflicting Operations:** A student who is unenrolled while the roster is being built is resolved against one consistent snapshot taken at query time; the render reflects that single snapshot and does not raise a fatal error or emit a partial row.

## Sub-tasks

- [ ] Build the roster query by retrieving course-enrolled users with `get_enrolled_users()` / `get_enrolled_sql()` [public/lib/enrollib.php:L1536,L1664], then restrict the set to users assigned the student role in the course context via `get_role_users()` (or equivalent role-assignment SQL keyed by the student role id) [public/lib/accesslib.php:L4063] — @assignee
- [ ] Render the Bootstrap Card shell wrapping a semantic `<table>` (with a `<caption>` and `scope="col"` headers for the name column, the three signal columns, and the overall-flag column) through Mustache and `$OUTPUT` — @assignee
- [ ] Wrap the roster `<table>` in a Bootstrap `.table-responsive` (or `.table-responsive-md`) container and verify the roster stays legible within a course-page block column at the `sm` (576px) and `md` (768px) breakpoints, with the `<caption>` and `scope="col"` header associations preserved under horizontal scroll — @assignee
- [ ] Implement the previous-page and next-page paging controls with a visible keyboard focus indicator, keyboard activation (Enter / Space), hover and active styling consistent with Boost button/link controls, and a disabled state (carrying `aria-disabled="true"`) on the previous control on page one and on the next control on the last page — @assignee
- [ ] Implement the localized empty-state and error-state strings through `get_string` and the `lang/en/block_engagement.php` language file — @assignee
- [ ] Add unit tests (student-role scoping, exact row count, paging boundary at 200 and 201) and a Behat test (the roster renders on a course page when the block is added, and is hidden when the block is not added) — @assignee

## Estimation

- **Effort:** Medium
- **Complexity:** Medium (enrolment join + course-context role scoping + table render)
- **Uncertainty:** Low
- **Story Points (Fibonacci):** 5

## Definition of Done

- [ ] The roster lists only users holding the student role; every Editing Teacher, every Non-editing Teacher, and every non-student role is excluded.
- [ ] The roster renders exactly one data row per student.
- [ ] The view is one semantic `<table>` with a `<caption>` and `scope="col"` headers, wrapped in a Bootstrap Card.
- [ ] The localized empty-state and error-state messages are rendered through `get_string`.
- [ ] The roster is keyboard reachable and meets WCAG 2.1 AA structure (semantic table, caption, header scope, ≥4.5:1 text contrast).
- [ ] The paging boundary renders 200 rows per page (200 inclusive on page one; 201 or more exposes a next-page control).
- [ ] The roster `<table>` renders within a Bootstrap `.table-responsive` wrapper so it stays legible inside a course-page block column at the `sm` (576px) and `md` (768px) breakpoints, with the `<caption>` and `scope="col"` header associations preserved under horizontal scroll.
- [ ] The previous-page and next-page controls expose a visible keyboard focus indicator, are operable by keyboard (Enter / Space), and present hover and active styling consistent with Boost button/link controls.
- [ ] The previous-page control is disabled and carries `aria-disabled="true"` on the first page, and the next-page control is disabled and carries `aria-disabled="true"` on the last page, so no out-of-range navigation is triggered.
- [ ] All acceptance criteria pass.
- [ ] Unit tests (role scoping, row count, paging boundary) and the Behat test (course-page render) pass.
- [ ] The relative up-links to the parent feature and the epic resolve.
- [ ] The three signal cells (STORY-001-01-02, STORY-001-01-03, STORY-001-01-04) and the overall flag (STORY-001-01-05) render into this container without coupling the container to their internal logic.
- [ ] The roster is computed from observed Moodle data and does not couple to the machine-learning Predictive Analytics Engine.

## Notes

- **Internationalization (I9):** Every user-facing string — the column headers, the empty-state message, and the error-state message — flows through `get_string` and the plugin language pack (`lang/en/block_engagement.php`). No string is hardcoded in the markup.
- **Accessibility (I7):** The roster meets WCAG 2.1 AA — a semantic `<table>`, a `<caption>`, a `scope` attribute on each column header, keyboard reachability for every interactive control, and a minimum 4.5:1 text contrast ratio. Meaning is never conveyed by color alone.
- **Deterministic boundary (I11):** The roster and the signals it hosts are computed from observed Moodle data (enrolment, last access, assignment due dates, grade history). This story does not couple to Moodle's machine-learning Predictive Analytics Engine.
- **Course-page binding (R5, R7):** The roster is delivered as a course-page block that binds to the course view through `applicable_formats()` returning `['course' => true]` [public/blocks/completionstatus/block_completionstatus.php:L36], so the Non-editing Teacher does not leave the course page and the Editing Teacher adds the block per course (opt-in).
- **Dependency note:** Rendering of this roster is gated by the opt-in enablement and the course-context permission checks specified in [FEATURE-001-03: Opt-In and Permission-Respecting Access](../FEATURE-001-03-optin-and-permission-respecting-access.md); this story does not restate those acceptance criteria, preserving INVEST Independence. The per-student signal cells are specified by STORY-001-01-02 (activity recency), STORY-001-01-03 (overdue work), and STORY-001-01-04 (assessment trend); the overall risk flag is specified by STORY-001-01-05.
- **Out-of-scope reminder (verbatim v1 exclusion):**

> customization of which engagement signals are displayed

  All three signals (recency, overdue, trend) are always shown; choosing which signals appear is out of scope for v1.
