/* =====================================================================
   BATTLE ENGINE (tahap 2) — fungsi murni, tanpa DOM
   State, Action, Transition, Terminal test, Utility, Evaluation,
   Minimax / Alpha-Beta / Expectimax + bot MC + simulator battle
   ===================================================================== */
const B={
  MC_HP:1000, NPC_HP:1100, SP_MAX:4, SP_START:2,
  DMG:{basic:100,skillE:300,skillQ:500},
  SP_DELTA:{basic:1,skillE:-2,skillQ:-3},
  NPC_DMG:{attack:100,skill:200}, NPC_SKILL_CD:2,
  NPC_HEAL:100, NPC_HEALS:2, DEFEND_MULT:0.5,
  HEAL_POTION:300, BUFF_MULT:1.5, BUFF_CHARGES:2, SP_POTION:2, ITEM_SP_COST:1,
  TERMINAL_BASE:10000
};
const ACTION_LABEL={
  attack:"Attack (100)", skill:"Skill (200, CD 2)", heal:"Heal (+100)", defend:"Defend (-50% dmg)",
  basic:"Basic Attack", skillE:"Skill E", skillQ:"Ultimate Q", item:"Pakai Item"
};
const ITEM_INFO={
  heal:{name:"Heal Potion",desc:"+300 HP battle"},
  buff:{name:"Damage Buff",desc:"+50% damage untuk 2 serangan"},
  sp:{name:"SP Potion",desc:"+2 SP"}
};
const MC_WEIGHTS={basic:.25,skillE:.30,skillQ:.35,item:.10}; // model probabilistik MC (expectimax & bot "prob")

/* State: {mc,npc,sp,buff,item,cd,healsLeft,def,turn,usedItem} — semua primitif, clone murah */
function newBattleState(item){
  return {mc:B.MC_HP,npc:B.NPC_HP,sp:B.SP_START,buff:0,item:item||null,cd:0,healsLeft:B.NPC_HEALS,def:false,turn:"NPC",usedItem:false};
}
function isTerminal(s){return s.mc<=0||s.npc<=0}

function legalActions(s){
  if(isTerminal(s))return [];
  if(s.turn==="NPC"){
    const a=["attack"];
    if(s.cd===0)a.push("skill");
    if(s.healsLeft>0&&s.npc<B.NPC_HP)a.push("heal");
    a.push("defend");
    return a;
  }
  const a=["basic"];
  if(s.sp>=2)a.push("skillE");
  if(s.sp>=3)a.push("skillQ");
  if(s.item&&s.sp>=B.ITEM_SP_COST&&!s.usedItem)a.push("item");
  return a;
}

function applyAct(s,act){
  const n={...s};
  if(s.turn==="NPC"){
    if(act==="attack")n.mc-=B.NPC_DMG.attack;
    else if(act==="skill"){n.mc-=B.NPC_DMG.skill;n.cd=B.NPC_SKILL_CD}
    else if(act==="heal"){n.npc=Math.min(B.NPC_HP,n.npc+B.NPC_HEAL);n.healsLeft--}
    else if(act==="defend")n.def=true;
    if(n.mc>0){n.turn="MC";n.usedItem=false}
    return n;
  }
  if(act==="item"){ // aksi bebas: giliran MC berlanjut
    n.sp-=B.ITEM_SP_COST;n.usedItem=true;
    if(s.item==="heal")n.mc=Math.min(B.MC_HP,n.mc+B.HEAL_POTION);
    else if(s.item==="buff")n.buff=B.BUFF_CHARGES;
    else if(s.item==="sp")n.sp=Math.min(B.SP_MAX,n.sp+B.SP_POTION);
    n.item=null;
    return n;
  }
  let dmg=B.DMG[act];
  if(n.buff>0){dmg*=B.BUFF_MULT;n.buff--}
  if(n.def)dmg*=B.DEFEND_MULT;
  n.npc-=Math.round(dmg);
  n.sp=Math.max(0,Math.min(B.SP_MAX,n.sp+B.SP_DELTA[act]));
  if(n.npc>0){n.turn="NPC";n.cd=Math.max(0,n.cd-1);n.def=false;n.usedItem=false}
  return n;
}

/* Utility (sudut pandang NPC) — dipakai di node terminal. d = sisa depth (menang cepat lebih baik). */
function utility(s,d){
  if(s.mc<=0)return B.TERMINAL_BASE+s.npc+d;
  return -(B.TERMINAL_BASE+s.mc)-d;
}

/* Fungsi evaluasi (sudut pandang NPC, makin besar makin baik bagi NPC) — dipakai saat cutoff depth */
const EVALS={
  hpdiff:{name:"E1 Selisih HP",fn:s=>s.npc-s.mc},
  ratio:{name:"E2 Rasio HP",fn:s=>1000*(s.npc/B.NPC_HP-s.mc/B.MC_HP)},
  resource:{name:"E3 HP + Resource",fn:s=>{
    let v=1000*(s.npc/B.NPC_HP-s.mc/B.MC_HP);
    v-=s.sp*35; v-=s.buff*80; if(s.item)v-=40;
    if(s.cd===0)v+=40; v+=15*s.healsLeft; if(s.def)v+=30;
    return v}},
  aggressive:{name:"E4 Agresif",fn:s=>1.6*(B.MC_HP-s.mc)-0.5*(B.NPC_HP-s.npc)+(s.cd===0?40:0)},
  defensive:{name:"E5 Defensif",fn:s=>1.5*(1000*s.npc/B.NPC_HP)-0.6*(1000*s.mc/B.MC_HP)+40*s.healsLeft+(s.def?30:0)}
};

