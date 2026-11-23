/* =====================================================================
   TAHAP 3 — integrasi ke game, debug overlay, Experiment Lab
   ===================================================================== */
const R3={cfg:null,P:null,S:[],cs:null,ls:null,pStar:.5,stage:1,hist:[],squad:null,wave:0,plans:0,seed:1,planMs:0,
  ui:{alg:"hcs",cool:.95,N:20,joint:false,sel:"mrv_degree",ord:"static",inf:"fc",maxE:120,side:100,bud:"auto"},trace:[]};
function targetP(){
  let p={3:.5,2:.6,1:.7}[lives]??.5;const h=R3.hist,l=h[h.length-1];
  if(l&&l.won&&l.mcLeft/B.MC_HP>.6)p-=.05;
  if(h.length>=2&&!h[h.length-1].won&&!h[h.length-2].won)p+=.05;
  return Math.min(.8,Math.max(.3,+p.toFixed(2)))}
function runPlanner(fresh){
  const u=R3.ui,t0=performance.now();if(fresh)R3.seed=1+Math.floor(Math.random()*99999);
  const stage=Math.min(3,wins+1),bud=u.bud==="auto"?BUDGET[stage]:u.bud==="rancangan"?BUDGET_DESAIN[stage]:u.bud,P=makeCSP({budget:bud,wins,slots:3});
  const tr=[],cs=cspSolve(P,{select:u.sel,order:u.ord,inference:u.inf,all:true,trace:tr});R3.trace=tr;
  Object.assign(R3,{P,cs,S:cs.sols,stage,pStar:targetP(),plans:R3.plans+1});
  if(!cs.sols.length){R3.cfg=null;R3.ls=null}
  else{const ctx=newCtx(player.item,777);R3.ls=runLS(P,cs.sols,{alg:u.alg,cooling:u.cool,N:u.N,joint:u.joint,side:u.side,pStar:R3.pStar,seed:R3.seed,maxEvals:u.maxE,tlimit:Math.max(200,PLAN_LIMIT_MS-(performance.now()-t0))},ctx);R3.cfg=R3.ls.best}
  R3.planMs=performance.now()-t0;renderP3();
  toast(R3.cfg?`Squad musuh: ${squadStr(squadOf(P,R3.cfg))}${R3.ls&&R3.ls.timeout?" (belum optimal: batas waktu)":""}`:"Planner: tidak ada konfigurasi legal (budget terlalu ketat)")}

/* ---------- hook ke alur game ---------- */
const _sb=startBattle;
startBattle=function(test){
  if(mode==="battle")return;
  R3.wave=0;R3.squad=R3.cfg?squadOf(R3.P,R3.cfg):[{c:"T",it:null}];
  waveB(R3.squad[0].c,R3.squad[0].it);_sb(test);
  if(bs&&R3.squad[0].it==="Contekan")bs.def=true;
  logLine(`Squad: ${squadStr(R3.squad)}`,"lg-sys");renderBattle()};
const _rb=renderBattle;
renderBattle=function(){_rb();const q=R3.squad&&R3.squad[R3.wave];if(!q)return;
  const nm=document.querySelector("#bNPC .b-name");if(nm)nm.textContent=`${CH[q.c].n} · gel. ${R3.wave+1}/${R3.squad.length}`;
  if(q.it)$("bNpcTags").insertAdjacentHTML("beforeend",`<span class="tag2">Item: ${q.it}</span>`)};
function nextWave(){
  const prev=bs;R3.wave++;const q=R3.squad[R3.wave];waveB(q.c,q.it);
  const n=newBattleState(prev.item);n.mc=Math.min(B.MC_HP,prev.mc+WAVE_REC.hp);n.sp=Math.min(B.SP_MAX,prev.sp+WAVE_REC.sp);n.buff=prev.buff;n.def=q.it==="Contekan";
  bs=n;bBusy=true;
  const u=unitEl("NPC");u.classList.remove("ko","hit","pulse");spriteEl("NPC").style.animation="";u.querySelectorAll(".fx").forEach(e=>e.remove());poseIdle("NPC");cineClear();
  logLine(`Gelombang ${R3.wave+1}: ${CH[q.c].n}${q.it?" membawa "+q.it:""}! (MC +${WAVE_REC.hp} HP, +${WAVE_REC.sp} SP)`,"lg-sys");
  renderBattle();screenFx("f-white");setTimeout(npcTurn,900)}
