# Rune (Human Head, 2000) Windows demo

## 2026-11-01: LoadMap completes; ordinary movement reaches rendered gameplay

**The original demo reaches a rendered first-person cave scene and responds to
ordinary W input.** Inspected `load-12.png` (batch **256700**) and `load-24.png`
(**316700**) show the cave and HUD; `movement.png` (**323200**) shows a changed
viewpoint. Evidence: `scratch/runs/20261101-rune-property-execution/`.
One original invocation was sufficient; no second invocation, production/test
change, generic repair or speculative fix was made.

The working Software → Next → Next → Run / Escape / relative-pointer New Game
→ Easy route was reused with empty parent arguments, **C:\System**, shipped
INIs and the unchanged **200 ms** clock. Startup free disk was
**2,350,264,320 bytes**, above the required **2,300,000,000**. Streaming gzip
logs kept the disk guard from firing; free disk remained above the floor at
every driver poll. Final free disk exceeded **2.34 GB**.

The observer retained **26** changing live checkpoints, every **5,000 batches**,
from **196700** through **321700**. The known LoadMap frame **0x179ff438**,
returning to original Engine **0x10392e86**, remains present through **246700**.
At **251700**, the retained chain instead contains Engine returns
**0x103a1c17 / 0x103ea0e4 / 0x103cf94b / 0x103ab2ca / 0x103ade91 /
0x10398b0b**; the earlier LoadMap frame is absent. The inspected **256700**
capture establishes map completion. The function's exact return value was
not hooked and is **unavailable**.

**No live SerializeBin property/count/index/next-link frame was captured.**
These finite checkpoints missed that function; checkpoints **226700–236700**
also hit the observer's **40-frame** retention bound. Consequently this run
does not qualify individual property links/counts or prove a serialization
cycle. It does establish that this ordinary load finishes when given more
time than the earlier **239200** endpoint. No failing guest invariant was found.

W down at **321700**, **1,000** completed batches, W up at **322700**, and
another **500** batches produced the inspected movement capture. Actual guest
DispatchMessage observations retain down/up at **321718 / 322947**. Space
down/up at **323200 / 323700**, with **500** completed batches after each edge,
reached guest dispatch at **323406 / 323796** and the inspected **324200**
`action.png`. A distinct jump response, combat, audio and general texture
correctness are not qualified by these captures.

All **4,389** accepted source inputs, **289** original pins and both original
**142-file** trees match before/after. The accepted locked module and generated
mirror match; both actual parent/child module receipts retain SHA-256
**baef4e5a70f43b5d87fe086b4f5bd5b583c833e8bf07239ef05749f222035136**
(**2,025,634 bytes**). All **264 / 118** actual parent/child loaded reads match.
Offline actual sync/async instantiation, preload/parser/control/eval, shared
**512 MB** whole-memory read-only checks, finite/cycle/invalid-frame fixtures,
explicit unavailable exports and late **10,001** snapshots pass. The unchanged
prior compressed **10,001-record** retention fixture was verified and reused.
The scratch-only adaptation adds Engine return addresses and makes cleanup
drain independent of the disk guard. No guest instrumentation or held
algorithm change was used.

The original exits **0** after **75.372 seconds**, child guest/host exits **0**.
Outer **150s / kill-after 5**, inner **115s**, child **TERM 90 / KILL 95** guards
were unused. Own PIDs/group, temporary tree and watcher are verified absent;
logs, shipped/configured INIs and evidence remain retained. Boxes are N/A.
Further property-specific work, if needed, would require closer sampling in
the earlier **236700–241700** interval; it is not needed to establish this
observed gameplay and movement result.

## 2026-11-01: property-loop observer prepared; startup disk guard stops original

**No new property-loop or gameplay observation was obtained.** The single
original invocation stopped at the strict disk guard during initial startup,
before the first requested 22,100-batch step returned. Evidence:
`scratch/runs/20261101-rune-property-load-progress/`. No second invocation,
production/test change, or generic repair was made.

Original `Core!UStruct::SerializeBin` disassembly confirms the inner loop
compares its array index against property **+0x34**, calls virtual **+0x78**
using element size **+0x38** and offset **+0x48**, then increments the index.
The outer loop follows property **+0x2c**. The concrete hypothesis prepared
for this run was finite arrays and advancing property links, distinguishable
from a repeated link or invalid count by bounded snapshots of live frames,
struct/class pointers, property identities, counts, indices and next links.
It remains untested on the original; the earlier single PC proves no cycle.

The scratch observer intercepts both async instantiation and synchronous
`WebAssembly.Instance`. Offline checks use the actual emitted module and
shared **512 MB** memory, hash the whole memory before/after observations,
and exercise synthetic finite links, a cycle negative control, invalid frame
bounds, explicit unavailable exports and **10,001** successive snapshots.
Actual CLI parser/control/eval and preload checks pass; a separate gzip
round trip retains all **10,001** records. These are offline checks, not
original property progression. Runtime driver/child logs stream to gzip.

The Redline launcher final/result artifacts and **05:21:33 UTC**
runtime/source/build release were accepted before runtime. All **4,389**
accepted build inputs, module, generated mirror, **289** fixture pins and
both original **142-file** trees match before/after. The accepted locked
module remains `baef4e5a70f43b5d87fe086b4f5bd5b583c833e8bf07239ef05749f222035136`
(**2,025,634 bytes**); the actual parent module and retained loaded reads match.
The aborted child's module/read receipt is **unavailable**.

Preflight free disk was **2,091,388,928 bytes**. After the guard fired,
measured free disk was **1,952,841,728 bytes**; this crosses the required
**2,000,000,000-byte** floor. The exact invocation's temporary child tree
contained **137,952,001 logical bytes**. The driver's `finally` drain repeated
the disk guard and exited before its normal cleanup receipt. Manual checks
found both runtime PIDs already absent; the own temporary tree's INIs/logs
were preserved compressed and that exact tree removed, restoring free disk
above the floor. Outer PID/group and child PIDs are verified absent.

The first resource blocker is insufficient startup staging headroom. The next
guest observation remains the live serialization identities/counts/next links
and return through LoadMap, after adequate staging headroom is available.
No guest invariant, loader stall, LoadMap return, movement/action response,
gameplay PNG or texture qualification is established by this attempt.
Box ID/state/expiry and ownership are N/A.

## 2026-11-01: live travel URL and original LoadMap reads observed

**The actual pending ClientTravel URL is `DEMOHel1?Difficulty=0`, and original
LoadMap opens and reads `..\Maps\DEMOHel1.run`.** Gameplay remains unverified;
both inspected movement/action captures still show Loading. Evidence:
`scratch/runs/20261101-rune-loadmap-gameplay/`, second invocation in `extended/`.
No production/test changes or generic repair were made.

The working route was reused directly: ordinary Software Rendering → Next →
Next → Run, physical Escape, relative **100,117**, then **100,90**, physical
down/up at **344,264** separated by **500 batches**, actual New Game submenu,
relative **460,-100** to Easy, then physical edges separated by **100 batches**.
Both runs used empty parent arguments, **C:\System**, shipped INIs and the
unchanged **200 ms** clock. No failed absolute-click attempt or timer census
was repeated. Both original 142-file trees match before/after.

The first invocation retained short **3,000-batch** loading checkpoints.
Natural reads increased from **559** to **5,838**, including **1,784** map reads,
with differing main EIPs. Successful map open returns handle **0x70000329**;
`GetFileSize` returns **1,685,904**, and the first `ReadFile` returns **1** with
**1,024 bytes** read. Texture/sound packages also open and read successfully.
These are observed file operations, not inferred from the Loading image.
The second invocation followed the concrete hypothesis that loading was still
progressing and needed a longer finite window; no third original was run.

During second-run natural map-file opens, a bounded read-only EBP walk retains
the active call chain. Engine loads at **0x10e61000**, original **0x10300000**:

- Original exported `LoadMap` **0x103033dc** jumps to **0x10393ce0**.
  Its live frame is **0x179ff438**, returning to runtime **0x10ef3e86** /
  original **0x10392e86**. The preceding Browse instruction calls virtual
  slot **+0x94** with its FURL argument. That FURL is at **0x179ff91c**,
  with map string **DEMOHel1** at **+0x1c**.
- The same live frame retains viewport **0x1a407080** and its pending-travel
  FString at **0x1a407118** (**+0x98**), pointer **0x108d8d00**, count/capacity
  **22/22**, containing **`DEMOHel1?Difficulty=0`**. Original
  `SetClientTravel` export **0x1030408e** jumps to **0x103982d0**;
  its original code stores the supplied wide URL in player **+0x98**.
  This is a live runtime string associated with the active LoadMap chain,
  rather than the earlier embedded-script expectation alone.

Second-run loading completes **45,000 requested batches**, followed by
actually completed **W down / 1,000 / W up / 500** and
**Space down / 500 / Space up / 500**, ending at batch **239200**.
Natural reads reach **7,673** by batch **224700**, then remain unchanged through
the final snapshot while main EIPs continue to differ. The final main is
runtime **0x10bcff88**, original **0x10126f88**, in
`Core!UStruct::SerializeBin` (implementation starts **0x10126f10**), at
`cmp esi,[ecx+0x34]` in its property-array loop. ESI is **1**, ECX
**0x105cacd0**, EBP **0x179fe1f0**, yield reason **0**, quit **false**.
The next exact observation is this serialization's property/count/next links
and return through LoadMap to the first gameplay frame. No loop invariant,
failing guard, stall, movement response or texture qualification is established.

Actual control/parser/eval, preload, relocated reads, natural API return values,
late **10,001-call** retention, valid/invalid frame bounds and unchanged whole
shared **512 MB** memory were checked offline. Unavailable exports remain
explicitly unavailable; no consuming getters, breakpoints, counters, forced
state, budget-one stepping, clock changes or guest substitutions were used.
All **4,389** accepted build inputs, generated mirror and actual loaded reads
match before/after. The reused locked module is
**baef4e5a70f43b5d87fe086b4f5bd5b583c833e8bf07239ef05749f222035136**,
**2,025,634 bytes**, and all four actual parent/child module loads match it.

The originals exit **0** in **54.154 / 85.621 seconds**, with child guest/host
exits **0**. Outer **150s / kill-after 5**, inner **115s**, child **TERM 90 /
KILL 95** guards were unused; all own runtime PIDs/groups and temporary trees
are gone. Second-run uncompressed diagnostic output briefly reduced observed
free disk to **1,974,587,392 bytes** after runtime ended. Immediate lossless
compression of this run's own logs restored **>2,000,000,000 bytes**; this
resource-bound deviation is retained explicitly. No further guest was run.
Box ID/state/expiry and ownership are N/A.

## 2026-11-01: ordinary New Game and difficulty selection reach Loading

**Original Rune now reaches its Loading screen through ordinary menu input.**
The difficulty submenu and Loading PNG were inspected. Playable gameplay,
movement, and action response remain unverified. Evidence:
`scratch/runs/20261101-rune-newgame-map-progress/`, with the second invocation
in `pointer/`. No production or test code changed.

The Redline `01a19569` gate was accepted at **04:54:41 UTC**, after both final
artifacts and its **04:54:15** runtime/source/build release. The accepted locked
build was reused only after all **4,389** inputs, module and generated mirror
matched. Both actually loaded parent/child modules in each invocation match
SHA-256 `baef4e5a70f43b5d87fe086b4f5bd5b583c833e8bf07239ef05749f222035136`
(**2,025,634 bytes**). Source, actual loaded-read identities and both original
**142-file** trees match before/after. Parked control/parser/eval and the actual
preload/module were validated offline; the real shared **512 MB** memory hash
was unchanged. The bounded second observer preserves natural API results and
records only mouse-related API boundaries; no timer/lock census was repeated.

The first invocation tested actual mouse motion to **100,117**, separate down
and up with **1,000 batches** between them, then **10,000 completed batches**
after release. It stayed at the main menu. Its absolute target lies inside the
visible button, but Rune's captured cursor remained at the upper-left. Twenty
small relative steps also failed to place it over the button. This was a
pointer-placement failure, not evidence that the New Game handler was broken.

The second invocation followed that observation. One ordinary relative motion
of **100,117** moved the visible guest cursor to approximately **50,64**.
Natural original WinDrv observations retain:

- `GetClientRect` returns **0,0,648,488** to runtime **0x1174b4b8**, original
  **0x1110b4b8**, viewport **0x1a407080**. Its viewport dimensions are 640x480,
  flags at +0x180 are **9**, and the saved capture coordinate at +0x1c4 is 222.
- Dispatched WM_MOUSEMOVE has client coordinates **401,338**. The original
  captured-motion branch computes deltas from the client rectangle center,
  **324,244**, before calling the engine's mouse-delta method.
- Natural `ClientToScreen`, returning to **0x1174b731 / 0x1110b731**, produces
  **344,264**; `SetCursorPos` requests that recentering point and returns to
  **0x1174b73f / 0x1110b73f**. No cursor or guest state was written by diagnostics.

Another relative **100,90** placed the cursor over New Game. Physical down/up
at the recentering point, separated by **500 batches**, followed by **10,000
completed batches**, opened the inspected **Easy / Medium / Hard** submenu.
Relative **460,-100** then placed the visible cursor over **Easy** (the capture
was named `medium-hover.png`, but its actual red highlight is Easy). Physical
down/up separated by **100 batches**, followed by **30,000 completed batches**,
reached the inspected `pointer/final.png` **Loading** screen at batch **221700**.

