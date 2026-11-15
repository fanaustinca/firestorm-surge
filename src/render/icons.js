// Renders 3D item thumbnails (side view, studio lit) into data URLs for HUD/shop.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buildItem } from './models.js';

let r = null, scene, cam; const cache = new Map();
const MELEE_UP = ['knife', 'scythe', 'bat', 'karambit', 'katana', 'sledgehammer'];

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
    else if (['frag', 'smoke_grenade', 'molotov', 'flashbang', 'sticky_bomb', 'medkit', 'ammo_pack', 'adrenaline', 'thermal_goggles', 'blast_vest', 'spring_boots', 'tactical_gloves', 'fists', 'bandolier', 'armor_plate', 'barricade', 'shurikens', 'slippers'].includes(id)) obj.rotation.set(0.35, -0.6, 0);
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
