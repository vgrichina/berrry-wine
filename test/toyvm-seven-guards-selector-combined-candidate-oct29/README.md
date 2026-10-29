# Combined namespace guards and selector cleanup candidate

Backend SHA-256: `75842ffafd6ebd0c29fa2889a463bfd6f5245634096f4dfef9a3fd69f703e822`.

The exact supplied namespace donor (`9faac389`, SHA-256 `b8201b2c4a1d0e1fd653bb02fda7870f626d3781bed014657fb974cc24e41c40`) supplies every byte outside `serve`. Only `serve` comes from the independently accepted selector donor (SHA-256 `e78b4f06715db96c3403aa821dc2008e7986fa9e9ec9fbacbc3744a8bb7eebc8`). `focused-results.json` proves both AST and byte slices for every function, including `handle`, and preserves all four protected file pins. Namespace-donor acceptance remains pending separately; this report does not assert it.

`focused.py` starts each actual Backend interaction with INIT. It checks CREATE/MKDIR parents, atomic rejection of SETATTR, UNLINK/RMDIR types, both RENAME opcodes' replacement types/cycles/source and destination parents, moved/orphan/ambiguous READDIR parents, and successful data/handle/accounting interactions. Every rejected production request compares the entire instance dictionary except operations. All seven private guard-removal groups are detected. A private-control TypeError classification correction is documented with original failure evidence; production oracles and source were unchanged.

`wire.py` adapts the retained independent selector oracle to the combined candidate pin, strengthening explicit live descriptor identity checks before fixture cleanup. Two real local EOF and two real EPIPE runs retain objects and exception tracebacks with GC disabled. Readiness requires completed registration and SO_ACCEPTCONN plus a real status round trip; the delayed-listen case rejects pathname existence as readiness. The private selector no-close control is rejected before fixture cleanup. Borrowed descriptors retain identity. The inherited wire oracle's historical copy is evidence only.

Prior broad results are carried as immutable receipts and artifacts, not replayed. Both executable tests are self-contained in this tree; neither retrieves or executes historical fixtures. The optional historical donor Git lookup was unavailable in the allocated source-only object topology; exact supplied donor bytes and receipt hashes were used. No fetch, alternate expansion or donor write occurred.

Run current tests from the repository using the task's exact pinned `/usr/bin/python3` operation supervisor: `focused.py`, then `wire.py`. Do not run the historical carried oracle against this candidate; it pins its original donor.

Source/local-wire PASS is candidate evidence only. Fresh independent combined acceptance remains required, as do separate caller migration/pin review and real CLI, mounted/kernel and browser qualifications. No caller/main integration, FUSE mount, CLI, browser or Boat execution occurred. No box was assigned; lifecycle ownership stays with the coordinator.
