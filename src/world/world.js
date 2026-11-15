// 世界地图：河谷小景（一条大河 + 六块区域）。选章、选关、智慧卡册、眼力页。
// 已注册的章可以进；没注册的显示「还在修建」。通关过的关在地图上留下痕迹（章节可自带 mapDecor）。
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Scope } from '../engine/scope.js';
import { chapters, chapterByOrder, makeUnlocks } from '../engine/registry.js';
import { PALETTE } from '../engine/palette.js';
import { mat, geo } from '../engine/shared.js';
import { h, btn } from '../engine/dom.js';
import { icon } from '../engine/icons.js';
import { EYE_KINDS, EYE_NAMES } from '../engine/progress.js';

/** 六块区域：位置固定，章按 order 对号入座。 */
export const REGIONS = [
  { order: 1, name: '量田', x: -17, z: 9, color: PALETTE.rice },
  { order: 2, name: '规矩', x: 0, z: 10.5, color: PALETTE.stone },
  { order: 3, name: '测望', x: -17, z: -9.5, color: '#9CC07A' },
  { order: 4, name: '营造', x: 0, z: -10.5, color: PALETTE.clay },
  { order: 5, name: '量器', x: 17, z: -9.5, color: PALETTE.straw },
  { order: 6, name: '治水', x: 17, z: 9, color: PALETTE.river },
];

const RIVER = [[-40, -1], [-26, 1.8], [-12, -1.2], [0, 1.4], [12, -1.2], [26, 1.6], [40, 0]];

/**
 * @param {any} E 引擎
 * @param {{ openLevel: (lv: any) => void }} nav
 */
