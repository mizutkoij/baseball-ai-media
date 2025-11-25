/**
 * NPB Farm Teams and Venues Dictionary
 * Comprehensive mapping for 2軍 (ファーム) teams and venues
 */

export interface FarmTeamInfo {
  officialName: string;
  shortName: string;
  league: 'EAST' | 'WEST';
  parentTeam: string;
  colors: {
    primary: string;
    secondary: string;
  };
  homeVenues: string[];
}

export interface FarmVenueInfo {
  officialName: string;
  commonNames: string[];
  location: {
    prefecture: string;
    city: string;
  };
  capacity?: number;
  opened?: number;
  surfaceType: 'natural' | 'artificial';
}

/**
 * NPB Farm Teams (2軍) Dictionary
 */
export const FARM_TEAMS: Record<string, FarmTeamInfo> = {
  // Eastern League (イースタン・リーグ)
  '読売ジャイアンツ': {
    officialName: '読売ジャイアンツ',
    shortName: '巨人',
    league: 'EAST',
    parentTeam: '読売ジャイアンツ',
    colors: { primary: '#FF6600', secondary: '#000000' },
    homeVenues: ['読売ジャイアンツ球場', 'ジャイアンツ球場']
  },
  '東京ヤクルトスワローズ': {
    officialName: '東京ヤクルトスワローズ',
    shortName: 'ヤクルト',
    league: 'EAST',
    parentTeam: '東京ヤクルトスワローズ',
    colors: { primary: '#006837', secondary: '#FFD700' },
    homeVenues: ['戸田市営球場', '戸田球場']
  },
  '横浜DeNAベイスターズ': {
    officialName: '横浜DeNAベイスターズ',
    shortName: 'DeNA',
    league: 'EAST',
    parentTeam: '横浜DeNAベイスターズ',
    colors: { primary: '#003DA5', secondary: '#FFFFFF' },
    homeVenues: ['横須賀スタジアム', '平塚総合公園野球場']
  },
  '埼玉西武ライオンズ': {
    officialName: '埼玉西武ライオンズ',
    shortName: '西武',
    league: 'EAST',
    parentTeam: '埼玉西武ライオンズ',
    colors: { primary: '#1E4D8B', secondary: '#FFD700' },
    homeVenues: ['ライオンズパーク大宮', '大宮球場']
  },
  '北海道日本ハムファイターズ': {
    officialName: '北海道日本ハムファイターズ',
    shortName: '日本ハム',
    league: 'EAST',
    parentTeam: '北海道日本ハムファイターズ',
    colors: { primary: '#041E42', secondary: '#C41E3A' },
    homeVenues: ['鎌ケ谷スタジアム', 'ファイターズ鎌ケ谷スタジアム']
  },
  '東北楽天ゴールデンイーグルス': {
    officialName: '東北楽天ゴールデンイーグルス',
    shortName: '楽天',
    league: 'EAST',
    parentTeam: '東北楽天ゴールデンイーグルス',
    colors: { primary: '#660000', secondary: '#FFD700' },
    homeVenues: ['楽天イーグルス利府球場', '利府球場']
  },
  
  // Western League (ウエスタン・リーグ)
  '阪神タイガース': {
    officialName: '阪神タイガース',
    shortName: '阪神',
    league: 'WEST',
    parentTeam: '阪神タイガース',
    colors: { primary: '#FFE600', secondary: '#000000' },
    homeVenues: ['鳴門球場', '鳴門・大塚スポーツパーク野球場']
  },
  '広島東洋カープ': {
    officialName: '広島東洋カープ',
    shortName: '広島',
    league: 'WEST',
    parentTeam: '広島東洋カープ',
    colors: { primary: '#FF0000', secondary: '#FFFFFF' },
    homeVenues: ['大竹市総合市民球場', '由宇練習場']
  },
  '中日ドラゴンズ': {
    officialName: '中日ドラゴンズ',
    shortName: '中日',
    league: 'WEST',
    parentTeam: '中日ドラゴンズ',
    colors: { primary: '#002569', secondary: '#FFFFFF' },
    homeVenues: ['ナゴヤ球場', '中日二軍練習場']
  },
  'オリックス・バファローズ': {
    officialName: 'オリックス・バファローズ',
    shortName: 'オリックス',
    league: 'WEST',
    parentTeam: 'オリックス・バファローズ',
    colors: { primary: '#000080', secondary: '#FFD700' },
    homeVenues: ['オリックス二軍球場', '舞洲ベースボールスタジアム']
  },
  '福岡ソフトバンクホークス': {
    officialName: '福岡ソフトバンクホークス',
    shortName: 'ソフトバンク',
    league: 'WEST',
    parentTeam: '福岡ソフトバンクホークス',
    colors: { primary: '#FFD700', secondary: '#000000' },
    homeVenues: ['タマホームスタジアム筑後', 'HAWKSベースボールパーク筑後']
  },
  '千葉ロッテマリーンズ': {
    officialName: '千葉ロッテマリーンズ',
    shortName: 'ロッテ',
    league: 'WEST',
    parentTeam: '千葉ロッテマリーンズ',
    colors: { primary: '#000000', secondary: '#FF0000' },
    homeVenues: ['ロッテ浦和球場', '浦和球場']
  }
};

