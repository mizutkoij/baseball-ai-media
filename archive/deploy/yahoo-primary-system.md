# ⚾ Yahoo-Primary Data Collection System

## 🎯 Architecture Overview

Complete implementation of the new data collection strategy with Yahoo! as primary source, featuring:

### **Data Source Priority (NEW)**
1. **🔴 Primary**: Yahoo! 一球速報 (Real-time with conditional GET)
2. **🟡 Secondary**: baseballdata.jp (Daily complement/validation) 
3. **🟢 Tertiary**: NPB Official (Final verification)

### **Core Features**
- ✅ **Conditional GET**: ETag/Last-Modified with 304-optimized caching
- ✅ **Differential Ingestion**: SHA256 row hashing for duplicate detection
- ✅ **NPB1 + NPB2**: Both 1軍 and ファーム (Eastern/Western leagues)
- ✅ **Adaptive Rate Limiting**: 8-45s intervals based on activity
- ✅ **robots.txt Compliance**: Daily validation with auto-enforcement
- ✅ **Circuit Breakers**: 3-failure threshold with exponential backoff
- ✅ **Prometheus Metrics**: Full monitoring and alerting integration

## 📁 Implementation Files

### Core Connectors
```
lib/connectors/
├── polite-http-client.ts          # HTTP client with conditional GET
├── yahoo-ichigun.ts               # NPB1 (1軍) connector  
├── yahoo-farm.ts                  # NPB2 (ファーム) connector
└── baseballdata-complement.ts     # Secondary validation system
```

### Execution Scripts  
```
scripts/
├── ingest_yahoo_live.ts           # Real-time monitoring
├── backfill_yahoo.ts              # Historical collection  
└── baseballdata_complement.ts     # Daily validation
```

### Monitoring & Metrics
```
lib/metrics/
└── yahoo-metrics.ts               # Prometheus integration
```

## 🚀 Usage Commands

### **Live Monitoring (Real-time)**
```bash
# Start live monitoring for today
npm run yahoo:live:today

# Specific date monitoring  
npm run yahoo:live 2025-08-13

# Monitor with custom email
CONTACT_EMAIL=you@example.com npm run yahoo:live:today
```

### **Backfill (Historical)**
```bash
# NPB1 only from specific date
npm run yahoo:backfill:npb1 -- --from 2025-01-01 --to 2025-08-13

# NPB2 Eastern League only
npm run yahoo:backfill:farm-east -- --from 2025-03-01

# Both leagues with custom settings
npm run yahoo:backfill -- --from 2025-01-01 --level both --sleep 45000
```

### **Daily Complement & Validation**
```bash
# Run baseballdata.jp complement for today
npm run baseballdata:complement:today

# Validate specific date
npm run baseballdata:complement 2025-08-13

# Check data validation status
npm run data:validate
```

### **Monitoring & Health**
```bash
# Check system health
npm run yahoo:health
npm run data:collection:status  

# View detailed metrics
npm run yahoo:metrics

# Monitor in real-time  
npm run yahoo:live:today &
npm run yahoo:health
```

## 📊 Expected Performance

### **Request Reduction**
- **Previous**: ~650 requests/game (brute-force enumeration)
- **New**: ~10-30 requests/game (link scanning + adjacent navigation)
- **Reduction**: ~95% fewer requests

### **Data Coverage**
- **NPB1**: 99%+ coverage (Yahoo primary + baseballdata validation)
- **NPB2**: 85%+ coverage (farm data often incomplete)
- **304 Rate**: Target >60% (efficient caching)
- **429 Rate**: Target <1% (proper rate limiting)

### **Monitoring Intervals**
- **Active Games**: 8-15s (dynamic based on changes)
- **Quiet Games**: 30-45s (adaptive scaling)
- **Backfill**: 30-60s (conservative, resumable)
- **Validation**: Daily post-game (low frequency)

## 🛡️ Safety Measures

### **Rate Limiting**
- **Base Interval**: 15s (NPB1), 30s (NPB2)
- **High-Speed Mode**: 8s (during live action)
- **Conservative Mode**: 30-60s (after failures)
- **Circuit Breaker**: 3 failures → 5min cooldown

