// 和「量」有关的小算术：周长锁定的长方形、猜得多准、按误差给星。

/**
 * 周长固定时，宽为 w 的长方形另一边和面积。
 * @param {number} perimeter @param {number} w
 */
export function fixedPerimeterRect(perimeter, w) {
  const d = perimeter / 2 - w;
  return { w, d, area: w * Math.max(0, d) };
}

/** 周长固定、边长取整数时，面积最大的长方形。 @param {number} perimeter */
export function bestRect(perimeter) {
  let best = fixedPerimeterRect(perimeter, 1);
  for (let w = 1; w < perimeter / 2; w++) {
    const r = fixedPerimeterRect(perimeter, w);
    if (r.area > best.area) best = r;
  }
  return best;
}

/**
 * 猜得多准：0–1。猜中 = 1，差得和实际一样多 = 0。
 * @param {number} guess @param {number} actual
 */
export function guessAccuracy(guess, actual) {
  if (!actual) return guess === actual ? 1 : 0;
  return Math.max(0, 1 - Math.abs(guess - actual) / Math.abs(actual));
}

/**
 * 按误差档位给星：误差 ≤ t3 给 3 星，≤ t2 给 2 星，否则 1 星。
 * @param {number} err @param {number} t3 @param {number} t2
 */
export function starsByError(err, t3, t2) {
  if (err <= t3 + 1e-9) return 3;
  if (err <= t2 + 1e-9) return 2;
  return 1;
}

/** 平均数（空数组为 0）。 @param {number[]} xs */
export const mean = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
