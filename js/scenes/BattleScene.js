
import { TILE, GRID } from "../config.js";
import { unitsData } from "../data/units.js";
import { calculateBattlePreview, resolveStrike } from "../fe8Logic.js";
import { autoSlice, getIdleFrame } from "../systems/spriteSheet.js";

export class BattleScene extends Phaser.Scene {
  constructor() {
    super("BattleScene");
    this.selectedUnit = null;
    this.moveTiles = [];
    this.battleInProgress = false;
    this.animations = { player: null, enemy: null };
  }

  preload() {
    this.load.image("char1", "./assets/characters/Char1.jpg");
    this.load.image("char2", "./assets/characters/Char2.png");
  }

  create() {
    this.graphics = this.add.graphics();
    this.drawGrid();
    this.createUnits();
    this.createBattleScreen();
    this.prepareSprites();

    this.input.on("pointerdown", p => {
      if (this.battleInProgress) return;
      const gx = Math.floor(p.x / TILE);
      const gy = Math.floor(p.y / TILE);

      if (gx >= 0 && gx < GRID && gy >= 0 && gy < GRID) {
        this.handleTileClick(gx, gy);
      }
    });
  }

  async prepareSprites() {
    try {
      await Promise.all([
        this.loadTextureReady("char1"),
        this.loadTextureReady("char2")
      ]);

      this.animations.player = autoSlice(
        this.textures.get("char1").getSourceImage()
      );

      this.animations.enemy = autoSlice(
        this.textures.get("char2").getSourceImage()
      );

      this.setFrame(this.attackerSprite, getIdleFrame(this.animations.player));
      this.setFrame(this.defenderSprite, getIdleFrame(this.animations.enemy));
    } catch (error) {
      console.error("Không thể chuẩn bị battle sprites:", error);
      this.log("Lỗi tải hình ảnh chiến đấu.");
    }
  }

  loadTextureReady(key) {
    if (this.textures.exists(key)) return Promise.resolve();

    return new Promise((resolve, reject) => {
      const onComplete = file => {
        if (file.key === key) {
          cleanup();
          resolve();
        }
      };

      const onError = file => {
        if (file.key === key) {
          cleanup();
          reject(new Error("Lỗi tải: " + key));
        }
      };

      const cleanup = () => {
        this.load.off(Phaser.Loader.Events.FILE_COMPLETE, onComplete);
        this.load.off(Phaser.Loader.Events.LOAD_ERROR, onError);
      };

      this.load.on(Phaser.Loader.Events.FILE_COMPLETE, onComplete);
      this.load.on(Phaser.Loader.Events.LOAD_ERROR, onError);
      this.load.start();
    });
  }

