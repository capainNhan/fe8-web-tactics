
import { ACTIVE_MAP } from "../data/maps/index.js";
import { createUnits } from "../data/units.js";
import { TerrainMap } from "../systems/map/TerrainMap.js";
import { getMoveTiles } from "../systems/map/MapGrid.js";
import { GameState } from "../core/GameState.js";
import { PeerTransport } from "./PeerTransport.js";
import { HostSession } from "./HostSession.js";
import { ClientSession } from "./ClientSession.js";
import { HEARTBEAT_MS } from "./protocol.js";
import { runDiagnostics } from "./diagnose.js";
import { DEFAULT_ICE_SERVERS } from "./PeerTransport.js";

/**
 * Trang thử kết nối (nettest.html). Chỉ để kiểm tra mạng, không dùng Phaser.
 * Logic mạng nằm ở HostSession / ClientSession / PeerTransport.
 */

const $ = id => document.getElementById(id);

const COLORS = {
  plain: "#6fae52", road: "#caa56a", forest: "#2d6a32", hill: "#8fbf6b",
  mountain: "#7f7f8c", water: "#3a7bd5", bridge: "#9b6a3a", wall: "#5d5d68",
  fort: "#b8b4a6", village: "#c0583f"
};

const terrainMap = new TerrainMap(ACTIVE_MAP);

const newState = () => new GameState({
  units: createUnits(ACTIVE_MAP.spawns),
  terrainMap
});

const ui = {
  role: null,        // "host" | "client"
  state: newState(),
  session: null,
  transport: null,
  selected: null,
  heartbeat: null,
  wakeLock: null
};

/* ---------- tiện ích ---------- */

function log(text, cls = "") {
  const box = $("log");
  const time = new Date().toLocaleTimeString("vi-VN");
  const line = document.createElement("div");

  line.textContent = `[${time}] ${text}`;
  if (cls) line.className = cls;
  box.appendChild(line);
  box.scrollTop = box.scrollHeight;
}

function deviceKey() {
  let key = localStorage.getItem("fe8_key");

  if (!key) {
    key = Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem("fe8_key", key);
  }

  return key;
}

function makeCode() {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

  return Array.from({ length: 5 }, () =>
    alphabet[Math.floor(Math.random() * alphabet.length)]
  ).join("");
}

// Máy chủ TURN riêng do người dùng dán vào ô "Nâng cao" (JSON), nhớ trong máy.
function extraIceServers() {
  const box = $("ice");
  const raw = box.value.trim();

  localStorage.setItem("fe8_ice", raw);

  if (!raw) return [];

  try {
    const list = JSON.parse(raw);

    return Array.isArray(list) ? list : [list];
  } catch {
    $("lobbyMsg").textContent = "Ô TURN riêng không phải JSON hợp lệ, đã bỏ qua.";

    return [];
  }
}

function makeTransport() {
  return new PeerTransport({
    extraIceServers: extraIceServers(),
    onStage: text => { $("lobbyMsg").className = "warn"; $("lobbyMsg").textContent = text; }
  });
}

function setStatus(text, cls = "") {
  const el = $("status");

  el.textContent = text;
  el.className = cls;
}

/* ---------- vẽ bản đồ ---------- */

const canvas = $("map");
const g = canvas.getContext("2d");
const CELL = canvas.width / terrainMap.width;

function myTeam() {
  return ui.role === "host" ? $("team").value : "player";
}

function reachable() {
  if (!ui.selected) return [];

  const unit = ui.state.unitById(ui.selected);

  if (!unit || !ui.state.turn.canMove(unit)) return [];

  return getMoveTiles(unit, ui.state.units, terrainMap);
}

