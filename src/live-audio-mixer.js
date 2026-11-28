/**
 * Optional live preview gain routing. Browser media element volume is capped at 1,
 * while a Web Audio GainNode can safely apply the editor's supported gain range.
 * If Web Audio is unavailable or routing fails, callers can use native volume fallback.
 */
export class LiveAudioMixer {
  constructor({ audioContextFactory } = {}) {
    this.audioContextFactory = audioContextFactory || (() => {
      const Context = globalThis.AudioContext || globalThis.webkitAudioContext;
      return Context ? new Context() : null;
    });
    this.context = null;
    this.routes = new WeakMap();
  }

  _getContext() {
    if (this.context) return this.context;
    try {
      this.context = this.audioContextFactory();
    } catch {
      this.context = null;
    }
    return this.context;
  }

  connect(element) {
    if (!element || typeof element !== 'object') return false;
    if (this.routes.has(element)) return true;
    const context = this._getContext();
    if (!context?.createMediaElementSource || !context?.createGain || !context.destination) return false;
    try {
      const source = context.createMediaElementSource(element);
      const gain = context.createGain();
      source.connect(gain);
      gain.connect(context.destination);
      this.routes.set(element, { source, gain });
      return true;
    } catch {
      // Do not break playback on browsers that reject media-element routing.
      return false;
    }
  }

  setGain(element, value) {
    const route = this.routes.get(element);
    if (!route) return false;
    const numeric = Number(value);
    const gain = Number.isFinite(numeric) ? Math.max(0, Math.min(1.5, numeric)) : 1;
    const param = route.gain.gain;
    if (typeof param.setTargetAtTime === 'function' && this.context) {
      param.setTargetAtTime(gain, this.context.currentTime, 0.015);
    } else {
      param.value = gain;
    }
    return true;
  }

  async resume() {
    const context = this.context;
    if (context?.state === 'suspended' && typeof context.resume === 'function') {
      await context.resume();
    }
  }
}
