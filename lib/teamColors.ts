/**
 * チームカラー定義
 * OG画像生成とUI要素で統一使用
 */

export const TEAM_COLORS: Record<string, { primary: string; text: string; name: string }> = {
  // セントラル・リーグ
  G:  { primary: '#ff6600', text: '#fff', name: '読売ジャイアンツ' },
  T:  { primary: '#ffe100', text: '#000', name: '阪神タイガース' },
  C:  { primary: '#ff0000', text: '#fff', name: '広島東洋カープ' },
  D:  { primary: '#004ea2', text: '#fff', name: '中日ドラゴンズ' },
  YS: { primary: '#0067c0', text: '#fff', name: '横浜DeNAベイスターズ' },
  S:  { primary: '#00a14b', text: '#fff', name: '東京ヤクルトスワローズ' },
  
  // パシフィック・リーグ
  H:  { primary: '#000000', text: '#ffcc00', name: 'ソフトバンクホークス' },
  L:  { primary: '#004098', text: '#fff', name: '埼玉西武ライオンズ' },
  M:  { primary: '#000000', text: '#fff', name: '千葉ロッテマリーンズ' },
  E:  { primary: '#7a0019', text: '#fff', name: '東北楽天ゴールデンイーグルス' },
  F:  { primary: '#0072bc', text: '#fff', name: '北海道日本ハムファイターズ' },
  B:  { primary: '#003a8c', text: '#fff', name: 'オリックス・バファローズ' },
};

export const getTeamColor = (teamCode: string) => {
  return TEAM_COLORS[teamCode] || { primary: '#e5e7eb', text: '#111827', name: teamCode };
};