#!/usr/bin/env python3
"""
NPB Baseball AI - Pregame Win Probability Training Pipeline

機能:
- LightGBM で勝率予測モデル訓練
- クロスバリデーション + ハイパーパラメータ調整
- ONNX 形式でのモデル出力
- 特徴量重要度分析
- モデル評価指標算出
"""

import pandas as pd
import numpy as np
import lightgbm as lgb
import json
import os
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Tuple, Optional
import warnings

# ML libraries
from sklearn.model_selection import train_test_split, StratifiedKFold, cross_val_score
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.metrics import (
    accuracy_score, precision_recall_curve, roc_auc_score, 
    log_loss, brier_score_loss, classification_report
)
import optuna
from optuna.integration import LightGBMPruningCallback

# ONNX export
import onnxmltools
from onnxmltools.convert import convert_lightgbm
from onnxmltools.utils import float_onnx_type

warnings.filterwarnings('ignore')

class PregameModelTrainer:
    """プリゲーム勝率予測モデルの訓練クラス"""
    
    def __init__(self, 
                 features_path: str = "./features",
                 models_path: str = "./models",
                 random_seed: int = 42):
        self.features_path = Path(features_path)
        self.models_path = Path(models_path)
        self.random_seed = random_seed
        self.models_path.mkdir(exist_ok=True)
        
        # モデル設定
        self.target_column = 'home_win'
        self.categorical_features = [
            'home_team', 'away_team', 'venue', 'month', 'day_of_week'
        ]
        self.exclude_features = [
            'game_id', 'date', 'start_time', 'home_win'  # ラベル・ID系は除外
        ]
        
        # 評価指標のしきい値
        self.min_auc_score = 0.55  # 最低限の予測精度
        self.max_log_loss = 0.69   # ランダム予測のlog_loss
        
    def load_dataset(self, filename: Optional[str] = None) -> pd.DataFrame:
        """データセットの読み込み"""
        if filename is None:
            # 最新のファイルを取得
            csv_files = list(self.features_path.glob("pregame_features_*.csv"))
            if not csv_files:
                raise FileNotFoundError(f"No feature files found in {self.features_path}")
            filename = max(csv_files, key=os.path.getctime)
        else:
            filename = self.features_path / filename
            
        print(f"📊 Loading dataset: {filename}")
        df = pd.read_csv(filename)
        
        # 基本統計
        print(f"   Shape: {df.shape}")
        print(f"   Date range: {df['date'].min()} to {df['date'].max()}")
        print(f"   Home win rate: {df[self.target_column].mean():.3f}")
        print(f"   Missing values: {df.isnull().sum().sum()}")
        
        return df
    
    def preprocess_data(self, df: pd.DataFrame) -> Tuple[pd.DataFrame, Dict]:
        """データ前処理"""
        print("🔧 Preprocessing data...")
        
        preprocessing_info = {
            'categorical_encoders': {},
            'feature_columns': [],
            'excluded_features': self.exclude_features.copy(),
            'preprocessing_date': datetime.now().isoformat()
        }
        
        # 欠損値の処理
        df = df.fillna({
            'home_pitcher_era': 4.0,
            'away_pitcher_era': 4.0, 
            'home_pitcher_whip': 1.3,
            'away_pitcher_whip': 1.3,
            'venue_home_advantage': 0.0,
            'venue_scoring_factor': 1.0,
            'head_to_head_total_games': 0
        })
        
        # カテゴリカル特徴量のエンコーディング
        for col in self.categorical_features:
            if col in df.columns:
                le = LabelEncoder()
                df[col + '_encoded'] = le.fit_transform(df[col].astype(str))
                preprocessing_info['categorical_encoders'][col] = {
                    'classes': le.classes_.tolist()
                }
                # 元のカテゴリカル列は除外リストに追加
                preprocessing_info['excluded_features'].append(col)
        
        # 特徴量列の決定
        feature_columns = [col for col in df.columns 
                          if col not in preprocessing_info['excluded_features']]
        preprocessing_info['feature_columns'] = feature_columns
        
        print(f"   Feature columns: {len(feature_columns)}")
        print(f"   Categorical features encoded: {len(self.categorical_features)}")
        
        return df, preprocessing_info
    
    def create_time_split(self, df: pd.DataFrame, test_ratio: float = 0.2) -> Tuple[pd.DataFrame, pd.DataFrame]:
        """時系列を考慮した学習・テスト分割"""
        df_sorted = df.sort_values('date')
        split_date = df_sorted['date'].quantile(1 - test_ratio)
        
        train_df = df_sorted[df_sorted['date'] < split_date]
        test_df = df_sorted[df_sorted['date'] >= split_date]
        
        print(f"📅 Time-based split:")
        print(f"   Train: {train_df.shape[0]} games ({train_df['date'].min()} to {train_df['date'].max()})")
        print(f"   Test:  {test_df.shape[0]} games ({test_df['date'].min()} to {test_df['date'].max()})")
        print(f"   Train home win rate: {train_df[self.target_column].mean():.3f}")
        print(f"   Test home win rate:  {test_df[self.target_column].mean():.3f}")
        
        return train_df, test_df
    
    def optimize_hyperparameters(self, 
                                X_train: pd.DataFrame, 
                                y_train: pd.Series,
                                n_trials: int = 100,
                                cv_folds: int = 5) -> Dict:
        """Optuna によるハイパーパラメータ最適化"""
        print(f"🎯 Hyperparameter optimization ({n_trials} trials)...")
        
        def objective(trial):
            params = {
                'objective': 'binary',
                'metric': 'binary_logloss',
                'boosting_type': 'gbdt',
                'num_leaves': trial.suggest_int('num_leaves', 20, 100),
                'learning_rate': trial.suggest_float('learning_rate', 0.01, 0.3),
                'feature_fraction': trial.suggest_float('feature_fraction', 0.4, 1.0),
                'bagging_fraction': trial.suggest_float('bagging_fraction', 0.4, 1.0),
                'bagging_freq': trial.suggest_int('bagging_freq', 1, 7),
                'min_child_samples': trial.suggest_int('min_child_samples', 5, 100),
                'lambda_l1': trial.suggest_float('lambda_l1', 1e-8, 10.0, log=True),
                'lambda_l2': trial.suggest_float('lambda_l2', 1e-8, 10.0, log=True),
                'verbosity': -1,
                'random_seed': self.random_seed
            }
            
            # Cross Validation
            skf = StratifiedKFold(n_splits=cv_folds, shuffle=True, random_state=self.random_seed)
            scores = []
            
            for train_idx, val_idx in skf.split(X_train, y_train):
                X_tr, X_val = X_train.iloc[train_idx], X_train.iloc[val_idx]
                y_tr, y_val = y_train.iloc[train_idx], y_train.iloc[val_idx]
                
                train_data = lgb.Dataset(X_tr, label=y_tr)
                val_data = lgb.Dataset(X_val, label=y_val, reference=train_data)
                
                model = lgb.train(
                    params,
                    train_data,
                    valid_sets=[val_data],
                    num_boost_round=1000,
                    callbacks=[
                        lgb.early_stopping(50),
                        lgb.log_evaluation(0),
                        LightGBMPruningCallback(trial, 'valid_0-binary_logloss')
                    ]
                )
                
                y_pred = model.predict(X_val, num_iteration=model.best_iteration)
                score = log_loss(y_val, y_pred)
                scores.append(score)
                
            return np.mean(scores)
        
        study = optuna.create_study(direction='minimize')
        study.optimize(objective, n_trials=n_trials, n_jobs=1)
        
        print(f"   Best log loss: {study.best_value:.4f}")
        print(f"   Best params: {study.best_params}")
        
        return study.best_params
    
    def train_model(self, 
                   X_train: pd.DataFrame, 
                   y_train: pd.Series,
                   X_val: pd.DataFrame,
                   y_val: pd.Series,
                   params: Dict) -> lgb.Booster:
        """モデルの訓練"""
        print("🚀 Training final model...")
        
        # LightGBM データセット作成
        train_data = lgb.Dataset(X_train, label=y_train)
        val_data = lgb.Dataset(X_val, label=y_val, reference=train_data)
        
        # 訓練実行
        model = lgb.train(
            params,
            train_data,
            valid_sets=[train_data, val_data],
            valid_names=['train', 'eval'],
            num_boost_round=2000,
            callbacks=[
                lgb.early_stopping(100),
                lgb.log_evaluation(100)
            ]
        )
        
        print(f"   Best iteration: {model.best_iteration}")
        print(f"   Train log loss: {model.best_score['train']['binary_logloss']:.4f}")
        print(f"   Eval log loss:  {model.best_score['eval']['binary_logloss']:.4f}")
        
        return model
    
    def evaluate_model(self, 
                      model: lgb.Booster, 
                      X_test: pd.DataFrame, 
                      y_test: pd.Series) -> Dict:
        """モデル評価"""
        print("📊 Model evaluation...")
        
        # 予測
        y_pred_proba = model.predict(X_test, num_iteration=model.best_iteration)
        y_pred = (y_pred_proba > 0.5).astype(int)
        
        # 評価指標計算
        metrics = {
            'accuracy': accuracy_score(y_test, y_pred),
            'auc_score': roc_auc_score(y_test, y_pred_proba),
            'log_loss': log_loss(y_test, y_pred_proba),
            'brier_score': brier_score_loss(y_test, y_pred_proba),
            'test_samples': len(y_test),
            'baseline_accuracy': max(y_test.mean(), 1 - y_test.mean())  # majority class
        }
        
        print(f"   Accuracy: {metrics['accuracy']:.3f}")
        print(f"   AUC Score: {metrics['auc_score']:.3f}")
        print(f"   Log Loss: {metrics['log_loss']:.3f}")
        print(f"   Brier Score: {metrics['brier_score']:.3f}")
        print(f"   Baseline (majority): {metrics['baseline_accuracy']:.3f}")
        
        # 閾値チェック
        if metrics['auc_score'] < self.min_auc_score:
            print(f"⚠️  Warning: AUC score {metrics['auc_score']:.3f} below threshold {self.min_auc_score}")
        
        if metrics['log_loss'] > self.max_log_loss:
            print(f"⚠️  Warning: Log loss {metrics['log_loss']:.3f} above threshold {self.max_log_loss}")
            
        return metrics
    
    def analyze_feature_importance(self, model: lgb.Booster, feature_columns: List[str]) -> Dict:
        """特徴量重要度分析"""
        print("🔍 Feature importance analysis...")
        
        importance_gain = model.feature_importance(importance_type='gain')
        importance_split = model.feature_importance(importance_type='split')
        
        feature_importance = []
        for i, feature in enumerate(feature_columns):
            feature_importance.append({
                'feature': feature,
                'importance_gain': float(importance_gain[i]),
                'importance_split': int(importance_split[i])
            })
        
        # 重要度でソート
        feature_importance.sort(key=lambda x: x['importance_gain'], reverse=True)
        
        # Top 10 表示
        print("   Top 10 important features (by gain):")
        for i, feat in enumerate(feature_importance[:10]):
            print(f"   {i+1:2d}. {feat['feature']:30s} {feat['importance_gain']:8.1f}")
            
        return {
            'feature_importance': feature_importance,
            'total_features': len(feature_columns)
        }
    
    def export_to_onnx(self, 
                      model: lgb.Booster, 
                      feature_columns: List[str],
                      model_name: str = "pregame_win_probability") -> str:
        """ONNX形式でのモデル出力"""
        print("📦 Exporting model to ONNX...")
        
        # ONNX変換
        initial_type = [('float_input', float_onnx_type([None, len(feature_columns)]))]
        onnx_model = convert_lightgbm(
            model, 
            initial_types=initial_type,
            target_opset=11
        )
        
        # 保存
        onnx_path = self.models_path / f"{model_name}.onnx"
        onnxmltools.utils.save_model(onnx_model, str(onnx_path))
        
        print(f"   ONNX model saved: {onnx_path}")
        return str(onnx_path)
    
    def save_model_metadata(self,
                           preprocessing_info: Dict,
                           model_params: Dict,
                           metrics: Dict,
                           feature_importance: Dict,
                           model_name: str = "pregame_win_probability") -> str:
        """モデルメタデータの保存"""
        metadata = {
            'model_name': model_name,
            'model_type': 'binary_classification',
            'target_column': self.target_column,
            'created_at': datetime.now().isoformat(),
            'random_seed': self.random_seed,
            'preprocessing': preprocessing_info,
            'model_params': model_params,
            'evaluation_metrics': metrics,
            'feature_importance': feature_importance,
            'input_schema': {
                'input_name': 'float_input',
                'output_name': 'probabilities',
                'feature_count': len(preprocessing_info['feature_columns']),
                'feature_names': preprocessing_info['feature_columns']
            },
            'calibration': {
                'enabled': True,
                'min_probability': 0.05,
                'max_probability': 0.95,
                'description': 'Probabilities are clipped to [0.05, 0.95] range'
            }
        }
        
        metadata_path = self.models_path / f"{model_name}_metadata.json"
        with open(metadata_path, 'w', encoding='utf-8') as f:
            json.dump(metadata, f, indent=2, ensure_ascii=False)
            
        print(f"📄 Model metadata saved: {metadata_path}")
        return str(metadata_path)
    
    def run_full_pipeline(self, 
                         features_file: Optional[str] = None,
                         optimize_params: bool = True,
                         n_trials: int = 50) -> Dict[str, str]:
        """完全な学習パイプラインの実行"""
        print("🚀 Starting full training pipeline...")
        print("=" * 60)
        
        # 1. データ読み込み
        df = self.load_dataset(features_file)
        
        # 2. 前処理
        df_processed, preprocessing_info = self.preprocess_data(df)
        
        # 3. 学習・テスト分割
        train_df, test_df = self.create_time_split(df_processed)
        
        # 特徴量とターゲットの分離
        feature_columns = preprocessing_info['feature_columns']
        X_train, y_train = train_df[feature_columns], train_df[self.target_column]
        X_test, y_test = test_df[feature_columns], test_df[self.target_column]
        
        # 訓練データをさらに分割（validation用）
        X_tr, X_val, y_tr, y_val = train_test_split(
            X_train, y_train, test_size=0.2, random_state=self.random_seed, stratify=y_train
        )
        
        # 4. ハイパーパラメータ最適化
        if optimize_params:
            best_params = self.optimize_hyperparameters(X_train, y_train, n_trials)
        else:
            best_params = {
                'objective': 'binary',
                'metric': 'binary_logloss',
                'boosting_type': 'gbdt',
                'num_leaves': 64,
                'learning_rate': 0.1,
                'feature_fraction': 0.8,
                'bagging_fraction': 0.8,
                'bagging_freq': 5,
                'verbosity': -1,
                'random_seed': self.random_seed
            }
        
        # 5. モデル訓練
        model = self.train_model(X_tr, y_tr, X_val, y_val, best_params)
        
        # 6. モデル評価
        metrics = self.evaluate_model(model, X_test, y_test)
        
        # 7. 特徴量重要度分析
        feature_importance = self.analyze_feature_importance(model, feature_columns)
        
        # 8. ONNX エクスポート
        onnx_path = self.export_to_onnx(model, feature_columns)
        
        # 9. メタデータ保存
        metadata_path = self.save_model_metadata(
            preprocessing_info, best_params, metrics, feature_importance
        )
        
        print("=" * 60)
        print("✅ Training pipeline completed successfully!")
        
        return {
            'onnx_model': onnx_path,
            'metadata': metadata_path,
            'auc_score': metrics['auc_score'],
            'log_loss': metrics['log_loss']
        }

