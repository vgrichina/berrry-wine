# MCM foreground after hidden main window

Evidence: `scratch/runs/20261120-mcm-safe-foreground-observer-causal-repair/`.

The earlier accepted-record diagnostic trapped the guest through its own
`JSON.stringify` of a live object containing BigInt. That trap is not product
failure evidence. `tools/mcm-scalar-observer.cjs` contains a bounded observer
which serializes selected scalar fields only. Objects, functions, cycles and
shared buffers receive opaque identity tokens. Projection, getter and sink
exceptions disable diagnostics; API execution is outside that failure path.
It preserves the original receiver, arguments, return and thrown value.

Two fresh diagnostic incarnations used the retained production fab7 module
from 7a7f, authentic 311-file media and registered working directory. The first
closed on a driver key-shape assertion before input. The second installed an
additional observer after the browser's final host callback assignments and
reproduced the real Acquire failure through ordinary video-memory confirmation.
Both incarnations are permanently closed.

The second diagnostic proves this sequence on the same renderer/window record:

1. Main HWND `0x10001` is shown and accepted by `activate_window`.
2. MCM hides it with `ShowWindow(0)`, clearing accepted foreground.
3. The real video-memory dialog is dismissed by Enter and destroyed.
4. MCM calls `ShowWindow(5)` repeatedly on the same live main-window record.
   The record becomes visible and remains a top-level window, but accepted
   foreground stays null. There is no intervening host activation publication.
5. Actual `foreground_window` returns zero. The Worker Acquire of keyboard
   slot 43, cooperative HWND `0x10001`, returns `0x80070005` before op 10.

This is the `lib/host-window.js` absent-accepted-record predicate, rather than
record replacement, hidden-at-Acquire or child-at-Acquire. Final browser callback
and underlying host-window observations agree. The Node-only ProcessDesktop
snapshot wrapper is not executing on this browser path; its separate authority
must not be used to explain this observed return. Numeric focus was not used
to infer foreground.

The WAT `show_window_activate_top_level` helper skips activation when guest
`active_hwnd` already equals the shown HWND, although hiding revoked the host
record. The proposed source repair republishes real host activation for an
activating top-level show in that case, preserving the existing guest callback
path when the active HWND changes. It leaves Acquire's checks intact and does
not synthesize a successful HRESULT or an accepted renderer record.

Validation and affected gameplay remain pending until the required actual
`/home` free-space floor permits normal execution. No production success,
quarry controls or ordinary Quit is established by the diagnostic evidence.

## Finish attempt, 2026-11-20

`scratch/runs/20261120-mcm-finished-show-foreground-quarry/` retains the next
attempt. Scalar containment passed on Node 24.18.1 after replacing a
browser-specific shared-buffer TextDecoder expectation with a poisoned
serialization hook: the observer must preserve the opaque buffer identity and
never invoke the hook. The foreground regression initially failed before
compilation because its reused VM fixture lacked the current host.js native
input dependency's root-relative `require`. Its local fixture projection now
supplies `Module.createRequire(require.resolve('../host.js'))`; the subsequent
hashbang placement error was also corrected. Neither failure exercised USER
or DirectInput. The corrected full-module old/new regression remains unrun.

Actual `/home` free bytes declined from 1,506,799,616 at initial inspection to
below 1,500,000,000 before the corrected regression could launch. The guard
refused that launch, and later samples remained below the floor. No build or
fresh affected-original incarnation was started. All 311 existing media
references were hash/size verified without copying media. The WAT repair and
tests remain uncommitted WIP; build, publication, quarry throttle/turn and
ordinary Quit remain pending. No new compiled-module identity or gameplay
success can be claimed from this attempt. Prior diagnostic scopes stayed
closed, and held region files and foreign WIP were left untouched.

## Corrected fixture validation, 2026-11-20

`scratch/runs/20261120-mcm-corrected-fixture-build-quarry/` advances the
previously unrun corrected fixture. The full-module OS Worker regression
passes with the exact old activation guard returning Acquire `0x80070005`
and the repaired guard returning zero after same-HWND hide/SW_SHOW. Hidden
and nonactivating SW_SHOWNOACTIVATE/SW_SHOWNA windows still fail Acquire.
Scalar containment, existing owned-form activation, secondary-top-level sizing
and ShowWindowAsync completion regressions all pass.

The locked build was launched above the actual disk floor. Its guard detected
1,499,402,240 free bytes and sent SIGTERM to the `flock` launcher. The descendant
shell continued to finish all printed build gates and compilation before
exiting; the guarded invocation nevertheless failed. This is **not** a valid
passing floor-compliant build. The retained new module has SHA-256
`f5ae1ac84e3d5e13bb093aca53b8aa2fe18c000cc891587a5d75b46eb559b2ba`
(2,420,767 bytes), preserved compressed with a recovery recipe. No original
was launched with it. Future execution must use a guard which stops the
supervised process group at a floor breach, rather than only its launcher.

All 311 existing media references match size/hash without copies. Held region
files remain byte-identical. The repair remains uncommitted because the
required guarded build did not pass; pull/push were not attempted. Affected
quarry throttle/turn and ordinary Quit remain unproved. No prior diagnostic
scope was resumed, and all owned test/build processes exited without leaks.

## Process-group guard and valid build, 2026-11-20

`scratch/runs/20261120-mcm-process-group-guard-build-quarry/` repairs the
run-local guard by signalling the native supervisor rather than the flock
launcher. The supervisor terminates its owned detached command group and
tracked descendants, escalating to KILL. An independent finite watchdog
checks actual free disk, process start identity and the runtime deadline.
Any floor closure forces a failed verdict even if the command returns zero.

A forced-floor test spawned a real shell and child which ignored TERM.
Escalation killed both, neither success marker was written, and an unrelated
control process remained alive until its own explicit cleanup. The guarded
`flock /tmp/wine-build.lock bash tools/build.sh` then passed with no floor
closure, termination or leaks. Its compiled module is exactly
`f5ae1ac84e3d5e13bb093aca53b8aa2fe18c000cc891587a5d75b46eb559b2ba`
(2,420,767 bytes). The previous causal and scalar/regression checks were
reused only after verifying the repaired source diff and all three new
observer/test files byte-for-byte against their passing revision.

The one fresh ordinary browser incarnation loaded that exact module, with
all 311 existing media references freshly hash/size verified. Fullframe review
showed the real video-memory confirmation. Two proposed Enter inputs were
refused before dispatch because their reviewed captures were stale. Before
any input was admitted, actual free disk fell to 1,498,734,592 bytes. The new
guard stopped the whole runtime tree, with the native receipt reporting no
leaks. This scope is permanently closed. Quarry throttle/turn and ordinary
Quit remain unproved; the runtime result is bounded by the disk-floor breach.
No old runtime was replayed, and no helper result is gameplay evidence.
