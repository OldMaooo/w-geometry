// 第 2 章共用工具：规（拖笔画圆）、直绳、交点打桩、地上的绳痕。引擎里没有，本章自己写。
// 用法：const board = createBoard(ctx, { bounds }); 然后 board.addPoint / board.circle / board.line / board.pickIntersection …
import * as THREE from 'three';
import { PALETTE } from '../../engine/palette.js';
import { mat } from '../../engine/shared.js';
import * as M from './math.js';

export const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const DEG = Math.PI / 180;

/** 播动画时占住「当前提示」：solve 会等它结束，而不是一帧一帧空转。 */
export async function busy(ctx, p) {
  ctx.hint({ text: '', quiet: true, demo: () => p });
  try { return await p; } finally { ctx.hint(null); }
}

/** 在圆（或圆的一段）上取点，供画线用。 */
export function arcPoints(C, r, a1, a2, perTurn = 96) {
  const n = Math.max(2, Math.ceil((Math.abs(a2 - a1) / M.TAU) * perTurn) + 1);
  const out = [];
  for (let i = 0; i < n; i++) out.push(M.onCircle(C, r, a1 + ((a2 - a1) * i) / (n - 1)));
  return out;
}

/**
 * 地上的绳痕：一条暗色的沟 + 一条亮线。setPoints(折线点) 随时重画。
 * @param {any} ctx @param {{ width?: number, glowWidth?: number, groove?: string, glow?: string, max?: number }} [o]
 */
export function createTrace(ctx, o = {}) {
  const max = o.max ?? 240;
  const group = new THREE.Group();
  const layers = [
    { w: o.width ?? 0.26, color: o.groove ?? '#86643A', y: 0.05 + (o.y0 ?? 0) },
    { w: o.glowWidth ?? 0.09, color: o.glow ?? '#FFE9A0', y: 0.07 + (o.y0 ?? 0) },
  ].map(({ w, color, y }) => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(max * 2 * 3);
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const idx = [];
    for (let i = 0; i < max - 1; i++) idx.push(2 * i, 2 * i + 1, 2 * i + 2, 2 * i + 1, 2 * i + 3, 2 * i + 2);
    g.setIndex(idx);
    g.setDrawRange(0, 0);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
    m.frustumCulled = false;
    m.renderOrder = 2;
    group.add(m);
    return { w, y, g, pos };
  });
  ctx.add(group);
  let n = 0;
  const api = {
    group,
    setPoints(pts) {
      n = Math.min(pts.length, max);
      for (const L of layers) {
        for (let i = 0; i < n; i++) {
          const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
          const t = M.unit(M.sub(b, a));
          const nx = -t.z * (L.w / 2), nz = t.x * (L.w / 2);
          const p = pts[i];
          L.pos.set([p.x + nx, L.y, p.z + nz, p.x - nx, L.y, p.z - nz], i * 6);
        }
        L.g.attributes.position.needsUpdate = true;
        L.g.setDrawRange(0, Math.max(0, (n - 1) * 6));
      }
      return api;
    },
    setColor(groove, glow) {
      group.children[0].material.color.set(groove);
      if (glow) group.children[1].material.color.set(glow);
      return api;
    },
    get count() { return n; },
  };
  return api;
}

/** 把过 a、b 的直线裁到矩形里，返回两个端点（裁不到返回 null）。 */
export function clipLine(a, b, bd) {
  const dx = b.x - a.x, dz = b.z - a.z;
  let t0 = -Infinity, t1 = Infinity;
  for (const [p, d, lo, hi] of [[a.x, dx, bd.minX, bd.maxX], [a.z, dz, bd.minZ, bd.maxZ]]) {
    if (Math.abs(d) < 1e-9) { if (p < lo || p > hi) return null; continue; }
    const s = (lo - p) / d, e = (hi - p) / d;
    t0 = Math.max(t0, Math.min(s, e));
    t1 = Math.min(t1, Math.max(s, e));
  }
  if (t0 > t1) return null;
  return [{ x: a.x + dx * t0, z: a.z + dz * t0 }, { x: a.x + dx * t1, z: a.z + dz * t1 }];
}

