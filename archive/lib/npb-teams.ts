// NPB teams data with official colors and information

export interface NPBTeam {
  code: string;
  name: string;
  shortName: string;
  league: 'central' | 'pacific';
  colors: {
    primary: string;
    secondary: string;
    accent?: string;
  };
  location: string;
  stadium: string;
  founded: number;
}

export const NPB_TEAMS: Record<string, NPBTeam> = {
  // Central League
  'giants': {
    code: 'G',
    name: '読売ジャイアンツ',
    shortName: '巨人',
    league: 'central',
    colors: {
      primary: '#FF6600', // Orange
      secondary: '#000000', // Black
    },
    location: '東京',
    stadium: '東京ドーム',
    founded: 1934,
  },
  'tigers': {
    code: 'T',
    name: '阪神タイガース',
    shortName: '阪神',
    league: 'central',
    colors: {
      primary: '#FFE500', // Yellow
      secondary: '#000000', // Black
    },
    location: '大阪',
    stadium: '阪神甲子園球場',
    founded: 1935,
  },
  'carp': {
    code: 'C',
    name: '広島東洋カープ',
    shortName: '広島',
    league: 'central',
    colors: {
      primary: '#DC143C', // Crimson
      secondary: '#FFFFFF', // White
    },
    location: '広島',
    stadium: 'MAZDA Zoom-Zoom スタジアム広島',
    founded: 1950,
  },
  'dragons': {
    code: 'D',
    name: '中日ドラゴンズ',
    shortName: '中日',
    league: 'central',
    colors: {
      primary: '#003DA5', // Blue
      secondary: '#FFFFFF', // White
    },
    location: '名古屋',
    stadium: 'バンテリンドーム ナゴヤ',
    founded: 1936,
  },
  'baystars': {
    code: 'DB',
    name: '横浜DeNAベイスターズ',
    shortName: 'DeNA',
    league: 'central',
    colors: {
      primary: '#006BB0', // Blue
      secondary: '#FFFFFF', // White
      accent: '#FFD700', // Gold
    },
    location: '横浜',
    stadium: '横浜スタジアム',
    founded: 1950,
  },
  'swallows': {
    code: 'S',
    name: '東京ヤクルトスワローズ',
    shortName: 'ヤクルト',
    league: 'central',
    colors: {
      primary: '#3A5FCD', // Royal Blue
      secondary: '#DC143C', // Crimson
    },
    location: '東京',
    stadium: '明治神宮野球場',
    founded: 1950,
  },

  // Pacific League
  'lions': {
    code: 'L',
    name: '埼玉西武ライオンズ',
    shortName: '西武',
    league: 'pacific',
    colors: {
      primary: '#00008B', // Navy Blue
      secondary: '#FF0000', // Red
      accent: '#FFD700', // Gold
    },
    location: '埼玉',
    stadium: 'ベルーナドーム',
    founded: 1950,
  },
  'hawks': {
    code: 'H',
    name: '福岡ソフトバンクホークス',
    shortName: 'ソフトバンク',
    league: 'pacific',
    colors: {
      primary: '#FFD700', // Gold
      secondary: '#000000', // Black
    },
    location: '福岡',
    stadium: 'みずほPayPayドーム福岡',
    founded: 1938,
  },
  'marines': {
    code: 'M',
    name: '千葉ロッテマリーンズ',
    shortName: 'ロッテ',
    league: 'pacific',
    colors: {
      primary: '#000080', // Navy
      secondary: '#FF0000', // Red
      accent: '#FFFFFF', // White
    },
    location: '千葉',
    stadium: 'ZOZOマリンスタジアム',
    founded: 1950,
  },
  'eagles': {
    code: 'E',
    name: '東北楽天ゴールデンイーグルス',
    shortName: '楽天',
    league: 'pacific',
    colors: {
      primary: '#8B0000', // Dark Red
      secondary: '#FFD700', // Gold
    },
    location: '仙台',
    stadium: '楽天モバイルパーク宮城',
    founded: 2005,
  },
  'buffaloes': {
    code: 'Bs',
    name: 'オリックス・バファローズ',
    shortName: 'オリックス',
    league: 'pacific',
    colors: {
      primary: '#003DA5', // Blue
      secondary: '#FFD700', // Gold
      accent: '#000000', // Black
    },
    location: '大阪',
    stadium: '京セラドーム大阪',
    founded: 1936,
  },
  'fighters': {
    code: 'F',
    name: '北海道日本ハムファイターズ',
    shortName: '日本ハム',
    league: 'pacific',
    colors: {
      primary: '#87CEEB', // Sky Blue
      secondary: '#FFD700', // Gold
      accent: '#DC143C', // Red
    },
    location: '札幌',
    stadium: 'エスコンフィールド HOKKAIDO',
    founded: 1946,
  },
};

// Helper functions
export function getTeamByName(name: string): NPBTeam | undefined {
  return Object.values(NPB_TEAMS).find(team => 
    team.name === name || team.shortName === name
  );
}

export function getTeamColor(teamName: string, type: 'primary' | 'secondary' | 'accent' = 'primary'): string {
  const team = getTeamByName(teamName);
  if (!team) return '#6B7280'; // Default gray
  
  return team.colors[type] || team.colors.primary;
}

export function getTeamsByLeague(league: 'central' | 'pacific'): NPBTeam[] {
  return Object.values(NPB_TEAMS).filter(team => team.league === league);
}