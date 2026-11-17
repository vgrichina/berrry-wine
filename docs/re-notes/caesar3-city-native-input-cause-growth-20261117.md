# Caesar III first-city native input boundary, 2026-11-17

Run: `scratch/runs/20261117-caesar3-city-native-input-cause-growth/`.

The retained failed road selection is localized before host DOWN dequeue.
Its exact DOWN object (trace event 22) remained in the renderer queue until
deadline cancellation. Handler application at approximately 100 ms produced
MOVE, NCHITTEST and DOWN. The actual game consumer, main instance thread 1,
process 1000, hwnd 65537 generation 1, returned MOVE and NCHITTEST through its
ordinary PeekMessage(PM_NOREMOVE)/GetMessage loop. These observations include
native API arguments, sequence/completion counters, stack state and matching
window/memory identity; they are not observations of an authored BUTTON.

The native empty Peek return opened the pointer hover barrier at 223.98 ms.
The next observed renderer poll occurred at 605.93 ms, after the immutable
500 ms deadline had purged DOWN. No DOWN token was issued, so neither a native
DOWN API return nor WndProc DOWN entry/return nor receipt-binding failure is
proved. Dispatch fields refer to earlier messages and do not establish callback
return. The reason for the long interval between ordinary polls remains
unmeasured; this is not evidence of software-rendering cost or a product defect.
The old endpoint remains terminal UNKNOWN and was never accessed here.

Separate ordinary pointer movement followed by a fresh review and press is a
justified alternative input path. A targeted native control reused all exact
retained source hashes and module
`9099bb3f694d5ec6dac2886b70c1920fa33f39ad9258b1e662d1ebe05dc2da0a`.
No compilation or broad qualification was repeated. The existing authored
slow-frame fixture uses the same Peek/Get loop and 350 ms of ordinary guest
work between frames. Its separate MOVE and DOWN responses arrived at 210.48
and 260.68 ms, with independent release and aggregate completion passing the
1750/3000 ms limits. Its actual guest callback produced `UP after DOWN`.
Native and watchdog waits completed with both EOFs.

The first combined native control attempt remains retained as a failed test:
its native DOWN return was accepted at about 494 ms, but its controller response
arrived at about 537 ms and correctly caused permanent UNKNOWN. The fixture's
stronger expectation that the receipt must be unconsumed was false for that
schedule. This is not a passing negative control. An intermediate test-entry
attempt was refused before native launch by the sealed loader; the successful
targeted run used Node's ordinary `-e` entry with the published fixture body.
No production guard, source seal, input pump, clock or configuration changed.

One authorized changed-path original then started with the identical retained
source graph/module and all 114 media files verified before its clock. It
reached the personally inspected whole title image. I saved the title review
for binding and then mistakenly invoked `review-intent`, which attempted to
write the same append-only review again. The EEXIST failure occurred before
an input intent or DOWN and caused permanent UNKNOWN. No game input was sent;
no HTTP request followed UNKNOWN. The native process shut down promptly via
host cancellation. Native, outer supervisor, persistent owner and all independent
watchdogs have actual successful waits and both EOFs, and the runtime scope is
empty. Media hashes remained unchanged. Host cancellation is not native Quit.

The correct existing-controller recipe for an already reviewed bound scene is
`control intent ...`; `review-intent ...` is only for a scene without an existing
review. A separate hover uses its own reviewed scene, then a newly captured and
reviewed scene precedes the press. This is an invocation correction, not a
production fix. The closed original was not replayed or restarted.

Connected roads, occupied housing, immigrants, population growth, Save and Quit
remain unproved. The concrete blocker is the terminal review-collision failure
on the sole fresh original; another original needs renewed authorization.
No production code changed and no canonical build is claimed in this run;
the prior locked-build and native/source proofs remain pinned and reused.
No box was created: ID/expiry null, state NOT_CREATED, stop receipt N/A.
