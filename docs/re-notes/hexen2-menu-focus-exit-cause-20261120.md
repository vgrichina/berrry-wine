# Hexen II menu exit and operator focus, 2026-11-20

The earlier Enter-to-exit trigger remains unknown. No guest or shared capture
source changed. Enemy Mouse1 consequence and ordinary Quit remain unproved.
Evidence: `scratch/runs/20261120-hexen2-menu-focus-exit-cause/`.

Retained evidence from `20261120-authoritative-capture-publication` establishes
Enter native USER consumption, independent trusted UP, then `h.exit(0)` through
the owning Worker's RPC path and host app unregistration. The full menu appears
to select Single Player. Its highlighted Chrome URL does not establish browser
focus as the cause. The old logger did not preserve DOM focus at DOWN,
navigation/unload events, or the guest caller of ExitProcess. One initial
Page.navigate and one index.html HTTP request are retained; this is insufficient
to prove an absence of navigation. These old scopes remain permanently closed.

The exact candidate is module
`10bdae2c56c79eeb5d0b4ebbc602c8a233e36351380da274a70f7f5e25363564`
on graph `34c794d549c4ad71dfe40c1647e4ffd0c7a4f8af` with the committed
`72dc77da0` capture delta. Module `1504` is older. Existing outside-input,
ownership/API Worker tests and locked build are reused, not requalified.

A fresh diagnostic original verified the actual owning Worker bytecode once,
reached the menu, and recorded focus/navigation instrumentation. It closed before
guest input when the operator's `xdotool --class chrome` search returned 1.
Actual localhost fixtures reproduce that failure and show the installed window
class is `Chromium-browser`. An exact owned-browser-PID lookup finds one window
and successfully activates it. This is a proved operator setup dependency,
separate from the prior guest exit.

The fixtures did not establish ordinary mouse targeting: CDP mouse requests
acknowledged, but the page's DOM event ledger remained empty despite a complete
document, visible canvas geometry and document.hasFocus true. Variants adding
presentation readiness, mouse movement and a bounded observation delay still
failed. The first fixture also incorrectly required a focused canvas element;
its state was not retained before the assertion. Later variants preserve the
actual empty ledger. Do not label any of these a complete input pass. No second
affected original followed this failed prerequisite, no guest Enter/Mouse1 was
sent, and no ordinary Quit was claimed. Every runtime closed with no later
endpoint probes.

All changes to diagnostic operators are run-local. Production controller,
renderer, shared capture, guest sources and guard limits remain unchanged.
No code commit/build campaign, Windows reference, Wine, Python, workers, boxes
or deployment occurred. Box ID/state/expiry/stop receipt are null/NOT_CREATED/
null/null. Recovery and exact joins are in the evidence run.
