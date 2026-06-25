# STORY-001-03-03: Performance-Budget Load

- **Story ID:** STORY-001-03-03
- **Parent Feature:** [FEATURE-001-03: Opt-In and Permission-Respecting Access](../FEATURE-001-03-optin-and-permission-respecting-access.md)
- **Epic:** [EPIC-001: Surface Student Engagement Risk on the Course Page](../../EPIC-001-student-engagement-risk-visibility.md)
- **Type:** User Story
- **Requirement:** R8
- **Status:** Draft / Ready for Refinement

---

## User Story

**As a** Non-editing Teacher, **I want** the engagement overview to render within a fixed query and millisecond budget on every course-page visit, **so that** I can read it as part of a daily routine instead of waiting on a batch report. The render issues at most 8 database queries regardless of class size and completes server-side within 300 milliseconds on a cache hit, so opening the course page carries a bounded, predictable cost.

---

## INVEST Justification

- **Independent:** The budget is expressed as a fixed query ceiling plus millisecond targets that are asserted against a seeded course, so the story is demonstrable on its own through a performance test and does not block on which signals FEATURE-001-01 renders.
- **Negotiable:** The numeric thresholds (8 queries, 300/800 milliseconds, 900-second time-to-live, page size 200) are starting values open to refinement with the Product Owner before any code is written.
- **Valuable:** A bounded, repeatable load cost is what lets a teacher consult the overview every day rather than treat it as a batch report; it delivers requirement R8 directly.
- **Estimable:** The scope is a fixed set of batched, single-course queries plus one Moodle Universal Cache layer and its invalidation, so the work is sized with confidence.
- **Small:** The story changes no signal logic; it only bounds and caches reads that other stories already define, keeping it within a single sprint increment.
- **Testable:** The query count and the millisecond targets are measured and asserted by an automated performance test with explicit pass/fail thresholds.

---

## Acceptance Criteria

1. *(Input-validation / no N+1, constant query count)* **Given** a course with N enrolled students, **When** the block builds the roster and the three signals, **Then** the total database query count is a fixed constant that does not grow with N (the count for N = 10 equals the count for N = 200) and is at most 8.
2. *(Expected-output / warm-cache budget)* **Given** the per-course signals are present in the Moodle Universal Cache, **When** the block renders on a cache hit, **Then** server-side processing completes in at most 300 milliseconds and issues zero signal-recomputation queries.
3. *(Error-handling / cold-cache budget)* **Given** the cache holds no entry for the course, **When** the block renders, **Then** it recomputes the signals with at most 8 bounded queries, stores the result in the cache, and completes server-side processing in at most 800 milliseconds for a roster of up to 200 students.
4. *(Boundary / large roster)* **Given** a course enrolled with exactly 200 students, **When** the block renders, **Then** it stays within the 8-query and 800-millisecond budget for the rendered page; a course enrolled with 201 or more students paginates at the page size of 200 rather than loading every student at once.
5. *(Edge-case / stale cache)* **Given** a grade, submission, or last-access change has invalidated a cached signal, **When** the block next renders, **Then** it serves data no older than the 900-second time-to-live or performs a fresh recompute, and never renders a value that contradicts the current invalidation token.
6. *(Concurrent loads)* **Given** two teachers load the same course's overview at the same time on a cold cache, **When** both renders execute, **Then** each render stays within the 8-query budget, the cache is populated, and subsequent loads are served from the cache.

---

## Edge Cases

- **Empty/Null Input:** A course with zero enrolled students issues the minimal bounded query set (no per-student query) and renders the empty state inside both the 300-millisecond warm budget and the 800-millisecond cold budget.
- **Boundary Values:** A roster of exactly 200 students renders on one page within the 8-query and 800-millisecond budget; the 201st enrolled student triggers pagination at the page size of 200 rather than a single oversized load.
- **Invalid Input:** A stale or corrupt cache entry (failed unserialization or version-token mismatch) is discarded; the block recomputes within the cold-cache budget of at most 8 queries and 800 milliseconds and renders no corrupt value.
- **Concurrent/Conflicting Operations:** Simultaneous cold-cache loads (a cache stampede) populate the cache one time; each concurrent render still issues at most 8 queries and stays within the 800-millisecond cold budget, after which loads are served from the cache.

---

## Sub-tasks

