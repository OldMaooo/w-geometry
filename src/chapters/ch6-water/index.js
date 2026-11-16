// 第 6 章 · 治水：章信息 + 关卡列表 + 智慧卡 + 地图上的样子。
import { defineChapter } from '../../engine/registry.js';
import l1 from './l1-level.js';
import l2 from './l2-short.js';
import l3 from './l3-cow.js';
import l4 from './l4-section.js';
import l5 from './l5-fishmouth.js';
import l6 from './l6-yu.js';
import { mapDecor } from './map-decor.js';

export default defineChapter({
  id: 'ch6',
  order: 6,
  name: '治水',
  intro: '旱季田里缺水，雨季大河泛滥。修渠、筑坝、分水，把前面学的本事都用上。',
  levels: [l1, l2, l3, l4, l5, l6],
  cards: [
    {
      id: 'ch6-liangzhu', title: '良渚水坝', icon: 'waves', unlockBy: 'ch6-l1',
      lines: ['就在杭州。五千年前，良渚人修了十一条水坝。', '它是世界上最早的水利工程之一。'],
    },
    {
      id: 'ch6-dujiangyan', title: '都江堰', icon: 'landmark', unlockBy: 'ch6-l5',
      lines: ['两千两百年前，李冰修了都江堰。', '鱼嘴把岷江分成两股，到今天还在用。'],
    },
    {
      id: 'ch6-dayu', title: '大禹治水', icon: 'ruler', unlockBy: 'ch6-l6',
      lines: ['传说大禹「左准绳，右规矩」，带着量具走遍九州。', '他用疏导的办法，治住了洪水。'],
    },
  ],
  mapDecor,
});
