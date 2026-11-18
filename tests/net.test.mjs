// Chạy: node tests/net.test.mjs
import assert from "node:assert/strict";
import { ACTIVE_MAP } from "../js/data/maps/index.js";
import { TerrainMap } from "../js/systems/map/TerrainMap.js";
import { createUnits } from "../js/data/units.js";
import { GameState } from "../js/core/GameState.js";
import { createRng } from "../js/core/rng.js";
import { createMemoryNetwork } from "../js/net/MemoryTransport.js";
import { HostSession } from "../js/net/HostSession.js";
import { ClientSession } from "../js/net/ClientSession.js";

const terrainMap = new TerrainMap(ACTIVE_MAP);
const newState = () => new GameState({ units: createUnits(ACTIVE_MAP.spawns), terrainMap });
const flush = () => new Promise(r => setTimeout(r, 5));

let passed = 0;
async function test(name, fn) { await fn(); passed++; console.log("ok  -", name); }

async function setup(clientCount = 2, hostOpts = {}) {
  const net = createMemoryNetwork();
  const host = new HostSession({ state: newState(), transport: net.createHostTransport(), code: "ROOM1", rng: createRng(5), ...hostOpts });
  await host.start();
  const clients = [];
  for (let i = 0; i < clientCount; i++) {
    const c = new ClientSession({ state: newState(), transport: net.createClientTransport(), retryMs: 5 });
    await c.join("ROOM1", `Bạn ${i + 1}`, `key-${i + 1}`);
    clients.push(c);
  }
  await flush();
  return { net, host, clients };
}
const snap = s => JSON.stringify(s.state.snapshot());

await test("vào phòng: nhận trạng thái đúng và danh sách người chơi", async () => {
  const { host, clients } = await setup(2);
  assert.equal(snap(clients[0]), snap(host));
  assert.equal(host.publicPlayers().length, 2);
  assert.equal(clients[1].players.length, 2);
  assert.equal(clients[0].playerId, "u1");
});

await test("người chơi di chuyển: GM và mọi máy cùng thấy", async () => {
  const { host, clients } = await setup(2);
  clients[0].sendCommand({ type: "move", unitId: "p1", x: 3, y: 8 });
  await flush();
  assert.equal(host.state.unitById("p1").x, 3);
  assert.equal(snap(clients[0]), snap(host));
  assert.equal(snap(clients[1]), snap(host));
});

await test("lệnh sai bị từ chối, không đổi trạng thái; không giả mạo actor / endTurn", async () => {
  const { host, clients } = await setup(1);
  const before = snap(host);
  const rejected = [];
  clients[0].on("rejected", m => rejected.push(m.error));
  clients[0].sendCommand({ type: "move", unitId: "e1", x: 9, y: 8 });                          // đơn vị phe địch
  clients[0].sendCommand({ type: "move", actor: { team: "enemy" }, unitId: "e1", x: 9, y: 8 }); // giả mạo actor
  clients[0].sendCommand({ type: "endTurn" });                                                  // chỉ GM
  clients[0].sendCommand({ type: "move", unitId: "p1", x: 5, y: 7 });                           // xuống sông
  await flush();
  assert.equal(rejected.length, 4);
  assert.equal(snap(host), before);
});

await test("GM chuyển lượt, điều khiển phe địch; người chơi bị chặn khi không tới lượt", async () => {
  const { host, clients } = await setup(1);
  assert.equal(host.hostCommand({ type: "endTurn" }, "player").ok, true);
  await flush();
  assert.equal(clients[0].state.turn.phase, "enemy");
  const rejected = [];
  clients[0].on("rejected", m => rejected.push(m));
  clients[0].sendCommand({ type: "move", unitId: "p1", x: 3, y: 8 });
  await flush();
  assert.equal(rejected.length, 1);
  assert.equal(host.hostCommand({ type: "move", unitId: "e1", x: 9, y: 8 }, "enemy").ok, true);
  await flush();
  assert.equal(clients[0].state.unitById("e1").x, 9);
});

await test("phòng tối đa 10 người, người thứ 11 bị từ chối", async () => {
  const { net } = await setup(10);
  const extra = new ClientSession({ state: newState(), transport: net.createClientTransport(), autoReconnect: false });
  await assert.rejects(extra.join("ROOM1", "Dư", "key-extra"), /đủ người/);
});

await test("vào sai mã phòng báo lỗi rõ ràng", async () => {
  const net = createMemoryNetwork();
  const c = new ClientSession({ state: newState(), transport: net.createClientTransport() });
  await assert.rejects(c.join("NOPE", "A", "k"), /Không tìm thấy phòng/);
});

await test("mất kết nối rồi vào lại bằng cùng key: giữ danh tính, nhận trạng thái mới nhất", async () => {
  const { net, host, clients } = await setup(1, {});
  clients[0].autoReconnect = false;
  clients[0].conn.close();
  await flush();
  assert.equal(host.publicPlayers()[0].connected, false);
  host.hostCommand({ type: "endTurn" }, "player");
  const again = new ClientSession({ state: newState(), transport: net.createClientTransport() });
  await again.join("ROOM1", "Bạn 1", "key-1");
  await flush();
  assert.equal(again.playerId, "u1");
  assert.equal(host.publicPlayers().length, 1);
  assert.equal(host.publicPlayers()[0].connected, true);
  assert.equal(again.state.turn.phase, "enemy");
});

await test("tự nối lại khi rớt kết nối", async () => {
  const { host, clients } = await setup(1);
  const events = [];
  ["closed", "reconnecting", "reconnected"].forEach(e => clients[0].on(e, () => events.push(e)));
  clients[0].conn.close();
  await new Promise(r => setTimeout(r, 40));
  assert.deepEqual(events, ["closed", "reconnecting", "reconnected"]);
  assert.equal(host.publicPlayers()[0].connected, true);
  clients[0].sendCommand({ type: "move", unitId: "p1", x: 3, y: 8 });
  await flush();
  assert.equal(host.state.unitById("p1").x, 3);
});

await test("ping đo được độ trễ; quá hạn không phản hồi thì đánh dấu mất kết nối", async () => {
  let clock = 1000;
  const { host } = await setup(1, { now: () => clock });
  host.tick();
  clock = 1040;
  await flush();
  assert.equal(host.publicPlayers()[0].ping, 40);
  clock = 1040 + 25000; // GM không nhận được gì thêm trong 25 giây
  host.players.get("u1").conn.send = () => {}; // giả lập đường truyền chết
  host.tick();
  assert.equal(host.publicPlayers()[0].connected, false);
});

await test("GM chơi lại ván: mọi máy nhận trạng thái mới", async () => {
  const { host, clients } = await setup(1);
  clients[0].sendCommand({ type: "move", unitId: "p1", x: 3, y: 8 });
  await flush();
  host.state.restore(newState().snapshot());
  host.broadcastState();
  await flush();
  assert.equal(clients[0].state.unitById("p1").x, 2);
});

console.log(`\n${passed} test đạt.`);
