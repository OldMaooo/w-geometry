// 统一指针：鼠标和触摸都走 Pointer Events。
// - 射线拾取 + 屏幕距离兜底（手指粗，拾取半径大方）
// - 地面拖拽、吸附、拖拽中的光圈和声音
// - 空地上拖 = 转视角；右键拖 = 转视角；滚轮 / 双指捏合 = 缩放；拖东西时相机不动
// - simulateDrag / simulateTap：自动演示和 __geo.solve() 用的「假手」，走的是和真手同一套回调
import * as THREE from 'three';
import { PALETTE } from './palette.js';

/**
 * @typedef {object} DragOpts
 * @property {number} [plane]      拖拽平面高度（默认 0 = 地面）
 * @property {number | ((p: THREE.Vector3, raw: THREE.Vector3) => THREE.Vector3 | null)} [snap]
 *   数字 = 按这个步长吸附 x/z；函数 = 自己算吸附后的位置（返回 null = 保持上一个位置）
 * @property {{minX:number,maxX:number,minZ:number,maxZ:number}} [bounds] 拖动范围
 * @property {(p: THREE.Vector3) => void} [onStart]
 * @property {(p: THREE.Vector3, info: {raw: THREE.Vector3, changed: boolean}) => void} [onMove]
 *   不给 onMove 时引擎自动把物体移到 p
 * @property {(p: THREE.Vector3, info: {raw: THREE.Vector3, moved: boolean}) => void} [onEnd]
 * @property {() => void} [onTap]   按下没怎么动就松开
 * @property {number} [lift]        拖起来时抬高多少（默认 0.25，仅自动移动时生效）
 * @property {() => THREE.Vector3} [anchor] 屏幕兜底拾取 / 光圈的位置（默认物体世界坐标）
 * @property {THREE.Object3D} [hit] 射线检测用的物体（默认就是 obj，可给一个更大的隐形碰撞体）
 * @property {number} [radius]      屏幕兜底拾取半径（像素，鼠标；触摸自动 ×1.5）
 * @property {number} [ringSize]    光圈半径（世界单位，默认 0.7；0 = 不要光圈）
 * @property {number} [priority]    重叠时谁优先（大的优先）
 * @property {boolean} [silent]     不播默认拖拽音效
 */

/**
 * @param {import('./stage.js').Stage} stage
 * @param {ReturnType<import('./controls.js').createControls>} controls
 * @param {{ play: (name: string, opt?: any) => void }} audio
 */
