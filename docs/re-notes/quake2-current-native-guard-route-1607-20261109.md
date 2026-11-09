# Q2 provision manifest argument repair

Evidence: `scratch/runs/20261109-quake2-current-native-guard-route-1607/`.

One leased box reached production provisioning and stopped at the first error,
before Chrome, the changed native fixture, or the original guard/door attempt.
The retained 1645 provision branch passes `.../runtime-pins.json` to
`stage-closure.cjs`, which treats its argument as a directory and appends
`/runtime-pins.json` again. The actual remote command failed with **ENOTDIR**.
No retry, later input/capture, or deadline extension followed. Gameplay,
guard defeat, and onward-door consequences remain **UNVERIFIED**.

`tools/quake2-staged-closure-gameplay.cjs` now provides the production command:

```sh
node tools/quake2-staged-closure-gameplay.cjs --consumer-preflight /absolute/run/runtime-pins.json
```

Fresh preparation publishes its tool, argument and manifest-file contract in
`consumerPreflight`. Use this command in the next provisioner instead of the
retained `stage-closure.cjs` invocation. Existing retained evidence is immutable;
its old provision branch still reproduces the failure. This is an explicit new
CLI route, not an automatic rewrite of historical callers.

The command validates the actual manifest and declared hook providers, checks
the published primary browser policy, imports the real writer closure, and runs
the actual composed consumer at `DRIVER_PREFLIGHT`, before Chrome. It preserves
the retained health, wire and authored native-fixture hooks and verifies their
observed composition. The primary CPU remains `3e491c08…`, compatibility CPU
`ecb45716…`, canonical EXE, owning Worker slot0 and native-write route unchanged.
The preflight's local 90-second validation window creates no runtime lease and
does not extend any gameplay deadline.

`tools/quake2-staged-consumer-preflight.test.py` extracts the exact provision
command expression from the retained control's AST. The old expression fails
with ENOTDIR. Changing its executable/argument contract to the published
preflight route passes through the actual consumer, with Git forbidden. Four
negative cases refuse a directory argument, a missing manifest, an omitted
observer hook and a damaged policy pin. The test uses real published production
preparation, real startup-barrier publication and real consumer composition;
there are no positive provider-read substitutions. The first authored test
omitted the barrier and correctly failed; that failed test is retained, not
classified as a pass.

The full owning CLI regression passes both the direct test-only seam and the
actual kernel supervisor after the repair. Those runs retain explicit stdin
start, the actual 1645 launch branch, startup barrier, current remote parent,
selected policy and composed fixture/health/wire consumer. Each outer parent
actually waits with separate stdout/stderr EOF. The kernel run has complete
reaps, empty unresolved sets and released lock. A separate local controller
preflight covers both readiness and early refusal, including actual child waits
and separate EOF. These are offline controls, not native qualification.
The existing staged suite passes its missing/damaged providers, forged repins,
wrong versions/authority and historical-default refusals. The required locked
build passes.

Before allocation, fresh production preparation passed with 735 providers;
six small explicit run inputs produced the final 741-provider manifest. Both
predecessor final published releases were present. Exact-UUID API reads
confirmed Redline1635 `bx_ncb2wqug` and Q3-1705 `bx_tg6jmkr8` ARCHIVED with
completed unforced normal stop receipts. Q3's 78 unique recovered artifacts
were independently reread by SHA, size and gzip CRC; the actual 170 reaps,
three distinct parent waits/separate EOF and physical drain receipts pass.
Redline's retained twelve-reap and physical receipts were also independently
reread. Neither peer's current offline-owned files intersected the Q2 provider
set; no other worker was frozen.

Our sole box was **bx_cjbyepj8**, UUID
**5df56c69-7ca4-4235-8e96-c563640392bb**. Its immutable independent 25-minute
UUID watchdog was armed and observed before allocation. Initial expiry was
**2026-11-09T16:31:00.599Z**. Unique remote evidence was retrieved, compressed
and SHA/size/gzip-CRC verified before delegated normal shutdown. Local command
records retain the exact remote ENOTDIR, actual executor wait and separate EOF.
The terminal physical census found no runtime/browser processes or original-run
FD holders, absent profile/writer lock and a free runtime lock. Runtime parents,
kernel reaps and endpoint numbers are **NOT_CREATED**; this is not a numbered
port-connect proof. Historical/browser EOF remains UNKNOWN.

Final exact box state is **ARCHIVED**, `archiveAfter=null`; final `expiresAt`
is not returned by the API. Normal unforced stop **stop_c65a2fce3029d9a5**
completed without error at **2026-11-09T16:07:19.022Z**. The independent watchdog
was actually joined with status 0 and separate EOF; lifecycle parent tool exit
is 0. No box was deleted or resumed. No local Chrome, agents, workers or public
deployment was launched.

Recovery records the exact Git base and small patches. No source-tree, media
or module archive was created. Empty/invalid evidence is never proof;
all-writers, aliases, peer/raw-host parsing, ABA and native gameplay
qualification remain UNKNOWN/false. Free `/home` stayed above 1.5 GB at observed
checks.

Next work needs a separately authorized fresh lease and fresh production pins,
the published manifest-file preflight route before allocation, the same local
controller/kernel preflight, one observable independent immutable UUID watchdog,
and one changed native fixture. An original guard/door attempt remains
conditional on all existing fixture and cancellation gates. This task makes
no further runtime attempt.
