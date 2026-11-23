/* =====================================================================
 * kb-rules.js  --  DATA SAJA (Knowledge Base), tanpa logika inferensi.
 * Mesin inferensi ada di kb-engine.js, kompilasi di kb-compiler.js.
 * Aturan ditulis terbaca (IF-THEN). Variabel = huruf kapital (X, Y, Z).
 * "nots" = syarat NOT (negation as failure / closed-world assumption).
 * ===================================================================== */
var KB_DATA = {
  // Fakta statis (tidak berubah selama game)
  staticFacts: [
    "anomali(tugas)", "anomali(revisi)", "anomali(laporan)",
    "role(revisi,support)", "role(laporan,scout)", "role(tugas,fighter)",
    "ally_base(tugas,revisi)", "ally_base(tugas,laporan)", "ally_base(revisi,laporan)",
    "chokepoint(lorong)", "chokepoint(jembatan)"
  ],
  // Peta zona (graf tak berarah). Dipasang sebagai road(A,B) DUA arah.
  // Catatan: akan divalidasi otomatis dengan A* tahap 1 antar pusat zona.
  zoneEdges: [
    ["gerbang","perpus"], ["gerbang","lab"], ["gerbang","lorong"],
    ["perpus","lorong"], ["lorong","posdosen"], ["lorong","kantin"],
    ["lorong","lab"], ["lorong","asrama"], ["lorong","jembatan"],
    ["jembatan","asrama"], ["jembatan","kos"]
  ],
  // Predikat dinamis (di-TELL oleh game tiap tick / event)
  dynamicPreds: ["at/2", "hp_low/1", "has/2", "busy/1", "sees/2", "near/2"],

  rules: [
    { id: "R1", then: "friend(X,Y)", ifs: ["ally_base(X,Y)"], nots: [],
      note: "Pertemanan (arah 1). Dipecah jadi R1+R2 agar tidak looping simetris." },
    { id: "R2", then: "friend(X,Y)", ifs: ["ally_base(Y,X)"], nots: [],
      note: "Pertemanan (arah 2)." },
    { id: "R3", then: "knows_mc_at(Y,Z)", ifs: ["sees(X,mc)", "at(mc,Z)", "friend(X,Y)"], nots: [],
      note: "Info posisi MC menyebar lewat teman (Laporan sebagai scout)." },
    { id: "R4", then: "needs_help(Y)", ifs: ["anomali(Y)", "hp_low(Y)"], nots: [],
      note: "Anomali dengan HP rendah butuh bantuan." },
    { id: "R5", then: "should_heal(X,Y)", ifs: ["role(X,support)", "friend(X,Y)", "needs_help(Y)"], nots: ["busy(X)"],
      note: "Support menyembuhkan teman yang butuh bantuan jika tidak sibuk." },
    { id: "R6", then: "must_retreat(X)", ifs: ["anomali(X)", "at(X,Z)", "at(dosen,Z)"], nots: [],
      note: "Anomali satu zona dengan Dosen harus mundur ke Kos." },
    { id: "R7", then: "should_block(X,Z)", ifs: ["role(X,support)", "knows_mc_at(X,Z0)", "road(Z0,Z)", "chokepoint(Z)"], nots: ["busy(X)"],
      note: "Support mencegat MC di chokepoint yang bersebelahan dengan posisi MC." },
    { id: "R8", then: "must_retreat(X)", ifs: ["anomali(X)", "near(X,dosen)"], nots: [],
      note: "Anomali yang berada dekat Dosen (jarak <= radius, tanpa harus satu zona) harus mundur ke Kos." }
  ]
};
if (typeof module !== "undefined") module.exports = KB_DATA;
