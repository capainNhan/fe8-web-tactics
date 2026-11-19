/**
 * SYNTH SFX
 * Các hiệu ứng do game tự tạo bằng WebAudio (âm thanh gốc, không dùng file).
 * Mỗi hàm nhận (ctx, destination, time) và tự xếp lịch phát; thêm tiếng mới = thêm một hàm
 * vào SYNTH_SFX rồi khai báo trong data/sfx.js.
 */

let noiseBuffer = null;

function getNoise(ctx) {
  if (!noiseBuffer || noiseBuffer.sampleRate !== ctx.sampleRate) {
    noiseBuffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.5), ctx.sampleRate);

    const data = noiseBuffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }

  return noiseBuffer;
}

// Gói biên độ: lên nhanh, tắt theo hàm mũ.
function envelope(ctx, dest, time, peak, length) {
  const gain = ctx.createGain();

  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(peak, time + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + length);
  gain.connect(dest);

  return gain;
}

// Tiếng gió rít của lưỡi kiếm: nhiễu qua bộ lọc quét từ cao xuống thấp.
function swish(ctx, dest, time, { peak, length, from, to }) {
  const source = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();

  source.buffer = getNoise(ctx);
  filter.type = "bandpass";
  filter.Q.value = 1.2;
  filter.frequency.setValueAtTime(from, time);
  filter.frequency.exponentialRampToValueAtTime(to, time + length);

  source.connect(filter).connect(envelope(ctx, dest, time, peak, length));
  source.start(time);
  source.stop(time + length + 0.02);
}

// Tiếng kim loại ngân ngắn khi lưỡi kiếm chạm.
function ring(ctx, dest, time, freqs, peak, length) {
  const bus = envelope(ctx, dest, time, peak, length);

  for (const freq of freqs) {
    const osc = ctx.createOscillator();

    osc.type = "triangle";
    osc.frequency.value = freq;
    osc.connect(bus);
    osc.start(time);
    osc.stop(time + length + 0.02);
  }
}

// Cú "thịch" trầm khi đòn trúng thân.
function thump(ctx, dest, time, { peak, length, from, to }) {
  const osc = ctx.createOscillator();

  osc.type = "sine";
  osc.frequency.setValueAtTime(from, time);
  osc.frequency.exponentialRampToValueAtTime(to, time + length);
  osc.connect(envelope(ctx, dest, time, peak, length));
  osc.start(time);
  osc.stop(time + length + 0.02);
}

// Tiếng "tách" sắc ở đầu đòn: nghe rõ cả trên loa nhỏ, giúp tiếng chém nổi lên trên nhạc.
function crack(ctx, dest, time, { peak, length }) {
  const source = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();

  source.buffer = getNoise(ctx);
  filter.type = "highpass";
  filter.frequency.value = 2500;

  source.connect(filter).connect(envelope(ctx, dest, time, peak, length));
  source.start(time);
  source.stop(time + length + 0.02);
}

function slash(ctx, dest, time) {
  crack(ctx, dest, time, { peak: 1.0, length: 0.05 });
  swish(ctx, dest, time, { peak: 1.8, length: 0.16, from: 7000, to: 1500 });
  ring(ctx, dest, time + 0.02, [1850, 2740], 0.3, 0.2);
  thump(ctx, dest, time + 0.015, { peak: 0.9, length: 0.14, from: 260, to: 80 });
}

function slashCrit(ctx, dest, time) {
  crack(ctx, dest, time, { peak: 1.3, length: 0.07 });
  swish(ctx, dest, time, { peak: 2.2, length: 0.24, from: 9000, to: 900 });
  ring(ctx, dest, time + 0.02, [1500, 2200, 3300], 0.4, 0.38);
  thump(ctx, dest, time + 0.015, { peak: 1.2, length: 0.26, from: 200, to: 60 });
  swish(ctx, dest, time + 0.03, { peak: 0.9, length: 0.16, from: 3500, to: 600 });
}

export const SYNTH_SFX = {
  slash,
  slash_crit: slashCrit
};
