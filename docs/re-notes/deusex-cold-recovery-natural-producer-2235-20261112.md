# Deus Ex exact-input recovery stops before allocation

The authorized cold-cache recovery completed losslessly. The next original
Deus Ex attempt stops before allocation because its exact 20-helper manifest
and retained original reports are unavailable locally. There is no new natural
producer observation, emulator defect, gameplay, FPS, audio or lifetime result.
The accepted [black-frame finding](deusex-black-frame-binding-repair-20261104.md)
still applies: nine original Engine checkpoints and canonical upload storage
were zero; expected Flip rotation did not demonstrate a host binding defect.

Evidence is `scratch/runs/20261112-deusex-cold-recovery-natural-producer-2235/`.
Only this note is committed. Small recovered inputs, generated patches, hashes,
local recovery proofs and failed prerequisite logs remain in that ignored run.
Git remains the source archive.

## Exact authorized cold-cache component

Only the unused, unselected release-0.167.1 `bin/codex-code-mode-host` was
compressed. Its 79,217,936 raw bytes have full SHA-256
`cd8de3a734f67ecab31fd6064e3aa8a68dac7785f5135bbb1709981b09a8b6a8`.
The retained 29,059,206-byte gzip has full SHA-256
`3d8e28de7e9040b1ee98828dc57b0eb6d15d8d37cb1172aa54a29afa5b386aca`.
Observed free space changed from 1,490,599,936 to 1,540,726,784 bytes, a net
50,126,848-byte increase during the recovery. This is an observation of shared
filesystem free space, not a claim that no other process wrote concurrently.

The root's aborted `20261112-obsolete-code-mode-cache-recovery-2220` attempt
was read first: its raw file was unchanged and only its partial duplicate had
been removed. A new exclusive `deusex-2235` prefix was used. The reference
script's temporary local encoding guard alone was reduced to 128 MiB emergency
headroom, as expressly authorized. The native allocation/input gate remains
strictly greater than 1,500,000,000 actual free bytes.

The installer lock stayed held. Before encoding and immediately before unlink,
privileged scans found no target exe/maps/fd consumers, installer writers or
scan errors; active release executables belonged to 0.167.2. Stable source
identity, nlink=1, size, full raw SHA, mode and nanosecond mtime were verified.
An independent `gzip -dc` consumed the entire stream, matched raw size/SHA,
and returned actual exit 0 with stdout and stderr EOF. Encoded bytes,
directory, exclusive restore recipe and journal were fsynced before raw unlink.
Current-release selector and installer metadata identity remained unchanged.

The durable files beside the old executable are:

- `codex-code-mode-host.recovery-deusex-2235.gz`
- `codex-code-mode-host.recovery-deusex-2235.json`
- `codex-code-mode-host.restore-deusex-2235.py`

**Restore BOTH old components before any future selection of 0.167.1:** run
the existing `bin/codex.restore-2200.py` and the new
`bin/codex-code-mode-host.restore-deusex-2235.py` in that release directory.
Each verifies its gzip and restores exclusively without overwriting a file.
This task performed no selection or restoration. Final independent full
decompression reverified both old CLI and code-mode recovery streams; the
prior CLI recovery remains valid. Encoded bytes and metadata stay local.

## Recovered inputs and exact missing dependency

The prepared original driver was recovered from complete line-bounded output
in retained worker events, with exact SHA-256
`fcfe9b91543e28046fe098b703458ea820471d6757e9280881224b0c6753bb21`.
The inspector was also recovered from exact retained stdout, SHA-256
`83b48f6e23b80f92af6e078c2c17a3879cf3d0a69c43518002248b119a849949`.
Both were written only beneath this task's new run prefix.

The frozen adapter is recoverable directly from Git
`36661cb71b738cf08d91ad51edf55e97084423af`: 9,057 bytes, SHA-256
`c33adc61c76406e896e9a0cb2dc373fdffd4c3c330ed758121bc48a63b017092`.
The current 11,085-byte adapter hashes to
`835d15befc348faff4b50d88d5e7f6878f4238f091d76b9bf34f3c6f7877d2a7`;
an exact pin assertion rejects it. No adapter was substituted or repinned.
The recorded six-file production delta was reconstructed from the documented
Git endpoints into a new binary patch. Its original patch-file hash is absent;
no byte-identical old patch-file claim is made.

The first outstanding exact dependency is
`scratch/runs/20261104-deusex-natural-bound-cache/input-manifest.json`
(or its lossless `.gz`), required SHA-256
`648115ab5604e24070534b6270a99ba64218f6b540e6aae9021ec8899130dfa0`.
It authenticates all 20 original helper pins and the original input closure.
Neither path exists and no revision appears in available Git history.
Retained Deus Ex worker outputs did not supply its complete exact bytes.
The recovered driver alone cannot replace that manifest or authenticate the
remaining helpers.

The original `inherited-verification.json` and
`recovered/original-output/result.json` are also absent. The focused test
actually exits 1 on the latter's missing gzip fallback, before fixture
execution. No passing replay or regression result is inferred.
Existing SoftDrv media still matches `25d14f3b…`; current build modules are
`04c53419…` / `29722b7f…`, not accepted original `4417305d…` / `07fb4e75…`.
They were hashed as references and neither copied nor executed for this task.

The recovered baseline composes through `tools/deusex-black-frame-binding.cjs`
without edits and the generated body parses. Its SHA-256 is
`f553f2ecaf308a6268535350b9424315582e4f4a7f78ce7d7cda3e2fc27c83b1`.
This checks the unchanged transformation anchors and syntax only. The published
`--check` fails on the missing historical baseline path; the complete original
preflight remains unavailable because the manifest is missing. No full test or
locked build is claimed; production code was unchanged.

There were zero remote API calls, allocations, native launches or old-box
accesses. Box ID/state/expiry and stop receipt are N/A: no box was created.
No watchdog was needed because the input gate failed before allocation.
The recovery command's parent exit 0 was observed; a separate tool-pipe EOF
receipt is unknown. Both independent gzip children have actual waits and EOF.

Next: recover the exact manifest, its remaining pinned helpers and original
reports from an authorized retained evidence source, authenticate the full
closure, then qualify one fresh watched original attempt above the disk floor.
Do not resume or fork `bx_sc8tbhpz`, substitute current modules, or infer a
binding patch from the retained black frame.
