// 3-4 不过河量河宽 · 在岸上造一个一样的三角形
// 对岸有棵树 T。岸上打桩 A（正对树）、B（走 b 步）、C（再走 b 步），再从 C 垂直后退，
// 直到 B 和 T 连成一线停下打桩 D。CD 就是河宽。
import { defineLevel } from '../../engine/level.js';
import { PALETTE } from '../../engine/palette.js';
import { makeSeg, measureRope, makeBeacon, v3 } from './kit.js';
import { collinear, showNum } from './math.js';

const W = 7;

export default defineLevel({
  id: 'ch3-l4',
  title: '不过河量河宽',
  concept: '全等·复制',
  brief: '要在河上架桥，得知道河多宽。河里有鳄鱼，过不去。对岸正对面有一棵树。',
  discovery: '够不着的那边，可以在够得着的这边，造一个一模一样的。',

  async setup(ctx) {
    ctx.state.toScreen = (x, y, z) => ctx.pointer.toScreen(new ctx.THREE.Vector3(x, y, z)); // 调试 / 自动测试用
    const { props, geo, THREE } = ctx;
    props.ground({ w: 26, d: 24, x: 3, z: 1, seed: 61, river: null, trees: 4, cells: false });
    ctx.view.shadow({ x: 3, z: 0 }, 17);
    ctx.view.frame({ x: 3, z: 0.5 }, 11, { instant: true });
    // 河：沙岸 + 水
    const sand = new THREE.Mesh(new THREE.BoxGeometry(30, 0.03, W + 1.2), new THREE.MeshLambertMaterial({ color: '#E2CD98' }));
    sand.position.set(3, 0.035, -W / 2);
    ctx.add(sand);
    const water = props.water({ x: 3, z: -W / 2, w: 30, d: W - 1.4 });
    water.position.y = 0.13;
    const T = { x: 0, z: -W };
    props.tree({ x: T.x, z: T.z - 0.2, kind: 'round', s: 1.2 });
    const A = { x: 0, z: 0 };
    const stakeA = props.stake({ x: A.x, z: A.z, color: '#7A5233' });
    const tags = []; // 桩上的字母标签，结算前和桩一起收走（T 在树上，不收）
    const tagOf = (p, t, dy = 1.5, keep = false) => { const l = ctx.labels.add(v3(p.x, dy, p.z), t, { cls: 'num', pop: false }); if (!keep) tags.push(l); return l; };
    tagOf(A, 'A'); tagOf(T, 'T', 4.2, true);

    const g = await ctx.guess({ kind: 'length', actual: W, prompt: '先猜：河有几步宽？', min: 2, max: 14, start: 6, unit: '步' });

    // ---- B：沿岸走 b 步 ----
    const home = (k) => ({ x: -3.5, z: 2.6 + k * 1.2 });
    const bankDrag = (stake, homePos, opts) => {
      const rope = props.rope({ points: [opts.from, opts.from], every: 1, y: 0.3 });
      const lbl = ctx.labels.add(v3(0, 0.8, 0), '', { cls: 'num lit', pop: false });
      lbl.show(false);
      let cur = null; // 吸在岸上的位置
      return ctx.waitFor((done) => {
        const h = ctx.pointer.draggable(stake, {
          lift: 0.3,
          snap: (p) => {
            if (Math.abs(p.z) < 1.8 && p.x > opts.from.x + 1.4) {
              cur = Math.min(opts.max, Math.max(opts.from.x + 1, Math.round(p.x)));
              p.x = cur; p.z = 0;
            } else cur = null;
            return p;
          },
          onMove: (p) => {
            stake.position.set(p.x, 0, p.z);
            if (cur !== null) {
              rope.setPoints([opts.from, { x: cur, z: 0 }]);
              lbl.target = v3((opts.from.x + cur) / 2, 0.5, 0);
              lbl.set(`${showNum(cur - opts.from.x)} 步`).show(true);
            } else { rope.setPoints([opts.from, opts.from]); lbl.show(false); }
          },
          onEnd: async () => {
            if (cur !== null && opts.accept(cur)) { h.enabled = false; stake.position.set(cur, 0, 0); done({ x: cur, rope, lbl }); return; }
            if (cur !== null) { ctx.nudge(opts.bad); return; }
            ctx.audio.play('whoosh');
            await ctx.fx.to(stake.position, { x: homePos.x, z: homePos.z }, 300);
            rope.setPoints([opts.from, opts.from]); lbl.show(false);
          },
        });
        ctx.hint({
          text: opts.hint,
          ghost: () => ctx.fx.ghostHand(v3(stake.position.x, 0.5, stake.position.z), v3(opts.demoX, 0.5, 0)),
          demo: () => ctx.pointer.simulateDrag(h, v3(opts.demoX, 0, 0), { duration: 1000 }),
        });
      });
    };

    const sB = props.stake({ x: home(0).x, z: home(0).z });
    props.hitBox(1.2, 1.4, 1.2, sB);
    ctx.fx.pop(sB);
    ctx.hud.task('拿一根桩 B，沿河岸往右走几步，打在岸边上。');
    const rB = await bankDrag(sB, home(0), { from: A, max: 5, accept: (x) => x >= 2, bad: '再走远一点。', hint: '把桩拖到岸边，走 2 到 5 步都行。', demoX: 3 });
    ctx.hint(null);
    ctx.audio.play('place');
    const b = rB.x;
    const B = { x: b, z: 0 };
    tagOf(B, 'B');
    await ctx.wait(400);

    // ---- C：再走同样的步数 ----
    const sC = props.stake({ x: home(1).x, z: home(1).z });
    props.hitBox(1.2, 1.4, 1.2, sC);
    ctx.fx.pop(sC);
    ctx.hud.task(`再拿一根桩 C，再走同样的 ${b} 步。`);
    const beacon = makeBeacon(ctx, 2 * b, 0, { r: 0.8 });
    const rC = await bankDrag(sC, home(1), { from: B, max: 2 * b + 3, accept: (x) => x === 2 * b, bad: `要和刚才一样，也是 ${b} 步。`, hint: `从 B 再走 ${b} 步，就是发亮的地方。`, demoX: 2 * b });
    ctx.hint(null);
    beacon.remove();
    ctx.audio.play('place');
    const C = { x: 2 * b, z: 0 };
    tagOf(C, 'C');
    ctx.fx.sparkle(C, { color: '#9FE07A', size: 1.2 });
    await ctx.wait(500);
    void rC;

    // ---- D：从 C 垂直后退，直到 B、T 连成一线 ----
    ctx.hud.task('从 C 笔直往后退。回头看，B 和树连成一条线时停下。');
    const man = props.villager({ x: C.x, z: 1, face: Math.PI });
    props.hitBox(1.4, 1.8, 1.4, man.group);
    man.face(T);
    const sight = makeSeg(ctx, { color: '#FFF4D0', r: 0.06 });
    const ringB = makeBeacon(ctx, B.x, B.z, { r: 0.7, color: '#FFF4D0' });
    const Dp = { x: C.x, z: 1 };
    let aligned = false;
    const refresh = () => {
      sight.set(v3(Dp.x, 0.55, Dp.z), v3(T.x, 0.55, T.z));
      const ok = collinear(T, B, Dp, 0.05);
      if (ok && !aligned) { ctx.audio.play('good'); ctx.fx.sparkle(B, { color: '#9FE07A', size: 1.2 }); }
      aligned = ok;
      sight.color(ok ? '#6FD05A' : '#FFF4D0');
      sight.mesh.scale.x = sight.mesh.scale.y = ok ? 2 : 1;
    };
    refresh();
    const crumb = props.rope({ points: [C, C], every: 1, y: 0.25 });
    await ctx.waitFor((done) => {
      const h = ctx.pointer.draggable(man.group, {
        lift: 0, ringSize: 0.7,
        snap: (p) => { p.x = C.x; p.z = Math.min(13, Math.max(1, Math.round(p.z))); return p; },
        onMove: (p) => { man.group.position.set(p.x, 0, p.z); Dp.z = p.z; man.face(T); crumb.setPoints([C, { x: C.x, z: p.z }]); refresh(); },
        onEnd: () => {
          if (aligned) { h.enabled = false; done(); } else ctx.nudge('还没连成一线。再往前或往后挪一挪。');
        },
      });
      ctx.hint({
        text: 'B 和树要连成一条线。让白线正好穿过 B。',
        ghost: () => ctx.fx.ghostHand(v3(man.group.position.x, 0.8, man.group.position.z), v3(C.x, 0.8, W)),
        demo: () => ctx.pointer.simulateDrag(h, v3(C.x, 0, W), { duration: 1500 }),
      });
    });
    ctx.hint(null);
    const D = { x: C.x, z: Dp.z };
    ringB.remove();
    crumb.group.removeFromParent();
    const stakeD = props.stake({ x: D.x, z: D.z, color: '#7A5233' });
    tagOf(D, 'D');
    ctx.audio.play('place');
    ctx.nudge('B 和树连成一线了！在这里打桩 D。', { kind: 'good' });
    await ctx.wait(1500);

    // ---- 量 CD ----
    const m = await measureRope(ctx, { from: C, to: D, every: 1, text: '量一量 C 到 D。', hintText: '把金色绳头拉到桩 D 上。', snapR: 1.4 });
    sight.show(false);

    // ---- 两个三角形一模一样 ----
    ctx.hud.task('看，两个三角形一模一样。');
    const abt = props.polyField({ points: [A, B, T], color: '#F2B134', opacity: 0.5, edge: '#B77E12', y: 0.1 });
    const grp = ctx.add(new THREE.Group());
    grp.position.set(B.x, 0.12, B.z);
    props.polyField({ points: [{ x: C.x - B.x, z: 0 }, { x: 0, z: 0 }, { x: D.x - B.x, z: D.z - B.z }], color: '#E58D6B', opacity: 0.6, edge: '#C8553D', parent: grp });
    void abt;
    await ctx.wait(900);
    await ctx.fx.tween({ duration: 2000, ease: 'inOut', onUpdate: (k) => { grp.rotation.y = k * Math.PI; } });
    ctx.audio.play('good');
    ctx.fx.sparkle({ x: (A.x + T.x) / 2, z: (A.z + T.z) / 2 }, { color: '#F7C948', size: 1.6 });
    const mid = v3(T.x - 1.8, 0.8, (A.z + T.z) / 2);
    ctx.labels.add(mid, `河宽 ${showNum(m.len)}<small>步</small>`, { cls: 'big' });
    ctx.say(`河宽 ${showNum(m.len)} 步`);
    await ctx.wait(2200);
    // 结算前：把打在地上的四根桩和字母收走
    tags.forEach((l) => l.remove());
    await Promise.all([stakeA, sB, sC, stakeD].map((o) => ctx.fx.to(o.scale, { x: 0.001, y: 0.001, z: 0.001 }, 350, { ease: 'in' })));
    [stakeA, sB, sC, stakeD].forEach((o) => ctx.remove(o));
    void PALETTE;
    ctx.complete({ stars: geo.starsByError(Math.abs(g - W), 2, 4) });
  },
});
