const sleep = (ms)=>new Promise(r=>setTimeout(r, ms));
const $ = (q)=>document.querySelector(q);
const tbody = $("#tbody"); const statusChip = $("#status"); const nowEl = $("#now");

const sparkBuffers = new Map(); // gameId -> {xs:number[], ys:number[]}
const MAX_POINTS = 120;         // ~10分ぶん（5s間隔）

function jstNow(){
  const fmt = new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', hour12:false, hour:'2-digit', minute:'2-digit', second:'2-digit' });
  return fmt.format(new Date());
}

function ageClass(sec){
  if (sec <= 10) return "ok";
  if (sec <= 20) return "warn";
  return "bad";
}

function rowId(gameId){ return `row-${gameId}`; }
function sparkId(gameId){ return `spark-${gameId}`; }

function ensureBuffer(gameId){
  if (!sparkBuffers.has(gameId)){
    sparkBuffers.set(gameId, { xs:[], ys:[] });
  }
  return sparkBuffers.get(gameId);
}

function pushPoint(gameId, y){
  const buf = ensureBuffer(gameId);
  const t = Date.now()/1000;
  buf.xs.push(t); buf.ys.push(y);
  if (buf.xs.length > MAX_POINTS){ buf.xs.shift(); buf.ys.shift(); }
  drawSpark(gameId);
}

function drawSpark(gameId){
  const el = document.getElementById(sparkId(gameId));
  if (!el) return;
  const w = el.viewBox.baseVal.width || 120, h = el.viewBox.baseVal.height || 26;
  const buf = ensureBuffer(gameId);
  if (buf.ys.length < 2){ el.innerHTML = ""; return; }
  const xs = buf.xs, ys = buf.ys;
  const xmin = xs[0], xmax = xs[xs.length-1];
  const x = (t)=> ( (t - xmin) / Math.max(1e-6, xmax - xmin) ) * (w-4) + 2;
  const y = (p)=> (1 - p) * (h-6) + 3; // p:0..1 上が高い
  let d = `M ${x(xs[0]).toFixed(2)} ${y(ys[0]).toFixed(2)}`;
  for (let i=1;i<xs.length;i++){
    d += ` L ${x(xs[i]).toFixed(2)} ${y(ys[i]).toFixed(2)}`;
  }
  const lastY = y(ys[ys.length-1]);
  el.innerHTML = `
    <path d="${d}" fill="none" stroke="#60a5fa" stroke-width="1.5" />
    <circle cx="${x(xs[xs.length-1]).toFixed(2)}" cy="${lastY.toFixed(2)}" r="2" fill="#93c5fd"/>
  `;
}

function confClass(conf){
  if (conf === "high") return "conf-high";
  if (conf === "medium") return "conf-medium";
  return "conf-low";
}

function upsertRow(s){
  const id = rowId(s.gameId);
  let tr = document.getElementById(id);
  const score = `${s.homeScore ?? "?"}-${s.awayScore ?? "?"}`;
  const inning = s.inning ? `${s.inning}${s.top ? "▲" : "▼"} ${s.outs ?? 0} Out` : "-";
  const p = (s.p_home ?? 0.5);
  const ageSec = Math.round(s.age ?? 0); // age_seconds -> age

  if (!tr) {
    tr = document.createElement("tr");
    tr.id = id;
    tr.innerHTML = `
      <td class="mono">${s.gameId}</td>
      <td class="mono" data-col="inning">${inning}</td>
      <td class="mono" data-col="score">${score}</td>
      <td class="mono" data-col="p">${(p*100).toFixed(1)}%</td>
      <td data-col="conf"><span class="chip ${confClass(s.conf)}">${s.conf || "-"}</span></td>
      <td class="mono" data-col="age"><span class="age ${ageClass(ageSec)}">${ageSec}s</span></td>
      <td><svg id="${sparkId(s.gameId)}" class="spark" viewBox="0 0 120 26"></svg></td>
    `;
    tbody.appendChild(tr);
  } else {
    tr.querySelector('[data-col="inning"]').textContent = inning;
    tr.querySelector('[data-col="score"]').textContent = score;
    tr.querySelector('[data-col="p"]').textContent = `${(p*100).toFixed(1)}%`;
    const ageEl = tr.querySelector('[data-col="age"] .age');
    ageEl.textContent = `${ageSec}s`;
    ageEl.className = `age ${ageClass(ageSec)}`;
    const confEl = tr.querySelector('[data-col="conf"] .chip');
    confEl.textContent = s.conf || "-";
    confEl.className = `chip ${confClass(s.conf)}`;
  }
  pushPoint(s.gameId, p);
}

async function fetchJSON(url){
  const r = await fetch(url, { headers: { "Accept": "application/json" } });
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
}

async function tick(){
  try {
    const summary = await fetchJSON("/live/summary");
    statusChip.textContent = `Games: ${summary?.total_games ?? 0}`; // summary.games.length -> summary.total_games
    statusChip.style.background = "#0b1220";
    const items = summary?.games ?? []; // summary.items -> summary.games
    if (items.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="color:#94a3b8">No games found for ${summary?.date ?? ""}</td></tr>`;
      return;
    }
    // 直近値が欲しければ、latest?stale=5 を併用（ここでは summary に p_home/age が入っている想定）
    items.forEach(upsertRow);
  } catch (e) {
    statusChip.textContent = "Error";
    statusChip.style.background = "#3b0a0a";
    console.error(e);
  } finally {
    nowEl.textContent = `JST ${jstNow()}`;
  }
}

(async function main(){
  await tick();
  // 5s interval
  setInterval(tick, 5000);
})();