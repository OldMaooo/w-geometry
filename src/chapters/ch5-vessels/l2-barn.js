// 5-2 方仓 · 底面几块 × 几层
// 4×3×3：先猜，倒谷，谷子一层一层升上来，每满一层侧面亮一条刻度并报「12、24、36」。
// 5×4×2：先猜；只倒满第一层就问总数；再倒满验证。最后两座并排：高 3 的不一定比高 2 的装得多。
import * as THREE from 'three';
import { defineLevel } from '../../engine/level.js';
import { PALETTE } from '../../engine/palette.js';
import { v3, C, lineMat, wf } from './kit.js';
import { makeVessel, makeSack, dragToPour, pour, makeDropRing } from './vessel.js';

const BARNS = [
  { w: 4, d: 3, h: 3, x: -4.6, guess: { max: 60, start: 20 } },
  { w: 5, d: 4, h: 2, x: 4.6, guess: { max: 80, start: 30 } },
];

/** 仓底一格一格的线。 */
function floorGrid(parent, w, d) {
  const pts = [];
  for (let i = 0; i <= w; i++) pts.push(new THREE.Vector3(-w / 2 + i, 0.075, -d / 2), new THREE.Vector3(-w / 2 + i, 0.075, d / 2));
  for (let j = 0; j <= d; j++) pts.push(new THREE.Vector3(-w / 2, 0.075, -d / 2 + j), new THREE.Vector3(w / 2, 0.075, -d / 2 + j));
  const g = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), lineMat('#7A5A36', 0.75));
  parent.add(g);
  return g;
}