Original `RMenu.u` embeds the menu source, retained with byte offsets and its
hash in this run. `RuneButton.Click` calls `Notify(DE_Click)`; `NewButton`
creates/shows/slides `RuneMenuNewTop`. Easy calls `StartPressed(0)`, which builds
`DEMOHel1?Difficulty=0` when `GameInfo.default.DemoBuild != 0`, closes UWindow,
then calls `ClientTravel(URL, TRAVEL_Absolute, false)`. This is the original
handler's expected target, not an observed runtime URL or successful map read.

**Remaining observation:** actual ClientTravel URL through LoadMap progress or
its first failing guard. The Loading image alone does not establish a stall,
a generic defect, or gameplay. No main-thread stop EIP was retained after those
30,000 batches. The driver reached its finite deadline; the queued map capture,
W movement and Space action requests **never executed**. Both permitted original
invocations are exhausted, so no retry or speculative repair followed.

Both runs used empty parent arguments, **C:\System**, unchanged shipped INIs,
ordinary Software Rendering → Next → Next → Run, physical Escape, and clock
**200 ms**. They exited **0** in **79.306 / 84.595 seconds**; child guest/host
exits are **0**. Outer **150s / kill-after 5**, inner **115s**, and child
**TERM 90 / KILL 95** guards were unused. The first driver additionally records
a harmless post-quit `guest exited 0` response race. All own runtime PIDs,
process groups and child temporary trees are absent. Logs and INIs are retained;
large JSON/log files use lossless gzip. Final output briefly left **1,999,912,960
bytes** free after runtime stopped; compression of this run's own artifacts
restored the required **2,000,000,000-byte** floor. Box ID/state/expiry are N/A.

## 2026-11-01: generic timer callback handoff repaired; original main menu opens

**The dedicated multimedia-timer thread cleared the interpreter quantum but
did not return to its host scheduler before starting another due callback.**
The narrow repair sets `$yield_flag` after staging the callback's existing
frame and EIP. Original Rune now opens its main menu after physical Escape.
Gameplay remains unproven. Evidence:
`scratch/runs/20261101-rune-timer-handoff-repair/`, with the sole post-fix
original invocation in `postfix/`.

The initial gate was honored: only scratch preparation preceded Redline
`01a19556`'s final artifacts and **04:36:06 UTC** runtime/source/build release.
The gate was accepted at **04:36:45**. Offline checks exercised the actual
parked control/parser/eval bindings, distinct instances, natural clock/API
return values, relocated reads and the actual preload/module with an unchanged
whole-512-MB memory hash. `get_sleep_yielded()` consumes its flag, so it was
excluded from observation; sleep state comes from the scheduler's existing
natural return record. No readiness, timer-delivery or routing helper was
called merely to inspect state.

The baseline's exact causal sequence, cooperative turn **608062**, is:

1. Galaxy releases its section; `lock/recursion/owner` becomes **-1/0/0**.
2. Natural `host.get_ticks` at verified thunk metadata **CACA003B** returns
   **35,217,202 ms**. The timer's last tick is **35,210,784**, interval **20**,
   so it was due at **35,210,804**, **6,398 ms** before this observation.
   `$steps=0`, `$block_budget=704`, host-yield flag and yield reason both **0**.
3. The next callback acquires the section in that same turn with budget **702**.
   The separate block budget lets `run()` refill `$steps` and continue.
4. The real cooperative run returns only on budget exhaustion: halt **1**,
   **1,000 blocks**, owner **4**, no sleep yield. Main is still at
   **0x17a068e0**, reason **9**. Its normal retry becomes eligible only after
   the section is already held again.

`test/test-mm-timer-handoff.js` compiles the full canonical source and runs
actual x86 callbacks, API thunks, CACA003B and `run()`, with a genuinely
contending main instance and the real `ThreadManager.checkMainYield` admission.
A callback uses ordinary Sleep(0) while holding the section, then advances the
fixture clock by one period, releases and returns. **Before repair**, a second
callback acquires before host return: owner **2**, callback count **2**, main
count **0**; the free-section assertion fails. **After repair**, host return
has owner **0**, callback count **1**, and the first admitted main retry acquires
as owner **1**, increments main count once and consumes its original stdcall
frame exactly once. The successor then parks on main and resumes normally
after main releases. No timer or run logic is replaced by the regression.

The production change adds only the due-callback host-yield flag, preserving
timer phase consumption, callback arguments, pinned loop ESP, identity checks
and both EIP targets. The first mandatory build stopped on that function's
changed source seal. Reviewing the exact census entry confirmed unchanged
`writes`, `boundaryCalls`, `exports`, `targets` and `ownershipWrites`; only its
SHA was refreshed. Ownership remains **pending**, nonlocal APIs remain
disabled, and no lifetime, REP, restart or nonlocal-jump algorithm changed.
The subsequent mandatory **flock build passes**, as do the new regression,
existing timer-thread and callback tests, **55 ownership cases with a detected
negative control**, and census mutation tests. The existing input-consumption
VM fixture was not edited or reported as passing; its previously documented
missing `mainSchedulerObserver` binding remains outside this repair.

Post-fix natural observations confirm the actual handoff. For example, turn
**612043** reaches CACA003B with clock **35,416,203**, last tick **35,414,984**,
interval **20**, `$steps=0`, budget **826** and a free section. It returns with
halt **3** after **175 blocks**, still free, and `runSlice` returns before the
next timer acquisition in turn **612044**. This is a host scheduling opportunity;
the CLI's additional worker rounds can still precede its normal main-retry
admission. The repair does not promise immediate main execution after every
callback or change that admission algorithm.

Both original invocations used empty parent arguments, **C:\System**, unchanged
shipped INIs, both original **142-file** trees, **Software Rendering → Next →
Next → Run**, physical Escape down/up and the ordinary **200 ms** clock.
Baseline `after-up.png` still shows the title; inspected
`postfix/after-up.png` shows the actual **New Game / Load Game / Save Game /
Multiplayer / Options / Exit** menu. An ordinary click at **101,117** followed
by **1,000 batches** did not establish a level transition; the inspected final
PNG still shows the main menu. At that last parked observation main is runnable
at **0x1187e500**, not its former section-wait thunk. No subsequent generic API
failure is proven. The next observation is ordinary New Game activation through
its guest menu handler to an actual map-load command; no gameplay, movement or
successful New Game activation is claimed. A late request for another 10,000
batches was not executed after the driver's deadline and is not test evidence.

Baseline build reuse matched all **4,388** recorded inputs, generated mirror
and both actually loaded parent/child modules, **2,025,629 bytes**, SHA-256
`985ca2480931df88751db66dbee8527a6d9df9940949baafc6bc3a0b1a43e2dc`.
Changed inputs required the fresh locked build: both post-fix actually loaded
modules are **2,025,634 bytes**, SHA-256
`baef4e5a70f43b5d87fe086b4f5bd5b583c833e8bf07239ef05749f222035136`.
Before/after source, loaded-read and original-pin checks pass separately for
each invocation; the new untracked regression's hash is additionally pinned
in `repair-code-inputs.json`. No Rune clock/config/audio substitution, guest
write, forced release, breakpoint or instruction counter was used.

Both invocations exit **0**, naturally in **65.263s / 85.076s**, with renderer
children exiting guest/host **0**. Outer **150s / kill-after 5**, inner **115s**,
child **TERM 90 / KILL 95** guards were unused. Logs (baseline parent/PTY logs
losslessly gzip-compressed), child INIs and identities are retained. Own runtime
PIDs/groups, child temporary trees and watcher are absent; disk remains above
**2 GB**. Box ID/state/expiry and ownership are **N/A**.

## 2026-11-01: Galaxy owner releases correctly; immediate timer reacquisition starves main

**The Galaxy section is not orphaned: its multimedia-timer owner repeatedly
releases it and reacquires it in the same cooperative scheduler turn while
main remains parked.** No failed generic API contract or safe repair is yet
proven. The title still does not reach the menu or ordinary gameplay.
Evidence: `scratch/runs/20261101-rune-galaxy-lock-owner/`, with the second and
final original invocation in `targeted/`.

The initial gate stayed closed during scratch-only preparation. Both Redline
`01a19546` final artifacts and its **04:19:16 UTC** runtime/source/build release
were present at **04:19:34**; acceptance was recorded at **04:19:41**. No guest,
build, production/test or note edits preceded release. Offline checks exercised
the actual parked-control/parser/eval bindings and the actual scratch preload;
mock instantiations verified distinct identities, natural import returns,
relocated reads, unavailable getters and an unchanged whole-memory hash.

Two original invocations used `--app=rune_demo --spawn-processes`, empty parent
arguments, **C:\System**, unchanged shipped INIs and both original 142-file
trees. Both followed **Software Rendering → Next → Next → Run**, then physical
Escape down/up at **174100/175100**. No queue census was repeated. The observer
wrapped natural per-instance API entry/exit imports; it did not call routing,
timer-delivery or readiness helpers to inspect state. There were no breakpoints,
instruction counters, guest writes, forced releases or state patches.

The actual owner is **instance 5, Win32 thread 4**, CLI **T3**, handle
**0xe1003**: the runtime's multimedia-timer thread. Its live timer has interval
**20 ms**, callback **0x119095b0**, Galaxy original **0x106125b0**. The callback
acquires guest section **0x1196ba78**, original **0x10674a78**, returning to
**0x119095cf / original 0x106125cf**. Natural API exit changes
`lock/recursion/owner` from **-1/0/0** to **0/1/4**, with ESP advancing eight
bytes. It calls the mixer, then LeaveCriticalSection returns to
**0x1190999c / original 0x1061299c**, restoring **-1/0/0**, again advancing ESP
eight bytes. Original DLL disassembly confirms both call sites and the
callback's `ret 0x14`.

The owner continues executing: sampled EIPs include **0x1190a56f**,
**0x1190a8b9**, **0x1190a57a** and **0x1190d219**, with changing mixer locals.
The previous **0x11909d70 / original 0x10612d70** is the mixer's voice-loop
entry, not evidence of a permanently stuck instruction. At **176100**, the
owner has **5,101 Enter attempts**, **eight parks** and **5,092 Leaves**: after
subtracting the unsuccessful attempts, exactly one acquired section remains
held. There is no missing release in this observed accounting.

**Exact remaining blocker:** the retained late API sequence in cooperative
`runSlice` turn **608062** is Unlock → LeaveCriticalSection →
EnterCriticalSection → GetCurrentPosition. Leave publishes **-1/0/0**; the next
Enter publishes **0/1/4** in that same turn. Main's EIP is **0x17a068e0** at
both exits, still on its original EnterCriticalSection frame returning to
**0x11903efb / original 0x1060cefb**. Equivalent retained late sequences appear
at turns **600110** and **604070**. Main therefore misses these release windows
while the timer immediately starts another callback. This is recurring
contention/starvation, rather than an owner that never releases. The targeted
exit reports **75,403 main parks**, no stealing/barging/non-owner release, and
the same section backing **0x0107da78**, owner T3, lock 0, recursion 1.

Original DirectSound outputs are now observed, without substituting an audio
backend or disabling Galaxy. `IDirectSoundBuffer_GetCurrentPosition`, returning
to **0x119095e9 / original 0x106125e9**, returns HRESULT **0**; examples are
play/write **35280/35940**, **0/660**, and late **26456/27116** in the 44,100-byte
ring. The write lead is **660 bytes**. Retained Lock calls return HRESULT **0**
and lengths matching the requested bytes, including a split **26460 + 8820 =
35280**. Unlock also returns **0**. These samples do not establish a failed
DirectSound contract.

The first observer's **5,000-record** global quota exhausted; it cannot support
later absence claims. The targeted observer instead retains the first twelve
calls per original caller plus a rolling 48 completed calls per instance,
alongside uncapped per-caller counts. Its scheduler-turn wrapper preserves
the actual `runSlice` call/result and never runs the guest independently.
`causal-validation.json` asserts actual owner accounting, same-turn free/claim
states with main parked, and original cursor/Lock outputs. The next necessary
observation is the exact **CACA003B timer callback completion/due-entry → run
return → main retry** boundary. Source inspection shows `mm_timer_thread_step`
sets the instruction quantum `$steps` to zero but its due-callback branch does
not set a host-yield flag; `run` uses a separate block budget. Whether a generic
callback-turn/handoff invariant is violated remains unproven. No REP, restart,
nonlocal-jump or lifetime algorithm was changed, and no alternate retry was made.

All **4,388** input hashes, module and generated region mirror match the
accepted locked build, which was reused without another build. All four actual
parent/child loaded modules are **2,025,629 bytes**, SHA-256
`985ca2480931df88751db66dbee8527a6d9df9940949baafc6bc3a0b1a43e2dc`.
Each invocation's **264 parent / 118 child** loaded-read hashes and both complete
original trees/package/inventory/manifests/registry pins match before/after.
An earlier offline preload probe loaded an intermediate scratch observer;
its expected scratch-only hash change is distinguished from the four unchanged
actual runtime loaded-read manifests. No production/test changes were made.
The existing input-consumption VM fixture still lacks `mainSchedulerObserver`;
this run does not claim it passes.

Both outer PTYs exit **0**, naturally in **70.251s / 65.164s**; renderer-detection
children exit guest/host **0**. Outer **150s / kill-after 5**, inner **115s**,
child **TERM 90 / KILL 95** guards remain unused. Normal clock **200 ms** and
batch budget are unchanged. Wizard/title/input PNGs were inspected; both
after-up images still show the animated Rune title and Escape prompt, with no
menu, movement or gameplay claim. Logs and child INIs are preserved. Own runtime
PIDs/groups and child temporary trees are absent; free disk remains above
**2 GB**. Box ID/state/expiry and ownership are **N/A**.

