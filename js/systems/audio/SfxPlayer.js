import { SFX, SFX_MASTER_VOLUME } from "../../data/sfx.js";
import { SYNTH_SFX } from "./SynthSfx.js";

/**
 * SFX PLAYER
 * Phát một hiệu ứng ngắn theo id (kiểu "bắn và quên", nhiều tiếng chồng nhau được).
 * Có file trong data/sfx.js thì dùng file, không thì dùng tiếng tự tạo (SynthSfx).
 * Chỉ biết "phát tiếng X" — không biết gì về trận đánh.
 *
 * Phụ thuộc truyền từ ngoài để dễ thay/dễ test:
 *   getContext : () => AudioContext
 *   library    : TrackLibrary (dựng trên bảng SFX)
 *   settings   : MusicSettings (dùng để tôn trọng nút tắt tiếng)
 */
export class SfxPlayer {
  constructor({
    getContext,
    library,
    settings,
    sfx = SFX,
    synths = SYNTH_SFX,
    masterVolume = SFX_MASTER_VOLUME
  }) {
    this.getContext = getContext;
    this.library = library;
    this.settings = settings;
    this.sfx = sfx;
    this.synths = synths;
    this.masterVolume = masterVolume;
  }

  async play(id) {
    const def = this.sfx[id];

    if (!def || this.settings.muted) return;

    const ctx = this.getContext();
    const buffer = def.files?.length ? await this.library.get(id) : null;

    // Tắt tiếng trong lúc chờ tải.
    if (this.settings.muted) return;

    // Nếu trình duyệt còn đang chặn âm thanh thì thử mở lại (chỉ thành công sau khi người chơi đã chạm).
    if (ctx.state === "suspended") ctx.resume?.();

    const out = ctx.createGain();

    out.gain.value = this.masterVolume * (def.volume ?? 1);

    // Nén nhẹ để các lớp tiếng cộng lại không bị rè khi to.
    const limiter = ctx.createDynamicsCompressor?.();

    if (limiter) {
      out.connect(limiter);
      limiter.connect(ctx.destination);
    } else {
      out.connect(ctx.destination);
    }

    if (buffer) {
      const source = ctx.createBufferSource();

      source.buffer = buffer;
      source.connect(out);
      source.onended = () => { out.disconnect(); limiter?.disconnect(); };
      source.start();

    } else if (this.synths[def.fallback]) {
      this.synths[def.fallback](ctx, out, ctx.currentTime);

      // Các node tự dừng; gỡ gain tổng sau khi tiếng tắt hẳn.
      setTimeout(() => { out.disconnect(); limiter?.disconnect(); }, 1000);

    } else {
      out.disconnect();
      limiter?.disconnect();
    }
  }
}
