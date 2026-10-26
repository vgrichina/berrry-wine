# Empty persistence aliases: tested repair

Base `52b7bb0e9e73fc839344c33f00cffa2c638fc193`; task branch `task/app-files-empty-alias-fallback-repair-oct26`. Only production change: require a nonempty `vfsPaths` array before returning its aliases. Empty arrays now fall through to `vfsPath` or the literal URL basename, matching host `loadFiles`. The accepted three-line literal-basename comment and all seven supplied regressions are carried forward. No suffix stripping or mount identity change.

The new fixture executes exported `normalizeLazyFiles` and the actual pinned entire host `loadFiles` method with local one-byte transport. Its unique header-to-loadDlls extraction is 16,464 bytes, SHA-256 `5fbb544b0f29130c90f2c14685e979bdfa40caaf43dfeb4d6181a26e62933659`. Guest naming expectations come from actual host map keys. The one-byte target plus known ballast totals exactly APP_EAGER_BYTES, exposing the persistence decision.

Final unchanged fixture: baseline 5 pass / 2 fail; repair 7 pass. Supplied regressions 7 pass; existing policy test passes. Coverage includes empty aliases with/without explicit path, literal query/fragment/separators/case, nonmatching lazy controls, nonempty alias precedence, loading declarations, app opt-out/Win16/small/unknown size gates, eager extensions, strings, metadata and frozen input nonmutation. Existing INI pass receipt reused because that implementation and its immutable inputs are unchanged.

The prior independent fixture intentionally pinned the old source and asserted the old defect. Its unadapted repair run retains those two expected failures. `run-independent.cjs` verifies the original fixture hash and, only with ADAPT_REPAIRED=1, updates the source pin, defect title and defect assertion. All seven then pass, including the suffix-stripping mutant rejection. This is a regression rerun, not independent acceptance of this repair. Original fixture and precise wrapper are retained. First failures and their corrections are in incidents.json; raw logs remain in ops.

Recovery: create a focused checkout at this task branch, retaining host.js, lib/app-files.js, lib/filesystem.js, lib/browser-shell.js, test/run.js, index.html and the two supplied/new test fixtures. Restore docs payloads into a sibling `ops` directory (repo and ops under the same task directory) for the independent wrapper. Run serially:

```sh
timeout 30s node --max-old-space-size=16 --test --test-concurrency=1 test/app-files-empty-alias-fallback-oct26.test.cjs
timeout 30s node --max-old-space-size=16 --test --test-concurrency=1 test/app-files-persist-url-policy-oct26.test.cjs
timeout 30s node --max-old-space-size=16 test/test-app-files-policy.js
ADAPT_REPAIRED=1 timeout 30s node --max-old-space-size=16 --test --test-concurrency=1 ../ops/run-independent.cjs
```

To reproduce the baseline pair, save repair lib/app-files.js, restore that file alone from the exact base, run the new fixture (two persistence failures), and restore the repair. `checkpoint-tests.json` binds each completed group to candidate base, source and fixture hashes and exact logs; final candidate commit/publication are in isolated ops/result.json and publication.json plus append-only root messageboard. No full checkout, build, main publication, guest, browser, gameplay, service, deployment or Boat operation. No assigned box: ID/state/expiry N/A; lifecycle remains coordinator-owned. No child workers. Root checkout/index/refs and donors remain read-only, except authorized messageboard append.

Remaining: coordinator independent acceptance, current-main reconciliation/separate integration with merged checks, and separately authorized runtime gates. Parser owner retains host.js and main ownership; renderer/browser-input/VFS untouched.
