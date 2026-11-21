// Browser-page preferences for runtime logging and 2D presentation.
//
// The renderer consumes the WINE_* globals when it is constructed, while the
// debug toolbar changes the live renderer through its setter methods. Keeping
// both halves here makes the startup value and the value applied later follow
// the same normalization and storage rules. The page supplies only its DOM,
// storage/search environment and a live renderer lookup, so this can be tested
// without loading the emulator.

(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.pageSettings = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const RUNTIME_LOG_KEY = 'wine-assembly:runtime-log';
  const PRESENTATION_SCALE_KEY = 'wine-assembly:2d-scale';
  const PRESENTATION_CRT_KEY = 'wine-assembly:crt-effects';

  function normalize2dScalingMode(mode) {
    if (mode === 'scale2x' || mode === 'scale3x') mode = 'scale-auto';
    return mode === 'integer' || mode === 'sharp-bilinear' ||
      mode === 'browser-hq' || mode === 'sharp-hq' || mode === 'scale-auto' ||
      mode === 'fsr1'
      ? mode : 'nearest';
  }

  // Same mapping as presentation-filter.js: a preset, plus two optional
  // extras. A preference saved by the old three checkboxes reads as the VGA
  // preset if any of them was on, Off otherwise.
  const CRT_PRESET_NAMES = ['off', 'vga', 'arcade'];
  function normalizeCrtEffects(effects) {
    effects = effects || {};
    let preset = effects.preset;
    if (!CRT_PRESET_NAMES.includes(preset)) {
      preset = preset === undefined &&
        (effects.scanlines || effects.mask || effects.glow) ? 'vga' : 'off';
    }
    return {
      preset,
      curvature: !!effects.curvature,
      persistence: !!effects.persistence,
    };
  }

  function createPageSettings(deps = {}) {
    const pageWindow = deps.window ||
      (typeof window !== 'undefined' ? window : globalThis);
    const document = deps.document || pageWindow.document;
    const search = deps.search !== undefined
      ? String(deps.search || '')
      : String((pageWindow.location && pageWindow.location.search) || '');
    const getRenderer = deps.getRenderer || (() =>
      pageWindow.sharedRenderer || (pageWindow.wine && pageWindow.wine.renderer));

    function preferenceStorage() {
      if (Object.prototype.hasOwnProperty.call(deps, 'storage')) return deps.storage;
      try { return pageWindow.localStorage; } catch (_) { return null; }
    }

    function readPreference(key) {
      try {
        const storage = preferenceStorage();
        return storage ? storage.getItem(key) : null;
      } catch (_) {
        return null;
      }
    }

    function writePreference(key, value) {
      try {
        const storage = preferenceStorage();
        if (storage) storage.setItem(key, value);
      } catch (_) {}
    }

    function element(id) {
      return document && document.getElementById
        ? document.getElementById(id) : null;
    }

    let initialRuntimeLogging = true;
    const savedRuntimeLogging = readPreference(RUNTIME_LOG_KEY);
    if (savedRuntimeLogging !== null) initialRuntimeLogging = savedRuntimeLogging !== '0';
    // ?no-log affects this session only and must not overwrite the saved
    // choice. The log panel is not free: logToUI console.logs every line,
    // appends it, then forces layout through scrollTop. Measured on Diablo's
    // Choose Class screen, that was 39.9% of all CPU -- four times rendering.
    if (new URLSearchParams(search).has('no-log')) initialRuntimeLogging = false;
    pageWindow.WINE_RUNTIME_LOGGING = initialRuntimeLogging;
    const runtimeLogToggle = element('runtime-log-toggle');
    if (runtimeLogToggle) runtimeLogToggle.checked = initialRuntimeLogging;

    const initial2dScalingMode = normalize2dScalingMode(
      readPreference(PRESENTATION_SCALE_KEY));
    pageWindow.WINE_2D_SCALE_MODE = initial2dScalingMode;
    const scalingSelect = element('presentation-scale-select');
    if (scalingSelect) scalingSelect.value = initial2dScalingMode;

    let savedCrtEffects = {};
    try { savedCrtEffects = JSON.parse(readPreference(PRESENTATION_CRT_KEY) || '{}'); }
    catch (_) {}
    const initialCrtEffects = normalizeCrtEffects(savedCrtEffects);
    pageWindow.WINE_CRT_EFFECTS = initialCrtEffects;
    const crtPresetSelect = element('crt-preset-select');
    const curvatureToggle = element('crt-curvature-toggle');
    const persistenceToggle = element('crt-persistence-toggle');
    if (crtPresetSelect) crtPresetSelect.value = initialCrtEffects.preset;
    if (curvatureToggle) curvatureToggle.checked = initialCrtEffects.curvature;
    if (persistenceToggle) persistenceToggle.checked = initialCrtEffects.persistence;

    function setRuntimeLogging(enabled) {
      const on = !!enabled;
      pageWindow.WINE_RUNTIME_LOGGING = on;
      const toggle = element('runtime-log-toggle');
      if (toggle) toggle.checked = on;
      writePreference(RUNTIME_LOG_KEY, on ? '1' : '0');
      return on;
    }

    function apply2dScalingMode(mode) {
      const normalized = normalize2dScalingMode(mode);
      pageWindow.WINE_2D_SCALE_MODE = normalized;
      const select = element('presentation-scale-select');
      if (select) select.value = normalized;
      writePreference(PRESENTATION_SCALE_KEY, normalized);
      const renderer = getRenderer();
      if (renderer && typeof renderer.setPresentationScaleMode === 'function') {
        renderer.setPresentationScaleMode(normalized);
      }
      return normalized;
    }

    function applyCrtEffects() {
      const effects = normalizeCrtEffects({
        preset: (element('crt-preset-select') || {}).value || 'off',
        curvature: !!(element('crt-curvature-toggle') || {}).checked,
        persistence: !!(element('crt-persistence-toggle') || {}).checked,
      });
      pageWindow.WINE_CRT_EFFECTS = effects;
      writePreference(PRESENTATION_CRT_KEY, JSON.stringify(effects));
      const renderer = getRenderer();
      if (renderer && typeof renderer.setPresentationEffects === 'function') {
        renderer.setPresentationEffects(effects);
      }
      return effects;
    }

    return {
      apply2dScalingMode,
      applyCrtEffects,
      setRuntimeLogging,
    };
  }

  return {
    PRESENTATION_CRT_KEY,
    PRESENTATION_SCALE_KEY,
    RUNTIME_LOG_KEY,
    createPageSettings,
    normalize2dScalingMode,
    normalizeCrtEffects,
  };
});
