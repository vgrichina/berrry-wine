# Forsaken capture ACK and bounded diagnostic admission, 2026-11-12

The run-local capture/ACK orchestration is repaired and passes combined controls.
The original-game attempt stopped before provisioning: a local helper changed
between pinning and allocation, so whole-input validation rejected its hash.
No original was launched. The combat-white cause remains unproved; there is no
production rendering change or changed-original before/after claim.

Evidence is `scratch/runs/20261112-forsaken-nonblocking-diagnostic-white-1550/`.
The [first-white handoff](forsaken-first-white-20261112.md) and
[owner/enemy evidence](forsaken-owner-enemy-20261112.md) remain the source of the
original observations. Menu execute-buffer opaque-state restoration does not
establish the combat transition. Postwhite additive submissions do not establish
the upstream writer.

## Repaired path and controls

`browser.cjs` completes and publishes the full PNG, binding and capture metadata
without awaiting diagnostic telemetry. Its shared `cycle.cjs` command path lets
the existing transport publish ACK, then drains diagnostics serially. A separate
admission gate stays busy until that drain has a known outcome. The requester
waits before publishing the next command or calculating its command budget.
Periodic drains hold the same writer lock used by request publication. Thus a
periodic drain cannot consume an already-published command's work budget.

Diagnostics have a separate 60-second total lifetime; each existing CDP request
retains its 20-second response bound. An unknown response is terminal, including
after a successful capture ACK. No later input, capture, quit or retry is allowed.
A settled diagnostic exception records an explicit drop and disables subsequent
diagnostics. Request-admission failure records sticky closure before publication.
There is one CDP owner, no diagnostic request queue and no abandoned request used
as permission for the next physical command. Native balanced release, complete
capture, identity, hash, freshness and accepted command deadlines are unchanged.

CPU retention is 32,768 rows per drain, with explicit overflow counts. Each drain
is compressed immediately, with a 24 MiB raw payload check and a 32 MiB total
compressed retention cap. Reaching the total cap produces an explicit drop and
disables telemetry. These bounds do not certify uninterrupted original evidence.

`combined-cycle-test.log` exercises the exact emitted browser execute/capture/
drain functions and the same command-cycle module called by the browser, using
an offline CDP/identity peer and a complete 1024 × 712 PNG. The trace payload is
produced by the real built module's x86 Device2/3 public-COM pixel fixture:
1,701 entry/return/changed-state rows, zero drops. A deliberate 21-second drain
outlives command 0's unchanged 20-second work deadline **after** successful
capture ACK. Command 1 remains unpublished until the drain completes, then gets
its own full budget. Exactly one Enter down/up pair is observed. Known diagnostic
drop, unknown response and terminal no-replay controls pass. This is combined
orchestration validation with an offline peer, not real-browser original proof.

`periodic-test.log` separately proves predrain serialization and budget timing.
`retention-final-test.log` proves the total cap emits a known drop without more
CDP, and preserves an already-terminal owner. The initial retention control
caught a disabled-observer early return bypassing the terminal check; the check
now precedes that return. CPU overflow controls, inline owner/rejection controls,
three native-release tests, thirteen API custody tests and locked `tools/build.sh`
passed. The immutable module remains SHA-256
`04c534192ee3fe39e388536c2ce710c12c47a5cd2ca4d95c19f9d00b1e8f0a17`.

## First blocker and lifecycle

I added lifecycle assertions after pinning `lifecycle.py`. Provisioning correctly
rejected that stale pin before its first upload or remote command. The terminal
record is preserved; there was no replay or second allocation. The controller
now reruns the actual byte/hash/import preflight immediately before allocation,
rather than trusting an earlier pass log. The stale-input check fails and the
repinned final preflight passes. This preparation fix has no original retest.

Source is recorded by Git SHA plus relevant tracked/untracked patches. Final
helpers are preserved in `owned-inputs.patch` and individually pinned in
`runtime-pins.json`; no source tree or media archive was made. Existing original
media paths/hashes were verified. Local `/home` remained above the 1.5 GB floor.

Private box `bx_bzn68cwr` had an independently observed two-hour watchdog armed
before allocation, initial expiry `2026-11-12T17:55:44.945Z`. There were zero
remote outputs or original commands to recover. Delegated normal stop completed
at `2026-11-12T15:56:48.649Z`, receipt `stop_c4d630ac6c630370`, forced=false,
error=null. Final state is archived, expiry null. Lifecycle client, adopted owner
and independent watchdog have actual successful waits and EOF evidence. No
Chrome/runtime parent existed. Do not resume or delete this box.

Next: use the finally pinned, tested combined path for one fresh original current
module/owning-WebGL run, retaining the CPU public-RS/changed-state and natural GPU
pixel transition before first white. Compare damage, respawn and opaque/additive
transitions, preserving every overflow/drop. Patch the emulator only if that
trace proves an upstream cause. No guest writes, forced calls, FPS/parity,
full-27 or broad crash-freedom claim was made.
