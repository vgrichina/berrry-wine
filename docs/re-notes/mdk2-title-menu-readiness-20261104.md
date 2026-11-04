# MDK2 title readiness: Escape released before observed native consumption

The original title-to-menu prerequisite failed before New Game. A concrete
run-helper defect is now reproduced and repaired offline: the helper released
Escape after 16 slices even though the retained positive sample still contained
the queued keydown/character and native `COM_MENUCANCEL` was zero. Balanced DOM
events and successful step ACKs did not establish native input consumption.
The repair waits for a measured positive native cancel sample before its one
release, within the unchanged original bounds. It is **not a new original-game
menu success or a proved emulator input defect**.

This follows [266eedb98's actual main observation](mdk2-main-construction-observation-20261104.md),
[the original opening/edge analysis](mdk2-title-opening-cause-20261104.md), and
[the personally reviewed successful title route](mdk2-personally-reviewed-title-onward-20261104.md).
Evidence is `scratch/runs/20261104-mdk2-title-menu-readiness/` (RUN).

## What the captured failure establishes

Original sealed hashes and sizes were verified before interpreting captures.
`analysis.json` records references, selected original Lua excerpts, command/input
observations and actual main PCs. Adjacent gzip JSON is decoded in memory or into
RUN only, with the original inventory hash checked; predecessors remain unchanged.

| Sample | Actual observation |
| --- | --- |
| title3072, before Escape | `startscreen`, applied `title`, pending nil, freeze1, showmenu0; native cancel rest and empty input queue. Main PC `46caa1`. |
| down57, then step58/16 slices | At3088, positive state59 still has WM_KEYDOWN27 and WM_CHAR27 queued; native cancel previous/raw/active all0, input list empty, no mumbotime. |
| up60 | Keyup is submitted despite that absent native positive sample; its state contains DOWN/CHAR/UP together. |
| step61/32 slices, rest62 and shot63 | At3120, queue drained but native cancel still0 and no opening effect observed. Main PC `46eefb`. |
| separately reviewed title captures3136–3280 | Freeze1, showmenu0, current lang, cancel0 and empty list persist. Final actual main PC `47d6b6`; file owner remains independently idle at `4515cd`. |

This proves premature **release relative to observed native consumption**. It
does not prove Escape was sent before title initialization: the applied scheme,
callback identities and initial freeze were already observed. Nor do the sparse
rest samples prove that a transient cancel dispatch never happened. The positive
sample is missing; the helper should not have treated the fixed hold as adequate.

The author verifies an explicit capture/hash/step and independently supplied
personal review; the operator calls that author before `next.py` in all seven
modes. Actual `next.py` routes `open` to `native-menu open`; `control.py` retains
the phase/inspection guard before executing that helper. Those barriers did not
cause this ordering defect. The helper's Escape branch, unlike its Enter branch,
had unconditional `step16 → state → keyup → step32`. No Enter was sent in the
failed original, so the historical Enter release-callback defect is not its cause.

## Original source and remaining native work

The existing scripts.zip SHA is
`cfdae6e7d02b1823a59d0b85aa8eaca2f057dbb27e7b86d9a7199fc069f642d8`;
the existing mdk2Main.exe SHA is
`b3e0226e411abff17ddabb723e493e95579490cb49bfe3787b1eade1144e27c1`.
They were read in place, without media copies.

`menuinit.lua:186–227` constructs the language dialog and calls
`menu.SwitchDlg("lang")`. `current=lang` with showmenu0 and applied title is
therefore insufficient evidence for a pending language-selection input. No
ordinary language Enter/click is justified by this capture. `level0.lua:72–85`
installs title dispatch,120 sets freeze,151–170 closes the buttons and schedules
the three-second timer. The already observed mumboshown1 alone does not measure
timer expiry or native animation progress.

`Level.Cancel`27–47 starts opening only while frozen and OPEN is not already
playing; otherwise it can do nothing, or open exit confirmation after freeze
clears. `ButtonOnTimer`452–459 sets mumbotime and plays five OPEN animations.
The timer reaches the same function, so its effects do not uniquely identify
Escape as the cause. Only button00's ANIM_OPEN callback441–446 clears freeze
and labels/highlights the selected button. mumbotime can later disappear in
OnUpdate427–435. None of these separate boundaries may be inferred from an ACK.

The byte-verified PE native masks remain positive raw transition5 (matching
Escape FALL4), zero transition2 (Enter RISE2). At final3280, original `47d6b6`
decrements EBP, stores a signed16-bit sample, strides the output and branches in
a bit-reading loop. Captured return address `47db94` follows the indirect call
at `47db8d` through `4b4f10`; this is distinct from the idle file Worker.
Changing PCs, including resource demand `44fc9b` at3248, show native work at
the observed cuts. No full frame count, loop throughput, timer/animation elapsed
work or call completion was measured. Insufficient native work within the
available samples remains possible; a stall or exact extra slice count is unproved.

## Narrow repair and tests

`tools/mdk2-title-menu-readiness.cjs` validates the original title/file/applied
scheme/showmenu and stable Lua/Level/command/callback identities. It adapts only
the exact SHA-pinned actually used menu helper
`1e657ce9e2d29e1dc5577b3e1d5b39e18ccfda21edec18d4267dcac321db3bed`.
Escape now uses16-slice observations until the existing native command records
previous/raw1, the native list contains the sole matching Escape1 record, and
the browser queue is drained. It then sends one keyup and observes32 then16-slice
quanta until native rest and drained input. Every sample gets a unique name.
No callback effect or freeze release is required while withholding keyup.

The existing helper still owns trusted event history, personal PNG inspection,
ACK validation, one-shot flag,512 total menu slices, persisted command limit
(113 in this original),240-second aggregate limit, absolute browser/recovery
deadline and first-error latch. Observations spend those same budgets; they add
no allowance. If a limit/error interrupts the hold, no further gameplay command
or forced release is submitted; the existing driver cleanup owns held-key
release and closure. The repaired result still stops for fresh pixel inspection.

`node --test test/test-mdk2-title-menu-readiness.js`: **27 passed,0 skipped**.
The exact original helper reproduces release before a delayed native poll; the
repaired helper waits, releases once, and handles delayed rest. Negative controls
cover false-title admission by the old scheme-only gate, wrong applied/pending
scheme/showmenu, foreign host/Lua/Level/command/callback, event changes, absent
positive/list, queued/active input, exhaustion, failed ACK, deadline and stale
inspection. Protocol scene data is explicitly synthetic; it is not guest state.

One real Node OS Worker executes production DirectInput GetDeviceState WAT,
production renderer/host and RPC throughout: early balanced Escape gives0,
held Escape gives128 twice, ordinary release gives0, with the same Worker ID.
This is a fragment-module fixture, not the MDK2 process, original callbacks or
a full-module/gameplay test. It demonstrates why state polling needs a held
input boundary; it does not prove which original DI poll consumed the failed tap.

Actual operator/author integration:4 tests, all seven modes, pass; actual routing:6
pass. The first operator run encountered compressed historical JSON fixtures;
the final run reads them through a hash-verified gzip shim without changing the
originals. Twelve retained native-edge/recovery-deadline controls pass. Serialized
`flock /tmp/wine-build.lock bash tools/build.sh` passes; its log is in RUN.

## Next original dependency and handback

RUN's small `native-menu.cjs` entrypoint compiles the pinned original helper
through `repairSource`. For a fresh authorized run, route **only** the menu-helper
execution in the existing guarded control path to that entrypoint; preserve
author, operator, phase/inspection guards, original source/modules and all bounds.
The original author/operator routing was inspected and tested; no remote route
installation or original replay occurred here. Qualify that concrete path before
launch, rather than sending the new entrypoint outside the guarded operator.

At a freshly personally reviewed native title, make at most the existing single
Escape attempt with measured consumption-before-release. Then input-free bounded
observations must separately establish opening effects, cleared freeze and a
fresh personally viewed readable highlighted New Game. If positive consumption
never arrives, stop at the original limit and retain actual main PC/stack and
input/native-list samples: the next boundary is native polling/work, not another
Escape. If consumption arrives without opening completion, investigate original
dispatch/OPEN-playing condition/animation callback. Require separate Medium
inspection before its Enter. No guessed language input, repeated Escape, blind
replay, extended bounds, post-Lua construction or gameplay claim is supported.

This assignment was offline: no Chrome, game execution, remote API, assigned box,
subworker or lifecycle action. Box ID/state/expiry are not applicable; coordinator
retains all lifecycle ownership. Evidence holds exact Git SHA, relevant binary
diff and owned new-file patches, not a source tree archive, modules or media.
The demonstrated driver dependency is repaired and tested; title-to-menu success
on a fresh original remains the next measured prerequisite. Single task ends here.
