// Browser fullscreen and iOS viewport-chrome handling.
//
// The page owns canvas sizing and process lifetime. This controller owns the
// browser-facing state around them: element/page fullscreen, the iOS Safari
// scroll-to-collapse affordance, fullscreen theme color, and the public
// handlers used by inline controls and lib/renderer.js.

(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.pageViewport = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const DESKTOP_THEME_COLOR = '#008080';

  function createPageViewport(deps = {}) {
    const pageWindow = deps.window ||
      (typeof window !== 'undefined' ? window : globalThis);
    const document = deps.document || pageWindow.document;
    const getRenderer = deps.getRenderer || (() =>
      pageWindow.sharedRenderer || (pageWindow.wine && pageWindow.wine.renderer));
    const resizeCanvas = deps.resizeCanvas || (() => {});
    const stopAllApps = deps.stopAllApps || (() => {});
    const singleApp = deps.singleApp || (() => false);
    const debugMode = !!deps.debugMode;
    const getKeyboardController = deps.getKeyboardController || (() => null);
    const search = deps.search !== undefined
      ? String(deps.search || '')
      : String((pageWindow.location && pageWindow.location.search) || '');

    let pinnedViewportHeight = 0;
    let collapseViewportWidth = 0;
    let largeViewportProbe = null;
    let pageFullscreenHintShown = false;
    let installed = false;

    function element(id) {
      return document && document.getElementById
        ? document.getElementById(id) : null;
    }

    function renderer() {
      return getRenderer();
    }

    function fullscreenTarget() {
      return element('screen-wrap');
    }

    function syncFullscreenThemeColor() {
      const meta = document && document.querySelector
        ? document.querySelector('meta[name="theme-color"]') : null;
      if (!meta || !document.body) return;
      const immersive = document.body.classList.contains('page-fullscreen') ||
        document.body.classList.contains('exclusive-fullscreen');
      const want = immersive ? '#000000' : DESKTOP_THEME_COLOR;
      if (meta.getAttribute('content') !== want) meta.setAttribute('content', want);
    }

    function syncFullscreenChipLabel() {
      const chip = element('page-fullscreen-exit');
      if (!chip || !document.body) return;
      const closes = singleApp() && document.body.classList.contains('app-running');
      const label = closes ? 'Close app' : 'Leave full screen';
      chip.title = label;
      chip.setAttribute('aria-label', label);
    }

    // Only iOS Safari with removable browser chrome needs a real document
    // scroll target. An installed home-screen app has no bars to collapse.
    function browserChromeIsRemovableByScroll() {
      const navigator = pageWindow.navigator || {};
      const standalone = navigator.standalone === true ||
        (pageWindow.matchMedia &&
          pageWindow.matchMedia('(display-mode: standalone)').matches);
      const iosSafari = /iP(hone|od|ad)/.test(navigator.userAgent || '') ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      return iosSafari && !standalone;
    }

    // 100lvh is the constant bars-retracted height. A browser without lvh
    // reports zero here, so callers fall back to a relative-height test.
    function largeViewportHeight() {
      if (!largeViewportProbe) {
        largeViewportProbe = document.createElement('div');
        largeViewportProbe.style.cssText = 'position:absolute;top:0;left:0;width:0;' +
          'height:100lvh;visibility:hidden;pointer-events:none';
        document.documentElement.appendChild(largeViewportProbe);
      }
      const height = Math.round(largeViewportProbe.getBoundingClientRect().height);
      return height > 10 ? height : 0;
    }

    function scrollCollapseArm() {
      if (!browserChromeIsRemovableByScroll() || !document.body) return;
      pinnedViewportHeight = pageWindow.innerHeight;
      collapseViewportWidth = pageWindow.innerWidth;
      document.body.classList.add('scroll-collapse');
    }

    function scrollCollapseDisarm() {
      if (document.body) {
        document.body.classList.remove('scroll-collapse', 'bars-collapsed');
      }
      if (document.documentElement && document.documentElement.style) {
        document.documentElement.style.removeProperty('--pinned-vh');
      }
      pinnedViewportHeight = 0;
      collapseViewportWidth = 0;
    }

    function scrollCollapseSample() {
      if (!document.body ||
          !document.body.classList.contains('scroll-collapse')) return;
      // A portrait collapse says nothing after rotation. Width changes also
      // cover Safari changing its landscape side insets. Keyboard-only height
      // changes deliberately do not re-arm the strip over text entry.
      if (Math.abs(pageWindow.innerWidth - collapseViewportWidth) > 1) {
        collapseViewportWidth = pageWindow.innerWidth;
        pinnedViewportHeight = pageWindow.innerHeight;
        document.body.classList.remove('bars-collapsed');
        document.documentElement.style.removeProperty('--pinned-vh');
      }
      const height = pageWindow.innerHeight;
      // Keep the historical DevTools/test override seam: this function was a
      // page global before the extraction, and real-browser diagnostics use a
      // temporary replacement to model Safari's absent toolbar height in
      // Chrome. Normal calls still stay inside the controller.
      const publicLargeViewportHeight = pageWindow.largeViewportHeight;
      const large = publicLargeViewportHeight &&
        publicLargeViewportHeight !== largeViewportHeight
        ? publicLargeViewportHeight()
        : largeViewportHeight();
      // Prefer the absolute lvh test. The relative fallback cannot recognize a
      // page that arrived already collapsed, but still distinguishes browser
      // chrome growth from the shorter on-screen-keyboard viewport.
      const collapsed = large
        ? height >= large - 8
        : height > pinnedViewportHeight + 24;
      if (!collapsed) return;

      const wasCollapsed = document.body.classList.contains('bars-collapsed');
      document.body.classList.add('bars-collapsed');
      // Landscape iOS overlays the bars: innerHeight can stay constant while
      // 100dvh grows from 100svh to 100lvh. The class transition therefore
      // also requires one resize even when the numeric height did not change.
      if (wasCollapsed && height <= pinnedViewportHeight) return;
      if (height > pinnedViewportHeight) pinnedViewportHeight = height;
      // Pin the acquired height. dvh tracks bars in both directions, and a
      // later stray swipe must not resize the guest a second time.
      document.documentElement.style.setProperty('--pinned-vh', height + 'px');
      resizeCanvas();
    }

    function showPageFullscreenHint() {
      const hint = element('page-fullscreen-hint');
      if (!hint || pageFullscreenHintShown) return;
      if (!browserChromeIsRemovableByScroll()) {
        hint.style.display = 'none';
        return;
      }
      pageFullscreenHintShown = true;
      hint.classList.remove('faded');
      const later = deps.setTimeout ||
        (pageWindow.setTimeout && pageWindow.setTimeout.bind(pageWindow));
      if (later) later(() => hint.classList.add('faded'), 4000);
    }

    function enterPageFullscreen() {
      if (!document.body ||
          document.body.classList.contains('page-fullscreen')) return;
      document.body.classList.add('page-fullscreen');
      syncFullscreenThemeColor();
      const currentRenderer = renderer();
      if (currentRenderer) {
        currentRenderer._requestedBrowserFullscreen = true;
        // Asking again is the way back in after the exit chip.
        currentRenderer._fullscreenDeclined = false;
      }
      // A stale scroll position would put the top of the app off-screen.
      pageWindow.scrollTo(0, 0);
      resizeCanvas();
      showPageFullscreenHint();
      scrollCollapseArm();
    }

    function enterPageFullscreenIfNoApi() {
      const target = fullscreenTarget();
      if (!target || target.requestFullscreen || target.webkitRequestFullscreen) return;
      enterPageFullscreen();
    }

    async function approveBrowserFullscreen(event) {
      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }
      const target = fullscreenTarget();
      const current = document.fullscreenElement || document.webkitFullscreenElement;
      if (!target || current === target) return;
      const request = target.requestFullscreen || target.webkitRequestFullscreen;
      // iPhone Safari has no element Fullscreen API for ordinary elements.
      if (!request) return enterPageFullscreen();
      const currentRenderer = renderer();
      if (currentRenderer) {
        currentRenderer._requestedBrowserFullscreen = true;
        currentRenderer._fullscreenDeclined = false;
      }
      try {
        const result = request.call(target);
        if (result && result.then) await result;
        resizeCanvas();
      } catch (_) {
        if (currentRenderer) currentRenderer._requestedBrowserFullscreen = false;
      }
    }

    function exitPageFullscreen(event) {
      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }
      if (document.body) document.body.classList.remove('page-fullscreen');
      syncFullscreenThemeColor();
      const currentRenderer = renderer();
      if (currentRenderer) {
        currentRenderer._requestedBrowserFullscreen = false;
        // Only a person declines. The renderer calls this without an event
        // when the guest releases exclusive mode and may take it again later.
        if (event) currentRenderer._fullscreenDeclined = true;
        // The guard prevents _setExclusiveFullscreen(false), which calls back
        // through this function, from recursing.
        if (currentRenderer._exclusiveFullscreen) {
          currentRenderer._setExclusiveFullscreen(false);
        }
      }
      scrollCollapseDisarm();
      resizeCanvas();
    }

    function exitPageFullscreenFromPinch() {
      const body = document.body;
      if (!body || !body.classList.contains('page-fullscreen') ||
          !body.classList.contains('scroll-collapse') ||
          !body.classList.contains('bars-collapsed')) return false;
      const currentRenderer = renderer();
      if (currentRenderer) currentRenderer._fullscreenDeclined = true;
      exitPageFullscreen();
      pageWindow.scrollTo(0, 0);
      return true;
    }

    function closeFullscreenChip(event) {
      if (singleApp() && document.body &&
          document.body.classList.contains('app-running')) {
        if (event) {
          event.preventDefault();
          event.stopPropagation();
        }
        stopAllApps();
        return;
      }
      exitPageFullscreen(event);
    }

    function syncWindowedPageFullscreen() {
      const body = document.body;
      if (!body) return;
      const windowed = singleApp() && !debugMode &&
        body.classList.contains('app-running') &&
        !body.classList.contains('exclusive-fullscreen');
      body.classList.toggle('windowed-phone', windowed);
      syncFullscreenChipLabel();
      syncFullscreenThemeColor();
      if (!windowed) return;
      // Freeze the orientation decision during keyboard entry: a portrait
      // keyboard can make the remaining viewport wider than it is tall.
      const keyboardController = getKeyboardController();
      const height = (keyboardController && keyboardController.frozenHeight()) ||
        pageWindow.innerHeight;
      const currentRenderer = renderer();
      if (pageWindow.innerWidth > height &&
          !(currentRenderer && currentRenderer._fullscreenDeclined)) {
        enterPageFullscreenIfNoApi();
      } else if (body.classList.contains('page-fullscreen')) {
        exitPageFullscreen();
      }
    }

    // ?scroll-debug paints the three values that distinguish missing overflow,
    // a clamped scroller, and a gesture that never reached the root scroller.
    function installScrollDiagnostics() {
      if (!new URLSearchParams(search).has('scroll-debug')) return;
      const box = document.createElement('div');
      box.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:2147483647;' +
        'background:#000;color:#0f0;font:11px/1.4 ui-monospace,monospace;' +
        'padding:3px 4px;text-align:center;pointer-events:none;white-space:pre-wrap';
      const paint = () => {
        box.textContent =
          'h' + document.documentElement.scrollHeight +
          ' v' + pageWindow.innerHeight +
          ' y' + Math.round(pageWindow.scrollY) +
          ' max' + Math.max(0,
            document.documentElement.scrollHeight - pageWindow.innerHeight) +
          '\n' + ((document.body && document.body.className) || '(no classes)');
      };
      const repeat = deps.setInterval ||
        (pageWindow.setInterval && pageWindow.setInterval.bind(pageWindow));
      if (repeat) repeat(paint, 300);
      pageWindow.addEventListener('scroll', paint, { passive: true });
      if (document.body) document.body.appendChild(box);
      else document.addEventListener('DOMContentLoaded', () => document.body.appendChild(box));
    }

    function install() {
      if (installed) return;
      installed = true;
      installScrollDiagnostics();
      pageWindow.addEventListener('resize', scrollCollapseSample);
      pageWindow.addEventListener('scroll', scrollCollapseSample, { passive: true });
      if (pageWindow.visualViewport) {
        pageWindow.visualViewport.addEventListener('resize', scrollCollapseSample);
      }
      document.addEventListener('fullscreenchange', resizeCanvas);
      document.addEventListener('webkitfullscreenchange', resizeCanvas);
    }

    return {
      approveBrowserFullscreen,
      browserChromeIsRemovableByScroll,
      closeFullscreenChip,
      enterPageFullscreen,
      enterPageFullscreenIfNoApi,
      exitPageFullscreen,
      exitPageFullscreenFromPinch,
      install,
      largeViewportHeight,
      scrollCollapseArm,
      scrollCollapseDisarm,
      scrollCollapseSample,
      showPageFullscreenHint,
      syncFullscreenChipLabel,
      syncFullscreenThemeColor,
      syncWindowedPageFullscreen,
    };
  }

  return {
    DESKTOP_THEME_COLOR,
    createPageViewport,
  };
});
