import { BATTLE_SFX, MUSIC_DUCK } from "../../data/sfx.js";

/**
 * BATTLE SFX
 * Cầu nối giữa BattleScene và SfxPlayer: biết một đòn đánh (hit/crit/miss)
 * thì phát tiếng nào. pickStrikeSfx là hàm thuần nên dễ sửa luật và dễ test.
 */
export function pickStrikeSfx(strike, map = BATTLE_SFX) {
  if (!strike) return null;

  if (!strike.hit) return map.miss ?? null;

  return (strike.crit ? map.crit : map.hit) ?? null;
}

export class BattleSfx {
  // ducker (tuỳ chọn): đối tượng có duck(level, ms), thường là MusicPlayer.
  constructor(player, ducker = null) {
    this.player = player;
    this.ducker = ducker;
  }

  // Gọi đúng khoảnh khắc va chạm của đòn đánh.
  strike(strike) {
    const id = pickStrikeSfx(strike);

    if (!id) return;

    this.ducker?.duck(MUSIC_DUCK.level, MUSIC_DUCK.ms);
    this.player.play(id);
  }
}
