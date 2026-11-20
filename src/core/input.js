// Keyboard / mouse / pointer-lock input with an override layer for automated tests.
export class Input {
  constructor(canvas) {
    this.canvas = canvas; this.keys = new Set(); this.pressed = new Set(); this.mouse = { dx: 0, dy: 0, left: false, right: false, leftPressed: false, rightPressed: false };
    this.locked = false; this.enabled = true; this.sens = 1.0; this.virtual = null; this.listeners = {};
    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      if (['Tab', 'Space'].includes(e.code) && this.enabled) e.preventDefault();
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
      forward: this.down('KeyW') || this.down('ArrowUp') || !!v.forward,
      back: this.down('KeyS') || this.down('ArrowDown') || !!v.back,
      left: this.down('KeyA') || this.down('ArrowLeft') || !!v.left,
      right: this.down('KeyD') || this.down('ArrowRight') || !!v.right,
      jump: this.down('Space') || !!v.jump,
      jumpPressed: this.pressed.has('Space') || !!v.jumpPressed,
      fire: this.mouse.left || !!v.fire,
      firePressed: this.mouse.leftPressed || !!v.firePressed,
      alt: this.mouse.right || !!v.alt,
      altPressed: this.mouse.rightPressed || !!v.altPressed,
      reload: this.pressed.has('KeyR') || !!v.reload,
      slide: this.pressed.has('KeyC') || this.pressed.has('ControlLeft') || !!v.slide,
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
