# GTA2 browser release-child scene binding — 2026-11-15

The browser controller now binds an independent release child to a fresh intent
nonce and a personally reviewed native scene, with a uniform 500 ms prearm
limit. Complete current-native browser qualification is **blocked**: the
corrected Worker run's second intent exceeded 500 ms during fresh child
source/module attestation. It never accepted an arm or sent DOWN. The separate
main-CPU browser check also refused before DOWN at 500 ms. Both endpoints are
permanently closed. GTA2 software and WebGL originals were not launched;
walking, entry, driving, visible game consequence and native Quit remain
unqualified.

This is separate from the historical native timeout. Published predecessor
`5b6c20b7b6cd98d66a9c62ee26d0e2e6a4d6e6da` passed fresh unchanged native baselines;
that historical failure's cause remains **UNPROVED**. DirectMusic capability
repair `cb30b2c6a` remains previously qualified; the original historical API
return remains UNOBSERVED. Genuine FT target invocation remains UNPROVED.

Evidence is in `scratch/runs/20261115-gta2-browser-release-scene-binding/`.
`result.json` records the final publication and validation state;
`observed-browser-blocker-verification.json` checks the positive partial pulse
and the two refusal records. Runtime source pins and exact recovered patches
identify the observed intermediate helper/controller revision. They do not
qualify subsequent changes to the final published source.

The ordered lane was Drakan1892162 → SimsMarshal1967519 → this worker. Current
Drakan release `cca5ea895418e686eafbd670b9ed87d2fd5bad4ac3568447bcf8c72d1dccda2f`
and Sims release `c2891b4a0fcd46da3baad4624a571faffc6c16aa16a96d60ccb70d1eb101555b`
were personally checked: referenced hashes, 32/108 recorded actual waits with
both EOFs, 94/108 absent PID groups, and free locks. Authored preparation stayed
in the light lane until those releases. Historical UNKNOWNs were not used as
new-work gates. Foreign source bytes were recorded before work and preserved.

The previous browser child checked a subset of page identity, lacked the nonce
and reviewed native scene, and allowed original/control prearms of 1000/1500
ms. `tools/gta2-browser-release-binding.cjs` now supplies the actual binding:

- The actual owning CPU reads public USER/process exports: process/thread,
  main/focus/modal HWNDs, generations, liveness, owner/parent, visibility,
  dimensions, capture and focus ancestry. Browser shadow-instance focus globals
  and prior Worker slice results cannot substitute for this read.
- The independent child checks OS PID/start tokens, current file pins, actual
  runtime page/physical-handler function bodies, its own retrieved Worker
  source/module bytes, the imported passive helper's exact owner identities,
  the owning renderer/backend and a fresh native scene. Its ACK includes its
  own random token, nonce and binding token only after native arm succeeds.
- Worker consumption uses the existing serialized command queue and rejects
  retired endpoints, nested sends and active writer sessions. The owning CPU
  validates the exact nonce/scene, then remains synchronously parked on a
  bounded commit channel while the page rechecks original renderer/queue/
  memory/module/window references and shared native generations. Only then can
  the ordinary physical handler receive DOWN. The main CPU performs the same
  check and physical handler in one synchronous turn.
- A standard native child control need not have its own renderer Window object.
  Its actual HWND/generation/thread/parent/focus ancestry are still checked;
  its exact top-level renderer owner must exist. Existing top-level windows
  retain exact object, instance and process checks.
- Fresh nonces have permanent tombstones. Changed source, endpoint, instance,
  PID/start token, context, generation, backend, stale lease, duplicate arm,
  duplicate DOWN and binding after arm refuse. Failures seal permanently.
  Independent UP still targets the original renderer after legitimate focus
  changes; it does not require a fresh scene.

