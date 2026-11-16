// 第 3 章共用小工具：可拖的太阳（光、天色、拨盘）、地上算出来的影子、竿 / 树 / 塔、三维线段、拉结绳量长度、
// 以及放大小三角的图板（scale-diagram.js）。只给本章用；引擎缺的能力都在这里补。
import * as THREE from 'three';
import { PALETTE } from '../../engine/palette.js';
import { disposeTree } from '../../engine/shared.js';
import { icon } from '../../engine/icons.js';
import {
  elevOf, ratioOf, shadowDir, sunVec, magnetS, magnetTargets, showNum, DEG,
} from './math.js';

export const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
export const C = {
  shadow: '#1B1710',
  ray: '#F7C948',
  ok: '#7BC96A',
  line: '#FFF4D0',
  trunk: '#8B6B43',
  leaf: '#4F7942',
  leaf2: '#6E9F55',
  stone: '#CFC8B8',
  stone2: '#B3AB99',
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

const STYLE = `
.c3-dial { position: absolute; left: 14px; bottom: 18px; width: 262px; height: 182px; z-index: 5; pointer-events: auto;
  background: rgba(255, 248, 234, 0.92); border: 2px solid var(--ridge, #8b6b43); border-radius: 22px; touch-action: none;
  transition: opacity .25s; }
.c3-dial.locked { opacity: .55; pointer-events: none; }
.c3-dial svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; pointer-events: none; }
.c3-sun { position: absolute; width: 58px; height: 58px; margin: -29px 0 0 -29px; border-radius: 50%; background: #F9C846;
  border: 3px solid #E29A1B; color: #7A4A06; display: flex; align-items: center; justify-content: center; cursor: grab;
  box-shadow: 0 0 0 7px rgba(249, 200, 70, 0.28), 0 0 26px 8px rgba(255, 214, 96, 0.55); transition: filter .12s, box-shadow .15s; touch-action: none; }
.c3-sun.snap { box-shadow: 0 0 0 7px rgba(123, 201, 106, 0.45), 0 0 26px 8px rgba(255, 214, 96, 0.7); border-color: #6DB85B; }
.c3-sun:active { cursor: grabbing; }
@media (hover: hover) { .c3-sun:hover { filter: brightness(1.08); } }
.c3-hand { position: absolute; width: 44px; height: 44px; margin: -6px 0 0 -14px; color: #4A3A28; pointer-events: none; z-index: 7;
  filter: drop-shadow(0 2px 2px rgba(0,0,0,.25)); }
.c3-hand svg { width: 44px; height: 44px; }
`;
const ensureStyle = (ctx) => injectStyles(ctx, STYLE);

/** 幽灵手：在某个 DOM 容器里，从 from 滑到 to（容器内像素，函数每次现算）。返回停止函数。 */
export function domGhost(ctx, host, from, to, ms = 1700) {
  const el = document.createElement('div');
  el.className = 'c3-hand';
  el.appendChild(icon('hand', { size: 44, stroke: 2 }));
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
  const stop = () => { off(); el.remove(); };
  ctx.onDispose(stop);
  return stop;
}

// =====================================================================
// 太阳：一天的弧上拖一个球。光的方向、强弱、天色、影子都跟着变。
// =====================================================================
/**
 * @param {any} ctx
 * @param {{ s?: number, sway?: number, dial?: boolean, magnets?: number[], focus?: {x:number,z:number,r:number} }} [o]
 *   magnets：影长比 → 太阳拖到这些位置会「吸」一下。
 */
export function makeSun(ctx, o = {}) {
  ensureStyle(ctx);
  const sway = o.sway ?? 50;
  const scene = ctx.scene.parent;
  const dl = scene.children.find((c) => c.isDirectionalLight);
  const hemi = scene.children.find((c) => c.isHemisphereLight);
  const keep = {
    bg: scene.background, fog: scene.fog ? scene.fog.color.clone() : null,
    pos: dl.position.clone(), inten: dl.intensity, col: dl.color.clone(), hemi: hemi.intensity,
  };
  if (o.focus) ctx.view.shadow(o.focus, o.focus.r);
  const focusPos = dl.position.clone();
  const tgt = dl.target.position;

  const sky = document.createElement('canvas');
  sky.width = 2; sky.height = 128;
  const g2 = sky.getContext('2d');
  const tex = new THREE.CanvasTexture(sky);
  tex.colorSpace = THREE.SRGBColorSpace;
  scene.background = tex;
  const cTopLow = new THREE.Color('#A9C6DE'), cTopHigh = new THREE.Color('#8ED2F5');
  const cBotLow = new THREE.Color('#F7B97C'), cBotHigh = new THREE.Color('#F6ECCB');
  const cLightLow = new THREE.Color('#FFB878'), cLightHigh = new THREE.Color('#FFF1D6');
  const tmp = new THREE.Color();

  const listeners = new Set();
  const releaseFns = new Set();
  const targets = magnetTargets(o.magnets || []);
  const api = {
    s: o.s ?? 0.5,
    sway,
    locked: false,
    /** 现在的高度角（度）/ 影长比 / 影子朝向。 */
    get elev() { return elevOf(api.s); },
    get ratio() { return ratioOf(api.s); },
    get dir() { return shadowDir(api.s, sway); },
    /** 是不是吸在某个目标上。 */
    snapped: false,
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    /** 手松开时（磁吸之后）。 */
    onRelease(fn) { releaseFns.add(fn); return () => releaseFns.delete(fn); },
    setS(s, { user = false } = {}) {
      let v = Math.min(1, Math.max(0, s));
      const was = api.snapped;
      if (user && targets.length) {
        const m = magnetS(v, targets);
        api.snapped = m !== v;
        v = m;
        if (api.snapped && !was) ctx.audio.play('snap');
      } else api.snapped = targets.some((t) => Math.abs(t - v) < 1e-6);
      api.s = v;
      light();
      moveKnob();
      listeners.forEach((fn) => fn(v));
    },
    /** 假手：把太阳拖到某处（演示 / solve 用）。 */
    async tweenTo(s, ms = 1200) {
      const from = api.s;
      await ctx.fx.tween({
        duration: ms, ease: 'inOut',
        onUpdate: (k) => api.setS(from + (s - from) * k),
      });
      api.setS(s);
      fire();
    },
    /** 平滑换时间（场景自己的过渡，不触发 release）。 */
    async glideTo(s, ms = 1600) {
      const from = api.s;
      await ctx.fx.tween({ duration: ms, ease: 'inOut', onUpdate: (k) => api.setS(from + (s - from) * k) });
      api.setS(s);
    },
    lock(on = true) { api.locked = on; dial?.classList.toggle('locked', on); },
    show(on = true) { if (dial) dial.style.display = on ? '' : 'none'; },
    /** 提示第二档：一只手在拨盘上示范。 */
    ghost(sTo) {
      if (!dial) return () => {};
      const from = () => { const p = knobPos(api.s); return { x: p.x, y: p.y }; };
      const to = () => { const p = knobPos(sTo); return { x: p.x, y: p.y }; };
      return domGhost(ctx, dial, from, to);
    },
    dial: null,
  };
  function fire() { releaseFns.forEach((fn) => fn(api.s)); }

  function light() {
    const u = Math.min(1, Math.max(0, (api.elev - 15) / 59));
    const v = sunVec(api.s, sway);
    dl.position.set(tgt.x + v.x * 30, Math.max(3, v.y * 30), tgt.z + v.z * 30);
    dl.intensity = 1.7 + 0.9 * u;
    dl.color.copy(cLightLow).lerp(cLightHigh, u);
    hemi.intensity = 0.95 + 0.25 * u;
    const top = tmp.copy(cTopLow).lerp(cTopHigh, u).getStyle();
    const bot = new THREE.Color().copy(cBotLow).lerp(cBotHigh, u);
    const grad = g2.createLinearGradient(0, 0, 0, 128);
    grad.addColorStop(0, top);
    grad.addColorStop(0.62, '#DCEBE6');
    grad.addColorStop(1, bot.getStyle());
    g2.fillStyle = grad;
    g2.fillRect(0, 0, 2, 128);
    tex.needsUpdate = true;
    if (scene.fog) scene.fog.color.copy(bot);
  }

  // ---- 拨盘 ----
  const W = 262, H = 182, CX = 131, CY = 128, R = 100;
  const knobPos = (s) => { const th = Math.PI * (1 - s); return { x: CX + R * Math.cos(th), y: CY - R * Math.sin(th) }; };
  let dial = null, knob = null;
  function moveKnob() {
    if (!knob) return;
    const p = knobPos(api.s);
    knob.style.left = `${(p.x / W) * 100}%`;
    knob.style.top = `${(p.y / H) * 100}%`;
    knob.classList.toggle('snap', api.snapped);
  }
  if (o.dial !== false) {
    dial = document.createElement('div');
    dial.className = 'c3-dial';
    dial.setAttribute('aria-label', '太阳');
    dial.innerHTML = `<svg viewBox="0 0 ${W} ${H}"><path d="M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}" fill="none" stroke="#C9A66B" stroke-width="5" stroke-dasharray="2 11" stroke-linecap="round"/>
      <rect x="${CX - R - 18}" y="${CY + 2}" width="${2 * R + 36}" height="12" rx="6" fill="#B7D190"/>
      <rect x="${CX - R - 18}" y="${CY + 2}" width="${2 * R + 36}" height="5" rx="2.5" fill="#8FB86E"/>
      <g font-size="19" text-anchor="middle" fill="#6B5334"><text x="${CX - R}" y="${CY + 40}">早上</text><text x="${CX}" y="${CY - 14}" opacity="0.8">中午</text><text x="${CX + R}" y="${CY + 40}">傍晚</text></g></svg>`;
    knob = document.createElement('div');
    knob.className = 'c3-sun';
    knob.appendChild(icon('sun', { size: 30, stroke: 2.6 }));
    dial.appendChild(knob);
    mountDom(ctx, dial);
    api.dial = dial;
    let dragging = false;
    const toS = (e) => {
      const r = dial.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * W, y = ((e.clientY - r.top) / r.height) * H;
      let th = Math.atan2(CY - y, x - CX);
      if (y > CY) th = x < CX ? Math.PI : 0;
      th = Math.min(Math.PI, Math.max(0, th));
      return 1 - th / Math.PI;
    };
    dial.addEventListener('pointerdown', (e) => {
      if (api.locked) return;
      dragging = true;
      dial.setPointerCapture(e.pointerId);
      ctx.audio.play('pick');
      api.setS(toS(e), { user: true });
    });
    dial.addEventListener('pointermove', (e) => { if (dragging) api.setS(toS(e), { user: true }); });
    const up = () => { if (!dragging) return; dragging = false; ctx.audio.play('drop'); fire(); };
    dial.addEventListener('pointerup', up);
    dial.addEventListener('pointercancel', up);
    dial.style.cursor = 'pointer';
  }

  api.setS(api.s);
  ctx.onDispose(() => {
    scene.background = keep.bg;
    if (scene.fog && keep.fog) scene.fog.color.copy(keep.fog);
    dl.position.copy(keep.pos); dl.intensity = keep.inten; dl.color.copy(keep.col); hemi.intensity = keep.hemi;
    tex.dispose();
  });
  void focusPos;
  return api;
}

// =====================================================================
// 影子：自己算几何、画在地上的一块深色面（不用引擎的阴影贴图）
// =====================================================================
/** 一块地上的多边形（深色半透明）。setPoly([{x,z}...]) 随时重画。 */
export function makeGroundPoly(ctx, { color = C.shadow, opacity = 0.55, y = 0.05 } = {}) {
  const mesh = new THREE.Mesh(
    new THREE.BufferGeometry(),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
  );
  mesh.position.y = y;
  mesh.renderOrder = 2;
  ctx.add(mesh);
  return {
    mesh,
    setPoly(pts) {
      mesh.geometry.dispose();
      const shape = new THREE.Shape(pts.map((p) => new THREE.Vector2(p.x, -p.z)));
      const g = new THREE.ShapeGeometry(shape);
      g.rotateX(-Math.PI / 2);
      mesh.geometry = g;
    },
    show(on) { mesh.visible = on; },
  };
}

/** 两点之间的一根细棒（视线、光线）。 */
export function makeSeg(ctx, { color = C.ray, r = 0.045, opacity = 1, parent } = {}) {
  const m = new THREE.Mesh(
    new THREE.CylinderGeometry(r, r, 1, 6).rotateX(Math.PI / 2),
    new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: opacity >= 1 }),
  );
  (parent || ctx.scene).add(m);
  const api = {
    mesh: m,
    set(a, b) {
      const L = a.distanceTo(b);
      m.visible = L > 1e-4;
      m.position.copy(a).lerp(b, 0.5);
      m.scale.set(1, 1, Math.max(L, 1e-4));
      m.lookAt(b);
      return api;
    },
    color(c) { m.material.color.set(c); return api; },
    show(on) { m.visible = on; return api; },
  };
  return api;
}

