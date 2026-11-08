# TR2 frame identity and presentation pacing — 2026-11-08

**Distinct owning-frame presentation identity remains unqualified. No FPS or
presentation rate is reported; no box was allocated.** The blocker is the missing
producer association between a completed owning render flip and the canonical
surface version actually used by page composition. Local tests exercise the
released production boundaries and a concrete proposed association contract.
Evidence: `scratch/runs/20261108-tr2-frame-identity-rate/`.

Native Enter and current Venice movement/heading remain accepted from
[default OK activation](tr2-default-ok-activation-20261108.md). They were not
repeated. This investigation follows the counter warning in
[the previous rate attempt](tr2-current-control-presentation-rate-20261108.md).

## What the production stages identify

Final source audit records main `c98ab8486fb03eebf67e5f24bf4875e24a965570`,
with an empty relevant production diff. Individual file SHA-256 values and the
empty diff are recorded in `source-audit.json` and `relevant-worktree.patch`.
No newly loaded game module or current live graphics owner is claimed.

| Boundary | Identity and meaning |
| --- | --- |
| Guest simulation | No verified TR2 simulation-update marker or update-to-render association. Logical game FPS cannot be inferred. |
| Stream flip | `lib/d3d-command-stream.js` serializes front/back object addresses in a flip record and assigns a batch sequence on submission. Record ordinal distinguishes records within that batch; batch sequence alone also covers non-frame work. |
| Owning completion | `lib/d3d-render-worker.js` replay retains sequence/ordinal and awaits `adapter.fenceFlip()` before `d3dim_worker_flip(front, back)`. That export receives only two reusable addresses. It swaps DIB pointers; it does not publish a producer token. The optional `worker-flip` route event has front/back/completed but no sequence/ordinal in its payload. Separate diagnostic context can identify the render record locally; it does not tag the subsequent canonical surface. |
| Guest present | `src/09a8-handlers-directx.wat` `$dx_present` sends kind 5, slot, bpp, DIB pointer and palette. `lib/guest-rpc.js` forwards that tuple asynchronously. Neither producer timestamp nor flip token is attached. Slot/DIB pointers are reused. `lib/host-imports.js` reduces this to `{kind:'directdraw',slot}` and increments `WinePerf.guestFrame()`. |
| Canonical upload/composition | Dirty uploads can coalesce. Surface write order is not a completed-flip identity. `lib/renderer.js` calls `observePresentationPublication(display, sequence)` after ordinary composition. Its sequence identifies the composition transaction, with no owning flip or immutable source-version argument. |
| Content | Repeated bytes can be a second valid render completion, or repeated composition of the same completion. Content equality alone cannot resolve which. A sampled pixel signature cannot qualify full-content changes. |
| Actual presentation | A defensible available target would be a page-canvas publication containing a particular completed owning surface version, counted once per producer identity. It would still not establish physical browser scanout or simulation FPS. This association is currently missing. |

FIFO order and the one-in-flight render policy establish ordering within their
own boundaries, but do not establish which version a later coalesced page
composition consumed. Assigning the latest completion at observer callback
time would make delayed delivery alter identity and interval placement.

## Adversarial local results

`node scratch/runs/20261108-tr2-frame-identity-rate/qualify.cjs` passes.
This is a boundary harness, not a game run: it loads the unchanged complete
render-worker script in a VM with inert transport and test exports, calls the
real host-import and PerfHud functions, and exercises the real renderer
publication transaction with a mocked drawable/composition backend. It does
not execute TR2, render real GPU pixels or prove live end-to-end behavior.

- Two flip records in batch 17 retain ordinals 0 and 1 in the trace. An
  independently released unresolved fence prevents the first swap; after its
  release the second fence separately prevents the second swap. Both completed
  export calls have identical `[front,back]` arguments. The completion delay
  does not manufacture an additional flip.
