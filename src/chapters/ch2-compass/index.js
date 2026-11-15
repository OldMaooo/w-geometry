// 第 2 章 · 规矩：章信息 + 关卡列表 + 智慧卡 + 地图上的样子。
import { defineChapter } from '../../engine/registry.js';
import l1 from './l1-well.js';
import l2 from './l2-tower.js';
import l3 from './l3-well2.js';
import l4 from './l4-fork.js';
import l5 from './l5-hex.js';
import l6 from './l6-jade.js';
import { mapDecor } from './map-decor.js';

export default defineChapter({
  id: 'ch2',
  order: 2,
  name: '规矩',
  intro: '田分好了，古国要建城。用一根拴在桩上的绳子画圆，再用圆定出井、门、路和亭。',
  levels: [l1, l2, l3, l4, l5, l6],
  cards: [
    { id: 'ch2-guiju', title: '规和矩', icon: 'compass', unlockBy: 'ch2-l1',
      lines: ['古人说：没有规矩，不成方圆。', '规画圆，矩画方。大禹治水，左手拿准绳，右手拿规矩。'] },
    { id: 'ch2-euclid', title: '几何原本', icon: 'book', unlockBy: 'ch2-l2',
      lines: ['两千三百年前，欧几里得写了一本书。', '第一页第一题，就是你刚做的这个三角形。'] },
    { id: 'ch2-yubi', title: '玉璧与玉琮', icon: 'landmark', unlockBy: 'ch2-l6',
      lines: ['五千年前，杭州良渚人做出了玉璧和玉琮。', '外方内圆，圆得特别准。'] },
  ],
  mapDecor,
});
