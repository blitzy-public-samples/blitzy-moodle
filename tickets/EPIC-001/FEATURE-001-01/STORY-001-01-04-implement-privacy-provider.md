# STORY-001-01-04: Implement privacy provider

## User Story

**As a** Data Protection Officer,
**I want** the Class Pulse block to declare a privacy provider stating it stores no new personal data while documenting the external Moodle sources it surfaces,
**So that** the plugin satisfies Moodle's privacy subsystem with an accurate data declaration.

This story documents only the privacy declaration of the Class Pulse block. Because Class Pulse v1 is read-only and introduces no new database tables, the block stores no new personal data of its own; the four engagement signals it displays are read from existing Moodle subsystems and are neither copied nor persisted by the block. The provider therefore takes one of two equivalent shapes — a null provider that supplies a `get_reason()` language string, or a metadata provider whose `get_metadata()` declares no stored items — and in either shape it records, for audit purposes, the external Moodle sources whose data the block surfaces. The pattern mirrors the verified `block_accessreview` privacy provider, which implements the core privacy metadata interface and declares its stored data through `get_metadata()`; the difference for Class Pulse is that the declaration lists no stored items because the block owns none.

### Read sources (read, not stored)

The block surfaces four engagement signals that originate in existing Moodle subsystems. The privacy declaration records these as the origin of displayed data and states that the block reads but does not persist them.

| Engagement signal | External Moodle source | Class Pulse data handling |
|-------------------|------------------------|---------------------------|
| Days since last site login | Site login fields on the user record (`user.lastlogin` / `user.lastaccess`) | Read at render time; not stored |
| Overdue assignments in this course | Assignment module (`mod_assign`) | Read at render time; not stored |
| Quiz score trend (last three attempts) | Quiz module (`mod_quiz`) | Read at render time; not stored |
| Last activity interaction in this course | Standard log store (`report/log`) | Read at render time; not stored |

## Acceptance Criteria

Each scenario is authored in Given/When/Then form, mirrors the repository Gherkin convention (Source: `.gherkin-lintrc`; canonical narrative in `public/blocks/accessreview/tests/behat/accessreview.feature`), and resolves to a binary pass or fail outcome.

**Scenario 1 — Privacy provider is declared (valid output)**

- **Given** the `block_classpulse` plugin contains a provider class in `classes/privacy/provider.php`,
- **When** the Moodle privacy registry is generated,
- **Then** the block is reported as having a declared privacy provider.

**Scenario 2 — Declaration records no stored personal data (input validation)**

- **Given** Class Pulse v1 stores no new personal data and adds no new database tables,
- **When** the privacy declaration is read,
- **Then** it states the block stores no personal data of its own.

**Scenario 3 — Declaration names the external read sources (valid output)**

- **Given** the block surfaces data read from the site login, assignment, quiz, and log subsystems,
- **When** the privacy declaration is reviewed,
- **Then** it names those four external Moodle sources as the origin of the displayed engagement signals and states the block reads but does not persist that data.

**Scenario 4 — Missing provider is reported (error handling)**

- **Given** the privacy provider class is absent from `classes/privacy/provider.php`,
- **When** the Moodle privacy registry is generated,
- **Then** the block is reported as missing a privacy provider.

**Scenario 5 — Export for a student with no stored data completes empty (edge/boundary)**

- **Given** a privacy data export is requested for a student who has no Class Pulse-stored data,
- **When** the export runs,
- **Then** it completes with zero Class Pulse personal-data records.

**Scenario 6 — Privacy metadata language string resolves (valid output)**

