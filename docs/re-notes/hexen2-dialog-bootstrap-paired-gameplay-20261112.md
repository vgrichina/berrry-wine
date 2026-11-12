# Hexen II dialog bootstrap and attempted paired gameplay — 2026-11-12

Run: `scratch/runs/20261112-hexen2-dialog-bootstrap-paired-gameplay-0953/`.
This is evidence-only work. No emulator source change, build, or commit was made.
Runtime source is pinned to `8a834a3dc7affc8c6e53245beab56e87a32b81e8`,
with actual guest/render module SHA-256
`04c534192ee3fe39e388536c2ce710c12c47a5cd2ca4d95c19f9d00b1e8f0a17`.
The registered original root `hexen2_demo/glh2.exe` SHA-256 is
`76d96731e3076441e5c70bce2089cd8f36f25b373214f656aa9d5cd8d532e9dd`;
16 original manifest media references are recorded without copying media.
No guest reverse engineering, patches, substituted DLL, config/save changes,
forced calls, or clock freeze were used.

## Outcome and limits

SoftwareGL reached the courtyard, ramp, skull-door contact, and spider chamber.
Native HUD health was 80 in the courtyard, 60 after entering the chamber, and
25 when Escape was requested. A subsequent completed frame confirmed the native
pause menu at 25. Resume showed 23 health and close spider body/legs. A balanced
2,500 ms Control attack produced a completed frame showing an extended punch,
spider legs in the foreground, and **8 health while still alive**. The following
Escape attempt yielded a death frame at 0 with two spiders overhead. This proves
an attack while alive in the native encounter and incoming player damage. It
does **not** prove an enemy hit, enemy health change, kill, or kill-counter change.
See `review/software/{world-wait,contact-followthrough,pause-confirm,combat-resume,early-melee,melee-pause}.png`
and their separate completed capture/state records. A punch pose alone is not
accepted as enemy damage.

WebGL completed its native information dialog and reached the full main menu.
The next Single Player Enter had acknowledged DOWN and UP, but its following
`Page.captureScreenshot` timed out after 20 seconds. The terminal error is
`CDP UNKNOWN Page.captureScreenshot; no replay`, command number 1 at
10:15:03.418Z. No dependent input or replay followed. The preceding menu image
is `review/webgl/notice-dismissed.png`; the post-input state was recovered, but
there is no completed submenu screenshot or current WebGL active-world proof.
This is a concrete capture/helper blocker with an unknown underlying cause.
There is no demonstrated emulator crash or causal emulator defect to fix.
Both-backend gameplay, enemy consequence, parity, audio, FPS, and additional
unique coverage within the existing 27 applications are not claimed.

## Helper repair and offline qualification before allocation

The prerequisite was the prior dialog-before-GL failure recorded by
`parent0943RESULT.md` and `hexen2-current-paired-enemy-progress-20261112.md`.
The run reused the November 7 dialog-aware prefix and changed only run helpers.
Initial ownership now binds the actual app, process, guest Worker, instance,
module, memory/buffer, and native modal window without requiring GL. The complete
painted native information dialog must be reviewed before a trusted balanced
Enter. Only the exact expected first GL birth after dialog completion is allowed.
After binding, renderer endpoint/object, Worker, epochs, module, native windows,
and original process/memory identities remain strict. A legacy D3D WebGL endpoint
is never selected as the GL owner. Unknown post-dispatch outcomes remain terminal.

`native-bootstrap-preflight.json` qualifies `offline-native-5`: an actual generated
native PE calls MessageBox before creating GL, runs through the production browser
and Workers, receives trusted Enter, and then renders GL. Its separately reviewed
`notice-visible.png` contains the complete painted modal. Seven modal and nine
post-binding rejection controls cover wrong process/object, module, memory/buffer,
dialog, and renderer replacement. These negatives inject faults into passive
observations of the actual runtime; they are not independent wrong-process game
executions. The positive is native production runtime, not a DOM simulation.
Actual module-byte mismatch is also rejected.

