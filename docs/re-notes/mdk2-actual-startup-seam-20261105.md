# MDK2 actual startup seam: reached, then missed by fixed-step admission

The sole authorized ordinary original reached `47d9c8` with all seven required
caller words at native run **3234**. Continuous observation was still dormant.
At the existing step3584 admission request, the actual PC was **44333e**, and
command65 correctly stopped on `unsupported pre-GC decoder checkpoint` at
04:41:51.396Z. No command66, New Game or Medium input followed. No admission,
observer, scheduling, clock, input or budget correction is justified at that
rejected state. No second original was attempted.

This supplies the actual slice-boundary evidence requested by
[the provenance implementation](mdk2-startup-native-provenance-20261105.md) and
[the checkpoint diagnosis](mdk2-reachable-checkpoint-cause-20261105.md).
It does not recover continuous CALL/GC history or prove gameplay.

## Actual reached evidence

Evidence is in `scratch/runs/20261105-mdk2-actual-startup-seam/`.
`startup-analysis.json` identifies the sole owning terminal report;
`reached-seam-witness.json` retains the exact native record, matching browser
Worker feedback, and adjacent actual records. The terminal report SHA-256 is
`2b7f7007fcc05307886554ba5b3dc2c5b672d81e8433736bea1d387cde33caa8`.

The authenticated owner is target `80B233389C2E67C5133CA218C98C3E0C`, slot0,
endpoint1, compilation0, sole instance1, thread1 and image base400000. Its
transferred Module is the existing 2,152,615-byte build with SHA-256
`3859c274df0233659eb10fe4d2784fff7d1553242b4ae2b3bf653e5d2ebdd95b`.

| Native run / request | Forwarded budget and completed blocks | Native elapsed ms | Worker ms | Actual ending PC / ESP |
| --- | ---: | ---: | ---: | --- |
| 3233 / 3294 | 9000 | 0.500 | 0.540 | 47e033 / 074ffc80 |
| 3234 / 3295 | 100000 | 5.330 | 5.390 | 47d9c8 / 074ffcd8 |
| 3235 / 3296 | 100000 | 210.420 | 210.505 | 46ef8d / 074ffbbc |
| 3236 / 3297 | 6000 | 9.285 | 9.360 | 46411f / 074ffbe0 |
| 3348 / 3409 | 25000 | 0.840 | 0.860 | 44333e / 074ffd40 |

All five returned normally with yield0. These are measured paired records,
not reconstructed budgets. In particular, run3235's actual Worker interval
is consistent with the unchanged adaptive formula choosing the following
6000-block budget. The cause of that interval's cost is unknown; instrumentation
and other host costs remain possible contributors. No claim of identical
adaptive trajectories across originals follows.

Run3234's 48-word caller readback is valid. Positions6/14/22/39/42/45/47 are
exactly `47ca7e/47a928/47b393/47c012/47c626/451546/402176`, matching every
existing admission caller guard. Its before/after guest tick count is56286;
all integer registers and lazy flags remain in the witness. Run3235 genuinely
starts at47d9c8, but its before tick count is56302 and it ordinarily proceeds
without an observer. The earlier seam's exact frozen host-step index is not
recorded and is not inferred from those ticks or request numbers.

At command65 the native state is instead44333e/074ffd40. The PC assertion
fires before the seven runtime stack assertions. Offline comparison shows
none of their required positions match: actual values are
`ffffffff/443085/07500338/0/40123c/48fd64/28`. The raw stack also contains
40218c at position20. Original instruction-aligned disassembly identifies
44333e as `add esp,4`, immediately after the callback's CALL443300 at443339.
The saved443085/40218c context is consistent with the collector-related route
through443070. Static bytes and saved returns do not establish observed entry
or return events and never seed observer frames.

The sealed journal reports3348 completed runs and63,447,377 completed startup
blocks,128 recent records,12 actual power-of-two milestones, and3220 recent
record evictions. All128 retained feedback records correlate with actual
requests; every recent after-state validates under the same owner. First
capture error and native failure are null. These startup totals are passive
counters, not an active observer allowance: `started:false`, `traced:false`,
`observer:null`, `traceEnd:null`. The unchanged50M/360s/512 observer contract
never started. Coverage between sampled boundaries remains unknown.

