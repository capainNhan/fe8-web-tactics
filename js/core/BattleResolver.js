
import {
  calculateBattlePreview,
  resolveStrike
} from "../fe8Logic.js";

/**
 * BATTLE RESOLVER
 * Tính TRƯỚC toàn bộ diễn biến một trận (ai đánh, trúng hay trượt, sát thương)
 * mà KHÔNG đổi HP của đơn vị thật. BattleScene chỉ việc phát lại danh sách đòn.
 * Nhờ vậy chỉ một nơi (máy GM) tung xúc xắc, mọi người xem cùng kết quả.
 *
 * Thứ tự đòn (giống FE8): tấn công -> phản công -> đánh bồi (nếu có).
 */
export function resolveBattle(attacker, defender, terrain = {}, rng = Math.random) {
  const a = { ...attacker, weapon: { ...attacker.weapon } };
  const d = { ...defender, weapon: { ...defender.weapon } };

  const preview = calculateBattlePreview(
    a,
    d,
    terrain.defender?.def ?? 0,
    terrain.defender?.avo ?? 0,
    terrain.attacker?.def ?? 0,
    terrain.attacker?.avo ?? 0
  );

  const strikes = [];

  const strike = (from, to, stats, kind) => {
    const result = resolveStrike({ ...from }, { ...to }, stats, rng);

    if (result.hit) {
      to.hp = Math.max(0, to.hp - result.damage);
    }

    strikes.push({
      kind,
      attackerId: from.id,
      defenderId: to.id,
      hit: result.hit,
      crit: result.crit,
      damage: result.damage,
      defeated: to.hp <= 0,
      hpAfter: { [a.id]: a.hp, [d.id]: d.hp }
    });
  };

  strike(a, d, preview.attacker, "attack");

  if (a.hp > 0 && d.hp > 0 && d.weapon) {
    strike(d, a, preview.defender, "counter");
  }

  if (a.hp > 0 && d.hp > 0) {
    if (preview.attacker.double) {
      strike(a, d, preview.attacker, "double");
    } else if (preview.defender.double) {
      strike(d, a, preview.defender, "double");
    }
  }

  return {
    strikes,
    preview,
    before: { attackerHp: attacker.hp, defenderHp: defender.hp },
    after: { attackerHp: a.hp, defenderHp: d.hp }
  };
}
