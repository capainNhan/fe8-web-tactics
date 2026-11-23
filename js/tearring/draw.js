/**
 * draw.js - dựng gói GPU cho một participant.
 * Port của btl_draw_chan.c (BtlDrawChan 0x8014f22c), btl_draw_trail.c (BtlDrawTrail 0x80150164),
 * btl_draw_unit.c (BtlDrawUnit 0x80150870).
 *
 * Khác biệt DUY NHẤT so với mã gốc là cách lưu gói: thay vì ghi byte vào bộ đệm rồi nối danh sách
 * liên kết của Ordering Table, ở đây gói là object và OT là mảng các slot.  Quy ước giữ nguyên:
 *   - slot của chỉ số z là 157 + z (OT+0x274+4z); slot 156 (OT+0x270) là nơi đặt bóng và gói draw-area;
 *   - chèn là chèn ĐẦU danh sách (ADD_PRIM), nên trong cùng slot gói chèn sau chạy trước;
 *   - bộ đếm byte `prim` tăng đúng 24 / 40 / 20 / 8 như gốc để giữ giới hạn prim_end.
 */
import { s8, s16, u16 } from "./psx.js";
import { pathEval } from "./path.js";

export const SLOT_AREA = 156;
const slotOf = z => 157 + z;

export class Frame {
  constructor({ camX = 160, camY = 120, primEnd = 0xff00 } = {}) {
    this.camX = camX; this.camY = camY;
    this.ot = [];                     // ot[slot] = [gói...] (gói chèn sau nằm cuối = chạy trước)
    this.prim = 0;                    // byte đã dùng (ctx->prim)
    this.primEnd = primEnd;           // ctx->prim_end
    this.area = null;                 // gói draw-area (0,0,320,160)
  }
  add(slot, pkt) { (this.ot[slot] || (this.ot[slot] = [])).push(pkt); }
}

const onScreen = (x, y) => ((x + 7) & 0xffff) < 327 && y >= -7 && y < 240;

const _tmp = { x: 0, y: 0 }, _path = { x: 0, y: 0, angle: 0 };

function poseOf(part, rec) { return part.poses[rec]; }

/**
 * 0x8014f22c BtlDrawChan
 *   recTrail: ghi vệt ảnh / vẽ bóng     side: participant bị lật (xoay Y 180 độ)
 *   alt:      dùng vị trí (d8, da) của BtlMotionStartM7
 */
