import {
  calculateBattlePreview,
  resolveStrike
} from "../fe8Logic.js";
import { SpriteManager } from "../systems/sprites/SpriteManager.js";
import { getBattleSpriteId } from "../data/battleSprites.js";
import { log as gameLog } from "../systems/GameLog.js";

// Vị trí đứng của hai bên và mặt đất trên màn hình trận đánh.
const LEFT_X = 80;
const RIGHT_X = 304;
const GROUND_Y = 316;

/**
 * BATTLE SCENE
 * Màn hình giao chiến (cutscene): chỉ lo hiển thị và animation trận đấu.
 * Được MapScene mở bằng scene.launch("BattleScene", { attacker, defender, onComplete }).
 * Khi xong, scene tự đóng và gọi onComplete để MapScene tiếp tục.
 *
 * Sprite của mỗi bên lấy từ spritesheet theo unit.battleSprite
 * (xem systems/sprites/SheetSpriteSet.js).
 *
 * Cách giao chiến (theo battle của Tear Ring Saga):
 * - Bên tấn công phi tới sát đối thủ rồi ở yên đó, KHÔNG lui về.
 * - Bên bị đánh dù trúng hay né đều đứng tại chỗ, rồi phản công tại chỗ.
 * - Mỗi bên giữ thế chiến đấu giữa các đòn.
 */
export class BattleScene extends Phaser.Scene {
  constructor() {
    super("BattleScene");
  }

  // ==========================================
  // LIFECYCLE
  // ==========================================

  init(data) {
    this.battleData = data;
  }

  create() {
    this.sprites = new SpriteManager(this);

    this.runBattle();
  }

