# RichEdit / WinHelp current-main native acceptance — 2026-10-20

**BLOCKED before compilation; zero of seven native scenarios executed.**
This is a report-only branch. No production changes, gate bypass, main merge,
or callback runtime qualification occurred.

The authorized runtime was `bx_6czhvg6m`, acquired after Army's 12:26:13 UTC
release and released at 12:30:41 UTC, left running for queued tests.
Its TTL was 15:53 UTC. Army source/assets/evidence and ICM source/evidence
were retained in their original remote directories.

## Exact inputs and result

- Fetched and remotely verified main:
  `8580f3aac0fac2b15e932c931620e0491d86b8a8`.
- Fixture: `2c902c79f362560112ca30d41e4332688046d55a`;
  only its two unique test files and fixture note were overlaid.
- Remote source: `/home/user/callback-native-fullvm`;
  staging: `/home/user/callback-native-staging`.
- Verified 6,430 current-main Git blobs and three fixture Git blobs both before
  the build and after the failed build/offline validation.
- Dependencies: exact package-lock via `npm ci --ignore-scripts`, exit 0.
  Pinned fonts, `stdole2.tlb`, and freecell HLP were included in the source
  manifest. HLP blob: `5418925c6c66c548daadd61531ea4c2083288e7a`.
- Environment: Linux x86-64, Node v24.18.1, V8 13.6.233.17-node.50.
- `bash tools/build.sh` exited 1 at
  `node tools/callback-ownership-census.js`, immediately after manifest and
  fragment checks. The build directory remained empty. **Module SHA-256: none.**

The canonical gate emitted:

```text
changed producer src/09c3-wndprocs5-edit.wat:$edit_stream_call (sha256); review its lifetime
changed producer src/09c3-wndprocs5-edit.wat:$edit_stream_call (boundaryCalls); review its lifetime
changed producer src/09c9-winhelp-ui.wat:$help_macro_call_routine (sha256); review its lifetime
changed producer src/09c9-winhelp-ui.wat:$help_macro_call_routine (boundaryCalls); review its lifetime
```

This demonstrates a current-main build acceptance blocker: the census lock
does not match the callback producers. It provides no evidence of a callback
runtime defect or success. Updating the lock or changing production is outside
this assignment. The older ICM module was not used as a substitute.

## Reproduction and retained evidence

Self-contained evidence is in
`scratch/runs/20261020-callback-native-fullvm/`.
`source.tar.gz`, `source-manifest.json`, `fixture.tar`,
`fixture-manifest.json`, `stage.py`, `execute.sh`, and `verify-source.js`
retain exact inputs and commands. To reproduce in a fresh directory:

```sh
tar xzf /path/to/evidence/source.tar.gz
tar xf /path/to/evidence/fixture.tar
npm ci --ignore-scripts
bash tools/build.sh
```

The same staged remote directory is retained, so the last command can also be
run there directly. No build or test is still queued by this worker.

`remote-execution.json` records the actual remote exit. `recovered/build.log`,
`build.exit`, `build-status.json`, `source-before.log`, `source-after.log`,
`npm-ci.log`, and `environment.json` retain build and provenance evidence.
`evidence.tar.gz` and all 59 recovered file hashes were independently verified
after transfer. `archive-receipt.json` retains the remote archive hash.

The completed fixture's offline controls were run remotely, with output in
`recovered/oracle-controls/`: seven generated scenarios and 21 disassemblies,
7 argument negatives, 14 ABI negatives, 14 missing-evidence negatives,
7 synthetic log positives, and 84 synthetic oracle negatives passed.
**These are offline checks, not VM execution.**

SHA-256 verification before/after confirmed unchanged prior artifacts:

- `/home/user/icm-fullvm/build/wine-assembly.wasm`
- `/home/user/army-original-evidence.tar.gz`
- `/home/user/icm-evidence.tar.gz`

## Remaining acceptance

All seven cases remain unexecuted on current main: `edit-ordinary`,
`edit-nested`, `edit-error`, `edit-timeout`, `help-ordinary`, `help-nested`,
and `help-timeout`. Therefore the register/ESP, callback entry, text/result,
timeout continuation, and 70 same-VM sibling runtime oracles remain unqualified.

The fixture's existing limits also remain: capacity exhaustion, wrong ownership
tokens/epoch, spill/SEH, asynchronous resumption, slice-64 success, mixed nesting,
native Windows comparison, and Circus gameplay. No CRT jump APIs were enabled.
The coordinator must resolve the build gate under a separate assignment before
scheduling native acceptance again.
