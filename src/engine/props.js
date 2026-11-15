// 通用道具：地台、木桩、结绳、田、草垫、篱笆、村民、树、石头、庄稼、矩、水、云。
// 一律方块风、低面数、平涂暖色。所有工厂都会把物体加进 parent（默认当前屏幕根节点），
// 换关时引擎统一清理，关卡不用自己删。
//
// 坐标：x 向右、z 朝镜头（俯视时 z 越大越靠下）、y 向上。1 个世界单位 = 1 步。
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PALETTE } from './palette.js';
import { mat, geo, shared } from './shared.js';

/** 可复现的随机数（同一个 seed 每次摆出来一样）。 */
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let invisibleMat = null;
const basicCache = new Map();
/** 不受光照的纯色材质（发光的结、变绿的矩）。 */
const basic = (c) => { let m = basicCache.get(c); if (!m) { m = shared(new THREE.MeshBasicMaterial({ color: c })); basicCache.set(c, m); } return m; };
const box = (w, h, d) => geo(`box${w}|${h}|${d}`, () => new THREE.BoxGeometry(w, h, d));
const shade = (hex, k) => {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, Math.min(1, Math.max(0, hsl.l * k)));
  return `#${c.getHexString()}`;
};

function meshOf(g, m, { cast = true, receive = true } = {}) {
  const o = new THREE.Mesh(g, m);
  o.castShadow = cast;
  o.receiveShadow = receive;
  return o;
}

/** 草垫的稻草纹理（共享）。 */
let strawTex = null;
function strawTexture() {
  if (strawTex) return strawTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = PALETTE.straw;
  g.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 64; i += 4) {
    g.fillStyle = i % 8 ? 'rgba(150,110,40,0.22)' : 'rgba(255,240,190,0.35)';
    g.fillRect(0, i, 64, 2);
  }
  g.strokeStyle = 'rgba(120,85,30,0.5)';
  g.lineWidth = 3;
  g.strokeRect(1.5, 1.5, 61, 61);
  strawTex = shared(new THREE.CanvasTexture(c));
  strawTex.colorSpace = THREE.SRGBColorSpace;
  return strawTex;
}

/** 水面波纹贴图（共享）。 */
let rippleTex = null;
function rippleTexture() {
  if (rippleTex) return rippleTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 128, 128);
  const r = rng(7);
  for (let i = 0; i < 36; i++) {
    g.fillStyle = `rgba(190,225,245,${0.4 + r() * 0.5})`;
    const x = r() * 128, y = r() * 128, w = 8 + r() * 22;
    g.fillRect(x, y, w, 2);
    g.fillRect(x - 128, y, w, 2);
  }
  rippleTex = shared(new THREE.CanvasTexture(c));
  rippleTex.wrapS = rippleTex.wrapT = THREE.RepeatWrapping;
  rippleTex.colorSpace = THREE.SRGBColorSpace;
  return rippleTex;
}

/**
 * @param {import('./stage.js').Stage} stage
 */
