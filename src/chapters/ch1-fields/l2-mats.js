// 1-2 铺草垫 · 面积是铺出来的
// 4×3：先猜，一块块拖草垫铺，铺满一行后出现「整行铺」。6×4：先猜，直接有「整行铺」。
// 7×5：只铺一行一列，然后点选「一共几块」，答完自动铺满验证。结算才说「7 个一行，5 行，35 块」。
import { defineLevel } from '../../engine/level.js';
import { layMats, countOut, v3 } from './kit.js';

const FIELDS = [
  { x: -11, z: -3, w: 4, d: 3, max: 30, start: 8 },
  { x: -5, z: -3.5, w: 6, d: 4, max: 40, start: 15 },
  { x: 3.5, z: -4, w: 7, d: 5 },
];

export default defineLevel({
  id: 'ch1-l2',
  title: '铺草垫',
  concept: '面积·铺方块',
  brief: '育秧要铺满草垫。看，一块草垫正好 1 步见方，田要铺几块？',

  async setup(ctx) {
    const { props, geo } = ctx;
    props.ground({ w: 25, d: 14, seed: 22 });
    ctx.view.shadow({ x: 0, z: 0 }, 16);
    const mu = props.villager({ x: -12, z: 3.6, color: '#6F8FAF', face: 0.4 });
    // 「1 块草垫」的样板：一块垫子 + 两根 1 步的绳（下边、右边），一眼看出它正好一步见方。整关留着当参照，放在田的上方空地，不挡操作。
    const M = { x: -8.6, z: -5.4 };
    ctx.fx.pop(props.mat({ x: M.x, z: M.z }));
    for (const [a, b] of [
      [{ x: M.x - 0.5, z: M.z + 0.95 }, { x: M.x + 0.5, z: M.z + 0.95 }],
      [{ x: M.x + 0.95, z: M.z - 0.5 }, { x: M.x + 0.95, z: M.z + 0.5 }],
    ]) { props.rope({ points: [a, b] }); }
    ctx.labels.add(v3(M.x - 1.8, 0.1, M.z + 0.4), '1<small>块草垫</small>', { cls: 'big' });
    ctx.labels.add(v3(M.x + 1.5, 0.1, M.z + 0.3), '1 步', { cls: 'tag' });
    // 开场先把镜头推近到样板上停一会儿，让他看清「一块草垫」多大，再拉回田里
    ctx.view.frame({ x: M.x + 0.6, z: M.z + 0.2 }, 2.5, { instant: true, pitch: 52 });
    await ctx.wait(2400);
    const accs = [];
    let lastLine = '';

    for (let f = 0; f < FIELDS.length; f++) {
      ctx.hud.progress(f, 3);
      const F = FIELDS[f];
      const total = F.w * F.d;
      const plot = props.plot({ x: F.x, z: F.z, w: F.w, d: F.d });
      ctx.fx.pop(plot.group, { duration: 380 });
      const cx = F.x + F.w / 2;
      ctx.view.frame({ x: cx, z: F.z + F.d / 2 + 1.2 }, Math.max(F.w, F.d) / 2 + 2.6);
      mu.face({ x: cx, z: F.z });

      const filled = new Map(); // "i,j" -> mesh
      const key = (i, j) => `${i},${j}`;
      const countLbl = ctx.labels.add(v3(F.x + F.w + 0.6, 0.4, F.z - 0.2), '0', { cls: 'num', pop: false });
      countLbl.show(false);
      const bump = () => { countLbl.set(filled.size).show(true); };

      // ---- 先猜 / 回答 ----
      if (f < 2) {
        if (f === 1) ctx.hud.task('这块大一些。先猜猜，要几块草垫？');
        const g = await ctx.guess({ kind: 'area', actual: total, prompt: '先猜：要几块草垫？', min: 1, max: F.max, start: F.start, unit: '块' });
        accs.push(geo.guessAccuracy(g, total));
      }

      // ---- 草垫堆（拖一块出来铺） ----
      const pilePos = { x: cx, z: F.z + F.d + 1.6 };
      const pile = ctx.add(new ctx.THREE.Group());
      pile.position.set(pilePos.x, 0, pilePos.z);
      for (let k = 0; k < 4; k++) {
        const m = props.mat({ x: (k % 2) * 0.06, z: (k % 3) * 0.04, parent: pile });
        m.position.y = 0.04 + k * 0.08;
        m.rotation.y = (k - 1.5) * 0.08;
      }
      props.hitBox(1.4, 0.6, 1.4, pile);

      const emptyCells = () => {
        const out = [];
        for (let j = 0; j < F.d; j++) for (let i = 0; i < F.w; i++) if (!filled.has(key(i, j))) out.push({ i, j });
        return out;
      };
      const cellPos = (c) => ({ x: F.x + c.i + 0.5, z: F.z + c.j + 0.5 });
      const rowDone = (j) => { for (let i = 0; i < F.w; i++) if (!filled.has(key(i, j))) return false; return true; };
      const isFull = () => filled.size === total;

      let rowBtn = null;
      let resolveFull = null;
      const full = ctx.waitFor((done) => { resolveFull = done; });
      const check = () => {
        bump();
        if (f === 0 && rowBtn && !rowBtn.visible && [...Array(F.d).keys()].some(rowDone)) {
          rowBtn.show().pulse(true);
          ctx.nudge('一行铺满了！试试「整行铺」。', { kind: 'good' });
        }
        if (isFull()) resolveFull();
      };

      // 拖一块草垫
      let dragMat = null;
      let target = null;
      const pileHandle = ctx.pointer.draggable(pile, {
        ringSize: 0.9,
        lift: 0,
        silent: true,
        onStart: () => {
          ctx.audio.play('pick');
          dragMat = props.mat({ x: pilePos.x, z: pilePos.z });
          dragMat.position.y = 0.6;
        },
        onMove: (p) => {
          if (!dragMat) return;
          const free = emptyCells();
          const near = geo.nearestPoint({ x: p.x, y: p.z }, free.map((c) => ({ x: F.x + c.i + 0.5, y: F.z + c.j + 0.5, c })), 0.85);
          const nt = near ? near.point.c : null;
          if (nt && (!target || nt.i !== target.i || nt.j !== target.j)) ctx.audio.play('tick');
          target = nt;
          if (target) { const q = cellPos(target); dragMat.position.set(q.x, 0.3, q.z); } else dragMat.position.set(p.x, 0.6, p.z);
        },
        onEnd: async () => {
          const m = dragMat;
          dragMat = null;
          if (!m) return;
          if (target && !filled.has(key(target.i, target.j))) {
            filled.set(key(target.i, target.j), m);
            m.position.y = 0.075;
            ctx.audio.play('place');
            ctx.fx.sparkle({ x: m.position.x, z: m.position.z }, { size: 0.8 });
            target = null;
            check();
          } else {
            target = null;
            ctx.audio.play('whoosh');
            await ctx.fx.to(m.position, { x: pilePos.x, y: 0.4, z: pilePos.z }, 260);
            ctx.remove(m);
          }
        },
      });

      // 整行铺：铺下一行没满的
      const fillRow = async () => {
        let j = 0;
        while (j < F.d && rowDone(j)) j++;
        if (j >= F.d) return;
        rowBtn?.enable(false);
        const mats = await layMats(ctx, { x: F.x, z: F.z + j, w: F.w, d: 1 }, {
          skip: (i) => filled.has(key(i, j)), from: pilePos, step: 90,
          onEach: () => {},
        });
        let k = 0;
        for (let i = 0; i < F.w; i++) if (!filled.has(key(i, j))) filled.set(key(i, j), mats[k++]);
        rowBtn?.enable(true);
        check();
      };

      if (f < 2) {
        ctx.hud.task(f === 0 ? '从草垫堆里拖一块，铺到田里。' : '铺满它。可以一块块铺，也可以整行铺。');
        rowBtn = ctx.hud.tool({ icon: 'row', label: '整行铺', onTap: fillRow, hidden: f === 0 });
        ctx.hint({
          text: f === 0 ? '按住田下面的草垫堆，拖一块到田里的空格上。' : '点「整行铺」，一行一行铺下去。',
          ghost: () => {
            const c = emptyCells()[0];
            const q = c ? cellPos(c) : pilePos;
            return ctx.fx.ghostHand(v3(pilePos.x, 0.3, pilePos.z), v3(q.x, 0.2, q.z));
          },
          demo: async () => {
            // 演示：先拖一块，然后整行铺到满
            if (f === 0 && !rowBtn.visible) {
              while (!rowBtn.visible && !isFull()) {
                const c = emptyCells()[0];
                await ctx.pointer.simulateDrag(pileHandle, v3(cellPos(c).x, 0, cellPos(c).z), { duration: 500 });
              }
            }
            while (!isFull()) await fillRow();
          },
        });
        await full;
      } else {
        // 第三块：只铺一行一列
        pileHandle.enabled = false;
        pile.visible = false;
        ctx.hud.task('这块最大。只铺一行、一列，就能知道一共几块。');
        let rowOk = false, colOk = false;
        let resolveRC;
        const rc = ctx.waitFor((d) => { resolveRC = d; });
        const after = () => { if (rowOk && colOk) resolveRC(); };
        const bRow = ctx.hud.tool({ icon: 'row', label: '铺一行', onTap: async () => {
          if (rowOk) return; rowOk = true; bRow.enable(false);
          const mats = await layMats(ctx, { x: F.x, z: F.z, w: F.w, d: 1 }, { skip: (i) => filled.has(key(i, 0)), from: pilePos, step: 90 });
          let k = 0; for (let i = 0; i < F.w; i++) if (!filled.has(key(i, 0))) filled.set(key(i, 0), mats[k++]);
          bump(); after();
        } });
        const bCol = ctx.hud.tool({ icon: 'col', label: '铺一列', onTap: async () => {
          if (colOk) return; colOk = true; bCol.enable(false);
          const mats = await layMats(ctx, { x: F.x, z: F.z, w: 1, d: F.d }, { skip: (_i, j) => filled.has(key(0, j)), from: pilePos, step: 110 });
          let k = 0; for (let j = 0; j < F.d; j++) if (!filled.has(key(0, j))) filled.set(key(0, j), mats[k++]);
          bump(); after();
        } });
        ctx.hint({
          text: '点「铺一行」，再点「铺一列」。',
          ghost: () => ctx.fx.ghostHand(v3(F.x + 0.5, 0.2, F.z + 0.5), v3(F.x + F.w - 0.5, 0.2, F.z + 0.5), { loops: 2 }),
          demo: async () => { bRow.tap(); await ctx.wait(900); bCol.tap(); await ctx.wait(900); },
        });
        await rc;
        ctx.hint(null);
        await ctx.wait(500);
        // 数一行、一列
        const rcLabels = [];
        for (let i = 0; i < F.w; i++) { rcLabels.push(ctx.labels.add(v3(F.x + i + 0.5, 0.3, F.z - 0.35), i + 1, { cls: 'num lit' })); ctx.audio.play('count', { n: i }); await ctx.wait(140); }
        for (let j = 1; j < F.d; j++) { rcLabels.push(ctx.labels.add(v3(F.x - 0.55, 0.3, F.z + j + 0.8), j + 1, { cls: 'num ok' })); ctx.audio.play('count', { n: j + 2 }); await ctx.wait(160); }
        bRow.hide(); bCol.hide();
        const opts = [12, 28, 35, 40].map((v) => ({ label: String(v), value: v }));
        const ans = await ctx.choose({ prompt: '一共要几块草垫？', options: opts, answer: total });
        ctx.recordGuess('area', ans, total, '块');
        accs.push(geo.guessAccuracy(ans, total));
        // 自动铺满验证：噌噌噌
        const mats = await layMats(ctx, { x: F.x, z: F.z, w: F.w, d: F.d }, { skip: (i, j) => filled.has(key(i, j)), step: 45 });
        let k = 0;
        for (let j = 0; j < F.d; j++) for (let i = 0; i < F.w; i++) if (!filled.has(key(i, j))) filled.set(key(i, j), mats[k++]);
        bump();
        rcLabels.forEach((l) => l.remove());
      }

      // ---- 满了：数一数 ----
      ctx.hint(null);
      rowBtn?.remove();
      pileHandle.dispose();
      ctx.remove(pile);
      countLbl.remove();
      ctx.audio.play('good');
      const res = await countOut(ctx, { x: F.x, z: F.z, w: F.w, d: F.d }, { keep: true });
      lastLine = res.line;
      mu.cheer();
      res.big.set(`${total}<small>块</small>`);
      await ctx.wait(400);
    }

    // ---- 收尾：三块田里秧苗长出来 ----
    ctx.hud.progress(3, 3);
    ctx.view.frame({ x: 0, z: -0.5 }, 12.5);
    await ctx.wait(500);
    const cells = [];
    for (const F of FIELDS) for (let j = 0; j < F.d; j++) for (let i = 0; i < F.w; i++) cells.push({ x: F.x + i + 0.5, z: F.z + j + 0.5 });
    const crops = props.crops({ cells, kind: 'sprout', per: 1, seed: 5 });
    crops.mesh.position.y = 0.1;
    await crops.grow({ stagger: 14, onEach: (n) => { if (n % 4 === 0) ctx.audio.play('grow', { n }); } });
    mu.cheer();
    const stars = geo.mean(accs) >= 0.9 ? 3 : geo.mean(accs) >= 0.7 ? 2 : 1;
    ctx.state.accs = accs;
    ctx.complete({ stars, discovery: `${lastLine}。一行几块、有几行，就知道一共几块。` });
  },
});
