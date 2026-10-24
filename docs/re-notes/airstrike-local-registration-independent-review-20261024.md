# Airstrike original local registration: independent rejection — 2026-10-24

**Do not integrate producer `fdd1e48dbccb1cfe15c78b8b9f772bd13cc60e7d`.**
The ordinary registered-app media resolver accepts modified manifest URLs and
guest mappings without enforcing the Airstrike verifier's pinned mappings.
This fails the assignment's requirement that an ordinary manifest cannot map
arbitrary unvalidated paths. This publication contains review evidence only;
it does not register Airstrike or merge the rejected implementation.

The generic loader behavior is inherited from accepted main
`9b263cea5801886d43b6e818f0b415645bb32a50`, rather than introduced by this
producer. Nevertheless, this new registration depends on that loader and does
not connect its strict standalone verifier to normal loading. This finding
concerns the requested integrity boundary for this route; it does not claim
an observed external attack or an executed guest load.

## Concrete reproduction

The retained filesystem-only harness prepares a genuine pinned 89-file
fixture, extracts `getAssetFiles` byte-for-byte from the producer's actual
`test/run.js`, and calls it with the real `mergeLocalManifestFiles` from
`lib/app-files.js`. It modifies only the temporary fixture's manifest.

1. Change one companion URL to `../outside-fixture.dll` with guest path
   `c:\outside.dll`. `verify(fixture)` rejects the mapping, but the ordinary
   resolver returns the URL resolved outside the fixture directory.
2. Keep a valid `game/SDL.dll` URL but change its guest mapping to
   `c:\unvalidated\replacement.dll`. The verifier rejects it; the ordinary
   resolver returns the changed guest mapping.

The resolver checks schema version and the files array, then joins each URL
to the manifest directory and merges the rows. It does not invoke the
Airstrike verifier or compare the 88 pinned mappings. The browser loader's
corresponding block similarly resolves each supplied URL with `new URL` and
merges it; this was inspected as source only, with no browser execution.
The standalone test exercises the manifest writer and verifier, so its
rejection controls do not establish that normal loading enforces the pins.

No file outside the fixture was opened by the reproduction. No emulator,
browser, guest, WebAssembly compilation or instantiation was run. The harness
returns success when it reproduces the rejection-worthy behavior, not when
the implementation satisfies acceptance. Its raw result records both cases.

From this repository, reproduce against the retained immutable producer:

```sh
timeout 60s node --max-old-space-size=256 \
  docs/re-notes/airstrike-local-registration-independent-review-20261024/reproduce-manifest-gap.js \
  /tmp/airstrike-original-local-registration-oct24/repo \
  /tmp/airstrike-local-registration-independent-integrate-oct24 \
  /tmp/airstrike-original-private-oct23/docs/re-notes/airstrike-original-20261023/release/airstrike-pre6a \
  /tmp/airstrike-legacy-zlib-private-oct23/docs/re-notes/airstrike-legacy-zlib-20261023/zlib.dll \
  /home/user/wine-assembly/test/binaries/dlls/msvcrt.dll
```

Fresh admission is required before rerunning. The temporary `gap-fixture`
destination must be absent. The harness removes its temporary payload in
`finally`. The exact source/excerpt hashes are recorded in `manifest-gap.log`;
the `test/run.js` and browser-shell Git blobs are unchanged between producer
and main `9b263cea`. This is a static/JavaScript reproduction, not registered
guest or browser qualification.

## Passing checks retained separately

All six commands from the producer's `tests.json` ran unchanged, with Node
old-space 256 MiB, CPU and wall limits of 60 seconds each, and a fresh
MemAvailable check above 805,306,368 bytes. Both explicit real-input runs
passed without SKIP. The default invocation explicitly skips real-input
checks and is recorded only as static registration coverage. Existing Silver
CLI, candidate browser-manifest and proprietary local dropdown tests passed
unchanged. The browser-manifest test is a filesystem/JavaScript test.

An independent comparison against the Git blob on immutable main `9b263cea`
confirmed the producer's game pins exactly match the `game/` subset of the
accepted 261-file / 17,345,286-byte runtime manifest. Every one of the 89 real
source inputs was independently hashed: 4,072,418 bytes total, 81 original
non-DLL files plus eight authentic DLLs (six bundled, standing MSVCRT and
legacy zlib). No circular dependency on the producer's expected hashes was
used for the reference comparison. All 14 producer evidence seals passed.

The original EXE remains SHA-256
`0e6f5450109c4c83e97bcf263bc90dc2d64dd83587356dd8a87994cc4246b474`;
legacy zlib remains
`0df0c22bf411ad670d7b8fe5a533e4831313d5a3118cf9216389c642c90ec2f9`.
No source payload, DLL, configuration or sound was changed. The accepted
historical SDL_image 1.2.3 provenance is retained with its existing scope;
there was no reacquisition or new upstream provenance claim.

The passing tests cover selector membership, absence from desktop/debug
lists, `localOnly: true`, empty acquisition packages, original executable
`C:\airstrike-pre6a.exe`, cwd `C:\`, empty arguments, eight DLL seeds,
the real CLI VFS closure and 88 exact generated companion mappings. These
checks do not override the ordinary-loader failure above. Further preparation
failure controls and acceptance/integration stopped at this substantive gap.

## Handoff and scope

The coordinator should assign a bounded repair that enforces the required
manifest boundary during ordinary loading and adds a regression invoking
that loader. Preserve the existing independent reference and all tests;
standalone verifier-only rejection coverage is insufficient. No broad generic
loader repair was attempted in this review assignment.

Historical movement/fire acceptance at main `9b263cea` remains separately
scoped to historical source/module evidence. Registered-route runtime,
browser, audio and full-game qualification remain pending. No public hosting,
deployment, packages, payload redistribution, compilation or box allocation
occurred. Box ID/state/expiry are N/A; lifecycle ownership remains with the
coordinator. Root tracked files/index/refs and donors stayed read-only.

Evidence is adjacent in
`airstrike-local-registration-independent-review-20261024/` and externally at
`/tmp/airstrike-local-registration-independent-integrate-oct24/`. Publication
and final resource/cleanup receipts are external because they contain the
resulting commit identity. The task admission projects 60 MiB inside 64 MiB,
including an 8 MiB reserve, transport, temporary payloads, launcher/session
and positive SQLite growth plus future allowance. No main push is authorized
by this rejected review outcome; publish the review-only task branch and
verify actual remote SHA under the shared integration lock, then stop.
