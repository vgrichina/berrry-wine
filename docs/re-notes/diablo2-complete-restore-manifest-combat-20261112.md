# Diablo II: complete restore staging verified; title Escape exits guest

2026-11-12. The actual restore-manifest staging dependency is corrected and tested. The original game launched with all four qualified XP380 save files mounted. No character Load, healing, combat, Den progress, or new qualified save was achieved: my Escape input at the title/logo screen was followed by native `ExitProcess(0)`. The subsequent capture correctly refused an absent app. This terminal chain was not replayed. Neither the preceding missing-manifest operator error nor this startup-navigation outcome establishes an emulator defect.

Evidence: `scratch/runs/20261112-diablo2-complete-restore-manifest-combat-1435/` (R). Baseline Git SHA `0d664d40d9e89217dba942968e5c6fa959a678bf`. No production source, media, configuration, guest state, XP, health, quest, map, or clock was patched; no forced guest calls were made. See [the staging-error handoff](diablo2-validated-point-combat-20261112.md), [qualified XP380 checkpoint](diablo2-current-den-quest-20261112.md), and [separate death outcome](diablo2-xp380-heal-den-objective-20261112.md).

## Complete startup data dependency

The new run's `runtime-pins.json` contains **523 files**: the predecessor's complete frozen closure with current main module `04c534192ee3fe39e388536c2ce710c12c47a5cd2ca4d95c19f9d00b1e8f0a17`, adapted run helpers, plus the previously omitted `restore-manifest.json` and the new run-only startup reader. `pin-differences.json` is empty for shared paths; no original media/runtime pin changed.

`startup-data.cjs` reads the pinned manifest, parses its actual `url`/`vfsPath` array, requires exactly four entries, and reads and verifies the size/SHA-256 of every referenced file against the same pins. The emitted `browser.cjs` calls this reader synchronously **before creating the output directory, HTTP server, Chrome, or CDP/input connection**. Its returned array is the exact array later supplied to the ordinary launcher; no second manifest read or alternate mount shape substitutes for it.

`data-seam-test.py` executes that emitted browser entry through its data-only switch against a physical stage. Complete staging succeeds; removing the manifest fails with ENOENT; restoring it and removing the referenced D2S fails with ENOENT. Browser process and WebSocket effects are trapped; every case has zero browser/input effects. `startup-data-controls.json` retains stdout, stderr, status, and counts. The remote startup operation independently ran the same emitted data-read seam before browser creation: recovered `staged-data-verified.json` passed and names all four mounts. Both initial remote verification and final recovery verification passed all523 pins. HTTP resolver proofs and `launcher-mount-request.json` / `launcher-mount-result.json` confirm actual staging and mounting.

All20 actual requester/consumer action-shape controls were rerun: twelve keys, four finite `point:[x,y]` clicks, capture/export/quit, and invalid `x/y` with zero effects and terminal refusal. Staged imports, corrected `wine._helpCtx.vfs.files` Map export expression, 21-second ACK, same-operation observation following read timeout, separate API1/600 limits, and unknown accepted POST without replay passed. These controls are not native gameplay.

The unchanged whole starting set is `20261112-diablo2-current-den-quest-1250-attempt3/earned-save/`. Final audit rechecked all four original files:

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| samehero.d2s | 757 | aeb8be30f2b41580c690eb667603dc36a7de2691df8fab3d215f3b3a2f1cdbb9 |
| samehero.key | 902 | 29c7012dd4dca077e162119cc4358acd7369f14ff5c32fac6fc1d20847dfbdc6 |
| samehero.ma0 | 7972 | 89411738bb0ce6834ab6144fd20cd82a992dd6839dd77ceba3bc49bb68204dd2 |
| samehero.map | 24 | 95e612334f4a2b74e6f5c4d300bfd29ddd5c29bc634bb113173c91215d04ae82 |

Read-only decoding reports existing XP380, level1, life27.14453125/55, Vitality25, gold3. These are fixture values, not fresh native stats. The death-outcome files were neither mounted nor promoted.

## Precise new terminal outcome

Fresh full `startup.png` at14:46:30Z showed startup loading; fresh full `titlewait.png` at14:46:52.996Z showed the original Diablo II logo/copyright scene without visible menu buttons. Both were retrieved, hash/PNG validated, and visually reviewed. I assumed Escape would dismiss this scene and sent `titlemenu` with a finite200ms hold. That assumption was wrong for this attempt.

`input-titlemenu-pulse.json` proves acknowledged DOWN at14:47:05.005Z and UP at14:47:05.189Z; the recovered CDP journal has exactly those two input sends. This was **not** a pre-input rejection. The console records native `ExitProcess` code0 at14:47:06.075Z, and `titlemenu-state.json` has `apps:[]`. The attempted subsequent bound capture failed at14:47:06.996Z with `one isolated registered app required`; ACK1 failed and the browser chain became terminal. API command11917 then exited1 with `runtime first fault`, preserved in `failed-command-11917-actual.json`. No later input or restart occurred. The cancellation helper was itself refused locally by sticky caller failure and sent no cancellation effect.

Two passive `FIRST_NATIVE_PRE_DETACH` records from distinct workers were retained in `pre-detach-events.json` and the console. They occur during this title exit, with zero-filled buffer observations; they are not evidence of a SaveExit recurrence, ownership cause, or repair. No JavaScript exception log was emitted. The evidence establishes the observed exit after Escape; it does not establish why that scene handled Escape this way.

Next native attempt: use the same corrected complete staging and unchanged four-file checkpoint; wait for and freshly review an actual menu before selecting Single Player, rather than assuming Escape dismisses the logo. Then normalLoad/stats/gear/quest/freshmovement, native Akara healing, short ordinary combat with early retreat, and whole SaveExit/export/normalLoad/freshmovement remain required. The Den remains uncleared. A fresh attempt also needs restored disk headroom: shared free space was down to approximately1.507GB by documentation, with other active native workers reporting the same pressure.

## Recovery and lifecycle

All59 remote output references /55 unique compressed contents were retrieved and individually SHA-256/size verified. Both full PNGs passed CRC/image decoding. `recovery-map.json`, `recovery-package-pin.json`, `retrieval-verified.json`, `final-runtime-verified.json`, and `final-audit.json` retain the proof. `recover-artifact.py` reconstructs a selected output. Exact Git identity, relevant tracked binary diff and owned helper patches preserve source recovery; no source tree or repeated media archive was made.

Private box **bx_y6mtraae** had an independently prearmed, observed-alive120-minute watchdog and initial expiry **2026-11-12T16:38:52.885Z**; browser cap was85minutes, separate from API execution limits. After verified recovery, normal stop completed **14:47:53.334Z**: state **archived**, expiry **null**, receipt **stop_e5056f540e36ae65**, completed, forced=false, error=null. No inherited box was touched, resumed, or deleted.

Chrome exited0. The remote actual parent waited1 for the terminal capture refusal and joined both output EOFs. Kernel custody reaped168/168, with no remaining, unreaped, or unresolved ptrace processes. Provisioning, local manager, and watchdog actual parent waits returned0 with both EOFs; the local start exec also returned0. Allocation and browser startup occurred above actual1.5GB free; periodic run samples stayed above the floor (minimum1,524,948,992B through shutdown). Later shared disk growth reduced headroom further. No RAM gate was used.

Publication is documentation only. Focused startup-data,20-shape, import, envelope, export, recovery, and lifecycle checks passed; no production-code build was required.
