# Sprint Change Proposal: Epic 0 Creation

**Date:** 2025-11-17
**Author:** Frank (via /bmad:bmm:workflows:correct-course)
**Trigger:** User identified Epic 1 assumes deployment exists, should CREATE it first
**Scope:** Minor → Moderate (Epic insertion, no renumbering)
**Status:** ✅ APPROVED & IMPLEMENTED

---

## Section 1: Issue Summary

### Problem Statement

Epic 1 ("PWA Foundation Audit & Stabilization") is positioned as the foundational epic, but it operates with a **validation mindset** rather than a **creation mindset**. Specifically:

- **Story 1.1** audits existing deployment
- **Story 1.2** validates Supabase configuration
- Epic 1 assumes deployment pipeline exists and just needs fixing

### Discovery Context

Issue identified during Epic 1 tech spec review when user asked:

> "shouldn't the first epic/story be to correctly set up deployment, actions for automated deployments, and CORRECT UP TO FUCKING DATE connection with our backend?"

This question revealed a fundamental sequencing issue: **Epic 1 validates something that doesn't exist yet**.

### Evidence

1. **PRD Line 768** ("Recommended Next Workflow") prioritizes "Deployment Repair" as critical
2. **Tech Spec Story 1.1** (line 26) states: "Validate GitHub Pages deployment pipeline succeeds" - **assumes it exists**
3. **Architecture Line 167-171**: Deployment section mentions GitHub Pages but doesn't confirm it's configured
4. **Current State**: No `.github/workflows/deploy.yml` exists, Supabase project may not be initialized

**Conclusion:** Deployment infrastructure and backend connection likely need to be **CREATED from scratch**, not just validated.

---

## Section 2: Impact Analysis

### Epic Impact

#### Current Epic (Epic 1)

- **Affected:** Epic 1's assumption that deployment exists is incorrect
- **Modification Needed:** Epic 1 should AUDIT something that actually deploys, not CREATE the deployment
- **Sequencing:** Epic 1 becomes SECOND epic (after Epic 0 creates infrastructure)

#### Future Epics (Epic 2-7)

- **No conflicts:** Epic 2-7 are feature epics that depend on stable foundation
- **Benefit:** Epic 0 ensures they deploy to a WORKING environment

### Artifact Conflicts

#### PRD

- **Conflicts:** None
- **Alignment:** PRD line 768 explicitly recommends "Deployment Repair" as priority
- **MVP Impact:** No change to MVP scope

#### Architecture

- **Conflicts:** None
- **Enhancement:** Architecture Line 167-171 deployment section will be IMPLEMENTED by Epic 0
- **Technology Stack:** No changes (GitHub Pages + Supabase remain the plan)

#### UX Design

- **Conflicts:** None (Epic 0 is backend/deployment focused)

#### Other Artifacts

- **tech-spec-epic-1.md:** Remains valid but now Epic 1 audits what Epic 0 creates
- **sprint-status.yaml:** Updated to include Epic 0 entries

---

## Section 3: Recommended Approach

### Option Evaluation

#### ✅ Option 1: Direct Adjustment (SELECTED)

