import { PRELOAD_TRACKS } from "../../data/music.js";
import { SFX, PRELOAD_SFX } from "../../data/sfx.js";
import { getContext } from "./AudioContextHub.js";
import { SfxPlayer } from "./SfxPlayer.js";
import { BattleSfx } from "./BattleSfx.js";
import { MusicSettings } from "./MusicSettings.js";
import { TrackLibrary } from "./TrackLibrary.js";
import { MusicPlayer } from "./MusicPlayer.js";
import { BattleMusic } from "./BattleMusic.js";
import { onFirstGesture } from "./AudioUnlock.js";

/**
 * AUDIO (điểm vào duy nhất của hệ thống âm thanh)
 * Ráp các module nhỏ lại với nhau. Scene khác chỉ import từ đây:
 *   attachBattleMusic(scene, data)  - gắn nhạc cho trận đánh
 *   preloadMusic()                  - tải sẵn nhạc và hiệu ứng lúc mở game
 *   playStrikeSfx(strike)           - tiếng chém trúng / chí mạng trong battle
 *   musicSettings                   - âm lượng / tắt tiếng (dùng cho nút bật tắt)
 */

export const musicSettings = new MusicSettings();
const library = new TrackLibrary(getContext);
const player = new MusicPlayer({ getContext, library, settings: musicSettings });
const battleMusic = new BattleMusic(player);

const sfxLibrary = new TrackLibrary(getContext, SFX);
const sfxPlayer = new SfxPlayer({ getContext, library: sfxLibrary, settings: musicSettings });
const battleSfx = new BattleSfx(sfxPlayer, player);

// Người chơi chạm lần đầu -> mở khoá âm thanh.
onFirstGesture(() => {
  if (getContext().state === "suspended") getContext().resume();
});

export function preloadMusic() {
  // Không chặn việc mở game: tải ngầm.
  library.preload(PRELOAD_TRACKS).catch(() => {});
  sfxLibrary.preload(PRELOAD_SFX).catch(() => {});
}

export function attachBattleMusic(scene, data) {
  // Âm thanh hỏng không được làm hỏng trận đánh.
  try {
    battleMusic.attach(scene, data);
  } catch (error) {
    console.warn("[Music] Không phát được nhạc battle:", error);
  }
}

// strike = đòn đã tính sẵn { hit, crit, ... }. Lỗi âm thanh không được làm hỏng trận đánh.
export function playStrikeSfx(strike) {
  try {
    battleSfx.strike(strike);
  } catch (error) {
    console.warn("[Sfx] Không phát được hiệu ứng:", error);
  }
}

export { player as musicPlayer, sfxPlayer };

// Tiện kiểm tra trong Console của trình duyệt (F12):
//   fe8Audio.getContext().state      -> phải là "running"
//   fe8Audio.sfxPlayer.play("slash_hit")  -> nghe thử tiếng chém
if (typeof window !== "undefined") {
  window.fe8Audio = { sfxPlayer, musicPlayer: player, getContext, musicSettings };
}
