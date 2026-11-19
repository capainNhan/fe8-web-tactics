
import { TILE } from "../config.js";
import { createUnits } from "../data/units.js";
import { ACTIVE_MAP } from "../data/maps/index.js";
import { TerrainMap } from "../systems/map/TerrainMap.js";
import { GameState } from "../core/GameState.js";
import { applyCommand } from "../core/Commands.js";
import { getForecast } from "../core/Forecast.js";
import { planNextAction } from "../core/EnemyAI.js";
import { MapRenderer } from "../systems/map/MapRenderer.js";
import {
  inBounds,
  unitAt,
  getMoveTiles,
  getAttackTargets
} from "../systems/map/MapGrid.js";
import { UnitActionMenu } from "../systems/ui/UnitActionMenu.js";
import { TurnUI } from "../systems/ui/TurnUI.js";
import { TileInfoPanel } from "../systems/ui/TileInfoPanel.js";
import { TurnBanner } from "../systems/ui/TurnBanner.js";
import { GameOverPanel } from "../systems/ui/GameOverPanel.js";
import { BattleForecastPanel } from "../systems/ui/BattleForecastPanel.js";
import { log } from "../systems/GameLog.js";

/**
 * MAP SCENE
 * Bàn cờ chiến thuật: chọn đơn vị, menu hành động, di chuyển, chọn mục tiêu,
 * xem dự đoán trận đánh, chuyển lượt, lượt địch (AI), kết thúc ván.
 * Luật chơi nằm trong js/core; scene này chỉ gửi lệnh và phát hiệu ứng.
 * Khi hai bên giao chiến, MapScene mở BattleScene và chờ kết quả.
 */
export class MapScene extends Phaser.Scene {
  constructor() {
    super("MapScene");
  }

  // ==========================================
  // CREATE
  // ==========================================

  create() {
    this.terrainMap = new TerrainMap(ACTIVE_MAP);

    // Trạng thái trận nằm trong GameState; mọi thay đổi đi qua lệnh (core/Commands.js).
    this.state = new GameState({
      units: createUnits(ACTIVE_MAP.spawns),
      terrainMap: this.terrainMap
    });

    this.units = this.state.units;
    this.turn = this.state.turn;

    this.selectedUnit = null;
    this.moveTiles = [];
    this.attackTiles = [];
    this.actionMode = null; // null | "move" | "attack"

    this.battleInProgress = false;
    this.turnTransitioning = false;

    this.mapView = new MapRenderer(this, this.terrainMap);
    this.mapView.drawGrid();
    this.mapView.createUnitTokens(this.units);

    this.turnUI = new TurnUI(
      this,
      () => this.endPlayerTurn()
    );

    this.tileInfo = new TileInfoPanel(this, this.terrainMap);
    this.banner = new TurnBanner(this);
    this.forecastPanel = new BattleForecastPanel(this);
    this.gameOverPanel = new GameOverPanel(
      this,
      () => this.scene.restart()
    );

    this.actionMenu = new UnitActionMenu(
      this,
      action => this.handleUnitAction(action)
    );

    this.input.on(
      "pointerdown",
      pointer => this.onPointerDown(pointer)
    );

    this.refreshTurnUI();
    log(`Bản đồ: ${ACTIVE_MAP.name}.`);
    log("Lượt 1 - Phe người chơi.");
  }

  // ==========================================
  // HELPERS
  // ==========================================

  // Gửi một lệnh tới luật chơi.
  dispatch(command, team = "player") {
    return applyCommand(this.state, { ...command, actor: { team } });
  }

  redraw() {
    this.mapView.drawGrid(this.moveTiles, this.attackTiles);
  }

  clearSelection() {
    this.actionMenu.hide();
    this.forecastPanel.hide();

    this.selectedUnit = null;
    this.moveTiles = [];
    this.attackTiles = [];
    this.actionMode = null;

    this.redraw();
  }

  refreshTurnUI() {
    this.turnUI.update({
      turn: this.turn.turn,
      phase: this.turn.phase,
      canEndTurn:
        this.turn.isPlayerPhase() &&
        !this.battleInProgress &&
        !this.turnTransitioning &&
        !this.state.outcome
    });
  }

  wait(ms) {
    return new Promise(resolve => {
      this.time.delayedCall(ms, resolve);
    });
  }

  // Hiện màn kết quả nếu ván đã kết thúc. Trả về true nếu đã kết thúc.
  checkGameOver() {
    const outcome = this.state.outcome;

    if (!outcome) return false;

    this.clearSelection();
    this.refreshTurnUI();

    log(
      outcome.winner === "player"
        ? "=== CHIẾN THẮNG ==="
        : "=== THẤT BẠI ==="
    );

    this.gameOverPanel.show(outcome);

    return true;
  }

  // ==========================================
  // INPUT
  // ==========================================

