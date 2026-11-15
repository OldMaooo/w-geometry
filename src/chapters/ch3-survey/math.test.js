import { describe, it, expect } from 'vitest';
import {
  elevOf, ratioOf, shadowLen, sForRatio, shadowDir, magnetS, magnetTargets, sunVec, showNum,
  distToLine, collinear, lineZAtX, riverD, sightY, mountainHeight, factorFor,
  L_POLY, scalePoly, edgeLens, cellsIn, blockOf,
} from './math.js';

describe('太阳与影长', () => {
  it('正午最高、早晚最低', () => {
    expect(elevOf(0.5)).toBeGreaterThan(elevOf(0.2));
    expect(elevOf(0)).toBeCloseTo(elevOf(1), 6);
  });
  it('影长 = 竿高 × 影长比，同一时刻成比例', () => {
    const s = 0.3;
    expect(shadowLen(3, s)).toBeCloseTo(3 * shadowLen(1, s), 9);
    expect(shadowLen(2, s)).toBeCloseTo(2 * ratioOf(s), 9);
  });
  it('sForRatio 反推：影长比 2 / 1 / 1.5，上午下午各一个', () => {
    for (const r of [0.5, 1, 1.5, 2, 3]) {
      for (const side of ['am', 'pm']) {
        const s = sForRatio(r, side);
        expect(ratioOf(s)).toBeCloseTo(r, 6);
      }
      expect(sForRatio(r, 'am')).toBeLessThan(0.5);
      expect(sForRatio(r, 'pm')).toBeGreaterThan(0.5);
    }
  });
  it('太阳够不着的影长比返回 null', () => {
    expect(sForRatio(10)).toBeNull();
    expect(sForRatio(0.1)).toBeNull();
  });
  it('影子方向是单位向量，正午正对镜头', () => {
    for (const s of [0, 0.2, 0.5, 0.9]) {
      const d = shadowDir(s);
      expect(Math.hypot(d.x, d.z)).toBeCloseTo(1, 9);
    }
    expect(shadowDir(0.5).x).toBeCloseTo(0, 9);
    expect(shadowDir(0.1).x).toBeGreaterThan(0);
    expect(shadowDir(0.9).x).toBeLessThan(0);
  });
  it('太阳方向和影子方向相反，且是单位向量', () => {
    const v = sunVec(0.3);
    const d = shadowDir(0.3);
    expect(Math.hypot(v.x, v.y, v.z)).toBeCloseTo(1, 9);
    expect(v.x * d.x + v.z * d.z).toBeLessThan(0);
  });
  it('磁吸只在范围内起作用', () => {
    const t = magnetTargets([1, 2]);
    const s1 = sForRatio(1);
    expect(magnetS(s1 + 0.005, t)).toBeCloseTo(s1, 9);
    expect(magnetS(s1 + 0.05, t)).toBeCloseTo(s1 + 0.05, 9);
  });
  it('showNum 去掉多余的 .0', () => {
    expect(showNum(6)).toBe('6');
    expect(showNum(1.5)).toBe('1.5');
    expect(showNum(5.9999999)).toBe('6');
  });
});

describe('三点一线、量河宽', () => {
  it('点到直线距离', () => {
    expect(distToLine({ x: 1, z: 1 }, { x: 0, z: 0 }, { x: 2, z: 0 })).toBeCloseTo(1, 9);
  });
  it('河宽 7、AB=BC=3：D 在 (6, 7)，T-B-D 三点一线', () => {
    const W = 7, b = 3;
    const T = { x: 0, z: -W }, B = { x: b, z: 0 };
    const D = riverD(W, b);
    expect(collinear(T, B, D)).toBe(true);
    expect(lineZAtX(T, B, D.x)).toBeCloseTo(D.z, 9);
    expect(collinear(T, B, { x: D.x, z: D.z - 1 }, 0.05)).toBe(false);
  });
  it('不管 b 取几，CD 都等于河宽（两个三角形全等）', () => {
    for (const b of [2, 3, 4, 5]) for (const W of [5, 7, 8]) {
      const D = riverD(W, b);
      expect(D.z - 0).toBe(W);
      expect(collinear({ x: 0, z: -W }, { x: b, z: 0 }, D)).toBe(true);
    }
  });
});

describe('隔海望山', () => {
  it('竿 3、退 2 和 4、两竿相距 8：山高 15', () => {
    expect(mountainHeight(3, 2, 4, 8)).toBe(15);
  });
  it('视线真的落在山顶上', () => {
    // 竿1 在 x=0，退 2；竿2 在 x=-8，退 4；山顶 (8, 15)
    expect(sightY(-2, 0, 3, 8)).toBeCloseTo(15, 9);
    expect(sightY(-12, -8, 3, 8)).toBeCloseTo(15, 9);
    expect(sightY(-1, 0, 3, 8)).toBeGreaterThan(15);
    expect(sightY(-3, 0, 3, 8)).toBeLessThan(15);
  });
  it('换一组数也一致', () => {
    const h = 3, a1 = 3, d = 6, a2 = 5; // x1/a1 = k-1 → 山高 = h + h*d/(a2-a1) = 12
    const H = mountainHeight(h, a1, a2, d);
    expect(H).toBe(12);
    const x1 = (H / h - 1) * a1;
    expect(sightY(-a1, 0, h, x1)).toBeCloseTo(H, 9);
    expect(sightY(-d - a2, -d, h, x1)).toBeCloseTo(H, 9);
  });
  it('差值三角形放大 5 倍：底 2 → 两桩相距 10，高 3 → 15', () => {
    const k = factorFor(2, 10);
    expect(k).toBe(5);
    expect(3 * k).toBe(mountainHeight(3, 2, 4, 8));
  });
});

describe('放大图纸', () => {
  it('L 形 6 格，放大 2 倍 24 格，3 倍 54 格', () => {
    expect(cellsIn(L_POLY).length).toBe(6);
    expect(cellsIn(scalePoly(L_POLY, 2)).length).toBe(24);
    expect(cellsIn(scalePoly(L_POLY, 3)).length).toBe(54);
  });
  it('边长也跟着放大', () => {
    expect(edgeLens(L_POLY)).toEqual([4, 1, 3, 2, 1, 3]);
    expect(edgeLens(scalePoly(L_POLY, 2))).toEqual([8, 2, 6, 4, 2, 6]);
  });
  it('每一格放大 k 倍变成 k×k 小格，6 格正好铺满放大后的 L', () => {
    for (const k of [2, 3]) {
      const all = cellsIn(L_POLY).flatMap((c) => blockOf(c, k));
      const key = (c) => c.join(',');
      const want = new Set(cellsIn(scalePoly(L_POLY, k)).map(key));
      expect(all.length).toBe(want.size);
      expect(new Set(all.map(key))).toEqual(want);
    }
  });
});
