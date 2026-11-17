
/**
 * BATTLE ASSETS
 * Danh sách file và hàm tải asset cho màn hình giao chiến.
 * BootScene gọi loadBattleAssets() một lần khi mở game.
 */

export const CHAR5_PATH = "./assets/characters/Char4/";
export const CHAR5_FRAME_PATH = CHAR5_PATH + "frames/";

export const CHAR5_FRAME_FILES = [
  "frame_001.png",
  "frame_002.png",
  "frame_003.png",
  "frame_004.png",
  "frame_005.png",
  "frame_006.png",
  "frame_007.png"
];

export function getChar5TextureKey(file) {
  return "char5_" + file.replace(".png", "");
}

export function loadBattleAssets(scene) {
  scene.load.image(
    "char1",
    "./assets/characters/Char1.jpg"
  );

  scene.load.image(
    "char2",
    "./assets/characters/Char2.png"
  );

  scene.load.json(
    "char5Manifest",
    CHAR5_PATH + "manifest.json"
  );

  CHAR5_FRAME_FILES.forEach(file => {
    scene.load.image(
      getChar5TextureKey(file),
      CHAR5_FRAME_PATH + file
    );
  });
}
