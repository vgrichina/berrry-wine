# Deus Ex capture publication contract: transient slice hold, missing frame linkage

**The retained 735→736 capture remains rejected. `held` is a transient Worker
rendezvous hold, not a latched publication failure or a consequence of reading
the observer. The screenshot method cannot establish correspondence between a
completed owning game frame, its actor and the PNG.** Two separate helper
defects were demonstrated and repaired in run-only copies: active input could
be approved, and a display-only call could promote an earlier composite whose
display call threw. Neither defect is established as the cause of the retained
hold, zero motion or blank world. No runtime qualification or gameplay pulse
is authorized by this work.

Evidence and executable helper copies:
`scratch/runs/20261104-deusex-capture-publication-contract/`. Production files
were read only. Inputs are the notes published at `479b341a6` and `6a74fbc16`,
and the latter run's `feasible-evidence/` and `recovered/` helpers. Original
captures and modules remain at their existing paths; nothing was recopied.

## Exact historical lifecycle

Source is Git `a504fa248caaecbbb042b65e9ae5384a340ade26` plus
`scratch/runs/20261104-deusex-supported-stack/historical-source.patch`, SHA256
`9415aea6dbced13143b9dcdceb9d2d3594219a467263f7b3cf2bb623da36c796`.
That patch changes nine WAT/API files, not the JavaScript endpoints below.
`source-audit.json` verifies all six historical JS files against the actual
453-entry provision manifest, original/staged/recovered helper identity, and
the retained 1,898,260-byte executable module SHA256
`8459597c8d66e098d727fb4ab53e1cf46332241dc7eef2e158f3c475a78b1676`.
No rebuild or current-main substitution supplies this conclusion.

The following are historical source line references, not current-main lines:

| Endpoint | Executed behavior and implication |
| --- | --- |
| `host.js:5789–5817` | `beginWorkerGuestSlice()` increments depth before the main/thread rendezvous. `Promise.all([runMainThenEnd(), runThreads()])` parks the page continuation. Its `finally` calls `endWorkerGuestSlice()`, including on failure. A main Worker observer callback returning does not establish that sibling Workers finished or that the page processed the rendezvous result. |
| `lib/renderer.js:3589–3603` | Begin/end increment/decrement the depth; `_workerPublicationHeld()` reads `depth > 0`. GDI paint lifetimes are tracked separately and do not hold publication. This interpretation follows assignments and call sites, not the name. |
| `host.js:5890–5901,6481–6504` | After rendezvous release and normal result handling, `_presentAtBoundary()` publishes immediately if an earlier rAF marked a frame due; otherwise it queues a wanted presentation. |
| `host.js:6521–6578` | A rAF during a hold sets `_presentFrameDue` and returns. `_presentNow()` cancels the due/rAF state, attempts DX upload, and flushes scheduled composition when unheld. It can re-arm for later dirty/locked work. |
| `lib/renderer.js:3673–3731` | `repaint()` returns early while held; otherwise one synchronous `_repaintOnce()` composites and `_presentDisplayCanvas()` issues display work. Reentrant dirty notifications can set pending flags; `finally` clears repaint-in-progress/pending. |
| `host.js:6133,6157–6195` | The next runnable step is posted as a MessageChannel macrotask. Release/presentation and next begin are not one permanently held interval. Delayed/waiting routes can provide longer unheld periods. |
| `host.js:2106–2150` | DX shared dirty is observed, upload may defer while locked, and after three held-lock presentation attempts the host deliberately attempts upload anyway. Shared `locks:1` alone is neither an infinite publication lock nor an owning-frame completion fence. |

Thus both retained `held:true` samples can surround real unheld publication
intervals. A successful `_repaintOnce()` on this route is reached through the
unheld branch of `repaint()`. External samples during successive asynchronous
slices can all read true while composites advance between them. There is no
code-imposed rule that this route always samples true: the posted-step gap can
be observed. Conversely there is no guarantee that two CDP samples around a
screenshot will both land in such gaps, or that all pending flags will ever
clear together in an animated game. A global-idle requirement is a conservative
gate, not a game-frame completion protocol. Waiting longer cannot prove that
it will succeed.

The run-only boundary observer reads depth/pending state and forwards renderer
methods; it does not increment depth, repaint or schedule a new guest slice.
The owning actor observer reads in a Worker `setTimeout` callback after that
Worker's JS/Wasm stack returns. Its timers/evaluations add observation work and
can affect scheduling opportunities, but no demonstrated observer mutation
creates or latches the hold. An actor-return boundary is not the all-Workers
publication boundary. No browser timing experiment was performed here.

## What the retained capture establishes

At 04:21:25.368Z the observer reports host composite/display sequence735
(recorded .362Z); at .458Z it reports736 (recorded .389Z). Both samples identify
hwnd65539/process1000 and the displayed DOM endpoint. Both are held; the latter
also has scheduled/deferred/DX/shared dirty/frame-due flags. The owning surface
records advance GDI/layer sequences1795/1796→1797/1798. Actor samples at
.366Z/.459Z identify slot0/tid1's JCDentonMale0, ptr272119808, unchanged save
location/yaw/Physics1/velocity0. These are sequential observations.

The executable driver orders Worker identity and actor-before → page-before →
one `page.screenshot()` → page-after → actor-after. `qualify()` rejects pending
flags before checking crossed publication. The exact original reason remains
`pending/held publication; screenshot not a settled frame`;735→736 independently
fails its unchanged-publication condition. No approve-ready or Left followed.
The original files and guard failure remain untouched, including the earlier
missing-API-table staging failure.

