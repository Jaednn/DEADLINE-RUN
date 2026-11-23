/* ======================= BATTLE ======================= */
function aiCfg(){return{algo:$("bAlgo").value,depth:parseInt($("bDepth").value),evalKey:$("bEval").value,order:$("bOrder").value,maximizer:"NPC"}}
function startBattle(test){
  if(mode==="battle")return;
  mode="battle";bTest=test;
  const item=test?(player.item||["heal","buff","sp"][Math.floor(Math.random()*3)]):player.item;
  bs=newBattleState(item);bLog=[];bBusy=true;bTurns=0;
  $("bTest").textContent=test?"(test — tidak mengubah nyawa/poin)":"";
  $("bMCImg").src=img.player.front.src;$("bNPCImg").src=img.npc.front.src;
  $("bResult").classList.remove("show");resetBattleFx();poseIdle("MC");poseIdle("NPC");$("battle").classList.add("show");battleIntro();
  logLine(test?"Test battle dimulai.":"DEADLINE WOKK!! Anomali Tugas menangkapmu!","lg-sys");
  renderBattle();
  // Tidak ada lagi pause/modal sebelum battle. Villain otomatis mengambil giliran pertama.
  setTimeout(npcTurn,900);
}
function logLine(t,cls){bLog.push({t,cls});if(bLog.length>7)bLog.shift();$("bLog").innerHTML=bLog.map(l=>`<div class="${l.cls}">${l.t}</div>`).join("")}
function renderBattle(){
  $("bMcHp").style.width=Math.max(0,bs.mc/B.MC_HP*100)+"%";
  $("bNpcHp").style.width=Math.max(0,bs.npc/B.NPC_HP*100)+"%";
  $("bMcHpTxt").textContent=`HP ${Math.max(0,bs.mc)}/${B.MC_HP}`;
  $("bNpcHpTxt").textContent=`HP ${Math.max(0,bs.npc)}/${B.NPC_HP}`;
  $("bMcSp").innerHTML=Array.from({length:B.SP_MAX},(_,i)=>`<div class="pip ${i<bs.sp?"on":""}"></div>`).join("");
  const mt=[];if(bs.buff>0)mt.push(`Buff ×${bs.buff} (+50%)`);
  mt.push(bs.item?`Item: ${ITEM_INFO[bs.item].name}`:"Item: —");
  $("bMcTags").innerHTML=mt.map(x=>`<span class="tag2">${x}</span>`).join("");
  const nt=[`Skill CD: ${bs.cd}`,`Heal sisa: ${B.NPC_HEALS===0?0:bs.healsLeft}`];if(bs.def)nt.push("DEFEND");
  $("bNpcTags").innerHTML=nt.map(x=>`<span class="tag2">${x}</span>`).join("");
  $("bTurn").textContent=isTerminal(bs)?"Selesai":bs.turn==="NPC"?"Giliran: Anomali Tugas":"Giliran: MC (pilih aksi)";
  const legal=bs.turn==="MC"&&!bBusy&&!isTerminal(bs)?legalActions(bs):[];
  $("btnBasic").disabled=!legal.includes("basic");$("btnE").disabled=!legal.includes("skillE");
  $("btnQ").disabled=!legal.includes("skillQ");$("btnItem").disabled=!legal.includes("item");
  $("btnItem").innerHTML=`${bs.item?ITEM_INFO[bs.item].name:"Pakai Item"}<small>${bs.item?ITEM_INFO[bs.item].desc+" · −1 SP":"tidak ada item"}</small>`;
}
function flash(id){const e=$(id);e.classList.remove("hit");void e.offsetWidth;e.classList.add("hit")}
function describe(before,after,a){
  if(before.turn==="NPC"){
    if(a==="attack"){return[`Anomali Tugas menyerang! MC −${before.mc-after.mc} HP`,"lg-npc"]}
    if(a==="skill"){return[`"DEADLINE WOKK!!" Skill! MC −${before.mc-after.mc} HP`,"lg-npc"]}
    if(a==="heal")return[`Anomali Tugas menyembuhkan diri +${after.npc-before.npc} HP`,"lg-npc"];
    return["Anomali Tugas bertahan — damage berikutnya −50%","lg-npc"];
  }
  if(a==="item"){
    const n=ITEM_INFO[before.item].name;
    if(before.item==="heal")return[`MC memakai ${n}: +${after.mc-before.mc} HP`,"lg-mc"];
    if(before.item==="buff")return[`MC memakai ${n}: 2 serangan berikutnya +50%`,"lg-mc"];
    return[`MC memakai ${n}: SP +2 (total ${after.sp})`,"lg-mc"];
  }
  const nm={basic:"Basic Attack",skillE:"Skill E",skillQ:"ULTIMATE Q"}[a];
  return[`MC ${nm}! Villain −${before.npc-after.npc} HP${before.buff>0?" (buff)":""}${before.def?" (ditahan)":""}`,"lg-mc"];
}
function npcTurn(){
  if(!bs||isTerminal(bs)||bs.turn!=="NPC")return;
  bBusy=true;renderBattle();
  const cfg=aiCfg(),r=battleSearch(bs,cfg);
  showDebug(r,cfg,bs);
  bStats.decisions++;bStats.nodes+=r.nodes;updateBattleStats();
  setTimeout(()=>doAction(r.best),750);
}
/* ---------- Animasi battle ---------- */
const unitEl=w=>$(w==="MC"?"bMC":"bNPC"), spriteEl=w=>$(w==="MC"?"bMCImg":"bNPCImg");
/* ---------- Sprite frame battle ---------- */
const BFR={MC:{},NPC:{}},BPOSE={MC:[],NPC:[]};
(function(){if(typeof BSPR==="undefined")return;
  for(const w of ["MC","NPC"])for(const p of ["idle","attack","hurt","death"])
    BFR[w][p]=(BSPR[w][p]||[]).map(u=>{const i=new Image();i.src=u;return i});})();