/**
 * @param {any} ctx
 * @param {{ bounds?: {minX:number,maxX:number,minZ:number,maxZ:number} }} [opt]
 */
export function createBoard(ctx, opt = {}) {
  const { props } = ctx;
  const bounds = opt.bounds ?? { minX: -13, maxX: 13, minZ: -8.5, maxZ: 8.5 };
  /** @type {Map<string, any>} */
  const pts = new Map();
  const ents = [];
  const pulsers = new Set();
  let tapWait = null;

  ctx.onUpdate((dt, t) => {
    for (const o of pulsers) o.mesh.scale.setScalar(o.base * (1 + Math.sin(t * 5 + o.phase) * 0.13));
  });

  // ---------- 小标记 ----------
  /** 地上一圈发亮的圈（可脉动）。返回 {remove, mesh}。 */
  function markAt(p, { color = PALETTE.gold, r = 0.62, pulse = true, opacity = 0.9 } = {}) {
    const m = new THREE.Mesh(
      new THREE.RingGeometry(r * 0.72, r, 32),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false }),
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(p.x, 0.09, p.z);
    m.renderOrder = 4;
    ctx.add(m);
    const rec = { mesh: m, base: 1, phase: Math.random() * 6 };
    if (pulse) pulsers.add(rec);
    return { mesh: m, remove() { pulsers.delete(rec); ctx.remove(m); } };
  }

  // ---------- 桩 ----------
  function addPoint(key, p, o = {}) {
    const h = o.h ?? 0.9;
    const stake = props.stake({ x: p.x, z: p.z, h, color: o.color });
    props.hitBox(1.3, h + 0.6, 1.3, stake);
    if (o.animate !== false) ctx.fx.pop(stake);
    const rec = { key, p: { x: p.x, z: p.z }, obj: stake, label: null, handle: null };
    rec.handle = ctx.pointer.tappable(stake, () => onPointTap(key), { radius: 48, priority: 1 });
    if (o.name !== null) rec.label = ctx.labels.add(stake, o.name ?? key, { cls: o.cls ?? 'num', dy: h + 0.2 });
    pts.set(key, rec);
    return rec;
  }
  function removePoint(key) {
    const r = pts.get(key);
    if (!r) return;
    r.handle.dispose();
    r.label?.remove();
    ctx.remove(r.obj);
    pts.delete(key);
  }
  const P = (key) => pts.get(key).p;

  function onPointTap(key) {
    if (!tapWait) return;
    if (!tapWait.allowed.has(key)) { ctx.nudge('这根桩现在用不上，点发亮的那根。'); return; }
    tapWait.done(key);
  }

  /**
   * 等玩家点一根桩（allowed 里的）。发亮的圈标出能点的桩；带提示三档。
   * @param {string[]} allowed @param {{ text: string, demo?: string, markKeys?: string[], task?: string }} o
   */
  async function tapPoint(allowed, o) {
    const marks = (o.markKeys ?? allowed).map((k) => markAt(P(k)));
    const dk = o.demo ?? allowed[0];
    if (o.task) ctx.hud.task(o.task);
    ctx.hint({
      text: o.text,
      ghost: () => ctx.fx.ghostHand(v3(P(dk).x, 0.4, P(dk).z), null),
      demo: async () => { ctx.pointer.simulateTap(pts.get(dk).handle); await ctx.wait(350); },
    });
    const key = await ctx.waitFor((done) => { tapWait = { allowed: new Set(allowed), done }; });
    tapWait = null;
    marks.forEach((m) => m.remove());
    ctx.hint(null);
    return key;
  }

  // ---------- 线与圆 ----------
  /** 画一条过 a、b 的直绳（拉到场地边上）。 */
  async function drawLine(a, b, o = {}) {
    let seg = clipLine(a, b, bounds) ?? [a, b];
    if (o.ray) { // 只画从 a 出发、朝 b 方向的一半
      const u = M.unit(M.sub(b, a));
      const far = seg.reduce((best, p) => ((p.x - a.x) * u.x + (p.z - a.z) * u.z > (best.x - a.x) * u.x + (best.z - a.z) * u.z ? p : best));
      seg = [a, far];
    }
    const trace = createTrace(ctx, { groove: o.groove, glow: o.glow, width: o.width });
    const m = M.mid(seg[0], seg[1]);
    ctx.audio.play('whoosh');
    await ctx.fx.tween({
      duration: o.ms ?? 520, ease: 'out',
      onUpdate: (k) => trace.setPoints([
        { x: m.x + (seg[0].x - m.x) * k, z: m.z + (seg[0].z - m.z) * k },
        { x: m.x + (seg[1].x - m.x) * k, z: m.z + (seg[1].z - m.z) * k },
      ]),
    });
    trace.setPoints(seg);
    const e = { type: 'line', a: { ...a }, b: { ...b }, trace, contains: o.ray ? (p) => M.paramOnLine(p, a, b) >= -1e-6 : () => true };
    ents.push(e);
    return e;
  }

  /** 场景里已有的路：只当「线」参与求交，不画绳痕。limit = [t0, t1]（a→b 上的位置）。 */
  function addRoad(a, b, limit = [-Infinity, Infinity]) {
    const e = { type: 'line', a: { ...a }, b: { ...b }, trace: null, contains: (p) => { const t = M.paramOnLine(p, a, b); return t >= limit[0] - 1e-6 && t <= limit[1] + 1e-6; } };
    ents.push(e);
    return e;
  }

  function intersections(e1, e2) {
    const circ = [e1, e2].filter((e) => e.type === 'circle');
    let out = [];
    if (circ.length === 2) out = M.circleCircle(e1.c, e1.r, e2.c, e2.r);
    else if (circ.length === 1) {
      const c = circ[0], l = e1 === c ? e2 : e1;
      out = M.lineCircle(l.a, l.b, c.c, c.r).filter((p) => l.contains(p));
    } else {
      const p = M.lineLine(e1.a, e1.b, e2.a, e2.b);
      out = p && e1.contains(p) && e2.contains(p) ? [p] : [];
    }
    return out;
  }
  const nearPoint = (p, eps = 0.05) => [...pts.values()].some((r) => M.dist(r.p, p) < eps);

  /**
   * 交点亮起小光点，点一下在那里打桩。可同时亮两个（任选一个）。
   * @param {any} e1 @param {any} e2 @param {{ key: string, text?: string, name?: string|null, h?: number, color?: string }} o
   * @returns {Promise<{ key: string, p: {x:number,z:number} }>}
   */
  async function pickIntersection(e1, e2, o) {
    const cands = intersections(e1, e2).filter((p) => !nearPoint(p));
    const dots = cands.map((p) => {
      const g = new THREE.Group();
      g.position.set(p.x, 0, p.z);
      const disc = new THREE.Mesh(new THREE.CircleGeometry(0.2, 20), new THREE.MeshBasicMaterial({ color: PALETTE.gold, depthWrite: false }));
      disc.rotation.x = -Math.PI / 2; disc.position.y = 0.1;
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.32, 0.46, 28), new THREE.MeshBasicMaterial({ color: '#FFF1B8', transparent: true, opacity: 0.95, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.1;
      disc.renderOrder = ring.renderOrder = 5;
      g.add(disc, ring);
      props.hitBox(1.6, 1, 1.6, g);
      ctx.add(g);
      ctx.fx.pop(g);
      const rec = { mesh: ring, base: 1, phase: Math.random() * 6 };
      pulsers.add(rec);
      return { p, g, rec };
    });
    const handles = [];
    const first = cands[0];
    ctx.hint({
      text: o.text ?? '点一下发亮的小光点，在那里打一根桩。',
      ghost: () => ctx.fx.ghostHand(v3(first.x + 1.6, 0.4, first.z + 1.2), v3(first.x, 0.4, first.z)),
      demo: async () => { ctx.pointer.simulateTap(handles[0]); await ctx.wait(350); },
    });
    const idx = await ctx.waitFor((done) => {
      dots.forEach((d, i) => handles.push(ctx.pointer.tappable(d.g, () => done(i), { radius: 60, priority: 5 })));
    });
    ctx.hint(null);
    handles.forEach((h) => h.dispose());
    dots.forEach((d) => { pulsers.delete(d.rec); ctx.remove(d.g); });
    const p = cands[idx];
    const rec = addPoint(o.key, p, { name: o.name, h: o.h, color: o.color });
    ctx.audio.play('place');
    ctx.fx.sparkle(p, { color: '#FFE08A', size: 1.1 });
    return { key: o.key, p, rec };
  }

  // ---------- 规：画圆 / 画弧 ----------
  function makePencil(at) {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 0.55, 6), mat(PALETTE.wood));
    pole.position.y = 0.28;
    const knob = new THREE.Mesh(new THREE.IcosahedronGeometry(0.26, 0), mat(PALETTE.gold, { emissive: '#7a5200' }));
    knob.position.y = 0.74;
    pole.castShadow = knob.castShadow = true;
    g.add(pole, knob);
    props.hitBox(1.5, 1.2, 1.5, g);
    g.position.set(at.x, 0, at.z);
    ctx.add(g);
    ctx.fx.pop(g, { duration: 260 });
    return g;
  }

  /**
   * 拖着笔绕桩转。两种：
   *  mode 'full'：转满一圈，自动合拢；
   *  mode 'arc' ：摆到 cands 里的某个发亮的点上松手。
   * free = { min, max, start, dir, demoR, check } 时，先拖着笔定绳长（吸附到整步）。
   * @returns {Promise<{ r: number, trace: any, cand?: any, a0: number }>}
   */
  async function compass(o) {
    const C = o.C;
    let r = o.r;
    const dir = o.dir ?? o.free?.dir ?? -Math.PI / 2;
    const startPos = o.free ? M.onCircle(C, o.free.start, dir) : o.start ?? M.onCircle(C, r, dir);
    const pencil = makePencil(startPos);
    const rope = props.rope({ points: [C, startPos], y: 0.4 });
    const pivot = markAt(C, { r: 0.7 });
    const cleanup = () => { pivot.remove(); ctx.remove(pencil); ctx.remove(rope.group); };
    const setRope = (p) => rope.setPoints([C, p]);

    // ---- 定绳长 ----
    if (o.free) {
      const f = o.free;
      const lbl = ctx.labels.add(pencil, f.start, { cls: 'num lit', dy: 1.0, pop: false });
      const ctxHint = (h) => ctx.hint(h);
      ctx.hud.task(o.texts?.radius ?? '把笔往外拉，绳子放长一点。');
      r = await ctx.waitFor((done) => {
        const hd = ctx.pointer.draggable(pencil, {
          lift: 0, ringSize: 0.9, priority: 10, radius: 70, silent: false,
          snap: (p) => {
            const a = Math.atan2(p.z - C.z, p.x - C.x);
            const rr = Math.min(f.max, Math.max(f.min, Math.round(Math.hypot(p.x - C.x, p.z - C.z))));
            return v3(C.x + rr * Math.cos(a), 0, C.z + rr * Math.sin(a));
          },
          onMove: (p) => { pencil.position.set(p.x, 0, p.z); setRope(p); lbl.set(Math.round(Math.hypot(p.x - C.x, p.z - C.z))); },
          onEnd: () => {
            const rr = Math.round(Math.hypot(pencil.position.x - C.x, pencil.position.z - C.z));
            const res = f.check ? f.check(rr) : true;
            if (res === true) { hd.dispose(); done(rr); } else ctx.nudge(res);
          },
        });
        const target = M.onCircle(C, f.demoR, dir);
        ctxHint({
          text: o.texts?.radiusHint ?? '按住金色的笔往外拖，拖到合适的长度松手。',
          ghost: () => ctx.fx.ghostHand(v3(startPos.x, 0.6, startPos.z), v3(target.x, 0.6, target.z)),
          demo: () => ctx.pointer.simulateDrag(hd, v3(target.x, 0, target.z), { duration: 800 }),
        });
      });
      ctx.hint(null);
      lbl.remove();
      ctx.audio.play('snap');
      await ctx.wait(200);
    }

    // ---- 转一圈 / 摆一段 ----
    const a0 = Math.atan2(pencil.position.z - C.z, pencil.position.x - C.x);
    const trace = createTrace(ctx, o.trace);
    const cands = o.cands ?? [];
    const candMarks = cands.map((c) => markAt(c, { r: 0.5, color: '#FFF1B8' }));
    let last = a0, lo = 0, hi = 0, slack = false, atCand = null, warned = false;
    const full = o.mode !== 'arc';
    ctx.hud.task(o.texts?.turn ?? '按住笔，绕着桩转一圈。');

    const res = await ctx.waitFor((done) => {
      let finished = false;
      const hd = ctx.pointer.draggable(pencil, {
        lift: 0, ringSize: 0.9, priority: 10, radius: 70,
        snap: (p) => {
          const d = Math.hypot(p.x - C.x, p.z - C.z);
          if (d < 1e-3) return null;
          if (o.taut && (d < r * 0.55 || d > r * 1.9 + 1)) { slack = true; atCand = null; return p; }
          slack = false;
          let q = M.onCircle(C, r, Math.atan2(p.z - C.z, p.x - C.x));
          if (!full) {
            let hit = null;
            for (const c of cands) if (M.dist(q, c) < 0.95) hit = c;
            if (hit && hit !== atCand) ctx.audio.play('snap');
            atCand = hit;
            if (hit) q = hit;
          }
          return v3(q.x, 0, q.z);
        },
        onStart: () => { warned = false; },
        onMove: (p) => {
          pencil.position.set(p.x, 0, p.z);
          if (slack) {
            const m = M.mid(C, p), n = M.perp(M.unit(M.sub(p, C)));
            const w = Math.sin(performance.now() / 45) * 0.28;
            rope.setPoints([C, { x: m.x + n.x * w, z: m.z + n.z * w }, p]);
            if (!warned) { warned = true; ctx.nudge('绳子松了，往外拉紧才画得出圆。'); }
            last = Math.atan2(p.z - C.z, p.x - C.x);
            return;
          }
          setRope(p);
          const a = Math.atan2(p.z - C.z, p.x - C.x);
          sweep(M.angleDiff(last, a));
          last = a;
          trace.setPoints(arcPoints(C, r, a0 + lo, a0 + hi));
          if (full && !finished && hi - lo >= M.TAU - 0.16) {
            finished = true;
            hd.dispose();
            trace.setPoints(arcPoints(C, r, a0, a0 + M.TAU));
            done({});
          }
        },
        onEnd: () => {
          if (slack && !finished) { // 松手时绳子是松的：笔弹回圆上，绳子重新绷直
            const q = M.onCircle(C, r, last);
            pencil.position.set(q.x, 0, q.z);
            setRope(q);
            slack = false;
            ctx.audio.play('whoosh');
          }
          if (finished || full) return;
          if (atCand) { finished = true; hd.dispose(); done({ cand: atCand }); } else ctx.nudge(o.texts?.miss ?? '把笔摆到发亮的那一点上再松手。');
        },
      });
      let acc = 0;
      function sweep(d) { acc += d; hi = Math.max(hi, acc); lo = Math.min(lo, acc); }
      // 提示
      const pencilAt = (a) => M.onCircle(C, r, a);
      let path;
      if (full) path = Array.from({ length: 11 }, (_, i) => pencilAt(a0 + ((i + 1) * M.TAU) / 10));
      else {
        const t = cands[0];
        const da = M.angleDiff(a0, Math.atan2(t.z - C.z, t.x - C.x));
        const n = Math.max(2, Math.ceil(Math.abs(da) / 0.28));
        path = Array.from({ length: n }, (_, i) => (i === n - 1 ? t : pencilAt(a0 + (da * (i + 1)) / n)));
      }
      const gp = full ? pencilAt(a0 + 1.7) : path[path.length - 1];
      ctx.hint({
        text: o.texts?.turnHint ?? '按住金色的笔，绕着桩走一整圈。',
        ghost: () => ctx.fx.ghostHand(v3(startPos.x, 0.6, startPos.z), v3(gp.x, 0.6, gp.z)),
        demo: () => ctx.pointer.simulateDrag(hd, path.map((p) => v3(p.x, 0, p.z)), { duration: full ? 1700 : 900 }),
      });
    });
    ctx.hint(null);
    candMarks.forEach((m) => m.remove());
    cleanup();
    return { r, trace, a0, ...res };
  }

  /**
   * 画一个圆。
   * o: { centers: 候选圆心桩[], through?: (圆心key)=>可系绳的桩[], fixedR?, free?, start?, dir?, taut?, tapCenter?, texts?, trace? }
   * 返回 { e: 圆实体, centerKey, throughKey, r }
   */
  async function circle(o) {
    let ck = o.centers[0];
    if (o.centers.length > 1 || o.tapCenter) {
      ck = await tapPoint(o.centers, { text: o.texts?.center ?? '圆规脚扎在哪根桩上？点一下。', task: o.texts?.centerTask });
    }
    const C = P(ck);
    let tk = null, r = o.fixedR, start = o.start;
    if (o.through) {
      const sel = markAt(C, { color: '#9FE07A', pulse: false, r: 0.75 });
      tk = await tapPoint(o.through(ck), { text: o.texts?.through ?? '绳子另一头系在哪根桩上？点一下。', task: o.texts?.throughTask });
      sel.remove();
      r = M.dist(C, P(tk));
      start = P(tk);
    }
    const res = await compass({
      C, r, start, dir: o.dir, free: o.free, taut: o.taut, mode: 'full', texts: o.texts, trace: o.trace,
    });
    ctx.audio.play('good');
    ctx.fx.sparkle(C, { color: '#FFE08A', size: res.r * 0.55 });
    const e = { type: 'circle', c: { ...C }, r: res.r, trace: res.trace, contains: () => true };
    ents.push(e);
    return { e, centerKey: ck, throughKey: tk, r: res.r };
  }

  /**
   * 先后点两根桩，组合要在 pairs 里（不分先后）。返回 [k1, k2]。
   * @param {string[][]} pairs @param {{ first?: string, second?: string, firstTask?: string, secondTask?: string }} [texts]
   */
  async function pickPair(pairs, texts = {}) {
    const firsts = [...new Set(pairs.flat())];
    for (;;) {
      const k1 = await tapPoint(firsts, { text: texts.first ?? '点一根桩，系上直绳的一头。', task: texts.firstTask });
      const sel = markAt(P(k1), { color: '#9FE07A', pulse: false, r: 0.75 });
      const seconds = pairs.filter((p) => p.includes(k1)).map((p) => (p[0] === k1 ? p[1] : p[0]));
      const k2 = await tapPoint([...seconds, k1], { text: texts.second ?? '再点另一根桩，把绳子拉直。', demo: seconds[0], markKeys: seconds, task: texts.secondTask });
      sel.remove();
      if (k2 !== k1) return [k1, k2];
    }
  }

  /**
   * 拉一条直绳：先后点两根桩。pairs 里写允许的组合（不分先后）。
   * @returns {{ e: any, k1: string, k2: string }}
   */
  async function line(o) {
    const [k1, k2] = await pickPair(o.pairs, o.texts);
    const e = await drawLine(P(k1), P(k2), o.line);
    ctx.audio.play('good');
    return { e, k1, k2 };
  }

  /** 用规作中垂线的整套动作（自动演示：两段交叉的弧 + 连线）。返回线实体。 */
  async function bisectByCompass(ka, kb, o = {}) {
    const A = P(ka), B = P(kb);
    const d = M.dist(A, B);
    const rho = d * 0.75;
    const th = (62 * DEG);
    const pieces = [[A, M.angleOf(A, B)], [B, M.angleOf(B, A)]];
    for (const [c, a] of pieces) {
      const tr = createTrace(ctx, { glow: '#BFE3F5' });
      ctx.audio.play('rotate');
      await ctx.fx.tween({ duration: 520, ease: 'inOut', onUpdate: (k) => tr.setPoints(arcPoints(c, rho, a - th, a - th + 2 * th * k, 40)) });
    }
    const [p, q] = M.circleCircle(A, rho, B, rho);
    ctx.audio.play('snap');
    ctx.fx.sparkle(p, { size: 0.9 }); ctx.fx.sparkle(q, { size: 0.9 });
    await ctx.wait(250);
    const bis = M.perpBisector(A, B);
    return drawLine(bis.a, bis.b, o.line);
  }

  return {
    pts, ents, bounds, P, markAt, addPoint, removePoint, tapPoint, drawLine, addRoad, intersections,
    pickIntersection, compass, circle, pickPair, line, bisectByCompass,
  };
}

