
import { BATTLE_SPRITE_ROOT, BATTLE_SPRITES } from "../../data/battleSprites.js";

/**
 * SPRITE LOADER
 * Tải spritesheet.json (pha 1) rồi spritesheet.png theo lưới frame (pha 2).
 */

export const sheetKey = id => `${id}:sheet`;

export const imageKey = id => `${id}:image`;

export const jsonPath = id =>
  `${BATTLE_SPRITE_ROOT}${id}/spritesheet.json`;

export const imagePath = id =>
  `${BATTLE_SPRITE_ROOT}${id}/spritesheet.png`;

// Ném lỗi có tên sprite và nội dung dễ hiểu nếu dữ liệu sai.
export function validateSheet(sheet, id) {
  const fail = message => {
    throw new Error(`Sprite ${id}: ${message}`);
  };

  if (!sheet) fail("không tải được spritesheet.json.");

  const config = BATTLE_SPRITES[id];

  if (!config) fail("chưa khai báo trong BATTLE_SPRITES.");

  if (!(sheet.frameSize?.w > 0) || !(sheet.frameSize?.h > 0)) {
    fail("thiếu frameSize.");
  }

  if (!sheet.frames || !sheet.animations) {
    fail("thiếu frames hoặc animations.");
  }

  for (const [role, code] of Object.entries(config.roles)) {
    const steps = sheet.animations[code];

    if (!steps?.length) {
      fail(`vai trò "${role}" trỏ tới animation "${code}" không tồn tại.`);
    }

    for (const step of steps) {
      if (!sheet.frames[step.frame]) {
        fail(`animation "${code}" dùng frame "${step.frame}" không có.`);
      }
    }
  }

  return sheet;
}

export function queueSheets(scene, ids) {
  ids.forEach(id => {
    scene.load.json(sheetKey(id), jsonPath(id));
  });
}

export function queueImages(scene, ids) {
  ids.forEach(id => {
    const sheet = validateSheet(
      scene.cache.json.get(sheetKey(id)),
      id
    );

    scene.load.spritesheet(imageKey(id), imagePath(id), {
      frameWidth: sheet.frameSize.w,
      frameHeight: sheet.frameSize.h
    });
  });
}
