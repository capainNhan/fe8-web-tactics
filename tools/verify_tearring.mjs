// Chạy engine JS trên dữ liệu thật rồi ghi crop RGBA của từng tick để đối chiếu với export_anim.py.
// node tools/verify_tearring.mjs <unit> <Mg_k> <out.bin>
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createGlobals, createPart, Frame, Gpu, Vram } from "../js/tearring/unit.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [unit, motionName, outFile, shadowArg, sideArg] = process.argv.slice(2);
const A = path.join(ROOT, "assets", "tearring");
const common = JSON.parse(fs.readFileSync(path.join(A, "common.json")));
const G = createGlobals(common, new Uint8Array(fs.readFileSync(path.join(A, "rsincos.bin"))));
const vram = new Vram();
const part = createPart(new Uint8Array(fs.readFileSync(path.join(A, `BU${unit.padStart(3, "0")}.pak`))), G, vram, { side: +(sideArg || 0), shadow: shadowArg === "shadow" });

const [, g, k] = /^M(\d+)_(\d+)/.exec(motionName).map(Number);
const length = part.motion[g * 11 + k].length;
const nticks = Math.min(length + 1, 400);
part.start(g * 11 + k, 160, 0);            // đúng như exporter: x = 160, y = 0, camera (160, 120)

const W = 480, H = 360, parts = [];
for (let t = 0; t < nticks; t++) {
  const F = new Frame({ camX: 160, camY: 120 });
  part.draw(F);
  const gpu = new Gpu(vram, { width: W, height: H, ox: 80, oy: 60, mode: "layer" }).run(F);
  const img = gpu.canvas.image();
  let x0 = W, y0 = H, x1 = 0, y1 = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (img[(y * W + x) * 4 + 3]) {
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  const hdr = Buffer.alloc(24);
  if (x1 < x0) { hdr.writeInt32LE(0, 0); hdr.writeInt32LE(0, 4); hdr.writeInt32LE(0, 8); hdr.writeInt32LE(0, 12); hdr.writeInt32LE(0, 16); }
  else {
    x1++; y1++;
    const w = x1 - x0, h = y1 - y0, data = Buffer.alloc(w * h * 4);
    for (let y = 0; y < h; y++) Buffer.from(img.buffer, ((y0 + y) * W + x0) * 4, w * 4).copy(data, y * w * 4);
    hdr.writeInt32LE(x0, 0); hdr.writeInt32LE(y0, 4); hdr.writeInt32LE(x1, 8); hdr.writeInt32LE(y1, 12); hdr.writeInt32LE(data.length, 16);
    hdr.writeInt32LE(gpu.counts.SPRT_8 | (gpu.counts.POLY_FT4 << 12), 20);
    parts.push(hdr, data); part.step(); continue;
  }
  parts.push(hdr);
  part.step();
}
fs.writeFileSync(outFile, Buffer.concat(parts));
console.log(`BU${unit} ${motionName}: ${nticks} tick`);
