/* kb-compiler.js -- IF-THEN (data) -> klausa Prolog + bentuk CNF (untuk tampilan overlay).
 * Tidak ada inferensi di sini. */
var KBCompiler = (function () {
  function negLit(l) { return "¬" + l; }

  // Satu aturan -> {id, ifThen, fol, cnf, clause, steps[]}
  function compileRule(r) {
    var body = r.ifs.concat(r.nots.map(function (n) { return "\\+ " + n; }));
    var clause = r.then + (body.length ? " :- rid(" + r.id.toLowerCase() + "), " + body.join(", ") : " :- rid(" + r.id.toLowerCase() + ")") + ".";
    var shown = r.then + (body.length ? " :- " + body.join(", ") : "") + ".";
    var ifText = "IF " + r.ifs.concat(r.nots.map(function (n) { return "NOT " + n; })).join(" AND ") + " THEN " + r.then;
    var fol = "∀ " + r.ifs.concat(r.nots.map(function (n) { return "¬" + n; })).join(" ∧ ") + " ⇒ " + r.then;
    var lits = r.ifs.map(negLit).concat(r.nots.map(function (n) { return n; })).concat([r.then]);
    var cnf = "(" + lits.join(" ∨ ") + ")";
    var steps = [
      "1. Bentuk IF-THEN : " + ifText,
      "2. Implikasi      : " + fol,
      "3. Hilangkan ⇒ (A⇒B ≡ ¬A ∨ B), De Morgan pada ∧ : " + cnf,
      "4. Satu klausa disjungsi = sudah CNF (klausa Horn: paling banyak 1 literal positif).",
      "5. Tulis sebagai klausa Prolog (head :- body) : " + shown +
        (r.nots.length ? "   [NOT → \\+ = negation as failure]" : "")
    ];
    return { id: r.id, ifThen: ifText, fol: fol, cnf: cnf, clause: clause, shown: shown, steps: steps, note: r.note || "" };
  }

  function compileAll(data) {
    return data.rules.map(compileRule);
  }

  // Program Prolog lengkap (fakta statis + road dua arah + aturan + meta-interpreter ditambah engine)
  function buildProgram(data, compiled) {
    var out = [];
    var dyn = data.dynamicPreds.slice();
    // semua predikat yang dipakai harus dynamic supaya clause/2 boleh & unknown=fail aman
    var heads = {};
    function reg(lit) { var m = /^([a-z_0-9]+)\((.*)\)$/.exec(lit); if (m) heads[m[1] + "/" + m[2].split(",").length] = 1; }
    data.staticFacts.forEach(reg);
    data.rules.forEach(function (r) { reg(r.then); r.ifs.forEach(reg); r.nots.forEach(reg); });
    heads["road/2"] = 1;
    dyn.forEach(function (d) { heads[d] = 1; });
    Object.keys(heads).forEach(function (h) { out.push(":- dynamic(" + h + ")."); });
    out.push(":- dynamic(rid/1).");
    out.push("rid(_).");
    data.staticFacts.forEach(function (f) { out.push(f + "."); });
    data.zoneEdges.forEach(function (e) { out.push("road(" + e[0] + "," + e[1] + ")."); out.push("road(" + e[1] + "," + e[0] + ")."); });
    compiled.forEach(function (c) { out.push(c.clause); });
    return out.join("\n");
  }

  return { compileRule: compileRule, compileAll: compileAll, buildProgram: buildProgram };
})();
if (typeof module !== "undefined") module.exports = KBCompiler;