export function drawChan(G, F, part, chan, recTrail, side, alt) {
  const ri = chan.rec_cur;
  const flags = chan.recFlags(ri);
  const pose = poseOf(part, chan.recPose(ri));

  if (!(flags & 1)) {
    // không vẽ: cho vệt ảnh xả dần
    const t = part.trail, idx = t.slot;
    if (t.timer[idx] - 1 !== 0) t.timer[idx] = t.timer[idx] - 1;
    else {
      t.timer[idx] = t.period;
      if (t.wp[idx] !== t.rp[idx]) {
        let r = t.rp[idx] + 1;
        if (!(r < 4)) r = 0;
        t.rp[idx] = r;
      }
    }
    return;
  }
  if (!pose) return;

  const px0 = alt ? u16(part.d8) : u16(part.x);
  const py0 = alt ? u16(part.da) : u16(part.y);
  const sx = s16(px0 - u16(F.camX - 160));
  const sy = s16(u16(F.camY) - py0);

  let copies = (flags & 2) ? chan.recRepeat(ri) : 1;
  if (copies === 0) copies = 1;

  pathEval(chan, _path);
  const angle = _path.angle;
  let tpx = s16(_path.x);
  let tpy = s16(-u16(_path.y));
  let pathx = tpx;
  const pathy = s16(sy + tpy);

  if (part.anim_a4 !== 0 && recTrail) {
    const t = part.trail, idx = t.slot;
    if (t.timer[idx] - 1 !== 0) t.timer[idx] = t.timer[idx] - 1;
    else {
      t.timer[idx] = t.period;
      let wp = t.wp[idx], rp = t.rp[idx];
      const e = t.ent[idx][wp];
      e.x = part.x; e.ang = angle; e.y = part.y; e.px = tpx; e.py = tpy;
      e.camx = F.camX; e.camy = F.camY; e.rec = chan.rec_cur;
      wp++;
      if (!(wp < 4)) wp = 0;
      if (wp === rp) rp++;
      if (!(rp < 4)) rp = 0;
      t.wp[idx] = wp; t.rp[idx] = rp;
    }
  }

  // ---- ma trận: base * T(màn hình) * lật * T(quỹ đạo) * Rz * co giãn * lật bản ghi ----
  let xf = 0, mirror = 0;
  G.loadBase();
  G.applyTrans(sx, sy, 0);
  if (side) G.rotate(0, 2048, 0);
  if (part.flip_ac !== 0) { mirror = 1; G.rotate(0, 2048, 0); }
  G.applyTrans(tpx, tpy, 0);
  G.rotate(0, 0, angle);
  if (angle !== 0) xf = 1;
  if (alt && part.dc !== 0) { G.rotate(0, 0, part.dc); xf = 1; }
  if (flags & 0x08) { xf = 1; const e = chan.recExtra(ri); G.scale(e, e, 4096); }
  if (part.f_b4 !== 0) { xf = 1; G.scale(part.scale_x, part.scale_y, 4096); }
  if (flags & 0xc0) {
    if (flags & 0x80) { G.rotate(2048, 0, 0); mirror = mirror === 0 ? 1 : 0; }
    if (flags & 0x40) { G.rotate(0, 2048, 0); xf = 1; }
  }
  tpx = s16(-chan.off_x);
  tpy = s16(-chan.off_y);
  G.setGte();

  let color = 0, pflags, blend;
  if (part.f_a8 !== 0) { pflags = 0; color = part.col_c0 >>> 0; } else pflags = 1;
  if (flags & 0x04) pflags |= 2;
  if (part.f_b8 !== 0) { pflags |= 2; blend = u16(part.blend_bc << 5); }
  else blend = (flags & 0x30) << 1;
  const rgb = [color & 0xff, (color >>> 8) & 0xff, (color >>> 16) & 0xff];
  const slot = slotOf(chan.z);

  while (copies > 0) {
    copies--;
    if (pose.n !== 0 && !(F.primEnd < F.prim)) {
      let i = 0;
      do {
        const it = pose.items[i];
        const t6 = it.tile & 0x3ff;
        const grp = s16(it.tile) >> 10;
        const x = s16(tpx + it.x * 8), y = s16(tpy + it.y * 8);
        const tpage = part.tpage[grp] ?? 0;

        if (!xf && !mirror) {
          G.rotTrans(side ? s16(x + 8) : x, y, _tmp);
          if (onScreen(_tmp.x, _tmp.y)) {
            F.add(slot, { k: "sprt8", x: _tmp.x, y: _tmp.y, u: (t6 << 3) & 0xff, v: ((t6 & 0x3e0) >> 2) & 0xff,
                          clut: part.clut, rgb, code: (pflags | 0x74) & 0xff });
            F.add(slot, { k: "tpage", tpage: ((tpage | blend) & 0x9ff) });
            F.prim += 24;
          }
        } else {
          const v = [{}, {}, {}, {}];
          const o = side ? [1, 0, 3, 2] : [0, 1, 2, 3];
          G.rotTrans(x, y, v[o[0]]);
          G.rotTrans(s16(x + 8), y, v[o[1]]);
          G.rotTrans(x, s16(y + 8), v[o[2]]);
          G.rotTrans(s16(x + 8), s16(y + 8), v[o[3]]);
          if (v.some(p => onScreen(p.x, p.y))) {
            const u = (t6 & 0x1f) << 3, vv = (t6 & 0x3e0) >> 2;
            let du, dv;
            if (xf) { du = 7; dv = 7; } else { du = u === 248 ? 7 : 8; dv = vv === 248 ? 7 : 8; }
            if (mirror && u === 0) du = 7;
            F.add(slot, { k: "ft4", xy: v.map(p => [p.x, p.y]),
                          uv: [[u, vv], [(u + du) & 0xff, vv], [u, (vv + dv) & 0xff], [(u + du) & 0xff, (vv + dv) & 0xff]],
                          clut: part.clut, tpage: u16(tpage | blend), rgb, code: (pflags | 0x2c) & 0xff });
            F.prim += 40;
          }
        }
        i++;
      } while (i < pose.n && !(F.primEnd < F.prim));
    }
    tpx = s16(tpx + chan.recBack(ri));
    tpy = s16(tpy - s8(chan.recCounter(ri)));
  }

  // ---- bóng đổ ----
  if (!G.shadowOn || !recTrail || alt || part.shadow_b0 === 0) return;
  G.loadBase();
  G.applyTrans(sx, F.camY - 10, 0);
  if (side) pathx = s16(-pathx);
  G.applyTrans(pathx, 0, 0);
  const den = 290 - pathy;
  if (den === 0) { G.shadowOn = 0; return; }       // mã gốc: break chia 0 (bẫy phần cứng)
  G.scale(s16(Math.trunc((part.bset.w0a * 4096) / den)), 341, 4096);
  G.setGte();
  let i = 0;
  if (!(F.primEnd < F.prim)) {
    do {
      const p = [{}, {}, {}];
      G.rotTrans(G.shadowPts[i][0], G.shadowPts[i][1], p[0]);
      G.rotTrans(0, 0, p[1]);
      i++;
      G.rotTrans(G.shadowPts[i][0], G.shadowPts[i][1], p[2]);
      F.add(SLOT_AREA, { k: "f3", xy: p.map(q => [q.x, q.y]), rgb: [0, 0, 0], code: 0x22 });
      F.prim += 20;
    } while (i < 12 && !(F.primEnd < F.prim));
  }
  if (F.prim < F.primEnd) { F.add(SLOT_AREA, { k: "tpage", tpage: 0 }); F.prim += 8; }
  G.shadowOn = 0;
}

