// 4-5 屋顶的坡 · 太平漏雨、太陡滑瓦
// 屋宽固定。拖屋脊上下改坡度，旁边的小台阶图实时显示「走 2 步升几步」。点「下雨」：太平 → 水积着渗进屋；太陡 → 瓦片滑落；合适 → 雨水顺顺流下。
// 第二座：屋子加宽到 12 步，同样的坡屋脊要多高？先猜再拖。
import * as THREE from 'three';
import { defineLevel } from '../../engine/level.js';
import { mat, shared } from '../../engine/shared.js';
import { makePin, sweepIn, injectStyles, mountDom, BASE_CSS, v3, go, C } from './kit.js';
import { roofKind, risePer2, goodRidge } from './math.js';

const CSS = `${BASE_CSS}
.c4-slope { left: 14px; top: 84px; width: 214px; padding: 8px 12px 10px; display: flex; flex-direction: column; align-items: center; gap: 2px; transition: border-color .25s, background-color .25s; }
.c4-slope.ok { border-color: #5f9a3a; background: #eaf6dc; }
.c4-slope svg { width: 180px; height: 118px; }
.c4-slope .tx { font-size: 20px; display: flex; gap: 14px; }
.c4-slope .tx b { font-size: 26px; font-variant-numeric: tabular-nums; }
`;

const WALL = 3, DEPTH = 6, EAVE = 0.45;
const ROWS = 6, COLS = 5;

function fmt(n) { return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, ''); }

