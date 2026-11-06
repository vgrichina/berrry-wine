# Historical recovery: screensaver disposition, 2026-11-06

The screensaver slice of `origin/codex/recovery-main-20260910` is already integrated and superseded on main. Do not port it again. This is a source reconciliation, not a fresh runtime acceptance.

Compared recovery tip `80bc9a61509d1976ea55b2610b3b987611c48595` with main `198540b5213a57c5bea720407e381cd72d33faa1`. Main contains ancestor `88cbb53403487246f45e73614c062067a0b4c9c9` (October 30), which recovered the catalog and host integration. Historical candidate commits `40193154b` and `bf35c96b5` therefore need no additional screensaver integration.

Current source confirms:

- `src/main.watx` includes `09ca-screensavers.wat`; the app registry selects `watApp: scrsave`, and native control dispatch routes class 35 to `scrsave_wndproc`. The historical class 33 was adapted.
- `src/00-regions.wat` appends SCRSAVE_TEXT after MM_CALLBACK_CONTEXTS. Later allocations follow it; moving it to today's end would change existing allocations and is unnecessary.
- `host.js:loadWatApp` requires a fresh local instance, checks cancellation and exports, stops on startup failure, and attaches the renderer. Its applet step pumps input and schedules a bounded idle wait.
- `lib/browser-shell.js` marks applet startup before initialization, skips executable-specific system-data preparation, and takes the applet load route.
- Compared with the recovery fragment, current code additionally handles window creation failure, checks ShellExecute error results before publishing a launch, and pumps process-owned ordinary input through USER mouse activation and native BUTTON/LISTBOX handling. The old direct-control input assumption must not replace this path.

The recovery branch's two old test filenames are absent on main. They have successors in the integrating commit: `test/test-screensaver-applet.js`, `test/test-screensaver-input.js`, `test/test-screensaver-native.js`, and `test/test-screensaver-wiring.js`, plus the ownership census. Their presence and inspected scope explain the filename difference; no current passing result is inferred. The October 30 commit records its own dated validation.

Evidence: `scratch/runs/20261106-recovery-screensaver-disposition/sources.json` pins the compared heads and inspected current source hashes. No tests, build, browser, guest, or boat was started for this review. Remaining runtime, overlay, save and help/font startup changes in the broad candidate still require individual disposition under RECOVERY-PATCH-RETRIAGE.
