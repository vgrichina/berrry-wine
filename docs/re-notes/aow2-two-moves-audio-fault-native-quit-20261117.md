# AoWII two-move attempt and passive audio fault, 2026-11-17

Evidence: `scratch/runs/20261117-aow2-two-moves-audio-fault-native-quit/`.
The requested two ordinary moves and native menu Quit remain **unproved**.
One newly authorized registered original reached the personally reviewed
Julia Human scenario setup through Main menu → Scenario → Single. The
independent watchdog stopped it at the actual `/home` disk floor before
Start delivery. Start was queued intent; its pending state read was
interrupted, with no `input-4-before.json`, completed command or delivery
claim. There was no world, army move or Quit proof in this generation.

The published `44115957c` persistent supervisor was reused unchanged, with a
prearmed independent 1,800-second deadline and unchanged 1,500,000,000-byte
floor. Disk monitoring, rather than deadline expiry, caused shutdown.
Available bytes were observed at 1,483,796,480 after the watchdog fired.
No source defect is inferred from that resource stop. No second original was
launched and neither the predecessor nor this terminal endpoint was reopened.

Actual waits: Chrome −15, driver 124, supervisor 143 (recorded by its keeper),
watchdog 0. All directly owned pipes reached both EOFs; adopted descendants
have actual wait records and remaining owned scopes/children are empty.
These establish process cleanup, not guest Quit. The interrupted state read
reported TargetCloseError during shutdown; it is not a new guest crash claim.
Only this run's downloaded component package cache and, after verified
terminal custody, its disposable profile were removed. Available space
returned above the floor; concurrent changes prevent attributing all disk
movement to this run. No foreign caches/reserves/sources were changed.
No box was created: ID null, state NOT_CREATED, expiry null, stop N/A.

The same standard module `87ef39648a61ed6f54ca4ab8de1926de02c651eb2d99655015dc7e5de5407009`
(2,399,439 bytes) was verified from the actual main Worker. The known source
reconstruction, media pins and direct188/package191 VariantInit controls were
reused by hash. Git plus relevant binary patches remains the source archive;
there are no source archives, media copies or repeated broad inventories.
Offline preflight passed. Final offline body assessment passed 759 required
responses with no body-collection first fault. The source/module generations
and relevant patches are indexed in `source-reuse.json` and `exact-git.txt`.

The old audio evidence was inspected offline first. `Mss32.dll` has preferred
base `0x21100000`, runtime base `0x1323000`. Previous instruction addresses
`+0x209e3` (LOCK DEC) and `+0x15b6` (MOV) lie in the worker loops, away from
their return epilogues. That evidence does not prove a ThreadProc return bug.
No audio disable, failure suppression or lifecycle fix was made.

A run-only transparent Worker message listener retained the first terminal
reply for each secondary endpoint before the normal consumer retired it,
plus 64 nearby stack DWORDs using passive shared-memory/PTE reads. It made
no guest calls, clock changes or scheduling requests. A focused check verified
unchanged native postMessage payloads, ignored active slices and one terminal
record per endpoint. Both audio workers reproduced the anomaly:

| Slot | Terminal sequence | ESP | Reply |
| --- | --- | --- | --- |
| 2 | 2115 | `0x7eabfff8` | blocks 0, EIP 0, yield 0, threadReturned false, trapped null |
| 1 | 27797 | `0x7ebbfff0` | blocks 0, EIP 0, yield 0, threadReturned false, trapped null |

Stack reads succeeded. Both have EAX `0x102`; their previous instructions
match the retained run. These are unexpected worker exits, with no WASM trap
reported. A zero-block terminal reply and `threadReturned=false` do not prove
the transfer that set EIP to zero or its cause. The passive record lacks the
preceding wait-completion transition. Cause and genuine emulator-crash
classification therefore remain **UNKNOWN**. The new record supports a
bounded offline investigation of wait continuation ownership/stack handling;
it does not justify guessing a thread-return fix or another original.

Four selected result-named whole images retain the registered selection,
main menu, Scenario menu and Julia setup. Two completed game clicks have
trusted browser DOWN/UP events, native `0x201`/`0x202` consumption and reviewed
afterimages. The final Start intent has no such claim. Intermediate loading
images were discarded; no frame series or capture bundle was retained.

Only this findings note is published; production code is unchanged. No
canonical build or lifecycle/package rerun was warranted for this note.
Next gameplay work needs renewed authorization and enough available disk;
the existing audio evidence can first be investigated offline.
