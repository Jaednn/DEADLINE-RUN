# Tahap 4 — KB + Planning (M1: KB engine)
Buka `kb-test.html` langsung (double click). Tes Node: `node test/kb-node-test.js`.

Struktur: lib/tau-prolog.js (library, dipatch: callback sinkron) · kb/kb-rules.js (DATA) · kb/kb-compiler.js · kb/kb-engine.js (TELL/ASK + meta-interpreter) · kb/kb-modelcheck.js (pembanding eksperimen) · overlay/kb-panel.js (tab KB).

Kontrak: `kb.tell(f)`, `kb.untell(p)`, `kb.replace(p,f)`, `kb.ask(q) -> {proved, bindings, steps, tree, why, stats}`.
Pasang ke game: tambahkan 5 `<script>` (lib, rules, compiler, engine, panel) lalu `KBPanel.mount(div, new KBEngine(KB_DATA, KBCompiler))`.

Asumsi default (belum dikonfirmasi): MC spawn Gerbang, Tugas spawn Asrama; HP Tugas carry-over jika MC kalah; 4 petak jalan abu-abu dekor.
Catatan: bagian "ask" memakai closed-world (tidak terbukti = salah); NOT = negation as failure.

## M2 — Planner (Automated Planning)
Buka `planner-test.html`. Tes Node: `node test/planner-node-test.js`.
- planning/pddl-parser.js  parser S-expression PDDL (domain + problem, bertipe, STRIPS positif)
- planning/domain.pddl.js  DATA: DOMAIN_PDDL (move, pickup, open-gate, heal) + buildProblemPDDL(spec)
- planning/planner.js      Planner.plan(domain, problem, algo): bfs | astar-hmax | astar-hff | backward
- planning/zonegraph.js    ZONE_CENTERS (tile, PERKIRAAN), ZoneGraph.zoneOf(), ZoneGraph.validate(env)
- overlay/planner-panel.js PlannerPanel.mount(div) / .show(result) / .run(spec, algo)
Catatan: hanya NPC ber-predikat `agent` (Revisi) yang boleh bertindak; Tugas hanya objek yang ditolong.

## M3 — Agent loop, NPC baru, efek pra-battle
Tab: K = KB · L = Planner · I = Interaksi. Tes: `node test/kb-node-test.js`, `node test/planner-node-test.js`, `node test/m3-integration-test.js` (memakai kode game asli).
- npc/agent-loop.js      otak NPC: SENSE → TELL → ASK → GOAL → PLAN → EXECUTE → MONITOR/replan (tanpa DOM, bisa dites di Node)
- npc/world-adapter.js   satu-satunya yang menyentuh game: membungkus updateExplore, playerMove, render, startBattle, finishBattle, continueAfterBattle, reset; sprite recolor (hue-rotate)
- overlay/interaksi-panel.js  tab Interaksi (status, pengaturan, log + alasan aturan KB, tombol debug)
Efek (hanya sebelum battle): Heal (+300 HP Tugas, dibawa ke battle berikutnya) · Retreat (anomali sezona dengan Dosen lari ke Kos, 8 dtk) · Cegat (MC tertahan 1,2 dtk) · Alert (grace Tugas dibatalkan).
Prioritas Revisi: Retreat > Heal > Cegat > pulang. HP Tugas kini terbawa antar battle (MC kalah → HP sisa; MC menang → penuh).
Parameter ada di Tahap4Agent.DEFAULTS (hpLow 770, heal 300, retreatMs 8000, visionR 9, dst).
Warna sprite: TahapAdapter.LOOK (hue/sat/bri) — sesuaikan bila kurang kontras.
