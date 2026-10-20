# ScreenSaver callback census reconciliation — 2026-10-20

Source-only declaration repair for reviewed ScreenSaver `95d2f43d868d60d84d945b20f393863176622d64`,
as reconciled in `b222e28dce8ed9538e1ce5158e4cbc8c9c0cf659`.
Task branch: `task/screensaver-ownership-census-fix-oct20`. No main integration.

The retained `scratch/runs/20261020-watx-source-capacity-fix/build-retry.log`
shows the canonical build passing the 128-fragment manifest and balance checks,
then failing the callback census: changed host/apps/browser-shell SHA values,
changed control dispatcher SHA and call list, and unknown `scrsave_open` and
`scrsave_pump`. No module was emitted. The complete source scan here reproduces
those exact seven diagnostics, without compiling or running the emulator.

## Declaration review

This gate inventories boundaries; its only supported ownership assertion is
`pending`. The repair changes four existing entries and adds two exported
wrappers. It does not change the scanner, compiler, routing, production code,
or independent nonlocal-API review lock. The other 397 entries are identical.

* `host.js`: the prior digest resolves exactly to the file at `f0f203b185c633f0e4d9fface4fca8b3aba23c13`.
  The complete delta adds `.SCR` registry launching, applet startup guards,
  local-instance-only startup and the synchronous applet pump branch.
  `loadWatApp` rejects an occupied/stopped host, resolves `${name}_open`,
  invokes it synchronously, and stops/rethrows on failure. Intent is set before
  initialization so worker startup is suppressed. Async preparation and
  instantiation checkpoints check `_stopped`; the shell separately checks its
  cancellation context. The step closure retains the host between ticks,
  calls `wat_app_pump`, stops on zero/trap and schedules a bounded idle wait
  otherwise. Existing `stop` cancels wakeups, retires the host and defers memory
  release when called from a live slice. These are lifecycle conditions, not
  retained guest invocation tokens.
* `lib/apps.js`: the old digest resolves to `a050a9ef28e58bd9d08207fe797352a000f5b550`.
  The complete delta is ScreenSaver's desktop icon/`watApp: 'scrsave'` selector
  plus the separately integrated private MadBomber registration. Its file
  mapping callback only constructs path metadata; it invokes no guest code.
  The selector chooses the dynamic host export and therefore belongs in this
  conservative host inventory. No registry data was edited.
* `lib/browser-shell.js`: the old digest resolves to `43c873950380980aa9ee8e902e94697b89c9bd62`.
  The delta marks intent before `init`, skips guest system-data mounting,
  awaits applet opening, checks cancellation/stopped, registers and runs the
  host. `createdWine` retains cleanup responsibility before registration;
  `failLaunch` stops it after an awaited failure. `onStopped` unregisters a
  running instance. Preview calls the existing `launchExe`, which resolves the
  registry and starts/queues a separate process. Single-app mode has replacement
  semantics; the declaration does not promise concurrent saver survival.
* `$control_wndproc_dispatch`: class 35 now directly forwards all four message
  arguments to `$scrsave_wndproc`. This exported wrapper writes no EIP, but
  reaches callback-capable USER helpers. Its full direct-call list gains
  `$scrsave_wndproc`; refreshing only the digest would leave the gate failing.
* `$scrsave_open` / `scrsave_open`: allocates the lifetime 28-byte MSG block,
  registers a native window before host creation, creates native children and
  initializes selection and focus. Allocation failure returns zero; host
  creation failure closes the partial applet. Native child construction sends
  WM_CREATE using temporary heap storage. Static text is synchronously sent
  and copied before temporary storage is freed. Focus and message sends reach
  USER notification/callback paths. There is no direct EIP write, private token
  or retained guest continuation in this export.
* `$scrsave_pump` / `wat_app_pump`: snapshots one process-owned input before
  USER activation and message dispatch; the input, post and paint loops have
  bounds of 64, 64 and 32. The MSG allocation is retained across ticks, not
  across a separately owned guest callback. Synchronous input Close returns
  before another dequeue; posted Close breaks and rechecks before scratch
  reuse. Paint dispatch and native notification may recurse into USER.
  `scrsave_close` clears applet globals, frees MSG, destroys descendants/root,
  reports host window destruction and sets quit. Preview routes through the
  host shell rather than injecting guest EIP into this applet.

The reviewed helper context is significant: `wnd_send_message` brackets paint
scratch; its native sentinel route directly dispatches WAT controls. Its guest
route acquires a synchronous invocation before guest frame writes and validates
expected child/root/depth before restoration. Those helpers already have census
records. `message_mouse_activate32` snapshots/restores MSG around activation;
`wnd_destroy_tree` sends destruction callbacks before removing records. Calling
these helpers is precisely why the new exports are inventoried. Zero direct
EIP writes cannot justify calling the wrappers callback-free.

## Validation and limits

Commands from the task worktree:

```sh
node test/test-callback-ownership-census.js
node tools/screensaver-ownership-census.test.js --source-ref=b222e28dce8ed9538e1ce5158e4cbc8c9c0cf659
git diff --check
```

The new regression reads the exact Git snapshot into memory using the canonical
scanner's source-selection scope: all 129 root WAT/WATX files, root JS and
recursive lib JS (267 total). It uses the real `scanSources`, `check` and
`checkNonlocalAPIs` functions with the edited local declaration. All 403 records
pass. This is the complete tracked source inventory at the named commit, not a
claim that running the CLI against an incomplete sparse directory is sufficient.

Twenty rejection controls cover real host cancellation, shell registration,
registry selector, class routing, MSG allocation, input/post Close guards,
export changes even after digest refresh, stale control call lists, missing
export declarations, an unknown transitive wrapper, six false ownership
assertions and the independent nonlocal handler/API lock. Existing census
mutation tests pass. These are source tests; they do not execute the emulator.

Remaining safety obligations: full production allocation/error cleanup,
reentrant destruction during activation or paint, real native/GDI teardown,
async cancellation at each await, DOM input routing, separate saver launch and
survival after applet Close in the appropriate shell mode still need actual
fullVM/browser evidence. The static census pins exported bodies and host files;
it does not independently hash every unexported helper or prove computed JS
dispatch exhaustive. General retained-context ownership and dual-dispatch
nonlocal-jump conformance remain pending. No blanket exemption, safety
certification, build success or runtime qualification follows from this repair.

## Evidence and recovery

Evidence: `scratch/runs/20261020-screensaver-ownership-census-fix-oct20/`.
`baseline.json` retains the original seven errors; `actual-six.json` records
scanner output; the three `.diff` files retain complete host-source deltas
against the exact prior digest; `audit.js` and `update.js` reproduce the audit
and the six-record edit. `regression.log`, `validation.json`, `change.patch`,
`receipt.json`, `remote.txt` and `SHA256SUMS.json` preserve checks and publication.

The exact sparse checkout is `/tmp/wine-screensaver-ownership-census-fix-oct20`.
Its explicit file patterns in `preflight.json` were installed in its worktree
Git directory **before** `read-tree -mu HEAD`. Sparse settings and automatic
upstream suppression were command-local; shared config was not edited.
Existing candidate source was inspected read-only; the complete scan reads
committed blobs without materializing the source tree. Fresh admission was
2,976,083,968 bytes against 2,269,118,464 bytes (floor 2,210,398,208 plus 32 MiB
reserve and 24 MiB concurrent caps). This task's cap is 8 MiB. The shared
HEAD/index/config hashes are compared in the final receipt. Unrelated WIP,
laptop and all review holds remain untouched. No workers, runtime, browser,
heavy build, SSH, Claude or deployment were used.
