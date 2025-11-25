#!/usr/bin/env python3
"""
Career Trajectory Analyzer System
選手キャリア軌跡分析システム
選手のキャリアパターンを分析し、将来の軌跡を予測
"""

import sqlite3
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple
import logging
from dataclasses import dataclass
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA
import json

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 日本語フォント設定
plt.rcParams['font.family'] = ['Yu Gothic', 'Meiryo', 'DejaVu Sans']

@dataclass
class CareerTrajectory:
    player_id: int
    player_name: str
    league: str
    career_phase: str  # 'rookie', 'developing', 'prime', 'veteran', 'decline'
    career_pattern: str  # クラスタリング結果
    peak_season: int
    peak_performance: Dict[str, float]
    trajectory_score: float
    similar_players: List[Dict[str, Any]]
    projected_remaining_years: int
    breakout_probability: float

@dataclass
class CareerMilestone:
    milestone_name: str
    achieved_season: Optional[int]
    achievement_date: Optional[datetime]
    performance_at_milestone: Dict[str, float]
    age_at_achievement: Optional[int]

class CareerTrajectoryAnalyzer:
    def __init__(self, db_path: str = "comprehensive_baseball_database.db"):
        self.db_path = db_path
        self.career_patterns = {}
        
        # キャリア段階定義
        self.career_phases = {
            'rookie': (0, 2),      # 1-2年目
            'developing': (3, 5),   # 3-5年目
            'prime': (6, 12),      # 6-12年目
            'veteran': (13, 18),   # 13-18年目
            'decline': (19, 30)    # 19年目以降
        }
        
        # マイルストーン定義
        self.milestones = {
            'batting': {
                '初本塁打': {'stat': 'home_runs', 'threshold': 1},
                '年間20本塁打': {'stat': 'home_runs', 'threshold': 20},
                '年間30本塁打': {'stat': 'home_runs', 'threshold': 30},
                '通算100本塁打': {'stat': 'career_home_runs', 'threshold': 100},
                '通算200本塁打': {'stat': 'career_home_runs', 'threshold': 200},
                '年間打率.300': {'stat': 'batting_avg', 'threshold': 0.300},
                '年間100打点': {'stat': 'rbis', 'threshold': 100},
                'MVP級成績': {'stat': 'ops', 'threshold': 1.000}
            },
            'pitching': {
                '初勝利': {'stat': 'wins', 'threshold': 1},
                '年間10勝': {'stat': 'wins', 'threshold': 10},
                '年間15勝': {'stat': 'wins', 'threshold': 15},
                '通算50勝': {'stat': 'career_wins', 'threshold': 50},
                '通算100勝': {'stat': 'career_wins', 'threshold': 100},
                '年間ERA2.00台': {'stat': 'era', 'threshold': 2.99, 'direction': 'below'},
                '年間200奪三振': {'stat': 'strikeouts_pitched', 'threshold': 200},
                'サイヤング級成績': {'stat': 'era', 'threshold': 2.50, 'direction': 'below'}
            }
        }
    
    def connect_db(self):
        return sqlite3.connect(self.db_path)
    
    def load_career_data(self, min_seasons: int = 3) -> pd.DataFrame:
        """キャリアデータ読み込み"""
        conn = self.connect_db()
        
        query = """
        SELECT 
            p.player_id, p.full_name, p.league, p.nationality,
            p.primary_position, p.height_cm, p.weight_kg,
            y.season, y.age as season_age, y.games_played,
            y.at_bats, y.hits, y.home_runs, y.rbis, y.runs,
            y.batting_avg, y.on_base_pct, y.slugging_pct, y.ops,
            y.innings_pitched, y.wins, y.losses, y.era, y.whip,
            y.strikeouts_pitched, y.walks_allowed,
            ROW_NUMBER() OVER (PARTITION BY p.player_id ORDER BY y.season) as career_year
        FROM detailed_players_master p
        JOIN yearly_performance y ON p.player_id = y.player_id
        WHERE p.league IN ('npb', 'kbo')
        AND y.season IS NOT NULL
        ORDER BY p.player_id, y.season
        """
        
        df = pd.read_sql_query(query, conn)
        conn.close()
        
        # 最低シーズン数フィルタ
        player_seasons = df.groupby('player_id').size()
        valid_players = player_seasons[player_seasons >= min_seasons].index
        df = df[df['player_id'].isin(valid_players)]
        
        # 通算成績計算
        df['career_home_runs'] = df.groupby('player_id')['home_runs'].cumsum()
        df['career_wins'] = df.groupby('player_id')['wins'].cumsum()
        df['career_hits'] = df.groupby('player_id')['hits'].cumsum()
        
        logger.info(f"キャリアデータ読み込み: {len(df)}レコード, {len(valid_players)}選手")
        return df
    
    def identify_career_phase(self, career_year: int, age: int) -> str:
        """キャリア段階識別"""
        for phase, (min_year, max_year) in self.career_phases.items():
            if min_year <= career_year <= max_year:
                return phase
        
        # 年齢ベースの補正
        if age <= 24:
            return 'rookie'
        elif age <= 28:
            return 'developing'
        elif age <= 33:
            return 'prime'
        elif age <= 38:
            return 'veteran'
        else:
            return 'decline'
    
    def calculate_trajectory_features(self, player_data: pd.DataFrame) -> Dict[str, float]:
        """軌跡特徴量計算"""
        player_data = player_data.sort_values('season')
        features = {}
        
        # 基本統計
        features['career_length'] = len(player_data)
        features['debut_age'] = player_data.iloc[0]['season_age']
        features['peak_age'] = player_data.loc[player_data['ops'].idxmax()]['season_age'] if not player_data.empty else 25
        
        # トレンド分析
        if len(player_data) >= 3:
            # OPS推移の傾向
            ops_values = player_data['ops'].fillna(0.700)
            x = np.arange(len(ops_values))
            slope = np.polyfit(x, ops_values, 1)[0] if len(ops_values) > 1 else 0
            features['ops_trend'] = slope
            
            # パフォーマンス安定性
            features['ops_volatility'] = ops_values.std()
            
            # ピーク持続性
            peak_ops = ops_values.max()
            peak_seasons = (ops_values >= peak_ops * 0.9).sum()
            features['peak_sustainability'] = peak_seasons / len(ops_values)
        else:
            features['ops_trend'] = 0
            features['ops_volatility'] = 0
            features['peak_sustainability'] = 0
        
        # 早期ブレイクアウト
        early_career = player_data.head(3)
        features['early_breakout'] = 1 if early_career['ops'].max() > 0.850 else 0
        
        # レイトブルーマー
        if len(player_data) >= 5:
            late_improvement = player_data.tail(3)['ops'].mean() > player_data.head(3)['ops'].mean()
            features['late_bloomer'] = 1 if late_improvement else 0
        else:
            features['late_bloomer'] = 0
        
        return features
    
    def cluster_career_patterns(self, df: pd.DataFrame) -> Dict[str, Any]:
        """キャリアパターンクラスタリング"""
        logger.info("キャリアパターン分析開始...")
        
        # 各選手の特徴量計算
        player_features = []
        player_ids = []
        
        for player_id in df['player_id'].unique():
            player_data = df[df['player_id'] == player_id]
            if len(player_data) >= 3:  # 最低3シーズン
                features = self.calculate_trajectory_features(player_data)
                player_features.append(list(features.values()))
                player_ids.append(player_id)
        
        if not player_features:
            return {'patterns': {}, 'model': None}
        
        # 特徴量正規化
        scaler = StandardScaler()
        features_scaled = scaler.fit_transform(player_features)
        
        # K-meansクラスタリング
        optimal_k = min(6, len(player_features) // 10 + 2)  # 適切なクラスタ数
        kmeans = KMeans(n_clusters=optimal_k, random_state=42)
        clusters = kmeans.fit_predict(features_scaled)
        
        # パターン名定義
        pattern_names = [
            'スーパースター型', '安定成長型', '早期ピーク型',
            'レイトブルーマー型', '波乱型', '短期集中型'
        ]
        
        # クラスタ結果整理
        patterns = {}
        for i in range(optimal_k):
            pattern_name = pattern_names[i] if i < len(pattern_names) else f'パターン{i+1}'
            cluster_players = [player_ids[j] for j in range(len(clusters)) if clusters[j] == i]
            
            patterns[pattern_name] = {
                'cluster_id': i,
                'player_count': len(cluster_players),
                'players': cluster_players,
                'characteristics': self.describe_cluster_characteristics(
                    features_scaled[clusters == i], list(player_features[0].keys()) if player_features else []
                )
            }
        
        logger.info(f"キャリアパターン分析完了: {optimal_k}パターン識別")
        
        return {
            'patterns': patterns,
            'model': kmeans,
            'scaler': scaler,
            'feature_names': list(player_features[0].keys()) if player_features else []
        }
    
    def describe_cluster_characteristics(self, cluster_features: np.ndarray, 
                                       feature_names: List[str]) -> Dict[str, str]:
        """クラスタ特性記述"""
        if len(cluster_features) == 0:
            return {}
        
        characteristics = {}
        for i, feature_name in enumerate(feature_names):
            avg_value = cluster_features[:, i].mean()
            
            if feature_name == 'career_length':
                if avg_value > 0.5:
                    characteristics['longevity'] = '長期現役型'
                else:
                    characteristics['longevity'] = '短期集中型'
            elif feature_name == 'ops_trend':
                if avg_value > 0.01:
                    characteristics['development'] = '成長継続型'
                elif avg_value < -0.01:
                    characteristics['development'] = '衰退型'
                else:
                    characteristics['development'] = '安定型'
            elif feature_name == 'early_breakout':
                if avg_value > 0.5:
                    characteristics['breakout_timing'] = '早期ブレイクアウト'
                else:
                    characteristics['breakout_timing'] = '段階的成長'
        
        return characteristics
    
    def analyze_player_trajectory(self, player_id: int) -> Optional[CareerTrajectory]:
        """個別選手軌跡分析"""
        df = self.load_career_data()
        player_data = df[df['player_id'] == player_id]
        
        if player_data.empty:
            logger.warning(f"選手ID {player_id} のデータが見つかりません")
            return None
        
        latest_data = player_data.iloc[-1]
        player_name = latest_data['full_name']
        league = latest_data['league']
        
        logger.info(f"{player_name} のキャリア軌跡分析開始...")
        
        # キャリア段階判定
        current_year = latest_data['career_year']
        current_age = latest_data['season_age']
        career_phase = self.identify_career_phase(current_year, current_age)
        
        # 軌跡特徴量
        features = self.calculate_trajectory_features(player_data)
        
        # パターンマッチング
        pattern_analysis = self.cluster_career_patterns(df)
        player_pattern = self.classify_player_pattern(features, pattern_analysis)
        
        # ピーク分析
        peak_season_idx = player_data['ops'].idxmax()
        peak_season = player_data.loc[peak_season_idx, 'season']
        peak_performance = {
            'batting_avg': player_data.loc[peak_season_idx, 'batting_avg'],
            'home_runs': player_data.loc[peak_season_idx, 'home_runs'],
            'ops': player_data.loc[peak_season_idx, 'ops']
        }
        
        # 類似選手検索
        similar_players = self.find_similar_trajectories(player_id, df, features)
        
        # 残りキャリア予測
        projected_years = self.predict_remaining_career(current_age, career_phase, features)
        
        # ブレイクアウト確率
        breakout_prob = self.calculate_breakout_probability(player_data, career_phase)
        
        # 軌跡スコア
        trajectory_score = self.calculate_trajectory_score(features, career_phase)
        
        return CareerTrajectory(
            player_id=player_id,
            player_name=player_name,
            league=league.upper(),
            career_phase=career_phase,
            career_pattern=player_pattern,
            peak_season=int(peak_season),
            peak_performance=peak_performance,
            trajectory_score=round(trajectory_score, 1),
            similar_players=similar_players,
            projected_remaining_years=projected_years,
            breakout_probability=round(breakout_prob, 3)
        )
    
    def classify_player_pattern(self, features: Dict[str, float], 
                              pattern_analysis: Dict[str, Any]) -> str:
        """選手パターン分類"""
        if not pattern_analysis.get('model'):
            return 'unknown'
        
        feature_vector = np.array(list(features.values())).reshape(1, -1)
        scaled_features = pattern_analysis['scaler'].transform(feature_vector)
        cluster = pattern_analysis['model'].predict(scaled_features)[0]
        
        # クラスタIDからパターン名を取得
        for pattern_name, pattern_info in pattern_analysis['patterns'].items():
            if pattern_info['cluster_id'] == cluster:
                return pattern_name
        
        return f'パターン{cluster + 1}'
    
    def find_similar_trajectories(self, player_id: int, df: pd.DataFrame, 
                                features: Dict[str, float], top_n: int = 5) -> List[Dict[str, Any]]:
        """類似軌跡選手検索"""
        similar_players = []
        
        # 他選手との特徴量比較
        for other_player_id in df['player_id'].unique():
            if other_player_id == player_id:
                continue
                
            other_data = df[df['player_id'] == other_player_id]
            if len(other_data) < 3:
                continue
                
            other_features = self.calculate_trajectory_features(other_data)
            
            # 類似度計算（コサイン類似度）
            similarity = self.calculate_similarity(features, other_features)
            
            if similarity > 0.7:  # 高い類似度
                player_name = other_data.iloc[0]['full_name']
                similar_players.append({
                    'player_id': int(other_player_id),
                    'player_name': player_name,
                    'similarity': round(similarity, 3),
                    'career_length': len(other_data),
                    'peak_ops': other_data['ops'].max()
                })
        
        # 類似度でソート
        similar_players.sort(key=lambda x: x['similarity'], reverse=True)
        return similar_players[:top_n]
    
    def calculate_similarity(self, features1: Dict[str, float], 
                           features2: Dict[str, float]) -> float:
        """特徴量類似度計算"""
        try:
            # 共通の特徴量のみを使用
            common_features = set(features1.keys()) & set(features2.keys())
            
            if not common_features:
                return 0.0
            
            vec1 = np.array([features1[f] for f in common_features])
            vec2 = np.array([features2[f] for f in common_features])
            
            # コサイン類似度
            dot_product = np.dot(vec1, vec2)
            norm1 = np.linalg.norm(vec1)
            norm2 = np.linalg.norm(vec2)
            
            if norm1 == 0 or norm2 == 0:
                return 0.0
            
            similarity = dot_product / (norm1 * norm2)
            return max(0, min(1, similarity))
            
        except:
            return 0.0
    
    def predict_remaining_career(self, current_age: int, career_phase: str, 
                               features: Dict[str, float]) -> int:
        """残りキャリア年数予測"""
        base_retirement_age = 38  # 平均引退年齢
        
        # フェーズ別調整
        phase_adjustments = {
            'rookie': 0,
            'developing': -1,
            'prime': -2,
            'veteran': -4,
            'decline': -6
        }
        
        adjusted_retirement = base_retirement_age + phase_adjustments.get(career_phase, 0)
        
        # パフォーマンストレンド調整
        if features.get('ops_trend', 0) > 0.02:  # 上昇トレンド
            adjusted_retirement += 2
        elif features.get('ops_trend', 0) < -0.02:  # 下降トレンド
            adjusted_retirement -= 2
        
        remaining_years = max(0, adjusted_retirement - current_age)
        return remaining_years
    
    def calculate_breakout_probability(self, player_data: pd.DataFrame, 
                                     career_phase: str) -> float:
        """ブレイクアウト確率計算"""
        if career_phase in ['decline']:
            return 0.0
        
        # 最近のトレンド
        recent_seasons = player_data.tail(3)
        if len(recent_seasons) >= 2:
            recent_improvement = recent_seasons['ops'].iloc[-1] > recent_seasons['ops'].iloc[0]
        else:
            recent_improvement = False
        
        # ベース確率
        base_probabilities = {
            'rookie': 0.15,
            'developing': 0.12,
            'prime': 0.08,
            'veteran': 0.04,
            'decline': 0.01
        }
        
        base_prob = base_probabilities.get(career_phase, 0.05)
        
        # 調整要因
        if recent_improvement:
            base_prob *= 1.5
        
        # 年齢調整
        current_age = player_data.iloc[-1]['season_age']
        if current_age <= 26:
            base_prob *= 1.3
        elif current_age >= 32:
            base_prob *= 0.7
        
        return min(1.0, base_prob)
    
    def calculate_trajectory_score(self, features: Dict[str, float], 
                                 career_phase: str) -> float:
        """軌跡スコア計算"""
        score = 50.0  # ベーススコア
        
        # 長寿命ボーナス
        career_length = features.get('career_length', 3)
        if career_length >= 10:
            score += 15
        elif career_length >= 7:
            score += 10
        
        # トレンドボーナス
        trend = features.get('ops_trend', 0)
        if trend > 0.01:
            score += 20
        elif trend > 0:
            score += 10
        elif trend < -0.02:
            score -= 15
        
        # 安定性ボーナス
        volatility = features.get('ops_volatility', 0.1)
        if volatility < 0.05:
            score += 15
        elif volatility > 0.15:
            score -= 10
        
        # ピーク持続性
        sustainability = features.get('peak_sustainability', 0)
        score += sustainability * 20
        
        return max(0, min(100, score))
    
    def analyze_milestones(self, player_id: int) -> List[CareerMilestone]:
        """マイルストーン分析"""
        df = self.load_career_data()
        player_data = df[df['player_id'] == player_id].sort_values('season')
        
        if player_data.empty:
            return []
        
        milestones = []
        is_pitcher = player_data['innings_pitched'].sum() > player_data['at_bats'].sum()
        milestone_set = self.milestones['pitching'] if is_pitcher else self.milestones['batting']
        
        for milestone_name, criteria in milestone_set.items():
            stat_name = criteria['stat']
            threshold = criteria['threshold']
            direction = criteria.get('direction', 'above')
            
            # 達成チェック
            achieved_season = None
            achievement_date = None
            performance_at_milestone = {}
            age_at_achievement = None
            
            for _, season_data in player_data.iterrows():
                stat_value = season_data.get(stat_name, 0)
                
                if stat_value is not None and stat_value != 0:
                    if direction == 'above' and stat_value >= threshold:
                        achieved_season = season_data['season']
                        age_at_achievement = season_data['season_age']
                        performance_at_milestone = {
                            'season': int(achieved_season),
                            stat_name: float(stat_value)
                        }
                        break
                    elif direction == 'below' and stat_value <= threshold:
                        achieved_season = season_data['season']
                        age_at_achievement = season_data['season_age']
                        performance_at_milestone = {
                            'season': int(achieved_season),
                            stat_name: float(stat_value)
                        }
                        break
            
            milestones.append(CareerMilestone(
                milestone_name=milestone_name,
                achieved_season=int(achieved_season) if achieved_season else None,
                achievement_date=achievement_date,
                performance_at_milestone=performance_at_milestone,
                age_at_achievement=int(age_at_achievement) if age_at_achievement else None
            ))
        
        return milestones
    
    def create_trajectory_report(self, trajectory: CareerTrajectory, 
                               milestones: List[CareerMilestone]) -> str:
        """軌跡分析レポート作成"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"career_trajectory_{trajectory.player_name}_{timestamp}.json"
        
        report_data = {
            'player_info': {
                'player_id': trajectory.player_id,
                'player_name': trajectory.player_name,
                'league': trajectory.league
            },
            'career_analysis': {
                'current_phase': trajectory.career_phase,
                'career_pattern': trajectory.career_pattern,
                'trajectory_score': trajectory.trajectory_score,
                'peak_season': trajectory.peak_season,
                'peak_performance': trajectory.peak_performance,
                'projected_remaining_years': trajectory.projected_remaining_years,
                'breakout_probability': trajectory.breakout_probability
            },
            'similar_players': trajectory.similar_players,
            'milestones': [],
            'analysis_date': datetime.now().isoformat()
        }
        
        # マイルストーン追加
        for milestone in milestones:
            report_data['milestones'].append({
                'name': milestone.milestone_name,
                'achieved': milestone.achieved_season is not None,
                'season': milestone.achieved_season,
                'age': milestone.age_at_achievement,
                'performance': milestone.performance_at_milestone
            })
        
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(report_data, f, indent=2, ensure_ascii=False)
        
        logger.info(f"軌跡分析レポート保存: {filename}")
        return filename
    
    def visualize_career_trajectory(self, player_id: int) -> str:
        """キャリア軌跡可視化"""
        df = self.load_career_data()
        player_data = df[df['player_id'] == player_id].sort_values('season')
        
        if player_data.empty:
            return ""
        
        fig, axes = plt.subplots(2, 2, figsize=(15, 12))
        player_name = player_data.iloc[0]['full_name']
        fig.suptitle(f'{player_name} Career Trajectory Analysis\n{player_name} キャリア軌跡分析', 
                     fontsize=16, fontweight='bold')
        
        # 1. OPS推移
        axes[0,0].plot(player_data['season'], player_data['ops'], 'o-', linewidth=2, markersize=6)
        axes[0,0].set_title('OPS推移')
        axes[0,0].set_xlabel('年度')
        axes[0,0].set_ylabel('OPS')
        axes[0,0].grid(True, alpha=0.3)
        
        # トレンドライン追加
        if len(player_data) > 2:
            z = np.polyfit(range(len(player_data)), player_data['ops'], 1)
            p = np.poly1d(z)
            axes[0,0].plot(player_data['season'], p(range(len(player_data))), 
                          "--", alpha=0.7, color='red', label='トレンド')
            axes[0,0].legend()
        
        # 2. 年齢-成績関係
        axes[0,1].scatter(player_data['season_age'], player_data['ops'], 
                         c=player_data['career_year'], cmap='viridis', s=80)
        axes[0,1].set_title('年齢と成績の関係')
        axes[0,1].set_xlabel('年齢')
        axes[0,1].set_ylabel('OPS')
        
        # 3. キャリア段階別パフォーマンス
        player_data['phase'] = player_data.apply(
            lambda x: self.identify_career_phase(x['career_year'], x['season_age']), axis=1
        )
        
        phase_performance = player_data.groupby('phase')['ops'].mean()
        if not phase_performance.empty:
            phases = list(phase_performance.index)
            values = list(phase_performance.values)
            colors = ['lightblue', 'lightgreen', 'gold', 'orange', 'lightcoral']
            
            axes[1,0].bar(phases, values, color=colors[:len(phases)])
            axes[1,0].set_title('キャリア段階別平均OPS')
            axes[1,0].set_ylabel('平均OPS')
            plt.setp(axes[1,0].xaxis.get_majorticklabels(), rotation=45)
        
        # 4. 年次成績レーダーチャート（最近3年）
        recent_seasons = player_data.tail(3)
        if len(recent_seasons) > 0:
            # 正規化された成績指標
            metrics = ['batting_avg', 'home_runs', 'rbis', 'ops']
            
            # 最新シーズンの成績を可視化
            latest_season = recent_seasons.iloc[-1]
            values = []
            labels = ['打率', '本塁打', '打点', 'OPS']
            
            # 正規化（リーグ平均を50として）
            league_averages = {'batting_avg': 0.250, 'home_runs': 15, 'rbis': 60, 'ops': 0.720}
            
            for metric in metrics:
                value = latest_season.get(metric, 0)
                avg = league_averages.get(metric, 1)
                normalized = (value / avg) * 50 if avg > 0 else 0
                values.append(min(100, normalized))
            
            angles = np.linspace(0, 2*np.pi, len(metrics), endpoint=False)
            values += values[:1]  # 閉じた図形
            angles = np.concatenate((angles, [angles[0]]))
            
            ax_radar = plt.subplot(2, 2, 4, projection='polar')
            ax_radar.plot(angles, values, 'o-', linewidth=2, label=f'{latest_season["season"]}年')
            ax_radar.fill(angles, values, alpha=0.1)
            ax_radar.set_xticks(angles[:-1])
            ax_radar.set_xticklabels(labels)
            ax_radar.set_ylim(0, 100)
            ax_radar.set_title('最新シーズン成績', y=1.08)
        
        plt.tight_layout()
        
        filename = f'career_trajectory_{player_name}_{datetime.now().strftime("%Y%m%d_%H%M%S")}.png'
        plt.savefig(filename, dpi=300, bbox_inches='tight')
        plt.close()
        
        logger.info(f"キャリア軌跡可視化保存: {filename}")
        return filename

def main():
    """メイン実行"""
    analyzer = CareerTrajectoryAnalyzer()
    
    print("="*80)
    print("CAREER TRAJECTORY ANALYZER SYSTEM")
    print("選手キャリア軌跡分析システム")
    print("="*80)
    
    print("\n1: 特定選手のキャリア分析")
    print("2: リーグ全体のキャリアパターン分析")
    print("3: マイルストーン達成状況分析")
    print("4: 類似キャリア選手検索")
    
    choice = input("選択してください (1-4): ").strip()
    
    if choice == '1':
        player_id = int(input("選手ID: "))
        
        trajectory = analyzer.analyze_player_trajectory(player_id)
        if trajectory:
            print(f"\n=== {trajectory.player_name} ({trajectory.league}) キャリア分析 ===")
            print(f"キャリア段階: {trajectory.career_phase}")
            print(f"キャリアパターン: {trajectory.career_pattern}")
            print(f"軌跡スコア: {trajectory.trajectory_score}/100")
            print(f"ピーク年: {trajectory.peak_season}")
            print(f"予測残り年数: {trajectory.projected_remaining_years}年")
            print(f"ブレイクアウト確率: {trajectory.breakout_probability:.1%}")
            
            print("\n類似選手:")
            for similar in trajectory.similar_players:
                print(f"  {similar['player_name']} (類似度: {similar['similarity']})")
            
            # マイルストーン分析
            milestones = analyzer.analyze_milestones(player_id)
            achieved_milestones = [m for m in milestones if m.achieved_season]
            
            print(f"\n達成マイルストーン: {len(achieved_milestones)}件")
            for milestone in achieved_milestones[:5]:
                print(f"  {milestone.milestone_name} ({milestone.achieved_season}年, {milestone.age_at_achievement}歳)")
            
            # レポート・可視化作成
            report_file = analyzer.create_trajectory_report(trajectory, milestones)
            viz_file = analyzer.visualize_career_trajectory(player_id)
            
            print(f"\n詳細レポート: {report_file}")
            print(f"可視化ファイル: {viz_file}")
    
    elif choice == '2':
        print("\nキャリアパターン分析実行中...")
        df = analyzer.load_career_data()
        pattern_analysis = analyzer.cluster_career_patterns(df)
        
        print(f"\n=== キャリアパターン分析結果 ===")
        for pattern_name, pattern_info in pattern_analysis['patterns'].items():
            print(f"\n{pattern_name}: {pattern_info['player_count']}名")
            for char_type, char_desc in pattern_info['characteristics'].items():
                print(f"  {char_type}: {char_desc}")

if __name__ == "__main__":
    main()