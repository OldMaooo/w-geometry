// 第 5 章的纯数学：容积、水位、席子围囤、无盖箱子的用板、阳马三块拼方的转法。没有 three 依赖，能单测。

/** 1 斗 = 一个直径 2 步的圆筒、高 1 步（π/4 立方步）。圆罐的 r、h 代进去：斗数 = 4·r²·h。 */
export const DOU = Math.PI / 4;
export const toDou = (v) => v / DOU;

export const cylVolume = (r, h) => Math.PI * r * r * h;
/** 尖朝下的锥：底面积 A、高 H。 */
export const coneVolume = (A, H) => (A * H) / 3;

/** 尖朝下的锥里，装了体积 V，水位（离尖的高度）是多少。不是直线：高度 ∝ 体积的立方根。 */
export function taperLevel(A, H, V) {
  if (V <= 0) return 0;
  return Math.min(H, Math.cbrt((3 * H * H * V) / A));
}
/** 反过来：水位 y（离尖）→ 体积。 */
export const taperVolume = (A, H, y) => (A * Math.min(y, H) ** 3) / (3 * H * H);

/** 直筒 / 方筒（上下一样粗）：体积 → 水位。 */
export const prismLevel = (A, V) => (A <= 0 ? 0 : V / A);

// ---------------- 5-5 席子围囤 ----------------
/** 周长 p 的长方形，一边 w 时的面积。 */
export const rectArea = (p, w) => w * (p / 2 - w);
/** 周长 p 的圆的面积。 */
export const circleArea = (p) => (p * p) / (4 * Math.PI);
/** 席子长 L、高 H 围成长方形（一边 w）/ 圆，能装多少斗（1 斗 = 1 立方步）。 */
export const siloRect = (L, H, w) => rectArea(L, w) * H;
export const siloCircle = (L, H) => circleArea(L) * H;

/** 周长 p、边数 n 的闭合折线上，弧长 s（0..p）处的点：长方形 w×(p/2-w)，从上边中点出发顺时针（z 向下）。 */
export function rectPointAt(p, w, s) {
  const d = p / 2 - w;
  const hw = w / 2, hd = d / 2;
  // 周期折线：上边中点 → 右上角 → 右下角 → 左下角 → 左上角 → 回上边中点
  const segs = [
    [{ x: 0, z: -hd }, { x: hw, z: -hd }],
    [{ x: hw, z: -hd }, { x: hw, z: hd }],
    [{ x: hw, z: hd }, { x: -hw, z: hd }],
    [{ x: -hw, z: hd }, { x: -hw, z: -hd }],
    [{ x: -hw, z: -hd }, { x: 0, z: -hd }],
  ];
  let t = ((s % p) + p) % p;
  for (const [a, b] of segs) {
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    if (t <= len + 1e-9) {
      const k = len ? t / len : 0;
      return { x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k };
    }
    t -= len;
  }
  return { x: 0, z: -hd };
}
/** 周长 p 的圆，弧长 s 处的点（同样从上方出发顺时针）。 */
export function circlePointAt(p, s) {
  const r = p / (2 * Math.PI);
  const a = (s / p) * 2 * Math.PI;
  return { x: r * Math.sin(a), z: -r * Math.cos(a) };
}

// ---------------- 5-6 无盖箱子 ----------------
export const boxVolume = (L, W, H) => L * W * H;
/** 无盖箱子要几块板：底 + 四面墙。 */
export const openBoxArea = (L, W, H) => L * W + 2 * L * H + 2 * W * H;
/** 容积正好是 V、边长 1..max 的所有箱子（长 ≤ 宽），按用板从少到多排。 */
export function boxesWithVolume(V, max = 8) {
  const out = [];
  for (let L = 1; L <= max; L++) for (let W = L; W <= max; W++) for (let H = 1; H <= max; H++) {
    if (L * W * H === V) out.push({ L, W, H, area: openBoxArea(L, W, H) });
  }
  return out.sort((a, b) => a.area - b.area);
}
export const bestBox = (V, max = 8) => boxesWithVolume(V, max)[0];

// ---------------- 5-4 阳马：三块拼一个方块 ----------------
// 方块以中心为原点、边长 1，三个轴 x y z。基准阳马：底在地面（y = -½），尖在 (½, ½, ½)，
// 也就是 x ≥ y 且 z ≥ y 的那一块。另外两块是它绕大对角线转 120°、240°。
export const I3 = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
/** 循环置换 (x,y,z) → (z,x,y)：绕 (1,1,1) 转 120°。 */
export const CYC = [[0, 0, 1], [1, 0, 0], [0, 1, 0]];
export const mmul = (A, B) => A.map((row) => [0, 1, 2].map((j) => row[0] * B[0][j] + row[1] * B[1][j] + row[2] * B[2][j]));
export const mapply = (M, v) => M.map((row) => row[0] * v[0] + row[1] * v[1] + row[2] * v[2]);
export const meq = (A, B) => A.every((row, i) => row.every((x, j) => x === B[i][j]));
export const mdet = (M) =>
  M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1])
  - M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0])
  + M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0]);
/** 绕世界坐标轴转 90°（axis 0=x 1=y 2=z）。 */
export function rot90(axis) {
  const c = 0, s = 1;
  if (axis === 0) return [[1, 0, 0], [0, c, -s], [0, s, c]];
  if (axis === 1) return [[c, 0, s], [0, 1, 0], [-s, 0, c]];
  return [[c, -s, 0], [s, c, 0], [0, 0, 1]];
}
/** 三个空位的朝向矩阵（第 0 块已经放好）。 */
export const SLOTS = [I3, CYC, mmul(CYC, CYC)];
/** 基准阳马的点：以方块中心为原点、边长 1。 */
export const YANGMA_BASE = [[-0.5, -0.5, -0.5], [0.5, -0.5, -0.5], [0.5, -0.5, 0.5], [-0.5, -0.5, 0.5]];
export const YANGMA_APEX = [0.5, 0.5, 0.5];
/** 点 q 在基准阳马里吗（含边界）。 */
export const inYangma = (q) => q[0] >= q[1] - 1e-9 && q[2] >= q[1] - 1e-9;
/** 现在的朝向 M 把阳马的尖放在哪。 */
export const apexOf = (M) => mapply(M, YANGMA_APEX);

/**
 * 从朝向 from 出发，最少转几次 90°（每次选一个世界轴），能到 targets 里任意一个。返回 [轴, 轴, ...]。
 * @param {number[][]} from @param {number[][][]} targets
 */
export function rotationPlan(from, targets) {
  const key = (M) => M.flat().join(',');
  const goal = new Set(targets.map(key));
  if (goal.has(key(from))) return [];
  const seen = new Set([key(from)]);
  let frontier = [{ M: from, path: [] }];
  for (let depth = 0; depth < 6; depth++) {
    const next = [];
    for (const { M, path } of frontier) {
      for (let a = 0; a < 3; a++) {
        const N = mmul(rot90(a), M);
        const k = key(N);
        if (seen.has(k)) continue;
        seen.add(k);
        if (goal.has(k)) return [...path, a];
        next.push({ M: N, path: [...path, a] });
      }
    }
    frontier = next;
  }
  return null;
}
