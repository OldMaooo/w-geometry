// 「定坡」：一排柱子撑着一条渠，每根柱子的高度（整数「尺」）可以上下拖。点「放水」，水一段一段往下流：
// 遇到高的就停（积水漫出去），一段降太多就冲坏。6-1 和 6-6 的第三步共用。
import * as THREE from 'three';
import { drops, simulateSlope, slopeStars, levelSide, MAX_DROP } from './math.js';
import { makeChannel, advance, drain, makePuddle, crumble } from './flow.js';
import { v3, C, block, makeHit, go, dur } from './kit.js';
import { waterMat } from './kit.js';

/**
 * @param {any} ctx
 * @param {{
 *   nodes: number[], solution: number[], x0: number, dx: number, z?: number, scale?: number, max?: number,
 *   names?: Record<number,string>, level?: boolean, channelWidth?: number,
 *   unit?: string, labelFixed?: boolean,
 * }} o
 *  nodes：每个节点的初始高度（尺），第一个和最后一个固定（水库、田）。
 */
export function makeSlope(ctx, o) {
  const N = o.nodes.length;
  const S = o.scale ?? 0.34;
  const { x0, dx } = o;
  const z0 = o.z ?? 0;
  const hiMax = o.max ?? 12;
  const nodes = [...o.nodes];
  const X = (i) => x0 + i * dx;
  const Y = (h) => h * S;
  const names = o.names || {};
  const channel = makeChannel(ctx, { width: o.channelWidth ?? 1.1 });
  const posts = [], knobs = [], hits = [], labels = [], handles = [], extra = [];

  const path = () => nodes.map((h, i) => v3(X(i), Y(h), z0));

  for (let i = 0; i < N; i++) {
    const fixed = i === 0 || i === N - 1;
    const post = block(fixed ? C.stone : C.post, 1.3, 1, 1.5, { x: X(i), z: z0 });
    posts.push(post);
    const knob = new THREE.Group();
    knob.position.set(X(i), 0, z0);
    ctx.add(knob);
    knobs.push(knob);
    if (!fixed) {
      const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(0.27, 0), new THREE.MeshLambertMaterial({ color: C.gold }));
      ball.castShadow = true;
      ball.position.y = 0;
      const up = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.26, 4), new THREE.MeshLambertMaterial({ color: '#E8C26A' }));
      const dn = up.clone();
      up.position.y = 0.52; dn.position.y = -0.52; dn.rotation.z = Math.PI;
      knob.add(ball, up, dn);
      const hit = makeHit(knob);
      hits.push(hit);
    } else hits.push(null);
    const txt = names[i] ? `${names[i]} ${nodes[i]}<small>尺</small>` : `${nodes[i]}`;
    labels.push(ctx.labels.add(v3(X(i), 1, z0), txt, { cls: names[i] ? 'tag' : 'num', pop: false }));
  }

  function refreshNode(i) {
    const h = nodes[i];
    posts[i].scale.y = Math.max(0.05, Y(h) - 0.1);
    knobs[i].position.y = Y(h) + 0.82;
    if (hits[i]) { hits[i].scale.set(1.9, Y(h) + 1.6, 2.2); hits[i].position.y = -(Y(h) + 0.82); }
    labels[i].target = v3(X(i), Y(h) + (names[i] ? 0.55 : 1.6), z0);
    labels[i].set(names[i] ? `${names[i]} ${h}<small>尺</small>` : `${h}`);
  }
  function refreshAll() {
    for (let i = 0; i < N; i++) refreshNode(i);
    channel.setPath(path());
    updateLevel();
  }

  // ---------------------------------------------------------- 拖高度
  let busy = false, finished = false;
  const stats = { releases: 0, mishaps: 0 };
  function setNode(i, h, { sound = true } = {}) {
    const v = Math.max(0, Math.min(hiMax, Math.round(h)));
    if (v === nodes[i]) return;
    nodes[i] = v;
    if (sound) ctx.audio.play('tick');
    refreshNode(i);
    channel.setPath(path());
    updateLevel();
  }
  // 拖拽：地面上的拖拽点换算不准，这里自己盯着手指，用「穿过柱子、正对镜头的竖直面」换算高度，球会一直跟着手指走。
  const canvas = document.getElementById('gl');
  const ptr = { x: 0, y: 0 };
  const track = (e) => { ptr.x = e.clientX; ptr.y = e.clientY; };
  canvas.addEventListener('pointerdown', track, true);
  canvas.addEventListener('pointermove', track, true);
  ctx.onDispose(() => { canvas.removeEventListener('pointerdown', track, true); canvas.removeEventListener('pointermove', track, true); });
  const ray = new THREE.Raycaster();
  const hitY = (i) => {
    const r = canvas.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2(((ptr.x - r.left) / r.width) * 2 - 1, -((ptr.y - r.top) / r.height) * 2 + 1), ctx.camera);
    const n = new THREE.Vector3(ctx.camera.position.x - X(i), 0, ctx.camera.position.z - z0).normalize();
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(n, new THREE.Vector3(X(i), 0, z0));
    const q = new THREE.Vector3();
    return ray.ray.intersectPlane(plane, q) ? q.y : null;
  };
  for (let i = 1; i < N - 1; i++) {
    let y0 = null, h0 = 0;
    const h = ctx.pointer.draggable(knobs[i], {
      hit: hits[i], ringSize: 0, radius: 56,
      onStart: () => {
        if (ctx.view.isTop()) ctx.view.setTop(false);
        y0 = hitY(i); h0 = nodes[i];
        knobs[i].scale.setScalar(1.25);
      },
      onMove: () => {
        if (y0 === null) return;
        const y = hitY(i);
        if (y !== null) setNode(i, h0 + (y - y0) / S);
      },
      onEnd: () => { knobs[i].scale.setScalar(1); y0 = null; },
    });
    handles.push(h);
  }
  const lock = (on) => handles.forEach((h) => { h.enabled = !on; });

  // ---------------------------------------------------------- 水准器
  let levelTool = null, levelSeg = -1, levelLbl = null;
  function updateLevel() {
    if (!levelTool) return;
    if (levelSeg < 0) { levelLbl?.show(false); return; }
    const a = nodes[levelSeg], b = nodes[levelSeg + 1];
    const mid = (a + b) / 2;
    levelTool.position.set((X(levelSeg) + X(levelSeg + 1)) / 2, Y(mid) + 0.62, z0);
    const side = levelSide(a, b);
    const dh = Math.abs(a - b);
    levelTool.userData.bubble.position.x = -side * Math.min(0.62, 0.22 * dh + (dh ? 0.12 : 0));
    levelLbl.target = v3(levelTool.position.x, levelTool.position.y + 0.55, z0);
    levelLbl.set(side === 0 ? '一样平' : `${side < 0 ? '左' : '右'}边高 ${dh} 尺`).show(true);
  }
  if (o.level !== false) {
    const g = new THREE.Group();
    const bamboo = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 1.9, 10).rotateZ(Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#98B556' }));
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.95, 10).rotateZ(Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#DDF1E8', transparent: true, opacity: 0.9 }));
    const bubble = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), new THREE.MeshLambertMaterial({ color: '#FFFFFF', emissive: '#BBD' }));
    bubble.position.set(0, 0.03, 0);
    for (const sx of [-0.95, 0.95]) {
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.1, 10).rotateZ(Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#6F8A3A' }));
      ring.position.x = sx;
      g.add(ring);
    }
    bamboo.castShadow = true;
    g.add(bamboo, glass, bubble);
    g.userData.bubble = bubble;
    const home = v3(x0 + dx * 1.5, 0.3, z0 + 3.4);
    g.position.copy(home);
    ctx.add(g);
    levelTool = g;
    const hb = makeHit(g);
    hb.scale.set(2.4, 0.9, 1.2);
    levelLbl = ctx.labels.add(v3(0, 1, 0), '', { cls: 'tag', pop: false });
    extra.push(levelLbl);
    levelLbl.show(false);
    const lbl0 = ctx.labels.add(g, '水准器', { cls: 'tag', dy: 0.7, pop: false });
    extra.push(lbl0);
    const lh = ctx.pointer.draggable(g, {
      hit: hb, ringSize: 0.9, radius: 60, lift: 0.4,
      onStart: () => { levelSeg = -1; levelLbl.show(false); lbl0.show(false); },
      onEnd: async (p) => {
        const seg = Math.floor((p.x - x0) / dx);
        if (Math.abs(p.z - z0) < 2.6 && seg >= 0 && seg < N - 1) {
          levelSeg = seg;
          ctx.audio.play('place');
          updateLevel();
        } else {
          ctx.audio.play('whoosh');
          await go(ctx.fx.to(g.position, { x: home.x, y: home.y, z: home.z }, 280));
          lbl0.show(true);
        }
      },
    });
    handles.push(lh);
  }

  // ---------------------------------------------------------- 放水
  const fx = { puddles: [], tags: [], stops: [], pool: null };
  function clearFx() {
    fx.puddles.forEach((p) => p.remove()); fx.puddles = [];
    fx.tags.forEach((t) => t.remove()); fx.tags = [];
    fx.stops.forEach((s) => s()); fx.stops = [];
    if (fx.pool) { ctx.remove(fx.pool); fx.pool = null; }
  }
  /** 渠里水的速度：平的慢、降得多的快。 */
  function speedAt(s) {
    const cum = channel.cum;
    let i = 0;
    while (i < cum.length - 2 && s > cum[i + 1]) i++;
    const d = nodes[i] - nodes[i + 1];
    return 1.5 + 1.7 * Math.max(0, Math.min(2, d));
  }
  const reached = new Promise((resolve) => { o._resolve = resolve; });

  async function release() {
    if (busy || finished) return;
    busy = true;
    lock(true);
    clearFx();
    stats.releases++;
    const plan = simulateSlope(nodes);
    const cum = channel.cum;
    ctx.audio.play('whoosh');
    if (plan.kind === 'ok') {
      await advance(ctx, channel, channel.total, speedAt);
      finished = true;
      channel.setFlowing(true);
      ctx.audio.play('good');
      o._resolve({ nodes: [...nodes], stars: slopeStars(nodes), ...stats });
      return;
    }
    const seg = plan.seg;
    const L = cum[seg + 1] - cum[seg];
    if (plan.kind === 'blocked') {
      await advance(ctx, channel, cum[seg + 0], speedAt);
      // 水停在这儿，越积越高，漫出去
      const p = channel.pointAt(cum[seg]);
      const pool = block(C.water, 1.0, 0.1, 1.0, { x: p.x + 0.45, y: p.y + 0.06, z: p.z, cast: false, mat: waterMat() });
      fx.pool = pool;
      ctx.add(pool);
      ctx.audio.play('soft');
      await go(ctx.fx.tween({ duration: dur(ctx, 700), ease: 'out', onUpdate: (k) => { pool.scale.y = 0.1 + 0.36 * k; } }));
      const pud = makePuddle(ctx, p.x + 0.3, p.z + 1.7);
      fx.puddles.push(pud);
      ctx.audio.play('pop');
      await pud.grow(1.2, 900);
      const up = ctx.labels.add(v3(X(seg + 1), Y(nodes[seg + 1]) + 1.9, z0), '这里更高', { cls: 'say' });
      fx.tags.push(up);
      ctx.fx.sparkle({ x: X(seg + 1), z: z0 }, { color: C.gold, size: 1.4 });
      ctx.nudge('水只会往低处流，这里要比前面低才行。', { speak: true });
    } else {
      await advance(ctx, channel, cum[seg] + L * 0.5, speedAt);
      const p = channel.pointAt(cum[seg] + L * 0.5);
      fx.stops.push(crumble(ctx, p));
      ctx.audio.play('cut');
      const pud = makePuddle(ctx, p.x + 0.3, p.z + 1.9);
      fx.puddles.push(pud);
      await pud.grow(1.5, 900);
      const tg = ctx.labels.add(v3(p.x, p.y + 1.2, z0), '冲坏了', { cls: 'say' });
      fx.tags.push(tg);
      ctx.nudge('降得太陡，水把渠冲坏了。匀匀地降。', { speak: true });
    }
    stats.mishaps++;
    await ctx.wait(1500);
    clearFx();
    await drain(ctx, channel, 500);
    busy = false;
    lock(false);
    tool.enable(true);
  }

  const tool = ctx.hud.tool({ icon: 'waves', label: '放水', primary: true, onTap: () => { if (!busy && !finished) release(); } });
  tool.pulse(true);

  // ---------------------------------------------------------- 提示
  const sol = o.solution;
  const target = (i) => sol[i];
  async function tweenNode(i, h, ms = 520) {
    const from = nodes[i];
    const steps = Math.abs(h - from);
    if (!steps) return;
    await go(ctx.fx.tween({
      duration: dur(ctx, ms), ease: 'inOut',
      onUpdate: (k) => setNode(i, from + (h - from) * k),
    }));
    setNode(i, h);
  }
  const wrongIdx = () => { const r = []; for (let i = 1; i < N - 1; i++) if (nodes[i] !== sol[i]) r.push(i); return r; };
  const setHint = () => ctx.hint({
    text: o.hintText ?? '每一段都要比前一段低一点点，不能平，也不能一下降太多。调好再点「放水」。',
    ghost: () => {
      const w = wrongIdx();
      const i = w.length ? w[0] : 1;
      const k = knobs[i].position;
      return ctx.fx.ghostHand(v3(k.x, k.y, k.z), v3(k.x, Y(target(i)) + 0.82, k.z));
    },
    demo: async () => {
      for (const i of wrongIdx()) { await tweenNode(i, target(i)); await ctx.wait(120); }
      await ctx.wait(300);
      tool.tap();
      await ctx.wait(400);
    },
  });

  refreshAll();
  return {
    hint: setHint, nodes, channel, X, Y, S, reached, stats, tool, lock, refreshAll, setNode, tweenNode,
    solutionNodes: sol,
    levelTool: () => levelTool,
    release,
    get busy() { return busy; },
    done() { tool.hide(); lock(true); },
    /** 整个拆掉（柱子、金球、水准器、标签、渠、按钮）。 */
    dispose() {
      handles.forEach((h) => h.dispose());
      [...posts, ...knobs, levelTool].forEach((o) => o && ctx.remove(o));
      [...labels, ...extra].forEach((l) => l.remove());
      clearFx(); channel.dispose(); tool.remove();
    },
  };
}

export { drops, MAX_DROP };