The observer's sequence counts successful CPU compositor calls followed by
display calls. Its `windows` record enumerates renderer windows after
composition; it does not record the exact stack/layers actually selected and
drawn, their immutable pixels, or an engine render-finished token. In historical
`_presentDisplayCanvas()` (`lib/renderer.js:1351`), direct presentation can
return without filtering, and filtering issues its own display work. Function
return does not attest Chromium compositor submission/readback completion.
The subsequent screenshot has no shared frame identifier with those calls.
An unchanged actor value also does not establish that this actor was the
viewport actor for either composite. Valid pixels do not close these gaps.

## Demonstrated run-only repairs and tests

`test-contract.cjs` executes historical methods extracted directly from Git in
Node VM fixtures, including the exact rendezvous block, real begin/end,
schedule/rAF/defer, host boundary presentation, actual renderer `repaint()` and
`_presentDisplayCanvas()`, and posted-step scheduling. Canvas/GDI endpoints and
CDP transport are fixtures, not guest/browser execution. Eight traced cycles
show every external in-slice sample held, every boundary sample unheld, and
advancing publications. A completed main result with an outstanding sibling
still holds publication; rendezvous rejection releases it. Repeated observer
sampling does not alter depth. `lifecycle-trace.json` preserves the sequence.

The original executable capture/approve-ready branches accept a settled
fixture even with queued Left, physical/async Left down and a driver-held key.
The qualifier checked publication state but ignored input evidence. Owned
`boundary-observer.cjs` now records full queue length and all physical/async
down keys without consuming getters; `capture-boundary.cjs` rejects active or
unmeasured input. Owned `driver.cjs` additionally rejects driver-held keys and
resamples the page boundary before approval, rejecting changed publication,
owner, pending state or active input. Native support, human inspection, PNG
identity/hash and existing timing guards remain required. Capture also clears
the previous capture record before awaiting transport, so a failed capture
cannot leave an old record available for approval.

The original observer increments its composite count after `_repaintOnce()`.
If `_presentDisplayCanvas()` then throws, a later successful display-only call
(the real caret route at `lib/renderer.js:4300` is one caller) promotes that
failed transaction because `composites > published`. The test executes the
actual repaint/display code with an injected filter exception and then a
display-only call: original promotes, repaired does not. The owned observer
requires a successful composite/display pair inside the same active repaint
transaction and discards the candidate on display failure. It forwards return
values and exceptions. This corrects a false completion record; it provides no
new Chromium or guest-frame fence. No such exception is established in the
retained live capture.

Final checks:60 contract assertions,24 requested fixture screenshot calls
(including one propagated CDP failure), original observer33, queue6,
timing/readiness14, and both actual staging-preflight negatives pass. Actual
capture/approval paths reject held, every pending flag, crossed screenshot,
crossed approval interval, stale frame, missing/wrong owner, queued/down input,
driver-held input, stale PNG name/hash and absent inspection; legitimate settled
fixtures accept. No retries or gameplay occur in the tests. Initial test-harness
method-extraction syntax errors were corrected; the first is retained in
`fixture-first-failure.log`. These fixture accepts validate guard mechanics,
not the missing full frame/actor/PNG contract.

The three helper copies and their patches against retained originals live in
the owned run. For recovery, reuse the original `feasible-evidence/` companions
by path/hash and apply those three small patches, or stage these three copies
into a separately authorized run's existing helper directory. Retain the
predecessor's corrected API-table/dependency preflight. The historical absolute
driver deadline remains expired deliberately; these are offline repairs, not
launch instructions or authorization. Git base, relevant empty production
binary diff and new-file patches are recorded by `audit.py`. No source tree,
media or module archive was created. No production build is required for
changes confined to ignored run-only helpers and this note.

## Exact missing boundary and safe next implementation

A full contract needs an immutable completed owning-frame record linking:
(1) an identified render completion and exact selected window/layer/display
source, (2) its owning Worker/slice and verified viewport→player actor relation,
and (3) the bytes encoded as the inspected PNG. Present sampling supplies none
of those three as one transaction. Merely ignoring held/dirty flags, comparing
counter names, matching actor values or waiting for global idle cannot repair
it. The helper repairs intentionally retain the conservative pending/crossed
rejection.

A safe next implementation would observe the existing natural render and
publication completion boundaries with correlated tokens, retain the actual
selected stack/source and actor/viewport identity for that completion, and copy
the completed presentation into immutable capture bytes at that boundary.
Encoding those bytes can occur later while the game continues; input and
future frames need not be idle. The record must distinguish engine render
completion, host composition and GPU/browser readback completion. If a browser
screenshot is retained as the artifact, its compositor/readback must carry the
same identity or be checked against the immutable recorded output; ordinary
before/after CDP evaluations do not provide it. Readback/actor association must
be demonstrated on the actual rendering backend before any qualification claim.
No speculative frame-token or capture implementation was installed here.
Freezing publication/guest execution, forced repaint, guest writes, input-guard
relaxation or timing/config changes are unnecessary and unauthorized.

No box was allocated or accessed. `bx_affrncy3` is coordinator-owned; the last
retained report was RUNNING/APIidle, expiry2026-11-04T04:46:29.292Z. Its current
state was not queried; the coordinator owns its shutdown. No browser, heavy
runtime, lifecycle/resume, other-box access, gameplay, subworker, deployment or
successor task ran. This task ends with the note and tested run-only repairs.
