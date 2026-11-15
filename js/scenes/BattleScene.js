
import { TILE, GRID } from "../config.js";
import { unitsData } from "../data/units.js";

import {
  calculateBattlePreview,
  resolveStrike
} from "../fe8Logic.js";

import {
  autoSlice,
  getIdleFrame
} from "../systems/spriteSheet.js";

export class BattleScene extends Phaser.Scene {
  constructor() {
    super("BattleScene");

    this.selectedUnit = null;
    this.moveTiles = [];
    this.battleInProgress = false;

    this.animations = {
      player: null,
      enemy: null
    };
  }

  preload() {
  this.load.image(
    "char1",
    "./assets/characters/Char1.jpg"
  );

  this.load.image(
    "char2",
    "./assets/characters/Char2.png"
  );
}

  create() {
    this.graphics = this.add.graphics();

    this.drawGrid();
    this.createUnits();
    this.createBattleScreen();

    this.prepareSprites();

    this.input.on("pointerdown", pointer => {
      if (this.battleInProgress) return;

      const gx = Math.floor(pointer.x / TILE);
      const gy = Math.floor(pointer.y / TILE);

      if (
        gx >= 0 && gx < GRID &&
        gy >= 0 && gy < GRID
      ) {
        this.handleTileClick(gx, gy);
      }
    });
  }

  async prepareSprites() {
    await Promise.all([
      this.loadTextureReady("char1"),
      this.loadTextureReady("char2")
    ]);

    const image1 = this.textures
      .get("char1")
      .getSourceImage();

    const image2 = this.textures
      .get("char2")
      .getSourceImage();

    this.animations.player = autoSlice(image1);
    this.animations.enemy = autoSlice(image2);

    this.setFrame(
      this.attackerSprite,
      getIdleFrame(this.animations.player)
    );

    this.setFrame(
      this.defenderSprite,
      getIdleFrame(this.animations.enemy)
    );

    console.log("Sprite sheets ready.");
  }

