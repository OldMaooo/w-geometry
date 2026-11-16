// 第 5 章共用小工具：页面小样式、屏幕上的「步格滑块」、幽灵手（DOM 版）、色表。只给本章用。
import * as THREE from 'three';
import { icon } from '../../engine/icons.js';

export const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
export const C = {
  water: '#4FA8DC',
  grain: '#E8B53C',
  clay: '#C8553D',
  clay2: '#B9836B',
  wood: '#A47148',
  woodDark: '#7A5230',
  glass: '#E9DDBF',
  line: '#4A3A28',
  gold: '#F2B134',
  ok: '#7BC96A',
  straw: '#DCC27C',
};

/** 往页面上加一小段样式，离开关卡时自动撤掉。 */
export function injectStyles(ctx, css) {
  const el = document.createElement('style');
  el.textContent = css;
  document.head.appendChild(el);
  ctx.onDispose(() => el.remove());
}

/** 把 DOM 挂到应用上层，离开关卡时自动拆掉。 */
export function mountDom(ctx, el) {
  (document.getElementById('app') || document.body).appendChild(el);
  ctx.onDispose(() => el.remove());
  return el;
}

const CSS = `
.c5-panel { position: absolute; right: 14px; top: 96px; z-index: 5; pointer-events: auto; width: 360px;
  background: rgba(255, 248, 234, 0.94); border: 2px solid var(--ridge, #8b6b43); border-radius: 22px; padding: 12px 16px 14px;
  display: flex; flex-direction: column; gap: 10px; touch-action: none; transition: opacity .25s; }
.c5-panel.left { right: auto; left: 14px; }
.c5-panel.locked { opacity: .55; pointer-events: none; }
.c5-panel.gone { display: none; }
.c5-panel .c5-info { font-size: 21px; color: var(--ink, #4a3a28); min-height: 28px; display: flex; gap: 10px; align-items: baseline; flex-wrap: wrap; }
.c5-panel .c5-info:empty { display: none; }
.c5-panel .c5-info b { font-size: 26px; font-weight: 600; font-variant-numeric: tabular-nums; }
.c5-panel .c5-info .ok { color: #3f8a2e; }
.c5-sl { display: flex; align-items: center; gap: 12px; font-size: 22px; color: var(--ink, #4a3a28); }
.c5-sl > span { width: 40px; text-align: center; flex: none; }
.c5-track { position: relative; flex: 1; height: 56px; touch-action: none; cursor: pointer; }
.c5-track::before { content: ''; position: absolute; left: 22px; right: 22px; top: 25px; height: 6px; border-radius: 3px; background: #d9c9a6; }
.c5-dot { position: absolute; top: 22px; width: 12px; height: 12px; margin-left: -6px; border-radius: 6px; background: #b99d6c; pointer-events: none; }
.c5-cap { position: absolute; top: 44px; transform: translateX(-50%); font-size: 16px; color: var(--ink-2, #7a6650); white-space: nowrap; pointer-events: none; }
.c5-thumb { position: absolute; top: 6px; width: 44px; height: 44px; margin-left: -22px; border-radius: 22px; background: #F9C846;
  border: 3px solid #E29A1B; color: #5b3a06; display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 600;
  cursor: grab; touch-action: none; user-select: none; }
.c5-thumb.snap { transition: left .16s cubic-bezier(.2,1.4,.4,1); }
.c5-thumb:active { cursor: grabbing; }
@media (hover: hover) { .c5-thumb:hover { filter: brightness(1.08); } .c5-track:hover .c5-thumb { border-color: #d28a0f; } }
.c5-hand { position: absolute; width: 44px; height: 44px; margin: -6px 0 0 -14px; color: #4A3A28; pointer-events: none; z-index: 7;
  filter: drop-shadow(0 2px 2px rgba(0,0,0,.25)); }
.c5-hand svg { width: 44px; height: 44px; }
`;

/** 本章的屏幕小控件样式（只注入一次/关）。 */
export function ensureStyle(ctx) {
  if (ctx.state._c5style) return;
  ctx.state._c5style = true;
  injectStyles(ctx, CSS);
}

/**
 * 一块靠边的小面板。结算前记得 panel.remove()。
 * @param {any} ctx @param {{ side?: 'left'|'right', top?: number, width?: number }} [o]
 */
export function makePanel(ctx, o = {}) {
  ensureStyle(ctx);
  const el = document.createElement('div');
  el.className = `c5-panel${o.side === 'left' ? ' left' : ''}`;
  if (o.top !== undefined) el.style.top = `${o.top}px`;
  if (o.width) el.style.width = `${o.width}px`;
  mountDom(ctx, el);
  return {
    el,
    /** 加一个子元素 */
    add(child) { el.appendChild(child); return child; },
    lock(on = true) { el.classList.toggle('locked', on); },
    remove() { el.remove(); },
  };
}

/** 一行说明（信息条）。返回 { el, html(text) }。 */
export function makeInfo(panel) {
  const el = document.createElement('div');
  el.className = 'c5-info';
  panel.add(el);
  return { el, html(t) { el.innerHTML = t; } };
}

/**
 * 步格滑块：一条轨道上有 min..max 个点，拖圆钮或点轨道都行；松手吸到最近的整数。
 * continuous：拖的时候也不断汇报小数（onInput），5-5 用它让围囤的形状顺滑地变。
 * @param {any} ctx
 * @param {{ label: string, min?: number, max?: number, value?: number, caps?: string[], continuous?: boolean,
 *   onChange?: (v:number)=>void, onInput?: (f:number)=>void }} o
 */
