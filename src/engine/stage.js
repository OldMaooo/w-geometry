// Three 舞台：渲染器、场景、相机、灯光、天空、渲染循环、自适应尺寸。
// 场景里常驻的只有灯光和天空；地图和关卡各自挂在 stage.root 下面，由各自的作用域清理。
import * as THREE from 'three';
import { PALETTE } from './palette.js';

/**
 * @typedef {object} Stage
 * @property {THREE.WebGLRenderer} renderer
 * @property {THREE.Scene} scene
 * @property {THREE.PerspectiveCamera} camera
 * @property {THREE.Group} root          当前屏幕（地图 / 关卡）的根节点，切换时清空
 * @property {THREE.DirectionalLight} sun
 * @property {HTMLCanvasElement} canvas
 * @property {(fn:(dt:number,t:number)=>void)=>()=>void} onFrame  每帧回调，返回取消函数
 * @property {(fn:()=>void)=>()=>void} onResize
 * @property {() => {w:number,h:number}} size
 * @property {(cx:number, cz:number, r:number) => void} focusShadow 阴影只覆盖这块区域（越小越清楚）
 */

/** @param {HTMLElement} container @returns {Stage} */
export function createStage(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const canvas = renderer.domElement;
  canvas.id = 'gl';
  container.appendChild(canvas);

  const scene = new THREE.Scene();
  scene.background = makeSkyTexture();
  scene.fog = new THREE.Fog(new THREE.Color(PALETTE.skyBottom), 90, 220);

  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 400);
  camera.position.set(0, 20, 20);

  const hemi = new THREE.HemisphereLight(0xfff6e4, 0xa08458, 1.15);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffe6c0, 2.5);
  sun.position.set(-14, 26, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.02;
  sun.shadow.radius = 3;
  scene.add(sun);
  scene.add(sun.target);

  function focusShadow(cx, cz, r) {
    sun.position.set(cx - 14, 26, cz + 12);
    sun.target.position.set(cx, 0, cz);
    const c = sun.shadow.camera;
    c.left = -r; c.right = r; c.top = r; c.bottom = -r;
    c.near = 1; c.far = 80;
    c.updateProjectionMatrix();
  }
  focusShadow(0, 0, 18);

  const root = new THREE.Group();
  root.name = 'screen-root';
  scene.add(root);

  const frameFns = new Set();
  const resizeFns = new Set();
  let w = 1, h = 1;

  function resize() {
    w = container.clientWidth || window.innerWidth;
    h = container.clientHeight || window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    resizeFns.forEach((fn) => fn());
  }
  window.addEventListener('resize', resize);
  resize();

  let last = performance.now();
  let elapsed = 0;
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    elapsed += dt;
    for (const fn of [...frameFns]) {
      try {
        fn(dt, elapsed);
      } catch (e) {
        console.error(e);
        frameFns.delete(fn);
      }
    }
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  return {
    renderer, scene, camera, root, sun, canvas, focusShadow,
    onFrame(fn) { frameFns.add(fn); return () => frameFns.delete(fn); },
    onResize(fn) { resizeFns.add(fn); return () => resizeFns.delete(fn); },
    size: () => ({ w, h }),
  };
}

/** 天空：上淡蓝下暖米的竖向渐变。 */
function makeSkyTexture() {
  const c = document.createElement('canvas');
  c.width = 2;
  c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, PALETTE.skyTop);
  grad.addColorStop(0.62, '#DCEBE6');
  grad.addColorStop(1, PALETTE.skyBottom);
  g.fillStyle = grad;
  g.fillRect(0, 0, 2, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