## 2026-11-01: exact polling owner proven; Escape retained behind Galaxy lock

**Guest thread 3 dequeues physical Escape in GetMessageA and forwards both
edges intact to the viewport's owning thread 1. The remaining blocker is
thread 1 waiting in Galaxy's EnterCriticalSection.** No new generic input
ownership/delivery defect was proven, so this run makes no production repair.
The original title still does not reach its menu or player-controlled gameplay.
Evidence is under `scratch/runs/20261101-rune-polling-owner-repair/`.

The initial gate remained closed during scratch-only preparation. Redline
`01a19536` supplied both final artifacts and its **04:01:34 UTC** board
runtime/source/build release before this run's **04:02:18 UTC** gate acceptance.
Offline validation exercised the actual parked control/input parser and exact
eval bindings, distinct instantiation identities, natural import returns,
unavailable exports, and relocated console-memory reads. The scratch preload
wraps each actual instantiation's imports separately and preserves their
results; inspection uses scalar/queue getters and bounded memory reads. It
does not invoke routing/readiness helpers, change focus, or count instructions.

One original CLI invocation repeats `--app=rune_demo --spawn-processes`,
empty parent arguments, **C:\System**, and ordinary **Software Rendering →
Next → Next → Run**. The genuine renderer-detection child exits guest/host
**0**. Wizard, title and input PNGs were inspected. Physical down at **174100**
and up at **175100** both execute in actual polling instance **4**, Win32
thread ID **3** (CLI scheduler tid **2**, handle **0xe1002**). Its start is
**Galaxy.dll 0x11903a80**, original **0x1060ca80**. The actual WASM stack names
functions **3600/3599/3598**, resolved against the unchanged build as
`handle_GetMessageA_fetch` / `handle_GetMessageA_pump` / `handle_GetMessageA`.
The retained import thunk has API-table ID **262**, GetMessageA; its original
Galaxy call returns to **0x1060ca94**. This identifies the executing consumer
directly, rather than matching queue counters.

That poller's own focus and `main_hwnd` are both **0**. The host HWND callback
therefore returns **0**, exactly as its fallback contract specifies. WAT then
calls the foreground import naturally: it returns **0x10018**, whose shared
window record names owner **thread 1**. `input_route_to_owner` forwards to that
owner's queue before any poller-main fallback can deliver the key locally.
Actual raw queue inspection on thread 1 shows:

| Checkpoint | Retained HWND / message / wParam / lParam |
| --- | --- |
| 174101 and 175100 | `0x10018 / 0x100 / 27 / 0x00010001` |
| 175101 through 183100 | preceding down, then `0x10018 / 0x101 / 27 / 0xc0010001` |

Control, renderer, keyboard owner, foreground window and viewport all identify
actual instance **1**, thread **1**, with focus/main **0x10018** and repaired
dialog ancestry **0**. The consumer's GetMessage buffer does not receive the
forwarded key. Both events remain intact in the correct owner's queue through
**183100**, with no DispatchMessage. The callback's zero is therefore an
intermediate routing result; the retained destination is **0x10018**.

**First concrete blocker:** thread 1 stays at **0x17a068e0**, API-table ID
**135**, EnterCriticalSection, with unchanged ESP **0x179ff684**. The captured
frame names guest critical section **0x1196ba78**, Galaxy original
**0x10674a78**, and return **0x11903efb**, original **0x1060cefb**. Static
original DLL disassembly confirms that call. Exit diagnostics name the same
section at its WASM backing address **0x0107da78**, owner **T3** (the CLI's
zero-based label for Win32 **thread 4**), lock **0**, recursion **1**. Main
reports **82,403** parks and **110** abandoned Enter continuations. The cause
of the owner's missing release or continuation is unobserved. The next useful
observation is that Galaxy section's acquisition/release and thread 4's
continuation while main waits; this run changes no lock, REP or lifetime
algorithm. No speculative repair or second original invocation was made.

All **4,388** input hashes, the module and generated region mirror match the
accepted locked build, so it was reused. Both actually loaded parent/child
modules are **2,025,629 bytes**, SHA-256
`985ca2480931df88751db66dbee8527a6d9df9940949baafc6bc3a0b1a43e2dc`.
Parent/child loaded-read hashes and both complete original **142-file** trees,
package, inventory, manifests and registry pins match before/after. The
existing foreground-thread WAT routing regression passes, as do both scratch
offline suites and the raw causal-evidence assertions. Direct execution of
`test-input-consumption-state.js` exposes an existing fixture error:
`mainSchedulerObserver` is absent from its VM bindings. No test file was edited.

Normal batch budget/default **200 ms** clock, no breakpoints or instruction
counters. Outer PTY **150s / kill-after 5**, inner **115s**, child **TERM 90 /
KILL 95**; outer exits **0** naturally in **61.785s**, watchdogs unused. Child
and parent logs/INIs are preserved. Own runtime PIDs/groups and child temporary
tree are absent; disk stays above **2 GB**. Box ID/state/expiry and ownership:
**N/A**. `polling-causal-result.json`, `causal-validation.json` and
`verification.json` retain the bounded result. Inspected `escape-later.png`
still shows the ordinary animated title and Escape prompt, with no main menu,
movement or gameplay.

## 2026-11-01: exact Escape consumer repaired; thread delivery still unresolved

**The first proven input defect is repaired: a recycled dialog header made
Rune's ordinary viewport consume Escape as IDCANCEL. The title still does not
reach its menu or player-controlled gameplay.** Evidence and the two bounded
original invocations are under
`scratch/runs/20261101-rune-escape-consumer-repair/` (`postfix/` is the second).

The initial gate was honored: only scratch offline preparation until Redline
`01a1952a` supplied `final.txt`/`result.json` and the **03:42:52 UTC** board
runtime/source/build release. No worker, foreign WIP or held runtime was used.
Offline checks exercised the actual parked control/parser, printable string
IDs, exact eval bindings, distinct control/renderer mock identities, and the
observer's preservation of normal Escape queue payloads.

The diagnostic preload wraps only naturally occurring renderer helper calls;
it records original results and returns them unchanged. Inspection calls only
the actual read-only scalar/ancestry exports. It never calls modal, menu, edit
or dialog routing helpers just to inspect state. At title batch **174100**,
control, renderer, restored keyboard owner, foreground window and all renderer
windows prove to be the **same actual instance**. `mainWasm` is absent.
Actual `menu_open_hwnd`, `modal_dialog_hwnd`, `dialogbox_hwnd` and
`get_findreplace_dlg` all return **0**, and renderer menu mode is false.

The exact consuming branch is `lib/renderer-input.js:3628–3631`, the dialog
traversal `if (dlg && we.dialog_handle_key(...))` return. Focus/main are
**0x10018**, an ordinary viewport with custom WNDPROC **0x112531ef** and native
control class **0**. Nevertheless `dialog_ancestor(0x10018)` returns **0x10018**;
`dialog_get_proc_export(0x10018)` is **0**, so the guest-modeless-dialog guard
does not reject it. The helper-call sequence ends after the second zero modal
lookup, before native-text/edit routing or queue insertion. WAT's Escape
handler sends `WM_COMMAND(IDCANCEL)` and returns 1. Down leaves the queue empty
and dequeue count **6**; up later dispatches `WM_KEYUP` to Rune, as before.

Cause: `WND_DLG_RECORDS` is parallel to window-table slots and its nonzero
control count determines dialog ancestry. Slot retirement/reuse reset the
separate procedure/font state but omitted this 32-byte template header. The
ordinary viewport inherited a destroyed wizard dialog's header. The repair
clears that header in the existing `dialog_state_reset_slot`, which is called
on both removal and fresh slot initialization. No renderer exception or guest
state forcing was added.

`test/test-dialog-record-reuse.js` loads a real one-STATIC DLGTEMPLATE, verifies
live-dialog Escape consumption, removes the dialog/control, and proves the
ordinary replacement takes the same slot. Before the repair it fails with
**131088 != 0**, “ordinary replacement is not a dialog.” Afterward all 32 header
bytes are zero, ancestry is zero, and physical Escape down/up queue normally.
Existing `test-isdialogmessage-enter`, `test-end-dialog-lifecycle` and
`test-wat-window-tables` also pass, including real shared-table OS-thread tests.
Mandatory **`flock /tmp/wine-build.lock bash tools/build.sh` passes**.

The second original invocation repeats selected **Software Rendering** and
ordinary **Next → Next → Run**, with empty arguments, **C:\System**, original
142-file trees and unchanged shipped INIs. Actual wizard and title/input PNGs
were inspected. At **174100**, the repaired viewport has ancestry **0**.
Natural routing now reaches native-text/edit checks (both decline), inserts
one key event, and down at **174101** produces dequeue **7**, message **0x100**,
wParam **27**, lParam **0x10001**. Up produces dequeue **8**, message **0x101**,
lParam **0xc0010001**. This repairs the proven renderer loss.

**Remaining dependency:** no guest DispatchMessage is observed for either
event through **176100**. One later ordinary physical pair, down at **181100**
and up at **182100**, reaches dequeue **10** by **183100**, still without a
dispatch or menu. Each dequeue's routing callback receives polling focus **0**
and returns destination **0**, while the control/renderer instance retains
focus/main **0x10018**. CLI auxiliary-thread imports share `h.check_input`
(`test/run.js:5290–5294`), and its HWND callback uses the polling instance's
focus (`4647–4652`). The next required observation is the actual polling
thread identity, that thread's main-HWND fallback, and whether it retains or
drops the dequeued event. The exact consuming thread is not established here;
do not infer that Rune rejected a delivered WM_KEYDOWN. No further speculative
input repair or third invocation was made. Inspected `postfix/escape-later.png`
and `postfix/final.png` show the animated textured title and Escape prompt,
with no ordinary main menu, movement or gameplay.

Identity checks: diagnostic reuses the accepted locked build only after all
**4,387** input hashes/module/mirror match. The repaired run uses a fresh locked
build with **4,388** inputs; the only input changes are the reset source and
new regression. Actual parent/child modules each match their respective
snapshot: before **2,025,619 bytes**, SHA-256 `168c61dae2861842948e5f9e29e4e18df93a6fab12c7d17f7dc85d75e34b7b55`;
after **2,025,629 bytes**, SHA-256 `985ca2480931df88751db66dbee8527a6d9df9940949baafc6bc3a0b1a43e2dc`.
Both runs' **263 parent / 117 child** loaded-read hashes, both complete original
142-file trees and package/inventory/manifest/registry pins pass. Normal batch
budget/default **200 ms** clock, no breakpoints or instruction counters.
Outer PTY **150s / kill-after 5**, inner **115s**, child **TERM 90 / KILL 95**;
both exit **0** naturally (**26.542s / 89.072s**), watchdogs unused. Child
logs/INIs and parent VFS INIs/logs are preserved; all own runtime PIDs/groups
and temporary trees are absent. Disk stays above **2 GB**. Box ID/state/expiry
and ownership: **N/A**. See `verification.json` for the complete bounded record.

## 2026-11-01: physical Escape down is consumed before guest delivery

**The renderer loses the Escape press before Rune's message pump. The release
reaches Rune, but no menu or gameplay follows.** The exact renderer early-return
branch remains unobserved, so no production repair was made. This is the first
concrete blocker, not evidence that Rune ignores a delivered keydown. Evidence
is ignored under `scratch/runs/20261101-rune-escape-delivery/`.

The initial gate was honored: scratch-only driver preparation until Redline
`01a1951f` supplied final artifacts and the **03:31:33 UTC** board
runtime/source/build release. Child-state integration `66028ecbb` had already
completed and released. One original invocation then repeated the accepted
`continuation/` route: `--app=rune_demo --spawn-processes`, empty parent args,
original System cwd, unchanged 142-file trees and genuine requested renderer
detection child. That child returns guest/host **0**; the unchanged completed
transport merges **3 files, 0 deletions**. Selected **Software Rendering**,
ordinary Next → Next → Run and original SoftDrv produce the title at **174100**.
All actual PNGs were inspected; the title advertises Escape, but is not gameplay.

`--trace-input-dispatch` was enabled from launch. Before the guest, offline
validation exercised the actual parked control handler and input parser, and the
exact `controlEval` parameter signature. It caught and corrected the scratch
driver's numeric IDs: `input-state` requires a printable **string** ID. The
expression's `mods` binding is an object, not a Map. These are scratch driver
changes only. No `keypress:27` was sent.

`escape-observations.json` retains seven coherent frozen states, with zero run
credits, plus HWND/procedure and Escape-specific physical/async state:

| Boundary | Batch | Scheduled / dequeued / dispatched totals | Escape physical / async | Renderer queue |
| --- | ---: | --- | --- | ---: |
| Before down | 174100 | 3 / 6 / 0 | false / false | 0 |
| Down queued, before execution | 174100 | 3 / 6 / 0 | false / false | 0 |
| First batch after down | 174101 | 4 / 6 / 0 | true / true | 0 |
| After another 999 batches | 175100 | 4 / 6 / 0 | true / true | 0 |
| Up queued, before execution | 175100 | 4 / 6 / 0 | true / true | 0 |
| First batch after up | 175101 | 5 / 7 / 0 | false / false | 0 |
| After another 999 batches | 176100 | 5 / 7 / 1 | false / false | 0 |

