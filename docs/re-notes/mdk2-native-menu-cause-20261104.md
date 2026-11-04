# MDK2 native menu divergence — 2026-11-04

`4c1ecd939` acknowledged input on the **copyright/title screen**, without
establishing New Game readiness. It never selected a visibly highlighted
Medium. The original idle-demo path explains the subsequently observed Demo;
the exact live timer, Lua freeze flag and DirectInput poll were not captured.
No production defect is proved. This investigation and helper testing were
entirely offline; no new game, tutorial or grenade result is claimed.

Evidence and the tested run-only helper are in
`scratch/runs/20261104-mdk2-native-menu-cause/` (ignored). The primary sources
are the retained `20261104-mdk2-per-command-native-route` command spool,
screenshots and input snapshots, `cb5fb1b716`'s
`20261104-mdk2-browser-gameplay/recovery-control/`, and the
`8f9ff6d4c` / `d6f10e18c` tutorial runs. Captures were inspected in place;
`inspected-references.json` records their hashes, without duplicating them.

| Route/checkpoint | Inspected pixels and acknowledged action |
| --- | --- |
| Failed, `loaded-3072` | Copyright/logo, legal overlay, closed icon wells; no New Game label. Command 51 clicks (440,500). |
| Failed, `menu`, 3136 | After one 64-step request: still copyright/logo, no menu controls or selection. **First failed readiness checkpoint.** Command 54 nevertheless sends Enter. |
| Failed, 3136–3216 | Enter down, 16 steps, Enter up, 64 steps, at tick 16 ms; `title-enter` still shows the title. There is no difficulty capture and no second Enter selecting Medium. |
| Failed, 4240 / 4496 | `title-settled` / `menu-ready`: black transition, not a ready native menu. Names do not establish screen state. |
| Failed, 13200 | Original scene explicitly labelled **Demo**. Later Escape is acknowledged; it does not retroactively establish New Game. |
| `cb5fb1b716`, 3472 → 3520 | `resumed-3472`: controller icon has red selection ring and **New Game** label. Enter down/16 steps/up/32 steps, tick 20 ms; `after-menu-enter`: **Medium** highlighted. A separate Enter then starts the comic route. The misleadingly named `difficulty` capture at 3488 still shows the main menu. |
| `8f9ff6d4c`, 3328 → 3376 | After the title click and four 64-step requests: New Game label and selected controller visible. Tick changes to 20 ms; separate Enter hold/release yields highlighted Medium. `tutorial-entry-27312` later shows the original center-arrow instruction. |
| `d6f10e18c`, 3328 → 3376 | Same four post-click step requests. `menu-3328` shows icons still opening, without a readable New Game label or red highlight; this is weaker readiness evidence. `difficulty` at 3376 clearly shows Medium; `recovery-after-title-33984` later shows Kurt and the center arrow. |

The earliest command-schedule difference from the two later tutorial routes is
**64 rather than 256 post-click steps**, followed by Enter on the visibly
unready title. This does **not** prove that waiting exactly 256 steps fixes
this run: native loading/animation progress differs, and the d6 capture is
itself transitional. The actual first selection failure is proceeding beyond
the 3136 readiness checkpoint. The additional 16-versus-20 ms clock difference
is recorded, not assigned a causal effect. Browser viewport scaling also
differs from cb5; the later tutorial runs used the same 1200×900 viewport and
click coordinates as the failed run.

All **1,079 retained files / 12,991,209 bytes** were reverified against their
full SHA inventory. All **349 ACKs** match their command numbers and report
success; each next command follows the preceding ACK. The title click's
`input-51.json` contains the native mouse down/up queue at guest (320,218),
mouse mask zero, and trusted DOM press/release five milliseconds apart.
The next menu capture has an empty queue, null active input and zero mask.
Enter's `input-54.json` contains WM_KEYDOWN/WM_CHAR (13); `input-56.json`
contains WM_KEYUP. The post-Enter capture is drained. These prove browser
delivery and queue processing, **not** that Lua accepted New Game. Keyboard
messages having hwnd 0 also occurs on successful routes and is not a proved
routing fault. The compact click also occurred in both later tutorial routes;
calling it the established cause of failure would contradict that comparison.

