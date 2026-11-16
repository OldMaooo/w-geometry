// 6-3 牵牛饮水 · 镜子里的最短路
// 从村子牵牛到河边喝水，再去田里干活。在河边哪一点喝水最近？先凭手感拖，再「照镜子」：
// 把田翻到河对面，村子到影子田拉一条直线，穿过河岸的那一点就是最好的饮水点。
import { defineLevel } from '../../engine/level.js';
import { walkLen, mirrorBest, mirror, dist } from './math.js';
import { makeHouse, makeKnob, v3, C, block, exposeScreen, chapterStyles, go, dur, tweenK } from './kit.js';
import { makeSeg, makeBeacon } from '../ch3-survey/kit.js';
import { waterMat } from './kit.js';
import { makeChannel, advance, makeReservoir } from './flow.js';

const R1 = { V: { x: -6, z: 4 }, F: { x: 6, z: 2 } };
const R2 = { V: { x: -7, z: 3 }, F: { x: 5, z: 6 } };
const TOL = 0.3;
const fx1 = (n) => (Math.round(n * 10) / 10).toFixed(1);

/** 牛（方块）。朝 +z。 */
function makeCow(ctx) {
  const THREE = ctx.THREE;
  const g = new THREE.Group();
  block('#F4EEDF', 0.62, 0.5, 1.0, { y: 0.36, parent: g });
  block('#4A3A28', 0.64, 0.28, 0.4, { y: 0.5, z: -0.12, parent: g, cast: false });
  block('#F4EEDF', 0.4, 0.38, 0.4, { y: 0.62, z: 0.6, parent: g });
  block('#E8B4A0', 0.3, 0.14, 0.12, { y: 0.66, z: 0.82, parent: g, cast: false });
  for (const sx of [-0.2, 0.2]) {
    for (const sz of [-0.3, 0.3]) block('#8B6B43', 0.13, 0.36, 0.13, { x: sx, z: sz, parent: g });
    block('#EEE5C8', 0.07, 0.16, 0.07, { x: sx * 1.2, y: 0.98, z: 0.55, parent: g, cast: false });
  }
  return g;
}

