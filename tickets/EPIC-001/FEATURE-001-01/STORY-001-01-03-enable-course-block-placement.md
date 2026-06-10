# STORY-001-01-03: Enable course block placement

## User Story

**As a** Course Teacher / editing teacher,
**I want** to add the Class Pulse block to a course on an opt-in basis,
**So that** the engagement roster appears only in the courses where I choose to place it.

This story documents only the placement contract of the Class Pulse block — where the block may be added and the rule that it is added by deliberate choice rather than automatically. Placement is governed by the block's `applicable_formats()` method, which permits the course view (`course-view`) and excludes activity-module pages (`mod`) and the Dashboard (`my`); the four engagement signals are scoped to a single course, so the course context is the block's intended host. The block is never auto-added to any course: a Course Teacher with editing mode on adds it through the standard "Add a block" menu, mirroring the verified `block_accessreview` analog. Because `instance_allow_multiple()` returns `false`, at most one Class Pulse block exists on any one page. This story computes no engagement signal and renders no risk highlight; it defines placement only.

### Placement contract

The table below maps each Moodle page-type key handled by `applicable_formats()` to whether a Course Teacher may add the Class Pulse block there. The keys and their structural pattern are taken from the verified analog (Source: `public/blocks/accessreview/block_accessreview.php`).

| Page type (`applicable_formats` key) | Addable | Notes |
|---------------------------------------|---------|-------|
| `course-view` | Yes (`true`) | The intended host: a single course's pages, where the engagement roster is scoped. |
| `site` | Per analog (`true`) | The analog permits the site front page; Class Pulse mirrors the analog structurally, while the course context is its intended host and it is never auto-added at site scope. |
| `mod` | No (`false`) | Excluded — the block is not offered on activity-module pages. |
| `my` | No (`false`) | Excluded — the block is not offered on the Dashboard. |

## Acceptance Criteria

Each scenario is authored in Given/When/Then form, mirrors the repository Gherkin convention (Source: `.gherkin-lintrc`; canonical narrative in `public/blocks/accessreview/tests/behat/accessreview.feature`), and resolves to a binary pass or fail outcome.

**Scenario 1 — Course Teacher adds the block to a course (valid output)**

- **Given** a Course Teacher with editing mode on in a course,
- **When** the teacher opens the "Add a block" menu,
- **Then** "Class Pulse" is offered and, once selected, is added to the course page.

**Scenario 2 — Placement scoping is declared (input validation)**

- **Given** the block's `applicable_formats()` return value,
- **When** it is validated,
- **Then** the `course-view` key is `true` while the `mod` and `my` keys are each `false`.

**Scenario 3 — Block is not auto-added to a new course (opt-in, valid output)**

- **Given** a newly created course where no teacher has added the block,
- **When** the course page renders,
- **Then** the Class Pulse block is absent and no Class Pulse block is created without a teacher's deliberate action.

**Scenario 4 — Block is not offered on non-course pages (error handling)**

- **Given** a Course Teacher viewing the Dashboard (`my`) or an activity-module page (`mod`),
- **When** the teacher opens the "Add a block" menu,
- **Then** "Class Pulse" is not offered for that page.

**Scenario 5 — Duplicate instance is refused on one page (edge/boundary)**

- **Given** a course page that already hosts one Class Pulse block while `instance_allow_multiple()` returns `false`,
- **When** the teacher opens the "Add a block" menu again,
- **Then** "Class Pulse" is not offered a second time and the page retains at most one Class Pulse block.

## Sub-Tasks

- [ ] Implement `applicable_formats()` returning `course-view => true`, `mod => false`, and `my => false`, mirroring the analog structural pattern @assignee
- [ ] Confirm the block is not auto-added to any course — placement is an opt-in action taken by a Course Teacher @assignee
- [ ] Confirm `instance_allow_multiple()` returns `false` so a duplicate instance cannot be added to one page @assignee
- [ ] Document that adding the block is gated by the `block/classpulse:addinstance` capability (defined in STORY-001-01-02) @assignee
- [ ] Confirm the "Add a block" flow matches the analog Behat narrative (editing mode on, add the block in a course) @assignee

