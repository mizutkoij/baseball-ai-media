#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Analyze NPB box score HTML structure
"""

from bs4 import BeautifulSoup
import re

def analyze_html():
    """Analyze the saved HTML file"""
    try:
        with open("debug_box.html", "r", encoding="utf-8") as f:
            html_content = f.read()
        
        soup = BeautifulSoup(html_content, "lxml")
        
        # Look for div elements that might contain box scores
        print("=== Searching for box score content ===")
        
        # Look for elements with specific IDs or classes
        box_elements = soup.select("[id*='box'], [id*='batting'], [id*='pitching'], [class*='box'], [class*='batting'], [class*='pitching']")
        print(f"Found {len(box_elements)} box score related elements")
        
        # Look for table elements with more specific content
        tables = soup.select("table")
        print(f"\n=== Analyzing {len(tables)} tables ===")
        
        for i, table in enumerate(tables):
            table_html = str(table)[:500]  # First 500 chars
            
            # Look for Japanese baseball terms
            if any(term in table_html for term in ["打数", "安打", "打点", "投球", "防御率"]):
                print(f"\nTable {i} contains baseball terms:")
                print(table_html)
                
                # Analyze structure
                rows = table.select("tr")
                print(f"  {len(rows)} rows")
                
                for j, row in enumerate(rows[:3]):  # First 3 rows
                    cells = [cell.get_text(strip=True) for cell in row.select("td, th")]
                    if cells:
                        print(f"    Row {j}: {cells}")
        
        # Look for specific patterns in the text
        text = soup.get_text()
        
        # Search for player names pattern (Japanese names)
        name_patterns = re.findall(r'[一-龯]{2,4}', text)
        potential_names = [name for name in name_patterns if len(name) >= 2]
        print(f"\nPotential player names: {potential_names[:10]}")  # First 10
        
        # Search for statistical patterns
        stat_patterns = re.findall(r'\b\d+\s+\d+\s+\d+\b', text)
        print(f"Potential stat lines: {stat_patterns[:5]}")  # First 5
        
        # Look for specific sections
        if "打撃成績" in text:
            print("Found batting stats section (打撃成績)")
        if "投手成績" in text:
            print("Found pitching stats section (投手成績)")
            
        # Search for table with specific structure
        print("\n=== Looking for structured data ===")
        
        # Find elements that might be formatted box scores
        for div in soup.select("div"):
            div_text = div.get_text(strip=True)
            if len(div_text) > 50 and any(term in div_text for term in ["打数", "安打"]):
                print(f"Found potential batting div: {div_text[:100]}")
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    analyze_html()