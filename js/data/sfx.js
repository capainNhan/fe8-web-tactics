/**
 * SFX DATA
 * Chỉ khai báo dữ liệu hiệu ứng âm thanh, không có logic. Muốn thêm/sửa tiếng: sửa file này.
 *
 * Mỗi tiếng (SFX):
 *   files    : (tuỳ chọn) file riêng trong assets/audio/sfx/. Có file thì dùng file,
 *              để trống [] thì dùng tiếng tự tạo của game (xem fallback).
 *   volume   : độ to riêng 0..1
 *   fallback : id trong SYNTH_SFX (systems/audio/SynthSfx.js) phát khi không có file
 */

const DIR = "./assets/audio/sfx/";

export const SFX = {
  slash_hit: {
    label: "Chém trúng",
    files: [],            // ví dụ: [DIR + "slash_hit.ogg", DIR + "slash_hit.mp3"]
    volume: 0.9,
    fallback: "slash"
  },

  slash_crit: {
    label: "Chém chí mạng",
    files: [],            // ví dụ: [DIR + "slash_crit.ogg"]
    volume: 1,
    fallback: "slash_crit"
  }
};

// Kết quả một đòn -> tiếng nào (null = không phát). Muốn thêm tiếng trượt: miss: "slash_miss".
export const BATTLE_SFX = {
  hit: "slash_hit",
  crit: "slash_crit",
  miss: null
};

// Tiếng cần tải sẵn khi mở game (chỉ có tác dụng với tiếng có files).
export const PRELOAD_SFX = ["slash_hit", "slash_crit"];

// Hạ nhạc nền xuống tạm thời khi có tiếng đòn đánh để tiếng chém nghe rõ.
// level: nhạc còn bao nhiêu phần (0..1); ms: giữ trong bao lâu. level = 1 để tắt tính năng.
export const MUSIC_DUCK = { level: 0.35, ms: 280 };

// Độ to chung của hiệu ứng (0..1).
export const SFX_MASTER_VOLUME = 1;

export { DIR as SFX_DIR };
