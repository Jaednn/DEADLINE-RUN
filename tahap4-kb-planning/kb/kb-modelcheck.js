/* kb-modelcheck.js -- PEMBANDING untuk eksperimen E1/E2 (bukan dipakai game).
 * Entailment dengan MODEL CHECKING (truth table) pada KB yang sudah di-ground (propositional),
 * untuk dibandingkan dengan resolution (Tau Prolog) di kb-engine.js.
 * Kompleksitas O(2^n): n = jumlah atom turunan yang relevan terhadap query. */
var KBModelCheck = (function () {
  function parse(l) { var m = /^([a-z_0-9]+)\((.*)\)$/.exec(l.replace(/\s+/g, "")); return { p: m[1], args: m[2].split(",") }; }
  function str(p, a) { return p + "(" + a.join(",") + ")"; }
  function isVar(s) { return /^[A-Z]/.test(s); }

  function constants(facts, data) {
    var set = {};
    facts.forEach(function (f) { parse(f).args.forEach(function (a) { set[a] = 1; }); });
    data.zoneEdges.forEach(function (e) { set[e[0]] = 1; set[e[1]] = 1; });
    ["mc", "dosen"].forEach(function (c) { set[c] = 1; });
    return Object.keys(set);
  }

  function groundRules(data, consts, F) {
    var out = [];
    var edges = {}; data.zoneEdges.forEach(function (e) { F[str("road", [e[0], e[1]])] = 1; F[str("road", [e[1], e[0]])] = 1; });
    data.rules.forEach(function (r) {
      var vars = {};
      [r.then].concat(r.ifs, r.nots).forEach(function (l) { parse(l).args.forEach(function (a) { if (isVar(a)) vars[a] = 1; }); });
      var vs = Object.keys(vars), idx = vs.map(function () { return 0; }), total = Math.pow(consts.length, vs.length);
      for (var n = 0; n < total; n++) {
        var k = n, sub = {};
        vs.forEach(function (v) { sub[v] = consts[k % consts.length]; k = Math.floor(k / consts.length); });
        function g(l) { var p = parse(l); return str(p.p, p.args.map(function (a) { return isVar(a) ? sub[a] : a; })); }
        var nots = r.nots.map(g);
        if (nots.some(function (x) { return F[x]; })) continue;   // NOT dilihat dari fakta (closed-world)
        out.push({ id: r.id, head: g(r.then), body: r.ifs.map(g) });
      }
    });
    return out;
  }

  // facts: array string atom dasar (statis + dinamis). query: atom ground.
  function entails(data, facts, query, cap) {
    cap = cap || 22;
    var t0 = Date.now(), F = {};
    facts.forEach(function (f) { F[f.replace(/\s+/g, "")] = 1; });
    var consts = constants(facts, data);
    var rules = groundRules(data, consts, F);
    query = query.replace(/\s+/g, "");
    // slice mundur dari query: atom turunan yang relevan
    var heads = {}; rules.forEach(function (r) { (heads[r.head] = heads[r.head] || []).push(r); });
    var needed = {}, stack = [query];
    while (stack.length) {
      var a = stack.pop(); if (needed[a] || F[a] || !heads[a]) continue;
      needed[a] = 1;
      heads[a].forEach(function (r) { r.body.forEach(function (b) { stack.push(b); }); });
    }
    var V = Object.keys(needed), clauses = [];
    V.forEach(function (h) { heads[h].forEach(function (r) { clauses.push(r); }); });
    var res = { entailed: null, atoms: V.length, groundRules: rules.length, clauses: clauses.length, models: 0, checks: 0, capped: false, ms: 0 };
    if (V.length > cap) { res.capped = true; res.ms = Date.now() - t0; return res; }
    var ok = true, total = Math.pow(2, V.length), pos = {}; V.forEach(function (v, i) { pos[v] = i; });
    function val(a, mask) { return F[a] ? true : (a in pos ? ((mask >> pos[a]) & 1) === 1 : false); } // atom tanpa aturan & bukan fakta = false (CWA)
    for (var m = 0; m < total; m++) {
      res.checks++;
      var model = true;
      for (var i = 0; i < clauses.length && model; i++) {
        var c = clauses[i], body = true;
        for (var j = 0; j < c.body.length; j++) if (!val(c.body[j], m)) { body = false; break; }
        if (body && !val(c.head, m)) model = false;   // body ⇒ head dilanggar
      }
      if (model) { res.models++; if (!val(query, m)) ok = false; }
    }
    res.entailed = F[query] ? true : (V.length === 0 ? false : ok && res.models > 0);
    res.ms = Date.now() - t0;
    return res;
  }
  return { entails: entails };
})();
if (typeof module !== "undefined") module.exports = KBModelCheck;