  async runBattle() {
    const { attacker, defender, onComplete } = this.battleData;

    try {
      // Bên trái = bên chủ động tấn công, bên phải = bên phòng thủ.
      this.atkSet = this.sprites.get(getBattleSpriteId(attacker));
      this.defSet = this.sprites.get(getBattleSpriteId(defender));

      this.createBattleScreen();

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

    // Sprite trái (bên tấn công) nhìn sang phải, sprite phải nhìn sang trái.
    // Điểm chân (anchor của sheet) được đặt tại (x, GROUND_Y) bằng origin.
    const { atkSet, defSet } = this;

    this.attackerSprite = this.add.image(
      LEFT_X, GROUND_Y, atkSet.textureKey, atkSet.idleFrame
    )
      .setScale(atkSet.scale)
      .setFlipX(atkSet.flipFor("left"));

    this.defenderSprite = this.add.image(
      RIGHT_X, GROUND_Y, defSet.textureKey, defSet.idleFrame
    )
      .setScale(defSet.scale)
      .setFlipX(defSet.flipFor("right"));

    atkSet.applyFrame(this.attackerSprite, atkSet.idleFrame);
    defSet.applyFrame(this.defenderSprite, defSet.idleFrame);

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
  // ANIMATION
  // ==========================================

  // Phát một animation một lần: mỗi bước giữ đúng số ms của nó.
  async playSteps(sprite, set, animation) {
    for (const step of animation.steps) {
      set.applyFrame(sprite, step.index);

      await this.wait(step.ms);
    }
  }

  // Phát animation lặp lại cho tới khi gọi stop().
  startLoop(sprite, set, animation) {
    const handle = { stopped: false };

    handle.done = (async () => {
      while (!handle.stopped) {
        for (const step of animation.steps) {
          if (handle.stopped) break;

          set.applyFrame(sprite, step.index);

          await this.wait(step.ms);
        }
      }
    })();

    handle.stop = () => {
      handle.stopped = true;
    };

    return handle;
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
    const { atkSet, defSet } = this;

    this.battleUI.setVisible(true);

    this.attackerSprite
      .setPosition(LEFT_X, GROUND_Y)
      .setVisible(true)
      .setAlpha(1)
      .clearTint();

    this.defenderSprite
      .setPosition(RIGHT_X, GROUND_Y)
      .setVisible(true)
      .setAlpha(1)
      .clearTint();

    atkSet.applyFrame(this.attackerSprite, atkSet.idleFrame);
    defSet.applyFrame(this.defenderSprite, defSet.idleFrame);

    // Trạng thái từng bên: đã vào thế chiến đấu chưa, đã ra đòn mấy lần.
    this.fighters = new Map([
      [this.attackerSprite, { ready: false, strikes: 0, approaches: true }],
      [this.defenderSprite, { ready: false, strikes: 0, approaches: false }]
    ]);

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
      atkSet
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
        defSet
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
          atkSet
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
          defSet
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
    set
  ) {
    const startX = atkSp.x;
    const defenderStartX = defSp.x;

    const isLeft = startX < defenderStartX;

    const targetX =
      defenderStartX + (isLeft ? -set.reach : set.reach);

    const result = resolveStrike(
      { ...atk },
      { ...def },
      stats
    );

    try {
      await this.performAnimatedStrike(
        atk,
        def,
        result,
        atkSp,
        defSp,
        set,
        defenderStartX,
        targetX,
        isLeft
      );

    } catch (error) {
      console.error("Strike animation error:", error);

      this.log(
        "Lỗi animation đòn đánh. Đã tiếp tục xử lý trận đấu."
      );

    } finally {
      this.tweens.resumeAll();

      atkSp
        .setAlpha(1)
        .clearTint();

      // Đòn xong: đứng yên tại chỗ trong thế chiến đấu, không lui về.
      if (atk.hp > 0) {
        const state = this.fighters.get(atkSp);

        set.applyFrame(
          atkSp,
          state?.ready ? set.stanceFrame : set.idleFrame
        );
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
  // STANCE / APPROACH
  // ==========================================

  // Đưa một bên vào thế chiến đấu. Bên chủ động phi tới sát đối thủ
  // (chỉ lần đầu); bên phản công chỉ quay thế tại chỗ.
  async enterStance(sp, set, state, targetX) {
    if (state.ready) return;

    if (state.approaches) {
      const move = set.animation("move");
      const distance = Math.abs(targetX - sp.x);

      const gallop = move
        ? this.startLoop(sp, set, move)
        : null;

      await this.runTween({
        targets: sp,
        x: targetX,
        duration: Math.max(260, distance * 3.5),
        ease: "Quad.easeOut"
      }, 1500);

      if (gallop) {
        gallop.stop();
        await gallop.done;
      }

      state.approaches = false;
    }

    const ready = set.animation("ready");

    if (ready) {
      await this.playSteps(sp, set, ready);
    }

    state.ready = true;

    set.applyFrame(sp, set.stanceFrame);
  }

  // Bên bị đánh mà né được: lách nhẹ rồi về chỗ cũ.
  async dodgeEffect(sprite, startX, isLeft) {
    await this.runTween({
      targets: sprite,
      x: startX + (isLeft ? 14 : -14),
      duration: 90,
      yoyo: true,
      ease: "Quad.easeOut"
    }, 400);

    sprite.x = startX;
  }

  // ==========================================
  // ANIMATED STRIKE
  // ==========================================

  async performAnimatedStrike(
    atk,
    def,
    result,
    atkSp,
    defSp,
    set,
    defenderStartX,
    targetX,
    isLeft
  ) {
    const state = this.fighters.get(atkSp);

    // Chọn animation: chí mạng > đòn tiếp theo > đòn đầu.
    let role = "attack";

    if (result.hit && result.crit && set.hasAnimation("crit")) {
      role = "crit";
    } else if (state.strikes > 0 && set.hasAnimation("attack2")) {
      role = "attack2";
    }

    const attack = set.animation(role);

    if (!attack) {
      throw new Error(
        set.id + ' không có animation "' + role + '".'
      );
    }

    state.strikes += 1;

    await this.enterStance(atkSp, set, state, targetX);

    const attackAnimation = this.playSteps(atkSp, set, attack);

    // Chờ tới thời điểm va chạm (cộng dồn ms các bước trước impact).
    await this.wait(attack.impactMs + 20);

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

      await this.dodgeEffect(defSp, defenderStartX, isLeft);
    }

    // Chờ animation đánh chạy hết, rồi đứng yên tại chỗ.
    await attackAnimation;

    set.applyFrame(atkSp, set.stanceFrame);
  }

  // ==========================================
  // BATTLE LOG
  // ==========================================

  log(message) {
    gameLog(message);
  }
}