- Two identical kind-5 notifications produce two telemetry counts and identical
  `{kind,slot}` records. A later identical notification increments again, with
  arrival-time pacing timestamps. These inputs are indistinguishable from two
  valid presents on a reused surface. The actual released `measureWindow`
  counts the later arrival in its receiving interval. This demonstrates an
  identity ambiguity, not observed TR2 duplicate delivery.
- Two ordinary renderer publication transactions with the same display object
  and bytes get sequences 1 and 2. Two upstream test-content replacements
  followed by one transaction produce only one additional publication. Neither
  repeated composition nor coalescing supplies the missing producer argument.

All final raw boundary traces, telemetry timestamps, matched timing trials and
asserted outcomes are retained in `qualification.json`. The first harness
attempt failed because its dummy memory had zero length; that log is retained
as `qualification-first-failed.log`. The corrected harness provides blank
host memory; it performs no guest-memory writes or game/clock modifications.

## Concrete tested remedy and remaining work

The run's `Join` model requires `(owner generation, batch, record ordinal)` at
completed readback/swap, retains the first completion timestamp, and joins that
token to the exact surface content/version consumed at publication. Duplicate
completion and repeated publication of that token cannot add a row, including
a duplicate delayed into a later interval. Two distinct tokens with identical
content remain two producer presentations; content changes are counted
separately. Tests reject missing/stale owners, publication before completion,
conflicting duplicates, overwritten content and backwards source ordering.

This is a **tested contract model, not an installed production fix**. Production
currently fails its missing-token precondition. To implement it, retain the
owning endpoint/generation and flip token across completed readback/DIB swap,
the owed guest present, canonical upload/version, and the transfer used in
`observePresentationPublication`. A token must travel with the consumed version,
rather than be guessed from a global latest counter or mutable DIB address.
Include the synchronous/nonqueued route or explicitly reject it. Record
producer completion and page publication timestamps with clock-domain identity;
callback receipt timestamps remain separate. Account for coalesced/dropped
versions and owner replacement explicitly. Full-content comparison, if used,
must operate on that version and have its own measured overhead.

The next qualification should drive these same duplicate/delay/overwrite
controls through the implemented production association and measure matched
observer/control overhead there. No rendering/emulator mismatch was demonstrated,
so no emulator patch was made. A fresh-box rate run is premature until that
qualification succeeds. Even then, call the result completed-owning-frame
page-publication pacing unless a separate TR2 simulation association is proved.

## Observer overhead and rate decision

The matched local microbenchmark uses the real `PerfHud.guestFrame()` with
telemetry enabled in both arms; only raw pacing timestamp retention differs.
Seven ABBA groups each use 100,000 calls per arm instance after warmup, with
all 28 durations retained. The median paired additional cost is approximately
**296 ns per call** (median paired increase **89.2% of this seam's control
time**). This percentage is not game slowdown. Node v24.18.1, VM execution,
allocation/GC and local scheduling limit its interpretation.

This does not measure the full sampler's polling/visibility checks, browser
execution, graphics readback, content comparison or game-throughput overhead.
**Full observer overhead remains unqualified.** No gameplay warmup, three
ten-second windows, frame/presentation counts, median/p95 gameplay intervals,
logical FPS, displayed FPS or physical scanout rate are reported.

The released sampler validation and canonical frame-source regressions also
pass (`focused-tests.json`). No production code changed, so no fresh build is
claimed or required for this documentation-only commit.

## Evidence and lifecycle

Evidence stays in the owned run directory; Git SHA plus relevant diff and
owned new-file patches preserve source identity. No source/media archive,
copied game media, setup screenshots, guest patch, forced scene/configuration,
clock/seed change, private input handler, deployment or worker spawn occurred.
Sampled available disk remained above 5 GB.

**Box ID: none; state: not allocated; expiry: not applicable; stop receipt:
not applicable.** No heavy runtime or remote process was started, and no
existing box was resumed, stopped or deleted. The allocation/watchdog/retrieval
protocol was not entered because local identity qualification failed. The owned
messageboard watcher is drained at closeout; local tests terminate normally.
Full27, backend parity, audio, weapons and unmeasured FPS remain open.
