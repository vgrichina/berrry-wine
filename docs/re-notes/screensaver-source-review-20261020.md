# Screen Savers recovery source review — rejected

Candidate `4c98907328917f5917a59445bb4d5ce3e2caca09`, verified on
`origin/task/screensaver-recovery-bounded-oct20`; base
`72fc79100d7fe68476667ee4d8ed54a60163b396`. Independent bounded review,
2026-10-20. No production changes or main integration.

## Blocking finding: ordinary control input is never consumed

**P1: the recovered no-PE pump is incompatible with current renderer input.**
`src/09ca-screensavers.wat:397` drains WAT posted messages and paints, explicitly
omitting host input polling. `host.js:6791` calls only that pump and repaint.
However, current `lib/renderer-input.js:1300` `_dispatchMouseEvent` queues events
in `renderer.inputQueue`; it no longer synchronously sends them to a native
window. The ordinary-window child path (`:2203` onward) uses that function.
The applet is created through `host_create_window` / `renderer.createWindow`,
not the dialog registration path. Its frame has no `isDialog`, `isFindDialog`
or `isAboutDialog` flag, so the direct dialog route at `:2111` is inapplicable.
Neither its listbox (class 4) nor buttons (class 1) qualify for the combobox or
ThunderCommandButton exceptions. `host.js:2523` exposes the queue consumer as
`check_input`, but the applet never calls it.

Minimal retained reproduction:

```sh
node scratch/runs/20261020-screensaver-source-review/reproduce.js
```

The script reads the exact candidate renderer input blob from Git, runs its
actual `handleMouseDown` and `_dispatchMouseEvent`, and compiles the unmodified
candidate applet using its retained small fixture. Geometry and unrelated
device plumbing are doubles, as are the original fixture's controls. A press
inside Preview queues WM_NCHITTEST (132) and WM_LBUTTONDOWN (513) for HWND 207.
After three actual applet pumps, both events remain queued. No control receives
the press, and no saver launches. A direct posted WM_COMMAND/IDOK positive
control launches `WIN98.SCR`. This proves the undrained input boundary, not
whole-browser execution. List selection and the Close button use the same
unconsumed path; the title-bar system-button path is separate and is not claimed
broken by this reproduction.

The existing test masks this defect by injecting WM_COMMAND directly into the
WAT post queue, skipping renderer input and the control notification that must
produce that command. Its host fixture replaces `init` and `stop`; its painting,
window destruction, allocation and ShellExecute doubles do not qualify actual
lifecycle integration. All **12** original focused checks replayed successfully
without editing the retained source or original evidence. Passing those checks
does not resolve this failure.

Required next assignment: adapt applet input delivery to the current owned
input/activation architecture, with a regression starting at renderer input
and observing real native list/button behavior. Do not accept direct post
injection as the sole user-interaction test. No fix was made in this review.

## Other reviewed boundaries

- Historical `40193154` applet data, control IDs, geometry, and behavior are
  faithfully retained; differences in the applet itself are class 33→35,
  host-window failure cleanup, and checking ShellExecute's result. Class 35
  does not displace MDI 33 or Animate 34. IDs remain list 0x500, Preview 1,
  Close 2, statics 0xffff.
- All 19 catalog entries are unique and registered. The static table terminates
  before UI strings; invalid index/field fixtures pass. The walker relies on
  its immutable NUL-terminated table, not a general corrupted-memory bound.
  SCRSAVE_TEXT is allocator-declared at 4096 bytes; all 263 preexisting region
  records remain unchanged. Current generator/declaration checks pass.
- The post-drain Close path reads its arguments before calling the wndproc,
  clears applet globals, frees MSG once, and exits before another scratch read.
  Production `wnd_destroy_tree` recursively destroys child state; host stop
  defers memory release until the current call unwinds. This is source-level
  reasoning, not real native teardown qualification.
- Selection text is copied by STATIC and its temporary is freed. Initial
  control captions (four) and list insertion temporaries (19) are allocated
  via `wat_str_to_heap` without matching applet frees: production controls
  duplicate/copy them and `ctrl_create_child` frees only CREATESTRUCT. This is
  inherited bounded per-open retention, released with process memory, not an
  observed unbounded idle leak. The fixture's `wat_str_to_heap: p => p` cannot
  measure it. Later allocation failures are also not covered by the initial
  MSG-allocation-failure test; the helper itself does not guard null allocation.
- Cold startup uses current font preparation and suppresses guest Worker
  startup; the browser avoids system payload mounting. Missing exports/open
  failure route to stop. Cancellation during real async init and actual
  renderer/reference cleanup remain unqualified by the replaced init/stop
  test. In particular the early canceled-init branch precedes compile-status
  timer cleanup, so cancellation UI behavior needs real-path coverage.
- Preview uses the real host ShellExecute entry, and the new `.SCR` fallback
  resolves registered savers with registry arguments. Registered launches are
  separate shell processes, not `process_spawn` children in `_stopChildren`.
  In single-app mode `launchExe` queues until the applet exits; concurrent
  Preview-then-close behavior needs explicit desktop/mode qualification.
  Host bare-name failure remains lenient (33) if no launch resolves; the
  fixture's failure return 2 does not test that production behavior.

## Evidence and limits

Evidence: `scratch/runs/20261020-screensaver-source-review/` contains
`replay.json`, `reproduce.js`, `reproduction.json`, `before.json`, `report.json`,
and a SHA-256 manifest. Replay uses the retained clean
`/tmp/wine-screensaver-recovery-bounded` and predecessor read-only sparse
preload. The predecessor verifier was read but not executed because it writes
its own original evidence; its individual read-only commands were replayed
into this review's evidence instead.

No full build, full VM, browser, remote runtime, heavy local build, asset
registry qualification, saver rendering, or saver-survives-applet-close test
was performed. MIDI's runtime was untouched. Shared HEAD/index/config, the
candidate source tree, assets, prior ignored evidence, and game lanes were
preserved. This is a **failed source review with a small executable boundary
reproduction**, not browser or gameplay acceptance.
