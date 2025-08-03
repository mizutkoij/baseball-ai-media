#!/usr/bin/env node
/**
 * OG Image Snapshot System
 * 
 * Generates and saves OpenGraph images for key pages to enable:
 * - Social media sharing previews
 * - Fast delivery via CDN
 * - Quality assurance for visual assets
 * - Version control of shared content
 */

import fs from 'fs'
import fetch from 'node-fetch'
import path from 'path'

const ORIGIN = process.env.PREVIEW_URL || process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'

// Core OG image endpoints to snapshot
const OG_URLS = [
  // Team comparison views
  '/api/og/teams?year=2024&teams=T,H,C,G&pf=true',
  '/api/og/teams?year=2024&teams=L,M,F,Bs&pf=true', 
  '/api/og/teams?year=2024&teams=Db,S,E,H&pf=true',
  
  // Player comparison views
  '/api/og/compare?ids=1000001,1000002&year=2024&pf=true',
  '/api/og/compare?ids=1000003,1000004,1000005&year=2024&pf=true',
  
  // Season summary views
  '/api/og/season?year=2024&league=central',
  '/api/og/season?year=2024&league=pacific',
  
  // Individual player highlights
  '/api/og/player?id=1000001&year=2024&pf=true',
  '/api/og/player?id=1000002&year=2024&pf=false',
  
  // Team summary cards
  '/api/og/team?id=T&year=2024&pf=true',
  '/api/og/team?id=H&year=2024&pf=true',
  '/api/og/team?id=C&year=2024&pf=true'
]

interface SnapshotResult {
  url: string
  filename: string
  size: number
  success: boolean
  error?: string
  duration: number
}

/**
 * Generate safe filename from URL
 */
function generateFilename(url: string): string {
  // Remove /api/og/ prefix and clean up characters
  const cleanUrl = url.replace('/api/og/', '').replace(/[^\w\-_=&?]/g, '_')
  
  // Limit length and add timestamp
  const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const baseName = cleanUrl.slice(0, 80)
  
  return `${timestamp}_${baseName}.png`
}

/**
 * Snapshot single OG image
 */
async function snapshotImage(url: string): Promise<SnapshotResult> {
  const startTime = Date.now()
  const fullUrl = ORIGIN + url
  const filename = generateFilename(url)
  
  try {
    console.log(`📸 Capturing: ${url}`)
    
    const response = await fetch(fullUrl, {
      headers: {
        'User-Agent': 'OG-Snapshot-Bot/1.0'
      },
      timeout: 15000 // 15 second timeout
    })
    
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
    console.error(`❌ Failed: ${url} - ${error.message}`)
    
    return {
      url,
      filename: '',
      size: 0,
      success: false,
      error: error.message,
      duration
    }
  }
}

/**
 * Generate snapshot report
 */
function generateReport(results: SnapshotResult[]): string {
  const successful = results.filter(r => r.success)
  const failed = results.filter(r => !r.success)
  const totalSize = successful.reduce((sum, r) => sum + r.size, 0)
  const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length
  
  let report = `# OG Image Snapshot Report

**Generated**: ${new Date().toISOString()}
**Origin**: ${ORIGIN}
**Total URLs**: ${results.length}
**Successful**: ${successful.length}
**Failed**: ${failed.length}
**Total Size**: ${(totalSize / 1024).toFixed(1)} KB
**Average Duration**: ${avgDuration.toFixed(0)}ms

## Successful Snapshots
`

  successful.forEach(result => {
    report += `- ✅ **${result.filename}** (${(result.size/1024).toFixed(1)}KB, ${result.duration}ms)\n`
    report += `  - URL: \`${result.url}\`\n`
  })
  
  if (failed.length > 0) {
    report += `\n## Failed Snapshots\n`
    failed.forEach(result => {
      report += `- ❌ **${result.url}** (${result.duration}ms)\n`
      report += `  - Error: ${result.error}\n`
    })
  }
  
  report += `\n## Usage
These snapshots can be used for:
- Social media preview validation
- CDN distribution for faster loading
- Version control of visual assets
- Quality assurance testing

## File Locations
- **Storage**: \`.reports/og/\`
- **Naming**: \`YYYYMMDD_endpoint_params.png\`
- **Retention**: 30 days (cleanup via CI)
`

  return report
}

/**
 * Cleanup old snapshots (keep last 30 days)
 */
function cleanupOldSnapshots(): number {
  const outputDir = '.reports/og'
  
  if (!fs.existsSync(outputDir)) {
    return 0
  }
  
  const files = fs.readdirSync(outputDir)
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - 30)
  const cutoffDateStr = cutoffDate.toISOString().slice(0, 10).replace(/-/g, '')
  
  let deletedCount = 0
  
  files.forEach(file => {
    if (file.endsWith('.png') && file.length >= 8) {
      const fileDate = file.substring(0, 8)
      if (fileDate < cutoffDateStr) {
        fs.unlinkSync(path.join(outputDir, file))
        deletedCount++
        console.log(`🗑️ Cleaned up old snapshot: ${file}`)
      }
    }
  })
  
  return deletedCount
}

/**
 * Main execution
 */
async function main() {
  console.log('📸 Baseball AI Media - OG Image Snapshot System\n')
  console.log(`🎯 Origin: ${ORIGIN}`)
  console.log(`📋 URLs to snapshot: ${OG_URLS.length}`)
  console.log(`📁 Output directory: .reports/og/\n`)
  
  // Cleanup old files first
  const cleanedCount = cleanupOldSnapshots()
  if (cleanedCount > 0) {
    console.log(`🗑️ Cleaned up ${cleanedCount} old snapshots\n`)
  }
  
  const results: SnapshotResult[] = []
  
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
  
  // Generate and save report
  const report = generateReport(results)
  const reportPath = `.reports/og_snapshot_${new Date().toISOString().slice(0, 19).replace(/[:-]/g, '')}.md`
  fs.writeFileSync(reportPath, report)
  
  console.log(`\n📊 Summary:`)
  console.log(`   ✅ Successful: ${results.filter(r => r.success).length}/${results.length}`)
  console.log(`   📄 Report: ${reportPath}`)
  
  const failedCount = results.filter(r => !r.success).length
  if (failedCount > 0) {
    console.log(`   ❌ Failed: ${failedCount} (check report for details)`)
    process.exit(1)
  } else {
    console.log(`   🎉 All snapshots captured successfully!`)
    process.exit(0)
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('❌ Snapshot system failed:', error)
    process.exit(1)
  })
}