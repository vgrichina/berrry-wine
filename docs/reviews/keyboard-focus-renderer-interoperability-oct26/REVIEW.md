# Bridge-to-renderer focus release regression

25 finite Node cases pass using real browser event listeners wired directly to
the installed renderer-input methods, real takeInput delivery, physical-state
and async polling APIs. No positive key callback wrappers/spies or mock held-key
map. DOM/event routing and timer infrastructure are fake. Each renderer owns a
fixed real 64 KiB WebAssembly.Memory and an exports ownership token; there is no
guest module, compilation, running worker, host import, or browser execution.
The real renderer queued worker-owned route is selected using its ownership set.

Inputs: renderer 0d2aaf964b31d4191a76cf84900d7433b4611fa4, browser
2b5eaa0b0db6ef12882a38b6cd143291144d4150. The four source files and test hash are
in evidence/sourcepins.json and evidence/checkpoint.json. The browser source is
an immutable evidence input, not a production replacement. Renderer, mem-utils
and region-map are inherited unchanged from the branch parent.

Coverage: all six physical modifier sides, blur and hidden cancellation (12),
both sides held and either first release followed by final blur (6), buffered
down/down/hidden/up/up delivery snapshots (3), repeats plus page-input focus
transfer, captured metadata-changing up, stale ups and fresh press (3), legacy
aggregate latch characterization (1). Scan, extended, context, transition,
previous-state and repeat-count bits are checked on actual delivered events.
Physical and queued polling timelines are separately checked. A repeated blur,
hidden event or stale up cannot manufacture another renderer release.

Two deliberate negative controls each exit 1 at the exact downstream assertion
`release must reach renderer delivery exactly once`: remove the actual bridge
blur listener, or suppress renderer keyup. They run as separate serial 16 MiB
processes using the unchanged same fixture. No positive test replaces handlers.

Aggregate pressed-since-query rearming on queued delivery is preserved and
explicitly characterized. Side latches do not rearm. No stricter aggregate-low-bit
oracle is introduced; accepted strict 3 FAIL characterization remains reused.
Alt message expectations follow the selected worker-owned queue contract; see
evidence/incidents.txt for the retained initial fixture-oracle correction.

Accepted renderer 29+37+28+25+legacy and browser supplied 19 passing receipts are
reused in evidence; none of those suites were rerun. Independent browser review
and its reentrant wake-hook cancellation case remain separately owned, outside
these groups. This fixture does not accept or refute that independent rejection.

No production edits or main publication. Coordinator owns integration against
current main and any browser/guest/runtime qualification. No box was assigned;
box ID/state/expiry are N/A and lifecycle remains coordinator-owned.
