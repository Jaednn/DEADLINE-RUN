/* ======================= EXPERIMENT LAB ======================= */
let labTable={headers:[],rows:[]};
const tick=()=>new Promise(r=>setTimeout(r,0));
const ITEMS_POOL=[null,"heal","buff","sp"];
const fmt=(x,d=1)=>Number(x).toFixed(d);
function pickItem(mode,i){return mode==="none"?null:ITEMS_POOL[i%4]}

async function runBattles(cfg,mc,N,itemMode,label){
  let win=0,left=0,mcLeft=0,turns=0,nodes=0,dec=0,ms=0;const acts={attack:0,skill:0,heal:0,defend:0};
  let last=performance.now();
  for(let i=0;i<N;i++){
    const r=simulateBattle(cfg,mc,pickItem(itemMode,i));
    if(r.npcWon)win++;left+=r.npcLeft;mcLeft+=r.mcLeft;turns+=r.turns;nodes+=r.nodes;dec+=r.dec;ms+=r.ms;
    for(const k in acts)acts[k]+=r.acts[k];
    if(performance.now()-last>40){$("labProgress").textContent=`${label}: ${i+1}/${N}`;await tick();last=performance.now()}
  }
  const tot=Object.values(acts).reduce((a,b)=>a+b,0)||1;
  return{winPct:100*win/N,npcLeft:left/N,mcLeft:mcLeft/N,turns:turns/N,nodesDec:nodes/Math.max(1,dec),msDec:ms/Math.max(1,dec),
    pct:k=>100*acts[k]/tot};
}
async function collectStates(count,itemMode){
  const all=[];const cfg={algo:"alphabeta",depth:4,evalKey:"ratio",order:"heuristic",maximizer:"NPC"};
  let last=performance.now();
  for(let i=0;i<count;i++){
    let s=newBattleState(pickItem(itemMode,i)),plies=0;
    while(!isTerminal(s)&&plies<200){
      let a;
      if(s.turn==="NPC"){all.push({...s});a=battleSearch(s,cfg).best}
      else a=mcPolicy(i%2?"greedy":"random",s);
      s=applyAct(s,a);plies++;
    }
    if(performance.now()-last>40){$("labProgress").textContent=`Mengumpulkan state sampel: ${i+1}/${count}`;await tick();last=performance.now()}
  }
  const out=[];const step=Math.max(1,Math.floor(all.length/80));
  for(let i=0;i<all.length&&out.length<80;i+=step)out.push(all[i]);
  return out;
}
async function evalOnStates(cfg,states,label){
  let nodes=0,leaves=0,cut=0,ms=0,oe=0;const scores=[];let last=performance.now();
  for(let i=0;i<states.length;i++){
    const r=battleSearch(states[i],cfg);nodes+=r.nodes;leaves+=r.leaves;cut+=r.cutoffs;ms+=r.ms;oe+=r.orderEvals;scores.push(r.bestScore);
    if(performance.now()-last>40){$("labProgress").textContent=`${label}: ${i+1}/${states.length}`;await tick();last=performance.now()}
  }
  const n=states.length;return{nodes:nodes/n,leaves:leaves/n,cut:cut/n,ms:ms/n,oe:oe/n,scores};
}
function showTable(headers,rows,note){
  labTable={headers,rows};
  $("labResult").innerHTML=`<table><tr>${headers.map(h=>`<th>${h}</th>`).join("")}</tr>${rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join("")}</tr>`).join("")}</table>${note?`<p class="muted" style="font-size:12px">${note}</p>`:""}`;
}
const baseCfg=(o={})=>({algo:"alphabeta",depth:4,evalKey:"resource",order:"heuristic",maximizer:"NPC",...o});

async function runExperiment(){
  const id=$("labExp").value,N=parseInt($("labN").value),mc=$("labMC").value,im=$("labItem").value;
  $("labRun").disabled=true;$("labResult").innerHTML="";const t0=performance.now();
  try{
    if(id==="1"){
      const states=await collectStates(Math.min(N,60),im);const rows=[];
      for(let d=2;d<=8;d++){
        const mm=await evalOnStates(baseCfg({algo:"minimax",depth:d,evalKey:"ratio",order:"fixed"}),states,`Minimax d${d}`);
        const ab=await evalOnStates(baseCfg({algo:"alphabeta",depth:d,evalKey:"ratio",order:"fixed"}),states,`Alpha-Beta d${d}`);
        let same=0;for(let i=0;i<states.length;i++)if(Math.abs(mm.scores[i]-ab.scores[i])<1e-6)same++;
        rows.push([d,"Minimax",fmt(mm.nodes,0),fmt(mm.leaves,0),0,fmt(mm.ms,2),"—"]);
        rows.push([d,"Alpha-Beta",fmt(ab.nodes,0),fmt(ab.leaves,0),fmt(ab.cut,1),fmt(ab.ms,2),`${fmt(100*same/states.length,0)}% (hemat ${fmt(100*(1-ab.nodes/mm.nodes),0)}% node)`]);
      }
      showTable(["Depth","Algoritma","Rata-rata node","Rata-rata daun","Cutoff","ms/keputusan","Skor sama dgn Minimax"],rows,`Sampel ${states.length} state giliran NPC dari simulasi battle. Eval E2, urutan aksi tetap.`);
    }else if(id==="2"||id==="5"){
      const keys=Object.keys(EVALS),rows=[];
      for(const k of keys){
        const r=await runBattles(baseCfg({evalKey:k}),mc,N,im,EVALS[k].name);
        if(id==="2")rows.push([EVALS[k].name,fmt(r.winPct,0)+"%",fmt(r.npcLeft,0),fmt(r.mcLeft,0),fmt(r.turns,1),fmt(r.nodesDec,0),fmt(r.msDec,2)]);
        else rows.push([EVALS[k].name,fmt(r.pct("attack"),0)+"%",fmt(r.pct("skill"),0)+"%",fmt(r.pct("heal"),0)+"%",fmt(r.pct("defend"),0)+"%",fmt(r.turns,1),fmt(r.winPct,0)+"%"]);
      }
      if(id==="2")showTable(["Fungsi evaluasi","NPC menang","HP NPC sisa (rata2)","HP MC sisa (rata2)","Giliran NPC (rata2)","Node/keputusan","ms/keputusan"],rows,`Alpha-Beta depth 4 vs bot MC "${mc}", ${N} battle per baris.`);
      else showTable(["Gaya / evaluasi","Attack","Skill","Heal","Defend","Panjang battle (giliran)","NPC menang"],rows,`Distribusi aksi NPC. Agresif = sering skill/attack; defensif = sering defend/heal & battle lebih panjang. Depth 4 vs "${mc}".`);
    }else if(id==="3"){
      const states=await collectStates(Math.min(N,60),im),rows=[];
      const mm=await evalOnStates(baseCfg({algo:"minimax",depth:6,evalKey:"ratio",order:"fixed"}),states,"Minimax d6");
      rows.push(["(baseline) Minimax tanpa pruning",fmt(mm.nodes,0),"0","—",fmt(mm.ms,2)]);
      for(const o of ["fixed","reverse","heuristic","random"]){
        const r=await evalOnStates(baseCfg({algo:"alphabeta",depth:6,evalKey:"ratio",order:o}),states,`Alpha-Beta ${o}`);
        rows.push([`Alpha-Beta — urutan ${ORDER_NAME[o]}`,fmt(r.nodes,0),fmt(r.cut,1),fmt(r.oe,0),fmt(r.ms,2)]);
      }
      showTable(["Konfigurasi","Rata-rata node","Cutoff","Eval untuk ordering","ms/keputusan"],rows,`Depth 6, E2. Urutan heuristik = best-first via evaluasi 1-ply (biaya eval ordering dilaporkan terpisah).`);
    }else if(id==="4"){
      const rows=[];
      for(let d=1;d<=8;d++){
        const r=await runBattles(baseCfg({depth:d}),mc,Math.min(N,d>=7?Math.max(20,N/2):N),im,`Depth ${d}`);
        rows.push([d,fmt(r.winPct,0)+"%",fmt(r.turns,1),fmt(r.nodesDec,0),fmt(r.msDec,2)]);
      }
      showTable(["Depth (ply)","NPC menang","Giliran NPC (rata2)","Node/keputusan","ms/keputusan"],rows,`Alpha-Beta, E3, urutan heuristik vs bot "${mc}". Depth ≥7 memakai jumlah battle lebih sedikit agar cepat.`);
    }else if(id==="6"){
      const rows=[];
      for(const m of ["prob","greedy","smart"])for(const a of ["alphabeta","expectimax"]){
        const r=await runBattles(baseCfg({algo:a,evalKey:"ratio"}),m,N,im,`${a} vs ${m}`);
        rows.push([ALGO_NAME[a],`MC "${m}"`,fmt(r.winPct,0)+"%",fmt(r.npcLeft,0),fmt(r.mcLeft,0),fmt(r.nodesDec,0),fmt(r.msDec,2)]);
      }
      showTable(["Algoritma NPC","Lawan","NPC menang","HP NPC sisa","HP MC sisa","Node/keputusan","ms/keputusan"],rows,`Depth 4, E2. Expectimax memodelkan MC sebagai chance node (basic .25 / E .30 / Q .35 / item .10); bot "prob" bermain persis seperti model itu.`);
    }
    $("labProgress").textContent=`Selesai dalam ${((performance.now()-t0)/1000).toFixed(1)} detik.`;
  }catch(e){$("labProgress").textContent="Error: "+e.message;console.error(e)}
  $("labRun").disabled=false;
}
function labCsv(){const esc=v=>`"${String(v).replace(/<[^>]+>/g,"").replace(/"/g,'""')}"`;return [labTable.headers,...labTable.rows].map(r=>r.map(esc).join(",")).join("\n")}
function labCopy(){
  const csv=labCsv(),ta=$("labCsv");ta.value=csv;ta.style.display="block";ta.select();
  try{navigator.clipboard.writeText(csv).then(()=>$("labProgress").textContent="CSV disalin.").catch(()=>document.execCommand("copy"))}catch(e){try{document.execCommand("copy")}catch(_){}}
}
function labDownload(){
  const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([labCsv()],{type:"text/csv"}));
  a.download="hasil_eksperimen_minimax.csv";document.body.appendChild(a);a.click();a.remove();
}