export async function mirrorRound(ctx, { V, F, first, canal = false }) {
  const { props, THREE } = ctx;
  const Rg = ctx.add(new THREE.Group());
  const best = mirrorBest(V, F);
  const X = best.D.x;
  const Fm = best.Fm;
  const cowG = ctx.add(new THREE.Group());
  if (canal) {
    makeReservoir(ctx, { x: V.x - 1.2, z: V.z, w: 2.2, d: 2.2, y: 0.5, parent: Rg });
    makeHouse(ctx, F.x + 1.4, F.z, { parent: Rg, face: -0.4 });
  } else {
    makeHouse(ctx, V.x - 2.0, V.z, { parent: Rg, face: 0.4 });
    props.plot({ x: F.x - 1.5, z: F.z - 1, w: 3, d: 2, parent: Rg });
    cowG.position.set(V.x, 0, V.z);
    cowG.add(makeCow(ctx));
    props.villager({ x: 0, z: -0.9, color: '#C08A3E', parent: cowG });
  }
  const D = { x: first ? -7.5 : 7.5, z: 0 };
  const rope = props.rope({ points: [V, D, F], every: 1, y: 0.2, parent: Rg });
  const knob = makeKnob(ctx, { parent: Rg });
  knob.group.position.set(D.x, 0, 0);
  const lbl = ctx.labels.add(v3(0, 1, 0), '', { cls: 'big', pop: false });
  const total = () => walkLen(V, D, F);
  const tags = [];
  let shadowSeg = null, shadowField = null, straight = null, ring = null, revealed = false;
  function update() {
    rope.setPoints([V, D, F]);
    knob.group.position.set(D.x, 0, 0);
    const t = total();
    lbl.target = v3(D.x, 1.7, 0);
    lbl.set(`${fx1(t)}<small>步</small>`);
    const near = Math.abs(D.x - X) <= TOL;
    lbl.cls('good', near && revealed);
    if (shadowSeg) shadowSeg.set(v3(D.x, 0.22, 0), v3(Fm.x, 0.22, Fm.z));
  }
  update();

  const gen = (p) => v3(p.x, 0.22, p.z);
  // 翻：一块东西绕河岸线转过去
  async function flip(group, a, b, ms) {
    await tweenK(ctx, ms, (k) => { group.rotation.x = a + (b - a) * k; }, 'inOut');
    group.rotation.x = b;
  }
  let finish;
  const finished = new Promise((r) => { finish = r; });
  let phase = first ? 'feel' : 'mirror';
  let moves = 0;
  let h = null;

  async function reveal() {
    if (revealed) return;
    revealed = true;
    phase = 'mirror';
    ctx.hint(null);
    mirrorBtn?.hide();
    h && (h.enabled = false);
    ctx.hud.task('河面像镜子：把田翻到河对面。');
    // 一块影子田 + 一根「岸上到田」的线，绕河岸线翻过去
    const fl = ctx.add(new THREE.Group());
    const ghost = props.polyField({
      points: [{ x: F.x - 1.5, z: F.z - 1 }, { x: F.x + 1.5, z: F.z - 1 }, { x: F.x + 1.5, z: F.z + 1 }, { x: F.x - 1.5, z: F.z + 1 }],
      color: '#D8EEFB', opacity: 0.85, y: 0.2, edge: '#2B6FA3', parent: fl,
    });
    void ghost;
    const seg = makeSeg(ctx, { color: '#4FA3D8', r: 0.09, parent: fl });
    seg.set(v3(D.x, 0.22, 0), gen(F));
    ctx.audio.play('whoosh');
    await flip(fl, 0, -Math.PI, 1800);
    ctx.remove(fl);
    shadowField = props.polyField({
      points: [{ x: Fm.x - 1.5, z: Fm.z - 1 }, { x: Fm.x + 1.5, z: Fm.z - 1 }, { x: Fm.x + 1.5, z: Fm.z + 1 }, { x: Fm.x - 1.5, z: Fm.z + 1 }],
      color: '#D8EEFB', opacity: 0.85, y: 0.2, edge: '#2B6FA3', parent: Rg,
    });
    shadowSeg = makeSeg(ctx, { color: '#4FA3D8', r: 0.09, parent: Rg });
    shadowSeg.set(v3(D.x, 0.22, 0), v3(Fm.x, 0.22, Fm.z));
    ctx.audio.play('place');
    tags.push(ctx.labels.add(v3(Fm.x, 0.5, Fm.z), '影子田', { cls: 'tag', pop: true }));
    // 村子到影子田：一条直线，穿过河岸的地方就是最好的点
    straight = makeSeg(ctx, { color: C.gold, r: 0.07, parent: Rg });
    straight.set(gen(V), gen(Fm));
    ring = makeBeacon(ctx, X, 0, { r: 0.9 });
    ctx.hud.task('村子到影子田，直线最短。把金球拖到发亮的圈里。');
    update();
    h && (h.enabled = true);
    setStep();
  }

  let mirrorBtn = null;
  if (first) {
    mirrorBtn = ctx.hud.tool({ icon: 'eye', label: '照镜子', primary: true, onTap: () => { reveal(); } });
  }

  function setStep() {
    if (phase === 'feel') {
      ctx.hint({
        text: '拖岸上的金球，看数字什么时候最小。找不到就点「照镜子」。',
        ghost: () => ctx.fx.ghostHand(v3(D.x, 0.8, 0), v3(X, 0.8, 0)),
        demo: async () => { mirrorBtn.tap(); await ctx.wait(2400); },
      });
    } else {
      ctx.hint({
        text: '把金球拖进发亮的圈。圈就在直线穿过河岸的地方。',
        ghost: () => ctx.fx.ghostHand(v3(D.x, 0.8, 0), v3(X, 0.8, 0)),
        demo: () => ctx.pointer.simulateDrag(h, v3(X, 0, 0), { duration: 1000 }),
      });
    }
  }

  ctx.hud.task(canal ? '渠要先到河边取一次水，再通到村子。' : first ? '拖岸上的金球，找一个让牛走得最短的饮水点。' : '换一块田。这回先照镜子，一次就定点。');
  h = ctx.pointer.draggable(knob.group, {
    ringSize: 0.7, lift: 0, bounds: { minX: -10, maxX: 10, minZ: 0, maxZ: 0 },
    snap: (p) => {
      p.x = Math.round(p.x * 4) / 4; p.z = 0;
      if (revealed && Math.abs(p.x - X) < 0.7) p.x = X; // 发亮的圈会吸住金球
      return p;
    },
    onMove: (p) => { D.x = p.x; update(); },
    onEnd: () => {
      moves++;
      if (Math.abs(D.x - X) <= TOL) { D.x = X; update(); h.enabled = false; finish(moves); return; }
      if (phase === 'feel') {
        if (moves === 3 && mirrorBtn) { mirrorBtn.pulse(true); ctx.nudge('找累了？点「照镜子」看看。'); }
        else ctx.nudge('再拖一拖，看哪里的数字最小。');
      } else ctx.nudge('金球要拖进发亮的圈里。');
    },
  });
  if (!first) { setStep(); await reveal(); } else setStep();
  const m = await finished;
  ctx.hint(null);
  if (first && !revealed) await reveal2();
  async function reveal2() { revealed = false; await reveal(); h.enabled = false; }
  mirrorBtn?.hide();
  ctx.audio.play('good');
  ctx.fx.sparkle({ x: X, z: 0 }, { size: 1.8 });
  lbl.cls('good', true);
  // 翻回来：拐弯的路和直路一样长
  ctx.hud.task('把影子翻回去：拐弯的路，和直路一样长。');
  ring?.remove();
  straight && straight.show(true);
  const fl2 = ctx.add(new THREE.Group());
  ctx.remove(shadowField);
  shadowSeg.mesh.removeFromParent();
  const g2 = props.polyField({
    points: [{ x: Fm.x - 1.5, z: Fm.z - 1 }, { x: Fm.x + 1.5, z: Fm.z - 1 }, { x: Fm.x + 1.5, z: Fm.z + 1 }, { x: Fm.x - 1.5, z: Fm.z + 1 }],
    color: '#D8EEFB', opacity: 0.85, y: 0.2, edge: '#2B6FA3', parent: fl2,
  });
  void g2;
  const sg = makeSeg(ctx, { color: '#4FA3D8', r: 0.09, parent: fl2 });
  sg.set(v3(X, 0.22, 0), v3(Fm.x, 0.22, Fm.z));
  await flip(fl2, 0, Math.PI, 1600);
  ctx.remove(fl2);
  straight?.show(false);
  ctx.nudge(`${fx1(best.length)} 步：翻过去，弯路就是直路。`, { kind: 'good' });
  if (canal) {
    // 渠：沿着这条最短的路挖出来，水流过去
    const ch = makeChannel(ctx, { width: 0.9 });
    ch.setPath([{ x: V.x, y: 0.1, z: V.z }, { x: X, y: 0.1, z: 0 }, { x: F.x, y: 0.1, z: F.z }]);
    lbl.remove(); rope.group.removeFromParent();
    await advance(ctx, ch, ch.total, () => 6);
    ctx.fx.sparkle({ x: F.x, z: F.z }, { size: 2 });
    tags.forEach((t) => t.remove());
    return { moves: m, channel: ch, group: Rg, D: { x: X, z: 0 }, length: best.length };
  }
  // 牛走一遍
  const path = [v3(V.x, 0, V.z), v3(X, 0, 0), v3(F.x, 0, F.z)];
  const legs = [path[0].distanceTo(path[1]), path[1].distanceTo(path[2])];
  const L = legs[0] + legs[1];
  await go(ctx.fx.tween({
    duration: dur(ctx, 3200), ease: 'inOut',
    onUpdate: (k) => {
      let s = k * L, i = 0;
      if (s > legs[0]) { s -= legs[0]; i = 1; }
      const a = path[i], b = path[i + 1];
      const t = s / legs[i];
      cowG.position.set(a.x + (b.x - a.x) * t, 0, a.z + (b.z - a.z) * t);
      cowG.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
    },
  }));
  ctx.audio.play('count', { n: 6 });
  ctx.fx.sparkle({ x: F.x, z: F.z }, { size: 2 });
  await ctx.wait(900);
  const out = { moves: m };
  lbl.remove(); rope.group.removeFromParent();
  ctx.remove(cowG);
  tags.forEach((t) => t.remove());
  ctx.remove(Rg);
  void out;
  return out;
}

