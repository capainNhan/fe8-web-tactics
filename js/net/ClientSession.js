
import { MSG } from "./protocol.js";

/**
 * CLIENT SESSION (máy người chơi)
 * Giữ một bản sao trạng thái (chỉ để hiển thị), gửi lệnh cho GM và
 * cập nhật khi GM gửi trạng thái mới. Tự nối lại khi rớt mạng.
 *
 * Sự kiện (session.on): "welcome", "update", "rejected", "players",
 *                       "closed", "reconnecting", "reconnected", "failed".
 */
export class ClientSession {
  constructor({
    state,
    transport,
    autoReconnect = true,
    retryMs = 2000,
    maxRetries = 5
  }) {
    this.state = state;
    this.transport = transport;
    this.autoReconnect = autoReconnect;
    this.retryMs = retryMs;
    this.maxRetries = maxRetries;

    this.conn = null;
    this.playerId = null;
    this.players = [];
    this.listeners = {};
    this.seq = 0;
    this.leaving = false;
    this.credentials = null;
  }

  on(event, listener) {
    (this.listeners[event] ??= []).push(listener);

    return this;
  }

  emit(event, payload) {
    (this.listeners[event] ?? []).forEach(listener => listener(payload));
  }

  async join(code, name, key) {
    this.credentials = { code, name, key };
    this.leaving = false;

    await this.open();
  }

  open() {
    const { code, name, key } = this.credentials;

    return this.transport.connect(code).then(conn => {
      this.conn = conn;

      return new Promise((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error("GM không phản hồi.")),
          10000
        );

        conn.onMessage = message => {
          if (message.type === MSG.WELCOME) {
            clearTimeout(timer);
            this.handleWelcome(message);
            resolve();
            return;
          }

          if (message.type === MSG.FULL) {
            clearTimeout(timer);
            this.leaving = true;
            reject(new Error("Phòng đã đủ người."));
            return;
          }

          this.handleMessage(message);
        };

        conn.onClose = () => {
          clearTimeout(timer);
          this.handleClose(conn);
        };

        conn.send({ type: MSG.HELLO, name, key });
      });
    });
  }

  handleWelcome(message) {
    this.playerId = message.playerId;
    this.players = message.players;
    this.state.restore(message.snapshot);
    this.emit("welcome", message);
  }

  handleMessage(message) {
    switch (message.type) {
      case MSG.WELCOME:
        this.handleWelcome(message);
        break;

      case MSG.UPDATE:
        this.state.restore(message.snapshot);
        this.emit("update", message);
        break;

      case MSG.REJECTED:
        this.emit("rejected", message);
        break;

      case MSG.PLAYERS:
        this.players = message.players;
        this.emit("players", message.players);
        break;

      case MSG.PING:
        this.conn?.send({ type: MSG.PONG, t: message.t });
        break;
    }
  }

  handleClose(conn) {
    if (conn !== this.conn) return;

    this.emit("closed");

    if (this.autoReconnect && !this.leaving) {
      this.retry(1);
    }
  }

  retry(attempt) {
    if (this.leaving) return;

    if (attempt > this.maxRetries) {
      this.emit("failed");
      return;
    }

    this.emit("reconnecting", attempt);

    setTimeout(() => {
      if (this.leaving) return;

      this.open()
        .then(() => this.emit("reconnected"))
        .catch(() => this.retry(attempt + 1));
    }, this.retryMs);
  }

  sendCommand(command) {
    this.seq += 1;
    this.conn?.send({ type: MSG.COMMAND, seq: this.seq, command });

    return this.seq;
  }

  leave() {
    this.leaving = true;
    this.conn?.close();
    this.transport.close?.();
  }
}
