// 第 3 章在世界地图上的样子：六根竿，各拖一条影子；过了的关，竿顶变金色、影子拉长。
/**
 * @param {{ group: any, props: any, THREE: any, cleared: Set<string>, mat: any, palette: any }} api
 */
export function mapDecor(api) {
  const { group, THREE, cleared, mat, palette } = api;
  const ids = ['ch3-l1', 'ch3-l2', 'ch3-l3', 'ch3-l4', 'ch3-l5', 'ch3-l6'];
  const base = new THREE.Mesh(new THREE.BoxGeometry(9, 0.1, 5), mat('#C3A06A'));
  base.position.set(0, 0.05, 0);
  base.receiveShadow = true;
  group.add(base);
  ids.forEach((id, i) => {
    const done = cleared.has(id);
    const x = -3.6 + i * 1.44;
    const h = 0.8 + (i % 3) * 0.45;
    const pole = new THREE.Mesh(new THREE.BoxGeometry(0.16, h, 0.16), mat(palette.wood));
    pole.position.set(x, 0.1 + h / 2, -0.8);
    pole.castShadow = true;
    group.add(pole);
    const top = new THREE.Mesh(new THREE.IcosahedronGeometry(0.15, 0), mat(done ? palette.gold : palette.stone));
    top.position.set(x, 0.12 + h, -0.8);
    group.add(top);
    const L = h * (done ? 1.6 : 0.8);
    const sh = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.02, L), new THREE.MeshBasicMaterial({ color: '#4A3A28', transparent: true, opacity: 0.35 }));
    sh.position.set(x, 0.11, -0.8 + L / 2);
    group.add(sh);
  });
  const sun = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 8), new THREE.MeshBasicMaterial({ color: palette.gold }));
  sun.position.set(-3.5, 3.4, -2.2);
  group.add(sun);
}