export function createWorld(E, nav) {
  const { stage, controls, pointer, labels, props, hud, audio, progress } = E;
  const unlocks = makeUnlocks(progress);
  let scope = null;
  let panel = null;
  let selected = null;

  function show(focusChapterId) {
    E.levels?.stop();
    scope?.dispose();
    scope = new Scope(stage);
    E.screenScope = scope;
    selected = null;
    hud.mapMode([
      btn('book', '智慧卡', () => { audio.play('open'); openCards(); }, 'ghost wide'),
      btn('eye', '眼力', () => { audio.play('open'); openEye(); }, 'ghost wide'),
    ]);
    hud.task('', { speak: false });
    hud.layer.classList.add('in-map');
    scope.add(() => hud.layer.classList.remove('in-map'));
    const logo = h('div.logo', {}, [h('b', {}, '规矩古国')]);
    hud.layer.querySelector('.hud-tl').replaceChildren(logo);
    build();
    overview(true);
    stage.focusShadow(0, 0, 34);
    scope.add(() => stage.focusShadow(0, 0, 18));
    const offEmpty = pointer.onEmptyTap(() => { if (panel) closePanel(); });
    scope.add(offEmpty);
    if (focusChapterId) {
      const ch = chapters.find((c) => c.id === focusChapterId);
      if (ch) scope.after(350, () => select(ch.order));
    }
  }

  function overview(instant) {
    controls.reset({ yaw: -8, pitch: 50 });
    controls.frame({ x: 0, z: 1.5 }, 25, { instant });
  }

  function build() {
    const root = stage.root;
    // 底座
    const W = 76, D = 50;
    const slab = new THREE.Mesh(new THREE.BoxGeometry(W, 2, D), [
      mat(PALETTE.ridge), mat(PALETTE.ridge), mat(PALETTE.grass), mat('#6E5030'), mat(PALETTE.ridge), mat(PALETTE.ridge),
    ]);
    slab.position.y = -1;
    slab.receiveShadow = true;
    root.add(slab);
    // 不会动的点缀先放进 decor，最后按材质合并成少量网格（省 draw call，iPad 更稳）
    const decor = new THREE.Group();
    root.add(decor);
    // 地面颜色斑块
    const r = mulberry(4);
    for (let i = 0; i < 70; i++) {
      const p = new THREE.Mesh(geo('patch', () => new THREE.BoxGeometry(1, 0.04, 1)), mat(r() < 0.5 ? '#9DBE66' : '#AECB74'));
      p.scale.set(2 + r() * 5, 1, 2 + r() * 4);
      p.position.set((r() - 0.5) * (W - 6), 0.005, (r() - 0.5) * (D - 6));
      p.receiveShadow = true;
      decor.add(p);
    }
    // 大河：沿曲线铺一条水带 + 沙岸
    const curve = new THREE.CatmullRomCurve3(RIVER.map(([x, z]) => new THREE.Vector3(x, 0, z)));
    root.add(ribbon(curve, 5.4, mat('#E2CD98'), 0.04));
    const water = ribbon(curve, 3.8, new THREE.MeshPhongMaterial({ color: PALETTE.river, shininess: 80, specular: 0xa8dcf5 }), 0.08, true);
    root.add(water);
    animateWater(water);
    // 桥
    for (const bx of [-8.5, 8.5]) {
      const z = riverZ(curve, bx);
      const deck = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.25, 6.2), mat(PALETTE.wood));
      deck.position.set(bx, 0.35, z);
      deck.castShadow = deck.receiveShadow = true;
      decor.add(deck);
      for (const s of [-1, 1]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.4, 6.2), mat('#8A5C34'));
        rail.position.set(bx + s * 0.85, 0.6, z);
        rail.castShadow = true;
        decor.add(rail);
      }
    }
    // 山和树（远处）
    for (let i = 0; i < 9; i++) {
      const s = 3 + r() * 4;
      const m = new THREE.Mesh(geo(`hill${i % 3}`, () => new THREE.ConeGeometry(1, 1, 5 + (i % 3))), mat(i % 2 ? '#8FB070' : '#7EA463'));
      m.scale.set(s * 1.4, s, s * 1.2);
      m.position.set(-34 + i * 8.5 + r() * 3, s / 2 - 0.1, -D / 2 + 2.5 + r() * 2);
      m.castShadow = m.receiveShadow = true;
      decor.add(m);
    }
    let placed = 0;
    for (let i = 0; i < 400 && placed < 60; i++) {
      const x = (r() - 0.5) * (W - 3), z = (r() - 0.5) * (D - 3);
      if (Math.abs(z - riverZ(curve, x)) < 4) continue;
      if (REGIONS.some((g) => Math.hypot(g.x - x, g.z - z) < 8.5)) continue;
      props.tree({ x, z, kind: r() < 0.4 ? 'pine' : 'round', s: 0.9 + r() * 0.7, seed: i, parent: decor });
      placed++;
    }
    mergeStatic(decor);
    for (let i = 0; i < 6; i++) props.cloud({ x: -40 + i * 16, y: 13 + r() * 5, z: -34 - r() * 6, s: 1 + r(), seed: i + 2 });
    // 区域
    for (const g of REGIONS) buildRegion(g);
  }

  function buildRegion(g) {
    const ch = chapterByOrder(g.order);
    const open = ch ? unlocks.chapterOpen(ch) : false;
    const grp = new THREE.Group();
    grp.position.set(g.x, 0, g.z);
    stage.root.add(grp);
    // 台子
    const base = new THREE.Mesh(geo('regionBase', () => new THREE.CylinderGeometry(7, 7.4, 0.5, 10)), mat(ch ? '#C9B07E' : '#BBAA86'));
    base.position.y = 0.25;
    base.receiveShadow = true;
    base.castShadow = true;
    grp.add(base);
    const top = new THREE.Mesh(geo('regionTop', () => new THREE.CylinderGeometry(6.6, 6.6, 0.06, 10)), mat(ch ? '#A9C878' : '#B9C29A'));
    top.position.y = 0.52;
    top.receiveShadow = true;
    grp.add(top);
    const deco = new THREE.Group();
    deco.position.y = 0.55;
    grp.add(deco);
    if (!ch) {
      buildScaffold(deco, g);
    } else if (typeof ch.mapDecor === 'function') {
      const cleared = new Set(ch.levels.filter((l) => progress.isCleared(l.id)).map((l) => l.id));
      ch.mapDecor({ group: deco, props, THREE, cleared, open, levelOpen: unlocks.levelOpen, progress, mat, palette: PALETTE });
    } else {
      buildGenericMarks(deco, ch);
    }
    if (ch && !open) {
      deco.traverse((o) => { if (o.isMesh) o.material = mat('#B9B2A2'); });
    }
    // 标签（可点）
    const stars = ch ? ch.levels.reduce((s, l) => s + (progress.level(l.id)?.s || 0), 0) : 0;
    const total = ch ? ch.levels.length * 3 : 0;
    const content = ch
      ? `${open ? '' : icon('lock', { size: 22 }).outerHTML}<b>${g.order}</b><span>${ch.name}</span>${open ? `<em>${icon('star', { size: 18, fill: PALETTE.gold }).outerHTML}${stars}/${total}</em>` : ''}`
      : `<b>${g.order}</b><span>${g.name}</span><em class="wip">${icon('building', { size: 18 }).outerHTML}还在修建</em>`;
    const lbl = labels.add(new THREE.Vector3(g.x, 0.6, g.z + 7.6), content, { cls: `region${ch ? '' : ' wip'}${ch && !open ? ' locked' : ''}`, onTap: () => select(g.order) });
    scope.add(() => lbl.remove());
    const hit = pointer.tappable(grp, () => select(g.order), { hit: base });
    scope.add(() => hit.dispose());
  }

  /** 没注册的章：脚手架、木料、吊杆。 */
  function buildScaffold(deco, g) {
    const wood = mat(PALETTE.wood);
    const r = mulberry(g.order * 13);
    for (let i = 0; i < 4; i++) {
      const x = -2 + (i % 2) * 4, z = -1.5 + Math.floor(i / 2) * 3;
      const p = new THREE.Mesh(geo('pole', () => new THREE.BoxGeometry(0.16, 3, 0.16)), wood);
      p.position.set(x, 1.5, z);
      p.castShadow = true;
      deco.add(p);
    }
    for (const y of [1, 2.2]) for (const z of [-1.5, 1.5]) {
      const b = new THREE.Mesh(geo('beam', () => new THREE.BoxGeometry(4.3, 0.14, 0.14)), wood);
      b.position.set(0, y, z);
      b.castShadow = true;
      deco.add(b);
    }
    const plank = new THREE.Mesh(new THREE.BoxGeometry(4.3, 0.1, 3.2), mat('#C69C6D'));
    plank.position.set(0, 2.25, 0);
    plank.castShadow = true;
    deco.add(plank);
    for (let i = 0; i < 6; i++) {
      const s = new THREE.Mesh(geo('stoneblock', () => new THREE.BoxGeometry(0.8, 0.5, 0.6)), mat(i % 2 ? PALETTE.stone : '#CFC8BA'));
      s.position.set(3 + (i % 3) * 0.85, 0.25 + Math.floor(i / 3) * 0.5, 2.6 - r() * 0.3);
      s.castShadow = true;
      deco.add(s);
    }
    // 吊杆
    const mast = new THREE.Mesh(new THREE.BoxGeometry(0.2, 4, 0.2), wood);
    mast.position.set(-3.6, 2, 2.4);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.16, 0.16), wood);
    arm.position.set(-2.4, 3.9, 2.4);
    arm.rotation.z = -0.15;
    const ropeLine = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.6, 0.04), mat(PALETTE.rope));
    ropeLine.position.set(-1, 3, 2.4);
    for (const m of [mast, arm, ropeLine]) { m.castShadow = true; deco.add(m); }
    const v = props.villager({ x: 2.6, z: -2.2, color: '#6F8FAF', parent: deco, face: -0.6 });
    void v;
  }

  /** 注册了但没写 mapDecor 的章：6 个小石墩，过了的插金旗。 */
  function buildGenericMarks(deco, ch) {
    ch.levels.forEach((lv, i) => {
      const a = (i / ch.levels.length) * Math.PI * 2;
      const x = Math.cos(a) * 3.6, z = Math.sin(a) * 3.6;
      const ped = new THREE.Mesh(geo('ped', () => new THREE.CylinderGeometry(0.5, 0.6, 0.5, 6)), mat(PALETTE.stone));
      ped.position.set(x, 0.25, z);
      ped.castShadow = true;
      deco.add(ped);
      if (progress.isCleared(lv.id)) {
        const pole = new THREE.Mesh(geo('flagpole', () => new THREE.BoxGeometry(0.08, 1.6, 0.08)), mat(PALETTE.wood));
        pole.position.set(x, 1.3, z);
        const flag = new THREE.Mesh(geo('flag', () => new THREE.BoxGeometry(0.7, 0.45, 0.04)), mat(PALETTE.gold));
        flag.position.set(x + 0.38, 1.85, z);
        deco.add(pole, flag);
      }
    });
  }

  // ---------- 选章 / 选关 ----------
  function select(order) {
    const g = REGIONS.find((x) => x.order === order);
    const ch = chapterByOrder(order);
    audio.play('tap');
    if (!ch) {
      hud.nudge('这里还在修建，过些日子再来。');
      return;
    }
    if (!unlocks.chapterOpen(ch)) {
      const prev = chapters[chapters.indexOf(ch) - 1];
      hud.nudge(`先在「${prev?.name || '上一章'}」过 3 关，这里就开了。`);
      return;
    }
    selected = order;
    controls.reset({ yaw: -8, pitch: 52 });
    controls.frame({ x: g.x + 4.2, z: g.z + 1 }, 9.5);
    audio.play('whoosh');
    openPanel(ch);
  }

  function openPanel(ch) {
    closePanel(true);
    const rows = ch.levels.map((lv, i) => {
      const open = unlocks.levelOpen(lv);
      const rec = progress.level(lv.id);
      const row = h(`button.lv-row${open ? '' : '.locked'}${rec ? '.cleared' : ''}`, { type: 'button', disabled: open ? undefined : true }, [
        h('span.lv-num', {}, String(i + 1)),
        h('span.lv-name', {}, [h('b', {}, lv.title), h('small', {}, lv.concept || '')]),
        open
          ? h('span.lv-stars', {}, [1, 2, 3].map((k) => h('i' + (rec && k <= rec.s ? '.on' : ''), {}, icon('star', { size: 20, stroke: 2 }))))
          : h('span.lv-lock', {}, icon('lock', { size: 22 })),
      ]);
      row.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!open) return;
        audio.play('tap');
        nav.openLevel(lv);
      });
      return row;
    });
    panel = h('div.side-panel', {}, [
      h('div.sp-head', {}, [
        h('div', {}, [h('small', {}, `第 ${ch.order} 章`), h('b', {}, ch.name)]),
        btn('close', null, () => { audio.play('tap'); closePanel(); }, 'ghost'),
      ]),
      h('div.sp-intro', {}, [btn('sound', null, () => audio.say(ch.intro), 'ghost'), h('p', {}, ch.intro)]),
      h('div.sp-list', {}, rows),
    ]);
    hud.layer.appendChild(panel);
    requestAnimationFrame(() => panel?.classList.add('open'));
    audio.say(ch.intro);
    scope.add(() => closePanel(true));
  }

  function closePanel(quiet) {
    if (!panel) return;
    const p = panel;
    panel = null;
    p.classList.remove('open');
    setTimeout(() => p.remove(), 260);
    if (!quiet) { selected = null; overview(false); }
  }

  // ---------- 智慧卡册 ----------
  function openCards() {
    const all = chapters.flatMap((c) => c.cards.map((card) => ({ card, ch: c })));
    const got = new Set(progress.cards());
    const grid = h('div.cards-grid', {}, all.map(({ card, ch }) => {
      const has = got.has(card.id);
      const src = ch.levels.find((l) => l.id === card.unlockBy);
      return h(`div.card${has ? '' : '.unknown'}`, {}, has
        ? [
          h('div.card-ico', {}, icon(card.icon || 'book', { size: 44 })),
          h('div.card-body', {}, [
            h('div.card-title', {}, [h('b', {}, card.title), btn('sound', null, () => audio.say(`${card.title}。${card.lines.join('')}`), 'ghost')]),
            ...card.lines.map((t) => h('p', {}, t)),
          ]),
        ]
        : [
          h('div.card-ico', {}, icon('lock', { size: 36 })),
          h('div.card-body', {}, [h('b', {}, '？'), h('p', {}, src ? `${ch.order}-${src.index + 1} ${src.title}` : '')]),
        ]);
    }));
    hud.openModal(h('div.modal.book', {}, [
      h('div.m-head', {}, [h('b', {}, '智慧卡'), h('span.m-count', {}, `${got.size} / ${all.length}`), btn('close', null, () => { audio.play('tap'); hud.closeModal(); }, 'ghost')]),
      all.length ? grid : h('p', {}, '还没有卡。'),
    ]));
  }

  // ---------- 眼力 ----------
  function openEye() {
    const rows = EYE_KINDS.map((k) => {
      const arr = progress.eye(k).slice(-10);
      const last = arr[arr.length - 1];
      return h('div.eye-row', {}, [
        h('span.eye-name', {}, EYE_NAMES[k]),
        arr.length
          ? h('div.eye-bars', {}, arr.map((v, i) => h('i' + (i === arr.length - 1 ? '.last' : ''), { style: { height: `${Math.max(6, v)}%` } })))
          : h('div.eye-bars.empty', {}, '还没猜过'),
        h('span.eye-last', {}, arr.length ? String(last) : ''),
      ]);
    });
    hud.openModal(h('div.modal.eye', {}, [
      h('div.m-head', {}, [icon('eye', { size: 26 }), h('b', {}, '眼力'), btn('close', null, () => { audio.play('tap'); hud.closeModal(); }, 'ghost')]),
      h('div.eye-list', {}, rows),
    ]));
  }

  return { show, get selected() { return selected; } };
}