  drawGrid() {
    this.graphics.clear();

    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        this.graphics.fillStyle(
          (x + y) % 2 === 0 ? 0x22223b : 0x2a2a4a
        );
        this.graphics.fillRect(x * TILE, y * TILE, TILE, TILE);
        this.graphics.lineStyle(1, 0x44445a);
        this.graphics.strokeRect(x * TILE, y * TILE, TILE, TILE);
      }
    }

    this.moveTiles.forEach(t => {
      this.graphics.fillStyle(0x2ecc71, 0.4);
      this.graphics.fillRect(t.x * TILE, t.y * TILE, TILE, TILE);
    });
  }

  createUnits() {
    unitsData.forEach(u => {
      const c = this.add.container(
        u.x * TILE + TILE / 2,
        u.y * TILE + TILE / 2
      );

      const circle = this.add.circle(
        0, 0, 18,
        u.team === "player" ? 0x3498db : 0xe74c3c
      );

      const label = this.add.text(
        -7, -9,
        u.team === "player" ? "P" : "E",
        { fontSize: "15px", color: "#fff" }
      );

      const hpBG = this.add.rectangle(0, 20, 32, 5, 0x000000);
      const hpBar = this.add.rectangle(
        -16, 20, 32, 5, 0x22c55e
      ).setOrigin(0, 0.5);

      c.add([circle, label, hpBG, hpBar]);
      u.sprite = c;
      u.hpBar = hpBar;
    });
  }

  handleTileClick(gx, gy) {
    const target = unitsData.find(
      u => u.x === gx && u.y === gy && u.hp > 0
    );

    if (target && target.team === "player") {
      this.selectedUnit = target;
      this.moveTiles = [];

      for (let y = 0; y < GRID; y++) {
        for (let x = 0; x < GRID; x++) {
          if (
            Math.abs(target.x - x) +
            Math.abs(target.y - y) <= target.mov
          ) {
            this.moveTiles.push({ x, y });
          }
        }
      }

      this.drawGrid();
      this.log("Đã chọn " + target.name);
      return;
    }

    if (!this.selectedUnit) return;

    if (target && target.team === "enemy") {
      if (
        Math.abs(this.selectedUnit.x - target.x) +
        Math.abs(this.selectedUnit.y - target.y) === 1
      ) {
        const atk = this.selectedUnit;
        this.selectedUnit = null;
        this.moveTiles = [];
        this.drawGrid();
        this.startBattle(atk, target);
        return;
      }
    }

    if (
      this.moveTiles.some(t => t.x === gx && t.y === gy) &&
      !target
    ) {
      const u = this.selectedUnit;
      u.x = gx;
      u.y = gy;

      this.tweens.add({
        targets: u.sprite,
        x: gx * TILE + TILE / 2,
        y: gy * TILE + TILE / 2,
        duration: 200
      });

      this.selectedUnit = null;
      this.moveTiles = [];
      this.drawGrid();
      this.log(u.name + " đã di chuyển.");
    }
  }

  createBattleScreen() {
    this.battleUI = this.add.container(0, 0)
      .setDepth(1000)
      .setVisible(false);

    this.battleUI.add([
      this.add.rectangle(192, 192, 384, 384, 0x101522),
      this.add.rectangle(192, 90, 384, 180, 0x263b55),
      this.add.rectangle(192, 285, 384, 198, 0x182337),
      this.add.rectangle(192, 318, 384, 5, 0x8c9a9e)
    ]);

    this.attackerSprite = this.add.image(110, 316, "char1")
      .setOrigin(0.5, 1)
      .setScale(1.7)
      .setFlipX(true);

    this.defenderSprite = this.add.image(275, 316, "char2")
      .setOrigin(0.5, 1)
      .setScale(1.7);

    this.attackerName = this.add.text(
      18, 43, "",
      { fontSize: "13px", color: "#38bdf8" }
    );

    this.defenderName = this.add.text(
      366, 43, "",
      { fontSize: "13px", color: "#f87171" }
    ).setOrigin(1, 0);

    this.attackerHPText = this.add.text(
      18, 62, "",
      { fontSize: "12px", color: "#fff" }
    );

    this.defenderHPText = this.add.text(
      366, 62, "",
      { fontSize: "12px", color: "#fff" }
    ).setOrigin(1, 0);

    this.attackerBar = this.add.rectangle(
      18, 84, 145, 7, 0x22c55e
    ).setOrigin(0, 0.5);

    this.defenderBar = this.add.rectangle(
      221, 84, 145, 7, 0x22c55e
    ).setOrigin(0, 0.5);

    this.battleMessage = this.add.text(
      192, 350, "BATTLE START!",
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
      this.add.rectangle(18, 84, 145, 9, 0x111111)
        .setOrigin(0, 0.5),
      this.add.rectangle(221, 84, 145, 9, 0x111111)
        .setOrigin(0, 0.5),
      this.attackerBar,
      this.defenderBar,
      this.battleMessage
    ]);
  }

  setFrame(sprite, frame) {
    if (!frame || !sprite) return;

    const key = sprite === this.attackerSprite ? "char1" : "char2";
    const tKey = [
      "clean", key,
      frame.x, frame.y,
      frame.w, frame.h
    ].join("_");

    if (this.textures.exists(tKey)) {
      sprite.setTexture(tKey);
      return;
    }

    const src = this.textures.get(key).getSourceImage();
    const cv = document.createElement("canvas");

    cv.width = frame.w;
    cv.height = frame.h;

    const ctx = cv.getContext("2d");

    ctx.drawImage(
      src,
      frame.x, frame.y,
      frame.w, frame.h,
      0, 0,
      frame.w, frame.h
    );

    const imgData = ctx.getImageData(
      0, 0, frame.w, frame.h
    );

    const d = imgData.data;

    for (let i = 0; i < d.length; i += 4) {
      if (
        d[i] > 230 &&
        d[i + 1] > 230 &&
        d[i + 2] > 230
      ) {
        d[i + 3] = 0;
      }
    }

    let bot = frame.h;
    let foot = false;
    let gap = 0;

    for (let y = 0; y < frame.h; y++) {
      let has = false;

      for (let x = 0; x < frame.w; x++) {
        if (d[(y * frame.w + x) * 4 + 3] > 0) {
          has = true;
          break;
        }
      }

      if (has) {
        foot = true;
        gap = 0;
        bot = y + 1;
      } else if (foot && ++gap >= 4) {
        for (let cy = y; cy < frame.h; cy++) {
          for (let cx = 0; cx < frame.w; cx++) {
            d[(cy * frame.w + cx) * 4 + 3] = 0;
          }
        }
        break;
      }
    }

    ctx.putImageData(imgData, 0, 0);

    const fcv = document.createElement("canvas");
    fcv.width = frame.w;
    fcv.height = Math.max(1, bot);

    fcv.getContext("2d").drawImage(cv, 0, 0);
    this.textures.addCanvas(tKey, fcv);
    sprite.setTexture(tKey);
  }

  async playFrames(sprite, list, delay = 65) {
    if (!list?.length) return;

    for (const frame of list) {
      this.setFrame(sprite, frame);
      await this.wait(delay);
    }
  }

  wait(ms) {
    return new Promise(resolve => {
      this.time.delayedCall(ms, resolve);
    });
  }

  // Tween có timeout và xử lý cả trường hợp bị stop.
  runTween(config, timeout = 1500) {
    return new Promise(resolve => {
      let finished = false;
      let tween;
      let timer;

      const finish = () => {
        if (finished) return;
        finished = true;

        if (timer) timer.remove();
        resolve();
      };

      tween = this.tweens.add({
        ...config,
        onComplete: finish,
        onStop: finish
      });

      timer = this.time.delayedCall(timeout, () => {
        if (!finished && tween) tween.stop();
        finish();
      });
    });
  }

  updateBattleHP(a, d) {
    this.attackerHPText.setText(`HP ${a.hp}/${a.maxHp}`);
    this.defenderHPText.setText(`HP ${d.hp}/${d.maxHp}`);

    this.attackerBar.width = Math.max(
      0, 145 * a.hp / a.maxHp
    );

    this.defenderBar.width = Math.max(
      0, 145 * d.hp / d.maxHp
    );
  }

  async startBattle(atk, def) {
    if (this.battleInProgress) return;

    this.battleInProgress = true;

    try {
      this.battleUI.setVisible(true);
      atk.sprite.setVisible(false);
      def.sprite.setVisible(false);

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

      this.setFrame(
        this.attackerSprite,
        getIdleFrame(this.animations.player)
      );

      this.setFrame(
        this.defenderSprite,
        getIdleFrame(this.animations.enemy)
      );

      this.attackerName.setText(atk.name);
      this.defenderName.setText(def.name);
      this.battleMessage.setText("GIAO CHIẾN!");

      this.updateBattleHP(atk, def);
      this.log(`=== ${atk.name} VS ${def.name} ===`);

      await this.wait(350);

      const pv = calculateBattlePreview(atk, def);

      await this.performStrike(
        atk, def, pv.attacker,
        this.attackerSprite,
        this.defenderSprite,
        this.animations.player
      );

      if (def.hp > 0 && atk.hp > 0) {
        await this.performStrike(
          def, atk, pv.defender,
          this.defenderSprite,
          this.attackerSprite,
          this.animations.enemy
        );
      }

      if (
        atk.hp > 0 &&
        def.hp > 0 &&
        pv.attacker.double
      ) {
        this.battleMessage.setText(
          `${atk.name} ĐÁNH BỒI!`
        );

        await this.performStrike(
          atk, def, pv.attacker,
          this.attackerSprite,
          this.defenderSprite,
          this.animations.player
        );
      }

      this.battleMessage.setText(
        def.hp <= 0
          ? def.name + " GỤC NGÃ!"
          : atk.hp <= 0
            ? atk.name + " GỤC NGÃ!"
            : "KẾT THÚC"
      );

      await this.wait(650);

    } catch (error) {
      console.error("Battle Runtime error:", error);
      this.log("Có lỗi trong trận đấu. Đã khôi phục trạng thái.");

    } finally {
      // Luôn khôi phục UI và trạng thái trận đấu.
      this.battleUI.setVisible(false);

      this.attackerSprite
        .setVisible(false)
        .setAlpha(1)
        .clearTint()
        .setPosition(110, 316);

      this.defenderSprite
        .setVisible(false)
        .setAlpha(1)
        .clearTint()
        .setPosition(275, 316);

      if (atk.hp > 0) {
        atk.sprite.setVisible(true);
        atk.hpBar.width = 32 * (atk.hp / atk.maxHp);
      } else {
        atk.sprite.setVisible(false);
      }

      if (def.hp > 0) {
        def.sprite.setVisible(true);
        def.hpBar.width = 32 * (def.hp / def.maxHp);
      } else {
        def.sprite.setVisible(false);
      }

      this.battleInProgress = false;
      this.drawGrid();
      this.log("=== KẾT THÚC GIAO TRANH ===");
    }
  }

  async performStrike(atk, def, stats, atkSp, defSp, anim) {
    const startX = atkSp.x;
    const defenderStartX = defSp.x;
    const isLeft = startX < defenderStartX;
    const targetX = defenderStartX + (isLeft ? -55 : 55);

    // Tính kết quả trên bản sao để không trừ HP trước va chạm.
    const result = resolveStrike(
      { ...atk },
      { ...def },
      stats
    );

    const rows = anim || [];
    const r0 = rows[0]?.frames || [];
    const r1 = rows[1]?.frames || [];
    const r2 = rows[2]?.frames || [];

    // Giữ nguyên quy ước sprite sheet 4 hàng:
    // 0: idle/windup, 1: attack, 2: critical, 3: dodge.
    const attackFrames = (
      result.crit && r2.length
        ? r2.slice(0, 10)
        : r1.slice(0, 6)
    );

    try {
      // Windup.
      await this.playFrames(atkSp, r0.slice(1, 5), 45);

      // Chạy chuyển động và animation cùng lúc.
      const movement = this.runTween({
        targets: atkSp,
        x: targetX,
        duration: 220,
        ease: "Power2"
      });

      const attackAnimation = this.playFrames(
        atkSp,
        attackFrames,
        65
      );

      // Thời điểm va chạm nằm trong lúc animation đang chạy.
      const impactFrame = Math.min(
        2,
        Math.max(0, attackFrames.length - 1)
      );

      await this.wait(impactFrame * 65 + 35);

      // Chỉ xử lý kết quả một lần tại thời điểm va chạm.
      if (result.hit) {
        def.hp = Math.max(0, def.hp - result.damage);

        this.battleMessage.setText(
          `${atk.name} ${
            result.crit ? "CHÍ MẠNG x3!" : "TRÚNG ĐÒN!"
          }`
        );

        this.cameras.main.shake(
          result.crit ? 220 : 120,
          result.crit ? 0.02 : 0.01
        );

        defSp.setTintFill(0xffffff);

        this.runTween({
          targets: defSp,
          x: defenderStartX + (isLeft ? 10 : -10),
          duration: 60,
          yoyo: true,
          onComplete: () => defSp.clearTint()
        }, 500);

        this.updateBattleHP(atk, def);

        this.log(
          `${atk.name} đánh trúng ${def.name}, mất ${result.damage} HP.`
        );

        if (def.hp <= 0) {
          this.runTween({
            targets: defSp,
            alpha: 0,
            duration: 250
          }, 700);

          this.log(def.name + " đã bị hạ gục!");
        }

      } else {
        this.battleMessage.setText(
          atk.name + " ĐÁNH TRƯỢT!"
        );

        this.log(atk.name + " đánh trượt!");

        // Hàng 3 là animation né nếu sprite sheet có dữ liệu.
        const dodgeFrames = rows[3]?.frames || [];

        if (dodgeFrames.length) {
          this.playFrames(defSp, dodgeFrames.slice(0, 4), 45);
        }

        this.runTween({
          targets: defSp,
          x: defenderStartX + (isLeft ? 28 : -28),
          duration: 140,
          yoyo: true
        }, 600);
      }

      // Chờ animation và chuyển động kết thúc song song.
      await Promise.all([
        attackAnimation,
        movement
      ]);

    } finally {
      // Trả người tấn công về vị trí ban đầu.
      await this.runTween({
        targets: atkSp,
        x: startX,
        duration: 190,
        ease: "Power2"
      }, 1000);

      atkSp.clearTint();

      if (atk.hp > 0) {
        this.setFrame(
          atkSp,
          r0[0] || getIdleFrame(anim)
        );
      }

      if (def.hp > 0) {
        defSp.setAlpha(1);
      }

      this.updateBattleHP(atk, def);
      await this.wait(100);
    }
  }

  log(message) {
    const box = document.getElementById("log-box");

    if (box) {
      box.innerHTML += "<br>> " + message;
      box.scrollTop = box.scrollHeight;
    }
  }
}
