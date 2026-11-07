'use strict';

// The generated Aranna control consumes mouse displacement in its wndproc.
// Polling GetCursorPos as well races queued WM_MOUSEMOVE delivery: the loop
// can consume a physical move before its message arrives, then consume it
// again from lParam. Keep polling/recentring for automatic pointer lock, but
// give displacement a single consumer. This transforms generated source only.
exports.messageOnly = function messageOnly(source) {
  const before = `a.load(M.cursor).store(M.sampleX).e(0x2d, U(400), 0x01, 0x05, U(M.uiX));
  a.load(M.cursor + 4).store(M.sampleY).e(0x2d, U(300), 0x01, 0x05, U(M.uiY));`;
  if (source.split(before).length !== 2) throw Error('generated cursor accumulator anchor');
  return source.replace(before, `a.load(M.cursor).store(M.sampleX);
  a.load(M.cursor + 4).store(M.sampleY);`);
};
