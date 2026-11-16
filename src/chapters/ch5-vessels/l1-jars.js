// 5-1 谁装得多 · 高的不一定多
// 三组陶罐：高瘦 vs 矮胖、看着差很多其实一样多、看着差不多其实差一倍。
// 每组：先点选谁装得多 → 把两个罐子分别拖到旁边的量杯上倒 → 看水位、读杯数（1 杯 = 直径 1 步、高 1 步的圆筒，不是第 2 关起的「斗」）。
import { defineLevel } from '../../engine/level.js';
import { PALETTE } from '../../engine/palette.js';
import { cylVolume, toDou } from './math.js';
import { v3, C, wf } from './kit.js';
import { makeVessel, dragToPour, pour, makeDropRing } from './vessel.js';

const GROUPS = [
  { a: { r: 0.75, h: 4 }, b: { r: 1.25, h: 2.4 }, line: '矮胖的罐装得更多：粗一点，比高一点管用。' },
  { a: { r: 1, h: 1.5 }, b: { r: 0.5, h: 6 }, line: '一样多！高高瘦瘦的和矮矮胖胖的，装的一样多。' },
  { a: { r: 1.5, h: 8 / 3 }, b: { r: 1, h: 3 }, line: '左边的装得是右边的两倍，看着却差不多。' },
];
const CUP = { r: 1.15, h: 5 };
const XJAR = 7.4, XCUP = 3.3;