  onPointerDown(pointer) {
    if (
      this.battleInProgress ||
      this.turnTransitioning ||
      this.state.outcome
    ) {
      return;
    }

    if (this.turnUI.contains(pointer.x, pointer.y)) {
      return;
    }

    if (this.actionMenu.contains(pointer.x, pointer.y)) {
      return;
    }

    if (this.forecastPanel.contains(pointer.x, pointer.y)) {
      return;
    }

    if (!this.turn.isPlayerPhase()) {
      return;
    }

    const gx = Math.floor(pointer.x / TILE);
    const gy = Math.floor(pointer.y / TILE);

    if (inBounds(gx, gy)) {
      this.handleTileClick(gx, gy);
    }
  }

  handleTileClick(gx, gy) {
    this.tileInfo.show(gx, gy, this.selectedUnit?.moveType);

    const target = unitAt(this.units, gx, gy);

    // Chọn đơn vị người chơi.
    if (target && target.team === "player") {
      this.forecastPanel.hide();
      this.selectUnit(target);
      return;
    }

    const unit = this.selectedUnit;

    if (!unit || !this.actionMode) return;

    if (!this.turn.canAct(unit)) {
      this.clearSelection();
      return;
    }

    if (this.actionMode === "attack") {
      this.previewAttack(unit, target);
    } else if (this.actionMode === "move") {
      this.tryMove(unit, gx, gy, target);
    }
  }

  selectUnit(unit) {
    if (!this.turn.canAct(unit)) {
      log(unit.name + " đã hoàn thành hành động lượt này.");
      return;
    }

    this.selectedUnit = unit;
    this.actionMode = null;
    this.moveTiles = [];
    this.attackTiles = [];

    this.redraw();
    this.showUnitActionMenu(unit);

    if (unit.hasMoved) {
      log(
        unit.name +
        " đã di chuyển. Có thể tiếp tục tấn công hoặc đợi."
      );
    } else {
      log("Đã chọn " + unit.name);
    }
  }

  // ==========================================
  // UNIT ACTION MENU
  // ==========================================

  showUnitActionMenu(unit) {
    if (!unit) return;

    this.actionMenu.show(unit, [
      {
        id: "move",
        label: "Di chuyển",
        enabled: this.turn.canMove(unit)
      },
      {
        id: "attack",
        label: "Tấn công",
        enabled:
          this.turn.canAct(unit) &&
          getAttackTargets(unit, this.units).length > 0
      },
      {
        id: "wait",
        label: "Đợi",
        enabled: this.turn.canAct(unit)
      }
    ]);
  }

  handleUnitAction(action) {
    const unit = this.selectedUnit;

    if (
      !unit ||
      !this.turn.canAct(unit) ||
      this.battleInProgress ||
      this.turnTransitioning
    ) {
      return;
    }

    switch (action) {
      case "move":
        if (!this.turn.canMove(unit)) {
          log("Đơn vị này không thể di chuyển.");
          return;
        }

        this.actionMenu.hide();
        this.actionMode = "move";
        this.moveTiles = getMoveTiles(unit, this.units, this.terrainMap);
        this.attackTiles = [];
        this.redraw();

        log("Chọn ô muốn di chuyển.");
        break;

      case "attack": {
        const targets = getAttackTargets(unit, this.units);

        if (!targets.length) {
          log("Không có kẻ địch trong tầm đánh.");
          return;
        }

        this.actionMenu.hide();
        this.actionMode = "attack";
        this.moveTiles = [];
        this.attackTiles = targets.map(t => ({ x: t.x, y: t.y }));
        this.redraw();

        log("Chọn kẻ địch (ô đỏ) để xem dự đoán và tấn công.");
        break;
      }

      case "wait": {
        const result = this.dispatch({ type: "wait", unitId: unit.id });

        if (!result.ok) {
          log(result.error);
          return;
        }

        this.mapView.syncUnit(unit);
        this.clearSelection();
        this.refreshTurnUI();

        log(unit.name + " đã đợi.");
        break;
      }
    }
  }

  // ==========================================
  // MOVE / ATTACK
  // ==========================================

  tryMove(unit, gx, gy, target) {
    if (target) {
      log("Ô này đang có đơn vị chiếm giữ.");
      return;
    }

    const isValidMove = this.moveTiles.some(
      tile => tile.x === gx && tile.y === gy
    );

    if (!isValidMove) {
      log("Không thể di chuyển đến ô này.");
      return;
    }

    const result = this.dispatch({
      type: "move",
      unitId: unit.id,
      x: gx,
      y: gy
    });

    if (!result.ok) {
      log(result.error);
      return;
    }

    this.moveTiles = [];
    this.actionMode = null;
    this.redraw();

    this.mapView.moveToken(unit, result.events[0].path, () => {
      if (this.selectedUnit === unit && !unit.hasActed) {
        log(
          unit.name +
          " đã di chuyển. Chọn hành động tiếp theo."
        );

        this.showUnitActionMenu(unit);
      }
    });
  }

