/* =====================================================================
   TAHAP 3 — RAID PLANNER (CSP + Local Search)  — inti murni, tanpa DOM
   CSP  : X = {c0..c(n-1), i0..i(n-1)}  (karakter & item per slot)
   LS   : state = konfigurasi legal, objective f = |p̂ − p*| + penalti durasi
   ===================================================================== */
const NONE="-";
const CH={
  T:{n:"Tugas",cost:3,hp:1100,atk:100,sk:200,cd:2,heal:100,heals:2},
  K:{n:"Kuis Dadakan",cost:2,hp:700,atk:120,sk:160,cd:1,heal:100,heals:0},
  D:{n:"Dosen Killer",cost:4,hp:1500,atk:80,sk:150,cd:2,heal:100,heals:1},
  R:{n:"Revisi Tak Berujung",cost:3,hp:900,atk:90,sk:120,cd:2,heal:150,heals:3},
  B:{n:"Deadline Besok",cost:5,hp:1300,atk:130,sk:260,cd:3,heal:100,heals:1}};
const IT={Kopi:{cost:1,ok:"TDRB"},Contekan:{cost:1,ok:"TKDRB"},Kalkulator:{cost:2,ok:"TKDB"},Kertas:{cost:1,ok:"TR"}};
const BUDGET={1:5,2:7,3:9}, BUDGET_DESAIN={1:6,2:9,3:12}, WAVE_REC={hp:300,sp:2}, TOL=0.05, T_PER_NPC=6;
const PLAN_LIMIT_MS=2000, PEN_W=0.15, EXH_CAP=600;   // batas waktu planning (rancangan §11), bobot penalti desain 2, batas |S| untuk exhaustive

function mulberry(a){return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}

/* ---------- Definisi CSP ---------- */
function makeCSP(o){
  const n=o.slots||3,vars=[],dom0={},nb={};
  for(let i=0;i<n;i++)vars.push("c"+i);for(let i=0;i<n;i++)vars.push("i"+i);
  for(let i=0;i<n;i++){
    let d=[NONE,...Object.keys(CH)];
    if(i===0)d=d.filter(x=>x!==NONE);             // C1 unary: minimal satu NPC
    if((o.wins||0)<2)d=d.filter(x=>x!=="B");       // C2 unary: boss terkunci
    dom0["c"+i]=d;dom0["i"+i]=[NONE,...Object.keys(IT)];
    nb["c"+i]=["i"+i];nb["i"+i]=["c"+i];
  }
  for(let i=0;i<n;i++)for(let j=0;j<n;j++)if(i!==j){nb["c"+i].push("c"+j);nb["i"+i].push("i"+j)}
  const sym=o.sym!==false;
  const cost=(X,x)=>x===NONE?0:(X[0]==="c"?CH[x].cost:IT[x].cost);
  function rel(X,x,Y,y){
    const kx=X[0],ky=Y[0],ix=+X.slice(1),iy=+Y.slice(1);
    if(kx!==ky){                                    // C3, C4: item vs karakter slot sama
      if(ix!==iy)return true;
      const c=kx==="c"?x:y,it=kx==="c"?y:x;
      if(it===NONE)return true;
      if(c===NONE)return false;
      return IT[it].ok.includes(c)}
    if(kx==="c"){                                   // C5, C6, C8: antar karakter
      if(x==="B"&&y==="B")return false;             // C8 AtMost(1) boss (didekomposisi pairwise)
      if((x==="D"&&y==="R")||(x==="R"&&y==="D"))return false;
      if(sym&&Math.abs(ix-iy)===1){const lo=ix<iy?x:y,hi=ix<iy?y:x;if(lo===NONE&&hi!==NONE)return false}
      return true}
    return !(x===y&&x!==NONE)};                     // C7 AllDifferent-kecuali-∅ (didekomposisi pairwise)
  return{vars,dom0,nb,n,bmax:o.budget,bmin:Math.ceil(.6*o.budget),cost,rel,sym};
}
function legalCfg(P,s){
  let sum=0;
  for(let a=0;a<s.length;a++){
    sum+=P.cost(P.vars[a],s[a]);
    if(!P.dom0[P.vars[a]].includes(s[a]))return false;
    for(let b=a+1;b<s.length;b++)if(P.nb[P.vars[a]].includes(P.vars[b])&&!P.rel(P.vars[a],s[a],P.vars[b],s[b]))return false}
  return sum>=P.bmin&&sum<=P.bmax}

