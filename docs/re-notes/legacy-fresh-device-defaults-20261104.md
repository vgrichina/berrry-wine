# D3D7 fresh-device lighting defaults

Run: `scratch/runs/20261104-legacy-fresh-device-defaults/`.
Public fresh-device readbacks demonstrated three constructor mismatches in
both shipped modules. Device7 creation now initializes COLORVERTEX to TRUE,
LOCALVIEWER to TRUE and SPECULARMATERIALSOURCE to COLOR2. SPECULARENABLE and
NORMALIZENORMALS already have their documented FALSE values from zeroed
storage. The eight-line constructor change applies only when creating a
Device7; it does not run on QueryInterface or alter common initialization.

The exact primary authority is the original September 1999 DX7 SDK
[D3DRENDERSTATETYPE reference](https://library.thedatadungeon.com/directx7/devdoc/live/directx/imref_5fdw.content.htm),
at its named anchors for the five states. The linked
[D3DMATERIALCOLORSOURCE enum](https://library.thedatadungeon.com/directx7/devdoc/live/directx/imref_192c.content.htm)
defines COLOR2 as 2. Original response bytes remain in
`scratch/runs/20261104-legacy-retained-specular-implementation/primary/`:

| Primary file | Bytes | SHA-256 |
| --- | ---: | --- |
| `imref_5fdw.content.htm` | 40536 | `7bcb2f8393d9615e54150ac6c0fe2b79a5a849614a36de1eba3be51e08c97ff0` |
| `imref_192c.content.htm` | 2578 | `23023ace4691e70611ef2b0b500b9cd94f1c2ed2d4eec838e19ec331377dbe58` |

Both retained bodies were read and verified against the earlier retrieval
manifest, including its exact URLs and HTTP 200 status. `inputs.json`
references their existing paths, sizes and hashes; no primary copies were
made. A web-tool attempt to open the exact pages was inaccessible; the
retained primary bytes supplied the authority. Configured lighting tests
were not used to infer any defaults. The SPECULARENABLE paragraph's TRUE
exception is for interfaces earlier than Device3, not Device7.

| State | ID | DX7 default | Before, both devices/variants | After, both devices/variants |
| --- | ---: | ---: | ---: | ---: |
| SPECULARENABLE | 29 | 0 | 0 | 0 |
| LOCALVIEWER | 142 | 1 | 0 | 1 |
| NORMALIZENORMALS | 143 | 0 | 0 | 0 |
| COLORVERTEX | 141 | 1 | 0 | 1 |
| SPECULARMATERIALSOURCE | 146 | 2 | 0 | 2 |

`test/test-legacy-fresh-device-defaults.js` reuses the existing full-module
Node/Wasm bootstrap and real x86 COM CALL mechanics. It stops the configured
fixture immediately after successful public CreateDevice, before GetCaps,
lighting setters, transforms or rendering. The first Device7 operations are
GetRenderState calls against independently authored default literals. Every
query starts with distinct poisoned output and verifies surrounding guard
words; every public call checks exact stdcall cleanup, completion and stack
guards. The acquisition output is also guarded.

The test changes A one state at a time, checking the complete state vector
after each successful setter, and verifies that each alternate value rejects
the unchanged documented default. It then creates B while A holds those
alternate values. B's first calls read fresh defaults. Creating B must preserve
A. Both Boolean values and all three material-source enum values roundtrip
on B while A remains unchanged. Restoring A must preserve B, and releasing B
must preserve A. All public controls and releases complete before reporting
default mismatches, so the original failures retain successful controls rather
than stopping at the first incorrect value.

Before repair, both variants completed 205 guarded public calls, 33 complete
readback vectors and five discriminating setter controls, then failed exactly
six default comparisons each: the same three states on A and B. The original
module hashes were
`3dcd13cc618fe85624f92a88065daff44afc6f8f8c41eda0f6d82f1c6ccee9c5` and
`c9d364cf43cf055d3abcd4a056eb8dcdce5f1b918c6aad332dbd0816ec83a699`.
`before/` preserves the complete failures and public readbacks.

After repair the same audit passes, with the same call/readback/control counts.
The built module hashes are
`f1904a97d822d0a6c420eb59724622c64b70c1ba3be1fda2a439aa8e9c966aeb` and
`d7f4a3fbb2a088edeb97c2e1d756a115758c72eae31f0e7c1702cd3df23dbcbc`.
Focused verification covers the new audit, accepted directional and positional
specular, point/spot lighting, computed public lighting and setup, FVF,
ProcessVertices, vertex fog, ProcessVertices fog, dimensional ProcessVertices,
creation interfaces and creation allocation failures. The serialized
`flock /tmp/wine-build.lock bash tools/build.sh` passes. `checks.json` records
commands, environment variables and exit statuses; small logs and compressed
readbacks retain the evidence.

Recovery uses the recorded Git base, relevant binary diff and owned new-file
patches, followed by the recorded build/test commands. Git is the source
archive. `publication.json` records the published SHA and origin owned-blob
verification; `artifact-seal.json` records artifact hashes. Module and bootstrap
media paths/hashes are references only. No source snapshot, archive, binary
copy or media copy was made.

This closes these five fresh Device7 state readbacks and the three demonstrated
initialization defects. It does not establish all device defaults, output alpha,
nonuniform transforms, native Windows/GPU conformance or gameplay. Those remain
separate evidence questions after accepted positional `c5bda923c33ea7d6323757b805cc23b74e66232d`
and directional `5ac786cfd29b3d668620325511a4d66e54400aac`.
This task used offline Node/Wasm only, with no Chrome, game, boat API, workers,
deployment or lifecycle action. Box ID/state/expiry: not applicable. The
coordinator owns future runtime allocation and shutdown.
