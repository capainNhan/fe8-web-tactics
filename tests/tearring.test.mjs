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
  assert.equal(t.flipFor("left"), true);    // ảnh gốc nhìn trái: bên trái màn đánh cần lật để nhìn phải
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
  assert.equal(stage.actors.left.part.bset.dv.getUint16(0x14, true) > 0, true);
  let dead = false;
  stage.actors.right.die().then(() => (dead = true));
  step(100); await Promise.resolve();
  assert.ok(dead && stage.actors.right.visible === false);
});

await test("thời điểm trúng đòn lấy từ BSET (M1_0 = +0x14) và nằm trong độ dài motion", () => {
  const G = createGlobals(common, rsincos);
  for (const id of Object.keys(TEARRING_UNITS)) {
    const part = createPart(pak(id), G, new Vram(), { slot: 0 });
    for (const [m, off] of [[11, 0x14], [12, 0x16], [19, 0x18]]) {
      if (!part.motion[m]) continue;
      const hit = part.bset.dv.getUint16(off, true);
      assert.ok(hit > 0 && hit <= part.motion[m].length + 1, `${id} motion ${m}: hit ${hit} / dài ${part.motion[m].length}`);
    }
  }
});

await test("đòn chí mạng làm tối nền (evt 0x40) rồi trả lại (evt 0x20)", () => {
  const scene = fakeScene();
  const stage = new TearRingStage(scene, { assets: { common, rsincos, paks: [pak("BU016"), pak("BU051")] }, units: ["BU016", "BU051"], config: TEARRING_UNITS });
  const step = n => { for (let i = 0; i < n; i++) scene.listeners.u(0, stage.tickMs + 0.001); };
  stage.actors.left.play(MOTION.crit);
  step(10);
  assert.equal(stage.G.tint[0], 64, "nền phải tối còn một nửa");
  assert.ok(stage.backdrop[0] < stage.backdropBase[0]);
  step(80);
  assert.equal(stage.G.tint[0], 128, "hết đòn thì nền trở lại");
  assert.equal(stage.backdrop[0], stage.backdropBase[0]);
});

await test("phi tới dừng đúng khi hai hộp chạm nhau (khoảng cách tâm = (wA + wB)/2)", async () => {
  const scene = fakeScene();
  const stage = new TearRingStage(scene, { assets: { common, rsincos, paks: [pak("BU016"), pak("BU051")] }, units: ["BU016", "BU051"], config: TEARRING_UNITS });
  const step = n => { for (let i = 0; i < n; i++) scene.listeners.u(0, stage.tickMs + 0.001); };
  const L = stage.actors.left, R = stage.actors.right;
  assert.equal(Math.round(R.gx - L.gx), 200);
  let arrived = false;
  L.dash(R).then(() => (arrived = true));
  let ticks = 0;
  while (!arrived && ticks < 400) { step(1); await Promise.resolve(); ticks++; }
  assert.ok(arrived, "phải tới nơi");
  assert.equal(Math.round(R.gx - L.gx), 64);
  assert.ok(ticks > 10 && ticks < 100, "thời gian phi hợp lý: " + ticks);
});

await test("phi tới (loại đòn 0 của BSET+0x0e) di chuyển TUYẾN TÍNH: bước mỗi tick gần như không đổi (TmLerp, không phải Bézier)", async () => {
  const scene = fakeScene();
  const stage = new TearRingStage(scene, { assets: { common, rsincos, paks: [pak("BU016"), pak("BU051")] }, units: ["BU016", "BU051"], config: TEARRING_UNITS });
  const step = n => { for (let i = 0; i < n; i++) scene.listeners.u(0, stage.tickMs + 0.001); };
  const L = stage.actors.left, R = stage.actors.right;
  assert.equal(L.part.bset.dv.getUint8(0x0e), 0, "unit thử phải là loại đòn 0");
  let arrived = false;
  L.dash(R).then(() => (arrived = true));
  const xs = [L.gx];
  for (let i = 0; i < 400 && !arrived; i++) { step(1); await Promise.resolve(); xs.push(L.gx); }
  assert.ok(arrived);
  const d = xs.slice(1, -1).map((x, i) => x - xs[i]);          // bỏ bước chốt cuối (gx = đích)
  const mn = Math.min(...d), mx = Math.max(...d);
  assert.ok(mx - mn <= 1, "bước/tick phải không đổi (±1): " + mn + ".." + mx);
});

await test("camera bám bên phi tới (0x801091d4) chỉ khi bên bị đánh còn sát mép (sx > 216): sau đó dừng, hai bên cách 64, camera đứng yên", async () => {
  const scene = fakeScene();
  const stage = new TearRingStage(scene, { assets: { common, rsincos, paks: [pak("BU016"), pak("BU051")] }, units: ["BU016", "BU051"], config: TEARRING_UNITS });
  const step = n => { for (let i = 0; i < n; i++) scene.listeners.u(0, stage.tickMs + 0.001); };
  const L = stage.actors.left, R = stage.actors.right;
  const scr = a => a.gx - (stage.camX - 160);
  const l0 = scr(L), r0 = scr(R);
  let arrived = false;
  L.dash(R).then(() => (arrived = true));
  let panning = true, camPrev = 0;
  for (let i = 0; i < 400 && !arrived; i++) {
    step(1); await Promise.resolve();
    if (stage.camX !== camPrev) { assert.ok(panning, "camera không được động đậy trở lại sau khi đã dừng"); camPrev = stage.camX; }
    else if (camPrev !== 0 || i > 0) panning = false;
  }
  assert.ok(arrived);
  assert.equal(Math.round(scr(R) - scr(L)), 64, "chạm nhau cách 64");
  assert.ok(scr(R) <= 216 && scr(R) > 216 - 30, "camera dừng ngay khi bên bị đánh vào vùng giữa: " + scr(R));
  assert.ok(Math.abs(stage.camX - (r0 - 216)) < 30 && stage.camX > 0);
  assert.ok(scr(L) > l0, "bên phi đi tiếp trên màn hình sau khi camera dừng");
  const cx = stage.camX; step(30);
  assert.equal(stage.camX, cx, "camera đứng nguyên sau khi phi xong");
});

console.log(`\n${passed} test đạt.`);
