// 多边形：面积、包围盒、竖切、平移、点对称、凸包、是不是长方形。
// 多边形 = 点数组 [{x,y}, ...]，首尾不重复。

import { rotate180 } from './vec2.js';

/** 带符号面积（逆时针为正）。 @param {{x:number,y:number}[]} poly */
export function signedArea(poly) {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    s += a.x * b.y - b.x * a.y;
  }
  return s / 2;
}

/** 面积（鞋带公式）。 @param {{x:number,y:number}[]} poly */
export const area = (poly) => Math.abs(signedArea(poly));

/** 包围盒。 @param {{x:number,y:number}[]} pts */
export function bbox(pts) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}

/** 面积重心。 @param {{x:number,y:number}[]} poly */
export function centroid(poly) {
  const A = signedArea(poly);
  if (Math.abs(A) < 1e-12) {
    const n = poly.length;
    return { x: poly.reduce((s, p) => s + p.x, 0) / n, y: poly.reduce((s, p) => s + p.y, 0) / n };
  }
  let cx = 0, cy = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const f = a.x * b.y - b.x * a.y;
    cx += (a.x + b.x) * f;
    cy += (a.y + b.y) * f;
  }
  return { x: cx / (6 * A), y: cy / (6 * A) };
}

/** 平移。 @param {{x:number,y:number}[]} poly @param {number} dx @param {number} dy */
export const translate = (poly, dx, dy) => poly.map((p) => ({ x: p.x + dx, y: p.y + dy }));

/** 绕点 c 转半圈。 @param {{x:number,y:number}[]} poly @param {{x:number,y:number}} c */
export const rotatePoly180 = (poly, c) => poly.map((p) => rotate180(p, c));

/** 去掉重合点和共线点，让多边形顶点最少。 @param {{x:number,y:number}[]} poly */
export function simplify(poly, eps = 1e-9) {
  let pts = poly.filter((p, i) => {
    const q = poly[(i + 1) % poly.length];
    return Math.hypot(p.x - q.x, p.y - q.y) > eps;
  });
  let changed = true;
  while (changed && pts.length > 3) {
    changed = false;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[(i - 1 + pts.length) % pts.length];
      const b = pts[i];
      const c = pts[(i + 1) % pts.length];
      const cr = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
      if (Math.abs(cr) < eps) {
        pts.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  return pts;
}

/**
 * 用竖线 x = k 切多边形，保留一边（Sutherland–Hodgman 单刀）。
 * @param {{x:number,y:number}[]} poly @param {number} k @param {'left'|'right'} keep
 */
export function clipByX(poly, k, keep) {
  const inside = (p) => (keep === 'left' ? p.x <= k + 1e-9 : p.x >= k - 1e-9);
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const cur = poly[i];
    const prev = poly[(i - 1 + poly.length) % poly.length];
    const ci = inside(cur);
    const pi = inside(prev);
    if (ci !== pi) {
      const t = (k - prev.x) / (cur.x - prev.x);
      out.push({ x: k, y: prev.y + (cur.y - prev.y) * t });
    }
    if (ci) out.push({ x: cur.x, y: cur.y });
  }
  return out.length >= 3 ? simplify(out) : [];
}

/** 凸包（单调链），逆时针。 @param {{x:number,y:number}[]} pts */
export function convexHull(pts) {
  const p = pts
    .map((q) => ({ x: q.x, y: q.y }))
    .sort((a, b) => a.x - b.x || a.y - b.y)
    .filter((q, i, arr) => i === 0 || Math.hypot(q.x - arr[i - 1].x, q.y - arr[i - 1].y) > 1e-9);
  if (p.length < 3) return p;
  const cr = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower = [];
  for (const q of p) {
    while (lower.length >= 2 && cr(lower[lower.length - 2], lower[lower.length - 1], q) <= 1e-9) lower.pop();
    lower.push(q);
  }
  const upper = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i];
    while (upper.length >= 2 && cr(upper[upper.length - 2], upper[upper.length - 1], q) <= 1e-9) upper.pop();
    upper.push(q);
  }
  upper.pop();
  lower.pop();
  return lower.concat(upper);
}

/**
 * 几块拼起来是不是一个正放的长方形（边和坐标轴平行）。
 * 判断：各块面积之和 ＝ 全部顶点的包围盒面积（拼块不重叠时成立）。
 * @param {{x:number,y:number}[][]} pieces
 */
export function piecesFormAxisRect(pieces, eps = 1e-6) {
  const all = pieces.flat();
  if (!all.length) return false;
  const b = bbox(all);
  const sum = pieces.reduce((s, q) => s + area(q), 0);
  return b.w > eps && b.h > eps && Math.abs(b.w * b.h - sum) < eps * Math.max(1, sum);
}

/**
 * 判断 4 个点（顺序任意）是不是平行四边形；是的话返回按凸包顺序的顶点和「有没有一对横边」。
 * @param {{x:number,y:number}[]} pts
 * @returns {{ poly: {x:number,y:number}[], horizontal: boolean, rect: boolean } | null}
 */
export function asParallelogram(pts, eps = 1e-6) {
  const hull = simplify(convexHull(pts));
  if (hull.length !== 4) return null;
  const [a, b, c, d] = hull;
  const okPar =
    Math.abs(a.x + c.x - b.x - d.x) < eps && Math.abs(a.y + c.y - b.y - d.y) < eps;
  if (!okPar) return null;
  const edges = [[a, b], [b, c], [c, d], [d, a]];
  const horizontal = edges.some(([p, q]) => Math.abs(p.y - q.y) < eps);
  const ab = { x: b.x - a.x, y: b.y - a.y };
  const bc = { x: c.x - b.x, y: c.y - b.y };
  const rect = Math.abs(ab.x * bc.x + ab.y * bc.y) < eps;
  return { poly: hull, horizontal, rect };
}

/** 点在多边形内（射线法）。 @param {{x:number,y:number}} p @param {{x:number,y:number}[]} poly */
export function pointInPolygon(p, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
