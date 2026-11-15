// 4-4 一张皮折成箱 · 展开图
// 每轮三张展开图：先点「我觉得能折成」的，再逐张「折一折」——一面一面立起来；折不成的会有两面叠在一起、另一边露个洞。
import * as THREE from 'three';
import { defineLevel } from '../../engine/level.js';
import { mat } from '../../engine/shared.js';
import { sweepIn, injectStyles, v3, go, dur } from './kit.js';
import { foldNet, netOf, NET_ROUNDS } from './math.js';

const CSS = `
.lbl.lbl-tag.c4-yes { background: #b6e08c; border-color: #5f9a3a; }
.lbl.lbl-tag.c4-verdict { background: #fff; border: 2px solid var(--ridge, #8b6b43); font-size: 22px; pointer-events: none; }
.lbl.lbl-tag.c4-verdict.yes { background: #b6e08c; border-color: #5f9a3a; }
.lbl.lbl-tag.c4-verdict.no { background: #cfe3f2; border-color: #5ba4cf; }
`;
const COLORS = ['#E8B45C', '#7FB069', '#7DB6DE', '#E58A6E', '#B99BDF', '#F0D56E'];
const S = 1.1; // 一格的边长

/** 一张展开图：每个格子一块薄板，用铰链一层层挂起来。 */
function buildNet(ctx, cells) {
  const f = foldNet(cells);
  const root = new THREE.Group();
  const cg = new Map();
  const pivots = [];
  const faces = [];
  f.tree.forEach((n, order) => {
    const g = new THREE.Group();
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(1, 0.07, 1),
      new THREE.MeshLambertMaterial({ color: COLORS[n.idx % 6], polygonOffset: true, polygonOffsetFactor: -order, polygonOffsetUnits: -order }),
    );
    const sc = 0.96 - 0.014 * order;
    m.scale.set(sc, 1, sc);
    m.castShadow = m.receiveShadow = true;
    g.add(m);
    faces.push(m);
    if (n.parent < 0) {
      g.position.set(cells[n.idx][0], 0.06, cells[n.idx][1]);
      root.add(g);
    } else {
      const h = n.hinge;
      const pv = new THREE.Group();
      pv.position.set(h.hinge[0], 0, h.hinge[2]);
      cg.get(n.parent).add(pv);
      g.position.set(h.hinge[0], 0, h.hinge[2]);
      pv.add(g);
      pivots.push({ pv, axis: h.axis, sign: h.sign, order });
    }
    cg.set(n.idx, g);
  });
  const baseG = cg.get(f.base);
  // 露洞的那一面：半透明蓝色薄板
  const holes = f.missing.map((d) => {
    const hm = new THREE.Mesh(new THREE.BoxGeometry(Math.abs(d[0]) ? 0.03 : 0.94, Math.abs(d[1]) ? 0.03 : 0.94, Math.abs(d[2]) ? 0.03 : 0.94), mat('#5BA4CF', { opacity: 0.5 }));
    hm.position.set(d[0] * 0.5, 0.5 + d[1] * 0.5, d[2] * 0.5);
    hm.visible = false;
    baseG.add(hm);
    return hm;
  });
  const STEP = 420, DUR = 700;
  const total = (Math.max(0, pivots.length - 1)) * STEP + DUR;
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const setProgress = (ms) => {
    for (const p of pivots) {
      const t = Math.max(0, Math.min(1, (ms - p.order * STEP + STEP) / DUR));
      const a = (p.sign * ease(t) * Math.PI) / 2;
      if (p.axis === 'z') p.pv.rotation.z = a; else p.pv.rotation.x = a;
    }
  };
  let at = 0;
  return {
    root, fold: f, baseG, holes, total, faces,
    get at() { return at; },
    async play(toFolded) {
      const from = at, to = toFolded ? total : 0;
      holes.forEach((h) => { h.visible = false; });
      await ctx.fx.tween({
        duration: Math.max(1, dur(ctx, Math.abs(to - from))), ease: 'linear',
        onUpdate: (k) => { at = from + (to - from) * k; setProgress(at); },
      });
      at = to;
      setProgress(at);
      if (toFolded) holes.forEach((h) => { h.visible = true; });
    },
  };
}

