// 2-3 两村之间挖井 · 中垂线
// 两个同样大的圆 → 两个交点 → 连成线（到两村一样远的线）→ 和大路的交点就是井。
// 第二问：学徒把井挖在两村连线上偏了，拖到正中间。
import * as THREE from 'three';
import { defineLevel } from '../../engine/level.js';
import { PALETTE } from '../../engine/palette.js';
import { mat } from '../../engine/shared.js';
import { createBoard, roadStrip, hut, v3 } from './kit.js';
import * as M from './math.js';

const A = { x: -4, z: -0.5 };
const B = { x: 4, z: 1.5 };
const MID = M.mid(A, B);
const U = M.unit(M.sub(B, A));
const N = M.perp(U);
const W = { x: MID.x - N.x * 3.2, z: MID.z - N.z * 3.2 };
const RD = { x: Math.cos(-0.31), z: Math.sin(-0.31) };
const R1 = { x: W.x - RD.x * 14, z: W.z - RD.z * 14 };
const R2 = { x: W.x + RD.x * 14, z: W.z + RD.z * 14 };

/** 井：石沿 + 水。 */
function makeWell(ctx, p) {
  const g = new THREE.Group();
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.8, 0.45, 12), mat(PALETTE.stone));
  rim.position.y = 0.22;
  const water = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.58, 0.05, 12), new THREE.MeshLambertMaterial({ color: PALETTE.river }));
  water.position.y = 0.45;
  rim.castShadow = true;
  g.add(rim, water);
  g.position.set(p.x, 0, p.z);
  ctx.add(g);
  ctx.fx.pop(g, { duration: 500 });
  return g;
}

