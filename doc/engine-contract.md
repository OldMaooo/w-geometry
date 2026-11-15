# 引擎使用手册（engine-contract）

> 给做第 2–6 章的工程师看。**只读这一份 + 看 `src/chapters/ch1-fields/` 的代码就能开工。**
> 以代码为准；本文件和代码不一致时，以 `src/engine/*.js` 里的 JSDoc 为准，并回改本文件。
> 最近更新：2026-11-15（S1 首版）。

## 0. 三条铁律（违反了协调者验收不过）

1. **只改自己的目录** `src/chapters/chN-xxx/`。不许改 `src/engine/`、`src/geo/`、`src/world/`、别的章。
   引擎缺能力：先在本章目录里补（像 ch1 的 `kit.js`、`cutter.js`），交付报告写「建议提升到引擎」。
2. **零键盘、不出现「错」**：数字只能用 `ctx.guess`（步进器）/ `ctx.choose`（点选）；做得不对只用 `ctx.nudge('再调一调')` + 世界后果（弹回、摇一摇、没长满），不许红叉、扣分、倒计时。
3. **先猜后量**：有数量的关卡先 `ctx.guess`，引擎自动记眼力。

## 1. 新建一章（3 步，不用改任何公共文件）

```
src/chapters/ch2-compass/
  index.js        章信息（defineChapter）
  l1-well.js      每关一个文件（defineLevel）
  ...
  map-decor.js    （可选）地图上这一章的样子
  kit.js          （可选）本章共用小工具
```

`index.js`：

```js
import { defineChapter } from '../../engine/registry.js';
import l1 from './l1-well.js';
// ... l2–l6

export default defineChapter({
  id: 'ch2',                 // 章 id
  order: 2,                  // 第几章（1–6），决定地图上哪块区域、解锁顺序
  name: '规矩',
  intro: '田分好了，古国要建城。用一根拴在桩上的绳子画圆。', // 一句话，地图侧栏里显示并朗读
  levels: [l1 /*, l2, ... */],
  cards: [                   // 本章智慧卡（2–3 张）
    { id: 'ch2-euclid', title: '几何原本', icon: 'book', unlockBy: 'ch2-l2',
      lines: ['两千多年前，欧几里得写了一本书。', '第一页就教人用圆规画等边三角形。'] },
  ],
  mapDecor,                  // 可选，见第 8 节
});
```

存盘后刷新：`import.meta.glob('../chapters/*/index.js')` 自动扫到，地图上那块区域从「还在修建」变成可进。
关卡 id 必须全局唯一，约定 `chN-lM`（如 `ch2-l3`）。

## 2. 关卡文件（最小可抄示例）

```js
// src/chapters/ch2-compass/l1-well.js
import { defineLevel } from '../../engine/level.js';
import { PALETTE } from '../../engine/palette.js';

export default defineLevel({
  id: 'ch2-l1',
  title: '画一口圆井',
  concept: '圆·一样远',
  brief: '村里要挖一口圆井。井边每一处离中心都要一样远。',   // 进关时显示在任务条并朗读
  discovery: '圆上的每一点，到中心都一样远。',               // 结算面板「小发现」

  async setup(ctx) {
    const { props, geo } = ctx;
    // 1) 搭场景
    props.ground({ w: 20, d: 14, seed: 7 });
    ctx.view.frame({ x: 0, z: 0 }, 8, { instant: true });
    ctx.view.shadow({ x: 0, z: 0 }, 14);
    const center = props.stake({ x: 0, z: 0 });
    const tip = props.stake({ x: 3, z: 0 });

    // 2) 先猜（自动记眼力）
    const g = await ctx.guess({ kind: 'length', actual: 3, prompt: '先猜：绳子几步长？', min: 1, max: 8, unit: '步' });

    // 3) 动手：拖一根桩；用 waitFor 等「做成了」
    ctx.hud.task('拖动桩子，绕中心转一圈。');
    const done = ctx.waitFor((resolve) => {
      const h = ctx.pointer.draggable(tip, {
        snap: (p) => { /* 把 p 改成吸附后的位置并返回 */ return p; },
        onEnd: (p) => { if (/* 到位了 */ true) resolve(); else ctx.nudge('再调一调。'); },
      });
      // 4) 这一步的三档提示（第三档 demo 也是 __geo.solve() 用的）
      ctx.hint({
        text: '按住桩子，绕着中间那根走一圈。',
        ghost: () => ctx.fx.ghostHand(tip.position.clone(), new ctx.THREE.Vector3(-3, 0, 0)),
        demo: () => ctx.pointer.simulateDrag(h, new ctx.THREE.Vector3(-3, 0, 0)),
      });
    });
    await done;
    ctx.hint(null);

    // 5) 世界给后果 + 过关
    await ctx.fx.pop(props.water({ x: 0, z: 0, w: 4, d: 4 }));
    ctx.complete({ stars: geo.starsByError(Math.abs(g - 3), 0, 1) });
  },
});
```

