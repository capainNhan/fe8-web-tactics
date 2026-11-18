import { musicSettings } from "../audio/index.js";

/**
 * MUSIC TOGGLE
 * Nút bật/tắt nhạc + thanh âm lượng nhỏ, nằm ở HTML bên ngoài khung game
 * (không đụng tới Phaser). Gọi mountMusicToggle() một lần ở main.js.
 */
export function mountMusicToggle(parent = document.body) {
  const bar = document.createElement("div");

  bar.style.cssText =
    "display:flex;gap:10px;align-items:center;margin-top:8px;font-size:13px;";

  const button = document.createElement("button");

  button.style.cssText =
    "background:#0f0f1a;color:#fff;border:1px solid #4ecca3;padding:3px 10px;cursor:pointer;font-family:inherit;";

  const slider = document.createElement("input");

  slider.type = "range";
  slider.min = "0";
  slider.max = "100";
  slider.title = "Âm lượng nhạc";

  const refresh = () => {
    button.textContent = musicSettings.muted ? "🔇 Nhạc: Tắt" : "🔊 Nhạc: Bật";
    slider.value = String(Math.round(musicSettings.volume * 100));
  };

  button.addEventListener("click", () => musicSettings.toggleMuted());

  slider.addEventListener("input", () => {
    musicSettings.setVolume(slider.value / 100);

    if (musicSettings.muted) musicSettings.setMuted(false);
  });

  musicSettings.onChange(refresh);
  refresh();

  bar.append(button, slider);
  parent.append(bar);

  return bar;
}