Read-only inspection of original `data/scripts.zip`, SHA-256
`cfdae6e7d02b1823a59d0b85aa8eaca2f057dbb27e7b86d9a7199fc069f642d8`,
provides concrete native predicates. Selected lines and decoded hashes are in
`original-menu-references.json`; decoding occurred in memory:

- `level0.lua:102–124,151–170` starts selected item 0, sets `Level.freeze=1`,
  displays legal text and schedules button opening after three native seconds.
  `441–446` clears freeze only on the open-animation callback and sets the
  selection message. A title image is therefore insufficient readiness.
- `217–248`: mouse Select2 requires `onbutton`; Select requires
  `Level.freeze == nil`. Unlocked selected item 0 clears `playdemo`, switches
  to `diff` and highlights item 1. The title click was not a guaranteed menu
  selection. `defaultkeys.lua:58–59` binds menu select to scan 28 (Enter),
  alternate select to 1000 (left button); `menuinit.lua:10–11` defines their
  rise-edge commands. There is no captured live command-value/poll trace.
- `menu.lua:1061–1064` makes difficulty item 1 call `mdkSetDifficulty(0.35)`
  and `menu.diff.Go()`. Visible Medium is the necessary next inspection gate.
- `level0.lua:27–47` supplies an ordinary alternative to a guessed title
  click: Escape/Cancel, while frozen and not already opening, cancels the
  timer and invokes `Level.ButtonOnTimer()`. This is conditional source
  behavior; it has not been tested in a new runtime by this task.

Original `mdk2Main.exe` SHA-256 is
`b3e0226e411abff17ddabb723e493e95579490cb49bfe3787b1eade1144e27c1`.
Aligned disassembly `0x4022a9–0x402395` reads/adds timer `0x4b657c`,
resets it on a nonzero `0x454cc0` result, and compares it with float **10.0**
at `0x48c1f0`. Its greater-than branch sets the timer to -1 and calls the
Lua function named `playdemo` at `0x402380` (string `0x48fdcc`). Function
`0x454cc0` tests whether `0x4bcae8 > 0`; its live value was not read.
This verifies an original idle-demo mechanism consistent with the pixels.
It does not prove the precise frame that took the branch, a missed DI edge,
or why button opening had not completed before the failed Enter. Those are
unknown. No emulator repair is justified by this evidence.

The completed run-only helper is `native-menu.cjs`, with regression tests in
`test-native-menu.cjs`. It works against the retained driver's filesystem
command/ACK protocol in a **future separately authorized live run**; it does
not launch or attach a browser, contact a remote host, or manage boxes.
Use one controller only, with the original source/module/pin preparation.

Each invocation needs a human-written inspection JSON bound to the latest
shot's basename, PNG SHA-256 and exact frozen step count. Required fields are
`capture`, `sha256`, `steps`, a named `inspector`,
`personallyInspected:true`, `screen`, `selection`, and
`transitioning:false`. This is an explicit human inspection contract, not
image recognition. Never invent a passing review of a title, black frame or
opening animation. A current acknowledged state must still match the reviewed
steps and event history before any input is submitted.

Before the next browser launch, integrate exported `inputSnapshot(renderer)`
into that run-only driver's page state observer (install its standalone function
with `page.evaluateOnNewDocument`, then spread its result for `sharedRenderer`
into `main`). It reads the existing queue and public `getMouseButtons()`, and
normalizes the original renderer's undefined inactive event to explicit null.
The original `renderer-input.js:784–795` establishes those semantics. This
avoids the predecessor's omitted inactive/mask fields before the first mouse
event. A missing renderer/getter still throws. Old evidence is never rewritten;
the helper deliberately rejects missing observation fields. The adapter is
offline tested, and its next-driver integration remains unexecuted here.

| Phase | Additional inspected readiness | Action and stop condition |
| --- | --- | --- |
| `observe` | `screen:"title", selection:"none"` | One 16-step observation quantum, then new shot. This is a bound, not a predicted ready time. |
| `open` | Title, no selection; `legalOverlayVisible:true`, `controllerIconVisible:false` | One source-backed Escape hold/release, then shot. No retry. Inspect actual result; reject a quit dialog or transition. |
| `newgame` | `screen:"main-menu", selection:"New Game"`; controller visible/highlighted, New Game label visible, legal overlay absent | One Enter hold/release, then shot. Stop for a fresh human Medium inspection. |
| `medium` | `screen:"difficulty", selection:"Medium"`; difficulty dialog visible, Medium highlighted; preceding `newgame` completed | One Enter hold/release, then shot. Stop for comic inspection. |
| `accept` | `screen:"comic-loading", selection:"none", hecticComicVisible:true`; preceding `medium` completed | Acknowledged state/shot only; returns inspected comic acceptance, with tutorial unknown. |

