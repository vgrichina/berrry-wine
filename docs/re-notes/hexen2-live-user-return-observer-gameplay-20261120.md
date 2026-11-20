# Hexen II final USER callback observer, 2026-11-20

The diagnostic installation defect is repaired in
`tools/hexen2-startup-trace.cjs`: `userReturnOverlay` installs at the final host
factory return, after native guard registration and host callback wrappers.
The previous run-local observer was installed before `h.input_consumed` was
assigned; its consumption array was not a runtime witness.

The new observer calls each original callback once with its original receiver,
arguments, return value and exception. Nested actor scopes unwind through the
original guard's `withActor`. Diagnostic failures disable observation without
changing guest behavior; the run-local driver closes the scope upon the stop
record. Names are copied into a bounded ordinary buffer before TextDecoder,
including when WASM memory uses SharedArrayBuffer. The observer retains 32
USER entries and 32 confirmations, emits at most 128 records, and reads 64
guest stack DWORDs before forwarding ExitProcess's log callback or retirement.
It records actual confirmation apiKind/remove/token/result and actor metadata.

The separate run-local Worker overlay observes the existing `log_api_exit`
callback on the executing CPU actor. It reads that actor's EAX/EIP/ESP, retains
32 USER returns including idle returns, and emits a bounded pre-exit caller and
stack snapshot. It adds no guest input, native dequeue, RPC, clock change,
breakpoint or module modification. Reading EAX from the page's idle instance
would be invalid. Host confirmation results alone are not guest API returns.

Thirteen focused tests pass, including actual final-source installation,
old-overwritten/new-surviving callbacks, SharedArrayBuffer, nested actor scope,
original exceptions, diagnostic error-stop, finite bounds, pre-retirement
stack reads and executing-Worker USER return registers. Tests do not read
scratch evidence. `git diff --check` passes.

Evidence: `scratch/runs/20261120-hexen2-live-user-return-observer-gameplay/`.
The prepared run pins committed guard `65a75893c`, the retained exact module
`10bdae2c56c79eeb5d0b4ebbc602c8a233e36351380da274a70f7f5e25363564`,
guest graph `34c794d549c4ad71dfe40c1647e4ffd0c7a4f8af` and the established
`72dc77da0` capture dependency. The guard author's focused native USER control
establishes the cached Peek-to-removal repair, independently of an original
game run. Its test result is not an actual Hexen caller witness.

Hexen's actual browser manifest has **14** entries. The complete verified
run dependency list has **18** pins: manifest, those 14 files, root glh2.exe
and the two controls files. Quake II's 67-file count does not apply. Media and
the existing module are referenced by in-place SHA256, without copies. The
foreign-owned display helper is loaded from the committed pin in memory;
foreign live WIP is not served.

The one fresh original admission was refused before launcher creation at
actual /home free **1499381760 B**, below the strict 1500000000 B floor. The
second monitor sample was 1499373568 B. No browser, native supervisor, guest,
gesture or runtime endpoint was created. The monitor and its direct parent
were joined with both output EOFs. This scope is closed forever, with no retry.
Build admission separately refused at **1499308032 B**. The required flock
build therefore did not run; this repair and its test/note remain uncommitted
shared WIP. No commit, pull or push was attempted.

No new actual Get/Peek/removal/dispatch/exit witness exists. The old original
established Enter consumption plus independent UP then ExitProcess(0), return
44efcf; higher caller remains UNKNOWN. GetMessage-zero branch 439a9d remains a
static candidate. Living-enemy consequence and ordinary Quit remain UNPROVED.
No speculative guest repair, target/capture campaign, Wine, workers, deployment
or old endpoint replay occurred. Local box ID=null, state=NOT_CREATED,
expiry=null, stopReceipt=null; coordinator retains shutdown ownership.

## Released observer adopted and built, 2026-11-20

Run `scratch/runs/20261120-hexen2-final-observer-build-fixed-guard-gameplay/`
adopted the released patch byte-for-byte unchanged. All 13 focused tests and
`flock /tmp/wine-build.lock bash tools/build.sh` passed. Build temporaries
used owned tmpfs; the independent floor monitor recorded minimum
1502265344 B with no low sample. Observer commit `eb47ad602` contains the
helper, test and this note. Immediate strict pull refused to overwrite
foreign-held `src/00-regions.wat` and `lib/region-map.generated.js`; push
did not run and neither held file was resolved.

Exactly one fresh original started with the same 34c/72dc graph, tested
committed 65a guard, existing trusted DOM target helper and verified 18
Hexen media pins. One actual CPU Worker bytecode fetch matched 10bdae;
page/process/CPU/GL endpoint and generation identities were recorded.
The final host observer installation and executing-Worker startup USER
returns are now actual witnesses: PeekMessageA, GetMessageA returning 1
(caller 439a99), and DispatchMessageA (caller 439ab0). These startup
messages establish observer operation, not removal of a manual input token
or the earlier ExitProcess(0) cause. No new guest exit was observed.

The independent runtime monitor closed the scope at /home 1499918336 B,
before frame review or any gesture. A capture command file written after
closure was never dispatched (no receipt, screenshot or corresponding CDP
request). No later runtime request or retry occurred. Build floor PASS
does not imply runtime floor PASS. Enemy consequence, ordinary Quit and
the earlier higher exit caller remain UNPROVED/UNKNOWN. Browser, release
helper, display, monitor and launcher were directly joined with both EOFs;
native supervisors reported no leaks. Local box null/NOT_CREATED,
expiry null, stop receipt null; coordinator retains shutdown ownership.
