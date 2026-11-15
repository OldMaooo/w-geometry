// 斜田变方田：石刀竖着切一刀 → 把切下的一块拖到另一头 → 拼成长方形。1-4 和 1-5 共用。
import { C, toG, v3 } from './kit.js';

/**
 * @param {any} ctx
 * @param {{x:number,z:number}[]} poly  平行四边形（有一对横边，即两条边和 x 轴平行），世界坐标
 * @param {{ color?: string, task?: boolean }} [opt]
 * @returns {Promise<{ rect: {x:number,z:number,w:number,d:number}, pieces: any[] }>}
 */
export async function cutAndShift(ctx, poly, opt = {}) {
  const { geo, props, THREE } = ctx;
  const color = opt.color || C.soilBed;
  const g = poly.map(toG);
  const bb = geo.bbox(g);
  // 两条横边：底边、顶边
  const hEdges = [];
  for (let i = 0; i < g.length; i++) {
    const a = g[i], b = g[(i + 1) % g.length];
    if (Math.abs(a.y - b.y) < 1e-6) hEdges.push([Math.min(a.x, b.x), Math.max(a.x, b.x)]);
  }
  const base = hEdges[0][1] - hEdges[0][0];
  const lo = Math.max(hEdges[0][0], hEdges[1][0]);
  const hi = Math.min(hEdges[0][1], hEdges[1][1]);
  const goodK = Math.ceil(lo - 1e-9) <= Math.floor(hi + 1e-9) ? Math.ceil(lo - 1e-9) : Math.round((lo + hi) / 2);
  const kMin = Math.ceil(bb.minX + 1 - 1e-9), kMax = Math.floor(bb.maxX - 1 + 1e-9);
  const zMid = (bb.minY + bb.maxY) / 2;

  for (;;) {
    // ---- 整块斜田 + 石刀 ----
    const field = props.polyField({ points: poly, color });
    const knife = ctx.add(new THREE.Group());
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.9, 0.7), new THREE.MeshLambertMaterial({ color: '#8C877D' }));
    blade.position.y = 0.95;
    blade.castShadow = true;
    const handleM = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.5, 0.26), new THREE.MeshLambertMaterial({ color: '#7A5233' }));
    handleM.position.y = 1.6;
    const line = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.02, bb.h + 1.2), new THREE.MeshBasicMaterial({ color: '#FFF4D0', transparent: true, opacity: 0.9 }));
    line.position.y = 0.12;
    knife.add(blade, handleM, line);
    props.hitBox(1, 1.8, 1.2, knife);
    let k = bb.minX - 1.2;
    knife.position.set(k, 0, zMid);
    const over = () => k >= kMin && k <= kMax;

    let cutResolve;
    const cutDone = ctx.waitFor((d) => { cutResolve = d; });
    const cutBtn = ctx.hud.tool({ icon: 'cut', label: '切一刀', primary: true, hidden: true, onTap: () => { if (over()) cutResolve(k); } });
    const kh = ctx.pointer.draggable(knife, {
      ringSize: 0.7,
      snap: (p) => {
        const x = Math.round(p.x);
        p.x = Math.min(kMax, Math.max(kMin, x));
        p.z = zMid;
        return p;
      },
      onEnd: () => { k = Math.round(knife.position.x); if (over()) cutBtn.show().pulse(true); },
    });
    if (opt.task !== false) ctx.hud.task('把石刀拖到田上，竖着切一刀。');
    ctx.hint({
      text: '把石刀放在斜边那个角的正上方，切下那个三角。',
      ghost: () => ctx.fx.ghostHand(v3(knife.position.x, 1.2, zMid), v3(goodK, 1.2, zMid)),
      demo: async () => { await ctx.pointer.simulateDrag(kh, v3(goodK, 0, zMid), { duration: 900 }); await ctx.wait(250); cutBtn.tap(); },
    });
    const kc = await cutDone;
    ctx.hint(null);
    cutBtn.remove();
    kh.dispose();
    ctx.audio.play('cut');
    await ctx.fx.to(knife.position, { y: -0.6 }, 160);
    ctx.remove(knife);
    ctx.remove(field);

    // ---- 两块 ----
    const parts = [geo.clipByX(g, kc, 'left'), geo.clipByX(g, kc, 'right')].filter((q) => q.length >= 3);
    if (parts.length < 2) { ctx.nudge('换个地方切试试。'); continue; }
    const pieces = parts.map((q, idx) => {
      const c = geo.centroid(q);
      const grp = ctx.add(new THREE.Group());
      grp.position.set(c.x, 0, c.y);
      props.polyField({ points: q.map((p) => ({ x: p.x - c.x, z: p.y - c.y })), color: idx ? color : C.piece, parent: grp });
      props.hitBox(Math.max(0.8, geo.bbox(q).w * 0.7), 0.4, Math.max(0.8, geo.bbox(q).h * 0.7), grp);
      return { grp, poly: q, home: { x: c.x, z: c.y }, idx };
    });
    // 轻轻分开
    await Promise.all(pieces.map((P) => ctx.fx.to(P.grp.position, { x: P.home.x + (P.idx ? 0.25 : -0.25) }, 260)));

    let doneResolve;
    const result = ctx.waitFor((d) => { doneResolve = d; });
    const handles = pieces.map((P) => {
      const other = pieces[1 - P.idx];
      const spots = [P.home, { x: P.home.x + base, z: P.home.z }, { x: P.home.x - base, z: P.home.z }];
      const h = ctx.pointer.draggable(P.grp, {
        ringSize: 0,
        priority: 1,
        snap: (p) => {
          const near = geo.nearestPoint({ x: p.x, y: p.z }, spots.map((s) => ({ x: s.x, y: s.z })), 1.3);
          if (near && near.index > 0) { p.x = spots[near.index].x; p.z = spots[near.index].z; }
          return p;
        },
        onEnd: async (p) => {
          const at = spots.findIndex((s, i) => i > 0 && Math.hypot(s.x - P.grp.position.x, s.z - P.grp.position.z) < 1e-3);
          if (at > 0) {
            const dx = spots[at].x - P.home.x;
            const moved = geo.translate(P.poly, dx, 0);
            if (geo.piecesFormAxisRect([moved, other.poly])) {
              ctx.audio.play('snap');
              ctx.fx.to(other.grp.position, { x: other.home.x, z: other.home.z }, 200);
              doneResolve({ moved, other: other.poly });
              return;
            }
            ctx.nudge('拼不成方的。换个地方切试试。');
            await ctx.fx.to(P.grp.position, { x: P.home.x + (P.idx ? 0.25 : -0.25), z: P.home.z }, 380, { ease: 'back' });
            doneResolve(null);
            return;
          }
          await ctx.fx.to(P.grp.position, { x: P.home.x + (P.idx ? 0.25 : -0.25), z: P.home.z }, 300);
        },
      });
      return h;
    });
    ctx.hud.task('把切下来的那块，拖到另一头拼上。');
    // 演示：拖小的那块
    const small = pieces[0].poly.length && geo.area(pieces[0].poly) <= geo.area(pieces[1].poly) ? 0 : 1;
    const sp = pieces[small];
    const dest = { x: sp.home.x + (small === 0 ? base : -base), z: sp.home.z };
    ctx.hint({
      text: '切下来的那块，搬到另一头，看能不能补上缺口。',
      ghost: () => ctx.fx.ghostHand(v3(sp.grp.position.x, 0.2, sp.grp.position.z), v3(dest.x, 0.2, dest.z)),
      demo: () => ctx.pointer.simulateDrag(handles[small], v3(dest.x, 0, dest.z), { duration: 1100 }),
    });
    const r = await result;
    ctx.hint(null);
    handles.forEach((h) => h.dispose());
    if (!r) {
      await ctx.wait(600);
      pieces.forEach((P) => ctx.remove(P.grp));
      continue;
    }
    const all = geo.bbox([...r.moved, ...r.other]);
    ctx.fx.sparkle({ x: all.minX + all.w / 2, z: all.minY + all.h / 2 }, { size: 2.5 });
    await ctx.wait(250);
    // 两块合成一整块方田（去掉中间那道接缝）
    pieces.forEach((P) => ctx.remove(P.grp));
    const rect = { x: all.minX, z: all.minY, w: Math.round(all.w), d: Math.round(all.h) };
    const whole = props.polyField({ points: [{ x: rect.x, z: rect.z }, { x: rect.x + rect.w, z: rect.z }, { x: rect.x + rect.w, z: rect.z + rect.d }, { x: rect.x, z: rect.z + rect.d }], color });
    return { rect, pieces: [whole] };
  }
}
