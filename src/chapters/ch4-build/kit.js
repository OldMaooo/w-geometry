// 第 4 章共用小工具：方块世界（点格子放方块 / 点方块拿走 / 整层复制）、点按识别、进关慢慢转一点的镜头、
// 木条、「放 / 拿」工具按钮。只给本章用；引擎缺的能力都在这里补。
import * as THREE from 'three';
import { mat, geo, shared } from '../../engine/shared.js';

export const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
/** 自动演示 / solve 时把动画缩短。 */
export const dur = (ctx, ms) => (ctx.auto ? Math.min(ms, 300) : ms);
/** 不等结果的动画：离开关卡时被取消不算报错。 */
export const go = (p) => { p?.catch?.(() => {}); return p; };
export const C = {
  tileA: '#D9C28F',
  tileB: '#CEB57D',
  frame: '#8B6B43',
  block: ['#C79B5E', '#D6AB69', '#E0BC7C'],
  stone: ['#D8C08A', '#E3CD9B', '#CDB47B', '#EBD8A9'],
  wood: '#A47148',
  woodLight: '#C48E5A',
  river: '#5BA4CF',
  ok: '#7BC96A',
  gold: '#F2B134',
  paper: '#FFF8EA',
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

const glCanvas = () => /** @type {HTMLCanvasElement} */ (document.getElementById('gl'));

// ====================================================================
// 点按识别：点一下 = 点，按住拖 = 转视角（引擎自己管），所以两者不打架。
// ====================================================================
/**
 * @param {any} ctx
 * @param {{ onTap?: (ray: THREE.Raycaster, e: PointerEvent) => void, onHover?: (ray: THREE.Raycaster | null, e?: PointerEvent) => void }} h
 */
export function bindTaps(ctx, h) {
  const canvas = glCanvas();
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const setRay = (e) => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, ctx.camera);
    return ray;
  };
  const active = new Set();
  let down = null;
  const onDown = (e) => {
    active.add(e.pointerId);
    down = active.size === 1 ? { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now() } : null;
  };
  const onMove = (e) => {
    if (down && down.id === e.pointerId && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 9) down = null;
    if (e.pointerType === 'mouse' && !active.size) h.onHover?.(setRay(e), e);
  };
  const onUp = (e) => {
    active.delete(e.pointerId);
    if (down && down.id === e.pointerId && performance.now() - down.t < 700) {
      const d = down;
      down = null;
      h.onTap?.(setRay({ clientX: d.x, clientY: d.y }), e);
    }
    down = null;
  };
  const onCancel = (e) => { active.delete(e.pointerId); down = null; };
  const onLeave = () => h.onHover?.(null);
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onCancel);
  canvas.addEventListener('pointerleave', onLeave);
  const off = () => {
    canvas.removeEventListener('pointerdown', onDown);
    canvas.removeEventListener('pointermove', onMove);
    canvas.removeEventListener('pointerup', onUp);
    canvas.removeEventListener('pointercancel', onCancel);
    canvas.removeEventListener('pointerleave', onLeave);
  };
  ctx.onDispose(off);
  return { ray: (cx, cy) => setRay({ clientX: cx, clientY: cy }), off };
}

// ====================================================================
// 镜头：进关时慢慢转一点（玩家一伸手拖，就不再抢镜头）。
// ====================================================================
/**
 * @param {any} ctx
 * @param {{x:number,z:number}} center @param {number} radius
 * @param {{ yaw0: number, yaw1: number, pitch?: number, y?: number, ms?: number }} o 角度用度
 */
export function sweepIn(ctx, center, radius, o) {
  const pitch = o.pitch ?? 40, y = o.y ?? 0;
  const at = (yaw) => ctx.view.frame(center, radius, { yaw, pitch, y });
  ctx.view.frame(center, radius, { yaw: o.yaw0, pitch, y, instant: true });
  let stop = false;
  const canvas = glCanvas();
  const cancel = () => { stop = true; };
  canvas.addEventListener('pointerdown', cancel, { once: true });
  ctx.onDispose(() => canvas.removeEventListener('pointerdown', cancel));
  const ms = o.ms ?? 2800;
  return go(ctx.waitFor((done) => {
    let t = 0;
    const off = ctx.onUpdate((dt) => {
      t += dt * 1000;
      const k = Math.min(1, t / ms);
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      if (!stop) at(o.yaw0 + (o.yaw1 - o.yaw0) * (ctx.auto ? 1 : e));
      if (k >= 1 || ctx.auto || stop) { off(); done(); }
    });
  }));
}

