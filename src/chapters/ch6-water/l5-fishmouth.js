// 6-5 鱼嘴分水 · 按比例分
// 一条渠的水要分给几个村。拖渠中间的「鱼嘴」，改各条分渠的口宽（总宽 6）；点「放水」，各块田的水位上涨：
// 分得公平，田同时浇透；不公平，一块淹了，另一块还干着。田大几倍，口子就开宽几倍。
import * as THREE from 'three';
import { defineLevel } from '../../engine/level.js';
import { widthsFromCuts, fillLevels, isFair } from './math.js';
import { makeChannel, advance, makeField } from './flow.js';
import { v3, C, block, exposeScreen, chapterStyles, makeHit, go, dur } from './kit.js';
import { makeReservoir } from './flow.js';

export const TOTAL = 6;
const ZS = -2.2; // 分水处

export async function splitRound(ctx, { names, areas, fields, cuts0, sol, intro, build }) {
  const { props, geo } = ctx; void props; void geo;
  const n = areas.length;
  const Rg = ctx.add(new THREE.Group());
  const fs = fields.map((f, i) => (build ? build(f, i) : makeField(ctx, { ...f, seed: 10 + i })));
  const tags = fs.map((f, i) => ctx.labels.add(v3(f.inlet.x, 0.5, f.inlet.z - 0.3), `${names[i]}　${areas[i]}<small>块</small>`, { cls: 'tag', pop: false }));
  const main = makeChannel(ctx, { parent: Rg, width: TOTAL - 0.3, wall: 0.16 });
  main.setPath([{ x: 0, y: 0.1, z: -8 }, { x: 0, y: 0.1, z: ZS }]);
  const branches = Array.from({ length: n }, () => makeChannel(ctx, { parent: Rg, width: 1, wall: 0.1 }));
  const cuts = [...cuts0];
  const wedges = cuts.map((c, i) => {
    const w = new THREE.Group();
    const m = block('#C9C2B2', 1, 0.7, 1, { parent: w });
    m.rotation.y = Math.PI / 4;
    m.scale.set(0.95, 0.7, 0.95);
    const hit = makeHit(w);
    hit.scale.set(1.6, 1.2, 1.6);
    w.position.set(-3 + c, 0, ZS);
    Rg.add(w);
    return w;
  });
  const widths = () => widthsFromCuts(cuts, TOTAL);
  const wl = [];
  function layout() {
    const ws = widths();
    let x = -3;
    ws.forEach((w, i) => {
      const cx = x + w / 2;
      const f = fs[i];
      const fx = f.inlet.x;
      branches[i].setWidth(Math.max(0.5, w - 0.3));
      branches[i].setPath([
        { x: cx, y: 0.1, z: ZS }, { x: cx, y: 0.1, z: 1.6 }, { x: fx, y: 0.1, z: 1.6 }, { x: fx, y: 0.1, z: f.inlet.z },
      ]);
      wl[i]?.remove();
      wl[i] = ctx.labels.add(v3(cx, 0.7, ZS + 1.3), `${w}`, { cls: 'num lit', pop: false });
      x += w;
    });
    wedges.forEach((wg, i) => { wg.position.x = -3 + cuts[i]; });
  }
  layout();
  ctx.state.widths = widths().join(':');
  ctx.hud.task(intro);

  let busy = false, tries = 0;
  const handles = wedges.map((wg, i) => ctx.pointer.draggable(wg, {
    ringSize: 0.9, lift: 0, radius: 56,
    snap: (p) => {
      const lo = (cuts[i - 1] ?? 0) + 1, hi = (cuts[i + 1] ?? TOTAL) - 1;
      p.x = Math.max(-3 + lo, Math.min(-3 + hi, Math.round(p.x)));
      p.z = ZS;
      return p;
    },
    onMove: (p) => {
      const c = Math.round(p.x + 3);
      if (c !== cuts[i]) { cuts[i] = c; layout(); ctx.state.widths = widths().join(':'); }
    },
  }));
  const lock = (on) => handles.forEach((h) => { h.enabled = !on; });

  const done = ctx.waitFor((resolve) => {
    const tool = ctx.hud.tool({ icon: 'waves', label: '放水', primary: true, onTap: () => { if (!busy) go(release()); } });
    async function release() {
      busy = true; ctx.state.busy = true; lock(true); tries++;
      const ws = widths();
      const levels = fillLevels(ws, areas);
      main.setFront(0); branches.forEach((b) => b.setFront(0));
      ctx.audio.play('whoosh');
      await advance(ctx, main, main.total, () => 6);
      await Promise.all(branches.map((b) => advance(ctx, b, b.total, () => 6)));
      const T = 4200;
      await go(ctx.fx.tween({
        duration: dur(ctx, T), ease: 'linear',
        onUpdate: (k) => fs.forEach((f, i) => f.setLevel(levels[i] * k)),
      }));
      if (isFair(levels)) {
        ctx.audio.play('success');
        fs.forEach((f) => ctx.fx.sparkle(f.center(), { size: 2.4 }));
        tool.remove();
        resolve(tries);
        return;
      }
      const hi = levels.indexOf(Math.max(...levels)), lo = levels.indexOf(Math.min(...levels));
      ctx.nudge(`${names[hi]}的田淹了，${names[lo]}的田还干着。`);
      ctx.fx.wobble(wedges[0]);
      await ctx.wait(1700);
      await go(ctx.fx.tween({
        duration: dur(ctx, 700), ease: 'in',
        onUpdate: (k) => { fs.forEach((f, i) => f.setLevel(levels[i] * (1 - k))); branches.forEach((b) => b.setFront(b.total * (1 - k))); main.setFront(main.total * (1 - k)); },
      }));
      fs.forEach((f) => { f.setLevel(0); f.drainFlood(); });
      main.setFront(0); branches.forEach((b) => { b.setFront(0); b.setFlowing(false); });
      main.setFlowing(false);
      busy = false; ctx.state.busy = false; lock(false);
    }
    ctx.hint({
      text: '田大几倍，口子就开宽几倍。拖鱼嘴，再点「放水」。',
      ghost: () => ctx.fx.ghostHand(v3(wedges[0].position.x, 0.6, ZS), v3(-3 + sol[0], 0.6, ZS)),
      demo: async () => {
        for (let i = 0; i < wedges.length; i++) {
          const from = cuts[i];
          await go(ctx.fx.tween({ duration: dur(ctx, 500), ease: 'inOut', onUpdate: (k) => { cuts[i] = Math.round(from + (sol[i] - from) * k); layout(); } }));
          cuts[i] = sol[i]; layout();
        }
        await ctx.wait(300);
        tool.tap();
        await ctx.wait(600);
      },
    });
  });
  const t = await done;
  ctx.hint(null);
  fs.forEach((f) => f.grow({ stagger: 8 }));
  await ctx.wait(2600);
  ctx.nudge('同时浇透，公平！', { kind: 'good' });
  await ctx.wait(1200);
  return { tries: t, hideLabels() { wl.forEach((l) => l?.remove()); tags.forEach((l) => l.remove()); }, cleanup() {
    wl.forEach((l) => l?.remove()); tags.forEach((l) => l.remove());
    main.dispose(); branches.forEach((b) => b.dispose()); ctx.remove(Rg); fs.forEach((f) => f.dispose());
    ctx.state.widths = '';
  } };
}