export function createProps(stage) {
  const add = (o, parent) => { (parent || stage.root).add(o); return o; };
  const animators = new Set();
  stage.onFrame((dt, t) => { for (const fn of animators) { if (!fn.obj.parent) animators.delete(fn); else fn(dt, t); } });
  const animate = (obj, fn) => { fn.obj = obj; animators.add(fn); };

  /**
   * 地台：一块桌上的微缩小景。中间是干活的土地（w×d，带一格一格的深浅），四周草地、树、石头，可选一条河。
   * @param {{ w?: number, d?: number, x?: number, z?: number, margin?: number, river?: 'back'|'left'|'right'|null,
   *   seed?: number, cells?: boolean, soil?: string, trees?: number, puddles?: number,
   *   avoid?: {x:number,z:number,r:number}[], parent?: THREE.Object3D }} [o]
   *   puddles：洪水留下的水洼个数（避开 avoid 里的区域，坐标相对地台中心）
   */
  function ground(o = {}) {
    const { w = 20, d = 14, x = 0, z = 0, margin = 5, river = 'back', seed = 3, cells = true, soil = PALETTE.soil } = o;
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const W = w + margin * 2, D = d + margin * 2 + (river === 'back' ? 4 : 0);
    const cz = river === 'back' ? -2 : 0;
    // 底座：草皮 + 泥土侧面
    const slab = meshOf(new THREE.BoxGeometry(W, 1.2, D), [
      mat(PALETTE.ridge), mat(PALETTE.ridge), mat(PALETTE.grass), mat('#7A5A36'), mat(PALETTE.ridge), mat(PALETTE.ridge),
    ], { cast: false });
    slab.position.set(0, -0.6, cz);
    g.add(slab);
    // 中间土地：一格一格稍有深浅
    const cv = document.createElement('canvas');
    const px = 16;
    cv.width = w * px; cv.height = d * px;
    const c2 = cv.getContext('2d');
    const r = rng(seed);
    for (let i = 0; i < w; i++) for (let j = 0; j < d; j++) {
      c2.fillStyle = cells ? shade(soil, 0.96 + r() * 0.08 - ((i + j) % 2) * 0.025) : shade(soil, 0.98 + r() * 0.04);
      c2.fillRect(i * px, j * px, px, px);
    }
    // 湿一块、干一块的斑驳（洪水退后的地）
    for (let i = 0; i < (w * d) / 10; i++) {
      const bx = r() * w * px, by = r() * d * px, br = (1 + r() * 2.5) * px;
      const grd = c2.createRadialGradient(bx, by, 0, bx, by, br);
      grd.addColorStop(0, r() < 0.55 ? 'rgba(96,66,34,0.10)' : 'rgba(255,238,200,0.12)');
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      c2.fillStyle = grd;
      c2.fillRect(bx - br, by - br, br * 2, br * 2);
    }
    for (let i = 0; i < w * d * 1.2; i++) {
      c2.fillStyle = `rgba(110,80,40,${0.12 + r() * 0.15})`;
      c2.fillRect(r() * w * px, r() * d * px, 2, 2);
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const soilMesh = meshOf(new THREE.BoxGeometry(w, 0.1, d), new THREE.MeshLambertMaterial({ map: tex }), { cast: false });
    soilMesh.position.y = -0.03;
    soilMesh.name = 'soil';
    g.add(soilMesh);
    // 河
    if (river === 'back') {
      const wv = water({ x: 0, z: -d / 2 - 3.2, w: W - 0.02, d: 3.2, parent: g });
      wv.position.y = -0.12;
      // 河岸沙
      const bank = meshOf(box(W, 0.12, 0.8), mat('#E2CD98'), { cast: false });
      bank.position.set(0, -0.08, -d / 2 - 1.2);
      g.add(bank);
    }
    // 洪水留下的水洼（可选）
    for (let i = 0; i < (o.puddles || 0); i++) {
      const pw = 1.2 + r() * 1.6, pd = 0.8 + r() * 1.0;
      const px2 = (r() - 0.5) * (w - pw - 1), pz2 = (r() - 0.5) * (d - pd - 1);
      if (o.avoid?.some((a) => Math.abs(a.x - px2) < a.r + pw / 2 && Math.abs(a.z - pz2) < a.r + pd / 2)) continue;
      const pm = new THREE.Mesh(geo('puddle', () => new THREE.CylinderGeometry(0.5, 0.5, 0.02, 10)), mat('#8FC3DE', { opacity: 0.85 }));
      pm.scale.set(pw, 1, pd);
      pm.position.set(px2, 0.03, pz2);
      g.add(pm);
    }
    // 四周点缀：树、石头、草丛、小花（只放在边缘，不挡操作区）
    const nTrees = o.trees ?? Math.round((W + D) / 3.2);
    let placed = 0, tries = 0;
    while (placed < nTrees && tries++ < 400) {
      const tx = (r() - 0.5) * (W - 1.4);
      const tz = cz + (r() - 0.5) * (D - 1.4);
      if (Math.abs(tx) < w / 2 + 1.2 && Math.abs(tz) < d / 2 + 1.2) continue;
      if (river === 'back' && tz < -d / 2 - 1.4 && tz > -d / 2 - 5) continue;
      const kind = r() < 0.35 ? 'pine' : 'round';
      tree({ x: tx, z: tz, kind, s: 0.75 + r() * 0.5, parent: g, seed: Math.floor(r() * 1000) });
      placed++;
    }
    for (let i = 0; i < nTrees * 1.5; i++) {
      const tx = (r() - 0.5) * (W - 1), tz = cz + (r() - 0.5) * (D - 1);
      if (Math.abs(tx) < w / 2 + 0.5 && Math.abs(tz) < d / 2 + 0.5) continue;
      if (river === 'back' && tz < -d / 2 - 0.9 && tz > -d / 2 - 5) continue;
      if (r() < 0.3) rock({ x: tx, z: tz, s: 0.3 + r() * 0.4, parent: g });
      else tuft({ x: tx, z: tz, parent: g, color: r() < 0.25 ? '#F4D06F' : PALETTE.deepGreen });
    }
    return add(g, o.parent);
  }

  /** 木桩。 @param {{x?:number, z?:number, h?:number, color?:string, parent?: THREE.Object3D}} [o] */
  function stake(o = {}) {
    const { x = 0, z = 0, h = 1.0, color = PALETTE.wood } = o;
    const g = new THREE.Group();
    const post = meshOf(geo(`stake${h}`, () => new THREE.CylinderGeometry(0.15, 0.19, h, 6)), mat(color));
    post.position.y = h / 2;
    const cap = meshOf(geo('stakecap', () => new THREE.CylinderGeometry(0.16, 0.15, 0.07, 6)), mat(shade(color, 0.7)));
    cap.position.y = h + 0.02;
    const tip = meshOf(geo('stakebase', () => new THREE.CylinderGeometry(0.28, 0.33, 0.07, 6)), mat('#9B7B4E'), { cast: false });
    tip.position.y = 0.02;
    g.add(post, cap, tip);
    g.position.set(x, 0, z);
    g.userData.top = h;
    return add(g, o.parent);
  }

  /**
   * 结绳：一条折线（可闭合），每隔 every 步一个结。knots 从起点开始数（起点那个不算）。
   * @param {{ points?: {x:number,z:number}[], closed?: boolean, every?: number, y?: number, color?: string, knotColor?: string, parent?: THREE.Object3D }} [o]
   */
  function rope(o = {}) {
    const g = new THREE.Group();
    const y = o.y ?? 0.32;
    const every = o.every ?? 1;
    const ropeMat = mat(o.color || PALETTE.rope);
    const knotMat = mat(o.knotColor || '#B89A62');
    const litMat = basic(PALETTE.gold);
    const segGeo = geo('ropeSeg', () => new THREE.CylinderGeometry(0.065, 0.065, 1, 6).rotateX(Math.PI / 2));
    const knotGeo = geo('ropeKnot', () => new THREE.IcosahedronGeometry(0.13, 0));
    const segs = [];
    const knots = [];
    let pts = [];
    let lit = 0;
    let knotPos = [];

    function setPoints(points) {
      pts = points.map((p) => new THREE.Vector3(p.x, y, p.z));
      const path = o.closed && pts.length > 2 ? [...pts, pts[0]] : pts;
      // 段
      const nSeg = Math.max(0, path.length - 1);
      while (segs.length < nSeg) { const m = meshOf(segGeo, ropeMat, { receive: false }); g.add(m); segs.push(m); }
      segs.forEach((m, i) => {
        if (i >= nSeg) { m.visible = false; return; }
        const a = path[i], b = path[i + 1];
        const L = a.distanceTo(b);
        m.visible = L > 1e-4;
        m.position.copy(a).lerp(b, 0.5);
        m.scale.set(1, 1, Math.max(L, 1e-4));
        m.lookAt(b);
      });
      // 结：沿路径每 every 一个
      knotPos = [];
      let acc = 0;
      let next = every;
      for (let i = 0; i < nSeg; i++) {
        const a = path[i], b = path[i + 1];
        const L = a.distanceTo(b);
        while (acc + L >= next - 1e-6) {
          const t = (next - acc) / L;
          knotPos.push(a.clone().lerp(b, t));
          next += every;
        }
        acc += L;
      }
      while (knots.length < knotPos.length) { const m = meshOf(knotGeo, knotMat, { receive: false }); g.add(m); knots.push(m); }
      knots.forEach((m, i) => {
        m.visible = i < knotPos.length;
        if (m.visible) m.position.copy(knotPos[i]);
        m.material = i < lit ? litMat : knotMat;
        m.scale.setScalar(i < lit ? 1.35 : 1);
      });
      return api;
    }

    const api = {
      group: g,
      setPoints,
      /** 前 n 个结亮起来。 */
      setLit(n) {
        lit = n;
        knots.forEach((m, i) => { m.material = i < n ? litMat : knotMat; m.scale.setScalar(i < n ? 1.35 : 1); });
        return api;
      },
      /** 结的位置（世界坐标，已含高度）。 */
      knots: () => knotPos.map((p) => p.clone().applyMatrix4(g.matrixWorld)),
      /** 绳子总长。 */
      length() {
        const path = o.closed && pts.length > 2 ? [...pts, pts[0]] : pts;
        let s = 0;
        for (let i = 1; i < path.length; i++) s += path[i].distanceTo(path[i - 1]);
        return s;
      },
      points: () => pts.map((p) => ({ x: p.x, z: p.z })),
    };
    g.userData.rope = api;
    if (o.points) setPoints(o.points);
    add(g, o.parent);
    return api;
  }

  /**
   * 长方形田：凹下去一点的土 + 四周田埂。cell(i,j) 给出第 i 列第 j 行格子的中心。
   * 田的左上角（x 最小、z 最小）在 (x, z)。
   * @param {{ x?: number, z?: number, w?: number, d?: number, soil?: string, ridge?: boolean, parent?: THREE.Object3D }} [o]
   */
  function plot(o = {}) {
    const { x = 0, z = 0, w = 4, d = 3, soil = '#B98E57', ridge = true } = o;
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const bed = meshOf(new THREE.BoxGeometry(w, 0.06, d), mat(soil), { cast: false });
    bed.position.set(w / 2, 0.01, d / 2);
    bed.name = 'bed';
    g.add(bed);
    if (ridge) {
      const rm = mat(PALETTE.ridge);
      const t = 0.18, h = 0.16;
      const top = meshOf(new THREE.BoxGeometry(w + t * 2, h, t), rm);
      top.position.set(w / 2, h / 2, -t / 2);
      const bot = meshOf(new THREE.BoxGeometry(w + t * 2, h, t), rm);
      bot.position.set(w / 2, h / 2, d + t / 2);
      const lef = meshOf(new THREE.BoxGeometry(t, h, d), rm);
      lef.position.set(-t / 2, h / 2, d / 2);
      const rig = meshOf(new THREE.BoxGeometry(t, h, d), rm);
      rig.position.set(w + t / 2, h / 2, d / 2);
      g.add(top, bot, lef, rig);
    }
    g.userData.plot = { w, d };
    const api = {
      group: g, w, d,
      /** 第 i 列第 j 行格子中心（世界坐标）。 */
      cell: (i, j) => new THREE.Vector3(x + i + 0.5, 0, z + j + 0.5),
      center: () => new THREE.Vector3(x + w / 2, 0, z + d / 2),
      /** 世界坐标落在哪一格（出界返回 null）。 */
      cellAt(p) {
        const i = Math.floor(p.x - x), j = Math.floor(p.z - z);
        return i >= 0 && j >= 0 && i < w && j < d ? { i, j } : null;
      },
    };
    g.userData.api = api;
    add(g, o.parent);
    return api;
  }

  /**
   * 多边形田（斜田、三角田）：points 是世界坐标 {x,z}。可当成一块能拖的「板」。
   * @param {{ points: {x:number,z:number}[], color?: string, y?: number, h?: number, edge?: string|null, opacity?: number, parent?: THREE.Object3D }} o
   */
  function polyField(o) {
    const { color = '#B98E57', y = 0, h = 0.08, edge = PALETTE.ridge } = o;
    const g = new THREE.Group();
    const shape = new THREE.Shape(o.points.map((p) => new THREE.Vector2(p.x, -p.z)));
    const eg = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false });
    eg.rotateX(-Math.PI / 2);
    const m = o.opacity !== undefined
      ? new THREE.MeshLambertMaterial({ color, transparent: true, opacity: o.opacity, depthWrite: false })
      : mat(color);
    const body = meshOf(eg, m, { cast: o.opacity === undefined });
    g.add(body);
    if (edge) {
      const pts = o.points.map((p) => new THREE.Vector3(p.x, h + 0.01, p.z));
      pts.push(pts[0].clone());
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1];
        const L = a.distanceTo(b);
        const s = meshOf(geo('edgeSeg', () => new THREE.BoxGeometry(1, 0.07, 0.12)), mat(edge), { cast: false });
        s.position.copy(a).lerp(b, 0.5);
        s.scale.x = L + 0.06;
        s.rotation.y = -Math.atan2(b.z - a.z, b.x - a.x);
        g.add(s);
      }
    }
    g.position.y = y;
    g.userData.points = o.points;
    return add(g, o.parent);
  }

  /** 草垫（1 步见方）。 @param {{x?:number, z?:number, parent?: THREE.Object3D}} [o] */
  function mat1(o = {}) {
    const m = meshOf(geo('mat', () => new THREE.BoxGeometry(0.92, 0.07, 0.92)),
      matStraw(), { cast: true });
    m.position.set(o.x ?? 0, 0.075, o.z ?? 0);
    return add(m, o.parent);
  }
  let strawMat = null;
  const matStraw = () => (strawMat ||= shared(new THREE.MeshLambertMaterial({ map: strawTexture() })));

  /**
   * 篱笆：沿折线每步一根柱子，柱子之间两道横杆。可 setPoints 重摆。
   * @param {{ points?: {x:number,z:number}[], closed?: boolean, color?: string, h?: number, parent?: THREE.Object3D }} [o]
   */
  function fence(o = {}) {
    const g = new THREE.Group();
    const h = o.h ?? 0.55;
    const pm = mat(o.color || PALETTE.wood);
    const rm = mat(shade(o.color || PALETTE.wood, 1.15));
    function setPoints(points) {
      g.clear();
      const pts = points.map((p) => new THREE.Vector3(p.x, 0, p.z));
      const path = o.closed ? [...pts, pts[0]] : pts;
      for (let i = 0; i < path.length - 1; i++) {
        const a = path[i], b = path[i + 1];
        const L = a.distanceTo(b);
        const n = Math.max(1, Math.round(L));
        for (let k = 0; k < n; k++) {
          const p = a.clone().lerp(b, k / n);
          const post = meshOf(box(0.1, h, 0.1), pm);
          post.position.set(p.x, h / 2, p.z);
          g.add(post);
        }
        for (const ry of [h * 0.4, h * 0.8]) {
          const rail = meshOf(geo('rail', () => new THREE.BoxGeometry(1, 0.06, 0.05)), rm);
          rail.position.set((a.x + b.x) / 2, ry, (a.z + b.z) / 2);
          rail.scale.x = L;
          rail.rotation.y = -Math.atan2(b.z - a.z, b.x - a.x);
          g.add(rail);
        }
      }
      if (!o.closed && path.length) {
        const p = path[path.length - 1];
        const post = meshOf(box(0.1, h, 0.1), pm);
        post.position.set(p.x, h / 2, p.z);
        g.add(post);
      }
    }
    if (o.points) setPoints(o.points);
    add(g, o.parent);
    return { group: g, setPoints };
  }

  /**
   * 村民：方块小人，戴斗笠，会轻轻晃。
   * @param {{ x?: number, z?: number, color?: string, face?: number, hat?: boolean, s?: number, parent?: THREE.Object3D }} [o]
   */
  function villager(o = {}) {
    const g = new THREE.Group();
    const body = new THREE.Group();
    const cloth = o.color || PALETTE.clay;
    const legs = meshOf(box(0.36, 0.34, 0.22), mat('#5B4632'));
    legs.position.y = 0.17;
    const torso = meshOf(box(0.48, 0.5, 0.3), mat(cloth));
    torso.position.y = 0.6;
    const belt = meshOf(box(0.5, 0.07, 0.32), mat(shade(cloth, 0.6)));
    belt.position.y = 0.42;
    const head = meshOf(box(0.38, 0.36, 0.34), mat(PALETTE.skin));
    head.position.y = 1.05;
    const hair = meshOf(box(0.4, 0.12, 0.36), mat('#3B2A1E'));
    hair.position.set(0, 1.2, -0.01);
    const eyeG = box(0.05, 0.06, 0.02);
    const e1 = meshOf(eyeG, mat('#2A1E14'), { cast: false });
    e1.position.set(-0.08, 1.07, 0.175);
    const e2 = e1.clone();
    e2.position.x = 0.08;
    const cheek = meshOf(box(0.07, 0.04, 0.02), mat('#E8A08A'), { cast: false });
    cheek.position.set(-0.13, 1.0, 0.172);
    const cheek2 = cheek.clone();
    cheek2.position.x = 0.13;
    const armG = box(0.12, 0.42, 0.14);
    const a1 = meshOf(armG, mat(cloth));
    a1.position.set(-0.31, 0.62, 0);
    const a2 = a1.clone();
    a2.position.x = 0.31;
    body.add(legs, torso, belt, head, hair, e1, e2, cheek, cheek2, a1, a2);
    if (o.hat !== false) {
      const hat = meshOf(geo('hat', () => new THREE.ConeGeometry(0.42, 0.22, 8)), mat(PALETTE.straw));
      hat.position.y = 1.36;
      body.add(hat);
    }
    g.add(body);
    g.position.set(o.x ?? 0, 0, o.z ?? 0);
    g.rotation.y = o.face ?? 0;
    g.scale.setScalar(o.s ?? 1);
    const phase = Math.random() * 6;
    let hop = 0;
    animate(g, (dt, t) => {
      hop = Math.max(0, hop - dt);
      const j = hop > 0 ? Math.sin((1 - hop / 0.5) * Math.PI) * 0.35 : 0;
      body.position.y = Math.abs(Math.sin(t * 2 + phase)) * 0.025 + j;
      a1.rotation.x = Math.sin(t * 2 + phase) * 0.08 - (hop > 0 ? 2.6 : 0);
      a2.rotation.x = -Math.sin(t * 2 + phase) * 0.08 - (hop > 0 ? 2.6 : 0);
    });
    g.userData.top = 1.5;
    add(g, o.parent);
    return {
      group: g,
      /** 高兴地跳一下、举手。 */
      cheer() { hop = 0.5; },
      /** 转身朝向某点。 */
      face(p) { g.rotation.y = Math.atan2(p.x - g.position.x, p.z - g.position.z); },
    };
  }

  /** 树：round = 圆冠阔叶，pine = 尖塔松。 */
  function tree(o = {}) {
    const g = new THREE.Group();
    const s = o.s ?? 1;
    const r = rng(o.seed ?? 1);
    const trunk = meshOf(box(0.22, 0.7, 0.22), mat(PALETTE.wood));
    trunk.position.y = 0.35;
    g.add(trunk);
    if (o.kind === 'pine') {
      for (let i = 0; i < 3; i++) {
        const c = meshOf(geo(`pine${i}`, () => new THREE.ConeGeometry(0.75 - i * 0.18, 0.75, 6)), mat(i % 2 ? PALETTE.deepGreen : '#5E8A4C'));
        c.position.y = 0.85 + i * 0.42;
        g.add(c);
      }
    } else {
      const greens = [PALETTE.rice, '#8DBB6A', '#6FA05A'];
      const c = meshOf(box(1.1, 0.9, 1.1), mat(greens[Math.floor(r() * 3)]));
      c.position.y = 1.15;
      const c2 = meshOf(box(0.7, 0.5, 0.7), mat(greens[Math.floor(r() * 3)]));
      c2.position.set((r() - 0.5) * 0.3, 1.75, (r() - 0.5) * 0.3);
      g.add(c, c2);
    }
    g.position.set(o.x ?? 0, 0, o.z ?? 0);
    g.rotation.y = r() * Math.PI;
    g.scale.setScalar(s);
    return add(g, o.parent);
  }

  function rock(o = {}) {
    const m = meshOf(geo('rock', () => new THREE.DodecahedronGeometry(0.5, 0)), mat(PALETTE.stone));
    const s = o.s ?? 0.5;
    m.scale.set(s * 1.2, s * 0.7, s);
    m.position.set(o.x ?? 0, s * 0.25, o.z ?? 0);
    m.rotation.y = (o.x ?? 0) * 3.1;
    return add(m, o.parent);
  }

  function tuft(o = {}) {
    const m = meshOf(geo('tuft', () => {
      const parts = [];
      for (let i = 0; i < 3; i++) {
        const b = new THREE.BoxGeometry(0.06, 0.24 + i * 0.05, 0.06);
        b.translate((i - 1) * 0.07, 0.12 + i * 0.025, (i % 2) * 0.04);
        b.rotateZ((i - 1) * 0.25);
        parts.push(b);
      }
      return mergeGeometries(parts);
    }), mat(o.color || PALETTE.deepGreen), { cast: false });
    m.position.set(o.x ?? 0, 0, o.z ?? 0);
    m.rotation.y = (o.z ?? 0) * 2.3;
    return add(m, o.parent);
  }

  /**
   * 庄稼 / 小草：在一堆点上种，一株一个实例。grow() 让它们噌噌依次长出来。
   * @param {{ cells: {x:number,z:number}[], kind?: 'rice'|'grass'|'sprout', per?: number, parent?: THREE.Object3D, seed?: number }} o
   */
  function crops(o) {
    const kind = o.kind || 'rice';
    const per = o.per ?? (kind === 'rice' ? 4 : kind === 'grass' ? 3 : 1);
    const r = rng(o.seed ?? 11);
    const plantGeo = geo(`plant-${kind}`, () => {
      const parts = [];
      const n = kind === 'sprout' ? 2 : 3;
      for (let i = 0; i < n; i++) {
        const hgt = kind === 'rice' ? 0.42 + i * 0.08 : kind === 'grass' ? 0.2 + i * 0.05 : 0.22;
        const b = new THREE.BoxGeometry(0.05, hgt, 0.05);
        b.translate(0, hgt / 2, 0);
        b.rotateZ((i - (n - 1) / 2) * 0.35);
        b.rotateY(i * 1.2);
        parts.push(b);
      }
      if (kind === 'rice') {
        const ear = new THREE.BoxGeometry(0.07, 0.14, 0.07);
        ear.translate(0.05, 0.52, 0);
        parts.push(ear);
      }
      if (kind === 'sprout') {
        const leaf = new THREE.BoxGeometry(0.16, 0.03, 0.08);
        leaf.translate(0.06, 0.22, 0);
        parts.push(leaf);
      }
      return mergeGeometries(parts);
    });
    const count = o.cells.length * per;
    const m = new THREE.InstancedMesh(plantGeo, mat('#FFFFFF'), count);
    m.castShadow = true;
    m.receiveShadow = true;
    const color = new THREE.Color();
    const base = [];
    const tones = kind === 'rice' ? [PALETTE.rice, '#8FC07A', '#9BC46A', '#C9C25E'] : kind === 'grass' ? ['#6E9E4E', PALETTE.rice, '#5E8E46'] : ['#7FB069', '#95C77F'];
    let k = 0;
    for (const c of o.cells) {
      for (let i = 0; i < per; i++) {
        const ox = per === 1 ? 0 : (i % 2 - 0.5) * 0.45 + (r() - 0.5) * 0.12;
        const oz = per === 1 ? 0 : (Math.floor(i / 2) - 0.5) * 0.45 + (r() - 0.5) * 0.12;
        base.push({ x: c.x + ox, z: c.z + oz, ry: r() * Math.PI, s: 0.85 + r() * 0.3 });
        color.set(tones[Math.floor(r() * tones.length)]);
        m.setColorAt(k++, color);
      }
    }
    const mtx = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const scales = new Float32Array(count);
    function write() {
      for (let i = 0; i < count; i++) {
        const b = base[i];
        const s = scales[i] * b.s;
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), b.ry);
        mtx.compose(new THREE.Vector3(b.x, 0.03, b.z), q, new THREE.Vector3(Math.max(0.001, s), Math.max(0.001, s), Math.max(0.001, s)));
        m.setMatrixAt(i, mtx);
      }
      m.instanceMatrix.needsUpdate = true;
    }
    write();
    let sway = 0;
    animate(m, (dt, t) => {
      if (sway <= 0) return;
      // 风吹过轻轻摆（只在长好之后）
      m.rotation.z = Math.sin(t * 1.5) * 0.004;
    });
    add(m, o.parent);
    return {
      mesh: m,
      /**
       * 依次长出来。order: 'row'（一行行）| 'random' | 'line'（按给定顺序）。
       * @param {{ stagger?: number, duration?: number, onEach?: (i:number)=>void }} [g]
       * @returns {Promise<void>}
       */
      grow(g = {}) {
        const stagger = g.stagger ?? 18;
        const duration = g.duration ?? 450;
        const start = performance.now();
        sway = 1;
        let fired = -1;
        return new Promise((resolveP) => {
          const off = stage.onFrame(() => {
            if (!m.parent) { off(); resolveP(); return; }
            const now = performance.now() - start;
            let done = true;
            for (let i = 0; i < count; i++) {
              const t = Math.min(1, Math.max(0, (now - i * stagger) / duration));
              if (t < 1) done = false;
              const c1 = 1.70158, c3 = c1 + 1;
              scales[i] = t <= 0 ? 0 : 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
              const cell = Math.floor(i / per);
              if (t > 0 && cell > fired) { fired = cell; g.onEach?.(cell); }
            }
            write();
            if (done) { off(); resolveP(); }
          });
        });
      },
      /** 直接全长好 / 全收起（0–1）。 */
      setAll(s) { scales.fill(s); write(); },
    };
  }

  /**
   * 矩（直角尺）：L 形木尺。放在角上，arms 指向两条边的方向。ok(true) 变绿发光。
   * @param {{ x?: number, z?: number, len?: number, parent?: THREE.Object3D }} [o]
   */
  function square(o = {}) {
    const len = o.len ?? 1.4;
    const g = new THREE.Group();
    const wood = mat('#C08A50');
    const okMat = basic('#8CD06E');
    const armA = meshOf(new THREE.BoxGeometry(len, 0.06, 0.18), wood);
    armA.position.set(len / 2, 0, 0.09);
    const armB = meshOf(new THREE.BoxGeometry(0.18, 0.06, len), wood);
    armB.position.set(0.09, 0, len / 2);
    // 刻度点
    const marks = [];
    for (let i = 1; i < len * 3; i++) {
      const t = meshOf(box(0.03, 0.065, 0.1), mat('#6E4A2A'), { cast: false });
      t.position.set(i / 3, 0.003, 0.09);
      const t2 = meshOf(box(0.1, 0.065, 0.03), mat('#6E4A2A'), { cast: false });
      t2.position.set(0.09, 0.003, i / 3);
      if (i / 3 < len - 0.1) { marks.push(t, t2); }
    }
    g.add(armA, armB, ...marks);
    const glow = new THREE.Mesh(
      new THREE.RingGeometry(0.35, 0.55, 28),
      new THREE.MeshBasicMaterial({ color: '#B6F08C', transparent: true, opacity: 0, depthWrite: false }),
    );
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = -0.02;
    g.add(glow);
    g.position.set(o.x ?? 0, 0.36, o.z ?? 0);
    let ok = false;
    animate(g, (dt, t) => {
      glow.material.opacity = ok ? 0.55 + Math.sin(t * 6) * 0.25 : 0;
      const s = 1 + Math.sin(t * 6) * 0.1;
      glow.scale.set(s, s, s);
    });
    add(g, o.parent);
    return {
      group: g,
      /** 放到角 p 上，两臂分别指向 dirA、dirB（{x,z} 方向）。 */
      place(p, dirA, dirB) {
        g.position.x = p.x;
        g.position.z = p.z;
        const a = Math.atan2(dirA.z, dirA.x);
        g.rotation.y = -a;
        // 判断 dirB 在 dirA 的哪一侧，翻面让 B 臂对上
        const cr = dirA.x * dirB.z - dirA.z * dirB.x;
        g.scale.z = cr >= 0 ? 1 : -1;
      },
      ok(on) {
        ok = on;
        armA.material = on ? okMat : wood;
        armB.material = on ? okMat : wood;
      },
    };
  }

  /** 水面：会轻轻起伏、波纹流动。 */
  function water(o = {}) {
    const { x = 0, z = 0, w = 10, d = 3 } = o;
    const segX = Math.max(2, Math.round(w)), segZ = Math.max(2, Math.round(d));
    const g = new THREE.PlaneGeometry(w, d, segX, segZ);
    g.rotateX(-Math.PI / 2);
    const tex = rippleTexture().clone();
    tex.needsUpdate = true;
    tex.repeat.set(w / 5, d / 5);
    const m = new THREE.MeshPhongMaterial({ color: PALETTE.river, map: tex, shininess: 70, specular: 0x9fd4f0, transparent: true, opacity: 0.93 });
    const mesh = new THREE.Mesh(g, m);
    mesh.receiveShadow = true;
    mesh.position.set(x, 0, z);
    const pos = g.attributes.position;
    const base = Float32Array.from(pos.array);
    animate(mesh, (dt, t) => {
      tex.offset.x = (t * 0.03) % 1;
      tex.offset.y = (Math.sin(t * 0.4) * 0.02);
      for (let i = 0; i < pos.count; i++) {
        const bx = base[i * 3], bz = base[i * 3 + 2];
        pos.array[i * 3 + 1] = Math.sin(bx * 0.9 + t * 1.6) * 0.035 + Math.cos(bz * 1.3 + t * 1.2) * 0.03;
      }
      pos.needsUpdate = true;
    });
    return add(mesh, o.parent);
  }

  /** 云（远处慢慢飘）。 */
  function cloud(o = {}) {
    const g = new THREE.Group();
    const r = rng(o.seed ?? 5);
    const m = mat('#FFFFFF', { emissive: '#DDE6EC' });
    for (let i = 0; i < 4; i++) {
      const b = new THREE.Mesh(box(1.6 + r() * 1.4, 0.8 + r() * 0.6, 1.2 + r() * 0.8), m);
      b.position.set(i * 1.1 - 1.6, r() * 0.5, (r() - 0.5) * 0.6);
      g.add(b);
    }
    g.position.set(o.x ?? 0, o.y ?? 14, o.z ?? -30);
    g.scale.setScalar(o.s ?? 1);
    const speed = 0.15 + r() * 0.2;
    const x0 = g.position.x;
    animate(g, (dt, t) => { g.position.x = x0 + Math.sin(t * speed * 0.1) * 6; });
    return add(g, o.parent);
  }

  /** 隐形碰撞体（让小东西更好抓）。 */
  function hitBox(w = 1, h = 1, d = 1, parent) {
    const m = new THREE.Mesh(box(w, h, d), (invisibleMat ||= shared(new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }))));
    m.position.y = h / 2;
    if (parent) parent.add(m);
    return m;
  }

  return {
    ground, stake, rope, plot, polyField, mat: mat1, fence, villager, tree, rock, tuft, crops,
    square, water, cloud, hitBox, animate,
  };
}