  loadTextureReady(key) {
    if (this.textures.exists(key)) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      this.load.once(
        Phaser.Loader.Events.FILE_COMPLETE,
        file => {
          if (file.key === key) resolve();
        }
      );

      this.load.once(
        Phaser.Loader.Events.LOAD_ERROR,
        file => {
          if (file.key === key) {
            reject(
              new Error("Không tải được ảnh: " + key)
            );
          }
        }
      );

      this.load.start();
    });
  }

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

    this.moveTiles.forEach(tile => {
      this.graphics.fillStyle(0x2ecc71, 0.4);

      this.graphics.fillRect(
        tile.x * TILE,
        tile.y * TILE,
        TILE,
        TILE
      );
    });
  }

  createUnits() {
    unitsData.forEach(unit => {
      const x = unit.x * TILE + TILE / 2;
      const y = unit.y * TILE + TILE / 2;

      const container = this.add.container(x, y);

      const color = unit.team === "player"
        ? 0x3498db
        : 0xe74c3c;

      const circle = this.add.circle(
        0, 0, 18, color
      );

      const label = this.add.text(
        -7,
        -9,
        unit.team === "player" ? "P" : "E",
        {
          fontSize: "15px",
          color: "#ffffff"
        }
      );

      const hpBG = this.add.rectangle(
        0, 20, 32, 5, 0x000000
      );

      const hpBar = this.add.rectangle(
        -16, 20, 32, 5, 0x22c55e
      ).setOrigin(0, 0.5);

      container.add([
        circle,
        label,
        hpBG,
        hpBar
      ]);

      unit.sprite = container;
      unit.hpBar = hpBar;
    });
  }

  handleTileClick(gx, gy) {
    const target = unitsData.find(
      unit =>
        unit.x === gx &&
        unit.y === gy &&
        unit.hp > 0
    );

    if (target && target.team === "player") {
      this.selectedUnit = target;
      this.calculateMoveRange(target);
      this.drawGrid();

      this.log(
        "Đã chọn " + target.name
      );

      return;
    }

    if (!this.selectedUnit) return;

    if (target && target.team === "enemy") {
      const distance =
        Math.abs(this.selectedUnit.x - target.x) +
        Math.abs(this.selectedUnit.y - target.y);

      if (distance === 1) {
        const attacker = this.selectedUnit;

        this.selectedUnit = null;
        this.moveTiles = [];
        this.drawGrid();

        this.startBattle(attacker, target);
        return;
      }
    }

    if (
      this.moveTiles.some(
        tile => tile.x === gx && tile.y === gy
      ) &&
      !target
    ) {
      const unit = this.selectedUnit;

      unit.x = gx;
      unit.y = gy;

      this.tweens.add({
        targets: unit.sprite,
        x: gx * TILE + TILE / 2,
        y: gy * TILE + TILE / 2,
        duration: 200
      });

      this.selectedUnit = null;
      this.moveTiles = [];

      this.drawGrid();

      this.log(
        unit.name + " đã di chuyển."
      );
    }
  }

  calculateMoveRange(unit) {
    this.moveTiles = [];

    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        const distance =
          Math.abs(unit.x - x) +
          Math.abs(unit.y - y);

        if (distance <= unit.mov) {
          this.moveTiles.push({ x, y });
        }
      }
    }
  }

  createBattleScreen() {
    this.battleUI = this.add.container(0, 0);
    this.battleUI.setDepth(1000);

    const bg = this.add.rectangle(
      192, 192, 384, 384, 0x101522
    );

    const upper = this.add.rectangle(
      192, 90, 384, 180, 0x263b55
    );

    const lower = this.add.rectangle(
      192, 285, 384, 198, 0x182337
    );

    const ground = this.add.rectangle(
      192, 320, 384, 5, 0x8c9a9e
    );

    this.battleUI.add([
      bg,
      upper,
      lower,
      ground
    ]);

    this.attackerSprite = this.add.image(
      110, 285, "char1"
    ).setOrigin(0.5, 1);

    this.defenderSprite = this.add.image(
      280, 285, "char2"
    ).setOrigin(0.5, 1);

    this.defenderSprite.setFlipX(true);

    this.battleUI.add([
      this.attackerSprite,
      this.defenderSprite
    ]);

    this.attackerName = this.add.text(
      18, 43, "",
      { fontSize: "13px", color: "#38bdf8" }
    );

    this.defenderName = this.add.text(
      366, 43, "",
      {
        fontSize: "13px",
        color: "#f87171"
      }
    ).setOrigin(1, 0);

    this.attackerHPText = this.add.text(
      18, 62, "",
      { fontSize: "12px", color: "#ffffff" }
    );

    this.defenderHPText = this.add.text(
      366, 62, "",
      {
        fontSize: "12px",
        color: "#ffffff"
      }
    ).setOrigin(1, 0);

    this.attackerBarBG = this.add.rectangle(
      18, 84, 145, 9, 0x111111
    ).setOrigin(0, 0.5);

    this.defenderBarBG = this.add.rectangle(
      221, 84, 145, 9, 0x111111
    ).setOrigin(0, 0.5);

    this.attackerBar = this.add.rectangle(
      18, 84, 145, 7, 0x22c55e
    ).setOrigin(0, 0.5);

    this.defenderBar = this.add.rectangle(
      221, 84, 145, 7, 0x22c55e
    ).setOrigin(0, 0.5);

    this.battleMessage = this.add.text(
      192, 350,
      "BATTLE START!",
      {
        fontSize: "13px",
        color: "#facc15",
        align: "center",
        wordWrap: { width: 350 }
      }
    ).setOrigin(0.5);

    this.battleUI.add([
      this.attackerName,
      this.defenderName,
      this.attackerHPText,
      this.defenderHPText,
      this.attackerBarBG,
      this.defenderBarBG,
      this.attackerBar,
      this.defenderBar,
      this.battleMessage
    ]);

    this.battleUI.setVisible(false);
  }

  setFrame(sprite, frame) {
    if (!frame) return;

    const sourceKey =
      sprite === this.attackerSprite
        ? "char1"
        : "char2";

    const source = this.textures
      .get(sourceKey)
      .getSourceImage();

    const textureKey = [
      "frame",
      sourceKey,
      frame.x,
      frame.y,
      frame.w,
      frame.h
    ].join("_");

    if (!this.textures.exists(textureKey)) {
      const canvas = document.createElement("canvas");

      canvas.width = frame.w;
      canvas.height = frame.h;

      const ctx = canvas.getContext("2d");

      ctx.drawImage(
        source,
        frame.x,
        frame.y,
        frame.w,
        frame.h,
        0,
        0,
        frame.w,
        frame.h
      );

      this.textures.addCanvas(
        textureKey,
        canvas
      );
    }

    sprite.setTexture(textureKey);
    sprite.setOrigin(0.5, 1);

    const scale = Math.min(
      125 / frame.w,
      155 / frame.h
    );

    sprite.setScale(scale);
  }

  async playFrames(sprite, frames, delay = 100) {
    if (!frames?.length) return;

    for (const frame of frames) {
      this.setFrame(sprite, frame);
      await this.wait(delay);
    }
  }

  wait(ms) {
    return new Promise(resolve => {
      this.time.delayedCall(ms, resolve);
    });
  }

  updateBattleHP(attacker, defender) {
    this.attackerHPText.setText(
      `HP ${attacker.hp}/${attacker.maxHp}`
    );

    this.defenderHPText.setText(
      `HP ${defender.hp}/${defender.maxHp}`
    );

    this.attackerBar.width =
      145 * attacker.hp / attacker.maxHp;

    this.defenderBar.width =
      145 * defender.hp / defender.maxHp;
  }

  async startBattle(attacker, defender) {
    if (this.battleInProgress) return;

    this.battleInProgress = true;
    this.battleUI.setVisible(true);

    attacker.sprite.setVisible(false);
    defender.sprite.setVisible(false);

    this.attackerSprite.setPosition(110, 285);
    this.defenderSprite.setPosition(280, 285);

    this.attackerName.setText(attacker.name);
    this.defenderName.setText(defender.name);

    this.updateBattleHP(attacker, defender);

    this.log(
      `=== ${attacker.name} VS ${defender.name} ===`
    );

    await this.wait(500);

    const preview = calculateBattlePreview(
      attacker,
      defender
    );

    await this.performStrike(
      attacker,
      defender,
      preview.attacker,
      this.attackerSprite,
      this.defenderSprite,
      this.animations[attacker.team]
    );

    if (defender.hp > 0 && attacker.hp > 0) {
      await this.performStrike(
        defender,
        attacker,
        preview.defender,
        this.defenderSprite,
        this.attackerSprite,
        this.animations[defender.team]
      );
    }

    if (
      attacker.hp > 0 &&
      defender.hp > 0 &&
      preview.attacker.double
    ) {
      await this.performStrike(
        attacker,
        defender,
        preview.attacker,
        this.attackerSprite,
        this.defenderSprite,
        this.animations[attacker.team]
      );
    }

    this.battleMessage.setText(
      defender.hp <= 0
        ? defender.name + " đã gục ngã!"
        : attacker.hp <= 0
          ? attacker.name + " đã gục ngã!"
          : "KẾT THÚC GIAO TRANH"
    );

    await this.wait(900);

    this.battleUI.setVisible(false);

    if (attacker.hp > 0) {
      attacker.sprite.setVisible(true);
    }

    if (defender.hp > 0) {
      defender.sprite.setVisible(true);
    }

    this.battleInProgress = false;
    this.drawGrid();

    this.log("=== KẾT THÚC GIAO TRANH ===");
  }

  async performStrike(
    attacker,
    defender,
    stats,
    attackSprite,
    defendSprite,
    animationRows
  ) {
    const frames = animationRows?.[0]?.frames || [];

    await this.playFrames(
      attackSprite,
      frames,
      80
    );

    const result = resolveStrike(
      attacker,
      defender,
      stats
    );

    if (result.hit) {
      this.battleMessage.setText(
        `${attacker.name} ${result.crit ? "CHÍ MẠNG!" : "TRÚNG ĐÒN!"}`
      );

      await new Promise(resolve => {
        this.tweens.add({
          targets: attackSprite,
          x: defendSprite.x + (
            attackSprite.x < defendSprite.x ? -75 : 75
          ),
          duration: 170,
          yoyo: true,
          onComplete: resolve
        });
      });

      this.updateBattleHP(attacker, defender);

      this.log(
        `${attacker.name} đánh trúng ${defender.name}, mất ${result.damage} HP.`
      );

      if (result.defeated) {
        defendSprite.setVisible(false);

        this.log(
          defender.name + " đã bị hạ gục!"
        );
      }
    } else {
      this.battleMessage.setText(
        attacker.name + " đánh trượt!"
      );

      this.log(
        attacker.name + " đánh trượt!"
      );
    }

    await this.wait(400);
  }

  log(message) {
    const box = document.getElementById("log-box");

    if (!box) return;

    box.innerHTML += "<br>> " + message;
    box.scrollTop = box.scrollHeight;
  }
}
