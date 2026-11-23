// node test/planner-node-test.js
var fs = require("fs"), path = require("path"), vm = require("vm"), base = path.join(__dirname, "..");
var ctx = { console: console, Date: Date, Math: Math, performance: performance };
vm.createContext(ctx);
["kb/kb-rules.js", "planning/pddl-parser.js", "planning/domain.pddl.js", "planning/planner.js"].forEach(function (f) { vm.runInContext(fs.readFileSync(path.join(base, f), "utf8"), ctx, { filename: f }); });
var fails = 0; function check(n, c) { console.log((c ? "PASS " : "FAIL ") + n); if (!c) fails++; }
function run(spec, algo) { return vm.runInContext("(function(s,a){return Planner.plan(DOMAIN_PDDL, buildProblemPDDL(s), a);})", ctx)(spec, algo); }
function row(r) { return (r.algo + "          ").slice(0, 12) + " found=" + r.found + " len=" + r.stats.length + " expanded=" + r.stats.expanded + " generated=" + r.stats.generated + " ms=" + r.stats.ms + (r.stats.pruned !== undefined ? " pruned=" + r.stats.pruned : ""); }

var heal = { npcs: { revisi: "kantin", tugas: "asrama" }, items: { kunci: "perpus", kopi: "lab" }, closedGates: ["lab"], goal: [["healed", "tugas"]] };
var algos = ["bfs", "astar-hmax", "astar-hff", "backward"], rs = {};
algos.forEach(function (a) { rs[a] = run(heal, a); console.log(row(rs[a])); });
console.log(rs["astar-hmax"].plan.map(function (s) { return s.text; }).join(" -> "));
algos.forEach(function (a) { check("E-heal " + a + " menemukan plan", rs[a].found); });
check("bfs panjang 10 (optimal)", rs.bfs.stats.length === 10);
check("astar-hmax juga optimal (10)", rs["astar-hmax"].stats.length === 10);
check("astar-hmax expand <= bfs", rs["astar-hmax"].stats.expanded <= rs.bfs.stats.expanded);
check("plan berisi pickup kunci, open-gate, pickup kopi, heal", ["pickup revisi kunci perpus", "open-gate revisi", "pickup revisi kopi lab", "heal revisi tugas asrama"].every(function (t) { return rs.bfs.plan.some(function (s) { return s.text.indexOf(t) >= 0; }); }));

// Tanpa gerbang tertutup (E6): plan lebih pendek
var open = JSON.parse(JSON.stringify(heal)); open.closedGates = [];
var r = run(open, "astar-hmax"); console.log("tanpa gerbang:", row(r));
check("tanpa gerbang plan lebih pendek dari 10", r.found && r.stats.length < 10);

// Replan: sudah punya kunci & kopi dan sudah di asrama -> 1 langkah
var near = { npcs: { revisi: "asrama", tugas: "asrama" }, has: { revisi: ["kopi"] }, items: {}, goal: [["healed", "tugas"]] };
r = run(near, "bfs"); check("sudah di zona yang sama + punya kopi => 1 langkah heal", r.found && r.stats.length === 1 && r.plan[0].name === "heal");

// Replan setelah gerbang ditutup lagi / posisi berubah
var mid = { npcs: { revisi: "lorong", tugas: "kos" }, has: { revisi: ["kunci"] }, items: { kopi: "lab" }, closedGates: ["lab"], goal: [["healed", "tugas"]] };
r = run(mid, "astar-hmax"); console.log("replan:", r.plan.map(function (s) { return s.text; }).join(" -> "));
check("replan dari tengah jalan valid", r.found && r.plan[0].name === "open-gate");

// Goal tidak mungkin: kopi tidak ada di mana pun
var imp = { npcs: { revisi: "kantin", tugas: "asrama" }, items: { kunci: "perpus" }, closedGates: ["lab"], goal: [["healed", "tugas"]] };
r = run(imp, "bfs"); check("tanpa kopi => tidak ada plan (found=false, berhenti)", !r.found);
r = run(imp, "backward"); check("backward juga tidak menemukan (berhenti)", !r.found);
console.log(fails ? "\nGAGAL: " + fails : "\nSEMUA LULUS"); process.exit(fails ? 1 : 0);
