# SuperTux 0335: startup and terminal capture latch

Repaired the production composition responsible for the Super0320 ordering
failure: its helper timed out at 03:22:26.108Z, but the automatic startup
capture ran at 03:22:33.420Z. The driver previously checked sticky transport
failure only when it reached the numbered command consumer.

The composed driver now shares one session latch across startup capture,
command execution, screenshot dispatch, input dispatch, browser exit, socket
closure and cleanup. It checks persistent failure/closure records before each
effect and again after awaited capture preparation. Closing publishes sticky
closure immediately. An early legacy queued command fails closed before the
automatic capture and is never executed. Independent key-up/mouse-release
cleanup remains permitted; later presses and delayed captures are refused.

`requestReady(transport, out, id, command, timeout)` in
`tools/supertux-native-driver-composition.cjs` waits for live driver readiness
before writing a command. The shipped review-client CLI uses this sender.
Readiness waiting consumes the existing request budget, rather than adding a
new allowance. Runtime, startup, CDP, input and 12-second review deadlines are
unchanged. The retained base and integration patch remain untouched. Future
setup callers should use this sender; direct legacy transport callers are
fail-closed, not silently upgraded or replayed.

Evidence: `scratch/runs/20261109-supertux-startup-capture-latch-0335/`.
`focused-final-2.log` records 13 controls executing the entire composed driver
in Node children, with a separate actual Node endpoint child and actual
numbered transport. Chrome/CDP/server boundaries are offline fixtures; poll,
settle and unused drain-race sleeps are explicitly scaled in the reports.
These are not native-game or Chrome acceptance claims.

The exact production baseline at Git
`3ac81a06e37175bb222720be0211c4c017d6cc5d` reproduces a startup capture
113 ms after its sender's ACK timeout. The repaired version admits an early
readiness-gated request only after readiness, completes capture/key/capture
and quit, and blocks captures for early legacy queueing, sender readiness
timeout, sticky failure, cleanup, first failure, closure during state/layout
preparation, early child exit, DevTools readiness timeout and cancellation
with a late startup continuation. Failure during key-down still completes
the independent key-up, then refuses the automatic follow-up capture. All
later capture/key/click/Pause requests are rejected without additional command
files or effects. Each fixture records actual terminal status and separate
stdout/stderr EOF; the prearmed parent watchdog is retained in the test.

Also PASS: production composition transport test, menu-failure test,
native lifecycle test, all 30 Pause-controller controls, shipped review-client
HTTP/DOM/controller tests (14 children), and
`flock /tmp/wine-build.lock bash tools/build.sh`. The review-client tests retain
passive startup, explicit initial capture, exact capture token and replay
refusal. Existing extracted-execute fixtures receive a session context;
the new full-driver tests exercise the real latch.

Source recovery uses `source-base.txt` plus `owned.patch`, including new files,
and a SHA/size evidence index. No source tree, media or module archive was made.
Free /home stayed above 1.5 GB. No boxes, browser, original game, agents,
workers or deployment were created: box ID/state/expiry/stop receipt are all
NOT_CREATED / not applicable. Next: a separately authorized original can test
native startup and gameplay using the readiness-gated sender and the shipped
client's explicit initial capture. This offline single task stops here.
