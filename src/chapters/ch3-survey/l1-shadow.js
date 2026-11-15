// 3-1 影子游戏 · 高一倍，影长一倍
// 三根竿 1、2、3 步高。拖太阳：光、天色、影子实时变。找到「1 步竿影子 2 步」，猜 3 步竿影子几步，再找「影子和竿一样长」。
import { defineLevel } from '../../engine/level.js';
import { makeSun, makePole, waitSunRatio, v3 } from './kit.js';
import { showNum } from './math.js';

export default defineLevel({
  id: 'ch3-l1',
  title: '影子游戏',
  concept: '影长·成比例',
  brief: '小匠师发现：早上和中午，影子不一样长。拖一拖太阳，玩一玩。',
  discovery: '同一时刻，每根竿的影子，都是自己身高的同样倍数。',

  async setup(ctx) {
    ctx.state.toScreen = (x, y, z) => ctx.pointer.toScreen(new ctx.THREE.Vector3(x, y, z)); // 调试 / 自动测试用
    const { props } = ctx;
    const sun = makeSun(ctx, { s: 0.12, magnets: [2, 1], focus: { x: 0, z: 3, r: 17 } });
    props.ground({ w: 28, d: 22, x: 0, z: 3, seed: 31, river: null, trees: 6, cells: false });
    ctx.view.frame({ x: 0.5, z: 0.5 }, 9, { instant: true, pitch: 50, y: 1 });

    const poles = [1, 2, 3].map((h, i) => makePole(ctx, { x: -5 + i * 5, z: -4, h }));
    const hLbl = poles.map((p) => ctx.labels.add(v3(p.x, p.h + 0.2, p.z), `高 ${p.h}`, { cls: 'tag', pop: false }));
    const sLbl = poles.map((p) => ctx.labels.add(p.tipPos, '', { cls: 'tag', pop: false }));
    let hideThird = false;
    const update = () => {
      poles.forEach((p, i) => {
        p.update(sun.dir, sun.ratio);
        sLbl[i].target = v3(p.tipPos.x, 0.5, p.tipPos.z);
        sLbl[i].set(i === 2 && hideThird ? '影 ?' : `影 ${showNum(p.len)}`);
        sLbl[i].cls('ok', Math.abs(sun.ratio - Math.round(sun.ratio * 2) / 2) < 0.02 && sun.snapped);
      });
    };
    sun.onChange(update);
    update();

    ctx.hud.task('拖动左下角的太阳，看影子怎么变。让 1 步竿的影子正好 2 步。');
    await waitSunRatio(ctx, sun, { ratio: 2, hintText: '拖太阳，让最矮那根的影子刚好 2 步长。', nudgeText: '再拖一拖，要让 1 步竿的影子刚好 2 步。' });
    ctx.audio.play('good');
    poles.forEach((p) => ctx.fx.sparkle(p.tipPos, { color: '#9FE07A', size: 1.1 }));
    ctx.nudge('看，2 步高的影子 4 步。', { kind: 'good', speak: false });
    await ctx.wait(1500);

    sun.lock(true);
    hideThird = true;
    update();
    const g = await ctx.guess({ kind: 'length', actual: 6, prompt: '先猜：3 步高的竿，影子几步？', min: 1, max: 12, start: 4, unit: '步' });
    hideThird = false;
    update();
    ctx.audio.play('count', { n: 5 });
    ctx.fx.sparkle(poles[2].tipPos, { color: '#F7C948', size: 1.4 });
    ctx.say('6 步');
    if (g === 6) ctx.nudge('猜对了！', { kind: 'good', speak: false });
    await ctx.wait(1600);
    sun.lock(false);

    ctx.hud.task('再拖太阳，找到影子和竿一样长的时候。');
    await waitSunRatio(ctx, sun, { ratio: 1, hintText: '影子和竿一样长：再把太阳拖高一点。', nudgeText: '再拖一拖，要让影子和竿一样长。' });
    ctx.audio.play('good');
    poles.forEach((p) => ctx.fx.sparkle(p.tipPos, { color: '#9FE07A', size: 1.1 }));
    await ctx.wait(1200);
    ctx.complete({ stars: ctx.geo.starsByError(Math.abs(g - 6), 0, 1) });
  },
});