// ---------- 小工具 ----------
/** 把一组静态网格按「材质 + 投不投影」合并成几个大网格。 */
function mergeStatic(group) {
  group.updateMatrixWorld(true);
  const buckets = new Map();
  group.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || Array.isArray(o.material)) return;
    const key = `${o.material.uuid}|${o.castShadow}`;
    if (!buckets.has(key)) buckets.set(key, { mat: o.material, cast: o.castShadow, geos: [] });
    const g = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()).applyMatrix4(o.matrixWorld);
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal'].includes(name)) g.deleteAttribute(name);
    buckets.get(key).geos.push(g);
  });
  group.clear();
  for (const b of buckets.values()) {
    const merged = mergeGeometries(b.geos);
    b.geos.forEach((g) => g.dispose());
    if (!merged) continue;
    const m = new THREE.Mesh(merged, b.mat);
    m.castShadow = b.cast;
    m.receiveShadow = true;
    group.add(m);
  }
}

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 沿曲线铺一条平带子。 */
function ribbon(curve, width, material, y, waterLike = false) {
  const n = 120;
  const pos = [];
  const idx = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = curve.getPointAt(t);
    const tan = curve.getTangentAt(t);
    const nx = -tan.z, nz = tan.x;
    const w = width / 2 * (waterLike ? 1 + Math.sin(t * 17) * 0.08 : 1);
    pos.push(p.x + nx * w, y, p.z + nz * w, p.x - nx * w, y, p.z - nz * w);
    if (i < n) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  if (material.side !== undefined) material.side = THREE.DoubleSide;
  const m = new THREE.Mesh(g, material);
  m.receiveShadow = true;
  return m;
}

function animateWater(mesh) {
  const pos = mesh.geometry.attributes.position;
  const base = Float32Array.from(pos.array);
  const off = (dt, t) => {
    if (!mesh.parent) return;
    for (let i = 0; i < pos.count; i++) {
      pos.array[i * 3 + 1] = base[i * 3 + 1] + Math.sin(base[i * 3] * 0.6 + t * 1.8) * 0.04;
    }
    pos.needsUpdate = true;
  };
  mesh.onBeforeRender = () => off(0, performance.now() / 1000);
}

function riverZ(curve, x) {
  let best = 0, bd = Infinity;
  for (let i = 0; i <= 200; i++) {
    const p = curve.getPointAt(i / 200);
    const d = Math.abs(p.x - x);
    if (d < bd) { bd = d; best = p.z; }
  }
  return best;
}

