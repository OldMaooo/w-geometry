// 5-3 尖斗和直筒 · 三次才倒满
// 尖斗（圆锥）和直筒一样粗、一样高。先猜尖斗要倒几次直筒才满，再拖尖斗去倒：水位升到三分之一，倒三次正好满。
// 再换方尖斗（四棱锥）和方筒，一样是三次。
import * as THREE from 'three';
import { defineLevel } from '../../engine/level.js';
import { v3, C, wf } from './kit.js';
import { makeVessel, dragToPour, pour, refill, makeDropRing } from './vessel.js';

const H = 3;
const X_CONE = -5.2, X_CYL = 1.8;
const ROUNDS = [
  { kind: 'cone', top: 'cyl', r: 1.5, name: '尖斗', tubeName: '直筒', wall: '#D9775F', tube: '#CFE3EA' },
  { kind: 'pyr', top: 'box', w: 2.7, name: '方尖斗', tubeName: '方筒', wall: '#8E7AB5', tube: '#CFE3EA' },
];

/** 尖斗的小木架：三条腿托住尖尖。 */
function stand(ctx, x, h) {
  const g = new THREE.Group();
  g.position.set(x, 0, 0);
  const m = new THREE.MeshLambertMaterial({ color: C.wood });
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.5;
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, h + 0.1, 0.16), m);
    leg.position.set(Math.cos(a) * 0.38, h / 2, Math.sin(a) * 0.38);
    leg.rotation.set(Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35);
    leg.castShadow = true;
    g.add(leg);
  }
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.12, 14), new THREE.MeshLambertMaterial({ color: C.woodDark }));
  ring.position.y = h - 0.08;
  ring.castShadow = true;
  g.add(ring);
  ctx.add(g);
  return g;
}

export default defineLevel({
  id: 'ch5-l3',
  title: '尖斗和直筒',
  concept: '锥体·三分之一',
  brief: '量谷子的尖斗，和直筒一样粗、一样高。用尖斗往直筒里舀，要几斗才满？',
  discovery: '尖的只有直的三分之一，不管是圆的还是方的。',

  async setup(ctx) {
    const { props } = ctx;
    props.ground({ w: 24, d: 11, seed: 53, river: null, trees: 6 });
    ctx.view.shadow({ x: 0, z: 0 }, 14);
    ctx.view.frame({ x: -1.6, z: 0 }, 7.6, { instant: true, y: 1.4 });
    const helper = props.villager({ x: 5.6, z: 2.4, color: '#8E7AB5', face: -0.7 });
    let firstRight = false;

    for (let ri = 0; ri < ROUNDS.length; ri++) {
      ctx.hud.progress(ri, ROUNDS.length);
      const R = ROUNDS[ri];
      const standH = 0.85;
      const st = stand(ctx, X_CONE, standH);
      const funnel = makeVessel(ctx, {
        kind: R.kind, r: R.r, w: R.w, h: H, x: X_CONE, y: standH, z: 0, liquid: C.water, wall: R.wall, opacity: 0.5,
      });
      const tube = makeVessel(ctx, {
        kind: R.top, r: R.r, w: R.w, h: H, x: X_CYL, z: 0, liquid: C.water, wall: R.tube, opacity: 0.42, inset: 0.95,
      });
      funnel.setVol(funnel.cap);
      const lblF = ctx.labels.add(v3(X_CONE, standH + H, 0), R.name, { cls: 'tag', dy: 0.9 });
      const lblT = ctx.labels.add(v3(X_CYL, H, 0), R.tubeName, { cls: 'tag', dy: 0.9 });
      tube.addTicks([{ h: H / 3, base: '#7A5A36', major: true }, { h: (2 * H) / 3, base: '#7A5A36', major: true }]);
      ctx.fx.pop(funnel.group, { duration: 380 });
      ctx.fx.pop(tube.group, { duration: 380 });
      const hw = funnel.hw;
      props.hitBox(hw * 2 + 0.6, H + 0.3, hw * 2 + 0.6, funnel.group);

      // ---- 先猜（只有第一组） ----
      if (ri === 0) {
        const pick = await ctx.choose({
          prompt: '先猜：尖斗要倒几次，直筒才满？',
          options: [1.5, 2, 3, 4].map((v) => ({ label: `${v} 次`, value: v })),
          answer: 3,
        });
        ctx.recordGuess('volume', pick, 3, '次');
        firstRight = pick === 3;
      } else {
        ctx.hud.task('换成方的：方尖斗和方筒。倒几次才满？');
      }

      // ---- 倒 ----
      if (ri === 0) ctx.hud.task('把尖斗拖到直筒上，倒进去。倒几次才满？');
      const drop = makeDropRing(ctx, { x: X_CYL, z: 0, r: hw + 1.2 });
      const counts = [];
      let waiters = [];
      tube.onVol = (vol, prev) => {
        for (let k = 1; k <= 3; k++) {
          const lvl = (tube.cap * k) / 3;
          if (prev < lvl - 1e-6 && vol >= lvl - 1e-6) {
            if (k < 3) tube.lightTick(k - 1, true);
            ctx.audio.play(k === 3 ? 'star' : 'count', { n: k * 2 });
            ctx.say(`${k} 次`);
            counts.push(ctx.labels.add(v3(X_CYL + hw + 0.45, (H * k) / 3, 0), String(k), { cls: k === 3 ? 'num ok' : 'num lit', dy: -0.1 }));
            if (k === 3) ctx.fx.sparkle({ x: X_CYL, z: 0 }, { size: hw * 2 });
          }
        }
      };
      let n = 0;
      let handle;
      const poured = () => wf(ctx, (res) => { waiters.push(res); });
      handle = dragToPour(ctx, funnel, tube, {
        near: hw + 2.2, lift: 0.4, drop,
        onPour: async (home) => {
          await pour(ctx, funnel, tube, { home, amount: funnel.cap });
          n++;
          if (n < 3) {
            await refill(ctx, funnel);
            handle.enabled = true;
          }
          const w = waiters; waiters = [];
          w.forEach((f) => f());
        },
      });
      let pending = poured();
      ctx.hint({
        text: '按住尖斗，拖到直筒上面倒。',
        ghost: () => ctx.fx.ghostHand(v3(X_CONE, 1.9, 0), v3(X_CYL, 1.8, 0)),
        demo: async () => { const p = poured(); await ctx.pointer.simulateDrag(handle, v3(X_CYL, 0, 0), { duration: 800 }); await p; },
      });
      for (let i = 0; i < 3; i++) {
        await pending;
        if (i < 2) {
          ctx.nudge(i === 0 ? '才一次，只到三分之一。再倒。' : '两次了，还差一点。再倒一次。', { speak: true });
          pending = poured();
        }
      }
      ctx.hint(null);
      handle.dispose();
      ctx.remove(drop.ring);
      helper.cheer();
      ctx.nudge(`倒三次，正好满！尖的只有直的三分之一。`, { kind: 'good' });
      await ctx.wait(3200);
      counts.forEach((l) => l.remove());
      lblF.remove();
      lblT.remove();
      if (ri < ROUNDS.length - 1) {
        for (const o of [funnel.group, tube.group, st]) ctx.remove(o);
        await ctx.wait(300);
      }
    }
    ctx.hud.progress(ROUNDS.length, ROUNDS.length);
    ctx.complete({ stars: firstRight ? 3 : 2 });
  },
});
