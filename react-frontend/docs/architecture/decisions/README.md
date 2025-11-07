# Architecture Decision Records (ADRs)

## Overview

This directory contains Architecture Decision Records (ADRs) documenting all major architectural and technical decisions made during the Moodle React frontend refactoring project. Each ADR captures the context, decision, consequences, and alternatives considered for significant architectural choices.

## About This Refactoring

This project transforms Moodle's PHP server-side rendering architecture into a modern React 18 + TypeScript single-page application (SPA) while maintaining 100% backward compatibility with all existing Moodle functionality. The refactoring follows these core principles:

- **Backend Preservation**: All existing PHP business logic remains completely intact (zero modifications to 17,875 PHP files)
- **API Layer**: New RESTful JSON API provides thin wrappers around existing Moodle core functions
- **Minimal Change**: Fewer than 2% of existing files modified (<64 files), with >95% of changes being new code additions
- **Gradual Migration**: Feature flags enable safe, incremental rollout from low-risk to high-complexity features
- **Zero Data Changes**: Existing MySQL/PostgreSQL database schema remains completely unchanged

All architectural decisions prioritize:
1. Backward compatibility and minimal disruption
2. Safety and risk mitigation
3. Maintainability and code quality
4. User experience and performance

## What are Architecture Decision Records?

Architecture Decision Records (ADRs) are documents that capture important architectural decisions along with their context and consequences. They serve as:

- **Historical Record**: Explain why decisions were made at a specific point in time
- **Knowledge Transfer**: Help new team members understand architectural reasoning
- **Decision Accountability**: Make implicit decisions explicit and reviewable
- **Future Reference**: Provide context when revisiting or challenging past decisions

### When to Create an ADR

Create an ADR when making decisions that:

- Affect the structure, non-functional characteristics, dependencies, interfaces, or construction techniques of the system
- Are difficult or expensive to reverse later
- Have significant impact on multiple components or teams
- Involve trade-offs between competing concerns
- Are likely to be questioned or need justification in the future

**Examples requiring ADRs**:
- Choice of frameworks, libraries, or major dependencies
- Authentication and security strategies
- State management patterns
- API design approaches
- Database schema decisions
- Build and deployment strategies

**Examples NOT requiring ADRs**:
- Minor implementation details within a single component
- Temporary experimental code
- Personal coding style preferences
- Decisions easily reversible without significant impact

## ADR Template Structure

Each ADR follows this standard template:

```markdown
# ADR NNNN: [Short Title]

## Status
[PROPOSED | ACCEPTED | DEPRECATED | SUPERSEDED]

## Context
What is the issue we're seeing that is motivating this decision or change?
- Technical background
- Business requirements
- Constraints and forces
- Current situation

## Decision
What is the change that we're proposing and/or doing?
- Clear statement of the decision
- How it will be implemented
- Key principles and patterns
- Specific requirements

## Consequences
What becomes easier or more difficult to do because of this change?

**Positive**:
- List of benefits and improvements

**Negative**:
- Drawbacks and limitations
- New complexities introduced

**Trade-offs**:
- What we're giving up to gain other benefits

## Alternatives Considered
What other options were evaluated?
- Alternative 1: Description and why rejected
- Alternative 2: Description and why rejected
- Alternative N: Description and why rejected

## References
- Links to related documents, ADRs, or external resources
- Agent Action Plan sections
- Implementation file paths
```

## ADR Naming Convention

ADRs are numbered sequentially and use kebab-case for the title:

```
NNNN-descriptive-title-with-dashes.md
```

Examples:
- `0001-jwt-authentication-strategy.md`
- `0002-state-management-separation.md`
- `0003-material-ui-component-library.md`

The four-digit prefix ensures proper ordering and allows for up to 9,999 ADRs (more than sufficient).

## Complete ADR Index

### ADR 0001: JWT Authentication Strategy
**Status**: ACCEPTED

**Summary**: Implements JWT (JSON Web Token) based authentication as a layer on top of existing Moodle authentication methods. Uses 1-hour access tokens and 7-day refresh tokens with HS256 algorithm, enabling stateless API authentication while preserving all existing auth plugins (LDAP, SSO, OAuth2, local).

**Key Decision**: JWT tokens issued after successful authentication via existing `authenticate_user_login()` functions, with server-side token blacklist in Redis for logout functionality.

