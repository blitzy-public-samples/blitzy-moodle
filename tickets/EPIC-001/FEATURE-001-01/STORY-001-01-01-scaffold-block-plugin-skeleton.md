# STORY-001-01-01: Scaffold block plugin skeleton

## User Story

**As a** Moodle Plugin Developer,
**I want** a `block_classpulse` plugin skeleton that extends `block_base` with a `version.php` descriptor, English language strings, and a `pix/` icon,
**So that** the Class Pulse block is installable and provides the foundation that the access-capability, course-placement, engagement-signal, and risk-visualization stories attach to.

This is the foundational story of FEATURE-001-01. It documents only the installable plugin skeleton — the `block_classpulse` class, the plugin version descriptor, the language file, and the block icon. It computes no engagement signal and renders no risk highlight; those behaviors are documented in FEATURE-001-02 and FEATURE-001-03 and build on the scaffold defined here. The contract mirrors the verified `block_accessreview` analog: a block class that sets its title in `init()`, disallows duplicate instances through `instance_allow_multiple()`, and caches its rendered content inside `get_content()`.

## Acceptance Criteria

Each scenario is authored in Given/When/Then form, mirrors the repository Gherkin convention (Source: `.gherkin-lintrc`; canonical narrative in `public/blocks/accessreview/tests/behat/accessreview.feature`), and resolves to a binary pass or fail outcome.

**Scenario 1 — Plugin installs and is listed (valid output)**

- **Given** the `block_classpulse` plugin directory contains the `block_classpulse` class, `version.php`, `lang/en/block_classpulse.php`, and a `pix/` icon,
- **When** a Site Administrator opens the Site administration notifications (upgrade) page,
- **Then** the plugin installs without raising an error and "Class Pulse" is listed under Site administration > Plugins > Blocks.

**Scenario 2 — Version descriptor declares the required fields (input validation)**

- **Given** the `version.php` plugin descriptor for the block,
- **When** the descriptor is validated during installation,
- **Then** `$plugin->component` equals `block_classpulse`, and `$plugin->version` and `$plugin->requires` are each a non-zero integer date-stamp.

**Scenario 3 — Missing component assignment halts installation (error handling)**

- **Given** a `version.php` that omits the `$plugin->component` assignment,
- **When** installation is attempted,
- **Then** installation halts with a plugin-descriptor error and the block is not registered.

**Scenario 4 — Directory name versus component name mismatch blocks installation (edge/boundary)**

- **Given** the plugin directory is named other than `classpulse` while `$plugin->component` is `block_classpulse`,
- **When** installation is attempted,
- **Then** a component-versus-directory mismatch is reported and the block does not install.

**Scenario 5 — Block title is set from the plugin-name string (valid output)**

- **Given** an installed `block_classpulse` whose `init()` calls `get_string('pluginname', 'block_classpulse')`,
- **When** the block is added to a course and `init()` runs,
- **Then** the rendered block title reads "Class Pulse".

**Scenario 6 — Repeated content retrieval returns the cached object (valid output)**

- **Given** a `block_classpulse` instance whose `get_content()` has populated `$this->content` on its first invocation,
- **When** `get_content()` is invoked a second time on the same instance,
- **Then** the stored content object is returned without rebuilding it.

**Scenario 7 — Single instance per course (boundary)**

- **Given** a course that already holds one `block_classpulse` instance and `instance_allow_multiple()` returns `false`,
- **When** a Course Teacher opens the "Add a block" menu in that course,
- **Then** "Class Pulse" is not offered a second time and the course retains at most one Class Pulse instance.

## Sub-Tasks

