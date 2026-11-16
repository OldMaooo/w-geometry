// 6-4 渠挖多大 · 截面
// 田里每天要 12 桶水。切开渠看横截面：拖三个把手改渠口、渠底、深度，里面的小格数就是每次能过的水量。
// 方渠凑 12 格；土渠两边要有斜坡（太陡会垮）；最后先猜一个梯形几格，再切拼验证。
import * as THREE from 'three';
import { defineLevel } from '../../engine/level.js';
import { effectiveSection, trapArea } from './math.js';
import { makeSectionBoard } from './board.js';
import { makeField } from './flow.js';
import { v3, exposeScreen, chapterStyles, go, dur, waterMat, unitBoxY } from './kit.js';
import { mat } from '../../engine/shared.js';

const LEN = 16;

/** 3D 的渠：沿 x 方向的一条沟，按截面 {b,t,d} 实时重画；水面是沟里的一条水。 */
function makeTrench(ctx) {
  const g = ctx.add(new THREE.Group());
  const soilMat = new THREE.MeshLambertMaterial({ color: '#B98E57' });
  let soil = null, water = null, capL = null, capR = null;
  const grass = mat('#A3C46C');
  capL = new THREE.Mesh(unitBoxY(), grass); capR = new THREE.Mesh(unitBoxY(), grass);
  capL.scale.y = capR.scale.y = 0.08;
  capL.receiveShadow = capR.receiveShadow = true;
  g.add(capL, capR);
  const extrude = (pts) => {
    const sh = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
    const geo = new THREE.ExtrudeGeometry(sh, { depth: LEN, bevelEnabled: false });
    geo.translate(0, 0, -LEN / 2);
    geo.rotateY(Math.PI / 2);
    return geo;
  };
  const flow = { k: 1 };
  function set(e) {
    const H = 7;
    const geoS = extrude([[-9, 0], [-e.t / 2, 0], [-e.b / 2, -e.d], [e.b / 2, -e.d], [e.t / 2, 0], [9, 0], [9, -H], [-9, -H]]);
    if (soil) { soil.geometry.dispose(); soil.geometry = geoS; } else { soil = new THREE.Mesh(geoS, soilMat); soil.receiveShadow = true; soil.castShadow = true; g.add(soil); }
    const s = -0.3, hw = (e.t / 2) - ((e.t - e.b) / 2) * (-s / e.d);
    const geoW = extrude([[-hw, s], [hw, s], [e.b / 2, -e.d + 0.02], [-e.b / 2, -e.d + 0.02]]);
    if (water) { water.geometry.dispose(); water.geometry = geoW; } else { water = new THREE.Mesh(geoW, waterMat()); water.visible = false; g.add(water); }
    for (const [c, sgn] of [[capL, -1], [capR, 1]]) {
      const w = 9 - e.t / 2;
      c.scale.set(LEN, 0.08, w);
      c.position.set(0, 0, sgn * (e.t / 2 + w / 2));
    }
  }
  return {
    group: g, set,
    /** 水从左往右灌满沟。 */
    async fill(ms = 1600) {
      water.visible = true;
      water.scale.x = 0.001;
      water.position.x = -LEN / 2;
      await go(ctx.fx.tween({ duration: dur(ctx, ms), ease: 'out', onUpdate: (k) => { water.scale.x = Math.max(0.001, k); water.position.x = -(LEN / 2) * (1 - k); } }));
      water.scale.x = 1; water.position.x = 0;
    },
    dry() { if (water) { water.visible = false; water.scale.x = 1; water.position.x = 0; } },
  };
}