**Reference**: [0001-jwt-authentication-strategy.md](./0001-jwt-authentication-strategy.md)

---

### ADR 0002: State Management Separation (Redux Toolkit + React Query)
**Status**: ACCEPTED

**Summary**: Strategically separates state management concerns using Redux Toolkit for global application state (authentication, user preferences, theme, UI state) and React Query (TanStack Query) for all server state (courses, assignments, grades, messages). Avoids mixing these fundamentally different state types in a single solution.

**Key Decision**: React Query handles ALL data from API endpoints with automatic caching, invalidation, and optimistic updates. Redux Toolkit manages client-only state that doesn't come from the server.

**Reference**: [0002-state-management-separation.md](./0002-state-management-separation.md)

---

### ADR 0003: Material-UI v5 Component Library Selection
**Status**: ACCEPTED

**Summary**: Selects Material-UI v5 (MUI) as the exclusive UI component library for the entire React frontend. Provides 60+ accessible, themeable components with comprehensive TypeScript support, dark mode capability, and responsive design patterns.

**Key Decision**: ALL UI components must use or extend MUI components. No mixing with other UI libraries (Bootstrap, Ant Design, Chakra UI). Single centralized theme configuration with Moodle brand colors.

**Reference**: [0003-material-ui-component-library.md](./0003-material-ui-component-library.md)

---

### ADR 0004: Thin API Wrapper Pattern
**Status**: ACCEPTED

**Summary**: Mandates that all 127 API endpoints follow a thin wrapper pattern where each endpoint calls existing Moodle core functions without duplicating business logic. API layer provides stateless JSON wrappers around functions like `get_course()`, `enrol_try_internal_enrol()`, and `assign_save_submission()`.

**Key Decision**: Zero business logic duplication. Every API endpoint must call existing functions, enforce permissions via `require_capability()`, and return standardized JSON responses. No grade calculations, permission checks, or enrollment logic reimplemented in API code.

**Reference**: [0004-thin-api-wrapper-pattern.md](./0004-thin-api-wrapper-pattern.md)

---

### ADR 0005: Zero Backend Modification Principle
**Status**: ACCEPTED

