// 2-6 找回玉璧的圆心（本章大关）
// 先凭眼睛点圆心；再在残片边上打三根桩，作两条中垂线，交点就是圆心；以它为心画圆，玉璧补全。
import * as THREE from 'three';
import { defineLevel } from '../../engine/level.js';
import { PALETTE } from '../../engine/palette.js';
import { mat } from '../../engine/shared.js';
import { createBoard, createTrace, arcBand, arcPoints, busy, v3 } from './kit.js';
import * as M from './math.js';

const K = { x: 0.5, z: 1.5 };
const R = 5.5;
const D = Math.PI / 180;
const PHI1 = -140 * D, PHI2 = -40 * D;
const JADE = '#6FBF9B';
const TRAY = [{ x: 7, z: -1.5 }, { x: 7, z: 0.5 }, { x: 7, z: 2.5 }];
const NAMES = ['A', 'B', 'C'];

export default defineLevel({
  id: 'ch2-l6',
  title: '找回玉璧的圆心',
  concept: '中垂线·圆心',
  brief: '挖出一块碎了的大玉璧，只剩一段弧。圆心在哪，才能补全？',
  discovery: '到 A、B 一样远的在一条线上，到 B、C 一样远的在另一条线上。两条线碰头的地方，到三个点都一样远。',

  async setup(ctx) {
    const { props } = ctx;
    props.ground({ w: 22, d: 16, seed: 36, puddles: 0 });
    ctx.view.shadow({ x: 1, z: 1.5 }, 13);
    const board = createBoard(ctx, { bounds: { minX: -9.5, maxX: 9.5, minZ: -7, maxZ: 8 } });
    ctx.view.frame({ x: 1, z: 1.5 }, 8.6, { instant: true });
    const frag = arcBand(R, 1.0, PHI1, PHI2, 0.25, JADE);
    frag.position.set(K.x, 0.02, K.z);
    ctx.add(frag);
    ctx.fx.pop(frag, { duration: 500 });
    const M0 = M.onCircle(K, R, -Math.PI / 2);

    // ---- 先试：凭眼睛点圆心 ----
    ctx.hud.progress(0, 3);
    ctx.hud.task('先凭眼睛试试：把金色的桩拖到你觉得是圆心的地方。');
    const G = props.stake({ x: -6, z: 5, h: 0.9, color: PALETTE.gold });
    props.hitBox(1.5, 1.4, 1.5, G);
    await ctx.waitFor((done) => {
      const h = ctx.pointer.draggable(G, {
        lift: 0.2, ringSize: 0.8, priority: 5,
        onMove: (p) => G.position.set(p.x, 0, p.z),
        onEnd: (p, { moved }) => { if (moved) done(); },
      });
      ctx.hint({
        text: '圆心在弧的里面。拖一拖，估一个位置。',
        ghost: () => ctx.fx.ghostHand(v3(-6, 0.5, 5), v3(1.8, 0.5, 3.1)),
        demo: () => ctx.pointer.simulateDrag(h, v3(1.8, 0, 3.1), { duration: 900 }),
      });
    });
    ctx.hint(null);
    const Gp = { x: G.position.x, z: G.position.z };
    const rg = M.dist(Gp, M0);
    const guessTr = createTrace(ctx, { groove: '#4F7DA0', glow: '#BFE3F5', y0: 0.04 });
    guessTr.setPoints(arcPoints(Gp, rg, 0, M.TAU));
    ctx.recordGuess('length', rg, R, '步');
    ctx.audio.play('soft');
    ctx.nudge(M.dist(Gp, K) < 0.6 ? '好准！圆和玉片几乎对上了。' : '圆和玉片对不上。有办法找准圆心吗？');
    await ctx.wait(2800);
    ctx.remove(G); ctx.remove(guessTr.group);

    // ---- 在弧上打三根桩 ----
    ctx.hud.progress(1, 3);
    ctx.hud.task('把三根桩拖到玉片的边上，彼此隔远一点。');
    const placed = [];
    const clampPhi = (a) => Math.min(PHI2 - 8 * D, Math.max(PHI1 + 8 * D, a));
    for (let i = 0; i < 3; i++) {
      const T = props.stake({ x: TRAY[i].x, z: TRAY[i].z, h: 0.9, color: PALETTE.gold });
      props.hitBox(1.5, 1.4, 1.5, T);
      ctx.fx.pop(T);
      const target = M.onCircle(K, R, [-125 * D, -90 * D, -55 * D][i]);
      const pos = await ctx.waitFor((done) => {
        let ok = null;
        const h = ctx.pointer.draggable(T, {
          lift: 0.2, ringSize: 0.8, priority: 5,
          snap: (p) => {
            const a = Math.atan2(p.z - K.z, p.x - K.x);
            const q = M.onCircle(K, R, clampPhi(a));
            if (M.dist(p, q) < 1.6) { ok = q; return v3(q.x, 0, q.z); }
            ok = null; return p;
          },
          onMove: (p) => T.position.set(p.x, 0, p.z),
          onEnd: async () => {
            if (ok && placed.every((q) => M.dist(q, ok) >= 2)) { h.dispose(); done(ok); return; }
            ctx.nudge(ok ? '离别的桩远一点。' : '放在玉片的边上。');
            await ctx.fx.to(T.position, { x: TRAY[i].x, z: TRAY[i].z }, 300);
          },
        });
        ctx.hint({
          text: '把金色的桩拖到玉片的边上。',
          ghost: () => ctx.fx.ghostHand(v3(TRAY[i].x, 0.5, TRAY[i].z), v3(target.x, 0.5, target.z)),
          demo: () => ctx.pointer.simulateDrag(h, v3(target.x, 0, target.z), { duration: 800 }),
        });
      });
      ctx.hint(null);
      ctx.remove(T);
      placed.push(pos);
      board.addPoint(NAMES[i], pos, { name: NAMES[i] });
      ctx.audio.play('place');
    }

    // ---- 两条中垂线 ----
    ctx.hud.progress(2, 3);
    const allPairs = [['A', 'B'], ['B', 'C'], ['A', 'C']];
    const lines = [];
    let pairs = allPairs;
    for (let n = 0; n < 2; n++) {
      const [k1, k2] = await board.pickPair(pairs, {
        first: '点一根桩。圆规会替你作出「到两根桩一样远」的线。',
        second: '再点另一根桩。',
        firstTask: n === 0 ? '选两根桩：画出到它们一样远的线。' : '再选另一对桩，再画一条。',
      });
      lines.push(await board.bisectByCompass(k1, k2));
      ctx.audio.play('good');
      pairs = pairs.filter((p) => !(p.includes(k1) && p.includes(k2)));
    }
    await board.pickIntersection(lines[0], lines[1], { key: 'K', name: null, h: 1.2, color: PALETTE.gold, text: '两条线碰头的地方，到三根桩一样远。点光点打桩。' });
    ctx.nudge('这就是圆心！', { kind: 'good' });
    await ctx.wait(1300);

    // ---- 画圆补全 ----
    ctx.hud.progress(3, 3);
    const c = await board.circle({
      centers: ['K'], through: () => NAMES,
      texts: { through: '绳子另一头系在玉片边上的任意一根桩上。点它。', turn: '拖着笔绕圆心走一圈，补全玉璧。', turnHint: '按住金色的笔，绕着圆心走一整圈。' },
    });
    const rest = arcBand(R, 1.0, PHI2, PHI1 + M.TAU, 0.25, new THREE.MeshLambertMaterial({ color: '#9BE3C0', emissive: '#2E7A58' }));
    rest.position.set(K.x, 0.02, K.z);
    ctx.add(rest);
    ctx.audio.play('success');
    ctx.hud.task('玉璧补全了！');
    await busy(ctx, ctx.fx.pop(rest, { duration: 900 }));
    ctx.view.frame({ x: 0.5, z: 1.5 }, 10, { pitch: 55 });
    await ctx.wait(1800);
    const u = ctx.hintsUsed;
    ctx.complete({ stars: u === 0 ? 3 : u < 3 ? 2 : 1, delay: 1300 });
  },
});
