// 调试入口：window.__geo（goto / complete / solve / state …）和 ?debug=1 小面板。
import { findLevel, chapters } from './registry.js';
import { h } from './dom.js';

/**
 * @param {any} E @param {ReturnType<import('./level.js').createLevelRunner>} levels @param {any} world
 */
export function installDebug(E, levels, world) {
  const api = {
    /** 进某一关（或 'map' 回地图）。 */
    goto(id) {
      if (id === 'map') { world.show(); return true; }
      const lv = findLevel(id);
      if (!lv) { console.warn('没有这一关', id); return false; }
      levels.start(lv);
      return true;
    },
    /** 强制过关（走正常结算）。 */
    complete: (stars = 3) => levels.complete(stars),
    /** 自动玩完这一关（和提示第三档「自动演示」同一套代码）。返回 Promise<是否过关>。 */
    solve: () => levels.solve(),
    /** 当前关卡状态。 */
    get state() {
      const c = levels.ctx;
      return c ? { level: c.id, done: c.done, hintsUsed: c.hintsUsed, hint: c._hint?.text || null, ...c.state } : { level: null, screen: 'map' };
    },
    /** 所有关卡 id。 */
    levels: () => chapters.flatMap((c) => c.levels.map((l) => l.id)),
    save: () => E.progress.raw(),
    saveBytes: () => E.progress.bytes(),
    resetSave: () => { E.progress.reset(); world.show(); },
    /** 泄漏检查：场景物体数、拖拽句柄、标签、补间。 */
    stats: () => ({
      objects: countObjects(E.stage.root),
      handles: E.pointer.count(),
      labels: E.labels.count(),
      tweens: E.fx.count(),
      calls: E.stage.renderer.info.render.calls,
      triangles: E.stage.renderer.info.render.triangles,
      geometries: E.stage.renderer.info.memory.geometries,
      textures: E.stage.renderer.info.memory.textures,
    }),
    E,
  };
  /** @type {any} */ (window).__geo = api;

  if (new URLSearchParams(location.search).get('debug') === '1') {
    const fps = h('span', {}, '');
    const sel = h('select', {}, api.levels().map((id) => h('option', { value: id }, id)));
    const panel = h('div.debug', {}, [
      fps,
      sel,
      h('button', { onclick: () => api.goto(sel.value) }, '进关'),
      h('button', { onclick: () => api.solve() }, 'solve'),
      h('button', { onclick: () => api.complete() }, 'complete'),
      h('button', { onclick: () => api.goto('map') }, '地图'),
      h('button', { onclick: () => console.log(api.stats()) }, 'stats'),
    ]);
    document.body.appendChild(panel);
    let n = 0, t0 = performance.now();
    E.stage.onFrame(() => {
      n++;
      const now = performance.now();
      if (now - t0 > 500) { fps.textContent = `${Math.round((n * 1000) / (now - t0))} fps · ${E.stage.renderer.info.render.triangles} tri`; n = 0; t0 = now; }
    });
  }
  return api;
}

function countObjects(root) {
  let n = 0;
  root.traverse(() => n++);
  return n - 1;
}
