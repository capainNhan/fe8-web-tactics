// Chạy: node tests/tearring.test.mjs
// Mọi unit trong TEARRING_UNITS phải dựng được, chạy hết các motion chiến đấu, vẽ được mỗi tick và
// token map dựng được.  Phaser giả tối thiểu (canvas texture, sự kiện); KHÔNG thay thế thử trên trình duyệt.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

globalThis.ImageData = class { constructor(d, w, h) { this.data = d; this.width = w; this.height = h; } };
globalThis.Phaser = { Textures: { FilterMode: { NEAREST: 0 } }, Scenes: { Events: { UPDATE: "u", SHUTDOWN: "s" } } };

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const A = path.join(ROOT, "assets", "tearring") + "/";
const { TEARRING_UNITS, MOTION } = await import("../js/data/tearringUnits.js");
const { createGlobals, createPart, Frame, Gpu, Vram } = await import("../js/tearring/unit.js");
const { buildTokens } = await import("../js/tearring/token.js");
const { TearRingStage } = await import("../js/tearring/stage.js");
const { unitsData } = await import("../js/data/units.js");

const common = JSON.parse(fs.readFileSync(A + "common.json"));
const rsincos = new Uint8Array(fs.readFileSync(A + "rsincos.bin"));
const pak = id => new Uint8Array(fs.readFileSync(A + id + ".pak"));

let passed = 0;
async function test(name, fn) { await fn(); passed++; console.log("ok  -", name); }

await test("mọi unit trong data/units.js có trUnit khai báo và có gói dữ liệu", () => {
  for (const u of unitsData) {
    assert.ok(u.trUnit, `${u.id} thiếu trUnit`);
    assert.ok(TEARRING_UNITS[u.trUnit], `${u.trUnit} chưa khai báo trong tearringUnits.js`);
    assert.ok(fs.existsSync(A + u.trUnit + ".pak"), `thiếu ${u.trUnit}.pak`);
  }
});

await test("mọi unit chạy hết motion chiến đấu và vẽ được từng tick", () => {
  const G = createGlobals(common, rsincos);
  for (const id of Object.keys(TEARRING_UNITS)) {
    const vram = new Vram();
    const part = createPart(pak(id), G, vram, { slot: 0, shadow: true });
    for (const m of [MOTION.idle, MOTION.move, MOTION.dodge, MOTION.attack, MOTION.attack2, MOTION.crit]) {
      if (!part.motion[m]) { assert.ok(m === MOTION.attack2 || m === MOTION.crit, `${id} thiếu motion ${m}`); continue; }
      part.start(m, 0, 56);
      let n = 0;
      while (!part.step()) {
        const F = new Frame({ camX: 0, camY: 160 });
        part.draw(F);
        new Gpu(vram, { width: 320, height: 160, mode: "backdrop" }).run(F);
        assert.ok(++n < 2000, `${id} motion ${m} không kết thúc`);
      }
    }
  }
});

function fakeScene() {
  const listeners = {};
  const cache = {
    json: { get: k => (k === "tr-common" ? common : null) },
    binary: { get: k => (k === "tr-rsincos" ? rsincos : fs.existsSync(A + k.slice(3) + ".pak") ? pak(k.slice(3)) : null) }
  };
  return {
    cache, listeners,
    textures: { exists: () => false, remove() {}, createCanvas: () => ({ setFilter() {}, refresh() {}, getContext: () => ({ putImageData() {} }) }) },
    events: { on: (e, f) => (listeners[e] = f), once() {}, off() {} },
    time: { delayedCall: (ms, f) => setTimeout(f, ms) }
  };
}

await test("token map dựng được cho mọi unit", () => {
  const tokens = buildTokens(fakeScene(), TEARRING_UNITS);
  assert.equal(tokens.size, Object.keys(TEARRING_UNITS).length);
  for (const t of tokens.values()) assert.ok(t.w > 10 && t.h > 10);
  const t = tokens.get("BU016");
  assert.equal(t.flipFor("left"), true);    // ảnh gốc nhìn trái, bên người chơi cần nhìn phải
  assert.equal(t.flipFor("right"), false);
});

await test("stage: đòn đánh có sự kiện trúng/kết thúc, biến mất khi bị hạ gục", async () => {
  const scene = fakeScene();
  const stage = new TearRingStage(scene, { assets: { common, rsincos, paks: [pak("BU016"), pak("BU051")] }, units: ["BU016", "BU051"], config: TEARRING_UNITS });
  const step = n => { for (let i = 0; i < n; i++) scene.listeners.u(0, stage.tickMs + 0.001); };
  stage.actors.left.loop(MOTION.idle); stage.actors.right.loop(MOTION.idle);
  const h = stage.actors.left.play(MOTION.attack);
  let hit = false, done = false;
  h.hit.then(() => (hit = true)); h.done.then(() => (done = true));
  step(120); await Promise.resolve();
  assert.ok(hit && done, "đòn đánh phải trúng và kết thúc");
  let dead = false;
  stage.actors.right.die().then(() => (dead = true));
  step(100); await Promise.resolve();
  assert.ok(dead && stage.actors.right.visible === false);
});

console.log(`\n${passed} test đạt.`);
