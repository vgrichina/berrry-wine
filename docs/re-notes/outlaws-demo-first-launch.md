# Outlaws original first-launch handoff

## Forward movement after Peek/Get repair, 2026-10-18

The normal rebuilt module after the reviewed Peek/Get selection repair now
shows ordinary player forward movement. The unchanged original direct route
reached Main Game, GOOD and the town; an Up hold of exactly 500 ms moved the
view from the street entrance, through the street in the held frame, toward
the HOTEL in released/settled frames. Fixed world landmarks changed markedly,
unlike the retained pre-fix 500-ms no-motion observation. This supports the
repair affecting original input, together with its separate API conformance
tests; this run alone does not prove every internal causal step.

Evidence is `scratch/runs/20261018-outlaws-peek-fix-observation/`:
`good-settled.png`, `level-up-before.png`, `level-up-held.png`,
`level-up-released.png`, `level-up-settled.png` and the complete receipts.
**Live turning remains unverified.** The reviewed Up-settled frame was alive,
but the immediate `level-left-before.png` was already sepia with a skull/death
indicator. Left was then held/released for 501 ms; subsequent camera motion
and `level-idle-after-release.png` cannot isolate a live-player turn or stopping
after release from death behavior. These captures are preserved, with no retry
or respawn. Combat, audio, FPS and sustained/full-game qualification remain
unestablished. `result.json` records partial forward-control success and the
turn limitation explicitly.

Tested canonical SHA-256:
`fd1613e22ee7e77300d3f246b91295fb7da513dc5d37b64e6ca022eb89bdfc92`.
Region mirror is unchanged from below. Launch HEAD:
`3c6b9ff695e7cdf060d6357ec95925c68417c2a4`; all 3,118 source pins and all 31
original records remained unchanged. No passive counters or API polling logs
were enabled. Child 2340686/controller 2340663 exited zero after ordinary host
quit at 19:05:21.873Z (124.654 seconds); both PIDs were absent and owned group
empty. Coordinator independent postflight passed. Log size was 5,450,526 bytes,
postflight free disk 2,458,820,608 bytes; no guard fired. Existing 180/185/210 s,
8-MiB log and 2-GiB margin limits remained in force. No build occurred inside
this observation, and no browser, guest patch, forced state or licence answer
was used.

A source-only follow-up is prepared at
`scratch/runs/20261018-outlaws-registered-turn-prep/PLAN.json`. Its pure route
proof verifies `--app=outlaws_demo` resolves the same executable, 29 companion
mappings, `C:\OUTDEMO` cwd, empty arguments and original hashes as the prior
30 explicit mounts. Fixture verification passes, and 31 added fixture/manifest
pins bring admission to 3,149 physical pins. This is preparation, not registered
runtime evidence. After reviewed Main Game/GOOD, review a fresh alive level
frame and test Left/release/idle **before** moving forward into the hostile
street. Inspect the immediate before/held frames for death contamination; stop
once the boundary is clear. No follow-up runtime is authorized yet.

## Original town level reached; controls unverified, 2026-10-18

The ordinary direct route now advances through Main Game and GOOD difficulty
to a rendered first-person town with revolver, ammunition/health HUD and
chickens. Each visible menu choice used a separately reviewed 250-ms held
left mouse press with an independent release timer. Captures three seconds
after release establish both transitions. This is partial level-rendering
evidence, **not player-control or sustained-gameplay qualification**. A later
Left-arrow hold of 250 ms was acknowledged at host batches 26311/26361, but
the before/settled frames show no clear viewpoint change.

Evidence: `scratch/runs/20261018-outlaws-held-route-observation/`, particularly
`main-game-held-settled.png` (difficulty), `good-difficulty-settled.png` (town),
`level-left-turn-settled.png`, `issued.ndjson`, `review.json` and `result.json`.
The dashboard record uses candidate `outlaws-demo`, app `outlaws_demo`, outcome
`unknown` and an explicit partial/not-qualified summary. The actual route was
direct `oldemo.exe`, not a registered-app launch: cwd `C:\OUTDEMO`, empty args,
30 unique original mounts, unchanged archive and all 31 original records.

