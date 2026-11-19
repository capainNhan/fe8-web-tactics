/**
 * AUDIO CONTEXT HUB
 * Một AudioContext dùng chung cho cả nhạc nền và hiệu ứng.
 * Tạo lười (chưa tạo ở lúc import); trước cử chỉ đầu tiên của người chơi nó ở
 * trạng thái "suspended" và được mở bởi AudioUnlock.
 */

let context = null;

export function getContext() {
  if (!context) {
    context = new (globalThis.AudioContext || globalThis.webkitAudioContext)();
  }

  return context;
}
