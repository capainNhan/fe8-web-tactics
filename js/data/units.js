
export const unitsData = [
  {
    id: "p1",
    name: "Kiếm Sĩ",
    team: "player",
    battleSprite: "Char4",
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
    name: "Lính Đánh Thuê",
    team: "enemy",
    battleSprite: "Char2",
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
  }
];

/**
 * Tạo bản sao dữ liệu đơn vị cho một ván chơi mới.
 * unitsData giữ nguyên là dữ liệu gốc, không bị ván chơi sửa.
 */
export function createUnits() {
  return unitsData.map(unit => ({
    ...unit,
    weapon: { ...unit.weapon },
    hasMoved: false,
    hasActed: false
  }));
}
