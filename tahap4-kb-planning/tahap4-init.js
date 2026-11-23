/* =====================================================================
   TAHAP 4 (M1 KB + M2 Planner + M3 Agent/NPC) — inisialisasi, tab overlay, hook ke game
   Tab: K = KB · L = Planner · I = Interaksi
   ===================================================================== */
(function () {
  var kb = new KBEngine(KB_DATA, KBCompiler);
  window.TAHAP4 = {
    kb: kb, kbPanel: null, plannerPanel: null, interaksiPanel: null, agent: null,
    mountInto: function (c) { if (!c) return; this.kbPanel = KBPanel.mount(c, this.kb); return this.kbPanel; },
    mountPlannerInto: function (c) { if (!c || typeof PlannerPanel === "undefined") return; this.plannerPanel = PlannerPanel.mount(c); return this.plannerPanel; },
    validateZones: function (centers) {
      return ZoneGraph.validate({ COLS: COLS, ROWS: ROWS, isWalkable: isWalkable, searchPath: searchPath }, KB_DATA.zoneEdges, centers || ZONE_CENTERS);
    }
  };

  function ensurePop(id, title, innerId, btnId, btnText) {
    var pop = document.getElementById(id), inner = document.getElementById(innerId);
    if (!pop) {
      pop = document.createElement("div"); pop.className = "pop"; pop.id = id;
      pop.innerHTML = '<div class="pop-head"><h2>' + title + '</h2><button class="x" id="' + id + 'x">✕ Tutup</button></div><div id="' + innerId + '"></div>';
      document.body.appendChild(pop); inner = pop.querySelector("#" + innerId);
      if (!document.getElementById("tahap4-pop-css")) { var st = document.createElement("style"); st.id = "tahap4-pop-css"; st.textContent = "#popIN{width:min(520px,calc(100vw - 24px))}"; document.head.appendChild(st); }
    } else if (!inner) { inner = document.createElement("div"); inner.id = innerId; pop.appendChild(inner); }
    var btn = document.getElementById(btnId), tb = document.querySelector(".topbtns");
    if (!btn && tb) { btn = document.createElement("button"); btn.id = btnId; btn.textContent = btnText; tb.insertBefore(btn, document.getElementById("openMenu")); }
    var close = document.getElementById(id + "x"); if (close) close.onclick = function () { pop.classList.remove("show"); };
    return { pop: pop, inner: inner, btn: btn };
  }

  function init() {
    var T = window.TAHAP4;
    var K = ensurePop("popKB", "DEBUG TAHAP 4 — Knowledge Base (KB)", "tab-kb", "openKB", "📖 Tab KB");
    var PL = ensurePop("popPL", "DEBUG TAHAP 4 — Automated Planner (PDDL)", "tab-planner", "openPL", "🗺 Tab Planner");
    var IN = ensurePop("popIN", "DEBUG TAHAP 4 — Interaksi NPC (KB + Planning)", "tab-interaksi", "openIN", "🤝 Tab Interaksi");
    T.mountInto(K.inner); T.mountPlannerInto(PL.inner);

    // ----- agent + adapter (M3) -----
    var world = TahapAdapter.makeWorld({
      onPlan: function (res, text) { if (T.plannerPanel && PL.pop.classList.contains("show")) T.plannerPanel.show(res, text.replace(/\(road [^)]*\)\s*/g, "").replace(/\(gate-open [^)]*\)\s*/g, "")); },
      onAsk: function (q, r) { if (T.kbPanel && K.pop.classList.contains("show")) T.kbPanel.ask(q); }
    });
    T.agent = new Tahap4Agent(world, kb, { Planner: Planner, DOMAIN_PDDL: DOMAIN_PDDL, buildProblemPDDL: buildProblemPDDL });
    T.interaksiPanel = InteraksiPanel.mount(IN.inner, T.agent);
    TahapAdapter.install(T.agent);
    T.agent.reset();

    // ----- tombol & hotkey -----
    function toggle(p, onOpen) { var open = p.pop.classList.toggle("show"); if (open && onOpen) onOpen(); }
    var tK = function () { toggle(K, function () { if (T.kbPanel) T.kbPanel.refresh(); }); };
    var tP = function () { toggle(PL, function () { if (T.agent.lastPlanResult && T.plannerPanel) T.plannerPanel.show(T.agent.lastPlanResult); }); };
    var tI = function () { toggle(IN, function () { T.interaksiPanel.refresh(); }); };
    if (K.btn) K.btn.onclick = tK; if (PL.btn) PL.btn.onclick = tP; if (IN.btn) IN.btn.onclick = tI;
    window.addEventListener("keydown", function (e) {
      if (typeof started !== "undefined" && started && e.key && !e.ctrlKey && !e.metaKey && !e.altKey && !/input|select|textarea/i.test((e.target && e.target.tagName) || "")) {
        var k = e.key.toLowerCase(); if (k === "k") tK(); else if (k === "l") tP(); else if (k === "i") tI();
      }
    });
    // refresh live hanya saat panel terbuka (tidak membebani game loop)
    setInterval(function () {
      if (IN.pop.classList.contains("show")) T.interaksiPanel.refresh();
      if (K.pop.classList.contains("show") && T.kbPanel) T.kbPanel.refresh();
    }, 400);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
