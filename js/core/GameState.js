
import { TurnManager } from "../systems/TurnManager.js";

/**
 * GAME STATE
 * Toàn bộ trạng thái một trận: đơn vị, địa hình, lượt.
 * Không dùng Phaser, không biết gì về giao diện hay mạng.
 * Mọi thay đổi đi qua applyCommand (core/Commands.js).
 */
export class GameState {
  constructor({ units, terrainMap }) {
    this.units = units;
    this.terrainMap = terrainMap;

    this.turn = new TurnManager();
    this.turn.resetUnits(this.units);
  }

  unitById(id) {
    return this.units.find(u => u.id === id) ?? null;
  }

  /**
   * Ảnh chụp trạng thái dạng JSON thuần (để lưu ván hoặc gửi qua mạng).
   * Địa hình không nằm trong snapshot vì lấy từ dữ liệu bản đồ.
   */
  snapshot() {
    return JSON.parse(JSON.stringify({
      turn: this.turn.turn,
      phase: this.turn.phase,
      units: this.units
    }));
  }

  restore(snapshot) {
    const data = JSON.parse(JSON.stringify(snapshot));

    this.turn.turn = data.turn;
    this.turn.phase = data.phase;
    this.units.length = 0;
    this.units.push(...data.units);
  }
}
