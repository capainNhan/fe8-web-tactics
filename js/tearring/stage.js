/**
 * stage.js - sân khấu trận đấu chạy engine TearRing Saga (js/tearring/) trong Phaser.
 *
 * Mỗi tick của game = một lần BtlMotionTick cho cả hai bên, sau đó BtlDrawUnit của cả hai bên
 * vào CHUNG một Ordering Table rồi rasterize ra canvas 320x160 (vùng vẽ 0,0,320,160 của game).
 * Trộn bán trong suốt dùng chế độ "backdrop": đúng công thức PS1 lên nền sân khấu.
 *
 * Phần engine (step/path/matrix/draw) đã đối chiếu từng byte với mã máy gốc (tools/verify_tearring.mjs).
 * Phần ĐIỀU PHỐI (chọn motion nào, lúc nào) nằm trong B.BIN nhưng chưa decomp -> do scene quyết định.
 */
import { createGlobals, createPart, Frame, Gpu, Vram } from "./unit.js";
import { tmLerp } from "./path.js";

export const STAGE_W = 320, STAGE_H = 160;
export const PS1_TICK_MS = 1000 / 60;

function buildBackdrop(colors) {
  const px = new Uint8ClampedArray(STAGE_W * STAGE_H * 4);
  const hex = c => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
  const { sky, line, ground, horizon } = colors;
  for (let y = 0; y < STAGE_H; y++) {
    const c = hex(y < horizon ? sky : y < horizon + 3 ? line : ground);
    for (let x = 0; x < STAGE_W; x++) { const o = (y * STAGE_W + x) * 4; px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2]; px[o + 3] = 255; }
  }
  return px;
}

class Actor {
  constructor(stage, part, name) {
    this.stage = stage; this.part = part; this.name = name;
    this.visible = true;
    this.cur = null;                 // motion đang chạy
    part.events.hit = () => this._onHit();
  }

  _hasHit(id) {
    const p = this.part, m = p.motion[id];
    const scan = mm => mm.ch.some(c => { for (let i = 0; i < 12; i++) if (c.recEvt(i) & 1) return true; return false; });
    if (!m) return false;
    if (scan(m)) return true;
    for (let j = 0; j < 4; j++) if (m.link(j) && p.motion[22 + m.link(j) - 1] && scan(p.motion[22 + m.link(j) - 1])) return true;
    return false;
  }

  has(id) { return !!this.part.motion[id]; }

  /** Toạ độ ngang theo hệ của GAME (gốc ảnh), chưa tính bù tâm hình dùng để hiển thị. */
  get gx() { return this.part.x + this.shift; }
  set gx(v) { this.part.x = v - this.shift; }

  /**
   * Phi tới sát đối thủ - công thức của BtlApproachSetup 0x800ffeec + pha 1 của 0x8010031c (0x80100534):
   *   khoảng trống = |xA - xB| - (wA + wB)/2   (w = BSET+0x0a; 0 ... 640)   => dừng khi hai "hộp" chạm nhau
   *   tốc độ = bset[0x0f] (1..20) px/tick;  mỗi tick tiến độ t += 32767 / (khoảng trống / tốc độ)
   *   vị trí = TmLerp (nội suy TUYẾN TÍNH) giữa vị trí đầu và cuối, đúng nhánh "loại đòn 0" (BSET+0x0e == 0) của bộ điều phối
   *   0x8010031c: tiến độ t += ctx+0x270 mỗi tick, tràn 32767 là xong, rồi TmLerp(ctx+0x274 -> ctx+0x278, t) (0x80100500/0x80100944).
   *   (Bézier chỉ dùng ở loại đòn 1, và cung ở loại 21; mọi unit trong kho kỵ binh/bộ binh hiện có đều là loại 0.)
   * Chỉ trục ngang được áp (y đầu = y cuối).  Trả Promise khi tới nơi.
   */
  dash(target, { motion = 1 } = {}) {
    const p = this.part, wsum = p.bset.w0a + target.part.bset.w0a;
    let gap = Math.abs(this.gx - target.gx) - Math.trunc(wsum / 2);
    gap = Math.max(0, Math.min(640, gap));
    if (gap <= 0) return Promise.resolve();
    const spd = Math.max(1, Math.min(20, p.bset.b0f || 1));
    const perTick = Math.max(1, Math.trunc(gap / spd));
    const x0 = Math.round(this.gx), dir = target.gx >= this.gx ? 1 : -1, x1 = x0 + dir * gap;
    if (this.has(motion)) this.loop(motion);
    return new Promise(resolve => { this.dashing = { x0, x1, speed: Math.trunc(32767 / perTick), t: 0, resolve, target }; });
  }