// ====================================================================
// 方块
// ====================================================================
const boxGeo = () => geo('c4-box', () => new THREE.BoxGeometry(1, 1, 1));
const edgeGeo = () => geo('c4-edges', () => new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)));
let lineMat;
const edgeMat = () => (lineMat ||= shared(new THREE.LineBasicMaterial({ color: '#5A4020', transparent: true, opacity: 0.55 })));

/** 一块方块（带细边线，像乐高）。size 默认 0.985，留一道缝。 */
export function blockMesh(color, size = 0.985) {
  const m = new THREE.Mesh(boxGeo(), mat(color));
  m.scale.setScalar(size);
  m.castShadow = m.receiveShadow = true;
  const e = new THREE.LineSegments(edgeGeo(), edgeMat());
  m.add(e);
  return m;
}

/**
 * 通用方块世界：格子 (i,j,k) → 世界中心由 cell() 给。
 * @param {any} ctx
 * @param {{ cell: (i:number,j:number,k:number) => {x:number,y:number,z:number}, color: (i:number,j:number,k:number) => string, size?: number }} o
 */
export function makeBlocks(ctx, o) {
  const group = ctx.add(new THREE.Group());
  /** @type {Map<string, any>} */
  const map = new Map();
  const key = (i, j, k) => `${i},${j},${k}`;
  const api = {
    group,
    map,
    key,
    has: (i, j, k) => map.has(key(i, j, k)),
    get count() { return map.size; },
    meshes: () => [...map.values()],
    /** 放一块：从上面落下来，「咔」一声，落地弹一下。 */
    add(i, j, k, opt = {}) {
      if (map.has(key(i, j, k))) return null;
      const p = o.cell(i, j, k);
      const m = blockMesh(o.color(i, j, k), o.size);
      m.position.set(p.x, p.y, p.z);
      m.userData = { i, j, k, block: true };
      group.add(m);
      map.set(key(i, j, k), m);
      if (opt.sound !== false) ctx.audio.play('place');
      if (opt.anim === false) return m;
      m.visible = opt.delay ? false : true;
      const s0 = o.size ?? 0.985;
      const drop = opt.drop ?? 0.9;
      const run = () => {
        m.visible = true;
        go(ctx.fx.tween({
          duration: 340, ease: 'linear',
          onUpdate: (k2) => {
            const f = Math.min(1, k2 / 0.55);
            m.position.y = p.y + (1 - f * f) * drop;
            const b = k2 > 0.55 ? Math.sin(((k2 - 0.55) / 0.45) * Math.PI) * 0.1 : 0;
            m.scale.set(s0 * (1 + b), s0 * (1 - b * 1.2), s0 * (1 + b));
          },
        }).then(() => { m.position.y = p.y; m.scale.setScalar(s0); }));
      };
      if (opt.delay) ctx.after(opt.delay, run); else run();
      return m;
    },
    /** 拿走一块：缩小消失。 */
    remove(i, j, k, opt = {}) {
      const m = map.get(key(i, j, k));
      if (!m) return false;
      map.delete(key(i, j, k));
      if (opt.sound !== false) ctx.audio.play('soft');
      if (opt.anim === false) { ctx.remove(m); return true; }
      const s0 = m.scale.x;
      go(ctx.fx.tween({ duration: 170, ease: 'in', onUpdate: (k2) => m.scale.setScalar(Math.max(0.001, s0 * (1 - k2))) })
        .then(() => ctx.remove(m)));
      return true;
    },
    clear() { for (const m of map.values()) ctx.remove(m); map.clear(); },
  };
  return api;
}

// ====================================================================
// 柱子式搭法：w×d 的底座格，每格一摞，最高 cap。点格子 / 点方块的顶或侧面 = 在那一摞上再叠一块。
// ====================================================================
/**
 * @param {any} ctx
 * @param {{ w: number, d: number, cap: number, ox: number, oz: number, colors?: string[] }} o
 *   (ox, oz) 是底座左上角（最远最左）的世界坐标，z 越大越靠近镜头。
 */
