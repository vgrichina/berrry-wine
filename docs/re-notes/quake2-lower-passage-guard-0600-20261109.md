# Quake II lower-passage onward attempt, 0600

The requested progress beyond 0537's red-lit lower passage was **not achieved**.
One fresh original Outer Base run reached the pane room, descended to the lower
area at HP100, and displayed the ladder tutorial. No guard encounter, operated
door, or completed return through the hatch is established.

Evidence is in `scratch/runs/20261109-quake2-lower-passage-guard-0600/` (ignored).

## Concrete control mistake and terminal boundary

I personally viewed every decision PNG. Before launch I also personally viewed
0537's `frame-right-consequence.png` and `hatch-descent-result.png`. No prior
47-hold route was replayed. This run used 54 commands, including 51 key/combo
holds and two native mouse drags, producing 55 PNGs including startup.

The fresh `review/room-right.png` shows STROGG crates inside the pane room;
`hatch-backstep.png` shows the ladder and red lower area. The next views inspect
the lower room rather than stopping at 0537's checkpoint. `ladder-base.png`
displays **Press 'move up' to climb ladder.** Subsequent views do not establish
a completed ascent. Space holds and position changes must not be described as
successful climbing merely because their input releases were acknowledged.

I incorrectly tried `a` as a move-up alternative. To inspect the configuration
without changing it, I opened OPTIONS → customize controls. The decisive fresh
`review/bindings-screen.png`, captured **2026-11-09T06:15:59.415Z** and completed
at **06:16:00.421Z**, visibly lists:

* step left: `, or a`
* up / jump: `SPACE or MOUSE2`
* down / crouch: `c or CTRL`

The capture/binding receipt times are distinct: the post-capture sparse sample
is **06:16:00.423Z**. `terminal.json` retains that sample time as `observedAt`.
The PNG is 76599 bytes, SHA-256
`e4bbce4eb2d9602b95e511d7e8786509a0de22db73543c95a33d2b0c5f18ddbc`.

That is the first actual unexpected configured-control mismatch established by
the run. I treated it as terminal immediately after personally viewing the PNG.
There was no later input, capture or retry. Only independent no-input cleanup
followed. No binding row was activated, cleared or changed; no defaults were
reset, no console was opened, and no guest-memory write or rebind was used.

The concrete diagnosis is that the `a` attempts requested lateral movement,
not move-up. This does **not** explain why Space failed to establish ascent:
Space consumption, ladder contact, collision behavior, and the cause of the
incomplete ascent remain UNKNOWN. An actionable next offline investigation is
to extend the audited read-only binding coverage to move-up and lateral keys,
then test native Space delivery and ladder contact separately. Another series
of climb holds would not resolve that missing evidence. No further runtime is
authorized or scheduled by this note.

## Exact preparation and tests

Preparation Git base: `d0966026f0d33283b92a9ecd8f921f386eda1397` on main.
Reader `6e18a9865db6764b10e6f0becc1b9b951a4dac79`, caller
`1473c5952a52d5d2b4546b93a0d462b64fe5c6cd`, and custody
`4341b87723a7d56bc98223215cca4cdc878fcae2` were pinned explicitly. Shared custody
had advanced to c4b4; it was neither reverted nor substituted into this run.
CPU: 2185596 bytes, SHA-256
`a320d4c85156644fd12b6134d66b11784f3100b9b135756206c087cdacd43295`.

All 722 staged providers, 110089205 bytes, matched the 0537 closure apart from
the fresh run-specific control/controller inputs. Local compiled preflight and
remote startup barrier passed with matching manifest SHA
`f20db45c9f4e1134e5b391f37c77799433aec36d3883cd16051aa29f0943136d`.
The exact 19 source-matched final 0537 test/build proof references were reused
and independently checked for SHA and size. No production source was changed;
no new build against different shared sources was claimed.

Fresh offline tests exercised the actual composed launch/request caller with
one persistent stdin PIPE through two lifecycle cases: open-command-then-EOF
and EOF while pending. Actual waits and separate stdout/stderr EOF passed.
The live caller retained its PIPE through setup and every command; transport
spawn was not treated as browser readiness.

Before the first input, the fresh sparse read established Enter13 `+attack`,
Control133 `+movedown`, Mouse1200 `+attack`. All 425 sparse samples were SNAPSHOT
on one owning memory identity. They are latch snapshots, not consumption proof.
The move-up and `a` bindings were not covered by those three sparse reads; the
later visual menu exposed the bad `a` assumption. Native lifetime remains
REVOKED; all-writers and edict ABA remain UNKNOWN. Both observation flags,
pre-CPU/pre-DLLmain zero-entry barriers, strict lineage, work/ACK/hold/freshness
and close caps stayed unchanged. HP remained 100 in the reviewed gameplay;
damage cause is not inferred.

`verify.py` passed capture identity/hash/order checks, all PNG chunk CRCs and
decompression, hold release ACKs, sparse identity checks, retained proof hashes,
actual waits and custody journal reaps. It records the goal as not achieved.
Free /home stayed above 1.5 GB; verification recorded 1910026240 bytes free.

## Evidence recovery and release

The exact Warcraft repaired-custody-objective-0558 ARCHIVED PHYSICAL_DRAINED
release was observed before creation: bx_cy9256js,
UUID a984fdd2-42c2-46ec-902a-f4584ed5452d, stop_16b968537401602e,
completed 06:00:46.062Z. No peer box was modified.

An observable independent watchdog was prearmed against immutable UUID
`c4984652-877f-47a7-b5b8-50469a9a2142` with a 25-minute deadline before creation.
Exactly one box was created: **bx_jk86n7mq**, TTL1494, initial expiry/archiveAfter
**2026-11-09T06:26:20.519Z**. No agents, workers, local browser or deployment
were launched.

After terminal review, intentional stdin EOF revoked the caller. Its local
actual wait returned 1 with separate stdout/stderr EOF. The remote supervisor
and caller parent actually waited with separate EOF; this is cancellation
cleanup, not a successful normal browser-close trial. Kernel custody records
**358 owned / 358 actual reaps**, 4113 journal events, complete true, command-log
EOF true, and no remaining, unreaped or unresolved ptrace/lineage/resume entries.
Tracked processes, service ports, profile FDs, input lock and runtime lock
drained. No historical UNKNOWN was upgraded from mere process absence.

All **733 remote regular-file rows**, 22495659 stored row bytes and **402 newly
stored unique contents**, were retrieved and independently SHA/size checked.
Every retrieved gzip passed GNU gzip CRC and independent decompression/hash
checks **before** delegated archive. Recovery uses exact Git base plus small
binary patches and existing media/module path/SHA references. No source tree,
media or module archive was created.

Final box state: **ARCHIVED**. Stop receipt **stop_0369b7c1d554a80e**, completed
**2026-11-09T06:17:32.495Z**, forced false, error null. Final archiveAfter is null;
expiresAt was not returned. Watchdog and lifecycle supervisor actually waited
0 with separate EOF and released the local runtime lock. PHYSICAL_DRAINED was
posted at **06:17:50Z**. The board watcher also actually waited for its tail
child (-15) with separate stdout/stderr EOF, and its outer wrapper waited 0.

Single-task STOP. The unresolved ascent requires an offline control/contact
diagnosis; this run does not claim the requested guard/door/onward success.