  _dashStep() {
    const d = this.dashing;
    if (!d) return;
    d.t += d.speed;
    let done = false;
    if (d.t > 32767) { d.t = 32767; done = true; }
    if (done) { const b = this.gx; this.gx = d.x1; this.stage.followCamera(d.target, this.gx - b); this.dashing = null; d.resolve(); return; }
    const out = { x: 0, y: 0 };
    tmLerp(out, { x: d.x0, y: 0 }, { x: d.x1, y: 0 }, d.t);
    const before = this.gx;
    this.gx = out.x;
    this.stage.followCamera(d.target, this.gx - before);
  }

  /**
   * Biến mất khi bị hạ gục - đúng máy trạng thái của BtlFrameDraw 0x800fe8e4:
   *   chờ 20 khung -> (âm thanh 38) -> mức sáng 255, mỗi khung -4 cho tới khi < 8, đang lúc đó vẽ
   *   với f_a8=1 (tô màu xám = mức), f_b8=1, blend_bc=1 (cộng GPU: B+F) -> thôi vẽ unit.
   * Trả Promise xong khi unit đã biến mất.  onSound(38, 100, 100) nếu có.
   */
  die({ onSound } = {}) {
    return new Promise(resolve => { this.fade = { state: 2, delay: 20, level: 0, resolve, onSound }; });
  }

  _fadeStep() {
    const f = this.fade;
    if (!f) return;
    const p = this.part;
    if (f.state === 2) {
      f.delay--;
      if (f.delay > 0) return;
      f.level = 255; f.state = 3;
      f.onSound && f.onSound(38, 100, 100);
      return;
    }
    if (f.state === 3) {
      p.f_a8 = 1; p.f_b8 = 1; p.blend_bc = 1;
      p.col_c0 = f.level | (f.level << 8) | (f.level << 16);
      f.level = (f.level - 4) & 0xff;
      if (f.level < 8) { f.state = 4; this.visible = false; f.resolve(); }
    }
  }

  /** Lặp một motion (idle, phi...) cho tới khi có lệnh khác. */
  loop(id) {
    this._finish();
    this.cur = { id, loop: true };
    this.part.start(id, this.part.x, this.part.y);
  }

  /** Chạy một motion một lần rồi quay về idle. Trả { hit, done, onHit }. */
  play(id, { returnTo = 0 } = {}) {
    this._finish();
    const cur = { id, loop: false, returnTo, hits: 0, hitFired: false, extraHit: null };
    cur.hitP = new Promise(r => (cur.hitRes = r));
    cur.doneP = new Promise(r => (cur.doneRes = r));
    // Thời điểm trúng đòn THẬT của game: BSET +0x14 (M1_0), +0x16 (M1_1), +0x18 (M1_8) -> bộ đếm +0x21c của bộ điều phối
    // (0x801014a0..0x80101d98).  Đã đối chiếu bằng hình: vệt chém/chớp phép xuất hiện đúng tick đó.
    const off = { 11: 0x14, 12: 0x16, 19: 0x18 }[id];
    cur.hitTick = off !== undefined ? this.part.bset.dv.getUint16(off, true) : -1;
    cur.fallbackTick = cur.hitTick < 0 && !this._hasHit(id) ? Math.floor(this.part.motion[id].length * 0.4) : -1;
    this.cur = cur;
    this.part.start(id, this.part.x, this.part.y);
    return { hit: cur.hitP, done: cur.doneP, set onHit(fn) { cur.extraHit = fn; } };
  }

  _onHit() {
    const c = this.cur;
    if (!c || c.loop) return;
    c.hits++;
    if (c.hitTick >= 0) {                    // có bộ đếm thật: sự kiện 0x01 chỉ là nhát phụ sau lần trúng chính
      if (c.hitFired && c.extraHit) c.extraHit(c.hits);
      return;
    }
    if (!c.hitFired) { c.hitFired = true; c.hitRes(true); }
    else if (c.extraHit) c.extraHit(c.hits);
  }