const _fin=finishBattle;
finishBattle=function(){
  if(R3.squad&&bs.npc<=0&&bs.mc>0&&R3.wave+1<R3.squad.length)return nextWave();
  if(!bTest&&R3.squad)R3.hist.push({stage:R3.stage,sq:squadStr(R3.squad),pStar:R3.pStar,ph:R3.ls?R3.ls.bestR.p:null,won:bs.npc<=0,mcLeft:Math.max(0,bs.mc),turns:bTurns});
  _fin();renderP3()};
const _cab=continueAfterBattle;
continueAfterBattle=function(){waveB("T",null);R3.squad=null;_cab()};
$("bContinue").onclick=continueAfterBattle;
const _rn=respawnNPCFar;
respawnNPCFar=function(){_rn();setTimeout(()=>runPlanner(true),30)};
const doReset=()=>{reset();R3.hist=[];R3.cfg=null;setTimeout(()=>runPlanner(true),30)};
$("restart").onclick=doReset;$("again").onclick=doReset;
const _rd=render;
render=function(){_rd();
  if(R3.cfg&&mode==="explore"&&(graceMs>0||$("pop3").classList.contains("show"))){
    ctx.save();ctx.font="bold 9px sans-serif";ctx.textAlign="center";ctx.lineWidth=3;ctx.strokeStyle="#000";ctx.fillStyle="#ffe27a";
    const t=squadStr(squadOf(R3.P,R3.cfg)),x=npc.x*TILE+8,y=npc.y*TILE-22;ctx.strokeText(t,x,y);ctx.fillText(t,x,y);ctx.restore()}};

/* ---------- Debug overlay Tahap 3 ---------- */
const f2=x=>(+x).toFixed(3),pc=x=>Math.round(100*(x||0))+"%";
function traceHTML(tr){
  if(!tr||!tr.length)return'<div class="muted">Tidak ada langkah tercatat.</div>';
  return`<table><tr><th>#</th><th>Variabel (alasan)</th><th>Nilai</th><th>Urutan nilai (LCV)</th><th>Dihapus FC / AC-3 / budget</th><th>Hasil</th></tr>${tr.map((t,i)=>`<tr><td>${i+1}</td><td>${t.X} <span class="muted">(${t.why})</span></td><td>${t.x}</td><td>${t.ord||"statis"}</td><td>${t.removed.length?`<span style="color:#ef5a52">${t.removed.slice(0,8).join(", ")}${t.removed.length>8?` +${t.removed.length-8}`:""}</span>`:"—"}</td><td>${t.alive?"lanjut":"<b style='color:#ef5a52'>domain kosong → mundur</b>"}</td></tr>`).join("")}</table>`}
function nbHTML(P,nb,mc){
  if(mc)return"";
  if(!nb)return'<div class="muted">Tabel neighbour tidak berlaku untuk simulated annealing (1 neighbour acak per langkah; lihat kolom keputusan).</div>';
  const diff=(a,b)=>P.vars.map((v,k)=>a[k]!==b[k]?`${v}: ${a[k]}→${b[k]}`:null).filter(Boolean).join(", ");
  const L=nb.rows.slice(0,8),I=nb.ill.slice(0,6);
  return`<details open><summary>Neighbour pada langkah terakhir (dari ${squadStr(squadOf(P,nb.cur))}): ${nb.rows.length} legal dievaluasi, ${nb.ill.length} ilegal dibuang</summary>
  <table><tr><th>Perubahan</th><th>Squad</th><th>Status</th><th>f</th><th>p̂</th></tr>
  ${L.map((r,i)=>`<tr${i===0?' style="color:#70d18a"':''}><td>${diff(nb.cur,r.cfg)}</td><td>${squadStr(squadOf(P,r.cfg))}</td><td>legal</td><td>${f2(r.f)}</td><td>${r.p.toFixed(2)}</td></tr>`).join("")}
  ${I.map(t=>`<tr style="color:#ef5a52"><td>${P.vars[t[1]]}: ${t[3]}→${t[2]}</td><td>—</td><td>ilegal</td><td>—</td><td>—</td></tr>`).join("")}</table>
  <div class="muted">Hanya 8 legal terbaik dan 6 ilegal pertama yang ditampilkan.</div></details>`}
