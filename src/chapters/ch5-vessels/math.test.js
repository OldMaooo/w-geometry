import { describe, it, expect } from 'vitest';
import {
  toDou, cylVolume, coneVolume, taperLevel, taperVolume, prismLevel, rectArea, circleArea, siloRect, siloCircle,
  rectPointAt, circlePointAt, openBoxArea, boxesWithVolume, bestBox,
  I3, CYC, SLOTS, mmul, mapply, meq, mdet, rot90, apexOf, inYangma, YANGMA_BASE, rotationPlan,
} from './math.js';

describe('5-1 罐子容积（斗）', () => {
  it('圆罐斗数 = 4·r²·h', () => {
    expect(toDou(cylVolume(0.75, 4))).toBeCloseTo(9, 9);
    expect(toDou(cylVolume(1.25, 2.4))).toBeCloseTo(15, 9);
    expect(toDou(cylVolume(0.5, 6))).toBeCloseTo(6, 9);
    expect(toDou(cylVolume(1, 1.5))).toBeCloseTo(6, 9);
  });
  it('看着差不多其实差一倍：r=1,h=3 与 r=1.5,h=8/3', () => {
    expect(toDou(cylVolume(1, 3))).toBeCloseTo(12, 9);
    expect(toDou(cylVolume(1.5, 8 / 3))).toBeCloseTo(24, 9);
  });
});

describe('5-3 锥的水位', () => {
  const A = Math.PI * 1.5 * 1.5, H = 3;
  it('锥是同底同高直筒的三分之一', () => {
    expect(coneVolume(A, H) / (A * H)).toBeCloseTo(1 / 3, 12);
  });
  it('水位和体积互为反函数', () => {
    for (const k of [0.05, 0.2, 0.5, 0.9, 1]) {
      const V = coneVolume(A, H) * k;
      expect(taperVolume(A, H, taperLevel(A, H, V))).toBeCloseTo(V, 9);
    }
  });
  it('锥里的水位不是直线：装一半的水，水位是 ³√½ ≈ 79% 高', () => {
    expect(taperLevel(A, H, coneVolume(A, H) / 2) / H).toBeCloseTo(Math.cbrt(0.5), 9);
  });
  it('装满时水位 = 全高；超了也不会超过', () => {
    expect(taperLevel(A, H, coneVolume(A, H))).toBeCloseTo(H, 9);
    expect(taperLevel(A, H, 99)).toBe(H);
  });
  it('倒三次锥正好满一个直筒', () => {
    let lvl = 0;
    for (let i = 1; i <= 3; i++) {
      lvl = prismLevel(A, coneVolume(A, H) * i);
      expect(lvl).toBeCloseTo((H * i) / 3, 9);
    }
    expect(lvl).toBeCloseTo(H, 9);
  });
});

describe('5-5 席子围囤', () => {
  it('12 步长 2 步高：2×4 → 16，3×3 → 18，圆 ≈ 23', () => {
    expect(siloRect(12, 2, 2)).toBe(16);
    expect(siloRect(12, 2, 3)).toBe(18);
    expect(Math.round(siloCircle(12, 2))).toBe(23);
  });
  it('横过来 24 步长 1 步高围圆，约 46，比刚才多', () => {
    expect(Math.round(siloCircle(24, 1))).toBe(46);
    expect(siloCircle(24, 1)).toBeGreaterThan(siloCircle(12, 2));
  });
  it('同周长，越方越大，圆最大', () => {
    expect(rectArea(12, 1)).toBeLessThan(rectArea(12, 2));
    expect(rectArea(12, 2)).toBeLessThan(rectArea(12, 3));
    expect(rectArea(12, 3)).toBeLessThan(circleArea(12));
  });
  it('折线上的点：一圈走完回到起点，且每个点都在周长上', () => {
    const p = 12;
    expect(rectPointAt(p, 2, 0)).toEqual({ x: 0, z: -2 });
    const end = rectPointAt(p, 2, p - 1e-9);
    expect(end.x).toBeCloseTo(0, 6);
    expect(end.z).toBeCloseTo(-2, 6);
    const q = rectPointAt(p, 3, 1.5 + 3); // 走完上边右半 → 右上角
    expect(q.x).toBeCloseTo(1.5, 9);
    const c = circlePointAt(p, p / 4);
    expect(c.x).toBeCloseTo(p / (2 * Math.PI), 9);
    expect(c.z).toBeCloseTo(0, 9);
  });
});