// ---------- 场景小件 ----------
/** 一间小草屋，放在村子桩旁边。 */
export function hut(ctx, x, z, ry = 0, color = '#E6D3A8') {
  const g = new THREE.Group();
  const wall = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.9, 1.2), mat(color));
  wall.position.y = 0.45;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.25, 0.8, 4), mat('#C9A447'));
  roof.position.y = 1.3; roof.rotation.y = Math.PI / 4;
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.55, 0.05), mat(PALETTE.ridge));
  door.position.set(0, 0.28, 0.62);
  for (const m of [wall, roof, door]) { m.castShadow = m.receiveShadow = true; g.add(m); }
  g.position.set(x, 0, z);
  g.rotation.y = ry;
  ctx.add(g);
  return g;
}

/** 一条路（长条）。 */
export function roadStrip(ctx, a, b, { width = 1.1, color = '#E2CD98', from = 0, to = 1 } = {}) {
  const L = M.dist(a, b);
  const m = new THREE.Mesh(new THREE.BoxGeometry(width, 0.05, 1), mat(color));
  m.receiveShadow = true;
  const u = M.unit(M.sub(b, a));
  const len = L * (to - from);
  const mid = { x: a.x + u.x * L * (from + to) / 2, z: a.z + u.z * L * (from + to) / 2 };
  m.position.set(mid.x, 0.045, mid.z);
  m.scale.z = len;
  m.rotation.y = Math.atan2(u.x, u.z);
  ctx.add(m);
  return m;
}

/** 平躺的一段圆环（玉璧 / 井沿）。φ1→φ2 是世界角度（atan2(z,x)），厚 h。 */
export function arcBand(R, w, phi1, phi2, h, color) {
  const sh = new THREE.Shape();
  const t1 = -phi2, t2 = -phi1; // 形状的 y = -z
  sh.absarc(0, 0, R + w / 2, t1, t2, false);
  sh.absarc(0, 0, R - w / 2, t2, t1, true);
  sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth: h, bevelEnabled: false, curveSegments: Math.max(8, Math.ceil(((phi2 - phi1) / M.TAU) * 96)) });
  const m = new THREE.Mesh(g, color instanceof THREE.Material ? color : mat(color));
  m.rotation.x = -Math.PI / 2;
  m.castShadow = m.receiveShadow = true;
  return m;
}
