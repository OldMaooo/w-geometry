// 4-6 方块金字塔（本章大关）
// 4 层阶梯金字塔：顶上 1 块，往下每层大一圈。先猜一共几块，一层层搭；每搭完一层，计数牌翻出这一层的块数 1、4、9、16。
// 国王说「再加一层」：先猜多运几块（25），搭好后日出，金字塔投下长长的影子。
import * as THREE from 'three';
import { defineLevel } from '../../engine/level.js';
import { mat, shared } from '../../engine/shared.js';
import { icon } from '../../engine/icons.js';
import { makeBlocks, modeTools, bindTaps, sweepIn, injectStyles, mountDom, BASE_CSS, v3, go, dur, C } from './kit.js';
import { pyramidTotal } from './math.js';

const CSS = `${BASE_CSS}
.c4-pyr { left: 14px; top: 84px; width: 218px; padding: 8px 10px 10px; display: flex; flex-direction: column; gap: 5px; }
.c4-pr { display: grid; grid-template-columns: 44px 1fr 44px; align-items: center; gap: 8px; height: 46px; padding: 0 8px; border-radius: 12px;
  background: var(--paper-2, #f6ecd6); border: 1.5px solid var(--line, rgba(74,58,40,.16)); transition: background-color .3s, border-color .3s; }
.c4-pr .mini { display: grid; gap: 1.5px; width: 38px; height: 38px; justify-self: center; align-content: center; justify-content: center; }
.c4-pr .mini i { border-radius: 2px; background: rgba(74, 58, 40, 0.18); transition: background-color .35s; }
.c4-pr .nm { font-size: 17px; color: var(--ink-2, #7a6650); }
.c4-pr .v { font-size: 26px; text-align: right; font-variant-numeric: tabular-nums; color: rgba(74,58,40,.35); }
.c4-pr.on { background: #fff3cf; border-color: var(--gold, #f2b134); }
.c4-pr.on .mini i { background: #E0B04F; }
.c4-pr.on .v { color: var(--ink, #4a3a28); animation: c4flip .5s ease-out; }
@keyframes c4flip { from { transform: rotateX(90deg); } to { transform: none; } }
.c4-pr.now { border-color: #8B6B43; }
.c4-sum { display: flex; justify-content: space-between; align-items: baseline; padding: 2px 10px 0; font-size: 19px; }
.c4-sum b { font-size: 28px; font-variant-numeric: tabular-nums; }
`;

const SIZES = [4, 3, 2, 1]; // 自下而上
const LAYER_COLORS = ['#D8C08A', '#E3CD9B', '#EBD8A9', '#F2E3B8', '#CDB47B'];

