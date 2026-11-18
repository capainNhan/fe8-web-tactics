
import { applyCommand } from "../core/Commands.js";
import {
  MSG,
  MAX_PLAYERS,
  TIMEOUT_MS,
  PLAYER_COMMANDS
} from "./protocol.js";

/**
 * HOST SESSION (máy GM)
 * Máy GM là "máy chủ": giữ trạng thái trận duy nhất, kiểm tra mọi lệnh,
 * tung xúc xắc rồi gửi kết quả cho cả phòng.
 *
 * Sự kiện (session.on): "update", "players", "log".
 */
export class HostSession {
  constructor({
    state,
    transport,
    code,
    rng = Math.random,
    now = () => Date.now()
  }) {
    this.state = state;
    this.transport = transport;
    this.code = code;
    this.rng = rng;
    this.now = now;

    this.players = new Map(); // playerId -> { id, key, name, conn, ping, lastSeen, connected }
    this.listeners = {};
    this.nextPlayerNumber = 1;
  }

  on(event, listener) {
    (this.listeners[event] ??= []).push(listener);

    return this;
  }

  emit(event, payload) {
    (this.listeners[event] ?? []).forEach(listener => listener(payload));
  }

  log(text) {
    this.emit("log", text);
  }

  async start() {
    await this.transport.listen(this.code);

    this.transport.onConnection = conn => this.accept(conn);
  }

  accept(conn) {
    conn.player = null;
    conn.onMessage = message => this.handleMessage(conn, message);
    conn.onClose = () => this.handleClose(conn);
  }

  publicPlayers() {
    return [...this.players.values()].map(p => ({
      id: p.id,
      name: p.name,
      connected: p.connected,
      ping: p.ping
    }));
  }

  broadcast(message) {
    for (const player of this.players.values()) {
      if (player.connected) player.conn.send(message);
    }
  }

  broadcastPlayers() {
    const players = this.publicPlayers();

    this.broadcast({ type: MSG.PLAYERS, players });
    this.emit("players", players);
  }

  handleMessage(conn, message) {
    if (!message || typeof message.type !== "string") return;

    if (message.type === MSG.HELLO) {
      this.handleHello(conn, message);
      return;
    }

    const player = conn.player;

    if (!player) return; // chưa chào hỏi thì bỏ qua

    player.lastSeen = this.now();

    if (message.type === MSG.PONG) {
      player.ping = Math.max(0, this.now() - message.t);
      this.broadcastPlayers();
      return;
    }

    if (message.type === MSG.COMMAND) {
      this.handlePlayerCommand(player, message);
    }
  }

  handleHello(conn, message) {
    const name = String(message.name ?? "").trim().slice(0, 20) || "Người chơi";
    const key = String(message.key ?? "");

    if (!key) return;

    let player = [...this.players.values()].find(p => p.key === key);

    if (player) {
      // Vào lại bằng cùng thiết bị: giữ nguyên danh tính, thay kết nối cũ.
      if (player.conn && player.conn !== conn) {
        player.conn.player = null;
        player.conn.close();
      }

      player.name = name;
      this.log(`${name} đã kết nối lại.`);
    } else {
      if (this.players.size >= MAX_PLAYERS) {
        conn.send({ type: MSG.FULL });
        conn.close();
        return;
      }

      player = {
        id: `u${this.nextPlayerNumber++}`,
        key,
        name,
        ping: null
      };

      this.players.set(player.id, player);
      this.log(`${name} đã vào phòng.`);
    }

    player.conn = conn;
    player.connected = true;
    player.lastSeen = this.now();
    conn.player = player;

    conn.send({
      type: MSG.WELCOME,
      playerId: player.id,
      snapshot: this.state.snapshot(),
      players: this.publicPlayers()
    });

    this.broadcastPlayers();
  }

  handleClose(conn) {
    const player = conn.player;

    if (!player || player.conn !== conn) return;

    player.connected = false;
    this.log(`${player.name} đã mất kết nối.`);
    this.broadcastPlayers();
  }

  handlePlayerCommand(player, message) {
    const command = message.command;

    if (!command || !PLAYER_COMMANDS.includes(command.type)) {
      player.conn.send({
        type: MSG.REJECTED,
        seq: message.seq,
        error: "Bạn không được dùng lệnh này."
      });

      return;
    }

    // `actor` luôn do host đặt, bỏ qua mọi giá trị người chơi tự gửi.
    const result = applyCommand(
      this.state,
      { ...command, actor: { team: "player", playerId: player.id } },
      this.rng
    );

    if (!result.ok) {
      player.conn.send({
        type: MSG.REJECTED,
        seq: message.seq,
        error: result.error
      });

      return;
    }

    this.broadcastUpdate(result.events, player.id);
  }

  // Lệnh do chính GM ra, có thể thay mặt bất kỳ phe nào.
  hostCommand(command, team) {
    const result = applyCommand(
      this.state,
      { ...command, actor: { team, playerId: "gm" } },
      this.rng
    );

    if (result.ok) this.broadcastUpdate(result.events, "gm");

    return result;
  }

  // Sau khi GM tự chỉnh trạng thái (ví dụ chơi lại ván), gửi lại cho mọi người.
  broadcastState(events = [{ type: "reset" }]) {
    this.broadcastUpdate(events, "gm");
  }

  broadcastUpdate(events, by) {
    const payload = {
      type: MSG.UPDATE,
      events,
      snapshot: this.state.snapshot(),
      by
    };

    this.broadcast(payload);
    this.emit("update", payload);
  }

  // Gọi định kỳ (mỗi 5 giây): gửi ping và phát hiện người chơi mất kết nối.
  tick() {
    const now = this.now();

    let changed = false;

    for (const player of this.players.values()) {
      if (!player.connected) continue;

      if (now - player.lastSeen > TIMEOUT_MS) {
        player.connected = false;
        this.log(`${player.name} không phản hồi, coi như mất kết nối.`);
        changed = true;
        continue;
      }

      player.conn.send({ type: MSG.PING, t: now });
    }

    if (changed) this.broadcastPlayers();
  }
}
