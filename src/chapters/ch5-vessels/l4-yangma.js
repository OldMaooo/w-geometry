// 5-4 阳马拼方 · 三个尖的拼成一个方的
// 三块一模一样的阳马（底是正方形、尖在一个角正上方的四棱锥）。方块外框一直在，第一块已放好，
// 三块的尖都要碰在同一个金色的角上。点一块选中，用「前后翻 / 左右翻 / 原地转」每次转 90°，转对了拖进方块里就吸住。
// 转的时候可以拖空地转视角，从各个方向看。
import * as THREE from 'three';
import { defineLevel } from '../../engine/level.js';
import { v3, C, wf } from './kit.js';
import { SLOTS, mmul, meq, rot90, rotationPlan, YANGMA_BASE, YANGMA_APEX } from './math.js';

const S = 2.6; // 方块边长（步）
const CUBE = { x: -2, z: 0 };
const COLORS = ['#D9775F', '#E3B04B', '#6FAF9F'];
const PARK = [{ x: 4.6, z: -2.2 }, { x: 4.6, z: 2.2 }];

/** 凸多面体：给点和面（每面一圈点的下标），算出朝外的平涂法线。 */
function solidGeo(verts, faces) {
  const c = verts.reduce((a, p) => a.add(new THREE.Vector3(...p)), new THREE.Vector3()).multiplyScalar(1 / verts.length);
  const pos = [];
  const nor = [];
  for (const f of faces) {
    const P = f.map((i) => new THREE.Vector3(...verts[i]));
    const fc = P.reduce((a, p) => a.add(p), new THREE.Vector3()).multiplyScalar(1 / P.length);
    let n = new THREE.Vector3().subVectors(P[1], P[0]).cross(new THREE.Vector3().subVectors(P[2], P[0])).normalize();
    const flip = n.dot(fc.clone().sub(c)) < 0;
    if (flip) n = n.negate();
    for (let k = 1; k < P.length - 1; k++) {
      const tri = flip ? [P[0], P[k + 1], P[k]] : [P[0], P[k], P[k + 1]];
      tri.forEach((p) => { pos.push(p.x, p.y, p.z); nor.push(n.x, n.y, n.z); });
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return g;
}

const matToQuat = (M) => new THREE.Quaternion().setFromRotationMatrix(
  new THREE.Matrix4().set(M[0][0], M[0][1], M[0][2], 0, M[1][0], M[1][1], M[1][2], 0, M[2][0], M[2][1], M[2][2], 0, 0, 0, 0, 1),
);

export default defineLevel({
  id: 'ch5-l4',
  title: '阳马拼方',
  concept: '锥体·为什么是三分之一',
  brief: '为什么偏偏是三分之一？老匠师拿来三块一模一样的怪木块，叫阳马。',
  discovery: '三块一样的拼成一个方块，所以每块正好是三分之一。',

  async setup(ctx) {
    const { props } = ctx;
    props.ground({ w: 22, d: 12, seed: 54, river: null, trees: 6 });
    ctx.view.shadow({ x: 1, z: 0 }, 11);
    ctx.view.frame({ x: 1.2, z: 0 }, 6.9, { instant: true, y: S / 2 });
    const elder = props.villager({ x: 8.4, z: -3, color: '#8E7AB5', face: -0.6 });

    // ---- 阳马的几何（边长 S，以方块中心为原点） ----
    const verts = [...YANGMA_BASE, YANGMA_APEX].map((p) => p.map((x) => x * S));
    const geo = solidGeo(verts, [[0, 1, 2, 3], [0, 1, 4], [1, 2, 4], [2, 3, 4], [3, 0, 4]]);
    const edgeGeo = new THREE.EdgesGeometry(geo, 5);

    const makePiece = (color, M, at, solid = true) => {
      const g = new THREE.Group();
      g.position.set(at.x, at.y, at.z);
      const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial(solid ? { color } : { color, transparent: true, opacity: 0.42, depthWrite: false }));
      mesh.castShadow = solid;
      mesh.receiveShadow = solid;
      const lines = new THREE.LineSegments(edgeGeo, new THREE.LineBasicMaterial({ color: '#4A3A28' }));
      g.add(mesh, lines);
      g.quaternion.copy(matToQuat(M));
      ctx.add(g);
      return g;
    };
    const center = v3(CUBE.x, S / 2, CUBE.z);

    // ---- 方块外框 + 金色的角 ----
    const frame = new THREE.Group();
    frame.position.copy(center);
    const box = new THREE.BoxGeometry(S, S, S);
    frame.add(new THREE.LineSegments(new THREE.EdgesGeometry(box), new THREE.LineBasicMaterial({ color: C.gold })));
    frame.add(new THREE.Mesh(box, new THREE.MeshLambertMaterial({ color: '#FFF4D0', transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false })));
    ctx.add(frame);
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.2, 0), new THREE.MeshLambertMaterial({ color: C.gold, emissive: '#B77E12' }));
    gem.position.set(center.x + S / 2, S, center.z + S / 2);
    ctx.add(gem);
    ctx.onUpdate((dt, t) => { gem.rotation.y += dt * 1.6; gem.scale.setScalar(1 + Math.sin(t * 3) * 0.14); });
    const gemLbl = ctx.labels.add(gem, '金角', { cls: 'tag', dy: 0.5, pop: false });

    // ---- 三块：第 0 块已放好；另两块随便摆了朝向，停在右边 ----
    const filled = [true, false, false];
    const pieces = [];
    const p0 = makePiece(COLORS[0], SLOTS[0], center);
    pieces.push({ group: p0, M: SLOTS[0], placed: true, slot: 0, color: COLORS[0] });
    const scramble = (slot, moves) => {
      let M = SLOTS[slot];
      for (const a of moves) M = mmul(rot90(a), M);
      return M;
    };
    const starts = [scramble(1, [1, 2]), scramble(2, [0, 1, 0])];
    starts.forEach((M, i) => {
      const fix = () => (rotationPlan(M, SLOTS.filter((_, k) => k > 0)).length === 0 ? (M = mmul(rot90(0), M), fix()) : M);
      M = fix();
      const at = v3(PARK[i].x, S / 2, PARK[i].z);
      const g = makePiece(COLORS[i + 1], M, at);
      ctx.fx.pop(g, { duration: 360 });
      pieces.push({ group: g, M, placed: false, slot: -1, color: COLORS[i + 1], park: at.clone(), target: matToQuat(M) });
    });
    pieces[0].target = matToQuat(SLOTS[0]);
    const loose = () => pieces.filter((p) => !p.placed);

    // ---- 选中的圈圈 ----
    let sel = pieces[1];
    const selRing = new THREE.Mesh(
      new THREE.RingGeometry(S * 0.62, S * 0.72, 40).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: C.gold, transparent: true, opacity: 0.9, depthWrite: false }),
    );
    selRing.position.y = 0.05;
    ctx.add(selRing);
    const select = (p) => { if (!p.placed) sel = p; };
    ctx.onUpdate((dt) => {
      ctx.state.filled = filled;
      ctx.state.pieces = pieces.map((p) => ({ M: p.M, placed: p.placed, x: p.group.position.x, z: p.group.position.z, sel: p === sel }));
      selRing.visible = !!sel && !sel.placed;
      if (selRing.visible) selRing.position.set(sel.group.position.x, 0.05, sel.group.position.z);
      for (const p of pieces) {
        if (p.target && p.group.quaternion.angleTo(p.target) > 1e-3) p.group.quaternion.slerp(p.target, 1 - Math.exp(-dt * 16));
        else if (p.target) p.group.quaternion.copy(p.target);
      }
    });

    // ---- 转 ----
    const rotate = (axis) => {
      if (!sel || sel.placed) return;
      sel.M = mmul(rot90(axis), sel.M);
      sel.target = matToQuat(sel.M);
      ctx.audio.play('rotate');
    };
    const names = ['前后翻', '原地转', '左右翻'];
    const rotBtns = [0, 1, 2].map((axis) => ctx.hud.tool({ icon: 'rotate', label: names[axis], onTap: () => rotate(axis) }));

    // ---- 拖 ----
    const NEAR = 1.7;
    let wasNear = false;
    let finishResolve;
    const finished = wf(ctx, (res) => { finishResolve = res; });
    const place = (p, slot) => {
      p.placed = true;
      p.slot = slot;
      filled[slot] = true;
      p.handle.dispose();
      p.group.position.copy(center);
      ctx.audio.play('snap');
      ctx.fx.sparkle({ x: center.x, z: center.z }, { size: S * 0.9 });
      const next = loose()[0];
      if (next) select(next);
      if (loose().length === 0) finishResolve();
      else ctx.nudge('这块进去了！再来一块。', { kind: 'good', speak: false });
    };
    pieces.slice(1).forEach((p) => {
      props.hitBox(S * 0.85, S * 0.85, S * 0.85, p.group).position.y = 0;
      p.handle = ctx.pointer.draggable(p.group, {
        ringSize: 0,
        lift: 0,
        onStart: () => select(p),
        onTap: () => select(p),
        onMove: (pt) => {
          const near = Math.hypot(pt.x - center.x, pt.z - center.z) < NEAR;
          if (near !== wasNear) { wasNear = near; ctx.audio.play('tick'); }
          if (near) p.group.position.set(center.x, S / 2 + 0.2, center.z);
          else p.group.position.set(pt.x, S / 2 + 0.35, pt.z);
        },
        onEnd: async (pt, { moved }) => {
          wasNear = false;
          if (!moved) return;
          const near = Math.hypot(pt.x - center.x, pt.z - center.z) < NEAR;
          if (near) {
            const slot = SLOTS.findIndex((M, i) => !filled[i] && meq(M, p.M));
            if (slot >= 0) { place(p, slot); return; }
            ctx.fx.wobble(p.group, { amp: 0.25 });
            ctx.nudge('尖尖要对着金角。转一转再试。');
            await ctx.fx.to(p.group.position, { x: p.park.x, y: p.park.y, z: p.park.z }, 320);
          } else {
            p.group.position.y = S / 2;
            p.park = p.group.position.clone();
          }
        },
      });
    });

    // ---- 提示：第三档自己转、自己拖 ----
    ctx.hud.task('三块的尖，都要碰在金角上。点一块，转一转，再拖进方块。');
    const auto = async () => {
      const p = loose()[0];
      if (!p) return;
      select(p);
      const plan = rotationPlan(p.M, SLOTS.filter((_, i) => !filled[i])) || [];
      for (const a of plan) { rotBtns[a].tap(); await ctx.wait(420); }
      await ctx.pointer.simulateDrag(p.handle, v3(center.x, 0, center.z), { duration: 800 });
      await ctx.wait(300);
    };
    ctx.hint({
      text: '三块的尖都要碰在金角上。点一块，转到尖对着金角，再拖进方块。',
      ghost: () => {
        const p = loose()[0] ?? sel;
        const plan = rotationPlan(p.M, SLOTS.filter((_, i) => !filled[i])) || [];
        const gm = makePiece('#FFFFFF', SLOTS.find((_, i) => !filled[i]), center, false);
        const hand = ctx.fx.ghostHand(v3(p.group.position.x, 1.4, p.group.position.z), v3(center.x, 1.4, center.z));
        void plan;
        return () => { hand.stop(); ctx.remove(gm); };
      },
      demo: auto,
    });
    await finished;
    ctx.hint(null);
    rotBtns.forEach((b) => b.hide());
    selRing.visible = false;
    ctx.view.frame({ x: center.x, z: 0 }, 5.2, { y: S / 2 });

    // ---- 高光：三块一模一样，合成一个方块 ----
    await ctx.wait(500);
    ctx.audio.play('success');
    ctx.fx.celebrate({ x: center.x, z: 0 }, { count: 70 });
    ctx.nudge('三块一模一样的，拼成了一个方块！', { kind: 'good' });
    const dirs = [v3(0, 1, 0), v3(0, 0, 1), v3(1, 0, 0)];
    const offs = [1.9, 1.7, 1.7];
    for (let k = 0; k < 2; k++) {
      await Promise.all(pieces.map((p, i) => ctx.fx.to(p.group.position, { x: center.x + dirs[i].x * offs[i], y: center.y + dirs[i].y * offs[i], z: center.z + dirs[i].z * offs[i] }, 800, { ease: 'inOut' })));
      if (k === 0) { ctx.audio.play('whoosh'); await ctx.wait(1100); }
      await Promise.all(pieces.map((p) => ctx.fx.to(p.group.position, { x: center.x, y: center.y, z: center.z }, 520, { ease: 'out' })));
      ctx.audio.play('snap');
      if (k === 0) await ctx.wait(500);
    }
    const lbl = ctx.labels.add(v3(center.x, S, center.z), '3 块 = 1 个方块', { cls: 'big', dy: 0.8 });
    elder.cheer();
    await ctx.wait(1000);
    ctx.say('三块一样大，所以每块是方块的三分之一');
    ctx.nudge('每一块，都是方块的三分之一。', { kind: 'good', speak: false });
    await ctx.wait(3000);
    lbl.remove();
    gemLbl.remove();
    const h = ctx.hintsUsed;
    ctx.complete({ stars: h === 0 ? 3 : h < 3 ? 2 : 1 });
  },
});
