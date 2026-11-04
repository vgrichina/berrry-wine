# Original MDK2 native selection boundary, 2026-11-04

The run-only selection helper now checks original Lua callback completion, applied control scheme, and native Enter release consumption. It waits for the original selection callback result before releasing its single Enter, then for native release consumption. The corrected v2 passes 117 focused tests. **Native New Game/Medium activation remains unverified live; the opening comic was not reached and no comic Escape was sent.** The single browser stopped at the first candidate gate error, before Enter; there was no replacement browser, reload, or live helper retry. No production runtime files changed.

Evidence is in `scratch/runs/20261104-mdk2-native-selection-boundary/` (ignored). `native-readiness.cjs`, `native-menu.cjs`, `browser-driver.cjs`, their tests, and `owned-new-files.patch` preserve the final helper correction. `browser-tested-helpers.patch` and its hash manifest separately preserve the v1 bytes actually used in the browser. These versions must not be conflated.

## Original sources and comparison

Execution used original Git `1329b1ba6eb00144ff77d4cd92a8513d4fc953ad`, all 432 pinned files intact, canonical module `cffca869b541e6eff12ae3a6b74c4476977e0a7e23cd43d8ec5ba8faecd4bcee`, companion `580f49f3c78d26e6855efa0beb37046d03ea24690ff98cfcb3e94ce5e6cb1ee3`. The existing runtime and Puppeteer 24.31.0 lock on `bx_85fyu4ug` were reused without install or restaging. Fixed `/proc` identity checks, actual Puppeteer import, isolated registered MDK2/WebGL, and actual HTTP module hashes passed before Chrome (`preflight.log`, `prebrowser-result.json`).

`original-selection-references.json` records selected decoded script lines and full hashes from existing `test/binaries/candidates/mdk2-demo/installed/mdk2demo/data/scripts.zip`, SHA-256 `cfdae6e7d02b1823a59d0b85aa8eaca2f057dbb27e7b86d9a7199fc069f642d8`. `inspect-original.cjs` decodes in memory and checks predecessor hashes. No media or source archive was created.

* `level0.lua`, decoded SHA-256 `f5166d801b6aaf2d0c5cee17bc5d5b615b46f1b76c21641a70c89930b1871175`: line 120 sets `Level.freeze = 1`; `ButtonOnTimer` starts OPEN at 452. `ButtonOnAnimLoop` at 441–446 enables the button and sets its message **before** its final `Level.freeze = nil`. `Level.Select` at 223 requires nil freeze. Its selected-zero branch at 245–248 switches to difficulty, shows the menu, requests the menu control scheme, and highlights Medium. Readable pixels alone cannot prove the last callback assignment executed.
* `menuinit.lua`, decoded SHA-256 `7dd82e7ddba774da6b318acac7fc14a6603aaf8d83e34d4618ea7fe7d5bd2398`: lines 21–25 apply `newconscheme` and clear it. Menu select uses a rising edge; Escape uses a falling edge.
* `menu.lua`, decoded SHA-256 `8ed69d83201f71940ff89e562dc44130a3b3d153ff7318ae1f3e6fa1d09b3a27`: Medium sets difficulty at 1061–1064; Go at 1079–1089 hides the menu, sets freeze, and starts its timer/closing work. These callback effects distinguish native selection from browser delivery.

The failed `20f44b0af` history shows readable highlighted New Game at 3248 and an acknowledged Enter, but main menu at 3296. The successful `5a6307e99` history selected New Game at 3280 and inspected Medium at 3328 using the same original pins. I inspected both historical captures. `historical-references.json` identifies their existing paths and full SHA-256 values without copying them. Neither history captured the Lua freeze/scheme or native command record. The evidence therefore does **not** prove that freeze caused the failed Enter; native poll/release consumption remains another possible boundary. An arbitrary additional step count would not resolve that uncertainty.

## Source-backed run-only correction

`original-native-layout.txt`, `original-gamecontrol-registration.txt`, and `original-gamecontrol-accessors.txt` record selected disassembly from existing `mdk2Main.exe`, SHA-256 `b3e0226e411abff17ddabb723e493e95579490cb49bfe3787b1eade1144e27c1`. The observer only reads bounded mapped memory; it makes no guest writes, native calls, Lua evaluation, or configuration changes.

Lua state is rooted at `0x4b7ce4`. Original string/table layouts support reading `Level.file`, `freeze`, `selected`, `conscheme`, and `newconscheme`. The native command array at `0x5f20f0`, count at `0x5f20ec`, has 40-byte records. `COM_MENUSELECT` is 62 in the actual run. Binding 28, secondary -1, rise flag, and previous/raw/active fields establish command identity and consumed release. The native poll stores raw input, dispatches the callback, then updates previous input (`0x46d086`).

New Game requires startscreen, selected zero, nil freeze, applied title scheme with no pending replacement, and native Enter at rest. Medium additionally requires the difficulty menu, applied menu scheme, and effective native showmenu equal to one. The actual driver checks readiness again after inspection authorization and before `page.keyboard.down`.

