#!/usr/bin/env node
// Gate: every GL entry point whose answer the guest can read on its next
// instruction is a command-stream barrier.
//
// lib/gl-command-stream.js buffers GL calls into a batch and submits the batch
// later. That is correct for state and geometry, whose only observable effect
// is on the screen, and wrong for anything that writes guest memory or returns
// a value: the guest runs on, reads the destination, and sees whatever was
// there before the call. Nothing reports this. The call was made, the host
// answered it correctly, the answer simply had not arrived yet.
//
// Warcraft III is the case that cost a day. It asks
// glGetIntegerv(GL_MAX_TEXTURE_UNITS_ARB) and copies the answer into its
// renderer three instructions later. Buffered, the copy read the zero that was
// already there, the renderer concluded it had no texture units, and it never
// called glEnable(GL_TEXTURE_2D) again -- every polygon in the game drew
// untextured, with no error anywhere to say a query had been answered late
// rather than wrongly.
//
// So the rule is enforced by shape rather than by memory: an opcode whose name
// says it reports something (glGet*, glIs*, glGen*, glReadPixels) or that
// crosses the WGL boundary must be in BARRIERS. Two names match the shape and
// genuinely do not need it, and each has to say why here.
//
// Usage: node tools/check-gl-barriers.js
'use strict';

const path = require('path');

const ROOT = path.join(__dirname, '..');
const { CALLS } = require(path.join(ROOT, 'lib/gl-compat'));
const { BARRIERS } = require(path.join(ROOT, 'lib/gl-command-stream'));
if (!require('./gen-gl-encoder-abi').check()) {
  console.error('Native GL barriers are stale; run node tools/gen-gl-encoder-abi.js');
  process.exit(1);
}

// Names that look like queries but carry no guest-visible result across the
// call. Each entry is an argued exemption, not a silencer.
const EXEMPT = new Map([
  ['glGetString', 'answered entirely inside $handle_gpu_api (src/09a8b-handlers-opengl.wat) '
    + 'from a fixed data segment, so it never reaches the encoder at all'],
  ['glReadBuffer', 'selects the buffer later reads come from; it reports nothing '
    + 'and writes no guest memory'],
]);

// A call reports something to the guest if it writes through a pointer argument
// or returns a value the guest branches on. WGL is included wholesale: context
// creation, make-current and the pixel-format calls all return a handle or a
// status, and makeCurrent additionally retargets everything queued behind it.
const REPORTS = /^(glGet|glIs|glGen|glReadPixels$|gluScaleImage$|wgl|gpuPresent$)/;

const missing = [];
const staleExemptions = new Set(EXEMPT.keys());

CALLS.forEach((name, opcode) => {
  if (!name) return;
  staleExemptions.delete(name);
  if (!REPORTS.test(name)) return;
  if (BARRIERS.has(opcode)) {
    if (EXEMPT.has(name)) {
      missing.push(`${name} (opcode ${opcode}) is exempted in ${path.basename(__filename)} `
        + 'but is also a barrier -- drop the exemption, it is claiming something untrue');
    }
    return;
  }
  if (EXEMPT.has(name)) return;
  missing.push(`${name} (opcode ${opcode}) reports to the guest but is not in BARRIERS. `
    + 'Add it to BARRIERS in lib/gl-command-stream.js, or exempt it here with the reason '
    + 'its answer cannot be read before the batch is submitted.');
});

for (const name of staleExemptions) {
  missing.push(`${name} is exempted in ${path.basename(__filename)} but no longer exists in `
    + 'the GL call table -- remove the exemption');
}

if (missing.length) {
  console.error('GL barrier gate FAILED:');
  for (const line of missing) console.error('  ' + line);
  process.exit(1);
}

const barrierCount = BARRIERS.size;
const exemptCount = EXEMPT.size;
console.log(`gl barriers: OK (${barrierCount} barriers, ${exemptCount} argued exemptions, `
  + `${CALLS.filter(Boolean).length} GL entry points)`);