/* ---------- Backtracking: select / order / inference, penghitung seperti praktikum ---------- */
const LIM={limit:true};
function cspSolve(P,opt){
  const o=Object.assign({select:"static",order:"static",inference:"none",limit:null,all:false,trace:null},opt);
  const st={assignments:0,backtracks:0,checks:0,limit:false,solutions:0,time:0,firstAt:null},t0=performance.now();
  const V=P.vars,dom={},asg={},sols=[];V.forEach(v=>dom[v]=P.dom0[v].slice());
  const ok=(X,x,Y,y)=>{st.checks++;return P.rel(X,x,Y,y)};
  const un=()=>V.filter(v=>!(v in asg));
  const sumA=()=>{let s=0;for(const v in asg)s+=P.cost(v,asg[v]);return s};
  function bounds(skip){let lo=0,hi=0;for(const v of un()){if(v===skip)continue;let mn=1e9,mx=-1;for(const x of dom[v]){const c=P.cost(v,x);if(c<mn)mn=c;if(c>mx)mx=c}lo+=mn;hi+=mx}return[lo,hi]}
  function consistent(X,x){                          // binary vs yang sudah di-assign + batas budget global (C9)
    for(const Y of P.nb[X])if((Y in asg)&&!ok(X,x,Y,asg[Y]))return false;
    st.checks++;const[lo,hi]=bounds(X),s=sumA()+P.cost(X,x);return s+lo<=P.bmax&&s+hi>=P.bmin}
  const legal=X=>dom[X].filter(x=>consistent(X,x));
  function selectVar(){
    const u=un();if(o.select==="static")return u[0];
    let best=null,bk=null;
    for(const v of u){
      const rem=o.inference!=="none"?dom[v].length:legal(v).length;
      const deg=P.nb[v].filter(w=>!(w in asg)).length;
      const k=[rem,o.select==="mrv_degree"?-deg:0];
      if(!best||k[0]<bk[0]||(k[0]===bk[0]&&k[1]<bk[1])){best=v;bk=k}}
    return best}
  function orderVals(X){
    if(o.order==="static")return dom[X].slice();
    const key=x=>{
      if(o.inference==="none"&&!consistent(X,x))return[1,0];
      let c=0;for(const Y of P.nb[X])if(!(Y in asg)){
        const vals=o.inference==="none"?legal(Y):dom[Y];
        for(const y of vals)if(!ok(X,x,Y,y))c++}
      return[0,c]};
    return dom[X].map((x,i)=>({x,k:key(x),i})).sort((a,b)=>a.k[0]-b.k[0]||a.k[1]-b.k[1]||a.i-b.i).map(e=>e.x)}
  function gprune(removed){                          // propagasi constraint global budget
    const s=sumA(),[lo,hi]=bounds(null);
    for(const Z of un()){
      let mn=1e9,mx=-1;for(const x of dom[Z]){const c=P.cost(Z,x);if(c<mn)mn=c;if(c>mx)mx=c}
      for(const x of dom[Z].slice()){
        st.checks++;const c=P.cost(Z,x);
        if(s+c+(lo-mn)>P.bmax||s+c+(hi-mx)<P.bmin){dom[Z].splice(dom[Z].indexOf(x),1);removed.push([Z,x])}}
      if(!dom[Z].length)return false}
    return true}
  function forwardCheck(X,x,removed){
    for(const Y of P.nb[X])if(!(Y in asg))for(const y of dom[Y].slice())if(!ok(X,x,Y,y)){dom[Y].splice(dom[Y].indexOf(y),1);removed.push([Y,y]);if(!dom[Y].length)return false}
    return gprune(removed)}
  function revise(A,Bv,removed){let r=false;for(const a of dom[A].slice())if(!dom[Bv].some(b=>ok(A,a,Bv,b))){dom[A].splice(dom[A].indexOf(a),1);removed.push([A,a]);r=true}return r}
  function mac(X,removed){
    if(!gprune(removed))return false;
    const q=P.nb[X].filter(Z=>!(Z in asg)).map(Z=>[Z,X]);
    while(q.length){
      const[A,Bv]=q.shift();
      if(revise(A,Bv,removed)){
        if(!dom[A].length)return false;
        for(const Z of P.nb[A])if(Z!==Bv&&!(Z in asg)&&!q.some(e=>e[0]===Z&&e[1]===A))q.push([Z,A])}}
    return gprune(removed)}
  function bt(){
    if(Object.keys(asg).length===V.length){
      const sol=V.map(v=>asg[v]);
      if(o.all){if(!st.solutions)st.firstAt=st.assignments;sols.push(sol);st.solutions++;return null}
      return sol}
    const X=selectVar(),ord=orderVals(X);
    const why=o.select==="static"?"urutan statis":`${o.select==="mrv"?"MRV":"MRV+degree"}: |D|=${dom[X].length}${o.select==="mrv_degree"?`, degree=${P.nb[X].filter(w=>!(w in asg)).length}`:""}`;
    for(const x of ord){
      if(o.limit!=null&&st.assignments>=o.limit)throw LIM;
      st.assignments++;
      if(o.inference==="none"&&!consistent(X,x))continue;
      asg[X]=x;const saved=dom[X];dom[X]=[x];const removed=[];let alive=true;
      if(o.inference==="fc")alive=forwardCheck(X,x,removed);else if(o.inference==="mac")alive=mac(X,removed);
      if(o.trace&&o.trace.length<40)o.trace.push({X,x,why,ord:o.order==="lcv"?ord.join(" "):null,removed:removed.map(e=>e[0]+"≠"+e[1]),alive});
      if(alive){const r=bt();if(r)return r}
      removed.forEach(([Y,y])=>dom[Y].push(y));
      new Set(removed.map(e=>e[0])).forEach(Y=>dom[Y].sort((a,b)=>P.dom0[Y].indexOf(a)-P.dom0[Y].indexOf(b)));
      dom[X]=saved;delete asg[X]}
    st.backtracks++;return null}
  try{const r=bt();if(r)sols.push(r),st.solutions=1}catch(e){if(e!==LIM)throw e;st.limit=true}
  st.time=performance.now()-t0;
  return{sols,st,done:!st.limit};                    // done=false → hasil belum diketahui
}

