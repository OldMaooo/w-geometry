// 第 4 章 · 营造：章信息 + 关卡列表 + 智慧卡 + 地图上的样子。
import { defineChapter } from '../../engine/registry.js';
import l1 from './l1-base.js';
import l2 from './l2-shadows.js';
import l3 from './l3-bridge.js';
import l4 from './l4-nets.js';
import l5 from './l5-roof.js';
import l6 from './l6-pyramid.js';
import { mapDecor } from './map-decor.js';

export default defineChapter({
  id: 'ch4',
  order: 4,
  name: '营造',
  intro: '要盖台基、塔、桥和屋顶了。这一章全是立体的：转着看，一块一块搭。',
  levels: [l1, l2, l3, l4, l5, l6],
  cards: [
    {
      id: 'ch4-pyramid', title: '金字塔', icon: 'landmark', unlockBy: 'ch4-l6',
      lines: ['四千五百年前，埃及人用 230 万块石头堆起金字塔。', '四条底边几乎一样长，误差只有几厘米。'],
    },
    {
      id: 'ch4-truss', title: '三角屋架', icon: 'triangle', unlockBy: 'ch4-l3',
      lines: ['古今中外的屋顶、桥、铁塔，骨架里全是三角形。', '因为三角形三条边一定，形状就死了，不会歪。'],
    },
    {
      id: 'ch4-yingzao', title: '《营造法式》', icon: 'book', unlockBy: 'ch4-l5',
      lines: ['九百年前，宋朝人编了一本建房子的规矩书。', '屋顶的坡怎么举、怎么折，书里都有规矩。'],
    },
  ],
  mapDecor,
});
