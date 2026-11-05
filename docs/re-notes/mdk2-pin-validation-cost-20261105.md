# MDK2 pin validation: exact byte checks with less formatting work

The passive observer now compares freshly read bytes numerically against decoded
constants. It still checks all35 instruction pins/502 bytes at every boundary and
sample. The getter fixture still makes534 translations per boundary (the older
9-pin/122-byte predecessor made154). This reduces measured observation cost
without changing validation, limits, records, imports or scheduling.

Baseline is published `36305d9c09ee1be1a4d86fa3ff9bdf2149253c64` and its
[decoder-cause note](mdk2-pending-enter-decoder-cause-20261105.md).
Baseline observer SHA-256 is
`dd37b5ba98bf052078bc81c72f4850f4e73caeea5b72c81698c4b0805269dfc3`.
Evidence lives in `scratch/runs/20261105-mdk2-pin-validation-cost/` (RUN).
The candidate changes only the observer, its explicit integration hash, and its
focused test; original game code/assets/config and accepted runtime manifests
remain unchanged. This does not establish consumption of the pending Enter or
a remedy that would reach it within512 steps, and authorizes no retry.

The implementation decodes only constant expected hex into private numeric
arrays once. It caches no guest byte, translation, successful check or failure.
`identity()` keeps its ownership, epoch, slice, loader and header checks in the
same order. For each pin it calls the original `read(pc, length)` unchanged;
only after that complete read does it compare bytes numerically. Each read
still performs a separate `guest_to_wasm` for every guest byte, even neighboring
bytes within one instruction. No endpoint or page-contiguity inference is made.

For every byte in0..255, its lowercase two-character hex representation is
injective. Therefore equality of the old joined string and the constant hex is
equivalent to equality of every read byte and its decoded constant. The read
order and read length remain identical. A changed first byte followed by an
unmapped byte in the same pin must report `unmapped native read`, as before;
a change in an earlier completely readable pin must report `original bytes
changed` before translating a later pin. The new code deliberately keeps the
complete read ahead of comparison to preserve those outcomes. Decoder-specific
byte validation, record construction and error containment remain unchanged.

Independently constructed fixtures populate bytes from the SHA-pinned original
EXE, using both affine and individual-byte scattered mappings. Each of502 pinned
bytes is mutated after successful boundary/sample checks, then observed by both
a boundary and a frozen sample under both mappings:2008 cases, all old/new
reports, translation sequences, underlying import results/counts and memory
hashes equal. Successful remapping of every pinned byte, while corrupting its old
physical location, also passes. Changed remapped data rejects. The52 additional
cases cover wrong thread/loader, foreign instance/epoch, stale slice, replaced
import, null sentinel/out-of-bounds/negative translations, translation exceptions,
read failure versus mismatch precedence, invalid header-derived read, deadline,
record/byte/boundary exhaustion, original-import exceptions (also combined with
a changed pin), invalid ownership/media/module pins and exact cap rejection.
`pin-cost-mutations.json` and `pin-cost-negatives.json` preserve these results.

| Separated passive fixture,10000 boundaries | Baseline median ms | Candidate median ms | Reduction |
| --- | ---: | ---: | ---: |
| Getter-only memory model | 157.088 | 61.884 | 60.61% |
| Final main module's native translator | 176.161 | 96.795 | 45.05% |
| Final compat module's native translator | 189.193 | 118.763 | 37.23% |

Each fixture uses seven alternating old/new rounds,1000 warmup calls per arm,
a constant observation clock and10000 measured calls per arm. Every measured
arm performs5340000 translations and10000 original-import calls; the observer
still reads502 pinned bytes on every call. The removed work is502 per-byte hex
conversions,35 array maps and35 string joins per boundary. Native-translator
timing loads the original PE and explicit zero-request fixture globals but
executes no x86 instructions. Complete512MB memory hashes and GPR/lazy-flag
snapshots stay equal before/after timing. Time is measured externally; no time
is subtracted from any host slice or feedback. These measurements establish
observer CPU cost reduction, not game progress or whole-history speedup.

Both final modules also run five short original-byte native fragments through
the real queued Worker: type10 finalizer, synchronous completion, poll,
demand-load return, and script buffer/stream setup stopping before protected
parse/run. Old observer, candidate and unobserved control match every full-memory
hash, GPR/lazy-flag snapshot, returned command and undefined-instruction trap;
old/new complete observer reports also match (26 boundaries/12 records/28
commands per module). Caller/data setup is explicit synthetic fixture state,
not recovered stream or gameplay. A separate current-Worker observer test adds
original countdown/timer/deferred-store fragments and ownership/history/failure
negatives, with both-module full-memory/register/command/trap parity.

The legacy worker's final corrected publication/release at00:37:43Z,
`17e09475ecaeaa47de76684df0a0518124a6e387`, preceded all full builds and final-module
qualification. Both locked builds pass and reproduce exactly:
`build/wine-assembly.wasm` SHA`e620f3adfc2850580004e204bc1fea495844e942806866f8ada24c215212e412`;
`build/wine-assembly.compat.wasm` SHA`66b37bd76da5a7b49c063b4eb0d44c898aaf00ff41e000a6fbd87c01edc136c8`.
No shared module was copied or restored. All builds finished before release.

The final focused command is
`node --test --test-name-pattern='pin cost' test/test-mdk2-construction-driver-integration.js`
with `MDK2_TEST_EVIDENCE=RUN` as an absolute path: seven tests pass.
Another54 focused integration protocol/ownership/input/ACK/lifecycle tests pass;
`node test/test-mdk2-lua-construction-observer.js` passes on both final modules
with `MDK2_LUA_RESULT=RUN/final-module-current-worker-native.json`.
Build command is `flock /tmp/wine-build.lock bash tools/build.sh`.
Logs are `final-focused-tests.log`, `protocol-focused-tests.log`,
`current-worker-observer-tests.log`, and `final-build.log`.

Two unsuccessful attempts are retained. The first memory fixture incorrectly
asked the PE section mapper for header offsets; its baseline rejected the wrong
header. The corrected fixture uses actual header file offsets. An initial
negative-lookahead test-name filter matched Node's parent filename and selected
unrequested historical tests, including decoder diagnostics. I terminated that
run after recognizing it. Its first historical pinned decoder-RPC arm ran before
the quiet arm failed the stale accepted-module check; this was a test-selection
mistake and exceeded the requested diagnostic scope. The attempt is preserved
in `focused-tests.log` and contributes no timing/parity evidence here. Other
historical selected-module/filesystem tests correctly reject the new shared
module sizes/hashes. Their accepted inventories were not rewritten, and the
complete historical integration suite is not claimed passing. Subsequent
commands select explicit positive test names only. No game or actual retry ran.

All50M/360s owner/record/byte/input/ACK, active0 full-rest, frozen review16ms,
512/544 menu caps and existing failure semantics remain. No scheduler change,
limit increase, stale validation or skipped sample check is introduced. No
Stronghold/legacy edit, Chrome, game, boat, heavy runtime lock, subworker,
deployment or HeroesII operation was performed. Evidence uses Git SHA plus
relevant binary/new-file patches and existing input-path SHA references only;
no source/media/module archives. Box ID/state/expiry: NA; coordinator owns shutdown.
