// 第 4 章的纯数学 / 逻辑（不依赖 three，可单测）：方块数、三视图、给定影子的最少块数、
// 展开图折叠、框架摆动、斜撑、屋顶坡度、金字塔层数。

// ---------------------------------------------------------------- 体积
/** 长 × 宽 × 高 = 方块数。 */
export const countBlocks = (w, d, h) => w * d * h;

// ---------------------------------------------------------------- 三视图
// 高度表 h[z][x]：z=0 在最远处（俯视图最上一行），x=0 在最左。方块只能一摞一摞往上叠。

/**
 * 从前面看（按 x 从左到右）、从右面看（从左到右依次是 近 → 远，即 z 从大到小）、从上面看（有没有方块）。
 * @param {number[][]} h
 */
export function projections(h) {
  const n = h.length, m = h[0].length;
  const front = Array.from({ length: m }, (_, x) => Math.max(...h.map((r) => r[x])));
  const side = Array.from({ length: n }, (_, k) => Math.max(...h[n - 1 - k]));
  const top = h.map((r) => r.map((v) => (v > 0 ? 1 : 0)));
  return { front, side, top };
}

const eq1 = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
const eq2 = (a, b) => a.length === b.length && a.every((r, i) => eq1(r, b[i]));

/** 三张影子各自对没对上。 */
export function matchViews(cur, target) {
  return {
    front: eq1(cur.front, target.front),
    side: eq1(cur.side, target.side),
    top: eq2(cur.top, target.top),
  };
}
export const allMatch = (m) => m.front && m.side && m.top;

/** 全部块数。 */
export const totalBlocks = (h) => h.reduce((s, r) => s + r.reduce((a, b) => a + b, 0), 0);

/**
 * 给定三张影子，找出所有搭法里最少和最多要几块（暴力枚举，3×3 很小）。
 * @param {{front:number[], side:number[], top:number[][]}} t
 * @returns {{ min: number, max: number, count: number, minGrid: number[][], maxGrid: number[][] } | null}
 */
export function solveProjection(t) {
  const n = t.top.length, m = t.top[0].length;
  const ub = (z, x) => (t.top[z][x] ? Math.min(t.front[x], t.side[n - 1 - z]) : 0);
  const lb = (z, x) => (t.top[z][x] ? 1 : 0);
  const cells = [];
  for (let z = 0; z < n; z++) for (let x = 0; x < m; x++) cells.push([z, x]);
  const grid = Array.from({ length: n }, () => Array(m).fill(0));
  let best = null;
  let count = 0;
  const rec = (i) => {
    if (i === cells.length) {
      const p = projections(grid);
      if (!eq1(p.front, t.front) || !eq1(p.side, t.side)) return;
      count++;
      const s = totalBlocks(grid);
      if (!best) best = { min: s, max: s, count: 0, minGrid: grid.map((r) => [...r]), maxGrid: grid.map((r) => [...r]) };
      if (s < best.min) { best.min = s; best.minGrid = grid.map((r) => [...r]); }
      if (s > best.max) { best.max = s; best.maxGrid = grid.map((r) => [...r]); }
      return;
    }
    const [z, x] = cells[i];
    for (let v = lb(z, x); v <= ub(z, x); v++) { grid[z][x] = v; rec(i + 1); }
    grid[z][x] = 0;
  };
  rec(0);
  if (best) best.count = count;
  return best;
}

/** 4-2 的三轮：每轮给一座「标准塔」，影子由它算出来。 */
export const TOWERS = [
  // 一个 L 形台阶
  [[0, 0, 0], [2, 0, 0], [3, 2, 1]],
  // 中间高四周低
  [[1, 1, 1], [1, 3, 1], [1, 1, 1]],
  // 影子对应不止一种搭法（最少 13 块，最多 17 块）
  [[3, 1, 1], [1, 1, 1], [1, 1, 3]],
];

// ---------------------------------------------------------------- 展开图折叠
// 一张展开图 = 若干相连的格子 [col, row]。选一个格子当箱底，其余顺着相邻关系一面面立起来，
// 看六个面是不是正好分别落在立方体的六个面上。

