/**
 * URL生成ユーティリティ
 * 正規化とソートを統一処理
 */

import { sortTeams, TeamSlug } from './teams';
import { currentSeasonYear } from './time';

export function buildCompareTeamsUrl(
  teams: TeamSlug[],
  opts?: { year?: number; pf?: boolean }
) {
  const year = String(opts?.year ?? currentSeasonYear());
  const sortedTeams = sortTeams(teams);
  const pf = opts?.pf ? 'true' : 'false';
  
  const params = new URLSearchParams({ 
    year, 
    pf, 
    teams: sortedTeams.join(',') 
  });
  
  return `/compare/teams?${params.toString()}`;
}

export function buildComparePlayersUrl(
  playerIds: string[],
  opts?: { year?: number; yearFrom?: number; yearTo?: number; pf?: boolean }
) {
  const year = String(opts?.year ?? currentSeasonYear());
  const yearFrom = String(opts?.yearFrom ?? year);
  const yearTo = String(opts?.yearTo ?? year);
  const pf = opts?.pf ? 'true' : 'false';
  
  const params = new URLSearchParams({ 
    ids: playerIds.join(','),
    year_from: yearFrom,
    year_to: yearTo,
    pf
  });
  
  return `/compare/players?${params.toString()}`;
}

export function buildTeamUrl(teamSlug: TeamSlug, year?: number) {
  const y = year ?? currentSeasonYear();
  return `/teams/${y}/${teamSlug}`;
}