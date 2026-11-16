// 6-6 大禹的考验（终章）· 给整片河谷修一套水利
// 四件事连着做，每件都是前面学过的精简版：
// ① 测：用影子量出山上水库塔的高度（第 3 章）  ② 选线：渠先到河边取水再通到村子，用镜子找最短（6-3）
// ③ 定坡：给渠定匀匀的坡（6-1）  ④ 分水：先量三块田的面积（第 1 章），再按面积比分水（6-5）
// 最后：水流遍河谷，六章盖起来的田、城、塔、仓、桥、渠一样样亮起，镜头环绕一周，授予「大匠师」。
import * as THREE from 'three';
import { defineLevel } from '../../engine/level.js';
import { makeSun, makePole, measureRope, v3 as v3c } from '../ch3-survey/kit.js';
import { sForRatio } from '../ch3-survey/math.js';
import { layMats, countOut } from '../ch1-fields/kit.js';
import { makeSlope } from './slope.js';
import { mirrorRound } from './l3-cow.js';
import { splitRound } from './l5-fishmouth.js';
import { makeChannel, advance, makeReservoir, makeField } from './flow.js';
import { v3, C, block, exposeScreen, chapterStyles, makeHouse, injectStyles, mountDom, go, dur, waterMat, unitBoxY } from './kit.js';
import { icon } from '../../engine/icons.js';
import { mat } from '../../engine/shared.js';

const inPoly = (p, pts) => {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    if ((pts[i].z > p.z) !== (pts[j].z > p.z) && p.x < ((pts[j].x - pts[i].x) * (p.z - pts[i].z)) / (pts[j].z - pts[i].z) + pts[i].x) c = !c;
  }
  return c;
};

/** 多边形田：和 makeField 一样的接口（水位、庄稼），给分水用。水位用一块会长高的半透明多边形表示。 */
function makePolyField(ctx, { points, inlet, seed = 3 }) {
  const { props } = ctx;
  const base = props.polyField({ points, color: '#B98E57' });
  const over = props.polyField({ points, color: '#4FA3D8', opacity: 0.85, h: 0.34, y: 0.04, edge: null });
  over.scale.y = 0.001;
  over.visible = false;
  const xs = points.map((p) => p.x), zs = points.map((p) => p.z);
  const cx = xs.reduce((a, b) => a + b, 0) / xs.length, cz = zs.reduce((a, b) => a + b, 0) / zs.length;
  const flood = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.03, 20), new THREE.MeshPhongMaterial({ color: C.water, transparent: true, opacity: 0.5, depthWrite: false }));
  flood.position.set(cx, 0.03, cz);
  flood.visible = false;
  ctx.add(flood);
  const cells = [];
  for (let x = Math.floor(Math.min(...xs)); x < Math.max(...xs); x++) for (let z = Math.floor(Math.min(...zs)); z < Math.max(...zs); z++) {
    if (inPoly({ x: x + 0.5, z: z + 0.5 }, points)) cells.push({ x: x + 0.5, z: z + 0.5 });
  }
  let crops = null;
  const api = {
    inlet, center: () => v3(cx, 0, cz),
    setLevel(l) {
      over.visible = l > 0.01;
      over.scale.y = Math.max(0.001, Math.min(l, 1));
      const k = Math.max(0, l - 1.04);
      flood.visible = k > 0.01;
      if (k > 0.01) { const r = 2.6 + Math.min(1, k / 0.6) * 2.4; flood.scale.set(r, 1, r * 0.8); }
    },
    async grow() {
      if (!crops) crops = props.crops({ cells, kind: 'rice', per: 2, seed });
      await go(crops.grow({ stagger: 10, duration: 500, onEach: (c) => { if (c % 3 === 0) ctx.audio.play('grow', { n: c }); } }));
    },
    drainFlood() { flood.visible = false; },
    dispose() { ctx.remove(base); ctx.remove(over); ctx.remove(flood); if (crops) ctx.remove(crops.mesh); },
  };
  return api;
}

