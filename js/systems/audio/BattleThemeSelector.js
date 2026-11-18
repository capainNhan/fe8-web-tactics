import { BATTLE_THEMES } from "../../data/music.js";

/**
 * BATTLE THEME SELECTOR
 * Hàm thuần: chọn bài nhạc cho một trận đánh. Không đụng tới âm thanh hay Phaser,
 * nên dễ sửa luật chọn nhạc và dễ viết test.
 *
 * Thứ tự ưu tiên:
 *   1. unit.battleTheme (gán thẳng id bài cho riêng một nhân vật)
 *   2. unit.boss === true  -> BATTLE_THEMES.boss
 *   3. theo phe của bên tấn công -> BATTLE_THEMES.player / enemy
 *   4. BATTLE_THEMES.default
 */
export function pickBattleTrack(attacker, defender, themes = BATTLE_THEMES) {
  const custom = [attacker, defender].find(u => u?.battleTheme)?.battleTheme;

  if (custom) return custom;

  if (attacker?.boss || defender?.boss) return themes.boss ?? themes.default;

  return themes[attacker?.team] ?? themes.default;
}
