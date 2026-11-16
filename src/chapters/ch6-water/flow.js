// 第 6 章的「流水」：一段段的渠（可以斜着、拐弯）、水面沿着渠推进、小水沫、田里的水位、积水、冲坏时的碎土。
// 不做流体模拟：水面是「沿路径推进的一条水」，到没到、停在哪都由关卡里的数字决定。
import * as THREE from 'three';
import { mat } from '../../engine/shared.js';
import { PALETTE } from '../../engine/palette.js';
import { C, v3, unitBox, unitBoxZ, unitBoxY, waterMat, block, go, dur } from './kit.js';

/**
 * 一条渠：沿着一串点铺出渠底和两边的壁，水面可以从起点推到任意长度。
 * 点是渠底中线的位置 {x,y,z}（y 可以不同，渠就是斜的）。
 * @param {any} ctx
 * @param {{ width?: number, wall?: number, floor?: string, wallColor?: string, parent?: THREE.Object3D, foam?: number }} [o]
 */
export function makeChannel(ctx, o = {}) {
  const root = new THREE.Group();
  if (o.parent) o.parent.add(root); else ctx.add(root);
  const trough = new THREE.Group();
  const water = new THREE.Group();
  root.add(trough, water);
  const S = {
    width: o.width ?? 1.1, wall: o.wall ?? 0.26, pts: [], cum: [0], front: 0, flowing: false,
    segs: [], wallH: 0.34,
  };
  const floorMat = mat(o.floor ?? C.troughFloor);
  const wallMat = mat(o.wallColor ?? C.trough);
  const wm = waterMat();
  const foamMat = mat(C.foam);
  const n = o.foam ?? 16;
  const foam = Array.from({ length: n }, (_, i) => {
    const m = new THREE.Mesh(unitBox(), foamMat);
    m.scale.set(0.12, 0.05, 0.2);
    m.visible = false;
    water.add(m);
    return { m, u: (i / n), lane: ((i * 7) % 5) / 4 - 0.5 };
  });

  function mesh(g, m, sx, sy, sz, x, y, z, cast = true) {
    const b = new THREE.Mesh(g, m);
    b.scale.set(sx, sy, sz);
    b.position.set(x, y, z);
    b.castShadow = cast;
    b.receiveShadow = true;
    return b;
  }

  function setPath(pts) {
    S.pts = pts.map((p) => v3(p.x, p.y ?? 0, p.z));
    S.cum = [0];
    for (let i = 1; i < S.pts.length; i++) S.cum.push(S.cum[i - 1] + S.pts[i].distanceTo(S.pts[i - 1]));
    trough.clear();
    water.children.slice(n).forEach((c) => water.remove(c));
    S.segs = [];
    const W = S.width, wl = S.wall;
    for (let i = 0; i < S.pts.length - 1; i++) {
      const a = S.pts[i], b = S.pts[i + 1];
      const L = a.distanceTo(b);
      if (L < 1e-4) { S.segs.push(null); continue; }
      // 渠壁
      const g = new THREE.Group();
      g.position.copy(a).lerp(b, 0.5);
      g.lookAt(b);
      g.add(
        mesh(unitBox(), floorMat, W + wl * 2, 0.16, L + wl, 0, -0.08, 0),
        mesh(unitBox(), wallMat, wl, S.wallH, L + wl, -(W / 2 + wl / 2), 0.09, 0),
        mesh(unitBox(), wallMat, wl, S.wallH, L + wl, W / 2 + wl / 2, 0.09, 0),
      );
      trough.add(g);
      // 水面（从起点往终点长）
      const pv = new THREE.Group();
      pv.position.copy(a);
      pv.lookAt(b);
      const wmesh = new THREE.Mesh(unitBoxZ(), wm);
      wmesh.scale.set(W * 0.94, 0.16, 0.001);
      wmesh.position.y = 0.01;
      wmesh.visible = false;
      wmesh.receiveShadow = true;
      pv.add(wmesh);
      water.add(pv);
      S.segs.push({ L, start: S.cum[i], m: wmesh, a, b });
    }
    // 拐弯处补一个小方块，免得缝隙
    for (let i = 1; i < S.pts.length - 1; i++) {
      const p = S.pts[i];
      trough.add(mesh(unitBox(), floorMat, W + wl * 2, 0.16, W + wl * 2, p.x, p.y - 0.08, p.z));
    }
    setFront(S.front);
  }

  function setFront(s) {
    S.front = Math.max(0, Math.min(S.cum[S.cum.length - 1] || 0, s));
    for (const sg of S.segs) {
      if (!sg) continue;
      const f = Math.max(0, Math.min(sg.L, S.front - sg.start));
      sg.m.visible = f > 0.002;
      sg.m.scale.z = Math.max(0.001, f);
    }
  }

  function pointAt(s) {
    const t = Math.max(0, Math.min(S.cum[S.cum.length - 1], s));
    for (let i = 0; i < S.pts.length - 1; i++) {
      if (t <= S.cum[i + 1] + 1e-9) {
        const L = S.cum[i + 1] - S.cum[i] || 1;
        return S.pts[i].clone().lerp(S.pts[i + 1], (t - S.cum[i]) / L);
      }
    }
    return S.pts[S.pts.length - 1].clone();
  }
  function dirAt(s) {
    for (let i = 0; i < S.pts.length - 1; i++) {
      if (s <= S.cum[i + 1] + 1e-9) return S.pts[i + 1].clone().sub(S.pts[i]).normalize();
    }
    return v3(1, 0, 0);
  }

  const off = ctx.onUpdate((dt) => {
    for (const f of foam) {
      if (!S.flowing || S.front < 0.3) { f.m.visible = false; continue; }
      f.u = (f.u + dt * 0.55) % 1;
      const s = f.u * S.front;
      const p = pointAt(s), d = dirAt(s);
      f.m.visible = true;
      f.m.position.set(p.x - d.z * f.lane * S.width * 0.8, p.y + 0.2, p.z + d.x * f.lane * S.width * 0.8);
      f.m.rotation.y = Math.atan2(d.x, d.z);
    }
  });
  ctx.onDispose(off);

  const api = {
    root, state: S, setPath, setFront, pointAt, dirAt,
    get front() { return S.front; },
    get total() { return S.cum[S.cum.length - 1] || 0; },
    get cum() { return S.cum; },
    get pts() { return S.pts; },
    setFlowing(on) { S.flowing = on; if (!on) foam.forEach((f) => { f.m.visible = false; }); },
    setWidth(w) { S.width = w; if (S.pts.length) setPath(S.pts); },
    setVisible(on) { root.visible = on; },
    dispose() { off(); root.removeFromParent(); },
    /** 水面颜色（比如「还没通」时淡一点）。 */
    show(on = true) { root.visible = on; },
  };
  return api;
}

