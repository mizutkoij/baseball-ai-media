// Use native fetch (Node 18+) or fallback

const targets = [
  "/standings",
  "/rankings", 
  "/matchups",
  "/column",
];

(async () => {
  const base = process.env.BASE_URL || "https://baseball-ai-media.vercel.app";
  let warn = 0;
  
  console.log("🔍 Checking structured data on key pages...");
  
  for (const path of targets) {
    try {
      const response = await fetch(base + path);
      const html = await response.text();
      const hasJsonLd = html.includes('application/ld+json');
      
      if (hasJsonLd) {
        console.log(`✅ ${path} - JSON-LD found`);
        
        // Count JSON-LD blocks
        const jsonLdCount = (html.match(/application\/ld\+json/g) || []).length;
        console.log(`   📊 ${jsonLdCount} JSON-LD block(s)`);
      } else {
        console.warn(`⚠️  ${path} - No JSON-LD found`);
        warn++;
      }
    } catch (error) {
      console.warn(`❌ ${path} - Failed to check: ${error.message}`);
      warn++;
    }
  }
  
  console.log(`\n📈 Summary: ${targets.length - warn}/${targets.length} pages have structured data`);
  
  if (warn > 0) {
    console.log(`\n💡 Note: This is a warning-only check. Issues don't fail the build.`);
  }
  
  // Always exit with 0 (don't fail builds)
  process.exit(0);
})();