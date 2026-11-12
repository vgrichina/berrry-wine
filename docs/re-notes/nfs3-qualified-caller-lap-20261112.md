# Original NFS3: bounded native road attempt, 2026-11-12

This attempt reached the first winding-road approach in the original game, but did not prove successive corners, a checkpoint, lap transition, or race result. It is not a fully qualified driving acceptance: the new caller recorded a null CPU epoch, and the local manager wrapper's actual manager-wait receipt is missing. No runtime fix was made.

Evidence is in `scratch/runs/20261112-nfs3-qualified-caller-lap-1740-fresh/` (R2). The earlier `scratch/runs/20261112-nfs3-qualified-caller-lap-1740/` (R1) ended before original-game launch because a new page-state expression called the result of `Array.map` as a function. That helper error was corrected and tested before the second allocation; no failed native command was replayed.

## Exact reuse and startup

The full [1725 observer report](nfs3-real-worker-observer-repair-20261112.md) at `1fea921dc527e9f1a5445c95c080a00790fee463` and [paired-driving note](nfs3-current-paired-driving-20261112.md) were read. `reused-proofs.json` records the exact predecessor helper, import/data, release, capture, passivity, and terminal-control proof hashes. Its final `runtime-pins-v2.json` SHA is `3380c1cbddc627f798888061d8d36509c5bbe3de564e74bea1f875c9e1becc47`. The unchanged expensive control matrix and build were not rerun.

All new runtime helpers were completed before the final local pin/import/data gate and allocation. The R2 manifest SHA is `d4d8013228b06a304f7fc5cb7cf7b7c218b2c14e7ed64490e2bed4d8ab31506a`: 607 pins, all verified again remotely after shutdown. The remote prelaunch gate covered 609 files including manifest/deadline, and the actual staged import check passed. Source recovery uses exact Git SHA plus relevant binary patches and new-helper patches, without a source-tree or media archive.

Original EXE SHA is `0defab3eeb22ee4b6e0007a4d5b26a99d868008ba77e2b9bd3ef770e924548ad`, with all 133 media files pinned. Native catalogue/setup/reload/chooser selected Software and Direct3D1, then native warning/setup confirmation and reload launched the original once. No easiest/Single Race selector was offered on that route; the game entered Hot Pursuit without mode/weather/RNG/config overrides.

Actual main CPU target was `1336866A5C7C469C2A8E4929A0DA5DDF`, endpoint 1, slot 0. The actual Software renderer target was `F691A576D29C1AD6923BCBB9FCFD9B1E`, endpoint 1, generation 1, with positive completed software draws. Both captured the 2,189,863-byte current04 module SHA `04c534192ee3fe39e388536c2ce710c12c47a5cd2ca4d95c19f9d00b1e8f0a17`; this is actual owner/module evidence, not dropdown inference.

The qualified read-only timer observer remained active. `timer-analysis.json` finds 1,198 retained main-worker rows, zero cumulative main-worker drops, paired timer API entries/returns, and no observed abort branch. Other worker rings did overflow; no all-worker losslessness claim is made. The old INITTIMER abort did not recur and its cause remains **UNKNOWN**, not fixed.

## Purposeful driving and specific limit

Fresh complete 1024×712 PNGs were individually retrieved and reviewed before the next independent input. `live-review/software/` retains the full frames and state, including `race-ready`, `drive01` through `drive17`, `recovery01`, `recovery-followup`, and `brake-stop`. Input receipts and command ACKs are under `recovered/software/`. Final `evidence-check.json` verified 35 full PNGs (PNG CRCs and complete decoded dimensions), 35 command ACKs, 20 key commands and 46 trusted key edges, release/physical-state checks, captured modules, and recovered hashes. Its explicit missing-epoch/missing-manager-wait flags remain true; its consistency pass does not qualify those absent proofs.

