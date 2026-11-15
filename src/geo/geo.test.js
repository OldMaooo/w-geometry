import { describe, it, expect } from 'vitest';
import {
  dist, rotate180, norm, perp,
  snapStep, snapPoint, nearestPoint, snapToRay, clamp,
  area, signedArea, bbox, centroid, clipByX, convexHull, piecesFormAxisRect,
  asParallelogram, translate, rotatePoly180, pointInPolygon, simplify,
  anglesFromSides, isTriangle, isRightTriangle, apexFromSides, integerTriangles, cornerAngles,
  fixedPerimeterRect, bestRect, guessAccuracy, starsByError, mean,
} from './index.js';

const P = (x, y) => ({ x, y });

describe('vec2', () => {
  it('距离、单位向量、垂直、点对称', () => {
    expect(dist(P(0, 0), P(3, 4))).toBe(5);
    expect(norm(P(0, 5))).toEqual(P(0, 1));
    expect(norm(P(0, 0))).toEqual(P(1, 0));
    expect(perp(P(1, 0))).toEqual(P(-0, 1));
    expect(rotate180(P(1, 2), P(3, 3))).toEqual(P(5, 4));
  });
});

describe('snap 吸附', () => {
  it('整步、半步、带偏移', () => {
    expect(snapStep(2.4)).toBe(2);
    expect(snapStep(2.6)).toBe(3);
    expect(snapStep(2.3, 0.5)).toBe(2.5);
    expect(snapStep(-0.2)).toBe(0);
    expect(snapStep(1.1, 1, 0.5)).toBe(1.5);
    expect(snapStep(1.234, 0)).toBe(1.234);
    expect(snapPoint(P(1.4, -2.6))).toEqual(P(1, -3));
  });
  it('最近吸附点与半径', () => {
    const pts = [P(0, 0), P(5, 0), P(5, 5)];
    expect(nearestPoint(P(4.5, 0.4), pts).index).toBe(1);
    expect(nearestPoint(P(2.5, 2.5), pts, 1)).toBeNull();
  });
  it('吸到射线上，沿线整步', () => {
    const r = snapToRay(P(2.7, 0.4), P(0, 0), P(1, 0));
    expect(r.point).toEqual(P(3, 0));
    expect(r.t).toBe(3);
    expect(snapToRay(P(2, 3), P(0, 0), P(1, 0), { maxDist: 1 })).toBeNull();
    expect(snapToRay(P(-3, 0), P(0, 0), P(1, 0), { minT: 1 }).t).toBe(1);
    // 斜射线（3-4-5 方向）
    const s = snapToRay(P(3.1, 3.9), P(0, 0), P(3, 4));
    expect(s.t).toBe(5);
    expect(s.point.x).toBeCloseTo(3);
    expect(s.point.y).toBeCloseTo(4);
    expect(clamp(9, 0, 5)).toBe(5);
  });
});