/** 影子条：从 (x,z) 沿 dir 画一条宽 w 的带子，到 len 为止。 */
export const strip = (x, z, dir, len, w) => {
  const nx = -dir.z * (w / 2), nz = dir.x * (w / 2);
  const ex = x + dir.x * len, ez = z + dir.z * len;
  return [{ x: x - nx, z: z - nz }, { x: x + nx, z: z + nz }, { x: ex + nx, z: ez + nz }, { x: ex - nx, z: ez - nz }];
};

// =====================================================================
// 竿 / 树 / 塔：自己搭的，高度精确，影子由本章自己画
// =====================================================================
function box(w, h, d, color, x, y, z, parent) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color }));
  m.position.set(x, y, z);
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

/**
 * 立在地上的竿（高 h 步）：顶上一个金球。影子 + 光线跟着太阳。
 * @param {any} ctx @param {{x:number,z:number,h:number,color?:string,w?:number,ray?:boolean,tipMark?:boolean}} o
 */
export function makePole(ctx, o) {
  const { x, z, h } = o;
  const w = o.w ?? 0.3;
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  box(w, h - 0.12, w, o.color ?? '#A47148', 0, (h - 0.12) / 2, 0, g);
  const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(0.24, 0), new THREE.MeshLambertMaterial({ color: PALETTE.gold }));
  ball.position.y = h - 0.02;
  g.add(ball);
  box(0.55, 0.06, 0.55, '#9B7B4E', 0, 0.03, 0, g);
  ctx.add(g);
  const poly = makeGroundPoly(ctx);
  const ray = o.ray === false ? null : makeSeg(ctx, { color: C.ray, r: 0.04, opacity: 0.85 });
  const tip = new THREE.Mesh(new THREE.RingGeometry(0.14, 0.26, 20), new THREE.MeshBasicMaterial({ color: PALETTE.gold, side: THREE.DoubleSide, transparent: true, opacity: 0.95, depthWrite: false }));
  tip.rotation.x = -Math.PI / 2;
  tip.position.y = 0.07;
  ctx.add(tip);
  const api = {
    group: g, x, z, h, poly, ray, tip,
    top: v3(x, h, z),
    len: 0,
    tipPos: v3(x, 0, z),
    /** 太阳变了：重画影子。 */
    update(dir, ratio) {
      api.len = h * ratio;
      poly.setPoly(strip(x, z, dir, api.len, w));
      api.tipPos.set(x + dir.x * api.len, 0, z + dir.z * api.len);
      tip.position.set(api.tipPos.x, 0.07, api.tipPos.z);
      ray?.set(api.top, v3(api.tipPos.x, 0.06, api.tipPos.z));
    },
    hideShadow(on = false) { poly.show(!on); tip.visible = !on; ray?.show(!on); },
    setOk(on) { tip.material.color.set(on ? C.ok : PALETTE.gold); ray?.color(on ? C.ok : C.ray); ball.material.color.set(on ? C.ok : PALETTE.gold); },
  };
  return api;
}