/**
 * Farm Venues Dictionary
 */
export const FARM_VENUES: Record<string, FarmVenueInfo> = {
  // Eastern League Venues
  '読売ジャイアンツ球場': {
    officialName: '読売ジャイアンツ球場',
    commonNames: ['ジャイアンツ球場', 'G球場'],
    location: { prefecture: '神奈川県', city: '川崎市' },
    capacity: 13000,
    opened: 2000,
    surfaceType: 'natural'
  },
  '戸田市営球場': {
    officialName: '戸田市営球場',
    commonNames: ['戸田球場', 'ヤクルト戸田球場'],
    location: { prefecture: '埼玉県', city: '戸田市' },
    capacity: 3500,
    opened: 1993,
    surfaceType: 'natural'
  },
  '横須賀スタジアム': {
    officialName: '横須賀スタジアム',
    commonNames: ['DeNA球場'],
    location: { prefecture: '神奈川県', city: '横須賀市' },
    capacity: 6000,
    opened: 2001,
    surfaceType: 'artificial'
  },
  'ライオンズパーク大宮': {
    officialName: 'ライオンズパーク大宮',
    commonNames: ['大宮球場', '西武大宮球場'],
    location: { prefecture: '埼玉県', city: 'さいたま市' },
    capacity: 5000,
    opened: 1985,
    surfaceType: 'artificial'
  },
  'ファイターズ鎌ケ谷スタジアム': {
    officialName: 'ファイターズ鎌ケ谷スタジアム',
    commonNames: ['鎌ケ谷スタジアム', '鎌ケ谷'],
    location: { prefecture: '千葉県', city: '鎌ケ谷市' },
    capacity: 3500,
    opened: 2009,
    surfaceType: 'artificial'
  },
  '楽天イーグルス利府球場': {
    officialName: '楽天イーグルス利府球場',
    commonNames: ['利府球場', 'イーグルス利府'],
    location: { prefecture: '宮城県', city: '利府町' },
    capacity: 3000,
    opened: 2013,
    surfaceType: 'artificial'
  },
  
  // Western League Venues
  '鳴門・大塚スポーツパーク野球場': {
    officialName: '鳴門・大塚スポーツパーク野球場',
    commonNames: ['鳴門球場', '大塚スポーツパーク'],
    location: { prefecture: '徳島県', city: '鳴門市' },
    capacity: 2500,
    opened: 1998,
    surfaceType: 'natural'
  },
  '大竹市総合市民球場': {
    officialName: '大竹市総合市民球場',
    commonNames: ['大竹球場', 'カープ大竹球場'],
    location: { prefecture: '広島県', city: '大竹市' },
    capacity: 4000,
    opened: 1996,
    surfaceType: 'natural'
  },
  'ナゴヤ球場': {
    officialName: 'ナゴヤ球場',
    commonNames: ['中日二軍', 'ドラゴンズ球場'],
    location: { prefecture: '愛知県', city: '名古屋市' },
    capacity: 20000,
    opened: 1996,
    surfaceType: 'natural'
  },
  'オリックス二軍球場': {
    officialName: 'オリックス二軍球場',
    commonNames: ['舞洲球場', '舞洲ベースボールスタジアム'],
    location: { prefecture: '大阪府', city: '大阪市' },
    capacity: 9000,
    opened: 2006,
    surfaceType: 'artificial'
  },
  'タマホームスタジアム筑後': {
    officialName: 'タマホームスタジアム筑後',
    commonNames: ['筑後', 'HAWKSベースボールパーク筑後'],
    location: { prefecture: '福岡県', city: '筑後市' },
    capacity: 3500,
    opened: 2016,
    surfaceType: 'artificial'
  },
  'ロッテ浦和球場': {
    officialName: 'ロッテ浦和球場',
    commonNames: ['浦和球場', 'マリーンズ浦和'],
    location: { prefecture: '埼玉県', city: 'さいたま市' },
    capacity: 8000,
    opened: 1959,
    surfaceType: 'natural'
  },
  
  // Spring Training & Secondary Venues
  '沖縄セルラー球場': {
    officialName: '沖縄セルラー球場',
    commonNames: ['那覇', 'セルラー'],
    location: { prefecture: '沖縄県', city: '那覇市' },
    capacity: 30000,
    opened: 2000,
    surfaceType: 'natural'
  },
  '北谷公園野球場': {
    officialName: '北谷公園野球場',
    commonNames: ['北谷', 'ちゃたん'],
    location: { prefecture: '沖縄県', city: '北谷町' },
    capacity: 5000,
    opened: 1998,
    surfaceType: 'natural'
  },
  'タピック県総ひやごんスタジアム': {
    officialName: 'タピック県総ひやごんスタジアム',
    commonNames: ['ひやごん', '宮崎'],
    location: { prefecture: '宮崎県', city: '宮崎市' },
    capacity: 35000,
    opened: 1999,
    surfaceType: 'natural'
  },
  '青森県営球場': {
    officialName: '青森県営球場',
    commonNames: ['青森', '県営青森'],
    location: { prefecture: '青森県', city: '青森市' },
    capacity: 25000,
    opened: 1980,
    surfaceType: 'natural'
  }
};

