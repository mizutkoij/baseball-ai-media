#!/usr/bin/env ts-node

// Quick script to debug available years in both databases
const { query } = require('../lib/db')

async function checkYears() {
  try {
    console.log('=== CHECKING AVAILABLE YEARS ===')
    
    // Check current database
    const currentYears = await query(`
      SELECT DISTINCT substr(game_id, 1, 4) as year, COUNT(*) as games
      FROM games 
      GROUP BY substr(game_id, 1, 4)
      ORDER BY year
    `, [], { currentOnly: true })
    
    console.log('Current DB years:', currentYears)
    
    // Check history database
    const historyYears = await query(`
      SELECT DISTINCT substr(game_id, 1, 4) as year, COUNT(*) as games
      FROM games 
      GROUP BY substr(game_id, 1, 4)
      ORDER BY year
    `, [], { historyOnly: true })
    
    console.log('History DB years:', historyYears)
    
    // Check test years from golden samples
    const testYears = [2021, 2022, 2023, 2024]
    console.log('\n=== TESTING SPECIFIC YEARS ===')
    
    for (const year of testYears) {
      const gameCount = await query(`
        SELECT COUNT(*) as count FROM games WHERE game_id LIKE ?
      `, [`${year}%`])
      
      console.log(`${year}: ${gameCount[0]?.count || 0} games`)
    }
    
  } catch (error) {
    console.error('Error:', error)
  }
}

checkYears()