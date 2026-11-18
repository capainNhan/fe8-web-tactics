import { PRELOAD_TRACKS } from "../../data/music.js";
import { MusicSettings } from "./MusicSettings.js";
import { TrackLibrary } from "./TrackLibrary.js";
import { MusicPlayer } from "./MusicPlayer.js";
import { BattleMusic } from "./BattleMusic.js";
import { onFirstGesture } from "./AudioUnlock.js";

/**
 * AUDIO (điểm vào duy nhất của hệ thống âm thanh)
 * Ráp các module nhỏ lại với nhau. Scene khác chỉ import từ đây:
 *   attachBattleMusic(scene, data)  - gắn nhạc cho trận đánh
 *   preloadMusic()                  - tải sẵn nhạc lúc mở game
 *   musicSettings                   - âm lượng / tắt tiếng (dùng cho nút bật tắt)
 */

let context = null;

// AudioContext tạo lười; tạo trước cử chỉ đầu tiên thì ở trạng thái "suspended".
function getContext() {
  if (!context) {
    context = new (globalThis.AudioContext || globalThis.webkitAudioContext)();
  }

  return context;
}

export const musicSettings = new MusicSettings();
const library = new TrackLibrary(getContext);
const player = new MusicPlayer({ getContext, library, settings: musicSettings });
const battleMusic = new BattleMusic(player);

// Người chơi chạm lần đầu -> mở khoá âm thanh.
onFirstGesture(() => {
  if (getContext().state === "suspended") getContext().resume();
});

export function preloadMusic() {
  // Không chặn việc mở game: tải ngầm.
  library.preload(PRELOAD_TRACKS).catch(() => {});
}

export function attachBattleMusic(scene, data) {
  // Âm thanh hỏng không được làm hỏng trận đánh.
  try {
    battleMusic.attach(scene, data);
  } catch (error) {
    console.warn("[Music] Không phát được nhạc battle:", error);
  }
}

export { player as musicPlayer };
