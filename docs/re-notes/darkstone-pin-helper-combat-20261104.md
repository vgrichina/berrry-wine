# Darkstone pin transport repair: November 4

The run-only transport now uploads `runtime-pins.json` and passes its path to
a bounded Python verifier. All original path/SHA-256 comparisons remain, with
file-size comparisons also enforced. No production files or binaries changed.
The predecessor's E2BIG failure remains untouched in
`scratch/runs/20261104-darkstone-current-manual-combat/preflight-failure.json`
(published note `3c8642dd4`).

Evidence is `scratch/runs/20261104-darkstone-pin-helper-combat/`. Local mocks
validated 8,000 records in an 896,012-byte manifest, larger than the previous
193,629-byte inline program. The bounded mock command was 481 bytes. A wrong
SHA-256 and a wrong file size each produced exit 1 and named the failing file.
These tests passed before remote verification. On the assigned box, all
**1,424 pins** (1,409 prepared files plus 15 original media files) passed.
Postflight independently confirms all 15 original media hashes unchanged;
the files were already staged, so no media upload or evidence copy was needed.

The next preflight command stopped at the first new concrete blocker:
`node --check` reports `SyntaxError: Unexpected identifier 'undefined'` in
`browser-driver.cjs:23`. The inherited driver embeds an unescaped
`'undefined'` inside its single-quoted `Runtime.evaluate` expression. This
driver is byte-identical to the predecessor's file. The failure and command
output are preserved; no repair/retry of that blocker followed. Later import
checks did not run. **Neither software nor WebGL combat launched.** There
were no browsers, native inputs, captures, observed renderer owners, actual
executed modules, enemy defeats or surviving-player observations in this run.

The prepared source identity remains
`2e802c7dfbb41dec726b7e69d580aba316cc48d2`, with expected canonical module
`1a021b0f9ef7eeba12637c66e8929fdd75383e16c431ee318f812af8dbd78e58`
and companion
`74b34125e175895dc3ca843ccaa555f934611e3bd676e1e95f25aae9c2e7be66`.
These are supplied pins, not Darkstone execution observations. Exact checkout
Git identity, relevant binary diffs and owned new-file patches are retained;
no source archive or media copy was made. The historical October 30 module
`4649ee5f…`, EXP 0 → 79 and surviving LIFE 17/35 remain prior accepted evidence.
No new discovery, parity, FPS or full-game claim follows.

Box `bx_92ssqvkw` was verified and ACKed before remote use at 03:08:44Z.
Postflight returns it **RUNNING/APIidle**, health `ok`, hydrated `true`, expiry
**2026-11-04T03:42:18.748Z**, with zero Chrome or owned browser helpers running.
Unique logs/helpers are recovered locally. Shutdown ownership returns to the
coordinator; no allocation, resume, stop, delete, subworker or public deployment
occurred. A separately authorized attempt would first need the driver syntax
repaired and syntax/import preflight completed before the original sequential
F Manual, Town → Ardyl, skeleton-torso route. This bounded task stops here.