const I3 = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
const mulMV = (R, v) => R.map((r) => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]);
const mulMM = (A, B) => A.map((r) => [0, 1, 2].map((j) => r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j]));
const rotZ = (a) => [[Math.cos(a), -Math.sin(a), 0], [Math.sin(a), Math.cos(a), 0], [0, 0, 1]];
const rotX = (a) => [[1, 0, 0], [0, Math.cos(a), -Math.sin(a)], [0, Math.sin(a), Math.cos(a)]];

/** 从格子 a 走到相邻格 b 时的折叠信息：铰链位置（相对 a 的中心）、轴、转角（立起来 = 90°）。 */
export function hingeOf(a, b) {
  const dc = b[0] - a[0], dr = b[1] - a[1];
  if (dc !== 0) return { hinge: [dc / 2, 0, 0], axis: 'z', sign: dc > 0 ? 1 : -1, dc, dr };
  return { hinge: [0, 0, dr / 2], axis: 'x', sign: dr > 0 ? -1 : 1, dc, dr };
}

/** 选箱底：邻居最多的格子（并列取靠前的）。 */
export function pickBase(cells) {
  const has = (c, r) => cells.some((p) => p[0] === c && p[1] === r);
  let best = 0, bd = -1;
  cells.forEach(([c, r], i) => {
    const d = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([a, b]) => has(c + a, r + b)).length;
    if (d > bd) { bd = d; best = i; }
  });
  return best;
}

/**
 * 折叠展开图。
 * @param {[number, number][]} cells
 * @param {number} [base]
 * @returns {{ ok: boolean, base: number, tree: {idx:number, parent:number, hinge:any, depth:number}[],
 *   faces: {idx:number, dir:[number,number,number]}[], missing: [number,number,number][], overlaps: number }}
 */
export function foldNet(cells, base = pickBase(cells)) {
  const at = new Map(cells.map((p, i) => [`${p[0]},${p[1]}`, i]));
  const tree = [{ idx: base, parent: -1, hinge: null, depth: 0 }];
  const T = new Map([[base, { R: I3, t: [0, 0, 0] }]]);
  const seen = new Set([base]);
  for (let q = 0; q < tree.length; q++) {
    const cur = tree[q];
    const a = cells[cur.idx];
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const j = at.get(`${a[0] + dc},${a[1] + dr}`);
      if (j === undefined || seen.has(j)) continue;
      seen.add(j);
      const hg = hingeOf(a, cells[j]);
      // 铰链点（净图坐标）和绕它的旋转：H = T(p0) · R · T(-p0)
      const p0 = [a[0] + hg.hinge[0], 0, a[1] + hg.hinge[2]];
      const R = hg.axis === 'z' ? rotZ((hg.sign * Math.PI) / 2) : rotX((hg.sign * Math.PI) / 2);
      const Rp = mulMV(R, p0);
      const Hm = { R, t: [p0[0] - Rp[0], p0[1] - Rp[1], p0[2] - Rp[2]] };
      const P = T.get(cur.idx);
      const PH = { R: mulMM(P.R, Hm.R), t: mulMV(P.R, Hm.t).map((v, k) => v + P.t[k]) };
      T.set(j, PH);
      tree.push({ idx: j, parent: cur.idx, hinge: hg, depth: cur.depth + 1 });
    }
  }
  const bc = cells[base];
  const cubeC = [bc[0], 0.5, bc[1]];
  const faces = [];
  const keys = new Map();
  for (const { idx } of tree) {
    const c = cells[idx];
    const p = mulMV(T.get(idx).R, [c[0], 0, c[1]]).map((v, k) => v + T.get(idx).t[k]);
    const dir = [0, 1, 2].map((k) => Math.round((p[k] - cubeC[k]) * 2));
    faces.push({ idx, dir });
    const key = dir.join(',');
    keys.set(key, (keys.get(key) || 0) + 1);
  }
  const all = ['0,-1,0', '0,1,0', '1,0,0', '-1,0,0', '0,0,1', '0,0,-1'];
  const missing = all.filter((k) => !keys.has(k)).map((k) => /** @type {[number,number,number]} */ (k.split(',').map(Number)));
  let overlaps = 0;
  for (const v of keys.values()) if (v > 1) overlaps += v - 1;
  const ok = cells.length === 6 && tree.length === 6 && missing.length === 0 && overlaps === 0;
  return { ok, base, tree, faces, missing, overlaps };
}

export const isFoldable = (cells) => foldNet(cells).ok;