The scheduled queue contains one action at each queued boundary and is empty
after execution. All other observed queues remain empty. The six preexisting
dequeues are the wizard's three mouse down/up pairs. Down at **174100** calls
`renderer.handleKeyDown(27)` and publishes physical, async-held and async-pressed
state, but produces **no host dequeue, no WM_KEYDOWN and no guest dispatch**.
After 1000 batches there is still no pending press. This localizes the failure
to renderer handling before the message pump; animation is not delivery evidence.

Up at **175100** yields host dequeue **7**, `source=renderer`, initial HWND **0**,
message **0x101**, wParam **27**, lParam **0xc0010001**. The dequeue-route hook
reports caller focus/destination **0/0**; this intermediate observation is not
the final guest destination. At **175298**, the actual MSG passed through
TranslateMessage and DispatchMessageA has HWND **0x10018**. TranslateMessage
returns **TRUE**; DispatchMessageA returns **0x10c8eea0**. Snapshot focus/main is
**0x10018** throughout, with procedure **0x112531ef**, mapping to original
Window `StaticWndProc` export **0x110011ef**. Deeper guest handling of that
release was not traced. No press reached that procedure through DispatchMessage.

Actual `title.png`, `after-down.png`, `after-up.png` and `final.png` retain the
animated title and prompt with no menu. No movement/action was reached. Shipped
User.ini and DefUser.ini bind `Escape=ShowMenu`; that command was only read,
never injected. Renderer `_menuMode` is false in the retained states. The scratch
expression used nonexistent `get_modal_dialog`/`get_menu_open_hwnd` exports,
so its `modal:null`/`menu:null` mean **unavailable**, not closed. It also inspected
the control instance, without proving it was the renderer's restored keyboard
owner. Consequently menu, modal, dialog and edit early-return paths cannot be
distinguished from this capture. Do not turn that missing observation into a
speculative modal, focus or guest-binding fix.

Next observation: record the actual renderer keyboard-owner instance and its
read-only `menu_open_hwnd`, `modal_dialog_hwnd`, `dialogbox_hwnd`, window dialog
flags, focus ancestry/procedure/class, and identify which `handleKeyDown`
early-return branch consumes Escape. Avoid invoking side-effect routing helpers
just to snapshot state. A second original invocation was not used here.

Validation (`verification.json`): all **4,387 full build inputs** match the
accepted Redline locked-build snapshot and remain unchanged afterward; module
and region mirror match exactly, so no redundant build was run. Actual parent
and child each load **2,025,619 bytes**, SHA-256
`168c61dae2861842948e5f9e29e4e18df93a6fab12c7d17f7dc85d75e34b7b55`.
All **263 parent / 117 child** loaded-read hashes match current files. Both
complete 142-file trees, package, inventories/manifest and registry source pass
before/after pins. No production/test code changed or focused regression was
added; offline control/parser/binding checks pass.

The open-PTY outer limit is **150 seconds / kill-after 5**, inner **115**, child
watchdog **TERM 90 / KILL 95**. Natural exit **0** takes **83.125 seconds**, with
no watchdog firing and normal batch budget/default **200 ms** clock unchanged.
API tracing is paused until the Escape observation; no breakpoints or counters
are used. Child stdout/stderr and INIs/logs are preserved before temporary
cleanup; the parent VFS snapshot retains INIs and Detected.log, but Rune.log is
zero bytes. All own runtime PIDs/groups and temporary trees are absent; watcher
is terminated. Free disk remains above **2 GB**. Box ID/state/expiry and
ownership: **N/A**. No browser, boats, other agents, downloads, guest/config/DLL
mutation, held guest, deployment or unrelated repair was involved.

## 2026-11-01: original UI completes wizard; rendered title, Escape menu blocker

**Ordinary Next → Next → Run reaches the animated Rune title scene. Gameplay
is not reached: Escape down/up does not open the advertised main menu.**
Evidence is ignored in `scratch/runs/20261101-rune-wizard-gameplay/`, with the
second and final original invocation under `continuation/`. No production or
regression source was changed; there is no speculative repair.

Ran only after Redline `01a19512` released. Both serial open-PTY invocations use
`--app=rune_demo --spawn-processes`, empty parent arguments, original System
cwd and all 142 original files. The unchanged guest-requested
`testrendev=D3DDrv.D3DRenderDevice log=Detected.log` child finishes with guest
IPC and host exit **0** in each. This remains presence detection, separate from
the subsequent parent rendering result.

The inspected wizard at batch **22100** offers **Software Rendering** selected
under certified compatible devices. Ordinary coordinate clicks **222,418**
advance to the displayed low-detail defaults (23100), first-time **Run!** page
(24100), then startup. No renderer selector was fabricated, and no INI, registry,
configuration, DLL, register or guest memory was edited. The parent later loads
original **SoftDrv.dll**, with DllMain **0x1188a8cc** returning 1; this matches
the UI's software selection. The read-only VFS snapshot during loading still
contains the shipped `GameRenderDevice=D3DDrv.D3DRenderDevice` and
`WindowedRenderDevice=SoftDrv.SoftwareRenderDevice`; do not infer a persisted
fullscreen-renderer change from the wizard selection. Actual observed parent
rendering is the SoftDrv route, not qualified D3D rendering.

First invocation deliberately quits after the **34100** startup-logo capture,
without an error. That was too early to establish a blocker. The second repeats
the same original UI choices, retains the splash at **44100 / 74100**, then
reaches the rendered title at **174100** with normal batch size and default
**200 ms** clock unchanged. Actual inspected `continuation/startup-later.png`
shows the textured Rune logo/platform and **Press “ESC” for Main Menu**.
This is an intro/title scene, not player-controlled gameplay.

A `keypress:27` at 174100 has no menu effect at 175100; source inspection shows
that action calls `handleKeyPress` (character input), so it is not evidence of
physical Escape delivery. Then ordinary **keydown:27 at 175100**, 1000 batches,
**keyup:27 at 176100**, and 1000 more batches leave the scene at **177100**.
Inspected `continuation/escape-menu.png` shows a changed animated logo but still
the same prompt, with no menu. Both snapshots have focus/main HWND **0x10018**,
EIP **0x17a068e0**, quit false. Thus animation progresses, while the requested
menu response is absent; the underlying delivery/consumption cause is unknown.
No movement/action or gameplay claim is made.

Stopped at this concrete UI-response blocker. A final read-only `input-state`
request fails explicitly with **input-state needs --trace-input-dispatch**;
the driver catches it and quits cleanly. The queued subsequent eval did not
execute. Earlier successful VFS evals preserve INIs and Detected.log under
`continuation/parent-vfs-{14,18}/`; Rune.log is zero bytes there, so a buffered
parent log is not claimed recovered. Child stdout/stderr and INIs/logs were
preserved before temporary cleanup. Next bounded observation: repeat this exact
route with **--trace-input-dispatch**, capture consumption state immediately
before/after one physical Escape down/up, and identify its destination and
guest consumption. Do not substitute a console/menu command or renderer edit.

Read-only validation passes (`verification.json`): all **4,385 full build inputs
unchanged** against the accepted af316dc21 post-build snapshot; reused module
**2,025,619 bytes**, SHA-256
`168c61dae2861842948e5f9e29e4e18df93a6fab12c7d17f7dc85d75e34b7b55`.
All four actual parent/child module hashes match. Current loaded reads match
**262 parent / 117 child** in run one and **263 / 117** in run two. Both original
142-file trees, installer, registered manifest and registry source pass
before/after pins; recovered inventory and manifest hashes match their published
pins too. Accepted locked-build/focused-test evidence is reused without rerun.

Outer limits are **150 seconds / kill-after 5**, inner **115 seconds**, inherited
child watchdog **TERM 90 / KILL 95 seconds**. Natural parent exits **0** after
**34.192 / 95.630 seconds**; watchdogs do not fire. All own runtime PIDs/groups
and child temporary trees are absent; free disk remains above **2 GB**. Box
ID/state/expiry and lifecycle ownership: **N/A**. No browser, boats, downloads,
agents, deployment, foreign work or unrelated runtime changes were involved.

## 2026-11-01: live DLL identity cause confirmed; child transport repaired

**The DLL guest-identity defect caused the original renderer child's startup
failure. The repaired ordinary child completes Direct3D detection and exits 0.**
Evidence is retained under ignored
`scratch/runs/20261101-rune-child-path-repair/`, with the sole post-fix run in
`postfix/`. This supersedes the unconfirmed causal status in the older entries.

Exactly two ordinary original parent CLI invocations ran, after Redline released
the sole runtime slot: `--app=rune_demo --spawn-processes`, empty parent guest
arguments, original System cwd and all original files. Both children retain the
guest-requested `testrendev=D3DDrv.D3DRenderDevice log=Detected.log`. Child-only
file/module/cwd tracing uses normal batching, with **no breakpoints, counters,
trace-to window or guest clock override**. No guest memory, registers, INIs,
registry or DLL bytes were edited. Parent control only steps to the existing
wizard, captures its PNG and quits; no wizard Next or player input was sent.

Before repair, child **3030091** starts at `c:\system`, then:

* API 1653 queries Core handle **0x10ba9000**, returning **`C:\Core.dll`**
  (11 characters), distinct from the earlier handle-zero EXE queries.
