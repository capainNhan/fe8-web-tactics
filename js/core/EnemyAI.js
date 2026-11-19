
import { getForecast } from "./Forecast.js";
import { exploreReach } from "../systems/map/Pathfinding.js";
import { getAttackTargets, distance } from "../systems/map/MapGrid.js";

/**
 * ENEMY AI
 * Chọn lệnh kế tiếp cho một phe. Không đổi trạng thái: chỉ trả về lệnh,
 * bên gọi tự thực thi (applyCommand) rồi hỏi tiếp cho đến khi trả null.
 * Dùng cho chế độ chơi một mình hoặc nút "để máy chơi lượt địch" của GM.
 *
 * Mỗi lần gọi chỉ xem trạng thái hiện tại, nên AI không giữ trí nhớ giữa các lệnh.
 */

const TIE_BREAK = 1e-6;

function expectedDamage(side, targetHp) {
  const total = side.dmg * (side.hit / 100) * side.times;

  return Math.min(total, targetHp);
}

// Điểm của việc: unit đứng ở `tile` và đánh `foe`.
function scoreOption(state, unit, tile, foe) {
  const forecast = getForecast(state, unit, foe, { from: tile });

  const dealt = expectedDamage(forecast.attacker, foe.hp);
  const taken = expectedDamage(forecast.defender, unit.hp);

  const kills = forecast.attacker.dmg * forecast.attacker.times >= foe.hp
    && forecast.attacker.hit >= 60;

  const dies = forecast.defender.dmg * forecast.defender.times >= unit.hp
    && forecast.defender.hit >= 60;

  let score = dealt - 0.6 * taken;

  if (kills) score += 50;
  if (dies && !kills) score -= 40;

  // Thích đứng chỗ có phòng thủ / né tránh tốt, và nhắm kẻ đã bị thương.
  score += forecast.attacker.terrain.def * 3;
  score += forecast.attacker.terrain.avo * 0.1;
  score += (1 - foe.hp / foe.maxHp) * 5;

  return score;
}

function bestAttackFrom(state, unit, tile) {
  const here = { ...unit, x: tile.x, y: tile.y };

  let best = null;

  for (const foe of getAttackTargets(here, state.units)) {
    const score = scoreOption(state, unit, tile, foe);

    if (!best || score > best.score) {
      best = { foe, score };
    }
  }

  return best;
}

function decide(state, unit, foes) {
  // Đã di chuyển: đánh nếu có mục tiêu, không thì đợi.
  if (unit.hasMoved) {
    const best = bestAttackFrom(state, unit, unit);

    return best
      ? { type: "attack", unitId: unit.id, targetId: best.foe.id }
      : { type: "wait", unitId: unit.id };
  }

  const info = exploreReach(unit, state.units, state.terrainMap);

  const occupied = new Set(
    info.alive
      .filter(u => u.id !== unit.id)
      .map(u => u.y * info.width + u.x)
  );

  // Các ô có thể đứng: ô hiện tại + ô tới được và còn trống.
  const options = [...info.best.entries()]
    .filter(([k]) => !occupied.has(k))
    .map(([k, cost]) => ({
      x: k % info.width,
      y: Math.floor(k / info.width),
      cost
    }));

  // 1. Có ô nào đánh được không?
  let bestPlan = null;

  for (const tile of options) {
    const best = bestAttackFrom(state, unit, tile);

    if (!best) continue;

    const score = best.score - tile.cost * TIE_BREAK;

    if (!bestPlan || score > bestPlan.score) {
      bestPlan = { tile, foe: best.foe, score };
    }
  }

  if (bestPlan) {
    const { tile, foe } = bestPlan;

    return tile.x === unit.x && tile.y === unit.y
      ? { type: "attack", unitId: unit.id, targetId: foe.id }
      : { type: "move", unitId: unit.id, x: tile.x, y: tile.y };
  }

  // 2. Không đánh được: tiến về phía kẻ địch gần nhất.
  const nearest = (from) =>
    Math.min(...foes.map(f => distance(from, f)));

  const currentDistance = nearest(unit);

  let bestStep = null;

  for (const tile of options) {
    const d = nearest(tile);

    if (!bestStep || d < bestStep.d || (d === bestStep.d && tile.cost < bestStep.cost)) {
      bestStep = { tile, d, cost: tile.cost };
    }
  }

  if (bestStep && bestStep.d < currentDistance) {
    return {
      type: "move",
      unitId: unit.id,
      x: bestStep.tile.x,
      y: bestStep.tile.y
    };
  }

  return { type: "wait", unitId: unit.id };
}

/**
 * Lệnh kế tiếp của phe `team`, hoặc null khi phe đó đã hết việc / ván kết thúc.
 */
export function planNextAction(state, team = "enemy") {
  if (state.outcome) return null;

  const foes = state.units.filter(u => u.hp > 0 && u.team !== team);

  if (!foes.length) return null;

  const actors = state.units.filter(
    u => u.hp > 0 && u.team === team && state.turn.canAct(u)
  );

  if (!actors.length) return null;

  return decide(state, actors[0], foes);
}
