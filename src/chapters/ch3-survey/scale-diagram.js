// 放大小三角的图板（盖在 3D 上的一块 SVG）：一个小直角三角形（竖边 = 竿，横边 = 影），
// 抓住它的右角往右拉，三角形按整数倍放大，直到底边正好盖满那条长影子；这时竖边就是够不着的东西的高。
// 只给第 3 章用（3-2 量大树、3-6 隔海望山）。
import { showNum } from './math.js';
import { injectStyles, mountDom, domGhost } from './kit.js';

const CSS = `
.c3-board { position: absolute; right: 14px; top: 92px; width: 372px; z-index: 5; pointer-events: auto;
  background: rgba(255, 248, 234, 0.94); border: 2px solid var(--ridge, #8b6b43); border-radius: 22px; padding: 10px 6px 6px; touch-action: none; }
.c3-board .c3-cap { font-size: 20px; text-align: center; color: var(--ink, #4a3a28); padding: 0 8px 2px; min-height: 28px; }
.c3-board svg { display: block; width: 100%; height: auto; touch-action: none; }
.c3-board.locked { pointer-events: none; }
.c3-board .hit { cursor: grab; }
.c3-board .hit:active { cursor: grabbing; }
@media (hover: hover) { .c3-board .hit:hover + .knob { filter: brightness(1.12); } }
.c3-board text { font-family: inherit; fill: #4a3a28; }
`;

const NS = 'http://www.w3.org/2000/svg';
const el = (name, attrs = {}) => {
  const e = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  return e;
};

/**
 * @param {any} ctx
 * @param {{ base:number, height:number, target:number, caption?:string, stripName?:string, baseName?:string,
 *   heightName?:string, unit?:string, heightOf?:(k:number)=>string }} o
 *   base / height：小三角的横边、竖边（步）；target：要盖满的那一长条（步）。
 */
