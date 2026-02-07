# TEA Glossary

## Overview
This is a comprehensive terminology reference for Test Architect (TEA), part of the BMad (Breakthrough Method of Agile AI-Driven Development) framework.

## Core Concepts

| Term | Definition |
|------|-----------|
| **Agent** | Specialized AI persona with specific expertise (PM, Architect, SM, DEV, TEA) guiding users through workflows and creating deliverables |
| **BMad** | AI-driven agile framework with specialized agents, guided workflows, and scale-adaptive intelligence |
| **BMad Method** | Complete methodology for AI-assisted software development encompassing planning, architecture, implementation, and quality assurance |
| **BMM** | BMad Method Module -- core orchestration system providing lifecycle management through specialized agents and workflows |
| **Scale-Adaptive System** | Intelligent workflow orchestration adjusting planning depth based on project needs through three planning tracks |
| **Workflow** | Multi-step guided process orchestrating AI agent activities to produce specific deliverables |

## Scale and Complexity

| Term | Definition |
|------|-----------|
| **BMad Method Track** | Full product planning track using PRD + Architecture + UX for products and platforms (10-50+ stories) |
| **Enterprise Method Track** | Extended planning track adding Security Architecture, DevOps Strategy, and Test Strategy (30+ stories) |
| **Planning Track** | Methodology path chosen based on planning needs and complexity |
| **Quick Flow Track** | Fast implementation track using tech-spec only for bug fixes and small features (1-15 stories) |

## Planning Documents

| Term | Definition |
|------|-----------|
| **Architecture Document** | System-wide design defining structure, components, data models, integration patterns, security, and deployment |
| **Epics** | High-level feature groupings containing 5-15 related stories representing cohesive functionality |
| **Game Brief** | Document capturing game's core vision, pillars, target audience, and scope |
| **GDD** | Game Design Document -- comprehensive document detailing mechanics, systems, and content |
| **PRD** | Product Requirements Document containing vision, goals, FRs, NFRs, and success criteria |
| **Product Brief** | Optional strategic document capturing vision, market context, and high-level requirements |
| **Tech-Spec** | Comprehensive technical plan with problem statement, solution approach, file-level changes, and testing strategy |

## Workflow and Phases

| Term | Definition |
|------|-----------|
| **Phase 0: Documentation** | Brownfield conditional prerequisite creating codebase documentation |
| **Phase 1: Analysis** | Discovery phase including brainstorming, research, and product brief creation |
| **Phase 2: Planning** | Required phase creating formal requirements (tech-spec or PRD) |
| **Phase 3: Solutioning** | Architecture design phase including creation, validation, and gate checks |
| **Phase 4: Implementation** | Sprint-based development through story-by-story iteration |
| **Quick Spec Flow** | Fast-track workflow for Quick Flow projects from idea to tech-spec to implementation |
| **Workflow Init** | Initialization workflow creating bmm-workflow-status.yaml and determining planning track |
| **Workflow Status** | Universal entry point checking for existing status file and recommending next action |

## Agents and Roles

| Term | Definition |
|------|-----------|
| **Analyst** | Agent initializing workflows, conducting research, and creating product briefs |
| **Architect** | Agent designing system architecture and validating designs (primary for Phase 3) |
| **BMad Master** | Meta-level orchestrator facilitating party mode and high-level guidance |
| **DEV** | Developer agent implementing stories, writing code, running tests, and code reviews |
| **Game Architect** | Agent designing game system architecture and validating game-specific technical designs |
| **Game Designer** | Agent creating game design documents and running game-specific workflows |
| **Party Mode** | Multi-agent collaboration feature where agents discuss challenges together |
| **PM** | Product Manager agent creating PRDs and tech-specs (primary for Phase 2) |
| **SM** | Scrum Master agent managing sprints and coordinating implementation |
| **TEA** | Test Architect agent responsible for test strategy, quality gates, and NFR assessment |
| **Technical Writer** | Agent specialized in technical documentation, diagrams, and documentation standards |
| **UX Designer** | Agent creating UX design documents and interaction patterns |

## Status and Tracking

| Term | Definition |
|------|-----------|
| **bmm-workflow-status.yaml** | Tracking file showing current phase, completed workflows, and next recommended actions |
| **DoD** | Definition of Done -- criteria for marking story complete: implementation, tests, review, docs |
| **Epic Status Progression** | Lifecycle states: backlog -> in-progress -> done |
| **Gate Check** | Validation workflow ensuring PRD, Architecture, and Epics are aligned before Phase 4 |
| **Retrospective** | Workflow after each epic capturing learnings and improvements |
| **sprint-status.yaml** | Single source of truth for implementation tracking with all epics and stories |
| **Story Status Progression** | Lifecycle states: backlog -> ready-for-dev -> in-progress -> review -> done |

