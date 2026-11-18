# Nhạc & âm thanh

Mỗi phần là một module riêng trong `js/systems/audio/`:

| Việc cần làm | File |
|---|---|
| Thêm/sửa bài, điểm lặp, âm lượng từng bài, thời gian mờ | `js/data/music.js` |
| Đổi luật chọn bài cho trận đánh (boss, theo phe, theo nhân vật) | `js/systems/audio/BattleThemeSelector.js` |
| Gắn nhạc vào vòng đời trận đánh | `js/systems/audio/BattleMusic.js` |
| Phát/lặp/mờ vào-ra một bài | `js/systems/audio/MusicPlayer.js` |
| Tải + giải mã file, nhớ đệm | `js/systems/audio/TrackLibrary.js` |
| Nhạc dự phòng khi thiếu file | `js/systems/audio/SynthBattleLoop.js` |
| Âm lượng / tắt tiếng (lưu localStorage) | `js/systems/audio/MusicSettings.js` |
| Mở khoá âm thanh khi chạm lần đầu | `js/systems/audio/AudioUnlock.js` |
| Nút bật/tắt + thanh âm lượng | `js/systems/ui/MusicToggle.js` |
| Điểm vào duy nhất để scene gọi | `js/systems/audio/index.js` |

Điểm móc vào game chỉ có 3 dòng: `BattleScene.create()` (attachBattleMusic),
`BootScene.preload()` (preloadMusic), `main.js` (mountMusicToggle).

## Thêm bài mới
1. Thả file vào `assets/audio/bgm/`.
2. Thêm mục vào `TRACKS` trong `js/data/music.js`.
3. Gán cho nhân vật: `battleTheme: "id_bai"` trong `js/data/units.js`,
   hoặc đổi `BATTLE_THEMES`.

## Thêm loại nhạc khác (nhạc bản đồ, thắng/thua...)
Tạo module mới cạnh `BattleMusic.js` (ví dụ `MapMusic.js`) dùng chung `musicPlayer`
xuất từ `index.js`; không cần sửa các module còn lại.
