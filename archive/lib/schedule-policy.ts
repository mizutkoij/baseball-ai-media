/**
 * スマートスケジューリングポリシー
 * 
 * 機能:
 * - 試合有無に応じた可変間隔計画
 * - 時刻帯別頻度調整（先発/ライブ/後処理）
 * - データ駆動型の自動頻度調整
 * - JST時間帯での運用最適化
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from './logger';

export interface TimeWindow {
  start: string;    // "HH:MM" format
  end: string;      // "HH:MM" format  
  everyMin: number; // Minutes between executions
  description?: string;
}

export interface DayPlan {
  date: string;
  hasGames: boolean;
  gameCount: number;
  earliestStart?: string; // "HH:MM"
  latestStart?: string;   // "HH:MM"
  expectedEnd?: string;   // "HH:MM"
  
  // 時刻帯別実行計画
  pre: TimeWindow;   // 先発/編成の前段（低頻度）
  live: TimeWindow;  // 試合中（中〜高頻度）
  post: TimeWindow;  // 試合後（結果確定 & 詳細更新）
  
  // メタデータ
  planGeneratedAt: string;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * 時刻文字列を分数に変換
 */
function timeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * 分数を時刻文字列に変換
 */
function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

/**
 * 試合開始時刻を解析
 */
function parseGameTimes(games: any[]): {
  earliest: string;
  latest: string;
  average: string;
  count: number;
} {
  if (!games.length) {
    return {
      earliest: '18:00',
      latest: '18:00', 
      average: '18:00',
      count: 0
    };
  }

  const startTimes = games
    .map(game => {
      // 複数の可能なフィールドから開始時刻を抽出
      const timeStr = game.start_time_jst || 
                     game.startTime || 
                     game.time || 
                     '18:00'; // デフォルト
      
      // "18:00:00" -> "18:00" のような変換
      return timeStr.split(':').slice(0, 2).join(':');
    })
    .filter(time => /^\d{2}:\d{2}$/.test(time))
    .sort();

  if (!startTimes.length) {
    return {
      earliest: '18:00',
      latest: '18:00',
      average: '18:00', 
      count: 0
    };
  }

  const earliest = startTimes[0];
  const latest = startTimes[startTimes.length - 1];
  
  // 平均時刻計算
  const avgMinutes = startTimes
    .map(timeToMinutes)
    .reduce((sum, mins) => sum + mins, 0) / startTimes.length;
    
  const average = minutesToTime(Math.round(avgMinutes));

  return {
    earliest,
    latest,
    average,
    count: startTimes.length
  };
}

/**
 * 試合終了予想時刻を計算
 */
function estimateGameEnd(startTimes: string[]): string {
  if (!startTimes.length) return '21:00';
  
  // 最も遅い開始時刻 + 平均試合時間（3.5時間）
  const latestStart = startTimes[startTimes.length - 1];
  const startMinutes = timeToMinutes(latestStart);
  const endMinutes = startMinutes + 210; // 3.5 hours = 210 minutes
  
  // 23:30を上限とする
  return minutesToTime(Math.min(endMinutes, 23 * 60 + 30));
}

/**
 * プリゲーム予測実行判定
 * 
 * 試合開始60分前に実行すべきかを判定
 */