/**
 * Team name normalization
 */
export function normalizeFarmTeamName(input: string): {
  officialName: string;
  shortName: string;
  league: 'EAST' | 'WEST';
} | null {
  const normalized = input.trim().replace(/\s+/g, '');
  
  // Direct matches
  for (const [key, info] of Object.entries(FARM_TEAMS)) {
    if (key === normalized || info.shortName === normalized) {
      return {
        officialName: info.officialName,
        shortName: info.shortName,
        league: info.league
      };
    }
  }
  
  // Partial matches
  const commonMappings: Record<string, string> = {
    '巨人': '読売ジャイアンツ',
    'ヤクルト': '東京ヤクルトスワローズ',
    'DeNA': '横浜DeNAベイスターズ',
    'ベイスターズ': '横浜DeNAベイスターズ',
    '横浜': '横浜DeNAベイスターズ',
    '西武': '埼玉西武ライオンズ',
    'ライオンズ': '埼玉西武ライオンズ',
    '日本ハム': '北海道日本ハムファイターズ',
    'ファイターズ': '北海道日本ハムファイターズ',
    '楽天': '東北楽天ゴールデンイーグルス',
    'イーグルス': '東北楽天ゴールデンイーグルス',
    '阪神': '阪神タイガース',
    'タイガース': '阪神タイガース',
    '広島': '広島東洋カープ',
    'カープ': '広島東洋カープ',
    '中日': '中日ドラゴンズ',
    'ドラゴンズ': '中日ドラゴンズ',
    'オリックス': 'オリックス・バファローズ',
    'バファローズ': 'オリックス・バファローズ',
    'ソフトバンク': '福岡ソフトバンクホークス',
    'ホークス': '福岡ソフトバンクホークス',
    'ロッテ': '千葉ロッテマリーンズ',
    'マリーンズ': '千葉ロッテマリーンズ'
  };
  
  for (const [alias, official] of Object.entries(commonMappings)) {
    if (normalized.includes(alias)) {
      const teamInfo = FARM_TEAMS[official];
      if (teamInfo) {
        return {
          officialName: teamInfo.officialName,
          shortName: teamInfo.shortName,
          league: teamInfo.league
        };
      }
    }
  }
  
  return null;
}