/** 水沿着渠往前推：从当前位置推到 target（沿路径的长度）。speed(s) 给每个位置的速度（步/秒）。 */
export function advance(ctx, ch, target, speed = () => 3) {
  return go(ctx.waitFor((done) => {
    ch.setFlowing(true);
    const off = ctx.onUpdate((dt) => {
      const k = ctx.auto ? 2.6 : 1;
      const s = ch.front + speed(ch.front) * dt * k;
      if (s >= target - 1e-6) { ch.setFront(target); off(); done(); return; }
      ch.setFront(s);
    });
  }));
}

/** 水退回去（渠里的水慢慢缩回起点）。 */
export async function drain(ctx, ch, ms = 600) {
  const from = ch.front;
  ch.setFlowing(false);
  await go(ctx.fx.tween({
    duration: dur(ctx, ms), ease: 'in', onUpdate: (k) => ch.setFront(from * (1 - k)),
  }));
  ch.setFront(0);
}

/** 地上的一汪积水，慢慢变大。返回 { mesh, grow(r, ms), remove() }。 */
export function makePuddle(ctx, x, z, { y = 0.04, ratio = 0.7 } = {}) {
  const geo = new THREE.CylinderGeometry(1, 1, 0.04, 22);
  const m = new THREE.Mesh(geo, waterMat());
  m.position.set(x, y, z);
  m.scale.set(0.01, 1, 0.01);
  m.receiveShadow = true;
  ctx.add(m);
  let r = 0.01;
  return {
    mesh: m,
    async grow(to, ms = 900) {
      const from = r;
      await go(ctx.fx.tween({
        duration: dur(ctx, ms), ease: 'out',
        onUpdate: (k) => { r = from + (to - from) * k; m.scale.set(r, 1, r * ratio); },
      }));
    },
    remove() { ctx.remove(m); },
  };
}

