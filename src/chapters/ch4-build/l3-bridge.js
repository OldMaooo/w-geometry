// 4-3 桥架不歪 · 三角形最稳
// 先在木工桌上拖一个四根木条的方框（会歪）和一个三根木条的三角框（不动），给歪的方框加一根斜撑。
// 再给桥架（一排方框）的每一格装斜撑，让牛车过桥：没撑的格子会歪、桥面塌下去。
import * as THREE from 'three';
import { defineLevel } from '../../engine/level.js';
import { mat, shared } from '../../engine/shared.js';
import { makeBar, makePin, sweepIn, injectStyles, mountDom, BASE_CSS, v3, go, dur, C } from './kit.js';
import { swingFrame, unbraced, braceCount, minBraces } from './math.js';

const CSS = `${BASE_CSS}
.c4-stock { left: 14px; top: 84px; padding: 8px 16px; font-size: 21px; display: flex; align-items: baseline; gap: 8px; }
.c4-stock b { font-size: 30px; font-variant-numeric: tabular-nums; }
.c4-stock small { font-size: 17px; color: var(--ink-2, #7a6650); }
`;

const N = 5, PW = 2.4, PH = 1.8, X0 = -6, TZ = -1.0;
const xk = (k) => X0 + k * PW;

export default defineLevel({
  id: 'ch4-l3',
  title: '桥架不歪',
  concept: '三角形最稳',
  brief: '河上要架木桥。学徒搭的方框桥架，一上人就歪了。',
  discovery: '四边形的四条边定不住形状，会歪；三角形三条边一定，形状就死了。',

  async setup(ctx) {
    const { props, fx } = ctx;
    injectStyles(ctx, CSS);

    // ================= 第一段：木工桌上的两个框 =================
    const ground = props.ground({ w: 16, d: 11, seed: 63, river: null, trees: 9, cells: false });
    ctx.view.shadow({ x: 0, z: 0.5 }, 11);
    const A = ctx.add(new THREE.Group());
    const table = new THREE.Mesh(new THREE.BoxGeometry(13.6, 0.12, 6.6), mat('#D9C28F'));
    table.position.set(0, 0.04, 0.6);
    table.receiveShadow = true;
    A.add(table);
    const Y = 0.2;
    const L = 3;
    const pins = [];
    const pinAt = (parent, x, z) => { const p = makePin(); p.position.set(x, Y, z); parent.add(p); pins.push(p); return p; };

    // --- 方框 ---
    const sq = new THREE.Group();
    A.add(sq);
    const sA = { x: -5.8, z: 2.4 }, sB = { x: -2.8, z: 2.4 };
    const sBars = [0, 1, 2, 3].map(() => { const b = makeBar(C.wood, 0.22); sq.add(b); return b; });
    const sPins = [pinAt(sq, 0, 0), pinAt(sq, 0, 0), pinAt(sq, 0, 0), pinAt(sq, 0, 0)];
    const sBrace = makeBar('#C8553D', 0.2);
    sBrace.visible = false;
    sq.add(sBrace);
    let sqD = { x: sA.x, z: sA.z - L }, sqC = { x: sB.x, z: sB.z - L };
    let sqDeg = 90;
    let braced = false;
    const P3 = (p) => v3(p.x, Y, p.z);
    const placeSq = () => {
      const pts = [sA, sB, sqC, sqD];
      pts.forEach((p, i) => sPins[i].position.set(p.x, Y, p.z));
      sBars[0].userData.set(P3(sA), P3(sB));
      sBars[1].userData.set(P3(sB), P3(sqC));
      sBars[2].userData.set(P3(sqC), P3(sqD));
      sBars[3].userData.set(P3(sqD), P3(sA));
      if (braced) sBrace.userData.set(P3(sA), P3(sqC));
      sqHit.position.set(sqD.x, 0.3, sqD.z);
    };
    const sqHit = props.hitBox(1.6, 0.8, 1.6, A);
    // 角上的小金环，提示「这里能拖」
    const ringMat = shared(new THREE.MeshBasicMaterial({ color: C.gold, transparent: true, opacity: 0.9 }));
    const mkRing = () => { const r = new THREE.Mesh(shared(new THREE.TorusGeometry(0.42, 0.06, 6, 20)), ringMat); r.rotation.x = Math.PI / 2; A.add(r); return r; };
    const sqRing = mkRing();
    placeSq();

    // --- 三角框 ---
    const tri = new THREE.Group();
    A.add(tri);
    const tA = { x: 1.7, z: 2.4 }, tB = { x: 4.7, z: 2.4 }, tP = { x: 3.2, z: 2.4 - L * Math.sin(Math.PI / 3) };
    const tBars = [0, 1, 2].map(() => { const b = makeBar(C.wood, 0.22); tri.add(b); return b; });
    [tA, tB, tP].forEach((p) => pinAt(tri, p.x, p.z));
    tBars[0].userData.set(P3(tA), P3(tB));
    tBars[1].userData.set(P3(tB), P3(tP));
    tBars[2].userData.set(P3(tP), P3(tA));
    const triHit = props.hitBox(1.6, 0.8, 1.6, A);
    triHit.position.set(tP.x, 0.3, tP.z);
    const triRing = mkRing();
    triRing.position.set(tP.x, Y, tP.z);
    // 摇一摇
    const shake = (g, amp = 0.05) => go(fx.tween({ duration: 420, ease: 'linear', onUpdate: (k) => { g.rotation.y = Math.sin(k * Math.PI * 5) * amp * (1 - k); } }));

    const lblSq = ctx.labels.add(v3(-4.3, 0.2, 3.5), '四根木条', { cls: 'tag', pop: false });
    const lblTri = ctx.labels.add(v3(3.2, 0.2, 3.5), '三根木条', { cls: 'tag', pop: false });
    await sweepIn(ctx, { x: 0, z: 0.8 }, 8.4, { yaw0: -30, yaw1: -6, pitch: 50, ms: 2200 });

    let sqSkewed = false, triTried = false, sqTried = false;
    const hSq = ctx.pointer.draggable(sqHit, {
      ringSize: 0.9, lift: 0, silent: true,
      onMove: (p) => {
        sqTried = true;
        if (braced) { shake(sq, 0.012); return; }
        const r = swingFrame(sA, sB, L, p);
        if (Math.abs(r.deg - sqDeg) > 3) ctx.audio.play('tick');
        sqD = r.D; sqC = r.C; sqDeg = r.deg;
        if (Math.abs(sqDeg - 90) > 22) sqSkewed = true;
        placeSq();
        sqRing.position.set(sqD.x, Y, sqD.z);
      },
      onEnd: () => { if (braced && sqTried) ctx.nudge('加了斜撑，怎么拖都不歪。', { kind: 'good' }); sqTried = false; checkA(); },
    });
    sqRing.position.set(sqD.x, Y, sqD.z);
    let triMoved = 0;
    const hTri = ctx.pointer.draggable(triHit, {
      ringSize: 0.9, lift: 0, silent: true,
      onStart: () => { triMoved = 0; },
      onMove: (p) => {
        triMoved = Math.max(triMoved, Math.hypot(p.x - tP.x, p.z - tP.z));
        tri.rotation.y = Math.max(-0.05, Math.min(0.05, (p.x - tP.x) * 0.02));
        tri.position.x = Math.max(-0.05, Math.min(0.05, (p.x - tP.x) * 0.03));
      },
      onEnd: () => {
        if (triMoved > 0.4) { triTried = true; ctx.audio.play('soft'); }
        tri.position.x = 0;
        shake(tri, 0.04);
        checkA();
      },
    });
    let resolveA = null;
    const checkA = () => { if (sqSkewed && triTried && !braced) resolveA?.(); };

    ctx.hud.task('拖拖看：方框的上角，和三角框的上角。');
    ctx.hint({
      text: '按住方框左上角拖一拖；再拖一拖三角框的尖。',
      ghost: () => {
        if (!sqSkewed) return ctx.fx.ghostHand(v3(sqD.x, 0.5, sqD.z), v3(-3.6, 0.5, -0.5));
        return ctx.fx.ghostHand(v3(tP.x, 0.5, tP.z), v3(tP.x + 1.2, 0.5, tP.z - 0.8));
      },
      demo: async () => {
        if (!sqSkewed) await ctx.pointer.simulateDrag(hSq, v3(-3.6, 0, -0.5), { duration: 1000 });
        if (!triTried) await ctx.pointer.simulateDrag(hTri, v3(tP.x + 1.3, 0, tP.z - 0.9), { duration: 900 });
      },
    });
    await ctx.waitFor((done) => { resolveA = done; checkA(); });
    ctx.hint(null);
    ctx.nudge('方框能歪来歪去，三角框纹丝不动。', { kind: 'good' });
    await ctx.wait(1900);

    // ---- 加斜撑 ----
    ctx.hud.task('给歪了的方框，加一根斜撑。');
    let resolveB = null;
    const braceTool = ctx.hud.tool({
      icon: 'triangle', label: '加斜撑', primary: true,
      onTap: () => {
        if (braced) return;
        braced = true;
        braceTool.hide();
        sBrace.visible = true;
        placeSq();
        ctx.audio.play('place');
        ctx.nudge('分成了两个三角形。再拖拖看。', { kind: 'good' });
        sqRing.visible = false;
        ctx.after(300, () => ctx.fx.sparkle({ x: (sA.x + sqC.x) / 2, z: (sA.z + sqC.z) / 2 }, { size: 1.1, color: '#9FE07A' }));
        ctx.hint(null);
        ctx.after(2800, () => resolveB?.());
      },
    });
    braceTool.pulse(true);
    ctx.hint({
      text: '点下面的「加斜撑」，装在方框的对角上。',
      demo: async () => { braceTool.tap(); await ctx.wait(500); },
    });
    await ctx.waitFor((done) => { resolveB = done; });
    ctx.hint(null);
    hSq.dispose(); hTri.dispose();
    lblSq.remove(); lblTri.remove();
    await ctx.wait(400);

    // ================= 第二段：桥架 =================
    ctx.remove(A);
    ctx.remove(ground);
    ctx.audio.play('whoosh');
    const world = ctx.add(new THREE.Group());
    const grassTop = mat('#A3C46C'), soilSide = mat('#7A5A36'), soilSide2 = mat('#8B6B43');
    const mkBank = (x0, x1) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 1.6, 14), [soilSide2, soilSide2, grassTop, soilSide, soilSide2, soilSide2]);
      m.position.set((x0 + x1) / 2, -0.8, 0);
      m.receiveShadow = true;
      world.add(m);
      return m;
    };
    mkBank(-24, X0 - 0.2);
    mkBank(xk(N) + 0.2, 24);
    const bed = new THREE.Mesh(new THREE.BoxGeometry(N * PW + 0.4, 1.0, 14), mat('#C9B07A'));
    bed.position.set(0, -1.3, 0);
    world.add(bed);
    const river = props.water({ x: 0, z: 0, w: N * PW + 0.4, d: 14, parent: world });
    river.position.y = -0.5;
    for (const [tx, tz, s, kind] of [[-9, -4.5, 1.1, 'round'], [-12, 2.5, 1.3, 'pine'], [-8, 4.6, 0.9, 'round'], [9.5, -4, 1.2, 'pine'], [8.5, 4.8, 1, 'round'], [12, 1.5, 1.3, 'round'], [-14.5, -3, 1.2, 'pine']]) {
      props.tree({ x: tx, z: tz, kind, s, parent: world, seed: Math.round(tx * 7) });
    }
    props.rock({ x: -7.3, z: 3.6, s: 0.6, parent: world });
    ctx.view.shadow({ x: 0, z: 0 }, 14);
    const vill = props.villager({ x: xk(N) + 1.6, z: 1.4, color: '#C8553D', face: -1.2, parent: world });

    // 桥：下弦（桥面）、上弦、竖杆、斜撑
    const bridge = new THREE.Group();
    world.add(bridge);
    const deck = Array.from({ length: N }, () => { const b = makeBar('#B58A52', 0.22, 2.7); bridge.add(b); return b; });
    const bot = Array.from({ length: N }, () => { const b = makeBar(C.wood, 0.2); bridge.add(b); return b; });
    const topc = Array.from({ length: N }, () => { const b = makeBar(C.wood, 0.2); bridge.add(b); return b; });
    const vert = Array.from({ length: N + 1 }, () => { const b = makeBar(C.wood, 0.2); bridge.add(b); return b; });
    const brace = Array.from({ length: N }, (_, i) => { const b = makeBar('#C8553D', 0.2); b.visible = false; bridge.add(b); return b; });
    const glow = Array.from({ length: N }, (_, i) => {
      const g = new THREE.Mesh(new THREE.BoxGeometry(PW - 0.15, PH, 0.5), mat('#F2B134', { opacity: 0.35 }));
      g.position.set((xk(i) + xk(i + 1)) / 2, PH / 2, TZ);
      g.visible = false;
      g.renderOrder = 4;
      bridge.add(g);
      return g;
    });
    const has = Array(N).fill(false);
    const grow = Array(N).fill(0);
    const col = Array(N).fill(0); // 塌了多少（0–1）
    const LEAN = 0.85, DIP = 0.75;
    const Bn = Array.from({ length: N + 1 }, () => v3(0, 0, TZ));
    const Tn = Array.from({ length: N + 1 }, () => v3(0, 0, TZ));
    const Dn = Array.from({ length: N + 1 }, () => v3(0, 0, 0));
    const layout = () => {
      for (let k = 0; k <= N; k++) {
        const c = Math.max(col[k - 1] ?? 0, col[k] ?? 0);
        const end = k === 0 || k === N;
        const a = end ? 0 : LEAN * c;
        const dip = end ? 0 : DIP * c;
        Bn[k].set(xk(k), -0.1 - dip, TZ);
        Tn[k].set(xk(k) + PH * Math.sin(a), -0.1 - dip + PH * Math.cos(a) * (1 - 0.12 * c), TZ);
        Dn[k].set(xk(k), -0.1 - dip, 0);
      }
      for (let i = 0; i < N; i++) {
        deck[i].userData.set(Dn[i], Dn[i + 1]);
        bot[i].userData.set(Bn[i], Bn[i + 1]);
        topc[i].userData.set(Tn[i], Tn[i + 1]);
        brace[i].visible = has[i];
        if (has[i]) {
          const a = i % 2 === 0 ? Bn[i] : Tn[i];
          const b = i % 2 === 0 ? Tn[i + 1] : Bn[i + 1];
          brace[i].userData.set(a, a.clone().lerp(b, grow[i]));
        }
      }
      for (let k = 0; k <= N; k++) vert[k].userData.set(Bn[k], Tn[k]);
    };
    layout();
    const deckY = (x) => {
      const k = Math.max(0, Math.min(N - 1, Math.floor((x - X0) / PW)));
      const t = Math.max(0, Math.min(1, (x - xk(k)) / PW));
      return { y: Dn[k].y + (Dn[k + 1].y - Dn[k].y) * t, slope: (Dn[k + 1].y - Dn[k].y) / PW };
    };

    // 牛车
    const cart = new THREE.Group();
    const box = (w, h, d, c, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c)); m.position.set(x, y, z); m.castShadow = true; cart.add(m); return m; };
    box(1.5, 0.28, 1.2, '#C48E5A', -0.2, 0.55, 0);
    box(1.5, 0.45, 0.12, '#A47148', -0.2, 0.85, 0.55);
    box(1.5, 0.45, 0.12, '#A47148', -0.2, 0.85, -0.55);
    box(0.12, 0.45, 1.2, '#A47148', -0.92, 0.85, 0);
    box(0.95, 0.62, 0.62, '#8A5A3A', 1.2, 0.72, 0);
    box(0.4, 0.4, 0.46, '#6F4528', 1.78, 0.9, 0);
    box(0.12, 0.3, 0.1, '#EFE3C2', 1.85, 1.2, 0.2);
    box(0.12, 0.3, 0.1, '#EFE3C2', 1.85, 1.2, -0.2);
    box(1.3, 0.08, 0.1, '#7A5A36', 0.55, 0.55, 0.0);
    const wheels = [-0.7, 0.55].map((wx) => {
      const w = new THREE.Mesh(shared(new THREE.CylinderGeometry(0.4, 0.4, 0.12, 12)), mat('#6B4A2A'));
      w.rotation.x = Math.PI / 2;
      const g = new THREE.Group();
      g.add(w);
      g.position.set(wx, 0.4, 0.7);
      cart.add(g);
      const g2 = g.clone();
      g2.position.z = -0.7;
      cart.add(g2);
      return [g, g2];
    }).flat();
    world.add(cart);
    cart.scale.setScalar(0.8);
    let cartX = X0 - 4.6;
    const placeCart = (x) => {
      cartX = x;
      const d = deckY(Math.min(Math.max(x, X0), xk(N)));
      const onBridge = x >= X0 && x <= xk(N);
      cart.position.set(x, onBridge ? d.y + 0.11 : 0, 0.3);
      cart.rotation.z = onBridge ? Math.atan(d.slope) * 0.9 : 0;
    };
    placeCart(cartX);
    ctx.onUpdate(layout);

    // 点方框装 / 拆斜撑
    let stock = N + 2;
    const stockCard = document.createElement('div');
    stockCard.className = 'c4-card c4-stock';
    mountDom(ctx, stockCard);
    const showStock = () => { stockCard.innerHTML = `<span>斜撑</span><b>${stock}</b><small>根</small>`; };
    showStock();
    let running = false;
    let used = 0;
    const toggle = (i) => {
      if (running) return;
      if (has[i]) {
        has[i] = false; stock++; ctx.audio.play('soft');
      } else {
        if (stock <= 0) { ctx.nudge('斜撑用完了。拿掉一根再装。', { speak: false }); return; }
        has[i] = true; stock--; grow[i] = 0;
        ctx.audio.play('place');
        go(fx.tween({ duration: 280, ease: 'back', onUpdate: (k) => { grow[i] = Math.min(1, k); } }));
        ctx.fx.sparkle({ x: (xk(i) + xk(i + 1)) / 2, z: TZ }, { size: 0.9, color: '#F7D56A' });
      }
      showStock();
    };
    const hits = Array.from({ length: N }, (_, i) => {
      const h = props.hitBox(PW - 0.1, PH + 0.3, 1.2, bridge);
      h.position.set((xk(i) + xk(i + 1)) / 2, (PH + 0.3) / 2 - 0.05, TZ + 0.2);
      return ctx.pointer.tappable(h, () => toggle(i), { hit: h, radius: 60 });
    });

    await ctx.wait(100);
    await sweepIn(ctx, { x: 0, z: 0 }, 9.6, { yaw0: -26, yaw1: -6, pitch: 24, y: 0.6, ms: 2400 });
    ctx.hud.task('点方框，装上斜撑。每一格都装好，牛车才过得去。');
    let resolveDone = null;

    const nextBare = () => has.findIndex((v) => !v);
    const crossTool = ctx.hud.tool({
      icon: 'play', label: '牛车过桥', primary: true,
      onTap: async () => {
        if (running || ctx.done) return;
        running = true;
        crossTool.enable(false);
        ctx.hint(null);
        const bare = unbraced(N, has);
        const speed = 3.4;
        const toX = (x, ms, ease = 'inOut') => {
          const x0 = cartX;
          return fx.tween({
            duration: dur(ctx, ms), ease,
            onUpdate: (k) => {
              const nx = x0 + (x - x0) * k;
              wheels.forEach((w) => { w.rotation.z -= (nx - cartX) / 0.4 / 0.8; });
              placeCart(nx);
            },
          });
        };
        try {
          if (!bare.length) {
            ctx.audio.play('whoosh');
            await toX(xk(N) + 5.2, ((xk(N) + 5.2 - cartX) / speed) * 1000, 'linear');
            vill.cheer?.();
            resolveDone?.();
          } else {
            const u = bare[0];
            const stopX = xk(u) + 0.5;
            await toX(stopX, ((stopX - cartX) / speed) * 1000, 'linear');
            ctx.audio.play('rotate');
            // 这一格撑不住：歪了，桥面塌下去
            const cg = fx.tween({ duration: dur(ctx, 1000), ease: 'in', onUpdate: (k) => { bare.forEach((b) => { col[b] = Math.max(col[b], k); }); } });
            const slide = toX(xk(u) + 1.1, 900, 'in');
            await Promise.all([cg, slide]);
            ctx.audio.play('soft');
            bare.forEach((b) => { glow[b].visible = true; });
            await ctx.wait(900);
            ctx.nudge(`有 ${bare.length} 格还是歪的，给它们装斜撑。`);
            await ctx.wait(1000);
            // 复原
            await Promise.all([
              fx.tween({ duration: dur(ctx, 700), ease: 'out', onUpdate: (k) => { bare.forEach((b) => { col[b] = 1 - k; }); } }),
              toX(X0 - 4.6, 1500, 'inOut'),
            ]);
            bare.forEach((b) => { col[b] = 0; glow[b].visible = false; });
            ctx.audio.play('tick');
          }
        } catch (e) { running = false; return; }
        running = false;
        crossTool.enable(true);
        if (!bare.length) return;
        ctx.hint(bridgeHint);
      },
    });
    crossTool.show();
    const bridgeHint = {
      text: '每个方框都要装一根斜撑，装完再点「牛车过桥」。',
      ghost: () => {
        const i = Math.max(0, nextBare());
        const p = v3((xk(i) + xk(i + 1)) / 2, PH / 2, TZ);
        return ctx.fx.ghostHand(p.clone().add(v3(1.2, 1.4, 2.2)), p);
      },
      demo: async () => {
        if (running) return;
        for (let n = 0; n < N + 1 && nextBare() >= 0; n++) { toggle(nextBare()); await ctx.wait(220); }
        await ctx.wait(300);
        crossTool.tap();
        await ctx.wait(500);
      },
    };
    ctx.hint(bridgeHint);
    ctx.state.hasBraces = has;
    await ctx.waitFor((done) => { resolveDone = done; });
    ctx.hint(null);
    used = braceCount(has);
    ctx.audio.play('success');
    ctx.nudge(used === minBraces(N) ? `每格一根，刚刚好！` : '稳稳过去了。每格一根其实就够了。', { kind: 'good', speak: false });
    ctx.fx.celebrate({ x: xk(N) + 1, z: 1 }, { count: 70 });
    await ctx.wait(1500);
    void hits;
    ctx.complete({ stars: used === minBraces(N) ? 3 : 2, delay: 500 });
  },
});