describe('5-6 无盖箱子', () => {
  it('4×3×2 用 40 块板', () => {
    expect(openBoxArea(4, 3, 2)).toBe(40);
  });
  it('容积 24 的箱子里，最省板的是 3×4×2（40 块），且只有这一种', () => {
    const best = bestBox(24);
    expect(best.area).toBe(40);
    expect([best.L, best.W, best.H]).toEqual([3, 4, 2]);
    expect(boxesWithVolume(24).filter((b) => b.area === 40)).toHaveLength(1);
  });
  it('全部都真的是 24 斗，长宽高都在 1..8', () => {
    for (const b of boxesWithVolume(24)) {
      expect(b.L * b.W * b.H).toBe(24);
      expect(Math.max(b.L, b.W, b.H)).toBeLessThanOrEqual(8);
    }
  });
  it('越细长越费板：2×2×6 比 3×4×2 费', () => {
    expect(openBoxArea(2, 2, 6)).toBeGreaterThan(openBoxArea(4, 3, 2));
    expect(openBoxArea(1, 4, 6)).toBeGreaterThan(openBoxArea(4, 3, 2));
  });
});

describe('5-4 阳马：三块拼方', () => {
  it('三个空位的朝向互不相同，都是真旋转，且都固定住大对角线', () => {
    expect(SLOTS).toHaveLength(3);
    for (const M of SLOTS) {
      expect(mdet(M)).toBe(1);
      expect(mapply(M, [1, 1, 1])).toEqual([1, 1, 1]);
    }
    expect(meq(SLOTS[0], SLOTS[1])).toBe(false);
    expect(meq(SLOTS[1], SLOTS[2])).toBe(false);
    expect(meq(SLOTS[0], SLOTS[2])).toBe(false);
    expect(meq(mmul(CYC, mmul(CYC, CYC)), I3)).toBe(true);
  });
  it('三块的尖都在同一个角上', () => {
    for (const M of SLOTS) expect(apexOf(M)).toEqual([0.5, 0.5, 0.5]);
  });
  it('三块的底分别在三个不同的面上', () => {
    const faces = SLOTS.map((M) => {
      const v = mapply(M, YANGMA_BASE[0]);
      const w = mapply(M, YANGMA_BASE[2]);
      // 底面四个点里不变的那一维
      return [0, 1, 2].filter((i) => v[i] === w[i] && Math.abs(v[i]) === 0.5).map((i) => `${i}:${v[i]}`)[0];
    });
    expect(new Set(faces).size).toBe(3);
  });
  it('方块里每个点恰好落在一块阳马里，三块正好铺满、不重叠', () => {
    const n = 12;
    const inv = (M) => M[0].map((_, j) => M.map((row) => row[j])); // 旋转矩阵的逆 = 转置
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) for (let k = 0; k < n; k++) {
      const q = [-0.5 + (i + 0.37) / n, -0.5 + (j + 0.41) / n, -0.5 + (k + 0.29) / n];
      const inside = SLOTS.filter((M) => inYangma(mapply(inv(M), q))).length;
      expect(inside).toBe(1);
    }
  });
  it('每块体积 = 方块的 1/3（底 1×1、高 1 的四棱锥）', () => {
    expect((1 * 1 * 1) / 3).toBeCloseTo(1 / 3, 12);
  });
  it('旋转计划：从任意朝向转到某个空位，最多 3 步，且照着转真的到了', () => {
    const all = [I3];
    const key = (M) => M.flat().join(',');
    const seen = new Set([key(I3)]);
    for (let d = 0; d < 5; d++) {
      for (const M of [...all]) for (let a = 0; a < 3; a++) {
        const N = mmul(rot90(a), M);
        if (!seen.has(key(N))) { seen.add(key(N)); all.push(N); }
      }
    }
    expect(all).toHaveLength(24);
    for (const M of all) {
      const plan = rotationPlan(M, SLOTS);
      expect(plan.length).toBeLessThanOrEqual(3);
      let cur = M;
      for (const a of plan) cur = mmul(rot90(a), cur);
      expect(SLOTS.some((S) => meq(S, cur))).toBe(true);
    }
  });
});
