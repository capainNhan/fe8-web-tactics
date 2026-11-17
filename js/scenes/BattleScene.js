import { SpriteManager } from "../systems/sprites/SpriteManager.js";
import {
  calculateBattlePreview,
  resolveStrike
} from "../fe8Logic.js";
import { getIdleFrame } from "../systems/spriteSheet.js";
import {
  CHAR5_FRAME_FILES,
  getChar5TextureKey
} from "../data/battleAssets.js";
import { log as gameLog } from "../systems/GameLog.js";

/**
 * BATTLE SCENE
 * Màn hình giao chiến (cutscene): chỉ lo hiển thị và animation trận đấu.
 * Được MapScene mở bằng scene.launch("BattleScene", { attacker, defender, onComplete }).
 * Khi xong, scene tự đóng và gọi onComplete để MapScene tiếp tục.
 *
 * Phần bàn cờ (chọn đơn vị, menu, di chuyển, lượt) nằm ở MapScene.
 */
export class BattleScene extends Phaser.Scene {
  constructor() {
    super("BattleScene");

    this.spriteManager = new SpriteManager(this, {
      frameFiles: CHAR5_FRAME_FILES,
      getTextureKey: file => getChar5TextureKey(file)
    });

    this.animations = this.spriteManager.animations;
  }

  // ==========================================
  // LIFECYCLE
  // ==========================================

  init(data) {
    this.battleData = data;
  }

  create() {
    this.createBattleScreen();
    this.runBattle();
  }

  async runBattle() {
    const { attacker, defender, onComplete } = this.battleData;

    try {
      await this.ensureSpritesReady();
      await this.playBattle(attacker, defender);

    } catch (error) {
      console.error("Battle Runtime error:", error);

      this.log("Lỗi trận đấu: " + error.message);

    } finally {
      this.tweens.resumeAll();
      this.scene.stop();

      if (onComplete) onComplete({ attacker, defender });
    }
  }

  // Chuẩn bị sprite lần đầu; các trận sau dùng lại kết quả.
  async ensureSpritesReady() {
    if (this.spriteManager.ready) return;

    const result = await this.spriteManager.prepare(
      this.attackerSprite,
      this.defenderSprite
    );

    console.log("[SpriteManager] Đã chuẩn bị sprite:", result);

    this.log("Đã tải Char4 và sprite Char2.");
  }

  // ==========================================
  // BATTLE SCREEN
  // ==========================================

  createBattleScreen() {
    this.battleUI = this.add.container(0, 0)
      .setDepth(1000)
      .setVisible(false);

    this.battleUI.add([
      this.add.rectangle(
        192, 192, 384, 384, 0x101522
      ),

      this.add.rectangle(
        192, 90, 384, 180, 0x263b55
      ),

      this.add.rectangle(
        192, 285, 384, 198, 0x182337
      ),

      this.add.rectangle(
        192, 318, 384, 5, 0x8c9a9e
      )
    ]);

    // Sprite trái: sẽ được thay bằng Char5 sau khi tải manifest.
    this.attackerSprite = this.add.image(
      110, 316, "char1"
    )
      .setOrigin(0.5, 1)
      .setScale(1.7)
      .setFlipX(true);

    // Sprite phải: giữ nguyên Char2.
    this.defenderSprite = this.add.image(
      275, 316, "char2"
    )
      .setOrigin(0.5, 1)
      .setScale(1.7);

    this.attackerName = this.add.text(
      18,
      43,
      "",
      {
        fontSize: "13px",
        color: "#38bdf8"
      }
    );

    this.defenderName = this.add.text(
      366,
      43,
      "",
      {
        fontSize: "13px",
        color: "#f87171"
      }
    ).setOrigin(1, 0);

    this.attackerHPText = this.add.text(
      18,
      62,
      "",
      {
        fontSize: "12px",
        color: "#fff"
      }
    );

    this.defenderHPText = this.add.text(
      366,
      62,
      "",
      {
        fontSize: "12px",
        color: "#fff"
      }
    ).setOrigin(1, 0);

    this.attackerBar = this.add.rectangle(
      18, 84, 145, 7, 0x22c55e
    ).setOrigin(0, 0.5);

    this.defenderBar = this.add.rectangle(
      221, 84, 145, 7, 0x22c55e
    ).setOrigin(0, 0.5);

    this.battleMessage = this.add.text(
      192,
      350,
      "BATTLE START!",
      {
        fontSize: "13px",
        color: "#facc15",
        align: "center",
        wordWrap: { width: 350 }
      }
    ).setOrigin(0.5);

    this.battleUI.add([
      this.attackerSprite,
      this.defenderSprite,
      this.attackerName,
      this.defenderName,
      this.attackerHPText,
      this.defenderHPText,

      this.add.rectangle(
        18, 84, 145, 9, 0x111111
      ).setOrigin(0, 0.5),

      this.add.rectangle(
        221, 84, 145, 9, 0x111111
      ).setOrigin(0, 0.5),

      this.attackerBar,
      this.defenderBar,
      this.battleMessage
    ]);
  }