* API 1691 successfully changes cwd to **`C:\`**.
* APIs 1703 and 1707 open **`rune.ini`** and then **`Default.ini`**, both
  returning **INVALID_HANDLE_VALUE**. API 1709 GetLastError returns **2**.
* The child displays **`MisingIni / History: appInit`**. The observed failed
  Default.ini fallback identifies the first original error branch; DefUser.ini
  is not reached. No slower breakpoint diagnostic was repeated.

`test/run.js` now maps each original host DLL seed through the parent's existing
`capturedGuestPath` or `besideExeGuestPath` identity, and selects the export row
whose **complete guest path** matches, case-insensitively. That exact exported
host file seeds the child. No basename search is used. Missing identity, missing
export/file, or collision export retains the original seed. EXE transport stays
on its existing export row. The separate absent-output merge defect is untouched.

After the locked build, child **3031988** receives all four seeds from its
exported `in/system/` directory. The same Core handle query returns
**`C:\system\core.dll`** (18 characters); SetCurrentDirectory succeeds at
**`C:\system\`**. Original `rune.ini` and `User.ini` open successfully with
sizes **14,181** and **6,264** bytes. There is no MisingIni. Actual retained
`postfix/child-state-3031980/out/system/detected.log` is **2,587 bytes**, SHA-256
`2d929ce388b01bbd84672b3890a929ebccf6cf2eee8e0b8efc760f836037639b`.
It records the unchanged renderer-test command, System base directory, native
D3DDrv binding, Direct3D presence **DD_OK**, **Successfully detected
D3DDrv.D3DRenderDevice**, orderly shutdown and closed log. Both the guest IPC
exit code and host child exit code are **0**, without watchdog intervention.
The child also exports a zero-byte Detected.ini; no replacement was supplied.

Both actual **640×480 wizard.png** images were inspected: the original first-run
wizard still displays only **Software Rendering** at the captured parent step.
That image is not evidence of a refreshed parent renderer list, completed wizard,
menu or gameplay. The proven result here is repaired child startup and successful
original D3D renderer presence detection. Further ordinary wizard/gameplay
progress remains unobserved; this assignment performs no third invocation.

Validation: `flock /tmp/wine-build.lock bash tools/build.sh` passed, followed by
`node test/test-cli-child-dll-identity.js`, `node test/test-vfs-export.js`,
`node test/test-vfs-host-files.js` and `node test/test-process-boot-yields.js`.
The new regression exercises the actual CLI helpers with a real exported VFS:
nested DLL path with a second same-basename DLL, exact guest-path preservation,
missing exact export/unknown identity/collision fallback, app-local DLL identity
and ordinary EXE path. No guest runtime is launched by those focused tests.

Before the first run all **4,385** predecessor build inputs matched unchanged;
its current build was reused. After the JS transport edit the mandatory build
passed. Actual parent and child modules in both runs remain **2,025,619 bytes**,
SHA-256 `168c61dae2861842948e5f9e29e4e18df93a6fab12c7d17f7dc85d75e34b7b55`,
with retained matching region mirrors. Source-input snapshots show test/run.js
as the sole changed existing input; retained read manifests verify **262** parent
reads before repair, and **262 parent / 117 child** reads afterward. The killed
first child's exit-time read manifest is unavailable. All **142 originals in
each recovered and registered tree**, package, companion manifest and registry
source hashes passed before and after; no host original was changed by the
child's disposable VFS writes.

Both invocations use open PTYs, outer **140 seconds / kill-after 5**, inner
**115 seconds**, and child **TERM at 75 / KILL at 80 seconds** watchdogs. The
pre-fix error dialog required that cleanup (outer **81.513 seconds**, parent 0,
child SIGKILL); the post-fix run completed in **1.733 seconds**, parent and child
0. Child stdout/stderr and INIs/logs were retained before temporary-tree removal.
The first failed child never exported its buffered Detected.log; it is not
claimed retained. All own parent/child/outer PIDs and temporary trees are absent.
Full checks are in `verification.json`; free disk remained above **2 GB**.
Box ID/state/expiry and lifecycle ownership: **N/A**. No browser, boats, agents,
download, deployment, held guest or unrelated defect work was performed.

## 2026-11-01: single child INI runtime diagnostic stops before the error branch

**Concrete blocker: the requested two-breakpoint diagnostic did not reach
either INI error branch within its finite child watchdog.** The runtime cause
remains unconfirmed. No DLL transport repair or regression test was made;
`test/run.js` is unchanged. The static transport defect below remains established,
but this run neither confirms nor contradicts its role in `MisingIni`.

Evidence is ignored under `scratch/runs/20261101-rune-child-ini-runtime/`.
Exactly **one** ordinary local parent CLI invocation ran, with `--app=rune_demo`,
empty parent guest arguments, original EXE and System cwd, `--spawn-processes`,
and child-only `--trace-fs`, the eight requested module/cwd/file/error API names,
and `--break=core+0x1014cbf8,core+0x1014cd29`. There was no `--trace-to` limit.
The actual child argv preserves the guest-requested
`testrendev=D3DDrv.D3DRenderDevice log=Detected.log`. Original host DLL seeds
are still forwarded while the child EXE is exported into
`/tmp/wa-child-Bc3eSD/in/system/rune.exe`.

`test/run.js` explicitly sets **BATCH_SIZE=1 when more than one breakpoint is
requested**, because WASM has only one breakpoint slot. This is a concrete
diagnostic constraint, not proof of the guest's reason for remaining before
appInit. Child PID **3017970** completed DLL initialization, registered cwd
`c:\system`, and last traced API **1005**, GetModuleFileNameA with **handle 0**,
returning `C:\system\rune.exe` from `0x10c1a365`. Core loaded at
`0x10ba9000` (original base `0x10100000`); that return maps to original
`0x10171365`, the already identified package-name query. Neither a Core-handle
module filename, SetCurrentDirectory call, failing INI operation, nor either
requested breakpoint was observed. Consequently the EBP-relative filename
buffers could not be inspected. There is no observed `MisingIni` in this run,
no renderer-test exit/result, and no preserved `Detected.log`.

The child watchdog sent TERM at **35 seconds**, then KILL at **40 seconds**;
its exit was `(code=null, signal=SIGKILL)`. The parent quit through control
stdin after cleanup and exited **0**, outer duration **41.859 seconds**.
The open-PTY outer guard was `timeout --kill-after=5s 100s`, inner limit
**60 seconds**; no outer timeout fired. Child stdout/stderr were retained
as they arrived, and INI/log/registry files were synchronously copied before
temporary-tree removal. The known, separate absent-output merge again reported
0 written / 203 deleted in the disposable parent VFS; it was not repaired.
All own parent/child/outer PIDs and the child temporary tree are absent after
process-group cleanup. No second diagnostic or post-fix invocation ran.

The actual inspected **640×480** `wizard.png` shows the first-run renderer
wizard with only **Software Rendering** selected. It establishes neither
successful renderer detection nor gameplay; no wizard Next or other player
input was sent. `final.png` preserves the final parent image.

Reused the Redline predecessor's current locked build after checking all
**4,385 recorded inputs unchanged**. Both actual parent and child compiled
**2,025,619 bytes**, SHA-256
`168c61dae2861842948e5f9e29e4e18df93a6fab12c7d17f7dc85d75e34b7b55`,
with matching retained region mirror. `preflight.json`, `source-inputs.json`,
`loaded-modules-*.json` and `verification.json` preserve identities and results;
all **262** retained parent read hashes match current files. The killed child
has no exit-time source-read manifest. All **142 originals in each of the
recovered and registered trees**, the installer, companion manifest and app
registry passed before/after hash checks. Original Core remains
`70394c5e0be98fad3bc4aa46109804ef179e624d1ef9f08a4bcee9e24801a6e6`;
original Rune.exe remains
`dd1588a902952414917b8cfc65996d46ec0323dc7d298c5a23d5b2ccf70f7add`.
No guest bytes, configuration, registry, clock or registers were changed.

Documentation-only outcome; no new build was needed and no code was committed.
Read-only identity/cleanup verification and documentation diff checks passed.
Free disk remained above **2 GB**. Box ID/state/expiry and lifecycle ownership
are **N/A**. Next evidence needed is still the actual Core-handle/cwd/failed-INI
chain; the two-breakpoint diagnostic's single-block constraint must be considered
before separately authorizing another bounded observation. This assignment
stops at the concrete diagnostic blocker.

## 2026-11-01: static child INI investigation — DLL identity loses System path

**Proven transport defect: the renderer child registers original Core.dll as
`C:\Core.dll`, whereas its parent registers it as `C:\System\Core.dll`.**
Original Core's startup derives its base directory from **its own DLL handle**,
then changes the file manager's directory. The correct EXE filename and inherited
cwd therefore do not exclude a later wrong-directory lookup. This provides a
concrete mechanism for the observed `MisingIni`, but the preserved runtime trace
does **not** identify the first failing operation or which error branch fired.
No startup repair is claimed validated; stop here pending the focused diagnostic
below. No game/child/browser runtime, build or production/test edit was performed.

Analysis evidence is in ignored
`scratch/runs/20261101-rune-child-ini-cause/`; input runtime evidence remains
untouched in `20261101-rune-renderer-child-cli`. Source identity was recorded at
main `bbfb46421afa71d0f3899f9dc3cd0ac2308183c8`, which contains incoming
`95b5a2440`. The previous actual module
`2be3cebaa1c08a8e12075de000bfb83fb8692841c1452d9e317203f5c2fce8cf`
(2,025,029 bytes) belongs to the earlier accepted `9ba1c215c` runtime;
it was **not** rebuilt or tested against current main. `identities.json` proves
the relevant path-helper/spawn snippets are byte-identical to `9ba1c215c`, as are
the complete examined VFS, DLL-loader, process-boot and GetModuleFileName source
files. Whole `test/run.js` differs through unrelated menu-shortcut diagnostics.

### Export, cwd and DLL identity

The retained argv for child **2999914** names EXE
`/tmp/wa-child-YQmIub/in/system/rune.exe`, VFS tree
`/tmp/wa-child-YQmIub/in`, guest EXE `c:\system\rune.exe` and cwd
`c:\System\`. Its DLL seeds instead point to the registered original
`test/binaries/candidates/rune-demo/game/System/{MSVCRT,Core,Engine,Window}.dll`.
`test/run.js`'s `spawnVfsChild` exports the VFS and propagates cwd correctly,
but forwards those host seed paths unchanged. `capturedGuestPath` only accepts
host paths inside the exported tree; `besideExeGuestPath` only accepts DLLs in
the host EXE's directory. Both reject each original seed in this child.
`lib/dll-loader.js`'s `loadDllsOwned` then uses `dll.path || C:\<dll.name>`;
the loaded-module GetModuleFileName handler returns that recorded path.

`node scratch/runs/20261101-rune-child-ini-cause/probe.cjs` **PASS** evaluates
the actual CLI helper definitions in a JS VM, using the retained argv without
starting the CLI or an emulator. All four parent System paths become root paths
in the child. Supplying the corresponding **exported** host paths to the same
helpers produces `C:\system\<name>.dll`. This last result validates path
mapping only: the removed full temporary DLL tree was not recreated or executed.

The retained input contains seven System files per invocation: six INIs and an
empty Rune.log. It is a selected preservation, **not** a complete retained
203-file snapshot. Rune.ini and Default.ini both hash to
`716bcfbbcc268f92b5e4a4da778680b1e1759751cf876e2ab4687da58d8ea3da`;
User.ini and DefUser.ini both hash to
`55d2f8f3f265e1c9a6ba4571fc0ac0457f50ec16ef4b1c3f753217e580b7ac6d`.
The pure-JS VFS probe opens all four relative names successfully at the actual
passed cwd and fails all four at `C:\`. This rules out case spelling and the
initial cwd argument as sufficient explanations for their absence; it does not
observe the live child's later cwd. No replacement INI was generated.

### Original binary lookup chain

Original **System/Core.dll**, 790,528 bytes, SHA-256
`70394c5e0be98fad3bc4aa46109804ef179e624d1ef9f08a4bcee9e24801a6e6`,
preferred base `0x10100000`, was disassembled read-only with objdump. Export
name ordinals were read from the PE itself; `appInit` is export index 1360,
VA `0x10102b21`, jumping to `0x1014c950`. Addresses below are original VAs,
not the child's relocated addresses.

* Core CRT entry `0x1017285f` calls `0x101013d9` → `0x101064c0`, which stores
  its hModule argument at `0x101e3c30`. The loader supplies Core's load address
  as hModule, not zero.
* `appBaseDir`, `0x101021c6` → `0x10170f70`, queries that stored handle through
  GetModuleFileNameA/W (IAT `0x102ab3b0` / `0x102ab3dc`), caches its directory
  at `0x102a9c80`, and strips the filename. `appPackage` separately queries
  **handle zero** at `0x1017135f` / `0x10171394`. The retained trace's return
  `0x10c1a365` maps to original `0x10171365`, so it proves the package/EXE
  query, **not** the base-directory/DLL query.
* appInit calls appBaseDir at `0x1014ca7d`, then calls file-manager vtable
  slot `+0x2c` at `0x1014ca8b`. Original Rune.exe passes its file manager
  `0x1094ed54` to appInit at `0x10908d01`; its vtable `0x109264ec` has slot
  `+0x2c` → `0x109011f4` → `0x10908580`, calling SetCurrentDirectoryA/W at
  `0x10908616` / `0x109085ba`. Thus a root Core path can override inherited
  System cwd before INI lookup.
* appInit uses `INI=` or `%s.ini`, checks file-manager slot `+8` at
  `0x1014cbb8`, and, on a negative result with the required flag set, tries
  **Default.ini** via appLoadFileToString at `0x1014cbec`. A zero return takes
  the first `MisingIni` branch at `0x1014cbf8`.
* It then uses `USERINI=` or **User.ini** and, on the corresponding negative
  check, tries **DefUser.ini** at `0x1014cd1d`. A zero return takes the other
  `MisingIni` branch at `0x1014cd29`. Both use the same untranslated error
  key. The reported key alone cannot distinguish these branches, or establish
  why the prior check/read failed. Missing Core.int localization is consistent
  with a wrong directory but is not separately established by the trace.

`Core.focused.disasm.txt`, `Rune.focused.disasm.txt`, `appInit.disasm.txt`,
`baseDir-package.disasm.txt`, `pe-symbols.json` and `iat-and-strings.json` retain
the chain, string encodings and addresses. Read-only pin checks passed for all
**142 originals in both recovered and registered trees**, plus the original
90,741,739-byte installer and current companion manifest. No original bytes,
registry or configuration were changed.

### Smallest next step and separate merge defect

One next authorized runtime diagnostic should repeat the ordinary parent/child
route with child-only `--trace-fs` and
`--trace-api=GetModuleFileNameA,GetModuleFileNameW,SetCurrentDirectoryA,SetCurrentDirectoryW,CreateFileA,CreateFileW,GetFileSize,GetLastError`,
**without `--trace-to=20`**, and
`--break=core+0x1014cbf8,core+0x1014cd29`. Keep the existing outer process
deadline and preserve child output synchronously before cleanup. Record the
hit address, module-path return, SetCurrentDirectory result, actual failed
filename/open/read result, and appInit's UTF-16 filename buffers at
`EBP-0x424` / `EBP-0x224`. This single run can distinguish Default.ini from
DefUser.ini failure and confirm or reject the root-directory mechanism before
any repair. The previous window hides later console lines, and the killed
child never reached exit-time export; repeating that window would lose the
needed evidence again.

The smallest supported **repair candidate**, if that trace confirms the chain,
is to preserve each parent's DLL guest identity when seeding the child: resolve
the existing guest DLL path to its corresponding exported host file and seed
that file. Do not infer a guest path from basename alone or change guest INIs.
The probe establishes this mapping correction, not successful appInit/D3D.

Separately, `spawnVfsChild` unconditionally calls `mergeChildState` on exit,
including SIGKILL. `mergeVfsTreeBack` treats an absent output root as an empty
map, then deletes every `before` entry. The pure-JS probe with an in-memory fake
VFS and **203** entries reproduces exactly **0 written / 203 deleted**, without
deleting any host or live guest files. Child output is saved only in the CLI's
normal final export section, which SIGKILL never reaches. A future lifecycle
repair must distinguish a completed snapshot from absent/incomplete output
before applying deletion semantics. This occurs after startup failure and
cannot explain the earlier `MisingIni`; no original disk data was deleted.

Documentation and scratch evidence only; focused JS/pin checks and doc diff
check passed. No build was needed or reused as evidence for current main.
Free disk remained above **2 GB**. Box ID/state/expiry and lifecycle ownership
are **N/A**; no runtime was acquired. This assignment stops at the identified
evidence limit.

## 2026-11-01: documented renderer child executes, then fails in appInit

**The actual renderer-test child now executes; its first observed functional
failure is `MisingIni` during `appInit`, before a renderer result.** This
supersedes the launch-option blocker in the previous observation. Shared main
`c076f8f2547d52555925c571b72b32455764c1f7` retains the accepted
`9ba1c215c1766b39da747f386e0820f7399f6c93` runtime unchanged. No production,
test, DLL, original configuration, registry or media changes were made.

The ordinary parent remains `--app=rune_demo`, original `c:\System\Rune.exe`,
cwd `c:\System`, empty guest arguments. Adding documented `--spawn-processes`
produced real child host PIDs **2998445** and **2999914** (guest transport PID
`4004`), each with the guest-requested command exactly:

```text
"C:\System\Rune.exe" testrendev=D3DDrv.D3DRenderDevice log=Detected.log
```

The first child's actual stdout reports its PE load, exact extra command line,
original seeded DLLs and imported parent registry, followed by:

```text
[C++ throw] .H  obj 0x179fd4d8 at EIP 0x10a69d54
[C++ throw] rethrow (obj 0x00000000)
[MessageBox] "Critical Error At Startup": "MisingIni

