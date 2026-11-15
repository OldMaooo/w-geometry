// 1-5 三角田 · 长方形的一半
// 给一块「一模一样的影子田」：可拖、点一下转半圈。转过来贴着三角田的一条边拼上：
//   拼成长方形 → 铺草垫数一数 → 一半；拼成斜田 → 用 1-4 的办法切一刀再拼。
// 第一轮直角三角形，第二轮一般三角形，第三轮先猜再验证。
import { defineLevel } from '../../engine/level.js';
import { cutAndShift } from './cutter.js';
import { layMats, countOut, C, toG, v3 } from './kit.js';

// 三角形顶点：底边在 z0 上从 x0 到 x0+base，顶点相对 (dx, h)
const ROUNDS = [
  { base: 6, h: 4, apex: 0 },   // 直角
  { base: 6, h: 4, apex: 2 },   // 锐角
  { base: 8, h: 3, apex: 5 },   // 先猜
];
const X0 = -4, Z0 = 2.5;

export default defineLevel({
  id: 'ch1-l5',
  title: '三角田',
  concept: '三角形是一半',
  brief: '兄弟俩分家，田斜着一分为二。哥哥的三角田有多大？',
  discovery: '任何三角田，都是「底 × 高」那块长方形的一半。',

  async setup(ctx) {
    const { props, geo, THREE } = ctx;
    props.ground({ w: 26, d: 15, seed: 55 });
    ctx.view.shadow({ x: 0, z: 0 }, 17);
    const bro = props.villager({ x: -9, z: 4.8, color: '#5E9C8A', face: 0.6 });
    const bro2 = props.villager({ x: -10.2, z: 4.2, color: '#C08A3E', face: 0.8, s: 0.85 });
    ctx.view.frame({ x: 1, z: 0.3 }, 9.5, { instant: true });
    let err3 = 99;

    for (let r = 0; r < ROUNDS.length; r++) {
      ctx.hud.progress(r, 3);
      const R = ROUNDS[r];
      const tri = [{ x: X0, z: Z0 }, { x: X0 + R.base, z: Z0 }, { x: X0 + R.apex, z: Z0 - R.h }];
      const tg = tri.map(toG);
      const area = (R.base * R.h) / 2;
      const triObj = props.polyField({ points: tri, color: C.tri });
      ctx.fx.pop(triObj, { duration: 350 });
      const tc = geo.centroid(tg);
      const tag = ctx.labels.add(v3(tc.x, 0.3, tc.y), '哥哥的', { cls: 'tag' });
      ctx.view.frame({ x: X0 + R.base / 2 + 3, z: Z0 - R.h / 2 + 0.4 }, Math.max(R.base, 7) / 2 + 3.4);

      if (r === 0) ctx.hud.task('拿一块一模一样的影子田，拼一拼。');
      if (r === 1) ctx.hud.task('换一块三角田，再拼一次。');
      if (r === 2) {
        ctx.hud.task('最后一块。先猜，再拼起来看看。');
        const g = await ctx.guess({ kind: 'area', actual: area, prompt: '先猜：这块三角田几块草垫大？', min: 1, max: 30, start: 8, unit: '块' });
        err3 = Math.abs(g - area);
      }

      // ---- 影子田：一个以重心为原点的组，转半圈就是绕重心转 ----
      const shadow = ctx.add(new THREE.Group());
      props.polyField({ points: tg.map((p) => ({ x: p.x - tc.x, z: p.y - tc.y })), color: C.shadow, opacity: 0.72, edge: '#6E9E4E', y: 0.02, parent: shadow });
      props.hitBox(2.4, 0.4, 2.4, shadow);
      const homeS = { x: X0 + R.base + 4.2, z: tc.y };
      shadow.position.set(homeS.x, 0, homeS.z);
      ctx.fx.pop(shadow);
      let turned = false;
      // 吸附点：三角形关于三条边中点的点对称
      const mids = [0, 1, 2].map((i) => ({ x: (tg[i].x + tg[(i + 1) % 3].x) / 2, y: (tg[i].y + tg[(i + 1) % 3].y) / 2 }));
      const spots = mids.map((m) => ({ x: 2 * m.x - tc.x, y: 2 * m.y - tc.y, m }));
      let atSpot = -1;

      let attachResolve;
      const attached = ctx.waitFor((d) => { attachResolve = d; });
      const turn = async () => {
        turned = !turned;
        ctx.audio.play('rotate');
        await ctx.fx.to(shadow.rotation, { y: turned ? Math.PI : 0 }, 320, { ease: 'back' });
      };
      const sh = ctx.pointer.draggable(shadow, {
        ringSize: 0,
        onTap: turn,
        snap: (p) => {
          atSpot = -1;
          if (!turned) return p;
          const n = geo.nearestPoint({ x: p.x, y: p.z }, spots, 1.3);
          if (n) { atSpot = n.index; p.x = spots[n.index].x; p.z = spots[n.index].y; }
          return p;
        },
        onEnd: async () => {
          if (atSpot >= 0) {
            const shadowPts = tg.map((p) => geo.rotate180(p, spots[atSpot].m));
            const pg = geo.asParallelogram([...tg, ...shadowPts]);
            if (pg && (pg.rect || pg.horizontal)) { ctx.audio.play('snap'); attachResolve(pg); return; }
            ctx.nudge('这样拼不好切。换一条边拼拼看。');
          } else if (Math.hypot(shadow.position.x - tc.x, shadow.position.z - tc.y) < 4.5 && !turned) {
            ctx.nudge('点一下影子田，让它转个身再拼。');
          }
          atSpot = -1;
          await ctx.fx.to(shadow.position, { x: homeS.x, z: homeS.z }, 380, { ease: 'out' });
        },
      });
      // 演示用：最「好用」的那条边（能直接成长方形就选它，否则选能切的）
      const bestSpot = (() => {
        let pick = 0, score = -1;
        spots.forEach((s, i) => {
          const pg = geo.asParallelogram([...tg, ...tg.map((p) => geo.rotate180(p, s.m))]);
          const sc = pg ? (pg.rect ? 2 : pg.horizontal ? 1 : 0) : -1;
          if (sc > score) { score = sc; pick = i; }
        });
        return pick;
      })();
      ctx.hint({
        text: turned ? '把影子田贴到三角田的一条边上。' : '先点一下影子田，让它转半圈，再贴到三角田的长边上。',
        ghost: () => ctx.fx.ghostHand(v3(shadow.position.x, 0.2, shadow.position.z), v3(spots[bestSpot].x, 0.2, spots[bestSpot].y)),
        demo: async () => {
          if (!turned) { ctx.pointer.simulateTap(sh); await ctx.wait(450); }
          await ctx.pointer.simulateDrag(sh, v3(spots[bestSpot].x, 0, spots[bestSpot].y), { duration: 1100 });
        },
      });
      const pg = await attached;
      ctx.hint(null);
      sh.dispose();
      tag.remove();

      // ---- 拼成了：长方形直接铺；斜田先切 ----
      let rect;
      let extra = [];
      const pgW = pg.poly.map((p) => ({ x: p.x, z: p.y }));
      if (pg.rect) {
        const b = geo.bbox(pg.poly);
        rect = { x: b.minX, z: b.minY, w: Math.round(b.w), d: Math.round(b.h) };
        ctx.nudge('拼成长方形了！', { kind: 'good' });
      } else {
        ctx.nudge('拼成一块斜田——上一关学过怎么对付它！', { kind: 'good' });
        await ctx.wait(1400);
        triObj.visible = false;
        shadow.visible = false;
        const res = await cutAndShift(ctx, pgW, { task: true });
        rect = res.rect;
        extra = res.pieces;
      }
      ctx.hud.task('铺上草垫，数一数。');
      triObj.visible = false;
      shadow.visible = false;
      const outline = props.polyField({ points: [{ x: rect.x, z: rect.z }, { x: rect.x + rect.w, z: rect.z }, { x: rect.x + rect.w, z: rect.z + rect.d }, { x: rect.x, z: rect.z + rect.d }], color: '#B98E57' });
      extra.forEach((o) => { o.visible = false; });
      const mats = await layMats(ctx, rect, { step: 40 });
      const cnt = await countOut(ctx, rect, { keep: true });
      await ctx.wait(300);
      // 一半：草垫收起，只留哥哥的三角田
      mats.forEach((m, i) => ctx.fx.to(m.scale, { x: 0.01, y: 0.01, z: 0.01 }, 260, { delay: i * 8 }));
      await ctx.wait(500);
      ctx.remove(outline);
      triObj.visible = true;
      ctx.fx.pop(triObj, { duration: 400 });
      cnt.big.set(`${cnt.total} 的一半：${area}<small>块</small>`);
      cnt.big.target = v3(tc.x, 0.6, tc.y);
      ctx.say(`${cnt.total} 的一半，${area} 块`);
      bro.cheer();
      bro2.cheer();
      ctx.state[`round${r + 1}`] = area;
      await ctx.wait(2200);
      // 清掉这一轮，准备下一轮
      mats.forEach((m) => ctx.remove(m));
      extra.forEach((o) => ctx.remove(o));
      ctx.remove(shadow);
      if (r < ROUNDS.length - 1) {
        cnt.big.remove();
        await ctx.fx.to(triObj.scale, { x: 0.01, y: 0.01, z: 0.01 }, 300);
        ctx.remove(triObj);
      } else {
        // 最后一块长出稻子
        const cells = [];
        for (let x = X0 + 0.5; x < X0 + R.base; x += 0.7) for (let z = Z0 - 0.4; z > Z0 - R.h; z -= 0.7) if (geo.pointInPolygon({ x, y: z }, tg)) cells.push({ x, z });
        const rice = props.crops({ cells, kind: 'rice', per: 1, seed: 4 });
        rice.mesh.position.y = 0.08;
        await rice.grow({ stagger: 25, onEach: (n) => { if (n % 3 === 0) ctx.audio.play('grow', { n }); } });
      }
    }

    ctx.hud.progress(3, 3);
    bro.cheer();
    await ctx.wait(600);
    ctx.complete({ stars: geo.starsByError(err3, 0, 2) });
  },
});
