/* planner-panel.js -- tab "Planner" untuk overlay. Tampilan saja; logika di planning/planner.js.
 *   var pp = PlannerPanel.mount(div);      // UI mandiri (skenario + algoritma + Run + Bandingkan)
 *   pp.show(result)                        // dipakai agent-loop (M3) untuk menampilkan plan yang baru dibuat
 *   pp.run(spec, algo)                     // jalankan dari kode */
var PlannerPanel = (function () {
  var CSS = ".plp{font:12px/1.45 ui-monospace,Consolas,monospace;color:#e8e8f0}.plp h4{margin:10px 0 4px;font:600 12px system-ui;color:#9fb4ff;text-transform:uppercase;letter-spacing:.06em}" +
    ".plp .box{background:#14162a;border:1px solid #2b2f55;border-radius:6px;padding:6px 8px;max-height:200px;overflow:auto;white-space:pre-wrap}" +
    ".plp select,.plp button{background:#23274a;color:#fff;border:1px solid #3a3f70;border-radius:4px;padding:3px 6px;font:inherit}.plp button{background:#2f3a8f;border:0;cursor:pointer}.plp button:hover{background:#4150c4}" +
    ".plp .row{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:4px 0}.plp .step{padding:2px 0;border-bottom:1px dashed #2b2f55;cursor:pointer}.plp .step.sel{background:#1e2250}" +
    ".plp .n{color:#ffd166}.plp .add{color:#8be28b}.plp .del{color:#ff8080;text-decoration:line-through}.plp table{border-collapse:collapse;width:100%}.plp td,.plp th{border:1px solid #2b2f55;padding:2px 6px;text-align:right}.plp th{color:#9fb4ff}.plp td:first-child,.plp th:first-child{text-align:left}" +
    ".plp .best{color:#8be28b;font-weight:700}.plp .stat{color:#8f95c9}.plp .bad{color:#ff8080}";
  function esc(s) { return String(s).replace(/[&<>]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]; }); }
  var ZONES = ["gerbang", "perpus", "lab", "lorong", "posdosen", "kantin", "jembatan", "asrama", "kos"];

  function mount(root, opts) {
    opts = opts || {};
    if (!document.getElementById("plp-css")) { var st = document.createElement("style"); st.id = "plp-css"; st.textContent = CSS; document.head.appendChild(st); }
    root.className = (root.className ? root.className + " " : "") + "plp";
    function sel(id, def) { return "<select data-r='" + id + "'>" + ZONES.map(function (z) { return "<option" + (z === def ? " selected" : "") + ">" + z + "</option>"; }).join("") + "</select>"; }
    root.innerHTML =
      "<h4>Skenario (problem PDDL dibuat dari sini)</h4>" +
      "<div class='row'>Revisi di " + sel("revisi", "kantin") + " Tugas di " + sel("tugas", "asrama") + " kunci di " + sel("kunci", "perpus") + " kopi di " + sel("kopi", "lab") + "</div>" +
      "<div class='row'><label><input type='checkbox' data-r='gate' checked> gerbang Lab tertutup (butuh kunci)</label></div>" +
      "<div class='row'>Algoritma <select data-r='algo'><option value='astar-hmax'>A* (h_max, optimal)</option><option value='astar-hff'>A* (h_FF relaxed plan)</option><option value='bfs'>BFS (forward)</option><option value='backward'>Backward (regression)</option></select>" +
      "<button data-r='go'>Cari plan</button><button data-r='cmp'>Bandingkan semua</button></div>" +
      "<h4>Goal & init (PDDL)</h4><div class='box' data-r='pddl' style='max-height:110px'></div>" +
      "<h4>Plan (klik langkah untuk lihat perubahan state)</h4><div data-r='plan'><span class='stat'>belum ada plan</span></div>" +
      "<h4>State setelah langkah terpilih</h4><div class='box' data-r='state' style='max-height:110px'></div>" +
      "<h4>Statistik</h4><div data-r='stats'></div>";
    function $(n) { return root.querySelector("[data-r=" + n + "]"); }
    function spec() {
      return { npcs: { revisi: $("revisi").value, tugas: $("tugas").value }, items: { kunci: $("kunci").value, kopi: $("kopi").value },
        closedGates: $("gate").checked ? ["lab"] : [], goal: [["healed", "tugas"]] };
    }
    var last = null;
    function showState(i) {
      var r = last, s = r.states[i], h = "";
      var interesting = s.facts.filter(function (f) { return !/^(road|gate-open|agent)/.test(f); });
      h = interesting.map(function (f) { return s.added.indexOf(f) >= 0 ? "<span class='add'>" + esc(f) + "</span>" : esc(f); }).join("\n");
      if (s.removed.length) h += "\n\n<span class='del'>" + s.removed.map(esc).join("\n") + "</span>";
      $("state").innerHTML = h;
      Array.prototype.forEach.call($("plan").querySelectorAll(".step"), function (el, k) { el.classList.toggle("sel", k === i); });
    }
    var api = {
      show: function (r, problemText) {
        last = r;
        if (problemText) $("pddl").textContent = problemText;
        if (!r.found) { $("plan").innerHTML = "<span class='bad'>TIDAK ADA PLAN (" + esc(r.stats.reason || (r.stats.limitHit ? "batas node tercapai" : "ruang pencarian habis")) + ")</span>"; $("state").textContent = ""; }
        else {
          $("plan").innerHTML = "<div class='box'>" + "<div class='step' data-i='0'><span class='n'>0</span> kondisi awal</div>" + r.plan.map(function (s, i) {
            return "<div class='step' data-i='" + (i + 1) + "'><span class='n'>" + (i + 1) + "</span> " + esc(s.text) + "</div>"; }).join("") + "</div>";
          Array.prototype.forEach.call($("plan").querySelectorAll(".step"), function (el) { el.onclick = function () { showState(+el.dataset.i); }; });
          showState(r.plan.length);
        }
        var s = r.stats;
        $("stats").innerHTML = "<span class='stat'>algoritma: <b>" + esc(r.algo) + "</b> · panjang plan: " + (s.length === undefined ? "-" : s.length) + " · node di-expand: " + s.expanded + " · dibangkitkan: " + s.generated +
          (s.h0 !== undefined && /astar/.test(r.algo) ? " · h(awal): " + s.h0 : "") + (s.pruned !== undefined ? " · dipangkas: " + s.pruned : "") +
          " · aksi ground: " + s.groundActions + " · waktu: " + s.ms + " ms</span>";
        if (opts.onPlan) opts.onPlan(r);
      },
      run: function (sp, algo) {
        var text = buildProblemPDDL(sp), r = Planner.plan(DOMAIN_PDDL, text, algo);
        api.show(r, text.replace(/\(road [^)]*\)\s*/g, "").replace(/\(gate-open [^)]*\)\s*/g, "") + "\n;; fakta road/gate-open dihilangkan dari tampilan");
        return r;
      }
    };
    $("go").onclick = function () { api.run(spec(), $("algo").value); };
    $("cmp").onclick = function () {
      var sp = spec(), rows = Planner.ALGOS.map(function (a) { return Planner.plan(DOMAIN_PDDL, buildProblemPDDL(sp), a); });
      var minE = Math.min.apply(null, rows.filter(function (r) { return r.found; }).map(function (r) { return r.stats.expanded; }));
      $("stats").innerHTML = "<table><tr><th>algoritma</th><th>plan</th><th>expanded</th><th>generated</th><th>ms</th></tr>" + rows.map(function (r) {
        return "<tr><td>" + r.algo + "</td><td>" + (r.found ? r.stats.length : "-") + "</td><td class='" + (r.found && r.stats.expanded === minE ? "best" : "") + "'>" + r.stats.expanded + (r.stats.limitHit ? "+" : "") + "</td><td>" + r.stats.generated + "</td><td>" + r.stats.ms + "</td></tr>"; }).join("") + "</table>";
      api.show(rows[1], null); $("stats").innerHTML += "<div class='stat'>plan di atas = A* h_max</div>";
      var tb = rows.map(function (r) { return r; });
      $("stats").innerHTML = "<table><tr><th>algoritma</th><th>plan</th><th>expanded</th><th>generated</th><th>ms</th></tr>" + tb.map(function (r) {
        return "<tr><td>" + r.algo + "</td><td>" + (r.found ? r.stats.length : "-") + "</td><td class='" + (r.found && r.stats.expanded === minE ? "best" : "") + "'>" + r.stats.expanded + (r.stats.limitHit ? "+" : "") + "</td><td>" + r.stats.generated + "</td><td>" + r.stats.ms + "</td></tr>"; }).join("") + "</table><div class='stat'>daftar plan di atas = hasil A* h_max</div>";
    };
    api.run(spec(), "astar-hmax");
    return api;
  }
  return { mount: mount };
})();