**Summary**: Enforces zero modifications to 17,875 existing PHP files except for 3 append-only configuration files (config.php, composer.json, web server config). Protected directories include /lib/ (847 files), /mod/*/lib.php (342 files), /auth/ (89 files), /backup/, and /admin/cli/. Database schema completely immutable.

**Key Decision**: Modification rate of 0.017% (3 files out of 17,875), with 49 lines appended and zero lines modified. All new functionality isolated in /react-frontend/ (320 files) and /api/ (127 files) directories.

**Reference**: [0005-zero-backend-modification.md](./0005-zero-backend-modification.md)

---

### ADR 0006: Feature Flag Gradual Rollout Strategy
**Status**: ACCEPTED

**Summary**: Implements feature flag system in config.php enabling gradual rollout from low-risk to high-complexity features. Supports coexistence of PHP-rendered and React interfaces during transition, with per-user and per-feature controls.

**Key Decision**: Five-phase rollout sequence (Dashboard → Courses → Forums/Messaging → Assignments/Quizzes → Gradebook/Admin) over 14 weeks. Instant rollback capability via feature flags without code deployment required.

**Reference**: [0006-feature-flag-gradual-rollout.md](./0006-feature-flag-gradual-rollout.md)

---

### ADR 0007: TypeScript Strict Mode Enforcement
**Status**: ACCEPTED

**Summary**: Enforces TypeScript strict mode across the entire React frontend with zero `any` types allowed in production code. All components require explicit prop interfaces, all API responses must have type definitions, and ESLint rules enforce type safety.

**Key Decision**: Enable all strict compiler options (noImplicitAny, strictNullChecks, strictFunctionTypes, etc.) from day one. Type inference preferred where obvious, explicit types mandatory for public APIs and component props.

**Reference**: [0007-typescript-strict-mode.md](./0007-typescript-strict-mode.md)

---

### ADR 0008: React 18 Concurrent Rendering Patterns
**Status**: ACCEPTED

**Summary**: Fully adopts React 18 concurrent rendering features including automatic batching for performance optimization, Suspense boundaries for data fetching and lazy loading, useTransition for non-urgent updates, and useDeferredValue for expensive computations.

**Key Decision**: Leverage concurrent features to maintain responsive UI during heavy operations (large gradebook renders, quiz with 50+ questions) and meet <500ms subsequent navigation performance target.

**Reference**: [0008-react-18-concurrent-rendering.md](./0008-react-18-concurrent-rendering.md)

---

## ADR Status Definitions

- **PROPOSED**: Decision proposed but not yet approved
- **ACCEPTED**: Decision approved and implemented (or in progress)
- **DEPRECATED**: Decision no longer recommended but not yet superseded
- **SUPERSEDED**: Decision replaced by a newer ADR (reference the superseding ADR)

## Guidelines for Creating New ADRs

### Step 1: Identify the Need

Before creating an ADR, ensure the decision:
- Has significant architectural impact
- Affects multiple components or teams
- Involves meaningful trade-offs
- Is difficult to reverse later
- Needs to be communicated to the team

### Step 2: Draft the ADR

1. Copy the ADR template from this document
2. Assign the next sequential number (check existing ADRs)
3. Write a concise, descriptive title in kebab-case
4. Fill in all sections:
   - **Context**: Explain the problem and constraints thoroughly
   - **Decision**: State the decision clearly and unambiguously
   - **Consequences**: List both positives and negatives honestly
   - **Alternatives**: Document other options considered and why they were rejected
   - **References**: Link to relevant documentation and implementation

### Step 3: Review Process

1. **Self-Review**: Ensure all sections are complete and clear
2. **Peer Review**: Share draft with 2-3 team members for feedback
3. **Architecture Review**: Present to Architecture Review Board if decision impacts:
   - Multiple features or modules
   - Core infrastructure or frameworks
   - Security or data integrity
   - Backend PHP code (rare given zero-modification principle)
4. **Approval**: Mark as ACCEPTED once consensus reached

### Step 4: Implementation

1. Update ADR status from PROPOSED to ACCEPTED
2. Reference the ADR in related PRs and commits
3. Link implementation files back to the ADR
4. Update this README.md index with the new ADR

### Step 5: Maintenance

- **Amending**: Minor clarifications can be added directly to existing ADRs
- **Superseding**: If a decision changes significantly, create a new ADR that supersedes the old one
- **Deprecating**: Mark ADRs as DEPRECATED when no longer recommended but not yet replaced

## ADR Review and Approval Process

### Standard Review (Most ADRs)

**Timeline**: 3-5 business days

**Process**:
1. Author creates ADR and marks as PROPOSED
2. Author posts ADR link in team channel for review
3. Team members provide feedback via comments
4. Author addresses feedback and updates ADR
5. After 3 days with no objections, mark as ACCEPTED
6. Update README.md index

**Reviewers**: Minimum 2 senior developers

### Architecture Review Board (Critical ADRs)

**Timeline**: 1-2 weeks

**Triggers**:
- Changes to core frameworks or libraries
- Security-related decisions
- Performance-critical architectural changes
- Modifications to protected backend files (exceptional cases)
- Decisions affecting third-party plugin compatibility

**Process**:
1. Author creates ADR and marks as PROPOSED
2. Author schedules ARB meeting (held weekly)
3. Author presents ADR with 10-15 minute presentation
4. ARB members ask questions and discuss trade-offs
5. ARB votes on approval (unanimous for backend modifications)
6. Author updates ADR based on feedback
7. Mark as ACCEPTED once approved

**ARB Members**: Technical Lead, Senior Backend Developer, Senior Frontend Developer, DevOps Lead

## When to Supersede or Amend ADRs

### Amending an Existing ADR

**Appropriate for**:
- Clarifying ambiguous wording
- Adding implementation notes or lessons learned
- Correcting factual errors
- Updating references or links
- Minor adjustments to decision without changing core intent

**Process**:
1. Edit the existing ADR directly
2. Add a note at the top: "Amended: [Date] - [Brief description]"
3. Update the "References" section if needed
4. No new ADR number required

### Superseding an ADR

**Appropriate for**:
- Reversing a previous decision
- Significantly changing the approach
- Adopting a new pattern that replaces the old one
- Discovering the original decision was fundamentally flawed

**Process**:
1. Create a new ADR with the next sequential number
2. Reference the old ADR in the "Context" section
3. Explain why the previous decision is being superseded
4. Update the old ADR:
   - Change status to SUPERSEDED
   - Add reference to the new ADR at the top
5. Update this README.md to reflect both ADRs

**Example**:
```markdown
# ADR 0002: State Management Separation

## Status
SUPERSEDED by ADR 0015: Unified State Management with Jotai
```

## Linking ADRs to Implementation Files

Each ADR should include references to the implementation files where the decision is applied. This creates bidirectional traceability.

**In ADRs**:
```markdown
## References
- Implementation: `react-frontend/src/app/store.ts`
- Implementation: `react-frontend/src/features/auth/store/authSlice.ts`
- Tests: `react-frontend/tests/unit/auth/authSlice.test.ts`
```

**In Implementation Files**:
```typescript
/**
 * Redux store configuration
 * 
 * Architecture Decision: See ADR 0002 (State Management Separation)
 * This store only manages global client state (auth, preferences, UI).
 * All server state is managed by React Query.
 */
