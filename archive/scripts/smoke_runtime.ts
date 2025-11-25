import http from 'node:http'; 
import https from 'node:https'; 

const get = (u:string)=>new Promise<string>((res,rej)=>{
  (u.startsWith('https')?https:http).get(u,(r)=>{
    let d='';
    r.on('data',c=>d+=c);
    r.on('end',()=>res(d));
  }).on('error',rej)
});

const base = process.env.BASE_URL || 'https://baseball-ai-media.vercel.app';
const mustInclude = [
  ['/', '今日の見どころ'],
  ['/compare/teams?teams=T,G,H,C&year=2024&pf=true', '球場補正'],
  ['/teams/2024/T', 'WAR・wRC+・FIP分析'],
];

(async()=>{
  let ok=0; 
  for(const [p,kw] of mustInclude){ 
    const html=await get(base+p); 
    if(html.includes(kw)){
      console.log('OK',p);
    } else {
      console.error('NG',p,'missing',kw);
    } 
    ok++; 
  }
  
  const csv = await get(`${base}/api/export/csv?scope=team_comparison&year=2024&teams=T,G&pf=true`);
  if (csv.startsWith('\uFEFF') && csv.split('\n')[0].includes('wRC_plus_original')) {
    console.log('OK CSV');
  } else {
    console.error('NG CSV header or BOM');
  }
  
  process.exit(0);
})();