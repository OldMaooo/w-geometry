// 1-1 量田埂 · 长度是数出来的
// 先猜几步 → 从桩上拉结绳到另一根桩 → 结一个个亮起报数 → 田埂上长出一排小草。连做 3 条，第 3 条是斜的。
import { defineLevel } from '../../engine/level.js';
import { PALETTE } from '../../engine/palette.js';
import { v3 } from './kit.js';

const RIDGES = [
  { a: { x: -8.5, z: -3.5 }, ang: 0 },        // 横
  { a: { x: 7.5, z: -5.5 }, ang: -90 },       // 竖（往镜头方向）
  { a: { x: -7.5, z: 5 }, ang: 30 },          // 斜
];

export default defineLevel({
  id: 'ch1-l1',
  title: '量田埂',
  concept: '长度·单位',
  brief: '洪水冲没了阿禾家的田埂，只剩两头的残桩。这条田埂有几步长？',
  discovery: '斜着放的田埂，也能用同一根结绳量。',

  async setup(ctx) {
    const { props, geo } = ctx;
    props.ground({ w: 24, d: 15, seed: 11, puddles: 0 });
    ctx.view.shadow({ x: 0, z: 0 }, 17);
    const ahe = props.villager({ x: -10.5, z: 1.5, color: PALETTE.clay, face: 0.6 });
    ctx.view.frame({ x: 0, z: 0.5 }, 12, { instant: true });

    // 三条的长度：4–10 的整数，尽量不重复
    const lens = [];
    while (lens.length < 3) {
      const L = ctx.rand(4, lens.length === 2 ? 9 : 10);
      if (!lens.includes(L)) lens.push(L);
    }
    ctx.state.lengths = lens;
    const errs = [];

    for (let i = 0; i < 3; i++) {
      ctx.hud.progress(i, 3);
      const r = RIDGES[i];
      const L = lens[i];
      const rad = (r.ang * Math.PI) / 180;
      const dir = { x: Math.cos(rad), z: -Math.sin(rad) };
      const A = r.a;
      const B = { x: A.x + dir.x * L, z: A.z + dir.z * L };
      const mid = { x: (A.x + B.x) / 2, z: (A.z + B.z) / 2 };
      const sA = props.stake({ x: A.x, z: A.z, h: 0.7 });
      const sB = props.stake({ x: B.x, z: B.z, h: 0.55, color: '#8E6440' });
      ctx.fx.pop(sA); ctx.fx.pop(sB, { delay: 120 });
      ctx.view.frame(mid, L / 2 + 2);
      ahe.face(mid);

      if (i > 0) ctx.hud.task(i === 2 ? '这一条是斜着的。先猜猜，几步长？' : '又一条田埂。先猜猜，几步长？');
      const g = await ctx.guess({ kind: 'length', actual: L, prompt: '先猜：几步长？', min: 1, max: 12, start: 6, unit: '步' });
      errs.push(Math.abs(g - L));

      ctx.hud.task('按住桩上的绳头，拉到另一根桩上。');
      // 结绳 + 绳头
      const rope = props.rope({ points: [A, A] });
      const head = ctx.add(new ctx.THREE.Group());
      head.position.set(A.x + dir.x * 0.45, 0, A.z + dir.z * 0.45);
      const knob = new ctx.THREE.Mesh(new ctx.THREE.IcosahedronGeometry(0.2, 0), new ctx.THREE.MeshLambertMaterial({ color: PALETTE.gold }));
      knob.position.y = 0.32;
      knob.castShadow = true;
      head.add(knob);
      props.hitBox(1, 0.8, 1, head);
      rope.setPoints([A, { x: head.position.x, z: head.position.z }]);
      let atB = false;
      const measured = ctx.waitFor((done) => {
        const handle = ctx.pointer.draggable(head, {
          ringSize: 0.55,
          lift: 0,
          snap: (p) => {
            // 靠近另一根桩就吸过去；绳子最长 12 步
            if (geo.dist({ x: p.x, y: p.z }, { x: B.x, y: B.z }) < 1.1) { p.x = B.x; p.z = B.z; return p; }
            const d = Math.hypot(p.x - A.x, p.z - A.z);
            if (d > 12) { p.x = A.x + ((p.x - A.x) / d) * 12; p.z = A.z + ((p.z - A.z) / d) * 12; }
            return p;
          },
          onMove: (p) => {
            head.position.set(p.x, 0, p.z);
            rope.setPoints([A, p]);
            const now = p.x === B.x && p.z === B.z;
            if (now && !atB) ctx.audio.play('snap');
            atB = now;
          },
          onEnd: async () => {
            if (atB) { handle.enabled = false; done(); return; }
            // 没拉到：绳子缩回去
            const from = { x: head.position.x, z: head.position.z };
            const to = { x: A.x + dir.x * 0.45, z: A.z + dir.z * 0.45 };
            ctx.audio.play('whoosh');
            await ctx.fx.tween({ duration: 300, onUpdate: (k) => {
              head.position.set(from.x + (to.x - from.x) * k, 0, from.z + (to.z - from.z) * k);
              rope.setPoints([A, { x: head.position.x, z: head.position.z }]);
            } });
            if (Math.hypot(from.x - A.x, from.z - A.z) > 1.5) ctx.nudge('再拉远一点，拉到那根桩上。');
          },
        });
        ctx.hint({
          text: '按住金色的绳头，一直拉到那一头的桩上再松手。',
          ghost: () => ctx.fx.ghostHand(v3(head.position.x, 0.3, head.position.z), v3(B.x, 0.3, B.z)),
          demo: () => ctx.pointer.simulateDrag(handle, v3(B.x, 0, B.z), { duration: 1100 }),
        });
      });
      await measured;
      ctx.hint(null);

      // 结一个个亮起来报数
      const counter = ctx.labels.add(v3(A.x, 0.6, A.z), '', { cls: 'num lit', pop: false });
      counter.show(false);
      const knots = rope.knots();
      for (let k = 1; k <= knots.length; k++) {
        rope.setLit(k);
        counter.target = knots[k - 1].clone().setY(0.55);
        counter.set(k).show(true);
        ctx.audio.play('count', { n: k - 1 });
        await ctx.wait(k === knots.length ? 380 : 260);
      }
      counter.remove();
      const big = ctx.labels.add(v3(mid.x, 0.7, mid.z), `${L}<small>步</small>`, { cls: 'big' });
      ctx.say(`${L} 步`);
      if (g === L) ctx.nudge('一步不差！', { kind: 'good', speak: false });

      // 田埂长出来：一道土埂 + 一排小草
      const ridge = new ctx.THREE.Mesh(new ctx.THREE.BoxGeometry(L, 0.18, 0.42), new ctx.THREE.MeshLambertMaterial({ color: PALETTE.ridge }));
      ridge.position.set(mid.x, 0.09, mid.z);
      ridge.rotation.y = rad;
      ridge.receiveShadow = ridge.castShadow = true;
      ctx.add(ridge);
      ridge.scale.y = 0.01;
      ctx.fx.tween({ duration: 500, ease: 'back', onUpdate: (k) => { ridge.scale.y = Math.max(0.01, k); } });
      const cells = [];
      for (let t = 0.25; t < L; t += 0.5) cells.push({ x: A.x + dir.x * t - dir.z * 0.32 * ((t * 2) % 2 ? 1 : -1), z: A.z + dir.z * t + dir.x * 0.32 * ((t * 2) % 2 ? 1 : -1) });
      const grass = props.crops({ cells, kind: 'grass', per: 2, seed: 30 + i });
      grass.mesh.position.y = 0.16;
      await grass.grow({ stagger: 22, onEach: (n) => { if (n % 3 === 0) ctx.audio.play('grow', { n }); } });
      ahe.cheer();
      await ctx.wait(900);
      big.remove();
      ctx.labels.add(v3(mid.x, 0.5, mid.z), `${L} 步`, { cls: 'soft', pop: false });
    }

    ctx.hud.progress(3, 3);
    const avg = errs.reduce((s, e) => s + e, 0) / errs.length;
    ctx.state.avgErr = avg;
    ctx.view.frame({ x: 0, z: 0.5 }, 12.5);
    ahe.cheer();
    await ctx.wait(700);
    ctx.complete({ stars: geo.starsByError(avg, 1, 2) });
  },
});