- [ ] Implement one batched query per signal over the roster's user-id list (enrolment, `user_lastaccess`, `mod_assign`, `grade_grades`) with no per-student query — @assignee
- [ ] Cache the computed per-course signals in the Moodle Universal Cache (`cache::make`) keyed by course id plus an invalidation token, with the 900-second time-to-live — @assignee
- [ ] Implement cache invalidation on grade, submission, and last-access change events — @assignee
- [ ] Add pagination at the page size of 200 for rosters beyond 200 students, reusing the `get_enrolled_users()` limit parameters — @assignee
- [ ] Add an automated performance test asserting the query count is constant versus N and at most 8, warm render at most 300 milliseconds, and cold render at most 800 milliseconds for 200 students — @assignee

---

## Estimation

- **Effort:** Medium
- **Complexity:** Medium-High (query batching + Moodle Universal Cache caching + invalidation + performance assertion)
- **Uncertainty:** Medium
- **Story Points (Fibonacci):** **5**

---

## Definition of Done

- [ ] The database query count for one render is a fixed constant of at most 8, independent of the enrolled count N (no N+1: the count for N = 10 equals the count for N = 200).
- [ ] Warm-cache server render completes in at most 300 milliseconds; cold-cache server render completes in at most 800 milliseconds for a roster of up to 200 students.
- [ ] Computed per-course signals are cached in the Moodle Universal Cache with a 900-second time-to-live plus event-based invalidation on grade, submission, and last-access changes.
- [ ] Rosters beyond 200 students paginate at the page size of 200 rather than loading every student at once.
- [ ] Stale or corrupt cache entries are discarded and recomputed within the cold-cache budget of at most 8 queries and 800 milliseconds, with no corrupt value rendered.
- [ ] An automated performance test asserts the query-count and millisecond budget with explicit pass/fail.
- [ ] All user-facing strings (loading and empty-state labels) are emitted through `get_string`.
- [ ] All acceptance criteria pass.
- [ ] The relative up-links to the parent feature and the epic resolve.
- [ ] The deterministic boundary is stated: the signals come from bounded queries over observed data, with no dependency on the machine-learning Predictive Analytics Engine.
- [ ] The budget bounds the FEATURE-001-01 roster and signal queries (STORY-001-01-01, STORY-001-01-02, STORY-001-01-03, STORY-001-01-04).

---

## Notes

- **Internationalization (I9):** The loading and empty-state labels flow through `get_string`, so no user-facing copy is hardcoded.
- **Accessibility (I7):** The loading and empty states are conveyed as text and are keyboard reachable; the roster's full WCAG 2.1 AA conformance is owned by STORY-001-01-01 and STORY-001-01-05.
- **Deterministic boundary:** The signals are computed by bounded queries over observed data (`user_lastaccess`, `mod_assign` due/cut-off dates and submission state, and `grade_grades` compared against `grade_grades_history`); this story does not use or depend on the machine-learning Predictive Analytics Engine.
- **Dependencies:** This budget bounds the reads issued by [FEATURE-001-01: In-Course Engagement Overview](../FEATURE-001-01-in-course-engagement-overview.md) (STORY-001-01-01 roster, STORY-001-01-02 recency, STORY-001-01-03 overdue, STORY-001-01-04 trend). The overview renders only after the opt-in placement in [STORY-001-03-01](STORY-001-03-01-optin-enable-per-course.md) and the permission check in [STORY-001-03-02](STORY-001-03-02-enforce-data-access-permissions.md) pass. The story stays independently demonstrable: the budget is assertable by a performance test against a seeded course.
- **Grounding (read-only):** The roster is read through the enrolment API `get_enrolled_users()` / `get_enrolled_sql()` [public/lib/enrollib.php:L1536,L1664], whose `$limitfrom` / `$limitnum` parameters back the page size of 200; the rendered output is cached through the `block_base` `$this->content` convention [public/blocks/moodleblock.class.php:L76] (the `if ($this->content !== null) { return $this->content; }` guard used by core blocks), and the per-course signals are cached through the Moodle Universal Cache `cache::make(...)` API. Each cited file is read-only grounding and is not created, edited, or deleted by this story.
- **Single-course scope:** All reads are scoped to one course context; there is no cross-course aggregation, which keeps the working set and the query budget bounded. The following v1 exclusions are reproduced verbatim:

> Automated notifications or alerts to teachers, visibility for parents or guardians, aggregated views across multiple courses, predictive modeling, and customization of which engagement signals are displayed.