export function shouldRunPregamePrediction(currentTimeJST: string, gameStartTimes: string[]): {
  shouldRun: boolean;
  targetGames: Array<{ startTime: string; minutesUntilStart: number }>;
  reason: string;
} {
  if (gameStartTimes.length === 0) {
    return {
      shouldRun: false,
      targetGames: [],
      reason: 'No games scheduled for today'
    };
  }

  const currentMinutes = timeToMinutes(currentTimeJST);
  const targetGames: Array<{ startTime: string; minutesUntilStart: number }> = [];

  for (const startTime of gameStartTimes) {
    const gameStartMinutes = timeToMinutes(startTime);
    const minutesUntilStart = gameStartMinutes - currentMinutes;

    // 試合開始60分前±10分の範囲でプリゲーム予測実行
    if (minutesUntilStart >= 50 && minutesUntilStart <= 70) {
      targetGames.push({
        startTime,
        minutesUntilStart
      });
    }
  }

  if (targetGames.length > 0) {
    return {
      shouldRun: true,
      targetGames,
      reason: `${targetGames.length} games in pregame prediction window (60±10 min before start)`
    };
  }

  // 次の予測実行時刻を算出
  const nextPredictionTimes = gameStartTimes.map(startTime => {
    const gameStartMinutes = timeToMinutes(startTime);
    return gameStartMinutes - 60; // 60分前
  }).filter(predictionMinutes => predictionMinutes > currentMinutes);

  if (nextPredictionTimes.length > 0) {
    const nextPredictionMinutes = Math.min(...nextPredictionTimes);
    const timeUntilNext = nextPredictionMinutes - currentMinutes;
    
    return {
      shouldRun: false,
      targetGames: [],
      reason: `Next pregame prediction in ${timeUntilNext} minutes at ${minutesToTime(nextPredictionMinutes)}`
    };
  }

  return {
    shouldRun: false,
    targetGames: [],
    reason: 'All games have passed pregame prediction window'
  };
}

/**
 * データディレクトリから既存の試合データを読み込み
 */
async function loadGameData(date: string, dataDir: string): Promise<any[]> {
  const gamePath = path.join(dataDir, 'games', `date=${date}`, 'latest.json');
  
  try {
    const content = await fs.readFile(gamePath, 'utf-8');
    const games = JSON.parse(content);
    
    // 配列でない場合は空配列を返す
    return Array.isArray(games) ? games : [];
    
  } catch (error) {
    // ファイルが存在しない、または読み込みエラー
    logger.debug({ date, gamePath, error: String(error) }, 'No game data found');
    return [];
  }
}

/**
 * 信頼度を計算
 */
function calculateConfidence(games: any[], isToday: boolean): DayPlan['confidence'] {
  if (games.length === 0) {
    return isToday ? 'low' : 'medium'; // 今日なのにデータなし=低信頼度
  }
  
  if (games.length >= 6) {
    return 'high'; // フル開催
  }
  
  if (games.length >= 3) {
    return 'medium'; // 部分開催
  }
  
  return 'low'; // 少数開催
}

/**
 * 指定日のスケジューリングプランを生成
 */
