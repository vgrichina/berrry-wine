# Independent original TuxRacer registration acceptance

Candidate: `4bbc6434443094239579ec07ec91a84e3a0958b9`.
No production changes. The independent offline acceptance passed.

The new test executes the byte-exact `getAssetFiles` slice from pinned
`test/run.js`, with its real `../lib/app-files` dependency and real registry.
The initial behavioral checkpoint rejected an absent manifest before a consumer
could receive usable assets. The actual unmodified staging CLI then staged the
genuine retained original extracted root into one owned destination.

`test/test-tuxracer-registration-independent-accept.js` verifies all 158 payload
sizes and SHA-256 values (13,225,945 bytes), the exact staged file inventory,
157 companion mappings, executable guest path, working directory, all three DLL
seeds, eager validated buffers and resistance to later on-disk modification.
Its 32 rejection cases cover missing executable/DLL/Tcl/course/texture files,
same-size corruption, truncation, manifest URL and guest path escapes, duplicate
and missing mappings, extra fields, schema/JSON errors, and inventory tampering
or absence. A disposable source-string mutation disabling eager validation is
detected by the same consumer-success rejection oracle. Production source bytes
are unchanged.

Ten further adversarial checks invoke the actual staging CLI as a subprocess,
rather than calling its helpers. Sparse owned fixtures exercise missing and
corrupt required DLLs, size mismatch, a symlink to valid original bytes, a later
missing required asset, and altered inventory path/hash/size/executable content.
Each rejection exits nonzero without creating a destination. The owned positive
tree is moved aside during these checks, never copied. Original media and the
predecessor staging tree remain read-only. Temporary sparse fixtures are removed.

Reproduce the boundary check after staging retained originals:

```
node --max-old-space-size=96 test/test-tuxracer-registration-independent-accept.js
```

Run under the task's mandatory supervised resource and admission controls.
The retained task-local `supervisor.py` and `staging_accept.py` record the exact
CLI recipe and containment controls; they are not predecessor executables.
Canonical evidence lives at
`/tmp/tuxracer-registration-independent-accept-oct29/repo/receipt.json`.
The exact source, dispatch, admission, boundary, fixture, executable/environment,
startup, operation, resource, publication and cleanup identities are bound there.
Prior focused checks are reused from the candidate's canonical predecessor.

Tcl computed closure and full-media static closure remain **UNKNOWN**. Runtime
was **NOT RUN**. No Tcl evaluation, game, build, browser, guest, Boat, download,
installer, FUSE or mount operation occurred. No production repair, main push or
public deployment is included. The 48 MiB allocation remains reserved through
coordinator closeout; both retained staging trees count against it.
