/**
 * unit.js - dựng một participant (BTLPART) từ gói dữ liệu BU<nnn>.pak.
 * Định dạng dữ liệu theo README của bản decomp, mục 2 / 5b; cách nạp VRAM theo export_anim.py
 * (make_vram) -- phần nạp này đọc từ mã máy 0x8014e208/0x8014e034, CHƯA decomp.
 */
import { parseAR } from "./archive.js";
import { Motion, MOTION_SIZE, motionTick, motionStart, motionStartM7 } from "./motion.js";
import { drawUnit, Frame } from "./draw.js";
import { MatStack } from "./psx.js";
import { Vram, Gpu } from "./gpu.js";

// CLUT của participant `slot` nằm ở (0, 507 + slot), 256 màu (BtlUnitInit 0x8014e208: CLUT.TIM nạp với y = 507 + idx).
export const CLUT_X = 0;
export const CLUT_Y0 = 507;

/** Bảng dùng chung (common.json + rsincos.bin) -> đối tượng toàn cục của phần vẽ. */
export function createGlobals(common, rsincosBuf) {
  const rs = new Uint32Array(rsincosBuf.buffer ? rsincosBuf.buffer.slice(rsincosBuf.byteOffset, rsincosBuf.byteOffset + 16384) : rsincosBuf);
  const G = new MatStack(rs);
  G.shadowPts = common.shadowPts;
  G.motionTbl = common.motionTbl;
  G.vramTable = common.vramTable;
  G.shadowOn = 0;
  // Trạng thái do sự kiện motion ghi (đọc từ mã máy, các hàm đọc nằm ở 0x801099a4 / 0x80109e0c chưa decomp):
  G.evtFlag = 0;                 // 0x80163e00, evt 0x02 đặt = 1
  G.tint = [128, 128, 128, 0];   // 0x80166df8, màu điều biến nền: 128 = nguyên bản; evt 0x20 đặt lại, evt 0x40 chia đôi
  return G;
}

function parsePoses(d, count) {
  const dv = new DataView(d.buffer, d.byteOffset, d.byteLength);
  let o = 0; const out = [];
  for (let i = 0; i < count; i++) {
    const n = dv.getUint16(o, true), items = [];
    for (let j = 0; j < n; j++) {
      items.push({ tile: dv.getUint16(o + 2 + 4 * j, true), x: d[o + 4 + 4 * j], y: d[o + 5 + 4 * j] });
    }
    out.push({ n, items });
    o += 2 + 4 * n;
  }
  return out;
}

/** 0x80151aec: đảo thứ tự 8 byte của mỗi nhóm 8 (= lật ngang từng ô 8 pixel 8bpp), `rows` hàng x 256 byte. */
export function mirrorPage(src, rows) {
  const out = new Uint8Array(src.subarray(0, rows * 256));
  for (let i = 0; i < out.length; i += 8) for (let k = 0; k < 4; k++) {
    const a = out[i + k]; out[i + k] = out[i + 7 - k]; out[i + 7 - k] = a;
  }
  return out;
}

export class Bset {
  constructor(bytes) {
    this.dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    this.bytes = bytes;
  }
  get flags0() { return this.dv.getUint32(0, true); }
  get w0a() { return this.dv.getInt16(0x0a, true); }
  get b0f() { return this.bytes[0x0f]; }
  get mask12() { return this.bytes[0x12]; }
  get n_bas() { return this.dv.getUint16(0x1a, true); }
  get n_pose() { return this.dv.getUint16(0x1e, true); }
  get col24() { return this.dv.getUint32(0x24, true); }
}

/**
 * @param pak     ArrayBuffer/Uint8Array của BU<nnn>.pak
 * @param G       createGlobals(...)
 * @param vram    Vram dùng chung của hai bên
 * @param o       { slot: 0|1 (participant: hàng bảng VRAM + hàng CLUT), side: cờ vẽ của BtlDrawUnit,
 *                  mirrorPages: lật từng ô 8x8 của trang texture (game làm vậy cho participant 1, 0x8014e034),
 *                  shadow: bool, palette: Uint16Array(256) tuỳ chọn }
 */
