# JezzBall and Invisible War backlog audit — 15 October 2026

Source-only reconciliation against `5a31fcce8055e8385dba8ed76f6457767143068b`.
Remote main was subsequently verified at `5f43d41f54950151f08ad7cab3b536d9ed150bbd`;
the intervening six files concern CMR3 registration and color-key documentation,
so none changes these findings. No build, guest, browser, device, or remote
sandbox was run. Shared TODOS/STATUS and shared index were not edited.

Both JezzBall crash rows remain done. Invisible War remains held: the named
lookup, process-lifetime, alias, transport, and rendering candidates are still
outside main, with no patch-equivalent cherry-pick found. Historical gameplay
on the held combined source is not current-main qualification.

| Task | Current disposition and exact next step |
| --- | --- |
| USER-JEZZBALL-WORKER-CRASH-20261011 | Keep done. Main contains `e81aac2801bde8c73b213df215113264624687cb`, `e2a063597bb987f6d092ca7e7724f5f6ea605a06`, and `e6e45005446b18523bc8f3db798a48d5114b1765`. No implementation or repeat runtime needed. The existing board/ledger records real-handler Threads game-over/high-score close, Yes/No and F2 restart in Chromium and WebKit; this audit does not newly verify those raw captures or a physical device. |
| TG57-JEZZBALL-LEVEL-TRANSITION-20261013 | Keep done; normalize its `[~]` marker to `[x]` if maintaining checkbox consistency. `a6bff043a76ae3fb580137afcaaff9dc788b3136` is an ancestor, and main retains invocation-owned modal owner disable/restore and invalid/stale HWND destruction guards. Main RE notes record one completion popup, one Next Level producing three balls/lives and 0% area, then a trusted wall raising area to 3%. Later frame geometry/owner-relative placement work is also in main; its post-placement completion capture and native completion comparison remain unverified, separate from the fixed duplicate-dialog/exit bug. |
| CROSS-PROCESS-FINDWINDOW-IW-20261010 | Keep blocked for selective source review; replace obsolete main0304/storage238MB language. Review the existing lookup and independent-child-lifetime candidates listed below against current local Z-order semantics before integration. Do not rebuild their implementation from scratch. The old 0955Z launcher progress is historical candidate evidence. CLI IPC remains absent. |
| IW-DUPLICATE-PROCESS-HANDLE-20261011 | Keep blocked for transport correctness/integration. Alias success alone did not remove the 122587 ms wait; historical 1157Z combined transport returned WM_USER(alias `0xe60001`) = 1 in 121 ms and spawned the level 3822 ms after exit. Next source/test work is independent cyclic-send ownership and thread-specific receiver admission, not another uninstrumented game wait. Include the existing failure-propagation follow-up in review; it is not integrated. |
| NEW-GAME-DEUSEX-IW-DEMO-20261010 | Keep blocked: historical held-source movement evidence documented, main integration/transport correctness and reproducible local-only registration pending. Review the two small independent render candidates separately, with current color-key/discard state interactions, before rebasing/running the existing WebGL1/2 stencil/RGB regression. Do not label retained 1.80 GPU publications/s as logical gameplay FPS, or claim audio/combat/device qualification. |

The storage block is stale: this audit measured 2,588,237,824 available bytes
locally, above the 2 GiB floor. This does not grant runtime concurrency; the
sole runtime is owned by the separate kkrieger lane.

## Exact unmerged source and checks

`git merge-base --is-ancestor <commit> <pinned-main>` returns 1 for each
candidate below. `git cherry <pinned-main> <candidate>` marks each `+`, not
patch-equivalent `-`. This is stronger than testing ancestry alone; it is not
a guarantee that later unrelated code could not implement similar semantics.
Direct current-source inspection confirms the relevant missing paths.

