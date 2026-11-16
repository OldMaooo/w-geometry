// 6-2 最短的渠 · 直线最短，可是有山
// 第一轮：平地上拖拐点，拉直最短。第二轮：中间有座石山挖不动，先猜从哪边绕，再拖拐点贴着山脚绕。
// 第三轮：两个村子要水，拖分岔口，找三段渠加起来最短的地方。
import { defineLevel } from '../../engine/level.js';
import { polylineLength, pathHitsRect, shortestAround, fermatPoint, treeLength, dist } from './math.js';
import { makeChannel, advance, makeReservoir } from './flow.js';
import { v3, C, block, exposeScreen, makeHouse, makeKnob, chapterStyles, go } from './kit.js';

const snap05 = (p) => { p.x = Math.round(p.x * 2) / 2; p.z = Math.round(p.z * 2) / 2; return p; };
const bounds = { minX: -11, maxX: 11, minZ: -7.5, maxZ: 7.5 };
const MOUNTAIN = { x0: -3, x1: 3, z0: -5, z1: 2 };
const TOL = 1.05;

function makeMountain(ctx, r, parent) {
  const w = r.x1 - r.x0, d = r.z1 - r.z0, cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
  const g = new ctx.THREE.Group();
  g.position.set(cx, 0, cz);
  block(C.mountain, w, 1.6, d, { parent: g });
  block(C.mountainTop, w * 0.7, 1.2, d * 0.7, { y: 1.6, parent: g });
  block('#E8E4DA', w * 0.34, 0.9, d * 0.34, { y: 2.8, parent: g });
  parent.add(g);
  return g;
}

