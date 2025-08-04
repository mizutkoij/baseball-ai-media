#!/usr/bin/env node
/**
 * Simple OG Image Snapshot System (JavaScript version)
 * Generates and saves OpenGraph images for key pages
 */

const fs = require('fs')
const path = require('path')

const ORIGIN = process.env.PREVIEW_URL || process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'

// Core OG image endpoints to snapshot
const OG_URLS = [
  // Team comparison views
  '/api/og/teams?year=2024&teams=T,H,C,G&pf=true',
  '/api/og/teams?year=2024&teams=L,M,F,Bs&pf=true', 
  '/api/og/teams?year=2024&teams=Db,S,E,H&pf=true',
  
  // Player comparison views
  '/api/og/compare?ids=1000001,1000002&year=2024&pf=true',
  '/api/og/compare?ids=1000003,1000004,1000005&year=2024&pf=true'
]

/**
 * Generate safe filename from URL
 */
function generateFilename(url) {
  const cleanUrl = url.replace('/api/og/', '').replace(/[^\w\-_=&?]/g, '_')
  const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const baseName = cleanUrl.slice(0, 80)
  return `${timestamp}_${baseName}.png`
}

/**
 * Snapshot single OG image using dynamic import
 */
async function snapshotImage(url) {
  const startTime = Date.now()
  const fullUrl = ORIGIN + url
  const filename = generateFilename(url)
  
  try {
    console.log(`📸 Capturing: ${url}`)
    
    // Dynamic import for node-fetch
    const { default: fetch } = await import('node-fetch')
    
    // Set up AbortController for timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout
    
    const response = await fetch(fullUrl, {
      headers: {
        'User-Agent': 'OG-Snapshot-Bot/1.0'
      },
      signal: controller.signal
    })
    
    clearTimeout(timeoutId)
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    const contentType = response.headers.get('content-type')
    if (!contentType?.includes('image/')) {
      throw new Error(`Expected image, got ${contentType}`)
    }
    
    const buffer = Buffer.from(await response.arrayBuffer())
    
    // Ensure output directory exists
    const outputDir = '.reports/og'
    fs.mkdirSync(outputDir, { recursive: true })
    
    // Save image
    const outputPath = path.join(outputDir, filename)
    fs.writeFileSync(outputPath, buffer)
    
    const duration = Date.now() - startTime
    console.log(`✅ Saved: ${filename} (${buffer.length}B, ${duration}ms)`)
    
    return {
      url,
      filename,
      size: buffer.length,
      success: true,
      duration
    }
    
  } catch (error) {
    const duration = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error(`❌ Failed: ${url} - ${errorMessage}`)
    
    return {
      url,
      filename: '',
      size: 0,
      success: false,
      error: errorMessage,
      duration
    }
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('📸 Baseball AI Media - OG Image Snapshot System (Simple)\n')
  console.log(`🎯 Origin: ${ORIGIN}`)
  console.log(`📋 URLs to snapshot: ${OG_URLS.length}`)
  console.log(`📁 Output directory: .reports/og/\n`)
  
  const results = []
  
  // Process URLs with some delay to avoid overwhelming the server
  for (let i = 0; i < OG_URLS.length; i++) {
    const url = OG_URLS[i]
    const result = await snapshotImage(url)
    results.push(result)
    
    // Small delay between requests
    if (i < OG_URLS.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500))
    }
  }
  
  const successful = results.filter(r => r.success)
  const failed = results.filter(r => !r.success)
  
  console.log(`\n📊 Summary:`)
  console.log(`   ✅ Successful: ${successful.length}/${results.length}`)
  
  if (failed.length > 0) {
    console.log(`   ❌ Failed: ${failed.length} (check logs for details)`)
    failed.forEach(f => console.log(`      - ${f.url}: ${f.error}`))
    
    // In CI, be more lenient - don't fail the build if all snapshots fail
    // (likely means the server isn't running, which is expected in some CI stages)
    if (process.env.CI && successful.length === 0) {
      console.log(`   ℹ️ All snapshots failed in CI - likely server not running (continuing...)`)
      process.exit(0)
    } else {
      process.exit(1)
    }
  } else {
    console.log(`   🎉 All snapshots captured successfully!`)
    process.exit(0)
  }
}

if (require.main === module) {
  main().catch(error => {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('❌ Snapshot system failed:', errorMessage)
    process.exit(1)
  })
}