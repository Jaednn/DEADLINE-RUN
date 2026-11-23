// Jalankan: node test/kb-node-test.js   (memuat file seperti <script src> di browser)
var fs = require("fs"), path = require("path"), vm = require("vm");
var base = path.join(__dirname, "..");
var ctx = { console: console, Date: Date, Math: Math, setTimeout: setTimeout, performance: performance, document: { getElementById: function () { return null; } } };
ctx.window = ctx; vm.createContext(ctx);
["lib/tau-prolog.js", "kb/kb-rules.js", "kb/kb-compiler.js", "kb/kb-engine.js", "kb/kb-modelcheck.js"].forEach(function (f) {
  vm.runInContext(fs.readFileSync(path.join(base, f), "utf8"), ctx, { filename: f });
});
vm.runInContext("var kb = new KBEngine(KB_DATA, KBCompiler);", ctx);
var kb = ctx.kb, fails = 0;
function check(name, cond) { console.log((cond ? "PASS " : "FAIL ") + name); if (!cond) fails++; }
function show(r) { r.steps.forEach(function (s) { console.log("   " + "  ".repeat(s.depth) + s.text); }); console.log("   stats", JSON.stringify(r.stats)); }

// Skenario 1: Tugas HP rendah, Revisi bebas -> heal
kb.tell("at(revisi,kantin)"); kb.tell("at(tugas,asrama)"); kb.tell("hp_low(tugas)");
var r = kb.ask("should_heal(X,tugas)");
check("S1 should_heal(revisi,tugas) proved", r.proved && r.bindings[0].X === "revisi"); show(r);
check("S1 trace memuat R5,R4,R1/R2", ["R5", "R4"].every(function (x) { return JSON.stringify(r.tree).indexOf('"' + x + '"') >= 0; }));

// Skenario 2: Revisi sibuk -> NOT busy gagal
kb.tell("busy(revisi)");
r = kb.ask("should_heal(revisi,tugas)");
check("S2 busy(revisi) => not proved", !r.proved); show(r);
check("S2 alasan: terhalang busy", r.why.some(function (w) { return /busy/.test(w.text); }));
kb.untell("busy(revisi)");

// Skenario 3: Retreat (Tugas satu zona dengan Dosen)
kb.replace("at(tugas,_)", "at(tugas,lorong)"); kb.tell("at(dosen,lorong)");
r = kb.ask("must_retreat(tugas)");
check("S3 must_retreat(tugas)", r.proved); show(r);
r = kb.ask("must_retreat(revisi)");
check("S3b revisi di kantin => not proved", !r.proved);

// Skenario 3c: R8 (near) -- beda zona tapi dekat Dosen
kb.untell("at(dosen,_)"); kb.tell("near(tugas,dosen)");
r = kb.ask("must_retreat(tugas)");
check("S3c must_retreat(tugas) lewat R8 (near)", r.proved && JSON.stringify(r.tree).indexOf('"R8"') >= 0);
kb.untell("near(tugas,dosen)"); kb.tell("at(dosen,lorong)");

// Skenario 4: Alert - Laporan melihat MC, info menyebar, Revisi mencegat di lorong
kb.tell("at(laporan,perpus)"); kb.tell("sees(laporan,mc)"); kb.tell("at(mc,gerbang)");
r = kb.ask("knows_mc_at(revisi,Z)");
check("S4 knows_mc_at(revisi,gerbang)", r.proved && r.bindings[0].Z === "gerbang"); show(r);
r = kb.ask("should_block(revisi,Z)");
check("S4 should_block(revisi,lorong)", r.proved && r.bindings[0].Z === "lorong"); show(r);

// Skenario 5: query yang tidak terbukti
r = kb.ask("should_heal(laporan,tugas)");
check("S5 laporan bukan support => not proved", !r.proved); show(r);
r = kb.ask("must_retreat(dosen)");
check("S5b dosen bukan anomali => not proved, tanpa aturan terhalang", !r.proved); show(r);

// Skenario 6: simetri friend tidak looping
r = kb.ask("friend(revisi,tugas)"); check("S6 friend simetris", r.proved);
r = kb.ask("friend(tugas,revisi)"); check("S6b friend simetris (arah lain)", r.proved);
r = kb.ask("friend(tugas,dosen)"); check("S6c bukan teman dosen, berhenti (tidak looping)", !r.proved);

// Skenario 7: model checking (truth table) harus sepakat dengan resolution
var facts = KB_STATIC().concat(kb.activeFacts());
function KB_STATIC() { return ctx.KB_DATA.staticFacts; }
[["should_block(revisi,lorong)", true], ["must_retreat(tugas)", true], ["should_heal(laporan,tugas)", false], ["must_retreat(revisi)", false], ["knows_mc_at(revisi,gerbang)", true]].forEach(function (q) {
  var mc = ctx.KBModelCheck.entails(ctx.KB_DATA, facts, q[0]);
  var rs = kb.ask(q[0]).proved;
  console.log("   MC " + q[0] + " -> " + JSON.stringify(mc));
  if (mc.capped) check("S7 " + q[0] + ": truth table meledak (" + mc.atoms + " atom, 2^" + mc.atoms + " model) sedangkan resolution tetap " + rs, rs === q[1]);
  else check("S7 model-check == resolution == " + q[1] + " untuk " + q[0], mc.entailed === q[1] && rs === q[1]);
});
console.log("\nActive facts:", kb.activeFacts().join(" "));
console.log("Compiled R5 steps:\n  " + kb.compiled[4].steps.join("\n  "));
console.log(fails ? "\nGAGAL: " + fails : "\nSEMUA LULUS");
process.exit(fails ? 1 : 0);
