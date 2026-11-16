# CLI per-slot input metadata and native Puzzle 7

The actual CLI producer/renderer/host-table/broker regression reproduces the
reported metadata isolation bug. Slot 1 takes a mouse press at canvas
(354,330). Slot 2 takes its release, motion to (200,180), a keyboard event,
and an empty poll. Before the repair, slot 1 reads slot 2's lParam/wParam and
live pointer/buttons. Adding only the missing CLI scope preserves message
metadata but still loses pointer/buttons: those reads were outside the
broker's existing scope list.

The CLI now exposes the browser-compatible, non-enumerable inputEventScope,
clears both current-event references on empty polls, and assigns both for
all input sources. Per-thread CLI host tables explicitly adopt the same
hidden scope when they adopt the shared input functions. The broker scopes current pointer/button reads alongside
lParam/wParam/HWND, retains a cleared scope after an empty poll, discards the
previous event before a new poll, and drops saved events when a slot's writer
retires. A mismatched writer cannot discard another transport's event.

The regression runs a real frozen Sol CLI, guarded producers, the production
renderer and host table, and actual createWorkerImports/createMainBroker RPC
requests in interleaved slots. No simulated event map supplies its answers.
Both the main table and the actual per-thread CLI factory are tested.
The new E2E fixture is `test/test-cli-input-event-scope.js`; the original
fast `test/test-worker-input-event-slots.js` remains unchanged.
It checks distinct mouse/keyboard routing, first-slot snapshots after sibling
delivery and empty polling, nested and throwing follow-up reads with exact
outer restoration, own empty-poll cleanup, and writer-retirement cleanup.
This establishes a generic input contract. It does not establish the cause
of LMarbles' native SDL selection discrepancy.

The same broker file contained explicitly released November 13 error-observer
WIP. That dependency was adopted and tested: responses settle before a throwing
or reentrant observer runs, and asynchronous batches preserve sibling delivery
and observer errors. Its dedicated 21-case regression is retained. Other
workers' D3DIM readiness files are outside this claim.

Evidence: `scratch/runs/20261114-cli-input-scope-lmarbles7/`. The removed
motion-before-press candidate 72590a235 is not restored. Native selection is
not described as repaired. Full 27 remains unproved.


## Validation and publication

Generic repair published on main as
`aef43bff1697594b8972373b4f74ccbd12018e7a`; strict pinned-key pull/push
returned 0 and remote SHA was confirmed. The actual main-table and actual
per-thread-factory CLI regressions passed, as did the original slot unit,
Worker receipt/slice-wake/startup/exit controls, renderer cursor/drag and
relative-mouse controls, input owner/guard controls, and all 21 observer cases.
`final-focused-tests.json` records seven final passing scripts; the renamed
E2E and unchanged original unit were rerun successfully in
`final-cli-scope.log` and `final-unit-slots.log`.

The full build passed under the heavy-runtime lock and
`flock /tmp/wine-build.lock bash tools/build.sh` (exit 0, 55.798 seconds).
Fair queue wait was 1000.621 seconds, after SuperTux stomp and Forsaken
readiness completed. No RAM gate or extra original launch was used.

Known failing controls are retained, not counted as passes: API batching's
extra null DX trace argument also fails against committed d49a82c579;
two WinMine CLI controls fail missing NE COMMCTRL against both baseline and
candidate; input-consumption-state lacks its expected cliObservation fixture.
Controller/supervision checks initially had one setup failure from a missing
control.py reference; the corrected deadline fixture passed. Its initial
fallback child wait is missing. The separate outerwait fixture passed all
actual waits and separate EOF checks. Logs and actual test waits are in the
run directory.

## Single native run: bounded Puzzle7 progress

