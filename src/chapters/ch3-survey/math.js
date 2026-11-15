// 第 3 章的纯数学：太阳高度 → 影长、影子方向、三点一线、相似放大、L 形放样、山高。
// 不依赖 three，可单测。长度单位 = 步，角度用度。
import { pointInPolygon } from '../../geo/index.js';

export const DEG = Math.PI / 180;
export const clamp01 = (v) => Math.min(1, Math.max(0, v));

// ---------- 太阳 ----------
// 太阳在「一天的弧」上的位置 s ∈ [0,1]：0 = 早上低低的，0.5 = 正午最高，1 = 傍晚低低的。
export const E_MIN = 15;  // 最低高度角（度）
export const E_AMP = 59;  // 正午比最低多出的度数

/** 太阳高度角（度）。 */
export const elevOf = (s) => E_MIN + E_AMP * Math.sin(Math.PI * clamp01(s));

/** 影长 ÷ 竿高。 */
export const ratioOfElev = (eDeg) => 1 / Math.tan(eDeg * DEG);
export const ratioOf = (s) => ratioOfElev(elevOf(s));

/** 影长（步）：竿高 h，太阳在 s。 */
export const shadowLen = (h, s) => h * ratioOf(s);

/**
 * 想要影长 ÷ 竿高 = r，太阳该在弧上哪里。side: 'am' 上午一侧 / 'pm' 下午一侧。够不着返回 null。
 * @param {number} r @param {'am'|'pm'} [side]
 */
export function sForRatio(r, side = 'am') {
  const e = Math.atan(1 / r) / DEG;
  const u = (e - E_MIN) / E_AMP;
  if (u < 0 || u > 1) return null;
  const a = Math.asin(u) / Math.PI;
  return side === 'am' ? a : 1 - a;
}

/** 影子朝向（单位向量 {x,z}）：早上往右偏、正午正对镜头、傍晚往左偏。sway = 一天里一共摆多少度。 */
export function shadowDir(s, sway = 50) {
  const a = (0.5 - s) * sway * DEG;
  return { x: Math.sin(a), z: Math.cos(a) };
}

/** 磁吸：s 离某个目标 s 在 tol 以内就吸过去。targets 是 s 的数组。 */
export function magnetS(s, targets, tol = 0.012) {
  let best = null;
  for (const t of targets) {
    const d = Math.abs(s - t);
    if (d <= tol && (!best || d < best.d)) best = { d, t };
  }
  return best ? best.t : s;
}

/** 一组影长比 → 弧上所有对应的 s（上午 + 下午）。 */
export function magnetTargets(ratios) {
  const out = [];
  for (const r of ratios) {
    const a = sForRatio(r, 'am');
    if (a !== null) out.push(a, 1 - a);
  }
  return out;
}

/** 显示用的数：整数或一位小数，去掉多余的 .0。 */
export const showNum = (v) => String(Math.round(v * 10) / 10);

/** 太阳在天上的方向（单位向量，从地面指向太阳）。 */
export function sunVec(s, sway = 50) {
  const e = elevOf(s) * DEG;
  const d = shadowDir(s, sway);
  return { x: -d.x * Math.cos(e), y: Math.sin(e), z: -d.z * Math.cos(e) };
}

// ---------- 点与线 ----------
/** 点 p 到直线 ab 的距离。 */
export function distToLine(p, a, b) {
  const dx = b.x - a.x, dz = b.z - a.z;
  const L = Math.hypot(dx, dz) || 1;
  return Math.abs((p.x - a.x) * dz - (p.z - a.z) * dx) / L;
}

/** 三点一线（地面上）。 */
export const collinear = (a, b, c, tol = 0.05) => distToLine(b, a, c) <= tol;

/** 直线 T→B 延长到 x = X 处的 z。 */
export const lineZAtX = (T, B, X) => T.z + ((B.z - T.z) * (X - T.x)) / (B.x - T.x);

// ---------- 量河宽 ----------
/**
 * 河宽 W（树在对岸正对 A，AB = BC = b）。D 在 C 垂直后退的线上，B、T、D 三点一线的位置。
 * 返回 D（岸线在 z=0，河在 z<0）。
 */
export function riverD(W, b) {
  return { x: 2 * b, z: W };
}

// ---------- 隔海望山 ----------
/** 眼睛在地面 (xE,0)，竿顶在 (xP, h)，视线延长到 x = X 的高度。 */
export const sightY = (xE, xP, h, X) => (h * (X - xE)) / (xP - xE);

/** 山高：两根竿高 h，退的步数 a1 / a2，两竿相距 d。 */
export const mountainHeight = (h, a1, a2, d) => h + (h * d) / (a2 - a1);

// ---------- 放大 ----------
/** 底边从 b 放大到 target 要几倍。 */
export const factorFor = (b, target) => target / b;

/** 图纸 L 形（单位格）：横 4 竖 3 的 L，一共 6 格。点是 [x, z]。 */
export const L_POLY = [[0, 0], [4, 0], [4, 1], [1, 1], [1, 3], [0, 3]];

/** 多边形放大 k 倍。 @param {number[][]} poly */
export const scalePoly = (poly, k) => poly.map(([x, z]) => [x * k, z * k]);

/** 多边形边长（依次，最后一条回到起点）。 */
export function edgeLens(poly) {
  return poly.map((p, i) => {
    const q = poly[(i + 1) % poly.length];
    return Math.abs(q[0] - p[0]) + Math.abs(q[1] - p[1]); // 只有横竖边
  });
}

/** 横竖多边形里的整格（返回格子左上角 [i, j]）。 */
export function cellsIn(poly) {
  const pts = poly.map(([x, y]) => ({ x, y }));
  const w = Math.max(...poly.map((p) => p[0])), d = Math.max(...poly.map((p) => p[1]));
  const out = [];
  for (let j = 0; j < d; j++) for (let i = 0; i < w; i++) {
    if (pointInPolygon({ x: i + 0.5, y: j + 0.5 }, pts)) out.push([i, j]);
  }
  return out;
}

/** 图纸上的一格放大 k 倍，变成 k×k 个小格（左上角）。 */
export function blockOf(cell, k) {
  const out = [];
  for (let a = 0; a < k; a++) for (let b = 0; b < k; b++) out.push([cell[0] * k + a, cell[1] * k + b]);
  return out;
}
