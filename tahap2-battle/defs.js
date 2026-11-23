/* ======================= DEFINISI FORMAL ======================= */
function buildDefs(){
  $("defsBody").innerHTML=`
  <h4>1. State</h4>
  <p><code>s = (HP_MC, HP_NPC, SP, buff, item, cd, heal_left, def, turn, used_item)</code></p>
  <ul>
   <li><b>HP_MC</b> ∈ [0,${B.MC_HP}], <b>HP_NPC</b> ∈ [0,${B.NPC_HP}] (awal ${B.MC_HP} dan ${B.NPC_HP}).</li>
   <li><b>SP</b> (stamina battle MC) ∈ [0,${B.SP_MAX}], awal ${B.SP_START}. <b>buff</b> = sisa serangan ber-buff (0–${B.BUFF_CHARGES}). <b>item</b> ∈ {kosong, heal, buff, sp} (1 slot).</li>
   <li><b>cd</b> = sisa cooldown skill villain, <b>heal_left</b> = sisa heal villain (awal ${B.NPC_HEALS}), <b>def</b> = villain sedang bertahan.</li>
   <li><b>turn</b> ∈ {NPC, MC}; <b>used_item</b> = MC sudah memakai item pada gilirannya (maks 1 item/giliran).</li>
  </ul>
  <p>State awal: villain jalan pertama karena dia yang menangkap. NPC = pemain MAX, MC = pemain MIN.</p>
  <h4>2. Action (branching ≤ 4)</h4>
  <ul>
   <li><b>NPC:</b> <code>attack</code> (${B.NPC_DMG.attack} dmg) · <code>skill</code> (${B.NPC_DMG.skill} dmg, cooldown ${B.NPC_SKILL_CD} giliran) · <code>heal</code> (+${B.NPC_HEAL} HP, maks ${B.NPC_HEALS}x/battle) · <code>defend</code> (damage MC berikutnya ×${B.DEFEND_MULT}).</li>
   <li><b>MC:</b> <code>basic</code> (${B.DMG.basic} dmg, +1 SP) · <code>skillE</code> (${B.DMG.skillE} dmg, −2 SP) · <code>skillQ</code> (${B.DMG.skillQ} dmg, −3 SP) · <code>item</code> (−${B.ITEM_SP_COST} SP, <i>tidak mengakhiri giliran</i>; heal +${B.HEAL_POTION} HP / buff ×${B.BUFF_MULT} untuk ${B.BUFF_CHARGES} serangan / SP +${B.SP_POTION}).</li>
   <li>Legalitas: skillE butuh SP≥2, skillQ SP≥3, item butuh item &amp; SP≥1 &amp; belum dipakai giliran ini, skill NPC butuh cd=0, heal butuh heal_left&gt;0 &amp; HP&lt;maks. <code>basic</code>/<code>attack</code> selalu legal sehingga tidak pernah deadlock.</li>
   <li>Karena item tidak mengakhiri giliran, item dimodelkan sebagai <b>sub-aksi</b> (simpul MIN berikutnya tetap milik MC). Setiap simpul tetap ≤ 4 cabang; kedalaman dihitung dalam <b>ply</b> (1 aksi = 1 ply).</li>
  </ul>
  <h4>3. Transition</h4>
  <p>Damage MC = dmg × (${B.BUFF_MULT} jika buff&gt;0) × (${B.DEFEND_MULT} jika def). Setelah aksi penyerangan MC: giliran ke NPC, <code>cd ← max(0, cd−1)</code>, <code>def ← false</code>. Setelah aksi NPC: giliran ke MC. Deterministik (tanpa RNG) kecuali pada Expectimax.</p>
  <h4>4. Terminal test</h4>
  <p><code>TERMINAL(s) = (HP_MC ≤ 0) ∨ (HP_NPC ≤ 0)</code>, atau depth cutoff = 0 (lalu memakai fungsi evaluasi).</p>
  <h4>5. Utility (sudut pandang NPC)</h4>
  <p><code>U(s) = +${B.TERMINAL_BASE} + HP_NPC + d</code> jika NPC menang; <code>U(s) = −(${B.TERMINAL_BASE} + HP_MC) − d</code> jika MC menang; <i>d</i> = sisa depth (menang lebih cepat / kalah lebih lambat lebih baik). Nilai dasar ${B.TERMINAL_BASE} membuat terminal selalu mengalahkan skor evaluasi heuristik.</p>
  <h4>6. Evaluation function (saat cutoff)</h4>
  <ul>
   <li><b>E1 Selisih HP:</b> <code>HP_NPC − HP_MC</code></li>
   <li><b>E2 Rasio HP:</b> <code>1000·(HP_NPC/${B.NPC_HP} − HP_MC/${B.MC_HP})</code></li>
   <li><b>E3 HP + resource:</b> E2 − 35·SP − 80·buff − 40·[MC bawa item] + 40·[cd=0] + 15·heal_left + 30·[def]</li>
   <li><b>E4 Agresif:</b> <code>1.6·(${B.MC_HP} − HP_MC) − 0.5·(${B.NPC_HP} − HP_NPC) + 40·[cd=0]</code></li>
   <li><b>E5 Defensif:</b> <code>1.5·1000·HP_NPC/${B.NPC_HP} − 0.6·1000·HP_MC/${B.MC_HP} + 40·heal_left + 30·[def]</code></li>
  </ul>
  <h4>7. Asumsi tambahan</h4>
  <ul>
   <li>HP battle direset tiap battle; nyawa: kalah −1, menang +1 poin; menang game = ${WIN_TARGET} kemenangan, kalah game = ${LIVES_START} nyawa habis.</li>
   <li>Item dibawa 1 slot dari map dan tidak hilang bila tidak dipakai; efek buff dan defend hanya berlaku di dalam battle.</li>
   <li>Setelah battle MC tetap di posisi terakhir, villain respawn ≥ ${FAR_DIST} tile darinya dan diam ${GRACE_MS/1000} detik.</li>
   <li>Expectimax: giliran MC = chance node dengan bobot basic .25 / skillE .30 / skillQ .35 / item .10 (dinormalisasi terhadap aksi legal).</li>
   <li>Nilai balance (HP villain ${B.NPC_HP}, heal, cooldown) dituning lewat simulasi NPC vs bot MC.</li>
  </ul>`;
}