  // ==========================================
  // SPRITE FRAME
  // ==========================================

  setChar5Frame(sprite, file) {
    return this.spriteManager.setCharacterFrame(
      sprite,
      file
    );
  }

  setFrame(sprite, frame) {
    return this.spriteManager.setFrame(
      sprite,
      frame,
      this.attackerSprite
    );
  }

  // ==========================================
  // ANIMATION
  // ==========================================

  async playFrames(sprite, list, delay = 65) {
    if (!list?.length) return;

    for (const frame of list) {
      this.setFrame(sprite, frame);
      await this.wait(delay);
    }
  }

  async playChar5Frames(sprite, files, delay = 50) {
    if (!Array.isArray(files) || files.length === 0) {
      return;
    }

    for (const file of files) {
      this.setChar5Frame(sprite, file);
      await this.wait(delay);
    }
  }

  wait(ms) {
    return new Promise(resolve => {
      this.time.delayedCall(ms, resolve);
    });
  }

  // ==========================================
  // SAFE TWEEN
  // ==========================================

  runTween(config, timeout = 1500) {
    return new Promise(resolve => {
      let finished = false;
      let tween;
      let timer;

      const originalComplete = config.onComplete;
      const originalStop = config.onStop;

      const callbackScope =
        config.callbackScope || this;

      const finish = (callback, ...args) => {
        if (finished) return;

        finished = true;

        if (timer) {
          timer.remove();
        }

        try {
          if (typeof callback === "function") {
            callback.apply(callbackScope, args);
          }
        } finally {
          resolve();
        }
      };

      tween = this.tweens.add({
        ...config,

        onComplete: (...args) => {
          finish(originalComplete, ...args);
        },

        onStop: (...args) => {
          finish(originalStop, ...args);
        }
      });

      timer = this.time.delayedCall(
        timeout,
        () => {
          if (!finished && tween) {
            tween.stop();
          }

          finish();
        }
      );
    });
  }

  // ==========================================
  // HIT STOP
  // ==========================================

  async hitStop(duration = 45) {
    this.tweens.pauseAll();

    try {
      await this.wait(duration);
    } finally {
      this.tweens.resumeAll();
    }
  }

  // ==========================================
  // HIT EFFECT
  // ==========================================

  async hitEffect(
    sprite,
    startX,
    isLeft,
    crit,
    dead
  ) {
    sprite.setTintFill(0xffffff);

    const flashDuration = crit ? 45 : 35;
    const recoilDistance = crit ? 17 : 11;

    const flash = this.runTween({
      targets: sprite,
      alpha: 0.65,
      duration: flashDuration,
      yoyo: true,

      onComplete: () => {
        sprite.setAlpha(1);
        sprite.clearTint();
      }
    }, 300);

    const recoil = this.runTween({
      targets: sprite,

      x: startX + (
        isLeft
          ? recoilDistance
          : -recoilDistance
      ),

      duration: crit ? 75 : 60,
      yoyo: true,
      ease: "Quad.easeOut"
    }, 400);

    if (dead) {
      await Promise.all([
        flash,
        recoil
      ]);

      await this.runTween({
        targets: sprite,
        alpha: 0,
        duration: 220,
        ease: "Quad.easeIn"
      }, 500);

    } else {
      await Promise.all([
        flash,
        recoil
      ]);
    }

    sprite.setAlpha(1);
    sprite.clearTint();
  }

  // ==========================================
  // UPDATE HP UI
  // ==========================================

  updateBattleHP(a, d) {
    this.attackerHPText.setText(
      `HP ${a.hp}/${a.maxHp}`
    );

    this.defenderHPText.setText(
      `HP ${d.hp}/${d.maxHp}`
    );

    this.attackerBar.width = Math.max(
      0,
      145 * a.hp / a.maxHp
    );

    this.defenderBar.width = Math.max(
      0,
      145 * d.hp / d.maxHp
    );
  }

  // ==========================================
  // BATTLE RUNTIME
  // ==========================================

