// Chạy: node tests/sfx.test.mjs
import assert from "node:assert/strict";
import { pickStrikeSfx } from "../js/systems/audio/BattleSfx.js";
import { SfxPlayer } from "../js/systems/audio/SfxPlayer.js";
import { SYNTH_SFX } from "../js/systems/audio/SynthSfx.js";
import { SFX, BATTLE_SFX } from "../js/data/sfx.js";

let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log("ok  -", name); };

// AudioContext giả: đếm node tạo ra, không cần trình duyệt.
function fakeContext() {
  const made = { osc: 0, source: 0 };
  const param = () => ({ value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} });
  const node = () => ({ connect(n) { return n; }, disconnect() {}, start() {}, stop() {} });
  return {
    made, state: "running", currentTime: 0, sampleRate: 8000, destination: node(),
    createGain: () => ({ ...node(), gain: param() }),
    createOscillator: () => { made.osc++; return { ...node(), frequency: param(), type: "" }; },
    createBufferSource: () => { made.source++; return node(); },
    createDynamicsCompressor: () => node(),
    createBiquadFilter: () => ({ ...node(), frequency: param(), Q: param(), type: "" }),
    createBuffer: (c, n) => ({ sampleRate: 8000, getChannelData: () => new Float32Array(n) })
  };
}

await test("mọi tiếng trong BATTLE_SFX có khai báo, và có bản tự tạo dự phòng", () => {
  for (const id of Object.values(BATTLE_SFX).filter(Boolean)) {
    assert.ok(SFX[id], id);
    assert.ok(SYNTH_SFX[SFX[id].fallback], id);
  }
});

await test("chọn tiếng theo trúng / chí mạng / trượt", () => {
  assert.equal(pickStrikeSfx({ hit: true, crit: false }), "slash_hit");
  assert.equal(pickStrikeSfx({ hit: true, crit: true }), "slash_crit");
  assert.equal(pickStrikeSfx({ hit: false }), null);
  assert.equal(pickStrikeSfx({ hit: false }, { miss: "m" }), "m");
  assert.equal(pickStrikeSfx(null), null);
});

await test("SfxPlayer phát tiếng tự tạo khi không có file", async () => {
  const ctx = fakeContext();
  const settings = { muted: false };
  const p = new SfxPlayer({ getContext: () => ctx, library: { get: async () => null }, settings });
  await p.play("slash_hit");
  assert.ok(ctx.made.osc > 0 && ctx.made.source > 0);
});

await test("tắt tiếng thì không phát; id lạ thì bỏ qua", async () => {
  const ctx = fakeContext();
  const settings = { muted: true };
  const p = new SfxPlayer({ getContext: () => ctx, library: { get: async () => null }, settings });
  await p.play("slash_hit");
  settings.muted = false;
  await p.play("khong_co");
  assert.equal(ctx.made.osc + ctx.made.source, 0);
});

console.log(`\n${passed} test đạt`);
