# Maelstrom: arm the authentic observer after main initialization

The reusable tool relocates the captured runner's sole `nativeAdapter.start()`
to immediately before its batch loop. Ordinary `experiments.applyMain` and all
remaining setup now finish before arming. Loader validation and adapter creation
stay at their original location. No execution mode is forced; the helper,
adapter, native/select completion hook and all three after-run observation sites
are unchanged. A changed mode during an active select still rejects with reason 15.

**Qualification: post-loader wiring is repaired and tested. A literal guarantee
that arming precedes every guest instruction remains blocked by the unchanged
loader.** The pinned capture calls `loadDlls` before observer validation;
`loadDlls` calls `callDllMain`, which calls `exports.run`. Moving a sole arm after
main initialization cannot put it before these earlier DLL initializers while
preserving that loader path. `source-audit.json` binds this finding to the exact
captured loader, not a current-root assumption. No loader bypass was introduced.
Independent review and coordinator resolution of this scope are required before
runtime acceptance. Authentic errno/caller and gameplay remain unknown.

## Exact inputs and generated runner

- Publication parent: `a18735d3b0e6dcb49a6cd1d65d054111d54340ff`.
- Original production source: `55f9724ef127100c3bb54aebca73e5cda5472c5f`.
- Observer-adapted capture SHA-256:
  `5b2596b3746e17427d26a50466ed36adcfec9f9f119755f05b1fa4bc3c79be58`.
- Corrected runner SHA-256:
  `2f10a91ed0d909094ad122c5fc6fc5856d79d449603bb74c7cdeca63cefa0e9a`
  (688,972 bytes).
- Unchanged helper SHA-256:
  `52d044f14d6ee129b2b6f5b81335f7d2c00b70a9f7513b7bd179203936150da8`.
- Unchanged adapter SHA-256:
  `85d86f19ce431c7c9248ef080e4267451f6027b5d8927dd2ebdf0d955d3dd075`.

The transform requires the full captured input identity. It makes one contiguous
replacement, retains every intervening setup byte, and preserves the complete
prefix and suffix outside that replacement. The receipt records exact offsets,
lengths and before/after hashes. Wrong, mutated, truncated and already-corrected
inputs reject. The CLI refuses any existing output, including its own input.

## Reproduce offline

Run with installed Node 24 and the retained immutable inputs, under the recorded
resource supervisor. No guest, canonical build or box is involved:

```sh
node --max-old-space-size=192 test/test-maelstrom-initialized-runner-arm.cjs \
  /tmp/maelstrom-mode-transition-observer-repair-oct26/ops/capture-run.js \
  /tmp/maelstrom-mode-transition-observer-repair-oct26/repo
```

The second argument is the accepted fixture repository at
`5a80f7c43ed4a44bec559f5f1e9f9eb9f7d5e8d6`; its test fixture SHA-256 is
`57758fa0a9b6d769fce63d873a2ebf7aca3fb62f18f1c7298d5e309054384491`.
The new test uses only that fixture's construction prefix, with unchanged pinned
compiler/source checks, to construct its small four-page synthetic observer.
It does not execute the prior 29 test cases. It executes the generated runner's
entire post-validation setup slice and actual three observation blocks with real
default `applyMain`, actual adapter and actual instrumented native mode guard.
Loaded-memory validation, persistence/VFS and guest instruction execution are
explicit host fixture seams. It does not pretend to validate authentic anchors
using synthetic memory. All three successful synthetic run sites capture the
owned native/select completion through the real adapter.

30 wiring checks pass: deterministic transformation and byte preservation,
ten invalid-input controls, full-runner parsing, exact arm ordering, default and
no-uop initialization, later enabled setup setters, eight setup failures that
never arm or run, start failure without retry, the original early-arm failure,
active mode-change rejection, and all three after-run observations. Four further
CLI controls pass: existing-output refusal, input-overwrite refusal,
already-corrected-input rejection before output, and usage rejection. Peak RSS
was 103,911,424 bytes under a 335,544,320-byte physical allowance. The 192 MiB
old-space flag is a heap setting, not a total-process memory limit.

The prior exact-revision 29 guard checks and two builds/30 native groups/119
controls are reused; none was replayed. `reused-evidence.json` verifies the prior
manifest payloads and retains its result. The present offline fixture compilation
does not qualify a full production module or a native engine.

## Runnable recovery recipe for independent review

Given the already recovered, hash-verified capture closure, place the new output
beside that closure's `runner/test/run.js`, so all its relative dependencies
resolve to the same pinned files. Use a new filename and leave the original
immutable. For example, with `REVIEWED_RUNNER` pointing to an authorized recovered
runner directory:

```sh
node --max-old-space-size=192 tools/maelstrom-initialized-runner-arm.cjs \
  /tmp/maelstrom-mode-transition-observer-repair-oct26/ops/capture-run.js \
  "$REVIEWED_RUNNER/test/run-initialized-arm.js"
```

Require the output hash above and retain the printed transformation receipt.
The capture closure archive identity is
`656a1569d905f49385a7e3a3e6b878f81b96aa547d275f5fcf521cfaa254dd4e`;
its original manifest and runner/experiment binding are retained in the preceding
review. The generated runner contains the full authentic runner, not a stub or
snippet, and needs that same pinned dependency closure and qualified WASM.
The output actually generated in this task is retained at
`/tmp/maelstrom-initialized-runner-arm-repair-oct26/ops/corrected-final-run.js`.
It is reproducible from the committed tool; no ignored binary is the only copy
of the repair. This recipe only constructs the file. Guest launch/mount flags,
memory admission, native qualification and lifecycle require a separately
authorized runtime assignment after independent review; the historical guest
argv is not current runtime authorization or a valid local resource receipt.

## Evidence and handoff

`checkpoint.json` binds the exact tested tool, test, source and fixture hashes.
`generate.json`, `test-result.json`, `cli-test-result.json` and `source-audit.json`
retain the transformation, results and complete reviewed boundary identities.
`evidence-manifest.json` hashes the committed payloads. Publication records both
the source/test tree and final tree; only focused evidence differs after testing.

The first harness omitted the diagnostic file seam and then shadowed intrinsic
JSON while initializing frozen option globals. Those fixture errors were fixed;
their first failures remain recorded. A first boundary after mode-related flags
passed 28 checks, but source review found more pre-loop setup. Its receipts remain
in the external ops directory; the final 30 checks cover the later boundary and
its final failure points. No production guard or source was relaxed.

All work is on the task branch. MAIN and dirty root data remain untouched.
Resource receipts account for the sparse flat Git closure, local copies, launcher
and session growth, positive WAL once, future growth and the 8 MiB reserve within
64 MiB; the projected host-free floor passes. Existing installed tools and donor
inputs are read-only standing inputs. Node started with unlimited inherited DATA
and address space; the 512 MiB DATA limit applies only to child Git processes.
Trusted SSH configuration, actual empty mount argv and the streaming initial root
ref receipt are recorded. No box was assigned or contacted. No runtime, install,
acquisition, browser, service, deployment, Telegram or other worker was used.
The coordinator retains lifecycle ownership; Claude remained idle.
