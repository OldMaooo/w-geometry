// 1-4 斜田变方田 · 切一刀拼过去
// 斜田（平行四边形）先猜大小 → 石刀竖切 → 切下的一块拖到另一头 → 拼成长方形 → 铺草垫报数。做两块。
import { defineLevel } from '../../engine/level.js';
import { cutAndShift } from './cutter.js';
import { layMats, countOut } from './kit.js';

// 底、高、斜移；左下角位置（世界坐标，z 往远处减小）
const FIELDS = [
  { base: 6, h: 3, shift: 2, x: -10, z: 1.5 },
  { base: 5, h: 4, shift: 3, x: 2, z: 2 },
];

export default defineLevel({
  id: 'ch1-l4',
  title: '斜田变方田',
  concept: '出入相补',
  brief: '河边这块田是斜的，草垫铺不整齐。到底有多大？',
  discovery: '斜田切一刀，挪过去拼成方田——形状变了，大小没变。',

  async setup(ctx) {
    const { props, geo } = ctx;
    props.ground({ w: 24, d: 14, seed: 44 });
    ctx.view.shadow({ x: 0, z: 0 }, 16);
    const v = props.villager({ x: -11, z: 4.5, color: '#C08A3E', face: 0.5 });
    ctx.view.frame({ x: -2, z: 0 }, 11, { instant: true });
    let err2 = 99;

    for (let f = 0; f < FIELDS.length; f++) {
      ctx.hud.progress(f, 2);
      const F = FIELDS[f];
      const poly = [
        { x: F.x, z: F.z }, { x: F.x + F.base, z: F.z },
        { x: F.x + F.base + F.shift, z: F.z - F.h }, { x: F.x + F.shift, z: F.z - F.h },
      ];
      const area = F.base * F.h;
      const mid = { x: F.x + (F.base + F.shift) / 2, z: F.z - F.h / 2 + 0.6 };
      ctx.view.frame(mid, (F.base + F.shift) / 2 + 2.4);
      // 先摆出斜田的样子让他猜
      const preview = props.polyField({ points: poly, color: '#B98E57' });
      ctx.fx.pop(preview, { duration: 350 });
      if (f === 1) ctx.hud.task('又一块斜田。这回先猜，应该准多了。');
      const g = await ctx.guess({ kind: 'area', actual: area, prompt: '先猜：能铺几块草垫？', min: 1, max: 40, start: 12, unit: '块' });
      if (f === 1) err2 = Math.abs(g - area);
      ctx.remove(preview);

      const { rect } = await cutAndShift(ctx, poly);
      await ctx.wait(300);
      ctx.hud.task('拼成方田了！铺上草垫数一数。');
      await layMats(ctx, rect, { step: 45 });
      const res = await countOut(ctx, rect, { keep: true });
      v.cheer();
      ctx.state[`field${f + 1}`] = res.total;
      await ctx.wait(600);
    }

    ctx.hud.progress(2, 2);
    ctx.view.frame({ x: -2, z: 0 }, 11.5);
    await ctx.wait(700);
    ctx.complete({ stars: geo.starsByError(err2, 0, 2) });
  },
});
