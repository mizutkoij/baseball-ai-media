#!/usr/bin/env python3
"""
Polite HTTP Client with Conditional GET and Rate Limiting
Yahoo/baseballdata.jp scraping with robots.txt compliance
"""

import httpx
import asyncio
import time
import hashlib
import unicodedata
import re
import json
import os
from typing import Optional, Dict, List, Tuple
from aiolimiter import AsyncLimiter
from datetime import datetime
import logging

# レート制限設定
DEFAULT_RATE_LIMIT = AsyncLimiter(1, 15)  # 1 req / 15s (平常時)
HIGH_RATE_LIMIT = AsyncLimiter(1, 8)      # 1 req / 8s (ハイレバ時)
SLOW_RATE_LIMIT = AsyncLimiter(1, 30)     # 1 req / 30s (429多発時)

DEFAULT_HEADERS = {
    "User-Agent": "NPB-ResearchBot/1.0 (+contact@example.com)",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "ja,en;q=0.5",
    "Accept-Encoding": "gzip, deflate",
    "DNT": "1",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
}

# Cache directories
CACHE_DIR = "data/cache/http"
ETAG_CACHE_DIR = "data/cache/etags"
ROBOTS_CACHE_DIR = "data/cache/robots"

os.makedirs(CACHE_DIR, exist_ok=True)
os.makedirs(ETAG_CACHE_DIR, exist_ok=True)
os.makedirs(ROBOTS_CACHE_DIR, exist_ok=True)

logger = logging.getLogger(__name__)

