#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
コンテンツ監査スクリプト
第三者コンテンツ混入をn-gram/類似度でチェック
"""

import os
import re
import json
import hashlib
from pathlib import Path
from typing import List, Dict, Tuple, Set
from collections import Counter
import difflib
from dataclasses import dataclass

@dataclass
class ContentMatch:
    file_path: str
    line_number: int
    content: str
    similarity: float
    matched_pattern: str
    severity: str  # 'high', 'medium', 'low'

class ContentAuditor:
    """コンテンツ監査システム"""
    
    def __init__(self, project_root: str):
        self.project_root = Path(project_root)
        self.blocked_patterns = self._load_blocked_patterns()
        self.similarity_threshold = 0.8  # 80%以上で警告
        
    def _load_blocked_patterns(self) -> List[str]:
        """ブロック対象パターンの読み込み"""
        # 1point02由来の既知フレーズ・表現パターン
        patterns = [
            # サイト名・URL
            "1point02",
            "1point02.jp",
            "ワンポイントゼロツー",
            
            # 特有の表現・用語
            "球詳",
            "球詳データ",
            "セイバーメトリクス詳細",
            
            # データベース特有の指標名・略称
            "RCAA",
            "WAR(rWAR)",
            "rWAR",
            "wSB",
            "UZR/150",
            
            # 特徴的な文章パターン
            "打者を相手にした際の",
            "投手に対する",
            "レバレッジ指数",
            "状況別成績",
            
            # テーブル・データ特有の表現
            "年度別成績",
            "月別成績", 
            "対戦相手別",
            "イニング別",
            
            # ライセンス・著作権関連
            "1point02.jp All Rights Reserved",
            "株式会社DELTA",
            "DELTA:GRAPH",
            
            # API・データ形式特有
            "player_id",
            "team_id", 
            "game_id",
            # ただし、これらは一般的すぎるので除外候補
        ]
        
        return patterns
    
    def _extract_ngrams(self, text: str, n: int = 3) -> Set[str]:
        """n-gram抽出"""
        # 日本語対応のトークン化（簡易版）
        # 実際にはMeCab等を使うとより精密
        tokens = re.findall(r'[ぁ-んァ-ヶ一-龯a-zA-Z0-9]+', text)
        
        ngrams = set()
        for i in range(len(tokens) - n + 1):
            ngram = ''.join(tokens[i:i+n])
            ngrams.add(ngram)
        
        return ngrams
    
    def _calculate_similarity(self, text1: str, text2: str) -> float:
        """文章類似度計算（Jaccard係数ベース）"""
        ngrams1 = self._extract_ngrams(text1)
        ngrams2 = self._extract_ngrams(text2)
        
        if not ngrams1 and not ngrams2:
            return 0.0
        if not ngrams1 or not ngrams2:
            return 0.0
            
        intersection = len(ngrams1 & ngrams2)
        union = len(ngrams1 | ngrams2)
        
        return intersection / union if union > 0 else 0.0
    
    def _check_direct_patterns(self, content: str) -> List[Tuple[str, str]]:
        """直接的なパターンマッチング"""
        matches = []
        
        for pattern in self.blocked_patterns:
            if pattern.lower() in content.lower():
                matches.append((pattern, "direct_match"))
        
        return matches
    
    def _analyze_file_content(self, file_path: Path) -> List[ContentMatch]:
        """単一ファイルの分析"""
        matches = []
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                lines = f.readlines()
        except (UnicodeDecodeError, PermissionError):
            # バイナリファイルやアクセス不可ファイルはスキップ
            return matches
        
        for line_num, line in enumerate(lines, 1):
            line_content = line.strip()
            if not line_content or line_content.startswith('//') or line_content.startswith('#'):
                continue
            
            # 直接パターンマッチ
            direct_matches = self._check_direct_patterns(line_content)
            for pattern, match_type in direct_matches:
                severity = "high" if "1point02" in pattern else "medium"
                matches.append(ContentMatch(
                    file_path=str(file_path.relative_to(self.project_root)),
                    line_number=line_num,
                    content=line_content,
                    similarity=1.0,  # 直接マッチは100%
                    matched_pattern=pattern,
                    severity=severity
                ))
            
            # 類似度チェック（既知の問題文章と比較）
            known_phrases = [
                "チームの得点と失点から期待勝率を算出する指標",
                "投手の被安打率は運の要素が大きい",
                "パークファクターによる球場補正"
            ]
            
            for known_phrase in known_phrases:
                similarity = self._calculate_similarity(line_content, known_phrase)
                if similarity >= self.similarity_threshold:
                    matches.append(ContentMatch(
                        file_path=str(file_path.relative_to(self.project_root)),
                        line_number=line_num,
                        content=line_content,
                        similarity=similarity,
                        matched_pattern=f"Similar to: {known_phrase[:50]}...",
                        severity="medium"
                    ))
        
        return matches
    
    def audit_project(self) -> Dict:
        """プロジェクト全体の監査"""
        
        # 対象ファイル拡張子
        target_extensions = {'.tsx', '.ts', '.js', '.jsx', '.md', '.json', '.txt', '.py'}
        
        # 除外ディレクトリ
        exclude_dirs = {'node_modules', '.git', '.next', 'dist', 'build', '__pycache__'}
        
        all_matches = []
        processed_files = 0
        
        for root, dirs, files in os.walk(self.project_root):
            # 除外ディレクトリをスキップ
            dirs[:] = [d for d in dirs if d not in exclude_dirs]
            
            for file in files:
                file_path = Path(root) / file
                
                # 拡張子チェック
                if file_path.suffix not in target_extensions:
                    continue
                
                matches = self._analyze_file_content(file_path)
                all_matches.extend(matches)
                processed_files += 1
        
        # 結果の集計
        severity_counts = Counter(match.severity for match in all_matches)
        file_counts = Counter(match.file_path for match in all_matches)
        
        return {
            'total_files_processed': processed_files,
            'total_matches': len(all_matches),
            'severity_breakdown': dict(severity_counts),
            'affected_files': len(file_counts),
            'matches': [
                {
                    'file': match.file_path,
                    'line': match.line_number,
                    'content': match.content,
                    'similarity': round(match.similarity, 3),
                    'pattern': match.matched_pattern,
                    'severity': match.severity
                }
                for match in sorted(all_matches, key=lambda x: (x.severity == 'high', x.similarity), reverse=True)
            ]
        }
    
    def generate_report(self, results: Dict) -> str:
        """監査レポート生成"""
        report = []
        report.append("# 📋 コンテンツ監査レポート")
        report.append(f"**生成日時:** {__import__('datetime').datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        report.append("")
        
        # サマリー
        report.append("## 📊 サマリー")
        report.append(f"- **処理ファイル数:** {results['total_files_processed']}")
        report.append(f"- **検出項目数:** {results['total_matches']}")
        report.append(f"- **影響ファイル数:** {results['affected_files']}")
        report.append("")
        
        # 深刻度別
        report.append("## ⚠️ 深刻度別")
        for severity, count in results['severity_breakdown'].items():
            emoji = "🚨" if severity == "high" else "⚠️" if severity == "medium" else "ℹ️"
            report.append(f"- **{emoji} {severity.upper()}:** {count}件")
        report.append("")
        
        # 検出項目詳細
        if results['matches']:
            report.append("## 🔍 検出項目")
            for match in results['matches'][:20]:  # 上位20件
                emoji = "🚨" if match['severity'] == "high" else "⚠️" if match['severity'] == "medium" else "ℹ️"
                report.append(f"### {emoji} {match['file']}:{match['line']}")
                report.append(f"**類似度:** {match['similarity']:.1%}")
                report.append(f"**パターン:** {match['pattern']}")
                report.append(f"**内容:** `{match['content'][:100]}...`")
                report.append("")
        else:
            report.append("## ✅ 検出項目")
            report.append("問題となる類似コンテンツは検出されませんでした。")
            report.append("")
        
        # 推奨アクション
        if results['total_matches'] > 0:
            report.append("## 🛠️ 推奨アクション")
            if results['severity_breakdown'].get('high', 0) > 0:
                report.append("1. **HIGH優先度項目の即座修正**")
                report.append("2. 該当箇所をオリジナル文章に置き換え")
                report.append("3. 類似フレーズの全文書見直し")
            else:
                report.append("1. MEDIUM/LOW項目の段階的修正")
                report.append("2. 独自表現への言い換え検討")
            report.append("")
        
        return "\n".join(report)

def main():
    """メイン実行"""
    import argparse
    
    parser = argparse.ArgumentParser(description="Content audit for copyright compliance")
    parser.add_argument("--project-root", default=".", help="Project root directory")
    parser.add_argument("--output", default="audit_report.md", help="Output report file")
    parser.add_argument("--ci", action="store_true", help="CI mode (exit with error if issues found)")
    
    args = parser.parse_args()
    
    auditor = ContentAuditor(args.project_root)
    print("Content audit starting...")
    
    results = auditor.audit_project()
    
    # レポート生成
    report = auditor.generate_report(results)
    
    with open(args.output, 'w', encoding='utf-8') as f:
        f.write(report)
    
    print(f"Audit completed: {args.output}")
    print(f"   Files processed: {results['total_files_processed']}")
    print(f"   Issues detected: {results['total_matches']}")
    
    # CI モードでの終了コード
    if args.ci:
        high_severity = results['severity_breakdown'].get('high', 0)
        if high_severity > 0:
            print(f"CI FAIL: {high_severity} high priority issues")
            exit(1)
        else:
            print("CI PASS: No high priority issues")
            exit(0)

if __name__ == "__main__":
    main()