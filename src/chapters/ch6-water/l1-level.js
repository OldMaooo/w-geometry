// 6-1 水往低处流 · 找平和坡度
// 水库在山上，田在山脚。渠由九根柱子撑着，拖柱顶的金球调高低；点「放水」，水一段一段往下流：
// 遇到更高的就停、漫出去；一段降太多会冲坏渠。每段只降一点点，水就能走很远。
import { defineLevel } from '../../engine/level.js';
import { makeSlope } from './slope.js';
import { makeField, makeReservoir } from './flow.js';
import { v3, C, block, exposeScreen, go, dur } from './kit.js';
import { waterMat } from './kit.js';
import * as THREE from 'three';

// 水库 10 尺、田 2 尺；中间 7 根柱子。第 3 根太高（上坡），第 4 根降得太陡。
export const L1_NODES = [10, 9, 9, 10, 6, 5, 5, 4, 2];
export const L1_SOLUTION = [10, 9, 8, 7, 6, 5, 4, 3, 2];

export default defineLevel({
  id: 'ch6-l1',
  title: '水往低处流',
  concept: '找平·坡度',
  brief: '水库在山上，田在山脚。渠挖好了，可是水流到一半就不走了。',
  discovery: '水比眼睛更会看高低；一点点坡，就够它走很远。',

  async setup(ctx) {
    exposeScreen(ctx);
    const { props, geo } = ctx;
    props.ground({ w: 32, d: 12, seed: 61, river: null, trees: 7, cells: false });
    ctx.view.shadow({ x: -1, z: 0 }, 17);
    ctx.view.frame({ x: -0.4, z: 0.6 }, 9.7, { instant: true, pitch: 30, yaw: 0, y: 1 });
    const x0 = -10, dx = 2, S = 0.34;
    const Y = (h) => h * S;
    // 水库（山上的水池）和田
    makeReservoir(ctx, { x: x0 - 1.95, z: 0, w: 2.7, d: 3.2, y: Y(10) });
    const field = makeField(ctx, { x: x0 + 8 * dx + 1.1, z: -2.5, w: 5, d: 5, seed: 8 });
    const farmer = props.villager({ x: x0 + 8 * dx + 3.5, z: 3.6, face: 3.3, color: '#C08A3E' });
    props.rock({ x: -13, z: 4.6, s: 0.8 });

    const sl = makeSlope(ctx, {
      nodes: L1_NODES, solution: L1_SOLUTION, x0, dx, scale: S, names: { 0: '水库', 8: '田' },
    });
    sl.lock(true);
    sl.tool.hide();
    const g = await ctx.guess({ kind: 'height', actual: 8, prompt: '先猜：水库比田高几尺？', min: 1, max: 14, start: 5, unit: '尺' });
    sl.lock(false);
    sl.tool.show();
    ctx.hud.task('拖金球上下调高低，让水一路流到田里。再点「放水」。');
    sl.hint();
    const res = await sl.reached;
    sl.done();
    ctx.hint(null);
    // 水落进田里，田变绿
    const end = sl.channel.pointAt(sl.channel.total);
    const fall = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1, 1.0), waterMat());
    fall.geometry.translate(0, 0.5, 0);
    fall.position.set(end.x + 0.75, 0, end.z);
    fall.scale.y = Math.max(0.1, end.y);
    ctx.add(fall);
    ctx.audio.play('pop');
    ctx.hud.task('水到田里了！');
    field.setLevel(0.02);
    await go(ctx.fx.tween({
      duration: dur(ctx, 1500), ease: 'out',
      onUpdate: (k) => { field.setLevel(0.02 + k * 0.98); if (Math.random() < 0.08) ctx.audio.play('soft'); },
    }));
    ctx.audio.play('success');
    ctx.fx.sparkle(field.center(), { size: 3 });
    farmer.cheer();
    await field.grow({ stagger: 12 });
    ctx.state.nodes = res.nodes.join(',');
    await ctx.wait(900);
    const drop = res.nodes[0] - res.nodes[res.nodes.length - 1];
    const lbl = ctx.labels.add(v3(end.x + 0.2, end.y + 1.6, 0), `共降 ${drop} 尺`, { cls: 'say' });
    void lbl;
    ctx.fx.celebrate({ x: field.center().x, z: field.center().z }, { count: 60 });
    await ctx.wait(1100);
    void geo; void g; void C; void block;
    ctx.complete({ stars: res.stars || 2 });
  },
});
