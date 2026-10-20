# Independent ScreenSaver declaration review — 2026-10-20

**REJECT the six-record change as written: five boundaries ACCEPT, pump boundary REJECT for an overstated paint bound.** These verdicts concern truthful source inventory descriptions with `ownership: pending`. No boundary is accepted as runtime-safe. No production change or main integration was performed.

Reviewed candidate: `a4e1100b0cf9b1e4d3037dccc73c286f20e1751c`,
`task/screensaver-ownership-census-fix-oct20`, parent
`b222e28dce8ed9538e1ce5158e4cbc8c9c0cf659`.
The candidate changes only the census, its focused source test and report.
`checks.json` records exact Git blob IDs and raw-file SHA-256 identities for
all 16 inspected source/test files, plus the six canonical census hashes and
candidate tree. Source was read from those Git blobs, not shared working files.

| Boundary | Verdict | Independent finding |
| --- | --- | --- |
| `host.js:host-file` | ACCEPT | `loadWatApp` at 3717 rejects occupied/stopped hosts, suppresses Worker startup through intent, resolves `${name}_open`, checks open/pump exports and stops/rethrows failures inside startup. Init checkpoints follow async preparation, fonts and instantiation (2881, 2921, 2992). Run at 6780 calls pump synchronously, stops on zero/trap and schedules 50ms idle waits. Stop cancels producers and defers ordinary browser memory release. None of these is an invocation token or proof of cancellation safety. |
| `lib/apps.js:host-file` | ACCEPT | `watApp: 'scrsave'` is a selector, not a guest callback. Registry mapping constructs metadata. It does not own the new process or certify Preview launch. |
| `lib/browser-shell.js:host-file` | ACCEPT | New host and applet intent precede init (2961); `createdWine` owns pre-registration cleanup (2686/2702). Cancellation/stopped checks precede registration (3302), and `onStopped` unregisters (3238). Preview resolves via `launchExe` (3927). In single-app mode it queues with `waitForExit`; dispatch waits while any app remains (2493), rather than immediately replacing the applet. “Replacement semantics” must be read as eventual queued launch after exit, never concurrent survival. |
| `src/09c3-controls.wat:$control_wndproc_dispatch` | ACCEPT | Class 35 forwards hwnd/msg/wParam/lParam to `$scrsave_wndproc`; the call list includes it. Native sentinel dispatch can recurse through USER and close or launch; zero direct EIP writes does not make it callback-free. |
| `src/09ca-screensavers.wat:$scrsave_open` | ACCEPT | The 28-byte MSG allocation has an explicit zero return; host-create failure calls Close. Construction, message sends and focus reach USER. The declaration explicitly withholds allocation/reentrancy/teardown certification, which is necessary: child CREATESTRUCT allocation is unchecked, text allocations and child failures are not comprehensively unwound here. The phrase “allocation failure returns zero” describes the top-level MSG check, not all downstream allocations. |
| `src/09ca-screensavers.wat:$scrsave_pump` | REJECT | Its reason says it drains “at most 64 owned inputs, 64 posts and 32 dirty paints per tick.” The 32 bound only governs the final `$paints` loop. Before that loop it calls `$paint_drain_native_control_paints`, whose independent guard is `$MAX_WINDOWS` (256), and which dispatches WM_PAINT itself. Nested callbacks can cause further work. The declared total paint bound is not truthful. Correct the description to distinguish the native drain from the final 32-iteration loop; no implementation change is requested by this review. Its other qualified lifetime statements are supported, subject to the obligations below. |

## Callback and lifetime findings

`scrsave_close` clears HWND globals and frees MSG **before** destruction
callbacks. Input Close is checked after activation/send, and posted Close is
checked before the next scratch reuse. Those checks cover their stated normal
paths; they do not protect all reentrancy.

In `src/09a5-handlers-window.wat:1849`, `message_mouse_activate32` captures the
MSG pointer, calls `wnd_send_message` and activation helpers, then writes all
seven MSG words back through that same pointer. If a callback closes the
applet and frees the allocation, restoration precedes the pump's HWND check.
This is a concrete conditional use-after-free hazard in the call ordering,
not evidence that an ordinary unmodified ScreenSaver UI currently triggers
it. Prove reachability or exclusion and allocation identity before claiming
reentrant safety. Native-drain and final-paint callbacks likewise have no
applet-alive recheck at each boundary; the pump ends with constant 1 even
after possible paint-time teardown.

`wnd_send_message` brackets paint scratch and its guest route owns synchronous
invocation state; native sentinel dispatch runs directly. This does not extend
the lifetime of the caller's MSG allocation. `wnd_destroy_tree` sends WM_DESTROY
before removing the record; descendants notify the host individually.
`ctrl_create_child` allocates a temporary 48-byte CREATESTRUCT, sends WM_CREATE,
then frees it, with no allocation check. Open also passes allocated text to
creation/list messages without local reclamation. A source census cannot
certify complete heap/GDI cleanup or callback completion under allocation
pressure. No blanket ownership conclusion follows from the sender's guards.

