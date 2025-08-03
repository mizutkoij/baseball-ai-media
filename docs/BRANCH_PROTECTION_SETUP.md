# Branch Protection Setup Instructions

## Immediate Action Required (5 minutes)

### Step 1: Navigate to GitHub Settings
```
https://github.com/mizutkoij/baseball-ai-media/settings/branches
```

### Step 2: Add Branch Protection Rule

1. Click **"Add rule"**
2. Branch name pattern: `main`
3. Configure protection settings:

#### Required Settings
```
☑️ Require a pull request before merging
☑️ Require status checks to pass before merging
☑️ Require branches to be up to date before merging
```

#### Required Status Checks (Add these exact names)
```
☑️ golden-validation      # From .github/workflows/golden.yml
☑️ forbidden-scan         # From .github/workflows/forbidden-scan.yml  
```

#### Additional Recommended Settings
```
☑️ Require conversation resolution before merging
☑️ Do not allow bypassing the above settings
☑️ Restrict pushes that create matching branches
```

### Step 3: Verification

After setup, these will be **REQUIRED** for all PRs:
- ✅ Comprehensive Quality Gate (192 tests must pass 100%)
  - Golden Sample Validation (174 tests: 30 players + 12 teams)
  - Game Invariant Validation (9 tests: box score consistency)
  - System Tests (9 tests: backfill validation)
- ✅ Forbidden Token Scan (no 1point02 references)
- ✅ Branch up-to-date with main

### Status Check Names Reference

| Workflow File | Status Check Name | Purpose |
|---------------|-------------------|---------|
| `.github/workflows/golden.yml` | `golden-validation` | Quality gate validation |
| `.github/workflows/forbidden-scan.yml` | `forbidden-scan` | Third-party reference blocking |

### Expected Behavior After Setup

#### ✅ Successful PR Flow
```
1. Developer creates PR
2. GitHub runs both status checks automatically  
3. Both checks pass (green ✅)
4. Merge button becomes available
5. PR can be merged
```

#### ❌ Blocked PR Flow
```
1. Developer creates PR
2. GitHub runs both status checks
3. Any check fails (red ❌)
4. Merge button disabled with message:
   "Merging is blocked. Required status checks must pass."
5. Developer must fix issues before merge
```

## Testing the Protection

### Create a Test PR

1. Make a small change (add comment to any file)
2. Create PR to main
3. Verify both status checks run automatically
4. Confirm merge is only available after both pass

### Emergency Bypass (Use Sparingly)

If urgent hotfix needed:
```bash
# Temporary bypass (admin only)
git push origin main --force-with-lease

# Must re-enable protection immediately after
```

## Success Confirmation

You'll know it's working when:
- ✅ PR merge button shows "Merge pull request" only after checks pass
- ✅ Failed checks show clear error messages with investigation links
- ✅ No accidental direct pushes to main are possible
- ✅ Quality gate failures automatically block problematic code

---

**Setup Time**: 5 minutes  
**Protection Level**: Bulletproof (no regression possible)  
**Risk**: Zero (current 100% pass rate maintained)**