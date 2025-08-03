# Quality Gate Operations Runbook

**📅 生成時刻**: 2025-08-02 12:15 JST  
**⏱️ 所要時間**: 日次 2分、週次 10分、緊急時 5分

## 🕐 Daily Operations (Automated)

### 00:15 JST - Nightly Quality Gate
```bash
✅ Auto-execution: .github/workflows/golden-nightly.yml
✅ Discord/Slack notification on failure  
✅ Auto-issue creation on critical failures
```

**Failure Response (2 minutes)**:
1. **Check Logs**: `指標/リーグ/年` in GitHub Actions logs
2. **Review Deltas**: Check `constants.json` Δ and sample sizes
3. **Emergency Pin**: Set `CONSTANTS_PIN=<last_good>` if needed

```bash
# Emergency failopen
export CONSTANTS_PIN="2025.1.20240801"
npm run build && npm run deploy
```

## 📅 Weekly Operations (Manual 10 min)

### Quality Health Check
- **Route**: `/about/methodology` → WARN trends and failure rates
- **Action**: 3 consecutive WARNs → adjust thresholds in `config/invariants.config.json`

```json
// Example threshold adjustment
{
  "tolerance": {
    "R": 3,     // Increase from 2 to 3 for runs
    "H": 3      // Increase from 2 to 3 for hits  
  },
  "temporaryRelaxation": {
    "2024": {
      "reason": "High variance period",
      "multiplier": 1.5,
      "expires": "2025-09-01"
    }
  }
}
```

## 🚨 Rollback Procedures (Immediate)

### Instant Recovery (5 minutes)
```bash
# 1. Pin to last known good version
export CONSTANTS_PIN="2025.1.20240725"

# 2. Redeploy immediately  
npm run build
npm run deploy

# 3. Verify status
curl https://baseball-ai-media.vercel.app/api/health
```

### Permanent Fix (30-60 minutes)
1. **Isolate Issue**: Identify `年×リーグ×指標` causing failure
2. **Data Fix**: Run targeted backfill or constants re-estimation
3. **Validate**: Run full test suite before removing pin
4. **Remove Pin**: Unset `CONSTANTS_PIN` environment variable

## 📊 Monitoring & Alerts

### Quality Status Dashboard
- **Location**: `/about/methodology`
- **Metrics**: 
  - Last execution time
  - Total tests: 195 (174 Golden + 12 Invariant + 9 System)
  - Current WARN count
  - Error escalations

### Alert Escalation
```
INFO    → No action required
WARN    → Log for weekly review  
ERROR   → Immediate investigation (3 consecutive WARNs)
CRITICAL → Auto-failopen + emergency notification
```

## 🔧 Configuration Management

### File Locations
```
config/invariants.config.json     # Main configuration
data/golden_samples.json          # Test baselines  
.reports/last_good_version.txt     # Emergency rollback point
public/status/quality.json         # Live status (future)
```

### Safe Configuration Updates
```bash
# 1. Test configuration locally
npm test -- __tests__/game-invariants.test.ts

# 2. Create PR with configuration changes
git add config/invariants.config.json
git commit -m "config: adjust tolerance for high variance period"

# 3. Required checks will validate before merge
```

## 🔒 Access Control

### Required Approvals
```
/config/*                 → @mizutkoij (CODEOWNERS)
/data/golden_samples.json → @mizutkoij (Quality baseline changes)
/.github/workflows/*      → @mizutkoij (CI/CD changes)
```

### Emergency Override
- **Who**: Repository admins only
- **When**: Production outage or critical quality regression  
- **How**: Direct push with `--force-with-lease` (re-enable protection after)

## 📈 Success Metrics

### Green Light Indicators
```
✅ 195/195 tests passing (100%)
✅ No consecutive WARNs > 2
✅ Coverage > 75%
✅ Auto-relaxation < 10% of tests
✅ Zero production incidents
```

### Red Flag Indicators  
```
❌ Test failure rate > 5%
❌ 3+ consecutive WARNs on same metric
❌ Coverage drops below 70%
❌ Multiple auto-relaxations per run
❌ Manual overrides > 1 per week
```

---

## 🎯 Quick Reference Commands

```bash
# Check quality gate status
npm test

# Run game invariants only
npm test -- __tests__/game-invariants.test.ts

# Emergency failopen
export CONSTANTS_PIN="<last_good_version>"

# View configuration summary  
cat config/invariants.config.json | jq '.tolerance'

# Check current version
grep baseline_version data/golden_samples.json
```

**📞 Emergency Contact**: GitHub Issues (auto-created) or Discord notifications