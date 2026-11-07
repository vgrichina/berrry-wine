# Motocross Madness: bound browser input and freshness boundary, 2026-11-07

The reusable repair is `tools/mcm-bound-input.cjs`. Generated Chromium controls
pass through capture, caller admission and native input. The single fresh
original reached the Stunt Quarry race through ordinary controls, but **no
racing throttle or steering was dispatched**. Live identity validation exhausted
the unchanged 12-second scene-freshness window. At-speed player steering remains
unproved; this is a concrete harness/runtime observation, not an emulator defect.

Evidence: `scratch/runs/20261107-mcm-bound-input/`. The older
`20261107-mcm-refresh-driving` and `20261107-mcm-steering-consumption` evidence
was read without modification.

## Repair and integration

`createChain({evaluate, send, workers, pageSession, app})` owns capture and
admission. The new run's `browser-run.cjs` calls `chain.capture`, writes its
identity-bearing metadata alongside the PNG, and passes the complete reviewed
metadata to `chain.admit`. Its actual key/combo path calls the new `hold` helper
and saves admission, passive samples and completed hold receipts. Name entry
also uses this admission path; the copied keyboard bridge's separate, unbound
typing CLI was removed. The retained original helpers were not repaired in place.

Capture reads live identity before and after the screenshot. Admission reads
it again and compares process ID **and object**, guest endpoint/link object,
actual Worker object and CDP target, actual guest instance, compiled-module
object and SHA-256 of module bytes recovered through CDP. When a renderer exists,
it additionally binds the page's owning render port and Worker objects, live
renderer target, endpoint/instance object generations and recovered renderer
module. Missing, ambiguous, retired or changed identities refuse input. A
same-looking replacement object cannot inherit its predecessor's review.

Epochs here mean the actual document lifetime and observed owner-object
generations: a per-document nonce with WeakMap object identities, plus the live
renderer endpoint/instance generation. They are not an MCM simulation-step or
semantic game-scene marker. No such guest marker was established or installed.
Ordinary animation does not invalidate owner identity; freshness still limits
the age of reviewed pixels.

The final published helper dates a screenshot at the start of its CDP capture,
and separately records `completedAt`. Slow validation after capture cannot
re-date old pixels. This last tightening was made after the original had stopped
and was retested in Chromium. The original used the earlier identity-bound
helper (`bound-input.cjs`, SHA-256
`e948f4139f4dfe260eac65875f2ea37e4b365d0cabb3494eb5c847754eb366fd`),
whose timestamp was later and therefore more permissive. Even that version
refused every racing input. `bound-input-final.cjs` and its patch preserve the
published version; no second original was launched.

`hold` permits ordinary keys and Up plus one steering arrow, with integer
50–2000 host-millisecond bounds. Every attempted key is released in reverse
order in `finally`. Its independent release timer remains active while passive
diagnostics await busy Workers. Samples record start and finish; only reads
completed entirely before release qualify as in-hold evidence. Page slice/EIP,
RPC and D3D counters, physical arrow state and owning renderer shared completion
controls are read without guest writes or injected callbacks. These observations
do not claim DirectInput polling or simulation steps.

Identity, partial or UNKNOWN failures close admission. A proven pre-dispatch
stale refusal preserves the existing numbered transport's capture-only recovery.
Late ACKs cannot reopen UNKNOWN closure. The published helper has no automatic
retry or replay behavior.

## Generated real-browser validation

`generated-browser.cjs` launches Chromium with a real page, real guest and
renderer Workers and small generated WASM modules. Native CDP events feed the
production `renderer-input.js` physical-state handlers. The generated counters
measure this fixture's WASM executions and render commands only, not MCM steps.

The final controls verify:

- A captured PNG and review bind to the actual live process, Worker, endpoint,
  module bytes and epochs through the same reusable chain used by the caller.
- Trusted native Up+Left input overlaps physically, releases both keys, and
  advances generated guest execution and owning renderer counters wholly
  inside the physical hold.
- Actual process, endpoint, Worker, module and document-epoch replacement each
  refuses before dispatch, with zero native events and closed admission.
- Stale scenes produce zero effects; partial native delivery releases attempted
  keys, and UNKNOWN/late-ACK/partial/stale-dependent transport requests create
  no next input and leave no writer lock.
- A 12,001 ms delay after the screenshot leaves it stale despite a newly
  completed capture. A 250 ms passive-reader delay cannot extend an 80 ms native
  hold; that sample is excluded from in-hold evidence and the key is released.

