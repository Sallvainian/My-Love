# Deployment Rollback Procedures

**Last Updated**: 2025-11-21
**Owner**: Frank
**Related Epic**: Epic 0 - Deployment & Backend Infrastructure Setup
**Related Story**: Story 0.5 - Deployment Monitoring & Rollback Strategy

---

## Overview

This document provides comprehensive rollback procedures for the My-Love PWA deployment to GitHub Pages. Rollback scenarios are categorized by failure type with clear decision criteria, step-by-step instructions, and estimated time to recovery (RTR).

**Automated Protection**: As of Story 0.5, health checks in the GitHub Actions workflow automatically prevent bad deployments from succeeding. This document covers procedures for scenarios where rollback is still necessary.

---

## Quick Decision Tree

```
┌─────────────────────────────────────┐
│   Deployment Issue Detected?        │
└───────────────┬─────────────────────┘
                │
                ├─ Health Check Failed During Deploy?
                │  └─► SCENARIO 1: No action needed (deployment blocked automatically)
                │
                ├─ Post-Deployment User-Reported Issue?
                │  └─► SCENARIO 2: Manual rollback required
                │
                └─ Need to Debug Deployment?
                   └─► SCENARIO 3: Revert and investigate
```

---

## Rollback Scenarios

### Scenario 1: Health Check Fails During Deployment (AUTOMATED)

**When This Happens**:
- GitHub Actions workflow reaches the `health-check` job
- HTTP status check fails (site returns non-200 status)
- Supabase connection check fails
- Critical assets (JS bundle, PWA manifest) not accessible

**Automatic Response**:
- Workflow fails immediately with exit code 1
- Deployment NOT marked as successful
- Previous deployment remains live
- No user impact (failed deployment never reaches production)

**Manual Action Required**: ❌ None

**Time to Recovery (RTR)**: N/A (no outage)

**Next Steps**:
1. Review workflow logs to identify failure cause
2. Fix the issue locally
3. Push fix to main branch
4. Workflow will re-run and deploy if health checks pass

---

### Scenario 2: Post-Deployment Failure Detected (User-Reported or Monitoring)

**When This Happens**:
- Deployment succeeded and passed health checks
- User reports issue (functionality broken, UI error, etc.)
- Monitoring detects degraded performance
- Supabase integration fails in production (connection issue passed health check)

**Decision Criteria**:
- **Severity High**: User-facing feature broken, auth not working, data loss risk
  - Action: **Immediate Rollback** (Method 1 or 2)
  - RTR: < 5 minutes
- **Severity Medium**: Non-critical feature broken, performance degraded
  - Action: **Planned Rollback** (Method 1 preferred)
  - RTR: < 15 minutes
- **Severity Low**: Minor UI issue, non-blocking bug
  - Action: **Fix Forward** (no rollback, deploy hotfix)
  - RTR: Varies

**Recommended Rollback Method**: Method 2 (Re-run Previous Workflow)

---

### Scenario 3: Debugging Required (Rollback to Last Known Good State)

**When This Happens**:
- Need to investigate deployment issue without time pressure
- Testing new deployment process
- Debugging intermittent issue

**Recommended Rollback Method**: Method 1 (Git Revert)

---

## Rollback Methods

### Method 1: Git Revert (Safest, Preserves History)

**Best For**: High-severity issues, when you need to maintain full git history

**Estimated RTR**: 3-5 minutes

**Prerequisites**:
- Git installed locally
- Write access to repository
- Know the commit hash of the bad deployment

**Step-by-Step Procedure**:

```bash
# 1. Identify the bad commit
git log --oneline -10
# Example output:
# a1b2c3d (HEAD -> main, origin/main) Add new feature X
# e4f5g6h Update deployment config
# i7j8k9l Fix auth bug

# 2. Revert the bad commit (creates a new "revert" commit)
git revert <bad-commit-hash>
# Example: git revert a1b2c3d

# 3. Push the revert commit to trigger re-deployment
git push origin main

# 4. Monitor workflow execution
# Go to: https://github.com/<username>/My-Love/actions
# Wait for workflow to complete (~2-3 minutes)

# 5. Verify health checks pass
# Check workflow logs for "✅ All health checks passed"

# 6. Verify site is functional
# Visit: https://sallvainian.github.io/My-Love/
# Test critical functionality
```

