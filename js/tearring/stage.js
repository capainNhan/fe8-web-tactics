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
    cur.fallbackTick = this._hasHit(id) ? -1 : Math.floor(this.part.motion[id].length * 0.4);
    this.cur = cur;
    this.part.start(id, this.part.x, this.part.y);
    return { hit: cur.hitP, done: cur.doneP, set onHit(fn) { cur.extraHit = fn; } };
  }

  _onHit() {
    const c = this.cur;
    if (!c || c.loop) return;
    c.hits++;
    if (!c.hitFired) { c.hitFired = true; c.hitRes(true); }
    else if (c.extraHit) c.extraHit(c.hits);
  }

  _finish() {
    const c = this.cur;
    if (c && !c.loop) { c.hitRes(c.hitFired); c.doneRes(); }
  }

  tick() {
    const c = this.cur, p = this.part;
    if (!c) return;
    const ended = p.step();
    if (!c.loop && !c.hitFired && c.fallbackTick >= 0 && p.tick >= c.fallbackTick) { c.hitFired = true; c.hitRes(true); }
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
   *                  x: [xL, xR] (toạ độ PSX), key, tickMs, backdrop: {sky,line,ground,horizon} }
   */
  constructor(scene, o) {
    this.scene = scene;
    this.tickMs = o.tickMs ?? PS1_TICK_MS;
    this.acc = 0;
    this.frozen = false;
    this.vram = new Vram();
    const G = createGlobals(o.assets.common, o.assets.rsincos);
    this.G = G;
    this.backdrop = buildBackdrop({ sky: 0x263b55, line: 0x8c9a9e, ground: 0x182337, horizon: 118, ...(o.backdrop || {}) });

    const names = ["left", "right"];
    this.actors = {};
    names.forEach((n, i) => {
      const cfg = o.config[o.units[i]];
      const part = createPart(o.assets.paks[i], G, this.vram, { slot: i, side: 0, shadow: cfg.shadow });
      const wantRight = i === 0;                             // bên trái nhìn sang phải, bên phải nhìn sang trái
      part.flip_ac = (cfg.facing === "right") === wantRight ? 0 : 1;
      part.x = o.x[i]; part.y = 0;
      this.actors[n] = new Actor(this, part, n);
    });

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

  render() {
    const F = new Frame({ camX: 160, camY: 120 });
    for (const a of Object.values(this.actors)) if (a.visible) a.part.draw(F);
    const gpu = new Gpu(this.vram, { width: STAGE_W, height: STAGE_H, mode: "backdrop", backdrop: this.backdrop }).run(F);
    this.ctx.putImageData(new ImageData(gpu.canvas.px, STAGE_W, STAGE_H), 0, 0);
    this.tex.refresh();
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
