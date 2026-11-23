/* agent-loop.js -- OTAK NPC (Revisi, Laporan, Dosen) + perilaku Tugas pra-battle.
 * Siklus:  SENSE -> TELL ke KB -> ASK (inferensi) -> GOAL -> PLAN (Planner STRIPS) -> EXECUTE (A* tahap 1) -> MONITOR / replan.
 * Prioritas Revisi:  Retreat > Heal > Cegat > pulang ke Kantin.
 * File ini TIDAK menyentuh DOM/game langsung; semua lewat adapter W (lihat world-adapter.js) sehingga bisa dites di Node.
 *
 * Efek interaksi (HANYA sebelum battle; Minimax tahap 2 tidak diubah):
 *   Heal   : HP Tugas +cfg.heal (dibawa ke battle berikutnya)
 *   Retreat: anomali sezona dengan Dosen lari ke Kos & berhenti mengejar cfg.retreatMs
 *   Cegat  : Revisi di chokepoint menahan MC cfg.blockFreezeMs
 *   Alert  : Tugas tahu posisi MC dari Laporan -> masa grace setelah respawn dibatalkan
 */
var Tahap4Agent = (function () {
  var DEFAULTS = {
    algo: "astar-hmax", hpLow: 770, heal: 300, retreatMs: 8000, retreatCdMs: 5000, dosenR: 8, shadowDist: 6, escortDist: 3, interceptR: 9,
    visionR: 9, memoryMs: 4000, zoneR: 7, senseMs: 150, decideMs: 1000,
    healCdMs: 8000, healTimeoutMs: 25000, freezeTugasOnHeal: true,
    blockFreezeMs: 1200, blockCdMs: 6000, blockReach: 2, actMs: 500, maxReplans: 8,
    revisiMs: 150, laporanMs: 140, dosenMs: 220, tugasRetreatMs: 110,
    dosenRestPos: 7000, dosenRestLorong: 2500, laporanRest: 1200
  };
  function dist(a, b) { return Math.abs(a.x - b.x) + Math.abs(a.y - b.y); }

  function Agent(W, kb, lib, cfg) {
    this.W = W; this.kb = kb; this.lib = lib;
    this.cfg = {}; var k; for (k in DEFAULTS) this.cfg[k] = DEFAULTS[k]; for (k in (cfg || {})) this.cfg[k] = cfg[k];
    this.events = []; this.onEvent = null; this.lastPlanResult = null;
    this.reset();
  }
  var P = Agent.prototype;

  P.reset = function () {
    var W = this.W, c = this.cfg;
    this.clock = 0; this.senseAcc = 0; this.decideAcc = 0; this.dirty = true;
    this.cache = {}; this.edges = {}; this.lastSeen = -1e9; this.seenZone = null;
    this.gate = { lab: false };           // false = tertutup
    this.mcFrozenUntil = 0; this.blockCdUntil = 0;
    this.stats = { plans: 0, replans: 0, heals: 0, healFails: 0, retreats: 0, blocks: 0, alerts: 0, planFails: 0, planNodes: 0 };
    this.tugas = { hp: W.hpMax, state: "chase", until: 0, phase: null, path: [], acc: 0, cdUntil: 0 };
    var z = W.centers;
    function ent(name, zone, ms) { return { name: name, x: z[zone][0], y: z[zone][1], dir: "front", moving: false, acc: 0, ms: ms, path: [], mode: null, holdUntil: 0, cdUntil: 0, wait: 0, wpIdx: 0, restUntil: 0 }; }
    this.E = { revisi: ent("revisi", "kantin", c.revisiMs), laporan: ent("laporan", "perpus", c.laporanMs), dosen: ent("dosen", "posdosen", c.dosenMs) };
    var R = this.E.revisi; R.has = { kunci: false, kopi: false }; R.goalKey = null; R.doneKey = null; R.plan = null; R.healCdUntil = 0; R.planFailUntil = 0; R.replansThisGoal = 0; R.stepStarted = false; R.repathAcc = 0;
    this.events = []; this.lastPlanResult = null;
    // bersihkan fakta dinamis di KB
    var kb = this.kb; ["at(_,_)", "hp_low(_)", "has(_,_)", "busy(_)", "sees(_,_)"].forEach(function (p) { kb.untell(p); });
    this.kb.log.length = 0;
    this.log("SYS", "Agent di-reset: Revisi@kantin, Laporan@perpus, Dosen@posdosen, HP Tugas " + W.hpMax);
  };

  // ---------- util ----------
  P.log = function (type, text, extra) {
    var e = { t: this.clock, type: type, text: text }; if (extra) for (var k in extra) e[k] = extra[k];
    this.events.push(e); if (this.events.length > 300) this.events.shift();
    if (this.onEvent) this.onEvent(e);
  };
  P.center = function (z) { return { x: this.W.centers[z][0], y: this.W.centers[z][1] }; };
  P.nearestZone = function (t) {
    var best = null, bd = 1e9, Z = this.W.centers;
    for (var z in Z) { var d = Math.abs(t.x - Z[z][0]) + Math.abs(t.y - Z[z][1]); if (d < bd) { bd = d; best = z; } }
    return best;
  };
  P.zoneNear = function (t, R) { var z = this.nearestZone(t); return z && dist(t, this.center(z)) <= R ? z : null; };
  P.pos = function (who) { return who === "mc" ? this.W.getMC() : who === "tugas" ? this.W.getTugas() : this.E[who]; };
  P.edge = function (key, val, fn) { if (this.edges[key] !== val) { var prev = this.edges[key]; this.edges[key] = val; if (prev !== undefined) fn(val); } };
  P.explain = function (q) {   // ASK lengkap (dengan jejak) -> daftar aturan; juga ditampilkan di tab KB bila terbuka
    var r = this.kb.ask(q); if (this.W.onAsk) this.W.onAsk(q, r);
    return { proved: r.proved, rules: r.tree ? this.kb.rulesOf(r.tree) : [], r: r };
  };
  P.mcFrozen = function () { return this.clock < this.mcFrozenUntil; };
  P.tugasFrozen = function () { return this.tugas.state !== "chase"; };

  // ---------- gerak ----------
  P.walkTo = function (e, tile) {
    var p = this.W.path(e, tile); e.path = p.length ? p.slice(1) : []; e.target = { x: tile.x, y: tile.y }; return p.length > 0;
  };
  P.stepEntity = function (e, dt) {
    if (!e.path.length) { e.moving = false; return; }
    e.acc += dt;
    if (e.acc >= e.ms) {
      e.acc = 0; var n = e.path.shift(), dx = n.x - e.x, dy = n.y - e.y;
      e.dir = dx > 0 ? "right" : dx < 0 ? "left" : dy < 0 ? "back" : "front"; e.x = n.x; e.y = n.y; e.moving = true;
    }
  };
  P.atTile = function (e, t) { return e.x === t.x && e.y === t.y && !e.path.length; };

  // ---------- SENSE + TELL ----------
  P.setAt = function (who, zone) {
    var key = "at:" + who; if (this.cache[key] === zone && key in this.cache) return;
    this.cache[key] = zone;
    if (zone) this.kb.replace("at(" + who + ",_)", "at(" + who + "," + zone + ")"); else this.kb.untell("at(" + who + ",_)");
    this.dirty = true;
  };
  P.setFlag = function (key, fact, on) {
    if (this.cache[key] === on) return; this.cache[key] = on;
    on ? this.kb.tell(fact) : this.kb.untell(fact); this.dirty = true;
    this.log("TELL", (on ? "TELL " : "UNTELL ") + fact);
  };
  P.sense = function () {
    var self = this, c = this.cfg, W = this.W;
    ["tugas", "revisi", "laporan", "dosen"].forEach(function (w) { self.setAt(w, self.zoneNear(self.pos(w), c.zoneR)); });
    var mc = W.getMC(), lap = this.E.laporan;
    if (dist(mc, lap) <= c.visionR) { this.lastSeen = this.clock; this.seenZone = this.nearestZone(mc); }
    var seen = this.clock - this.lastSeen <= c.memoryMs;
    this.setAt("mc", seen ? this.seenZone : null);
    this.setFlag("sees", "sees(laporan,mc)", seen);
    this.setFlag("hplow", "hp_low(tugas)", this.tugas.hp <= c.hpLow);
    var dosen = this.E.dosen;   // R8: dekat Dosen (jarak Manhattan <= dosenR), tidak harus satu zona
    ["tugas", "revisi", "laporan"].forEach(function (w) { self.setFlag("near:" + w, "near(" + w + ",dosen)", dist(self.pos(w), dosen) <= c.dosenR); });
    var R = this.E.revisi;
    this.setFlag("busy", "busy(revisi)", R.mode === "retreat" || this.clock < R.cdUntil);
    this.setFlag("has_kunci", "has(revisi,kunci)", R.has.kunci);
    this.setFlag("has_kopi", "has(revisi,kopi)", R.has.kopi);
  };

  // ---------- ASK + GOAL ----------
  P.startRetreat = function (who) {
    var self = this, c = this.cfg, ex = this.explain("must_retreat(" + who + ")");
    this.stats.retreats++;
    this.log("ASK", "must_retreat(" + who + ") PROVED (aturan " + ex.rules.join("←") + ") → " + who + " lari ke Kos, berhenti mengejar " + (c.retreatMs / 1000) + " dtk", { rules: ex.rules });
    if (who === "tugas") {
      var T = this.tugas; T.state = "retreat"; T.phase = "run"; T.acc = 0;
      var p = this.W.path(this.W.getTugas(), this.center("kos")); T.path = p.slice(1);
      this.W.toast("Dosen muncul! Anomali Tugas mundur ke Kos.");
    } else {
      var e = this.E[who]; e.mode = "retreat"; e.phase = "run"; e.plan = null;
      if (who === "laporan") this.walkTo(e, this.center("kos"));
    }
  };

  P.decide = function () {
    var self = this, c = this.cfg, kb = this.kb, R = this.E.revisi;
    // 1) Retreat (prioritas tertinggi)
    ["tugas", "revisi", "laporan"].forEach(function (w) {
      var busy = w === "tugas" ? (self.tugas.state === "retreat" || self.clock < self.tugas.cdUntil) : (self.E[w].mode === "retreat" || self.clock < self.E[w].cdUntil);
      if (!busy && kb.holds("must_retreat(" + w + ")")) self.startRetreat(w);
    });
    // 2) Alert: Tugas tahu posisi MC -> batalkan grace
    var knows = kb.holds("knows_mc_at(tugas,Z)");
    this.edge("alert", knows, function (v) { if (v) self.log("ASK", "knows_mc_at(tugas,Z) PROVED via Laporan (R3,R1/R2)"); });
    if (knows && this.tugas.state === "chase" && this.W.getGrace() > 0) {
      this.W.cancelGrace(); this.stats.alerts++;
      this.log("EFFECT", "ALERT: Laporan melapor posisi MC → masa grace Tugas dibatalkan, langsung mengejar");
    }
    // 3) Goal Revisi
    var goal = null;
    if (R.mode === "retreat") goal = { key: "retreat", pddl: [["at", "revisi", "kos"]], label: "Retreat ke Kos" };
    else {
      if (this.clock >= R.healCdUntil && kb.holds("should_heal(revisi,tugas)")) goal = { key: "heal", pddl: [["healed", "tugas"]], label: "Heal Tugas" };
      else {
        var b = kb.solutions("should_block(revisi,Z)", 1)[0];
        if (b) goal = { key: "block:" + b.Z, pddl: [["at", "revisi", b.Z]], label: "Cegat di " + b.Z, zone: b.Z };
      }
    }
    var key = goal ? goal.key : null;
    if (key !== R.goalKey) {
      var prev = R.goalKey; R.goalKey = key; R.plan = null; R.doneKey = null; R.replansThisGoal = 0; R.stepStarted = false;
      if (goal && key !== "retreat") {
        var q = key === "heal" ? "should_heal(revisi,tugas)" : "should_block(revisi,Z)", ex = this.explain(q);
        this.log("GOAL", "Revisi → " + goal.label + "   [" + q + " via " + ex.rules.join("←") + "]", { rules: ex.rules });
      } else if (goal) this.log("GOAL", "Revisi → " + goal.label);
      else if (prev) this.log("GOAL", "Revisi: tujuan '" + prev + "' selesai/dibatalkan → pulang ke Kantin");
      if (prev === "heal" && key !== "heal" && this.tugas.state === "wait_heal") this.tugas.state = "chase";
    }
    R.goal = goal;
    if (goal && !R.plan && R.doneKey !== key && this.clock >= R.planFailUntil) this.makePlan(goal);
    if (goal && goal.key === "heal" && c.freezeTugasOnHeal && this.tugas.state === "chase" && R.plan) {
      this.tugas.state = "wait_heal"; this.tugas.until = this.clock + c.healTimeoutMs;
      this.log("EFFECT", "Tugas terluka (HP " + this.tugas.hp + "/" + this.W.hpMax + ") berhenti menunggu pertolongan Revisi");
    }
  };

  // ---------- PLAN ----------
  P.makePlan = function (goal, why) {
    var R = this.E.revisi, lib = this.lib, spec = {
      npcs: { revisi: this.nearestZone(R), tugas: this.nearestZone(this.W.getTugas()) }, items: {}, has: { revisi: [] },
      closedGates: this.gate.lab ? [] : ["lab"], goal: goal.pddl, agents: ["revisi"]
    };
    if (!R.has.kunci) spec.items.kunci = "perpus"; else spec.has.revisi.push("kunci");
    if (!R.has.kopi) spec.items.kopi = "lab"; else spec.has.revisi.push("kopi");
    var text = lib.buildProblemPDDL(spec), res = lib.Planner.plan(lib.DOMAIN_PDDL, text, this.cfg.algo);
    this.lastPlanResult = res; this.stats.plans++; this.stats.planNodes += res.stats.expanded || 0;
    if (this.W.onPlan) this.W.onPlan(res, text);
    if (!res.found) {
      this.stats.planFails++; R.planFailUntil = this.clock + 3000; R.plan = null;
      this.log("PLAN", "TIDAK ADA PLAN untuk " + goal.label + " (" + this.cfg.algo + ", expanded " + res.stats.expanded + ")"); return;
    }
    if (!res.plan.length) {   // sudah di tujuan (plan 0 langkah): tandai selesai, jangan buat plan kosong
      R.plan = null; R.doneKey = goal.key; this.log("PLAN", "Sudah di tujuan (" + goal.label + "), plan 0 langkah → langsung siaga"); return;
    }
    R.plan = { steps: res.plan, i: 0, tugasZone: spec.npcs.tugas }; R.stepStarted = false; R.wait = 0;
    this.log(why ? "REPLAN" : "PLAN", (why ? "Replan (" + why + "): " : "") + res.plan.length + " langkah [" + this.cfg.algo + ", expanded " + res.stats.expanded + ", " + res.stats.ms + " ms]: " +
      res.plan.map(function (s) { return s.name + (s.args.length > 1 ? ":" + s.args.slice(1).join(">") : ""); }).join(" → "), { plan: res.plan.map(function (s) { return s.text; }) });
  };
  P.replan = function (why) {
    var R = this.E.revisi; if (!R.goal) return;
    this.stats.replans++; R.replansThisGoal++;
    if (R.replansThisGoal > this.cfg.maxReplans) { this.log("PLAN", "Replan melebihi batas (" + this.cfg.maxReplans + ") → tujuan dibatalkan"); R.plan = null; R.doneKey = R.goalKey; if (R.goalKey === "heal") { this.stats.healFails++; R.healCdUntil = this.clock + this.cfg.healCdMs; if (this.tugas.state === "wait_heal") this.tugas.state = "chase"; } return; }
    R.path = []; this.makePlan(R.goal, why);
  };

  // ---------- EXECUTE + MONITOR ----------
  P.next = function () {
    var R = this.E.revisi; R.plan.i++; R.stepStarted = false;
    if (R.plan.i >= R.plan.steps.length) {
      var key = R.goalKey; R.plan = null; R.doneKey = key;
      if (key === "retreat") { R.phase = "hold"; R.holdUntil = this.clock + this.cfg.retreatMs; this.log("ACT", "Revisi tiba di Kos, bertahan " + this.cfg.retreatMs / 1000 + " dtk"); }
      else if (key !== "heal") this.log("ACT", "Revisi tiba di posisi cegat");
    }
  };
  P.runRevisi = function (dt) {
    var R = this.E.revisi, c = this.cfg, W = this.W, self = this;
    if (R.mode === "retreat" && R.phase === "hold") {
      if (this.clock >= R.holdUntil) { R.mode = null; R.phase = null; R.cdUntil = this.clock + c.retreatCdMs; R.goalKey = null; R.doneKey = null; this.log("ACT", "Revisi selesai retreat, kembali bertugas"); this.dirty = true; }
      return;
    }
    if (!R.plan) {
      // cegat: efek pada MC
      if (R.goalKey && R.goalKey.indexOf("block:") === 0 && R.doneKey === R.goalKey && this.clock >= this.blockCdUntil && dist(W.getMC(), R) <= c.blockReach) {
        this.mcFrozenUntil = this.clock + c.blockFreezeMs; this.blockCdUntil = this.clock + c.blockCdMs; this.stats.blocks++;
        W.toast("Revisi mencegatmu! (tertahan sebentar)"); this.log("EFFECT", "CEGAT: Revisi menahan MC " + c.blockFreezeMs + " ms di " + R.goalKey.split(":")[1]);
      }
      // CEGAT aktif: setelah tiba di chokepoint, Revisi mencegat MC yang terlihat Laporan dalam radius interceptR
      if (R.goalKey && R.goalKey.indexOf("block:") === 0 && R.doneKey === R.goalKey) {
        var mcp = W.getMC(), dm = dist(R, mcp); R.repathAcc += dt;
        if (dm > c.blockReach && dm <= c.interceptR && (R.repathAcc > 500 || !R.path.length)) {
          R.repathAcc = 0; var ip = W.path(R, mcp); R.path = ip.length > 2 ? ip.slice(1, ip.length - 1) : [];
          if (!R.intercepting) { R.intercepting = true; this.log("ACT", "Revisi menyergap MC (jarak " + dm + ")"); }
        }
      } else R.intercepting = false;
      // PENDAMPING: tanpa tujuan, Revisi mengikuti Tugas (jarak <= escortDist) agar heal cepat & kelihatan
      if (!R.goalKey) {
        var tt0 = W.getTugas(), de = dist(R, tt0); R.repathAcc += dt;
        if (de > c.escortDist && (R.repathAcc > 700 || !R.path.length)) { R.repathAcc = 0; var ep = W.path(R, tt0); R.path = ep.length > c.escortDist + 1 ? ep.slice(1, ep.length - c.escortDist) : []; }
        else if (de <= c.escortDist - 1) R.path = [];
      }
      return;
    }
    if (R.wait > 0) { R.wait -= dt; return; }
    var s = R.plan.steps[R.plan.i], tgt;
    if (s.name === "move") {
      var to = s.args[2]; tgt = this.center(to);
      if (!R.stepStarted) {
        if (to === "lab" && !this.gate.lab) return this.replan("gerbang Lab ternyata tertutup");
        if (!this.walkTo(R, tgt) && !(R.x === tgt.x && R.y === tgt.y)) return this.replan("jalur ke " + to + " tidak ditemukan");
        R.stepStarted = true;
      }
      if (this.atTile(R, tgt)) this.next();
    } else if (s.name === "pickup") {
      var item = s.args[1];
      if (this.nearestZone(R) !== s.args[2]) return this.replan("posisi tidak sesuai plan");
      R.has[item] = true; this.log("ACT", "Revisi mengambil " + item + " di " + s.args[2]); R.wait = c.actMs; this.next();
    } else if (s.name === "open-gate") {
      if (!R.has.kunci) return this.replan("kunci belum dimiliki");
      this.gate[s.args[2]] = true; this.log("ACT", "Revisi membuka gerbang " + s.args[2] + " dengan kunci"); R.wait = c.actMs + 200; this.next();
    } else if (s.name === "heal") {
      var tt = W.getTugas();
      if (dist(R, tt) > 2) {
        R.repathAcc += dt;
        if (!R.stepStarted || R.repathAcc > 600) { R.repathAcc = 0; this.walkTo(R, tt); R.stepStarted = true; }
        return;
      }
      if (!R.has.kopi) return this.replan("kopi hilang");
      this.tugas.hp = Math.min(W.hpMax, this.tugas.hp + c.heal); R.has.kopi = false; this.stats.heals++;
      R.healCdUntil = this.clock + c.healCdMs; R.path = [];
      this.log("EFFECT", "HEAL: Revisi menyembuhkan Tugas +" + c.heal + " → HP Tugas " + this.tugas.hp + "/" + W.hpMax + " (dibawa ke battle berikutnya)");
      W.toast("Revisi menyembuhkan Anomali Tugas (+" + c.heal + " HP)");
      if (this.tugas.state === "wait_heal") this.tugas.state = "chase";
      this.dirty = true; this.next();
    }
    // MONITOR: Tugas berpindah zona saat Revisi belum sampai -> plan basi
    if (R.plan && R.goalKey === "heal" && s.name !== "heal") {
      var tz = this.nearestZone(W.getTugas());
      if (tz !== R.plan.tugasZone) this.replan("Tugas pindah " + R.plan.tugasZone + "→" + tz);
    }
  };

  // ---------- Laporan & Dosen ----------
  var PATROL = { laporan: ["perpus", "gerbang", "lab", "gerbang", "lorong", "kantin", "lorong"], dosen: ["posdosen", "lorong"] };
  P.runPatrol = function (who, dt) {
    var e = this.E[who], c = this.cfg;
    if (e.mode === "retreat") {   // hanya Laporan (Dosen tidak anomali)
      if (e.phase === "run" && this.atTile(e, this.center("kos"))) { e.phase = "hold"; e.holdUntil = this.clock + c.retreatMs; this.log("ACT", who + " tiba di Kos, bertahan " + c.retreatMs / 1000 + " dtk"); }
      if (e.phase === "hold" && this.clock >= e.holdUntil) { e.mode = null; e.phase = null; e.cdUntil = this.clock + c.retreatCdMs; this.log("ACT", who + " selesai retreat"); }
      return;
    }
    if (who === "laporan") {   // SCOUT: membuntuti MC dari jarak shadowDist selama MC terlihat
      var mcp = this.W.getMC(), dd = dist(e, mcp);
      if (dd <= c.visionR || (e.shadow && dd <= c.visionR + 4)) {
        if (!e.shadow) { e.shadow = true; e.target = null; e.restUntil = 0; this.log("ACT", "Laporan melihat MC (jarak " + dd + ") → membuntuti dan melapor ke Tugas/Revisi"); }
        e.repathAcc = (e.repathAcc || 0) + dt;
        if (dd > c.shadowDist + 1 && (e.repathAcc > 500 || !e.path.length)) { e.repathAcc = 0; var sp = this.W.path(e, mcp); e.path = sp.length > c.shadowDist + 1 ? sp.slice(1, sp.length - c.shadowDist) : []; }
        else if (dd <= c.shadowDist) e.path = [];
        return;
      } else if (e.shadow) { e.shadow = false; e.path = []; e._arrived = true; this.log("ACT", "Laporan kehilangan jejak MC → kembali patroli"); }
    }
    if (e.restUntil > this.clock) return;
    var wps = PATROL[who];
    if (!e.path.length) {
      if (e.target && this.atTile(e, e.target) && !e._arrived) {
        e._arrived = true;
        e.restUntil = this.clock + (who === "dosen" ? (wps[e.wpIdx] === "posdosen" ? c.dosenRestPos : c.dosenRestLorong) : c.laporanRest); return;
      }
      e._arrived = false; e.wpIdx = (e.wpIdx + 1) % wps.length; this.walkTo(e, this.center(wps[e.wpIdx]));
    }
  };

  // ---------- Tugas (pra-battle) ----------
  P.runTugas = function (dt) {
    var T = this.tugas, c = this.cfg, W = this.W;
    if (T.state === "retreat") {
      if (T.phase === "run") {
        T.acc += dt;
        if (T.acc >= c.tugasRetreatMs) {
          T.acc = 0; var n = T.path.shift();
          if (n) { var cur = W.getTugas(); W.setTugas(n.x, n.y, n.x > cur.x ? "right" : n.x < cur.x ? "left" : n.y < cur.y ? "back" : "front"); }
          else { T.phase = "hold"; T.until = this.clock + c.retreatMs; this.log("ACT", "Tugas tiba di Kos, berhenti mengejar " + c.retreatMs / 1000 + " dtk"); }
        }
      } else if (this.clock >= T.until) {
        T.state = "chase"; T.phase = null; T.cdUntil = this.clock + c.retreatCdMs; this.log("ACT", "Tugas selesai retreat, kembali mengejar MC");
      }
    } else if (T.state === "wait_heal" && this.clock >= T.until) {
      T.state = "chase"; this.stats.healFails++; this.E.revisi.healCdUntil = this.clock + c.healCdMs;
      this.E.revisi.plan = null; this.E.revisi.doneKey = this.E.revisi.goalKey;
      this.log("EFFECT", "Heal GAGAL: Revisi tidak sampai dalam " + c.healTimeoutMs / 1000 + " dtk, Tugas lanjut mengejar");
    }
  };

  // ---------- tick utama ----------
  P.tick = function (dt) {
    this.clock += dt;
    this.senseAcc += dt; this.decideAcc += dt;
    if (this.senseAcc >= this.cfg.senseMs) { this.senseAcc = 0; this.sense(); }
    if (this.dirty || this.decideAcc >= this.cfg.decideMs) { this.dirty = false; this.decideAcc = 0; this.decide(); }
    this.runTugas(dt); this.runRevisi(dt); this.runPatrol("laporan", dt); this.runPatrol("dosen", dt);
    this.stepEntity(this.E.revisi, dt); this.stepEntity(this.E.laporan, dt); this.stepEntity(this.E.dosen, dt);
  };

  // ---------- hook battle ----------
  P.onBattleStart = function (test) { return test ? this.W.hpMax : this.tugas.hp; };
  P.onBattleEnd = function (won, npcLeft, test) {
    if (test) return;
    this.tugas.hp = won ? this.W.hpMax : Math.max(1, npcLeft);
    this.log("SYS", won ? "MC menang → Tugas respawn dengan HP penuh" : "MC kalah → Tugas lanjut dengan HP " + this.tugas.hp + "/" + this.W.hpMax);
  };
  P.onResume = function () {
    var T = this.tugas; T.state = "chase"; T.phase = null; T.path = []; this.dirty = true;
    var R = this.E.revisi; if (R.goalKey === "heal") { R.plan = null; R.goalKey = null; R.doneKey = null; }
    this.mcFrozenUntil = 0;
  };

  // ---------- tampilan / debug ----------
  P.status = function () {
    var self = this, R = this.E.revisi, rows = [];
    function z(t) { return self.zoneNear(t, self.cfg.zoneR) || ("~" + self.nearestZone(t)); }
    rows.push({ who: "Tugas", zone: z(this.W.getTugas()), state: this.tugas.state + (this.tugas.phase ? "/" + this.tugas.phase : ""), info: "HP " + this.tugas.hp + "/" + this.W.hpMax });
    rows.push({ who: "Revisi", zone: z(R), state: R.mode === "retreat" ? "retreat" : (R.goal ? R.goal.label + (R.intercepting ? " (menyergap)" : "") : "mendampingi Tugas"), info: "kunci:" + (R.has.kunci ? "✓" : "–") + " kopi:" + (R.has.kopi ? "✓" : "–") + " · plan " + (R.plan ? (R.plan.i + 1) + "/" + R.plan.steps.length : "–") });
    rows.push({ who: "Laporan", zone: z(this.E.laporan), state: this.E.laporan.mode || (this.E.laporan.shadow ? "membuntuti MC" : "patroli"), info: this.clock - this.lastSeen <= this.cfg.memoryMs ? "melihat MC di " + this.seenZone : "tidak melihat MC" });
    rows.push({ who: "Dosen", zone: z(this.E.dosen), state: "patroli", info: "" });
    return rows;
  };
  P.debug = {};
  P.hurtTugas = function (hp) { this.tugas.hp = hp; this.dirty = true; this.senseAcc = 1e9; this.log("SYS", "[debug] HP Tugas → " + hp); };
  P.summonDosen = function () {
    var t = this.W.getTugas(), d = this.E.dosen; d.x = t.x; d.y = t.y; d.path = []; d.restUntil = this.clock + 3000; this.dirty = true; this.senseAcc = 1e9;
    this.log("SYS", "[debug] Dosen dipindah ke posisi Tugas");
  };
  P.setConfig = function (k, v) { this.cfg[k] = v; if (k === "revisiMs") this.E.revisi.ms = v; };

  Agent.DEFAULTS = DEFAULTS;
  return Agent;
})();
if (typeof module !== "undefined") module.exports = Tahap4Agent;
