# Q3 current published CRT: authority repaired, original initialization failed

Evidence: `scratch/runs/20261110-q3-current-crt-arena-0236/`.
Original arena gameplay and authentic Worker-return/Win32/Key_Event/UI
consumption remain unobserved. The single original attempt stopped before
Chrome, CDP, images or input. No second native attempt was made.

After LBreakout published and released `e7e0312bd`, Q3 implementation
`025f56fb2` explicitly selected that source authority, including the changed
CRT provider and both compiled mirrors. Canonical Wasm SHA-256 is
`4f2c69a1528e01a9ab5127201d5e8a222da2a35236377a1351f444f55fa5a7d9`,
2,186,099 bytes; the observation build is
`b731c8d3c3a31ce0ba6d5619f07f04b213969ded54209dc078ee4ea9a358e350`,
2,186,193 bytes. All compiler/source bytes must match the published commit;
changed CRT, canonical and compat bytes independently refuse offline. Shared
startup, CRT, Nox and LBreakout providers were read-only.

The locked build, observer controls, six terminal controls, seven startup
refusals, six chain refusals, emitted original Worker handler through the actual
transport, production host initialization and two real compiled modules passed.
Synthetic natural x86 CALL/entry/RET, unarmed zero callbacks and unchanged tier
guard passed. These controls do not establish original-game consumption.
Accepted fixture proofs were reread by SHA unchanged; no native fixture repeat.
Five independent local pin checks and both remote prelaunch barriers passed;
the latter used `checkOnly:true`, `spawn:false`. The sealed closure had 950
providers. Runtime Git identity was
`9deab9f96e3a46e20ea1fdb8f0c2fdde84ba2ac2`, containing `025f56fb2`.

The emitted original caller failed at its top-level bound declaration:
`ReferenceError: Cannot access 'root' before initialization`. The Q3 menu
adapter eagerly required its module using `root` before the retained caller
declared it. The prior tests compiled the whole caller but executed extracted
startup/command bodies, missing this initialization order. The owner canceled
on transport EOF; all 8 owned processes were actually reaped, with no remaining
or unreaped process. Generated parent, prelaunch child, runtime parent and
local controller have actual exit-1 waits and separate stdout/stderr EOF.
No later CDP protocol, input, image, retry, quit or deadline extension occurred.

The follow-up Q3-only repair defers adapter resolution until `createChain`,
after initialization. A new offline regression executes the entire generated
caller through production preflight, validates 935 current provider pins,
reproduces the eager failure, and passes the repaired caller with zero process
effects. The existing generated Worker/host/instance/chain controls pass again.
This repair was not exercised natively in this task.

Read-only recovery inventoried 33 remote regular artifact references and
retrieved 26 unique files, 259,260 bytes. Independent SHA/size rereads and a
second remote inventory matched before stop. Nonempty gzip streams validate;
zero PNGs were present. A final audit explicitly flags the zero-byte transport
`.jsonl.gz` as having no finalized gzip member; overall finalized-gzip status
is therefore false. The empty artifact is preserved by exact SHA/size. No
source archive, evidence media copy, local Chrome or nested worker was used.

Box `bx_txcuzr9c`, UUID `7b236b39-e650-4284-84a7-210cece5e3be`, was created
after its independent immutable 25-minute watchdog was observed armed and
alive. Initial API expiry was 2026-11-10T03:05:10.230Z; watchdog deadline was
2026-11-10T03:05:10.956869Z. Sole delegated unforced stop
`stop_f487da9e0cb12a8a` completed at 02:42:40.107Z. Final state is `archived`,
expiry null. Watchdog and allocation parent both have actual exit-0 waits with
separate stdout/stderr EOF. Other boxes were untouched.

Next requires a separately authorized original attempt using the repaired
initialization, then model-reviewed images and passive consumption evidence
before arena claims. This single task stops after publishing its offline repair.
