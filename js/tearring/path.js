/**
 * path.js - nội suy quỹ đạo của kênh.
 * Port của tm_spline.c (TmLerp, TmBezier, TmSpline) và btl_anim_path.c (BtlPathEval).
 * t là số cố định 15 bit (0..32767); mọi tích là int32 quấn vòng như mult/mflo gốc.
 */
import { s16, mul } from "./psx.js";

const SHL = (x, n) => x << n;

// 0x80059db8
export function tmLerp(out, a, b, t) {
  const w = s16(32767 - t);
  const sx = (mul(a.x, w) + mul(b.x, t)) | 0;
  const sy = (mul(a.y, w) + mul(b.y, t)) | 0;
  out.x = s16(sx >>> 15);
  out.y = s16(sy >>> 15);
}

// 0x80059a04
export function tmBezier(out, p0, p1, p2, p3, t) {
  const u = s16(32767 - t);
  let t2 = mul(u, u);
  let b0 = mul(t2 >> 15, u);
  b0 = SHL(b0, 1) >> 19;
  const k = mul(t, 3) >> 3;
  t2 = SHL(t2, 1) >> 19;
  const b1 = mul(k, t2) >> 12;
  const v = SHL(mul(t, u), 1) >> 19;
  const b2 = mul(k, v) >> 12;
  let b3 = mul(t, t) >> 15;
  b3 = mul(b3, t);
  b3 = SHL(b3, 1) >> 19;
  out.x = s16((mul(p0.x, b0) + mul(p1.x, b1) + mul(p2.x, b2) + mul(p3.x, b3)) >> 12);
  out.y = s16((mul(p0.y, b0) + mul(p1.y, b1) + mul(p2.y, b2) + mul(p3.y, b3)) >> 12);
}

// 0x80059b64
export function tmSpline(out, p0, p1, p2, p3, t) {
  const s = s16(t) >> 3;
  const n = -s, m1 = s - 4096, m2 = s - 8192, p = s + 4096;
  let q = mul(n, m1) >> 12;
  q = mul(q, m2);
  q = SHL(q, 4) >> 16;
  const c0 = mul(q, 682) >> 12;

  q = mul(m1, p);
  q = SHL(q, 4) >> 16;
  q = mul(q, m2);
  const c1 = SHL(q, 4) >> 17;

  q = mul(n, p);
  q = SHL(q, 4) >> 16;
  q = mul(q, m2);
  const c2 = SHL(q, 4) >> 17;

  q = mul(s, p) >> 12;
  q = mul(q, m1);
  const c3 = SHL(q, 4) >> 17;

  out.x = s16((mul(p0.x, c0) + mul(p1.x, c1) + mul(p2.x, c2) + mul(p3.x, c3)) >> 12);
  out.y = s16((mul(p0.y, c0) + mul(p1.y, c1) + mul(p2.y, c2) + mul(p3.y, c3)) >> 12);
}

const _a = { x: 0, y: 0 }, _b = { x: 0, y: 0 }, _t = { x: 0, y: 0 };
const _P = [0, 1, 2, 3].map(() => ({ x: 0, y: 0 }));

function angleLerp(c, i0, i1) {
  const a0 = c.keyC(i0) & 0xffff, a1 = c.keyC(i1) & 0xffff;
  let d = s16(a0) - s16(a1);
  if (d < 0) d = -d;
  _a.x = s16(a0); _a.y = 0;
  _b.x = s16(a1);
  if (d >= 2049) _b.x = s16(a1 - 4096);
  _b.y = 0;
  tmLerp(_t, _a, _b, c.key_t);
  return _t.x;
}

function keyPt(c, i, dst) { dst.x = c.keyA(i); dst.y = c.keyB(i); return dst; }

/**
 * 0x8014eeb8 BtlPathEval.  Trả {x, y, angle} (angle: 4096 = 360 độ).
 * mode 0: Bezier 4 điểm   mode 1: spline (p-1, p, p+1, p+2)   mode 2: tuyến tính   >=3: giữ nguyên.
 */
export function pathEval(c, out) {
  const n = c.nkeys, mode = c.mode;
  const keyOut = i => { out.x = c.keyA(i); out.y = c.keyB(i); out.angle = s16(c.keyC(i)); };
  if (mode >= 3) return out;

  if (mode === 2) {
    if (n < 2) {
      if (n === 0) { out.x = 0; out.y = 0; out.angle = 0; return out; }
      keyOut(0); return out;
    }
    const cur = c.key_cur;
    if (cur >= n - 1) { keyOut(n - 1); return out; }
    tmLerp(_t, keyPt(c, cur, _P[0]), keyPt(c, cur + 1, _P[1]), c.key_t);
    out.x = _t.x; out.y = _t.y;
    out.angle = angleLerp(c, cur, cur + 1);
    return out;
  }

  if (n < 4) {
    if (n === 0) { out.x = 0; out.y = 0; out.angle = 0; return out; }
    keyOut(0); return out;
  }

  const cur = c.key_cur;
  if (mode === 0) {
    if (!(cur + 3 < n)) { keyOut(n - 1); return out; }
    tmBezier(_t, keyPt(c, cur, _P[0]), keyPt(c, cur + 1, _P[1]), keyPt(c, cur + 2, _P[2]), keyPt(c, cur + 3, _P[3]), c.key_t);
    out.x = _t.x; out.y = _t.y;
    out.angle = angleLerp(c, cur, cur + 3);
  } else {
    const p0 = cur - 1 < 0 ? 0 : cur - 1;
    if (cur >= n - 1) { keyOut(n - 1); return out; }
    const p3 = (n - 1 < cur + 2) ? n : cur + 2;
    tmSpline(_t, keyPt(c, p0, _P[0]), keyPt(c, cur, _P[1]), keyPt(c, cur + 1, _P[2]), keyPt(c, p3, _P[3]), c.key_t);
    out.x = _t.x; out.y = _t.y;
    out.angle = angleLerp(c, cur, cur + 1);
  }
  return out;
}
