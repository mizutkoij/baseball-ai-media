const fs = require('fs').promises;
const { join } = require('path');

const ROOT = process.cwd();
const IGNORE = /(archive|\.git|node_modules|__pycache__|logs|\.next|public\/data|scripts\/.*\.ps1)[\/\\]/i;
const PATTERNS = [/1point02/i, /1point02\.jp/i, /1\.02(?![0-9])/i]; // Avoid CSS scale values

async function* walk(dir: string): AsyncGenerator<string> {
  try {
    for (const e of await fs.readdir(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (IGNORE.test(p)) continue;
      if (e.isDirectory()) yield* walk(p);
      else yield p;
    }
  } catch (err) {
    // Skip inaccessible directories
  }
}

(async () => {
  const bad: string[] = [];
  for await (const file of walk(ROOT)) {
    try {
      const txt = await fs.readFile(file, 'utf8');
      if (PATTERNS.some(rx => rx.test(txt))) {
        bad.push(file);
      }
    } catch (err) {
      // Skip binary files
    }
  }
  
  if (bad.length) {
    console.error('Forbidden tokens found:\n' + bad.join('\n'));
    process.exit(1);
  }
  console.log('OK: no forbidden tokens');
})();