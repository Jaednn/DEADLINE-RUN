/* ---------- reachable tiles (agar item/NPC tidak spawn di area terisolasi) ---------- */
const reachable=(()=>{
  const seen=new Set(["1,1"]),q=[{x:1,y:1}];
  while(q.length){const c=q.shift();
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const x=c.x+dx,y=c.y+dy,k=x+","+y;
      if(isWalkable(x,y)&&!seen.has(k)){seen.add(k);q.push({x,y})}
    }}
  return [...seen].map(k=>{const [x,y]=k.split(",").map(Number);return{x,y}});
})();
const dist=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
function pickTile(filter){
  const c=reachable.filter(filter);
  return c.length?c[Math.floor(Math.random()*c.length)]:null;
}

/* ---------- item di map ---------- */
function spawnItem(){
  const r=Math.random(),type=r<.4?"heal":r<.7?"buff":"sp";
  const t=pickTile(p=>dist(p,player)>=5&&dist(p,npc)>=3&&!items.some(i=>i.x===p.x&&i.y===p.y));
  if(t)items.push({x:t.x,y:t.y,type});
}
function toast(msg){
  const t=$("toast");t.textContent=msg;t.classList.add("show");
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove("show"),2600);
}

/* ---------- reset / flow ---------- */
function reset(){
  started=false;
  $("startScr").classList.remove("hide");
  $("menu").classList.remove("show");
  $("overlay").classList.remove("show");
  $("bResult").classList.remove("show");
  player={x:1,y:1,dir:"front",moving:false,item:null};
  npc={x:38,y:38,dir:"left",moving:false};
  mode="explore";lives=LIVES_START;wins=0;items=[];itemQueue=[];graceMs=0;
  lastPlan={explored:[],path:[]};nodesLast=0;totalNodes=0;replans=0;history=[];
  pAcc=nAcc=rAcc=0;lastPlayerTile="";bs=null;bBusy=false;
  $("overlay").classList.remove("show");$("battle").classList.remove("show");$("bResult").classList.remove("show");
  for(let i=0;i<MAX_ITEMS;i++)spawnItem();
  updateHUD();updateStats();planNPC();
}
function respawnNPCFar(){
  let t=pickTile(p=>dist(p,player)>=FAR_DIST);
  if(!t){t=reachable.slice().sort((a,b)=>dist(b,player)-dist(a,player))[0]}
  npc.x=t.x;npc.y=t.y;graceMs=GRACE_MS;lastPlan={explored:[],path:[]};rAcc=9999;
}

/* ---------- pathfinding (tahap 1) ---------- */
function planNPC(){
  const res=searchPath(npc,player,$("algo").value);
  lastPlan={explored:res.explored,path:res.path};nodesLast=res.nodesExpanded;totalNodes+=res.nodesExpanded;replans++;history.push(res.nodesExpanded);
  updateHUD();updateStats();
}
function setDir(e,dx,dy){if(dx>0)e.dir="right";else if(dx<0)e.dir="left";else if(dy<0)e.dir="back";else if(dy>0)e.dir="front"}
function playerMove(dx,dy){
  const nx=player.x+dx,ny=player.y+dy;if(!isWalkable(nx,ny))return;
  setDir(player,dx,dy);player.x=nx;player.y=ny;player.moving=true;
  const idx=items.findIndex(i=>i.x===nx&&i.y===ny);
  if(idx>=0){
    if(!player.item){
      const it=items.splice(idx,1)[0];player.item=it.type;itemQueue.push(ITEM_RESPAWN_MS);
      toast(`Mengambil ${ITEM_INFO[it.type].name} (${ITEM_INFO[it.type].desc})`);updateHUD();
    }else toast("Slot item penuh — bawa maksimal 1 item. Pakai dulu saat battle.");
  }
}
function npcMove(){
  if(lastPlan.path.length<=1)return;
  const next=lastPlan.path[1];setDir(npc,next.x-npc.x,next.y-npc.y);
  npc.x=next.x;npc.y=next.y;npc.moving=true;lastPlan.path.shift();
}

function updateExplore(dt){
  player.moving=false;npc.moving=false;
  graceMs=Math.max(0,graceMs-dt);
  pAcc+=dt;
  if(pAcc>=PLAYER_MS){pAcc=0;let dx=0,dy=0;
    if(keys.has("w")||keys.has("arrowup"))dy=-1;else if(keys.has("s")||keys.has("arrowdown"))dy=1;
    else if(keys.has("a")||keys.has("arrowleft"))dx=-1;else if(keys.has("d")||keys.has("arrowright"))dx=1;
    if(dx||dy)playerMove(dx,dy)}
  if(graceMs<=0){
    const rs=$("replan").value;
    if(rs==="tile"){const k=player.x+","+player.y;if(k!==lastPlayerTile){lastPlayerTile=k;planNPC()}if(lastPlan.path.length===0)planNPC()}
    else{rAcc+=dt;if(rAcc>=parseInt(rs)||lastPlan.path.length===0){rAcc=0;planNPC()}}
    nAcc+=dt;if(nAcc>=NPC_MS){nAcc=0;npcMove()}
  }
  for(let i=itemQueue.length-1;i>=0;i--){itemQueue[i]-=dt;if(itemQueue[i]<=0){itemQueue.splice(i,1);if(items.length<MAX_ITEMS)spawnItem()}}
  if(graceMs<=0&&dist(player,npc)<=TRIGGER_DIST)startBattle(false);
}

