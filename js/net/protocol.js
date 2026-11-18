
/**
 * PROTOCOL
 * Các loại tin nhắn giữa GM (host) và người chơi (client), và các hằng số mạng.
 * Mọi tin nhắn là object JSON thuần có trường `type`.
 *
 *   client -> host : hello, command, pong
 *   host -> client : welcome, update, rejected, players, ping, full
 */

export const MSG = {
  HELLO: "hello",       // { name, key }          người chơi xin vào phòng
  WELCOME: "welcome",   // { playerId, snapshot, players }
  FULL: "full",         // phòng đã đủ người
  COMMAND: "command",   // { seq, command }        lệnh của người chơi
  UPDATE: "update",     // { events, snapshot, by }
  REJECTED: "rejected", // { seq, error }
  PLAYERS: "players",   // { players }
  PING: "ping",         // { t }
  PONG: "pong"          // { t }
};

export const MAX_PLAYERS = 10;
export const HEARTBEAT_MS = 5000;   // GM gửi ping mỗi 5 giây
export const TIMEOUT_MS = 20000;    // quá 20 giây không phản hồi thì coi là mất kết nối

// Người chơi chỉ được gửi các lệnh này; endTurn chỉ GM được dùng.
export const PLAYER_COMMANDS = ["move", "wait", "attack"];
