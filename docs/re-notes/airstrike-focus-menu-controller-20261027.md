# Airstrike focus/menu Quit controller — 2026-10-27

Implemented an Airstrike-specific, fail-closed interactive recipe in
`tools/airstrike-menu-controller.py`. This replaces the retained supervisor's
blind Escape / six Down / Enter schedule for a **future assigned run**; it does
not modify or replay that historical supervisor. Offline fixture acceptance
passes. Original-game normal Quit and current-main qualification remain open.

## Source and evidence

Read-only donor: `e5031a1f19942a2e88774b070657198b6fc835f4`, branch
`task/airstrike-sustained-gameplay-oct27`; report
`docs/re-notes/airstrike-sustained-gameplay-20261027.md` and adjacent evidence.
Historical production source is `b41a7c5f4b752d1f0bdab1141a11d4fed4dc6f9a`.
The retained runner was byte-compared with that exact Git blob; SHA256
`4d7b9587676db38fcf3314807acb2b2a42b5f09d2c98fcf3dccb8a6cde9e1809`.
Its `--control-stdin` entry accepts `{id,cmd}` and returns `[ctl] {ok,id,value}`;
live input settlement returns `{batch,logs}`. Frozen `{queued:true}` is not an
executed input acknowledgement. `keydown:VK` calls renderer.handleKeyDown;
`keyup:VK` calls renderer.handleKeyUp. `keypress` is a character route and is
deliberately unused. The controller checks the actual input log form as well as
the serial ACK identity, but neither establishes SDL consumption or focus.

Archive inspected without full extraction:
`/tmp/airstrike-original-private-oct23/docs/re-notes/airstrike-original-20261023/airstrike-pre6a-src.tar.gz`.
Member `airstrike-pre6a-src/src/airstrike.c` SHA256
`290454b9082bf3bda46be94533670a5ec604da38fde68b87cbe7c3460c72f46a`.
Lines 183–187 toggle pause on Escape keydown. `wait_for_key` (203–223)
returns only SDL_KEYDOWN and ignores keyup. `select_mode` (300–342) starts at
choice 0, draws `*` at the selected row, wraps Up/Down, cancels on Escape,
and selects on any other keydown. `console_mode` (451–499) has the seven
literal rows below; case 6 calls `exit(EXIT_SUCCESS)`. Main calls it while
paused (667–676). These paths do not establish or verify input focus.

Pinned renderer-input.js handleKeyDown (3284 onward) restores/seeds keyboard
ownership and can consume Escape for a renderer menu or modal dialog before
ordinary guest delivery; handleKeyUp (3499 onward) queues a release.
host-window.js inputEventHwnd (20–37) prefers explicit HWND, then guest focus,
then active fallback/main. This identifies real ambiguity, not the exact cause
of the historical failure. No change to renderer, SDL or emulator is proposed.

The donor's full 85s desktop has Console covering the upper-left game; its
115s terminal log contains `[max-seconds] stopping after 115s`. All 37 input
ACKs and runner exit0 are insufficient to prove menu selection or normal Quit.
Retained evidence cannot supply the controller's observation gate. No new
gameplay, Node, browser, build or Boat operation ran for this repair.

## Invocation and observation contract

Start `python3 -B tools/airstrike-menu-controller.py` from the supervising parent
of a newly admitted original-game session. The controller starts no process
except itself. Its stdout contains only runner-compatible command objects;
forward each unchanged to that session's production `--control-stdin` pipe.
Feed that command's actual `[ctl]` JSON payload back to controller stdin as
`{"ack": PAYLOAD}`. Do not replay commands, pre-send inputs or attach a schedule.
Stderr carries one final JSON result; exit2 is refusal. Response wait is 10s,
input lines are bounded to 16KiB, and there are at most 16 input commands.

Before any keydown provide `{"observation": OBSERVATION}`. Example shape:

```json
{"after":null,"focus":"airstrike","unobscured":true,"keysReleased":true,"evidence":"fresh capture and correlated focus receipt","state":"menu","header":"Airstrike menu","items":["Resume game","Players setup","Toggle fullscreen","About the game","Release notes","Toggle debug mode","Quit game"],"selected":0}
```