**Advantages**:
- ✅ Preserves full git history
- ✅ Creates clear audit trail
- ✅ Can be reverted again if needed
- ✅ No force push required

**Disadvantages**:
- ⚠️ Creates additional commit in history
- ⚠️ Doesn't remove bad code from history (only reverts changes)

**Troubleshooting**:
- **Issue**: Merge conflicts during revert
  - **Solution**: Manually resolve conflicts, commit, and push
- **Issue**: Revert commit fails to build
  - **Solution**: Use Method 2 (Re-run Previous Workflow) instead

---

### Method 2: Re-run Previous Successful Workflow (Fastest)

**Best For**: Immediate rollback, no git history concerns

**Estimated RTR**: 2-3 minutes

**Prerequisites**:
- GitHub account with repository access
- Know which workflow run was successful

**Step-by-Step Procedure**:

```
1. Navigate to GitHub Actions
   - URL: https://github.com/<username>/My-Love/actions
   - Click "Actions" tab at top of repository

2. Find the last successful workflow
   - Look for workflow runs with green checkmark (✅)
   - Click on the successful workflow run

3. Re-run the workflow
   - Click "Re-run jobs" button (top right)
   - Select "Re-run all jobs"
   - Click "Re-run jobs" to confirm

4. Monitor deployment
   - Watch workflow progress (build → deploy → health-check)
   - Wait for green checkmark (~2-3 minutes)

5. Verify rollback successful
   - Visit: https://sallvainian.github.io/My-Love/
   - Verify previous version is live
   - Test critical functionality
```

**Advantages**:
- ✅ Fastest method (no local git operations)
- ✅ No git history changes
- ✅ Simple browser-based process

**Disadvantages**:
- ⚠️ Main branch still contains bad code (need to fix separately)
- ⚠️ Next push will re-deploy bad code unless fixed
- ⚠️ Temporary rollback only (must follow up with proper fix)

**Troubleshooting**:
- **Issue**: "Re-run jobs" button disabled
  - **Solution**: Workflow may be too old, use Method 1 or 3 instead
- **Issue**: Re-run fails with same error
  - **Solution**: Issue may be environmental, check GitHub Status page

**Important**: After using this method, you MUST fix the issue in the main branch to prevent re-deploying bad code on next push.

---

### Method 3: Git Reset --hard (EMERGENCY ONLY, Destructive)

**Best For**: Emergency scenarios, when Methods 1 and 2 fail

**Estimated RTR**: 3-5 minutes

**⚠️ WARNING**: This method rewrites git history and requires force push. Use only when other methods fail.

**Prerequisites**:
- Git installed locally
- Write access to repository
- Know the commit hash of the last known good state
- **Team coordination**: Ensure no one else is pushing during rollback

**Step-by-Step Procedure**:

```bash
# 1. Identify last known good commit
git log --oneline -10
# Example output:
# a1b2c3d (HEAD -> main, origin/main) Bad deployment
# e4f5g6h Last known good state
# i7j8k9l Previous commit

# 2. Reset local branch to good commit
git reset --hard <good-commit-hash>
# Example: git reset --hard e4f5g6h

# 3. Force push to remote (DESTRUCTIVE)
git push --force origin main

# 4. Monitor workflow execution
# Go to: https://github.com/<username>/My-Love/actions
# Wait for workflow to complete (~2-3 minutes)

# 5. Verify rollback successful
# Visit: https://sallvainian.github.io/My-Love/
# Test critical functionality

# 6. Team communication
# Notify team: "Force pushed to main, please pull latest changes"
```

**Advantages**:
- ✅ Completely removes bad commits from history
- ✅ Clean rollback to exact previous state

**Disadvantages**:
- ❌ Rewrites git history (dangerous for shared repositories)
- ❌ Requires force push (can cause issues for other developers)
- ❌ No recovery of reverted commits (use with caution)
- ❌ Can cause problems if others have pulled bad commits

**Troubleshooting**:
- **Issue**: Force push rejected (protected branch)
  - **Solution**: Temporarily disable branch protection, force push, re-enable protection
- **Issue**: Other team members have pulled bad commits
  - **Solution**: Team must run `git fetch origin && git reset --hard origin/main`