function poseClear(w){BPOSE[w].forEach(clearTimeout);BPOSE[w]=[]}
function poseFrame(w,p,i){const f=BFR[w][p];if(f&&f[i])spriteEl(w).src=f[i].src}
function poseIdle(w){
  poseClear(w);const f=BFR[w].idle;if(!f||!f.length)return;
  let i=0;(function tick(){poseFrame(w,"idle",i);i=(i+1)%f.length;BPOSE[w]=[setTimeout(tick,170)]})();
}
// timeline pose: steps = [[pose,indexFrame,ms],...]; holdMs = tahan frame terakhir lalu balik idle (null = tahan terus, dipakai death)
function poseTimeline(w,steps,holdMs){
  poseClear(w);let last=0;
  steps.forEach(([p,i,t])=>{BPOSE[w].push(setTimeout(()=>poseFrame(w,p,i),Math.round(t)));if(t>last)last=t});
  if(holdMs!==null)BPOSE[w].push(setTimeout(()=>poseIdle(w),Math.round(last+holdMs)));
}
const poseSeq=(p,idx,t0,step)=>idx.map((i,k)=>[p,i,t0+k*step]);
function poseOnce(w,p,reachMs,holdMs,then){
  const f=BFR[w][p];if(!f||!f.length)return;
  const n=f.length,step=n>1?reachMs/(n-1):0;
  poseTimeline(w,poseSeq(p,[...Array(n).keys()],0,step),then===null?null:holdMs);
}
const later=(fn,ms)=>setTimeout(()=>{if(mode==="battle")fn()},Math.max(0,Math.round(ms)));