要点：

- `setup` 可以写成一条 `async` 流程，从头写到 `ctx.complete`。**离开关卡时引擎会让所有 `ctx.wait / waitFor / guess / fx.*` 的 Promise 作废**，后面的代码不会再跑，不用自己判断。
- 场景物体、拖拽句柄、标签、补间、定时器、每帧回调、工具栏按钮——**只要是通过 `ctx` 建的，换关自动清**。`teardown` 一般不用写。
- 不要直接 `import * as THREE` 去 new 一堆东西又挂到别处；要挂就用 `ctx.add(obj)`（挂到关卡根节点）。

## 3. 坐标与单位

- **1 个世界单位 = 1 步**。x 向右，z 朝镜头（俯视时 z 越大越靠下），y 向上。地面 y = 0。
- 关卡里说的「往远处 / 往上」= z 减小。
- 纯几何计算用 `src/geo/` 的函数，点是 `{x, y}`；把世界 `{x, z}` 当成 `{x, y: z}` 传进去即可（面积、切割、距离都不受影响，ch1 的 `kit.js` 有 `toG / toW`）。

## 4. ctx 能力一览

| 能力 | 签名 | 说明 |
|---|---|---|
| `ctx.props.*` | 见第 5 节 | 通用道具，建好自动加进场景 |
| `ctx.add(obj)` | `→ obj` | 自己 new 的 three 物体挂进关卡 |
| `ctx.remove(obj)` | | 提前拆掉一个物体（释放几何体），也接受 `{group}` |
| `ctx.THREE` / `ctx.geo` | | three 和几何数学库 |
| `ctx.view.frame(center, radius, opt?)` | `center {x,z}`，`radius` 世界单位，`opt {yaw, pitch(度), instant, y}` | 镜头平滑飞过去，让这块区域装进画面 |
| `ctx.view.setTop(bool)` / `isTop()` / `reset(opt?)` | | 俯视 / 斜视（右下角按钮玩家也能切） |
| `ctx.view.shadow(center, r)` | | 阴影只覆盖这块，场景小就调小，阴影更清楚 |
| `ctx.pointer.draggable(obj, opts)` | `→ handle` | 见第 6 节 |
| `ctx.pointer.tappable(obj, onTap, opts?)` | `→ handle` | 点一下；`opts {hit, radius, priority}` |
| `ctx.pointer.simulateDrag(handle, to, {duration})` | `→ Promise` | 假手拖拽，走同一套回调（demo 用） |
| `ctx.pointer.simulateTap(handle)` | | 假手点（拖拽句柄的 onTap / tappable） |
| `ctx.pointer.groundPoint(clientX, clientY, y?)` / `toScreen(v3)` | | 屏幕 ↔ 地面 |
| `ctx.labels.add(target, text, opts?)` | `target` 物体或 `Vector3`；`→ label {set, show, cls, remove, target}` | 3D 上的文字，见第 7 节 |
| `ctx.fx.tween({duration, ease, delay, onUpdate(k)})` | `→ Promise` | 通用补间，`k` 0→1 |
| `ctx.fx.to(target, {x:…}, ms, {ease, delay})` | `→ Promise` | 把数字属性补间过去（`obj.position` / `obj.scale` / `material`） |
| `ctx.fx.pop(obj, opt)` / `sprout(obj)` / `wobble(obj)` | `→ Promise` | 弹出来 / 竖着长出来 / 摇一摇（「不太对」的世界反馈） |
| `ctx.fx.celebrate({x,z}, {count})` | | 彩纸（`complete` 时引擎自动放一次） |
| `ctx.fx.sparkle({x,z}, {color, size})` | | 地上一圈闪光（做对一步） |
| `ctx.fx.ghostHand(fromV3, toV3, {loops})` | `→ {stop}` | 幽灵手示范拖拽（提示第二档） |
| `ctx.fx.EASE` | | `linear out in inOut back elastic` |
| `ctx.audio.play(name, opt?)` | | 音效，见第 9 节 |
| `ctx.say(text)` | | 只朗读 |
| `ctx.hud.task(text)` | | 顶部任务条（一两句话，自动朗读，旁边有重听按钮） |
| `ctx.hud.progress(i, n)` | | 任务条下的进度小圆点（第 i 轮 / 共 n 轮） |
| `ctx.hud.tool({icon, label, onTap, primary, hidden})` | `→ {show hide enable pulse set remove tap visible}` | 底部工具栏按钮 |
| `ctx.hud.prompt(text)` | | 底部一句引导语（不是输入框），`''` 收起 |
| `ctx.guess({...})` | `→ Promise<number>` | 先猜步进器，见第 10 节 |
| `ctx.choose({prompt, options, answer})` | `→ Promise<value>` | 几个大按钮点选一个；`answer` 是 solve 自动选的 |
| `ctx.recordGuess(kind, guess, actual, unit?, acc?)` | | 自定义先猜方式（如「点最大的那块」）时手动记眼力 |
| `ctx.hint({text, ghost, demo, quiet})` / `ctx.hint(null)` | | 当前这一步的三档提示，见第 11 节 |
| `ctx.nudge(text, {kind})` | | 温和反馈气泡 + 软音 + 朗读；`kind:'good'` 是夸一句 |
| `ctx.wait(ms)` | `→ Promise` | 等一会儿；solve / 演示时自动缩到 ≤400ms |
| `ctx.waitFor(done => …)` | `→ Promise` | 等某件事：时机到了调 `done(value)` |
| `ctx.after(ms, fn)` / `ctx.every(ms, fn)` / `ctx.onUpdate((dt,t)=>…)` / `ctx.onDispose(fn)` | | 定时器 / 每帧 / 离开时，全部自动清 |
| `ctx.rand(a, b)` | | 整数随机 `[a, b]` |
| `ctx.complete({stars, discovery?, delay?})` | | 过关：彩纸 → 结算面板 → 下一关 / 回地图 / 再玩 |
| `ctx.state` | `{}` | 随便放本关状态，`__geo.state` 能看到（调试用） |
| `ctx.hintsUsed` / `ctx.hintPresses` | | 最多用到第几档 / 一共按了几次「想一想」 |
| `ctx.auto` | bool | 正在自动演示或 solve（想跳过某段等待时用） |
| `ctx.done` / `ctx.alive` | bool | 已过关 / 关卡还在 |

