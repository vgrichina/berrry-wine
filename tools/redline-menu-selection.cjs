'use strict';
const assert = require('node:assert/strict');

// The owner/capture admission stays in the caller. Under pointer lock, CDP
// coordinate differences are guest counts, so an absolute CSS click must not
// reposition a software cursor. The caller supplies its last submitted CDP
// point, not the frozen DOM clientX/Y anchor.
async function perform({ordinaryMouse, pointerLocked, cdpPoint, ...options}) {
  const c = options.command;
  assert.equal(typeof pointerLocked, 'boolean', 'current pointer-lock read required');
  assert(ordinaryMouse && typeof ordinaryMouse.perform === 'function');
  if (!pointerLocked) {
    assert(!c.cursorOnly, 'current-cursor click requires pointer lock');
    return ordinaryMouse.perform(options);
  }
  assert(c.action === 'click' && c.cursorOnly === true,
    'locked absolute mouse target refused; review cursor then use cursorOnly click');
  assert(cdpPoint && Number.isFinite(cdpPoint.x) && Number.isFinite(cdpPoint.y),
    'last submitted CDP position required; DOM anchor is insufficient');
  assert.equal(c.holdMs, 150, 'menu click retains 150ms hold');
  const at = {x: cdpPoint.x, y: cdpPoint.y};
  // Reuse the established independent release and hold implementation. Its
  // normalized midpoint now maps to exactly the last submitted position.
  const proof = await ordinaryMouse.perform({...options,
    geometry: {left: at.x - 0.5, top: at.y - 0.5, width: 1, height: 1},
    command: {...c, point: [0.5, 0.5]}});
  return {...proof, cursorOnly: true, cdpPoint: at,
    meaning: 'zero CDP displacement; reviewed software cursor owns selection'};
}
module.exports = {perform};
