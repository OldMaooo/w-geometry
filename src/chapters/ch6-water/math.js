// 第 6 章的纯数学：逐段流水、折线长度、费马点、镜像最短路、梯形截面、按比例分水。不依赖 three / DOM。

// ---------------------------------------------------------------- 6-1 逐段流水
/** 渠道一段降超过这么多尺，水会把渠冲坏。 */
export const MAX_DROP = 2;

/** 每段的落差（前一个节点 − 后一个节点），正数 = 往下降。 */
export const drops = (nodes) => nodes.slice(0, -1).map((h, i) => h - nodes[i + 1]);

/**
 * 水一段一段往下流：不比自己高就能走；上坡就停；一段降太多（> MAX_DROP）冲坏。
 * 返回 { kind: 'ok'|'blocked'|'burst', seg }：seg = 停在 / 冲坏的那一段（从 0 数起；ok 时 = 最后一段）。
 * @param {number[]} nodes @param {number} [maxDrop]
 */
export function simulateSlope(nodes, maxDrop = MAX_DROP) {
  const d = drops(nodes);
  for (let i = 0; i < d.length; i++) {
    if (d[i] < 0) return { kind: 'blocked', seg: i };
    if (d[i] > maxDrop) return { kind: 'burst', seg: i };
  }
  return { kind: 'ok', seg: d.length - 1 };
}

/** 3 星 = 每段都降 1~2 尺（没有平段、没有冲坏）；水到了但有平段 = 2 星。 */
export function slopeStars(nodes, maxDrop = MAX_DROP) {
  if (simulateSlope(nodes, maxDrop).kind !== 'ok') return 0;
  return drops(nodes).every((x) => x >= 1 && x <= maxDrop) ? 3 : 2;
}

/** 水准器：一段的气泡偏向高的一头。返回 -1（左高）/ 0（平）/ 1（右高）。 */
export const levelSide = (hLeft, hRight) => Math.sign(hRight - hLeft);

// ---------------------------------------------------------------- 6-2 最短的渠
export const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

/** 折线总长。 @param {{x:number,z:number}[]} pts */
export function polylineLength(pts) {
  let s = 0;
  for (let i = 1; i < pts.length; i++) s += dist(pts[i - 1], pts[i]);
  return s;
}

/** 线段 a→b 是否穿过长方形（严格穿进里面）。rect = {x0,x1,z0,z1}。Liang–Barsky。 */
export function segHitsRect(a, b, r, eps = 1e-6) {
  let t0 = 0, t1 = 1;
  const dx = b.x - a.x, dz = b.z - a.z;
  const clip = (p, q) => {
    if (Math.abs(p) < 1e-12) return q > eps;
    const t = q / p;
    if (p < 0) { if (t > t1) return false; if (t > t0) t0 = t; } else { if (t < t0) return false; if (t < t1) t1 = t; }
    return true;
  };
  return clip(-dx, a.x - r.x0 - eps) && clip(dx, r.x1 - a.x - eps) && clip(-dz, a.z - r.z0 - eps) && clip(dz, r.z1 - a.z - eps) && t1 - t0 > 1e-9;
}

/** 折线有没有穿过石山。 */
export const pathHitsRect = (pts, r) => pts.slice(1).some((p, i) => segHitsRect(pts[i], p, r));

/**
 * 绕过一座长方形石山的最短路（可见图 + 最短路）。corners 比山大一圈 margin。
 * 返回 { length, route }，route 是从 a 到 b 的点列。
 */
export function shortestAround(a, b, r, margin = 0.3) {
  const cs = [
    { x: r.x0 - margin, z: r.z0 - margin }, { x: r.x1 + margin, z: r.z0 - margin },
    { x: r.x1 + margin, z: r.z1 + margin }, { x: r.x0 - margin, z: r.z1 + margin },
  ];
  const nodes = [a, b, ...cs];
  const n = nodes.length;
  const D = Array.from({ length: n }, () => Array(n).fill(Infinity));
  const nxt = Array.from({ length: n }, () => Array(n).fill(-1));
  for (let i = 0; i < n; i++) {
    D[i][i] = 0; nxt[i][i] = i;
    for (let j = 0; j < n; j++) if (i !== j && !segHitsRect(nodes[i], nodes[j], r)) { D[i][j] = dist(nodes[i], nodes[j]); nxt[i][j] = j; }
  }
  for (let k = 0; k < n; k++) for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    if (D[i][k] + D[k][j] < D[i][j] - 1e-12) { D[i][j] = D[i][k] + D[k][j]; nxt[i][j] = nxt[i][k]; }
  }
  const route = [nodes[0]];
  let u = 0;
  while (u !== 1 && nxt[u][1] !== -1) { u = nxt[u][1]; route.push(nodes[u]); }
  return { length: D[0][1], route };
}

