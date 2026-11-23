/* kb-panel.js -- tab "KB" untuk overlay. Murni tampilan; semua logika di KBEngine.
 * Pakai:  var panel = KBPanel.mount(document.getElementById("tab-kb"), kbEngine);
 *         panel.refresh();            // panggil saat fakta berubah (mis. tiap event / 0.5 dtk)
 *         panel.ask("should_heal(X,tugas)");   // dipanggil agent-loop agar inferensi tampil live */
var KBPanel = (function () {
  var CSS = ".kbp{font:12px/1.45 ui-monospace,Consolas,monospace;color:#e8e8f0}.kbp h4{margin:10px 0 4px;font:600 12px system-ui;color:#9fb4ff;text-transform:uppercase;letter-spacing:.06em}" +
    ".kbp .box{background:#14162a;border:1px solid #2b2f55;border-radius:6px;padding:6px 8px;max-height:140px;overflow:auto}" +
    ".kbp .chip{display:inline-block;margin:1px 3px 1px 0;padding:1px 6px;border-radius:10px;background:#23274a}" +
    ".kbp .rule{padding:3px 0;border-bottom:1px dashed #2b2f55;cursor:pointer}.kbp .rule:last-child{border:0}.kbp .rid{color:#ffd166;font-weight:700}" +
    ".kbp .det{display:none;margin:4px 0 4px 10px;color:#b8bde0;white-space:pre-wrap}.kbp .rule.open .det{display:block}" +
    ".kbp .qrow{display:flex;gap:4px;margin:4px 0}.kbp input{flex:1;background:#0d0f1f;color:#fff;border:1px solid #3a3f70;border-radius:4px;padding:3px 6px;font:inherit}" +
    ".kbp button{background:#2f3a8f;color:#fff;border:0;border-radius:4px;padding:3px 8px;cursor:pointer;font:inherit}.kbp button:hover{background:#4150c4}" +
    ".kbp .presets button{margin:2px 3px 2px 0;background:#23274a}.kbp .badge{display:inline-block;padding:1px 8px;border-radius:10px;font-weight:700}" +
    ".kbp .ok{background:#1f6f3f}.kbp .no{background:#8a2c2c}.kbp .st{white-space:pre;color:#c9ceff}.kbp .st .fact{color:#8be28b}.kbp .st .rule{color:#ffd166;cursor:default;border:0}" +
    ".kbp .st .naf{color:#ff9f6e}.kbp .st .fail{color:#ff8080}.kbp .st .empty{color:#8be28b;font-weight:700}.kbp .st .nope{color:#ff8080;font-weight:700}.kbp .st .neg{color:#9fb4ff}" +
    ".kbp .stat{color:#8f95c9;margin-top:4px}.kbp .log div{color:#b8bde0}";

  function esc(s) { return String(s).replace(/[&<>]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]; }); }

  function mount(root, kb, opts) {
    opts = opts || {};
    if (!document.getElementById("kbp-css")) { var st = document.createElement("style"); st.id = "kbp-css"; st.textContent = CSS; document.head.appendChild(st); }
    var presets = opts.presets || ["should_heal(X,tugas)", "must_retreat(tugas)", "knows_mc_at(revisi,Z)", "should_block(revisi,Z)", "friend(tugas,dosen)"];
    root.className = (root.className ? root.className + " " : "") + "kbp";
    root.innerHTML =
      "<h4>Fakta aktif (hasil TELL dari game)</h4><div class='box' data-r='facts'></div>" +
      "<h4>Aturan (klik untuk lihat konversi IF-THEN → CNF → klausa Prolog)</h4><div class='box' data-r='rules' style='max-height:180px'></div>" +
      "<h4>ASK — query</h4><div class='qrow'><input data-r='q' placeholder='contoh: should_heal(X,tugas)'><button data-r='go'>ASK</button></div>" +
      "<div class='presets' data-r='presets'></div>" +
      "<h4>Proses inferensi</h4><div data-r='res'><span style='color:#8f95c9'>belum ada query</span></div>" +
      "<h4>Log TELL / UNTELL</h4><div class='box log' data-r='log' style='max-height:80px'></div>";
    function $(n) { return root.querySelector("[data-r=" + n + "]"); }

    // aturan
    $("rules").innerHTML = kb.compiled.map(function (c) {
      return "<div class='rule' data-id='" + c.id + "'><span class='rid'>" + c.id + "</span> " + esc(c.ifThen) +
        "<div class='det'>" + esc(c.steps.join("\n")) + (c.note ? "\n(" + esc(c.note) + ")" : "") + "</div></div>";
    }).join("");
    $("rules").addEventListener("click", function (e) { var r = e.target.closest(".rule"); if (r) r.classList.toggle("open"); });

    presets.forEach(function (p) {
      var b = document.createElement("button"); b.textContent = p; b.onclick = function () { api.ask(p); }; $("presets").appendChild(b);
    });
    $("go").onclick = function () { var v = $("q").value.trim(); if (v) api.ask(v); };
    $("q").onkeydown = function (e) { if (e.key === "Enter") $("go").onclick(); };

    var api = {
      refresh: function () {
        $("facts").innerHTML = kb.activeFacts().map(function (f) { return "<span class='chip'>" + esc(f) + "</span>"; }).join("") || "<i>(kosong)</i>";
        $("log").innerHTML = kb.log.slice(-12).reverse().map(function (l) { return "<div>" + l.op + " " + esc(l.fact) + "</div>"; }).join("");
      },
      ask: function (q) {
        $("q").value = q;
        var r = kb.ask(q);
        var h = "<span class='badge " + (r.proved ? "ok" : "no") + "'>" + (r.proved ? "PROVED" : "NOT PROVED") + "</span> " + esc(q);
        if (r.proved && r.bindings.length && Object.keys(r.bindings[0]).length)
          h += "  →  " + r.bindings.map(function (b) { return esc(JSON.stringify(b).replace(/"/g, "")); }).join(" | ");
        h += "<div class='box st' style='max-height:260px;margin-top:4px'>" + r.steps.map(function (s) {
          return "<div class='" + s.kind + "'>" + "  ".repeat(s.depth) + esc(s.text) + "</div>";
        }).join("") + "</div>";
        h += "<div class='stat'>inferensi Prolog: " + r.stats.inferences + " · waktu: " + r.stats.ms + " ms</div>";
        $("res").innerHTML = h;
        api.refresh();
        if (opts.onAsk) opts.onAsk(r);
        return r;
      }
    };
    api.refresh();
    return api;
  }
  return { mount: mount };
})();
