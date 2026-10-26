Recover from branch task/renderer-side-modifier-polling-repair-oct26 using the
verified commit in sibling ops/result.json or the append-only root messageboard.
Its direct parent is 67b01162d74016f0f9f9915e1b07d7a81f942770.

In a focused checkout retain lib/renderer-input.js, lib/mem-utils.js and
lib/region-map.generated.js, the supplied test/renderer-physical-modifiers.test.cjs
and new test/renderer-side-modifier-polling.test.cjs. Copy the byte-exact
evidence/renderer-modifier-independent-accept.test.cjs to test/ if not present.
Run from repo/:

```
timeout 25s node --max-old-space-size=192 --test --test-reporter=tap test/renderer-physical-modifiers.test.cjs
timeout 25s node --max-old-space-size=192 --test --test-reporter=tap test/renderer-modifier-independent-accept.test.cjs
timeout 25s node --max-old-space-size=192 --test --test-reporter=tap test/renderer-side-modifier-polling.test.cjs
```

Expected results: 37/0, 29/0 and 28/0. Copy evidence/{baseline-loader.cjs,
baseline-renderer-input.js,candidate-loader.cjs,candidate-renderer-input.js,
run-legacy.cjs,legacy-keyboard-message-lparam.cjs} to sibling ops/. The loaders
substitute only implementation bytes, without changing any test. With
--require ../ops/candidate-loader.cjs the independent suite yields 23/6 and the
new suite 1/27. With --require ../ops/baseline-loader.cjs the independent suite
yields 2/27 and supplied suite 1/36. These nonzero exits are retained failures.

```
timeout 25s node --max-old-space-size=192 ../ops/run-legacy.cjs
```

The pinned legacy test must print PASS. Evidence hashes bind fixtures, logs,
source pins and predecessor history. Sourcepins and checkpoint bind the tested
implementation by SHA-256; result.json binds the final commit and verified remote
ref. Restore original evidence byte-exact; do not reinterpret initial failures as
passing acceptance. Independent acceptance remains outstanding.