function render() {
  g.clearRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < terrainMap.height; y++) {
    for (let x = 0; x < terrainMap.width; x++) {
      g.fillStyle = COLORS[terrainMap.terrainAt(x, y).id] ?? "#888";
      g.fillRect(x * CELL, y * CELL, CELL, CELL);
    }
  }

  g.strokeStyle = "rgba(0,0,0,.25)";
  g.lineWidth = 1;

  for (let i = 0; i <= terrainMap.width; i++) {
    g.beginPath(); g.moveTo(i * CELL, 0); g.lineTo(i * CELL, canvas.height); g.stroke();
    g.beginPath(); g.moveTo(0, i * CELL); g.lineTo(canvas.width, i * CELL); g.stroke();
  }

  reachable().forEach(t => {
    g.fillStyle = "rgba(56,189,248,.5)";
    g.fillRect(t.x * CELL, t.y * CELL, CELL, CELL);
  });

  ui.state.units.filter(u => u.hp > 0).forEach(u => {
    const cx = u.x * CELL + CELL / 2;
    const cy = u.y * CELL + CELL / 2;
    const spent = u.hasMoved || u.hasActed;

    g.globalAlpha = spent ? 0.55 : 1;
    g.fillStyle = u.team === "player" ? "#3b82f6" : "#ef4444";
    g.beginPath();
    g.arc(cx, cy, CELL * 0.38, 0, Math.PI * 2);
    g.fill();

    g.lineWidth = u.id === ui.selected ? 4 : 2;
    g.strokeStyle = u.id === ui.selected ? "#fbbf24" : "#fff";
    g.stroke();

    g.globalAlpha = 1;
    g.fillStyle = "#fff";
    g.font = `bold ${CELL * 0.3}px sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(u.id, cx, cy);
  });

  const turn = ui.state.turn;

  $("turnInfo").textContent =
    `Lượt ${turn.turn} - phe ${turn.phase === "player" ? "người chơi" : "địch"}`;
}

function renderPlayers(players = []) {
  $("players").innerHTML = players.length
    ? players.map(p => `
        <div>
          <span class="${p.connected ? "ok" : "bad"}">${p.connected ? "●" : "○"} ${escapeHtml(p.name)}</span>
          <span>${p.connected && p.ping != null ? p.ping + " ms" : p.connected ? "..." : "mất kết nối"}</span>
        </div>`).join("")
    : "<div class='hint'>Chưa có ai.</div>";
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[c]);
}

/* ---------- thao tác chạm ---------- */

function sendCommand(command) {
  if (ui.role === "host") {
    const result = ui.session.hostCommand(command, myTeam());

    if (!result.ok) log(result.error, "warn");
  } else {
    ui.session.sendCommand(command);
  }
}

canvas.addEventListener("pointerdown", event => {
  if (!ui.session) return;

  const rect = canvas.getBoundingClientRect();
  const x = Math.floor((event.clientX - rect.left) / rect.width * terrainMap.width);
  const y = Math.floor((event.clientY - rect.top) / rect.height * terrainMap.height);

  const here = ui.state.units.find(u => u.hp > 0 && u.x === x && u.y === y);

  if (ui.selected && reachable().some(t => t.x === x && t.y === y)) {
    sendCommand({ type: "move", unitId: ui.selected, x, y });
    ui.selected = null;
  } else if (here && here.team === myTeam() && ui.state.turn.canMove(here)) {
    ui.selected = here.id;
  } else {
    ui.selected = null;
  }

  render();
});

/* ---------- giữ màn hình sáng + theo dõi tab bị ẩn ---------- */

async function requestWakeLock() {
  if (!("wakeLock" in navigator)) {
    $("wake").textContent = "Trình duyệt không hỗ trợ giữ màn hình sáng: hãy tự để màn hình sáng và giữ tab này mở.";
    return;
  }

  try {
    ui.wakeLock = await navigator.wakeLock.request("screen");
    $("wake").textContent = "Đang giữ màn hình sáng. Đừng chuyển sang app khác khi đang chơi.";
    ui.wakeLock.addEventListener("release", () => { ui.wakeLock = null; });
  } catch (error) {
    $("wake").textContent = "Không giữ được màn hình sáng: " + error.message;
  }
}

let hiddenAt = null;

document.addEventListener("visibilitychange", () => {
  if (!ui.session) return;

  if (document.hidden) {
    hiddenAt = Date.now();
    log("Tab bị ẩn / chuyển app.", "warn");
  } else {
    const seconds = hiddenAt ? Math.round((Date.now() - hiddenAt) / 1000) : 0;

    log(`Tab hiện lại sau ${seconds} giây.`, "warn");
    hiddenAt = null;

    if (ui.role === "host" && !ui.wakeLock) requestWakeLock();
  }
});

/* ---------- vào / tạo phòng ---------- */

function showRoom(code) {
  $("lobby").hidden = true;
  $("room").hidden = false;
  $("code").textContent = code;
  $("gmTools").hidden = ui.role !== "host";
  render();
}

function playerName() {
  const name = $("name").value.trim() || "Người chơi";

  localStorage.setItem("fe8_name", name);

  return name;
}

async function createRoom() {
  $("lobbyMsg").textContent = "";
  $("create").disabled = true;

  const code = makeCode();

  try {
    ui.role = "host";
    ui.transport = makeTransport();
    ui.session = new HostSession({ state: ui.state, transport: ui.transport, code });

    ui.session
      .on("log", text => log(text))
      .on("players", renderPlayers)
      .on("update", () => { render(); });

    await ui.session.start();

    ui.transport.onError = message => log(message, "bad");
    ui.heartbeat = setInterval(() => ui.session.tick(), HEARTBEAT_MS);

    showRoom(code);
    setStatus("Phòng đã mở. Gửi mã cho bạn bè.", "ok");
    log(`Tạo phòng ${code}.`, "ok");
    renderPlayers([]);
    requestWakeLock();
  } catch (error) {
    ui.session = null;
    $("lobbyMsg").className = "bad";
    $("lobbyMsg").textContent = error.message;
    $("create").disabled = false;
  }
}

async function joinRoom() {
  const code = $("joinCode").value.trim().toUpperCase();

  if (!code) {
    $("lobbyMsg").textContent = "Hãy nhập mã phòng.";
    return;
  }

  $("lobbyMsg").className = "warn";
  $("lobbyMsg").textContent = "Đang kết nối...";
  $("join").disabled = true;

  try {
    ui.role = "client";
    ui.transport = makeTransport();
    ui.session = new ClientSession({ state: ui.state, transport: ui.transport });

    ui.session
      .on("welcome", () => { renderPlayers(ui.session.players); render(); })
      .on("update", () => { ui.selected = null; render(); })
      .on("players", renderPlayers)
      .on("rejected", message => log("Bị từ chối: " + message.error, "warn"))
      .on("closed", () => { setStatus("Mất kết nối với GM...", "bad"); log("Mất kết nối.", "bad"); })
      .on("reconnecting", n => { setStatus(`Đang nối lại (lần ${n})...`, "warn"); log(`Nối lại lần ${n}...`, "warn"); })
      .on("reconnected", () => { setStatus("Đã kết nối lại.", "ok"); log("Đã kết nối lại.", "ok"); })
      .on("failed", () => { setStatus("Không nối lại được. Hãy tải lại trang và vào lại.", "bad"); });

    await ui.session.join(code, playerName(), deviceKey());

    showRoom(code);
    setStatus("Đã vào phòng.", "ok");
    log(`Đã vào phòng ${code}.`, "ok");
  } catch (error) {
    ui.session?.leave();
    ui.session = null;
    $("lobbyMsg").className = "bad";
    $("lobbyMsg").textContent = error.message;
    $("join").disabled = false;
  }
}

$("diagnose").addEventListener("click", async () => {
  const box = $("diag");

  box.innerHTML = "";
  $("diagnose").disabled = true;

  await runDiagnostics({
    iceServers: [...DEFAULT_ICE_SERVERS, ...extraIceServers()],
    report: (text, level) => {
      const line = document.createElement("div");

      line.textContent = text;
      line.className = level;
      box.appendChild(line);
    }
  });

  $("diagnose").disabled = false;
});

$("create").addEventListener("click", () => { playerName(); createRoom(); });
$("join").addEventListener("click", joinRoom);
$("leave").addEventListener("click", () => location.reload());

$("endTurn").addEventListener("click", () => {
  const phase = ui.state.turn.phase;
  const result = ui.session.hostCommand({ type: "endTurn" }, phase);

  if (!result.ok) log(result.error, "warn");
});

$("reset").addEventListener("click", () => {
  ui.state.restore(newState().snapshot());
  ui.selected = null;
  ui.session.broadcastState();
  log("GM đã chơi lại ván.");
});

$("share").addEventListener("click", async () => {
  const code = $("code").textContent;
  const link = `${location.origin}${location.pathname}?room=${code}`;

  if (navigator.share) {
    try { await navigator.share({ title: "Vào phòng FE8", text: `Mã phòng: ${code}`, url: link }); return; } catch { /* người dùng hủy */ }
  }

  try {
    await navigator.clipboard.writeText(link);
    log("Đã sao chép link mời.", "ok");
  } catch {
    log("Link mời: " + link);
  }
});

$("team").addEventListener("change", () => { ui.selected = null; render(); });

/* ---------- khởi động ---------- */

$("name").value = localStorage.getItem("fe8_name") ?? "";
$("ice").value = localStorage.getItem("fe8_ice") ?? "";

const preset = new URLSearchParams(location.search).get("room");

if (preset) $("joinCode").value = preset.toUpperCase();
