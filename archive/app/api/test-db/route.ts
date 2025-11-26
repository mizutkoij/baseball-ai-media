import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

export async function GET() {
  try {
    // データベースファイルの存在確認
    const dbPath = path.join(process.cwd(), 'comprehensive_baseball_database.db');
    const exists = fs.existsSync(dbPath);
    
    if (!exists) {
      return NextResponse.json({
        error: 'Database file not found',
        path: dbPath
      }, { status: 404 });
    }
    
    // ファイルサイズ取得
    const stats = fs.statSync(dbPath);
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
    
    // データベース接続テスト
    try {
      const Database = require('better-sqlite3');
      const db = new Database(dbPath, { readonly: true });
      
      // 簡単なクエリテスト
      const result = db.prepare('SELECT COUNT(*) as total FROM detailed_players_master').get();
      
      db.close();
      
      return NextResponse.json({
        status: 'success',
        database: {
          path: dbPath,
          size: `${sizeMB} MB`,
          totalPlayers: result.total
        }
      });
      
    } catch (dbError) {
      return NextResponse.json({
        error: 'Database connection failed',
        details: dbError instanceof Error ? dbError.message : String(dbError),
        path: dbPath,
        size: `${sizeMB} MB`
      }, { status: 500 });
    }
    
  } catch (error) {
    return NextResponse.json({
      error: 'System error',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}