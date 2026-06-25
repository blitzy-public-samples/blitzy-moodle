# STORY-001-03-01: Opt-In Enable Per Course

- **Story ID:** STORY-001-03-01
- **Parent Feature:** [FEATURE-001-03: Opt-In and Permission-Respecting Access](../FEATURE-001-03-optin-and-permission-respecting-access.md)
- **Epic:** [EPIC-001](../../EPIC-001-student-engagement-risk-visibility.md)
- **Type:** User Story
- **Requirement:** R5 (supports R7)
- **Status:** Draft / Ready for Refinement

---

## User Story

**As an** Editing Teacher, **I want** to enable the engagement overview for a single course by adding the engagement block to that course page, **so that** the view appears only in the courses I choose and never forces itself site-wide.

The benefit is quantifiable: enablement is one block-placement action scoped to one course — zero site-wide configuration and zero effect on any other course. The Editing Teacher opts a single course in (or out) without touching site administration and without changing what any other course displays.

---

## INVEST Justification

- **Independent:** Demonstrable on its own — adding or removing the block toggles the view's presence on one course page, verifiable before any engagement signal is wired.
- **Negotiable:** The default block region/position and the "Add a block" labelling are open to refinement during design.
- **Valuable:** Gives the teacher direct control to opt one course in without affecting any other course.
- **Estimable:** Scope is the standard Moodle block contract — `applicable_formats()`, the capability declaration, and the single-instance rule.
- **Small:** One block-placement behavior; roster rendering, permission enforcement, and performance budgets are separate stories.
- **Testable:** Presence or absence of the block on a course page versus non-course pages is deterministic and assertable by Behat.

---

## Acceptance Criteria

1. **(Input-validation / format binding)** **Given** the engagement block's `applicable_formats()` returns `['course' => true]`, **When** a user opens the "Add a block" menu on a non-course page (the site front page, the Dashboard/My page, or an activity-module page), **Then** the engagement block is absent from that menu and cannot be instantiated on those pages.

2. **(Expected-output / opt-in placement)** **Given** an Editing Teacher who holds `block/engagement:addinstance` in a course context, **When** they add the engagement block to that course page, **Then** exactly one block instance is created on that course only and the engagement overview region renders on that course page.

3. **(Expected-output / never site-wide)** **Given** a freshly installed engagement plugin where no teacher has added the block, **When** any course page loads, **Then** the overview is present in zero courses, confirming it is never auto-enabled site-wide.

4. **(Error-handling / permission denied)** **Given** a user who lacks `block/engagement:addinstance` in the course, **When** a forged add-block request targets that course, **Then** `require_capability` rejects the request, no block instance is created, and the overview does not appear.

5. **(Edge-case / removal restores opt-out)** **Given** a course that contains the engagement block, **When** the Editing Teacher deletes the block instance, **Then** the overview is removed from that course page and the course returns to the no-overview state with no residual block instance.

6. **(Boundary / single instance)** **Given** a course that already contains one engagement block instance, **When** the Editing Teacher attempts to add a second instance, **Then** the single-instance rule (`instance_allow_multiple()` is `false`) prevents a duplicate and the course retains exactly one instance.

---

## Edge Cases

- **Empty/Null Input:** The block is added to a brand-new course with zero enrolled students → the block renders its localized empty state (the empty-roster content is owned by `STORY-001-01-01`) and the opt-in placement still succeeds.
- **Boundary Values:** The `block/engagement:addinstance` capability is granted at exactly the course context (not inherited from a category-level role) → the Editing Teacher can add the block, and the single-instance maximum of 1 is enforced.
- **Invalid Input:** An attempt to place the block in a non-course context (an activity-module page or the site home) → `applicable_formats()` excludes the block and it is not offered in the "Add a block" menu.
- **Concurrent/Conflicting Operations:** Two Editing Teachers add the block to the same course at the same time → the single-instance rule (`instance_allow_multiple()` is `false`) yields exactly one instance; the second add is rejected or coalesced with no duplicate instance.

---

## Sub-tasks