export default defineLevel({
  id: 'ch6-l3',
  title: '牵牛饮水',
  concept: '镜像·最短路',
  brief: '每天从村子牵牛到河边喝水，再去田里干活。在河边哪一点喝水，走的路最短？',
  discovery: '拐弯的路，翻过去就成了直路；直路最短。',

  async setup(ctx) {
    exposeScreen(ctx);
    chapterStyles(ctx);
    const { props, THREE } = ctx;
    props.ground({ w: 26, d: 10, z: 5, seed: 63, river: null, trees: 7, cells: false });
    // 河：河岸线是 z = 0
    const sand = new THREE.Mesh(new THREE.BoxGeometry(34, 0.03, 1.4), new THREE.MeshLambertMaterial({ color: '#E2CD98' }));
    sand.position.set(0, 0.035, -0.5);
    ctx.add(sand);
    const water = props.water({ x: 0, z: -3.6, w: 34, d: 5.6 });
    water.position.y = 0.13;
    ctx.view.shadow({ x: 0, z: 2 }, 17);
    ctx.view.frame({ x: 0, z: 1.2 }, 10.4, { instant: true, pitch: 54, yaw: 0 });
    const lblBank = ctx.labels.add(v3(-10.5, 0.3, -0.1), '河岸', { cls: 'soft', pop: false });
    void lblBank;
    let tries2 = 0;

    // (mirrorRound 在文件上方)

    // ---- 先猜
    const best1 = mirrorBest(R1.V, R1.F);
    const g = await ctx.guess({ kind: 'length', actual: Math.round(best1.length * 10) / 10, prompt: '先猜：牛走最近的路，一共几步？', min: 8, max: 26, start: 14, unit: '步' });
    void g;
    ctx.hud.progress(0, 2);
    await mirrorRound(ctx, { ...R1, first: true });
    ctx.hud.progress(1, 2);
    const r2 = await mirrorRound(ctx, { ...R2, first: false });
    ctx.hud.progress(2, 2);
    tries2 = r2.moves;
    void mirror; void dist; void waterMat;
    ctx.complete({ stars: tries2 === 1 ? 3 : 2 });
  },
});