/* ---------- Efek sinematik: skill & ultimate ---------- */
function dimOn(color,on){
  let d=$("bDim");if(!d){d=document.createElement("div");d.id="bDim";d.className="b-dim";$("battle").appendChild(d)}
  if(color)d.style.setProperty("--dc",color);d.classList.toggle("on",!!on);
}
function speedOn(color,ms){const s=document.createElement("div");s.className="b-speed";s.style.setProperty("--c",color);$("battle").appendChild(s);setTimeout(()=>s.remove(),ms+400)}
function showTitle(text,color,big){const t=document.createElement("div");t.className="b-skt"+(big?" big":"");t.style.setProperty("--c",color);t.textContent=text;$("battle").appendChild(t);setTimeout(()=>t.remove(),1400)}
function ghost(w,color){
  const im=spriteEl(w),b=$("battle"),r=im.getBoundingClientRect(),br=b.getBoundingClientRect();
  const g=document.createElement("img");g.src=im.src;g.className="b-ghost";
  g.style.cssText=`left:${r.left-br.left}px;top:${r.top-br.top}px;width:${r.width}px;height:${r.height}px;--gc:${color}`;
  b.appendChild(g);setTimeout(()=>g.remove(),460);
}
function ghostTrail(w,color,from,dur,step){for(let t=0;t<dur;t+=step)later(()=>ghost(w,color),from+t)}
function chargeShake(w,color,ms){
  const im=spriteEl(w);im.style.animation="none";void im.offsetWidth;im.style.setProperty("--gc",color);
  im.style.animation=`charge 110ms linear ${Math.max(1,Math.round(ms/110))}`;
}
function auraBurst(w,color,glyph,n,rings,ms){
  for(let k=0;k<rings;k++)later(()=>fxAdd(w,"fx-ring",{life:950,style:{"--c":color}}),k*ms/rings);
  for(let i=0;i<n;i++)later(()=>fxAdd(w,"fx-p",{text:glyph,life:1500,style:{"--c":color,"--x":(Math.random()*110-55)+"px",top:(sy(w)-6+Math.random()*44)+"px",fontSize:(14+Math.random()*12)+"px"}}),Math.random()*ms);
}
function arcs(w,list,color,size){list.forEach(([r,dy,delay])=>fxAdd(w,"fx-arc",{life:800,style:{"--r":r+"deg","--c":color,"--w":size+"px",top:(sy(w)+dy)+"px",animationDelay:delay+"ms"}}))}
function papers(w,n){for(let i=0;i<n;i++)fxAdd(w,"fx-paper",{text:"📄",life:1700,style:{"--x":(Math.random()*120-60)+"px","--dx2":(Math.random()*80-40)+"px","--rr":(Math.random()*600-300)+"deg",top:(sy(w)-30+Math.random()*30)+"px",animationDelay:(Math.random()*380)+"ms",fontSize:(16+Math.random()*12)+"px"}})}
function hitStop(ms){const b=$("battle");b.classList.add("hitstop");setTimeout(()=>b.classList.remove("hitstop"),ms)}
function knock(w,lv){
  const im=spriteEl(w),dir=w==="NPC"?1:-1;im.style.animation="none";void im.offsetWidth;
  im.style.setProperty("--dx",(dir*(lv>1?48:26))+"px");im.style.setProperty("--rot2",(dir*(lv>1?10:5))+"deg");
  im.style.setProperty("--gc",w==="NPC"?(lv>1?"#ffd34e":"#ffb13d"):"#ff4d6d");
  im.style.animation=`hurtKB ${lv>1?720:520}ms ease-out`;
}
function cineClear(){
  dimOn(null,false);
  document.querySelectorAll(".b-ghost,.b-skt,.b-speed").forEach(e=>e.remove());
  $("battle").classList.remove("hitstop");
}
function retrigger(el,cls){el.classList.remove(cls);void el.offsetWidth;el.classList.add(cls)}
function spriteAnim(who,name,dur,dx,gc,ease){
  const im=spriteEl(who);im.style.animation="none";void im.offsetWidth;
  im.style.setProperty("--dx",dx+"px");if(gc)im.style.setProperty("--gc",gc);
  im.style.animation=`${name} ${dur}ms ${ease||"ease-out"}`;
}
["MC","NPC"].forEach(w=>spriteEl(w).addEventListener("animationend",ev=>{
  if(ev.animationName==="ko")return;            // sprite kalah tetap tergeletak
  spriteEl(w).style.animation="";               // kembali ke gerakan idle (bob)
}));
const sy=w=>{const im=spriteEl(w);return im.offsetTop+im.offsetHeight/2};
function fxAdd(who,cls,o={}){
  const e=document.createElement("div");e.className="fx "+cls;if(o.text)e.textContent=o.text;
  for(const [k,v] of Object.entries(o.style||{}))k.startsWith("--")?e.style.setProperty(k,v):(e.style[k]=v);
  if(!o.style||!("top" in o.style))e.style.top=sy(who)+"px";
  unitEl(who).appendChild(e);setTimeout(()=>e.remove(),o.life||1200);return e;
}
function screenFx(flashCls,shake){
  const f=$("bFlash");f.className="b-flash";void f.offsetWidth;if(flashCls)f.className="b-flash "+flashCls;
  const b=$("battle");b.classList.remove("shk-s","shk-m","shk-b");
  if(shake){void b.offsetWidth;b.classList.add(shake)}
}
function hitUnit(who,lv){
  retrigger(unitEl(who),"hit");
  if(lv){
    knock(who,lv);const n=(BFR[who].hurt||[]).length;
    poseTimeline(who,poseSeq("hurt",[...Array(n).keys()],0,lv>1?125:90),lv>1?420:260);
  }else{
    spriteAnim(who,"hurt",380,0);
    poseTimeline(who,poseSeq("hurt",[0,1],0,130),150);
  }
}
function slashes(who,list,color,w){
  list.forEach(([r,dy,delay])=>fxAdd(who,"fx-slash",{life:800,style:{"--r":r+"deg","--c":color,"--w":(w||120)+"px",top:(sy(who)+dy)+"px",animationDelay:delay+"ms"}}));
}
function dmgNum(who,text,color,big){fxAdd(who,"fx-num"+(big?" big":""),{text,life:1150,style:{"--c":color,top:(spriteEl(who).offsetTop+30)+"px"}})}
function auraFx(who,color,glyph,n){
  const u=unitEl(who);u.style.setProperty("--gc",color);retrigger(u,"pulse");
  spriteAnim(who,"glow",1000,0,color,"ease-in-out");
  fxAdd(who,"fx-ring",{life:950,style:{"--c":color}});
  for(let i=0;i<n;i++)fxAdd(who,"fx-p",{text:glyph,life:1700,style:{"--c":color,"--x":(Math.random()*90-45)+"px",top:(sy(who)-8+Math.random()*34)+"px",fontSize:(14+Math.random()*10)+"px",animationDelay:(Math.random()*450)+"ms"}});
}
function resetBattleFx(){
  const b=$("battle");b.classList.remove("shk-s","shk-m","shk-b","intro");cineClear();
  $("bFlash").className="b-flash";$("bBanner").className="b-banner";$("rsConf").innerHTML="";
  ["MC","NPC"].forEach(w=>{poseClear(w);const u=unitEl(w);u.classList.remove("ko","hit","pulse");spriteEl(w).style.animation="";u.querySelectorAll(".fx").forEach(e=>e.remove())});
}
function battleIntro(){
  const b=$("battle");void b.offsetWidth;b.classList.add("intro");
  $("bBanner").classList.add("show");screenFx("f-white");
  setTimeout(()=>b.classList.remove("intro"),1500);
}