/** 费马点（到三点距离之和最小的点）：Weiszfeld 迭代。 @param {{x:number,z:number}[]} P */
export function fermatPoint(P) {
  let c = { x: P.reduce((s, p) => s + p.x, 0) / P.length, z: P.reduce((s, p) => s + p.z, 0) / P.length };
  for (let k = 0; k < 200; k++) {
    let wx = 0, wz = 0, ws = 0;
    for (const p of P) {
      const d = Math.max(dist(c, p), 1e-9);
      wx += p.x / d; wz += p.z / d; ws += 1 / d;
    }
    const nc = { x: wx / ws, z: wz / ws };
    if (dist(nc, c) < 1e-10) { c = nc; break; }
    c = nc;
  }
  return c;
}

/** 一条主渠 + 分岔：A → J，J → 每个村。总长。 */
export const treeLength = (A, J, villages) => dist(A, J) + villages.reduce((s, v) => s + dist(J, v), 0);

// ---------------------------------------------------------------- 6-3 镜子里的最短路
/** 把点映到河对岸（河岸线是 z = 0）。 */
export const mirror = (p) => ({ x: p.x, z: -p.z });

/** 村 V、田 F 都在河岸（z=0）这一侧：先到岸上 D 再去田，总路程。 */
export const walkLen = (V, D, F) => dist(V, D) + dist(D, F);

/** 镜子法：V 到影子田 F' 的直线穿过河岸的那一点（最优饮水点）。 */
export function mirrorBest(V, F) {
  const Fm = mirror(F);
  const t = V.z / (V.z - Fm.z);
  const D = { x: V.x + (Fm.x - V.x) * t, z: 0 };
  return { D, length: dist(V, Fm), Fm };
}

// ---------------------------------------------------------------- 6-4 渠的截面
/** 梯形截面的格数：b 底宽、t 口宽、d 深。 */
export const trapArea = ({ b, t, d }) => ((b + t) / 2) * d;

/**
 * 土坡不够斜会垮：每边的水平退让 (t−b)/2 至少要 minSlope × 深度。
 * 垮了以后，土落进渠里，底变窄（口宽不变）。返回实际截面 + 有没有垮。
 */
export function effectiveSection({ b, t, d }, minSlope = 0.5) {
  const off = (t - b) / 2;
  const need = minSlope * d;
  if (off + 1e-9 >= need) return { b, t, d, collapsed: false };
  return { b: Math.max(0, t - 2 * need), t, d, collapsed: true };
}

// ---------------------------------------------------------------- 6-5 按比例分水
/** 鱼嘴位置（从左数的步数，升序）→ 每条分渠的宽。 */
export function widthsFromCuts(cuts, total) {
  const xs = [0, ...cuts, total];
  return xs.slice(1).map((x, i) => x - xs[i]);
}

/**
 * 同一时间里，各块田的水位（1 = 刚好浇透）。时间取「公平分配刚好浇透」的那一刻。
 * @param {number[]} widths 各渠口宽 @param {number[]} areas 各田面积
 */
export function fillLevels(widths, areas) {
  const T = areas.reduce((s, a) => s + a, 0) / widths.reduce((s, w) => s + w, 0);
  return widths.map((w, i) => (w * T) / areas[i]);
}

/** 每块田都浇透（水位在 1 ± tol 里）。 */
export const isFair = (levels, tol = 0.08) => levels.every((l) => Math.abs(l - 1) <= tol);

/** 按面积比分总宽：返回每条渠该开多宽（可能不是整数）。 */
export const shareWidths = (areas, total) => areas.map((a) => (a / areas.reduce((s, x) => s + x, 0)) * total);

// ---------------------------------------------------------------- 6-6 三块田
/** 三角形面积 / 平行四边形面积。 */
export const triArea = (base, h) => (base * h) / 2;
export const paraArea = (base, h) => base * h;
