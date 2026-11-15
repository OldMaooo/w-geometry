// 第 4 章在世界地图上的样子：六块方基座，过了的关上面搭起方块塔；没过的只有光基座和一块石板。
/**
 * @param {{ group: any, props: any, THREE: any, cleared: Set<string>, mat: any, palette: any }} api
 */
export function mapDecor(api) {
  const { group, THREE, cleared, mat, palette } = api;
  const ids = ['ch4-l1', 'ch4-l2', 'ch4-l3', 'ch4-l4', 'ch4-l5', 'ch4-l6'];
  const slab = new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.1, 5.6), mat('#CDB47B'));
  slab.position.set(0, 0.05, 0);
  slab.receiveShadow = true;
  group.add(slab);
  const colors = ['#C79B5E', '#D6AB69', '#E0BC7C'];
  const box = (x, y, z, s, c) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), mat(c));
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    group.add(m);
    return m;
  };
  ids.forEach((id, i) => {
    const col = i % 3, row = Math.floor(i / 3);
    const x = (col - 1) * 2.9, z = (row - 0.5) * 2.4;
    const done = cleared.has(id);
    // 石板座
    const pad = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.12, 1.8), mat(done ? '#B99A63' : '#D9C79C'));
    pad.position.set(x, 0.16, z);
    pad.receiveShadow = true;
    group.add(pad);
    if (done) {
      // 小方块塔：台阶式
      const s = 0.5;
      for (let a = 0; a < 3; a++) for (let b = 0; b < 2; b++) box(x - 0.5 + a * s, 0.22 + s / 2, z - 0.25 + b * s, s * 0.96, colors[(a + b) % 3]);
      for (let a = 0; a < 2; a++) box(x - 0.25 + a * s, 0.22 + s * 1.5, z - 0.25 + 0 * s + 0.25 * 0, s * 0.96, colors[a]);
      box(x, 0.22 + s * 2.5, z - 0.25, s * 0.96, palette.gold);
    } else {
      box(x - 0.5, 0.22 + 0.2, z, 0.4, '#E3D3AC');
      box(x + 0.15, 0.22 + 0.2, z + 0.2, 0.4, '#D9C79C');
    }
  });
}