Canonical module remains
`a4a4bc6aef0f50a191d83acdd0857ff390537701adc381d81436845f20b969e3`, region mirror
`a6869fe091c02854ac8f6cc71dd8e37b4f1156be616dd2dbaa0cc012c37bf9fa`.
Launch HEAD was `6300b350b3006be25482e48abfde911db44718c3`; physical source
identity is the retained 3,118-file manifest, verified before/after and by the
coordinator. The cooperative CLI kept 180/185/210-second guest/soft/hard
limits, 8-MiB logs and the existing 2-GiB disk margins. Only input routing was
traced; no API polling logs or API-return claims. Host quit ended the run
after 95.845 seconds at 18:13:07.644Z. Child 2281006 and controller 2280993
exited zero, both absent with an empty owned process group. Log size was
3,529,709 bytes; postflight free disk was 2,590,367,744 bytes. No guard fired,
licence was answered, guest byte was changed, build was made or retry occurred.
Audio, combat, FPS and browser/Worker behavior remain unknown.

### Keyboard boundary audit after the town capture

The shorter positive-control run,
`scratch/runs/20261018-outlaws-menu-pump-observation/`, resolves the earlier
counter uncertainty. On a reviewed menu, one ordinary Up hold lasted exactly
500 ms. Before/settled counts advanced `0x438980` from 458763 to 459237
(+474) and `0x4389d8` from 460052 to 460755 (+703); all four key-path counts
remained zero. Correct keydown/up scan payloads were dequeued for focus
`0x10001`; main queue snapshots before/held/released/settled were all empty.
The menu did not change. Neither the polling thread nor final owner delivery
is established by those observations. Child 2309360/controller 2309341 exited
zero at 18:38:35.598Z after 60.181 seconds; a quit request queued after the
55-second input cutoff was not issued. The guest time limit ended the run.
All 3,118 pins/originals remained unchanged, both PIDs absent, group empty,
and coordinator postflight passed. Log size was 769,431 bytes, postflight free
disk 2,304,499,712 bytes. Launch HEAD was
`348febabcb2baef4632f1e30eb2aa9f18b631833`, with unchanged module/region hashes
above. `result.json` preserves this partial, unqualified control observation.

Source comparison now identifies a smaller candidate than another original
run: `handle_PeekMessageA_fetch` scans pending NC_FLAGS (WM_NCCALCSIZE/WM_NCPAINT)
**before** hardware input, whereas `handle_GetMessageA_fetch` reads hardware
input **before** NC_FLAGS. With a pending NC message and an already queued key,
an unfiltered PM_NOREMOVE peek can expose `0x85`, followed by GetMessage removing
`0x100` instead. The original inspects keys before GetMessage, so this ordering
asymmetry can bypass its key path even with correct host dequeue and no queued
residue. The source ordering is verified; its causal role in Outlaws is still
unproven. Foreign-thread theft is not required by this hypothesis. Current
foreign-owner routing already forwards input-origin records to the owning
shared USER queue and retains input if that queue is full.

Next use a small isolated API conformance case: one plain HWND, one thread,
no redraw or events between calls. Establish input-only and NC-only controls,
then cross NC bits 1/4 with queued KEYDOWN/KEYUP. Compare exact HWND/message/
wParam/lParam from PeekMessage(PM_NOREMOVE) and immediate GetMessage, host
dequeue count and pending flags; also compare Peek(NOREMOVE)/Peek(REMOVE).
Require one preserved delivery and consistent selection while state is
unchanged. Only if those pass add a foreign polling thread and filtered peeks.
The canonical exports `nc_post_paint`/`nc_post_calcsize` plus ordinary API thunks
can support a test without rebuilding; `bootRenderHarness` would compile the
full tree and needs a separate build grant. Relevant ownership is
`src/09a5-handlers-window.wat`, queue helpers in `src/10-helpers.wat`, and tests
`test-nc-flags-message-wake.js`, `test-peek-message-filter.js`,
`test-message-extra-info.js`. Source-only recipe and comparison are retained in
`scratch/runs/20261018-outlaws-peek-get-source-audit/audit.json`. No runtime or
production fix was performed during this audit.

