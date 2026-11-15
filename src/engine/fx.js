// 补间动画、过关庆祝粒子、长东西的「噌」、幽灵手示范。
import * as THREE from 'three';
import { icon } from './icons.js';
import { PALETTE } from './palette.js';
import { shared } from './shared.js';

export const EASE = {
  linear: (t) => t,
  out: (t) => 1 - Math.pow(1 - t, 3),
  in: (t) => t * t * t,
  inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  back: (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  elastic: (t) => (t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1),
};

/**
 * @param {import('./stage.js').Stage} stage
 * @param {HTMLElement} layer DOM 叠加层（幽灵手用）
 * @param {{ toScreen: (v: THREE.Vector3) => {x:number,y:number} }} pointer
 */
export function createFx(stage, layer, pointer) {
  const tweens = new Set();
  stage.onFrame((dt) => {
    for (const tw of [...tweens]) {
      if (tw.delay > 0) { tw.delay -= dt * 1000; continue; }
      tw.t = Math.min(1, tw.t + (dt * 1000) / tw.duration);
      try { tw.onUpdate(tw.ease(tw.t), tw.t); } catch (e) { console.error(e); tweens.delete(tw); continue; }
      if (tw.t >= 1) { tweens.delete(tw); tw.resolve(); }
    }
  });

  /**
   * 通用补间：每帧给 onUpdate(k) ，k 走 0→1（已套缓动）。
   * @param {{ duration?: number, delay?: number, ease?: keyof typeof EASE | ((t:number)=>number), onUpdate: (k:number, t:number)=>void }} o
   * @returns {{ promise: Promise<void>, cancel: () => void }}
   */
  function tween(o) {
    let resolve;
    const promise = new Promise((r) => (resolve = r));
    const tw = {
      t: 0, duration: Math.max(1, o.duration ?? 400), delay: o.delay ?? 0,
      ease: typeof o.ease === 'function' ? o.ease : EASE[o.ease || 'out'], onUpdate: o.onUpdate, resolve,
    };
    tweens.add(tw);
    return { promise, cancel: () => { tweens.delete(tw); resolve(); } };
  }

  /**
   * 把对象的数字属性补间到目标值（如 position / scale / material）。
   * @param {any} target @param {Record<string, number>} to @param {number} [duration] @param {{ ease?: string, delay?: number }} [opt]
   */
  function to(target, toVals, duration = 400, opt = {}) {
    const from = {};
    for (const k of Object.keys(toVals)) from[k] = target[k];
    return tween({
      duration, delay: opt.delay, ease: /** @type {any} */ (opt.ease),
      onUpdate: (k) => { for (const key of Object.keys(toVals)) target[key] = from[key] + (toVals[key] - from[key]) * k; },
    });
  }

  /** 从 0 弹出来（长出来）。 @param {THREE.Object3D} obj */
  function pop(obj, { duration = 420, delay = 0, from = 0.001, scale = 1 } = {}) {
    obj.scale.setScalar(from);
    return tween({ duration, delay, ease: 'back', onUpdate: (k) => obj.scale.setScalar(from + (scale - from) * k) });
  }

  /** 竖着长出来（庄稼噌地长高）。 @param {THREE.Object3D} obj */
  function sprout(obj, { duration = 500, delay = 0, scale = 1 } = {}) {
    obj.scale.set(scale * 0.6, 0.001, scale * 0.6);
    return tween({ duration, delay, ease: 'back', onUpdate: (k) => obj.scale.set(scale * (0.6 + 0.4 * k), scale * k, scale * (0.6 + 0.4 * k)) });
  }

  /** 左右轻摇（「不太对」的世界反馈，不是红叉）。 @param {THREE.Object3D} obj */
  function wobble(obj, { duration = 500, amp = 0.12 } = {}) {
    const base = obj.rotation.y;
    return tween({ duration, ease: 'linear', onUpdate: (k) => { obj.rotation.y = base + Math.sin(k * Math.PI * 4) * amp * (1 - k); } });
  }

  // ---------- 庆祝粒子 ----------
  const confettiGeo = shared(new THREE.BoxGeometry(0.16, 0.04, 0.1));
  const confettiColors = [PALETTE.gold, PALETTE.clay, PALETTE.rice, PALETTE.river, '#FFFFFF', '#F4D06F'];
  /**
   * 彩纸 + 金星一起往上炸开再落下。
   * @param {THREE.Vector3 | {x:number,y?:number,z:number}} at @param {{ count?: number, spread?: number, parent?: THREE.Object3D }} [opt]
   */
  function celebrate(at, opt = {}) {
    const n = opt.count ?? 90;
    const mat = new THREE.MeshBasicMaterial({ vertexColors: false, color: 0xffffff });
    const mesh = new THREE.InstancedMesh(confettiGeo, mat, n);
    mesh.frustumCulled = false;
    const col = new THREE.Color();
    const parts = [];
    for (let i = 0; i < n; i++) {
      col.set(confettiColors[i % confettiColors.length]);
      mesh.setColorAt(i, col);
      const a = Math.random() * Math.PI * 2;
      const sp = (opt.spread ?? 1) * (2 + Math.random() * 4);
      parts.push({
        p: new THREE.Vector3(at.x, (at.y ?? 0) + 0.5, at.z),
        v: new THREE.Vector3(Math.cos(a) * sp, 7 + Math.random() * 6, Math.sin(a) * sp),
        r: new THREE.Euler(Math.random() * 6, Math.random() * 6, 0),
        w: new THREE.Vector3(Math.random() * 10, Math.random() * 10, Math.random() * 10),
      });
    }
    (opt.parent || stage.root).add(mesh);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const one = new THREE.Vector3(1, 1, 1);
    let life = 0;
    const off = stage.onFrame((dt) => {
      life += dt;
      for (let i = 0; i < n; i++) {
        const P = parts[i];
        P.v.y -= 14 * dt;
        P.v.multiplyScalar(1 - dt * 1.6);
        P.p.addScaledVector(P.v, dt);
        if (P.p.y < 0.05) { P.p.y = 0.05; P.v.set(0, 0, 0); }
        else { P.r.x += P.w.x * dt; P.r.y += P.w.y * dt; P.r.z += P.w.z * dt; }
        q.setFromEuler(P.r);
        const s = life > 2.4 ? Math.max(0.001, 1 - (life - 2.4) / 0.6) : 1;
        m.compose(P.p, q, one.clone().multiplyScalar(s));
        mesh.setMatrixAt(i, m);
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (life > 3) { off(); mesh.removeFromParent(); mesh.dispose(); mat.dispose(); }
    });
    return { cancel: () => { off(); mesh.removeFromParent(); mesh.dispose(); mat.dispose(); } };
  }

  /** 一小圈闪光（做对一步）。 */
  function sparkle(at, { color = PALETTE.gold, size = 1 } = {}) {
    const geo = new THREE.RingGeometry(0.2, 0.32, 24);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1, depthWrite: false });
    const m = new THREE.Mesh(geo, mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(at.x, (at.y ?? 0) + 0.06, at.z);
    stage.root.add(m);
    const tw = tween({
      duration: 520, ease: 'out',
      onUpdate: (k) => { const s = size * (1 + k * 3); m.scale.set(s, s, s); mat.opacity = 1 - k; },
    });
    tw.promise.then(() => { m.removeFromParent(); geo.dispose(); mat.dispose(); });
    return tw;
  }

  // ---------- 幽灵手（提示第二档） ----------
  /**
   * 一只半透明的手从 from 拖到 to，来回演示几遍。
   * @param {THREE.Vector3} from @param {THREE.Vector3 | null} to 不给 to = 原地点两下
   * @param {{ loops?: number }} [opt]
   * @returns {{ stop: () => void, promise: Promise<void> }}
   */
  function ghostHand(from, to, opt = {}) {
    const loops = opt.loops ?? 3;
    const el = document.createElement('div');
    el.className = 'ghost-hand';
    el.appendChild(icon('pointer', { size: 44, stroke: 2 }));
    const trail = document.createElement('div');
    trail.className = 'ghost-trail';
    layer.append(trail, el);
    const per = to ? 1500 : 900;
    let stopped = false;
    let resolveP;
    const promise = new Promise((r) => (resolveP = r));
    const tw = tween({
      duration: per * loops, ease: 'linear',
      onUpdate: (_k, t) => {
        const lt = (t * loops) % 1;
        const a = pointer.toScreen(from);
        const b = to ? pointer.toScreen(to) : a;
        // 0–0.15 按下，0.15–0.75 移动，0.75–1 松开淡出
        const m = lt < 0.15 ? 0 : lt > 0.75 ? 1 : EASE.inOut((lt - 0.15) / 0.6);
        const x = a.x + (b.x - a.x) * m;
        const y = a.y + (b.y - a.y) * m;
        const press = lt > 0.08 && lt < 0.8;
        el.style.transform = `translate(${x}px, ${y}px) translate(-30%, -8%) scale(${press ? 0.9 : 1})`;
        el.style.opacity = String(lt > 0.85 ? (1 - lt) / 0.15 : Math.min(1, lt / 0.08));
        const len = Math.hypot(x - a.x, y - a.y);
        trail.style.width = `${len}px`;
        trail.style.transform = `translate(${a.x}px, ${a.y}px) rotate(${Math.atan2(y - a.y, x - a.x)}rad)`;
        trail.style.opacity = press && to ? '0.7' : '0';
      },
    });
    const stop = () => {
      if (stopped) return;
      stopped = true;
      tw.cancel();
      el.remove();
      trail.remove();
      resolveP();
    };
    tw.promise.then(stop);
    return { stop, promise };
  }

  return { tween, to, pop, sprout, wobble, celebrate, sparkle, ghostHand, EASE, count: () => tweens.size };
}
