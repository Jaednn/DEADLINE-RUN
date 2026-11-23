/* =====================================================================
   TAHAP 2 — GAME LOOP, ITEM, BATTLE UI, DEBUG, EXPERIMENT LAB
   ===================================================================== */
const canvas=document.getElementById("game"),ctx=canvas.getContext("2d");ctx.imageSmoothingEnabled=false;
const $=id=>document.getElementById(id);
// ---------- Start menu / debug sebelum villain bergerak ----------

function hideStartScreen(){
  const s = $("startScr");
  if(s) s.classList.add("hide");
}

const PLAYER_MS=150,NPC_MS=130,GRACE_MS=2500,TRIGGER_DIST=1,FAR_DIST=22;
const WIN_TARGET=3,LIVES_START=3,MAX_ITEMS=4,ITEM_RESPAWN_MS=3500;
const ITEM_COLOR={heal:"#ff5a5a",buff:"#ffb13d",sp:"#4aa8ff"};

let player,npc,mode,lives,wins,items,itemQueue,graceMs,toastTimer;
let lastPlan={explored:[],path:[]},nodesLast=0,totalNodes=0,replans=0,history=[];
let pAcc=0,nAcc=0,rAcc=0,lastPlayerTile="",keys=new Set();
let bTurns=0;let bs=null,bBusy=false,bTest=false,bLog=[],bStats={battles:0,w:0,l:0,decisions:0,nodes:0},lastDbg=null;

