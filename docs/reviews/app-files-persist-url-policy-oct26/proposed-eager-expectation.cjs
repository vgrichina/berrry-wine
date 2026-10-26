'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeLazyFiles, APP_EAGER_BYTES } = require('../repo/lib/app-files');
for (const suffix of ['?v=1', '#fragment']) test('proposed eager expectation '+suffix, () => {
const save = {url: 'game/save.dat'+suffix, size: 1};
const result = normalizeLazyFiles({persistFiles: ['c:\\save.dat']}, [save, {url:'bulk.pak',size:APP_EAGER_BYTES+1}]);
assert.equal(result.files[0].httpRange, undefined, 'proposed suffix-stripping expectation conflicts with literal host mount');
});
