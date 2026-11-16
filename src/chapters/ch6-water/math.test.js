import { describe, it, expect } from 'vitest';
import {
  drops, simulateSlope, slopeStars, levelSide, polylineLength, segHitsRect, pathHitsRect, shortestAround,
  fermatPoint, treeLength, dist, mirror, walkLen, mirrorBest, trapArea, effectiveSection,
  widthsFromCuts, fillLevels, isFair, shareWidths, triArea, paraArea,
} from './math.js';

describe('6-1 逐段流水', () => {
  it('一级一级降 1 尺：水到，3 星', () => {
    const n = [10, 9, 8, 7, 6, 5, 4, 3, 2];
    expect(drops(n)).toEqual([1, 1, 1, 1, 1, 1, 1, 1]);
    expect(simulateSlope(n).kind).toBe('ok');
    expect(slopeStars(n)).toBe(3);
  });
  it('遇到高的就停在上坡那一段', () => {
    expect(simulateSlope([10, 9, 9, 10, 6, 5, 5, 4, 2])).toEqual({ kind: 'blocked', seg: 2 });
  });
  it('一段降超过 2 尺冲坏', () => {
    expect(simulateSlope([10, 9, 9, 6, 5, 4, 3, 3, 2])).toEqual({ kind: 'burst', seg: 2 });
  });
  it('有平段但水到了：2 星；没到 0 星', () => {
    expect(slopeStars([10, 9, 9, 8, 7, 6, 5, 4, 2])).toBe(2);
    expect(slopeStars([10, 11, 9, 8, 7, 6, 5, 4, 2])).toBe(0);
  });
  it('一次降 2 尺不算冲坏', () => {
    expect(simulateSlope([10, 8, 6, 4, 3, 3, 3, 3, 2]).kind).toBe('ok');
  });
  it('水准器：气泡朝高的一头', () => {
    expect(levelSide(5, 3)).toBe(-1);
    expect(levelSide(3, 5)).toBe(1);
    expect(levelSide(4, 4)).toBe(0);
  });
});

describe('6-2 最短的渠', () => {
  it('折线总长', () => {
    expect(polylineLength([{ x: 0, z: 0 }, { x: 3, z: 0 }, { x: 3, z: 4 }])).toBeCloseTo(7, 9);
  });
  it('线段穿山 / 绕山', () => {
    const r = { x0: -3, x1: 3, z0: -5, z1: 2 };
    expect(segHitsRect({ x: -9, z: 0 }, { x: 9, z: 0 }, r)).toBe(true);
    expect(segHitsRect({ x: -9, z: 3 }, { x: 9, z: 3 }, r)).toBe(false);
    // 贴着山边走不算穿
    expect(segHitsRect({ x: -9, z: 2 }, { x: 9, z: 2 }, r)).toBe(false);
    expect(pathHitsRect([{ x: -9, z: 0 }, { x: -3.3, z: 2.3 }, { x: 3.3, z: 2.3 }, { x: 9, z: 0 }], r)).toBe(false);
  });
  it('绕山最短路：从下沿绕比从上沿绕短', () => {
    const r = { x0: -3, x1: 3, z0: -5, z1: 2 };
    const s = shortestAround({ x: -9, z: 0 }, { x: 9, z: 0 }, r, 0.3);
    // -9,0 → -3.3,2.3 → 3.3,2.3 → 9,0
    const want = 2 * Math.hypot(5.7, 2.3) + 6.6;
    expect(s.length).toBeCloseTo(want, 6);
    expect(s.route.every((p) => p.z >= 0)).toBe(true);
    expect(s.route.length).toBe(4);
  });
  it('没有山挡着，最短路就是直线', () => {
    const s = shortestAround({ x: -9, z: 8 }, { x: 9, z: 8 }, { x0: -3, x1: 3, z0: -5, z1: 2 });
    expect(s.length).toBeCloseTo(18, 9);
  });
  it('两个村：费马点在对称轴上，总长 ≈ 25.39', () => {
    const A = { x: -9, z: 0 }, V1 = { x: 6, z: -6 }, V2 = { x: 6, z: 6 };
    const J = fermatPoint([A, V1, V2]);
    expect(J.z).toBeCloseTo(0, 6);
    expect(J.x).toBeCloseTo(6 - 6 / Math.sqrt(3), 5);
    expect(treeLength(A, J, [V1, V2])).toBeCloseTo(11.536 + 2 * Math.sqrt(48), 2);
    // 拖到别处都更长
    for (const q of [{ x: 0, z: 0 }, { x: 5, z: 3 }, { x: -3, z: -2 }]) {
      expect(treeLength(A, q, [V1, V2])).toBeGreaterThan(treeLength(A, J, [V1, V2]));
    }
  });
});

