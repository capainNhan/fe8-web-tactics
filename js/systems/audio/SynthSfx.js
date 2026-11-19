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
function thump(ctx, dest, time, { peak, length, from, to, wave = "sine" }) {
  const osc = ctx.createOscillator();

  osc.type = wave;
  osc.frequency.setValueAtTime(from, time);
  osc.frequency.exponentialRampToValueAtTime(to, time + length);
  osc.connect(envelope(ctx, dest, time, peak, length));
  osc.start(time);
  osc.stop(time + length + 0.02);
}

// Tiếng đòn đập vào thân người: nhiễu bị lọc trầm, tắt nhanh -> nghe đục, "bịch", không ngân.
function body(ctx, dest, time, { peak, length, cutoff }) {
  const source = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();

  source.buffer = getNoise(ctx);
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(cutoff, time);
  filter.frequency.exponentialRampToValueAtTime(cutoff * 0.25, time + length);

  source.connect(filter).connect(envelope(ctx, dest, time, peak, length));
  source.start(time);
  source.stop(time + length + 0.02);
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

// Chém trúng: xẹt ngắn của lưỡi kiếm -> đòn đập đục vào thân (không có tiếng ngân kim loại).
function slash(ctx, dest, time) {
  swish(ctx, dest, time, { peak: 1.0, length: 0.07, from: 6000, to: 2200 });
  crack(ctx, dest, time + 0.045, { peak: 0.7, length: 0.03 });
  body(ctx, dest, time + 0.05, { peak: 2.4, length: 0.11, cutoff: 2600 });
  thump(ctx, dest, time + 0.05, { peak: 1.1, length: 0.1, from: 330, to: 75, wave: "square" });
}

// Chí mạng: cùng kiểu nhưng nặng hơn, có cú đập thứ hai và tiếng trầm sâu.
function slashCrit(ctx, dest, time) {
  swish(ctx, dest, time, { peak: 1.4, length: 0.1, from: 8000, to: 1800 });
  crack(ctx, dest, time + 0.07, { peak: 1.0, length: 0.04 });
  body(ctx, dest, time + 0.075, { peak: 3.0, length: 0.16, cutoff: 3000 });
  thump(ctx, dest, time + 0.075, { peak: 1.4, length: 0.16, from: 280, to: 55, wave: "square" });
  body(ctx, dest, time + 0.13, { peak: 1.6, length: 0.12, cutoff: 1800 });
  thump(ctx, dest, time + 0.075, { peak: 1.5, length: 0.3, from: 150, to: 38 });
}

export const SYNTH_SFX = {
  slash,
  slash_crit: slashCrit
};
