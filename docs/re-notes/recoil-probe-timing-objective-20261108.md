# Recoil passive probe timing repair, 2026-11-08

Run: `scratch/runs/20261108-recoil-probe-timing-objective/`.

**Tested substantive integration repair:** the owned native-CDP admission helper
now overlaps independent guest and owning-renderer identity/complete-byte read
lanes, drains both lanes on failure, and joins them before the final page-owner
check. Native CDP tests through the actual compound HUD probe reduced mean probe
time **364.87 → 271.56 ms** without injected delays, and **643.65 → 413.22 ms**
with an 80 ms generated delay on each worker identity evaluation. Three trials
per configuration alternate baseline/fixed order. These are generated fixture
transport measurements, not native gameplay performance or an assurance that
the original's deadline will now pass.

No fresh box or original game was allocated. Ordinary M, its visible consequence,
and reviewed objective movement remain unobserved. This task finishes with the
tested integration repair, rather than spending another original on an unchanged
late-probe result. Full27, parity, audio and FPS remain open.

## Retained evidence first

Read the handoff at `67aed1955` and its retained helpers, manifest, compound
receipt, observer records and retrieval ledger before changing the helper.
`retained-costs.json` records the exact receipt hash and measured intervals:

| Probe | Final pixel start through inspection | Previous inspection to pixel start |
| --- | ---: | ---: |
| MENU baseline | 46 ms | — |
| MENU 1 | 25 ms | 443 ms |
| MENU 2 | 19 ms | 343 ms |
| MENU 3 | 49 ms | 338 ms |
| Late living HUD candidate | 190 ms | 3,569 ms |

The last interval includes the 25 ms poll delay and both complete live reads
before pixels. It does **not** measure decode time alone. The retained original
has no CDP subphase timestamps: complete-byte transport, base64 decoding/hash,
identity evaluation and page capture cannot be individually attributed within
that historical gap. The final image starts 285 ms after the unchanged deadline;
the retained independent HUD images at 11:04:58.132Z and 11:04:59.064Z establish
visible Resume but do not substitute for admission. No historical causal claim
is made that serialization alone explains the late candidate.

The concrete source inefficiency is independently demonstrable: each old
`readLive` awaited the guest identity, full guest byte response/hash, renderer
identity, and full renderer byte response/hash in sequence, although the two
targets have independent CDP sessions. The repaired helper starts the two lanes
together after reading the page owner. `Promise.allSettled` drains both before
success or failure. It also explicitly rejects renderer detach during the byte
read. There is no cached-byte shortcut or guest/runtime change.

## Measured subphases and unchanged admission

`native-results.json` retains bounded per-read spans and native CDP request
serialization, response/buffering, JSON parsing, full byte count, base64/hash,
capture and real HUD decoder costs. Each generated module is 2,182,704 bytes,
comparable to the retained original's 2,182,663-byte module, but instantiates only
a generated worker fixture. Its custom section is generated in memory; no
original module, guest assets or media are substituted into an original game.

Mean fixed-helper costs without injected delay are: page-before 3.22 ms,
guest identity 4.00 ms, renderer identity 3.30 ms, guest complete-byte response
82.11 ms, renderer complete-byte response 89.44 ms, guest base64/hash 2.27 ms,
renderer base64/hash 2.01 ms, first final-page check 5.74 ms, final co-located
page/pixels 22.15 ms, HUD decode 20.74 ms. Module response JSON parsing averages
2.87 ms and is included in response latency, not additive to it. Concurrent spans
overlap and must not be summed as probe wall time. Final pixel-to-decode ages
are 55/45/30 ms without delay, 32/45/21 ms with delay. Initial direct `readHud`
native measurements are separately retained in `native-results-readHud.json`;
the second fixture run added the actual compound HUD integration and decode
instrumentation.

Every tested probe retrieves **four complete uncached module responses**, two
from the actual guest target and two from the actual owning renderer target.
Exact page objects, worker instance, targets, module hashes, renderer epoch and
final co-located page-owner references/pixels remain required. The unchanged
250 ms freshness check runs after decode and again after saving. The native
timer-mask temporal pair remains required. No input deadline, freshness bound,
or identity requirement was widened.

