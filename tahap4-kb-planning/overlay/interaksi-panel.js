/* interaksi-panel.js -- tab "Interaksi": status NPC, log event (dengan alasan dari KB), kontrol & debug.
 * Hanya tampilan. Pakai: InteraksiPanel.mount(div, agent) -> {refresh()} ; refresh dipanggil timer saat panel terbuka. */
var InteraksiPanel = (function () {
  var CSS = ".inp{font:12px/1.45 ui-monospace,Consolas,monospace;color:#e8e8f0}.inp h4{margin:10px 0 4px;font:600 12px system-ui;color:#9fb4ff;text-transform:uppercase;letter-spacing:.06em}" +
    ".inp table{border-collapse:collapse;width:100%}.inp td,.inp th{border:1px solid #2b2f55;padding:2px 6px;text-align:left}.inp th{color:#9fb4ff}" +
    ".inp .box{background:#14162a;border:1px solid #2b2f55;border-radius:6px;padding:4px 6px;max-height:230px;overflow:auto}.inp .ev{padding:1px 0;border-bottom:1px dashed #23274a}.inp .t{color:#8f95c9}" +
    ".inp .TELL{color:#8f95c9}.inp .ASK{color:#9fb4ff}.inp .GOAL{color:#ffd166}.inp .PLAN,.inp .REPLAN{color:#ffa86b}.inp .ACT{color:#c9ceff}.inp .EFFECT{color:#8be28b;font-weight:700}.inp .SYS{color:#b8bde0;font-style:italic}" +
    ".inp .row{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:4px 0}.inp select,.inp input[type=number]{background:#23274a;color:#fff;border:1px solid #3a3f70;border-radius:4px;padding:2px 4px;font:inherit}" +
    ".inp button{background:#2f3a8f;color:#fff;border:0;border-radius:4px;padding:3px 8px;cursor:pointer;font:inherit}.inp button:hover{background:#4150c4}.inp .stat{color:#c9ceff}";
  function esc(s) { return String(s).replace(/[&<>]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]; }); }
  function mmss(ms) { var s = Math.floor(ms / 1000); return (s / 60 | 0) + ":" + ("0" + s % 60).slice(-2); }

  function mount(root, agent) {
    if (!document.getElementById("inp-css")) { var st = document.createElement("style"); st.id = "inp-css"; st.textContent = CSS; document.head.appendChild(st); }
    root.className = (root.className ? root.className + " " : "") + "inp";
    var c = agent.cfg;
    root.innerHTML =
      "<h4>Status agent (SENSE → TELL → ASK → GOAL → PLAN → EXECUTE)</h4><div data-r='status'></div>" +
      "<h4>Pengaturan</h4><div class='row'>Algoritma planner <select data-r='algo'><option value='astar-hmax'>A* h_max</option><option value='astar-hff'>A* h_FF</option><option value='bfs'>BFS</option><option value='backward'>Backward</option></select>" +
      "<label><input type='checkbox' data-r='freeze'> Tugas menunggu heal</label>" +
      "HP rendah ≤ <input type='number' data-r='hplow' style='width:62px'> Retreat <select data-r='ret'><option value='4000'>4 dtk</option><option value='8000'>8 dtk</option><option value='12000'>12 dtk</option></select></div>" +
      "<div class='row'><button data-r='hurt'>HP Tugas → 400</button><button data-r='dosen'>Panggil Dosen ke Tugas</button><button data-r='clr'>Bersihkan log</button></div>" +
      "<h4>Penghitung</h4><div class='stat' data-r='stats'></div>" +
      "<h4>Log interaksi (alasan = aturan KB yang membuktikan)</h4><div class='box' data-r='log'></div>";
    function $(n) { return root.querySelector("[data-r=" + n + "]"); }
    $("algo").value = c.algo; $("freeze").checked = c.freezeTugasOnHeal; $("hplow").value = c.hpLow; $("ret").value = String(c.retreatMs);
    $("algo").onchange = function () { agent.setConfig("algo", this.value); };
    $("freeze").onchange = function () { agent.setConfig("freezeTugasOnHeal", this.checked); };
    $("hplow").onchange = function () { agent.setConfig("hpLow", +this.value); agent.senseAcc = 1e9; };
    $("ret").onchange = function () { agent.setConfig("retreatMs", +this.value); };
    $("hurt").onclick = function () { agent.hurtTugas(400); api.refresh(); };
    $("dosen").onclick = function () { agent.summonDosen(); api.refresh(); };
    $("clr").onclick = function () { agent.events.length = 0; api.refresh(); };
    var api = {
      refresh: function () {
        $("status").innerHTML = "<table><tr><th>NPC</th><th>zona</th><th>status / tujuan</th><th>info</th></tr>" + agent.status().map(function (r) {
          return "<tr><td>" + r.who + "</td><td>" + esc(r.zone) + "</td><td>" + esc(r.state) + "</td><td>" + esc(r.info) + "</td></tr>"; }).join("") + "</table>";
        var s = agent.stats;
        $("stats").innerHTML = "plan: " + s.plans + " · replan: " + s.replans + " · gagal plan: " + s.planFails + " · node planner: " + s.planNodes + "<br>heal: " + s.heals + " (gagal " + s.healFails + ") · retreat: " + s.retreats + " · cegat: " + s.blocks + " · alert: " + s.alerts;
        $("log").innerHTML = agent.events.slice(-60).reverse().map(function (e) {
          return "<div class='ev'><span class='t'>" + mmss(e.t) + "</span> <b class='" + e.type + "'>" + e.type + "</b> <span class='" + e.type + "'>" + esc(e.text) + "</span></div>"; }).join("") || "<i>(belum ada event)</i>";
      }
    };
    api.refresh();
    return api;
  }
  return { mount: mount };
})();
