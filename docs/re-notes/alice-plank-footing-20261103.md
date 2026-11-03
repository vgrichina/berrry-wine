# Alice plank footing: fresh runtime creation blocked (2026-11-03)

The fresh boat creation request timed out at the Boat API before returning an
identity. This is the first concrete blocker. No game process, build, focused
runtime test, input or new capture was launched. Supported plank-center footing,
thermal entry, south landing, knife ownership and target damage remain untested
by this task. No creation retry or second campaign was attempted.

Evidence is retained in `scratch/runs/20261103-alice-plank-footing/`.
The requested gameplay input is `335b0d1ef55b452cd9cf158a8a0f99e77ce6224e`;
the shared committed main inspected during preparation is
`723e390a4fef745e42f52bd2c39f3bcb582aa349`. No source was staged remotely.
The accepted coordinator review of the predecessor's6162 archive payloads and511
closeout files was reused, without another predecessor audit or boat operation.

## Read-only observer investigation

The original `demo/fgamex86.dll` has SHA256
`42838c2a96520c4b8b42e710d7d5bcf3a7a7f2a71b141a9f75bff01ee28f3d4c`.
Its PE export table identifies `GetGameAPI` at preferred VA `0x10096ff0`.
The original disassembly copies the supplied API imports and returns the table
at `0x101cd200`. These addresses identify an API entry and table; they do not
establish a live player pointer or player-state layout.

`objdump -t` reports no symbols. The CodeView NB10 record names
`E:\alice\source\source\demo_release\fgamex86.pdb`; no matching PDB is
present in the installed original media. A trustworthy combined player
origin/heading/ground-contact observer was not established. No guessed struct
offset or guest write was used, and no movement/capture comparison was possible.
The retained PE headers, complete disassembly and observer JSON document this
limit; none of their static addresses is a measured player coordinate.

I personally inspected the predecessor's `approach_w4_2.png`: Alice is visible
alongside the rising board's left edge, without established supported
plank-center footing. This agrees with its accepted review and adds no crossing
result. A future separately dispatched campaign still needs ordinary visible
navigation, the required build/input gates, and the bounded early observations.

## Runtime lifecycle

The sole creation command requested name `alice-plank-footing` and finite TTL7200.
Its diagnostic is `could not reach the Boat API at https://boat.dev`, with an
operation timeout at `/api/boat/sandboxes`. No ID or original expiry was returned,
so neither can honestly be recorded as established. A read-only inventory query
also timed out. Whether the creation request created a boat remains
unknown. No stop, delete,
resume, predecessor operation or other lifecycle mutation was sent.

Any unidentified allocation is handed back to the coordinator for identification
when the API recovers. Shutdown delegation cannot safely be exercised without an
explicit own boat identity and recovered-evidence checks. No STOPPED snapshot or
successful normal stop is claimed.

Only this document changes Git. Static PE/disassembly checks and evidence hashes
are the available validation; the locked build and focused native input tests
were not run because the fresh runtime was unavailable. Next: restore Boat API
access, resolve the uncertain creation by its name/request time, then separately
dispatch any fresh gameplay attempt. This worker stops at the first blocker.
