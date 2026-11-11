# Diablo II: field worker exit with pre-detach null buffer

Run: `scratch/runs/20261111-diablo2-xp449-level2-den-2150/`.
The requested level2/Den continuation is blocked by a native worker exit.
No combat XP, Den entry, healing, equipment change, or new SaveExit checkpoint
was achieved. The complete inherited healed XP449/life66 set remains the
continuation checkpoint; the observed VFS export matches all four files exactly.
D2S753 SHA256: `fdeef22a39213e0921dadf79a86d432f1746bf3164d10b8446ac0123253cda6e`.

Restored all four original save/map files and used exact standard module
`1165f15cb29fa4ff4b67621f3ce66f8df68fb50baea929d0b76e9b2f66118135`
with the matching `7c985edcc8eb8c23e7f2b64ba8b0d6f2eb177bad` source/host
closure. All620 runtime pins passed remotely before launch and after shutdown.
NormalLoad reached camp; `review/stats.png` verifies XP449/life66/66.
Inventory inspection found the equipped axe/shield, empty potion belt, and
zero gold. Native run and automap assisted the approach into Blood Moor.
Every dependent input followed inspection of the completed full image.

At22:00:42.693Z the passive pre-DLL-detach observer captured worker slot1
already at EIP0, previous blocks `0x01438da1`/`0x01438d90`,
ESP `0x7effffa0`, EAX/ECX0, ESI `0x0923052c`, EDI `0x0923054c`.
The object field `[ESI+0x28]` was already zero; reading the indicated buffer
therefore read address zero, not a valid buffer. This precedes DLL thread
detach, narrowing the older observer limitation described in
`diablo2-saveexit-worker-wait-20261111.md`. It does not identify the writer,
prove the value immediately before the indirect call, or establish a fix.
The post-slice observer and ThreadManager logged the same EIP0 exit.
The full object, stack, and sync-call rings are preserved in the recovered
`field-exit-observations.json`, with their raw SHA in `recovery-map.json`.

The field scene then froze. A passive snapshot retained the main infinite
wait on handle234882385, the exited thread, and the remaining worker waiting
on917761. Main's last slice reported section address17225992/owner2.
A balanced native Escape was acknowledged but produced no menu; subsequent
captures remained frozen. No synthetic event signal, guest-memory patch,
modified game/save/map bytes, or speculative shared runtime repair was used.
This recurrence happened during field traversal, before any SaveExit attempt.
Passive observers can perturb timing; the lifetime cause remains unresolved.

Browser/controller exited normally with actual parent wait/EOF0 and absent
PIDs. All317 recovered references (288unique),24 complete PNGs,24 exact command
ACKs,11 balanced mouse pairs and7 balanced key pairs passed audit. Exported
four-file VFS set matches the original restored checkpoint. No shared code
change or new build is claimed. `RESULT.md`, `RECOVERY.md`, and
`FINAL-AUDIT.json` record artifact recovery and lifecycle details.
Box `bx_tcjgtshk` was normally archived22:03:48Z, stop
`stop_19c149672d9a0a98` completed/nonforced/errornull, before initial
23:22:26.429Z expiry. Independent watchdog remained unfired and has actual
supervising wait/EOF0. No live handoff remains.

Next: investigate the streamed-audio object's buffer-field lifetime before
Storm's null Lock call, using the retained pre-detach evidence. Resume native
level2/Den play from the unchanged whole healedXP449 set after that blocker.

## Buffer lifetime investigation, 22:15 run

Run: `scratch/runs/20261111-diablo2-storm-buffer-lifetime-repair-2215/`.
The original failure's cause remains unproved. No runtime repair, replacement
buffer, guest-memory patch, or suppression of native failure behavior was made.
The original whole2050 XP449/life66 checkpoint remains the continuation source;
no level2, combat XP, or Den entry is claimed.

Original Storm DLL SHA256 is
`2b6a27f223aac30d2d383f185705be55f43f37a687aa76ebe307a1035b6eea2d`.
Its preferred base is `6ffb0000`, loaded base `01422000`, delta `-6eb8e000`.
`check-storm-map.py` verifies PE sections and original instruction bytes at
the relevant relocated addresses. Parent1910 `storm-thread-disassembly.txt`
and `storm-exit-disassembly.txt` agree; its `storm-worker-disassembly.txt`
used the wrong range and is excluded.