export default defineLevel({
  id: 'ch2-l3',
  title: '两村之间挖井',
  concept: '中垂线',
  brief: '东村和西村合挖一口井，到两村要一样远，还要挖在大路上。',
  discovery: '到两点一样远的地方排成一条直线，这条线垂直，而且正好过两村中间。',

  async setup(ctx) {
    const { props } = ctx;
    props.ground({ w: 26, d: 16, seed: 73, puddles: 0 });
    ctx.view.shadow({ x: 0, z: 0.5 }, 15);
    const board = createBoard(ctx, { bounds: { minX: -12, maxX: 12, minZ: -7.5, maxZ: 7.5 } });
    ctx.view.frame({ x: 0, z: 0.3 }, 9.5, { instant: true });
    roadStrip(ctx, R1, R2, { width: 1.2 });
    board.addRoad(R1, R2);
    board.addPoint('A', A, { name: '西村', cls: 'tag', h: 1 });
    board.addPoint('B', B, { name: '东村', cls: 'tag', h: 1 });
    hut(ctx, A.x - 1.4, A.z + 0.2, 0.4);
    hut(ctx, B.x + 1.4, B.z - 0.3, -0.4);

    // ---- 一：找井的位置 ----
    ctx.hud.progress(0, 2);
    ctx.hud.task('用规画两个同样大的圆，找到离两村一样远的线。');
    const c1 = await board.circle({
      centers: ['A', 'B'],
      free: { min: 3, max: 8, start: 3, dir: -Math.PI / 2, demoR: 6, check: (r) => (r >= 5 ? true : '绳子太短，两个圆碰不到头。再放长一点。') },
      texts: { center: '圆规脚扎在一个村子的桩上。点它。', radius: '把笔往外拖，绳子要放长，两个圆才碰得到。', radiusHint: '按住金色的笔往外拖到 6 个结以上，松手。', turn: '拖着笔绕桩走一圈。' },
    });
    const other = c1.centerKey === 'A' ? 'B' : 'A';
    const c2 = await board.circle({
      centers: [other], fixedR: c1.r, texts: { turn: '绳长不变，到另一个村子再画一圈。' },
    });
    await board.pickIntersection(c1.e, c2.e, { key: 'P', name: null, text: '两个圆碰头的地方。点发亮的光点打桩。' });
    await board.pickIntersection(c1.e, c2.e, { key: 'Q', name: null, text: '再点另一个光点打桩。' });
    const ln = await board.line({ pairs: [['P', 'Q']], texts: { first: '点一根新桩，系上直绳。', second: '再点另一根，拉直。' } });
    ctx.nudge('这条线上每一点，到两村都一样远。', { kind: 'good' });
    await ctx.wait(1500);
    const sp = await board.pickIntersection(ln.e, board.ents[0], { key: 'well', name: null, text: '直绳和大路交叉的地方，就是井。点光点。', h: 0.5, color: PALETTE.stone });
    const wp = sp.p;

    // 验证：两根绳一样长
    board.removePoint('well');
    makeWell(ctx, wp);
    const ropes = [A, B].map((q) => {
      const r = props.rope({ points: [wp, q], y: 0.5 });
      const m = M.mid(wp, q);
      const l = ctx.labels.add(v3(m.x, 0.6, m.z), `${M.dist(wp, q).toFixed(1)}<small>步</small>`, { cls: 'num ok' });
      return { r, l };
    });
    ctx.audio.play('success');
    ctx.nudge('到西村、到东村，一样远！', { kind: 'good' });
    await ctx.wait(2600);
    ropes.forEach((x) => { ctx.remove(x.r.group); x.l.remove(); });

    // ---- 二：小老师 ----
    ctx.hud.progress(1, 2);
    ctx.hud.task('学徒把另一口井挖在两村连线上，偏了。帮他拖到离两村一样远。');
    ctx.view.frame({ x: 0, z: 0.5 }, 8.5);
    const t0 = 0.74;
    const S = props.stake({ x: A.x + (B.x - A.x) * t0, z: A.z + (B.z - A.z) * t0, h: 0.7, color: PALETTE.gold });
    props.hitBox(1.5, 1.4, 1.5, S);
    const ropeA = props.rope({ every: 1000, y: 0.5, color: '#9AB7D3' });
    const ropeB = props.rope({ every: 1000, y: 0.5, color: '#E9A98F' });
    const la = ctx.labels.add(v3(0, 0, 0), '', { cls: 'num', pop: false });
    const lb = ctx.labels.add(v3(0, 0, 0), '', { cls: 'num', pop: false });
    const upd = (t) => {
      const p = { x: A.x + (B.x - A.x) * t, z: A.z + (B.z - A.z) * t };
      S.position.set(p.x, 0, p.z);
      ropeA.setPoints([A, p]); ropeB.setPoints([p, B]);
      const ma = M.mid(A, p), mb = M.mid(p, B);
      la.target = v3(ma.x, 0.6, ma.z - 0.6); lb.target = v3(mb.x, 0.6, mb.z - 0.6);
      la.set(M.dist(A, p).toFixed(1)); lb.set(M.dist(p, B).toFixed(1));
      const eq = Math.abs(t - 0.5) < 1e-6;
      la.cls('ok', eq); lb.cls('ok', eq);
    };
    upd(t0);
    let tNow = t0;
    await ctx.waitFor((done) => {
      const h = ctx.pointer.draggable(S, {
        lift: 0.2, ringSize: 0.8, priority: 5,
        snap: (p) => {
          let t = Math.min(0.95, Math.max(0.05, M.paramOnLine(p, A, B)));
          if (Math.abs(t - 0.5) * M.dist(A, B) < 0.7) t = 0.5;
          return v3(A.x + (B.x - A.x) * t, 0, A.z + (B.z - A.z) * t);
        },
        onMove: (p) => { tNow = M.paramOnLine(p, A, B); upd(tNow); },
        onEnd: () => {
          if (Math.abs(tNow - 0.5) < 1e-6) { h.dispose(); done(); } else ctx.nudge('两边还不一样长，再挪一挪。');
        },
      });
      ctx.hint({
        text: '顺着两村的连线拖，让两边的数字一样大。',
        ghost: () => ctx.fx.ghostHand(v3(S.position.x, 0.5, S.position.z), v3(MID.x, 0.5, MID.z)),
        demo: () => ctx.pointer.simulateDrag(h, v3(MID.x, 0, MID.z), { duration: 900 }),
      });
    });
    ctx.hint(null);
    ctx.audio.play('success');
    ctx.fx.sparkle(MID, { size: 1.4 });
    // 垂直 + 过中间
    const sq = props.square({ len: 1.1 });
    sq.place(MID, U, { x: -N.x, z: -N.z });
    sq.ok(true);
    ctx.nudge('正中间！这条线和两村连线垂直，还平分它。', { kind: 'good' });
    await ctx.wait(2800);
    const u = ctx.hintsUsed;
    ctx.complete({ stars: u === 0 ? 3 : u < 3 ? 2 : 1 });
  },
});