/** 树：树干 + 两层树冠，最高点正好是 h。影子是「细干 + 一团冠」。 */
export function makeTree(ctx, o) {
  const { x, z, h } = o;
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  const trunkH = h * 0.52;
  box(0.55, trunkH, 0.55, C.trunk, 0, trunkH / 2, 0, g);
  const c1 = h * 0.30, c2 = h - trunkH - c1;
  box(2.5, c1, 2.5, C.leaf, 0, trunkH + c1 / 2, 0, g);
  box(1.5, c2, 1.5, C.leaf2, 0, trunkH + c1 + c2 / 2, 0, g);
  g.traverse((m) => { if (m.isMesh) m.castShadow = false; });
  ctx.add(g);
  const poly = makeGroundPoly(ctx);
  const ray = makeSeg(ctx, { color: C.ray, r: 0.05, opacity: 0.85 });
  const tip = new THREE.Mesh(new THREE.RingGeometry(0.16, 0.3, 20), new THREE.MeshBasicMaterial({ color: PALETTE.gold, side: THREE.DoubleSide, transparent: true, opacity: 0.95, depthWrite: false }));
  tip.rotation.x = -Math.PI / 2;
  ctx.add(tip);
  const api = {
    group: g, x, z, h, poly, ray, tip, len: 0, top: v3(x, h, z), tipPos: v3(x, 0, z),
    update(dir, ratio) {
      api.len = h * ratio;
      const n = { x: -dir.z, z: dir.x };
      const at = (t, side) => ({ x: x + dir.x * t + n.x * side, z: z + dir.z * t + n.z * side });
      const t1 = trunkH * ratio, t2 = (trunkH + c1) * ratio, t3 = api.len;
      poly.setPoly([
        at(0, -0.28), at(t1, -0.28), at(t1, -1.25), at(t2, -1.25), at(t2, -0.75), at(t3, -0.75),
        at(t3, 0.75), at(t2, 0.75), at(t2, 1.25), at(t1, 1.25), at(t1, 0.28), at(0, 0.28),
      ]);
      api.tipPos.set(x + dir.x * t3, 0, z + dir.z * t3);
      tip.position.set(api.tipPos.x, 0.07, api.tipPos.z);
      ray.set(api.top, v3(api.tipPos.x, 0.06, api.tipPos.z));
    },
    remove() { ctx.remove(g); ctx.remove(poly.mesh); ctx.remove(tip); ctx.remove(ray.mesh); },
  };
  return api;
}