/** 冲坏了：一把碎土飞出去再落下。 */
export function crumble(ctx, at, { count = 14, color = '#8E6B3F', spread = 1.6 } = {}) {
  const bits = [];
  for (let i = 0; i < count; i++) {
    const s = 0.12 + Math.random() * 0.14;
    const m = block(color, s, s, s, { x: at.x, y: at.y + 0.2, z: at.z, cast: false });
    const a = Math.random() * Math.PI * 2;
    bits.push({ m, vx: Math.cos(a) * (0.6 + Math.random()) * spread, vz: Math.sin(a) * (0.6 + Math.random()) * spread, vy: 2.5 + Math.random() * 2.2 });
    ctx.add(m);
  }
  let t = 0;
  const off = ctx.onUpdate((dt) => {
    t += dt;
    for (const b of bits) {
      b.vy -= 9 * dt;
      b.m.position.x += b.vx * dt; b.m.position.z += b.vz * dt; b.m.position.y += b.vy * dt;
      b.m.rotation.x += dt * 6; b.m.rotation.z += dt * 4;
      if (b.m.position.y < 0.06) { b.m.position.y = 0.06; b.vx = b.vz = b.vy = 0; }
    }
    if (t > 2.2) { off(); bits.forEach((b) => ctx.remove(b.m)); }
  });
  return () => { off(); bits.forEach((b) => ctx.remove(b.m)); };
}

/**
 * 一块田 + 田里的水位 + 庄稼。w×d 的长方田，左上角 (x,z)。
 * setLevel(l)：l=1 刚好浇透；l>1 淹了（水漫出田埂）；l<1 还干着。
 */
export function makeField(ctx, { x, z, w, d, soil = '#B98E57', ridge = true, seed = 5 }) {
  const plot = ctx.props.plot({ x, z, w, d, soil, ridge });
  const vol = new THREE.Mesh(unitBoxY(), waterMat());
  vol.position.set(x + w / 2, 0.04, z + d / 2);
  vol.scale.set(Math.max(0.1, w - 0.2), 0.001, Math.max(0.1, d - 0.2));
  vol.visible = false;
  ctx.add(vol);
  const floodMat = new THREE.MeshPhongMaterial({ color: C.water, transparent: true, opacity: 0.55, shininess: 60, depthWrite: false });
  const flood = new THREE.Mesh(unitBoxY(), floodMat);
  flood.position.set(x + w / 2, 0.03, z + d / 2);
  flood.scale.set(w, 0.03, d);
  flood.visible = false;
  ctx.add(flood);
  const cells = [];
  for (let i = 0; i < w; i++) for (let j = 0; j < d; j++) cells.push({ x: x + i + 0.5, z: z + j + 0.5 });
  let crops = null;
  const bed = plot.group.getObjectByName('bed');
  const api = {
    plot, cells, w, d, x, z, inlet: { x: x + w / 2, z },
    center: () => v3(x + w / 2, 0, z + d / 2),
    wet(on) { if (bed) bed.material = mat(on ? '#7D5B34' : soil); },
    setLevel(l) {
      const lv = Math.max(0, l);
      vol.visible = lv > 0.01;
      vol.scale.y = Math.max(0.001, Math.min(lv, 1) * 0.34);
      const over = Math.max(0, lv - 1.04);
      flood.visible = over > 0.01;
      if (over > 0.01) {
        const k = Math.min(1, over / 0.6);
        flood.scale.set(w + 0.6 + k * 3.4, 0.03, d + 0.6 + k * 3.4);
        floodMat.opacity = 0.35 + 0.3 * k;
      }
      api.wet(lv > 0.3);
    },
    /** 庄稼一棵棵长出来。 */
    async grow(o = {}) {
      if (!crops) crops = ctx.props.crops({ cells, kind: 'rice', per: o.per ?? 3, seed });
      await go(crops.grow({ stagger: o.stagger ?? 14, duration: 500, onEach: (c) => { if (c % 3 === 0) ctx.audio.play('grow', { n: c }); } }));
    },
    /** 淹了：庄稼没了，水退去。 */
    drainFlood() { flood.visible = false; },
    reset() { api.setLevel(0); },
    dispose() { ctx.remove(vol); ctx.remove(flood); ctx.remove(plot.group); if (crops) ctx.remove(crops.mesh); },
  };
  return api;
}

/** 水库：石头水池 + 水面。从 (x,z) 为中心、w×d、水面高 y。 */
export function makeReservoir(ctx, { x, z, w, d, y, parent }) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  if (parent) parent.add(g); else ctx.add(g);
  const body = block(C.stone, w, Math.max(0.1, y - 0.1), d, { parent: g });
  const lip = block(C.stoneDark, w + 0.3, 0.14, d + 0.3, { y: y - 0.1, parent: g });
  const wv = new THREE.Mesh(unitBoxY(), waterMat());
  wv.scale.set(w - 0.3, 0.12, d - 0.3);
  wv.position.y = y - 0.06;
  g.add(wv);
  void lip;
  return { group: g, water: wv, setY(ny) { body.scale.y = Math.max(0.1, ny - 0.1); lip.position.y = ny - 0.1; wv.position.y = ny - 0.06; } };
}

export { PALETTE };
