/* domain.pddl.js -- DATA planning: domain PDDL (teks) + pembuat problem dari state agent.
 * Dipisah dari planner.js seperti KB dipisah dari engine. */
var DOMAIN_PDDL = [
  "(define (domain deadline-run)",
  "  (:types npc zone item)",
  "  (:predicates (at ?n - npc ?z - zone) (has ?n - npc ?i - item) (item-at ?i - item ?z - zone)",
  "               (road ?a - zone ?b - zone) (gate-closed ?z - zone) (gate-open ?z - zone) (healed ?n - npc) (agent ?n - npc))",
  "  (:action move",
  "    :parameters (?n - npc ?from - zone ?to - zone)",
  "    :precondition (and (agent ?n) (at ?n ?from) (road ?from ?to) (gate-open ?to))",
  "    :effect (and (at ?n ?to) (not (at ?n ?from))))",
  "  (:action pickup",
  "    :parameters (?n - npc ?i - item ?z - zone)",
  "    :precondition (and (agent ?n) (at ?n ?z) (item-at ?i ?z))",
  "    :effect (and (has ?n ?i) (not (item-at ?i ?z))))",
  "  (:action open-gate",
  "    :parameters (?n - npc ?from - zone ?z - zone)",
  "    :precondition (and (agent ?n) (at ?n ?from) (road ?from ?z) (gate-closed ?z) (has ?n kunci))",
  "    :effect (and (gate-open ?z) (not (gate-closed ?z))))",
  "  (:action heal",
  "    :parameters (?n - npc ?t - npc ?z - zone)",
  "    :precondition (and (agent ?n) (at ?n ?z) (at ?t ?z) (has ?n kopi) (not (= ?n ?t)))",
  "    :effect (and (healed ?t) (not (has ?n kopi))))",
  ")"
].join("\n");

// Fakta fungsional: satu NPC hanya di satu zona (dipakai pruning backward search)
var PLAN_EXCLUSIVE = [{ pred: "at", key: 0 }];

/* spec = { npcs:{revisi:"kantin",tugas:"asrama"}, items:{kunci:"perpus",kopi:"lab"},   // item-at
 *          agents:["revisi"] (default: ["revisi"] bila ada, selain itu semua npc; hanya agent yang boleh bertindak),
 *          has:{revisi:["kunci"]}, closedGates:["lab"], goal:[["healed","tugas"]], edges:[[a,b],...] } */
function buildProblemPDDL(spec) {
  var edges = spec.edges || (typeof KB_DATA !== "undefined" ? KB_DATA.zoneEdges : []);
  var zones = {}; edges.forEach(function (e) { zones[e[0]] = 1; zones[e[1]] = 1; });
  var closed = {}; (spec.closedGates || []).forEach(function (z) { closed[z] = 1; });
  var init = [];
  var agents = spec.agents || (spec.npcs.revisi !== undefined ? ["revisi"] : Object.keys(spec.npcs));
  agents.forEach(function (n) { init.push("(agent " + n + ")"); });
  Object.keys(spec.npcs).forEach(function (n) { init.push("(at " + n + " " + spec.npcs[n] + ")"); });
  Object.keys(spec.items || {}).forEach(function (i) { init.push("(item-at " + i + " " + spec.items[i] + ")"); });
  Object.keys(spec.has || {}).forEach(function (n) { spec.has[n].forEach(function (i) { init.push("(has " + n + " " + i + ")"); }); });
  edges.forEach(function (e) { init.push("(road " + e[0] + " " + e[1] + ")"); init.push("(road " + e[1] + " " + e[0] + ")"); });
  Object.keys(zones).forEach(function (z) { init.push(closed[z] ? "(gate-closed " + z + ")" : "(gate-open " + z + ")"); });
  var items = {}; Object.keys(spec.items || {}).forEach(function (i) { items[i] = 1; });
  Object.keys(spec.has || {}).forEach(function (n) { spec.has[n].forEach(function (i) { items[i] = 1; }); });
  items.kunci = 1; items.kopi = 1;   // dipakai literal di domain
  return "(define (problem p) (:domain deadline-run)\n  (:objects " + Object.keys(spec.npcs).join(" ") + " - npc " + Object.keys(zones).join(" ") + " - zone " +
    Object.keys(items).join(" ") + " - item)\n  (:init " + init.join(" ") + ")\n  (:goal (and " + spec.goal.map(function (g) { return "(" + g.join(" ") + ")"; }).join(" ") + ")))";
}
if (typeof module !== "undefined") module.exports = { DOMAIN_PDDL: DOMAIN_PDDL, buildProblemPDDL: buildProblemPDDL, PLAN_EXCLUSIVE: PLAN_EXCLUSIVE };
