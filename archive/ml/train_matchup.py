#!/usr/bin/env python3
"""
対決予測 LightGBM 学習 + ONNX変換
Binary分類: 到達(BB,HBP,1B,2B,3B,HR,ROE)=1 / アウト=0

Optuna最適化 + Platt/Temperature キャリブレーション + ONNX変換
"""

import os, json, argparse, time, math
import numpy as np
import pandas as pd
import lightgbm as lgb
from sklearn.metrics import log_loss, brier_score_loss, accuracy_score, roc_auc_score
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from skl2onnx import convert_sklearn
from skl2onnx.common.data_types import FloatTensorType
import optuna
from pathlib import Path
import warnings
warnings.filterwarnings('ignore')

# ONNX変換用
try:
    import onnxmltools
    from onnxmltools.convert import convert_lightgbm
    from onnxmltools.utils import save_model as save_onnx_model
    ONNX_AVAILABLE = True
except ImportError:
    print("WARNING: onnxmltools not found. Will use skl2onnx instead.")
    ONNX_AVAILABLE = False

def load_latest_dataset(data_dir="data"):
    """最新のtrainデータセットを読み込み"""
    matchup_dir = Path(data_dir) / "ml" / "matchup"
    
    if not matchup_dir.exists():
        raise FileNotFoundError(f"Matchup directory not found: {matchup_dir}")
    
    # 最新のCSVファイルを検索
    csv_files = list(matchup_dir.glob("train_*.csv"))
    if not csv_files:
        raise FileNotFoundError(f"No training CSV files found in {matchup_dir}")
    
    latest_file = sorted(csv_files)[-1]
    print(f"Loading dataset: {latest_file}")
    
    df = pd.read_csv(latest_file)
    print(f"   Rows: {len(df):,}, Columns: {len(df.columns)}")
    
    return df, latest_file.name

def prepare_features(df):
    """特徴量準備"""
    features = [
        'b_hand', 'p_hand', 'b_split7', 'b_split30', 'p_split7', 'p_split30',
        'fi', 'rap14', 'inning', 'top', 'outs', 'bases', 'scoreDiff', 
        'park_mult', 'leverage'
    ]
    
    # 存在しない特徴量をスキップ
    available_features = [f for f in features if f in df.columns]
    missing_features = [f for f in features if f not in df.columns]
    
    if missing_features:
        print(f"WARNING: Missing features: {missing_features}")
    
    print(f"Using features ({len(available_features)}): {available_features}")
    
    X = df[available_features].astype('float32')
    y = df['y'].astype('int8')
    
    # データ品質チェック
    print(f"   Target distribution: {y.value_counts().to_dict()}")
    print(f"   Reach rate: {y.mean():.3f}")
    
    return X, y, available_features

def objective(trial, X, y):
    """Optuna最適化のObjective"""
    # Time Series Split (80% train, 20% val)
    split_idx = int(len(X) * 0.8)
    X_train, X_val = X.iloc[:split_idx], X.iloc[split_idx:]
    y_train, y_val = y.iloc[:split_idx], y.iloc[split_idx:]
    
    # ハイパーパラメータサジェスト
    params = {
        'objective': 'binary',
        'metric': 'binary_logloss',
        'boosting_type': 'gbdt',
        'num_leaves': trial.suggest_int('num_leaves', 31, 300),
        'learning_rate': trial.suggest_float('learning_rate', 0.01, 0.3),
        'feature_fraction': trial.suggest_float('feature_fraction', 0.4, 1.0),
        'bagging_fraction': trial.suggest_float('bagging_fraction', 0.4, 1.0),
        'bagging_freq': trial.suggest_int('bagging_freq', 1, 7),
        'min_child_samples': trial.suggest_int('min_child_samples', 5, 100),
        'lambda_l1': trial.suggest_float('lambda_l1', 0, 10),
        'lambda_l2': trial.suggest_float('lambda_l2', 0, 10),
        'verbose': -1,
        'seed': 42
    }
    
    # 訓練
    train_data = lgb.Dataset(X_train, label=y_train)
    val_data = lgb.Dataset(X_val, label=y_val, reference=train_data)
    
    model = lgb.train(
        params,
        train_data,
        num_boost_round=1000,
        valid_sets=[val_data],
        callbacks=[lgb.early_stopping(100), lgb.log_evaluation(0)]
    )
    
    # 予測
    y_pred = model.predict(X_val, num_iteration=model.best_iteration)
    
    # LogLoss最小化
    return log_loss(y_val, y_pred)