export default defineLevel({
  id: 'ch6-l2',
  title: '最短的渠',
  concept: '直线最短·绕障碍',
  brief: '从水库到村子要挖渠，挖一步要一天工。怎么挖最省？',
  discovery: '拉直最短；绕路时，贴着障碍拐。',

  async setup(ctx) {
    exposeScreen(ctx);
    chapterStyles(ctx);
    const { props, THREE } = ctx;
    props.ground({ w: 26, d: 18, seed: 62, river: null, trees: 8, cells: false });
    ctx.view.shadow({ x: 0, z: 0 }, 18);
    ctx.view.frame({ x: 0, z: 0.6 }, 10.2, { instant: true, pitch: 56, yaw: 0 });
    let moves = 0;

    /** 一条折线渠 A → 拐点们 → B。返回 Promise：进了「很省」的范围。 */
    async function bendRound({ A, B, bends, targets, opt, tip, mountain, text }) {
      const R = ctx.add(new THREE.Group());
      const thr = opt * TOL;
      makeReservoir(ctx, { x: A.x - 0.4, z: A.z, w: 2.2, d: 2.2, y: 0.45, parent: R });
      makeHouse(ctx, B.x + 0.7, B.z, { parent: R, face: -0.3 });
      if (mountain) makeMountain(ctx, mountain, R);
      const ch = makeChannel(ctx, { parent: R, width: 0.9 });
      const pts = bends.map((b) => ({ ...b }));
      const lbl = ctx.labels.add(v3(0, 1, 0), '', { cls: 'big', pop: false });
      const knobs = pts.map((p) => {
        const k = makeKnob(ctx, { parent: R });
        k.group.position.set(p.x, 0, p.z);
        return k;
      });
      const route = () => [A, ...pts, B];
      let ok = false;
      function update() {
        const r = route();
        ch.setPath(r.map((p) => ({ x: p.x, y: 0.1, z: p.z })));
        const len = polylineLength(r);
        const hits = mountain && pathHitsRect(r, mountain);
        lbl.target = v3(...(() => { const q = ch.pointAt(ch.total / 2); return [q.x, 0.9, q.z + (pts.length ? 0 : 0)]; })());
        lbl.set(hits ? '石山挖不动' : `${(Math.round(len * 10) / 10).toFixed(1)}<small>步</small>`);
        ok = !hits && len <= thr;
        lbl.cls('good', ok);
        lbl.cls('stone', !!hits);
        return { len, hits };
      }
      update();
      ctx.hud.task(text);
      const done = ctx.waitFor((resolve) => {
        const handles = knobs.map((k, i) => ctx.pointer.draggable(k.group, {
          ringSize: 0.7, lift: 0, bounds,
          snap: snap05,
          onMove: (p) => { pts[i].x = p.x; pts[i].z = p.z; k.group.position.set(p.x, 0, p.z); update(); },
          onEnd: () => {
            moves++;
            const { len, hits } = update();
            if (hits) { ctx.nudge('石山挖不动，要绕过去。'); return; }
            if (len <= thr) { handles.forEach((h) => { h.enabled = false; }); resolve(len); return; }
            ctx.nudge(tip);
          },
        }));
        ctx.hint({
          text: tip,
          ghost: () => {
            const i = pts.findIndex((p, j) => dist(p, targets[j]) > 0.4);
            const k = Math.max(0, i);
            return ctx.fx.ghostHand(v3(pts[k].x, 0.7, pts[k].z), v3(targets[k].x, 0.7, targets[k].z));
          },
          demo: async () => {
            for (let i = 0; i < pts.length; i++) {
              if (dist(pts[i], targets[i]) < 0.1) continue;
              await ctx.pointer.simulateDrag(handles[i], v3(targets[i].x, 0, targets[i].z), { duration: 900 });
            }
          },
        });
      });
      const len = await done;
      ctx.hint(null);
      ctx.audio.play('good');
      ctx.fx.sparkle({ x: B.x, z: B.z }, { size: 2 });
      // 水流过去
      await advance(ctx, ch, ch.total, () => 7);
      ctx.nudge(`${(Math.round(len * 10) / 10).toFixed(1)} 步，很省！`, { kind: 'good', speak: true });
      await ctx.wait(1500);
      return { R, ch, lbl, knobs };
    }
    const clear = (r) => { r.ch.dispose(); r.lbl.remove(); ctx.remove(r.R); };

    // ---------------- 第一轮：平地
    ctx.hud.progress(0, 3);
    const r1 = await bendRound({
      A: { x: -9, z: 3 }, B: { x: 9, z: 3 }, opt: 18,
      bends: [{ x: -3, z: -4.5 }, { x: 3, z: 6.5 }],
      targets: [{ x: -3, z: 3 }, { x: 3, z: 3 }],
      tip: '渠弯来弯去更费工。把拐点拉到一条直线上，再看数字。',
      text: '拖动两个金球，让渠越短越好。',
    });
    clear(r1);

    // ---------------- 第二轮：绕山
    ctx.hud.progress(1, 3);
    const A2 = { x: -9, z: 0 }, B2 = { x: 9, z: 0 };
    const best = shortestAround(A2, B2, MOUNTAIN, 0.3);
    // 先看看山，再猜
    const prev = ctx.add(new THREE.Group());
    makeMountain(ctx, MOUNTAIN, prev);
    ctx.hud.task('中间有座石山，挖不动。渠只能绕过去。');
    await ctx.wait(900);
    const way = await ctx.choose({
      prompt: '先猜：从山的哪一边绕，渠更短？',
      options: [{ label: '从上边绕', value: 'top', icon: 'arrow' }, { label: '从下边绕', value: 'bottom', icon: 'arrow' }],
      answer: 'bottom',
    });
    ctx.recordGuess('length', way === 'bottom' ? best.length : 22, best.length, '步', way === 'bottom' ? 1 : best.length / 22);
    ctx.remove(prev);
    const r2 = await bendRound({
      A: A2, B: B2, opt: best.length, mountain: MOUNTAIN,
      bends: [{ x: -4, z: -6 }, { x: 4, z: -6 }],
      targets: [{ x: -3.5, z: 2.5 }, { x: 3.5, z: 2.5 }],
      tip: '能通，可是还能更省。试试从山的另一边绕，贴着山脚拐。',
      text: '拖动金球，让渠绕过石山，而且越短越好。',
    });
    clear(r2);

    // ---------------- 第三轮：两个村
    ctx.hud.progress(2, 3);
    const A3 = { x: -9, z: 0 }, V1 = { x: 6, z: -6 }, V2 = { x: 6, z: 6 };
    const J0 = fermatPoint([A3, V1, V2]);
    const opt3 = treeLength(A3, J0, [V1, V2]);
    const R = ctx.add(new THREE.Group());
    makeReservoir(ctx, { x: A3.x - 0.4, z: A3.z, w: 2.2, d: 2.2, y: 0.45, parent: R });
    makeHouse(ctx, V1.x + 0.7, V1.z, { parent: R, face: -0.3 });
    makeHouse(ctx, V2.x + 0.7, V2.z, { parent: R, face: -0.3, roof: '#6F8FAF' });
    const main = makeChannel(ctx, { parent: R, width: 0.9 });
    const b1 = makeChannel(ctx, { parent: R, width: 0.9 });
    const b2 = makeChannel(ctx, { parent: R, width: 0.9 });
    const J = { x: -3, z: 5 };
    const jk = makeKnob(ctx, { parent: R });
    jk.group.position.set(J.x, 0, J.z);
    const lbl = ctx.labels.add(v3(0, 1, 0), '', { cls: 'big', pop: false });
    const thr3 = opt3 * TOL;
    function update3() {
      const flat = (p) => ({ x: p.x, y: 0.1, z: p.z });
      main.setPath([flat(A3), flat(J)]);
      b1.setPath([flat(J), flat(V1)]);
      b2.setPath([flat(J), flat(V2)]);
      const len = treeLength(A3, J, [V1, V2]);
      lbl.target = v3(J.x + 0.3, 1.5, J.z - 1.1);
      lbl.set(`${(Math.round(len * 10) / 10).toFixed(1)}<small>步</small>`);
      lbl.cls('good', len <= thr3);
      return len;
    }
    update3();
    ctx.hud.task('一条主渠，分两岔通到两个村。拖分岔口，让三段加起来最短。');
    const tip3 = '分岔口放在两村和水库的「中间」，三段渠加起来最短。';
    await ctx.waitFor((resolve) => {
      const h = ctx.pointer.draggable(jk.group, {
        ringSize: 0.7, lift: 0, bounds: { minX: -9, maxX: 9.5, minZ: -7.5, maxZ: 7.5 },
        snap: snap05,
        onMove: (p) => { J.x = p.x; J.z = p.z; jk.group.position.set(p.x, 0, p.z); update3(); },
        onEnd: () => {
          moves++;
          const len = update3();
          if (len <= thr3) { h.enabled = false; resolve(); return; }
          ctx.nudge(tip3);
        },
      });
      ctx.hint({
        text: tip3,
        ghost: () => ctx.fx.ghostHand(v3(J.x, 0.7, J.z), v3(2.5, 0.7, 0)),
        demo: () => ctx.pointer.simulateDrag(h, v3(2.5, 0, 0), { duration: 1100 }),
      });
    });
    ctx.hint(null);
    ctx.audio.play('good');
    await advance(ctx, main, main.total, () => 7);
    ctx.fx.sparkle({ x: J.x, z: J.z }, { size: 1.6 });
    await Promise.all([advance(ctx, b1, b1.total, () => 6), advance(ctx, b2, b2.total, () => 6)]);
    ctx.fx.sparkle({ x: V1.x, z: V1.z }, { size: 2 });
    ctx.fx.sparkle({ x: V2.x, z: V2.z }, { size: 2 });
    ctx.nudge('两个村都有水了，渠一共最省。', { kind: 'good' });
    ctx.hud.progress(3, 3);
    await ctx.wait(1500);
    void go; void dist;
    const stars = moves <= 12 ? 3 : moves <= 20 ? 2 : 1;
    ctx.complete({ stars });
  },
});
