/* Tes integrasi M3 memakai KODE GAME ASLI (tahap1 engine, tahap2 engine+ui, core/*) di Node dengan DOM palsu.
 * Jalankan dari folder tahap4-kb-planning:  node test/m3-integration-test.js
 * Butuh folder game di dua tingkat di atas (deadlinerun/). Jika file game tidak ada, tes dilewati. */
var fs = require("fs"), path = require("path"), vm = require("vm");
var T4 = path.join(__dirname, ".."), GAME = path.join(T4, "..");
var need = ["tahap1-pathfinding/engine.js", "tahap2-battle/engine.js", "core/state.js", "core/explore.js", "tahap2-battle/ui.js", "core/main.js"];
if (!need.every(function (f) { return fs.existsSync(path.join(GAME, f)); })) { console.log("SKIP: file game tidak ditemukan di " + GAME); process.exit(0); }

// ---------- DOM palsu ----------
var VAL = { algo: "manhattan", replan: "300", bAlgo: "alphabeta", bDepth: "4", bEval: "resource", bOrder: "heuristic" };
function el(id) {
  var store = { classList: { add() {}, remove() {}, toggle() { return false; }, contains() { return false; } }, style: { setProperty() {} }, dataset: {}, children: [], textContent: "", innerHTML: "", value: VAL[id] || "", checked: id === "debug" };
  return new Proxy(store, { get(t, p) { if (p in t) return t[p]; if (p === "getContext") return function () { return new Proxy({}, { get(_, q) { return q === "canvas" ? {} : function () {}; }, set() { return true; } }); }; if (p === "getBoundingClientRect") return function () { return { left: 0, top: 0, width: 10, height: 10 }; }; if (p === "querySelector") return function () { return el("q"); }; if (p === "querySelectorAll") return function () { return []; }; return function () { return el("c"); }; }, set(t, p, v) { t[p] = v; return true; } });
}
var els = {}; function getEl(id) { return els[id] || (els[id] = el(id)); }
var docStub = { getElementById: getEl, querySelector: function () { return null; }, querySelectorAll: function () { return []; }, createElement: function () { return el("n"); }, addEventListener() {}, readyState: "complete", body: el("body"), head: el("head"), fullscreenElement: null, documentElement: el("html") };
var rafCbs = [];
var ctx = { console: console, Date: Date, Math: Math, performance: performance, setTimeout: setTimeout, clearTimeout: clearTimeout, setInterval: function () {}, document: docStub,
  requestAnimationFrame: function (f) { rafCbs.push(f); }, getComputedStyle: function () { return { display: "block" }; },
  Image: function () { this.complete = false; this.naturalWidth = 0; }, addEventListener() {}, TERRAIN: undefined };
ctx.window = ctx; vm.createContext(ctx);
function load(f) { vm.runInContext(fs.readFileSync(path.join(GAME, f), "utf8"), ctx, { filename: f }); }
vm.runInContext("var img={player:{front:{src:''}},npc:{front:{src:''}}},mapTileset={complete:false},SPRITE_ROW={},SPRITE_FRAMES=4,SPRITE_W=32,SPRITE_H=48;", ctx);
// fungsi dari tahap2 debug/lab/defs yang dirujuk main.js/ui.js (tidak relevan untuk tes ini)
vm.runInContext("function runExperiment(){}function labCopy(){}function labDownload(){}function buildDefs(){}function compareOnState(){}function showDebug(){}", ctx);
["tahap1-pathfinding/engine.js", "tahap2-battle/engine.js", "core/state.js", "core/explore.js", "tahap2-battle/ui.js", "core/main.js"].forEach(load);
["lib/tau-prolog.js", "kb/kb-rules.js", "kb/kb-compiler.js", "kb/kb-engine.js", "planning/pddl-parser.js", "planning/domain.pddl.js", "planning/planner.js", "planning/zonegraph.js", "npc/agent-loop.js", "npc/world-adapter.js"].forEach(function (f) { vm.runInContext(fs.readFileSync(path.join(T4, f), "utf8"), ctx, { filename: f }); });
function R(code) { return vm.runInContext(code, ctx); }

