const base = process.env.BASE_URL!;

(async()=>{
  const url = `${base}/api/compare/teams?year=2024&teams=T,G,H,C&pf=true`;
  
  try {
    const response = await fetch(url);
    const j = await response.json();
    
    // 値が存在・数値である
    const numsOk = j.teams?.every((t:any)=> typeof t.avg_park_factor === 'number') &&
      j.pf_correction === true;
    console.log(numsOk ? 'OK PF values' : 'NG PF values');
    
    // ランクがPF切替で変わるケースが"あるなら"コメントが追随している
    const commentHasPF = j.summary?.includes('PF') || j.summary?.includes('中立');
    console.log(commentHasPF ? 'OK PF comment' : 'WARN PF comment');
    
    // デバッグ情報
    console.log('Teams count:', j.teams?.length || 0);
    console.log('Has summary:', !!j.summary);
    
  } catch (error) {
    console.error('API Error:', error);
  }
})();