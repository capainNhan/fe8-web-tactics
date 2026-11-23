/**
 * motion.js - dữ liệu motion (M<g>_<k>.D, 1192 byte) và bộ máy bước theo tick.
 * Port của btl_anim_types.h (BTLMOTION/BTLCHAN/BTLREC) và btl_anim_step.c:
 *   BtlChanPathStep 0x8014eb2c, BtlChanStep 0x8014ebfc, BtlMotionTick 0x8014ed9c,
 *   BtlMotionStart 0x8014e728, BtlMotionStartM7 0x8014e9c0.
 * Trạng thái chạy nằm NGAY TRONG bộ đệm 1192 byte, giống hệt game (bộ đếm lặp, key_t, rec_cur...).
 */
import { s8, s16 } from "./psx.js";

export const MOTION_SIZE = 1192;

/** Một kênh (0x128 byte) nhìn qua DataView của motion. */
export class Chan {
  constructor(dv, base) { this.dv = dv; this.b = base; }
  get active() { return this.dv.getUint32(this.b, true); }
  get off_x() { return this.dv.getInt8(this.b + 4); }
  get off_y() { return this.dv.getInt8(this.b + 5); }
  get z() { return this.dv.getUint16(this.b + 6, true); }
  // BTLREC 10 byte tại +8
  recFlags(i) { return this.dv.getUint8(this.b + 8 + 10 * i); }
  recNext(i) { return this.dv.getUint8(this.b + 8 + 10 * i + 1); }
  recDelay(i) { return this.dv.getUint8(this.b + 8 + 10 * i + 2); }
  recRepeat(i) { return this.dv.getUint8(this.b + 8 + 10 * i + 3); }
  recBack(i) { return this.dv.getInt8(this.b + 8 + 10 * i + 4); }
  recCounter(i) { return this.dv.getUint8(this.b + 8 + 10 * i + 5); }
  setRecCounter(i, v) { this.dv.setUint8(this.b + 8 + 10 * i + 5, v & 0xff); }
  recPose(i) { return this.dv.getUint8(this.b + 8 + 10 * i + 6); }
  recEvt(i) { return this.dv.getUint8(this.b + 8 + 10 * i + 7); }
  recExtra(i) { return this.dv.getInt16(this.b + 8 + 10 * i + 8, true); }
  // BTLPATHKEY 8 byte tại +0x80
  keyA(i) { return this.dv.getInt16(this.b + 0x80 + 8 * i, true); }
  keyB(i) { return this.dv.getInt16(this.b + 0x80 + 8 * i + 2, true); }
  keyC(i) { return this.dv.getInt16(this.b + 0x80 + 8 * i + 4, true); }
  keyDur(i) { return this.dv.getInt16(this.b + 0x80 + 8 * i + 6, true); }
  get loop_path() { return this.dv.getUint8(this.b + 0x120); }
  get mode() { return this.dv.getUint8(this.b + 0x121); }
  get nkeys() { return this.dv.getUint8(this.b + 0x122); }
  get delay_cnt() { return this.dv.getUint8(this.b + 0x123); }
  set delay_cnt(v) { this.dv.setUint8(this.b + 0x123, v & 0xff); }
  get key_cur() { return this.dv.getUint8(this.b + 0x124); }
  set key_cur(v) { this.dv.setUint8(this.b + 0x124, v & 0xff); }
  get rec_cur() { return this.dv.getUint8(this.b + 0x125); }
  set rec_cur(v) { this.dv.setUint8(this.b + 0x125, v & 0xff); }
  get key_t() { return this.dv.getInt16(this.b + 0x126, true); }
  set key_t(v) { this.dv.setInt16(this.b + 0x126, v, true); }
}

export class Motion {
  constructor(bytes) {
    if (bytes.length !== MOTION_SIZE) throw new Error("motion phải đúng 1192 byte, nhận " + bytes.length);
    this.u8 = new Uint8Array(bytes);                  // bản sao: trạng thái chạy ghi vào đây
    this.dv = new DataView(this.u8.buffer);
    this.ch = [0, 1, 2, 3].map(i => new Chan(this.dv, 4 + 0x128 * i));
  }
  get length() { return this.dv.getUint16(0, true); }
  link(j) { return this.u8[0x4a4 + j]; }
}

// 0x8014eb2c
export function chanPathStep(c) {
  if (c.active === 0) return;
  let next;
  if (c.mode !== 0) {
    if (c.mode >= 3) return;
    if (c.nkeys < 4) return;
    next = c.key_cur + 1;
  } else {
    if (c.nkeys < 4) return;
    next = c.key_cur + 3;
  }
  if (next < c.nkeys) {
    let t = c.key_t + c.keyDur(c.key_cur);
    if (t > 32767) { t -= 32767; c.key_cur = next; }
    c.key_t = s16(t);
  } else if (c.loop_path !== 0) {
    c.key_cur = 0;
  }
}

