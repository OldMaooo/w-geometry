// 第 1 章 · 量田：章信息 + 关卡列表 + 智慧卡 + 地图上的样子。
import { defineChapter } from '../../engine/registry.js';
import l1 from './l1-ridge.js';
import l2 from './l2-mats.js';
import l3 from './l3-fence.js';
import l4 from './l4-slant.js';
import l5 from './l5-triangle.js';
import l6 from './l6-rope12.js';
import { mapDecor } from './map-decor.js';

export default defineChapter({
  id: 'ch1',
  order: 1,
  name: '量田',
  intro: '大河涨水，把田界全冲没了。帮村民重新量田、分田。',
  levels: [l1, l2, l3, l4, l5, l6],
  cards: [
    {
      id: 'ch1-fangtian',
      title: '方田术',
      icon: 'grid',
      unlockBy: 'ch1-l2',
      lines: ['两千年前的《九章算术》，第一章就叫「方田」。', '讲的就是：一块田有多大，怎么算。'],
    },
    {
      id: 'ch1-churu',
      title: '出入相补',
      icon: 'puzzle',
      unlockBy: 'ch1-l4',
      lines: ['魏晋时的数学家刘徽说：', '把多出来的一块，搬去补缺的那一块，大小不变。'],
    },
    {
      id: 'ch1-rope',
      title: '拉绳人',
      icon: 'ruler',
      unlockBy: 'ch1-l6',
      lines: ['古埃及每年尼罗河涨水，田界都被冲掉。', '有一群专门拉绳子重新量田的人。', '「几何」这个词，原来的意思就是「量地」。'],
    },
  ],
  mapDecor,
});