export default defineLevel({
  id: 'ch6-l4',
  title: '渠挖多大',
  concept: '截面·梯形面积',
  brief: '田里每天需要 12 桶水。渠挖太小水不够，挖太大白费工。',
  discovery: '梯形就是把两头的小三角补成长方形：上底加下底，取中间那么宽。',

  async setup(ctx) {
    exposeScreen(ctx);
    chapterStyles(ctx);
    const { props, geo } = ctx;
    ctx.state.round = 0;
    // 地：草地底座 + 田（沟自己带土）
    const base = new THREE.Mesh(new THREE.BoxGeometry(34, 0.2, 24), mat('#A3C46C'));
    base.position.set(3, -7.1, 0);
    ctx.add(base);
    const trench = makeTrench(ctx);
    const field = makeField(ctx, { x: LEN / 2 + 1.2, z: -2.2, w: 4, d: 4.4, seed: 4 });
    props.tree({ x: -6, z: 6.5, kind: 'round', s: 1.1 });
    props.tree({ x: 3, z: -7, kind: 'pine', s: 1.1 });
    props.villager({ x: LEN / 2 + 2.5, z: 3, face: 3.3, color: '#C08A3E' });
    ctx.view.shadow({ x: 2, z: 0 }, 17);
    ctx.view.frame({ x: 4, z: 1 }, 12.5, { instant: true, pitch: 36, yaw: -50, y: -1 });

    let board = null;
    let allowed = false;
    async function water() {
      field.setLevel(0.02);
      await trench.fill(1500);
      ctx.audio.play('pop');
      await go(ctx.fx.tween({ duration: dur(ctx, 1100), ease: 'out', onUpdate: (k) => field.setLevel(0.02 + k * 0.98) }));
      ctx.audio.play('success');
      ctx.fx.sparkle(field.center(), { size: 2.6 });
      await field.grow({ stagger: 6 });
    }
    function reset() { trench.dry(); field.setLevel(0); field.clearCrops(); }

    /** 一轮可拖的：达到 12 格且不垮就算成。 */
    async function build({ mode, sec, minSlope, text, tipSmall, tipBig, tipSteep, solution }) {
      board = makeSectionBoard(ctx, { mode, sec, target: 12, minSlope });
      board.onChange((_, e) => trench.set(e));
      trench.set(board.eff);
      ctx.hud.task(text);
      await ctx.waitFor((done) => {
        board.onRelease((s, e) => {
          if (!allowed) return;
          const a = trapArea(e);
          if (e.collapsed) { ctx.nudge(tipSteep); return; }
          if (Math.abs(a - 12) < 1e-9) { board.lock(true); done(); return; }
          ctx.nudge(a < 12 ? tipSmall : tipBig);
        });
        allowed = true;
        ctx.hint({
          text: mode === 'square' ? '拖把手改宽和深，让格数刚好 12。' : '口开大、底收小，边就有斜坡；再让格数刚好 12。',
          demo: async () => { await board.tweenTo(solution, 1200); },
        });
      });
      ctx.hint(null);
      ctx.audio.play('good');
      await water();
      ctx.nudge('12 桶水，刚刚好。', { kind: 'good' });
      await ctx.wait(1200);
      board.remove();
      reset();
    }

    ctx.hud.progress(0, 3);
    await build({
      mode: 'square', sec: { b: 3, t: 3, d: 2 }, text: '拖把手，挖一条方渠，让能过 12 格水。',
      tipSmall: '水不够，再挖大一点。', tipBig: '挖太大了，白费工。再小一点。', tipSteep: '', solution: { t: 4, d: 3 },
    });
    ctx.hud.progress(1, 3);
    await build({
      mode: 'trap', minSlope: 0.5, sec: { b: 4, t: 4, d: 3 }, text: '土渠两边要有斜坡，不然会塌。还是凑 12 格。',
      tipSmall: '水不够，再挖大一点。', tipBig: '挖太大了，白费工。再小一点。',
      tipSteep: '边太陡，土垮下来了。把口开大一点。', solution: { b: 4, t: 8, d: 2 },
    });

    // ---- 第三轮：先猜，再切拼验证
    ctx.hud.progress(2, 3);
    const S3 = { b: 2, t: 6, d: 3 };
    board = makeSectionBoard(ctx, { mode: 'fixed', sec: S3, caption: '口 6 · 底 2 · 深 3' });
    trench.set(effectiveSection(S3, 0));
    ctx.hud.task('这条渠口宽 6、底宽 2、深 3。能过多少格水？');
    const g = await ctx.guess({ kind: 'area', actual: 12, prompt: '先猜：这条渠一次能过几格水？', min: 2, max: 30, start: 10, unit: '格' });
    ctx.hud.task('点「切一切」，把两头的小三角补成长方形。');
    const cutBtn = ctx.hud.tool({ icon: 'cut', label: '切一切', primary: true, onTap: () => go(run()) });
    let ran = false, finishCut;
    const cutDone = new Promise((r) => { finishCut = r; });
    async function run() {
      if (ran) return; ran = true;
      cutBtn.hide();
      ctx.hint(null);
      const r = await board.cutAndPaste();
      ctx.state.cut = r.total;
      ctx.say(`${r.m} 个一行，${r.rows} 行，${r.total} 格`);
      finishCut();
    }
    ctx.hint({ text: '点「切一切」。', demo: async () => { cutBtn.tap(); await cutDone; } });
    await cutDone;
    ctx.audio.play('success');
    await ctx.wait(1400);
    ctx.nudge(`${g === 12 ? '你猜对了！' : `你猜 ${g}，其实是 12。`}`, { kind: 'good' });
    await water();
    ctx.hud.progress(3, 3);
    await ctx.wait(1000);
    board.remove();
    ctx.complete({ stars: geo.starsByError(Math.abs(g - 12), 0, 1) });
  },
});