Earlier fixture attempts are retained and are not silently counted as passes.
Attempts 2/3 mutated live app objects and caused removal of the fixture app;
the negative tests were corrected to affect observations only. Attempt 4's initial
screenshot was blank and its initial review text was inaccurate; its explicit
`review-correction.json` disqualifies that full-dialog qualification. Attempt 5
used a distinct, visibly painted passive frame before Enter. Attempt 4 also
exposed a cleanup leftover and a rejection-message matcher omission. The cause
of profile reappearance was not isolated.

Cleanup now requires actual Chrome exit and exact recorded own PID/profile,
checks `/proc` for matching profile users, waits for drain, and retries bounded
removal only for the confirmed-dead owned profile. The real-child cleanup test
rejects a still-live profile and unjoined process, removes an owned leftover,
and preserves a peer profile. Old fixture profiles were removed only after
recorded own Chrome exits and absent runtime PIDs were confirmed.

`offline-validation.json` checks all 15 planned forms, including positive
`action:"key", keys:[...]`; unsupported `action:"keys"` is rejected. The actual
native fixture includes a trusted balanced Up+Control combo. Stale-capture
regression preserves pre-effect refusal/fresh-capture admission and sticky
post-effect terminal handling. Five focused input/Worker tests passed:
`test-directinput-independent-contract-oct27.js`,
`test-directinput-independent-worker-acquire-oct27.js`,
`test-renderer-initial-input-state.js`, `test-worker-input-event-slots.js`, and
`test-worker-input-slice-wake.js`. No build was required for ignored helper-only
and documentation changes.

## Runtime ownership and provisioning

A joined successful provision process, box-bound short-manifest gate, and all
610 remote hashes passed before either browser launch. `runtime-pins.json`
SHA-256 is `3b41c600c7472d4c2bccc5ee222a24b6feabd2adb54306341bfae3355bed7719`.
Relevant local source differences and run helper patches are preserved; Git is
the source archive. No source tree or media archive was created.

SoftwareGL endpoint 1 on the actual renderer Worker had `api:gl`, backend
software, bridge software context, `softwareConsumer:true`, matching exported
memory, and advancing software presentation/runtime work. Legacy endpoint 2 was
also present and explicitly excluded. Recovered actual module bytes match the
pin. WebGL endpoint 1 had backend webgl and an actual OffscreenCanvas WebGL1
context. Native SystemInfo identified ANGLE SwiftShader (Google Vulkan Subzero),
not a physical Intel GPU; the JavaScript Intel/Mesa strings are spoofed and are
not GPU evidence. No untyped GL probe/export call was made and draw/present
counts are not used as FPS. See recovered `native-system-info.json`, states,
module bytes, and binding records beside the full scenes.

## Evidence and shutdown

`compressed-evidence-manifest.json` maps 287 original artifact references to 226
unique gzip blobs compressed before transfer. All compressed and raw hashes and
sizes were verified locally before shutdown; `check-evidence.py` repeats integrity,
selected runtime, 16 balanced pulse, and lifecycle checks. `evidence-check.json`
records the qualified pass; it does not automate visual enemy-hit acceptance.

Own box `bx_atet8vqv` was created at 10:03:13.697Z with initial expiry
10:58:12.713Z. Its independent observable deadline watchdog was prearmed.
Software controller actual parent wait was 0; WebGL controller actual parent wait
was 1 after the terminal screenshot fault. Both have stdout/stderr EOF, Chrome
exit 0, absent runtime/Chrome PIDs, and successful own-profile cleanup before
final collection. All unique evidence was verified at 10:16:10Z.
Normal stop receipt `stop_a9c95b68b5cad287` completed with `forced:false`, no error;
the box became **archived at 10:16:49.935Z**, current expiry null. The watchdog
observed stop confirmation and exited. The local long launcher exited 143 and
its manager was absent; an actual local manager/watchdog parent-wait result is
unavailable and is not invented. This limitation is recorded separately from
the actual remote runtime joins.

Next work must first isolate/repair completed screenshot observation offline,
then use a newly authorized fresh run for WebGL active-world evidence and an
earlier, shorter balanced attack with a reviewed living enemy. Do not replay
this terminal request or treat the menus as completed paired gameplay.