/* ---------- render peta ---------- */
function drawTile(c,r,t){
  const x=c*TILE,y=r*TILE;
  if(mapTileset.complete&&mapTileset.naturalWidth)ctx.drawImage(mapTileset,x,y,TILE,TILE,x,y,TILE,TILE);
  else{ctx.fillStyle=TERRAIN[t].color;ctx.fillRect(x,y,TILE,TILE)}
}
function drawEntity(entity,isNPC){
  const onWater=terrainCostAt(entity.x,entity.y)===5;
  const moving=isNPC?(lastPlan.path.length>1&&graceMs<=0):!!entity.moving;
  const group=isNPC?img.npc:img.player;
  let sheet;
  if(onWater)sheet=group.swim;else sheet=moving?group.walk:group.idle;
  const row=SPRITE_ROW[entity.dir]??0;
  const frame=moving?Math.floor(performance.now()/120)%SPRITE_FRAMES:0;
  const cx=entity.x*TILE+8,cy=entity.y*TILE+8;
  ctx.save();ctx.translate(cx,cy);
  if(sheet&&sheet.complete&&sheet.naturalWidth){
    const sx=frame*SPRITE_W,sy=row*SPRITE_H;
    if(onWater)ctx.drawImage(sheet,sx,sy,SPRITE_W,SPRITE_H,-19,-15,38,30);
    else ctx.drawImage(sheet,sx,sy,SPRITE_W,SPRITE_H,-16,-24,32,43);
  }else{ // fallback: gambar tunggal per arah (embedded base64) bila folder assets/ tidak ada
    const li=(onWater&&group.swim&&group.swim.naturalWidth&&!group.swim.src.includes("assets/"))?group.swim:group[entity.dir]||group.front;
    if(li&&li.complete&&li.naturalWidth){const h=onWater?18:30,w=li.naturalWidth/li.naturalHeight*h;ctx.drawImage(li,-w/2,onWater?-10:-22,w,h)}
    else{ctx.fillStyle=isNPC?"#e5533d":"#3fa9f5";ctx.beginPath();ctx.arc(0,0,6,0,7);ctx.fill()}
  }
  ctx.strokeStyle=isNPC?"#ff8b73":"#ffe27a";ctx.globalAlpha=.75;ctx.lineWidth=1;ctx.strokeRect(-7,-7,14,14);ctx.restore();
}
function drawItem(it){
  const x=it.x*TILE+8,y=it.y*TILE+8,bob=Math.sin(performance.now()/260+it.x)*1.2;
  ctx.save();ctx.translate(x,y+bob);
  ctx.fillStyle="#00000055";ctx.fillRect(-4,5,8,2);
  ctx.fillStyle="#e9f3ff";ctx.fillRect(-2,-7,4,3);           // leher botol
  ctx.fillStyle=ITEM_COLOR[it.type];ctx.fillRect(-5,-4,10,10); // badan
  ctx.fillStyle="#ffffff99";ctx.fillRect(-3,-2,2,5);          // kilau
  ctx.strokeStyle="#111";ctx.lineWidth=1;ctx.strokeRect(-5.5,-4.5,11,11);
  ctx.restore();
}
function render(){
  ctx.clearRect(0,0,640,640);
  for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++)drawTile(c,r,grid[r][c]);
  if($("debug").checked&&mode==="explore"&&$("pop1").classList.contains("show")){
    ctx.fillStyle="rgba(255,225,225,.50)";for(const n of lastPlan.explored)ctx.fillRect(n.x*TILE+2,n.y*TILE+2,12,12);
    if(lastPlan.path.length>1){ctx.strokeStyle="#ffe26b";ctx.lineWidth=4;ctx.beginPath();lastPlan.path.forEach((p,i)=>{const x=p.x*TILE+8,y=p.y*TILE+8;i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.stroke()}
  }
  items.forEach(drawItem);
  drawEntity(player,false);drawEntity(npc,true);
  if(graceMs>0){ctx.fillStyle="#ffe27acc";ctx.font="bold 11px sans-serif";ctx.textAlign="center";ctx.fillText("...",npc.x*TILE+8,npc.y*TILE-14)}
}

/* ---------- HUD ---------- */
function itemLabel(t){return t?ITEM_INFO[t].name:"—"}
function updateHUD(){
  $("hudLives").textContent="♥".repeat(Math.max(0,lives))+"♡".repeat(Math.max(0,LIVES_START-lives));
  $("hudWins").textContent="★".repeat(wins)+"☆".repeat(Math.max(0,WIN_TARGET-wins));
  $("hudItem").textContent=itemLabel(player.item);
  $("hudNodes").textContent=nodesLast;$("hudTotal").textContent=totalNodes;
  $("replanStat").textContent=replans;
}
function updateStats(){
  if(!history.length){$("avg").textContent="—";$("minmax").textContent="—";return}
  $("avg").textContent=(history.reduce((a,b)=>a+b,0)/history.length).toFixed(1);
  $("minmax").textContent=Math.min(...history)+" / "+Math.max(...history);
}
function updateBattleStats(){
  $("stBattle").textContent=bStats.w+" / "+bStats.l;$("stDec").textContent=bStats.decisions;
  $("stNodes").textContent=bStats.nodes;$("stAvgNodes").textContent=bStats.decisions?(bStats.nodes/bStats.decisions).toFixed(1):"—";
}