There were 17 acceleration/steering commands, one native R recovery, and one Down braking command. Initial Up holds moved past the house toward the winding bend. Short Right/Left corrections first rejoined the road and then overrotated across it. The R frame was reviewed, followed by a separate fresh capture before any next input; that followup restored the cockpit aligned with the road. The screen also said “Mulligan arrested”; this is not attributed to R and is not a player finish/result proof. Later straight acceleration reached the crest/winding-road sign, but the final `drive17` frame still reads 1/1 Laps and 10 MPH. No successive-corner claim follows from the minimap or elapsed timer.

The first concrete caller limitation is its 2,000 ms hold cap combined with separate review/command intervals: the bounded route repeatedly lost speed rather than sustaining onward traversal. The cause of the low acceleration/coasting was not isolated; this does not prove a runtime physics or throttle bug. Independently, the guessed `_workerRunEpoch`/`_workerEpoch` fields were null. Stable page WeakMap object identities, module hashes, and renderer generation do not replace the requested full CPU/module/instance/epoch binding. The helper should have reused the established private epoch and full owner binding before launch. This run must not be promoted as that qualification.

The key helper prearmed an independent release deadline before DOWN. It recorded trusted independent DOWN/UP and physical state checks; offline controls exercised single key/chord/R, slow sampling, UNKNOWN DOWN, partial chord, and rejected keys. A separate Escape was used only to reach the quit menu. Two native quit-button clicks left the menu visible; no guest ExitProcess success is claimed. Normal Browser.close then ended Chrome and the runtime controller with actual parent waits 0 and both EOFs, removed the profile, and left owner/controller/Chrome PIDs absent and server port closed.

## Recovery and lifecycle

Files API HTTP 500 interrupted recovery around 18:02 UTC. Runtime actions had already ended. A later failed read-only box GET created `custody-terminal.json`; it is explicitly a GET failure, not an UNKNOWN native command. When service recovered, 277 unique run files and 104 provider-log paths passed independent double-download/hash checks before normal stop. The complete raw timer trace SHA is `d9cb66b3671ad54d7479c50b156a7c9a08af85edb61622b1f2ac609998005dc6` (206,421,597 bytes); it is retained losslessly as `recovered/software/timer-drains.jsonl.xz`, with exact raw/gzip/stored hashes in `local-trace-lossless-pack.json`.

Both fresh boxes had independently observed private two-hour watchdogs armed before allocation. Final states:

| Box | Final state / expiry | Normal stop receipt |
| --- | --- | --- |
| R1 `bx_xsr6bv45` | archived; `archiveAfter: null` | `stop_a4ba69859f7454ed`, completed 17:44:44.172Z, forced false, error null |
| R2 `bx_q8gsnrgh` | archived; `archiveAfter: null` | `stop_244127460e249525`, completed 18:10:07.586Z, forced false, error null |

R2's initial expiry was 19:45:22.580Z. Its manager recorded the watchdog's actual wait 0 and both EOFs. The local wrapper tool session instead ended 143 without `manager-parent-wait.json`; the manager PID is absent, but its exit code and wrapper EOFs cannot be inferred. This missing join is explicit in `manager-wrapper-terminal-observation.json`. R1 manager/watchdog actual waits were 0 with EOFs.

Actual `/home` free space was the only resource gate. A floor breach before driving paused native actions; non-force uv cache cleanup restored it. After runtime shutdown, evidence recovery briefly crossed the floor again. Lossless trace packing restored space above 1.5 GB. An owned ignored `build/combined.wat` cache was also removed under the build lock only after byte-for-byte reconstruction and SHA verification; regenerate with `node tools/concat-wat.js` (`generated-cache-cleanup.json`). No compiled runtime, source, game media, existing archives, or another worker's evidence was removed.

Next work is to qualify a caller with the established full private owner/epoch binding and a reviewed sustainable native-input schedule before another original allocation. Reuse the existing observer/import/control proofs by exact hash. A subsequent attempt should turn through successive bends or show native lap/result text; this run supplies a bounded road attempt and concrete caller limitations, not startup-only success or a runtime repair.
