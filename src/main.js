// 启动：装好引擎，在「首屏 → 地图 → 关卡」之间切换。
import './styles/main.css';
import { createStage } from './engine/stage.js';
import { createControls } from './engine/controls.js';
import { createAudio } from './engine/audio.js';
import { createPointer } from './engine/pointer.js';
import { createLabels } from './engine/labels.js';
import { createFx } from './engine/fx.js';
import { createProps } from './engine/props.js';
import { createHud } from './engine/hud.js';
import { createProgress } from './engine/progress.js';
import { createLevelRunner } from './engine/level.js';
import { chapters, findLevel } from './engine/registry.js';
import { installDebug } from './engine/debug.js';
import { h } from './engine/dom.js';
import { icon } from './engine/icons.js';
import { createWorld } from './world/world.js';

const app = document.getElementById('app');
const progress = createProgress();
const stage = createStage(app);
const controls = createControls(stage);
const audio = createAudio(() => progress.settings());
const pointer = createPointer(stage, controls, audio);
const labelLayer = h('div.labels');
const fxLayer = h('div.fx-layer');
app.append(labelLayer, fxLayer);
const labels = createLabels(stage, labelLayer);
const fx = createFx(stage, fxLayer, pointer);
const props = createProps(stage);
const hud = createHud(app, { audio, progress, controls });

const E = { stage, controls, audio, pointer, labels, fx, props, hud, progress, chapters, screenScope: null, levels: null };

const nav = {
  toMap: (chapterId) => world.show(chapterId),
};
const levels = createLevelRunner(E, nav);
E.levels = levels;
const world = createWorld(E, { openLevel: (lv) => levels.start(lv) });

installDebug(E, levels, world);

// 首屏：一个大「开始」按钮，顺便解锁声音和朗读（iPad 必须在点按里解锁）
const params = new URLSearchParams(location.search);
const direct = params.get('level');
const directLevel = direct ? findLevel(direct) : null;

window.addEventListener('pointerdown', () => audio.unlock(), { once: true, capture: true });

if (directLevel) {
  levels.start(directLevel);
} else {
  world.show();
  const start = h('div.start', {}, [
    h('div.start-card', {}, [
      h('h1', {}, '规矩古国'),
      h('p', {}, '用绳、桩、规、矩，帮河谷里的村民解决麻烦。'),
      h('button.btn.primary.start-btn', { type: 'button', onclick: () => {
        audio.unlock();
        audio.play('success');
        start.classList.add('gone');
        setTimeout(() => start.remove(), 500);
      } }, [icon('play', { size: 32 }), h('span', {}, '开始')]),
    ]),
  ]);
  app.appendChild(start);
}