/* Tahap 1: gerakan pembuka (windup / lunge / aura). Return = ms sampai momen dampak */
const reach=k=>Math.round((unitEl("NPC").getBoundingClientRect().left-unitEl("MC").getBoundingClientRect().left)*k);
function startFx(before,after,a){
  if(before.turn==="NPC"){
    if(a==="attack"){                       // serangan biasa: cakar cepat, tanpa efek tebasan
      spriteAnim("NPC","lunge",420,-reach(.4));
      poseTimeline("NPC",[["attack",0,0],["attack",1,85],["attack",2,170]],230);
      return 250;
    }
    if(a==="skill"){                        // SKILL: charge merah + tumpukan kertas + dash + tebasan
      const C=640,D=700;
      dimOn("#3a0512d8",true);showTitle('"DEADLINE WOKK!!"',"#ff4d6d",true);
      chargeShake("NPC","#ff4d6d",C);auraBurst("NPC","#ff4d6d","📄",12,3,C);
      poseTimeline("NPC",[["attack",0,0],["attack",1,C*.4],["attack",1,C*.85],["attack",2,C],["attack",3,C+D*.22],["attack",4,C+D*.45],["attack",5,C+D*.7]],280);
      later(()=>spriteAnim("NPC","lungeQ",D,-reach(.44),"#ff4d6d"),C);
      ghostTrail("NPC","#ff4d6d",C,D*.72,50);
      later(()=>screenFx("f-red"),C-30);
      return Math.round(C+D*.72);
    }
    if(a==="heal"){auraFx("NPC","#57e389","+",9);return 250}
    fxAdd("NPC","fx-shield",{life:1100});return 250; // defend
  }
  if(a==="basic"){                          // basic: pukulan cepat, tanpa api
    spriteAnim("MC","lunge",420,reach(.4));
    poseTimeline("MC",[["attack",0,0],["attack",1,55],["attack",2,110],["attack",3,170],["attack",4,230]],150);
    return 250;
  }
  if(a==="skillE"){                         // SKILL E: aura oranye + dash berjejak + tebasan api
    const C=360,D=560;
    showTitle("SKILL  E","#ffb13d",false);
    chargeShake("MC","#ffb13d",C);auraBurst("MC","#ffb13d","▲",7,2,C);
    poseTimeline("MC",[["attack",0,0],["attack",1,C*.55],["attack",2,C],["attack",3,C+D*.24],["attack",4,C+D*.48],["attack",5,C+D*.71]],260);
    later(()=>spriteAnim("MC","lungeQ",D,reach(.44),"#ffb13d"),C);
    ghostTrail("MC","#ffb13d",C,D*.72,55);
    return Math.round(C+D*.72);
  }
  if(a==="skillQ"){                         // ULTIMATE: layar gelap, garis kecepatan, charge emas, dash panjang
    const C=900,D=780;
    dimOn("#160a3ae0",true);showTitle("ULTIMATE!","#ffd34e",true);speedOn("#ffffff",C);
    chargeShake("MC","#ffd34e",C);auraBurst("MC","#ffd34e","✦",16,4,C);
    later(()=>screenFx("f-white"),C-50);
    poseTimeline("MC",[["attack",0,0],["attack",1,C*.5],["attack",1,C*.85],["attack",2,C],["attack",3,C+D*.22],["attack",4,C+D*.46],["attack",5,C+D*.71]],340);
    later(()=>spriteAnim("MC","lungeQ",D,reach(.44),"#ffd34e"),C);
    ghostTrail("MC","#ffd34e",C,D*.72,40);
    return Math.round(C+D*.72);
  }
  if(before.item==="heal")auraFx("MC","#57e389","+",9);
  else if(before.item==="buff")auraFx("MC","#ffb13d","▲",8);
  else auraFx("MC","#4aa8ff","✦",8);
  return 250;
}
/* Tahap 2: dampak (setelah HP berubah) */
function impactFx(before,after,a){
  if(before.turn==="NPC"){
    const d=before.mc-after.mc;
    if(a==="attack"){                       // cakar biasa
      hitUnit("MC",0);
      slashes("MC",[[35,0,0]],"#ff5468",110);
      fxAdd("MC","fx-burst",{life:600,style:{"--c":"#ff5468","--s":5}});
      dmgNum("MC","-"+d,"#ff6b7d",false);screenFx("f-red","shk-s");
    }else if(a==="skill"){                  // SKILL: hantaman berat + hujan kertas
      hitStop(110);hitUnit("MC",2);
      arcs("MC",[[-20,-32,0],[25,8,60],[-55,40,120]],"#ff4d6d",200);
      slashes("MC",[[35,-14,0],[35,0,50],[35,14,100],[-35,0,150]],"#ff5468",170);
      fxAdd("MC","fx-burst",{life:700,style:{"--c":"#ff5468","--s":10}});
      fxAdd("MC","fx-ring",{life:950,style:{"--c":"#ff4d6d"}});
      papers("MC",14);
      dmgNum("MC","-"+d,"#ff6b7d",true);screenFx("f-red2","shk-m");
      later(()=>dimOn(null,false),260);
    }else if(a==="heal")dmgNum("NPC","+"+(after.npc-before.npc),"#7dffa8");
    else dmgNum("NPC","DEFEND","#7fd3ff");
    return;
  }
  if(a==="item"){
    if(before.item==="heal")dmgNum("MC","+"+(after.mc-before.mc),"#7dffa8",true);
    else if(before.item==="buff")dmgNum("MC","DMG ×1.5","#ffb13d");
    else dmgNum("MC","+"+(after.sp-before.sp)+" SP","#6fb8ff");
    return;
  }
  const d=before.npc-after.npc;
  if(a==="basic"){                          // pukulan biasa
    hitUnit("NPC",0);
    slashes("NPC",[[-35,0,0]],"#ffe08a",120);
    dmgNum("NPC","-"+d,"#ffe08a");screenFx("","shk-s");
  }else if(a==="skillE"){                   // SKILL E: tebasan api ganda
    hitStop(90);hitUnit("NPC",1);
    arcs("NPC",[[10,-12,0],[-28,22,70]],"#ffb13d",180);
    slashes("NPC",[[-35,0,0],[35,0,70]],"#ffb13d",160);
    fxAdd("NPC","fx-burst",{life:600,style:{"--c":"#ffb13d","--s":7}});
    fxAdd("NPC","fx-ring",{life:950,style:{"--c":"#ffb13d"}});
    dmgNum("NPC","-"+d,"#ffb13d",true);screenFx("f-orange","shk-m");
  }else{                                    // ULTIMATE: ledakan emas, knockback besar
    hitStop(160);hitUnit("NPC",2);
    arcs("NPC",[[0,-20,0],[-35,10,50],[35,20,100],[75,-30,150],[-70,35,200]],"#ffd34e",230);
    slashes("NPC",[[-35,0,0],[35,0,60],[90,0,120],[0,0,180]],"#c58bff",210);
    fxAdd("NPC","fx-burst",{life:800,style:{"--c":"#ffd34e","--s":13}});
    fxAdd("NPC","fx-burst",{life:900,style:{"--c":"#c58bff","--s":8}});
    fxAdd("NPC","fx-ring",{life:1000,style:{"--c":"#ffd34e"}});
    for(let i=0;i<12;i++)fxAdd("NPC","fx-p",{text:"✦",life:1500,style:{"--c":"#ffd34e","--x":(Math.random()*160-80)+"px",top:(sy("NPC")-20+Math.random()*70)+"px",fontSize:(16+Math.random()*14)+"px",animationDelay:(Math.random()*250)+"ms"}});
    dmgNum("NPC","-"+d,"#ffd34e",true);screenFx("f-gold","shk-b");
    later(()=>dimOn(null,false),300);
  }
}
function koFx(){
  const loser=bs.mc<=0?"MC":"NPC",winner=loser==="MC"?"NPC":"MC";
  unitEl(loser).classList.add("ko");
  spriteAnim(loser,"ko",900,0,null,"ease-in");poseOnce(loser,"death",900,0,null);later(()=>dimOn(null,false),200);
  spriteEl(loser).style.setProperty("--rot",(loser==="MC"?-80:80)+"deg");
  setTimeout(()=>{if(mode==="battle")spriteAnim(winner,"hop",700,0)},350);
}

