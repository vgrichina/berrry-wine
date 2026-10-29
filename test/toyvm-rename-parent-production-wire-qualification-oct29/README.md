# RENAME production binary wire qualification

PASS on candidate `33528beec24aee12093633c30c260c30ff383969`, unchanged
12580-byte Backend SHA-256
`3ff02988e444348fc12ccf9b4e6f16db1918b532a10152538afbafa96b2108bb`.
All five production source pins were checked before and after execution.

`wire.py` loads the exact production class and calls its original `serve()`
method with a real AF_UNIX SOCK_SEQPACKET socketpair descriptor. It exercises
the real binary parser, handler dispatch, error encoding, and AF_UNIX JSON
control socket. It never invokes mount, production CLI, or a fake selector.
There are no production source edits or branch combinations.

The first behavioral case is the retained regular-file destination-parent
reproducer, transported through binary opcode 12: response length 16, matching
unique ID, error -20 (ENOTDIR), empty body, original source still accessible,
and unchanged complete Backend state except operations. Original name/payload
and body layout come from the unchanged historical reproducer. Historical
files are copied verbatim with hashes in `historical-provenance.json`;
their earlier RAM denial and lack of commit/push remain historical facts.
They are provenance only and were not rerun.

44 production cases cover opcodes 12 and 45 flags zero, each source/destination
parent missing or regular, file/directory sources, root/cross-directory source
layouts, valid cross-directory moves, and opcode 45 unsupported flags taking
precedence over all four invalid-parent variants. Every rejected operation
preserves the entire Backend instance (including nodes, names, data, mode,
links, opens, next, live, peak, written, handles, failure, and assigned fd),
excluding only operations. LOOKUP checks preserve original names. Control
JSON agrees with authoritative counters after each RENAME. Request and response
bytes, errors, IDs, full before/after snapshots and process identities are in
`results.json`.

Private source copies remove respectively only the source or destination
parent check. The identical wire/state oracle rejects each regression. These
are expected negative controls, not production candidates. Guard removal at
the source produces the wrong errno; destination guard removal also corrupts
the namespace, which the state and LOOKUP checks detect.

Each of the 46 serve groups runs in a separate owned child. Responses are
validated before client EOF; the original serve thread joins, then the wrapper
serializes snapshots. Normal child exit closes remaining process-owned
descriptors. Parent records PID/start ticks and verifies exit zero and reaping.
No unknown descriptor is manually closed. **This does not qualify selector
lifetime**, whose accepted repair is separate and not applied here.

Limits are 65536 live bytes, 65536 cumulative write bytes, 16384 bytes per file.
Backend fixture setup uses legitimate CREATE/MKDIR/WRITE callbacks under valid
directories; binary RENAME and LOOKUP requests run through unmodified serve.
The binary header follows production `2I2Q4I`; RENAME uses `<Q` and RENAME2
uses `<QII` followed by two NUL-terminated names. The retained SETATTR wire
fixture supplied the transport/header convention, not its production pin or
its old descriptor-lifetime expectation.

Run from the owned repository under its task supervisor:

```sh
python3 /tmp/toyvm-rename-parent-production-wire-qualification-oct29/ops.py wire-qualification python3 -B test/toyvm-rename-parent-production-wire-qualification-oct29/wire.py
```

Execution receipt and fixture provenance are in `execution-receipt.json`.
Raw supervisor logs remain outside Git in the task-owned `e/` directory.
This is userspace production protocol qualification. Crafted parent inode
requests may exceed kernel-reachable requests; kernel/mounted acceptance is
not established. No six-candidate, caller, main, confinement, browser, or
gameplay qualification is claimed. Independent acceptance and combined
application remain coordinator-owned gates. No Boat was assigned or changed.
