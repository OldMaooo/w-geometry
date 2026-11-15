import { describe, it, expect } from 'vitest';
import {
  countBlocks, projections, matchViews, allMatch, totalBlocks, solveProjection, TOWERS,
  foldNet, isFoldable, netOf, NET_ROUNDS, pickBase, swingFrame, unbraced, minBraces, braceCount,
  slopeOf, roofKind, risePer2, goodRidge, pyramidTotal, layerCoords,
} from './math.js';

describe('方块数', () => {
  it('长 × 宽 × 高', () => {
    expect(countBlocks(5, 3, 2)).toBe(30);
    expect(countBlocks(4, 4, 3)).toBe(48);
  });
});

describe('三视图', () => {
  it('L 形台阶的三张影子', () => {
    const p = projections(TOWERS[0]);
    expect(p.front).toEqual([3, 2, 1]);
    expect(p.side).toEqual([3, 2, 0]);
    expect(p.top).toEqual([[0, 0, 0], [1, 0, 0], [1, 1, 1]]);
  });
  it('右面看：左边是近处（z 大）', () => {
    const h = [[0, 0, 0], [0, 0, 0], [5, 0, 0]].map((r) => r.map((v) => Math.min(v, 3)));
    expect(projections(h).side).toEqual([3, 0, 0]);
  });
  it('matchViews：搭对了全绿，只差一面就一面不绿', () => {
    const t = projections(TOWERS[1]);
    expect(allMatch(matchViews(projections(TOWERS[1]), t))).toBe(true);
    const h = TOWERS[1].map((r) => [...r]);
    h[1][1] = 2;
    const m = matchViews(projections(h), t);
    expect(m.front).toBe(false);
    expect(m.top).toBe(true);
  });
  it('前两座只有一种搭法，第三座最少 13 最多 17', () => {
    expect(solveProjection(projections(TOWERS[0])).count).toBe(1);
    expect(solveProjection(projections(TOWERS[0])).min).toBe(8);
    expect(solveProjection(projections(TOWERS[1])).count).toBe(1);
    expect(solveProjection(projections(TOWERS[1])).min).toBe(11);
    const s = solveProjection(projections(TOWERS[2]));
    expect(s.min).toBe(13);
    expect(s.max).toBe(17);
    expect(s.count).toBeGreaterThan(1);
    expect(totalBlocks(s.minGrid)).toBe(13);
    expect(allMatch(matchViews(projections(s.minGrid), projections(TOWERS[2])))).toBe(true);
  });
});

describe('展开图折叠', () => {
  it('十字形能折成', () => {
    expect(isFoldable(netOf(['.X..', 'XXXX', '.X..']))).toBe(true);
  });
  it('一长条折不成：两面叠在一起，另一边露洞', () => {
    const f = foldNet(netOf(['XXXXXX']));
    expect(f.ok).toBe(false);
    expect(f.overlaps).toBeGreaterThan(0);
    expect(f.missing.length).toBeGreaterThan(0);
  });
  it('2×3 田字形折不成', () => {
    expect(isFoldable(netOf(['XXX', 'XXX']))).toBe(false);
  });
  it('一字加两翼同侧折不成，异侧能', () => {
    expect(isFoldable(netOf(['X.X.', 'XXXX']))).toBe(false);
    expect(isFoldable(netOf(['X...', 'XXXX', '..X.']))).toBe(true);
  });
  it('阶梯、三三错开能折成', () => {
    expect(isFoldable(netOf(['XX...', '.XX..', '..XX.']))).toBe(true);
    expect(isFoldable(netOf(['XXX..', '..XXX']))).toBe(true);
  });
  it('不管选哪个格子当箱底，结论一样', () => {
    for (const rows of [['.X..', 'XXXX', '.X..'], ['XXX', 'XXX'], ['XXX..', '..XXX']]) {
      const c = netOf(rows);
      const r = c.map((_, b) => foldNet(c, b).ok);
      expect(new Set(r).size).toBe(1);
    }
  });
  it('关卡里每一张图的答案和折叠结果一致（预期：能 / 不能）', () => {
    const expected = [[true, false, true], [true, false, true], [false, true, false]];
    NET_ROUNDS.forEach((round, i) => round.forEach((rows, j) => {
      expect(isFoldable(netOf(rows))).toBe(expected[i][j]);
    }));
  });
  it('所有 35 种六连方格里，正好 11 种能折成立方体', () => {
    const norm = (cells) => {
      const mc = Math.min(...cells.map((p) => p[0])), mr = Math.min(...cells.map((p) => p[1]));
      return cells.map(([c, r]) => [c - mc, r - mr]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    };
    const variants = (cells) => {
      const out = [];
      let cur = cells;
      for (let f = 0; f < 2; f++) {
        for (let r = 0; r < 4; r++) {
          cur = cur.map(([c, rr]) => [-rr, c]);
          out.push(JSON.stringify(norm(cur)));
        }
        cur = cur.map(([c, rr]) => [-c, rr]);
      }
      return out.sort()[0];
    };
    let level = new Map([[variants([[0, 0]]), [[0, 0]]]]);
    for (let n = 2; n <= 6; n++) {
      const next = new Map();
      for (const cells of level.values()) {
        for (const [c, r] of cells) {
          for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const q = [c + dc, r + dr];
            if (cells.some((p) => p[0] === q[0] && p[1] === q[1])) continue;
            const nc = [...cells, q];
            const key = variants(nc);
            if (!next.has(key)) next.set(key, nc);
          }
        }
      }
      level = next;
    }
    expect(level.size).toBe(35);
    const ok = [...level.values()].filter((c) => isFoldable(c)).length;
    expect(ok).toBe(11);
  });
  it('挑选箱底：邻居最多的格子', () => {
    const c = netOf(['.X.', 'XXX', '.X.', '.X.']);
    expect(c[pickBase(c)]).toEqual([1, 1]);
  });
});

