/* Small seek-safe GSAP primitives. No brand, random motion, timers or autonomous playback. */
(function (root) {
  'use strict';
  function event(kind, options) {
    const { id, start, duration } = options;
    if (!id || !Number.isFinite(start) || start < 0 || !Number.isFinite(duration) || duration <= 0) throw new Error('motion requires id, start >= 0 and duration > 0');
    return { id, kind, start, end: start + duration };
  }
  root.VidMotion = Object.freeze({
    enter(tl, element, options) {
      const e = event('enter', options);
      tl.set(element, { autoAlpha: 0, y: options.distance ?? 14, immediateRender: true }, 0);
      tl.fromTo(element, { autoAlpha: 0, y: options.distance ?? 14 },
        { autoAlpha: 1, y: 0, duration: options.duration, ease: 'power2.out', immediateRender: false }, e.start);
      return e;
    },
    punch(tl, wrapper, options) {
      const e = event('punch', options);
      tl.set(wrapper, { scale: options.from ?? 1, transformOrigin: options.origin ?? '50% 50%', immediateRender: true }, 0);
      tl.fromTo(wrapper, { scale: options.from ?? 1, transformOrigin: options.origin ?? '50% 50%' },
        { scale: options.to ?? 1.08, duration: options.duration, ease: 'sine.inOut', immediateRender: false }, e.start);
      return e;
    },
    draw(tl, path, options) {
      const e = event('draw', options);
      if (!(options.length > 0)) throw new Error('draw requires a measured SVG path length');
      tl.set(path, { strokeDasharray: options.length, strokeDashoffset: options.length, immediateRender: true }, 0);
      tl.fromTo(path, { strokeDasharray: options.length, strokeDashoffset: options.length },
        { strokeDashoffset: 0, autoRound: false, duration: options.duration, ease: 'power1.inOut', immediateRender: false }, e.start);
      return e;
    },
    click(tl, targets, options) {
      // The visual contact and the audio attack can share one storyboard event.
      const start = options.hit === undefined ? options.start : options.hit - options.duration * 0.5;
      if (options.hit !== undefined && (!Number.isFinite(options.hit) || (options.start !== undefined && Math.abs(options.start - start) > 1e-9))) throw new Error('click: hit and start disagree');
      const e = event('click', { ...options, start });
      const d = options.duration, hit = e.start + d * 0.5;
      e.markers = { hit, pressed: hit + d * 0.12, settled: hit + d * 0.3, end: e.end };
      tl.set(targets.cursor, { autoAlpha: 0, x: options.fromX ?? 40, y: options.fromY ?? 40, immediateRender: true }, 0);
      tl.set(targets.button, { scale: 1, immediateRender: true }, 0);
      tl.fromTo(targets.cursor, { x: options.fromX ?? 40, y: options.fromY ?? 40, autoAlpha: 0 },
        { x: 0, y: 0, autoAlpha: 1, duration: d * 0.5, ease: 'power2.out', immediateRender: false }, e.start);
      tl.fromTo(targets.button, { scale: 1 }, { scale: 0.95, duration: d * 0.12, ease: 'power1.in', immediateRender: false }, hit);
      tl.fromTo(targets.button, { scale: 0.95 }, { scale: 1, duration: d * 0.18, ease: 'power1.out', immediateRender: false }, hit + d * 0.12);
      if (targets.label && targets.doneLabel) {
        tl.set(targets.label, { autoAlpha: 1, immediateRender: true }, 0);
        tl.set(targets.doneLabel, { autoAlpha: 0, immediateRender: true }, 0);
        tl.set(targets.label, { autoAlpha: 0 }, hit + d * 0.12);
        tl.set(targets.doneLabel, { autoAlpha: 1 }, hit + d * 0.12);
      }
      tl.to(targets.cursor, { autoAlpha: 0, duration: d * 0.2, ease: 'none' }, e.start + d * 0.8);
      return e;
    },
  });
})(typeof window === 'undefined' ? globalThis : window);
