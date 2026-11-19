// Chạy: node tests/scene-smoke.test.mjs
// Chạy luồng MapScene với Phaser giả (mọi lời gọi đồ họa là hàm rỗng, tween/timer chạy ngay)
// để bắt lỗi logic và lỗi import trong luồng chơi. KHÔNG thay thế việc thử trên trình duyệt thật.
import assert from "node:assert/strict";

const logs = [];
globalThis.document = { getElementById: () => null, createElement: () => ({}) };

const deep = () => new Proxy(function () {}, {
  get: (_, key) => key === "then" ? undefined : key === Symbol.toPrimitive ? () => 0 : deep(),
  apply: () => deep(),
  construct: () => deep()
});

globalThis.Phaser = { Scene: class {} };

const { MapScene } = await import("../js/scenes/MapScene.js");
const { createRng } = await import("../js/core/rng.js");

function makeScene() {
  const s = new MapScene();
  const battles = [];
  Object.assign(s, {
    add: deep(), textures: deep(), cameras: deep(),
    input: { on() {} },
    tweens: { add: cfg => { cfg.onComplete?.(); return deep(); } },
    time: { delayedCall: (ms, fn) => { fn(); return deep(); } },
    scene: {
      pause() {}, resume() {}, restart() {},
      launch: (key, data) => { battles.push(data); data.onComplete(); }
    }
  });
  s.battles = battles;
  s.create();
  return s;
}

let passed = 0;
async function test(name, fn) { await fn(); passed++; console.log("ok  -", name); }

await test("create chạy được, có 6 đơn vị và ô địa hình", async () => {
  const s = makeScene();
  assert.equal(s.units.length, 6);
  assert.equal(s.turn.phase, "player");
});

await test("chọn đơn vị -> di chuyển -> đợi", async () => {
  const s = makeScene();
  const p1 = s.state.unitById("p1");
  s.handleTileClick(p1.x, p1.y);
  assert.equal(s.selectedUnit, p1);
  s.handleUnitAction("move");
  assert.ok(s.moveTiles.length > 0);
  const t = s.moveTiles[0];
  s.handleTileClick(t.x, t.y);
  assert.deepEqual([p1.x, p1.y], [t.x, t.y]);
  assert.equal(p1.hasMoved, true);
  s.handleTileClick(p1.x, p1.y);
  s.handleUnitAction("wait");
  assert.equal(p1.hasActed, true);
});

await test("không có địch trong tầm thì chế độ tấn công bị từ chối", async () => {
  const s = makeScene();
  const p1 = s.state.unitById("p1");
  s.handleTileClick(p1.x, p1.y);
  s.handleUnitAction("attack");
  assert.equal(s.actionMode, null);
});

await test("kết thúc lượt: AI địch chơi xong và quay lại lượt người chơi", async () => {
  const s = makeScene();
  const before = s.units.filter(u => u.team === "enemy").map(u => [u.x, u.y].join());
  await s.endPlayerTurn();
  assert.equal(s.turn.phase, "player");
  assert.equal(s.turn.turn, 2);
  const after = s.units.filter(u => u.team === "enemy").map(u => [u.x, u.y].join());
  assert.notDeepEqual(after, before, "địch phải tiến lên");
  assert.equal(s.turnTransitioning, false);
});

await test("chơi nhiều vòng liên tiếp không lỗi; có giao chiến thì BattleScene nhận danh sách đòn", async () => {
  const s = makeScene();
  for (let i = 0; i < 10 && !s.state.outcome; i++) await s.endPlayerTurn();
  assert.equal(s.turnTransitioning, false);
  assert.ok(s.battles.length > 0, "đến lúc phải có giao chiến");
  assert.ok(Array.isArray(s.battles[0].strikes) && s.battles[0].strikes.length >= 1);
  assert.ok(s.battles[0].before.attackerHp > 0);
});

await test("xem dự đoán rồi xác nhận tấn công: mở trận, và thắng thì hiện màn kết quả", async () => {
  const s = makeScene();
  ["e2", "e3"].forEach(id => { s.state.unitById(id).hp = 0; });
  const p1 = s.state.unitById("p1"), e1 = s.state.unitById("e1");
  p1.x = 9; p1.y = 8; e1.hp = 1; p1.weapon.hit = 999; p1.skl = 99;
  s.handleTileClick(p1.x, p1.y);
  s.handleUnitAction("attack");
  assert.equal(s.actionMode, "attack");
  assert.equal(s.attackTiles.length, 1);
  let confirm;
  s.forecastPanel.show = (forecast, y, cb) => { confirm = cb; assert.ok(forecast.attacker.dmg > 0); };
  s.handleTileClick(e1.x, e1.y);
  assert.ok(confirm, "phải hiện bảng dự đoán");
  s.rng = createRng(2);
  confirm.onConfirm();
  await new Promise(r => setTimeout(r, 10));
  assert.equal(s.battles.length, 1);
  assert.equal(s.state.outcome?.winner, "player");
  assert.equal(s.gameOverPanel.visible, true);
});

await test("địch thắng trong lượt địch thì không đổi lượt tiếp mà hiện màn thua", async () => {
  const s = makeScene();
  ["p2", "p3"].forEach(id => { s.state.unitById(id).hp = 0; });
  const p1 = s.state.unitById("p1"), e1 = s.state.unitById("e1");
  p1.hp = 1; p1.x = 9; p1.y = 8; e1.x = 10; e1.y = 8; e1.str = 99; e1.weapon.hit = 999; e1.skl = 99;
  await s.endPlayerTurn();
  assert.equal(s.state.outcome?.winner, "enemy");
  assert.equal(s.gameOverPanel.visible, true);
  assert.equal(s.turnTransitioning, false);
});

console.log(`\n${passed} test đạt.`);
