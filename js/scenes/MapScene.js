
import { TILE } from "../config.js";
import { createUnits } from "../data/units.js";
import { TurnManager } from "../systems/TurnManager.js";
import { MapRenderer } from "../systems/map/MapRenderer.js";
import {
  inBounds,
  unitAt,
  getMoveTiles,
  getAttackTargets
} from "../systems/map/MapGrid.js";
import { UnitActionMenu } from "../systems/ui/UnitActionMenu.js";
import { TurnUI } from "../systems/ui/TurnUI.js";
import { log } from "../systems/GameLog.js";

/**
 * MAP SCENE
 * Bàn cờ chiến thuật: chọn đơn vị, menu hành động,
 * di chuyển, chọn mục tiêu, chuyển lượt.
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
    this.units = createUnits();

    this.turn = new TurnManager();
    this.turn.resetUnits(this.units);

    this.selectedUnit = null;
    this.moveTiles = [];
    this.actionMode = null; // null | "move" | "attack"

    this.battleInProgress = false;
    this.turnTransitioning = false;

    this.mapView = new MapRenderer(this);
    this.mapView.drawGrid();
    this.mapView.createUnitTokens(this.units);

    this.turnUI = new TurnUI(
      this,
      () => this.endPlayerTurn()
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
    log("Lượt 1 - Phe người chơi.");
  }

  // ==========================================
  // HELPERS
  // ==========================================

  redraw() {
    this.mapView.drawGrid(this.moveTiles);
  }

  clearSelection() {
    this.actionMenu.hide();

    this.selectedUnit = null;
    this.moveTiles = [];
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
        !this.turnTransitioning
    });
  }

  wait(ms) {
    return new Promise(resolve => {
      this.time.delayedCall(ms, resolve);
    });
  }

  // ==========================================
  // INPUT
  // ==========================================

  onPointerDown(pointer) {
    if (this.battleInProgress || this.turnTransitioning) {
      return;
    }

    if (this.turnUI.contains(pointer.x, pointer.y)) {
      return;
    }

    if (this.actionMenu.contains(pointer.x, pointer.y)) {
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
    const target = unitAt(this.units, gx, gy);

    // Chọn đơn vị người chơi.
    if (target && target.team === "player") {
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
      this.tryAttack(unit, target);
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
        enabled: this.turn.canAct(unit)
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
        this.moveTiles = getMoveTiles(unit, this.units);
        this.redraw();

        log("Chọn ô muốn di chuyển.");
        break;

      case "attack":
        this.actionMenu.hide();
        this.actionMode = "attack";
        this.moveTiles = [];
        this.redraw();

        log("Chọn kẻ địch liền kề để tấn công.");
        break;

      case "wait":
        this.turn.markActed(unit);
        this.clearSelection();
        this.refreshTurnUI();

        log(unit.name + " đã đợi.");
        break;
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

    this.turn.markMoved(unit);
    unit.x = gx;
    unit.y = gy;

    this.moveTiles = [];
    this.actionMode = null;
    this.redraw();

    this.mapView.moveToken(unit, () => {
      if (this.selectedUnit === unit && !unit.hasActed) {
        log(
          unit.name +
          " đã di chuyển. Chọn hành động tiếp theo."
        );

        this.showUnitActionMenu(unit);
      }
    });
  }

  tryAttack(unit, target) {
    if (!target || target.team !== "enemy") {
      log("Hãy chọn một kẻ địch.");
      return;
    }

    const inRange = getAttackTargets(unit, this.units)
      .includes(target);

    if (!inRange) {
      log("Kẻ địch nằm ngoài tầm tấn công.");
      return;
    }

    this.turn.markActed(unit);
    this.clearSelection();

    this.startBattle(unit, target);
  }

  // ==========================================
  // BATTLE (mở BattleScene)
  // ==========================================

  startBattle(attacker, defender) {
    this.battleInProgress = true;
    this.refreshTurnUI();

    this.scene.pause();

    this.scene.launch("BattleScene", {
      attacker,
      defender,
      onComplete: () =>
        this.onBattleFinished(attacker, defender)
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
      this.turnTransitioning
    ) {
      return;
    }

    this.turnTransitioning = true;
    this.clearSelection();
    this.refreshTurnUI();

    try {
      this.turn.beginEnemyPhase();
      this.refreshTurnUI();

      log("=== LƯỢT ĐỊCH BẮT ĐẦU ===");

      await this.runEnemyPhase();

      this.turn.beginPlayerPhase(this.units);

      log(`=== LƯỢT ${this.turn.turn} - NGƯỜI CHƠI ===`);

    } catch (error) {
      console.error("Turn transition error:", error);

      this.turn.restorePlayerPhase();

      log("Lỗi chuyển lượt. Đã khôi phục lượt người chơi.");

    } finally {
      this.turnTransitioning = false;

      this.clearSelection();
      this.refreshTurnUI();
    }
  }

  async runEnemyPhase() {
    // AI địch sẽ được tích hợp ở đây.
    await this.wait(700);

    log("Phe địch đã hoàn thành lượt.");
  }
}
