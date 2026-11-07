# MW3 operator command client preflight — 2026-11-07

The exact operator caller now passes **20000 ms** instead of **60000 ms** to
the retained `transport.request`. Its Python command construction, remote
Python `subprocess.run(['node','-e',...])`, JSON publication and numbered ACK
client are otherwise unchanged. The original 1–55000 ms integer guard remains
unchanged. No generic helper or production runtime code changed.

Evidence and executable preparation are retained in
`scratch/runs/20261107-mw3-command-client-preflight/`. The released predecessor
is `46a9c4104`; its final note and terminal result were read before testing.
Its closed transport, archived box and outputs were never reused for commands.
`source.json`, relevant tracked/new-input patches, runtime pins and helper
recovery patches record the source without a source/media archive. Existing
media retain their path, SHA-256 and length references in the manifests.

## Exact caller controls

`command-before.py` preserves the predecessor's exact caller. A local-only
`remote.py` adapter executes its identical remote Python subprocess body and
retains both layers of stdout/stderr. The before control reports `bounded ACK
required`, publishes zero numbered commands and leaves sticky closure in its
own disposable directory. It never touches the predecessor directory.

`command.py` changes only the literal timeout to 20000. The same Python/Node
command then publishes command 0, the unchanged consumer claims it before
execution, and the caller returns `{"number":0,"ok":true,"id":"capturepass"}`.
The successful command creates fresh immutable `command-pass.png`, capture
metadata and before/after binding; the retained capture SHA matches the actual
PNG bytes. This transport's ACK binds the command ID/number; its capture is
published separately by the driver and verified by `capture-ack-proof.json`.
No extra capture payload is invented in the ACK.

One small local Chrome sample runs the existing generated public COM guest
through production guest and renderer Workers with the real staged module.
The retained browser driver's ordinary capture, command execution and admission
code are unchanged. Its test-only entry uses the existing generated page,
attaches its renderer once, and omits accepted readiness/input/endpoint matrices.
The 18 identity fields, live module retrieval, full screenshot and freshness
checks remain intact. The personally inspected PNG shows the generated Worker
fixture captions on a white page; it is a command-path sample, not MW3 imagery
or a gameplay result. Native events remain empty.

Focused controls additionally prove:

- Invalid timeouts 0, -1, 55001, 60000, fractional, NaN and infinity fail with
  zero numbered publication through the original guard.
- A reply for command 1 cannot satisfy pending command 0, even with the same
  ID. Its bounded wait reports `ACK deadline; never resend`.
- A subsequent request against that UNKNOWN transport is rejected before a
  second numbered command; closure stays sticky.
- A corrupted reviewed Worker-owner token is rejected by the actual sample's
  unchanged admission chain before dispatch. It records command 1's exact
  `identity changed: workerTarget` failure and no native events.
- The unchanged pulse schedules one UP independently despite an unresolved
  DOWN; it then rejects UNKNOWN without replay. This control uses functions,
  not native input, and retains the scheduling receipt.

The first harness assertion expected the detailed stale-owner error in caller
stderr. The client correctly surfaced `runtime first fault`; the detailed cause
is in `first-failure.json`. The assertion was corrected and the completed
sample validated directly, without replay or a second browser launch.

Chrome exited normally with code 0 after that intentional terminal control;
driver and Chrome PIDs are absent, both ports closed, profile removed and writer
lock absent. No boat was allocated, resumed, stopped or deleted. Box ID/state/
expiry: none; no coordinator lifecycle ownership was taken. Disk samples stayed
above 2 GB. Focused controls, syntax, preparation pin validation and the locked
build passed; final details are in `verification.json`, `final-checks.json` and
`build.log`.

## Next separately authorized original

After owning a fresh successor run, prepare without launching:

```sh
node scratch/runs/20261107-mw3-command-client-preflight/prepare-original.cjs scratch/runs/NEW_OWNED_RUN_ID
```

This calls the published endpoint preparation, rejects pin drift, preserves its
original browser/helper bytes, and adds the corrected caller plus a relocated
operator transport adapter. Its 306-file manifest includes `boot.py`. Provision
those individually pinned files using the retained provisioner against the new
runtime root `/home/user/mw3-command-client-original-runtime`; update that
provisioner's root/run literals to this destination, upload the manifest and
verify every remote length/SHA. Do not repoint any old closed run.

Execute remotely only in that fresh authorized assignment:

```sh
python3 scratch/runs/NEW_OWNED_RUN_ID/boot.py
```

After strict readiness and new original pixel review, the local operator command
is:

```sh
python3 scratch/runs/NEW_OWNED_RUN_ID/command.py '{"id":"menu-observe","action":"capture","label":"menu","waitMs":10000}'
```

The ACK timeout is a fixed 20000 ms literal; this command exposes no timeout
argument or environment override. Preserve exact ACK, owner/module/window and
fresh-pixel checks, independently scheduled UP and sticky UNKNOWN. A missing
reply or other terminal error ends the attempt without resend. This task ran
no original guest, held-lane retry, boat or public deployment and stops here.