def train_optimized_model(X, y, features, n_trials=40):
    """Optuna最適化でモデル訓練"""
    print(f"Hyperparameter optimization ({n_trials} trials)...")
    
    study = optuna.create_study(direction='minimize')
    study.optimize(lambda trial: objective(trial, X, y), n_trials=n_trials)
    
    best_params = study.best_params
    print(f"   Best LogLoss: {study.best_value:.4f}")
    print(f"   Best params: {best_params}")
    
    # ベストパラメータでフル訓練
    print("Training final model with best parameters...")
    
    split_idx = int(len(X) * 0.8)
    X_train, X_test = X.iloc[:split_idx], X.iloc[split_idx:]
    y_train, y_test = y.iloc[:split_idx], y.iloc[split_idx:]
    
    params = {
        'objective': 'binary',
        'metric': 'binary_logloss',
        'boosting_type': 'gbdt',
        'verbose': -1,
        'seed': 42,
        **best_params
    }
    
    train_data = lgb.Dataset(X_train, label=y_train)
    test_data = lgb.Dataset(X_test, label=y_test, reference=train_data)
    
    model = lgb.train(
        params,
        train_data,
        num_boost_round=1000,
        valid_sets=[train_data, test_data],
        valid_names=['train', 'test'],
        callbacks=[lgb.early_stopping(100), lgb.log_evaluation(0)]
    )
    
    return model, X_train, X_test, y_train, y_test

def calibrate_model(y_true, y_prob):
    """確率キャリブレーション"""
    print("Probability calibration...")
    
    # Platt Scaling
    platt_model = LogisticRegression()
    platt_model.fit(y_prob.reshape(-1, 1), y_true)
    y_platt = platt_model.predict_proba(y_prob.reshape(-1, 1))[:, 1]
    
    # Temperature Scaling
    def temperature_scale(logits, temperature):
        return 1 / (1 + np.exp(-logits / temperature))
    
    # 最適温度パラメータを探索
    best_temp = 1.0
    best_loss = log_loss(y_true, y_prob)
    
    for temp in np.arange(0.1, 3.0, 0.1):
        logits = np.log(y_prob / (1 - np.clip(y_prob, 1e-7, 1-1e-7)))
        y_temp = temperature_scale(logits, temp)
        loss = log_loss(y_true, y_temp)
        if loss < best_loss:
            best_loss = loss
            best_temp = temp
    
    logits = np.log(y_prob / (1 - np.clip(y_prob, 1e-7, 1-1e-7)))
    y_temp = temperature_scale(logits, best_temp)
    
    # キャリブレーション結果比較
    original_loss = log_loss(y_true, y_prob)
    platt_loss = log_loss(y_true, y_platt)
    temp_loss = log_loss(y_true, y_temp)
    
    print(f"   Original: {original_loss:.4f}")
    print(f"   Platt: {platt_loss:.4f}")
    print(f"   Temperature (T={best_temp:.1f}): {temp_loss:.4f}")
    
    # ベストを選択
    if platt_loss <= temp_loss and platt_loss < original_loss:
        print("   Using Platt scaling")
        return platt_model, 'platt', platt_loss
    elif temp_loss < original_loss:
        print(f"   Using Temperature scaling (T={best_temp:.1f})")
        return best_temp, 'temperature', temp_loss
    else:
        print("   Using original probabilities")
        return None, 'none', original_loss

