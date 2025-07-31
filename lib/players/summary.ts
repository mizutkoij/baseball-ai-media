// lib/players/summary.ts
export interface PlayerSeason {
  year: number;
  wrc_plus?: number;
  fip_minus?: number;
  iso?: number;
  k_minus_bb_pct?: number;
  era?: number;
  ops?: number;
  avg?: number;
  hr?: number;
  rbi?: number;
  sb?: number;
  [key: string]: any;
}

export interface PlayerDetail {
  id: string;
  name: string;
  primary_pos?: string;
  batting?: PlayerSeason[];
  pitching?: PlayerSeason[];
  career_stats?: {
    batting?: { ops?: number; avg?: number; hr?: number; };
    pitching?: { era?: number; whip?: number; };
  };
}

/**
 * 選手の自動サマリを生成（150-250字）
 * 初見ユーザーが3秒で選手タイプを把握できる要約文
 */
export function buildPlayerSummary(p: PlayerDetail): string {
  const isPitcher = p.primary_pos?.startsWith("P") || p.primary_pos === "投手";
  const seasons = (isPitcher ? p.pitching : p.batting) ?? [];
  
  if (!seasons.length) {
    return `${p.name}の統計は準備中です。NPB公式データを基に独自の係数・定数で分析を行っており、データが蓄積され次第、詳細な分析を提供いたします。`;
  }

  // 直近3年のデータ（2022年以降）
  const recent = seasons.filter(s => s.year >= 2022);
  
  // ピーク年を特定
  const best = seasons.reduce((a, b) => {
    if (isPitcher) {
      const aFip = a.fip_minus ?? 999;
      const bFip = b.fip_minus ?? 999;
      return aFip > bFip ? b : a; // FIP-は低い方が良い
    } else {
      const aWrc = a.wrc_plus ?? -999;
      const bWrc = b.wrc_plus ?? -999;
      return aWrc < bWrc ? b : a; // wRC+は高い方が良い
    }
  });

  if (isPitcher) {
    return buildPitcherSummary(p.name, best, recent);
  } else {
    return buildBatterSummary(p.name, best, recent, p.career_stats?.batting);
  }
}

/**
 * 投手サマリ生成
 */
function buildPitcherSummary(name: string, best: PlayerSeason, recent: PlayerSeason[]): string {
  const fipm = recent.find(s => s.fip_minus !== undefined)?.fip_minus ?? best.fip_minus;
  const kbb = recent.find(s => s.k_minus_bb_pct !== undefined)?.k_minus_bb_pct;
  const era = recent.find(s => s.era !== undefined)?.era ?? best.era;

  let summary = `${name}は投手。`;

  // ピーク年の情報
  if (best.fip_minus) {
    summary += `ピークは${best.year}年（FIP- ${best.fip_minus}）。`;
  } else if (best.era) {
    summary += `ピークは${best.year}年（ERA ${best.era}）。`;
  }

  // 直近の成績
  if (fipm) {
    const performance = fipm < 100 ? '優れた' : fipm < 110 ? '標準的な' : '改善の余地がある';
    summary += `直近はFIP- ${fipm}と${performance}指標を示しています。`;
  } else if (era) {
    summary += `直近のERAは${era}。`;
  }

  // 特徴的な指標
  if (kbb !== undefined) {
    const kbbDesc = kbb > 15 ? '優秀な制球力' : kbb > 10 ? '安定した制球' : '制球に課題';
    summary += `K-BB%は${kbb}%で${kbbDesc}を示しています。`;
  }

  summary += `球場・年度補正を適用した独自の係数で分析しており、NPB環境に特化した評価を提供しています。`;

  return summary;
}

/**
 * 野手サマリ生成
 */
function buildBatterSummary(name: string, best: PlayerSeason, recent: PlayerSeason[], career?: any): string {
  const wrc = recent.find(s => s.wrc_plus !== undefined)?.wrc_plus ?? best.wrc_plus;
  const iso = recent.find(s => s.iso !== undefined)?.iso;
  const ops = recent.find(s => s.ops !== undefined)?.ops ?? career?.ops;

  let summary = `${name}は野手。`;

  // ピーク年の情報
  if (best.wrc_plus) {
    summary += `ピークは${best.year}年（wRC+ ${best.wrc_plus}）。`;
  } else if (best.ops) {
    summary += `ピークは${best.year}年（OPS ${best.ops}）。`;
  }

  // 直近の成績
  if (wrc) {
    const performance = wrc > 130 ? '優秀な' : wrc > 110 ? '標準以上の' : wrc > 90 ? '標準的な' : '改善の余地がある';
    summary += `直近はwRC+ ${wrc}と${performance}打撃成績。`;
  } else if (ops) {
    summary += `直近のOPSは${ops}。`;
  }

  // 打撃特徴
  if (iso !== undefined) {
    const powerDesc = iso > 0.20 ? '優れた長打力' : iso > 0.15 ? '中程度の長打力' : 'コンタクト重視';
    summary += `ISO ${iso}で${powerDesc}を示す傾向。`;
  }

  // 通算成績への言及
  if (career?.hr && career.hr > 200) {
    summary += `通算${career.hr}本塁打の実績。`;
  }

  summary += `NPB専用の年別係数で環境補正を適用し、真の実力を反映した分析を提供しています。`;

  return summary;
}

/**
 * フォールバック用シンプルサマリ
 * データが不足している場合の要約生成
 */
export function buildFallbackSummary(p: PlayerDetail): string {
  const isPitcher = p.primary_pos?.startsWith("P") || p.primary_pos === "投手";
  const career = isPitcher ? p.career_stats?.pitching : p.career_stats?.batting;

  let summary = `${p.name}は${isPitcher ? '投手' : '野手'}。`;

  if (isPitcher && career?.era) {
    summary += `通算ERA ${career.era}の実績を持ちます。`;
  } else if (!isPitcher && career?.ops) {
    summary += `通算OPS ${career.ops}の成績を残しています。`;
  }

  summary += `詳細な分析データは順次追加予定です。NPB公式データを基に独自の係数・定数で環境補正を行い、最も精確な評価を目指しています。`;

  return summary;
}

/**
 * サマリの文字数チェック（150-250字の範囲内に調整）
 */
export function validateSummaryLength(summary: string): string {
  if (summary.length < 150) {
    // 短すぎる場合は補足情報を追加
    summary += `当サイトでは第三者データベースに依存せず、NPB公式発表データのみを使用した完全独立の分析を行っております。`;
  }
  
  if (summary.length > 250) {
    // 長すぎる場合は適切な位置で切り詰め
    summary = summary.substring(0, 247) + '...';
  }

  return summary;
}

/**
 * メイン関数：選手サマリ生成
 */
export function generatePlayerSummary(player: PlayerDetail): string {
  try {
    let summary = buildPlayerSummary(player);
    
    // データが不足している場合はフォールバックを使用
    if (summary.includes('準備中')) {
      summary = buildFallbackSummary(player);
    }
    
    return validateSummaryLength(summary);
  } catch (error) {
    console.error('Player summary generation failed:', error);
    return `${player.name}の分析情報を準備中です。NPB公式データを基にした詳細な統計分析を順次提供してまいります。`;
  }
}