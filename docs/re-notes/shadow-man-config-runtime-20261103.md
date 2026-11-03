# Shadow Man original demo: defaults, menu and player-controlled gameplay

On 2026-11-03, the original installed launcher reached ordinary gameplay through
Configuration, unchanged-defaults OK, and the genuinely enabled Spielen button.
Ordinary Up and Right input moved/turned the character in the rendered 3D scene.
The before/after gameplay PNGs, menu/loading screen, intro and configuration
captures were personally reviewed. No production repair was needed in this run.

Evidence is retained in `scratch/runs/20261103-shadow-man-config-recover/`.
`result.json`, `evidence-retrieval-verified.json`, `state-differences.json` and
`retrieved/session.log` record the actual execution. The predecessor's ignored
preparation was reused and preserved; its capacity failure produced no guest.

## Exact inputs

The GL worker's final handoff supplied canonical module SHA256
`24880b0ebdf170b2443d977074bc80f12b3959647dee69114cb09965a70c4741`,
2,079,536 bytes, built from main `bd1a15a25bf2b053e473214e94cfad46dac1e130`.
All 4,129 sealed input files matched the shared checkout before execution;
the compressed source seal is SHA256
`3051e43dd247243e7f3345d69fe17cc572fc0fe2ae372553d9a9eee048f7dcbe`.
Both launcher and child compile/instantiate receipts identify that exact module.
The CLI ran on Node 24.22.1 / V8 13.6.233.17-node.58, without a browser.

All 2,046 restored installed inputs, 177,700,067 bytes, were streamed from the
documented existing snapshot and independently rehashed on the new boat before
the one original VFS clone was made. No installer was replayed. Actual consumed
executable files were separately hashed, including the child's exported input:

| Input | Bytes | SHA256 |
| --- | ---: | --- |
| D3DConfigUtility.exe | 573440 | `850c69cfa4a0d610072a67763d54179bc4cdc58875560ce5ede33bfa44d19fe0` |
| ShadowMan.exe | 1896448 | `4b32868bb30a8ca089483203f8c2b637507f12de4f11f39bf45b1fa41d5f5772` |
| Original registry | 17088 | `d7143f29d29576cd015ec875264028fa70795d0f18de457e31927048081d9de3` |

## Observed route and persistence

The initial launcher had disabled Spielen. Ordinary mouse Configuration at
batch 1423122 opened the original dialog: Primary Display Driver, 640 x 480 x 16,
existing Gamma/Helligkeit settings. Ordinary OK at batch 2318555 executed the
original `0x4022d7` path and wrote all 50 requested bytes to `grafix.cfg`.
The new launcher had an enabled Spielen control.

Configuration reopened at batch 3438140, actually read those 50 bytes, and
showed the same settings. Saved VFS data and the genuine overlay blob both have
SHA256 `0407969d4bf39f2287f8d99bd37feac1212e6492f41038a817f77f39ef79d42d`.
All 74 registry entries remained unchanged, including the final exported store.
This proves the settings file and in-session reopen persistence; no second
independent launcher session or cross-session persistence test was performed.

Reopened OK at batch 5181286 returned to another enabled launcher. Ordinary Play
at batch 5955590 executed `0x4028df` and CreateProcess of the installed
`ShadowMan.Exe`. The trace subsequently reached `0x4022fb`, the continuation
after the nested launcher returns. Captured synchronous depths were zero and
the complete session log contains no ABANDONED marker. A pending nested modal
callback was not treated as failure; complete normal guest shutdown is untested.

The child displayed its copyright and Acclaim screens, then the German
Neues Abenteuer menu/loading screen following ordinary Enter. The opening 3D
sequence rendered with German subtitles. Ordinary Escape and Space were also
sent; no exact cutscene-skip causality is claimed. The subsequent frame shows
the controllable character in the level. Up was held from child batch 116401
to 117676, then Right from 117679 to 118324, through the ordinary renderer.
The guest input log records the corresponding key messages to focus HWND
`0x10001`; the reviewed post-input capture shows changed position/facing.

## Boundaries and recovery

The outcome is a short original menu-to-gameplay/input demonstration. There is
no audio, FPS, Windows parity, browser, long-session, save/load or normal guest
exit qualification. The supervisor stopped the process group after the outcome;
parent OS exit was -9 after SIGTERM handling, not guest ExitProcess. No concrete
runtime blocker was observed in this session.

Two preparation issues were resolved before guest execution: a transient shared
disk-floor breach paused recovery after 1,043 verified members (pending-only
resume completed), and the prepared CLI closure omitted `src/api_table.json`.
The latter failed before any Wasm compilation/instantiation or guest execution;
its log/receipts are retained separately. Adding the unchanged sealed API table
completed the 218-file runtime closure. SCP was rejected by the boat API key;
bounded command-API transfers retrieved the evidence with complete SHA checks.

All 66 archived remote evidence files were retrieved and individually hash
verified, plus the separately downloaded helper-absence record. Own boat
`bx_mftds6qs`, original expiry `2026-11-03T03:41:02.204Z`, was explicitly
delegated to this worker for shutdown. It is verified STOPPED at
`2026-11-03T03:26:46.709Z`, stop error null; scoped live helpers and both control
listeners were absent before shutdown. No historical/foreign boat was altered.

Next work, if assigned, can qualify longer gameplay, audio, save/load and normal
exit from this established route. The old disabled-Play/untested-defaults hold
no longer describes the measured current CLI route. There is no Shadow Man
entry in the candidate corpus manifest, so this evidence stays in the game notes
without being attached to an unrelated corpus candidate.