/** 0x80150164 BtlDrawTrail: vết ảnh, OT chỉ số -age (sau mọi thứ khác, trước kênh). */
export function drawTrail(G, F, part, chan, ent, age, side) {
  const rec = ent.rec;
  const flags = chan.recFlags(rec);
  const pose = poseOf(part, chan.recPose(rec));
  if (!(flags & 1) || !pose) return;

  let copies = (flags & 2) ? chan.recRepeat(rec) : 1;
  if (copies === 0) copies = 1;

  const sx = s16(u16(ent.x) - u16(F.camX - 160));
  const sy = s16(u16(F.camY) - u16(ent.y));
  const col = part.bset.col24 >>> 0;
  const rgb = [col & 0xff, (col >>> 8) & 0xff, (col >>> 16) & 0xff];

  let xf = 0;
  G.loadBase();
  G.applyTrans(sx, sy, 0);
  if (side) G.rotate(0, 2048, 0);
  G.applyTrans(ent.px, ent.py, 0);
  G.rotate(0, 0, ent.ang);
  if (ent.ang !== 0) xf = 1;
  if (flags & 0x08) { xf = 1; const e = chan.recExtra(rec); G.scale(e, e, 4096); }
  let tpx = s16(-chan.off_x), tpy = s16(-chan.off_y);
  G.setGte();

  const pflags = (part.bset.flags0 & 0x800) ? 2 : 3;
  const slot = slotOf(-age);

  while (copies > 0) {
    copies--;
    if (pose.n !== 0 && !(F.primEnd < F.prim)) {
      let i = 0;
      do {
        const it = pose.items[i];
        const t6 = it.tile & 0x3ff, grp = s16(it.tile) >> 10;
        const tpage = part.tpage[grp] ?? 0;
        const x = s16(tpx + it.x * 8), y = s16(tpy + it.y * 8);
        if (!xf) {
          G.rotTrans(side ? s16(x + 8) : x, y, _tmp);
          if (onScreen(_tmp.x, _tmp.y)) {
            F.add(slot, { k: "sprt8", x: _tmp.x, y: _tmp.y, u: (t6 << 3) & 0xff, v: ((t6 & 0x3e0) >> 2) & 0xff,
                          clut: part.clut, rgb, code: (pflags | 0x74) & 0xff });
            F.add(slot, { k: "tpage", tpage: tpage & 0x9ff });
            F.prim += 24;
          }
        } else {
          const v = [{}, {}, {}, {}];
          const o = side ? [1, 0, 3, 2] : [0, 1, 2, 3];
          G.rotTrans(x, y, v[o[0]]); G.rotTrans(s16(x + 8), y, v[o[1]]);
          G.rotTrans(x, s16(y + 8), v[o[2]]); G.rotTrans(s16(x + 8), s16(y + 8), v[o[3]]);
          const u = (t6 & 0x1f) << 3, vv = (t6 & 0x3e0) >> 2;
          F.add(slot, { k: "ft4", xy: v.map(p => [p.x, p.y]),
                        uv: [[u, vv], [(u + 7) & 0xff, vv], [u, (vv + 7) & 0xff], [(u + 7) & 0xff, (vv + 7) & 0xff]],
                        clut: part.clut, tpage, rgb, code: (pflags | 0x2c) & 0xff });
          F.prim += 40;
        }
        i++;
      } while (i < pose.n && !(F.primEnd < F.prim));
    }
    tpx = s16(tpx + chan.recBack(rec));
    tpy = s16(tpy - s8(chan.recCounter(rec)));
  }
}