export function makeColumns(ctx, o) {
  const { w, d, cap, ox, oz } = o;
  const cols = o.colors || C.block;
  const cx = (x) => ox + x + 0.5, cz = (z) => oz + z + 0.5;
  const blocks = makeBlocks(ctx, {
    cell: (x, z, y) => ({ x: cx(x), y: y + 0.5, z: cz(z) }),
    color: (x, z, y) => cols[(y + ((x + z) % 2)) % cols.length],
  });
  const heights = Array.from({ length: d }, () => Array(w).fill(0));
  // 底座格
  const base = ctx.add(new THREE.Group());
  const tiles = [];
  for (let z = 0; z < d; z++) for (let x = 0; x < w; x++) {
    const t = new THREE.Mesh(boxGeo(), mat((x + z) % 2 ? C.tileA : C.tileB));
    t.scale.set(0.97, 0.1, 0.97);
    t.position.set(cx(x), 0.03, cz(z));
    t.receiveShadow = true;
    t.userData = { tile: true, x, z };
    base.add(t);
    tiles.push(t);
  }
  const rim = [[w + 0.4, 0.16, 0.2, ox + w / 2, oz - 0.1], [w + 0.4, 0.16, 0.2, ox + w / 2, oz + d + 0.1],
    [0.2, 0.16, d, ox - 0.1, oz + d / 2], [0.2, 0.16, d, ox + w + 0.1, oz + d / 2]];
  for (const [sx, sy, sz, px, pz] of rim) {
    const r = new THREE.Mesh(boxGeo(), mat(C.frame));
    r.scale.set(sx, sy, sz);
    r.position.set(px, 0.02, pz);
    r.receiveShadow = true;
    base.add(r);
  }
  const ghost = new THREE.Mesh(boxGeo(), mat('#F7D56A', { opacity: 0.55 }));
  ghost.scale.setScalar(0.99);
  ghost.visible = false;
  ghost.renderOrder = 3;
  ctx.add(ghost);

  const listeners = new Set();
  const api = {
    blocks, heights, w, d, cap, mode: 'place', tiles,
    cx, cz,
    onChange(fn) { listeners.add(fn); },
    total: () => heights.reduce((s, r) => s + r.reduce((a, b) => a + b, 0), 0),
    /** 这一摞再叠一块。成功返回 true；满了返回 false。 */
    put(x, z, opt = {}) {
      if (x < 0 || z < 0 || x >= w || z >= d) return false;
      if (heights[z][x] >= cap) return false;
      blocks.add(x, z, heights[z][x], opt);
      heights[z][x]++;
      listeners.forEach((f) => f({ x, z, kind: 'put' }));
      return true;
    },
    /** 拿走这一摞最上面一块。 */
    take(x, z, opt = {}) {
      if (x < 0 || z < 0 || x >= w || z >= d || heights[z][x] <= 0) return false;
      heights[z][x]--;
      blocks.remove(x, z, heights[z][x], opt);
      listeners.forEach((f) => f({ x, z, kind: 'take' }));
      return true;
    },
    /** 直接摆成某个高度表（演示用；不播逐块声音）。 */
    setHeights(grid) {
      for (let z = 0; z < d; z++) for (let x = 0; x < w; x++) {
        while (heights[z][x] > (grid[z]?.[x] ?? 0)) api.take(x, z, { anim: false, sound: false });
        while (heights[z][x] < (grid[z]?.[x] ?? 0)) api.put(x, z, { anim: false, sound: false });
      }
    },
    /** 把最矮的那一层整层复制到上面一层（只对刚好齐平的格子）。返回新放的块数。 */
    async copyLayerUp(step = 55) {
      const m = Math.min(...heights.flat());
      if (m >= cap) return 0;
      let n = 0;
      for (let z = 0; z < d; z++) for (let x = 0; x < w; x++) {
        if (heights[z][x] === m) {
          const k = n++;
          heights[z][x]++;
          blocks.add(x, z, m, { delay: k * step });
        }
      }
      listeners.forEach((f) => f({ kind: 'layer' }));
      await ctx.wait(n * step + 380);
      return n;
    },
    /** 一条光线打到哪一摞？ */
    pick(ray) {
      const hits = ray.intersectObjects([...blocks.meshes(), ...tiles], false);
      for (const h of hits) {
        const u = h.object.userData;
        if (u.tile) return { x: u.x, z: u.z };
        if (u.block) {
          const n = h.face?.normal;
          if (n && Math.abs(n.y) < 0.5) {
            const x = u.i + Math.round(n.x), z = u.j + Math.round(n.z);
            if (x >= 0 && x < w && z >= 0 && z < d) return { x, z };
          }
          return { x: u.i, z: u.j };
        }
      }
      return null;
    },
    setMode(m) { api.mode = m; api.hover(null); },
    /** 整座拆掉（换下一座台基时）。 */
    destroy() { blocks.clear(); ctx.remove(blocks.group); ctx.remove(base); ctx.remove(ghost); },
    /** 悬停预览：放 = 半透明金块；拿 = 最上面那块罩一层光。 */
    hover(col) {
      if (!col) { ghost.visible = false; return; }
      const h = heights[col.z][col.x];
      if (api.mode === 'place') {
        if (h >= cap) { ghost.visible = false; return; }
        ghost.scale.setScalar(0.99);
        ghost.position.set(cx(col.x), h + 0.5, cz(col.z));
        ghost.visible = true;
      } else {
        if (h <= 0) { ghost.visible = false; return; }
        ghost.scale.setScalar(1.03);
        ghost.position.set(cx(col.x), h - 0.5, cz(col.z));
        ghost.visible = true;
      }
    },
    /** 点一下（真手和假手共用）。返回 'put' | 'take' | 'full' | 'none' */
    tap(col) {
      if (!col) return 'none';
      if (api.mode === 'place') {
        if (heights[col.z][col.x] >= cap) return 'full';
        api.put(col.x, col.z);
        ctx.fx.sparkle({ x: cx(col.x), z: cz(col.z) }, { size: 0.7, color: '#F7D56A' });
        return 'put';
      }
      return api.take(col.x, col.z) ? 'take' : 'none';
    },
  };
  return api;
}