After one Enter down, bounded 16-step observations wait for both native pressed state and the source-defined callback result. New Game must produce difficulty/showmenu/menu-scheme effects; Medium must produce freeze-one/menu-hidden effects. Only then does the helper send its single Enter up. Further bounded observations require native previous/raw/active all zero. Exact browser input history, host state, queue, first-failure latch, and existing aggregate limits remain enforced. The observation quantum does not stand in for completion. Selector limits remain 512 steps / 64 commands / 240 seconds; startup remains 4096 / 180 seconds; comic remains 12336 / 247 / 540 seconds. The existing inspection barrier remains required for every capture before subsequent control. Readable transitional screenshots are honestly classified and may authorize finite no-input observations, never a fabricated `transitioning: false` or extra Enter.

## Single browser and first failure

Chrome ran from 05:15:18.644Z to its normal close ACK at 05:20:55.312Z. Startup reached the title at 3072; one balanced Escape opened the menu. Five individually inspected 16-step observations reached readable highlighted New Game at 3200. Its actual Lua freeze was already nil, title scheme applied, pending scheme nil, and native Enter at rest. This was **not** an actual readable-but-frozen sample.

The v1 candidate wrongly required raw Lua `gamecontrol.showmenu == 0` for New Game. The original executable registers special getter/setter accessors at `0x4361fe`; getter `0x441f80` reads native structure offset +8, effective address `0x5ce048`. A raw Lua table lookup returned nil and did not represent that effective value. The local pre-input gate rejected with `native control scheme not ready`; `first-native-readiness-failure.json` preserves it. No Enter was attempted. Containment stopped the game work rather than changing the live predicate or retrying.

The offline v2 removes that extra New Game predicate, matching `Level.Select`, and reads the effective native showmenu value for difficulty/callback checks. The native callback and release polling correction was also completed and tested offline. It has not run in a browser. Earlier offline fixture mistakes are retained in first-failure test logs.

`validation.json` verifies 78 contiguous successful command ACKs, 55 step commands totaling 3200 steps (maximum 64 each), 13 personally inspected exact-hash captures, two Escape edges, and zero Enter edges. The selector ledger used 128 steps / 22 commands. Canonical fresh capture: `recovered/browser/native-selector-74.png`, SHA-256 `6eb005a2012029ac4ba34713bd06a77b3261100e6d675e573c2fd48004241ca2`. Each capture was personally viewed in a separate completed call before approval/control. Identical local review downloads were removed only after byte comparison; `capture-deduplication.json` maps them to retained recovered files.

## Tests and remaining boundary

Run from the checkout root:

```sh
node --test scratch/runs/20261104-mdk2-native-selection-boundary/test-native-readiness.cjs
node --test scratch/runs/20261104-mdk2-native-selection-boundary/test-native-menu.cjs
node --test scratch/runs/20261104-mdk2-native-selection-boundary/test-comic-control.cjs
node --test scratch/runs/20261104-mdk2-native-selection-boundary/test-inspection-guard.cjs
```

All pass: 13 native-readiness, 48 selector, 50 comic, and 6 inspection-barrier tests. The original 42 selector cases remain, plus six meaningful rejection/progression cases. Tests exercise the actual observer on synthetic original-layout memory, exact original executable bytes, actual driver dispatch, and selector behavior with a separate native polling peer. They reproduce readable-but-frozen rejection, final nil assignment allowing selection, unconsumed release rejection, delayed callback with one held Enter, delayed release without another Enter, and unchanged aggregate-cap rejection when the callback never arrives. The six actual inspection-barrier cases remain intact. No production code changed, so no production build was required.

The `fb257e361` comic route remains source-backed: original Escape release invokes StopScript, the comic Done callback, then lounge intro. This run never reached or inspected the comic; it sent no comic Escape and establishes no resulting scene. The next unresolved check is live validation of v2 New Game/Medium callback and release consumption, followed only after a fresh inspected comic by its one original Escape. This task launches no successor or second browser.

## Recovery and handback

`recovery-verification.json` verifies 263 stable recovered files (6,024,023 bytes) by full SHA-256; the second remote inventory was unchanged. Closure checks found all 432 runtime pins unchanged, all 200 served pins matching, browser normal exit, fixed-identity driver/browser absence, and private port 38737 closed. Existing module bytes are referenced by path/hash in `module-recovery-references.json`, without redundant module/media copies. Source identity is Git plus `checkout-vs-execution.patch`, `relevant-uncommitted.patch`, and owned-new-file patches; Git is the source archive.

Box `bx_85fyu4ug` remains **RUNNING**, expiry **2026-11-04T05:48:31.042Z**, recovery cutoff 05:38Z, shutdown owner **coordinator**. Final independently refreshed actual-root/API health is recorded in `box-handoff-exec.json` and `box-handoff.json`. No allocation, resume, stop, deletion, public deployment, or lifecycle action was performed. The browser and helper process are closed; box ownership returns to the coordinator.
