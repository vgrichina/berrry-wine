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
