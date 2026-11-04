# MDK2 original title-opening dependency, 2026-11-04

**The retained freeze-one failure cannot yet be attributed to lost input or an animation/timer defect.** The missing measurement is the original `COM_MENUCANCEL` command and opening-callback effects across the one Escape. This assignment implements a read-only observer and causal-boundary diagnostic for that measurement. It also establishes a concrete defect in the predecessor's proposed Enter controller: it waits for a release-triggered callback while withholding release. No production defect is proved or changed; no new runtime success is claimed.

All new helpers and evidence are in `scratch/runs/20261104-mdk2-title-opening-cause/`. They are recoverable from that run's `owned-new-files.patch`; Git holds this note, not ignored run artifacts. Predecessor: [08c34f782 callback-selection note](mdk2-native-callback-selection-20261104.md). This was entirely offline: no allocated box, browser, heavy CLI, game execution, guest write, Lua evaluation, forced native invocation, lifecycle operation, successor, or subworker.

## Original causal chain

`inspect-original.cjs` reads the existing `test/binaries/candidates/mdk2-demo/installed/mdk2demo/data/scripts.zip` in memory, verifies SHA-256 `cfdae6e7d02b1823a59d0b85aa8eaca2f057dbb27e7b86d9a7199fc069f642d8` and four predecessor decoded hashes, and records selected lines in `original-opening-references.json`. No archive or media copy was made.

* `level0.lua:72,81–85` requests the title scheme and installs its `COM_MENUCANCEL` handler calling `Level.Cancel`. `mdk2.lua:145–148` dispatches by **applied** `conscheme`; a pending `newconscheme` is insufficient. `menuinit.lua:21–25` applies and clears the pending scheme.
* `level0.lua:120,151–170` sets freeze one and, on the first title visit, closes the buttons, shows legal text and sets button00's timer to 3. This is source configuration, **not evidence that a measured time expired or failed**.
* With freeze nonnil, `Level.Cancel` at 44–46 tests whether button00's OPEN is playing. Only if not playing does it cancel the timer and call `Level.ButtonOnTimer`. It does **not** clear freeze. If OPEN already plays, this branch does nothing. With freeze nil, Escape instead opens exit confirmation; it is unsafe to repeat Escape blindly.
* `ButtonOnTimer` at 452–459 sets `Level.mumbotime=1` and starts all five OPEN animations. The original `ss_button00.OnTimer` points to that same function. Therefore observing its effects cannot uniquely attribute them to Escape. `startscreen.OnUpdate` at 427–435 decreases/clears `mumbotime` and hides legal text. A later nil `mumbotime` cannot prove this function never ran.
* `ss_button00.OnAnimLoop` at 441–448 consumes the **ANIM_OPEN** callback argument, starts the selected button's ENABLED animation, sets its message, then clears freeze. Starting OPEN, hiding legal text, readable labels, and that final freeze assignment are separate boundaries.

The existing executable is `test/binaries/candidates/mdk2-demo/installed/mdk2demo/mdk2Main.exe`, SHA-256 `b3e0226e411abff17ddabb723e493e95579490cb49bfe3787b1eade1144e27c1`. Selected disassemblies are `native-input.txt`, `native-dispatch.txt`, and `native-constants.txt`. The predecessor's accessor evidence/tests remain intact: effective `gamecontrol.showmenu` is native `0x5ce048`; raw Lua nil is not its effective value.

## Native edge semantics correct an earlier assumption

The PE registers `CON_BUTTON_RISE=2` at `0x434b9a` and `CON_BUTTON_FALL=4` at `0x434bad`. Do not translate those names into physical key edges without inspecting the code. Original `0x454cd0` sums matching 12-byte input-list records (`0x4bb2d0`, count `0x4bcae8`). `0x46cf30` writes the resulting raw value into command +28, compares it with previous +24, dispatches through `0x42ae70`, then updates previous. Active +36 is reset each poll; observing zero later does not establish that dispatch never occurred.

| Native transition | Dispatch mask | Original configured command |
| --- | --- | --- |
| raw becomes nonzero from zero (`0x46cfc0`) | 5 | Escape `CON_BUTTON_FALL=4` |
| raw becomes zero from nonzero (`0x46d0b2`) | 2 | Enter `CON_BUTTON_RISE=2` |

This corrects the predecessor's generic description of Escape as a release callback. The distinction is in native raw transitions, independent of browser delivery. A browser keydown/keyup ACK is not either native transition.

