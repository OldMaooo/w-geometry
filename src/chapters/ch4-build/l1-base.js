// 4-1 夯台基 · 一层几块 × 几层
// 两座台基：5×3×2（先猜，铺满一层后点「再来一层」复制），4×4×3（先猜，铺满一层后直接问「一共几块」）。
import { defineLevel } from '../../engine/level.js';
import { makeColumns, modeTools, bindTaps, sweepIn, v3, go } from './kit.js';
import { countBlocks } from './math.js';

const ROUNDS = [
  { w: 5, d: 3, h: 2, max: 60, start: 20 },
  { w: 4, d: 4, h: 3, max: 80, start: 36 },
];

export default defineLevel({
  id: 'ch4-l1',
  title: '夯台基',
  concept: '体积·层数',
  brief: '宫殿要一座夯土台基。要运多少块土砖？先猜，再点格子放放看。',
  discovery: '先数一层有几块，再数有几层：一层的块数 × 层数。',

  async setup(ctx) {
    const { props, geo } = ctx;
    props.ground({ w: 16, d: 11, seed: 41, river: null, trees: 9, cells: false });
    ctx.view.shadow({ x: 0, z: 0 }, 11);
    props.villager({ x: -6.2, z: 3.4, color: '#6F8FAF', face: 0.5 });
    props.villager({ x: 6.4, z: 3.6, color: '#C8553D', face: -0.5, s: 0.95 });
    props.rock({ x: 5.8, z: -3.2, s: 0.8 });
    ctx.state.accs = [];
    let lastG = 0;

    for (let r = 0; r < ROUNDS.length; r++) {
      ctx.hud.progress(r, ROUNDS.length);
      const R = ROUNDS[r];
      const total = countBlocks(R.w, R.d, R.h);
      const layer = R.w * R.d;
      const ox = -R.w / 2, oz = -R.d / 2;
      const cols = makeColumns(ctx, { w: R.w, d: R.d, cap: R.h, ox, oz });
      ctx.state.cols = cols;
      if (r === 0) await sweepIn(ctx, { x: 0, z: 0.4 }, 6.6, { yaw0: -48, yaw1: -14, pitch: 38, ms: 2600 });
      else ctx.view.frame({ x: 0, z: 0.4 }, 6.6, { yaw: -14, pitch: 38 });

      // 边上写清尺寸：长、宽，再立一根和台基一样高的桩。
      const lenL = ctx.labels.add(v3(ox + R.w / 2, 0.15, oz + R.d + 0.55), `长 ${R.w}`, { cls: 'tag', pop: false });
      const widL = ctx.labels.add(v3(ox + R.w + 0.65, 0.15, oz + R.d / 2), `宽 ${R.d}`, { cls: 'tag', pop: false });
      const pole = props.stake({ x: ox + R.w + 0.7, z: oz + R.d + 0.7, h: R.h });
      const hL = ctx.labels.add(v3(ox + R.w + 0.7, R.h + 0.35, oz + R.d + 0.7), `高 ${R.h}`, { cls: 'tag', pop: false });

      // 先猜
      ctx.hud.task(r === 0 ? '先猜猜，要几块土砖？' : '这座更大。先猜猜，要几块土砖？');
      const g = await ctx.guess({ kind: 'volume', actual: total, prompt: `先猜：一共要几块土砖？`, min: 1, max: R.max, start: R.start, unit: '块' });
      ctx.state.accs.push(geo.guessAccuracy(g, total));
      lastG = g;

      ctx.hud.task('点格子，放土砖，先铺满底下一层。');
      const tools = modeTools(ctx, (m) => { cols.setMode(m); });
      const again = ctx.hud.tool({ icon: 'layers', label: '再来一层', primary: true, hidden: true, onTap: () => { again.hide(); go(layerUp()); } });
      const count = ctx.labels.add(v3(ox - 0.2, 0.5, oz - 0.5), '0', { cls: 'num', pop: false });
      count.show(false);

      const groundFull = () => cols.heights.every((row) => row.every((v) => v >= 1));
      const allFull = () => cols.total() === total;
      let layerBusy = false;
      let resolveFull = null;
      let layerAsked = false;
      let resolveLayer = null;

      const refresh = () => {
        count.set(cols.total()).show(cols.total() > 0);
        if (r === 0 && groundFull() && !allFull() && !layerBusy && !again.visible) { again.show().pulse(true); ctx.nudge('一层铺满了！试试「再来一层」。', { kind: 'good' }); }
        if (r === 1 && groundFull() && !layerAsked) { layerAsked = true; resolveLayer?.(); }
        if (allFull()) resolveFull?.();
      };
      cols.onChange(refresh);
      async function layerUp() {
        layerBusy = true;
        again.pulse(false);
        await cols.copyLayerUp();
        layerBusy = false;
        refresh();
      }

      const doTap = (col) => {
        const res = cols.tap(col);
        if (res === 'full') ctx.nudge(`这座台基只要 ${R.h} 层高。`, { speak: false });
      };
      const taps = bindTaps(ctx, {
        onTap: (ray) => doTap(cols.pick(ray)),
        onHover: (ray) => cols.hover(ray ? cols.pick(ray) : null),
      });

      // ---- 提示：下一个空格 ----
      const nextEmpty = () => {
        for (let z = 0; z < R.d; z++) for (let x = 0; x < R.w; x++) if (cols.heights[z][x] < 1) return { x, z };
        return null;
      };
      const floorHand = () => {
        const n = nextEmpty();
        if (!n) return null;
        const p = v3(cols.cx(n.x), 0.6, cols.cz(n.z));
        return ctx.fx.ghostHand(p.clone().add(v3(1.6, 1.4, 1.6)), p);
      };
      const stepHint = {
        text: '点一点底下的格子，一格放一块。',
        ghost: () => floorHand(),
        demo: async () => {
          cols.setMode('place');
          if (!groundFull()) {
            for (let n = 0; n < 40 && nextEmpty(); n++) { doTap(nextEmpty()); await ctx.wait(110); }
          } else if (r === 0 && !allFull()) {
            if (again.visible) again.tap(); else await layerUp();
            await ctx.wait(500);
          }
        },
      };
      ctx.hint(stepHint);

      // ---- 等：铺满 ----
      if (r === 0) {
        await ctx.waitFor((done) => { resolveFull = done; refresh(); });
      } else {
        await ctx.waitFor((done) => { resolveLayer = done; refresh(); });
        ctx.hint(null);
        again.hide(); tools.show(false);
        ctx.hud.task(`一层 ${layer} 块。有 ${R.h} 层。`);
        let pick = 0;
        for (let tries = 0; tries < 3 && pick !== total; tries++) {
          pick = await ctx.choose({ prompt: '一共几块？', options: [{ label: String(layer * 2), value: layer * 2 }, { label: String(total), value: total }, { label: String(layer * 4), value: layer * 4 }], answer: total });
          if (pick !== total) ctx.nudge(`一层 ${layer} 块，要叠 ${R.h} 层哦。`);
        }
        ctx.audio.play('good');
        // 剩下的层自己叠上去验证
        while (cols.total() < total) await cols.copyLayerUp(40);
        resolveFull?.();
      }
      ctx.hint(null);
      again.remove();
      tools.remove();
      taps.off();
      cols.hover(null);

      // ---- 数一数 ----
      count.remove();
      const center = v3(ox + R.w / 2, R.h + 0.3, oz + R.d / 2);
      const l1 = ctx.labels.add(v3(ox + R.w / 2, R.h + 1.3, oz + R.d / 2), `一层 ${layer} 块`, { cls: 'tag' });
      ctx.audio.play('count', { n: 3 });
      await ctx.wait(1100);
      const l2 = ctx.labels.add(v3(ox + R.w / 2, R.h + 2.35, oz + R.d / 2), `${R.h} 层`, { cls: 'tag' });
      ctx.audio.play('count', { n: 5 });
      await ctx.wait(1000);
      const big = ctx.labels.add(center, `${total}<small>块</small>`, { cls: 'big' });
      ctx.say(`一层 ${layer} 块，${R.h} 层，一共 ${total} 块。`);
      ctx.fx.celebrate({ x: 0, z: 0 }, { count: 40 });
      ctx.audio.play('success');
      if (lastG === total) ctx.nudge('你猜得一块不差！', { kind: 'good', speak: false });
      await ctx.wait(2400);
      [l1, l2, big, lenL, widL, hL].forEach((l) => l.remove());
      if (r < ROUNDS.length - 1) {
        ctx.remove(pole);
        await ctx.wait(300);
        cols.destroy();
      }
    }
    const acc = ctx.state.accs[1];
    ctx.complete({ stars: acc >= 0.9 ? 3 : acc >= 0.7 ? 2 : 1 });
  },
});