export default defineLevel({
  id: 'ch5-l1',
  title: '谁装得多',
  concept: '容积·高的不一定多',
  brief: '两个商人各拿一个陶罐来换粮，都说自己的罐子大。',
  discovery: '粗一点，比高一点管用得多。',

  async setup(ctx) {
    const { props } = ctx;
    props.ground({ w: 26, d: 12, seed: 51, river: null, trees: 6 });
    ctx.view.shadow({ x: 0, z: 0 }, 15);
    ctx.view.frame({ x: 0, z: 0.5 }, 8.8, { instant: true, y: 1.6 });
    const left = props.villager({ x: -10.6, z: -1.5, color: PALETTE.clay, face: 0.5 });
    const right = props.villager({ x: 10.6, z: -1.5, color: '#6F8FAF', face: -0.5 });
    let correct = 0;

    for (let gi = 0; gi < GROUPS.length; gi++) {
      ctx.hud.progress(gi, GROUPS.length);
      const G = GROUPS[gi];
      const mk = (spec, side) => {
        const jar = makeVessel(ctx, { kind: 'cyl', r: spec.r, h: spec.h, x: side * XJAR, z: 0, liquid: C.water, wall: side < 0 ? '#D9775F' : '#7FA3C4', opacity: 0.55 });
        jar.setVol(cylVolume(spec.r, spec.h));
        const cup = makeVessel(ctx, { kind: 'cyl', r: CUP.r, h: CUP.h, x: side * XCUP, z: 0, liquid: C.water, wall: '#CFE3EA', opacity: 0.42 });
        const ticks = [];
        for (let k = 5; k <= 25; k += 5) ticks.push({ h: k / (4 * CUP.r * CUP.r), major: k % 10 === 0 });
        cup.addTicks(ticks);
        const tl = [10, 20].map((k) => ctx.labels.add(v3(side * XCUP - side * 1.55, k / (4 * CUP.r * CUP.r), 0), String(k), { cls: 'soft', pop: false }));
        ctx.fx.pop(jar.group, { duration: 360 });
        ctx.fx.pop(cup.group, { duration: 360 });
        props.hitBox(spec.r * 2 + 0.7, spec.h + 0.4, spec.r * 2 + 0.7, jar.group);
        return { jar, cup, side, tl, dou: toDou(cylVolume(spec.r, spec.h)), spec };
      };
      const A = mk(G.a, -1), B = mk(G.b, 1);
      const nameA = ctx.labels.add(v3(A.jar.cx(), A.spec.h, 0), '左边的罐', { cls: 'tag', dy: 0.9 });
      const nameB = ctx.labels.add(v3(B.jar.cx(), B.spec.h, 0), '右边的罐', { cls: 'tag', dy: 0.9 });
      left.face({ x: A.jar.cx(), z: 0 });
      right.face({ x: B.jar.cx(), z: 0 });

      // ---- 先猜 ----
      const best = A.dou === B.dou ? 'S' : A.dou > B.dou ? 'L' : 'R';
      const pick = await ctx.choose({
        prompt: '先猜：哪个罐子装得多？',
        options: [{ label: '左边的罐', value: 'L' }, { label: '一样多', value: 'S' }, { label: '右边的罐', value: 'R' }],
        answer: best,
      });
      const guessed = pick === 'L' ? A.dou : pick === 'R' ? B.dou : Math.min(A.dou, B.dou);
      ctx.recordGuess('volume', guessed, Math.max(A.dou, B.dou), '杯', guessed / Math.max(A.dou, B.dou));
      if (pick === best) correct++;

      // ---- 倒进量杯 ----
      ctx.hud.task('把两个罐子分别拖到旁边的量杯上，倒进去看水位。');
      const sides = [A, B];
      sides.forEach((s) => {
        s.drop = makeDropRing(ctx, { x: s.cup.cx(), z: 0, r: 2.1 });
        s.done = false;
        s.finished = wf(ctx, (res) => { s.resolve = res; });
        s.handle = dragToPour(ctx, s.jar, s.cup, {
          near: 3.4, lift: 0.4, drop: s.drop,
          enabled: () => !s.done,
          onPour: async (home) => {
            await pour(ctx, s.jar, s.cup, { home });
            s.done = true;
            s.handle.enabled = false;
            const n = s.dou;
            ctx.audio.play('star');
            s.lbl = ctx.labels.add(v3(s.cup.cx(), CUP.h, 0), `${Math.round(n)}<small>杯</small>`, { cls: 'big', dy: 0.8 });
            ctx.fx.sparkle({ x: s.cup.cx(), z: 0 }, { size: 1.4 });
            s.resolve();
          },
        });
      });
      const next = () => sides.find((s) => !s.done);
      ctx.hint({
        text: '按住一个罐子，拖到它旁边的量杯上。',
        ghost: () => { const s = next(); return ctx.fx.ghostHand(v3(s.jar.cx(), 1.2, 0), v3(s.cup.cx(), 1.6, 0)); },
        demo: async () => {
          for (const s of sides) {
            if (s.done) continue;
            await ctx.pointer.simulateDrag(s.handle, v3(s.cup.cx(), 0, 0), { duration: 800 });
            await s.finished;
          }
        },
      });
      await Promise.all(sides.map((s) => s.finished));
      ctx.hint(null);
      await ctx.wait(500);
      const win = A.dou === B.dou ? null : A.dou > B.dou ? A : B;
      if (win) ctx.fx.sparkle({ x: win.cup.cx(), z: 0 }, { size: 2.2, color: '#9FE07A' });
      ctx.nudge(G.line, { kind: 'good' });
      (A.dou > B.dou ? left : A.dou < B.dou ? right : left).cheer();
      await ctx.wait(3000);

      // ---- 收拾，下一组 ----
      sides.forEach((s) => { s.handle.dispose(); s.lbl?.remove(); s.tl.forEach((l) => l.remove()); });
      nameA.remove(); nameB.remove();
      if (gi < GROUPS.length - 1) {
        sides.forEach((s) => { ctx.remove(s.jar.group); ctx.remove(s.cup.group); ctx.remove(s.drop.ring); });
        await ctx.wait(300);
      }
    }
    ctx.hud.progress(GROUPS.length, GROUPS.length);
    ctx.state.correct = correct;
    ctx.complete({ stars: correct >= 3 ? 3 : correct === 2 ? 2 : 1 });
  },
});
