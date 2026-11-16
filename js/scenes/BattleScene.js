import { SpriteManager } from "../systems/sprites/SpriteManager.js";
import { TILE, GRID } from "../config.js";
import { unitsData } from "../data/units.js";
import {
  calculateBattlePreview,
  resolveStrike
} from "../fe8Logic.js";
import { getIdleFrame } from "../systems/spriteSheet.js";
const CHAR5_PATH = "./assets/characters/Char4/";
const CHAR5_FRAME_PATH = CHAR5_PATH + "frames/";

const CHAR5_FRAME_FILES = [
  "frame_001.png",
  "frame_002.png",
  "frame_003.png",
  "frame_004.png",
  "frame_005.png",
  "frame_006.png",
  "frame_007.png"
];

export class BattleScene extends Phaser.Scene {
  constructor() {
    super("BattleScene");
    
    this.selectedUnit = null;
    this.moveTiles = [];
    this.battleInProgress = false;

    this.turnNumber = 1;
    this.turnPhase = "player";
    this.turnTransitioning = false;
    

        this.spriteManager = new SpriteManager(this, {
      frameFiles: CHAR5_FRAME_FILES,
      getTextureKey: file =>
        this.getChar5TextureKey(file)
    });

    this.animations = this.spriteManager.animations;
  }

  // ==========================================
  // PRELOAD
  // ==========================================

  preload() {
    this.load.image(
      "char1",
      "./assets/characters/Char1.jpg"
    );

    this.load.image(
      "char2",
      "./assets/characters/Char2.png"
    );

    this.load.json(
      "char5Manifest",
      CHAR5_PATH + "manifest.json"
    );

    CHAR5_FRAME_FILES.forEach(file => {
      const key = this.getChar5TextureKey(file);

      this.load.image(
        key,
        CHAR5_FRAME_PATH + file
      );
    });
  }

  getChar5TextureKey(file) {
    return "char5_" + file.replace(".png", "");
  }

  // ==========================================
  // CREATE
  // ==========================================

  create() {
    this.resetUnitTurnStates();

    this.graphics = this.add.graphics();

    this.drawGrid();
    this.createUnits();
    this.createBattleScreen();
    this.createTurnUI();

    this.prepareSprites();

    this.input.on("pointerdown", p => {
      if (
        this.battleInProgress ||
        this.turnTransitioning
      ) {
        return;
      }

      if (
        this.endTurnButton &&
        this.endTurnButton.getBounds().contains(p.x, p.y)
      ) {
        return;
      }

      if (this.turnPhase !== "player") {
        return;
      }

      const gx = Math.floor(p.x / TILE);
      const gy = Math.floor(p.y / TILE);

      if (
        gx >= 0 &&
        gx < GRID &&
        gy >= 0 &&
        gy < GRID
      ) {
        this.handleTileClick(gx, gy);
      }
    });

    this.updateTurnUI();
    this.log("Lượt 1 - Phe người chơi.");
  }

  // ==========================================
  // TURN SYSTEM
  // ==========================================

  resetUnitTurnStates() {
    unitsData.forEach(unit => {
      unit.hasMoved = false;
      unit.hasActed = false;
    });
  }

  canUnitMove(unit) {
    return (
      this.turnPhase === "player" &&
      unit.team === "player" &&
      unit.hp > 0 &&
      !unit.hasMoved &&
      !unit.hasActed
    );
  }

  canUnitAct(unit) {
    return (
      this.turnPhase === "player" &&
      unit.team === "player" &&
      unit.hp > 0 &&
      !unit.hasActed
    );
  }