function xdcHTML(P){
  const FULL=v=>v[0]==="c"?[NONE,...Object.keys(CH)]:[NONE,...Object.keys(IT)];
  const rows=P.vars.map(v=>`<tr><td>${v}</td><td>{${FULL(v).map(x=>P.dom0[v].includes(x)?x:`<s style="color:#ef5a52" title="dihapus constraint unary">${x}</s>`).join(", ")}}</td></tr>`).join("");
  return `<table><tr><th>X</th><th>D (merah tercoret = dihapus unary C1–C2)</th></tr>${rows}</table>
  <table><tr><th>C</th><th>Jenis</th><th>Isi</th></tr>
  <tr><td>C1</td><td>unary</td><td>c0 ≠ ∅</td></tr><tr><td>C2</td><td>unary</td><td>B dihapus jika kemenangan &lt; 2</td></tr>
  <tr><td>C3-4</td><td>binary</td><td>item_i ≠ ∅ → char_i ≠ ∅; tabel kecocokan (char_i, item_i)</td></tr>
  <tr><td>C5</td><td>binary</td><td>char_i = ∅ → char_i+1 = ∅ (pemecah simetri)</td></tr>
  <tr><td>C6</td><td>binary</td><td>D dan R tidak bersama</td></tr>
  <tr><td>C7</td><td>global</td><td>AllDifferent-kecuali-∅ pada item (didekomposisi pairwise)</td></tr>
  <tr><td>C8</td><td>global</td><td>AtMost(1) boss (didekomposisi pairwise)</td></tr>
  <tr><td>C9</td><td>global</td><td>${P.bmin} ≤ Σ cost ≤ ${P.bmax} (dipangkas lewat batas min/maks domain)</td></tr></table>`}
function sparkHTML(h){
  if(!h||h.length<2)return"";const W=300,H=46,mx=Math.max(...h.map(a=>a[0]))||1,my=Math.max(...h.map(a=>a[1]),.01);
  const pts=h.map(a=>`${(a[0]/mx*W).toFixed(1)},${(H-a[1]/my*(H-4)-2).toFixed(1)}`).join(" ");
  return`<svg width="${W}" height="${H}" style="background:#0b1015;border-radius:6px"><polyline points="${pts}" fill="none" stroke="#ffd34e" stroke-width="2"/></svg><div class="muted">f terbaik (sumbu y, maks ${f2(my)}) terhadap evaluasi (sumbu x)</div>`}