History: appInit" type=0x2010
```

`Core.int` translates `MisingIni` as “Missing .ini file: %s”; the child reports
the untranslated key and no filename. Its temporary input tree **does contain**
`system/rune.ini` and `system/user.ini`, both matching the shipped originals.
Thus missing original media is not demonstrated. The precise failing lookup
and whether DLL path/localization handling causes it remain **unproven**.
The transport seeds DLLs from the parent's original host paths while the child
EXE lives in its exported temporary tree; source excerpts retain that difference
and the `capturedGuestPath`/`besideExeGuestPath` rules for later diagnosis.
Do not treat this inference as a proven DLL-path cause or inject replacements.

A single focused diagnostic invocation added child-only `--trace-fs --trace-ini
--trace-api=GetModuleFileNameA,GetModuleFileNameW --trace-to=20`. Its observed
`GetModuleFileNameA(0)` calls return **`C:\system\rune.exe`**, then it throws
at the same startup location. The bounded trace did not identify the missing
lookup; later console output is suppressed beyond batch 20 and buffered
filesystem observations were not recovered on forced termination. No further
run was attempted. Across the assignment there were **three parent CLI
invocations total**: the first exited 1 in Node's preload resolver before
`test/run.js` loaded because the observer path had an erroneous `./` prefix
before an absolute path. Correcting that host harness error justified the first
guest run; the observed startup exception justified the final diagnostic.

Both guest runs reached the same parent wizard at batch **22100**, with
**18234 APIs**. The inspected 640×480 PNG shows only **Software Rendering**,
selected by the wizard, and Next/Cancel. `run3-wizard.png` and both final PNGs
are byte-identical to the inspected `run2-wizard.png`. This is neither a D3D
capability result nor software gameplay. No Next, menu/start, intro or ordinary
player input was attempted after the concrete child startup failure. No
successful renderer test or merged `Detected.log` was observed. No such log
was exported/preserved; the killed child's final in-memory VFS is unavailable.
CLI results establish no browser/WebGL behavior.

Lifecycle was inspected before execution. `spawnVfsChild` inherits the parent's
`--max-seconds`, relays stdout/stderr, merges the output tree on child exit,
removes the temporary tree and sends termination on parent exit. `getArg` uses
the **first** occurrence: the first run's appended `--max-seconds=90` did not
override its inherited **120 seconds**. Its outer guard was
`timeout --kill-after=5s 150s`; the diagnostic inherited **45 seconds**, with
outer **75 seconds** and an additional host child watchdog sending TERM at
35 seconds and KILL five seconds later. All are within the assigned ceilings.
Open PTYs kept control stdin alive. Frozen waits pause the CLI's internal
deadline, so the serial outer process-group guard remained necessary.

Neither child delivered a guest exit code or returned normally. First-run
SIGTERM after the startup failure was ineffective; explicit SIGKILL ended
child 2998445 after **105.8 seconds**. Diagnostic child 2999914 likewise ignored
the watchdog TERM and exited by **SIGKILL** at **40.0 seconds**. Both child
exit records are `(code=null, signal=SIGKILL)`. Parent exits are **0** after
control `quit`; reported parent durations are **58.040s** and **51.174s**.
The first parent's report precedes its eventual process exit while waiting
for its live child. These are cleanup outcomes, not guest success. Neither
outer deadline fired. After each parent, the harness sent TERM then KILL to
its process group; all assigned parent/child/group PIDs and both temporary
child trees are absent. No held guest remains.

A further transport limitation is observed: after each forced child exit,
its output directory was absent, yet merge reported **0 written / 203 deleted /
0 registry keys**. Those deletions affect only the disposable parent's VFS;
they are cleanup fallout, not authentic guest-created state or lost original
disk files. No continuation was attempted from that VFS. Read-only evidence
hooks retained temporary input INIs/logs before removal. The parent exported
one empty `rune.log` before first-child termination; no usable guest log or
runtime save resulted. No host fixture writeback was used.

Evidence: ignored `scratch/runs/20261101-rune-renderer-child-cli/`, including
exact command arrays, process argv/lifecycle NDJSON, separate child stdout and
stderr, parent logs and exit statuses, copied runtime-state INIs/logs,
module/source hashes, snapshots and preservation checks. Parent controls were
`step 22100`, PNG/snapshot and `quit`; no guest command override was supplied.
The evidence observer records reads, compile-byte hashes, child outputs/exits
and copies logs/INIs before temporary-tree removal; it does not change guest
bytes or imports. Only the diagnostic adds the bounded child cleanup timer.

Identity and original-disk preservation:

* Full fixture checks passed before/after: **142 originals / 128542865 bytes**,
  exact original package, all EXEs, single links and companion manifest.
  Registration checks also passed before/after.
* All four actual compilations (two parents, two children) consumed **2025029
  bytes**, SHA-256
  `2be3cebaa1c08a8e12075de000bfb83fb8692841c1452d9e317203f5c2fce8cf`.
  The matching module bytes are retained as `tested-module.wasm`.
* Rune.exe remains SHA-256
  `dd1588a902952414917b8cfc65996d46ec0323dc7d298c5a23d5b2ccf70f7add`;
  manifest remains
  `ed536fbc320e683319cfb824a7c901dfebf4633a578be5890b09eb549e0baf48`;
  Rune.ini remains
  `716bcfbbcc268f92b5e4a4da778680b1e1759751cf876e2ab4687da58d8ea3da`;
  User.ini remains
  `55d2f8f3f265e1c9a6ba4571fc0ac0457f50ec16ef4b1c3f753217e580b7ac6d`.
* Accepted locked build PASS **40.431s** from
  `20261101-thread-manager-options-land` is reused: all **1153** recorded
  source/tool/host/CLI input hashes are unchanged, tracked runtime diff against
  `9ba1c215c` is empty, and **95** distinct tracked actual parent reads match
  that commit. Killed children cannot provide exit-time read manifests; each
  actual child compile hash is preserved separately. Source input hashes and
  installed PNG/guest-media parent read identities are retained.

This documentation-only result uses diff checking and the unchanged accepted
build, with no unrelated test reruns. Observed free disk stayed above **2 GB**
(about 2.186 GB during child snapshot and 2.322 GB after cleanup). Local CLI
only: box ID/state/expiry/shutdown and lifecycle ownership **N/A**. No browser,
boat, benchmark, download, access/transfer retry, injected dependency/config,
agent/successor, held/REP guest, foreign WIP edit or deployment occurred.
Next technical work is to identify the child startup INI lookup and repair the
transport if warranted, then repeat the authentic renderer test before claiming
D3D support or pursuing ordinary wizard/menu/gameplay. This worker stops here.

## 2026-11-01: original local CLI reaches first-run renderer wizard

**First proven route blocker: the wizard's D3D renderer-test process is
acknowledged without execution.** Tested shared main
`9ba1c215c1766b39da747f386e0820f7399f6c93`, local Node CLI only, using the
existing `--app=rune_demo` registration. At batch 22100 the original graphics
wizard is visible. Its inspected 640×480 capture shows the Rune banner,
“Your computer supports the following 3D video devices”, only **Software
Rendering** in the list, the certified-compatible filter selected, and Next
and Cancel. This is the first-run wizard, not an installer, menu, intro or
player-controlled gameplay. No browser ran and no ordinary key/click input was
sent: execution stopped before Next rather than accepting an untested fallback.

The guest requested exactly:

```text
[ShellExecute] hwnd=0x0 op="open" file="C:\System\Rune.exe" params="testrendev=D3DDrv.D3DRenderDevice log=Detected.log"
```

The tested `test/run.js:4053` wrapper delegates to the base host and starts
the requested process only when `--spawn-processes` or the registered
`spawnProcesses` option is enabled. Neither is enabled in this assigned
route. `lib/host-imports.js:2226` logs the request and returns 33; it does
not run a local executable. No child launch appears in the complete log.
Thus this run **did not test the original D3D renderer**. The missing renderer
test is proven from the actual launch plus the loaded source; whether it alone
explains the software-only device list is not established. Do not interpret the
list as a genuine D3D hardware/capability failure or change the renderer to
advance. A fresh bounded assignment must address ordinary renderer-test child
execution and its lifecycle before qualifying the original selection. No
production repair or launch-policy edit was made here, and no third run was
attempted after finding this blocker.

Evidence is ignored under
`scratch/runs/20261101-rune-original-cli-progress/`. Exact launch command for
the inspected attempt (with an open PTY for stdin):

```sh
timeout --kill-after=5s 150s node --require ./scratch/runs/20261101-rune-original-cli-progress/observe.cjs test/run.js --app=rune_demo --no-build --wasm=build/wine-assembly.wasm --quiet-api --quiet-blocks --no-close --max-seconds=120 --control-stdin --frozen --png=scratch/runs/20261101-rune-original-cli-progress/run2-final.png --tee=scratch/runs/20261101-rune-original-cli-progress/run2.log
```

`observe.cjs` only records file-read and actual `WebAssembly.compile` byte
hashes; it does not modify guest state, imports, configuration or module bytes.
NDJSON control used `step` with `n=100`, capture/snapshot, `step` with `n=2000`,
capture/snapshot, then `step` with `n=20000`, capture/snapshot and `quit`.
The full transcript is in `run2.log`. Inspected captures:
`run2-b100.png` (blank teal desktop; no windows), `run2-wizard.png` and
`run2-final.png` (same wizard pixels). `run2-b2100.png` is byte-identical to
the inspected blank capture. The coherent final snapshot has focus `0x1000f`,
visible wizard `0x10003`, EIP `0x17a00d38`, quit false before host quit.
Run 2 exited 0 after 22100 batches / 18234 APIs / 27.767 seconds reported
by the CLI. Exit 0 proves neither gameplay nor a successful renderer test.

There were **two CLI invocations total**, serialized. Run 1 used the identical
command with `run1` output names but the tool closed stdin; after DLL
initialization it exited 0 while frozen, before main-loop batches, without a
PNG. This was a control-channel setup failure, preserved in `run1.log`, not
a guest compatibility result. The observed EOF justified correcting only the
stdin lifetime for run 2. Existing CLI internal child limits were inspected;
no child was launched, no held guest remains, and neither outer deadline fired.
The run also reports one auxiliary thread reaching EIP zero (previous
`0x10901a29`, stack retained) before the wizard. Its cause is unproven; the
main thread continued to create the wizard. Missing host `shell32.dll` and
`ole32.dll` warnings are retained, not treated as proven dependency failures
or permission to inject DLLs. No native crash/trap was observed.

Identity and preservation checks:

* `node test/binaries/candidates/rune-demo/.host/check-fixture.js` passed
  before and after: exact 142 originals / 128542865 bytes, package pin,
  four EXEs, single links, 141 companion manifest and all original hashes.
* `node test/test-rune-demo-registration.js --fixture` passed the exact
  registration/launch plan and actual CLI manifest resolver. Original
  `c:\System\Rune.exe`, cwd `c:\System`, empty args were preserved.
* Actual compiled module: 2025029 bytes, SHA-256
  `2be3cebaa1c08a8e12075de000bfb83fb8692841c1452d9e317203f5c2fce8cf`.
  `loaded-modules.json` records the bytes passed to compilation, rather than
  merely hashing a current build file. Rune.exe SHA-256 remains
  `dd1588a902952414917b8cfc65996d46ec0323dc7d298c5a23d5b2ccf70f7add`;
  manifest remains `ed536fbc320e683319cfb824a7c901dfebf4633a578be5890b09eb549e0baf48`.
* Shipped Rune.ini SHA-256 remains
  `716bcfbbcc268f92b5e4a4da778680b1e1759751cf876e2ab4687da58d8ea3da`;
  User.ini remains
  `55d2f8f3f265e1c9a6ba4571fc0ac0457f50ec16ef4b1c3f753217e580b7ac6d`.
  No configuration/registry/prerequisite injection, renderer/audio override,
  fixture change, dependency download or integrity bypass was used.
* Accepted locked build PASS (40.431s) from
  `20261101-thread-manager-options-land` was reused at its exact published
  source commit above. Tracked code diff was empty; all 1153 recorded
  source/tool/host/CLI input hashes remained unchanged. `loaded-reads.json`
  retains 152 actual read identities; all 94 tracked reads match the tested
  commit, and all reads still match after execution. Installed PNG support,
  existing comctl32.dll and guest-media hashes are recorded separately.
  No build or unrelated tests were rerun for this documentation-only change.

`commands.json`, fixture-before/after JSON, registration log, source-input
manifest, actual loaded-read/module hashes, launch-path excerpts and
`verification.json` preserve the bounded diagnostics. No corpus candidate ID
exists; result metadata explicitly uses null and is dashboard-ineligible.
Free disk remained above 2 GB (final verification about 2.35 GB). Box
allocation/state/expiry/shutdown and ownership are **N/A** for this local CLI
assignment. No browser, boats, transfer/access retry, benchmark, agent,
successor, public deployment or foreign WIP edit was performed.

## 2026-10-31: assigned browser attempt stopped at transfer authorization

**First blocker: runtime-bundle upload was denied before browser or guest
startup.** On shared main `0ce288d29f8ed763aa4ac3ca413974bc4b0b33de`
(descendant of `81f5df0c8966ef74e23bb0961cf8cc1e746d0efe`), the assigned
fresh box was `bx_wqqv4dah`. API exec succeeded, observing Node `v24.22.1`
and Google Chrome `151.0.7922.108 stable`. The first and only `boat scp -r`
upload to `/home/user/rune-runtime/` returned HTTP **403**,
`api_key_action_forbidden`: **“This API key cannot perform ssh.”** Successful
API exec did not authorize the SCP transport. No retry, credential change,
alternate channel, remote resume, other box or local heavy runtime followed.
This establishes an access prerequisite, not an engine dependency failure.

Evidence is local in `scratch/runs/20261031T2350Z-rune-original-browser/`:
`scp-upload.log`, `runtime-exec-observation.json`, `outcome.json`,
`transfer-manifest.json`, `source-compiler-identity.json`, `build-identity.json`,
`pins-after.json`, `registration-check.log`, and shutdown receipts.
The ordinary intended route remains
`http://127.0.0.1:8098/emulator/?candidates&app=rune_demo` via
`node ops/server.js --port=8098 --no-agents`, original `c:\System\Rune.exe`,
cwd `c:\System`, empty args. No host, browser, first-run wizard, New Game,
movement/look/fire or gameplay screenshots were reached. No guest failure
module can be identified because guest execution never began.