export default defineLevel({
  id: 'ch4-l6',
  title: '方块金字塔',
  concept: '平方数·层层相加',
  brief: '国王要一座 4 层的阶梯金字塔。顶上 1 块，往下每层大一圈。要准备多少块石头？',
  discovery: '每一层都是一个正方形：1、4、9、16、25……',

  async setup(ctx) {
    const { props, geo, fx } = ctx;
    injectStyles(ctx, CSS);
    props.ground({ w: 18, d: 14, seed: 96, river: null, trees: 6, cells: false, soil: '#E3CE98' });
    ctx.view.shadow({ x: 0, z: 0 }, 13);
    props.villager({ x: -6.8, z: 3.6, color: '#6F8FAF', face: 0.6 });
    props.villager({ x: 7, z: 4.2, color: '#C8553D', face: -0.5, s: 0.95 });
    props.rock({ x: 6.2, z: -3.4, s: 0.8 });
    const accs = [];

    // 计数牌
    const card = document.createElement('div');
    card.className = 'c4-card c4-pyr';
    mountDom(ctx, card);
    const rows = [];
    const sumEl = document.createElement('div');
    sumEl.className = 'c4-sum';
    const mkRow = (n, label) => {
      const r = document.createElement('div');
      r.className = 'c4-pr';
      const mini = document.createElement('div');
      mini.className = 'mini';
      mini.style.gridTemplateColumns = `repeat(${n}, ${Math.floor(34 / n) - 1}px)`;
      mini.style.gridAutoRows = `${Math.floor(34 / n) - 1}px`;
      for (let i = 0; i < n * n; i++) mini.appendChild(document.createElement('i'));
      const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = label;
      const v = document.createElement('span'); v.className = 'v'; v.textContent = '?';
      r.append(nm, mini, v);
      return { el: r, mini, v, n };
    };
    const rowFor = {};
    for (let n = 1; n <= 4; n++) { const r = mkRow(n, `${n}`); rowFor[n] = r; card.appendChild(r.el); rows.push(r); }
    card.appendChild(sumEl);
    let sum = 0;
    const showSum = () => { sumEl.innerHTML = `<span>一共</span><b>${sum || '?'}</b>`; };
    showSum();
    const flip = (n) => { const r = rowFor[n]; r.el.classList.add('on'); r.el.classList.remove('now'); r.v.textContent = String(n * n); r.v.style.animation = 'none'; void r.v.offsetWidth; r.v.style.animation = ''; sum += n * n; showSum(); };

    // 底座与方块
    const mainBlocks = makeBlocks(ctx, {
      cell: (i, j, k) => { const n = SIZES[k]; return { x: i - (n - 1) / 2, y: k + 0.5, z: j - (n - 1) / 2 }; },
      color: (i, j, k) => LAYER_COLORS[k % 5],
    });
    const extraBlocks = makeBlocks(ctx, {
      cell: (i, j) => ({ x: i - 2, y: 0.5, z: j - 2 }),
      color: () => LAYER_COLORS[4],
    });
    const pad = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.1, 5.8), mat('#C9B07A'));
    pad.position.y = -0.03;
    pad.receiveShadow = true;
    ctx.add(pad);

    ctx.view.frame({ x: 0, z: 0 }, 6.6, { yaw: 16, pitch: 28, y: 1.6, instant: true });
    await sweepIn(ctx, { x: 0, z: 0 }, 6.6, { yaw0: -30, yaw1: 14, pitch: 28, y: 1.6, ms: 2400 });

    // ---------- 先猜 ----------
    ctx.hud.task('先猜猜：一共要几块石头？');
    const g1 = await ctx.guess({ kind: 'volume', actual: 30, prompt: '先猜：一共要几块石头？', min: 1, max: 60, start: 20, unit: '块' });
    accs.push(geo.guessAccuracy(g1, 30));

    // ---------- 一层层搭 ----------
    const tools = modeTools(ctx, (m) => { st.mode = m; hoverGhost.visible = false; });
    const fillBtn = ctx.hud.tool({ icon: 'layers', label: '铺满这一层', onTap: () => { go(fillLayer()); } });
    const st = { mode: 'place', blocks: mainBlocks, k: 0, n: 4, yBase: 0, label: 4, active: false, off: 0 };
    const plan = ctx.add(new THREE.Group());
    const tiles = [];
    const hoverGhost = new THREE.Mesh(shared(new THREE.BoxGeometry(1, 1, 1)), mat('#F7D56A', { opacity: 0.55 }));
    hoverGhost.scale.setScalar(0.98);
    hoverGhost.visible = false;
    ctx.add(hoverGhost);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const cellOf = (ray) => {
      plane.constant = -(st.yBase + st.k + st.off);
      const out = new THREE.Vector3();
      if (!ray.ray.intersectPlane(plane, out)) return null;
      const i = Math.floor(out.x + st.n / 2), j = Math.floor(out.z + st.n / 2);
      if (i < 0 || j < 0 || i >= st.n || j >= st.n) return null;
      return { i, j };
    };
    const cellPos = (i, j) => v3(i - (st.n - 1) / 2, st.yBase + st.k + st.off + 0.5, j - (st.n - 1) / 2);
    const filled = () => { let c = 0; for (let j = 0; j < st.n; j++) for (let i = 0; i < st.n; i++) if (st.blocks.has(i, j, st.k)) c++; return c; };
    let resolveLayer = null;
    const afterChange = () => { if (filled() === st.n * st.n) { const r = resolveLayer; resolveLayer = null; r?.(); } };
    const tapCell = (c) => {
      if (!st.active || !c) return;
      if (st.mode === 'place') {
        if (st.blocks.has(c.i, c.j, st.k)) return;
        st.blocks.add(c.i, c.j, st.k);
        ctx.fx.sparkle({ x: cellPos(c.i, c.j).x, z: cellPos(c.i, c.j).z }, { size: 0.6, color: '#F7D56A' });
      } else if (st.blocks.has(c.i, c.j, st.k)) st.blocks.remove(c.i, c.j, st.k);
      afterChange();
    };
    const taps = bindTaps(ctx, {
      onTap: (ray) => tapCell(cellOf(ray)),
      onHover: (ray) => {
        const c = ray && st.active ? cellOf(ray) : null;
        if (!c || st.mode !== 'place' || st.blocks.has(c.i, c.j, st.k)) { hoverGhost.visible = false; return; }
        hoverGhost.position.copy(cellPos(c.i, c.j));
        hoverGhost.visible = true;
      },
    });
    const showPlan = () => {
      tiles.splice(0).forEach((t) => ctx.remove(t));
      for (let j = 0; j < st.n; j++) for (let i = 0; i < st.n; i++) {
        const t = new THREE.Mesh(shared(new THREE.BoxGeometry(1, 1, 1)), mat((i + j) % 2 ? '#F7D56A' : '#EAC24D', { opacity: 0.4 }));
        const p = cellPos(i, j);
        t.scale.set(0.94, 0.06, 0.94);
        t.position.set(p.x, p.y - 0.46, p.z);
        t.renderOrder = 2;
        plan.add(t);
        tiles.push(t);
      }
    };
    async function fillLayer() {
      if (!st.active) return;
      let n = 0;
      for (let j = 0; j < st.n; j++) for (let i = 0; i < st.n; i++) {
        if (st.blocks.has(i, j, st.k)) continue;
        st.blocks.add(i, j, st.k, { delay: n++ * 50 });
      }
      await ctx.wait(n * 50 + 400);
      afterChange();
    }
    const nextEmpty = () => { for (let j = 0; j < st.n; j++) for (let i = 0; i < st.n; i++) if (!st.blocks.has(i, j, st.k)) return { i, j }; return null; };
    const layerHint = {
      text: '点格子放石块，把这一层铺满。也可以点「铺满这一层」。',
      ghost: () => { const c = nextEmpty(); if (!c) return () => {}; const p = cellPos(c.i, c.j); return ctx.fx.ghostHand(p.clone().add(v3(1.6, 1.6, 1.6)), p); },
      demo: async () => { fillBtn.tap(); await ctx.wait(600); },
    };

    const buildLayer = async (blocksObj, k, n, label, opt = {}) => {
      Object.assign(st, { blocks: blocksObj, k, n, label, off: opt.off ?? 0, yBase: 0, active: true });
      showPlan();
      rowFor[label]?.el.classList.add('now');
      ctx.hud.task(label === 5 ? '再搭最下面一层：每边 5 块。' : k === 0 ? '先搭最下面一层：每边 4 块。' : `上面一层，每边少一块：${n} 块。`);
      ctx.hint(layerHint);
      await ctx.waitFor((done) => { resolveLayer = done; afterChange(); });
      ctx.hint(null);
      st.active = false;
      hoverGhost.visible = false;
      tiles.splice(0).forEach((t) => ctx.remove(t));
      ctx.audio.play('good');
      ctx.fx.sparkle({ x: 0, z: 0 }, { size: 1.6 + n * 0.3, color: '#F7D56A' });
      flip(label);
      ctx.say(`${n} 乘 ${n}，${n * n} 块。`);
      await ctx.wait(1300);
    };

    for (let k = 0; k < 4; k++) await buildLayer(mainBlocks, k, SIZES[k], SIZES[k]);

    // ---------- 国王：再加一层 ----------
    ctx.audio.play('success');
    const king = ctx.labels.add(v3(6.6, 2.8, 4.2), '再加一层！', { cls: 'say' });
    ctx.say('国王说：再加一层！');
    await ctx.wait(1500);
    king.remove();
    tools.show(false); fillBtn.hide();
    const g2 = await ctx.guess({ kind: 'volume', actual: 25, prompt: '先猜：再加一层，要多运几块？', min: 1, max: 50, start: 15, unit: '块' });
    accs.push(geo.guessAccuracy(g2, 25));
    tools.show(true); fillBtn.show();
    // 新添一层：原来的塔抬高一格
    const r5 = mkRow(5, '5');
    r5.v.textContent = '?';
    card.insertBefore(r5.el, sumEl);
    rowFor[5] = r5;
    ctx.view.frame({ x: 0, z: 0 }, 7.6, { yaw: 14, pitch: 28, y: 2 });
    await go(fx.to(mainBlocks.group.position, { y: 1 }, 700, { ease: 'inOut' }));
    ctx.audio.play('rotate');
    await buildLayer(extraBlocks, 0, 5, 5);
    pad.scale.set(1.2, 1, 1.2);

    // ---------- 日出 ----------
    tools.remove(); fillBtn.remove(); taps.off();
    ctx.hud.task('金字塔完工了。太阳升起来了。');
    await sunrise(ctx);
    const total = pyramidTotal(5);
    const big = ctx.labels.add(v3(0, 6.4, 0), `1 + 4 + 9 + 16 + 25 = ${total}<small>块</small>`, { cls: 'big' });
    ctx.say(`一共 ${total} 块。每一层都是一个正方形。`);
    await ctx.wait(3200);
    void big; void icon; void C;
    const acc = (accs[0] + accs[1]) / 2;
    ctx.complete({ stars: acc >= 0.85 ? 3 : acc >= 0.6 ? 2 : 1, delay: 300 });
  },
});

