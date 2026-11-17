# Registered Win32 Pegged: personally reviewed default puzzle

Run: `scratch/runs/20261114-pegged-reviewed-outcome/`.

**Honest partial: zero verified jumps, then native Game → Exit with actual
exit code 0.** The untouched default scene already contained **six** blue pegs,
so eight removals could not be achieved without changing puzzles. No numeric
remaining-count text was displayed. I did not start another puzzle.

I personally chose the geometrically legal vertical jump r3c4 over r2c4 into
empty r1c4 from the current full scene. One source click was consumed and its
independent UP acknowledged. The settled full scene had exactly the baseline
SHA-256: no visible source selection and no removed peg. I therefore submitted
**no destination click** and recorded no move, count decrease, win, solved state,
or no-moves end. A prior source intent expired at 5.50 seconds and was positively
NOT_SENT before DOWN; the later source used a new scene and new intent.

The native Game menu and its Exit entry were individually reviewed. Exit
completed normally after 457.820 CLI seconds (458.119 seconds between supervisor
launch and actual native wait), before the irreversible 180-second reserve.
Native, watchdog, outer-child and outer waits all returned 0 with actual waits
and both EOFs. The independent watchdog was unfired, the heavy lock released,
all four waited PIDs absent, and the endpoint closed. The final independent
release found the owner already exited: `OWNER_EXITED`, with matching actual
native wait/EOF, **physical UP unacknowledged**. The native log also reported
one held main-owner critical section at exit; this is not an all-thread-clean
claim.

All 422 frozen source/module/media pins matched after the run. The registered
media/import closure and original executable matched before and after. No box
was created: ID/expiry null, state `NOT_CREATED`, stop receipt not applicable.

Validation: **23 policy tests, 12 HTTP controls, 10 actual CLI controls, and
`flock /tmp/wine-build.lock bash tools/build.sh` passed** under the heavy lock,
after personally reading GL startup and StarCraft actual terminal waits/EOF
and heavy release. Six selected full scenes remain, named by `result.json`;
unselected duplicates were removed with their hashes recorded.

Next work, outside this closed single-original run: determine the native
selection/drag interaction in a separately authorized task before attempting
any destination. The current controller deliberately stops when a left click
has no visible selection. Eight jumps also require resolving the conflict
between that target and the six-peg default; no new pattern is selected here.

The registry entry `pegged` is unchanged. The original is
`test/binaries/entertainment-pack/pegged.exe`, 43,792 bytes, SHA-256
`bb5a4e90b71363cb7df5f818fc9a2de9841dbdfcb8a74498756b2c11438fe4c1`.
The current shared DLL resolver loads the original `msvcrt.dll` PE. It routes
ABOUTWEP, NTDLL, KERNEL32, GDI32 and USER32 imports through built-in handlers;
the adjacent original ABOUTWEP file is pinned too. No alternate Win16 binary,
download, media copy, registry edit, clock/seed/config write, or guest memory
inspection is part of this run.

`tools/pegged-controller.py` adds human-review policy over the released,
read-only `tools/barrage-guard.py` transport. The controller interprets no board
pixels and generates no moves. Each source and destination is independently
chosen from a submitted raw full scene, with a five-second precision deadline.
A destination requires a fresh visible selection and the immediately preceding
source's identity-matched consumed receipt and independent UP acknowledgement.
Before another source, a separate review must show the source and jumped peg
empty, destination occupied, and visible remaining count reduced by one. Input
acknowledgement alone cannot record a removal or natural outcome.

Binding records the truthful bootstrap or board phase and delegates permanent
PID/start-token/window ownership to the guarded transport. Bootstrap permits
only the native Start route; board admission requires a reviewed actual default
board. Natural outcome and the 180-second Quit reserve stop gameplay
irreversibly. Every native Exit step needs its own reviewed scene. The original
recipe is fixed at 900 seconds with an independent watchdog at 920 seconds,
real ticks, default batch size 1000, and one default puzzle.

The policy tests cover changed identity/image/geometry, expired reviews,
bootstrap versus board, one native Start, pending source/destination ordering,
actual removal attestation, unchanged count refusal, outcome evidence,
irreversible Quit, server deadlines, finite pulses and native Exit routing.
HTTP and actual CLI controls reuse the released transport regressions for
identity, unique nonces, positive all-unsent cancellation, mixed/UNKNOWN
terminal behavior, independent UP, parent death and actual waits. Their
Solitaire fixtures and synthetic board attestations are transport tests only.