## 5. 通用道具（`ctx.props.*`）

全部方块风、平涂、自动加进场景、换关自动清。参数都可省；`parent` 可指定挂到某个组下。

| 道具 | 参数 | 返回 |
|---|---|---|
| `ground({w, d, margin, river, seed, cells, soil, trees, puddles, avoid})` | 中间 w×d 是干活的土地（一格一格有深浅），四周草地 + 树石；`river:'back'`（默认）在远端放一条河，`null` 不放；`puddles` 洪水水洼个数 | Group |
| `stake({x, z, h, color})` | 木桩（高默认 1） | Group（`userData.top` 顶高） |
| `rope({points, closed, every, y, color, knotColor})` | 结绳折线，每 `every` 步一个结（从起点算，起点不算） | `{group, setPoints(pts), setLit(n), knots(), length(), points()}` |
| `plot({x, z, w, d, soil, ridge})` | 长方形田（凹土 + 田埂），左上角在 (x,z) | `{group, w, d, cell(i,j), center(), cellAt(p)}` |
| `polyField({points, color, y, h, edge, opacity})` | 多边形田（斜田、三角田），可半透明（影子田） | Group |
| `mat({x, z})` | 1 步见方的草垫 | Mesh |
| `fence({points, closed, h, color})` | 篱笆，每步一根柱 | `{group, setPoints(pts)}` |
| `villager({x, z, color, face, hat, s})` | 方块小人，会轻轻晃 | `{group, cheer(), face(p)}` |
| `tree({x, z, kind:'round'|'pine', s, seed})` / `rock({x,z,s})` / `tuft({x,z,color})` | 点缀 | Object3D |
| `crops({cells:[{x,z}], kind:'rice'|'grass'|'sprout', per, seed})` | 一堆庄稼（InstancedMesh），起始是缩没的 | `{mesh, grow({stagger, duration, onEach}) → Promise, setAll(s)}` |
| `square({x, z, len})` | 矩（L 形直角尺） | `{group, place(corner, dirA, dirB), ok(bool)}`（ok 变绿发光） |
| `water({x, z, w, d})` | 会起伏的水面 | Mesh |
| `cloud({x, y, z, s, seed})` | 远处的云 | Group |
| `hitBox(w, h, d, parent)` | 隐形碰撞体，让小东西更好抓 | Mesh |
| `animate(obj, (dt, t) => …)` | 给道具挂一个每帧动画（物体被拆掉自动停） | |