def evaluate_model(model, X_test, y_test, calibration_model=None, calibration_type='none'):
    """モデル評価"""
    print("Model evaluation...")
    
    # 予測
    y_pred_proba = model.predict(X_test, num_iteration=model.best_iteration)
    
    # キャリブレーション適用
    if calibration_type == 'platt':
        y_pred_proba = calibration_model.predict_proba(y_pred_proba.reshape(-1, 1))[:, 1]
    elif calibration_type == 'temperature':
        logits = np.log(y_pred_proba / (1 - np.clip(y_pred_proba, 1e-7, 1-1e-7)))
        y_pred_proba = 1 / (1 + np.exp(-logits / calibration_model))
    
    y_pred = (y_pred_proba > 0.5).astype(int)
    
    # メトリクス計算
    logloss = log_loss(y_test, y_pred_proba)
    brier = brier_score_loss(y_test, y_pred_proba)
    accuracy = accuracy_score(y_test, y_pred)
    auc = roc_auc_score(y_test, y_pred_proba)
    
    report = {
        'logloss': float(logloss),
        'brier': float(brier),
        'accuracy': float(accuracy),
        'auc': float(auc),
        'n_test': int(len(y_test)),
        'reach_rate_test': float(y_test.mean()),
        'best_iteration': int(model.best_iteration),
        'calibration': calibration_type
    }
    
    print(f"   LogLoss: {logloss:.4f}")
    print(f"   Brier Score: {brier:.4f}")
    print(f"   Accuracy: {accuracy:.4f}")
    print(f"   AUC: {auc:.4f}")
    
    return report

def save_calibration_info(calibration_model, calibration_type, models_dir):
    """キャリブレーション情報保存"""
    calib_info = {
        'type': calibration_type
    }
    
    if calibration_type == 'platt':
        calib_info['coef'] = float(calibration_model.coef_[0])
        calib_info['intercept'] = float(calibration_model.intercept_[0])
    elif calibration_type == 'temperature':
        calib_info['temperature'] = float(calibration_model)
    
    calib_path = os.path.join(models_dir, "calibration.json")
    with open(calib_path, "w") as f:
        json.dump(calib_info, f, indent=2)
    
    print(f"Calibration info saved: {calib_path}")
    return calib_path

def convert_to_onnx(model, features, models_dir="models/matchup"):
    """ONNXへの変換"""
    try:
        print("Converting to ONNX...")
        
        if ONNX_AVAILABLE:
            # onnxmltoolsを使用
            from onnxmltools.common.data_types import FloatTensorType
            initial_type = [('input', FloatTensorType([None, len(features)]))]
            onnx_model = onnxmltools.convert_lightgbm(
                model,
                initial_types=initial_type,
                target_opset=17
            )
            onnx_path = os.path.join(models_dir, "model.onnx")
            save_onnx_model(onnx_model, onnx_path)
        else:
            # LightGBMを直接ONNXに変換（代替方法）
            # 実際の実装では別のアプローチが必要
            print("WARNING: Using alternative ONNX conversion...")
            onnx_path = os.path.join(models_dir, "model.onnx")
            # Placeholder - 実際にはlgb.Boosterの.save_model()でテキスト形式保存
            model.save_model(os.path.join(models_dir, "model_lgb.txt"))
            return None
        
        print(f"ONNX model saved: {onnx_path}")
        return onnx_path
        
    except Exception as e:
        print(f"ERROR: ONNX conversion failed: {e}")
        return None

def save_model_artifacts(model, features, report, calibration_info, models_dir="models/matchup"):
    """モデル成果物の保存"""
    os.makedirs(models_dir, exist_ok=True)
    
    # レポート保存
    report_path = os.path.join(models_dir, "report.json")
    with open(report_path, "w") as f:
        json.dump(report, f, indent=2)
    
    # 特徴量リスト保存
    features_path = os.path.join(models_dir, "features.json")
    with open(features_path, "w") as f:
        json.dump(features, f, indent=2)
    
    # LightGBMモデル保存
    lgb_path = os.path.join(models_dir, "model.lgb")
    model.save_model(lgb_path)
    
    # 特徴量重要度保存
    importance = dict(zip(features, model.feature_importance().tolist()))
    importance_path = os.path.join(models_dir, "feature_importance.json")
    with open(importance_path, "w") as f:
        json.dump(importance, f, indent=2)
    
    print(f"Model artifacts saved to {models_dir}")
    return report_path, features_path, lgb_path

