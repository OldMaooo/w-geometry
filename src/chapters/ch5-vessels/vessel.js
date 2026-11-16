// 第 5 章的容器：陶罐 / 方仓 / 圆筒 / 尖斗（圆锥）/ 方尖斗（四棱锥），可升降的水面或谷面；
// 还有「倒」：把一个容器端到另一个上方倾斜、一股水柱哗啦流下去、两边水位一起变。
// 水位高度严格由体积算出来（尖斗里的水位按立方根，不是直线）。引擎里没有这些，所以放在本章目录。
import * as THREE from 'three';
import { taperLevel } from './math.js';
import { C, v3 } from './kit.js';

const D2R = Math.PI / 180;
const lamb = (color, o = {}) => new THREE.MeshLambertMaterial({ color, ...o });
const glassMat = (color, opacity) => new THREE.MeshLambertMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false });

/**
 * @typedef {object} VesselOpts
 * @property {'cyl'|'box'|'cone'|'pyr'} kind  圆筒 / 方筒 / 尖朝下的圆锥 / 尖朝下的四棱锥
 * @property {number} [r]  圆的半径（cyl / cone）
 * @property {number} [w]  方的边长（box / pyr）
 * @property {number} [d]  box 的另一边（默认 = w）
 * @property {number} h    高
 * @property {number} x @property {number} z @property {number} [y] 底（锥是尖）离地多高
 * @property {number} [vol] 起始体积
 * @property {string} [liquid] 水 / 谷的颜色
 * @property {string} [wall] 壁的颜色
 * @property {number} [opacity] 壁的透明度
 */

