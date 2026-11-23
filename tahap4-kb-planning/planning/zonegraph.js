/* zonegraph.js -- jembatan antara peta tile 40x40 (tahap 1) dan zona simbolik (KB/planner).
 * ZONE_CENTERS = koordinat tile PERKIRAAN dari screenshot peta (px * 40 / 1254). Wajib dikalibrasi:
 * jalankan ZoneGraph.validate(env) di game (lihat tahap4-init.js) lalu betulkan koordinat yang ditandai. */
var ZONE_CENTERS = {
  gerbang: [5, 31], perpus: [9, 16], lab: [11, 35], lorong: [20, 18], posdosen: [19, 8],
  kantin: [24, 21], jembatan: [26, 31], asrama: [36, 11], kos: [36, 37]
};
var ZoneGraph = (function () {
  function nearestWalkable(env, x, y) {
    for (var r = 0; r < 12; r++)
      for (var dy = -r; dy <= r; dy++) for (var dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        var tx = x + dx, ty = y + dy;
        if (tx >= 0 && ty >= 0 && tx < env.COLS && ty < env.ROWS && env.isWalkable(tx, ty)) return { x: tx, y: ty };
      }
    return null;
  }
  function dist(a, b) { return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]); }
  // zona terdekat dari sebuah tile (Voronoi Manhattan). Dipakai agent-loop untuk TELL at(npc,zona).
  function zoneOf(tx, ty, centers) {
    centers = centers || ZONE_CENTERS; var best = null, bd = 1e9;
    Object.keys(centers).forEach(function (z) { var d = dist([tx, ty], centers[z]); if (d < bd) { bd = d; best = z; } });
    return best;
  }
  /* env = {COLS, ROWS, isWalkable(x,y), searchPath(start,goal,type)} (semua dari tahap 1).
   * Hasil: baris per edge {a,b,found,len,viaZones[]}; viaZones = zona lain yang dilewati jalur (indikasi edge bukan langsung). */
  function validate(env, edges, centers) {
    centers = centers || ZONE_CENTERS; edges = edges || KB_DATA.zoneEdges;
    var snap = {}, rows = [], bad = [];
    Object.keys(centers).forEach(function (z) {
      var s = nearestWalkable(env, centers[z][0], centers[z][1]); snap[z] = s;
      if (!s) bad.push(z + ": tidak ada tile walkable di dekat pusat zona");
      else if (s.x !== centers[z][0] || s.y !== centers[z][1]) bad.push(z + ": pusat digeser ke (" + s.x + "," + s.y + ") karena tidak walkable");
    });
    edges.forEach(function (e) {
      var a = snap[e[0]], b = snap[e[1]], row = { a: e[0], b: e[1], found: false, len: null, viaZones: [] };
      if (a && b) {
        var r = env.searchPath(a, b, "manhattan"); row.found = !!r.found;
        if (r.found) {
          row.len = r.path.length - 1;
          Object.keys(centers).forEach(function (z) {
            if (z === e[0] || z === e[1]) return;
            if (r.path.some(function (p) { return Math.abs(p.x - snap[z].x) + Math.abs(p.y - snap[z].y) <= 3; })) row.viaZones.push(z);
          });
        }
      }
      if (!row.found) bad.push("edge " + e[0] + "-" + e[1] + ": TIDAK ADA jalur");
      else if (row.viaZones.length) bad.push("edge " + e[0] + "-" + e[1] + ": jalur melewati " + row.viaZones.join(",") + " (mungkin bukan edge langsung)");
      rows.push(row);
    });
    return { rows: rows, problems: bad, ok: bad.length === 0, snapped: snap };
  }
  return { zoneOf: zoneOf, validate: validate, nearestWalkable: nearestWalkable };
})();
if (typeof module !== "undefined") module.exports = { ZONE_CENTERS: ZONE_CENTERS, ZoneGraph: ZoneGraph };
