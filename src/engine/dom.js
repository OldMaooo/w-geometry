// 极简 DOM 小工具（不用 UI 框架）。
import { icon } from './icons.js';

/**
 * 建一个元素。h('button.btn.primary', { onclick }, [icon('play'), '开始'])
 * @param {string} tag 'div.a.b#id'
 * @param {Record<string, any>} [attrs]
 * @param {(Node|string|null|undefined|false)[] | Node | string} [kids]
 * @returns {HTMLElement}
 */
export function h(tag, attrs = {}, kids = []) {
  const [, name = 'div', rest = ''] = tag.match(/^([a-z0-9]*)(.*)$/i) || [];
  const el = document.createElement(name || 'div');
  for (const part of rest.match(/[.#][^.#]+/g) || []) {
    if (part[0] === '.') el.classList.add(part.slice(1));
    else el.id = part.slice(1);
  }
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  const list = Array.isArray(kids) ? kids : [kids];
  for (const kid of list) {
    if (kid === null || kid === undefined || kid === false) continue;
    el.append(typeof kid === 'string' ? document.createTextNode(kid) : kid);
  }
  return el;
}

/**
 * 图标按钮（触控区 ≥ 48px）。
 * @param {string} ico @param {string|null} label @param {() => void} onTap @param {string} [cls]
 */
export function btn(ico, label, onTap, cls = '') {
  const b = h(`button.btn${cls ? '.' + cls.split(' ').join('.') : ''}`, { type: 'button' }, [
    ico ? icon(ico, { size: 26 }) : null,
    label ? h('span', {}, label) : null,
  ]);
  if (!label) b.classList.add('btn-icon');
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    if (b.disabled) return;
    onTap();
  });
  return b;
}
