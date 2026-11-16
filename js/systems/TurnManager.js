
export class TurnManager {
  constructor() {
    this.phase = "player";
    this.turn = 1;
  }

  resetUnits(units) {
    for (const unit of units) {
      unit.hasMoved = false;
      unit.hasActed = false;
    }
  }

  canMove(unit) {
    return (
      this.phase === "player" &&
      unit.team === "player" &&
      !unit.hasMoved &&
      !unit.hasActed &&
      unit.hp > 0
    );
  }

  canAct(unit) {
    return (
      this.phase === "player" &&
      unit.team === "player" &&
      !unit.hasActed &&
      unit.hp > 0
    );
  }

  markMoved(unit) {
    if (this.canMove(unit)) {
      unit.hasMoved = true;
    }
  }

  markActed(unit) {
    if (this.canAct(unit)) {
      unit.hasActed = true;
    }
  }

  beginEnemyPhase() {
    this.phase = "enemy";
  }

  beginPlayerPhase(units) {
    this.phase = "player";
    this.turn += 1;
    this.resetUnits(units);
  }
}
