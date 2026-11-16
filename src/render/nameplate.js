// Floating callsign + health bar over other players / bots / practice targets.
import * as THREE from 'three';

export function makePlate() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 80;
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.minFilter = THREE.LinearFilter;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false, depthWrite: false, toneMapped: false }));
  s.scale.set(1.15, 0.36, 1); s.renderOrder = 998; s.userData = { c, t, key: '' };
  return s;
}

const TIER_TAG = { casual: ['CASUAL', '#9aa4ae'], normal: ['', ''], veteran: ['★ VETERAN', '#ffc840'] };
export function drawPlate(s, name, hp, armor, maxHp, color, ultra, tier) {
  const key = `${name}|${Math.ceil(hp)}|${Math.ceil(armor)}|${color}|${ultra}|${tier}`;
  if (s.userData.key === key) return; s.userData.key = key;
  const { c, t } = s.userData; const x = c.getContext('2d');
  x.clearRect(0, 0, 256, 80);
  x.font = '700 24px "Segoe UI", Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.lineWidth = 5; x.strokeStyle = 'rgba(0,0,0,0.85)'; x.strokeText((ultra ? '⚡ ' : '') + name, 128, 20);
  x.fillStyle = ultra ? '#5af2ff' : color; x.fillText((ultra ? '⚡ ' : '') + name, 128, 20);
  const tag = TIER_TAG[tier];
  if (tag && tag[0]) { x.font = '800 13px "Segoe UI", Arial, sans-serif'; x.lineWidth = 3; x.strokeText(tag[0], 128, 68); x.fillStyle = tag[1]; x.fillText(tag[0], 128, 68); }
  // bar
  const w = 170, bx = 128 - w / 2, by = 42;
  x.fillStyle = 'rgba(0,0,0,0.7)'; x.fillRect(bx - 3, by - 3, w + 6, 16);
  const f = Math.max(0, Math.min(1, hp / maxHp));
  x.fillStyle = f > 0.5 ? '#3ad05a' : f > 0.25 ? '#f0c030' : '#e83a2a'; x.fillRect(bx, by, w * f, 10);
  if (armor > 0) { x.fillStyle = '#4ab0ff'; x.fillRect(bx, by + 7, w * Math.min(1, armor / 50), 3); }
  t.needsUpdate = true;
}