describe('6-3 镜子里的最短路', () => {
  const V = { x: -6, z: 4 }, F = { x: 6, z: 2 };
  it('镜像把田映到河对岸', () => {
    expect(mirror(F)).toEqual({ x: 6, z: -2 });
  });
  it('最好的饮水点在 x = 2，总路程等于 V 到影子田的直线', () => {
    const m = mirrorBest(V, F);
    expect(m.D.x).toBeCloseTo(2, 9);
    expect(m.D.z).toBe(0);
    expect(m.length).toBeCloseTo(Math.hypot(12, 6), 9);
    expect(walkLen(V, m.D, F)).toBeCloseTo(m.length, 9);
  });
  it('河岸上别的点走得更远', () => {
    const best = walkLen(V, mirrorBest(V, F).D, F);
    for (let x = -10; x <= 10; x += 0.5) {
      if (Math.abs(x - 2) < 1e-9) continue;
      expect(walkLen(V, { x, z: 0 }, F)).toBeGreaterThan(best);
    }
  });
  it('第二组位置', () => {
    const m = mirrorBest({ x: -7, z: 3 }, { x: 5, z: 6 });
    expect(m.D.x).toBeCloseTo(-3, 9);
    expect(m.length).toBeCloseTo(15, 9);
    expect(dist({ x: -7, z: 3 }, m.D) + dist(m.D, { x: 5, z: 6 })).toBeCloseTo(15, 9);
  });
});

describe('6-4 渠的截面', () => {
  it('梯形格数：口 6 底 2 深 3 = 12', () => {
    expect(trapArea({ b: 2, t: 6, d: 3 })).toBe(12);
  });
  it('方渠 4×3 = 12', () => {
    expect(trapArea({ b: 4, t: 4, d: 3 })).toBe(12);
  });
  it('坡够斜不垮', () => {
    const e = effectiveSection({ b: 4, t: 8, d: 2 });
    expect(e.collapsed).toBe(false);
    expect(trapArea(e)).toBe(12);
  });
  it('坡不够斜：土垮进渠里，格数变少', () => {
    const e = effectiveSection({ b: 4, t: 4, d: 3 }, 0.5);
    expect(e.collapsed).toBe(true);
    expect(e.b).toBeCloseTo(1, 9);
    expect(trapArea(e)).toBeLessThan(12);
  });
  it('刚好 1:2 的坡不垮', () => {
    expect(effectiveSection({ b: 5, t: 7, d: 2 }).collapsed).toBe(false);
    expect(effectiveSection({ b: 1, t: 5, d: 4 }).collapsed).toBe(false);
  });
  it('垮到底宽为 0 就停在三角', () => {
    expect(effectiveSection({ b: 2, t: 2, d: 6 }).b).toBe(0);
  });
});

describe('6-5 按比例分水', () => {
  it('鱼嘴位置 → 各渠宽', () => {
    expect(widthsFromCuts([2], 6)).toEqual([2, 4]);
    expect(widthsFromCuts([1, 3], 6)).toEqual([1, 2, 3]);
  });
  it('田 1:2，渠宽 2:4 → 同时浇透', () => {
    const l = fillLevels([2, 4], [12, 24]);
    expect(l[0]).toBeCloseTo(1, 9);
    expect(l[1]).toBeCloseTo(1, 9);
    expect(isFair(l)).toBe(true);
  });
  it('对半分：大田渴着、小田淹了', () => {
    const l = fillLevels([3, 3], [12, 24]);
    expect(l[0]).toBeGreaterThan(1.4);
    expect(l[1]).toBeLessThan(0.8);
    expect(isFair(l)).toBe(false);
  });
  it('三个村 1:2:3', () => {
    expect(isFair(fillLevels([1, 2, 3], [6, 12, 18]))).toBe(true);
    expect(isFair(fillLevels([2, 2, 2], [6, 12, 18]))).toBe(false);
  });
  it('按面积比分宽', () => {
    expect(shareWidths([6, 12, 18], 6)).toEqual([1, 2, 3]);
  });
});

describe('6-6 三块田的面积', () => {
  it('长方 3×4、三角 底 3 高 4、斜田 底 6 高 3', () => {
    expect(3 * 4).toBe(12);
    expect(triArea(3, 4)).toBe(6);
    expect(paraArea(6, 3)).toBe(18);
    expect(shareWidths([12, 6, 18], 6)).toEqual([2, 1, 3]);
  });
});
