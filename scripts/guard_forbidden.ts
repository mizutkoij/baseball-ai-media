const fs = require('fs').promises;
const path = require('path');

const ROOT = process.cwd();
// 明示スキャン対象（アクティブソースコード中心）
const SCAN_DIRS = ['app','components','lib','adapters','adaptersfarm','pages','data'];
const PATTERNS = [
  /1point02\.jp/i,
  /\b1point02\b/i,
  /(?<!scale-\[)(?<!pf > |pf < )1\.02(?![0-9\]])/i, // CSS scale-[1.02] & PF値比較を除外
];

async function* walkSourceDirs(): AsyncGenerator<string> {
  for (const dir of SCAN_DIRS) {
    const fullPath = path.join(ROOT, dir);
    try {
      yield* walk(fullPath);
    } catch (err) {
      // Skip missing directories
    }
  }
}

async function* walk(dir: string): AsyncGenerator<string> {
  try {
    for (const e of await fs.readdir(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.name.startsWith('.') || e.name === 'node_modules') continue;
      if (e.isDirectory()) yield* walk(p);
      else yield p;
    }
  } catch (err) {
    // Skip inaccessible directories
  }
}

(async () => {
  const bad: { file: string; line: number; content: string }[] = [];
  
  for await (const file of walkSourceDirs()) {
    try {
      const txt = await fs.readFile(file, 'utf8');
      const lines = txt.split('\n');
      
      lines.forEach((line: string, index: number) => {
        // Skip intentional blocklist references in provenance.ts
        if (file.includes('provenance.ts') && (line.includes('blockedSources') || line.includes('"1point02",'))) {
          return;
        }
        
        for (const pattern of PATTERNS) {
          if (pattern.test(line)) {
            bad.push({
              file: path.relative(ROOT, file),
              line: index + 1,
              content: line.trim()
            });
            break;
          }
        }
      });
    } catch (err) {
      // Skip binary files
    }
  }
  
  if (bad.length) {
    console.error('Forbidden tokens found in source:');
    bad.forEach(({ file, line, content }) => {
      console.error(`${file}:${line}: ${content}`);
    });
    process.exit(1);
  }
  console.log('OK: no forbidden tokens in source.');
})();