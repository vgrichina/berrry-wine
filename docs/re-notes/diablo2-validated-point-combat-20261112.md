# Diablo II: point controls validated; save-mount staging blocker — 2026-11-12

No new combat, XP, loot, healing, Den quest progress, or qualified checkpoint was earned. Startup terminated before the original game launched because this run's remote staging omitted `restore-manifest.json`. This is an operator staging error, not a Diablo II failure or a production defect. The terminal startup operation was not replayed. No production code changed.

Evidence: `scratch/runs/20261112-diablo2-validated-point-combat-1420/` (R below). Source baseline: `0d1ec9da8416b4577c506d1808292a031147ed57`. See [the qualified XP380 checkpoint](diablo2-current-den-quest-20261112.md) and [the separate heal/death outcome](diablo2-xp380-heal-den-objective-20261112.md).

## Checkpoint preservation

The intended starting fixture was the complete original `20261112-diablo2-current-den-quest-1250-attempt3/earned-save/` set. All four hashes were rechecked after closure and remain unchanged: D2S757 SHA-256 `aeb8be30f2b41580c690eb667603dc36a7de2691df8fab3d215f3b3a2f1cdbb9`, KEY902 `29c7012dd4dca077e162119cc4358acd7369f14ff5c32fac6fc1d20847dfbdc6`, MA07972 `89411738bb0ce6834ab6144fd20cd82a992dd6839dd77ceba3bc49bb68204dd2`, MAP24 `95e612334f4a2b74e6f5c4d300bfd29ddd5c29bc634bb113173c91215d04ae82`.

Read-only decoding still gives XP380, level1, life27.14453125/55, Vitality25, gold3. These are existing fixture observations, not fresh native observations from this run. The preceding death-outcome set remains separate and was neither mounted nor promoted. Its malformed command84 still does not qualify fresh movement.

## Pre-browser controls and exact failure

`action-shapes.cjs` exercised 20 cases through the actual staged `transport.cjs` requester and consumer. Twelve ordinary key forms, four valid `point:[x,y]` click shapes with finite holds, capture, export and quit each produced exactly one validated test-handler effect and the matching successful ACK. The invalid `x/y` click reached consumer validation, failed with `AssertionError: point`, produced **zero handler effects**, and closed that fixture's chain with no replay. These were controller tests, not native browser input. `keyforms.json` retains each result.

The retained-envelope test passed the 21-second delayed ACK, same-operation GET observation after a read timeout, API execution bounds1/600, and UNKNOWN accepted POST without replay. Local and remote staged import checks passed with no effects. `export-seam-test.json` checks the actual read-only expression against the corrected `wine._helpCtx.vfs.files` Map entry schema (`name`/`data`), returning four save files; no live export occurred.

Provisioning verified all521 frozen files. Original media paths and hashes and current main module `04c534192ee3fe39e388536c2ce710c12c47a5cd2ca4d95c19f9d00b1e8f0a17` matched the predecessor (`pin-differences.json` is empty for shared paths). The HTTP proof also fetched the intended four save URLs successfully. However, while adapting the predecessor's helper list, I excluded the run-specific JSON mount manifest from the pin list. The manifest existed locally but was not provisioned remotely. Import-only checks did not read this runtime data dependency.

`webgl/first-browser-failure.json` records `ENOENT` opening R's remote `restore-manifest.json` at `browser.cjs:115`, at14:23:37.935Z. The failure preceded `launcher-mount-request.json`, `shell.launchApp`, readiness, and capture. `failed-start-command-6349.json` records the actual startup operation exit1. The recovered CDP journal contains zero `Input.*` calls. No game was loaded, no fresh game frame existed to review, and no SaveExit/export/normalLoad/movement claim is made. This run supplies no evidence about the earlier SaveExit cause.

## Recovery and normal shutdown

All30 unique remote evidence contents were individually decompressed and SHA-256/size verified; `recovery-map.json`, `recovery-package-pin.json`, `retrieval-verified.json`, and `final-audit.json` retain the chain. Only run outputs were packaged, with no source tree or media archive. Git identity, relevant tracked diffs and `relevant-untracked-source.patch.gz` preserve source recovery. `recover-artifact.py` reconstructs a selected remote artifact from the hash-indexed compressed contents.

The independently prearmed55-minute watchdog was observed alive before allocation. Private box **bx_tzzrrt3w** initially expired **2026-11-12T15:17:11.267Z**. After verified evidence recovery, the delegated normal stop completed at **14:24:11.488Z**: state **archived**, expiry **null**, receipt **stop_d1e223e855c4455c**, completed, forced=false, error=null. No inherited box was touched, resumed or deleted.

Chrome exited0. The remote actual parent waited1 for the staging failure and joined both EOFs; kernel custody reaped149/149 with no remaining, unreaped or unresolved ptrace processes. Provisioning, local manager and independent watchdog actual parent waits all returned0 with both EOFs. The start exec also returned0 after the normal stop. Unlike the predecessor's missing local joins, these actual receipts exist.

Observed local free space was1,607,421,952 bytes before allocation and approximately1.704GB at final audit; sampled checks remained above1.5GB. This is sampled evidence, not a continuous filesystem guarantee. No RAM gate was used.

Next: in a fresh authorized run, explicitly pin and verify the run-specific mount manifest and exercise its parsing against the actual launcher data shape before Chrome. Then use the unchanged original four files, normalLoad/stats/gear/quest/freshmovement, native Akara heal, and short nearby combat with early retreat. Preserve the unfinished Den objective and avoid the known Beast ambush. Do not restart this terminal browser chain or patch production to conceal this staging error.
