# Original SDK Flip3DTL CLI worker parity — 2026-11-01

**FAIL: the real-thread regression remains open.** The single authorized run of
`test/test-cli-d3d-worker-parity.js` exited 1 at line 52 because one draw fell
back to the guest thread. Both CLI children exited 0 and produced identical,
nonblank frames. Pixel equality alone does not satisfy this regression's
zero-fallback requirement. No SKIP, native crash, unhandled trap, signal or
timeout was observed. No rerun or production/test/helper change was made.

Evidence is retained, ignored by Git, in
`scratch/runs/20261101-d3dim-cli-frame-parity/`. This is a bounded original
DirectX SDK sample result, with no new-game, full-27, browser/GPU, gameplay or
general crash-freedom claim. Box ID/state/expiry and lifecycle are N/A; no box
was assigned or accessed.

The requested baseline was `ed06ca03fabc20e8f24aeeac35fde8fff0ab5185`;
the tested HEAD was `0f33dd9f6ad168fb4b9b79b777225ce925da89c8`, whose only
advances were `TODOS.md` and `ops/STATUS.md`. All 4,462 recorded accepted inputs
matched `20261101-d3d-typed-stateblock-injection/inputs-after.json`, matched the
baseline where tracked, and remained unchanged after execution. The accepted
46.479-second locked build was reused; accepted fixtures were not rerun.
Node was v24.18.1. Free disk remained above 2 GB (2,391,244,800 bytes at the
post-run verification).

The invocation was exactly one fixture execution with an evidence-only preload:

```sh
NODE_OPTIONS="--require=/home/user/wine-assembly/scratch/runs/20261101-d3dim-cli-frame-parity/observe.cjs" timeout 270s node test/test-cli-d3d-worker-parity.js
```

The preload, retained in the run directory, observed original calls without
changing their arguments, results or timeouts. It copied each child's complete
stdout/stderr and actual PNG, recorded loaded source hashes, saved the actual
compiled module bytes, and recorded the module sent to the worker. It adds
observation overhead, so this is not a timing benchmark or proof of which
fallback branch fired. No repository helper was edited.

The original fixture ran serial direct and `--d3d-worker` children, each with
`timeout: 120000`, `--app=dx_flip3dtl --no-build --no-close --quiet-api
--quiet-blocks --max-batches=3000 --max-seconds=90`, the explicit existing WASM,
and `--input=2800:png:...`. Child command/options records preserve the exact
arguments. Their measured guest execution loops took 2.945 and 2.174 seconds;
these are not whole-process durations.

| Original requirement | Observed result |
| --- | --- |
| Worker ready | `true`; assertion reached and passed |
| More than 500 queued worker draws | `2483`; assertion reached and passed |
| Zero guest-thread fallbacks | **`1`; assertion reached and failed** |
| More than 100 fences | Summary reports `415`; assertion not reached |
| Nonblank exact frame parity | Original assertions not reached; retained-image inspection below |

The worker also reported 846 submissions, 2,483 replay commands, 770 waits and
zero queued flips. The fixture's failure message was
`1 draws fell back to the guest thread` (`actual: 1`, `expected: 0`).

Both retained 640×480 PNGs were visually inspected: a textured red/blue Windows
95 cube, yellow frame label and control text. An offline comparison of these
already captured files found 85 RGB colours, 307,200 compared pixels, zero
changed pixels and zero maximum channel delta. Both PNG files are 33,218 bytes,
SHA256 `1329698a5091fa3623456535571cfebaee699483bafffa15ecf79948b5d5f938`.
This inspection did not rerun the fixture or turn its failure into a PASS.

Actual execution identity:

| Input | SHA256 |
| --- | --- |
| Local original `test/binaries/dx-sdk/bin/flip3dtl.exe` (406,260 bytes) | `9d46a3be9401d7bac59c1b79d5d690d5252f19232c0f7574cbd57e0467573582` |
| Actual compiled/sent WASM (2,025,029 bytes) | `2be3cebaa1c08a8e12075de000bfb83fb8692841c1452d9e317203f5c2fce8cf` |
| `lib/d3d-render-worker.js` | `f3d77c20eb14a8f72233216af03d2a50e60862b2fd10202e4970878050124b52` |
| `lib/d3d-command-stream.js` | `ea1080750e8557f261d2b62f646b2cbc317be1b639cdc566b022c9a6ad494945` |
| Unmodified parity fixture | `1ee9c9ca7fdb216f967239c711e8ce33fcea2d8daadf076d9839c2566af106f8` |

Direct child PID 2947561 and worker-mode child PID 2947743 compiled the same
saved module bytes. PID 2947743 sent that module in the encoder's `init`
message to actual Node worker thread 1. The worker-thread manifest records
`main: false`, loading the hashed `lib/d3d-render-worker.js` and instantiating
the received module. Its source uses the native D3DIM software draw exports;
this was the legacy Encoder worker route, not a mock receiver or GPU backend.
The structured-cloned module has no byte extraction API in the receiving
thread: byte identity is established by the parent's recorded compiled module
and send, alongside the receiver's instantiation record. Across all manifests,
90 loaded files were recorded; all 68 tracked loaded files matched the baseline,
and all 90 still matched their recorded bytes after execution.

Useful evidence files are `fixture.stdout.log`, `fixture.stderr.log`,
`fixture.exit`, `sync.stdout.log`, `sync.stderr.log`, `worker.stdout.log`,
`worker.stderr.log`, both `*.command.json` and `*.result.json`, `sync.png`,
`worker.png`, `png-inspection.json`, `identity.json`, `verification.json`,
`inputs-before.json`, the `pid-*.jsonl` manifests, and the saved
`module-2be3cebaa1c08a8e12075de000bfb83fb8692841c1452d9e317203f5c2fce8cf.wasm`.
The repository evidence checker found no outside-run or missing references for
this bundle. Its global exit was 1 because other existing bundles contain
outside-run references. This SDK sample has no candidate-corpus entry, so
`candidateId` is explicitly null and the checker marks it dashboard-ineligible;
the evidence remains linked here without inventing a candidate association.

Next fix scope: separately authorize investigation and repair of this one
fallback, preserving every original assertion. `test/run.js` constructs the
legacy Encoder without `strictReady`; `lib/d3d-command-stream.js:207` counts
an enqueue before readiness as a fallback. That is a plausible startup cause,
but descriptor validation and buffer/acquisition rejection also increment the
same counter, and this run did not trace the triggering branch. Establish its
cause before changing readiness/queueing behavior. No failure investigation
fixture, extra runtime diagnostic or workaround was executed here. The worker
stops after publishing this documentation; the launcher notifies the coordinator.