export default defineLevel({
  id: 'ch6-l5',
  title: '鱼嘴分水',
  concept: '按比例分配',
  brief: '一条渠的水，要分给两个村。东村的田是西村的 2 倍大，水怎么分才公平？',
  discovery: '田大几倍，口子就开宽几倍。',

  async setup(ctx) {
    exposeScreen(ctx);
    chapterStyles(ctx);
    const { props, geo } = ctx;
    props.ground({ w: 30, d: 18, z: 1, seed: 65, river: null, trees: 8, cells: false });
    ctx.view.shadow({ x: 0, z: 1 }, 19);
    ctx.view.frame({ x: 0, z: 1.2 }, 11.2, { instant: true, pitch: 56, yaw: 0 });
    makeReservoir(ctx, { x: 0, z: -9.2, w: 6.4, d: 2.4, y: 0.5 });
    ctx.hud.progress(0, 2);
    let firstTries = 0;

    // ---- 先猜
    const way = await ctx.choose({
      prompt: '先猜：东村的田是西村的 2 倍大，水怎么分？',
      options: [{ label: '对半分', value: 'half' }, { label: '东 2 西 1', value: 'e2' }, { label: '东 3 西 1', value: 'e3' }],
      answer: 'e2',
    });
    ctx.recordGuess('area', way === 'e2' ? 2 : way === 'half' ? 1 : 3, 2, '倍', way === 'e2' ? 1 : 0.5);
    const r1 = await splitRound(ctx, {
      names: ['西村', '东村'], areas: [12, 24],
      fields: [{ x: -11, z: 3.6, w: 4, d: 3 }, { x: 4, z: 3.6, w: 6, d: 4 }],
      cuts0: [3], sol: [2],
      intro: '拖中间的鱼嘴，改两条渠的口宽。点「放水」，看两块田的水位。',
    });
    if (r1.tries === 1) firstTries++;
    r1.cleanup();
    ctx.hud.progress(1, 2);
    ctx.hud.task('三个村，田是 1 : 2 : 3。这回有两个鱼嘴。');
    await ctx.wait(900);
    const r2 = await splitRound(ctx, {
      names: ['西村', '中村', '东村'], areas: [6, 12, 18],
      fields: [{ x: -11, z: 3.6, w: 2, d: 3 }, { x: -1.5, z: 3.6, w: 3, d: 4 }, { x: 7, z: 3.6, w: 3, d: 6 }],
      cuts0: [2, 4], sol: [1, 3],
      intro: '拖两个鱼嘴，让三条渠的口宽分别对上三块田。',
    });
    if (r2.tries === 1) firstTries++;
    ctx.hud.progress(2, 2);
    await ctx.wait(800);
    r2.hideLabels();
    void C; void geo;
    ctx.complete({ stars: firstTries === 2 ? 3 : firstTries === 1 ? 2 : 1 });
  },
});
