import { UI_SCALE } from "../config.js";
import { log as gameLog } from "../systems/GameLog.js";
import { attachBattleMusic, playStrikeSfx } from "../systems/audio/index.js";
import { TearRingStage, STAGE_W, STAGE_H } from "../tearring/stage.js";
import { TEARRING_UNITS, MOTION } from "../data/tearringUnits.js";

// Toạ độ PSX (320 rộng) của hai bên và khoảng dừng khi bên tấn công áp sát.
const LEFT_X = 70;
const RIGHT_X = 250;
const CLOSE_GAP = 105;

// Sân khấu 320x160 hiển thị phóng 1.2 lần trong khung 384x384.
const STAGE_SCALE = 1.2;
const STAGE_TOP = 118;

/**
 * TEARRING BATTLE SCENE
 * Màn giao chiến chạy bằng engine TearRing Saga port từ bản decomp (js/tearring/).
 * Cùng giao diện dữ liệu với BattleScene cũ: { attacker, defender, strikes, before, onComplete }.
 * Diễn biến (strikes) đã được luật chơi tính sẵn; scene chỉ phát lại, KHÔNG tung xúc xắc.
 *
 * Điều phối (CHƯA decomp trong game, nên do scene này quyết định):
 *   phi tới = M0_1 lặp   | đòn mở đầu = M1_0  | đòn sau = M1_1 | chí mạng = M1_8 | né = M0_4 | chờ = M0_0
 * Thời điểm trúng đòn lấy từ sự kiện THẬT trong dữ liệu motion (evt 0x01 = g_BtlHitFlag).
 */
export class TearRingBattleScene extends Phaser.Scene {
  constructor() { super("TearRingBattleScene"); }

  init(data) { this.battleData = data; }

  create() {
    attachBattleMusic(this, this.battleData);
    this.runBattle();
  }

  async runBattle() {
    const { attacker, defender, before, onComplete } = this.battleData;
    try {
      this.createScreen(attacker, defender);
      const atk = { ...attacker, hp: before.attackerHp };
      const def = { ...defender, hp: before.defenderHp };
      await this.playBattle(atk, def);
    } catch (error) {
      console.error("Battle Runtime error:", error);
      gameLog("Lỗi trận đấu: " + error.message);
    } finally {
      this.tweens.resumeAll();
      this.scene.stop();
      if (onComplete) onComplete({ attacker, defender });
    }
  }

  // ==========================================
  // SCREEN
  // ==========================================

  createScreen(attacker, defender) {
    const common = this.cache.json.get("tr-common");
    const rsincos = this.cache.binary.get("tr-rsincos");
    const ids = [attacker.trUnit, defender.trUnit];
    this.stage = new TearRingStage(this, {
      assets: { common, rsincos, paks: ids.map(id => this.cache.binary.get("tr-" + id)) },
      units: ids,
      config: TEARRING_UNITS,
      x: [LEFT_X, RIGHT_X]
    });
    this.left = this.stage.actors.left;
    this.right = this.stage.actors.right;
    this.left.loop(MOTION.idle);
    this.right.loop(MOTION.idle);

    const text = (x, y, s, color, origin) => this.add.text(x, y, s, { fontSize: "13px", resolution: UI_SCALE, color })
      .setOrigin(...(origin || [0, 0]));

    this.ui = this.add.container(0, 0).setDepth(1000).setScale(UI_SCALE);
    this.attackerName = text(18, 43, "", "#38bdf8");
    this.defenderName = text(366, 43, "", "#f87171", [1, 0]);
    this.attackerHPText = text(18, 62, "", "#fff");
    this.defenderHPText = text(366, 62, "", "#fff", [1, 0]);
    this.attackerBar = this.add.rectangle(18, 84, 145, 7, 0x22c55e).setOrigin(0, 0.5);
    this.defenderBar = this.add.rectangle(221, 84, 145, 7, 0x22c55e).setOrigin(0, 0.5);
    this.battleMessage = this.add.text(192, 350, "BATTLE START!", {
      fontSize: "13px", resolution: UI_SCALE, color: "#facc15", align: "center", wordWrap: { width: 350 }
    }).setOrigin(0.5);

    this.ui.add([
      this.add.rectangle(192, 192, 384, 384, 0x101522),
      this.add.image(0, STAGE_TOP, this.stage.key).setOrigin(0, 0).setScale(STAGE_SCALE),
      this.attackerName, this.defenderName, this.attackerHPText, this.defenderHPText,
      this.add.rectangle(18, 84, 145, 9, 0x111111).setOrigin(0, 0.5),
      this.add.rectangle(221, 84, 145, 9, 0x111111).setOrigin(0, 0.5),
      this.attackerBar, this.defenderBar, this.battleMessage
    ]);
  }

  updateHP(a, d) {
    this.attackerHPText.setText(`HP ${a.hp}/${a.maxHp}`);
    this.defenderHPText.setText(`HP ${d.hp}/${d.maxHp}`);
    this.attackerBar.width = Math.max(0, 145 * a.hp / a.maxHp);
    this.defenderBar.width = Math.max(0, 145 * d.hp / d.maxHp);
  }

  wait(ms) { return new Promise(r => this.time.delayedCall(ms, r)); }