/** 用字符画写展开图：X 是有皮的格子。 */
export function netOf(rows) {
  const out = [];
  rows.forEach((row, r) => [...row].forEach((ch, c) => { if (ch === 'X') out.push(/** @type {[number, number]} */ ([c, r])); }));
  return out;
}

/** 4-4 的三轮，每轮三张（字符画，X 是有皮的格子）。 */
export const NET_ROUNDS = [
  // 十字形 / 六个排成一长条 / 一字加两翼（异侧）
  [['.X..', 'XXXX', '.X..'], ['XXXXXX'], ['X...', 'XXXX', '..X.']],
  // 阶梯 / 一字加两翼（同侧，两片会叠）/ 三三错开
  [['XX...', '.XX..', '..XX.'], ['X.X.', 'XXXX'], ['XXX..', '..XXX']],
  // 2×3 田字形（陷阱）/ 二三一 / 之字形
  [['XXX', 'XXX'], ['XX..', '.XXX', '.X..'], ['XXX.', '..XX', '...X']],
];

// ---------------------------------------------------------------- 框架（铰接木框）
/**
 * 四边都是 L 的方框：左下 A、右下 B 固定，拖左上角 D（绕 A 转，边长不变），右上角 C 跟着平移（菱形）。
 * 返回新的 D、C；角度限制在 [lo, hi]（度）。
 * @param {{x:number,z:number}} A @param {{x:number,z:number}} B @param {number} L @param {{x:number,z:number}} mouse
 */
export function swingFrame(A, B, L, mouse, lo = 22, hi = 158) {
  const bx = B.x - A.x, bz = B.z - A.z;
  const base = Math.atan2(bz, bx);
  // 以 AB 方向为 0°，D 在 AB 的「左侧」（z 更小一侧）转
  let ang = Math.atan2(mouse.z - A.z, mouse.x - A.x) - base; // 屏幕里 z 向下，D 在上侧 = 负角
  ang = -ang;
  let deg = (ang * 180) / Math.PI;
  while (deg > 180) deg -= 360;
  while (deg < -180) deg += 360;
  deg = Math.min(hi, Math.max(lo, deg));
  const a = (-deg * Math.PI) / 180 + base;
  const D = { x: A.x + L * Math.cos(a), z: A.z + L * Math.sin(a) };
  const C = { x: B.x + (D.x - A.x), z: B.z + (D.z - A.z) };
  return { D, C, deg };
}

/** 方框的四个角之间，有没有一根斜撑？有就是两个三角形，形状定死。 */
export const frameRigid = (hasBrace) => !!hasBrace;

// ---------------------------------------------------------------- 桥架
/** n 个方框的桥架，每个方框各自需要一根斜撑才不歪；返回没撑的格子序号。 */
export function unbraced(n, braces) {
  const out = [];
  for (let i = 0; i < n; i++) if (!braces[i]) out.push(i);
  return out;
}
/** 最少斜撑数：每个方框一根。 */
export const minBraces = (n) => n;
export const braceCount = (braces) => braces.filter(Boolean).length;

// ---------------------------------------------------------------- 屋顶
/** 一侧的坡度 = 升高 / 走进的步数。 */
export const slopeOf = (rise, run) => rise / run;
export const SLOPE_FLAT = 0.45;
export const SLOPE_STEEP = 0.68;
/** @returns {'flat'|'ok'|'steep'} */
export function roofKind(rise, run) {
  const s = slopeOf(rise, run);
  if (s < SLOPE_FLAT) return 'flat';
  if (s > SLOPE_STEEP) return 'steep';
  return 'ok';
}
/** 每往里走 2 步，升高多少。 */
export const risePer2 = (rise, run) => (2 * rise) / run;
/** 屋宽 span（两侧各一半），按「走 2 步升 1 步」的坡，屋脊的高度。 */
export const goodRidge = (span) => span / 4;

// ---------------------------------------------------------------- 金字塔
/** 第 k 层（从上往下 1…n）是 k×k。 */
export const layerSize = (k) => k;
export const pyramidTotal = (n) => { let s = 0; for (let k = 1; k <= n; k++) s += k * k; return s; };
/** 边长 n 的一层，各格中心坐标（以塔心为 0，整数或半整数）。 */
export const layerCoords = (n) => Array.from({ length: n }, (_, i) => i - (n - 1) / 2);