- [ ] Define class `block_classpulse extends block_base` with `init()` setting the title via `get_string('pluginname', 'block_classpulse')` and a cached `get_content()` @assignee
- [ ] Author `version.php` with `$plugin->component = 'block_classpulse'`, a non-zero integer `$plugin->version`, and `$plugin->requires` targeting Moodle 5.2 core @assignee
- [ ] Confirm `version.php` declares no external plugin dependency (Moodle 5.2 core only — unlike the analog's `tool_brickfield` dependency) @assignee
- [ ] Create `lang/en/block_classpulse.php` with `pluginname = 'Class Pulse'`, `classpulse:addinstance`, and `classpulse:view` strings @assignee
- [ ] Add a `pix/` icon for the block @assignee
- [ ] Implement `instance_allow_multiple()` to return `false` @assignee

## Edge Cases

- **Empty/Null Input** — `version.php` is present but `$plugin->version` is missing or blank, or `lang/en/block_classpulse.php` is empty: installation reports the missing metadata and the block is not registered.
- **Invalid Input** — the plugin directory name (for example `pulse`) does not match the component name `block_classpulse`: a component-versus-directory mismatch is reported and installation stops.
- **Boundary Values** — the plugin is already installed and a re-install presents a `$plugin->version` equal to or lower than the installed version: no downgrade is applied and the installed version is retained.
- **Concurrent/Conflicting Operations** — two Site Administrators trigger the upgrade process at the same time: the installation completes once and the block is registered a single time.

## Dependencies

- **No prerequisite stories — foundational.** This is the foundational story of FEATURE-001-01; it depends only on the Moodle 5.2 core block API (block lifecycle, `init()`, cached `get_content()`, and `instance_allow_multiple()`). No other story is a prerequisite.
- **Downstream dependents within FEATURE-001-01.** STORY-001-01-02 (define access capabilities), STORY-001-01-03 (enable course block placement), and STORY-001-01-04 (implement privacy provider) each attach to this scaffold and depend on it.
- **Downstream dependents across features.** FEATURE-001-02 (engagement signal computation) and FEATURE-001-03 (risk visualization and configuration) depend on this scaffold existing before any engagement signal is computed or any risk highlight is rendered.

## Estimation

| Dimension | Assessment | Rationale |
|-----------|------------|-----------|
| Effort | Medium | A single plugin skeleton: the block class, the version descriptor, the language file, and the icon. |
| Complexity | Medium | Follows the established Moodle block contract mirrored from `block_accessreview`, with no new data model. |
| Uncertainty | Low | The contract is verified against an existing analog plugin in this repository. |

**Story point estimate: 3 (Fibonacci).**

## Definition of Done

- [ ] `block_classpulse` extends `block_base` with an `init()` that sets the title via `get_string('pluginname', 'block_classpulse')`.
- [ ] `get_content()` caches its result so a second invocation returns the stored content object without rebuilding it.
- [ ] `instance_allow_multiple()` returns `false`.
- [ ] `version.php` declares `$plugin->component = 'block_classpulse'` with a non-zero integer `$plugin->version` and a `$plugin->requires` targeting Moodle 5.2 core, and declares no external plugin dependency.
- [ ] `lang/en/block_classpulse.php` defines `pluginname = 'Class Pulse'`, `classpulse:addinstance`, and `classpulse:view`, and a `pix/` icon is documented.
- [ ] The story satisfies the six INVEST principles (Independent, Negotiable, Valuable, Estimable, Small, Testable) and is demonstrable for Product Owner acceptance.
- [ ] The story carries 4–8 acceptance criteria in Given/When/Then form covering one valid-output, one input-validation, one error-handling, and one edge/boundary scenario, each with a binary pass/fail outcome.
- [ ] The story enumerates 3–5 edge cases spanning Empty/Null Input, Boundary Values, Invalid Input, and Concurrent/Conflicting Operations.
- [ ] Zero forbidden terms appear in any acceptance criterion.
- [ ] Key Citations reference the grounding Moodle source paths.

## Key Citations

- Source: public/blocks/accessreview/block_accessreview.php — block class extending `block_base` with `init()` setting the title via `get_string`, `instance_allow_multiple()` returning `false`, and the cached `get_content()` that the `block_classpulse` scaffold mirrors.
- Source: public/blocks/accessreview/version.php — plugin descriptor declaring `$plugin->component`, `$plugin->version`, and `$plugin->requires` that `block_classpulse/version.php` mirrors, without the analog's external `tool_brickfield` dependency.
- Source: public/blocks/accessreview/lang/en/block_accessreview.php — language-string pattern (`pluginname` plus capability strings) that `lang/en/block_classpulse.php` mirrors.
- Source: public/version.php — Moodle 5.2dev (Build: 20251024), branch 502, the core version that `$plugin->requires` targets.

[⬅ Back to FEATURE-001-01](../FEATURE-001-01-block-scaffold-and-placement.md)
