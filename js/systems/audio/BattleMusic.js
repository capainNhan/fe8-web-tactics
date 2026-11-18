import { pickBattleTrack } from "./BattleThemeSelector.js";
import { FADE } from "../../data/music.js";

/**
 * BATTLE MUSIC
 * Cầu nối giữa BattleScene và MusicPlayer: vào trận thì phát nhạc,
 * hết trận (scene đóng) thì mờ dần rồi dừng.
 * BattleScene chỉ cần gọi một dòng: attachBattleMusic(this, data).
 */
export class BattleMusic {
  constructor(player) {
    this.player = player;
  }

  start(attacker, defender) {
    this.player.play(
      pickBattleTrack(attacker, defender),
      { fadeIn: FADE.battleIn }
    );
  }

  stop() {
    this.player.stop({ fadeOut: FADE.battleOut });
  }

  // Gắn vòng đời nhạc vào một Phaser scene (tự dừng khi scene tắt).
  attach(scene, { attacker, defender }) {
    this.start(attacker, defender);

    scene.events.once("shutdown", () => this.stop());
    scene.events.once("destroy", () => this.stop());
  }
}
