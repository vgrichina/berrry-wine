# Redline admitted side-door attempt — 2026-11-09

The attempt stops at a **native fixture teardown failure before any original
Redline launch**. Current Chrome authenticated the selected a320 CPU in the
actual owning slot-0 Worker through the repaired startup helper, and an ordinary
DirectInput fixture consumed comma and period. The fixture then exceeded its
10-second wait for Chrome exit. Its controller remained alive until native
custody cancelled it at the fixed runtime deadline. This is a failed complete
qualification; the intermediate `native-qualification.json` success does not
authorize original gameplay.

No original menu, Vehicle Training scene, side-door contact, changed vehicle
HUD/camera or terrain-relative driving was reached. No gameplay PNG exists.
There was no input, capture or retry after the failure. Native lifetime remains
**REVOKED**; all-writer coverage and edict ABA remain **UNKNOWN**.

Evidence is in `scratch/runs/20261109-redline-admitted-side-door-0724/`.
The actual tracked caller remains `tools/redline-browser-run.cjs`, with
`tools/redline-startup.cjs`, `lib/redline-startup-admission.js` and `host.js`.
These providers were not edited. The preceding repair is
[the 0700 startup note](redline-startup-barrier-repair-0700-20261109.md).

## Executed native scope and first blocker

The task-specific fixture uses the actual startup helper and production host
initialization in a neutral isolated Chrome document. Its launch callback loads
only an ordinary generated DirectInput PE and normal DLL after the supported
barrier releases; it substitutes no fixture into the original game. Assertions
at the parked barrier require no fixture EXE load, DLL load or CPU slice yet.
Kernel ptrace fork/vfork/clone custody starts before the fixture's Node process
and Chrome. No local Chrome runs concurrently.

The retained startup receipt authenticates SHA-256
`a320d4c85156644fd12b6134d66b11784f3100b9b135756206c087cdacd43295`,
2,185,596 bytes, endpoint 1, slot 0, actual Worker target
`E4592C84F4FE06FE5BE58492DB600496` and instance token
`8e6feefd-53db-44a6-ba73-b03bf3db1f65`. This uses the private selected compile
and actual live Worker bytecode, preserving the startup deadline and provider
flag checks. No alternate module or relaxed gate was used.

The shipped `MAINDIR/Readme.rtf` documents comma/period for on-foot strafe and
entry by walking into a driver or passenger side door. The ordinary input helper
holds each fixture key for 600 ms with its independent release timer. Guest
DirectInput keyboard results, rather than DOM delivery alone, show:

| Key | Native interval UTC | Wholly held samples reading 0x80 | Following native keys |
| --- | --- | --- | --- |
| comma | 07:30:19.856–07:30:20.456 | 4 | comma 0, period 0 |
| period | 07:30:20.462–07:30:21.062 | 5 | comma 0, period 0 |

Both use the same endpoint/slot. The fixture's guest counters increase only
for the intended key. These establish fixture consumption, not original-game
strafe, movement or door entry. The intended original route was lateral rear
corner clearance chosen from fresh personally inspected living pixels, followed
by a visible side-door approach. It was never executed; the blocked forward
holds from [the prior approach](redline-car-door-native-20261108.md) were not
repeated. The 18-field identity, exact ACK, sticky UNKNOWN, 120-second freshness,
5,000 ms hold ceiling and 24-count relative-input caps remain unchanged.

The first concrete failure is `AssertionError: actual Chrome exit missing` at
the fixture's 10-second exit wait. The assertion occurs in `finally`, so it
bypasses that fixture's earlier catch and leaves its HTTP server alive; the
outer handler records the error but cannot finish the process. Native custody
later applies its immutable 95-second deadline. No scheduling or clock change
was made. The independent actual kernel wait for Chrome PID 5797/start 6976
records exit 0 at **07:30:33.558Z**, after the fixture's shorter wait. Controller
PID 5790/start 6858 is actually reaped with SIGTERM at **07:31:27.586Z**.
The exact cause of the Chrome shutdown latency is unproven. No original retry
or further runtime is attempted. A future attempt needs a fixture shutdown path
that joins its server, Chrome and streams within the existing lifecycle gates.

## Evidence, checks and shutdown

The current actual composed startup regression passes: the recovered old caller
fails admission, the supported caller passes, and all 15 refusal/retirement
compositions plus private-snapshot and one-use controls pass. Accepted unchanged
18-field owner, freshness, exact ACK, sticky UNKNOWN, relative-input and readiness
proofs are independently SHA-size checked and referenced in place. They do not
replace this task's failed complete native qualification. No production code
changed, so no new code build was required; the preceding repaired-provider
locked build remains its referenced implementation evidence.

The frozen manifest contains 727 providers, with exact Git base and a small
4,347-byte relevant patch. Original media were rehashed at their existing paths;
there are no media copies or source/media/module archives in this run. Large
media transfer used verified bounded remote segments, removed after assembly.
The task fixture and orchestration inputs have a separate small recovery patch.
Logs are gzip streams from their first byte. `/home` stayed above 1.5 GB; RAM
was not an admission gate. No shared host, custody or WAT file was edited.

Before archive, 15 unique remote artifacts were retrieved and independently
verified by SHA-256 and size, including four gzip CRC checks. The custody
journal's decompressed SHA/size and all 169 actual task reaps are independently
checked. Its `complete:true` describes settled custody obligations: cancellation
and controller SIGTERM remain explicit. Chrome exit, controller wait, command
EOF, physical absence and box stop are separate evidence. The closed ports are
HTTP 44755 and CDP 41899. The profile was removed by independent no-input cleanup
only after all owned identities were absent. No profile process or writer lock
remained. The last native keyboard reads are zero; the final guest input-queue
length is UNKNOWN because no postterminal guest read was issued.

An observable independent UUID-bound 25-minute watchdog was armed before the
single finite-TTL create. Box **`bx_v83snewy`**, UUID
**`a77bebaa-668a-4a93-be77-4970ab05f03d`**, was created at 07:29:21Z with initial
expiry **07:54:15.169Z**. Normal shutdown was requested only after unique evidence
verification. Stop **`stop_b69594a88cb5297a`** completed at
**07:32:20.484Z**, `forced:false`, error null, final state **ARCHIVED**.
Final `archiveAfter` is null; `expiresAt` was not returned. The watchdog has an
actual exit-0 wait with separate stdout/stderr EOF; its supervisor released the
heavy-runtime lock. Runtime release was promptly recorded on the messageboard.

This task ends at the concrete fixture lifecycle blocker. There was no public
deployment, box resume/delete, agent or Codex worker launch, guest/configuration
rebinding, clock/scheduler edit, or Heroes II/Claude change.