var fails = 0; function check(n, c) { console.log((c ? "PASS " : "FAIL ") + n); if (!c) fails++; }
R("var kbx=new KBEngine(KB_DATA,KBCompiler); var world=TahapAdapter.makeWorld({}); var AG=new Tahap4Agent(world,kbx,{Planner:Planner,DOMAIN_PDDL:DOMAIN_PDDL,buildProblemPDDL:buildProblemPDDL}); TahapAdapter.install(AG); AG.reset(); started=true;");
function frames(n, dt) { for (var i = 0; i < n; i++) R("updateExplore(" + (dt || 50) + ")"); }
function ev(type) { return R("AG.events").filter(function (e) { return !type || e.type === type; }); }
function show(types) { R("AG.events").filter(function (e) { return !types || types.indexOf(e.type) >= 0; }).forEach(function (e) { console.log("   [" + (e.t / 1000).toFixed(1) + "s] " + e.type + " " + e.text); }); }

// A. zona sanity
var val = R("ZoneGraph.validate({COLS:COLS,ROWS:ROWS,isWalkable:isWalkable,searchPath:searchPath},KB_DATA.zoneEdges,ZONE_CENTERS)");
check("A. zona valid (ok=true) pada peta asli", val.ok);

// B. HEAL end-to-end: Tugas terluka -> Revisi plan -> ambil kunci, buka gerbang, ambil kopi -> heal
R("graceMs=0; player.x=1; player.y=1; npc.x=38; npc.y=38;");
R("AG.hurtTugas(400)"); R("AG.E.dosen.restUntil=1e12; AG.E.dosen.path=[]; AG.E.dosen.x=19; AG.E.dosen.y=8;");
R("graceMs=1e9"); // jaga agar Tugas tak menangkap MC selama simulasi (graceMs dioverride adapter saat beku)
var healed = false;
for (var i = 0; i < 4000 && !healed; i++) { R("graceMs=Math.max(graceMs,1)"); R("updateExplore(50)"); healed = R("AG.stats.heals") > 0; }
show(["GOAL", "PLAN", "REPLAN", "ACT", "EFFECT"]);
check("B. Revisi berhasil heal Tugas", healed);
check("B. HP Tugas naik +300 (400 -> 700)", R("AG.tugas.hp") === 700);
check("B. plan memuat open-gate & pickup", ev("PLAN").some(function (e) { return /open-gate/.test(e.text) && /pickup/.test(e.text); }));
check("B. gerbang Lab terbuka & Revisi tak membawa kopi lagi", R("AG.gate.lab") === true && R("AG.E.revisi.has.kopi") === false);
check("B. alasan KB tercatat (R5)", ev("GOAL").some(function (e) { return (e.rules || []).indexOf("R5") >= 0; }));

// C. RETREAT: Dosen dipanggil ke Tugas
R("reset(); started=true; graceMs=0; npc.x=20; npc.y=18; player.x=1; player.y=1;"); // Tugas di Lorong
R("AG.summonDosen()");
var t0 = R("AG.clock"), retreated = false, back = false, sawFrozen = false, zeroMove = true, lastPos = null;
for (i = 0; i < 1200; i++) {
  R("updateExplore(50)");
  if (R("AG.tugas.state") === "retreat") { retreated = true; sawFrozen = sawFrozen || R("graceMs") > 1000; }
  if (retreated && R("AG.tugas.state") === "chase") { back = true; break; }
}
show(["ASK", "ACT", "EFFECT"]);
check("C. Tugas mundur (state retreat) saat sezona dengan Dosen", retreated);
check("C. game dibekukan lewat graceMs (tak mengejar/battle)", sawFrozen);
check("C. Tugas sampai Kos lalu lanjut mengejar setelah retreatMs", back && ev("ACT").some(function (e) { return /Tugas tiba di Kos/.test(e.text); }));
check("C. alasan KB tercatat (R6)", ev("ASK").some(function (e) { return (e.rules || []).indexOf("R6") >= 0; }));

// C2. RETREAT berdasarkan JARAK (R8): Dosen 8 tile dari Tugas tetapi beda zona
R("reset(); started=true; npc.x=20; npc.y=18; player.x=1; player.y=1; AG.E.dosen.x=19; AG.E.dosen.y=11; AG.E.dosen.path=[]; AG.E.dosen.restUntil=1e12; AG.E.laporan.restUntil=1e12; AG.E.revisi.x=36; AG.E.revisi.y=37;");
for (i = 0; i < 60; i++) R("updateExplore(50)");
check("C2. beda zona tapi dalam radius -> Tugas retreat lewat R8", R("AG.tugas.state") === "retreat" && ev("ASK").some(function (e) { return (e.rules || []).indexOf("R8") >= 0; }));
R("reset(); started=true; npc.x=20; npc.y=18; player.x=1; player.y=1; AG.E.dosen.x=19; AG.E.dosen.y=6; AG.E.dosen.path=[]; AG.E.dosen.restUntil=1e12; AG.E.laporan.restUntil=1e12; AG.E.revisi.x=36; AG.E.revisi.y=37;");
for (i = 0; i < 60; i++) R("updateExplore(50)");
check("C2. Dosen di luar radius (12 tile) -> Tugas tetap mengejar", R("AG.tugas.state") === "chase");

