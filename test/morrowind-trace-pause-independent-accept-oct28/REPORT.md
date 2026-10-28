Exact candidate `1b5c93b2cb998094034cdce7f3eda497cf3c9006` is **accepted at the exercised source boundaries only**. Runner SHA-256 is `f96e9bb924700ee571e2904e097f80742ff55638399898ae1dc32454af05b02d`.

The unchanged earliest predecessor test is preserved as `unchanged-earliest.js`, SHA-256 `f7e35c0dd936336926036c121be02fecec20bcbed8945d0f16102390f937ef5d`. It was attempted first on this candidate and exited 1 at its old runner hash guard, before behavior. Its historical exit 0 meant demonstrated REJECTION, not acceptance. No old predicate was substituted to make it run.

The first actual candidate behavior independently executes the production parser, trace flags/state, startup arbitration, import and actual observer install, two reset statements and inherited reset, followed by the exact control branch with `--quiet-api --observe-morrowind-name --trace-api --trace-api-paused` and `{action:'trace-api',on:false}`. Main setter sequence is `[1,1]`, Worker setter `[1]`, inheritance `[['set_api_log',1]]`, observer remains installed, and `apiLogOff` is false. Mutating only the real changed control expression from `!!apiLogRequired(on)` to `on` produces `[1,0]` and is rejected by the same arming assertion.

`acceptance.js` passes 24 independent groups. These exercise main entry/exit/detail/memory visibility, a pause between entry and exit, the complete contiguous production Worker logger factory with real library decode/return logic and filters, required consumers, disabled/failed observer installation, default behavior, counter folding and repeated controls. The five `set_api_log` source sites are enumerated; both direct resets and inherited reset use `apiLogOff`, and control sites use arbitrated `logOn`. Exact slice hashes/byte offsets/line boundaries and the three fixture-only source transformations are recorded in `results.json`. No repair source or inherited passing correlation group was changed or replayed.

First missing acceptance evidence: actual whole-runner and initializer execution against the exact module and game. Only initializer source ordering is checked. Executing isolated statements against synthetic exports/memory does not establish intervening runner behavior, real initializer ordering, module/game behavior, arbitrary writer identity or object lifetime. This acceptance permits later separately authorized full-runner acceptance; it does not qualify gameplay or promote historical resource incidents.

The initial independent harness incorrectly expected legacy Worker output without `--trace-api`; the unchanged library policy already suppresses it. That was a harness failure, not a candidate rejection. Subsequent harness corrections supplied missing fixture `onFailure` and normalized cross-realm arrays. All failed-run diagnostics are retained. The final suite passed again after boundary metadata was added. Policy/metadata/bootstrap reads were outside the per-operation supervisor; no blanket task compliance claim is made.

Reproduce from repository root with the pinned original EXE (3,907,584 bytes, SHA-256 `f48300e194c6917cd98d235d259ebc3ab5d7c2071e9b41d798b996a8ce4d0676`):

```sh
/usr/bin/node --max-old-space-size=320 test/morrowind-trace-pause-independent-accept-oct28/acceptance.js /path/to/Morrowind.exe
```

Use the preserved supervisor/startup configuration for resource qualification. Node old-space is a heap setting, not a total RSS cap; Git DATA 256 MiB applies only to Git subprocesses. Canonical receipt/archive/recovery instructions are under `scratch/usage-watch/morrowind-trace-pause-independent-accept-oct28/` on the coordinating repository. No box was assigned; coordinator retains lifecycle ownership. No build, browser, guest, Boat, source repair, donor edit, main integration or public deployment occurred.
