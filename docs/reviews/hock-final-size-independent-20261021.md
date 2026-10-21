# Independent final startup SIZE review: ACCEPT SOURCE DELTA

Candidate `776d37d55d2f749dcb29203e3bd26b8a5e9c05bd`, production base
`dd6c585bba95422da631fb59a24245f6566135c8`, prior independent rejection
`c5e09ae0e3efda232f3bbf4a7eede14fff3b2816`. No blocking defect found in the
new correction. This accepts the source delta only. Actual guest execution,
fresh canonical build, runtime qualification, game qualification and Windows
parity are **not accepted**. No production edits or main merge were performed.

## Source review

The previous failure released the target/destruction-result cells before the
last callback. CACA0031 now keeps `[target, destruction-result, return, result]`
below WM_SIZE's stdcall frame and returns through CACA003D. On callback return,
the shared guard reads the retained target. If dead, it reads the saved
destruction result, advances ESP by eight, replaces the saved normal result,
and immediately returns to CACA0001. If live, CACA003D advances ESP by eight
and goes to CACA0001. Neither path can fall into the other cleanup. CACA0001
then restores return/result and advances by eight. Callback EAX is discarded.
Earlier ACTIVATEAPP/ACTIVATE/SETFOCUS/MOVE destruction keeps the same cleanup.

Relevant inherited entry flow was read: ShowWindow captures prior visibility
in both result cells; placement's same-arity show-core call selects normal 1,
destruction 0; ordinary implicit creation starts with return/HWND, clears its
implicit-show flag before guest callbacks, and adds target/zero. Thus creation
success preserves HWND and destruction returns zero. Nested chains retain
separate guest stack storage. Changing main_hwnd does not change the target
or result selected by this chain. This is HWND liveness, not a new generation
token guarantee; unrelated callback-ownership work remains pending.

SIZE still calculates current client geometry after earlier callbacks, retains
minimized/maximized wParam semantics and consumes pending size only for its
own current main target. No new placement, geometry, dialog or host behavior
is introduced. Native dialog synchronous activation bypasses this chain and
is not exercised by the slice. Existing global implicit-show and dialog paths
are not newly certified by this scoped review.

CACA003D has one eight-byte loader allocation, incrementing num_thunks before
subsequent allocations; the existing end-of-loader update publishes the range.
The new mutable global has one corresponding marker adoption arm in the
existing shared-table thread scan. Source search found no competing CACA003D
marker in candidate src. Subsequent thunk addresses are allocated dynamically;
no existing marker ID is renumbered. Full loader/scan execution remains pending.

The census change is narrow: all 401 entries retain pending ownership. Only
show_window_core's explanation and win32_dispatch_inner's explanation, hash,
EIP-write count (62 to 63) and added return target change. The exact scanner
checked 267 source files in memory and reported zero errors, without correction.

## Independent replay and provenance

Candidate object, publication, exact source/test/census diff, RECOVERY and
the prior original failure report were inspected. HTTPS ls-remote confirmed
candidate branch at the exact candidate and main at
`1d8dbd7a44656178d01869f28869be624a59fa39`. All 19 new archive seals match
both archive entries and preserved implementer evidence; nine source seals
match candidate Git objects. All 21 materialized candidate files match Git,
including the compiler loader and four vendored compiler stages. Historical
accepted archive receipts were not rerun.

Commands ran from the isolated sparse candidate checkout:

```sh
node docs/reviews/hock-final-size-lifetime-slice-20261021.js
SLICE_REV=dd6c585bba95422da631fb59a24245f6566135c8 node docs/reviews/hock-final-size-lifetime-slice-20261021.js
SLICE_MUTANT=wrong-target node docs/reviews/hock-final-size-lifetime-slice-20261021.js
SLICE_MUTANT=zero-result node docs/reviews/hock-final-size-lifetime-slice-20261021.js
SLICE_MUTANT=keep-success node docs/reviews/hock-final-size-lifetime-slice-20261021.js
SLICE_MUTANT=stale-client node docs/reviews/hock-final-size-lifetime-slice-20261021.js
node ../census-check.js
node --check test/test-window-placement-notify.js
node --check test/test-thread-thunk-sync.js
git diff --check dd6c585bba95422da631fb59a24245f6566135c8 HEAD
```

Candidate exits 0: 156 cases and exact loader/adoption slices pass. Baseline
exits 1 on placement/destroy/5 (1 instead of 0). Four mutants exit 1 on,
respectively, placement/live/5 (0 instead of 1), visible-show/destroy/5
(0 instead of 1), placement/destroy/5 (1 instead of 0), current-client SIZE
(17891720 instead of 28443180). These are assertion failures, not setup failures.
Other commands exit 0. Node is v24.18.1. The 2,489-byte fixture module SHA256 is
`8f62f78928766aa08fb5484ac4912d2b2dc24e964dca86bc708a249762727601`;
dispatcher source SHA256 is
`ab690739bd6fa0b1d74ec642fae1a81d40b5240e58a8bde79c8480a87476c058`.

The fixture runs exact dispatcher slices, but models USER lookup, geometry,
stdcall CALL/RET and the ShowWindow/placement entry frame. Its creation entry
runs CACA0001 with an injected implicit flag, not RegisterClass/CreateWindowEx.
Nested execution manually restores the outer ESP and uses identical register
sentinels; it demonstrates frame-cell isolation, not an independent x86 ABI
or scheduler proof. Thunk addresses are marker-valued in the dispatcher model;
the separate tiny allocation/adoption test does not execute the full scanner.
These assumptions did not conceal the original lifetime defect: exact baseline
replay rejects, and the maintained guest test consumes WINDOWPOSCHANGED.