/* Pencarian: cfg={algo,depth,evalKey,order,maximizer} */
function battleSearch(root,cfg){
  const t0=performance.now();
  const st={nodes:0,leaves:0,cutoffs:0,orderEvals:0};
  const maxer=cfg.maximizer||"NPC",sign=maxer==="NPC"?1:-1;
  const evalFn=EVALS[cfg.evalKey||"ratio"].fn;
  const leafVal=(s,d)=>isTerminal(s)?sign*utility(s,d):sign*evalFn(s);
  function order(s,acts,isMax){
    if(acts.length<2)return acts;
    switch(cfg.order){
      case "reverse":return acts.slice().reverse();
      case "random":return acts.slice().sort(()=>Math.random()-.5);
      case "heuristic":{
        const sc=acts.map(a=>{st.orderEvals++;return{a,v:leafVal(applyAct(s,a),0)}});
        sc.sort((x,y)=>isMax?y.v-x.v:x.v-y.v);return sc.map(o=>o.a);
      }
      default:return acts;
    }
  }
  function mm(s,d){
    st.nodes++;
    if(d===0||isTerminal(s)){st.leaves++;return leafVal(s,d)}
    const isMax=s.turn===maxer;let best=isMax?-Infinity:Infinity;
    for(const a of order(s,legalActions(s),isMax)){
      const v=mm(applyAct(s,a),d-1);
      if(isMax){if(v>best)best=v}else if(v<best)best=v;
    }
    return best;
  }
  function ab(s,d,al,be){
    st.nodes++;
    if(d===0||isTerminal(s)){st.leaves++;return leafVal(s,d)}
    const isMax=s.turn===maxer;
    if(isMax){
      let v=-Infinity;
      for(const a of order(s,legalActions(s),true)){
        const c=ab(applyAct(s,a),d-1,al,be);if(c>v)v=c;if(v>al)al=v;
        if(al>=be){st.cutoffs++;break}
      }
      return v;
    }
    let v=Infinity;
    for(const a of order(s,legalActions(s),false)){
      const c=ab(applyAct(s,a),d-1,al,be);if(c<v)v=c;if(v<be)be=v;
      if(al>=be){st.cutoffs++;break}
    }
    return v;
  }
  function ex(s,d){ // expectimax: giliran lawan = chance node
    st.nodes++;
    if(d===0||isTerminal(s)){st.leaves++;return leafVal(s,d)}
    const acts=legalActions(s);
    if(s.turn===maxer){let best=-Infinity;for(const a of acts){const v=ex(applyAct(s,a),d-1);if(v>best)best=v}return best}
    let tot=0,ws=0;
    for(const a of acts){const w=MC_WEIGHTS[a]||.1;ws+=w;tot+=w*ex(applyAct(s,a),d-1)}
    return tot/ws;
  }
  st.nodes++; // root
  const acts=order(root,legalActions(root),true);
  const scores=[];let al=-Infinity,best=null,bestV=-Infinity;
  for(const a of acts){
    const child=applyAct(root,a);let v,exact=true;
    if(cfg.algo==="minimax")v=mm(child,cfg.depth-1);
    else if(cfg.algo==="expectimax")v=ex(child,cfg.depth-1);
    else{v=ab(child,cfg.depth-1,al,Infinity);exact=scores.length===0||v>al;if(v>al)al=v}
    scores.push({action:a,score:v,exact});
    if(v>bestV){bestV=v;best=a}
  }
  return {best,bestScore:bestV,scores,nodes:st.nodes,leaves:st.leaves,cutoffs:st.cutoffs,orderEvals:st.orderEvals,ms:performance.now()-t0};
}

/* Bot MC untuk simulasi / lawan eksperimen */
function mcPolicy(name,s){
  const acts=legalActions(s);
  if(name==="random")return acts[Math.floor(Math.random()*acts.length)];
  if(name==="prob"){
    let ws=0;for(const a of acts)ws+=MC_WEIGHTS[a];let r=Math.random()*ws;
    for(const a of acts){r-=MC_WEIGHTS[a];if(r<=0)return a}return acts[0];
  }
  if(name==="greedy"){
    if(acts.includes("item")){const it=s.item;if((it==="heal"&&s.mc<=600)||it==="buff"||(it==="sp"&&s.sp<=1))return "item"}
    if(acts.includes("skillQ"))return "skillQ";
    if(acts.includes("skillE"))return "skillE";
    return "basic";
  }
  if(name==="smart")return battleSearch(s,{algo:"alphabeta",depth:4,evalKey:"ratio",order:"heuristic",maximizer:"MC"}).best;
  return acts[0];
}

function simulateBattle(npcCfg,mcName,item){
  let s=newBattleState(item);
  const acts={attack:0,skill:0,heal:0,defend:0};
  let nodes=0,dec=0,ms=0,plies=0;
  while(!isTerminal(s)&&plies<400){
    let a;
    if(s.turn==="NPC"){const r=battleSearch(s,npcCfg);a=r.best;nodes+=r.nodes;ms+=r.ms;dec++;acts[a]++}
    else a=mcPolicy(mcName,s);
    s=applyAct(s,a);plies++;
  }
  return {npcWon:s.mc<=0,npcLeft:Math.max(0,s.npc),mcLeft:Math.max(0,s.mc),turns:dec,nodes,dec,ms,acts};
}

if(typeof module!=="undefined"&&typeof window==="undefined")module.exports={B,EVALS,newBattleState,legalActions,applyAct,isTerminal,utility,battleSearch,mcPolicy,simulateBattle,MC_WEIGHTS};

