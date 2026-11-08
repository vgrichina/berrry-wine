# Forsaken owning-guest observation latency, 8 November 2026

The owning-guest bottleneck remains unresolved. A run-local composition that
overlaps fresh module-byte retrieval with renderer observations still reaches
the unchanged command work deadline. No fresh original or box was started;
current look and further corridor navigation remain unverified. Current
movement/fire evidence is unchanged. No emulator mismatch was demonstrated.

Evidence: `scratch/runs/20261108-forsaken-owner-observation-latency/`.
Read both the early-look and current-native-progress notes and their actual
bound helpers, numbered transport, release helper, production fixture and raw
original trace. The previous 4,800 ms / 17.030 s controlled result does not
qualify the failed original latency.

## Exact original requests

`original-request-ledger.json` records the original trace hash, request ancestry,
completion/error and deadline records. All three requests below target guest
`2DDE99F3197B2EC20E53699B8EA311E2`, session
`2E0BAB60F2F8C3FA6CA195B686E1A2E5`, in number 5 `open-singleplayer`:

| Phase | Request | Actual observation |
| --- | --- | --- |
| Admission | #533 `Runtime.evaluate` | Fresh endpoint, slot, actual instance token and GPU-enable value; **8,085 ms**, completed. |
| Admission | #536 `Debugger.getScriptSource` | Fresh actual owning module bytes, SHA-256 checked; **170 ms**, completed. |
| Capture before | #575 `Runtime.evaluate` | The same expression, independently submitted for this boundary; **9,092 ms pending** at work deadline. |

Expression SHA-256 is
`93a59ecbd66836cd6b985e4b1652276aa7c88e2f0c6c368e1b13efbe4b5741c4`.
There is no second hidden owning-guest state evaluation: the capture-before
read supplies that capture's CPU state. The subsequent module-byte request,
screenshot and separate after-image proof were never reached in this command.
Earlier completed captures have independent before/after observations.

Admission, including the independently released Enter hold and sampler drain,
lasted **10,870 ms**. DOWN began 06:40:34.132 UTC, UP began 06:40:36.132;
the sampler drained at 06:40:36.512. After the 1,001 ms settle, capture-before
started 06:40:37.516. The work deadline fired 06:40:46.610. Browser closure
rejected #575 after **10,989 ms**; that is a cancellation/error duration,
not a completed service response. The command drained after 22,862 ms without
an ACK. It remains the first UNKNOWN, with no replay.

This distinguishes the measured CDP request wait from a proved internal cause.
The trace has no stack or guest-run/RPC wait attribution for #575. Production
`guest-worker.js` has synchronous `ex.run` and local wait paths, but their
existence does not identify which path delayed this particular evaluation.
Unrelated-thread selection was already refuted. Byte transfer is much smaller
than the measured instance-evaluation waits.

## Tested composition and limits

The run-local candidate starts the guest module-byte request, observes the
renderer and its bytes, then joins the guest byte result before validating the
final page references. It changes no owner comparisons, uses no module-hash or
mutable identity cache, and does not combine admission with capture-before or
capture-before with capture-after. Two stable readiness reads, 120-second
freshness, reviewed image hash, exact ACK, sticky UNKNOWN and independent UP
remain unchanged. The candidate is retained as tested investigation input,
not installed as a production remedy.

`local-serial/` and `local-overlap/` run the actual browser driver, numbered
transport, production guest/render Workers, public COM fixture, native trusted
Enter, admission, hold, settle, state, screenshot and after-image chain.
The ordinary baseline has an exact success ACK in each. For the diagnostic
command, host receipt delays are **8,085 ms** for admission and **9,092 ms**
for capture-before; the after read has no injected delay. A slow passive sample
models the independent release followed by sampler drain. These are controlled
receipt delays, not an assertion that the original Worker ran those durations.

This is deliberately an **optimistic censored-prefix control**: #575 had not
returned at 9,092 ms in the original, and its real completion remains unknown.
Returning at that lower bound cannot establish equivalence with the original.
It can expose a composition that already fails under that favorable condition.

| Composition | Already-started command drain | Numbered result |
| --- | --- | --- |
| Serial current helper | **21,839 ms** | Work deadline, UNKNOWN, no success ACK |
| Overlapping fresh byte reads | **21,373 ms** | Work deadline, UNKNOWN, no success ACK |

`comparison.json` retains phase/deadline records. The single 466 ms difference
is not a benchmark or validated original-latency improvement. Both controls
release Enter independently (**1,999 ms** serial, **1,995 ms** overlap), dispatch
no later input after UNKNOWN and drain their already-started work. A completed
PNG after the deadline does not restore the missing ACK or authorize input.
WORK=20 s plus declared settle, CDP=20 s, ACK minimum 50 s and cleanup reserve
30 s were unchanged. No scheduler, clock or guest implementation was patched.

The production module actually loaded locally is
`cc438f727a39e39d1016045d37ae95f60cf8f9793e6b117e14beabb80c27e07a`,
from the shared checkout's current build. It differs from the original's
`7ec49cbbae4cb177909fd8fd9d3599713ee5f2a5ffb7f7e8c890848a540052bf`.
This is an additional qualification limit; no original-module equivalence is
claimed. Source SHA, relevant uncommitted diff, file pins and actual loaded
modules are preserved. Git remains the source archive.

## Identity tests and closure

The overlap helper's actual production Worker negative tests pass for missing
renderer readiness, process replacement before binding, endpoint/render-owner/
process-owner replacement, all exact reviewed fields, replacement inside the
observation and after screenshot, stale image with zero input, and changed
returned module bytes. Additional controls replace the actual Worker instance
between observations and during capture, and instantiate a different actual
valid module in the generated Worker. Each is rejected; these controls alter
only the generated fixture, never an original guest. The positive trusted
native key route and release pass. No cached-byte equivalence claim is made.

Independent slow-sampler and injected-UNKNOWN release tests pass; all eight
capture-deadline/ACK/freshness regressions pass. An initial nonexistent test
filename was corrected and its failed invocation retained. Generated caption
pixels were inspected only as helper evidence. Three local browsers exit zero;
owned PIDs, ports, profiles, writer locks and watcher are drained. Evidence
hash/size verification and served-byte checks are retained. This commit changes
only this note, so no new locked build is claimed.

The remaining request is precise: a fresh actual instance/endpoint/slot witness
for each required observation still blocks at the owning guest, especially
original #575. A smaller byte-transfer path does not remove that wait. Dropping
it or reusing a prior mutable witness would weaken admission or capture proof.
Further work needs a defensible fresh identity observation mechanism and
matched production qualification, or direct attribution of this request's wait.
No unchanged original retry is justified by these results.

Box **none**, state **not allocated**, expiry **not applicable**, stop receipt
**not applicable**. No remote runtime or watchdog was needed because the local
qualification gate failed. Disk stayed above 5 GB. No old box was resumed or
deleted; no deployment or archive of the source/media tree was made. Release
this task's slot. Full 27, parity, audio, unmeasured FPS, current look and distinct
further navigation remain open.
