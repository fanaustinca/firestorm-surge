// Keyboard / mouse / pointer-lock input with an override layer for automated tests.
// Rebindable actions: [label, primary default, fixed secondary (dropped if another action's primary uses it)]
export const KEY_ACTIONS = {
  forward: ['Move forward', 'KeyW', 'ArrowUp'], back: ['Move back', 'KeyS', 'ArrowDown'],
  left: ['Strafe left', 'KeyA', 'ArrowLeft'], right: ['Strafe right', 'KeyD', 'ArrowRight'],
  jump: ['Jump', 'Space'], slide: ['Slide', 'KeyC', 'ControlLeft'], reload: ['Reload', 'KeyR'],
  slot1: ['Slot 1 (primary)', 'Digit1'], slot2: ['Slot 2 (pistol)', 'Digit2'], slot3: ['Slot 3 (melee)', 'Digit3'], slot4: ['Slot 4 (throwable)', 'Digit4'], slot5: ['Slot 5 (usable)', 'Digit5'],
  thermal: ['Thermal goggles', 'KeyF', 'KeyV'], loadout: ['Loadout', 'KeyB', 'KeyM'], scores: ['Scoreboard', 'Tab'],
};
export function keyName(code) {
  if (!code) return '—';
  return code.replace(/^Key/, '').replace(/^Digit/, '').replace(/^Numpad/, 'Num ').replace('ArrowUp', '↑').replace('ArrowDown', '↓').replace('ArrowLeft', '←').replace('ArrowRight', '→')
    .replace(/^(Shift|Control|Alt|Meta)(Left|Right)$/, (m, a, b) => (b === 'Right' ? 'R-' : '') + (a === 'Control' ? 'Ctrl' : a)).replace('Space', 'Space').replace('Backquote', '`').replace('CapsLock', 'Caps');
}
export class Input {
  constructor(canvas) {
    this.canvas = canvas; this.keys = new Set(); this.pressed = new Set(); this.mouse = { dx: 0, dy: 0, left: false, right: false, leftPressed: false, rightPressed: false };
    this.locked = false; this.enabled = true; this.sens = 1.0; this.virtual = null; this.listeners = {}; this.capture = null;
    this.setBinds({});
    addEventListener('keydown', (e) => {
      if (this.capture) { e.preventDefault(); e.stopPropagation(); const f = this.capture; this.capture = null; f(e.code); return; }
      if (e.repeat) return;
      if ((['Tab', 'Space'].includes(e.code) || this.byCode[e.code]?.includes('scores')) && this.enabled) e.preventDefault();
      this.keys.add(e.code); this.pressed.add(e.code); this.emit('key', e.code);
    });
    addEventListener('keyup', (e) => { this.keys.delete(e.code); if (e.code === 'Tab') e.preventDefault(); this.emit('keyup', e.code); });
    addEventListener('blur', () => { this.keys.clear(); this.mouse.left = this.mouse.right = false; });
    addEventListener('mousemove', (e) => { if (this.locked) { this.mouse.dx += e.movementX; this.mouse.dy += e.movementY; } });
    canvas.addEventListener('mousedown', (e) => {
      if (!this.locked && this.enabled) { this.requestLock(); }
      if (e.button === 0) { this.mouse.left = true; this.mouse.leftPressed = true; }
      if (e.button === 2) { this.mouse.right = true; this.mouse.rightPressed = true; }
    });
    addEventListener('mouseup', (e) => { if (e.button === 0) this.mouse.left = false; if (e.button === 2) this.mouse.right = false; });
    addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('pointerlockchange', () => { this.locked = document.pointerLockElement === canvas; this.emit('lock', this.locked); });
  }
  // custom: { action: code } overrides of the primary key
  setBinds(custom = {}) {
    const prim = {}; for (const a in KEY_ACTIONS) prim[a] = custom[a] || KEY_ACTIONS[a][1];
    const used = new Set(Object.values(prim)); this.binds = {}; this.byCode = {};
    for (const a in KEY_ACTIONS) { const sec = KEY_ACTIONS[a][2]; this.binds[a] = [prim[a], ...(sec && !used.has(sec) ? [sec] : [])]; for (const c of this.binds[a]) (this.byCode[c] ||= []).push(a); }
  }
  actions(code) { return this.byCode[code] || []; }
  act(a) { return this.binds[a].some((c) => this.keys.has(c) || this.virtual?.keys?.includes(c)); }
  actPressed(a) { return this.binds[a].some((c) => this.pressed.has(c)); }
  on(ev, fn) { (this.listeners[ev] ||= []).push(fn); }
  emit(ev, a) { (this.listeners[ev] || []).forEach((f) => f(a)); }
  requestLock() { try { const p = this.canvas.requestPointerLock?.(); if (p && p.catch) p.catch(() => {}); } catch { /* headless */ } }
  exitLock() { if (document.pointerLockElement) document.exitPointerLock(); }
  down(code) { return this.virtual?.keys?.includes(code) || this.keys.has(code); }
  wasPressed(code) { return this.pressed.has(code); }
  // Sample the per-frame player intent
  sample() {
    const v = this.virtual || {};
    const s = {
      forward: this.act('forward') || !!v.forward,
      back: this.act('back') || !!v.back,
      left: this.act('left') || !!v.left,
      right: this.act('right') || !!v.right,
      jump: this.act('jump') || !!v.jump,
      jumpPressed: this.actPressed('jump') || !!v.jumpPressed,
      fire: this.mouse.left || !!v.fire,
      firePressed: this.mouse.leftPressed || !!v.firePressed,
      alt: this.mouse.right || !!v.alt,
      altPressed: this.mouse.rightPressed || !!v.altPressed,
      reload: this.actPressed('reload') || !!v.reload,
      slide: this.actPressed('slide') || !!v.slide,
      dx: this.mouse.dx * this.sens, dy: this.mouse.dy * this.sens,
    };
    if (v.jumpPressed) v.jumpPressed = false;
    if (v.firePressed) v.firePressed = false;
    if (v.altPressed) v.altPressed = false;
    if (v.reload) v.reload = false;
    if (v.slide) v.slide = false;
    return s;
  }
  endFrame() { this.pressed.clear(); this.mouse.dx = this.mouse.dy = 0; this.mouse.leftPressed = this.mouse.rightPressed = false; }
}
