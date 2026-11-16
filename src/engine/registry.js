// 章节自动注册：扫描 src/chapters/*/index.js。新增一章不用改任何公共文件。
// 每章 index.js 默认导出 defineChapter({...})。

/**
 * @typedef {object} Card 古人智慧卡
 * @property {string} id
 * @property {string} title
 * @property {string[]} lines     两三句话（可朗读）
 * @property {string} [icon]      lucide 图标名（卡面配图），见 icons.js
 * @property {string} unlockBy    过了哪一关解锁（关卡 id）
 */

/**
 * @typedef {object} Chapter
 * @property {string} id          如 'ch1'
 * @property {number} order       第几章（1–6），决定地图上的区域和解锁顺序
 * @property {string} name        如 '量田'
 * @property {string} intro       一句话介绍
 * @property {import('./level.js').LevelDef[]} levels
 * @property {Card[]} cards
 * @property {import('./units.js').UnitDef[]} [units]  本章自己的单位（可选）：在本章关卡里点顶栏「尺子」时，排在「一步」「一块草垫」后面
 */

/** @param {Chapter} def @returns {Chapter} */
export function defineChapter(def) {
  for (const k of ['id', 'order', 'name', 'intro', 'levels']) {
    if (def[k] === undefined) throw new Error(`defineChapter: 缺少 ${k}`);
  }
  def.cards ||= [];
  def.levels.forEach((lv, i) => {
    lv.chapter = def;
    lv.index = i;
  });
  return def;
}

const mods = import.meta.glob('../chapters/*/index.js', { eager: true });

/** @type {Chapter[]} */
export const chapters = Object.values(mods)
  .map((m) => /** @type {any} */ (m).default)
  .filter(Boolean)
  .sort((a, b) => a.order - b.order);

/** @param {string} id */
export function findLevel(id) {
  for (const ch of chapters) {
    const lv = ch.levels.find((l) => l.id === id);
    if (lv) return lv;
  }
  return null;
}

/** @param {number} order */
export const chapterByOrder = (order) => chapters.find((c) => c.order === order) || null;

/** 一关的下一关（同章内）。 */
export function nextLevel(lv) {
  return lv.chapter.levels[lv.index + 1] || null;
}

/**
 * 解锁规则：章内顺序解锁；上一章（已注册的前一章）过任意 3 关开下一章。
 * @param {ReturnType<import('./progress.js').createProgress>} progress
 */
export function makeUnlocks(progress) {
  const clearedIn = (ch) => ch.levels.filter((l) => progress.isCleared(l.id)).length;
  function chapterOpen(ch) {
    const i = chapters.indexOf(ch);
    if (i <= 0) return true;
    const prev = chapters[i - 1];
    return chapterOpen(prev) && clearedIn(prev) >= 3;
  }
  function levelOpen(lv) {
    if (progress.isCleared(lv.id)) return true;
    if (!chapterOpen(lv.chapter)) return false;
    return lv.index === 0 || progress.isCleared(lv.chapter.levels[lv.index - 1].id);
  }
  return { chapterOpen, levelOpen, clearedIn };
}