The earlier longer counter run is retained at
`scratch/runs/20261018-outlaws-keyboard-count-observation/`. It repeated the
ordinary menu/GOOD/town route, then held Up and Left separately for exactly
500 ms each, with independent releases and three-second settled captures.
No clear world-landmark movement or turn appeared. Four counters at
`0x438a60`, `0x438a00`, `0x43aaa0`, `0x493ab0` remained zero before, during,
and after both inputs. They were armed, but no known-executing control site
was selected, so this does not establish a lost event or a production defect.
Host key acknowledgements were batches 12885/12936 and 15268/15325.
Child 2293523/controller 2293504 exited zero at 18:25:40.617Z after 144.053 s;
both PIDs were absent, group empty, all 3,118 pins/originals unchanged, and
the coordinator independently verified cleanup. Logs were 2,223,518 bytes;
postflight free disk was 2,543,853,568 bytes. No guard fired. Module and region
hashes remain those above; launch HEAD was
`7931dc7486c94a68949e019956ea87a4bd14a60d`. The dashboard result remains partial
and not qualified; this failed player-control observation is preserved.

Closer review found useful host dequeue evidence already in that log:
Up down/up carries lParam `0x01480001`/`0xc1480001` at lines 11899/11955;
Left carries `0x014b0001`/`0xc14b0001` at lines 14227/14289. Each following
`check_input_hwnd` reports focus `0x10001`. The ordinary renderer FIFO was
therefore drained with correct scan-bearing payloads. Main and the cooperative
helper share this callback, so these records do not identify the polling
thread or prove subsequent owner-queue delivery to the game's keyboard path.

Counter audit: `src/13-exports.wat` compares the configured address with guest
EIP at run-loop block boundaries; it does not take an RVA or count every
instruction. The executable's original base is `0x400000`, and retained main
EIP samples agree with these absolute addresses. The key branches are jump
targets and the translation/consumer sites are call targets. Totals live in
shared memory; cooperative instance creation inherits each `set_count` and
re-arming the same address does not reset totals. The pure inherited-global
test passes all 74 setters. Thus an obvious base error or main-only counter
explanation is unsupported. Counters enable the debug tier and are not
performance evidence. The log records one helper starting at `0x01118890`.

The next discriminator can be shorter and menu-first: retain the same four
sites and add `0x438980` (pump entry) and `0x4389d8` (message-selection block),
both positively sampled in the retained main-thread startup/menu log. After
reviewing a fresh menu, take counts, hold ordinary Up 500 ms/release, and
capture counts plus existing `dump-msgq` before/held/settled. The latter reads
the main instance's queue without consuming it; an empty queue does not rule
out transient consumption or another thread's queue. Stop on that boundary
within 60 seconds guest/85 seconds hard rather than repeating level loading.
If the positive sites themselves remain zero, fix the measurement before
inferring game input behavior. If they advance while key sites do not, retained
scan-bearing dequeue and queue records separate ownership/queue availability
from original scan translation. A later level-specific run could add
`0x4d2ab3`, positively sampled during both failed holds, as a rendering control.
No runtime is authorized for this proposal. No API polling log, hidden input,
forced state, production patch or build is needed. The existing pure keyboard
message-ordering test also passes; it cannot establish the live owner path.

The original executable processes keyboard messages **before DispatchMessage**.
At original VA `0x4389bc` it calls PeekMessageA with PM_NOREMOVE. Its switch
maps WM_KEYDOWN to `0x438a60` and WM_KEYUP/WM_SYSKEYUP to `0x438a00`.
The down path requires LOWORD(lParam) == 1, extracts the scan code from the
upper word, and calls `0x43aaa0`; that routine maps the scan-code byte through
the table at original VA `0x533418` (with special virtual-key handling).
Nonzero results feed `0x493ab0` at `0x438a98` for down and `0x438a35` for up;
release sets the internal 0x80 bit. Only afterward does GetMessage remove the
message. A matching main-window WM_KEYDOWN can deliberately skip
TranslateMessage/DispatchMessage. Therefore absence from dispatch tracing
does not establish missing delivery. These are static original addresses,
not new guest-state writes or observed execution of those paths.

The four inspected original PE import tables (`oldemo.exe`, `Olkbd.dll`,
`Olmouse.dll`, `olhook.dll`) contain no GetKeyboardState/GetKeyState or
DirectInput entry imports. GetAsyncKeyState occurs in the executable's mouse
polling path and Olmouse. Olkbd identifies itself as the keyboard configuration
DLL; its message/subclass imports alone do not establish gameplay consumption.
Dynamic resolution elsewhere is not excluded by this import inspection.
The retained live snapshots report focus/main HWND `0x10001`, visible Outlaws
640x480; this does not prove every queued key reached the game.