const STYLE = `
.c6-title { position: absolute; inset: 0; z-index: 7; display: flex; align-items: center; justify-content: center; pointer-events: none; }
.c6-title .card { background: rgba(255, 248, 234, 0.96); border: 3px solid var(--gold, #f2b134); border-radius: 28px; padding: 22px 54px 26px;
  text-align: center; color: var(--ink, #4a3a28); animation: c6-pop .7s cubic-bezier(.2,1.5,.4,1) both; }
.c6-title .card .ico { width: 64px; height: 64px; color: #E09A14; }
.c6-title .card b { display: block; font-size: 54px; letter-spacing: .25em; margin: 4px 0 2px .25em; }
.c6-title .card span { font-size: 22px; color: var(--ink-2, #7a6650); }
@keyframes c6-pop { from { opacity: 0; transform: scale(.5); } to { opacity: 1; transform: scale(1); } }
`;

export default defineLevel({
  id: 'ch6-l6',
  title: '大禹的考验',
  concept: '测·选线·定坡·分水',
  brief: '雨季要来了。老匠师把准绳和规矩交给你：给整片河谷修一套水利。',
  discovery: '量、画、算、搭——所有本事凑在一起，才治得了水。',

  async setup(ctx) {
    exposeScreen(ctx);
    chapterStyles(ctx);
    injectStyles(ctx, STYLE);
    const { props, geo } = ctx;
    props.ground({ w: 44, d: 26, z: 2, seed: 66, river: null, trees: 12, cells: false });
    ctx.view.frame({ x: -12, z: 8 }, 9.5, { instant: true, pitch: 50, yaw: 0 });
    await ctx.wait(500);

    // =========================================================== ① 测
    ctx.hud.progress(0, 4);
    ctx.state.step = 1;
    ctx.hud.task('先量水库塔有多高。塔够不着，用影子。');
    const sun = makeSun(ctx, { s: sForRatio(1, 'am') ?? 0.3, dial: false, focus: { x: 0, z: 2, r: 26 } });
    const H = 6;
    const tower = makePole(ctx, { x: -15, z: 7, h: H, w: 0.9, color: '#C9C2B2', ray: false });
    const pole = makePole(ctx, { x: -11, z: 7, h: 1 });
    for (const o of [tower, pole]) o.update(sun.dir, sun.ratio);
    ctx.state.tip = [tower.tipPos.x, tower.tipPos.z];
    const tank = new THREE.Group();
    tank.position.set(-15, H, 7);
    block('#A8A090', 2.4, 0.4, 2.4, { parent: tank });
    const tw = new THREE.Mesh(unitBoxY(), waterMat());
    tw.scale.set(2.0, 0.25, 2.0); tw.position.y = 0.4; tank.add(tw);
    ctx.add(tank);
    const poleLbl = ctx.labels.add(v3(-11, 1.6, 7), '竿高 1，影也是 1', { cls: 'tag', pop: false });
    const towerLbl = ctx.labels.add(v3(-15, H + 1.3, 7), '水库塔 高 ？', { cls: 'tag', pop: false });
    ctx.view.frame({ x: -11, z: 9.2 }, 9, { pitch: 50, yaw: 0 });
    const g = await ctx.guess({ kind: 'height', actual: H, prompt: '先猜：水库塔有几步高？', min: 2, max: 14, start: 8, unit: '步' });
    const meas = await measureRope(ctx, {
      from: { x: tower.x, z: tower.z }, to: { x: tower.tipPos.x, z: tower.tipPos.z }, every: 1,
      text: '竿的影子和竿一样长。拉绳量塔的影子。', hintText: '把金色绳头拉到塔影子尖上的金圈。', snapR: 1.6,
    });
    towerLbl.set(`水库塔 高 ${Math.round(meas.len)}`);
    ctx.nudge(`塔影 ${Math.round(meas.len)} 步，所以塔高 ${Math.round(meas.len)} 步。`, { kind: 'good' });
    ctx.audio.play('success');
    await ctx.wait(2000);
    meas.big.remove(); meas.rope.group.removeFromParent();
    poleLbl.remove(); towerLbl.remove();
    tower.hideShadow(true);
    for (const o of [pole]) { ctx.remove(o.group); ctx.remove(o.poly.mesh); ctx.remove(o.tip); ctx.remove(o.ray.mesh); }
    ctx.remove(tower.poly.mesh); ctx.remove(tower.tip);

    // =========================================================== ② 选线
    ctx.hud.progress(1, 4);
    ctx.state.step = 2;
    ctx.view.frame({ x: -1.5, z: 2.5 }, 11.5, { pitch: 54, yaw: 0 });
    const Rv = ctx.add(new THREE.Group());
    const sand = new THREE.Mesh(new THREE.BoxGeometry(46, 0.03, 1.4), new THREE.MeshLambertMaterial({ color: '#E2CD98' }));
    sand.position.set(0, 0.035, -0.5);
    Rv.add(sand);
    const wat = new THREE.Mesh(unitBoxY(), waterMat());
    wat.scale.set(46, 0.12, 5.6); wat.position.set(0, 0.04, -3.6); Rv.add(wat);
    const mt = new THREE.Group();
    mt.position.set(-0.5, 0, 5.2);
    block(C.mountain, 7, 1.6, 3.4, { parent: mt });
    block(C.mountainTop, 4.6, 1.2, 2.2, { y: 1.6, parent: mt });
    ctx.add(mt);
    ctx.hud.task('渠要先到河边取一次水，再通到村子。山挖不动，只能绕。');
    await ctx.wait(1200);
    const r2 = await mirrorRound(ctx, { V: { x: -9, z: 5 }, F: { x: 7, z: 3 }, first: false, canal: true });
    await ctx.wait(700);
    const canalPts = [{ x: -9, z: 5 }, { x: r2.D.x, z: 0 }, { x: 7, z: 3 }];
    r2.channel.dispose(); ctx.remove(r2.group);
    ctx.remove(mt); ctx.remove(Rv);

    // =========================================================== ③ 定坡
    ctx.hud.progress(2, 4);
    ctx.state.step = 3;
    ctx.view.frame({ x: 0, z: 6 }, 8.4, { pitch: 30, yaw: 0, y: 0.8 });
    ctx.hud.task('塔高 6 步，水要一路流下来。给渠定个匀匀的坡。');
    const x0 = -5.1, dx = 1.7;
    const tankB = makeReservoir(ctx, { x: x0 - 1.85, z: 6, w: 2.4, d: 2.8, y: H * 0.34 });
    const sl = makeSlope(ctx, {
      nodes: [6, 5, 5, 6, 2, 1, 0], solution: [6, 5, 4, 3, 2, 1, 0], x0, dx, z: 6, scale: 0.34, max: 8,
      names: { 0: '水库', 6: '田' },
    });
    sl.lock(false);
    sl.hint();
    const res3 = await sl.reached;
    sl.done();
    ctx.hint(null);
    ctx.nudge('每段降 1 尺，水走得又稳又远。', { kind: 'good' });
    await ctx.wait(1600);
    sl.dispose();
    ctx.remove(tankB.group);
    void res3;

    // =========================================================== ④ 分水
    ctx.hud.progress(3, 4);
    ctx.state.step = 4;
    ctx.view.frame({ x: 0, z: 2.2 }, 13.2, { pitch: 56, yaw: 0 });
    const Rg4 = ctx.add(new THREE.Group());
    makeReservoir(ctx, { x: 0, z: -9.2, w: 6.4, d: 2.4, y: 0.5, parent: Rg4 });
    const shapes = [
      { kind: 'rect', area: 12, name: '长方田', points: [{ x: -10, z: 4 }, { x: -7, z: 4 }, { x: -7, z: 8 }, { x: -10, z: 8 }], inlet: { x: -8.5, z: 4 } },
      { kind: 'tri', area: 6, name: '三角田', points: [{ x: -1.5, z: 4 }, { x: 1.5, z: 8 }, { x: -1.5, z: 8 }], inlet: { x: -1.5, z: 4 } },
      { kind: 'skew', area: 18, name: '斜田', points: [{ x: 5, z: 5 }, { x: 11, z: 5 }, { x: 13, z: 8 }, { x: 7, z: 8 }], inlet: { x: 8, z: 5 } },
    ];
    const draw = shapes.map((s) => props.polyField({ points: s.points, color: '#B98E57' }));
    // ---- 先量面积
    ctx.hud.task('三块田大小不同。点每块田的「量一量」，算出它有多大。');
    const measured = [false, false, false];
    const resLbl = [];
    let allMeasured;
    const mDone = ctx.waitFor((d) => { allMeasured = d; });
    const busy = { v: false };
    const tagBtns = [];
    async function measure(i) {
      if (measured[i] || busy.v) return;
      busy.v = true;
      tagBtns[i].show(false);
      const s = shapes[i];
      const rg = ctx.add(new THREE.Group());
      if (s.kind === 'rect') {
        const mats = await layMats(ctx, { x: -10, z: 4, w: 3, d: 4 }, { step: 45 });
        await countOut(ctx, { x: -10, z: 4, w: 3, d: 4 }, {});
        mats.forEach((m) => ctx.remove(m));
      } else if (s.kind === 'tri') {
        // 再来一个一样的三角田，转半圈，拼成长方形
        const cx = 0, cz = 6;
        rg.position.set(cx, 0, cz);
        const half = props.polyField({ points: s.points.map((p) => ({ x: p.x - cx, z: p.z - cz })), color: '#F2B134', parent: rg, y: 0.1 });
        void half;
        ctx.audio.play('rotate');
        await go(ctx.fx.tween({
          duration: dur(ctx, 1500), ease: 'inOut',
          onUpdate: (k) => { rg.rotation.y = Math.PI * k; rg.position.y = Math.sin(Math.PI * k) * 1.6; },
        }));
        rg.position.y = 0; ctx.audio.play('place');
        ctx.say('两个三角田拼成长方形，12 块，一个是 6 块');
        await ctx.wait(1500);
      } else {
        const tri = props.polyField({ points: [{ x: 5, z: 5 }, { x: 7, z: 5 }, { x: 7, z: 8 }], color: '#F2B134', parent: rg, y: 0.1 });
        void tri;
        ctx.audio.play('cut');
        await ctx.wait(300);
        await go(ctx.fx.tween({ duration: dur(ctx, 1400), ease: 'inOut', onUpdate: (k) => { rg.position.x = 6 * k; rg.position.y = Math.sin(Math.PI * k) * 1.2; } }));
        rg.position.y = 0; ctx.audio.play('place');
        ctx.say('切下一角挪过去，拼成长方形，6 乘 3，18 块');
        await ctx.wait(1500);
      }
      ctx.remove(rg);
      measured[i] = true;
      ctx.state.measured = measured.filter(Boolean).length;
      const c = s.kind === 'rect' ? v3(-8.5, 0.5, 6) : s.kind === 'tri' ? v3(-0.4, 0.5, 6.6) : v3(9, 0.5, 6.5);
      resLbl.push(ctx.labels.add(c, `${s.area}<small>块</small>`, { cls: 'big', pop: true }));
      ctx.audio.play('success');
      busy.v = false;
      if (measured.every(Boolean)) allMeasured();
    }
    // 等镜头飞稳了再冒出「量一量」，免得飞的途中压在任务条上
    await ctx.wait(900);
    shapes.forEach((s, i) => {
      const c = i === 0 ? v3(-8.5, 0.5, 6) : i === 1 ? v3(-0.4, 0.5, 6.6) : v3(9, 0.5, 6.5);
      tagBtns.push(ctx.labels.add(c, `量一量 ${s.name}`, { cls: 'tag', onTap: () => go(measure(i)) }));
    });
    ctx.hint({
      text: '点每块田上的「量一量」。',
      demo: async () => { for (let i = 0; i < 3; i++) { if (!measured[i]) { await measure(i); } } },
    });
    await mDone;
    ctx.hint(null);
    draw.forEach((d) => ctx.remove(d));
    resLbl.forEach((l) => l.remove());
    ctx.nudge('12 : 6 : 18，也就是 2 : 1 : 3。', { kind: 'good' });
    await ctx.wait(1800);
    // ---- 再分水
    const r4 = await splitRound(ctx, {
      names: ['长方田', '三角田', '斜田'], areas: [12, 6, 18],
      fields: shapes.map((s) => s), cuts0: [3, 4], sol: [2, 3],
      build: (s, i) => makePolyField(ctx, { points: s.points, inlet: s.inlet, seed: 20 + i }),
      intro: '总宽 6。拖两个鱼嘴，让三条渠的口宽对上三块田的面积。',
    });
    r4.hideLabels();
    await ctx.wait(500);
    r4.cleanup();
    ctx.remove(Rg4);
    ctx.hud.progress(4, 4);
    ctx.state.step = 5;

    // =========================================================== 终章：水流遍河谷
    ctx.hud.task('四件事都做完了。看，水流遍了整个河谷。');
    ctx.view.frame({ x: -1, z: 3 }, 17, { pitch: 42, yaw: -12 });
    await ctx.wait(900);
    const tags = [];
    const reveal = async (obj, text, at) => {
      if (obj) { obj.visible = true; await go(ctx.fx.pop(obj, { duration: 380 })); }
      ctx.audio.play('good');
      ctx.fx.sparkle(at, { size: 2.6, color: C.gold });
      tags.push(ctx.labels.add(v3(at.x, 2.2, at.z), text, { cls: 'tag warm', pop: true }));
      await ctx.wait(450);
    };
    // 河
    const Rv2 = ctx.add(new THREE.Group());
    const sand2 = new THREE.Mesh(new THREE.BoxGeometry(46, 0.03, 1.4), new THREE.MeshLambertMaterial({ color: '#E2CD98' }));
    sand2.position.set(0, 0.035, -0.5);
    Rv2.add(sand2);
    const wat2 = new THREE.Mesh(unitBoxY(), waterMat());
    wat2.scale.set(46, 0.12, 5.6); wat2.position.set(0, 0.04, -3.6); Rv2.add(wat2);
    // 桥
    const bridge = new THREE.Group();
    block('#A47148', 1.6, 0.22, 8, { y: 0.1, z: -3, parent: bridge });
    for (const sx of [-0.75, 0.75]) block('#8B6B43', 0.12, 0.5, 8, { x: sx, y: 0.3, z: -3, parent: bridge });
    bridge.position.x = -3;
    bridge.visible = false;
    ctx.add(bridge);
    // 城
    const city = new THREE.Group();
    city.position.set(-6, 0, 11);
    for (const [w, d, x, z] of [[8, 0.5, 0, -3.2], [8, 0.5, 0, 3.2], [0.5, 6.4, -4, 0], [0.5, 6.4, 4, 0]]) block('#C9B48A', w, 1.2, d, { x, z, parent: city });
    makeHouse(ctx, -1.8, -0.8, { parent: city, s: 0.8 });
    makeHouse(ctx, 1.8, 0.6, { parent: city, s: 0.8, roof: '#6F8FAF' });
    city.visible = false;
    ctx.add(city);
    // 仓
    const barn = new THREE.Group();
    barn.position.set(3, 0, 12);
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 2.2, 14), new THREE.MeshLambertMaterial({ color: '#E6D3A8' }));
    cyl.position.y = 1.1; cyl.castShadow = true;
    const cap = new THREE.Mesh(new THREE.ConeGeometry(1.6, 1.0, 14), new THREE.MeshLambertMaterial({ color: '#C9A447' }));
    cap.position.y = 2.7; cap.castShadow = true;
    barn.add(cyl, cap);
    barn.visible = false;
    ctx.add(barn);
    // 田
    const fields = [8.5, 13, 17.5].map((fx, i) => makeField(ctx, { x: fx - 1.5, z: 8, w: 3, d: 4, seed: 30 + i }));
    // 渠
    const main = makeChannel(ctx, { width: 0.9 });
    main.setPath([{ x: -14, y: 0.1, z: 7 }, ...canalPts.map((p) => ({ x: p.x, y: 0.1, z: p.z })), { x: 11, y: 0.1, z: 6 }]);
    const branches = fields.map((f) => {
      const b = makeChannel(ctx, { width: 0.6, wall: 0.1 });
      b.setPath([{ x: 11, y: 0.1, z: 6 }, { x: f.inlet.x, y: 0.1, z: 6 }, { x: f.inlet.x, y: 0.1, z: 8 }]);
      return b;
    });
    ctx.view.frame({ x: -1, z: 3 }, 17, { pitch: 42, yaw: -12 });
    await reveal(null, '塔', v3(-15, 0, 7).setY(0));
    await reveal(bridge, '桥', { x: -3, z: -3 });
    await reveal(city, '城', { x: -6, z: 11 });
    await reveal(barn, '仓', { x: 3, z: 12 });
    await reveal(null, '田', { x: 13, z: 10 });
    // 水
    ctx.audio.play('whoosh');
    await advance(ctx, main, main.total, () => 8);
    await Promise.all(branches.map((b) => advance(ctx, b, b.total, () => 7)));
    await go(ctx.fx.tween({ duration: dur(ctx, 1500), ease: 'out', onUpdate: (k) => fields.forEach((f) => f.setLevel(0.02 + 0.98 * k)) }));
    tags.push(ctx.labels.add(v3(0, 1.6, 2.6), '渠', { cls: 'tag warm', pop: true }));
    ctx.audio.play('success');
    ctx.fx.celebrate({ x: 6, z: 6 }, { count: 90 });
    fields.forEach((f) => f.grow({ stagger: 8 }));
    // 镜头环绕一周
    const ms = ctx.auto ? 1600 : 7500;
    await ctx.waitFor((done) => {
      let t = 0;
      const off = ctx.onUpdate((dt) => {
        t += dt * 1000;
        const k = Math.min(1, t / ms);
        ctx.view.frame({ x: -1, z: 3 }, 17, { yaw: -12 + 360 * k, pitch: 38 });
        if (k >= 1) { off(); done(); }
      });
    });
    ctx.view.frame({ x: -1, z: 3 }, 17, { yaw: -12, pitch: 42 });
    // 授予称号
    tags.forEach((l) => l.remove());
    const ov = document.createElement('div');
    ov.className = 'c6-title';
    const card = document.createElement('div');
    card.className = 'card';
    card.appendChild(icon('award', { size: 64, stroke: 2 }));
    card.insertAdjacentHTML('beforeend', '<b>大匠师</b><span>左准绳，右规矩，治住了洪水</span>');
    ov.appendChild(card);
    mountDom(ctx, ov);
    ctx.audio.play('star');
    ctx.say('授予你大匠师的称号');
    await ctx.wait(3200);
    ov.remove();
    const stars = ctx.hintsUsed >= 3 || ctx._solving ? 2 : 3;
    void geo; void g; void waterMat; void mat; void v3c;
    ctx.complete({ stars, delay: 600 });
  },
});