  createTurnUI() {
    this.turnUI = this.add.container(0, 0)
      .setDepth(2000);

    this.turnLabel = this.add.text(
      8,
      8,
      "",
      {
        fontSize: "12px",
        color: "#ffffff",
        backgroundColor: "#111827",
        padding: {
          x: 7,
          y: 5
        }
      }
    );

    this.endTurnButton = this.add.text(
      376,
      8,
      "KẾT THÚC LƯỢT",
      {
        fontSize: "11px",
        color: "#ffffff",
        backgroundColor: "#166534",
        padding: {
          x: 8,
          y: 6
        }
      }
    )
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true });

    this.endTurnButton.on("pointerdown", () => {
      this.endPlayerTurn();
    });

    this.endTurnButton.on("pointerover", () => {
      if (this.turnPhase === "player") {
        this.endTurnButton.setBackgroundColor("#15803d");
      }
    });

    this.endTurnButton.on("pointerout", () => {
      this.endTurnButton.setBackgroundColor(
        this.turnPhase === "player"
          ? "#166534"
          : "#4b5563"
      );
    });

    this.turnUI.add([
      this.turnLabel,
      this.endTurnButton
    ]);
  }

  updateTurnUI() {
    if (!this.turnLabel || !this.endTurnButton) {
      return;
    }

    const phaseText =
      this.turnPhase === "player"
        ? "LƯỢT NGƯỜI CHƠI"
        : "LƯỢT ĐỊCH";

    this.turnLabel.setText(
      `LƯỢT ${this.turnNumber} - ${phaseText}`
    );

    const canEndTurn =
      this.turnPhase === "player" &&
      !this.battleInProgress &&
      !this.turnTransitioning;

    this.endTurnButton
      .setAlpha(canEndTurn ? 1 : 0.55)
      .setBackgroundColor(
        canEndTurn
          ? "#166534"
          : "#4b5563"
      );
  }

  async endPlayerTurn() {
    if (
      this.turnPhase !== "player" ||
      this.battleInProgress ||
      this.turnTransitioning
    ) {
      return;
    }

    this.turnTransitioning = true;

    this.selectedUnit = null;
    this.moveTiles = [];

    this.drawGrid();
    this.updateTurnUI();

    try {
      this.turnPhase = "enemy";
      this.updateTurnUI();

      this.log("=== LƯỢT ĐỊCH BẮT ĐẦU ===");

      // AI sẽ được tích hợp ở bước tiếp theo.
      await this.wait(700);

      this.log("Phe địch đã hoàn thành lượt.");

      this.turnNumber += 1;
      this.turnPhase = "player";

      this.resetUnitTurnStates();

      this.log(
        `=== LƯỢT ${this.turnNumber} - NGƯỜI CHƠI ===`
      );

    } catch (error) {
      console.error("Turn transition error:", error);

      this.turnPhase = "player";

      this.log(
        "Lỗi chuyển lượt. Đã khôi phục lượt người chơi."
      );

    } finally {
      this.turnTransitioning = false;

      this.selectedUnit = null;
      this.moveTiles = [];

      this.drawGrid();
      this.updateTurnUI();
    }
  }

  // ==========================================
  // SPRITE PREPARATION
  // ==========================================

    async prepareSprites() {
    try {
      const result = await this.spriteManager.prepare(
        this.attackerSprite,
        this.defenderSprite
      );

      console.log("[SpriteManager] Đã chuẩn bị sprite:", result);

      this.log("Đã tải Char4 và sprite Char2.");

    } catch (error) {
      this.spriteManager.ready = false;

      console.error(
        "Không thể chuẩn bị battle sprites:",
        error
      );

      this.log(
        "Lỗi tải sprite: " + error.message
      );
    }
    }

  // ==========================================
  // MAP
  // ==========================================

  drawGrid() {
    this.graphics.clear();

    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        this.graphics.fillStyle(
          (x + y) % 2 === 0
            ? 0x22223b
            : 0x2a2a4a
        );

        this.graphics.fillRect(
          x * TILE,
          y * TILE,
          TILE,
          TILE
        );

        this.graphics.lineStyle(1, 0x44445a);

        this.graphics.strokeRect(
          x * TILE,
          y * TILE,
          TILE,
          TILE
        );
      }
    }

    this.moveTiles.forEach(t => {
      this.graphics.fillStyle(0x2ecc71, 0.4);

      this.graphics.fillRect(
        t.x * TILE,
        t.y * TILE,
        TILE,
        TILE
      );
    });
  }

  createUnits() {
    unitsData.forEach(u => {
      const c = this.add.container(
        u.x * TILE + TILE / 2,
        u.y * TILE + TILE / 2
      );

      const circle = this.add.circle(
        0,
        0,
        18,
        u.team === "player"
          ? 0x3498db
          : 0xe74c3c
      );

      const label = this.add.text(
        -7,
        -9,
        u.team === "player" ? "P" : "E",
        {
          fontSize: "15px",
          color: "#fff"
        }
      );

      const hpBG = this.add.rectangle(
        0,
        20,
        32,
        5,
        0x000000
      );

      const hpBar = this.add.rectangle(
        -16,
        20,
        32,
        5,
        0x22c55e
      ).setOrigin(0, 0.5);

      c.add([
        circle,
        label,
        hpBG,
        hpBar
      ]);

      u.sprite = c;
      u.hpBar = hpBar;
    });
  }

  // ==========================================
  // MOVEMENT RANGE
  // ==========================================

  getAvailableMoveTiles(unit) {
    const tiles = [];

    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        const distance =
          Math.abs(unit.x - x) +
          Math.abs(unit.y - y);

        if (distance === 0 || distance > unit.mov) {
          continue;
        }

        const occupied = unitsData.some(other =>
          other !== unit &&
          other.hp > 0 &&
          other.x === x &&
          other.y === y
        );

        if (!occupied) {
          tiles.push({ x, y });
        }
      }
    }

    return tiles;
  }

  // ==========================================
  // TILE INPUT
  // ==========================================

  handleTileClick(gx, gy) {
    if (
      this.turnPhase !== "player" ||
      this.battleInProgress ||
      this.turnTransitioning
    ) {
      return;
    }

    const target = unitsData.find(
      u =>
        u.x === gx &&
        u.y === gy &&
        u.hp > 0
    );

    if (target && target.team === "player") {
      if (!this.canUnitAct(target)) {
        this.log(
          target.name + " đã hoàn thành hành động lượt này."
        );

        return;
      }

      this.selectedUnit = target;

      this.moveTiles = this.canUnitMove(target)
        ? this.getAvailableMoveTiles(target)
        : [];

      this.drawGrid();

      if (target.hasMoved) {
        this.log(
          target.name + " đã di chuyển. Có thể tiếp tục tấn công."
        );
      } else {
        this.log("Đã chọn " + target.name);
      }

      return;
    }

    if (!this.selectedUnit) {
      return;
    }

    const attacker = this.selectedUnit;

    if (!this.canUnitAct(attacker)) {
      this.selectedUnit = null;
      this.moveTiles = [];
      this.drawGrid();
      return;
    }

    if (target && target.team === "enemy") {
      const distance =
        Math.abs(attacker.x - target.x) +
        Math.abs(attacker.y - target.y);

      if (distance === 1) {
        attacker.hasActed = true;

        this.selectedUnit = null;
        this.moveTiles = [];

        this.drawGrid();
        this.updateTurnUI();

        this.startBattle(attacker, target);

        return;
      }

      this.log("Kẻ địch nằm ngoài tầm tấn công.");
      return;
    }

    if (
      this.canUnitMove(attacker) &&
      this.moveTiles.some(
        tile => tile.x === gx && tile.y === gy
      ) &&
      !target
    ) {
      attacker.hasMoved = true;

      attacker.x = gx;
      attacker.y = gy;

      this.moveTiles = [];

      this.tweens.add({
        targets: attacker.sprite,
        x: gx * TILE + TILE / 2,
        y: gy * TILE + TILE / 2,
        duration: 200,
        ease: "Power2",
        onComplete: () => {
          this.log(
            attacker.name +
            " đã di chuyển. Có thể tiếp tục tấn công."
          );
        }
      });

      this.selectedUnit = attacker;

      this.drawGrid();

      return;
    }

    if (
      attacker.hasMoved &&
      !attacker.hasActed
    ) {
      this.log(
        attacker.name +
        " đã di chuyển. Hãy chọn kẻ địch liền kề để tấn công."
      );
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

  async startBattle(atk, def) {
    if (this.battleInProgress) return;

    this.battleInProgress = true;
    this.updateTurnUI();

    try {
    if (!this.spriteManager.ready) {
        throw new Error(
          "Char5 chưa sẵn sàng. Kiểm tra manifest và thư mục frames."
        );
      }

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

    } catch (error) {
      console.error(
        "Battle Runtime error:",
        error
      );

      this.log(
        "Lỗi trận đấu: " + error.message
      );

    } finally {
      this.tweens.resumeAll();

      if (this.battleUI) {
        this.battleUI.setVisible(false);
      }

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

        atk.hpBar.width =
          32 * (atk.hp / atk.maxHp);
      } else {
        atk.sprite.setVisible(false);
      }

      if (def.hp > 0) {
        def.sprite.setVisible(true);

        def.hpBar.width =
          32 * (def.hp / def.maxHp);
      } else {
        def.sprite.setVisible(false);
      }

      this.battleInProgress = false;

      this.drawGrid();
      this.updateTurnUI();

      this.log("=== KẾT THÚC GIAO TRANH ===");
    }
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

      // Địch né đòn bằng chuyển động ngắn.
      await this.runTween({
        targets: defSp,
        x: defenderStartX + (
          isLeft ? 22 : -22
        ),
        duration: 110,
        yoyo: true,
        ease: "Quad.easeOut"
      }, 400);
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

      if (r3.length) {
        await this.playFrames(
          defSp,
          r3.slice(0, 4),
          40
        );
      }

      await this.runTween({
        targets: defSp,
        x: defenderStartX + (
          isLeft ? 22 : -22
        ),
        duration: 110,
        yoyo: true,
        ease: "Quad.easeOut"
      }, 400);
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
    const box = document.getElementById("log-box");

    if (box) {
      box.innerHTML += "<br>> " + message;
      box.scrollTop = box.scrollHeight;
    }
  }
}