The one fresh `lmarbles_108` original ran with real ticks, actual guest Workers
1 and 2 (2317 exports / 294 brokered imports each), fixed 900 seconds and an
observable independent 920-second watchdog armed before native creation.
Fresh native menus selected Normal / Original / Michael. Original 87-file
inventory, all 86 manifest mappings, CRT, current source and module were
verified before launch. No previous score, save or board was imported.
Native seventh-selector footer, seventh-level confirmation and Puzzle7 board
were personally viewed; initial board had Moves48 and Score0.

The first direct marble press **still reopened native seventh-level
confirmation** (`directselect.png`). Declining N preserved Moves48. Distinct
motion to a different wall/border point, then target motion, then a separately
guarded press selected the intended marble with a visible ring. This is the
reviewed native workaround, not a repaired SDL selection cause. Candidate
72590a235 remains removed. The proved generic CLI fix is retained independently.

Manual transcription fed an offline solver which only printed suggestions.
The Python attempt exceeded its own bounded search and exited 1; the C++
attempt exited 0 after 21.9273 seconds / 6,314,002 states with 22 suggestions.
Neither solver delivered runtime input. Eighteen individually delivered and
personally reviewed settled slides were achieved (interior coordinates):

| Slide | Marble | From → settled | Moves |
|---|---|---|---|
|1|Blue|3,6 → 5,6|47|
|2|Yellow|6,8 → 1,8|46|
|3|Blue|5,6 → 5,8|45|
|4|Blue|5,8 → 8,8|44|
|5|Yellow|1,8 → 1,4|43|
|6|Yellow|1,4 → 8,4|42|
|7|Blue|8,8 → 8,5|41|
|8|Yellow|1,3 → 1,8|40|
|9|Yellow|8,4 → 1,4|39|
|10|Green|8,1 → 8,4|38|
|11|Blue|1,1 → 8,1|37|
|12|Yellow|1,8 → 8,8|36|
|13|Purple|5,2 → 5,1|35|
|14|Purple|5,1 → 7,1|34|
|15|Blue|8,1 → 8,3|33|
|16|Green|8,4 → 2,4|32|
|17|Blue|8,5 → 7,5|31|
|18|Yellow|8,8 → 8,4|30|

`slide18.png` and its personal review establish the final settled board,
Moves30 / Score0. All 74 delivered operations had unique consumed nonces,
noReplay, an independently prearmed UP with actual wait 0, a separate
six-second operation deadline and post-release progress. Maximum capture age
was 17.334 seconds; maximum review age 0.222 seconds. Every selection and
settled slide was personally inspected. The next target motion `hover17`
was refused at the immutable runtime deadline before creating an intent or
sending DOWN. No replay or further original was attempted.

The run stopped through `max-seconds900`, with stats 899.994 seconds.
**Clear, tally, Puzzle8 and actual Quit were not reached.** This is a bounded
progress result, with the remaining native selection cause unresolved.
Time spent on the manually reviewed sequence exhausted the run; the remaining
solver suggestions are unvalidated native moves.

Native actual wait 0 includes separate stdout/stderr EOF; watchdog actual
wait 0 was unfired and ended on native completion; supervisor completion
records both actual waits and heavy-lock release. The invoking tool's actual
wait returned 143. An additional outer-child wait receipt is missing and is
not reconstructed or claimed. No native Quit is inferred from exit 0.
Postflight found no source/media drift, matching module SHA, all three own
PIDs absent, control port 8477 closed, and 13.25 GB free on /home.

Evidence includes exact launch Git SHA plus relevant dirty/new Git patches,
compact operation/review/wait JSON, selected result-named PNGs, and logs; no
module/media/source-tree archive. PNG CRC, inflate and SHA verification passed.
The recoverable offline executable and diagnostic committed-source copies
were removed with hashes and recovery commands recorded. Box ID: none;
state NOT_CREATED; expiry null; stop receipt N/A. No box was created or inherited
box stopped. Next causal work is the native SDL/last-motion discrepancy;
Puzzle7 clear and later puzzles remain unproved. This assignment stops here.
