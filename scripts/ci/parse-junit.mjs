import fs from 'node:fs';

const file = process.argv[2] || '.reports/junit-golden.xml';
if (!fs.existsSync(file)) {
  console.error(`❌ JUnit not found: ${file}`);
  process.exit(1);
}

const xml = fs.readFileSync(file, 'utf8');

// Simple regex parsing for JUnit XML attributes
const testsMatch = xml.match(/tests="(\d+)"/);
const failuresMatch = xml.match(/failures="(\d+)"/);
const errorsMatch = xml.match(/errors="(\d+)"/);

const total = testsMatch ? Number(testsMatch[1]) : 0;
const failures = failuresMatch ? Number(failuresMatch[1]) : 0;
const errors = errorsMatch ? Number(errorsMatch[1]) : 0;

console.log(`🧪 Golden Sample: tests=${total} failures=${failures} errors=${errors}`);
if ((failures + errors) === 0) {
  console.log('✅ All tests passed');
  process.exit(0);
} else {
  console.log('❌ Tests failed');
  process.exit(1);
}