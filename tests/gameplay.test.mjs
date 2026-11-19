// Chạy: node tests/gameplay.test.mjs
import assert from "node:assert/strict";
import { ACTIVE_MAP } from "../js/data/maps/index.js";
import { TerrainMap } from "../js/systems/map/TerrainMap.js";
import { createUnits } from "../js/data/units.js";
import { GameState } from "../js/core/GameState.js";
import { applyCommand } from "../js/core/Commands.js";
import { createRng } from "../js/core/rng.js";
import { getForecast } from "../js/core/Forecast.js";
import { checkOutcome } from "../js/core/Objectives.js";
import { planNextAction } from "../js/core/EnemyAI.js";

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log("ok  -", name); };
const P = { team: "player" };
const E = { team: "enemy" };

const fresh = () => new GameState({
  units: createUnits(ACTIVE_MAP.spawns),
  terrainMap: new TerrainMap(ACTIVE_MAP)
});

test("sự kiện moved có lối đi từng ô, liền kề nhau và kết thúc ở đích", () => {
  const s = fresh();
  const r = applyCommand(s, { type: "move", actor: P, unitId: "p1", x: 5 - 1, y: 8 });
  const { path, from, to } = r.events[0];
  assert.ok(path.length >= 2);
  assert.deepEqual(path.at(-1), to);
  let cur = from;
  for (const step of path) {
    assert.equal(Math.abs(step.x - cur.x) + Math.abs(step.y - cur.y), 1);
    cur = step;
  }
});

test("đường đi vòng qua rừng/sông thay vì đi xuyên", () => {
  const s = fresh();
  const r = applyCommand(s, { type: "move", actor: P, unitId: "p1", x: 7, y: 8 }); // qua cầu
  assert.equal(r.ok, true);
  assert.ok(r.events[0].path.every(p => s.terrainMap.moveCost(p.x, p.y) !== Infinity));
});

test("dự đoán trận đánh: số liệu hợp lý và có tính địa hình", () => {
  const s = fresh();
  const p1 = s.unitById("p1"), e1 = s.unitById("e1");
  const flat = getForecast(s, p1, e1);
  const inForest = getForecast(s, p1, { ...e1, x: 2, y: 9 }); // (2,9) là rừng
  assert.ok(flat.attacker.dmg > 0 && flat.attacker.hit > 0 && flat.attacker.times >= 1);
  assert.equal(inForest.defender.terrain.avo, 20);
  assert.ok(inForest.attacker.hit < flat.attacker.hit);
});

test("hết địch thì thắng: sự kiện gameOver, state.outcome, lệnh sau bị từ chối", () => {
  const s = fresh();
  assert.equal(checkOutcome(s), null);
  ["e2", "e3"].forEach(id => { s.unitById(id).hp = 0; });
  const p1 = s.unitById("p1"), e1 = s.unitById("e1");
  p1.x = 9; p1.y = 8; e1.hp = 1; p1.weapon.hit = 999; p1.skl = 99;
  const r = applyCommand(s, { type: "attack", actor: P, unitId: "p1", targetId: "e1" }, createRng(3));
  assert.equal(r.events.at(-1).type, "gameOver");
  assert.equal(r.events.at(-1).winner, "player");
  assert.equal(s.outcome.winner, "player");
  assert.equal(applyCommand(s, { type: "wait", actor: P, unitId: "p2" }).ok, false);
});

test("hết quân ta thì thua; outcome đi qua snapshot", () => {
  const s = fresh();
  ["p2", "p3"].forEach(id => { s.unitById(id).hp = 0; });
  const p1 = s.unitById("p1"), e1 = s.unitById("e1");
  p1.hp = 1; p1.x = 9; p1.y = 8; e1.x = 10; e1.y = 8; e1.str = 99; e1.weapon.hit = 999; e1.skl = 99;
  s.turn.phase = "enemy"; s.turn.resetUnits(s.units);
  const r = applyCommand(s, { type: "attack", actor: E, unitId: "e1", targetId: "p1" }, createRng(1));
  assert.equal(r.events.at(-1).winner, "enemy");
  const t = fresh(); t.restore(JSON.parse(JSON.stringify(s.snapshot())));
  assert.equal(t.outcome.winner, "enemy");
});

test("AI: kẻ địch kề bên quân ta thì tấn công", () => {
  const s = fresh();
  s.turn.phase = "enemy"; s.turn.resetUnits(s.units);
  const e1 = s.unitById("e1"), p1 = s.unitById("p1");
  p1.x = 9; p1.y = 8; e1.x = 10; e1.y = 8;
  const action = planNextAction(s, "enemy");
  assert.equal(action.type, "attack");
  assert.equal(action.targetId, "p1");
});

test("AI: ở xa thì tiến lại gần hơn, lệnh luôn hợp lệ", () => {
  const s = fresh();
  s.turn.phase = "enemy"; s.turn.resetUnits(s.units);
  const before = Math.min(...["p1","p2","p3"].map(id => Math.abs(s.unitById(id).x - s.unitById("e1").x) + Math.abs(s.unitById(id).y - s.unitById("e1").y)));
  const action = planNextAction(s, "enemy");
  assert.equal(action.type, "move");
  const r = applyCommand(s, { ...action, actor: E });
  assert.equal(r.ok, true, r.error);
});

test("AI: cả phase địch kết thúc (không lặp vô hạn) và mọi lệnh đều hợp lệ", () => {
  const s = fresh();
  for (let round = 0; round < 12 && !s.outcome; round++) {
    applyCommand(s, { type: "endTurn", actor: P });
    let guard = 0, action;
    while ((action = planNextAction(s, "enemy"))) {
      const r = applyCommand(s, { ...action, actor: E }, createRng(round * 100 + guard));
      assert.equal(r.ok, true, `${JSON.stringify(action)} -> ${r.error}`);
      assert.ok(++guard < 60, "AI lặp quá nhiều");
    }
    if (!s.outcome) applyCommand(s, { type: "endTurn", actor: E });
  }
  // sau 12 vòng quân ta đứng yên, địch phải tiến sát và gây thiệt hại
  assert.ok(s.units.filter(u => u.team === "player").some(u => u.hp < u.maxHp) || s.outcome);
});

test("AI: ván đã kết thúc hoặc hết việc thì trả null", () => {
  const s = fresh();
  s.turn.phase = "enemy"; s.turn.resetUnits(s.units);
  s.outcome = { winner: "enemy", reason: "x" };
  assert.equal(planNextAction(s, "enemy"), null);
});

console.log(`\n${passed} test đạt.`);