  // Bấm vào kẻ địch ở chế độ tấn công: hiện bảng dự đoán, chờ xác nhận.
  previewAttack(unit, target) {
    if (!target || target.team !== "enemy") {
      log("Hãy chọn một kẻ địch (ô đỏ).");
      return;
    }

    if (!getAttackTargets(unit, this.units).includes(target)) {
      log("Kẻ địch nằm ngoài tầm tấn công.");
      return;
    }

    this.forecastPanel.show(
      getForecast(this.state, unit, target),
      target.y,
      {
        onConfirm: () => {
          this.forecastPanel.hide();
          this.executeAttack(unit, target);
        },
        onCancel: () => this.forecastPanel.hide()
      }
    );
  }

  async executeAttack(unit, target) {
    const result = this.dispatch({
      type: "attack",
      unitId: unit.id,
      targetId: target.id
    });

    if (!result.ok) {
      log(result.error);
      return;
    }

    this.clearSelection();

    const battle = result.events.find(e => e.type === "battle");

    await this.startBattle(unit, target, battle);

    this.checkGameOver();
  }

  // ==========================================
  // BATTLE (mở BattleScene)
  // ==========================================

  // battle: sự kiện "battle" từ luật chơi (danh sách đòn đã tính sẵn).
  // Trả về Promise, xong khi trận đánh kết thúc.
  startBattle(attacker, defender, battle) {
    this.battleInProgress = true;
    this.refreshTurnUI();

    this.scene.pause();

    return new Promise(resolve => {
      this.scene.launch("BattleScene", {
        attacker,
        defender,
        strikes: battle.strikes,
        before: battle.before,
        onComplete: () => {
          this.onBattleFinished(attacker, defender);
          resolve();
        }
      });
    });
  }

  onBattleFinished(attacker, defender) {
    this.battleInProgress = false;

    this.scene.resume();

    this.mapView.syncUnit(attacker);
    this.mapView.syncUnit(defender);

    this.redraw();
    this.refreshTurnUI();

    log("=== KẾT THÚC GIAO TRANH ===");
  }

  // ==========================================
  // TURN
  // ==========================================

  async endPlayerTurn() {
    if (
      !this.turn.isPlayerPhase() ||
      this.battleInProgress ||
      this.turnTransitioning ||
      this.state.outcome
    ) {
      return;
    }

    this.turnTransitioning = true;
    this.clearSelection();
    this.refreshTurnUI();

    try {
      const toEnemy = this.dispatch({ type: "endTurn" });

      if (!toEnemy.ok) throw new Error(toEnemy.error);

      this.mapView.syncAll(this.units);
      this.refreshTurnUI();

      log("=== LƯỢT ĐỊCH BẮT ĐẦU ===");

      await this.banner.show("LƯỢT ĐỊCH", 0xb91c1c);
      await this.runEnemyPhase();

      // Ván có thể đã kết thúc ngay trong lượt địch.
      if (this.state.outcome) return;

      const toPlayer = this.dispatch({ type: "endTurn" }, "enemy");

      if (!toPlayer.ok) throw new Error(toPlayer.error);

      this.mapView.syncAll(this.units);

      log(`=== LƯỢT ${this.turn.turn} - NGƯỜI CHƠI ===`);

      await this.banner.show(
        `LƯỢT ${this.turn.turn} - NGƯỜI CHƠI`,
        0x1d4ed8
      );

    } catch (error) {
      console.error("Turn transition error:", error);

      this.turn.restorePlayerPhase();

      log("Lỗi chuyển lượt. Đã khôi phục lượt người chơi.");

    } finally {
      this.turnTransitioning = false;

      this.clearSelection();
      this.refreshTurnUI();

      this.checkGameOver();
    }
  }

  /**
   * Lượt địch do AI (core/EnemyAI.js) chơi: hỏi lệnh kế tiếp, thực thi, phát hiệu ứng.
   */
  async runEnemyPhase() {
    await this.wait(250);

    let guard = 0;
    let action;

    while (
      guard++ < 100 &&
      (action = planNextAction(this.state, "enemy"))
    ) {
      const unit = this.state.unitById(action.unitId);
      const result = this.dispatch(action, "enemy");

      if (!result.ok) {
        console.warn("AI gửi lệnh không hợp lệ:", action, result.error);
        break;
      }

      const event = result.events[0];

      if (event.type === "moved") {
        await new Promise(resolve =>
          this.mapView.moveToken(unit, event.path, resolve)
        );

        await this.wait(120);

      } else if (event.type === "battle") {
        const defender = this.state.unitById(event.defenderId);

        await this.startBattle(unit, defender, event);

      } else {
        this.mapView.syncUnit(unit);
      }

      if (this.state.outcome) break;
    }

    log("Phe địch đã hoàn thành lượt.");
  }
}
