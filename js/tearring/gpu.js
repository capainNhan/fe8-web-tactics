/**
 * gpu.js - VRAM 1024x512 và bộ rasterize gói GPU (SPRT_8, POLY_FT4, POLY_F3, DR_MODE, DR_AREA).
 * Đây KHÔNG phải mã của game (game gửi gói cho GPU thật); logic lấy mẫu texture/trộn màu theo
 * đúng đặc tả GPU PS1 và trùng với bộ rasterize của export_anim.py để đối chiếu từng pixel.
 *
 * Hai chế độ đầu ra:
 *   "layer"    : RGBA nền trong suốt, trộn bán trong suốt xấp xỉ bằng alpha (như export_anim.py)
 *   "backdrop" : trộn CHUẨN PS1 (B/2+F/2, B+F, B-F, B+F/4) lên ảnh nền do bạn cấp (RGBA 8 bit)
 */
export class Vram {
  constructor() { this.hw = new Uint16Array(1024 * 512); }
  loadImage(x, y, w, h, src) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.hw[(y + j) * 1024 + x + i] = src[j * w + i];
  }
}

const c555 = v => {
  const r = v & 31, g = (v >> 5) & 31, b = (v >> 10) & 31;
  return [(r << 3) | (r >> 2), (g << 3) | (g >> 2), (b << 3) | (b >> 2)];
};
const f32 = Math.fround;

class Canvas {
  constructor(W, H, ox, oy, mode, backdrop) {
    this.W = W; this.H = H; this.ox = ox; this.oy = oy; this.mode = mode;
    this.abr = new Set();
    if (mode === "layer") this.p = new Float32Array(W * H * 4);
    else {
      this.px = new Uint8ClampedArray(W * H * 4);
      if (backdrop) this.px.set(backdrop); else for (let i = 3; i < this.px.length; i += 4) this.px[i] = 255;
    }
  }
  put(x, y, rgb, abr) {
    x += this.ox; y += this.oy;
    if (!(x >= 0 && x < this.W && y >= 0 && y < this.H)) return;
    const o = (y * this.W + x) * 4, r = rgb[0], g = rgb[1], b = rgb[2];
    if (this.mode === "layer") {
      const p = this.p;
      if (abr === null) { p[o] = r; p[o + 1] = g; p[o + 2] = b; p[o + 3] = 255; }
      else if (abr === 0) {
        p[o] = r * .5 + p[o] * .5; p[o + 1] = g * .5 + p[o + 1] * .5; p[o + 2] = b * .5 + p[o + 2] * .5;
        p[o + 3] = 127.5 + p[o + 3] * .5;
      } else if (abr === 1 || abr === 3) {
        const k = abr === 1 ? 1 : 0.25;
        const s0 = Math.min(255, p[o] + r * k), s1 = Math.min(255, p[o + 1] + g * k), s2 = Math.min(255, p[o + 2] + b * k);
        const a = p[o + 3] > 0 ? p[o + 3] : Math.max(s0, s1, s2);
        p[o] = s0; p[o + 1] = s1; p[o + 2] = s2; p[o + 3] = a;
      } else if (p[o + 3] > 0) {
        p[o] = Math.max(0, p[o] - r); p[o + 1] = Math.max(0, p[o + 1] - g); p[o + 2] = Math.max(0, p[o + 2] - b);
      }
    } else {
      const p = this.px;
      if (abr === null) { p[o] = r; p[o + 1] = g; p[o + 2] = b; }
      else if (abr === 0) { p[o] = (p[o] + r) >> 1; p[o + 1] = (p[o + 1] + g) >> 1; p[o + 2] = (p[o + 2] + b) >> 1; }
      else if (abr === 1) { p[o] += r; p[o + 1] += g; p[o + 2] += b; }
      else if (abr === 2) { p[o] -= r; p[o + 1] -= g; p[o + 2] -= b; }
      else { p[o] += r >> 2; p[o + 1] += g >> 2; p[o + 2] += b >> 2; }
    }
  }
  /** RGBA 8 bit (straight alpha) -- giống Canvas.image() của exporter (cùng làm tròn float32). */
  image() {
    if (this.mode !== "layer") return this.px;
    const out = new Uint8Array(this.W * this.H * 4), p = this.p;
    const q = v => Math.floor(Math.min(255, Math.max(0, f32(v + .5))));
    for (let i = 0; i < this.W * this.H; i++) {
      const o = i * 4, a = p[o + 3];
      for (let k = 0; k < 3; k++) out[o + k] = q(a > 0 ? f32(f32(p[o + k] / Math.max(a, f32(1e-6))) * 255) : 0);
      out[o + 3] = q(a);
    }
    return out;
  }
}

export class Gpu {
  /**
   * @param vram  Vram
   * @param o     { width, height, ox, oy, mode: "layer"|"backdrop", backdrop: Uint8 RGBA, clip: bool }
   *              ox/oy: vị trí gốc PSX (0,0) trong bộ đệm (mặc định 0)
   */
  constructor(vram, o = {}) {
    this.vram = vram.hw;
    this.tpage = 0;
    this.clipOn = !!o.clip;
    this.clip = null;
    this.canvas = new Canvas(o.width ?? 320, o.height ?? 240, o.ox ?? 0, o.oy ?? 0, o.mode ?? "layer", o.backdrop);
    this.counts = { SPRT_8: 0, POLY_FT4: 0, POLY_F3: 0 };
  }

