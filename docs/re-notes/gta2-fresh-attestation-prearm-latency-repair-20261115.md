# GTA2 independent attestation prearm latency

Evidence is in `scratch/runs/20261115-gta2-fresh-attestation-prearm-latency-repair/`.
`result.json` identifies the terminal result, exact source revisions and selected
full screenshots. This note distinguishes intermediate positive controls from
complete final-source qualification. No original GTA2 launch is authorized by
an intermediate result.

The predecessor GTA2 release (`d1d2dd24…f566`: 737 hashes, 124 actual waits with
both EOFs, 181 absent PID/groups), GLLease release (`36ff6056…a2c0`: 471/89/403)
and current Sims release (`5c1ac015…13b2`: 2462/448/557) were personally verified
before shared-source, build or runtime work. Both locks were free. Historical
missing wrong-owner child receipts remain UNKNOWN; they did not gate new work.
The current Sims commit was `295182375bb36cca7202c61b6918333143ceebb0`.

The unchanged current-native main reproduction permanently failed at 500 ms
without DOWN. Its child reached initial pins at 80 ms, debugger inventory at
270 ms and page/handler bodies at 304 ms. The current Worker control passed two
modal transitions, but that control did not establish final-source parity.
Every refusal is retained in its original run; a later candidate does not
reclassify it as success.

The candidate removes redundant work while retaining the final fresh file
checks, actual native scene/nonce and consuming-context predicates:

- Start source/module recovery as the fresh debugger inventory arrives. Join
  every task before native arm; source-set changes, live edits, context loss
  and owner detachment invalidate the attestation.
- Qualify the installed engine's JavaScript digest against actual raw source
  recovery. Chrome 151.0.7922.108 produced 119/119 matching SHA-256 UTF-8 hashes
  across engine inventory, `getScriptSource` and freshly read current files.
  `installed-v8-js-digest-equivalence.json` records each independent triple.
  Fresh session, execution-context and script identities scope each proof.
  No mutable body/hash or scene is cached between intents.
- Continue recovering actual WASM wire bytecode for every genuine child. The
  installed engine's WASM metadata hash is the SHA-256 of an empty string and
  cannot prove module bytes. Keep the separate full binding, native-context,
  host-class and original physical-handler function-body proof.
- Prepare the main engine's debugger before personal review. Each child still
  launches inside the unchanged 500 ms window, opens its own transport and
  recovers its own current inventory and module bytes.
- Retain one fresh complete current-file verification immediately before arm
  and the parent's fresh verification before physical consumption. Remove the
  duplicate earlier file-read/hash pass during child connection setup.
- Record actual launch, connect, identity, source, module, native lease and arm
  phases. Buffer trace records until closure so synchronous per-script receipt
  writes do not consume the admission window. Await asynchronous pre-DOWN
  fault callbacks and enforce actual physical hold at 80–1400 ms.

The authored x86 fixture extends the previous two-modal fixture with native
`SetWindowTextA` public caption counters. It does not read private game memory
or adopt foreign uncommitted OutputDebugString code. Its generated PE is one
small run input; Git holds its generator. Captures occur with physical UP,
bring the browser page forward and await paint, and bind before/after native
scene equality to the PNG hash. Empty screenshots never authorize input.

Intermediate `digest-native-main` and `digest-native-worker` each passed two
personally viewed modal transitions, a 120 ms ArrowUp pulse and native Escape
Quit. The visible main caption changed from `DOWN=0 UP=2 QUIT=0` to
`DOWN=1 UP=3 QUIT=0`. Native ExitProcess and cleared windows were observed
before host teardown. Worker COMCTL32 DllMain returned 1, with public DLL
lifecycle LIVE/generation 1. Eight arms were 186–407 ms. These controls precede
the final removal of duplicate pin work and buffered trace writes; they are
partial evidence, not complete final-source qualification. The main native
ExitProcess control also exposed a host closed-context rejection after exit;
Worker exit did not show that rejection.

`fault-worker-source` served altered HTTP Worker bytes without editing shared
source. The fresh child refused their engine digest before DOWN. The first
main focus-change control did not reach its intended fault: it hit 500 ms
while required module recovery remained pending. The buffered-trace control
also refused at 500 ms (child entry 84 ms, connection 277 ms, raw module/source
requests at 460/472 ms). Both had zero DOWN and zero later requests. Those
runs prove deadline closure, not focus-change refusal. A subsequent empty
main fixture was closed as UNSENT without input. No synthetic busy loop is
presented as a game cause.

The final whole-owned HEAD build produced module
`d71d7050b15f722a8827dfe0b65f1712ab27f124d8eeda521e208d3edb87de25`
(2,220,165 bytes). The shared build produced `3da1322e…e68` (2,220,407
bytes), including foreign WIP; that difference is retained, not adopted into
the owned patch. Both locked builds and both focused/native ABI suites passed.

`final-head-main-batched-view` personally showed the full first modal, but
its first Enter permanently failed at 500 ms without DOWN. Controller entry
was 265 ms, connection 359 ms, attachment 387 ms and the first required raw
source/module request 499 ms. This includes the audit loader's Git-object
loading overhead; it is not identified as an original-game cause. Removing
that overhead used a sealed volatile memfd containing only immutable committed
Git blobs, each checked against its exact HEAD tree object. No source cache
was persisted and owned mutable files continued to be read afresh.

`final-head-main-memfd` then reported live native windows while its personally
viewed complete capture showed an empty desktop. Bringing the page forward
and awaiting paint did not establish a visible modal. A separate read-only
public renderer diagnostic confirmed live visible window records; it did not
read private game state or force composition. No intent, independent release
child, bind or DOWN was issued. The fixture closed at its bounded 90-second
review wait; both its native wrapper and browser were actually joined with
both EOFs. This is an UNSENT visibility blocker, not an attestation success
or a native Quit. Full final-source main/Worker parity and the complete native
refusal matrix are therefore UNQUALIFIED. The source-tamper refusal and
intermediate positive controls do not fill those missing qualifications.

The final-source runtime outcome and build/test receipts are recorded in
`result.json`. Complete actual native mutation/refusal parity, final-source
main/Worker qualification and original walking/entry/driving/native Quit
remain unproved until their named receipts exist. Loopback and authored model
results do not substitute for native evidence. The unchanged 500 ms prearm,
1750 ms physical UP, 80–1400 ms actual hold and three-second aggregate
operation bounds remain mandatory; UNKNOWN permanently prohibits subsequent
requests, input, rebind, replay or retry in that run.

The media audit retains all 71 existing paths/hashes. Genuine installed-name
COMCTL32 `28a41e6a…` and COMMCTRL `39bbfafa…` are referenced in place. No source,
media, WASM or capture bundle was archived. Source recovery uses Git SHA plus
binary diffs, including patches for new owned files. Original exact DMusic API
return remains UNOBSERVED and genuine FT target invocation remains UNPROVED.
No original game, agent, worker or box was launched. Box ID/expiry are null,
state NOT_CREATED and stop receipt NOT_APPLICABLE. Authored native Quit is
distinct from host stop and does not claim original GTA2 native Quit.
