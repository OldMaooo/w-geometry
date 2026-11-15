// 1-3 谁的田大 · 一样长的篱笆，不一样大的田
// 三家都用 16 节篱笆：2×6、3×5、4×4。先点选最大的一块 → 每块「铺一铺」报数 →
// 自己拖篱笆角围田（周长锁定 16），苗数实时变，围出 4×4 点「就这样」。
import { defineLevel } from '../../engine/level.js';
import { PALETTE } from '../../engine/palette.js';
import { layMats, v3 } from './kit.js';

const PLOTS = [
  { w: 6, d: 2, x: -11, z: -6, who: '阿禾', color: PALETTE.clay },
  { w: 5, d: 3, x: -3, z: -7, who: '阿木', color: '#6F8FAF' },
  { w: 4, d: 4, x: 4.5, z: -8, who: '阿石', color: '#8E7AB5' },
];

export default defineLevel({
  id: 'ch1-l3',
  title: '谁的田大',
  concept: '周长与面积',
  brief: '三家都拿 16 节篱笆围田，吵起来了：到底谁的田大？',
  discovery: '一样长的篱笆，围得越方，田越大；又细又长的田最亏。',

  async setup(ctx) {
    const { props, geo } = ctx;
    props.ground({ w: 26, d: 18, seed: 33 });
    ctx.view.shadow({ x: 0, z: 0 }, 18);

    // ---- 三家的田 ----
    const items = PLOTS.map((P) => {
      const plot = props.plot({ x: P.x, z: P.z, w: P.w, d: P.d, ridge: false });
      const f = props.fence({ points: [{ x: P.x, z: P.z }, { x: P.x + P.w, z: P.z }, { x: P.x + P.w, z: P.z + P.d }, { x: P.x, z: P.z + P.d }], closed: true });
      const v = props.villager({ x: P.x + P.w / 2, z: P.z + P.d + 1, color: P.color, face: 0 });
      const tag = ctx.labels.add(v.group, P.who, { cls: 'tag', dy: 1.75 });
      return { P, plot, fence: f, v, tag, area: P.w * P.d };
    });
    const top = { x: -2, z: -5 };
    ctx.view.frame(top, 10.5, { instant: true });

    // ---- 先猜：点最大的一块 ----
    ctx.hud.prompt('你觉得谁的田最大？点那块田。');
    let pickResolve;
    const picked = ctx.waitFor((d) => { pickResolve = d; });
    const taps = items.map((it, i) => ctx.pointer.tappable(it.plot.group, () => pickResolve(i), { hit: it.plot.group }));
    // solve 时自动点最大的那块
    ctx.hint({ text: '点一块你觉得最大的田。', quiet: true, demo: async () => pickResolve(2) });
    const pi = await picked;
    taps.forEach((t) => t.dispose());
    ctx.hint(null);
    ctx.hud.prompt('');
    ctx.recordGuess('area', items[pi].area, 16, '', items[pi].area / 16);
    ctx.state.picked = items[pi].P.who;
    ctx.fx.sparkle({ x: items[pi].P.x + items[pi].P.w / 2, z: items[pi].P.z + items[pi].P.d / 2 }, { size: 2 });
    ctx.audio.play('good');
    items[pi].v.cheer();
    items.forEach((it) => it.tag.remove());

    // ---- 铺一铺 ----
    ctx.hud.task('点每块田上的「铺一铺」，数数能铺几块。');
    let left = 3;
    let allDone;
    const doneAll = ctx.waitFor((d) => { allDone = d; });
    const fillers = items.map((it) => {
      const { P } = it;
      let busy = false;
      const run = async () => {
        if (busy) return; busy = true;
        btnLbl.remove();
        await layMats(ctx, { x: P.x, z: P.z, w: P.w, d: P.d }, { step: 55 });
        ctx.labels.add(v3(P.x + P.w / 2, 0.5, P.z + P.d / 2), `${it.area}<small>块</small>`, { cls: 'big' });
        ctx.say(`${it.area} 块`);
        it.v.cheer();
        left--;
        if (left === 0) allDone();
      };
      const btnLbl = ctx.labels.add(v3(P.x + P.w / 2, 0.5, P.z + P.d / 2), '铺一铺', { cls: 'tag', onTap: () => { ctx.audio.play('tap'); run(); } });
      return run;
    });
    ctx.hint({ text: '每块田中间都有「铺一铺」，点一点。', demo: async () => { for (const f of fillers) { f(); await ctx.wait(400); } await doneAll; } });
    await doneAll;
    ctx.hint(null);
    await ctx.wait(800);
    ctx.nudge('篱笆一样长，田却不一样大！', { kind: 'good' });
    await ctx.wait(2200);

    // ---- 自己围 ----
    const O = { x: -3, z: 7.5 }; // 左下角（固定桩）
    ctx.view.frame({ x: O.x + 4, z: O.z - 3.5 }, 7.5);
    ctx.hud.task('轮到你了：16 节篱笆，拖动篱笆角，围出能种最多苗的田。');
    const fence = props.fence({ closed: true });
    props.stake({ x: O.x, z: O.z, h: 0.8 });
    const knob = ctx.add(new ctx.THREE.Group());
    const kb = new ctx.THREE.Mesh(new ctx.THREE.IcosahedronGeometry(0.28, 0), new ctx.THREE.MeshLambertMaterial({ color: PALETTE.gold }));
    kb.position.y = 0.75;
    kb.castShadow = true;
    knob.add(kb);
    props.stake({ x: 0, z: 0, h: 0.6, parent: knob });
    props.hitBox(1.2, 1.2, 1.2, knob);
    const plotSoil = new ctx.THREE.Mesh(new ctx.THREE.BoxGeometry(1, 0.05, 1), new ctx.THREE.MeshLambertMaterial({ color: '#B98E57' }));
    plotSoil.receiveShadow = true;
    ctx.add(plotSoil);
    const lblW = ctx.labels.add(v3(0, 0, 0), '', { cls: 'num', pop: false });
    const lblD = ctx.labels.add(v3(0, 0, 0), '', { cls: 'num', pop: false });
    const lblN = ctx.labels.add(v3(0, 0, 0), '', { cls: 'big', pop: false });
    let w = 7;
    let sprouts = null;
    let tries = 0;

    function layout(nw) {
      w = nw;
      const d = 8 - w;
      const x1 = O.x + w, z1 = O.z - d;
      fence.setPoints([{ x: O.x, z: O.z }, { x: x1, z: O.z }, { x: x1, z: z1 }, { x: O.x, z: z1 }]);
      knob.position.set(x1, 0, z1);
      plotSoil.scale.set(w, 1, d);
      plotSoil.position.set(O.x + w / 2, 0.02, O.z - d / 2);
      lblW.target = v3(O.x + w / 2, 0.2, O.z + 0.55); lblW.set(w);
      lblD.target = v3(O.x - 0.6, 0.2, O.z - d / 2 + 0.3); lblD.set(d);
      lblN.target = v3(O.x + w / 2, 0.8, O.z - d / 2); lblN.set(`${w * d}<small>棵苗</small>`);
      if (sprouts) ctx.remove(sprouts.mesh);
      const cells = [];
      for (let i = 0; i < w; i++) for (let j = 0; j < d; j++) cells.push({ x: O.x + i + 0.5, z: O.z - j - 0.5 });
      sprouts = props.crops({ cells, kind: 'sprout', per: 1, seed: w });
      sprouts.setAll(1);
      ctx.state.rect = `${w}×${d}`;
    }
    layout(7);

    const handle = ctx.pointer.draggable(knob, {
      ringSize: 0.8,
      lift: 0,
      snap: (p) => {
        // 投到 w + d = 8 这条斜线上
        const t = Math.round(((p.x - O.x) + (p.z - (O.z - 8))) / 2);
        const nw = Math.min(7, Math.max(1, t));
        return v3(O.x + nw, 0, O.z - (8 - nw));
      },
      onMove: (p) => {
        const nw = Math.round(p.x - O.x);
        if (nw !== w) layout(nw);
      },
    });

    const presses0 = ctx.hintPresses;
    let submitResolve;
    const submitted = ctx.waitFor((d) => { submitResolve = d; });
    const okBtn = ctx.hud.tool({ icon: 'check', label: '就这样', primary: true, onTap: () => {
      tries++;
      if (w === 4) { submitResolve(); return; }
      const v = items[0].v;
      v.cheer();
      ctx.nudge('好像还能再多种点。');
      ctx.fx.wobble(knob, { amp: 0.3 });
    } });
    const target4 = v3(O.x + 4, 0, O.z - 4);
    ctx.hint({
      text: '拖篱笆角试试，看苗的数字什么时候最大。',
      ghost: () => ctx.fx.ghostHand(v3(knob.position.x, 0.6, knob.position.z), v3(target4.x, 0.6, target4.z)),
      demo: async () => { await ctx.pointer.simulateDrag(handle, target4, { duration: 1200 }); await ctx.wait(500); okBtn.tap(); },
    });
    await submitted;
    ctx.hint(null);
    handle.dispose();
    okBtn.hide();
    lblW.remove(); lblD.remove();
    // 苗噌噌长成稻子
    ctx.remove(sprouts.mesh);
    const cells = [];
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) cells.push({ x: O.x + i + 0.5, z: O.z - j - 0.5 });
    const rice = props.crops({ cells, kind: 'rice', per: 4, seed: 9 });
    lblN.set('16<small>棵苗</small>');
    await rice.grow({ stagger: 12, onEach: (n) => { if (n % 2 === 0) ctx.audio.play('grow', { n }); } });
    items.forEach((it) => it.v.cheer());
    ctx.view.frame({ x: -1, z: -1 }, 12);
    await ctx.wait(600);
    const stars = ctx.hintPresses > presses0 ? 1 : tries === 1 ? 3 : 2;
    ctx.complete({ stars });
  },
});