export default defineLevel({
  id: 'ch4-l5',
  title: '屋顶的坡',
  concept: '坡度·走几步升几步',
  brief: '盖屋顶。坡太平，雨水流不走会漏；坡太陡，瓦会滑下来。',
  discovery: '坡度就是「走几步升几步」。屋子变宽，同样的坡，屋脊就得更高。',

  async setup(ctx) {
    const { props, fx } = ctx;
    injectStyles(ctx, CSS);
    props.ground({ w: 20, d: 12, seed: 85, river: null, trees: 9, cells: false });
    ctx.view.shadow({ x: 0, z: 0 }, 13);
    props.villager({ x: 7.6, z: 4.4, color: '#6F8FAF', face: -0.6 });
    props.tree({ x: -9.6, z: -2, s: 1.2, kind: 'pine' });

    // ================= 房子 =================
    const house = ctx.add(new THREE.Group());
    const S = { W: 8, h: 1 };
    const walls = new THREE.Mesh(new THREE.BoxGeometry(1, WALL, DEPTH), mat('#E6D3A8'));
    walls.castShadow = walls.receiveShadow = true;
    house.add(walls);
    const door = new THREE.Mesh(new THREE.BoxGeometry(1, 1.9, 0.12), mat('#8B6B43'));
    door.position.set(0, 0.95, DEPTH / 2 + 0.03);
    house.add(door);
    const win = [-1, 1].map((sx) => { const w = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.9, 0.1), mat('#7DB6DE')); w.position.set(sx * 2.4, 1.7, DEPTH / 2 + 0.03); house.add(w); return w; });
    const gableMat = mat('#E6D3A8');
    const gables = [DEPTH / 2 - 0.12, -DEPTH / 2 - 0.08].map((z) => { const g = new THREE.Mesh(new THREE.BufferGeometry(), gableMat); g.position.set(0, WALL, z); g.castShadow = true; house.add(g); return g; });
    const mkSlope = (flip) => {
      const f = new THREE.Group();
      if (flip) f.rotation.y = Math.PI;
      const g = new THREE.Group();
      f.add(g);
      const board = new THREE.Mesh(new THREE.BoxGeometry(1, 0.22, DEPTH + 0.8), mat('#8A5A3A'));
      board.castShadow = board.receiveShadow = true;
      g.add(board);
      const tiles = [];
      for (let i = 0; i < ROWS; i++) for (let j = 0; j < COLS; j++) {
        const t = new THREE.Mesh(shared(new THREE.BoxGeometry(1, 1, 1)), mat((i + j) % 2 ? '#C8553D' : '#BB4A33'));
        t.castShadow = true;
        t.userData = { i, j };
        g.add(t);
        tiles.push(t);
      }
      const pool = new THREE.Mesh(shared(new THREE.BoxGeometry(1, 1, 1)), mat('#5BA4CF', { opacity: 0.7 }));
      pool.visible = false;
      g.add(pool);
      house.add(f);
      return { f, g, board, tiles, pool };
    };
    const slopes = [mkSlope(false), mkSlope(true)];
    const ridgeCap = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, DEPTH + 0.9), mat('#8B3A24'));
    ridgeCap.castShadow = true;
    house.add(ridgeCap);
    const stain = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 0.06), mat('#5E7F96', { opacity: 0.55 }));
    stain.visible = false;
    house.add(stain);
    const geom = { run: 4, len: 4, alpha: 0, slope: 0.25 };

    const layout = () => {
      const run = S.W / 2, h = S.h;
      const slope = h / run;
      const alpha = Math.atan(slope);
      const len = Math.hypot(run + EAVE, h + EAVE * slope);
      Object.assign(geom, { run, len, alpha, slope });
      walls.geometry.dispose();
      walls.geometry = new THREE.BoxGeometry(S.W, WALL, DEPTH);
      walls.position.y = WALL / 2;
      win.forEach((w, i) => { w.position.x = (i ? 1 : -1) * Math.min(2.4, S.W * 0.3); });
      const shape = new THREE.Shape([new THREE.Vector2(-run, 0), new THREE.Vector2(run, 0), new THREE.Vector2(0, h)]);
      gables.forEach((g) => { g.geometry.dispose(); g.geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.2, bevelEnabled: false }); });
      ridgeCap.position.set(0, WALL + h + 0.05, 0);
      for (const s of slopes) {
        s.g.position.set(0, WALL + h, 0);
        s.g.rotation.z = -alpha;
        s.board.geometry.dispose();
        s.board.geometry = new THREE.BoxGeometry(len, 0.22, DEPTH + 0.8);
        s.board.position.set(len / 2, -0.11, 0);
        const du = len / ROWS, dz = (DEPTH + 0.6) / COLS;
        for (const t of s.tiles) {
          if (t.userData.gone) continue;
          const { i, j } = t.userData;
          t.position.set(du * (i + 0.5), 0.06, -((DEPTH + 0.6) / 2) + dz * (j + 0.5));
          t.scale.set(du * 0.96, 0.14, dz * 0.94);
        }
      }
      stain.position.set(0, WALL - 0.1, DEPTH / 2 + 0.06);
    };
    layout();
    const surf = (x) => WALL + S.h - geom.slope * Math.min(Math.abs(x), geom.run + EAVE) + 0.14;

    // ================= 屋脊上的金色握把 =================
    const knob = new THREE.Group();
    const ball = new THREE.Mesh(shared(new THREE.SphereGeometry(0.42, 14, 10)), mat(C.gold, { emissive: '#7A4A06' }));
    ball.castShadow = true;
    knob.add(ball);
    const arrowGeo = shared(new THREE.ConeGeometry(0.2, 0.36, 4));
    const aUp = new THREE.Mesh(arrowGeo, mat('#7A4A06')); aUp.position.y = 0.75;
    const aDn = new THREE.Mesh(arrowGeo, mat('#7A4A06')); aDn.position.y = -0.75; aDn.rotation.x = Math.PI;
    knob.add(aUp, aDn);
    ctx.add(knob);
    const KZ = DEPTH / 2 + 0.55;
    const syncKnob = () => knob.position.set(0, WALL + S.h + 0.7, KZ);
    syncKnob();
    ctx.onUpdate((dt, t) => { ball.scale.setScalar(1 + Math.sin(t * 4) * 0.05); });
    const grab = props.hitBox(2.2, 2.6, 1.6, ctx.scene);
    const syncGrab = () => grab.position.set(0, WALL + S.h + 0.7, KZ);
    syncGrab();

    // ================= 小台阶图 =================
    const card = document.createElement('div');
    card.className = 'c4-card c4-slope';
    mountDom(ctx, card);
    const showSlope = () => {
      const run = S.W / 2;
      const r = risePer2(S.h, run);
      const ok = roofKind(S.h, run) === 'ok';
      const px = 36;
      const ry = Math.min(2.6, r) * px;
      card.classList.toggle('ok', ok);
      card.innerHTML = `<svg viewBox="0 0 180 118"><path d="M16 104 H${16 + 2 * px} V${104 - ry} Z" fill="${ok ? '#cfeab4' : '#efe2c0'}" stroke="#8B6B43" stroke-width="3" stroke-linejoin="round"/>
        <path d="M16 104 H${16 + 2 * px}" stroke="#7BC96A" stroke-width="5"/><path d="M${16 + 2 * px} 104 V${104 - ry}" stroke="#F2B134" stroke-width="5"/></svg>
        <div class="tx"><span>走 <b>2</b> 步</span><span>升 <b>${fmt(Math.round(r * 10) / 10)}</b> 步</span></div>`;
    };
    showSlope();

    // ================= 拖屋脊 =================
    const canvas = document.getElementById('gl');
    const last = { x: 0, y: 0, t: 0 };
    const trk = (e) => { last.x = e.clientX; last.y = e.clientY; last.t = performance.now(); };
    canvas.addEventListener('pointermove', trk);
    canvas.addEventListener('pointerdown', trk);
    ctx.onDispose(() => { canvas.removeEventListener('pointermove', trk); canvas.removeEventListener('pointerdown', trk); });
    const ray = new THREE.Raycaster();
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -KZ);
    const rayHeight = () => {
      const r = canvas.getBoundingClientRect();
      ray.setFromCamera(new THREE.Vector2(((last.x - r.left) / r.width) * 2 - 1, -((last.y - r.top) / r.height) * 2 + 1), ctx.camera);
      const out = new THREE.Vector3();
      return ray.ray.intersectPlane(plane, out) ? out.y : null;
    };
    let raining = false;
    let g0 = null;
    const setH = (h, sound = true) => {
      const nh = Math.max(0.5, Math.min(6.5, Math.round(h * 2) / 2));
      if (nh === S.h) return;
      S.h = nh;
      if (sound) ctx.audio.play('tick');
      layout(); syncKnob(); syncGrab(); showSlope();
      onH?.();
    };
    let onH = null;
    const hd = ctx.pointer.draggable(grab, {
      ringSize: 0, silent: true, lift: 0, radius: 70,
      onStart: (p) => {
        g0 = { h: S.h, p: p.clone(), ry: performance.now() - last.t < 300 ? rayHeight() : null };
        ctx.audio.play('pick');
      },
      onMove: (p) => {
        if (raining || !g0) return;
        const live = performance.now() - last.t < 150;
        if (live && g0.ry !== null) {
          const y = rayHeight();
          if (y !== null) setH(g0.h + (y - g0.ry));
        } else {
          // 假手（演示）：沿镜头前后方向的移动换算成高度
          const fwd = ctx.camera.getWorldDirection(new THREE.Vector3()); fwd.y = 0; fwd.normalize();
          const pitch = Math.asin(-ctx.camera.getWorldDirection(new THREE.Vector3()).y);
          setH(g0.h + ((p.x - g0.p.x) * fwd.x + (p.z - g0.p.z) * fwd.z) * Math.tan(pitch));
        }
      },
      onEnd: () => { ctx.audio.play('drop'); },
    });
    // 假手：把屋脊拖到某个高度
    const dragTo = async (h) => {
      const fwd = ctx.camera.getWorldDirection(new THREE.Vector3()); fwd.y = 0; fwd.normalize();
      const pitch = Math.asin(-ctx.camera.getWorldDirection(new THREE.Vector3()).y);
      const d = ((h - S.h) / Math.tan(pitch));
      const a = knob.position;
      await ctx.pointer.simulateDrag(hd, v3(a.x + fwd.x * d, 0, a.z + fwd.z * d), { duration: 900 });
    };

    // ================= 下雨 =================
    const dropGeo = shared(new THREE.BoxGeometry(0.06, 0.34, 0.06));
    const dropMat = shared(new THREE.MeshBasicMaterial({ color: '#7DB6DE', transparent: true, opacity: 0.85 }));
    const drops = [];
    const tilesFly = [];
    let kind = 'ok';
    let rainT = 0;
    let poolV = 0;
    const spawn = () => {
      const m = new THREE.Mesh(dropGeo, dropMat);
      const x = (Math.random() - 0.5) * (S.W + 2.4), z = (Math.random() - 0.5) * (DEPTH + 1);
      m.position.set(x, WALL + S.h + 5.5 + Math.random() * 2, z);
      ctx.scene.add(m);
      drops.push({ m, st: 'fall', vx: 0, vy: -11, off: false });
    };
    const killDrop = (d) => { d.m.removeFromParent(); const k = drops.indexOf(d); if (k >= 0) drops.splice(k, 1); };
    const rainStep = (dt) => {
      if (!raining) return;
      rainT += dt;
      if (rainT < 4.4) for (let n = 0; n < Math.ceil(dt * 80); n++) spawn();
      for (const d of [...drops]) {
        const m = d.m;
        if (d.st === 'fall') {
          m.position.y += d.vy * dt;
          const ax = m.position.x;
          if (!d.off && Math.abs(ax) <= geom.run + EAVE && m.position.y <= surf(ax)) {
            if (kind === 'flat') { poolV = Math.min(1, poolV + 0.0042); killDrop(d); continue; }
            d.st = 'run';
            d.vx = Math.sign(ax || 1) * (kind === 'steep' ? 5.2 : 2.6);
            m.scale.set(1.2, 0.35, 1.2);
            m.rotation.z = -Math.sign(ax || 1) * geom.alpha;
          } else if (m.position.y <= 0.15) { killDrop(d); }
        } else if (d.st === 'run') {
          m.position.x += d.vx * dt * Math.cos(geom.alpha);
          m.position.y = surf(m.position.x) + 0.04;
          if (Math.abs(m.position.x) > geom.run + EAVE) { d.st = 'fall'; d.off = true; d.vy = -3; m.scale.set(1, 1, 1); m.rotation.z = 0; }
        }
      }
      // 太平：水积起来、渗进屋里
      if (kind === 'flat') {
        for (const s of slopes) {
          s.pool.visible = poolV > 0.02;
          s.pool.position.set(geom.len * 0.5, 0.14 + poolV * 0.14, 0);
          s.pool.scale.set(geom.len * 0.66, 0.06 + poolV * 0.26, DEPTH * 0.8);
        }
        stain.visible = poolV > 0.35;
        const sv = Math.max(0, (poolV - 0.35) / 0.65);
        stain.scale.set(S.W * 0.5, 0.2 + sv * 1.9, 1);
        stain.position.set(0, WALL - 0.1 - (0.2 + sv * 1.9) / 2 + 0.1, DEPTH / 2 + 0.07);
      }
      // 太陡：瓦片一片片滑下去
      if (kind === 'steep') {
        for (const f of tilesFly) {
          if (f.delay > 0) { f.delay -= dt; continue; }
          const t = f.t;
          if (f.st === 'slide') {
            f.v += 6.5 * dt;
            t.position.x += f.v * dt;
            t.rotation.z += dt * 0.12;
            if (t.position.x > geom.len) {
              f.st = 'air';
              ctx.scene.attach(t);
              f.vy = 0;
              f.vh = new THREE.Vector3(Math.sign(t.position.x) * (2 + Math.random() * 2), 0, (Math.random() - 0.5) * 2);
              f.spin = new THREE.Vector3(Math.random() * 4, Math.random() * 4, Math.random() * 6);
            }
          } else if (f.st === 'air') {
            f.vy -= 14 * dt;
            t.position.x += f.vh.x * dt; t.position.z += f.vh.z * dt; t.position.y += f.vy * dt;
            t.rotation.x += f.spin.x * dt; t.rotation.z += f.spin.z * dt;
            if (t.position.y <= 0.1) { t.position.y = 0.1; f.st = 'rest'; ctx.audio.play('tick'); }
          }
        }
      }
    };
    ctx.onUpdate(rainStep);

    const slideTiles = () => {
      tilesFly.length = 0;
      slopes.forEach((s, si) => {
        for (const t of s.tiles) {
          if (t.userData.j % 2 === 0 && t.userData.i > 1) continue; // 不是每片都滑，剩下的挂着
          t.userData.gone = true;
          tilesFly.push({ t, slope: s, st: 'slide', v: 0, delay: Math.random() * 1.6 + (ROWS - t.userData.i) * 0.12, vy: 0 });
        }
      });
    };
    const resetAll = async () => {
      for (const d of [...drops]) killDrop(d);
      for (const f of tilesFly) { f.slope.g.add(f.t); f.t.rotation.set(0, 0, 0); f.t.userData.gone = false; }
      tilesFly.length = 0;
      slopes.forEach((s) => { s.pool.visible = false; });
      stain.visible = false;
      poolV = 0;
      layout();
    };
    const stopRain = () => { raining = false; for (const d of [...drops]) killDrop(d); };
    const rain = async () => {
      if (raining) return 'busy';
      kind = roofKind(S.h, geom.run);
      raining = true; rainT = 0; poolV = 0;
      rainBtn.enable(false);
      ctx.hint(null);
      hd.enabled = false;
      ctx.audio.play('whoosh');
      if (kind === 'steep') slideTiles();
      await ctx.wait(kind === 'ok' ? 3600 : 4400);
      return kind;
    };
    const endRain = async (k) => {
      if (k === 'ok') return;
      if (k === 'flat') ctx.nudge('坡太平，水积着，渗进屋里了。把屋脊拖高些。');
      else ctx.nudge('坡太陡，瓦片滑下来了。把屋脊放低些。');
      await ctx.wait(1600);
      stopRain();
      await resetAll();
      hd.enabled = true;
      rainBtn.enable(true);
      ctx.hint(roundHint);
    };
    let rainBtn = null;
    let roundHint = null;

    // ================= 流程 =================
    const startCam = async (first) => {
      const r = S.W / 2 + 4.6;
      if (first) await sweepIn(ctx, { x: 0, z: 0.4 }, r, { yaw0: -34, yaw1: -2, pitch: 22, y: 2.2, ms: 2400 });
      else ctx.view.frame({ x: 0, z: 0.4 }, r, { yaw: -2, pitch: 22, y: 2.4 });
    };
    await startCam(true);

    const runRound = async (round) => {
      const width = round === 0 ? 8 : 12;
      const target = goodRidge(width);
      if (round === 1) {
        // 加宽屋子
        ctx.hud.task('房子加宽到 12 步。同样的坡，屋脊要多高？');
        const w0 = S.W;
        await go(fx.tween({ duration: 900, ease: 'inOut', onUpdate: (k) => { S.W = w0 + (width - w0) * k; layout(); syncKnob(); syncGrab(); showSlope(); } }));
        S.h = 2; layout(); syncKnob(); syncGrab(); showSlope();
        startCam(false);
        await ctx.wait(500);
        const g = await ctx.guess({ kind: 'height', actual: target, prompt: '先猜：屋脊要几步高？', min: 1, max: 8, step: 0.5, start: 4, unit: '步' });
        ctx.state.g = g;
      } else {
        S.h = 1; layout(); syncKnob(); syncGrab(); showSlope();
      }
      ctx.hud.progress(round, 2);
      ctx.hud.task(round === 0 ? '往上或往下拖屋脊的金球，再点「下雨」试试。' : '拖屋脊，再点「下雨」。');
      let resolveOk = null;
      onH = null;
      rainBtn = ctx.hud.tool({
        icon: 'waves', label: '下雨', primary: true,
        onTap: async () => {
          const k = await rain();
          if (k === 'busy') return;
          if (k === 'ok') {
            ctx.nudge('雨水顺顺流下去了。', { kind: 'good' });
            await ctx.wait(1500);
            stopRain();
            resolveOk?.();
          } else await endRain(k);
        },
      });
      roundHint = {
        text: round === 0 ? '太平会漏，太陡会滑。屋脊拖到中间，每走 2 步升 1 步左右。' : `同样的坡，屋子宽了，屋脊要更高。`,
        ghost: () => ctx.fx.ghostHand(knob.position.clone().add(v3(0, 0, 0.3)), knob.position.clone().add(v3(0, target - S.h, 0.3))),
        demo: async () => {
          if (raining) return;
          if (roofKind(S.h, geom.run) !== 'ok') await dragTo(target);
          await ctx.wait(300);
          rainBtn.tap();
          await ctx.wait(500);
        },
      };
      ctx.hint(roundHint);
      await ctx.waitFor((done) => { resolveOk = done; });
      ctx.hint(null);
      rainBtn.remove();
      await ctx.wait(300);
      // 小结：走 2 步升 1 步
      const lbl = ctx.labels.add(v3(0, WALL + S.h + 2.2, 0), `走 2 步，升 ${fmt(Math.round(risePer2(S.h, geom.run) * 10) / 10)} 步`, { cls: 'big' });
      ctx.fx.celebrate({ x: 0, z: 0 }, { count: 40 });
      await ctx.wait(1800);
      lbl.remove();
      return S.h;
    };
    await runRound(0);
    const hFinal = await runRound(1);
    const ga = ctx.state.g;
    const err = Math.abs(ga - goodRidge(12));
    void hFinal;
    ctx.complete({ stars: err <= 0.5 ? 3 : err <= 1.5 ? 2 : 1 });
  },
});