The worker checks active job+28 and job+3c before calling `6ffc6d90`.
That callee acquires section `6ffe9908` (loaded `0145b908`), loads job+28 at
`6ffc6da1` (`01438da1`), and calls buffer vtable+2c at `6ffc6dc1`
(`01438dc1`, return `01438dc4`). The original DLL establishes that this is
DirectSound buffer Lock, with eight arguments including this. Its custom
runtime handler consumes the corresponding36 stack bytes; the API metadata's
different argument count does not establish a calling-convention defect.

Constructor `6ffc6eb0` allocates68 bytes, links the job under that section,
and stores buffer stack argument3 into job+28 at `6ffc6f63`. It has twelve
stack arguments (`ret30h`), in addition to ECX/EDX. File-job callers may
legitimately supply zero. A reused job address changing to zero therefore
does not identify cancellation. Native ordinal257 (`6ffc71a0`) acquires the
same section, finds matching streams and clears the active job's buffer at
`6ffc7216` (loaded `01439216`) only when it matches stream+3c. Queued-job
cancellation and last-reference buffer Release follow distinct paths.

Bounded existing block tracing and adaptive instruction stepping captured
the first instruction-adjacent clear at22:37:00.342Z: main/TID1,
`01439216`/`01439219`, job `0923110c`, buffer `0823ba40` becoming zero,
with section owner1. This occurred during native Save & Exit, which returned
to the menu without a worker exit. It proves that clear operation in this
run, not the writer or ordering of the earlier failing object `0923052c`.
The static interval between the worker's check and acquisition remains a
candidate race; no failing interleaving was captured.

Block tracing disables optimized tiers, so two separate ordinary launches
used API-boundary observations with tier guard0 and watch address0 verified
on all three workers. Both loaded the original whole save, verified
XP449/life66/66, traversed Blood Moor, and returned through native Save & Exit.
The broader observer recorded1609 completed worker Lock-section acquisitions.
The final selective observer retained32940 contiguous observations across
all three workers, including2206 completed worker acquisitions and18 parked
attempts. It found no zero-buffer worker entry, ownership anomaly, observer
error, or worker exit. Per-call observer console emission was disabled for
the final traversal; bounded rings and pre-detach capture remained armed.
These observations perturb timing and do not rule out the original failure.

The large `cs_abandoned` diagnostic count is insufficient evidence of a
semantic defect: the park diagnostic saves the old block EIP before changing
to a retry thunk, while dispatch compares against the thunk. Successful
retries can increment this counter. Observed bad-leave counts and resume ESP
deltas were zero. No runtime change is justified by that counter alone.

Evidence includes original disassembly, relocation checks, the stepped clear,
API and section histories, observer generations and coverage limitations,
native captures, and separately retained native save outputs. All620 pinned
runtime files still matched after controller shutdown. The initial title
diagnostic ended with controller code1 after the game had exited; the three
completed diagnostic controllers reached actual parent wait/EOF0. See this
run's `RESULT.md`, `RECOVERY.md`, and `FINAL-AUDIT.json` for recovery and stop
details. No new runtime build or regression pass is claimed.

All1073 recovered references (932unique) passed raw size/SHA verification;
81 complete PNGs passed CRC/inflate checks. Native input records balance36
mouse pairs and16 key pairs. There are86 exact command receipts and one
retained initial terminal admission failure without an ACK. Box `bx_vyau8x7u`
was normally archived23:12:42Z, stop `stop_3d61987c3d0912ee` completed,
nonforced/errornull, before23:46:28.716Z expiry. The independent watchdog
remained unfired and reached actual supervising wait/EOF0. No live handoff
remains.

Next: reproduce the failure with a compact, allocation-light section-boundary
ring that records the worker's ESI job and buffer before/after acquisition,
constructor identity/arguments, cancellation's matching stream, and Release
ordering. Dump it before DLL detach on the first exit. Establish which write
changed the same live job generation and whether the worker had acquired the
section before considering a runtime fix. Preserve the original checkpoint
until the audio blocker is repaired, then resume level2/Den gameplay.
