/* ---------- AI debug overlay ---------- */
const ALGO_NAME={minimax:"Minimax",alphabeta:"Alpha-Beta",expectimax:"Expectimax"};
const ORDER_NAME={fixed:"tetap",reverse:"dibalik",heuristic:"heuristik",random:"acak"};
function stateLine(s){return `MC ${s.mc} HP · SP ${s.sp} · buff ${s.buff} · item ${s.item||"—"} | Villain ${s.npc} HP · CD ${s.cd} · heal ${s.healsLeft} · def ${s.def?"ya":"tidak"}`}
function showDebug(r,cfg,state){
  lastDbg={state,cfg};
  const rows=r.scores.slice().sort((a,b)=>b.score-a.score).map(o=>{
    const best=o.action===r.best;
    const sc=o.exact?o.score.toFixed(1):`≤ ${o.score.toFixed(1)} <span class="muted">(dipangkas)</span>`;
    return `<tr class="${best?"best":""}"><td>${best?"✔ ":""}${ACTION_LABEL[o.action]}</td><td>${sc}</td><td>${best?"dipilih":""}</td></tr>`;
  }).join("");
  $("aiDebug").innerHTML=`<h3>AI DEBUG — Keputusan Anomali Tugas</h3>
  <div class="cfg">${ALGO_NAME[cfg.algo]} · depth ${cfg.depth} · ${EVALS[cfg.evalKey].name} · urutan ${ORDER_NAME[cfg.order]}</div>
  <div class="muted" style="margin-bottom:4px">${stateLine(state)}</div>
  <table><tr><th>Aksi yang dipertimbangkan NPC</th><th>Skor (minimax value)</th><th></th></tr>${rows}</table>
  <div class="cnt">Node dikunjungi: <b>${r.nodes}</b> · Daun/evaluasi: <b>${r.leaves}</b> · Cutoff pruning: <b>${r.cutoffs}</b> · Eval ordering: <b>${r.orderEvals}</b> · Waktu: <b>${r.ms.toFixed(2)} ms</b></div>
  <button class="mini" id="cmpBtn">Bandingkan algoritma pada state ini</button><div id="cmpOut"></div>`;
}
function compareOnState(){
  const base=lastDbg?lastDbg.state:newBattleState(null),cfg0=lastDbg?lastDbg.cfg:aiCfg();
  const st={...base,turn:"NPC"};
  const variants=[
    ["Minimax",{...cfg0,algo:"minimax",order:"fixed"}],
    ["Alpha-Beta (urutan tetap)",{...cfg0,algo:"alphabeta",order:"fixed"}],
    ["Alpha-Beta (urutan heuristik)",{...cfg0,algo:"alphabeta",order:"heuristic"}],
    ["Expectimax",{...cfg0,algo:"expectimax",order:"fixed"}]
  ];
  const rows=variants.map(([n,c])=>{const r=battleSearch(st,c);return `<tr><td>${n}</td><td>${r.nodes}</td><td>${r.leaves}</td><td>${r.cutoffs}</td><td>${r.ms.toFixed(2)}</td><td>${ACTION_LABEL[r.best]}</td><td>${r.bestScore.toFixed(1)}</td></tr>`}).join("");
  $("cmpOut").innerHTML=`<table><tr><th>Varian (depth ${cfg0.depth}, ${EVALS[cfg0.evalKey].name})</th><th>Node</th><th>Daun</th><th>Cutoff</th><th>ms</th><th>Aksi terbaik</th><th>Skor</th></tr>${rows}</table>`;
}

