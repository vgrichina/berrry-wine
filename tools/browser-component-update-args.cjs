'use strict';

// Fresh test profiles otherwise download and unpack unrelated components
// (including the TTS WASM engine). Background-networking suppression alone
// does not stop that writer. Keep this scoped to project-owned browsers.
module.exports = Object.freeze(['--disable-component-update']);