export async function planFor(date: string, dataDir: string = 'data'): Promise<DayPlan> {
  logger.debug({ date, dataDir }, 'Generating schedule plan');
  
  const games = await loadGameData(date, dataDir);
  const isToday = date === new Date().toISOString().slice(0, 10);
  
  if (!games.length) {
    // 非開催日：低頻度で OK
    logger.debug({ date }, 'No games scheduled - low frequency plan');
    
    return {
      date,
      hasGames: false,
      gameCount: 0,
      pre: { 
        start: '07:00', 
        end: '11:30', 
        everyMin: 120, 
        description: 'Morning data refresh'
      },
      live: { 
        start: '11:30', 
        end: '22:30', 
        everyMin: 120,
        description: 'Daytime monitoring'
      },
      post: { 
        start: '22:30', 
        end: '23:59', 
        everyMin: 120,
        description: 'Evening cleanup'
      },
      planGeneratedAt: new Date().toISOString(),
      confidence: calculateConfidence(games, isToday)
    };
  }

  // 開催日：開始時刻レンジから可変間隔を計算
  const gameTimes = parseGameTimes(games);
  const expectedEnd = estimateGameEnd([gameTimes.latest]);
  
  logger.debug({ 
    date, 
    gameCount: games.length,
    gameTimes,
    expectedEnd
  }, 'Games scheduled - variable frequency plan');

  // 時刻帯別の頻度を動的に計算
  const preEndTime = gameTimes.earliest;
  const liveEndTime = expectedEnd;
  
  // 先発発表頻度：試合開始が早いほど高頻度
  const earlyGameBonus = timeToMinutes(gameTimes.earliest) < 14 * 60; // 14時前
  const preFreq = Math.max(
    15, // 最短15分
    earlyGameBonus ? 30 : 60 // 早期開始なら30分、通常は60分
  );
  
  // ライブ更新頻度：試合数に応じて調整
  const liveFreq = Math.max(
    10, // 最短10分
    games.length >= 6 ? 15 : // フル開催：15分
    games.length >= 3 ? 20 : // 部分開催：20分
    30 // 少数開催：30分
  );
  
  // 後処理頻度：詳細データ取得は適度に
  const postFreq = 30;

  const plan: DayPlan = {
    date,
    hasGames: true,
    gameCount: games.length,
    earliestStart: gameTimes.earliest,
    latestStart: gameTimes.latest,
    expectedEnd,
    
    pre: {
      start: '08:30',
      end: preEndTime,
      everyMin: preFreq,
      description: `Pre-game updates (${games.length} games)`
    },
    live: {
      start: preEndTime,
      end: liveEndTime, 
      everyMin: liveFreq,
      description: `Live game monitoring (${games.length} games)`
    },
    post: {
      start: liveEndTime,
      end: '23:59',
      everyMin: postFreq,
      description: 'Post-game details and cleanup'
    },
    
    planGeneratedAt: new Date().toISOString(),
    confidence: calculateConfidence(games, isToday)
  };

  logger.info({
    date,
    hasGames: plan.hasGames,
    gameCount: plan.gameCount,
    confidence: plan.confidence,
    frequencies: {
      pre: plan.pre.everyMin,
      live: plan.live.everyMin, 
      post: plan.post.everyMin
    }
  }, 'Schedule plan generated');

  return plan;
}

/**
 * 現在時刻が指定ウィンドウ内かチェック
 */
export function isWithinWindow(window: TimeWindow, currentTime: string): boolean {
  const current = timeToMinutes(currentTime);
  const start = timeToMinutes(window.start);
  const end = timeToMinutes(window.end);
  
  // 日をまたぐケース（例：23:00-02:00）
  if (start > end) {
    return current >= start || current < end;
  }
  
  return current >= start && current < end;
}

/**
 * 指定頻度で実行タイミングかチェック
 */
export function isDueForExecution(window: TimeWindow, epochSeconds: number): boolean {
  // 5分ごと起動のうち、指定の粒度に"ほぼ"揃える
  const minutesSlot = Math.floor(epochSeconds / 60) % window.everyMin;
  return minutesSlot === 0;
}

/**
 * 次回実行予想時刻を計算（Unix timestamp）
 */
export function getNextExecutionTime(window: TimeWindow, epochSeconds: number): number {
  const currentMinutes = Math.floor(epochSeconds / 60);
  const nextSlot = Math.ceil(currentMinutes / window.everyMin) * window.everyMin;
  return nextSlot * 60;
}

/**
 * デバッグ用：プランの詳細を表示
 */
export function debugPlan(plan: DayPlan): void {
  console.log(`\n📅 Schedule Plan for ${plan.date}`);
  console.log(`📊 Games: ${plan.gameCount} (${plan.hasGames ? 'Game Day' : 'Off Day'})`);
  console.log(`🎯 Confidence: ${plan.confidence}`);
  
  if (plan.hasGames) {
    console.log(`⏰ Game Times: ${plan.earliestStart} - ${plan.latestStart} (expected end: ${plan.expectedEnd})`);
  }
  
  console.log(`\n📋 Execution Schedule:`);
  console.log(`   Pre:  ${plan.pre.start}-${plan.pre.end} every ${plan.pre.everyMin}min (${plan.pre.description})`);
  console.log(`   Live: ${plan.live.start}-${plan.live.end} every ${plan.live.everyMin}min (${plan.live.description})`);
  console.log(`   Post: ${plan.post.start}-${plan.post.end} every ${plan.post.everyMin}min (${plan.post.description})`);
  
  console.log(`\n🕒 Plan generated: ${plan.planGeneratedAt}`);
}