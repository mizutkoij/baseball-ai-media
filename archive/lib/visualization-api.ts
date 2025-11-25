/**
 * lib/visualization-api.ts - データ可視化API
 * 
 * 収集された野球データをWebサイト用に処理・可視化するAPI
 */

import { NextRequest, NextResponse } from 'next/server'
import mysql from 'mysql2/promise'
import { format, subDays, parseISO } from 'date-fns'

// MySQL接続設定
const createConnection = async () => {
  return await mysql.createConnection({
    host: process.env.MYSQL_HOST || 'localhost',
    user: process.env.MYSQL_USER || 'baseball_user',
    password: process.env.MYSQL_PASSWORD || 'secure_password',
    database: process.env.MYSQL_DATABASE || 'baseball_data',
    charset: 'utf8mb4'
  })
}

export interface TeamRosterData {
  team: string
  playerCount: number
  lastUpdated: string
  players: Array<{
    name: string
    number: number | null
    position: string
  }>
}

export interface GameData {
  gameDate: string
  homeTeam: string
  awayTeam: string
  homeScore: number | null
  awayScore: number | null
  status: string
}

export interface StatsData {
  playerName: string
  team: string
  battingAvg: number | null
  homeRuns: number | null
  rbis: number | null
  era: number | null
  wins: number | null
  losses: number | null
  dataDate: string
}

export interface CollectionMetrics {
  totalCollectedToday: number
  totalFiles: number
  lastCollectionTime: string
  collectionStatus: {
    completed: number
    pending: number
    failed: number
  }
  recentActivity: Array<{
    timestamp: string
    action: string
    target: string
    status: string
  }>
}

/**
 * チーム別ロスターデータを取得
 */
export const getTeamRosters = async (team?: string, date?: string): Promise<TeamRosterData[]> => {
  const connection = await createConnection()
  
  try {
    const targetDate = date || format(new Date(), 'yyyy-MM-dd')
    
    let query = `
      SELECT 
        team,
        COUNT(*) as player_count,
        MAX(collection_date) as last_updated,
        JSON_ARRAYAGG(
          JSON_OBJECT(
            'name', player_name,
            'number', number,
            'position', position
          )
        ) as players
      FROM baseball_rosters 
      WHERE collection_date = ?
    `
    
    const params: any[] = [targetDate]
    
    if (team) {
      query += ' AND team = ?'
      params.push(team)
    }
    
    query += ' GROUP BY team ORDER BY team'
    
    const [rows] = await connection.execute(query, params)
    
    return (rows as any[]).map(row => ({
      team: row.team,
      playerCount: row.player_count,
      lastUpdated: row.last_updated,
      players: JSON.parse(row.players)
    }))
  } finally {
    await connection.end()
  }
}

/**
 * 試合データを取得
 */
export const getGames = async (startDate?: string, endDate?: string): Promise<GameData[]> => {
  const connection = await createConnection()
  
  try {
    const start = startDate || format(subDays(new Date(), 7), 'yyyy-MM-dd')
    const end = endDate || format(new Date(), 'yyyy-MM-dd')
    
    const [rows] = await connection.execute(`
      SELECT 
        game_date,
        home_team,
        away_team,
        home_score,
        away_score,
        status
      FROM baseball_games 
      WHERE game_date BETWEEN ? AND ?
      ORDER BY game_date DESC, home_team
    `, [start, end])
    
    return (rows as any[]).map(row => ({
      gameDate: row.game_date,
      homeTeam: row.home_team,
      awayTeam: row.away_team,
      homeScore: row.home_score,
      awayScore: row.away_score,
      status: row.status
    }))
  } finally {
    await connection.end()
  }
}

/**
 * 選手統計データを取得
 */
export const getPlayerStats = async (team?: string, limit: number = 20): Promise<StatsData[]> => {
  const connection = await createConnection()
  
  try {
    let query = `
      SELECT 
        name as player_name,
        team,
        batting_avg,
        home_runs,
        rbis,
        era,
        wins,
        losses,
        data_date
      FROM baseball_players 
      WHERE data_date = (
        SELECT MAX(data_date) FROM baseball_players
      )
    `
    
    const params: any[] = []
    
    if (team) {
      query += ' AND team = ?'
      params.push(team)
    }
    
    query += ` 
      ORDER BY 
        CASE WHEN batting_avg IS NOT NULL THEN batting_avg ELSE 0 END DESC,
        CASE WHEN era IS NOT NULL THEN era ELSE 99.99 END ASC
      LIMIT ?
    `
    params.push(limit)
    
    const [rows] = await connection.execute(query, params)
    
    return (rows as any[]).map(row => ({
      playerName: row.player_name,
      team: row.team,
      battingAvg: row.batting_avg,
      homeRuns: row.home_runs,
      rbis: row.rbis,
      era: row.era,
      wins: row.wins,
      losses: row.losses,
      dataDate: row.data_date
    }))
  } finally {
    await connection.end()
  }
}