function renderP3(){
  const el=$("p3out");if(!el||!R3.P)return;const P=R3.P,cs=R3.cs.st,ls=R3.ls;
  let h=`<div class="cnt">Battle ke-${R3.stage} · budget ${P.bmin}–${P.bmax} · target p* = <b>${R3.pStar}</b> · planning ${R3.planMs.toFixed(0)} ms</div>
  <h3 class="sec">CSP — backtracking</h3>
  <div class="cnt">Assignment dicoba <b>${cs.assignments}</b> · backtrack <b>${cs.backtracks}</b> · checks <b>${cs.checks}</b> · waktu <b>${cs.time.toFixed(1)} ms</b> · |S| = <b>${R3.S.length}</b>
  ${R3.S.length?"":" — <b style='color:#ef5a52'>tidak ada solusi (terbukti: search selesai tanpa batas)</b>"}</div>
  ${R3.S.length?`<div class="cnt">Konfigurasi pertama di S: <b>${squadStr(squadOf(P,R3.S[0]))}</b> (dicapai pada assignment ke-${cs.firstAt}) · status: ${R3.cs.done?"search selesai":"batas tercapai, hasil belum diketahui"}</div>`:""}
  <details><summary>Definisi X, D, C</summary>${xdcHTML(P)}</details>
  <details><summary>Langkah backtracking (${(R3.trace||[]).length} pertama)</summary>${traceHTML(R3.trace)}</details>`;
  if(ls){
    const sq=squadStr(squadOf(P,ls.best));
    h+=`<h3 class="sec">Local search</h3>
    <div class="cnt">Terbaik: <b>${sq}</b><br>f = <b>${f2(ls.bestF)}</b> · p̂ = <b>${ls.bestR.p.toFixed(2)}</b> · giliran NPC rata-rata ${ls.bestR.T.toFixed(1)} · ${ls.ok?"<b style='color:#70d18a'>target tercapai</b>":"<b style='color:#ffb13d'>target belum tercapai</b>"}</div>
    <div class="cnt">Step <b>${ls.steps}</b> · evaluasi <b>${ls.evals}</b> (${ls.calls} panggilan, sisanya cache) · simulasi <b>${ls.sims}</b> · node minimax <b>${ls.nodes}</b>${ls.restarts?` · restart <b>${ls.restarts}</b>`:""}</div>
    <div class="cnt">Bosan <b>${pc(ls.bestR.bo)}</b> · frustasi <b>${pc(ls.bestR.fr)}</b> <span class="muted">(dari simulasi; definisi rancangan §8)</span></div>
    ${ls.timeout?`<div class="cnt" style="color:#ffb13d"><b>⏱ Batas waktu planning ${PLAN_LIMIT_MS/1000} dtk tercapai</b> — memakai konfigurasi terbaik sementara (belum optimal).</div>`:""}
    ${ls.mc?`<div class="cnt">Min-Conflicts: <b>${ls.mc.ok}/${ls.mc.tries}</b> percobaan berakhir legal · langkah <b>${ls.mc.steps}</b> · checks <b>${ls.mc.checks}</b>. Min-Conflicts hanya memenuhi constraint (tidak mengoptimalkan f); konfigurasi legal yang ditemukan lalu dievaluasi.</div>`:""}
    <div class="cnt">Failure mode: <b>${ls.fm||"—"}</b></div>${sparkHTML(ls.hist)}${nbHTML(P,ls.nb,ls.mc)}
    <table><tr><th>#</th><th>Konfigurasi</th><th>f</th><th>p̂</th><th>Keputusan</th></tr>${ls.trace.slice(-12).map(t=>`<tr><td>${t.step}</td><td>${squadStr(squadOf(P,t.cfg))}</td><td>${f2(t.f)}</td><td>${t.p.toFixed(2)}</td><td>${t.msg}${t.T!==undefined?`<br><span class="muted">T=${t.T.toFixed(3)} ΔE=${f2(t.dE)} p=${t.pa.toFixed(3)} u=${t.u===null?"—":t.u.toFixed(3)}</span>`:""}</td></tr>`).join("")}</table>`}
  const H=R3.hist;
  if(H.length)h+=`<h3 class="sec">Prediksi vs hasil nyata</h3><table><tr><th>#</th><th>Squad</th><th>p*</th><th>p̂</th><th>Hasil</th><th>HP MC</th></tr>${H.map((x,i)=>`<tr><td>${i+1}</td><td>${x.sq}</td><td>${x.pStar}</td><td>${x.ph===null?"—":x.ph.toFixed(2)}</td><td>${x.won?"menang":"kalah"}</td><td>${x.mcLeft}</td></tr>`).join("")}</table>`;
  el.innerHTML=h}
function bindP3(){
  const m={p3alg:"alg",p3cool:"cool",p3N:"N",p3sel:"sel",p3ord:"ord",p3inf:"inf",p3maxE:"maxE",p3side:"side",p3bud:"bud"};
  for(const id in m)$(id).onchange=e=>{const v=e.target.value;R3.ui[m[id]]=isNaN(+v)?v:+v};
  $("p3joint").onchange=e=>R3.ui.joint=e.target.checked;
  $("p3new").onclick=()=>runPlanner(true);$("p3same").onclick=()=>runPlanner(false);
  $("openD3").onclick=()=>$("pop3").classList.toggle("show");$("pop3x").onclick=()=>$("pop3").classList.remove("show");
  window.addEventListener("keydown",e=>{if(started&&e.key.toLowerCase()==="p"&&!e.ctrlKey&&!e.metaKey&&!e.altKey){$("pop3").classList.toggle("show")}})}
bindP3();
