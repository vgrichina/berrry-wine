# TR2 startup presentation repair — 2026-11-08

The production single-app maximizer could raise the blank main window over
the startup property sheet. It now waits while this instance has a visible
dialog. A small actual Chrome fixture reproduces the covering behavior with
the selected renderer and shows the dialog remaining visible after the guard.
No original, game, remote allocation or input ran in this preparation.

Evidence is `scratch/runs/20261108-tr2-startup-presentation-1750/` (R).
`source-head.txt`, `relevant.diff`, and the small owned new-file/helper patches
record recovery inputs. Git is the source archive. Existing media remain at
their selected paths/hashes; no source archive, media copy or peer WIP is used.

## Concrete difference and causal path

Both originals requested the same startup route, apart from the HTTP port:
`index.html?debug&threads&app=tomb_raider_2_demo&gl-renderer=webgl&d3d-renderer=webgl`.
The normal drivers differ only in observer activation inside the later Control
hold. That code was never reached in 1743. Selected CPU bytes and startup
page/renderer/shell bytes are unchanged between the two originals.

1717's actual shell console reports `single-app=false`, viewport 945×889,
screen 1920×1080. Its reviewed startup shows the full desktop and readable
Graphics options/OK. 1743 reports `single-app=true`, viewport 780×437,
screen 800×600, coarse pointer false. Its startup log additionally records
`Single-app mode: maximized hwnd=0x10001 400x300`, absent from 1717.
The headless browser version/launch environment differs as well. Neither
viewport size nor its appended SwiftShader flags alone diagnoses the pixels.

The causal code is `maximizeForSingleApp` in `lib/browser-shell.js`. Its 50 ms
timer already detects visible dialogs and avoids charging those ticks against
its wait limit, but previously continued to select the blank main window and
send `WM_SYSCOMMAND/SC_MAXIMIZE`. Host `sys_command` routes that through
`renderer.showWindow(hwnd, 3)`, which expands and raises the main window.
Owner grouping cannot protect an unowned property sheet. Read-only disassembly
of the existing exact `TOMB2.EXE` confirms the original constructs a zeroed
40-byte PROPSHEETHEADER at stack offset `esp+0xc`, leaves its `hwndParent`
field at `esp+0x14` zero, and passes that header to PropertySheetA at 0x452993
(IAT 0x463018). The relevant 0x452800–0x452998 instructions are retained in
`original-property-header-disassembly.txt`. This is static inspection, not
guest execution. 1743's inspection also records visible Graphics child
65545 under top-level root 65538. Its `parentHwnd:0` alone would not establish
the Win32 owner, which is why the executable's header construction matters.
A dialog can therefore remain live and painted while
the newly raised gray main covers it. A failure-free CPU at yield 7 is fully
compatible with that presentation failure.

The production change returns from that timer tick while a dialog is visible,
after the existing app-exit and exclusive-display cancellation checks. Once
the dialog closes, ordinary maximization still occurs once. There are no new
guest calls, timers, callback owners or restoration paths. The existing timer
retains the same wine/renderer references and cancels on app exit or exclusive
display takeover. The callback ownership census host-file hash was reviewed
and updated; broader invocation ownership remains pending.

This is a tested causal stacking defect matching the measured startup path.
The failed original did **not** retain numeric z-order or per-window backing
pixels, so its final stack cannot be independently reconstructed. The authored
counterfactual fixture is not a rerun or proof that the repaired original has
started successfully. The next separately assigned original must review its
actual dialog before ordinary Graphics Enter; no blind input is authorized.

## Focused validation and selected closure

`node tools/tr2-startup-presentation.test.cjs` exercises the actual production
timer body: 130 ticks with a live startup dialog send no maximize, then dialog
closure permits one ordinary maximize. The old body fails that regression.
Existing single-app mode, keepAspect and callback-census mutation tests pass.
The regression also checks app-exit and exclusive-display cancellation while
waiting, and that a different instance's dialog cannot block this instance.

The same test's optional `--chrome R/fixture-final` uses pinned production
surface/renderer/input sources read directly from Git, the actual shell timer
body, and authored completed GDI surfaces. It loads no PE or CPU module and
creates no D3D context. Both cases keep identical canvas geometry and Chrome
arguments. Before: root main 65537 becomes topmost, the live dialog is covered,
and its OK pixel reads opaque gray `[192,192,192,255]`. After: dialog 65538
remains topmost and its OK pixel reads `[0,128,0,255]`. Personally reviewed
`fixture-final/before.png` and `after.png` agree. This local Chrome viewport
is 945×945, not the failed original's viewport; the counterfactual isolates
stacking without requiring a viewport or GPU change. An initial fixture
attempt named a nonexistent menu script, failed before painting, and closed
Chrome with exit 0; that receipt is retained.

The locked full build result is retained in `build-final-reviewed.log`. The initial
build stopped at the required callback-census review lock, before compilation.

`R/runtime-pins.json` is the explicit successor selection: **615 providers /
29 normal physical helpers**, relocated with only owned run-path changes.
Its predecessor is the immutable coverage-1733 manifest SHA-256
`4cbcaf21b0ac26d969016af0ea8bf97a0e4a9df2465cafcc5ab5cb28f13505b0`.
Only `lib/browser-shell.js` changes among 586 non-helper providers; the other
585 remain exact. CPU remains
`d8facd0658b7f158c6e60bef2de0936471f438f8bf41e9240fd75635f1d319dc`.
Observer repair `8579c29a2`, its 32 tests, independent release behavior and
immutable stop/no-replay rules remain unchanged. The 85 unchanged coverage
references / 446,299 bytes were independently rehashed and reused. Historical
614, predecessor 615 and selected coverage manifests were not edited.

The exact resolver checks every provider hash and the normal 29-helper closure.
The actual driver preloader passes all 615 hashes and exits before Chrome or
original launch. Full27, parity, audio, FPS, qualified original poll/Action and
after-release consequence remain open. No backend, binding, input, clock,
seed, private guest state or observer quota changed.

## Closed local lifecycle and next step

Each small local Chrome fixture ran under `/tmp/wine-runtime.lock` with an
observable independent 90-second timeout watchdog, armed before launch.
Both browsers exited 0 with no signal, and their browser/watchdog PIDs are
absent. No runtime remains. Free /home stayed above 1.5 GB; no RAM gate was
used. Box ID/state/expiry/stop receipt: **not applicable; no box created**.

Next is one separately assigned original using the explicit successor
selection and unchanged normal lifecycle/release rules. It must establish
reviewed startup GDI pixels first. Owning D3D/WebGL2 authority and non-null
initial raw/ARM are later, separate gates; prior Intel evidence cannot certify
the fresh environment. This preparation worker releases its files and stops.
