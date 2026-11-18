
/**
 * BẢN ĐỒ: Thung Lũng Hai Bờ (12 x 12)
 * Dòng sông chạy dọc giữa bản đồ, hai cây cầu ở hàng 3 và hàng 8.
 * Pháo đài phía đông bắc (chưa dùng, để dành cho mục tiêu chiếm thành).
 *
 * Ký hiệu xem data/terrain.js:
 *   . đồng bằng  = đường  F rừng  H đồi  M núi
 *   ~ sông  B cầu  # tường  T pháo đài  V làng
 *
 * spawns: vị trí xuất phát theo id đơn vị (ghi đè x, y trong units.js).
 */

export const VALLEY = {
  id: "valley",
  name: "Thung Lũng Hai Bờ",

  rows: [
    "MMH..~~.####",
    "MH.F.~~.#TT#",
    "H.FF.~~==TT#",
    "....=BB=####",
    ".FF.=~~=.HH.",
    "..F.=~~=.H..",
    "....V~~V..M.",
    ".H..=~~=..MM",
    "....=BB=....",
    "..FF.~~.F...",
    "..FFF~~..FF.",
    "M.F..~~...MM"
  ],

  spawns: {
    p1: { x: 2, y: 8 },
    p2: { x: 2, y: 7 },
    p3: { x: 1, y: 8 },
    e1: { x: 10, y: 8 },
    e2: { x: 9, y: 7 },
    e3: { x: 9, y: 6 }
  }
};