| Candidate | Scope |
| --- | --- |
| `9ef79f697f5145a11e719f11f2f304c3757e7847` | Desktop window lookup helper |
| `692c9c43cde04b584fcae5ec247937512d3b53c6` | FindWindow shared desktop connection |
| `c27e6776b73b68b10660416e736d8ab7ad5264d9` | Two-instance/Worker lookup regression |
| `058abc3703bf779665f3c56d08faf4166a2c7f2a` | Children survive parent termination |
| `340d5bf778f07588e549d7abf3acc180803f8834` | Browser lifetime regression |
| `eeef32f9091b1bff7ad64d163f09a8822c0914bd` | Target-owned process aliases |
| `7973eee2a4502f9d639d90b3d6f1d0ea3bd61c69` | Broker deferred ownership/nested chains |
| `db7a1a57e61eb10b69037ed8a69e41f5f18ae87a` | Held Worker process-send wiring |
| `e4510f1a9256036967e9c391c57d3f0df6bcc61a` | Foreign callback failure propagation |
| `7b89c446c0b1a81ec88b271282cec70d78a25138` | Colorless stencil-pass linkage |
| `1d5243e237ddb27837ee4a3c1c0aa281006468ec` | Dead diffuse alpha in independent RGB-only stages |

Main `src/09a-handlers1-user.wat` FindWindowA still calls the local
`find_window_core`/window-table Z-order walk. Main `host.js` still registers
`_stopChildren` to stop live children and uses child records in `process_ctl`;
the candidate `_processAliases`/`_duplicateProcessHandle` path is absent.
`lib/process-send-broker.js` is absent from main. Main `lib/d3d9-backend.js`
does not have the candidates' colorless specialization or independentArgs/
sourceAlphaBlend dead-alpha elimination. No merged equivalent was identified.

The held broker registers one endpoint/stack per PID. Its `canEnter` rejects
a request whose chain differs from the current owner, allowing only active
descendants. That solves nested same-chain ownership but leaves independent
cyclic waits held, and serializes unrelated receiver threads process-wide.
The next focused regression should start independent sends in opposite
directions, require progress without entering overlapping frames on one
receiver thread, and separately show that two distinct receiver threads can
progress. Design thread-owned admission/wait reentrancy before changing the
gate; simply removing ownership would reintroduce overlapping callbacks.
Retain retirement, deferred readiness, nested LRESULT/stack restoration and
failure-path tests. No test in this paragraph was run during this audit.

The ledger's failure-collapse warning needs precision: `e4510f1a9` already
contains a held correction and documented two-Worker UD2/transport/disappeared-
window regressions. It remains `+`/unmerged, so it does not clear the main
integration hold. Do not repeat that fix. General pointer-message marshalling
and cooperative transport remain unsupported; successful scalar WM_USER does
not settle those contracts or the independent-cycle defect.

## Retained evidence versus unavailable raw artifacts

Durable historical IW narrative is recoverable exactly with
`git show 09258c84368517e437e8b47b1a203789f25fc9ea:docs/re-notes/deus-ex-invisible-war-demo.md`.
Main's copy ends at the 10 October Reset investigation, so it must not be
mistaken for the latest held-branch findings. The held narrative identifies
`20261011T1157Z-iw-send-runtime-original`, failure propagation
`20261011T1216Z-process-send-failures`, and scene/movement captures
`20261011T1345Z-iw-rgb-game` / `20261011T1357Z-iw-focused-input`.
The latter describes click, W, Escape tutorial dismissal, then W six seconds
changing the corridor to the grating with HUD retained. HWND0 keyboard logging
alone is not evidence of broken delivery.

Those named IW run directories are absent from this host's current
`scratch/runs`, as are `20261011T1130Z-jezzball-worker-close-d10ba697` and
`20261013T1225Z-jezzball-level-final`. Earlier statements that they were copied
locally describe the historical session, not this recovered workspace. This
audit did not hash or visually re-review missing raw evidence. Recover exact
bundles from an existing retained backup if a fresh evidence review is needed;
do not recreate a result.json implying the originals are present.

Later local JezzBall folders are present: `20261013-jezz-next-level` (108
files), `20261013-jezz-v86-dialog-compare` (14), dialog geometry before/after
(3/8), and `20261013-jezz-fps-measurement` (6). Counts are inventory only,
not reviewed gameplay, device parity, or hash verification. Main's RE note
reports 301 GDI publications/15 seconds against the game's 50 ms timer,
explicitly not a quiet-host benchmark; Safari/v86 cadence remains unmeasured.

Validation for this audit: commit ancestry, patch-equivalence classification,
direct source inspection, local run-directory inventory, remote main receipt,
and `git diff --check`. No rejected diagnostic was retried, delegated or
rephrased. No gameplay or deployment conclusion was added.
