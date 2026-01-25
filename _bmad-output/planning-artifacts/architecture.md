---
stepsCompleted: [1]
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/prd-validation-report.md
  - _bmad-output/planning-artifacts/ux-design-specification.md
  - docs/project-context.md
  - docs/index.md
  - docs/architecture-overview.md
  - docs/data-models.md
  - docs/service-layer.md
  - docs/technology-stack.md
  - docs/api-reference.md
  - docs/state-management.md
  - docs/component-inventory.md
workflowType: 'architecture'
project_name: 'My-Love'
user_name: 'Salvain'
date: '2026-01-25'
sourceOfTruth: '_bmad-output/planning-artifacts/prd.md'
classification:
  projectType: web_app
  domain: general
  complexity: medium-high
  projectContext: brownfield
featureContext:
  name: "Scripture Reading for Couples — A Responsive Reading (NKJV)"
  modes:
    - solo
    - together
  keyCapabilities:
    - "Overview stats dashboard"
    - "Solo guided reading flow"
    - "Together real-time synchronized flow"
    - "Lobby with ready states and countdown"
    - "Reflection tracking (rating, bookmark, notes)"
    - "Daily Prayer Report"
  technicalScope:
    - "5 new Supabase tables"
    - "Supabase Broadcast real-time sync"
    - "State machine for together mode"
    - "New Zustand slice"
    - "IndexedDB offline-first service"
constraints:
  - Zustand state management (slice pattern)
  - Supabase Broadcast for real-time sync
  - IndexedDB offline-first (solo mode)
  - Service layer architecture
  - WCAG AA accessibility
  - prefers-reduced-motion support
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._