/** 日出：太阳从地平线升起，天色由橙变蓝，金字塔的影子由长变短。 */
async function sunrise(ctx) {
  const scene = ctx.scene.parent;
  const dl = scene.children.find((c) => c.isDirectionalLight);
  const hemi = scene.children.find((c) => c.isHemisphereLight);
  const keep = { bg: scene.background, fog: scene.fog ? scene.fog.color.clone() : null, pos: dl.position.clone(), inten: dl.intensity, col: dl.color.clone(), hemi: hemi.intensity, tgt: dl.target.position.clone(), sh: { l: dl.shadow.camera.left, r: dl.shadow.camera.right, t: dl.shadow.camera.top, b: dl.shadow.camera.bottom, far: dl.shadow.camera.far } };
  ctx.onDispose(() => {
    scene.background = keep.bg;
    if (scene.fog && keep.fog) scene.fog.color.copy(keep.fog);
    dl.position.copy(keep.pos); dl.intensity = keep.inten; dl.color.copy(keep.col); hemi.intensity = keep.hemi;
    const c = dl.shadow.camera;
    c.left = keep.sh.l; c.right = keep.sh.r; c.top = keep.sh.t; c.bottom = keep.sh.b; c.far = keep.sh.far;
    c.updateProjectionMatrix();
  });
  const sunMesh = new THREE.Mesh(new THREE.SphereGeometry(3, 16, 12), new THREE.MeshBasicMaterial({ color: '#FFD76A', fog: false }));
  ctx.add(sunMesh);
  const sc = dl.shadow.camera;
  sc.left = -22; sc.right = 22; sc.top = 22; sc.bottom = -22; sc.far = 120;
  sc.updateProjectionMatrix();
  const lo = { top: new THREE.Color('#F2A66B'), bot: new THREE.Color('#FBD9A0'), light: new THREE.Color('#FFA766') };
  const hi = { top: new THREE.Color('#8ED2F5'), bot: new THREE.Color('#F6ECCB'), light: new THREE.Color('#FFF1D6') };
  const bgc = new THREE.Color();
  const tmp = new THREE.Color();
  const apply = (k) => {
    const elev = (7 + 52 * k) * (Math.PI / 180);
    const c = Math.cos(elev), s = Math.sin(elev);
    const dir = new THREE.Vector3(-0.62 * c, s, -0.78 * c);
    dl.position.set(dir.x * 40, dir.y * 40, dir.z * 40);
    dl.target.position.set(0, 0, 0);
    dl.color.copy(lo.light).lerp(hi.light, k);
    dl.intensity = 1.9 + 0.7 * k;
    hemi.intensity = 0.8 + 0.4 * k;
    bgc.copy(lo.top).lerp(hi.top, k);
    scene.background = bgc;
    tmp.copy(lo.bot).lerp(hi.bot, k);
    if (scene.fog) scene.fog.color.copy(tmp);
    sunMesh.position.set(dir.x * 70, dir.y * 70, dir.z * 70);
  };
  apply(0);
  ctx.audio.play('whoosh');
  await go(ctx.fx.tween({ duration: dur(ctx, 5200), ease: 'inOut', onUpdate: apply }));
  ctx.fx.celebrate({ x: 0, z: 0 }, { count: 60 });
}