describe('框架', () => {
  const A = { x: 0, z: 0 }, B = { x: 3, z: 0 };
  it('拖左上角，边长不变，右上角跟着平移', () => {
    const r = swingFrame(A, B, 3, { x: 1, z: -2 });
    expect(Math.hypot(r.D.x - A.x, r.D.z - A.z)).toBeCloseTo(3, 6);
    expect(r.C.x - B.x).toBeCloseTo(r.D.x - A.x, 6);
    expect(r.C.z - B.z).toBeCloseTo(r.D.z - A.z, 6);
  });
  it('正上方就是方的（90°），角度可以随手歪', () => {
    expect(swingFrame(A, B, 3, { x: 0, z: -5 }).deg).toBeCloseTo(90, 5);
    expect(swingFrame(A, B, 3, { x: 3, z: -3 }).deg).toBeCloseTo(45, 5);
    expect(swingFrame(A, B, 3, { x: 5, z: 5 }).deg).toBeLessThanOrEqual(158);
  });
});

describe('桥架斜撑', () => {
  it('每个方框各要一根，最少 n 根', () => {
    expect(minBraces(5)).toBe(5);
    expect(unbraced(5, [true, false, true, false, false])).toEqual([1, 3, 4]);
    expect(braceCount([true, false, true])).toBe(2);
    expect(unbraced(3, [true, true, true])).toEqual([]);
  });
});

describe('屋顶坡度', () => {
  it('走 2 步升 1 步 = 0.5，太平漏雨、太陡滑瓦', () => {
    expect(slopeOf(2, 4)).toBe(0.5);
    expect(roofKind(1, 4)).toBe('flat');
    expect(roofKind(1.5, 4)).toBe('flat');
    expect(roofKind(2, 4)).toBe('ok');
    expect(roofKind(2.5, 4)).toBe('ok');
    expect(roofKind(3, 4)).toBe('steep');
    expect(roofKind(4.5, 4)).toBe('steep');
  });
  it('屋宽 12（一侧 6）时，同样的坡屋脊要 3', () => {
    expect(goodRidge(8)).toBe(2);
    expect(goodRidge(12)).toBe(3);
    expect(roofKind(3, 6)).toBe('ok');
    expect(roofKind(2, 6)).toBe('flat');
    expect(roofKind(2, 4)).toBe('ok');
  });
  it('每走 2 步升多少', () => {
    expect(risePer2(2, 4)).toBe(1);
    expect(risePer2(3, 6)).toBe(1);
    expect(risePer2(3, 4)).toBe(1.5);
  });
});

describe('金字塔', () => {
  it('1+4+9+16 = 30，再加一层多 25', () => {
    expect(pyramidTotal(4)).toBe(30);
    expect(pyramidTotal(5) - pyramidTotal(4)).toBe(25);
  });
  it('每层格子中心：奇数层落在整数上，偶数层在半格上', () => {
    expect(layerCoords(4)).toEqual([-1.5, -0.5, 0.5, 1.5]);
    expect(layerCoords(3)).toEqual([-1, 0, 1]);
    expect(layerCoords(1)).toEqual([0]);
  });
});
