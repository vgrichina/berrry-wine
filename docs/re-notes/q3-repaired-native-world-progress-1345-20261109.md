# Q3 original WebGL: menu progress; world gameplay unverified

Personally reviewed six original Quake III Arena captures. The run reached the
main menu, Choose Level and Game Server screens with five successful numbered
ACKs (0–4). Movement, firing and torch consequences remain **NOT_VERIFIED**.

The concrete blocker is an unverified Game Server transition. The NEXT click
and subsequent 100ms Enter completed successfully, but `arena-fight`,
`server-next` and `confirm-map` retained byte-identical Game Server PNGs:
`c8cdcb5e8843dfcb4e8f781f6818fe8519657271217af2c0373070438376dc08`.
The last capture completed at12:43:27.469Z. This does not establish whether
the guest consumed the input or whether the intended control was activated.
No world frame was reached, and no movement/fire/torch input was attempted.

Both Enter100ms receipts retain matching successful DOWN/UP CDP replies,
physical32768 in a wholly-held sample and completed independent UP promises.
Guest polls and application timing remain UNKNOWN. Native clicks retain their
independent release receipts. The Game Server cursor is visibly away from NEXT;
the retained evidence does not establish a production input defect or justify
a repair. Existing passive records show continuing CPU slices and GL requests,
without proving the missing menu transition. Next is offline review of the
original menu/input/application boundary, including pointer-lock routing.

I made this reviewed blocker terminal and closed the controlling stdin. Local
terminal EOF was12:44:20.109Z; remote transport cancellation was12:44:20.238Z.
No subsequent guest input, capture, ACK or runtime retry occurred. All previously
attempted keys/buttons had completed their independent releases. Joined cleanup
actually reaped330/330 owned identities, with command EOF, no unresolved reaps,
closed ports39473/36539, absent active profile, drained writers and free locks.
The local transports, generated parent, prelaunch and runtime retain actual
waits and separately observed stdoutEOF/stderrEOF. Root exit was-9; normal
Browser.close remains UNKNOWN. Box stop below is a separate lifecycle result.

The exact1305 whole-native-fixture and supported bounded cancellation proofs
were authenticated and reused from `c7a905af4`. No fixture was repeated.
The fresh original closure includes unchanged `58ddd8dc6` helper `bind_remote`,
updated prelaunch and `d3e02a9d5` ACK repair. All927 source/media providers match
the retained pins; only the small task-specific original runtime is new.
Original preCPU/preDLLmain admission released the owning module/instance,
endpoint1/slot0 and original flags unchanged. Original capture bindings retain
the exact module/context identities. Native lifetime remains REVOKED;
allwriters/edictABA remain UNKNOWN. Fixture proof is not gameplay proof.

Fresh generated invocation, original no-spawn/import-binding, prelaunch refusal,
actual caller pipe/ACK/EOF,44 dependency, input-evidence, delivery and startup
controls passed. `flock /tmp/wine-build.lock bash tools/build.sh` passed before
allocation. Two offline setup errors are retained: an initially misnamed prior
input-patch reference and a missing parent directory for prelaunch test cases.
Both were corrected before allocation; no native retry resulted.

Evidence: `scratch/runs/20261109-q3-repaired-native-world-progress-1345/`.
Exact Git base `b7537e798324531cd776ec6f588102050882f153`, empty relevant
tracked-source patch, small owned-input patches,927 path/hash pins and the1305
recovery references reconstruct the run. No source/media/module archives or
copies were added to evidence. All107 unique recovered artifacts were compressed
before transfer, SHA/size/gzip-CRC verified and independently reread BEFORE
delegated normal stop. Proof commands/results preceded raw-artifact renaming.
The679 inventory rows also account for pinned providers and excluded browser
cache. Free/home stayed above1.5GB.

After the run, another worker changed `src/05b-string-ops.wat` and rebuilt the
shared modules. The final evidence refresh initially refused that worktree
drift; its corrected recovery record explicitly retains the run's original
empty patch and preallocation pins. The uploaded/observed run module remains
`a320d4c85156644fd12b6134d66b11784f3100b9b135756206c087cdacd43295`.
The later shared worktree is not substituted for the run's source.

The1305 UUID/stop receipt was API-verified before allocation. One immutable,
observable independent25-minute UUID watchdog was prearmed before create.
Final box `bx_8w34tbhg`, UUID `25fdf3f2-f616-4e3d-a301-b9d496c0a624`, is
ARCHIVED/PHYSICAL_DRAINED. Unforced `stop_cc4d683a58df369d` completed at
`2026-11-09T12:45:36.383Z`. Initial expiry `2026-11-09T13:03:57.076Z`;
final archiveAfter null, expiresAt NOT_RETURNED. Watchdog/lifecycle exited0,
were actually waited with separate EOF and released the lifecycle lock.
No local Chrome, deployment, agents/workers or shared-client/custody/Q2/Redline/
host/WAT/HeroesII/CLAUDE edits. SingleTaskSTOP.