/**
 * データ収集メトリクスを取得
 */
export const getCollectionMetrics = async (): Promise<CollectionMetrics> => {
  const connection = await createConnection()
  
  try {
    // 今日の収集統計
    const today = format(new Date(), 'yyyy-MM-dd')
    
    const [todayStats] = await connection.execute(`
      SELECT 
        SUM(records_updated) as total_collected
      FROM data_update_log 
      WHERE DATE(created_at) = ? AND status = 'success'
    `, [today])
    
    // 総ファイル数
    const [fileCount] = await connection.execute(`
      SELECT COUNT(*) as total_files
      FROM data_update_log 
      WHERE status = 'success'
    `)
    
    // 最後の収集時刻
    const [lastCollection] = await connection.execute(`
      SELECT MAX(created_at) as last_collection
      FROM data_update_log 
      WHERE status = 'success'
    `)
    
    // 最近のアクティビティ
    const [recentActivity] = await connection.execute(`
      SELECT 
        created_at as timestamp,
        update_type as action,
        source_file as target,
        status
      FROM data_update_log 
      ORDER BY created_at DESC
      LIMIT 10
    `)
    
    return {
      totalCollectedToday: (todayStats as any[])[0]?.total_collected || 0,
      totalFiles: (fileCount as any[])[0]?.total_files || 0,
      lastCollectionTime: (lastCollection as any[])[0]?.last_collection || '',
      collectionStatus: {
        completed: 0, // SQLiteから取得する必要がある
        pending: 0,
        failed: 0
      },
      recentActivity: (recentActivity as any[]).map(row => ({
        timestamp: row.timestamp,
        action: row.action,
        target: row.target,
        status: row.status
      }))
    }
  } finally {
    await connection.end()
  }
}

/**
 * チーム一覧を取得
 */
export const getTeams = async (): Promise<string[]> => {
  const connection = await createConnection()
  
  try {
    const [rows] = await connection.execute(`
      SELECT DISTINCT team 
      FROM baseball_rosters 
      WHERE collection_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
      ORDER BY team
    `)
    
    return (rows as any[]).map(row => row.team)
  } finally {
    await connection.end()
  }
}

/**
 * 日別収集サマリーを取得
 */
export const getDailySummary = async (days: number = 7): Promise<Array<{
  date: string
  teamsUpdated: number
  playersUpdated: number
  gamesUpdated: number
}>> => {
  const connection = await createConnection()
  
  try {
    const [rows] = await connection.execute(`
      SELECT 
        DATE(created_at) as date,
        COUNT(DISTINCT CASE WHEN update_type = 'roster' THEN source_file END) as teams_updated,
        SUM(CASE WHEN update_type = 'roster' THEN records_updated ELSE 0 END) as players_updated,
        SUM(CASE WHEN update_type = 'game' THEN records_updated ELSE 0 END) as games_updated
      FROM data_update_log 
      WHERE 
        created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
        AND status = 'success'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `, [days])
    
    return (rows as any[]).map(row => ({
      date: row.date,
      teamsUpdated: row.teams_updated || 0,
      playersUpdated: row.players_updated || 0,
      gamesUpdated: row.games_updated || 0
    }))
  } finally {
    await connection.end()
  }
}

/**
 * エラー処理付きAPI応答を生成
 */
export const createApiResponse = <T>(data: T, status: number = 200): NextResponse => {
  return NextResponse.json({
    success: status < 400,
    data,
    timestamp: new Date().toISOString()
  }, { status })
}

/**
 * エラー応答を生成
 */
export const createErrorResponse = (message: string, status: number = 500): NextResponse => {
  return NextResponse.json({
    success: false,
    error: message,
    timestamp: new Date().toISOString()
  }, { status })
}