# UT GOTY owned wizard selection repair — 2026-11-18

Evidence: `scratch/runs/20261118-ut-goty-owned-wizard-install/` (ignored).

The original installer reaches the genuine `D:\System\Setup.exe`, with inherited `D:\` working directory. This task reused the existing 649633792-byte CD1 ISO, SHA-256 `e184984ca88f001c5ddd52035d76cd64e266e26c74975161b5ed72366c74704f`, through normal read-only media import. Previous scopes stayed closed.

Passive USER assignment tracing established the blocker: the modal root was real top-level HWND `0x10001` (parent/owner zero, style `0x90c80ac0`), but a nested modeless WS_CHILD page `0x1000a` was adopted by CreateDialogParamA while main was zero during initialization. Focus correctly resolved to the root; reviewed capture rejected `main.topLevel`. This was USER state, not renderer surface classification.

The general repair excludes WS_CHILD from both initial CreateWindowExA main adoption and the native-helper CreateDialogParamA fallback. ShowWindow explicitly permits absent main: `wnd_is_effectively_visible(0)` returns true as the ancestor-walk terminator and cannot answer whether an existing main is visible. Parent/owner, retained application DLGPROC, generation, process/thread and lifetime guards remain in place. No guest HWND, focus, registry, INI or installer patch is used.

An ordinary authored modal dialog creates Static wrappers and nested child dialogs before showing its root. The old module reproduces the wrong child main in native and normal browser guest-worker launches. The repaired module selects `0x10001`, retains the child parent chains, and produces whole native and browser screenshots. Browser actual worker bytecode is SHA-verified. Focused USER tests also preserve genuine owned-popup promotion; the full authored native/browser regression checks absent-main ShowWindow. Targeted callback reviews retain the ownership census gates.

Native capture qualification measured 141ms on the initial fixture and 440ms on the repaired nested fixture. Published finite controls keep a 3000ms observation window and 30-second menu review freshness, selected before the original launch from these measurements; 3000ms is not an owner mandate. The authored Next pulse exposed a separate 500ms confirmation timeout; independent physical UP was acknowledged and that scope closed without endpoint replay. No authored input success is claimed.

The final original result and publication receipts will be appended after the tested repair is published and the affected original is exercised. Installation/gameplay remain unproven at this publication stage.

## Published repair and affected original

Repair commit `a232805d395484e5957f0d13a54421f89e598348` passed the full locked build, focused child/owned-popup, existing created-dialog and ShowWindow promotion tests, and native/browser regression. Strict pull and push succeeded. The retained tested module is `cc9f89ee01a0bea04367fcf3bb10eeeaf12470bedda2d1230846ee37b212aa51`.

The fresh affected original (`original-published/`) used that module after publication. Passive startup retained real root `0x10001`, parent/owner zero, style `0x90c80ac0`, generation 1, process 1000/thread 1; the focused real child resolved to that root. The early readiness sample still has main zero during initialization; no assertion that it had already completed ShowWindow adoption is made. Existing genuine modal-creation provenance qualifies this absent-main state. The subsequent reviewed capture reported `context: []`, so the previous child `main.topLevel` blocker was removed.

The next concrete blocker is `control.unsupportedClass` at HWND `0x1000c`, native class 4 (listbox), generation 12, process 1000/thread 1, parent `0x1000a`, control ID 1017. Its retained native common-control observation is explicitly `available: false`. The exact reason for unavailable listbox state (for example subclass/state contract) was not established; no weakened class guard or control state was supplied. Capture refused before encoding or allocating a review, and the scope was closed without another runtime endpoint request.

No original wizard PNG, original input, install progress, expanded-space measurement or game scene was obtained. There were zero original guarded-input dispatches and zero overlay records flushed. Ordinary Cancel could not be reviewed after the capture refusal, so filesystem cancellation closed the owned process tree. Native, supervisor and independent watchdog all have actual wait and both pipe EOF receipts; native exit zero here follows external TERM and is **not** an ordinary Quit claim. Browser qualification scopes also have actual Chrome waits/EOF. No box was created (ID/state/expiry/stop receipt: null/NOT_CREATED/null/null).

The authored input calibration's UNKNOWN and the original capture refusal are terminal for their respective scopes. No endpoint replay or deadline extension occurred. The test-only setup experiment using an uninitialized fake callback trapped and was removed; its diagnostic log is retained. A separate compilation-input race was rerun only after shared compiler publication stabilized. Final focused tests pass. Recovery uses Git plus the retained runtime WIP diff, authored fixture source recipe, exact module hashes and the unique existing ISO; no media copy or source-tree snapshot is needed.