The full fixture check passed before staging. Read-only local hardlink
staging then temporarily raised guest link counts to two; a second preflight
correctly rejected that state at `.host/check-fixture.js:28`
(`game/Help/Logo.bmp`, expected link count one). All staging links were removed.
The durable final check again passes **142 originals / 128,542,865 bytes**,
exact file set, package SHA-256, all four original EXEs, no guest hardlinks,
and the unchanged 141-companion manifest pin `ed536fbc…e0baf48` above.
No original bytes/configuration/registry entries changed. The focused
`node test/test-rune-demo-registration.js --fixture` also passes.
The staging diagnostic is preserved separately; it is not a guest dependency.
Observed local free space remained above 2 GB (final fixture check: 2,359,427,072
bytes). No archive copy or second checkout was created; reusable fixtures remain.

Existing coordinator build/focused evidence at
`scratch/runs/20261031T2327Z-coordinator-census/` was reused without rebuilding.
The prepared tail-call module is 2,025,029 bytes, SHA-256
`2be3cebaa1c08a8e12075de000bfb83fb8692841c1452d9e317203f5c2fce8cf`;
compatibility module is 2,027,602 bytes, SHA-256
`ab6bac597310f042d2e51e03109105a1f2d1449e8be19f9d44d04c16e0a3fee1`.
These identify existing local binaries, **not browser-loaded modules**.
Source/compiler input hashes and the staged runtime-file inventory are retained;
no compilation or runtime qualification is claimed.

The original assignment explicitly delegated shutdown after evidence handback.
Denial evidence was already local before stop request
`2026-10-31T23:50:38.738Z`; operation `stop_b2461b2cfa4bf7de` completed,
and `stopped-state.json` verifies **stopped at 23:50:39.864Z**. Assigned expiry
was `2026-11-01T00:23:29.680Z`; guest cutoff 00:12, handback 00:16 and
shutdown deadline 00:18 were met early. No runtime ownership remains.
Any future ordinary browser attempt requires a separately authorized working
transfer path and fresh allocation; this worker launches no successor.

## 2026-10-31: local candidate registration

Integration validation: the mandatory locked build passed for tail-call and
compatibility WASM, including data-segment overlap checks. Focused registration,
builtin execution and callback-census mutation checks passed. Evidence:
`scratch/runs/20261031T2327Z-coordinator-census/`. The compiler-managed string
pool grew from 6144 to 6656 bytes for the additional module names; its generated
JavaScript layout mirror was regenerated and all layout gates passed.

`APPS.rune_demo` uses the durable original fixture and exact launch row below.
The coordinator reviewed the metadata-only callback census change; existing
boot and file-loading lifetimes are unchanged and ownership remains pending.

`LOCAL_CANDIDATE_APPS` labels it **Rune Demo (original, experimental)**;
it is absent from `DESKTOP_APPS` and `DEBUG_ONLY_APPS`. Public eligibility
is unchanged. No guest files, configs, DLL-loading code or manifest policy
changed; `localManifestIntegrity` remains absent without a bypass.

Evidence: `scratch/runs/20261031T2317Z-rune-demo-registration/`.
The accepted `.host/check-fixture.js` passed before registration; the focused
registration check with `--fixture` verifies the actual registry row against
the accepted launch plan, the production page's local/public selector
expressions, and the actual CLI manifest resolver. All 141 companion URLs,
VFS paths and sizes match, including three companion EXEs; the main EXE is
separate. Ordinary loading remains 51 eager / 90 streamable companions,
or 141 eager with synchronous fault reads. These are static local checks;
no HTTP, browser, installer or game ran. No gameplay claim follows.

The exact future ordinary local route is
`http://127.0.0.1:8098/emulator/?candidates&app=rune_demo`
when using `node ops/server.js --port=8098 --no-agents` rooted at this checkout.
A host serving the emulator at its root uses `/?candidates&app=rune_demo`.
`debug` may be added for diagnostics, but **does not replace `candidates`**.
The page requires a local hostname and `candidates`; `prod` overrides it.
No server was started and no live route was tested.

Next, in a separately authorized runtime task with browser access, rerun
`node test/binaries/candidates/rune-demo/.host/check-fixture.js` before launch.
Stop on any changed pin or missing media. Launch original `c:\System\Rune.exe`,
cwd `c:\System`, empty args; observe the original first-run wizard with empty
`FirstRun` and shipped `Rune.ini`/`User.ini`. Keep default renderer/audio/assets
and stop at the first actual dependency failure. No safe-mode flags, config
edits or registry injection. Boat ID/state/expiry and lifecycle ownership: N/A.

## 2026-10-31: durable local candidate prepared (no registration or runtime)

On main `65224c0ca25da0937337734303740847f14ee34e` or its descendants,
the accepted recovery below is now copied to the ignored, persistent candidate
`test/binaries/candidates/rune-demo/` (`F` below). **The future launch no longer
uses recovery-run URLs.** No source search, download, extraction, installer,
browser, game, project build or box lifecycle operation was repeated.
The only tracked change is this note; keep the ignored fixture when cleaning
scratch. Evidence for this preparation is
`scratch/runs/20261031T2305Z-rune-demo-fixture/`.

Candidate layout:

| Relative path under `F` | Purpose |
| --- | --- |
| `game/` | Exact complete original relative layout: 142 files / 128,542,865 bytes |
| `original-package/runedemo.exe` | Independent 90,741,739-byte original installer archive; never executed |
| `.wine-assembly-browser.json` | Ordinary schema-version-1 host manifest; 141 exact companions |
| `.host/original-payload-inventory.json` | Byte-for-byte accepted complete SHA-256 inventory |
| `.host/launch-plan.json` | Proposed entry, dependency plan and future route; no registration performed |
| `.host/pe-imports.json` | Accepted supplied-module imports, copied without reinspection |
| `.host/check-fixture.js` | Static local package/full-tree/manifest/policy preflight |
| `.host/RECOVERY.txt` | Local recovery instructions and identity pins |

All originals, six Help files, license, shipped INIs, assets and four EXEs
(`Setup.exe`, `System/Rune.exe`, `System/Setup.exe`, `System/UCC.exe`) remain
byte-for-byte equal to the accepted inventory. Package and guest files were
copied to distinct inodes with link count one, so guest changes cannot mutate
archival originals through a hardlink. Originals in the accepted recovery were
read only. Metadata stays outside `game/` and is never mounted as guest content.
No guest/configuration/registry/resource bytes were fabricated or patched.

Before copying, `/home` had **2,588,631,040 free bytes**. The package and
payload require **219,284,604 bytes**; admission included a further 20 MB
reserve, projecting 2,349,346,436 bytes free. Guards checked before each file
and MiB write; after copying, free space was **2,368,950,272 bytes**. All
observed checks stayed above the 2,000,000,000-byte floor. No foreign cleanup.

The new manifest SHA-256 is
`ed536fbc320e683319cfb824a7c901dfebf4633a578be5890b09eb549e0baf48`.
Each companion has exactly `url: 'game/<original-relative-path>'`,
`vfsPath: 'c:\\<original-relative-path with backslashes>'` and its accepted
byte size. Only the main `System/Rune.exe` is excluded from companions.
Its relative URL base is the manifest's directory, as both ordinary hosts
currently implement; all DLL seeds and main executable use repository-relative
candidate URLs. No manifest or entry URL needs the accepted scratch directory.

Static checks verify every package/payload hash, exact complete guest file set,
case-insensitive uniqueness, all four EXEs, independent copies, exact companion
set/paths/sizes, browser URL versus CLI path resolution, ordinary merge and
case-insensitive override precedence. Current helper
`lib/app-files.js` still hashes to
`4c1ce40b92aa990a4bc689bd98d5c0d92ab3af44dafeb93ca52ccbaf2c6124f7`.
Loading policy remains **51 eager / 7,411,746 bytes**, **90 streamable /
120,897,647 bytes**, no unknown sizes; all DLL/EXE/INI/INT companions are
eager. The synchronous-fault-read route correctly makes all 141 companions
eager. These are local policy checks, not HTTP or browser results.

`localManifestIntegrity` remains **absent**. Its existing opt-in requires one
EXE and rejects the original four-EXE inventory; the restriction was confirmed
without removing files, changing shared policy or adding a bypass. Full hashes
are checked by the external preflight before launch. Ordinary host loading
does not itself enforce those hashes or prevent later guest changes: recheck
before each fresh run and preserve the original package.

### Accepted registration row and first startup

Browser access was unavailable during preparation and was neither retried nor
investigated during registration. With separately authorized runtime access:

1. From the repository root, run
   `node test/binaries/candidates/rune-demo/.host/check-fixture.js` and require
   success. Stop on changed bytes or missing media; do not repin changed files.
2. Use the registered `rune_demo` row in `APPS` and local candidate label.
   The preparation task proposed this row; the uncommitted patch above supplies
   it, keeping it out of the public desktop list. Finish its build and publication
   before runtime use.

   ```js
   rune_demo: {
     exe: 'test/binaries/candidates/rune-demo/game/System/Rune.exe',
     exeGuestPath: 'c:\\System\\Rune.exe',
     workingDirectory: 'c:\\System',
     args: '',
     dlls: ['MSVCRT.dll', 'Core.dll', 'Engine.dll', 'Window.dll']
       .map(name => 'test/binaries/candidates/rune-demo/game/System/' + name),
     files: [],
     localFileManifest:
       'test/binaries/candidates/rune-demo/.wine-assembly-browser.json',
     requiredFiles: true,
     relativeMouse: true,
     fileConcurrency: 8
   }
   ```

3. After the static preflight, use the ordinary
   local host rooted at this checkout, e.g. `node ops/server.js --port=8098
   --no-agents`, and open
   `http://127.0.0.1:8098/emulator/?candidates&app=rune_demo`. Ops mounts the
   emulator at `/emulator/`; a host serving the emulator at its root uses
   `/?candidates&app=rune_demo` instead.
   That command/URL is an instruction for the future; no server was started
   here. **Registration is uncommitted WIP; the live route remains untested.**
4. Launch the shipped `[PlayShortcut]`: guest `c:\System\Rune.exe`, cwd
   `c:\System`, empty arguments. Observe the original first-run wizard;
   preserve empty `FirstRun` and original `Rune.ini`/`User.ini`. Do not select
   the shipped safe-mode shortcut (`-nosound -nohard -noddraw`) as a substitute.
   Stop at the first genuine startup dependency failure and retain its evidence.

Accepted direct imports are bundled Window/Core/Engine/MSVCRT plus USER32,
KERNEL32, GDI32, ADVAPI32 and SHELL32. The supplied dependency closure also
uses COMCTL32, comdlg32, ole32, OLEAUT32, WINMM, IMM32 and WSOCK32; these Win32
interfaces require host support, not fabricated guest DLLs. Supplied dynamic
modules and first-run settings remain as documented below: default D3DDrv,
windowed SoftDrv, Galaxy audio, `intro.run`, 640×480/fullscreen. DirectX 7+
behavior is unqualified. Glide/MeTaL are optional alternatives with absent
`glide2x.dll`/`metal.dll`; they are not prerequisites to copy into the default
route. OpenGlDrv and SGLDrv are supplied alternatives, not boot preload seeds.
Native exports, renderer/audio initialization, registry necessity and gameplay
remain untested. No forced success or runtime compatibility claim.

### Durable recovery without recovery-directory launch paths

The ignored fixture is local, not a Git or off-machine backup. Keep
`original-package/runedemo.exe`, inventory and license together. The package
and inventory SHA-256 pins below remain authoritative. `.host/RECOVERY.txt`
also records these steps. Recovery is an explicit future operation; none of
the extraction steps were run during fixture preparation.

If only `game/` is lost or modified, first claim a fresh ignored work directory
and the candidate paths, ensure package plus expanded output stays above 2 GB,
and verify the retained package pin. Use the pinned REWise revision/command
below with `F/original-package/runedemo.exe` as input and a **fresh** output
directory. Require the accepted 143-member CRC result; compare the full
`TEMP/runedemo` subtree against the pinned 142-file inventory, including exact
set equality and every size/SHA-256. Restore only with independent byte copies
into a new empty `game/` destination; preserve modified copies for diagnosis.
Wise's extra `UNINSTALL_PATH` member is installer material, not a guest file.
If the candidate package is absent, the accepted package remains a verified
local fallback; if both disappear, use the historical source recovery below
under fresh authorization. Never hardlink mutable guest files to either copy.

