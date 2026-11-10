# Q3 authenticated instance: offline repair, prelaunch source drift

Evidence: `scratch/runs/20261110-q3-authenticated-instance-arena-0225/`.
Implementation `5b5b2c644` is published on main. Original arena gameplay and
authentic Worker-return/Win32/Key_Event/UI consumption remain unobserved.
The original controller refused locally before any remote runtime launch,
browser, CDP session, image or input. There was no retry.

The new offline original-launch control executes the emitted Worker attachment
handler through the actual execution-boundary transport, instantiates the real
canonical and observation Wasm modules, runs production host initialization and
the complete emitted startup call with `fixture=false`, and authenticates the
installed observation instance before releasing the original launch barrier.
The previous tests exercised startup with a simplified fixture configuration.

This exposed another retained adapter mismatch: the input owner's chain also
requires exactly one compiled Worker script. The Q3-only adapter now validates
the bounded canonical/observation script set and authenticates the installed
observation instance on Worker identity reads. Existing page, renderer, capture,
physical input and deadline rules stay in the retained chain. Unknown, missing
or duplicate modules refuse through the owning terminal callback. Instance
authentication now requires the exact object returned by instantiation; a new
facade with identical exports refuses too. Shared startup/providers, Nox and
LBreakout files were not edited.

Before allocation, the locked build, input observer tests, six composed terminal
controls, seven startup refusal cases, six chain refusal cases, and emitted
original-startup/Worker controls passed. The generated observation module has
SHA-256 `a28ebec9aa8f83b4ab71cfbf4bd8d7184df5764ab901aa9bf7de3ea1a625cb82`,
2,186,162 bytes. Synthetic natural x86 CALL/entry/RET and unarmed zero observer
callbacks with unchanged tier guard passed; these are offline controls, not
original Q3 consumption. Accepted fixture proofs were reread by SHA unchanged;
no native fixture was repeated. Both remote prelaunch barriers passed with
`checkOnly:true`, `spawn:false` after all 965 staged file checks completed.

The first original-controller action was its local manifest validation. It
refused at `build/wine-assembly.compat.wasm` before creating a launch claim.
Independent inspection found changes since sealing in that file, canonical
`build/wine-assembly.wasm`, and `src/09a6-handlers-crt.wat`. The messageboard
records concurrent LBreakout ownership of the CRT repair. The sealed canonical
SHA was `3e491c0840bb7771328738a0d160b4bbaa3d7ab72074cbd38a7b41e5d7e8ec18`;
the local canonical SHA at refusal was
`4f2c69a1528e01a9ab5127201d5e8a222da2a35236377a1351f444f55fa5a7d9`.
Exact expected/actual SHA/size records and the relevant binary diff are retained.
The refusal correctly prevented launch; no shared file was restored or bypassed.
Controller and outer parent both have actual exit-1 waits and separate pipe EOF.

Recovery inventoried 8 remote regular artifact references and retrieved 3 unique
files, 242,264 bytes. Independent local SHA/size checks and a second remote
inventory matched before stop; finalized gzip validation passed and there were
zero PNGs. No native process was launched, so no native kernel drain is claimed.
Git commits plus small patches preserve source provenance; no source archive,
evidence media copy, local Chrome or nested worker was used.

Box `bx_aeqdwfyb`, UUID `3c7ac4d0-b21f-45d3-ad68-9e7d4b2b7085`, was created
after its independent watchdog was observed armed and alive. Initial API expiry
was 2026-11-10T02:53:20.658Z; immutable watchdog deadline was
2026-11-10T02:53:21.333Z. Sole delegated unforced stop
`stop_e7f3f8ab2dc2c688` completed at 02:32:18.807Z. Final state is `archived`,
expiry null. Watchdog exit 0 and allocation parent exit 0 were actually waited,
with separate stdout/stderr EOF. No other box was touched, resumed or deleted.

Next: reconcile Q3's explicit published CPU authority with the shared CRT change,
repeat offline controls against that exact build, then obtain a newly authorized
original run. This task stops at its first prelaunch refusal; the native arena
objective is incomplete.
