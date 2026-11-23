/**
 * psx.js - số học 32-bit kiểu PS1 + mô hình GTE tối thiểu + ngăn xếp ma trận của game.
 * Port của: libgte_min.c (SetRotMatrix, MulMatrix, ScaleMatrix, RotMatrix, RotTransSV)
 *           tm_matrix.c  (BtlMat*), btl_anim_types.h (MATRIX).
 * Mọi phép nhân là int32 quấn vòng (Math.imul) đúng như mã máy gốc.
 */
export const s8 = x => (x << 24) >> 24;
export const s16 = x => (x << 16) >> 16;
export const u16 = x => x & 0xffff;
export const mul = Math.imul;

export class Mat {
  constructor() {
    this.m = new Int16Array(9);   // m[i*3 + j], gán vào Int16Array tự quấn 16 bit như (short)
    this.t = new Int32Array(3);
  }
  copyFrom(o) { this.m.set(o.m); this.t.set(o.t); return this; }
}

const sat = v => (v > 32767 ? 32767 : v < -32768 ? -32768 : v);

/** MVMVA sf=1, lm=0: ir = sat(((tr << 12) + rt * v) >> 12). Trả [ir1, ir2, ir3]. */
function mvmva(rt, tr, vx, vy, vz, out) {
  for (let i = 0; i < 3; i++) {
    const sum = (tr ? tr[i] * 4096 : 0) + rt[i * 3] * vx + rt[i * 3 + 1] * vy + rt[i * 3 + 2] * vz;
    out[i] = sat(Math.floor(sum / 4096) | 0);
  }
}

/** Trạng thái toàn cục của phần vẽ (ma trận hiện tại, ma trận gốc, thanh ghi GTE). */
export class MatStack {
  constructor(rsincos) {
    this.rs = rsincos;          // Uint32Array(4096): lo16 = sin, hi16 = cos (g_rsincos)
    this.cur = new Mat();       // *g_BtlCurMat
    this.base = new Mat();      // g_BtlBaseMat
    this.gteRt = new Int16Array(9);
    this.gteTr = new Int32Array(3);
    this._tmp = new Mat();
    this._ir = [0, 0, 0];
  }

  // 0x8003829c
  initBase() {
    this.base.m.fill(0); this.base.t.fill(0);
    this.base.m[0] = this.base.m[4] = this.base.m[8] = 4096;
  }
  // 0x80038234
  loadBase() { this.cur.copyFrom(this.base); }

  // 0x80037fc8: cur.t += cur(cột) * v
  applyTrans(vx, vy, vz) {
    const m = this.cur.m, t = this.cur.t;
    t[0] = (t[0] + (mul(m[0], vx) >> 12) + (mul(m[3], vy) >> 12) + (mul(m[6], vz) >> 12)) | 0;
    t[1] = (t[1] + (mul(m[1], vx) >> 12) + (mul(m[4], vy) >> 12) + (mul(m[7], vz) >> 12)) | 0;
    t[2] = (t[2] + (mul(m[2], vx) >> 12) + (mul(m[5], vy) >> 12) + (mul(m[8], vz) >> 12)) | 0;
  }

  // 0x800a0930 RotMatrix: (rx, ry, rz) với 4096 = 360 độ
  rotMatrix(rx, ry, rz, out) {
    const rs = this.rs;
    const sc = a => {
      let w, s;
      if (a >= 0) { w = rs[a & 0xfff]; s = s16(w); } else { w = rs[(-a) & 0xfff]; s = -s16(w); }
      return [s, (w | 0) >> 16];
    };
    const [sA, cA] = sc(rx), [sB, cB] = sc(ry), [sC, cC] = sc(rz);
    const m = out.m;
    m[2] = sB;
    m[5] = (-(cB * sA)) >> 12;
    m[8] = (cB * cA) >> 12;
    m[0] = (cC * cB) >> 12;
    m[1] = (-(sC * cB)) >> 12;
    const t8 = (cC * -sB) >> 12;
    m[3] = ((sC * cA) >> 12) - ((t8 * sA) >> 12);
    m[6] = ((sC * sA) >> 12) + ((t8 * cA) >> 12);
    const t8b = (sC * -sB) >> 12;
    m[4] = ((cC * cA) >> 12) + ((t8b * sA) >> 12);
    m[7] = ((cC * sA) >> 12) - ((t8b * cA) >> 12);
    return out;
  }

  // 0x800a04a0 MulMatrix: m0 = m0 * m1 (từng cột qua GTE, cv = 3: không cộng tịnh tiến)
  mulMatrix(m0, m1) {
    const a = m0.m.slice(), b = m1.m, ir = this._ir;
    for (let c = 0; c < 3; c++) {
      mvmva(a, null, b[c], b[3 + c], b[6 + c], ir);
      m0.m[c] = ir[0]; m0.m[3 + c] = ir[1]; m0.m[6 + c] = ir[2];
    }
  }

  // 0x800382e8 BtlMatRotate: cur = cur * RotMatrix(r)
  rotate(rx, ry, rz) {
    this.rotMatrix(rx, ry, rz, this._tmp);
    this.mulMatrix(this.cur, this._tmp);
  }

  // 0x800a05e0 ScaleMatrix / 0x80038314 BtlMatScale: cột j nhân v[j] (4096 = 1.0)
  scale(vx, vy, vz) {
    const m = this.cur.m;
    m[0] = mul(m[0], vx) >> 12; m[1] = mul(m[1], vy) >> 12; m[2] = mul(m[2], vz) >> 12;
    m[3] = mul(m[3], vx) >> 12; m[4] = mul(m[4], vy) >> 12; m[5] = mul(m[5], vz) >> 12;
    m[6] = mul(m[6], vx) >> 12; m[7] = mul(m[7], vy) >> 12; m[8] = mul(m[8], vz) >> 12;
  }

  // 0x800383cc BtlMatSetGte
  setGte() { this.gteRt.set(this.cur.m); this.gteTr.set(this.cur.t); }

  // 0x800a0e50 RotTransSV: out = RT * v + TR  (>> 12), bão hoà s16
  rotTrans(vx, vy, out) {
    mvmva(this.gteRt, this.gteTr, vx, vy, 0, this._ir);
    out.x = this._ir[0]; out.y = this._ir[1];
    return out;
  }
}
