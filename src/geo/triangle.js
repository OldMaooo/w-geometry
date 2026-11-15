// 三角形：由三边求角、判直角、由三边定顶点、列出给定周长的整数三角形。

/**
 * 三边 a、b、c 对应的三个角（度）。A 是 a 的对角，依此类推。
 * 不能成三角形返回 null。
 * @param {number} a @param {number} b @param {number} c
 * @returns {{ A: number, B: number, C: number } | null}
 */
export function anglesFromSides(a, b, c) {
  if (!isTriangle(a, b, c)) return null;
  const deg = (x) => (Math.acos(Math.min(1, Math.max(-1, x))) * 180) / Math.PI;
  const A = deg((b * b + c * c - a * a) / (2 * b * c));
  const B = deg((a * a + c * c - b * b) / (2 * a * c));
  return { A, B, C: 180 - A - B };
}

/** 三边能不能围成三角形（严格不等式，压扁的不算）。 */
export function isTriangle(a, b, c) {
  return a > 0 && b > 0 && c > 0 && a + b > c && a + c > b && b + c > a;
}

/** 三边里有没有直角（勾股）。 @param {number} a @param {number} b @param {number} c */
export function isRightTriangle(a, b, c, eps = 1e-6) {
  const s = [a, b, c].sort((x, y) => x - y);
  return isTriangle(a, b, c) && Math.abs(s[0] * s[0] + s[1] * s[1] - s[2] * s[2]) < eps;
}

/**
 * 底边从 (0,0) 到 (c,0)；第三点到 (0,0) 距离 a、到 (c,0) 距离 b，取 y>0 的那个。
 * @param {number} c @param {number} a @param {number} b
 * @returns {{x:number,y:number} | null}
 */
export function apexFromSides(c, a, b) {
  if (!isTriangle(a, b, c)) return null;
  const x = (a * a - b * b + c * c) / (2 * c);
  const y = Math.sqrt(Math.max(0, a * a - x * x));
  return { x, y };
}

/**
 * 周长为 p 的所有整数边三角形（不计顺序），按最短边排序。
 * @param {number} p @returns {[number, number, number][]}
 */
export function integerTriangles(p) {
  const out = [];
  for (let a = 1; a <= p; a++) {
    for (let b = a; b <= p; b++) {
      const c = p - a - b;
      if (c < b) continue;
      if (isTriangle(a, b, c)) out.push([a, b, c]);
    }
  }
  return out;
}

/**
 * 三角形三个顶点坐标的内角（度），按顶点顺序返回。
 * @param {{x:number,y:number}[]} t
 */
export function cornerAngles(t) {
  return t.map((p, i) => {
    const a = t[(i + 2) % 3];
    const b = t[(i + 1) % 3];
    const u = { x: a.x - p.x, y: a.y - p.y };
    const v = { x: b.x - p.x, y: b.y - p.y };
    const c = (u.x * v.x + u.y * v.y) / (Math.hypot(u.x, u.y) * Math.hypot(v.x, v.y));
    return (Math.acos(Math.min(1, Math.max(-1, c))) * 180) / Math.PI;
  });
}
