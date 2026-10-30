# Maelstrom complete transform contract — 2026-10-30

The actual production `transform()` at `b115cacaf93ba01f526610126c72a185e6abf5c5`
accepts the entire 13-fragment historical closure from
`55f9724ef127100c3bb54aebca73e5cda5472c5f` and the original binary bytes, with
`{enabled:true,binaries:{net,crt,exe},crtLoadedBase:0x522000,uopNativeBoundaries:true}`.
No production code changed for this acceptance.

The first behavioral checkpoint was that complete production call, after
verifying the helper, select hook, adapter, compiler and historical source hashes.
The checked-in JSON manifest records all input pins and all 13 output hashes.
Six fragments change: ALU RET, register CALL, UOP engine, UOP compiler, Win32
dispatch and Winsock. The other seven remain byte-identical. Inputs stay intact.

The standalone contract checks:

- Disabled calls return the identical input object, including hostile input and
  binary accessors that must remain unread (three cases).
- Every source fragment rejects a one-fragment mutation (13 cases), every binary
  rejects a one-byte mutation (three cases), and six invalid CRT bases reject.
- Full emitted source contains the select completion call, threaded CALL/RET
  hooks, both exact UOP instruction side exits, the switch hook before mode
  assignment, all scalar diagnostic exports, and all rejection reasons 1–36.
- The actual emitted `set_uop` and `mne_uop_switch` forms execute in a tiny Wasm
  fixture. Both switch directions × active statuses 1/2/3 × four combinations
  of the other mode bits give 24 coherent rejections. Another 24 same-mode
  cases preserve state; six inactive/terminal cases emit no diagnostic. Three
  nonzero requests test normalization. Counted flush/refresh stubs verify that
  mode assignment and the original setter continuation still happen.
- Production `decodeRejection` validates these emitted diagnostics, and production
  `createAdapter` persists all 27 rejection rows and seals each terminal owner.
  Wasm getters provide the diagnostic values. Start and unrelated select scalars
  are explicitly synthetic in this fixture.
- A mutation removes only the production transform's boundary-PC diagnostic
  assignment. The mutant still transforms the complete pinned closure. The
  emitted-code oracle rejects it specifically because `rejectPC` becomes zero
  instead of `0xf1234567`; all other transformed bytes are checked unchanged.

The emitted fixture source SHA-256 is
`fd7cca6396cb2729ebb8d653d52b60326a650a9fbadf7b25d8f0404763caf8ff`;
its Wasm SHA-256 is
`e245fa86f3cbb54f51f5f74653a7e612362a236c20a9220e8cdac7195ee358bd`.

Reproduction on the assigned host, from the owned repository:

```sh
python3 -B /tmp/maelstrom-integrated-full-transform-contract-oct30/ops.py reproduce /usr/bin/node --max-old-space-size=192 test/maelstrom-integrated-full-transform-contract.test.cjs /tmp/maelstrom-integrated-full-transform-contract-oct30/inputs /tmp/maelstrom-integrated-full-transform-contract-oct30/e/reproduced-manifest.json
```

The test pins every production dependency it uses. It reads original media only
from the standing paths recorded in the JSON manifest. Recovery also needs the
13 source files with the recorded hashes; `inputs-manifest.json` in the task
root identifies their standing or archived origins. No original media or full
generated output is copied into Git. The task's recovery recipe and patch live
outside the repository, alongside the completion receipt.

The first fixture attempt incorrectly wrapped the bare WATX forms in `(module
...)`. The vendored compiler emitted an empty module, causing a missing setter
TypeError. Correcting that owned fixture required no production change and no
oracle relaxation. Final complete contract execution passed with empty stderr.
The intermediate continuation and final strengthened mutant checks are retained
in task evidence; the old decoder-only acceptance was not rerun as a substitute.

This qualifies the offline complete transform and the emitted switch boundary
under synthetic pre-state. The complete generated emulator was not compiled or
instantiated. Select, CALL/RET, initialization ordering, guest execution, errno
capture and end-to-end mode behavior remain unqualified beyond source inspection.
There was no full build, browser, guest, gameplay, performance, causal-instruction
or runtime claim. No Boat was allocated, and no public deployment or main
integration occurred. The older build-inputs receipt does not qualify this helper.

The task supervisor retained admission, disk, evidence and process guards. Its
Node startup receipt records `/usr/bin/node`, heap flag 192 MiB, CPU 60 seconds,
file size 12 MiB and unlimited inherited DATA/address space. The heap flag is
not a process memory cap: the supervisor separately enforces 512 MiB group RSS
and 128 MiB parent RSS. Git alone receives DATA 256 MiB; Python DATA is 128 MiB.
The 8 MiB publication reserve remains allocated for coordinator closeout.
No checkout or mount/runtime command was needed: the filename-bearing mount
argv is empty, so mount parser validation is inapplicable. All Git commands
use the owned repository and the supplied strict SSH command.