Host manifest reconstruction is deterministic: read the accepted inventory in
its stored order, omit only `System/Rune.exe`, map each remaining row to
`{url: 'game/' + path, vfsPath: 'c:\\' + path.replaceAll('/', '\\'),
size: bytes}`, wrap in `{schemaVersion: 1, files}`, and serialize as UTF-8
two-space JSON plus final newline. Require the new manifest hash above.
Recreate the proposed entry from this note; no shared registry or engine
changes are needed to recover the fixture itself. Re-run the static preflight.
Boat/runtime allocation, box ID/state/expiry and lifecycle ownership: **N/A**.

## 2026-10-31: original media recovered; ordinary launch prepared

**Static media recovery succeeded.** Shipped `System/Manifest.ini` identifies
**Rune Demo, Version=101 Demo**; the payload includes Human Head's original
demo license, release notes and October 2000 files. Work began on main
`1b8e2b4115a71dc38140053bdbe51e7ce7e3c7ce` and stayed on shared main.
No installer, game or browser ran. Compatibility and gameplay remain untested.
Browser availability is the next prerequisite; it was not investigated or
retried. No engine, registry, public app list or guest bytes changed.

Historical recovery media, evidence and original host metadata are ignored under
`scratch/runs/20261031T2253Z-rune-demo-media-resume/` (`R` below). Only this note
is committed. The historical disk-only outcome below is superseded by this
recovery; predecessor registry/local-media findings were reused, not repeated.

### Provenance and size check before package download

Direct source:
[GamesDomain demo mirror](https://ftpmirror1.infania.net/pub/gamesdomain/demos/runedemo.exe),
listed in its [directory](https://ftpmirror1.infania.net/pub/gamesdomain/demos/).
HTTP HEAD advertised **90,741,739 bytes**, byte ranges and last modification
`2002-04-04T22:00:00Z` (mirror timestamp, not release date).
[Contemporary release coverage](https://www.shacknews.com/article/10177/rune-demo-released)
dated October 29, 2000 reports Human Head's 86.5 MB demo.
[Frag-Net](https://www.frag-net.com/game_rune.html) independently labels the
FilePlanet `runedemo.exe` as the Win32 Rune demo, 86.5 MB; that second package
was not downloaded or compared.

Initially fetched only HTTP ranges `0-65535` and the final 131,072 bytes.
The PE stub identifies the Wise Installation Wizard, not the game executable.
REWise read the original Wise file table from the **64 KiB head before full
download**: **143 members, 128,692,369 expanded bytes**. This exact advertised
total superseded the rounded DiscMaster directory estimate. At admission,
`/home` had **2,820,882,432 free bytes**: package plus extraction plus a
200,000,000-byte reserve projected above the required 2,000,000,000-byte floor.
After extraction it had 2,600,448,000 free bytes; later checks still showed
about 2.59 GB. No foreign artifacts were removed.

[DiscMaster's historical CD catalog](https://discmaster.textfiles.com/view/14552/K-CD_2001-04.iso/Rune/runedemo.exe?json)
advertises the same package size and BLAKE3
`440b16040e7d96624ef063103c83dbbc0c7c9dd9c203449ac18006f6b2dbea09`.
This is upstream provenance, **not a locally verified package hash**: no local
BLAKE3 implementation was available. Matching size alone does not establish
equality. Saved HTTP headers, pages, ranges, catalog JSON and
`download-plan.json` retain these distinctions.

### Actual executable and complete original-file pins

| Object | Bytes | SHA-256 |
| --- | ---: | --- |
| Downloaded `runedemo.exe` installer | 90,741,739 | `048e14f0b9f5c9945ce506778452b251f6f625ba62a77e6b352ee33d3f3eca1a` |
| Actual `System/Rune.exe` | 233,472 | `dd1588a902952414917b8cfc65996d46ec0323dc7d298c5a23d5b2ccf70f7add` |
| `original-payload-inventory.json` | 22,016 | `914a23729fae4644e37db554cf0784530035c88f52691fde28443a5338fd52e6` |
| `full-extraction-inventory.json` | 24,155 | `5d5bf9defa1b266c539256f01f6d35d1ae6276acf5078827370824adca0aa64b` |
| `System/License.int` | 9,984 | `11cc9140a5b44f1b1fe614f36a8ec835120351c9a187a426d821477fac077996` |

The original game tree `R/extracted/TEMP/runedemo/` contains **142 files,
128,542,865 bytes**, including `Setup.exe`, `System/Setup.exe` and
`System/UCC.exe`. Complete extraction additionally preserves Wise's
149,504-byte `UNINSTALL_PATH` member. Each inventory contains the real relative
path, byte count and SHA-256 of **every** corresponding member, sorted by
case-sensitive relative path; JSON is UTF-8, two-space indentation, final
newline, with `schemaVersion: 1` and `files: [{path, bytes, sha256}]`.
Full-extraction paths include `TEMP/runedemo/`; payload paths start at that
root. These pins cover the whole original payload, not selected startup DLLs.

All six Help files, including `Help/ReleaseNotes.htm`, and
`System/License.int` remain unmodified. The latter is Human Head's shareware
demo agreement with distribution conditions; retain the complete original
package and license. No media was published or redistributed.

### Reproducible static recovery

Extractor source: official REWise revision
[`c3d3b68903a90ec53ff7b0a4ae704adc6302814b`](https://codeberg.org/CYBERDEV/REWise/src/commit/c3d3b68903a90ec53ff7b0a4ae704adc6302814b).
Source archive URL is
`https://codeberg.org/CYBERDEV/REWise/archive/c3d3b68903a90ec53ff7b0a4ae704adc6302814b.tar.gz`;
1,724,088 bytes, SHA-256
`7f18fd53180cc4f9547fb62c232952b414b71e5c89286604751c898a91e447da`.
Extracted only `rewise/src/`, README.md, COPYING and Makefile (276,556 bytes).
The locally compiled 90,856-byte extraction helper has SHA-256
`80182291fe1b7d4c22d06cc568100692106ccb7b6e19fae0615198918281cf1c`;
compiler-dependent binary identity is separate from source identity. No
project/runtime build or compilation container was used.

Use a newly claimed ignored directory for reproduction; replace `R` below
with that path and preserve existing destinations. First repeat HEAD/disk
admission, download the source archive and verify its hash, then extract only
the source paths above. Require HTTP 206 for the range probe:

```sh
R=scratch/runs/20261031T2253Z-rune-demo-media-resume
gcc -Wall -I"$R/rewise-src/rewise/src" \
  "$R"/rewise-src/rewise/src/{rewise,CP1252,print,reader,exefile,pkzip,wildcard,wisescript,wiseoverlay}.c \
  -o "$R/rewise" -lz
mkdir -p "$R/rewise-tmp"
curl --fail --range 0-65535 \
  https://ftpmirror1.infania.net/pub/gamesdomain/demos/runedemo.exe \
  -o "$R/range-head.bin"
"$R/rewise" -l -p -t "$R/rewise-tmp" "$R/range-head.bin"
# Require 143 members / 128692369 expanded bytes and sufficient disk headroom.
curl --fail https://ftpmirror1.infania.net/pub/gamesdomain/demos/runedemo.exe \
  -o "$R/runedemo.exe"
# Verify package SHA-256 against the table before extraction.
mkdir "$R/extracted"
"$R/rewise" -x "$R/extracted" -p -t "$R/rewise-tmp" "$R/runedemo.exe"
"$R/rewise" -V -p -t "$R/rewise-tmp" "$R/runedemo.exe"
node "$R/check-media.js"
```

Regenerate inventories in the stated format for a fresh run and compare their
pinned digests and every original member. Retained `check-media.js` verifies
this existing recovery, package, inventories, complete file set and host
metadata. Actual download used bounded Python streaming with a package-size
cap and disk checks before each MiB; extraction also monitored the disk
reserve. Repeat those guards if shared usage is changing. Verification gave
**143 CRC32 successes, exit 0**; advertised paths/sizes equal the extraction
exactly. `source-preflight-correction.txt` records planning errors corrected
before package download: a conservative source-size guard and a directory
parser initially counting the site's download-limit label.

### Ordinary host manifest and dependency plan

`R/browser-manifest.json` is host metadata **outside the original tree**:
schema version 1, 141 companions, each with its actual size, URL
`extracted/TEMP/runedemo/<relative-path>` and `vfsPath` `c:\<relative-path>`.
Only main `System/Rune.exe` is excluded from companions. All original tools,
docs, configurations and assets remain mapped. Manifest SHA-256:
`589295d2c89266db60bb2cfca317e22db7c937294d0e9e40516fe6dfc9c41630`.
`R/launch-plan.json` contains the full proposed ordinary local entry:

```js
{
  exe: R + '/extracted/TEMP/runedemo/System/Rune.exe',
  exeGuestPath: 'c:\\System\\Rune.exe',
  workingDirectory: 'c:\\System',
  args: '',
  dlls: ['MSVCRT.dll', 'Core.dll', 'Engine.dll', 'Window.dll']
    .map(name => R + '/extracted/TEMP/runedemo/System/' + name),
  files: [],
  localFileManifest: R + '/browser-manifest.json',
  requiredFiles: true,
  relativeMouse: true,
  fileConcurrency: 8
}
```

The shipped `[PlayShortcut]` specifies `%DestPath%\System`, `System\Rune.exe`
and **empty parameters**. Keep that route and original first-run wizard.
`Rune.ini` and `User.ini` are shipped originals; do not generate replacements.
Rune.ini has empty `FirstRun`, 640×480 settings, `StartupFullscreen=True`,
`D3DDrv.D3DRenderDevice`, windowed `SoftDrv.SoftwareRenderDevice`,
`Galaxy.GalaxyAudioSubsystem` and `LocalMap=intro.run`. Relative search paths
cover System, Maps, Textures, Sounds, Music and Meshes. Seven original maps
include Intro, Entry, DEMOHel1 and DEMOThor. No Music files are shipped; a
generic Music search path does not establish a missing required download.

Current `lib/app-files.js` SHA-256 is
`4c1ce40b92aa990a4bc689bd98d5c0d92ab3af44dafeb93ca52ccbaf2c6124f7`.
Cheap merge and loading-policy checks pass: **51 eager companions /
7,411,746 bytes; 90 streamable / 120,897,647 bytes**, zero unknown sizes.
All DLL/EXE/INI/INT companions stay eager. Its optional
`localManifestIntegrity` helper rejects inventories with multiple EXEs; that
one-EXE limit was confirmed against this complete four-EXE tree. Do not enable
the opt-in or delete original files to satisfy it. Use the ordinary manifest
route and verify all original pins before a future launch.

Static PE inspection of all 17 DLLs and three System EXEs is retained in
`*.pe.txt` and `pe-imports.json`. Rune directly imports Window, Core, Engine,
bundled MSVCRT and ordinary Win32 system APIs. Original dynamically selected
modules include WinDrv, Render, SoftDrv, D3DDrv, OpenGlDrv, Galaxy, IpDrv and
Fire. Release notes require DirectX 7.0 or later; D3DDrv resolves DirectDraw
entry points dynamically. Glide/MeTaL alternatives import absent
`glide2x.dll`/`metal.dll`; they are optional renderer dependencies, not reasons
to fabricate DLLs or preload every alternative. Host API support, decorated
native exports, renderer/audio initialization and first-run behavior remain
runtime questions. Installer metadata includes associations and installed-app
registry entries; necessity for direct gameplay is unproven. No keys, version
resources, replacement DLLs or success overrides were injected.

Next prerequisite: available browser access for a separately authorized
ordinary local launch, with the proposed entry added to the local registry
(future ID `rune_demo`, route `/?debug&app=rune_demo`) and media served by the
ordinary host. **That route is not currently registered or live.** Observe the
original first-run flow and stop at its first actual dependency failure;
do not skip it with safe-mode flags, configuration edits or registry injection.
No graphics, input or gameplay claim follows from this recovery.
Boat/runtime allocation and box ID/state/expiry: **N/A**.

## Historical pre-recovery record (superseded media unknowns)

Predecessor run `20261031T2252Z-rune-demo-original-recovery` examined main
`239b5e25917a336f2ffaf6a61c836c568e31a211` and stopped before source recovery:
free disk was initially 1,419,689,984 bytes, later 1,582,256,128. Its original
`preflight.json`, `host-preflight.json`, `local-media-search.txt` and
`RECOVERY.txt` remain untouched. The owner subsequently restored disk by
hardlinking verified duplicate cabinet bytes.

Reused findings: no Human Head Rune in the checked public/local/debug/APPS
registries (46 public, 184 local rows at that preflight), corpus or status
notes; no competing qualification/hold found on the board. **Runenlegen** is
an unrelated board game at
`binaries/wep32-community/Runenlegen/Runenlegen.exe`.
The predecessor's `rg --files --hidden -g '!node_modules' -g '!.git' /home/user`
filename search found only its note/handoff. Arbitrarily named compilation
archives, other mounts and archive contents were not searched; the result
never proved universal media absence. It also confirmed the ordinary
schema-version-1 manifest route in both hosts and available shared helpers.
The present recovery resolves its media/pin/launch-plan unknowns above.