Preview calls `host_shell_execute` and reaches shell registry launch, not
`process_spawn` child ownership. A success return can mean queued/accepted
launch, not a booted saver. Desktop mode's separate host is the intended
survival case. Single-app mode waits for the applet to exit before starting
the queued saver. Neither behavior was exercised here.

## Reproduction and meaningful controls

Run from the isolated task checkout:

```sh
node test/test-callback-ownership-census.js
node tools/screensaver-ownership-census.test.js --source-ref=a4e1100b0cf9b1e4d3037dccc73c286f20e1751c
node docs/re-notes/screensaver-census-independent-review-20261020/review.js
```

Existing census mutations PASS. Focused candidate regression PASS:
267 source files, 403 entries, 20 rejection controls. Independent assertions
confirm exactly six changed entries, all pending, with 397 unchanged.
All 15 prior evidence seals, including receipt/report-related evidence,
verify. Test logs and exact identities are retained beside this report.

Seven independent mutation controls run in memory:

* Reducing MSG from 28 to four bytes is rejected by the old digest, but passes
  after refreshing it. The test does not validate memory access safety.
* Removing the shell cancellation checkpoint similarly fails before digest
  refresh and passes afterward.
* Removing the free in unexported Close passes unchanged census.
* Replacing the unexported Preview shell call with an unresolved helper passes
  unchanged census. A later compile would fail; this task did not compile.
* Replacing the pump's prose with a false safety claim passes the checker.

The five passing unsafe/false/unresolved variants are expected demonstrations
of gate limitations, not acceptable production mutations. No mutation was
written to production files. Independent structural assertions establish the
separate 256/32 paint guards and activation's post-callback pointer writes.
The candidate test comment saying its mutations prevent substituting a digest
refresh for lifetime review overstates what those digest-only checks enforce.

Existing applet/input/wiring tests were inspected but not executed: applet
tests replace allocation, USER, GDI and shell boundaries; input tests compile
real control/activation paths but replace teardown, heap, paint and shell,
and assert frees by exact base pointer rather than allocation ranges.
The wiring test uses fake init/stop/exports and textual shell checks. Their
normal input/Close checks cannot establish DOM lifecycle, reentrant allocation
validity, complete cancellation cleanup or separate saver survival.

## Remaining acceptance obligations

1. Correct the pump declaration's total paint-bound claim and rerun declaration
   tests. Keep every ownership assertion pending and all existing review holds.
2. Before any future browser lifecycle test, the canonical build must pass on
   the exact reconciled source, with module hash and source map retained.
   No canonical build was attempted in this task.
3. Qualify allocation failures at MSG, CREATESTRUCT, text/list/control and
   native/GDI resource boundaries, including partial construction and complete
   teardown. Detect writes throughout freed ranges and allocation reuse.
4. Exercise or rigorously exclude Close during mouse activation, focus,
   native paint, final paint and destruction callbacks. Verify scratch identity,
   HWND validity, callback completion and no post-teardown rescheduling.
5. Cancel at each actual async startup stage and queued-launch transition;
   verify no orphan host, registration, memory, wakeup or late mutation.
6. Use ordinary DOM list selection/scroll/double-click and button press,
   release, outside-release/cancel, title-bar Close and keyboard paths; prove
   process-owned routing and foreign input preservation.
7. In desktop mode verify the registered saver really boots and survives
   applet Close. In single-app mode verify the pending launch begins after
   exit, including launch failure/cancellation and repeated requests.

Runtime resume remains blocked by the recorded 403. No reroute, runtime,
full build, browser, Boat, SSH, Claude, deployment or worker launch was used.
General retained-context ownership and nonlocal-jump holds remain pending.

## Preservation and recovery

Evidence directory:
`scratch/runs/20261020-screensaver-census-independent-review-oct20`.
The committed report, test, logs, checks and preflight preserve recovery without
ignored binaries. The test reads the exact candidate objects from Git.
Sparse checkout `/tmp/wine-screensaver-census-independent-review-oct20`
had nine explicit file patterns installed before materialization.
Fresh admission was 2,951,553,024 bytes (the earlier 2,955,571,200-byte observation
was not treated as current), exceeding 2,269,118,464 bytes: floor 2,210,398,208
plus 32 MiB reserve and 24 MiB concurrent caps. Own cap is 8 MiB.
Only review files are committed; shared HEAD/index/config, laptop HeroesII,
WarcraftIII and unrelated WIP remain untouched. Do not merge this branch's
ancestry wholesale: it contains the unreconciled ScreenSaver ancestry.
