/* pddl-parser.js -- parser mini PDDL (S-expression) untuk domain & problem STRIPS bertipe.
 * Didukung: :types (diabaikan selain nama), :predicates, :action (:parameters :precondition :effect),
 * precondition = konjungsi atom positif + (not (= ?a ?b)); effect = atom (add) & (not atom) (delete);
 * problem: :objects (typed), :init, :goal (and ...).  Closed-world assumption: atom tak disebut = salah. */
var PDDLParser = (function () {
  function tokenize(s) {
    return s.replace(/;[^\n]*/g, "").replace(/\(/g, " ( ").replace(/\)/g, " ) ").split(/\s+/).filter(Boolean).map(function (t) { return t.toLowerCase(); });
  }
  function read(tokens) {
    var i = 0;
    function rd() {
      var t = tokens[i++];
      if (t === undefined) throw new Error("PDDL: kurung tidak seimbang");
      if (t === "(") { var l = []; while (tokens[i] !== ")") { if (i >= tokens.length) throw new Error("PDDL: kurung tidak seimbang"); l.push(rd()); } i++; return l; }
      if (t === ")") throw new Error("PDDL: ')' berlebih");
      return t;
    }
    var out = []; while (i < tokens.length) out.push(rd()); return out;
  }
  // ["?a","?b","-","npc","?c"] -> [{name,type}]
  function typed(list) {
    var out = [], pend = [];
    for (var i = 0; i < list.length; i++) {
      if (list[i] === "-") { var ty = list[++i]; pend.forEach(function (n) { out.push({ name: n, type: ty }); }); pend = []; }
      else pend.push(list[i]);
    }
    pend.forEach(function (n) { out.push({ name: n, type: "object" }); });
    return out;
  }
  function conj(e) { return (e && e[0] === "and") ? e.slice(1) : (e && e.length ? [e] : []); }

  function parseAction(a) {
    var act = { name: a[1], params: [], pre: [], neq: [], add: [], del: [] };
    for (var i = 2; i < a.length; i += 2) {
      var k = a[i], v = a[i + 1];
      if (k === ":parameters") act.params = typed(v);
      else if (k === ":precondition") conj(v).forEach(function (c) {
        if (c[0] === "not" && c[1][0] === "=") act.neq.push([c[1][1], c[1][2]]);
        else if (c[0] === "not") throw new Error("Precondition negatif tidak didukung (STRIPS positif): " + JSON.stringify(c));
        else act.pre.push(c);
      });
      else if (k === ":effect") conj(v).forEach(function (c) { if (c[0] === "not") act.del.push(c[1]); else act.add.push(c); });
    }
    return act;
  }
  function parseDomain(text) {
    var d = read(tokenize(text))[0], dom = { name: d[1] && d[1][1], predicates: [], actions: [] };
    d.slice(2).forEach(function (sec) {
      if (sec[0] === ":predicates") dom.predicates = sec.slice(1).map(function (p) { return p[0]; });
      else if (sec[0] === ":action") dom.actions.push(parseAction(sec));
    });
    return dom;
  }
  function parseProblem(text) {
    var d = read(tokenize(text))[0], pr = { name: d[1] && d[1][1], objects: [], init: [], goal: [] };
    d.slice(2).forEach(function (sec) {
      if (sec[0] === ":objects") pr.objects = typed(sec.slice(1));
      else if (sec[0] === ":init") pr.init = sec.slice(1);
      else if (sec[0] === ":goal") pr.goal = conj(sec[1]);
    });
    return pr;
  }
  return { parseDomain: parseDomain, parseProblem: parseProblem, tokenize: tokenize, read: read };
})();
if (typeof module !== "undefined") module.exports = PDDLParser;
