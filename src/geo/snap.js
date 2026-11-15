// 吸附：整步 / 半步 / 自定义吸附点 / 吸到一条线上。
import { dist, dot, sub, add, scale, norm } from './vec2.js';

/**
 * 把一个数吸到 step 的整数倍（可带偏移）。
 * @param {number} v @param {number} [step=1] @param {number} [offset=0]
 */
export function snapStep(v, step = 1, offset = 0) {
  if (!step) return v;
  const r = Math.round((v - offset) / step) * step + offset;
  // 消掉 -0 和浮点毛刺
  return Math.abs(r) < 1e-9 ? 0 : Math.round(r * 1e6) / 1e6;
}

/** 平面点按网格吸附。 @param {{x:number,y:number}} p @param {number} [step=1] */
export function snapPoint(p, step = 1) {
  return { x: snapStep(p.x, step), y: snapStep(p.y, step) };
}

/**
 * 在若干吸附点里找最近的一个；超过 maxDist 返回 null。
 * @template {{x:number,y:number}} T
 * @param {{x:number,y:number}} p @param {T[]} points @param {number} [maxDist=Infinity]
 * @returns {{ point: T, index: number, d: number } | null}
 */
export function nearestPoint(p, points, maxDist = Infinity) {
  let best = null;
  points.forEach((q, index) => {
    const d = dist(p, q);
    if (d <= maxDist && (!best || d < best.d)) best = { point: q, index, d };
  });
  return best;
}

/**
 * 把点投影到一条射线（起点 a、方向 dir）上，沿线距离按 step 吸附。
 * 离线太远（> maxDist）返回 null。t 会被夹在 [minT, maxT]。
 * @param {{x:number,y:number}} p
 * @param {{x:number,y:number}} a
 * @param {{x:number,y:number}} dir
 * @param {{ step?: number, maxDist?: number, minT?: number, maxT?: number }} [opt]
 * @returns {{ point: {x:number,y:number}, t: number, off: number } | null}
 */
export function snapToRay(p, a, dir, opt = {}) {
  const { step = 1, maxDist = Infinity, minT = 0, maxT = Infinity } = opt;
  const u = norm(dir);
  const ap = sub(p, a);
  const along = dot(ap, u);
  const foot = add(a, scale(u, along));
  const off = dist(p, foot);
  if (off > maxDist) return null;
  let t = step ? snapStep(along, step) : along;
  t = Math.min(maxT, Math.max(minT, t));
  return { point: add(a, scale(u, t)), t, off };
}

/** 夹到区间里。 @param {number} v @param {number} lo @param {number} hi */
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
