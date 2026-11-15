// 关卡契约 defineLevel + 关卡上下文 ctx + 关卡运行器（进关、提示、自动演示、过关、清场）。
import * as THREE from 'three';
import * as geo from '../geo/index.js';
import { Scope, swallowCancel } from './scope.js';
import { nextLevel } from './registry.js';
import { disposeTree } from './shared.js';

/**
 * @typedef {object} LevelDef
 * @property {string} id          如 'ch1-l1'（全局唯一，?level= 用它）
 * @property {string} title       如 '量田埂'
 * @property {string} concept     如 '长度·单位'
 * @property {string} brief       一句话的麻烦（进关时显示并朗读）
 * @property {string} [discovery] 这一关的小发现（结算时显示）
 * @property {(ctx: Ctx) => (void | Promise<void>)} setup  搭场景、跑整个关卡流程（可以是 async）
 * @property {(ctx: Ctx, dt: number) => void} [update]    每帧（可选）
 * @property {(ctx: Ctx) => void} [teardown]              离开时（可选；场景、事件、定时器、DOM 引擎会自动清）
 * @property {import('./registry.js').Chapter} [chapter]  注册时自动填
 * @property {number} [index]                              注册时自动填
 */

/** @param {LevelDef} def @returns {LevelDef} */
export function defineLevel(def) {
  for (const k of ['id', 'title', 'brief', 'setup']) {
    if (!def[k]) throw new Error(`defineLevel(${def.id || '?'}): 缺少 ${k}`);
  }
  return def;
}

/**
 * @typedef {object} Hint 当前这一步的三档提示
 * @property {string} text                     第一档：一句话方向提示
 * @property {() => (void | (() => void) | {stop: () => void})} [ghost]  第二档：幽灵虚影示范（返回停止函数可选）
 * @property {() => Promise<void>} [demo]      第三档：自动演示这一步（__geo.solve() 也用它）
 * @property {boolean} [quiet]                 不显示「想一想」按钮（比如「先猜」类的点选），demo 只给 solve 用
 */

/**
 * 关卡运行器。
 * @param {any} E 引擎（main.js 里装好的一包：stage controls pointer audio fx labels props hud progress）
 * @param {{ toMap: (focus?: string) => void }} nav
 */
export function createLevelRunner(E, nav) {
  /** @type {null | { def: LevelDef, ctx: Ctx, scope: Scope }} */
  let cur = null;

  function stop() {
    if (!cur) return;
    const { def, ctx, scope } = cur;
    cur = null;
    try { def.teardown?.(ctx); } catch (e) { console.error(e); }
    E.pointer.cancel();
    E.audio.hush();
    E.hud.clearLevel();
    scope.dispose();
  }

  /** @param {LevelDef} def */
  function start(def) {
    stop();
    E.screenScope?.dispose?.();
    const scope = new Scope(E.stage);
    const ctx = makeCtx(E, def, scope, api);
    cur = { def, ctx, scope };
    E.hud.levelMode({
      code: `${def.chapter?.order ?? ''}-${(def.index ?? 0) + 1}`,
      title: def.title,
      back: () => { E.audio.play('tap'); nav.toMap(def.chapter?.id); },
      restart: () => { E.audio.play('tap'); start(def); },
      hint: () => ctx._hintPress(),
    });
    E.controls.reset();
    if (def.update) scope.onFrame((dt) => def.update(ctx, dt));
    E.hud.task(def.brief);
    Promise.resolve()
      .then(() => def.setup(ctx))
      .catch(swallowCancel);
    return ctx;
  }

  const api = {
    start,
    stop,
    get current() { return cur?.def || null; },
    get ctx() { return cur?.ctx || null; },
    /** 强制过关（走正常结算流程）。 */
    complete(stars = 3) { cur?.ctx.complete({ stars, forced: true }); },
    /** 自动把这一关玩完：先猜就答正确值，其它步骤调当前提示的 demo。 */
    async solve() {
      if (!cur) return false;
      const { ctx, scope } = cur;
      ctx._solving = true;
      try {
        for (let i = 0; i < 120 && scope.alive && !ctx.done; i++) {
          if (E.hud.guessing) {
            E.hud.autoAnswer(ctx._pendingAnswer);
            await scope.wait(700);
          } else if (ctx._hint?.demo && !ctx._demoRunning) {
            const h = ctx._hint;
            await ctx._runDemo(h);
            await scope.wait(250);
          } else {
            await scope.wait(250);
          }
        }
      } catch (e) { swallowCancel(e); }
      return ctx.done;
    },
    nav,
  };
  return api;
}