def main():
    """メイン実行関数"""
    import argparse
    
    parser = argparse.ArgumentParser(description="NPB Pregame Win Probability Training")
    parser.add_argument('--features', type=str, help='Features CSV file path')
    parser.add_argument('--no-optimize', action='store_true', help='Skip hyperparameter optimization')
    parser.add_argument('--trials', type=int, default=50, help='Number of optimization trials')
    parser.add_argument('--models-dir', type=str, default='./models', help='Models output directory')
    
    args = parser.parse_args()
    
    trainer = PregameModelTrainer(models_path=args.models_dir)
    
    try:
        results = trainer.run_full_pipeline(
            features_file=args.features,
            optimize_params=not args.no_optimize,
            n_trials=args.trials
        )
        
        print(f"\n🎯 Final Results:")
        print(f"   ONNX Model: {results['onnx_model']}")
        print(f"   Metadata: {results['metadata']}")
        print(f"   AUC Score: {results['auc_score']:.3f}")
        print(f"   Log Loss: {results['log_loss']:.3f}")
        
        if results['auc_score'] >= 0.55:
            print("✅ Model meets minimum performance requirements")
        else:
            print("⚠️ Model performance below minimum requirements")
            
    except Exception as e:
        print(f"❌ Training failed: {e}")
        raise

if __name__ == "__main__":
    main()