The original controller imports this helper, captures native context before and
after a complete screenshot, and includes that scene and nonce in the real
child configuration. Parent and child enforce 500 ms from child launch to arm;
operations remain bounded to three seconds. Physical UP must be acknowledged
within 1750 ms. Holds are 80–1400 ms and start at the acknowledged physical DOWN,
not the earlier CDP send. Every original gesture still needs a new full scene,
manual intent/nonce and review within five seconds for gameplay or thirty for
menus. Only a positive pre-effect UNSENT permits a new review after a refusal;
UNKNOWN cannot capture, rebind or retry. The 180-second irreversible Quit
reserve is unchanged.

Blank-page protocol controls are explicitly restricted to `about:blank` with
no app. They cannot admit a native owner or qualify browser Worker input. The
real child is joined with both pipe EOFs even when prearm fails. EOF before arm
cancels permanently; EOF without a finite schedule after arm releases UP and
ends permanently. No later cancellation/rebind request follows that failure.

Observed native/browser results:

- An independently authored 17 KB x86 PE created a real main window and two
  native MessageBoxes. The main-CPU first modal and Worker first/second modals
  were personally reviewed as complete full screenshots. The prior blank
  second modal remains a historical unqualified observation; no cause or
  rendering repair is claimed.
- The corrected Worker first intent armed in 414 ms, consumed one native-bound
  Enter DOWN, held physically for 123 ms, and acknowledged independent UP 127
  ms after DOWN. The child independently recovered the current production
  module and Worker source. This is a partial observed revision, not complete
  final-source browser qualification.
- Its second intent reached actual source/module verification at 491 ms, then
  hit the immutable 500 ms prearm deadline before native arm/ACK. Parent and
  child recorded permanent UNKNOWN, no accepted arm, no DOWN and actual child
  wait with both EOFs. No endpoint replay followed.
- The main-CPU check reached source inventory/function-body verification, then
  also hit 500 ms without arm/DOWN. No unchanged retry followed.
- Earlier authored implementation defects were corrected: inline script bodies
  versus enclosing HTML hashes, duplicate module reads, native child-control
  renderer mapping, and hold timing measured from CDP send (68 ms for a requested
  100 ms). Those are authored defects, not explanations of the historical native
  failure. Exact prototype helper/controller patches match the recorded hashes.

Focused checks cover 25 authored identity/context/lease fault cases, fourteen
Worker protocol cases, eight main-page cases, current file/PID/source guards,
real loopback release children (scheduled, EOF, paired UP, wrong identity and
permanent UNKNOWN), actual CLI guarded input, and native scene controls.
Authored VM faults are explicitly models; they do not qualify the required
actual-native mutation/failure matrix. The first loopback harness crashed on an
unhandled socket reset; its missing wrong-owner child receipt remains UNKNOWN.
The corrected harness records socket closure and child PIDs and passes. It
cannot retroactively supply that missing receipt.

All 71 current GTA2 media files, EXE `97ad743b…`, genuine COMCTL32 `28a41e6a…`,
and installed COMMCTRL/KOMMCTRL `39bbfafa…` match their pins. No original,
version, settings, registry, clock, physics or game input policy was modified.
The genuine browser DLL HTTP/lifecycle qualification and the full actual-native
main/Worker fault/input-counter/native-Quit suite remain unqualified; the
500 ms blocker prevents original admission.

Validation status is recorded in `result.json`: shared and HEAD-plus-whole-owned
locked full builds, native caller ABI/source-guard checks, and final shared
module restoration. Evidence contains Git SHA plus relevant binary patches,
small authored inputs, unique logs and three selected complete screenshots.
No source/media trees or WASM/frame/capture bundles were archived.

Next work is to make fresh independent child attestation reliably fit 500 ms
without dropping any predicate, then qualify the final published source with
actual main/Worker native faults, input counters, complete scenes, installed
DLL HTTP/source/module/lifecycle parity and native Quit. Only after all those
checks pass can the separately authorized fresh ordinary software original be
considered; this task consumed no original attempt.

No workers or boxes were created. Box ID and expiry are null; state is
NOT_CREATED and stop receipt is NOT_APPLICABLE. Host browser teardown is not
native Quit.