// D. ALERT + CEGAT: Laporan melihat MC -> Revisi cegat di Lorong -> MC tertahan
R("reset(); started=true; graceMs=0; npc.x=38; npc.y=38; player.x=9; player.y=16;");  // MC dekat Perpus
R("AG.E.laporan.x=9; AG.E.laporan.y=14; AG.E.laporan.path=[]; AG.E.laporan.restUntil=1e12;");  // Laporan diam dekat MC
R("AG.E.dosen.restUntil=1e12; AG.E.dosen.path=[]; AG.E.dosen.x=19; AG.E.dosen.y=8;");
R("AG.tugas.state='retreat'; AG.tugas.phase='hold'; AG.tugas.until=1e12;");  // Tugas dibekukan agar tidak menangkap MC selama simulasi
var blocked = false, goalBlock = false;
for (i = 0; i < 1500 && !blocked; i++) {
  R("updateExplore(50)");
  if (R("AG.E.revisi.goalKey") && /^block:/.test(R("AG.E.revisi.goalKey"))) goalBlock = true;
  // MC berjalan ke arah Revisi bila Revisi sudah di tempat cegat
  if (R("AG.E.revisi.doneKey") === R("AG.E.revisi.goalKey") && R("AG.E.revisi.goalKey")) { R("player.x=AG.E.revisi.x; player.y=AG.E.revisi.y+1;"); }
  blocked = R("AG.stats.blocks") > 0;
}
show(["TELL", "GOAL", "PLAN", "ACT", "EFFECT"].slice(1));
check("D. should_block terbukti -> goal cegat", goalBlock);
check("D. Revisi mencegat MC (efek tertahan)", blocked && R("AG.mcFrozen()") === true);
check("D. playerMove diblokir saat tertahan", (function () { var x = R("player.x"), y = R("player.y"); R("playerMove(1,0);playerMove(0,1);"); return R("player.x") === x && R("player.y") === y; })());
check("D. alasan KB tercatat (R7)", ev("GOAL").some(function (e) { return (e.rules || []).indexOf("R7") >= 0; }));

// G. Laporan membuntuti MC (jarak ~shadowDist) ; H. Revisi mendampingi Tugas ; I. Revisi menyergap MC
var FZ_D='AG.E.dosen.restUntil=1e12; AG.E.dosen.path=[]; AG.E.dosen.x=19; AG.E.dosen.y=8; AG.tugas.state="retreat"; AG.tugas.phase="hold"; AG.tugas.until=1e12;';
R("reset(); started=true; player.x=9; player.y=22; npc.x=38; npc.y=38; AG.E.laporan.x=9; AG.E.laporan.y=14; AG.E.laporan.path=[]; AG.E.laporan.restUntil=0; AG.E.revisi.x=36; AG.E.revisi.y=37;" + FZ_D);
for (i = 0; i < 200; i++) R("updateExplore(50)");
var dLM = R("Math.abs(AG.E.laporan.x-player.x)+Math.abs(AG.E.laporan.y-player.y)");
check("G. Laporan membuntuti MC (shadow aktif, jarak " + dLM + " tile, 4..8)", R("AG.E.laporan.shadow") === true && dLM >= 4 && dLM <= 8);
R("player.x=30; player.y=2;");   // MC kabur jauh
for (i = 0; i < 120; i++) R("updateExplore(50)");
check("G. MC hilang dari pandangan -> Laporan kembali patroli", R("AG.E.laporan.shadow") === false);

R("reset(); started=true; graceMs=6e7; player.x=1; player.y=1; npc.x=36; npc.y=11; AG.E.dosen.restUntil=1e12; AG.E.dosen.x=19; AG.E.dosen.y=8; AG.E.laporan.restUntil=1e12; AG.E.revisi.x=24; AG.E.revisi.y=21;");
for (i = 0; i < 500; i++) R("updateExplore(50)");
var dRT = R("Math.abs(AG.E.revisi.x-npc.x)+Math.abs(AG.E.revisi.y-npc.y)");
check("H. Revisi mendampingi Tugas (jarak " + dRT + " <= 4)", dRT <= 4);

