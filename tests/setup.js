// window.matchMedia is not implemented in jsdom — mock it so theme.js can import cleanly
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
});

// jsdom doesn't implement the Web Animations API (Element.animate) — stub it
// so components using it (issue #6 Phase 7's animatePhaseBody) don't throw in
// tests. The stub resolves `onfinish` on the next microtask so a test can
// `await Promise.resolve()` (or any awaited call) to observe the "after
// animation completes" state, without a real 240ms wait.
// jsdom implements neither Element.animate() nor Element.getAnimations() —
// this stub pair tracks each element's in-flight "animations" in a WeakMap
// so getAnimations()/cancel() actually interact with what animate() just
// created, instead of being independently faked. That matters for real test
// coverage of the animation-race fix (dashboard.js's animatePhaseBody calls
// `getAnimations().forEach(a => a.cancel())` before starting a new
// animation) — an unlinked pair of stubs couldn't verify cancellation ever
// really happens. onfinish resolves on the next microtask so a test can
// `await Promise.resolve()` instead of a real 240ms wait; cancel() suppresses
// it, matching real Animation semantics (cancel fires oncancel, not onfinish).
const stubAnimations = new WeakMap();
if (!Element.prototype.animate) {
  Element.prototype.animate = function stubAnimate() {
    let finishHandler = null;
    let canceled = false;
    const list = stubAnimations.get(this) || [];
    stubAnimations.set(this, list);
    const anim = {
      set onfinish(fn) {
        finishHandler = fn;
        queueMicrotask(() => {
          if (canceled || !finishHandler) return;
          finishHandler();
          const i = list.indexOf(anim);
          if (i !== -1) list.splice(i, 1);
        });
      },
      get onfinish() { return finishHandler; },
      cancel() {
        canceled = true;
        const i = list.indexOf(anim);
        if (i !== -1) list.splice(i, 1);
      },
      finish() {}
    };
    list.push(anim);
    return anim;
  };
}
if (!Element.prototype.getAnimations) {
  Element.prototype.getAnimations = function stubGetAnimations() {
    return [...(stubAnimations.get(this) || [])];
  };
}

// localStorage is present in jsdom but broken in some vitest versions — provide a reliable in-memory stub
const _store = {};
Object.defineProperty(window, 'localStorage', {
  writable: true,
  value: {
    getItem: k => _store[k] ?? null,
    setItem: (k, v) => { _store[k] = String(v); },
    removeItem: k => { delete _store[k]; },
    clear: () => { Object.keys(_store).forEach(k => delete _store[k]); },
  }
});