**When to Use**:
- Git history is corrupted and Methods 1/2 fail
- Multiple bad commits need to be removed
- Sensitive data accidentally committed (though this is a bigger issue)

**When NOT to Use**:
- Multiple team members working on repository
- Uncertainty about good commit hash
- Methods 1 or 2 are available

---

## Testing Rollback Procedures

### Test Scenario 1: Health Check Failure (Automated Rollback)

**Purpose**: Verify workflow fails correctly when health checks fail

**Steps**:

```bash
# 1. Create a test branch
git checkout -b test/health-check-failure

# 2. Temporarily modify health check to fail
# Edit .github/workflows/deploy.yml
# Change line 92 to invalid URL:
DEPLOYMENT_URL="https://invalid-url-for-testing.example.com/"

# 3. Commit and push
git add .github/workflows/deploy.yml
git commit -m "test: Temporarily break health check for testing"
git push origin test/health-check-failure

# 4. Create pull request to main (DO NOT MERGE)
# - Observe workflow fails during health-check job
# - Verify deployment NOT updated

# 5. Verify failure messaging
# - Check workflow logs for clear error message
# - Expected: "❌ Health check failed after 3 attempts"
# - Expected: Exit code 1

# 6. Clean up
git checkout main
git branch -D test/health-check-failure
```

**Expected Outcome**:
- ✅ Workflow fails at health-check job
- ✅ Clear error message in logs
- ✅ Previous deployment remains live
- ✅ No manual intervention required

---

### Test Scenario 2: Manual Rollback (Method 1 - Git Revert)

**Purpose**: Practice rollback procedure without actual production impact

**Steps**:

```bash
# 1. Create a test branch
git checkout -b test/rollback-revert

# 2. Make a harmless change
echo "<!-- Test rollback -->" >> README.md
git add README.md
git commit -m "test: Add rollback test comment"

# 3. Revert the change
git revert HEAD

# 4. Verify revert commit
git log --oneline -3
# Expected: Shows both test commit and revert commit

# 5. Push and verify
git push origin test/rollback-revert
# Wait for workflow to complete
# Verify README.md no longer has test comment

# 6. Clean up
git checkout main
git branch -D test/rollback-revert
```

**Expected Outcome**:
- ✅ Revert commit created successfully
- ✅ Workflow completes without errors
- ✅ Change successfully reverted

---

## Rollback Validation Checklist

After any rollback, verify the following:

**Deployment Status**:
- [ ] GitHub Actions workflow completed successfully (green checkmark)
- [ ] Health checks passed (`✅ All health checks passed`)
- [ ] Deployment URL accessible: https://sallvainian.github.io/My-Love/

**Critical Functionality**:
- [ ] Site loads without console errors (check browser DevTools)
- [ ] Service worker registered (check Application tab in DevTools)
- [ ] PWA manifest loaded (check Network tab)
- [ ] Supabase connection works (test authentication if applicable)

**User Experience**:
- [ ] Previous functionality restored
- [ ] No user-facing errors
- [ ] Performance acceptable (response time < 3s)

**Documentation**:
- [ ] Incident logged (what failed, when, rollback method used)
- [ ] Root cause identified (if known)
- [ ] Follow-up issue created (if fix needed)

---

## Troubleshooting Common Rollback Issues

### Issue: Rollback Workflow Fails Health Checks

**Symptoms**: Rolled back to previous commit, but health checks still fail

**Possible Causes**:
1. GitHub Pages propagation delay (can take up to 2 minutes)
2. Supabase service outage
3. Environment secrets misconfigured

**Resolution Steps**:
```bash
# 1. Wait for GitHub Pages propagation
# Health checks include 3 retries with 10s delay (30s total)
# If still failing, wait additional 2 minutes and manually check site

# 2. Verify site manually
curl -I https://sallvainian.github.io/My-Love/
# Expected: HTTP/2 200

# 3. Check Supabase status
# Visit: https://status.supabase.com/
# If service outage, wait for resolution

# 4. Verify environment secrets
# GitHub Settings > Secrets and variables > Actions
# Confirm VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY exist

# 5. Re-run workflow manually
# GitHub Actions > Select workflow > Re-run all jobs
```

---

