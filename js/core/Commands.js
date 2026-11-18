
import { getMoveTiles, getAttackTargets } from "../systems/map/MapGrid.js";
import { resolveBattle } from "./BattleResolver.js";

/**
 * COMMANDS
 * Cổng DUY NHẤT để thay đổi trạng thái trận.
 *
 *   applyCommand(state, command, rng) -> { ok, error?, events }
 *
 * command.actor cho biết ai ra lệnh: { team } (sau này thêm playerId).
 * Lệnh sai luật bị từ chối (ok: false), trạng thái không đổi.
 * Lệnh hợp lệ đổi trạng thái và trả về `events` để giao diện phát animation.
 *
 * Các lệnh:
 *   { type: "move",    actor, unitId, x, y }
 *   { type: "wait",    actor, unitId }
 *   { type: "attack",  actor, unitId, targetId }
 *   { type: "endTurn", actor }
 *
 * Các sự kiện trả về:
 *   moved        { unitId, from, to, cost }
 *   waited       { unitId }
 *   battle       { attackerId, defenderId, strikes, before, after, terrain }
 *   phaseChanged { phase, turn }
 */

const fail = error => ({ ok: false, error, events: [] });
const done = events => ({ ok: true, events });

// Ai được điều khiển đơn vị này? (hiện: cùng phe với actor)
function canControl(actor, unit) {
  return !!actor && actor.team === unit.team;
}

function findUnit(state, id) {
  const unit = state.unitById(id);

  return unit && unit.hp > 0 ? unit : null;
}

const HANDLERS = {
  move(state, cmd) {
    const unit = findUnit(state, cmd.unitId);

    if (!unit) return fail("Không có đơn vị này.");
    if (!canControl(cmd.actor, unit)) return fail("Đơn vị này không thuộc quyền điều khiển của bạn.");
    if (!state.turn.canMove(unit)) return fail("Đơn vị này không thể di chuyển lúc này.");

    const tile = getMoveTiles(unit, state.units, state.terrainMap)
      .find(t => t.x === cmd.x && t.y === cmd.y);

    if (!tile) return fail("Không thể di chuyển đến ô này.");

    const from = { x: unit.x, y: unit.y };

    state.turn.markMoved(unit);
    unit.x = cmd.x;
    unit.y = cmd.y;

    return done([{
      type: "moved",
      unitId: unit.id,
      from,
      to: { x: unit.x, y: unit.y },
      cost: tile.cost
    }]);
  },

  wait(state, cmd) {
    const unit = findUnit(state, cmd.unitId);

    if (!unit) return fail("Không có đơn vị này.");
    if (!canControl(cmd.actor, unit)) return fail("Đơn vị này không thuộc quyền điều khiển của bạn.");
    if (!state.turn.canAct(unit)) return fail("Đơn vị này không thể hành động lúc này.");

    state.turn.markActed(unit);

    return done([{ type: "waited", unitId: unit.id }]);
  },

  attack(state, cmd, rng) {
    const attacker = findUnit(state, cmd.unitId);
    const defender = findUnit(state, cmd.targetId);

    if (!attacker || !defender) return fail("Không có đơn vị này.");
    if (!canControl(cmd.actor, attacker)) return fail("Đơn vị này không thuộc quyền điều khiển của bạn.");
    if (!state.turn.canAct(attacker)) return fail("Đơn vị này không thể hành động lúc này.");
    if (defender.team === attacker.team) return fail("Không thể đánh đồng đội.");

    if (!getAttackTargets(attacker, state.units).includes(defender)) {
      return fail("Mục tiêu nằm ngoài tầm tấn công.");
    }

    const terrain = {
      attacker: state.terrainMap.bonusAt(attacker.x, attacker.y),
      defender: state.terrainMap.bonusAt(defender.x, defender.y)
    };

    const battle = resolveBattle(attacker, defender, terrain, rng);

    attacker.hp = battle.after.attackerHp;
    defender.hp = battle.after.defenderHp;

    state.turn.markActed(attacker);

    return done([{
      type: "battle",
      attackerId: attacker.id,
      defenderId: defender.id,
      strikes: battle.strikes,
      before: battle.before,
      after: battle.after,
      terrain
    }]);
  },

  endTurn(state, cmd) {
    const turn = state.turn;

    if (!cmd.actor || cmd.actor.team !== turn.phase) {
      return fail("Chưa tới lượt của bạn.");
    }

    if (turn.phase === "player") {
      turn.beginEnemyPhase();
    } else {
      turn.beginPlayerPhase(state.units);
    }

    return done([{
      type: "phaseChanged",
      phase: turn.phase,
      turn: turn.turn
    }]);
  }
};

export function applyCommand(state, command, rng = Math.random) {
  const handler = HANDLERS[command?.type];

  if (!handler) return fail("Lệnh không hợp lệ.");

  return handler(state, command, rng);
}