  _finish() {
    const c = this.cur;
    if (c && !c.loop) { c.hitRes(c.hitFired); c.doneRes(); }
  }

  tick() {
    const c = this.cur, p = this.part;
    this._dashStep();
    this._fadeStep();
    if (!c) return;
    const ended = p.step();
    if (!c.loop && !c.hitFired) {
      const at = c.hitTick >= 0 ? c.hitTick : c.fallbackTick;
      if (at >= 0 && p.tick >= at) { c.hitFired = true; c.hitRes(true); }
    }
    if (!ended) return;
    if (c.loop) p.start(c.id, p.x, p.y);
    else {
      c.hitRes(c.hitFired); c.doneRes();
      this.loop(c.returnTo);
    }
  }

  /** Nháy sáng (dùng cờ tô màu của game: f_a8 + col_c0). */
  flash(ms) {
    this.part.f_a8 = 1; this.part.col_c0 = 0xffffff;
    this.stage.scene.time.delayedCall(ms, () => { this.part.f_a8 = 0; });
  }
}

export class TearRingStage {
  /**
   * @param scene   Phaser.Scene
   * @param o       { assets: {common, rsincos, paks:[left,right]}, units:[idLeft,idRight], config: TEARRING_UNITS,
   *                  x: [xL, xR] tuỳ chọn (mặc định -bset.x / +bset.x), key, tickMs, backdrop: {sky,line,ground,horizon} }
   */
  constructor(scene, o) {
    this.scene = scene;
    this.tickMs = o.tickMs ?? PS1_TICK_MS;
    this.acc = 0;
    this.frozen = false;
    this.vram = new Vram();
    const G = createGlobals(o.assets.common, o.assets.rsincos);
    this.G = G;
    this.backdropBase = buildBackdrop({ sky: 0x263b55, line: 0x8c9a9e, ground: 0x182337, horizon: 128, ...(o.backdrop || {}) });
    this.backdrop = this.backdropBase;
    this._tintKey = "128,128,128";
    this.camX = 0; this.camY = 160;      // ctx+0xac / +0xae (BtlSetupLayout: cận chiến mặc định = 0 / 160)

    // Cơ chế của game (BtlLoadPages 0x8014e034 + BtlFrameDraw 0x800fe8e4): hướng nhìn KHÔNG phụ thuộc unit.
    //   participant 0: trang texture nguyên bản, side = 0, đứng x = +bset.x  (bên PHẢI màn hình, ảnh gốc nhìn TRÁI)
    //   participant 1: trang texture lật từng ô 8x8, side = 1, đứng x = -bset.x (bên TRÁI màn hình, nhìn sang phải)
    // Màn hình: sx = x + 160 - cam_x với cam_x = 0 (BtlSetupLayout, cận chiến mặc định).
    const sides = { left: 1, right: 0 };
    this.actors = {};
    for (const name of ["left", "right"]) {
      const idx = sides[name];
      const unitId = o.units[name === "left" ? 0 : 1];
      const cfg = o.config[unitId];
      const part = createPart(o.assets.paks[name === "left" ? 0 : 1], G, this.vram,
        { slot: idx, side: idx, mirrorPages: idx === 1, shadow: cfg.shadow });
      part.y = part.bset.y;
      part.x = 0;
      // Gốc toạ độ của ảnh gốc không nằm giữa thân (ngựa lệch tới ~20px): đo thế đứng chờ rồi bù để
      // tâm hình rơi đúng vị trí đứng của game, tránh một bên bị cắt mép màn hình.  (Chỉ chỉnh hiển thị.)
      const nominal = o.x ? o.x[name === "left" ? 0 : 1] : (idx === 1 ? -part.bset.x : part.bset.x);
      const shift = this._idleCenter(part);
      part.x = nominal - shift;
      this.actors[name] = new Actor(this, part, name);
      this.actors[name].shift = shift;
    }

    const key = o.key ?? "tearring-stage";
    if (scene.textures.exists(key)) scene.textures.remove(key);
    this.tex = scene.textures.createCanvas(key, STAGE_W, STAGE_H);
    this.tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.key = key;
    this.ctx = this.tex.getContext();

    this._upd = (_, dt) => this.update(dt);
    scene.events.on(Phaser.Scenes.Events.UPDATE, this._upd);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
    this.render();
  }