The critical missing evidence is continuous observation beginning while the
qualified seam is actually live, with relevant pending tracked calls excluded,
then genuine443070 entry with its actual40218c return and matching entryESP+4
return. There are114 subsequent native runs between the retained candidate
and the final state. Neither their sampled endpoints nor saved words can
retroactively supply that history. A future route must address live admission;
changing3584 to another guessed step, accepting44333e or4641c7, or replaying a
past sample is unsupported. This assignment stops at its first fault.

## Binding and validation

All shared production and test files remain unchanged. The exact published
68423e88b driver SHA-256 is
`62e3c2ff1654d4808170c6ee47e577fa6dd0636510b952bcdc341c5e891bba9f`.
Only small run-specific in-memory inputs bind this fresh assignment and its
finite host deadlines, dependency gate, and explicitly named published
D3D70330 source/module amendments. The complete prior, accepted and historical
manifests remain retained, and historical files are not rewritten.

`binding-inputs.json` names the four old/new source/module amendments from
published `f1d62b136d7e3b7d7bb1a108774f5c804533e483`. The paired compatibility
Module SHA-256 is
`9f042b70d7e43d3947415e1de01e7a540b3c7f7fa6c7fbefabdbea17e9633e95`.
Fresh hard host close/recovery bounds are10:50Z/10:53Z, within final stop11:00Z;
the720-second browser cap and180-second cleanup reserve remain unchanged.
No synthetic host clock is used for this run or its composed-entry preflight.

D3D70330 FINALf1d62b136, Stronghold0340 FINAL89caed5d1 and ReturnFire0345
FINAL69a5ea89d runtime AND file releases with ALLBUILDSFINISHED preceded every
executable check. Fresh independent cleanup verifies exact predecessor
PID/start-tick identities, actual normal exits, refused ports, absent profiles,
no heavy processes, both free locks and free disk above1.5GB.

Validation passed: four fresh-binding cases, all191 unchanged integration
checks including native startup/GC/pending-frame parity and terminal guards,
39 applicable local lifecycle/control checks, the unchanged observer suite on
both modules, and `flock /tmp/wine-build.lock bash tools/build.sh`. Modules
retain the exact named hashes after that build. The first local test selection
also included the historical02:20Z cutoff assertion; its expected mismatch
against the new authorized deadline is retained separately. The narrowed39
pass, and the four fresh-binding cases enforce the new exact bounds.

The full actual composed entry verifies439 filesystem,439 proof-HTTP and439
actual-caller-HTTP identities before its mocked Puppeteer launch boundary.
Public and native spawning are forbidden; zero Chrome launches occur, both
servers close and both ports refuse. Those mock artifacts are retained under
`preflight/`, separately from the sole ordinary original.

## Closure and recovery

All eight actual startup screenshots0 through3584 were personally viewed.
They show initial empty/gray startup, a BioWare splash, the title/legal screen,
and finally the highlighted New Game menu. They establish those displayed
states only. No gameplay, difficulty selection or continuous GC success is
claimed. The ordinary commands remain56 step64 requests and eight captures,
then state64 and the rejected step16 request65.

Chrome1994148/start190073078 closes normally at04:41:51.493Z with code0 and
signalnull after the first-command-failure closure. No kill occurs. Independent
verification at04:42:06.137Z finds Chrome, Node1993664/start190072452 and its
parent1993656/start190072435 absent; ports40243/44163/37481 refuse, the exact
profile is removed, no heavy process remains, and both locks are free.
`cleanup-verification.json` records these checks.

The original candidate Git SHA is
`69a5ea89d426b1b25552d1db1275e2746079aef7`. Recovery evidence includes relevant
binary diffs, patches for the small new run inputs and this note, and existing
input/media/module path SHA-256 references. All124 historical inputs, the
prepared run bindings, and the first-failure/terminal seal are rechecked for
unchanged bytes. No source snapshot, tar, module/media copy, npm, clone,
worktree, subworker, boat or public deployment is used. Box ID/state/expiry:NA;
this is local execution, and shutdown ownership remains with the coordinator.