## Project Types

| Term | Definition |
|------|-----------|
| **Brownfield** | Existing project with established codebase and patterns requiring integration understanding |
| **Convention Detection** | Feature auto-detecting existing code style, naming conventions, and frameworks |
| **document-project** | Workflow analyzing and documenting existing codebase with three scan levels |
| **Feature Flags** | Implementation technique for gradual rollout, easy rollback, and A/B testing |
| **Greenfield** | New project starting from scratch with freedom to establish patterns and design |
| **Integration Points** | Specific locations where new code connects with existing systems |

## Implementation Terms

| Term | Definition |
|------|-----------|
| **Context Engineering** | Loading domain-specific standards into AI context via manifests |
| **Correct Course** | Workflow for navigating significant changes when implementation is off-track |
| **Shard / Sharding** | Splitting large planning documents into section-based files for LLM optimization |
| **Sprint** | Time-boxed period of development work, typically 1-2 weeks |
| **Sprint Planning** | Workflow initializing Phase 4 by creating sprint-status.yaml |
| **Story** | Single unit of implementable work with clear acceptance criteria (2-8 hours effort) |
| **Story Context** | Implementation guidance embedded in story files referencing existing patterns |
| **Story File** | Markdown file containing description, acceptance criteria, technical notes, and testing requirements |
| **Track Selection** | Automatic analysis suggesting appropriate track based on complexity indicators |

## Game Development Terms

| Term | Definition |
|------|-----------|
| **Core Fantasy** | The emotional experience players seek from a game |
| **Core Loop** | Fundamental cycle of actions players repeat throughout gameplay |
| **Design Pillar** | Core principle guiding design decisions (typically 3-5 pillars) |
| **Environmental Storytelling** | Narrative communicated through the game world itself |
| **Game Type** | Genre classification determining which specialized GDD sections are included |
| **MDA Framework** | Mechanics -> Dynamics -> Aesthetics framework for analyzing and designing games |
| **Meta-Progression** | Persistent progression carrying between individual runs or sessions |
| **Metroidvania** | Genre featuring interconnected world exploration with ability-gated progression |
| **Narrative Complexity** | How central story is (Critical, Heavy, Moderate, or Light) |
| **Permadeath** | Game mechanic where character death is permanent |
| **Player Agency** | Degree to which players can make meaningful choices affecting outcomes |
| **Procedural Generation** | Algorithmic creation of game content rather than hand-crafted |
| **Roguelike** | Genre featuring procedural generation, permadeath, and run-based progression |

## Test Architect (TEA) Concepts

| Term | Definition |
|------|-----------|
| **ATDD** | Acceptance Test-Driven Development -- generating failing acceptance tests BEFORE implementation |
| **Burn-in Testing** | Running tests multiple times (5-10 iterations) to detect flakiness |
| **Component Testing** | Testing UI components in isolation using framework-specific tools |
| **Coverage Traceability** | Mapping acceptance criteria to implemented tests with FULL/PARTIAL/NONE classification |
| **Epic-Level Test Design** | Test planning per epic focusing on risk assessment, priorities, and coverage strategy |
| **Fixture Architecture** | Pattern of building pure functions then wrapping in framework-specific fixtures |
| **Gate Decision** | Go/no-go decision with outcomes: PASS, CONCERNS, FAIL, WAIVED |
| **Knowledge Fragment** | Individual markdown file covering specific testing pattern or practice |
| **MCP Enhancements** | Model Context Protocol servers enabling live browser verification during test generation |
| **Network-First Pattern** | Testing pattern waiting for actual network responses instead of fixed timeouts |
| **NFR Assessment** | Validation of non-functional requirements with evidence-based decisions |
| **Playwright Utils** | Optional package providing production-ready fixtures and utilities for Playwright tests |
| **Risk-Based Testing** | Testing approach where depth scales with business impact using probability x impact scoring |
| **System-Level Test Design** | Test planning at architecture level focusing on testability review and test infrastructure |
| **tea-index.csv** | Manifest file tracking all knowledge fragments, descriptions, tags, and workflows |
| **TEA Integrated** | Full BMad Method integration with TEA workflows across all phases |
| **TEA Lite** | Beginner approach using just automate to test existing features |
| **TEA Solo** | Standalone engagement model using TEA without full BMad Method integration |
| **Test Priorities** | Classification: P0 (critical path), P1 (high value), P2 (medium value), P3 (low value) |

## Related Resources

- TEA Overview -- complete TEA capabilities
- TEA Knowledge Base -- fragment index
- TEA Command Reference -- workflow reference
- TEA Configuration -- configuration options
