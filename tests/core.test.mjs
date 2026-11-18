// Chạy: node tests/core.test.mjs
import assert from "node:assert/strict";
import { ACTIVE_MAP } from "../js/data/maps/index.js";
import { TerrainMap } from "../js/systems/map/TerrainMap.js";
import { createUnits } from "../js/data/units.js";
import { GameState } from "../js/core/GameState.js";
import { applyCommand } from "../js/core/Commands.js";
import { createRng } from "../js/core/rng.js";

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log("ok  -", name); };

const P = { team: "player" };
const E = { team: "enemy" };

function fresh() {
  return new GameState({
    units: createUnits(ACTIVE_MAP.spawns),
    terrainMap: new TerrainMap(ACTIVE_MAP)
  });
}

test("di chuyển hợp lệ đổi vị trí và đánh dấu đã đi", () => {
  const s = fresh();
  const r = applyCommand(s, { type: "move", actor: P, unitId: "p1", x: 4, y: 8 });
  assert.equal(r.ok, true);
  assert.equal(r.events[0].type, "moved");
  assert.deepEqual([s.unitById("p1").x, s.unitById("p1").y], [4, 8]);
  assert.equal(s.unitById("p1").hasMoved, true);
});

test("không đi 2 lần, không đi vào sông, không đi vào ô có người", () => {
  const s = fresh();
  assert.equal(applyCommand(s, { type: "move", actor: P, unitId: "p1", x: 5, y: 7 }).ok, false); // sông
  assert.equal(applyCommand(s, { type: "move", actor: P, unitId: "p1", x: 2, y: 7 }).ok, false); // p2 đứng đó
  assert.equal(applyCommand(s, { type: "move", actor: P, unitId: "p1", x: 3, y: 8 }).ok, true);
  assert.equal(applyCommand(s, { type: "move", actor: P, unitId: "p1", x: 4, y: 8 }).ok, false); // đã đi
});

test("sai phe / sai lượt bị từ chối, trạng thái không đổi", () => {
  const s = fresh();
  const before = JSON.stringify(s.snapshot());
  assert.equal(applyCommand(s, { type: "move", actor: E, unitId: "p1", x: 3, y: 8 }).ok, false);
  assert.equal(applyCommand(s, { type: "move", actor: E, unitId: "e1", x: 9, y: 8 }).ok, false); // chưa tới lượt địch
  assert.equal(applyCommand(s, { type: "endTurn", actor: E }).ok, false);
  assert.equal(JSON.stringify(s.snapshot()), before);
});

test("tấn công ngoài tầm bị từ chối; sát bên thì ra danh sách đòn", () => {
  const s = fresh();
  assert.equal(applyCommand(s, { type: "attack", actor: P, unitId: "p1", targetId: "e1" }).ok, false);
  const p1 = s.unitById("p1"), e1 = s.unitById("e1");
  p1.x = 9; p1.y = 8; // đặt kề e1 (10, 8)
  const hp = { p: p1.hp, e: e1.hp };
  const r = applyCommand(s, { type: "attack", actor: P, unitId: "p1", targetId: "e1" }, createRng(7));
  assert.equal(r.ok, true);
  const b = r.events[0];
  assert.ok(b.strikes.length >= 2 && b.strikes[0].kind === "attack" && b.strikes[1].kind === "counter");
  assert.equal(b.before.attackerHp, hp.p);
  assert.equal(p1.hp, b.after.attackerHp);
  assert.equal(e1.hp, b.after.defenderHp);
  assert.equal(p1.hasActed, true);
  // HP cuối khớp đòn cuối cùng
  assert.equal(b.strikes.at(-1).hpAfter.p1, p1.hp);
});

test("cùng seed cho cùng kết quả trận đánh", () => {
  const run = seed => {
    const s = fresh();
    s.unitById("p1").x = 9; s.unitById("p1").y = 8;
    return JSON.stringify(applyCommand(s, { type: "attack", actor: P, unitId: "p1", targetId: "e1" }, createRng(seed)).events);
  };
  assert.equal(run(42), run(42));
  const outcomes = new Set([1, 2, 3, 4, 5, 6, 7, 8].map(run));
  assert.ok(outcomes.size > 1, "các seed khác nhau phải cho kết quả khác nhau");
});

test("đơn vị chết không còn hành động / bị nhắm", () => {
  const s = fresh();
  const p1 = s.unitById("p1"), e1 = s.unitById("e1");
  p1.x = 9; p1.y = 8; e1.hp = 1;
  p1.weapon.hit = 999; p1.skl = 99; // đảm bảo trúng
  applyCommand(s, { type: "attack", actor: P, unitId: "p1", targetId: "e1" }, createRng(3));
  assert.equal(e1.hp, 0);
  assert.equal(applyCommand(s, { type: "attack", actor: P, unitId: "p2", targetId: "e1" }).ok, false);
});

test("chuyển lượt: người chơi -> địch (địch hành động được) -> người chơi, lượt +1, đơn vị được reset", () => {
  const s = fresh();
  applyCommand(s, { type: "move", actor: P, unitId: "p1", x: 3, y: 8 });
  assert.equal(applyCommand(s, { type: "endTurn", actor: P }).events[0].phase, "enemy");
  assert.equal(applyCommand(s, { type: "move", actor: P, unitId: "p2", x: 3, y: 7 }).ok, false);
  assert.equal(applyCommand(s, { type: "move", actor: E, unitId: "e1", x: 9, y: 8 }).ok, true);
  const r = applyCommand(s, { type: "endTurn", actor: E });
  assert.deepEqual([r.events[0].phase, r.events[0].turn], ["player", 2]);
  assert.equal(s.unitById("p1").hasMoved, false);
});

test("snapshot đi qua JSON và khôi phục đúng", () => {
  const s = fresh();
  applyCommand(s, { type: "move", actor: P, unitId: "p1", x: 4, y: 8 });
  const snap = JSON.parse(JSON.stringify(s.snapshot()));
  const t = fresh();
  t.restore(snap);
  assert.equal(JSON.stringify(t.snapshot()), JSON.stringify(s.snapshot()));
  assert.equal(t.unitById("p1").x, 4);
});

console.log(`\n${passed} test đạt.`);
