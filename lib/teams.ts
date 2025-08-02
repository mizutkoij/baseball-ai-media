/**
 * チーム定義とユーティリティ
 * 既存のルーティング引数と同じスラッグを使用
 */

export type TeamSlug =
  | 'G' | 'T' | 'C' | 'D' | 'YS' | 'S'  // セ・リーグ
  | 'H' | 'L' | 'M' | 'E' | 'F' | 'B';  // パ・リーグ

export const TEAM_META: Record<TeamSlug, { ja: string; en: string; league: 'central' | 'pacific' }> = {
  // セントラル・リーグ
  G:  { ja: '読売ジャイアンツ', en: 'Yomiuri Giants', league: 'central' },
  T:  { ja: '阪神タイガース', en: 'Hanshin Tigers', league: 'central' },
  C:  { ja: '広島東洋カープ', en: 'Hiroshima Carp', league: 'central' },
  D:  { ja: '中日ドラゴンズ', en: 'Chunichi Dragons', league: 'central' },
  YS: { ja: '横浜DeNAベイスターズ', en: 'Yokohama DeNA BayStars', league: 'central' },
  S:  { ja: '東京ヤクルトスワローズ', en: 'Tokyo Yakult Swallows', league: 'central' },
  
  // パシフィック・リーグ
  H:  { ja: 'ソフトバンクホークス', en: 'Fukuoka SoftBank Hawks', league: 'pacific' },
  L:  { ja: '埼玉西武ライオンズ', en: 'Saitama Seibu Lions', league: 'pacific' },
  M:  { ja: '千葉ロッテマリーンズ', en: 'Chiba Lotte Marines', league: 'pacific' },
  E:  { ja: '東北楽天ゴールデンイーグルス', en: 'Tohoku Rakuten Golden Eagles', league: 'pacific' },
  F:  { ja: '北海道日本ハムファイターズ', en: 'Hokkaido Nippon-Ham Fighters', league: 'pacific' },
  B:  { ja: 'オリックス・バファローズ', en: 'Orix Buffaloes', league: 'pacific' },
};

export const sortTeams = (slugs: TeamSlug[]) =>
  Array.from(new Set(slugs)).sort((a, b) => a.localeCompare(b)) as TeamSlug[];

export const getCentralTeams = (): TeamSlug[] => 
  Object.keys(TEAM_META).filter(slug => TEAM_META[slug as TeamSlug].league === 'central') as TeamSlug[];

export const getPacificTeams = (): TeamSlug[] => 
  Object.keys(TEAM_META).filter(slug => TEAM_META[slug as TeamSlug].league === 'pacific') as TeamSlug[];