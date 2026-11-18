/**
 * MUSIC DATA
 * Chỉ khai báo dữ liệu nhạc, không có logic. Muốn thêm/sửa bài: chỉ sửa file này.
 *
 * Mỗi bài (TRACKS):
 *   files     : danh sách file thử lần lượt (ogg trước, mp3 dự phòng) trong assets/audio/bgm/
 *   loopStart : giây bắt đầu đoạn lặp (nhạc GBA thường có phần mở đầu rồi mới lặp)
 *   loopEnd   : giây kết thúc đoạn lặp (null = hết bài)
 *   volume    : độ to riêng của bài, 0..1 (cân bằng giữa các bài)
 *   fallback  : "synth" = nếu thiếu file thì phát bản nhạc tự tạo sẵn trong game
 *
 * File nhạc KHÔNG đi kèm dự án: hãy tự đặt file của bạn vào assets/audio/bgm/
 * với đúng tên bên dưới (xem assets/audio/bgm/README.md).
 */

const BGM = "./assets/audio/bgm/";

export const TRACKS = {
  battle_player: {
    label: "Battle - phe ta tấn công",
    files: [BGM + "battle_player.ogg", BGM + "battle_player.mp3"],
    loopStart: 0,
    loopEnd: null,
    volume: 0.8,
    fallback: "synth"
  },

  battle_enemy: {
    label: "Battle - phe địch tấn công",
    files: [BGM + "battle_enemy.ogg", BGM + "battle_enemy.mp3"],
    loopStart: 0,
    loopEnd: null,
    volume: 0.8,
    fallback: "synth"
  },

  battle_boss: {
    label: "Battle - boss",
    files: [BGM + "battle_boss.ogg", BGM + "battle_boss.mp3"],
    loopStart: 0,
    loopEnd: null,
    volume: 0.8,
    fallback: "synth"
  }
};

// Bài nào dùng cho tình huống nào (đọc bởi BattleThemeSelector).
export const BATTLE_THEMES = {
  player: "battle_player", // bên tấn công là phe người chơi
  enemy: "battle_enemy",   // bên tấn công là phe địch
  boss: "battle_boss",     // một trong hai bên có unit.boss === true
  default: "battle_player"
};

// Thời gian mờ dần (ms).
export const FADE = {
  battleIn: 400,
  battleOut: 600
};

// Bài cần tải sẵn lúc mở game để vào trận không bị trễ.
export const PRELOAD_TRACKS = ["battle_player", "battle_enemy"];

// Âm lượng mặc định (0..1).
export const DEFAULT_VOLUME = 0.7;
