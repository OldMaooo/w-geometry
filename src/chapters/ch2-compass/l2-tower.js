// 2-2 三根柱的瞭望台 · 等边三角形（原本 I.1）
// 先凭眼睛放第三根桩，量出三边差多少；再用两个圆的交点打桩，三边一样长，台子立起来。
import * as THREE from 'three';
import { defineLevel } from '../../engine/level.js';
import { PALETTE } from '../../engine/palette.js';
import { mat } from '../../engine/shared.js';
import { createBoard, v3 } from './kit.js';
import * as M from './math.js';

const A = { x: -3, z: 0.5 };
const B = { x: 3, z: 0.5 };

/** 三角形的平板（台面 / 顶），y 向上厚 h。 */
function triSlab(ctx, pts, y, h, color) {
  const sh = new THREE.Shape(pts.map((p) => new THREE.Vector2(p.x, -p.z)));
  const m = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: h, bevelEnabled: false }), mat(color));
  m.rotation.x = -Math.PI / 2;
  m.position.y = y;
  m.castShadow = m.receiveShadow = true;
  ctx.add(m);
  return m;
}

export default defineLevel({
  id: 'ch2-l2',
  title: '三根柱的瞭望台',
  concept: '等边三角形',
  brief: '瞭望台要三根柱子，两两一样远才稳。已经有两根桩了，第三根打在哪？',
  discovery: '两个圆的交点，离两根桩都是一根绳长。交点上面有一个，下面还有一个。',

  async setup(ctx) {
    const { props } = ctx;
    props.ground({ w: 22, d: 14, seed: 52, puddles: 0 });
    ctx.view.shadow({ x: 0, z: 0.5 }, 13);
    const board = createBoard(ctx, { bounds: { minX: -10, maxX: 10, minZ: -6.5, maxZ: 6.5 } });
    const sh = props.villager({ x: -8, z: 4.5, color: '#7D6A55', face: 0.5 });
    ctx.view.frame({ x: 0, z: 0.5 }, 8.3, { instant: true });
    board.addPoint('A', A, { name: 'A' });
    board.addPoint('B', B, { name: 'B' });

    // ---- 先试：凭眼睛放 ----
    ctx.hud.progress(0, 2);
    ctx.hud.task('先凭眼睛试试：把金色的桩拖到你觉得三边一样长的地方。');
    const T = props.stake({ x: 0.8, z: 5.2, h: 0.9, color: PALETTE.gold });
    props.hitBox(1.4, 1.4, 1.4, T);
    const loop = props.rope({ closed: true, every: 1000, y: 0.35 });
    const lbl = [0, 1, 2].map(() => ctx.labels.add(v3(0, 0, 0), '', { cls: 'num', pop: false }));
    const sides = () => {
      const t = { x: T.position.x, z: T.position.z };
      loop.setPoints([A, B, t]);
      const e = [[A, B], [B, t], [t, A]];
      e.forEach(([u, w], i) => {
        const m = M.mid(u, w);
        const o = M.unit({ x: m.x - (A.x + B.x + t.x) / 3, z: m.z - (A.z + B.z + t.z) / 3 });
        lbl[i].target = v3(m.x + o.x * 0.7, 0.4, m.z + o.z * 0.7);
        lbl[i].set(M.dist(u, w).toFixed(1));
      });
      return [M.dist(A, B), M.dist(B, t), M.dist(t, A)];
    };
    sides();
    const tried = ctx.waitFor((done) => {
      const h = ctx.pointer.draggable(T, {
        lift: 0.2, ringSize: 0.8, priority: 5,
        onMove: (p) => { T.position.set(p.x, 0, p.z); sides(); },
        onEnd: (p, { moved }) => { if (moved) done(); },
      });
      ctx.hint({
        text: '按住金色的桩，拖到你觉得三边差不多长的地方。',
        ghost: () => ctx.fx.ghostHand(v3(T.position.x, 0.5, T.position.z), v3(1.1, 0.5, -3.3)),
        demo: () => ctx.pointer.simulateDrag(h, v3(1.1, 0, -3.1), { duration: 900 }),
      });
    });
    await tried;
    ctx.hint(null);
    const [ab, bt, ta] = sides();
    const diff = Math.max(ab, bt, ta) - Math.min(ab, bt, ta);
    ctx.recordGuess('length', (bt + ta) / 2, ab, '步');
    ctx.nudge(diff < 0.4 ? '好准！可是想刚刚好，还得用规。' : `三条边差了 ${diff.toFixed(1)} 步。光用眼睛很难刚刚好。`);
    await ctx.wait(2400);
    ctx.remove(T); ctx.remove(loop.group); lbl.forEach((l) => l.remove());

    // ---- 用规 ----
    ctx.hud.progress(1, 2);
    const texts = { through: '绳子的另一头系在另一根桩上。点它。', turn: '拖着金色的笔，绕桩走一圈。' };
    const c1 = await board.circle({ centers: ['A', 'B'], through: (k) => [k === 'A' ? 'B' : 'A'], texts: { ...texts, center: '圆规脚扎在 A 或 B 上。点一根桩。' } });
    const other = c1.centerKey === 'A' ? 'B' : 'A';
    const c2 = await board.circle({ centers: [other], through: (k) => [k === 'A' ? 'B' : 'A'], texts: { ...texts, through: '换到另一根桩上，绳长不变。点另一根桩。' } });
    const { p } = await board.pickIntersection(c1.e, c2.e, { key: 'C', name: 'C', text: '两个圆在这里碰头。点发亮的光点，打第三根桩。' });
    const others = board.intersections(c1.e, c2.e).filter((q) => M.dist(q, p) > 0.1);

    // 三边亮起：一样长
    const C = p;
    const cen = { x: (A.x + B.x + C.x) / 3, z: (A.z + B.z + C.z) / 3 };
    props.rope({ closed: true, every: 1, y: 0.35, points: [A, B, C] });
    const ll = [[A, B], [B, C], [C, A]].map(([u, w]) => {
      const m = M.mid(u, w);
      const o = M.unit({ x: m.x - cen.x, z: m.z - cen.z });
      return ctx.labels.add(v3(m.x + o.x * 0.7, 0.4, m.z + o.z * 0.7), M.dist(u, w).toFixed(0), { cls: 'num ok' });
    });
    ctx.audio.play('good');
    ctx.nudge('三条边一样长！', { kind: 'good' });
    await ctx.wait(1800);

    // 台子立起来
    const h = 3.4;
    ctx.fx.pop(triSlab(ctx, [A, B, C], 0, 0.25, PALETTE.stone), { duration: 400 });
    for (const q of [A, B, C]) {
      const pil = new THREE.Mesh(new THREE.BoxGeometry(0.5, h, 0.5), mat(PALETTE.clay));
      pil.position.set(q.x, h / 2, q.z);
      pil.castShadow = true;
      ctx.add(pil);
      ctx.fx.sprout(pil, { duration: 700, delay: 200 });
      ctx.audio.play('grow', { n: 3 });
    }
    await ctx.wait(900);
    const roofPts = [A, B, C].map((q) => ({ x: cen.x + (q.x - cen.x) * 1.25, z: cen.z + (q.z - cen.z) * 1.25 }));
    ctx.fx.pop(triSlab(ctx, roofPts, h, 0.35, '#8E5B3A'), { duration: 500 });
    ctx.audio.play('success');
    ctx.hud.task('瞭望台立起来了！');
    sh.cheer();
    ll.forEach((l) => l.remove());
    if (others[0]) {
      board.markAt(others[0], { color: '#FFF1B8' });
      ctx.labels.add(v3(others[0].x, 0.3, others[0].z), '这里也行', { cls: 'soft' });
    }
    ctx.view.frame({ x: 0, z: 0.5 }, 9.5, { pitch: 38 });
    await ctx.wait(1800);
    const u = ctx.hintsUsed;
    ctx.complete({ stars: u === 0 ? 3 : u < 3 ? 2 : 1 });
  },
});