export default defineLevel({
  id: 'ch4-l4',
  title: '一张皮折成箱',
  concept: '展开图',
  brief: '要做装粮食的方箱。一张皮上画着六个连着的方块，折得成没有漏的箱子吗？',
  discovery: '有的图样看着差不多，一折才知道。',

  async setup(ctx) {
    const { props } = ctx;
    injectStyles(ctx, CSS);
    props.ground({ w: 17, d: 10, seed: 74, river: null, trees: 8, cells: false });
    ctx.view.shadow({ x: 0, z: 0 }, 11);
    props.villager({ x: -8.4, z: 3.6, color: '#6F8FAF', face: 0.6 });
    props.tree({ x: 9.4, z: -3.2, s: 1 });
    let right = 0, total = 0;

    for (let r = 0; r < NET_ROUNDS.length; r++) {
      ctx.hud.progress(r, NET_ROUNDS.length);
      const rows = NET_ROUNDS[r];
      const cellsList = rows.map((x) => netOf(x));
      const nets = cellsList.map((cells) => buildNet(ctx, cells));
      const answers = nets.map((n) => n.fold.ok);
      // 排版：一排三张，按宽度一张张挨着放
      const widths = cellsList.map((cs) => Math.max(...cs.map((c) => c[0])) + 1);
      const heights = cellsList.map((cs) => Math.max(...cs.map((c) => c[1])) + 1);
      const gap = 1.1;
      const sum = widths.reduce((a, b) => a + b * S, 0) + gap * 2;
      let cx = -sum / 2;
      const info = nets.map((n, i) => {
        const w = widths[i] * S, h = heights[i] * S;
        const x0 = cx, z0 = -h / 2 - 0.2;
        cx += w + gap;
        n.root.scale.setScalar(S);
        n.root.position.set(x0 + S / 2, 0, z0 + S / 2);
        ctx.add(n.root);
        const b = cellsList[i][n.fold.base];
        const baseW = v3(x0 + S / 2 + b[0] * S, 0, z0 + S / 2 + b[1] * S);
        return { x0, z0, w, h, midX: x0 + w / 2, baseW, bottomZ: z0 + h };
      });
      nets.forEach((n) => go(ctx.fx.pop(n.root, { duration: 420, scale: S })));
      if (r === 0) await sweepIn(ctx, { x: 0, z: 0.5 }, 7.6, { yaw0: -22, yaw1: -4, pitch: 48, ms: 2200 });
      else ctx.view.frame({ x: 0, z: 0.5 }, 7.6, { yaw: -4, pitch: 48 });
      await ctx.wait(450);

      // ---------- 第一步：点选「我觉得能折成」 ----------
      ctx.hud.task('哪些能折成没有漏的方箱？点「折得成吗」，选好了再点下面。');
      const guess = [false, false, false];
      const tags = nets.map((n, i) => {
        const l = ctx.labels.add(v3(info[i].midX, 0.1, info[i].bottomZ + 0.95), '折得成吗？', {
          cls: 'tag', pop: false,
          onTap: () => { guess[i] = !guess[i]; l.set(guess[i] ? '我觉得能' : '折得成吗？').cls('c4-yes', guess[i]); ctx.audio.play('pick'); },
        });
        return l;
      });
      let resolvePick = null;
      const pickTool = ctx.hud.tool({ icon: 'check', label: '选好了', primary: true, onTap: () => resolvePick?.() });
      ctx.hint({
        text: '觉得能折成的，点一下它下面的字，变绿。再点「选好了」。',
        demo: async () => {
          answers.forEach((a, i) => { if (guess[i] !== a) tags[i].el.click(); });
          await ctx.wait(500);
          pickTool.tap();
        },
      });
      await ctx.waitFor((done) => { resolvePick = done; });
      ctx.hint(null);
      pickTool.remove();
      tags.forEach((t) => t.remove());

      // ---------- 第二步：一张张折 ----------
      ctx.hud.task('点「折一折」，看它一面一面立起来。');
      const folded = [false, false, false];
      const everFolded = [false, false, false];
      const verdict = [null, null, null];
      let busy = false;
      let resolveAll = null;
      const btns = nets.map((n, i) => {
        const l = ctx.labels.add(v3(info[i].midX, 0.1, info[i].bottomZ + 0.95), '折一折', {
          cls: 'tag', pop: false,
          onTap: async () => {
            if (busy) return;
            busy = true;
            const to = !folded[i];
            l.set(to ? '摊开' : '折一折');
            ctx.audio.play('rotate');
            if (to) verdict[i]?.remove();
            await n.play(to);
            folded[i] = to;
            busy = false;
            if (to) {
              const ok = n.fold.ok;
              ctx.audio.play(ok ? 'success' : 'soft');
              if (ok) ctx.fx.sparkle({ x: info[i].baseW.x, z: info[i].baseW.z }, { size: 1.2, color: '#9FE07A' });
              verdict[i] = ctx.labels.add(v3(info[i].baseW.x, 1.1 * S + 0.3, info[i].baseW.z), ok ? '合上了' : '有洞', { cls: `tag c4-verdict ${ok ? 'yes' : 'no'}`, pop: true });
              if (!everFolded[i]) {
                everFolded[i] = true;
                if (guess[i] === ok) right++;
                total++;
                if (guess[i] !== ok) ctx.nudge('和你想的不一样。折一折才知道。', { speak: false });
                else ctx.nudge('你想的对！', { kind: 'good', speak: false });
              }
              if (everFolded.every(Boolean)) resolveAll?.();
            }
          },
        });
        return l;
      });
      ctx.hint({
        text: '点每张下面的「折一折」。',
        ghost: () => {
          const i = everFolded.findIndex((v) => !v);
          return ctx.fx.ghostHand(v3(info[i].midX + 1.2, 1.5, info[i].bottomZ + 1.2), v3(info[i].midX, 0.4, info[i].bottomZ + 0.7));
        },
        demo: async () => {
          const i = everFolded.findIndex((v) => !v);
          if (i < 0 || busy) return;
          btns[i].el.click();
          await ctx.wait(nets[i].total + 600);
        },
      });
      await ctx.waitFor((done) => { resolveAll = done; if (everFolded.every(Boolean)) done(); });
      ctx.hint(null);
      await ctx.wait(1000);
      ctx.hud.task(r < NET_ROUNDS.length - 1 ? '看清了吗？再来一轮。' : '都折过了。');
      const next = ctx.hud.tool({ icon: 'next', label: r < NET_ROUNDS.length - 1 ? '下一轮' : '完成', primary: true, onTap: () => resolveNext?.() });
      let resolveNext = null;
      next.pulse(true);
      ctx.hint({ text: '点「' + (r < NET_ROUNDS.length - 1 ? '下一轮' : '完成') + '」。', quiet: true, demo: async () => { next.tap(); await ctx.wait(100); } });
      await ctx.waitFor((done) => { resolveNext = done; });
      ctx.hint(null);
      next.remove();
      btns.forEach((b) => b.remove());
      verdict.forEach((v) => v?.remove());
      nets.forEach((n) => ctx.remove(n.root));
      await ctx.wait(200);
    }
    const acc = total ? right / total : 1;
    ctx.complete({ stars: acc >= 0.85 ? 3 : acc >= 0.6 ? 2 : 1 });
  },
});