## Edge Cases

- **Invalid Input** — a teacher attempts to add the block on a non-course page (the Dashboard `my` or an activity-module `mod` page): "Class Pulse" is not offered there because `applicable_formats()` marks those keys `false`.
- **Boundary / Conflicting** — a duplicate-instance attempt on a course page that already hosts one Class Pulse block: the second add is refused because `instance_allow_multiple()` returns `false`.
- **Permission** — a teacher who lacks `block/classpulse:addinstance` opens the "Add a block" menu: "Class Pulse" is not offered to that role, so placement is denied.
- **Concurrent/Conflicting Operations** — two editing teachers add the block to the same course page at the same time: one instance is created and the single-instance rule is upheld, leaving exactly one Class Pulse block on the page.

## Dependencies

- **Prerequisite — STORY-001-01-01 (scaffold).** Placement attaches to the block plugin; the `block_classpulse` class must exist and declare `applicable_formats()` and `instance_allow_multiple()` before placement is configured. See [STORY-001-01-01 — Scaffold block plugin skeleton](./STORY-001-01-01-scaffold-block-plugin-skeleton.md).
- **Capability gate — STORY-001-01-02 (access capabilities).** Adding the block is gated by `block/classpulse:addinstance`, defined in [STORY-001-01-02 — Define access capabilities](./STORY-001-01-02-define-access-capabilities.md); a role without that capability is not offered the block.
- **External platform dependency — Moodle 5.2 core block API.** Placement relies on the core block `applicable_formats()` contract and the standard "Add a block" placement flow; no code outside the block plugin is changed.

## Estimation

| Dimension | Assessment | Rationale |
|-----------|------------|-----------|
| Effort | Low | A single declarative `applicable_formats()` array plus the `instance_allow_multiple()` flag, mirrored from a verified analog. |
| Complexity | Low | Declarative placement contract with no business logic and no data model. |
| Uncertainty | Low | The placement keys and single-instance rule are verified against the existing `block_accessreview` plugin in this repository. |

**Story point estimate: 2 (Fibonacci).**

## Definition of Done

- [ ] `applicable_formats()` is documented with `course-view` set to `true` and `mod` and `my` each set to `false`, mirroring the analog structural pattern.
- [ ] Opt-in placement is documented: the block is not auto-added to any course and is added only by a deliberate Course Teacher action through the "Add a block" menu.
- [ ] Duplicate-instance prevention via `instance_allow_multiple()` returning `false` is documented (at most one Class Pulse block per page).
- [ ] The placement-gating capability `block/classpulse:addinstance` (STORY-001-01-02) is referenced.
- [ ] The story satisfies the six INVEST principles (Independent, Negotiable, Valuable, Estimable, Small, Testable) and is demonstrable for Product Owner acceptance.
- [ ] The story carries 4–8 acceptance criteria in Given/When/Then form covering one valid-output, one input-validation, one error-handling, and one edge/boundary scenario, each with a binary pass/fail outcome.
- [ ] The story enumerates 3–5 edge cases spanning Invalid Input, Boundary/Conflicting, Permission, and Concurrent/Conflicting Operations.
- [ ] Zero forbidden terms appear in any acceptance criterion.
- [ ] Key Citations reference the grounding Moodle source paths.

## Key Citations

- Source: public/blocks/accessreview/block_accessreview.php — `applicable_formats()` (the `course-view` / `site` / `mod` / `my` placement keys) and `instance_allow_multiple()` returning `false`, the placement and single-instance contract that Class Pulse mirrors.
- Source: public/blocks/accessreview/tests/behat/accessreview.feature — the canonical narrative for adding the block in a course with editing mode on ("When I add the ... block"), the placement flow Class Pulse follows.
- Source: .gherkin-lintrc — the repository Gherkin convention that the acceptance criteria mirror.

[⬅ Back to FEATURE-001-01](../FEATURE-001-01-block-scaffold-and-placement.md)