CLI `keydown`/`keyup` use renderer.handleKeyDown/Up, updating physical state
and queuing scan-bearing ordinary messages. Numeric arrow fallbacks use Set-1
scan codes; the pure keyboard-message regression passes. PeekMessage's source
path preserves `pending_input_lparam` in the returned MSG. No production bug
has yet been demonstrated. Disassembly and import evidence are retained at
`scratch/runs/20261018-outlaws-keyboard-source-audit/`.

A next separately granted observation should retain route-only logging and
the proven menu holds, then capture a level idle baseline, ordinary Up hold
500 ms/release, settled frame, and separately reviewed Left/Right holds with
release and idle frames. Compare stable world landmarks, not animated chickens
or weapon pixels, and stop after a clear boundary. Existing passive
`--count=0x438a60,0x438a00,0x43aaa0,0x493ab0` plus explicit `hit-counts` requests
before/after each action can distinguish arrival in the original key branch
from later processing without high-rate API logs. Counters are diagnostic
observations, not movement proof; no raw-message injection, DirectInput-state
injection, focus override or guest-memory write is proposed. Keep the same
time/disk/log guards and independent key release. No runtime was started for
this audit; another lane owns execution until the coordinator grants it.

## Original main-menu validation, 2026-10-18

The authentic demo now reaches its visible main menu through ordinary
`C:\OUTDEMO\oldemo.exe`, cwd `C:\OUTDEMO`, empty arguments and all 30 unique
original VFS names. No input, installer answer, licence response, replacement
DLL or guest patch was used. This establishes startup and menu rendering only;
gameplay, navigation, audio and browser/Worker behavior remain untested.

The reviewed captures and complete receipts are retained under
`/home/user/wine-assembly/scratch/runs/20261018-outlaws-original-fixed-lifecycle-observation/`.
`sample-0.png` is black startup, `sample-1.png` shows the Outlaws title,
`sample-2.png` shows the menu by approximately 30 seconds, and `final.png`
shows the menu at 60 seconds. Main Game, Multiplayer, Historical Missions,
Load, Options and Exit are visible. `review.json` was published after artifacts;
there is no dashboard candidate association because Outlaws is not registered.

Tested canonical module SHA-256:
`a4a4bc6aef0f50a191d83acdd0857ff390537701adc381d81436845f20b969e3`.
Region mirror:
`a6869fe091c02854ac8f6cc71dd8e37b4f1156be616dd2dbaa0cc012c37bf9fa`.
Runtime source is integrated commit
`83bbb77fdf7b9823359bdf8c927a02f2e878b34b`; later documentation-only HEADs
are recorded in the identity receipt. All 3,118 physical pins were verified
before and after execution. Original archive SHA-256 remains
`501f37aa475b6c27c87ce04e30b5207f91b81603cb376aaa9ffde1647a40e7b3`;
all 31 original records are unchanged. Exact arguments, pin list and controller
are in `launch.json`, `current-pins.json` and `controller.js` in that run.

The existing CLI used cooperative scheduling, 200,000-block batches, a
60-second guest limit, a 65-second host quit and an 85-second process-group
kill guard. Logs were capped at 8 MiB. Admission required 2 GiB + 128 MiB;
250-ms disk checks stopped at 2 GiB + 64 MiB. No guard fired. Child PID
2232312 and controller PID 2232304 exited zero; the child terminal receipt is
2026-10-18T17:27:44.499Z. CLI statistics report 23,298 batches in 59.999 seconds.
The minimum observed free disk, including postflight, was 3,218,223,104 bytes.
Owned-process inventory was empty; the coordinator independently verified
source/original identity and process cleanup before releasing the lane.

Earlier failures remain in separate `20261018-outlaws-original-*-observation`
directories: QT reached unimplemented KERNEL.184 GlobalDOSAlloc; the next
module exposed built-in dependency classification; the subsequent run stopped
at the deliberate KERNEL.95 nested-load boundary in WDIR62 LibEntry. The final
counted fixed-module lifecycle implementation passed these observed boundaries.
This does not establish general image-backed nested loading or reverse thunks.