class PoliteHTTPClient:
    """
    礼儀正しいHTTPクライアント
    - 条件付きGET (ETag/Last-Modified)
    - robots.txt遵守
    - 適応的レート制限
    - Retry-After尊重
    """
    
    def __init__(self, contact_email: str = "contact@example.com"):
        self.contact_email = contact_email
        self.rate_limiter = DEFAULT_RATE_LIMIT
        self.failure_count = 0
        self.last_robots_check = {}
        self.etag_cache = {}
        self.load_etag_cache()
        
    def load_etag_cache(self):
        """ETagキャッシュを読み込み"""
        cache_file = os.path.join(ETAG_CACHE_DIR, "etag_cache.json")
        if os.path.exists(cache_file):
            try:
                with open(cache_file, 'r', encoding='utf-8') as f:
                    self.etag_cache = json.load(f)
            except Exception as e:
                logger.warning(f"Failed to load ETag cache: {e}")
                self.etag_cache = {}
    
    def save_etag_cache(self):
        """ETagキャッシュを保存"""
        cache_file = os.path.join(ETAG_CACHE_DIR, "etag_cache.json")
        try:
            with open(cache_file, 'w', encoding='utf-8') as f:
                json.dump(self.etag_cache, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.warning(f"Failed to save ETag cache: {e}")
    
    async def check_robots_txt(self, base_url: str) -> bool:
        """
        robots.txt確認（日次キャッシュ）
        """
        today = datetime.now().strftime("%Y-%m-%d")
        cache_key = f"{base_url}#{today}"
        
        if cache_key in self.last_robots_check:
            return self.last_robots_check[cache_key]
        
        robots_url = f"{base_url}/robots.txt"
        robots_file = os.path.join(ROBOTS_CACHE_DIR, f"{base_url.replace('://', '_').replace('/', '_')}.txt")
        
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(robots_url)
                if response.status_code == 200:
                    robots_content = response.text
                    
                    # robots.txtをキャッシュ
                    with open(robots_file, 'w', encoding='utf-8') as f:
                        f.write(robots_content)
                    
                    # NPB-ResearchBot の許可確認
                    lines = robots_content.lower().split('\n')
                    user_agent_section = False
                    disallowed = False
                    
                    for line in lines:
                        line = line.strip()
                        if line.startswith('user-agent:'):
                            ua = line.split(':', 1)[1].strip()
                            user_agent_section = (ua == '*' or 'bot' in ua or 'research' in ua)
                        elif user_agent_section and line.startswith('disallow:'):
                            path = line.split(':', 1)[1].strip()
                            if path == '/' or '/npb/' in path:
                                disallowed = True
                                break
                    
                    allowed = not disallowed
                    self.last_robots_check[cache_key] = allowed
                    
                    if not allowed:
                        logger.warning(f"robots.txt disallows scraping for {base_url}")
                    
                    return allowed
                else:
                    # robots.txt not found - assume allowed but be conservative
                    logger.info(f"robots.txt not found for {base_url}, proceeding conservatively")
                    self.last_robots_check[cache_key] = True
                    return True
                    
        except Exception as e:
            logger.warning(f"Failed to check robots.txt for {base_url}: {e}")
            # エラー時は保守的にTrue（ただし慎重に）
            self.last_robots_check[cache_key] = True
            return True
    
    def adjust_rate_limit(self, success: bool, status_code: Optional[int] = None):
        """
        レート制限の適応的調整
        """
        if success and status_code == 304:
            # 304 (Not Modified) は成功扱いだが、間隔を少し短縮可能
            if self.failure_count > 0:
                self.failure_count = max(0, self.failure_count - 1)
        elif success:
            # 通常の成功
            if self.failure_count > 0:
                self.failure_count = max(0, self.failure_count - 1)
            if self.failure_count == 0:
                self.rate_limiter = DEFAULT_RATE_LIMIT
        else:
            # 失敗
            self.failure_count += 1
            if self.failure_count >= 3:
                self.rate_limiter = SLOW_RATE_LIMIT
                logger.warning(f"Switching to slow rate limit due to {self.failure_count} failures")
            elif status_code in (429, 503):
                self.rate_limiter = SLOW_RATE_LIMIT
    
    async def polite_get(self, url: str, use_cache: bool = True, timeout: float = 15.0) -> httpx.Response:
        """
        礼儀正しいGETリクエスト
        """
        # robots.txt確認
        from urllib.parse import urlparse
        parsed = urlparse(url)
        base_url = f"{parsed.scheme}://{parsed.netloc}"
        
        robots_ok = await self.check_robots_txt(base_url)
        if not robots_ok:
            raise Exception(f"robots.txt disallows access to {base_url}")
        
        # ETag/Last-Modified準備
        headers = dict(DEFAULT_HEADERS)
        headers["User-Agent"] = f"NPB-ResearchBot/1.0 (+{self.contact_email})"
        
        if use_cache and url in self.etag_cache:
            cache_data = self.etag_cache[url]
            if 'etag' in cache_data:
                headers["If-None-Match"] = cache_data['etag']
            if 'last_modified' in cache_data:
                headers["If-Modified-Since"] = cache_data['last_modified']
        
        # レート制限適用
        await self.rate_limiter.acquire()
        
        backoff = 2.0
        max_attempts = 6
        
        async with httpx.AsyncClient(
            timeout=timeout, 
            follow_redirects=True,
            limits=httpx.Limits(max_connections=1, max_keepalive_connections=1)
        ) as client:
            for attempt in range(max_attempts):
                try:
                    logger.debug(f"GET {url} (attempt {attempt + 1})")
                    response = await client.get(url, headers=headers)
                    
                    if response.status_code in (200, 304):
                        # 成功 - キャッシュ情報更新
                        if use_cache:
                            cache_data = {}
                            if 'etag' in response.headers:
                                cache_data['etag'] = response.headers['etag']
                            if 'last-modified' in response.headers:
                                cache_data['last_modified'] = response.headers['last-modified']
                            if cache_data:
                                self.etag_cache[url] = cache_data
                                self.save_etag_cache()
                        
                        self.adjust_rate_limit(True, response.status_code)
                        return response
                    
                    elif response.status_code in (429, 503):
                        # レート制限 - Retry-After尊重
                        retry_after = response.headers.get("Retry-After")
                        if retry_after and retry_after.isdigit():
                            wait_time = min(float(retry_after), 300)  # 最大5分
                        else:
                            wait_time = min(backoff * (1.2 + 0.3 * attempt), 60)
                        
                        logger.warning(f"Rate limited (attempt {attempt + 1}), waiting {wait_time}s")
                        await asyncio.sleep(wait_time)
                        backoff = min(backoff * 1.7, 30)
                        self.adjust_rate_limit(False, response.status_code)
                        continue
                    
                    else:
                        response.raise_for_status()
                        
                except httpx.TimeoutException:
                    logger.warning(f"Timeout for {url} (attempt {attempt + 1})")
                    if attempt < max_attempts - 1:
                        await asyncio.sleep(backoff)
                        backoff *= 1.5
                    else:
                        raise
                        
                except Exception as e:
                    logger.error(f"Error fetching {url}: {e}")
                    self.adjust_rate_limit(False)
                    raise
            
            raise Exception(f"Failed to fetch {url} after {max_attempts} attempts")

def normalize_text(s: str) -> str:
    """
    テキスト正規化（差分判定用）
    """
    if not s:
        return ""
    
    # Unicode正規化
    s = unicodedata.normalize("NFKC", s)
    
    # 空白の正規化
    s = re.sub(r"\s+", " ", s).strip()
    
    # 特定文字の正規化
    s = s.replace("髙", "高").replace("﨑", "崎")
    s = s.replace("（", "(").replace("）", ")")
    s = s.replace("－", "-").replace("‐", "-")
    
    # 全角数字の半角化
    s = s.translate(str.maketrans("０１２３４５６７８９", "0123456789"))
    
    return s

def row_hash(cells: List[str]) -> str:
    """
    行ハッシュ計算（差分判定用）
    """
    normalized_cells = [normalize_text(c) for c in cells]
    base = "||".join(normalized_cells)
    return hashlib.sha256(base.encode("utf-8")).hexdigest()

def should_increase_poll_interval(last_change_time: Optional[datetime], 
                                  current_time: Optional[datetime] = None) -> float:
    """
    ポーリング間隔の動的調整
    """
    if current_time is None:
        current_time = datetime.now()
    
    if last_change_time is None:
        return 15.0  # デフォルト間隔
    
    elapsed = (current_time - last_change_time).total_seconds()
    
    if elapsed < 30:
        return 8.0   # 変化直後は短間隔
    elif elapsed < 90:
        return 15.0  # 通常間隔
    elif elapsed < 300:
        return 30.0  # 長時間変化なしは長間隔
    else:
        return 45.0  # 非常に長間隔

class DifferentialIngester:
    """
    差分取り込みエンジン
    """
    
    def __init__(self, timeline_file: str, latest_file: str):
        self.timeline_file = timeline_file
        self.latest_file = latest_file
        self.seen_hashes = set()
        self.load_existing_hashes()
    
    def load_existing_hashes(self):
        """既存のハッシュを読み込み"""
        if os.path.exists(self.timeline_file):
            try:
                with open(self.timeline_file, 'r', encoding='utf-8') as f:
                    for line in f:
                        if line.strip():
                            data = json.loads(line)
                            if 'row_hash' in data:
                                self.seen_hashes.add(data['row_hash'])
            except Exception as e:
                logger.warning(f"Failed to load existing hashes: {e}")
    
    def ingest_rows(self, rows: List[Dict], game_id: str, index: str, 
                   confidence: str = "high") -> Tuple[int, int]:
        """
        行データの差分取り込み
        Returns: (new_rows, total_rows)
        """
        new_rows = 0
        timestamp = datetime.now().isoformat()
        
        latest_data = {
            "game_id": game_id,
            "index": index,
            "timestamp": timestamp,
            "confidence": confidence,
            "rows": []
        }
        
        for row in rows:
            # 行ハッシュ計算
            row_cells = [str(v) for v in row.values()]
            hash_value = row_hash(row_cells)
            
            # 新規行のみ処理
            if hash_value not in self.seen_hashes:
                row_with_meta = {
                    **row,
                    "row_hash": hash_value,
                    "game_id": game_id,
                    "index": index,
                    "timestamp": timestamp,
                    "confidence": confidence
                }
                
                # timelineに追記
                with open(self.timeline_file, 'a', encoding='utf-8') as f:
                    f.write(json.dumps(row_with_meta, ensure_ascii=False) + '\n')
                
                self.seen_hashes.add(hash_value)
                new_rows += 1
            
            # latestデータには全行含める（ハッシュ付き）
            latest_data["rows"].append({
                **row,
                "row_hash": hash_value
            })
        
        # latest.json更新
        with open(self.latest_file, 'w', encoding='utf-8') as f:
            json.dump(latest_data, f, ensure_ascii=False, indent=2)
        
        return new_rows, len(rows)