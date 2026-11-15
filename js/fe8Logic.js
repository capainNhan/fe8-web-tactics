const WEAPON_TRIANGLE = {
  sword: { axe: { dmg: 1, hit: 15 }, lance: { dmg: -1, hit: -15 } },
  lance: { sword: { dmg: 1, hit: 15 }, axe: { dmg: -1, hit: -15 } },
  axe:   { lance: { dmg: 1, hit: 15 }, sword: { dmg: -1, hit: -15 } }
};

// Hệ thống 2RN đặc trưng của FE8
function roll2RN(displayHit) {
  const rn1 = Math.floor(Math.random() * 100);
  const rn2 = Math.floor(Math.random() * 100);
  const avg = (rn1 + rn2) / 2;
  return avg < displayHit;
}

function getTriangleBonus(wA, wD) {
  return WEAPON_TRIANGLE[wA.type]?.[wD.type] || { dmg: 0, hit: 0 };
}

function calcAttackSpeed(unit) {
  const penalty = Math.max(0, unit.weapon.wt - unit.con);
  return Math.max(0, unit.spd - penalty);
}

// Tính bảng Battle Preview trước khi đánh
function calculateBattlePreview(attacker, defender, terrainDef = 0, terrainAvo = 0) {
  const triA = getTriangleBonus(attacker.weapon, defender.weapon);
  const triD = getTriangleBonus(defender.weapon, attacker.weapon);

  const asA = calcAttackSpeed(attacker);
  const asD = calcAttackSpeed(defender);

  // Chỉ số Attacker
  const dmgA = Math.max(0, (attacker.str + attacker.weapon.mt + triA.dmg) - (defender.def + terrainDef));
  const hitRawA = attacker.weapon.hit + (attacker.skl * 2) + Math.floor(attacker.lck / 2) + triA.hit;
  const avoD = (asD * 2) + defender.lck + terrainAvo;
  const hitA = Math.max(0, Math.min(100, hitRawA - avoD));
  const critA = Math.max(0, Math.min(100, (attacker.weapon.crit + Math.floor(attacker.skl / 2)) - defender.lck));

  // Chỉ số Defender (phản đòn)
  const dmgD = Math.max(0, (defender.str + defender.weapon.mt + triD.dmg) - attacker.def);
  const hitRawD = defender.weapon.hit + (defender.skl * 2) + Math.floor(defender.lck / 2) + triD.hit;
  const avoA = (asA * 2) + attacker.lck;
  const hitD = Math.max(0, Math.min(100, hitRawD - avoA));
  const critD = Math.max(0, Math.min(100, (defender.weapon.crit + Math.floor(defender.skl / 2)) - attacker.lck));

  return {
    attacker: { dmg: dmgA, hit: hitA, crit: critA, double: (asA - asD) >= 4 },
    defender: { dmg: dmgD, hit: hitD, crit: critD, double: (asD - asA) >= 4 }
  };
}
