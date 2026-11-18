import { DEFAULT_VOLUME } from "../../data/music.js";

/**
 * MUSIC SETTINGS
 * Âm lượng + tắt tiếng, nhớ giữa các lần mở game (localStorage).
 * Không biết gì về âm thanh thật: chỉ giữ giá trị và báo khi đổi (onChange).
 */

const KEY = "fe8-music-settings";

const clamp01 = n => Math.min(1, Math.max(0, Number(n) || 0));

export class MusicSettings {
  constructor(storage = globalThis.localStorage) {
    this.storage = storage;
    this.listeners = new Set();
    this.volume = DEFAULT_VOLUME;
    this.muted = false;

    this.load();
  }

  load() {
    try {
      const saved = JSON.parse(this.storage?.getItem(KEY) || "null");

      if (saved) {
        this.volume = clamp01(saved.volume ?? DEFAULT_VOLUME);
        this.muted = !!saved.muted;
      }
    } catch {
      // Trình duyệt chặn storage hoặc dữ liệu hỏng: dùng mặc định.
    }
  }

  save() {
    try {
      this.storage?.setItem(
        KEY,
        JSON.stringify({ volume: this.volume, muted: this.muted })
      );
    } catch {
      // Bỏ qua: chỉ mất việc ghi nhớ.
    }
  }

  // Âm lượng thực tế áp lên loa (0 khi tắt tiếng).
  get effectiveVolume() {
    return this.muted ? 0 : this.volume;
  }

  setVolume(value) {
    this.volume = clamp01(value);
    this.changed();
  }

  setMuted(muted) {
    this.muted = !!muted;
    this.changed();
  }

  toggleMuted() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  onChange(listener) {
    this.listeners.add(listener);

    return () => this.listeners.delete(listener);
  }

  changed() {
    this.save();
    this.listeners.forEach(fn => fn(this));
  }
}
