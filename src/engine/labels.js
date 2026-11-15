// 贴在 3D 物体上的文字标签（DOM 层，每帧跟着物体走）。
import * as THREE from 'three';

/**
 * @typedef {object} LabelOpts
 * @property {string} [cls]   额外样式：'num'（数字泡泡，默认）| 'tag'（名字条）| 'say'（说话气泡）| 'big'（大数字）| 'soft'（淡）
 * @property {number} [dy]    往上抬多少（世界单位）
 * @property {() => void} [onTap]  可点（会有按下反馈）
 * @property {boolean} [pop]  出现时弹一下（默认 true）
 */

/**
 * @param {import('./stage.js').Stage} stage
 * @param {HTMLElement} layer
 */
export function createLabels(stage, layer) {
  /** @type {Set<Label>} */
  const all = new Set();
  const tmp = new THREE.Vector3();

  class Label {
    /** @param {THREE.Object3D | THREE.Vector3} target @param {string} text @param {LabelOpts} opts */
    constructor(target, text, opts) {
      this.target = target;
      this.opts = opts;
      this.el = document.createElement(opts.onTap ? 'button' : 'div');
      const [kind, ...extra] = (opts.cls || 'num').split(/\s+/);
      this.el.className = `lbl lbl-${kind} ${extra.join(' ')}${opts.pop === false ? '' : ' lbl-pop'}`;
      if (opts.onTap) {
        this.el.classList.add('lbl-tap');
        this.el.addEventListener('click', (e) => { e.stopPropagation(); opts.onTap?.(); });
      }
      this.set(text);
      this.visible = true;
      layer.appendChild(this.el);
    }
    /** 改文字（可以是 HTML 片段，只给引擎内部可信内容用）。 */
    set(text) {
      if (this._text === text) return this;
      this._text = text;
      this.el.innerHTML = String(text);
      return this;
    }
    show(on = true) { this.visible = on; this.el.style.display = on ? '' : 'none'; return this; }
    /** 换个类名（比如亮起来）。 */
    cls(name, on = true) { this.el.classList.toggle(name, on); return this; }
    remove() { this.el.remove(); all.delete(this); }
  }

  stage.onFrame(() => {
    const { w, h } = stage.size();
    for (const l of all) {
      if (!l.visible) continue;
      if (l.target instanceof THREE.Vector3) tmp.copy(l.target);
      else {
        if (!l.target.parent) { l.el.style.display = 'none'; continue; }
        l.target.getWorldPosition(tmp);
      }
      tmp.y += l.opts.dy ?? 0;
      tmp.project(stage.camera);
      if (tmp.z > 1) { l.el.style.display = 'none'; continue; }
      l.el.style.display = '';
      const x = ((tmp.x + 1) / 2) * w;
      const y = ((1 - tmp.y) / 2) * h;
      l.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
    }
  });

  return {
    /**
     * 加一个标签。target 是物体（跟着走）或固定点。
     * @param {THREE.Object3D | THREE.Vector3} target @param {string|number} text @param {LabelOpts} [opts]
     */
    add(target, text, opts = {}) {
      const l = new Label(target, String(text), opts);
      all.add(l);
      return l;
    },
    clear() { [...all].forEach((l) => l.remove()); },
    count: () => all.size,
  };
}
