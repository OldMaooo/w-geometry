// 笔记：角落一个可拖动的小浮标，点开从右边滑出笔记面板，把游戏挤窄（窄屏才改为盖在上面）。
// 这是给大人记 bug / 想法用的开发工具，不是给小野玩的内容；列表用资产库的 todo-tree。
// 数据：localStorage 的 geo_notes（条目数组）；浮标位置和面板宽度另存 geo_notes_ui。两个 key 都远小于 20KB。
import './todo-tree.css';
import './notes.css';
import TodoTree from './todo-tree.js';

const KEY_ITEMS = 'geo_notes';
const KEY_UI = 'geo_notes_ui';
const BTN = 40;           // 浮标直径
const W_MIN = 280;
const W_DEFAULT = 360;
const NARROW = 820;       // 窄于它放不下，面板盖在游戏上而不是挤
const DRAG_PX = 5;        // 移动超过这么远才算拖动，否则算点击

const SVG = (body, size = 18) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
const ICON_PEN = SVG('<path d="M12 20h9"/><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z"/>');
const ICON_COPY = SVG('<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>');
const ICON_CHECK = SVG('<path d="M20 6 9 17l-5-5"/>');
const ICON_X = SVG('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>');

function readJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function writeJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* 存不下就只在本次生效 */ }
}

/** todo-tree 的存储适配器：读不到数据返回 null（不是读失败），保存失败要 reject。 */
export const notesStore = {
  kind: 'app',
  label: '本机',
  load: () => {
    const raw = localStorage.getItem(KEY_ITEMS);
    return Promise.resolve(raw === null ? null : JSON.parse(raw));
  },
  save: (items) => {
    try { localStorage.setItem(KEY_ITEMS, JSON.stringify(items)); } catch (e) { return Promise.reject(e); }
    return Promise.resolve();
  },
};

/** 一键复制用：按缩进排成纯文本，已完成的前面打 √ */
export function itemsToText(items) {
  return (items || []).map((x) => `${'  '.repeat(x.lv || 0)}${x.d ? '√ ' : '- '}${x.t}`).join('\n');
}

export function clampWidth(w, vw) {
  const max = Math.max(W_MIN, Math.round(vw * 0.7));
  return Math.round(Math.min(max, Math.max(W_MIN, w)));
}

/** 浮标位置夹在屏幕内（四周留 4px） */
export function clampPos(x, y, vw, vh) {
  return {
    x: Math.round(Math.min(vw - BTN - 4, Math.max(4, x))),
    y: Math.round(Math.min(vh - BTN - 4, Math.max(4, y))),
  };
}

/**
 * @param {HTMLElement} app 游戏容器（#app）；打开面板时给它让出右边的位置，并通知舞台重新量尺寸
 */
