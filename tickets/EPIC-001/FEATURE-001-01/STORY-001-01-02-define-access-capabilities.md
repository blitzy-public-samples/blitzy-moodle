# STORY-001-01-02: Define access capabilities

## User Story

**As a** Site Administrator / manager,
**I want** the Class Pulse block to define `block/classpulse:addinstance` and `block/classpulse:view` capabilities at the block context,
**So that** I can govern which roles add the block and which roles view its engagement data.

This story documents only the two access-control capabilities of the Class Pulse block and the authorization rule that governs who is shown engagement data. It defines `block/classpulse:addinstance` (which roles may add the block) and `block/classpulse:view` (which roles may read its engagement signals), both registered at `CONTEXT_BLOCK`. The capability model is copied field-for-field from the verified `block_accessreview` analog. This story computes no engagement signal and renders no risk highlight; it governs access only. The cross-cutting authorization rule it realizes is: a viewer who lacks `block/classpulse:view` in the block context is shown no student engagement data, mirroring the render-time capability gate of the analog block.

### Capability model

| Capability | captype | contextlevel | archetypes | clonepermissionsfrom |
|------------|---------|--------------|------------|----------------------|
| `block/classpulse:addinstance` | `write` | `CONTEXT_BLOCK` | `editingteacher` = `CAP_ALLOW`, `manager` = `CAP_ALLOW` | `moodle/site:manageblocks` |
| `block/classpulse:view` | `read` | `CONTEXT_BLOCK` | `editingteacher` = `CAP_ALLOW`, `manager` = `CAP_ALLOW` | — |

## Acceptance Criteria

Each scenario is authored in Given/When/Then form, mirrors the repository Gherkin convention (Source: `.gherkin-lintrc`; canonical narrative in `public/blocks/accessreview/tests/behat/accessreview.feature`), and resolves to a binary pass or fail outcome.

**Scenario 1 — Both capabilities are registered (valid output)**

- **Given** `db/access.php` defines `block/classpulse:addinstance` and `block/classpulse:view`,
- **When** the plugin installs,
- **Then** both capabilities are listed under Site administration > Users > Permissions > Define roles.

**Scenario 2 — The addinstance capability declares the documented fields (input validation)**

- **Given** the `block/classpulse:addinstance` definition,
- **When** it is validated during installation,
- **Then** `captype` is `write`, `contextlevel` is `CONTEXT_BLOCK`, archetypes `editingteacher` and `manager` are each `CAP_ALLOW`, and `clonepermissionsfrom` is `moodle/site:manageblocks`.

**Scenario 3 — The view capability declares the documented fields (input validation)**

- **Given** the `block/classpulse:view` definition,
- **When** it is validated during installation,
- **Then** `captype` is `read` and `contextlevel` is `CONTEXT_BLOCK`.

**Scenario 4 — A viewer without the view capability is shown no data (authorization, valid output)**

- **Given** a viewer who lacks `block/classpulse:view` in the block context,
- **When** the course page renders,
- **Then** the Class Pulse block reveals no student engagement data and returns an empty content body.

**Scenario 5 — A holder of the view capability is shown the data (valid output)**

- **Given** a Course Teacher who holds `block/classpulse:view` in the block context,
- **When** the course page renders,
- **Then** the Class Pulse block displays the student engagement data.

**Scenario 6 — Omitting the view capability halts capability registration (error handling)**

- **Given** a `db/access.php` that omits the `block/classpulse:view` capability,
- **When** the plugin installs,
- **Then** a capability-definition error is reported and no role can be granted view access to the block.

**Scenario 7 — Add-permission without view-permission shows no data (edge/boundary)**

- **Given** a role holding `block/classpulse:addinstance` but not `block/classpulse:view`,
- **When** a holder of that role opens the course,
- **Then** the holder may add the block yet is shown no student engagement data within it.

## Sub-Tasks

- [ ] Define `block/classpulse:addinstance` (`write`, `CONTEXT_BLOCK`, `editingteacher` + `manager` `CAP_ALLOW`, `clonepermissionsfrom` `moodle/site:manageblocks`) in `db/access.php` @assignee
- [ ] Define `block/classpulse:view` (`read`, `CONTEXT_BLOCK`, mirroring the analog archetypes) in `db/access.php` @assignee
- [ ] Add capability language strings `classpulse:addinstance` and `classpulse:view` to `lang/en/block_classpulse.php` @assignee
- [ ] Document the render-time view gate — `isloggedin()` and not `isguestuser()` and `has_capability('block/classpulse:view', $context)` — mirrored from the analog block @assignee
- [ ] Document the authorization rule: a viewer without `block/classpulse:view` is shown no engagement data @assignee

