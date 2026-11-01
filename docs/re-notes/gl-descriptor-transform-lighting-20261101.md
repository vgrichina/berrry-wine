# GL-to-D3D transform and lighting descriptor checks — 2026-11-01

Both original fixtures passed with their assertions unchanged on main
`48951da661440ca501da1a4c20ea414928d257a0`. Evidence is retained in
`scratch/runs/20261101-gl-descriptor-transform-lighting/` (ignored).

| Original fixture | Result | Wall time | Limit |
| --- | --- | --- | --- |
| `test/test-gl-dfx1-transform.js` | PASS, exit 0 | 3.246 s | 120 s |
| `test/test-gl-dlt1-lighting.js` | PASS, exit 0 | 3.356 s | 120 s |

These checks execute the real WAT descriptor producers through the existing
render harness. They establish the fixture contracts for descriptor production;
they do not validate rendered pixels, gameplay, a GPU path, or the full 27-app
goal. Neither run failed, trapped, or timed out. No broader crash-free claim is
made.

The transform fixture preserves its bitwise matrix transpose checks using
non-self-transposing modelview and projection matrices, places modelview in
world and identity in view, and builds while projection remains selected. It
checks viewport/depth fields, ABI/reserved fields, guard bytes, attribute-stack
overflow latching untrusted state, refusal without changing the descriptor,
clearing the latch, and null-destination refusal.

The lighting fixture preserves direction negation and rotated eye-space
position checks, default material/header values, packed light order, empty-mask
success, and material/light specular predicate precision including masked-out
lights. Positional lights, excess mask bits, and untrusted state refuse without
changing any byte of the caller's buffer. Null destination, latch recovery,
reserved words, and both buffer guards remain asserted.

The dispatch baseline was `ebed72ce2055025648297c367d116a9aba8256f9`.
Work stayed scratch-only until Rayman2 worker
`01a1965b-2e10-73b1-92da-1f4523d36d43` supplied fresh `final.txt` and
`result.json` in its assigned output directory and explicitly released
runtime/source/build on the board at 09:32:26 UTC. The gate was recorded at
09:33:03 UTC; only then was actual main pinned. Runtime deadline was 09:53:03
UTC and overall deadline 10:55 UTC. The coordinator fallback was 09:39 UTC,
then at least ten-minute intervals; completion preceded that fallback. No
worker was spawned and the existing cap of two was respected.

No retained accepted result for either requested fixture was found in the
scratch result/verification/final evidence search. The accepted canonical build
from `d86935e8274cd5d70a53bcc50c5d8bf5632d95c3` was reused: all 4,392
accepted input hashes and 141 accepted actual-read hashes matched, together
with the module and generated region mirror. `accepted-build.json` and the
retained accepted build log record this; no new build was necessary.

Canonical module SHA-256:
`dd43e4a6624d2449d7133b731d687c32530f7fcf0041a69ba71a09f78c09aaf4`.
Both fixtures actually instantiated SHA-256
`d73eec82b958965566a41de7e4acd4d8990922cf2f727f19f8b41de4924a592a`.
The latter is 2,026,958 bytes. All 12,982 production function bodies, every
noncustom section, and all exports match exactly; no extra functions or exports
were added. The canonical module's 37-byte custom section is absent from the
test module, so the modules are **not byte-identical**.

The reused read-only observer passed actual synchronous and asynchronous Wasm
execution against whole 512 MB shared memory hashes, unchanged host/native
clocks, and the emitted late-10,001 retention check. It captured each fixture's
228 unique actual file/hash reads, including all 130 source files and bounded
descriptor reads from the existing render-artifact snapshot code. Descriptor
read coverage includes the manifest, GL matrix producer, D3D fixed consumer,
and artifact helper. Each actual read still matched disk after execution.
Before/after inventories of 4,444 files were unchanged, as were both original
fixture byte copies. Raw compressed stdout/stderr, timeout and Node exit
records, actual modules, read hashes, and checks remain in the run directory.

Startup free disk was 2,230,800,384 bytes, satisfying the 2.2 GB requirement.
During the scratch-only predecessor wait, externally consumed space fell to
1,361,637,376 bytes; no fixture was launched and no foreign files were cleaned.
Space recovered above 2 GB before the gate; fixture checks ended with over
2.25 GB free. No source, test, compiler, helper, configuration, backend, or
registration files were edited. No browser, GPU, boat, download, deployment,
new EULA, access retry, held-algorithm work, successor, or foreign WIP action
was performed. Native local box ID/state/expiry are N/A; local cleanup was
delegated to this worker. Cleanup and publication records accompany the run.