function doAction(a){
  const before=bs,after=applyAct(bs,a),[t,c]=describe(before,after,a);
  const wait=startFx(before,after,a);
  setTimeout(()=>{
    if(mode!=="battle"||bs!==before)return;
    if(before.turn==="NPC")bTurns++;bs=after;logLine(t,c);impactFx(before,after,a);
    if(isTerminal(bs)){renderBattle();koFx();return setTimeout(finishBattle,1100)}
    bBusy=bs.turn==="NPC";renderBattle();
    if(bs.turn==="NPC")setTimeout(npcTurn,800);
  },wait);
}
function mcAct(a){
  if(mode!=="battle"||!bs||bs.turn!=="MC"||bBusy||isTerminal(bs))return;
  if(!legalActions(bs).includes(a))return;
  bBusy=true;doAction(a);
}
function fillResult(won){
  const r=$("bResult"),mc=Math.max(0,bs.mc),pct=mc/B.MC_HP,st=won?(pct>=.66?3:pct>=.33?2:1):0;
  r.classList.toggle("win",won);r.classList.toggle("lose",!won);$("bResTitle").style.color="";
  $("rsStars").innerHTML=Array.from({length:WIN_TARGET},(_,i)=>`<span class="${i<wins?"on":""}${won&&!bTest&&i===wins-1?" new":""}" style="animation-delay:${.5+i*.25}s">★</span>`).join("");
  $("rsStats").innerHTML=`<div><small>Sisa HP MC</small><b>${mc}/${B.MC_HP}</b></div><div><small>Sisa HP Villain</small><b>${Math.max(0,bs.npc)}/${B.NPC_HP}</b></div><div><small>Giliran villain</small><b>${bTurns}</b></div>`;
  $("rsProg").innerHTML=bTest?"<span>Mode test — nyawa &amp; poin tidak berubah</span>":`<span>Nyawa<b class="heart">${"♥".repeat(Math.max(0,lives))+"♡".repeat(Math.max(0,LIVES_START-lives))}</b></span><span>Bintang<b>${wins}/${WIN_TARGET}</b></span>`;
  const cf=$("rsConf");cf.innerHTML="";
  if(won)for(let i=0;i<40;i++){const e=document.createElement("i");e.style.cssText=`left:${Math.random()*100}%;background:hsl(${Math.random()*360},85%,60%);animation-duration:${2.2+Math.random()*2.2}s;animation-delay:${Math.random()*1.2}s`;cf.appendChild(e)}
}
function finishBattle(){
  const won=bs.npc<=0;
  if(!bTest){
    bStats.battles++;won?bStats.w++:bStats.l++;
    if(won)wins++;else lives--;
    player.item=bs.item;
    $("last").textContent=won?"Menang battle":"Kalah battle";
  }
  updateBattleStats();updateHUD();
  const T=$("bResTitle"),S=$("bResSub");
  if(won){T.textContent="MENANG!";T.style.color="var(--safe)";
    S.textContent=bTest?"Test battle selesai (tidak ada perubahan nyawa/poin).":`Poin +1 (${wins}/${WIN_TARGET}). Nyawa tetap ${lives}.`}
  else{T.textContent="DEADLINE WOKK!!";T.style.color="var(--danger)";
    S.textContent=bTest?"Test battle selesai (tidak ada perubahan nyawa/poin).":`Kamu kalah. Nyawa −1 (sisa ${lives}). Harus ngerjain tugas dulu...`}
  fillResult(won);$("bResult").classList.add("show");
}
function continueAfterBattle(){
  $("rsConf").innerHTML="";$("bResult").classList.remove("show");$("battle").classList.remove("show");
  if(!bTest){
    if(wins>=WIN_TARGET){mode="over";return showOver(true)}
    if(lives<=0){mode="over";return showOver(false)}
  }
  respawnNPCFar();mode="explore";
}
function fillOver(win){
  const o=$("overlay");o.classList.toggle("win",win);o.classList.toggle("lose",!win);
  $("ovIcon").textContent=win?"🏆":"💀";$("again").textContent=win?"Main Lagi":"Coba Lagi";
  $("ovStars").innerHTML=Array.from({length:WIN_TARGET},(_,i)=>`<span class="${i<wins?"on":""}" style="animation-delay:${.5+i*.3}s">★</span>`).join("");
  $("ovStats").innerHTML=`<div><small>Battle menang</small><b>${bStats.w}</b></div><div><small>Battle kalah</small><b>${bStats.l}</b></div><div><small>Nyawa</small><b class="heart">${"♥".repeat(Math.max(0,lives))+"♡".repeat(Math.max(0,LIVES_START-lives))}</b></div>`;
  const R=Math.random;let h=win?'<div class="rs-rays"></div>':"";
  for(let i=0;i<(win?70:40);i++)h+=win?`<i class="cf" style="left:${R()*100}%;background:hsl(${R()*360},85%,60%);animation-duration:${2.5+R()*2.5}s;animation-delay:${R()*3}s"></i>`:`<i class="em" style="left:${R()*100}%;width:${3+R()*5}px;height:${3+R()*5}px;animation-duration:${3+R()*4}s;animation-delay:${R()*4}s"></i>`;
  if(win)for(let i=0;i<14;i++)h+=`<b class="sp" style="left:${R()*100}%;top:${R()*100}%;animation-delay:${R()*2}s">✦</b>`;
  $("ovFx").innerHTML=h;
}
function showOver(win){
  const t=$("overTitle"),s=$("overSub");
  if(win){t.textContent="DEADLINE BERTAMBAH!";t.style.color="var(--safe)";s.textContent=`3 kemenangan! Deadline tugasmu nambah 3 hari. Gas main lagi!`;$("last").textContent="MENANG GAME"}
  else{t.textContent="GAME OVER";t.style.color="var(--danger)";s.textContent="Semua nyawa habis. Waktunya beneran ngerjain tugas...";$("last").textContent="GAME OVER"}
  fillOver(win);$("overlay").classList.add("show");
}