/** 0x80150870 BtlDrawUnit: vẽ một participant vào frame F (dùng chung OT cho cả hai bên). */
export function drawUnit(G, F, part, side) {
  // ---- fade bảng màu (sóng tam giác của độ sáng cộng thêm) ----
  if (part.fade_fc !== 0 && part.pal_100) {
    let lvl = part.fade_104 & 0x7f;
    if (part.fade_104 & 0x80) lvl = 128 - lvl;
    const add = lvl >> 3, pal = new Uint16Array(16);
    for (let i = 0; i < 16; i++) {
      const c = part.pal_100[i];
      let r = (c & 0x1f) + add, g = ((c >> 5) & 0x1f) + add, b = ((c >> 10) & 0x1f) + add;
      if (!(r < 32)) r = 31; if (!(g < 32)) g = 31; if (!(b < 32)) b = 31;
      pal[i] = (c & 0x8000) | r | (g << 5) | (b << 10);
    }
    part.fade_104 = (part.fade_104 + 4) & 0xffff;
    part.vram.loadImage(208, 507 + side, 16, 1, pal);       // LoadImage(rect, pal)
  }

  const motion = part.motion[part.group * 11 + part.slot];
  G.shadowOn = 1;
  G.initBase();

  if (part.anim_a4 !== 0) {
    const nch = (part.bset.flags0 & 0x1000) ? 1 : 4;
    for (let ch = 0; ch < nch; ch++) {
      const c = motion.ch[ch];
      if (c.active === 0) continue;
      let rp = part.trail.rp[ch];
      const wp = part.trail.wp[ch];
      if (rp === wp) continue;
      let age = 1;
      do {
        drawTrail(G, F, part, c, part.trail.ent[ch][rp], age, side);
        age++; rp++;
        if (!(rp < 4)) rp = 0;
      } while (rp !== wp);
    }
  }

  for (let ch = 0; ch < 4; ch++) {
    if (part.anim_a4 !== 0) part.trail.slot = ch;
    if (motion.ch[ch].active !== 0) drawChan(G, F, part, motion.ch[ch], 1, side, 0);
  }

  if (part.f_c8 !== 0) {
    for (let j = 0; j < 4; j++) {
      if (motion.link(j) === 0) continue;
      const lm = part.motion[22 + motion.link(j) - 1];
      for (let ch = 0; ch < 4; ch++) if (lm.ch[ch].active !== 0) drawChan(G, F, part, lm.ch[ch], 0, side, 0);
    }
  }

  if (part.f_cc !== 0) {
    const m7 = part.motion[7], c = m7.ch[part.de];
    if (c.active !== 0) drawChan(G, F, part, c, 0, side, 1);
    if (part.f_d0 !== 0) {
      for (let j = 0; j < 4; j++) {
        if (m7.link(j) === 0) continue;
        const lm = part.motion[22 + m7.link(j) - 1];
        for (let ch = 0; ch < 4; ch++) if (lm.ch[ch].active !== 0) drawChan(G, F, part, lm.ch[ch], 0, side, 1);
      }
    }
  }

  // gói draw-area (0,0,320,160) ở slot thấp nhất, chạy trước mọi thứ cùng slot
  const area = { k: "area", x: 0, y: 0, w: 320, h: 160 };
  F.add(SLOT_AREA, area);
  F.area = area;
}
