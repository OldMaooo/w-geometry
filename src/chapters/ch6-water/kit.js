// 第 6 章共用小工具：小向量、无声碰撞体、水材质、渐变补间、一小段样式。只给本章用。
import * as THREE from 'three';
import { shared, geo } from '../../engine/shared.js';

import { injectStyles } from '../ch3-survey/kit.js';
export { injectStyles, mountDom, domGhost } from '../ch3-survey/kit.js';

export const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

/** 不等结果的动画：离开关卡时被取消不算报错。 */
export const go = (p) => { p?.catch?.(() => {}); return p; };
/** 自动演示 / solve 时把时间缩短。 */
export const dur = (ctx, ms) => (ctx.auto ? Math.min(ms, 320) : ms);

export const C = {
  water: '#4FA3D8',
  waterDeep: '#3C8BC2',
  foam: '#EAF6FF',
  post: '#B98E57',
  postDark: '#9B7544',
  stone: '#C9C2B2',
  stoneDark: '#A8A090',
  trough: '#C9A66B',
  troughFloor: '#A98A5C',
  gold: '#F2B134',
  ok: '#7BC96A',
  warn: '#E08A3C',
  mountain: '#9C9488',
  mountainTop: '#B8B0A2',
  ink: '#4A3A28',
};

/** 单位方块：x、y 居中，z 从 0 到 1（给「沿着 z 长出来」的水面用）。共享，不会被释放。 */
export const unitBoxZ = () => geo('ch6-unit-z', () => new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0.5));
/** 单位方块：底面在 y=0，x、z 居中（给「往上长」的水位用）。 */
export const unitBoxY = () => geo('ch6-unit-y', () => new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0));
/** 普通居中的单位方块。 */
export const unitBox = () => geo('ch6-unit', () => new THREE.BoxGeometry(1, 1, 1));

/** 共享的水材质（半透明、带高光）。 */
let _water = null;
export function waterMat() {
  return (_water ||= shared(new THREE.MeshLambertMaterial({ color: '#4A9BD0', transparent: true, opacity: 0.9 })));
}
let _invisible = null;
/** 隐形碰撞材质。 */
export const hitMat = () => (_invisible ||= shared(new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })));

/** 一块隐形的抓取区：底在 y=0、x/z 居中，用 scale 调大小。 */
export function makeHit(parent) {
  const m = new THREE.Mesh(unitBoxY(), hitMat());
  parent?.add(m);
  return m;
}

/** 带阴影的方块。 */
export function block(color, w, h, d, { x = 0, y = 0, z = 0, parent, cast = true, mat: m } = {}) {
  const mesh = new THREE.Mesh(unitBoxY(), m || new THREE.MeshLambertMaterial({ color }));
  mesh.scale.set(w, h, d);
  mesh.position.set(x, y, z);
  mesh.castShadow = cast;
  mesh.receiveShadow = true;
  parent?.add(mesh);
  return mesh;
}

/** 调试 / 自动测试用：世界点 → 屏幕。 */
export const exposeScreen = (ctx) => {
  ctx.state.toScreen = (x, y, z) => ctx.pointer.toScreen(new THREE.Vector3(x, y, z));
};

/** 缓动补间：k 从 0 到 1，不会因为取消而报错。 */
export const tweenK = (ctx, ms, onUpdate, ease = 'inOut') => go(ctx.fx.tween({ duration: dur(ctx, ms), ease, onUpdate }));

/** 摄像机当前的「往远处」水平方向和俯角（tan），竖直拖拽换算用。 */
export function cameraAim(camera) {
  const d = new THREE.Vector3();
  camera.getWorldDirection(d);
  const pitch = Math.asin(Math.max(-1, Math.min(1, -d.y)));
  const hl = Math.hypot(d.x, d.z) || 1;
  return { fx: d.x / hl, fz: d.z / hl, tan: Math.min(1.8, Math.max(0.35, Math.tan(pitch))) };
}

/** 本章通用的几条小样式（标签变绿等），离开关卡自动撤。 */
export const chapterStyles = (ctx) => injectStyles(ctx, `
.lbl-big.good { background: #E4F3CF; border-color: #6DB85B; }
.lbl-big.stone { background: #E9E4D8; border-color: #A8A090; color: #7A6650; }
.lbl-tag.warm { background: #FFF1D0; border-color: #E8B04A; }
`);

/** 小房子（村子）。 */
export function makeHouse(ctx, x, z, { s = 1, parent, roof = '#C8553D', wall = '#E6D3A8', face = 0 } = {}) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = face;
  g.scale.setScalar(s);
  block(wall, 1.7, 1.0, 1.4, { parent: g });
  const r = new THREE.Mesh(new THREE.ConeGeometry(1.35, 0.9, 4), new THREE.MeshLambertMaterial({ color: roof }));
  r.position.y = 1.45; r.rotation.y = Math.PI / 4; r.castShadow = true;
  g.add(r);
  block('#8B6B43', 0.4, 0.62, 0.06, { x: 0, z: 0.72, parent: g, cast: false });
  if (parent) parent.add(g); else ctx.add(g);
  return g;
}

/** 金色拐点球（拖它改渠的走向）。底下一根小桩。 */
export function makeKnob(ctx, { parent, r = 0.46, color = C.gold } = {}) {
  const g = new THREE.Group();
  const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), new THREE.MeshLambertMaterial({ color }));
  ball.position.y = 0.85;
  ball.castShadow = true;
  const post = block('#7A5233', 0.16, 0.8, 0.16, { parent: g });
  g.add(ball);
  const hit = new THREE.Mesh(unitBoxY(), hitMat());
  hit.scale.set(1.6, 1.6, 1.6);
  g.add(hit);
  void post;
  if (parent) parent.add(g); else ctx.add(g);
  return { group: g, ball };
}
