// 作用域：收集一个屏幕（地图 / 某一关）里登记的所有东西，离开时一次性清干净。
// 场景物体、拖拽句柄、标签、补间、定时器、每帧回调、等待中的 Promise 都在这里收。
import { disposeTree } from './shared.js';

export class Cancelled extends Error {
  constructor() { super('cancelled'); this.name = 'Cancelled'; }
}

export class Scope {
  /** @param {import('./stage.js').Stage} stage */
  constructor(stage) {
    this.stage = stage;
    this.alive = true;
    /** @type {Set<() => void>} */
    this.disposers = new Set();
    /** @type {Set<(e: Error) => void>} */
    this.rejecters = new Set();
  }

  /** 登记一个清理函数，返回「提前移除这个登记」的函数。 */
  add(fn) {
    if (!this.alive) { try { fn(); } catch { /* 已关闭 */ } return () => {}; }
    this.disposers.add(fn);
    return () => this.disposers.delete(fn);
  }

  /** 定时器（会被自动清掉）。 */
  after(ms, fn) {
    const id = setTimeout(() => { rm(); if (this.alive) fn(); }, ms);
    const rm = this.add(() => clearTimeout(id));
    return () => { clearTimeout(id); rm(); };
  }
  every(ms, fn) {
    const id = setInterval(() => { if (this.alive) fn(); }, ms);
    const rm = this.add(() => clearInterval(id));
    return () => { clearInterval(id); rm(); };
  }
  /** 每帧回调。 */
  onFrame(fn) {
    const off = this.stage.onFrame((dt, t) => { if (this.alive) fn(dt, t); });
    const rm = this.add(off);
    return () => { off(); rm(); };
  }

  /**
   * 可取消的 Promise：离开这一关时自动以 Cancelled 拒绝，后面的代码不会再跑。
   * @template T @param {(resolve: (v: T) => void, reject: (e: any) => void) => void} exec @returns {Promise<T>}
   */
  promise(exec) {
    return new Promise((resolve, reject) => {
      if (!this.alive) { reject(new Cancelled()); return; }
      const rej = (e) => reject(e);
      this.rejecters.add(rej);
      const done = (fn) => (v) => { this.rejecters.delete(rej); if (this.alive) fn(v); };
      try { exec(done(resolve), done(reject)); } catch (e) { this.rejecters.delete(rej); reject(e); }
    });
  }
  /** 等一会儿。 */
  wait(ms) {
    return this.promise((resolve) => { this.after(ms, () => resolve(undefined)); });
  }
  /** 把一个外部 Promise 包成「离开就作废」的。 @template T @param {Promise<T>} p @returns {Promise<T>} */
  guard(p) {
    return this.promise((resolve, reject) => { p.then(resolve, reject); });
  }

  /** 全部清掉。 */
  dispose() {
    if (!this.alive) return;
    this.alive = false;
    for (const fn of [...this.disposers]) { try { fn(); } catch (e) { console.error(e); } }
    this.disposers.clear();
    const err = new Cancelled();
    for (const rej of [...this.rejecters]) rej(err);
    this.rejecters.clear();
    const root = this.stage.root;
    for (const child of [...root.children]) {
      root.remove(child);
      disposeTree(child);
    }
  }
}

/** 吞掉 Cancelled，别的错照常报。 */
export function swallowCancel(e) {
  if (e instanceof Cancelled || e?.name === 'Cancelled') return;
  console.error(e);
}
