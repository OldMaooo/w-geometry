// 席子围成的粮囤（5-5）：一圈闭合的轮廓，会在「瘦长方形 → 方形 → 圆」之间顺滑地变，围墙（席子）一样长、一样高。
// 谷面的高度 = 体积 ÷ 底面积，所以同一堆谷子换个形状，水位会跟着变（变宽了就落下去，空出一截）。
import * as THREE from 'three';
import { rectPointAt, circlePointAt } from './math.js';
import { C } from './kit.js';

const N = 96;

/** 一圈轮廓的几何：侧面（下环 + 上环）+ 可选顶 / 底扇面。update(pts, y0, y1) 改形状 / 高度。 */
function ringGeo(withTop, withBottom) {
  const nv = 2 * N + 2;
  const pos = new Float32Array(nv * 3);
  const idx = [];
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N;
    idx.push(i, N + i, N + j, i, N + j, j); // 侧面（朝外）
    if (withTop) idx.push(2 * N, N + j, N + i); // 顶（朝上）
    if (withBottom) idx.push(2 * N + 1, i, j); // 底（朝下）
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(idx);
  return {
    geo: g,
    update(pts, y0, y1, k = 1) {
      for (let i = 0; i < N; i++) {
        pos[i * 3] = pts[i].x * k; pos[i * 3 + 1] = y0; pos[i * 3 + 2] = pts[i].z * k;
        pos[(N + i) * 3] = pts[i].x * k; pos[(N + i) * 3 + 1] = y1; pos[(N + i) * 3 + 2] = pts[i].z * k;
      }
      pos.set([0, y1, 0], 2 * N * 3);
      pos.set([0, y0, 0], (2 * N + 1) * 3);
      g.attributes.position.needsUpdate = true;
      g.computeVertexNormals();
      g.computeBoundingSphere();
    },
  };
}

/**
 * @param {any} ctx
 * @param {{ p: number, H: number, x: number, z: number, shapes: ({type:'rect', w:number}|{type:'circle'})[], t?: number, liquid?: string }} o
 *   p 是席子长（周长），H 是席子高。shapes 是可以变的形状，t 是在这串形状里的位置（0 起，可以是小数）。
 */
export function makeSilo(ctx, o) {
  const { p, H } = o;
  const group = new THREE.Group();
  group.position.set(o.x, 0, o.z);
  ctx.add(group);

  const wallG = ringGeo(false, false);
  const wallCol = new Float32Array((2 * N + 2) * 3);
  const c1 = new THREE.Color('#DCC27C'), c2 = new THREE.Color('#C7A95E');
  for (let i = 0; i < N; i++) {
    const c = Math.floor(i / 2) % 2 ? c1 : c2; // 席子的竖条纹
    for (const v of [i, N + i]) wallCol.set([c.r, c.g, c.b], v * 3);
  }
  wallG.geo.setAttribute('color', new THREE.BufferAttribute(wallCol, 3));
  const wall = new THREE.Mesh(wallG.geo, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, transparent: true, opacity: 0.55, depthWrite: false }));
  const floorG = ringGeo(false, true);
  const floor = new THREE.Mesh(floorG.geo, new THREE.MeshLambertMaterial({ color: '#8A6A40', side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  const fillG = ringGeo(true, false);
  const fill = new THREE.Mesh(fillG.geo, new THREE.MeshLambertMaterial({ color: o.liquid ?? C.grain, flatShading: true }));
  const freeG = ringGeo(true, false);
  const free = new THREE.Mesh(freeG.geo, new THREE.MeshLambertMaterial({ color: '#FFF0B8', transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide }));
  free.visible = false;
  fill.castShadow = true;
  floor.receiveShadow = true;
  group.add(floor, fill, free, wall);

  const pointOf = (s, sh) => (sh.type === 'circle' ? circlePointAt(p, s) : rectPointAt(p, sh.w, s));
  const area = (pts) => { let a = 0; for (let i = 0; i < pts.length; i++) { const q = pts[(i + 1) % pts.length]; a += pts[i].x * q.z - q.x * pts[i].z; } return Math.abs(a) / 2; };

  const s = {
    group, p, H, liquid: C.grain,
    t: 0, pts: [], area: 1, vol: 0, hw: 1, tiltK: 0,
    get cap() { return s.area * H; },
    cx: () => group.position.x,
    cz: () => group.position.z,
    rimY: () => H,
    surfaceY: () => Math.min(H, s.vol / s.area),
    lipLocal: () => ({ x: 0, y: 0 }),
    sync() {},
    /** 形状位置 t（在 shapes 里，小数 = 两个形状之间）。 */
    setT(t) {
      const n = o.shapes.length;
      s.t = Math.min(n - 1, Math.max(0, t));
      const i = Math.min(n - 2, Math.floor(s.t));
      const k = n === 1 ? 0 : s.t - i;
      const A = o.shapes[n === 1 ? 0 : i], B = o.shapes[n === 1 ? 0 : i + 1];
      const e = k * k * (3 - 2 * k);
      s.pts = Array.from({ length: N }, (_, m) => {
        const arc = (m / N) * p;
        const a = pointOf(arc, A), b = pointOf(arc, B);
        return { x: a.x + (b.x - a.x) * e, z: a.z + (b.z - a.z) * e };
      });
      s.area = area(s.pts);
      s.hw = Math.max(...s.pts.map((q) => Math.abs(q.x)));
      s.refresh();
    },
    refresh() {
      wallG.update(s.pts, 0, H);
      floorG.update(s.pts, 0.07, 0.07);
      const lev = Math.min(H, s.vol / s.area);
      fill.visible = s.vol > 1e-6;
      fillG.update(s.pts, 0.075, Math.max(0.09, lev), 0.97);
      // 没装满的那一截
      free.visible = s.showFree && lev < H - 0.02;
      if (free.visible) freeG.update(s.pts, lev, H, 0.99);
    },
    showFree: false,
    setVol(v) { s.vol = Math.max(0, Math.min(v, s.cap + 1e-9)); s.refresh(); },
    /** 谷子装不下时多出多少（调用方决定怎么处理）。 */
    overflow() { return Math.max(0, s.vol - s.cap); },
    setFree(on) { s.showFree = on; s.refresh(); },
  };
  s.setT(o.t ?? 0);
  return s;
}