- **Given** the privacy declaration references a language string describing the no-data reason (mirroring the analog's `privacy:metadata` string pattern),
- **When** the plugin's language strings are loaded,
- **Then** the referenced privacy string resolves to defined text and no missing-string placeholder is shown.

## Sub-Tasks

- [ ] Add `classes/privacy/provider.php` implementing `core_privacy\local\metadata\null_provider` (or `core_privacy\local\metadata\provider` declaring no stored items) @assignee
- [ ] Declare that the block stores no new personal data and adds no new database tables @assignee
- [ ] Document the external read sources surfaced (site login, `mod_assign`, `mod_quiz`, log store) as read, not stored @assignee
- [ ] Add `privacy:metadata` language string(s) describing the declaration / null-provider reason in `lang/en/block_classpulse.php` @assignee
- [ ] Cross-reference the read access governed by `block/classpulse:view` (STORY-001-01-02) so the declared scope matches the data the block shows @assignee

## Edge Cases

- **Empty/Null Input** — a privacy data export is requested for a student who has no Class Pulse-stored data: the export completes with zero Class Pulse personal-data records.
- **Invalid Input / Missing provider** — the `classes/privacy/provider.php` class is absent: the privacy registry reports the block as missing a provider, which is a compliance defect.
- **Boundary Values / Future change** — a later version adds a stored user preference or datum: the provider can no longer carry the no-data declaration and must be updated to declare that stored item.
- **Concurrent/Conflicting Operations** — a privacy export is requested while a Course Teacher edits the block's threshold configuration: the export reports no Class Pulse-stored personal data regardless of the in-progress threshold edit.

## Dependencies

- **Prerequisite — STORY-001-01-01 (scaffold).** The privacy provider attaches to the `block_classpulse` plugin; the plugin and its `classes/` directory must exist before the provider class can be added. See [STORY-001-01-01 — Scaffold block plugin skeleton](./STORY-001-01-01-scaffold-block-plugin-skeleton.md).
- **Related — STORY-001-01-02 (access capabilities).** The read access the block exercises is governed by `block/classpulse:view`; the privacy declaration describes data the block reads under that authorization. See [STORY-001-01-02 — Define access capabilities](./STORY-001-01-02-define-access-capabilities.md).
- **External platform dependency — Moodle privacy subsystem.** This story depends on the Moodle 5.2 core privacy API (`core_privacy\local\metadata\null_provider` or `core_privacy\local\metadata\provider`); no new database table is introduced.

## Estimation

| Dimension | Assessment | Rationale |
|-----------|------------|-----------|
| Effort | Low | A single provider class declaring no stored data, plus one language string. |
| Complexity | Low | A null/no-data declaration with no export logic for the block's own data and no data model. |
| Uncertainty | Low | The privacy provider pattern is verified against the existing `block_accessreview` plugin in this repository. |

**Story point estimate: 2 (Fibonacci).**

## Definition of Done

- [ ] A privacy provider is documented as either a `null_provider` (with a `get_reason()` language string) or a `metadata\provider` whose `get_metadata()` declares no stored items.
- [ ] The declaration that Class Pulse stores no new personal data and adds no new database tables is stated explicitly.
- [ ] The four external read sources (site login, `mod_assign`, `mod_quiz`, log store) the block surfaces are documented as read, not stored.
- [ ] At least one `privacy:metadata` (or null-provider reason) language string is documented, mirroring the analog string pattern.
- [ ] The story satisfies the six INVEST principles (Independent, Negotiable, Valuable, Estimable, Small, Testable) and is demonstrable for Product Owner acceptance.
- [ ] The story carries 4–8 acceptance criteria in Given/When/Then form covering one valid-output, one input-validation, one error-handling, and one edge/boundary scenario, each with a binary pass/fail outcome.
- [ ] The story enumerates 3–5 edge cases spanning Empty/Null Input, Boundary Values, Invalid Input, and Concurrent/Conflicting Operations.
- [ ] Zero forbidden terms appear in any acceptance criterion.
- [ ] Key Citations reference the grounding Moodle source paths.

## Key Citations

- Source: public/blocks/accessreview/classes/privacy/provider.php — the privacy provider pattern (namespace `block_accessreview\privacy`, `class provider implements \core_privacy\local\metadata\provider`, and `get_metadata(collection $items)` declaring its stored items) that the Class Pulse no-data provider mirrors while declaring no stored items of its own.
- Source: public/blocks/accessreview/lang/en/block_accessreview.php — the `privacy:metadata` language-string pattern (for example `privacy:metadata:preference:block_accessreviewtogglestate`) that the Class Pulse privacy reason / metadata string mirrors.

[⬅ Back to FEATURE-001-01](../FEATURE-001-01-block-scaffold-and-placement.md)
