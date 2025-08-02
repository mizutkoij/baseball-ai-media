# Quality Assurance Framework

## Overview

This document outlines the Golden Sample quality validation system that ensures data accuracy and system stability for NPB analytics.

## Golden Sample System

### What It Is

The Golden Sample system validates 10 key players and 10 teams against expected statistical ranges to detect data quality regressions automatically.

**Current Coverage:**
- **Players**: 大谷翔平, 村上宗隆, 佐々木朗希, 山川穂高, 山本由伸, 柳田悠岐, 森下暢仁, 牧秀悟, 宮城大弥, 近本光司
- **Teams**: All 12 NPB teams (Central + Pacific League)
- **Years**: 2024-2025 (based on available data)

### Quality Gates

#### PR Gate (Required)
- **Workflow**: `.github/workflows/golden.yml`
- **Trigger**: All pull requests to main
- **Requirement**: 100% test pass rate
- **Blocks merge**: ❌ Any test failure prevents merge

#### Nightly Monitoring
- **Workflow**: `.github/workflows/golden-nightly.yml`
- **Schedule**: Daily at JST 00:15
- **Purpose**: Trend monitoring and early detection
- **Auto-creates issues**: On persistent failures

## Branch Protection Rules

### Required Status Checks

To enable quality gates, configure these checks in GitHub Settings → Branches:

1. **`golden-validation`** (from golden.yml)
2. **`forbidden-scan`** (from forbidden-scan.yml)

### Configuration Steps

```
GitHub → Settings → Branches → Add rule → main
☑️ Require status checks to pass before merging
☑️ golden-validation 
☑️ forbidden-scan
☑️ Require branches to be up to date before merging
```

## Re-Baseline Procedures

### When to Re-Baseline

1. **Constants Update**: After wOBA/FIP/PF coefficient changes
2. **Data Pipeline Changes**: Schema modifications or calculation updates
3. **Systematic Shifts**: 7+ days of consistent failures in same direction

### Re-Baseline Process

#### Phase 1: Validation (7 days)
```bash
# 1. Update constants in data/league_constants.json
# 2. Wait for 7 consecutive nightly PASS results
# 3. Monitor for stability
```

#### Phase 2: Baseline Update
```bash
# 1. Update golden samples
npm run test:golden -- --update-baselines

# 2. Update baseline version in data/golden_samples.json
{
  "version": "1.1", 
  "updated": "2025-XX-XX",
  "baseline_version": "2025.1",
  // ...
}

# 3. Create PR with baseline changes
git add data/golden_samples.json
git commit -m "chore: update golden sample baselines v2025.1"
```

#### Phase 3: Validation
- PR must pass 100% golden sample tests
- Requires manual review of statistical changes
- Documents reasoning for baseline shifts

## Failure Handling

### Automatic Actions

**Nightly Failures:**
- Auto-creates GitHub issue with `golden-sample-failure` label
- Includes run ID, test details, and investigation checklist
- Auto-closes when validation passes

**PR Failures:**
- Blocks merge automatically
- Comments with detailed failure analysis
- Provides investigation steps

### Manual Investigation

#### 1. Check Failure Severity

```json
{
  "validation": {
    "severity": "HIGH|MEDIUM|LOW",
    "exceedsBy": "15.2%"
  }
}
```

**Severity Levels:**
- 🔴 **HIGH** (>30% deviation): Immediate investigation required
- 🟡 **MEDIUM** (15-30% deviation): Monitor trend
- 🟢 **LOW** (<15% deviation): Acceptable variance

#### 2. Common Failure Causes

| Issue | Symptoms | Resolution |
|-------|----------|------------|
| **Constants Outdated** | Multiple HIGH severity failures | Update `league_constants.json` |
| **Small Sample** | Low sample size warnings | Enable auto-relaxation (+12%) |
| **Park Factor Drift** | Team-specific failures | Check PF calculations |
| **Data Pipeline Issue** | Schema errors, missing columns | Investigate data ingestion |
| **Baseline Drift** | Consistent directional bias | Re-baseline following procedures |

#### 3. Debug Tools

```bash
# Run specific failing test
npm run test:golden -- -t "player_name metric year"

# Check database schema
node scripts/quick_db_check.js

# Verify constants version
curl /api/constants?year=2024&league=central
```

## Sample Size Management

### Auto-Relaxation Rules

```typescript
// Default thresholds
minPA: 100,    // Batting minimum plate appearances  
minIP: 30,     // Pitching minimum innings pitched
relaxPct: 0.12 // 12% range expansion for small samples
```

### Manual Overrides

For known small-sample players/scenarios, add to golden samples:

```json
{
  "id": "player_id",
  "expected_ranges": {
    "metric": [min, max],
    "sample_override": {
      "min_threshold": 50,
      "relax_pct": 0.15
    }
  }
}
```

## Monitoring & Alerts

### Notification Channels

- **GitHub Issues**: Auto-created for failures
- **Discord/Slack**: `scripts/notify.js` integration
- **Workflow Artifacts**: Detailed reports (7-day retention)

### Success Metrics

- **Target**: >99% nightly pass rate
- **Alert**: >3 consecutive nightly failures
- **Escalation**: >7 days with any failures

## Expansion Roadmap

### Phase 1: Coverage Expansion (Next 1-2 days)
- Players: 10 → 30 (add rising stars, veterans)
- Teams: Complete all 12 NPB teams
- Game-level invariants: Box score consistency

### Phase 2: Cross-System Validation
- Database consistency (current ↔ history)
- API response validation
- UI data binding checks

### Phase 3: Performance Gates
- Page load time thresholds  
- Database query performance
- Build time regressions

## Emergency Procedures

### Golden Sample System Down

```bash
# Temporary bypass (use sparingly)
git commit -m "fix: critical hotfix" --allow-empty
git push --no-verify

# Must re-enable protection after fix
```

### Mass Baseline Corruption

```bash
# Rollback to last known good baseline
git checkout HEAD~1 data/golden_samples.json
git commit -m "revert: rollback corrupted baselines"

# Investigate root cause before re-updating
```

### Contact & Escalation

- **Primary**: GitHub Issues with `golden-sample-failure` label
- **Urgent**: Manual run of nightly workflow for immediate feedback
- **Documentation**: This file (`docs/QUALITY.md`)

## Versioning

- **Golden Samples**: Semantic versioning (`1.0`, `1.1`, etc.)
- **Baseline Version**: Date-based (`2025.1`, `2025.2`, etc.)
- **Update History**: Tracked in `data/golden_samples.json`

---

*Last Updated: 2025-08-02*  
*Framework Version: 1.0*