export function makeSlider(ctx, panel, o) {
  const min = o.min ?? 1, max = o.max ?? 8;
  let value = o.value ?? min;
  const row = document.createElement('div');
  row.className = 'c5-sl';
  const lab = document.createElement('span');
  lab.textContent = o.label;
  const track = document.createElement('div');
  track.className = 'c5-track';
  const dots = [];
  const frac = (v) => (max === min ? 0 : (v - min) / (max - min));
  // 轨道两端各让出 22px（圆钮半径）
  const px = (v) => `calc(22px + (100% - 44px) * ${frac(v)})`;
  for (let v = min; v <= max; v++) {
    const d = document.createElement('i');
    d.className = 'c5-dot';
    d.style.left = px(v);
    track.appendChild(d);
    dots.push(d);
    if (o.caps?.[v - min]) {
      const c = document.createElement('em');
      c.className = 'c5-cap';
      c.style.left = px(v);
      c.style.fontStyle = 'normal';
      c.textContent = o.caps[v - min];
      track.appendChild(c);
    }
  }
  const thumb = document.createElement('b');
  thumb.className = 'c5-thumb snap';
  track.appendChild(thumb);
  row.append(lab, track);
  panel.add(row);

  const place = (f) => { thumb.style.left = px(f); };
  const show = (v) => { thumb.textContent = o.caps ? '' : String(v); };
  place(value); show(value);

  const fromEvent = (e) => {
    const r = track.getBoundingClientRect();
    const t = Math.min(1, Math.max(0, (e.clientX - r.left - 22) / Math.max(1, r.width - 44)));
    return min + t * (max - min);
  };
  const setInt = (v, silent) => {
    const nv = Math.min(max, Math.max(min, Math.round(v)));
    const changed = nv !== value;
    value = nv;
    show(value);
    if (changed && !silent) { ctx.audio.play('tick'); o.onChange?.(value); }
    return changed;
  };
  let dragging = false;
  track.addEventListener('pointerdown', (e) => {
    dragging = true;
    track.setPointerCapture(e.pointerId);
    thumb.classList.remove('snap');
    const f = fromEvent(e);
    place(f);
    if (o.continuous) o.onInput?.(f);
    else setInt(f);
    e.preventDefault();
  });
  track.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const f = fromEvent(e);
    place(f);
    if (o.continuous) o.onInput?.(f);
    else setInt(f);
  });
  const end = (e) => {
    if (!dragging) return;
    dragging = false;
    thumb.classList.add('snap');
    const f = fromEvent(e);
    setInt(f);
    place(value);
    if (o.continuous) o.onInput?.(value);
    if (o.continuous) o.onChange?.(value);
  };
  track.addEventListener('pointerup', end);
  track.addEventListener('pointercancel', end);

  const api = {
    el: row, track, thumb,
    get value() { return value; },
    /** 程序设定（演示用），走和手拖一样的回调。 */
    set(v, { silent = false } = {}) {
      thumb.classList.add('snap');
      const nv = Math.min(max, Math.max(min, Math.round(v)));
      value = nv;
      show(value);
      place(value);
      if (!silent) { ctx.audio.play('tick'); if (o.continuous) o.onInput?.(value); o.onChange?.(value); }
    },
    /** 圆钮在屏幕上的中心（给幽灵手用）。 */
    thumbCenter() { const r = thumb.getBoundingClientRect(); const h = (document.getElementById('app') || document.body).getBoundingClientRect(); return { x: r.left + r.width / 2 - h.left, y: r.top + r.height / 2 - h.top }; },
    dotCenter(v) { const r = dots[v - min].getBoundingClientRect(); const h = (document.getElementById('app') || document.body).getBoundingClientRect(); return { x: r.left + r.width / 2 - h.left, y: r.top + r.height / 2 - h.top }; },
  };
  return api;
}

/** 幽灵手（DOM 版）：从 from() 滑到 to()（相对应用的像素），返回停止函数。 */
export function domGhost(ctx, from, to, ms = 1700) {
  ensureStyle(ctx);
  const host = document.getElementById('app') || document.body;
  const el = document.createElement('div');
  el.className = 'c5-hand';
  el.appendChild(icon('pointer', { size: 44, stroke: 2 }));
  host.appendChild(el);
  let t = 0;
  const off = ctx.onUpdate((dt) => {
    t += dt * 1000;
    const k = (t % ms) / ms;
    const e = k < 0.15 ? 0 : k > 0.85 ? 1 : (k - 0.15) / 0.7;
    const f = from(), g = to();
    const q = e * e * (3 - 2 * e);
    el.style.left = `${f.x + (g.x - f.x) * q}px`;
    el.style.top = `${f.y + (g.y - f.y) * q}px`;
    el.style.opacity = k < 0.08 || k > 0.92 ? '0.4' : '1';
  });
  const stop = () => { off?.(); el.remove(); };
  ctx.onDispose(stop);
  return stop;
}

/** 一束半透明的格子线条材质（调试 / 外框用）。 */
export const lineMat = (color = C.line, opacity = 0.6) => new THREE.LineBasicMaterial({ color, transparent: true, opacity });

/** ctx.waitFor 的安全版：先建好、过一会儿才 await 的等待，离开关卡被作废时不会冒出「未处理」的报错。 */
export function wf(ctx, exec) {
  const p = ctx.waitFor(exec);
  p.catch(() => {});
  return p;
}
