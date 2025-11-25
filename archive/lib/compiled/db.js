"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.openConnections = openConnections;
exports.closeConnections = closeConnections;
exports.query = query;
exports.unionQuery = unionQuery;
exports.get = get;
exports.write = write;
exports.transaction = transaction;
exports.selectDbByYear = selectDbByYear;
exports.getDbStats = getDbStats;
const better_sqlite3_1 = require("better-sqlite3");
const fs_1 = require("fs");
const CURRENT_PATH = process.env.DB_CURRENT || './data/db_current.db';
const HISTORY_PATH = process.env.DB_HISTORY || './data/db_history.db';
/**
 * データベース接続を開く
 */
function openConnections() {
    if (!(0, fs_1.existsSync)(CURRENT_PATH)) {
        throw new Error(`Current database not found: ${CURRENT_PATH}`);
    }
    if (!(0, fs_1.existsSync)(HISTORY_PATH)) {
        throw new Error(`History database not found: ${HISTORY_PATH}`);
    }
    const dbCurrent = new better_sqlite3_1.default(CURRENT_PATH);
    const dbHistory = new better_sqlite3_1.default(HISTORY_PATH, { readonly: true });
    return { current: dbCurrent, history: dbHistory };
}
/**
 * 接続を閉じる
 */
function closeConnections(connections) {
    connections.current.close();
    connections.history.close();
}
/**
 * 汎用クエリ実行（フォールバック方式）
 * 1. まず db_current で実行
 * 2. 結果が0件なら db_history で実行
 * 3. 両方の結果をマージして返す
 */
async function query(sql, params = [], options = {}) {
    const connections = openConnections();
    try {
        let results = [];
        if (options.historyOnly) {
            // History のみ
            results = connections.history.prepare(sql).all(...params);
        }
        else if (options.currentOnly) {
            // Current のみ
            results = connections.current.prepare(sql).all(...params);
        }
        else if (options.preferHistory) {
            // History を優先、0件なら Current
            results = connections.history.prepare(sql).all(...params);
            if (results.length === 0) {
                results = connections.current.prepare(sql).all(...params);
            }
        }
        else {
            // デフォルト: Current を優先、0件なら History
            results = connections.current.prepare(sql).all(...params);
            if (results.length === 0) {
                results = connections.history.prepare(sql).all(...params);
            }
        }
        return results;
    }
    finally {
        closeConnections(connections);
    }
}
/**
 * UNION ALL クエリ（両DBから結果を統合）
 */
async function unionQuery(sql, params = []) {
    const connections = openConnections();
    try {
        const currentResults = connections.current.prepare(sql).all(...params);
        const historyResults = connections.history.prepare(sql).all(...params);
        return [...currentResults, ...historyResults];
    }
    finally {
        closeConnections(connections);
    }
}
/**
 * 単一レコード取得（フォールバック方式）
 */
async function get(sql, params = [], options = {}) {
    const results = await query(sql, params, options);
    return results[0];
}
/**
 * 書き込み専用（常に db_current）
 */
function write(sql, params = []) {
    if (!(0, fs_1.existsSync)(CURRENT_PATH)) {
        throw new Error(`Current database not found: ${CURRENT_PATH}`);
    }
    const db = new better_sqlite3_1.default(CURRENT_PATH);
    try {
        return db.prepare(sql).run(...params);
    }
    finally {
        db.close();
    }
}
/**
 * トランザクション実行（db_current のみ）
 */
function transaction(callback) {
    if (!(0, fs_1.existsSync)(CURRENT_PATH)) {
        throw new Error(`Current database not found: ${CURRENT_PATH}`);
    }
    const db = new better_sqlite3_1.default(CURRENT_PATH);
    try {
        const txn = db.transaction(callback);
        return txn();
    }
    finally {
        db.close();
    }
}
/**
 * 年度別データベース選択ヘルパー
 */
function selectDbByYear(year) {
    return year >= 2024 ? 'current' : 'history';
}
/**
 * デバッグ: 両DBの基本統計
 */
async function getDbStats() {
    const connections = openConnections();
    try {
        const currentStats = {
            games: connections.current.prepare('SELECT COUNT(*) as count FROM games').get(),
            batting: connections.current.prepare('SELECT COUNT(*) as count FROM box_batting').get(),
            pitching: connections.current.prepare('SELECT COUNT(*) as count FROM box_pitching').get()
        };
        const historyStats = {
            games: connections.history.prepare('SELECT COUNT(*) as count FROM games').get(),
            batting: connections.history.prepare('SELECT COUNT(*) as count FROM box_batting').get(),
            pitching: connections.history.prepare('SELECT COUNT(*) as count FROM box_pitching').get()
        };
        return {
            current: {
                games: currentStats.games.count,
                batting: currentStats.batting.count,
                pitching: currentStats.pitching.count
            },
            history: {
                games: historyStats.games.count,
                batting: historyStats.batting.count,
                pitching: historyStats.pitching.count
            }
        };
    }
    finally {
        closeConnections(connections);
    }
}
