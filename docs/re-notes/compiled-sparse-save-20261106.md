# Lazy WriteFile tracing and compiled sparse saves

`fs_write_file_result` logged `entry.data.length` after changing a lazy sparse
overlay and before publishing the byte count. With filesystem tracing enabled,
the getter threw `VfsPendingError` trying to obtain the whole nonresident file.
The retained host probe and the new host regression reproduce this; tracing
disabled succeeds. The diagnostic now uses the existing logical-size helper,
`entrySize(entry)`, matching the SetEndOfFile diagnostic. No data materialization
or write semantics changed.

`test/test-vfs-write-trace.js` is host-import coverage: trace off/on both return
success, publish four bytes, preserve count canaries, advance the cursor and
dirty the same path, with zero provider reads.

`test/test-generated-sparse-save.js` separately executes original generated
PE/x86 callers through both shipped modules and real host imports. The guest
opens, seeks (including the high-word/error/result bridge), writes, truncates
and closes its own handles. Every stdcall records EAX/ESP and checks stack
canaries; byte-count and high-word outputs have additional canaries. Interleaved
sparse mapping setup gives adjacent guest source pages noncontiguous Wasm
backing; an eight-byte write crosses that boundary and a 64 KiB dirty-page
boundary. Mapping setup uses the existing shipped test export; file calls all
execute as guest stdcalls.

The test checkpoints to nodeDirStore, then starts a fresh process per module,
remounts the identical deterministic immutable base, hydrates the overlay and
executes guest ReadFile calls. It verifies dirty bytes, extension holes,
untouched bytes, shrink/regrow zeros, empty creation, CREATE_ALWAYS and
TRUNCATE_EXISTING. Invalid and read-only handles fail with their expected
errors and zero byte counts without dirtying the overlay. The writer, flush,
hydration and dirty/hole-only reads fetch zero base bytes. Each fresh reader
fetches 51 bytes for untouched ranges; only 16 edited bytes are persisted for
the large file.

Run `20261106-compiled-sparse-save` retains the failing host regression, passing
focused logs, compiled guest/bridge records, exact source SHA and binary patches,
module hashes and cleanup evidence. The locked full build, both new tests,
VFS overlay/lazy-entry/output-boundary tests and the existing compiled ReadFile
retry suite passed. This is Node durability and compiled guest coverage; no
browser OPFS, game compatibility, power-loss durability or provider lifetime
extension is claimed. Existing borrowed-provider and retirement contracts stay
in force.
