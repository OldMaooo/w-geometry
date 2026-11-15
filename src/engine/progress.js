// 存档：localStorage，一个 key（geo_save），只存星数、眼力记录、智慧卡、设置。总量远小于 20KB。
//
// 结构：
// { v: 1,
//   lv:   { 'ch1-l1': { s: 3, solo: 1 } },          // s 最好星数；solo=1 表示曾不用提示独立过关
//   eye:  { length: [86, 92], area: [...], ... },    // 每次「先猜」的准确度 0–100，每类最多留 20 次
//   cards:['ch1-rope'],                              // 已得智慧卡 id
//   set:  { sound: true, voice: true } }

const KEY = 'geo_save';
export const EYE_KINDS = /** @type {const} */ (['length', 'area', 'angle', 'height', 'volume']);
export const EYE_NAMES = { length: '长度', area: '面积', angle: '角度', height: '高度', volume: '容积' };
const EYE_KEEP = 20;

function blank() {
  return { v: 1, lv: {}, eye: {}, cards: [], set: { sound: true, voice: true } };
}

export function createProgress() {
  let data = load();
  const listeners = new Set();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return blank();
      const d = JSON.parse(raw);
      return { ...blank(), ...d, set: { ...blank().set, ...(d.set || {}) } };
    } catch {
      return blank();
    }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* 存不下就算了，不打扰玩 */ }
    listeners.forEach((fn) => fn(data));
  }

  return {
    /** 某关最好成绩；没过返回 null。 @param {string} id */
    level(id) { return data.lv[id] || null; },
    isCleared(id) { return !!data.lv[id]; },
    /**
     * 记一次过关（只会往好里改）。返回 { best, improved }。
     * @param {string} id @param {number} stars @param {boolean} solo 没用提示
     */
    recordLevel(id, stars, solo) {
      const old = data.lv[id];
      const s = Math.max(old?.s || 0, stars);
      data.lv[id] = { s, ...(solo || old?.solo ? { solo: 1 } : {}) };
      save();
      return { best: s, improved: !old || stars > old.s, first: !old };
    },
    /**
     * 记一次眼力（准确度 0–1）。返回这一类上一次的值（没有为 null），给「比上次更准」用。
     * @param {string} kind @param {number} acc
     */
    recordEye(kind, acc) {
      const arr = (data.eye[kind] ||= []);
      const prev = arr.length ? arr[arr.length - 1] : null;
      arr.push(Math.round(acc * 100));
      if (arr.length > EYE_KEEP) arr.splice(0, arr.length - EYE_KEEP);
      save();
      return prev;
    },
    /** 某类眼力记录（0–100 数组）。 */
    eye(kind) { return data.eye[kind] || []; },
    /** 拿一张智慧卡。返回是不是新拿的。 */
    addCard(id) {
      if (data.cards.includes(id)) return false;
      data.cards.push(id);
      save();
      return true;
    },
    hasCard(id) { return data.cards.includes(id); },
    cards() { return [...data.cards]; },
    settings() { return data.set; },
    setSetting(k, v) { data.set[k] = v; save(); },
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    /** 调试：清空存档。 */
    reset() { data = blank(); save(); },
    /** 调试：存档字节数。 */
    bytes() { return (localStorage.getItem(KEY) || '').length * 2; },
    raw: () => data,
  };
}
