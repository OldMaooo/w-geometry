// 3-5 放大图纸 · 边×2，面积×4
// 图纸上是个小 L 形（方格纸上 6 格）。每条边放大 2 倍拉绳放样，再点图纸上的格子，大地基上就铺满砖：24 块。再做 3 倍：54 块。
import { defineLevel } from '../../engine/level.js';
import { PALETTE } from '../../engine/palette.js';
import { makeSeg, v3 } from './kit.js';
import { L_POLY, scalePoly, edgeLens, cellsIn, blockOf, showNum } from './math.js';

const O = { x: -2, z: -4 };   // 大地基左上角
const Q = { x: -12, z: -3 };  // 图纸左上角

const ROUNDS = [
  { k: 2, total: 24, options: [6, 12, 18, 24, 36] },
  { k: 3, total: 54, options: [18, 27, 36, 54, 81] },
];

export default defineLevel({
  id: 'ch3-l5',
  title: '放大图纸',
  concept: '边×k，面积×k²',
  brief: '图纸上的宫殿地基是个小 L 形。国王说：每条边放大 2 倍。要准备几块地砖？',
  discovery: '边变 2 倍，要 4 倍的砖；边变 3 倍，要 9 倍的砖。',

  async setup(ctx) {
    ctx.state.toScreen = (x, y, z) => ctx.pointer.toScreen(new ctx.THREE.Vector3(x, y, z)); // 调试 / 自动测试用
    const { props, THREE } = ctx;
    props.ground({ w: 32, d: 20, x: -1, z: 0, seed: 71, river: null, trees: 4, cells: true });
    ctx.view.shadow({ x: -1, z: 0.5 }, 18);
    ctx.view.frame({ x: -0.5, z: 0.8 }, 13.5, { instant: true });

    // ---- 图纸 ----
    const paper = new THREE.Mesh(new THREE.BoxGeometry(6, 0.1, 5), new THREE.MeshLambertMaterial({ color: PALETTE.paper }));
    paper.position.set(Q.x + 2, 0.05, Q.z + 1.5);
    ctx.add(paper);
    const cells = cellsIn(L_POLY);
    const cellMeshes = cells.map(([i, j]) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.14, 0.94), new THREE.MeshLambertMaterial({ color: '#D8B27A' }));
      m.position.set(Q.x + i + 0.5, 0.15, Q.z + j + 0.5);
      m.receiveShadow = true;
      ctx.add(m);
      return m;
    });
    const L0 = edgeLens(L_POLY);
    const mids = L_POLY.map((p, i) => {
      const q = L_POLY[(i + 1) % L_POLY.length];
      return { x: Q.x + (p[0] + q[0]) / 2, z: Q.z + (p[1] + q[1]) / 2 };
    });
    // 边长数字挪到图形外面一点
    const cx = Q.x + 1.7, cz = Q.z + 1.1;
    const edgeLbl = mids.map((m, i) => {
      const dx = m.x - cx, dz = m.z - cz, d = Math.hypot(dx, dz) || 1;
      return ctx.labels.add(v3(m.x + (dx / d) * 0.65, 0.4, m.z + (dz / d) * 0.65), L0[i], { cls: 'num', pop: false });
    });
    const hl = makeSeg(ctx, { color: '#F7C948', r: 0.12 });
    hl.show(false);

    let stars = 3;
    for (let ri = 0; ri < ROUNDS.length; ri++) {
      const { k, total, options } = ROUNDS[ri];
      ctx.hud.progress(ri, ROUNDS.length);
      const junk = [];
      const ropes = [];
      const poly = scalePoly(L_POLY, k);
      const V = poly.map(([x, z]) => ({ x: O.x + x, z: O.z + z }));
      ctx.hud.task(ri === 0 ? '每条边放大 2 倍。先猜：要几块地砖？' : '这次每条边放大 3 倍。先猜：要几块地砖？');
      const g = await ctx.choose({ prompt: `边放大 ${k} 倍，要几块地砖？`, options: options.map((v) => ({ label: `${v}`, value: v })), answer: total });
      ctx.recordGuess('area', g, total, '块');
      if (ri === 1) stars = g === total ? 3 : 2;

      // ---- 放样 ----
      const stake0 = props.stake({ x: V[0].x, z: V[0].z, color: '#7A5233' });
      junk.push(stake0);
      ctx.fx.pop(stake0);
      ctx.view.frame({ x: -0.5, z: 0.8 }, ri === 0 ? 12.5 : 14, {});
      for (let e = 0; e < 6; e++) {
        const A = V[e], B = V[(e + 1) % 6];
        const len = Math.abs(B.x - A.x) + Math.abs(B.z - A.z);
        const dir = { x: Math.sign(B.x - A.x), z: Math.sign(B.z - A.z) };
        const want = L0[e] * k;
        void len;
        edgeLbl.forEach((l, i) => l.cls('lit', i === e));
        const p0 = L_POLY[e], p1 = L_POLY[(e + 1) % 6];
        hl.set(v3(Q.x + p0[0], 0.3, Q.z + p0[1]), v3(Q.x + p1[0], 0.3, Q.z + p1[1])).show(true);
        ctx.hud.task(`拉绳放样：图纸上这条边是 ${L0[e]} 步，放大 ${k} 倍，拉几步？`);
        const rope = props.rope({ points: [A, A], every: 1, y: 0.32 });
        ropes.push(rope);
        const head = ctx.add(new THREE.Group());
        const hp = { x: A.x + dir.x * 0.6, z: A.z + dir.z * 0.6 };
        head.position.set(hp.x, 0, hp.z);
        const knob = new THREE.Mesh(new THREE.IcosahedronGeometry(0.24, 0), new THREE.MeshLambertMaterial({ color: PALETTE.gold }));
        knob.position.y = 0.36;
        head.add(knob);
        props.hitBox(1.3, 0.9, 1.3, head);
        rope.setPoints([A, hp]);
        const cnt = ctx.labels.add(v3(hp.x, 0.7, hp.z), '', { cls: 'num lit', pop: false });
        cnt.show(false);
        let t = 0;
        await ctx.waitFor((done) => {
          const h = ctx.pointer.draggable(head, {
            lift: 0, ringSize: 0.6,
            snap: (p) => {
              t = Math.min(want + 4, Math.max(1, Math.round((p.x - A.x) * dir.x + (p.z - A.z) * dir.z)));
              p.x = A.x + dir.x * t; p.z = A.z + dir.z * t;
              return p;
            },
            onMove: (p) => {
              head.position.set(p.x, 0, p.z);
              rope.setPoints([A, p]);
              cnt.target = v3(p.x, 0.75, p.z);
              cnt.set(t).show(true);
              cnt.cls('ok', t === want);
            },
            onEnd: () => {
              if (t === want) { h.enabled = false; done(); } else ctx.nudge(`图纸上是 ${L0[e]} 步，放大 ${k} 倍。再拉一拉。`);
            },
          });
          ctx.hint({
            text: `这条边图纸上是 ${L0[e]} 步，放大 ${k} 倍就是 ${L0[e]} 的 ${k} 倍。`,
            ghost: () => ctx.fx.ghostHand(v3(head.position.x, 0.5, head.position.z), v3(B.x, 0.5, B.z)),
            demo: () => ctx.pointer.simulateDrag(h, v3(B.x, 0, B.z), { duration: 1000 }),
          });
        });
        ctx.hint(null);
        ctx.remove(head);
        cnt.remove();
        rope.setPoints([A, B]);
        if (e < 5) { const s = props.stake({ x: B.x, z: B.z }); junk.push(s); ctx.fx.pop(s); }
        ctx.audio.play('place');
        await ctx.wait(250);
      }
      hl.show(false);
      edgeLbl.forEach((l) => l.cls('lit', false));
      ctx.audio.play('good');
      ctx.nudge('地基围好了！', { kind: 'good', speak: false });

      // ---- 点图纸格子，大地基上铺砖 ----
      ctx.hud.task('点一点图纸上的格子，大地基上就铺上砖。');
      const counter = ctx.labels.add(v3(O.x + 4 * k / 2, 0.5, O.z + 1.5 * k), '0', { cls: 'big', pop: false });
      let sum = 0, done6 = 0;
      const tapFns = [];
      const taps = [];
      await ctx.waitFor((allDone) => {
        cells.forEach((c, idx) => {
          let used = false;
          const act = async () => {
            if (used) return;
            used = true;
            cellMeshes[idx].material.color.set('#9FD08A');
            ctx.audio.play('tap');
            for (const [bi, bj] of blockOf(c, k)) {
              const m = props.mat({ x: O.x + bi + 0.5, z: O.z + bj + 0.5 });
              junk.push(m);
              ctx.fx.pop(m, { duration: 200 });
              sum++;
              counter.set(sum);
              ctx.audio.play('count', { n: Math.min(sum, 14) });
              await ctx.wait(55);
            }
            done6++;
            if (done6 === cells.length) allDone();
          };
          tapFns.push(act);
          taps.push(ctx.pointer.tappable(cellMeshes[idx], act, { radius: 46 }));
        });
        ctx.hint({
          text: '点图纸上的小格子，每一格会变成一块大的。',
          quiet: false,
          demo: async () => { const f = tapFns.shift(); if (f) await f(); else await ctx.wait(300); },
        });
      });
      ctx.hint(null);
      taps.forEach((t) => t.dispose());
      counter.set(`${total}<small>块</small>`);
      ctx.say(`${total} 块，是图纸的 ${k * k} 倍`);
      ctx.fx.sparkle({ x: O.x + 2 * k, z: O.z + 1.5 * k }, { color: '#F7C948', size: 2 });
      ctx.nudge(`6 格变成 ${total} 块：${k * k} 倍。`, { kind: 'good', speak: false });
      await ctx.wait(2600);
      if (ri < ROUNDS.length - 1) {
        counter.remove();
        junk.forEach((o) => ctx.remove(o));
        ropes.forEach((r) => r.group.removeFromParent());
        cellMeshes.forEach((m) => m.material.color.set('#D8B27A'));
      }
    }
    ctx.hud.progress(ROUNDS.length, ROUNDS.length);
    void showNum;
    ctx.complete({ stars });
  },
});
