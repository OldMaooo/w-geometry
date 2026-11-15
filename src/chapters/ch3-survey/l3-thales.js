// 3-3 泰勒斯量高塔 · 等影子和自己一样长
// 拖太阳，等竿影 = 竿高的那一刻（矩发光）；这时量塔影，别忘了塔底下盖住的那半个底座。
import { defineLevel } from '../../engine/level.js';
import { makeSun, makePole, makeTower, makeSeg, measureRope, waitSunRatio, v3 } from './kit.js';
import { showNum } from './math.js';

const H = 9, BASE = 4, TZ = -5;

export default defineLevel({
  id: 'ch3-l3',
  title: '泰勒斯量高塔',
  concept: '影长＝高',
  brief: '邻国有座大石塔，国王想知道它多高。等一个特别的时刻。',
  discovery: '挑对时候，影子多长，塔就多高。别忘了塔底下盖住的那一段。',

  async setup(ctx) {
    ctx.state.toScreen = (x, y, z) => ctx.pointer.toScreen(new ctx.THREE.Vector3(x, y, z)); // 调试 / 自动测试用
    const { props, THREE } = ctx;
    const sun = makeSun(ctx, { s: 0.1, sway: 0, magnets: [1], focus: { x: 0, z: 1, r: 17 } });
    props.ground({ w: 26, d: 22, x: 0, z: 1, seed: 51, river: null, trees: 5, cells: false });
    ctx.view.frame({ x: 1.5, z: 0 }, 11.5, { instant: true, pitch: 50, y: 4 });

    const tower = makeTower(ctx, { x: 0, z: TZ, h: H, base: BASE });
    const pole = makePole(ctx, { x: -5, z: TZ, h: 2 });
    ctx.fx.pop(tower.group);
    const poleLbl = ctx.labels.add(v3(pole.x, 2.2, pole.z), '竿 2', { cls: 'tag', pop: false });
    const shLbl = ctx.labels.add(pole.tipPos, '', { cls: 'tag', pop: false });
    const upd = () => {
      pole.update(sun.dir, sun.ratio);
      tower.update(sun.dir, sun.ratio);
      shLbl.target = v3(pole.tipPos.x, 0.5, pole.tipPos.z);
      shLbl.set(`影 ${showNum(pole.len)}`);
    };
    sun.onChange(upd);
    upd();
    void poleLbl;

    const g = await ctx.guess({ kind: 'height', actual: H, prompt: '先猜：这座塔有几步高？', min: 2, max: 16, start: 7, unit: '步' });

    ctx.hud.task('拖动太阳，等竿的影子和竿一样长。');
    await waitSunRatio(ctx, sun, { ratio: 1, hintText: '拖太阳，直到竿旁边的矩发光。', nudgeText: '还不是，要让影子和竿一样长。' });
    sun.lock(true);
    const sq = props.square({ len: 2 });
    sq.place({ x: pole.x, z: pole.z }, { x: 0, z: 1 }, { x: 1, z: 0 });
    sq.ok(true);
    pole.setOk(true);
    ctx.audio.play('good');
    ctx.fx.sparkle({ x: pole.x, z: pole.z }, { color: '#9FE07A', size: 1.4 });
    ctx.nudge('就是现在！影子和竿一样长。', { kind: 'good' });
    await ctx.wait(1600);

    // 量塔影：从塔底边量到塔尖影
    const E = { x: 0, z: TZ + BASE / 2 };
    const tip = { x: tower.tipPos.x, z: tower.tipPos.z };
    const baseLbl = ctx.labels.add(v3(-BASE / 2 - 0.2, 0.9, TZ), `底座宽 ${BASE}`, { cls: 'tag', pop: false });
    const m = await measureRope(ctx, { from: E, to: tip, every: 1, text: '塔影从塔底边露出来。量一量露出的这一段。', hintText: '把金色绳头拉到塔影子尖上的金圈。', snapR: 1.6 });

    // 被塔盖住的一段（虚线）
    const dashes = [];
    for (let i = 0; i < 4; i++) {
      const a = TZ + i * 0.5 + 0.08, b = a + 0.34;
      dashes.push(makeSeg(ctx, { color: '#F7C948', r: 0.07 }).set(v3(0, 0.12, a), v3(0, 0.12, b)));
    }
    let revealed = false;
    const hidden = BASE / 2;
    let tag;
    const reveal = () => {
      if (revealed) return;
      revealed = true;
      tag.set(`盖住的一段 ${hidden}`);
      tag.cls('lit', true);
      ctx.audio.play('good');
      resolveTap();
    };
    let resolveTap = () => {};
    tag = ctx.labels.add(v3(0, 0.6, TZ + 1), '这一段？', { cls: 'tag', onTap: reveal });
    ctx.hud.task('影子有一截躲在塔底下。点一点虚线上的问号。');
    await ctx.waitFor((done) => {
      resolveTap = done;
      ctx.hint({ text: '塔底宽 4，影子是从塔正中间算起的。点那个「这一段」。', demo: async () => reveal() });
    });
    ctx.hint(null);
    await ctx.wait(900);
    const pressBefore = ctx.hintPresses;

    // 塔有多高
    let wrong = 0;
    const bar = new THREE.Group();
    bar.position.set(3.4, 0.2, TZ);
    ctx.add(bar);
    let H2;
    for (;;) {
      H2 = await ctx.choose({
        prompt: '塔有多高？',
        options: [{ label: `${m.len} 步`, value: m.len }, { label: `${m.len + hidden} 步`, value: m.len + hidden }, { label: `${m.len + BASE} 步`, value: m.len + BASE }],
        answer: m.len + hidden,
      });
      // 把影子立起来，和塔比一比
      while (bar.children.length) ctx.remove(bar.children[0]);
      const stick = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, H2), new THREE.MeshLambertMaterial({ color: '#F2B134' }));
      stick.position.z = H2 / 2;
      bar.add(stick);
      bar.rotation.x = 0;
      ctx.fx.pop(bar);
      await ctx.wait(500);
      await ctx.fx.tween({ duration: 1300, ease: 'inOut', onUpdate: (k) => { bar.rotation.x = -k * Math.PI / 2; } });
      if (H2 === H) break;
      wrong++;
      ctx.fx.wobble(bar, { amp: 0.1 });
      ctx.nudge(H2 < H ? '立起来的影子比塔矮一截。想想被盖住的那段。' : '立起来的影子比塔还高。再想想。');
      await ctx.wait(1800);
      bar.rotation.x = 0;
    }
    ctx.audio.play('good');
    ctx.fx.sparkle({ x: 0, z: TZ }, { color: '#F7C948', size: 2 });
    ctx.labels.add(v3(tower.x, H + 0.8, tower.z), `${H}<small>步</small>`, { cls: 'big' });
    ctx.say(`塔有 ${H} 步高`);
    await ctx.wait(1800);
    void baseLbl; void dashes; void g;
    ctx.complete({ stars: wrong === 0 && ctx.hintPresses === pressBefore && ctx.hintsUsed === 0 ? 3 : 2 });
  },
});
