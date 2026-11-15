// 3-6 隔海望山（本章大关）· 两根竿量够不着的山
// 侧面看：趴在地上，眼睛、竿顶、山顶三点一线，量退了几步；第二根竿挪远，再来一次。
// 两次多退的步数，和山高有放大关系：把「多退的小三角」放大到盖满两个桩之间，竖边就是山高。
import { defineLevel } from '../../engine/level.js';
import { PALETTE } from '../../engine/palette.js';
import { makeSeg, makePole, makeBeacon, v3 } from './kit.js';
import { makeScaleBoard } from './scale-diagram.js';
import { sightY, mountainHeight, showNum } from './math.js';

const H_POLE = 3, MX = 8, MH = 15, A1 = 2, A2 = 4, D = 8;

export default defineLevel({
  id: 'ch3-l6',
  title: '隔海望山',
  concept: '两次测量·相似',
  brief: '海对面有座山，船过不去，影子也落在海里。只有两根一样高的竿，各 3 步。',
  discovery: '量两次，连过不去的山，也能量出来。',

  async setup(ctx) {
    ctx.state.toScreen = (x, y, z) => ctx.pointer.toScreen(new ctx.THREE.Vector3(x, y, z)); // 调试 / 自动测试用
    const { props, THREE } = ctx;
    props.ground({ w: 34, d: 8, x: -1, z: 0, seed: 81, river: null, trees: 0, cells: false });
    ctx.view.shadow({ x: -2, z: 0 }, 18);
    ctx.view.frame({ x: -2, z: 0 }, 14.5, { instant: true, yaw: 0, pitch: 20, y: 6.5 });
    // 海
    const water = props.water({ x: 2.6, z: 0, w: 2.8, d: 12 });
    water.position.y = 0.08;
    const sea = ctx.labels.add(v3(2.6, 0.2, 2.6), '海', { cls: 'soft', pop: false });
    void sea;
    // 山
    const mt = new THREE.Mesh(new THREE.ConeGeometry(5.66, MH, 4), new THREE.MeshLambertMaterial({ color: '#9A9486' }));
    mt.position.set(MX, MH / 2, 0);
    mt.rotation.y = Math.PI / 4;
    mt.receiveShadow = mt.castShadow = true;
    ctx.add(mt);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.944, 2.5, 4), new THREE.MeshLambertMaterial({ color: '#FFFFFF' }));
    cap.position.set(MX, MH - 1.25, 0);
    cap.rotation.y = Math.PI / 4;
    ctx.add(cap);
    const flag = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32, 0), new THREE.MeshBasicMaterial({ color: PALETTE.gold }));
    flag.position.set(MX, MH, 0);
    ctx.add(flag);
    ctx.labels.add(v3(MX, MH + 0.5, 0), '山顶', { cls: 'tag', pop: false });
    ctx.onUpdate((dt, t) => { const s = 1 + Math.sin(t * 5) * 0.15; flag.scale.set(s, s, s); });

    const g = await ctx.guess({ kind: 'height', actual: MH, prompt: '先猜：这座山有几步高？', min: 3, max: 30, start: 10, unit: '步' });

    // 数退了几步：绳从竿脚拉到人，结一个个亮
    async function countBack(from, to, text) {
      const rope = props.rope({ points: [from, to], every: 1, y: 0.18 });
      const knots = rope.knots();
      const c = ctx.labels.add(v3(from.x, 0.6, 0), '', { cls: 'num lit', pop: false });
      for (let k = 1; k <= knots.length; k++) {
        rope.setLit(k);
        c.target = knots[k - 1].clone().setY(0.6);
        c.set(k);
        ctx.audio.play('count', { n: k - 1 });
        await ctx.wait(260);
      }
      c.remove();
      const n = Math.round(Math.abs(to.x - from.x));
      ctx.labels.add(v3((from.x + to.x) / 2, 0.8, 0), `${text} ${n} 步`, { cls: 'tag', pop: false });
      return n;
    }

    // 趴着看：把人拖到「三点一线」
    async function look({ pole, range, goalA, color, lineKeep }) {
      const man = props.villager({ x: pole.x - 1, z: 0, face: Math.PI / 2 });
      man.group.scale.y = 0.4;
      props.hitBox(1.6, 1.6, 1.6, man.group);
      const line = makeSeg(ctx, { color: '#FFF4D0', r: 0.07 });
      let a = 1, aligned = false;
      const refresh = (x) => {
        const E = x;
        const y = sightY(E, pole.x, H_POLE, MX);
        line.set(v3(E, 0.05, 0), v3(MX, y, 0));
        const ok = Math.round(pole.x - E) === goalA;
        if (ok && !aligned) { ctx.audio.play('good'); ctx.fx.sparkle({ x: E, z: 0 }, { color: '#9FE07A', size: 1.2 }); }
        aligned = ok;
        line.color(ok ? '#6FD05A' : '#FFF4D0');
        line.mesh.scale.x = line.mesh.scale.y = ok ? 2 : 1;
      };
      refresh(man.group.position.x);
      await ctx.waitFor((done) => {
        const h = ctx.pointer.draggable(man.group, {
          lift: 0, ringSize: 0.8,
          snap: (p) => { a = Math.min(range[1], Math.max(range[0], Math.round(pole.x - p.x))); p.x = pole.x - a; p.z = 0; return p; },
          onMove: (p) => { man.group.position.set(p.x, 0, 0); refresh(p.x); },
          onEnd: () => { if (aligned) { h.enabled = false; done(); } else ctx.nudge('线没有碰到山顶。往前或往后挪一挪。'); },
        });
        ctx.hint({
          text: '趴低，让眼睛、竿顶、山顶三点连成一条线。',
          ghost: () => ctx.fx.ghostHand(v3(man.group.position.x, 0.5, 0), v3(pole.x - goalA, 0.5, 0)),
          demo: () => ctx.pointer.simulateDrag(h, v3(pole.x - goalA, 0, 0), { duration: 1300 }),
        });
      });
      ctx.hint(null);
      if (lineKeep) { line.mesh.material.transparent = true; line.mesh.material.opacity = 0.55; line.mesh.material.color.set(color); line.mesh.scale.x = line.mesh.scale.y = 1; }
      else line.color(color);
      const stake = props.stake({ x: man.group.position.x, z: 0, h: 0.8, color });
      ctx.fx.pop(stake);
      ctx.remove(man.group);
      return { E: man.group.position.x, stake };
    }

    // ---- 第一次 ----
    ctx.hud.progress(0, 2);
    ctx.hud.task('先立第一根竿。把人拖到后面，趴下，三点连成一线。');
    const p1 = makePole(ctx, { x: 0, z: 0, h: H_POLE, ray: false });
    p1.poly.show(false); p1.tip.visible = false;
    ctx.fx.pop(p1.group);
    const r1 = await look({ pole: p1, range: [1, 6], goalA: A1, color: '#F2B134', lineKeep: true });
    ctx.audio.play('place');
    const a1 = await countBack({ x: 0, z: 0 }, { x: r1.E, z: 0 }, '退了');
    await ctx.wait(700);

    // ---- 第二次：第二根竿挪远 ----
    ctx.hud.progress(1, 2);
    ctx.hud.task(`把第二根竿立到发亮的地方，离第一根 ${D} 步。再来一次。`);
    const beacon = makeBeacon(ctx, -D, 0, { r: 0.8 });
    const p2 = makePole(ctx, { x: -4, z: 0, h: H_POLE, ray: false });
    p2.poly.show(false); p2.tip.visible = false;
    props.hitBox(1.2, 3.4, 1.2, p2.group);
    ctx.fx.pop(p2.group);
    let atBeacon = false;
    await ctx.waitFor((done) => {
      const h = ctx.pointer.draggable(p2.group, {
        lift: 0.2, ringSize: 0.7,
        snap: (p) => { p.x = Math.min(-3, Math.max(-14, Math.round(p.x))); p.z = 0; atBeacon = p.x === -D; return p; },
        onMove: (p) => { p2.group.position.set(p.x, 0, 0); p2.x = p.x; },
        onEnd: () => { if (atBeacon) { h.enabled = false; done(); } else ctx.nudge(`再挪挪，要离第一根正好 ${D} 步。`); },
      });
      ctx.hint({
        text: `把第二根竿拖到发亮的圈上，离第一根 ${D} 步。`,
        ghost: () => ctx.fx.ghostHand(v3(p2.group.position.x, 0.6, 0), v3(-D, 0.6, 0)),
        demo: () => ctx.pointer.simulateDrag(h, v3(-D, 0, 0), { duration: 1000 }),
      });
    });
    ctx.hint(null);
    beacon.remove();
    p2.group.position.x = -D; p2.x = -D;
    ctx.audio.play('place');
    ctx.hud.task('同样趴下，三点连成一线。这次要退得更远。');
    const r2 = await look({ pole: p2, range: [1, 8], goalA: A2, color: '#C8553D', lineKeep: false });
    ctx.audio.play('place');
    const a2 = await countBack({ x: -D, z: 0 }, { x: r2.E, z: 0 }, '退了');
    await ctx.wait(600);
    const gap = Math.round(r1.E - r2.E);

    // 两桩之间
    const span = props.rope({ points: [{ x: r1.E, z: 0 }, { x: r2.E, z: 0 }], every: 1, y: 0.45, color: '#FFF4D0' });
    span.setLit(gap);
    ctx.labels.add(v3((r1.E + r2.E) / 2, 2.2, 0), `两桩相距 ${gap} 步`, { cls: 'tag', pop: false });
    await ctx.wait(900);

    // ---- 放大小三角 ----
    ctx.hud.task('第二次多退了 2 步。把这个小三角拉大，底边盖满两桩的距离。');
    const extra = a2 - a1;
    const board = makeScaleBoard(ctx, {
      side: 'left', base: extra, height: H_POLE, target: gap,
      caption: `多退 ${extra} 步，竿高 ${H_POLE} 步`, stripName: '两桩相距',
    });
    await ctx.waitFor((done) => {
      board.onRelease((k) => { if (Math.abs(k - board.goal) < 1e-6) done(); else ctx.nudge('底边要刚好盖满两桩的距离。'); });
      ctx.hint({ text: '往右拉金球，让三角形的底边和两桩的距离一样长。', ghost: () => board.ghost(board.goal), demo: () => board.simulateTo(board.goal) });
    });
    ctx.hint(null);
    board.lock(true);
    const H = mountainHeight(H_POLE, a1, a2, D);
    ctx.audio.play('good');
    ctx.fx.sparkle({ x: MX, z: 0 }, { color: '#F7C948', size: 2.4 });
    ctx.labels.add(v3(MX - 5.5, MH * 0.55, 0), `山高 ${showNum(H)}<small>步</small>`, { cls: 'big' });
    ctx.say(`山有 ${showNum(H)} 步高`);
    await ctx.wait(2600);
    const stars = ctx.hintsUsed === 0 ? 3 : ctx.hintsUsed < 3 ? 2 : 1;
    void g;
    ctx.complete({ stars });
  },
});
