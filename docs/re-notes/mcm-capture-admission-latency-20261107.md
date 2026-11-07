# MCM capture/admission latency — Worker observation prerequisite remains

The retained original refusal is reproducible on a small local production
Worker route. No safe tooling latency correction was established. Changing
`Runtime.evaluate` from `awaitPromise:true` to `false` failed the full-path
comparison: each mode admitted one sample and refused one stale sample. The
production helper is unchanged; another original driving attempt still needs
the Worker observation prerequisite resolved.

Evidence: `scratch/runs/20261107-mcm-capture-admission-latency/`. Read
`retained-timing-analysis.json`, `probe/probe.json`,
`comparison2/comparison.json`, and the corresponding evaluation logs. These are
focused controls on `dx_boids` through production `index.html`, guest Worker
and owning legacy D3D WebGL Worker, using local Chrome 151 / SwiftShader.
They are not MCM performance results or an accepted fixture matrix rerun.

## Where the window goes

The retained original driver first performs a diagnostic `state()` read,
including a serial owning-renderer census. That happens before the capture
timestamp. `chain.capture()` then performs a complete live identity read,
timestamps the screenshot request, captures PNG, and performs another complete
live read. The latter consumes the existing scene age. Review/handoff follows;
`admit()` checks age, performs another complete live read, and checks age again
before dispatch. The pre-capture diagnostic can add acquisition time but cannot
explain post-capture age by itself.

`readLive()` already runs candidate guest/renderer evaluations concurrently,
recovers/hashes guest and renderer module bytes concurrently, caches only
immutable CDP script bytes keyed by actual Worker/session/target/script set,
and concurrently rechecks page/guest/renderer identities. It revalidates live
membership, instances, running/failed state, and complete module inventories.
There is no remaining serial guest-versus-renderer transfer to remove.

For the retained refreshed original race scenes, post-screenshot validation
took 3,586–5,426 ms. In `drive-fresh4`, the first guest identity evaluation took
5,407 ms and renderer evaluation 4,560 ms concurrently; final guest/renderer
rechecks took 17/7 ms. Both module hashes were already cached. Retained request
bounds place three throttle proposals at 9,392–13,256, 9,806–13,011, and
10,866–14,905 ms of pixel age. No input was dispatched.

## Measured rejected correction

The run-only probe schedules a bounded 1,800-ms JavaScript busy task in each
actual production Worker, then reads the same identity expression in both CDP
modes. Renderer replies took 1,703/1,715 ms with promise waiting and
1,703/1,704 ms without it. Thus disabling promise waiting cannot make a queued
observation bypass a busy Worker task. Guest probe samples varied from
4,094–10,780 ms; these include the production workload and deliberately added
task and are not isolated MCM timings.

A separate alternating comparison used the full unchanged chain with only its
injected evaluator selecting the CDP promise flag. It added no busy tasks,
input, fake clock, identity cache, or age adjustment:

| Mode | Full capture ms | Post-screenshot live read ms | Admission |
| --- | ---: | ---: | --- |
| Existing await | 11,244 | 2,461 | accepted at age 4,941 ms |
| Candidate synchronous | 12,808 | 5,204 | stale, zero dispatch |
| Existing await | 18,499 | 4,585 | stale, zero dispatch |
| Candidate synchronous | 16,949 | 4,662 | accepted at age 9,428 ms |

The first and last admissions were observation callbacks only. No native game
input was sent in this comparison. All samples used complete live checks; no
passing-after latency fix is claimed. The actual reviewed reference is
`comparison2/review.png`: a dark Boids scene with blue wire grid and small
green/white shapes. `review-approved.json` corrects the overbroad terrain/sky
template wording in the comparison callback's review string.

## Concrete next step

The established blocker is multi-second service latency for fresh CDP Worker
identity evaluations, particularly the first guest read after a screenshot.
The exact internal wait is not established by these receipts. Neither the
original natural renderer sync-poll probe nor this host-side timing identifies
which guest slice, render fence, or debugger scheduling interval owns that
delay.

The next bounded task should correlate requested/replied CDP reads with
read-only start/end observations around the production guest `slice` handler
(`lib/guest-worker.js`, uninterrupted `ex.run` and local-wait loop) and its
render-fence waits, plus owning-renderer task/fence completion. Use the same
small production route first. A resulting task-yield change would need to
preserve guest order, existing completion fences and input semantics, with its
own failing-before/passing-after controls. Do not substitute cached live
identities or debugger pausing for that investigation. Another original or a
held-risk lane is not authorized by this note.

## Preservation and custody

`tools/mcm-bound-input.cjs` remains SHA-256
`9df1455f51f91d76e17890ff4d90afe9264759d3e30e224a9a7569e29b1f8062`.
The 12,000-ms gate, every existing identity field and recheck, sticky UNKNOWN,
numbered exact ACK transport and independent release implementation are
unchanged. No original game, boat, remote runtime, source/media archive,
emulator/configuration/clock change, synthetic ACK, or accepted fixture matrix
was used.

The run records exact Git source identity and relevant binary patches,
including the pre-existing untracked `lib/wininit-boot.js`. CDP recovered the
executing module with SHA-256
`e41511fe861363fbe1639d80f20cbcdd7240f46937c93a801eaa256ca094c467`.
The locked `flock /tmp/wine-build.lock bash tools/build.sh` passed. Run-only
syntax/startup failures are retained separately; they dispatched no native
input. One invalid 60,000-ms requester timeout was rejected before queuing;
that sticky lane was closed without replay. The final checked harness uses the
existing 55,000-ms maximum.

`focused4/controls.json` passes actual native ArrowUp admission at age
11,302 ms, exact request/consumer ACK, trusted DOWN/UP and independent release
at 100 ms despite a 350-ms sampler delay. Physical keys are all released.
The same capture naturally ages to 12,014 ms and refuses with zero effects.
Replacing the actual page owner and removing the host's recovered module
inventory each refuse before dispatch and close their chains. Missing ACK
closes its separate transport; no dependent command is created and no ACK is
fabricated. These controls establish unchanged safety behavior, not a latency
repair.

All seven local control Chromes are closed, their server/debug ports are closed,
profiles and writer locks absent. Six exit receipts record code 0; the
requester-prequeue failure used an external ordinary Browser.close followed by
termination of the idle driver, with process/port absence verified separately.
Duplicate identical recovered modules were reduced to one verified unique
module plus hash/length references. Sampled free space remained above 2 GB;
continuous telemetry is not claimed. No test box was assigned or manipulated:
box ID/state/expiry are not applicable. Exact final file verification is in
`evidence-verification.json` and cleanup in
`terminal-cleanup-verification.json`.
