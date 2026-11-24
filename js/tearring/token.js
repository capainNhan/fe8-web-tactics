/**
 * token.js - hình đại diện của unit trên map, vẽ bằng chính engine TearRing:
 * dựng thế đứng chờ (M0_0, tick 0) rồi cắt sát hình, lưu thành texture Phaser.
 */
import { createGlobals, createPart, Frame, Gpu, Vram } from "./unit.js";

export class TokenSet {
  constructor(id, textureKey, w, h, facing) {
    this.id = id; this.textureKey = textureKey; this.w = w; this.h = h; this.facing = facing;
  }
  /** slot "left": bên nhìn sang phải; "right": bên nhìn sang trái. Trả true nếu cần lật ngang. */
  flipFor(slot) { return slot === "left" ? this.facing !== "right" : this.facing !== "left"; }
}

/** Dựng token cho các unit trong `config` mà asset đã được BootScene nạp (cache "tr-<id>"). */
export function buildTokens(scene, config) {
  const common = scene.cache.json.get("tr-common");
  const rsincos = scene.cache.binary.get("tr-rsincos");
  const G = createGlobals(common, rsincos);
  const tokens = new Map();

  for (const [id, cfg] of Object.entries(config)) {
    const pak = scene.cache.binary.get("tr-" + id);
    if (!pak) continue;

    const vram = new Vram();
    const part = createPart(pak, G, vram, { slot: 0, side: 0, shadow: false });
    part.start(0, 160, 0);                         // M0_0, tick 0
    const F = new Frame({ camX: 160, camY: 200 });
    part.draw(F);
    const img = new Gpu(vram, { width: 320, height: 240, mode: "layer" }).run(F).canvas.image();

    let x0 = 320, y0 = 240, x1 = -1, y1 = -1;
    for (let y = 0; y < 240; y++) for (let x = 0; x < 320; x++) {
      if (img[(y * 320 + x) * 4 + 3] > 40) {
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
    if (x1 < 0) continue;

    const w = x1 - x0 + 1, h = y1 - y0 + 1;
    const crop = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) crop.set(img.subarray(((y0 + y) * 320 + x0) * 4, ((y0 + y) * 320 + x0 + w) * 4), y * w * 4);

    const key = "tr-token-" + id;
    if (scene.textures.exists(key)) scene.textures.remove(key);
    const tex = scene.textures.createCanvas(key, w, h);
    tex.getContext().putImageData(new ImageData(crop, w, h), 0, 0);
    tex.refresh();
    tokens.set(id, new TokenSet(id, key, w, h, cfg.facing));
  }
  return tokens;
}