/** 石塔：宽 base 的方底座（高 1）+ 细一点的塔身，顶点高 h。 */
export function makeTower(ctx, o) {
  const { x, z, h, base } = o;
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  box(base, 1, base, C.stone2, 0, 0.5, 0, g);
  const bw = base * 0.6;
  box(bw, h - 2, bw, C.stone, 0, 1 + (h - 2) / 2, 0, g);
  box(bw + 0.5, 0.35, bw + 0.5, C.stone2, 0, h - 1 - 0.175 + 0.1, 0, g);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(bw * 0.78, 1, 4), new THREE.MeshLambertMaterial({ color: PALETTE.clay }));
  roof.position.y = h - 0.5;
  roof.rotation.y = Math.PI / 4;
  g.add(roof);
  g.traverse((m) => { if (m.isMesh) m.castShadow = false; });
  ctx.add(g);
  const poly = makeGroundPoly(ctx);
  const tip = new THREE.Mesh(new THREE.RingGeometry(0.18, 0.34, 20), new THREE.MeshBasicMaterial({ color: PALETTE.gold, side: THREE.DoubleSide, transparent: true, opacity: 0.95, depthWrite: false }));
  tip.rotation.x = -Math.PI / 2;
  ctx.add(tip);
  const api = {
    group: g, x, z, h, base, poly, tip, len: 0, top: v3(x, h, z), tipPos: v3(x, 0, z),
    /** 影子：底座一块 + 塔身的影子（从底座边缘一直拖到塔尖影）。len = 塔尖影离塔中心的距离。 */
    update(dir, ratio) {
      api.len = h * ratio;
    
      const body = strip(x, z, dir, api.len, base * 0.6 * 0.9);
      // 塔身影子：从中心到塔尖，宽度 = 塔身宽
      poly.setPoly(body);
      api.tipPos.set(x + dir.x * api.len, 0, z + dir.z * api.len);
      tip.position.set(api.tipPos.x, 0.07, api.tipPos.z);
    },
  };
  return api;
}

