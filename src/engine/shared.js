// 共享资源登记：被多个物体共用的几何体 / 材质 / 贴图，换关清场景时不要释放。
import * as THREE from 'three';

const keep = new WeakSet();

/** 标记为共享（不随场景清理释放）。 @template T @param {T} r @returns {T} */
export function shared(r) {
  keep.add(/** @type {any} */ (r));
  return r;
}

/** 释放一个物体树里的非共享几何体 / 材质 / 贴图。 @param {THREE.Object3D} root */
export function disposeTree(root) {
  root.traverse((o) => {
    const m = /** @type {any} */ (o);
    if (m.geometry && !keep.has(m.geometry)) m.geometry.dispose();
    if (m.material) {
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mat of mats) {
        if (keep.has(mat)) continue;
        for (const k of ['map', 'alphaMap', 'emissiveMap']) if (mat[k] && !keep.has(mat[k])) mat[k].dispose();
        mat.dispose();
      }
    }
    if (m.isInstancedMesh && !keep.has(m)) m.dispose?.();
  });
}

const lambertCache = new Map();
/**
 * 按颜色取一个共享的平涂材质（暖色方块风统一用它）。
 * @param {string|number} color @param {{ emissive?: string|number, transparent?: boolean, opacity?: number }} [opt]
 */
export function mat(color, opt = {}) {
  const key = `${color}|${opt.emissive ?? ''}|${opt.opacity ?? ''}`;
  let m = lambertCache.get(key);
  if (!m) {
    m = shared(new THREE.MeshLambertMaterial({
      color,
      ...(opt.emissive !== undefined ? { emissive: opt.emissive } : {}),
      ...(opt.opacity !== undefined ? { transparent: true, opacity: opt.opacity, depthWrite: opt.opacity > 0.6 } : {}),
    }));
    lambertCache.set(key, m);
  }
  return m;
}

const geoCache = new Map();
/** 共享几何体缓存。 @param {string} key @param {() => THREE.BufferGeometry} make */
export function geo(key, make) {
  let g = geoCache.get(key);
  if (!g) { g = shared(make()); geoCache.set(key, g); }
  return g;
}
