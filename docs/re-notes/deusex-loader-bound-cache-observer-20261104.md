# Optional loader-bound Core/SoftDrv observation

This closes `e11350a53`'s **test-local attachment gap within Worker 0/thread 1's
JavaScript loader/run path**. The production Worker now accepts an optional
`cacheObservation` field on its existing `init` command, before exposing the
instance to loader services. The ordinary path remains disabled by default.
No game, original DllMain, complete history, complete lifetime or all-thread
qualification follows from this change.

Evidence: `scratch/runs/20261104-deusex-cache-loader-binding/`. Git SHA and relevant
binary diffs/new-file patches supply source recovery. Media remains in place:

| Path under `test/binaries/candidates/deus-ex-demo/installed/system/` | SHA-256 |
| --- | --- |
| `core.dll` | `2de35e0b4cf498e3587c76c0d0d332e5c29e1915986a79fa1521d8124a4c6167` |
| `softdrv.dll` | `25d14f3b6cca27053aa05b191424f4c0c0dffe0837406b44eb606cb9d8aeae18` |

No gzip input was decoded, and no media/module or source-tree archive was made.
Mutated media used by a negative test exists only in ephemeral test memory.

## Binding and composition

`lib/deusex-cache-loader-binding.js` supplies an exports facade. It observes the
actual staged bytes immediately before the underlying `load_dll` call, under
the production loader's staging/publication lock. Synchronous SHA-256 verifies
the complete original file, with PE signature, preferred base and image size
checks. The production WAT mapper publishes the row without executing guest
DllMain; binding completes before returning to the JavaScript loader.

Only that call's `get_last_loaded_dll_index()` supplies the candidate row. Its
INITIALIZING/LIVE state, load base, size and generation must be valid and match
the source's independent original mapped-PE identity check. Module names and
caller-supplied descriptor addresses never authorize adoption. Existing mappings
at attachment are explicitly unknown; no supplied media hash can retroactively
bind them. Unverified media gets no source. Ambiguous mappings are rejected.

The source for Core is the proven InlineEvictionObserver, including its startup
Init and FlushItem support. SoftDrv uses the proven SoftDrvCacheObserver. Each
verified generation gets a fresh bounded source and report. Reuse through the
production loader retains the original generation/report. Unload, base changes,
generation replacement and foreign thread ownership stop the old source before
further observed execution. Reload gets a separate report with unknown history;
records are never joined by address or matching ID. The native method observer
and descriptor/consumer arithmetic are unchanged.

The facade is installed before callback-owner registration and any external
loader admission. All JavaScript `run()` calls through that owning instance
therefore compose with both cache sources, including queued `loadDlls` callback
initialization, ordinary scheduled slices and the existing Draw adapter. No
test-local collector is assigned. Other exports retain their original functions.
Observation reads owning exports directly; no guest memory/register writes,
guest function calls, breakpoints, instruction watching, restoration or error
suppression are installed. The existing loader owns its callback gate, frame,
initialization outcome, error handling and restoration.

Active observation uses ordinary `run(1)` boundaries and retains the aggregate
public block count across a larger requested run. Folded blocks count by the
actual returned count rather than by the number of JavaScript calls. Yields,
halts and original exceptions retain their behavior. A trap preserves the last
completed public run's count, as the underlying unsplit run does; this is not
an inference about instructions retired before a trap. Source limits remain
finite, binding events are capped at 256, the first source terminal report is
retained, and a stopped binding cannot silently restart. A new process image
or Worker instance ends the previous binding.

## Production opt-in

The creator must add this field to **the first existing Worker init message**:

```js
cacheObservation: {
  limits: { maxBoundaries: 1000000, maxRecords: 256, maxMs: 10000 }
}
```

Omitting the field leaves the ordinary exports and dependency graph unchanged.
Browser opt-in imports the three proven sources and the new binding with the
same Worker URL version. Node uses their ordinary modules. No app registry or
natural driver is automatically enabled, and other Worker slots are rejected.

The queued command `{t:'cacheObservation', action:'status', seq}` returns
`cacheObservationResult` with the bounded report (null when disabled).
`action:'stop'` ends collection permanently for that binding. Status observes
the current boundary without executing guest code. No late-start command exists.