/* ---------- Simulasi battle squad (memakai engine Tahap 2 apa adanya) ---------- */
const snapB=()=>({hp:B.NPC_HP,a:B.NPC_DMG.attack,s:B.NPC_DMG.skill,cd:B.NPC_SKILL_CD,h:B.NPC_HEAL,hs:B.NPC_HEALS});
const putB=z=>{B.NPC_HP=z.hp;B.NPC_DMG.attack=z.a;B.NPC_DMG.skill=z.s;B.NPC_SKILL_CD=z.cd;B.NPC_HEAL=z.h;B.NPC_HEALS=z.hs};
function waveB(c,it){const ch=CH[c];putB({hp:ch.hp,a:ch.atk,s:Math.round(ch.sk*(it==="Kalkulator"?1.25:1)),cd:Math.max(1,ch.cd-(it==="Kopi"?1:0)),h:ch.heal,hs:ch.heals+(it==="Kertas"?1:0)})}
function squadOf(P,s){const q=[];for(let i=0;i<P.n;i++)if(s[i]!==NONE)q.push({c:s[i],it:s[P.n+i]===NONE?null:s[P.n+i]});return q}
function squadStr(sq){return sq.map(q=>q.c+(q.it?"["+q.it+"]":"")).join(" → ")}
const NPCCFG={algo:"alphabeta",depth:2,evalKey:"resource",order:"heuristic",maximizer:"NPC"};
/* pemain tidak deterministik: bot greedy sesekali (20%) memilih aksi legal acak */
function botAct(name,s){if(name==="greedy"&&Math.random()<0.2){const a=legalActions(s);return a[Math.floor(Math.random()*a.length)]}return mcPolicy(name,s)}
const botFor=i=>i%5<2?"greedy":i%5<4?"prob":"random";   // model pemain: 40% greedy, 40% prob, 20% random
function simSquad(squad,bot,item){
  const snap=snapB();let mc=B.MC_HP,sp=B.SP_START,buff=0,it=item||null,turns=0,nodes=0,won=true,frust=false;
  try{
    for(let w=0;w<squad.length&&won;w++){
      waveB(squad[w].c,squad[w].it);
      let s=newBattleState(it);s.mc=mc;s.sp=sp;s.buff=buff;s.def=squad[w].it==="Contekan";
      let g=0;
      while(!isTerminal(s)&&g++<300){
        let a;if(s.turn==="NPC"){const r=battleSearch(s,NPCCFG);nodes+=r.nodes;a=r.best;turns++}else a=botAct(bot,s);
        s=applyAct(s,a)}
      if(s.mc<=0){won=false;mc=0;if(w===0)frust=s.npc/B.NPC_HP>0.8}   // frustasi: MC tewas saat NPC pertama masih >80% HP (§8)
      else{mc=w===squad.length-1?s.mc:Math.min(B.MC_HP,s.mc+WAVE_REC.hp);sp=Math.min(B.SP_MAX,s.sp+WAVE_REC.sp);buff=s.buff;it=s.item}}
  }finally{putB(snap)}
  const bored=won&&(mc/B.MC_HP>0.7||turns<4);          // bosan: menang dengan sisa HP >70% atau <4 giliran NPC (§8)
  return{won,turns,mcLeft:mc,nodes,bored,frust}}