`focused-results.json` verifies full read counts, material overlap and seven
failure cases: changed guest bytes, renderer bytes, guest instance, renderer
epoch, final page owner, renderer detach and guest transport error. Both lanes
are drained before refusal. The real retained MENU and advancing HUD images
exercise the unchanged decoder: first living candidate, identical timer, stale
candidate, stale pair seed and slow-save cases cannot admit gameplay.
`gate-results.json` tests the unchanged compound runner with **gate4500/M500**:
the generated positive dispatch releases M after 501 ms despite a slow sampler;
a candidate completing after the immutable gate produces zero gameplay DOWNs
and independent Escape only 5 ms after its due time. This is generated dispatch
evidence, not trusted original-game consumption. No M/C/arrows or attack was
sent to an original.

## Integration, recovery and lifecycle

The owned `browser-position.cjs` loads the repaired `bound-input.cjs` and
instrumented `compound-v4.cjs`, logging bounded per-read timing rows. The
822-provider composed manifest explicitly pins sixteen owned browser helpers;
`integration-preflight.json` verifies the real hermetic preloader and decoder,
accepted 500 ms Escape and visible-pointer helper with an intentionally wrong
ambient PIN_FILE overridden. No browser is constructed by that preflight.
`closure.json` rechecks all 806 inherited source/media/helper providers, all 295
retained artifact references, twelve accepted controls and six prior custody/
review records. Controls are reused by exact hash, without broad control reruns.

The accepted `reap-owned.py`, actual `locked-launch-fixed.py` wrapper and
`artifact-custody.py` collector are retained unchanged with their prior focused
tests. Their earlier real zombie and mutable-alias failures remain in the prior
run and are explicitly referenced by the closure. They are not relabeled as clean
original success. An initial local test mistakenly assumed a PNG existed at its
remote relative name; the ENOENT failure is retained. The corrected test resolves
the existing retrieval ledger's exact local path and checks its hash.

Two generated local Chrome fixtures used `/tmp/wine-runtime.lock` only while
running/draining. The observable independent `timeout` watchdog was armed before
Chrome launch with a 90 s cap and 5 s kill fallback. The subreaper supervisor
records all observed descendant PID/start identities, reaps adopted children,
and verifies their absence, closed local HTTP port and absent profile before
releasing the lock. Final native fixture exit is 0; all 18 recorded identities
are absent. The earlier fixture's 18 identities are separately rechecked absent.
No local lock was held for closure checks, analysis or publication.

There is **no new box ID, expiry or stop request**. The inherited original is
only referenced through retained evidence: **bx_afvq3a5t**, archived, expiry null,
normal stop **stop_e067c3dd2575e338**, completed 11:07:14.264Z, forced false,
error null. No old box was resumed/deleted, no deployment or subworker was used.

Source identity is recorded in `source-head.txt`; selected original source is
`49874a81c5ae180c20a15c6bb169d9041f028cae`. `recovery.json` references the exact
prior relevant binary diff, owned untracked source patch and existing media
path/hash recipe. `owned-inputs.patch` records only small owned helper/test
inputs, with `timing-repair.patch` isolating the two behavioral changes and the
browser timing hook. No source archive, media copy or peer WIP is included.
Evidence results are retained by the accepted immutable content-addressed
collector and independently reread. No production file changed or full-build
claim is made; this publishes the tested run-helper integration and recovery
note.

Reproduce cheaply with `verify-closure.py`, `prepare-integration.py`,
`node test-probe.cjs` and `node test-gate.cjs` in this run. The bounded native
fixture is `python3 local-runtime.py` from the repository root. A future original
must recheck pins, identify its UUID-idempotent box and prearm the independent
25-minute watchdog, hold its own remote startup/runtime lock, visually review
Resume again, then pass this unchanged gate and observe ordinary M's consequence
before reviewed movement. Attack still requires a reviewed living target.
