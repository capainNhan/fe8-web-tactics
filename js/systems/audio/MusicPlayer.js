import { TRACKS } from "../../data/music.js";
import { SynthBattleLoop } from "./SynthBattleLoop.js";

/**
 * MUSIC PLAYER
 * Phát một bài nhạc nền tại một thời điểm, lặp mượt theo loopStart/loopEnd,
 * có mờ vào/mờ ra. Chỉ biết "phát bài X" / "dừng" — không biết gì về trận đánh.
 *
 * Phụ thuộc (truyền vào từ bên ngoài để dễ thay/dễ test):
 *   getContext : () => AudioContext
 *   library    : TrackLibrary
 *   settings   : MusicSettings
 */
export class MusicPlayer {
  constructor({ getContext, library, settings, tracks = TRACKS }) {
    this.getContext = getContext;
    this.library = library;
    this.settings = settings;
    this.tracks = tracks;

    this.current = null; // { id, source, synth, gain, trackGain }
    this.requestId = 0;  // chống chạy lộn khi gọi play/stop liên tiếp

    settings.onChange(() => this.applyVolume());
  }

  get playingId() {
    return this.current?.id ?? null;
  }

  async play(id, { fadeIn = 400 } = {}) {
    const track = this.tracks[id];

    if (!track) return;
    if (this.current?.id === id) return;

    const ticket = ++this.requestId;

    this.stop({ fadeOut: 150 });

    const ctx = this.getContext();
    const buffer = await this.library.get(id);

    // Trong lúc chờ tải, có lệnh khác tới (đổi bài/dừng) -> bỏ lệnh này.
    if (ticket !== this.requestId) return;

    const master = ctx.createGain();
    const trackGain = ctx.createGain();

    trackGain.gain.value = track.volume ?? 1;
    master.gain.value = 0;
    trackGain.connect(master).connect(ctx.destination);

    const entry = { id, master, trackGain, source: null, synth: null };

    if (buffer) {
      const source = ctx.createBufferSource();

      source.buffer = buffer;
      source.loop = true;
      source.loopStart = track.loopStart ?? 0;
      source.loopEnd = track.loopEnd ?? buffer.duration;
      source.connect(trackGain);
      source.start(0);

      entry.source = source;

    } else if (track.fallback === "synth") {
      entry.synth = new SynthBattleLoop(ctx, trackGain);
      entry.synth.start();

    } else {
      return;
    }

    this.current = entry;
    this.fadeTo(entry, this.settings.effectiveVolume, fadeIn);
  }

  stop({ fadeOut = 600 } = {}) {
    const entry = this.current;

    if (!entry) return;

    this.requestId++;
    this.current = null;

    const ctx = this.getContext();

    this.fadeTo(entry, 0, fadeOut);

    setTimeout(() => {
      try {
        entry.source?.stop();
        entry.synth?.stop();
        entry.master.disconnect();
      } catch {
        // Đã dừng rồi.
      }
    }, fadeOut + 80);
  }

  // Hạ nhạc tạm thời (để hiệu ứng nổi lên) rồi trả lại âm lượng cũ.
  duck(level = 0.35, ms = 280) {
    const entry = this.current;

    if (!entry || level >= 1) return;

    this.fadeTo(entry, this.settings.effectiveVolume * level, 20);

    clearTimeout(this.duckTimer);
    this.duckTimer = setTimeout(() => {
      if (this.current === entry) this.fadeTo(entry, this.settings.effectiveVolume, 250);
    }, ms);
  }

  applyVolume() {
    if (this.current) {
      this.fadeTo(this.current, this.settings.effectiveVolume, 80);
    }
  }

  fadeTo(entry, value, ms) {
    const param = entry.master.gain;
    const now = this.getContext().currentTime;

    param.cancelScheduledValues(now);
    param.setValueAtTime(param.value, now);
    param.linearRampToValueAtTime(value, now + Math.max(0.01, ms / 1000));
  }
}
