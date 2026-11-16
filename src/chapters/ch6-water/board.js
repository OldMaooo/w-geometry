// 渠的横截面图板（盖在 3D 上的一块 SVG）：切开渠看，是一个梯形（或长方形）。
// 三个金色把手：渠口宽 t、渠底宽 b、深度 d（整数格）。里面实时铺格子、数格数（= 每次能过的水量）。
// 坡太陡的土会垮下来：垮下来的土落进渠里，渠变小。只给第 6 章（6-4、6-6）用。
import { effectiveSection, trapArea } from './math.js';
import { injectStyles, mountDom, go, dur } from './kit.js';

const CSS = `
.c6-board { position: absolute; right: 14px; top: 92px; width: 404px; z-index: 5; pointer-events: auto; touch-action: none;
  background: rgba(255, 248, 234, 0.95); border: 2px solid var(--ridge, #8b6b43); border-radius: 22px; padding: 10px 8px 8px; }
.c6-board .c6-cap { display: flex; align-items: center; justify-content: space-between; padding: 0 10px 2px; font-size: 20px; color: var(--ink, #4a3a28); min-height: 34px; }
.c6-board .c6-cap b { font-size: 24px; }
.c6-board svg { display: block; width: 100%; height: auto; touch-action: none; user-select: none; }
.c6-board .c6-num { text-align: center; font-size: 36px; font-weight: 700; color: var(--ink, #4a3a28); padding: 0 0 2px; transition: color .2s; }
.c6-board .c6-num small { font-size: 20px; font-weight: 500; margin-left: 4px; }
.c6-board .c6-num.ok { color: #3F8F3A; }
.c6-board.locked .hnd { pointer-events: none; opacity: .45; }
.c6-board .hnd { cursor: grab; }
.c6-board .hnd:active { cursor: grabbing; }
@media (hover: hover) { .c6-board .hnd:hover circle { filter: brightness(1.1); } }
.c6-board text { font-family: inherit; fill: #4a3a28; }
`;

const NS = 'http://www.w3.org/2000/svg';
const el = (name, attrs = {}, parent) => {
  const e = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  parent?.appendChild(e);
  return e;
};
const fmt = (n) => (Math.round(n * 10) / 10).toString();

const VW = 400, VH = 300, CX = 200, YT = 64, U = 25;

/**
 * @param {any} ctx
 * @param {{ mode: 'square'|'trap'|'fixed', sec: {b:number,t:number,d:number}, target?: number, minSlope?: number,
 *   caption?: string, maxD?: number, maxT?: number }} o
 */
