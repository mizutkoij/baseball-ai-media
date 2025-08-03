#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Test NPB HTML parsing with real data
"""

import requests
from bs4 import BeautifulSoup
import re
import sys
import io

# Force UTF-8 output for console
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

def test_npb_box_parsing():
    """Test parsing of NPB box score page"""
    url = "https://npb.jp/scores/2025/0731/db-s-15/box.html"
    
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (compatible; baseball-ai-media/npb-fetch; +https://baseball-ai-media.vercel.app)",
            "Accept-Language": "ja,en;q=0.8",
        }
        
        resp = requests.get(url, headers=headers, timeout=20)
        resp.raise_for_status()
        
        # Force UTF-8 decoding
        resp.encoding = 'utf-8'
        
        print(f"Status: {resp.status_code}")
        print(f"Content length: {len(resp.text)}")
        print(f"Encoding: {resp.encoding}")
        
        # Parse with BeautifulSoup
        soup = BeautifulSoup(resp.content, "lxml", from_encoding='utf-8')
        
        # Find all tables
        tables = soup.select("table")
        print(f"Found {len(tables)} tables")
        
        for i, table in enumerate(tables):
            try:
                print(f"\n=== Table {i} ===")
                
                # Get headers
                headers = [th.get_text(strip=True) for th in table.select("th")]
                print(f"Headers ({len(headers)}): {[h[:20] + '...' if len(h) > 20 else h for h in headers]}")
                
                # Get first few rows for inspection
                rows = table.select("tr")[:8]  # First 8 rows
                for j, row in enumerate(rows):
                    cells = [td.get_text(strip=True) for td in row.select("td")]
                    if cells:  # Only print non-empty rows
                        # Truncate long cell content for readability
                        short_cells = [c[:15] + '...' if len(c) > 15 else c for c in cells[:8]]
                        print(f"  Row {j} ({len(cells)} cols): {short_cells}")
                        
                        # Check if this looks like player stats
                        if len(cells) >= 5 and any(c.isdigit() for c in cells[2:]):
                            print(f"    -> Potential stats row: Name={cells[0]}")
                
            except Exception as table_error:
                print(f"Error processing table {i}: {table_error}")
        
        # Look for specific text patterns
        print(f"\n=== Text Analysis ===")
        text = soup.get_text()
        
        # Check encoding issues
        print(f"Text sample (first 200 chars): {text[:200]}")
        
        # Look for key elements
        if "DeNA" in text or "横浜" in text:
            print("Found DeNA team reference")
        if "巨人" in text or "読売" in text:
            print("Found Giants team reference")
            
        # Look for numerical patterns that might be stats
        number_patterns = re.findall(r'\b\d+\b', text)
        print(f"Found {len(number_patterns)} numbers in text")
        
        # Save HTML for manual inspection
        with open("debug_box.html", "w", encoding="utf-8") as f:
            f.write(resp.text)
        print("Saved HTML to debug_box.html for manual inspection")
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_npb_box_parsing()