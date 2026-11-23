/* world-adapter.js -- SATU-SATUNYA file tahap 4 yang menyentuh variabel/fungsi game.
 * Pola sama dengan tahap 3: membungkus (wrap) fungsi global tahap 1-3, tanpa mengedit file mereka.
 *   Dibungkus: updateExplore, playerMove, render, startBattle, finishBattle, continueAfterBattle, reset
 *   Dibaca   : player, npc, graceMs, mode, bs, bTest, img, ctx, B, TILE, searchPath, drawEntity, renderBattle, toast
 * Panggil TahapAdapter.install(agent) sekali setelah semua script dimuat. */
var TahapAdapter = (function () {
  var A = null, frozenPrev = false, installed = false;
  var LOOK = {   // tint sprite Tugas (hue-rotate relatif). Sesuaikan bila kurang kontras.
    revisi:  { hue: 150, sat: 1.3, bri: 1.1,  color: "#2fd6a1", badge: "✚", name: "REVISI" },
    laporan: { hue: 48,  sat: 1.6, bri: 1.35, color: "#ffc233", badge: "!", name: "LAPORAN" },
    dosen:   { hue: 250, sat: 1.1, bri: 0.7,  color: "#8a6cff", badge: "♛", name: "DOSEN" }
  };
  var tinted = {};

  function tintCanvas(src, o) {
    var c = document.createElement("canvas"); c.width = src.naturalWidth; c.height = src.naturalHeight;
    var x = c.getContext("2d"); x.imageSmoothingEnabled = false;
    if ("filter" in x) { x.filter = "hue-rotate(" + o.hue + "deg) saturate(" + o.sat + ") brightness(" + o.bri + ")"; x.drawImage(src, 0, 0); }
    else { x.drawImage(src, 0, 0); x.globalCompositeOperation = "source-atop"; x.globalAlpha = 0.5; x.fillStyle = o.color; x.fillRect(0, 0, c.width, c.height); }
    c.complete = true; c.naturalWidth = c.width; c.naturalHeight = c.height; c.src = "";   // supaya lolos pengecekan drawEntity()
    return c;
  }
  function tintGroup(name) {
    if (tinted[name]) return tinted[name];
    var src = img.npc, g = {}, ok = true, any = false;
    for (var k in src) {
      var v = src[k];
      if (v && typeof v === "object" && "naturalWidth" in v) { any = true; if (v.complete && v.naturalWidth) g[k] = tintCanvas(v, LOOK[name]); else ok = false; }
      else g[k] = v;
    }
    if (!any || !ok) return null;     // belum termuat -> coba lagi frame berikutnya
    return (tinted[name] = g);
  }

  function drawNpc(e, look) {
    var g = tintGroup(e.name);
    if (g) { var saved = img.player; img.player = g; try { drawEntity({ x: e.x, y: e.y, dir: e.dir || "front", moving: !!e.moving }, false); } finally { img.player = saved; } }
    else { ctx.fillStyle = look.color; ctx.beginPath(); ctx.arc(e.x * TILE + 8, e.y * TILE + 8, 6, 0, 7); ctx.fill(); }
    var cx = e.x * TILE + 8, cy = e.y * TILE - 20;
    ctx.save(); ctx.fillStyle = look.color; ctx.strokeStyle = "#111"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, 5.5, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#111"; ctx.font = "bold 8px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(look.badge, cx, cy + .5);
    ctx.font = "bold 7px sans-serif"; ctx.lineWidth = 2.5; ctx.strokeStyle = "#000"; ctx.strokeText(look.name, cx, cy - 9); ctx.fillStyle = look.color; ctx.fillText(look.name, cx, cy - 9);
    ctx.restore();
  }
  function label(x, y, text, color) {
    ctx.save(); ctx.font = "bold 8px sans-serif"; ctx.textAlign = "center"; ctx.lineWidth = 3; ctx.strokeStyle = "#000"; ctx.strokeText(text, x, y); ctx.fillStyle = color; ctx.fillText(text, x, y); ctx.restore();
  }
  function debugOpen() { var p = document.getElementById("popIN"); return p && p.classList.contains("show"); }

  function drawExtras() {
    var E = A.E, list = [E.dosen, E.laporan, E.revisi].sort(function (a, b) { return a.y - b.y; });
    list.forEach(function (e) { drawNpc(e, LOOK[e.name]); });
    var T = A.tugas;
    if (T.state === "retreat") label(npc.x * TILE + 8, npc.y * TILE - 16, "↩ MUNDUR", "#8a6cff");
    else if (T.state === "wait_heal") label(npc.x * TILE + 8, npc.y * TILE - 16, "✚ MENUNGGU HEAL", "#2fd6a1");
    if (E.laporan.shadow) {   // Laporan melapor: garis ke Tugas + label
      ctx.save(); ctx.strokeStyle = "#ffc23399"; ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(E.laporan.x * TILE + 8, E.laporan.y * TILE + 8); ctx.lineTo(npc.x * TILE + 8, npc.y * TILE + 8); ctx.stroke(); ctx.restore();
      label(E.laporan.x * TILE + 8, E.laporan.y * TILE - 34, "MELAPOR", "#ffc233");
    }
    if (A.mcFrozen()) label(player.x * TILE + 8, player.y * TILE - 16, "! TERTAHAN", "#ffc233");
    var lab = A.W.centers.lab; label(lab[0] * TILE + 8, lab[1] * TILE - 2, A.gate.lab ? "🔓" : "🔒", "#fff");
    if (debugOpen()) {   // overlay debug: pusat zona + jalur Revisi
      ctx.save(); ctx.globalAlpha = .9;
      for (var z in A.W.centers) { var c = A.W.centers[z]; ctx.strokeStyle = "#ffffff55"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(c[0] * TILE + 8, c[1] * TILE + 8, A.cfg.zoneR * TILE * .45, 0, 7); ctx.stroke(); label(c[0] * TILE + 8, c[1] * TILE + 12, z, "#fff"); }
      [E.revisi, E.laporan].forEach(function (e) {
        if (e.path.length) { ctx.strokeStyle = LOOK[e.name].color; ctx.lineWidth = 2; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.moveTo(e.x * TILE + 8, e.y * TILE + 8); e.path.forEach(function (p) { ctx.lineTo(p.x * TILE + 8, p.y * TILE + 8); }); ctx.stroke(); ctx.setLineDash([]); }
      });
      var seen = A.clock - A.lastSeen <= A.cfg.memoryMs;
      if (seen) { ctx.strokeStyle = "#ffc233"; ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(E.laporan.x * TILE + 8, E.laporan.y * TILE + 8); ctx.lineTo(player.x * TILE + 8, player.y * TILE + 8); ctx.stroke(); ctx.setLineDash([]); }
      ctx.restore();
    }
  }

  function makeWorld(extra) {
    var W = {
      centers: ZONE_CENTERS, hpMax: B.NPC_HP,
      getMC: function () { return { x: player.x, y: player.y }; },
      getTugas: function () { return { x: npc.x, y: npc.y }; },
      setTugas: function (x, y, dir) { npc.x = x; npc.y = y; npc.dir = dir; },
      path: function (a, b) { var r = searchPath({ x: a.x, y: a.y }, { x: b.x, y: b.y }, "manhattan"); return r.found ? r.path : []; },
      getGrace: function () { return graceMs; },
      cancelGrace: function () { graceMs = 0; rAcc = 9999; },
      toast: function (m) { try { toast(m); } catch (e) {} }
    };
    for (var k in (extra || {})) W[k] = extra[k];
    return W;
  }

  function install(agent) {
    A = agent; if (installed) return; installed = true;
    var _update = updateExplore, _pm = playerMove, _render = render, _sb = startBattle, _fb = finishBattle, _cab = continueAfterBattle, _reset = reset;

    updateExplore = function (dt) {
      A.tick(dt);
      var fz = A.tugasFrozen();
      if (fz) graceMs = 6e7;                                   // trik: graceMs>0 mematikan gerak, replan & trigger battle bawaan
      else if (frozenPrev) { graceMs = 0; lastPlan = { explored: [], path: [] }; rAcc = 9999; }
      frozenPrev = fz;
      _update(dt);
      if (fz) npc.moving = false;
    };
    playerMove = function (dx, dy) { if (A.mcFrozen()) return; return _pm(dx, dy); };
    render = function () { _render(); if (mode === "explore") drawExtras(); };
    startBattle = function (test) {
      var was = mode; _sb(test);
      if (was !== "battle" && mode === "battle" && bs && !test) {
        var hp = A.onBattleStart(false);
        if (hp < B.NPC_HP) { bs.npc = hp; renderBattle(); A.log("SYS", "Battle dimulai dengan HP Tugas " + hp + "/" + B.NPC_HP + " (terbawa dari battle sebelumnya)"); }
      }
    };
    finishBattle = function () {
      var snap = { won: bs.npc <= 0, left: bs.npc, test: bTest };
      _fb.apply(this, arguments); A.onBattleEnd(snap.won, snap.left, snap.test);
    };
    continueAfterBattle = function () { _cab.apply(this, arguments); A.onResume(); frozenPrev = false; };
    reset = function () { _reset.apply(this, arguments); frozenPrev = false; if (A) A.reset(); };
    // tombol terikat ke fungsi ASLI saat main.js dimuat -> ikat ulang ke versi bungkus
    var r = document.getElementById("restart"), ag = document.getElementById("again"), bc = document.getElementById("bContinue");
    if (r) r.onclick = reset; if (ag) ag.onclick = reset; if (bc) bc.onclick = continueAfterBattle;
  }
  return { install: install, makeWorld: makeWorld, LOOK: LOOK, _tint: tintGroup };
})();
