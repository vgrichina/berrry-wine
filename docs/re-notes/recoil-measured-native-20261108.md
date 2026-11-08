# Recoil measured native startup repair, 2026-11-08

Run: `scratch/runs/20261108-recoil-measured-native/`.

**Tested substantive generic startup integration repair; native gameplay remains
incomplete.** The sole fresh allocation failed before Chrome: the parent-owned
queue consumed its launch request, then its wrapper could not find
`launch-position.py`. This executable dependency was absent from the uploaded
pin closure. No native Software selection, menu, active span, phase measurement,
M, movement or attack occurred. The consumed request was not replayed; no second
original or allocation was attempted. The earlier native 301/318 ms responses
remain unclassified. There are no new entry/owner/PNG/return durations to report.

The repaired `startup-admission.py` checks required executable dependencies for
membership in the manifest and verifies the entire physical upload closure
before queue consumption. Missing, changed, duplicate and escaping paths fail
closed. `startup-contract.json` explicitly includes the custodian, adoption and
reaper helpers, launcher chain and measured browser helpers. The missing
`launch-position.py` is now included. A rejected transaction becomes sticky
UNKNOWN; restoring bytes and writing another request cannot replay it. A
post-consumption launcher exception also produces a durable UNKNOWN record.

The actual parent queue now continues its census/reaper loop after either
failure. An early stop request waits for live descendants instead of asserting
and exiting; the lock remains held until drain. Five actual Python custodian
integration cases pass: missing pin, missing file, changed file, valid one-shot
launch, and launcher exception with a detached child. The last case requests
stop while the child lives, proves the lock stays held, records identities
before reaping, and verifies all owned processes absent and lock free afterward.
`startup-integration-focused.json` retains these results. Earlier generated
stop/census failures and all fixture directories remain available; final
independent process rechecks find every recorded identity absent. These tests
run no browser or guest and acquire no local runtime lock.

The final source/provider and hermetic preflight verifies **849 pins**, including
27 owned runtime dependencies. Shared checkout peer WIP is excluded using the
selected exact Git/artifact providers. A filesystem-only preflight correctly
refused a changed shared file; that failure is retained. The repaired default
manifest is distinct from `attempted-position-runtime-pins.json` and the exact
remote copy under `recovered/`. Repaired startup bytes were **not uploaded or
native-tested** after the failure.

`diagnostic-chain.cjs`, `phase-evaluate.cjs` and `bound-input.cjs` are byte-identical
to the accepted pixel-latency repair. The attempted driver wires a persistent,
fsynced phase sink and a same-host clock proof based on the owned Node/Chrome
processes, shared network namespace, boot identity, loopback endpoint and owned
profile. Chrome never launched, so this proof path was not exercised or claimed
verified on this box. Clock/boundary failures remain UNKNOWN with no replay.
Four uncached complete guest/render module responses, exact epochs,
`Promise.allSettled`, final co-located owner/pixels, 250 ms freshness, changed
timer pair, gate4500/M500 and independent UP remain unchanged. The prior 36
probes/144 responses and accepted controls were hash-verified and reused without
rerunning them. No observer was disabled.

Independent normal/watchdog processes were observable before the UUID-idempotent
allocation at 12:23:33Z. The remote custodian held its own lock before provisioning
and startup. Free local disk exceeded 5 GB; no local heavy runtime lock was held.
Before delegated normal shutdown, **36 unique remote artifact references /
493,901 bytes** were retrieved and independently reread by SHA-256. The exact
custodian PID/start identity was independently absent and its lock acquirable.
There was no browser, server, endpoint, profile, writer or held input to drain;
the queue's exited parent and empty descendant census are retained. There is
no undocumented descendant exception. Startup failure evidence is preserved.

Final box **`bx_e9v5njhv`: archived, expiry null**. Normal stop
**`stop_006ae96d9934a7b5`** completed **12:25:06.775Z**, forced=false/error=null.
The independent watchdog and normal lifecycle exited 0; supervisor children are
empty. The immutable watchdog deadline was 12:48:33.181Z and overall expiry
12:49:33.364Z. No old box was resumed/deleted, no deployment or subworker occurred.

Recovery uses exact checkout SHA in `source-head.txt`, selected source Git
`49874a81c5ae180c20a15c6bb169d9041f028cae`, inherited relevant binary diffs and
existing media paths/hashes. `owned-inputs.patch` records the small changed/new
helpers; `relevant-git-diff.patch` records this note's added-file patch. Evidence remains in
the ignored run directory, with independently verified manifests. No source or
media archive or peer WIP was included. Only this note is committed; production
code and build were not changed.

Next: use the repaired declared startup closure in a separately authorized fresh
run, verify actual remote clock ownership, personally review current Resume,
measure entry/owner/PNG/return phases, and qualify ordinary M with a visible
consequence before reviewed movement toward power control. Full27, parity,
audio and FPS remain open.