export function makeSectionBoard(ctx, o) {
  injectStyles(ctx, CSS);
  const mode = o.mode;
  const minSlope = o.minSlope ?? 0;
  const maxD = o.maxD ?? 6, maxW = o.maxT ?? 10;
  let sec = { ...o.sec };
  const root = document.createElement('div');
  root.className = 'c6-board';
  const cap = document.createElement('div');
  cap.className = 'c6-cap';
  cap.innerHTML = o.caption ?? (o.target ? `每天要 <b>${o.target}</b> 桶水` : '');
  const svg = el('svg', { viewBox: `0 0 ${VW} ${VH}` });
  const num = document.createElement('div');
  num.className = 'c6-num';
  root.append(cap, svg, num);
  mountDom(ctx, root);

  // 背景：天、地、土
  el('rect', { x: 0, y: 0, width: VW, height: YT, fill: '#DCEEF7', rx: 10 }, svg);
  el('rect', { x: 0, y: YT - 10, width: VW, height: 10, fill: '#A3C46C' }, svg);
  el('rect', { x: 0, y: YT, width: VW, height: VH - YT, fill: '#C79B5E' }, svg);
  for (let i = 0; i < 26; i++) el('rect', { x: (i * 53) % 392, y: YT + 12 + ((i * 37) % 210), width: 6, height: 3, fill: '#B3874F', rx: 1.5 }, svg);
  const dyn = el('g', {}, svg);
  const hndG = el('g', {}, svg);
  const X = (v) => CX + v * U;
  const Y = (v) => YT + v * U;

  let eff = effectiveSection(sec, minSlope);
  let lockedAll = false;
  const listeners = new Set(), releases = new Set();

  const halfAt = (s, y) => s.t / 2 - ((s.t - s.b) / 2) * (y / s.d); // 深度 y 处的半宽

  function draw() {
    eff = effectiveSection(sec, minSlope);
    dyn.replaceChildren();
    const e = eff;
    // 渠（空腔）
    const poly = (pts, attrs) => el('polygon', { points: pts.map(([x, y]) => `${X(x)},${Y(y)}`).join(' '), ...attrs }, dyn);
    poly([[-e.t / 2, 0], [e.t / 2, 0], [e.b / 2, e.d], [-e.b / 2, e.d]], { fill: '#BFE0F4' });
    // 格子：每一行一个小梯形，里面的竖线从渠底左端起每隔 1 一条
    for (let j = 0; j < e.d; j++) {
      const w2 = halfAt(e, j + 1);
      const x0 = -e.b / 2;
      for (let k = Math.ceil(-w2 - x0 + 1e-9); x0 + k < w2 - 1e-9; k++) {
        const x = x0 + k;
        if (Math.abs(x) < w2 - 1e-9) el('line', { x1: X(x), y1: Y(j), x2: X(x), y2: Y(j + 1), stroke: '#fff', 'stroke-width': 1.6, opacity: 0.9 }, dyn);
      }
      el('line', { x1: X(-halfAt(e, j)), y1: Y(j), x2: X(halfAt(e, j)), y2: Y(j), stroke: '#fff', 'stroke-width': 1.6, opacity: 0.9 }, dyn);
    }
    el('line', { x1: X(-e.b / 2), y1: Y(e.d), x2: X(e.b / 2), y2: Y(e.d), stroke: '#fff', 'stroke-width': 1.6 }, dyn);
    // 轮廓
    poly([[-e.t / 2, 0], [e.t / 2, 0], [e.b / 2, e.d], [-e.b / 2, e.d]], { fill: 'none', stroke: '#6B4E2A', 'stroke-width': 3, 'stroke-linejoin': 'round' });
    // 垮下来的土
    if (e.collapsed) {
      poly([[-e.t / 2, 0], [-e.b / 2, e.d], [-sec.b / 2, e.d]], { fill: '#B3874F', stroke: '#6B4E2A', 'stroke-width': 2, 'stroke-dasharray': '5 4' });
      poly([[e.t / 2, 0], [e.b / 2, e.d], [sec.b / 2, e.d]], { fill: '#B3874F', stroke: '#6B4E2A', 'stroke-width': 2, 'stroke-dasharray': '5 4' });
    }
    // 尺寸
    const txt = (x, y, s, anchor = 'middle', size = 18) => { const t = el('text', { x, y, 'text-anchor': anchor, 'font-size': size }, dyn); t.textContent = s; return t; };
    txt(X(0), Y(0) - 12, `口 ${sec.t}`);
    if (mode !== 'square') txt(X(0), Y(e.d) + 24, `底 ${sec.b}`);
    txt(X(sec.t / 2) + 12, Y(e.d / 2) + 6, `深 ${sec.d}`, 'start');
    // 数字
    const area = trapArea(e);
    num.innerHTML = `${fmt(area)}<small>格</small>`;
    num.classList.toggle('ok', o.target !== undefined && Math.abs(area - o.target) < 1e-9 && !e.collapsed);
    placeHandles();
  }

  // ---------------------------------------------------------------- 把手
  const hs = {};
  function handle(name, color) {
    const g = el('g', { class: 'hnd' }, hndG);
    el('circle', { r: 17, fill: color, stroke: '#B77E12', 'stroke-width': 3 }, g);
    const arrow = (d) => el('path', { d, fill: '#7A4A06' }, g);
    if (name === 'd') { arrow('M0 -11 L5 -4 L-5 -4 Z'); arrow('M0 11 L5 4 L-5 4 Z'); } else { arrow('M-11 0 L-4 -5 L-4 5 Z'); arrow('M11 0 L4 -5 L4 5 Z'); }
    hs[name] = g;
    return g;
  }
  if (mode !== 'fixed') {
    handle('t', '#F2B134');
    if (mode === 'trap') handle('b', '#F2B134');
    handle('d', '#F2B134');
  }
  function placeHandles() {
    if (hs.t) hs.t.setAttribute('transform', `translate(${X(sec.t / 2)},${mode === 'square' ? Y(sec.d / 2) : Y(0)})`);
    if (hs.b) hs.b.setAttribute('transform', `translate(${X(sec.b / 2)},${Y(sec.d)})`);
    if (hs.d) hs.d.setAttribute('transform', `translate(${X(0)},${Y(sec.d)})`);
  }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  /** 改一个或几个量（整数），触发变化事件。 */
  function setSec(n, { sound = true } = {}) {
    let { b, t, d } = { ...sec, ...n };
    d = clamp(Math.round(d), 1, maxD);
    if (mode === 'square') { t = clamp(Math.round(t ?? b), 1, maxW); b = t; } else {
      b = clamp(Math.round(b), 1, maxW); t = clamp(Math.round(t), b, maxW);
      if (n.b !== undefined && n.t === undefined && sec.t < b) t = b;
    }
    if (b === sec.b && t === sec.t && d === sec.d) return;
    sec = { b, t, d };
    if (sound) ctx.audio.play('tick');
    draw();
    listeners.forEach((fn) => fn(sec, eff));
  }
  const pt = (e) => {
    const r = svg.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * VW, y: ((e.clientY - r.top) / r.height) * VH };
  };
  for (const [name, g] of Object.entries(hs)) {
    let on = false;
    g.addEventListener('pointerdown', (e) => {
      if (lockedAll) return;
      on = true; g.setPointerCapture(e.pointerId); ctx.audio.play('pick'); e.stopPropagation();
    });
    g.addEventListener('pointermove', (e) => {
      if (!on) return;
      const p = pt(e);
      if (name === 'd') setSec({ d: (p.y - YT) / U });
      else if (name === 't') setSec({ t: (2 * (p.x - CX)) / U });
      else setSec({ b: (2 * (p.x - CX)) / U });
    });
    const up = () => { if (!on) return; on = false; ctx.audio.play('drop'); releases.forEach((fn) => fn(sec, eff)); };
    g.addEventListener('pointerup', up);
    g.addEventListener('pointercancel', up);
  }

  // ---------------------------------------------------------------- 切拼（梯形 → 长方形）
  /** 把梯形两头的小三角各转半圈，补进下面的缺口：拼成长方形。 */
  async function cutAndPaste() {
    lockedAll = true;
    const { t, b, d } = sec;
    const m = (t + b) / 2;
    dyn.replaceChildren();
    const poly = (pts, attrs, parent = dyn) => el('polygon', { points: pts.map(([x, y]) => `${X(x)},${Y(y)}`).join(' '), ...attrs }, parent);
    // 中间那块
    poly([[-m / 2, 0], [m / 2, 0], [m / 2, d / 2], [b / 2, d], [-b / 2, d], [-m / 2, d / 2]], { fill: '#BFE0F4', stroke: '#6B4E2A', 'stroke-width': 3, 'stroke-linejoin': 'round' });
    const L = el('g', {}, dyn), Rr = el('g', {}, dyn);
    poly([[-t / 2, 0], [-m / 2, 0], [-m / 2, d / 2]], { fill: '#F2B134', stroke: '#B77E12', 'stroke-width': 3, 'stroke-linejoin': 'round' }, L);
    poly([[t / 2, 0], [m / 2, 0], [m / 2, d / 2]], { fill: '#F2B134', stroke: '#B77E12', 'stroke-width': 3, 'stroke-linejoin': 'round' }, Rr);
    const cL = [X(-m / 2), Y(d / 2)], cR = [X(m / 2), Y(d / 2)];
    ctx.audio.play('cut');
    await go(ctx.fx.tween({
      duration: dur(ctx, 600), ease: 'out',
      onUpdate: (k) => { L.setAttribute('transform', `translate(0,${-14 * k})`); Rr.setAttribute('transform', `translate(0,${-14 * k})`); },
    }));
    ctx.audio.play('rotate');
    await go(ctx.fx.tween({
      duration: dur(ctx, 1500), ease: 'inOut',
      onUpdate: (k) => {
        const a = 180 * k, lift = -14 * (1 - k);
        L.setAttribute('transform', `translate(0,${lift}) rotate(${a} ${cL[0]} ${cL[1]})`);
        Rr.setAttribute('transform', `translate(0,${lift}) rotate(${-a} ${cR[0]} ${cR[1]})`);
      },
    }));
    L.setAttribute('transform', `rotate(180 ${cL[0]} ${cL[1]})`);
    Rr.setAttribute('transform', `rotate(-180 ${cR[0]} ${cR[1]})`);
    ctx.audio.play('place');
    await ctx.wait(500);
    // 长方形：m 个一行，d 行
    const g2 = el('g', {}, dyn);
    for (let j = 0; j <= d; j++) el('line', { x1: X(-m / 2), y1: Y(j), x2: X(m / 2), y2: Y(j), stroke: '#fff', 'stroke-width': 2 }, g2);
    for (let i = 0; i <= m; i++) el('line', { x1: X(-m / 2 + i), y1: Y(0), x2: X(-m / 2 + i), y2: Y(d), stroke: '#fff', 'stroke-width': 2 }, g2);
    el('rect', { x: X(-m / 2), y: Y(0), width: m * U, height: d * U, fill: 'none', stroke: '#6B4E2A', 'stroke-width': 3 }, g2);
    const t1 = el('text', { x: X(0), y: Y(d) + 26, 'text-anchor': 'middle', 'font-size': 22 }, g2);
    t1.textContent = `${fmt(m)} 个一行，${d} 行`;
    num.innerHTML = `${fmt(m * d)}<small>格</small>`;
    num.classList.add('ok');
    return { m, rows: d, total: m * d };
  }

  draw();
  const api = {
    root,
    get sec() { return { ...sec }; },
    get eff() { return { ...eff }; },
    get area() { return trapArea(eff); },
    set: setSec,
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    onRelease(fn) { releases.add(fn); return () => releases.delete(fn); },
    lock(on = true) { lockedAll = on; root.classList.toggle('locked', on); },
    cutAndPaste,
    setCaption(h) { cap.innerHTML = h; },
    hide() { root.style.display = 'none'; },
    remove() { root.remove(); },
    /** 假手：把 b / t / d 慢慢调到目标（演示 / solve 用，会触发变化和「松手」事件）。 */
    async tweenTo(n, ms = 1100) {
      const from = { ...sec };
      await go(ctx.fx.tween({
        duration: dur(ctx, ms), ease: 'inOut',
        onUpdate: (k) => setSec({
          d: from.d + ((n.d ?? from.d) - from.d) * k,
          ...(mode === 'trap' ? { b: from.b + ((n.b ?? from.b) - from.b) * k } : {}),
          t: from.t + ((n.t ?? n.b ?? from.t) - from.t) * k,
        }, { sound: false }),
      }));
      setSec(n, { sound: false });
      releases.forEach((fn) => fn(sec, eff));
    },
    /** 把手在屏幕上的位置（幽灵手示范用）。 */
    handlePos(name) {
      const g = hs[name];
      if (!g) return null;
      const r = g.getBoundingClientRect();
      const rr = root.getBoundingClientRect();
      return { x: r.left + r.width / 2 - rr.left, y: r.top + r.height / 2 - rr.top };
    },
  };
  return api;
}