色板 `import { PALETTE } from '../../engine/palette.js'`：`soil ridge rice deepGreen river clay rope wood stone skyTop skyBottom gold grass straw skin ink paper`。
共享材质 `import { mat } from '../../engine/shared.js'`：`mat('#C9A66B')` 取一个缓存的平涂材质（不要改它的属性，会影响所有用它的物体；要变色就换一个 `mat(...)`）。

## 6. 拖拽（`ctx.pointer.draggable`）

```js
const h = ctx.pointer.draggable(obj, {
  plane: 0,            // 拖拽平面高度，默认地面
  snap: 1,             // 数字 = 按步长吸附 x/z；函数 (p, raw) => 新位置 | null
  bounds: { minX, maxX, minZ, maxZ },
  onStart(p) {},
  onMove(p, { raw, changed }) {},   // 不给 onMove 时引擎自动把 obj 移到 p
  onEnd(p, { moved }) {},
  onTap() {},          // 按下没动就松开（比如「点一下转半圈」）
  lift: 0.25,          // 拖起来抬高（仅自动移动时）
  hit: someMesh,       // 射线检测用的物体（默认 obj 本身，递归）
  radius: 40,          // 屏幕兜底拾取半径 px（触摸自动 ×1.5）
  ringSize: 0.7,       // 脚下金色光圈半径，0 = 不要
  priority: 0,         // 重叠时谁优先
  silent: false,       // 不播默认的拿起 / 吸附「嗒」/ 放下声
});
h.enabled = false;     // 暂停；h.dispose() 取消
```

- 拾取：先射线；没打中，再找屏幕上离手指最近的句柄（半径内）。小东西加一个 `props.hitBox` 更好抓。
- `snap` 返回的位置每次变化会「嗒」一声（`tick`），这就是吸附手感，**吸附一定要大方**（1 步左右的吸附半径）。
- 拖东西时相机不会动；空地上拖 = 转视角，右键拖 = 转视角，滚轮 / 双指捏合 = 缩放。
- `simulateDrag(h, to)` 从物体当前位置沿直线拖到 `to`（物体位置，不是手指位置），会走 `onStart/onMove/onEnd` 和 `snap`，所以 demo 和真手结果一致。

## 7. 标签（`ctx.labels.add`）

