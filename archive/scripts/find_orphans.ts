import { createHash } from 'crypto'; 
import { readdirSync, statSync, readFileSync } from 'fs'; 
import { join } from 'path';

const roots = [ 'C:/Users/mizut/baseball-ai-media', 'C:/Users/mizut/baseball-dataset' ];
const exts = new Set(['.ts','.tsx','.py','.md','.json','.sql','.db']);
const map = new Map<string,string[]>();

function walk(dir:string){ 
  try {
    for(const e of readdirSync(dir)){ 
      const p = join(dir,e); 
      const st=statSync(p); 
      if(st.isDirectory()){ 
        if(!/node_modules|\.git|\.next|__pycache__|logs/.test(p)) walk(p); 
      } else { 
        const m = p.match(/\.[a-z0-9]+$/i); 
        if(!m || !exts.has(m[0])) continue; 
        const buf = readFileSync(p); 
        const h = createHash('sha256').update(buf).digest('hex'); 
        const arr = map.get(h)||[]; 
        arr.push(p); 
        map.set(h,arr); 
      } 
    }
  } catch (error) {
    console.warn('Skip directory:', dir, error.message);
  }
}

for(const r of roots) {
  console.log('Scanning:', r);
  walk(r);
}

console.log('\n=== DUPLICATE FILES ===');
for(const [h,paths] of map.entries()){ 
  if(paths.length>1) { 
    console.log('DUP',h.slice(0,8),'\n ',paths.join('\n '),'\n'); 
  } 
}