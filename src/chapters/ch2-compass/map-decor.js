// 第 2 章在世界地图上的样子：六块圆台。过了的关，圆台上立起金环和小柱；没过的，只有一根桩。
/** @param {{ group: any, props: any, THREE: any, cleared: Set<string>, mat: any, palette: any }} api */
export function mapDecor({ group, props, THREE, cleared, mat, palette }) {
  const ids = ['ch2-l1', 'ch2-l2', 'ch2-l3', 'ch2-l4', 'ch2-l5', 'ch2-l6'];
  ids.forEach((id, i) => {
    const col = i % 3, row = Math.floor(i / 3);
    const x = (col - 1) * 3.6, z = (row - 0.5) * 3.4 - 0.4;
    const done = cleared.has(id);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 0.12, 28), mat(done ? '#B9976A' : '#C9B386'));
    disc.position.set(x, 0.06, z);
    disc.receiveShadow = true;
    group.add(disc);
    if (done) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.07, 6, 36), mat(palette.gold, { emissive: '#6a4a00' }));
      ring.rotation.x = Math.PI / 2; ring.position.set(x, 0.17, z);
      group.add(ring);
      const pil = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 1.1, 8), mat(palette.clay));
      pil.position.set(x, 0.65, z); pil.castShadow = true;
      group.add(pil);
    } else {
      props.stake({ x, z, h: 0.6, parent: group });
    }
  });
  props.villager({ x: 4.9, z: 2.6, color: palette.clay, parent: group, face: -0.5, s: 0.9 });
}
