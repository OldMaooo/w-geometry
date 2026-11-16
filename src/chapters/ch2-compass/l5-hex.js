// 2-5 六角亭 · 一根绳长绕一圈正好六次
// 先猜量几次回到起点；画圆；拖一根桩到圆上；圆规脚一站一站地摆过去，打六下。亭子立起来，再连出三角和六角星。
import * as THREE from 'three';
import { defineLevel } from '../../engine/level.js';
import { PALETTE } from '../../engine/palette.js';
import { mat } from '../../engine/shared.js';
import { createBoard, createTrace, busy, v3 } from './kit.js';
import * as M from './math.js';

const O = { x: 0, z: 0.5 };
const R = 4;

export default defineLevel({
  id: 'ch2-l5',
  title: '六角亭',
  concept: '半径绕圆六次',
  brief: '广场要盖六角亭，六根柱子要均匀地立在一个圆上。',
  discovery: '一根半径的绳长，在圆上正好走六步。蜂窝、雪花都是六角的。',

  async setup(ctx) {
    const { props } = ctx;
    props.ground({ w: 22, d: 14, seed: 15, puddles: 0 });
    ctx.view.shadow(O, 12);
    const board = createBoard(ctx, { bounds: { minX: -10, maxX: 10, minZ: -6.5, maxZ: 6.5 } });
    ctx.view.frame(O, 7.2, { instant: true });
    board.addPoint('O', O, { name: null, h: 1.1 });

    // ---- 先猜 ----
    const demo = props.rope({ points: [O, { x: O.x + R, z: O.z }], y: 0.4 });
    ctx.hud.task('这根绳长和画圆的绳一样。');
    const g = await ctx.choose({
      prompt: '用这根绳长在圆上一段一段量，量几次能回到起点？',
      options: [4, 5, 6, 7, 8].map((n) => ({ label: `${n} 次`, value: n })),
      answer: 6,
    });
    // 「几次」是个数数，不是长度，不记进眼力
    ctx.remove(demo.group);

    // ---- 画圆 ----
    ctx.hud.progress(0, 3);
    const c = await board.circle({
      centers: ['O'], fixedR: R, dir: -2.3,
      texts: { turn: '拖着笔绕桩走一圈，画出柱子要站的圆。', turnHint: '按住金色的笔，绕着桩走一整圈。' },
    });

    // ---- 第一根桩：拖到圆上 ----
    ctx.hud.progress(1, 3);
    ctx.hud.task('把金色的桩拖到圆上，随便哪里都行。');
    const seed = props.stake({ x: 7, z: 3, h: 0.9, color: PALETTE.gold });
    props.hitBox(1.5, 1.4, 1.5, seed);
    const a0 = await ctx.waitFor((done) => {
      let ang = null;
      const h = ctx.pointer.draggable(seed, {
        lift: 0.2, ringSize: 0.8, priority: 5,
        snap: (p) => {
          const d = Math.hypot(p.x - O.x, p.z - O.z);
          if (Math.abs(d - R) < 1.3) { const a = Math.atan2(p.z - O.z, p.x - O.x); ang = a; return v3(O.x + R * Math.cos(a), 0, O.z + R * Math.sin(a)); }
          ang = null; return p;
        },
        onMove: (p) => seed.position.set(p.x, 0, p.z),
        onEnd: async () => {
          if (ang !== null) { h.dispose(); done(ang); return; }
          ctx.nudge('要放在圆上。');
          await ctx.fx.to(seed.position, { x: 7, z: 3 }, 300);
        },
      });
      const t = M.onCircle(O, R, -1.2);
      ctx.hint({
        text: '把金色的桩拖到圆线上。',
        ghost: () => ctx.fx.ghostHand(v3(7, 0.5, 3), v3(t.x, 0.5, t.z)),
        demo: () => ctx.pointer.simulateDrag(h, v3(t.x, 0, t.z), { duration: 800 }),
      });
    });
    ctx.hint(null);
    ctx.remove(seed);
    const P0 = M.onCircle(O, R, a0);
    const rec0 = board.addPoint('P0', P0, { name: null });
    ctx.audio.play('place');

    // ---- 一步一步量 ----
    ctx.hud.progress(2, 3);
    const P = [P0];
    for (let k = 0; k < 6; k++) {
      const pk = P[k];
      const start = k === 0 ? O : P[k - 1];
      let cands = M.circleCircle(pk, R, O, R);
      if (k > 0) cands = cands.filter((q) => M.dist(q, P[k - 1]) > 0.1);
      else cands = cands; // 第一步两边都行
      const res = await board.compass({
        C: pk, r: R, start, mode: 'arc', cands, trace: { glow: '#BFE3F5' },
        texts: { turn: k === 0 ? '圆规脚站在桩上，绳长不变。把笔摆到圆上发亮的点。' : '圆规脚挪到新桩上，再往前摆一步。', turnHint: '按住金色的笔，沿弧摆到发亮的点，松手。', miss: '把笔摆到发亮的那一点上再松手。' },
      });
      if (k < 5) {
        board.addPoint(`P${k + 1}`, res.cand, { name: String(k + 1), cls: 'num lit' });
        P.push(res.cand);
      } else rec0.label = ctx.labels.add(rec0.obj, '6', { cls: 'num lit', dy: 1.1 });
      ctx.audio.play('count', { n: k });
      ctx.fx.sparkle(res.cand, { size: 0.8 });
      await ctx.wait(250);
    }
    ctx.hud.task('量了 6 次，正好回到起点。');
    ctx.nudge('量了 6 次，正好回到起点！', { kind: 'good' });
    await ctx.wait(1600);

    // ---- 亭子立起来 ----
    const phi0 = Math.atan2(P0.z - O.z, P0.x - O.x);
    const rot = Math.PI / 2 - phi0;
    const floor = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 0.12, 6), mat(PALETTE.stone));
    floor.position.set(O.x, 0.06, O.z); floor.rotation.y = rot; floor.receiveShadow = true;
    ctx.add(floor);
    ctx.fx.pop(floor, { duration: 500 });
    const H = 3;
    for (const q of P) {
      const pil = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, H, 8), mat(PALETTE.clay));
      pil.position.set(q.x, H / 2 + 0.1, q.z);
      pil.castShadow = true;
      ctx.add(pil);
      ctx.fx.sprout(pil, { duration: 600, delay: 150 });
    }
    ctx.audio.play('grow', { n: 6 });
    ctx.view.frame(O, 8.5, { yaw: 342 });
    await busy(ctx, ctx.wait(1300));
    const roof = new THREE.Mesh(new THREE.ConeGeometry(R * 1.2, 1.5, 6), mat('#8E5B3A'));
    roof.position.set(O.x, H + 0.1 + 0.75, O.z); roof.rotation.y = rot; roof.castShadow = true;
    ctx.add(roof);
    ctx.fx.pop(roof, { duration: 600 });
    ctx.audio.play('success');
    await busy(ctx, ctx.wait(1500));

    // ---- 加戏：隔一个连一个 ----
    ctx.hud.task('把六根柱子隔一个连一个。');
    await ctx.fx.to(roof.scale, { x: 0.001, y: 0.001, z: 0.001 }, 500, { ease: 'in' });
    ctx.view.frame(O, 7.5, { yaw: -18, pitch: 70 });
    await ctx.wait(700);
    for (const set of [[0, 2, 4, 0], [1, 3, 5, 1]]) {
      const tr = createTrace(ctx, { y0: 0.09, glow: '#FFE08A' });
      const pts = set.map((i) => P[i]);
      ctx.audio.play('whoosh');
      await ctx.fx.tween({
        duration: 900, ease: 'inOut', onUpdate: (kk) => {
          const f = kk * 3; const out = [pts[0]];
          for (let s = 0; s < 3; s++) { const t = Math.min(1, Math.max(0, f - s)); if (t > 0) out.push({ x: pts[s].x + (pts[s + 1].x - pts[s].x) * t, z: pts[s].z + (pts[s + 1].z - pts[s].z) * t }); }
          tr.setPoints(out);
        },
      });
      await ctx.wait(350);
    }
    ctx.nudge('隔一个连一个是三角形，两个叠起来是六角星。', { kind: 'good' });
    await ctx.wait(2200);
    // 结算前：屋顶盖回去，镜头换成斜视角、偏到左边，让立起来的亭子露在结算面板旁边
    ctx.view.frame(O, 12.5, { yaw: -26, pitch: 30, y: 1.2, left: 0.66 });
    await ctx.fx.to(roof.scale, { x: 1, y: 1, z: 1 }, 600, { ease: 'out' });
    await ctx.wait(500);
    ctx.complete({ stars: g === 6 ? 3 : 2, delay: 900 });
  },
});
