/* planner.js -- Automated Planning (STRIPS) tanpa library.
 *  Algoritma:  "bfs"          forward, uninformed (optimal untuk biaya unit)
 *              "astar-hmax"   forward A*, h = h_max (relaksasi delete-list, ADMISSIBLE -> optimal)
 *              "astar-hff"    forward A*, h = panjang relaxed plan (ignore delete lists, tidak admissible, cepat)
 *              "backward"     regression dari goal (aksi relevan + konsisten), BFS pada subgoal
 *  API: Planner.plan(domainText, problemText, algo, opts) -> {found, plan[], states[], stats{...}, task}
 */
var Planner = (function () {
  // ---------- grounding ----------
  function compile(dom, prob) {
    var objs = prob.objects, byType = {};
    objs.forEach(function (o) { (byType[o.type] = byType[o.type] || []).push(o.name); });
    var isObj = {}; objs.forEach(function (o) { isObj[o.name] = 1; });
    // predikat statis = tidak pernah muncul di effect manapun
    var dynamic = {};
    dom.actions.forEach(function (a) { a.add.concat(a.del).forEach(function (e) { dynamic[e[0]] = 1; }); });
    var initSet = {}; prob.init.forEach(function (a) { initSet[a.join(" ")] = 1; });

    var ids = {}, names = [];
    function fid(atomStr) { if (!(atomStr in ids)) { ids[atomStr] = names.length; names.push(atomStr); } return ids[atomStr]; }
    function sub(atom, b) { return atom.map(function (t, i) { return i === 0 ? t : (t[0] === "?" ? b[t] : t); }).join(" "); }

    var actions = [];
    dom.actions.forEach(function (a) {
      var lists = a.params.map(function (p) { return byType[p.type] || (p.type === "object" ? objs.map(function (o) { return o.name; }) : []); });
      (function rec(i, b) {
        if (i === a.params.length) {
          for (var k = 0; k < a.neq.length; k++) if (b[a.neq[k][0]] === b[a.neq[k][1]]) return;
          var pre = [];
          for (var p = 0; p < a.pre.length; p++) {
            var s = sub(a.pre[p], b);
            if (!dynamic[a.pre[p][0]]) { if (!initSet[s]) return; }   // syarat statis harus benar di init
            else pre.push(fid(s));
          }
          var args = a.params.map(function (q) { return b[q.name]; });
          actions.push({
            name: a.name, args: args, text: "(" + a.name + " " + args.join(" ") + ")",
            pre: pre, add: a.add.map(function (e) { return fid(sub(e, b)); }), del: a.del.map(function (e) { return fid(sub(e, b)); })
          });
          return;
        }
        lists[i].forEach(function (o) { b[a.params[i].name] = o; rec(i + 1, b); });
        delete b[a.params[i].name];
      })(0, {});
    });
    var init = [], goal = [];
    prob.init.forEach(function (a) { if (dynamic[a[0]]) init.push(fid(a.join(" "))); });
    var impossible = false;
    prob.goal.forEach(function (a) {
      var s = a.join(" ");
      if (!dynamic[a[0]]) { if (!initSet[s]) impossible = true; } else goal.push(fid(s));
    });
    init.sort(function (x, y) { return x - y; });
    return { actions: actions, names: names, ids: ids, init: init, goal: goal.filter(function (v, i, a) { return a.indexOf(v) === i; }), impossible: impossible };
  }

  function subset(small, setObj) { for (var i = 0; i < small.length; i++) if (!setObj[small[i]]) return false; return true; }
  function toSet(arr) { var s = {}; for (var i = 0; i < arr.length; i++) s[arr[i]] = true; return s; }
  function key(arr) { return arr.join(","); }

  // ---------- heuristik relaksasi (ignore delete lists) ----------
  // mode "max" = h_max (admissible). mode "ff" = h_add untuk memilih supporter, lalu hitung relaxed plan.
  function relaxed(task, stateArr, mode) {
    var INF = 1e9, cost = {}, sup = {}, i, A = task.actions;
    stateArr.forEach(function (f) { cost[f] = 0; });
    var changed = true, guard = 0;
    while (changed && guard++ < 200) {
      changed = false;
      for (i = 0; i < A.length; i++) {
        var a = A[i], c = 0, ok = true;
        for (var p = 0; p < a.pre.length; p++) {
          var pc = cost[a.pre[p]]; if (pc === undefined) { ok = false; break; }
          c = mode === "max" ? Math.max(c, pc) : c + pc;
        }
        if (!ok) continue;
        c += 1;
        for (var e = 0; e < a.add.length; e++) {
          var f = a.add[e];
          if (cost[f] === undefined || c < cost[f]) { cost[f] = c; sup[f] = i; changed = true; }
        }
      }
    }
    var g, hv = 0;
    if (mode === "max") {
      for (g = 0; g < task.goal.length; g++) { var cg = cost[task.goal[g]]; if (cg === undefined) return INF; hv = Math.max(hv, cg); }
      return hv;
    }
    // h_FF: kumpulkan aksi supporter secara mundur dari goal
    var used = {}, seen = {}, stack = task.goal.slice();
    for (g = 0; g < stack.length; g++) if (cost[stack[g]] === undefined) return INF;
    while (stack.length) {
      var f2 = stack.pop();
      if (seen[f2] || cost[f2] === 0) continue;
      seen[f2] = 1;
      var ai = sup[f2]; used[ai] = 1;
      A[ai].pre.forEach(function (q) { stack.push(q); });
    }
    return Object.keys(used).length;
  }

  // ---------- heap kecil ----------
  function Heap() { this.a = []; }
  Heap.prototype.push = function (n) {
    var a = this.a; a.push(n); var i = a.length - 1;
    while (i > 0) { var p = (i - 1) >> 1; if (less(a[i], a[p])) { var t = a[i]; a[i] = a[p]; a[p] = t; i = p; } else break; }
  };
  Heap.prototype.pop = function () {
    var a = this.a, top = a[0], last = a.pop();
    if (a.length) { a[0] = last; var i = 0; for (;;) { var l = 2 * i + 1, r = l + 1, m = i; if (l < a.length && less(a[l], a[m])) m = l; if (r < a.length && less(a[r], a[m])) m = r; if (m === i) break; var t = a[i]; a[i] = a[m]; a[m] = t; i = m; } }
    return top;
  };
  function less(x, y) { return x.f < y.f || (x.f === y.f && x.h < y.h); }

  // ---------- forward search ----------
  function forward(task, algo, limit) {
    var A = task.actions, st = { expanded: 0, generated: 0 };
    var hmode = algo === "astar-hmax" ? "max" : algo === "astar-hff" ? "ff" : null;
    function H(s) { return hmode ? relaxed(task, s, hmode) : 0; }
    var h0 = H(task.init), start = { s: task.init, g: 0, h: h0, f: h0, parent: null, act: null };
    var closed = {}; closed[key(task.init)] = 0;
    var queue = algo === "bfs" ? [start] : null, qi = 0, heap = new Heap(); if (!queue) heap.push(start);
    st.h0 = h0;
    while (queue ? qi < queue.length : heap.a.length) {
      var n = queue ? queue[qi++] : heap.pop();
      var k = key(n.s); if (closed[k] !== undefined && closed[k] < n.g) continue;
      var sset = toSet(n.s);
      if (subset(task.goal, sset)) return finish(n, st);
      st.expanded++; if (st.expanded > limit) { st.limitHit = true; return { st: st }; }
      for (var i = 0; i < A.length; i++) {
        var a = A[i]; if (!subset(a.pre, sset)) continue;
        var ns = {}; for (var x = 0; x < n.s.length; x++) ns[n.s[x]] = true;
        a.del.forEach(function (d) { delete ns[d]; }); a.add.forEach(function (d) { ns[d] = true; });
        var arr = Object.keys(ns).map(Number).sort(function (p, q) { return p - q; }), nk = key(arr), g2 = n.g + 1;
        if (closed[nk] !== undefined && closed[nk] <= g2) continue;
        closed[nk] = g2; st.generated++;
        var h = queue ? 0 : H(arr), child = { s: arr, g: g2, h: h, f: g2 + h, parent: n, act: a };
        if (h >= 1e9) continue;                // dead-end (goal tak terjangkau bahkan relaksasi)
        if (queue) queue.push(child); else heap.push(child);
      }
    }
    return { st: st };
  }
  function finish(n, st) { var plan = []; for (var c = n; c.parent; c = c.parent) plan.push(c.act); plan.reverse(); return { plan: plan, st: st }; }

  // ---------- backward (regression) ----------
  function backward(task, exclusive, limit) {
    var A = task.actions, st = { expanded: 0, generated: 0, pruned: 0 };
    var initSet = toSet(task.init);
    var g0 = task.goal.slice().sort(function (p, q) { return p - q; });
    var start = { s: g0, parent: null, act: null }, queue = [start], qi = 0, seen = {}; seen[key(g0)] = 1;
    // tabel kunci fungsional: fakta -> "pred|arg0"
    var fkey = {};
    task.names.forEach(function (nm, id) { var t = nm.split(" "); (exclusive || []).forEach(function (ex) { if (t[0] === ex.pred) fkey[id] = ex.pred + "|" + t[1 + ex.key]; }); });
    // fakta yang tidak pernah bisa ditambah aksi manapun dan tidak ada di init -> subgoal mustahil
    var addable = {}; A.forEach(function (a) { a.add.forEach(function (f) { addable[f] = true; }); });
    function impossible(arr) { for (var i = 0; i < arr.length; i++) if (!addable[arr[i]] && !initSet[arr[i]]) return true; return false; }
    function inconsistent(arr) { var m = {}; for (var i = 0; i < arr.length; i++) { var k = fkey[arr[i]]; if (k) { if (m[k]) return true; m[k] = 1; } } return false; }
    while (qi < queue.length) {
      var n = queue[qi++];
      if (subset(n.s, initSet)) { var plan = []; for (var c = n; c.parent; c = c.parent) plan.push(c.act); return { plan: plan, st: st }; }   // plan sudah urut maju
      st.expanded++; if (st.expanded > limit) { st.limitHit = true; return { st: st }; }
      var gset = toSet(n.s);
      for (var i = 0; i < A.length; i++) {
        var a = A[i], rel = false, cons = true, x;
        for (x = 0; x < a.add.length; x++) if (gset[a.add[x]]) { rel = true; break; }
        if (!rel) continue;
        for (x = 0; x < a.del.length; x++) if (gset[a.del[x]]) { cons = false; break; }
        if (!cons) continue;
        var ns = {}; n.s.forEach(function (f) { ns[f] = true; });
        a.add.forEach(function (f) { delete ns[f]; }); a.pre.forEach(function (f) { ns[f] = true; });
        var arr = Object.keys(ns).map(Number).sort(function (p, q) { return p - q; });
        if (inconsistent(arr) || impossible(arr)) { st.pruned++; continue; }
        var k = key(arr); if (seen[k]) continue; seen[k] = 1; st.generated++;
        queue.push({ s: arr, parent: n, act: a });
      }
    }
    return { st: st };
  }

  // ---------- API ----------
  function plan(domainText, problemText, algo, opts) {
    opts = opts || {};
    var t0 = (typeof performance !== "undefined" ? performance.now() : Date.now());
    var dom = PDDLParser.parseDomain(domainText), prob = PDDLParser.parseProblem(problemText);
    var task = compile(dom, prob), limit = opts.limit || 200000, r;
    var res = { algo: algo, found: false, plan: [], states: [], stats: {}, task: task };
    if (task.impossible) { res.stats = { expanded: 0, generated: 0, reason: "goal statis tidak terpenuhi" }; return res; }
    var t1 = (typeof performance !== "undefined" ? performance.now() : Date.now());
    r = algo === "backward" ? backward(task, opts.exclusive === undefined ? (typeof PLAN_EXCLUSIVE !== "undefined" ? PLAN_EXCLUSIVE : []) : opts.exclusive, limit) : forward(task, algo, limit);
    var t2 = (typeof performance !== "undefined" ? performance.now() : Date.now());
    res.stats = r.st; res.stats.groundActions = task.actions.length; res.stats.facts = task.names.length;
    res.stats.ms = +(t2 - t1).toFixed(2); res.stats.groundMs = +(t1 - t0).toFixed(2);
    if (r.plan) {
      res.found = true;
      var cur = toSet(task.init), names = task.names;
      res.plan = r.plan.map(function (a) { return { name: a.name, args: a.args, text: a.text }; });
      res.stats.length = r.plan.length;
      res.states.push({ facts: Object.keys(cur).map(function (i) { return names[i]; }).sort(), added: [], removed: [] });
      r.plan.forEach(function (a) {
        if (!subset(a.pre, cur)) throw new Error("Plan tidak valid pada " + a.text);
        a.del.forEach(function (d) { delete cur[d]; }); a.add.forEach(function (d) { cur[d] = true; });
        res.states.push({ facts: Object.keys(cur).map(function (i) { return names[i]; }).sort(), added: a.add.map(function (i) { return names[i]; }), removed: a.del.map(function (i) { return names[i]; }) });
      });
      if (!subset(task.goal, cur)) throw new Error("Plan tidak mencapai goal");   // verifikasi independen
    }
    return res;
  }
  return { plan: plan, compile: compile, ALGOS: ["bfs", "astar-hmax", "astar-hff", "backward"] };
})();
if (typeof module !== "undefined") module.exports = Planner;