/** @param {any} ctx @param {VesselOpts} o */
export function makeVessel(ctx, o) {
  const { kind, h: H } = o;
  const round = kind === 'cyl' || kind === 'cone';
  const taper = kind === 'cone' || kind === 'pyr';
  const R = round ? o.r : 0;
  const W = round ? 2 * o.r : o.w;
  const Dp = round ? 2 * o.r : (o.d ?? o.w);
  const A = round ? Math.PI * R * R : W * Dp;
  const cap = taper ? (A * H) / 3 : A * H;
  const wallColor = o.wall ?? C.clay2;
  const liquidColor = o.liquid ?? C.water;

  const group = new THREE.Group();
  group.position.set(o.x, o.y ?? 0, o.z);
  ctx.add(group);
  const wallMat = glassMat(wallColor, o.opacity ?? 0.34);
  const solidMat = lamb(wallColor);
  const rimMat = lamb(C.woodDark);

  // ---- 壁 ----
  if (kind === 'cyl') {
    const side = new THREE.Mesh(new THREE.CylinderGeometry(R, R, H, 44, 1, true).translate(0, H / 2, 0), wallMat);
    const bottom = new THREE.Mesh(new THREE.CircleGeometry(R, 44).rotateX(-Math.PI / 2), solidMat);
    bottom.position.y = 0.02;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(R, 0.045, 8, 44).rotateX(Math.PI / 2), rimMat);
    rim.position.y = H;
    group.add(side, bottom, rim);
  } else if (kind === 'box') {
    const hidden = new THREE.MeshBasicMaterial({ visible: false });
    const mats = [wallMat, wallMat, hidden, wallMat, wallMat, wallMat];
    const side = new THREE.Mesh(new THREE.BoxGeometry(W, H, Dp).translate(0, H / 2, 0), mats);
    const bottom = new THREE.Mesh(new THREE.BoxGeometry(W, 0.06, Dp), solidMat);
    bottom.position.y = 0.03;
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(W, H, Dp).translate(0, H / 2, 0)), new THREE.LineBasicMaterial({ color: C.woodDark }));
    group.add(side, bottom, edges);
  } else if (kind === 'cone') {
    const side = new THREE.Mesh(new THREE.ConeGeometry(R, H, 44, 1, true).rotateX(Math.PI).translate(0, H / 2, 0), wallMat);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(R, 0.05, 8, 44).rotateX(Math.PI / 2), rimMat);
    rim.position.y = H;
    group.add(side, rim);
  } else {
    const r4 = (W * Math.SQRT2) / 2;
    const side = new THREE.Mesh(new THREE.CylinderGeometry(r4, 0, H, 4, 1, true).rotateY(Math.PI / 4).translate(0, H / 2, 0), wallMat);
    group.add(side);
    for (const [bw, bd, bx, bz] of [[W + 0.1, 0.1, 0, -W / 2], [W + 0.1, 0.1, 0, W / 2], [0.1, W, -W / 2, 0], [0.1, W, W / 2, 0]]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(bw, 0.1, bd), rimMat);
      bar.position.set(bx, H, bz);
      group.add(bar);
    }
  }
  group.traverse((m) => { if (m.isMesh && m.material !== wallMat) m.castShadow = true; });

  // ---- 水 / 谷：单位几何体，按体积算出的水位缩放 ----
  const holder = new THREE.Group();
  group.add(holder);
  let fillGeo;
  if (kind === 'cyl') fillGeo = new THREE.CylinderGeometry(1, 1, 1, 44);
  else if (kind === 'box') fillGeo = new THREE.BoxGeometry(1, 1, 1);
  else if (kind === 'cone') fillGeo = new THREE.CylinderGeometry(1, 0, 1, 44);
  else fillGeo = new THREE.CylinderGeometry(1, 0, 1, 4).rotateY(Math.PI / 4);
  fillGeo.translate(0, 0.5, 0);
  const fillMat = lamb(liquidColor, { transparent: true, opacity: 0.9 });
  const fill = new THREE.Mesh(fillGeo, fillMat);
  holder.add(fill);

  const INSET = o.inset ?? 0.94;
  const v = {
    kind, group, holder, fill, H, A, cap, R, W, D: Dp, taper, round,
    vol: 0,
    infinite: false,
    hw: round ? R : W / 2,
    home: group.position.clone(),
    tiltK: 0,
    /** 体积变了时调用：(新体积, 旧体积) */
    onVol: null,
    ticks: [],
    levelH(vol = v.vol) { return taper ? taperLevel(A, H, vol) : Math.min(H, vol / A); },
    cx: () => group.position.x,
    cz: () => group.position.z,
    rimY: () => group.position.y + H,
    surfaceY: () => group.position.y + v.levelH(),
    lipLocal(dir) { return { x: dir * v.hw, y: H }; },
    setVol(vol) {
      const nv = Math.max(0, Math.min(cap, vol));
      const prev = v.vol;
      v.vol = nv;
      const lev = v.levelH(nv);
      fill.visible = nv > 1e-6;
      const ly = Math.max(lev, 1e-4);
      if (kind === 'cyl') fill.scale.set(R * INSET, ly, R * INSET);
      else if (kind === 'box') fill.scale.set(W * INSET, ly, Dp * INSET);
      else if (kind === 'cone') { const s = R * INSET * (ly / H); fill.scale.set(s, ly, s); }
      else { const s = ((W * Math.SQRT2) / 2) * INSET * (ly / H); fill.scale.set(s, ly, s); }
      v.sync();
      v.onVol?.(nv, prev);
      return v;
    },
    /**
     * 水面永远是平的：倾斜的时候，把装水的那一块反着转回去，并让它靠在倒水那一边的壁上（水面和杯口一样高）。
     */
    sync() {
      holder.quaternion.copy(group.quaternion).invert();
      const k = 1 - 0.3 * v.tiltK;
      holder.scale.setScalar(k);
      if (v.tiltK > 0.001 && v.tiltDir) {
        group.updateMatrixWorld(true);
        const lipW = group.localToWorld(new THREE.Vector3(v.tiltDir * v.hw, H, 0));
        const lev = v.levelH();
        const half = taper ? v.hw * INSET * (lev / H) : v.hw * INSET;
        const target = group.worldToLocal(new THREE.Vector3(lipW.x - v.tiltDir * half * k * 0.9, lipW.y - lev * k - 0.04, lipW.z));
        holder.position.copy(target).multiplyScalar(Math.min(1, v.tiltK));
      } else holder.position.set(0, 0, 0);
    },
    /** 把体积平滑地变到 to（毫秒）。 */
    async animateVol(to, ms = 700) {
      const from = v.vol;
      await ctx.fx.tween({ duration: ms, ease: 'inOut', onUpdate: (k) => v.setVol(from + (to - from) * k) });
      v.setVol(to);
    },
    /**
     * 在壁上画刻度。list: [{ h, major, lit }]，h 是离底（锥是离尖）的高度。返回刻度物体数组，lit(i, true) 变金色。
     */
    addTicks(list, o2 = {}) {
      list.forEach((t) => {
        const col = t.base ?? (t.major ? C.gold : '#9B8A68');
        const m = lamb(col);
        let mesh;
        if (round) {
          mesh = new THREE.Mesh(new THREE.TorusGeometry(R * 1.012, t.major ? 0.04 : 0.014, 6, 44).rotateX(Math.PI / 2), m);
        } else {
          mesh = new THREE.Group();
          const th = t.major ? 0.07 : 0.035;
          for (const [bw, bd, bx, bz] of [[W * 1.02 + th, th, 0, -Dp * 0.51], [W * 1.02 + th, th, 0, Dp * 0.51], [th, Dp * 1.02, -W * 0.51, 0], [th, Dp * 1.02, W * 0.51, 0]]) {
            const bar = new THREE.Mesh(new THREE.BoxGeometry(bw, th, bd), m);
            bar.position.set(bx, 0, bz);
            mesh.add(bar);
          }
        }
        mesh.position.y = t.h;
        mesh.userData = { major: !!t.major, base: col };
        group.add(mesh);
        v.ticks.push(mesh);
      });
      void o2;
      return v.ticks;
    },
    /** 把第 i 道刻度点亮（金）/ 熄灭。 */
    lightTick(i, on = true) {
      const t = v.ticks[i];
      if (!t) return;
      const col = on ? C.gold : t.userData.base;
      t.traverse((m) => { if (m.isMesh) { m.material = lamb(col); if (on) m.scale.setScalar(1.0); } });
      if (on) ctx.fx.pop(t, { duration: 260 });
    },
  };
  v.setVol(o.vol ?? 0);
  return v;
}

