
export const unitsData = [
  {
    id: "p1",
    name: "Kỵ Sĩ",
    team: "player",
    trUnit: "BU016",
    x: 1,
    y: 3,

    hp: 24,
    maxHp: 24,

    str: 9,
    skl: 12,
    spd: 13,
    lck: 6,
    def: 5,
    con: 8,
    mov: 5,

    weapon: {
      name: "Iron Sword",
      type: "sword",
      mt: 5,
      hit: 90,
      crit: 0,
      wt: 5,
      range: 1
    }
  },

  {
    id: "e1",
    name: "Kỵ Binh Địch",
    team: "enemy",
    trUnit: "BU051",
    x: 5,
    y: 3,

    hp: 26,
    maxHp: 26,

    str: 10,
    skl: 8,
    spd: 8,
    lck: 3,
    def: 6,
    con: 10,
    mov: 5,

    weapon: {
      name: "Steel Blade",
      type: "sword",
      mt: 11,
      hit: 70,
      crit: 0,
      wt: 12,
      range: 1
    }
  },

  {
    id: "p2",
    name: "Kỵ Sĩ Thanh Long",
    team: "player",
    trUnit: "BU038",
    x: 1,
    y: 2,

    hp: 22,
    maxHp: 22,

    str: 8,
    skl: 11,
    spd: 12,
    lck: 5,
    def: 4,
    con: 8,
    mov: 5,

    weapon: {
      name: "Iron Sword",
      type: "sword",
      mt: 5,
      hit: 90,
      crit: 0,
      wt: 5,
      range: 1
    }
  },

  {
    id: "p3",
    name: "Kỵ Sĩ Hắc Phong",
    team: "player",
    trUnit: "BU002",
    x: 1,
    y: 4,

    hp: 25,
    maxHp: 25,

    str: 9,
    skl: 10,
    spd: 11,
    lck: 4,
    def: 5,
    con: 9,
    mov: 5,

    weapon: {
      name: "Iron Sword",
      type: "sword",
      mt: 5,
      hit: 90,
      crit: 0,
      wt: 5,
      range: 1
    }
  },

  {
    id: "e2",
    name: "Kỵ Binh Địch Nhị",
    team: "enemy",
    trUnit: "BU061",
    x: 5,
    y: 2,

    hp: 24,
    maxHp: 24,

    str: 9,
    skl: 8,
    spd: 9,
    lck: 3,
    def: 5,
    con: 9,
    mov: 5,

    weapon: {
      name: "Steel Blade",
      type: "sword",
      mt: 11,
      hit: 70,
      crit: 0,
      wt: 12,
      range: 1
    }
  },

  {
    id: "e3",
    name: "Kỵ Binh Địch Tam",
    team: "enemy",
    trUnit: "BU081",
    x: 5,
    y: 4,

    hp: 25,
    maxHp: 25,

    str: 10,
    skl: 7,
    spd: 8,
    lck: 2,
    def: 6,
    con: 10,
    mov: 5,

    weapon: {
      name: "Steel Blade",
      type: "sword",
      mt: 11,
      hit: 70,
      crit: 0,
      wt: 12,
      range: 1
    }
  }
];

/**
 * Tạo bản sao dữ liệu đơn vị cho một ván chơi mới.
 * unitsData giữ nguyên là dữ liệu gốc, không bị ván chơi sửa.
 */
// spawns: { id: { x, y } } lấy từ bản đồ, ghi đè vị trí mặc định.
export function createUnits(spawns = {}) {
  return unitsData.map(unit => ({
    ...unit,
    ...(spawns[unit.id] ?? {}),
    weapon: { ...unit.weapon },
    hasMoved: false,
    hasActed: false
  }));
}
