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
not described as repaired. The native Puzzle 7 result and final validation
will be recorded after the single bounded run; Full 27 remains unproved.
