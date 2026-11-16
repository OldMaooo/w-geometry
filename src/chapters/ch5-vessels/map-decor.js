// 第 5 章在世界地图上的样子：六件量器摆在台子上。过了的关，那件量器里装满了谷（或水）；没过的还空着。
/**
 * @param {{ group: any, THREE: any, cleared: Set<string>, mat: any, palette: any }} api
 */
export function mapDecor(api) {
  const { group, THREE, cleared, mat, palette } = api;
  const ids = ['ch5-l1', 'ch5-l2', 'ch5-l3', 'ch5-l4', 'ch5-l5', 'ch5-l6'];
  const base = new THREE.Mesh(new THREE.BoxGeometry(10, 0.1, 5.4), mat('#C3A06A'));
  base.position.set(0, 0.05, 0);
  base.receiveShadow = true;
  group.add(base);
  const glass = (c) => mat(c, { opacity: 0.85 });
  const grain = mat(palette.gold);
  const water = mat(palette.river);
  const put = (mesh, x, y, z, cast = true) => { mesh.position.set(x, y, z); mesh.castShadow = cast; group.add(mesh); return mesh; };

  ids.forEach((id, i) => {
    const done = cleared.has(id);
    const x = -3.4 + (i % 3) * 3.4;
    const z = i < 3 ? -1.3 : 1.35;
    if (i === 0) { // 陶罐
      put(new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.2, 20), glass('#C8553D')), x, 0.7, z);
      if (done) put(new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.95, 20), water), x, 0.58, z, false);
    } else if (i === 1) { // 方仓
      put(new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.0, 1.2), glass('#B98E57')), x, 0.6, z);
      if (done) put(new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.8, 1.1), grain), x, 0.5, z, false);
    } else if (i === 2) { // 尖斗
      put(new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.2, 20).rotateX(Math.PI), glass('#D9775F')), x, 1.0, z);
      put(new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.4, 8), mat(palette.wood)), x, 0.3, z);
      if (done) put(new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.05, 20).rotateX(Math.PI), water), x, 1.0, z, false);
    } else if (i === 3) { // 阳马：方块里的尖
      const frame = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.3, 1.3, 1.3)), new THREE.LineBasicMaterial({ color: palette.gold }));
      put(frame, x, 0.75, z, false);
      const cols = ['#D9775F', '#E3B04B', '#6FAF9F'];
      const n = done ? 3 : 1;
      for (let k = 0; k < n; k++) {
        const p = new THREE.Mesh(new THREE.ConeGeometry(0.92, 1.2, 4), mat(cols[k]));
        p.rotation.y = Math.PI / 4;
        p.scale.set(1, 1, 1);
        put(p, x - 0.0 + (k - (n - 1) / 2) * 0.0, 0.7, z + (n === 3 ? (k - 1) * 0.12 : 0));
      }
    } else if (i === 4) { // 席子围囤
      put(new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.9, 24, 1, true), mat('#DCC27C')), x, 0.55, z);
      if (done) put(new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.8, 24), grain), x, 0.5, z, false);
    } else { // 标准斗
      put(new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.9, 1.1), glass('#B98E57')), x, 0.55, z);
      if (done) put(new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.75, 1.0), grain), x, 0.48, z, false);
    }
  });
}
