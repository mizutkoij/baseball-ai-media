# scripts/notify_csv_changes.py
import os, time, argparse
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
import sys
sys.path.append(".")
from lib.discord_csv_notifier import send_csv

class Handler(FileSystemEventHandler):
    def __init__(self, tag): self.tag = tag
    def on_created(self, e):
        if e.is_directory: return
        if e.src_path.endswith(".csv"):
            send_csv(None, e.src_path, title="New CSV", tag=self.tag)

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--dirs", default="data/indexes,data/pitchlogs")
    ap.add_argument("--tag", default="AutoWatch")
    args = ap.parse_args()
    obs = Observer()
    for d in args.dirs.split(","):
        os.makedirs(d, exist_ok=True)
        obs.schedule(Handler(args.tag), d, recursive=False)
    obs.start()
    try:
        while True: time.sleep(1)
    except KeyboardInterrupt:
        obs.stop()
    obs.join()