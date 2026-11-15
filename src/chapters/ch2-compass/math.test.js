import { describe, it, expect } from 'vitest';
import {
  dist, circleCircle, lineCircle, lineLine, perpBisector, distToLine, bisectorDir,
  angleBetweenDeg, circumcenter, normAngle, angleDiff, paramOnLine, onCircle, angleOf,
} from './math.js';

const near = (a, b, e = 1e-6) => Math.abs(a - b) < e;

describe('circleCircle', () => {
  it('等边三角形：以 A、B 为心、AB 为半径，交点到 A、B 都是 AB', () => {
    const A = { x: -3, z: 0 }, B = { x: 3, z: 0 };
    const pts = circleCircle(A, 6, B, 6);
    expect(pts).toHaveLength(2);
    for (const p of pts) {
      expect(near(dist(p, A), 6)).toBe(true);
      expect(near(dist(p, B), 6)).toBe(true);
    }
    expect(near(Math.abs(pts[0].z), Math.sqrt(27))).toBe(true);
    expect(near(pts[0].z, -pts[1].z)).toBe(true);
  });
  it('相切给一个点，太远给空', () => {
    expect(circleCircle({ x: 0, z: 0 }, 2, { x: 4, z: 0 }, 2)).toHaveLength(1);
    expect(circleCircle({ x: 0, z: 0 }, 1, { x: 4, z: 0 }, 2)).toHaveLength(0);
    expect(circleCircle({ x: 0, z: 0 }, 5, { x: 0, z: 0 }, 5)).toHaveLength(0);
  });
  it('一个圆在另一个里面：没有交点', () => {
    expect(circleCircle({ x: 0, z: 0 }, 5, { x: 1, z: 0 }, 1)).toHaveLength(0);
  });
});

describe('lineCircle / lineLine', () => {
  it('过圆心的线交圆于两端', () => {
    const pts = lineCircle({ x: -10, z: 0 }, { x: -9, z: 0 }, { x: 0, z: 0 }, 3);
    expect(pts).toHaveLength(2);
    expect(near(pts[0].x, -3)).toBe(true);
    expect(near(pts[1].x, 3)).toBe(true);
  });
  it('相切一个点，不碰为空', () => {
    expect(lineCircle({ x: -5, z: 3 }, { x: 5, z: 3 }, { x: 0, z: 0 }, 3)).toHaveLength(1);
    expect(lineCircle({ x: -5, z: 4 }, { x: 5, z: 4 }, { x: 0, z: 0 }, 3)).toHaveLength(0);
  });
  it('两条线相交、平行', () => {
    const p = lineLine({ x: 0, z: 0 }, { x: 1, z: 1 }, { x: 0, z: 4 }, { x: 4, z: 0 });
    expect(near(p.x, 2) && near(p.z, 2)).toBe(true);
    expect(lineLine({ x: 0, z: 0 }, { x: 1, z: 0 }, { x: 0, z: 1 }, { x: 1, z: 1 })).toBeNull();
  });
});

describe('中垂线', () => {
  it('线上每点到两端一样远，并且垂直平分', () => {
    const A = { x: -4, z: -1 }, B = { x: 4, z: 1 };
    const { a, b } = perpBisector(A, B);
    for (const t of [-5, -1, 0, 2, 7]) {
      const p = { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
      expect(near(dist(p, A), dist(p, B))).toBe(true);
    }
    expect(near(a.x, 0) && near(a.z, 0)).toBe(true);
    const dot = (b.x - a.x) * (B.x - A.x) + (b.z - a.z) * (B.z - A.z);
    expect(near(dot, 0)).toBe(true);
  });
  it('两圆交点连线就是中垂线', () => {
    const A = { x: -4, z: -1 }, B = { x: 4, z: 1 };
    const [p, q] = circleCircle(A, 5, B, 5);
    const { a, b } = perpBisector(A, B);
    expect(near(distToLine(p, a, b), 0)).toBe(true);
    expect(near(distToLine(q, a, b), 0)).toBe(true);
  });
});

describe('角平分线', () => {
  it('圆与两边交点 → 两点各画等圆 → 交点在角平分线上', () => {
    const O = { x: -6, z: 5 };
    const d1 = { x: Math.cos(-1.1), z: Math.sin(-1.1) };
    const d2 = { x: Math.cos(-0.15), z: Math.sin(-0.15) };
    const P1 = { x: O.x + d1.x * 4, z: O.z + d1.z * 4 };
    const P2 = { x: O.x + d2.x * 4, z: O.z + d2.z * 4 };
    const q = circleCircle(P1, 4, P2, 4);
    const bis = bisectorDir(O, P1, P2);
    for (const p of q) {
      const to = { x: p.x - O.x, z: p.z - O.z };
      const cross = to.x * bis.z - to.z * bis.x;
      expect(near(cross, 0)).toBe(true);
    }
    const a1 = angleBetweenDeg(bis, d1), a2 = angleBetweenDeg(bis, d2);
    expect(near(a1, a2, 1e-6)).toBe(true);
  });
});

describe('外心（找圆心）', () => {
  it('圆弧上三点的两条中垂线交在圆心', () => {
    const K = { x: 0.5, z: 2 }, R = 5.5;
    const [A, B, C] = [-2.6, -1.7, -0.6].map((a) => onCircle(K, R, a));
    const c = circumcenter(A, B, C);
    expect(near(c.x, K.x, 1e-6) && near(c.z, K.z, 1e-6)).toBe(true);
    expect(near(dist(c, A), R)).toBe(true);
  });
  it('三点共线没有外心', () => {
    expect(circumcenter({ x: 0, z: 0 }, { x: 1, z: 1 }, { x: 2, z: 2 })).toBeNull();
  });
});

describe('角度小工具', () => {
  it('normAngle / angleDiff 走最短的路', () => {
    expect(near(normAngle(Math.PI * 3), Math.PI)).toBe(true);
    expect(near(angleDiff(3, -3), 2 * Math.PI - 6)).toBe(true);
    expect(near(angleOf({ x: 0, z: 0 }, { x: 0, z: 2 }), Math.PI / 2)).toBe(true);
  });
  it('paramOnLine', () => {
    expect(near(paramOnLine({ x: 3, z: 0 }, { x: 0, z: 0 }, { x: 6, z: 0 }), 0.5)).toBe(true);
  });
  it('正六边形：半径在圆上正好走六步', () => {
    const O = { x: 1, z: 1 }, r = 3;
    let p = onCircle(O, r, 0.4);
    const start = p;
    // 每步：以当前点为心、r 为半径的圆和原圆交点之一（取离上一步远的那个）
    let prev = onCircle(O, r, 0.4 - Math.PI / 3);
    for (let i = 0; i < 6; i++) {
      const [s, t] = circleCircle(p, r, O, r);
      const next = dist(s, prev) > dist(t, prev) ? s : t;
      prev = p; p = next;
    }
    expect(near(dist(p, start), 0, 1e-6)).toBe(true);
  });
});
