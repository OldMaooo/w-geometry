// 单位卡「认识尺子」：告诉孩子「一步多长、一块草垫多大」这类单位在画面里、生活里是多大。
// 引擎默认只讲「一步」「一块草垫」；章节在 defineChapter 里写 units 就能补自己的单位（见 doc/engine-contract.md §16）。
// 第一次点首屏「开始」自动弹一次（progress.seen('units') 记一个小标记），之后靠顶栏的「尺子」按钮随时再看。
import { h, btn } from './dom.js';
import { icon } from './icons.js';

/**
 * @typedef {object} UnitDef 一个单位
 * @property {string} name     如 '一斗'
 * @property {string} text     一两句话（可朗读），说清它在画面里多大
 * @property {'step'|'mat'|'cube'|(() => (Element|string))} [draw]  配图：内置名，或返回 DOM / SVG 字符串的函数；不写就只有文字
 */

// ---------- 配图（内联 SVG，不用外部图片） ----------
const INK = '#4A3A28';
const ROPE = `stroke-linecap="round"`;

/** 方块小人（和 3D 里的村民同款：陶红衣、草帽），脚底在原点，高约 110。 */
function person(armsOut = false) {
  const arms = armsOut
    ? `<rect x="-56" y="-62" width="38" height="13" fill="#C8553D"/><rect x="18" y="-62" width="38" height="13" fill="#C8553D"/>`
    : `<rect x="-28" y="-60" width="10" height="30" fill="#C8553D"/><rect x="18" y="-60" width="10" height="30" fill="#C8553D"/>`;
  return `
    <rect x="-17" y="-28" width="14" height="28" fill="#5B4632"/><rect x="3" y="-28" width="14" height="28" fill="#5B4632"/>
    ${arms}
    <rect x="-19" y="-62" width="38" height="36" fill="#C8553D"/><rect x="-20" y="-36" width="40" height="7" fill="#8E3B2A"/>
    <rect x="-15" y="-90" width="30" height="28" fill="#F0C9A0"/><rect x="-16" y="-91" width="32" height="11" fill="#3B2A1E"/>
    <rect x="-8" y="-77" width="4" height="6" fill="#2A1E14"/><rect x="5" y="-77" width="4" height="6" fill="#2A1E14"/>
    <polygon points="-25,-88 0,-111 25,-88" fill="#DCC27C" stroke="#B89A62" stroke-width="2" stroke-linejoin="round"/>`;
}

/** 一段结绳 + 标「1 步」的小牌（横着）。 */
function ropeH(x1, x2, y, cls = '') {
  const mid = (x1 + x2) / 2;
  return `
    <g class="${cls}">
      <line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="#B89A62" stroke-width="8" ${ROPE}/>
      <line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="#E8D8B0" stroke-width="4.5" ${ROPE}/>
    </g>
    <circle cx="${x1}" cy="${y}" r="6" fill="#A47148"/><circle cx="${x2}" cy="${y}" r="6" fill="#A47148"/>
    ${pill(mid, y, '1 步')}`;
}
function ropeV(x, y1, y2) {
  const mid = (y1 + y2) / 2;
  return `
    <line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" stroke="#B89A62" stroke-width="8" ${ROPE}/>
    <line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" stroke="#E8D8B0" stroke-width="4.5" ${ROPE}/>
    <circle cx="${x}" cy="${y1}" r="6" fill="#A47148"/><circle cx="${x}" cy="${y2}" r="6" fill="#A47148"/>
    ${pill(x, mid, '1 步')}`;
}
function pill(cx, cy, text, w = 66) {
  return `<g class="u-pill"><rect x="${cx - w / 2}" y="${cy - 14}" width="${w}" height="28" rx="14" fill="#FFF8EA" stroke="#8B6B43" stroke-width="2"/>
    <text x="${cx}" y="${cy + 7}" text-anchor="middle" font-size="20" font-weight="700" fill="${INK}">${text}</text></g>`;
}

