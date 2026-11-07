'use strict';
// Chromium's trusted MouseEvent client coordinates: CDP double -> float
// position -> floor. PointerEvent coordinates retain the float fraction.
// Keep the submitted doubles as evidence; the native-motion anchor is the
// MouseEvent coordinate consumed by the production bridge, in viewport CSS
// pixels (before canvas offset/scaling). Never derive it from a guest point.
const assert = require('node:assert/strict');
function record(pointer, method, params) {
  if (method !== 'Input.dispatchMouseEvent') return;
  assert(Number.isFinite(params.x) && Number.isFinite(params.y), 'finite CDP mouse position required');
  pointer.sentX = params.x;
  pointer.sentY = params.y;
  pointer.x = Math.floor(Math.fround(params.x));
  pointer.y = Math.floor(Math.fround(params.y));
}
module.exports = {record};
