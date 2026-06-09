# FEATURE-001-01: Block Scaffold & Placement

## Feature Summary

Block Scaffold & Placement establishes the foundational Moodle block contract for Class Pulse: a `block_base` subclass (`block_classpulse`), the `version.php` plugin descriptor, the English language strings and a `pix/` icon, the access-control capability definitions, opt-in per-course placement that lets a Course Teacher add the block to a single course, and the privacy provider. This feature delivers the plugin skeleton on which every later capability is built — the engagement signal computation in FEATURE-001-02 and the risk highlight rendering plus threshold configuration in FEATURE-001-03 both attach to the block class, capabilities, and placement contract defined here. The scaffold mirrors the verified contract of the existing `block_accessreview` plugin: a block class that sets its title in `init()`, declares its placement through `applicable_formats()`, disallows duplicate instances through `instance_allow_multiple()`, and caches its rendered content inside `get_content()`. No engagement signal is computed and no risk highlight is rendered in this feature; those behaviors are documented in the two dependent features.

### Scope Boundaries

This feature is the plugin skeleton only. It defines the block class, the plugin version descriptor, the capability model, the placement rule, and the privacy declaration — it does **not** compute any engagement signal (that is FEATURE-001-02) and does **not** render or color-code the engagement table or apply any threshold (that is FEATURE-001-03).

The v1 scope boundaries that touch the scaffold and placement are reaffirmed here:

- **Opt-in per course** — the block is added on a per-course basis through standard Moodle block placement. It is not auto-added to any course, and it is not placed at site or dashboard scope by default.
- **No new database tables** — the scaffold introduces no new database tables; Class Pulse reads only data that already exists in Moodle.
- **Single instance per course** — the block disallows duplicate instances within one course, mirroring the `instance_allow_multiple()` contract of the analog block.

## User Stories Index

This feature decomposes into four User Stories, each authored under the sibling `./FEATURE-001-01/` directory. Every index link below MUST resolve to an authored Story file; a broken or missing link is a completeness defect.

| Story | Description |
|-------|-------------|
| [STORY-001-01-01 — Scaffold block plugin skeleton](./FEATURE-001-01/STORY-001-01-01-scaffold-block-plugin-skeleton.md) | Create the `block_classpulse` class extending `block_base`, the `version.php` descriptor, the English language strings, and the `pix/` icon. |
| [STORY-001-01-02 — Define access capabilities](./FEATURE-001-01/STORY-001-01-02-define-access-capabilities.md) | Declare `block/classpulse:addinstance` and `block/classpulse:view` at `CONTEXT_BLOCK`, with the authorization rule that the block shows only data the viewing role is authorized to see. |
| [STORY-001-01-03 — Enable course block placement](./FEATURE-001-01/STORY-001-01-03-enable-course-block-placement.md) | Restrict placement to the course view through `applicable_formats()` so the block is opt-in per course and is not auto-added. |
| [STORY-001-01-04 — Implement privacy provider](./FEATURE-001-01/STORY-001-01-04-implement-privacy-provider.md) | Provide a privacy provider that declares no new stored personal data and names the external Moodle sources the block reads. |

## Dependencies

- **External platform dependency — Moodle 5.2 core block API.** This feature depends only on the Moodle 5.2 core block API (block lifecycle, `applicable_formats()` placement, capability registration through `db/access.php`, and the privacy subsystem). No other Feature is a prerequisite for this feature.
- **Intra-feature dependency — all four child stories depend on STORY-001-01-01 (scaffold).** The capability definitions (STORY-001-01-02), the placement rule (STORY-001-01-03), and the privacy provider (STORY-001-01-04) each attach to the block scaffold, so the scaffold must exist first.
- **Downstream dependents — FEATURE-001-02 and FEATURE-001-03 depend on this feature.** The block must exist before any engagement signal is computed (FEATURE-001-02) or any risk highlight is rendered (FEATURE-001-03); both dependent features build on the scaffold, capabilities, and placement defined here.

## Definition of Done

- [ ] All 4 User Stories in this feature are authored and linked from the User Stories Index, and every index link resolves to an authored file.
- [ ] The block class (`block_classpulse` extending `block_base`), the `version.php` plugin descriptor, the English language strings, and the `pix/` icon are documented (STORY-001-01-01).
- [ ] The two capabilities `block/classpulse:addinstance` and `block/classpulse:view` are documented at `CONTEXT_BLOCK`, with an authorization criterion stating the block exposes only data the viewing role is authorized to see (STORY-001-01-02).
- [ ] Opt-in per-course placement through `applicable_formats()` is documented, including that the block is not auto-added and is not placed at site or dashboard scope by default (STORY-001-01-03).
- [ ] The privacy provider declaring no new stored personal data — while naming the external Moodle sources the block reads — is documented (STORY-001-01-04).
- [ ] Every User Story satisfies the six INVEST principles (Independent, Negotiable, Valuable, Estimable, Small, Testable) and is demonstrable for Product Owner acceptance.
- [ ] Every User Story carries 4–8 acceptance criteria in Given/When/Then form, with required coverage of one input-validation scenario, one valid-output scenario, one error-handling scenario, and one edge/boundary scenario.
- [ ] Every User Story enumerates 3–5 edge cases spanning Empty/Null Input, Boundary Values, Invalid Input, and Concurrent/Conflicting Operations where applicable.
- [ ] Zero forbidden terms (approximately, several, various, adequate, appropriate, properly, correctly, efficiently, quickly, easily, user-friendly, reasonable, sufficient) appear in any acceptance criterion.
- [ ] Every User Story names a concrete actor (for example Course Teacher, Site Administrator, Moodle Plugin Developer, Data Protection Officer) rather than a generic "user."
- [ ] Every User Story includes an Effort / Complexity / Uncertainty assessment with a Fibonacci point estimate (1, 2, 3, 5, 8, 13) and a story-level Definition of Done.

## Key Citations

- Source: public/blocks/accessreview/block_accessreview.php — block class extending `block_base`, with `applicable_formats()`, `instance_allow_multiple()`, and the cached `get_content()` the Class Pulse scaffold mirrors.
- Source: public/blocks/accessreview/db/access.php — capability model analog (`addinstance` write capability plus `view` read capability at `CONTEXT_BLOCK`).
- Source: public/blocks/accessreview/version.php — plugin descriptor declaring `$plugin->component`, `$plugin->version`, and `$plugin->requires`.
- Source: public/blocks/accessreview/classes/privacy/provider.php — privacy provider pattern implementing the core privacy metadata provider interface.
- Source: public/blocks/accessreview/lang/en/block_accessreview.php — language string pattern for block titles and capability names.
- Source: public/version.php — Moodle 5.2dev (Build: 20251024), branch 502, confirming the `public/` webroot that validates the `public/blocks/classpulse/` plugin path.

[⬅ Back to EPIC-001](../EPIC-001-classpulse-engagement-risk-block.md)