  // ==========================================
  // BATTLE
  // ==========================================

  async playBattle(atk, def) {
    this.attackerName.setText(atk.name);
    this.defenderName.setText(def.name);
    this.battleMessage.setText("GIAO CHIẾN!");
    this.sides = [atk, def];            // ô HP bên trái/phải luôn theo bên tấn công/phòng thủ của TRẬN, không theo người đang ra đòn
    this.updateHP(atk, def);
    gameLog(`=== ${atk.name} VS ${def.name} ===`);

    const fighters = {
      [atk.id]: { unit: atk, actor: this.left, approaches: true, ready: false },
      [def.id]: { unit: def, actor: this.right, approaches: false, ready: false }
    };

    await this.wait(350);

    for (const strike of this.battleData.strikes) {
      const from = fighters[strike.attackerId], to = fighters[strike.defenderId];
      if (strike.kind === "double") this.battleMessage.setText(`${from.unit.name} ĐÁNH BỒI!`);
      try {
        await this.strike(from, to, strike);
      } catch (error) {
        console.error("Strike animation error:", error);
        gameLog("Lỗi animation đòn đánh. Đã tiếp tục xử lý trận đấu.");
      } finally {
        this.tweens.resumeAll();
        this.stage.frozen = false;
        this.updateHP(atk, def);
        await this.wait(80);
      }
    }

    this.battleMessage.setText(
      def.hp <= 0 ? def.name + " GỤC NGÃ!" : atk.hp <= 0 ? atk.name + " GỤC NGÃ!" : "KẾT THÚC"
    );
    await this.wait(650);
  }

  async strike(from, to, result) {
    const A = from.actor, D = to.actor;
    const atk = from.unit, def = to.unit;
    const toRight = A === this.left;

    // Phi tới sát đối thủ (chỉ lần đầu), rồi đứng yên tại chỗ.
    if (from.approaches) {
      const targetX = D.part.x + (toRight ? -CLOSE_GAP : CLOSE_GAP);
      if (A.has(MOTION.move)) A.loop(MOTION.move);
      await new Promise(resolve => this.tweens.add({
        targets: A.part, x: targetX,
        duration: Math.max(260, Math.abs(targetX - A.part.x) * 4),
        ease: "Quad.easeOut", onComplete: resolve, onStop: resolve
      }));
      from.approaches = false;
    }

    let id = from.ready && A.has(MOTION.attack2) ? MOTION.attack2 : MOTION.attack;
    if (result.hit && result.crit && A.has(MOTION.crit)) id = MOTION.crit;
    if (!A.has(id)) throw new Error("unit không có motion " + id);

    const h = A.play(id);
    // Mọi lần trúng sau lần đầu (đòn nhiều nhát) chỉ làm nháy sáng, HP chỉ trừ một lần.
    h.onHit = () => { if (result.hit) D.flash(50); };

    await h.hit;                                   // sự kiện trúng đòn thật của motion

    playStrikeSfx(result);

    let dodge = Promise.resolve();
    if (result.hit) {
      def.hp = Math.max(0, def.hp - result.damage);
      this.battleMessage.setText(result.crit ? `${atk.name} CHÍ MẠNG!` : `${atk.name} TRÚNG ĐÒN!`);

      this.tweens.pauseAll();
      await this.stage.freeze(result.crit ? 65 : 45);
      this.tweens.resumeAll();

      this.cameras.main.shake(result.crit ? 180 : 90, result.crit ? 0.025 : 0.012);
      this.updateHP(...this.sides);
      gameLog(`${atk.name} đánh trúng ${def.name}, mất ${result.damage} HP.`);
      await this.hitReaction(D, toRight, !!result.crit, def.hp <= 0);
      if (def.hp <= 0) gameLog(def.name + " đã bị hạ gục!");
    } else {
      this.battleMessage.setText(atk.name + " ĐÁNH TRƯỢT!");
      gameLog(atk.name + " đánh trượt!");
      dodge = this.dodge(D, toRight);
    }

    await Promise.all([h.done, dodge]);
    from.ready = true;
  }

  async dodge(D, toRight) {
    if (D.has(MOTION.dodge)) {
      const d = D.play(MOTION.dodge);
      await d.done;
      return;
    }
    const x0 = D.part.x;
    await new Promise(resolve => this.tweens.add({
      targets: D.part, x: x0 + (toRight ? 14 : -14), duration: 90, yoyo: true, ease: "Quad.easeOut",
      onComplete: resolve, onStop: resolve
    }));
    D.part.x = x0;
  }

  // Nháy sáng + giật lùi; bị hạ thì mờ dần (trộn 50% của GPU) rồi biến mất.
  async hitReaction(D, toRight, crit, dead) {
    const x0 = D.part.x, dist = (crit ? 14 : 9) * (toRight ? 1 : -1);
    D.flash(crit ? 90 : 70);
    await new Promise(resolve => this.tweens.add({
      targets: D.part, x: x0 + dist, duration: crit ? 75 : 60, yoyo: true, ease: "Quad.easeOut",
      onComplete: resolve, onStop: resolve
    }));
    D.part.x = x0;
    if (dead) {
      D.part.f_b8 = 1; D.part.blend_bc = 0;
      await this.wait(220);
      D.visible = false;
    }
  }
}