const FIG = {
  // 一步：小人左脚、右脚各迈一次，脚下拉出一根绳；右边张开双臂的小人，宽度和绳差不多
  step: () => `
    <svg viewBox="0 0 320 200" role="img" aria-label="一步：左脚右脚各迈一次，差不多是双臂张开那么宽">
      <rect width="320" height="200" fill="#F8F1DC"/><rect y="120" width="320" height="80" fill="#EADDB8"/>
      <line x1="0" y1="120" x2="320" y2="120" stroke="#C9B27C" stroke-width="2"/>
      <g fill="#B89A62">
        <ellipse class="u-pr u-pr1" cx="50" cy="131" rx="14" ry="7"/>
        <ellipse class="u-pr u-pr2" cx="105" cy="131" rx="14" ry="7"/>
        <ellipse class="u-pr u-pr3" cx="160" cy="131" rx="14" ry="7"/>
      </g>
      <g font-size="16" fill="#7A6650" text-anchor="middle">
        <text class="u-pr u-pr1" x="50" y="152">左脚</text><text class="u-pr u-pr2" x="105" y="152">右脚</text><text class="u-pr u-pr3" x="160" y="152">左脚</text>
      </g>
      <g transform="translate(50,127)"><g class="u-walker">${person(false)}</g></g>
      <g class="u-fade">
        <g class="u-rope">
          <line x1="50" y1="178" x2="160" y2="178" pathLength="1" stroke="#B89A62" stroke-width="8" ${ROPE}/>
          <line x1="50" y1="178" x2="160" y2="178" pathLength="1" stroke="#E8D8B0" stroke-width="4.5" ${ROPE}/>
        </g>
        <circle cx="50" cy="178" r="6" fill="#A47148"/><circle cx="160" cy="178" r="6" fill="#A47148"/>
        ${pill(105, 178, '1 步')}
      </g>
      <g transform="translate(262,127)">${person(true)}</g>
      <g stroke="#7A6650" stroke-width="2.5" ${ROPE}>
        <line x1="207" y1="150" x2="317" y2="150" stroke-dasharray="2 6"/><line x1="207" y1="143" x2="207" y2="157"/><line x1="317" y1="143" x2="317" y2="157"/>
      </g>
      <text x="262" y="177" text-anchor="middle" font-size="16" fill="#7A6650">双臂张开</text>
    </svg>`,

  // 一块草垫：一步长、一步宽的方垫子，旁边两根 1 步的绳
  mat: () => `
    <svg viewBox="0 0 320 200" role="img" aria-label="一块草垫：一步长、一步宽">
      <defs><pattern id="u-straw" width="14" height="14" patternUnits="userSpaceOnUse">
        <rect width="14" height="14" fill="#DCC27C"/><path d="M0 7H14M7 0V14" stroke="#CDAE63" stroke-width="2"/></pattern></defs>
      <rect width="320" height="200" fill="#EADDB8"/>
      <g class="u-matpop">
        <rect x="80" y="26" width="110" height="110" fill="url(#u-straw)" stroke="#B89A62" stroke-width="3"/>
        <text x="135" y="88" text-anchor="middle" font-size="22" font-weight="700" fill="${INK}" stroke="#FFF8EA" stroke-width="5" paint-order="stroke">1 块草垫</text>
      </g>
      ${ropeH(80, 190, 168)}
      ${ropeV(236, 26, 136)}
    </svg>`,

  // 一斗：1 步见方的小方箱（第 5 章用）
  cube: () => `
    <svg viewBox="0 0 320 200" role="img" aria-label="一斗：一步见方的小方箱装满">
      <rect width="320" height="200" fill="#F8F1DC"/>
      <polygon points="70,60 166,60 206,28 110,28" fill="#F5D98A" stroke="#7A5230" stroke-width="2.5" stroke-linejoin="round"/>
      <polygon points="166,60 206,28 206,124 166,156" fill="#CFA033" stroke="#7A5230" stroke-width="2.5" stroke-linejoin="round"/>
      <rect x="70" y="60" width="96" height="96" fill="#EBC15A" stroke="#7A5230" stroke-width="2.5"/>
      <text x="118" y="116" text-anchor="middle" font-size="28" font-weight="700" fill="${INK}">1 斗</text>
      ${ropeH(70, 166, 182)}
      ${ropeV(240, 28, 124)}
    </svg>`,
};

/** 默认讲的两个单位。 */
export const BASE_UNITS = /** @type {UnitDef[]} */ ([
  { name: '一步', text: '左脚右脚各迈一次，就是一步。差不多是你张开双臂那么宽。', draw: 'step' },
  { name: '一块草垫', text: '一步长、一步宽，就是一块草垫。', draw: 'mat' },
]);

/**
 * 单位卡。
 * @param {{ hud: ReturnType<import('./hud.js').createHud>, audio: ReturnType<import('./audio.js').createAudio>,
 *   progress: ReturnType<import('./progress.js').createProgress> }} deps
 */
export function createUnits({ hud, audio, progress }) {
  /** @type {HTMLElement | null} 当前打开的卡（被别的弹层顶掉后 isConnected 会变 false） */
  let card = null;

  function figure(u) {
    if (!u.draw) return null;
    const made = typeof u.draw === 'function' ? u.draw() : FIG[u.draw]?.();
    if (!made) return null;
    return typeof made === 'string' ? h('div.u-fig', { html: made }) : h('div.u-fig', {}, made);
  }

  function close() {
    if (!card?.isConnected) { card = null; return; }
    card = null;
    audio.hush();
    hud.closeModal();
  }

  /**
   * 打开单位卡。
   * @param {{ units?: UnitDef[] } | null} [chapter] 在某章的关卡里打开时传该章，多显示它声明的单位
   * @param {{ speak?: boolean }} [opt] speak：打开就把每个单位念一遍（首次自动弹出时用）
   */
  function open(chapter = null, opt = {}) {
    const units = [...BASE_UNITS, ...(chapter?.units || [])];
    const rows = units.map((u) => h('div.u-row', {}, [
      figure(u),
      h('div.u-txt', {}, [
        h('div.u-name', {}, [h('b', {}, u.name), btn('sound', null, () => audio.say(u.text), 'ghost')]),
        h('p', {}, u.text),
      ]),
    ]));
    const ok = btn('check', '知道了', () => { audio.play('tap'); close(); }, 'big primary');
    progress.markSeen('units');
    card = h('div.modal.units', {}, [
      h('div.m-head', {}, [icon('ruler', { size: 26 }), h('b', {}, '认识尺子')]),
      h('div.u-list', {}, rows),
      h('div.u-actions', {}, ok),
    ]);
    hud.openModal(card);
    if (opt.speak) audio.say(units.map((u) => `${u.name}。${u.text}`).join(' '));
  }

  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

  return {
    open,
    close,
    get isOpen() { return !!card?.isConnected; },
    /** 第一次点「开始」之后调用：没弹过就弹一次。 */
    openFirstTime() { if (!progress.seen('units')) open(null, { speak: true }); },
  };
}
