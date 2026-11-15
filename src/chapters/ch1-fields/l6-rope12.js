// 1-6 十二结绳 · 用绳子造直角（本章大关）
// 一：三根桩套着 12 个结的绳圈，拖桩把绳绷成三角形（边长吸附整数、三边和恒为 12），矩对上直角就变绿。
// 二：拿 3-4-5 绳三角当直角尺，校正新田的四个角：拖绳三角到角上 → 顺着它指的方向放桩。四角都正，田长满稻子。
import { defineLevel } from '../../engine/level.js';
import { PALETTE } from '../../engine/palette.js';
import { v3 } from './kit.js';

const P0 = { x: -9.5, z: 3.5 };

export default defineLevel({
  id: 'ch1-l6',
  title: '十二结绳',
  concept: '直角·3-4-5',
  brief: '新田要四四方方，可是没有东西能量直角。老匠师给了一根 12 个结的绳圈。',
  discovery: '三、四、五个结的绳三角，一定有一个直角。拿它就能把田角定正。',

  async setup(ctx) {
    const { props, geo, THREE } = ctx;
    props.ground({ w: 26, d: 15, seed: 66 });
    ctx.view.shadow({ x: 0, z: 0 }, 17);
    const master = props.villager({ x: -12, z: 5.5, color: '#7D6A55', face: 0.7 });
    ctx.view.frame({ x: -6.5, z: 1.2 }, 6.5, { instant: true });

    // =============== 一：找直角 ===============
    ctx.hud.progress(0, 2);
    ctx.hud.task('拖动两根桩，把绳圈绷成三角形。找一找：什么时候出现方方正正的角？');
    let c = 4, a = 4;
    const validA = (cc) => { const out = []; for (let x = 1; x <= 11; x++) if (geo.isTriangle(x, 12 - cc - x, cc)) out.push(x); return out; };
    const apex = (cc, aa) => { const p = geo.apexFromSides(cc, aa, 12 - cc - aa); return { x: P0.x + p.x, z: P0.z - p.y }; };
    const s0 = props.stake({ x: P0.x, z: P0.z, color: '#7A5233' });
    const s1 = props.stake({ x: P0.x + c, z: P0.z });
    const s2 = props.stake({ x: 0, z: 0 });
    for (const s of [s1, s2]) {
      const top = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 0), new THREE.MeshLambertMaterial({ color: PALETTE.gold }));
      top.position.y = 1.12;
      s.add(top);
      props.hitBox(1, 1.4, 1, s);
    }
    const loop = props.rope({ closed: true, y: 0.42 });
    const sq = props.square({ len: 1.2 });
    const lbl = [0, 1, 2].map(() => ctx.labels.add(v3(0, 0, 0), '', { cls: 'num', pop: false }));
    let isRight = false;

    function update() {
      const p1 = { x: P0.x + c, z: P0.z };
      const p2 = apex(c, a);
      s1.position.set(p1.x, 0, p1.z);
      s2.position.set(p2.x, 0, p2.z);
      loop.setPoints([P0, p1, p2]);
      const b = 12 - c - a;
      const sides = [[P0, p1, c], [P0, p2, a], [p1, p2, b]];
      const cx = (P0.x + p1.x + p2.x) / 3, cz = (P0.z + p1.z + p2.z) / 3;
      sides.forEach(([u, w, n], i) => {
        const mx = (u.x + w.x) / 2, mz = (u.z + w.z) / 2;
        const ox = mx - cx, oz = mz - cz, ol = Math.hypot(ox, oz) || 1;
        lbl[i].target = v3(mx + (ox / ol) * 0.6, 0.5, mz + (oz / ol) * 0.6);
        lbl[i].set(n);
      });
      // 矩放在最大的那个角上
      const pts = [P0, p1, p2];
      const angs = geo.cornerAngles(pts.map((p) => ({ x: p.x, y: p.z })));
      const k = angs.indexOf(Math.max(...angs));
      const V = pts[k], A1 = pts[(k + 1) % 3], A2 = pts[(k + 2) % 3];
      sq.place(V, { x: A1.x - V.x, z: A1.z - V.z }, { x: A2.x - V.x, z: A2.z - V.z });
      const right = geo.isRightTriangle(a, b, c);
      sq.ok(right);
      lbl.forEach((l) => l.cls('ok', right));
      if (right && !isRight) { ctx.audio.play('good'); ctx.fx.sparkle(V, { color: '#9FE07A', size: 1.4 }); }
      isRight = right;
      ctx.state.sides = [c, a, b].sort((x, y) => x - y).join('-');
    }
    update();

    let lastSaid = '';
    let foundResolve;
    const found = ctx.waitFor((d) => { foundResolve = d; });
    const evaluate = () => {
      const key = ctx.state.sides;
      if (isRight) { foundResolve(); return; }
      if (key === lastSaid) return;
      lastSaid = key;
      ctx.nudge(key === '4-4-4' ? '三个角都太尖了。' : '还是没有方方正正的角。');
    };
    const h1 = ctx.pointer.draggable(s1, {
      lift: 0,
      snap: (p) => {
        const nc = Math.min(5, Math.max(2, Math.round(p.x - P0.x)));
        return v3(P0.x + nc, 0, P0.z);
      },
      onMove: (p) => {
        const nc = Math.round(p.x - P0.x);
        if (nc === c) return;
        c = nc;
        const va = validA(c);
        if (!va.includes(a)) a = va.reduce((best, x) => (Math.abs(x - a) < Math.abs(best - a) ? x : best), va[0]);
        update();
      },
      onEnd: evaluate,
    });
    const h2 = ctx.pointer.draggable(s2, {
      lift: 0,
      snap: (p) => {
        let best = null;
        for (const x of validA(c)) {
          const q = apex(c, x);
          const d = Math.hypot(q.x - p.x, q.z - p.z);
          if (!best || d < best.d) best = { d, x, q };
        }
        return v3(best.q.x, 0, best.q.z);
      },
      onMove: (p) => {
        const na = validA(c).find((x) => { const q = apex(c, x); return Math.hypot(q.x - p.x, q.z - p.z) < 1e-6; });
        if (na && na !== a) { a = na; update(); }
      },
      onEnd: evaluate,
    });
    ctx.hint({
      text: '试试让三条边是 3 个结、4 个结、5 个结。',
      ghost: () => ctx.fx.ghostHand(v3(s1.position.x, 0.6, s1.position.z), v3(P0.x + 3, 0.6, P0.z)),
      demo: async () => {
        if (c !== 3) await ctx.pointer.simulateDrag(h1, v3(P0.x + 3, 0, P0.z), { duration: 800 });
        const q = apex(3, 4);
        await ctx.pointer.simulateDrag(h2, v3(q.x, 0, q.z), { duration: 900 });
      },
    });
    await found;
    ctx.hint(null);
    h1.dispose(); h2.dispose();
    const hintsStep1 = ctx.hintsUsed;
    master.cheer();
    ctx.nudge('3、4、5，出现直角了！', { kind: 'good' });
    await ctx.wait(2400);

    // =============== 二：定田角 ===============
    ctx.hud.progress(1, 2);
    lbl.forEach((l) => l.remove());
    const A = { x: 1, z: 4.5 }, B = { x: 8, z: 4.5 };
    const st = {
      A: props.stake({ x: A.x, z: A.z, color: '#7A5233' }),
      B: props.stake({ x: B.x, z: B.z, color: '#7A5233' }),
      D: props.stake({ x: 1.9, z: 0.3 }),
      C: props.stake({ x: 7.2, z: -0.6 }),
    };
    st.D.rotation.z = 0.25; st.C.rotation.z = -0.22;
    for (const k of ['C', 'D']) { props.hitBox(1, 1.4, 1, st[k]); }
    const edge = props.rope({ closed: true, every: 1000, y: 0.2, color: '#D9C49A' });
    const pos = (k) => ({ x: st[k].position.x, z: st[k].position.z });
    const redraw = () => edge.setPoints([pos('A'), pos('B'), pos('C'), pos('D')]);
    redraw();
    ctx.view.frame({ x: 2, z: 2.2 }, 8);
    ctx.hud.task('用这个绳三角当直角尺，把新田的四个角都定正。');

    // 绳三角工具：直角顶点在原点，4 结那条沿 +x，3 结那条沿 -z
    const tool = ctx.add(new THREE.Group());
    props.rope({ points: [{ x: 0, z: 0 }, { x: 4, z: 0 }, { x: 0, z: -3 }], closed: true, y: 0.3, parent: tool });
    for (const p of [[0, 0], [4, 0], [0, -3]]) props.stake({ x: p[0], z: p[1], h: 0.5, parent: tool });
    const tsq = props.square({ len: 1, parent: tool });
    tsq.place({ x: 0, z: 0 }, { x: 1, z: 0 }, { x: 0, z: -1 });
    tsq.group.position.y = 0.3;
    props.hitBox(1.6, 0.8, 1.6, tool);
    const toolHome = { x: -4.5, z: 6.3 };
    tool.position.set(toolHome.x, 0, toolHome.z);
    ctx.fx.pop(tool);

    // 角上的亮圈
    const glow = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.7, 28), new THREE.MeshBasicMaterial({ color: PALETTE.gold, transparent: true, opacity: 0.8, depthWrite: false }));
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.05;
    ctx.add(glow);
    ctx.onUpdate((dt, t) => { const s = 1 + Math.sin(t * 5) * 0.15; glow.scale.set(s, s, s); });

    const orient = (o) => { tool.rotation.y = o.ry || 0; tool.scale.set(o.sx || 1, 1, o.sz || 1); };
    const placeTool = async (corner, o) => {
      tool.position.set(corner.x, 0, corner.z);
      orient(o);
    };

    // 金色指示线（顺着绳三角的 3 结边延长）
    const guide = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.02, 1), new THREE.MeshBasicMaterial({ color: '#FFE08A' }));
    guide.visible = false;
    ctx.add(guide);
    const showGuide = (from, len) => { guide.visible = true; guide.scale.z = len; guide.position.set(from.x, 0.06, from.z - len / 2); };

    /** 拖绳三角到某个角。 */
    async function bringTool(corner, o, label) {
      glow.visible = true;
      glow.position.x = corner.x; glow.position.z = corner.z;
      ctx.hud.task(label);
      let resolveT;
      const placed = ctx.waitFor((d) => { resolveT = d; });
      const th = ctx.pointer.draggable(tool, {
        ringSize: 0.8,
        snap: (p) => { if (Math.hypot(p.x - corner.x, p.z - corner.z) < 1.8) { p.x = corner.x; p.z = corner.z; } return p; },
        onEnd: async () => {
          if (Math.hypot(tool.position.x - corner.x, tool.position.z - corner.z) < 1e-3) { resolveT(); return; }
          await ctx.fx.to(tool.position, { x: toolHome.x, z: toolHome.z }, 350);
        },
      });
      ctx.hint({
        text: '把绳三角拖到发亮的那个角上。',
        ghost: () => ctx.fx.ghostHand(v3(tool.position.x, 0.4, tool.position.z), v3(corner.x, 0.4, corner.z)),
        demo: () => ctx.pointer.simulateDrag(th, v3(corner.x, 0, corner.z), { duration: 1000 }),
      });
      await placed;
      ctx.hint(null);
      th.dispose();
      ctx.audio.play('snap');
      await placeTool(corner, o);
      ctx.fx.pop(tool, { duration: 300, from: 0.85 });
      glow.visible = false;
    }

    /** 把桩拖到指示线上（从 corner 往 -z）。返回落在第几步。 */
    async function setStake(k, corner, label, want) {
      showGuide(corner, 7);
      ctx.hud.task(label);
      let resolveS;
      const put = ctx.waitFor((d) => { resolveS = d; });
      let onLine = null;
      const sh = ctx.pointer.draggable(st[k], {
        lift: 0.3,
        snap: (p) => {
          const r = geo.snapToRay({ x: p.x, y: p.z }, { x: corner.x, y: corner.z }, { x: 0, y: -1 }, { step: 1, maxDist: 1.2, minT: 2, maxT: 7 });
          onLine = r ? r.t : null;
          if (r) { p.x = r.point.x; p.z = r.point.y; }
          return p;
        },
        onMove: (p) => { st[k].position.x = p.x; st[k].position.z = p.z; redraw(); },
        onStart: () => { st[k].rotation.z = 0; },
        onEnd: () => {
          redraw();
          if (onLine) { resolveS(onLine); return; }
          ctx.nudge('顺着金线放。');
        },
      });
      const target = v3(corner.x, 0, corner.z - want);
      ctx.hint({
        text: k === 'C' ? '把歪掉的桩拖到金线上，和对面那根一样远。' : '把歪掉的桩拖到金线上。',
        ghost: () => ctx.fx.ghostHand(v3(st[k].position.x, 0.6, st[k].position.z), v3(target.x, 0.6, target.z)),
        demo: () => ctx.pointer.simulateDrag(sh, target, { duration: 1000 }),
      });
      const t = await put;
      ctx.hint(null);
      sh.dispose();
      guide.visible = false;
      ctx.audio.play('place');
      return t;
    }

    // 角 A → 定 D
    await bringTool(A, {}, '先校正这个角：把绳三角拖过去。');
    const tD = await setStake('D', A, '绳三角指着的方向就是直的。把桩拖到金线上。', 5);
    tsq.ok(true);
    ctx.fx.sparkle(A, { color: '#9FE07A', size: 1.4 });
    ctx.audio.play('good');
    await ctx.wait(700);
    tsq.ok(false);

    // 角 B → 定 C（要和 D 一样远才能合拢）
    const level = new THREE.Mesh(new THREE.BoxGeometry(1, 0.02, 0.06), new THREE.MeshBasicMaterial({ color: '#FFF4D0', transparent: true, opacity: 0.8 }));
    level.scale.x = B.x - A.x;
    level.position.set((A.x + B.x) / 2, 0.05, A.z - tD);
    ctx.add(level);
    await bringTool(B, { sx: -1 }, '再校正这个角：把绳三角拖过去。');
    for (;;) {
      const tC = await setStake('C', B, '把这根桩也拖到金线上。', tD);
      if (tC === tD) break;
      // 合不拢：拿绳三角去 C 角一比，不正
      await ctx.fx.to(tool.position, { x: B.x, z: B.z - tC }, 500);
      orient({ ry: Math.PI });
      ctx.fx.wobble(tool, { amp: 0.15 });
      ctx.nudge('这个角还不正。和对面那根桩一样远试试。');
      await ctx.wait(1200);
      tool.position.set(B.x, 0, B.z);
      orient({ sx: -1 });
    }
    ctx.remove(level);
    tsq.ok(true);
    ctx.audio.play('good');
    await ctx.wait(500);
    // 自动去量另外两个角：都正
    ctx.hud.task('再比一比剩下两个角……');
    const Cp = pos('C'), Dp = pos('D');
    await ctx.fx.to(tool.position, { x: Cp.x, z: Cp.z }, 600);
    orient({ ry: Math.PI });
    ctx.fx.sparkle(Cp, { color: '#9FE07A', size: 1.4 });
    ctx.audio.play('good');
    await ctx.wait(700);
    await ctx.fx.to(tool.position, { x: Dp.x, z: Dp.z }, 600);
    orient({ sz: -1 });
    ctx.fx.sparkle(Dp, { color: '#9FE07A', size: 1.4 });
    ctx.audio.play('good');
    await ctx.wait(700);
    await ctx.fx.to(tool.position, { x: toolHome.x, z: toolHome.z }, 500);
    orient({});
    tsq.ok(false);

    // 四角都正：篱笆合拢，稻子长满，镜头拉远看河谷
    ctx.hud.task('四个角都正了！');
    ctx.hud.progress(2, 2);
    props.fence({ points: [A, B, Cp, Dp], closed: true, h: 0.4 });
    const cells = [];
    for (let x = A.x + 0.5; x < B.x; x += 1) for (let z = A.z - 0.5; z > Dp.z; z -= 1) cells.push({ x, z });
    const rice = props.crops({ cells, kind: 'rice', per: 4, seed: 8 });
    ctx.view.frame({ x: 2, z: 1.5 }, 8.5);
    await rice.grow({ stagger: 10, onEach: (n) => { if (n % 3 === 0) ctx.audio.play('grow', { n }); } });
    master.cheer();
    ctx.view.frame({ x: -1, z: 0 }, 15, { pitch: 38 });
    await ctx.wait(1300);
    ctx.state.depth = tD;
    ctx.complete({ stars: hintsStep1 === 0 ? 3 : hintsStep1 < 3 ? 2 : 1, delay: 1500 });
  },
});
