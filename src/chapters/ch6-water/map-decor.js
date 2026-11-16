// 第 6 章在世界地图上的样子：一条小渠从山上的水库流向六块田。过了的关，那一段渠里有水、那块田长出苗。
/**
 * @param {{ group: any, props: any, THREE: any, cleared: Set<string>, mat: any, palette: any }} api
 */
export function mapDecor(api) {
  const { group, props, THREE, cleared, mat, palette } = api;
  const ids = ['ch6-l1', 'ch6-l2', 'ch6-l3', 'ch6-l4', 'ch6-l5', 'ch6-l6'];
  const base = new THREE.Mesh(new THREE.BoxGeometry(11, 0.1, 6.4), mat('#C3A06A'));
  base.position.set(0, 0.05, 0.2);
  base.receiveShadow = true;
  group.add(base);
  // 山上的水库
  const hill = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.3, 2), mat(palette.stone));
  hill.position.set(-4.3, 0.75, -1.9);
  hill.castShadow = hill.receiveShadow = true;
  const pool = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.12, 1.5), mat(palette.river));
  pool.position.set(-4.3, 1.43, -1.9);
  group.add(hill, pool);
  // 渠：六段，每段通关就有水
  ids.forEach((id, i) => {
    const done = cleared.has(id);
    const x = -3.1 + i * 1.25;
    const y = 1.0 - i * 0.12;
    const bed = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.14, 0.62), mat(palette.wood));
    bed.position.set(x, 0.55 + (y - 1) * 0.5 + 0.35, -1.0);
    bed.castShadow = bed.receiveShadow = true;
    group.add(bed);
    if (done) {
      const w = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.1, 0.4), mat(palette.river));
      w.position.set(x, bed.position.y + 0.1, -1.0);
      group.add(w);
    }
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.2, bed.position.y, 0.2), mat(palette.ridge));
    post.position.set(x, bed.position.y / 2, -1.0);
    post.castShadow = true;
    group.add(post);
    // 田
    const fx = -3.1 + (i % 3) * 3.0, fz = 0.7 + Math.floor(i / 3) * 1.8;
    const f = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.1, 1.4), mat(done ? '#7D5B34' : '#C3A06A'));
    f.position.set(fx + 0.4, 0.12, fz);
    f.receiveShadow = true;
    group.add(f);
    if (done) {
      const cells = [];
      for (let a = 0; a < 4; a++) for (let b = 0; b < 2; b++) cells.push({ x: fx - 0.5 + a * 0.6, z: fz - 0.3 + b * 0.6 });
      const c = props.crops({ cells, kind: 'rice', per: 1, parent: group, seed: i + 2 });
      c.mesh.position.y = 0.12;
      c.setAll(1);
    }
  });
  props.villager({ x: 4.3, z: 2.0, color: palette.clay, parent: group, face: -0.6, s: 0.9 });
}
