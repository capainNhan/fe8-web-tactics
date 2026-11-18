/**
 * SYNTH BATTLE LOOP
 * Nhạc chiến đấu DỰ PHÒNG do game tự tạo (giai điệu gốc, 8-bit đơn giản),
 * chỉ phát khi thiếu file nhạc thật. Thay bằng nhạc của bạn bằng cách đặt file
 * vào assets/audio/bgm/ (không cần sửa code).
 */

const BPM = 150;
const STEP = 60 / BPM / 2; // nốt móc đơn

// Bước = số bán cung so với nốt gốc (null = nghỉ). Giai điệu và bè bass dài 16 bước.
const LEAD = [0, null, 3, 5, 7, null, 5, 3, 0, null, 3, 7, 10, 7, 5, 3];
const BASS = [-24, null, -24, null, -17, null, -17, null, -22, null, -22, null, -19, null, -19, null];
const ROOT_HZ = 220;

const hz = semitone => ROOT_HZ * Math.pow(2, semitone / 12);

export class SynthBattleLoop {
  constructor(context, destination) {
    this.ctx = context;
    this.out = destination;
    this.timer = null;
    this.step = 0;
    this.nextTime = 0;
  }

  start() {
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.05;
    this.timer = setInterval(() => this.schedule(), 50);
    this.schedule();
  }

  stop() {
    clearInterval(this.timer);
    this.timer = null;
  }

  // Xếp lịch trước ~0.2 giây để nhịp luôn đều.
  schedule() {
    while (this.nextTime < this.ctx.currentTime + 0.2) {
      const i = this.step % LEAD.length;

      if (LEAD[i] !== null) this.note("square", hz(LEAD[i]), this.nextTime, STEP * 0.9, 0.12);
      if (BASS[i] !== null) this.note("triangle", hz(BASS[i]), this.nextTime, STEP * 1.8, 0.2);

      this.nextTime += STEP;
      this.step++;
    }
  }

  note(type, freq, time, length, level) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.value = freq;

    gain.gain.setValueAtTime(level, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + length);

    osc.connect(gain).connect(this.out);
    osc.start(time);
    osc.stop(time + length + 0.02);
  }
}
