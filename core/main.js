/* ======================= EVENTS & LOOP ======================= */
window.addEventListener("keydown",e=>{
  const k=e.key.toLowerCase();
  if(!started){if(k==="enter"||k===" "){startGame();e.preventDefault()}return}
  if(k==="m"&&!e.ctrlKey&&!e.metaKey&&!e.altKey){
    const menuBtn=$("openMenu");
    if(menuBtn)menuBtn.click();
    e.preventDefault();
    return;
  }
  if(k==="o"&&!e.ctrlKey&&!e.metaKey&&!e.altKey){
    // O membuka/menutup debug overlay yang tersedia pada mode saat ini.
    const debugBtn = mode==="battle" ? $("openD2") : $("openD1");
    if(debugBtn && getComputedStyle(debugBtn).display!=="none") debugBtn.click();
    e.preventDefault();
    return;
  }
  if(document.querySelector(".modal.show"))return;
  if(k==="f"&&!e.ctrlKey&&!e.metaKey&&!e.altKey){toggleFS();return}
  if(mode==="battle"){
    const m={"1":"basic","j":"basic","2":"skillE","e":"skillE","3":"skillQ","q":"skillQ","4":"item","r":"item"};
    if(m[k]){mcAct(m[k]);e.preventDefault()}return;
  }
  keys.add(k);if(["arrowup","arrowdown","arrowleft","arrowright"," "].includes(k))e.preventDefault();
});
window.addEventListener("keyup",e=>keys.delete(e.key.toLowerCase()));
$("btnBasic").onclick=()=>mcAct("basic");$("btnE").onclick=()=>mcAct("skillE");
$("btnQ").onclick=()=>mcAct("skillQ");$("btnItem").onclick=()=>mcAct("item");
$("bContinue").onclick=continueAfterBattle;
$("restart").onclick=reset;$("again").onclick=reset;
$("testBattle").onclick=()=>{if(mode==="explore")startBattle(true)};
$("aiDebug").addEventListener("click",e=>{if(e.target.id==="cmpBtn")compareOnState()});
$("openLab").onclick=()=>$("lab").classList.add("show");$("labClose").onclick=()=>$("lab").classList.remove("show");
$("openDefs").onclick=()=>{buildDefs();$("defs").classList.add("show")};$("defsClose").onclick=()=>$("defs").classList.remove("show");
$("labRun").onclick=runExperiment;$("labCopy").onclick=labCopy;$("labDl").onclick=labDownload;
$("algo").onchange=()=>{lastPlan.path=[];planNPC()};
$("replan").onchange=()=>{lastPlan.path=[];rAcc=9999};

function toggleFS(){const d=document,el=d.documentElement;if(d.fullscreenElement)d.exitFullscreen();else if(el.requestFullscreen)el.requestFullscreen().catch(()=>{})}
$("openD1").onclick=()=>$("pop1").classList.toggle("show");$("openD2").onclick=()=>$("pop2").classList.toggle("show");
$("pop1x").onclick=()=>$("pop1").classList.remove("show");$("pop2x").onclick=()=>$("pop2").classList.remove("show");
$("openMenu").onclick=()=>{
  const menu=$("menu");
  if(!menu)return;

  // Sama seperti tombol debug: klik lagi pada tombol MENU akan menutupnya.
  const isOpen=menu.classList.contains("show");
  if(isOpen){
    menu.classList.remove("show");
    if(mode==="battle"){
      bBusy=false;
      renderBattle();
    }
    return;
  }

  if(mode==="battle"){
    bBusy=true;
    renderBattle();
  }
  menu.classList.add("show");
};
$("menuClose").onclick=()=>{
  $("menu").classList.remove("show");
  if(mode==="battle"){
    // Jika sedang giliran NPC, lanjutkan AI setelah menu ditutup.
    if(bs&&bs.turn==="NPC"&&!isTerminal(bs)&&!bBusy){
      npcTurn();
    }else{
      renderBattle();
    }
  }
};

// Menu saat battle: tombol yang sama tetap bisa dipakai tanpa mengakhiri battle.
const menuModal=$("menu");
if(menuModal){
  const menuHead=menuModal.querySelector(".modal-head h2");
  const originalMenuTitle=menuHead?menuHead.textContent:"MENU";
  menuModal.addEventListener("click",()=>{
    if(mode==="battle" && menuHead) menuHead.textContent="MENU — BATTLE PAUSED";
  });
}

let started=false,prevMode=null;
function startGame(){started=true;$("startScr").classList.add("hide")}
$("startBtn").onclick=startGame;
function syncMode(){
  if(mode===prevMode)return;prevMode=mode;document.body.dataset.mode=mode;
  if(mode==="battle")$("pop1").classList.remove("show");else $("pop2").classList.remove("show");
}
let lastTs=null;
function loop(ts){
  if(lastTs===null)lastTs=ts;const dt=Math.min(100,ts-lastTs);lastTs=ts;
  if(mode==="explore"&&started&&!document.querySelector(".modal.show"))updateExplore(dt);syncMode();
  render();requestAnimationFrame(loop);
}
reset();requestAnimationFrame(loop);


// ---------- Controls tambahan ----------
document.addEventListener("DOMContentLoaded",()=>{
  const sb=$("startBtn");
  if(sb) sb.addEventListener("click",()=>{
    started=true;
    hideStartScreen();
  });

});

