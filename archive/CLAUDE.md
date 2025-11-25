# Baseball AI Media - Claude Code Context

## Project Overview
NPB (日本プロ野球) analytics platform with AI predictions and multi-league support. Currently supports NPB, MLB, and KBO leagues with comprehensive sabermetrics analysis.

## Architecture
- **Frontend**: Next.js 14 (App Router) + Tailwind CSS + Vercel deployment
- **Backend**: FastAPI + DuckDB on VPS (100.88.12.26:8000/api)
- **Database**: Multi-league SQLite (comprehensive_baseball_database.db) + better-sqlite3
- **Analytics**: Custom sabermetrics (WAR, wOBA, FIP) + ML predictions

## Key Files & Structure

### Core Database (lib/db.ts)
- Multi-league support: NPB, MLB, KBO, international
- Single comprehensive database with league filtering
- Functions: `getLeagueConnection()`, `queryLeague()`, `openMultiLeagueConnections()`

### Data Collection Status
- **NPB**: 1,072 current players collected (100% complete)
- **KBO**: 302 players across 10 teams (realistic Korean/foreign distribution)
- **MLB**: Integrated but not actively collecting

### API Endpoints
- `/api/league-players/route.ts` - Multi-league player data
- `/api/games/[gameId]/route.ts` - Game details
- `/api/stats/batting/route.ts` - Batting statistics

### Key Scripts
- `npm run scrape:current` - NPB data collection
- `npm run test:golden` - Quality assurance (195 tests)
- `npm run build` - Production build
- `npm run dev` - Development server

## Development Workflow

### Data Collection
```bash
# NPB real-time data
npm run scrape:current
npm run auto:update

# KBO data (already integrated)
# Use existing comprehensive_baseball_database.db

# Data validation
npm run test:golden
npm run data:quality
```

### Quality Assurance
- **Golden Samples**: 174 player samples + 12 game invariants + 9 system tests
- **Success Rate**: 95%+ required (195/195 tests)
- **Fail-safe**: Automatic rollback on quality gate failures

### Build & Deploy
```bash
# Local development
npm run dev

# Production build
npm run build
npm run start

# Type checking
npx tsc --noEmit
```

## Multi-League Implementation

### Database Schema
All leagues use same `comprehensive_baseball_database.db` with league field:
- `league`: 'npb' | 'mlb' | 'kbo' | 'international'
- Unified player/team/game tables with league filtering

### API Usage Examples
```bash
# NPB players (676 real players)
curl "http://localhost:3000/api/league-players?league=npb"

# KBO players (302 generated players)
curl "http://localhost:3000/api/league-players?league=kbo"
```

## Recent Achievements
1. ✅ NPB data collection: 1,072 players from 12 teams
2. ✅ KBO integration: 302 players with realistic distribution
3. ✅ Multi-league API: NPB/KBO endpoints working
4. ✅ Quality gates: 195-test validation system

## Common Tasks

### When adding new leagues:
1. Update `League` type in `lib/db.ts`
2. Add league support in `openMultiLeagueConnections()`
3. Create data collection scripts in `scripts/`
4. Update API endpoints for new league
5. Add golden samples for quality testing

### When debugging data issues:
1. Check `npm run test:golden` for quality gate status
2. Use `npm run debug:game --game GAMEID` for specific issues
3. Monitor `data/npb_current_players/collection_summary.json`
4. Verify API with direct curl tests

### When deploying:
1. Run `npm run build` (max 120s timeout)
2. Verify `npm run test:golden` passes
3. Check `/api/health` endpoint
4. Monitor quality dashboard at `/about/methodology`

## Environment Variables
```
# Database paths
DB_PATH=./data/db_current.db
COMPREHENSIVE_DB_PATH=./comprehensive_baseball_database.db

# API endpoints
NEXT_PUBLIC_API_BASE_URL=http://100.88.12.26:8000/api

# Analytics
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
NEXT_PUBLIC_PLAUSIBLE_DOMAIN=baseball-ai-media.vercel.app
```

## Known Issues & Solutions

### TypeError: Cannot read properties
- Usually better-sqlite3 connection issues
- Solution: Check database file permissions and paths

### KBO encoding issues
- Korean text encoding problems resolved
- Solution: Use romanized names, avoid Hangul in file operations

### Quality gate failures
- Automatic rollback to last known good state
- Solution: Check `config/invariants.config.json` for thresholds

## Next Steps (Phase 7C+)
- Real-time game predictions (WP/RE)
- GPT-generated articles
- International expansion
- Advanced ML models

## Contact
- Data issues: Check golden samples and quality dashboard
- API issues: Test localhost:3000 endpoints directly
- Build issues: Verify TypeScript compilation with `npx tsc --noEmit`