/** 谷袋：一个会倒的「无限」谷源。 */
export function makeSack(ctx, { x, z, color = '#D8BC88' }) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  ctx.add(group);
  const S = 1.45;
  const inner = new THREE.Group();
  inner.scale.setScalar(S);
  group.add(inner);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.72, 1.15, 9).translate(0, 0.575, 0), lamb(color));
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.5, 0.35, 9).translate(0, 1.3, 0), lamb(color));
  const tie = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.05, 6, 14).rotateX(Math.PI / 2), lamb(C.woodDark));
  tie.position.y = 1.18;
  const grainTop = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.06, 9), lamb(C.grain));
  grainTop.position.y = 1.46;
  inner.add(body, neck, tie, grainTop);
  group.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  return {
    group, infinite: true, vol: 1, cap: 1, hw: 0.45 * S, H: 1.45 * S, tiltK: 0, liquid: C.grain, kind: 'sack',
    home: group.position.clone(),
    cx: () => group.position.x, cz: () => group.position.z,
    lipLocal: (dir) => ({ x: dir * 0.4 * S, y: 1.45 * S }),
    setVol() {}, sync() {},
  };
}

/** 一圈金色的「放这里」光圈（拖到附近时亮）。 */
export function makeDropRing(ctx, { x, z, r }) {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(r * 0.9, r, 48).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: C.gold, transparent: true, opacity: 0.0, depthWrite: false }),
  );
  ring.position.set(x, 0.05, z);
  ctx.add(ring);
  return {
    ring,
    show(on) { ring.material.opacity = on ? 0.85 : 0; },
  };
}

