// 平面向量小工具。点一律写成 { x, y }（关卡里 y 对应地面上的「往远处」方向）。
// 纯函数、不依赖 three，方便单测。

/** @typedef {{ x: number, y: number }} P */

/** @param {number} x @param {number} y @returns {P} */
export const v2 = (x, y) => ({ x, y });
/** @param {P} a @param {P} b @returns {P} */
export const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
/** @param {P} a @param {P} b @returns {P} */
export const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
/** @param {P} a @param {number} k @returns {P} */
export const scale = (a, k) => ({ x: a.x * k, y: a.y * k });
/** @param {P} a @param {P} b @returns {number} */
export const dot = (a, b) => a.x * b.x + a.y * b.y;
/** @param {P} a @param {P} b @returns {number} */
export const cross = (a, b) => a.x * b.y - a.y * b.x;
/** @param {P} a @returns {number} */
export const len = (a) => Math.hypot(a.x, a.y);
/** @param {P} a @param {P} b @returns {number} */
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
/** @param {P} a @param {P} b @param {number} t @returns {P} */
export const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

/** 单位向量；零向量返回 (1,0) 防止除零。 @param {P} a @returns {P} */
export function norm(a) {
  const l = len(a);
  return l < 1e-9 ? { x: 1, y: 0 } : { x: a.x / l, y: a.y / l };
}

/** 逆时针转 90°。 @param {P} a @returns {P} */
export const perp = (a) => ({ x: -a.y, y: a.x });

/** 绕 c 点转半圈（点对称）。 @param {P} p @param {P} c @returns {P} */
export const rotate180 = (p, c) => ({ x: 2 * c.x - p.x, y: 2 * c.y - p.y });

/** 两点几乎重合。 @param {P} a @param {P} b @param {number} [eps] */
export const near = (a, b, eps = 1e-6) => dist(a, b) <= eps;