- **Approach:** Create Epic 0 with deployment/backend stories BEFORE Epic 1
- **Effort:** Low (no renumbering, minimal file changes)
- **Risk:** Low (adds foundation, doesn't change existing plans)
- **Timeline Impact:** None (adds 5 stories to backlog before Epic 1)
- **Team Impact:** Positive (clearer foundation-first approach)

#### ❌ Option 2: Rollback

- **Approach:** Revert Epic 1 tech spec, redesign as "create deployment"
- **Effort:** Medium (delete existing work, redesign)
- **Risk:** Medium (wasted effort on tech spec)
- **Rejected:** Unnecessary - Epic 1 tech spec is valuable for audit phase

#### ❌ Option 3: MVP Scope Reduction

- **Approach:** Remove deployment requirement from MVP
- **Effort:** N/A
- **Risk:** High (can't validate features without deployment)
- **Rejected:** Deployment is NON-NEGOTIABLE for PWA

### Rationale for Direct Adjustment

1. **Foundation-First Logic:** Deployment infrastructure IS the true foundation
2. **Minimal Disruption:** No renumbering of existing epics (user's explicit request)
3. **Risk Reduction:** Creates stable deployment BEFORE building features on it
4. **PRD Alignment:** Matches PRD recommendation for deployment priority
5. **Implementation Effort:** Low (5 straightforward stories, standard patterns)

---

## Section 4: Detailed Change Proposals

### Change 1: Insert Epic 0 in `docs/epics.md`

**Location:** Before Epic 1 (after line 83)

**Epic 0 Definition:**

- **Goal:** Establish automated deployment pipeline and backend connection infrastructure
- **User Value:** Reliable deployment automation and working backend connection as TRUE foundation
- **FRs Covered:** FR60 (deployment reliability), FR65 (network handling), partial FR1-4 (backend connection)
- **Stories:** 5 total

**Stories:**

1. **Story 0.1:** GitHub Actions Deployment Pipeline Setup
   - Create `.github/workflows/deploy.yml` for automated GitHub Pages deployment
   - Configure Vite build output to deploy on push to main
   - Verify deployed site is accessible

2. **Story 0.2:** Environment Variables & Secrets Management
   - Create `.env.example` for documentation
   - Configure GitHub Secrets for production Supabase credentials
   - Inject secrets into build via GitHub Actions

3. **Story 0.3:** Supabase Project Initialization & Connection Setup
   - Create Supabase project with appropriate region
   - Initialize database and configure connection pooling
   - Verify deployed PWA connects to Supabase successfully

4. **Story 0.4:** Production Deployment End-to-End Validation
   - Make code change → push → verify auto-deployment
   - Validate GitHub Pages reflects changes
   - Verify Supabase connection from deployed site
   - Check Lighthouse PWA score (≥ 80)

5. **Story 0.5:** Deployment Monitoring & Rollback Strategy (Optional)
   - Add health check step to GitHub Actions workflow
   - Document rollback procedure
   - Configure deployment notifications

**Rationale:** These stories create the infrastructure Epic 1 will later audit and stabilize.

---

### Change 2: Update Epic Count in `docs/epics.md`

**Location:** Line 40

**OLD:**

```markdown
**Total Epics: 7** | **Total FRs: 65** | **All FRs Covered: ✅**
```

**NEW:**

```markdown
**Total Epics: 8** | **Total FRs: 65** | **All FRs Covered: ✅**

### Epic 0: Deployment & Backend Infrastructure Setup

**Goal:** Establish automated deployment pipeline and backend connection infrastructure
**User Value:** Reliable deployment automation and working backend connection as TRUE foundation
**FRs Covered:** FR60, FR65, partial FR1-4 (4+ FRs)
**Stories:** 5 (GitHub Actions pipeline, Env vars/secrets, Supabase init, E2E validation, Monitoring)
```

**Rationale:** Epic count increases from 7 to 8, Epic 0 added to summary.

---

### Change 3: Update FR Coverage Map in `docs/epics.md`

**Location:** Line 183-192

**OLD:**

```markdown
| Epic                                             | FRs Covered                                            | Total |
| ------------------------------------------------ | ------------------------------------------------------ | ----- |
| **Epic 1: PWA Foundation Audit & Stabilization** | FR1, FR2, FR3, FR4, FR60, FR61, FR62, FR63, FR64, FR65 | 10    |
```

**NEW:**

```markdown
| Epic                                                  | FRs Covered                                            | Total |
| ----------------------------------------------------- | ------------------------------------------------------ | ----- |
| **Epic 0: Deployment & Backend Infrastructure Setup** | FR60, FR65, partial FR1-4 (backend connection)         | 4+    |
| **Epic 1: PWA Foundation Audit & Stabilization**      | FR1, FR2, FR3, FR4, FR60, FR61, FR62, FR63, FR64, FR65 | 10    |
```

**Rationale:** Epic 0 covers deployment (FR60) and network handling (FR65), plus enables backend connection needed for auth (FR1-4).

---

### Change 4: Insert Epic 0 in `docs/sprint-artifacts/sprint-status.yaml`

**Location:** Before Epic 1 (line 43)

**NEW:**

```yaml
# Epic 0: Deployment & Backend Infrastructure Setup
# NOTE: TRUE foundation - creates deployment pipeline and backend connection FIRST
epic-0: backlog # Deployment infrastructure must exist before audit
0-1-github-actions-deployment-pipeline: backlog # NEW: GitHub Actions + GitHub Pages deployment
0-2-environment-variables-secrets-management: backlog # NEW: Vite env vars + GitHub Secrets
0-3-supabase-project-initialization-connection: backlog # NEW: Supabase project setup + connection
0-4-production-deployment-validation: backlog # NEW: E2E deployment validation
0-5-deployment-monitoring-rollback-strategy: backlog # OPTIONAL: Health checks + rollback
epic-0-retrospective: optional
```

**Rationale:** Tracks Epic 0 stories in sprint management system, all start in backlog status.

---

## Section 5: Implementation Handoff

### Change Scope Classification

**Minor → Moderate**

- **Minor:** Only 2 files modified (epics.md, sprint-status.yaml)
- **Moderate:** Significant architectural implication (foundation-first approach)

### Handoff Recipients

**Primary:** Development team (for Epic 0 implementation)

- **Responsibility:** Execute Epic 0 stories (0.1 → 0.5) before starting Epic 1
- **Success Criteria:**
  - GitHub Actions deployment pipeline deploys successfully
  - Deployed site connects to Supabase
  - All Epic 0 stories marked as "done" in sprint-status.yaml

**Secondary:** Product Owner / Scrum Master

- **Responsibility:** Update sprint planning to reflect Epic 0 priority
- **Action:** Epic 0 → Epic 1 → Epic 2-7 sequence enforcement

### Implementation Sequence

1. **Epic 0.1:** Create GitHub Actions deployment workflow
2. **Epic 0.2:** Configure environment variables and GitHub Secrets
3. **Epic 0.3:** Initialize Supabase project and verify connection
4. **Epic 0.4:** Validate end-to-end deployment works
5. **Epic 0.5 (Optional):** Add deployment monitoring
6. **Epic 1:** Begin PWA foundation audit (NOW audits working deployment)

### Success Criteria

✅ **Deployment Success:**

- GitHub Actions workflow deploys on push to main
- GitHub Pages site is accessible and loads without errors
- Lighthouse PWA score ≥ 80

✅ **Backend Connection Success:**

- Deployed site connects to Supabase
- Auth API responds (magic link can be requested)
- Network tab shows successful Supabase requests

✅ **Documentation Alignment:**

- epics.md reflects Epic 0 → Epic 1 sequence
- sprint-status.yaml tracks all Epic 0 stories
- Epic 1 tech spec remains valid (now audits what Epic 0 created)

---

## Section 6: Approval & Implementation

### User Approval

**User Response:** "yes"

**Date:** 2025-11-17

**Approval Scope:** Complete Sprint Change Proposal approved for implementation

### Implementation Status

**Status:** ✅ IMPLEMENTED

**Files Modified:**

1. `docs/epics.md` - Epic 0 inserted, epic count updated, FR coverage map updated
2. `docs/sprint-artifacts/sprint-status.yaml` - Epic 0 entries added

**Git Commit:**

- Branch: `epic-1-implementation`
- Commit Message: "docs: add Epic 0 (Deployment & Backend Infrastructure) before Epic 1"
- Changes: 2 files modified (epics.md, sprint-status.yaml)

### Next Steps

1. **Development Team:** Begin Epic 0 implementation (Story 0.1 → 0.5)
2. **Product Owner:** Update sprint plan to prioritize Epic 0
3. **Architecture Review:** Epic 0 completion triggers Epic 1 contexting review
4. **Validation:** Epic 0.4 success gates Epic 1 start

---

## Appendix: Change Summary

**Epic Structure Change:**

```
OLD: Epic 1 → Epic 2 → ... → Epic 7 (7 epics total)
NEW: Epic 0 → Epic 1 → Epic 2 → ... → Epic 7 (8 epics total)
```

**Story Count Change:**

```
OLD: 34 stories across 7 epics
NEW: 39 stories across 8 epics (5 new stories in Epic 0)
```

**Foundation Philosophy:**

```
OLD: Epic 1 validates existing deployment
NEW: Epic 0 CREATES deployment, Epic 1 audits it
```

**Risk Reduction:**

- ✅ Deployment infrastructure exists BEFORE feature development
- ✅ Backend connection validated BEFORE auth flow implementation
- ✅ Foundation-first approach reduces "build on broken infrastructure" risk

---

**Document Status:** ✅ COMPLETE & IMPLEMENTED
**Workflow:** /bmad:bmm:workflows:correct-course
**User Mode:** Batch (all changes presented together)
**Approval:** Explicit user approval received
