#!/usr/bin/env python3
"""
Player Performance Predictor System
選手パフォーマンス予測システム
機械学習で選手の次シーズン成績を予測
"""

import sqlite3
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple
import logging
from dataclasses import dataclass
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.linear_model import LinearRegression
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_squared_error, r2_score
import matplotlib.pyplot as plt
import seaborn as sns
import json

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 日本語フォント設定
plt.rcParams['font.family'] = ['Yu Gothic', 'Meiryo', 'DejaVu Sans']

@dataclass
class PredictionResult:
    player_id: int
    player_name: str
    league: str
    prediction_type: str  # 'batting' or 'pitching'
    predicted_stats: Dict[str, float]
    confidence_score: float
    comparable_seasons: List[Dict]
    prediction_date: datetime

class PlayerPerformancePredictor:
    def __init__(self, db_path: str = "comprehensive_baseball_database.db"):
        self.db_path = db_path
        self.models = {}
        self.scalers = {}
        self.feature_importance = {}
        
    def connect_db(self):
        return sqlite3.connect(self.db_path)
    
    def load_player_data(self, min_seasons: int = 3) -> pd.DataFrame:
        """選手の過去成績データを読み込み"""
        conn = self.connect_db()
        
        query = """
        SELECT 
            p.player_id, p.full_name, p.league, p.age, p.primary_position,
            p.nationality, p.height_cm, p.weight_kg,
            y.season, y.age as season_age, y.games_played,
            y.at_bats, y.hits, y.doubles, y.triples, y.home_runs,
            y.runs, y.rbis, y.walks, y.strikeouts, y.stolen_bases,
            y.batting_avg, y.on_base_pct, y.slugging_pct, y.ops,
            y.innings_pitched, y.hits_allowed, y.runs_allowed, y.earned_runs,
            y.walks_allowed, y.strikeouts_pitched, y.home_runs_allowed,
            y.wins, y.losses, y.saves, y.era, y.whip
        FROM detailed_players_master p
        JOIN yearly_performance y ON p.player_id = y.player_id
        WHERE p.league IN ('npb', 'kbo')
        AND y.season IS NOT NULL
        ORDER BY p.player_id, y.season
        """
        
        df = pd.read_sql_query(query, conn)
        conn.close()
        
        # 最低限のシーズン数を持つ選手のみ
        player_seasons = df.groupby('player_id').size()
        valid_players = player_seasons[player_seasons >= min_seasons].index
        df = df[df['player_id'].isin(valid_players)]
        
        logger.info(f"データ読み込み完了: {len(df)}レコード, {len(valid_players)}選手")
        return df
    
    def create_batting_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """打撃予測用の特徴量作成"""
        batting_df = df[df['at_bats'] > 0].copy()
        
        # 基本特徴量
        features = ['season_age', 'games_played', 'at_bats', 'height_cm', 'weight_kg']
        
        # 過去3年の移動平均
        batting_df = batting_df.sort_values(['player_id', 'season'])
        for stat in ['batting_avg', 'on_base_pct', 'slugging_pct', 'home_runs']:
            batting_df[f'{stat}_ma3'] = batting_df.groupby('player_id')[stat].transform(
                lambda x: x.rolling(window=3, min_periods=1).mean()
            )
            features.append(f'{stat}_ma3')
        
        # トレンド特徴量（前年比）
        for stat in ['batting_avg', 'home_runs', 'rbis']:
            batting_df[f'{stat}_trend'] = batting_df.groupby('player_id')[stat].pct_change()
            features.append(f'{stat}_trend')
        
        # 年齢関連特徴量
        batting_df['age_squared'] = batting_df['season_age'] ** 2
        batting_df['prime_years'] = ((batting_df['season_age'] >= 25) & 
                                   (batting_df['season_age'] <= 32)).astype(int)
        features.extend(['age_squared', 'prime_years'])
        
        # カテゴリ特徴量
        batting_df['is_foreign'] = (batting_df['nationality'] != 'JPN').astype(int)
        batting_df['league_npb'] = (batting_df['league'] == 'npb').astype(int)
        features.extend(['is_foreign', 'league_npb'])
        
        return batting_df, features
    
    def create_pitching_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """投手予測用の特徴量作成"""
        pitching_df = df[df['innings_pitched'] > 0].copy()
        
        features = ['season_age', 'innings_pitched', 'height_cm', 'weight_kg']
        
        # 過去3年移動平均
        pitching_df = pitching_df.sort_values(['player_id', 'season'])
        for stat in ['era', 'whip', 'strikeouts_pitched', 'wins']:
            pitching_df[f'{stat}_ma3'] = pitching_df.groupby('player_id')[stat].transform(
                lambda x: x.rolling(window=3, min_periods=1).mean()
            )
            features.append(f'{stat}_ma3')
        
        # トレンド特徴量
        for stat in ['era', 'wins', 'strikeouts_pitched']:
            pitching_df[f'{stat}_trend'] = pitching_df.groupby('player_id')[stat].pct_change()
            features.append(f'{stat}_trend')
        
        # 年齢・体格特徴量
        pitching_df['age_squared'] = pitching_df['season_age'] ** 2
        pitching_df['bmi'] = pitching_df['weight_kg'] / (pitching_df['height_cm'] / 100) ** 2
        features.extend(['age_squared', 'bmi'])
        
        # カテゴリ特徴量
        pitching_df['is_foreign'] = (pitching_df['nationality'] != 'JPN').astype(int)
        pitching_df['league_npb'] = (pitching_df['league'] == 'npb').astype(int)
        features.extend(['is_foreign', 'league_npb'])
        
        return pitching_df, features
    
    def train_batting_models(self, df: pd.DataFrame, features: List[str]) -> Dict:
        """打撃成績予測モデル訓練"""
        logger.info("打撃予測モデル訓練開始...")
        
        # 目標変数
        targets = ['batting_avg', 'home_runs', 'rbis', 'ops']
        models = {}
        
        for target in targets:
            logger.info(f"  {target} 予測モデル訓練中...")
            
            # データ準備
            train_data = df[features + [target]].dropna()
            X = train_data[features]
            y = train_data[target]
            
            if len(X) < 50:  # 最低データ数チェック
                logger.warning(f"  {target}: データ不足 (n={len(X)})")
                continue
            
            # 訓練・テスト分割
            X_train, X_test, y_train, y_test = train_test_split(
                X, y, test_size=0.2, random_state=42
            )
            
            # 特徴量スケーリング
            scaler = StandardScaler()
            X_train_scaled = scaler.fit_transform(X_train)
            X_test_scaled = scaler.transform(X_test)
            
            # 複数モデルで訓練
            model_results = {}
            
            # Random Forest
            rf_model = RandomForestRegressor(n_estimators=100, random_state=42)
            rf_model.fit(X_train, y_train)
            rf_pred = rf_model.predict(X_test)
            model_results['random_forest'] = {
                'model': rf_model,
                'score': r2_score(y_test, rf_pred),
                'mse': mean_squared_error(y_test, rf_pred)
            }
            
            # Gradient Boosting
            gb_model = GradientBoostingRegressor(n_estimators=100, random_state=42)
            gb_model.fit(X_train, y_train)
            gb_pred = gb_model.predict(X_test)
            model_results['gradient_boosting'] = {
                'model': gb_model,
                'score': r2_score(y_test, gb_pred),
                'mse': mean_squared_error(y_test, gb_pred)
            }
            
            # Linear Regression
            lr_model = LinearRegression()
            lr_model.fit(X_train_scaled, y_train)
            lr_pred = lr_model.predict(X_test_scaled)
            model_results['linear'] = {
                'model': lr_model,
                'score': r2_score(y_test, lr_pred),
                'mse': mean_squared_error(y_test, lr_pred)
            }
            
            # 最良モデル選択
            best_model_name = max(model_results.keys(), 
                                key=lambda x: model_results[x]['score'])
            best_model = model_results[best_model_name]
            
            models[target] = {
                'model': best_model['model'],
                'scaler': scaler,
                'score': best_model['score'],
                'model_type': best_model_name,
                'features': features
            }
            
            logger.info(f"  {target}: 最良モデル={best_model_name}, R²={best_model['score']:.3f}")
        
        return models
    
    def train_pitching_models(self, df: pd.DataFrame, features: List[str]) -> Dict:
        """投手成績予測モデル訓練"""
        logger.info("投手予測モデル訓練開始...")
        
        targets = ['era', 'wins', 'strikeouts_pitched', 'whip']
        models = {}
        
        for target in targets:
            logger.info(f"  {target} 予測モデル訓練中...")
            
            train_data = df[features + [target]].dropna()
            X = train_data[features]
            y = train_data[target]
            
            if len(X) < 30:
                logger.warning(f"  {target}: データ不足 (n={len(X)})")
                continue
            
            X_train, X_test, y_train, y_test = train_test_split(
                X, y, test_size=0.2, random_state=42
            )
            
            scaler = StandardScaler()
            X_train_scaled = scaler.fit_transform(X_train)
            X_test_scaled = scaler.transform(X_test)
            
            # Random Forestが最も安定的
            model = RandomForestRegressor(n_estimators=100, random_state=42)
            model.fit(X_train, y_train)
            pred = model.predict(X_test)
            score = r2_score(y_test, pred)
            
            models[target] = {
                'model': model,
                'scaler': scaler,
                'score': score,
                'features': features
            }
            
            logger.info(f"  {target}: R²={score:.3f}")
        
        return models
    
    def predict_player_performance(self, player_id: int, 
                                  prediction_year: int = 2025) -> Optional[PredictionResult]:
        """特定選手のパフォーマンス予測"""
        conn = self.connect_db()
        
        # 選手の過去データ取得
        query = """
        SELECT p.*, y.* FROM detailed_players_master p
        JOIN yearly_performance y ON p.player_id = y.player_id
        WHERE p.player_id = ?
        ORDER BY y.season DESC
        """
        
        player_data = pd.read_sql_query(query, conn, params=(player_id,))
        conn.close()
        
        if player_data.empty:
            logger.warning(f"選手ID {player_id} のデータが見つかりません")
            return None
        
        latest_season = player_data.iloc[0]
        player_name = latest_season['full_name']
        league = latest_season['league']
        
        logger.info(f"{player_name} ({league.upper()}) の予測を開始...")
        
        # 打者か投手かを判定
        is_pitcher = (latest_season['innings_pitched'] or 0) > (latest_season['at_bats'] or 0)
        
        if is_pitcher:
            return self.predict_pitching_performance(player_data, prediction_year)
        else:
            return self.predict_batting_performance(player_data, prediction_year)
    
    def predict_batting_performance(self, player_data: pd.DataFrame, 
                                  prediction_year: int) -> PredictionResult:
        """打撃成績予測"""
        # 全データで再訓練（より正確な予測のため）
        full_data = self.load_player_data()
        batting_data, features = self.create_batting_features(full_data)
        batting_models = self.train_batting_models(batting_data, features)
        
        # 予測用データ準備
        latest_data = player_data.iloc[0]
        
        # 特徴量作成（簡略版）
        pred_features = {
            'season_age': latest_data['age'] + 1,  # 来年の年齢
            'games_played': latest_data.get('games_played', 140),
            'at_bats': latest_data.get('at_bats', 500),
            'height_cm': latest_data.get('height_cm', 175),
            'weight_kg': latest_data.get('weight_kg', 75),
            'batting_avg_ma3': latest_data.get('batting_avg', 0.250),
            'home_runs_trend': 0.0,  # 中性的なトレンド
            'age_squared': (latest_data['age'] + 1) ** 2,
            'prime_years': 1 if 25 <= (latest_data['age'] + 1) <= 32 else 0,
            'is_foreign': 1 if latest_data['nationality'] != 'JPN' else 0,
            'league_npb': 1 if latest_data['league'] == 'npb' else 0
        }
        
        # 不足特徴量を平均値で補完
        for feature in features:
            if feature not in pred_features:
                pred_features[feature] = 0.0
        
        # 予測実行
        predictions = {}
        confidence_scores = []
        
        for target, model_info in batting_models.items():
            try:
                # 安全な特徴量配列作成
                feature_values = []
                for f in model_info['features']:
                    value = pred_features.get(f, 0.0)
                    feature_values.append(float(value))
                
                X_pred = np.array(feature_values, dtype=np.float64).reshape(1, -1)
                
                if model_info.get('model_type') == 'linear':
                    X_pred = model_info['scaler'].transform(X_pred)
                
                prediction = model_info['model'].predict(X_pred)[0]
                predictions[target] = round(float(prediction), 3)
                confidence_scores.append(model_info['score'])
                
            except Exception as e:
                logger.error(f"予測エラー ({target}): {e}")
                predictions[target] = 0.0
        
        avg_confidence = np.mean(confidence_scores) if confidence_scores else 0.0
        
        return PredictionResult(
            player_id=int(latest_data['player_id']),
            player_name=latest_data['full_name'],
            league=latest_data['league'],
            prediction_type='batting',
            predicted_stats=predictions,
            confidence_score=round(avg_confidence, 3),
            comparable_seasons=[],
            prediction_date=datetime.now()
        )
    
    def predict_pitching_performance(self, player_data: pd.DataFrame, 
                                   prediction_year: int) -> PredictionResult:
        """投手成績予測"""
        full_data = self.load_player_data()
        pitching_data, features = self.create_pitching_features(full_data)
        pitching_models = self.train_pitching_models(pitching_data, features)
        
        latest_data = player_data.iloc[0]
        
        pred_features = {
            'season_age': latest_data['age'] + 1,
            'innings_pitched': latest_data.get('innings_pitched', 150),
            'height_cm': latest_data.get('height_cm', 180),
            'weight_kg': latest_data.get('weight_kg', 80),
            'era_ma3': latest_data.get('era', 3.50),
            'wins_trend': 0.0,
            'age_squared': (latest_data['age'] + 1) ** 2,
            'bmi': latest_data.get('weight_kg', 80) / (latest_data.get('height_cm', 180) / 100) ** 2,
            'is_foreign': 1 if latest_data['nationality'] != 'JPN' else 0,
            'league_npb': 1 if latest_data['league'] == 'npb' else 0
        }
        
        for feature in features:
            if feature not in pred_features:
                pred_features[feature] = 0.0
        
        predictions = {}
        confidence_scores = []
        
        for target, model_info in pitching_models.items():
            try:
                # 安全な特徴量配列作成
                feature_values = []
                for f in model_info['features']:
                    value = pred_features.get(f, 0.0)
                    feature_values.append(float(value))
                
                X_pred = np.array(feature_values, dtype=np.float64).reshape(1, -1)
                prediction = model_info['model'].predict(X_pred)[0]
                predictions[target] = round(float(prediction), 3)
                confidence_scores.append(model_info['score'])
            except Exception as e:
                logger.error(f"投手予測エラー ({target}): {e}")
                predictions[target] = 0.0
        
        avg_confidence = np.mean(confidence_scores) if confidence_scores else 0.0
        
        return PredictionResult(
            player_id=int(latest_data['player_id']),
            player_name=latest_data['full_name'],
            league=latest_data['league'],
            prediction_type='pitching',
            predicted_stats=predictions,
            confidence_score=round(avg_confidence, 3),
            comparable_seasons=[],
            prediction_date=datetime.now()
        )
    
    def batch_predict_league(self, league: str = 'npb', limit: int = 50) -> List[PredictionResult]:
        """リーグ全選手の一括予測"""
        conn = self.connect_db()
        
        # アクティブな選手を取得
        query = """
        SELECT DISTINCT p.player_id, p.full_name 
        FROM detailed_players_master p
        JOIN yearly_performance y ON p.player_id = y.player_id
        WHERE p.league = ? 
        AND y.season >= 2020
        ORDER BY p.full_name
        LIMIT ?
        """
        
        players = pd.read_sql_query(query, conn, params=(league, limit))
        conn.close()
        
        predictions = []
        
        for _, player in players.iterrows():
            try:
                prediction = self.predict_player_performance(player['player_id'])
                if prediction:
                    predictions.append(prediction)
                    logger.info(f"  予測完了: {prediction.player_name}")
            except Exception as e:
                logger.error(f"予測失敗: {player['full_name']} - {e}")
        
        return predictions
    
    def create_prediction_report(self, predictions: List[PredictionResult]) -> str:
        """予測レポート作成"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"player_predictions_{timestamp}.json"
        
        report_data = {
            'generation_time': datetime.now().isoformat(),
            'total_predictions': len(predictions),
            'predictions': []
        }
        
        for pred in predictions:
            report_data['predictions'].append({
                'player_id': pred.player_id,
                'player_name': pred.player_name,
                'league': pred.league.upper(),
                'prediction_type': pred.prediction_type,
                'predicted_stats': pred.predicted_stats,
                'confidence_score': pred.confidence_score
            })
        
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(report_data, f, indent=2, ensure_ascii=False)
        
        logger.info(f"予測レポート保存: {filename}")
        return filename
    
    def visualize_predictions(self, predictions: List[PredictionResult]) -> str:
        """予測結果可視化"""
        if not predictions:
            return ""
        
        fig, axes = plt.subplots(2, 2, figsize=(15, 12))
        fig.suptitle('Player Performance Predictions\n選手パフォーマンス予測結果', fontsize=16)
        
        batting_preds = [p for p in predictions if p.prediction_type == 'batting']
        pitching_preds = [p for p in predictions if p.prediction_type == 'pitching']
        
        # 打率予測分布
        if batting_preds:
            batting_avgs = [p.predicted_stats.get('batting_avg', 0) for p in batting_preds]
            axes[0,0].hist(batting_avgs, bins=20, alpha=0.7, color='skyblue')
            axes[0,0].set_title('予測打率分布')
            axes[0,0].set_xlabel('打率')
            axes[0,0].set_ylabel('選手数')
        
        # 本塁打予測分布
        if batting_preds:
            hrs = [p.predicted_stats.get('home_runs', 0) for p in batting_preds]
            axes[0,1].hist(hrs, bins=20, alpha=0.7, color='lightcoral')
            axes[0,1].set_title('予測本塁打分布')
            axes[0,1].set_xlabel('本塁打数')
            axes[0,1].set_ylabel('選手数')
        
        # ERA予測分布
        if pitching_preds:
            eras = [p.predicted_stats.get('era', 0) for p in pitching_preds]
            axes[1,0].hist(eras, bins=20, alpha=0.7, color='lightgreen')
            axes[1,0].set_title('予測ERA分布')
            axes[1,0].set_xlabel('ERA')
            axes[1,0].set_ylabel('投手数')
        
        # 信頼度分布
        confidences = [p.confidence_score for p in predictions]
        axes[1,1].hist(confidences, bins=20, alpha=0.7, color='gold')
        axes[1,1].set_title('予測信頼度分布')
        axes[1,1].set_xlabel('信頼度スコア')
        axes[1,1].set_ylabel('選手数')
        
        plt.tight_layout()
        
        filename = f'prediction_visualization_{datetime.now().strftime("%Y%m%d_%H%M%S")}.png'
        plt.savefig(filename, dpi=300, bbox_inches='tight')
        plt.close()
        
        return filename

def main():
    """メイン実行"""
    predictor = PlayerPerformancePredictor()
    
    print("="*80)
    print("PLAYER PERFORMANCE PREDICTOR SYSTEM")
    print("選手パフォーマンス予測システム")
    print("="*80)
    
    print("\n1: 特定選手予測")
    print("2: NPB全選手予測 (サンプル50名)")
    print("3: KBO全選手予測 (サンプル50名)")
    print("4: 両リーグ予測")
    
    choice = input("選択してください (1-4): ").strip()
    
    if choice == '1':
        player_id = int(input("選手ID: "))
        result = predictor.predict_player_performance(player_id)
        if result:
            print(f"\n{result.player_name} ({result.league.upper()}) - {result.prediction_type}")
            print("予測成績:")
            for stat, value in result.predicted_stats.items():
                print(f"  {stat}: {value}")
            print(f"信頼度: {result.confidence_score:.3f}")
    
    elif choice in ['2', '3', '4']:
        leagues = {'2': 'npb', '3': 'kbo', '4': 'both'}
        
        if choice == '4':
            npb_preds = predictor.batch_predict_league('npb', 25)
            kbo_preds = predictor.batch_predict_league('kbo', 25)
            all_predictions = npb_preds + kbo_preds
        else:
            all_predictions = predictor.batch_predict_league(leagues[choice], 50)
        
        if all_predictions:
            report_file = predictor.create_prediction_report(all_predictions)
            viz_file = predictor.visualize_predictions(all_predictions)
            
            print(f"\n予測完了: {len(all_predictions)}選手")
            print(f"レポート: {report_file}")
            print(f"可視化: {viz_file}")

if __name__ == "__main__":
    main()