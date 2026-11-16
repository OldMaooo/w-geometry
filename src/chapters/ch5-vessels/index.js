// 第 5 章 · 量器：章信息 + 关卡列表 + 智慧卡 + 地图上的样子。
import { defineChapter } from '../../engine/registry.js';
import l1 from './l1-jars.js';
import l2 from './l2-barn.js';
import l3 from './l3-cone.js';
import l4 from './l4-yangma.js';
import l5 from './l5-silo.js';
import l6 from './l6-standard.js';
import { mapDecor } from './map-decor.js';

export default defineChapter({
  id: 'ch5',
  order: 5,
  name: '量器',
  intro: '丰收了。粮食要称量、要进仓、要交粮税，得有公平的量器。',
  levels: [l1, l2, l3, l4, l5, l6],
  // 单位卡里多讲一个「斗」：本章方仓 / 囤 / 标准斗里，一个 1×1×1 的方块就是 1 斗
  units: [
    { name: '一斗', text: '一步见方的小方箱，装满就是一斗。', draw: 'cube' },
  ],
  cards: [
    {
      id: 'ch5-yangma', title: '阳马', icon: 'puzzle', unlockBy: 'ch5-l4',
      lines: ['一千七百年前，刘徽把一个方块切成三个阳马。', '三块一样的，所以每块正好是三分之一。'],
    },
    {
      id: 'ch5-yuantun', title: '圆囤', icon: 'wheat', unlockBy: 'ch5-l5',
      lines: ['农村的粮囤、水桶、锅，都是圆的。', '同样的料，围成圆的，装得最多。'],
    },
    {
      id: 'ch5-dou', title: '统一度量衡', icon: 'landmark', unlockBy: 'ch5-l6',
      lines: ['秦始皇让全国用一样大的斗、一样长的尺。', '做生意，才公平。'],
    },
  ],
  mapDecor,
});
