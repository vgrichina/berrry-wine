# MDK2 original timer/load assignment: exact entry pair mismatch, zero Chrome

The required original was not launched. The first causal prerequisite failure
is the published MDK2 entry's selected source/module pair: it still serves
`1329b1ba6eb00144ff77d4cd92a8513d4fc953ad` with retained `cffca869…` /
`580f49f3…` modules. This assignment requires accepted
`9422cf64ca9d0bf868becb64e7209fb5feb670b3` and `018c94ff…` / `4e684af4…`.
The live checkout source and live modules match that required accepted pair;
the historical resolver deliberately selects different bytes. Passing its old
closure cannot qualify the required pair.

Inputs are [published passive observer](mdk2-timer-deferred-load-observer-20261104.md)
`399d2128d` and [original history](mdk2-decoder-return-original-20261104.md)
`12a87f179`. Evidence is `scratch/runs/20261104-mdk2-original-timer-load/`
(RUN). Exact base Git SHA and relevant binary diff, owned new-note patch,
path/hash input references and full old/new/reason amendment ledger are retained.
No source snapshot, tar, media/module copy or module restoration was made.

Only the local assignment and its hard deadlines change in production:
`20261104-mdk2-original-timer-load`, Chrome cutoff
`2026-11-05T00:20:00Z`, cleanup cutoff `00:23:00Z`.
The 720-second browser, 60-second bootstrap, 40-second command and 180-second
cleanup bounds remain. Matching tests assert the new assignment/deadlines.
The observer and integration driver remain byte-identical to `399d2128d`.

RUN/preflight-audit.json explicitly amends the named predecessor candidate rows:

| Path | Recorded predecessor SHA-256 | New SHA-256 | Reason |
| --- | --- | --- | --- |
| `tools/mdk2-lua-construction-observer.cjs` | `32a032392dbcaaa587688123842cb7509ff4b0f63a7c42bf38e395413ddaf7a9` | `dd37b5ba98bf052078bc81c72f4850f4e73caeea5b72c81698c4b0805269dfc3` | Published399d2128d passive timer/load observation |
| `tools/mdk2-construction-driver-integration.cjs` | `8d1730708c5c3e685aef5f77612b25e7fd45addc7d7ce7c8946777fefa6415d3` | `e0f3aa9b36af2a70d42f292c1f165f6dccc5724d75e716d276dcb9b78eb3fcf0` | Published399d2128d composition |
| `tools/mdk2-local-runtime.cjs` | `2372f7c82528f58954b5af7ff523c21cff59b2b6cc49d661935ce8de0b56ae3c` | `058f062131879a2a3f723cb3f1fc0838a369e1dd894b0b6cd7ee67db0ae60957` | Same published helper plus the owned assignment/deadline renewal only |

These are run-candidate amendments, not permission to replace runtime source,
modules or historical pins. The resolver's existing quiet bridge amendment is
unchanged. There was no blanket rehash or new runtime acceptance.

The fresh actual `local.start` entry acquired external
`/tmp/wine-local-runtime.lock` before proceeding. It checked the actual lock
descriptor/inode and exclusive contention, and inspected `/proc` executable and
argument identities: no other Chrome or headless game runtime was present.
Stronghold and legacy workers remained assigned offline. Plain Puppeteer
mocking and independent public/native child-spawn prohibitions were installed
before invoking the actual composed entry. There were no forbidden spawn calls.

The exact historical resolver checked all 432 filesystem and 432 HTTP rows,
including response bytes, no-store and isolation headers. Both its proof server
and composed driver server closed. The actual launch caller reached the plain
mock exactly once and received `ZERO_CHROME_LAUNCH_BOUNDARY`. This establishes
the old closure's mock traversal only. The required-pair comparison rejects it:

| Selected runtime module | Actual entry SHA-256 | Required live SHA-256 |
| --- | --- | --- |
| Canonical | `cffca869b541e6eff12ae3a6b74c4476977e0a7e23cd43d8ec5ba8faecd4bcee` | `018c94ffbde8c857587c25c860db988d603d0662df9a18901f00c183af7493cd` |
| Compat | `580f49f3c78d26e6855efa0beb37046d03ea24690ff98cfcb3e94ce5e6cb1ee3` | `4e684af48e4ec06ae8aada0d5cd2b522345a7a51b8ed89988d4d8fa0d75ea7c2` |

Existing retained module paths and all original media pins are referenced in
the run manifest/proof. They were read in place, not copied. Preflight processes
exited before their small generated inputs/logs were moved under RUN/preflight;
the original direct run path and movement are recorded. No original attempt was
consumed, retried or repaired, and no fresh game image or control exists.

Cleanup verification records owned preflight Node PID1431325 and external
flock PID1431324 with startTicks188309423; both were absent. Ports40203/44279
refused connections, the profile was absent, lifecycle contained no Chrome
spawn, and an independent nonblocking flock succeeded. This was mock cleanup,
not a claim of an actual Chrome normal-close witness. Box ID/state/expiry: NA;
coordinator retains shutdown ownership.

Validation passed all 42 focused local tests and
`flock /tmp/wine-build.lock bash tools/build.sh`. The build reproduced both
required live module hashes. All existing 50M/360s continuous history,
owner/record/byte/input/ACK, active0 full-rest, frozen review, 16ms pacing and
512/544 selector limits remain. No timer was driven by an observer. Countdown
remains distinct from an absolute deadline; gob pointer remains distinct from
Lua startscreen object identity; ACK and active1 grant no readiness.

There is no new Medium release, mainGC exit, timer handler, deferred consumption,
type10/script/newLevel or gameplay witness. Next dependency is an explicitly
reviewable exact runtime closure that binds the actual MDK2 entry to the
required accepted source/module pair, with its changed runtime dependencies
named and justified. Merely finding matching live modules does not change what
this resolver serves. This single assignment stops offline at that blocker.
