// 4-2 照影子盖塔 · 三视图
// 屏幕左边三张目标影子（前 / 右 / 上）和三张实时影子，对上的变绿。三轮：L 形台阶、中间高四周低、有多种搭法的（再挑战最少块数）。
import { defineLevel } from '../../engine/level.js';
import { icon } from '../../engine/icons.js';
import { makeColumns, modeTools, bindTaps, sweepIn, injectStyles, mountDom, BASE_CSS, v3 } from './kit.js';
import { projections, matchViews, allMatch, totalBlocks, solveProjection, TOWERS } from './math.js';

const CSS = `${BASE_CSS}
.c4-views { left: 14px; top: 84px; width: 252px; padding: 10px 12px 12px; display: flex; flex-direction: column; gap: 8px; }
.c4-vh { display: grid; grid-template-columns: 40px 1fr 1fr; gap: 8px; font-size: 17px; color: var(--ink-2, #7a6650); text-align: center; }
.c4-vrow { display: grid; grid-template-columns: 40px 1fr 1fr; gap: 8px; align-items: center; padding: 6px 0; border-radius: 12px;
  border: 2px solid transparent; transition: border-color .25s, background-color .25s; position: relative; }
.c4-vrow.ok { border-color: #7BC96A; background: #eaf6dc; }
.c4-vrow .nm { width: 36px; height: 36px; border-radius: 18px; background: var(--paper-2, #f6ecd6); border: 1.5px solid var(--line, rgba(74,58,40,.16));
  display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 600; margin-left: 2px; }
.c4-vrow.ok .nm { background: #7BC96A; color: #fff; border-color: #5f9a3a; }
.c4-vrow.ok .nm .ico { width: 22px; height: 22px; }
.c4-g { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2px; width: 72px; height: 72px; padding: 3px; margin: 0 auto;
  background: #fffdf6; border: 1.5px solid var(--line, rgba(74,58,40,.2)); border-radius: 8px; }
.c4-g i { border-radius: 3px; background: rgba(74, 58, 40, 0.07); transition: background-color .2s; }
.c4-g.t i.on { background: #6B5A45; }
.c4-g.n i.on { background: #D1A862; }
.c4-vrow.ok .c4-g i.on { background: #6FBF5C; }
`;

const NAMES = [['front', '前'], ['side', '右'], ['top', '上']];

function makeViews(ctx) {
  injectStyles(ctx, CSS);
  const el = document.createElement('div');
  el.className = 'c4-card c4-views';
  el.innerHTML = '<div class="c4-vh"><span></span><span>要的</span><span>现在</span></div>';
  const rows = {};
  for (const [k, nm] of NAMES) {
    const row = document.createElement('div');
    row.className = 'c4-vrow';
    const chip = document.createElement('div');
    chip.className = 'nm';
    chip.textContent = nm;
    const mk = (cls) => {
      const g = document.createElement('div');
      g.className = `c4-g ${cls}`;
      for (let i = 0; i < 9; i++) g.appendChild(document.createElement('i'));
      return g;
    };
    const t = mk('t'), n = mk('n');
    row.append(chip, t, n);
    el.appendChild(row);
    rows[k] = { row, chip, t, n };
  }
  mountDom(ctx, el);
  // 把一张影子画进 3×3：front / side 是「一列一列的高度」，top 是 3×3 的有无
  const cellsOf = (k, p) => {
    const out = [];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
      out.push(k === 'top' ? !!p.top[r][c] : p[k][c] >= 3 - r);
    }
    return out;
  };
  const paint = (g, on) => [...g.children].forEach((i, n) => i.classList.toggle('on', on[n]));
  return {
    el,
    setTarget(t) { for (const [k] of NAMES) paint(rows[k].t, cellsOf(k, t)); },
    setNow(p, m) {
      for (const [k] of NAMES) {
        paint(rows[k].n, cellsOf(k, p));
        const was = rows[k].row.classList.contains('ok');
        rows[k].row.classList.toggle('ok', m[k]);
        if (m[k] !== was) rows[k].chip.replaceChildren(m[k] ? icon('check', { size: 22, stroke: 3 }) : document.createTextNode(NAMES.find((n) => n[0] === k)[1]));
      }
    },
  };
}

