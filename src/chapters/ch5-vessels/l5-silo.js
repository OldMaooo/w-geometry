// 5-5 一张席子围粮囤 · 一样的料，不一样的肚量
// 一张 12 步长、2 步高的席子围成囤壁。拖滑块把囤从瘦长方形变到正方形、再变成圆，每一种点「倒谷」看能装几斗。
// 同一堆谷子换成圆囤，谷面会落下去、空出一截。最后把席子横过来（24 步长、1 步高）围圆，再猜一次。
import { defineLevel } from '../../engine/level.js';
import { siloRect, siloCircle } from './math.js';
import { v3, C, makePanel, makeInfo, makeSlider, domGhost, wf } from './kit.js';
import { makeSack, pour } from './vessel.js';
import { makeSilo } from './silo.js';

const P = 12, H = 2;
const SHAPES = [{ type: 'rect', w: 2 }, { type: 'rect', w: 3 }, { type: 'circle' }];
const NAMES = ['瘦长方形 2×4', '正方形 3×3', '圆形'];
const DOU = [siloRect(P, H, 2), siloRect(P, H, 3), siloCircle(P, H)]; // 16 18 22.9

export default defineLevel({
  id: 'ch5-l5',
  title: '一张席子围粮囤',
  concept: '同周长·圆最大',
  brief: '只有一张 12 步长、2 步高的席子，围成一圈当粮囤的壁。围成什么形状装得最多？',
  discovery: '围墙一样长，圆的肚子最大。圆是比方更「方」的。',

  async setup(ctx) {
    const { props } = ctx;
    props.ground({ w: 26, d: 12, seed: 55, river: null, trees: 6 });
    ctx.view.shadow({ x: 0, z: 0 }, 15);
    ctx.view.frame({ x: -1.4, z: 0 }, 6.4, { instant: true, y: 0.8 });
    const farmer = props.villager({ x: -8.2, z: 3, color: '#6F8FAF', face: 0.7 });
    let right = 0;

    // ---- 先猜 ----
    const silo = makeSilo(ctx, { p: P, H, x: 0, z: 0, shapes: SHAPES, t: 0 });
    ctx.fx.pop(silo.group, { duration: 420 });
    const pick = await ctx.choose({
      prompt: '先猜：围成什么形状，装得最多？',
      options: [{ label: '长条形', value: 0 }, { label: '正方形', value: 1 }, { label: '圆形', value: 2 }, { label: '都一样', value: 3 }],
      answer: 2,
    });
    const gv = pick === 3 ? DOU[0] : DOU[pick];
    ctx.recordGuess('volume', Math.round(gv), Math.round(DOU[2]), '斗', gv / DOU[2]);
    if (pick === 2) right++;

    // ---- 围囤 ----
    const sack = makeSack(ctx, { x: -6, z: 0.4 });
    const panel = makePanel(ctx, { top: 168, width: 350 });
    const info = makeInfo(panel);
    const tried = [false, false, false];
    let shape = 0;
    let busy = false;
    let waiters = [];
    const lbl = ctx.labels.add(v3(0, H, 0), '', { cls: 'big', dy: 1.0, pop: false });
    lbl.show(false);
    const lblFree = ctx.labels.add(v3(0, H, 0), '', { cls: 'tag', dy: 0.2, pop: false });
    lblFree.show(false);

    const refreshInfo = () => {
      const full = silo.vol >= silo.cap - 0.01;
      info.html(`<span>${NAMES[shape]}</span>${full ? `<b class="ok">${shape === 2 ? '约 ' : ''}${Math.round(silo.cap)}</b><span>斗</span>` : ''}`);
      if (silo.vol > 0.01) {
        lbl.set(`${full && shape === 2 ? '约 ' : ''}${Math.round(silo.vol)}<small>斗</small>`).show(true);
        lbl.target = v3(0, silo.surfaceY(), 0);
      } else lbl.show(false);
      const gap = silo.cap - silo.vol;
      if (silo.vol > 0.01 && gap > 0.6) {
        silo.setFree(true);
        lblFree.set(`还空着 ${Math.round(gap)} 斗`).show(true);
        lblFree.target = v3(0, silo.H, 0);
      } else { silo.setFree(false); lblFree.show(false); }
    };
    refreshInfo();

    const slider = makeSlider(ctx, panel, {
      label: '形', min: 1, max: 3, value: 1, caps: ['瘦长', '正方', '圆'], continuous: true,
      onInput: (f) => {
        if (busy) return;
        silo.setT(f - 1);
        shape = Math.round(f) - 1;
        silo.refresh();
        // 变形时谷面跟着落（或被挤满）
        lbl.target = v3(0, silo.surfaceY(), 0);
      },
      onChange: (v) => {
        if (busy) return;
        shape = v - 1;
        silo.setT(shape);
        if (silo.vol > silo.cap + 0.01) {
          silo.setVol(silo.cap);
          ctx.audio.play('pop');
          ctx.fx.sparkle({ x: 0, z: 0 }, { size: 2.6, color: '#E8B53C' });
          ctx.nudge('这个形状装不下，谷子溢出来了。');
        } else if (shape === 2 && silo.vol > 0.01 && silo.cap - silo.vol > 0.6) {
          ctx.audio.play('good');
          ctx.nudge('同样的谷子，圆囤还没装满。');
        }
        refreshInfo();
      },
    });
    ctx.hud.task('拖动滑块，把囤围成不同的形状。每一种都点「倒谷」。');

    const finishFill = () => { const w = waiters; waiters = []; w.forEach((f) => f()); };
    const fill = async () => {
      if (busy) return;
      if (silo.cap - silo.vol < 0.05) { ctx.nudge('已经满了。换个形状试试。'); return; }
      busy = true;
      panel.lock(true);
      silo.setFree(false);
      lblFree.show(false);
      lbl.show(false);
      await pour(ctx, sack, silo, { flowMs: 1000 + 160 * (silo.cap - silo.vol) * 0.5, dir: 1 });
      silo.setVol(silo.cap);
      tried[shape] = true;
      ctx.audio.play('star');
      ctx.fx.sparkle({ x: 0, z: 0 }, { size: silo.hw * 1.6 });
      refreshInfo();
      farmer.cheer();
      busy = false;
      panel.lock(false);
      finishFill();
    };
    const btn = ctx.hud.tool({ icon: 'wheat', label: '倒谷', primary: true, onTap: fill });
    const next = () => tried.findIndex((t) => !t);
    ctx.hint({
      text: '滑块拖到「瘦长」「正方」「圆」，每个位置都点一下「倒谷」。',
      ghost: () => {
        const i = Math.max(0, next());
        return domGhost(ctx, () => slider.thumbCenter(), () => slider.dotCenter(i + 1), 1500);
      },
      demo: async () => {
        const i = next();
        if (i < 0) return;
        slider.set(i + 1);
        await ctx.wait(700);
        const p = wf(ctx, (res) => { waiters.push(res); });
        btn.tap();
        await p;
      },
    });
    while (!tried.every(Boolean)) await wf(ctx, (res) => { waiters.push(res); });
    ctx.hint(null);
    await ctx.wait(900);
    ctx.nudge('同样长的席子，圆囤装得最多！', { kind: 'good' });
    await ctx.wait(2600);

    // ---- 横过来：24 步长、1 步高 ----
    panel.remove();
    btn.hide();
    lbl.remove();
    lblFree.remove();
    silo.setFree(false);
    ctx.view.frame({ x: 0, z: 0 }, 10.4, { y: 0.8 });
    const tag1 = ctx.labels.add(v3(-4.6, 2, 0), `12 步长 · 2 步高<br>约 ${Math.round(DOU[2])} 斗`, { cls: 'tag', dy: 0.6 });
    await ctx.fx.to(silo.group.position, { x: -4.6 }, 700);
    const silo2 = makeSilo(ctx, { p: 24, H: 1, x: 3.8, z: 0, shapes: [{ type: 'circle' }], t: 0 });
    ctx.fx.pop(silo2.group, { duration: 420 });
    sack.group.position.set(11, 0, 0.4);
    sack.home.copy(sack.group.position);
    const tag2 = ctx.labels.add(v3(3.8, 1, 0), '24 步长 · 1 步高', { cls: 'tag', dy: 1.2 });
    ctx.hud.task('把席子横过来：24 步长、1 步高，围成圆。');
    const g2 = await ctx.choose({
      prompt: '先猜：这个圆囤，装得比刚才多还是少？',
      options: [{ label: '更多', value: 'more' }, { label: '一样多', value: 'same' }, { label: '更少', value: 'less' }],
      answer: 'more',
    });
    const dou2 = siloCircle(24, 1);
    const gv2 = g2 === 'more' ? dou2 : g2 === 'same' ? DOU[2] : DOU[2] / 2;
    ctx.recordGuess('volume', Math.round(gv2), Math.round(dou2), '斗', Math.min(gv2, dou2) / Math.max(gv2, dou2));
    if (g2 === 'more') right++;
    let done2, lbl2;
    const fin2 = wf(ctx, (res) => { done2 = res; });
    const fill2 = async () => {
      if (busy) return;
      busy = true;
      btn2.hide();
      await pour(ctx, sack, silo2, { dir: -1, flowMs: 3200 });
      silo2.setVol(silo2.cap);
      ctx.audio.play('star');
      ctx.fx.sparkle({ x: 3.8, z: 0 }, { size: 6 });
      lbl2 = ctx.labels.add(v3(3.8, 1, 0), `约 ${Math.round(dou2)}<small>斗</small>`, { cls: 'big', dy: 0.9 });
      busy = false;
      done2();
    };
    btn.remove();
    const btn2 = ctx.hud.tool({ icon: 'wheat', label: '倒谷', primary: true, onTap: fill2 });
    btn2.pulse(true);
    ctx.hint({
      text: '点「倒谷」，看这个圆囤能装几斗。',
      demo: async () => { btn2.tap(); await fin2; },
    });
    await fin2;
    ctx.hint(null);
    farmer.cheer();
    ctx.nudge('矮一半，围成的圆却大了一倍多，装得更多！', { kind: 'good' });
    await ctx.wait(3200);
    tag1.remove();
    tag2.remove();
    lbl2?.remove();
    ctx.complete({ stars: right >= 2 ? 3 : right === 1 ? 2 : 1 });
  },
});