export function createPart(pak, G, vram, o = {}) {
  const slot = o.slot ?? 0;          // participant 0/1: chọn hàng bảng VRAM và hàng CLUT
  const side = o.side ?? 0;          // cờ "side" của BtlDrawUnit (xoay Y 180 độ)
  const files = parseAR(pak);
  for (const need of ["BSET.DDD", "POS.BAS", "CLUT.TIM"]) if (!files[need]) throw new Error("pak thiếu " + need);

  const bset = new Bset(files["BSET.DDD"]);
  const poses = parsePoses(files["POS.BAS"], bset.n_bas);
  if (files["POS.EXT"]) poses.push(...parsePoses(files["POS.EXT"], bset.n_pose - bset.n_bas));

  // ---- VRAM: trang texture tại vị trí của game + CLUT ----
  const tbl = G.vramTable.slice(slot * 3, slot * 3 + 3);
  for (let n = 1; n <= 6; n++) {
    const d = files["B" + n + ".DDD"];
    if (!d) continue;
    const g = (n - 1) >> 1, half = (n - 1) & 1;
    const page = new Uint16Array(128 * 128);
    let bytes = d;
    if (o.mirrorPages) bytes = mirrorPage(d, 128);
    const src = new DataView(bytes.buffer, bytes.byteOffset, 32768);
    for (let i = 0; i < 128 * 128; i++) page[i] = src.getUint16(i * 2, true);
    vram.loadImage(tbl[g][0], tbl[g][1] + 128 * half, 128, 128, page);
  }
  let pal = o.palette;
  if (!pal) {
    pal = new Uint16Array(256);
    const cdv = new DataView(files["CLUT.TIM"].buffer, files["CLUT.TIM"].byteOffset);
    for (let i = 0; i < 256; i++) pal[i] = cdv.getUint16(20 + 2 * i, true);
  }
  const clutY = CLUT_Y0 + slot;
  vram.loadImage(CLUT_X, clutY, 256, 1, pal);

  const part = {
    bset, poses, vram, slot, side, g: G,
    motionTbl: G.motionTbl,
    motion: new Array(33).fill(null),
    tick: 0, group: 0, slot: 0, x: 0, y: 0,
    tpage: tbl.map(([x, y]) => ((y & 0x100) >> 4) | ((x & 0x3ff) >> 6) | 0x80 | ((y & 0x200) << 2)),   // 0x8014e208
    clut: (clutY << 6) | (CLUT_X >> 4),
    anim_a4: 0, f_a8: 0, flip_ac: 0, shadow_b0: o.shadow ? 1 : 0, f_b4: 0, f_b8: 0, blend_bc: 0, col_c0: 0,
    scale_x: 4096, scale_y: 4096, f_c8: 1, f_cc: 0, f_d0: 0, d8: 0, da: 0, dc: 0, de: 0,
    chan0_done: 0, fade_fc: 0, pal_100: null, fade_104: 0,
    trail: {
      period: 1, slot: 0, timer: [1, 1, 1, 1], wp: [0, 0, 0, 0], rp: [0, 0, 0, 0],
      ent: [0, 1, 2, 3].map(() => [0, 1, 2, 3].map(() => ({ x: 0, y: 0, ang: 0, px: 0, py: 0, rec: 0, camx: 0, camy: 0 })))
    },
    // Sự kiện của game gắn vào dữ liệu motion (BtlChanStep).  hit = g_BtlHitFlag: thời điểm TRÚNG ĐÒN thật.
    events: {
      hit: null, delay: null,
      e02: () => { G.evtFlag = 1; },                                   // BtlEvt_8010adb0
      e40: () => { for (let i = 0; i < 3; i++) G.tint[i] >>= 1; },     // BtlEvt_8010adf4
      e20: () => { G.tint = [128, 128, 128, 0]; }                      // BtlEvt_8010aa50(g_BtlEvtArg)
    },
    // Hàm ngoài CHƯA decomp: để trống = bỏ qua (khớp với bản export đã kiểm chứng).
    hooks: { partPlace: null, partFx: null }
  };
  // BtlPartFx 0x80151590 (đọc từ mã máy): bật vệt ảnh, chu kỳ n, xoá con trỏ ghi/đọc.
  part.hooks.partFx = (p, n) => {
    p.anim_a4 = 1;
    p.trail.period = n;
    for (let i = 0; i < 4; i++) { p.trail.timer[i] = n; p.trail.wp[i] = 0; p.trail.rp[i] = 0; }
  };
  for (const [name, bytes] of Object.entries(files)) {
    const m = /^M(\d+)_(\d+)\.D$/.exec(name);
    if (m && bytes.length === MOTION_SIZE) part.motion[+m[1] * 11 + +m[2]] = new Motion(bytes);
  }
  part.availableMotions = Object.keys(files).filter(n => /^M\d+_\d+\.D$/.test(n) && files[n].length === MOTION_SIZE);

  part.start = (id, x, y) => motionStart(part, id, x, y);
  part.startM7 = (v, x, y) => motionStartM7(part, v, x, y);
  part.step = () => motionTick(part);
  part.draw = (F) => drawUnit(G, F, part, side);
  return part;
}

export { Frame, Gpu, Vram };
