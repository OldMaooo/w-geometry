// 第 2 章的纯几何：圆与圆、线与圆、线与线的交点，中垂线，角平分线，外心。
// 点都是世界坐标 {x, z}（z 朝镜头）。不依赖 three，可单测。

export const EPS = 1e-9;
export const TAU = Math.PI * 2;

export const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
export const mid = (a, b) => ({ x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 });
export const sub = (a, b) => ({ x: a.x - b.x, z: a.z - b.z });
export const unit = (v) => { const l = Math.hypot(v.x, v.z) || 1; return { x: v.x / l, z: v.z / l }; };
/** 逆时针转 90°（在 x 向右、z 向下的画面里是顺时针，只看数学，不影响结果）。 */
export const perp = (v) => ({ x: -v.z, z: v.x });
export const angleOf = (c, p) => Math.atan2(p.z - c.z, p.x - c.x);
export const onCircle = (c, r, a) => ({ x: c.x + r * Math.cos(a), z: c.z + r * Math.sin(a) });

/** 把角度折到 (-π, π]。 */
export function normAngle(a) {
  let x = a % TAU;
  if (x > Math.PI) x -= TAU;
  if (x <= -Math.PI) x += TAU;
  return x;
}

/** 从 a 转到 b 的最短带符号角度。 */
export const angleDiff = (a, b) => normAngle(b - a);

/**
 * 两圆交点。0 / 1 / 2 个点。两个点时顺序固定：第一个在「c1 → c2 方向的左手边」（数学意义上的逆时针侧，即 perp 方向）。
 * @returns {{x:number,z:number}[]}
 */
export function circleCircle(c1, r1, c2, r2) {
  const d = dist(c1, c2);
  if (d < EPS) return [];
  if (d > r1 + r2 + EPS || d < Math.abs(r1 - r2) - EPS) return [];
  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
  const h2 = r1 * r1 - a * a;
  const u = unit(sub(c2, c1));
  const base = { x: c1.x + u.x * a, z: c1.z + u.z * a };
  if (h2 <= EPS) return [base];
  const h = Math.sqrt(h2);
  const n = perp(u);
  return [{ x: base.x + n.x * h, z: base.z + n.z * h }, { x: base.x - n.x * h, z: base.z - n.z * h }];
}

/** 过 a、b 两点的直线与圆的交点（沿 a→b 方向，先近后远）。 */
export function lineCircle(a, b, c, r) {
  const u = unit(sub(b, a));
  const w = sub(a, c);
  const bq = w.x * u.x + w.z * u.z;
  const cq = w.x * w.x + w.z * w.z - r * r;
  const disc = bq * bq - cq;
  if (disc < -EPS) return [];
  if (disc <= EPS) return [{ x: a.x - u.x * bq, z: a.z - u.z * bq }];
  const s = Math.sqrt(disc);
  return [-bq - s, -bq + s].map((t) => ({ x: a.x + u.x * t, z: a.z + u.z * t }));
}

/** 过 a、b 的直线与过 c、d 的直线的交点；平行返回 null。 */
export function lineLine(a, b, c, d) {
  const r = sub(b, a), s = sub(d, c);
  const den = r.x * s.z - r.z * s.x;
  if (Math.abs(den) < EPS) return null;
  const q = sub(c, a);
  const t = (q.x * s.z - q.z * s.x) / den;
  return { x: a.x + r.x * t, z: a.z + r.z * t };
}

/** 中垂线：过中点、垂直于 ab。返回 {a, b}（两点定线）。 */
export function perpBisector(a, b) {
  const m = mid(a, b);
  const n = perp(unit(sub(b, a)));
  return { a: m, b: { x: m.x + n.x, z: m.z + n.z } };
}

/** 点到「过 a、b 的直线」的距离。 */
export function distToLine(p, a, b) {
  const u = unit(sub(b, a));
  const w = sub(p, a);
  return Math.abs(w.x * u.z - w.z * u.x);
}

/** 点在线段上的位置参数 t（a 处 0，b 处 1）。 */
export function paramOnLine(p, a, b) {
  const v = sub(b, a);
  const l2 = v.x * v.x + v.z * v.z || 1;
  return ((p.x - a.x) * v.x + (p.z - a.z) * v.z) / l2;
}

/** 角平分线方向（单位向量）：从顶点 o 出发，夹在 o→p1 和 o→p2 之间。 */
export function bisectorDir(o, p1, p2) {
  const u1 = unit(sub(p1, o)), u2 = unit(sub(p2, o));
  return unit({ x: u1.x + u2.x, z: u1.z + u2.z });
}

/** 两条射线（从 o 出发的方向）夹角，度数，0–180。 */
export function angleBetweenDeg(u, v) {
  const c = Math.max(-1, Math.min(1, u.x * v.x + u.z * v.z));
  return (Math.acos(c) * 180) / Math.PI;
}

/** 三点的外心（到三点一样远的点）；三点共线返回 null。 */
export function circumcenter(a, b, c) {
  const l1 = perpBisector(a, b), l2 = perpBisector(b, c);
  return lineLine(l1.a, l1.b, l2.a, l2.b);
}
