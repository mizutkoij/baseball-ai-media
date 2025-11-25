# lib/discord_csv_notifier.py
import os, json, time, requests, gzip, io
from typing import Optional, List

WEBHOOK = os.environ.get("DISCORD_WEBHOOK_DATA", "")
MAX_SIZE = 7_500_000  # 7.5MB: 余裕を持ってDiscordの8MB未満に

def _post_file(webhook: str, filename: str, bytes_data: bytes, comment: str=""):
    payload = {"content": comment[:1900]}  # 本文は控えめに
    files = {
        "file": (filename, bytes_data, "text/csv")
    }
    r = requests.post(webhook, data={"payload_json": json.dumps(payload)}, files=files, timeout=30)
    r.raise_for_status()

def send_csv(webhook: Optional[str], path: str, *, title: str="", tag: str=""):
    """CSVを毎回Discord送付。大きければ自動分割 or gzip圧縮。"""
    webhook = webhook or WEBHOOK
    if not webhook:
        return  # webhook未設定なら静かにスキップ

    with open(path, "rb") as f:
        data = f.read()

    comment = f"[{tag}] {title} ({os.path.basename(path)})".strip()

    if len(data) <= MAX_SIZE:
        _post_file(webhook, os.path.basename(path), data, comment)
        return

    # まずgzip圧縮を試みる
    gzbuf = io.BytesIO()
    with gzip.GzipFile(filename=os.path.basename(path), fileobj=gzbuf, mode="wb") as gz:
        gz.write(data)
    gz_bytes = gzbuf.getvalue()

    if len(gz_bytes) <= MAX_SIZE:
        _post_file(webhook, os.path.basename(path)+".gz", gz_bytes, comment+" (gz)")
        return

    # それでも大きければ行で分割
    lines = data.decode("utf-8", "ignore").splitlines(True)
    chunk, size, idx = [], 0, 1
    for ln in lines:
        b = ln.encode("utf-8")
        if size + len(b) > MAX_SIZE and chunk:
            part = ("".join(chunk)).encode("utf-8")
            _post_file(webhook, f"{os.path.basename(path)}.part{idx}.csv", part, comment+f" (part{idx})")
            time.sleep(0.6)  # スパム抑制
            chunk, size, idx = [], 0, idx+1
        chunk.append(ln); size += len(b)
    if chunk:
        part = ("".join(chunk)).encode("utf-8")
        _post_file(webhook, f"{os.path.basename(path)}.part{idx}.csv", part, comment+f" (part{idx})")