  async playBattle(atk, def) {
    this.battleUI.setVisible(true);

    this.attackerSprite
      .setPosition(110, 316)
      .setVisible(true)
      .setAlpha(1)
      .clearTint();

    this.defenderSprite
      .setPosition(275, 316)
      .setVisible(true)
      .setAlpha(1)
      .clearTint();

    this.setChar5Frame(
      this.attackerSprite,
      this.animations.player.attack[0]
    );

    this.setFrame(
      this.defenderSprite,
      getIdleFrame(this.animations.enemy)
    );

    this.attackerName.setText(atk.name);
    this.defenderName.setText(def.name);

    this.battleMessage.setText("GIAO CHIẾN!");

    this.updateBattleHP(atk, def);

    this.log(
      `=== ${atk.name} VS ${def.name} ===`
    );

    await this.wait(350);

    const pv = calculateBattlePreview(atk, def);

    // 1. Bên chủ động tấn công trước.
    await this.performStrike(
      atk,
      def,
      pv.attacker,
      this.attackerSprite,
      this.defenderSprite,
      this.animations.player
    );

    // 2. Đối thủ phản công nếu cả hai còn sống.
    if (
      def.hp > 0 &&
      atk.hp > 0 &&
      def.weapon
    ) {
      await this.performStrike(
        def,
        atk,
        pv.defender,
        this.defenderSprite,
        this.attackerSprite,
        this.animations.enemy
      );
    }

    // 3. Đánh bồi.
    if (atk.hp > 0 && def.hp > 0) {
      if (pv.attacker.double) {
        this.battleMessage.setText(
          `${atk.name} ĐÁNH BỒI!`
        );

        await this.performStrike(
          atk,
          def,
          pv.attacker,
          this.attackerSprite,
          this.defenderSprite,
          this.animations.player
        );

      } else if (pv.defender.double) {
        this.battleMessage.setText(
          `${def.name} ĐÁNH BỒI!`
        );

        await this.performStrike(
          def,
          atk,
          pv.defender,
          this.defenderSprite,
          this.attackerSprite,
          this.animations.enemy
        );
      }
    }

    this.battleMessage.setText(
      def.hp <= 0
        ? def.name + " GỤC NGÃ!"
        : atk.hp <= 0
          ? atk.name + " GỤC NGÃ!"
          : "KẾT THÚC"
    );

    await this.wait(650);
  }

  // ==========================================
  // SINGLE STRIKE
  // ==========================================

  async performStrike(
    atk,
    def,
    stats,
    atkSp,
    defSp,
    anim
  ) {
    const startX = atkSp.x;
    const defenderStartX = defSp.x;

    const isLeft = startX < defenderStartX;

    const targetX =
      defenderStartX + (isLeft ? -55 : 55);

    const result = resolveStrike(
      { ...atk },
      { ...def },
      stats
    );

    try {
      if (anim?.type === "manifest") {
        await this.performChar5Strike(
          atk,
          def,
          result,
          atkSp,
          defSp,
          anim,
          startX,
          defenderStartX,
          targetX,
          isLeft
        );

      } else {
        await this.performLegacyStrike(
          atk,
          def,
          result,
          atkSp,
          defSp,
          anim,
          startX,
          defenderStartX,
          targetX,
          isLeft
        );
      }

    } catch (error) {
      console.error("Strike animation error:", error);

      this.log(
        "Lỗi animation đòn đánh. Đã tiếp tục xử lý trận đấu."
      );

    } finally {
      this.tweens.resumeAll();

      await this.runTween({
        targets: atkSp,
        x: startX,
        duration: 170,
        ease: "Power2"
      }, 900);

      atkSp
        .setAlpha(1)
        .clearTint();

      if (atk.hp > 0) {
        if (anim?.type === "manifest") {
          this.setChar5Frame(
            atkSp,
            anim.attack[0]
          );
        } else {
          const idle = getIdleFrame(anim);
          if (idle) this.setFrame(atkSp, idle);
        }
      }

      if (def.hp > 0) {
        defSp
          .setAlpha(1)
          .clearTint();
      }

      this.updateBattleHP(atk, def);

      await this.wait(80);
    }
            }
    // ==========================================
  // CHAR5 STRIKE
  // ==========================================