export function createNotes(app) {
  const ui = readJSON(KEY_UI, {});
  let width = clampWidth(Number(ui.w) || W_DEFAULT, window.innerWidth);
  let pos = clampPos(
    Number.isFinite(ui.x) ? ui.x : window.innerWidth - BTN - 4,
    Number.isFinite(ui.y) ? ui.y : Math.round(window.innerHeight * 0.45),
    window.innerWidth, window.innerHeight,
  );
  let open = false;
  let items = [];
  let status = 'loading';
  const saveUi = () => writeJSON(KEY_UI, { x: pos.x, y: pos.y, w: width });

  // ── 浮标 ──
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'notes-fab';
  btn.setAttribute('aria-label', '笔记');
  btn.title = '笔记（可拖动）';
  btn.innerHTML = ICON_PEN;
  const place = () => { btn.style.left = `${pos.x}px`; btn.style.top = `${pos.y}px`; };
  place();

  // ── 面板 ──
  const panel = document.createElement('aside');
  panel.className = 'notes-panel';
  panel.setAttribute('aria-label', '笔记');
  panel.innerHTML = `
    <div class="notes-resizer" role="separator" aria-orientation="vertical" aria-label="拖动调整宽度"></div>
    <header class="notes-head">
      <span class="notes-title">笔记</span>
      <button type="button" class="notes-ibtn notes-copy" aria-label="复制全部笔记" title="复制全部">${ICON_COPY}</button>
      <button type="button" class="notes-ibtn notes-close" aria-label="关闭笔记" title="关闭（Esc）">${ICON_X}</button>
    </header>
    <div class="notes-body"></div>`;
  document.body.append(btn, panel);
  const resizer = panel.querySelector('.notes-resizer');
  const copyBtn = panel.querySelector('.notes-copy');

  const tree = TodoTree.mount(panel.querySelector('.notes-body'), {
    store: notesStore,
    seed: [],
    placeholder: '记一条问题或想法，回车添加',
    onChange: (info) => { items = info.items; status = info.status; },
  });

  // ── 开关与挤压 ──
  const narrow = () => window.innerWidth <= NARROW;
  function layout() {
    const w = Math.min(width, window.innerWidth);
    panel.style.setProperty('--notes-w', `${w}px`);
    // 打开且放得下：游戏容器右边让出面板宽度（舞台只监听 window 的 resize，所以手动通知一次）
    app.style.right = open && !narrow() ? `${w}px` : '';
    window.dispatchEvent(new Event('resize'));
  }
  function setOpen(v) {
    if (v === open) return;
    open = v;
    panel.classList.toggle('open', v);
    btn.classList.toggle('hidden', v);
    layout();
    if (v) { tree.reload(); setTimeout(() => tree.focusInput(), 0); }
    else if (status === 'dirty' || status === 'error') tree.flush();
  }
  btn.addEventListener('click', () => { if (!moved) setOpen(true); });
  panel.querySelector('.notes-close').addEventListener('click', () => setOpen(false));
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !open) return;
    const a = document.activeElement;
    const editing = a && panel.contains(a) && (a.isContentEditable || a.tagName === 'TEXTAREA' || a.tagName === 'INPUT') && a.type !== 'checkbox';
    if (!editing) setOpen(false);
  });
  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(itemsToText(items));
      copyBtn.innerHTML = ICON_CHECK;
      setTimeout(() => { copyBtn.innerHTML = ICON_COPY; }, 1500);
    } catch { /* 没有剪贴板权限就不提示成功 */ }
  });

  // ── 拖浮标（超过 5px 才算拖，否则是点击） ──
  let moved = false;
  let drag = null;
  btn.addEventListener('pointerdown', (e) => {
    drag = { sx: e.clientX, sy: e.clientY, x: pos.x, y: pos.y };
    moved = false;
    btn.setPointerCapture?.(e.pointerId);
  });
  btn.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
    if (!moved && Math.hypot(dx, dy) < DRAG_PX) return;
    moved = true;
    btn.classList.add('dragging');
    pos = clampPos(drag.x + dx, drag.y + dy, window.innerWidth, window.innerHeight);
    place();
  });
  const endBtnDrag = (e) => {
    if (!drag) return;
    drag = null;
    btn.releasePointerCapture?.(e.pointerId);
    btn.classList.remove('dragging');
    if (moved) saveUi();
    // click 事件在 pointerup 之后才触发；等它过去再清标记，拖完那一下不会误开面板
    setTimeout(() => { moved = false; }, 0);
  };
  btn.addEventListener('pointerup', endBtnDrag);
  btn.addEventListener('pointercancel', endBtnDrag);

  // ── 拖面板宽度（左边缘；拖动中内容实时跟着变，不能选中文字） ──
  let resizing = false;
  resizer.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    resizing = true;
    resizer.setPointerCapture?.(e.pointerId);
    panel.classList.add('resizing');
  });
  resizer.addEventListener('pointermove', (e) => {
    if (!resizing) return;
    width = clampWidth(window.innerWidth - e.clientX, window.innerWidth);
    layout();
  });
  const endResize = (e) => {
    if (!resizing) return;
    resizing = false;
    resizer.releasePointerCapture?.(e.pointerId);
    panel.classList.remove('resizing');
    saveUi();
  };
  resizer.addEventListener('pointerup', endResize);
  resizer.addEventListener('pointercancel', endResize);

  // 窗口变了：浮标不能跑出屏幕，面板宽度重新夹一下
  window.addEventListener('resize', () => {
    pos = clampPos(pos.x, pos.y, window.innerWidth, window.innerHeight);
    place();
    width = clampWidth(width, window.innerWidth);
    panel.style.setProperty('--notes-w', `${Math.min(width, window.innerWidth)}px`);
    if (open) app.style.right = narrow() ? '' : `${Math.min(width, window.innerWidth)}px`;
  });
  // 页面关闭前把没落盘的改动存掉
  window.addEventListener('pagehide', () => { if (status === 'dirty' || status === 'error') tree.flush(); });
  panel.style.setProperty('--notes-w', `${Math.min(width, window.innerWidth)}px`);

  return { open: () => setOpen(true), close: () => setOpen(false), toggle: () => setOpen(!open), isOpen: () => open, tree };
}