describe('polygon 多边形', () => {
  const para = [P(0, 0), P(6, 0), P(8, 3), P(2, 3)]; // 底 6 高 3 斜移 2

  it('面积、带符号面积、包围盒、重心', () => {
    expect(area(para)).toBe(18);
    expect(signedArea(para)).toBe(18);
    expect(signedArea([...para].reverse())).toBe(-18);
    expect(bbox(para)).toMatchObject({ minX: 0, maxX: 8, w: 8, h: 3 });
    const c = centroid([P(0, 0), P(4, 0), P(4, 2), P(0, 2)]);
    expect(c.x).toBeCloseTo(2);
    expect(c.y).toBeCloseTo(1);
  });

  it('竖切：切在 2–6 之间，左块搬过去正好拼成长方形', () => {
    for (const k of [2, 3, 4, 5, 6]) {
      const L = clipByX(para, k, 'left');
      const R = clipByX(para, k, 'right');
      expect(area(L) + area(R)).toBeCloseTo(18);
      expect(piecesFormAxisRect([translate(L, 6, 0), R])).toBe(true);
      expect(piecesFormAxisRect([L, translate(R, -6, 0)])).toBe(true);
    }
  });

  it('竖切：切在斜边那段，拼不成长方形', () => {
    for (const k of [1, 7]) {
      const L = clipByX(para, k, 'left');
      const R = clipByX(para, k, 'right');
      expect(piecesFormAxisRect([translate(L, 6, 0), R])).toBe(false);
      expect(piecesFormAxisRect([L, translate(R, -6, 0)])).toBe(false);
    }
  });

  it('凸包、去共线点、点在内部', () => {
    const hull = convexHull([P(0, 0), P(2, 0), P(1, 1), P(2, 2), P(0, 2), P(1, 0)]);
    expect(hull.length).toBe(4);
    expect(simplify([P(0, 0), P(1, 0), P(2, 0), P(2, 2), P(0, 2)]).length).toBe(4);
    expect(pointInPolygon(P(4, 1), para)).toBe(true);
    expect(pointInPolygon(P(0.5, 2.5), para)).toBe(false);
  });

  it('三角形加转半圈的影子拼成平行四边形（三角是一半）', () => {
    const tri = [P(0, 0), P(6, 0), P(2, 4)];
    const mid = P(4, 2); // 边 (6,0)-(2,4) 的中点
    const shadow = rotatePoly180(tri, mid);
    const pg = asParallelogram([...tri, ...shadow]);
    expect(pg).not.toBeNull();
    expect(pg.horizontal).toBe(true);
    expect(pg.rect).toBe(false);
    expect(area(pg.poly)).toBeCloseTo(2 * area(tri));

    const right = [P(0, 0), P(6, 0), P(0, 4)];
    const rect = asParallelogram([...right, ...rotatePoly180(right, P(3, 2))]);
    expect(rect.rect).toBe(true);
    expect(area(rect.poly)).toBe(24);

    expect(asParallelogram([P(0, 0), P(3, 0), P(4, 2), P(0, 1)])).toBeNull();
  });
});

describe('triangle 三角形', () => {
  it('3-4-5 有直角，4-4-4 和 2-5-5 没有', () => {
    expect(isRightTriangle(3, 4, 5)).toBe(true);
    expect(isRightTriangle(5, 3, 4)).toBe(true);
    expect(isRightTriangle(4, 4, 4)).toBe(false);
    expect(isRightTriangle(2, 5, 5)).toBe(false);
    const ang = anglesFromSides(3, 4, 5);
    expect(ang.C).toBeCloseTo(90);
    expect(anglesFromSides(4, 4, 4).A).toBeCloseTo(60);
    expect(anglesFromSides(1, 1, 5)).toBeNull();
    expect(isTriangle(2, 5, 5)).toBe(true);
    expect(isTriangle(1, 5, 6)).toBe(false);
  });
  it('十二结绳只能围出三种整数三角形', () => {
    expect(integerTriangles(12)).toEqual([[2, 5, 5], [3, 4, 5], [4, 4, 4]]);
  });
  it('由三边定顶点，内角加起来 180', () => {
    const p = apexFromSides(5, 3, 4);
    expect(p.x).toBeCloseTo(1.8);
    expect(p.y).toBeCloseTo(2.4);
    const angs = cornerAngles([P(0, 0), P(5, 0), p]);
    expect(angs[2]).toBeCloseTo(90);
    expect(angs.reduce((s, a) => s + a, 0)).toBeCloseTo(180);
    expect(apexFromSides(10, 2, 3)).toBeNull();
  });
});

describe('measure 量', () => {
  it('16 节篱笆：越方越大', () => {
    expect(fixedPerimeterRect(16, 2)).toEqual({ w: 2, d: 6, area: 12 });
    expect(fixedPerimeterRect(16, 3).area).toBe(15);
    expect(bestRect(16)).toEqual({ w: 4, d: 4, area: 16 });
  });
  it('猜得多准、按误差给星、平均', () => {
    expect(guessAccuracy(8, 8)).toBe(1);
    expect(guessAccuracy(6, 8)).toBeCloseTo(0.75);
    expect(guessAccuracy(30, 8)).toBe(0);
    expect(guessAccuracy(0, 0)).toBe(1);
    expect(starsByError(1, 1, 2)).toBe(3);
    expect(starsByError(1.5, 1, 2)).toBe(2);
    expect(starsByError(3, 1, 2)).toBe(1);
    expect(mean([1, 2, 3])).toBe(2);
    expect(mean([])).toBe(0);
  });
});
