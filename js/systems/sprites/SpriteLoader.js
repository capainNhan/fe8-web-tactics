
import { BATTLE_SPRITE_ROOT } from "../../data/battleSprites.js";

/**
 * SPRITE LOADER
 * Tải manifest và frame của sprite trận đánh.
 * Manifest là nguồn dữ liệu duy nhất: chỉ những frame được animation
 * dùng mới được tải.
 */

export const manifestKey = id => `${id}:manifest`;

export const frameKey = (id, file) => `${id}:${file}`;

export const manifestPath = id =>
  `${BATTLE_SPRITE_ROOT}${id}/manifest.json`;

export const framePath = (id, file) =>
  `${BATTLE_SPRITE_ROOT}${id}/frames/${file}`;

// Mọi file frame được các animation dùng tới.
export function getUsedFiles(manifest) {
  const files = new Set();

  Object.values(manifest?.animations ?? {}).forEach(animation => {
    (animation?.frames ?? []).forEach(file => files.add(file));
  });

  return [...files];
}

// Ném lỗi có tên sprite và nội dung dễ hiểu nếu manifest sai.
export function validateManifest(manifest, id) {
  const fail = message => {
    throw new Error(`Manifest ${id}: ${message}`);
  };

  if (!manifest) fail("không tải được.");

  if (!Array.isArray(manifest.frames)) {
    fail("thiếu danh sách frames.");
  }

  if (!manifest.animations?.attack?.frames?.length) {
    fail('thiếu animation "attack".');
  }

  const known = new Map(
    manifest.frames.map(frame => [frame.file, frame])
  );

  const used = getUsedFiles(manifest);

  for (const file of used) {
    if (!known.has(file)) {
      fail(`frame "${file}" có trong animation nhưng không có trong frames.`);
    }
  }

  for (const file of used) {
    const frame = known.get(file);

    if (!(frame.width > 0) || !(frame.height > 0)) {
      fail(`frame "${file}" thiếu width/height.`);
    }
  }

  return manifest;
}

export function queueManifests(scene, ids) {
  ids.forEach(id => {
    scene.load.json(manifestKey(id), manifestPath(id));
  });
}

export function queueFrames(scene, ids) {
  ids.forEach(id => {
    const manifest = validateManifest(
      scene.cache.json.get(manifestKey(id)),
      id
    );

    getUsedFiles(manifest).forEach(file => {
      scene.load.image(
        frameKey(id, file),
        framePath(id, file)
      );
    });
  });
}