  async performChar5Strike(
    atk,
    def,
    result,
    atkSp,
    defSp,
    anim,
    startX,
    defenderStartX,
    targetX,
    isLeft
  ) {
    const delay = anim.frameDurationMs || 50;

    const attackFrames = anim.attack || [];
    const returnFrames = anim.return || [];

    if (!attackFrames.length) {
      throw new Error("Char5 không có attack frames.");
    }

    // Chọn frame đầu tiên làm trạng thái chuẩn bị.
    this.setChar5Frame(
      atkSp,
      attackFrames[0]
    );

    await this.wait(delay);

    // Di chuyển và animation tấn công chạy song song.
    const movement = this.runTween({
      targets: atkSp,
      x: targetX,
      duration: 220,
      ease: "Power2"
    }, 1000);

    const attackAnimation = this.playChar5Frames(
      atkSp,
      attackFrames,
      delay
    );

    // Chạm mục tiêu ở gần frame cuối của pha lao tới.
    const impactIndex = Math.min(
      8,
      Math.max(0, attackFrames.length - 1)
    );

    await this.wait(
      impactIndex * delay + 20
    );

    // HP chỉ được thay đổi một lần tại điểm va chạm.
    if (result.hit) {
      def.hp = Math.max(
        0,
        def.hp - result.damage
      );

      this.battleMessage.setText(
        result.crit
          ? `${atk.name} CHÍ MẠNG!`
          : `${atk.name} TRÚNG ĐÒN!`
      );

      await this.hitStop(
        result.crit ? 65 : 45
      );

      this.cameras.main.shake(
        result.crit ? 180 : 90,
        result.crit ? 0.025 : 0.012
      );

      this.updateBattleHP(atk, def);

      this.log(
        `${atk.name} đánh trúng ${def.name}, mất ${result.damage} HP.`
      );

      await this.hitEffect(
        defSp,
        defenderStartX,
        isLeft,
        !!result.crit,
        def.hp <= 0
      );

      if (def.hp <= 0) {
        this.log(
          def.name + " đã bị hạ gục!"
        );
      }

    } else {
      this.battleMessage.setText(
        atk.name + " ĐÁNH TRƯỢT!"
      );

      this.log(
        atk.name + " đánh trượt!"
      );
    }

    // Chờ cả chuyển động và animation đánh hoàn tất.
    await Promise.all([
      movement,
      attackAnimation
    ]);

    // Lui về bằng chuỗi frame return trong manifest.
    if (returnFrames.length) {
      const retreatMovement = this.runTween({
        targets: atkSp,
        x: startX,
        duration: Math.max(
          180,
          returnFrames.length * delay
        ),
        ease: "Power2"
      }, 1500);

      const retreatAnimation = this.playChar5Frames(
        atkSp,
        returnFrames,
        delay
      );

      await Promise.all([
        retreatMovement,
        retreatAnimation
      ]);
    } else {
      await this.runTween({
        targets: atkSp,
        x: startX,
        duration: 170,
        ease: "Power2"
      }, 900);
    }

    this.setChar5Frame(
      atkSp,
      attackFrames[0]
    );
  }

  // ==========================================
  // LEGACY ENEMY STRIKE
  // ==========================================

  async performLegacyStrike(
    atk,
    def,
    result,
    atkSp,
    defSp,
    anim,
    startX,
    defenderStartX,
    targetX,
    isLeft
  ) {
    const rows = anim || [];

    const r0 = rows[0]?.frames || [];
    const r1 = rows[1]?.frames || [];
    const r2 = rows[2]?.frames || [];
    const r3 = rows[3]?.frames || [];

    const attackFrames = (
      result.crit && r2.length
        ? r2.slice(0, 10)
        : r1.slice(0, 6)
    );

    await this.playFrames(
      atkSp,
      r0.slice(1, 5),
      45
    );

    const movement = this.runTween({
      targets: atkSp,
      x: targetX,
      duration: 220,
      ease: "Power2"
    });

    const attackAnimation = this.playFrames(
      atkSp,
      attackFrames,
      55
    );

    const impactFrame = Math.min(
      2,
      Math.max(0, attackFrames.length - 1)
    );

    await this.wait(
      impactFrame * 55 + 30
    );

    if (result.hit) {
      def.hp = Math.max(
        0,
        def.hp - result.damage
      );

      this.battleMessage.setText(
        result.crit
          ? `${atk.name} CHÍ MẠNG!`
          : `${atk.name} TRÚNG ĐÒN!`
      );

      await this.hitStop(
        result.crit ? 65 : 45
      );

      this.cameras.main.shake(
        result.crit ? 180 : 90,
        result.crit ? 0.025 : 0.012
      );

      this.updateBattleHP(atk, def);

      this.log(
        `${atk.name} đánh trúng ${def.name}, mất ${result.damage} HP.`
      );

      await this.hitEffect(
        defSp,
        defenderStartX,
        isLeft,
        !!result.crit,
        def.hp <= 0
      );

      if (def.hp <= 0) {
        this.log(
          def.name + " đã bị hạ gục!"
        );
      }

    } else {
      this.battleMessage.setText(
        atk.name + " ĐÁNH TRƯỢT!"
      );

      this.log(
        atk.name + " đánh trượt!"
      );
    }

    await Promise.all([
      attackAnimation,
      movement
    ]);

    if (r0[0]) {
      this.setFrame(atkSp, r0[0]);
    }
  }

  // ==========================================
  // BATTLE LOG
  // ==========================================

  log(message) {
    gameLog(message);
  }
}
