
import { calculateBattlePreview } from "../fe8Logic.js";

/**
 * FORECAST (dự đoán trận đánh)
 * Số liệu hiển thị trước khi đánh, và cũng dùng cho AI chấm điểm.
 * Không đổi trạng thái, không dùng xúc xắc.
 *
 * `from` (tuỳ chọn): ô mà bên tấn công sẽ đứng (để tính địa hình); mặc định là ô hiện tại.
 */
export function getForecast(state, attacker, defender, { from } = {}) {
  const atkPos = from ?? { x: attacker.x, y: attacker.y };

  const atkTerrain = state.terrainMap.bonusAt(atkPos.x, atkPos.y);
  const defTerrain = state.terrainMap.bonusAt(defender.x, defender.y);

  const preview = calculateBattlePreview(
    attacker,
    defender,
    defTerrain.def,
    defTerrain.avo,
    atkTerrain.def,
    atkTerrain.avo
  );

  const canCounter = !!defender.weapon;

  return {
    attacker: {
      name: attacker.name,
      hp: attacker.hp,
      maxHp: attacker.maxHp,
      dmg: preview.attacker.dmg,
      hit: preview.attacker.hit,
      crit: preview.attacker.crit,
      times: preview.attacker.double ? 2 : 1,
      terrain: atkTerrain
    },
    defender: {
      name: defender.name,
      hp: defender.hp,
      maxHp: defender.maxHp,
      dmg: preview.defender.dmg,
      hit: preview.defender.hit,
      crit: preview.defender.crit,
      times: canCounter ? (preview.defender.double ? 2 : 1) : 0,
      terrain: defTerrain
    }
  };
}
