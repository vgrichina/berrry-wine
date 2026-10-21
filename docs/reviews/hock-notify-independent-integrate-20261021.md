# Independent placement/startup review — reject integration

Reviewed repair `c4718fb5204a0f4541c1575e84557cfefad6959d` and evidence
`695c9e8d5b71e0ee5d0974c7b1feb660aa111e22` against main
`1d8dbd7a44656178d01869f28869be624a59fa39`. Neither candidate commit is
accepted or integrated. This report branch starts from main, not the rejected
candidate. No production fixes or gate changes were made.

## Blocking correctness defect

The newly added destruction branch in `src/09b-dispatch.wat:477` unconditionally
zeros the saved result at `[ESP+4]` after removing the target cell. The common
CACA0001 continuation then returns this zero. That is appropriate for the
placement failure convention but destroys ShowWindow's entry-visibility result.
`show_window_core` explicitly distinguishes these conventions when constructing
the frame, but the destruction continuation no longer distinguishes them.

Concrete actual guest x86 CALL/RET repro on the candidate:

1. Create a hidden ordinary top-level fixture and select it as the unactivated
   main window. Its wndproc calls DestroyWindow on one chosen activation message.
2. Call `ShowWindow(hwnd, SW_SHOWNOACTIVATE)` (4). Assert return 0, visible host
   window, and no activation/destruction callback.
3. Call `ShowWindow(hwnd, SW_SHOWNORMAL)` (1), without resetting startup state.
4. Destroy the window in WM_ACTIVATEAPP (28), WM_ACTIVATE (6), or WM_SETFOCUS (7).
   All three cases return **0 instead of prior visibility 1**. Target removal,
   caller ESP, EBX/ESI/EDI preservation and released WINDOWPOS depth all verify.

Independent test receipt **cmd_xgrbwaljb2ky** and complete output are in the
accompanying `independent-show-natural.json`. The test exits 1 on an assertion listing all
three actual-zero/expected-one failures, not on compilation, timeout or access.
The initial exploratory fixture is superseded by this natural two-call route.

Four rejecting-test controls pass first: hidden/visible entry states crossed
with activation pending/already complete return 0/1 respectively, with caller
stack and nonvolatile registers restored. Thus the failure is specific to the
new callback-destruction completion, not general fixture or stdcall failure.
The fixture extends the candidate's actual guest harness and does not mutate
production source. Replay with the exact command stored alongside it.

## Independent source and evidence review

The actual patch snapshots showCmd and normal coordinates before
`set_window_pos_core`, uses flags 0x14, and revalidates target liveness before
showing. The prior CLIENT_RECT recalculation and host synchronization now run
through the existing transaction. The startup frame retains its HWND across
activation continuations and obtains the final size from current client state.
The census changes cover the extracted show core, new destruction redirect,
retained-target reads and Peek size payload; its unchanged boundary count is
not proof that these lifetimes are correct. The return-value defect prevents
accepting the census update with this repair.

Fresh independent checks matched all **7,134** candidate source manifest entries
to the committed Git blobs and to files on the assigned runtime. All **44**
intake entries (39 game files plus provenance) and both runtime module hashes
match their recorded seals. Canonical module SHA256:
`c62213f22cadd127bdd2dfd4f624d690b2814c18d5fcec7a3442080120f8d0c4`.
The preserved canonical build log ends successfully, including the data overlap
gate. No full build, packaging or original-game replay was repeated.

The committed archive itself matches Git blob
`bcff91858d74c8e235f2846833a47e92adb8a2f0`, but its internal SHA256SUMS manifest
has **two mismatches out of 40 entries**: `controls.json` and
`related-tests.json`. Exact expected/actual hashes are in `provenance-local.json`.
The remaining 38 entries match. This independently contradicts blanket
40-file seal acceptance; the archive must be reconciled before reuse as fully
sealed evidence. No manifest was rewritten during this review.

Visually inspected baseline and candidate final captures extracted from the
committed archive: baseline timer clipped at the right edge; candidate shows
the complete timer (86) and score 0/20. These captures' seals match. This is
evidence of the HUD improvement, not acceptance of the API repair or Windows
parity. Hits/scoring, completion, audio quality/sync and FPS remain unqualified.

## Stop and handoff

Per the bounded task's defect stop rule, further acceptance tests of target
replacement, implicit creation/dialog paths, nested placement ordering and
startup payload variants were not run after confirming the blocker. Their
implementer results are not promoted to independent passes. No broad fix,
workers, refill, deployment, shared configuration or unrelated WIP changes.

Evidence: sibling `hock-notify-independent-integrate-20261021-evidence/` and
`scratch/runs/20261021-hock-notify-independent-integrate/`. Remote repro:
`/home/user/hock-notify-independent-integrate` on **bx_3f3x23m3**, running
(API state idle, health ok), expiry **2026-10-21T05:56:19.894Z**. Lifecycle
remains coordinator-owned; no stop/snapshot/resume/new/fork action was taken.
Publication receipt records the report commit, verified task/main refs and
allocation. Main retains the existing CLIENT_RECT repair unchanged.
