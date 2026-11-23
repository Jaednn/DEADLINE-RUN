/* ---------- Experiment Lab Tahap 3 ---------- */
const tbl=(head,rows)=>`<table><tr>${head.map(x=>`<th>${x}</th>`).join("")}</tr>${rows.map(r=>`<tr>${r.map(x=>`<td>${x}</td>`).join("")}</tr>`).join("")}</table>`;
const avg=a=>a.reduce((x,y)=>x+y,0)/(a.length||1);
async function runLab3(){
  const id=$("l3Exp").value,slots=+$("l3Slots").value,bud=+$("l3Bud").value,K=+$("l3K").value,pS=+$("l3P").value;
  const prog=t=>$("l3Prog").textContent=t,tick=()=>new Promise(r=>setTimeout(r,0));
  const mk=(b=bud,sym=true,sl=slots)=>makeCSP({budget:b,wins:2,slots:sl,sym});
  const SOLV=[["backtracking","static","static","none"],["MRV","mrv","static","none"],["MRV + degree","mrv_degree","static","none"],["MRV + degree + FC","mrv_degree","static","fc"],["+ LCV","mrv_degree","lcv","fc"],["MRV + degree + MAC","mrv_degree","static","mac"]];
  const LIMIT=300000,lim=r=>r.st.limit?" (batas)":"";
  let head=[],rows=[],note="";$("l3Res").innerHTML="";$("l3Btn").disabled=true;
  try{
  if(id==="E1"){head=["solver","|S|","assignment","backtrack","checks","ms (median 3)","assignment solusi pertama"];
    for(const[n,s,o,i]of SOLV){prog(n);await tick();const P=mk(),ms=[];let r;for(let k=0;k<3;k++){r=cspSolve(P,{select:s,order:o,inference:i,all:true,limit:LIMIT});ms.push(r.st.time)}
      const f=cspSolve(P,{select:s,order:o,inference:i,all:false,limit:LIMIT});ms.sort((a,b)=>a-b);
      rows.push([n,r.sols.length+lim(r),r.st.assignments,r.st.backtracks,r.st.checks,ms[1].toFixed(1),f.st.assignments+lim(f)])}
    note=`Instance: ${slots} slot, budget ${bud}. |S| harus sama untuk semua solver (uji kebenaran); batas ${LIMIT} assignment → hasil belum diketahui.`}
  else if(id==="E2"){head=["budget","|S|","checks","status"];
    for(let b=1;b<=14;b++){prog("budget "+b);await tick();const r=cspSolve(mk(b),{select:"mrv_degree",inference:"fc",all:true});rows.push([b,r.sols.length,r.st.checks,r.sols.length?"ada solusi":"tidak ada solusi (terbukti, search selesai)"])}}
  else if(id==="E3"){head=["C5 (simetri)","solver","|S|","assignment","backtrack","checks"];
    for(const sym of[true,false])for(const[n,s,o,i]of[SOLV[0],SOLV[3]]){prog(n);await tick();const r=cspSolve(mk(bud,sym),{select:s,order:o,inference:i,all:true,limit:LIMIT});rows.push([sym?"hidup":"mati",n,r.sols.length+lim(r),r.st.assignments,r.st.backtracks,r.st.checks])}}
  else if(id==="E4"){head=["slot","solver","|S|","assignment","checks","ms","status"];
    for(const sl of[3,4,5])for(const[n,s,o,i]of[SOLV[0],SOLV[3],SOLV[5]]){prog(`${sl} slot · ${n}`);await tick();const r=cspSolve(mk(bud,true,sl),{select:s,order:o,inference:i,all:true,limit:LIMIT});rows.push([sl,n,r.sols.length,r.st.assignments,r.st.checks,r.st.time.toFixed(1),r.st.limit?"batas tercapai (belum diketahui)":"selesai"])}}
  else if(id==="E11"){
    head=["bot MC","tetap [T,T]: p̂","bosan / frustasi","planner: p̂","bosan / frustasi","zona sehat (tetap → planner)","giliran (tetap → planner)","squad planner"];
    const P=mk(),S=cspSolve(P,{select:"mrv_degree",inference:"fc",all:true}).sols;
    const ls=runLS(P,S,{alg:"sa",cooling:.95,pStar:pS,N:20,seed:1,maxEvals:150},newCtx(null));
    const fixed=P.vars.map((v,k)=>k===0||k===1?"T":NONE);
    const pcn=x=>Math.round(100*x)+"%",zone=r=>(r.p>=0.4&&r.p<=0.7&&r.bo<0.2&&r.fr<0.2)?"ya":"tidak";
    for(const bot of["greedy","prob","random",null]){const nm=bot||"campuran 40/40/20";prog(nm);await tick();const c=newCtx(null,31337),a=evalCfg(P,fixed,pS,40,c,bot),b=evalCfg(P,ls.best,pS,40,c,bot);
      rows.push([nm,a.p.toFixed(2),`${pcn(a.bo)} / ${pcn(a.fr)}`,b.p.toFixed(2),`${pcn(b.bo)} / ${pcn(b.fr)}`,`${zone(a)} → ${zone(b)}`,`${a.T.toFixed(1)} → ${b.T.toFixed(1)}`,squadStr(squadOf(P,ls.best))])}
    note=`Seed evaluasi baru (31337), N = 40, target p* = ${pS}. Planner dioptimasi pada campuran bot, lalu diuji per bot. Bosan = MC menang dengan sisa HP > 70% atau battle < 4 giliran NPC; frustasi = MC kalah saat NPC pertama masih > 80% HP. Zona sehat = 0,40 ≤ p̂ ≤ 0,70 dan bosan &amp; frustasi masing-masing < 20% (asumsi awal rancangan §8, di sini dihitung untuk semua bot).`}
  else if(id==="E5"){
    head=["budget maks","backtracking + FC","noise MC","berhasil","rata-rata langkah","rata-rata checks","pengamatan"];
    for(const b of[14,10,7,5,4,3,2,1]){
      const P=mk(b),r=cspSolve(P,{select:"mrv_degree",inference:"fc",all:true,limit:LIMIT});
      const bt=r.sols.length?`${r.sols.length} solusi · ${r.st.checks} checks`:r.st.limit?"belum diketahui (batas)":`0 solusi TERBUKTI · ${r.st.checks} checks`;
      for(const ns of[0,0.1]){prog(`budget ${b} · noise ${ns}`);await tick();
        let ok=0,st=0,ck=0;for(let k=0;k<K;k++){const m=mcSolve(P,{seed:500+k,noise:ns,maxSteps:600});if(m.ok){ok++;st+=m.steps;ck+=m.checks}}
        rows.push([b,bt,ns,`${ok}/${K} (${Math.round(100*ok/K)}%)`,ok?(st/ok).toFixed(1):"—",ok?Math.round(ck/ok):"—",
          !r.sols.length?"MC gagal tanpa bukti ketiadaan solusi":ok<K?`MC gagal ${K-ok}x padahal solusi ada`:"MC selalu berhasil"])}}
    note=`${slots} slot · MC maks 600 langkah · ${K} run per baris (seed 500+k). “checks” MC = pemeriksaan constraint pada penghitungan konflik, satuan yang sama dengan checks backtracking. Backtracking membuktikan ketiadaan solusi; Min-Conflicts hanya gagal.`}
  else if(id==="E9"){
    head=["desain","berhasil","step","evaluasi","node (ribu)","akhir legal","pelanggaran akhir (rata-rata)","biaya CSP (checks)"];
    const P=mk(),c0=cspSolve(P,{select:"mrv_degree",inference:"fc",all:true}),S=c0.sols;
    if(!S.length){$("l3Res").innerHTML="<p>CSP tidak punya solusi pada budget ini (terbukti).</p>";return}
    for(const pen of[false,true]){const R=[];
      for(let sd=1;sd<=K;sd++){prog(`${pen?"penalti":"pipeline"} · run ${sd}/${K}`);await tick();R.push(runLS(P,S,{alg:"hcs",pStar:pS,N:20,seed:sd,maxEvals:200,penalty:pen},newCtx(null)))}
      rows.push([pen?"Desain 2: penalti di ruang penuh":"Desain 1: pipeline (CSP → LS)",(100*R.filter(r=>r.ok).length/K).toFixed(0)+"%",avg(R.map(r=>r.steps)).toFixed(1),avg(R.map(r=>r.evals)).toFixed(1),(avg(R.map(r=>r.nodes))/1000).toFixed(0),
        (100*R.filter(r=>legalCfg(P,r.best)).length/K).toFixed(0)+"%",avg(R.map(r=>violations(P,r.best))).toFixed(2),pen?"0 (tanpa CSP)":c0.st.checks])}
    const sp=P.vars.reduce((a,v)=>a*P.dom0[v].length,1);
    note=`|S| = ${S.length} · ruang desain 2 = ${sp} konfigurasi · ${K} run per baris · anggaran 200 evaluasi · sideways 100 · penalti = ${PEN_W} × (pasangan constraint dilanggar + selisih budget). Move gabungan tidak relevan di desain 2 karena semua move tunggal boleh.`}
  else if(id==="E10"){
    head=["skala","metode","berhasil","evaluasi","f terbaik (rata-rata)","f* pembanding","selisih","run mencapai f*"];
    const M=[["steepest-ascent",{alg:"hc"}],["+ sideways (100)",{alg:"hcs"}],["random restart",{alg:"rr"}],["simulated annealing (0,95)",{alg:"sa",cooling:.95}]];
    for(const sl of[slots,slots+1].filter(x=>x<=5)){
      const bs=bud+3*(sl-slots),P=mk(bs,true,sl),c0=cspSolve(P,{select:"mrv_degree",inference:"fc",all:true,limit:LIMIT}),S=c0.sols;
      if(!S.length||c0.st.limit){rows.push([`${sl} slot, budget ${bs}`,"—","—","—","—","—","—",S.length?"CSP kena batas":"S kosong"]);continue}
      const res=[];
      for(const[nm,ex]of M){const R=[];
        for(let sd=1;sd<=K;sd++){prog(`${sl} slot · ${nm} · run ${sd}/${K}`);await tick();R.push(runLS(P,S,Object.assign({alg:"hcs",pStar:pS,N:20,seed:sd,maxEvals:100},ex),newCtx(null)))}
        res.push([nm,R])}
      let fs=1e9,exact=false;
      if(S.length<=EXH_CAP){prog(`${sl} slot · exhaustive (${S.length} konfigurasi)`);await tick();const c=newCtx(null);for(const x of S){const r=evalCfg(P,x,pS,20,c);if(r.f<fs)fs=r.f}exact=true}
      else for(const[,R]of res)for(const r of R)fs=Math.min(fs,r.bestF);
      for(const[nm,R]of res){const af=avg(R.map(r=>r.bestF));
        rows.push([`${sl} slot, budget ${bs} (|S|=${S.length})`,nm,(100*R.filter(r=>r.ok).length/K).toFixed(0)+"%",avg(R.map(r=>r.evals)).toFixed(1),f2(af),f2(fs)+(exact?" (exhaustive)":" (terbaik ditemukan)"),f2(Math.max(0,af-fs)),`${R.filter(r=>r.bestF<=fs+1e-9).length}/${K}`])}}
    note=`budget ${bud} pada skala awal, +3 per slot tambahan · ${K} run per baris · anggaran 100 evaluasi · N = 20 pada seed evaluasi yang sama dengan exhaustive. Exhaustive hanya dijalankan bila |S| ≤ ${EXH_CAP}; di atas itu f* = terbaik yang ditemukan seluruh run (perkiraan, bukan optimum sebenarnya).`}
  else{ // eksperimen local search
    const P=mk(),S=cspSolve(P,{select:"mrv_degree",inference:"fc",all:true}).sols;
    if(!S.length){$("l3Res").innerHTML="<p>CSP tidak punya solusi pada budget ini (terbukti).</p>";return}
    head=["metode","berhasil","step","evaluasi","node (ribu)","f seed baru","failure mode"];
    const batch=async(label,extra)=>{const R=[];
      for(let s=1;s<=K;s++){prog(`${label} · run ${s}/${K}`);await tick();const ctx=newCtx(null),r=runLS(P,S,Object.assign({alg:"hcs",pStar:pS,N:20,seed:s,maxEvals:200},extra),ctx);
        const fr=evalCfg(P,r.best,pS,60,newCtx(null,99999)).f;R.push({r,fr})}
      const fm={};R.forEach(x=>{const k=x.r.fm||"ok";fm[k]=(fm[k]||0)+1});
      rows.push([label,(100*R.filter(x=>x.r.ok).length/K).toFixed(0)+"%",avg(R.map(x=>x.r.steps)).toFixed(1),avg(R.map(x=>x.r.evals)).toFixed(1),(avg(R.map(x=>x.r.nodes))/1000).toFixed(0),f2(avg(R.map(x=>x.fr))),Object.entries(fm).map(e=>e.join(":")).join(" ")])};
    if(id==="E6"){await batch("steepest-ascent",{alg:"hc"});await batch("+ sideways (maks 100)",{alg:"hcs"});await batch("random restart",{alg:"rr"});await batch("simulated annealing (0,95)",{alg:"sa",cooling:.95});
      if(S.length<=600){prog("exhaustive");await tick();const c=newCtx(null);let b=1e9,bs_=null;for(const s of S){const r=evalCfg(P,s,pS,20,c);if(r.f<b){b=r.f;bs_=s}}rows.push(["exhaustive (baseline)","100%","—",c.evals,(c.nodes/1000).toFixed(0),f2(evalCfg(P,bs_,pS,60,newCtx(null,99999)).f),"optimum pada seed evaluasi"])}}
    else if(id==="E7"){for(const N of[5,10,20,40])await batch(`sideways, N = ${N} simulasi/evaluasi`,{alg:"hcs",N})}
    else if(id==="E8"){for(const a of["hc","hcs"])for(const j of[false,true])await batch(`${a==="hc"?"steepest":"+ sideways"}, move ${j?"gabungan":"tunggal"}`,{alg:a,joint:j})}
    else if(id==="E12"){for(const c of[.9,.95,.98,.995])await batch(`SA cooling ${c}`,{alg:"sa",cooling:c})}
    note=`|S| = ${S.length} · ${K} run per baris · budget ${bud} · p* = ${pS} · berhasil = f ≤ ${TOL} · anggaran 200 evaluasi · satuan biaya: 1 evaluasi = 20 simulasi battle (kecuali E7). “f seed baru” = evaluasi ulang hasil dengan 60 simulasi pada seed berbeda (deteksi overfitting).`}
  }finally{$("l3Btn").disabled=false;prog("")}
  $("l3Res").innerHTML=tbl(head,rows)+`<p class="note">${note}</p>`;
  $("l3Csv").value=[head,...rows].map(r=>r.map(x=>`"${String(x).replace(/"/g,'""')}"`).join(",")).join("\n")}
$("openLab3").onclick=()=>$("lab3").classList.add("show");$("lab3Close").onclick=()=>$("lab3").classList.remove("show");
$("l3Btn").onclick=runLab3;
$("l3Copy").onclick=()=>{const t=$("l3Csv");t.style.display="block";t.select();try{document.execCommand("copy");toast("CSV disalin")}catch(e){}};
$("l3Dl").onclick=()=>{const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([$("l3Csv").value],{type:"text/csv"}));a.download="tahap3_"+$("l3Exp").value+".csv";a.click()};
setTimeout(()=>runPlanner(true),50);