The next ordinary action is Main Game, followed only by choices visible in a
fresh capture. The original README documents GOOD as novice difficulty,
Up Arrow as forward, Left/Right Arrow as turning, and Escape as the in-game
options menu. A level screenshot and balanced movement/turn input with
before/after captures are still required before claiming control or gameplay.

The separately granted Main Game attempt is preserved at
`/home/user/wine-assembly/scratch/runs/20261018-outlaws-main-game-observation/`.
The reviewed live menu remained visible after a click at (200,205), followed
by separately reviewed Enter and Down Arrow holds of 150 ms each. The hand
cursor moved, but no difficulty screen or level appeared. `issued.ndjson`
records balanced host keydown/keyup pairs; guest consumption is not proven.
The startup trace window ended at batch 500, before these inputs, so later
input/control diagnostics are absent. Review ordinary input delivery and its
diagnostic coverage before inferring an application defect. `final.png` and
`menu-input-boundary.png` show the unchanged menu. Host quit ended the run
after 139.650 seconds; child 2245472 and controller 2245447 exited zero, with
empty owned-process inventory and unchanged 3,118 pins/originals. Minimum
observed free disk including postflight was 2,866,331,648 bytes. No guard,
licence response, build or retry occurred. Gameplay remains unestablished.

### Source-only input audit

Authentic `oldemo.exe` imports GetCursorPos, GetAsyncKeyState, foreground/focus
queries and the normal USER message pump. Its mouse polling routine at original
VA `0x00439410` first compares the foreground HWND with its own window, then
reads cursor position. At `0x0043945f` and `0x00439479`–`0x004394a1` it polls
buttons 4/1/2 and tests `AH & 0x80`: the currently-down bit, not the low
pressed-since-last-query bit. These are static callsites, not observations of
the failed interactive run. `Olkbd.dll` imports message pumping and window
subclass APIs; `Olmouse.dll` additionally imports asynchronous button and cursor
queries. `olhook.dll` installs hook ID 10, so its name alone does not establish
a missing keyboard-hook dependency. Import identities and relevant disassembly
are retained in `scratch/runs/20261018-outlaws-input-source-audit/`.

The existing CLI `click` calls renderer mouse-down and mouse-up in one batch;
it explicitly disables the renderer's release-hold floor because scheduled
input owns timing. Consequently cursor motion may persist while a frame-based
GetAsyncKeyState high-bit poll misses the entire press. This is a concrete
hypothesis for the click result, not a demonstrated emulator defect. It does
not explain the separate 150-ms keyboard holds. Numeric Enter/arrow inputs do
carry scan-code lParams; the pure keyboard-message regression passed, as did
all 35 renderer button-hold checks. Neither test proves delivery to Outlaws.

Next bounded observation should omit `--trace-from/--trace-to`: the CLI wraps
`console.log` with that gate, which hid later control acknowledgements as well
as traces. Existing `--trace-input` reports mouse routing/drop branches;
`--trace-input-dispatch` reports keyboard/mouse messages entering DispatchMessage
with HWND, message, wParam and lParam. Add
`--trace-api=GetAsyncKeyState,GetForegroundWindow,GetFocus --trace-api-paused
--trace-api-dedup`, then use the existing `trace-api` control action for only
a short window around each reviewed input (at most 750 ms, retaining the
8-MiB log cap). Startup remains untraced; no host-import-wide logging is needed.

The distinguishing ordinary action is mouse-down at the reviewed Main Game
location, hold 250 ms, then mouse-up, each through the CLI's existing handlers;
record their acknowledgements and before/held/released frames. A high-bit
GetAsyncKeyState return during the hold plus matching foreground HWND separates
polled delivery from game logic. For Enter/Down, require actual keydown/keyup
DispatchMessage records with scan-bearing lParams before attributing rejection
to the application. A consumed or misdirected event instead identifies the
input ownership/routing path to investigate. Do not inject DirectInput state,
raw guest messages, focus overrides, menu commands or guest-memory writes.
No runtime, build or production-source fix was made during this audit.