## Offline verification

`test/test-deusex-cache-loader-binding.js` reads the real shipped Worker, with a
test accessor that only reads its exports/binding. Control omits the init option
and installs no adapter. Observed arms use the production init option. Both
load original Core and SoftDrv with the real DLL loader at relocated bases
`0x50d000` and `0x7c5000`, respectively, generation 1.

A small synthetic DLL is passed through the actual **queued `loadDlls` command**.
Its DllMain calls original Core Init with synthetic cache/stack/storage and an
allocator dependency stub. The original Core instructions remain unchanged.
The real loader callback generator executes 81,998 blocks, including Init entry,
nested helpers and Init return, before returning to the command queue. This
does not execute or qualify original Core/SoftDrv DllMain or allocator startup.

Then three queued ordinary slices execute one original SoftDrv fast acquisition.
A seven-block batch and a batch that executes one block before real UD2 verify
aggregate/trap behavior. Seven ordered commands per arm are compared. Complete
512 MiB memory hashes, general registers/EIP/ESP, lazy flags, yield/halt, returned
counts, initialization result, per-slice state, commands and post-trap state
match the no-adapter control, in normal and compatibility WASM. Both source
reports terminate at the propagated guest trap. This is a narrow integration
fixture; the synthetic release matrix was not rerun as new gameplay evidence.

Controls cover production loader reuse, production unload/reload with distinct
generation reports, explicit stale generation/unload/base/thread mutations,
wrong media and Worker slot, and late attachment with no adoption. Unload/reload
uses explicit fixture no-callback initialization metadata, not original DllMain.
The browser synchronous hash is independently compared with Node crypto for
empty/short inputs and both complete originals. A retained causal control removes
only the production facade installation: it fails with zero bound sources at
the required post-initialization assertion, reproducing the attachment gap.

```sh
DEUSEX_BINDING_RESULT=scratch/runs/20261104-deusex-cache-loader-binding/result.json node test/test-deusex-cache-loader-binding.js
# Expected failure: disconnect the facade, keep the ordinary raw exports.
DEUSEX_BINDING_BASELINE=1 node test/test-deusex-cache-loader-binding.js
node test/test-deusex-inline-eviction-observer.js
node test/test-deusex-startup-cache-observer.js
node test/test-deusex-native-cache-observer.js
node test/test-dll-startup-rollback.js
flock /tmp/wine-build.lock bash tools/build.sh
```

Exact compiled Worker and per-arm WASM hashes are recorded in `result.json`.
The final tested Worker SHA is
`1a444957d8d4220443ce39fc11e5b90217ec2a22f234d2a9635bf9fee9d738e1`.
Tested WASM SHA-256 values are
`4417305d70322467441aef51e888b0fe66451d9c60da0c734eeb23f5a22c0a6b`
and `07fb4e75d05177271097dcd67d84e2629272b50073074bbdea8825ce10b4ed34`.
These include concurrent lighting work on shared main; no WAT change belongs to
this task. Earlier checks used predecessor builds; final logs distinguish them.

## Safe scope and remaining unknowns

This covers staged original PE generations mapped by this facade and JavaScript
run calls on its actual Worker 0/thread 1 instance. It does **not** prove every
loader or execution thread: internal WAT reentry (including callback/exception
execution inside one block), cooperative/non-Worker hosts, foreign loaders,
other instances/threads and concurrent writes remain unknown. Shared-memory
reads are not atomic snapshots. The original sources' duplicate suppression,
unqualified encodings, bounded/pending intervals, saved-PC pairing and missing
interior boundaries retain their limitations.

Every generation and record retains unknown prior lifetime/history. Seeing Init
does not prove there were no earlier objects, and no Core/SoftDrv sequence or
lock cost is promoted to retirement or a joined lifetime. Other Core invalidation
paths and descriptor/consumer ordering still need separate evidence before a
palette-survival or full-lifetime claim. A natural attempt must enable the option
before mapping, establish its actual run/served dependency identity, and retain
these unknowns. No broader loader/thread coverage is claimed here.

No Chrome, game, remote API, benchmark, assigned box, lifecycle operation,
deployment, approval request or subworker was used. Box ID/state/expiry: NA.
The coordinator retains runtime lifecycle ownership.
