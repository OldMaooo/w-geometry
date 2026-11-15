// 第 1 章共用的小工具：铺草垫、数一数、拆物体、颜色。只给本章用。
import * as THREE from 'three';
import { disposeTree } from '../../engine/shared.js';

export const C = {
  soilBed: '#B98E57',
  shadow: '#9FD08A',
  piece: '#C79B5E',
  tri: '#BF9257',
};

/** 世界坐标点 {x,z} ↔ 几何点 {x,y}（y 就用 z，算面积 / 切割不受影响）。 */
export const toG = (p) => ({ x: p.x, y: p.z });
export const toW = (p) => ({ x: p.x, z: p.y });

/** 拆掉一个物体（并释放它的几何体）。 */
export function removeObj(obj) {
  if (!obj) return;
  obj.removeFromParent();
  disposeTree(obj);
}

/** 朝镜头方向（z+）一点点的位置，给标签用。 */
export const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

/**
 * 在长方形区域里一行一行铺满草垫（从上往下、从左往右），每块「嗒」一声。
 * rect: { x, z, w, d } 左上角 + 宽高（整数）。skip(i,j) 返回 true 的格子跳过（已铺过）。
 * 返回新铺的草垫物体数组。
 * @param {any} ctx
 * @param {{x:number,z:number,w:number,d:number}} rect
 * @param {{ skip?: (i:number,j:number)=>boolean, step?: number, from?: {x:number,z:number}, onEach?: (n:number)=>void }} [o]
 */
export async function layMats(ctx, rect, o = {}) {
  const step = o.step ?? 70;
  const mats = [];
  let n = 0;
  const jobs = [];
  for (let j = 0; j < rect.d; j++) {
    for (let i = 0; i < rect.w; i++) {
      if (o.skip?.(i, j)) continue;
      const m = ctx.props.mat({ x: rect.x + i + 0.5, z: rect.z + j + 0.5 });
      m.visible = false;
      mats.push(m);
      const k = n++;
      jobs.push(ctx.wait(k * step).then(async () => {
        m.visible = true;
        if (o.from) {
          const tx = m.position.x, tz = m.position.z;
          m.position.set(o.from.x, 1.2, o.from.z);
          await ctx.fx.tween({
            duration: 260, ease: 'out',
            onUpdate: (e) => {
              m.position.x = o.from.x + (tx - o.from.x) * e;
              m.position.z = o.from.z + (tz - o.from.z) * e;
              m.position.y = 0.075 + Math.sin(e * Math.PI) * 1.2 * (1 - e) + (1 - e) * 0.2;
            },
          });
          m.position.y = 0.075;
        } else {
          ctx.fx.pop(m, { duration: 260 });
        }
        ctx.audio.play('place');
        o.onEach?.(k + 1);
      }));
    }
  }
  await Promise.all(jobs);
  return mats;
}

/**
 * 数一数：沿第一行标 1…w，沿第一列标 1…d，最后报「w 个一行，d 行，N 块」。
 * 返回那句话。标签会留一会儿再收。
 * @param {any} ctx @param {{x:number,z:number,w:number,d:number}} rect @param {{ unit?: string, keep?: boolean }} [o]
 */
export async function countOut(ctx, rect, o = {}) {
  const unit = o.unit ?? '块';
  const tmp = [];
  for (let i = 0; i < rect.w; i++) {
    tmp.push(ctx.labels.add(v3(rect.x + i + 0.5, 0.3, rect.z - 0.35), i + 1, { cls: 'num lit' }));
    ctx.audio.play('count', { n: i });
    await ctx.wait(170);
  }
  await ctx.wait(250);
  for (let j = 0; j < rect.d; j++) {
    tmp.push(ctx.labels.add(v3(rect.x - 0.55, 0.3, rect.z + j + 0.8), j + 1, { cls: 'num ok' }));
    ctx.audio.play('count', { n: j + 2 });
    await ctx.wait(220);
  }
  const total = rect.w * rect.d;
  const line = `${rect.w} 个一行，${rect.d} 行，${total} ${unit}`;
  const big = ctx.labels.add(v3(rect.x + rect.w / 2, 0.4, rect.z + rect.d / 2 + 0.3), `${total}<small>${unit}</small>`, { cls: 'big' });
  ctx.say(line);
  await ctx.wait(1700);
  tmp.forEach((l) => l.remove());
  if (!o.keep) big.remove();
  return { line, big, total };
}