export const store = configureStore({
  reducer: {
    auth: authReducer,
    preferences: preferencesReducer,
    ui: uiReducer
  }
});
```

## Quick Reference: Decision Framework

Use this framework when making architectural decisions:

### 1. Define the Problem
- What specific issue are we solving?
- What are the constraints and requirements?
- What are the forces at play (performance, security, maintainability, etc.)?

### 2. Identify Options
- What are the possible solutions?
- What patterns or technologies could address this?
- What have others done in similar situations?

### 3. Evaluate Trade-offs
For each option, consider:
- **Pros**: Benefits and advantages
- **Cons**: Drawbacks and limitations
- **Risks**: What could go wrong?
- **Complexity**: How hard to implement and maintain?
- **Reversibility**: How difficult to change later?
- **Cost**: Time, money, technical debt

### 4. Choose and Document
- Select the option that best fits the constraints
- Document the decision in an ADR
- Explain why alternatives were rejected
- Be honest about trade-offs and limitations

### 5. Implement and Learn
- Apply the decision consistently
- Monitor outcomes and metrics
- Be willing to admit when a decision needs to be revisited
- Update ADRs with lessons learned

## Frequently Asked Questions

**Q: Do I need to create an ADR for every technical decision?**

A: No. Only document decisions that are architectural in nature, difficult to reverse, or likely to be questioned later. Local implementation details don't need ADRs.

**Q: Can I create an ADR retroactively for past decisions?**

A: Yes! If an important decision was made without an ADR, documenting it retroactively still provides value. Mark the date when the decision was originally made.

**Q: What if the decision proves to be wrong?**

A: Create a new ADR superseding the old one. Explain what was learned and why the new approach is better. Don't delete or hide the old ADR - it's valuable history.

**Q: How detailed should the Context section be?**

A: Detailed enough that someone unfamiliar with the project can understand why the decision was necessary. Include technical background, business requirements, and constraints.

**Q: Can I propose multiple alternatives in a single ADR?**

A: No. Each ADR documents one decision. If you're comparing options, create a PROPOSED ADR for each option and use the review process to decide between them.

**Q: How do I handle decisions that span multiple repositories or services?**

A: Create ADRs in each repository's documentation, cross-referencing each other. This maintains local context while ensuring the decision is documented everywhere it applies.

## Contributing to ADRs

All team members are encouraged to:
- Review proposed ADRs and provide constructive feedback
- Suggest new ADRs when architectural questions arise
- Reference ADRs in code reviews and technical discussions
- Update ADRs with implementation learnings and gotchas
- Challenge outdated or problematic ADRs

**Remember**: ADRs are living documents. They should reflect our current understanding and can be amended as we learn.

## Related Documentation

- [Architecture Overview](../README.md) - High-level system architecture
- [Development Guidelines](../../development/) - Coding standards and practices
- [Agent Action Plan](../../../../docs/AGENT_ACTION_PLAN.md) - Complete refactoring plan
- [Technical Specification](../../../../docs/TECHNICAL_SPEC.md) - Detailed technical requirements

## References

- Agent Action Plan Section 0.1: Core Refactoring Objectives and Architectural Requirements
- Agent Action Plan Section 0.7: Special Instructions for Refactoring
- Agent Action Plan Section 0.3: Target Design and Architecture Transformation
- Michael Nygard's ADR template: http://thinkrelevance.com/blog/2011/11/15/documenting-architecture-decisions
- ADR GitHub Organization: https://adr.github.io/

---

**Last Updated**: 2024-01-15
**Maintained By**: Architecture Team
**Questions**: Contact the Technical Lead or post in #architecture channel