function withSeed(seed,fn){const r0=Math.random;Math.random=mulberry(seed);try{return fn()}finally{Math.random=r0}}

/* ---------- Objective ---------- */
function newCtx(item,seed){return{cache:new Map(),calls:0,evals:0,sims:0,nodes:0,seed:seed||777,item:item||null}}
function evalCfg(P,s,pStar,N,ctx,botOverride){
  const key=s.join("|")+"@"+N+"@"+ctx.seed+"@"+(botOverride||"mix");ctx.calls++;
  if(ctx.cache.has(key))return ctx.cache.get(key);
  ctx.evals++;                                       // satuan biaya: 1 evaluasi = N simulasi battle
  const sq=squadOf(P,s);let w=0,T=0,bo=0,fr=0;
  withSeed(ctx.seed,()=>{for(let i=0;i<N;i++){const r=simSquad(sq,botOverride||botFor(i),ctx.item);ctx.sims++;ctx.nodes+=r.nodes;w+=r.won;T+=r.turns;bo+=r.bored?1:0;fr+=r.frust?1:0}});
  const p=w/N,Tb=T/N,Ts=T_PER_NPC*sq.length;
  const r={f:Math.abs(p-pStar)+0.5*Math.max(0,Math.abs(Tb-Ts)-2)/Ts,p,T:Tb,bo:bo/N,fr:fr/N};
  ctx.cache.set(key,r);return r}

/* ---------- Local search ---------- */
function nbrs(P,s,joint,free){
  const out=[],seen=new Set([s.join("|")]);let raw=0;
  const ok=t=>free||legalCfg(P,t);
  const add=t=>{const k=t.join("|");if(!seen.has(k)&&ok(t)){seen.add(k);out.push(t)}};
  for(let k=0;k<P.vars.length;k++)for(const v of P.dom0[P.vars[k]]){
    if(v===s[k])continue;raw++;
    const t=s.slice();t[k]=v;
    if(ok(t))add(t);
    else if(joint&&k<P.n)for(const it of P.dom0[P.vars[P.n+k]]){const u=t.slice();u[P.n+k]=it;add(u)}}   // move gabungan karakter+item
  return{list:out,raw}}
