// 2-1 画一口圆井 · 圆是「一样远」
// 绳拴桩、拖笔转一圈画井；再把绳放长一倍画祭坛，先猜面积几倍，铺草垫数一数。
import * as THREE from 'three';
import { defineLevel } from '../../engine/level.js';
import { PALETTE } from '../../engine/palette.js';
import { mat } from '../../engine/shared.js';
import { createBoard, busy, v3 } from './kit.js';
import * as M from './math.js';

const W = { x: -6.5, z: 0.5 };
const A = { x: 4.5, z: 0.5 };

/** 在圆里铺草垫（格子中心在 .5 上），返回 { mats, n }。 */
async function fillMats(ctx, C, r) {
  const mats = [];
  for (let i = -Math.floor(r); i <= Math.floor(r); i++) {
    for (let j = -Math.floor(r); j <= Math.floor(r); j++) {
      if (Math.hypot(i, j) <= r + 1e-6) mats.push(ctx.props.mat({ x: C.x + i, z: C.z + j }));
    }
  }
  const step = 1500 / mats.length;
  mats.forEach((m, k) => {
    ctx.fx.pop(m, { delay: k * step, duration: 200 });
    if (k % 6 === 0) ctx.after(k * step, () => ctx.audio.play('place'));
  });
  await ctx.wait(1500 + 250);
  return { mats, n: mats.length };
}

export default defineLevel({
  id: 'ch2-l1',
  title: '画一口圆井',
  concept: '圆·一样远',
  brief: '村里要挖一口圆井。把绳子拴在桩上，能画出圆来吗？',
  discovery: '圆上哪一点，到中心都是一根绳长。',

  async setup(ctx) {
    const { props } = ctx;
    props.ground({ w: 26, d: 14, seed: 21, puddles: 0 });
    ctx.view.shadow({ x: -1, z: 0.5 }, 16);
    const board = createBoard(ctx, { bounds: { minX: -12, maxX: 12, minZ: -6.5, maxZ: 6.5 } });
    const ahe = props.villager({ x: -10.5, z: 4, color: PALETTE.clay, face: 0.6 });
    ctx.view.frame(W, 7.5, { instant: true });
    board.addPoint('W', W, { name: null, h: 1.1 });

    // ---- 一：井 ----
    ctx.hud.progress(0, 2);
    const c1 = await board.circle({
      centers: ['W'], fixedR: 3, taut: true, dir: 0.5,
      texts: { turn: '绳子拴在桩上。拖着笔，绕桩走一圈。', turnHint: '按住金色的笔，绕着桩走一整圈。拉紧绳子才画得出圆。' },
    });
    ctx.say('圆上每一点，到桩都是一根绳长。');
    const small = await busy(ctx, fillMats(ctx, W, 3));
    const lblS = ctx.labels.add(v3(W.x, 0.5, W.z), `${small.n}<small>块</small>`, { cls: 'big' });
    await ctx.wait(1300);
    lblS.remove();
    small.mats.forEach((m) => ctx.remove(m));
    // 井：石沿 + 水
    const rim = new THREE.Mesh(new THREE.TorusGeometry(3, 0.16, 6, 48), mat(PALETTE.stone));
    rim.rotation.x = Math.PI / 2; rim.position.set(W.x, 0.1, W.z);
    rim.castShadow = true; ctx.add(rim);
    const water = new THREE.Mesh(new THREE.CircleGeometry(2.95, 40), new THREE.MeshLambertMaterial({ color: PALETTE.river }));
    water.rotation.x = -Math.PI / 2; water.position.set(W.x, 0.09, W.z); ctx.add(water);
    ctx.fx.pop(water, { duration: 600 }); ctx.fx.pop(rim, { duration: 600 });
    ctx.audio.play('success');
    ahe.cheer();
    await ctx.wait(900);

    // ---- 二：祭坛 ----
    ctx.hud.progress(1, 2);
    ctx.view.frame({ x: A.x - 1, z: A.z }, 9);
    board.addPoint('A', A, { name: null, h: 1.1 });
    ctx.hud.task('再画一个更大的圆当祭坛：绳子放长一倍。');
    const g = await ctx.choose({
      prompt: '绳长加倍，圆占的地是原来的几倍？',
      options: [{ label: '2 倍', value: 2 }, { label: '3 倍', value: 3 }, { label: '4 倍', value: 4 }],
      answer: 4,
    });
    ctx.recordGuess('area', g, 4, '倍');
    const c2 = await board.circle({
      centers: ['A'], taut: true,
      free: { min: 2, max: 7, start: 3, dir: 0.5, demoR: 6, check: (r) => (r === 6 ? true : '绳长要加倍：拖到 6 个结。') },
      texts: { radius: '把笔往外拖，绳子放长一倍：6 个结。', radiusHint: '按住金色的笔往外拖，拖到数字 6 再松手。', turn: '再绕桩走一圈。', turnHint: '按住金色的笔，绕着桩走一整圈。' },
    });
    const big = await busy(ctx, fillMats(ctx, A, c2.r));
    const lblB = ctx.labels.add(v3(A.x, 0.5, A.z), `${big.n}<small>块</small>`, { cls: 'big' });
    ctx.hud.task('井和祭坛都画好了。');
    ctx.say(`井是 ${small.n} 块，祭坛是 ${big.n} 块。`);
    ctx.nudge(`${small.n} 块变成 ${big.n} 块：绳长一倍，地大约是 4 倍。`, { kind: 'good' });
    await ctx.wait(2600);
    lblB.remove();
    ctx.fx.pop(props.villager({ x: A.x + 7.5, z: A.z + 3, color: '#6F8FAF', face: -0.8 }).group);
    await ctx.wait(500);
    ctx.view.frame({ x: -1, z: 0.5 }, 13);
    ahe.cheer();
    await ctx.wait(900);
    ctx.complete({ stars: g === 4 ? 3 : 2 });
  },
});