### Issue: Multiple Failed Rollback Attempts

**Symptoms**: Tried all rollback methods, all failing

**Possible Causes**:
1. Fundamental deployment configuration issue
2. GitHub Pages service issue
3. Repository corruption

**Resolution Steps**:
```bash
# 1. Check GitHub Status
# Visit: https://www.githubstatus.com/
# Verify GitHub Pages and Actions are operational

# 2. Verify GitHub Pages settings
# Repository Settings > Pages
# Confirm: Source = "gh-pages" branch, "/root" folder
# Confirm: Site is published

# 3. Check deployment history
# GitHub Pages deployment history:
# https://github.com/<username>/My-Love/deployments
# Verify previous successful deployments exist

# 4. Contact support
# If all else fails, open GitHub Support ticket:
# https://support.github.com/
```

---

### Issue: Rollback Succeeded but Issue Persists

**Symptoms**: Rollback completed, but users still report issues

**Possible Causes**:
1. Client-side caching (browser cache, service worker cache)
2. CDN propagation delay
3. Issue not related to deployment

**Resolution Steps**:
```bash
# 1. Ask users to hard refresh browser
# - Chrome/Firefox: Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)
# - Safari: Cmd+Option+R

# 2. Clear service worker cache
# - Open browser DevTools > Application tab
# - Click "Service Workers" > Unregister
# - Refresh page

# 3. Verify deployment timestamp
# Check GitHub Pages deployment:
# - GitHub > Repository > Environments > github-pages
# - Confirm latest deployment matches rollback timestamp

# 4. Check for environmental issues
# - Supabase connection (separate from deployment)
# - Third-party service outages
# - Network issues (user-specific)
```

---

## Incident Response Template

Use this template to document rollback incidents:

```
## Incident Report: <Brief Description>

**Date**: YYYY-MM-DD
**Time**: HH:MM UTC
**Severity**: High | Medium | Low
**Detected By**: User report | Monitoring | Health check failure

### Issue Description
[Describe what went wrong]

### Impact
- **Users Affected**: [Number/percentage]
- **Duration**: [Minutes of downtime]
- **Functionality Impacted**: [List affected features]

### Rollback Method Used
- [ ] Method 1: Git Revert
- [ ] Method 2: Re-run Previous Workflow
- [ ] Method 3: Git Reset --hard

### Timeline
- **XX:XX** - Issue detected
- **XX:XX** - Rollback initiated
- **XX:XX** - Rollback completed
- **XX:XX** - Service restored

### Root Cause
[What caused the deployment failure]

### Resolution
[How the issue was resolved]

### Follow-up Actions
- [ ] Create issue to fix root cause
- [ ] Update deployment process to prevent recurrence
- [ ] Add additional health checks (if applicable)
- [ ] Team retrospective scheduled

### Lessons Learned
[What we learned from this incident]
```

---

## Prevention and Best Practices

### Pre-Deployment Checklist

Before merging to main:
- [ ] Run `npm run build` locally to verify build succeeds
- [ ] Run `npm run test:smoke` to verify smoke tests pass
- [ ] Test changes in development environment
- [ ] Review code changes carefully
- [ ] Verify environment variables configured correctly

### Deployment Monitoring

After deployment:
- [ ] Monitor GitHub Actions workflow completion
- [ ] Review health check logs (`✅ All health checks passed`)
- [ ] Manually verify critical functionality
- [ ] Check browser console for errors
- [ ] Monitor user feedback for 24 hours

### Emergency Contacts

- **Primary**: Frank (repository owner)
- **GitHub Support**: https://support.github.com/ (for platform issues)
- **Supabase Support**: https://supabase.com/support (for backend issues)

---

## Additional Resources

- **GitHub Actions Documentation**: https://docs.github.com/en/actions
- **GitHub Pages Documentation**: https://docs.github.com/en/pages
- **Deployment Workflow**: `.github/workflows/deploy.yml`
- **Smoke Tests**: `scripts/smoke-tests.cjs`
- **Architecture Documentation**: `docs/architecture.md`
- **Sprint Status**: `docs/sprint-artifacts/sprint-status.yaml`

---

**Document Version**: 1.0
**Last Reviewed**: 2025-11-21
**Next Review**: 2025-12-21 (or after first production incident)