### **Compliance** 
- **robots.txt**: Daily checks with auto-enforcement
- **User-Agent**: `NPB-ResearchBot/1.0 (+contact@example.com)`
- **Retry-After**: Full respect for 429/503 headers
- **Max Concurrent**: 1 per host (strict limitation)

### **Error Handling**
- **Timeout**: 15s max per request
- **Retries**: 6 attempts with exponential backoff
- **Graceful Degradation**: Continues with missing data
- **Progress Resumption**: Backfill auto-resumes from checkpoint

## 📈 Prometheus Metrics

### **Request Monitoring**
```prometheus
# Total requests by source and status
source_requests_total{host,source,status_code}

# 304 Not Modified responses (efficiency indicator)
source_304_responses_total{host,source}
source_304_ratio{host,source}

# Rate limiting responses (health indicator)  
source_429_total{host,source}

# Request duration distribution
yahoo_request_duration_seconds{host,endpoint_type}
```

### **Ingestion Tracking**
```prometheus
# Successfully ingested pitch data
pitch_rows_ingested_total{level,source,confidence}

# Duplicate rows (filtered out)
pitch_rows_duplicate_total{level,source}

# Active monitoring tasks
active_monitoring_tasks{level,status}

# Data freshness monitoring
last_update_age_seconds{game_id,level}
```

### **Health Alerts**
```prometheus
# Alert: 304 ratio below 60% for 5+ minutes
source_304_ratio < 0.6

# Alert: Any 429 responses detected
increase(source_429_total[5m]) > 0

# Alert: 10+ consecutive polls without updates
consecutive_no_updates > 10
```

## 🔧 Configuration

### **Environment Variables**
```bash
CONTACT_EMAIL=your-email@example.com    # Required for compliance
YAHOO_RATE_LIMIT_MS=15000              # Base polling interval
ENABLE_HIGH_SPEED_MODE=true            # 8s intervals during live action
ROBOTS_CACHE_HOURS=24                  # robots.txt cache duration
CIRCUIT_BREAKER_THRESHOLD=3            # Failures before cooldown
BACKFILL_SLEEP_MS=30000               # Historical collection interval
```

### **Data Directories**
```
data/
├── cache/
│   ├── http/                     # ETag/Last-Modified cache
│   ├── yahoo_npb1/              # NPB1 game cache
│   ├── yahoo_npb2/              # NPB2 farm cache
│   └── baseballdata/            # Validation cache
├── timeline/
│   ├── yahoo_npb1/              # NPB1 differential timeline
│   └── yahoo_npb2/              # NPB2 differential timeline
├── validation/                   # Cross-source validation reports
└── backfill/                    # Progress checkpoints
```

## 🎛️ Operational Procedures

### **Daily Operations**
1. **Morning**: Start live monitoring for today's games
2. **Real-time**: Monitor system health and 304 ratios
3. **Post-game**: Run baseballdata.jp complement validation
4. **Evening**: Review validation reports and manual_review items

### **Weekly Maintenance**
1. **Archive**: Move old timeline data to long-term storage
2. **Cleanup**: Purge validation caches older than 30 days  
3. **Review**: Analyze robots.txt changes and 429 patterns
4. **Optimize**: Adjust rate limits based on success metrics

### **Troubleshooting**
```bash
# Check current system status
npm run yahoo:health
npm run data:collection:status

# View recent validation reports
ls -la data/validation/daily_report_*.json

# Check failed games requiring manual review
ls -la data/validation/manual_review_*.json

# Monitor live collection in real-time  
tail -f logs/collection_log_*.json | jq '.usage_report'
```

## 🎉 Ready for Production

This implementation provides a **complete, production-ready** data collection system with:

- ✅ **95% request reduction** vs previous brute-force approach
- ✅ **Comprehensive monitoring** with Prometheus metrics
- ✅ **Full compliance** with robots.txt and rate limiting
- ✅ **Fault tolerance** with circuit breakers and graceful degradation
- ✅ **NPB1 + NPB2 coverage** with unified pipeline
- ✅ **Data validation** through multi-source cross-checking

The system is designed for **"長期安定稼働"** - reliable, efficient, and maintainable operation over months and years of continuous data collection.

**🚀 Begin deployment with:**
```bash
npm run yahoo:live:today
```