// =====================================================================
// 拉结绳量长度：从一个点拉绳头，吸到另一个点上，结一个个亮起报数。
// =====================================================================
/**
 * @param {any} ctx
 * @param {{ from:{x:number,z:number}, to:{x:number,z:number}, every?:number, text?:string, hintText?:string,
 *   maxLen?:number, snapR?:number, keepBig?:boolean, unit?:string }} o
 * @returns {Promise<{ len:number, big:any, rope:any }>}
 */
export async function measureRope(ctx, o) {
  const { props } = ctx;
  const A = o.from, B = o.to;
  const every = o.every ?? 1;
  const L = Math.hypot(B.x - A.x, B.z - A.z);
  const dx = (B.x - A.x) / L, dz = (B.z - A.z) / L;
  const rope = props.rope({ points: [A, A], every, y: 0.34 });
  const head = ctx.add(new THREE.Group());
  const start = { x: A.x + dx * 0.5, z: A.z + dz * 0.5 };
  head.position.set(start.x, 0, start.z);
  const knob = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 0), new THREE.MeshLambertMaterial({ color: PALETTE.gold }));
  knob.position.y = 0.34;
  head.add(knob);
  props.hitBox(1.2, 0.9, 1.2, head);
  rope.setPoints([A, start]);
  const base = props.stake({ x: A.x, z: A.z, h: 0.5, color: '#7A5233' });
  void base;
  if (o.text) ctx.hud.task(o.text);
  let atB = false;
  ctx.fx.pop(head);
  await ctx.waitFor((done) => {
    const hd = ctx.pointer.draggable(head, {
      ringSize: 0.6, lift: 0,
      snap: (p) => {
        if (Math.hypot(p.x - B.x, p.z - B.z) < (o.snapR ?? 1.3)) { p.x = B.x; p.z = B.z; return p; }
        const d = Math.hypot(p.x - A.x, p.z - A.z);
        const mx = o.maxLen ?? L + 4;
        if (d > mx) { p.x = A.x + ((p.x - A.x) / d) * mx; p.z = A.z + ((p.z - A.z) / d) * mx; }
        return p;
      },
      onMove: (p) => {
        head.position.set(p.x, 0, p.z);
        rope.setPoints([A, p]);
        const now = p.x === B.x && p.z === B.z;
        if (now && !atB) ctx.audio.play('snap');
        atB = now;
      },
      onEnd: async () => {
        if (atB) { hd.enabled = false; done(); return; }
        const from = { x: head.position.x, z: head.position.z };
        ctx.audio.play('whoosh');
        await ctx.fx.tween({
          duration: 280,
          onUpdate: (k) => {
            head.position.set(from.x + (start.x - from.x) * k, 0, from.z + (start.z - from.z) * k);
            rope.setPoints([A, { x: head.position.x, z: head.position.z }]);
          },
        });
        if (Math.hypot(from.x - A.x, from.z - A.z) > 1.5) ctx.nudge(o.hintText ?? '再拉远一点，拉到发亮的那个点。');
      },
    });
    ctx.hint({
      text: o.hintText ?? '按住金色绳头，一直拉到发亮的那个点上再松手。',
      ghost: () => ctx.fx.ghostHand(v3(head.position.x, 0.4, head.position.z), v3(B.x, 0.4, B.z)),
      demo: () => ctx.pointer.simulateDrag(hd, v3(B.x, 0, B.z), { duration: 1100 }),
    });
  });
  ctx.hint(null);
  rope.setPoints([A, B]);
  const knots = rope.knots();
  const counter = ctx.labels.add(v3(A.x, 0.7, A.z), '', { cls: 'num lit', pop: false });
  counter.show(false);
  const step = knots.length > 8 ? 150 : 260;
  for (let k = 1; k <= knots.length; k++) {
    rope.setLit(k);
    counter.target = knots[k - 1].clone().setY(0.6);
    counter.set(showNum(k * every)).show(true);
    ctx.audio.play('count', { n: Math.min(k - 1, 14) });
    await ctx.wait(step);
  }
  counter.remove();
  const mid = v3((A.x + B.x) / 2, 0.8, (A.z + B.z) / 2);
  const len = Math.round(L * 100) / 100;
  const big = ctx.labels.add(mid, `${showNum(len)}<small>${o.unit ?? '步'}</small>`, { cls: 'big' });
  ctx.say(`${showNum(len)} ${o.unit ?? '步'}`);
  await ctx.wait(700);
  ctx.remove(head);
  if (!o.keepBig) { /* 留着，调用者自己收 */ }
  return { len, big, rope };
}