export default defineLevel({
  id: 'ch4-l2',
  title: '照影子盖塔',
  concept: '三视图',
  brief: '老匠师只留下三张影子图：前面看、右面看、上面看。照着把塔搭出来。',
  discovery: '一个东西，从三面看是三个样子。光看一面，会被骗。',

  async setup(ctx) {
    const { props } = ctx;
    props.ground({ w: 14, d: 10, seed: 52, river: null, trees: 8, cells: false });
    ctx.view.shadow({ x: 0, z: 0 }, 10);
    props.villager({ x: 5.2, z: 2.8, color: '#6F8FAF', face: -0.4 });
    props.rock({ x: -4.8, z: 3.4, s: 0.7 });
    const views = makeViews(ctx);
    const YAW = 30;
    const right = [Math.cos((YAW * Math.PI) / 180), -Math.sin((YAW * Math.PI) / 180)];
    const center = { x: -right[0] * 2.0, z: -right[1] * 2.0 };
    let stars = 2;

    for (let r = 0; r < TOWERS.length; r++) {
      ctx.hud.progress(r, TOWERS.length);
      const tgt = projections(TOWERS[r]);
      const sol = solveProjection(tgt);
      views.setTarget(tgt);
      const cols = makeColumns(ctx, { w: 3, d: 3, cap: 3, ox: -1.5, oz: -1.5 });
      const tFront = ctx.labels.add(v3(0, 0.1, 1.5 + 0.7), '前', { cls: 'tag', pop: false });
      const tSide = ctx.labels.add(v3(1.5 + 0.75, 0.1, 0), '右', { cls: 'tag', pop: false });
      if (r === 0) await sweepIn(ctx, center, 5.2, { yaw0: -25, yaw1: YAW, pitch: 38, ms: 2600 });
      else ctx.view.frame(center, 5.2, { yaw: YAW, pitch: 38 });
      ctx.hud.task(r === 0 ? '照着左边的影子图搭。让右边的图变绿。' : '换一座塔。再照影子图搭。');
      const tools = modeTools(ctx, (m) => cols.setMode(m));
      let matched = false;
      let resolveOk = null;
      let minNow = false;
      const refresh = () => {
        const p = projections(cols.heights);
        const m = matchViews(p, tgt);
        views.setNow(p, m);
        const ok = allMatch(m);
        if (ok && !matched) { matched = true; resolveOk?.(); }
        if (!ok) matched = false;
        minNow = ok && totalBlocks(cols.heights) === sol.min;
        ctx.state.minNow = minNow;
      };
      cols.onChange(refresh);
      refresh();
      const taps = bindTaps(ctx, {
        onTap: (ray) => { cols.tap(cols.pick(ray)); },
        onHover: (ray) => cols.hover(ray ? cols.pick(ray) : null),
      });

      // ---- 提示 ----
      const solGrid = sol.minGrid;
      const nextMissing = () => {
        for (let z = 2; z >= 0; z--) for (let x = 0; x < 3; x++) if (cols.heights[z][x] < solGrid[z][x]) return { x, z, y: cols.heights[z][x] };
        return null;
      };
      const syncToSol = async () => {
        cols.setMode('place');
        for (let z = 0; z < 3; z++) for (let x = 0; x < 3; x++) {
          while (cols.heights[z][x] > solGrid[z][x]) { cols.take(x, z); await ctx.wait(120); }
        }
        for (let z = 2; z >= 0; z--) for (let x = 0; x < 3; x++) {
          while (cols.heights[z][x] < solGrid[z][x]) { cols.put(x, z); await ctx.wait(140); }
        }
      };
      ctx.hint({
        text: '看看影子图：哪一面还没变绿？照着它添一块。',
        ghost: () => {
          const n = nextMissing();
          if (!n) return () => {};
          const p = v3(cols.cx(n.x), n.y + 0.7, cols.cz(n.z));
          return ctx.fx.ghostHand(p.clone().add(v3(1.4, 1.6, 1.4)), p);
        },
        demo: syncToSol,
      });
      await ctx.waitFor((done) => { resolveOk = done; if (matched) done(); });

      // ---- 对上了 ----
      ctx.hint(null);
      cols.hover(null);
      ctx.audio.play('good');
      ctx.fx.sparkle({ x: 0, z: 0 }, { color: '#9FE07A', size: 2.2 });
      const used = totalBlocks(cols.heights);
      if (sol.min < sol.max) {
        // 不止一种搭法：问还能不能更省
        ctx.nudge(`三张影子都对上了！用了 ${used} 块。`, { kind: 'good', speak: false });
        if (used > sol.min) {
          ctx.hud.task('还能少用几块吗？影子不变就行。');
          const stay = ctx.hud.tool({ icon: 'check', label: '就这样了', onTap: () => resolveStay?.() });
          let resolveStay = null;
          const cnt = ctx.labels.add(v3(0, 3.8, 0), String(used), { cls: 'num', pop: false });
          const upd = () => { cnt.set(totalBlocks(cols.heights)); stay.enable(matched); if (matched && minNow) resolveStay?.(); };
          cols.onChange(upd);
          upd();
          ctx.hint({
            text: '拿走用不着的块，三张影子还要都是绿的。',
            ghost: () => {
              for (let z = 0; z < 3; z++) for (let x = 0; x < 3; x++) if (cols.heights[z][x] > solGrid[z][x]) {
                const p = v3(cols.cx(x), cols.heights[z][x] - 0.2, cols.cz(z));
                return ctx.fx.ghostHand(p.clone().add(v3(1.4, 1.6, 1.4)), p);
              }
              return () => {};
            },
            demo: async () => { cols.setMode('remove'); await syncToSol(); cols.setMode('place'); },
          });
          await ctx.waitFor((done) => { resolveStay = done; upd(); });
          ctx.hint(null);
          cnt.remove();
          stay.remove();
          if (minNow) {
            stars = 3;
            ctx.nudge(`最少只要 ${sol.min} 块！`, { kind: 'good' });
          } else ctx.nudge(`最少其实只要 ${sol.min} 块，下次试试。`, { speak: true });
        }
      }
      await ctx.wait(1600);
      tools.remove();
      taps.off();
      if (r < TOWERS.length - 1) {
        tFront.remove(); tSide.remove();
        cols.destroy();
        await ctx.wait(200);
      }
    }
    ctx.complete({ stars });
  },
});