/**
 * @typedef {ReturnType<typeof makeCtx>} Ctx
 */

/**
 * @param {any} E @param {LevelDef} def @param {Scope} scope @param {any} runner
 */
function makeCtx(E, def, scope, runner) {
  const { stage, pointer, labels, fx, props, hud, audio, progress, controls } = E;
  const eyeLog = [];
  const eyeBefore = {};
  for (const k of ['length', 'area', 'angle', 'height', 'volume']) {
    const arr = progress.eye(k);
    eyeBefore[k] = arr.length ? arr[arr.length - 1] : null;
  }
  let hintTier = 0;
  let hintsUsed = 0;
  let hintPresses = 0;
  let ghostStop = null;

  const track = (h, kill) => { scope.add(() => kill(h)); return h; };

  const ctx = {
    def,
    id: def.id,
    THREE,
    geo,
    /** 这一关的根节点（往里加的东西换关时自动清）。 */
    scene: stage.root,
    camera: stage.camera,
    /** 关卡自己的状态（__geo.state 能看到），随便放。 */
    state: /** @type {Record<string, any>} */ ({}),
    done: false,
    _solving: false,
    _demoRunning: false,
    /** @type {Hint|null} */
    _hint: null,
    _pendingAnswer: undefined,
    get alive() { return scope.alive; },
    /** 正在自动演示 / solve 中（关卡可以据此跳过等待）。 */
    get auto() { return ctx._solving || ctx._demoRunning; },
    /** 最多用到第几档提示（0 = 没用）。 */
    get hintsUsed() { return hintsUsed; },
    /** 一共按了几次「想一想」（算某一段用没用提示：前后相减）。 */
    get hintPresses() { return hintPresses; },

    /** 把物体加进场景。 */
    add(obj) { stage.root.add(obj); return obj; },
    /** 提前拆掉一个物体（释放它的几何体；共享材质不动）。 */
    remove(obj) { if (!obj) return; const o = obj.group || obj; o.removeFromParent(); disposeTree(o); },

    props,
    view: {
      /** 让一块区域装进画面：center {x,z}，radius 半径，opt {yaw,pitch(度), instant} */
      frame: (center, radius, opt) => controls.frame(center, radius, opt),
      setTop: (on) => controls.setTop(on),
      isTop: () => controls.isTop(),
      reset: (opt) => controls.reset(opt),
      /** 阴影只覆盖这块区域（关卡场景不大时调一次，阴影更清楚）。 */
      shadow: (center, r) => stage.focusShadow(center.x, center.z, r),
    },

    pointer: {
      /** @type {(obj: THREE.Object3D, opts?: import('./pointer.js').DragOpts) => any} */
      draggable: (obj, opts) => track(pointer.draggable(obj, opts), (h) => h.dispose()),
      tappable: (obj, onTap, opts) => track(pointer.tappable(obj, onTap, opts), (h) => h.dispose()),
      /** 假手拖拽（自动演示用），走同一套回调。 */
      simulateDrag: (h, to, opt) => scope.guard(pointer.simulateDrag(h, to, opt)),
      simulateTap: (h) => pointer.simulateTap(h),
      groundPoint: pointer.groundPoint,
      toScreen: pointer.toScreen,
    },

    labels: {
      /** 贴在物体 / 点上的标签。cls: num | tag | say | big | soft */
      add: (target, text, opts) => track(labels.add(target, text, opts), (l) => l.remove()),
    },

    fx: {
      tween: (o) => trackTween(fx.tween(o)),
      to: (target, vals, ms, opt) => trackTween(fx.to(target, vals, ms, opt)),
      pop: (obj, opt) => trackTween(fx.pop(obj, opt)),
      sprout: (obj, opt) => trackTween(fx.sprout(obj, opt)),
      wobble: (obj, opt) => trackTween(fx.wobble(obj, opt)),
      celebrate: (at, opt) => track(fx.celebrate(at, opt), (c) => c.cancel()),
      sparkle: (at, opt) => fx.sparkle(at, opt),
      /** 幽灵手：from → to 来回示范。 */
      ghostHand: (from, to, opt) => track(fx.ghostHand(from, to, opt), (g) => g.stop()),
      EASE: fx.EASE,
    },

    audio: { play: audio.play, say: audio.say },

    hud: {
      task: (text, opt) => hud.task(text, opt),
      progress: (i, n) => hud.progress(i, n),
      /** 工具栏按钮 { icon, label, onTap, primary, hidden } → 句柄 { show hide enable pulse set remove tap } */
      tool: (d) => track(hud.tool(d), (t) => t.remove()),
      /** 在底部显示一句提示语（不是输入框）；传空字符串收起。 */
      prompt: (text) => hud.prompt(text),
    },

    /** 说一句（只朗读，不显示）。 */
    say: (text) => audio.say(text),

    /** 温和反馈：「再调一调」之类，一句话 + 软音。kind:'good' 是夸一句。 */
    nudge: (text, opt) => hud.nudge(text, opt),

    /** 等一会儿（离开关卡自动作废）。演示 / solve 时会缩短。 */
    wait: (ms) => scope.wait(ctx.auto ? Math.min(ms, 400) : ms),
    /** 等某件事发生：ctx.waitFor(done => { ...时机到了调 done(value) }) */
    waitFor: (exec) => scope.promise((resolve) => exec(resolve)),
    after: (ms, fn) => scope.after(ms, fn),
    every: (ms, fn) => scope.every(ms, fn),
    onUpdate: (fn) => scope.onFrame(fn),
    /** 离开关卡时要做的清理。 */
    onDispose: (fn) => scope.add(fn),

    /** 整数随机 [a, b]。 */
    rand: (a, b) => a + Math.floor(Math.random() * (b - a + 1)),

    /**
     * 先猜（步进器）。自动记眼力。返回猜的数。
     * @param {{ kind: 'length'|'area'|'angle'|'height'|'volume', actual: number, prompt: string,
     *   min?: number, max?: number, step?: number, start?: number, unit?: string }} o
     */
    async guess(o) {
      ctx._pendingAnswer = o.actual;
      setHint(null);
      hud.hintState(hintTier, false);
      const v = await scope.guard(hud.guess(o));
      hud.hintState(hintTier, !!ctx._hint && !ctx._hint.quiet);
      ctx.recordGuess(o.kind, v, o.actual, o.unit);
      return v;
    },
    /**
     * 点选几个选项之一。answer 是 solve 时自动选的那个。
     * @template T @param {{ prompt: string, options: {label:string, value:T, icon?:string}[], answer: T }} o @returns {Promise<T>}
     */
    async choose(o) {
      ctx._pendingAnswer = o.answer;
      setHint(null);
      hud.hintState(hintTier, false);
      const v = await scope.guard(hud.choose(o));
      hud.hintState(hintTier, !!ctx._hint && !ctx._hint.quiet);
      return v;
    },
    /**
     * 记一次眼力（自定义先猜方式时自己调，比如点选「哪块最大」）。
     * @param {string} kind @param {number|string} g @param {number|string} actual @param {string} [unit] @param {number} [acc] 不给就按数值算
     */
    recordGuess(kind, g, actual, unit = '', acc) {
      const a = acc ?? geo.guessAccuracy(Number(g), Number(actual));
      eyeLog.push({ kind, guess: g, actual, unit, acc: a });
      progress.recordEye(kind, a);
      return a;
    },
    /** 这一关记下的所有眼力。 */
    eyeLog: () => [...eyeLog],

    /**
     * 设定当前这一步的提示（三档）。传 null 收起（比如在播动画时）。
     * @param {Hint|null} h
     */
    hint: (h) => setHint(h),

    /**
     * 过关：结算面板（星 + 眼力 + 小发现 + 智慧卡）。
     * @param {{ stars: number, discovery?: string, forced?: boolean, delay?: number }} r
     */
    async complete(r) {
      if (ctx.done) return;
      ctx.done = true;
      setHint(null);
      hud.hintState(hintTier, false);
      hud.prompt('');
      const stars = Math.max(1, Math.min(3, Math.round(r.stars)));
      const solo = !r.forced && !ctx._solving && hintsUsed === 0;
      progress.recordLevel(def.id, stars, solo);
      const card = (def.chapter?.cards || []).find((c) => c.unlockBy === def.id);
      const newCard = card && progress.addCard(card.id) ? card : null;
      const better = eyeLog.some((e) => eyeBefore[e.kind] !== null && Math.round(e.acc * 100) > eyeBefore[e.kind]);
      const target = controls.target;
      ctx.fx.celebrate({ x: target.x, z: target.z }, { count: 110 });
      audio.play('success');
      await scope.wait(r.delay ?? 1100);
      const nx = nextLevel(def);
      const choice = await scope.guard(hud.result({
        stars, discovery: r.discovery ?? def.discovery, eye: eyeLog, better, card: newCard, solo, hasNext: !!nx,
      }));
      if (choice === 'next' && nx) runner.start(nx);
      else if (choice === 'again') runner.start(def);
      else runner.nav.toMap(def.chapter?.id);
    },

    // ---- 引擎内部用 ----
    _hintPress() {
      const h = ctx._hint;
      if (!h || ctx._demoRunning) return;
      hintPresses++;
      hintTier = Math.min(3, hintTier + 1);
      if (hintTier === 2 && !h.ghost) hintTier = 3;
      if (hintTier === 3 && !h.demo) hintTier = 2;
      hintsUsed = Math.max(hintsUsed, hintTier);
      hud.hintState(hintTier, true);
      if (hintTier === 1) hud.nudge(h.text, { kind: 'hint' });
      else if (hintTier === 2) {
        stopGhost();
        audio.say(h.text);
        const g = h.ghost?.();
        ghostStop = typeof g === 'function' ? g : g && g.stop ? () => g.stop() : null;
      } else if (hintTier === 3) ctx._runDemo(h);
    },
    async _runDemo(h) {
      if (!h.demo || ctx._demoRunning) return;
      stopGhost();
      ctx._demoRunning = true;
      hud.hintState(hintTier, false);
      try { await h.demo(); } catch (e) { swallowCancel(e); }
      ctx._demoRunning = false;
      if (scope.alive && !ctx.done) hud.hintState(hintTier, !!ctx._hint && !ctx._hint.quiet);
    },
  };

  function stopGhost() { if (ghostStop) { try { ghostStop(); } catch { /* 已停 */ } ghostStop = null; } }
  function setHint(h) {
    if (h !== ctx._hint) { stopGhost(); hintTier = 0; }
    ctx._hint = h;
    if (!ctx._demoRunning) hud.hintState(hintTier, !!h && !h.quiet && !hud.guessing);
  }
  function trackTween(tw) {
    const rm = scope.add(() => tw.cancel());
    tw.promise.then(rm);
    return scope.guard(tw.promise);
  }
  scope.add(stopGhost);

  return ctx;
}