  /** Lệch ngang (px màn hình) giữa gốc và tâm hình ở thế đứng chờ M0_0, theo hướng đã lật. */
  _idleCenter(part) {
    part.start(0, 0, part.y);
    const F = new Frame({ camX: 0, camY: 160 });
    part.draw(F);
    const img = new Gpu(this.vram, { width: STAGE_W, height: STAGE_H, mode: "layer" }).run(F).canvas.image();
    let x0 = STAGE_W, x1 = -1;
    for (let y = 0; y < STAGE_H; y++) for (let x = 0; x < STAGE_W; x++) {
      if (img[(y * STAGE_W + x) * 4 + 3] > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; }
    }
    return x1 < 0 ? 0 : Math.round((x0 + x1) / 2 - 160);
  }

  update(dt) {
    if (this.frozen) return;
    this.acc = Math.min(this.acc + dt, this.tickMs * 6);
    let n = 0;
    while (this.acc >= this.tickMs) {
      this.acc -= this.tickMs;
      for (const a of Object.values(this.actors)) a.tick();
      n++;
    }
    if (n) this.render();
  }

  /**
   * Nền điều biến theo tint của game (G.tint, 128 = nguyên bản): evt 0x40 của motion chí mạng chia đôi, evt 0x20 trả lại
   * (BtlBgDraw 0x80109e0c đọc 0x80166df8).  Chỉ nền bị tối; sprite unit không dùng tint này.
   */
  _syncTint() {
    const t = this.G.tint, key = t[0] + "," + t[1] + "," + t[2];
    if (key === this._tintKey) return;
    this._tintKey = key;
    const b = this.backdropBase, out = new Uint8ClampedArray(b.length);
    for (let i = 0; i < b.length; i += 4) {
      out[i] = b[i] * t[0] / 128; out[i + 1] = b[i + 1] * t[1] / 128; out[i + 2] = b[i + 2] * t[2] / 128; out[i + 3] = 255;
    }
    this.backdrop = out;
  }

  render() {
    this._syncTint();
    const F = new Frame({ camX: this.camX, camY: this.camY });   // cam_x/cam_y: BtlSetupLayout + camera đi theo khi phi tới
    for (const a of Object.values(this.actors)) if (a.visible) a.part.draw(F);
    const gpu = new Gpu(this.vram, { width: STAGE_W, height: STAGE_H, mode: "backdrop", backdrop: this.backdrop }).run(F);
    this.ctx.putImageData(new ImageData(gpu.canvas.px, STAGE_W, STAGE_H), 0, 0);
    this.tex.refresh();
  }

  /**
   * Camera đi theo bên phi tới - BtlApproach 0x801091d4(ctx, bên bị đánh, dx, dy), gọi mỗi tick phi:
   *   w = bset+0x0a của bên bị đánh + 40; sx = vị trí màn hình của bên bị đánh (sx = x - (cam_x - 160));
   *   nếu sx < w hoặc sx > 320 - w thì cam_x += dx (kẹp ±160).  Bố cục cận chiến: bên bị đánh luôn ở sx 60/260 nên camera luôn bám.
   * Sau khi phi xong camera đứng nguyên (hai bên cũng đứng tại chỗ sau đòn).  Trục dọc không đổi (dy = 0).
   */
  followCamera(target, dx) {
    if (!dx) return;
    const w = target.part.bset.w0a + 40;
    const sx = target.gx - (this.camX - 160);
    if (sx < w || sx > STAGE_W - w) this.camX = Math.max(-160, Math.min(160, this.camX + dx));
  }

  /** Dừng hình (hit-stop). */
  freeze(ms) {
    this.frozen = true;
    return new Promise(r => this.scene.time.delayedCall(ms, () => { this.frozen = false; r(); }));
  }

  destroy() {
    this.scene.events.off(Phaser.Scenes.Events.UPDATE, this._upd);
    if (this.scene.textures.exists(this.key)) this.scene.textures.remove(this.key);
  }
}
