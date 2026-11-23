/* kb-engine.js -- mesin KB: TELL / ASK memakai Tau Prolog (library, lib/tau-prolog.js).
 *
 * Hubungan dengan materi Logic:
 *  - ASK(q) = entailment KB ⊨ q. SLD resolution di Prolog = resolution refutation untuk
 *    klausa Horn: tambahkan ¬q, turunkan klausa kosong □.
 *  - Hasil: proved / not proved (closed-world: yang tidak bisa dibuktikan dianggap salah).
 *  - Jejak bukti didapat dari META-INTERPRETER (ditulis dalam Prolog di bawah) yang
 *    menjalankan klausa yang sama via clause/2 dan merekam pohon pembuktian.
 *
 * API:   var kb = new KBEngine(KB_DATA, KBCompiler);
 *        kb.tell("at(mc,lorong"));  kb.untell("hp_low(tugas)");  kb.replace("at(mc,_)","at(mc,kantin)");
 *        kb.ask("should_heal(X,tugas)") -> {query, proved, bindings[], steps[], tree, why[], stats{inferences,ms}}
 */
var KBEngine = (function () {
  var META = [
    ":- use_module(library(lists)).",
    ":- set_prolog_flag(unknown, fail).",
    "solve(G, D, t(G,Kind,Ch)) :- D < 30, D1 is D+1, clause(G, Body),",
    "   ( Body == true -> Kind = fact, Ch = []",
    "   ; first_rid(Body, R), Kind = rule(R), body(Body, D1, Ch) ).",
    "first_rid((rid(R),_), R) :- !.",
    "first_rid(rid(R), R).",
    "body(true, _, []) :- !.",
    "body((A,B), D, Ts) :- !, body(A, D, T1), body(B, D, T2), append(T1, T2, Ts).",
    "body(rid(_), _, []) :- !.",
    "body(\\+ G, _, [t(G,naf,[])]) :- !, \\+ solve(G, 0, _).",
    "body(G, D, [T]) :- solve(G, D, T).",
    // penjelasan kegagalan: untuk tiap aturan yang head-nya cocok, literal pertama yang gagal
    "why(G, Rs) :- findall(R-W, ( clause(G, B), B \\== true, first_rid(B, R), strip(B, Rest), Rest \\== true, first_fail(Rest, W) ), Rs).",
    "strip((rid(_),Rest), Rest) :- !.",
    "strip(rid(_), true).",
    "first_fail((A,B), W) :- !, ( lit_ok(A, Blocked) -> ( Blocked == none -> first_fail(B, W) ; W = blocked(Blocked) ) ; lit_bad(A, W) ).",
    "first_fail(A, W) :- ( lit_ok(A, Blocked) -> ( Blocked == none -> fail ; W = blocked(Blocked) ) ; lit_bad(A, W) ).",
    "lit_ok(\\+ N, Blocked) :- !, ( solve(N, 0, _) -> Blocked = N ; Blocked = none ).",
    "lit_ok(A, none) :- solve(A, 0, _).",
    "lit_bad(\\+ _, _) :- !, fail.",
    "lit_bad(A, missing(A))."
  ].join("\n");

  function KBEngine(data, compiler, plLib) {
    this.pl = plLib || (typeof pl !== "undefined" ? pl : null);
    if (!this.pl) throw new Error("Tau Prolog belum dimuat (lib/tau-prolog.js)");
    this.data = data;
    this.compiled = compiler.compileAll(data);
    this.program = compiler.buildProgram(data, this.compiled);
    this.session = this.pl.create(20000);
    this.log = []; // log TELL/UNTELL untuk overlay
    this._consult(this.program + "\n" + META);
  }
  var P = KBEngine.prototype;

  P._consult = function (text) {
    var err = null;
    this.session.consult(text, { success: function () {}, error: function (e) { err = e; } });
    if (err) throw new Error("Prolog consult gagal: " + String(err));
  };

  // Jalankan goal, kumpulkan sampai `max` jawaban (sinkron)
  P._answers = function (goal, max) {
    var self = this, pl = this.pl, out = [], err = null;
    this.session.query(goal, { success: function () {}, error: function (e) { err = e; } });
    if (err) throw new Error("Query error: " + String(err));
    for (var i = 0; i < (max || 1); i++) {
      var got = null;
      this.session.answer({
        success: function (a) { got = a; },
        fail: function () { got = false; },
        error: function (e) { err = e; got = false; },
        limit: function () { got = false; }
      });
      if (err) throw new Error("Query error: " + String(err));
      if (!got) break;
      out.push(got);
    }
    return out;
  };

  // ---------- TELL ----------
  P.tell = function (fact) {
    fact = fact.replace(/\.\s*$/, "");
    var has = this._answers(fact + ".", 1).length > 0;
    if (!has) {
      this._answers("assertz(" + fact + ").", 1);
      this.log.push({ op: "TELL", fact: fact });
    }
    return !has;
  };
  P.untell = function (pattern) {
    pattern = pattern.replace(/\.\s*$/, "");
    var had = this._answers(pattern + ".", 1).length > 0;
    if (had) { this._answers("retractall(" + pattern + ").", 1); this.log.push({ op: "UNTELL", fact: pattern }); }
    return had;
  };
  P.replace = function (pattern, fact) { this.untell(pattern); return this.tell(fact); };

  // Semua fakta dinamis yang sedang aktif (untuk panel "Fakta aktif")
  P.activeFacts = function () {
    var res = [], self = this;
    this.data.dynamicPreds.forEach(function (pi) {
      var parts = pi.split("/"), n = +parts[1], vars = [];
      for (var i = 0; i < n; i++) vars.push("A" + i);
      var goal = parts[0] + "(" + vars.join(",") + ")";
      self._answers(goal + ".", 50).forEach(function (a) {
        res.push(parts[0] + "(" + vars.map(function (v) { return a.lookup(v).toString(); }).join(",") + ")");
      });
    });
    return res;
  };

  // ---------- Prolog term -> JS ----------
  function listToArray(t) {
    var out = [];
    while (t && t.id === "." && t.args && t.args.length === 2) { out.push(t.args[0]); t = t.args[1]; }
    return out;
  }
  function treeToJs(t) {
    // t(Goal, Kind, Children)
    var goal = t.args[0].toString(), k = t.args[1];
    var kind = k.id === "rule" ? "rule" : k.id; // fact | rule | naf
    return {
      goal: goal, kind: kind, rule: kind === "rule" ? k.args[0].id.toUpperCase() : null,
      children: listToArray(t.args[2]).map(treeToJs)
    };
  }

  // Ubah pohon -> langkah-langkah naratif bergaya resolution refutation
  function stepsFromTree(query, tree) {
    var steps = [];
    steps.push({ depth: 0, kind: "neg", text: "Tambahkan ¬(" + query + ") ke KB lalu cari klausa kosong □" });
    (function walk(n, d) {
      if (n.kind === "fact") {
        steps.push({ depth: d, kind: "fact", goal: n.goal, text: n.goal + "  ← cocok dengan FAKTA di KB" });
      } else if (n.kind === "naf") {
        steps.push({ depth: d, kind: "naf", goal: n.goal, text: "NOT " + n.goal + "  ← tidak dapat dibuktikan (closed-world) ⇒ benar" });
      } else {
        steps.push({ depth: d, kind: "rule", goal: n.goal, rule: n.rule, text: n.goal + "  ← resolusi dengan aturan " + n.rule + ", subgoal: " +
          (n.children.map(function (c) { return (c.kind === "naf" ? "NOT " : "") + c.goal; }).join(", ") || "(tidak ada)") });
      }
      n.children.forEach(function (c) { if (c.kind !== "naf") walk(c, d + 1); else walk(c, d + 1); });
    })(tree, 1);
    steps.push({ depth: 0, kind: "empty", text: "Klausa kosong □ diturunkan ⇒ KB ⊨ " + query + "  (PROVED)" });
    return steps;
  }

  // ---------- ASK ----------
  P.ask = function (query) {
    query = query.replace(/\.\s*$/, "");
    var t0 = (typeof performance !== "undefined" ? performance.now() : Date.now());
    var steps0 = this.session.thread ? this.session.thread.total_steps : 0;
    var res = { query: query, proved: false, bindings: [], steps: [], tree: null, why: [], stats: {} };
    var vars = (query.match(/\b[A-Z_][A-Za-z0-9_]*\b/g) || []).filter(function (v, i, a) { return a.indexOf(v) === i && v !== "_"; });

    // 1) semua jawaban (binding)
    var all = this._answers(query + ".", 20);
    var self = this;
    res.proved = all.length > 0;
    res.bindings = all.map(function (a) {
      var o = {}; vars.forEach(function (v) { o[v] = a.lookup(v).toString(); }); return o;
    });

    // 2) jejak bukti (meta-interpreter), jawaban pertama
    if (res.proved) {
      var tr = this._answers("solve((" + query + "), 0, T).", 1);
      if (tr.length) { res.tree = treeToJs(tr[0].lookup("T")); res.steps = stepsFromTree(this._instantiate(query, res.bindings[0]), res.tree); }
    } else {
      res.steps.push({ depth: 0, kind: "neg", text: "Tambahkan ¬(" + query + ") ke KB lalu cari klausa kosong □" });
      var w = this._answers("why((" + query + "), Rs).", 1);
      if (w.length) {
        listToArray(w[0].lookup("Rs")).forEach(function (pair) {
          var rid = pair.args[0].id.toUpperCase(), why = pair.args[1];
          var txt = why.id === "blocked" ? "terhalang oleh " + why.args[0].toString() + " (NOT gagal)" : "subgoal " + why.args[0].toString() + " tidak dapat dibuktikan";
          res.why.push({ rule: rid, text: txt });
          res.steps.push({ depth: 1, kind: "fail", rule: rid, text: "aturan " + rid + " dicoba → " + txt });
        });
      }
      if (!res.why.length) res.steps.push({ depth: 1, kind: "fail", text: "tidak ada fakta atau aturan yang cocok dengan " + query });
      res.steps.push({ depth: 0, kind: "nope", text: "Klausa kosong □ TIDAK dapat diturunkan ⇒ NOT PROVED (closed-world: dianggap salah)" });
    }
    var t1 = (typeof performance !== "undefined" ? performance.now() : Date.now());
    res.stats = { ms: +(t1 - t0).toFixed(3), inferences: (this.session.thread ? this.session.thread.total_steps : 0) - steps0 };
    this.lastAsk = res;
    return res;
  };

  // ---------- ASK ringan (tanpa jejak bukti) untuk dipakai agent-loop tiap tick ----------
  // solutions(q,max) -> [{Var:nilai}] ; holds(q) -> boolean.  Jejak lengkap tetap lewat ask().
  P.solutions = function (query, max) {
    query = query.replace(/\.\s*$/, "");
    var vars = (query.match(/\b[A-Z_][A-Za-z0-9_]*\b/g) || []).filter(function (v, i, a) { return a.indexOf(v) === i && v !== "_"; });
    return this._answers(query + ".", max || 1).map(function (a) { var o = {}; vars.forEach(function (v) { o[v] = a.lookup(v).toString(); }); return o; });
  };
  P.holds = function (query) { return this.solutions(query, 1).length > 0; };
  // daftar id aturan yang dipakai pada pohon bukti (untuk log "alasan")
  P.rulesOf = function (tree) {
    var seen = {}, out = [];
    (function w(n) { if (!n) return; if (n.rule && !seen[n.rule]) { seen[n.rule] = 1; out.push(n.rule); } (n.children || []).forEach(w); })(tree);
    return out;
  };

  P._instantiate = function (q, b) {
    if (!b) return q;
    Object.keys(b).forEach(function (v) { q = q.replace(new RegExp("\\b" + v + "\\b", "g"), b[v]); });
    return q;
  };

  return KBEngine;
})();
if (typeof module !== "undefined") module.exports = KBEngine;
