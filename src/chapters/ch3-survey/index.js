// 第 3 章 · 测望：章信息 + 关卡列表 + 智慧卡 + 地图上的样子。
import { defineChapter } from '../../engine/registry.js';
import l1 from './l1-shadow.js';
import l2 from './l2-tree.js';
import l3 from './l3-thales.js';
import l4 from './l4-river.js';
import l5 from './l5-blueprint.js';
import l6 from './l6-island.js';
import { mapDecor } from './map-decor.js';

export default defineChapter({
  id: 'ch3',
  order: 3,
  name: '测望',
  intro: '城要建高塔，河上要架桥。树顶爬不上去，河对岸过不去，够不着的东西怎么量？',
  levels: [l1, l2, l3, l4, l5, l6],
  cards: [
    {
      id: 'ch3-biao', title: '立竿测影', icon: 'sun', unlockBy: 'ch3-l1',
      lines: ['中国古人在地上立一根八尺的竿，叫「表」。', '看影子的长短，来定节气。'],
    },
    {
      id: 'ch3-thales', title: '泰勒斯和金字塔', icon: 'landmark', unlockBy: 'ch3-l3',
      lines: ['两千六百年前，泰勒斯等自己的影子和身高一样长的那一刻，', '去量金字塔的影子。'],
    },
    {
      id: 'ch3-haidao', title: '《海岛算经》', icon: 'telescope', unlockBy: 'ch3-l6',
      lines: ['魏晋时的刘徽，写了《海岛算经》。', '他只用两根竿，就量出了海岛上山的高度。'],
    },
  ],
  mapDecor,
});
