// 第 1 章在世界地图上的样子：六块小田。过了的关，那块田长满稻子；能玩没过的，是光土地插着桩；还没开的，是荒草地。
/**
 * @param {{ group: any, props: any, THREE: any, cleared: Set<string>, levelOpen: (lv:any)=>boolean, mat: any, palette: any }} api
 * @param {any} [chapter]
 */
export function mapDecor(api) {
  const { group, props, THREE, cleared, mat, palette } = api;
  const ids = ['ch1-l1', 'ch1-l2', 'ch1-l3', 'ch1-l4', 'ch1-l5', 'ch1-l6'];
  const W = 3, D = 2.2, gap = 0.7;
  const cells = [];
  ids.forEach((id, i) => {
    const col = i % 3, row = Math.floor(i / 3);
    const x0 = (col - 1) * (W + gap) - W / 2;
    const z0 = (row - 0.5) * (D + gap) - D / 2 - 0.6;
    const done = cleared.has(id);
    const ridgeM = mat(palette.ridge);
    const bed = new THREE.Mesh(new THREE.BoxGeometry(W, 0.12, D), mat(done ? '#A9834E' : '#C3A06A'));
    bed.position.set(x0 + W / 2, 0.06, z0 + D / 2);
    bed.receiveShadow = true;
    group.add(bed);
    for (const [w, d, x, z] of [[W + 0.3, 0.15, x0 + W / 2, z0 - 0.07], [W + 0.3, 0.15, x0 + W / 2, z0 + D + 0.07], [0.15, D, x0 - 0.07, z0 + D / 2], [0.15, D, x0 + W + 0.07, z0 + D / 2]]) {
      const r = new THREE.Mesh(new THREE.BoxGeometry(w, 0.2, d), ridgeM);
      r.position.set(x, 0.1, z);
      r.castShadow = r.receiveShadow = true;
      group.add(r);
    }
    if (done) {
      for (let a = 0; a < 5; a++) for (let b = 0; b < 3; b++) cells.push({ x: x0 + 0.35 + a * 0.58, z: z0 + 0.4 + b * 0.7 });
    } else {
      props.stake({ x: x0 + 0.3, z: z0 + D - 0.3, h: 0.5, parent: group });
      props.stake({ x: x0 + W - 0.3, z: z0 + D - 0.3, h: 0.5, parent: group });
    }
  });
  if (cells.length) {
    const c = props.crops({ cells, kind: 'rice', per: 1, parent: group, seed: 3 });
    c.mesh.position.y = 0.1;
    c.setAll(1);
  }
  props.villager({ x: 4.6, z: 2.6, color: palette.clay, parent: group, face: -0.5, s: 0.9 });
  // 小草屋
  const hut = new THREE.Group();
  const wall = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1, 1.3), mat('#E6D3A8'));
  wall.position.y = 0.5;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.3, 0.9, 4), mat('#C9A447'));
  roof.position.y = 1.45;
  roof.rotation.y = Math.PI / 4;
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.6, 0.05), mat(palette.ridge));
  door.position.set(0, 0.3, 0.66);
  for (const m of [wall, roof, door]) { m.castShadow = m.receiveShadow = true; hut.add(m); }
  hut.position.set(-4.6, 0, 3);
  hut.rotation.y = 0.4;
  group.add(hut);
}
