# Retained TuxRacer stall sampler

Harness correctness only. No Boat/runtime call, module build, emulator change,
current-main qualification, or gameplay acceptance occurred in this task.

The exact retained runner is 692809 bytes, SHA256
`f96e9bb924700ee571e2904e097f80742ff55638399898ae1dc32454af05b02d`.
Its associated source is a998bf36b108275335af501d8ae774731495b9b2;
that repository revision's test/run.js is a DIFFERENT 693262-byte file,
SHA256 e01db98dddc51a9f4e65de9a1844010800ef2bfa74815e22610b68b7df8e0243.
Recover retained bytes from input-consumption/run.pinned.js.closed-verified.gz;
verify size/hash before running tests. Do not replace them with repository bytes.

The test extracts and executes the exact controlSafeValue/controlEval declarations
from the pinned runner. Surrounding state is explicitly controlled test data,
not a guest execution substitute. It kills a renamed tickState adapter parameter
and a removed memory-sentinel validation mutant. Cases cover absent/throwing
getters, invalid/out-of-bounds/discontinuous/throwing translations, unchanged
memory and input queue, normal state, and advancing batches with an external
flat poll count. External counts are never presented as eval-visible counters.

Control eval exposes instance, exports, renderer, memory, g2w, tickState, ctx,
va and mods. The sampler calls only enumerated read-only register/counter exports
when present, and the retained translation helper. Every byte in its 24-byte IP
and 32-byte stack ranges must translate contiguously inside memory, above the
low sentinel page. Missing getters and invalid memory have explicit status.
Module enumeration is capped at 32 and names at 128 characters. Renderer queue
length and four scalar tickState fields are read without consuming input or
publishing guest time. It never invokes ctx callbacks, va, or guest callbacks.

Authoritative thread producer, scheduler waits, poll observer, last API name and
clock methods are outside this adapter's lexical scope. They are reported
unavailable. No private state is invented from ctx property names. Main-instance
registers are not an atomic snapshot of worker registers. A stable PC, yield
reason or wait handle alone cannot establish a busy loop or scheduler starvation.

The copied observe-supervisor.py changes only its PROBE construction to load the
adjacent sampler. Its historical runtime settings remain a recovery recipe,
not authorization to execute it locally or remotely. Stage both files together;
the coordinator must separately qualify runtime inputs, resource policy and
transport before executing. Prior supervisor SHA256:
dd651b33421fda2b21f5dcf9a898cb7c1055da68253f1841b14a23af71a2aeb8.

Run from the owned repository with the pinned runner materialized:

```
/home/user/.nvm/versions/node/v24.18.1/bin/node --max-old-space-size=256 test/tuxracer-stall-probe-implementation-oct30/test-sampler.cjs
```

Use the task-owned local-controls.py recovery wrapper for CPU60/wall90,
RSS512MiB, generated-file12MiB, independent capture512KiB/aggregate4MiB.
Git DATA256MiB and Python DATA128MiB apply only to their respective children;
Node has no copied DATA cap. Allocation and startup receipts are adjacent to
the owned repository. Completion receipt and messageboard-note.txt are the
handoff; the coordinator owns shared-board append and bx_6qfkmrgj lifecycle.