  texel(tpage, clut, u, v) {
    const tx = (tpage & 0xf) * 64, ty = ((tpage >> 4) & 1) * 256;
    const hw = this.vram[(((ty + (v & 255)) % 512) * 1024) + tx + ((u & 255) >> 1)];
    const idx = (hw >> (8 * (u & 1))) & 0xff;
    return this.vram[(clut >> 6) * 1024 + (clut & 0x3f) * 16 + idx];
  }

  shade(tex, rgb, raw) {
    const c = c555(tex);
    if (raw) return c;
    return [Math.min(255, Math.floor(c[0] * rgb[0] / 128)), Math.min(255, Math.floor(c[1] * rgb[1] / 128)),
            Math.min(255, Math.floor(c[2] * rgb[2] / 128))];
  }

  plot(x, y, col, abr) {
    const c = this.clip;
    if (this.clipOn && c && (x < c.x || y < c.y || x >= c.x + c.w || y >= c.y + c.h)) return;
    this.canvas.put(x, y, col, abr);
    if (abr !== null) this.canvas.abr.add(abr);
  }

  sprt8(p) {
    const semi = !!(p.code & 2), abr = (this.tpage >> 5) & 3;
    this.counts.SPRT_8++;
    for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) {
      const t = this.texel(this.tpage, p.clut, p.u + i, p.v + j);
      if (t === 0) continue;
      this.plot(p.x + i, p.y + j, this.shade(t, p.rgb, p.code & 1), semi && (t & 0x8000) ? abr : null);
    }
  }

  tri(v, uv, rgb, raw, tpage, clut, semi, tex = true) {
    const [[x0, y0], [x1, y1], [x2, y2]] = v;
    const den = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2);
    if (den === 0) return;
    const abr = (tpage >> 5) & 3;
    const ya = Math.floor(Math.min(y0, y1, y2)), yb = Math.ceil(Math.max(y0, y1, y2));
    const xa = Math.floor(Math.min(x0, x1, x2)), xb = Math.ceil(Math.max(x0, x1, x2));
    for (let py = ya; py <= yb; py++) for (let px = xa; px <= xb; px++) {
      const cx = px + 0.5, cy = py + 0.5;
      const a = ((y1 - y2) * (cx - x2) + (x2 - x1) * (cy - y2)) / den;
      const b = ((y2 - y0) * (cx - x2) + (x0 - x2) * (cy - y2)) / den;
      const c = 1 - a - b;
      if (a < 0 || b < 0 || c < 0) continue;
      let col, stp;
      if (tex) {
        const u = a * uv[0][0] + b * uv[1][0] + c * uv[2][0];
        const w = a * uv[0][1] + b * uv[1][1] + c * uv[2][1];
        const t = this.texel(tpage, clut, Math.floor(u), Math.floor(w));
        if (t === 0) continue;
        col = this.shade(t, rgb, raw); stp = !!(t & 0x8000);
      } else { col = rgb; stp = true; }
      this.plot(px, py, col, semi && stp ? abr : null);
    }
  }

  ft4(p) {
    const uv = p.uv, xy = p.xy;
    const span = Math.max(Math.abs(uv[1][0] - uv[0][0]), Math.abs(uv[2][1] - uv[0][1]), 1);
    const scale = (span === 7 || span === 8) ? 8 / span : 1;
    const uvf = uv.map(([u0, v0]) => [u0 + (u0 - uv[0][0]) * (scale - 1), v0 + (v0 - uv[0][1]) * (scale - 1)]);
    const semi = !!(p.code & 2);
    this.counts.POLY_FT4++;
    this.tri([xy[0], xy[1], xy[2]], [uvf[0], uvf[1], uvf[2]], p.rgb, p.code & 1, p.tpage, p.clut, semi);
    this.tri([xy[1], xy[2], xy[3]], [uvf[1], uvf[2], uvf[3]], p.rgb, p.code & 1, p.tpage, p.clut, semi);
  }

  f3(p) {
    this.counts.POLY_F3++;
    this.tri(p.xy, null, p.rgb, 1, this.tpage, 0, !!(p.code & 2), false);
  }

  /** Chạy OT: slot thấp trước; trong một slot, gói chèn sau (cuối mảng) chạy trước. */
  run(F) {
    for (let s = 0; s < F.ot.length; s++) {
      const list = F.ot[s];
      if (!list) continue;
      for (let i = list.length - 1; i >= 0; i--) {
        const p = list[i];
        switch (p.k) {
          case "tpage": this.tpage = p.tpage & 0x9ff; break;
          case "sprt8": this.sprt8(p); break;
          case "ft4": this.ft4(p); break;
          case "f3": this.f3(p); break;
          case "area": this.clip = p; break;
        }
      }
    }
    return this;
  }
}
