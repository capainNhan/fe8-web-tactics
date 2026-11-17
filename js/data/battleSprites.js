
/**
 * BATTLE SPRITES
 * Danh sách sprite trận đánh. Mỗi id là một thư mục trong assets/characters/
 * chứa manifest.json và thư mục frames/ (xem docs trong manifest).
 *
 * Muốn thêm nhân vật mới: tạo thư mục Charx/ (manifest.json + frames/),
 * thêm id vào BATTLE_SPRITE_IDS, rồi gán battleSprite: "Charx" cho unit.
 */

export const BATTLE_SPRITE_ROOT = "./assets/characters/";

export const BATTLE_SPRITE_IDS = ["Char4", "Char2"];

const DEFAULT_BY_TEAM = {
  player: "Char4",
  enemy: "Char2"
};

export function getBattleSpriteId(unit) {
  return (
    unit?.battleSprite ??
    DEFAULT_BY_TEAM[unit?.team] ??
    BATTLE_SPRITE_IDS[0]
  );
}