Preparation caught a constraint on that proposed trace combination:
`--trace-input-dispatch` is an API-log consumer and prevents the CLI from
starting with API logging paused, despite `--trace-api-paused`. The first
held-mouse discriminator therefore omits the dispatch flag and retains
`--trace-input` plus initially paused selected GetAsyncKeyState/foreground/focus
traces. Independent timers release the ordinary mouse button at 250 ms and
turn API logging off at 650 ms; pure tests verify both and emergency release.
This tests the mouse polling hypothesis without broad startup logging; it does
not provide decoded keyboard dispatch evidence. A separate keyboard-focused
observation remains necessary if keyboard delivery is still in question.

The granted held-mouse run at
`scratch/runs/20261018-outlaws-held-mouse-observation/` reached the menu and
acknowledged ordinary mouse-down at (200,205), batch 16301. Routing reported
candidate/child HWND `0x10001`, `dispatched=1`. Mouse-up was issued exactly
250 ms later. The held capture still shows the menu; the released capture
shows black with the hand cursor, so the menu cleared, but no settled next
screen was observed. Selected API tracing produced 64,505 GetAsyncKeyState
entries and 21,504 GetForegroundWindow entries without return values and hit
the 8-MiB log guard after approximately 447 ms. Emergency trace-off/quit were
issued; child 2266213 received SIGKILL and controller 2266205 exited 1 at
2026-10-18T17:59:10.311Z. Mouse-up/trace-off acknowledgements were not retained.
Owned processes were absent and 3,118 pins/originals were unchanged; minimum
observed free disk including postflight was 2,643,148,800 bytes. Preserve this
incomplete diagnostic: it does not prove the high-bit return, completed menu
activation, difficulty selection or gameplay. No retry or production fix was
made. Reduce diagnostic volume before any separately granted observation.

Owner `/root/outlaws_original_startup`, task
`NEW-GAME-OUTLAWS-DEMO-20261015`. Source preparation only; runtime awaits an
explicit coordinator grant after Army Men acquisition releases the sole box.

`outlaws-demo-launch-manifest.json` maps all 31 verified original records to
30 Windows names. The identical `wdirnop.com` duplicate is recorded separately
and preserved in the original package; the VFS mounts `WDIRNOP.COM` once.
This nonpublic manifest is not a public app registration. Original README
requires extraction followed by `C:\OUTDEMO\oldemo.exe`, empty arguments,
cwd `C:\OUTDEMO`. No registry import, replacement DLL, config patch, installer
answer, or guest input is included.

The controller accepts `ROOT PAYLOAD NEW_OUTPUT`. The proposed payload is
`/home/user/outlaws-original-acquisition-20261015/payload-js-verified` and
proposed donor ROOT is `/home/user/jedi-knight-checkout` on `bx_9ef2wdsw`.
Neither donor suitability nor current runtime state has been checked in this
lane. The controller must first physically verify every compiler/source pin
and canonical module SHA-256 `937466db3545b9d016fb90dfd8a414eb82653b5ebbf7cc2db7c53d8cc87d49eb`.
The pins identify the exact main reference commit; this does not claim the
donor's historical host JavaScript equals current main. Every tracked physical
host file is hashed separately, and the index listing and HEAD are retained.
A mismatch blocks execution rather than causing a rebuild or donor mutation.

The run uses the existing headless CLI, full-frame PNGs every ten seconds,
snapshots, complete stdout/stderr, explicit 120-second guest guard and
150-second final process-group kill watchdog. Snapshot/PNG/host quit commands
are observations and shutdown, not guest menu answers. Licence/crash text
triggers immediate capture and host quit; screenshots still require human
review because image-only licence text may not appear in logs. No initial
input means such a prompt cannot be answered accidentally. The fresh output
directory contains an exact copied VFS, controller, source/module/fixture
identity, command, terminal result and postflight hashes/process inventory.
The coordinator must independently inspect active processes before declaring
the exclusive slot released. Preserve failures and inspect full-frame images
before any further ordinary action.

`--no-threads` selects cooperative guest-thread scheduling, not the real Worker
thread backend; this is explicitly a headless cooperative startup probe.
It cannot establish browser or real-thread runtime compatibility. Process
inventory records command names only, and postflight rejects survivors in
the owned process group without collecting unrelated command arguments.