See `generated/valid-input.json`, `replacement-controls.json`, `closures.json`,
`slow-capture.json` and `slow-sampler.json`. The fixture PNG was personally
inspected. Focused command:
`node scratch/runs/20261107-mcm-bound-input/generated-browser.cjs`.
For another execution, recover the retained script/helper patches into a new
run directory; the harness deliberately refuses to overwrite an existing output
directory. Both the final focused controls and the required
`flock /tmp/wine-build.lock bash tools/build.sh` passed. No guest physics,
configuration, input semantics or game callbacks were modified.

## Single original: precise new boundary

One UUID-idempotent box, `bx_bgrkbcnu`, was created. Before the sole launch,
933 individually staged files included the complete registered media, runtime,
fonts, DLL graph, actual modules and helper closure. All 932 inventory pins
matched remotely; 316 local HTTP pins had already passed. Media were referenced
by existing paths and SHA-256 and were not copied into evidence. Git commit
`633a9cca9d07989b73031cebe9d48c31677bee63`, relevant dirty/new-file patches
and the pin inventory record source provenance, rather than a source archive.

The ordinary route was video-memory dialog → RIDER name → Single Player Event →
Stunt Quarry → default Practice/two opponents → T-riffic → default rider/bike →
Start. The race rendered and was personally inspected. Actual execution used
guest Worker / owning endpoint 1 legacy WebGL, ANGLE **Intel UHD Graphics 620,
Mesa 23.2.1**, and loaded module
`e41511fe861363fbe1639d80f20cbcdd7240f46937c93a801eaa256ca094c467`.
Do not substitute the predecessor's SwiftShader identity.

Three racing Up requests received exact-ID, zero-effect stale refusals; no
Left/Right request was sent. The last attempt provides the most useful timing:

| Event | UTC |
| --- | --- |
| `throttle-fresh-scene` metadata timestamp | 08:23:24.943 |
| command 17 claimed before admission | 08:23:31.573844 |
| zero-effect stale reply published | 08:23:38.859807 |

It entered admission at age **6.631 s**, then spent **7.286 s** validating live
identity. The final freshness check refused age **13.917 s**. The code compares
identities before that final check; the stale error, rather than an identity
error, records that this was a freshness failure after the live read. Raw file
times and exact replies are in `boundary-timing.json` and the recovered command
queue. The screenshot's actual age can only be older than this original
version's timestamp. The final timestamp fix tightens this boundary.

Personally matched the central ravine, horizon/ridge and rear RIDER across
`race-settled`, `baseline-fresh`, `throttle-fresh-scene` and
`final-no-input-scene`. The player remains upright at the same position relative
to that static geometry and the speedometer needle stays near zero. ALBERTO
crosses the left side in the final image; that opponent and the oscillating red
direction marker are not player trajectory evidence. No at-speed baseline or
steering screenshot is claimed.

Passive post-capture observations advance from slice 11829 / 3 flips to slice
12023 / 38 flips. They prove eventual guest/render progress, **not progress
inside a racing physical hold**: none was admitted. Menu Enter holds have only
one in-hold sample each and cannot establish a guest-progress delta. Success
ACKs are not substituted for that missing evidence.

The HELP bindings remain Up/Down/Left/Right. DirectInput physical state and
Win32 console-message dequeue observations remain distinct. No dequeue timestamp
is treated as a DirectInput poll or guest-instruction timestamp. No logical-frame
address, guest step marker, clock, pacing or game state was configured.

After the final refusal, only a read-only capture/diagnostic and normal quit
were performed. No uncertain command or held-risk action was replayed. An earlier
read-only fetch mistakenly requested an image after a proven stale refusal;
the missing-file failure is retained and did not create input or alter closure.

## Terminal state and next work

All 20 commands 0–19 have matching exact-ID replies. Before normal quit, physical
and async high-bit key states were released and the input queue was empty.
Terminal inspection verified all 14 recorded processes absent, both ports
refusing, and profile/writer locks absent. All 198 terminal artifacts
(9,339,730 bytes) were retrieved or matched locally and fully hash-verified
before the delegated normal stop. Box state is **archived**, stop
**nonforced**, stopped **08:25:31.225Z**, active expiry **null**, under nine
minutes after allocation. No assigned runtime remains running.

Next work is to make passive identity validation fit the existing freshness
window without weakening binding, fresh-scene review or release/UNKNOWN guards.
This run stops at that boundary. It makes no public deployment, FPS, audio,
parity or full27 claim. Local free `/home` stayed above 2 GB. Evidence metadata
is published as `result.json` only after artifacts, checks and Git publication.