The retained run actually reads Enter flags/rise **2**. The predecessor selector fixture instead used rise **4** and delivered the callback during its positive-input hold. Thus its passing test could not validate the original release-triggered callback ordering. Its `nativeSelected()` requires positive previous/raw **and** callback effects; the controller withholds Enter up until that result. On the original bit-2 path, that ordering can prevent the callback it awaits. All 123 prior cases still pass unchanged, but they do not refute this source-backed defect. **Do not use that v2 Enter hold loop unchanged.** This defect was not exercised in the failed title run, which sent zero Enter edges, and does not explain its freeze-one title.

## Implemented read-only discrimination

`native-opening.cjs` adapts the existing bounded Lua3/native reader. Its optional opening observation adds the original cancel command, numeric title-handler identity, `Level.Cancel`/`ButtonOnTimer` identities, `mumboshown`, `mumbotime`, and the bounded native input list. It preserves the separate original selection fields/effective showmenu accessor. It reads mapped memory only; no callback is invoked. The page-installable function is `observeNative(host, true)`; the standalone convenience export is `observeOpening(host)`. It has not been installed in a live driver.

`opening-boundary.cjs` compares stable single-host frozen samples and keeps unknown fields unknown. It distinguishes missing cancel observations, native positive/rest samples, transient dispatch flag, timer-function effect, freeze release, and applied scheme. It rejects mismatched Lua/Level identities and corrupt command identities. Neither a static title nor an inferred animation receives an inspection approval; every diagnostic returns `permitsInput:false` and never claims callback execution proved.

Its tested Enter predicates separate positive native consumption (`enterPressed`) from callback effects **after** native rest (`enterCallbackAfterRelease`). New Game additionally requires the applied menu scheme and cleared pending scheme. These are read-only predicates for correcting the guarded driver/controller, not an integrated or live-qualified replacement controller. The existing native rest checks, personal pixel inspections, driver authorization, command caps, deadline/recovery logic and first-failure containment must remain when integrated.

## Actual retained comparison and checks

I personally viewed the failed 3200 title/legal capture, the successful 3280 highlighted New Game and 3328 Medium captures, and the earlier unsuccessful 3296 unchanged main menu. Full paths/hashes and input/helper dependencies are in `references.json`; nothing was copied. The successful capture pair has no native observer. The earlier native-selection run at 3200 has nil freeze, whereas 08c34f782's 3200 sample has freeze one, applied title, pending nil, effective showmenu zero, and Enter at rest. Neither recorded the cancel command or `mumbotime`. `retained-failure-diagnostic.json` accordingly reports **missing-original-Escape-samples**, not a fabricated lost-input or callback diagnosis. Different step counts and guest elapsed times are not a timing proof.

Checks passed:

* Unchanged predecessor 117 tests plus all 6 deadline cases: **123/123** (`predecessor-123-tests.log`).
* New observer/boundary cases: **8/8** (`opening-tests.log`): actual retained JSON replay, byte-verified PE constants/edge masks/layout/input reader, original-layout synthetic memory without writes, numeric callback lookup, serialized page function, native-vs-browser separation, unknown/corrupt/mixed samples, timer effect versus freeze/scheme, and original bit-2 Enter ordering versus the old predicate. PE checks are static byte contracts; synthetic tests are not execution of original callbacks.
* Original archive and four decoded hashes verified (`inspect-original.cjs`). No production code changed, so no production full build was required.

## Exact remaining live gap

A separately authorized finite run must record the new fields at a personally inspected original title **before the single Escape**, during its native positive-input sample, and after its one native rest sample. Sample the native list and `COM_MENUCANCEL`, not only Enter. Keep the actual title scheme/pending value and original press/release delivery history alongside each sample. Preserve all existing caps and personal inspection barriers; an unchanged title is an unchanged title, not an animation approval.

If no positive cancel sample is captured, input consumption remains unresolved. If the native command dispatch flag is captured under the applied title scheme but no opening effect is captured, the next boundary is Lua dispatch/`Level.Cancel`'s OPEN-playing conditional; source identities alone do not prove execution. If `mumbotime` becomes numeric while freeze stays one, opening-start effects occurred but ANIM_OPEN loop completion/final freeze assignment remains unresolved. If freeze becomes nil, require fresh personal New Game inspection before Enter. For that subsequent Enter, integrate the tested **consume positive sample → one release → callback effects + native rest + applied scheme** ordering, preserving all old gates. No repeated Escape, fixed extra readiness delay, guest patch or forced callback is justified.

Box `bx_85fyu4ug` was reported **STOPPED at 05:43:34.651Z** by the coordinator; historical expiry was `2026-11-04T05:48:31.042Z`. I did not query, resume, allocate, stop or delete it. It remains stopped by task constraint; lifecycle ownership stays with the coordinator. No box was assigned to this offline task. Source identity is checkout SHA plus relevant binary diff and owned-new-file patches in the run; no source archive was made. This assignment ends here.