export function makeScaleBoard(ctx, o) {
  injectStyles(ctx, CSS);
  const { base: b, height: hh, target } = o;
  const kGoal = Math.round((target / b) * 1000) / 1000;
  const kMax = Math.ceil(kGoal) + 2;
  const VW = 360, VH = 316, OX = 46, OY = 250;
  const u = Math.min((VW - OX - 18) / Math.max(target, b * kMax * 0.7), 200 / (hh * kGoal));
  const root = document.createElement('div');
  root.className = 'c3-board';
  if (o.side === 'left') { root.style.right = 'auto'; root.style.left = '14px'; }
  const cap = document.createElement('div');
  cap.className = 'c3-cap';
  cap.textContent = o.caption ?? '';
  const svg = el('svg', { viewBox: `0 0 ${VW} ${VH}` });
  root.append(cap, svg);
  mountDom(ctx, root);

  // 目标长条
  const x1 = OX + target * u;
  const strip = el('rect', { x: OX, y: OY + 6, width: target * u, height: 16, rx: 5, fill: '#E7D3A0', stroke: '#8B6B43', 'stroke-width': 2 });
  svg.appendChild(strip);
  for (let t = 1; t < target; t += target > 14 ? 2 : 1) {
    svg.appendChild(el('line', { x1: OX + t * u, y1: OY + 6, x2: OX + t * u, y2: OY + 15, stroke: '#8B6B43', 'stroke-width': 1.5 }));
  }
  const goalMark = el('line', { x1, y1: OY - hh * kGoal * u - 6, x2: x1, y2: OY + 28, stroke: '#F2B134', 'stroke-width': 3.5, 'stroke-dasharray': '7 6', 'stroke-linecap': 'round' });
  svg.appendChild(goalMark);
  const stripLbl = el('text', { x: x1, y: OY + 50, 'text-anchor': 'end', 'font-size': 20 });
  stripLbl.textContent = `${o.stripName ?? '长条'} ${showNum(target)}`;
  svg.appendChild(stripLbl);
  // 地基线
  svg.appendChild(el('line', { x1: OX - 14, y1: OY, x2: VW - 8, y2: OY, stroke: '#8B6B43', 'stroke-width': 2.5, 'stroke-linecap': 'round' }));

  // 小三角（k=1 的底）和放大后的三角
  const small = el('polygon', { fill: 'rgba(242,177,52,0.45)', stroke: '#B77E12', 'stroke-width': 2 });
  const big = el('polygon', { fill: 'rgba(143,207,226,0.28)', stroke: '#3C7FA0', 'stroke-width': 3, 'stroke-linejoin': 'round' });
  svg.append(big, small);
  const rightAngle = el('path', { fill: 'none', stroke: '#3C7FA0', 'stroke-width': 2 });
  svg.appendChild(rightAngle);
  const hLbl = el('text', { 'font-size': 22, 'text-anchor': 'end', 'font-weight': 700 });
  const bLbl = el('text', { 'font-size': 22, 'text-anchor': 'middle', 'font-weight': 700 });
  const kLbl = el('text', { 'font-size': 30, 'text-anchor': 'middle', 'font-weight': 700 });
  svg.append(hLbl, bLbl, kLbl);
  // 手柄
  const hit = el('circle', { r: 38, fill: 'transparent', class: 'hit' });
  const knob = el('circle', { r: 17, fill: '#F9C846', stroke: '#E29A1B', 'stroke-width': 3.5, class: 'knob', 'pointer-events': 'none' });
  const arrow = el('path', { d: 'M -7 0 L 7 0 M 3 -4 L 7 0 L 3 4 M -3 -4 L -7 0 L -3 4', stroke: '#7A4A06', 'stroke-width': 2.4, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'pointer-events': 'none' });
  svg.append(hit, knob, arrow);

  const state = { k: 1, locked: false, hit: false };
  const fns = new Set();
  const api = {
    root,
    get k() { return state.k; },
    get goal() { return kGoal; },
    onRelease(fn) { fns.add(fn); return () => fns.delete(fn); },
    setK(k, quiet = false) {
      const kk = Math.min(kMax, Math.max(1, k));
      const changed = kk !== state.k;
      state.k = kk;
      draw();
      if (changed && !quiet) ctx.audio.play('tick');
    },
    lock(on = true) { state.locked = on; root.classList.toggle('locked', on); },
    setCaption(t) { cap.textContent = t; },
    /** 假手：拉到第 k 倍。 */
    async simulateTo(k, ms = 1100) {
      const from = state.k;
      await ctx.fx.tween({
        duration: ms, ease: 'inOut',
        onUpdate: (e) => api.setK(Math.round(from + (k - from) * e)),
      });
      api.setK(k);
      fire();
    },
    ghost(kTo) {
      const sc = () => root.getBoundingClientRect();
      const toPx = (k) => {
        const r = sc();
        return { x: ((OX + k * b * u) / VW) * r.width + 6, y: (OY / VH) * r.height + 12 };
      };
      return domGhost(ctx, root, () => toPx(state.k), () => toPx(kTo));
    },
    /** 淡出再拆掉（结算前收起图板，免得压着结算面板）。 */
    async fadeOut(ms = 400) { root.style.transition = `opacity ${ms}ms`; root.style.opacity = '0'; await ctx.wait(ms + 30); root.remove(); },
    remove() { root.remove(); },
  };
  function fire() { fns.forEach((fn) => fn(state.k)); }

  function draw() {
    const k = state.k;
    const bx = OX + k * b * u, by = OY - k * hh * u;
    big.setAttribute('points', `${OX},${OY} ${bx},${OY} ${OX},${by}`);
    small.setAttribute('points', `${OX},${OY} ${OX + b * u},${OY} ${OX},${OY - hh * u}`);
    rightAngle.setAttribute('d', `M ${OX + 14} ${OY} L ${OX + 14} ${OY - 14} L ${OX} ${OY - 14}`);
    hLbl.setAttribute('x', OX - 8);
    hLbl.setAttribute('y', OY - (k * hh * u) / 2 + 7);
    hLbl.textContent = o.heightOf ? o.heightOf(k) : showNum(k * hh);
    bLbl.setAttribute('x', OX + (k * b * u) / 2);
    // 底边的数放在三角形里贴着底线（不压在下面的长条上）；三角形太扁放不下时才放到线下面
    bLbl.setAttribute('y', (k * hh * u) / 2 >= 34 ? OY - 9 : OY + 24);
    bLbl.textContent = showNum(k * b);
    kLbl.setAttribute('x', OX + (k * b * u) * 0.62);
    kLbl.setAttribute('y', OY - k * hh * u * 0.28 - 8);
    kLbl.textContent = k === 1 ? '' : `×${k}`;
    for (const e of [hit, knob]) { e.setAttribute('cx', bx); e.setAttribute('cy', OY); }
    arrow.setAttribute('transform', `translate(${bx} ${OY})`);
    const hitGoal = Math.abs(k - kGoal) < 1e-6;
    state.hit = hitGoal;
    big.setAttribute('fill', hitGoal ? 'rgba(123,201,106,0.45)' : 'rgba(143,207,226,0.28)');
    big.setAttribute('stroke', hitGoal ? '#4E9C3E' : '#3C7FA0');
    goalMark.setAttribute('stroke', hitGoal ? '#4E9C3E' : '#F2B134');
    // 底边在条里面时用深色字，超过了就淡一点
    bLbl.setAttribute('opacity', k * b * u < 26 ? 0 : 1);
  }
  draw();

  // 拖：横向位置换算成倍数
  let dragging = false;
  const toK = (e) => {
    const r = svg.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * VW;
    return Math.round((x - OX) / (b * u));
  };
  hit.addEventListener('pointerdown', (e) => {
    if (state.locked) return;
    dragging = true;
    hit.setPointerCapture(e.pointerId);
    ctx.audio.play('pick');
    e.stopPropagation();
  });
  hit.addEventListener('pointermove', (e) => { if (dragging) api.setK(toK(e)); });
  const up = () => { if (!dragging) return; dragging = false; ctx.audio.play('drop'); fire(); };
  hit.addEventListener('pointerup', up);
  hit.addEventListener('pointercancel', up);
  return api;
}