/* ---------- Min-Conflicts (CSP local search, rancangan §5.3) ---------- */
function mcSolve(P,o){
  const rng=mulberry(o.seed||1),maxSteps=o.maxSteps||600,noise=o.noise??0.1,V=P.vars,n=V.length;
  const idx={};V.forEach((v,k)=>idx[v]=k);let checks=0,changed=0;
  const s=V.map(v=>{const d=P.dom0[v];return d[Math.floor(rng()*d.length)]});
  const over=a=>{let sum=0;for(let k=0;k<n;k++)sum+=P.cost(V[k],a[k]);return sum<P.bmin?P.bmin-sum:sum>P.bmax?sum-P.bmax:0};
  const conf=(k,x)=>{const X=V[k];let c=0;for(const Y of P.nb[X]){checks++;if(!P.rel(X,x,Y,s[idx[Y]]))c++}
    const t=s.slice();t[k]=x;checks++;return c+over(t)};          // konflik biner + pelanggaran budget (C9)
  for(let step=0;step<maxSteps;step++){
    const bad=[];for(let k=0;k<n;k++)if(conf(k,s[k])>0)bad.push(k);
    if(!bad.length)return{ok:true,sol:s,steps:step,checks,changed};
    const k=bad[Math.floor(rng()*bad.length)],d=P.dom0[V[k]];let x;
    if(rng()<noise)x=d[Math.floor(rng()*d.length)];
    else{let b=1e9,bl=[];for(const v of d){const c=conf(k,v);if(c<b){b=c;bl=[v]}else if(c===b)bl.push(v)}x=bl[Math.floor(rng()*bl.length)]}
    if(x!==s[k]){s[k]=x;changed++}}
  return{ok:legalCfg(P,s),sol:s,steps:maxSteps,checks,changed}}
/* ---------- Desain 2 (penalti): jumlah pelanggaran constraint pada konfigurasi bebas ---------- */
function violations(P,s){
  let v=0,sum=0;
  for(let a=0;a<s.length;a++){
    sum+=P.cost(P.vars[a],s[a]);
    if(!P.dom0[P.vars[a]].includes(s[a]))v++;
    for(let b=a+1;b<s.length;b++)if(P.nb[P.vars[a]].includes(P.vars[b])&&!P.rel(P.vars[a],s[a],P.vars[b],s[b]))v++}
  return v+(sum<P.bmin?P.bmin-sum:sum>P.bmax?sum-P.bmax:0)}
