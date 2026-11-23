// Renders 3D item thumbnails (side view, studio lit) into data URLs for HUD/shop.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buildItem } from './models.js';

let r = null, scene, cam; const cache = new Map();
const MELEE_UP = ['chainsaw', 'rubber_chicken', 'spear', 'knife', 'scythe', 'bat', 'karambit', 'katana', 'sledgehammer'];

function init() {
  const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 144;
  r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  r.setSize(256, 144, false); r.toneMapping = THREE.ACESFilmicToneMapping; r.outputColorSpace = THREE.SRGBColorSpace;
  scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(r); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x404040, 1.2));
  const d = new THREE.DirectionalLight(0xffffff, 2.5); d.position.set(2, 3, 4); scene.add(d);
  const d2 = new THREE.DirectionalLight(0x99bbff, 1.2); d2.position.set(-3, 1, -2); scene.add(d2);
  cam = new THREE.PerspectiveCamera(22, 256 / 144, 0.01, 50);
}

export function itemIcon(id, skin = null) {
  const key = id + ':' + (skin || '');
  if (cache.has(key)) return cache.get(key);
  try {
    if (!r) init();
    const obj = buildItem(id, { skin });
    const g = new THREE.Group(); g.add(obj);
    if (MELEE_UP.includes(id)) obj.rotation.set(0, 0, -Math.PI / 2 + 0.25);
    else if (['frag', 'smoke_grenade', 'molotov', 'flashbang', 'sticky_bomb', 'medkit', 'ammo_pack', 'adrenaline', 'thermal_goggles', 'blast_vest', 'spring_boots', 'tactical_gloves', 'fists', 'bandolier', 'armor_plate', 'barricade', 'shockwave_grenade', 'black_hole', 'grapple_hook', 'sentry_turret', 'shurikens', 'slippers', 'banana_peel'].includes(id)) obj.rotation.set(0.35, -0.6, 0);
    else obj.rotation.set(0, Math.PI / 2, 0); // side view, barrel to the right... (flip so muzzle faces left→right)
    if (!MELEE_UP.includes(id) && obj.rotation.y === Math.PI / 2) obj.rotation.y = -Math.PI / 2;
    scene.add(g);
    const box = new THREE.Box3().setFromObject(g); const c = box.getCenter(new THREE.Vector3()); const s = box.getSize(new THREE.Vector3());
    g.position.sub(c);
    const fit = Math.max(s.x / (256 / 144), s.y) * 0.55 / Math.tan((cam.fov * Math.PI) / 360);
    cam.position.set(0, 0.0, Math.max(0.2, fit + s.z * 0.6)); cam.lookAt(0, 0, 0);
    r.setClearColor(0x000000, 0); r.clear(); r.render(scene, cam);
    const url = r.domElement.toDataURL('image/png');
    scene.remove(g);
    cache.set(key, url); return url;
  } catch (e) { console.warn('icon failed', id, e); return ''; }
}

// ───── map preview thumbnails (rendered once per session, async so menus stay responsive) ─────
let mr = null; const mapCache = new Map(); let queue = Promise.resolve();
const VIEWS = { underground_lab: [[0, 8.4, 27], [0, 2.5, -8]], neon_market: [[0, 22, 34], [0, 3, -2]] };
export function mapThumb(id) {
  if (mapCache.has(id)) return mapCache.get(id);
  const p = queue = queue.then(() => new Promise((res) => setTimeout(async () => {
    try {
      const { buildMap } = await import('../world/maps.js');
      if (!mr) { const c = document.createElement('canvas'); c.width = 400; c.height = 225; mr = new THREE.WebGLRenderer({ canvas: c, antialias: true, preserveDrawingBuffer: true }); mr.setSize(400, 225, false); mr.toneMapping = THREE.ACESFilmicToneMapping; mr.outputColorSpace = THREE.SRGBColorSpace; mr.shadowMap.enabled = false; }
      const map = buildMap(id, { nav: false }); const e = map.env;
      const sc = new THREE.Scene(); sc.add(map.group); sc.background = new THREE.Color(e.indoor ? e.fog[0] : ({ night: 0x101830, snow: 0xc8dcf0, desert: 0xa8c8e8, dusk: 0xd8a888, jungle: 0x98b890 }[e.sky] ?? 0x8ab8e0));
      sc.fog = new THREE.Fog(e.fog[0], e.fog[1] * 1.4, e.fog[2] * 1.4);
      const sun = new THREE.DirectionalLight(e.sunColor, e.sunI); sun.position.set(...e.sun).normalize().multiplyScalar(60); sun.castShadow = true; const s = sun.shadow.camera; s.left = s.bottom = -36; s.right = s.top = 36; s.far = 160; sun.shadow.mapSize.set(1024, 1024); sc.add(sun);
      sc.add(new THREE.HemisphereLight(e.hemi[0], e.hemi[1], e.hemi[2]));
      if (!scene) init();
      sc.environment = scene.environment; sc.environmentIntensity = 0.4;
      mr.toneMappingExposure = e.exposure;
      const [pos, at] = VIEWS[id] || [[0, 30, 40], [0, 1, -3]];
      const cam = new THREE.PerspectiveCamera(55, 16 / 9, 0.5, 300); cam.position.set(...pos); cam.lookAt(...at);
      mr.render(sc, cam);
      const url = mr.domElement.toDataURL('image/jpeg', 0.82);
      map.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
      res(url);
    } catch (err) { console.warn('map thumb failed', id, err); res(''); }
  }, 30)));
  mapCache.set(id, p);
  return p;
}