export function createPointer(stage, controls, audio) {
  const { canvas, camera } = stage;
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  /** @type {Set<Handle>} */
  const handles = new Set();
  const emptyTapFns = new Set();

  // 光圈：悬停 / 拖拽时脚下一圈金光
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.78, 1, 40),
    new THREE.MeshBasicMaterial({ color: PALETTE.gold, transparent: true, opacity: 0.8, depthWrite: false }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.renderOrder = 5;
  ring.visible = false;
  stage.scene.add(ring);
  let ringTarget = /** @type {Handle|null} */ (null);
  let ringPulse = 0;
  stage.onFrame((dt) => {
    if (!ringTarget || !handles.has(ringTarget) || !ringTarget.enabled) { ring.visible = false; return; }
    const r = ringTarget.opts.ringSize ?? 0.7;
    if (!r) { ring.visible = false; return; }
    const a = anchorOf(ringTarget);
    ringPulse += dt * (drag ? 7 : 4);
    const s = r * (1 + Math.sin(ringPulse) * 0.08) * (drag ? 1.15 : 1);
    ring.scale.set(s, s, s);
    ring.position.set(a.x, (ringTarget.opts.plane ?? 0) + 0.04, a.z);
    ring.visible = true;
  });

  class Handle {
    /** @param {THREE.Object3D} obj @param {DragOpts & {tapOnly?: boolean}} opts */
    constructor(obj, opts) {
      this.obj = obj;
      this.opts = opts;
      this.enabled = true;
      this.dragging = false;
    }
    dispose() {
      handles.delete(this);
      if (drag && drag.handle === this) drag = null;
      if (ringTarget === this) ringTarget = null;
    }
  }

  /** @param {Handle} h */
  function anchorOf(h) {
    if (h.opts.anchor) return h.opts.anchor();
    return h.obj.getWorldPosition(new THREE.Vector3());
  }

  function setNdc(cx, cy) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
  }

  /** 屏幕坐标 → 高度 y 的水平面上的点。 */
  function groundPoint(cx, cy, y = 0) {
    setNdc(cx, cy);
    raycaster.setFromCamera(ndc, camera);
    plane.constant = -y;
    const out = new THREE.Vector3();
    return raycaster.ray.intersectPlane(plane, out) ? out : null;
  }

  /** 世界坐标 → 屏幕像素。 */
  function toScreen(v) {
    const r = canvas.getBoundingClientRect();
    const p = v.clone().project(camera);
    return { x: r.left + ((p.x + 1) / 2) * r.width, y: r.top + ((1 - p.y) / 2) * r.height, behind: p.z > 1 };
  }

  /** 看得见、并且还挂在场景里（被拆掉的物体不能再被抓到）。 */
  function visibleDeep(o) {
    let n = o;
    for (; n; n = n.parent) {
      if (!n.visible) return false;
      if (n === stage.scene) return true;
    }
    return false;
  }

  /** 拾取：先射线，没打中再按屏幕距离找最近的。 */
  function pick(cx, cy, touch) {
    const live = [...handles].filter((h) => h.enabled && visibleDeep(h.obj));
    if (!live.length) return null;
    setNdc(cx, cy);
    raycaster.setFromCamera(ndc, camera);
    let best = null;
    for (const h of live) {
      const hits = raycaster.intersectObject(h.opts.hit || h.obj, true);
      const hit = hits.find((x) => visibleDeep(x.object));
      if (!hit) continue;
      const pr = h.opts.priority || 0;
      if (!best || pr > best.pr || (pr === best.pr && hit.distance < best.d)) best = { h, d: hit.distance, pr };
    }
    if (best) return best.h;
    let near = null;
    for (const h of live) {
      const s = toScreen(anchorOf(h));
      if (s.behind) continue;
      const rad = (h.opts.radius ?? 40) * (touch ? 1.5 : 1);
      const d = Math.hypot(s.x - cx, s.y - cy);
      const pr = h.opts.priority || 0;
      if (d <= rad && (!near || pr > near.pr || (pr === near.pr && d < near.d))) near = { h, d, pr };
    }
    return near ? near.h : null;
  }

  // ---------- 拖拽核心（真手和假手共用） ----------
  /** @type {null | {handle: Handle, offset: THREE.Vector3, last: THREE.Vector3|null, moved: boolean, baseY: number, auto: boolean, startScreen?: {x:number,y:number}, pointerId?: number, sim?: boolean}} */
  let drag = null;

  function resolve(h, raw) {
    const o = h.opts;
    let p = raw.clone();
    if (o.bounds) {
      p.x = Math.min(o.bounds.maxX, Math.max(o.bounds.minX, p.x));
      p.z = Math.min(o.bounds.maxZ, Math.max(o.bounds.minZ, p.z));
    }
    if (typeof o.snap === 'number' && o.snap > 0) {
      p.x = Math.round(p.x / o.snap) * o.snap;
      p.z = Math.round(p.z / o.snap) * o.snap;
    } else if (typeof o.snap === 'function') {
      const s = o.snap(p, raw);
      if (s === null) return null;
      p = s;
    }
    return p;
  }

  function beginDrag(h, worldAt, extra = {}) {
    const o = h.opts;
    const objW = anchorOf(h);
    const y = o.plane ?? 0;
    const offset = extra.sim ? new THREE.Vector3() : new THREE.Vector3(objW.x - worldAt.x, 0, objW.z - worldAt.z);
    drag = { handle: h, offset, last: null, moved: false, baseY: h.obj.position.y, auto: !o.onMove, ...extra };
    h.dragging = true;
    ringTarget = h;
    if (drag.auto) h.obj.position.y = drag.baseY + (o.lift ?? 0.25);
    if (!o.silent) audio.play('pick');
    o.onStart?.(new THREE.Vector3(objW.x, y, objW.z));
  }

  function moveDrag(worldAt) {
    if (!drag) return;
    const h = drag.handle;
    const raw = worldAt.clone().add(drag.offset);
    raw.y = h.opts.plane ?? 0;
    const p = resolve(h, raw);
    if (!p) return;
    const changed = !drag.last || p.distanceToSquared(drag.last) > 1e-8;
    if (changed && drag.last && !h.opts.silent && (typeof h.opts.snap === 'number' || typeof h.opts.snap === 'function')) {
      audio.play('tick');
    }
    drag.last = p.clone();
    drag.moved = true;
    if (drag.auto) {
      const local = h.obj.parent ? h.obj.parent.worldToLocal(p.clone()) : p.clone();
      h.obj.position.x = local.x;
      h.obj.position.z = local.z;
    }
    h.opts.onMove?.(p, { raw, changed });
  }

  function endDrag(tapped) {
    if (!drag) return;
    const d = drag;
    drag = null;
    const h = d.handle;
    h.dragging = false;
    if (d.auto) h.obj.position.y = d.baseY;
    if (tapped && h.opts.onTap) {
      h.opts.onTap();
      return;
    }
    const p = d.last || anchorOf(h);
    if (!h.opts.silent && d.moved) audio.play('drop');
    h.opts.onEnd?.(p, { raw: p, moved: d.moved });
  }

  // ---------- 真手：Pointer Events ----------
  const pointers = new Map(); // id -> {x,y,type}
  let gesture = null; // 相机手势
  let pressInfo = null; // 可能是点按

  canvas.style.touchAction = 'none';
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  canvas.addEventListener('pointerdown', (e) => {
    audio.unlock?.();
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });
    if (drag && !drag.sim) return; // 拖东西时，第二根手指不管
    if (pointers.size === 2) {
      // 双指：取消单指转视角，进入捏合
      pressInfo = null;
      const [a, b] = [...pointers.values()];
      gesture = { kind: 'pinch', d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
      return;
    }
    if (pointers.size > 2) return;
    const touch = e.pointerType !== 'mouse';
    if (e.button === 2 || e.button === 1) {
      gesture = { kind: 'rotate', x: e.clientX, y: e.clientY };
      return;
    }
    const h = pick(e.clientX, e.clientY, touch);
    if (h) {
      if (h.opts.tapOnly) {
        pressInfo = { h, x: e.clientX, y: e.clientY, id: e.pointerId };
        return;
      }
      const w = groundPoint(e.clientX, e.clientY, h.opts.plane ?? 0);
      if (w) {
        beginDrag(h, w, { startScreen: { x: e.clientX, y: e.clientY }, pointerId: e.pointerId });
        drag.moved = false;
      }
      return;
    }
    pressInfo = { h: null, x: e.clientX, y: e.clientY, id: e.pointerId };
    gesture = { kind: 'rotate', x: e.clientX, y: e.clientY, pending: true };
  });

  canvas.addEventListener('pointermove', (e) => {
    const p = pointers.get(e.pointerId);
    if (p) { p.x = e.clientX; p.y = e.clientY; }
    if (drag && !drag.sim && drag.pointerId === e.pointerId) {
      const ss = drag.startScreen;
      if (!drag.moved && ss && Math.hypot(e.clientX - ss.x, e.clientY - ss.y) < 6) return;
      const w = groundPoint(e.clientX, e.clientY, drag.handle.opts.plane ?? 0);
      if (w) moveDrag(w);
      return;
    }
    if (gesture?.kind === 'pinch' && pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      if (gesture.d > 0 && d > 0) controls.zoomBy(gesture.d / d);
      controls.rotateBy(mx - gesture.mx, my - gesture.my);
      Object.assign(gesture, { d, mx, my });
      return;
    }
    if (gesture?.kind === 'rotate' && pointers.has(e.pointerId)) {
      const dx = e.clientX - gesture.x, dy = e.clientY - gesture.y;
      if (gesture.pending && Math.hypot(dx, dy) < 6) return;
      gesture.pending = false;
      pressInfo = null;
      controls.rotateBy(dx, dy);
      gesture.x = e.clientX; gesture.y = e.clientY;
      return;
    }
    if (pressInfo && Math.hypot(e.clientX - pressInfo.x, e.clientY - pressInfo.y) > 10) pressInfo = null;
    // 鼠标悬停：光标 + 光圈
    if (e.pointerType === 'mouse' && !pointers.size) {
      const h = pick(e.clientX, e.clientY, false);
      canvas.style.cursor = h ? (h.opts.tapOnly ? 'pointer' : 'grab') : 'default';
      ringTarget = h && !h.opts.tapOnly ? h : null;
    }
  });

  function up(e) {
    pointers.delete(e.pointerId);
    if (drag && !drag.sim && drag.pointerId === e.pointerId) {
      endDrag(!drag.moved);
      ringTarget = null;
    } else if (pressInfo && pressInfo.id === e.pointerId) {
      const pi = pressInfo;
      pressInfo = null;
      if (pi.h && pi.h.enabled) {
        audio.play('tap');
        pi.h.opts.onTap?.();
      } else if (!pi.h && gesture?.pending !== false) {
        emptyTapFns.forEach((fn) => fn());
      }
    }
    if (pointers.size < 2 && gesture?.kind === 'pinch') {
      gesture = null;
    }
    if (!pointers.size) gesture = null;
  }
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', (e) => {
    pointers.delete(e.pointerId);
    if (drag && !drag.sim && drag.pointerId === e.pointerId) endDrag(false);
    pressInfo = null;
    if (!pointers.size) gesture = null;
  });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (drag) return;
    controls.zoomBy(Math.exp(e.deltaY * 0.0012));
  }, { passive: false });

  // ---------- 对外 ----------
  const api = {
    /**
     * 让一个物体能拖。返回句柄：handle.enabled = false 暂停，handle.dispose() 取消。
     * @param {THREE.Object3D} obj @param {DragOpts} [opts]
     */
    draggable(obj, opts = {}) {
      const h = new Handle(obj, opts);
      handles.add(h);
      return h;
    },
    /**
     * 让一个物体能点。
     * @param {THREE.Object3D} obj @param {() => void} onTap
     * @param {{ radius?: number, hit?: THREE.Object3D, priority?: number, anchor?: () => THREE.Vector3 }} [opts]
     */
    tappable(obj, onTap, opts = {}) {
      const h = new Handle(obj, { ...opts, onTap, tapOnly: true, ringSize: 0 });
      handles.add(h);
      return h;
    },
    /**
     * 假手拖拽：沿路径把句柄拖过去（走同一套 onStart/onMove/onEnd）。
     * @param {Handle} h @param {THREE.Vector3 | THREE.Vector3[]} to 目标点或路径（物体位置，世界坐标）
     * @param {{ duration?: number }} [opt]
     */
    simulateDrag(h, to, opt = {}) {
      const path = Array.isArray(to) ? to : [to];
      const start = anchorOf(h);
      const pts = [new THREE.Vector3(start.x, 0, start.z), ...path.map((p) => new THREE.Vector3(p.x, 0, p.z))];
      const dur = opt.duration ?? 900;
      if (drag) endDrag(false);
      beginDrag(h, pts[0], { sim: true });
      const segLens = pts.slice(1).map((p, i) => p.distanceTo(pts[i]));
      const total = segLens.reduce((s, x) => s + x, 0) || 1;
      return new Promise((resolveP) => {
        let t = 0;
        const off = stage.onFrame((dt) => {
          if (!drag || drag.handle !== h) { off(); resolveP(); return; }
          t = Math.min(1, t + (dt * 1000) / dur);
          const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
          let s = e * total;
          let i = 0;
          while (i < segLens.length - 1 && s > segLens[i]) { s -= segLens[i]; i++; }
          const p = pts[i].clone().lerp(pts[i + 1], segLens[i] ? Math.min(1, s / segLens[i]) : 1);
          moveDrag(p);
          if (t >= 1) {
            off();
            endDrag(false);
            ringTarget = null;
            resolveP();
          }
        });
      });
    },
    /** 假手点一下。 @param {Handle} h */
    simulateTap(h) {
      audio.play('tap');
      h.opts.onTap?.();
    },
    /** 点在空地上（没拖、没点中东西）。 */
    onEmptyTap(fn) { emptyTapFns.add(fn); return () => emptyTapFns.delete(fn); },
    groundPoint,
    toScreen,
    get dragging() { return !!drag; },
    /** 取消正在进行的拖拽（换关时用）。 */
    cancel() { if (drag) { drag = null; } ringTarget = null; },
    /** 当前登记的句柄数（调试 / 查泄漏用）。 */
    count: () => handles.size,
  };
  return api;
}