export default defineLevel({
  id: 'ch5-l2',
  title: '方仓',
  concept: '容积·底面几块 × 几层',
  brief: '方粮仓长 4 步、宽 3 步、高 3 步，一个方块是 1 斗。能装多少斗？',
  discovery: '和搭台基是一回事：台基是实心的，粮仓是空心的。',

  async setup(ctx) {
    const { props } = ctx;
    props.ground({ w: 26, d: 12, seed: 52, river: null, trees: 6 });
    ctx.view.shadow({ x: 0, z: 0 }, 15);
    ctx.view.frame({ x: BARNS[0].x + 1.5, z: 0 }, 7.8, { instant: true, y: 1.2 });
    const apprentice = props.villager({ x: 0, z: 3.4, color: '#8E7AB5', face: 0 });
    const accs = [];
    const done = [];

    for (let bi = 0; bi < BARNS.length; bi++) {
      ctx.hud.progress(bi, BARNS.length);
      const B = BARNS[bi];
      const A = B.w * B.d;
      const total = A * B.h;
      const barn = makeVessel(ctx, { kind: 'box', w: B.w, d: B.d, h: B.h, x: B.x, z: 0, liquid: C.grain, wall: '#C99B5A', opacity: 0.3, inset: 0.97 });
      floorGrid(barn.group, B.w, B.d);
      barn.addTicks(Array.from({ length: B.h }, (_, k) => ({ h: k + 1, major: true, base: '#7A5A36' })));
      ctx.fx.pop(barn.group, { duration: 420 });
      const side = bi === 0 ? -1 : 1;
      const sack = makeSack(ctx, { x: B.x + side * (B.w / 2 + 3.4), z: 0 });
      ctx.fx.pop(sack.group, { duration: 360 });
      props.hitBox(1.7, 2, 1.7, sack.group);
      ctx.view.frame({ x: B.x - side * 1.4, z: 0 }, 8, { y: 1.2 });
      apprentice.group.position.x = B.x;
      apprentice.face({ x: B.x, z: 0 });

      // ---- 谷子升到哪一层，就亮哪一条刻度、报数 ----
      const lit = new Set();
      const lblLayers = [];
      barn.onVol = (vol, prev) => {
        for (let k = 1; k <= B.h; k++) {
          if (lit.has(k)) continue;
          if (prev < A * k - 1e-6 && vol >= A * k - 1e-6) {
            lit.add(k);
            barn.lightTick(k - 1, true);
            ctx.audio.play('count', { n: k * 2 });
            ctx.fx.sparkle({ x: B.x, z: 0 }, { size: Math.max(B.w, B.d) * 0.7 });
            lblLayers.push(ctx.labels.add(v3(B.x + B.w / 2 + 0.2, k, B.d / 2), `${A * k}`, { cls: 'num lit', dy: 0.1 }));
            ctx.say(`${A * k}`);
          }
        }
      };

      // ---- 先猜 ----
      if (bi === 1) ctx.hud.task('这座低一点，但是宽一点。先猜猜能装几斗？');
      const g = await ctx.guess({ kind: 'volume', actual: total, prompt: '先猜：能装多少斗？', min: 1, max: B.guess.max, start: B.guess.start, unit: '斗' });
      accs.push(ctx.geo.guessAccuracy(g, total));
      const drop = makeDropRing(ctx, { x: B.x, z: 0, r: B.w / 2 + 1.1 });

      // ---- 倒谷 ----
      ctx.hud.task(bi === 0 ? '把谷袋拖到仓上，倒进去。' : '这次，先只倒满第一层。');
      let handle;
      const onePour = (amount, flowMs) => wf(ctx, (resolve) => {
        handle.enabled = true;
        handle.onPourDone = resolve;
        handle.amount = amount;
        handle.flowMs = flowMs;
      });
      handle = dragToPour(ctx, sack, barn, {
        near: 3.8, lift: 0.4, drop,
        onPour: async (home) => {
          await pour(ctx, sack, barn, { home, amount: handle.amount, flowMs: handle.flowMs });
          handle.enabled = false;
          handle.onPourDone?.();
        },
      });
      const partial = bi === 1;
      let wait1 = onePour(partial ? A : Infinity, partial ? 2200 : 4800);
      ctx.hint({
        text: '按住谷袋，拖到粮仓上面。',
        ghost: () => ctx.fx.ghostHand(v3(sack.cx(), 1, 0), v3(B.x, 1.5, 0)),
        demo: async () => {
          await ctx.pointer.simulateDrag(handle, v3(B.x, 0, 0), { duration: 800 });
          await wait1;
        },
      });
      await wait1;
      ctx.hint(null);
      await ctx.wait(700);

      if (partial) {
        // 只倒了一层，问总数
        const opts = [30, 40, 50, 60].map((v) => ({ label: String(v), value: v }));
        const ans = await ctx.choose({ prompt: `这一层有 ${A} 斗，仓高 ${B.h} 层。一共几斗？`, options: opts, answer: total });
        ctx.recordGuess('volume', ans, total, '斗');
        ctx.nudge(ans === total ? '对！每层 20 斗，两层。' : '倒倒看，数一数。', { kind: ans === total ? 'good' : 'soft' });
        await ctx.wait(900);
        wait1 = onePour(Infinity, 2400);
        ctx.hint({
          text: '再把谷袋拖到仓上，倒满。',
          ghost: () => ctx.fx.ghostHand(v3(sack.cx(), 1, 0), v3(B.x, 1.5, 0)),
          demo: async () => { await ctx.pointer.simulateDrag(handle, v3(B.x, 0, 0), { duration: 800 }); await wait1; },
        });
        ctx.hud.task('再倒满，看看对不对。');
        await wait1;
        ctx.hint(null);
        await ctx.wait(500);
      }
      handle.dispose();
      ctx.remove(drop.ring);
      ctx.audio.play('star');
      const big = ctx.labels.add(v3(B.x, B.h, 0), `${total}<small>斗</small>`, { cls: 'big', dy: 0.9 });
      lblLayers.forEach((l) => l.remove());
      const how = ctx.labels.add(v3(B.x, 0, B.d / 2), `${A} 块 × ${B.h} 层`, { cls: 'tag', dy: -0.1 });
      apprentice.cheer();
      ctx.say(`${A} 块乘 ${B.h} 层，${total} 斗`);
      done.push({ barn, big, how });
      await ctx.wait(2200);
      ctx.remove(sack.group);
    }

    // ---- 小老师：高的不一定多 ----
    ctx.hud.progress(2, 2);
    ctx.view.frame({ x: 0, z: 0 }, 11.5, { y: 1.2 });
    ctx.hud.task('学徒说：高 3 的仓，一定比高 2 的装得多。');
    const say = ctx.labels.add(v3(apprentice.group.position.x, 0, 3.4), '高 3 层的，一定装得多吧？', { cls: 'say', dy: 2.2 });
    apprentice.group.position.x = 0;
    apprentice.face({ x: 0, z: 0 });
    await ctx.wait(2600);
    say.remove();
    done.forEach((d) => ctx.fx.sparkle({ x: d.barn.cx(), z: 0 }, { size: 3, color: '#9FE07A' }));
    ctx.nudge('36 斗对 40 斗：底面铺得多，装得就多。', { kind: 'good' });
    await ctx.wait(2800);
    done.forEach((d) => { d.big.remove(); d.how.remove(); });
    const mean = accs[1];
    ctx.complete({ stars: mean >= 0.9 ? 3 : mean >= 0.7 ? 2 : 1 });
  },
});