This source does not establish startup, menus or gameplay. After the first
observed boundary, select the next ordinary action from actual output. A
licence choice requires the user's decision; a crash requires its actual API
or fault diagnosis. Later gameplay proof needs idle, held/released Up and
Left/Right, visible attributable motion and full-frame screenshots. WASD is
not the documented default. Audio/FPS/combat remain separate unknowns.

Before execution: obtain explicit slot grant, inspect previous owner terminal
and clean postflight, take independent process inventory, then verify matching
source/module and all originals. No local build/VM/browser is permitted for
this lane. Recover compact receipts and screenshots into shared
`scratch/runs/20261015-outlaws-original-startup`; retain the remote original
fixtures and full copied VFS separately. Follow `ops/README.md` for dashboard
metadata, and do not attach evidence to an unrelated candidate if Outlaws has
not yet been added to the candidate corpus.

## Observed original startup failure, 2026-10-15

Coordinator granted the sole runtime slot after Army Men's explicit release.
Independent preflight at 14:17:38.933Z read Army Men's 14:15:59.849Z clean
postflight, found no active runtime, and physically matched all 142 compile
pins and canonical module `937466db…`. The frozen controller was commit
`61cf2cd835a1c1ee4977aebe73d074e51549f1de`, SHA-256
`7718d1f8c030bdc504b543028eed63f24a3551d87cdfef830a4af179af6371d1`.

Boat controller PID 153370 started 14:18:15.309Z; child PID/process group
153383 loaded the original PE entry `0x004f10d0` and reported working
directory `c:\outdemo`. It immediately hit the real fail-fast boundary:

```text
=== UNIMPLEMENTED API: OemKeyScan ===
EIP: 0x0043a8bb  ESP: 0x074ff9f4  EBP: 0x00000100
[0x074ff9f4] = 0x0043a8f1  <- return address
[0x074ff9f8] = 0x00000000  <- argument
*** CRASH at batch 0: unreachable
```

The original caller loads ESI from IAT `0x005da450`, starts a 256-entry
loop (`EBP=0x100`), pushes its index at `0x0043a8ee`, calls ESI at
`0x0043a8ef`, and would consume EAX at `0x0043a8f1`. This is the first
observed failure, not proof that later startup APIs work. `git grep` found no
existing `OemKeyScan` implementation or API-table entry in the pinned source.
The next step is a real keyboard-translation API implementation and focused
tests, followed by a fresh matching module and separately granted original
startup run. Do not substitute a silent-success handler or change guest bytes.

Child exit 1 was recorded at 14:18:15.992Z, controller API exit 1 at
14:18:16.181Z. Crash-text monitoring issued only host capture/quit commands;
there were no guest inputs. The failure preceded PNG capture, so **no
screenshot exists**. No menu, licence prompt, gameplay, audio or controls
were reached. No retry followed this unexpected failure.

The donor's Git HEAD was `03641536b256ec78527fee514ea2dfa4c31639e4`; this
is metadata, not its tested tree identity. Its historical indexed checkout
and all **6,527 physical tracked files** are recorded in `run/identity.json`
and `run/source-before.json`. Compiler closure matches reference
`32a28da07a355a2797efb8643d2fd8d7fa87ee1d`; host JavaScript is explicitly
the physically hashed historical donor, not claimed equal to current main.

Independent postflight at 14:19:27.170Z rehashed all 6,527 host source files,
all 31 original payload records, immutable package and module unchanged.
Command-name-only process inventory found no active runtime or owned
controller/child process group. The slot was released to the coordinator.

Evidence is recovered at shared
`scratch/runs/20261015-outlaws-original-startup/`: `run/output.log`,
`run/{identity,source-before,launch,child,terminal,stop-reason,postflight}.json`,
`run/controller.js`, `independent-postflight.json`, frozen manifests and API
receipts. Archive `evidence.tar.gz` is **578,651 bytes**, SHA-256
`241f8911ad2071909fcdeb368d9ff91bb98f76e950744d6abf6314ccc01285dc`,
verified after download. The identical remote archive and full copied VFS
remain at `/home/user/outlaws-original-startup-20261015`; original acquisition
payloads remain untouched in their separate directory. No dashboard
`result.json` was published because this lane has no corpus registration;
these notes preserve the startup failure without misattributing evidence.

Source checks passed: syntax, whitespace, complete manifest accounting and
missing/tampered original rejection. The runtime failed as documented.
