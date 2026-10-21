# Final startup WM_SIZE lifetime repair — WIP pending runtime qualification

Base production `dd6c585bba95422da631fb59a24245f6566135c8`, inherited evidence
`04d3f577b8e954a190f6b67ff7d4fa109a2d4651`; this branch starts at that evidence
commit. Independent rejection `c5e09ae0e3efda232f3bbf4a7eede14fff3b2816`
identified the final callback lifetime defect. Main
`1d8dbd7a44656178d01869f28869be624a59fa39` is not merged or changed.

## Correction

CACA0031 now retains `[target, destruction-result, saved-return, normal-result]`
while delivering WM_SIZE. New CACA003D joins the existing original-target
liveness check after that callback returns. Destruction selects the saved
destruction result; success preserves the normal result. Each route releases
the two owned cells exactly once and then uses the existing CACA0001 saved-pair
cleanup. Callback EAX and callback replacement of main_hwnd cannot select the
outer result. ShowWindow returns prior visibility; placement and implicit
creation fail with zero on destruction. Nested calls keep separate stack frames.

The new thunk has one loader allocation and a matching guest-thread sync arm;
there is no per-call thunk allocation. The current-client WM_SIZE calculation,
placement transaction and HUD correction are unchanged. Source changes are
limited to `01-header.wat`, `08-pe-loader.wat`, `09b-dispatch.wat`, and
`13-exports.wat`. No ownership gate is relaxed: all 401 census entries remain
pending. Only the dispatch entry's hash, 62→63 EIP-write count and additional
return target change; its explanation and the unchanged ShowWindow frame
explanation explicitly distinguish source-slice evidence from pending runtime.

## Executed locally

`hock-final-size-lifetime-slice-20261021.js` compiles the exact CACA0001 and
activation-chain source slices with the candidate's exact vendored compiler.
The 2,489-byte Wasm executes 156 cases: hidden/visible ShowWindow conventions,
placement and implicit-creation entry, live/destroyed/replaced main targets,
nested final callbacks, normal/minimized/maximized payloads, and earlier
ACTIVATE/SETFOCUS/MOVE destruction. Checks cover frame release, callback HWND,
current-client payload, saved results, and nonvolatile register cells. Nested
callbacks deliberately replace main_hwnd and destroy their own target.
Separate small source slices execute the exact loader allocation and sync arm
in two instances sharing fixture memory. They verify CACA003D and restoration
of the new thunk. Full thread scanning is not executed by this fixture.

The exact base rejects with `placement/destroy/5 return: 1 !== 0`.
Four assertion-rejecting mutants cover wrong-main target selection, forced-zero
ShowWindow result, retained placement success, and stale startup dimensions.
All final runs use compiler files verified byte-for-byte against candidate Git
objects; preliminary runs using the shared workspace compiler were superseded
after the identity check found a different parser there. No shared files changed.

The exact census scanner parses 267 Git/current source files in memory and
checks all 401 boundaries plus the nonlocal API lock. It passes with the narrow
reviewed census correction. Both maintained guest test files pass `node --check`;
`git diff --check` passes. The evidence archive contains final logs, checks,
source seals, census before/after details and the exact production/test diff.

## Maintained guest coverage and limits

`test/test-window-placement-notify.js` now includes final SIZE in the natural
hidden/visible ShowWindow and startup-placement destruction loops, consuming
CHANGED so an earlier derived SIZE cannot mask the defect. Its `final-size`
group adds sixteen live/destruction × nested/non-nested cases across hidden
ShowWindow, naturally visible ShowWindow, placement and actual registered-class
CreateWindowExA implicit activation. The existing harness checks actual guest
ESP, EBX/ESI/EDI and WINDOWPOS depth. `test-thread-thunk-sync.js` now checks the
new thunk's allocation, clearing and thread restoration.

These maintained actual-guest extensions are **UNEXECUTED**, beyond syntax
checks. The source-slice harness models callback CALL/RET and USER/host state;
it is not an x86 interpreter, fullVM, Win32 parity or gameplay test. It verifies
implicit creation's actual CACA0001 entry but models ShowWindow/placement
entry frames. The full loader, full thread scanner, dialog-specific synchronous
path, fresh canonical build and original Hock route require runtime review.
No previous module or HUD capture qualifies these new source bytes.

## Exact replay and recovery

Fetch `refs/heads/task/hock-final-size-lifetime-fix-oct21` into a fresh checkout;
use its exact published commit from publication.json/messageboard. Sparse local
checkout uses the parent's Git object store; the pushed branch is the durable
recovery. This report, source fixture and sibling evidence archive are tracked.
No assets, ignored binaries or runtime modules are included.

Local lightweight replay from the restored checkout:

```sh
node docs/reviews/hock-final-size-lifetime-slice-20261021.js
SLICE_REV=dd6c585bba95422da631fb59a24245f6566135c8 node docs/reviews/hock-final-size-lifetime-slice-20261021.js
SLICE_MUTANT=wrong-target node docs/reviews/hock-final-size-lifetime-slice-20261021.js
SLICE_MUTANT=zero-result node docs/reviews/hock-final-size-lifetime-slice-20261021.js
SLICE_MUTANT=keep-success node docs/reviews/hock-final-size-lifetime-slice-20261021.js
SLICE_MUTANT=stale-client node docs/reviews/hock-final-size-lifetime-slice-20261021.js
```

First exits 0; others must exit 1 on their recorded assertions, not a compile or
setup error. On a **future coordinator-assigned runtime only**, restore normal
dependencies and the sealed fixture/package through the inherited recovery:

```sh
bash tools/build.sh
PLACEMENT_FIXTURE=test/binaries/calc.exe PLACEMENT_GROUP=final-size node test/test-window-placement-notify.js
PLACEMENT_FIXTURE=test/binaries/calc.exe node test/test-window-placement-notify.js
node test/test-thread-thunk-sync.js
node tools/callback-ownership-census.js
node test/test-callback-ownership-census.js
PLACEMENT_FIXTURE=test/binaries/calc.exe PLACEMENT_GROUP=show-return PLACEMENT_CONTROL=zero-destruction node test/test-window-placement-notify.js
PLACEMENT_FIXTURE=test/binaries/calc.exe PLACEMENT_GROUP=final-size PLACEMENT_CONTROL=keep-success node test/test-window-placement-notify.js
```

The last two must reject with assertions. Also replay the independent final-size
reproducer from review c5e09ae0 with its three absolute requires redirected to
this checkout and PLACEMENT_FIXTURE pointing to the restored sealed PE; expect
all five destruction stages to return zero. Repeat inherited related regressions
and original held-input route, verify fresh module/source/intake seals, and
visually check full HUD. Independent review and required runtime qualification
must precede any main merge.

No Boat access or lifecycle action occurred. Per coordinator board receipt,
bx_3f3x23m3 was snapshot-stopped at 05:51:42Z, before former expiry
05:56:19.894Z; this worker has no runtime allocation. Lifecycle stays with the
coordinator. No workers, full-source compilation, deployment, assets, shared
Git configuration or unrelated WIP were touched. Owned local run:
`scratch/runs/20261021-hock-final-size-lifetime-fix`. This bounded task ends after
publication; no refill or integration is authorized.
