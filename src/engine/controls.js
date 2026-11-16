// 镜头：绕目标点转（限制俯仰）、缩放、「俯视 / 斜视」一键切换、平滑飞到某处。
// 输入（右键 / 双指 / 滚轮）由 pointer.js 统一收进来再调这里，拖东西时 pointer.js 不会调这里，所以相机不乱动。
import * as THREE from 'three';

const DEG = Math.PI / 180;
const TOP_PITCH = 89.5 * DEG;

/**
 * @param {import('./stage.js').Stage} stage
 */
export function createControls(stage) {
  const cam = stage.camera;
  // goal 是想去的位置，cur 每帧往 goal 靠（手感更顺）
  const goal = { tx: 0, ty: 0, tz: 0, yaw: -18 * DEG, pitch: 45 * DEG, dist: 26 };
  const cur = { ...goal };
  const limits = { minPitch: 18 * DEG, maxPitch: TOP_PITCH, minDist: 6, maxDist: 80 };
  let top = false;
  let obliqueYaw = goal.yaw;
  let obliquePitch = goal.pitch;
  const listeners = new Set();

  function apply() {
    const cp = Math.cos(cur.pitch);
    cam.position.set(
      cur.tx + cur.dist * Math.sin(cur.yaw) * cp,
      cur.ty + cur.dist * Math.sin(cur.pitch),
      cur.tz + cur.dist * Math.cos(cur.yaw) * cp,
    );
    cam.lookAt(cur.tx, cur.ty, cur.tz);
  }

  stage.onFrame((dt) => {
    const k = 1 - Math.exp(-dt * 9);
    let moved = false;
    for (const key of Object.keys(goal)) {
      const d = goal[key] - cur[key];
      if (Math.abs(d) > 1e-5) {
        cur[key] += d * k;
        moved = true;
      } else cur[key] = goal[key];
    }
    if (moved) apply();
  });
  apply();

  function clampGoal() {
    goal.pitch = Math.min(limits.maxPitch, Math.max(limits.minPitch, goal.pitch));
    goal.dist = Math.min(limits.maxDist, Math.max(limits.minDist, goal.dist));
  }
  function emit() { listeners.forEach((fn) => fn(api)); }

  const api = {
    /** 拖动像素换算成转角（右键 / 双指 / 空地上单指拖）。 */
    rotateBy(dxPx, dyPx) {
      goal.yaw -= dxPx * 0.008;
      goal.pitch += dyPx * 0.006;
      clampGoal();
      if (top && goal.pitch < TOP_PITCH - 2 * DEG) { top = false; emit(); }
      if (!top) { obliqueYaw = goal.yaw; obliquePitch = goal.pitch; }
    },
    /** 缩放：factor > 1 拉远。 */
    zoomBy(factor) {
      goal.dist *= factor;
      clampGoal();
    },
    /** 切到俯视 / 斜视。 */
    setTop(on) {
      if (on === top) return;
      top = on;
      if (on) {
        obliqueYaw = goal.yaw;
        obliquePitch = goal.pitch;
        goal.yaw = Math.round(goal.yaw / (Math.PI / 2)) * (Math.PI / 2);
        goal.pitch = TOP_PITCH;
      } else {
        goal.yaw = obliqueYaw;
        goal.pitch = obliquePitch;
      }
      emit();
    },
    toggleTop() { api.setTop(!top); },
    isTop: () => top,
    /**
     * 让一块区域刚好装进画面（平滑飞过去）。
     * @param {{x:number,z:number}} center @param {number} radius 区域半径（世界单位）
     * @param {{ yaw?: number, pitch?: number, instant?: boolean, y?: number, left?: number }} [opt] 角度用度；left：让这块区域落在屏幕偏左（0–1，占半屏宽的比例），给居中的结算面板让位
     */
    frame(center, radius, opt = {}) {
      goal.tx = center.x;
      goal.tz = center.z;
      goal.ty = opt.y ?? 0;
      if (opt.yaw !== undefined) { goal.yaw = opt.yaw * DEG; obliqueYaw = goal.yaw; }
      if (opt.pitch !== undefined && !top) { goal.pitch = opt.pitch * DEG; obliquePitch = goal.pitch; }
      const vfov = cam.fov * DEG;
      const hfov = 2 * Math.atan(Math.tan(vfov / 2) * cam.aspect);
      const fov = Math.min(vfov, hfov);
      goal.dist = (radius / Math.sin(fov / 2)) * 1.05;
      if (opt.left) {
        // 目标点往镜头右边挪，画面里的东西就偏到左边去
        const halfW = goal.dist * Math.tan(hfov / 2);
        goal.tx += Math.cos(goal.yaw) * halfW * opt.left;
        goal.tz -= Math.sin(goal.yaw) * halfW * opt.left;
      }
      limits.maxDist = Math.max(goal.dist * 1.8, 30);
      limits.minDist = Math.max(4, goal.dist * 0.35);
      clampGoal();
      if (opt.instant) { Object.assign(cur, goal); apply(); }
    },
    /** 恢复默认斜视角（关卡开始时用）。 */
    reset(opt = {}) {
      top = false;
      goal.yaw = (opt.yaw ?? -18) * DEG;
      goal.pitch = (opt.pitch ?? 45) * DEG;
      obliqueYaw = goal.yaw;
      obliquePitch = goal.pitch;
      emit();
    },
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    /** 当前状态（调试用）。 */
    state: () => ({ ...goal, top }),
    get target() { return new THREE.Vector3(cur.tx, cur.ty, cur.tz); },
  };
  return api;
}
