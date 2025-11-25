# lib/polite_http.py
from __future__ import annotations
import json, os, time, random, hashlib
from typing import Optional, Tuple
import requests
from urllib.robotparser import RobotFileParser
from urllib.parse import urlparse

DEFAULT_UA = "NPB-ResearchBot/1.0 (+contact@baseball-ai-media.vercel.app)"
CACHE_PATH = "data/http_cache.json"
ROBOTS_CACHE = "data/robots_cache.json"

class PoliteHttp:
    def __init__(self, min_interval_s=30.0, session: Optional[requests.Session]=None):
        self.s = session or requests.Session()
        self.s.headers.update({"User-Agent": DEFAULT_UA, "Accept-Language":"ja,en;q=0.8"})
        self.min_interval_s = min_interval_s
        os.makedirs("data", exist_ok=True)
        self.cache = self._load_json(CACHE_PATH)
        self.robots = self._load_json(ROBOTS_CACHE)
        self.last_called = {}  # per-host timestamp

    def _load_json(self, p):
        try:
            with open(p, "r", encoding="utf-8") as f: return json.load(f)
        except: return {}

    def _save_json(self, p, obj):
        tmp = p + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f: json.dump(obj, f, ensure_ascii=False, indent=2)
        os.replace(tmp, p)

    def _respect_interval(self, host:str):
        now = time.time()
        last = self.last_called.get(host, 0)
        need = self.min_interval_s + random.uniform(0.2, 0.8)  # ジッター
        if now - last < need:
            time.sleep(need - (now - last))
        self.last_called[host] = time.time()

    def _allowed_by_robots(self, url:str) -> bool:
        o = urlparse(url)
        robots_url = f"{o.scheme}://{o.netloc}/robots.txt"
        today = time.strftime("%Y-%m-%d", time.gmtime())
        key = f"{o.netloc}:{today}"
        if key not in self.robots:
            try:
                r = self.s.get(robots_url, timeout=10)
                rp = RobotFileParser()
                rp.parse(r.text.splitlines())
                self.robots[key] = {"allow": rp.can_fetch(DEFAULT_UA, url)}
                self._save_json(ROBOTS_CACHE, self.robots)
            except:
                # 取得不能時は保守的に True にし、上位のレート制限で抑制
                self.robots[key] = {"allow": True}
        return bool(self.robots[key]["allow"])

    def polite_get(self, url:str, timeout=20) -> Tuple[int, Optional[str]]:
        if not self._allowed_by_robots(url):
            return 451, None  # unavailable for legal reasons 的に扱う
        host = urlparse(url).netloc
        self._respect_interval(host)

        headers = {}
        meta = self.cache.get(url, {})
        if "etag" in meta: headers["If-None-Match"] = meta["etag"]
        if "last_modified" in meta: headers["If-Modified-Since"] = meta["last_modified"]

        try:
            r = self.s.get(url, headers=headers, timeout=timeout)
        except requests.RequestException:
            time.sleep(5)
            return 599, None

        # レート制限対応
        if r.status_code in (429, 503):
            ra = r.headers.get("Retry-After")
            sleep_s = int(ra) if ra and ra.isdigit() else 300  # 既定5分
            time.sleep(sleep_s)
            return r.status_code, None

        if r.status_code == 304:
            return 304, None

        if r.ok and r.text:
            # キャッシュ更新（ETag/Last-Modified）
            meta = {
                "etag": r.headers.get("ETag"),
                "last_modified": r.headers.get("Last-Modified"),
                "sha256": hashlib.sha256(r.text.encode("utf-8", "ignore")).hexdigest(),
                "ts": time.time()
            }
            self.cache[url] = meta
            self._save_json(CACHE_PATH, self.cache)
            return r.status_code, r.text

        return r.status_code, None