
/**
 * FE8 COMBAT SYSTEM
 * Weapon Triangle, 2RN, Attack Speed,
 * Hit, Avoid, Critical và Follow-up.
 */

export const WEAPON_TRIANGLE = {
  sword: {
    axe: { dmg: 1, hit: 15 },
    lance: { dmg: -1, hit: -15 }
  },

  lance: {
    sword: { dmg: 1, hit: 15 },
    axe: { dmg: -1, hit: -15 }
  },

  axe: {
    lance: { dmg: 1, hit: 15 },
    sword: { dmg: -1, hit: -15 }
  }
};

/**
 * FE8 2RN:
 * Hit thực tế được tính bằng trung bình hai RN.
 */
export function roll2RN(displayHit, rng = Math.random) {
  const rn1 = Math.floor(rng() * 100);
  const rn2 = Math.floor(rng() * 100);

  return (rn1 + rn2) / 2 < displayHit;
}

/**
 * Weapon Triangle.
 */
export function getTriangleBonus(
  attackerWeapon,
  defenderWeapon
) {
  if (!attackerWeapon || !defenderWeapon) {
    return { dmg: 0, hit: 0 };
  }

  return (
    WEAPON_TRIANGLE[attackerWeapon.type]?.[
      defenderWeapon.type
    ] || { dmg: 0, hit: 0 }
  );
}

/**
 * Attack Speed = Speed - Weight Penalty.
 */
export function calcAttackSpeed(unit) {
  const weapon = unit.weapon;

  const weight = weapon?.wt ?? 0;
  const constitution = unit.con ?? 0;

  const penalty = Math.max(
    0,
    weight - constitution
  );

  return Math.max(0, unit.spd - penalty);
}

/**
 * Tính chỉ số chiến đấu trước trận.
 */
export function calculateBattlePreview(
  attacker,
  defender,
  terrainDef = 0,
  terrainAvo = 0,
  attackerTerrainDef = 0,
  attackerTerrainAvo = 0
) {
  const triA = getTriangleBonus(
    attacker.weapon,
    defender.weapon
  );

  const triD = getTriangleBonus(
    defender.weapon,
    attacker.weapon
  );

  const asA = calcAttackSpeed(attacker);
  const asD = calcAttackSpeed(defender);

  // Chỉ số tấn công của bên chủ động.
  const dmgA = Math.max(
    0,
    attacker.str +
    attacker.weapon.mt +
    triA.dmg -
    defender.def -
    terrainDef
  );

  const hitRawA =
    attacker.weapon.hit +
    attacker.skl * 2 +
    Math.floor(attacker.lck / 2) +
    triA.hit;

  const avoD =
    asD * 2 +
    defender.lck +
    terrainAvo;

  const hitA = Math.max(
    0,
    Math.min(100, hitRawA - avoD)
  );

  const critA = Math.max(
    0,
    Math.min(
      100,
      (attacker.weapon.crit ?? 0) +
      Math.floor(attacker.skl / 2) -
      defender.lck
    )
  );

  // Chỉ số phản công của đối thủ.
  const dmgD = Math.max(
    0,
    defender.str +
    defender.weapon.mt +
    triD.dmg -
    attacker.def -
    attackerTerrainDef
  );

  const hitRawD =
    defender.weapon.hit +
    defender.skl * 2 +
    Math.floor(defender.lck / 2) +
    triD.hit;

  const avoA =
    asA * 2 +
    attacker.lck +
    attackerTerrainAvo;

  const hitD = Math.max(
    0,
    Math.min(100, hitRawD - avoA)
  );

  const critD = Math.max(
    0,
    Math.min(
      100,
      (defender.weapon.crit ?? 0) +
      Math.floor(defender.skl / 2) -
      attacker.lck
    )
  );

  return {
    attacker: {
      dmg: dmgA,
      hit: hitA,
      crit: critA,
      attackSpeed: asA,
      double: asA - asD >= 4
    },

    defender: {
      dmg: dmgD,
      hit: hitD,
      crit: critD,
      attackSpeed: asD,
      double: asD - asA >= 4
    }
  };
}

/**
 * Tính kết quả một đòn đánh.
 *
 * Lưu ý:
 * Hàm này KHÔNG thay đổi HP.
 * BattleScene sẽ trừ HP đúng một lần
 * tại thời điểm va chạm trong animation.
 */
export function resolveStrike(
  attacker,
  defender,
  stats,
  rng = Math.random
) {
  if (
    !attacker ||
    !defender ||
    !stats ||
    attacker.hp <= 0 ||
    defender.hp <= 0
  ) {
    return {
      hit: false,
      crit: false,
      damage: 0,
      defeated: defender
        ? defender.hp <= 0
        : false
    };
  }

  const hit = roll2RN(stats.hit, rng);

  if (!hit) {
    return {
      hit: false,
      crit: false,
      damage: 0,
      defeated: false
    };
  }

  const crit =
    rng() * 100 < stats.crit;

  const damage = crit
    ? stats.dmg * 3
    : stats.dmg;

  return {
    hit: true,
    crit,
    damage,
    defeated: defender.hp - damage <= 0
  };
}
