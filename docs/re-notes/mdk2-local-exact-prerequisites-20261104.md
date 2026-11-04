# MDK2 local exact prerequisites: terminal runtime mismatch

The accepted entry passes its unchanged offline `--check` on this coordinator
checkout. Original browser execution is blocked: the published staging tool
rejects a Git checkout, and 13 of the 432 live runtime paths differ from the
original sealed manifest. No browser attempt was launched.

Evidence: `scratch/runs/20261104-mdk2-local-exact-prerequisites/` (RUN).
Tested main SHA: `b05f10dc9d4777eadbb555faa879d867bd812263`.
The assignment's local guest cutoff was 17:13Z, cleanup cutoff 17:16Z.
No remote SSH, boat/API, allocation, resume, benchmark, subworker, public
deployment, or lifecycle operation was performed. Box ID/state/expiry: **NA**.
The coordinator retains future allocation/shutdown ownership.

The published staging tool matches `31105b7ac` byte-for-byte. Its `--prepare`
successfully validates the accepted `6d5121b5f96ee6032a9e347e2db64db29c478518`
entry, 111 helpers, observer `de6a33f257d93e8814d666bdec62361161569ac4`,
15 exact Git proof objects and the four original runtime dependencies from
`1329b1ba6eb00144ff77d4cd92a8513d4fc953ad`. The allowlisted 115-input JSON
is 1596875 bytes, SHA-256
`0eaa37e174ca2e5d58aa480faadb0762e60e4b8869f9738ff630c29f6058d3d7`.
It is the only staged entry payload; no input was installed into shared paths.

The actual published `--stage INPUT /home/user/wine-assembly` terminates with
`never stage over a Git checkout`, before any destination writes. This is an
intentional safety condition for its inherited-root workflow. The unchanged
accepted entry already exists here with its exact SHA-256
`6cdfd208f802daac8cb5f3fd67f51f07c5195b294a9c86a58d8c168a973a378f`.
Running `node tools/mdk2-construction-driver-integration.cjs --check` directly
passes the complete offline composition, all 111 raw helper identities,
observer, historical Git-backed dependencies, sealed manifest and retained
Modules. That check does not certify the served runtime.

Both original retained Modules verify in place, decoding gzip in memory:
normal `cffca869b541e6eff12ae3a6b74c4476977e0a7e23cd43d8ec5ba8faecd4bcee`
(2143540 bytes), compat
`580f49f3c78d26e6855efa0beb37046d03ea24690ff98cfcb3e94ce5e6cb1ee3`
(2146153 bytes). RUN records their existing paths; neither was copied.
The original 432-file manifest verifies SHA-256
`4a8bb12508a5f6b402880a3af9532e28ca4bd7fc18fb94bd0ccaf6c9c3ceb4ed`.
All four historical Git blobs match its pins. Live `host.js` and
`lib/guest-worker.js` differ; live `lib/guest-rpc.js` and
`lib/guest-thread-host.js` match.

Two full read-only disk inventories agree: **419 match, 13 mismatch**.
The differing paths are:

- `build/wine-assembly.wasm`, `build/wine-assembly.compat.wasm`
- `host.js`, `lib/guest-worker.js`, `lib/renderer.js`
- `lib/d3d-command-stream.js`, `lib/d3d-render-worker.js`
- `lib/d3d9-backend.js`, `lib/d3d9-fixed.js`, `lib/d3d9-shader.js`
- `lib/d3dim-draw-trace.js`, `lib/d3dim-gpu.js`, `lib/d3dim-render-worker.js`

RUN contains every expected and observed full SHA-256 and size, including
existing media references. The current normal/compat builds are respectively
`b74179b7570e3d9b87b088b53fb106aaba321cd6b256445bcbb362e634f1d1ea`
and `716275cc2d6dee5a00941c1686e0ccb69cd7411c423dac5e8506cb62226ff724`.
The accepted entry's unchanged `--run` reads each raw pinned path under this
checkout root. It cannot use historical Git blobs or retained Module references
as substitutes for those live served files. Removing the staging refusal would
therefore leave the exact runtime gate failing. No prerequisite-tool fix was
made: restoring these shared runtime paths, repinning, or introducing an
alternate runtime root would violate this assignment's constraints.

This is the first terminal prerequisite result. No release/review/ACK was
created or reused, no `--run` was invoked, and no HTTP server, Chrome, CDP,
guest work, input, construction slice or trace was started. HTTP body,
isolation/no-store, CJS/ESM/Puppeteer and launch-time aggregate-budget gates
were not reached. Native completion, Level creation, Lua and gameplay remain
unobserved. No owned runtime PID, listening port, profile or cache requires
cleanup; the exclusive local runtime slot is released on normal close.

Validation is the actual accepted offline check, published prepare validation,
expected staging rejection, two stable 432-path inventories and documentation
diff/patch checks. No production code changed, so no new build or test binary
was needed. RUN retains Git SHA, relevant binary diff (empty), this new note's
patch, small logs and full SHA-256/size seal with a stable second inventory.
No source snapshot, tar, `.git`, media or Module copy was created.

Next: coordinator must resolve the exact served-runtime prerequisite within a
separately authorized environment before another fresh original attempt. This
bounded assignment ends at this prerequisite and does not retry or relax it.
