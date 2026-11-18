# Nhạc nền (BGM)

Đặt file nhạc của bạn vào thư mục này với đúng tên (ogg hoặc mp3, ưu tiên ogg):

| Tên file | Khi nào phát |
|---|---|
| `battle_player.ogg` | Trận do phe người chơi tấn công |
| `battle_enemy.ogg`  | Trận do phe địch tấn công |
| `battle_boss.ogg`   | Có unit gắn `boss: true` |

Thiếu file nào thì game tự phát nhạc 8-bit dự phòng cho bài đó.

Nhạc GBA thường có đoạn mở đầu rồi mới lặp: chỉnh `loopStart` / `loopEnd` (giây)
trong `js/data/music.js` để vòng lặp khớp.

Lưu ý bản quyền: nhạc Fire Emblem thuộc Nintendo/Intelligent Systems. Chỉ dùng
file bạn có quyền dùng, và đừng đưa chúng lên repo công khai.
