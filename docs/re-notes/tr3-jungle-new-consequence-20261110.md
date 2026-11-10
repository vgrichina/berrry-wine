# TR3 Jungle consequence attempt — 2026-11-10

**The first live failure was browser startup, before the original game launched.**
No new pickup, jump/landing or encounter consequence is established. The existing
[WebGL translation](tr3-webgl-terrain-translation-20261108.md) and
[movement findings](tr3-current-movement-after-headroom-20261108.md) remain the
prior evidence, not results of this attempt.

Evidence: ignored `scratch/runs/20261110-tr3-jungle-new-consequence-0615/`.

## Tested title helper repair

The retained TR3 request validator accepted Alt, but its separate hold executor
omitted Alt. Its terminal exception path also attempted `Browser.close` after
failure. These are caller defects, not demonstrated emulator defects.

`tools/tr3-current-driver.cjs` composes the retained ordinary TR3 caller. Its
run-specific hold executor now uses the released `native-key-controls.cjs`
validator and event mapping for both admission and execution. The independent
release timer, 50–2000 ms bounds, supported combinations, owner/module guards,
12-second freshness limit and existing startup wait remain unchanged.

The composed caller latches its first terminal error, rejects later CDP sends,
and signals its owning custodian once. Observer/protocol errors use that path;
a stale refusal terminates this task instead of permitting another capture.
The original blank-page trusted-key preflight additionally includes Alt.
No guest patch, private game handler or runtime/provider change was made.

Tests execute the exact emitted action and failure/send functions. They cover
Alt admission/execution, independent release despite a slower sampler, invalid
duration and stale zero-effect rejection, one owning cancellation and zero later
evaluate/input/capture/close requests. The test also executes the current
production Worker's actual instance-assignment statements, loads the original
TR3 PE, and tests the caller's unchanged Worker identity sampler against real
instance replacement. This offline installation does not establish a live
browser owner or gameplay outcome. Released key controls, retained chain and
transport controls, and `flock /tmp/wine-build.lock bash tools/build.sh` passed.

The original historical Controls overlay was personally opened: Up Run, Alt
Jump, Ctrl Action, Space Arm, Shift Walk and Esc Inventory. Its path/hash is
recorded without copying the image. There was no current gameplay image to review
and no dependent gameplay input.

## Exact first failure and cleanup

One newly leased box attempted one Chrome launch under the existing kernel
custodian. At **06:16:18.858 UTC**, the composed caller failed reading
`chrome-profile/DevToolsActivePort` after its existing 100 × 100 ms wait.
Chrome stderr was empty. This proves the missing readiness file at that bound;
it does not identify why Chrome had not published it. No longer wait, extension,
second Chrome/original launch or retry was used.

The driver's first-failure path immediately signalled its custodian. Kernel
evidence records **28 owned / 28 reaped**, no remaining processes or unresolved
lineage, and completed drain at **06:16:19.765 UTC**. Its real parent consumed
exit status 1 and recorded separate stdout/stderr EOF at **06:16:19.823 UTC**.
The startup-file waiter detected the existing terminal error, rather than
expiring its own readiness deadline. A later explicit owning-cancel attempt
found the already-reaped custodian (`ProcessLookupError`); it was not retried.

There were **zero numbered commands, zero gameplay inputs, zero captures and
zero CDP requests**: the websocket endpoint was never obtained. The ordinary
welcome/setup/New Game route was therefore never reached. WebGL was selected
for the attempted run, but no actual owning graphics context or live Worker
module was observed. No life/restart boundary or combat claim exists.

All 617 staged pins matched again after drain. Source staging used published
Git commit `c8fb481b5983df88ef3c56d7e2beec2ed3ce2f4f`, with relevant runtime diff
and owned new helper patches retained. The current production module tested
offline and recovered from staging is 2,186,163 bytes, SHA-256
`79f0842ea1ab5fce5b5651540e726396f4ccbfa6e3cf046e9bc42ad7c4fa650f`.
The original executable is 920,064 bytes, SHA-256
`8c7b25460f62c180ae675c2696ac66c8f97948a16458d0598ba72794ddcc7814`.
Media stayed at existing referenced paths; no source/media archive was made.

All **22 artifact references / 20 unique contents** were retrieved and
independently size/SHA-256 verified at **06:17:36.950 UTC**. Four gzip files
fully decompress; custody journal and command-log raw hashes/sizes match their
drain metadata. There are no PNGs to validate or model-review. Process, profile,
writer lock and HTTP listener absence were verified before stop.

The observable independent watchdog was armed before allocation at
**06:15:21.976 UTC**, with immutable deadline **06:40:21.976 UTC**. The box's
initial expiry was **06:40:22.303 UTC**. After verified recovery, exactly one
delegated unforced stop was requested. Box **bx_zuuswxbj** is **archived**, final
expiry null; receipt **stop_408b052dcba09645** completed at
**06:17:39.336 UTC**, forced=false, error=null. The watchdog's actual parent
wait subsequently records exit 0 and separate stdout/stderr EOF; its supervisor
records the child reaped. A separate read-only API check confirms final state.
Local disk samples remained above 3 GB. Other boxes were untouched.

Next: diagnose the bounded Chrome endpoint-publication failure before another
separately authorized gameplay attempt. The helper repair enables ordinary Alt
delivery but has no native jump-success claim.
