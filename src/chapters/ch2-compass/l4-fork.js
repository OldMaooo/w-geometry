// 2-4 岔路中间修新路 · 角平分线
// 先凭眼睛拖一条路，量出偏了多少度；再用规：圆交两条路于两点 → 两点各画等圆 → 交点和城门连线。
import { defineLevel } from '../../engine/level.js';
import { PALETTE } from '../../engine/palette.js';
import { createBoard, roadStrip, v3 } from './kit.js';
import * as M from './math.js';

const O = { x: -7, z: 4 };
const TH1 = -1.08, TH2 = -0.17; // 两条路的方向角（弧度）
const D1 = { x: Math.cos(TH1), z: Math.sin(TH1) };
const D2 = { x: Math.cos(TH2), z: Math.sin(TH2) };
const LEN = 12;
const E1 = { x: O.x + D1.x * LEN, z: O.z + D1.z * LEN };
const E2 = { x: O.x + D2.x * LEN, z: O.z + D2.z * LEN };
const BIS = M.bisectorDir(O, E1, E2);
const deg = (r) => Math.round((Math.abs(r) * 180) / Math.PI);

export default defineLevel({
  id: 'ch2-l4',
  title: '岔路中间修新路',
  concept: '角平分线',
  brief: '两条大路在城门口岔开。要在正中间再修一条路，离两边一样远。',
  discovery: '新路正好把岔开的角对折：到两条路的角度一样大。',

  async setup(ctx) {
    const { props } = ctx;
    props.ground({ w: 26, d: 16, seed: 94, puddles: 0 });
    ctx.view.shadow({ x: -1, z: 0 }, 15);
    const board = createBoard(ctx, { bounds: { minX: -12, maxX: 12, minZ: -7.5, maxZ: 7.5 } });
    ctx.view.frame({ x: -2, z: 0 }, 10.5, { instant: true });
    roadStrip(ctx, O, E1, { width: 1.2 });
    roadStrip(ctx, O, E2, { width: 1.2 });
    board.addRoad(O, E1, [0, 1]);
    board.addRoad(O, E2, [0, 1]);
    board.addPoint('O', O, { name: '城门', cls: 'tag', h: 1.6, color: PALETTE.clay });

    // ---- 先试：凭眼睛 ----
    ctx.hud.progress(0, 2);
    ctx.hud.task('先凭眼睛试试：把金色的桩拖到两条路正中间。');
    const K = props.stake({ x: O.x + Math.cos(-0.9) * 7, z: O.z + Math.sin(-0.9) * 7, h: 0.9, color: PALETTE.gold });
    K.position.set(O.x + Math.cos(-0.35) * 7, 0, O.z + Math.sin(-0.35) * 7);
    props.hitBox(1.5, 1.4, 1.5, K);
    const eye = props.rope({ every: 1000, y: 0.45, color: '#F2B134' });
    eye.setPoints([O, { x: K.position.x, z: K.position.z }]);
    const tryOne = await ctx.waitFor((done) => {
      const h = ctx.pointer.draggable(K, {
        lift: 0.2, ringSize: 0.8, priority: 5,
        snap: (p) => { const a = Math.atan2(p.z - O.z, p.x - O.x); return v3(O.x + Math.cos(a) * 7, 0, O.z + Math.sin(a) * 7); },
        onMove: (p) => { K.position.set(p.x, 0, p.z); eye.setPoints([O, p]); },
        onEnd: (p, { moved }) => { if (moved) done(Math.atan2(p.z - O.z, p.x - O.x)); },
      });
      const tgt = M.onCircle(O, 7, Math.atan2(BIS.z, BIS.x) + 0.1);
      ctx.hint({
        text: '按住金色的桩，转到你觉得正中间的地方。',
        ghost: () => ctx.fx.ghostHand(v3(K.position.x, 0.5, K.position.z), v3(tgt.x, 0.5, tgt.z)),
        demo: () => ctx.pointer.simulateDrag(h, v3(tgt.x, 0, tgt.z), { duration: 800 }),
      });
    });
    ctx.hint(null);
    const a1 = deg(M.angleDiff(TH1, tryOne)), a2 = deg(M.angleDiff(TH2, tryOne));
    const dev = Math.abs(M.angleDiff(Math.atan2(BIS.z, BIS.x), tryOne));
    const l1 = ctx.labels.add(v3(O.x + Math.cos((TH1 + tryOne) / 2) * 3.6, 0.3, O.z + Math.sin((TH1 + tryOne) / 2) * 3.6), `${a1}°`, { cls: 'num' });
    const l2 = ctx.labels.add(v3(O.x + Math.cos((TH2 + tryOne) / 2) * 3.6, 0.3, O.z + Math.sin((TH2 + tryOne) / 2) * 3.6), `${a2}°`, { cls: 'num' });
    ctx.recordGuess('angle', a1, deg((TH2 - TH1) / 2), '度');
    ctx.nudge(deg(dev) <= 5 ? `眼力真准！只偏了 ${deg(dev)}°。` : `左右差了一些，偏了 ${deg(dev)}°。靠规能刚刚好。`);
    await ctx.wait(2800);
    l1.remove(); l2.remove(); ctx.remove(K); ctx.remove(eye.group);

    // ---- 用规 ----
    ctx.hud.progress(1, 2);
    const c0 = await board.circle({
      centers: ['O'],
      free: { min: 3, max: 8, start: 3, dir: -0.6, demoR: 5, check: (r) => (r >= 3 ? true : '再放长一点。') },
      texts: { radius: '以城门为心，绳子放长，让圆碰到两条路。', radiusHint: '按住金色的笔往外拖，让圆能碰到两条路。', turn: '拖着笔绕城门走一圈。' },
    });
    const p1 = await board.pickIntersection(c0.e, board.ents[0], { key: 'P1', name: null, text: '圆和这条路碰头的地方。点光点打桩。' });
    const p2 = await board.pickIntersection(c0.e, board.ents[1], { key: 'P2', name: null, text: '圆和另一条路碰头的地方。点光点打桩。' });
    const half = M.dist(p1.p, p2.p) / 2;
    const ca = await board.circle({
      centers: ['P1', 'P2'], tapCenter: true,
      free: { min: 2, max: 9, start: 2, dir: Math.atan2(BIS.z, BIS.x), demoR: Math.ceil(half + 1.2), check: (r) => (r > half + 0.3 ? true : '绳子太短，两个圆碰不到。再放长一点。') },
      texts: { center: '圆规脚扎在一个新桩上。点它。', radius: '绳子放长，一会儿两个圆要碰头。', radiusHint: '按住金色的笔往外拖到够长。', turn: '拖着笔绕桩走一圈。' },
    });
    const otherK = ca.centerKey === 'P1' ? 'P2' : 'P1';
    const cb = await board.circle({ centers: [otherK], fixedR: ca.r, texts: { turn: '绳长不变，在另一个桩上也画一圈。' } });
    await board.pickIntersection(ca.e, cb.e, { key: 'Q', name: null, text: '两个新圆碰头的地方。点光点打桩。' });
    // 新路：从城门出发，朝角的正中间
    ctx.hud.task('从城门拉一条直绳，到这根新桩。');
    const [k1, k2] = await board.pickPair([['O', 'Q']], { first: '点城门。', second: '再点新桩，把绳拉直。' });
    const Q = board.P('Q');
    await board.drawLine(board.P('O'), { x: O.x + BIS.x * 10, z: O.z + BIS.z * 10 }, { ray: true });
    const road = roadStrip(ctx, O, { x: O.x + BIS.x * 11, z: O.z + BIS.z * 11 }, { width: 1.2, color: '#F2D58A' });
    ctx.fx.pop(road, { duration: 400 });
    void k1; void k2; void Q;
    const mk = (th) => v3(O.x + Math.cos((th + Math.atan2(BIS.z, BIS.x)) / 2) * 4, 0.3, O.z + Math.sin((th + Math.atan2(BIS.z, BIS.x)) / 2) * 4);
    const half1 = deg(M.angleBetweenDeg(BIS, D1) * Math.PI / 180);
    ctx.labels.add(mk(TH1), `${half1}°`, { cls: 'num ok' });
    ctx.labels.add(mk(TH2), `${half1}°`, { cls: 'num ok' });
    ctx.audio.play('success');
    ctx.hud.task('新路修好了。');
    ctx.nudge('新路和两条路的角一样大。', { kind: 'good' });
    await ctx.wait(2400);
    const u = ctx.hintsUsed;
    ctx.complete({ stars: u === 0 ? 3 : u < 3 ? 2 : 1 });
  },
});