/** 地上一个发亮的圈，提示「到这里」。返回 {mesh, remove}。 */
export function makeBeacon(ctx, x, z, { r = 0.7, color = PALETTE.gold } = {}) {
  const m = new THREE.Mesh(new THREE.RingGeometry(r * 0.62, r, 32), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide }));
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, 0.06, z);
  ctx.add(m);
  const off = ctx.onUpdate((dt, t) => { const s = 1 + Math.sin(t * 5) * 0.12; m.scale.set(s, s, s); });
  return { mesh: m, remove() { off(); ctx.remove(m); }, set(px, pz) { m.position.x = px; m.position.z = pz; } };
}

export { disposeTree, DEG };

/**
 * 等玩家把太阳拖到影长比 = ratio 的时刻（手松开才算）。含三档提示。
 * @param {any} ctx @param {ReturnType<typeof makeSun>} sun
 * @param {{ ratio:number, hintText:string, nudgeText:string, tol?:number }} o
 */
export async function waitSunRatio(ctx, sun, o) {
  const tol = o.tol ?? 0.03;
  const pick = () => {
    const am = sForRatioSafe(o.ratio, 'am'), pm = sForRatioSafe(o.ratio, 'pm');
    return Math.abs(am - sun.s) <= Math.abs(pm - sun.s) ? am : pm;
  };
  let last = 0;
  await ctx.waitFor((done) => {
    const off = sun.onRelease(() => {
      if (Math.abs(sun.ratio - o.ratio) <= tol) { off(); done(); return; }
      if (Date.now() - last > 2500) { last = Date.now(); ctx.nudge(o.nudgeText); }
    });
    ctx.hint({
      text: o.hintText,
      ghost: () => sun.ghost(pick()),
      demo: () => sun.tweenTo(pick(), 1400),
    });
  });
  ctx.hint(null);
}
import { sForRatio as _sFor } from './math.js';
const sForRatioSafe = (r, side) => _sFor(r, side) ?? 0.5;