```js
const l = ctx.labels.add(obj或Vector3, '12', { cls: 'num', dy: 0.5, onTap, pop: true });
l.set('13'); l.show(false); l.cls('lit', true); l.target = newV3; l.remove();
```

`cls` 第一个词是样式：`num`（圆形数字泡泡，可加 `lit` 金 / `ok` 绿）、`big`（大数字，`'24<small>块</small>'`）、`tag`（名字条）、`soft`（淡字）、`say`（说话气泡）。
标签是 DOM，挂在点的正上方（底边中点对准那个点）。给了 `onTap` 就变成可点的按钮（如 1-3 的「铺一铺」）。

## 8. 地图上的样子（可选 `mapDecor`）

章节可以导出 `mapDecor(api)`，在地图区域里画自己的小景，**通关过的关要留下看得见的痕迹**：

```js
export function mapDecor({ group, props, THREE, cleared, open, levelOpen, progress, mat, palette }) {
  // group 是区域中心的组（半径约 6.5 的圆台上面，y=0 是台面）
  // cleared: Set<关卡id>，open: 这章开没开
  // 道具记得传 parent: group
}
```

不写 `mapDecor` 时，地图会给 6 个石墩，过了的关插一面金旗。看 `ch1-fields/map-decor.js`。

## 9. 音效名（`ctx.audio.play`）

`tap pick drop tick snap place cut rotate pop whoosh soft good grow success star open`，
报数用 `play('count', { n })`（n 越大音越高），长庄稼用 `play('grow', { n })`。
拖拽的拿起 / 吸附 / 放下、过关、结算、温和反馈的声音引擎已经自动放，不用重复。

## 10. 先猜与眼力

```js
const g = await ctx.guess({
  kind: 'length',   // 'length' | 'area' | 'angle' | 'height' | 'volume'（眼力页按这五类）
  actual: 8,        // 真值（solve 时自动答它；也用来算准确度）
  prompt: '先猜：几步长？',
  min: 1, max: 12, step: 1, start: 6, unit: '步',
});
```

- 步进器：−/+ 按住连加，在数字上左右滑也能改；没有输入框。
- 引擎自动记一条眼力（准确度 = 1 − |猜−真| / 真，0–1），结算面板列出这一关的每次猜测，
  并和这类眼力的上一次比，更准就显示「比上次更准」。
- 点选型的先猜（「点你觉得最大的那块」）：自己用 `tappable` 做，然后 `ctx.recordGuess(kind, 猜的, 真值, 单位, 准确度)`。
- `ctx.choose({ prompt, options: [{label, value}], answer })` 也是一种回答方式，要记眼力就再调 `recordGuess`。

## 11. 提示三档 + 自动演示 + solve

每一步开始时 `ctx.hint({...})`，这一步做完 / 播动画时 `ctx.hint(null)`。玩家按「想一想」：

1. 第一档：`text` 一句话（气泡 + 朗读）
2. 第二档：`ghost()` 幽灵虚影示范（一般就是 `ctx.fx.ghostHand(from, to)`；返回停止函数或 `{stop}`）
3. 第三档：`demo()` 自动做完这一步（用 `simulateDrag / simulateTap / 工具按钮.tap()` 走真实流程）

- **`window.__geo.solve()` 就是反复调「当前提示的 demo」+ 先猜自动答真值**，直到过关。所以每一个需要操作的步骤都必须有 `ctx.hint({ demo })`，否则 solve 会卡住。
- 没有提示按钮、但 solve 要能过的步骤（比如点选型先猜），用 `ctx.hint({ text, quiet: true, demo })`。
- 用了提示不扣星（规格另有规定的除外），只是不加「自己做出来的」小标记。按规格「用了提示少给星」时，用 `ctx.hintsUsed`（最高档）或 `ctx.hintPresses` 前后相减。

## 12. 过关与存档

```js
ctx.complete({ stars: 3, discovery: '可选，覆盖 defineLevel 里的 discovery' });
```

