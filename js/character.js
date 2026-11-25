// Ensamblaje del personaje: combina las piezas de cada categoría según el
// estado seleccionado y anima las transiciones (morfado de proporciones y
// "pop" elástico en las piezas que cambian).
import * as THREE from 'three';
import { options as complexion } from './complexion.js';
import { options as gender } from './gender.js';
import { options as traits } from './traits.js';
import { options as profession } from './profession.js';
import { layout, resolveProfile, lerpProfile } from './common.js';

/** Dónde buscar el objeto de cada ranura. */
const SLOTS = {
  body:       (s) => complexion[s.complexion],
  gender:     (s) => gender[s.gender],
  hair:       (s) => traits.hair[s.hair],
  eyes:       (s) => traits.eyes[s.eyes],
  nose:       (s) => traits.nose[s.nose],
  facial:     (s) => traits.facial[s.facial],
  profession: (s) => profession[s.profession],
};
const SLOT_KEY = { body: 'complexion', gender: 'gender', hair: 'hair', eyes: 'eyes', nose: 'nose', facial: 'facial', profession: 'profession' };

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOutBack = (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };

function dispose(obj) {
  obj.traverse((o) => { if (o.isMesh) o.geometry.dispose(); }); // los materiales son compartidos
}

/** Perfil final: complexión + género + sliders de peso (-1..1) y estatura (-1..1). */
export function targetProfile(state) {
  const p = resolveProfile(complexion[state.complexion].profile, gender[state.gender].mods);
  const w = state.weight || 0, h = state.stature || 0;
  p.waist *= 1 + 0.28 * w;
  p.hip *= 1 + 0.16 * w;
  p.limb *= 1 + 0.22 * w;
  p.depth *= 1 + 0.1 * w;
  p.neck *= 1 + 0.1 * w;
  p.belly += Math.max(0, w) * 0.7;
  p.height *= 1 + 0.09 * h;
  return p;
}

export class Character {
  constructor() {
    this.root = new THREE.Group();
    this.root.name = 'personaje';
    this.slots = {};
    this.state = null;
    this.profile = null;
    this.anim = null;     // morfado de proporciones
    this.pops = [];       // animaciones "pop"
    for (const name of Object.keys(SLOTS)) {
      const g = new THREE.Group();
      g.name = name;
      this.slots[name] = g;
      this.root.add(g);
    }
  }

  _buildSlot(name) {
    const old = this.slots[name];
    const opt = SLOTS[name](this.state);
    const next = opt.build(this.L);
    next.name = name;
    // Sustituye conservando el orden dentro de root
    const idx = this.root.children.indexOf(old);
    this.root.remove(old);
    dispose(old);
    this.root.children.splice(idx, 0, next);
    next.parent = this.root;
    this.slots[name] = next;
    return next;
  }

  _rebuildAll() {
    this.L = layout(this.profile);
    for (const name of Object.keys(SLOTS)) this._buildSlot(name);
  }

  /** Aplica un estado nuevo. `animate=false` salta las transiciones. */
  set(state, animate = true) {
    const first = !this.state;
    const prev = this.state;
    this.state = { ...state };
    const target = targetProfile(this.state);

    if (first || !animate) {
      this.anim = null;
      this.profile = target;
      this._rebuildAll();
      return;
    }

    const bodyChanged = prev.complexion !== state.complexion || prev.gender !== state.gender;
    if (bodyChanged) {
      // Morfado de proporciones: se reconstruye en cada frame con el perfil interpolado.
      this.pops = [];
      this.anim = { from: { ...this.profile }, to: target, t: 0, dur: 0.5 };
      return;
    }
    // Solo cambian piezas sueltas: se reconstruyen y "saltan" con un pop elástico.
    this.L = layout(this.profile);
    for (const name of Object.keys(SLOTS)) {
      if (name === 'body') continue;
      if (prev[SLOT_KEY[name]] !== this.state[SLOT_KEY[name]]) {
        this._startPop(this._buildSlot(name), name === 'profession' ? 0.55 : 0.2);
      }
    }
  }

  /** Termina cualquier animación en curso (se usa antes de exportar). */
  finish() {
    if (this.anim) {
      this.profile = this.anim.to;
      this.anim = null;
      this._rebuildAll();
    }
    for (const p of this.pops) { p.obj.scale.set(1, 1, 1); p.obj.position.set(0, 0, 0); }
    this.pops = [];
    this.root.updateMatrixWorld(true);
  }

  _startPop(obj, from) {
    const box = new THREE.Box3().setFromObject(obj);
    const pivot = box.isEmpty() ? new THREE.Vector3() : box.getCenter(new THREE.Vector3());
    this.pops.push({ obj, pivot, from, t: 0, dur: 0.45 });
  }

  update(dt) {
    if (this.anim) {
      const a = this.anim;
      a.t = Math.min(1, a.t + dt / a.dur);
      this.profile = lerpProfile(a.from, a.to, easeInOut(a.t));
      this._rebuildAll();
      if (a.t >= 1) { this.profile = a.to; this.anim = null; this._rebuildAll(); }
    }
    for (let i = this.pops.length - 1; i >= 0; i--) {
      const p = this.pops[i];
      p.t = Math.min(1, p.t + dt / p.dur);
      const s = p.from + (1 - p.from) * easeOutBack(p.t);
      p.obj.scale.setScalar(s);
      p.obj.position.copy(p.pivot).multiplyScalar(1 - s);
      if (p.t >= 1) { p.obj.scale.set(1, 1, 1); p.obj.position.set(0, 0, 0); this.pops.splice(i, 1); }
    }
  }
}