## Edge Cases

- **Empty/Null Input** — the `block/classpulse:view` capability is undefined (missing from `db/access.php`): no role can be granted view access and the block exposes no engagement data.
- **Boundary Values / Conflicting** — a role is granted `block/classpulse:addinstance` but not `block/classpulse:view` (permission asymmetry): the role may add the block yet is shown no engagement data within it.
- **Invalid Input** — a capability definition carries an unknown or ambiguous archetype value: capability registration rejects the unrecognized archetype and the definition is not applied.
- **Concurrent/Conflicting Operations** — two Site Administrators edit the same role's Class Pulse permissions at the same time: the last saved change is retained and the role's effective permission is deterministic.

## Dependencies

- **Prerequisite — STORY-001-01-01 (scaffold).** Capabilities attach to the block plugin; the `block_classpulse` plugin and its `db/access.php` must exist before the two capabilities can be declared. See [STORY-001-01-01: Scaffold block plugin skeleton](./STORY-001-01-01-scaffold-block-plugin-skeleton.md).
- **Downstream dependents within FEATURE-001-01.** STORY-001-01-04 (privacy provider) references the read access governed by `block/classpulse:view`.
- **Downstream dependents across features.** Every engagement-signal story in FEATURE-001-02 and every render story in FEATURE-001-03 relies on the `block/classpulse:view` authorization gate defined here, so that no viewer is shown data the role is not authorized to see.

## Estimation

| Dimension | Assessment | Rationale |
|-----------|------------|-----------|
| Effort | Low | Two declarative capability definitions plus two language strings, mirrored from a verified analog. |
| Complexity | Low | A declarative `db/access.php` array with no business logic and no data model. |
| Uncertainty | Low | The capability model is copied field-for-field from the existing `block_accessreview` plugin in this repository. |

**Story point estimate: 2 (Fibonacci).**

## Definition of Done

- [ ] `block/classpulse:addinstance` is defined with `captype` `write`, `contextlevel` `CONTEXT_BLOCK`, archetypes `editingteacher` and `manager` set to `CAP_ALLOW`, and `clonepermissionsfrom` set to `moodle/site:manageblocks`.
- [ ] `block/classpulse:view` is defined with `captype` `read` and `contextlevel` `CONTEXT_BLOCK`, mirroring the analog archetypes.
- [ ] Capability language strings `classpulse:addinstance` and `classpulse:view` are documented in `lang/en/block_classpulse.php`.
- [ ] The authorization rule — a viewer without `block/classpulse:view` is shown no engagement data — is documented as an acceptance criterion.
- [ ] The story satisfies the six INVEST principles (Independent, Negotiable, Valuable, Estimable, Small, Testable) and is demonstrable for Product Owner acceptance.
- [ ] The story carries 4–8 acceptance criteria in Given/When/Then form covering one valid-output, one input-validation, one error-handling, and one edge/boundary scenario, each with a binary pass/fail outcome.
- [ ] The story enumerates 3–5 edge cases spanning Empty/Null Input, Boundary Values, Invalid Input, and Concurrent/Conflicting Operations.
- [ ] Zero forbidden terms appear in any acceptance criterion.
- [ ] Key Citations reference the grounding Moodle source paths.

## Key Citations

- Source: public/blocks/accessreview/db/access.php — the capability model (`block/accessreview:addinstance` write capability with archetypes `editingteacher` + `manager` `CAP_ALLOW` and `clonepermissionsfrom` `moodle/site:manageblocks`, plus `block/accessreview:view` read capability at `CONTEXT_BLOCK`) that the Class Pulse capabilities mirror.
- Source: public/blocks/accessreview/block_accessreview.php — the render-time `has_capability('block/accessreview:view', $context)` gate (with `isloggedin()` and `isguestuser()` checks) that the Class Pulse view authorization rule mirrors.
- Source: public/blocks/accessreview/lang/en/block_accessreview.php — the capability language-string pattern (`accessreview:addinstance`, `accessreview:view`) that `classpulse:addinstance` and `classpulse:view` mirror.

[⬅ Back to FEATURE-001-01](../FEATURE-001-01-block-scaffold-and-placement.md)
