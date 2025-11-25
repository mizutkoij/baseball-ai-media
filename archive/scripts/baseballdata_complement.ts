#!/usr/bin/env npx tsx
/**
 * baseballdata.jp 日次補完スクリプト
 * CLI実行用
 */

import { runDailyComplement } from '../lib/connectors/baseballdata-complement';

async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help')) {
    console.log(`
baseballdata.jp Daily Complement Usage:
  npm run baseballdata:complement -- [date] [--contact email]
  
Examples:
  npm run baseballdata:complement                    # Today
  npm run baseballdata:complement -- 2025-08-13     # Specific date
  npm run baseballdata:complement -- --contact you@example.com
    `);
    return;
  }
  
  const date = args[0] || new Date().toISOString().split('T')[0];
  const contactEmail = args.includes('--contact') ? 
    args[args.indexOf('--contact') + 1] : 
    process.env.CONTACT_EMAIL;
  
  try {
    await runDailyComplement(date, contactEmail);
  } catch (error) {
    console.error('Daily complement failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}