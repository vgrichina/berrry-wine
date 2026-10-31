'use strict';

const assert = require('assert');
const {
  DESKTOP_APPS, LOCAL_CANDIDATE_APPS, DEBUG_ONLY_APPS,
} = require('../lib/apps');

// Run the selector initializer itself: options are now populated from the
// mode's catalog, including entries with no static HTML option.
require('./test-desktop-selector-catalog');

const LISTS = [
  ['DESKTOP_APPS', DESKTOP_APPS],
  ['LOCAL_CANDIDATE_APPS', LOCAL_CANDIDATE_APPS],
  ['DEBUG_ONLY_APPS', DEBUG_ONLY_APPS],
];
const total = LISTS.reduce((sum, [, list]) => sum + list.length, 0);

// The three lists are meant to be disjoint: an app in two of them is offered
// twice by initDesktop()'s concat.
const seen = new Map();
for (const [name, list] of LISTS) {
  for (const [id] of list) {
    assert(!seen.has(id),
      `${id} appears in both ${seen.get(id)} and ${name}`);
    seen.set(id, name);
  }
}

console.log(`PASS  every listed app has a runtime selector option (${total} apps across ` +
  `${LISTS.length} lists)`);
