# Original grayscale: direct-window dword load speedup

`gl32` now loads immediately when all four bytes fit the existing direct
window. This mapping is affine and cannot invoke sparse translation, DIB lazy
barriers or SEH. The existing translating path, redirect checks and synchronous
remap handling remain the fallback for partial spans and other mappings.
No store, identity-store notification, code invalidation, arithmetic or flag
operation changed. Published memcpy `e7e0312bd` and shift fix `9bf37f769` remain.

Evidence: `scratch/runs/20261110-lbreakout-gray-translation-cost-0510/`.
Starting Git commit: `3af98942f1007270893c0da290934ad730615173`;
`git-base.txt`, relevant binary diffs and `owned-inputs.patch` reproduce inputs
without a source archive. Original media stays at existing repository paths.

The original fullframe fixture from runs 0423/0435 is retained: hash-checked
original EXE/SDL/CRT, original SDL_CreateRGBSurface, original `_stk_surface_gray`
at 0x426bb0 with `[surface,0,0,-1,-1,0]`, controlled SDL32 format and seeded
input pixels. This is an offline original-function benchmark, not a native
menu timing or a measurement of recovered native theme pixels.

Each pass has six warmups and 15 same-process ABBA/BAAB groups, 60 timed
640x480 original calls. Timing encloses only the original call. Every timed
call checks all 307,200 pixels, nine registers, five lazy fields, observable
flags, cdecl return, 3,074,406 blocks and 614,400 retained native memcpy calls.
Separate original-function PUSHFD readouts agree on complete EFLAGS = 582.
Canonical, scratch and production returned states and pixel hashes agree.

| Comparison | Median candidate/control | Faster groups | Paired permutation p |
| --- | ---: | ---: | ---: |
| One-instance scratch toggle, first | 0.923102 | 14/15 | 0.000183 |
| One-instance scratch toggle, second | 0.954498 | 10/15 | 0.012268 |
| Production versus unmodified module, first | 0.966365 | 12/15 | 0.003052 |
| Production versus unmodified module, second | 0.965176 | 11/15 | 0.032532 |

The production comparisons use two matched instances within each fresh Node
process, with no toggle in either module. They repeat a **3.36–3.48% median
reduction** against unchanged runtime source. The named production module's
runtime sections are byte-identical to the canonical built module. One initial
harness attempt incorrectly required the steady-state block count on a cold
warmup (3,074,404); it failed before timing and is preserved separately. Only
post-warmup timed calls are subject to that count assertion, as in prior runs.

Local x86-64, Node 24.18.1 / V8 13.6.233.17-node.50, automatic engine tiering.
No clocks, tier settings, guest budgets, deadlines or gates changed. Own build,
capture and regression jobs did not overlap timing; matched runs also hold the
shared build lock. Other shared-host activity was not controlled. These elapsed
results do not establish browser/native-game speed or other architectures.

Fresh control/scratch/production native captures are retained for SpiderMonkey
C158 Ion and standalone V8 15.7.57 TurboFan on x86-64, resolved using the actual
module name section. Ion gl32 grows 405 to 433 bytes in production, with the
same 0x30-byte frame. TurboFan grows 3008 to 3392 bytes, with a 0x78-byte frame
versus 0x68 control. Both show the new direct return and retained slow calls;
this is not evidence of reduced frame size, spills or FP-state work. These
forced inspection tiers/engines differ from the timed Node engine. No ARM64
measurement or capture is claimed. No exclusive causal cost percentage is
assigned beyond the matched direct-span-path intervention.

Validation includes the new 72-check g2w regression (partial direct-window
edges, guest-page crossings, independently translated bytes, registers/lazy
state), 624 scratch handler differential cases with watches, counts and code
retirement, and 10,136 direct/DIB/wrap/window differential reads. Production
source passes sparse scalar/x87/MMX/CRT/bulk width boundaries, synchronous
page-remapping cross-page access and selective page watches (including aliases,
shared instances, windows, bulk operations, release and audit fallback).
Final decoded fault/shift, full shift model and sparse string regression logs
and exit statuses are retained in `focused-test-jobs.json`; locked production
build passes. Identity stores still notify watched pages and retire decoded
code, including effective-zero shifts. Production fault regression checks 280
single-fault entries, raw CONTEXT continuation, 336 mapped arithmetic/flag/watch
cases and eight exact code retirements.

Reproduce `compile-candidate.cjs`, `compile-control.cjs` against the recorded
baseline and `compile-production.cjs` before applying the production patch;
then `run-matched.py` and `run-production.py` under the build lock. `bench.cjs`
reuses the original harness; `bench-production.cjs` extracts the same setup,
call, verification and sampling logic for the two-module control. Capture with
`capture-{sm,v8}.cjs control|candidate|production`. Hashes and small inputs are
retained in the run inventory. Git plus patches is the source archive.

OFFLINE only: no box, browser or native game was allocated or run. Box ID,
state, expiry and stop receipt: not applicable. Independent GNU timeout guards
bound local jobs; no box watchdog was needed. Nox/BG2 drivers, CRT, renderer,
startup and original binaries were untouched. Next: separately authorized
browser/game validation if wanted; this result establishes the offline generic
load improvement only. Release and STOP after publishing supported own paths.