/**
 * 0x8014ebfc BtlChanStep.  Trả 1 khi kênh vừa quay về bản ghi 0.
 * ev: { hit(), e02(chan), e40(chan), e20(), delay(v) } -- các sự kiện của game (g_BtlHitFlag, BtlEvt_*).
 */
export function chanStep(c, ev) {
  if (c.active === 0) return 0;
  if (c.delay_cnt !== 0) { c.delay_cnt = c.delay_cnt - 1; return 0; }

  const cur = c.rec_cur;
  let next = c.recNext(cur) - 1;
  if (c.recEvt(cur) & 0x04) {                       // khối lặp
    if (c.recCounter(cur) === 0) {
      c.setRecCounter(cur, c.recRepeat(cur));
      next = cur - c.recBack(cur);
    } else {
      c.setRecCounter(cur, c.recCounter(cur) - 1);
      if (c.recCounter(cur) !== 0) next = cur - c.recBack(cur);
    }
  }
  if (next < 0) return 0;

  next &= 0xff;
  c.rec_cur = next;
  c.delay_cnt = c.recDelay(next);
  const evt = c.recEvt(next);
  if (evt & 0x01) ev.hit && ev.hit(c);
  if (evt & 0x02) ev.e02 && ev.e02(c);
  if (evt & 0x40) ev.e40 && ev.e40(c);
  if (evt & 0x20) ev.e20 && ev.e20(c);
  if (evt & 0x10) ev.delay && ev.delay(c.recDelay(next));
  return next === 0 ? 1 : 0;
}

/** 0x8014ed9c BtlMotionTick.  Trả true khi motion đã chạy quá `length` tick. */
export function motionTick(p) {
  const m = p.motion[p.group * 11 + p.slot];
  const ev = p.events;
  for (let i = 0; i < 4; i++) {
    chanPathStep(m.ch[i]);
    const r = chanStep(m.ch[i], ev);
    if (i === 0) p.chan0_done = r;
  }
  for (let j = 0; j < 4; j++) {
    if (m.link(j) === 0) continue;
    const lm = p.motion[22 + (m.link(j) - 1)];
    for (let i = 0; i < 4; i++) { chanPathStep(lm.ch[i]); chanStep(lm.ch[i], ev); }
  }
  p.tick = (p.tick + 1) & 0xffff;
  return m.length < p.tick;
}

function rewindOne(m) {
  for (let ch = 0; ch < 4; ch++) {
    const c = m.ch[ch];
    c.key_t = 0; c.key_cur = 0; c.rec_cur = 0;
    for (let i = 0; i < 12; i++) if (c.recEvt(i) & 0x04) c.setRecCounter(i, 0);
    c.delay_cnt = c.recDelay(0);
  }
}

function rewind(p, m) {
  rewindOne(m);
  for (let j = 0; j < 4; j++) if (m.link(j) !== 0) rewindOne(p.motion[22 + (m.link(j) - 1)]);
}

/** 0x8014e728 BtlMotionStart: motion = group*11 + slot. y < 0 => BtlPartPlace (hook). */
export function motionStart(p, motion, x, y) {
  const bset = p.bset;
  if (y >= 0) { p.x = s16(x); p.y = s16(y); }
  else p.hooks.partPlace && p.hooks.partPlace(p);
  p.tick = 0;
  p.f_c8 = 1; p.f_b4 = 0; p.f_b8 = 0; p.f_a8 = 0; p.f_cc = 0; p.f_d4 = 0;

  const g = Math.trunc(motion / 11), k = motion - g * 11;
  p.group = g & 0xff; p.slot = k & 0xff;
  rewind(p, p.motion[(g & 0xff) * 11 + (k & 0xff)]);

  for (let i = 0; i < 8; i++) {
    if (p.motionTbl[i] === motion) {
      if ((bset.mask12 >> i) & 1) {
        let n = 10 - bset.b0f;
        if (n <= 0) n = 1; else if (n >= 11) n = 10;
        p.hooks.partFx && p.hooks.partFx(p, n);      // 0x80151590: CHƯA decomp (xem README)
        return;
      }
      break;
    }
  }
  p.anim_a4 = 0;
}

/** 0x8014e9c0 BtlMotionStartM7: tua M0_7 (+ liên kết), trả độ dài. */
export function motionStartM7(p, v, x, y) {
  p.f_cc = 1; p.f_d0 = 0; p.de = s16(v);
  if (y > 0) { p.d8 = s16(x); p.da = s16(y); }
  const m = p.motion[7];
  rewind(p, m);
  p.dc = 0;
  return m.length;
}
