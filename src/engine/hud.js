// HUD：盖在 3D 上的一层 DOM。任务条、工具栏、先猜条、提示按钮、温和反馈、结算面板、设置。
// 零键盘：所有数字用步进器（可按住连加、可左右滑）或点选；没有任何输入框。
import { h, btn } from './dom.js';
import { icon } from './icons.js';
import { EYE_NAMES } from './progress.js';

/**
 * @param {HTMLElement} root
 * @param {{ audio: ReturnType<import('./audio.js').createAudio>, progress: ReturnType<import('./progress.js').createProgress>,
 *   controls: ReturnType<import('./controls.js').createControls> }} deps
 */
export function createHud(root, deps) {
  const { audio, progress, controls } = deps;
  const layer = h('div.hud');
  root.appendChild(layer);

  // ---------- 骨架 ----------
  const topLeft = h('div.hud-tl');
  const topMid = h('div.hud-tm');
  const topRight = h('div.hud-tr');
  const bottomMid = h('div.hud-bm');
  const bottomRight = h('div.hud-br');
  const toastBox = h('div.hud-toast');
  const modalBox = h('div.hud-modal-wrap');
  layer.append(topLeft, topMid, topRight, bottomMid, bottomRight, toastBox, modalBox);

  // 任务条
  const taskText = h('div.task-text');
  const taskSay = btn('sound', null, () => audio.say(currentTask), 'ghost');
  taskSay.setAttribute('aria-label', '再听一遍');
  const dots = h('div.task-dots');
  const taskBar = h('div.task', {}, [taskSay, taskText]);
  topMid.append(taskBar, dots);
  let currentTask = '';

  // 工具栏 + 先猜条
  const toolbar = h('div.toolbar');
  const guessBar = h('div.guess');
  bottomMid.append(guessBar, toolbar);

  // 视角切换
  const viewBtn = btn('top', '俯视', () => { controls.toggleTop(); audio.play('whoosh'); }, 'view');
  bottomRight.append(viewBtn);
  controls.onChange(() => {
    const top = controls.isTop();
    viewBtn.replaceChildren(icon(top ? 'oblique' : 'top', { size: 26 }), h('span', {}, top ? '斜视' : '俯视'));
  });

  // 设置浮层
  const settingsPop = h('div.pop.settings-pop');
  function renderSettings() {
    const s = progress.settings();
    settingsPop.replaceChildren(
      settingRow('sound', s.sound ? 'sound' : 'mute', '声音', s.sound),
      settingRow('voice', s.voice ? 'voice' : 'voiceOff', '朗读', s.voice),
    );
  }
  function settingRow(key, ico, label, on) {
    const row = h('button.set-row', { type: 'button', 'aria-pressed': on ? 'true' : 'false' }, [
      icon(ico, { size: 26 }), h('span', {}, label), h('span.switch' + (on ? '.on' : ''), {}, h('i')),
    ]);
    row.addEventListener('click', (e) => {
      e.stopPropagation();
      progress.setSetting(key, !on);
      if (key === 'voice' && on) audio.hush();
      audio.play('tap');
      renderSettings();
    });
    return row;
  }
  let settingsOpen = false;
  function toggleSettings(force) {
    settingsOpen = force ?? !settingsOpen;
    settingsPop.classList.toggle('open', settingsOpen);
    if (settingsOpen) renderSettings();
  }
  document.addEventListener('pointerdown', (e) => {
    if (settingsOpen && !settingsPop.contains(/** @type {Node} */ (e.target)) && !settingsBtn.contains(/** @type {Node} */ (e.target))) toggleSettings(false);
  }, true);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') toggleSettings(false); });
  const settingsBtn = btn('settings', null, () => toggleSettings(), 'ghost');
  settingsBtn.setAttribute('aria-label', '设置');

  // 尺子按钮：随时重看「一步多长、一块草垫多大」（地图、关卡顶栏都有）
  let onRuler = () => {};
  const rulerBtn = btn('ruler', null, () => onRuler(), 'ghost');
  rulerBtn.setAttribute('aria-label', '认识尺子');

  // 提示按钮
  const hintDots = h('span.hint-dots', {}, [h('i'), h('i'), h('i')]);
  const hintBtn = h('button.btn.hint', { type: 'button' }, [icon('hint', { size: 26 }), h('span', {}, '想一想'), hintDots]);
  let onHint = () => {};
  hintBtn.addEventListener('click', (e) => { e.stopPropagation(); if (!hintBtn.disabled) onHint(); });

  // 关卡左上角
  const backBtn = btn('map', null, () => onBack(), 'ghost');
  backBtn.setAttribute('aria-label', '回地图');
  const restartBtn = btn('restart', null, () => onRestart(), 'ghost');
  restartBtn.setAttribute('aria-label', '重来');
  const titleChip = h('div.title-chip');
  let onBack = () => {};
  let onRestart = () => {};

  // ---------- 模式：关卡 / 地图 ----------
  function levelMode({ code, title, back, restart, hint }) {
    onBack = back;
    onRestart = restart;
    onHint = hint;
    titleChip.replaceChildren(h('b', {}, code), h('span', {}, title));
    topLeft.replaceChildren(backBtn, titleChip);
    topRight.replaceChildren(hintBtn, restartBtn, rulerBtn, settingsBtn, settingsPop);
    bottomRight.style.display = '';
    layer.classList.add('in-level');
    clearLevel();
  }
  function mapMode(extraRight = []) {
    topLeft.replaceChildren();
    topRight.replaceChildren(...extraRight, rulerBtn, settingsBtn, settingsPop);
    bottomRight.style.display = 'none';
    layer.classList.remove('in-level');
    clearLevel();
  }

  // ---------- 关卡里用的 ----------
  function task(text, { speak = true } = {}) {
    currentTask = text;
    taskText.textContent = text;
    taskBar.classList.toggle('empty', !text);
    taskBar.classList.remove('flash');
    void taskBar.offsetWidth;
    taskBar.classList.add('flash');
    if (speak && text) audio.say(text);
  }
  function progressDots(i, n) {
    dots.replaceChildren(...Array.from({ length: n || 0 }, (_, k) => h('i' + (k < i ? '.done' : k === i ? '.now' : ''))));
  }

  /**
   * 工具栏按钮。返回句柄 { el, show, hide, enable, pulse, remove, set }。
   * @param {{ icon?: string, label: string, onTap: () => void, primary?: boolean, hidden?: boolean }} def
   */
  function tool(def) {
    const el = btn(def.icon || null, def.label, () => { audio.play('tap'); def.onTap(); }, `tool${def.primary ? ' primary' : ''}`);
    if (def.hidden) el.style.display = 'none';
    toolbar.appendChild(el);
    const hnd = {
      el,
      show() { if (el.style.display === 'none') { el.style.display = ''; el.classList.remove('appear'); void el.offsetWidth; el.classList.add('appear'); } return hnd; },
      hide() { el.style.display = 'none'; return hnd; },
      enable(on = true) { el.disabled = !on; return hnd; },
      pulse(on = true) { el.classList.toggle('pulse', on); return hnd; },
      set(label, ico) { el.replaceChildren(ico || def.icon ? icon(ico || def.icon, { size: 26 }) : '', h('span', {}, label)); return hnd; },
      remove() { el.remove(); },
      get visible() { return el.style.display !== 'none'; },
      tap() { if (!el.disabled && el.style.display !== 'none') { audio.play('tap'); def.onTap(); } },
    };
    return hnd;
  }

  /** 正在进行的先猜（给 solve 自动作答用）。 */
  let activeGuess = null;

  /**
   * 先猜：步进器。返回 Promise<number>。
   * @param {{ prompt: string, min?: number, max?: number, step?: number, start?: number, unit?: string, speak?: boolean }} o
   */
  function guess(o) {
    const { min = 1, max = 20, step = 1, unit = '' } = o;
    let v = o.start ?? Math.round((min + max) / 2 / step) * step;
    const num = h('div.g-num');
    const render = () => { num.replaceChildren(h('b', {}, fmt(v)), unit ? h('small', {}, unit) : ''); minus.disabled = v <= min; plus.disabled = v >= max; };
    const set = (nv, sound = true) => {
      const c = Math.min(max, Math.max(min, Math.round(nv / step) * step));
      if (c !== v) { v = c; if (sound) audio.play('tick'); render(); num.classList.remove('bump'); void num.offsetWidth; num.classList.add('bump'); }
    };
    const minus = holdBtn('minus', () => set(v - step));
    const plus = holdBtn('plus', () => set(v + step));
    // 在数字上左右滑也能改
    let sx = null, sv = 0;
    num.addEventListener('pointerdown', (e) => { sx = e.clientX; sv = v; num.setPointerCapture(e.pointerId); });
    num.addEventListener('pointermove', (e) => { if (sx !== null) set(sv + Math.round((e.clientX - sx) / 26) * step); });
    num.addEventListener('pointerup', () => { sx = null; });
    num.addEventListener('pointercancel', () => { sx = null; });
    const ok = h('button.btn.primary.g-ok', { type: 'button' }, [icon('check', { size: 26 }), h('span', {}, '就猜这个')]);
    const say = btn('sound', null, () => audio.say(o.prompt), 'ghost');
    guessBar.replaceChildren(h('div.g-card', {}, [
      h('div.g-prompt', {}, [say, h('span', {}, o.prompt)]),
      h('div.g-row', {}, [minus, num, plus, ok]),
    ]));
    render();
    guessBar.classList.add('open');
    toolbar.classList.add('dim');
    if (o.speak !== false) audio.say(o.prompt);
    return new Promise((resolve) => {
      const finish = (val) => {
        activeGuess = null;
        guessBar.classList.remove('open');
        toolbar.classList.remove('dim');
        guessBar.replaceChildren();
        audio.play('good');
        resolve(val);
      };
      ok.addEventListener('click', () => finish(v));
      activeGuess = { answer: (val) => { set(val, false); setTimeout(() => finish(v), 350); }, cancel: () => { activeGuess = null; guessBar.classList.remove('open'); toolbar.classList.remove('dim'); guessBar.replaceChildren(); } };
    });
  }

  /**
   * 点选：几个大按钮选一个。返回 Promise<value>。
   * @template T
   * @param {{ prompt: string, options: { label: string, value: T, icon?: string }[], speak?: boolean }} o
   * @returns {Promise<T>}
   */
  function choose(o) {
    const say = btn('sound', null, () => audio.say(o.prompt), 'ghost');
    let finish;
    const opts = o.options.map((op) => {
      const b = h('button.btn.choice', { type: 'button' }, [op.icon ? icon(op.icon, { size: 26 }) : '', h('span', {}, op.label)]);
      b.addEventListener('click', () => finish(op.value));
      return b;
    });
    guessBar.replaceChildren(h('div.g-card', {}, [h('div.g-prompt', {}, [say, h('span', {}, o.prompt)]), h('div.g-row.choices', {}, opts)]));
    guessBar.classList.add('open');
    toolbar.classList.add('dim');
    if (o.speak !== false) audio.say(o.prompt);
    return new Promise((resolve) => {
      finish = (val) => {
        activeGuess = null;
        guessBar.classList.remove('open');
        toolbar.classList.remove('dim');
        guessBar.replaceChildren();
        audio.play('good');
        resolve(val);
      };
      activeGuess = { answer: (val) => setTimeout(() => finish(val), 300), cancel: () => { activeGuess = null; guessBar.classList.remove('open'); toolbar.classList.remove('dim'); guessBar.replaceChildren(); } };
    });
  }

  /** 只显示一句提示语在先猜条位置（比如「点你觉得最大的那块」），不是输入。 */
  function prompt(text) {
    if (!text) { guessBar.classList.remove('open'); guessBar.replaceChildren(); return; }
    const say = btn('sound', null, () => audio.say(text), 'ghost');
    guessBar.replaceChildren(h('div.g-card.slim', {}, [h('div.g-prompt', {}, [say, h('span', {}, text)])]));
    guessBar.classList.add('open');
    audio.say(text);
  }

  /** 温和反馈：一句话 + 软音，几秒后自己消失。 */
  let toastTimer = 0;
  function nudge(text, { speak = true, kind = 'soft' } = {}) {
    clearTimeout(toastTimer);
    toastBox.replaceChildren(h(`div.toast.${kind}`, {}, [icon(kind === 'good' ? 'sparkles' : 'speech', { size: 24 }), h('span', {}, text)]));
    toastBox.classList.remove('show');
    void toastBox.offsetWidth;
    toastBox.classList.add('show');
    audio.play(kind === 'good' ? 'good' : 'soft');
    if (speak) audio.say(text);
    toastTimer = setTimeout(() => toastBox.classList.remove('show'), 2800);
  }

  /** 提示按钮状态：用了几档（0–3），能不能用。 */
  function hintState(tier, enabled = true) {
    [...hintDots.children].forEach((d, i) => d.classList.toggle('on', i < tier));
    hintBtn.disabled = !enabled;
    hintBtn.style.visibility = enabled ? '' : 'hidden';
  }

  /**
   * 结算面板。返回 Promise<'next'|'nextChapter'|'map'|'again'>。
   * @param {{ stars: number, discovery?: string, eye?: {kind:string, guess:number|string, actual:number|string, unit?:string, acc:number}[],
   *   better?: boolean, card?: {title:string, lines:string[], icon?:string} | null, solo?: boolean, hasNext?: boolean, nextChapter?: boolean, title?: string }} r
   */
  function result(r) {
    audio.play('success');
    const starsEl = h('div.r-stars', {}, [1, 2, 3].map((i) => h('span.r-star' + (i <= r.stars ? '.on' : ''), { style: { animationDelay: `${0.25 + i * 0.22}s` } }, icon('star', { size: 54, stroke: 1.8 }))));
    [1, 2, 3].forEach((i) => { if (i <= r.stars) setTimeout(() => audio.play('star', { n: i }), 250 + i * 220); });
    const parts = [starsEl];
    if (r.solo) parts.push(h('div.r-solo', {}, [icon('award', { size: 20 }), h('span', {}, '自己做出来的')]));
    if (r.discovery) {
      parts.push(h('div.r-found', {}, [
        btn('sound', null, () => audio.say(r.discovery), 'ghost'),
        h('div', {}, [h('small', {}, '小发现'), h('p', {}, r.discovery)]),
      ]));
    }
    if (r.eye?.length) {
      const avg = Math.round((r.eye.reduce((s, e) => s + e.acc, 0) / r.eye.length) * 100);
      parts.push(h('div.r-eye', {}, [
        h('div.r-eye-head', {}, [icon('eye', { size: 22 }), h('span', {}, `眼力 ${avg}`), r.better ? h('em', {}, '比上次更准') : '']),
        h('div.r-eye-list', {}, r.eye.map((e) => h('div.r-eye-row', {}, [
          h('span.k', {}, EYE_NAMES[e.kind] || ''),
          h('span', {}, `猜 ${fmt(e.guess)}${e.unit || ''}`),
          h('span.sep', {}, '·'),
          h('span', {}, `量出 ${fmt(e.actual)}${e.unit || ''}`),
          h('span.bar', {}, h('i', { style: { width: `${Math.round(e.acc * 100)}%` } })),
        ]))),
      ]));
    }
    if (r.card) {
      parts.push(h('div.r-card', {}, [
        h('div.r-card-ico', {}, icon(r.card.icon || 'book', { size: 40 })),
        h('div', {}, [h('small', {}, '新的智慧卡'), h('b', {}, r.card.title), ...r.card.lines.map((t) => h('p', {}, t))]),
      ]));
    }
    return new Promise((resolve) => {
      const done = (v) => { closeModal(); resolve(v); };
      const actions = h('div.r-actions', {}, [
        btn('map', '回地图', () => done('map'), 'big'),
        btn('restart', '再玩', () => done('again'), 'big'),
        r.hasNext ? btn('next', '下一关', () => done('next'), 'big primary') : null,
        !r.hasNext && r.nextChapter ? btn('next', '下一章', () => done('nextChapter'), 'big primary') : null,
      ]);
      // 内容多时只让中间滚动（按钮始终看得见），不让整页出滚动条
      openModal(h('div.modal.result', {}, [h('div.r-body', {}, parts), actions]));
      if (r.discovery) setTimeout(() => audio.say(r.discovery), 1200);
    });
  }

  function openModal(node) {
    modalBox.replaceChildren(node);
    modalBox.classList.add('open');
  }
  function closeModal() {
    modalBox.classList.remove('open');
    modalBox.replaceChildren();
  }

  function clearLevel() {
    activeGuess?.cancel();
    activeGuess = null;
    toolbar.replaceChildren();
    toolbar.classList.remove('dim');
    guessBar.replaceChildren();
    guessBar.classList.remove('open');
    toastBox.classList.remove('show');
    clearTimeout(toastTimer);
    dots.replaceChildren();
    task('', { speak: false });
    hintState(0, true);
    closeModal();
    toggleSettings(false);
  }

  /** 按住连续触发的按钮（步进器 +/−）。 */
  function holdBtn(ico, fn) {
    const b = h('button.btn.btn-icon.g-step', { type: 'button' }, icon(ico, { size: 30, stroke: 2.6 }));
    let t1 = 0, t2 = 0;
    const stop = () => { clearTimeout(t1); clearInterval(t2); };
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (b.disabled) return;
      fn();
      t1 = setTimeout(() => { t2 = setInterval(() => { if (!b.disabled) fn(); else stop(); }, 90); }, 380);
    });
    for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, stop);
    return b;
  }

  return {
    layer, levelMode, mapMode,
    /** 设置尺子按钮点了做什么（main.js 接单位卡）。 */
    onRuler(fn) { onRuler = fn; }, task, progress: progressDots, tool, guess, choose, prompt, nudge, hintState,
    result, openModal, closeModal, clearLevel,
    /** 正在猜的话，直接答 value（solve 用）。返回有没有在猜。 */
    autoAnswer(value) { if (!activeGuess) return false; activeGuess.answer(value); return true; },
    get guessing() { return !!activeGuess; },
    tools: () => [...toolbar.children],
  };
}

function fmt(v) {
  if (typeof v !== 'number') return String(v);
  return Number.isInteger(v) ? String(v) : v.toFixed(1).replace(/\.0$/, '');
}
