#!/usr/bin/env python3
"""Basic monitoring and notification system for baseball data pipeline"""

import re
import subprocess
import sys
import glob
import os
from datetime import datetime
import requests

class PipelineMonitor:
    def __init__(self, webhook_url=None):
        """Initialize monitor with optional webhook for notifications"""
        self.webhook_url = webhook_url
        self.blocked_pattern = re.compile(r'(blocked|BLOCKED|403|429|503|アクセスが制限|Too Many Requests)', re.I)
        self.error_pattern = re.compile(r'(ERROR|FAIL|Exception|Traceback)', re.I)
    
    def get_latest_log(self):
        """Get the most recent pipeline log file"""
        log_files = glob.glob("pipeline_run_*.log")
        if not log_files:
            return None
        return max(log_files, key=os.path.getctime)
    
    def check_recent_logs(self, lines=50):
        """Check recent log entries for blocks and errors"""
        log_file = self.get_latest_log()
        if not log_file:
            return {"status": "no_logs", "blocked": False, "errors": []}
        
        try:
            # Read last N lines of log file
            with open(log_file, 'r', encoding='utf-8') as f:
                all_lines = f.readlines()
                recent_lines = all_lines[-lines:] if len(all_lines) > lines else all_lines
            
            recent_text = ''.join(recent_lines)
            
            # Check for blocks
            blocked = bool(self.blocked_pattern.search(recent_text))
            
            # Extract error lines
            errors = []
            for line in recent_lines:
                if self.error_pattern.search(line):
                    errors.append(line.strip())
            
            return {
                "status": "checked",
                "log_file": log_file,
                "lines_checked": len(recent_lines),
                "blocked": blocked,
                "errors": errors,
                "last_line": recent_lines[-1].strip() if recent_lines else ""
            }
            
        except Exception as e:
            return {"status": "error", "message": str(e)}
    
    def send_alert(self, message, level="warning"):
        """Send alert notification via webhook"""
        if not self.webhook_url:
            print(f"ALERT [{level.upper()}]: {message}")
            return
        
        emoji_map = {
            "info": "[INFO]",
            "warning": "[WARNING]", 
            "error": "[ERROR]",
            "critical": "[CRITICAL]"
        }
        
        prefix = emoji_map.get(level, "[ALERT]")
        full_message = f"{prefix} **Baseball Pipeline Alert**\n\n{message}\n\nTime: {datetime.now():%Y-%m-%d %H:%M:%S}"
        
        try:
            response = requests.post(
                self.webhook_url,
                json={"text": full_message},
                timeout=10
            )
            if response.status_code == 200:
                print(f"Alert sent successfully: {message}")
            else:
                print(f"Failed to send alert: HTTP {response.status_code}")
        except Exception as e:
            print(f"Alert send failed: {e}")
    
    def check_site_access(self):
        """Quick check of site accessibility"""
        try:
            result = subprocess.run(
                [sys.executable, "test_access_status.py"],
                capture_output=True,
                text=True,
                timeout=60
            )
            
            if result.returncode == 0:
                return {"accessible": True, "output": result.stdout}
            else:
                return {"accessible": False, "output": result.stdout, "error": result.stderr}
                
        except subprocess.TimeoutExpired:
            return {"accessible": False, "error": "Access check timeout"}
        except Exception as e:
            return {"accessible": False, "error": str(e)}
    
    def run_health_check(self):
        """Comprehensive health check"""
        print("=" * 60)
        print("Baseball Pipeline Health Check")
        print(f"Time: {datetime.now():%Y-%m-%d %H:%M:%S}")
        print("=" * 60)
        
        # 1. Check recent logs
        log_status = self.check_recent_logs()
        print(f"\n[LOG] Status: {log_status['status']}")
        
        if log_status['status'] == 'checked':
            print(f"   Log file: {log_status['log_file']}")
            print(f"   Lines checked: {log_status['lines_checked']}")
            print(f"   Blocked: {'YES' if log_status['blocked'] else 'NO'}")
            print(f"   Errors found: {len(log_status['errors'])}")
            
            if log_status['blocked']:
                self.send_alert("Block detected in pipeline logs - immediate attention required", "critical")
                print("   CRITICAL: Block detected!")
            
            if log_status['errors']:
                print("   Recent errors:")
                for error in log_status['errors'][-3:]:  # Show last 3 errors
                    print(f"     {error}")
        
        # 2. Check site access
        print(f"\n[ACCESS] Site Access Check:")
        access_status = self.check_site_access()
        
        if access_status['accessible']:
            print("   OK: All sites accessible")
        else:
            print("   FAIL: Some sites blocked")
            self.send_alert("Site access restrictions detected", "warning")
            print(f"   Output: {access_status.get('output', '')}")
        
        # 3. Check required files
        print(f"\n[FILES] File Check:")
        required_files = [
            "antiblock.py",
            "step_1_schedule_scraper_antiblock.py", 
            "step_2_index_extractor_antiblock.py",
            "step_3_pitchlog_fetcher_antiblock.py",
            "run_yahoo_pipeline.py"
        ]
        
        missing_files = []
        for file in required_files:
            if os.path.exists(file):
                print(f"   OK: {file}")
            else:
                print(f"   FAIL: {file} missing")
                missing_files.append(file)
        
        if missing_files:
            self.send_alert(f"Missing critical files: {', '.join(missing_files)}", "error")
        
        # 4. Summary
        print(f"\n[SUMMARY] Health Check Summary:")
        all_healthy = (
            log_status.get('status') == 'checked' and
            not log_status.get('blocked', False) and
            len(log_status.get('errors', [])) == 0 and
            access_status.get('accessible', False) and
            len(missing_files) == 0
        )
        
        if all_healthy:
            print("   OK: All systems healthy - pipeline ready")
        else:
            print("   WARNING: Issues detected - review above details")
            
        return all_healthy

def main():
    """Main monitoring function"""
    import argparse
    
    parser = argparse.ArgumentParser(description="Baseball Pipeline Monitor")
    parser.add_argument("--webhook", help="Webhook URL for notifications")
    parser.add_argument("--check-logs", action="store_true", help="Check recent logs only")
    parser.add_argument("--check-access", action="store_true", help="Check site access only") 
    parser.add_argument("--health", action="store_true", help="Full health check")
    parser.add_argument("--lines", type=int, default=50, help="Number of log lines to check")
    
    args = parser.parse_args()
    
    monitor = PipelineMonitor(webhook_url=args.webhook)
    
    if args.check_logs:
        result = monitor.check_recent_logs(args.lines)
        print(f"Log check result: {result}")
        
        if result.get('blocked'):
            print("🚨 CRITICAL: Block detected in logs!")
            sys.exit(1)
            
    elif args.check_access:
        result = monitor.check_site_access()
        print(f"Access check result: {result}")
        
        if not result.get('accessible'):
            print("⚠️  WARNING: Site access issues detected!")
            sys.exit(1)
            
    elif args.health:
        healthy = monitor.run_health_check()
        sys.exit(0 if healthy else 1)
        
    else:
        # Default: quick block check
        result = monitor.check_recent_logs(20)
        if result.get('blocked'):
            print("CRITICAL: Block detected - pipeline should be stopped")
            monitor.send_alert("Block detected in pipeline logs", "critical")
            sys.exit(1)
        else:
            print("OK: No recent blocks detected")
            sys.exit(0)

if __name__ == "__main__":
    main()