/* neighbour mentah yang ditolak constraint (untuk tabel debug) */
function illegalNb(P,s){const out=[];for(let k=0;k<P.vars.length;k++)for(const v of P.dom0[P.vars[k]]){if(v===s[k])continue;const t=s.slice();t[k]=v;if(!legalCfg(P,t))out.push([t,k,v,s[k]])}return out}
function runLS(P,S,o,ctx){
  const rng=mulberry(o.seed||1),N=o.N||20,tol=o.tol??TOL,maxE=o.maxEvals||200,t0=performance.now();
  const tm=()=>!!o.tlimit&&performance.now()-t0>o.tlimit;     // batas waktu planning (opsional)
  const F=s=>{const r=evalCfg(P,s,o.pStar,N,ctx);if(!o.penalty)return r;const v=violations(P,s);return v?Object.assign({},r,{f:r.f+PEN_W*v,viol:v}):r},done=()=>ctx.evals>=maxE||tm(),pick=a=>a[Math.floor(rng()*a.length)];
  let best=null,bestR=null,bestF=1e9,steps=0,restarts=0;const trace=[],hist=[];let lastCur=null,lastEv=[];const mcN={tries:0,ok:0,steps:0,checks:0};
  const track=(s,r)=>{if(r.f<bestF){bestF=r.f;best=s;bestR=r}};
  const note=(x)=>{if(trace.length<60)trace.push(x)};
  function diagRidge(cur,cr){                         // diagnosis: apakah move gabungan memperbaiki? (tidak dihitung ke biaya)
    const c2=Object.assign({},ctx,{cache:new Map()});
    return nbrs(P,cur,true).list.some(t=>evalCfg(P,t,o.pStar,N,c2).f<cr.f-1e-12)}
  function hc(start,side){
    let cur=start,cr=F(cur),sw=0,fm="";track(cur,cr);note({step:steps,cfg:cur,f:cr.f,p:cr.p,msg:"start"});
    while(!done()&&cr.f>tol){
      const{list}=nbrs(P,cur,o.joint,o.penalty);if(!list.length){fm="tak ada neighbour";break}
      lastCur=cur;lastEv=[];
      let bf=1e9,bl=[];
      for(const t of list){if(done())break;const r=F(t);track(t,r);lastEv.push([t,r]);if(r.f<bf-1e-12){bf=r.f;bl=[[t,r]]}else if(Math.abs(r.f-bf)<1e-12)bl.push([t,r])}
      if(!bl.length)break;
      const[t,r]=pick(bl);
      if(bf>cr.f+1e-12){fm=(!o.joint&&!o.penalty&&diagRidge(cur,cr))?"ridge":"local optimum";break}
      if(Math.abs(bf-cr.f)<1e-12){if(sw>=side){fm=(!o.joint&&!o.penalty&&diagRidge(cur,cr))?"ridge":"plateau/shoulder";break}sw++;note({step:steps+1,cfg:t,f:r.f,p:r.p,msg:"sideways "+sw})}
      else{sw=0;note({step:steps+1,cfg:t,f:r.f,p:r.p,msg:"naik"})}
      cur=t;cr=r;steps++;hist.push([ctx.evals,bestF])}
    if(!fm&&cr.f>tol&&done())fm=tm()?"batas waktu planning":"anggaran evaluasi habis";
    return fm}
  function sa(start){
    let cur=start,cr=F(cur),T=o.t0??0.2,fm="";const tmin=o.tmin??0.002,cool=o.cooling??0.98;track(cur,cr);
    while(!done()&&cr.f>tol&&T>tmin){
      const{list}=nbrs(P,cur,o.joint,o.penalty);if(!list.length)break;
      const t=pick(list),r=F(t),dE=cr.f-r.f;track(t,r);
      let u=null,p=1,acc=dE>0;if(!acc){p=Math.exp(dE/T);u=rng();acc=u<p}
      note({step:steps+1,cfg:t,f:r.f,p:r.p,T,dE,pa:p,u,msg:acc?(dE>0?"terima (lebih baik)":"terima (lebih buruk)"):"tolak"});
      if(acc){cur=t;cr=r}steps++;T*=cool;hist.push([ctx.evals,bestF])}
    if(cr.f>tol)fm=tm()?"batas waktu planning":done()?"anggaran evaluasi habis":"T mencapai batas";return fm}
  let fm="";
  function mcAlg(){                                   // Min-Conflicts: cari konfigurasi legal, lalu evaluasi f
    let fm="";const cap=maxE*3;
    while(!done()&&bestF>tol&&mcN.tries<cap){
      mcN.tries++;const m=mcSolve(P,{seed:1+Math.floor(rng()*1e9),noise:o.noise??0.1,maxSteps:o.mcSteps||600});
      mcN.steps+=m.steps;mcN.checks+=m.checks;
      if(m.ok){mcN.ok++;const x=F(m.sol);track(m.sol,x);note({step:mcN.tries,cfg:m.sol,f:x.f,p:x.p,msg:`min-conflicts: legal setelah ${m.steps} langkah (${m.changed} perubahan)`});hist.push([ctx.evals,bestF])}}
    if(!best){const s0=pick(S),x=F(s0);track(s0,x);return"min-conflicts tidak menemukan konfigurasi legal (dipakai sampel dari S)"}
    if(bestF>tol)fm=tm()?"batas waktu planning":mcN.tries>=cap?"batas percobaan min-conflicts":"anggaran evaluasi habis";
    return fm}
  const randS=()=>P.vars.map(v=>pick(P.dom0[v])),start=()=>o.penalty?randS():pick(S);
  if(o.alg==="mc")fm=mcAlg();
  else if(o.alg==="sa")fm=sa(start());
  else if(o.alg==="rr"){do{restarts++;fm=hc(start(),0)}while(!done()&&bestF>tol&&restarts<(o.maxRestarts||40));if(!done()&&bestF>tol)fm="batas restart"}
  else fm=hc(start(),o.alg==="hcs"?(o.side??100):0);
  const okk=bestF<=tol;
  const nb=lastCur&&!o.penalty?{cur:lastCur,rows:lastEv.map(([t,r])=>({cfg:t,f:r.f,p:r.p})).sort((a,b)=>a.f-b.f),ill:illegalNb(P,lastCur)}:null;
  return{best,bestR,bestF,ok:okk,steps,restarts,evals:ctx.evals,calls:ctx.calls,sims:ctx.sims,nodes:ctx.nodes,fm:okk?"":fm,trace,hist,nb,mc:o.alg==="mc"?mcN:null,timeout:tm()&&!okk}}


