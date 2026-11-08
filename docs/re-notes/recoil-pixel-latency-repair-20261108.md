# Recoil final pixel latency: measured phases and pre-capture timing repair

Run: `scratch/runs/20261108-recoil-pixel-latency-repair/`.

**Tested first new generic helper repair, with a diagnostic for the unresolved
original runtime delay.** The HUD helper previously counted time queued before
the snapshot as pixel age. Its new optional same-host path stamps the beginning
of the final page evaluation, **before page-owner reads and before the new
`toDataURL` snapshot**. It retains the request timestamp separately. This removes
a demonstrated false-stale refusal caused by pre-capture queueing; it does not
speed up execution or excuse slow encoding/delivery. No new original or remote
allocation was used. This is not a native M consequence or gameplay result.

The original active evaluations of 301/318 ms still cannot be split into
scheduling and PNG costs retrospectively. Nothing here assigns those original
spans to queueing. Native qualification remains open until a separately
authorized original uses the measured integration.

## Concrete change and measured result

`freshness-repair.patch` is the small diff against the exact accepted
`20261108-recoil-orphan-safe-native/bound-input.cjs`. The final evaluation now
records `pixelStarted=Date.now()` before `PAGE_READ` and PNG creation. The host
records `pixelRequested` before dispatch and validates the new timestamp inside
the request/response bracket. The default remains the conservative request
boundary; target time is used only by the explicit same-host integration.
Reviewed scene capture/admission timestamps are unchanged.

`phase-evaluate.cjs` measures target entry/exit, owner-read duration and the
`toDataURL` phase. Host request/response timestamps distinguish request-to-entry
from target work and exit-to-response. Request-to-entry includes request
transport and scheduling; exit-to-response includes serialization, transport
and host handling. PNG time includes readback, conversion, encoding and base64;
it does not purport to split those internal browser operations.

`diagnostic-chain.cjs` wires the observer into the actual accepted chain and
selects the new capture boundary only with an explicit shared-host-clock
contract. Wall/monotonic consistency, request/response bracketing and the
ordering `entry <= capture timestamp <= PNG start` are checked. Clock or
capture-boundary failure throws UNKNOWN with no replay. A fabricated stamp
after an old capture is rejected. No clocks are set or modified.

The final bounded generated Chrome experiment made 36 full HUD reads using
actual generated guest/renderer Worker instances and actual CDP module
responses. Three trials per image/condition used the retained native current
menu and active PNGs, referenced by path/hash without copying media. Generated
workers never executed Recoil; displaying these images is not gameplay.

| Condition | Native menu pixel age, three trials | Native active image pixel age, three trials |
| --- | --- | --- |
| Accepted request-stamp baseline, 300 ms queued before evaluation | 345 / 342 / 338 ms | 322 / 319 / 323 ms |
| Fixed pre-snapshot stamp, same queue | 30 / 31 / 31 ms | 23 / 21 / 18 ms |
| Fixed, 300 ms delay inside PNG generation | 338 / 332 / 334 ms | 319 / 318 / 321 ms |
| Fixed, 300 ms delay after capture before delivery | 342 / 337 / 332 ms | 322 / 319 / 321 ms |

For the queued fixed reads, measured request-to-entry was 301–302 ms, PNG
generation 5.17–8.17 ms, and exit-to-response 5–8 ms. For delayed PNG reads,
entry was 0–2 ms and the PNG phase 305.28–311.81 ms. For delayed delivery,
exit-to-response was 306–310 ms. The 250 ms rule accepts the newly captured
queued images and continues rejecting both slow-image cases. No timestamp is
moved past the image operation. Real local unmodified active-image PNG phases
were 4.41–7.15 ms; these costs cannot be extrapolated to the original active
runtime under its different workload.

The earlier diagnostic-only experiments are retained as attempts 1 and 2.
They first established the phase split while preserving the old age boundary.
Attempt 1 omitted identity/script-id fields from its evidence output; this
evidence gap is recorded and corrected in attempt 2 and the final experiment.
The initial malformed-clock negative exposed a missing consistency check
between entry/exit and body duration. The stricter check now passes the new
negative and has been independently replayed over every final runtime row.
Earlier outputs/failures have not been overwritten.

## Preserved proof and tests

`native-results.json` records every exact process/endpoint object token, guest
target/instance, renderer endpoint/instance epoch, and module hash before and
after each read. Every probe has **four complete uncached responses, two each
from the actual generated guest and renderer sessions**, including script ids
and response sizes. All 144 responses satisfy those checks. Decoded RGBA hashes
are identical across baseline/fixed/delayed conditions for each image.

The parallel guest/renderer lanes, `Promise.allSettled` failure drain and final
co-located owner/pixels are preserved. `compound.cjs`, `compound-v4.cjs` and
`hud-phase.cjs` are byte-identical to the accepted versions: 250 ms freshness,
changed-timer temporal pair, save-time recheck, gate4500/M500, independent input
release and late-result refusal remain intact. Existing accepted identity,
transport, temporal-pair and gate controls were hash-verified and reused, not
rerun as standalone controls. The new focused integration tests cover parameter
passthrough, mandatory evidence sink, unknown-clock conservative fallback,
synchronous passive-read restriction, clock failure and after-capture stamp
refusal. There is no new physical-input experiment or synthetic gameplay claim.

`closure.json` verifies all **838 inherited source/media/helper pins**, all
**407 retained artifact references**, and accepted control/recovery hashes.
The exact accepted orphan/subreaper and immutable collector implementations
remain inherited; no remote lifecycle was exercised or changed. The two
continuously screenshotting original observers are a candidate source of
interference, not an established cause. They were not disabled in an original
or represented as a proven latency fix.

## Runtime, recovery and publication

Three bounded generated local browser invocations used the accepted local
subreaper/census wrapper. Each observable watchdog record was written before
launch; an independent `/usr/bin/timeout` enforced 90 seconds with 5-second
kill-after. The wrapper retained the local runtime lock through descendant
drain and released it before analysis. Each invocation records 18 PID/start
identities, with all parents, Chrome descendants and adopted crashpad children
absent at completion. Independent rechecks confirm closed server ports, absent
profiles, no remaining evidence writers, and an acquirable runtime lock. No
input was dispatched. Only local generated browser time held the local lock.
Free disk exceeded 5 GB; no subworkers, old-box resume/delete or deployment.

No box was created. The inherited original **bx_rukvjz6t remains archived,
expiry null**, stop **stop_e20e9a26b23210d8**, completed 11:54:54.681Z,
forced=false/error=null, as verified in the prior retained receipt. There is no
new stop receipt.

`source-head.txt` records this checkout's exact starting Git SHA. Original
recovery remains selected Git `49874a81c5ae180c20a15c6bb169d9041f028cae` and its
inherited relevant binary diff/media references. `owned-inputs.patch` contains
the small owned run helpers; `freshness-repair.patch` isolates the helper fix.
The artifact manifest and independent reread retain the unique measurements,
failures and recovery patches. No source-tree/media archive or peer WIP was
included. Only this note is committed; no production code changed, so no
production build claim is made.

Next: review this pre-snapshot boundary and use the measured integration in a
separately authorized, re-pinned original. Measure the actual active page and
guest/renderer entry/body/return phases before choosing a runtime scheduling,
observer or encoder change. Do not infer that the original 301/318 ms was
pre-capture queueing. Qualified ordinary M and a visible consequence, reviewed
movement, full27, parity, audio and FPS remain open.
