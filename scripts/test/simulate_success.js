#!/usr/bin/env node
/**
 * Simulate successful quality gate for testing
 * Creates mock JUnit XML files with all tests passing
 */

const fs = require('fs')
const path = require('path')

// Create successful golden sample XML
const successfulGoldenXml = `<?xml version="1.0" encoding="UTF-8" ?>
<testsuites name="vitest tests" tests="174" failures="0" errors="0" time="2.5">
    <testsuite name="__tests__/golden-sample.test.ts" timestamp="${new Date().toISOString()}" hostname="test-host" tests="174" failures="0" errors="0" skipped="0" time="2.5">
    </testsuite>
</testsuites>`

// Create successful invariants XML
const successfulInvariantsXml = `<?xml version="1.0" encoding="UTF-8" ?>
<testsuites name="vitest tests" tests="12" failures="0" errors="0" time="0.8">
    <testsuite name="__tests__/game-invariants.test.ts" timestamp="${new Date().toISOString()}" hostname="test-host" tests="12" failures="0" errors="0" skipped="0" time="0.8">
    </testsuite>
</testsuites>`

// Ensure directory exists
if (!fs.existsSync('.reports')) {
  fs.mkdirSync('.reports', { recursive: true })
}

// Write successful test files
fs.writeFileSync('.reports/junit-golden.xml', successfulGoldenXml)
fs.writeFileSync('.reports/junit-invariants.xml', successfulInvariantsXml)

console.log('✅ Created mock successful test reports')
console.log('   - .reports/junit-golden.xml (174/174 passed)')
console.log('   - .reports/junit-invariants.xml (12/12 passed)')
console.log()
console.log('🚀 Now running CI simulation with all tests passing...')
console.log()

// Run the fail-open test with successful results
require('./test_failopen.js')