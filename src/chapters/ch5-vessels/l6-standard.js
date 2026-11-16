// 5-6 造一个标准斗（本章大关）
// 国王要统一量器：造一个正好装 24 斗的方箱，全国照着做，木板还要省。
// 三个滑块调长、宽、高（1–8），箱子实时变形，显示「能装多少斗」「用了多少块板」（无盖：底 + 四面墙）。
// 第一步造出 24 斗；第二步找用板最少的那个（4×3×2，40 块）。
import * as THREE from 'three';
import { defineLevel } from '../../engine/level.js';
import { boxVolume, openBoxArea, bestBox } from './math.js';
import { v3, C, makePanel, makeInfo, makeSlider, domGhost, wf } from './kit.js';

const GOAL = 24;
const BEST = bestBox(GOAL); // 3×4×2，40 块
const MAX = 8;

export default defineLevel({
  id: 'ch5-l6',
  title: '造一个标准斗',
  concept: '容积·最省料',
  brief: '国王要统一量器：造一个正好装 24 斗的方箱，全国照着做。',
  discovery: '同样装 24 斗，有的箱子费料、有的省料。越接近方方正正的越省。',

  async setup(ctx) {
    const { props } = ctx;
    props.ground({ w: 24, d: 13, seed: 56, river: null, trees: 6 });
    ctx.view.shadow({ x: 0, z: 0 }, 13);
    ctx.view.frame({ x: 2.6, z: 0 }, 7.4, { instant: true, y: 2 });
    const king = props.villager({ x: -5.6, z: 4, color: '#C8553D', face: 0.7, s: 1.15 });

    // ---- 箱子：地板 + 四面墙（半透明，看得见里面）+ 一格一格的 1 斗方块 ----
    const box = new THREE.Group();
    ctx.add(box);
    const woodM = new THREE.MeshLambertMaterial({ color: '#B98E57' });
    const glassM = new THREE.MeshLambertMaterial({ color: '#C99B5A', transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide });
    const unit = new THREE.BoxGeometry(1, 1, 1);
    const floor = new THREE.Mesh(unit, woodM);
    floor.receiveShadow = true;
    const walls = [0, 1, 2, 3].map(() => new THREE.Mesh(unit, glassM));
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(unit), new THREE.LineBasicMaterial({ color: '#7A5230' }));
    box.add(floor, edges, ...walls);
    const cubes = new THREE.InstancedMesh(new THREE.BoxGeometry(0.9, 0.9, 0.9), new THREE.MeshLambertMaterial({ color: C.grain }), MAX * MAX * MAX);
    cubes.castShadow = true;
    cubes.count = 0;
    box.add(cubes);
    const dummy = new THREE.Object3D();

    const dims = { L: 2, W: 2, H: 2 };
    const lblL = ctx.labels.add(v3(0, 0, 0), '', { cls: 'num', pop: false });
    const lblW = ctx.labels.add(v3(0, 0, 0), '', { cls: 'num', pop: false });
    const lblH = ctx.labels.add(v3(0, 0, 0), '', { cls: 'num', pop: false });
    const lblV = ctx.labels.add(v3(0, 0, 0), '', { cls: 'big', pop: false });
    const tried = new Set();
    let bestArea = Infinity;
    let reached = false;
    let bestFound = false;
    let confirmTries = 0;
    let finishResolve;
    const finished = wf(ctx, (res) => { finishResolve = res; });

    const panel = makePanel(ctx, { top: 168, width: 350 });
    const infoV = makeInfo(panel);
    const infoA = makeInfo(panel);
    const infoB = makeInfo(panel);
    const sliders = {};

    const layout = () => {
      const { L, W, H } = dims;
      const t = 0.12;
      floor.scale.set(L, 0.1, W);
      floor.position.set(0, 0.05, 0);
      edges.scale.set(L, H, W);
      edges.position.set(0, H / 2, 0);
      walls[0].scale.set(L, H, t); walls[0].position.set(0, H / 2, W / 2);
      walls[1].scale.set(L, H, t); walls[1].position.set(0, H / 2, -W / 2);
      walls[2].scale.set(t, H, W); walls[2].position.set(-L / 2, H / 2, 0);
      walls[3].scale.set(t, H, W); walls[3].position.set(L / 2, H / 2, 0);
      let n = 0;
      for (let k = 0; k < H; k++) for (let j = 0; j < W; j++) for (let i = 0; i < L; i++) {
        dummy.position.set(-L / 2 + i + 0.5, 0.1 + k + 0.45, -W / 2 + j + 0.5);
        dummy.updateMatrix();
        cubes.setMatrixAt(n++, dummy.matrix);
      }
      cubes.count = n;
      cubes.instanceMatrix.needsUpdate = true;
      lblL.target = v3(0, 0.2, W / 2 + 0.2); lblL.set(L);
      lblW.target = v3(L / 2 + 0.2, 0.2, 0); lblW.set(W);
      lblH.target = v3(-L / 2 - 0.2, H / 2, W / 2); lblH.set(H);
      lblV.target = v3(0, H, 0);
      const V = boxVolume(L, W, H);
      const A = openBoxArea(L, W, H);
      const ok = V === GOAL;
      lblV.set(`${V}<small>斗</small>`).cls('ok', ok);
      infoV.html(`<span>能装</span><b class="${ok ? 'ok' : ''}">${V}</b><span>斗</span>`);
      infoA.html(`<span>用了</span><b>${A}</b><span>块板</span>`);
      infoB.html(bestArea < Infinity ? `<span>造出 24 斗的最省记录</span><b>${bestArea}</b><span>块</span>` : '');
    };

    const onDims = () => {
      layout();
      const { L, W, H } = dims;
      if (boxVolume(L, W, H) !== GOAL) return;
      const A = openBoxArea(L, W, H);
      tried.add(`${Math.min(L, W)}-${Math.max(L, W)}-${H}`);
      const first = !reached;
      reached = true;
      if (A < bestArea) { bestArea = A; layout(); }
      ctx.audio.play('star');
      ctx.fx.sparkle({ x: 0, z: 0 }, { size: Math.max(L, W) * 0.9 });
      if (A === BEST.area) {
        bestFound = true;
        king.cheer();
        ctx.nudge(`${A} 块板，最省了！`, { kind: 'good' });
        finishResolve();
      } else if (first) {
        king.cheer();
        ctx.nudge('正好 24 斗！还能更省板吗？', { kind: 'good' });
        ctx.hud.task('能装 24 斗的箱子有好几种。看看「用了几块板」，找最省的。');
        okBtn.show().pulse(true);
      } else {
        ctx.nudge(`${A} 块板。还有更省的吗？`, { kind: 'good', speak: false });
      }
    };

    const rows = [['L', '长'], ['W', '宽'], ['H', '高']];
    rows.forEach(([key, label]) => {
      sliders[key] = makeSlider(ctx, panel, {
        label, min: 1, max: MAX, value: dims[key],
        onChange: (v) => { dims[key] = v; onDims(); },
      });
    });
    layout();

    // 「就这样」：造出 24 斗后才出现
    const okBtn = ctx.hud.tool({
      icon: 'check', label: '就这样', primary: true, hidden: true,
      onTap: () => {
        if (boxVolume(dims.L, dims.W, dims.H) !== GOAL) { ctx.nudge('要正好装 24 斗才行。'); return; }
        if (openBoxArea(dims.L, dims.W, dims.H) === BEST.area) { bestFound = true; finishResolve(); return; }
        confirmTries++;
        if (confirmTries === 1) { ctx.nudge('还有更省板的。再试试别的长宽高。'); return; }
        finishResolve();
      },
    });

    ctx.hud.task('拖三个滑块，造一个正好能装 24 斗的方箱。');

    // ---- 提示：先造出 24，再找最省 ----
    const setDims = async (L, W, H) => {
      for (const [k, v] of [['L', L], ['W', W], ['H', H]]) {
        if (dims[k] !== v) { sliders[k].set(v); await ctx.wait(650); }
      }
    };
    ctx.hint({
      text: '三个数乘起来要等于 24，比如 2、3、4。拖滑块试试。',
      ghost: () => {
        const T = reached ? { L: 4, W: 3, H: 2 } : { L: 2, W: 3, H: 4 };
        const key = ['L', 'W', 'H'].find((k) => dims[k] !== T[k]) ?? 'L';
        return domGhost(ctx, () => sliders[key].thumbCenter(), () => sliders[key].dotCenter(T[key]), 1500);
      },
      demo: async () => {
        if (!reached) await setDims(2, 3, 4);
        else await setDims(4, 3, 2);
        await ctx.wait(500);
      },
    });
    await finished;
    ctx.hint(null);
    panel.remove();
    okBtn.hide();
    lblL.remove(); lblW.remove(); lblH.remove();
    ctx.audio.play('success');
    king.cheer();
    ctx.view.frame({ x: 0, z: 0 }, 6.2, { y: 1.4 });
    await ctx.wait(1200);
    ctx.nudge(bestFound ? '最省的标准斗：4 × 3 × 2，只用 40 块板。' : '这个箱子可以。其实还有更省板的。', { kind: 'good' });
    await ctx.wait(3000);
    lblV.remove();
    ctx.complete({ stars: bestFound ? 3 : tried.size >= 3 ? 2 : 1 });
  },
});