/**
 * Venue name normalization
 */
export function normalizeFarmVenueName(input: string): {
  officialName: string;
  location: { prefecture: string; city: string };
} | null {
  const normalized = input.trim().replace(/\s+/g, '');
  
  // Direct matches
  for (const [key, info] of Object.entries(FARM_VENUES)) {
    if (key.replace(/\s+/g, '') === normalized) {
      return {
        officialName: info.officialName,
        location: info.location
      };
    }
    
    // Check common names
    for (const commonName of info.commonNames) {
      if (commonName.replace(/\s+/g, '') === normalized) {
        return {
          officialName: info.officialName,
          location: info.location
        };
      }
    }
  }
  
  // Partial matches
  const venueAliases: Record<string, string> = {
    'ジャイアンツ球場': '読売ジャイアンツ球場',
    'G球場': '読売ジャイアンツ球場',
    '戸田': '戸田市営球場',
    '横須賀': '横須賀スタジアム',
    '大宮': 'ライオンズパーク大宮',
    '鎌ケ谷': 'ファイターズ鎌ケ谷スタジアム',
    '利府': '楽天イーグルス利府球場',
    '鳴門': '鳴門・大塚スポーツパーク野球場',
    '大竹': '大竹市総合市民球場',
    'ナゴヤ': 'ナゴヤ球場',
    '舞洲': 'オリックス二軍球場',
    '筑後': 'タマホームスタジアム筑後',
    '浦和': 'ロッテ浦和球場',
    '沖縄': '沖縄セルラー球場',
    'セルラー': '沖縄セルラー球場',
    '北谷': '北谷公園野球場',
    '青森': '青森県営球場'
  };
  
  for (const [alias, official] of Object.entries(venueAliases)) {
    if (normalized.includes(alias)) {
      const venueInfo = FARM_VENUES[official];
      if (venueInfo) {
        return {
          officialName: venueInfo.officialName,
          location: venueInfo.location
        };
      }
    }
  }
  
  return null;
}

/**
 * Get teams by league
 */
export function getTeamsByLeague(league: 'EAST' | 'WEST'): FarmTeamInfo[] {
  return Object.values(FARM_TEAMS).filter(team => team.league === league);
}

/**
 * Get venues by team
 */
export function getVenuesByTeam(teamName: string): FarmVenueInfo[] {
  const teamInfo = FARM_TEAMS[teamName];
  if (!teamInfo) return [];
  
  return teamInfo.homeVenues
    .map(venueName => FARM_VENUES[venueName])
    .filter(venue => venue !== undefined);
}

/**
 * Complete farm information for a game
 */
export function enrichFarmGameInfo(
  homeTeam: string,
  awayTeam: string,
  venue: string
): {
  homeTeam: { official: string; short: string; league: 'EAST' | 'WEST' } | null;
  awayTeam: { official: string; short: string; league: 'EAST' | 'WEST' } | null;
  venue: { official: string; prefecture: string; city: string } | null;
  gameType: 'intra_league' | 'inter_league' | 'unknown';
} {
  const homeTeamInfo = normalizeFarmTeamName(homeTeam);
  const awayTeamInfo = normalizeFarmTeamName(awayTeam);
  const venueInfo = normalizeFarmVenueName(venue);
  
  let gameType: 'intra_league' | 'inter_league' | 'unknown' = 'unknown';
  
  if (homeTeamInfo && awayTeamInfo) {
    if (homeTeamInfo.league === awayTeamInfo.league) {
      gameType = 'intra_league';
    } else {
      gameType = 'inter_league';
    }
  }
  
  return {
    homeTeam: homeTeamInfo ? {
      official: homeTeamInfo.officialName,
      short: homeTeamInfo.shortName,
      league: homeTeamInfo.league
    } : null,
    awayTeam: awayTeamInfo ? {
      official: awayTeamInfo.officialName,
      short: awayTeamInfo.shortName,
      league: awayTeamInfo.league
    } : null,
    venue: venueInfo ? {
      official: venueInfo.officialName,
      prefecture: venueInfo.location.prefecture,
      city: venueInfo.location.city
    } : null,
    gameType
  };
}