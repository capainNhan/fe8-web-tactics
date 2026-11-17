
/**
 * BATTLE SPRITES
 * Mỗi nhân vật là một thư mục trong assets/characters/ gồm:
 *   spritesheet.png  + spritesheet.json  (xuất từ TearRing Compositor, giữ nguyên)
 * Phần cấu hình riêng của engine nằm ở đây, để xuất lại sheet không ghi đè.
 *
 * Muốn thêm nhân vật mới: thả thư mục CharX/ vào assets/characters/,
 * thêm một mục vào BATTLE_SPRITES rồi gán battleSprite: "CharX" cho unit.
 *
 * Các trường:
 *   facing  : hướng nhìn của ảnh gốc ("left" | "right")
 *   scale   : phóng to khi hiển thị
 *   anchor  : điểm chân (px trong ô frame), dùng chung mọi frame của sheet
 *   reach   : khoảng cách (px màn hình) từ mục tiêu tới chỗ bên tấn công dừng lại
 *   roles   : vai trò -> mã animation trong spritesheet.json
 *   impact  : mã animation -> số thứ tự bước mà đòn chạm mục tiêu (bắt đầu từ 0)
 */

export const BATTLE_SPRITE_ROOT = "./assets/characters/";

const MOUNTED_ROLES = {
  idle: "M0_0",    // đứng chờ trước trận
  move: "M0_1",    // phi nước đại (lặp)
  ready: "M0_4",   // quay vào thế chiến đấu
  attack: "M1_0",  // đòn thường (đòn đầu tiên của mỗi bên)
  attack2: "M1_1", // đòn ngắn dùng cho các đòn tiếp theo (đánh bồi)
  crit: "M1_8"     // chí mạng
};

export const BATTLE_SPRITES = {
  Char6: {
    facing: "left",
    scale: 1.25,
    anchor: { x: 85, y: 120 },
    reach: 125,
    roles: MOUNTED_ROLES,
    impact: { M1_0: 6, M1_1: 1, M1_8: 3 }
  },

  Char7: {
    facing: "left",
    scale: 1.25,
    anchor: { x: 107, y: 118 },
    reach: 125,
    roles: MOUNTED_ROLES,
    impact: { M1_0: 6, M1_1: 3, M1_8: 4 }
  }
};

export const BATTLE_SPRITE_IDS = Object.keys(BATTLE_SPRITES);

const DEFAULT_BY_TEAM = {
  player: "Char7",
  enemy: "Char6"
};

export function getBattleSpriteId(unit) {
  return (
    unit?.battleSprite ??
    DEFAULT_BY_TEAM[unit?.team] ??
    BATTLE_SPRITE_IDS[0]
  );
}
