// 3-2 量大树 · 用自己的影子
// 立一根 1 步的竿，量竿影、量树影，把竿的小三角拉大到盖住树影：放大几倍，树就是几根竿高。做两棵。
import { defineLevel } from '../../engine/level.js';
import { makeSun, makePole, makeTree, measureRope, v3 } from './kit.js';
import { makeScaleBoard } from './scale-diagram.js';
import { sForRatio, showNum } from './math.js';

const ROUNDS = [
  { H: 8, r: 1.5, side: 'am', brief: '要砍一棵大树做塔梁，梁要 8 步长。这棵树够高吗？爬不上去。' },
  { H: 5, r: 2, side: 'pm', brief: '换到下午，换一棵树。' },
];

export default defineLevel({
  id: 'ch3-l2',
  title: '量大树',
  concept: '影子·相似',
  brief: '要砍一棵大树做塔梁，梁要 8 步长。这棵树够高吗？爬不上去。',
  discovery: '不用爬树，影子替你爬上去了。',

  async setup(ctx) {
    ctx.state.toScreen = (x, y, z) => ctx.pointer.toScreen(new ctx.THREE.Vector3(x, y, z)); // 调试 / 自动测试用
    const { props, geo } = ctx;
    const sun = makeSun(ctx, { s: sForRatio(1.5, 'am'), dial: false, focus: { x: 0, z: 1, r: 17 } });
    props.ground({ w: 26, d: 22, x: 0, z: 1, seed: 41, river: null, trees: 5, cells: false });
    ctx.view.frame({ x: 0.5, z: -0.5 }, 10.5, { instant: true, pitch: 50, y: 3 });
    props.villager({ x: -8, z: -3, face: 0.8 });

    let errs = 0;
    for (let i = 0; i < ROUNDS.length; i++) {
      const R = ROUNDS[i];
      ctx.hud.progress(i, ROUNDS.length);
      if (i > 0) { ctx.hud.task(R.brief); await sun.glideTo(sForRatio(R.r, R.side), 1800); }
      const tree = makeTree(ctx, { x: 0, z: -5, h: R.H });
      const pole = makePole(ctx, { x: -3.5, z: -5, h: 1 });
      const objs = [tree, pole];
      const off = sun.onChange(() => objs.forEach((o) => o.update(sun.dir, sun.ratio)));
      objs.forEach((o) => o.update(sun.dir, sun.ratio));
      const lbls = [ctx.labels.add(v3(pole.x, 2.3, pole.z), '竿 1', { cls: 'tag', pop: false })];
      ctx.fx.pop(tree.group); ctx.fx.pop(pole.group);
      if (i === 0) ctx.hud.task(R.brief);

      const g = await ctx.guess({ kind: 'height', actual: R.H, prompt: '先猜：这棵树有几步高？', min: 1, max: 16, start: 6, unit: '步' });
      const err = Math.abs(g - R.H);

      const p = await measureRope(ctx, { from: { x: pole.x, z: pole.z }, to: { x: pole.tipPos.x, z: pole.tipPos.z }, every: 0.5, text: '用结绳量一量竿的影子：拉绳头到影子尖上。', hintText: '把金色绳头拉到竿影子尖上的金圈。' });
      const t = await measureRope(ctx, { from: { x: tree.x, z: tree.z }, to: { x: tree.tipPos.x, z: tree.tipPos.z }, every: 1, text: '再量树的影子。', hintText: '把金色绳头拉到树影子尖上的金圈。', snapR: 1.6 });
      lbls.push(p.big, t.big);

      ctx.hud.task('抓住金球往右拉，把小三角放大，直到底边盖住树影。');
      const board = makeScaleBoard(ctx, { base: p.len, height: 1, target: t.len, caption: `竿影 ${showNum(p.len)}，树影 ${showNum(t.len)}`, stripName: '树影' });
      let kHit = 0;
      await ctx.waitFor((done) => {
        board.onRelease((k) => { if (Math.abs(k - board.goal) < 1e-6) { kHit = k; done(); } else ctx.nudge('底边要刚好盖住树影。'); });
        ctx.hint({ text: '往右拉金球，让三角形的底边和树影一样长。', ghost: () => board.ghost(board.goal), demo: () => board.simulateTo(board.goal) });
      });
      ctx.hint(null);
      board.lock(true);
      ctx.audio.play('good');
      // 竿一根根叠到树边
      const stack = [];
      for (let k = 0; k < kHit; k++) {
        const m = new ctx.THREE.Mesh(new ctx.THREE.BoxGeometry(0.5, 0.9, 0.5), new ctx.THREE.MeshLambertMaterial({ color: k % 2 ? '#E8C26A' : '#F2B134' }));
        m.position.set(tree.x + 2.2, 0.5 + k, tree.z);
        ctx.add(m);
        stack.push(m);
        ctx.fx.pop(m, { duration: 220 });
        ctx.audio.play('count', { n: k });
        await ctx.wait(140);
      }
      const big = ctx.labels.add(v3(tree.x + 2.2, kHit + 0.8, tree.z), `${kHit} 根竿高<small>＝ ${R.H} 步</small>`, { cls: 'big' });
      ctx.say(`树有 ${R.H} 步高`);
      if (i === 0) ctx.nudge(`${R.H} 步，正好做梁。`, { kind: 'good', speak: false });
      await ctx.wait(2200);
      errs = err;
      off();
      board.remove();
      if (i < ROUNDS.length - 1) {
        [...lbls, big].forEach((l) => l.remove());
        stack.forEach((m) => ctx.remove(m));
        for (const o of objs) { ctx.remove(o.group); ctx.remove(o.poly.mesh); ctx.remove(o.tip); ctx.remove(o.ray.mesh); }
        p.rope.group.removeFromParent(); t.rope.group.removeFromParent();
      }
    }
    ctx.hud.progress(ROUNDS.length, ROUNDS.length);
    ctx.complete({ stars: geo.starsByError(errs, 1, 2) });
  },
});
