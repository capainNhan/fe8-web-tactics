
/**
 * RNG tiêm được: luật chơi nhận một hàm rng() trả số trong [0, 1).
 * Mặc định Math.random. Dùng createRng(seed) để có kết quả lặp lại được
 * (test, hoặc sau này để GM và người chơi cùng tái hiện một trận).
 */
export function createRng(seed = 1) {
  let a = seed >>> 0;

  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;

    let t = a;

    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