R("reset(); started=true; player.x=9; player.y=16; npc.x=38; npc.y=38; AG.E.laporan.x=9; AG.E.laporan.y=14; AG.E.laporan.path=[];" + FZ_D);
for (i = 0; i < 400 && R("AG.E.revisi.doneKey") !== R("AG.E.revisi.goalKey"); i++) R("updateExplore(50)");
R("player.x=14; player.y=16;");   // MC diam 8 tile dari Revisi
for (i = 0; i < 600 && R("AG.stats.blocks") === 0; i++) R("updateExplore(50)");
check("I. Revisi menyergap MC (bergerak mendekat) lalu menahan", R("AG.stats.blocks") > 0 && ev("ACT").some(function (e) { return /menyergap/.test(e.text); }));

// J. Revisi SUDAH di chokepoint saat goal cegat terbentuk -> plan 0 langkah tidak boleh crash
R("reset(); started=true; graceMs=0; npc.x=38; npc.y=38; player.x=9; player.y=16; AG.E.revisi.x=20; AG.E.revisi.y=18; AG.E.revisi.path=[];");
R("AG.E.laporan.x=9; AG.E.laporan.y=14; AG.E.laporan.path=[]; AG.E.laporan.restUntil=1e12; AG.E.dosen.restUntil=1e12; AG.E.dosen.path=[]; AG.E.dosen.x=19; AG.E.dosen.y=8;");
R("AG.tugas.state='retreat'; AG.tugas.phase='hold'; AG.tugas.until=1e12;");
var jOk = true; try { for (i = 0; i < 80; i++) R("updateExplore(50)"); } catch (e) { jOk = false; }
check("J. plan 0 langkah (Revisi sudah di chokepoint) tidak crash, goal selesai", jOk && /^block:/.test(R("AG.E.revisi.goalKey") || "") && R("AG.E.revisi.doneKey") === R("AG.E.revisi.goalKey"));

// D2. ALERT membatalkan grace Tugas setelah respawn
R("reset(); started=true; mode='explore'; player.x=9; player.y=16; npc.x=38; npc.y=38; graceMs=2500; AG.E.laporan.x=9; AG.E.laporan.y=14; AG.E.laporan.path=[]; AG.E.laporan.restUntil=1e12;");
R("AG.E.dosen.restUntil=1e12; AG.E.dosen.path=[]; AG.E.dosen.x=19; AG.E.dosen.y=8;");
for (i = 0; i < 40; i++) R("updateExplore(50)");
check("D2. ALERT: grace Tugas dibatalkan, tercatat 1x", R("AG.stats.alerts") === 1 && R("graceMs") < 1500);

// E. HP carry-over lewat hook battle ASLI (startBattle/finishBattle)
R("reset(); started=true; graceMs=0; mode='explore'; player.x=1;player.y=1;npc.x=38;npc.y=38; AG.tugas.hp=500;");
R("startBattle(false)");
check("E. battle mulai dengan HP Tugas terbawa (500)", R("mode")==="battle" && R("bs.npc") === 500);
R("bs.npc=420; bs.mc=0; bTest=false; finishBattle();");
check("E. MC kalah -> HP Tugas terbawa (420)", R("AG.tugas.hp") === 420);
R("mode='explore'; startBattle(false); bs.npc=0; finishBattle();");
check("E. MC menang -> HP Tugas reset penuh (1100)", R("AG.tugas.hp") === 1100);
R("mode='explore'; startBattle(true);");
check("E. test battle tidak memakai HP terbawa", R("bs.npc") === 1100);

// F. replan saat Tugas bergerak (freezeTugasOnHeal=false)
R("reset(); started=true; AG.setConfig('freezeTugasOnHeal',false); mode='explore'; graceMs=0; player.x=1;player.y=1;npc.x=38;npc.y=38; AG.hurtTugas(400);");
R("AG.E.dosen.restUntil=1e12; AG.E.dosen.path=[]; AG.E.dosen.x=19; AG.E.dosen.y=8; AG.E.laporan.restUntil=1e12;");
var Ztugas = [[38,38],[36,30],[30,24],[24,21],[20,18],[12,16],[9,16]], zi = 0;
for (i = 0; i < 700; i++) { R("graceMs=Math.max(graceMs,1)"); if (i % 90 === 0 && zi < Ztugas.length) { R("npc.x=" + Ztugas[zi][0] + "; npc.y=" + Ztugas[zi][1] + ";"); zi++; } R("updateExplore(50)"); }
console.log("   replan:", R("AG.stats.replans"), " plan:", R("AG.stats.plans"));
check("F. Tugas yang berpindah memicu REPLAN", R("AG.stats.replans") > 0);

console.log(fails ? "\nGAGAL: " + fails : "\nSEMUA LULUS"); process.exit(fails ? 1 : 0);