def check_quality_gate(report, min_logloss=0.69, max_brier=0.22):
    """品質ゲート"""
    print("Quality gate check...")
    
    logloss_pass = report['logloss'] < min_logloss
    brier_pass = report['brier'] < max_brier
    
    print(f"   LogLoss: {report['logloss']:.4f} < {min_logloss} : {'PASS' if logloss_pass else 'FAIL'}")
    print(f"   Brier: {report['brier']:.4f} < {max_brier} : {'PASS' if brier_pass else 'FAIL'}")
    
    if logloss_pass and brier_pass:
        print("Quality gate PASSED")
        return True
    else:
        print("Quality gate FAILED")
        return False

def main():
    # Set UTF-8 encoding for Windows console
    import sys
    if sys.platform == 'win32':
        import codecs
        sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
        sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'strict')
    
    parser = argparse.ArgumentParser()
    parser.add_argument('--trials', type=int, default=40, help='Optuna trials')
    parser.add_argument('--no-optimize', action='store_true', help='Skip optimization')
    args = parser.parse_args()
    
    try:
        print("NPB Matchup Prediction Training")
        print("=" * 50)
        
        # データ読み込み
        df, dataset_name = load_latest_dataset("../data")
        
        # 特徴量準備
        X, y, features = prepare_features(df)
        
        if len(X) < 1000:
            print(f"WARNING: Small dataset ({len(X)} rows)")
        
        if args.no_optimize:
            # シンプル訓練（デバッグ用）
            print("Quick training (no optimization)...")
            split_idx = int(len(X) * 0.8)
            X_train, X_test = X.iloc[:split_idx], X.iloc[split_idx:]
            y_train, y_test = y.iloc[:split_idx], y.iloc[split_idx:]
            
            params = {
                'objective': 'binary',
                'metric': 'binary_logloss',
                'boosting_type': 'gbdt',
                'num_leaves': 63,
                'learning_rate': 0.05,
                'verbose': -1,
                'seed': 42
            }
            
            train_data = lgb.Dataset(X_train, label=y_train)
            test_data = lgb.Dataset(X_test, label=y_test, reference=train_data)
            
            model = lgb.train(
                params, train_data, num_boost_round=300,
                valid_sets=[test_data], callbacks=[lgb.early_stopping(50)]
            )
            
            calibration_model, calibration_type = None, 'none'
        else:
            # Optuna最適化
            model, X_train, X_test, y_train, y_test = train_optimized_model(X, y, features, args.trials)
            
            # キャリブレーション
            y_val_prob = model.predict(X_test, num_iteration=model.best_iteration)
            calibration_model, calibration_type, calib_loss = calibrate_model(y_test, y_val_prob)
        
        # 評価
        report = evaluate_model(model, X_test, y_test, calibration_model, calibration_type)
        
        # 成果物保存
        models_dir = "models/matchup"
        report_path, features_path, lgb_path = save_model_artifacts(
            model, features, report, 
            {'type': calibration_type}, models_dir
        )
        
        # キャリブレーション情報保存
        if calibration_model is not None:
            calib_path = save_calibration_info(calibration_model, calibration_type, models_dir)
        
        # ONNX変換
        onnx_path = convert_to_onnx(model, features, models_dir)
        
        # 品質ゲート
        quality_passed = check_quality_gate(report)
        
        # サマリー
        print("\nTraining Summary")
        print("=" * 40)
        print(f"Dataset: {dataset_name}")
        print(f"Features: {len(features)}")
        print(f"Training samples: {len(X_train):,}")
        print(f"Test samples: {len(X_test):,}")
        print(f"Calibration: {calibration_type}")
        print(f"Quality gate: {'PASS' if quality_passed else 'FAIL'}")
        print(f"ONNX model: {'Available' if onnx_path else 'Not available'}")
        
        if not quality_passed:
            print("\nWARNING: Model quality below threshold. Consider:")
            print("   - More training data")
            print("   - Feature engineering") 
            print("   - Hyperparameter tuning")
            return 1
        
        print("\nC1-1b: Matchup prediction training completed!")
        print("Next step: C1-1c Live integration")
        return 0
        
    except Exception as e:
        print(f"ERROR: Training failed: {e}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    exit(main())