// ============================================================
// 倒
// ============================================================
export function makeStream(ctx, color) {
  const g = new THREE.Group();
  const mat = lamb(color, { transparent: true, opacity: 0.82 });
  const col = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 8).translate(0, -0.5, 0), mat);
  g.add(col);
  const drops = [];
  for (let i = 0; i < 7; i++) {
    const d = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 5), mat);
    g.add(d);
    drops.push(d);
  }
  const splash = new THREE.Mesh(new THREE.RingGeometry(0.7, 1, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#fff', transparent: true, opacity: 0.6, depthWrite: false }));
  g.add(splash);
  g.visible = false;
  ctx.add(g);
  return {
    g,
    /** 水柱从 top（世界点）一直落到 bottomY。t 是时间（秒），用来让水点流动。 */
    update(top, bottomY, t, on) {
      g.visible = on && top.y > bottomY + 0.02;
      if (!g.visible) return;
      const len = top.y - bottomY;
      g.position.set(top.x, top.y, top.z);
      const wob = 1 + Math.sin(t * 38) * 0.12;
      col.scale.set(0.085 * wob, len, 0.085 * wob);
      drops.forEach((d, i) => {
        const ph = (t * 2.6 + i / drops.length) % 1;
        d.position.set(Math.sin(i * 2.1 + t * 9) * 0.06, -ph * len, Math.cos(i * 1.7 + t * 9) * 0.06);
        d.scale.setScalar(0.6 + 0.5 * Math.sin(ph * Math.PI));
      });
      const sp = ((t * 3.2) % 1);
      splash.position.set(0, -len + 0.03, 0);
      splash.scale.setScalar(0.25 + sp * 0.55);
      splash.material.opacity = 0.65 * (1 - sp);
    },
  };
}

/**
 * 把 src 里的东西倒进 dst。src 端起来、移到 dst 上方、倾斜、水柱落下、水位一起变，最后回到原位。
 * 返回实际倒了多少体积。
 * @param {any} ctx @param {any} src @param {any} dst
 * @param {{ home?: any, amount?: number, dir?: number, flowMs?: number, quiet?: boolean, keepHome?: boolean, onFlow?: (f:number)=>void }} [o]
 */
export async function pour(ctx, src, dst, o = {}) {
  const dir = o.dir ?? (dst.cx() >= src.group.position.x ? 1 : -1);
  const room = dst.cap - dst.vol;
  const have = src.infinite ? Infinity : src.vol;
  const amount = Math.max(0, Math.min(o.amount ?? Infinity, have, room));
  const g = src.group;
  const from = g.position.clone();
  const home = (o.home ?? from).clone();
  const lip = src.lipLocal(dir);
  src.tiltDir = dir;
  const frac0 = src.infinite ? 0.6 : Math.min(1, amount / Math.max(1e-6, src.cap));
  const tiltA = (src.infinite ? 52 : 52) * D2R;
  const tiltB = (src.infinite ? 78 : 62 + 50 * frac0) * D2R;
  const lipX = dst.cx() - dir * dst.hw * 0.28;
  const lipY = dst.rimY() + 0.6;
  const lipZ = dst.cz();
  const stream = makeStream(ctx, src.liquid || dst.liquid || C.water);
  const tmp = new THREE.Vector3();

  const pose = (theta, blend = 1) => {
    // 以 dir=+1（向 +x 倾）为例：绕 z 轴顺时针转 theta
    const a = -dir * theta;
    const ca = Math.cos(a), sa = Math.sin(a);
    const px = lipX - (lip.x * ca - lip.y * sa);
    const py = lipY - (lip.x * sa + lip.y * ca);
    g.position.x = from.x + (px - from.x) * blend;
    g.position.y = from.y + (py - from.y) * blend;
    g.position.z = from.z + (lipZ - from.z) * blend;
    g.rotation.z = a;
    src.tiltK = Math.min(1, theta / (60 * D2R));
    src.sync();
  };
  const lipWorld = () => {
    const a = g.rotation.z;
    return tmp.set(g.position.x + (lip.x * Math.cos(a) - lip.y * Math.sin(a)), g.position.y + (lip.x * Math.sin(a) + lip.y * Math.cos(a)), g.position.z);
  };

  if (!o.quiet) ctx.audio.play('whoosh');
  // 1) 端起来、移过去、倾斜
  await ctx.fx.tween({
    duration: 640, ease: 'inOut',
    onUpdate: (k) => pose(tiltA * k, k),
  });
  // 2) 哗啦流下去
  const d0 = dst.vol, s0 = src.vol;
  const flowMs = o.flowMs ?? Math.min(2600, 1000 + 1400 * Math.min(1, amount / Math.max(1e-6, dst.cap) * 2.2));
  let t = 0;
  let lastTick = -1;
  const off = ctx.onUpdate((dt) => { t += dt; });
  ctx.audio.play('pop');
  await ctx.fx.tween({
    duration: flowMs, ease: 'inOut',
    onUpdate: (k) => {
      pose(tiltA + (tiltB - tiltA) * k);
      if (!src.infinite) src.setVol(s0 - amount * k);
      dst.setVol(d0 + amount * k);
      stream.update(lipWorld(), dst.surfaceY(), t, true);
      const step = Math.floor(k * 9);
      if (step !== lastTick && !o.quiet) { lastTick = step; ctx.audio.play('grow', { n: step }); }
      o.onFlow?.(k);
    },
  });
  if (!src.infinite) src.setVol(s0 - amount);
  dst.setVol(d0 + amount);
  stream.update(lipWorld(), dst.surfaceY(), t, false);
  off?.();
  // 3) 回去
  const endPos = g.position.clone();
  const endRot = g.rotation.z;
  const endK = src.tiltK;
  await ctx.fx.tween({
    duration: 560, ease: 'inOut',
    onUpdate: (k) => {
      g.position.lerpVectors(endPos, home, k);
      g.rotation.z = endRot * (1 - k);
      src.tiltK = endK * (1 - k);
      src.sync();
    },
  });
  g.position.copy(home);
  g.rotation.z = 0;
  src.tiltK = 0;
  src.sync();
  ctx.remove(stream.g);
  return amount;
}

/** 从上面浇水把容器装满（舀水的感觉）。 */
export async function refill(ctx, v, ms = 900) {
  const stream = makeStream(ctx, v.fill.material.color.getStyle());
  let t = 0;
  const off = ctx.onUpdate((dt) => { t += dt; });
  ctx.audio.play('pop');
  const from = v.vol;
  const top = v3(v.cx(), v.rimY() + 1.6, v.cz());
  await ctx.fx.tween({
    duration: ms, ease: 'inOut',
    onUpdate: (k) => {
      v.setVol(from + (v.cap - from) * k);
      stream.update(top, v.surfaceY(), t, true);
      if (Math.floor(k * 8) !== Math.floor(((k * ms - 16) / ms) * 8)) ctx.audio.play('grow', { n: Math.floor(k * 8) });
    },
  });
  v.setVol(v.cap);
  off?.();
  ctx.remove(stream.g);
}

/** 拖到目标附近就亮光圈、松手在附近就倒；不在附近就弹回。给「拖一个容器去倒」用。 */
export function dragToPour(ctx, src, dst, o) {
  const { near = 3.2, lift = 0.5, onPour, enabled = () => true, drop } = o;
  const home = src.group.position.clone();
  let busy = false;
  const handle = ctx.pointer.draggable(src.group, {
    ringSize: o.ringSize ?? 1.1,
    lift: 0,
    onStart: () => { if (busy) return; },
    onMove: (p) => {
      if (busy) return;
      src.group.position.set(p.x, home.y + lift, p.z);
      drop?.show(Math.hypot(p.x - dst.cx(), p.z - dst.cz()) < near);
    },
    onEnd: async (p, { moved }) => {
      drop?.show(false);
      if (busy || !moved) return;
      if (enabled() && Math.hypot(p.x - dst.cx(), p.z - dst.cz()) < near) {
        busy = true;
        handle.enabled = false;
        // 从松手的位置接着倒：pour 里以当前位置为起点
        await onPour(home);
        busy = false;
      } else {
        busy = true;
        ctx.audio.play('whoosh');
        await ctx.fx.to(src.group.position, { x: home.x, y: home.y, z: home.z }, 280);
        busy = false;
      }
    },
  });
  return handle;
}

export { v3 };
