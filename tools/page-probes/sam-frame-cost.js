// Paste/evaluate after launching Serious Sam in cooperative mode. Diagnostic
// wrappers preserve behavior; their nested times must not be added together.
(() => {
  const perf = window.WinePerf;
  window.samSample = null;
  const previousEnd = perf.stepEnd;
  perf.stepEnd = function (...args) {
    const step = this._cur;
    const result = previousEnd.apply(this, args);
    if (step && window.samSample) window.samSample.steps.push({ ...step });
    return result;
  };
  const wrap = (prototype, name, key) => {
    const original = prototype[name];
    if (!original) return;
    prototype[name] = function (...args) {
      const start = performance.now();
      const result = original.apply(this, args);
      if (window.samSample) (window.samSample[key] ||= []).push([start, performance.now() - start]);
      return result;
    };
  };
  wrap(OpenGLCompat.OpenGLHostBridge.prototype, 'present', 'glPresents');
  wrap(OpenGLCompat.OpenGLHostBridge.prototype, 'replay', 'glReplay');
  wrap(GpuBackend.WebGLBackend.prototype, 'present', 'backendPresent');
  wrap(GpuBackend.WebGLBackend.prototype, 'uploadTexture', 'textureUpload');
  wrap(WebGLRenderingContext.prototype, 'readPixels', 'readPixels');
  window.samBegin = () => {
    perf.recordPacing(true);
    window.samSample = {
      start: performance.now(), before: perf.snapshot(),
      glBefore: JSON.parse(JSON.stringify(OpenGLCompat.stats)),
      steps: [], glPresents: [], glReplay: [],
    };
  };
  window.samEnd = () => {
    const sample = window.samSample;
    window.samSample = null;
    sample.end = performance.now();
    sample.after = perf.snapshot();
    sample.glAfter = JSON.parse(JSON.stringify(OpenGLCompat.stats));
    sample.pacing = perf.paceLog;
    perf.recordPacing(false);
    return sample;
  };
})();