`after` must identify the last dispatched key release (e.g. `airstrike-2`),
or null initially. `selected` is the visibly starred zero-based row, not a
counter inferred from sent keys. Evidence must be a fresh unobscured full
desktop plus a correlated focus/recipient observation identifying Airstrike,
with no renderer/native modal/menu interception and no outstanding held keys.
The supervising observer owns that factual assertion and retention; strings
are references, not machine vision or verified image contents. Stale/historical
captures cannot satisfy it. The controller provides no OCR, reliable vision,
focus acquisition, observer or automatic evidence collector.

An initial positively observed `state:"gameplay"` may omit menu fields; it permits
one Escape down/up, followed by a required observed Airstrike menu at row0.
An initial menu observation skips Escape entirely. Each Down down/up must be
followed by an observed next row; a mismatch, obscured view or changed focus
stops. Enter down/up occurs only at observed Quit row6. SDL acts on keydown;
separate acknowledged releases prevent a held/repeated key sequence. There is
no sleep-based assumption that a menu opened or moved. A future parent must
retain serial command/ACK/observation timestamps and evidence together.

**Current gate: INSUFFICIENT_OBSERVATION.** Next required observation is a new,
unobscured Airstrike desktop with positively correlated game input focus and
released keys; after Escape, retain the menu header, seven rows and starred
row0 before sending any Down. If focus/menu cannot be positively identified,
feed the unknown/obscured observation and stop; do not guess or send focus clicks.

## Terminal contract

After Enter, feed `{"terminal": TERMINAL}` from the parent supervising that
same runner. Required fields: reason `guest-exit`, guestExitCode0,
runnerExitCode0, hostExitObserved true, timeout/controlQuit/wmClose/fault false,
signals empty, cleanupComplete true, evidence reference and complete runnerLog.
The log must contain exact `[Exit] code=0`, emitted by the pinned runner's
host `h.exit`, and no max-seconds/crash/null-call marker. External deadline,
batch-limit, control quit and WM_CLOSE remain disqualifiers even with exit0.
The parent must observe them rather than filling false defaults. It must retain
the complete terminal log/exit status, ordinary-input trace and empty owned
process set; the controller does not infer their absence from missing log text.

A terminal response after Enter keydown can complete validation without sending
keyup to a dead game. Any earlier terminal response stops with refusal. Rejection,
EOF, timeout, malformed/uncertain response or missing ACK stops further dispatch,
including releases; the parent owns cleanup and must not retry uncertain input.
An exit marker alone cannot distinguish SDL_QUIT from the menu path; the prior
positive Quit-row observation and ordinary Enter plus the parent's no-close
receipt are also mandatory. These are observation contracts, not a new security
authority system or proof against fabricated caller assertions.

## Offline verification and remaining runtime gate

`test/test-airstrike-menu-controller.py` drives the actual new Python executable
through tiny fake stdin/stdout transport fixtures. Five groups cover an observed
gameplay-to-menu sequence and every row, missing/obscured/wrong focus, stale or
incorrect row/ACK-as-observation, uncertain/rejected/terminal responses, and
timeout/controlquit/WM_CLOSE/runner-exit0 refusal. They establish controller
behavior only. Tests ran through the prescribed one-slot pool and pinned policy
supervisor: Python128MiB, CPU90, wall120, file24MiB, output2MiB; cleanup complete.
Receipts, pins, source excerpts and changed-file SHA256 values are adjacent.

Remaining gate is a separately admitted original-game run with unobscured
observations, ordinary source-backed menu Quit, terminal normal-exit proof and
separate current-main qualification. Reuse retained passed sustained play; do
not rerun it simply to exercise this helper. Boat `bx_ra5kxtgq` is coordinator-
reported snapshot-verified STOPPED. This task neither accessed nor changed it;
lifecycle remains coordinator-owned. No assigned running box or expiry action.