// ====================================================================
// 工具栏：放 / 拿 两个互斥按钮
// ====================================================================
export function modeTools(ctx, onMode) {
  const place = ctx.hud.tool({ icon: 'plus', label: '放方块', primary: true, onTap: () => set('place') });
  const take = ctx.hud.tool({ icon: 'minus', label: '拿走', onTap: () => set('remove') });
  let mode = 'place';
  function set(m) {
    mode = m;
    place.el.classList.toggle('primary', m === 'place');
    take.el.classList.toggle('primary', m === 'remove');
    onMode?.(m);
  }
  return {
    get mode() { return mode; },
    set,
    place, take,
    show(on = true) { if (on) { place.show(); take.show(); } else { place.hide(); take.hide(); } },
    remove() { place.remove(); take.remove(); },
  };
}

// ====================================================================
// 木条：两点之间的一根方木（在任意朝向都行）
// ====================================================================
const X_AXIS = new THREE.Vector3(1, 0, 0);
/**
 * @param {string} color @param {number} [thick]
 */
export function makeBar(color = C.wood, thick = 0.2, thickZ = thick) {
  const m = new THREE.Mesh(boxGeo(), mat(color));
  m.castShadow = m.receiveShadow = true;
  const dir = new THREE.Vector3();
  m.userData.set = (a, b) => {
    dir.subVectors(b, a);
    const len = dir.length();
    m.position.copy(a).addScaledVector(dir, 0.5);
    m.scale.set(Math.max(0.001, len), thick, thickZ);
    if (len > 1e-6) m.quaternion.setFromUnitVectors(X_AXIS, dir.divideScalar(len));
  };
  return m;
}

/** 木头铰链小圆柱（立在木条交点上）。 */
export function makePin(color = '#5C3F22', r = 0.17, h = 0.34) {
  const m = new THREE.Mesh(geo(`c4-pin-${r}-${h}`, () => new THREE.CylinderGeometry(r, r, h, 12)), mat(color));
  m.castShadow = true;
  return m;
}

/** 屏幕左右一片区域里放一个小卡片（DOM）。 */
export function makeCard(ctx, cls, html) {
  const el = document.createElement('div');
  el.className = cls;
  if (html) el.innerHTML = html;
  return mountDom(ctx, el);
}

/** 通用样式：本章的 DOM 小卡片。没有阴影（UX-7），可点的有 hover（UX-5）。 */
export const BASE_CSS = `
.c4-card { position: absolute; z-index: 3; pointer-events: none; background: rgba(255, 248, 234, 0.92);
  border: 2px solid var(--ridge, #8b6b43); border-radius: 18px; color: var(--ink, #4a3a28); }
.c4-card.tap { pointer-events: auto; cursor: pointer; transition: background-color .15s, border-color .15s; }
@media (hover: hover) { .c4-card.tap:hover { background: #f3e5c6; border-color: var(--gold, #f2b134); } }
`;