- 星数 1–3（至少 1 颗，没有 0 星）。常用：`ctx.geo.starsByError(误差, 三星阈值, 两星阈值)`。
- 引擎负责：彩纸 + 音效 → 存档（只往好里改）→ 本关解锁的智慧卡（`cards[].unlockBy === 本关 id`）→ 结算面板。
- 存档 key 只有一个 `geo_save`（localStorage），结构：`{ v, lv: {id: {s, solo}}, eye: {length: [0–100…]}, cards: [], set: {sound, voice} }`，每类眼力只留最近 20 次，总量 < 1KB。**章节不要自己写 localStorage**；真要存，key 必须 `geo_` 开头并在报告里说明。
- 解锁：章内顺序解锁；上一章过任意 3 关开下一章。

## 13. 调试

- `/?level=ch2-l1` 直接进关（跳过首屏）；`/?debug=1` 左下角调试条（FPS、选关、solve、complete、stats）。
- 控制台 `window.__geo`：
  - `goto('ch2-l1')` / `goto('map')`
  - `solve()` → `Promise<是否过关>`：自动玩完（和提示第三档同一套代码）
  - `complete(stars?)`：强制过关，走正常结算
  - `state`：当前关卡 id、是否过关、用了几档提示、当前提示文字 + `ctx.state` 里的东西
  - `stats()`：场景物体数 / 拖拽句柄 / 标签 / 补间 / draw calls / 三角面（**换关前后对比查泄漏**：回地图后句柄、标签应回到地图自己的数量）
  - `save()` / `saveBytes()` / `resetSave()`

## 14. 常见坑

1. **solve 卡住**：某一步没设 `ctx.hint({demo})`，或 demo 没真正推动流程（比如拖到了吸附不到的位置）。用 `__geo.state.hint` 看卡在哪一步。
2. **离开关卡后报错**：在 `ctx` 之外起了 `setTimeout` / `requestAnimationFrame` / 自己的 `stage.onFrame`。一律用 `ctx.after / ctx.onUpdate / ctx.wait`。
3. **改了共享材质**：`mat(color)` 和道具里的材质是全局缓存的，改颜色会把全场同色的东西一起改。要高亮就换材质或用 `ctx.fx.sparkle` / 标签。
4. **demo 用的是物体位置，不是手指位置**：`simulateDrag(h, 目标物体位置)`；带偏移的东西（绳头不在桩正中）要算好。
5. **`snap` 函数要返回位置**（可以直接改 `p` 再 `return p`）；返回 `null` = 这一帧不动。
6. **标签太多会糊**：数数时用一个标签跟着跑（看 1-1 的 counter），数完留一个 `big` 结果就够。
7. **文字**：任务条一两句，正文 ≥18px 由样式保证；不要往 HUD 里塞段落。说明能省就省，能朗读。
8. **镜头**：每轮开始 `ctx.view.frame` 到这一轮的区域；radius 给「区域半径 + 2 步」左右，太小东西会出画。
9. **网格对齐**：草垫 / 方块的中心在 `整数 + 0.5`，桩 / 角点在整数上。
10. **形状朝向**：`polyField` 的点就是世界 `{x,z}`；转半圈之类的变换，先把形状建在「以重心为原点」的组里，再转组（看 1-5 的影子田）。

## 15. 第 1 章可以抄的东西

| 想做的 | 看哪里 |
|---|---|
| 拉绳量长度、结一个个亮起报数 | `l1-ridge.js` |
| 从一堆里拖一块出来铺格子、整行铺按钮 | `l2-mats.js` |
| 铺满后「几个一行、几行、一共几块」 | `kit.js` 的 `layMats` / `countOut` |
| 点选型先猜、可点的 3D 标签按钮、周长锁定拖角 | `l3-fence.js` |
| 竖切一刀、拖一块拼过去、拼不上弹回 | `cutter.js`（`l4-slant.js` 用法） |
| 可转半圈的影子形状 + 吸附到边 | `l5-triangle.js` |
| 约束拖拽（绳长固定、边长吸附整数）、矩变绿 | `l6-rope12.js` |