The new actual-guest tests were inspected and syntax-checked only. They invoke
ShowWindow/placement through guest CALLs, make visibility naturally via
SW_SHOWNOACTIVATE then SW_SHOWNORMAL, and consume CHANGED so derived early SIZE
cannot satisfy the final-SIZE oracle. The creation case registers a class,
accepts NCCREATE, calls CreateWindowExA with WS_VISIBLE, and records receiving
HWND. The final-size group requires exactly one SIZE, target liveness, correct
API result, restored ESP/EBX/ESI/EDI and zero WINDOWPOS depth. Nested placement
is protected against recursive trigger by setting the observation flag first.
It exercises a nested positioning call, not every possible nested activation.
The thread test clears and restores the new global with distinct SIZE and
SIZE-return addresses. Neither guest test has been executed on these bytes.

## Minimal future runtime replay

Only on a fresh coordinator-assigned runtime, restore exact candidate source,
normal dependencies, and the unchanged sealed original 39-file Hock intake
(44-entry package manifest). Verify source and intake hashes first. Rebuild
the candidate; old canonical/compat hashes do not qualify this commit. Preserve
new build logs, source manifest and canonical/compat hashes. Run these gates
and tests with no skips, in order, from the candidate checkout:

```sh
bash tools/build.sh
node tools/callback-ownership-census.js
node test/test-callback-ownership-census.js
export PLACEMENT_FIXTURE="$HOCK_INTAKE/BBLOOGIE.EXE"
node "$REPLAY_OUT/independent-final-size.js"
PLACEMENT_GROUP=final-size node test/test-window-placement-notify.js
PLACEMENT_GROUP=show-return node test/test-window-placement-notify.js
node test/test-window-placement-notify.js
node test/test-thread-thunk-sync.js
node test/test-window-placement-client.js
node test/test-showwindow-child-size.js
node test/test-showwindow-secondary-top-size.js
node test/test-show-window-async.js
node test/test-startup-info-boundaries.js
PLACEMENT_GROUP=show-return PLACEMENT_CONTROL=zero-destruction node test/test-window-placement-notify.js
PLACEMENT_GROUP=final-size PLACEMENT_CONTROL=keep-success node test/test-window-placement-notify.js
```

The last two commands must exit 1 at the intended result assertions; the rest
must exit 0. Build.sh must pass all its required gates; do not substitute the
slice compile. The archived independent-final-size-original.js is byte-identical
to the preceding review's committed five-stage repro (SHA256
`4a82983abc0e1316f4580308528d07cf946b0eefaf07382c1638a15acc37eae1`).
Copy it to REPLAY_OUT/independent-final-size.js, replacing only its three
absolute require prefixes `/home/user/hock-show-return-repair/repo/` with the
absolute candidate checkout prefix. Its hidden ordinary window consumes CHANGED,
then SetWindowPlacement(SW_SHOWNORMAL, (31,47)-(331,267)) destroys at each of
ACTIVATEAPP, ACTIVATE, SETFOCUS, MOVE and SIZE. Require all five returns zero,
dead target and intact stack/register/depth checks. Do not replace this original
repro with only the maintained tests.

Then replay the archived drive-original.py, changing only candidate checkout,
canonical-module path, original intake location and a NEW output directory.
Its unchanged route is BBLOOGIE.EXE as C:\\BBLOOGIE.EXE, cwd C:\\,
all intake files included, real ticks, 45 seconds, one million max batches,
stdin control, input/dispatch tracing. Preserve the exact event sequence:
2.8s dump windows, 2.9s dump 0x41eca4:8, 3s capture;
4/5/7s move/down/up at (124,386), 6s capture;
9.8s dump windows, 9.9s HWND65537 pixels, 10s capture;
12/13/15s move/down/up at (320,250), 18s capture;
20/21/23s move/down/up at (450,300), 30/40s captures and final capture.
Run `python3 "$REPLAY_OUT/drive-candidate.py"` with that path-only adapted copy.
Inspect full HUD, timer, clipping and input response against the original route;
retain timing records, logs and images. No injected SIZE, patched assets,
alternate game route or old module may substitute. Scoring, completion, audio,
FPS and Windows parity remain separate qualification gaps even if this passes.

## Preservation and stop

Evidence is in the sibling `hock-final-size-independent-20261021-evidence/`
directory. Its manifest seals logs, command statuses, provenance, census,
original repro and original route driver. Recovery/publication records are in
`scratch/runs/20261021-hock-final-size-independent`. Sparse scope was set before
checkout with the parent object store; prewrite checks enforce 64MiB cap and
2,285,895,680-byte free floor. No canonical/fullVM/full-source build, runtime
access, provisioning, workers, shared config changes, deployment or unrelated
WIP edits occurred. Main remains unchanged. Commit/push details are recorded
in publication.json and the append-only messageboard.

No runtime was assigned. Coordinator reports bx_3f3x23m3 snapshot-stopped at
05:51:42Z, former expiry 05:56:19.894Z; this worker did not query or change it.
Coordinator retains lifecycle ownership. This bounded source review is complete.