Main-menu review booleans are `controllerIconVisible:true`,
`controllerIconHighlighted:true`, `newGameLabelVisible:true`,
`legalOverlayVisible:false`; Medium uses `difficultyDialogVisible:true`,
`mediumHighlighted:true`. Invoke
`node scratch/runs/20261104-mdk2-native-menu-cause/native-menu.cjs PHASE BROWSER_DIR INSPECTION.json`.
Selection uses the already successful tick-20 / down / 16-step / up / 32-step
envelope, checking the tick artifact as well as its ACK. Its result is always
inspected again; the envelope never stands in for readiness. The `open` action
uses that bounded input envelope but has only source/offline validation.

The helper checks original execution source, observed canonical instantiation,
registered MDK2/WebGL selection, isolation, frozen single-host state, exact
empty native queue, explicit null active input and zero mouse mask. A lock and
persistent ledger enforce at most **512 steps / 64 commands / 240 seconds**
across invocations, additionally ending three minutes before the browser's
existing deadline. Limits are containment bounds, not startup timing estimates.
Every command requires a contiguous acknowledged prefix, fresh index, matching
successful ACK, unchanged command and session identity. Steps require matching
requested/completed counts. Each keydown/up must add exactly the trusted event
on `screen`; success requires balanced full history and a drained final shot.

The first error creates `native-selector-first-error.json` and prevents
further gameplay commands or retry. **An interrupted hold may remain down**;
the helper does not bypass a failed/pending ACK to enqueue release or steps.
The owning driver must close normally, including its held-input cleanup.
That failure is never reported as balanced success. Recover only after actual
closure: `inventory BROWSER_DIR OUTSIDE_INVENTORY.json` requires a matching
normal Chrome cleanup record, no selector lock, no symlinks and two identical
full directory hash passes before writing an inventory outside that directory.
It never copies game media or sources. Normal closure records are protocol
evidence, not an independent OS process-liveness probe; the runtime owner must
also verify process/port closure. Final recovery downloads must still verify
every size and SHA against this stable inventory.

Validation: `node --check native-menu.cjs`,
`node --test scratch/runs/20261104-mdk2-native-menu-cause/test-native-menu.cjs`
(**25 passed**), and `node .../inspect-retained.cjs` passed. Tests include the
actual rejected 3136 title/ACK pair and independent temporary protocol peers
with wrong UI selector/highlight, legal gate, missing inspection, changed
pixels, stale review, pending/unknown input, wrong/missing/late/failed ACK,
stale future ACK, command gaps, incomplete steps, wrong tick, absent keydown,
untrusted keyup, undrained terminal queue, aggregate budgets/deadline, repeated
open, and live/wrong/abnormal/mutating recovery. Synthetic success only validates
the protocol contract. It establishes no native selection success. There was
no production edit, code commit or build; rebuilding protected original modules
would conflict with this offline preservation task. Only this note is committed.

Preserved source: `1329b1ba6eb00144ff77d4cd92a8513d4fc953ad`;
canonical `cffca869b541e6eff12ae3a6b74c4476977e0a7e23cd43d8ec5ba8faecd4bcee`;
companion `580f49f3c78d26e6855efa0beb37046d03ea24690ff98cfcb3e94ce5e6cb1ee3`.
Both retained module hashes were independently rechecked; the 432-entry pin
manifest is unchanged. Checkout SHAs, relevant binary diff and owned new-file
patches are retained. No source archive, media copy, rebuild or substitution
was made. No box is assigned or used. The coordinator's existing report says
old `bx_zv998agm` actually stopped at **03:41:32.071Z**; its historical expiry
was 03:47:02.868Z. No lifecycle action was taken here.

Next actual action: capture and inspect the fresh native title/menu. On a title
use bounded observation, or the one conditional native Escape opening attempt;
require a fresh, readable selected New Game capture before Enter. Require a
separate fresh highlighted Medium capture before the second Enter. Stop and
close on the first failed readiness/ACK/event check, then recover stably. The
old Demo state is not a tutorial continuation, and this task launches no successor.