- [ ] Override `applicable_formats()` to return `['course' => true]` so the block binds to course pages only — @assignee
- [ ] Declare `block/engagement:addinstance` (and the companion `block/engagement:view`) in `db/access.php` (`contextlevel` `CONTEXT_BLOCK`; archetypes `editingteacher` + `manager`; `clonepermissionsfrom => 'moodle/site:manageblocks'`) following the `block_accessreview` pattern — @assignee
- [ ] Keep `instance_allow_multiple()` returning `false` to enforce one instance per course — @assignee
- [ ] Externalize the plugin name and add-block strings through `get_string` in `lang/en/block_engagement.php` — @assignee
- [ ] Add Behat coverage: the block is offered to an Editing Teacher on a course page, absent on non-course pages, and absent in courses where it has not been added — @assignee

---

## Estimation

- **Effort:** Low-Medium
- **Complexity:** Low (standard block contract plus a capability declaration)
- **Uncertainty:** Low
- **Story Points (Fibonacci):** **3**

---

## Definition of Done

- [ ] `applicable_formats()` returns `['course' => true]` and the block is unavailable on non-course pages (site front page, Dashboard/My page, activity-module pages).
- [ ] `block/engagement:addinstance` and `block/engagement:view` are declared in `db/access.php` (`CONTEXT_BLOCK`; archetypes `editingteacher` + `manager`).
- [ ] The overview never auto-enables site-wide and appears only on the course pages where a teacher added the block.
- [ ] One instance per course is enforced (`instance_allow_multiple()` returns `false`).
- [ ] Removing the block restores the no-overview state with no residual instance.
- [ ] All user-facing strings are externalized via `get_string`.
- [ ] All acceptance criteria pass.
- [ ] Behat tests pass.
- [ ] Relative up-links to the parent feature and the epic resolve.
- [ ] The deterministic boundary is stated (no coupling to the machine-learning Predictive Analytics Engine).

---

## Notes

- **Internationalization (I9):** The plugin name and the add-block affordance strings flow through `get_string` / language packs (`lang/en/block_engagement.php`).
- **Accessibility (I7):** Placement uses Moodle's standard accessible block chrome; the overview's own WCAG 2.1 AA conformance is owned by `STORY-001-01-01` and `STORY-001-01-05`.
- **Deterministic boundary:** Opt-in placement performs no prediction and does not invoke Moodle's machine-learning Predictive Analytics Engine; the engagement signals are computed deterministically downstream.
- **Dependencies:** This story is the precondition for [FEATURE-001-01: In-Course Engagement Overview](../FEATURE-001-01-in-course-engagement-overview.md) (the roster renders only once the block is placed) and for [FEATURE-001-02: Configurable Risk Thresholds](../FEATURE-001-02-configurable-risk-thresholds.md) (threshold configuration is reachable only after opt-in). This story stays independently demonstrable: adding or removing the block is verifiable on its own.
- **Per-course, teacher-only scope:** Enablement is per-course (never aggregated across courses) and is for teachers (no parent or guardian visibility), in line with the v1 scope boundaries reproduced verbatim below.

The following v1 exclusions are carried verbatim from the epic scope boundaries:

> Automated notifications or alerts to teachers, visibility for parents or guardians, aggregated views across multiple courses, predictive modeling, and customization of which engagement signals are displayed.

### Read-only grounding (cited; never modified)

- Course-page binding / opt-in: `applicable_formats()` returning `['course' => true]` binds the block to course pages only [public/blocks/completionstatus/block_completionstatus.php:L36]; the default `block_base::applicable_formats()` returns `['all' => true, 'mod' => false, 'tag' => false]` [public/blocks/moodleblock.class.php:L402-L404] and is overridden by the engagement block.
- Teacher-driven add: `block_base::user_can_addto()` reads `applicable_formats()` and requires `block/<name>:addinstance` before a block may be added [public/blocks/moodleblock.class.php:L588-L628]; declare `block/engagement:addinstance` following the `block/accessreview:addinstance` pattern [public/blocks/accessreview/db/access.php:L30-L39]. The companion `block/engagement:view` read capability follows `block/accessreview:view` [public/blocks/accessreview/db/access.php:L41-L48]; its enforcement is owned by `STORY-001-03-02`.
- Single instance per course: `instance_allow_multiple()` defaults to `false` in `block_base` [public/blocks/moodleblock.class.php:L507-L511].
